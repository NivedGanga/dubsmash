import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionDetails } from '@/types/api';
import type { SessionEvent } from '@/types/game';
import { api } from '@/lib/api';
import { audioContext, loadBuffer, normalisationGain } from '@/lib/audio';
import { effectiveVolume, useSettings } from '@/store/settings';
import { AvatarDisplay, type AvatarDisplayItem } from './AvatarDisplay';

type StagePhase = 'loading' | 'ready' | 'playing' | 'credits';

/**
 * Live playback: the (trimmed) clip plays muted while every player's take is scheduled on a shared
 * Web Audio clock at its timeline position (peak-normalised, dialogue volume from settings). Avatars
 * "speak" during their character's lines. This needs no server render, so it starts immediately;
 * the FFmpeg MP4 is produced in the background for download/sharing.
 *
 * Sync: the host can start playback for everyone (`playback:start` with a wall-clock time).
 */
export function PlaybackStage({
  details,
  meId,
  lastEvent,
  onFinished,
}: {
  details: SessionDetails;
  meId: string;
  lastEvent: SessionEvent | null;
  onFinished: () => void;
}) {
  const { clip, session, sequences, recordings } = details;
  const settings = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const buffers = useRef<Map<string, { buffer: AudioBuffer; gain: number }>>(new Map());
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const [phase, setPhase] = useState<StagePhase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const isHost = session.created_by === meId;

  // Preload + decode every take.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      recordings.map(async (r) => {
        const buffer = await loadBuffer(r.audio_url);
        buffers.current.set(r.sequence_id, { buffer, gain: normalisationGain(buffer) });
      }),
    )
      .then(() => !cancelled && setPhase('ready'))
      .catch(() => {
        if (!cancelled) {
          setLoadError('Some recordings could not be loaded. Playback will skip them.');
          setPhase('ready');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [recordings]);

  function stopAll() {
    sources.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    sources.current = [];
  }
  useEffect(() => stopAll, []);

  function play(delayMs = 300) {
    const v = videoRef.current;
    if (!v) return;
    stopAll();
    const ctx = audioContext();
    const master = ctx.createGain();
    master.gain.value = effectiveVolume(settings, settings.dialogueVolume);
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + delayMs / 1000;
    for (const seq of sequences) {
      const b = buffers.current.get(seq.id);
      if (!b) continue;
      const src = ctx.createBufferSource();
      src.buffer = b.buffer;
      const g = ctx.createGain();
      g.gain.value = b.gain;
      src.connect(g).connect(master);
      // Trim each take to its line (+ small tail) so takes never overlap the next line badly.
      src.start(t0 + seq.start, 0, seq.end - seq.start + 0.75);
      sources.current.push(src);
    }
    v.muted = true;
    v.currentTime = 0;
    window.setTimeout(() => void v.play().catch(() => {}), delayMs);
    setPhase('playing');
  }

  // Synchronised start requested by the host.
  useEffect(() => {
    if (lastEvent?.type !== 'playback:start' || phase === 'loading') return;
    play(Math.max(100, lastEvent.at - Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  async function playForEveryone() {
    // Everyone (including us) receives playback:start via realtime; fall back to local play on error.
    await api(`/api/sessions/${session.id}/playback`, { method: 'POST', body: {} }).catch(() => play());
  }

  const speakingChar = useMemo(() => {
    if (phase !== 'playing') return null;
    return sequences.find((s) => time >= s.start && time < s.end)?.character_id ?? null;
  }, [phase, time, sequences]);

  const charById = new Map(clip.characters.map((c) => [c.id, c]));
  const avatars: AvatarDisplayItem[] = session.players.map((p) => ({
    id: p.user_id,
    model: p.avatar_model,
    color: p.avatar_color,
    outfit: p.avatar_outfit,
    accent: charById.get(p.character_ids[0] ?? '')?.color,
    state: phase === 'credits' ? 'celebrate' : speakingChar && p.character_ids.includes(speakingChar) ? 'speaking' : phase === 'playing' ? 'listening' : 'idle',
    displayName: p.display_name,
    label: (
      <span className="rounded-lg bg-ink-900/80 px-2 py-0.5 text-xs font-bold">
        {p.character_ids.map((id) => charById.get(id)?.name).join(' & ')}
      </span>
    ),
  }));

  const current = sequences.find((s) => time >= s.start && time < s.end);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          src={clip.video_url}
          muted
          playsInline
          preload="auto"
          className="aspect-video w-full"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setPhase('credits');
            window.setTimeout(onFinished, 6000);
          }}
        />
        {settings.subtitles && phase === 'playing' && current?.dialogue && (
          <p className="absolute inset-x-0 bottom-6 mx-auto w-fit max-w-[90%] rounded-lg bg-black/70 px-3 py-1 text-center text-lg">
            <span style={{ color: current.character.color }} className="font-bold">{current.character.name}:</span> {current.dialogue}
          </p>
        )}
        {phase !== 'playing' && phase !== 'credits' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            {phase === 'loading' ? (
              <p className="animate-pulse text-lg">Loading everyone&apos;s takes…</p>
            ) : (
              <>
                <button className="btn-primary px-8 py-4 text-2xl" onClick={() => play()}>▶ Watch the scene</button>
                {isHost && session.players.length > 1 && (
                  <button className="btn-secondary" onClick={() => void playForEveryone()}>Play for everyone at once</button>
                )}
              </>
            )}
            {loadError && <p className="text-sm text-yellow-300">{loadError}</p>}
          </div>
        )}
        {phase === 'credits' && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black/80">
            <div className="text-center" style={{ animation: 'credits 6s linear forwards' }}>
              <p className="mb-6 font-display text-4xl font-black text-brand-500">{clip.title}</p>
              {clip.characters.map((c) => {
                const p = session.players.find((x) => x.character_ids.includes(c.id));
                return (
                  <p key={c.id} className="mb-3 text-xl">
                    <span style={{ color: c.color }} className="font-bold">{c.name}</span> <span className="text-ink-200">voiced by</span> {p?.display_name}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <AvatarDisplay avatars={avatars} variant="stage" className="h-64" />
      <style jsx global>{`
        @keyframes credits {
          from { transform: translateY(60%); }
          to { transform: translateY(-20%); }
        }
      `}</style>
    </div>
  );
}
