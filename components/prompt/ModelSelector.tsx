'use client';

import {
  Sparkles,
  MessageSquare,
  Brain,
  Zap,
  Globe,
  Users,
  ImageIcon,
  LayoutGrid,
  ChevronDown,
  Wand2,
  Flame,
  Box,
  Cpu,
  GitBranch,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MODEL_CONFIGS } from '@/config/models';
import { cn } from '@/lib/utils';
import type { ModelMode, ImageProviderMode } from '@/types';

// Models available for individual/multi selection
const SELECTABLE_MODELS: ModelMode[] = ['chatgpt', 'claude', 'gemini', 'perplexity', 'grok', 'llama', 'o4mini', 'deepseek'];
// Special modes shown separately
const SPECIAL_MODELS: ModelMode[] = ['all', 'image'];

const ICONS: Record<ModelMode, React.ReactNode> = {
  auto:       <Sparkles className="w-3.5 h-3.5" />,
  chatgpt:    <MessageSquare className="w-3.5 h-3.5" />,
  claude:     <Brain className="w-3.5 h-3.5" />,
  gemini:     <Zap className="w-3.5 h-3.5" />,
  perplexity: <Globe className="w-3.5 h-3.5" />,
  grok:       <Flame className="w-3.5 h-3.5" />,
  llama:      <Box className="w-3.5 h-3.5" />,
  o4mini:     <Cpu className="w-3.5 h-3.5" />,
  deepseek:   <GitBranch className="w-3.5 h-3.5" />,
  all:        <LayoutGrid className="w-3.5 h-3.5" />,
  debate:     <Users className="w-3.5 h-3.5" />,
  image:      <ImageIcon className="w-3.5 h-3.5" />,
};

// Image provider sub-selector config
const IMAGE_PROVIDERS: {
  id: ImageProviderMode;
  label: string;
  description: string;
  activeColor: string;
}[] = [
  {
    id: 'auto-image',
    label: 'Auto',
    description: 'Picks DALL-E or Imagen based on your prompt',
    activeColor: 'bg-amber-500/20 border-amber-500 text-amber-300',
  },
  {
    id: 'openai-image',
    label: 'DALL-E 3',
    description: 'Best for artistic styles, illustrations, and creative images',
    activeColor: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
  },
  {
    id: 'gemini-image',
    label: 'Imagen 4',
    description: 'Best for photorealistic images, portraits, and natural scenes',
    activeColor: 'bg-blue-500/20 border-blue-500 text-blue-300',
  },
];

type TopLevel = 'auto' | 'select' | 'debate';

function getTopLevel(mode: ModelMode): TopLevel {
  if (mode === 'auto') return 'auto';
  if (mode === 'debate') return 'debate';
  return 'select';
}

export function ModelSelector() {
  const { selectedMode, selectedModels, selectedImageProvider, setMode, toggleModel, setImageProvider } = useAppStore();
  const activeConfig = MODEL_CONFIGS[selectedMode];
  const topLevel = getTopLevel(selectedMode);
  const multiActive = topLevel === 'select' && selectedModels.length > 1;

  function handleTopLevel(choice: TopLevel) {
    if (choice === 'auto') setMode('auto');
    else if (choice === 'debate') setMode('debate');
    else if (choice === 'select') {
      // Always reset to single-model when entering select tab,
      // so switching from 'all' or 'image' doesn't keep those modes active
      if (!['chatgpt','claude','gemini','perplexity','grok','llama','o4mini','deepseek'].includes(selectedMode)) {
        setMode('chatgpt');
      }
    }
  }

  const topOptions: { id: TopLevel; label: string; icon: React.ReactNode }[] = [
    { id: 'auto',   label: 'Auto',         icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'select', label: 'Select Model', icon: <ChevronDown className="w-3.5 h-3.5" /> },
    { id: 'debate', label: 'Debate',       icon: <Users className="w-3.5 h-3.5" /> },
  ];

  const topActiveColor: Record<TopLevel, string> = {
    auto:   'bg-purple-500/20 border-purple-500 text-purple-300',
    select: 'bg-indigo-500/20 border-indigo-500 text-indigo-300',
    debate: 'bg-pink-500/20 border-pink-500 text-pink-300',
  };

  // Description line — for image mode, describe the selected image provider
  const imageProviderConfig =
    selectedMode === 'image'
      ? IMAGE_PROVIDERS.find((p) => p.id === selectedImageProvider)
      : null;

  const descriptionLabel = imageProviderConfig
    ? `Image · ${imageProviderConfig.label}`
    : activeConfig.label;

  const descriptionText = imageProviderConfig
    ? imageProviderConfig.description
    : activeConfig.description;

  const descriptionColor = imageProviderConfig ? 'text-amber-400' : activeConfig.color;

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
                'inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150 flex-1 sm:flex-none justify-center sm:justify-start',
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

      {/* Model sub-selector — multi-select for text models */}
      {topLevel === 'select' && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5 pl-1">
            {SELECTABLE_MODELS.map((mode) => {
              const config = MODEL_CONFIGS[mode];
              const isActive = selectedModels.includes(mode);
              return (
                <button
                  key={mode}
                  onClick={() => toggleModel(mode)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                    isActive
                      ? config.activeColor
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800',
                  )}
                  aria-pressed={isActive}
                >
                  {isActive && <Check className="w-3 h-3" />}
                  {!isActive && ICONS[mode]}
                  {config.label}
                </button>
              );
            })}
          </div>
          {/* Special modes */}
          <div className="flex flex-wrap gap-1.5 pl-1">
            {SPECIAL_MODELS.map((mode) => {
              const config = MODEL_CONFIGS[mode];
              const isActive = selectedMode === mode && selectedModels.length === 1;
              return (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
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
          {multiActive && (
            <p className="text-[11px] text-indigo-400 pl-1">
              {selectedModels.length} models selected — responses shown side by side
            </p>
          )}
        </div>
      )}

      {/* Image provider sub-selector — shown when Image is selected */}
      {selectedMode === 'image' && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {IMAGE_PROVIDERS.map((provider) => {
            const isActive = selectedImageProvider === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => setImageProvider(provider.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                  isActive
                    ? provider.activeColor
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800',
                )}
                aria-pressed={isActive}
              >
                <Wand2 className="w-3 h-3" />
                {provider.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Description */}
      {!multiActive && (
        <p className="text-xs text-zinc-500 pl-1">
          <span className={cn('font-medium', descriptionColor)}>{descriptionLabel}</span>
          {' — '}
          {descriptionText}
        </p>
      )}
    </div>
  );
}
