/**
 * Shareable debate results.
 *
 * Required Supabase SQL (run once in the SQL editor):
 *
 *   create table if not exists shared_results (
 *     id         uuid primary key default gen_random_uuid(),
 *     prompt     text not null,
 *     mode       text not null,
 *     result_json jsonb not null,
 *     created_at timestamptz default now()
 *   );
 *   alter table shared_results enable row level security;
 *   create policy "Public read"  on shared_results for select using (true);
 *   create policy "Public insert" on shared_results for insert with check (true);
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import type { AppResult } from '@/types';

export const dynamic = 'force-dynamic';

// POST /api/share — save a result, return { id }
export async function POST(request: NextRequest) {
  try {
    const { result } = (await request.json()) as { result: AppResult };
    if (!result?.prompt) return NextResponse.json({ error: 'result required' }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shared_results')
      .insert({ prompt: result.prompt, mode: result.mode, result_json: result })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[/api/share POST]', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

// GET /api/share?id=<uuid> — fetch a saved result
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shared_results')
      .select('result_json, prompt, mode')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/share GET]', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
