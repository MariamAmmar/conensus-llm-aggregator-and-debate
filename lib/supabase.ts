import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = !!(url && key);

/**
 * Recursive no-op proxy — returned when env vars are missing.
 * Any property access returns another proxy; any call returns a resolved
 * Promise so async callers don't crash.  onAuthStateChange is the one
 * synchronous exception: it must return { data: { subscription } } so we
 * special-case it.
 */
function makeNullProxy(): SupabaseClient {
  const handler: ProxyHandler<() => unknown> = {
    get(_target, prop) {
      // Prevent the proxy from being mistaken for a thenable
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      return new Proxy(function nullFn() {}, handler);
    },
    apply(_target, _this, args) {
      // onAuthStateChange must return synchronously with a subscription object
      // We detect it by whether the first arg looks like a callback
      if (typeof args[0] === 'function') {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  return new Proxy(function nullFn() {}, handler) as unknown as SupabaseClient;
}

function makeClient(): SupabaseClient {
  if (!supabaseConfigured) return makeNullProxy();
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

// Browser / server-component client
export const supabase = makeClient();

// Server client factory — used in API routes with the user's JWT
export function createServerClient(accessToken: string): SupabaseClient {
  if (!supabaseConfigured) return supabase;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
