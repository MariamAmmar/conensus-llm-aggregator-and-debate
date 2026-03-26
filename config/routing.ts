import type { PromptCategory, ProviderId } from '@/types';

// Central routing rules — edit this file to change routing behavior
export interface RoutingRule {
  category: PromptCategory;
  primaryModel: ProviderId;
  fallbackModel: ProviderId;
  requiresWebGrounding: boolean;
  requiresImageGeneration: boolean;
  confidenceThreshold: number; // below this, escalate to debate
  description: string;
}

export const ROUTING_RULES: Record<PromptCategory, RoutingRule> = {
  research: {
    category: 'research',
    primaryModel: 'perplexity',
    fallbackModel: 'openai',
    requiresWebGrounding: true,
    requiresImageGeneration: false,
    confidenceThreshold: 0.6,
    description: 'Real-time factual queries, current events, citations needed',
  },
  logic: {
    category: 'logic',
    primaryModel: 'anthropic',
    fallbackModel: 'openai',
    requiresWebGrounding: false,
    requiresImageGeneration: false,
    confidenceThreshold: 0.65,
    description: 'Reasoning, math, code, analysis, step-by-step thinking',
  },
  writing: {
    category: 'writing',
    primaryModel: 'openai',
    fallbackModel: 'anthropic',
    requiresWebGrounding: false,
    requiresImageGeneration: false,
    confidenceThreshold: 0.6,
    description: 'Creative writing, editing, summarization, tone-sensitive content',
  },
  image: {
    category: 'image',
    primaryModel: 'openai-image',
    fallbackModel: 'gemini-image',
    requiresWebGrounding: false,
    requiresImageGeneration: true,
    confidenceThreshold: 0.8,
    description: 'Image generation or visual rendering requests',
  },
  hybrid: {
    category: 'hybrid',
    primaryModel: 'anthropic',
    fallbackModel: 'openai',
    requiresWebGrounding: false,
    requiresImageGeneration: true,
    confidenceThreshold: 0.55,
    description: 'Requests requiring both text analysis and image generation',
  },
  general: {
    category: 'general',
    primaryModel: 'openai',
    fallbackModel: 'anthropic',
    requiresWebGrounding: false,
    requiresImageGeneration: false,
    confidenceThreshold: 0.5,
    description: 'General-purpose questions not fitting a specific category',
  },
};

// Debate scoring weights (must sum to 1.0)
export const DEBATE_SCORE_WEIGHTS = {
  factualGrounding: 0.25,
  logicalCoherence: 0.20,
  completeness: 0.20,
  clarity: 0.15,
  confidenceCalibration: 0.10,
  usefulness: 0.10,
};

// Classification keywords used by the router
export const CLASSIFICATION_KEYWORDS: Record<PromptCategory, string[]> = {
  research: ['what is', 'who is', 'when did', 'latest', 'current', 'news', 'today', 'recent', 'find', 'search', 'look up', 'statistics', 'data', 'source', 'citation'],
  logic: ['solve', 'calculate', 'reason', 'analyze', 'explain why', 'debug', 'code', 'algorithm', 'proof', 'derive', 'math', 'logic', 'step by step', 'how does'],
  writing: ['write', 'draft', 'edit', 'improve', 'summarize', 'rewrite', 'blog', 'email', 'essay', 'story', 'copy', 'marketing', 'creative'],
  image: ['generate an image', 'create an image', 'draw', 'illustrate', 'visualize', 'picture of', 'photo of', 'render', 'design'],
  hybrid: ['show me', 'explain and illustrate', 'with a diagram', 'visual explanation', 'analyze and generate'],
  general: [],
};
