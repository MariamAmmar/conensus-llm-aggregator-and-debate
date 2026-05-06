import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppState, ModelMode, HistoryEntry, ImageProviderMode, ProviderId, ChatTurn, AttachedImage, ChatSession, MemoryFact } from '@/types';
import { generateId } from '@/utils';
import { supabase } from './supabase';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface AppActions {
  setMode: (mode: ModelMode) => void;
  toggleModel: (mode: ModelMode) => void;
  setImageProvider: (provider: ImageProviderMode) => void;
  setPrompt: (prompt: string) => void;
  setLoading: (loading: boolean) => void;
  // Chat turns
  addTurn: (turn: ChatTurn) => void;
  updateTurn: (id: string, patch: Partial<ChatTurn>) => void;
  removeTurn: (id: string) => void;
  clearTurns: () => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  // Sessions
  saveSession: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  syncSessionsFromDB: () => Promise<void>;
  syncLocalSessionsToDB: (token: string) => void;
  claimIpSessions: (token: string) => Promise<void>;
  // Memory
  mergeMemoryFacts: (facts: MemoryFact[]) => void;
  removeMemoryFact: (fact: string) => void;
  clearMemory: () => void;
  // Preferences
  setUserPreferences: (prefs: string) => void;
  setSessionTitle: (title: string) => void;
  // Single-model / auto
  addConversationTurn: (userPrompt: string, assistantResponse: string) => void;
  clearConversation: () => void;
  // All Models — per-provider
  addProviderTurn: (provider: ProviderId, userPrompt: string, assistantResponse: string) => void;
  clearProviderConversations: () => void;
  // Debate — shared using synthesized answer
  addDebateTurn: (userPrompt: string, synthesizedResponse: string) => void;
  clearDebateConversation: () => void;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setMockMode: (mock: boolean) => void;
}

