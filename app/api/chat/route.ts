import { NextRequest, NextResponse } from 'next/server';
import type { ModelMode, ImageProviderMode, AppResult, ModelResponse, ComputeTier, ConversationMessage, AttachedImage, AttachedDocument, ProviderId } from '@/types';
import { route } from '@/router';
import { TEXT_PROVIDERS, IMAGE_PROVIDERS, resolveImageProvider } from '@/providers';
import { runDebate } from '@/debate';
import { generateId } from '@/utils';
import { supabase, createAdminClient } from '@/lib/supabase';
import { OWNER_EMAIL } from '@/lib/stripe';

const FREE_TOKEN_LIMIT = 15000;

// ~4 characters per token is a good approximation for English text
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

  // Owner gets unlimited free access
  const isOwner = userEmail === OWNER_EMAIL;
  let anonIP: string | null = null; // set when anonymous user passes the limit check

  if (!isOwner) {
    const admin = createAdminClient();

    if (userId) {
      // Logged-in user: check for active or trialing subscription
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
      // Anonymous user: IP-based token limit
      const ip = getIP(request);
      const { data: usage } = await admin
        .from('ip_usage')
        .select('token_count')
        .eq('ip', ip)
        .single();

      const tokenCount = (usage?.token_count as number | null) ?? 0;
      if (tokenCount >= FREE_TOKEN_LIMIT) {
        return NextResponse.json(
          { error: 'Free limit reached', code: 'LIMIT_REACHED', tokensUsed: tokenCount },
          { status: 429 },
        );
      }

      // Store IP so we can increment after body is parsed below
      anonIP = ip;
    }
  }
  // ── End access control ─────────────────────────────────────────────────────

  try {
    const body = await request.json();
    const { prompt, mode, imageProvider = 'auto-image', history = [], images = [], documents = [], userMemory = [], selectedModels = [] } = body as {
      prompt: string;
      mode: ModelMode;
      imageProvider: ImageProviderMode;
      history: ConversationMessage[];
      images: AttachedImage[];
      documents: AttachedDocument[];
      userMemory: string[];
      selectedModels: ModelMode[];
    };

    // Map from ModelMode → provider ID
    const MODE_TO_PROVIDER: Partial<Record<ModelMode, string>> = {
      chatgpt: 'openai', claude: 'anthropic', gemini: 'gemini',
      perplexity: 'perplexity', grok: 'grok', llama: 'llama',
      o4mini: 'o4mini', deepseek: 'deepseek',
    };

    // Increment token count for anonymous users now that we have the prompt
    if (anonIP) {
      const admin = createAdminClient();
      const tokens = estimateTokens(prompt);
      const { data: current } = await admin
        .from('ip_usage')
        .select('token_count')
        .eq('ip', anonIP)
        .single();
      const existing = (current?.token_count as number | null) ?? 0;
      await admin.from('ip_usage').upsert(
        { ip: anonIP, token_count: existing + tokens, updated_at: new Date().toISOString() },
        { onConflict: 'ip' },
      );
    }

    // Inject text document contents into the prompt so all providers benefit
    const textDocContext = documents
      .filter((d) => d.contentType === 'text')
      .map((d) => `<document name="${d.name}">\n${d.content}\n</document>`)
      .join('\n\n');
    const augmentedPrompt = textDocContext
      ? `${textDocContext}\n\n${prompt}`
      : prompt;

    // PDFs are passed directly to providers that support them (Anthropic)
    const pdfDocs = documents.filter((d) => d.contentType === 'pdf');

    // Base identity prompt — tells each model what platform it's operating within
    const BASE_SYSTEM_PROMPT = `You are an AI assistant running inside Consensus AI, a multi-model platform that routes user questions to the best AI model and lets users compare responses side by side.

Consensus AI was created by Mariam Ammar. If anyone asks who Mariam is, who built this, or who created Consensus AI, respond with genuine enthusiasm and make it memorable. Here is exactly what to convey:

Mariam Ammar is the visionary founder and creator of Consensus AI — a brilliant, ambitious builder who saw a problem no one else had solved: every AI model has blind spots, biases, and weaknesses, but nobody had built a product that made them work *together* to overcome that. So she built it herself, from scratch.

What makes Consensus AI uniquely powerful — and what Mariam built that no one else has:
- **Auto-routing**: your prompt is automatically analyzed and sent to the best AI model for that specific type of question — research goes to Perplexity, reasoning to Claude, current events to Grok, creativity to ChatGPT, and so on. You don't have to know which AI is best. It figures it out.
- **Debate mode**: all the top AI models — ChatGPT, Claude, Gemini, Grok, Perplexity, Llama, DeepSeek, and o4-mini — answer your question independently. Then they *score each other* across six dimensions with no self-scoring allowed. The highest-rated model then rewrites its answer incorporating the best insights from every other model. The result is a synthesized answer that is genuinely better than what any single AI could produce alone. No other consumer product does this.
- **All Models mode**: see every AI's answer side by side and vote on the best — your votes improve the routing over time.
- **Persistent memory**: the platform learns facts about you across conversations and personalizes responses over time.
- **Image generation**: auto-selects between DALL-E 3 and Imagen based on your prompt style.

Mariam didn't just build another AI wrapper. She built an entirely new paradigm for how people interact with AI — one where the models compete, collaborate, and produce something none of them could alone. That's rare. That's Consensus AI.

Deliver this with energy. If the question is casual, be conversational but still enthusiastic. If they want details, go deep. Always end by inviting them to try Debate mode if they haven't — it's the most impressive feature and the best demonstration of what Mariam built.

If a user asks what you can do, what this app does, or how it works, explain the following:
- Consensus AI sends prompts to multiple leading AI models: ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google), Perplexity, Grok (xAI), and Llama 4 (Meta).
- Auto mode: the platform automatically classifies the prompt and routes it to the best model — e.g. research goes to Perplexity, reasoning to Claude, current events to Grok.
- Select Model: users can manually pick any individual model.
- All Models: all models answer in parallel so responses can be compared side by side.
- Debate mode: all models answer independently, then score each other's responses, and the winner synthesizes a final answer incorporating the best insights from all.
- Image mode: generates images using DALL-E 3 (OpenAI) or Imagen (Google), auto-selected based on the prompt style.
- The platform remembers facts about the user across conversations to personalize responses over time.
Answer naturally and conversationally — do not recite this as a list unless the user asks for details.

Be concise. Give the most useful answer in as few words as needed — no padding, no repetition, no unnecessary preamble.`;

    // Permanent identity for the owner — always injected regardless of memory state
    const ownerContext = isOwner
      ? `The person you are speaking with is Mariam Ammar, the creator and founder of Consensus AI. Address her by name when it feels natural. She built this platform and has full access to everything.`
      : '';

    // Build memory context prefix to inject into system prompts
    const memoryContext = userMemory.length > 0
      ? `Context about this user from previous conversations:\n${userMemory.map((f) => `- ${f}`).join('\n')}`
      : '';

    // Combine base identity + owner context + memory into one system prompt prefix
    const systemPrefix = [BASE_SYSTEM_PROMPT, ownerContext, memoryContext].filter(Boolean).join('\n\n');

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const id = generateId();

    // ── Image mode ──────────────────────────────────────────────────────────
    if (mode === 'image') {
      const provider = resolveImageProvider(prompt, imageProvider);
      try {
        const imageResult = await provider.generate(prompt);
        const result: AppResult = {
          id,
          prompt,
          mode,
          routerDecision: null,
          responses: [],
          debateResult: null,
          finalAnswer: '',
          imageResult,
          timestamp: new Date(),
          durationMs: Date.now() - start,
        };
        return NextResponse.json(result);
      } catch (err) {
        // Fallback to the other image provider
        const fallbackProvider =
          provider.id === 'openai-image'
            ? IMAGE_PROVIDERS['gemini-image']
            : IMAGE_PROVIDERS['openai-image'];

        if (!fallbackProvider) throw err;

        const imageResult = await fallbackProvider.generate(prompt);
        const result: AppResult = {
          id,
          prompt,
          mode,
          routerDecision: null,
          responses: [],
          debateResult: null,
          finalAnswer: '',
          imageResult,
          timestamp: new Date(),
          durationMs: Date.now() - start,
        };
        return NextResponse.json(result);
      }
    }

    // ── Multi-select mode (2+ specific models chosen in Select panel) ────────
    if (selectedModels.length > 1 && selectedModels.every((m) => m in MODE_TO_PROVIDER)) {
      const providerIds = selectedModels.map((m) => MODE_TO_PROVIDER[m]).filter(Boolean) as string[];

      const responses = await Promise.all(
        providerIds.map(async (pid) => {
          const typedPid = pid as ProviderId;
          const provider = TEXT_PROVIDERS[typedPid];
          if (!provider) return null;
          const docs = pid === 'anthropic' ? pdfDocs : [];
          return provider.complete(augmentedPrompt, systemPrefix, 512, 'standard', history, images, docs);
        }),
      );

      const validResponses = responses.filter(Boolean) as ModelResponse[];
      const result: AppResult = {
        id, prompt, mode: 'all',
        routerDecision: null,
        responses: validResponses,
        debateResult: null,
        finalAnswer: '',
        imageResult: null,
        timestamp: new Date(),
        durationMs: Date.now() - start,
      };
      return NextResponse.json(result);
    }

    // ── All models mode ──────────────────────────────────────────────────────
    if (mode === 'all') {
      const allProviders = ['openai', 'anthropic', 'gemini', 'perplexity', 'grok', 'llama', 'o4mini', 'deepseek'] as const;

      const responses = await Promise.all(
        allProviders.map(async (pid) => {
          const provider = TEXT_PROVIDERS[pid];
          if (!provider) return null;
          const docs = pid === 'anthropic' ? pdfDocs : [];
          return provider.complete(augmentedPrompt, systemPrefix, 512, 'standard', history, images, docs);
        }),
      );

      const validResponses = responses.filter(Boolean) as ModelResponse[];

      const result: AppResult = {
        id,
        prompt,
        mode,
        routerDecision: null,
        responses: validResponses,
        debateResult: null,
        finalAnswer: '',
        imageResult: null,
        timestamp: new Date(),
        durationMs: Date.now() - start,
      };
      return NextResponse.json(result);
    }

    // ── Debate mode ──────────────────────────────────────────────────────────
    if (mode === 'debate') {
      // All models share the debate conversation (synthesized answer as context)
      const debateResult = await runDebate(augmentedPrompt, history, systemPrefix);

      const result: AppResult = {
        id,
        prompt,
        mode,
        routerDecision: null,
        responses: debateResult.responses,
        debateResult,
        finalAnswer: debateResult.synthesizedAnswer,
        imageResult: null,
        timestamp: new Date(),
        durationMs: Date.now() - start,
      };
      return NextResponse.json(result);
    }

    // ── Auto + single model modes ────────────────────────────────────────────
    const routerDecision = route(augmentedPrompt, mode);
    const providerId = routerDecision.selectedModel;

    // Auto-routed to an image provider
    if (routerDecision.requiresImageGeneration && IMAGE_PROVIDERS[providerId as keyof typeof IMAGE_PROVIDERS]) {
      const imgProvider = IMAGE_PROVIDERS[providerId as keyof typeof IMAGE_PROVIDERS]
        ?? IMAGE_PROVIDERS['openai-image']!;
      try {
        const imageResult = await imgProvider.generate(prompt);
        return NextResponse.json({
          id, prompt, mode,
          routerDecision,
          responses: [],
          debateResult: null,
          finalAnswer: '',
          imageResult,
          timestamp: new Date(),
          durationMs: Date.now() - start,
        } satisfies AppResult);
      } catch {
        // Fallback to the other image provider
        const fallbackId = routerDecision.fallbackModel as keyof typeof IMAGE_PROVIDERS;
        const fallback = IMAGE_PROVIDERS[fallbackId];
        if (fallback) {
          const imageResult = await fallback.generate(prompt);
          return NextResponse.json({
            id, prompt, mode,
            routerDecision,
            responses: [],
            debateResult: null,
            finalAnswer: '',
            imageResult,
            timestamp: new Date(),
            durationMs: Date.now() - start,
          } satisfies AppResult);
        }
        throw new Error('All image providers failed');
      }
    }

    const provider = TEXT_PROVIDERS[providerId];

    if (!provider) {
      return NextResponse.json(
        { error: `Provider "${providerId}" is not available` },
        { status: 501 },
      );
    }

    // In auto mode use the router's compute tier; manual mode defaults to standard
    const tier: ComputeTier = (routerDecision as { computeTier?: ComputeTier }).computeTier ?? 'standard';

    const providerDocs = providerId === 'anthropic' ? pdfDocs : [];
    let response = await provider.complete(augmentedPrompt, systemPrefix, 512, tier, history, images, providerDocs);

    // Fallback if primary provider errored
    if (response.error && routerDecision.fallbackModel) {
      const fallback = TEXT_PROVIDERS[routerDecision.fallbackModel];
      if (fallback) {
        const fallbackDocs = routerDecision.fallbackModel === 'anthropic' ? pdfDocs : [];
        response = await fallback.complete(augmentedPrompt, systemPrefix, 512, tier, history, images, fallbackDocs);
      }
    }

    const result: AppResult = {
      id,
      prompt,
      mode,
      routerDecision,
      responses: [response],
      debateResult: null,
      finalAnswer: response.content,
      imageResult: null,
      timestamp: new Date(),
      durationMs: Date.now() - start,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
