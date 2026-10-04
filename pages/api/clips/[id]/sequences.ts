import type { ClipSequencesResponse } from '@/types/api';
import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { adminToken, requireAdminAccount } from '@/lib/server/adminAuth';
import { canManageClip, getClip } from '@/lib/server/clips';
import { buildSequences } from '@/lib/sequences';

/** Ordered dialogue sequences of a clip (without player assignment) for the recording interface. */
export default createHandler(
  {
    GET: async (req): Promise<ClipSequencesResponse> => {
      const clip = await getClip(queryParam(req, 'id'));
      if (!clip) throw notFound('Clip');
      if (clip.status !== 'active') {
        // Non-active clips are only visible to the admin who manages them.
        const admin = adminToken(req) ? await requireAdminAccount(req) : null;
        if (!admin || !canManageClip(clip, admin)) throw notFound('Clip');
      } else if (!adminToken(req)) {
        await requireAuth(req); // players still need a game session
      }
      return { clip_id: clip.id, sequences: buildSequences(clip.timeline, clip.characters, []) };
    },
  },
);
