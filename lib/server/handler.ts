import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError, type ZodType } from 'zod';
import type { AdminAccountRow, UserRow } from '@/types/database';
import type { ApiErrorBody } from '@/types/api';
import { allowedOrigins } from './env';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Please sign in to continue.') => new ApiError(401, 'unauthorized', message);
export const forbidden = (message = "You don't have permission to do that.") => new ApiError(403, 'forbidden', message);
export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found.`);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);

export interface AuthedRequest extends NextApiRequest {
  user: UserRow;
}

/** Request carrying a resolved admin account (separate from game `user`). */
export interface AdminAuthedRequest extends NextApiRequest {
  admin: AdminAccountRow;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Handler<R> = (req: R, res: NextApiResponse) => Promise<unknown> | unknown;

/** Middleware wraps a handler; requireAuth lives in lib/middleware. */
export type Middleware = (req: NextApiRequest) => Promise<UserRow | null>;
/** Admin-portal middleware: resolves an admin_accounts row (see lib/server/adminAuth). */
export type AdminMiddleware = (req: NextApiRequest) => Promise<AdminAccountRow | null>;

interface HandlerOptions {
  /** Resolves the game user; when provided, handlers receive AuthedRequest. */
  auth?: Middleware;
  /** Resolves the admin account; when provided, handlers receive AdminAuthedRequest. */
  adminAuth?: AdminMiddleware;
}

function applyCors(req: NextApiRequest, res: NextApiResponse): boolean {
  const origin = req.headers.origin?.replace(/\/$/, '');
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const sameOrigin = !!host && (origin === `https://${host}` || origin === `http://${host}`);
  if (sameOrigin) return true;
  if (!allowedOrigins().includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

/** Postgres error codes surfaced by PostgREST, e.g. 23505 unique_violation. */
export function isPgError(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;
}

function sendError(res: NextApiResponse, err: unknown): void {
  let status = 500;
  let body: ApiErrorBody = { error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } };
  if (err instanceof ApiError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    const first = err.issues[0];
    body = {
      error: {
        code: 'validation_error',
        message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  } else if (isPgError(err, '23505')) {
    status = 409;
    body = { error: { code: 'conflict', message: 'That already exists.' } };
  } else if (isPgError(err, '23503') || isPgError(err, '23514') || isPgError(err, '22P02')) {
    status = 400;
    body = { error: { code: 'bad_request', message: 'Invalid reference or value.' } };
  } else {
    console.error('[api] unhandled error', err);
  }
  if (!res.headersSent) res.status(status).json(body);
}

/**
 * Wraps an API route: method dispatch, CORS (allow-list), auth middleware, consistent JSON errors.
 *
 *   export default createHandler({ GET: async (req) => ({ ok: true }) }, { auth: requireAuth });
 *
 * Returning a value sends it as JSON with 200 (or set res.status() first). Returning undefined after
 * writing the response yourself is also fine.
 */
export function createHandler<R extends NextApiRequest = AuthedRequest>(
  handlers: Partial<Record<Method, Handler<R>>>,
  options: HandlerOptions = {},
) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (!applyCors(req, res)) {
      res.status(403).json({ error: { code: 'cors', message: 'Origin not allowed.' } });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    const fn = handlers[req.method as Method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      res.status(405).json({ error: { code: 'method_not_allowed', message: `Method ${req.method} not allowed.` } });
      return;
    }
    try {
      if (options.auth) {
        const user = await options.auth(req);
        if (!user) throw unauthorized();
        (req as AuthedRequest).user = user;
      }
      if (options.adminAuth) {
        const admin = await options.adminAuth(req);
        if (!admin) throw unauthorized();
        (req as AdminAuthedRequest).admin = admin;
      }
      const result = await fn(req as R, res);
      if (!res.headersSent && !res.writableEnded) {
        if (result === undefined) res.status(204).end();
        else res.status(res.statusCode || 200).json(result);
      }
    } catch (err) {
      sendError(res, err);
    }
  };
}

export function parseBody<T>(schema: ZodType<T>, req: NextApiRequest): T {
  return schema.parse(req.body ?? {});
}

export function parseQuery<T>(schema: ZodType<T>, req: NextApiRequest): T {
  return schema.parse(req.query);
}

/** Single string query param (Next gives string | string[]). */
export function queryParam(req: NextApiRequest, name: string): string {
  const v = req.query[name];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) throw badRequest(`Missing ${name}.`);
  return s;
}
