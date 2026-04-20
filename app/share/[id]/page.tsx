import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';
import { Trophy, Sparkles, ExternalLink } from 'lucide-react';
import { formatResponseContent } from '@/components/output/ResponseCard';
import { getProviderLabel } from '@/utils';
import type { AppResult } from '@/types';

interface Props {
  params: { id: string };
}

async function fetchSharedResult(id: string): Promise<AppResult | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shared_results')
      .select('result_json')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data.result_json as AppResult;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await fetchSharedResult(params.id);
  if (!result) return { title: 'Shared Debate — Consensus AI' };

  const synopsis = result.debateResult?.synthesizedAnswer.slice(0, 200).replace(/\n/g, ' ') ?? '';
  const title = `AI Debate: "${result.prompt.slice(0, 80)}"`;

  return {
    title,
    description: synopsis,
    openGraph: {
      title,
      description: synopsis,
      type: 'article',
      siteName: 'Consensus AI',
    },
    twitter: {
      card: 'summary',
      title,
      description: synopsis,
    },
  };
}

export default async function SharePage({ params }: Props) {
  const result = await fetchSharedResult(params.id);
  if (!result || !result.debateResult) notFound();

  const { debateResult } = result;
  const winnerLabel = getProviderLabel(debateResult.winner);
  const winnerScore = debateResult.scores.find((s) => s.provider === debateResult.winner);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            <Sparkles className="w-4 h-4" />
            Consensus AI
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Try it yourself
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Prompt */}
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Debate prompt</p>
          <h1 className="text-xl font-semibold text-zinc-100 leading-snug">"{result.prompt}"</h1>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{debateResult.responses.length} models participated</span>
          <span>·</span>
          <span>Winner: <span className="text-amber-400 font-medium">{winnerLabel}</span></span>
          {winnerScore && <><span>·</span><span>Score: <span className="text-amber-400">{winnerScore.totalScore.toFixed(2)}</span></span></>}
        </div>

        {/* Synthesized answer */}
        <div className="rounded-xl border border-amber-500/30 bg-zinc-900">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-zinc-800">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-zinc-100">Synthesized Answer</span>
            <span className="text-xs text-zinc-500 ml-1">by {winnerLabel}, refined using all models</span>
          </div>
          <div
            className="px-5 py-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words response-content"
            dangerouslySetInnerHTML={{ __html: formatResponseContent(debateResult.synthesizedAnswer) }}
          />
        </div>

        {/* Score table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Peer scores
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-4 text-zinc-500 font-medium">Model</th>
                  <th className="text-center py-2 px-3 text-zinc-500 font-medium hidden sm:table-cell">Factual</th>
                  <th className="text-center py-2 px-3 text-zinc-500 font-medium hidden sm:table-cell">Logic</th>
                  <th className="text-center py-2 px-3 text-zinc-500 font-medium hidden sm:table-cell">Complete</th>
                  <th className="text-center py-2 px-3 text-zinc-500 font-medium hidden sm:table-cell">Clarity</th>
                  <th className="text-center py-2 px-3 text-zinc-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {debateResult.scores.map((score) => {
                  const isWinner = score.provider === debateResult.winner;
                  return (
                    <tr key={score.provider} className={`border-b border-zinc-800/50 ${isWinner ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1.5">
                          {isWinner && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span className={isWinner ? 'text-zinc-100 font-medium' : 'text-zinc-400'}>
                            {getProviderLabel(score.provider)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center hidden sm:table-cell">
                        <span className={score.factualGrounding >= 8.5 ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                          {score.factualGrounding.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center hidden sm:table-cell">
                        <span className={score.logicalCoherence >= 8.5 ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                          {score.logicalCoherence.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center hidden sm:table-cell">
                        <span className={score.completeness >= 8.5 ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                          {score.completeness.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center hidden sm:table-cell">
                        <span className={score.clarity >= 8.5 ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                          {score.clarity.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-bold tabular-nums ${isWinner ? 'text-amber-400' : 'text-zinc-400'}`}>
                          {score.totalScore.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">Run your own debate</p>
            <p className="text-xs text-zinc-500 mt-0.5">8 AI models answer, score each other, and synthesize the best answer.</p>
          </div>
          <Link
            href="/"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Try Consensus AI
          </Link>
        </div>
      </div>
    </div>
  );
}
