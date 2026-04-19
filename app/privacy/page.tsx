import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const metadata = { title: 'Privacy Policy — Consensus AI' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="font-semibold text-zinc-100 text-sm">Consensus AI</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-100">Privacy Policy</h1>
          <p className="text-xs text-zinc-500">Last updated: April 19, 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">What we collect</h2>
          <ul className="space-y-2 text-sm leading-relaxed list-disc list-inside text-zinc-400">
            <li><span className="text-zinc-300 font-medium">Account info</span> — email address when you sign in (via Google, GitHub, or magic link).</li>
            <li><span className="text-zinc-300 font-medium">Prompts and responses</span> — your chat history, saved to your account so you can access it across devices.</li>
            <li><span className="text-zinc-300 font-medium">Memory facts</span> — short facts the platform learns about you across conversations to personalize responses (e.g. your name, preferences). You can clear these at any time.</li>
            <li><span className="text-zinc-300 font-medium">Usage data</span> — anonymous IP-based token counts for free-tier rate limiting. No personal data is stored against IPs.</li>
            <li><span className="text-zinc-300 font-medium">Payment info</span> — handled entirely by Stripe. We never see or store your card details.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">How we use it</h2>
          <ul className="space-y-2 text-sm leading-relaxed list-disc list-inside text-zinc-400">
            <li>To provide and improve the Consensus AI service.</li>
            <li>To personalize responses using your saved memory facts.</li>
            <li>To manage your subscription and billing via Stripe.</li>
            <li>We do <span className="text-zinc-300 font-medium">not</span> sell your data or share it with third parties for advertising.</li>
            <li>Your prompts are sent to third-party AI providers (OpenAI, Anthropic, Google, Perplexity, xAI, Groq, DeepSeek) to generate responses. Each provider&apos;s own privacy policy applies to data they process.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">Data retention</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Your chat history and memory facts are stored in Supabase and kept as long as your account is active. You can delete your account and all associated data by contacting us at <a href="mailto:mariam@mariamammar.co" className="text-indigo-400 hover:text-indigo-300">mariam@mariamammar.co</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">Cookies</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            We use essential cookies only — for authentication session management via Supabase. No tracking or advertising cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">Your rights</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            You can request access to, correction of, or deletion of your personal data at any time by emailing <a href="mailto:mariam@mariamammar.co" className="text-indigo-400 hover:text-indigo-300">mariam@mariamammar.co</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">Contact</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Consensus AI is operated by Mariam Ammar. Questions? Email <a href="mailto:mariam@mariamammar.co" className="text-indigo-400 hover:text-indigo-300">mariam@mariamammar.co</a>.
          </p>
        </section>

        <Link href="/" className="inline-block text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          ← Back to Consensus AI
        </Link>
      </main>
    </div>
  );
}
