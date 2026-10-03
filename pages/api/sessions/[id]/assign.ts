import { z } from 'zod';
import { createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { assignCharacters } from '@/lib/server/gameFlow';

const schema = z.object({
  /** user_id -> character ids */
  assignments: z.record(z.string().uuid(), z.array(z.string().max(24)).max(4)),
});

/** Host re-assigns characters in the lobby; everyone must re-confirm ready. */
export default createHandler(
  {
    PATCH: async (req) => {
      const { assignments } = parseBody(schema, req);
      return { session: await assignCharacters(queryParam(req, 'id'), req.user, assignments) };
    },
  },
  { auth: requireAuth },
);
