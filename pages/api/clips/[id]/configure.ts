import { z } from 'zod';
import type { ClipRow } from '@/types/database';
import { badRequest, conflict, createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireAdmin } from '@/lib/middleware/requireAdmin';
import { supabaseAdmin } from '@/lib/server/supabase';
import { getManagedClip, hasLiveSessions, normaliseClip } from '@/lib/server/clips';
import { thumbnailUrl, trimmedVideoUrl } from '@/lib/server/cloudinary';
import { isFeatureEnabled } from '@/lib/server/featureFlags';
import { notifySuperAdmins } from '@/lib/server/notify';
import { hexColorSchema } from '@/lib/server/validation';
import { validateTimeline } from '@/lib/timeline';
import { round2 } from '@/lib/utils';

const schema = z.object({
  trim_start: z.number().min(0),
  trim_end: z.number().positive().nullable(),
  characters: z
    .array(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/), name: z.string().trim().min(1).max(40), color: hexColorSchema }))
    .min(1)
    .max(4),
  timeline: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
        start: z.number().min(0),
        end: z.number().positive(),
        character_id: z.string().nullable(),
        dialogue: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Save trim + characters + timeline mapping. Every section must be mapped (no grey sections).
 * With clip_approval_workflow ON the clip waits for super admin approval; OFF it goes live immediately.
 */
export default createHandler(
  {
    PUT: async (req): Promise<{ clip: ClipRow; requires_approval: boolean }> => {
      const clip = normaliseClip(await getManagedClip(queryParam(req, 'id'), req.user));
      const body = parseBody(schema, req);
      if (await hasLiveSessions(clip.id)) throw conflict('This clip is being played right now. Try again when the game ends.');

      const trimEnd = body.trim_end === null || body.trim_end >= clip.duration_seconds - 0.01 ? null : round2(body.trim_end);
      const trimStart = round2(body.trim_start);
      const duration = round2((trimEnd ?? clip.duration_seconds) - trimStart);
      if (trimStart >= clip.duration_seconds || duration < 1) throw badRequest('Trimmed clip must be at least 1 second long.');

      const timeline = body.timeline.map((s) => ({ ...s, start: round2(s.start), end: round2(s.end), dialogue: s.dialogue || undefined }));
      const check = validateTimeline(timeline, duration, body.characters);
      if (!check.valid) throw badRequest(check.errors[0] ?? 'Invalid timeline.', check.errors);

      const approvalOn = await isFeatureEnabled('clip_approval_workflow');
      // Super admins don't need to approve their own clips.
      const requiresApproval = approvalOn && req.user.role !== 'super_admin';
      const trimmed = trimStart > 0 || trimEnd !== null;

      const { data, error } = await supabaseAdmin()
        .from('clips')
        .update({
          trim_start: trimStart,
          trim_end: trimEnd,
          trimmed_video_url: trimmed ? trimmedVideoUrl(clip.cloudinary_public_id, trimStart, trimEnd) : null,
          thumbnail_url: thumbnailUrl(clip.cloudinary_public_id, trimStart + Math.min(1, duration / 2)),
          characters: body.characters,
          timeline,
          character_count: body.characters.length,
          is_configured: true,
          status: requiresApproval ? 'pending' : 'active',
          rejection_reason: null,
          ...(requiresApproval ? { approved_by: null, approved_at: null } : { approved_by: req.user.id, approved_at: new Date().toISOString() }),
        })
        .eq('id', clip.id)
        .select('*')
        .single();
      if (error) throw error;

      if (requiresApproval) {
        await notifySuperAdmins('clip_uploaded', `"${clip.title}" by @${req.user.username} is configured and awaiting approval.`, {
          clip_id: clip.id,
          sender_id: req.user.id,
        });
      }
      return { clip: normaliseClip(data as ClipRow), requires_approval: requiresApproval };
    },
  },
  { auth: requireAdmin },
);
