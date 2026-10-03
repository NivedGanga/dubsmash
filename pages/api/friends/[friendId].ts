import { badRequest, createHandler, notFound, queryParam } from '@/lib/server/handler';
import { isUuid } from '@/lib/utils';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { broadcastUser } from '@/lib/server/realtime';

/** Remove a friend (deletes the accepted friendship in either direction). */
export default createHandler(
  {
    DELETE: async (req) => {
      const friendId = queryParam(req, 'friendId');
      // Interpolated into a PostgREST filter below: must be a strict UUID.
      if (!isUuid(friendId)) throw badRequest('Invalid friend id.');
      const me = req.user.id;
      const { data, error } = await supabaseAdmin()
        .from('user_friends')
        .delete()
        .eq('status', 'accepted')
        .or(`and(user_id.eq.${me},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${me})`)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw notFound('Friend');
      await broadcastUser(friendId, { type: 'friends:changed' });
      return undefined;
    },
  },
  { auth: requireAuth },
);
