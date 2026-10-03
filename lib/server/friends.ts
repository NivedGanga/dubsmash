import type { UserFriendRow, UserRow } from '@/types/database';
import { forbidden } from './handler';
import { isFeatureEnabled } from './featureFlags';
import { supabaseAdmin } from './supabase';

export async function requireFriendSystem(user: UserRow): Promise<void> {
  if (!(await isFeatureEnabled('friend_system_enabled', user.id))) throw forbidden('The friend system is currently disabled.');
}

/** All friendship rows touching the user, optionally filtered by status. */
export async function friendshipsOf(userId: string, status?: UserFriendRow['status']): Promise<UserFriendRow[]> {
  let q = supabaseAdmin().from('user_friends').select('*').or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as UserFriendRow[];
}

export const otherSide = (row: Pick<UserFriendRow, 'user_id' | 'friend_id'>, me: string) => (row.user_id === me ? row.friend_id : row.user_id);
