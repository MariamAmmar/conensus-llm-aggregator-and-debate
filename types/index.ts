// Model modes available in the UI
export type ModelMode = 'auto' | 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'grok' | 'llama' | 'o4mini' | 'deepseek' | 'all' | 'debate' | 'image';

// Prompt classification categories used by the router
export type PromptCategory = 'research' | 'logic' | 'writing' | 'image' | 'hybrid' | 'general';

// Provider IDs
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'perplexity' | 'grok' | 'llama' | 'o4mini' | 'deepseek' | 'openai-image' | 'gemini-image';

// Compute tier — controls which model variant is used within a provider
// light: cheapest capable model  standard: general purpose  heavy: strongest model
export type ComputeTier = 'light' | 'standard' | 'heavy';

// Image provider selection (auto picks based on prompt style)
export type ImageProviderMode = 'auto-image' | 'openai-image' | 'gemini-image';

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

// An image attached to a prompt
export interface AttachedImage {
  id: string;
  name: string;
  dataUrl: string; // base64 data URL (e.g. "data:image/png;base64,...")
  mimeType: string;
}

// A document (PDF or text-based file) attached to a prompt
export interface AttachedDocument {
  id: string;
  name: string;
  mimeType: string;
  contentType: 'text' | 'pdf';
  // For text files: the extracted text content
  // For PDFs: the full base64 data URL (data:application/pdf;base64,...)
  content: string;
}

// A single turn in a conversation
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Per-provider conversation histories for All Models mode
export type ProviderConversations = Partial<Record<ProviderId, ConversationMessage[]>>;

// A single turn in the chat UI (prompt + result pair)
export interface ChatTurn {
  id: string;
  prompt: string;
  images: AttachedImage[];
  documents: AttachedDocument[];
  mode: ModelMode;
  result: AppResult | null;
  error: string | null;
  loading: boolean;
}

// A saved chat session (stored when starting a new chat)
export interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  mode: ModelMode;
  turns: ChatTurn[];
  conversation: ConversationMessage[];
  providerConversations: ProviderConversations;
  debateConversation: ConversationMessage[];
}

// A remembered fact about the user extracted from past conversations
export interface MemoryFact {
  fact: string;
  addedAt: string; // ISO date string
}

// App state
export interface AppState {
  selectedMode: ModelMode;
  selectedImageProvider: ImageProviderMode;
  prompt: string;
  isLoading: boolean;
  chatTurns: ChatTurn[];
  history: HistoryEntry[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  userMemory: MemoryFact[];
  // Single-model / auto conversation (one assistant voice)
  conversation: ConversationMessage[];
  // Per-provider conversations for All Models mode
  providerConversations: ProviderConversations;
  // Debate shared conversation (uses synthesized answer as assistant turn)
  debateConversation: ConversationMessage[];
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
