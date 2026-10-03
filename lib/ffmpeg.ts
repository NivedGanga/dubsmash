/**
 * FFmpeg command builder for the dubbing render (pure; no I/O, unit tested).
 *
 * Pipeline per take:  atrim (line length + tail) -> loudnorm (per-track normalisation)
 *                     -> 48kHz stereo -> adelay (timeline position)
 * Then: amix (no auto-attenuation) -> alimiter (global, prevents clipping) -> apad (to video length).
 * Video: trimmed with input seeking, re-encoded to H.264/AAC MP4 with faststart for web playback.
 */

export interface DubTrack {
  path: string;
  /** Line start/end in seconds, relative to the trimmed clip. */
  start: number;
  end: number;
}

export interface DubJob {
  videoPath: string;
  trimStart: number;
  /** Absolute end in the source video; null = until the end. */
  trimEnd: number | null;
  tracks: DubTrack[];
  outputPath: string;
  /** Allowed overrun of a take past its line end (seconds). */
  tailSeconds?: number;
  /** Keep a quiet bed of the original audio (0 = mute original, default). */
  originalAudioVolume?: number;
  /** Set when the source has an audio stream (needed for originalAudioVolume > 0). */
  sourceHasAudio?: boolean;
  preset?: 'ultrafast' | 'veryfast' | 'faster' | 'medium';
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function buildFilterComplex(job: DubJob): { filter: string; output: string } {
  const tail = job.tailSeconds ?? 0.75;
  const parts: string[] = [];
  const labels: string[] = [];

  job.tracks.forEach((t, i) => {
    const input = i + 1; // input 0 is the video
    const maxLen = Math.max(0.1, t.end - t.start + tail);
    const delayMs = Math.max(0, Math.round(t.start * 1000));
    parts.push(
      `[${input}:a]atrim=0:${fmt(maxLen)},asetpts=PTS-STARTPTS,` +
        `loudnorm=I=-16:TP=-1.5:LRA=11,` +
        `aformat=sample_rates=48000:channel_layouts=stereo,` +
        `adelay=delays=${delayMs}:all=1[t${i}]`,
    );
    labels.push(`[t${i}]`);
  });

  const bedVolume = job.originalAudioVolume ?? 0;
  if (bedVolume > 0 && job.sourceHasAudio) {
    parts.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${fmt(bedVolume)}[bed]`);
    labels.push('[bed]');
  }

  if (labels.length === 0) {
    // No takes: silent track so the output still has audio.
    parts.push('anullsrc=channel_layout=stereo:sample_rate=48000[aout]');
    return { filter: parts.join(';'), output: '[aout]' };
  }

  const mixed = labels.length === 1 ? `${labels[0]}anull[mix]` : `${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[mix]`;
  parts.push(mixed);
  parts.push('[mix]alimiter=limit=0.95:level=disabled,apad[aout]');
  return { filter: parts.join(';'), output: '[aout]' };
}

/** Full ffmpeg argument vector (pass to spawn without a shell — no injection surface). */
export function buildDubArgs(job: DubJob): string[] {
  const { filter, output } = buildFilterComplex(job);
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (job.trimStart > 0) args.push('-ss', fmt(job.trimStart));
  if (job.trimEnd !== null) args.push('-t', fmt(job.trimEnd - job.trimStart));
  args.push('-i', job.videoPath);
  for (const t of job.tracks) args.push('-i', t.path);
  args.push(
    '-filter_complex', filter,
    '-map', '0:v:0',
    '-map', output,
    '-c:v', 'libx264',
    '-preset', job.preset ?? 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-ar', '48000',
    '-movflags', '+faststart',
    // apad makes audio infinite; stop at the end of the (trimmed) video.
    '-shortest',
    job.outputPath,
  );
  return args;
}
