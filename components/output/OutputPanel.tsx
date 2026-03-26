'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouterDecisionPanel } from '@/components/output/RouterDecision';
import { ResponseCard } from '@/components/output/ResponseCard';
import { DebatePanel } from '@/components/output/DebatePanel';
import { ImageOutput } from '@/components/output/ImageOutput';
import type { AppResult } from '@/types';
import { cn } from '@/lib/utils';

interface OutputPanelProps {
  result: AppResult;
  onNewConversation: () => void;
}

export function OutputPanel({ result, onNewConversation }: OutputPanelProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* New conversation button */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {result.durationMs > 0 && (
            <span>Completed in {(result.durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewConversation}
          className="gap-1.5 h-7 text-xs"
        >
          <Plus className="w-3 h-3" />
          New conversation
        </Button>
      </div>

      {/* Image mode */}
      {result.mode === 'image' && result.imageResult && (
        <ImageOutput imageResult={result.imageResult} prompt={result.prompt} />
      )}

      {/* Debate mode */}
      {result.mode === 'debate' && result.debateResult && (
        <DebatePanel debateResult={result.debateResult} prompt={result.prompt} />
      )}

      {/* Single model / auto mode */}
      {result.mode !== 'image' && result.mode !== 'debate' && (
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
