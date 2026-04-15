import type { ProviderId } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';

/**
 * Format a duration in milliseconds to a human-readable string.
 * e.g. 1234 → "1.2s", 234 → "234ms"
 */
export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

/**
 * Truncate text to a given character limit with an ellipsis.
 */
export function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit).trimEnd() + '…';
}

/**
 * Generate a unique ID string.
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a timestamp for display in the history sidebar.
 * Shows relative time for recent entries, absolute for older ones.
 */
export function formatTimestamp(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = diffMs / 1000 / 60;

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return formatDistanceToNow(d, { addSuffix: true });
  if (diffMinutes < 60 * 24) return format(d, 'h:mm a');
  return format(d, 'MMM d');
}

/**
 * Get a human-readable label for a ProviderId.
 */
export function getProviderLabel(id: ProviderId): string {
  const labels: Record<ProviderId, string> = {
    openai: 'ChatGPT',
    anthropic: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    grok: 'Grok',
    llama: 'Llama 4',
    o4mini: 'o4-mini',
    deepseek: 'DeepSeek R1',
    'openai-image': 'DALL-E',
    'gemini-image': 'Imagen',
  };
  return labels[id] ?? id;
}

/**
 * Check if a string is a valid URL.
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
