import OpenAI from 'openai';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

// Perplexity uses an OpenAI-compatible API
const BASE_URL = 'https://api.perplexity.ai';

// Model selected per compute tier
// light    → sonar ($1.00 / $1.00 per 1M tokens) — smallest grounded model
// standard → sonar-pro ($3.00 / $15.00 per 1M tokens)
// heavy    → sonar-pro ($3.00 / $15.00 per 1M tokens)
const MODELS: Record<ComputeTier, string> = {
  light:    'sonar',
  standard: 'sonar-pro',
  heavy:    'sonar-pro',
};

const TIMEOUT_MS = 45_000; // web search takes longer than pure LLM calls

function getClient() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY is not set');
  return new OpenAI({ apiKey, baseURL: BASE_URL });
}

export const perplexityProvider: TextProvider = {
  id: 'perplexity',
  name: 'Perplexity',

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(prompt, systemPrompt, maxTokens = 1024, computeTier = 'standard', history: ConversationMessage[] = [], _images: AttachedImage[] = []): Promise<ModelResponse> {
    const start = Date.now();
    const model = MODELS[computeTier];
    try {
      const client = getClient();
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt ?? 'You are a helpful research assistant. Provide accurate, well-sourced answers using real-time web information.',
        },
        ...history.map((msg) => ({ role: msg.role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam)),
        { role: 'user', content: prompt },
      ];

      const response = await Promise.race([
        client.chat.completions.create({ model, messages, max_tokens: maxTokens }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Perplexity request timed out')), TIMEOUT_MS),
        ),
      ]);

      const citations: string[] = (response as unknown as { citations?: string[] }).citations ?? [];
      return {
        provider: 'perplexity',
        content: response.choices[0]?.message?.content ?? '',
        latencyMs: Date.now() - start,
        isGrounded: true,
        citations,
      };
    } catch (err) {
      return {
        provider: 'perplexity',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: true,
        error: err instanceof Error ? err.message : 'Perplexity request failed',
      };
    }
  },
};
