import OpenAI from 'openai';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

// o4-mini is a reasoning model — uses max_completion_tokens, not max_tokens
const TIMEOUT_MS = 60_000; // reasoning models can take longer

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey });
}

export const o4miniProvider: TextProvider = {
  id: 'o4mini',
  name: 'o4-mini',

  async complete(prompt, systemPrompt, maxTokens = 2048, _computeTier: ComputeTier = 'standard', history: ConversationMessage[] = [], images: AttachedImage[] = []): Promise<ModelResponse> {
    const start = Date.now();
    try {
      const client = getClient();
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      for (const msg of history) messages.push({ role: msg.role, content: msg.content });

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
        client.chat.completions.create({
          model: 'o4-mini',
          messages,
          max_completion_tokens: maxTokens,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('o4-mini request timed out')), TIMEOUT_MS),
        ),
      ]);

      return {
        provider: 'o4mini',
        content: response.choices[0]?.message?.content ?? '',
        latencyMs: Date.now() - start,
        isGrounded: false,
      };
    } catch (err) {
      return {
        provider: 'o4mini',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: false,
        error: err instanceof Error ? err.message : 'o4-mini request failed',
      };
    }
  },
};
