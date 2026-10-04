import { z } from 'zod';
import type { UserRow } from '@/types/database';
import type { Paginated } from '@/types/api';
import { createHandler, parseQuery } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { escapeLike, pageRange, paginationSchema } from '@/lib/server/validation';

const schema = paginationSchema.extend({
  q: z.string().trim().max(40).optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
});

type AdminUser = Pick<UserRow, 'id' | 'email' | 'username' | 'display_name' | 'role' | 'status' | 'clips_created' | 'games_played' | 'created_at' | 'last_seen_at'>;

/** Super admin user directory (used for role management and the per-user folder view). */
export default createHandler(
  {
    GET: async (req): Promise<Paginated<AdminUser>> => {
      const { page, page_size, q, role } = parseQuery(schema, req);
      const [from, to] = pageRange(page, page_size);
      let query = supabaseAdmin()
        .from('users')
        .select('id, email, username, display_name, role, status, clips_created, games_played, created_at, last_seen_at', { count: 'exact' })
        .order('created_at', { ascending: true })
        .range(from, to);
      if (q) query = query.or(`username.ilike.%${escapeLike(q).replace(/[,()]/g, '')}%,display_name.ilike.%${escapeLike(q).replace(/[,()]/g, '')}%`);
      if (role) query = query.eq('role', role);
      const { data, count, error } = await query;
      if (error) throw error;
      return { items: (data ?? []) as AdminUser[], page, page_size, total: count ?? 0 };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
