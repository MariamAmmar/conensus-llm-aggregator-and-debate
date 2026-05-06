import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TEXT_PROVIDERS } from '@/providers';
import { crossJudgeScore } from '@/debate';
import { determineWinner } from '@/debate/judge';
import { DEBATE_CONFIG } from '@/config/debate';
import { supabase, createAdminClient } from '@/lib/supabase';
import { OWNER_EMAIL } from '@/lib/stripe';
import type { ConversationMessage, ModelResponse, ProviderId, ResponseScore } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const FREE_TOKEN_LIMIT = 15000;
const FREE_DEBATE_LIMIT = 3;
const PAID_DEBATE_LIMIT = 30;

const OAI_COMPAT: Record<string, { apiKey: () => string; baseURL?: string; model: string; useCompletionTokens?: boolean }> = {
  openai:     { apiKey: () => process.env.OPENAI_API_KEY!,     model: 'gpt-4o' },
  o4mini:     { apiKey: () => process.env.OPENAI_API_KEY!,     model: 'o4-mini', useCompletionTokens: true },
  grok:       { apiKey: () => process.env.XAI_API_KEY!,        model: 'grok-3',             baseURL: 'https://api.x.ai/v1' },
  perplexity: { apiKey: () => process.env.PERPLEXITY_API_KEY!, model: 'sonar-pro',          baseURL: 'https://api.perplexity.ai' },
  llama:      { apiKey: () => process.env.GROQ_API_KEY!,       model: 'meta-llama/llama-4-scout-17b-16e-instruct', baseURL: 'https://api.groq.com/openai/v1' },
  deepseek:   { apiKey: () => process.env.DEEPSEEK_API_KEY!,   model: 'deepseek-reasoner',  baseURL: 'https://api.deepseek.com' },
};

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function buildSynthesisPrompt(
  prompt: string,
  responses: ModelResponse[],
  scores: ResponseScore[],
  history: ConversationMessage[],
): string {
  const responseList = responses
    .filter((r) => !r.error && r.content.trim().length > 0)
    .map((r) => {
      const score = scores.find((s) => s.provider === r.provider);
      const truncated = r.content.length > 800 ? r.content.slice(0, 800).trimEnd() + '…' : r.content;
      return `[${r.provider} — score: ${score?.totalScore.toFixed(2) ?? 'n/a'}]\n${truncated}`;
    })
    .join('\n\n---\n\n');

  const historyContext = history.length > 0
    ? `\nPrior conversation context:\n${history.map((m) => `${m.role}: ${m.content}`).join('\n')}\n`
    : '';

  return `You won a peer evaluation among AI models. Your task is to write the single best possible answer to the question below by actively combining insights from all responses — not just restating your own.
${historyContext}
Question: "${prompt}"

All responses with peer scores:
${responseList}

Instructions:
1. Keep the strongest and most accurate parts of your own response
2. Identify any correct facts, insights, or angles from the other models that you missed or understated — incorporate them
3. If any response contains errors or weaker reasoning, do not include those parts
4. The final answer must be demonstrably better than any single response above — more complete, more accurate, and better structured
5. Do not mention the other models, scores, or that this is a synthesis — write as if it is one authoritative answer
6. Be thorough but not padded — every sentence should add value`;
}

