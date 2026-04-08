'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Globe, Zap, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RouterDecision, PromptCategory, ProviderId } from '@/types';
import { getProviderLabel } from '@/utils';

interface RouterDecisionPanelProps {
  decision: RouterDecision;
}

const CATEGORY_COLORS: Record<PromptCategory, string> = {
  research: 'cyan',
  logic: 'orange',
  writing: 'success',
  image: 'warning',
  hybrid: 'purple',
  general: 'secondary',
};

const PROVIDER_COLORS: Record<ProviderId, string> = {
  openai: 'success',
  anthropic: 'orange',
  gemini: 'info',
  perplexity: 'cyan',
  'openai-image': 'warning',
  'gemini-image': 'info',
};

export function RouterDecisionPanel({ decision }: RouterDecisionPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Compact header row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Auto router</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant={CATEGORY_COLORS[decision.category] as 'cyan' | 'orange' | 'success' | 'warning' | 'purple' | 'secondary'}
            className="text-[11px]"
          >
            {decision.category}
          </Badge>

          <span className="text-zinc-600 text-xs">→</span>

          <Badge
            variant={PROVIDER_COLORS[decision.selectedModel] as 'success' | 'orange' | 'info' | 'cyan' | 'warning'}
            className="text-[11px]"
          >
            {getProviderLabel(decision.selectedModel)}
          </Badge>

          {decision.requiresWebGrounding && (
            <Badge variant="cyan" className="text-[11px] gap-1">
              <Globe className="w-2.5 h-2.5" />
              Web
            </Badge>
          )}

          {decision.escalateToDebate && (
            <Badge variant="pink" className="text-[11px] gap-1">
              <Zap className="w-2.5 h-2.5" />
              Debate
            </Badge>
          )}

          {decision.fallbackModel && (
            <Badge variant="secondary" className="text-[11px] gap-1">
              <GitBranch className="w-2.5 h-2.5" />
              Fallback: {getProviderLabel(decision.fallbackModel)}
            </Badge>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? (
            <>Less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Why <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      </div>

      {/* Reason — shown inline below header when expanded */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-400 leading-relaxed">{decision.reason}</p>
        </div>
      )}
    </div>
  );
}
