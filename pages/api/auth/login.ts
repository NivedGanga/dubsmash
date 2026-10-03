import type { NextApiRequest } from 'next';
import type { MeResponse } from '@/types/api';
import { ApiError, createHandler, forbidden } from '@/lib/server/handler';
import { requireFirebaseToken } from '@/lib/middleware/requireAuth';
import { supabaseAdmin } from '@/lib/server/supabase';
import { buildMe, getUserByFirebaseUid } from '@/lib/server/users';

/**
 * Called by the client right after Firebase sign-in (email/password or SSO). Firebase verifies the
 * password; this endpoint maps the Firebase identity to the Dubsmash profile and reports admin access.
 */
export default createHandler<NextApiRequest>({
  POST: async (req): Promise<MeResponse> => {
    const decoded = await requireFirebaseToken(req);
    const user = await getUserByFirebaseUid(decoded.uid);
    if (!user) throw new ApiError(404, 'profile_required', 'Finish signing up by choosing a username.');
    if (user.status === 'banned') throw forbidden('This account has been suspended.');
    const now = new Date().toISOString();
    await supabaseAdmin().from('users').update({ last_seen_at: now }).eq('id', user.id);
    return buildMe({ ...user, last_seen_at: now });
  },
});
