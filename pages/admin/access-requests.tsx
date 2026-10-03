import { useState } from 'react';
import type { AccessRequestWithUser } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { toast } from '@/store/toast';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { EmptyState, ErrorBox, Modal, Spinner } from '@/components/Common/ui';

type Tab = 'pending' | 'approved' | 'rejected';

export default function AccessRequestsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const { data, error, loading, reload } = useApi<{ requests: AccessRequestWithUser[] }>('/api/admin/access-requests', { status: tab });
  const [rejecting, setRejecting] = useState<AccessRequestWithUser | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(req: AccessRequestWithUser, decision: 'approve' | 'reject', message?: string) {
    setBusyId(req.id);
    try {
      await api(`/api/admin/access-requests/${req.id}/${decision}`, { method: 'PATCH', body: { message } });
      toast.success(decision === 'approve' ? `@${req.user.username} is now an admin.` : 'Request rejected.');
      setRejecting(null);
      setReason('');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout title="Access requests" requirement="super_admin">
      <div className="mb-4 flex gap-2">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'btn-primary py-1 text-sm' : 'btn-secondary py-1 text-sm'} onClick={() => setTab(t)}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data && <Spinner />}
      {data && data.requests.length === 0 && <EmptyState title={`No ${tab} requests`} />}
      <ul className="space-y-3">
        {data?.requests.map((r) => (
          <li key={r.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-semibold">
                {r.user.display_name} <span className="text-ink-400">@{r.user.username}</span>
              </p>
              <p className="text-xs text-ink-400">
                {r.user.email} · requested {timeAgo(r.requested_at)}
              </p>
              {r.message && <p className="mt-2 rounded-lg bg-ink-900 p-2 text-sm text-ink-200">“{r.message}”</p>}
              {r.response_message && <p className="mt-2 text-xs text-ink-400">Response: {r.response_message}</p>}
            </div>
            {tab === 'pending' && (
              <div className="flex gap-2">
                <button className="btn-primary" disabled={busyId === r.id} onClick={() => void respond(r, 'approve')}>
                  Approve
                </button>
                <button className="btn-secondary" disabled={busyId === r.id} onClick={() => setRejecting(r)}>
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject request">
        <p className="mb-2 text-sm text-ink-200">Optionally explain why. The user will see this message.</p>
        <textarea className="input min-h-24" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-danger mt-4 w-full" disabled={!!busyId} onClick={() => rejecting && void respond(rejecting, 'reject', reason.trim() || undefined)}>
          Reject request
        </button>
      </Modal>
    </AdminLayout>
  );
}
