import { z } from 'zod';
import type { UploadSignatureResponse } from '@/types/api';
import { ApiError, createHandler, forbidden, parseBody } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { requireAdminAccount, adminToken } from '@/lib/server/adminAuth';
import { signUpload } from '@/lib/server/cloudinary';
import { getSession, isPlayer } from '@/lib/server/sessions';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('clip') }),
  z.object({ kind: z.literal('recording'), session_id: z.string().uuid() }),
]);

/**
 * Issues a short-lived signature for a direct browser -> Cloudinary upload (Vercel's 4.5MB body limit
 * rules out proxying videos). The signature pins folder, public_id and allowed formats.
 *
 * Two callers, two credentials: clip uploads use an admin-portal token (`Authorization: Admin …`),
 * player recordings use a game Firebase token (`Authorization: Bearer …`).
 */
export default createHandler({
  POST: async (req): Promise<UploadSignatureResponse> => {
    const body = parseBody(schema, req);
    if (body.kind === 'clip') {
      const admin = await requireAdminAccount(req);
      if (!admin) throw new ApiError(401, 'unauthorized', 'Admin sign-in required to upload clips.');
      return signUpload('clip', admin.id);
    }
    if (adminToken(req)) throw forbidden('Admin accounts cannot upload game recordings.');
    const user = await requireAuth(req);
    const session = await getSession(body.session_id);
    if (!isPlayer(session, user.id)) throw forbidden('You are not in this game.');
    if (session.state !== 'recording') throw new ApiError(409, 'invalid_state', 'This game is not recording right now.');
    return signUpload('recording', user.id, session.id);
  },
});
