import { createHandler, forbidden, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { completeSession } from '@/lib/server/gameFlow';
import { getSession, isPlayer } from '@/lib/server/sessions';

/**
 * Queue the final video render and return 202 immediately (non-blocking). Idempotent.
 * Normally triggered automatically by the last recording-submit.
 */
export default createHandler(
  {
    POST: async (req, res) => {
      const id = queryParam(req, 'id');
      if (!isPlayer(await getSession(id), req.user.id)) throw forbidden('You are not in this game.');
      const { session } = await completeSession(id);
      res.status(202);
      return { session, status: 'queued', message: 'Your video is being processed — estimated 5-10 minutes.' };
    },
  },
  { auth: requireAuth },
);
