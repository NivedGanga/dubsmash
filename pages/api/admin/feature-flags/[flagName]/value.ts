import { z } from 'zod';
import type { FeatureFlagRow } from '@/types/database';
import { badRequest, createHandler, notFound, parseBody, queryParam, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { supabaseFlagStore, updateFlagValue } from '@/lib/server/featureFlags';

const schema = z.object({
  flag_value: z
    .object({
      rollout_percentage: z.number().min(0).max(100).optional(),
      user_ids: z.array(z.string().max(64)).max(1000).optional(),
    })
    .strict(),
});

/** Update a percentage rollout or user list. Validated per flag type, audit-logged. */
export default createHandler<AdminAuthedRequest>(
  {
    PATCH: async (req): Promise<{ flag: FeatureFlagRow }> => {
      const name = queryParam(req, 'flagName');
      const { flag_value } = parseBody(schema, req);
      if (!(await supabaseFlagStore.get(name))) throw notFound('Flag');
      try {
        return { flag: await updateFlagValue(name, flag_value, req.admin.id) };
      } catch (err) {
        if (err instanceof Error && /must be|limited to/.test(err.message)) throw badRequest(err.message);
        throw err;
      }
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
