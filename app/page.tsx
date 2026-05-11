'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getMockResult } from '@/lib/mock-data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ModelSelector } from '@/components/prompt/ModelSelector';
import { PromptInput } from '@/components/prompt/PromptInput';
import { OutputPanel } from '@/components/output/OutputPanel';
import { LoginModal } from '@/components/auth/LoginModal';
import { TrialModal } from '@/components/auth/TrialModal';
import { Sparkles, AlertCircle, CheckCircle, RotateCcw, FileDown } from 'lucide-react';
import type { HistoryEntry, AppResult, ChatTurn, AttachedImage, AttachedDocument, ModelResponse, ResponseScore, ProviderId, DebateResult } from '@/types';
import { generateId } from '@/utils';
import { DebateProgress } from '@/components/output/DebateProgress';
import { FollowUpQuestions } from '@/components/output/FollowUpQuestions';
import { MarkdownContent } from '@/components/output/MarkdownContent';
import { ResponseCard } from '@/components/output/ResponseCard';
import { WelcomeTour } from '@/components/onboarding/WelcomeTour';

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
    removeTurn,
    clearTurns,
    addHistoryEntry,
    addConversationTurn,
    clearConversation,
    clearProviderConversations,
    addDebateTurn,
    clearDebateConversation,
    setPrompt,
    saveSession,
    syncSessionsFromDB,
    syncLocalSessionsToDB,
    claimIpSessions,
    userMemory,
    userPreferences,
    mergeMemoryFacts,
    setSessionTitle,
  } = useAppStore();

  const { user, session } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [streamingDebate, setStreamingDebate] = useState<{
    stage: 'collecting' | 'scoring' | 'synthesizing';
    responses: ModelResponse[];
    synthesisContent: string;
  } | null>(null);
  const [scrapingUrls, setScrapingUrls] = useState(false);
  const [loadingFollowups, setLoadingFollowups] = useState<Set<string>>(new Set());
  // Pick a new funny prompt on each page load (after hydration to avoid SSR mismatch)
  const [rotatingPrompt, setRotatingPrompt] = useState(ROTATING_PROMPTS[0]);
  const [debatePrompts, setDebatePrompts] = useState(() => DEBATE_PROMPTS.slice(0, 4));
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    setRotatingPrompt(ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)]);
    const shuffled = [...DEBATE_PROMPTS].sort(() => Math.random() - 0.5);
    setDebatePrompts(shuffled.slice(0, 4));
    // Show tour automatically on first ever visit
    if (!localStorage.getItem('consensus-tour-seen')) setShowTour(true);
  }, []);

  // Sync sessions on load and whenever auth state changes (login/logout)
  useEffect(() => {
    if (user?.id && chatTurns.length > 0) saveSession();

    const token = session?.access_token;
    if (user?.id && token) {
      // On login: claim pre-login (IP-based) sessions first so the subsequent DB fetch
      // sees them attributed to this user — avoids a race where sync wins the claim.
      claimIpSessions(token).then(() => {
        syncLocalSessionsToDB(token);
        syncSessionsFromDB();
      });

      // Restore memory from Supabase user account (doesn't need to wait for session claim)
      const saved = user.user_metadata?.memory_facts as import('@/types').MemoryFact[] | undefined;
      if (Array.isArray(saved) && saved.length > 0) mergeMemoryFacts(saved);
      const currentMemory = useAppStore.getState().userMemory;
      if (currentMemory.length > 0) {
        supabase.auth.updateUser({ data: { memory_facts: currentMemory.slice(0, 15) } }).catch(() => {});
      }
    } else {
      // Logged out or no token — fetch anonymous sessions keyed by null user_id
      syncSessionsFromDB();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-save whenever the tab becomes visible again (catches saves missed while tab was hidden)
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && chatTurns.some((t) => !t.loading)) saveSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTurns]);

  // Sync memory to Supabase whenever it changes (debounced, logged-in only).
  // Only write the 15 most recent facts into user_metadata — the full list lives in
  // localStorage (Zustand persist). Storing all 100 facts in user_metadata bloats the
  // JWT to 30-35KB, which makes every Authorization header exceed Node's size limit (431).
  useEffect(() => {
    if (!user?.id || userMemory.length === 0) return;
    const t = setTimeout(() => {
      supabase.auth.updateUser({ data: { memory_facts: userMemory.slice(0, 15) } }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMemory, user?.id]);

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

  // Keep the response in view as it streams in — only auto-advances if the user is near the bottom
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [streamingContent, streamingDebate?.synthesisContent]);

  // Handle Stripe redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentSuccess(true);
      window.history.replaceState({}, '', '/');
      setTimeout(() => setPaymentSuccess(false), 5000);
    }
  }, []);

  function runPostTurnAgents(turnId: string, userPrompt: string, assistantResponse: string, isFirstTurn: boolean) {
    if (!userPrompt.trim() || !assistantResponse.trim()) return;
    const body = (data: object) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

    // Memory extraction — include recent turns so follow-up questions have context.
    // A single isolated prompt like "what about the counter-argument?" is meaningless
    // without knowing what topic was being debated. Pass up to 4 completed turns.
    const completedTurns = useAppStore.getState().chatTurns
      .filter((t) => !t.loading && t.result && !t.error)
      .slice(-4)
      .map((t) => ({
        prompt: t.prompt,
        // Cap each response at 600 chars — memory extraction needs topic context, not verbatim text
        response: (t.result!.finalAnswer || t.result!.responses?.find((r) => r.content && !r.error)?.content || '').slice(0, 600),
      }))
      .filter((t) => t.prompt.trim() && t.response.trim());
    const alreadyHasCurrent = completedTurns.some((t) => t.prompt === userPrompt);
    const memoryTurns = alreadyHasCurrent
      ? completedTurns
      : [...completedTurns, { prompt: userPrompt, response: assistantResponse.slice(0, 600) }].slice(-4);

    fetch('/api/memory', body({ turns: memoryTurns }))
      .then((r) => r.json()).then(({ facts }) => { if (facts?.length) mergeMemoryFacts(facts); }).catch(() => {});

    // Follow-up questions
    setLoadingFollowups((prev) => new Set([...prev, turnId]));
    fetch('/api/followup', body({ prompt: userPrompt, response: assistantResponse }))
      .then((r) => r.json())
      .then(({ questions }) => { if (questions?.length) updateTurn(turnId, { followupQuestions: questions }); })
      .catch(() => {})
      .finally(() => setLoadingFollowups((prev) => { const next = new Set(prev); next.delete(turnId); return next; }));

    // Fact-check (single/auto responses only — skip debate/all/image)
    fetch('/api/factcheck', body({ response: assistantResponse }))
      .then((r) => r.json()).then((fc) => { if (fc) updateTurn(turnId, { factCheck: fc }); }).catch(() => {});

    // Title agent — runs on turn 1 (initial title) and every 3 turns (topic-aware refresh)
    // Uses all prompts so far so the title reflects the full conversation, not just the opener.
    // Works for both logged-in and anonymous users — title is persisted with the session.
    const allTurns = useAppStore.getState().chatTurns;
    const completedCount = allTurns.filter((t) => !t.loading).length;
    const shouldRetitle = isFirstTurn || completedCount % 3 === 0;
    if (shouldRetitle) {
      const prompts = allTurns
        .filter((t) => t.prompt?.trim())
        .map((t) => t.prompt);
      if (userPrompt.trim() && !prompts.includes(userPrompt)) prompts.push(userPrompt);
      fetch('/api/title', body({ prompts }))
        .then((r) => r.json()).then(({ title }) => { if (title) setSessionTitle(title); }).catch(() => {});
    }
  }

  function isDocumentResponse(content: string | null | undefined): boolean {
    if (!content || content.length < 600) return false;
    const hasHeaders = /^#{1,3}\s+\S/m.test(content);
    const hasKeywords = /\b(resume|cv|cover letter|report|proposal|brief|memo|essay|article|business plan|executive summary|white\s*paper|case study)\b/i.test(content);
    return hasHeaders && hasKeywords;
  }

  function downloadResponseAsPdf(turnId: string, promptText: string) {
    const el = document.getElementById(`result-${turnId}`);
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const safeTitle = promptText.slice(0, 80).replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]!));
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #18181b; background: white; line-height: 1.65; font-size: 15px; }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 1.5em 0 0.5em; color: #09090b; }
  h2 { font-size: 1.25rem; font-weight: 600; margin: 1.5em 0 0.5em; color: #09090b; }
  h3 { font-size: 1.1rem; font-weight: 600; margin: 1.25em 0 0.5em; color: #09090b; }
  p { margin: 0.65em 0; }
  ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }
  code { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 0.85em; background: #f4f4f5; color: #18181b; padding: 0.15em 0.4em; border-radius: 3px; }
  pre { background: #f4f4f5; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 1em 0; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #a1a1aa; margin: 1em 0; padding: 0.5em 1em; color: #52525b; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e4e4e7; padding: 8px 12px; text-align: left; }
  th { background: #f9f9f9; font-weight: 600; }
  hr { border: none; border-top: 1px solid #e4e4e7; margin: 1.5em 0; }
  a { color: #4f46e5; }
  strong { font-weight: 600; }
  /* Override Tailwind dark-theme colours */
  .text-zinc-100, .text-zinc-200, .text-zinc-300 { color: #18181b !important; }
  .text-zinc-400, .text-zinc-500 { color: #52525b !important; }
  .text-zinc-600 { color: #71717a !important; }
  .text-white { color: #18181b !important; }
  .bg-zinc-700, .bg-zinc-800, .bg-zinc-900, .bg-zinc-950 { background: #f4f4f5 !important; }
  .border-zinc-700, .border-zinc-800 { border-color: #e4e4e7 !important; }
  .text-amber-300, .text-amber-400 { color: #b45309 !important; }
  .text-emerald-300, .text-emerald-400 { color: #059669 !important; }
  .text-indigo-300, .text-indigo-400 { color: #4338ca !important; }
  .text-pink-300, .text-pink-400 { color: #be185d !important; }
  .text-red-400 { color: #dc2626 !important; }
  .text-blue-400 { color: #2563eb !important; }
  .text-orange-400 { color: #ea580c !important; }
  .text-rose-400 { color: #e11d48 !important; }
  .text-cyan-400 { color: #0891b2 !important; }
  .text-lime-400 { color: #65a30d !important; }
  .text-sky-400 { color: #0284c7 !important; }
  .text-violet-400 { color: #7c3aed !important; }
  /* User bubble keeps its colour */
  .bg-indigo-600 { background: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Cards */
  [class*="border-amber-"] { border-color: #fcd34d !important; }
  [class*="bg-amber-"] { background: #fffbeb !important; }
  /* Hide interactive elements */
  button { display: none !important; }
  .pdf-header { font-size: 0.85em; color: #71717a; padding-bottom: 0.75em; margin-bottom: 1.5em; border-bottom: 1px solid #e4e4e7; }
</style>
</head>
<body>
<div class="pdf-header">Consensus AI &mdash; ${safeTitle}</div>
${el.innerHTML}
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

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

    // Scrape URLs from the user's prompt (explicit) + any URLs the AI mentioned in its last response
    // (so models can "follow" links they previously cited without the user having to copy/paste them)
    const promptUrls: string[] = submittedPrompt.match(/https?:\/\/[^\s)>\]"']+/g) ?? [];
    const lastAiTurn = [...conversation].reverse().find((t) => t.role === 'assistant');
    // Debate sends to 8 models in parallel — skip history URL injection to keep the request lean
    // (Perplexity in the debate already covers web access)
    const historyUrls = selectedMode !== 'debate' && lastAiTurn
      ? (lastAiTurn.content.match(/https?:\/\/[^\s)>\]"']+/g) ?? []).filter((u) => !promptUrls.includes(u))
      : [];
    const allUrls = [...new Set([...promptUrls, ...historyUrls])].slice(0, 5);

    if (allUrls.length > 0) {
      if (promptUrls.length > 0) setScrapingUrls(true);
      const scraped = await Promise.all(
        allUrls.map(async (url) => {
          const cached = urlCacheRef.current.get(url);
          if (cached !== undefined) return { url, content: cached };
          const data = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
            .then((r) => r.json()).catch(() => null);
          if (data?.content) urlCacheRef.current.set(url, data.content as string);
          return data?.content ? { url, content: data.content as string } : null;
        }),
      );
      setScrapingUrls(false);
      const context = scraped
        .filter((s): s is { url: string; content: string } => s !== null && !!s.content)
        .map((s) => `<webpage url="${s.url}">\n${s.content}\n</webpage>`)
        .join('\n\n');
      if (context) submittedPrompt = `${context}\n\n${submittedPrompt}`;
    }

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

        // Streaming: single-model and auto modes (not all/image/multi-select)
        const canStream = selectedMode !== 'debate' && selectedMode !== 'all' && selectedMode !== 'image' && selectedModels.length <= 1;

        if (selectedMode === 'debate') {
          // ── Streaming debate ─────────────────────────────────────────────────
          const debateStart = Date.now();
          setStreamingDebate({ stage: 'collecting', responses: [], synthesisContent: '' });

          // If the user switches from another mode into debate, debateConversation may be
          // empty even though conversation has rich context. Fall back to conversation so
          // the models know what has been discussed regardless of which mode was used before.
          const debateHistory = debateConversation.length > 0 ? debateConversation : conversation.slice(-10);

          const res = await fetch('/api/debate/stream', {
            method: 'POST', headers, signal: abortRef.current.signal,
            body: JSON.stringify({ prompt: submittedPrompt, history: debateHistory, userMemory: userMemory.map((f) => f.fact), userPreferences }),
          });

          if (!res.ok) {
            let data: { code?: string; message?: string; error?: string } = {};
            try { data = await res.json(); } catch { /* non-JSON error body (e.g. 502/504) */ }
            if (res.status === 429 && data.code === 'LIMIT_REACHED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setStreamingDebate(null); saveSession(); setShowLoginGate(true); return; }
            if (res.status === 402 && data.code === 'SUBSCRIPTION_REQUIRED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowTrialModal(true); setStreamingDebate(null); return; }
            throw new Error(data.message || data.error || `Debate request failed (${res.status})`);
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          // Local accumulator (avoids React stale-closure issues)
          const acc = {
            responses: [] as ModelResponse[],
            scores: [] as ResponseScore[],
            winner: null as ProviderId | null,
            synthesisContent: '',
            synthesizedAnswer: '',  // server's authoritative final answer (includes its own fallback)
            summary: '',
            synthesisReasoning: '',
          };

          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';

            for (const part of parts) {
              if (!part.startsWith('data: ')) continue;
              const msg = JSON.parse(part.slice(6));

              if (msg.type === 'error') throw new Error(msg.message);

              if (msg.type === 'stage') {
                setStreamingDebate((prev) => prev ? { ...prev, stage: msg.stage } : null);
              } else if (msg.type === 'response') {
                acc.responses.push(msg as ModelResponse);
                setStreamingDebate((prev) => prev ? { ...prev, responses: [...acc.responses] } : null);
              } else if (msg.type === 'scores') {
                acc.scores = msg.scores as ResponseScore[];
                acc.winner = msg.winner as ProviderId;
              } else if (msg.type === 'synthesis_chunk') {
                acc.synthesisContent += msg.text as string;
                setStreamingDebate((prev) => prev ? { ...prev, synthesisContent: acc.synthesisContent } : null);
              } else if (msg.type === 'done') {
                acc.summary = (msg.summary as string) ?? '';
                acc.synthesisReasoning = (msg.synthesisReasoning as string) ?? '';
                acc.synthesizedAnswer = (msg.synthesizedAnswer as string) ?? '';
                if (Array.isArray(msg.allResponses)) acc.responses = msg.allResponses as ModelResponse[];
                if (Array.isArray(msg.scores)) acc.scores = msg.scores as ResponseScore[];
                if (msg.winner) acc.winner = msg.winner as ProviderId;
                break outer;
              }
            }
          }

          if (!acc.winner) throw new Error('Debate did not complete successfully.');

          const debateResult: DebateResult = {
            responses: acc.responses,
            critiques: [],
            scores: acc.scores,
            winner: acc.winner,
            synthesizedAnswer: acc.synthesisContent || acc.synthesizedAnswer || (acc.responses.find((r) => r.provider === acc.winner)?.content ?? ''),
            synthesisReasoning: acc.synthesisReasoning,
            summary: acc.summary,
          };

          const result: AppResult = {
            id: turnId, prompt: submittedPrompt, mode: 'debate',
            routerDecision: null,
            responses: acc.responses,
            debateResult,
            finalAnswer: debateResult.synthesizedAnswer,
            imageResult: null,
            timestamp: new Date(),
            durationMs: Date.now() - debateStart,
          };

          updateTurn(turnId, { result, loading: false });
          setStreamingDebate(null);
          addDebateTurn(submittedPrompt, debateResult.synthesizedAnswer);
          addConversationTurn(submittedPrompt, debateResult.synthesizedAnswer);
          addHistoryEntry({ id: turnId, prompt: submittedPrompt, mode: 'debate', finalAnswer: debateResult.synthesizedAnswer, timestamp: new Date() });
          runPostTurnAgents(turnId, submittedPrompt, debateResult.synthesizedAnswer, chatTurns.length === 0);

        } else if (canStream) {
          const streamStart = Date.now();
          const res = await fetch('/api/chat/stream', {
            method: 'POST', headers, signal: abortRef.current.signal,
            body: JSON.stringify({ prompt: submittedPrompt, mode: selectedMode, history: conversation, images, userMemory: userMemory.map((f) => f.fact), userPreferences }),
          });

          // Auth/limit errors arrive as JSON before the stream
          if (!res.ok) {
            let data: { code?: string; message?: string; error?: string } = {};
            try { data = await res.json(); } catch { /* non-JSON error body (e.g. 502/504) */ }
            if (res.status === 429 && data.code === 'LIMIT_REACHED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); saveSession(); setShowLoginGate(true); return; }
            if (res.status === 402 && data.code === 'SUBSCRIPTION_REQUIRED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowTrialModal(true); return; }
            // Image route or other — fall through to main route
            if (data.error?.toLowerCase().includes('image')) throw new Error('image-fallback');
            throw new Error(data.message || data.error || `Request failed (${res.status})`);
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
                runPostTurnAgents(turnId, submittedPrompt, accumulated, chatTurns.length === 0);
                break outer;
              } else if (msg.t) {
                accumulated += msg.t;
                setStreamingContent((prev) => ({ ...prev, [turnId]: accumulated }));
              }
            }
          }
        } else {
          // Non-streaming: all-models, image, multi-select
          const res = await fetch('/api/chat', {
            method: 'POST', headers, signal: abortRef.current.signal,
            body: JSON.stringify({ prompt: submittedPrompt, mode: selectedMode, imageProvider: selectedImageProvider, history: conversation, providerConversations, debateConversation, images, documents, userMemory: userMemory.map((f) => f.fact), userPreferences, selectedModels }),
          });
          const data = await res.json();
          if (res.status === 429 && data.code === 'LIMIT_REACHED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); saveSession(); setShowLoginGate(true); return; }
          if (res.status === 402 && data.code === 'SUBSCRIPTION_REQUIRED') { updateTurn(turnId, { loading: false, error: null }); setLoading(false); setShowTrialModal(true); return; }
          if (!res.ok) throw new Error(data.message || data.error || 'Request failed');

          const result: AppResult = { ...data, timestamp: new Date(data.timestamp) };
          updateTurn(turnId, { result, loading: false });

          const isFirst = chatTurns.length === 0;
          if (selectedMode === 'all' || result.mode === 'all') {
            const firstResponse = result.responses.find((r) => r.content && !r.error);
            if (firstResponse) { addConversationTurn(submittedPrompt, firstResponse.content); runPostTurnAgents(turnId, submittedPrompt, firstResponse.content, isFirst); }
          } else if (selectedMode !== 'image' && result.finalAnswer) {
            addConversationTurn(submittedPrompt, result.finalAnswer);
            runPostTurnAgents(turnId, submittedPrompt, result.finalAnswer, isFirst);
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
      setStreamingDebate(null);
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
      <div className="print:hidden">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="print:hidden">
          <Header onOpenTour={() => setShowTour(true)} />
        </div>
        {showTour && <WelcomeTour onClose={() => setShowTour(false)} />}

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
            <main className="flex-1 overflow-y-auto" ref={mainRef}>
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
                {/* PDF export toolbar — hidden when printing */}
                <div className="flex items-center justify-end print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Save conversation as PDF"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Save as PDF
                  </button>
                </div>
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

                    {/* URL scraping indicator */}
                    {scrapingUrls && turn.loading && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 py-1">
                        <div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Reading linked page…
                      </div>
                    )}

                    {/* Loading */}
                    {turn.loading && !scrapingUrls && (
                      streamingContent[turn.id] ? (
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words response-content">
                          <MarkdownContent content={streamingContent[turn.id]} />
                          <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 -mb-0.5" />
                        </div>
                      ) : turn.mode === 'debate' ? (
                        <DebateProgress
                          stage={streamingDebate?.stage ?? 'collecting'}
                          responses={streamingDebate?.responses ?? []}
                          synthesisContent={streamingDebate?.synthesisContent ?? ''}
                        />
                      ) : turn.mode === 'all' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
                            Querying 8 models in parallel…
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['openai', 'anthropic', 'gemini', 'perplexity', 'grok', 'llama', 'o4mini', 'deepseek'] as const).map((provider) => (
                              <ResponseCard
                                key={provider}
                                response={{ provider, content: '', latencyMs: 0, isGrounded: false }}
                                isLoading
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 py-2">
                          <div className="relative w-8 h-8 shrink-0">
                            <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                            <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                          </div>
                          <p className="text-zinc-400 text-sm">
                            {turn.mode === 'image' ? 'Generating image…'
                              : turn.mode === 'auto' ? 'Finding the best model…'
                              : turn.mode === 'perplexity' ? 'Searching the web…'
                              : turn.mode === 'o4mini' || turn.mode === 'deepseek' ? 'Reasoning…'
                              : 'Thinking…'}
                          </p>
                        </div>
                      )
                    )}

                    {/* Error */}
                    {turn.error && (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-red-400">{turn.error}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={() => handleSubmit(turn.prompt, turn.images ?? [], turn.documents ?? [])}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Try again
                            </button>
                            <button
                              onClick={() => { removeTurn(turn.id); setPrompt(turn.prompt); }}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
                            >
                              Edit prompt
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Result */}
                    {turn.result && (
                      <>
                        <div id={`result-${turn.id}`}>
                          <OutputPanel result={turn.result} />
                        </div>

                        {/* Fact-check badge — single/auto modes only */}
                        {turn.factCheck && turn.result.mode !== 'debate' && turn.result.mode !== 'all' && turn.result.mode !== 'image' && (
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <div className={`w-1.5 h-1.5 rounded-full ${turn.factCheck.score >= 85 ? 'bg-emerald-500' : turn.factCheck.score >= 65 ? 'bg-amber-500' : 'bg-red-500'}`} />
                            <span>Fact confidence: <span className={turn.factCheck.score >= 85 ? 'text-emerald-400' : turn.factCheck.score >= 65 ? 'text-amber-400' : 'text-red-400'}>{turn.factCheck.score}%</span></span>
                            {turn.factCheck.flags.length > 0 && (
                              <span className="text-zinc-600">· {turn.factCheck.flags[0]}</span>
                            )}
                          </div>
                        )}

                        {/* Follow-up question skeleton while loading */}
                        {!turn.followupQuestions && loadingFollowups.has(turn.id) && (
                          <div className="flex gap-2 flex-wrap print:hidden">
                            {[108, 148, 122].map((w, i) => (
                              <div key={i} className="h-7 rounded-full skeleton" style={{ width: `${w}px` }} />
                            ))}
                          </div>
                        )}

                        {/* Follow-up question chips */}
                        {turn.followupQuestions && turn.followupQuestions.length > 0 && (
                          <div className="print:hidden">
                            <FollowUpQuestions
                              questions={turn.followupQuestions}
                              onSelect={(q) => setPrompt(q)}
                            />
                          </div>
                        )}

                        {/* Prominent export button for document-like responses */}
                        {isDocumentResponse(turn.result.finalAnswer) && (
                          <button
                            onClick={() => downloadResponseAsPdf(turn.id, turn.prompt)}
                            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium hover:bg-indigo-500/15 hover:border-indigo-500/50 transition-all print:hidden"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            Export as PDF Document
                          </button>
                        )}

                        <div className="flex items-center justify-between print:hidden">
                          <button
                            onClick={() => handleSubmit(turn.prompt, turn.images, turn.documents)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Regenerate
                          </button>
                          <button
                            onClick={() => downloadResponseAsPdf(turn.id, turn.prompt)}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            Save as PDF
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </main>

            <div className="bg-zinc-950 pb-6 pt-3 border-t border-zinc-800/60 print:hidden" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
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
