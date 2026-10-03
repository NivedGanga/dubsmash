import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDetails } from '@/types/api';
import type { RecordingRow } from '@/types/database';
import type { Sequence } from '@/types/game';
import { COUNTDOWN_SECONDS } from '@/types/game';
import { api, errorMessage } from '@/lib/api';
import { AudioRecorder, MicrophoneError, beep, extensionFor, requestMicrophoneAccess, startLevelMeter, stopStream, type RecordingResult } from '@/lib/audio';
import { uploadToCloudinary } from '@/lib/upload';
import { formatTimecode } from '@/lib/utils';
import { effectiveVolume, useSettings } from '@/store/settings';
import { useSession } from '@/store/session';
import { ErrorBox } from '@/components/Common/ui';

type Phase = 'idle' | 'countdown' | 'recording' | 'review' | 'submitting';

/** Grace period after the line ends, so trailing words aren't cut off. */
const GRACE_SECONDS = 0.75;

/**
 * Recording UI for the player whose turn it is:
 * hear the original -> 3-2-1 (visual + beeps) -> record (red dot, timer, level meter, muted video as
 * guide) -> review -> re-record (unlimited) or submit (upload + confirm turn).
 */
export function RecordingScreen({ details, sequence, onSubmitted }: { details: SessionDetails; sequence: Sequence; onSubmitted: () => void }) {
  const { clip, session } = details;
  const settings = useSettings();
  const waveformUi = !!useSession((s) => s.me?.flags.new_recording_ui);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const stopMeterRef = useRef<(() => void) | null>(null);
  const timers = useRef<number[]>([]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<RecordingResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const lineLength = sequence.end - sequence.start;
  const absStart = sequence.start; // clip.video_url is already trimmed, so offsets are timeline-relative
  const absEnd = sequence.end;
  const existing = details.recordings.find((r) => r.sequence_id === sequence.id);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const releaseMic = useCallback(() => {
    stopMeterRef.current?.();
    stopMeterRef.current = null;
    recorderRef.current?.cancel();
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    clearTimers();
    releaseMic();
  }, [releaseMic]);

  // Tell others we're up (best-effort).
  useEffect(() => {
    void api(`/api/sessions/${session.id}/recording-start`, { method: 'POST', body: {} }).catch(() => {});
  }, [session.id, sequence.id]);

  // Keep the video inside this line's window.
  function playWindow(muted: boolean) {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = effectiveVolume(settings, settings.effectsVolume);
    v.currentTime = absStart;
    void v.play().catch(() => {});
  }
  function onTimeUpdate() {
    const v = videoRef.current;
    if (v && v.currentTime >= absEnd) {
      v.pause();
      setPreviewing(false);
    }
  }

  function drawWaveform(data: Float32Array) {
    const c = canvasRef.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle = '#ff2e6e';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / data.length) * c.width;
      const y = (0.5 + data[i]! * 0.9) * c.height;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  async function begin() {
    setError(null);
    setTake(null);
    try {
      if (!streamRef.current) {
        streamRef.current = await requestMicrophoneAccess(settings.microphoneDeviceId);
        stopMeterRef.current = startLevelMeter(streamRef.current, (l, wave) => {
          setLevel(l);
          if (wave) drawWaveform(wave);
        }, waveformUi);
      }
    } catch (err) {
      setError(err instanceof MicrophoneError ? err.message : 'Could not access the microphone.');
      return;
    }
    setPhase('countdown');
    setCount(COUNTDOWN_SECONDS);
    for (let i = 0; i < COUNTDOWN_SECONDS; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setCount(COUNTDOWN_SECONDS - i);
          beep(660, 120, effectiveVolume(settings, settings.effectsVolume) * 0.4);
        }, i * 1000),
      );
    }
    timers.current.push(window.setTimeout(startRecording, COUNTDOWN_SECONDS * 1000));
  }

  function startRecording() {
    beep(990, 200, effectiveVolume(settings, settings.effectsVolume) * 0.4);
    const rec = new AudioRecorder(streamRef.current!);
    recorderRef.current = rec;
    rec.start();
    playWindow(true); // muted video as a timing guide
    setPhase('recording');
    const startedAt = performance.now();
    const tick = () => {
      const e = (performance.now() - startedAt) / 1000;
      setElapsed(e);
      if (recorderRef.current === rec && rec.recording) timers.current.push(window.setTimeout(tick, 100));
    };
    tick();
    timers.current.push(window.setTimeout(() => void finish(), (lineLength + GRACE_SECONDS) * 1000));
  }

  async function finish() {
    const rec = recorderRef.current;
    if (!rec?.recording) return;
    clearTimers();
    videoRef.current?.pause();
    try {
      const result = await rec.stop();
      setTake(result);
      setAttempts((a) => a + 1);
      setPhase('review');
    } catch (err) {
      setError(errorMessage(err));
      setPhase('idle');
    }
  }

  function reviewTake() {
    if (!take) return;
    const audio = new Audio(take.url);
    audio.volume = effectiveVolume(settings, settings.dialogueVolume);
    playWindow(true);
    void audio.play();
    setPreviewing(true);
    audio.onended = () => setPreviewing(false);
  }

  async function submit() {
    if (!take) return;
    setPhase('submitting');
    setError(null);
    try {
      const up = await uploadToCloudinary(take.blob, { kind: 'recording', session_id: session.id }, {
        fileName: `${sequence.id}.${extensionFor(take.mimeType)}`,
        onProgress: setProgress,
      });
      await api<{ recording: RecordingRow }>('/api/recordings/upload', {
        method: 'POST',
        body: { session_id: session.id, sequence_id: sequence.id, public_id: up.public_id },
      });
      await api(`/api/sessions/${session.id}/recording-submit`, { method: 'POST', body: { sequence_id: sequence.id } });
      releaseMic();
      URL.revokeObjectURL(take.url);
      onSubmitted();
    } catch (err) {
      setError(`${errorMessage(err)} Your take is kept — try submitting again.`);
      setPhase('review');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} src={clip.video_url} className="aspect-video w-full" playsInline preload="auto" onTimeUpdate={onTimeUpdate} />
          {phase === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span key={count} className="animate-pop font-display text-9xl font-black text-white">{count}</span>
            </div>
          )}
          {phase === 'recording' && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-sm font-bold">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" aria-hidden /> REC {formatTimecode(elapsed)} / {formatTimecode(lineLength)}
            </div>
          )}
        </div>
        {sequence.dialogue && (
          <p className="card-glow rounded-2xl border border-brand-500/30 bg-ink-800 p-4 text-center text-xl font-semibold">
            “{sequence.dialogue}”
          </p>
        )}
      </div>

      <div className="card space-y-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand-300">Your line · #{sequence.index + 1}</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black">
            <span className="h-4 w-4 rounded-full shadow-glow-sm" style={{ background: sequence.character.color }} />
            {sequence.character.name}
          </p>
          <p className="text-sm text-ink-200">{lineLength.toFixed(1)} seconds</p>
        </div>

        {error && <ErrorBox message={error} />}

        <button className="btn-secondary w-full py-3 text-lg" disabled={phase === 'countdown' || phase === 'recording' || phase === 'submitting'} onClick={() => { playWindow(false); setPreviewing(true); }}>
          {previewing ? '♪ Playing…' : '▶ Hear the original'}
        </button>

        {/* Level meter / waveform */}
        <div aria-label="Microphone level">
          {waveformUi ? (
            <canvas ref={canvasRef} width={300} height={60} className="h-14 w-full rounded-lg bg-ink-900" />
          ) : (
            <div className="h-3 overflow-hidden rounded-full bg-ink-900">
              <div className={`h-full transition-[width] duration-75 ${level > 0.85 ? 'bg-red-500' : 'bg-green-400'}`} style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          )}
          <p className="mt-1 text-xs text-ink-400">{streamRef.current ? 'Mic on' : 'Mic starts when you record'}</p>
        </div>

        {phase === 'idle' && (
          <button className="btn-primary animate-pulse-glow w-full py-4 font-display text-xl uppercase tracking-wider" onClick={() => void begin()}>
            ● {existing || attempts ? 'Record again' : 'Record'}
          </button>
        )}
        {phase === 'countdown' && <p className="text-center text-lg font-bold">Get ready…</p>}
        {phase === 'recording' && (
          <button className="btn-danger w-full py-4 text-xl" onClick={() => void finish()}>■ Stop</button>
        )}
        {(phase === 'review' || phase === 'submitting') && take && (
          <div className="space-y-3">
            <button className="btn-secondary w-full" disabled={phase === 'submitting'} onClick={reviewTake}>▶ Play back my take</button>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary" disabled={phase === 'submitting'} onClick={() => void begin()}>↺ Re-record</button>
              <button className="btn-primary" disabled={phase === 'submitting'} onClick={() => void submit()}>
                {phase === 'submitting' ? `Uploading ${Math.round(progress * 100)}%` : 'Submit ✓'}
              </button>
            </div>
            <p className="text-center text-xs text-ink-400">Take {attempts} · {take.durationSeconds.toFixed(1)}s</p>
          </div>
        )}
      </div>
    </div>
  );
}
