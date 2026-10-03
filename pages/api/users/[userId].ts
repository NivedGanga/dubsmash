import { z } from 'zod';
import type { UserRow } from '@/types/database';
import type { PublicUser, UserStats } from '@/types/api';
import { badRequest, conflict, createHandler, forbidden, notFound, parseBody, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { isFeatureEnabled } from '@/lib/server/featureFlags';
import { getUserById, isUsernameTaken, toPublicUser } from '@/lib/server/users';
import {
  PREMIUM_AVATARS,
  avatarModelSchema,
  avatarOutfitSchema,
  displayNameSchema,
  hexColorSchema,
  usernameSchema,
} from '@/lib/server/validation';

const updateSchema = z
  .object({
    username: usernameSchema,
    display_name: displayNameSchema,
    avatar_model: avatarModelSchema,
    avatar_color: hexColorSchema,
    avatar_outfit: avatarOutfitSchema,
  })
  .partial()
  .strict();

async function friendsCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('user_friends')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw error;
  return count ?? 0;
}

function resolveId(req: { query: Record<string, unknown>; user: UserRow }, raw: string): string {
  return raw === 'me' ? req.user.id : raw;
}

export default createHandler(
  {
    GET: async (req): Promise<{ user: PublicUser; stats: UserStats }> => {
      const id = resolveId(req, queryParam(req, 'userId'));
      const user = await getUserById(id);
      if (!user || user.status === 'banned') throw notFound('User');
      return {
        user: toPublicUser(user),
        stats: {
          games_played: user.games_played,
          total_recordings: user.total_recordings,
          clips_created: user.clips_created,
          friends_count: await friendsCount(user.id),
        },
      };
    },
    PUT: async (req): Promise<{ user: UserRow }> => {
      const id = resolveId(req, queryParam(req, 'userId'));
      if (id !== req.user.id && req.user.role !== 'super_admin') throw forbidden('You can only edit your own profile.');
      const patch = parseBody(updateSchema, req);
      if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.');
      if (patch.username && (await isUsernameTaken(patch.username, id))) throw conflict('That username is taken.');
      if (patch.avatar_model && PREMIUM_AVATARS.has(patch.avatar_model) && !(await isFeatureEnabled('premium_avatars', id))) {
        throw forbidden('That avatar is not available on your account yet.');
      }
      const { data, error } = await supabaseAdmin().from('users').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      return { user: data as UserRow };
    },
  },
  { auth: requireAuth },
);
