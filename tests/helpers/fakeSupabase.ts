/**
 * Minimal in-memory stand-in for the supabase-js query builder, covering the subset the server code
 * uses (select/insert/update/delete/upsert, eq/neq/in/is/or/gte/lte/ilike, order/range/limit,
 * single/maybeSingle, rpc). Good enough to unit test business logic without a database.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
type Pred = (r: Row) => boolean;

function parseOr(expr: string): Pred {
  // Supports "a.eq.X,b.eq.Y" and "and(a.eq.X,b.eq.Y),and(...)" and "col.is.null,col.gt.V".
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  const preds = parts.map((p): Pred => {
    if (p.startsWith('and(')) {
      const inner = p.slice(4, -1).split(',').map(cond);
      return (r) => inner.every((f) => f(r));
    }
    return cond(p);
  });
  return (r) => preds.some((f) => f(r));
}

function cond(c: string): Pred {
  const [col, op, ...rest] = c.split('.');
  const val = rest.join('.');
  return (r) => {
    const v = r[col!];
    switch (op) {
      case 'eq':
        return String(v) === val;
      case 'is':
        return val === 'null' ? v === null || v === undefined : String(v) === val;
      case 'gt':
        return String(v) > val;
      case 'in':
        return val.replace(/[()]/g, '').split(',').includes(String(v));
      default:
        throw new Error(`fake supabase: unsupported op ${op}`);
    }
  };
}

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private preds: Pred[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private wantCount = false;
  private head = false;
  private returning = false;

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.returning = true;
    this.wantCount = !!opts?.count;
    this.head = !!opts?.head;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  upsert(row: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = 'upsert';
    this.payload = row;
    this.upsertOpts = opts;
    return this;
  }
  eq(col: string, v: unknown) {
    this.preds.push((r) => r[col] === v);
    return this;
  }
  neq(col: string, v: unknown) {
    this.preds.push((r) => r[col] !== v);
    return this;
  }
  in(col: string, vs: unknown[]) {
    this.preds.push((r) => vs.includes(r[col]));
    return this;
  }
  is(col: string, v: null) {
    this.preds.push((r) => (r[col] ?? null) === v);
    return this;
  }
  gte(col: string, v: unknown) {
    this.preds.push((r) => String(r[col]) >= String(v));
    return this;
  }
  lte(col: string, v: unknown) {
    this.preds.push((r) => String(r[col]) <= String(v));
    return this;
  }
  ilike(col: string, pattern: string) {
    const re = new RegExp(`^${pattern.replace(/\\([%_\\])/g, '$1').replace(/%/g, '.*')}$`, 'i');
    this.preds.push((r) => re.test(String(r[col])));
    return this;
  }
  or(expr: string) {
    this.preds.push(parseOr(expr));
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  limit() {
    return this;
  }
  textSearch() {
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  private exec(): { data: unknown; error: unknown; count?: number | null } {
    const rows = this.db.table(this.table);
    const match = (r: Row) => this.preds.every((p) => p(r));
    let result: Row[] = [];
    switch (this.op) {
      case 'select':
        result = rows.filter(match);
        break;
      case 'insert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
        const err = this.db.checkUnique(this.table, list);
        if (err) return { data: null, error: err };
        result = list.map((r) => this.db.defaults(this.table, r));
        rows.push(...result);
        break;
      }
      case 'update':
        result = rows.filter(match);
        result.forEach((r) => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
        break;
      case 'delete':
        result = rows.filter(match);
        this.db.tables.set(this.table, rows.filter((r) => !match(r)));
        break;
      case 'upsert': {
        const row = this.payload as Row;
        const key = this.upsertOpts.onConflict ?? 'id';
        const existing = rows.find((r) => r[key] === row[key]);
        if (existing) {
          if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, row);
          result = this.upsertOpts.ignoreDuplicates ? [] : [existing];
        } else {
          const created = this.db.defaults(this.table, row);
          rows.push(created);
          result = [created];
        }
        break;
      }
    }
    const copy = result.map((r) => structuredClone(r));
    if (this.op !== 'select' && !this.returning) return { data: null, error: null };
    if (this.head) return { data: null, error: null, count: copy.length };
    if (this.mode === 'single') {
      return copy.length === 1 ? { data: copy[0], error: null } : { data: null, error: { code: 'PGRST116', message: `expected 1 row, got ${copy.length}` } };
    }
    if (this.mode === 'maybe') return { data: copy[0] ?? null, error: null };
    return { data: copy, error: null, count: this.wantCount ? copy.length : null };
  }

  then<T1, T2>(onfulfilled?: (v: { data: unknown; error: unknown; count?: number | null }) => T1 | PromiseLike<T1>, onrejected?: (e: unknown) => T2 | PromiseLike<T2>) {
    return Promise.resolve()
      .then(() => this.exec())
      .then(onfulfilled, onrejected);
  }
}

export class FakeDb {
  tables = new Map<string, Row[]>();
  rpcs = new Map<string, (args: Row) => unknown>();
  /** Unique constraints: table -> list of column sets. */
  unique: Record<string, string[][]> = { recordings: [['session_id', 'sequence_id']], video_processing_queue: [['session_id']] };

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  defaults(table: string, row: Row): Row {
    const now = new Date().toISOString();
    const base: Row = { id: randomUUID(), created_at: now, updated_at: now };
    if (table === 'game_sessions') Object.assign(base, { version: 0, current_sequence_index: 0, invited_user_ids: [], final_video_url: null, started_at: null, completed_at: null });
    if (table === 'notifications') Object.assign(base, { is_read: false, metadata: {}, read_at: null });
    if (table === 'recordings') Object.assign(base, { attempt: 1 });
    if (table === 'video_processing_queue') Object.assign(base, { status: 'pending', retry_count: 0, result: null, started_at: null, completed_at: null, error_message: null });
    return { ...base, ...structuredClone(row) };
  }

  checkUnique(table: string, rows: Row[]): { code: string; message: string } | null {
    for (const cols of this.unique[table] ?? []) {
      for (const r of rows) {
        if (this.table(table).some((e) => cols.every((c) => e[c] === r[c]))) return { code: '23505', message: `duplicate ${cols.join(',')}` };
      }
    }
    return null;
  }

  client() {
    return {
      from: (t: string) => new Query(this, t),
      rpc: async (name: string, args: Row = {}) => {
        const fn = this.rpcs.get(name);
        if (!fn) return { data: null, error: { message: `no rpc ${name}` } };
        return { data: await fn(args), error: null };
      },
      channel: () => ({ httpSend: async () => ({ success: true }) }),
      removeChannel: async () => 'ok',
    };
  }
}
