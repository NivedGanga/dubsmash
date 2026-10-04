import type { NextApiRequest } from 'next';
import type { AdminAccountRow } from '@/types/database';
import { ApiError } from '@/lib/server/handler';
import { __setSupabaseAdmin } from '@/lib/server/supabase';
import {
  getAdminAccountByEmail,
  hashAdminPassword,
  requireAdminAccount,
  signAdminToken,
  toPublicAdminAccount,
  verifyAdminPassword,
  verifyAdminToken,
} from '@/lib/server/adminAuth';
import { FakeDb } from './helpers/fakeSupabase';

const SECRET = 'test-admin-secret';

const account = (over: Partial<AdminAccountRow> = {}): AdminAccountRow => ({
  id: '11111111-1111-1111-1111-111111111111',
  email: 'root@x.com',
  password_hash: 'hashed',
  display_name: 'Root',
  role: 'super_admin',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
});

const reqWith = (authorization?: string) => ({ headers: { authorization } }) as unknown as NextApiRequest;

let db: FakeDb;

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
  db = new FakeDb();
  __setSupabaseAdmin(db.client() as never);
});

describe('admin password hashing', () => {
  it('round-trips and rejects wrong passwords', async () => {
    const hash = await hashAdminPassword('hunter2hunter');
    expect(hash).not.toBe('hunter2hunter');
    await expect(verifyAdminPassword('hunter2hunter', hash)).resolves.toBe(true);
    await expect(verifyAdminPassword('wrong', hash)).resolves.toBe(false);
  });
});

describe('admin session tokens', () => {
  it('signs and verifies a token for an active account', async () => {
    const a = account();
    db.table('admin_accounts').push(a);
    const token = await signAdminToken(a);
    await expect(verifyAdminToken(token)).resolves.toMatchObject({ id: a.id, email: a.email });
  });

  it('rejects a token signed with a different secret', async () => {
    const a = account();
    db.table('admin_accounts').push(a);
    const token = await signAdminToken(a);
    process.env.ADMIN_SESSION_SECRET = 'other-secret';
    await expect(verifyAdminToken(token)).resolves.toBeNull();
  });

  it('rejects a tampered token and a token for a deleted account', async () => {
    const a = account();
    db.table('admin_accounts').push(a);
    const token = await signAdminToken(a);
    await expect(verifyAdminToken(`${token}x`)).resolves.toBeNull();
    db.tables.set('admin_accounts', []);
    await expect(verifyAdminToken(token)).resolves.toBeNull();
  });
});

describe('requireAdminAccount middleware', () => {
  it('returns null without a header and resolves active admins', async () => {
    const a = account();
    db.table('admin_accounts').push(a);
    await expect(requireAdminAccount(reqWith())).resolves.toBeNull();
    await expect(requireAdminAccount(reqWith('Bearer firebase-token'))).resolves.toBeNull();
    await expect(requireAdminAccount(reqWith(`Admin ${await signAdminToken(a)}`))).resolves.toMatchObject({ id: a.id });
  });

  it('blocks pending and banned accounts with meaningful errors', async () => {
    const pending = account({ id: '22222222-2222-2222-2222-222222222222', role: 'admin', status: 'pending' });
    const banned = account({ id: '33333333-3333-3333-3333-333333333333', status: 'banned' });
    db.table('admin_accounts').push(pending, banned);

    await expect(requireAdminAccount(reqWith(`Admin ${await signAdminToken(pending)}`))).rejects.toMatchObject({
      status: 403,
      code: 'pending_approval',
    });
    await expect(requireAdminAccount(reqWith(`Admin ${await signAdminToken(banned)}`))).rejects.toBeInstanceOf(ApiError);
    await expect(requireAdminAccount(reqWith('Admin garbage'))).rejects.toBeInstanceOf(ApiError);
  });
});

describe('admin accounts', () => {
  it('finds accounts case-insensitively by email and strips the hash for clients', async () => {
    db.table('admin_accounts').push(account());
    await expect(getAdminAccountByEmail('ROOT@X.COM')).resolves.toMatchObject({ display_name: 'Root' });
    const pub = toPublicAdminAccount(account());
    expect(pub).not.toHaveProperty('password_hash');
    expect(pub).toMatchObject({ email: 'root@x.com', role: 'super_admin', status: 'active' });
  });
});
