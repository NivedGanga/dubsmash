import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { AdminMeResponse } from '@/types/api';
import { adminGet } from '@/lib/adminApi';
import { clearAdminToken, getAdminToken } from '@/lib/adminSession';
import { ApiClientError } from '@/lib/api';

export type AdminStatus = 'loading' | 'ready' | 'signed_out' | 'pending';

/** The signed-in admin session (account + flags), provided by AdminLayout to its pages. */
export const AdminMeContext = createContext<AdminMeResponse | null>(null);
export const useAdminMe = () => useContext(AdminMeContext);

export interface RequireAdminResult {
  me: AdminMeResponse | null;
  status: AdminStatus;
  /** True once the requirement is satisfied and the page may render. */
  allowed: boolean;
}

/**
 * Admin-portal page guard — the admin counterpart of useRequireAuth. Loads /api/admin/me with the
 * admin session token; redirects to /admin/login when there is no valid admin session, and to
 * /admin/pending when the account exists but is still awaiting approval. Pass requireSuper for
 * super-admin-only screens.
 */
export function useRequireAdmin(requireSuper = false): RequireAdminResult {
  const router = useRouter();
  const [me, setMe] = useState<AdminMeResponse | null>(null);
  const [status, setStatus] = useState<AdminStatus>('loading');

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    const next = encodeURIComponent(router.asPath);
    const toLogin = () => void router.replace(`/admin/login?next=${next}`);

    if (!getAdminToken()) {
      toLogin();
      setStatus('signed_out');
      return;
    }
    adminGet<AdminMeResponse>('/api/admin/me')
      .then((res) => {
        if (cancelled) return;
        setMe(res);
        if (res.account.status === 'pending') {
          setStatus('pending');
          void router.replace('/admin/pending');
        } else {
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.code === 'pending_approval') {
          setStatus('pending');
          void router.replace('/admin/pending');
          return;
        }
        clearAdminToken();
        toLogin();
        setStatus('signed_out');
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSuper = me?.account.role === 'super_admin';
  const allowed = status === 'ready' && !!me && (!requireSuper || isSuper);

  useEffect(() => {
    if (status === 'ready' && requireSuper && !isSuper) void router.replace('/admin/dashboard');
  }, [status, requireSuper, isSuper, router]);

  return { me, status, allowed };
}
