/** Typed fetch wrapper for the browser. Attaches the Firebase ID token and refreshes it on 401. */
import type { ApiErrorBody } from '@/types/api';
import { getIdToken } from './auth';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Attach Authorization header (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

const FRIENDLY: Record<number, string> = {
  401: 'Your session expired. Please log in again.',
  403: "You don't have permission to do that.",
  404: 'Not found.',
  429: 'Too many requests. Slow down a little.',
  500: 'Server error. Please try again.',
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}${path.includes('?') ? '&' : '?'}${s}` : path;
}

async function doFetch(path: string, opts: RequestOptions, forceRefresh: boolean): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const token = await getIdToken(forceRefresh).catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(path, opts, false);
    // Token may have expired between checks: force a refresh and retry exactly once.
    if (res.status === 401 && opts.auth !== false) res = await doFetch(path, opts, true);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'network_error', 'Network error. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const e = json?.error;
    throw new ApiClientError(res.status, e?.code ?? 'http_error', e?.message ?? FRIENDLY[res.status] ?? `Request failed (${res.status}).`, e?.details);
  }
  return json as T;
}

export const apiGet = <T>(path: string, query?: RequestOptions['query']) => api<T>(path, { query });
export const apiPost = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const apiPut = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const apiPatch = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
