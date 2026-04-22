import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ConversationMessage } from '@/types';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { history } = await request.json() as { history: ConversationMessage[] };
  if (!history?.length) return NextResponse.json({ summary: '' });

  const transcript = history.map((m) => `${m.role}: ${m.content}`).join('\n');

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `Summarize this conversation history into a compact context block that preserves all important facts, decisions, and user preferences. Write in third person. Be dense, not verbose. This summary will replace the raw history to save tokens.`,
      },
      { role: 'user', content: transcript },
    ],
  });

  const summary = completion.choices[0]?.message?.content?.trim() ?? '';
  return NextResponse.json({ summary });
}
