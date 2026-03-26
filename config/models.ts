import type { ModelConfig, ModelMode } from '@/types';

export const MODEL_CONFIGS: Record<ModelMode, ModelConfig> = {
  auto: {
    id: 'auto',
    label: 'Auto',
    description: 'Automatically routes to the best model for your prompt',
    color: 'text-purple-400',
    activeColor: 'bg-purple-500/20 border-purple-500 text-purple-300',
    icon: 'Sparkles',
    supportedCategories: ['research', 'logic', 'writing', 'image', 'hybrid', 'general'],
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    description: 'OpenAI GPT-4o — best for writing, summarization, and general tasks',
    color: 'text-emerald-400',
    activeColor: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
    icon: 'MessageSquare',
    supportedCategories: ['writing', 'general', 'logic'],
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    description: 'Anthropic Claude — best for reasoning, analysis, and nuanced tasks',
    color: 'text-orange-400',
    activeColor: 'bg-orange-500/20 border-orange-500 text-orange-300',
    icon: 'Brain',
    supportedCategories: ['logic', 'writing', 'general'],
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    description: 'Google Gemini — best for multimodal and knowledge-heavy tasks',
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/20 border-blue-500 text-blue-300',
    icon: 'Zap',
    supportedCategories: ['general', 'writing', 'image'],
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    description: 'Perplexity — best for real-time research with web grounding',
    color: 'text-cyan-400',
    activeColor: 'bg-cyan-500/20 border-cyan-500 text-cyan-300',
    icon: 'Globe',
    supportedCategories: ['research'],
  },
  debate: {
    id: 'debate',
    label: 'Debate',
    description: 'All models answer, critique each other, and synthesize the best answer',
    color: 'text-pink-400',
    activeColor: 'bg-pink-500/20 border-pink-500 text-pink-300',
    icon: 'Users',
    supportedCategories: ['research', 'logic', 'writing', 'general'],
  },
  image: {
    id: 'image',
    label: 'Image',
    description: 'Generate images using DALL-E or Gemini Imagen',
    color: 'text-amber-400',
    activeColor: 'bg-amber-500/20 border-amber-500 text-amber-300',
    icon: 'ImageIcon',
    supportedCategories: ['image'],
  },
};

export const MODEL_ORDER: ModelMode[] = ['auto', 'chatgpt', 'claude', 'gemini', 'perplexity', 'debate', 'image'];
