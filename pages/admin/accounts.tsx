import { useState } from 'react';
import type { PublicAdminAccount } from '@/types/api';
import { adminPatch } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useAdminApi } from '@/hooks/useAdminApi';
import { toast } from '@/store/toast';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { EmptyState, ErrorBox, Modal, Spinner } from '@/components/Common/ui';

const STATUS_BADGE: Record<PublicAdminAccount['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-rose-500/15 text-rose-300',
  banned: 'bg-rose-500/15 text-rose-300',
};

/** Super admin: approve/reject/suspend admin accounts and manage their roles. */
export default function AdminAccountsPage() {
  const { data, error, loading, reload } = useAdminApi<{ accounts: PublicAdminAccount[] }>('/api/admin/accounts');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PublicAdminAccount | null>(null);

  const accounts = data?.accounts ?? [];
  const pending = accounts.filter((a) => a.status === 'pending');
  const others = accounts.filter((a) => a.status !== 'pending');

  async function patch(account: PublicAdminAccount, body: { status?: PublicAdminAccount['status']; role?: PublicAdminAccount['role'] }, done: string) {
    setBusyId(account.id);
    try {
      await adminPatch(`/api/admin/accounts/${account.id}`, body);
      toast.success(done);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
      setSuspendTarget(null);
    }
  }

  function Row({ account }: { account: PublicAdminAccount }) {
    const busy = busyId === account.id;
    return (
      <li className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-semibold">
            {account.display_name}
            {account.role === 'super_admin' && <span className="ml-2 rounded bg-admin-500/15 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-admin-300">super</span>}
            <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider ${STATUS_BADGE[account.status]}`}>{account.status}</span>
          </p>
          <p className="text-xs text-ink-400">
            {account.email} · joined {timeAgo(account.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {account.status === 'pending' && (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => void patch(account, { status: 'active' }, `${account.display_name} approved.`)}>
                Approve
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => void patch(account, { status: 'rejected' }, 'Request rejected.')}>
                Reject
              </button>
            </>
          )}
          {account.status === 'active' && account.role === 'admin' && (
            <button className="btn-secondary" disabled={busy} onClick={() => void patch(account, { role: 'super_admin' }, `${account.display_name} is now a super admin.`)}>
              Make super admin
            </button>
          )}
          {account.status === 'active' && account.role === 'super_admin' && (
            <button className="btn-secondary" disabled={busy} onClick={() => void patch(account, { role: 'admin' }, `${account.display_name} demoted to admin.`)}>
              Demote to admin
            </button>
          )}
          {account.status === 'active' && (
            <button className="btn-danger" disabled={busy} onClick={() => setSuspendTarget(account)}>
              Suspend
            </button>
          )}
          {(account.status === 'banned' || account.status === 'rejected') && (
            <button className="btn-secondary" disabled={busy} onClick={() => void patch(account, { status: 'active' }, `${account.display_name} reactivated.`)}>
              Reactivate
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <AdminLayout title="Admin accounts" requireSuper>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-xl font-bold">
              Pending approval {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-sm text-amber-300">{pending.length}</span>}
            </h2>
            {pending.length === 0 ? <EmptyState title="No pending admin signups" /> : <ul className="space-y-3">{pending.map((a) => <Row key={a.id} account={a} />)}</ul>}
          </section>
          <section>
            <h2 className="mb-3 font-display text-xl font-bold">All admin accounts</h2>
            {others.length === 0 ? <EmptyState title="No admin accounts yet" /> : <ul className="space-y-3">{others.map((a) => <Row key={a.id} account={a} />)}</ul>}
          </section>
        </div>
      )}
      <Modal open={!!suspendTarget} onClose={() => setSuspendTarget(null)} title="Suspend admin account">
        <p className="text-sm text-ink-200">
          <span className="font-semibold">{suspendTarget?.display_name}</span> will immediately lose access to the admin portal. You can reactivate them later.
        </p>
        <button
          className="btn-danger mt-4 w-full"
          disabled={!!busyId}
          onClick={() => suspendTarget && void patch(suspendTarget, { status: 'banned' }, `${suspendTarget.display_name} suspended.`)}
        >
          Suspend account
        </button>
      </Modal>
    </AdminLayout>
  );
}
