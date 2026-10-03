import type { NotificationRow } from '@/types/database';
import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

/** Mark one notification as read (read_at is stamped by a DB trigger). */
export default createHandler(
  {
    PATCH: async (req) => {
      const { data, error } = await supabaseAdmin()
        .from('notifications')
        .update({ is_read: true })
        .eq('id', queryParam(req, 'id'))
        .eq('user_id', req.user.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound('Notification');
      return { notification: data as NotificationRow };
    },
  },
  { auth: requireAuth },
);
