/**
 * Browser audio helpers (Web Audio API + MediaRecorder).
 *
 * Encoding: browsers cannot natively encode MP3, so takes are recorded as Opus (WebM/Ogg) or AAC (MP4
 * on Safari). Opus beats MP3 quality at the same bitrate; the FFmpeg worker accepts all of them.
 * Bitrate is chosen from the network connection (64-128 kbps).
 */

export class MicrophoneError extends Error {
  constructor(
    public reason: 'denied' | 'not_found' | 'busy' | 'unsupported' | 'insecure',
    message: string,
  ) {
    super(message);
  }
}

export function isRecordingSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

/** Ask for microphone permission (optionally a specific input device). */
export async function requestMicrophoneAccess(deviceId?: string | null): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new MicrophoneError('insecure', 'Recording needs a secure (https) connection.');
  }
  if (!isRecordingSupported()) throw new MicrophoneError('unsupported', 'Your browser does not support audio recording. Try Chrome, Firefox or Safari.');
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicrophoneError('denied', 'Microphone access was blocked. Allow microphone access in your browser settings, then try again.');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      if (deviceId) return requestMicrophoneAccess(null); // selected device unplugged: fall back to default
      throw new MicrophoneError('not_found', 'No microphone found. Plug one in and try again.');
    }
    if (name === 'NotReadableError') throw new MicrophoneError('busy', 'Your microphone is being used by another app.');
    throw new MicrophoneError('unsupported', 'Could not access the microphone.');
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function listInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function extensionFor(mime: string): string {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  return 'webm';
}

/** Dynamic bitrate: lower on slow connections so uploads stay fast. */
export function pickBitrate(): number {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return 48_000;
  if (conn?.effectiveType === '3g') return 64_000;
  return 128_000;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  url: string;
}

/** Thin MediaRecorder wrapper: start() -> stop() returns the encoded blob. */
export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  constructor(private stream: MediaStream) {}

  get recording(): boolean {
    return this.recorder?.state === 'recording';
  }

  start(): void {
    const mimeType = pickMimeType();
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: pickBitrate() });
    this.recorder.ondataavailable = (e) => e.data.size > 0 && this.chunks.push(e.data);
    this.recorder.start(250);
    this.startedAt = performance.now();
  }

  stop(): Promise<RecordingResult> {
    const rec = this.recorder;
    if (!rec) return Promise.reject(new Error('Not recording'));
    return new Promise((resolve, reject) => {
      rec.onstop = () => {
        const mimeType = rec.mimeType || pickMimeType() || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        if (blob.size === 0) return reject(new Error('Nothing was recorded. Check your microphone.'));
        resolve({ blob, mimeType, durationSeconds: (performance.now() - this.startedAt) / 1000, url: URL.createObjectURL(blob) });
      };
      rec.onerror = () => reject(new Error('Recording failed.'));
      if (rec.state !== 'inactive') rec.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.chunks = [];
  }
}

let sharedCtx: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === 'suspended') void sharedCtx.resume();
  return sharedCtx;
}

/**
 * Live input level (0-1, RMS-based) and optional waveform samples, delivered every animation frame.
 * Returns a stop function.
 */
export function startLevelMeter(stream: MediaStream, onLevel: (level: number, waveform?: Float32Array) => void, withWaveform = false): () => void {
  const ctx = audioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
    const rms = Math.sqrt(sum / buf.length);
    onLevel(Math.min(1, rms * 4), withWaveform ? buf : undefined);
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    source.disconnect();
    analyser.disconnect();
  };
}

/** Short countdown cue. */
export function beep(frequency = 660, durationMs = 120, volume = 0.3): void {
  try {
    const ctx = audioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  } catch {
    /* audio cues are best-effort */
  }
}

/** Play a blob or URL for review. Returns a stop function. */
export function playAudio(src: Blob | string, volume = 1, onEnded?: () => void): () => void {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const el = new Audio(url);
  el.volume = Math.max(0, Math.min(1, volume));
  el.onended = () => {
    onEnded?.();
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  };
  void el.play();
  return () => {
    el.pause();
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  };
}

/** Fetch + decode a remote recording for sample-accurate scheduled playback. */
export async function loadBuffer(url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load audio (${res.status})`);
  return audioContext().decodeAudioData(await res.arrayBuffer());
}

/** Peak-normalisation gain (max 4x boost) so quiet and loud takes play at similar levels. */
export function normalisationGain(buffer: AudioBuffer, targetPeak = 0.9): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 4) peak = Math.max(peak, Math.abs(data[i]!));
  }
  return peak > 0 ? Math.min(4, targetPeak / peak) : 1;
}
