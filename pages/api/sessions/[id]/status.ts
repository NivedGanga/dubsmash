import type { ProcessingStatusResponse } from '@/types/api';
import { createHandler, forbidden, queryParam } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { getProcessingJob, getSession, isPlayer } from '@/lib/server/sessions';

/** Worker runs every 5 minutes; rendering itself takes ~1-3 minutes. */
const CRON_INTERVAL_S = 5 * 60;
const RENDER_ESTIMATE_S = 3 * 60;

export default createHandler(
  {
    GET: async (req): Promise<ProcessingStatusResponse> => {
      const session = await getSession(queryParam(req, 'id'));
      if (!isPlayer(session, req.user.id)) throw forbidden('You are not in this game.');
      const job = await getProcessingJob(session.id);
      if (!job) {
        return { status: 'not_queued', final_video_url: session.final_video_url, error_message: null, retry_count: 0, queued_at: null, estimated_seconds_remaining: null };
      }
      let eta: number | null = null;
      const now = Date.now();
      if (job.status === 'pending') {
        const waited = (now - Date.parse(job.created_at)) / 1000;
        eta = Math.max(30, CRON_INTERVAL_S - (waited % CRON_INTERVAL_S)) + RENDER_ESTIMATE_S;
      } else if (job.status === 'processing' && job.started_at) {
        eta = Math.max(15, RENDER_ESTIMATE_S - (now - Date.parse(job.started_at)) / 1000);
      }
      return {
        status: job.status,
        final_video_url: job.result?.final_video_url ?? session.final_video_url,
        error_message: job.status === 'failed' ? 'Rendering failed after several attempts.' : null,
        retry_count: job.retry_count,
        queued_at: job.created_at,
        estimated_seconds_remaining: eta === null ? null : Math.round(eta),
      };
    },
  },
  { auth: requireAuth },
);
