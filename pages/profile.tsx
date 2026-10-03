import { useEffect, useState, type FormEvent } from 'react';
import type { PublicUser, UserStats } from '@/types/api';
import type { AvatarModel, AvatarOutfit, UserRow } from '@/types/database';
import { api, errorMessage } from '@/lib/api';
import { authErrorMessage, changePassword, getCurrentUser } from '@/lib/auth';
import { useApi } from '@/hooks/useApi';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usernameHintColor, useUsernameCheck } from '@/hooks/useUsernameCheck';
import { toast } from '@/store/toast';
import { refreshMe } from '@/components/Common/SessionProvider';
import { Shell } from '@/components/Layout/Shell';
import { ErrorBox, FullPageSpinner } from '@/components/Common/ui';
import { AvatarDisplay } from '@/components/Game/AvatarDisplay';

const MODELS: Array<{ id: AvatarModel; label: string; premium?: boolean }> = [
  { id: 'casual_m', label: 'Casual' },
  { id: 'formal_m', label: 'Formal' },
  { id: 'casual_f', label: 'Casual (ponytail)' },
  { id: 'formal_f', label: 'Formal (ponytail)' },
  { id: 'robot', label: 'Robot', premium: true },
  { id: 'blob', label: 'Blob', premium: true },
];
const OUTFITS: AvatarOutfit[] = ['tee', 'hoodie', 'suit', 'dress', 'jersey'];
const SWATCHES = ['#ff2e6e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#f5f5f4'];

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPasswordUser = getCurrentUser()?.providerData.some((p) => p.providerId === 'password');
  if (!isPasswordUser) return <p className="text-sm text-ink-400">You sign in with a social account, so there is no password to change.</p>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError('Use at least 8 characters.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      toast.success('Password changed.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-3" onSubmit={submit}>
      {error && <ErrorBox message={error} />}
      <input type="password" className="input" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <input type="password" className="input" placeholder="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
      <button className="btn-secondary w-full" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

export default function ProfilePage() {
  const { me, allowed } = useRequireAuth('user');
  const stats = useApi<{ user: PublicUser; stats: UserStats }>(allowed ? '/api/users/me' : null);
  const user = me?.user;
  const [form, setForm] = useState({ username: '', display_name: '', avatar_model: 'casual_m' as AvatarModel, avatar_color: '#ff2e6e', avatar_outfit: 'tee' as AvatarOutfit });
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(form.username, user?.username);

  useEffect(() => {
    if (user) setForm({ username: user.username, display_name: user.display_name, avatar_model: user.avatar_model, avatar_color: user.avatar_color, avatar_outfit: user.avatar_outfit });
  }, [user]);

  if (!allowed || !me || !user) return <Shell><FullPageSpinner /></Shell>;
  const premium = me.flags.premium_avatars;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const patch = Object.fromEntries(Object.entries(form).filter(([k, v]) => user![k as keyof UserRow] !== v));
      if (Object.keys(patch).length) {
        await api(`/api/users/${user!.id}`, { method: 'PUT', body: patch });
        await refreshMe();
      }
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const usernameBlocked = check.state === 'taken' || check.state === 'invalid' || check.state === 'checking';

  return (
    <Shell>
      <h1 className="mb-6 font-display text-3xl font-black">Profile</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form className="card space-y-5" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="display">Display name</label>
              <input id="display" className="input" maxLength={40} required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="username">Username</label>
              <input id="username" className="input" maxLength={20} required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <p className={`mt-1 h-4 text-xs ${usernameHintColor[check.state]}`}>{check.message}</p>
            </div>
          </div>

          <div>
            <p className="label">Avatar</p>
            <div className="grid grid-cols-3 gap-2">
              {MODELS.map((m) => {
                const locked = m.premium && !premium;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={locked}
                    className={`rounded-xl border px-3 py-2 text-sm ${form.avatar_model === m.id ? 'border-brand-500 bg-brand-500/20' : 'border-ink-600 hover:border-ink-400'} disabled:opacity-40`}
                    onClick={() => setForm({ ...form, avatar_model: m.id })}
                    title={locked ? 'Premium avatar — coming to your account soon' : undefined}
                  >
                    {m.label} {m.premium && '✨'}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="label">Colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} type="button" className={`h-8 w-8 rounded-full ${form.avatar_color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-800' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, avatar_color: c })} aria-label={`Colour ${c}`} />
              ))}
              <input type="color" className="h-8 w-10 cursor-pointer rounded border border-ink-600 bg-ink-900" value={form.avatar_color} onChange={(e) => setForm({ ...form, avatar_color: e.target.value })} aria-label="Custom colour" />
            </div>
          </div>

          <div>
            <p className="label">Outfit</p>
            <div className="flex flex-wrap gap-2">
              {OUTFITS.map((o) => (
                <button key={o} type="button" className={`rounded-xl border px-3 py-1.5 text-sm capitalize ${form.avatar_outfit === o ? 'border-brand-500 bg-brand-500/20' : 'border-ink-600 hover:border-ink-400'}`} onClick={() => setForm({ ...form, avatar_outfit: o })}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={busy || usernameBlocked}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>

        <div className="space-y-6">
          <AvatarDisplay
            className="h-72"
            avatars={[{ id: 'me', model: form.avatar_model, color: form.avatar_color, outfit: form.avatar_outfit, state: 'idle', displayName: form.display_name, label: <span className="font-bold">{form.display_name}</span> }]}
          />
          <div className="card grid grid-cols-2 gap-4 text-center">
            {[
              ['Games played', stats.data?.stats.games_played],
              ['Recordings', stats.data?.stats.total_recordings],
              ['Clips created', stats.data?.stats.clips_created],
              ['Friends', stats.data?.stats.friends_count],
            ].map(([label, v]) => (
              <div key={label as string}>
                <p className="font-display text-3xl font-black">{v ?? '–'}</p>
                <p className="text-xs text-ink-400">{label}</p>
              </div>
            ))}
          </div>
          <div className="card space-y-3">
            <h2 className="font-bold">Password</h2>
            <PasswordForm />
          </div>
        </div>
      </div>
    </Shell>
  );
}
