import type { ClipRow, GameSessionRow, UserRow } from '@/types/database';
import { FakeDb } from './helpers/fakeSupabase';
import { __setSupabaseAdmin } from '@/lib/server/supabase';
import { __configureFlags, type FlagStore } from '@/lib/server/featureFlags';
import { ApiError } from '@/lib/server/handler';
import {
  assignCharacters,
  completeSession,
  createSession,
  joinSession,
  leaveSession,
  setReady,
  startSession,
  submitRecording,
} from '@/lib/server/gameFlow';

const broadcasts: Array<{ topic: string; type: string }> = [];
jest.mock('@/lib/server/realtime', () => ({
  broadcastSession: async (id: string, e: { type: string }) => void broadcasts.push({ topic: `session:${id}`, type: e.type }),
  broadcastUser: async (id: string, e: { type: string }) => void broadcasts.push({ topic: `user:${id}`, type: e.type }),
}));

let db: FakeDb;

function user(name: string): UserRow {
  return {
    id: `00000000-0000-4000-8000-${String(Math.floor(Math.random() * 1e12)).padStart(12, '0')}`,
    firebase_uid: name,
    email: `${name}@x.com`,
    username: name,
    display_name: name[0]!.toUpperCase() + name.slice(1),
    role: 'user',
    avatar_model: 'casual_m',
    avatar_color: '#ff2e6e',
    avatar_outfit: 'tee',
    avatar_url: null,
    status: 'active',
    games_played: 0,
    total_recordings: 0,
    clips_created: 0,
    last_seen_at: null,
    created_at: '',
    updated_at: '',
  };
}

function seedClip(owner: UserRow): ClipRow {
  const clip = db.defaults('clips', {
    uploaded_by: owner.id,
    title: 'Test scene',
    status: 'active',
    is_configured: true,
    cloudinary_public_id: 'dubsmash/clips/x/clip_1',
    original_video_url: 'https://res.cloudinary.com/demo/video/upload/clip_1.mp4',
    trimmed_video_url: null,
    duration_seconds: 20,
    trim_start: 0,
    trim_end: null,
    characters: [
      { id: 'A', name: 'Alice', color: '#ef4444' },
      { id: 'B', name: 'Bob', color: '#3b82f6' },
    ],
    timeline: [
      { id: 's1', start: 0, end: 7, character_id: 'A' },
      { id: 's2', start: 7, end: 13, character_id: 'B' },
      { id: 's3', start: 13, end: 20, character_id: 'A' },
    ],
  }) as unknown as ClipRow;
  db.table('clips').push(clip as unknown as Record<string, unknown>);
  return clip;
}

function befriend(a: UserRow, b: UserRow) {
  db.table('user_friends').push(db.defaults('user_friends', { user_id: a.id, friend_id: b.id, status: 'accepted' }));
}

function addTake(sessionId: string, u: UserRow, sequenceId: string) {
  db.table('recordings').push(
    db.defaults('recordings', { session_id: sessionId, user_id: u.id, sequence_id: sequenceId, audio_url: `https://res.cloudinary.com/demo/${sequenceId}.webm`, cloudinary_public_id: sequenceId, duration_seconds: 3 }),
  );
}

const session = (id: string) => db.table('game_sessions').find((s) => s.id === id) as unknown as GameSessionRow;

async function expectApiError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toBeInstanceOf(ApiError);
  await p.catch((e: ApiError) => expect(e.status).toBe(status));
}

beforeEach(() => {
  db = new FakeDb();
  db.rpcs.set('record_game_completed', () => null);
  __setSupabaseAdmin(db.client() as never);
  const flags: FlagStore = { get: async () => null, list: async () => [], update: async () => { throw new Error('n/a'); }, log: async () => {}, history: async () => [] };
  __configureFlags({ store: flags }); // built-in defaults: friend_system_enabled = true
  broadcasts.length = 0;
});

