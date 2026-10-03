import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { ClipCharacter, TimelineSection } from '@/types/database';
import { MIN_SECTION_SECONDS } from '@/types/game';
import {
  assignCharacter,
  dropPointer,
  moveBoundary,
  pointerPositions,
  removeBoundary,
  setDialogue,
  splitAt,
} from '@/lib/timeline';
import { UNMAPPED_COLOR, clamp, formatTimecode, round2 } from '@/lib/utils';

export interface TimelineEditorProps {
  duration: number;
  sections: TimelineSection[];
  characters: ClipCharacter[];
  onChange: (sections: TimelineSection[]) => void;
  /** Playhead position in seconds (relative to the trimmed clip). */
  currentTime: number;
  onSeek: (t: number) => void;
  onPlaySection?: (section: TimelineSection) => void;
  disabled?: boolean;
}

interface DragState {
  pointer: number;
  edge: boolean;
  /** Ghost position while dragging an edge pointer (it spawns a boundary on release). */
  ghost: number;
  moved: boolean;
}

function tickStep(duration: number): number {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  return steps.find((s) => duration / s <= 12) ?? 600;
}

/**
 * Interactive timeline mapping (spec: "Timeline Editor Pointer Mechanics").
 * - Drag the start/end pointer inward: a new boundary spawns at the drop point (edge stays put).
 * - Drag an inner pointer: moves the boundary (cannot cross neighbours, min 0.5s sections).
 * - Double-click / Delete on an inner pointer removes it. Arrow keys nudge (Shift = 1s).
 * - Click a section, then pick a character (or press 1-4; 0 = unassign). Same-character neighbours merge.
 * - Grey = unmapped. Saving is only possible once nothing is grey (enforced by the page + API).
 */
