import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { response } = await request.json();
  if (!response?.trim()) return NextResponse.json({ score: 100, flags: [] });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 150,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are a fact-checker. Assess this AI response for factual reliability.

Return ONLY valid JSON:
{"score": <0-100 confidence the facts are accurate>, "flags": ["<specific claim that may be uncertain or wrong>", ...]}

Keep flags under 2 items. Only flag specific verifiable claims, not opinions. If the response is mostly reliable, return an empty flags array. Never flag things that are clearly true.`,
      },
      { role: 'user', content: response.slice(0, 800) },
    ],
  });

  try {
    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const result = JSON.parse(raw);
    return NextResponse.json({
      score: Math.min(100, Math.max(0, Number(result.score) || 85)),
      flags: Array.isArray(result.flags) ? result.flags.slice(0, 2) : [],
    });
  } catch {
    return NextResponse.json({ score: 85, flags: [] });
  }
}
