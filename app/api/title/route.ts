import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { prompts } = await request.json() as { prompts: string[] };

  if (!prompts?.length) return NextResponse.json({ title: 'New Chat' });

  // Build a compact representation of what was discussed
  const context = prompts
    .filter((p) => p?.trim())
    .slice(0, 8) // cap at 8 prompts to keep the request lean
    .map((p, i) => `${i + 1}. ${p.trim().slice(0, 120)}`)
    .join('\n');

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 12,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You name chat sessions. Given the user's messages, write a 3–6 word title that captures the specific topic(s) discussed. Be concrete — name the actual subject, not a generic description. No quotes. No trailing punctuation.

Examples of good titles: "Claude vs GPT-4 comparison", "Python async/await debugging", "Marketing copy for SaaS launch", "Is nuclear energy safe"
Examples of bad titles: "Various topics", "User questions", "Chat about AI"`,
        },
        { role: 'user', content: context },
      ],
    });

    const title = completion.choices[0]?.message?.content?.trim() ?? prompts[0].slice(0, 50);
    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ title: prompts[0].slice(0, 50) });
  }
}
