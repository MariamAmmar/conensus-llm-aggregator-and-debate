import type { PromptCategory } from '@/types';
import { CLASSIFICATION_KEYWORDS } from '@/config/routing';

export interface ClassificationResult {
  category: PromptCategory;
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Classify a prompt into a PromptCategory using keyword matching.
 * In production, this would use an LLM or embedding classifier.
 */
export function classifyPrompt(prompt: string): ClassificationResult {
  const lower = prompt.toLowerCase();
  const scores: Record<PromptCategory, { score: number; keywords: string[] }> = {
    research: { score: 0, keywords: [] },
    logic: { score: 0, keywords: [] },
    writing: { score: 0, keywords: [] },
    image: { score: 0, keywords: [] },
    hybrid: { score: 0, keywords: [] },
    general: { score: 0, keywords: [] },
  };

  // Score each category by keyword matches
  for (const [category, keywords] of Object.entries(CLASSIFICATION_KEYWORDS) as [PromptCategory, string[]][]) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        scores[category].score += keyword.split(' ').length; // longer phrases score more
        scores[category].keywords.push(keyword);
      }
    }
  }

  // Find the highest-scoring category
  let bestCategory: PromptCategory = 'general';
  let bestScore = 0;

  for (const [category, { score }] of Object.entries(scores) as [PromptCategory, { score: number; keywords: string[] }][]) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Normalize confidence to 0–1 range (max reasonable score is ~15)
  const confidence = bestCategory === 'general' ? 0.5 : Math.min(bestScore / 15, 0.95);

  return {
    category: bestCategory,
    confidence,
    matchedKeywords: scores[bestCategory].keywords,
  };
}
