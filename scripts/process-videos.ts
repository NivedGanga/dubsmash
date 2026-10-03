/**
 * FFmpeg render worker. Runs on GitHub Actions every 5 minutes (.github/workflows/process-videos.yml)
 * or locally: `npm run process-videos` (needs ffmpeg on PATH and Supabase + Cloudinary env vars).
 *
 * Per run it claims up to MAX_JOBS_PER_RUN jobs (atomic, skip-locked), and for each:
 *   download source clip + takes -> ffmpeg mix/render -> upload MP4 to Cloudinary -> mark completed,
 *   update the session, notify players. Failures are retried up to 3 times, then marked failed.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { VideoProcessingJobRow } from '@/types/database';
import { buildDubArgs } from '@/lib/ffmpeg';
import { claimNextJob, completeJob, failJob, markProcessingBroadcast } from '@/lib/server/videoJobs';
import { rootFolder, uploadVideo } from '@/lib/server/cloudinary';

const MAX_JOBS_PER_RUN = Number(process.env.MAX_JOBS_PER_RUN) || 3;
const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_TIMEOUT_MS) || 15 * 60 * 1000;
const ALLOWED_HOSTS = ['res.cloudinary.com'];

function log(job: VideoProcessingJobRow | null, msg: string) {
  console.info(`[worker]${job ? ` [job ${job.id.slice(0, 8)} session ${job.session_id.slice(0, 8)}]` : ''} ${msg}`);
}

/** Only fetch media from Cloudinary (prevents the worker being pointed at arbitrary URLs). */
async function download(url: string, dest: string): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.includes(u.hostname)) throw new Error(`Refusing to download from ${u.hostname}`);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${u.pathname}`);
      await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(dest));
      return;
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

function extOf(url: string, fallback: string): string {
  const m = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(new URL(url).pathname);
  return m ? m[1]!.toLowerCase() : fallback;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg timed out'));
    }, FFMPEG_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Could not start ffmpeg: ${err.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`));
    });
  });
}

async function processJob(job: VideoProcessingJobRow): Promise<void> {
  const payload = job.recordings;
  const dir = await mkdtemp(join(tmpdir(), `dub-${job.id.slice(0, 8)}-`));
  try {
    await markProcessingBroadcast(job);
    log(job, `downloading clip + ${payload.tracks.length} take(s)`);
    const videoPath = join(dir, `source.${extOf(payload.video_url, 'mp4')}`);
    const tracks = payload.tracks.map((t, i) => ({ ...t, path: join(dir, `take-${i}.${extOf(t.audio_url, 'webm')}`) }));
    await Promise.all([download(payload.video_url, videoPath), ...tracks.map((t) => download(t.audio_url, t.path))]);

    const outputPath = join(dir, 'final.mp4');
    const started = Date.now();
    await runFfmpeg(
      buildDubArgs({
        videoPath,
        trimStart: Number(payload.trim_start) || 0,
        trimEnd: payload.trim_end === null ? null : Number(payload.trim_end),
        tracks: tracks.map((t) => ({ path: t.path, start: t.start, end: t.end })),
        outputPath,
      }),
    );
    const { size } = await stat(outputPath);
    log(job, `rendered ${(size / 1024 / 1024).toFixed(1)}MB in ${((Date.now() - started) / 1000).toFixed(1)}s, uploading`);

    const uploaded = await uploadVideo(outputPath, `${rootFolder()}/renders`, {
      public_id: job.session_id,
      overwrite: true,
      invalidate: true,
    });
    await completeJob(job, uploaded.secure_url, uploaded.public_id);
    log(job, `completed -> ${uploaded.secure_url}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  let processed = 0;
  for (; processed < MAX_JOBS_PER_RUN; processed++) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      await processJob(job);
    } catch (err) {
      const status = await failJob(job, err);
      console.error(`[worker] job ${job.id} failed (${status === 'pending' ? `will retry, attempt ${job.retry_count + 1}` : 'giving up'}):`, err);
    }
  }
  log(null, processed ? `processed ${processed} job(s)` : 'no pending jobs');
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
