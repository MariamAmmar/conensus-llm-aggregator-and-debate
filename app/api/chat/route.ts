import { NextRequest, NextResponse } from 'next/server';
import type { ModelMode, ImageProviderMode, AppResult, ModelResponse, ComputeTier, ConversationMessage, AttachedImage, AttachedDocument, ProviderId } from '@/types';
import { routeWithAgent } from '@/router/agent';
import { TEXT_PROVIDERS, IMAGE_PROVIDERS, resolveImageProvider } from '@/providers';
import { runDebate } from '@/debate';
import { generateId } from '@/utils';
import { supabase, createAdminClient } from '@/lib/supabase';
import { OWNER_EMAIL } from '@/lib/stripe';
import { applyMariamContext, BASE_SYSTEM_PROMPT } from '@/lib/mariam';

export const dynamic = 'force-dynamic';

const FREE_TOKEN_LIMIT = 15000;
const FREE_DEBATE_LIMIT = 3; // anon: 3 debates lifetime
const MAX_PROMPT_LENGTH = 32000;

// Monthly caps for subscribers — modes that are expensive per call
const PAID_MONTHLY_LIMITS: Partial<Record<ModelMode, number>> = {
  debate: 30,  // 8 models + scoring + synthesis ~$0.10–0.20 each
  all:    50,  // 8 simultaneous calls ~$0.03 each
  image:  30,  // DALL-E 3 / Imagen ~$0.04 each
};

