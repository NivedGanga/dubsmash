/**
 * Row types mirroring the Supabase/Postgres schema in /migrations.
 * Keep in sync with the SQL when changing columns.
 */

export type UUID = string;
export type ISODate = string;

export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'inactive' | 'banned';
export type AvatarModel = 'casual_m' | 'formal_m' | 'casual_f' | 'formal_f' | 'robot' | 'blob';
export type AvatarOutfit = 'tee' | 'hoodie' | 'suit' | 'dress' | 'jersey';

export interface UserRow {
  id: UUID;
  firebase_uid: string;
  email: string;
  username: string;
  display_name: string;
  role: UserRole;
  avatar_model: AvatarModel;
  avatar_color: string;
  avatar_outfit: AvatarOutfit;
  avatar_url: string | null;
  status: UserStatus;
  games_played: number;
  total_recordings: number;
  clips_created: number;
  last_seen_at: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequestRow {
  id: UUID;
  user_id: UUID;
  status: AccessRequestStatus;
  message: string | null;
  response_message: string | null;
  requested_at: ISODate;
  responded_at: ISODate | null;
  responded_by: UUID | null;
}

export interface FolderRow {
  id: UUID;
  owner_id: UUID;
  name: string;
  parent_folder_id: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
}

/** pending = uploaded and/or awaiting approval, active = playable, rejected = sent back, archived = hidden */
export type ClipStatus = 'pending' | 'active' | 'rejected' | 'archived';
export type ClipDifficulty = 'easy' | 'medium' | 'hard';

export interface ClipCharacter {
  id: string;
  name: string;
  color: string;
}

/** A contiguous slice of the (trimmed) clip timeline, in seconds relative to trim_start. */
export interface TimelineSection {
  id: string;
  start: number;
  end: number;
  character_id: string | null;
  /** Optional dialogue text shown to the player while recording. */
  dialogue?: string;
}

export interface ClipRow {
  id: UUID;
  uploaded_by: UUID;
  folder_id: UUID | null;
  title: string;
  description: string | null;
  status: ClipStatus;
  difficulty: ClipDifficulty;
  cloudinary_public_id: string;
  original_video_url: string;
  trimmed_video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  trim_start: number;
  trim_end: number | null;
  characters: ClipCharacter[];
  timeline: TimelineSection[];
  character_count: number;
  is_configured: boolean;
  times_played: number;
  rejection_reason: string | null;
  approved_by: UUID | null;
  approved_at: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export type SessionState = 'lobby' | 'recording' | 'playback' | 'completed' | 'cancelled';

export interface SessionPlayer {
  user_id: UUID;
  username: string;
  display_name: string;
  avatar_model: AvatarModel;
  avatar_color: string;
  avatar_outfit: AvatarOutfit;
  character_ids: string[];
  ready: boolean;
  joined_at: ISODate;
}

export interface GameSessionRow {
  id: UUID;
  clip_id: UUID;
  created_by: UUID;
  players: SessionPlayer[];
  invited_user_ids: UUID[];
  state: SessionState;
  current_sequence_index: number;
  /** Optimistic-concurrency counter (see lib/server/sessions.ts updateSession). */
  version: number;
  final_video_url: string | null;
  started_at: ISODate | null;
  completed_at: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface RecordingRow {
  id: UUID;
  session_id: UUID;
  user_id: UUID;
  sequence_id: string;
  audio_url: string;
  cloudinary_public_id: string;
  duration_seconds: number;
  attempt: number;
  created_at: ISODate;
  updated_at: ISODate;
}

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'game_invitation'
  | 'video_ready'
  | 'clip_uploaded'
  | 'clip_approved'
  | 'clip_rejected'
  | 'access_request'
  | 'access_approved'
  | 'access_rejected'
  | 'lobby_update';

export interface NotificationRow {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  expires_at: ISODate | null;
  created_at: ISODate;
  read_at: ISODate | null;
}

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface UserFriendRow {
  id: UUID;
  user_id: UUID;
  friend_id: UUID;
  status: FriendStatus;
  created_at: ISODate;
  responded_at: ISODate | null;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingJobPayload {
  clip_id: UUID;
  video_url: string;
  trim_start: number;
  trim_end: number | null;
  duration_seconds: number;
  tracks: Array<{ sequence_id: string; user_id: UUID; audio_url: string; start: number; end: number }>;
}

export interface VideoProcessingJobRow {
  id: UUID;
  session_id: UUID;
  recordings: ProcessingJobPayload;
  status: JobStatus;
  retry_count: number;
  error_message: string | null;
  result: { final_video_url?: string; public_id?: string } | null;
  created_at: ISODate;
  started_at: ISODate | null;
  completed_at: ISODate | null;
  updated_at: ISODate;
}

export type FlagType = 'boolean' | 'percentage' | 'user_list';

export interface FlagValue {
  rollout_percentage?: number;
  user_ids?: string[];
}

export interface FeatureFlagRow {
  id: UUID;
  flag_name: string;
  description: string;
  is_enabled: boolean;
  is_critical: boolean;
  flag_type: FlagType;
  flag_value: FlagValue;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface FlagChangeLogRow {
  id: UUID;
  flag_name: string;
  old_value: { is_enabled: boolean; flag_value: FlagValue } | null;
  new_value: { is_enabled: boolean; flag_value: FlagValue };
  changed_by: UUID | null;
  changed_at: ISODate;
}
