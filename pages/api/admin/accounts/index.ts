import type { PublicAdminAccount } from '@/types/api';
import type { AdminAccountRow } from '@/types/database';
import { createHandler, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount, toPublicAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

/** Super admin only: list every admin account (newest first). */
export default createHandler<AdminAuthedRequest>(
  {
    GET: async (): Promise<{ accounts: PublicAdminAccount[] }> => {
      const { data, error } = await supabaseAdmin().from('admin_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return { accounts: ((data ?? []) as AdminAccountRow[]).map(toPublicAdminAccount) };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
