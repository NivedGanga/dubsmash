import { z } from 'zod';
import type { RecordingRow } from '@/types/database';
import { createHandler, forbidden, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { getRecordingForViewer, saveRecording } from '@/lib/server/recordings';

const schema = z.object({ public_id: z.string().min(1).max(255) });

/** Re-record: replace your take for a line while the game is still recording. */
export default createHandler(
  {
    POST: async (req): Promise<{ recording: RecordingRow }> => {
      const { public_id } = parseBody(schema, req);
      const existing = await getRecordingForViewer(queryParam(req, 'id'), req.user);
      if (existing.user_id !== req.user.id) throw forbidden('You can only replace your own recordings.');
      return { recording: await saveRecording(req.user, existing.session_id, existing.sequence_id, public_id) };
    },
  },
  { auth: requireAuth },
);
