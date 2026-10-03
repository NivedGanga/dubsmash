import type { MeResponse } from '@/types/api';
import { createHandler } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { buildMe } from '@/lib/server/users';

/** Current profile + flags evaluated for this user + admin-portal access state. */
export default createHandler({ GET: async (req): Promise<MeResponse> => buildMe(req.user) }, { auth: requireAuth });
