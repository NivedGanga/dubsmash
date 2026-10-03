import {
  __configureFlags,
  evaluateAllFlags,
  evaluateFlag,
  getFlag,
  isFeatureEnabled,
  toggleFlag,
  updateFlagValue,
  type FlagStore,
} from '@/lib/server/featureFlags';
import { rolloutBucket } from '@/lib/utils';
import type { FeatureFlagRow, FlagChangeLogRow } from '@/types/database';

function row(partial: Partial<FeatureFlagRow> & Pick<FeatureFlagRow, 'flag_name' | 'flag_type'>): FeatureFlagRow {
  return {
    id: partial.flag_name,
    description: '',
    is_enabled: true,
    is_critical: false,
    flag_value: {},
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function memoryStore(rows: FeatureFlagRow[]) {
  const data = new Map(rows.map((r) => [r.flag_name, r]));
  const logs: Omit<FlagChangeLogRow, 'id' | 'changed_at'>[] = [];
  const store: FlagStore & { gets: number } = {
    gets: 0,
    async get(name) {
      store.gets++;
      return data.get(name) ?? null;
    },
    async list() {
      return [...data.values()];
    },
    async update(name, patch) {
      const next = { ...data.get(name)!, ...patch };
      data.set(name, next);
      return next;
    },
    async log(entry) {
      logs.push(entry);
    },
    async history() {
      return [];
    },
  };
  return { store, logs };
}

describe('feature flags', () => {
  let clock = 0;
  beforeEach(() => {
    clock = 1_000_000;
  });

  it('caches for 5 minutes and refetches after expiry', async () => {
    const { store } = memoryStore([row({ flag_name: 'friend_system_enabled', flag_type: 'boolean' })]);
    __configureFlags({ store, clock: () => clock });
    await getFlag('friend_system_enabled');
    await getFlag('friend_system_enabled');
    expect(store.gets).toBe(1);
    clock += 5 * 60 * 1000 + 1;
    await getFlag('friend_system_enabled');
    expect(store.gets).toBe(2);
  });

  it('toggle clears the cache immediately and writes an audit log', async () => {
    const { store, logs } = memoryStore([row({ flag_name: 'super_admin_approval_required', flag_type: 'boolean' })]);
    __configureFlags({ store, clock: () => clock });
    expect(await isFeatureEnabled('super_admin_approval_required')).toBe(true);
    await toggleFlag('super_admin_approval_required', false, 'admin-1');
    expect(await isFeatureEnabled('super_admin_approval_required')).toBe(false);
    expect(logs).toEqual([
      {
        flag_name: 'super_admin_approval_required',
        old_value: { is_enabled: true, flag_value: {} },
        new_value: { is_enabled: false, flag_value: {} },
        changed_by: 'admin-1',
      },
    ]);
  });

  it('percentage flags bucket users deterministically', () => {
    const flag = row({ flag_name: 'new_recording_ui', flag_type: 'percentage', flag_value: { rollout_percentage: 25 } });
    const users = Array.from({ length: 2000 }, (_, i) => `user-${i}`);
    const enabled = users.filter((u) => evaluateFlag(flag, u));
    expect(enabled.length / users.length).toBeGreaterThan(0.2);
    expect(enabled.length / users.length).toBeLessThan(0.3);
    for (const u of enabled) expect(rolloutBucket('new_recording_ui', u)).toBeLessThan(25);
    expect(evaluateFlag(flag, null)).toBe(false);
    expect(evaluateFlag({ ...flag, flag_value: { rollout_percentage: 100 } }, null)).toBe(true);
    expect(evaluateFlag({ ...flag, flag_value: { rollout_percentage: 0 } }, 'user-1')).toBe(false);
    expect(evaluateFlag({ ...flag, is_enabled: false, flag_value: { rollout_percentage: 100 } }, 'u')).toBe(false);
  });

  it('user list flags only enable listed users', () => {
    const flag = row({ flag_name: 'video_effects_beta', flag_type: 'user_list', flag_value: { user_ids: ['u1'] } });
    expect(evaluateFlag(flag, 'u1')).toBe(true);
    expect(evaluateFlag(flag, 'u2')).toBe(false);
    expect(evaluateFlag(flag, undefined)).toBe(false);
  });

  it('falls back to restrictive defaults when the database fails', async () => {
    const failing: FlagStore = {
      get: () => Promise.reject(new Error('db down')),
      list: () => Promise.reject(new Error('db down')),
      update: () => Promise.reject(new Error('db down')),
      log: () => Promise.reject(new Error('db down')),
      history: () => Promise.reject(new Error('db down')),
    };
    __configureFlags({ store: failing, clock: () => clock });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await isFeatureEnabled('super_admin_approval_required')).toBe(true);
    expect(await isFeatureEnabled('new_recording_ui', 'u1')).toBe(false);
  });

  it('validates and normalises flag values', async () => {
    const { store } = memoryStore([
      row({ flag_name: 'premium_avatars', flag_type: 'percentage', flag_value: { rollout_percentage: 0 } }),
      row({ flag_name: 'video_effects_beta', flag_type: 'user_list', flag_value: { user_ids: [] } }),
    ]);
    __configureFlags({ store, clock: () => clock });
    await expect(updateFlagValue('premium_avatars', { rollout_percentage: 140 })).rejects.toThrow(/0-100/);
    expect((await updateFlagValue('premium_avatars', { rollout_percentage: 49.6 })).flag_value).toEqual({ rollout_percentage: 50 });
    expect((await updateFlagValue('video_effects_beta', { user_ids: [' a ', 'a', '', 'b'] })).flag_value).toEqual({ user_ids: ['a', 'b'] });
  });

  it('evaluates every known flag for a user', async () => {
    const { store } = memoryStore([]);
    __configureFlags({ store, clock: () => clock });
    const flags = await evaluateAllFlags('u1');
    expect(flags.super_admin_approval_required).toBe(true);
    expect(flags.new_recording_ui).toBe(false);
    expect(Object.keys(flags)).toHaveLength(7);
  });
});
