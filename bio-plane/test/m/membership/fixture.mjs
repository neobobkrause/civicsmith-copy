/* A membership module over a real SQLite database (node:sqlite), with a stub record-core that provides the
   services membership uses (bundleInfo, declarePurge, declareTable) over a `bundles` table holding the R37 read contract
   (bundle_id, object_type) and a title, passed to `membershipOf` as a test's own record-core (K61). Every test drives the module at its interface. */
import { DatabaseSync } from "node:sqlite";
import { membershipOf, membershipOps } from "../../../src/membership/index.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function sqlOver(db) {
  return {
    exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
    },
  };
}

/* `omit` leaves named stand-ins ("claimed", "setter", "revoked") to the test, for a test of that registration itself. */
export function world({ omit = [] } = {}) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE bundles (bundle_id TEXT PRIMARY KEY, object_type TEXT NOT NULL, title TEXT, project TEXT)`);
  const declared = [], tablesDeclared = [];
  const core = {
    bundleInfo(id) {
      const r = db.prepare(`SELECT bundle_id, object_type, title, project FROM bundles WHERE bundle_id=?`).get(bind(id));
      return r ? { id: r.bundle_id, type: r.object_type, title: r.title, project: r.project ?? null } : null;
    },
    declarePurge(module, tables, opts) { declared.push({ module, tables, opts }); },
    declareTable(module, entries) { tablesDeclared.push({ module, entries }); return { ok: true }; },
  };
  const sql = sqlOver(db);
  const ctx = { storage: { sql } };                  // a Durable Object's storage, as membershipOf reads it
  const m = membershipOf(ctx, { record: core });
  if (membershipOf(ctx) !== m) throw new Error("membershipOf answers one instance per storage");
  m.migrate();
  /* What `credentials` registers at its start (its R16, R17, R20), stood in for here, since a test of this module does
     not import a later one: the claim fact, the password setter, and a revocation listener that records each notice. */
  const creds = { claimed: false, passwords: new Map(), revoked: [] };
  if (!omit.includes("claimed")) m.registerClaimed("credentials", () => creds.claimed);
  if (!omit.includes("setter"))
    m.registerPasswordSetter(({ role, password }) => { creds.passwords.set(role, password); return { ok: true, role }; });
  if (!omit.includes("revoked")) m.onRevoked("credentials", (notice) => { creds.revoked.push(notice); });
  const w = {
    db, sql, core, m, declared, tablesDeclared, creds,
    /* `project` is record-core R34's: the project the bundle belongs to (N426). */
    bundle(id, type = "information", title = `title of ${id}`, project = null) {
      db.prepare(`INSERT INTO bundles (bundle_id, object_type, title, project) VALUES (?,?,?,?)`).run(id, type, title, project);
      return id;
    },
    project(id, title = `Project ${id}`) { w.bundle(id, "project", title); m.reindexProjectSight(id); return id; },
    row(q, ...a) { return sql.exec(q, ...a)[0] ?? null; },
    rows(q, ...a) { return sql.exec(q, ...a); },
    /* The founder claims the instance: the fact `credentials` states (its R17). */
    async claim() { creds.claimed = true; return { ok: true, role: "admin" }; }, // fixtures-own: harness the founder's claim, a world helper named like an op
    /* Invite and enrol a member all the way to active; returns the enrol answer. */
    async enrol(id, role = "member", by = "admin", caps = null) {
      const a = await m.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: caps, by });
      if (!a.ok) return a;   /* a refusal, CONSENSUS_REQUIRED included, is answered as it came */
      return m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
    },
    /* The founder plus a second administrator, so ordinary members may be added. */
    async group(...members) {
      await w.claim();
      await w.enrol("second", "admin");
      for (const id of members) await w.enrol(id);
      return w;
    },
    ops(query = "", body = null) {
      const url = new URL(`http://x/?${query}`);
      return membershipOps(m, url, body, { VERSION: "test-build" });
    },
  };
  return w;
}

export const V = (id) => `member:${id}`;

/* The module over the REAL record-core (its schema and `recordOf`), for what only the two together show (R115). */
export async function realWorld() {
  const db = new DatabaseSync(":memory:");
  const sql = sqlOver(db);
  const storage = { sql, transactionSync(fn) {
    db.exec("SAVEPOINT t");
    try { const r = fn(); db.exec("RELEASE t"); return r; } catch (e) { db.exec("ROLLBACK TO t"); db.exec("RELEASE t"); throw e; }
  } };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const st of bare.split(";")) { const t = st.trim(); if (t) db.exec(t); }
  const ctx = { storage };
  const rc = recordOf(ctx);
  if (typeof rc.migrate === "function") rc.migrate();
  const m = membershipOf(ctx);
  m.migrate();
  /* `credentials`' registrations, stood in for as `world`'s are. */
  const creds = { claimed: false, passwords: new Map() };
  m.registerClaimed("credentials", () => creds.claimed);
  m.registerPasswordSetter(({ role, password }) => { creds.passwords.set(role, password); return { ok: true, role }; });
  return { db, sql, rc, m, creds,
    async claim() { creds.claimed = true; return { ok: true, role: "admin" }; }, // fixtures-own: harness the founder's claim, a world helper named like an op
    bundle(id, type = "project") { db.prepare(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated,
      bundle_sha) VALUES (?,?,'g',?,'forming','t','t','sha')`).run(id, type, id); m.reindexProjectSight(id); },
    row(q, ...a) { return sql.exec(q, ...a)[0] ?? null; } };
}
