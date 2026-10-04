import { useState } from 'react';
import Link from 'next/link';
import type { Paginated } from '@/types/api';
import type { UserRole, UserRow, UserStatus } from '@/types/database';
import { adminPatch } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useAdminApi } from '@/hooks/useAdminApi';
import { toast } from '@/store/toast';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { ErrorBox, Spinner } from '@/components/Common/ui';

type AdminUser = Pick<UserRow, 'id' | 'email' | 'username' | 'display_name' | 'role' | 'status' | 'clips_created' | 'games_played' | 'created_at' | 'last_seen_at'>;

export default function AdminUsersPage() {
  
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload, setData } = useAdminApi<Paginated<AdminUser>>('/api/admin/users', { q: q.trim() || undefined, page });

  async function update(u: AdminUser, patch: { role?: UserRole; status?: UserStatus }) {
    if (patch.role === 'super_admin' && !window.confirm(`Promote @${u.username} to super admin? They will have full control of the platform.`)) return;
    if (patch.status === 'banned' && !window.confirm(`Ban @${u.username}?`)) return;
    try {
      await adminPatch(`/api/admin/users/${u.id}`, patch);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === u.id ? { ...x, ...patch } : x)) });
      toast.success('User updated.');
    } catch (err) {
      toast.error(errorMessage(err));
      void reload();
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <AdminLayout title="Users" requireSuper>
      <input className="input mb-4 max-w-sm" placeholder="Search by username or name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="overflow-x-auto rounded-2xl border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-800 text-xs uppercase text-ink-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Clips</th>
                <th className="px-4 py-3">Games</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-t border-ink-700">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{u.display_name} <span className="text-ink-400">@{u.username}</span></p>
                    <p className="text-xs text-ink-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select className="input py-1" value={u.role} onChange={(e) => void update(u, { role: e.target.value as UserRole })}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select className="input py-1" value={u.status} onChange={(e) => void update(u, { status: e.target.value as UserStatus })}>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="banned">banned</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.clips_created}</td>
                  <td className="px-4 py-3">{u.games_played}</td>
                  <td className="px-4 py-3 text-ink-200">{u.last_seen_at ? timeAgo(u.last_seen_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <Link className="text-brand-300 hover:underline" href={`/admin/clips?owner=${u.id}`}>Files</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button className="btn-secondary py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} / {pages}</span>
          <button className="btn-secondary py-1" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </AdminLayout>
  );
}
