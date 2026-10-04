import type { AdminStats } from '@/types/api';
import type { JobStatus } from '@/types/database';
import { createHandler, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

/** Dashboard numbers. Super admins see platform-wide stats; regular admins see their own clips. */
export default createHandler<AdminAuthedRequest>(
  {
    GET: async (req): Promise<AdminStats> => {
      const sb = supabaseAdmin();
      const isSuper = req.admin.role === 'super_admin';
      const base = (table: string) => sb.from(table).select('id', { count: 'exact', head: true });
      type Query = ReturnType<typeof base>;
      const count = async (table: string, apply: (q: Query) => Query = (q) => q) => {
        const { count: c, error } = await apply(base(table));
        if (error) throw error;
        return c ?? 0;
      };
      const mine = (q: Query) => (isSuper ? q : q.eq('uploaded_by', req.admin.id));
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const statuses: JobStatus[] = ['pending', 'processing', 'completed', 'failed'];

      const [total_clips, pending_clips, active_clips, total_users, pending_access_requests, sessions_last_7_days, ...queue] =
        await Promise.all([
          count('clips', (q) => mine(q)),
          count('clips', (q) => mine(q).eq('status', 'pending')),
          count('clips', (q) => mine(q).eq('status', 'active')),
          isSuper ? count('users') : Promise.resolve(0),
          isSuper ? count('admin_accounts', (q) => q.eq('status', 'pending')) : Promise.resolve(0),
          count('game_sessions', (q) => q.gte('created_at', weekAgo)),
          ...statuses.map((s) => (isSuper ? count('video_processing_queue', (q) => q.eq('status', s)) : Promise.resolve(0))),
        ]);

      return {
        total_clips,
        pending_clips,
        active_clips,
        total_users,
        pending_access_requests,
        sessions_last_7_days,
        processing_queue: Object.fromEntries(statuses.map((s, i) => [s, queue[i] ?? 0])) as Record<JobStatus, number>,
      };
    },
  },
  { adminAuth: requireAdminAccount },
);
