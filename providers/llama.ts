import OpenAI from 'openai';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

// Llama 4 via Groq's OpenAI-compatible API
const MODELS: Record<ComputeTier, string> = {
  light:    'meta-llama/llama-4-scout-17b-16e-instruct',
  standard: 'meta-llama/llama-4-maverick-17b-128e-instruct',
  heavy:    'meta-llama/llama-4-maverick-17b-128e-instruct',
};

const TIMEOUT_MS = 30_000;

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');
  return new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
}

export const llamaProvider: TextProvider = {
  id: 'llama',
  name: 'Llama',

  async complete(prompt, systemPrompt, maxTokens = 1024, computeTier = 'standard', history: ConversationMessage[] = [], images: AttachedImage[] = []): Promise<ModelResponse> {
    const start = Date.now();
    const model = MODELS[computeTier];
    try {
      const client = getClient();
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      for (const msg of history) messages.push({ role: msg.role, content: msg.content });

      // Llama 4 Maverick supports vision via Groq
      if (images.length > 0) {
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          ...images.map((img): OpenAI.Chat.ChatCompletionContentPart => ({
            type: 'image_url',
            image_url: { url: img.dataUrl, detail: 'auto' },
          })),
          { type: 'text', text: prompt },
        ];
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const response = await Promise.race([
        client.chat.completions.create({ model, messages, max_tokens: maxTokens }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Llama request timed out')), TIMEOUT_MS),
        ),
      ]);

      return {
        provider: 'llama',
        content: response.choices[0]?.message?.content ?? '',
        latencyMs: Date.now() - start,
        isGrounded: false,
      };
    } catch (err) {
      return {
        provider: 'llama',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: false,
        error: err instanceof Error ? err.message : 'Llama request failed',
      };
    }
  },
};
