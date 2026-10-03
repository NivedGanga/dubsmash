import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationRow } from '@/types/database';
import type { NotificationListResponse } from '@/types/api';
import { api } from '@/lib/api';
import { subscribeUser } from '@/lib/realtime';
import { useSession } from '@/store/session';

const POLL_MS = 60_000;

function showBrowserNotification(n: NotificationRow) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    new Notification('Dubsmash', { body: n.message, tag: n.id });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

export function requestBrowserNotificationPermission(): void {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/**
 * Real-time notifications: initial fetch, push hints on the user's realtime channel, and a
 * 60s polling fallback in case the realtime connection is unavailable.
 */
export function useNotifications(onNew?: (n: NotificationRow) => void) {
  const userId = useSession((s) => s.me?.user.id);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const initialised = useRef(false);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await api<NotificationListResponse>('/api/notifications', { query: { page_size: 30 } });
      if (initialised.current) {
        for (const n of res.items) {
          if (!seen.current.has(n.id) && !n.is_read) {
            onNewRef.current?.(n);
            showBrowserNotification(n);
          }
        }
      }
      res.items.forEach((n) => seen.current.add(n.id));
      initialised.current = true;
      setItems(res.items);
      setUnread(res.unread_count);
    } catch {
      /* transient; next poll retries */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    const unsub = subscribeUser(userId, (e) => {
      if (e.type === 'notification:new') void refresh();
    });
    const poll = setInterval(() => void refresh(), POLL_MS);
    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [userId, refresh]);

  const markRead = useCallback(async (id: string) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await api(`/api/notifications/${id}/read`, { method: 'PATCH', body: {} }).catch(() => {});
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setItems((list) => {
      const n = list.find((x) => x.id === id);
      if (n && !n.is_read) setUnread((u) => Math.max(0, u - 1));
      return list.filter((x) => x.id !== id);
    });
    await api(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    await api('/api/notifications/read-all', { method: 'PATCH', body: {} }).catch(() => {});
  }, []);

  return { items, unread, loading, refresh, markRead, dismiss, markAllRead };
}
