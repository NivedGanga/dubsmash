import type { NextApiRequest } from 'next';
import type { UserRow } from '@/types/database';
import { ApiError, forbidden } from '@/lib/server/handler';
import { hasAdminAccess } from '@/lib/server/users';
import { requireAuth } from './requireAuth';

/**
 * Admin-portal access: admin/super_admin role, or any active user while the
 * super_admin_approval_required flag is disabled.
 */
export async function requireAdmin(req: NextApiRequest): Promise<UserRow> {
  const user = await requireAuth(req);
  if (!(await hasAdminAccess(user))) {
    throw new ApiError(403, 'admin_approval_required', 'You need approval to access the admin portal. Request access first.');
  }
  return user;
}

export async function requireSuperAdmin(req: NextApiRequest): Promise<UserRow> {
  const user = await requireAuth(req);
  if (user.role !== 'super_admin') throw forbidden('Only the super admin can do that.');
  return user;
}

export const isSuperAdmin = (user: Pick<UserRow, 'role'>) => user.role === 'super_admin';
