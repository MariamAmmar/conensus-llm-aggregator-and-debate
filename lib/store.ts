import { create } from 'zustand';
import type { AppState, ModelMode, AppResult, HistoryEntry } from '@/types';

interface AppActions {
  setMode: (mode: ModelMode) => void;
  setPrompt: (prompt: string) => void;
  setLoading: (loading: boolean) => void;
  setResult: (result: AppResult | null) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setMockMode: (mock: boolean) => void;
}

type AppStore = AppState & AppActions;

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  selectedMode: 'auto',
  prompt: '',
  isLoading: false,
  currentResult: null,
  history: [],
  sidebarOpen: false,
  settingsOpen: false,
  mockMode: isMockMode,

  // Actions
  setMode: (mode) => set({ selectedMode: mode }),
  setPrompt: (prompt) => set({ prompt }),
  setLoading: (loading) => set({ isLoading: loading }),
  setResult: (result) => set({ currentResult: result }),
  addHistoryEntry: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, 100), // keep last 100
    })),
  clearHistory: () => set({ history: [] }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setMockMode: (mock) => set({ mockMode: mock }),
}));
