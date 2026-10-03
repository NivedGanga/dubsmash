/**
 * Browser real-time layer on Supabase Realtime (replaces a Socket.io server; see WORK_TRACKER decision 1).
 * - `session:{id}` channel = a game room. Server routes broadcast SessionEvents after every state change.
 * - `user:{id}` channel = personal inbox for notification / friend hints.
 * - `presence:online` channel = who is online (friend list status).
 * supabase-js reconnects automatically with the backoff configured in lib/supabase.ts.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SESSION_EVENT, USER_EVENT, type SessionEvent, type UserEvent } from '@/types/game';
import { supabaseBrowser } from './supabase';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'unavailable';

function subscribe<E>(
  topic: string,
  event: string,
  onEvent: (e: E) => void,
  onStatus?: (s: ConnectionStatus) => void,
): () => void {
  const sb = supabaseBrowser();
  if (!sb) {
    onStatus?.('unavailable');
    return () => {};
  }
  onStatus?.('connecting');
  const channel: RealtimeChannel = sb
    .channel(topic, { config: { broadcast: { self: true } } })
    .on('broadcast', { event }, (msg) => onEvent(msg.payload as E))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('connected');
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus?.('disconnected');
    });
  return () => {
    void sb.removeChannel(channel);
  };
}

export const subscribeSession = (sessionId: string, onEvent: (e: SessionEvent) => void, onStatus?: (s: ConnectionStatus) => void) =>
  subscribe<SessionEvent>(`session:${sessionId}`, SESSION_EVENT, onEvent, onStatus);

export const subscribeUser = (userId: string, onEvent: (e: UserEvent) => void, onStatus?: (s: ConnectionStatus) => void) =>
  subscribe<UserEvent>(`user:${userId}`, USER_EVENT, onEvent, onStatus);

/** Track this user as online and receive the set of online user ids whenever it changes. */
export function joinPresence(userId: string, onChange: (online: Set<string>) => void): () => void {
  const sb = supabaseBrowser();
  if (!sb) return () => {};
  const channel = sb.channel('presence:online', { config: { presence: { key: userId } } });
  channel
    .on('presence', { event: 'sync' }, () => onChange(new Set(Object.keys(channel.presenceState()))))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track({ online_at: new Date().toISOString() });
    });
  return () => {
    void sb.removeChannel(channel);
  };
}
