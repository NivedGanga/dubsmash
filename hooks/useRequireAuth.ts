import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { MeResponse } from '@/types/api';
import { useSession, type SessionStatus } from '@/store/session';

export type AuthRequirement = 'user' | 'admin' | 'super_admin';

export interface RequireAuthResult {
  me: MeResponse | null;
  status: SessionStatus;
  /** True once the requirement is satisfied and the page may render. */
  allowed: boolean;
}

/**
 * Page guard. Redirects signed-out users to /login, users without a username to /signup, and users
 * lacking admin access to /admin/request-access. The API enforces the same rules server-side.
 */
export function useRequireAuth(requirement: AuthRequirement = 'user'): RequireAuthResult {
  const router = useRouter();
  const { me, status } = useSession();

  const hasAdmin = me?.admin_access.status === 'granted';
  const isSuper = me?.user.role === 'super_admin';
  const allowed =
    status === 'ready' && !!me && (requirement === 'user' || (requirement === 'admin' && hasAdmin) || (requirement === 'super_admin' && isSuper));

  useEffect(() => {
    if (!router.isReady) return;
    const next = encodeURIComponent(router.asPath);
    if (status === 'signed_out') void router.replace(`/login?next=${next}`);
    else if (status === 'needs_profile') void router.replace(`/signup?step=username&next=${next}`);
    else if (status === 'ready' && me) {
      if (requirement === 'admin' && !hasAdmin) void router.replace('/admin/request-access');
      if (requirement === 'super_admin' && !isSuper) void router.replace(hasAdmin ? '/admin/dashboard' : '/admin/request-access');
    }
  }, [status, me, requirement, hasAdmin, isSuper, router]);

  return { me, status, allowed };
}

/** Safe post-login redirect target (same-origin paths only). */
export function safeNext(raw: unknown, fallback = '/game'): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}
