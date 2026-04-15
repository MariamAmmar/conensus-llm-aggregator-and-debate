import Anthropic from '@anthropic-ai/sdk';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage, AttachedDocument } from '@/types';

const MODELS: Record<ComputeTier, string> = {
  light:    'claude-haiku-4-5-20251001',
  standard: 'claude-sonnet-4-6',
  heavy:    'claude-opus-4-5',
};

const TIMEOUT_MS = 30_000;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

export const anthropicProvider: TextProvider = {
  id: 'anthropic',
  name: 'Claude',

  async complete(prompt, systemPrompt, maxTokens = 1024, computeTier = 'standard', history: ConversationMessage[] = [], images: AttachedImage[] = [], documents: AttachedDocument[] = []): Promise<ModelResponse> {
    const start = Date.now();
    const model = MODELS[computeTier];
    try {
      const client = getClient();
      const messages: Anthropic.MessageParam[] = [
        ...history.map((msg) => ({ role: msg.role, content: msg.content } as Anthropic.MessageParam)),
      ];

      // Build user content — PDFs + images + text
      const hasAttachments = images.length > 0 || documents.length > 0;
      if (hasAttachments) {
        const content: Anthropic.ContentBlockParam[] = [];

        // PDF documents (Claude supports them natively)
        for (const doc of documents) {
          if (doc.contentType === 'pdf') {
            content.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: doc.content.split(',')[1], // strip data:application/pdf;base64,
              },
            } as unknown as Anthropic.ContentBlockParam);
          }
          // text docs are pre-injected into the prompt at the API route level
        }

        for (const img of images) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: img.dataUrl.split(',')[1],
            },
          });
        }

        content.push({ type: 'text', text: prompt });
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const response = await Promise.race([
        client.messages.create({
          model,
          max_tokens: maxTokens,
          system: systemPrompt ?? 'You are a helpful, thoughtful assistant.',
          messages,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Anthropic request timed out')), TIMEOUT_MS),
        ),
      ]);

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        provider: 'anthropic',
        content,
        latencyMs: Date.now() - start,
        isGrounded: false,
      };
    } catch (err) {
      return {
        provider: 'anthropic',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: false,
        error: err instanceof Error ? err.message : 'Anthropic request failed',
      };
    }
  },
};
