import type { FriendEntry, PublicUser } from '@/types/api';
import type { UserRow } from '@/types/database';
import { createHandler } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { friendshipsOf, otherSide, requireFriendSystem } from '@/lib/server/friends';
import { PUBLIC_USER_COLUMNS, isRecentlySeen } from '@/lib/server/users';

/**
 * Accepted friends sorted by name, with `online` based on last_seen_at (heartbeat). The client merges
 * this with live Realtime presence for instant updates.
 */
export default createHandler(
  {
    GET: async (req): Promise<{ friends: Array<FriendEntry & { online: boolean }> }> => {
      await requireFriendSystem(req.user);
      const rows = await friendshipsOf(req.user.id, 'accepted');
      const ids = rows.map((r) => otherSide(r, req.user.id));
      if (ids.length === 0) return { friends: [] };
      const { data, error } = await supabaseAdmin().from('users').select(`${PUBLIC_USER_COLUMNS}, last_seen_at, status`).in('id', ids);
      if (error) throw error;
      const users = new Map(((data ?? []) as Array<PublicUser & Pick<UserRow, 'last_seen_at' | 'status'>>).map((u) => [u.id, u]));
      const friends = rows
        .map((r) => {
          const u = users.get(otherSide(r, req.user.id));
          if (!u || u.status === 'banned') return null;
          const { last_seen_at, status: _status, ...user } = u;
          return { friendship_id: r.id, user, since: r.responded_at ?? r.created_at, online: isRecentlySeen({ last_seen_at }) };
        })
        .filter((f): f is FriendEntry & { online: boolean } => f !== null)
        .sort((a, b) => a.user.display_name.localeCompare(b.user.display_name));
      return { friends };
    },
  },
  { auth: requireAuth },
);
