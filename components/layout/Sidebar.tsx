'use client';

import { Clock, Trash2, MessageSquare, Brain, Zap, Globe, Users, ImageIcon, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { formatTimestamp, truncateText } from '@/utils';
import type { ModelMode, HistoryEntry } from '@/types';
import { cn } from '@/lib/utils';

const MODE_ICONS: Record<ModelMode, React.ReactNode> = {
  auto: <Sparkles className="w-3 h-3" />,
  chatgpt: <MessageSquare className="w-3 h-3" />,
  claude: <Brain className="w-3 h-3" />,
  gemini: <Zap className="w-3 h-3" />,
  perplexity: <Globe className="w-3 h-3" />,
  debate: <Users className="w-3 h-3" />,
  image: <ImageIcon className="w-3 h-3" />,
};

const MODE_COLORS: Record<ModelMode, string> = {
  auto: 'purple',
  chatgpt: 'success',
  claude: 'orange',
  gemini: 'info',
  perplexity: 'cyan',
  debate: 'pink',
  image: 'warning',
};

function HistoryItem({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
          {formatTimestamp(entry.timestamp)}
        </span>
        <Badge
          variant={MODE_COLORS[entry.mode] as 'purple' | 'success' | 'orange' | 'info' | 'cyan' | 'pink' | 'warning'}
          className="flex items-center gap-1 text-[10px] px-1.5 py-0 shrink-0"
        >
          {MODE_ICONS[entry.mode]}
          {entry.mode}
        </Badge>
      </div>
      <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors leading-snug">
        {truncateText(entry.prompt, 60)}
      </p>
    </button>
  );
}

export function Sidebar() {
  const { sidebarOpen, history, toggleSidebar, clearHistory, setPrompt, setResult } = useAppStore();

  return (
    <>
      {/* Overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full z-30 w-[280px] bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:z-auto',
          sidebarOpen ? 'lg:translate-x-0 lg:flex' : 'lg:-translate-x-full lg:hidden',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-300">
            <Clock className="w-4 h-4" />
            <span className="font-medium text-sm">History</span>
            {history.length > 0 && (
              <span className="text-xs text-zinc-500">({history.length})</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="w-7 h-7 text-zinc-500 hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* History list */}
        <ScrollArea className="flex-1 px-2 py-2">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">No history yet</p>
              <p className="text-xs text-zinc-600 mt-1">Your conversations will appear here</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {history.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onClick={() => {
                    setPrompt(entry.prompt);
                  }}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3 border-t border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-500/10 gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear history
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
