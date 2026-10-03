import { z } from 'zod';
import type { NextApiRequest } from 'next';
import { createHandler, parseBody, unauthorized } from '@/lib/server/handler';
import { requireEnv } from '@/lib/server/env';

const schema = z.object({ refresh_token: z.string().min(20).max(4096) });

/**
 * Exchanges a Firebase refresh token for a fresh ID token (for non-browser clients; the web app's
 * Firebase SDK refreshes tokens itself).
 */
export default createHandler<NextApiRequest>({
  POST: async (req) => {
    const { refresh_token } = parseBody(schema, req);
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${requireEnv('NEXT_PUBLIC_FIREBASE_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }).toString(),
    });
    if (!res.ok) throw unauthorized('Refresh token is invalid or expired. Please log in again.');
    const json = (await res.json()) as { id_token: string; refresh_token: string; expires_in: string };
    return { id_token: json.id_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in) };
  },
});
