import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { prompt, mode } = await request.json();
  if (!prompt?.trim() || prompt.trim().length < 15) return NextResponse.json({ ideas: [] });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 150,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content: `Generate 3 related question ideas based on what the user is typing. Each should explore a different angle of the same topic — deeper, broader, or more specific. ${mode === 'debate' ? 'Frame them as debate-worthy questions with two sides.' : 'Keep them open-ended and curious.'} Output ONLY a JSON array of 3 short strings (under 12 words each). No explanation.`,
      },
      { role: 'user', content: prompt },
    ],
  });

  try {
    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    const ideas: string[] = JSON.parse(raw);
    return NextResponse.json({ ideas: Array.isArray(ideas) ? ideas.slice(0, 3) : [] });
  } catch {
    return NextResponse.json({ ideas: [] });
  }
}
