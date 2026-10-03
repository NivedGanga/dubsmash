import { createHandler, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { startSession } from '@/lib/server/gameFlow';
import { loadSessionDetails } from '@/lib/server/sessions';

/** Host starts the game once all other players are ready: lobby -> recording. */
export default createHandler(
  {
    POST: async (req) => loadSessionDetails(await startSession(queryParam(req, 'id'), req.user), req.user),
  },
  { auth: requireAuth },
);
