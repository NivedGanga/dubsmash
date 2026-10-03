import { z } from 'zod';
import { MAX_PLAYERS } from '@/types/game';
import { createHandler, parseBody } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { createSession } from '@/lib/server/gameFlow';
import { appUrl } from '@/lib/server/env';

const schema = z.object({
  clip_id: z.string().uuid(),
  invited_player_ids: z.array(z.string().uuid()).max(MAX_PLAYERS - 1).default([]),
});

/** Create a lobby for a clip. Invited friends get a time-limited (1h) in-app invitation. */
export default createHandler(
  {
    POST: async (req, res) => {
      const { clip_id, invited_player_ids } = parseBody(schema, req);
      const session = await createSession(req.user, clip_id, invited_player_ids);
      res.status(201);
      return { session_id: session.id, join_url: `${appUrl()}/play/${session.id}`, session };
    },
  },
  { auth: requireAuth },
);
