import OpenAI from 'openai';
import type { ImageProvider } from './base';
import type { ImageResult } from '@/types';

const TIMEOUT_MS = 60_000;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey });
}

export const openaiImageProvider: ImageProvider = {
  id: 'openai-image',
  name: 'DALL-E 3',

  async generate(prompt, width = 1024, height = 1024): Promise<ImageResult> {
    const client = getClient();

    // DALL-E 3 only supports specific sizes
    const size =
      width === 1792 && height === 1024
        ? ('1792x1024' as const)
        : width === 1024 && height === 1792
        ? ('1024x1792' as const)
        : ('1024x1024' as const);

    const response = await Promise.race([
      client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'standard',
        response_format: 'url',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DALL-E request timed out')), TIMEOUT_MS),
      ),
    ]);

    const image = response.data?.[0];
    if (!image?.url) throw new Error('DALL-E returned no image');
    const [w, h] = size.split('x').map(Number);

    return {
      url: image.url,
      revisedPrompt: image.revised_prompt ?? prompt,
      provider: 'openai-image',
      width: w,
      height: h,
    };
  },
};
