'use client';

import { useState } from 'react';
import {
  X, Sparkles, Users, ChevronDown, Paperclip,
  CheckCircle, ArrowRight, Zap, Brain, Globe, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    accent: 'indigo',
    icon: Sparkles,
    iconColor: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    title: 'Finally, the AIs stopped fighting. Kind of.',
    description:
      "You know how everyone has a favourite AI? We said 'why pick sides' and hired all of them. ChatGPT, Claude, Gemini, Grok, Perplexity, Llama, o4-mini, and DeepSeek — all in one place, working together (or arguing, depending on the mode).",
    visual: (
      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
        {['ChatGPT', 'Claude', 'Gemini', 'Grok', 'Perplexity', 'Llama', 'o4-mini', 'DeepSeek'].map((name) => (
          <span key={name} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400">
            {name}
          </span>
        ))}
      </div>
    ),
  },
  {
    accent: 'purple',
    icon: Zap,
    iconColor: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    title: 'Auto Mode — Let us pick',
    description:
      'Just type your question and hit Send. Consensus automatically routes it to the best AI — ChatGPT for creative tasks, Claude for reasoning, Perplexity when you need live web results, and so on.',
    tip: 'Best for everyday questions where you want the best answer fast.',
    visual: (
      <div className="flex gap-2 justify-center flex-wrap mt-1">
        {['Auto', 'Choose', 'Debate'].map((label, i) => (
          <span
            key={label}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border',
              i === 0
                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500',
            )}
          >
            {label}
          </span>
        ))}
      </div>
    ),
  },
  {
    accent: 'pink',
    icon: Users,
    iconColor: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    title: 'Debate Mode — The crowd-sourced answer',
    description:
      '8 AI models answer your question independently, then peer-score each other across 6 dimensions. The winner rewrites its answer incorporating the best insights from all responses.',
    tip: 'Best for complex questions, controversial topics, or when you want the most thorough answer possible.',
    visual: (
      <div className="flex items-center justify-center gap-2 text-xs mt-1">
        <span className="text-pink-300 font-medium">8 models answer</span>
        <span className="text-zinc-600">→</span>
        <span className="text-amber-300 font-medium">score each other</span>
        <span className="text-zinc-600">→</span>
        <span className="text-emerald-300 font-medium">best answer wins</span>
      </div>
    ),
  },
  {
    accent: 'indigo',
    icon: ChevronDown,
    iconColor: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    title: 'Choose Mode — Pick your model',
    description:
      'Select any model directly: ChatGPT, Claude, Gemini, Perplexity, Grok, Llama, o4-mini, or DeepSeek. You can even select multiple models at once to see their answers side by side.',
    tip: 'Great for comparing how different AIs approach the same question.',
    visual: (
      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
        {[
          { label: 'ChatGPT', color: 'text-emerald-400' },
          { label: 'Claude', color: 'text-orange-400' },
          { label: 'Gemini', color: 'text-blue-400' },
          { label: 'Perplexity', color: 'text-cyan-400' },
        ].map(({ label, color }) => (
          <span key={label} className={cn('px-2.5 py-1 rounded-full text-xs border bg-zinc-900 border-zinc-700 font-medium', color)}>
            {label}
          </span>
        ))}
        <span className="px-2.5 py-1 rounded-full text-xs border bg-zinc-900 border-zinc-700 text-zinc-500">+ 4 more</span>
      </div>
    ),
  },
  {
    accent: 'emerald',
    icon: Globe,
    iconColor: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Links & context — AI that reads for you',
    description:
      'Paste any URL in your message and the AI will read the page before answering. It also follows links it mentions in previous replies automatically.',
    tip: 'Works with articles, docs, GitHub repos, news stories — anything publicly accessible.',
    visual: (
      <div className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2 text-xs text-zinc-400 mt-1">
        <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="truncate">https://example.com/article → AI reads it instantly</span>
      </div>
    ),
  },
  {
    accent: 'sky',
    icon: Paperclip,
    iconColor: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    title: 'Attach anything',
    description:
      'Upload images, PDFs, Word docs, Excel spreadsheets, audio files, and more. The AI will read and analyze your files as part of its response.',
    tip: 'Audio files are auto-transcribed using Whisper. Word and Excel files have their text extracted automatically.',
    visual: (
      <div className="flex flex-wrap gap-1.5 justify-center mt-1">
        {[
          { label: 'Images', color: 'text-amber-400' },
          { label: 'PDFs', color: 'text-red-400' },
          { label: 'Word', color: 'text-blue-400' },
          { label: 'Excel', color: 'text-emerald-400' },
          { label: 'Audio', color: 'text-purple-400' },
        ].map(({ label, color }) => (
          <span key={label} className={cn('px-2.5 py-1 rounded-full text-xs border bg-zinc-900 border-zinc-700 font-medium', color)}>
            {label}
          </span>
        ))}
      </div>
    ),
  },
  {
    accent: 'indigo',
    icon: Brain,
    iconColor: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    title: 'Memory & sessions',
    description:
      'Consensus remembers facts you share across conversations and saves your session history in the sidebar. Sign in to sync your history and memory across devices.',
    tip: 'Your conversations are saved automatically — pick up where you left off any time.',
    visual: null,
  },
  {
    accent: 'teal',
    icon: ShieldCheck,
    iconColor: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
    title: 'Your data stays yours',
    description:
      "We don't train on your conversations, sell your data, or share it with third parties. Your chat history lives in your browser and, if you're signed in, your private account — nowhere else.",
    tip: 'Memory is stored locally and you can clear it any time from Settings. You\'re always in control.',
    visual: (
      <div className="space-y-2 mt-1">
        {[
          { label: 'No training on your conversations', check: true },
          { label: 'No selling or sharing your data', check: true },
          { label: 'History synced only to your account', check: true },
          { label: 'Clear memory any time in Settings', check: true },
        ].map(({ label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0 text-teal-400 text-[10px]">✓</span>
            {label}
          </div>
        ))}
      </div>
    ),
  },
  {
    accent: 'emerald',
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: "You're all set!",
    description:
      "Start with any question — Auto mode will handle the rest. Come back to this guide any time using the ? button in the header.",
    visual: null,
  },
] as const;

