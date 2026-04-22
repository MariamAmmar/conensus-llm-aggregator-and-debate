'use client';

import { Lightbulb } from 'lucide-react';

interface FollowUpQuestionsProps {
  questions: string[];
  onSelect: (q: string) => void;
}

export function FollowUpQuestions({ questions, onSelect }: FollowUpQuestionsProps) {
  if (!questions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Lightbulb className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      {questions.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="px-3 py-1.5 rounded-full text-xs border border-zinc-700 text-zinc-400 hover:border-indigo-500/60 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
