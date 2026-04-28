'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DEBATE_CONFIG } from '@/config/debate';
import { getProviderLabel } from '@/utils';
import { MarkdownContent } from './MarkdownContent';
import type { ModelResponse, ProviderId } from '@/types';

const PROVIDER_COLOR: Partial<Record<ProviderId, string>> = {
  openai:     'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  anthropic:  'text-orange-400 border-orange-500/30 bg-orange-500/5',
  gemini:     'text-blue-400 border-blue-500/30 bg-blue-500/5',
  perplexity: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
  grok:       'text-rose-400 border-rose-500/30 bg-rose-500/5',
  llama:      'text-lime-400 border-lime-500/30 bg-lime-500/5',
  o4mini:     'text-sky-400 border-sky-500/30 bg-sky-500/5',
  deepseek:   'text-violet-400 border-violet-500/30 bg-violet-500/5',
};

const PREVIEW_WORDS = 60;

const ERROR_QUIPS: Partial<Record<ProviderId, string[]>> = {
  anthropic: [
    'Claude is having an existential crisis and needed a moment.',
    'Claude read the question, wrote a 47-page response, then deleted it.',
    'Claude is consulting its ethics committee before answering.',
    'Claude stepped out to contemplate the nature of intelligence.',
  ],
  gemini: [
    'Gemini is busy searching every corner of the internet. Both of them.',
    'Gemini called in sick — apparently AI models get those too.',
    'Gemini is still loading. It takes time to be this multimodal.',
    'Gemini got distracted by a YouTube video about itself.',
  ],
  perplexity: [
    'Perplexity is web searching. And searching. And searching…',
    'Perplexity found 4,000 results and got overwhelmed.',
    'Perplexity is citing sources it hasn\'t found yet.',
    'Perplexity went down a Wikipedia rabbit hole. Send help.',
  ],
  grok: [
    'Grok is doom-scrolling X instead of answering.',
    'Grok saw something spicy on X and forgot what the question was.',
    'Grok is arguing with someone in the replies. BRB.',
    'Grok got ratio\'d and needed a minute.',
  ],
  openai: [
    'ChatGPT is checking if this question violates its terms of service.',
    'ChatGPT started answering, then had second thoughts.',
    'ChatGPT is fine-tuning its response for the 12th time.',
  ],
  llama: [
    'Llama wandered off to graze. It\'s open-source, nobody told it to stay.',
    'Llama is running on someone\'s laptop somewhere. It\'s doing its best.',
    'Llama got spooked and ran off the GPU.',
  ],
  o4mini: [
    'o4-mini is thinking so hard it forgot to answer.',
    'o4-mini did 400 reasoning steps and lost the thread.',
    'o4-mini is still reasoning. It\'s a lot to reason about.',
    'o4-mini wrote its chain of thought and the chain is very, very long.',
  ],
  deepseek: [
    'DeepSeek is thinking deeply. Very, very deeply.',
    'DeepSeek started a chain of thought and the chain escaped.',
    'DeepSeek is reasoning step by step. Step 1,847 ongoing.',
    'DeepSeek went so deep it lost the question.',
  ],
};

const FALLBACK_QUIPS = [
  'This model called in sick today.',
  'Gone fishing. Back never.',
  'This model is on a coffee break.',
  'Ran out of tokens. And motivation.',
];

function getErrorQuip(provider: ProviderId, index: number): string {
  const quips = ERROR_QUIPS[provider] ?? FALLBACK_QUIPS;
  return quips[index % quips.length];
}

