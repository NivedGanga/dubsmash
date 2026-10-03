import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import type { ProcessingStatusResponse, SessionDetails } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { toast } from '@/store/toast';
import { AvatarBadge } from '@/components/Common/AvatarBadge';
import { VideoProcessing } from './VideoProcessing';

/** Post-game: who played whom, takes per player, final video download/share, replay options. */
export function ResultsScreen({
  details,
  meId,
  processing,
  eta,
  onWatchAgain,
}: {
  details: SessionDetails;
  meId: string;
  processing: ProcessingStatusResponse | null;
  eta: number | null;
  onWatchAgain: () => void;
}) {
  const router = useRouter();
  const { session, clip, recordings, sequences } = details;
  const [busy, setBusy] = useState(false);
  const charById = new Map(clip.characters.map((c) => [c.id, c]));
  const endedAt = session.completed_at ? Date.parse(session.completed_at) : Date.now();
  const gameSeconds = session.started_at ? (endedAt - Date.parse(session.started_at)) / 1000 : null;

  async function replay() {
    setBusy(true);
    try {
      const others = session.players.map((p) => p.user_id).filter((id) => id !== meId);
      const res = await api<{ session_id: string }>('/api/sessions/create', { method: 'POST', body: { clip_id: clip.id, invited_player_ids: others } });
      void router.push(`/play/${res.session_id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wider text-ink-400">That&apos;s a wrap!</p>
        <h1 className="font-display text-4xl font-black">{clip.title}</h1>
        {gameSeconds !== null && <p className="text-sm text-ink-200">Recorded in {formatDuration(gameSeconds)}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-bold">Cast</h2>
          {session.players.map((p) => {
            const lines = sequences.filter((s) => s.user_id === p.user_id);
            const takes = recordings.filter((r) => r.user_id === p.user_id);
            const attempts = takes.reduce((n, r) => n + r.attempt, 0);
            return (
              <div key={p.user_id} className="flex items-center gap-3">
                <AvatarBadge user={{ display_name: p.display_name, avatar_color: p.avatar_color, avatar_url: null }} size={40} />
                <div className="flex-1">
                  <p className="font-semibold">{p.display_name}{p.user_id === meId && ' (you)'}</p>
                  <p className="text-xs text-ink-200">
                    {p.character_ids.map((id) => charById.get(id)?.name).join(' & ')} · {lines.length} line{lines.length === 1 ? '' : 's'} · {attempts} take{attempts === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <VideoProcessing status={processing} eta={eta} title={clip.title} />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn-secondary" onClick={onWatchAgain}>▶ Watch again</button>
        <button className="btn-primary" disabled={busy} onClick={() => void replay()}>↺ Replay this clip</button>
        <Link href="/game" className="btn-secondary">Play a different clip</Link>
      </div>
    </div>
  );
}
