import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppState, ModelMode, HistoryEntry, ImageProviderMode, ProviderId, ChatTurn, AttachedImage, ChatSession } from '@/types';
import { generateId } from '@/utils';

interface AppActions {
  setMode: (mode: ModelMode) => void;
  setImageProvider: (provider: ImageProviderMode) => void;
  setPrompt: (prompt: string) => void;
  setLoading: (loading: boolean) => void;
  // Chat turns
  addTurn: (turn: ChatTurn) => void;
  updateTurn: (id: string, patch: Partial<ChatTurn>) => void;
  clearTurns: () => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  // Sessions
  saveSession: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  syncSessionsFromDB: () => Promise<void>;
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
    (set) => ({
  // Initial state
  selectedMode: 'auto',
  selectedImageProvider: 'auto-image',
  prompt: '',
  isLoading: false,
  chatTurns: [],
  history: [],
  sessions: [],
  conversation: [],
  providerConversations: {},
  debateConversation: [],
  sidebarOpen: false,
  settingsOpen: false,
  mockMode: isMockMode,

  // Actions
  setMode: (mode) => set({ selectedMode: mode }),
  setImageProvider: (provider) => set({ selectedImageProvider: provider }),
  setPrompt: (prompt) => set({ prompt }),
  setLoading: (loading) => set({ isLoading: loading }),

  addTurn: (turn) => set((state) => ({ chatTurns: [...state.chatTurns, turn] })),
  updateTurn: (id, patch) =>
    set((state) => ({
      chatTurns: state.chatTurns.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  clearTurns: () => set({ chatTurns: [] }),

  addHistoryEntry: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, 100),
    })),
  clearHistory: () => set({ history: [] }),

  saveSession: () =>
    set((state) => {
      if (state.chatTurns.length === 0) return {};
      const session: ChatSession = {
        id: generateId(),
        title: state.chatTurns[0].prompt,
        timestamp: state.chatTurns[0].result?.timestamp ?? new Date(),
        mode: state.chatTurns[0].mode,
        turns: state.chatTurns,
        conversation: state.conversation,
        providerConversations: state.providerConversations,
        debateConversation: state.debateConversation,
      };
      // Sync to Supabase in background (don't block UI)
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      }).catch(() => {});
      return { sessions: [session, ...state.sessions].slice(0, 50) };
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
    fetch(`/api/sessions?id=${id}`, { method: 'DELETE' }).catch(() => {});
    return set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },
  syncSessionsFromDB: async () => {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) return;
      const sessions: ChatSession[] = await res.json();
      // Merge DB sessions with localStorage, DB takes priority
      set((state) => {
        const localIds = new Set(sessions.map((s) => s.id));
        const localOnly = state.sessions.filter((s) => !localIds.has(s.id));
        return { sessions: [...sessions, ...localOnly].slice(0, 50) };
      });
    } catch {
      // Network failure — fall back to localStorage silently
    }
  },

  addConversationTurn: (userPrompt, assistantResponse) =>
    set((state) => ({
      conversation: [
        ...state.conversation,
        { role: 'user' as const, content: userPrompt },
        { role: 'assistant' as const, content: assistantResponse },
      ].slice(-20),
    })),
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

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setMockMode: (mock) => set({ mockMode: mock }),
    }),
    {
      name: 'consensus-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist sessions and history — skip transient UI state
      partialize: (state) => ({
        sessions: state.sessions,
        history: state.history,
      }),
    },
  ),
);
