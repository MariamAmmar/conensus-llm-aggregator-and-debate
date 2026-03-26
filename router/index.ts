import type { RouterDecision, ModelMode, ProviderId } from '@/types';
import { classifyPrompt } from './classifier';
import { ROUTING_RULES } from '@/config/routing';
import { MODEL_CONFIGS } from '@/config/models';

/**
 * Route a prompt to the best provider based on mode and classification.
 * In production, this may call an LLM for more nuanced classification.
 *
 * @param prompt - The raw user prompt
 * @param mode - The selected ModelMode (may be 'auto' for automatic routing)
 * @returns RouterDecision describing which provider to use and why
 */
export function route(prompt: string, mode: ModelMode): RouterDecision {
  // For non-auto modes, map the mode directly to a provider
  if (mode !== 'auto') {
    const providerMap: Partial<Record<ModelMode, ProviderId>> = {
      chatgpt: 'openai',
      claude: 'anthropic',
      gemini: 'gemini',
      perplexity: 'perplexity',
      image: 'openai-image',
    };

    const selectedModel = providerMap[mode] ?? 'openai';
    const modelConfig = MODEL_CONFIGS[mode];
    const primaryCategory = modelConfig.supportedCategories[0] ?? 'general';
    const rule = ROUTING_RULES[primaryCategory];

    return {
      category: primaryCategory,
      selectedModel,
      confidence: 1.0,
      reason: `User explicitly selected ${modelConfig.label} mode.`,
      fallbackModel: rule.fallbackModel,
      requiresWebGrounding: mode === 'perplexity',
      requiresImageGeneration: mode === 'image',
      escalateToDebate: mode === 'debate',
    };
  }

  // Auto routing: classify prompt and look up routing rule
  const classification = classifyPrompt(prompt);
  const rule = ROUTING_RULES[classification.category];

  const escalateToDebate = classification.confidence < rule.confidenceThreshold;

  return {
    category: classification.category,
    selectedModel: rule.primaryModel,
    confidence: classification.confidence,
    reason: buildReason(classification.category, rule.primaryModel, classification.matchedKeywords, classification.confidence),
    fallbackModel: rule.fallbackModel,
    requiresWebGrounding: rule.requiresWebGrounding,
    requiresImageGeneration: rule.requiresImageGeneration,
    escalateToDebate,
  };
}

function buildReason(
  category: string,
  model: ProviderId,
  keywords: string[],
  confidence: number,
): string {
  const rule = ROUTING_RULES[category as keyof typeof ROUTING_RULES];
  const kwPhrase = keywords.length > 0 ? ` (matched: "${keywords.slice(0, 3).join('", "')}")` : '';
  const confPhrase = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'moderate' : 'low';

  return `Classified as "${category}" with ${confPhrase} confidence${kwPhrase}. ${rule.description}. Routed to ${model}.`;
}