describe('game session state machine', () => {
  it('creates a lobby; a solo host gets every character', async () => {
    const host = user('host');
    const clip = seedClip(host);
    const s = await createSession(host, clip.id, []);
    expect(s.state).toBe('lobby');
    expect(s.players).toHaveLength(1);
    expect(s.players[0]!.character_ids).toEqual(['A', 'B']);
  });

  it('only allows inviting accepted friends and notifies them', async () => {
    const host = user('host');
    const friend = user('friend');
    const stranger = user('stranger');
    const clip = seedClip(host);
    await expectApiError(createSession(host, clip.id, [stranger.id]), 400);
    befriend(host, friend);
    const s = await createSession(host, clip.id, [friend.id]);
    expect(s.invited_user_ids).toEqual([friend.id]);
    const notes = db.table('notifications').filter((n) => n.user_id === friend.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.type).toBe('game_invitation');
    expect(notes[0]!.expires_at).toBeTruthy();
  });

  it('requires an invitation to join, re-deals roles and resets ready', async () => {
    const host = user('host');
    const friend = user('friend');
    const stranger = user('stranger');
    befriend(host, friend);
    const s = await createSession(host, seedClip(host).id, [friend.id]);
    await expectApiError(joinSession(s.id, stranger), 403);
    const joined = await joinSession(s.id, friend);
    expect(joined.players.map((p) => p.character_ids)).toEqual([['A'], ['B']]);
    expect(broadcasts).toContainEqual({ topic: `session:${s.id}`, type: 'player:joined' });
    // idempotent
    expect((await joinSession(s.id, friend)).players).toHaveLength(2);
  });

  it('host can only start once every other player is ready', async () => {
    const host = user('host');
    const friend = user('friend');
    befriend(host, friend);
    const s = await createSession(host, seedClip(host).id, [friend.id]);
    await joinSession(s.id, friend);
    await expectApiError(startSession(s.id, friend), 403);
    await expectApiError(startSession(s.id, host), 409);
    await setReady(s.id, friend, true);
    const started = await startSession(s.id, host);
    expect(started.state).toBe('recording');
    expect(started.current_sequence_index).toBe(0);
    expect(broadcasts.map((b) => b.type)).toEqual(expect.arrayContaining(['session:started', 'recording:start']));
  });

  it('rejects incomplete character assignments', async () => {
    const host = user('host');
    const friend = user('friend');
    befriend(host, friend);
    const s = await createSession(host, seedClip(host).id, [friend.id]);
    await joinSession(s.id, friend);
    await expectApiError(assignCharacters(s.id, host, { [host.id]: ['A'], [friend.id]: [] }), 400);
    const ok = await assignCharacters(s.id, host, { [host.id]: [], [friend.id]: ['A', 'B'] });
    expect(ok.players.find((p) => p.user_id === friend.id)!.character_ids).toEqual(['A', 'B']);
  });

  it('enforces turn order, advances on submit and queues the render after the last line', async () => {
    const host = user('host');
    const friend = user('friend');
    befriend(host, friend);
    const s = await createSession(host, seedClip(host).id, [friend.id]);
    await joinSession(s.id, friend); // host: A (s1, s3), friend: B (s2)
    await setReady(s.id, friend, true);
    await startSession(s.id, host);

    // friend cannot submit s2 before s1 is done
    addTake(s.id, friend, 's2');
    await expectApiError(submitRecording(s.id, friend, 's2'), 409);
    // host must upload before submitting
    await expectApiError(submitRecording(s.id, host, 's1'), 400);

    addTake(s.id, host, 's1');
    expect((await submitRecording(s.id, host, 's1')).done).toBe(false);
    expect(session(s.id).current_sequence_index).toBe(1);
    expect((await submitRecording(s.id, friend, 's2')).done).toBe(false);
    addTake(s.id, host, 's3');
    const last = await submitRecording(s.id, host, 's3');
    expect(last.done).toBe(true);
    expect(session(s.id).state).toBe('playback');

    const jobs = db.table('video_processing_queue');
    expect(jobs).toHaveLength(1);
    const payload = jobs[0]!.recordings as { tracks: Array<{ sequence_id: string; start: number }> };
    expect(payload.tracks.map((t) => [t.sequence_id, t.start])).toEqual([['s1', 0], ['s2', 7], ['s3', 13]]);

    // completing again is idempotent
    await completeSession(s.id);
    expect(db.table('video_processing_queue')).toHaveLength(1);
  });

  it('cancels when the host leaves; a guest leaving mid-game hands lines to the host', async () => {
    const host = user('host');
    const friend = user('friend');
    befriend(host, friend);
    const s = await createSession(host, seedClip(host).id, [friend.id]);
    await joinSession(s.id, friend);
    await setReady(s.id, friend, true);
    await startSession(s.id, host);
    const after = await leaveSession(s.id, friend);
    expect(after.players).toHaveLength(1);
    expect(after.players[0]!.character_ids.sort()).toEqual(['A', 'B']);
    expect((await leaveSession(s.id, host)).state).toBe('cancelled');
  });

  it('retries on concurrent modification (optimistic locking)', async () => {
    const host = user('host');
    const a = user('a');
    const b = user('b');
    befriend(host, a);
    befriend(host, b);
    const s = await createSession(host, seedClip(host).id, [a.id, b.id]);
    await Promise.all([joinSession(s.id, a), joinSession(s.id, b)]);
    await Promise.all([setReady(s.id, a, true), setReady(s.id, b, true)]);
    const final = session(s.id);
    expect(final.players).toHaveLength(3);
    expect(final.players.filter((p) => p.ready).map((p) => p.user_id).sort()).toEqual([a.id, b.id].sort());
  });
});
