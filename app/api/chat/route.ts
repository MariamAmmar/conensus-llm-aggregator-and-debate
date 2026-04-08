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
    const { prompt, mode, imageProvider = 'auto-image', history = [], providerConversations = {}, debateConversation = [], images = [] } = body as {
      prompt: string;
      mode: ModelMode;
      imageProvider: ImageProviderMode;
      history: ConversationMessage[];
      providerConversations: ProviderConversations;
      debateConversation: ConversationMessage[];
      images: AttachedImage[];
    };

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
      const allProviders = ['openai', 'anthropic', 'gemini', 'perplexity'] as const;

      const responses = await Promise.all(
        allProviders.map(async (pid) => {
          const provider = TEXT_PROVIDERS[pid];
          if (!provider) return null;
          // Each provider gets its own independent conversation history
          const providerHistory = providerConversations[pid] ?? [];
          return provider.complete(prompt, undefined, 1024, 'standard', providerHistory, images);
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
      const debateResult = await runDebate(prompt, debateConversation);

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
    const provider = TEXT_PROVIDERS[providerId];

    if (!provider) {
      return NextResponse.json(
        { error: `Provider "${providerId}" is not available` },
        { status: 501 },
      );
    }

    // In auto mode use the router's compute tier; manual mode defaults to standard
    const tier: ComputeTier = (routerDecision as { computeTier?: ComputeTier }).computeTier ?? 'standard';

    let response = await provider.complete(prompt, undefined, 1024, tier, history, images);

    // Fallback if primary provider errored
    if (response.error && routerDecision.fallbackModel) {
      const fallback = TEXT_PROVIDERS[routerDecision.fallbackModel];
      if (fallback) {
        response = await fallback.complete(prompt, undefined, 1024, tier, history, images);
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
