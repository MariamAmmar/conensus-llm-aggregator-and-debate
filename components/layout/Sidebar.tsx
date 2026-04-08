'use client';

import { Trash2, MessageSquare, Brain, Zap, Globe, Users, ImageIcon, Sparkles, X, Plus, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { formatTimestamp, truncateText } from '@/utils';
import type { ModelMode, ChatSession } from '@/types';
import { cn } from '@/lib/utils';

const MODE_ICONS: Record<ModelMode, React.ReactNode> = {
  auto: <Sparkles className="w-3 h-3" />,
  chatgpt: <MessageSquare className="w-3 h-3" />,
  claude: <Brain className="w-3 h-3" />,
  gemini: <Zap className="w-3 h-3" />,
  perplexity: <Globe className="w-3 h-3" />,
  all: <LayoutGrid className="w-3 h-3" />,
  debate: <Users className="w-3 h-3" />,
  image: <ImageIcon className="w-3 h-3" />,
};

const MODE_COLORS: Record<ModelMode, string> = {
  auto: 'text-violet-400',
  chatgpt: 'text-emerald-400',
  claude: 'text-orange-400',
  gemini: 'text-blue-400',
  perplexity: 'text-cyan-400',
  all: 'text-violet-400',
  debate: 'text-pink-400',
  image: 'text-amber-400',
};

function SessionItem({
  session,
  onLoad,
  onDelete,
}: {
  session: ChatSession;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-lg hover:bg-zinc-800/60 transition-colors">
      <button onClick={onLoad} className="w-full text-left px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn('shrink-0', MODE_COLORS[session.mode])}>
            {MODE_ICONS[session.mode]}
          </span>
          <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
            {formatTimestamp(session.timestamp)}
          </span>
        </div>
        <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors leading-snug pr-6">
          {truncateText(session.title, 55)}
        </p>
        {session.turns.length > 1 && (
          <p className="text-xs text-zinc-600 mt-0.5">{session.turns.length} messages</p>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-600 hover:text-red-400"
        title="Delete"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export function Sidebar() {
  const {
    sidebarOpen,
    sessions,
    toggleSidebar,
    loadSession,
    deleteSession,
    saveSession,
    clearTurns,
    setPrompt,
    clearConversation,
    clearProviderConversations,
    clearDebateConversation,
    chatTurns,
  } = useAppStore();

  function handleNewChat() {
    if (chatTurns.length > 0) saveSession();
    clearTurns();
    setPrompt('');
    clearConversation();
    clearProviderConversations();
    clearDebateConversation();
  }

  function handleLoad(id: string) {
    if (chatTurns.length > 0) saveSession();
    loadSession(id);
  }

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
          'flex flex-col w-[260px] shrink-0 bg-zinc-900 border-r border-zinc-800',
          // Mobile: fixed overlay; Desktop: in-flow (always visible)
          'fixed left-0 top-0 h-full z-30 transition-transform duration-200 ease-out lg:static lg:z-auto lg:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Prevent click-through when off-screen on mobile
          !sidebarOpen && 'pointer-events-none lg:pointer-events-auto',
        )}
      >
        {/* New Chat button */}
        <div className="p-3 border-b border-zinc-800">
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm h-9"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Sessions list */}
        <ScrollArea className="flex-1 px-2 py-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-sm text-zinc-500">No previous chats</p>
              <p className="text-xs text-zinc-600 mt-1">Start a conversation to save history</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  onLoad={() => handleLoad(session.id)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Close button on mobile */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        >
          <X className="w-4 h-4" />
        </button>
      </aside>
    </>
  );
}
