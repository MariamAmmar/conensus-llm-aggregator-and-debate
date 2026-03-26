import type { ModelResponse, ImageResult, ProviderId } from '@/types';

// Base interface all text providers must implement
export interface TextProvider {
  id: ProviderId;
  name: string;

  /**
   * Send a prompt and receive a single text response.
   * @param prompt - The user's prompt
   * @param systemPrompt - Optional system context
   * @param maxTokens - Max tokens to generate
   * @returns A ModelResponse with content, latency, and grounding info
   */
  complete(
    prompt: string,
    systemPrompt?: string,
    maxTokens?: number,
  ): Promise<ModelResponse>;
}

// Base interface all image providers must implement
export interface ImageProvider {
  id: ProviderId;
  name: string;

  /**
   * Generate an image from a text prompt.
   * @param prompt - The image description
   * @param width - Requested width in pixels
   * @param height - Requested height in pixels
   * @returns An ImageResult with URL, provider info, and revised prompt
   */
  generate(
    prompt: string,
    width?: number,
    height?: number,
  ): Promise<ImageResult>;
}

// Provider factory type
export type ProviderFactory<T> = () => T;
