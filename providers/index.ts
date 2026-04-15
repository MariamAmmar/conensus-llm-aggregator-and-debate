import type { TextProvider, ImageProvider } from './base';
import type { ProviderId, ImageProviderMode } from '@/types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { perplexityProvider } from './perplexity';
import { grokProvider } from './grok';
import { llamaProvider } from './llama';
import { o4miniProvider } from './o4mini';
import { deepseekProvider } from './deepseek';
import { openaiImageProvider } from './openai-image';
import { geminiImageProvider } from './gemini-image';

// Registry of all text providers
export const TEXT_PROVIDERS: Partial<Record<ProviderId, TextProvider>> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  perplexity: perplexityProvider,
  grok: grokProvider,
  llama: llamaProvider,
  o4mini: o4miniProvider,
  deepseek: deepseekProvider,
};

// Registry of all image providers
export const IMAGE_PROVIDERS: Partial<Record<ProviderId, ImageProvider>> = {
  'openai-image': openaiImageProvider,
  'gemini-image': geminiImageProvider,
};

/**
 * Pick the best image provider based on the prompt and user preference.
 *
 * Auto-selection policy:
 *   - Photorealistic / natural scene keywords → Imagen (stronger realism)
 *   - Artistic / illustrated / creative → DALL-E 3 (stronger stylisation)
 *   - Default → DALL-E 3
 */
export function resolveImageProvider(
  prompt: string,
  preference: ImageProviderMode,
): ImageProvider {
  if (preference === 'openai-image') return openaiImageProvider;
  if (preference === 'gemini-image') return geminiImageProvider;

  // Auto — choose based on prompt style
  const lower = prompt.toLowerCase();
  const imagenSignals = [
    'photo', 'photograph', 'photorealistic', 'realistic', 'real', 'portrait',
    'landscape', 'nature', 'product', 'architecture', 'documentary', 'cinematic',
    'high resolution', '4k', '8k',
  ];
  const isPhotorealistic = imagenSignals.some((kw) => lower.includes(kw));
  return isPhotorealistic ? geminiImageProvider : openaiImageProvider;
}
