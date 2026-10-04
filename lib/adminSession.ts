/**
 * Admin-portal session: a signed token issued by /api/admin/login, stored in localStorage.
 * Completely separate from the game's Firebase session — clearing one never affects the other.
 */

const KEY = 'dubsmash_admin_token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
}
