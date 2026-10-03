import { createHandler } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

export default createHandler(
  {
    PATCH: async (req) => {
      const { error } = await supabaseAdmin().from('notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
      if (error) throw error;
      return { ok: true };
    },
  },
  { auth: requireAuth },
);
