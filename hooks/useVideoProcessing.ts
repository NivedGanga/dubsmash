import { useCallback, useEffect, useState } from 'react';
import type { ProcessingStatusResponse } from '@/types/api';
import type { SessionEvent } from '@/types/game';
import { api } from '@/lib/api';

const POLL_MS = 15_000;

/**
 * Video render status for a session. Updates immediately on `processing:update` realtime events
 * (broadcast by the worker) and polls every 15s as a fallback until completed/failed.
 */
export function useVideoProcessing(sessionId: string | null, lastEvent: SessionEvent | null) {
  const [status, setStatus] = useState<ProcessingStatusResponse | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      setStatus(await api<ProcessingStatusResponse>(`/api/sessions/${sessionId}/status`));
    } catch {
      /* retry on next poll */
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (lastEvent?.type === 'processing:update' || lastEvent?.type === 'session:state') void refresh();
  }, [lastEvent, refresh]);

  const done = status?.status === 'completed' || status?.status === 'failed';
  useEffect(() => {
    if (!sessionId || done) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [sessionId, done, refresh]);

  // Count the ETA down locally between polls.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [done]);
  useEffect(() => setTick(0), [status]);
  const eta = status?.estimated_seconds_remaining != null ? Math.max(0, status.estimated_seconds_remaining - tick) : null;

  return { status, eta, refresh };
}

/** Cloudinary URL that forces a file download instead of inline playback. */
export function downloadUrl(url: string): string {
  return url.includes('/upload/') ? url.replace('/upload/', '/upload/fl_attachment/') : url;
}
