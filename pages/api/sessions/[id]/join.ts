import { createHandler, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { joinSession } from '@/lib/server/gameFlow';

/** Accept an invitation and enter the lobby (idempotent). */
export default createHandler(
  { POST: async (req) => ({ session: await joinSession(queryParam(req, 'id'), req.user) }) },
  { auth: requireAuth },
);
