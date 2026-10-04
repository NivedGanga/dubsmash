import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { ClipListResponse, ClipWithOwner, FolderTreeResponse } from '@/types/api';
import type { ClipStatus } from '@/types/database';
import { adminDelete, adminPatch } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import { formatDuration, timeAgo } from '@/lib/utils';
import { useAdminApi } from '@/hooks/useAdminApi';
import { useAdminMe } from '@/hooks/useRequireAdmin';
import { toast } from '@/store/toast';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { EmptyState, ErrorBox, Spinner, StatusBadge } from '@/components/Common/ui';
import { FolderPanel, type FolderSelection } from '@/components/Admin/FolderPanel';
import { UploadClipModal } from '@/components/Admin/UploadClipModal';

type Sort = 'newest' | 'oldest' | 'most_used' | 'alphabetical';

function ClipCard({ clip, folders, onChanged, showOwner }: { clip: ClipWithOwner; folders: FolderTreeResponse['folders']; onChanged: () => void; showOwner: boolean }) {
  async function patch(body: Record<string, unknown>, ok: string) {
    try {
      await adminPatch(`/api/clips/${clip.id}`, body);
      toast.success(ok);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  async function remove() {
    if (!window.confirm(`Delete "${clip.title}" permanently?`)) return;
    try {
      await adminDelete(`/api/clips/${clip.id}`);
      toast.success('Clip deleted.');
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  const sameOwnerFolders = folders.filter((f) => f.owner_id === clip.uploaded_by);

  return (
    <li className="card flex flex-col gap-3 p-3">
      <Link href={`/admin/clips/${clip.id}/configure`} className="relative block aspect-video overflow-hidden rounded-xl bg-ink-900">
        {clip.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 text-xs">{formatDuration(clip.duration_seconds)}</span>
      </Link>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" title={clip.title}>{clip.title}</p>
          <p className="text-xs text-ink-400">
            {showOwner && clip.owner ? `${clip.owner.display_name} · ` : ''}
            {timeAgo(clip.created_at)} · played {clip.times_played}×
          </p>
        </div>
        <StatusBadge status={clip.status} />
      </div>
      <div className="flex flex-wrap gap-1">
        {clip.characters.length ? (
          clip.characters.map((c) => (
            <span key={c.id} className="badge text-white" style={{ background: c.color }}>{c.name}</span>
          ))
        ) : (
          <span className="badge bg-ink-700 text-ink-200">No characters yet</span>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/admin/clips/${clip.id}/configure`} className="btn-primary py-1 text-sm">
          {clip.is_configured ? 'Edit' : 'Configure'}
        </Link>
        <select
          className="input w-auto flex-1 py-1 text-xs"
          aria-label="Move to folder"
          value={clip.folder_id ?? ''}
          onChange={(e) => void patch({ folder_id: e.target.value || null }, 'Moved.')}
        >
          <option value="">No folder</option>
          {sameOwnerFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void patch({ archived: clip.status !== 'archived' }, clip.status === 'archived' ? 'Unarchived.' : 'Archived.')}>
          {clip.status === 'archived' ? 'Unarchive' : 'Archive'}
        </button>
        <button className="btn-ghost px-2 py-1 text-xs text-red-300" onClick={() => void remove()}>Delete</button>
      </div>
    </li>
  );
}

export default function AdminClipsPage() {
  const router = useRouter();
  const me = useAdminMe();
  const isSuper = me?.account.role === 'super_admin';
  const approvalFlow = !!me?.flags.clip_approval_workflow;

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<ClipStatus | ''>('');
  const [chars, setChars] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [folder, setFolder] = useState<FolderSelection>('all');
  const [owner, setOwner] = useState<string | null>(null);
  const [queue, setQueue] = useState(false);
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.upload === '1') setUploadOpen(true);
    if (typeof router.query.status === 'string') setStatus(router.query.status as ClipStatus);
    if (typeof router.query.owner === 'string') setOwner(router.query.owner);
  }, [router.isReady, router.query]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [debouncedQ, status, chars, sort, folder, owner, queue]);

  const tree = useAdminApi<FolderTreeResponse>('/api/folders', { owner: owner ?? undefined });
  const clips = useAdminApi<ClipListResponse>('/api/clips', {
    q: debouncedQ || undefined,
    status: queue ? undefined : status || undefined,
    queue: queue ? 'approval' : undefined,
    character_count: chars || undefined,
    sort,
    folder_id: folder === 'all' ? undefined : folder,
    owner: owner ?? undefined,
    page,
  });
  const pages = clips.data ? Math.max(1, Math.ceil(clips.data.total / clips.data.page_size)) : 1;

  return (
    <AdminLayout title="Clips">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isSuper && approvalFlow && (
          <div className="mr-2 flex gap-1 rounded-xl bg-ink-800 p-1">
            <button className={`rounded-lg px-3 py-1 text-sm font-semibold ${!queue ? 'bg-ink-600' : ''}`} onClick={() => setQueue(false)}>Library</button>
            <button className={`rounded-lg px-3 py-1 text-sm font-semibold ${queue ? 'bg-ink-600' : ''}`} onClick={() => setQueue(true)}>Approval queue</button>
          </div>
        )}
        <input className="input max-w-xs py-1.5" placeholder="Search titles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clips" />
        {!queue && (
          <select className="input w-auto py-1.5" value={status} onChange={(e) => setStatus(e.target.value as ClipStatus | '')} aria-label="Status">
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        )}
        <select className="input w-auto py-1.5" value={chars} onChange={(e) => setChars(e.target.value)} aria-label="Characters">
          <option value="">Any # characters</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} characters</option>)}
        </select>
        <select className="input w-auto py-1.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most_used">Most used</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
        <button className="btn-primary ml-auto" onClick={() => setUploadOpen(true)}>+ Upload clip</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <FolderPanel
          tree={tree.data}
          selected={folder}
          onSelect={setFolder}
          owner={owner}
          onOwner={(o) => {
            setOwner(o);
            setFolder('all');
          }}
          isSuper={isSuper}
          onChanged={() => void tree.reload()}
        />
        <div>
          {clips.error && <ErrorBox message={clips.error} onRetry={() => void clips.reload()} />}
          {clips.loading && !clips.data && <Spinner />}
          {clips.data && clips.data.items.length === 0 && (
            <EmptyState title={queue ? 'Nothing awaiting approval 🎉' : 'No clips here yet'} action={!queue && <button className="btn-primary" onClick={() => setUploadOpen(true)}>Upload your first clip</button>}>
              {!queue && 'Upload a movie scene, then map which character speaks when.'}
            </EmptyState>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clips.data?.items.map((c) => (
              <ClipCard key={c.id} clip={c} folders={tree.data?.folders ?? []} showOwner={isSuper} onChanged={() => void clips.reload()} />
            ))}
          </ul>
          {pages > 1 && (
            <div className="mt-6 flex items-center gap-3 text-sm">
              <button className="btn-secondary py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span>Page {page} / {pages}</span>
              <button className="btn-secondary py-1" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      <UploadClipModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folders={(tree.data?.folders ?? []).filter((f) => f.owner_id === me?.account.id)}
        defaultFolderId={folder !== 'all' && folder !== 'root' ? folder : null}
        onUploaded={(clip) => {
          setUploadOpen(false);
          toast.success('Uploaded! Now map the characters.');
          void router.push(`/admin/clips/${clip.id}/configure`);
        }}
      />
    </AdminLayout>
  );
}
