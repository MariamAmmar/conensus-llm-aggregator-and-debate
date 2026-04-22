import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { prompt, response } = await request.json();
  if (!prompt?.trim() || !response?.trim()) return NextResponse.json({ questions: [] });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 120,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `Generate exactly 3 short follow-up questions a curious person would naturally ask next. Questions should deepen understanding or explore a related angle — not repeat what was just answered. Each under 10 words. Return ONLY a JSON array of 3 strings.`,
      },
      { role: 'user', content: `Question: "${prompt}"\n\nAnswer summary: "${response.slice(0, 400)}"` },
    ],
  });

  try {
    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    const questions: string[] = JSON.parse(raw);
    return NextResponse.json({ questions: Array.isArray(questions) ? questions.slice(0, 3) : [] });
  } catch {
    return NextResponse.json({ questions: [] });
  }
}
