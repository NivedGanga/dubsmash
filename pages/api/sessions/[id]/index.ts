import type { SessionDetails } from '@/types/api';
import { createHandler, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { getSession, loadSessionDetails } from '@/lib/server/sessions';

/** Session state, players, clip, sequences, recordings and processing status. */
export default createHandler(
  {
    GET: async (req): Promise<SessionDetails> => loadSessionDetails(await getSession(queryParam(req, 'id')), req.user),
  },
  { auth: requireAuth },
);
