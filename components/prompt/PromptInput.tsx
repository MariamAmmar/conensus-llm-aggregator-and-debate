'use client';

import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { Send, Square, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { ModelMode, AttachedImage } from '@/types';
import { generateId } from '@/utils';

const PLACEHOLDERS: Record<ModelMode, string> = {
  auto: "Ask anything — I'll find the best model for your question...",
  chatgpt: 'Write a prompt for ChatGPT...',
  claude: 'Ask Claude a reasoning or analysis question...',
  gemini: 'Ask Gemini a question...',
  perplexity: 'Search the web with Perplexity...',
  grok: 'Ask Grok — great for current events and X/Twitter data...',
  llama: "Ask Llama 4 — Meta's open-weight multimodal model...",
  o4mini: 'Ask o4-mini — fast reasoning model for math, logic, and code...',
  deepseek: 'Ask DeepSeek R1 — reasoning model that thinks step by step...',
  all: 'Ask all models simultaneously...',
  debate: 'Enter a topic for all models to debate...',
  image: 'Describe the image you want to generate...',
};

interface PromptInputProps {
  onSubmit: (prompt: string, images: AttachedImage[]) => void;
  onStop?: () => void;
}

export function PromptInput({ onSubmit, onStop }: PromptInputProps) {
  const { selectedMode, prompt, isLoading, mockMode, setPrompt } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<AttachedImage[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [prompt]);

  // Focus on mode change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [selectedMode]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim(), images);
    setImages([]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImages((prev) => [
          ...prev,
          { id: generateId(), name: file.name, dataUrl, mimeType: file.type },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset so same file can be re-attached
    e.target.value = '';
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  const charCount = prompt.length;
  const maxChars = 4000;
  const isOverLimit = charCount > maxChars;
  const canSend = !isLoading && prompt.trim().length > 0 && !isOverLimit;

  return (
    <div className="space-y-2">
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5 text-zinc-300" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'relative rounded-2xl border bg-zinc-900 transition-all duration-150',
          isLoading
            ? 'border-zinc-700'
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
          style={{ minHeight: '88px', maxHeight: '200px' }}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed"
          aria-label="Prompt input"
        />

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 border-t border-zinc-800">
          {/* Left: attach + char count + mock */}
          <div className="flex items-center gap-2">
            {selectedMode !== 'image' && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach image"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
            <span
              className={cn(
                'text-xs',
                isOverLimit ? 'text-red-400' : charCount > maxChars * 0.8 ? 'text-amber-400' : 'text-zinc-600',
              )}
            >
              {charCount.toLocaleString()}/{maxChars.toLocaleString()}
            </span>
            {mockMode && (
              <span className="text-[10px] text-amber-500/70 font-medium uppercase tracking-wide">Mock</span>
            )}
          </div>

          {/* Right: hint + stop/send */}
          <div className="flex items-center gap-2">
            {!isLoading && (
              <span className="hidden sm:block text-[10px] text-zinc-600">Shift+↵ for newline</span>
            )}
            {isLoading ? (
              <Button
                onClick={onStop}
                size="sm"
                className="h-7 px-3 gap-1.5 text-xs bg-zinc-700 hover:bg-red-600 text-zinc-300 hover:text-white transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSend}
                size="sm"
                className={cn(
                  'h-7 px-3 gap-1.5 text-xs',
                  canSend
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
                )}
              >
                <Send className="w-3 h-3" />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
