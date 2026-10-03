import type { SupabaseClient } from '@supabase/supabase-js';
import { SESSION_EVENT, USER_EVENT, type SessionEvent, type UserEvent } from '@/types/game';
import { supabaseAdmin } from './supabase';

/** Channel naming shared with the browser (lib/realtime.ts). */
export const sessionTopic = (sessionId: string) => `session:${sessionId}`;
export const userTopic = (userId: string) => `user:${userId}`;

/**
 * Best-effort broadcast over Supabase Realtime's HTTP endpoint (no socket needed in serverless).
 * Events are hints: clients refetch authoritative state from the API, so a dropped event only
 * delays an update until the client's polling fallback. Failures are logged, never thrown.
 */
async function send(topic: string, event: string, payload: object, client?: SupabaseClient): Promise<void> {
  try {
    const sb = client ?? supabaseAdmin();
    const channel = sb.channel(topic);
    try {
      await channel.httpSend(event, payload as Record<string, unknown>);
    } finally {
      await sb.removeChannel(channel);
    }
  } catch (err) {
    console.warn(`[realtime] broadcast to ${topic} failed`, err);
  }
}

export const broadcastSession = (sessionId: string, event: SessionEvent, client?: SupabaseClient) =>
  send(sessionTopic(sessionId), SESSION_EVENT, event, client);

export const broadcastUser = (userId: string, event: UserEvent, client?: SupabaseClient) =>
  send(userTopic(userId), USER_EVENT, event, client);
