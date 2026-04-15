'use client';

import { useState } from 'react';
import { Sparkles, PanelLeft, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useAuth, signOut } from '@/lib/auth';
import { LoginModal } from '@/components/auth/LoginModal';
import { AvatarUpload } from '@/components/auth/AvatarUpload';

export function Header() {
  const { mockMode, toggleSidebar } = useAppStore();
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    user?.user_metadata?.avatar_url as string | undefined
  );

  const displayName = (user?.user_metadata?.full_name as string | undefined)
    ?? user?.email
    ?? 'Account';
  const initials = displayName.slice(0, 2).toUpperCase();

  // Keep avatarUrl in sync if user metadata changes (e.g. after OAuth login)
  const currentAvatar = avatarUrl ?? (user?.user_metadata?.avatar_url as string | undefined);

  async function handleSignOut() {
    await signOut();
    setShowUserMenu(false);
  }

  return (
    <>
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

        {/* Center: mock mode */}
        <div className="flex items-center">
          {mockMode && (
            <Badge variant="warning" className="text-xs gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Mock Mode
            </Badge>
          )}
        </div>

        {/* Right: auth */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                {currentAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentAvatar} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[13px] font-semibold text-white">
                    {initials.slice(0, 1)}
                  </div>
                )}
                <span className="text-xs text-zinc-300 hidden sm:block max-w-[120px] truncate">
                  {displayName}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 px-3 py-3 border-b border-zinc-800">
                      <div className="relative shrink-0">
                        {currentAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={currentAvatar} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-semibold text-white">
                            {initials.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{displayName}</p>
                        {user.email && (
                          <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                        )}
                      </div>
                    </div>
                    {/* Change photo */}
                    <AvatarUpload user={user} onUpdated={(url) => setAvatarUrl(url)} />
                    {/* Sign out */}
                    <div className="border-t border-zinc-800">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button
              onClick={() => setShowLogin(true)}
              size="sm"
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              Sign in
            </Button>
          )}
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
