import type { ClipSequencesResponse } from '@/types/api';
import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { canManageClip, getClip } from '@/lib/server/clips';
import { buildSequences } from '@/lib/sequences';

/** Ordered dialogue sequences of a clip (without player assignment) for the recording interface. */
export default createHandler(
  {
    GET: async (req): Promise<ClipSequencesResponse> => {
      const clip = await getClip(queryParam(req, 'id'));
      if (!clip || (clip.status !== 'active' && !canManageClip(clip, req.user))) throw notFound('Clip');
      return { clip_id: clip.id, sequences: buildSequences(clip.timeline, clip.characters, []) };
    },
  },
  { auth: requireAuth },
);
