import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { authErrorMessage, login, resetPassword } from '@/lib/auth';
import { useSession } from '@/store/session';
import { getPortal, setPortal } from '@/lib/portal';
import { safeNext } from '@/hooks/useRequireAuth';
import { AppShell } from '@/components/Layout/AppShell';
import { SsoButtons } from '@/components/Auth/SsoButtons';
import { ErrorBox } from '@/components/Common/ui';
import { toast } from '@/store/toast';

export default function LoginPage() {
  const router = useRouter();
  const { status, me, error: sessionError } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [portal, setPortalState] = useState<string | null>(null);
  const next = safeNext(router.query.next);

  useEffect(() => setPortalState(getPortal()), []);

  useEffect(() => {
    if (status === 'ready' && portal !== 'admin') {
      setPortal('game');
      void router.replace(next);
    }
    if (status === 'needs_profile') void router.replace(`/signup?step=username&next=${encodeURIComponent(next)}`);
  }, [status, portal, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setPortal('game');
      await login(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Signed into the admin portal — crossing into the game portal is an explicit choice.
  if (status === 'ready' && portal === 'admin' && me) {
    return (
      <AppShell>
        <div className="mx-auto max-w-sm pt-16 text-center">
          <p className="text-5xl" aria-hidden>🛠️</p>
          <h1 className="mt-4 font-display text-3xl font-black">Signed in via the admin portal</h1>
          <p className="mt-2 text-sm text-ink-200">
            You&apos;re <span className="font-semibold">{me.user.display_name}</span>. Portals are separate — head to the game portal as a player?
          </p>
          <button
            className="btn-primary mt-6 w-full py-3 font-display text-lg uppercase tracking-wider"
            onClick={() => {
              setPortal('game');
              setPortalState('game');
              void router.replace(next);
            }}
          >
            ▶ Continue to game
          </button>
          <Link href="/admin" className="btn-ghost mt-2 w-full">Stay in admin portal</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-sm">
        <p className="mb-1 text-center text-sm font-bold uppercase tracking-widest text-ink-400">Player login</p>
        <h1 className="mb-6 text-center font-display text-4xl font-black">
          <span className="wordmark text-glow">Back for more?</span>
        </h1>
        <form className="card card-glow space-y-4" onSubmit={onSubmit}>
          {(error || (status === 'error' && sessionError)) && <ErrorBox message={error ?? sessionError!} />}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-3 font-display text-lg uppercase tracking-wider" disabled={busy}>
            {busy ? 'Logging in…' : '▶ Continue'}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs text-ink-200 hover:text-white"
            onClick={async () => {
              if (!email) return setError('Enter your email first, then click "Forgot password".');
              try {
                await resetPassword(email.trim());
                toast.success('Password reset email sent.');
              } catch (err) {
                setError(authErrorMessage(err));
              }
            }}
          >
            Forgot password?
          </button>
          <SsoButtons onError={setError} portal="game" />
        </form>
        <p className="mt-4 text-center text-sm text-ink-200">
          New here? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-300 hover:underline">Create an account</Link>
        </p>
        <p className="mt-2 text-center text-xs text-ink-400">
          Clip manager? <Link href="/admin/login" className="hover:text-white hover:underline">Admin portal sign-in →</Link>
        </p>
      </div>
    </AppShell>
  );
}
