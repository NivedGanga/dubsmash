import { useEffect, useState } from 'react';
import type { FeatureFlagRow, FlagChangeLogRow, FlagValue } from '@/types/database';
import { adminPatch } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useAdminApi } from '@/hooks/useAdminApi';
import { toast } from '@/store/toast';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { ErrorBox, Spinner, Toggle } from '@/components/Common/ui';

type HistoryRow = FlagChangeLogRow & { changed_by_admin: { display_name: string } | null };

function describeChange(h: HistoryRow): string {
  const parts: string[] = [];
  if (!h.old_value || h.old_value.is_enabled !== h.new_value.is_enabled) parts.push(h.new_value.is_enabled ? 'enabled' : 'disabled');
  const o = h.old_value?.flag_value ?? {};
  const n = h.new_value.flag_value ?? {};
  if (o.rollout_percentage !== n.rollout_percentage && n.rollout_percentage !== undefined) parts.push(`rollout ${o.rollout_percentage ?? 0}% → ${n.rollout_percentage}%`);
  if (JSON.stringify(o.user_ids ?? []) !== JSON.stringify(n.user_ids ?? [])) parts.push(`user list ${o.user_ids?.length ?? 0} → ${n.user_ids?.length ?? 0} users`);
  return parts.join(', ') || 'updated';
}

function FlagCard({ flag, onSaved }: { flag: FeatureFlagRow; onSaved: (f: FeatureFlagRow) => void }) {
  const [pct, setPct] = useState(flag.flag_value.rollout_percentage ?? 0);
  const [ids, setIds] = useState((flag.flag_value.user_ids ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPct(flag.flag_value.rollout_percentage ?? 0);
    setIds((flag.flag_value.user_ids ?? []).join('\n'));
  }, [flag]);

  async function toggle(enabled: boolean) {
    const confirm = flag.is_critical
      ? window.confirm(`"${flag.flag_name}" is a critical flag.\n\n${flag.description}\n\nReally turn it ${enabled ? 'ON' : 'OFF'}? This takes effect immediately.`)
      : true;
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await adminPatch<{ flag: FeatureFlagRow }>(`/api/admin/feature-flags/${flag.flag_name}/toggle`, { enabled, confirm: flag.is_critical });
      onSaved(res.flag);
      toast.success(`${flag.flag_name} ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveValue(value: FlagValue) {
    setBusy(true);
    try {
      const res = await adminPatch<{ flag: FeatureFlagRow }>(`/api/admin/feature-flags/${flag.flag_name}/value`, { flag_value: value });
      onSaved(res.flag);
      toast.success('Saved.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const parsedIds = [...new Set(ids.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
  const idsDirty = JSON.stringify(parsedIds) !== JSON.stringify(flag.flag_value.user_ids ?? []);

  return (
    <li className="card space-y-3">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="font-mono font-bold">
            {flag.flag_name}
            {flag.is_critical && <span className="badge ml-2 bg-red-500/20 text-red-300">critical</span>}
            <span className="badge ml-2 bg-ink-600 text-ink-200">{flag.flag_type.replace('_', ' ')}</span>
          </p>
          <p className="mt-1 text-sm text-ink-200">{flag.description}</p>
          <p className="mt-1 text-xs text-ink-400">Updated {timeAgo(flag.updated_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${flag.is_enabled ? 'text-green-400' : 'text-ink-400'}`}>{flag.is_enabled ? 'ON' : 'OFF'}</span>
          <Toggle checked={flag.is_enabled} disabled={busy} onChange={(v) => void toggle(v)} label={`Toggle ${flag.flag_name}`} />
        </div>
      </div>
      {flag.flag_type === 'percentage' && (
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} step={1} value={pct} disabled={busy} className="flex-1 accent-brand-500" onChange={(e) => setPct(Number(e.target.value))} aria-label={`${flag.flag_name} rollout percentage`} />
          <span className="w-12 text-right font-mono text-sm">{pct}%</span>
          <button className="btn-secondary py-1 text-sm" disabled={busy || pct === (flag.flag_value.rollout_percentage ?? 0)} onClick={() => void saveValue({ rollout_percentage: pct })}>
            Save
          </button>
        </div>
      )}
      {flag.flag_type === 'user_list' && (
        <div className="space-y-2">
          <textarea className="input min-h-24 font-mono text-xs" value={ids} disabled={busy} onChange={(e) => setIds(e.target.value)} placeholder="One user ID per line" aria-label={`${flag.flag_name} user IDs`} />
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>{parsedIds.length} user(s)</span>
            <button className="btn-secondary py-1 text-sm" disabled={busy || !idsDirty} onClick={() => void saveValue({ user_ids: parsedIds })}>Save list</button>
          </div>
        </div>
      )}
      {!flag.is_enabled && flag.flag_type !== 'boolean' && <p className="text-xs text-yellow-300">Master switch is OFF: nobody gets this feature regardless of the {flag.flag_type === 'percentage' ? 'percentage' : 'list'}.</p>}
    </li>
  );
}

export default function FeatureFlagsPage() {
  const { data, error, loading, reload, setData } = useAdminApi<{ flags: FeatureFlagRow[]; history: HistoryRow[] }>('/api/admin/feature-flags');

  return (
    <AdminLayout title="Feature flags" requireSuper>
      <p className="mb-6 max-w-2xl text-sm text-ink-200">
        Flags change behaviour at runtime without a deploy. Changes apply immediately on this server and within 5 minutes everywhere else.
      </p>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
          <ul className="space-y-4">
            {data.flags.map((f) => (
              <FlagCard
                key={f.id}
                flag={f}
                onSaved={(nf) => {
                  setData((d) => d && { ...d, flags: d.flags.map((x) => (x.id === nf.id ? nf : x)) });
                  void reload();
                }}
              />
            ))}
          </ul>
          <aside className="card h-fit">
            <h2 className="mb-3 font-bold">Change history</h2>
            {data.history.length === 0 && <p className="text-sm text-ink-400">No changes yet.</p>}
            <ol className="space-y-3 text-sm">
              {data.history.map((h) => (
                <li key={h.id} className="border-l-2 border-ink-600 pl-3">
                  <p className="font-mono text-xs font-bold">{h.flag_name}</p>
                  <p>{describeChange(h)}</p>
                  <p className="text-xs text-ink-400">
                    {h.changed_by_admin ? h.changed_by_admin.display_name : 'system'} · {timeAgo(h.changed_at)} · {new Date(h.changed_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}
