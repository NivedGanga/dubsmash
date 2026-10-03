import { assignmentComplete, autoAssignCharacters, buildSequences, nextUnrecordedIndex } from '@/lib/sequences';
import type { ClipCharacter, SessionPlayer } from '@/types/database';

const chars: ClipCharacter[] = [
  { id: 'A', name: 'A', color: '#ef4444' },
  { id: 'B', name: 'B', color: '#3b82f6' },
  { id: 'C', name: 'C', color: '#22c55e' },
];

const player = (id: string): SessionPlayer => ({
  user_id: id,
  username: id,
  display_name: id,
  avatar_model: 'casual_m',
  avatar_color: '#ffffff',
  avatar_outfit: 'tee',
  character_ids: [],
  ready: false,
  joined_at: new Date().toISOString(),
});

describe('sequences', () => {
  it('auto-assigns round robin; a solo player voices everyone', () => {
    expect(autoAssignCharacters(chars, [player('p1')])[0]!.character_ids).toEqual(['A', 'B', 'C']);
    const two = autoAssignCharacters(chars, [player('p1'), player('p2')]);
    expect(two.map((p) => p.character_ids)).toEqual([['A', 'C'], ['B']]);
    expect(assignmentComplete(chars, two)).toBe(true);
    expect(assignmentComplete(chars, [player('p1')])).toBe(false);
  });

  it('orders sequences by time and resolves owners', () => {
    const players = autoAssignCharacters(chars, [player('p1'), player('p2'), player('p3')]);
    const seq = buildSequences(
      [
        { id: 's3', start: 13, end: 20, character_id: 'C' },
        { id: 's1', start: 0, end: 7, character_id: 'A' },
        { id: 's2', start: 7, end: 13, character_id: 'B' },
      ],
      chars,
      players,
    );
    expect(seq.map((s) => [s.index, s.id, s.user_id])).toEqual([
      [0, 's1', 'p1'],
      [1, 's2', 'p2'],
      [2, 's3', 'p3'],
    ]);
  });

  it('finds the next unrecorded sequence, wrapping around', () => {
    const seq = buildSequences(
      [
        { id: 'a', start: 0, end: 1, character_id: 'A' },
        { id: 'b', start: 1, end: 2, character_id: 'B' },
        { id: 'c', start: 2, end: 3, character_id: 'C' },
      ],
      chars,
      [],
    );
    expect(nextUnrecordedIndex(seq, new Set(['a']), 1)).toBe(1);
    expect(nextUnrecordedIndex(seq, new Set(['b', 'c']), 2)).toBe(0);
    expect(nextUnrecordedIndex(seq, new Set(['a', 'b', 'c']))).toBeNull();
  });
});
