import { backoffDelay, fnv1a, formatDuration, formatTimecode, isUuid, isValidUsername, randomUsername, timeAgo } from '@/lib/utils';

describe('utils', () => {
  it('hashes deterministically', () => {
    expect(fnv1a('hello')).toBe(fnv1a('hello'));
    expect(fnv1a('hello')).not.toBe(fnv1a('hellp'));
    expect(fnv1a('')).toBe(0x811c9dc5);
  });

  it('validates usernames', () => {
    expect(isValidUsername('Player_1')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('has space')).toBe(false);
    expect(isValidUsername('x'.repeat(21))).toBe(false);
  });

  it('generates fallback usernames matching the username rules', () => {
    const name = randomUsername(() => 0.5);
    expect(name).toBe('Player_5500');
    expect(isValidUsername(name)).toBe(true);
  });

  it('formats durations', () => {
    expect(formatDuration(75.4)).toBe('1:15');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatTimecode(7.25)).toBe('0:07.2');
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-01-01T12:00:00Z');
    expect(timeAgo('2026-01-01T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-01-01T11:00:00Z', now)).toBe('1h ago');
  });

  it('backs off exponentially with a cap', () => {
    expect([0, 1, 2, 3].map((a) => backoffDelay(a))).toEqual([2000, 4000, 8000, 16000]);
    expect(backoffDelay(30)).toBe(5 * 60 * 1000);
  });

  it('validates uuids', () => {
    expect(isUuid('7f9c2ba4-e88f-11ea-adc1-0242ac120002')).toBe(true);
    expect(isUuid('nope')).toBe(false);
  });
});
