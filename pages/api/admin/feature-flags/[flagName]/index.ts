import type { FeatureFlagWithHistory } from '@/types/api';
import type { FeatureFlagRow } from '@/types/database';
import { createHandler, notFound, queryParam } from '@/lib/server/handler';
import { requireSuperAdmin } from '@/lib/middleware/requireAdmin';
import { flagHistory, supabaseFlagStore } from '@/lib/server/featureFlags';

export default createHandler(
  {
    GET: async (req): Promise<FeatureFlagWithHistory> => {
      const name = queryParam(req, 'flagName');
      const flag: FeatureFlagRow | null = await supabaseFlagStore.get(name);
      if (!flag) throw notFound('Flag');
      return { ...flag, history: await flagHistory(name) };
    },
  },
  { auth: requireSuperAdmin },
);
