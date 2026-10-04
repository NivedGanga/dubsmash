import { z } from 'zod';
import type { PublicAdminAccount } from '@/types/api';
import type { AdminAccountRow } from '@/types/database';
import { createHandler, forbidden, notFound, parseBody, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount, toPublicAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

const schema = z
  .object({
    status: z.enum(['active', 'rejected', 'banned', 'pending']).optional(),
    role: z.enum(['admin', 'super_admin']).optional(),
  })
  .refine((v) => v.status !== undefined || v.role !== undefined, { message: 'Nothing to update.' });

/**
 * Super admin only: approve (status=active), reject/ban, or change the role of an admin account.
 * A super admin cannot suspend or demote their own account — that would lock the portal out.
 */
export default createHandler<AdminAuthedRequest>(
  {
    PATCH: async (req): Promise<{ account: PublicAdminAccount }> => {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      const body = parseBody(schema, req);
      if (id === req.admin.id) throw forbidden('You cannot change your own role or status.');
      const { data, error } = await supabaseAdmin()
        .from('admin_accounts')
        .update({ ...(body.status ? { status: body.status } : {}), ...(body.role ? { role: body.role } : {}) })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound('Admin account');
      return { account: toPublicAdminAccount(data as AdminAccountRow) };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
