import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase';

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '';
}

// POST /api/sessions/claim
// Called on login — claims all anonymous sessions from this IP for the logged-in user.
// Requires the anon_ip migration to have been run; fails silently otherwise.
export async function POST(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(url, key, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = getIP(request);
  if (!ip) return NextResponse.json({ claimed: 0 });

  // Admin client bypasses RLS so we can update sessions owned by no one
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sessions')
    .update({ user_id: user.id })
    .is('user_id', null)
    .eq('anon_ip', ip)
    .select('id');

  if (error) {
    // Migration hasn't been run yet — degrade gracefully
    if (error.message?.includes('anon_ip') || error.message?.includes('column')) {
      return NextResponse.json({ claimed: 0, note: 'migration_pending' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claimed: data?.length ?? 0 });
}
