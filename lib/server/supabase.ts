import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

let admin: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS. Server-only (API routes, worker script). Never ship to the browser.
 * Lazily created so modules can be imported in environments without credentials (build, tests).
 */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.SUPABASE_URL || requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return admin;
}

/** For tests: inject a fake client. */
export function __setSupabaseAdmin(client: SupabaseClient | null): void {
  admin = client;
}
