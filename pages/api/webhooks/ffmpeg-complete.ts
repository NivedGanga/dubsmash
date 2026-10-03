import { timingSafeEqual } from 'node:crypto';
import type { NextApiRequest } from 'next';
import { z } from 'zod';
import { createHandler, notFound, parseBody, unauthorized } from '@/lib/server/handler';
import { requireEnv } from '@/lib/server/env';
import { completeJob, failJob, getJobBySession } from '@/lib/server/videoJobs';

const schema = z.discriminatedUnion('status', [
  z.object({ session_id: z.string().uuid(), status: z.literal('completed'), final_video_url: z.string().url().startsWith('https://res.cloudinary.com/'), public_id: z.string().optional() }),
  z.object({ session_id: z.string().uuid(), status: z.literal('failed'), error: z.string().max(2000).default('External renderer failed') }),
]);

function authorised(req: NextApiRequest): boolean {
  const given = req.headers['x-worker-secret'];
  if (typeof given !== 'string') return false;
  const expected = Buffer.from(requireEnv('WORKER_WEBHOOK_SECRET'));
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Optional completion callback for an external renderer (e.g. Shotstack or a self-hosted worker
 * that cannot reach the database). Authenticated with the shared WORKER_WEBHOOK_SECRET header.
 */
export default createHandler<NextApiRequest>({
  POST: async (req) => {
    if (!authorised(req)) throw unauthorized('Invalid worker secret.');
    const body = parseBody(schema, req);
    const job = await getJobBySession(body.session_id);
    if (!job) throw notFound('Job');
    if (job.status === 'completed') return { ok: true, status: 'completed' };
    if (body.status === 'completed') {
      await completeJob(job, body.final_video_url, body.public_id);
      return { ok: true, status: 'completed' };
    }
    return { ok: true, status: await failJob(job, new Error(body.error)) };
  },
});
