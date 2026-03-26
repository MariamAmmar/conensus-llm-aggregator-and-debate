// Model modes available in the UI
export type ModelMode = 'auto' | 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'debate' | 'image';

// Prompt classification categories used by the router
export type PromptCategory = 'research' | 'logic' | 'writing' | 'image' | 'hybrid' | 'general';

// Provider IDs
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'perplexity' | 'openai-image' | 'gemini-image';

// Router decision output
export interface RouterDecision {
  category: PromptCategory;
  selectedModel: ProviderId;
  confidence: number; // 0–1
  reason: string;
  fallbackModel: ProviderId | null;
  requiresWebGrounding: boolean;
  requiresImageGeneration: boolean;
  escalateToDebate: boolean;
}

// A single model's text response
export interface ModelResponse {
  provider: ProviderId;
  content: string;
  latencyMs: number;
  isGrounded: boolean;
  error?: string;
}

// Critique of one model by another
export interface ModelCritique {
  critic: ProviderId;
  target: ProviderId;
  content: string;
}

// Scoring dimensions for debate judge
export interface ResponseScore {
  provider: ProviderId;
  factualGrounding: number;    // 0–10
  logicalCoherence: number;    // 0–10
  completeness: number;        // 0–10
  clarity: number;             // 0–10
  confidenceCalibration: number; // 0–10
  usefulness: number;          // 0–10
  totalScore: number;          // weighted
}

// Debate result
export interface DebateResult {
  responses: ModelResponse[];
  critiques: ModelCritique[];
  scores: ResponseScore[];
  winner: ProviderId;
  synthesizedAnswer: string;
  synthesisReasoning: string;
}

// Image generation result
export interface ImageResult {
  url: string;
  revisedPrompt: string;
  provider: 'openai-image' | 'gemini-image';
  width: number;
  height: number;
}

// Full app result for a single submission
export interface AppResult {
  id: string;
  prompt: string;
  mode: ModelMode;
  routerDecision: RouterDecision | null;
  responses: ModelResponse[];
  debateResult: DebateResult | null;
  finalAnswer: string;
  imageResult: ImageResult | null;
  timestamp: Date;
  durationMs: number;
}

// History entry (stored)
export interface HistoryEntry {
  id: string;
  prompt: string;
  mode: ModelMode;
  finalAnswer: string;
  imageUrl?: string;
  timestamp: Date;
  routerCategory?: PromptCategory;
  selectedProvider?: ProviderId;
}

// App state
export interface AppState {
  selectedMode: ModelMode;
  prompt: string;
  isLoading: boolean;
  currentResult: AppResult | null;
  history: HistoryEntry[];
  sidebarOpen: boolean;
  settingsOpen: boolean;
  mockMode: boolean;
}

// Model config for display
export interface ModelConfig {
  id: ModelMode;
  label: string;
  description: string;
  color: string;
  activeColor: string;
  icon: string;
  supportedCategories: PromptCategory[];
}
