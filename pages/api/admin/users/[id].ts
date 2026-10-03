import { z } from 'zod';
import type { UserRow } from '@/types/database';
import { badRequest, createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { supabaseAdmin } from '@/lib/server/supabase';
import { notify } from '@/lib/server/notify';

const schema = z
  .object({
    role: z.enum(['user', 'admin', 'super_admin']),
    status: z.enum(['active', 'inactive', 'banned']),
  })
  .partial()
  .strict();

/** Super admin: change a user's role (incl. promote to super admin) or status. */
export default createHandler(
  {
    PATCH: async (req) => {
      const id = queryParam(req, 'id');
      const patch = parseBody(schema, req);
      if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.');
      if (id === req.user.id) throw badRequest('You cannot change your own role or status.');
      const { data, error } = await supabaseAdmin().from('users').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      const user = data as UserRow;
      if (patch.role === 'super_admin' || patch.role === 'admin') {
        await notify({
          userId: user.id,
          type: 'access_approved',
          message: patch.role === 'super_admin' ? 'You were promoted to super admin.' : 'You were granted admin portal access.',
          metadata: { sender_id: req.user.id },
        });
      }
      return { user };
    },
  },
  { auth: requireSuperAdmin },
);
