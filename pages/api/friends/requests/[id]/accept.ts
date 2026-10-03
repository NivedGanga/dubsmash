import type { UserFriendRow } from '@/types/database';
import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { notify } from '@/lib/server/notify';
import { broadcastUser } from '@/lib/server/realtime';
import { requireFriendSystem } from '@/lib/server/friends';

/** Recipient accepts a pending request; the sender is notified. */
export default createHandler(
  {
    PATCH: async (req): Promise<{ friendship: UserFriendRow }> => {
      await requireFriendSystem(req.user);
      const { data, error } = await supabaseAdmin()
        .from('user_friends')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', queryParam(req, 'id'))
        .eq('friend_id', req.user.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound('Friend request');
      const friendship = data as UserFriendRow;
      await notify({
        userId: friendship.user_id,
        type: 'friend_accepted',
        message: `${req.user.display_name} (@${req.user.username}) accepted your friend request.`,
        metadata: { sender_id: req.user.id },
      });
      await broadcastUser(friendship.user_id, { type: 'friends:changed' });
      return { friendship };
    },
  },
  { auth: requireAuth },
);
