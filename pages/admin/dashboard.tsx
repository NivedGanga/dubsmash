import Link from 'next/link';
import type { AdminStats } from '@/types/api';
import { useAdminApi } from '@/hooks/useAdminApi';
import { useAdminMe } from '@/hooks/useRequireAdmin';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { ErrorBox, Spinner } from '@/components/Common/ui';

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <div className="card h-full transition hover:border-ink-600">
      <p className="text-sm text-ink-200">{label}</p>
      <p className="mt-1 font-display text-4xl font-black">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function AdminDashboard() {
  const { data, error, loading, reload } = useAdminApi<AdminStats>('/api/admin/stats');
  const me = useAdminMe();
  const isSuper = me?.account.role === 'super_admin';

  return (
    <AdminLayout title="Dashboard">
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={isSuper ? 'Total clips' : 'My clips'} value={data.total_clips} href="/admin/clips" />
            <Stat label="Pending approval" value={data.pending_clips} href="/admin/clips?status=pending" />
            <Stat label="Live clips" value={data.active_clips} href="/admin/clips?status=active" />
          </div>
          {isSuper && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Users" value={data.total_users} href="/admin/users" />
              <Stat label="Pending admins" value={data.pending_access_requests} href="/admin/accounts" />
              <Stat label="Games (7 days)" value={data.sessions_last_7_days} />
            </div>
          )}
          {isSuper && (
            <div className="card">
              <p className="mb-3 font-bold">Video processing queue</p>
              <div className="flex flex-wrap gap-6 text-sm">
                {Object.entries(data.processing_queue).map(([k, v]) => (
                  <p key={k}>
                    <span className="text-ink-200 capitalize">{k}:</span> <span className="font-bold">{v}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/clips?upload=1" className="btn-primary">Upload a clip</Link>
            {isSuper && <Link href="/admin/feature-flags" className="btn-secondary">Feature flags</Link>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
