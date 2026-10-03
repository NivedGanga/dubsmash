import type { ClipCharacter, SessionPlayer, SessionState, TimelineSection, UUID } from './database';

/** A recordable dialogue sequence: a timeline section plus the player who owns its character. */
export interface Sequence extends TimelineSection {
  index: number;
  character: ClipCharacter;
  user_id: UUID | null;
}

/** Real-time events broadcast on the `session:{id}` channel. */
export type SessionEvent =
  | { type: 'player:joined'; player: SessionPlayer }
  | { type: 'player:left'; user_id: UUID }
  | { type: 'player:ready'; user_id: UUID; ready: boolean }
  | { type: 'players:assigned' }
  | { type: 'session:started'; current_sequence_index: number }
  | { type: 'recording:start'; user_id: UUID; sequence_id: string; sequence_index: number }
  | { type: 'recording:complete'; user_id: UUID; sequence_id: string; audio_url: string; next_sequence_index: number | null }
  | { type: 'playback:start'; at: number }
  | { type: 'processing:update'; status: string; final_video_url?: string }
  | { type: 'session:state'; state: SessionState };

/** Real-time events broadcast on the per-user `user:{id}` channel. */
export type UserEvent =
  | { type: 'notification:new'; notification_id: UUID }
  | { type: 'friends:changed' };

export const SESSION_EVENT = 'session_event';
export const USER_EVENT = 'user_event';

export const MAX_PLAYERS = 4;
export const MIN_SECTION_SECONDS = 0.5;
export const COUNTDOWN_SECONDS = 3;
export const INVITATION_TTL_MS = 60 * 60 * 1000;
