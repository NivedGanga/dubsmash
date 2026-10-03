import type {
  AccessRequestRow,
  ClipRow,
  FeatureFlagRow,
  FlagChangeLogRow,
  FolderRow,
  GameSessionRow,
  JobStatus,
  NotificationRow,
  RecordingRow,
  UserRow,
} from './database';
import type { EvaluatedFlags } from './flags';
import type { Sequence } from './game';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

/** Public-facing user (never includes firebase_uid / email of other users). */
export type PublicUser = Pick<
  UserRow,
  'id' | 'username' | 'display_name' | 'avatar_model' | 'avatar_color' | 'avatar_outfit' | 'avatar_url' | 'role'
>;

export interface MeResponse {
  user: UserRow;
  flags: EvaluatedFlags;
  admin_access: AdminAccessState;
}

export type AdminAccessState =
  | { status: 'granted' }
  | { status: 'none' }
  | { status: 'pending'; request_id: string }
  | { status: 'rejected'; request_id: string; message: string | null };

export interface SignupRequest {
  username: string;
  display_name?: string;
}

export interface SignupResponse extends MeResponse {
  is_first_user: boolean;
}

export interface UploadSignatureResponse {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  resource_type: 'video' | 'image';
  upload_url: string;
  params: Record<string, string | number>;
}

export interface ClipWithOwner extends ClipRow {
  owner?: Pick<UserRow, 'id' | 'username' | 'display_name'>;
}

export interface ClipListResponse extends Paginated<ClipWithOwner> {}

export interface ClipSequencesResponse {
  clip_id: string;
  sequences: Sequence[];
}

export interface FolderTreeResponse {
  folders: FolderRow[];
  owners?: Array<Pick<UserRow, 'id' | 'username' | 'display_name'>>;
}

export interface SessionDetails {
  session: GameSessionRow;
  clip: Pick<
    ClipRow,
    'id' | 'title' | 'description' | 'characters' | 'timeline' | 'duration_seconds' | 'thumbnail_url' | 'trim_start' | 'trim_end' | 'difficulty'
  > & { video_url: string };
  sequences: Sequence[];
  recordings: RecordingRow[];
  processing: { status: JobStatus | null; final_video_url: string | null };
}

export interface ProcessingStatusResponse {
  status: JobStatus | 'not_queued';
  final_video_url: string | null;
  error_message: string | null;
  retry_count: number;
  queued_at: string | null;
  estimated_seconds_remaining: number | null;
}

export interface NotificationListResponse extends Paginated<NotificationRow> {
  unread_count: number;
}

export interface FriendEntry {
  friendship_id: string;
  user: PublicUser;
  since: string;
}

export interface FriendRequestEntry {
  id: string;
  from: PublicUser;
  to: PublicUser;
  created_at: string;
  direction: 'incoming' | 'outgoing';
}

export interface FeatureFlagWithHistory extends FeatureFlagRow {
  history: FlagChangeLogRow[];
}

export interface AccessRequestWithUser extends AccessRequestRow {
  user: Pick<UserRow, 'id' | 'username' | 'display_name' | 'email'>;
}

export interface AdminStats {
  total_clips: number;
  pending_clips: number;
  active_clips: number;
  total_users: number;
  pending_access_requests: number;
  sessions_last_7_days: number;
  processing_queue: Record<JobStatus, number>;
}

export interface UserStats {
  games_played: number;
  total_recordings: number;
  clips_created: number;
  friends_count: number;
}
