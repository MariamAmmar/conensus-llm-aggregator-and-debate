'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { getMockResult } from '@/lib/mock-data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ModelSelector } from '@/components/prompt/ModelSelector';
import { PromptInput } from '@/components/prompt/PromptInput';
import { OutputPanel } from '@/components/output/OutputPanel';
import { Sparkles, AlertCircle } from 'lucide-react';
import type { HistoryEntry, AppResult, ChatTurn, AttachedImage, AttachedDocument } from '@/types';
import { generateId } from '@/utils';

const ROTATING_PROMPTS = [
  'Write a passive-aggressive note from my phone battery to me',
  'Explain blockchain to a golden retriever',
  'Write a dramatic movie trailer for doing laundry',
  'If AI became sentient, what\'s the first thing it would complain about?',
  'Roast my life choices — I use AI for everything',
  'Write a breakup letter from my WiFi router to me',
  'What would a robot therapist say to a stressed-out toaster?',
  'Explain the meaning of life but make it about pizza',
  'Write a performance review for the sun',
  'If Monday had a Yelp review, what would it say?',
];

export default function Home() {
  const {
    selectedMode,
    selectedImageProvider,
    isLoading,
    chatTurns,
    mockMode,
    conversation,
    providerConversations,
    debateConversation,
    setLoading,
    addTurn,
    updateTurn,
    clearTurns,
    addHistoryEntry,
    addConversationTurn,
    clearConversation,
    addProviderTurn,
    clearProviderConversations,
    addDebateTurn,
    clearDebateConversation,
    setPrompt,
    saveSession,
    syncSessionsFromDB,
    userMemory,
    mergeMemoryFacts,
  } = useAppStore();

  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Pick a new funny prompt on each page load (after hydration to avoid SSR mismatch)
  const [rotatingPrompt, setRotatingPrompt] = useState(ROTATING_PROMPTS[0]);
  useEffect(() => {
    setRotatingPrompt(ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)]);
  }, []);

  // Sync sessions on load and whenever auth state changes (login/logout)
  useEffect(() => {
    syncSessionsFromDB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-save current session whenever chatTurns changes (after each completed turn)
  useEffect(() => {
    const completedTurns = chatTurns.filter((t) => !t.loading);
    if (completedTurns.length === 0) return;
    saveSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTurns]);

  // Save on page close/refresh
  useEffect(() => {
    function handleUnload() {
      if (chatTurns.length > 0) saveSession();
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTurns]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatTurns]);

  function handleStop() {
    abortRef.current?.abort();
    // Mark the in-progress turn as stopped
    const loadingTurn = chatTurns.findLast((t) => t.loading);
    if (loadingTurn) {
      updateTurn(loadingTurn.id, { loading: false, error: 'Stopped.' });
    }
    setLoading(false);
  }

  async function handleSubmit(submittedPrompt: string, images: AttachedImage[], documents: AttachedDocument[]) {
    if (!submittedPrompt.trim() || isLoading) return;

    const turnId = generateId();
    const newTurn: ChatTurn = {
      id: turnId,
      prompt: submittedPrompt,
      images,
      documents,
      mode: selectedMode,
      result: null,
      error: null,
      loading: true,
    };

    addTurn(newTurn);
    setLoading(true);
    setPrompt('');

    abortRef.current = new AbortController();

    try {
      if (mockMode) {
        const result = await getMockResult(submittedPrompt, selectedMode);
        updateTurn(turnId, { result, loading: false });
        const historyEntry: HistoryEntry = {
          id: result.id,
          prompt: submittedPrompt,
          mode: selectedMode,
          finalAnswer: result.finalAnswer,
          imageUrl: result.imageResult?.url,
          timestamp: result.timestamp,
          routerCategory: result.routerDecision?.category,
          selectedProvider: result.routerDecision?.selectedModel,
        };
        addHistoryEntry(historyEntry);
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            prompt: submittedPrompt,
            mode: selectedMode,
            imageProvider: selectedImageProvider,
            history: conversation,
            providerConversations,
            debateConversation,
            images,
            documents,
            userMemory: userMemory.map((f) => f.fact),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Request failed');

        const result: AppResult = { ...data, timestamp: new Date(data.timestamp) };
        updateTurn(turnId, { result, loading: false });

        if (selectedMode === 'all') {
          for (const response of result.responses) {
            if (response.content && !response.error) {
              addProviderTurn(response.provider, submittedPrompt, response.content);
            }
          }
        } else if (selectedMode === 'debate' && result.finalAnswer) {
          addDebateTurn(submittedPrompt, result.finalAnswer);
        } else if (selectedMode !== 'image' && result.finalAnswer) {
          addConversationTurn(submittedPrompt, result.finalAnswer);
        }

        const historyEntry: HistoryEntry = {
          id: result.id,
          prompt: submittedPrompt,
          mode: selectedMode,
          finalAnswer: result.finalAnswer,
          imageUrl: result.imageResult?.url,
          timestamp: result.timestamp,
          routerCategory: result.routerDecision?.category,
          selectedProvider: result.routerDecision?.selectedModel,
        };
        addHistoryEntry(historyEntry);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Submit error:', err);
      updateTurn(turnId, {
        error: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        loading: false,
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleNewConversation() {
    // Extract memory facts from the current session before clearing (fire and forget)
    const completedTurns = chatTurns.filter((t) => t.result && !t.error);
    if (completedTurns.length > 0) {
      const turns = completedTurns.map((t) => ({
        prompt: t.prompt,
        response: t.result?.finalAnswer ?? t.result?.responses[0]?.content ?? '',
      }));
      fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns }),
      })
        .then((r) => r.json())
        .then(({ facts }) => { if (facts?.length) mergeMemoryFacts(facts); })
        .catch(() => {});
    }
    saveSession();
    clearTurns();
    setPrompt('');
    clearConversation();
    clearProviderConversations();
    clearDebateConversation();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        {chatTurns.length === 0 ? (
          /* ── Empty state: input centered in the page ── */
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-3xl space-y-6">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-semibold text-zinc-100">Ask anything.</h2>
                <p className="text-zinc-400 max-w-sm mx-auto">
                  Get the best answer from the best AI model, automatically routed.
                </p>
              </div>

              <ModelSelector />
              <PromptInput onSubmit={handleSubmit} onStop={handleStop} />

              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'What can you do?',
                  'Who is Mariam?',
                  'What are the latest AI developments?',
                  rotatingPrompt,
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setPrompt(example)}
                    className="px-3 py-1.5 text-sm rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Active conversation: messages scroll, input fixed at bottom ── */
          <>
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
                {chatTurns.map((turn) => (
                  <div key={turn.id} className="space-y-4">
                    {/* User bubble */}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] space-y-2">
                        {turn.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-end">
                            {turn.images.map((img) => (
                              <img
                                key={img.id}
                                src={img.dataUrl}
                                alt={img.name}
                                className="w-32 h-32 object-cover rounded-xl border border-zinc-700"
                              />
                            ))}
                          </div>
                        )}
                        <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-sm leading-relaxed whitespace-pre-wrap">
                          {turn.prompt}
                        </div>
                      </div>
                    </div>

                    {/* Loading */}
                    {turn.loading && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="relative w-8 h-8 shrink-0">
                          <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                          <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                        </div>
                        <p className="text-zinc-400 text-sm">
                          {turn.mode === 'debate' ? 'Running debate across all models...'
                            : turn.mode === 'auto' ? 'Routing to best model...'
                            : turn.mode === 'image' ? 'Generating image...'
                            : turn.mode === 'all' ? 'Querying all models...'
                            : 'Thinking...'}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {turn.error && (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-400">{turn.error}</p>
                      </div>
                    )}

                    {/* Result */}
                    {turn.result && (
                      <OutputPanel result={turn.result} />
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </main>

            <div className="bg-zinc-950 pb-6 pt-3 border-t border-zinc-800/60">
              <div className="max-w-3xl mx-auto px-4 space-y-3">
                <ModelSelector />
                <PromptInput onSubmit={handleSubmit} onStop={handleStop} />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
