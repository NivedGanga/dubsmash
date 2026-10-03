import { z } from 'zod';
import type { AccessRequestRow } from '@/types/database';
import type { AccessRequestWithUser, AdminAccessState } from '@/types/api';
import { conflict, createHandler, forbidden, parseBody, parseQuery } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { notifySuperAdmins } from '@/lib/server/notify';
import { adminAccessState } from '@/lib/server/users';

const createSchema = z.object({ message: z.string().trim().max(500).optional() });
const listSchema = z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') });

export default createHandler(
  {
    /** Super admin: list access requests (default: pending). */
    GET: async (req): Promise<{ requests: AccessRequestWithUser[] }> => {
      if (req.user.role !== 'super_admin') throw forbidden('Only the super admin can review access requests.');
      const { status } = parseQuery(listSchema, req);
      const { data, error } = await supabaseAdmin()
        .from('access_requests')
        .select('*, user:users!access_requests_user_id_fkey(id, username, display_name, email)')
        .eq('status', status)
        .order('requested_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return { requests: (data ?? []) as AccessRequestWithUser[] };
    },

    /** Any signed-in user: request admin-portal access. */
    POST: async (req, res): Promise<{ access: AdminAccessState; request?: AccessRequestRow }> => {
      const { message } = parseBody(createSchema, req);
      const current = await adminAccessState(req.user);
      if (current.status === 'granted') return { access: current };
      if (current.status === 'pending') throw conflict('You already have a pending request.');

      const { data, error } = await supabaseAdmin()
        .from('access_requests')
        .insert({ user_id: req.user.id, message: message || null })
        .select('*')
        .single();
      if (error) throw error;
      const request = data as AccessRequestRow;
      await notifySuperAdmins('access_request', `${req.user.display_name} (@${req.user.username}) requested admin portal access.`, {
        request_id: request.id,
        sender_id: req.user.id,
      });
      res.status(201);
      return { access: { status: 'pending', request_id: request.id }, request };
    },
  },
  { auth: requireAuth },
);
