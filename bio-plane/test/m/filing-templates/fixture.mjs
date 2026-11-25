/* filing-templates over the modules it uses, the real ones (record-core, membership, jurisdictions, record-grammar,
   action-grammar) on a real SQLite database (node:sqlite) standing in for a Durable Object's storage, answering as
   workerd's does (a cursor). Members and project participations are rows of membership's own tables, written as its
   acts would leave them; a project is a real bundle committed through record-core. The jurisdiction profiles are the
   test profile (`build/layers.md`, "No jurisdiction in the product", rule 3) and, where a test needs a second profile,
   a made-up copy of it under another id (`test-harbour`), handed in as `jurisdictions`. Every test drives
   `filing-templates` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";
import { filingTemplatesOf } from "../../../src/filing-templates/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() { const rest = c.toArray(); if (rest.length !== 1) throw new Error(`Expected exactly one result, got ${rest.length}`); return rest[0]; },
  };
  return c;
}
export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = { exec(q, ...args) {
    const st = db.prepare(q);
    return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
  } };
  return { db, sql, transactionSync(fn) {
    const sp = `sp${n++}`;
    db.exec(`SAVEPOINT ${sp}`);
    try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
    catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
  } };
}

export const V = (id) => `member:${id}`;
export const MACHINE = "class:ai";
export const NOW = "2026-10-01T12:00:00Z";
export const TEST = "test-port-ellery";
export const HARBOUR = "test-harbour";
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
export const secret = (s) => sha(`secret:${s}`);

/* A second made-up profile: the test profile under another id, its kinds' templates removed (so each profile template
   id is the test profile's alone) and its records request kind at Tier 1. */
export function harbourProfile() {
  const p = jurisdictions.get(TEST);
  p.id = HARBOUR;
  p.name = "Harbour test profile";
  for (const k of p.action_kinds) { delete k.template; delete k.templates; if (k.kind === "records_request") { k.tier = 1; delete k.advisory; } }
  return p;
}
const harbour = harbourProfile();
export const twoProfiles = {
  get: (id) => (id === HARBOUR ? structuredClone(harbour) : jurisdictions.get(id)),
  list: () => [...jurisdictions.list(), { id: HARBOUR, name: harbour.name, covers: harbour.covers, test: true }],
  combine: (l) => jurisdictions.combine(Array.isArray(l) ? l.map((x) => (x === HARBOUR ? structuredClone(harbour) : x)) : l),
};

