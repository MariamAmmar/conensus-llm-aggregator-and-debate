import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content: `You rewrite vague questions into sharp, debate-worthy prompts. Output ONLY the rewritten prompt — no explanation, no quotes, no preamble. Make it specific, opinionated in framing, and genuinely arguable. Keep it under 120 characters.`,
      },
      { role: 'user', content: prompt },
    ],
  });

  const enhanced = completion.choices[0]?.message?.content?.trim() ?? prompt;
  return NextResponse.json({ enhanced });
}