type AppStore = AppState & AppActions;

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
  // Initial state
  selectedMode: 'auto',
  selectedModels: ['chatgpt'] as ModelMode[],
  selectedImageProvider: 'auto-image',
  prompt: '',
  isLoading: false,
  chatTurns: [],
  history: [],
  sessions: [],
  activeSessionId: null,
  userMemory: [],
  userPreferences: '',
  conversation: [],
  providerConversations: {},
  debateConversation: [],
  sidebarOpen: false,
  settingsOpen: false,
  mockMode: isMockMode,

  // Actions
  setMode: (mode) => set({ selectedMode: mode, selectedModels: [mode] }),
  toggleModel: (mode) => set((state) => {
    const current = state.selectedModels;
    if (current.includes(mode)) {
      if (current.length === 1) return {}; // keep at least one selected
      const next = current.filter((m) => m !== mode);
      return { selectedModels: next, selectedMode: next[0] };
    }
    return { selectedModels: [...current, mode], selectedMode: mode };
  }),
  setImageProvider: (provider) => set({ selectedImageProvider: provider }),
  setPrompt: (prompt) => set({ prompt }),
  setLoading: (loading) => set({ isLoading: loading }),

  addTurn: (turn) => set((state) => ({ chatTurns: [...state.chatTurns, turn] })),
  removeTurn: (id) => set((state) => ({ chatTurns: state.chatTurns.filter((t) => t.id !== id) })),
  updateTurn: (id, patch) =>
    set((state) => ({
      chatTurns: state.chatTurns.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  clearTurns: () => set({ chatTurns: [], activeSessionId: null }),

  addHistoryEntry: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, 100),
    })),
  clearHistory: () => set({ history: [] }),

  saveSession: () =>
    set((state) => {
      if (state.chatTurns.length === 0) return {};
      const id = state.activeSessionId ?? generateId();
      // Use the AI-generated title if already set, otherwise fall back to the raw first prompt
      const existingSession = state.sessions.find((s) => s.id === id);
      const title = existingSession?.title ?? state.chatTurns[0].prompt;
      const session: ChatSession = {
        id,
        title,
        timestamp: state.chatTurns[0].result?.timestamp ?? new Date(),
        mode: state.chatTurns[0].mode,
        turns: state.chatTurns,
        conversation: state.conversation,
        providerConversations: state.providerConversations,
        debateConversation: state.debateConversation,
      };
      getAuthHeader().then((authHeader) => {
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(session),
        }).catch((e) => console.warn('[sessions] save failed', e));
      });
      const exists = state.sessions.some((s) => s.id === id);
      const sessions = exists
        ? state.sessions.map((s) => (s.id === id ? session : s))
        : [session, ...state.sessions].slice(0, 500);
      return { sessions, activeSessionId: id };
    }),
  loadSession: (id) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === id);
      if (!session) return {};
      return {
        chatTurns: session.turns,
        conversation: session.conversation,
        providerConversations: session.providerConversations,
        debateConversation: session.debateConversation,
      };
    }),
  deleteSession: (id) => {
    getAuthHeader().then((authHeader) => {
      fetch(`/api/sessions?id=${id}`, { method: 'DELETE', headers: authHeader }).catch(() => {});
    });
    return set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },
  syncSessionsFromDB: async () => {
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/sessions', { headers: authHeader });
      if (!res.ok) return;
      const dbSessions: ChatSession[] = await res.json();
      // Merge: DB is authoritative; keep local-only sessions not yet uploaded
      set((state) => {
        const dbIds = new Set(dbSessions.map((s) => s.id));
        const localOnly = state.sessions.filter((s) => !dbIds.has(s.id));
        return { sessions: [...dbSessions, ...localOnly].slice(0, 500) };
      });
    } catch {
      // Network failure — fall back to localStorage silently
    }
  },

  // Re-upload every local session to DB using a known-good token (call on login)
  syncLocalSessionsToDB: (token: string) => {
    const sessions = get().sessions;
    if (sessions.length === 0) return;
    const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    sessions.forEach((session) => {
      fetch('/api/sessions', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(session),
      }).catch((e) => console.warn('[sessions] re-upload failed', e));
    });
  },

  // Claim all anonymous (pre-login) sessions from this device's IP for the logged-in user
  claimIpSessions: async (token: string) => {
    try {
      await fetch('/api/sessions/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Non-critical — silently ignore network errors
    }
  },

  setSessionTitle: (title) =>
    set((state) => {
      if (!state.activeSessionId || state.chatTurns.length === 0) return {};
      const id = state.activeSessionId;
      const sessions = state.sessions.map((s) => (s.id === id ? { ...s, title } : s));
      // Push the AI-generated title to DB immediately
      const sessionToSave: ChatSession = {
        id,
        title,
        timestamp: state.chatTurns[0].result?.timestamp ?? new Date(),
        mode: state.chatTurns[0].mode,
        turns: state.chatTurns,
        conversation: state.conversation,
        providerConversations: state.providerConversations,
        debateConversation: state.debateConversation,
      };
      getAuthHeader().then((authHeader) => {
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(sessionToSave),
        }).catch((e) => console.warn('[sessions] title save failed', e));
      });
      return { sessions };
    }),

  addConversationTurn: (userPrompt, assistantResponse) =>
    set((state) => {
      const updated = [
        ...state.conversation,
        { role: 'user' as const, content: userPrompt },
        { role: 'assistant' as const, content: assistantResponse },
      ];
      // Summarize when history exceeds 10 messages (5 turns) to keep tokens low
      if (updated.length >= 10) {
        fetch('/api/summarize-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history: updated }),
        })
          .then((r) => r.json())
          .then(({ summary }) => {
            if (summary) {
              useAppStore.setState({
                conversation: [{ role: 'assistant' as const, content: `[Conversation summary]: ${summary}` }],
              });
            }
          })
          .catch(() => {});
      }
      return { conversation: updated.slice(-20) };
    }),
  clearConversation: () => set({ conversation: [] }),

  addProviderTurn: (provider, userPrompt, assistantResponse) =>
    set((state) => {
      const existing = state.providerConversations[provider] ?? [];
      return {
        providerConversations: {
          ...state.providerConversations,
          [provider]: [
            ...existing,
            { role: 'user' as const, content: userPrompt },
            { role: 'assistant' as const, content: assistantResponse },
          ].slice(-20),
        },
      };
    }),
  clearProviderConversations: () => set({ providerConversations: {} }),

  addDebateTurn: (userPrompt, synthesizedResponse) =>
    set((state) => ({
      debateConversation: [
        ...state.debateConversation,
        { role: 'user' as const, content: userPrompt },
        { role: 'assistant' as const, content: synthesizedResponse },
      ].slice(-20),
    })),
  clearDebateConversation: () => set({ debateConversation: [] }),

  mergeMemoryFacts: (incoming) =>
    set((state) => {
      const existing = new Map(state.userMemory.map((f) => [f.fact.toLowerCase(), f]));
      for (const f of incoming) {
        existing.set(f.fact.toLowerCase(), f); // newer fact wins on duplicate
      }
      const merged = Array.from(existing.values())
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, 100);
      return { userMemory: merged };
    }),
  removeMemoryFact: (fact) =>
    set((state) => ({ userMemory: state.userMemory.filter((f) => f.fact !== fact) })),
  clearMemory: () => set({ userMemory: [] }),
  setUserPreferences: (prefs) => set({ userPreferences: prefs }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setMockMode: (mock) => set({ mockMode: mock }),
    }),
    {
      name: 'consensus-store',
      storage: createJSONStorage(() => localStorage),
      // Persist sessions, history, memory, preferences, and the current prompt.
      // chatTurns/conversation are NOT persisted directly to avoid duplication —
      // they're restored from the active session in the merge function below.
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        history: state.history,
        userMemory: state.userMemory,
        userPreferences: state.userPreferences,
        prompt: state.prompt,
      }),
      // After page reload (e.g. OAuth redirect), restore the active session's turns
      // and conversation context so the chat view is exactly as the user left it.
      merge: (persistedState, currentState) => {
        const stored = persistedState as Partial<AppStore> | null;
        if (!stored) return currentState;
        const base = { ...currentState, ...stored } as AppStore;
        if (stored.activeSessionId && Array.isArray(stored.sessions)) {
          const active = stored.sessions.find((s) => s.id === stored.activeSessionId);
          if (active) {
            // Clear any in-flight loading states from requests interrupted by the reload
            base.chatTurns = active.turns.map((t) =>
              t.loading ? { ...t, loading: false, error: 'Interrupted — please try again.' } : t
            );
            base.conversation = active.conversation ?? [];
            base.providerConversations = active.providerConversations ?? {};
            base.debateConversation = active.debateConversation ?? [];
          }
        }
        return base;
      },
    },
  ),
);
