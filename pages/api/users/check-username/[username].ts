import type { NextApiRequest } from 'next';
import { createHandler, queryParam } from '@/lib/server/handler';
import { requireFirebaseToken } from '@/lib/middleware/requireAuth';
import { getUserByFirebaseUid, isUsernameTaken } from '@/lib/server/users';
import { isValidUsername } from '@/lib/utils';

/** Real-time username availability check. Requires a Firebase session (signup step 2 or profile edit). */
export default createHandler<NextApiRequest>({
  GET: async (req) => {
    const decoded = await requireFirebaseToken(req);
    const username = queryParam(req, 'username').trim();
    if (!isValidUsername(username)) {
      return { username, valid: false, available: false, message: '3-20 characters: letters, numbers and underscores.' };
    }
    const self = await getUserByFirebaseUid(decoded.uid);
    const taken = await isUsernameTaken(username, self?.id);
    return { username, valid: true, available: !taken, message: taken ? 'That username is taken.' : 'Available!' };
  },
});
