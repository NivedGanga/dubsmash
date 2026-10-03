import type { NotificationRow, NotificationType, UserRow } from '@/types/database';
import { supabaseAdmin } from './supabase';
import { broadcastUser } from './realtime';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

/** Insert in-app notifications and push a real-time hint to each recipient. */
export async function notify(inputs: NotifyInput | NotifyInput[]): Promise<NotificationRow[]> {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  if (list.length === 0) return [];
  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .insert(
      list.map((n) => ({
        user_id: n.userId,
        type: n.type,
        message: n.message.slice(0, 500),
        metadata: n.metadata ?? {},
        expires_at: n.expiresAt?.toISOString() ?? null,
      })),
    )
    .select('*');
  if (error) throw error;
  const rows = (data ?? []) as NotificationRow[];
  await Promise.all(rows.map((r) => broadcastUser(r.user_id, { type: 'notification:new', notification_id: r.id })));
  return rows;
}

export async function superAdmins(): Promise<Pick<UserRow, 'id' | 'email' | 'display_name'>[]> {
  const { data, error } = await supabaseAdmin()
    .from('users')
    .select('id, email, display_name')
    .eq('role', 'super_admin')
    .eq('status', 'active');
  if (error) throw error;
  return data ?? [];
}

/** Notify every super admin in-app. */
export async function notifySuperAdmins(type: NotificationType, message: string, metadata: Record<string, unknown> = {}) {
  const admins = await superAdmins();
  return notify(admins.map((a) => ({ userId: a.id, type, message, metadata })));
}
