import { NextRequest, NextResponse } from 'next/server';
import type { ModelMode, ImageProviderMode, AppResult, ModelResponse, ComputeTier, ConversationMessage, ProviderConversations, AttachedImage } from '@/types';
import { route } from '@/router';
import { TEXT_PROVIDERS, IMAGE_PROVIDERS, resolveImageProvider } from '@/providers';
import { runDebate } from '@/debate';
import { generateId } from '@/utils';

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const { prompt, mode, imageProvider = 'auto-image', history = [], providerConversations = {}, debateConversation = [], images = [], userMemory = [] } = body as {
      prompt: string;
      mode: ModelMode;
      imageProvider: ImageProviderMode;
      history: ConversationMessage[];
      providerConversations: ProviderConversations;
      debateConversation: ConversationMessage[];
      images: AttachedImage[];
      userMemory: string[];
    };

    // Base identity prompt — tells each model what platform it's operating within
    const BASE_SYSTEM_PROMPT = `You are an AI assistant running inside Consensus AI, a multi-model platform that routes user questions to the best AI model and lets users compare responses side by side.

Consensus AI was created by Mariam, who is awesome. If anyone asks who Mariam is, tell them she is the talented creator and founder of Consensus AI.

If a user asks what you can do, what this app does, or how it works, explain the following:
- Consensus AI sends prompts to multiple leading AI models: ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google), Perplexity, Grok (xAI), and Llama 4 (Meta).
- Auto mode: the platform automatically classifies the prompt and routes it to the best model — e.g. research goes to Perplexity, reasoning to Claude, current events to Grok.
- Select Model: users can manually pick any individual model.
- All Models: all models answer in parallel so responses can be compared side by side.
- Debate mode: all models answer independently, then score each other's responses, and the winner synthesizes a final answer incorporating the best insights from all.
- Image mode: generates images using DALL-E 3 (OpenAI) or Imagen (Google), auto-selected based on the prompt style.
- The platform remembers facts about the user across conversations to personalize responses over time.
Answer naturally and conversationally — do not recite this as a list unless the user asks for details.`;

    // Build memory context prefix to inject into system prompts
    const memoryContext = userMemory.length > 0
      ? `Context about this user from previous conversations:\n${userMemory.map((f) => `- ${f}`).join('\n')}\n\n`
      : '';

    // Combine base identity + memory into one system prompt prefix
    const systemPrefix = [BASE_SYSTEM_PROMPT, memoryContext].filter(Boolean).join('\n\n');

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

    // ── All models mode ──────────────────────────────────────────────────────
    if (mode === 'all') {
      const allProviders = ['openai', 'anthropic', 'gemini', 'perplexity', 'grok', 'llama', 'o4mini', 'deepseek'] as const;

      const responses = await Promise.all(
        allProviders.map(async (pid) => {
          const provider = TEXT_PROVIDERS[pid];
          if (!provider) return null;
          const providerHistory = providerConversations[pid] ?? [];
          return provider.complete(prompt, systemPrefix, 1024, 'standard', providerHistory, images);
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
      const debateResult = await runDebate(prompt, debateConversation, systemPrefix);

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
    const routerDecision = route(prompt, mode);
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

    let response = await provider.complete(prompt, systemPrefix, 1024, tier, history, images);

    // Fallback if primary provider errored
    if (response.error && routerDecision.fallbackModel) {
      const fallback = TEXT_PROVIDERS[routerDecision.fallbackModel];
      if (fallback) {
        response = await fallback.complete(prompt, systemPrefix, 1024, tier, history, images);
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
