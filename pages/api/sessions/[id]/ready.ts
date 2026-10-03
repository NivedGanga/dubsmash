import { z } from 'zod';
import { createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { setReady } from '@/lib/server/gameFlow';

const schema = z.object({ ready: z.boolean() });

export default createHandler(
  {
    POST: async (req) => {
      const { ready } = parseBody(schema, req);
      return { session: await setReady(queryParam(req, 'id'), req.user, ready) };
    },
  },
  { auth: requireAuth },
);
