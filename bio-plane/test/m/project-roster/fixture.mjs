/* project-roster over a real SQLite database (node:sqlite), beside the real membership it uses, with a stub record-core
   that provides the services both use (bundleInfo, declarePurge, declareTable, getSetting) over a `bundles` table holding the
   R37 read contract this module reads (bundle_id, object_type, title, current_state, project; and `manifest`), passed to `membershipOf` and `projectRosterOf` as a test's own record-core
   (K61). Every test drives the module at its interface; membership's acts set up the participation it reads. */
import { DatabaseSync } from "node:sqlite";
import { membershipOf } from "../../../src/membership/index.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { projectRosterOf, projectRosterOps } from "../../../src/project-roster/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function sqlOver(db) {
  return {
    exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
    },
  };
}

/* What `credentials` registers with membership at its start, stood in for (a test of this module imports no later
   one): the claim fact and the password setter, so the founder and enrolled members exist. */
function standIns(m) {
  const creds = { claimed: false };
  m.registerClaimed("credentials", () => creds.claimed);
  m.registerPasswordSetter(({ role }) => ({ ok: true, role }));
  return creds;
}

/* The founder's own handle (membership R144, T49): chosen once, by the founder's own act, `founderHandleSet`. */
function founderHandleOf(m) {
  return { set: (handle) => { const a = m.founderHandleSet({ handle, by: "admin" });
    if (!a.ok) throw new Error(`founderHandleSet refused: ${a.reason}`); return a; } };
}

export function world() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE bundles (bundle_id TEXT PRIMARY KEY, object_type TEXT NOT NULL, title TEXT, project TEXT,
    current_state TEXT)`);
  /* record-core R37's `manifest` read contract (bundle_id, author, created, rowid), for R27's opener. */
  db.exec(`CREATE TABLE manifest (bundle_id TEXT NOT NULL, snap_key TEXT NOT NULL, author TEXT, created TEXT NOT NULL)`);
  /* record-core R37's `files` read contract (bundle_id, path, content), for R42's question count. */
  db.exec(`CREATE TABLE files (bundle_id TEXT NOT NULL, path TEXT NOT NULL, content TEXT, PRIMARY KEY (bundle_id, path))`);
  const declared = [];
  /* record-core's settings (its R25), for R24's active profiles: `jurisdiction_profiles` a test sets directly. */
  const settings = { jurisdiction_profiles: ["test-port-ellery"] };
  const core = {
    getSetting(name) { return Object.hasOwn(settings, name) ? settings[name] : null; },
    bundleInfo(id) {
      const r = db.prepare(`SELECT bundle_id, object_type, title, project FROM bundles WHERE bundle_id=?`).get(bind(id));
      return r ? { id: r.bundle_id, type: r.object_type, title: r.title, project: r.project ?? null } : null;
    },
    declarePurge(module, tables, opts) { declared.push({ module, tables, opts }); },
    /* N940 (T47): record-core R21's explicit form, so membership declares `join_doors` with its own classes (its R131)
       here as on a real host, rather than in the default form a stub without it gets. */
    declareTable(module, entries) { declared.push({ module, tables: entries, explicit: true }); },
  };
  const sql = sqlOver(db);
  const ctx = { storage: { sql } };
  /* R28: the host's clock, the server's instant; a test fixes it with `w.time.now` (milliseconds), else now. */
  const time = { now: null };
  const clock = () => time.now ?? Date.now();
  const m = membershipOf(ctx, { record: core });
  m.migrate();
  const creds = standIns(m);
  const founder = founderHandleOf(m);
  const r = projectRosterOf(ctx, { record: core, membership: m, clock });
  if (projectRosterOf(ctx) !== r) throw new Error("projectRosterOf answers one instance per storage");
  r.migrate();
  const w = {
    db, sql, core, m, r, declared, creds, ctx, settings, time,
    /* The founder chooses her handle (membership R144): `founderHandleSet` as the founder's own act. */
    founderHandle: (handle) => founder.set(handle),
    bundle(id, type = "information", title = `title of ${id}`, project = null, state = null) {
      db.prepare(`INSERT INTO bundles (bundle_id, object_type, title, project, current_state) VALUES (?,?,?,?,?)`)
        .run(id, type, title, project, state);
      return id;
    },
    /* A project with its recorded `current_state` (record-core R37), `forming` unless a test names another or null. */
    project(id, title = `Project ${id}`, state = "forming") {
      w.bundle(id, "project", title, null, state); m.reindexProjectSight(id); return id;
    },
    /* R42: a project's document, citing each of `cites` (a target marked `severed` when given as `[id, "severed"]`). */
    doc(id, ...cites) {
      const refs = cites.map((c) => { const [t, status] = [].concat(c);
        return `  - rel: cites\n    target: ${t}${status ? `\n    status: ${status}` : ""}`; }).join("\n");
      db.prepare(`INSERT OR REPLACE INTO files (bundle_id, path, content) VALUES (?, 'bundle.md', ?)`)
        .run(id, `---\n${refs ? `references:\n${refs}\n` : ""}---\nbody`);
    },
    /* A manifest entry of `id` written by `author` at `created` (record-core R37), in the order recorded. */
    entry(id, author, created = new Date().toISOString()) {
      db.prepare(`INSERT INTO manifest (bundle_id, snap_key, author, created) VALUES (?,?,?,?)`)
        .run(id, `k${Math.random().toString(36).slice(2)}`, author, created);
    },
    row(q, ...a) { return sql.exec(q, ...a)[0] ?? null; },
    rows(q, ...a) { return sql.exec(q, ...a); },
    async claim() { creds.claimed = true; },
    /* Invite and enrol a member all the way to active. */
    async enrol(id, role = "member", by = "admin") {
      const a = await m.memberAdd({ memberId: id, cover: `cover of ${id}`, role, by });
      if (!a.ok) return a;
      return m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
    },
    /* The founder plus a second administrator, then ordinary members. */
    async group(...members) {
      await w.claim();
      await w.enrol("second", "admin");
      for (const id of members) await w.enrol(id);
      return w;
    },
    /* The project owned by `owner`, each of `joined` invited and joined, each of `invited` invited only. */
    owned(projectId, owner, joined = [], invited = []) {
      w.project(projectId);
      m.projectClaimOwner({ projectId, memberId: owner });
      for (const h of [...joined, ...invited]) m.projectInvite({ projectId, handle: h, by: owner, viewer: V(owner) });
      for (const h of joined) m.projectJoin({ projectId, by: h, viewer: V(h) });
      return projectId;
    },
    ops(query = "") {
      return projectRosterOps(r, new URL(`http://x/?${query}`), null, { VERSION: "test-build" });
    },
  };
  return w;
}

