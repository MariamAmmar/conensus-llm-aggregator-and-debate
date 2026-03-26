'use client';

import { useAppStore } from '@/lib/store';
import { getMockResult } from '@/lib/mock-data';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ModelSelector } from '@/components/prompt/ModelSelector';
import { PromptInput } from '@/components/prompt/PromptInput';
import { OutputPanel } from '@/components/output/OutputPanel';
import { Sparkles } from 'lucide-react';
import type { HistoryEntry } from '@/types';

export default function Home() {
  const {
    selectedMode,
    prompt,
    isLoading,
    currentResult,
    sidebarOpen,
    mockMode,
    setLoading,
    setResult,
    addHistoryEntry,
    setPrompt,
  } = useAppStore();

  async function handleSubmit(submittedPrompt: string) {
    if (!submittedPrompt.trim() || isLoading) return;

    setLoading(true);
    setResult(null);

    try {
      if (mockMode) {
        const result = await getMockResult(submittedPrompt, selectedMode);
        setResult(result);

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
          body: JSON.stringify({ prompt: submittedPrompt, mode: selectedMode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'API error');
        setResult(data);
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleNewConversation() {
    setResult(null);
    setPrompt('');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {/* Model Selector */}
            <ModelSelector />

            {/* Prompt Input */}
            <PromptInput onSubmit={handleSubmit} />

            {/* Output or Empty State */}
            {currentResult ? (
              <OutputPanel result={currentResult} onNewConversation={handleNewConversation} />
            ) : !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-zinc-100">
                    Ask anything.
                  </h2>
                  <p className="text-zinc-400 text-lg max-w-sm">
                    Get the best answer from the best AI model, automatically routed.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {[
                    'Explain quantum entanglement simply',
                    'Write a haiku about debugging',
                    'What are the latest AI developments?',
                    'Debug this: for i in range(10) print(i)',
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setPrompt(example);
                      }}
                      className="px-3 py-1.5 text-sm rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                </div>
                <p className="text-zinc-400 text-sm">
                  {selectedMode === 'debate'
                    ? 'Running debate across all models...'
                    : selectedMode === 'auto'
                    ? 'Routing to best model...'
                    : selectedMode === 'image'
                    ? 'Generating image...'
                    : 'Thinking...'}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
