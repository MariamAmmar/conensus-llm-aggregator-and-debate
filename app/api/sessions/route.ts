import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ChatSession } from '@/types';

// GET /api/sessions — fetch all sessions (anonymous for now)
export async function GET() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map DB rows back to ChatSession shape
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

// POST /api/sessions — save a session
export async function POST(request: NextRequest) {
  const session: ChatSession = await request.json();

  const { error } = await supabase.from('sessions').upsert({
    id: session.id,
    user_id: null,
    title: session.title,
    mode: session.mode,
    turns: session.turns,
    conversation: session.conversation,
    provider_conversations: session.providerConversations,
    debate_conversation: session.debateConversation,
    created_at: session.timestamp,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/sessions?id=xxx — delete a session
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id)
    .is('user_id', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
