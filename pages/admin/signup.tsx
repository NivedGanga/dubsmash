import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import type { AdminAuthResponse } from '@/types/api';
import { adminPost } from '@/lib/adminApi';
import { setAdminToken } from '@/lib/adminSession';
import { errorMessage } from '@/lib/api';
import { ErrorBox } from '@/components/Common/ui';

/**
 * Admin-portal signup — separate from game accounts. The first admin account ever becomes the
 * super admin and is signed in immediately; later signups wait for a super admin's approval.
 */
export default function AdminSignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await adminPost<AdminAuthResponse>('/api/admin/signup', {
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      if (res.token) {
        setAdminToken(res.token);
        void router.replace('/admin/dashboard');
      } else {
        void router.replace('/admin/pending');
      }
    } catch (err) {
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
          <p className="mt-2 text-sm text-ink-200">
            Create an admin account. New accounts need super admin approval before they can sign in.
          </p>
        </div>
        <form className="card space-y-4" onSubmit={onSubmit}>
          {error && <ErrorBox message={error} />}
          <div>
            <label className="label" htmlFor="name">Display name</label>
            <input id="name" className="input" maxLength={60} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">Admin email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">At least 8 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" className="input" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn-admin w-full" disabled={busy}>
            {busy ? 'Creating account…' : 'Create admin account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-200">
          Already have an admin account? <Link href="/admin/login" className="font-semibold text-admin-300 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
