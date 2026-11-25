import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Server-side Supabase client.
 *
 * JavaScript rather than the TypeScript helper from the docs, because this
 * app is Next 14 with plain .js files.
 */
export function createClient(cookieStore) {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* called from a Server Component; middleware refreshes the session */
        }
      },
    },
  });
}

/** a client that needs no cookies, for public reads from a route handler */
export function createAnonClient() {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
