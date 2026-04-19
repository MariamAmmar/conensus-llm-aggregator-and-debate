'use client';

import { useState } from 'react';
import { Trophy, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponseCard } from '@/components/output/ResponseCard';
import type { DebateResult, ProviderId } from '@/types';
import { getProviderLabel } from '@/utils';
import { cn } from '@/lib/utils';

interface DebatePanelProps {
  debateResult: DebateResult;
  prompt: string;
}

const SCORE_DIMENSIONS = [
  { key: 'factualGrounding', label: 'Factual' },
  { key: 'logicalCoherence', label: 'Logic' },
  { key: 'completeness', label: 'Complete' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'confidenceCalibration', label: 'Confidence' },
  { key: 'usefulness', label: 'Useful' },
] as const;

const WINNER_COLORS: Record<ProviderId, string> = {
  openai: 'text-emerald-400',
  anthropic: 'text-orange-400',
  gemini: 'text-blue-400',
  perplexity: 'text-cyan-400',
  grok: 'text-rose-400',
  llama: 'text-lime-400',
  o4mini: 'text-sky-400',
  deepseek: 'text-violet-400',
  'openai-image': 'text-amber-400',
  'gemini-image': 'text-blue-400',
};

export function DebatePanel({ debateResult }: DebatePanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const { responses, scores, winner, synthesizedAnswer, synthesisReasoning } = debateResult;

  const winnerScore = scores.find((s) => s.provider === winner);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-pink-500 rounded" />
        <span className="text-xs font-medium text-pink-400 uppercase tracking-wide">Debate Results</span>
        <span className="text-xs text-zinc-600">— {responses.length} models participated</span>
      </div>

      {/* Model responses grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {responses.filter((r) => !r.error && r.content.trim()).map((response) => (
          <ResponseCard key={response.provider} response={response} collapsible />
        ))}
      </div>

      {/* Score table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left pb-2 text-zinc-500 font-medium pr-4">Model</th>
                  {SCORE_DIMENSIONS.map((dim) => (
                    <th key={dim.key} className="text-center pb-2 text-zinc-500 font-medium px-2 hidden sm:table-cell">
                      {dim.label}
                    </th>
                  ))}
                  <th className="text-center pb-2 text-zinc-400 font-semibold px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => {
                  const isWinner = score.provider === winner;
                  return (
                    <tr
                      key={score.provider}
                      className={cn(
                        'border-b border-zinc-800/50',
                        isWinner && 'bg-amber-500/5',
                      )}
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          {isWinner && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span className={cn('font-medium', isWinner ? 'text-zinc-100' : 'text-zinc-400')}>
                            {getProviderLabel(score.provider)}
                          </span>
                        </div>
                      </td>
                      {SCORE_DIMENSIONS.map((dim) => {
                        const val = score[dim.key];
                        return (
                          <td key={dim.key} className="py-2 px-2 text-center hidden sm:table-cell">
                            <span
                              className={cn(
                                'font-medium tabular-nums',
                                val >= 8.5
                                  ? 'text-emerald-400'
                                  : val >= 7
                                  ? 'text-zinc-300'
                                  : 'text-zinc-500',
                              )}
                            >
                              {val.toFixed(1)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center">
                        <span
                          className={cn(
                            'font-bold tabular-nums text-sm',
                            isWinner ? 'text-amber-400' : 'text-zinc-400',
                          )}
                        >
                          {score.totalScore.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Synthesized answer */}
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Synthesized Answer
              {/* Info icon */}
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="ml-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                title="How this answer was made"
              >
                {showInfo ? <X className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
              </button>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Winner:</span>
              <Badge variant="warning" className="text-xs">
                <span className={WINNER_COLORS[winner]}>{getProviderLabel(winner)}</span>
                <span className="ml-1 text-amber-300">· {winnerScore?.totalScore.toFixed(2)}</span>
              </Badge>
            </div>
          </div>

          {/* How it was made — expands on info click */}
          {showInfo && (
            <div className="mt-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-3 space-y-1.5 text-xs text-zinc-400 leading-relaxed">
              <p>
                <span className="text-zinc-200 font-medium">How this answer was synthesized:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>All {responses.length} models answered your prompt independently.</li>
                <li>Each model scored every other model across 6 dimensions — no self-scoring.</li>
                <li><span className={cn('font-medium', WINNER_COLORS[winner])}>{getProviderLabel(winner)}</span> won with the highest peer-averaged score of <span className="text-amber-400">{winnerScore?.totalScore.toFixed(2)}</span>.</li>
                <li>The winner then rewrote its answer, incorporating the best insights from all other responses.</li>
              </ol>
              {synthesisReasoning && (
                <p className="text-zinc-500 pt-1 border-t border-zinc-700/50">{synthesisReasoning}</p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div
            className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words overflow-hidden response-content"
            dangerouslySetInnerHTML={{
              __html: synthesizedAnswer
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
