import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

/** Dismiss (delete) a notification. */
export default createHandler(
  {
    DELETE: async (req) => {
      const { data, error } = await supabaseAdmin()
        .from('notifications')
        .delete()
        .eq('id', queryParam(req, 'id'))
        .eq('user_id', req.user.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw notFound('Notification');
      return undefined;
    },
  },
  { auth: requireAuth },
);
