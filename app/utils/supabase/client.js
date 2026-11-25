import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** a single browser client, created once */
let client;

export function createClient() {
  if (!client) client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
