/** Shared helpers, safe for both browser and server. */

/** 32-bit FNV-1a hash. Stable across runtimes, used for percentage rollouts. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic bucket 0-99 for a user within a flag. The flag name is part of the key so that
 * different rollouts select independent user populations.
 */
export function rolloutBucket(flagName: string, userId: string): number {
  return fnv1a(`${flagName}:${userId}`) % 100;
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Fallback username for users who skip the username step, e.g. Player_4821. */
export function randomUsername(random: () => number = Math.random): string {
  return `Player_${1000 + Math.floor(random() * 9000)}`;
}

/** Short random id for client-generated entities (timeline sections, characters). */
export function shortId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to 2 decimals (10ms precision), avoiding float drift in timeline math. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 75.4 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 7.25 -> "0:07.2" — used on the timeline where sub-second precision matters. */
export function formatTimecode(seconds: number): string {
  const whole = Math.floor(Math.max(0, seconds));
  const tenths = Math.floor((Math.max(0, seconds) - whole) * 10);
  return `${formatDuration(whole)}.${tenths}`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const DEFAULT_CHARACTER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'] as const;
export const UNMAPPED_COLOR = '#6b7280';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff: 2s, 4s, 8s, 16s ... capped at maxMs (default 5 minutes). */
export function backoffDelay(attempt: number, baseMs = 2000, maxMs = 5 * 60 * 1000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
