import { z } from 'zod';
import type { NotificationRow } from '@/types/database';
import type { NotificationListResponse } from '@/types/api';
import { createHandler, parseQuery } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { pageRange, paginationSchema } from '@/lib/server/validation';

const NOTIFICATION_TYPES = [
  'friend_request', 'friend_accepted', 'game_invitation', 'video_ready', 'clip_uploaded', 'clip_approved',
  'clip_rejected', 'access_request', 'access_approved', 'access_rejected', 'lobby_update',
] as const;

const schema = paginationSchema.extend({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  is_read: z.enum(['true', 'false']).optional(),
});

export default createHandler(
  {
    /** Most recent first; expired game invitations are hidden. */
    GET: async (req): Promise<NotificationListResponse> => {
      const { page, page_size, type, is_read } = parseQuery(schema, req);
      const [from, to] = pageRange(page, page_size);
      const notExpired = `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
      let q = supabaseAdmin()
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id)
        .or(notExpired)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (type) q = q.eq('type', type);
      if (is_read) q = q.eq('is_read', is_read === 'true');
      const unread = supabaseAdmin()
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false)
        .or(notExpired);
      const [{ data, count, error }, { count: unreadCount, error: unreadErr }] = await Promise.all([q, unread]);
      if (error) throw error;
      if (unreadErr) throw unreadErr;
      return { items: (data ?? []) as NotificationRow[], page, page_size, total: count ?? 0, unread_count: unreadCount ?? 0 };
    },
  },
  { auth: requireAuth },
);
