import { z } from 'zod';
import type { UserRow } from '@/types/database';
import { badRequest, createHandler, parseBody, queryParam, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { notify } from '@/lib/server/notify';

const schema = z
  .object({
    role: z.enum(['user', 'admin', 'super_admin']),
    status: z.enum(['active', 'inactive', 'banned']),
  })
  .partial()
  .strict();

/** Super admin: change a game user's role badge or status (suspend/ban). */
export default createHandler<AdminAuthedRequest>(
  {
    PATCH: async (req) => {
      const id = queryParam(req, 'id');
      const patch = parseBody(schema, req);
      if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.');
      const { data, error } = await supabaseAdmin().from('users').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      const user = data as UserRow;
      if (patch.status === 'banned') {
        await notify({
          userId: user.id,
          type: 'access_rejected',
          message: 'Your account has been suspended. Contact support if you think this is a mistake.',
          metadata: { sender_id: req.admin.id },
        });
      }
      return { user };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
