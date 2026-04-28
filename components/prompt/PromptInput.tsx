'use client';

import { useRef, useEffect, useState, KeyboardEvent, useCallback } from 'react';
import { Send, Square, Paperclip, X, FileText, FileType, Sparkles, Music, Table, Presentation, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { ModelMode, AttachedImage, AttachedDocument } from '@/types';
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

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml',
  'yaml', 'yml', 'toml', 'ini', 'log', 'py', 'js', 'ts', 'tsx',
  'jsx', 'css', 'sh', 'bash', 'env', 'sql', 'rs', 'go', 'java',
  'c', 'cpp', 'h', 'rb', 'php', 'swift', 'kt', 'r',
]);
const OFFICE_EXTENSIONS = new Set(['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'aac', 'opus']);

type FileCategory = 'image' | 'pdf' | 'text' | 'office' | 'audio' | null;

function getFileCategory(file: File): FileCategory {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/')) return 'text';
  if (OFFICE_EXTENSIONS.has(ext)) return 'office';
  if (AUDIO_EXTENSIONS.has(ext) || file.type.startsWith('audio/')) return 'audio';
  return null;
}

interface PromptInputProps {
  onSubmit: (prompt: string, images: AttachedImage[], documents: AttachedDocument[]) => void;
  onStop?: () => void;
}

export function PromptInput({ onSubmit, onStop }: PromptInputProps) {
  const { selectedMode, prompt, isLoading, mockMode, setPrompt } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set());
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [ideas, setIdeas] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced question ideas as user types
  const fetchIdeas = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 15) { setIdeas([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/question-ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: value, mode: selectedMode }),
        });
        const { ideas: newIdeas } = await res.json();
        if (Array.isArray(newIdeas)) setIdeas(newIdeas);
      } catch { /* silent */ }
    }, 600);
  }, [selectedMode]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim(), images, documents);
    setImages([]);
    setDocuments([]);
    setEnhanced(false);
    setIdeas([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  async function handleEnhance() {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const { enhanced: result } = await res.json();
      if (result) {
        setPrompt(result);
        setEnhanced(true);
        setTimeout(() => setEnhanced(false), 3000);
      }
    } finally {
      setEnhancing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const category = getFileCategory(file);
      if (category === 'image') {
        const reader = new FileReader();
        reader.onload = () => {
          setImages((prev) => [
            ...prev,
            { id: generateId(), name: file.name, dataUrl: reader.result as string, mimeType: file.type },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (category === 'text') {
        const reader = new FileReader();
        reader.onload = () => {
          setDocuments((prev) => [
            ...prev,
            { id: generateId(), name: file.name, mimeType: file.type || 'text/plain', contentType: 'text', content: reader.result as string },
          ]);
        };
        reader.readAsText(file);
      } else if (category === 'pdf') {
        const reader = new FileReader();
        reader.onload = () => {
          setDocuments((prev) => [
            ...prev,
            { id: generateId(), name: file.name, mimeType: 'application/pdf', contentType: 'pdf', content: reader.result as string },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (category === 'office' || category === 'audio') {
        const id = generateId();
        // Add a placeholder chip immediately so user sees it's being processed
        setDocuments((prev) => [
          ...prev,
          { id, name: file.name, mimeType: file.type || 'application/octet-stream', contentType: 'text', content: '' },
        ]);
        setExtractingIds((prev) => new Set([...prev, id]));

        const endpoint = category === 'audio' ? '/api/transcribe' : '/api/extract-document';
        const fd = new FormData();
        fd.append('file', file);
        fetch(endpoint, { method: 'POST', body: fd })
          .then((r) => r.json())
          .then(({ text, error }) => {
            if (error || !text) {
              setDocuments((prev) => prev.filter((d) => d.id !== id));
            } else {
              setDocuments((prev) =>
                prev.map((d) => d.id === id ? { ...d, content: text } : d),
              );
            }
          })
          .catch(() => setDocuments((prev) => prev.filter((d) => d.id !== id)))
          .finally(() => setExtractingIds((prev) => { const next = new Set(prev); next.delete(id); return next; }));
      }
    });
    e.target.value = '';
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }

  const charCount = prompt.length;
  const maxChars = 4000;
  const isOverLimit = charCount > maxChars;
  const canSend = !isLoading && prompt.trim().length > 0 && !isOverLimit;

  return (
    <div className="space-y-2">
      {/* Question ideas */}
      {ideas.length > 0 && !isLoading && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {ideas.map((idea) => (
            <button
              key={idea}
              onClick={() => { setPrompt(idea); setIdeas([]); }}
              className="px-3 py-1 rounded-full text-xs border border-zinc-700 text-zinc-400 hover:border-indigo-500/60 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all text-left"
            >
              {idea}
            </button>
          ))}
        </div>
      )}

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

      {/* Document chips */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {documents.map((doc) => {
            const ext = doc.name.split('.').pop()?.toLowerCase() ?? '';
            const isExtracting = extractingIds.has(doc.id);
            const icon = doc.contentType === 'pdf'
              ? <FileType className="w-3.5 h-3.5 text-red-400 shrink-0" />
              : AUDIO_EXTENSIONS.has(ext)
                ? <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                : ['xlsx', 'xls', 'csv'].includes(ext)
                  ? <Table className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : ['pptx', 'ppt'].includes(ext)
                    ? <Presentation className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    : ['docx', 'doc'].includes(ext)
                      ? <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      : <File className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
            return (
              <div
                key={doc.id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs text-zinc-300 max-w-[130px] sm:max-w-[180px] group transition-colors',
                  isExtracting
                    ? 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
                    : 'bg-zinc-800 border-zinc-700',
                )}
              >
                {isExtracting
                  ? <div className="w-3.5 h-3.5 border border-zinc-500 border-t-indigo-400 rounded-full animate-spin shrink-0" />
                  : icon}
                <span className="truncate">{isExtracting ? 'Reading…' : doc.name}</span>
                {!isExtracting && (
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="ml-auto shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
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
          onChange={(e) => { setPrompt(e.target.value); fetchIdeas(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? 'Type your next message...' : PLACEHOLDERS[selectedMode]}
          rows={3}
          style={{ minHeight: '88px', maxHeight: '200px' }}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
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
                  title="Attach image, PDF, or document"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*"
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

          {/* Right: enhance + hint + stop/send */}
          <div className="flex items-center gap-2">
            {selectedMode === 'debate' && !isLoading && prompt.trim().length > 0 && (
              <button
                onClick={handleEnhance}
                disabled={enhancing}
                title="Sharpen this prompt for debate"
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150',
                  enhanced
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/10',
                )}
              >
                <Sparkles className={cn('w-3 h-3', enhancing && 'animate-pulse')} />
                {enhancing ? 'Enhancing…' : enhanced ? 'Enhanced ✓' : 'Enhance'}
              </button>
            )}
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
