/* wizard-scripts over the modules it uses, the real ones (record-core, membership, filing-templates, record-grammar) on
   a real SQLite database (node:sqlite) standing in for a Durable Object's storage, answering as workerd's does (a
   cursor). Members and project participations are rows of membership's own tables, written as its acts would leave
   them; a project is a real bundle committed through record-core. The screen registry and the Civicsmith library here
   are test ones, small enough to reason about (the carried ones, SCREEN_REGISTRY and CIVICSMITH_LIBRARY, are tested in
   library.test.mjs), and the jurisdiction profile is a made-up test one (`profiles`), whose records-request template
   filing-templates offers. Every test drives `wizard-scripts` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { filingTemplatesOf } from "../../../src/filing-templates/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { wizardScriptsOf, WizardScripts } from "../../../src/wizard-scripts/index.mjs";

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
export const NOW = "2026-10-03T12:00:00Z";
export const TEST = "test-port-ellery";
/** The test profile's records-request template, which filing-templates offers while the profile is active and the
 *  template is attributed (`reviewed`). */
export const OFFERED_TEMPLATE = "TPL-test-records-request";
/** R22 (T45): the name the attributed records-request template is given, so its handle is `records-request`
 *  (filing-templates R26). */
export const RECORDS_REQUEST_NAME = "Records request";

/** filing-templates R15 (T45; v0.2 rule 11; K2851): the test profile filing-templates reads (through `get`, the one
 *  reading it makes), made up here, standing for the test profile's records request: one kind, its venue not a court,
 *  and its template attributed as rule 11 offers it (a named writer, the public sources it was written from, a
 *  professional's review with no concerns and another approver) and named "Records request", so its handle is
 *  `records-request` (filing-templates R26); or, with `name` null, keeping its kind's label for a name. `reviewed: false`
 *  leaves out its sources and its professional review, so it is not offered (R15). No place, law or venue is real. */
export const PRO_REVIEW = Object.freeze({ reviewer: "Dee Example", kind: "professional", organisation: "Test Legal Society",
                                          credential: "solicitor (test)", scope: "the whole text", outcome: "no_concerns", at: "2026-08-25" });
export function profiles({ reviewed = true, name = RECORDS_REQUEST_NAME } = {}) {
  const template = { id: OFFERED_TEMPLATE, version: 1, use: "file", ...(name ? { name } : {}),
                     text: "To the {{counterparty_role}}: under {{law}}, {{group}} asks for the records described below.",
                     notes: "A made-up template for tests.", authored_by: "Ada Example", contributors: ["Ben Example"],
                     approved_by: "Cy Example", approved_at: "2026-09-01", basis: "TEST",
                     ...(reviewed ? { sources: [{ citation: "Test Records Act § 1" }], reviews: [{ ...PRO_REVIEW }] } : { reviews: [] }) };
  const profile = { id: TEST, name: "A test place", covers: ["A test place"], test: true,
                    action_kinds: [{ kind: "records_request", label: "request under the records act", tier: 2, laws: ["Test Records Act"],
                                     venue: { name: "the test clerk", how: "email", basis: "TEST" }, template, basis: "TEST" }] };
  return { get: (id) => (id === TEST ? structuredClone(profile) : null) };
}

const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** A test screen registry: three screens and their acts. */
export const SCREENS = Object.freeze([
  { id: "case-home", acts: ["casenote", "casejoin"] },
  { id: "filing-draft", acts: ["filingsave", "filingapprove"] },
  { id: "publish", acts: ["publish", "whatchangedpropose"] },
]);
export const OPS = Object.freeze(["casenote", "casejoin", "filingsave", "filingapprove", "publish", "whatchangedpropose", "escalationreasondraft",
                                   "writinghelp", "groupdescriptiondraft"]);
/** The acts a machine is refused (op-grades' MACHINE_REFUSALS keys, its R5, here a test's; K1974). */
export const MACHINE_REFUSED = Object.freeze(["filingapprove", "publish"]);
/** The labelled machine drafts (case-authoring R39's ops). */
export const MACHINE_DRAFTS = Object.freeze(["whatchangedpropose", "escalationreasondraft"]);
/** A step, whole. */
export const step = (screen, act, extra = {}) => ({ screen, act, what: `Do ${act ?? "nothing"} on ${screen}`, why: "Because it moves the case", ...extra });
export const STEPS = Object.freeze([step("case-home", "casenote"), step("filing-draft", "filingsave")]);
/** A test Civicsmith library: one required script and one optional. */
export const LIBRARY = Object.freeze([
  { id: "WIZ-2026-9001", name: "Start a case", required: true, version: 2, steps: [step("case-home", "casejoin"), step("case-home", "casenote")],
    approved: { by: "Bob", at: "2026-10-01T00:00:00Z" } },
  { id: "WIZ-2026-9002", name: "Publish", required: false, version: 1,
    steps: [step("publish", "publish", { draft: { machine: "whatchangedpropose" } })], approved: { by: "Bob", at: "2026-10-02T00:00:00Z" } },
]);
export const registration = (x = {}) => ({ screens: SCREENS, ops: OPS, machineRefused: MACHINE_REFUSED, machineDrafts: MACHINE_DRAFTS,
                                           library: LIBRARY, ...x });

