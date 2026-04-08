import OpenAI from 'openai';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

const MODELS: Record<ComputeTier, string> = {
  light:    'gpt-4o-mini',
  standard: 'gpt-4o',
  heavy:    'gpt-4o',
};

const TIMEOUT_MS = 30_000;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey });
}

export const openaiProvider: TextProvider = {
  id: 'openai',
  name: 'ChatGPT',

  async complete(prompt, systemPrompt, maxTokens = 1024, computeTier = 'standard', history: ConversationMessage[] = [], images: AttachedImage[] = []): Promise<ModelResponse> {
    const start = Date.now();
    const model = MODELS[computeTier];
    try {
      const client = getClient();
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      for (const msg of history) messages.push({ role: msg.role, content: msg.content });

      // Build user content — text + optional images
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
          setTimeout(() => reject(new Error('OpenAI request timed out')), TIMEOUT_MS),
        ),
      ]);

      return {
        provider: 'openai',
        content: response.choices[0]?.message?.content ?? '',
        latencyMs: Date.now() - start,
        isGrounded: false,
      };
    } catch (err) {
      return {
        provider: 'openai',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: false,
        error: err instanceof Error ? err.message : 'OpenAI request failed',
      };
    }
  },
};
