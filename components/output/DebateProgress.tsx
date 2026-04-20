'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const STAGES = [
  { label: 'Gathering responses from all 8 models', duration: 9000 },
  { label: 'Scoring responses across 6 dimensions', duration: 7000 },
  { label: 'Synthesizing the best answer',          duration: Infinity },
];

export function DebateProgress() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), STAGES[stage].duration);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className="space-y-3 py-1">
      {STAGES.map((s, i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
              {done ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                  <span className="text-emerald-400 text-[9px] font-bold">✓</span>
                </div>
              ) : active ? (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                </>
              ) : (
                <div className="w-4 h-4 rounded-full border border-zinc-700" />
              )}
            </div>
            <span className={cn(
              'text-sm transition-colors',
              done ? 'text-zinc-500 line-through' : active ? 'text-zinc-200' : 'text-zinc-600',
            )}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
