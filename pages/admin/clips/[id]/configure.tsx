import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipCharacter, ClipRow, TimelineSection } from '@/types/database';
import { api, errorMessage } from '@/lib/api';
import { createTimeline, fitToDuration, removeCharacterFromTimeline, validateTimeline } from '@/lib/timeline';
import { formatDuration, round2 } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import { ErrorBox, FullPageSpinner, Modal, StatusBadge } from '@/components/Common/ui';
import { TimelineEditor } from '@/components/Timeline/TimelineEditor';
import { CharacterEditor, defaultCharacters } from '@/components/Timeline/CharacterEditor';
import { TrimControls } from '@/components/Timeline/TrimControls';

type ClipResponse = { clip: ClipRow & { video_url: string }; can_manage: boolean };

export default function ConfigureClipPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const me = useSession((s) => s.me);
  const isSuper = me?.user.role === 'super_admin';
  const { data, error, reload } = useApi<ClipResponse>(id && me ? `/api/clips/${id}` : null);
  const clip = data?.clip;

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);
  const [absTime, setAbsTime] = useState(0);
  const [trim, setTrim] = useState<[number, number]>([0, 0]);
  const [characters, setCharacters] = useState<ClipCharacter[]>(defaultCharacters());
  const [sections, setSections] = useState<TimelineSection[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [dirty, setDirty] = useState(false);

  // Initialise editor state from the loaded clip.
  useEffect(() => {
    if (!clip) return;
    setTrim([clip.trim_start, clip.trim_end ?? clip.duration_seconds]);
    if (clip.is_configured && clip.timeline.length) {
      setCharacters(clip.characters);
      setSections(clip.timeline);
    }
    setDirty(false);
  }, [clip]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const playable = round2(trim[1] - trim[0]);
  const relTime = round2(absTime - trim[0]);
  const validation = useMemo(
    () => (sections ? validateTimeline(sections, playable, characters) : null),
    [sections, playable, characters],
  );

  if (error) return <AdminLayout title="Configure clip"><ErrorBox message={error} onRetry={() => void reload()} /></AdminLayout>;
  if (!clip) return <AdminLayout title="Configure clip"><FullPageSpinner /></AdminLayout>;

  const editable = data.can_manage;

  function change(next: TimelineSection[]) {
    setSections(next);
    setDirty(true);
  }

  function onTrim(start: number, end: number) {
    setTrim([start, end]);
    setDirty(true);
    if (sections) setSections(fitToDuration(sections, round2(end - start)));
    const v = videoRef.current;
    if (v && (v.currentTime < start || v.currentTime > end)) v.currentTime = start;
  }

  function seek(t: number) {
    const v = videoRef.current;
    if (v) v.currentTime = trim[0] + t;
  }

  function playSection(s: TimelineSection) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = trim[0] + s.start;
    stopAt.current = trim[0] + s.end;
    void v.play();
  }

  function onTimeUpdate() {
    const v = videoRef.current!;
    setAbsTime(v.currentTime);
    if (stopAt.current !== null && v.currentTime >= stopAt.current) {
      v.pause();
      stopAt.current = null;
    } else if (v.currentTime >= trim[1]) {
      v.pause();
      v.currentTime = trim[0];
    }
  }

  async function save() {
    if (!sections || !validation?.valid) return;
    setSaving(true);
    try {
      const res = await api<{ clip: ClipRow; requires_approval: boolean }>(`/api/clips/${clip!.id}/configure`, {
        method: 'PUT',
        body: {
          trim_start: trim[0],
          trim_end: trim[1] >= clip!.duration_seconds - 0.01 ? null : trim[1],
          characters: characters.map((c) => ({ ...c, name: c.name.trim() || c.id })),
          timeline: sections,
        },
      });
      setDirty(false);
      toast.success(res.requires_approval ? 'Saved! Sent to the super admin for approval.' : 'Saved! The clip is live.');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function moderate(action: 'approve' | 'reject') {
    try {
      await api(`/api/clips/${clip!.id}/${action}`, { method: 'PATCH', body: action === 'reject' ? { reason: rejectReason.trim() || undefined } : {} });
      toast.success(action === 'approve' ? 'Clip approved and live.' : 'Clip sent back for changes.');
      setRejectOpen(false);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <AdminLayout title={clip.title}>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/clips" className="text-ink-200 hover:text-white">← All clips</Link>
        <StatusBadge status={clip.status} />
        {clip.is_configured ? <span className="text-ink-200">Configured</span> : <span className="text-yellow-300">Not configured yet</span>}
        <span className="text-ink-400">Original length {formatDuration(clip.duration_seconds)}</span>
        {isSuper && clip.status === 'pending' && clip.is_configured && !dirty && (
          <span className="ml-auto flex gap-2">
            <button className="btn-primary py-1" onClick={() => void moderate('approve')}>Approve</button>
            <button className="btn-secondary py-1" onClick={() => setRejectOpen(true)}>Reject</button>
          </span>
        )}
      </div>
      {clip.status === 'rejected' && clip.rejection_reason && (
        <div className="mb-4"><ErrorBox message={`Changes requested: ${clip.rejection_reason}`} /></div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <video
            ref={videoRef}
            src={clip.original_video_url}
            className="aspect-video w-full rounded-2xl bg-black"
            controls
            preload="metadata"
            onTimeUpdate={onTimeUpdate}
            onSeeked={onTimeUpdate}
          />
          <section className="card space-y-3">
            <h2 className="font-bold">1. Trim</h2>
            <TrimControls duration={clip.duration_seconds} start={trim[0]} end={trim[1]} onChange={onTrim} currentTime={absTime} disabled={!editable} />
          </section>
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">3. Map the timeline</h2>
              {sections && editable && (
                <button className="text-xs text-ink-400 hover:text-white" onClick={() => window.confirm('Reset all mapping?') && change(createTimeline(playable))}>
                  Reset mapping
                </button>
              )}
            </div>
            {!sections ? (
              <div className="py-6 text-center">
                <p className="mb-4 text-sm text-ink-200">
                  Drag the end pointer to where the first line ends — a new boundary appears. Assign each section to a character.
                </p>
                <button className="btn-primary" disabled={!editable} onClick={() => change(createTimeline(playable))}>Start mapping</button>
              </div>
            ) : (
              <TimelineEditor
                duration={playable}
                sections={sections}
                characters={characters}
                onChange={change}
                currentTime={relTime}
                onSeek={seek}
                onPlaySection={playSection}
                disabled={!editable}
              />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-3">
            <h2 className="font-bold">2. Characters</h2>
            <CharacterEditor
              characters={characters}
              disabled={!editable}
              onChange={(c) => {
                setCharacters(c);
                setDirty(true);
              }}
              onDelete={(cid) => {
                setCharacters((list) => list.filter((c) => c.id !== cid));
                if (sections) setSections(removeCharacterFromTimeline(sections, cid));
                setDirty(true);
              }}
            />
          </section>
          <section className="card space-y-3">
            <h2 className="font-bold">4. Save</h2>
            {validation && !validation.valid && (
              <ul className="list-inside list-disc text-xs text-yellow-300">
                {validation.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            <button className="btn-primary w-full" disabled={!editable || saving || !validation?.valid} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Submit configuration'}
            </button>
            {me?.flags.clip_approval_workflow && !isSuper && <p className="text-xs text-ink-400">The super admin reviews clips before they go live.</p>}
          </section>
        </aside>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Request changes">
        <textarea className="input min-h-24" maxLength={1000} placeholder="What should be fixed?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        <button className="btn-danger mt-4 w-full" onClick={() => void moderate('reject')}>Reject clip</button>
      </Modal>
    </AdminLayout>
  );
}
