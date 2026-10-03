import { useRef, type PointerEvent } from 'react';
import { clamp, formatTimecode, round2 } from '@/lib/utils';

const MIN_LENGTH = 1;

/** Dual-handle trim bar over the full (untrimmed) video. */
export function TrimControls({
  duration,
  start,
  end,
  onChange,
  currentTime,
  disabled,
}: {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  /** Absolute video time for the playhead. */
  currentTime: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);
  const pct = (t: number) => `${(t / duration) * 100}%`;

  const timeAt = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return round2(clamp(((x - r.left) / r.width) * duration, 0, duration));
  };

  const move = (e: PointerEvent) => {
    if (!dragging.current) return;
    const t = timeAt(e.clientX);
    if (dragging.current === 'start') onChange(Math.min(t, end - MIN_LENGTH), end);
    else onChange(start, Math.max(t, start + MIN_LENGTH));
  };

  const handle = (which: 'start' | 'end', t: number) => (
    <button
      type="button"
      disabled={disabled}
      className="absolute top-0 z-10 h-full w-4 -translate-x-1/2 cursor-ew-resize touch-none rounded bg-brand-500 shadow focus:outline-none focus:ring-2 focus:ring-brand-300"
      style={{ left: pct(t) }}
      aria-label={`Trim ${which} at ${formatTimecode(t)}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = which;
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        dragging.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const d = (e.shiftKey ? 1 : 0.1) * (e.key === 'ArrowLeft' ? -1 : 1);
        if (which === 'start') onChange(round2(clamp(start + d, 0, end - MIN_LENGTH)), end);
        else onChange(start, round2(clamp(end + d, start + MIN_LENGTH, duration)));
      }}
    />
  );

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative h-10 select-none rounded-lg bg-ink-900 ring-1 ring-ink-700">
        <div className="absolute inset-y-0 rounded bg-brand-500/25" style={{ left: pct(start), width: pct(end - start) }} />
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80" style={{ left: pct(clamp(currentTime, 0, duration)) }} />
        {handle('start', start)}
        {handle('end', end)}
      </div>
      <div className="flex justify-between text-xs text-ink-200">
        <span>Start {formatTimecode(start)}</span>
        <span>Length {formatTimecode(end - start)}</span>
        <span>End {formatTimecode(end)}</span>
      </div>
    </div>
  );
}
