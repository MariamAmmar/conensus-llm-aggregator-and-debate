'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase';

interface Subscription {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
}

interface AccountModalProps {
  user: User;
  accessToken: string;
  onClose: () => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
        <CheckCircle className="w-3.5 h-3.5" /> Active
      </span>
    );
  }
  if (status === 'trialing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400">
        <Clock className="w-3.5 h-3.5" /> Free trial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
      <XCircle className="w-3.5 h-3.5" /> {status ?? 'Inactive'}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function AccountModal({ user, accessToken, onClose }: AccountModalProps) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSub() {
      try {
        const res = await fetch('/api/account/subscription', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSub(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingSub(false);
      }
    }
    fetchSub();
  }, [accessToken]);

  async function handleManageBilling() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong');
      setPortalLoading(false);
    }
  }

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Account';

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

        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-zinc-100">Account</h2>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>

        {/* Subscription card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Plan</span>
            <span className="text-xs font-semibold text-zinc-200">Consensus AI Pro · $12/mo</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Status</span>
            {loadingSub ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
            ) : sub ? (
              <StatusBadge status={sub.status} />
            ) : (
              <span className="text-xs text-zinc-500">No active subscription</span>
            )}
          </div>

          {sub?.status === 'trialing' && sub.trial_end && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Trial ends</span>
              <span className="text-xs text-zinc-300">{fmt(sub.trial_end)}</span>
            </div>
          )}

          {sub?.status === 'active' && sub.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Next billing</span>
              <span className="text-xs text-zinc-300">{fmt(sub.current_period_end)}</span>
            </div>
          )}
        </div>

        {portalError && <p className="text-xs text-red-400 text-center">{portalError}</p>}

        <Button
          onClick={handleManageBilling}
          disabled={portalLoading}
          variant="outline"
          className="w-full h-9 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
        >
          {portalLoading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening billing portal...</>
          ) : (
            <><CreditCard className="w-3.5 h-3.5" /> Manage billing & cancel<ExternalLink className="w-3 h-3 ml-auto" /></>
          )}
        </Button>

        <p className="text-[11px] text-zinc-600 text-center">
          Billing is managed securely via Stripe. You can update your payment method, view invoices, or cancel anytime.
        </p>
      </div>
    </div>
  );
}
