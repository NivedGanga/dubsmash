import { z } from 'zod';
import type { ClipRow } from '@/types/database';
import { badRequest, createHandler, forbidden, parseBody, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { thumbnailUrl, verifyAsset } from '@/lib/server/cloudinary';
import { emailSuperAdmins } from '@/lib/server/adminNotify';
import { appUrl } from '@/lib/server/env';

const schema = z.object({
  public_id: z.string().min(1).max(255),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  folder_id: z.string().uuid().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

const MAX_CLIP_SECONDS = 15 * 60;

/**
 * Registers a clip after the browser uploaded it directly to Cloudinary (signature from /api/uploads/sign).
 * Verifies the asset (folder ownership, format, size, duration) before creating a pending clip.
 */
export default createHandler<AdminAuthedRequest>(
  {
    POST: async (req, res): Promise<{ clip: ClipRow }> => {
      const body = parseBody(schema, req);
      const sb = supabaseAdmin();
      if (body.folder_id) {
        const { data: folder } = await sb.from('folders').select('owner_id').eq('id', body.folder_id).maybeSingle();
        if (!folder) throw badRequest('Folder not found.');
        if (folder.owner_id !== req.admin.id) throw forbidden('That folder belongs to someone else.');
      }

      let asset;
      try {
        asset = await verifyAsset('clip', body.public_id, req.admin.id);
      } catch (err) {
        throw badRequest(err instanceof Error ? err.message : 'Invalid upload.');
      }
      if (!asset.duration || asset.duration <= 0) throw badRequest('Could not read the video duration. Is this a valid video?');
      if (asset.duration > MAX_CLIP_SECONDS) throw badRequest('Clips can be at most 15 minutes long.');

      const { data, error } = await sb
        .from('clips')
        .insert({
          uploaded_by: req.admin.id,
          folder_id: body.folder_id ?? null,
          title: body.title,
          description: body.description || null,
          difficulty: body.difficulty,
          status: 'pending',
          cloudinary_public_id: asset.public_id,
          original_video_url: asset.secure_url,
          thumbnail_url: thumbnailUrl(asset.public_id, Math.min(1, asset.duration / 2)),
          duration_seconds: Math.round(asset.duration * 1000) / 1000,
        })
        .select('*')
        .single();
      if (error) throw error;
      const clip = data as ClipRow;

      if (req.admin.role !== 'super_admin') {
        await emailSuperAdmins(
          `[Dubsmash] New clip: ${clip.title}`,
          `New clip "${clip.title}" uploaded by ${req.admin.display_name} awaits configuration and approval.\n\nReview it: ${appUrl()}/admin/clips/${clip.id}/configure`,
        );
      }
      res.status(201);
      return { clip };
    },
  },
  { adminAuth: requireAdminAccount },
);
