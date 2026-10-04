#!/usr/bin/env node
/**
 * Validates migrations/*.sql + scripts/seed-flags.sql against an in-process Postgres (PGlite, WASM).
 * No Docker or Supabase project needed. Checks: clean apply, idempotent re-apply, and behaviour of
 * the key constraints, triggers and RPC functions. Run: npm run validate-migrations
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite({ extensions: { pgcrypto } });
const q = async (sql, params) => (await db.query(sql, params)).rows;
const rejects = async (sql, params, label) => {
  await assert.rejects(() => db.query(sql, params), `${label} should be rejected`);
};

try {
  // Roles that exist on every Supabase project.
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const files = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  const all = [...files.map((f) => `migrations/${f}`), 'scripts/seed-flags.sql'];
  for (const f of all) await db.exec(readFileSync(join(root, f), 'utf8'));
  for (const f of all) await db.exec(readFileSync(join(root, f), 'utf8'));
  console.info(`✓ ${all.length} SQL files apply cleanly and idempotently`);

  const tables = await q(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
  assert.equal(tables[0].n, 12, 'expected 12 tables');
  const rls = await q(`select count(*)::int as n from pg_tables where schemaname = 'public' and not rowsecurity`);
  assert.equal(rls[0].n, 0, 'every table must have RLS enabled');
  console.info('✓ 12 tables, RLS enabled on all');

  const [u1] = await q(`select * from register_user('fb1','A@x.com','alice','Alice','user')`);
  const [u2] = await q(`select * from register_user('fb2','b@x.com','bob','Bob','user')`);
  assert.equal(u1.role, 'super_admin');
  assert.equal(u2.role, 'user');
  assert.equal(u1.email, 'a@x.com');
  await rejects(`select * from register_user('fb3','c@x.com','ALICE','A2','user')`, [], 'case-insensitive duplicate username');
  await rejects(`select * from register_user('fb4','d@x.com','x y','D','user')`, [], 'invalid username');
  console.info('✓ first user becomes super admin; usernames unique case-insensitively');

  const [a1] = await q(`select * from register_admin_account('Admin@x.com','hash','Root')`);
  const [a2] = await q(`select * from register_admin_account('mod@x.com','hash','Mod')`);
  assert.equal(a1.role, 'super_admin');
  assert.equal(a1.status, 'active');
  assert.equal(a1.email, 'admin@x.com');
  assert.equal(a2.role, 'admin');
  assert.equal(a2.status, 'pending');
  await rejects(`select * from register_admin_account('ADMIN@x.com','hash','Dup')`, [], 'case-insensitive duplicate admin email');
  console.info('✓ first admin account becomes active super admin; later signups stay pending');

  const [clip] = await q(
    `insert into clips (uploaded_by,title,cloudinary_public_id,original_video_url,duration_seconds) values ($1,'Test','pid','url',20) returning *`,
    [a1.id],
  );
  const [s] = await q(`insert into game_sessions (clip_id,created_by,players) values ($1,$2,$3) returning *`, [
    clip.id,
    u1.id,
    JSON.stringify([{ user_id: u1.id }, { user_id: u2.id }]),
  ]);
  await q(`insert into recordings (session_id,user_id,sequence_id,audio_url,cloudinary_public_id,duration_seconds) values ($1,$2,'s1','a','p',3)`, [s.id, u1.id]);
  await rejects(`insert into recordings (session_id,user_id,sequence_id,audio_url,cloudinary_public_id,duration_seconds) values ($1,$2,'s1','a','p',3)`, [s.id, u1.id], 'duplicate take for a sequence');
  await q(`update recordings set attempt = attempt + 1 where session_id=$1`, [s.id]);
  assert.equal((await q(`select total_recordings from users where id=$1`, [u1.id]))[0].total_recordings, 2);
  await q(`select record_game_completed($1)`, [s.id]);
  assert.deepEqual((await q(`select games_played from users order by created_at`)).map((r) => r.games_played), [1, 1]);
  console.info('✓ stats triggers and record_game_completed');

  await q(`insert into video_processing_queue (session_id, recordings) values ($1,'{}')`, [s.id]);
  const claimed = await q(`select * from claim_next_video_job()`);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, 'processing');
  assert.equal((await q(`select * from claim_next_video_job()`)).length, 0);
  await q(`update video_processing_queue set started_at = now() - interval '31 minutes'`);
  assert.equal((await q(`select * from claim_next_video_job()`)).length, 1, 'stale processing job is reclaimed');
  console.info('✓ claim_next_video_job is exclusive and reclaims stale jobs');

  await q(`insert into user_friends (user_id, friend_id) values ($1,$2)`, [u1.id, u2.id]);
  await rejects(`insert into user_friends (user_id, friend_id) values ($1,$2)`, [u2.id, u1.id], 'reverse friendship pair');
  await rejects(`insert into user_friends (user_id, friend_id) values ($1,$1)`, [u1.id], 'self friendship');
  console.info('✓ friendship constraints');

  await rejects(`update feature_flags set flag_value='{"rollout_percentage":150}' where flag_name='premium_avatars'`, [], 'percentage > 100');
  await q(`insert into feature_flags (flag_name, flag_type) values ('test_pct','percentage')`);
  assert.deepEqual((await q(`select flag_value from feature_flags where flag_name='test_pct'`))[0].flag_value, { rollout_percentage: 0 });
  assert.equal((await q(`select count(*)::int as n from feature_flags where flag_name <> 'test_pct'`))[0].n, 7);
  console.info('✓ feature flag seed (7 flags), defaults and value constraints');

  const [n] = await q(`insert into notifications (user_id,type,message) values ($1,'video_ready','hi') returning id`, [u1.id]);
  await q(`update notifications set is_read=true where id=$1`, [n.id]);
  assert.ok((await q(`select read_at from notifications where id=$1`, [n.id]))[0].read_at);
  console.info('✓ notification read_at trigger');

  const [c2] = await q(`select search_vector @@ websearch_to_tsquery('simple', 'test') as hit from clips where id=$1`, [clip.id]);
  assert.equal(c2.hit, true);
  console.info('✓ clip full-text search vector');
  console.info('All migration checks passed.');
} finally {
  await db.close();
}
