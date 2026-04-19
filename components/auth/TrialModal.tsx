'use client';

import { useState } from 'react';
import { X, Sparkles, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TrialModalProps {
  accessToken: string;
  onClose: () => void;
}

export function TrialModal({ accessToken, onClose }: TrialModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartTrial() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start trial');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-100">Unlock Consensus AI</h2>
          <p className="text-xs text-zinc-500">You've used your free queries — start your trial to keep going</p>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-zinc-300 text-sm font-medium">Pro Plan</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-zinc-100">$12</span>
              <span className="text-zinc-500 text-xs">/month</span>
            </div>
          </div>

          <ul className="space-y-2">
            {[
              '7-day free trial — no charge today',
              'Unlimited queries across all models',
              'Access to Debate, All Models & Image modes',
              'Saved chat history across devices',
              'Cancel anytime',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-zinc-400">
                <Check className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-zinc-600 text-center">
          You'll receive a reminder email before your trial ends on day 7.
          After that, $12/month. Cancel anytime from your account.{' '}
          <Link href="/privacy" target="_blank" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <Button
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium gap-2"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout...</>
          ) : (
            'Start free 7-day trial'
          )}
        </Button>
      </div>
    </div>
  );
}