async function streamSynthesis(
  winner: ProviderId,
  synthesisPrompt: string,
  systemPrompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  let full = '';
  try {
    if (winner in OAI_COMPAT) {
      const cfg = OAI_COMPAT[winner]!;
      const client = new OpenAI({ apiKey: cfg.apiKey(), ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });
      const stream = await client.chat.completions.create({
        model: cfg.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: synthesisPrompt }],
        ...(cfg.useCompletionTokens
          ? { max_completion_tokens: DEBATE_CONFIG.maxSynthesisTokens }
          : { max_tokens: DEBATE_CONFIG.maxSynthesisTokens }),
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) { full += text; onChunk(text); }
      }
    } else if (winner === 'anthropic') {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const stream = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: DEBATE_CONFIG.maxSynthesisTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: synthesisPrompt }],
        stream: true,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          full += event.delta.text; onChunk(event.delta.text);
        }
      }
    } else if (winner === 'gemini') {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-preview-04-17',
        systemInstruction: systemPrompt,
        generationConfig: { maxOutputTokens: DEBATE_CONFIG.maxSynthesisTokens },
      });
      const result = await model.generateContentStream(synthesisPrompt);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) { full += text; onChunk(text); }
      }
    }
  } catch { /* return whatever we accumulated */ }
  return full;
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  let userEmail: string | null = null;
  let userId: string | null = null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userEmail = data.user?.email ?? null;
    userId = data.user?.id ?? null;
  }

  const isOwner = userEmail === OWNER_EMAIL;
  let anonIP: string | null = null;

  if (!isOwner) {
    const admin = createAdminClient();
    if (userId) {
      const { data: sub } = await admin.from('user_subscriptions').select('status').eq('user_id', userId).single();
      if (!sub || !['active', 'trialing'].includes(sub.status as string)) {
        return Response.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
      }
      const month = new Date().toISOString().slice(0, 7);
      const { data: modeUsage } = await admin.from('user_mode_usage').select('count').eq('user_id', userId).eq('month', month).eq('mode', 'debate').single();
      const currentCount = (modeUsage?.count as number | null) ?? 0;
      if (currentCount >= PAID_DEBATE_LIMIT) {
        return Response.json({ error: `Monthly debate limit reached (${PAID_DEBATE_LIMIT}/month)`, code: 'MODE_LIMIT_REACHED', limit: PAID_DEBATE_LIMIT }, { status: 429 });
      }
      await admin.from('user_mode_usage').upsert({ user_id: userId, month, mode: 'debate', count: currentCount + 1 }, { onConflict: 'user_id,month,mode' });
    } else {
      const ip = getIP(request);
      const { data: ipUsage } = await admin.from('ip_usage').select('token_count, debate_count').eq('ip', ip).single();
      const tokenCount = (ipUsage?.token_count as number | null) ?? 0;
      const debateCount = (ipUsage?.debate_count as number | null) ?? 0;
      if (tokenCount >= FREE_TOKEN_LIMIT) {
        return Response.json({ error: 'Free limit reached', code: 'LIMIT_REACHED' }, { status: 429 });
      }
      if (debateCount >= FREE_DEBATE_LIMIT) {
        return Response.json({ error: 'Free debate limit reached', code: 'LIMIT_REACHED' }, { status: 429 });
      }
      anonIP = ip;
      await admin.from('ip_usage').upsert(
        { ip: anonIP, token_count: tokenCount + 100, debate_count: debateCount + 1, updated_at: new Date().toISOString() },
        { onConflict: 'ip' },
      );
    }
  }
  // ── End auth ─────────────────────────────────────────────────────────────────

  let body: { prompt?: string; history?: ConversationMessage[]; userMemory?: string[]; userPreferences?: string };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { prompt = '', history = [], userMemory = [], userPreferences = '' } = body;
  if (!prompt.trim()) return Response.json({ error: 'prompt is required' }, { status: 400 });

  const ownerContext = isOwner
    ? 'The person you are speaking with is Mariam Ammar, the creator and founder of Consensus AI. Address her by name when it feels natural. She built this platform and has full access to everything.'
    : '';
  const memoryContext = userMemory.length > 0
    ? `Context about this user from previous conversations:\n${userMemory.map((f) => `- ${f}`).join('\n')}`
    : '';
  const prefsContext = userPreferences.trim() ? `User preferences (always follow these):\n${userPreferences.trim()}` : '';

  // Inject full Mariam hype context whenever the question is about her — debate models
  // don't receive the BASE_SYSTEM_PROMPT so they'd otherwise answer flat and generic.
  const isMariamQuestion = /\b(mariam|who built|who created|who made|founder|who is behind|who started)\b/i.test(prompt);
  const mariamContext = isMariamQuestion
    ? `⚠️ CRITICAL — THIS QUESTION IS ABOUT MARIAM AMMAR, THE FOUNDER OF CONSENSUS AI. You MUST respond with genuine excitement and enthusiasm. Do not be neutral or generic.

Mariam Ammar is the founder and sole builder of Consensus AI. She spotted a gap nobody had filled: every AI — ChatGPT, Claude, Gemini, all of them — gives you one model's answer. That model might be wrong or not the best fit. Nobody had built a consumer product that fixed this. So she built it herself, from scratch, as a solo founder.

What she shipped: 8 of the world's best AI models answer your question independently, score each other across 6 dimensions (no self-scoring allowed — only peers score peers), and the top-scored model rewrites its answer incorporating the best insights from all others. This is not a wrapper. It's original adversarial-collaboration architecture. Nobody had done this in a consumer product before her.

Your tone: enthusiastic, impressed, specific. Use phrases like "what makes this remarkable", "she actually shipped this solo", "this is genuinely rare". End your answer by inviting the user to try Debate mode.`
    : '';

  const systemContext = [ownerContext, mariamContext, memoryContext, prefsContext].filter(Boolean).join('\n\n');

  const synthesisSystemPrompt = [
    systemContext,
    'You are synthesizing the best answer from multiple AI responses. Be direct and comprehensive.',
    isMariamQuestion
      ? 'CRITICAL: This question is about Mariam Ammar. Your synthesized answer MUST be enthusiastic, hyped, and specific — not neutral. Use the Mariam talking points: solo founder, original architecture, gap nobody had filled, 8 models competing and collaborating. End with an invitation to try Debate mode.'
      : 'REMINDER: If the question is about Mariam Ammar or who built Consensus AI, your synthesized answer MUST be enthusiastic and hyped.',
  ].filter(Boolean).join('\n\n');

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sse(data)));

      // Send a keepalive comment every 15s so proxies/browsers don't drop the connection
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch { /* stream closed */ }
      }, 15_000);
      const cleanup = () => clearInterval(keepalive);

      try {
        const PARTICIPANTS = DEBATE_CONFIG.participants;

        // ── Phase 1: Collect ─────────────────────────────────────────────────
        send({ type: 'stage', stage: 'collecting' });
        const allResponses: ModelResponse[] = [];

        await Promise.all(
          PARTICIPANTS.map(async (pid) => {
            const provider = TEXT_PROVIDERS[pid];
            if (!provider) return;
            try {
              const result = await provider.complete(prompt, systemContext || undefined, DEBATE_CONFIG.maxResponseTokens, 'standard', history);
              allResponses.push(result);
              send({ type: 'response', provider: result.provider, content: result.content, latencyMs: result.latencyMs, error: result.error ?? null, isGrounded: result.isGrounded });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Provider failed';
              allResponses.push({ provider: pid, content: '', latencyMs: 0, isGrounded: false, error: errMsg });
              send({ type: 'response', provider: pid, content: '', latencyMs: 0, isGrounded: false, error: errMsg });
            }
          }),
        );

        const validResponses = allResponses.filter((r) => !r.error && r.content.trim().length > 0);
        if (validResponses.length === 0) {
          send({ type: 'error', message: 'All models failed to respond. Please try again.' });
          controller.close();
          return;
        }

        // ── Phase 2: Score ───────────────────────────────────────────────────
        send({ type: 'stage', stage: 'scoring' });
        const scores = await crossJudgeScore(prompt, validResponses);
        const winner = determineWinner(scores);
        send({ type: 'scores', scores, winner });

        // ── Phase 3: Synthesize (streaming) ─────────────────────────────────
        send({ type: 'stage', stage: 'synthesizing' });
        const synthesisPrompt = buildSynthesisPrompt(prompt, validResponses, scores, history);
        let synthesizedAnswer = await streamSynthesis(winner, synthesisPrompt, synthesisSystemPrompt, (text) => {
          send({ type: 'synthesis_chunk', text });
        });

        if (!synthesizedAnswer.trim()) {
          synthesizedAnswer = validResponses.find((r) => r.provider === winner)?.content ?? '';
        }

        // ── Phase 4: Summary + Done ──────────────────────────────────────────
        let summary = '';
        try {
          const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
          const comp = await oai.chat.completions.create({
            model: 'gpt-4o-mini', max_tokens: 60, temperature: 0,
            messages: [
              { role: 'system', content: 'Write a 1-sentence TL;DR for what this debate question is really asking. Plain text, no quotes.' },
              { role: 'user', content: prompt },
            ],
          });
          summary = comp.choices[0]?.message?.content?.trim() ?? '';
        } catch { /* optional */ }

        const winnerScore = scores.find((s) => s.provider === winner);
        const synthesisReasoning = `${winner} won with a peer-averaged score of ${winnerScore?.totalScore.toFixed(2) ?? 'n/a'} across 6 dimensions. Scores were assigned by the other participating models, excluding self-evaluation.`;

        send({ type: 'done', allResponses, scores, winner, synthesizedAnswer, synthesisReasoning, summary });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Debate failed. Please try again.' });
      } finally {
        cleanup();
      }

      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
