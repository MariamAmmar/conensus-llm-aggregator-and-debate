import type { DebateResult, ModelResponse, ResponseScore, ProviderId, ConversationMessage } from '@/types';
import { TEXT_PROVIDERS } from '@/providers';
import { DEBATE_CONFIG } from '@/config/debate';
import { DEBATE_SCORE_WEIGHTS } from '@/config/routing';
import { determineWinner } from './judge';

const PARTICIPANTS = DEBATE_CONFIG.participants;

const SCORE_DIMENSIONS = [
  'factualGrounding',
  'logicalCoherence',
  'completeness',
  'clarity',
  'confidenceCalibration',
  'usefulness',
] as const;

export async function runDebate(prompt: string, history: ConversationMessage[] = [], memoryContext = ''): Promise<DebateResult> {
  // Round 1: all models answer in parallel (each sees the shared debate history)
  const allResponses = await collectResponses(prompt, history, memoryContext);

  // Filter out error responses before scoring — failed models shouldn't influence results
  const responses = allResponses.filter((r) => !r.error && r.content.trim().length > 0);

  if (responses.length === 0) {
    throw new Error('All providers failed to respond');
  }

  // Round 2: cross-judge scoring — each model scores the others (light tier, cheap)
  const scores = await crossJudgeScore(prompt, responses);

  // Round 3: determine winner by averaged peer scores
  const winner = determineWinner(scores);

  // Round 4: winner synthesizes a final answer (with conversation history for context)
  const { synthesizedAnswer, synthesisReasoning } = await synthesize(prompt, responses, scores, winner, history, memoryContext);

  return {
    responses: allResponses, // include errors so UI can show them
    critiques: [],
    scores,
    winner,
    synthesizedAnswer,
    synthesisReasoning,
  };
}

async function collectResponses(prompt: string, history: ConversationMessage[], memoryContext = ''): Promise<ModelResponse[]> {
  const results = await Promise.all(
    PARTICIPANTS.map(async (pid) => {
      const provider = TEXT_PROVIDERS[pid];
      if (!provider) return null;
      return provider.complete(prompt, memoryContext || undefined, DEBATE_CONFIG.maxResponseTokens, 'standard', history);
    }),
  );
  return results.filter(Boolean) as ModelResponse[];
}

async function crossJudgeScore(prompt: string, responses: ModelResponse[]): Promise<ResponseScore[]> {
  // Each provider scores every response except its own (light/cheap tier)
  // Shape: scoresByProvider[judge][target] = score object
  const allJudgements: ScoringEntry[][] = [];

  // Only use models that successfully responded as judges
  const validJudges = responses.filter((r) => !r.error && r.content.trim().length > 0).map((r) => r.provider);

  await Promise.all(
    validJudges.map(async (judgeId) => {
      const provider = TEXT_PROVIDERS[judgeId];
      if (!provider) return;

      // Only score responses from OTHER models that also succeeded
      const targets = responses.filter((r) => r.provider !== judgeId && !r.error && r.content.trim().length > 0);
      if (targets.length === 0) return;

      const scoringPrompt = buildScoringPrompt(prompt, targets);

      const result = await provider.complete(
        scoringPrompt,
        'You are an impartial evaluator. Respond only with valid JSON, no other text.',
        512,
        'light',
      );

      const parsed = parseScoringResponse(result.content, targets);
      if (parsed) allJudgements.push(parsed);
    }),
  );

  // Aggregate: average scores each response received from all judges
  return aggregateScores(responses, allJudgements);
}

function buildScoringPrompt(prompt: string, targets: ModelResponse[]): string {
  const responseList = targets
    .map(
      (r, i) =>
        `Response ${i + 1} (provider: ${r.provider}):\n${r.content}`,
    )
    .join('\n\n---\n\n');

  return `You are evaluating AI responses to the following question:
"${prompt}"

Score each response on these dimensions from 0 to 10:
- factualGrounding: accuracy and factual correctness
- logicalCoherence: logical flow and reasoning quality
- completeness: how thoroughly it addresses the question
- clarity: how clear and readable it is
- confidenceCalibration: appropriate confidence given the topic
- usefulness: practical value to the user

Responses to score:

${responseList}

Return ONLY valid JSON in exactly this format (no markdown, no explanation):
{
  "scores": [
    {
      "provider": "<provider id>",
      "factualGrounding": <0-10>,
      "logicalCoherence": <0-10>,
      "completeness": <0-10>,
      "clarity": <0-10>,
      "confidenceCalibration": <0-10>,
      "usefulness": <0-10>
    }
  ]
}`;
}

type ScoringEntry = { provider: ProviderId; factualGrounding: number; logicalCoherence: number; completeness: number; clarity: number; confidenceCalibration: number; usefulness: number };

