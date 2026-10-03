import { z } from 'zod';
import { createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { submitRecording } from '@/lib/server/gameFlow';

const schema = z.object({ sequence_id: z.string().min(1).max(32) });

/** Confirm the uploaded take. Advances to the next line, or queues rendering when all lines are done. */
export default createHandler(
  {
    POST: async (req, res) => {
      const { sequence_id } = parseBody(schema, req);
      const result = await submitRecording(queryParam(req, 'id'), req.user, sequence_id);
      if (result.done) res.status(202);
      return result;
    },
  },
  { auth: requireAuth },
);
