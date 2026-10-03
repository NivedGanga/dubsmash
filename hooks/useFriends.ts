import { useEffect, useMemo } from 'react';
import type { FriendEntry } from '@/types/api';
import { subscribeUser } from '@/lib/realtime';
import { useSession } from '@/store/session';
import { useApi } from './useApi';

export type FriendWithStatus = FriendEntry & { online: boolean };

/** Friends list with live online status (Realtime presence OR recent heartbeat). */
export function useFriends() {
  const me = useSession((s) => s.me);
  const online = useSession((s) => s.onlineUserIds);
  const enabled = !!me?.flags.friend_system_enabled;
  const { data, error, loading, reload } = useApi<{ friends: FriendWithStatus[] }>(enabled ? '/api/friends/list' : null);

  useEffect(() => {
    if (!me || !enabled) return;
    return subscribeUser(me.user.id, (e) => {
      if (e.type === 'friends:changed') void reload();
    });
  }, [me, enabled, reload]);

  const friends = useMemo(
    () =>
      (data?.friends ?? [])
        .map((f) => ({ ...f, online: f.online || online.has(f.user.id) }))
        .sort((a, b) => Number(b.online) - Number(a.online) || a.user.display_name.localeCompare(b.user.display_name)),
    [data, online],
  );
  return { friends, error, loading, reload, enabled, onlineCount: friends.filter((f) => f.online).length };
}
