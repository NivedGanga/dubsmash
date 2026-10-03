import { ApiError, createHandler, forbidden, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { broadcastSession } from '@/lib/server/realtime';
import { getSession, isHost } from '@/lib/server/sessions';

/** Lead time so every client has the event before the shared start moment. */
const LEAD_MS = 2000;

/** Host starts synchronised playback for everyone in the room (`playback:start`). */
export default createHandler(
  {
    POST: async (req) => {
      const session = await getSession(queryParam(req, 'id'));
      if (!isHost(session, req.user.id)) throw forbidden('Only the host can start playback for everyone.');
      if (session.state !== 'playback' && session.state !== 'completed') throw new ApiError(409, 'invalid_state', 'Recording is not finished yet.');
      const at = Date.now() + LEAD_MS;
      await broadcastSession(session.id, { type: 'playback:start', at });
      return { at };
    },
  },
  { auth: requireAuth },
);
