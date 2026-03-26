import type { ModelResponse, ResponseScore, ProviderId } from '@/types';
import { DEBATE_SCORE_WEIGHTS } from '@/config/routing';

/**
 * Score a set of model responses across multiple evaluation dimensions.
 * In production, this would call an LLM judge to score each response.
 *
 * @param responses - Array of model responses from the debate
 * @returns Array of ResponseScore objects with per-dimension and weighted total scores
 */
export function scoreResponses(responses: ModelResponse[]): ResponseScore[] {
  // Stub: return mock scores. Replace with LLM judge call in production.
  return responses.map((response): ResponseScore => {
    const base = 7 + Math.random() * 2; // 7–9 range
    const factualGrounding = clamp(base + (Math.random() - 0.5), 5, 10);
    const logicalCoherence = clamp(base + (Math.random() - 0.5), 5, 10);
    const completeness = clamp(base + (Math.random() - 0.5), 5, 10);
    const clarity = clamp(base + (Math.random() - 0.5), 5, 10);
    const confidenceCalibration = clamp(base + (Math.random() - 0.5), 5, 10);
    const usefulness = clamp(base + (Math.random() - 0.5), 5, 10);

    const totalScore =
      factualGrounding * DEBATE_SCORE_WEIGHTS.factualGrounding +
      logicalCoherence * DEBATE_SCORE_WEIGHTS.logicalCoherence +
      completeness * DEBATE_SCORE_WEIGHTS.completeness +
      clarity * DEBATE_SCORE_WEIGHTS.clarity +
      confidenceCalibration * DEBATE_SCORE_WEIGHTS.confidenceCalibration +
      usefulness * DEBATE_SCORE_WEIGHTS.usefulness;

    return {
      provider: response.provider,
      factualGrounding: round(factualGrounding),
      logicalCoherence: round(logicalCoherence),
      completeness: round(completeness),
      clarity: round(clarity),
      confidenceCalibration: round(confidenceCalibration),
      usefulness: round(usefulness),
      totalScore: round(totalScore),
    };
  });
}

/**
 * Determine the winner from a set of scores.
 * @param scores - Array of ResponseScore objects
 * @returns ProviderId of the highest-scoring model
 */
export function determineWinner(scores: ResponseScore[]): ProviderId {
  if (scores.length === 0) throw new Error('No scores to evaluate');
  return scores.reduce((best, current) =>
    current.totalScore > best.totalScore ? current : best
  ).provider;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round(val: number): number {
  return Math.round(val * 10) / 10;
}
