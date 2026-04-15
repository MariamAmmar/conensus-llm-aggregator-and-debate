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
    primaryModel: 'anthropic',
    fallbackModel: 'gemini',
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
  research: [
    // Factual lookups
    'what is', 'what are', 'who is', 'who are', 'where is', 'where are',
    'when did', 'when was', 'when is', 'why is', 'why are', 'why did',
    'tell me about', 'tell me more', 'describe', 'definition of', 'meaning of',
    // Recency / web
    'latest', 'current', 'news', 'today', 'recent', 'right now', 'this week',
    'find', 'search', 'look up', 'lookup',
    // Data / citations
    'statistics', 'stats', 'data', 'source', 'citation', 'according to',
    'history of', 'background on', 'origin of', 'founded', 'invented', 'discovered',
    // Recommendations
    'best ', 'top ', 'recommend', 'should i use', 'which is better', 'compare',
    'difference between', 'vs ', 'versus',
  ],
  logic: [
    // Problem solving
    'solve', 'calculate', 'compute', 'figure out', 'work out',
    // Reasoning
    'reason', 'analyze', 'analyse', 'explain how', 'explain why', 'how does', 'how do',
    'how to', 'how can i', 'how would', 'why does', 'why do', 'why would',
    'step by step', 'walk me through', 'break down', 'break this down',
    // Code
    'debug', 'fix this', 'fix the', 'error in', 'bug in', 'code', 'function',
    'algorithm', 'implement', 'refactor', 'optimize', 'what does this code',
    'write a function', 'write code', 'write a script', 'write a program',
    // Math / logic
    'proof', 'derive', 'math', 'equation', 'formula', 'logic',
    // Understanding
    'help me understand', 'i don\'t understand', 'confused about', 'clarify',
    'what does it mean', 'what does this mean',
    // Analysis
    'pros and cons', 'advantages', 'disadvantages', 'tradeoffs', 'trade-off',
  ],
  writing: [
    // Creation
    'write', 'draft', 'compose', 'create a', 'generate a',
    // Editing
    'edit', 'proofread', 'improve', 'rewrite', 'rephrase', 'paraphrase',
    'make this', 'make it', 'fix my', 'correct my',
    // Formats
    'blog', 'blog post', 'email', 'essay', 'letter', 'cover letter',
    'resume', 'bio', 'caption', 'tweet', 'post', 'message',
    'report', 'proposal', 'pitch', 'outline', 'script', 'speech',
    // Style
    'summarize', 'summary of', 'tldr', 'shorten', 'expand',
    'formal', 'informal', 'professional', 'casual', 'friendly',
    'creative', 'story', 'poem', 'copy', 'marketing',
  ],
  image: [
    'generate an image', 'create an image', 'make an image', 'make a picture',
    'draw', 'drawing of', 'illustrate', 'illustration of',
    'visualize', 'visualization of', 'picture of', 'photo of', 'image of',
    'render', 'rendering of', 'artwork', 'painting of',
    'logo', 'icon', 'banner', 'poster',
  ],
  hybrid: [
    'show me', 'explain and illustrate', 'with a diagram', 'visual explanation',
    'diagram of', 'chart of', 'graph of', 'analyze and generate',
  ],
  general: [],
};
