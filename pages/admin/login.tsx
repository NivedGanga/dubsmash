import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import type { AdminAuthResponse } from '@/types/api';
import { adminPost } from '@/lib/adminApi';
import { getAdminToken, setAdminToken } from '@/lib/adminSession';
import { ApiClientError, errorMessage } from '@/lib/api';
import { safeNext } from '@/hooks/useRequireAuth';
import { ErrorBox } from '@/components/Common/ui';

/** Admin portal sign-in — its own credential store, completely separate from the game portal. */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(router.query.next, '/admin/dashboard');

  useEffect(() => {
    if (router.isReady && getAdminToken()) void router.replace(next);
  }, [router, router.isReady, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await adminPost<AdminAuthResponse>('/api/admin/login', { email: email.trim(), password });
      if (!res.token) {
        void router.replace('/admin/pending');
        return;
      }
      setAdminToken(res.token);
      void router.replace(next);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'pending_approval') {
        void router.replace('/admin/pending');
        return;
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-scope admin-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-display text-4xl font-black tracking-tight">
            <span className="text-admin-500">Dubsmash</span>{' '}
            <span className="rounded bg-admin-500/15 px-1.5 py-0.5 align-middle text-sm font-bold uppercase tracking-wider text-admin-300">Admin</span>
          </p>
          <p className="mt-2 text-sm text-ink-200">Clip management portal — admin accounts only.</p>
        </div>
        <form className="card space-y-4" onSubmit={onSubmit}>
          {error && <ErrorBox message={error} />}
          <div>
            <label className="label" htmlFor="email">Admin email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-admin w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to admin'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-200">
          Need an admin account? <Link href="/admin/signup" className="font-semibold text-admin-300 hover:underline">Sign up for the admin portal</Link>
        </p>
        <p className="mt-2 text-center text-sm text-ink-200">
          Not an admin? <Link href="/login" className="font-semibold text-admin-300 hover:underline">Go to the game portal</Link>
        </p>
      </div>
    </div>
  );
}
