import OpenAI from 'openai';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

// DeepSeek R1 — reasoning model with chain-of-thought via OpenAI-compatible API
const TIMEOUT_MS = 60_000; // reasoning can take longer

function getClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');
  return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
}

export const deepseekProvider: TextProvider = {
  id: 'deepseek',
  name: 'DeepSeek R1',

  async complete(prompt, systemPrompt, maxTokens = 2048, _computeTier: ComputeTier = 'standard', history: ConversationMessage[] = [], _images: AttachedImage[] = []): Promise<ModelResponse> {
    const start = Date.now();
    try {
      const client = getClient();
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      for (const msg of history) messages.push({ role: msg.role, content: msg.content });
      // DeepSeek R1 does not support image inputs
      messages.push({ role: 'user', content: prompt });

      const response = await Promise.race([
        client.chat.completions.create({
          model: 'deepseek-reasoner',
          messages,
          max_tokens: maxTokens,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DeepSeek request timed out')), TIMEOUT_MS),
        ),
      ]);

      // deepseek-reasoner returns the final answer in content (reasoning is separate)
      return {
        provider: 'deepseek',
        content: response.choices[0]?.message?.content ?? '',
        latencyMs: Date.now() - start,
        isGrounded: false,
      };
    } catch (err) {
      return {
        provider: 'deepseek',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: false,
        error: err instanceof Error ? err.message : 'DeepSeek request failed',
      };
    }
  },
};
