import { z } from 'zod';
import { MAX_PLAYERS } from '@/types/game';
import { createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { inviteToSession } from '@/lib/server/gameFlow';

const schema = z.object({ user_ids: z.array(z.string().uuid()).min(1).max(MAX_PLAYERS - 1) });

/** Host invites more friends to the lobby. */
export default createHandler(
  {
    POST: async (req) => {
      const { user_ids } = parseBody(schema, req);
      return { session: await inviteToSession(queryParam(req, 'id'), req.user, user_ids) };
    },
  },
  { auth: requireAuth },
);
