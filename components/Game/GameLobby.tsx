import { useMemo, useState } from 'react';
import type { SessionDetails } from '@/types/api';
import type { SessionPlayer } from '@/types/database';
import { MAX_PLAYERS } from '@/types/game';
import { api, errorMessage } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { toast } from '@/store/toast';
import { AvatarDisplay, type AvatarDisplayItem } from './AvatarDisplay';
import { InviteFriendsModal } from './InviteFriendsModal';

/**
 * Lobby: 3D avatars with their roles and ready status. Players toggle Ready; the host can re-assign
 * characters, invite friends and Start once every other player is ready.
 */
export function GameLobby({ details, meId, onChanged }: { details: SessionDetails; meId: string; onChanged: () => void }) {
  const { session, clip } = details;
  const isHost = session.created_by === meId;
  const me = session.players.find((p) => p.user_id === meId);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const charById = useMemo(() => new Map(clip.characters.map((c) => [c.id, c])), [clip.characters]);
  const others = session.players.filter((p) => p.user_id !== session.created_by);
  const allReady = others.every((p) => p.ready);
  const pendingInvites = session.invited_user_ids.filter((id) => !session.players.some((p) => p.user_id === id)).length;

  const avatars: AvatarDisplayItem[] = session.players.map((p) => {
    const first = charById.get(p.character_ids[0] ?? '');
    const isHostP = p.user_id === session.created_by;
    return {
      id: p.user_id,
      model: p.avatar_model,
      color: p.avatar_color,
      outfit: p.avatar_outfit,
      accent: first?.color,
      state: p.ready || isHostP ? 'ready' : 'idle',
      displayName: p.display_name,
      label: (
        <div className="rounded-xl bg-ink-900/80 px-2 py-1 backdrop-blur">
          <p className="font-bold">{p.display_name}{isHostP && ' 👑'}</p>
          <p className="text-xs">
            {p.character_ids.map((id) => charById.get(id)?.name).filter(Boolean).join(' & ') || 'No role'}
          </p>
          <p className={`text-xs font-semibold ${p.ready || isHostP ? 'text-green-400' : 'text-ink-400'}`}>{isHostP ? 'Host' : p.ready ? 'Ready' : 'Not ready'}</p>
        </div>
      ),
    };
  });

  async function call(path: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    setBusy(true);
    try {
      await api(`/api/sessions/${session.id}/${path}`, { method, body });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function reassign(player: SessionPlayer, characterId: string) {
    // Move one character to `player`, keeping everything else as is.
    const assignments = Object.fromEntries(
      session.players.map((p) => [
        p.user_id,
        p.user_id === player.user_id ? [...new Set([...p.character_ids, characterId])] : p.character_ids.filter((c) => c !== characterId),
      ]),
    );
    void call('assign', { assignments }, 'PATCH');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand-300">⚑ Lobby</p>
          <h1 className="font-display text-3xl font-black">{clip.title}</h1>
          <p className="text-sm text-ink-200">
            {formatDuration(clip.duration_seconds)} · {clip.characters.length} characters · {session.players.length}/{MAX_PLAYERS} players
            {pendingInvites > 0 && ` · ${pendingInvites} invited`}
          </p>
        </div>
        <div className="flex gap-2">
          {isHost && session.players.length < MAX_PLAYERS && (
            <button className="btn-secondary" onClick={() => setInviteOpen(true)}>Invite friends</button>
          )}
          <button className="btn-ghost" onClick={() => void call('leave', {})} disabled={busy}>Leave</button>
        </div>
      </div>

      <div className="card-glow overflow-hidden rounded-3xl border border-brand-500/30">
        <AvatarDisplay avatars={avatars} className="h-80" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-bold">Roles</h2>
          {clip.characters.map((c) => {
            const owner = session.players.find((p) => p.character_ids.includes(c.id));
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 font-semibold">{c.name}</span>
                {isHost ? (
                  <select
                    className="input w-auto py-1 text-sm"
                    value={owner?.user_id ?? ''}
                    disabled={busy}
                    onChange={(e) => {
                      const p = session.players.find((x) => x.user_id === e.target.value);
                      if (p) reassign(p, c.id);
                    }}
                    aria-label={`Player for ${c.name}`}
                  >
                    {session.players.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-ink-200">{owner?.display_name ?? '—'}</span>
                )}
              </div>
            );
          })}
          <p className="text-xs text-ink-400">Players with several roles record each of their lines in turn.</p>
        </div>

        <div className="card flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-bold">How it works</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-ink-200">
              <li>Everyone hits Ready.</li>
              <li>Lines are recorded in scene order — watch for your turn.</li>
              <li>Hear the original line, 3-2-1, and perform it. Re-record as much as you like.</li>
              <li>Watch your avatars perform the dubbed scene!</li>
            </ol>
          </div>
          {isHost ? (
            <button className="btn-primary py-3 font-display text-xl uppercase tracking-wider" disabled={busy || !allReady} onClick={() => void call('start', {})}>
              {allReady ? '▶ Start game' : `Waiting for ${others.filter((p) => !p.ready).length} player(s)…`}
            </button>
          ) : (
            me && (
              <button className={`${me.ready ? 'btn-secondary' : 'btn-primary animate-pulse-glow'} py-3 font-display text-xl uppercase tracking-wider`} disabled={busy} onClick={() => void call('ready', { ready: !me.ready })}>
                {me.ready ? "I'm not ready" : "I'm ready!"}
              </button>
            )
          )}
        </div>
      </div>

      {isHost && (
        <InviteFriendsModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          exclude={[...session.players.map((p) => p.user_id), ...session.invited_user_ids]}
          max={MAX_PLAYERS - session.players.length}
          onInvite={async (ids) => {
            await call('invite', { user_ids: ids });
            setInviteOpen(false);
          }}
        />
      )}
    </div>
  );
}
