/**
 * Pure timeline-mapping logic used by the admin TimelineEditor and validated again on the server.
 *
 * Model: the (trimmed) clip is covered by contiguous, ordered sections. Section boundaries are the
 * "pointers". Pointer index i (1..n-1) sits between sections[i-1] and sections[i]; pointer 0 is the
 * clip start and pointer n is the clip end ("edge pointers").
 *
 * Mechanics (see spec "Timeline Editor Pointer Mechanics"):
 *  - Dragging an edge pointer inward spawns a new pointer at its old position, i.e. the drop point
 *    becomes a new boundary and the edge stays put (20s -> 7s yields sections 0-7 and 7-20).
 *  - Dragging an inner pointer moves the boundary between its two neighbours.
 *  - Pointers never cross neighbours or leave [0, duration]; sections are at least MIN_SECTION_SECONDS.
 *  - Adjacent sections assigned to the same character are merged.
 */
import type { ClipCharacter, TimelineSection } from '@/types/database';
import { MIN_SECTION_SECONDS } from '@/types/game';
import { clamp, round2, shortId } from './utils';

export type IdFactory = () => string;
const defaultId: IdFactory = () => shortId('s_');

export function createTimeline(duration: number, newId: IdFactory = defaultId): TimelineSection[] {
  if (!(duration > 0)) throw new Error('duration must be positive');
  return [{ id: newId(), start: 0, end: round2(duration), character_id: null }];
}

/** Boundary positions, including both edges: [0, b1, b2, ..., duration]. */
export function pointerPositions(sections: TimelineSection[]): number[] {
  if (sections.length === 0) return [];
  return [sections[0]!.start, ...sections.map((s) => s.end)];
}

export function totalDuration(sections: TimelineSection[]): number {
  return sections.length ? sections[sections.length - 1]!.end : 0;
}

export function sectionAt(sections: TimelineSection[], t: number): number {
  return sections.findIndex((s, i) => t >= s.start && (t < s.end || (i === sections.length - 1 && t <= s.end)));
}

/**
 * Split the section containing `t` into two. The left half keeps the original id/character, the
 * right half gets a new id and the same character (so assignment intent is preserved).
 * Returns the input unchanged if the split would create a section shorter than `minLen`.
 */
export function splitAt(
  sections: TimelineSection[],
  t: number,
  newId: IdFactory = defaultId,
  minLen = MIN_SECTION_SECONDS,
): TimelineSection[] {
  const at = round2(t);
  const idx = sectionAt(sections, at);
  if (idx < 0) return sections;
  const s = sections[idx]!;
  if (at - s.start < minLen || s.end - at < minLen) return sections;
  const left: TimelineSection = { ...s, end: at };
  const right: TimelineSection = { id: newId(), start: at, end: s.end, character_id: s.character_id };
  return [...sections.slice(0, idx), left, right, ...sections.slice(idx + 1)];
}

/** Clamp range for inner pointer `i` so neighbours keep at least `minLen`. */
export function pointerBounds(sections: TimelineSection[], i: number, minLen = MIN_SECTION_SECONDS): [number, number] {
  const prev = sections[i - 1]!;
  const next = sections[i]!;
  return [round2(prev.start + minLen), round2(next.end - minLen)];
}

/** Move inner pointer `i` (1..n-1) to `t`, clamped between its neighbours. */
export function moveBoundary(
  sections: TimelineSection[],
  i: number,
  t: number,
  minLen = MIN_SECTION_SECONDS,
): TimelineSection[] {
  if (i <= 0 || i >= sections.length) return sections;
  const [lo, hi] = pointerBounds(sections, i, minLen);
  if (lo > hi) return sections;
  const at = round2(clamp(t, lo, hi));
  return sections.map((s, idx) => {
    if (idx === i - 1) return { ...s, end: at };
    if (idx === i) return { ...s, start: at };
    return s;
  });
}

/**
 * Handle a pointer drag-end. `pointer` is an index into pointerPositions():
 * edges (0 or n) spawn a new boundary at the drop point; inner pointers move.
 */
export function dropPointer(
  sections: TimelineSection[],
  pointer: number,
  t: number,
  newId: IdFactory = defaultId,
  minLen = MIN_SECTION_SECONDS,
): TimelineSection[] {
  const n = sections.length;
  if (pointer === 0 || pointer === n) {
    const duration = totalDuration(sections);
    return splitAt(sections, clamp(t, 0, duration), newId, minLen);
  }
  return moveBoundary(sections, pointer, t, minLen);
}

