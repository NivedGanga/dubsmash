import type { FeatureFlagRow, FlagChangeLogRow } from '@/types/database';
import { createHandler } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { listFlags } from '@/lib/server/featureFlags';
import { supabaseAdmin } from '@/lib/server/supabase';

/** Super admin: all flags plus the 50 most recent changes (with who made them). */
export default createHandler(
  {
    GET: async (): Promise<{ flags: FeatureFlagRow[]; history: Array<FlagChangeLogRow & { changed_by_user: { username: string } | null }> }> => {
      const [flags, { data, error }] = await Promise.all([
        listFlags(),
        supabaseAdmin()
          .from('flag_change_log')
          .select('*, changed_by_user:users!flag_change_log_changed_by_fkey(username)')
          .order('changed_at', { ascending: false })
          .limit(50),
      ]);
      if (error) throw error;
      return { flags, history: (data ?? []) as Array<FlagChangeLogRow & { changed_by_user: { username: string } | null }> };
    },
  },
  { auth: requireSuperAdmin },
);
