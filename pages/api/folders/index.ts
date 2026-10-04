import { z } from 'zod';
import type { FolderRow } from '@/types/database';
import type { FolderTreeResponse } from '@/types/api';
import { badRequest, createHandler, forbidden, parseBody, parseQuery, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

const listSchema = z.object({ owner: z.string().uuid().optional() });
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parent_folder_id: z.string().uuid().nullable().optional(),
  /** Super admin may create folders inside another admin's space. */
  owner_id: z.string().uuid().optional(),
});

export default createHandler<AdminAuthedRequest>(
  {
    /**
     * Folders of one owner (default: me). Super admins without `owner` additionally get the list of
     * admin accounts who can own content, rendered as top-level per-admin folders.
     */
    GET: async (req): Promise<FolderTreeResponse> => {
      const { owner } = parseQuery(listSchema, req);
      const isSuper = req.admin.role === 'super_admin';
      if (owner && owner !== req.admin.id && !isSuper) throw forbidden();
      const sb = supabaseAdmin();
      const { data, error } = await sb.from('folders').select('*').eq('owner_id', owner ?? req.admin.id).order('name');
      if (error) throw error;
      const result: FolderTreeResponse = { folders: (data ?? []) as FolderRow[] };
      if (isSuper && !owner) {
        const { data: owners, error: ownErr } = await sb
          .from('admin_accounts')
          .select('id, display_name')
          .eq('status', 'active')
          .order('display_name')
          .limit(500);
        if (ownErr) throw ownErr;
        result.owners = owners ?? [];
      }
      return result;
    },

    POST: async (req, res): Promise<{ folder: FolderRow }> => {
      const body = parseBody(createSchema, req);
      const ownerId = body.owner_id ?? req.admin.id;
      if (ownerId !== req.admin.id && req.admin.role !== 'super_admin') throw forbidden();
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
  { adminAuth: requireAdminAccount },
);
