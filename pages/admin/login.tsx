import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { authErrorMessage, login } from '@/lib/auth';
import { useSession } from '@/store/session';
import { getPortal, setPortal } from '@/lib/portal';
import { safeNext } from '@/hooks/useRequireAuth';
import { SsoButtons } from '@/components/Auth/SsoButtons';
import { ErrorBox } from '@/components/Common/ui';

/** Admin portal sign-in: separate entry point from the player login. */
export default function AdminLoginPage() {
  const router = useRouter();
  const { status, me, error: sessionError } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [portal, setPortalState] = useState<string | null>(null);
  const next = safeNext(router.query.next, '/admin/dashboard');

  useEffect(() => setPortalState(getPortal()), []);

  useEffect(() => {
    if (status === 'needs_profile') void router.replace(`/signup?step=username&next=${encodeURIComponent('/admin')}`);
    if (status === 'ready' && me && portal === 'admin') {
      void router.replace(me.admin_access.status === 'granted' ? next : '/admin/request-access');
    }
  }, [status, me, portal, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setPortal('admin');
      await login(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Signed into the game portal — crossing into the admin portal is an explicit choice.
  if (status === 'ready' && me && portal === 'game') {
    return (
      <div className="admin-scope admin-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl" aria-hidden>🎮</p>
          <h1 className="mt-4 font-display text-3xl font-black">Signed in via the game portal</h1>
          <p className="mt-2 text-sm text-ink-200">
            You&apos;re <span className="font-semibold">{me.user.display_name}</span>. Portals are separate — continue to the admin portal?
          </p>
          <button
            className="btn-admin mt-6 w-full"
            onClick={() => {
              setPortal('admin');
              setPortalState('admin');
            }}
          >
            Continue to admin portal
          </button>
          <Link href="/game" className="btn-ghost mt-2 w-full">Back to game portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-scope admin-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-display text-4xl font-black tracking-tight">
            <span className="text-admin-500">Dubsmash</span>{' '}
            <span className="rounded bg-admin-500/15 px-1.5 py-0.5 align-middle text-sm font-bold uppercase tracking-wider text-admin-300">Admin</span>
          </p>
          <p className="mt-2 text-sm text-ink-200">Clip management portal — admins only.</p>
        </div>
        <form className="card space-y-4" onSubmit={onSubmit}>
          {(error || (status === 'error' && sessionError)) && <ErrorBox message={error ?? sessionError!} />}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-admin w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to admin'}
          </button>
          <SsoButtons onError={setError} portal="admin" />
        </form>
        <p className="mt-4 text-center text-sm text-ink-200">
          Not a clip manager? <Link href="/login" className="font-semibold text-admin-300 hover:underline">Go to the game portal</Link>
        </p>
      </div>
    </div>
  );
}
