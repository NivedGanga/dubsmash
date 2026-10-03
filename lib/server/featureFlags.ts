import type { FeatureFlagRow, FlagChangeLogRow, FlagValue } from '@/types/database';
import { FLAG_DEFAULTS, FLAG_NAMES, isFlagName, type EvaluatedFlags, type FlagName } from '@/types/flags';
import { rolloutBucket } from '@/lib/utils';
import { supabaseAdmin } from './supabase';

/** Minimal data-access surface, injectable for tests. */
export interface FlagStore {
  get(flagName: string): Promise<FeatureFlagRow | null>;
  list(): Promise<FeatureFlagRow[]>;
  update(flagName: string, patch: Partial<Pick<FeatureFlagRow, 'is_enabled' | 'flag_value'>>): Promise<FeatureFlagRow>;
  log(entry: Omit<FlagChangeLogRow, 'id' | 'changed_at'>): Promise<void>;
  history(flagName: string, limit: number): Promise<FlagChangeLogRow[]>;
}

export const supabaseFlagStore: FlagStore = {
  async get(flagName) {
    const { data, error } = await supabaseAdmin().from('feature_flags').select('*').eq('flag_name', flagName).maybeSingle();
    if (error) throw error;
    return data as FeatureFlagRow | null;
  },
  async list() {
    const { data, error } = await supabaseAdmin().from('feature_flags').select('*').order('flag_name');
    if (error) throw error;
    return (data ?? []) as FeatureFlagRow[];
  },
  async update(flagName, patch) {
    const { data, error } = await supabaseAdmin()
      .from('feature_flags')
      .update(patch)
      .eq('flag_name', flagName)
      .select('*')
      .single();
    if (error) throw error;
    return data as FeatureFlagRow;
  },
  async log(entry) {
    const { error } = await supabaseAdmin().from('flag_change_log').insert(entry);
    if (error) throw error;
  },
  async history(flagName, limit) {
    const { data, error } = await supabaseAdmin()
      .from('flag_change_log')
      .select('*')
      .eq('flag_name', flagName)
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as FlagChangeLogRow[];
  },
};

/** 5 minutes, per spec. Override with FLAG_CACHE_TTL_MS (e.g. lower it if you run many instances). */
const TTL_MS = Number(process.env.FLAG_CACHE_TTL_MS) || 5 * 60 * 1000;

type CachedFlag = Pick<FeatureFlagRow, 'flag_name' | 'flag_type' | 'is_enabled' | 'flag_value'>;
const cache = new Map<string, { value: CachedFlag; expires: number }>();
let store: FlagStore = supabaseFlagStore;
let now: () => number = Date.now;

const cacheKey = (flagName: string) => `flag:${flagName}`;

export function clearFlagCache(flagName?: string): void {
  if (flagName) cache.delete(cacheKey(flagName));
  else cache.clear();
}

/** For tests. */
export function __configureFlags(opts: { store?: FlagStore; clock?: () => number }): void {
  if (opts.store) store = opts.store;
  if (opts.clock) now = opts.clock;
  cache.clear();
}

/**
 * Fetch a flag's configuration, served from a 5-minute in-memory cache. If the database is
 * unreachable, fall back to the safe built-in default (not cached, so recovery is immediate).
 */
export async function getFlag(flagName: string): Promise<CachedFlag | null> {
  const key = cacheKey(flagName);
  const hit = cache.get(key);
  if (hit && hit.expires > now()) return hit.value;
  try {
    const row = await store.get(flagName);
    const value: CachedFlag | null = row
      ? { flag_name: row.flag_name, flag_type: row.flag_type, is_enabled: row.is_enabled, flag_value: row.flag_value ?? {} }
      : isFlagName(flagName)
        ? FLAG_DEFAULTS[flagName]
        : null;
    if (value) cache.set(key, { value, expires: now() + TTL_MS });
    return value;
  } catch (err) {
    console.error(`[flags] failed to load ${flagName}, using default`, err);
    return isFlagName(flagName) ? FLAG_DEFAULTS[flagName] : null;
  }
}

/** Pure evaluation of a flag for a user (exported for tests). */
export function evaluateFlag(flag: CachedFlag | null, userId?: string | null): boolean {
  if (!flag || !flag.is_enabled) return false;
  switch (flag.flag_type) {
    case 'boolean':
      return true;
    case 'percentage': {
      const pct = Math.max(0, Math.min(100, Number(flag.flag_value.rollout_percentage ?? 0)));
      if (pct >= 100) return true;
      if (!userId || pct <= 0) return false;
      return rolloutBucket(flag.flag_name, userId) < pct;
    }
    case 'user_list':
      return !!userId && (flag.flag_value.user_ids ?? []).includes(userId);
    default:
      return false;
  }
}

export async function isFeatureEnabled(flagName: FlagName, userId?: string | null): Promise<boolean> {
  return evaluateFlag(await getFlag(flagName), userId);
}

/** All known flags evaluated for one user, for the client (/api/auth/me). */
export async function evaluateAllFlags(userId?: string | null): Promise<EvaluatedFlags> {
  const entries = await Promise.all(FLAG_NAMES.map(async (name) => [name, await isFeatureEnabled(name, userId)] as const));
  return Object.fromEntries(entries) as EvaluatedFlags;
}

export function validateFlagValue(row: Pick<FeatureFlagRow, 'flag_type'>, value: FlagValue): string | null {
  if (row.flag_type === 'percentage') {
    const pct = value.rollout_percentage;
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) return 'rollout_percentage must be 0-100.';
  }
  if (row.flag_type === 'user_list') {
    if (!Array.isArray(value.user_ids) || value.user_ids.some((id) => typeof id !== 'string')) return 'user_ids must be a list of ids.';
    if (value.user_ids.length > 1000) return 'user_ids is limited to 1000 entries.';
  }
  return null;
}

async function applyChange(
  flagName: string,
  patch: Partial<Pick<FeatureFlagRow, 'is_enabled' | 'flag_value'>>,
  changedBy: string | null,
): Promise<FeatureFlagRow> {
  const before = await store.get(flagName);
  if (!before) throw new Error(`Unknown flag ${flagName}`);
  const after = await store.update(flagName, patch);
  clearFlagCache(flagName);
  await store.log({
    flag_name: flagName,
    old_value: { is_enabled: before.is_enabled, flag_value: before.flag_value },
    new_value: { is_enabled: after.is_enabled, flag_value: after.flag_value },
    changed_by: changedBy,
  });
  return after;
}

export function toggleFlag(flagName: string, enabled: boolean, changedBy: string | null = null): Promise<FeatureFlagRow> {
  return applyChange(flagName, { is_enabled: enabled }, changedBy);
}

export async function updateFlagValue(flagName: string, value: FlagValue, changedBy: string | null = null): Promise<FeatureFlagRow> {
  const row = await store.get(flagName);
  if (!row) throw new Error(`Unknown flag ${flagName}`);
  const problem = validateFlagValue(row, value);
  if (problem) throw new Error(problem);
  const normalized: FlagValue =
    row.flag_type === 'user_list'
      ? { user_ids: [...new Set(value.user_ids!.map((id) => id.trim()).filter(Boolean))] }
      : row.flag_type === 'percentage'
        ? { rollout_percentage: Math.round(value.rollout_percentage!) }
        : value;
  return applyChange(flagName, { flag_value: normalized }, changedBy);
}

export const listFlags = () => store.list();
export const flagHistory = (flagName: string, limit = 50) => store.history(flagName, limit);
