import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TextProvider } from './base';
import type { ModelResponse, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

const MODELS: Record<ComputeTier, string> = {
  light:    'gemini-2.5-flash',
  standard: 'gemini-2.5-pro',
  heavy:    'gemini-2.5-pro',
};

const TIMEOUT_MS = 30_000;

function getClient() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(apiKey);
}

export const geminiProvider: TextProvider = {
  id: 'gemini',
  name: 'Gemini',

  async complete(prompt, systemPrompt, maxTokens = 1024, computeTier = 'standard', history: ConversationMessage[] = [], images: AttachedImage[] = []): Promise<ModelResponse> {
    const start = Date.now();
    const modelId = MODELS[computeTier];
    try {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt ?? 'You are a helpful, knowledgeable assistant.',
        generationConfig: { maxOutputTokens: maxTokens },
      });

      const chat = model.startChat({
        history: history.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      });

      // Build parts — images first, then text
      const parts = [
        ...images.map((img) => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.dataUrl.split(',')[1], // strip data:mime;base64, prefix
          },
        })),
        { text: prompt },
      ];

      const response = await Promise.race([
        chat.sendMessage(parts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini request timed out')), TIMEOUT_MS),
        ),
      ]);

      return {
        provider: 'gemini',
        content: response.response.text(),
        latencyMs: Date.now() - start,
        isGrounded: false,
      };
    } catch (err) {
      return {
        provider: 'gemini',
        content: '',
        latencyMs: Date.now() - start,
        isGrounded: false,
        error: err instanceof Error ? err.message : 'Gemini request failed',
      };
    }
  },
};
