import { useRef, useState, type FormEvent } from 'react';
import type { ClipRow, FolderRow } from '@/types/database';
import { api, errorMessage } from '@/lib/api';
import { uploadToCloudinary } from '@/lib/upload';
import { Modal, ErrorBox } from '@/components/Common/ui';

const MAX_BYTES = 500 * 1024 * 1024;
const ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-m4v';

export function UploadClipModal({
  open,
  onClose,
  folders,
  defaultFolderId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  folders: FolderRow[];
  defaultFolderId: string | null;
  onUploaded: (clip: ClipRow) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  function pick(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    if (!f.type.startsWith('video/')) return setError('Please choose a video file.');
    if (f.size > MAX_BYTES) return setError('Videos can be at most 500MB.');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const up = await uploadToCloudinary(file, { kind: 'clip' }, { onProgress: setProgress, signal: abort.current.signal });
      const { clip } = await api<{ clip: ClipRow }>('/api/clips/upload', {
        method: 'POST',
        body: { public_id: up.public_id, title: title.trim(), description: description.trim() || undefined, difficulty, folder_id: folderId || null },
      });
      onUploaded(clip);
      setFile(null);
      setTitle('');
      setDescription('');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(errorMessage(err));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  const busy = progress !== null;

  return (
    <Modal
      open={open}
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
      title="Upload a clip"
    >
      <form className="space-y-4" onSubmit={submit}>
        {error && <ErrorBox message={error} />}
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-600 p-6 text-center text-sm text-ink-200 hover:border-brand-500">
          <input type="file" accept={ACCEPT} className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {file ? (
            <>
              <span className="font-semibold text-white">{file.name}</span>
              <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </>
          ) : (
            <span>Click to choose a video (MP4, MOV, WebM · up to 500MB, 15 min)</span>
          )}
        </label>
        <div>
          <label className="label" htmlFor="clip-title">Title</label>
          <input id="clip-title" className="input" required maxLength={120} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="clip-desc">Description</label>
          <textarea id="clip-desc" className="input" maxLength={1000} value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="clip-folder">Folder</label>
            <select id="clip-folder" className="input" value={folderId} disabled={busy} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">No folder</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="clip-diff">Difficulty</label>
            <select id="clip-diff" className="input" value={difficulty} disabled={busy} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        {busy && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-200">{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Processing…'}</p>
          </div>
        )}
        <button className="btn-primary w-full" disabled={!file || busy || !title.trim()}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </Modal>
  );
}
