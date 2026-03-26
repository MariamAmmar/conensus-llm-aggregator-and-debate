'use client';

import { Sparkles, Settings, Github, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';

export function Header() {
  const { mockMode, toggleSidebar, toggleSettings } = useAppStore();

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Left: sidebar toggle + app name */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-zinc-400 hover:text-zinc-100"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="font-semibold text-zinc-100 text-sm">Consensus AI</span>
        </div>
      </div>

      {/* Center: mock mode indicator */}
      <div className="flex items-center">
        {mockMode && (
          <Badge variant="warning" className="text-xs gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            Mock Mode
          </Badge>
        )}
      </div>

      {/* Right: settings + github */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSettings}
          className="text-zinc-400 hover:text-zinc-100"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="text-zinc-400 hover:text-zinc-100"
        >
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </Button>
      </div>
    </header>
  );
}
