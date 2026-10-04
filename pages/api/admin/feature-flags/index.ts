import type { FeatureFlagRow, FlagChangeLogRow } from '@/types/database';
import { createHandler } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { listFlags } from '@/lib/server/featureFlags';
import { supabaseAdmin } from '@/lib/server/supabase';

/** Super admin: all flags plus the 50 most recent changes (with which admin made them). */
export default createHandler(
  {
    GET: async (): Promise<{ flags: FeatureFlagRow[]; history: Array<FlagChangeLogRow & { changed_by_admin: { display_name: string } | null }> }> => {
      const [flags, { data, error }] = await Promise.all([
        listFlags(),
        supabaseAdmin()
          .from('flag_change_log')
          .select('*, changed_by_admin:admin_accounts!flag_change_log_changed_by_fkey(display_name)')
          .order('changed_at', { ascending: false })
          .limit(50),
      ]);
      if (error) throw error;
      return { flags, history: (data ?? []) as Array<FlagChangeLogRow & { changed_by_admin: { display_name: string } | null }> };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
