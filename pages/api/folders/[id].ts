import { z } from 'zod';
import type { FolderRow } from '@/types/database';
import { badRequest, conflict, createHandler, forbidden, notFound, parseBody, queryParam } from '@/lib/server/handler';
import { requireAdmin } from '@/lib/middleware/requireAdmin';
import { supabaseAdmin } from '@/lib/server/supabase';
import type { UserRow } from '@/types/database';

const patchSchema = z
  .object({ name: z.string().trim().min(1).max(80), parent_folder_id: z.string().uuid().nullable() })
  .partial()
  .strict();

async function getManagedFolder(id: string, user: UserRow): Promise<FolderRow> {
  const { data, error } = await supabaseAdmin().from('folders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Folder');
  const folder = data as FolderRow;
  if (folder.owner_id !== user.id && user.role !== 'super_admin') throw forbidden();
  return folder;
}

/** True if `candidateParent` is `folderId` or one of its descendants (would create a cycle). */
async function wouldCycle(folderId: string, candidateParent: string, ownerId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from('folders').select('id, parent_folder_id').eq('owner_id', ownerId);
  if (error) throw error;
  const parentOf = new Map((data ?? []).map((f) => [f.id as string, f.parent_folder_id as string | null]));
  for (let cur: string | null = candidateParent, guard = 0; cur && guard < 1000; cur = parentOf.get(cur) ?? null, guard++) {
    if (cur === folderId) return true;
  }
  return false;
}

export default createHandler(
  {
    /** Rename or move a folder. */
    PATCH: async (req): Promise<{ folder: FolderRow }> => {
      const folder = await getManagedFolder(queryParam(req, 'id'), req.user);
      const patch = parseBody(patchSchema, req);
      if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.');
      if (patch.parent_folder_id) {
        const { data: parent } = await supabaseAdmin().from('folders').select('owner_id').eq('id', patch.parent_folder_id).maybeSingle();
        if (!parent || parent.owner_id !== folder.owner_id) throw badRequest('Target folder not found.');
        if (await wouldCycle(folder.id, patch.parent_folder_id, folder.owner_id)) throw badRequest('A folder cannot be moved inside itself.');
      }
      const { data, error } = await supabaseAdmin().from('folders').update(patch).eq('id', folder.id).select('*').single();
      if (error) throw error;
      return { folder: data as FolderRow };
    },

    /** Delete an empty folder (no clips, no subfolders). */
    DELETE: async (req) => {
      const folder = await getManagedFolder(queryParam(req, 'id'), req.user);
      const sb = supabaseAdmin();
      const [{ count: clips }, { count: children }] = await Promise.all([
        sb.from('clips').select('id', { count: 'exact', head: true }).eq('folder_id', folder.id),
        sb.from('folders').select('id', { count: 'exact', head: true }).eq('parent_folder_id', folder.id),
      ]);
      if ((clips ?? 0) > 0 || (children ?? 0) > 0) throw conflict('Only empty folders can be deleted.');
      const { error } = await sb.from('folders').delete().eq('id', folder.id);
      if (error) throw error;
      return undefined;
    },
  },
  { auth: requireAdmin },
);
