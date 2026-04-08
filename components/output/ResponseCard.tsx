'use client';

import { useState } from 'react';
import { Globe, AlertCircle, Clock, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { ModelResponse, ProviderId } from '@/types';
import { getProviderLabel } from '@/utils';
import { cn } from '@/lib/utils';

const PROVIDER_ACCENT: Record<ProviderId, string> = {
  openai: 'border-l-emerald-500',
  anthropic: 'border-l-orange-500',
  gemini: 'border-l-blue-500',
  perplexity: 'border-l-cyan-500',
  'openai-image': 'border-l-amber-500',
  'gemini-image': 'border-l-blue-500',
};

const PROVIDER_ICON_COLOR: Record<ProviderId, string> = {
  openai: 'text-emerald-400',
  anthropic: 'text-orange-400',
  gemini: 'text-blue-400',
  perplexity: 'text-cyan-400',
  'openai-image': 'text-amber-400',
  'gemini-image': 'text-blue-400',
};

const PROVIDER_BADGE_VARIANT: Record<ProviderId, string> = {
  openai: 'success',
  anthropic: 'orange',
  gemini: 'info',
  perplexity: 'cyan',
  'openai-image': 'warning',
  'gemini-image': 'info',
};

interface ResponseCardProps {
  response: ModelResponse;
  isLoading?: boolean;
  onVote?: (provider: ProviderId) => Promise<void>;
  voted?: ProviderId | null;
}

export function ResponseCard({ response, isLoading, onVote, voted }: ResponseCardProps) {
  const [voting, setVoting] = useState(false);

  async function handleVote() {
    if (!onVote || voting || voted) return;
    setVoting(true);
    await onVote(response.provider);
    setVoting(false);
  }

  const isVoted = voted === response.provider;
  const someoneVoted = voted != null;
  if (isLoading) {
    return (
      <Card className={cn('border-l-2', PROVIDER_ACCENT[response.provider])}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 skeleton rounded" />
            <div className="h-4 w-12 skeleton rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-3 w-full skeleton rounded" />
            <div className="h-3 w-5/6 skeleton rounded" />
            <div className="h-3 w-4/6 skeleton rounded" />
            <div className="h-3 w-full skeleton rounded" />
            <div className="h-3 w-3/4 skeleton rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (response.error) {
    return (
      <Card className={cn('border-l-2 border-l-red-500')}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className={cn('text-sm font-medium', PROVIDER_ICON_COLOR[response.provider])}>
              {getProviderLabel(response.provider)}
            </span>
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertCircle className="w-3 h-3" />
              Error
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{response.error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-l-2', PROVIDER_ACCENT[response.provider])}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={cn('text-sm font-semibold', PROVIDER_ICON_COLOR[response.provider])}>
            {getProviderLabel(response.provider)}
          </span>
          <div className="flex items-center gap-1.5">
            {response.isGrounded && (
              <Badge variant="cyan" className="text-[11px] gap-1">
                <Globe className="w-2.5 h-2.5" />
                Grounded
              </Badge>
            )}
            {response.latencyMs > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Clock className="w-2.5 h-2.5" />
                {response.latencyMs}ms
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div
          className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap response-content"
          dangerouslySetInnerHTML={{ __html: formatResponseContent(response.content) }}
        />
        {onVote && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleVote}
              disabled={voting || someoneVoted}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                isVoted
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : someoneVoted
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10',
              )}
            >
              <ThumbsUp className={cn('w-3 h-3', voting && 'animate-pulse')} />
              {isVoted ? 'Best answer' : 'Vote'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple markdown-like formatting for bold text and lists
function formatResponseContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
    .replace(/^(\d+)\. /gm, '<span class="text-zinc-400">$1.</span> ')
    .replace(/^- /gm, '<span class="text-zinc-500">•</span> ');
}
