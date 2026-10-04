import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { MeResponse } from '@/types/api';
import { useSession, type SessionStatus } from '@/store/session';

export interface RequireAuthResult {
  me: MeResponse | null;
  status: SessionStatus;
  /** True once the requirement is satisfied and the page may render. */
  allowed: boolean;
}

/**
 * Game-portal page guard. Redirects signed-out users to /login and users without a username to
 * /signup. The admin portal has its own guard (useRequireAdmin) and credential store.
 */
export function useRequireAuth(): RequireAuthResult {
  const router = useRouter();
  const { me, status } = useSession();

  const allowed = status === 'ready' && !!me;

  useEffect(() => {
    if (!router.isReady) return;
    const next = encodeURIComponent(router.asPath);
    if (status === 'unconfigured') void router.replace('/'); // landing page explains missing config
    else if (status === 'signed_out') void router.replace(`/login?next=${next}`);
    else if (status === 'needs_profile') void router.replace(`/signup?step=username&next=${next}`);
  }, [status, me, router]);

  return { me, status, allowed };
}

/** Safe post-login redirect target (same-origin paths only). */
export function safeNext(raw: unknown, fallback = '/game'): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}
