import { z } from 'zod';
import type { Paginated, PlayableClip } from '@/types/api';
import { createHandler, parseQuery } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { normaliseClip } from '@/lib/server/clips';
import { pageRange, paginationSchema } from '@/lib/server/validation';

const schema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  character_count: z.coerce.number().int().min(1).max(4).optional(),
  max_duration: z.coerce.number().min(0).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  sort: z.enum(['popular', 'newest', 'alphabetical']).default('popular'),
});

const COLUMNS = 'id, title, description, thumbnail_url, duration_seconds, trim_start, trim_end, difficulty, character_count, characters, times_played';

/**
 * Clips players can start a game with: only active, fully configured clips. The timeline (dialogue
 * text and exact timing) is not exposed here — players only see roles, duration and a preview.
 */
export default createHandler(
  {
    GET: async (req): Promise<Paginated<PlayableClip>> => {
      const f = parseQuery(schema, req);
      const [from, to] = pageRange(f.page, f.page_size);
      const order = f.sort === 'popular' ? 'times_played' : f.sort === 'newest' ? 'created_at' : 'title';
      let q = supabaseAdmin()
        .from('clips')
        .select(COLUMNS, { count: 'exact' })
        .eq('status', 'active')
        .eq('is_configured', true)
        .gte('character_count', 1)
        .order(order, { ascending: f.sort === 'alphabetical' })
        .range(from, to);
      if (f.q) q = q.textSearch('search_vector', f.q, { type: 'websearch', config: 'simple' });
      if (f.character_count) q = q.eq('character_count', f.character_count);
      if (f.max_duration) q = q.lte('duration_seconds', f.max_duration);
      if (f.difficulty) q = q.eq('difficulty', f.difficulty);
      const { data, count, error } = await q;
      if (error) throw error;
      return { items: ((data ?? []) as PlayableClip[]).map(normaliseClip), page: f.page, page_size: f.page_size, total: count ?? 0 };
    },
  },
  { auth: requireAuth },
);
