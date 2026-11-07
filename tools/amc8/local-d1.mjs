// A small stand-in for Cloudflare D1 on Node's built-in SQLite, for testing worker/amc8.js locally.
// Supports what the Worker uses: prepare().bind().first()/all()/run() and batch() (all-or-nothing).
// db.queries counts statements run, to check D1's per-request query limit (50 on the Free plan).
import { DatabaseSync } from 'node:sqlite';

export function localD1(file = ':memory:') {
  const sql = new DatabaseSync(file);
  const api = { queries: 0 };
  const plain = r => (r == null ? null : { ...r });
  class Stmt {
    constructor(text, args = []) { this.text = text; this.args = args; }
    bind(...args) { return new Stmt(this.text, args); }
    async first(col) { api.queries++; const r = plain(sql.prepare(this.text).get(...this.args)); return r && col ? r[col] : r; }
    async all() { api.queries++; return { success: true, results: sql.prepare(this.text).all(...this.args).map(plain), meta: {} }; }
    async run() { api.queries++; const i = sql.prepare(this.text).run(...this.args); return { success: true, results: [], meta: { changes: Number(i.changes) } }; }
  }
  api.prepare = text => new Stmt(text);
  api.batch = async stmts => {
    sql.exec('BEGIN');
    try {
      const out = [];
      for (const s of stmts) out.push(/^\s*(SELECT|WITH)\b/i.test(s.text) ? await s.all() : await s.run());
      sql.exec('COMMIT');
      return out;
    } catch (err) { sql.exec('ROLLBACK'); throw err; }
  };
  api.raw = sql;
  return api;
}
