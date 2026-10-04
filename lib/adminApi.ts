/** Fetch wrapper for the admin portal. Sends `Authorization: Admin <token>`; never touches Firebase. */
import type { ApiErrorBody } from '@/types/api';
import { clearAdminToken, getAdminToken } from './adminSession';
import { ApiClientError, type RequestOptions } from './api';

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}${path.includes('?') ? '&' : '?'}${s}` : path;
}

const FRIENDLY: Record<number, string> = {
  401: 'Your admin session expired. Please log in again.',
  403: "You don't have permission to do that.",
  404: 'Not found.',
  429: 'Too many requests. Slow down a little.',
  500: 'Server error. Please try again.',
};

export async function adminApi<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAdminToken();
  if (token) headers.Authorization = `Admin ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'network_error', 'Network error. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const e = json?.error;
    if (res.status === 401) clearAdminToken(); // dead session: next navigation goes to /admin/login
    throw new ApiClientError(res.status, e?.code ?? 'http_error', e?.message ?? FRIENDLY[res.status] ?? `Request failed (${res.status}).`, e?.details);
  }
  return json as T;
}

export const adminGet = <T>(path: string, query?: RequestOptions['query']) => adminApi<T>(path, { query });
export const adminPost = <T>(path: string, body: unknown = {}) => adminApi<T>(path, { method: 'POST', body });
export const adminPut = <T>(path: string, body: unknown = {}) => adminApi<T>(path, { method: 'PUT', body });
export const adminPatch = <T>(path: string, body: unknown = {}) => adminApi<T>(path, { method: 'PATCH', body });
export const adminDelete = <T>(path: string) => adminApi<T>(path, { method: 'DELETE' });
