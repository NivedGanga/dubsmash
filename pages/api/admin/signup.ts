import { z } from 'zod';
import type { AdminAuthResponse } from '@/types/api';
import type { AdminAccountRow } from '@/types/database';
import { ApiError, createHandler, isPgError, parseBody } from '@/lib/server/handler';
import { hashAdminPassword, signAdminToken, toPublicAdminAccount } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/server/supabase';

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(72), // bcrypt truncates at 72 bytes
  display_name: z.string().min(1).max(60).trim(),
});

/**
 * Admin-portal signup — completely separate from game accounts. The first admin account ever
 * becomes an active super_admin; later signups stay 'pending' until a super admin approves them
 * (no token is issued for pending accounts).
 */
export default createHandler({
  POST: async (req): Promise<AdminAuthResponse> => {
    const body = parseBody(schema, req);
    const password_hash = await hashAdminPassword(body.password);
    const { data, error } = await supabaseAdmin().rpc('register_admin_account', {
      p_email: body.email,
      p_password_hash: password_hash,
      p_display_name: body.display_name,
    });
    if (error) {
      if (isPgError(error, '23505')) throw new ApiError(409, 'conflict', 'An admin account with that email already exists.');
      throw error;
    }
    const account = data as AdminAccountRow;
    if (account.status !== 'active') return { account: toPublicAdminAccount(account) };
    return { account: toPublicAdminAccount(account), token: await signAdminToken(account) };
  },
});
