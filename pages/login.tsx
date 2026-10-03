import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { authErrorMessage, login, resetPassword } from '@/lib/auth';
import { useSession } from '@/store/session';
import { safeNext } from '@/hooks/useRequireAuth';
import { AppShell } from '@/components/Layout/AppShell';
import { SsoButtons } from '@/components/Auth/SsoButtons';
import { ErrorBox } from '@/components/Common/ui';
import { toast } from '@/store/toast';

export default function LoginPage() {
  const router = useRouter();
  const { status, error: sessionError } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(router.query.next);

  useEffect(() => {
    if (status === 'ready') void router.replace(next);
    if (status === 'needs_profile') void router.replace(`/signup?step=username&next=${encodeURIComponent(next)}`);
  }, [status, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-sm">
        <h1 className="mb-6 text-center font-display text-4xl font-black">Welcome back</h1>
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
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
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
          <SsoButtons onError={setError} />
        </form>
        <p className="mt-4 text-center text-sm text-ink-200">
          New here? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-300 hover:underline">Create an account</Link>
        </p>
      </div>
    </AppShell>
  );
}
