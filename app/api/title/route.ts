import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();
  if (!prompt?.trim()) return NextResponse.json({ title: prompt });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 20,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Generate a short, descriptive title (3-6 words) for a chat session that started with this prompt. No quotes, no punctuation at end. Just the title.`,
      },
      { role: 'user', content: prompt },
    ],
  });

  const title = completion.choices[0]?.message?.content?.trim() ?? prompt.slice(0, 50);
  return NextResponse.json({ title });
}
