import { z } from 'zod';
import type { ClipRow } from '@/types/database';
import { badRequest, conflict, createHandler, forbidden, notFound, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { canManageClip, clipVideoUrl, getClip, getManagedClip, hasLiveSessions, normaliseClip } from '@/lib/server/clips';
import { deleteAsset } from '@/lib/server/cloudinary';
import { hasAdminAccess } from '@/lib/server/users';

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).nullable(),
    folder_id: z.string().uuid().nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    archived: z.boolean(),
  })
  .partial()
  .strict();

export default createHandler(
  {
    /** Managers (owner/super admin) get everything; players only see active clips without the timeline. */
    GET: async (req): Promise<{ clip: ClipRow & { video_url: string }; can_manage: boolean }> => {
      const clip = await getClip(queryParam(req, 'id'));
      if (!clip) throw notFound('Clip');
      const manage = canManageClip(clip, req.user) && (await hasAdminAccess(req.user));
      if (!manage && clip.status !== 'active') throw notFound('Clip');
      const normalised = normaliseClip(clip);
      return {
        clip: { ...normalised, timeline: manage ? normalised.timeline : [], video_url: clipVideoUrl(normalised) },
        can_manage: manage,
      };
    },

    /** Rename, describe, move between folders, set difficulty, archive/unarchive. */
    PATCH: async (req): Promise<{ clip: ClipRow }> => {
      if (!(await hasAdminAccess(req.user))) throw forbidden();
      const clip = await getManagedClip(queryParam(req, 'id'), req.user);
      const { archived, ...rest } = parseBody(patchSchema, req);
      const patch: Record<string, unknown> = { ...rest };
      if (rest.folder_id) {
        const { data: folder } = await supabaseAdmin().from('folders').select('owner_id').eq('id', rest.folder_id).maybeSingle();
        if (!folder) throw badRequest('Folder not found.');
        if (folder.owner_id !== clip.uploaded_by) throw badRequest("Clips can only be moved within their owner's folders.");
      }
      if (archived === true) patch.status = 'archived';
      // Unarchived clips go back through approval (or are re-activated by re-saving the configuration).
      if (archived === false && clip.status === 'archived') patch.status = 'pending';
      if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.');
      const { data, error } = await supabaseAdmin().from('clips').update(patch).eq('id', clip.id).select('*').single();
      if (error) throw error;
      return { clip: normaliseClip(data as ClipRow) };
    },

    DELETE: async (req) => {
      if (!(await hasAdminAccess(req.user))) throw forbidden();
      const clip = await getManagedClip(queryParam(req, 'id'), req.user);
      if (await hasLiveSessions(clip.id)) throw conflict('This clip is being played right now. Try again later.');
      const { error } = await supabaseAdmin().from('clips').delete().eq('id', clip.id);
      if (error) throw error;
      await deleteAsset(clip.cloudinary_public_id).catch((err) => console.warn('[clips] cloudinary delete failed', err));
      return undefined;
    },
  },
  { auth: requireAuth },
);
