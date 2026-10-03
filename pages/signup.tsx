import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import type { SignupResponse } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { authErrorMessage, signup } from '@/lib/auth';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { safeNext } from '@/hooks/useRequireAuth';
import { usernameHintColor, useUsernameCheck } from '@/hooks/useUsernameCheck';
import { AppShell, signOutEverywhere } from '@/components/Layout/AppShell';
import { SsoButtons } from '@/components/Auth/SsoButtons';
import { ErrorBox, FullPageSpinner } from '@/components/Common/ui';

function CredentialsStep() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      // SessionProvider sees the new Firebase user, finds no profile and moves us to the username step.
      await signup(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card card-glow space-y-4" onSubmit={onSubmit}>
      {error && <ErrorBox message={error} />}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input id="confirm" type="password" className="input" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button className="btn-primary w-full py-3 font-display text-lg uppercase tracking-wider" disabled={busy}>
        {busy ? 'Creating account…' : '▶ Join the party'}
      </button>
      <SsoButtons onError={setError} />
    </form>
  );
}

function UsernameStep({ onDone }: { onDone: (res: SignupResponse) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(username);

  async function submit(skip: boolean) {
    setError(null);
    setBusy(true);
    try {
      const res = await api<SignupResponse>('/api/auth/signup', {
        method: 'POST',
        body: skip ? {} : { username: username.trim(), display_name: displayName.trim() || undefined },
      });
      onDone(res);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form
      className="card card-glow space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <p className="text-sm text-ink-200">Pick a unique username. Friends will find you by it.</p>
      {error && <ErrorBox message={error} />}
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" className="input" autoFocus maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="movie_buff_42" />
        <p className={`mt-1 h-4 text-xs ${usernameHintColor[check.state]}`}>{check.message}</p>
      </div>
      <div>
        <label className="label" htmlFor="display">Display name <span className="text-ink-400">(optional)</span></label>
        <input id="display" className="input" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={busy || check.state !== 'available'}>
        {busy ? 'Saving…' : 'Continue'}
      </button>
      <button type="button" className="w-full text-center text-xs text-ink-200 hover:text-white" disabled={busy} onClick={() => void submit(true)}>
        Skip for now (we&apos;ll give you a random username)
      </button>
      <button type="button" className="w-full text-center text-xs text-ink-400 hover:text-white" onClick={() => void signOutEverywhere()}>
        Use a different account
      </button>
    </form>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const { status, set } = useSession();
  const next = safeNext(router.query.next);

  useEffect(() => {
    if (status === 'ready') void router.replace(next);
  }, [status, next, router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-sm">
        <p className="mb-1 text-center text-sm font-bold uppercase tracking-widest text-ink-400">New player</p>
        <h1 className="mb-6 text-center font-display text-4xl font-black">
          <span className="wordmark text-glow">{status === 'needs_profile' ? 'Pick your handle' : 'Join Dubsmash'}</span>
        </h1>
        {status === 'loading' ? (
          <FullPageSpinner />
        ) : status === 'needs_profile' ? (
          <UsernameStep
            onDone={(res) => {
              if (res.is_first_user) toast.success("You're the first user, so you're the super admin!");
              set({ me: res, status: 'ready' });
            }}
          />
        ) : (
          <CredentialsStep />
        )}
        {status !== 'needs_profile' && (
          <p className="mt-4 text-center text-sm text-ink-200">
            Already have an account? <Link href="/login" className="font-semibold text-brand-300 hover:underline">Log in</Link>
          </p>
        )}
      </div>
    </AppShell>
  );
}
