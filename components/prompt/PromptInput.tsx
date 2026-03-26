'use client';

import { useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { ModelMode } from '@/types';

const PLACEHOLDERS: Record<ModelMode, string> = {
  auto: 'Ask anything — I\'ll find the best model for your question...',
  chatgpt: 'Write a prompt for ChatGPT...',
  claude: 'Ask Claude a reasoning or analysis question...',
  gemini: 'Ask Gemini a question...',
  perplexity: 'Search the web with Perplexity...',
  debate: 'Enter a topic for all models to debate...',
  image: 'Describe the image you want to generate...',
};

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
}

export function PromptInput({ onSubmit }: PromptInputProps) {
  const { selectedMode, prompt, isLoading, mockMode, setPrompt } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 200; // ~8 rows
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [prompt]);

  // Focus on mode change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [selectedMode]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim());
  }

  const charCount = prompt.length;
  const maxChars = 4000;
  const isOverLimit = charCount > maxChars;

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-zinc-900 transition-all duration-150',
        isLoading
          ? 'border-zinc-700 opacity-75'
          : 'border-zinc-700 hover:border-zinc-600 focus-within:border-indigo-500',
      )}
    >
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDERS[selectedMode]}
        disabled={isLoading}
        rows={3}
        style={{ minHeight: '80px', maxHeight: '200px' }}
        className={cn(
          'w-full resize-none bg-transparent px-4 pt-4 pb-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed',
        )}
        aria-label="Prompt input"
      />

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 border-t border-zinc-800">
        {/* Left: char count + mock indicator */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'text-xs',
              isOverLimit ? 'text-red-400' : charCount > maxChars * 0.8 ? 'text-amber-400' : 'text-zinc-600',
            )}
          >
            {charCount.toLocaleString()}/{maxChars.toLocaleString()}
          </span>
          {mockMode && (
            <span className="text-[10px] text-amber-500/70 font-medium uppercase tracking-wide">
              Mock
            </span>
          )}
        </div>

        {/* Right: keyboard hint + submit */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-[10px] text-zinc-600">
            ⌘↵ to send
          </span>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !prompt.trim() || isOverLimit}
            size="sm"
            className={cn(
              'h-7 px-3 gap-1.5 text-xs',
              isLoading || !prompt.trim()
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white',
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            {isLoading ? 'Thinking...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
