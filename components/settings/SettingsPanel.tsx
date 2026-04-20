'use client';

import { useState, useEffect } from 'react';
import { X, Brain, Trash2, Settings2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function SettingsPanel() {
  const { settingsOpen, toggleSettings, userMemory, userPreferences, removeMemoryFact, clearMemory, setUserPreferences } = useAppStore();
  const [prefsText, setPrefsText] = useState(userPreferences);
  const [saved, setSaved] = useState(false);

  // Sync if opened with external changes
  useEffect(() => { setPrefsText(userPreferences); }, [userPreferences, settingsOpen]);

  function handleSavePrefs() {
    setUserPreferences(prefsText.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settingsOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={toggleSettings} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-zinc-100 text-sm">Settings</span>
          </div>
          <button onClick={toggleSettings} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {/* Preferences */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Your preferences</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Tell the AI how you want it to respond. Applied to every message.</p>
            </div>
            <textarea
              value={prefsText}
              onChange={(e) => setPrefsText(e.target.value)}
              placeholder={"Examples:\n• Always be concise and direct\n• I'm a software engineer — use technical terms\n• Respond in bullet points when listing things\n• Keep answers under 3 paragraphs"}
              rows={7}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 px-3 py-2.5 resize-none focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
            <button
              onClick={handleSavePrefs}
              className={cn(
                'w-full py-2 rounded-lg text-sm font-medium transition-all',
                saved
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white',
              )}
            >
              {saved ? '✓ Saved' : 'Save preferences'}
            </button>
          </section>

          {/* Memory */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-indigo-400" />
                  What the app remembers
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Facts learned from your past conversations.</p>
              </div>
              {userMemory.length > 0 && (
                <button
                  onClick={clearMemory}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {userMemory.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No memories yet — they build up as you chat.</p>
            ) : (
              <ul className="space-y-1.5">
                {userMemory.map((fact) => (
                  <li
                    key={fact.fact}
                    className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 group"
                  >
                    <span className="text-xs text-zinc-300 leading-relaxed flex-1">{fact.fact}</span>
                    <button
                      onClick={() => removeMemoryFact(fact.fact)}
                      className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
