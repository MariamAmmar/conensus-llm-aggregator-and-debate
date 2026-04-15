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
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Extract factual things about the user from this conversation that would be useful context in future chats. Focus on: their projects, tech stack, preferences, goals, and domain knowledge. Ignore anything ephemeral or obvious.

Conversation:
${conversation}

Return ONLY a JSON array of short fact strings (max 5 facts, each under 15 words). If nothing notable, return [].
Example: ["Building a Next.js 14 app with Supabase", "Prefers concise answers without filler"]`,
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: string[] = JSON.parse(cleaned);

    const now = new Date().toISOString();
    const facts: MemoryFact[] = parsed
      .filter((f) => typeof f === 'string' && f.trim().length > 0)
      .slice(0, 5)
      .map((fact) => ({ fact: fact.trim(), addedAt: now }));

    return NextResponse.json({ facts });
  } catch {
    // Silent failure — memory extraction is best-effort
    return NextResponse.json({ facts: [] });
  }
}
