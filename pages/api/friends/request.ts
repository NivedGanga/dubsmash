import { z } from 'zod';
import type { UserFriendRow } from '@/types/database';
import { badRequest, conflict, createHandler, notFound, parseBody } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { notify } from '@/lib/server/notify';
import { broadcastUser } from '@/lib/server/realtime';
import { requireFriendSystem } from '@/lib/server/friends';
import { getUserById } from '@/lib/server/users';

const schema = z.object({ to_user_id: z.string().uuid() });

/** Send a friend request. Duplicates (either direction) are rejected. */
export default createHandler(
  {
    POST: async (req, res): Promise<{ request: UserFriendRow }> => {
      await requireFriendSystem(req.user);
      const { to_user_id } = parseBody(schema, req);
      if (to_user_id === req.user.id) throw badRequest("You can't friend yourself.");
      const target = await getUserById(to_user_id);
      if (!target || target.status !== 'active') throw notFound('User');

      const sb = supabaseAdmin();
      const { data: existing, error: exErr } = await sb
        .from('user_friends')
        .select('*')
        .or(`and(user_id.eq.${req.user.id},friend_id.eq.${to_user_id}),and(user_id.eq.${to_user_id},friend_id.eq.${req.user.id})`)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) {
        const row = existing as UserFriendRow;
        if (row.status === 'accepted') throw conflict('You are already friends.');
        if (row.status === 'blocked') throw conflict('You cannot send a request to this player.');
        throw conflict(row.user_id === req.user.id ? 'Request already sent.' : 'They already sent you a request — check your notifications.');
      }

      const { data, error } = await sb.from('user_friends').insert({ user_id: req.user.id, friend_id: to_user_id }).select('*').single();
      if (error) throw error;
      const request = data as UserFriendRow;
      await notify({
        userId: to_user_id,
        type: 'friend_request',
        message: `${req.user.display_name} (@${req.user.username}) sent you a friend request.`,
        metadata: { request_id: request.id, sender_id: req.user.id },
      });
      await broadcastUser(to_user_id, { type: 'friends:changed' });
      res.status(201);
      return { request };
    },
  },
  { auth: requireAuth },
);
