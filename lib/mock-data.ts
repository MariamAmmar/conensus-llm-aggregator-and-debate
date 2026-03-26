import type { AppResult, ModelMode, RouterDecision, ModelResponse, DebateResult, ImageResult } from '@/types';
import { generateId } from '@/utils';

const MOCK_DELAY = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_TEXT_RESPONSES: Record<string, string> = {
  openai: `Based on your question, here is a comprehensive response from GPT-4o.

The topic you've raised touches on several important dimensions. First, it's worth understanding the foundational concepts at play here. GPT-4o excels at synthesizing information across domains and providing well-structured, coherent explanations.

**Key Points:**
- The primary consideration is establishing a clear framework for analysis
- Multiple perspectives should be weighed carefully before drawing conclusions
- Practical applications follow naturally from theoretical understanding

This response demonstrates strong writing quality, clear organization, and useful actionable insights. The model has been optimized for clarity and usefulness across a wide range of tasks.`,

  anthropic: `Let me think through this carefully and systematically.

Your question requires breaking down several interconnected components. I'll approach this step by step to ensure logical coherence throughout my analysis.

**Analysis:**

1. **First Principle**: At the core of this question lies a fundamental tension between competing considerations.

2. **Reasoning Chain**: Starting from what we can establish with confidence, we can build toward more nuanced conclusions:
   - Premise A leads naturally to intermediate conclusion B
   - This connects with established pattern C
   - Together these point toward a well-grounded answer

3. **Nuance and Caveats**: No analysis is complete without acknowledging edge cases and limitations.

**Conclusion**: After careful reasoning, the most defensible position accounts for all these factors while remaining practical and actionable.`,

  gemini: `Drawing on my broad knowledge base, here's what I can share about your question.

Google Gemini is particularly strong at integrating information across modalities and knowledge domains. This question sits at an interesting intersection of multiple fields.

**Overview:**
Your question relates to a rich body of knowledge spanning several disciplines. Here is what the evidence suggests:

The current understanding in this area has evolved significantly. Recent developments have shifted how experts think about the core issues involved. Key findings from credible sources indicate that the most important factors are interconnected in non-obvious ways.

From a practical standpoint, the most useful approach is to consider both the immediate implications and the longer-term context. Gemini's strength lies in connecting these dots across different knowledge domains to provide a holistic perspective.`,

  perplexity: `**Web-grounded answer with citations**

Based on current information from across the web, here is what sources say about your question:

According to recent sources, this topic has been covered extensively. The consensus view from multiple reliable sources indicates the following key facts:

1. **Current Status**: As of the latest available information, the situation involves several active developments.

2. **Expert Opinion**: Leading experts in the field have noted that this area continues to evolve rapidly.

3. **Sources**: This response draws from multiple web sources to ensure accuracy and comprehensiveness.

*Note: This response uses real-time web grounding to provide up-to-date information rather than relying solely on training data.*`,
};

export async function getMockResult(prompt: string, mode: ModelMode): Promise<AppResult> {
  await sleep(MOCK_DELAY);

  const startTime = Date.now();
  const id = generateId();

  if (mode === 'image') {
    const imageResult: ImageResult = {
      url: `https://picsum.photos/seed/${id}/1024/1024`,
      revisedPrompt: `${prompt} — high quality, detailed, professional photography style`,
      provider: 'openai-image',
      width: 1024,
      height: 1024,
    };

    return {
      id,
      prompt,
      mode,
      routerDecision: null,
      responses: [],
      debateResult: null,
      finalAnswer: '',
      imageResult,
      timestamp: new Date(),
      durationMs: Date.now() - startTime + MOCK_DELAY,
    };
  }

  if (mode === 'debate') {
    const debateResult = getMockDebateResult();
    return {
      id,
      prompt,
      mode,
      routerDecision: null,
      responses: debateResult.responses,
      debateResult,
      finalAnswer: debateResult.synthesizedAnswer,
      imageResult: null,
      timestamp: new Date(),
      durationMs: Date.now() - startTime + MOCK_DELAY,
    };
  }

  if (mode === 'auto') {
    const routerDecision: RouterDecision = {
      category: 'logic',
      selectedModel: 'anthropic',
      confidence: 0.87,
      reason: 'The prompt contains analytical reasoning keywords and requires step-by-step logical analysis. Claude is optimally suited for this type of structured reasoning task.',
      fallbackModel: 'openai',
      requiresWebGrounding: false,
      requiresImageGeneration: false,
      escalateToDebate: false,
    };

    const response: ModelResponse = {
      provider: 'anthropic',
      content: MOCK_TEXT_RESPONSES.anthropic,
      latencyMs: 1243,
      isGrounded: false,
    };

    return {
      id,
      prompt,
      mode,
      routerDecision,
      responses: [response],
      debateResult: null,
      finalAnswer: response.content,
      imageResult: null,
      timestamp: new Date(),
      durationMs: Date.now() - startTime + MOCK_DELAY,
    };
  }

  // Single model mode
  const providerMap: Record<string, keyof typeof MOCK_TEXT_RESPONSES> = {
    chatgpt: 'openai',
    claude: 'anthropic',
    gemini: 'gemini',
    perplexity: 'perplexity',
  };

  const providerKey = providerMap[mode] || 'openai';
  const providerId = providerKey === 'openai' ? 'openai' : providerKey === 'anthropic' ? 'anthropic' : providerKey as 'gemini' | 'perplexity';

  const response: ModelResponse = {
    provider: providerId,
    content: MOCK_TEXT_RESPONSES[providerKey],
    latencyMs: Math.floor(800 + Math.random() * 800),
    isGrounded: mode === 'perplexity',
  };

  return {
    id,
    prompt,
    mode,
    routerDecision: null,
    responses: [response],
    debateResult: null,
    finalAnswer: response.content,
    imageResult: null,
    timestamp: new Date(),
    durationMs: Date.now() - startTime + MOCK_DELAY,
  };
}

