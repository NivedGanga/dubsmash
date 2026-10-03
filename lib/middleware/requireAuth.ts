import type { NextApiRequest } from 'next';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserRow } from '@/types/database';
import { ApiError, forbidden, unauthorized } from '@/lib/server/handler';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';
import { getUserByFirebaseUid, touchLastSeen } from '@/lib/server/users';

export function bearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Verify the Firebase ID token only (used before a DB profile exists, e.g. signup). */
export async function requireFirebaseToken(req: NextApiRequest): Promise<DecodedIdToken> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  try {
    return await verifyIdToken(token);
  } catch {
    throw unauthorized('Your session is invalid or expired. Please log in again.');
  }
}

/** Resolve the authenticated user's profile. Throws 401/403 when absent, unfinished or banned. */
export async function requireAuth(req: NextApiRequest): Promise<UserRow> {
  const decoded = await requireFirebaseToken(req);
  const user = await getUserByFirebaseUid(decoded.uid);
  if (!user) throw new ApiError(403, 'profile_required', 'Finish signing up by choosing a username.');
  if (user.status === 'banned') throw forbidden('This account has been suspended.');
  touchLastSeen(user);
  return user;
}
