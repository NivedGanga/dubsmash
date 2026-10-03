/**
 * Portal session scoping: the same Firebase account can act as a player (game portal) or a clip
 * manager (admin portal), but a *session* belongs to exactly one portal. Signing in through a
 * portal's login page stamps the portal here; the guards in useRequireAuth bounce sessions that
 * try to cross over without going through the other portal's login.
 */
export type Portal = 'game' | 'admin';

const KEY = 'dubsmash_portal';

export function getPortal(): Portal | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(KEY);
  return v === 'admin' || v === 'game' ? v : null;
}

export function setPortal(portal: Portal): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, portal);
}

export function clearPortal(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
}
