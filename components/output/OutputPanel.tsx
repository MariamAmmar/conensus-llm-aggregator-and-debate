'use client';

import { useState } from 'react';
import { RouterDecisionPanel } from '@/components/output/RouterDecision';
import { ResponseCard } from '@/components/output/ResponseCard';
import { DebatePanel } from '@/components/output/DebatePanel';
import { ImageOutput } from '@/components/output/ImageOutput';
import type { AppResult, ProviderId } from '@/types';

interface OutputPanelProps {
  result: AppResult;
}

export function OutputPanel({ result }: OutputPanelProps) {
  const [votedProvider, setVotedProvider] = useState<ProviderId | null>(null);

  async function handleVote(provider: ProviderId) {
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: result.prompt,
          winnerProvider: provider,
          responses: result.responses,
          mode: result.mode,
        }),
      });
      setVotedProvider(provider);
    } catch {
      // Vote silently fails — don't interrupt the user
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Timing */}
      {result.durationMs > 0 && (
        <div className="text-xs text-zinc-500">
          Completed in {(result.durationMs / 1000).toFixed(1)}s
        </div>
      )}

      {/* Image output — shown for dedicated image mode or auto-routed image requests */}
      {result.imageResult && (
        <ImageOutput imageResult={result.imageResult} prompt={result.prompt} />
      )}

      {/* Debate mode */}
      {result.mode === 'debate' && result.debateResult && (
        <DebatePanel debateResult={result.debateResult} prompt={result.prompt} />
      )}

      {/* All models side-by-side with voting */}
      {result.mode === 'all' && (
        <>
          {!votedProvider && (
            <p className="text-xs text-zinc-500 pl-1">Vote for the best answer to help improve routing.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.responses.map((response) => (
              <ResponseCard
                key={response.provider}
                response={response}
                onVote={handleVote}
                voted={votedProvider}
              />
            ))}
          </div>
        </>
      )}

      {/* Single model / auto mode — skip if image was returned */}
      {!result.imageResult && result.mode !== 'debate' && result.mode !== 'all' && (
        <>
          {/* Router decision (auto mode only) */}
          {result.mode === 'auto' && result.routerDecision && (
            <RouterDecisionPanel decision={result.routerDecision} />
          )}

          {/* Responses */}
          <div className="space-y-3">
            {result.responses.map((response) => (
              <ResponseCard key={response.provider} response={response} />
            ))}
          </div>

          {/* Final answer (if different from single response) */}
          {result.finalAnswer && result.responses.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed response-content">
                {result.finalAnswer}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
