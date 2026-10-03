import {
  assignCharacter,
  createTimeline,
  dropPointer,
  fitToDuration,
  mergeAdjacent,
  moveBoundary,
  pointerPositions,
  removeBoundary,
  removeCharacterFromTimeline,
  splitAt,
  validateTimeline,
} from '@/lib/timeline';
import type { ClipCharacter, TimelineSection } from '@/types/database';

const chars: ClipCharacter[] = [
  { id: 'A', name: 'Character A', color: '#ef4444' },
  { id: 'B', name: 'Character B', color: '#3b82f6' },
  { id: 'C', name: 'Character C', color: '#22c55e' },
];

function ids() {
  let n = 0;
  return () => `s${++n}`;
}

describe('timeline pointer mechanics', () => {
  it('starts as one grey section with pointers at 0 and the end', () => {
    const t = createTimeline(20, ids());
    expect(t).toEqual([{ id: 's1', start: 0, end: 20, character_id: null }]);
    expect(pointerPositions(t)).toEqual([0, 20]);
  });

  it('follows the spec example: 20s clip mapped to A(0-7) B(7-13) C(13-20)', () => {
    const newId = ids();
    let t = createTimeline(20, newId);
    // drag right edge pointer from 20 to 7 -> a new pointer spawns at 20
    t = dropPointer(t, 1, 7, newId);
    expect(pointerPositions(t)).toEqual([0, 7, 20]);
    expect(t.every((s) => s.character_id === null)).toBe(true);
    t = assignCharacter(t, t[0]!.id, 'A');
    // drag the right edge again from 20 to 13
    t = dropPointer(t, 2, 13, newId);
    expect(pointerPositions(t)).toEqual([0, 7, 13, 20]);
    expect(t.map((s) => s.character_id)).toEqual(['A', null, null]);
    expect(validateTimeline(t, 20, chars).valid).toBe(false);
    t = assignCharacter(t, t[1]!.id, 'B');
    t = assignCharacter(t, t[2]!.id, 'C');
    expect(t.map((s) => [s.start, s.end, s.character_id])).toEqual([
      [0, 7, 'A'],
      [7, 13, 'B'],
      [13, 20, 'C'],
    ]);
    expect(validateTimeline(t, 20, chars)).toEqual({ valid: true, errors: [], unmappedCount: 0 });
  });

  it('dragging the left edge inward spawns a boundary too', () => {
    const t = dropPointer(createTimeline(20, ids()), 0, 4, ids());
    expect(pointerPositions(t)).toEqual([0, 4, 20]);
  });

  it('moves inner pointers without crossing neighbours and respects the 0.5s minimum', () => {
    let t = splitAt(splitAt(createTimeline(20, ids()), 7, ids()), 13, () => 'x');
    t = moveBoundary(t, 1, 15); // would cross pointer at 13
    expect(pointerPositions(t)).toEqual([0, 12.5, 13, 20]);
    t = moveBoundary(t, 1, -5);
    expect(pointerPositions(t)).toEqual([0, 0.5, 13, 20]);
  });

  it('refuses splits that would create a section shorter than 0.5s', () => {
    const t = createTimeline(20, ids());
    expect(splitAt(t, 0.2)).toBe(t);
    expect(splitAt(t, 19.9)).toBe(t);
  });

  it('merges adjacent sections with the same character', () => {
    const t: TimelineSection[] = [
      { id: 'a', start: 0, end: 5, character_id: 'A' },
      { id: 'b', start: 5, end: 9, character_id: null },
      { id: 'c', start: 9, end: 20, character_id: 'B' },
    ];
    const merged = assignCharacter(t, 'b', 'A');
    expect(merged.map((s) => [s.id, s.start, s.end, s.character_id])).toEqual([
      ['a', 0, 9, 'A'],
      ['c', 9, 20, 'B'],
    ]);
  });

  it('does not merge adjacent unmapped sections', () => {
    const t: TimelineSection[] = [
      { id: 'a', start: 0, end: 5, character_id: null },
      { id: 'b', start: 5, end: 9, character_id: null },
    ];
    expect(mergeAdjacent(t)).toHaveLength(2);
  });

  it('removes a boundary, keeping the left character', () => {
    const t: TimelineSection[] = [
      { id: 'a', start: 0, end: 5, character_id: 'A' },
      { id: 'b', start: 5, end: 9, character_id: 'B' },
    ];
    expect(removeBoundary(t, 1)).toEqual([{ id: 'a', start: 0, end: 9, character_id: 'A' }]);
  });

  it('unassigns sections when a character is deleted', () => {
    const t: TimelineSection[] = [
      { id: 'a', start: 0, end: 5, character_id: 'A' },
      { id: 'b', start: 5, end: 9, character_id: 'B' },
    ];
    expect(removeCharacterFromTimeline(t, 'B').map((s) => s.character_id)).toEqual(['A', null]);
  });

  it('fits to a shorter duration after re-trimming', () => {
    const t: TimelineSection[] = [
      { id: 'a', start: 0, end: 7, character_id: 'A' },
      { id: 'b', start: 7, end: 13, character_id: 'B' },
      { id: 'c', start: 13, end: 20, character_id: 'C' },
    ];
    expect(fitToDuration(t, 10).map((s) => [s.start, s.end])).toEqual([
      [0, 7],
      [7, 10],
    ]);
  });

  it.each([60, 300, 600])('handles long clips (%ds) with many sections', (duration) => {
    const newId = ids();
    let t = createTimeline(duration, newId);
    for (let s = 5; s < duration; s += 5) t = dropPointer(t, t.length, s, newId);
    expect(t).toHaveLength(duration / 5);
    t = t.reduce((acc, s, i) => assignCharacter(acc, s.id, chars[i % 3]!.id), t);
    expect(validateTimeline(t, duration, chars).valid).toBe(true);
  });

  it('reports unknown characters, gaps and unused characters', () => {
    const t: TimelineSection[] = [
      { id: 'a', start: 0, end: 5, character_id: 'Z' },
      { id: 'b', start: 6, end: 20, character_id: 'A' },
    ];
    const v = validateTimeline(t, 20, chars);
    expect(v.valid).toBe(false);
    expect(v.errors.join(' ')).toMatch(/unknown character/);
    expect(v.errors.join(' ')).toMatch(/not contiguous/);
    expect(v.errors.join(' ')).toMatch(/Unused character/);
  });
});
