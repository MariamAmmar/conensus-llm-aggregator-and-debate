import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_CONTENT_CHARS = 6000;

export async function POST(request: NextRequest) {
  const { url } = await request.json();
  if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });

  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return NextResponse.json({ error: `Failed to fetch: ${res.status}` }, { status: 502 });

    const text = await res.text();
    const trimmed = text.slice(0, MAX_CONTENT_CHARS);
    return NextResponse.json({ content: trimmed, url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scrape failed' }, { status: 502 });
  }
}
