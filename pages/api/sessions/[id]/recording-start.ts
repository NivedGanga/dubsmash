import { ApiError, createHandler, forbidden, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { broadcastSession } from '@/lib/server/realtime';
import { getSession, getSessionClip, isPlayer } from '@/lib/server/sessions';
import { buildSequences } from '@/lib/sequences';
import { COUNTDOWN_SECONDS } from '@/types/game';

/**
 * The current player is about to record: returns the sequence parameters (timing, dialogue, clip
 * offsets) and tells the other players who is recording.
 */
export default createHandler(
  {
    POST: async (req) => {
      const session = await getSession(queryParam(req, 'id'));
      if (!isPlayer(session, req.user.id)) throw forbidden('You are not in this game.');
      if (session.state !== 'recording') throw new ApiError(409, 'invalid_state', 'This game is not recording.');
      const clip = await getSessionClip(session);
      const seq = buildSequences(clip.timeline, clip.characters, session.players)[session.current_sequence_index];
      if (!seq || seq.user_id !== req.user.id) throw forbidden("It's not your turn yet.");
      await broadcastSession(session.id, { type: 'recording:start', user_id: req.user.id, sequence_id: seq.id, sequence_index: seq.index });
      return {
        sequence: seq,
        countdown_seconds: COUNTDOWN_SECONDS,
        /** Absolute offsets into the original video for previewing this line. */
        video_offset_start: clip.trim_start + seq.start,
        video_offset_end: clip.trim_start + seq.end,
        max_duration_seconds: Math.ceil(seq.end - seq.start + 2),
      };
    },
  },
  { auth: requireAuth },
);