/** `templates`: `"reviewed"` (the default: the test profile's template attributed, so filing-templates offers it as
 *  "Records request", or with `recordsRequest: null` under its kind's label) or `"unreviewed"` (not offered, R15);
 *  `jurisdictions`, a profile reader (`get`) in place of either. */
export function world({ register = true, reg = {}, templates = "reviewed", recordsRequest = RECORDS_REQUEST_NAME, jurisdictions = null, env = undefined } = {}) {
  const st = storage();
  /* `env`, the Worker environment, when a test gives one: `ai-runs` reads whether this is a test instance from it (R34) */
  const host = env === undefined ? { storage: st } : { storage: st, env };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* project-roster's tables, as the host's boot creates them after membership's (K4065): queue-producers reads its projects through this store */
  projectRosterOf(host, { record, membership }).migrate();
  record.setSetting("jurisdiction_profiles", [TEST], "test");
  const now = () => Date.parse(clock.now);
  const filingTemplates = filingTemplatesOf(host, { record, membership, now,
    jurisdictions: jurisdictions ?? profiles({ reviewed: templates === "reviewed", name: recordsRequest }) });
  /* ai-accounts, real: its keep-away (R7's `aiKeptAway`) is what R24 reads; off until an administrator sets it */
  const accounts = aiAccountsOf(host, { record, membership });
  accounts.migrate();
  let n = 0;
  const w = {
    st, host, record, membership, clock, filingTemplates, accounts,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'wiz_%' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
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
  };
  w.wz = wizardScriptsOf(host, { record, membership, filingTemplates, accounts, now });
  if (register) { const r = w.wz.wizardRegister(registration(reg)); if (!r.ok) throw new Error(JSON.stringify(r)); }
  return w;
}

/** The common world: alice and bob joined owners of P; frank joined in P, not an owner; carol invited to P, not
 *  joined; dave outside P, owner of Q; erin an administrator outside P. */
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

/** The object constructed again on the same storage (a Durable Object's next wake), registered with `reg`'s changes. */
export function restart(w, reg = {}) {
  const x = new WizardScripts({ storage: w.st, record: w.record, membership: w.membership, filingTemplates: w.filingTemplates,
                                accounts: w.accounts, now: () => Date.parse(w.clock.now) });
  x.migrate();
  const r = x.wizardRegister(registration(reg));
  if (!r.ok) throw new Error(JSON.stringify(r));
  x.registered = r;
  return x;
}

const must = (r, what) => { if (!r || !r.ok) throw new Error(`fixture ${what} refused: ${JSON.stringify(r).slice(0, 400)}`); return r; };
/** A recorded draft in P by `who` (default frank), its steps revised to `steps`. */
export function draft(w, { who = "frank", steps = STEPS, name = "Note and save", project = null } = {}) {
  const d = must(w.wz.wizardDraft({ project: project ?? w.P, name, recorded: steps.map((s) => ({ screen: s.screen, act: s.act ?? null })),
                                    author: V(who), viewer: V(who) }), "draft");
  must(w.wz.wizardRevise({ version: d.version, steps, author: V(who), viewer: V(who) }), "revise");
  return d;
}
/** A draft submitted by its author and approved by alice (an owner who is not its author). */
export function approved(w, x = {}) {
  const d = draft(w, x);
  const who = x.who ?? "frank";
  must(w.wz.wizardSubmit({ version: d.version, author: V(who), viewer: V(who) }), "submit");
  const by = x.by ?? "alice";
  must(w.wz.wizardApprove({ version: d.version, by: V(by), viewer: V(by) }), "approve");
  return d;
}

/** D54 (membership R43, R44; K2408): a project's owner sets it discoverable, so an administrator neither invited nor
 *  joined sees it at FULL again (a hidden project, the default, it sees only at EXISTENCE: none of its scripts). */
export function discoverable(w, project = w.P, owner = "alice") {
  return must(w.membership.projectVisibilitySet({ projectId: project, setting: "discoverable", reason: "open to the group", by: owner, viewer: V(owner) }),
              "discoverable");
}
