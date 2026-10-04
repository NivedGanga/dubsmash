import { z } from 'zod';
import type { FeatureFlagRow } from '@/types/database';
import { ApiError, createHandler, notFound, parseBody, queryParam, type AdminAuthedRequest } from '@/lib/server/handler';
import { requireSuperAdminAccount } from '@/lib/server/adminAuth';
import { supabaseFlagStore, toggleFlag } from '@/lib/server/featureFlags';

const schema = z.object({
  enabled: z.boolean(),
  /** Required for critical flags (is_critical), so they can't be flipped by accident. */
  confirm: z.boolean().optional(),
});

/** Enable/disable a flag. Takes effect immediately (cache cleared) and is audit-logged. */
export default createHandler<AdminAuthedRequest>(
  {
    PATCH: async (req): Promise<{ flag: FeatureFlagRow }> => {
      const name = queryParam(req, 'flagName');
      const { enabled, confirm } = parseBody(schema, req);
      const flag = await supabaseFlagStore.get(name);
      if (!flag) throw notFound('Flag');
      if (flag.is_critical && !confirm) throw new ApiError(428, 'confirmation_required', `"${name}" is a critical flag. Confirm to change it.`);
      return { flag: await toggleFlag(name, enabled, req.admin.id) };
    },
  },
  { adminAuth: requireSuperAdminAccount },
);