function getMockDebateResult(): DebateResult {
  const responses: ModelResponse[] = [
    {
      provider: 'openai',
      content: MOCK_TEXT_RESPONSES.openai,
      latencyMs: 1102,
      isGrounded: false,
    },
    {
      provider: 'anthropic',
      content: MOCK_TEXT_RESPONSES.anthropic,
      latencyMs: 1387,
      isGrounded: false,
    },
    {
      provider: 'gemini',
      content: MOCK_TEXT_RESPONSES.gemini,
      latencyMs: 943,
      isGrounded: false,
    },
    {
      provider: 'perplexity',
      content: MOCK_TEXT_RESPONSES.perplexity,
      latencyMs: 1654,
      isGrounded: true,
    },
  ];

  return {
    responses,
    critiques: [
      {
        critic: 'anthropic',
        target: 'openai',
        content: 'The response provides good structure but lacks depth in the logical reasoning chain. Key causal relationships are asserted rather than demonstrated. The conclusion could be strengthened by more explicit inference steps.',
      },
      {
        critic: 'openai',
        target: 'anthropic',
        content: "Claude's analysis is thorough but could benefit from more concrete examples. The abstract reasoning is sound, but practical illustrations would significantly improve accessibility and usefulness for the user.",
      },
      {
        critic: 'gemini',
        target: 'perplexity',
        content: 'While web grounding is valuable here, the response relies heavily on authority claims without synthesizing the underlying reasoning. A more integrated analysis would produce stronger conclusions.',
      },
      {
        critic: 'perplexity',
        target: 'gemini',
        content: "Gemini's broad knowledge synthesis is impressive, but some claims lack grounding in verifiable sources. The multi-domain connections drawn are insightful but would benefit from citation.",
      },
    ],
    scores: [
      {
        provider: 'openai',
        factualGrounding: 7.5,
        logicalCoherence: 8.0,
        completeness: 7.8,
        clarity: 9.0,
        confidenceCalibration: 7.5,
        usefulness: 8.5,
        totalScore: 7.98,
      },
      {
        provider: 'anthropic',
        factualGrounding: 8.5,
        logicalCoherence: 9.2,
        completeness: 8.8,
        clarity: 8.5,
        confidenceCalibration: 9.0,
        usefulness: 8.8,
        totalScore: 8.78,
      },
      {
        provider: 'gemini',
        factualGrounding: 7.8,
        logicalCoherence: 7.5,
        completeness: 8.2,
        clarity: 8.0,
        confidenceCalibration: 7.2,
        usefulness: 8.0,
        totalScore: 7.82,
      },
      {
        provider: 'perplexity',
        factualGrounding: 9.0,
        logicalCoherence: 7.0,
        completeness: 7.5,
        clarity: 7.8,
        confidenceCalibration: 8.5,
        usefulness: 8.2,
        totalScore: 7.97,
      },
    ],
    winner: 'anthropic',
    synthesizedAnswer: `**Synthesized Answer — Best of All Models**

After considering all four model responses and their mutual critiques, here is the most comprehensive and well-reasoned answer:

Your question touches on a topic that requires both empirical grounding (as Perplexity highlighted with web sources) and careful logical analysis (as Claude demonstrated through step-by-step reasoning).

**The Core Answer:**

The most defensible position integrates multiple perspectives:

1. **Factual Foundation** (from Perplexity's web-grounded response): Current evidence from authoritative sources confirms the basic facts of the matter.

2. **Logical Structure** (from Claude's analysis): The causal chain runs from foundational premises through well-supported intermediate conclusions to a final answer.

3. **Practical Framing** (from GPT-4o): The real-world implications are significant and actionable.

4. **Broader Context** (from Gemini): Cross-domain connections reveal that this topic connects to broader patterns in the field.

**Conclusion**: The synthesis of all four perspectives produces a richer, more nuanced answer than any single model could provide. The key insight is that both the empirical and analytical dimensions must be held together.`,
    synthesisReasoning: "Claude won this debate with the highest total score of 8.78, driven by exceptional logical coherence (9.2) and confidence calibration (9.0). The synthesis incorporates Claude's structured reasoning, Perplexity's factual grounding, GPT-4o's clarity, and Gemini's broad context.",
  };
}