/** Remove inner pointer `i`, merging its two neighbours. The merged section keeps the left character. */
export function removeBoundary(sections: TimelineSection[], i: number): TimelineSection[] {
  if (i <= 0 || i >= sections.length) return sections;
  const left = sections[i - 1]!;
  const right = sections[i]!;
  const merged: TimelineSection = { ...left, end: right.end, character_id: left.character_id ?? right.character_id };
  return [...sections.slice(0, i - 1), merged, ...sections.slice(i + 1)];
}

/** Merge adjacent sections that share the same (non-null) character. */
export function mergeAdjacent(sections: TimelineSection[]): TimelineSection[] {
  const out: TimelineSection[] = [];
  for (const s of sections) {
    const last = out[out.length - 1];
    if (last && s.character_id !== null && last.character_id === s.character_id) {
      out[out.length - 1] = {
        ...last,
        end: s.end,
        dialogue: [last.dialogue, s.dialogue].filter(Boolean).join(' ') || undefined,
      };
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

export function assignCharacter(
  sections: TimelineSection[],
  sectionId: string,
  characterId: string | null,
): TimelineSection[] {
  return mergeAdjacent(sections.map((s) => (s.id === sectionId ? { ...s, character_id: characterId } : s)));
}

export function setDialogue(sections: TimelineSection[], sectionId: string, dialogue: string): TimelineSection[] {
  return sections.map((s) => (s.id === sectionId ? { ...s, dialogue: dialogue || undefined } : s));
}

/** Unassign every section of a deleted character, then re-merge. */
export function removeCharacterFromTimeline(sections: TimelineSection[], characterId: string): TimelineSection[] {
  return mergeAdjacent(sections.map((s) => (s.character_id === characterId ? { ...s, character_id: null } : s)));
}

/**
 * Fit a timeline to a new duration (after re-trimming). Sections past the new end are dropped,
 * the last section is stretched/shrunk to end exactly at `duration`.
 */
export function fitToDuration(
  sections: TimelineSection[],
  duration: number,
  newId: IdFactory = defaultId,
  minLen = MIN_SECTION_SECONDS,
): TimelineSection[] {
  const d = round2(duration);
  const kept = sections.filter((s) => s.start <= d - minLen);
  if (kept.length === 0) return createTimeline(d, newId);
  const last = kept[kept.length - 1]!;
  kept[kept.length - 1] = { ...last, end: d };
  return kept;
}

export interface TimelineValidation {
  valid: boolean;
  errors: string[];
  unmappedCount: number;
}

export function validateTimeline(
  sections: TimelineSection[],
  duration: number,
  characters: ClipCharacter[],
  minLen = MIN_SECTION_SECONDS,
): TimelineValidation {
  const errors: string[] = [];
  const charIds = new Set(characters.map((c) => c.id));
  const eps = 0.011;

  if (sections.length === 0) errors.push('Timeline is empty.');
  if (characters.length < 1 || characters.length > 4) errors.push('A clip needs between 1 and 4 characters.');
  if (new Set(characters.map((c) => c.id)).size !== characters.length) errors.push('Character ids must be unique.');

  const ids = new Set<string>();
  let unmappedCount = 0;
  sections.forEach((s, i) => {
    if (ids.has(s.id)) errors.push(`Duplicate section id ${s.id}.`);
    ids.add(s.id);
    if (i === 0 && Math.abs(s.start) > eps) errors.push('Timeline must start at 0.');
    if (i > 0 && Math.abs(s.start - sections[i - 1]!.end) > eps) errors.push(`Section ${i + 1} is not contiguous.`);
    if (s.end - s.start < minLen - eps) errors.push(`Section ${i + 1} is shorter than ${minLen}s.`);
    if (s.character_id === null) unmappedCount++;
    else if (!charIds.has(s.character_id)) errors.push(`Section ${i + 1} uses an unknown character.`);
  });
  if (sections.length && Math.abs(totalDuration(sections) - duration) > eps) {
    errors.push('Timeline must end at the clip end.');
  }
  if (unmappedCount > 0) errors.push(`${unmappedCount} section(s) still unmapped (grey).`);
  const used = new Set(sections.map((s) => s.character_id).filter(Boolean));
  const unused = characters.filter((c) => !used.has(c.id));
  if (unused.length) errors.push(`Unused character(s): ${unused.map((c) => c.name).join(', ')}.`);

  return { valid: errors.length === 0, errors, unmappedCount };
}
