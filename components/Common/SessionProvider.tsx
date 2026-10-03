import { useEffect, type ReactNode } from 'react';
import type { MeResponse } from '@/types/api';
import { ApiClientError, api, errorMessage } from '@/lib/api';
import { isFirebaseConfigured, onAuthChange } from '@/lib/auth';
import { joinPresence } from '@/lib/realtime';
import { useSession } from '@/store/session';

/** Reload the current user's profile/flags (after profile edits, approvals, flag changes...). */
export async function refreshMe(): Promise<MeResponse | null> {
  try {
    const me = await api<MeResponse>('/api/auth/me');
    useSession.getState().set({ me, status: 'ready', error: null });
    return me;
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'profile_required') {
      useSession.getState().set({ me: null, status: 'needs_profile' });
    }
    return null;
  }
}

/** Bridges Firebase auth state -> Dubsmash profile, presence and heartbeat. Mounted once in _app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const set = useSession((s) => s.set);
  const userId = useSession((s) => s.me?.user.id);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      set({ status: 'unconfigured' });
      return;
    }
    let lastUid: string | null = null;
    return onAuthChange(async (fbUser) => {
      if (!fbUser) {
        lastUid = null;
        set({ status: 'signed_out', me: null });
        return;
      }
      // onIdTokenChanged fires hourly on refresh; only reload the profile when the user changes.
      if (fbUser.uid === lastUid) return;
      lastUid = fbUser.uid;
      try {
        const me = await api<MeResponse>('/api/auth/login', { method: 'POST', body: {} });
        set({ me, status: 'ready', error: null });
      } catch (err) {
        if (err instanceof ApiClientError && err.code === 'profile_required') set({ status: 'needs_profile', me: null });
        else set({ status: 'error', error: errorMessage(err) });
      }
    });
  }, [set]);

  useEffect(() => {
    if (!userId) return;
    const leave = joinPresence(userId, (online) => set({ onlineUserIds: online }));
    const beat = setInterval(() => void api('/api/users/heartbeat', { method: 'POST', body: {} }).catch(() => {}), 2 * 60 * 1000);
    return () => {
      leave();
      clearInterval(beat);
    };
  }, [userId, set]);

  return <>{children}</>;
}
