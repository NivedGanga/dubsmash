import { createHandler } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';

/** Keeps users.last_seen_at fresh (requireAuth updates it, throttled) for server-side online status. */
export default createHandler({ POST: async () => undefined }, { auth: requireAuth });
