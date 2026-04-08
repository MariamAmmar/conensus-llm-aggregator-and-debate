import type { ImageProvider } from './base';
import type { ImageResult } from '@/types';

const TIMEOUT_MS = 60_000;
const IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';

function getApiKey() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY is not set');
  return apiKey;
}

export const geminiImageProvider: ImageProvider = {
  id: 'gemini-image',
  name: 'Imagen 4',

  async generate(prompt, width = 1024, height = 1024): Promise<ImageResult> {
    const apiKey = getApiKey();
    const aspectRatio = width > height ? '16:9' : width < height ? '9:16' : '1:1';

    const body = JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio },
    });

    const response = await Promise.race([
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Imagen request timed out')), TIMEOUT_MS),
      ),
    ]);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Imagen API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const imageBytes = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBytes) throw new Error('Imagen returned no image data');

    return {
      url: `data:image/png;base64,${imageBytes}`,
      revisedPrompt: prompt,
      provider: 'gemini-image',
      width,
      height,
    };
  },
};
