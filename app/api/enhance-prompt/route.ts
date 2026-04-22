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
        content: `Rephrase the user's question to be neutral, open-ended, and optimized for getting unbiased responses from AI models. Preserve the exact meaning and topic — do not change what is being asked. Only improve the wording to remove any leading language, assumptions, or framing that could bias the answer. Output ONLY the rewritten prompt — no explanation, no quotes, no preamble.`,
      },
      { role: 'user', content: prompt },
    ],
  });

  const enhanced = completion.choices[0]?.message?.content?.trim() ?? prompt;
  return NextResponse.json({ enhanced });
}