function DebateModelCard({ response, isNew }: { response: ModelResponse; isNew: boolean }) {
  const words = (response.content || '').split(/\s+/).filter(Boolean);
  const preview = words.slice(0, PREVIEW_WORDS);
  const [shown, setShown] = useState(isNew ? 0 : preview.length);
  const [quipIndex, setQuipIndex] = useState(0);
  const colors = PROVIDER_COLOR[response.provider] ?? 'text-zinc-400 border-zinc-700 bg-zinc-900';

  useEffect(() => {
    if (!isNew || shown >= preview.length) return;
    const t = setTimeout(() => setShown((s) => Math.min(s + 3, preview.length)), 18);
    return () => clearTimeout(t);
  }, [shown, preview.length, isNew]);

  // Cycle quips every 3 seconds for failed models
  useEffect(() => {
    if (!response.error) return;
    const t = setInterval(() => setQuipIndex((i) => i + 1), 3000);
    return () => clearInterval(t);
  }, [response.error]);

  return (
    <div className={cn('rounded-xl border p-3 space-y-2 transition-all duration-300', colors)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold', colors.split(' ')[0])}>
          {getProviderLabel(response.provider)}
        </span>
        {response.error ? (
          <span className="text-[10px] text-zinc-500 italic">sat this one out</span>
        ) : (
          <span className="text-[10px] text-zinc-600">{response.latencyMs}ms</span>
        )}
      </div>
      {response.error ? (
        <p key={quipIndex} className="text-[11px] text-zinc-500 italic leading-relaxed animate-in fade-in duration-500">
          {getErrorQuip(response.provider, quipIndex)}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-300 leading-relaxed min-h-[2.5rem]">
          {preview.slice(0, shown).join(' ')}
          {shown < preview.length && (
            <span className="inline-block w-0.5 h-3 bg-current opacity-70 animate-pulse ml-0.5 -mb-0.5" />
          )}
          {shown >= preview.length && words.length > PREVIEW_WORDS && ' …'}
        </p>
      )}
    </div>
  );
}

function PendingModelCard({ provider }: { provider: ProviderId }) {
  const colors = PROVIDER_COLOR[provider] ?? 'text-zinc-600 border-zinc-800 bg-zinc-900';
  return (
    <div className={cn('rounded-xl border p-3 space-y-2 opacity-40', colors)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold', colors.split(' ')[0])}>
          {getProviderLabel(provider)}
        </span>
        <span className="flex gap-0.5 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-current animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 rounded bg-current opacity-20 w-full" />
        <div className="h-2 rounded bg-current opacity-15 w-4/5" />
        <div className="h-2 rounded bg-current opacity-10 w-3/5" />
      </div>
    </div>
  );
}

interface DebateProgressProps {
  stage?: 'collecting' | 'scoring' | 'synthesizing';
  responses?: ModelResponse[];
  synthesisContent?: string;
}

export function DebateProgress({ stage = 'collecting', responses = [], synthesisContent = '' }: DebateProgressProps) {
  const total = DEBATE_CONFIG.participants.length;
  const done = responses.filter((r) => !r.error).length;
  const respondedMap = new Map(responses.map((r) => [r.provider, r]));

  // Track which providers we've already rendered so we know which are "new"
  const seenRef = useRef(new Set<string>());

  return (
    <div className="space-y-3">
      {/* Stage header */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          stage === 'collecting'   ? 'bg-indigo-500 animate-pulse' :
          stage === 'scoring'      ? 'bg-amber-500 animate-pulse' :
                                     'bg-emerald-500 animate-pulse',
        )} />
        <span className="text-xs text-zinc-400">
          {stage === 'collecting' && (
            done < total
              ? <><span className="text-zinc-200 font-medium">{done}</span> of {total} models responded…</>
              : <>All {total} models responded — scoring</>
          )}
          {stage === 'scoring'    && 'Models scoring each other across 6 dimensions…'}
          {stage === 'synthesizing' && 'Writing the synthesized answer…'}
        </span>
      </div>

      {/* Progress bar — collecting only */}
      {stage === 'collecting' && (
        <div className="h-0.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* Model cards grid — collecting and scoring */}
      {(stage === 'collecting' || stage === 'scoring') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEBATE_CONFIG.participants.map((pid) => {
            const response = respondedMap.get(pid);
            if (response) {
              const isNew = !seenRef.current.has(pid);
              if (isNew) seenRef.current.add(pid);
              return <DebateModelCard key={pid} response={response} isNew={isNew} />;
            }
            return <PendingModelCard key={pid} provider={pid} />;
          })}
        </div>
      )}

      {/* Synthesis streaming */}
      {stage === 'synthesizing' && (
        <div className="space-y-2">
          {synthesisContent ? (
            <div className="text-sm text-zinc-200 leading-relaxed">
              <MarkdownContent content={synthesisContent} />
              <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 -mb-0.5" />
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-zinc-500">Writing the synthesized answer…</span>
              </div>
              <div className="space-y-2">
                <div className="h-2.5 skeleton rounded-full w-full" />
                <div className="h-2.5 skeleton rounded-full w-10/12" />
                <div className="h-2.5 skeleton rounded-full w-full" />
                <div className="h-2.5 skeleton rounded-full w-11/12" />
                <div className="h-2.5 skeleton rounded-full w-8/12" />
                <div className="h-2.5 skeleton rounded-full w-full" />
                <div className="h-2.5 skeleton rounded-full w-9/12" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
