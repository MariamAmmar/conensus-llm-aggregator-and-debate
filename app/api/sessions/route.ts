import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase';
import type { ChatSession } from '@/types';

function getAuthClient(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: auth ? { headers: { Authorization: auth } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '';
}

function mapRows(rows: Record<string, unknown>[]): ChatSession[] {
  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    mode: row.mode as ChatSession['mode'],
    timestamp: new Date(row.created_at as string),
    turns: row.turns as ChatSession['turns'],
    conversation: row.conversation as ChatSession['conversation'],
    providerConversations: row.provider_conversations as ChatSession['providerConversations'],
    debateConversation: row.debate_conversation as ChatSession['debateConversation'],
  }));
}

// GET /api/sessions
export async function GET(request: NextRequest) {
  const client = getAuthClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (user) {
    // Authenticated — use the user's own client (RLS scopes to their rows)
    const { data, error } = await client
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(mapRows(data ?? []));
  }

  // Anonymous — use admin client so RLS doesn't block null user_id rows, filter by IP
  const ip = getIP(request);
  if (!ip) return NextResponse.json([]);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sessions')
    .select('*')
    .is('user_id', null)
    .eq('anon_ip', ip)
    .order('created_at', { ascending: false })
    .limit(20);

  // anon_ip column might not exist yet if migration is pending
  if (error?.message?.includes('anon_ip') || error?.message?.includes('column')) {
    return NextResponse.json([]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapRows(data ?? []));
}

// POST /api/sessions
export async function POST(request: NextRequest) {
  const client = getAuthClient(request);
  const { data: { user } } = await client.auth.getUser();
  const session: ChatSession = await request.json();
  const ip = !user ? getIP(request) : null;

  const row: Record<string, unknown> = {
    id: session.id,
    user_id: user?.id ?? null,
    title: session.title,
    mode: session.mode,
    turns: session.turns,
    conversation: session.conversation,
    provider_conversations: session.providerConversations,
    debate_conversation: session.debateConversation,
    created_at: session.timestamp,
  };
  if (ip) row.anon_ip = ip;

  // Authenticated: let RLS handle it. Anonymous: use admin client to bypass RLS
  // (anonymous sessions have user_id = null which RLS would block with anon key)
  const writeClient = user ? client : createAdminClient();
  let { error } = await writeClient.from('sessions').upsert(row);

  // anon_ip column might not exist yet — retry without it
  if (error?.message?.includes('anon_ip')) {
    delete row.anon_ip;
    ({ error } = await writeClient.from('sessions').upsert(row));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/sessions?id=xxx
export async function DELETE(request: NextRequest) {
  const client = getAuthClient(request);
  const { data: { user } } = await client.auth.getUser();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (user) {
    const { error } = await client.from('sessions').delete().eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Anonymous delete via admin client — scope to the caller's IP for safety
    const ip = getIP(request);
    const admin = createAdminClient();
    const query = admin.from('sessions').delete().eq('id', id).is('user_id', null);
    const { error } = ip ? await query.eq('anon_ip', ip) : await query;
    // Ignore anon_ip column errors (migration pending)
    if (error && !error.message?.includes('anon_ip')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
