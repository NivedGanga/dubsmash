import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Paginated, PlayableClip } from '@/types/api';
import { formatDuration } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { useFriends } from '@/hooks/useFriends';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Shell } from '@/components/Layout/Shell';
import { AvatarBadge } from '@/components/Common/AvatarBadge';
import { EmptyState, ErrorBox, FullPageSpinner, Spinner } from '@/components/Common/ui';
import { StartGameModal } from '@/components/Game/StartGameModal';

const difficultyColor = { easy: 'text-green-300', medium: 'text-yellow-300', hard: 'text-red-300' } as const;

function ClipTile({ clip, onPick }: { clip: PlayableClip; onPick: () => void }) {
  const length = Number(clip.trim_end ?? clip.duration_seconds) - Number(clip.trim_start);
  return (
    <button className="card group flex flex-col gap-3 p-3 text-left transition hover:-translate-y-2 hover:rotate-1 hover:border-fg-pink/60 hover:shadow-glow" onClick={onPick}>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-ink-900">
        {clip.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 text-xs">{formatDuration(length)}</span>
      </div>
      <div>
        <p className="truncate font-bold">{clip.title}</p>
        <p className="text-xs text-ink-400">
          <span className={difficultyColor[clip.difficulty]}>{clip.difficulty}</span> · {clip.character_count} roles · played {clip.times_played}×
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {clip.characters.map((c) => <span key={c.id} className="badge text-white" style={{ background: c.color }}>{c.name}</span>)}
      </div>
    </button>
  );
}

export default function GamePage() {
  const { me, allowed } = useRequireAuth('user');
  const { friends, onlineCount, enabled: friendsEnabled } = useFriends();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [chars, setChars] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [picked, setPicked] = useState<PlayableClip | null>(null);
  const clipsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const clips = useApi<Paginated<PlayableClip>>(allowed ? '/api/clips/playable' : null, {
    q: debouncedQ || undefined,
    character_count: chars || undefined,
    difficulty: difficulty || undefined,
    page_size: 24,
  });

  if (!allowed || !me) return <Shell><FullPageSpinner /></Shell>;

  return (
    <Shell wide>
      <section className="relative mb-10 flex flex-col gap-6 overflow-hidden rounded-[2.5rem] border-2 border-white/20 bg-gradient-to-br from-fg-purple via-brand-600 to-fg-pink p-8 shadow-glow sm:flex-row sm:items-center">
        <span className="bean right-4 top-4 h-14 w-10 animate-float bg-fg-yellow/80 [border-radius:55%_45%_50%_50%/60%_55%_45%_40%]" aria-hidden />
        <span className="bean bottom-4 right-1/3 h-8 w-6 animate-float bg-white/40 [animation-delay:1s] [border-radius:60%_40%_55%_45%/50%_60%_40%_50%]" aria-hidden />
        <div className="flex-1">
          <p className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white w-fit">Player 1 · {me.user.display_name}</p>
          <h1 className="mt-3 font-display text-5xl text-white drop-shadow-[0_5px_0_rgba(0,0,0,0.3)]">READY TO DUB?</h1>
          <p className="mt-2 font-medium text-white/90">
            {friendsEnabled ? `${onlineCount} friend${onlineCount === 1 ? '' : 's'} online now.` : 'Pick a scene and start recording.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <button className="btn-yellow animate-bounce-soft px-10 py-4 font-display text-2xl" onClick={() => clipsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            ▶ Play
          </button>
          {friendsEnabled && (
            <Link href="/friends" className="btn-ghost border-2 border-white/30 px-6 py-2 text-sm">Invite friends</Link>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <section ref={clipsRef}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-display text-2xl tracking-wide">
              CHOOSE YOUR <span className="text-fg-yellow drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">SCENE</span>
            </h2>
            <input className="input w-48 py-1.5" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search scenes" />
            <select className="input w-auto py-1.5" value={chars} onChange={(e) => setChars(e.target.value)} aria-label="Number of roles">
              <option value="">Any roles</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} role{n > 1 ? 's' : ''}</option>)}
            </select>
            <select className="input w-auto py-1.5" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
              <option value="">Any difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          {clips.error && <ErrorBox message={clips.error} onRetry={() => void clips.reload()} />}
          {clips.loading && !clips.data && <Spinner />}
          {clips.data?.items.length === 0 && (
            <EmptyState title="No scenes available yet">
              Admins upload and map clips in the <Link href="/admin" className="text-brand-300 hover:underline">admin portal</Link>.
            </EmptyState>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clips.data?.items.map((c) => <ClipTile key={c.id} clip={c} onPick={() => setPicked(c)} />)}
          </div>
        </section>

        {friendsEnabled && (
          <aside className="card h-fit space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Friends</h2>
              <Link href="/friends" className="text-xs text-brand-300 hover:underline">Manage</Link>
            </div>
            {friends.length === 0 && <p className="text-sm text-ink-400">No friends yet. Add some to play together!</p>}
            <ul className="space-y-2">
              {friends.slice(0, 12).map((f) => (
                <li key={f.user.id} className="flex items-center gap-2">
                  <AvatarBadge user={f.user} size={32} online={f.online} />
                  <span className="truncate text-sm">{f.user.display_name}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <StartGameModal clip={picked} onClose={() => setPicked(null)} />
    </Shell>
  );
}
