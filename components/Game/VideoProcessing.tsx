import type { ProcessingStatusResponse } from '@/types/api';
import { formatDuration } from '@/lib/utils';
import { downloadUrl } from '@/hooks/useVideoProcessing';
import { ShareButtons } from './ShareButtons';

const steps: Array<{ key: ProcessingStatusResponse['status']; label: string }> = [
  { key: 'pending', label: 'Queued' },
  { key: 'processing', label: 'Mixing audio & rendering' },
  { key: 'completed', label: 'Ready' },
];

/** Final MP4 render status: progress steps, ETA, then download + share. Never blocks the game. */
export function VideoProcessing({ status, eta, title }: { status: ProcessingStatusResponse | null; eta: number | null; title: string }) {
  if (!status || status.status === 'not_queued') {
    return <div className="card text-sm text-ink-200">Your video will be rendered once every line is recorded.</div>;
  }
  if (status.status === 'failed') {
    return (
      <div className="card border-red-700 text-sm">
        <p className="font-bold text-red-300">We couldn&apos;t render the video.</p>
        <p className="mt-1 text-ink-200">The live playback above still works. The admins have been notified via the processing queue.</p>
      </div>
    );
  }
  if (status.status === 'completed' && status.final_video_url) {
    return (
      <div className="card space-y-3">
        <p className="font-bold text-green-300">Your dubbed video is ready! 🎉</p>
        <video src={status.final_video_url} controls className="aspect-video w-full rounded-xl bg-black" preload="metadata" />
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={downloadUrl(status.final_video_url)} download>⬇ Download MP4</a>
          <ShareButtons url={status.final_video_url} title={title} />
        </div>
      </div>
    );
  }
  const current = steps.findIndex((s) => s.key === status.status);
  return (
    <div className="card space-y-3" aria-live="polite">
      <p className="font-bold">Your video is being processed…</p>
      <p className="text-sm text-ink-200">
        Estimated {eta != null ? `~${formatDuration(eta)}` : '5-10 minutes'} remaining. You can keep playing — we&apos;ll notify you when it&apos;s ready.
        {status.retry_count > 0 && ` (retry ${status.retry_count})`}
      </p>
      <ol className="flex gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s.key} className={`flex-1 rounded-lg px-2 py-1.5 text-center ${i < current ? 'bg-green-600/40' : i === current ? 'animate-pulse bg-brand-500/40' : 'bg-ink-700'}`}>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
