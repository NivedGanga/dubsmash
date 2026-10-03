import { z } from 'zod';
import type { ClipRow } from '@/types/database';
import { createHandler, notFound, parseBody, queryParam } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { supabaseAdmin } from '@/lib/server/supabase';
import { getClip, normaliseClip } from '@/lib/server/clips';
import { notify } from '@/lib/server/notify';

const schema = z.object({ reason: z.string().trim().max(1000).optional() });

/** Super admin: send a clip back for revision with an optional comment. */
export default createHandler(
  {
    PATCH: async (req): Promise<{ clip: ClipRow }> => {
      const { reason } = parseBody(schema, req);
      const clip = await getClip(queryParam(req, 'id'));
      if (!clip) throw notFound('Clip');
      const { data, error } = await supabaseAdmin()
        .from('clips')
        .update({ status: 'rejected', rejection_reason: reason || null, approved_by: null, approved_at: null })
        .eq('id', clip.id)
        .select('*')
        .single();
      if (error) throw error;
      if (clip.uploaded_by !== req.user.id) {
        await notify({
          userId: clip.uploaded_by,
          type: 'clip_rejected',
          message: `Your clip "${clip.title}" needs changes${reason ? `: ${reason}` : '.'}`,
          metadata: { clip_id: clip.id, sender_id: req.user.id },
        });
      }
      return { clip: normaliseClip(data as ClipRow) };
    },
  },
  { auth: requireSuperAdmin },
);
