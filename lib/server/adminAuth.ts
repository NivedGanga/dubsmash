import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { NextApiRequest } from 'next';
import type { AdminAccountRow } from '@/types/database';
import { ApiError, forbidden, unauthorized } from './handler';
import { requireEnv } from './env';
import { supabaseAdmin } from './supabase';

/**
 * Admin-portal authentication — entirely separate from Firebase/game users.
 * Admins register with email + password (bcrypt hash in admin_accounts); login returns a
 * signed session token sent as `Authorization: Admin <token>`. Only 'active' accounts
 * pass requireAdminAccount; pending accounts wait for a super admin's approval.
 */

const TOKEN_TTL = '12h';
const BCRYPT_ROUNDS = 10;

export const hashAdminPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyAdminPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

function secretKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('ADMIN_SESSION_SECRET'));
}

export async function signAdminToken(account: AdminAccountRow): Promise<string> {
  return new SignJWT({ role: account.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(account.id)
    .setIssuedAt()
    .setIssuer('dubsmash-admin')
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
}

export function adminToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Admin ')) return null;
  const token = header.slice(6).trim();
  return token || null;
}

export async function getAdminAccountById(id: string): Promise<AdminAccountRow | null> {
  const { data, error } = await supabaseAdmin().from('admin_accounts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as AdminAccountRow | null) ?? null;
}

export async function getAdminAccountByEmail(email: string): Promise<AdminAccountRow | null> {
  const { data, error } = await supabaseAdmin().from('admin_accounts').select('*').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return (data as AdminAccountRow | null) ?? null;
}

export async function superAdminAccounts(): Promise<Pick<AdminAccountRow, 'id' | 'email' | 'display_name'>[]> {
  const { data, error } = await supabaseAdmin()
    .from('admin_accounts')
    .select('id, email, display_name')
    .eq('role', 'super_admin')
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as Pick<AdminAccountRow, 'id' | 'email' | 'display_name'>[];
}

/** Fields safe to send to the browser (never password_hash). */
export function toPublicAdminAccount(a: AdminAccountRow) {
  return {
    id: a.id,
    email: a.email,
    display_name: a.display_name,
    role: a.role,
    status: a.status,
    created_at: a.created_at,
  };
}

export async function verifyAdminToken(token: string): Promise<AdminAccountRow | null> {
  let sub: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'dubsmash-admin' });
    if (!payload.sub) return null;
    sub = payload.sub;
  } catch {
    return null;
  }
  return getAdminAccountById(sub);
}

/** Middleware for createHandler's `adminAuth` option: resolves an *active* admin account. */
export async function requireAdminAccount(req: NextApiRequest): Promise<AdminAccountRow | null> {
  const token = adminToken(req);
  if (!token) return null;
  const account = await verifyAdminToken(token);
  if (!account) throw unauthorized('Your admin session is invalid or expired. Please log in again.');
  if (account.status === 'banned') throw forbidden('This admin account has been suspended.');
  if (account.status === 'pending') throw new ApiError(403, 'pending_approval', 'Your admin account is waiting for super admin approval.');
  if (account.status !== 'active') throw forbidden('This admin account is not active.');
  return account;
}

export async function requireSuperAdminAccount(req: NextApiRequest): Promise<AdminAccountRow | null> {
  const account = await requireAdminAccount(req);
  if (!account) return null;
  if (account.role !== 'super_admin') throw forbidden('Only the super admin can do that.');
  return account;
}