export const V = (id) => `member:${id}`;

/* Every table's rows, to show an answer wrote nothing. */
export const snapshot = (w) => JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map(({ name }) => [name, w.rows(`SELECT * FROM "${name}"`)]));

/* Both modules over the REAL record-core (its schema and `recordOf`), for what only they together show (R17, R18). */
export async function realWorld() {
  const db = new DatabaseSync(":memory:");
  const sql = sqlOver(db);
  const storage = { sql, transactionSync(fn) {
    db.exec("SAVEPOINT t");
    try { const x = fn(); db.exec("RELEASE t"); return x; } catch (e) { db.exec("ROLLBACK TO t"); db.exec("RELEASE t"); throw e; }
  } };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const st of bare.split(";")) { const t = st.trim(); if (t) db.exec(t); }
  const ctx = { storage };
  const rc = recordOf(ctx);
  if (typeof rc.migrate === "function") rc.migrate();
  const m = membershipOf(ctx);
  m.migrate();
  const creds = standIns(m);
  const founder = founderHandleOf(m);
  const time = { now: null };
  const r = projectRosterOf(ctx, { clock: () => time.now ?? Date.now() });
  r.migrate();
  const w = { db, sql, rc, m, r, creds, time, founderHandle: (handle) => founder.set(handle),
    async claim() { creds.claimed = true; },
    async enrol(id, role = "member") {
      const a = await m.memberAdd({ memberId: id, cover: `cover of ${id}`, role, by: "admin" });
      if (!a.ok) return a;
      return m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
    },
    bundle(id, type = "project") {
      db.prepare(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated,
        bundle_sha) VALUES (?,?,'g',?,'forming','t','t','sha')`).run(id, type, id);
      m.reindexProjectSight(id);
    },
    row(q, ...a) { return sql.exec(q, ...a)[0] ?? null; },
    rows(q, ...a) { return sql.exec(q, ...a); } };
  return w;
}
