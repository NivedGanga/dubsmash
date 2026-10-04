import type { AdminMeResponse } from '@/types/api';
import { createHandler, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireAdminAccount, toPublicAdminAccount } from '@/lib/server/adminAuth';
import { evaluateAllFlags } from '@/lib/server/featureFlags';

export default createHandler<AdminAuthedRequest>(
  {
    GET: async (req): Promise<AdminMeResponse> => ({
      account: toPublicAdminAccount(req.admin),
      flags: await evaluateAllFlags(req.admin.id),
    }),
  },
  { adminAuth: requireAdminAccount },
);
