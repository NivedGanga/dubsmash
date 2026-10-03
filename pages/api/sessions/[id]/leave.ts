import { createHandler, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { leaveSession } from '@/lib/server/gameFlow';

/** Leave the game. If the host leaves, the game is cancelled. */
export default createHandler(
  { POST: async (req) => ({ session: await leaveSession(queryParam(req, 'id'), req.user) }) },
  { auth: requireAuth },
);
