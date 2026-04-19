'use client';

import { useState } from 'react';
import { Trophy, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DebateResult, ProviderId } from '@/types';
import { getProviderLabel } from '@/utils';
import { cn } from '@/lib/utils';

interface DebatePanelProps {
  debateResult: DebateResult;
  prompt: string;
}

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

      {/* Synthesized answer only */}
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Synthesized Answer
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

          {showInfo && (
            <div className="mt-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-3 space-y-1.5 text-xs text-zinc-400 leading-relaxed">
              <p><span className="text-zinc-200 font-medium">How this answer was synthesized:</span></p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>All {responses.length} models answered your prompt independently.</li>
                <li>Each model scored every other model across 6 dimensions — no self-scoring.</li>
                <li><span className={cn('font-medium', WINNER_COLORS[winner])}>{getProviderLabel(winner)}</span> won with a peer-averaged score of <span className="text-amber-400">{winnerScore?.totalScore.toFixed(2)}</span>.</li>
                <li>The winner rewrote its answer incorporating the best insights from all responses.</li>
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
