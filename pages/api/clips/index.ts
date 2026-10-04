import { z } from 'zod';
import type { ClipListResponse, ClipWithOwner } from '@/types/api';
import { createHandler, forbidden, parseQuery, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { normaliseClip } from '@/lib/server/clips';
import { pageRange, paginationSchema } from '@/lib/server/validation';

const schema = paginationSchema.extend({
  status: z.enum(['pending', 'active', 'rejected', 'archived']).optional(),
  character_count: z.coerce.number().int().min(1).max(4).optional(),
  min_duration: z.coerce.number().min(0).optional(),
  max_duration: z.coerce.number().min(0).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  q: z.string().trim().max(100).optional(),
  folder_id: z.union([z.string().uuid(), z.literal('root')]).optional(),
  owner: z.string().uuid().optional(),
  /** Super admin approval queue: pending + configured. */
  queue: z.enum(['approval']).optional(),
  sort: z.enum(['newest', 'oldest', 'most_used', 'alphabetical']).default('newest'),
});

const SORTS = {
  newest: ['created_at', false],
  oldest: ['created_at', true],
  most_used: ['times_played', false],
  alphabetical: ['title', true],
} as const;

/**
 * Admin clip library. Regular admins see only their own clips; super admins see everything
 * (optionally scoped to one owner: the "each username is a folder" view).
 */
export default createHandler<AdminAuthedRequest>(
  {
    GET: async (req): Promise<ClipListResponse> => {
      const f = parseQuery(schema, req);
      const isSuper = req.admin.role === 'super_admin';
      if (f.owner && !isSuper && f.owner !== req.admin.id) throw forbidden("You can only view your own clips.");
      const [from, to] = pageRange(f.page, f.page_size);
      const [col, asc] = SORTS[f.sort];

      let q = supabaseAdmin()
        .from('clips')
        .select('*, owner:admin_accounts!clips_uploaded_by_fkey(id, display_name)', { count: 'exact' })
        .order(col, { ascending: asc })
        .order('id')
        .range(from, to);

      if (!isSuper) q = q.eq('uploaded_by', req.admin.id);
      else if (f.owner) q = q.eq('uploaded_by', f.owner);
      if (f.queue === 'approval') q = q.eq('status', 'pending').eq('is_configured', true);
      else if (f.status) q = q.eq('status', f.status);
      if (f.character_count) q = q.eq('character_count', f.character_count);
      if (f.min_duration !== undefined) q = q.gte('duration_seconds', f.min_duration);
      if (f.max_duration !== undefined) q = q.lte('duration_seconds', f.max_duration);
      if (f.from) q = q.gte('created_at', f.from);
      if (f.to) q = q.lte('created_at', f.to);
      if (f.folder_id === 'root') q = q.is('folder_id', null);
      else if (f.folder_id) q = q.eq('folder_id', f.folder_id);
      if (f.q) q = q.textSearch('search_vector', f.q, { type: 'websearch', config: 'simple' });

      const { data, count, error } = await q;
      if (error) throw error;
      return { items: ((data ?? []) as ClipWithOwner[]).map(normaliseClip), page: f.page, page_size: f.page_size, total: count ?? 0 };
    },
  },
  { adminAuth: requireAdminAccount },
);
