import type { NextApiRequest } from 'next';
import { createHandler } from '@/lib/server/handler';
import { requireFirebaseToken } from '@/lib/middleware/requireAuth';
import { firebaseAuth } from '@/lib/server/firebaseAdmin';

/**
 * Revokes all Firebase refresh tokens for the user, so existing ID tokens fail verification
 * (verifyIdToken is called with checkRevoked=true). The client also signs out locally.
 */
export default createHandler<NextApiRequest>({
  POST: async (req) => {
    const decoded = await requireFirebaseToken(req);
    await firebaseAuth().revokeRefreshTokens(decoded.uid);
    return undefined;
  },
});
