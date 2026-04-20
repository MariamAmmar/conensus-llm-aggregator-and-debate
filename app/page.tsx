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
import { LoginModal } from '@/components/auth/LoginModal';
import { TrialModal } from '@/components/auth/TrialModal';
import { Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import type { HistoryEntry, AppResult, ChatTurn, AttachedImage, AttachedDocument } from '@/types';
import { generateId } from '@/utils';
import { formatResponseContent } from '@/components/output/ResponseCard';

const DEBATE_PROMPTS = [
  'Will AI take most jobs in the next 10 years?',
  'Is nuclear power the best solution to climate change?',
  'Should social media be banned for under-16s?',
  'Is crypto a legitimate currency or an elaborate scam?',
  'Will AGI be built within the next 5 years?',
  'Does remote work hurt or help productivity?',
  'Is universal basic income a good idea?',
  'Should there be a global body regulating AI?',
  'Is capitalism the best economic system humanity has found?',
  'Will humans live on Mars within 30 years?',
  'Does social media do more harm than good to society?',
  'Is it ethical to eat meat in 2025?',
];

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
    selectedModels,
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

  const { user, session } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  // Pick a new funny prompt on each page load (after hydration to avoid SSR mismatch)
  const [rotatingPrompt, setRotatingPrompt] = useState(ROTATING_PROMPTS[0]);
  const [debatePrompts, setDebatePrompts] = useState(() => DEBATE_PROMPTS.slice(0, 4));
  useEffect(() => {
    setRotatingPrompt(ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)]);
    const shuffled = [...DEBATE_PROMPTS].sort(() => Math.random() - 0.5);
    setDebatePrompts(shuffled.slice(0, 4));
  }, []);

  // Sync sessions on load and whenever auth state changes (login/logout)
  // Also save current in-progress chat so it merges into the account on login
  useEffect(() => {
    if (user?.id && chatTurns.length > 0) saveSession();
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

  // Handle Stripe redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentSuccess(true);
      window.history.replaceState({}, '', '/');
      setTimeout(() => setPaymentSuccess(false), 5000);
    }
  }, []);

  function handleStop() {
    abortRef.current?.abort();
    const loadingTurn = chatTurns.findLast((t) => t.loading);
    if (loadingTurn) {
      updateTurn(loadingTurn.id, { loading: false, error: 'Stopped.' });
      setStreamingContent((prev) => { const next = { ...prev }; delete next[loadingTurn.id]; return next; });
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
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        // Streaming: single-model and auto modes (not debate/all/image/multi-select)
        const canStream = selectedMode !== 'debate' && selectedMode !== 'all' && selectedMode !== 'image' && selectedModels.length <= 1;

        if (canStream) {
          const streamStart = Date.now();
          const res = await fetch('/api/chat/stream', {
            method: 'POST', headers, signal: abortRef.current.signal,
            body: JSON.stringify({ prompt: submittedPrompt, mode: selectedMode, history: conversation, images, userMemory: userMemory.map((f) => f.fact) }),
          });

          // Auth/limit errors arrive as JSON before the stream
          if (!res.ok) {
            const data = await res.json();
            if (res.status === 429 && data.code === 'LIMIT_REACHED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowLoginGate(true); return; }
            if (res.status === 402 && data.code === 'SUBSCRIPTION_REQUIRED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowTrialModal(true); return; }
            // Image route or other — fall through to main route
            if (data.error?.toLowerCase().includes('image')) throw new Error('image-fallback');
            throw new Error(data.message || data.error || 'Request failed');
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let accumulated = '';

          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';
            for (const part of parts) {
              if (!part.startsWith('data: ')) continue;
              const msg = JSON.parse(part.slice(6));
              if (msg.error) throw new Error(msg.error);
              if (msg.done) {
                const result: AppResult = {
                  id: turnId, prompt: submittedPrompt, mode: selectedMode,
                  routerDecision: msg.routerDecision,
                  responses: [{ provider: msg.provider, content: accumulated, latencyMs: msg.latencyMs, isGrounded: false }],
                  debateResult: null, finalAnswer: accumulated, imageResult: null,
                  timestamp: new Date(), durationMs: Date.now() - streamStart,
                };
                updateTurn(turnId, { result, loading: false });
                setStreamingContent((prev) => { const next = { ...prev }; delete next[turnId]; return next; });
                addConversationTurn(submittedPrompt, accumulated);
                addHistoryEntry({ id: turnId, prompt: submittedPrompt, mode: selectedMode, finalAnswer: accumulated, timestamp: new Date(), routerCategory: msg.routerDecision?.category, selectedProvider: msg.provider });
                break outer;
              } else if (msg.t) {
                accumulated += msg.t;
                setStreamingContent((prev) => ({ ...prev, [turnId]: accumulated }));
              }
            }
          }
        } else {
          // Non-streaming: debate, all-models, image, multi-select
          const res = await fetch('/api/chat', {
            method: 'POST', headers, signal: abortRef.current.signal,
            body: JSON.stringify({ prompt: submittedPrompt, mode: selectedMode, imageProvider: selectedImageProvider, history: conversation, providerConversations, debateConversation, images, documents, userMemory: userMemory.map((f) => f.fact), selectedModels }),
          });
          const data = await res.json();
          if (res.status === 429 && data.code === 'LIMIT_REACHED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowLoginGate(true); return; }
          if (res.status === 402 && data.code === 'SUBSCRIPTION_REQUIRED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowTrialModal(true); return; }
          if (!res.ok) throw new Error(data.message || data.error || 'Request failed');

          const result: AppResult = { ...data, timestamp: new Date(data.timestamp) };
          updateTurn(turnId, { result, loading: false });

          if (selectedMode === 'all') {
            const firstResponse = result.responses.find((r) => r.content && !r.error);
            if (firstResponse) addConversationTurn(submittedPrompt, firstResponse.content);
          } else if (selectedMode !== 'image' && result.finalAnswer) {
            addConversationTurn(submittedPrompt, result.finalAnswer);
          }

          addHistoryEntry({ id: result.id, prompt: submittedPrompt, mode: selectedMode, finalAnswer: result.finalAnswer, imageUrl: result.imageResult?.url, timestamp: result.timestamp, routerCategory: result.routerDecision?.category, selectedProvider: result.routerDecision?.selectedModel });
        }
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
    <div className="flex h-screen-safe overflow-hidden bg-zinc-950">
      {showLoginGate && (
        <LoginModal onClose={() => setShowLoginGate(false)} />
      )}
      {showTrialModal && session?.access_token && (
        <TrialModal
          accessToken={session.access_token}
          onClose={() => setShowTrialModal(false)}
        />
      )}
      {paymentSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm shadow-xl">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Trial started! You now have unlimited access for 7 days.
        </div>
      )}
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

              {selectedMode === 'debate' ? (
                <div className="space-y-2">
                  <p className="text-xs text-center text-pink-400/70 font-medium uppercase tracking-wide">Try a question the models might disagree on</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {debatePrompts.map((example) => (
                      <button
                        key={example}
                        onClick={() => setPrompt(example)}
                        className="px-3 py-1.5 text-sm rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300/80 hover:text-pink-200 hover:border-pink-500/40 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
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
              )}
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
                      streamingContent[turn.id] ? (
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words response-content">
                          <div dangerouslySetInnerHTML={{ __html: formatResponseContent(streamingContent[turn.id]) }} />
                          <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 -mb-0.5" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 py-2">
                          <div className="relative w-8 h-8 shrink-0">
                            <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                            <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                          </div>
                          <p className="text-zinc-400 text-sm">
                            {turn.mode === 'debate' ? 'Running debate across all models...'
                              : turn.mode === 'image' ? 'Generating image...'
                              : turn.mode === 'all' ? 'Querying all models...'
                              : 'Thinking...'}
                          </p>
                        </div>
                      )
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

            <div className="bg-zinc-950 pb-6 pt-3 border-t border-zinc-800/60" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
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
