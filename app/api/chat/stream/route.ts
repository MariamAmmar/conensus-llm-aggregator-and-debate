import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { route } from '@/router';
import { supabase, createAdminClient } from '@/lib/supabase';
import { OWNER_EMAIL } from '@/lib/stripe';
import { applyMariamContext, BASE_SYSTEM_PROMPT } from '@/lib/mariam';
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

  // Inject Mariam hype context into the user message itself when the prompt
  // is about her — system-prompt-only instructions get ignored by web-grounded
  // models like Perplexity. Routing uses the original prompt; providers see
  // the hyped version.
  const userMessage = applyMariamContext(prompt);

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
              { type: 'text' as const, text: userMessage },
            ]});
          } else {
            msgs.push({ role: 'user', content: userMessage });
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
            { role: 'user', content: userMessage },
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
          const result = await chat.sendMessageStream(userMessage);
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
