import { z } from 'zod';
import type { UploadSignatureResponse } from '@/types/api';
import { ApiError, createHandler, forbidden, parseBody } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { hasAdminAccess } from '@/lib/server/users';
import { signUpload } from '@/lib/server/cloudinary';
import { getSession, isPlayer } from '@/lib/server/sessions';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('clip') }),
  z.object({ kind: z.literal('avatar') }),
  z.object({ kind: z.literal('recording'), session_id: z.string().uuid() }),
]);

/**
 * Issues a short-lived signature for a direct browser -> Cloudinary upload (Vercel's 4.5MB body limit
 * rules out proxying videos). The signature pins folder, public_id and allowed formats.
 */
export default createHandler(
  {
    POST: async (req): Promise<UploadSignatureResponse> => {
      const body = parseBody(schema, req);
      if (body.kind === 'clip') {
        if (!(await hasAdminAccess(req.user))) throw new ApiError(403, 'admin_approval_required', 'You need admin access to upload clips.');
        return signUpload('clip', req.user.id);
      }
      if (body.kind === 'recording') {
        const session = await getSession(body.session_id);
        if (!isPlayer(session, req.user.id)) throw forbidden('You are not in this game.');
        if (session.state !== 'recording') throw new ApiError(409, 'invalid_state', 'This game is not recording right now.');
        return signUpload('recording', req.user.id, session.id);
      }
      return signUpload('avatar', req.user.id);
    },
  },
  { auth: requireAuth },
);
