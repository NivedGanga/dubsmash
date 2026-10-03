import { z } from 'zod';
import type { NextApiRequest } from 'next';
import type { UserRow } from '@/types/database';
import type { SignupResponse } from '@/types/api';
import { badRequest, conflict, createHandler, isPgError, parseBody } from '@/lib/server/handler';
import { requireFirebaseToken } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { isFeatureEnabled } from '@/lib/server/featureFlags';
import { buildMe, getUserByFirebaseUid, isUsernameTaken } from '@/lib/server/users';
import { displayNameSchema, usernameSchema } from '@/lib/server/validation';
import { randomUsername } from '@/lib/utils';

const schema = z.object({
  // Optional: users who skip the username step get Player_1234 (changeable later in profile).
  username: usernameSchema.optional(),
  display_name: displayNameSchema.optional(),
});

/**
 * Create the Dubsmash profile for a user who already signed up with Firebase (email/password or SSO).
 * The first user ever becomes super admin (atomic, see register_user SQL function).
 */
export default createHandler<NextApiRequest>({
  POST: async (req, res): Promise<SignupResponse> => {
    const decoded = await requireFirebaseToken(req);
    const body = parseBody(schema, req);
    if (!decoded.email) throw badRequest('Your sign-in provider did not share an email address.');
    if (await getUserByFirebaseUid(decoded.uid)) throw conflict('Your account is already set up. Please log in.');

    const approvalRequired = await isFeatureEnabled('super_admin_approval_required');
    const defaultRole = approvalRequired ? 'user' : 'admin';

    let username = body.username;
    if (username && (await isUsernameTaken(username))) throw conflict('That username is taken.');

    const displayName = body.display_name ?? (decoded.name as string | undefined)?.slice(0, 40) ?? username ?? 'Player';

    let user: UserRow | null = null;
    for (let attempt = 0; attempt < 5 && !user; attempt++) {
      const candidate = username ?? randomUsername();
      const { data, error } = await supabaseAdmin().rpc('register_user', {
        p_firebase_uid: decoded.uid,
        p_email: decoded.email,
        p_username: candidate,
        p_display_name: displayName,
        p_default_role: defaultRole,
      });
      if (error) {
        // Unique violation on a random username: try another. On a chosen username or email: report it.
        if (isPgError(error, '23505') && !username) continue;
        if (isPgError(error, '23505')) throw conflict('That username or email is already registered.');
        throw error;
      }
      user = data as UserRow;
    }
    if (!user) throw conflict('Could not allocate a username. Please choose one.');

    res.status(201);
    return { ...(await buildMe(user)), is_first_user: user.role === 'super_admin' };
  },
});
