import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ProviderId, ModelMode, ModelResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { prompt, winnerProvider, responses, mode } = await request.json() as {
      prompt: string;
      winnerProvider: ProviderId;
      responses: ModelResponse[];
      mode: ModelMode;
    };

    if (!prompt || !winnerProvider || !responses || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('votes').insert({
      prompt,
      winner_provider: winnerProvider,
      responses,
      mode,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/vote]', err);
    return NextResponse.json(
      { error: 'Failed to record vote', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
