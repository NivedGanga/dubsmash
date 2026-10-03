import type { RecordingRow } from '@/types/database';
import { createHandler, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { getRecordingForViewer } from '@/lib/server/recordings';

export default createHandler(
  { GET: async (req): Promise<{ recording: RecordingRow }> => ({ recording: await getRecordingForViewer(queryParam(req, 'id'), req.user) }) },
  { auth: requireAuth },
);
