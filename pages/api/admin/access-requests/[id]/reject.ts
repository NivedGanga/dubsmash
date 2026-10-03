import { z } from 'zod';
import { createHandler, parseBody, queryParam } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { respondToAccessRequest } from '@/lib/server/accessRequests';

const schema = z.object({ message: z.string().trim().max(500).optional() });

export default createHandler(
  {
    PATCH: async (req) => {
      const { message } = parseBody(schema, req);
      return { request: await respondToAccessRequest(queryParam(req, 'id'), 'rejected', req.user, message) };
    },
  },
  { auth: requireSuperAdmin },
);
