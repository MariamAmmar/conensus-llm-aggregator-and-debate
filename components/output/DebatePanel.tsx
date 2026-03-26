'use client';

import { useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponseCard } from '@/components/output/ResponseCard';
import { Separator } from '@/components/ui/separator';
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
  openai: 'text-emerald-400 border-emerald-500',
  anthropic: 'text-orange-400 border-orange-500',
  gemini: 'text-blue-400 border-blue-500',
  perplexity: 'text-cyan-400 border-cyan-500',
  'openai-image': 'text-amber-400 border-amber-500',
  'gemini-image': 'text-blue-400 border-blue-500',
};

export function DebatePanel({ debateResult, prompt }: DebatePanelProps) {
  const [critiquesExpanded, setCritiquesExpanded] = useState(false);
  const { responses, critiques, scores, winner, synthesizedAnswer, synthesisReasoning } = debateResult;

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
        {responses.map((response) => (
          <ResponseCard key={response.provider} response={response} />
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
                    <th key={dim.key} className="text-center pb-2 text-zinc-500 font-medium px-2">
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
                          <td key={dim.key} className="py-2 px-2 text-center">
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

      {/* Critiques (collapsible) */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <button
          onClick={() => setCritiquesExpanded(!critiquesExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400 font-medium">Model Critiques</span>
            <Badge variant="secondary" className="text-[10px]">{critiques.length}</Badge>
          </div>
          {critiquesExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {critiquesExpanded && (
          <div className="border-t border-zinc-800">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {critiques.map((critique, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-zinc-800/50 border border-zinc-800 p-3 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-300 font-medium">{getProviderLabel(critique.critic)}</span>
                    <span className="text-zinc-600">on</span>
                    <span className="text-zinc-400">{getProviderLabel(critique.target)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{critique.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Synthesized answer (winner) */}
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Synthesized Answer
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Winner:</span>
              <Badge
                variant="warning"
                className={cn('text-xs', winnerScore ? '' : '')}
              >
                {getProviderLabel(winner)} · {winnerScore?.totalScore.toFixed(2)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap response-content"
            dangerouslySetInnerHTML={{
              __html: synthesizedAnswer
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
            }}
          />

          {synthesisReasoning && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1.5">Synthesis Reasoning</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{synthesisReasoning}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
