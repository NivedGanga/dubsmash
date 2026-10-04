import { z } from 'zod';
import type { AdminAuthResponse } from '@/types/api';
import { ApiError, createHandler, parseBody, unauthorized } from '@/lib/server/handler';
import { getAdminAccountByEmail, signAdminToken, toPublicAdminAccount, verifyAdminPassword } from '@/lib/server/adminAuth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const INVALID = 'Invalid email or password.';

/** Admin-portal login — issues a session token only for active admin accounts. */
export default createHandler({
  POST: async (req): Promise<AdminAuthResponse> => {
    const body = parseBody(schema, req);
    const account = await getAdminAccountByEmail(body.email);
    if (!account || !(await verifyAdminPassword(body.password, account.password_hash))) {
      throw unauthorized(INVALID);
    }
    if (account.status === 'pending') {
      throw new ApiError(403, 'pending_approval', 'Your admin account is waiting for super admin approval.');
    }
    if (account.status === 'banned') throw new ApiError(403, 'suspended', 'This admin account has been suspended.');
    if (account.status !== 'active') throw unauthorized(INVALID);
    return { account: toPublicAdminAccount(account), token: await signAdminToken(account) };
  },
});
