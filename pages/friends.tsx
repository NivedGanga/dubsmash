import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FriendRequestEntry, PublicUser } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { subscribeUser } from '@/lib/realtime';
import { useApi } from '@/hooks/useApi';
import { useFriends } from '@/hooks/useFriends';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { toast } from '@/store/toast';
import { Shell } from '@/components/Layout/Shell';
import { AvatarBadge } from '@/components/Common/AvatarBadge';
import { EmptyState, FullPageSpinner } from '@/components/Common/ui';

export default function FriendsPage() {
  const { me, allowed } = useRequireAuth();
  const enabled = !!me?.flags.friend_system_enabled;
  const { friends, reload: reloadFriends } = useFriends();
  const requests = useApi<{ requests: FriendRequestEntry[] }>(allowed && enabled ? '/api/friends/requests' : null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reloadRequests = requests.reload;
  useEffect(() => {
    if (!me || !enabled) return;
    return subscribeUser(me.user.id, (e) => {
      if (e.type === 'friends:changed' || e.type === 'notification:new') void reloadRequests();
    });
  }, [me, enabled, reloadRequests]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults([]);
    const t = setTimeout(async () => {
      try {
        setResults((await api<{ users: PublicUser[] }>('/api/users/search', { query: { q: term } })).users);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await Promise.all([requests.reload(), reloadFriends()]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!allowed || !me) return <Shell><FullPageSpinner /></Shell>;
  if (!enabled) return <Shell><EmptyState title="Friends are turned off right now">You can still play solo from the <Link href="/game" className="text-brand-300 hover:underline">Play</Link> screen.</EmptyState></Shell>;

  const friendIds = new Set(friends.map((f) => f.user.id));
  const pendingIds = new Set((requests.data?.requests ?? []).flatMap((r) => [r.from.id, r.to.id]));
  const incoming = requests.data?.requests.filter((r) => r.direction === 'incoming') ?? [];
  const outgoing = requests.data?.requests.filter((r) => r.direction === 'outgoing') ?? [];

  return (
    <Shell>
      <h1 className="mb-6 font-display text-3xl font-black">Friends</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="font-bold">Find players</h2>
            <input className="input" placeholder="Search by username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
            <ul className="space-y-2">
              {results.map((u) => (
                <li key={u.id} className="flex items-center gap-3">
                  <AvatarBadge user={u} size={36} />
                  <div className="flex-1">
                    <p className="font-semibold">{u.display_name}</p>
                    <p className="text-xs text-ink-400">@{u.username}</p>
                  </div>
                  {friendIds.has(u.id) ? (
                    <span className="text-xs text-green-400">Friends ✓</span>
                  ) : pendingIds.has(u.id) ? (
                    <span className="text-xs text-ink-400">Pending</span>
                  ) : (
                    <button
                      className="btn-primary py-1 text-sm"
                      disabled={busy === u.id}
                      onClick={() => void act(u.id, () => api('/api/friends/request', { method: 'POST', body: { to_user_id: u.id } }), `Request sent to @${u.username}`)}
                    >
                      Add friend
                    </button>
                  )}
                </li>
              ))}
              {q.trim().length >= 2 && results.length === 0 && <li className="text-sm text-ink-400">No players found.</li>}
            </ul>
          </section>

          {incoming.length > 0 && (
            <section className="card space-y-3">
              <h2 className="font-bold">Requests for you</h2>
              {incoming.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <AvatarBadge user={r.from} size={36} />
                  <div className="flex-1">
                    <p className="font-semibold">{r.from.display_name}</p>
                    <p className="text-xs text-ink-400">@{r.from.username} · {timeAgo(r.created_at)}</p>
                  </div>
                  <button className="btn-primary py-1 text-sm" disabled={busy === r.id} onClick={() => void act(r.id, () => api(`/api/friends/requests/${r.id}/accept`, { method: 'PATCH', body: {} }), 'Friend added!')}>Accept</button>
                  <button className="btn-secondary py-1 text-sm" disabled={busy === r.id} onClick={() => void act(r.id, () => api(`/api/friends/requests/${r.id}/reject`, { method: 'PATCH', body: {} }), 'Request declined.')}>Decline</button>
                </div>
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="card space-y-3">
              <h2 className="font-bold">Sent requests</h2>
              {outgoing.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <AvatarBadge user={r.to} size={32} />
                  <p className="flex-1 text-sm">{r.to.display_name} <span className="text-ink-400">@{r.to.username}</span></p>
                  <button className="btn-ghost py-1 text-xs" disabled={busy === r.id} onClick={() => void act(r.id, () => api(`/api/friends/requests/${r.id}/reject`, { method: 'PATCH', body: {} }), 'Request cancelled.')}>Cancel</button>
                </div>
              ))}
            </section>
          )}
        </div>

        <section className="card space-y-3">
          <h2 className="font-bold">Your friends ({friends.length})</h2>
          {friends.length === 0 && <p className="text-sm text-ink-400">Search for players to add your first friend.</p>}
          {friends.map((f) => (
            <div key={f.user.id} className="flex items-center gap-3">
              <AvatarBadge user={f.user} size={40} online={f.online} />
              <div className="flex-1">
                <p className="font-semibold">{f.user.display_name}</p>
                <p className="text-xs text-ink-400">@{f.user.username} · {f.online ? 'online' : 'offline'}</p>
              </div>
              <Link href="/game" className="btn-secondary py-1 text-sm">Invite to game</Link>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                disabled={busy === f.user.id}
                onClick={() => window.confirm(`Remove ${f.user.display_name} from your friends?`) && void act(f.user.id, () => api(`/api/friends/${f.user.id}`, { method: 'DELETE' }), 'Friend removed.')}
              >
                Remove
              </button>
            </div>
          ))}
        </section>
      </div>
    </Shell>
  );
}
