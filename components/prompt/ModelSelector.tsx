'use client';

import { useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  Brain,
  Zap,
  Globe,
  Users,
  ImageIcon,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MODEL_CONFIGS } from '@/config/models';
import { cn } from '@/lib/utils';
import type { ModelMode } from '@/types';

// The 5 specific models shown when "Select Model" is active
const SPECIFIC_MODELS: ModelMode[] = ['chatgpt', 'claude', 'gemini', 'perplexity', 'image'];

const ICONS: Record<ModelMode, React.ReactNode> = {
  auto: <Sparkles className="w-3.5 h-3.5" />,
  chatgpt: <MessageSquare className="w-3.5 h-3.5" />,
  claude: <Brain className="w-3.5 h-3.5" />,
  gemini: <Zap className="w-3.5 h-3.5" />,
  perplexity: <Globe className="w-3.5 h-3.5" />,
  debate: <Users className="w-3.5 h-3.5" />,
  image: <ImageIcon className="w-3.5 h-3.5" />,
};

// Map top-level selection to UI state
type TopLevel = 'auto' | 'select' | 'debate';

function getTopLevel(mode: ModelMode): TopLevel {
  if (mode === 'auto') return 'auto';
  if (mode === 'debate') return 'debate';
  return 'select';
}

export function ModelSelector() {
  const { selectedMode, setMode } = useAppStore();
  const activeConfig = MODEL_CONFIGS[selectedMode];
  const topLevel = getTopLevel(selectedMode);

  function handleTopLevel(choice: TopLevel) {
    if (choice === 'auto') setMode('auto');
    else if (choice === 'debate') setMode('debate');
    // 'select' — keep current specific model, or default to chatgpt
    else if (choice === 'select') {
      if (getTopLevel(selectedMode) !== 'select') setMode('chatgpt');
    }
  }

  const topOptions: { id: TopLevel; label: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'auto',
      label: 'Auto',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      description: 'Best model selected automatically for your prompt',
    },
    {
      id: 'select',
      label: 'Select Model',
      icon: <ChevronDown className="w-3.5 h-3.5" />,
      description: 'Choose a specific model to use',
    },
    {
      id: 'debate',
      label: 'Debate',
      icon: <Users className="w-3.5 h-3.5" />,
      description: 'All models answer, critique each other, and synthesize the best answer',
    },
  ];

  const topActiveColor: Record<TopLevel, string> = {
    auto: 'bg-purple-500/20 border-purple-500 text-purple-300',
    select: 'bg-indigo-500/20 border-indigo-500 text-indigo-300',
    debate: 'bg-pink-500/20 border-pink-500 text-pink-300',
  };

  return (
    <div className="space-y-3">
      {/* Top-level 3-option row */}
      <div className="flex gap-2">
        {topOptions.map((opt) => {
          const isActive = topLevel === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleTopLevel(opt.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150',
                isActive
                  ? topActiveColor[opt.id]
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800',
              )}
              aria-pressed={isActive}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Specific model sub-selector — only shown when "Select Model" is active */}
      {topLevel === 'select' && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {SPECIFIC_MODELS.map((mode) => {
            const config = MODEL_CONFIGS[mode];
            const isActive = selectedMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                  isActive
                    ? config.activeColor
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800',
                )}
                aria-pressed={isActive}
              >
                {ICONS[mode]}
                {config.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Description of active mode */}
      <p className="text-xs text-zinc-500 pl-1">
        <span className={cn('font-medium', activeConfig.color)}>{activeConfig.label}</span>
        {' — '}
        {activeConfig.description}
      </p>
    </div>
  );
}