export function world({ profiles = [TEST], jur = null, before = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  if (profiles) record.setSetting("jurisdiction_profiles", profiles, "test");
  let n = 0;
  const w = {
    st, host, record, membership, clock,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'tpl_%' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
    /** A project bundle, `owner` its owner (joined). */
    project(slug, owner) {
      const id = `PROJ-2026-${String(++n).padStart(4, "0")}-${slug}`;
      const text = ["---", `id: ${id}`, "object_type: project", `title: "${slug}"`, "current_state: forming", "---", "", "P.", ""].join("\n");
      record.transact(() => record.commit({ bundleId: id, type: "project", title: slug, project: null, snapKey: `b${n}`, kind: "promotion",
        base: EMPTY, author: V(owner), writer: null, operation: null,
        files: [{ path: "bundle.md", text, sha256: sha(text), bytes: Buffer.byteLength(text) }], state: "forming", priorState: null,
        group: "test-group", created: clock.now, lastUpdated: clock.now, criticality: null, at: clock.now }));
      w.join(id, owner, "joined", true);
      return id;
    },
    join(projectId, memberId, state = "joined", owner = false) {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, ?, 't', 't')`, projectId, memberId, state, owner ? 1 : 0);
    },
    /** A project set discoverable, as membership's visibility act leaves its index (`project_sight`, R85); a project
     *  with no row is hidden. Since D54 an administrator neither invited nor joined sees a hidden project only at
     *  EXISTENCE, a discoverable one whole (membership R43, R44). */
    discoverable(projectId) {
      st.sql.exec(`INSERT OR REPLACE INTO project_sight (project_id, setting) VALUES (?, 'discoverable')`, projectId);
    },
  };
  if (typeof before === "function") before(w);
  w.ft = filingTemplatesOf(host, { record, membership, now: () => Date.parse(clock.now), ...(jur ? { jurisdictions: jur } : {}) });
  return w;
}

/** The common world: alice and bob joined owners of P; carol invited to P, not joined; dave outside P, owner of Q;
 *  erin an administrator outside P (P hidden, so since D54 erin sees it only at EXISTENCE: none of its templates);
 *  frank joined in P, not an owner. */
export function seeded(opts = {}) {
  const w = world(opts);
  for (const m of ["alice", "bob", "carol", "dave", "frank"]) w.member(m);
  w.member("erin", { role: "admin" });
  w.P = w.project("budget", "alice");
  w.join(w.P, "bob", "joined", true);
  w.join(w.P, "frank");
  w.join(w.P, "carol", "invited");
  w.Q = w.project("harbour", "dave");
  return w;
}

export const TEXT = "To the {{counterparty_role}}: {{group}} asks under {{law}}.";
/** A new template's draft in P by alice (records_request, file, the test profile), answering its version id. */
export function draft(w, x = {}) {
  const r = w.ft.templateDraft({ project: w.P, kind: "records_request", use: "file", profiles: [TEST], name: "Records ask",
                                 text: TEXT, author: V("alice"), viewer: V("alice"), ...x });
  if (!r.ok) throw new Error(`fixture draft refused: ${JSON.stringify(r).slice(0, 400)}`);
  return r;
}
/** A version taken through a grant, submission, a professional review (the records request kind is Tier 2) and
 *  approval by bob, an owner who is not its author. */
export function approved(w, x = {}) {
  const d = draft(w, x);
  const g = w.ft.templateReviewGrant({ version: d.version, recipient: "Pat Lawyer", organisation: "Legal Aid (test)",
                                       secretSha: secret(d.version), by: V("alice"), viewer: V("alice") });
  if (!g.ok) throw new Error(JSON.stringify(g));
  const s = w.ft.templateSubmit({ version: d.version, reviewers: ["bob"], author: V("alice"), viewer: V("alice") });
  if (!s.ok) throw new Error(JSON.stringify(s));
  const rv = w.ft.templateReview({ version: d.version, outcome: "no_concerns", scope: "legal sufficiency", secretSha: secret(d.version) });
  if (!rv.ok) throw new Error(JSON.stringify(rv));
  const a = w.ft.templateApprove({ version: d.version, by: V("bob"), viewer: V("bob") });
  if (!a.ok) throw new Error(JSON.stringify(a));
  return { ...d, grant: g.grant };
}

/** R15 (T45): the profile's templates as v0.2 rule 11 offers them: each given the public sources it was written from
 *  and a professional's review with no concerns, so every one of `base`'s profile templates is offered. `base` is a
 *  jurisdictions-shaped reader (default the module itself); the profiles are otherwise unchanged. */
export const PRO_REVIEW = { reviewer: "Dee Example", kind: "professional", organisation: "Marlow Commons Legal Society (test)",
                            credential: "solicitor (test)", scope: "the whole text", outcome: "no_concerns", at: "2026-08-25" };
export function attributed(p) {
  const fix = (t) => ({ ...t, sources: t.sources && t.sources.length ? t.sources : [{ citation: "P.E.B.L. § 1" }],
                        reviews: [...(t.reviews || []).filter((r) => r.kind !== "professional"), PRO_REVIEW] });
  for (const k of p.action_kinds || []) {
    if (k.template) k.template = fix(k.template);
    if (Array.isArray(k.templates)) k.templates = k.templates.map(fix);
  }
  return p;
}
export function reviewedOf(base = jurisdictions, edit = null) {
  const get = (id) => { const p = base.get(id); if (!p) return p; attributed(p); if (edit) edit(p); return p; };
  return { ...base, get, list: () => base.list(), combine: (l) => base.combine(Array.isArray(l) ? l.map((x) => (typeof x === "string" ? get(x) || x : x)) : l) };
}
/** Every template the test profile carries, by id, read from jurisdictions' own declaration (its R40, R81; N1073). */
export const PROFILE_IDS = Object.freeze(jurisdictions.get(TEST).action_kinds
  .flatMap((k) => [k.template, ...(k.templates ?? [])]).filter(Boolean).map((t) => t.id));
