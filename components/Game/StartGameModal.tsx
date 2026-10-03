import { useRouter } from 'next/router';
import { useState } from 'react';
import type { PlayableClip } from '@/types/api';
import { MAX_PLAYERS } from '@/types/game';
import { api, errorMessage } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { useFriends } from '@/hooks/useFriends';
import { AvatarBadge } from '@/components/Common/AvatarBadge';
import { ErrorBox, Modal } from '@/components/Common/ui';

/** Clip details + optional friend invites -> creates the lobby and navigates to it. */
export function StartGameModal({ clip, onClose }: { clip: PlayableClip | null; onClose: () => void }) {
  const router = useRouter();
  const { friends, enabled } = useFriends();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = Math.min(MAX_PLAYERS - 1, Math.max(0, (clip?.character_count ?? 1) - 1) || MAX_PLAYERS - 1);

  async function start() {
    if (!clip) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ session_id: string }>('/api/sessions/create', { method: 'POST', body: { clip_id: clip.id, invited_player_ids: picked } });
      void router.push(`/play/${res.session_id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open={!!clip} onClose={onClose} title={clip?.title ?? ''}>
      {clip && (
        <div className="space-y-4">
          {clip.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.thumbnail_url} alt="" className="aspect-video w-full rounded-xl object-cover" />
          )}
          {clip.description && <p className="text-sm text-ink-200">{clip.description}</p>}
          <p className="text-sm text-ink-200">{formatDuration(Number(clip.trim_end ?? clip.duration_seconds) - Number(clip.trim_start))} · {clip.difficulty}</p>
          <div className="flex flex-wrap gap-1">
            {clip.characters.map((c) => <span key={c.id} className="badge text-white" style={{ background: c.color }}>{c.name}</span>)}
          </div>
          {error && <ErrorBox message={error} />}
          {enabled && friends.length > 0 && (
            <div>
              <p className="label">Invite friends (optional, up to {max})</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {friends.map((f) => {
                  const on = picked.includes(f.user.id);
                  return (
                    <li key={f.user.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 ${on ? 'bg-brand-500/20' : 'hover:bg-ink-700'}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!on && picked.length >= max}
                          onChange={() => setPicked((p) => (on ? p.filter((x) => x !== f.user.id) : [...p, f.user.id]))}
                        />
                        <AvatarBadge user={f.user} size={28} online={f.online} />
                        <span className="text-sm">{f.user.display_name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <button className="btn-primary w-full py-3" disabled={busy} onClick={() => void start()}>
            {busy ? 'Creating lobby…' : picked.length ? `Create lobby & invite ${picked.length}` : 'Create lobby (solo or invite later)'}
          </button>
        </div>
      )}
    </Modal>
  );
}