const ACCENT_BTN: Record<string, string> = {
  indigo:  'bg-indigo-600 hover:bg-indigo-500',
  purple:  'bg-purple-600 hover:bg-purple-500',
  pink:    'bg-pink-600 hover:bg-pink-500',
  emerald: 'bg-emerald-600 hover:bg-emerald-500',
  sky:     'bg-sky-600 hover:bg-sky-500',
  teal:    'bg-teal-600 hover:bg-teal-500',
};

interface WelcomeTourProps {
  onClose: () => void;
}

export function WelcomeTour({ onClose }: WelcomeTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;
  const btnColor = ACCENT_BTN[current.accent] ?? ACCENT_BTN.indigo;

  function handleClose() {
    localStorage.setItem('consensus-tour-seen', '1');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              Welcome Tutorial
            </span>
            <span className="text-[10px] text-zinc-600 tabular-nums">{step + 1} / {STEPS.length}</span>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-5 text-center space-y-4">
          {/* Icon */}
          <div className={cn('w-14 h-14 rounded-2xl border mx-auto flex items-center justify-center', current.bg)}>
            <Icon className={cn('w-7 h-7', current.iconColor)} />
          </div>

          {/* Title */}
          <h2 className="text-base font-semibold text-zinc-100 leading-snug">{current.title}</h2>

          {/* Description */}
          <p className="text-sm text-zinc-400 leading-relaxed">{current.description}</p>

          {/* Visual */}
          {current.visual && (
            <div className="mt-1">{current.visual}</div>
          )}

          {/* Tip */}
          {'tip' in current && current.tip && (
            <div className="text-[11px] text-zinc-500 bg-zinc-800/50 rounded-lg px-3 py-2 text-left leading-relaxed">
              💡 {current.tip}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                'rounded-full transition-all duration-200',
                i === step ? 'w-5 h-1.5 bg-indigo-400' : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500',
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {step === 0 ? 'Maybe later' : 'Back'}
            </button>

            <button
              onClick={() => isLast ? handleClose() : setStep(step + 1)}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors',
                btnColor,
              )}
            >
              {isLast ? 'Get started' : 'Next'}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Always-visible skip — hidden on the last step */}
          {!isLast && (
            <div className="text-center">
              <button
                onClick={handleClose}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2"
              >
                Skip tutorial
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
