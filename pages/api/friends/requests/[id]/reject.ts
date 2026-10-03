import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

/**
 * Recipient rejects (or sender cancels) a pending request. The row is deleted so rejected requests
 * leave no history and create no further notifications.
 */
export default createHandler(
  {
    PATCH: async (req) => {
      const id = queryParam(req, 'id');
      const { data, error } = await supabaseAdmin()
        .from('user_friends')
        .delete()
        .eq('id', id)
        .eq('status', 'pending')
        .or(`friend_id.eq.${req.user.id},user_id.eq.${req.user.id}`)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw notFound('Friend request');
      return { ok: true };
    },
  },
  { auth: requireAuth },
);
