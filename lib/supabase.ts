import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function makeClient(): SupabaseClient {
  if (!url || !key) {
    // Return a no-op proxy during build / when env vars are absent.
    // All calls will return empty data rather than crashing the build.
    return new Proxy({} as SupabaseClient, {
      get: () => () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    });
  }
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

// Browser client — handles auth state automatically
export const supabase = makeClient();

// Server client factory — used in API routes with user's JWT
export function createServerClient(accessToken: string): SupabaseClient {
  if (!url || !key) return supabase;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
