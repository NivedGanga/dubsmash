import { z } from 'zod';
import type { ClipRow } from '@/types/database';
import { createHandler, notFound, parseBody, queryParam, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { getClip, normaliseClip } from '@/lib/server/clips';
import { emailAdminAccount } from '@/lib/server/adminNotify';
import { appUrl } from '@/lib/server/env';

const schema = z.object({ reason: z.string().trim().max(1000).optional() });

/** Super admin: send a clip back for revision with an optional comment. */
export default createHandler<AdminAuthedRequest>(
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
      if (clip.uploaded_by !== req.admin.id) {
        await emailAdminAccount(
          clip.uploaded_by,
          `[Dubsmash] Clip needs changes: ${clip.title}`,
          `Your clip "${clip.title}" needs changes${reason ? `: ${reason}` : '.'}\n\nEdit it: ${appUrl()}/admin/clips/${clip.id}/configure`,
        );
      }
      return { clip: normaliseClip(data as ClipRow) };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