const MODE_TO_PROVIDER: Partial<Record<ModelMode, string>> = {
  chatgpt: 'openai', claude: 'anthropic', gemini: 'gemini',
  perplexity: 'perplexity', grok: 'grok', llama: 'llama',
  o4mini: 'o4mini', deepseek: 'deepseek',
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function getIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  // ── Access control ─────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
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
      const { data: sub } = await admin
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      const hasAccess = sub && ['active', 'trialing'].includes(sub.status as string);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
          { status: 402 },
        );
      }
    } else {
      const ip = getIP(request);
      const { data: usage } = await admin
        .from('ip_usage')
        .select('token_count, debate_count')
        .eq('ip', ip)
        .single();

      const tokenCount = (usage?.token_count as number | null) ?? 0;
      if (tokenCount >= FREE_TOKEN_LIMIT) {
        return NextResponse.json(
          { error: 'Free limit reached', code: 'LIMIT_REACHED', tokensUsed: tokenCount },
          { status: 429 },
        );
      }

      anonIP = ip;
    }
  }
  // ── End access control ─────────────────────────────────────────────────────

  try {
    const body = await request.json();
    const {
      prompt,
      mode,
      imageProvider = 'auto-image',
      history = [],
      images = [],
      documents = [],
      userMemory = [],
      userPreferences = '',
      selectedModels = [],
    } = body as {
      prompt: string;
      mode: ModelMode;
      imageProvider: ImageProviderMode;
      history: ConversationMessage[];
      images: AttachedImage[];
      documents: AttachedDocument[];
      userMemory: string[];
      userPreferences: string;
      selectedModels: ModelMode[];
    };

    // Validate prompt before doing anything else
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: 'Prompt too long' }, { status: 400 });
    }

    // Subscriber monthly caps for expensive modes (debate / all / image)
    const paidLimit = PAID_MONTHLY_LIMITS[mode];
    if (!isOwner && userId && paidLimit !== undefined) {
      const admin = createAdminClient();
      const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const { data: usage } = await admin
        .from('user_mode_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('mode', mode)
        .single();

      const currentCount = (usage?.count as number | null) ?? 0;
      if (currentCount >= paidLimit) {
        return NextResponse.json(
          { error: `Monthly ${mode} limit reached (${paidLimit}/month)`, code: 'MODE_LIMIT_REACHED', limit: paidLimit },
          { status: 429 },
        );
      }

      await admin.from('user_mode_usage').upsert(
        { user_id: userId, month, mode, count: currentCount + 1 },
        { onConflict: 'user_id,month,mode' },
      );
    }

    // Anon usage tracking — token count + debate limit
    if (anonIP) {
      const admin = createAdminClient();
      const { data: current } = await admin
        .from('ip_usage')
        .select('token_count, debate_count')
        .eq('ip', anonIP)
        .single();

      const existingTokens = (current?.token_count as number | null) ?? 0;
      const existingDebates = (current?.debate_count as number | null) ?? 0;

      // Debate-specific cap — 3 free debates regardless of token count
      if (mode === 'debate' && existingDebates >= FREE_DEBATE_LIMIT) {
        return NextResponse.json(
          { error: 'Free debate limit reached', code: 'LIMIT_REACHED' },
          { status: 429 },
        );
      }

      const upsertData: Record<string, unknown> = {
        ip: anonIP,
        token_count: existingTokens + estimateTokens(prompt),
        updated_at: new Date().toISOString(),
      };
      if (mode === 'debate') upsertData.debate_count = existingDebates + 1;

      await admin.from('ip_usage').upsert(upsertData, { onConflict: 'ip' });
    }

    // Inject text document contents into the prompt so all providers benefit
    const textDocContext = documents
      .filter((d) => d.contentType === 'text')
      .map((d) => `<document name="${d.name}">\n${d.content}\n</document>`)
      .join('\n\n');
    const augmentedPrompt = applyMariamContext(textDocContext ? `${textDocContext}\n\n${prompt}` : prompt);

    // PDFs passed directly to providers that support them (Anthropic)
    const pdfDocs = documents.filter((d) => d.contentType === 'pdf');

    // Owner identity + memory context
    const ownerContext = isOwner
      ? `The person you are speaking with is Mariam Ammar, the creator and founder of Consensus AI. Address her by name when it feels natural. She built this platform and has full access to everything.`
      : '';
    const memoryContext = userMemory.length > 0
      ? `Context about this user from previous conversations:\n${userMemory.map((f) => `- ${f}`).join('\n')}`
      : '';
    const prefsContext = userPreferences.trim()
      ? `User preferences (always follow these):\n${userPreferences.trim()}`
      : '';
    const systemPrefix = [BASE_SYSTEM_PROMPT, ownerContext, memoryContext, prefsContext].filter(Boolean).join('\n\n');

    const id = generateId();

    // ── Image mode ──────────────────────────────────────────────────────────
    if (mode === 'image') {
      const provider = resolveImageProvider(prompt, imageProvider);
      try {
        const imageResult = await provider.generate(prompt);
        return NextResponse.json({ id, prompt, mode, routerDecision: null, responses: [], debateResult: null, finalAnswer: '', imageResult, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
      } catch {
        const fallbackProvider = provider.id === 'openai-image' ? IMAGE_PROVIDERS['gemini-image'] : IMAGE_PROVIDERS['openai-image'];
        if (!fallbackProvider) throw new Error('All image providers failed');
        const imageResult = await fallbackProvider.generate(prompt);
        return NextResponse.json({ id, prompt, mode, routerDecision: null, responses: [], debateResult: null, finalAnswer: '', imageResult, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
      }
    }

    // ── Multi-select mode ────────────────────────────────────────────────────
    if (selectedModels.length > 1 && selectedModels.every((m) => m in MODE_TO_PROVIDER)) {
      const providerIds = selectedModels.map((m) => MODE_TO_PROVIDER[m]).filter(Boolean) as string[];
      const responses = await Promise.all(
        providerIds.map(async (pid) => {
          const provider = TEXT_PROVIDERS[pid as ProviderId];
          if (!provider) return null;
          return provider.complete(augmentedPrompt, systemPrefix, 800, 'standard', history, images, pid === 'anthropic' ? pdfDocs : []);
        }),
      );
      return NextResponse.json({ id, prompt, mode: 'all', routerDecision: null, responses: responses.filter(Boolean) as ModelResponse[], debateResult: null, finalAnswer: '', imageResult: null, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
    }

    // ── All models mode ──────────────────────────────────────────────────────
    if (mode === 'all') {
      const allProviders = ['openai', 'anthropic', 'gemini', 'perplexity', 'grok', 'llama', 'o4mini', 'deepseek'] as const;
      const responses = await Promise.all(
        allProviders.map(async (pid) => {
          const provider = TEXT_PROVIDERS[pid];
          if (!provider) return null;
          return provider.complete(augmentedPrompt, systemPrefix, 800, 'standard', history, images, pid === 'anthropic' ? pdfDocs : []);
        }),
      );
      return NextResponse.json({ id, prompt, mode, routerDecision: null, responses: responses.filter(Boolean) as ModelResponse[], debateResult: null, finalAnswer: '', imageResult: null, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
    }

    // ── Debate mode ──────────────────────────────────────────────────────────
    if (mode === 'debate') {
      const debateResult = await runDebate(augmentedPrompt, history, systemPrefix);
      return NextResponse.json({ id, prompt, mode, routerDecision: null, responses: debateResult.responses, debateResult, finalAnswer: debateResult.synthesizedAnswer, imageResult: null, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
    }

    // ── Auto + single model modes ────────────────────────────────────────────
    const routerDecision = await routeWithAgent(augmentedPrompt, mode);
    const providerId = routerDecision.selectedModel as ProviderId;

    // Auto-routed to image
    if (routerDecision.requiresImageGeneration && IMAGE_PROVIDERS[providerId as keyof typeof IMAGE_PROVIDERS]) {
      const imgProvider = IMAGE_PROVIDERS[providerId as keyof typeof IMAGE_PROVIDERS] ?? IMAGE_PROVIDERS['openai-image']!;
      try {
        const imageResult = await imgProvider.generate(prompt);
        return NextResponse.json({ id, prompt, mode, routerDecision, responses: [], debateResult: null, finalAnswer: '', imageResult, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
      } catch {
        const fallback = IMAGE_PROVIDERS[routerDecision.fallbackModel as keyof typeof IMAGE_PROVIDERS];
        if (fallback) {
          const imageResult = await fallback.generate(prompt);
          return NextResponse.json({ id, prompt, mode, routerDecision, responses: [], debateResult: null, finalAnswer: '', imageResult, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);
        }
        throw new Error('All image providers failed');
      }
    }

    const provider = TEXT_PROVIDERS[providerId as ProviderId];
    if (!provider) {
      return NextResponse.json({ error: `Provider "${providerId}" is not available` }, { status: 501 });
    }

    const tier: ComputeTier = (routerDecision as { computeTier?: ComputeTier }).computeTier ?? 'standard';
    let response = await provider.complete(augmentedPrompt, systemPrefix, 800, tier, history, images, providerId === 'anthropic' ? pdfDocs : []);

    // Smart retry: fallback if errored OR response is suspiciously short
    const isTooShort = !response.error && response.content.trim().length < 40;
    if ((response.error || isTooShort) && routerDecision.fallbackModel) {
      const fallbackId = routerDecision.fallbackModel as ProviderId;
      const fallback = TEXT_PROVIDERS[fallbackId];
      if (fallback) {
        response = await fallback.complete(augmentedPrompt, systemPrefix, 800, tier, history, images, fallbackId === 'anthropic' ? pdfDocs : []);
      }
    }

    return NextResponse.json({ id, prompt, mode, routerDecision, responses: [response], debateResult: null, finalAnswer: response.content, imageResult: null, timestamp: new Date(), durationMs: Date.now() - start } satisfies AppResult);

  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
