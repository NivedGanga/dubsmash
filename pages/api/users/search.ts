import { z } from 'zod';
import type { PublicUser } from '@/types/api';
import { createHandler, parseQuery } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { PUBLIC_USER_COLUMNS } from '@/lib/server/users';
import { escapeLike } from '@/lib/server/validation';

const schema = z.object({ q: z.string().trim().min(2).max(20) });

/** Username prefix search for "Invite Friends". Never exposes emails. */
export default createHandler(
  {
    GET: async (req): Promise<{ users: PublicUser[] }> => {
      const { q } = parseQuery(schema, req);
      const { data, error } = await supabaseAdmin()
        .from('users')
        .select(PUBLIC_USER_COLUMNS)
        .ilike('username', `${escapeLike(q)}%`)
        .eq('status', 'active')
        .neq('id', req.user.id)
        .order('username')
        .limit(10);
      if (error) throw error;
      return { users: (data ?? []) as PublicUser[] };
    },
  },
  { auth: requireAuth },
);
