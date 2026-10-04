import type { ClipRow } from '@/types/database';
import { badRequest, createHandler, notFound, queryParam, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { getClip, normaliseClip } from '@/lib/server/clips';
import { emailAdminAccount } from '@/lib/server/adminNotify';
import { appUrl } from '@/lib/server/env';

/** Super admin: approve a configured clip so it becomes playable. */
export default createHandler<AdminAuthedRequest>(
  {
    PATCH: async (req): Promise<{ clip: ClipRow }> => {
      const clip = await getClip(queryParam(req, 'id'));
      if (!clip) throw notFound('Clip');
      if (!clip.is_configured) throw badRequest('Configure the timeline before approving.');
      if (clip.status === 'active') return { clip: normaliseClip(clip) };
      const { data, error } = await supabaseAdmin()
        .from('clips')
        .update({ status: 'active', approved_by: req.admin.id, approved_at: new Date().toISOString(), rejection_reason: null })
        .eq('id', clip.id)
        .select('*')
        .single();
      if (error) throw error;
      if (clip.uploaded_by !== req.admin.id) {
        await emailAdminAccount(
          clip.uploaded_by,
          `[Dubsmash] Clip approved: ${clip.title}`,
          `Your clip "${clip.title}" was approved and is now live!\n\nSee it: ${appUrl()}/admin/clips`,
        );
      }
      return { clip: normaliseClip(data as ClipRow) };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
