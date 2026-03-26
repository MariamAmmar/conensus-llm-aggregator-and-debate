// Debate mode configuration
export const DEBATE_CONFIG = {
  // Models participating in debate
  participants: ['openai', 'anthropic', 'gemini', 'perplexity'] as const,

  // Max tokens per response
  maxResponseTokens: 1024,

  // Max tokens per critique
  maxCritiqueTokens: 512,

  // Timeout per model call (ms)
  timeoutMs: 30_000,

  // Number of critique rounds
  critiqueRounds: 1,

  // Whether to show raw critiques or only summary
  showRawCritiques: false,

  // Model used for final synthesis (usually the winner or a separate call)
  synthesisModel: 'anthropic' as const,

  // Max tokens for synthesis
  maxSynthesisTokens: 2048,
};
