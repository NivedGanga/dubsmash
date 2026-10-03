import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import type { NotificationRow } from '@/types/database';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { requestBrowserNotificationPermission, useNotifications } from '@/hooks/useNotifications';
import { toast } from '@/store/toast';
import { refreshMe } from './SessionProvider';

const meta = (n: NotificationRow, key: string) => (typeof n.metadata[key] === 'string' ? (n.metadata[key] as string) : null);

/** Where clicking a notification takes the user. */
function linkFor(n: NotificationRow): string | null {
  const session = meta(n, 'session_id');
  const clip = meta(n, 'clip_id');
  switch (n.type) {
    case 'game_invitation':
    case 'video_ready':
    case 'lobby_update':
      return session ? `/play/${session}` : null;
    case 'clip_uploaded':
    case 'clip_approved':
    case 'clip_rejected':
      return clip ? `/admin/clips/${clip}/configure` : '/admin/clips';
    case 'access_request':
      return '/admin/access-requests';
    case 'access_approved':
      return '/admin/dashboard';
    case 'friend_request':
    case 'friend_accepted':
      return '/friends';
    default:
      return null;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unread, markRead, dismiss, markAllRead, refresh } = useNotifications((n) => {
    const link = linkFor(n);
    // Online popup for invitations and friend requests.
    if (n.type === 'game_invitation' && link) toast.info(n.message, { label: 'Join game', onClick: () => void router.push(link) });
    else toast.info(n.message);
    if (n.type === 'access_approved') void refreshMe();
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function respondFriend(n: NotificationRow, accept: boolean) {
    const id = meta(n, 'request_id');
    if (!id) return;
    try {
      await api(`/api/friends/requests/${id}/${accept ? 'accept' : 'reject'}`, { method: 'PATCH', body: {} });
      toast.success(accept ? 'Friend added!' : 'Request declined.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
    await dismiss(n.id);
    void refresh();
  }

  async function go(n: NotificationRow) {
    await markRead(n.id);
    const link = linkFor(n);
    setOpen(false);
    if (link) void router.push(link);
  }

  // Pending friend requests at the top, then newest first.
  const sorted = [...items].sort((a, b) => Number(b.type === 'friend_request') - Number(a.type === 'friend_request'));

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative rounded-lg p-2 text-ink-200 hover:bg-ink-700 hover:text-white"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          requestBrowserNotificationPermission();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-2xl border border-ink-700 bg-ink-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
            <p className="font-bold">Notifications</p>
            {unread > 0 && (
              <button className="text-xs text-brand-300 hover:underline" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {sorted.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-400">You&apos;re all caught up.</li>}
            {sorted.map((n) => (
              <li key={n.id} className={`border-b border-ink-700/60 px-4 py-3 text-sm ${n.is_read ? 'opacity-70' : ''}`}>
                <div className="flex gap-2">
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="unread" />}
                  <button className="flex-1 text-left" onClick={() => void go(n)}>
                    <p>{n.message}</p>
                    <p className="mt-0.5 text-xs text-ink-400">{timeAgo(n.created_at)}</p>
                  </button>
                  <button className="self-start text-ink-400 hover:text-white" onClick={() => void dismiss(n.id)} aria-label="Dismiss">
                    ×
                  </button>
                </div>
                {n.type === 'friend_request' && meta(n, 'request_id') && (
                  <div className="mt-2 flex gap-2 pl-4">
                    <button className="btn-primary px-3 py-1 text-xs" onClick={() => void respondFriend(n, true)}>
                      Accept
                    </button>
                    <button className="btn-secondary px-3 py-1 text-xs" onClick={() => void respondFriend(n, false)}>
                      Decline
                    </button>
                  </div>
                )}
                {n.type === 'game_invitation' && (
                  <div className="mt-2 flex gap-2 pl-4">
                    <button className="btn-primary px-3 py-1 text-xs" onClick={() => void go(n)}>
                      Join
                    </button>
                    <button className="btn-secondary px-3 py-1 text-xs" onClick={() => void dismiss(n.id)}>
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
