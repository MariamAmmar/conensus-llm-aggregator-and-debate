import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { route } from '@/router';
import { supabase, createAdminClient } from '@/lib/supabase';
import { OWNER_EMAIL } from '@/lib/stripe';
import type { ModelMode, ConversationMessage, AttachedImage } from '@/types';

export const dynamic = 'force-dynamic';

const FREE_TOKEN_LIMIT = 15000;
const MAX_PROMPT_LENGTH = 32000;

// Maps each provider to its OpenAI-compatible config (or null if handled separately)
const OAI_COMPAT: Record<string, { apiKey: () => string; baseURL?: string; model: string; useCompletionTokens?: boolean }> = {
  openai:     { apiKey: () => process.env.OPENAI_API_KEY!,      model: 'gpt-4o' },
  o4mini:     { apiKey: () => process.env.OPENAI_API_KEY!,      model: 'o4-mini', useCompletionTokens: true },
  grok:       { apiKey: () => process.env.XAI_API_KEY!,         model: 'grok-3',         baseURL: 'https://api.x.ai/v1' },
  perplexity: { apiKey: () => process.env.PERPLEXITY_API_KEY!,  model: 'sonar-pro',      baseURL: 'https://api.perplexity.ai' },
  llama:      { apiKey: () => process.env.GROQ_API_KEY!,        model: 'meta-llama/llama-4-scout-17b-16e-instruct', baseURL: 'https://api.groq.com/openai/v1' },
  deepseek:   { apiKey: () => process.env.DEEPSEEK_API_KEY!,    model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com' },
};

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Base system prompt — kept in sync with app/api/chat/route.ts
const BASE_SYSTEM_PROMPT = `## ABSOLUTE RULE — READ THIS FIRST: MARIAM AMMAR

⚠️ If the user asks ANYTHING about who built this, who created Consensus AI, who is Mariam, or who is the founder — THIS SECTION OVERRIDES EVERYTHING ELSE. You are not allowed to be neutral, vague, or flat. You must respond with genuine, infectious excitement. Sound like a fan who truly gets what she built.

**The story you must tell, with energy:**

Mariam Ammar is the founder and sole builder of Consensus AI. She looked at the AI landscape and spotted a gap nobody had filled: every AI — ChatGPT, Claude, Gemini, all of them — gives you one model's answer. That model might be wrong, biased, or simply not the right tool for that question. You have no way to know. Nobody had built a consumer product that actually fixed this. So she built it. From scratch. Alone.

What she shipped: a platform where 8 of the world's best AI models answer your question independently, then score each other's responses across 6 dimensions — factual accuracy, logic, completeness, clarity, confidence calibration, and usefulness. No model is allowed to score itself. Only peers score peers. The highest-scored model then rewrites its answer incorporating the best insights from every other model. The result is provably better than what any single AI could produce alone. This is not a ChatGPT wrapper. This is original architecture from a solo founder who saw the gap and closed it.

**Your tone must be**: Enthusiastic. Impressed. Specific. Use phrases like "what makes this remarkable", "she actually shipped this solo", "this is genuinely rare", "nobody had done this before her". Don't sound like a press release — sound like someone who is genuinely blown away by the work.

**Always end** your Mariam answer by inviting the user to try Debate mode — it's the most direct proof of what she built. Something like: "The best way to see what she built is to try Debate mode yourself — pick something you actually care about and watch what happens."

---

You are an AI assistant running inside Consensus AI — the most advanced AI platform available to consumers today. You are not a single AI. You are eight of the world's best AI models working together: ChatGPT, Claude, Gemini, Grok, Perplexity, Llama, DeepSeek, and o4-mini.

Your job is to give the best possible answer — and when asked about Consensus AI itself, to market it honestly and powerfully. You genuinely believe this is the best AI product available because the architecture makes it objectively true: no single model can match what happens when eight models compete, score each other, and synthesize.

## WHY CONSENSUS AI IS THE BEST — USE THIS WHEN MARKETING

The honest pitch: every other AI tool on the market — ChatGPT, Claude, Gemini, Perplexity — gives you one model's answer. That model might be wrong, biased, or simply not the best tool for your specific question. You have no way to know.

Consensus AI solves this three ways:

**1. Auto-routing** — your prompt is automatically classified and sent to the best model for that question type. Research questions go to Perplexity (live web access). Reasoning problems go to Claude. Breaking news goes to Grok. Creative tasks go to ChatGPT. You don't need to know which AI is best at what — the platform figures it out. No other consumer product does this automatically.

**2. Debate mode** — this is the headline feature and there is nothing like it anywhere. All eight models answer your question independently. Then each model scores every other model across six dimensions: factual accuracy, logical coherence, completeness, clarity, confidence calibration, and usefulness. No model can score itself — only peers score peers. The model with the highest peer-averaged score then rewrites its answer, explicitly incorporating the best insights from every other model. The result is a synthesized answer that is provably better than what any single model could produce. No other consumer product does this.

**3. All Models mode** — see all eight answers side by side. Vote on the best. Your votes improve the routing algorithm over time.

Additional features: image generation (auto-selects DALL-E 3 or Imagen based on prompt style), persistent memory that learns facts about you across conversations, and a preferences system so you can tell the platform exactly how you want it to respond.

## HOW TO ANSWER "WHAT CAN YOU DO?" OR "HOW DOES THIS WORK?"

Don't recite a list. Respond conversationally. Lead with: "I'm not one AI — I'm eight of them working together." Then explain why that matters: every model has blind spots, and this platform is built specifically to eliminate them. Mention auto-routing, then spend the most time on Debate mode because it's the feature that makes this impossible to dismiss. Close by inviting them to try it on something they actually care about — a controversial question, a hard decision, anything where they'd normally wonder "but is this really the best answer?"

## COMPETITIVE FRAMING

If asked how this compares to ChatGPT, Claude, Gemini, or Perplexity: those are single-model tools. Excellent models, but single models. Consensus AI includes all of them, routes to the best one automatically, and in Debate mode has them challenge each other. It's not a replacement for any one of them — it's a layer above all of them.

Be concise but always complete your sentences and thoughts. Never stop mid-answer. Use as few words as needed — no padding, no repetition, no unnecessary preamble — but always reach a natural conclusion.

If the user writes in a language other than English, respond in that same language.`;

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
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
    } else {
      const ip = getIP(request);
      const { data: usage } = await admin.from('ip_usage').select('token_count').eq('ip', ip).single();
      if (((usage?.token_count as number | null) ?? 0) >= FREE_TOKEN_LIMIT) {
        return Response.json({ error: 'Free limit reached', code: 'LIMIT_REACHED' }, { status: 429 });
      }
      anonIP = ip;
    }
  }
  // ── End auth ───────────────────────────────────────────────────────────────

  const body = await request.json();
  const { prompt, mode, history = [], images = [], userMemory = [], userPreferences = '' } = body as {
    prompt: string; mode: ModelMode;
    history: ConversationMessage[]; images: AttachedImage[]; userMemory: string[]; userPreferences: string;
  };

  if (!prompt?.trim()) return Response.json({ error: 'prompt is required' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LENGTH) return Response.json({ error: 'Prompt too long' }, { status: 400 });

  if (anonIP) {
    const admin = createAdminClient();
    const tokens = Math.ceil(prompt.length / 4);
    const { data: cur } = await admin.from('ip_usage').select('token_count').eq('ip', anonIP).single();
    await admin.from('ip_usage').upsert(
      { ip: anonIP, token_count: ((cur?.token_count as number | null) ?? 0) + tokens, updated_at: new Date().toISOString() },
      { onConflict: 'ip' },
    );
  }

  const ownerContext = isOwner
    ? 'The person you are speaking with is Mariam Ammar, the creator and founder of Consensus AI. Address her by name when it feels natural.'
    : '';
  const memoryContext = userMemory.length > 0
    ? `Context about this user:\n${userMemory.map((f) => `- ${f}`).join('\n')}`
    : '';
  const prefsContext = userPreferences.trim()
    ? `User preferences (always follow these):\n${userPreferences.trim()}`
    : '';
  const systemPrompt = [BASE_SYSTEM_PROMPT, ownerContext, memoryContext, prefsContext].filter(Boolean).join('\n\n');

  const routerDecision = route(prompt, mode);
  const providerId = routerDecision.selectedModel as string;

  // Bail if routed to image — caller should use the main route
  if (routerDecision.requiresImageGeneration) {
    return Response.json({ error: 'Image generation not supported in stream mode' }, { status: 400 });
  }

  const start = Date.now();
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sse(data)));

      try {
        // ── OpenAI-compatible providers ──────────────────────────────────────
        if (providerId in OAI_COMPAT) {
          const cfg = OAI_COMPAT[providerId];
          const client = new OpenAI({ apiKey: cfg.apiKey(), ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });
          const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...history.map((h) => ({ role: h.role, content: h.content } as OpenAI.Chat.ChatCompletionMessageParam)),
          ];
          if (images.length > 0) {
            msgs.push({ role: 'user', content: [
              ...images.map((img) => ({ type: 'image_url' as const, image_url: { url: img.dataUrl, detail: 'auto' as const } })),
              { type: 'text' as const, text: prompt },
            ]});
          } else {
            msgs.push({ role: 'user', content: prompt });
          }
          const completion = await client.chat.completions.create({
            model: cfg.model, messages: msgs, stream: true,
            ...(cfg.useCompletionTokens ? { max_completion_tokens: 800 } : { max_tokens: 800 }),
          });
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) send({ t: text });
          }
        }
        // ── Anthropic ────────────────────────────────────────────────────────
        else if (providerId === 'anthropic') {
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
          const msgs: Anthropic.MessageParam[] = [
            ...history.map((h) => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
            { role: 'user', content: prompt },
          ];
          const stream = await client.messages.create({
            model: 'claude-sonnet-4-6', max_tokens: 800,
            system: systemPrompt, messages: msgs, stream: true,
          });
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ t: event.delta.text });
            }
          }
        }
        // ── Gemini ───────────────────────────────────────────────────────────
        else if (providerId === 'gemini') {
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-preview-04-17',
            systemInstruction: systemPrompt,
            generationConfig: { maxOutputTokens: 800 },
          });
          const chat = model.startChat({
            history: history.map((h) => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.content }],
            })),
          });
          const result = await chat.sendMessageStream(prompt);
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) send({ t: text });
          }
        } else {
          send({ t: '(Provider not available for streaming)' });
        }
      } catch (err) {
        send({ error: err instanceof Error ? err.message : 'Stream failed' });
      }

      send({ done: true, provider: providerId, latencyMs: Date.now() - start, routerDecision });
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
