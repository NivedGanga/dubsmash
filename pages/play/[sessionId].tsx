import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { SessionDetails } from '@/types/api';
import type { SessionEvent } from '@/types/game';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useGameSession } from '@/hooks/useGameSession';
import { useVideoProcessing } from '@/hooks/useVideoProcessing';
import { toast } from '@/store/toast';
import { Shell } from '@/components/Layout/Shell';
import { EmptyState, ErrorBox, FullPageSpinner } from '@/components/Common/ui';
import { GameLobby } from '@/components/Game/GameLobby';
import { RecordingScreen } from '@/components/Game/RecordingScreen';
import { PlaybackStage } from '@/components/Game/PlaybackStage';
import { ResultsScreen } from '@/components/Game/ResultsScreen';

function TurnTracker({ details, meId }: { details: SessionDetails; meId: string }) {
  const recorded = new Set(details.recordings.map((r) => r.sequence_id));
  const current = details.session.current_sequence_index;
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Recording progress">
      {details.sequences.map((s) => {
        const p = details.session.players.find((x) => x.user_id === s.user_id);
        const state = recorded.has(s.id) && s.index !== current ? 'done' : s.index === current ? 'now' : 'todo';
        return (
          <li
            key={s.id}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              state === 'now' ? 'border-brand-500 bg-brand-500 text-white shadow-glow-sm' : state === 'done' ? 'border-green-600/40 bg-green-600/20 text-green-200' : 'border-ink-600 bg-ink-700 text-ink-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.character.color }} />
            {s.index + 1}. {s.character.name}
            <span className="opacity-70">· {s.user_id === meId ? 'you' : p?.display_name}</span>
            {state === 'done' && ' ✓'}
          </li>
        );
      })}
    </ol>
  );
}

function WaitingForTurn({ details, lastEvent }: { details: SessionDetails; lastEvent: SessionEvent | null }) {
  const seq = details.sequences[details.session.current_sequence_index];
  const player = details.session.players.find((p) => p.user_id === seq?.user_id);
  const live = lastEvent?.type === 'recording:start' && lastEvent.sequence_id === seq?.id;
  return (
    <div className="card card-glow flex flex-col items-center gap-3 py-12 text-center">
      <span className={`text-5xl ${live ? 'animate-pulse-glow' : 'animate-float'}`}>{live ? '🎙️' : '⏳'}</span>
      <p className="text-xl font-bold">
        {player?.display_name ?? 'Someone'} is {live ? 'recording' : 'up next for'}{' '}
        <span style={{ color: seq?.character.color }}>{seq?.character.name}</span>
      </p>
      {seq?.dialogue && <p className="max-w-lg text-ink-200">“{seq.dialogue}”</p>}
      <p className="text-sm text-ink-400">Your turn comes automatically — keep this tab open.</p>
    </div>
  );
}

export default function PlayPage() {
  const router = useRouter();
  const sessionId = typeof router.query.sessionId === 'string' ? router.query.sessionId : null;
  const { me, allowed } = useRequireAuth('user');
  const { details, error, connection, lastEvent, refresh } = useGameSession(allowed ? sessionId : null);
  const { status: processing, eta } = useVideoProcessing(details && (details.session.state === 'playback' || details.session.state === 'completed') ? sessionId : null, lastEvent);
  const [joining, setJoining] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [stageKey, setStageKey] = useState(0);

  // Toasts for notable realtime events.
  useEffect(() => {
    if (!lastEvent || !details || !me) return;
    const name = (id: string) => details.session.players.find((p) => p.user_id === id)?.display_name ?? 'A player';
    if (lastEvent.type === 'player:joined' && lastEvent.player.user_id !== me.user.id) toast.info(`${lastEvent.player.display_name} joined the lobby`);
    if (lastEvent.type === 'player:left') toast.info(`${name(lastEvent.user_id)} left the game`);
    if (lastEvent.type === 'session:started') toast.success('Game on! Recording has started.');
    if (lastEvent.type === 'recording:start' && lastEvent.user_id === me.user.id) toast.info("It's your turn to record!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  if (!allowed || !me) return <Shell><FullPageSpinner /></Shell>;
  if (error && !details) return <Shell><ErrorBox message={error} onRetry={() => void refresh()} /></Shell>;
  if (!details) return <Shell><FullPageSpinner label="Joining the room…" /></Shell>;

  const { session } = details;
  const meId = me.user.id;
  const isPlayer = session.players.some((p) => p.user_id === meId);
  const currentSeq = details.sequences[session.current_sequence_index];

  async function join() {
    setJoining(true);
    try {
      await api(`/api/sessions/${session.id}/join`, { method: 'POST', body: {} });
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  let body: JSX.Element;
  if (session.state === 'cancelled') {
    body = <EmptyState title="This game was cancelled" action={<Link className="btn-primary" href="/game">Back to scenes</Link>}>The host left or ended the game.</EmptyState>;
  } else if (!isPlayer) {
    body =
      session.state === 'lobby' ? (
        <div className="card mx-auto max-w-md space-y-4 text-center">
          <p className="text-sm uppercase tracking-wider text-ink-400">You&apos;re invited</p>
          <h1 className="font-display text-3xl font-black">{details.clip.title}</h1>
          <p className="text-ink-200">{session.players.map((p) => p.display_name).join(', ')} {session.players.length === 1 ? 'is' : 'are'} waiting in the lobby.</p>
          <button className="btn-primary w-full py-3 text-lg" disabled={joining} onClick={() => void join()}>{joining ? 'Joining…' : 'Join game'}</button>
        </div>
      ) : (
        <EmptyState title="This game already started" action={<Link className="btn-primary" href="/game">Find another scene</Link>} />
      );
  } else if (session.state === 'lobby') {
    body = <GameLobby details={details} meId={meId} onChanged={() => void refresh()} />;
  } else if (session.state === 'recording') {
    body = (
      <div className="space-y-6">
        <div>
          <h1 className="mb-3 font-display text-3xl font-black">{details.clip.title}</h1>
          <TurnTracker details={details} meId={meId} />
        </div>
        {currentSeq?.user_id === meId ? (
          <RecordingScreen key={currentSeq.id} details={details} sequence={currentSeq} onSubmitted={() => void refresh()} />
        ) : (
          <WaitingForTurn details={details} lastEvent={lastEvent} />
        )}
      </div>
    );
  } else if (!showResults) {
    body = (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-black">{details.clip.title}</h1>
        <PlaybackStage key={stageKey} details={details} meId={meId} lastEvent={lastEvent} onFinished={() => setShowResults(true)} />
        <div className="flex justify-end">
          <button className="btn-ghost" onClick={() => setShowResults(true)}>Skip to results →</button>
        </div>
      </div>
    );
  } else {
    body = (
      <ResultsScreen
        details={details}
        meId={meId}
        processing={processing}
        eta={eta}
        onWatchAgain={() => {
          setStageKey((k) => k + 1);
          setShowResults(false);
        }}
      />
    );
  }

  return (
    <Shell wide>
      {connection === 'disconnected' && (
        <p className="mb-4 rounded-xl bg-yellow-900/50 px-4 py-2 text-sm text-yellow-200" role="status">Reconnecting… updates may be delayed.</p>
      )}
      {body}
    </Shell>
  );
}