function parseScoringResponse(
  content: string,
  targets: ModelResponse[],
): ScoringEntry[] | null {
  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const scores = parsed?.scores;
    if (!Array.isArray(scores)) return null;

    return scores
      .filter((s: Record<string, unknown>) => targets.some((t) => t.provider === s.provider))
      .map((s: Record<string, unknown>) => ({
        provider: s.provider as ProviderId,
        factualGrounding: clamp(Number(s.factualGrounding) || 5, 0, 10),
        logicalCoherence: clamp(Number(s.logicalCoherence) || 5, 0, 10),
        completeness: clamp(Number(s.completeness) || 5, 0, 10),
        clarity: clamp(Number(s.clarity) || 5, 0, 10),
        confidenceCalibration: clamp(Number(s.confidenceCalibration) || 5, 0, 10),
        usefulness: clamp(Number(s.usefulness) || 5, 0, 10),
      }));
  } catch {
    return null;
  }
}

function aggregateScores(
  responses: ModelResponse[],
  allJudgements: ScoringEntry[][],
): ResponseScore[] {
  return responses.map((response) => {
    const pid = response.provider;

    // Collect all scores given to this provider by other judges
    const received = allJudgements
      .flat()
      .filter((s) => s.provider === pid);

    if (received.length === 0) {
      // Fallback if no scores received — neutral 7
      const neutral = 7;
      return {
        provider: pid,
        factualGrounding: neutral,
        logicalCoherence: neutral,
        completeness: neutral,
        clarity: neutral,
        confidenceCalibration: neutral,
        usefulness: neutral,
        totalScore: neutral,
      };
    }

    const avg = (key: keyof ScoringEntry) =>
      round(received.reduce((sum, s) => sum + (typeof s[key] === 'number' ? (s[key] as number) : 5), 0) / received.length);

    const factualGrounding = avg('factualGrounding');
    const logicalCoherence = avg('logicalCoherence');
    const completeness = avg('completeness');
    const clarity = avg('clarity');
    const confidenceCalibration = avg('confidenceCalibration');
    const usefulness = avg('usefulness');

    const totalScore = round(
      factualGrounding * DEBATE_SCORE_WEIGHTS.factualGrounding +
      logicalCoherence * DEBATE_SCORE_WEIGHTS.logicalCoherence +
      completeness * DEBATE_SCORE_WEIGHTS.completeness +
      clarity * DEBATE_SCORE_WEIGHTS.clarity +
      confidenceCalibration * DEBATE_SCORE_WEIGHTS.confidenceCalibration +
      usefulness * DEBATE_SCORE_WEIGHTS.usefulness,
    );

    return {
      provider: pid,
      factualGrounding,
      logicalCoherence,
      completeness,
      clarity,
      confidenceCalibration,
      usefulness,
      totalScore,
    };
  });
}

async function synthesize(
  prompt: string,
  responses: ModelResponse[],
  scores: ResponseScore[],
  winner: ProviderId,
  history: ConversationMessage[],
  memoryContext = '',
): Promise<{ synthesizedAnswer: string; synthesisReasoning: string }> {
  const provider = TEXT_PROVIDERS[winner];
  if (!provider) {
    return {
      synthesizedAnswer: responses.find((r) => r.provider === winner)?.content ?? '',
      synthesisReasoning: `${winner} won but synthesis provider unavailable.`,
    };
  }

  const responseList = responses
    .filter((r) => !r.error && r.content.trim().length > 0)
    .map((r) => {
      const score = scores.find((s) => s.provider === r.provider);
      return `[${r.provider} — score: ${score?.totalScore.toFixed(2) ?? 'n/a'}]\n${r.content}`;
    })
    .join('\n\n---\n\n');

  const historyContext = history.length > 0
    ? `\nPrior conversation context:\n${history.map((m) => `${m.role}: ${m.content}`).join('\n')}\n`
    : '';

  const synthesisPrompt = `You won a peer evaluation among AI models. Your task is to write the single best possible answer to the question below by actively combining insights from all responses — not just restating your own.
${historyContext}
Question: "${prompt}"

All responses with peer scores:
${responseList}

Instructions:
1. Keep the strongest and most accurate parts of your own response
2. Identify any correct facts, insights, or angles from the other models that you missed or understated — incorporate them
3. If any response contains errors or weaker reasoning, do not include those parts
4. The final answer must be demonstrably better than any single response above — more complete, more accurate, and better structured
5. Do not mention the other models, scores, or that this is a synthesis — write as if it is one authoritative answer
6. Be thorough but not padded — every sentence should add value`;

  const systemPrompt = [
    memoryContext,
    'You are synthesizing the best answer from multiple AI responses. Be direct and comprehensive.',
  ].filter(Boolean).join('\n\n');

  const result = await provider.complete(
    synthesisPrompt,
    systemPrompt,
    DEBATE_CONFIG.maxSynthesisTokens,
    'standard',
    history,
  );

  const winnerScore = scores.find((s) => s.provider === winner);
  const reasoning = `${winner} won with a peer-averaged score of ${winnerScore?.totalScore.toFixed(2) ?? 'n/a'} across ${SCORE_DIMENSIONS.length} dimensions. Scores were assigned by the other participating models, excluding self-evaluation.`;

  return {
    synthesizedAnswer: result.content,
    synthesisReasoning: reasoning,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round(val: number): number {
  return Math.round(val * 10) / 10;
}
