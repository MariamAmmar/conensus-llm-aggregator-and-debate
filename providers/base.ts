import type { ModelResponse, ImageResult, ProviderId, ComputeTier, ConversationMessage, AttachedImage } from '@/types';

// Base interface all text providers must implement
export interface TextProvider {
  id: ProviderId;
  name: string;

  complete(
    prompt: string,
    systemPrompt?: string,
    maxTokens?: number,
    computeTier?: ComputeTier,
    history?: ConversationMessage[],
    images?: AttachedImage[],
  ): Promise<ModelResponse>;
}

// Base interface all image providers must implement
export interface ImageProvider {
  id: ProviderId;
  name: string;

  generate(
    prompt: string,
    width?: number,
    height?: number,
  ): Promise<ImageResult>;
}

// Provider factory type
export type ProviderFactory<T> = () => T;
