import { z } from 'zod';
import type { FolderRow } from '@/types/database';
import type { FolderTreeResponse } from '@/types/api';
import { badRequest, createHandler, forbidden, parseBody, parseQuery } from '@/lib/server/handler';
import { requireAdmin } from '@/lib/middleware/requireAdmin';
import { supabaseAdmin } from '@/lib/server/supabase';

const listSchema = z.object({ owner: z.string().uuid().optional() });
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parent_folder_id: z.string().uuid().nullable().optional(),
  /** Super admin may create folders inside another user's space. */
  owner_id: z.string().uuid().optional(),
});

export default createHandler(
  {
    /**
     * Folders of one owner (default: me). Super admins without `owner` additionally get the list of
     * users who own content, rendered as top-level "username folders".
     */
    GET: async (req): Promise<FolderTreeResponse> => {
      const { owner } = parseQuery(listSchema, req);
      const isSuper = req.user.role === 'super_admin';
      if (owner && owner !== req.user.id && !isSuper) throw forbidden();
      const sb = supabaseAdmin();
      const { data, error } = await sb.from('folders').select('*').eq('owner_id', owner ?? req.user.id).order('name');
      if (error) throw error;
      const result: FolderTreeResponse = { folders: (data ?? []) as FolderRow[] };
      if (isSuper && !owner) {
        const { data: owners, error: ownErr } = await sb
          .from('users')
          .select('id, username, display_name')
          .or('clips_created.gt.0,role.in.(admin,super_admin)')
          .order('username')
          .limit(500);
        if (ownErr) throw ownErr;
        result.owners = owners ?? [];
      }
      return result;
    },

    POST: async (req, res): Promise<{ folder: FolderRow }> => {
      const body = parseBody(createSchema, req);
      const ownerId = body.owner_id ?? req.user.id;
      if (ownerId !== req.user.id && req.user.role !== 'super_admin') throw forbidden();
      const sb = supabaseAdmin();
      if (body.parent_folder_id) {
        const { data: parent } = await sb.from('folders').select('owner_id').eq('id', body.parent_folder_id).maybeSingle();
        if (!parent || parent.owner_id !== ownerId) throw badRequest('Parent folder not found.');
      }
      const { data, error } = await sb
        .from('folders')
        .insert({ owner_id: ownerId, name: body.name, parent_folder_id: body.parent_folder_id ?? null })
        .select('*')
        .single();
      if (error) throw error;
      res.status(201);
      return { folder: data as FolderRow };
    },
  },
  { auth: requireAdmin },
);
