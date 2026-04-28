import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { MemoryFact } from '@/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { turns } = await request.json() as { turns: { prompt: string; response: string }[] };

    if (!turns || turns.length === 0) {
      return NextResponse.json({ facts: [] });
    }

    const conversation = turns
      .map((t) => `User: ${t.prompt}\nAssistant: ${t.response}`)
      .join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Extract facts about the user from this conversation that would help personalise future responses.

Save anything meaningful, including:
- Name, role, company, location
- Projects they're building (be specific: tech stack, purpose, scale)
- Languages, frameworks, tools they use
- Preferences for how they like answers (concise, detailed, code-first, etc.)
- Goals, problems they're trying to solve
- Domain expertise and background knowledge
- Opinions or strong views they've expressed
- Anything they explicitly asked you to remember
- Personal context that affects how to help them

Be concrete and specific. Prefer "Building a Next.js 14 SaaS with Supabase and Stripe" over "building an app."

Return ONLY a JSON array of short fact strings (up to 10 facts, each under 20 words). Return [] if nothing is worth saving.

Conversation:
${conversation}`,
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: string[] = JSON.parse(cleaned);

    const now = new Date().toISOString();
    const facts: MemoryFact[] = parsed
      .filter((f) => typeof f === 'string' && f.trim().length > 0)
      .slice(0, 10)
      .map((fact) => ({ fact: fact.trim(), addedAt: now }));

    return NextResponse.json({ facts });
  } catch {
    return NextResponse.json({ facts: [] });
  }
}
