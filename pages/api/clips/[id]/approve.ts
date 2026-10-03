import type { ClipRow } from '@/types/database';
import { badRequest, createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { supabaseAdmin } from '@/lib/server/supabase';
import { getClip, normaliseClip } from '@/lib/server/clips';
import { notify } from '@/lib/server/notify';

/** Super admin: approve a configured clip so it becomes playable. */
export default createHandler(
  {
    PATCH: async (req): Promise<{ clip: ClipRow }> => {
      const clip = await getClip(queryParam(req, 'id'));
      if (!clip) throw notFound('Clip');
      if (!clip.is_configured) throw badRequest('Configure the timeline before approving.');
      if (clip.status === 'active') return { clip: normaliseClip(clip) };
      const { data, error } = await supabaseAdmin()
        .from('clips')
        .update({ status: 'active', approved_by: req.user.id, approved_at: new Date().toISOString(), rejection_reason: null })
        .eq('id', clip.id)
        .select('*')
        .single();
      if (error) throw error;
      if (clip.uploaded_by !== req.user.id) {
        await notify({
          userId: clip.uploaded_by,
          type: 'clip_approved',
          message: `Your clip "${clip.title}" was approved and is now live!`,
          metadata: { clip_id: clip.id, sender_id: req.user.id },
        });
      }
      return { clip: normaliseClip(data as ClipRow) };
    },
  },
  { auth: requireSuperAdmin },
);
