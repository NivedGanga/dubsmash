import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDetails } from '@/types/api';
import type { SessionEvent } from '@/types/game';
import { api, errorMessage } from '@/lib/api';
import { subscribeSession, type ConnectionStatus } from '@/lib/realtime';

/** Poll interval when realtime is down (and a slow safety poll when it is up). */
const POLL_DISCONNECTED_MS = 4000;
const POLL_CONNECTED_MS = 30000;

/**
 * Live game session state. Joins the `session:{id}` realtime room (the Socket.io-style room from the
 * spec), refetches authoritative state from the API on every event, and polls as a fallback so the
 * game keeps working through dropped connections. `lastEvent` lets components react to transient
 * events (e.g. someone started recording).
 */
export function useGameSession(sessionId: string | null) {
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<SessionEvent | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    // Coalesce bursts of events into at most one extra fetch.
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    inflight.current = (async () => {
      do {
        again.current = false;
        try {
          setDetails(await api<SessionDetails>(`/api/sessions/${sessionId}`));
          setError(null);
        } catch (err) {
          setError(errorMessage(err));
        }
      } while (again.current);
      inflight.current = null;
    })();
    return inflight.current;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    void refresh();
    return subscribeSession(
      sessionId,
      (e) => {
        setLastEvent(e);
        void refresh();
      },
      (s) => {
        setConnection(s);
        if (s === 'connected') void refresh(); // catch up after reconnect
      },
    );
  }, [sessionId, refresh]);

  useEffect(() => {
    if (!sessionId) return;
    const ms = connection === 'connected' ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS;
    const t = setInterval(() => document.visibilityState === 'visible' && void refresh(), ms);
    return () => clearInterval(t);
  }, [sessionId, connection, refresh]);

  return { details, error, connection, lastEvent, refresh, setDetails };
}
