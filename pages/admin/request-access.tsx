import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { AdminAccessState } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { refreshMe } from '@/components/Common/SessionProvider';
import { AdminShell } from '@/components/Layout/AdminShell';
import { ErrorBox, FullPageSpinner } from '@/components/Common/ui';

export default function RequestAccessPage() {
  const router = useRouter();
  const { me, allowed } = useRequireAuth('user');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = me?.admin_access;

  useEffect(() => {
    if (access?.status === 'granted') void router.replace('/admin/dashboard');
  }, [access, router]);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      await api<{ access: AdminAccessState }>('/api/admin/access-requests', { method: 'POST', body: { message: message.trim() || undefined } });
      await refreshMe();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      {!allowed || !access ? (
        <FullPageSpinner />
      ) : (
        <div className="mx-auto max-w-lg">
          <h1 className="mb-4 font-display text-3xl font-black">Admin portal</h1>
          <div className="card space-y-4">
            {access.status === 'pending' ? (
              <>
                <p className="text-lg font-semibold">Your request is pending ⏳</p>
                <p className="text-sm text-ink-200">The super admin has been notified. You&apos;ll get a notification when they respond.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">You need approval to access the admin portal.</p>
                {access.status === 'rejected' && (
                  <ErrorBox message={`Your previous request was declined${access.message ? `: ${access.message}` : '.'} You can request again.`} />
                )}
                <p className="text-sm text-ink-200">Admins upload movie clips and map which character speaks when. Tell the super admin why you&apos;d like access.</p>
                {error && <ErrorBox message={error} />}
                <textarea className="input min-h-24" maxLength={500} placeholder="Optional message" value={message} onChange={(e) => setMessage(e.target.value)} />
                <button className="btn-primary w-full" disabled={busy} onClick={() => void request()}>
                  {busy ? 'Sending…' : 'Request access'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
