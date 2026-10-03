import { z } from 'zod';
import type { RecordingRow } from '@/types/database';
import { createHandler, parseBody } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { saveRecording } from '@/lib/server/recordings';

const schema = z.object({
  session_id: z.string().uuid(),
  sequence_id: z.string().min(1).max(32),
  public_id: z.string().min(1).max(255),
});

/**
 * Register a take uploaded directly to Cloudinary (signature: /api/uploads/sign kind=recording).
 * Large files are uploaded in chunks by the client (lib/upload.ts). Re-uploading replaces the take.
 */
export default createHandler(
  {
    POST: async (req, res): Promise<{ recording: RecordingRow }> => {
      const { session_id, sequence_id, public_id } = parseBody(schema, req);
      const recording = await saveRecording(req.user, session_id, sequence_id, public_id);
      res.status(201);
      return { recording };
    },
  },
  { auth: requireAuth },
);
