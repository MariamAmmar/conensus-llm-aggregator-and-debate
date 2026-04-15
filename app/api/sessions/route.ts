import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ChatSession } from '@/types';

function getClient(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: auth ? { headers: { Authorization: auth } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// GET /api/sessions
export async function GET(request: NextRequest) {
  const client = getClient(request);
  const { data: { user } } = await client.auth.getUser();

  const query = client.from('sessions').select('*').order('created_at', { ascending: false }).limit(50);
  // Logged-in users get their own sessions; anon gets user_id=null sessions
  const { data, error } = user
    ? await query.eq('user_id', user.id)
    : await query.is('user_id', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions: ChatSession[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    mode: row.mode,
    timestamp: new Date(row.created_at),
    turns: row.turns,
    conversation: row.conversation,
    providerConversations: row.provider_conversations,
    debateConversation: row.debate_conversation,
  }));

  return NextResponse.json(sessions);
}

// POST /api/sessions
export async function POST(request: NextRequest) {
  const client = getClient(request);
  const { data: { user } } = await client.auth.getUser();
  const session: ChatSession = await request.json();

  const { error } = await client.from('sessions').upsert({
    id: session.id,
    user_id: user?.id ?? null,
    title: session.title,
    mode: session.mode,
    turns: session.turns,
    conversation: session.conversation,
    provider_conversations: session.providerConversations,
    debate_conversation: session.debateConversation,
    created_at: session.timestamp,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/sessions?id=xxx
export async function DELETE(request: NextRequest) {
  const client = getClient(request);
  const { data: { user } } = await client.auth.getUser();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const query = client.from('sessions').delete().eq('id', id);
  const { error } = user
    ? await query.eq('user_id', user.id)
    : await query.is('user_id', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
