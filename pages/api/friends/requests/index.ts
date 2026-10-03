import type { FriendRequestEntry } from '@/types/api';
import { createHandler } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { friendshipsOf, otherSide, requireFriendSystem } from '@/lib/server/friends';
import { getPublicUsers, toPublicUser } from '@/lib/server/users';

/** Pending friend requests (incoming first). */
export default createHandler(
  {
    GET: async (req): Promise<{ requests: FriendRequestEntry[] }> => {
      await requireFriendSystem(req.user);
      const rows = await friendshipsOf(req.user.id, 'pending');
      const users = new Map((await getPublicUsers(rows.map((r) => otherSide(r, req.user.id)))).map((u) => [u.id, u]));
      const me = toPublicUser(req.user);
      const requests = rows
        .map((r): FriendRequestEntry | null => {
          const other = users.get(otherSide(r, req.user.id));
          if (!other) return null;
          const incoming = r.friend_id === req.user.id;
          return { id: r.id, from: incoming ? other : me, to: incoming ? me : other, created_at: r.created_at, direction: incoming ? 'incoming' : 'outgoing' };
        })
        .filter((r): r is FriendRequestEntry => r !== null)
        .sort((a, b) => Number(b.direction === 'incoming') - Number(a.direction === 'incoming') || b.created_at.localeCompare(a.created_at));
      return { requests };
    },
  },
  { auth: requireAuth },
);
