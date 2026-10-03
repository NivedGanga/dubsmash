import { createHandler, queryParam } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { respondToAccessRequest } from '@/lib/server/accessRequests';

export default createHandler(
  {
    PATCH: async (req) => ({ request: await respondToAccessRequest(queryParam(req, 'id'), 'approved', req.user) }),
  },
  { auth: requireSuperAdmin },
);
