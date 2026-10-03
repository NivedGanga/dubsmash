/** Game-side helpers: turning a clip timeline + lobby players into an ordered recording plan. */
import type { ClipCharacter, SessionPlayer, TimelineSection } from '@/types/database';
import type { Sequence } from '@/types/game';

/** Ordered recordable sequences. Every section is a sequence; owner is the player holding its character. */
export function buildSequences(
  timeline: TimelineSection[],
  characters: ClipCharacter[],
  players: SessionPlayer[],
): Sequence[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  return [...timeline]
    .sort((a, b) => a.start - b.start)
    .filter((s) => s.character_id && byId.has(s.character_id))
    .map((s, index) => ({
      ...s,
      index,
      character: byId.get(s.character_id!)!,
      user_id: players.find((p) => p.character_ids.includes(s.character_id!))?.user_id ?? null,
    }));
}

/**
 * Round-robin character assignment in join order. With fewer players than characters some players
 * voice several characters (enables solo play); extra players beyond the character count get none.
 */
export function autoAssignCharacters(characters: ClipCharacter[], players: SessionPlayer[]): SessionPlayer[] {
  if (players.length === 0) return players;
  const next = players.map((p) => ({ ...p, character_ids: [] as string[] }));
  characters.forEach((c, i) => next[i % next.length]!.character_ids.push(c.id));
  return next;
}

/** All characters covered by exactly one player. */
export function assignmentComplete(characters: ClipCharacter[], players: SessionPlayer[]): boolean {
  return characters.every((c) => players.filter((p) => p.character_ids.includes(c.id)).length === 1);
}
