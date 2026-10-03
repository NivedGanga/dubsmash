import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Browser (anon key) client. Used only for Realtime broadcast + presence; every table has RLS
 * enabled without policies, so it cannot read or write data. All data goes through /api.
 * The server-side service-role client lives in lib/server/supabase.ts.
 */
export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        params: { eventsPerSecond: 20 },
        // Exponential backoff for reconnects: 2s, 4s, 8s, 16s ... capped at 5 minutes.
        reconnectAfterMs: (tries: number) => Math.min(5 * 60 * 1000, 2000 * 2 ** Math.max(0, tries - 1)),
      },
    });
  }
  return browserClient;
}
