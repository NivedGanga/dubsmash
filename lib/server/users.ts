import type { AccessRequestRow, UserRow } from '@/types/database';
import type { AdminAccessState, MeResponse, PublicUser } from '@/types/api';
import { supabaseAdmin } from './supabase';
import { evaluateAllFlags, isFeatureEnabled } from './featureFlags';
import { escapeLike } from './validation';

export const PUBLIC_USER_COLUMNS = 'id, username, display_name, avatar_model, avatar_color, avatar_outfit, avatar_url, role';

export function toPublicUser(u: UserRow | PublicUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_model: u.avatar_model,
    avatar_color: u.avatar_color,
    avatar_outfit: u.avatar_outfit,
    avatar_url: u.avatar_url,
    role: u.role,
  };
}

export async function getUserByFirebaseUid(uid: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin().from('users').select('*').eq('firebase_uid', uid).maybeSingle();
  if (error) throw error;
  return data as UserRow | null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin().from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as UserRow | null;
}

export async function getPublicUsers(ids: string[]): Promise<PublicUser[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin().from('users').select(PUBLIC_USER_COLUMNS).in('id', [...new Set(ids)]);
  if (error) throw error;
  return (data ?? []) as PublicUser[];
}

export async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  // ilike without wildcards = case-insensitive equality; escape LIKE metacharacters (_ is valid in usernames).
  let q = supabaseAdmin().from('users').select('id', { count: 'exact', head: true }).ilike('username', escapeLike(username));
  if (exceptUserId) q = q.neq('id', exceptUserId);
  const { count, error } = await q;
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Admin-portal access. Super admins and approved admins always have access. When the
 * super_admin_approval_required flag is OFF, every active user has access.
 */
export async function hasAdminAccess(user: UserRow): Promise<boolean> {
  if (user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  return !(await isFeatureEnabled('super_admin_approval_required', user.id));
}

export async function adminAccessState(user: UserRow): Promise<AdminAccessState> {
  if (await hasAdminAccess(user)) return { status: 'granted' };
  const { data, error } = await supabaseAdmin()
    .from('access_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const req = data as AccessRequestRow | null;
  if (!req) return { status: 'none' };
  if (req.status === 'pending') return { status: 'pending', request_id: req.id };
  if (req.status === 'rejected') return { status: 'rejected', request_id: req.id, message: req.response_message };
  // Approved but role was later changed back to user: treat as no access.
  return { status: 'none' };
}

export async function buildMe(user: UserRow): Promise<MeResponse> {
  const [flags, admin_access] = await Promise.all([evaluateAllFlags(user.id), adminAccessState(user)]);
  return { user, flags, admin_access };
}

/** Throttled last-seen update (at most every 2 minutes), fire-and-forget. */
export function touchLastSeen(user: UserRow): void {
  const last = user.last_seen_at ? Date.parse(user.last_seen_at) : 0;
  if (Date.now() - last < 2 * 60 * 1000) return;
  void supabaseAdmin()
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(({ error }) => error && console.warn('[users] last_seen update failed', error.message));
}

export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
export const isRecentlySeen = (u: Pick<UserRow, 'last_seen_at'>) =>
  !!u.last_seen_at && Date.now() - Date.parse(u.last_seen_at) < ONLINE_WINDOW_MS;