export function TimelineEditor({
  duration,
  sections,
  characters,
  onChange,
  currentTime,
  onSeek,
  onPlaySection,
  disabled,
}: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null);
  const pointers = useMemo(() => pointerPositions(sections), [sections]);
  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);
  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const pct = (t: number) => `${(t / duration) * 100}%`;
  const n = sections.length;

  const timeAt = useCallback(
    (clientX: number) => {
      const rect = trackRef.current!.getBoundingClientRect();
      return round2(clamp(((clientX - rect.left) / rect.width) * duration, 0, duration));
    },
    [duration],
  );

  function onPointerDown(e: PointerEvent<HTMLButtonElement>, pointer: number) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ pointer, edge: pointer === 0 || pointer === n, ghost: pointers[pointer]!, moved: false });
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const t = timeAt(e.clientX);
    if (drag.edge) setDrag({ ...drag, ghost: t, moved: true });
    else {
      onChange(moveBoundary(sections, drag.pointer, t));
      if (!drag.moved) setDrag({ ...drag, moved: true });
    }
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.edge && drag.moved) {
      const next = dropPointer(sections, drag.pointer, drag.ghost);
      onChange(next);
      // Select the newly created inner section (between the drop point and the edge).
      const created = drag.pointer === 0 ? next[0] : next[next.length - 1];
      if (created && next.length > sections.length) setSelectedId(created.id);
    }
    setDrag(null);
  }

  function onPointerKey(e: KeyboardEvent<HTMLButtonElement>, pointer: number) {
    if (disabled || pointer === 0 || pointer === n) return;
    const step = e.shiftKey ? 1 : 0.1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(moveBoundary(sections, pointer, pointers[pointer]! + (e.key === 'ArrowLeft' ? -step : step)));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(removeBoundary(sections, pointer));
    }
  }

  function assign(characterId: string | null) {
    if (!selected || disabled) return;
    const next = assignCharacter(sections, selected.id, characterId);
    onChange(next);
    // Selection may have been merged away: keep the section now covering the old start.
    const keep = next.find((s) => s.start <= selected.start + 0.001 && s.end > selected.start);
    setSelectedId(keep?.id ?? null);
  }

  function onContainerKey(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (/^[1-4]$/.test(e.key)) {
      const c = characters[Number(e.key) - 1];
      if (c) assign(c.id);
    } else if (e.key === '0') assign(null);
    else if (e.key.toLowerCase() === 's') onChange(splitAt(sections, currentTime));
  }

  const step = tickStep(duration);
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);
  const unmapped = sections.filter((s) => s.character_id === null).length;
  const canSplit = sections.some((s) => currentTime - s.start >= MIN_SECTION_SECONDS && s.end - currentTime >= MIN_SECTION_SECONDS && currentTime > s.start && currentTime < s.end);

  return (
    <div className="space-y-4 outline-none" tabIndex={-1} onKeyDown={onContainerKey}>
      {/* Ruler: click to seek */}
      <div className="relative h-6 cursor-pointer select-none text-[10px] text-ink-400" onClick={(e) => onSeek(timeAt(e.clientX))}>
        {ticks.map((t) => (
          <span key={t} className="absolute top-0 -translate-x-1/2" style={{ left: pct(t) }}>
            <span className="mx-auto block h-2 w-px bg-ink-600" />
            {formatTimecode(t).replace(/\.\d$/, '')}
          </span>
        ))}
      </div>

      {/* Track */}
      <div ref={trackRef} className="relative h-20 select-none rounded-xl bg-ink-900 ring-1 ring-ink-700" data-testid="timeline-track">
        {sections.map((s, i) => {
          const c = s.character_id ? charById.get(s.character_id) : null;
          const isSel = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              className={`absolute inset-y-0 overflow-hidden px-2 text-left text-xs font-semibold text-white transition-[filter] hover:brightness-110 ${
                isSel ? 'z-10 ring-2 ring-inset ring-white' : ''
              } ${i === 0 ? 'rounded-l-xl' : ''} ${i === n - 1 ? 'rounded-r-xl' : ''}`}
              style={{ left: pct(s.start), width: pct(s.end - s.start), background: c?.color ?? UNMAPPED_COLOR, opacity: c ? 1 : 0.55 }}
              onClick={() => setSelectedId(s.id)}
              aria-label={`Section ${i + 1}, ${formatTimecode(s.start)} to ${formatTimecode(s.end)}, ${c?.name ?? 'unmapped'}`}
              aria-pressed={isSel}
            >
              <span className="block truncate pt-2">{c?.name ?? 'Unmapped'}</span>
              <span className="block truncate font-normal opacity-80">{(s.end - s.start).toFixed(1)}s</span>
            </button>
          );
        })}

        {/* Playhead */}
        <div className="pointer-events-none absolute inset-y-[-6px] z-20 w-0.5 bg-white/90" style={{ left: pct(clamp(currentTime, 0, duration)) }} />

        {/* Ghost line while dragging an edge pointer */}
        {drag?.edge && drag.moved && (
          <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-brand-300" style={{ left: pct(drag.ghost) }}>
            <span className="absolute -top-6 -translate-x-1/2 rounded bg-brand-500 px-1 text-[10px] font-bold">{formatTimecode(drag.ghost)}</span>
          </div>
        )}

        {/* Pointers */}
        {pointers.map((t, p) => {
          const edge = p === 0 || p === n;
          const active = drag?.pointer === p;
          return (
            <button
              key={`${p}-${edge ? 'edge' : sections[p]!.id}`}
              type="button"
              disabled={disabled}
              className={`absolute top-1/2 z-30 flex h-24 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none focus:outline-none`}
              style={{ left: pct(t) }}
              onPointerDown={(e) => onPointerDown(e, p)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onDoubleClick={() => !edge && !disabled && onChange(removeBoundary(sections, p))}
              onKeyDown={(e) => onPointerKey(e, p)}
              aria-label={`${edge ? (p === 0 ? 'Start' : 'End') + ' pointer (drag inward to add a boundary)' : `Boundary ${p}`} at ${formatTimecode(t)}`}
              title={edge ? 'Drag inward to create a new section' : 'Drag to move · double-click to remove'}
            >
              <span
                className={`block h-full w-1.5 rounded-full ${edge ? 'bg-ink-200' : 'bg-white'} ${active ? 'bg-brand-300 ring-4 ring-brand-500/40' : ''} shadow`}
              />
              {active && !edge && (
                <span className="absolute -top-6 rounded bg-brand-500 px-1 text-[10px] font-bold">{formatTimecode(t)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-secondary py-1" disabled={disabled || !canSplit} onClick={() => onChange(splitAt(sections, currentTime))}>
          Split at playhead (S)
        </button>
        <span className={`ml-auto ${unmapped ? 'text-yellow-300' : 'text-green-400'}`}>
          {unmapped ? `${unmapped} grey section${unmapped > 1 ? 's' : ''} left to map` : 'All sections mapped ✓'}
        </span>
      </div>

      {/* Selected section panel */}
      {selected && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold">
              Section {sections.indexOf(selected) + 1}: {formatTimecode(selected.start)} – {formatTimecode(selected.end)}
            </p>
            {onPlaySection && (
              <button type="button" className="btn-ghost py-1 text-sm" onClick={() => onPlaySection(selected)}>
                ▶ Play section
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {characters.map((c, i) => (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                className={`btn py-1 text-sm text-white ${selected.character_id === c.id ? 'ring-2 ring-white' : 'opacity-80 hover:opacity-100'}`}
                style={{ background: c.color }}
                onClick={() => assign(c.id)}
              >
                {i + 1}. {c.name}
              </button>
            ))}
            <button type="button" disabled={disabled} className="btn-secondary py-1 text-sm" onClick={() => assign(null)}>
              0. Unassign
            </button>
          </div>
          <div>
            <label className="label" htmlFor="dialogue">Dialogue line (shown to the player while recording)</label>
            <input
              id="dialogue"
              className="input"
              maxLength={500}
              disabled={disabled}
              value={selected.dialogue ?? ''}
              onChange={(e) => onChange(setDialogue(sections, selected.id, e.target.value))}
              placeholder="e.g. “I'll be back.”"
            />
          </div>
        </div>
      )}
    </div>
  );
}
