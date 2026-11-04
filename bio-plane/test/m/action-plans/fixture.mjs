/* action-plans over the modules it uses: the real ones where it writes or reads the record (record-core, membership,
   promotion) and where it creates (actions, action-clocks: R18 and R29 create a real action and set real reminders), on
   a real SQLite database (node:sqlite) standing in for a Durable Object's storage, answering as workerd's does (a
   cursor); leg-earning, real, for the projects drawing on an inquiry (its R7, K1661: a project's `cites` reference in
   connections' `refs`, written here as connections' projection would; no citation severed); and stand-ins, in the shape of their Provides,
   for the modules whose facts the test controls: strength (`projectBar`), conformance (`determinationRead` R9, `determinationsFor` R11),
   standards (`standardRead` R5), escalation (`escalationsFor` R22, `escalationRead` R2), filings (`availableActions`
   R21) and ai-runs (`registerOpenCheck` R47, `onRunOpened` R43, `runFor` R28, `read` R19, `boundOf`/`consumeBound`
   R29); duties (R38) is the real module, built by its own test world over its real modules when a test passes it
   (`world({duties})`; `duty-starts.test.mjs`). An inquiry and a determination are real bundles in the record (so an action's legs resolve); their facts are
   the stand-ins'. Provenance is real and migrated before `actions`, as every real host builds it: actions joins its
   promotion step (through capture's reader, its R55), which reads provenance's tables. Every test drives
   `action-plans` at its interface, under the jurisdictions test profile. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { actionsOf } from "../../../src/actions/index.mjs";
import { actionClocksOf } from "../../../src/action-clocks/index.mjs";
import { actionPlansOf } from "../../../src/action-plans/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { legEarningOf } from "../../../src/leg-earning/index.mjs";
import { runPrincipalGate } from "../../../src/run-rules/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { escalationRead as escalationFixture } from "../escalation/fixtures.mjs";
import { actionRead as actionFixture } from "../actions/fixtures.mjs";
import { actionRegistrar } from "../retrieval/fixtures.mjs";

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
/** The control plane's two stamps on an agent's `optionpropose` (K727): `proposer`, its label (`class:ai/<tokenId>`),
 *  and `principal`, the credential's principal and token (`<principal>/<tokenId>`), which a run it opened holds. */
export const AGENT = "class:ai/tok-1";
export const RUN_PRINCIPAL = "member:bob/tok-1";
export const NOW = "2026-10-01T12:00:00Z";
export const DAY = 86400000;
export const ms = (iso) => Date.parse(iso);
export const OFFICE = { state: "named", kind: "office", role: "Town Clerk", body: "City of Port Ellery" };
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** `on`: a basis-versions test world (its `world()`, with `st`, `host`, `record`, `membership`, `promotion` and `clock`), so the plan's
 *  host holds the real basis-versions instance and its project records (K5131: a stance is read through basis-versions' own answer). */
export function world({ profiles = ["test-port-ellery"], omit = [], duties, on } = {}) {
  const st = on ? on.st : storage();
  const host = on ? on.host : { storage: st };
  const clock = on ? on.clock : { now: NOW };
  const nowMs = () => ms(clock.now);
  let record, membership, promotion;
  if (on) ({ record, membership, promotion } = on);
  else {
    const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
    record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
    record.migrate();
    membership = membershipOf(host, { record });
    membership.migrate();
    promotion = promotionOf(host, { record, membership, now: () => clock.now });
    promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
    provenanceOf(host, { record, membership, promotion, now: () => clock.now }).migrate();
  }
  if (profiles) record.setSetting("jurisdiction_profiles", profiles, "test");
  /* connections' `refs` projection, as far as actions' read joins it (its R25). */
  st.db.exec(`CREATE TABLE IF NOT EXISTS refs (bundle_id TEXT, target_id TEXT, kind TEXT)`);

  /* R35: objects withheld from one viewer (`w.hide(viewer, id)`), as a sight rule narrower than membership's would: a
     membership proxy (conformance's reads.test.mjs builds one the same way) answers `inSight` false for them, and the
     stand-ins and actions' read below refuse them as their modules refuse an unseen object. */
  const hidden = new Set();
  const hid = (viewer, id) => hidden.has(`${viewer}|${id}`);
  const sight = new Proxy(membership, { get: (t, k) => (k === "inSight"
    ? (id, viewer) => (hid(viewer, id) ? false : t.inSight(id, viewer))
    : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  const sees = (project, viewer) => viewer === null || viewer === undefined || membership.inSight(project, viewer);
  /* conformance's stand-in: determinations as its R9 answers them, sight by the determination's project; a finding the
     viewer may not see is withheld whole and the answer states `out_of_view: true` (its R24). */
  const determinations = new Map();
  const shown = (d, viewer) => {
    const findings = (d.findings || []).filter((f) => !hid(viewer, f && f.finding));
    return { ...structuredClone(d), findings, live: !d.superseded_by,
             ...(findings.length !== (d.findings || []).length ? { out_of_view: true } : {}) };
  };
  const conformance = {
    determinationRead({ id, viewer }) {
      const d = determinations.get(id);
      if (!d || !sees(d.project, viewer) || hid(viewer, id)) return { ok: false, reason: "NO_SUCH_DETERMINATION" };
      return { ok: true, ...shown(d, viewer) };
    },
    determinationsFor({ act, live, after, viewer }) {
      const items = [...determinations.values()].filter((d) => sees(d.project, viewer) && !hid(viewer, d.id) && (!act || d.act.id === act)
        && (!live || !d.superseded_by) && (!after || d.id > after)).sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((d) => shown(d, viewer));
      return { ok: true, items, cursor: null, truncated: false };
    },
  };
  /* R1: a project draws on an inquiry when its document cites it (leg-earning R7); `w.cite` writes the reference. */
  const cite = (inquiryId, project) => st.sql.exec(`INSERT INTO refs (bundle_id, target_id, kind) VALUES (?, ?, 'cites')`, project, inquiryId);
  const bars = new Map();
  const strength = { projectBar: (p) => ({ declared: bars.has(p), capture: bars.get(p)?.capture ?? null, connection: bars.get(p)?.connection ?? null }) };
  const standardsHeld = new Map();
  const standards = { standardRead: ({ id, viewer }) => {
    const s = standardsHeld.get(id);
    return s && viewer !== V("outsider") ? { ok: true, id, ...s } : { ok: false, reason: "NO_SUCH_STANDARD" };
  } };
  const escalations = new Map();      // determination -> [{id, state, stage, history}]
  /* an id escalation holds none of: its own real answer (escalation's published fixture), the same for any id it names. */
  let realEscalation = null;
  const noSuchEscalation = (id) => {
    realEscalation ??= escalationFixture();
    return realEscalation.escalation.escalationRead({ id, viewer: realEscalation.viewer });
  };
  const escalation = {
    escalationsFor: ({ determination, viewer }) => {
      const d = determinations.get(determination);
      if (!d || !sees(d.project, viewer) || hid(viewer, determination)) return { ok: false, reason: "NO_SUCH_DETERMINATION" };
      return { ok: true, determination, items: (escalations.get(determination) || []).map((e) => ({ id: e.id, state: e.state, stage: e.stage })) };
    },
    escalationRead: ({ id }) => {
      for (const l of escalations.values()) for (const e of l) if (e.id === id) return { ok: true, id, stage: e.stage, history: e.history };
      return noSuchEscalation(id);
    },
  };
  const filings = { availableActions: ({ determination }) => ({ ok: true, determination, kinds: [{ kind: "complaint", tier: 1 }] }) };
  /* ai-runs' stand-in. */
  const runs = new Map();
  const reg = { checks: [], listeners: [] };
  /* R51: `open`, as ai-runs' answers it for a planning run: the registered check applied, a refusal in the open's own shape
     (`{run, started: false, ...}`), else the run recorded, the listeners told, `{run, started: true}`. `ctl.opens` keeps each
     call's arguments; `ctl.refuse` makes the next opens refuse with that code (a mode not deployed). */
  const ctl = { opens: [], refuse: null };
  const aiRuns = {
    open: async (a) => {
      ctl.opens.push(structuredClone(a));
      if (ctl.refuse) return { run: a.run, started: false, code: ctl.refuse, check: "C-stub", translation: "stub", detail: null };
      const check = reg.checks.find((c) => c.mode === a.mode);
      const said = a.mode === "plan" && check
        ? check.fn({ contextType: a.contextType, contextId: a.contextId, plan: a.plan, actor: a.actor, viewer: a.viewer }) : null;
      if (said) return { run: a.run, started: false, ...said };
      runs.set(a.run, { run: a.run, status: "running", mode: a.mode, context_type: a.contextType, context_id: a.contextId,
        principal_plane: a.principalPlane, plan: a.plan, skill: a.skillVersion,
        bounds: Object.fromEntries((a.bounds || []).map((b) => [b.bound, { allowed: b.allowed, consumed: 0 }])) });
      for (const l of reg.listeners) await l.fn({ run: a.run, contextType: a.contextType, contextId: a.contextId });
      return { run: a.run, started: true, status: "running" };
    },
    registerOpenCheck: (module, mode, fn) => { reg.checks.push({ module, mode, fn }); return { ok: true }; },
    onRunOpened: (module, fn) => { reg.listeners.push({ module, fn }); return { ok: true }; },
    runFor: (run, viewer) => { const r = runs.get(run); return r && (viewer !== V("outsider")) ? { run: r.run, status: r.status, mode: r.mode,
      context_type: r.context_type, context_id: r.context_id, principal_plane: r.principal_plane, principal_ai: "acct",
      ...(r.mode === "plan" ? { plan: r.plan } : {}) } : null; },
    read: async ({ run }) => { const r = runs.get(run); return r ? { found: true, session: { id: run, principal: { plane: r.principal_plane, skill: r.skill } } } : { found: false }; },
    boundOf: (run, bound) => { const r = runs.get(run); return r && r.bounds[bound] ? { ...r.bounds[bound] } : null; },
    consumeBound: (run, bound, n) => { const r = runs.get(run); if (!r.bounds[bound]) r.bounds[bound] = { allowed: 0, consumed: 0 };
      st.sql.exec(`CREATE TABLE IF NOT EXISTS stub_consumed (run TEXT, n INTEGER)`); st.sql.exec(`INSERT INTO stub_consumed VALUES (?, ?)`, run, n);
      r.bounds[bound].consumed += n; return null; },
  };
  const stand = { strength, conformance, standards, escalation, filings, aiRuns };
  /* actions, real, over the stand-in conformance; what it registers with retrieval is the test's (nothing here reads it). */
  const { retrieval: realRetrieval } = actionRegistrar();
  const actions = actionsOf(host, { record, membership, promotion, retrieval: realRetrieval, conformance,
                                    content: { captureFor: () => null }, now: nowMs });
  /* action-clocks' steps (its R16), in the shape of steps' Provides: no step stands for any entry here. Built on this
     host it would declare observation-log's tables, which the plane builds first (K2862, B6). */
  const steps = { registerDueHolder: () => ({ ok: true }), productsOf: () => ({ ok: true, steps: [] }),
                  stepsOf: () => ({ ok: true, steps: [] }), stepsWaitingOn: () => ({ ok: true, steps: [] }), step: () => null };
  const clocks = actionClocksOf(host, { record, membership, actions, conformance, steps, now: nowMs });
  const given = Object.fromEntries(Object.entries(stand).filter(([k]) => !omit.includes(k)).map(([k, v]) => [k, v]));
  for (const k of omit) given[k] = null;
  /* an action the viewer may not see: actions' own answer to a viewer it withholds the action from (its published fixture). */
  let realActions = null;
  const unseenAction = (id) => { realActions ??= actionFixture(); return realActions.actions.actionRead({ id, viewer: realActions.outsider }); };
  const seenActions = new Proxy(actions, { get: (t, k) => (k === "actionRead"
    ? (a) => (hid(a && a.viewer, a && a.id) ? unseenAction(a.id) : t.actionRead(a))
    : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  /* leg-earning, real; of its own deps R7 reads only connections' `edgeSevered` (no citation here is severed: severing is
     leg-earning's and connections' to test), and content is not read, so neither module is built on this host. */
  const legEarning = on ? onHostLegEarning(st) : legEarningOf(host, { record, membership, promotion, content: {}, connections: { edgeSevered: () => false } });
  if (!on) legEarning.migrate();
  /* basis-versions, real, for the project's stance on a question (K5131: `conclusionOf`, its R22). On a world with no basis-versions world under
     it nothing here makes a version, so the services its acts ask of inquiry, content and accepted-work are never called. */
  const basisVersions = on ? on.bv : basisVersionsOf(host, { record, membership, promotion, content: {}, now: () => clock.now,
    inquiry: { earned: () => ({ earned: { capture: {} } }), legCapped: () => null, cyclePath: () => null, basisFor: () => ({ ok: true, legs: [] }) },
    acceptedWork: { acceptedLegRefusals: () => [] } });
  if (!on) basisVersions.migrate();
  const ap = actionPlansOf(host, { record, membership: sight, promotion, legEarning, basisVersions, ...given, actions: omit.includes("actions") ? null : seenActions,
                                   clocks: omit.includes("clocks") ? null : clocks,
                                   ...(omit.includes("duties") ? { duties: null } : duties !== undefined ? { duties } : {}), now: () => clock.now });

  let n = 0, nd = 0, ni = 0, nr = 0;
  const commitBundle = (id, type, text, state) => {
    const sha = createHash("sha256").update(text, "utf8").digest("hex");
    record.transact(() => record.commit({ bundleId: id, type, title: id, project: null, snapKey: `b${++n}`, kind: "promotion",
      base: EMPTY, author: V("alice"), writer: null, operation: null,
      files: [{ path: "bundle.md", text, sha256: sha, bytes: Buffer.byteLength(text) }], state, priorState: null,
      group: "test-group", created: clock.now, lastUpdated: clock.now, criticality: null, at: clock.now }));
  };
  const w = {
    st, host, record, membership, promotion, ap, actions, clocks, clock, stand, determinations, cite, legEarning, bars, standardsHeld,
    escalations, runs, reg, ctl,
    /** R35: withhold `id` from `viewer` (a member's stamp), as a narrower sight rule would. */
    hide(viewer, id) { hidden.add(`${viewer}|${id}`); },
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    fm: (id) => { const t = record.readFile(id, "bundle.md")?.text; return t ? parseFrontmatter(t).data : null; },
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
    project(title, owner, extra = []) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, extra) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** A revision of a project's document with extra front-matter lines, by `author`. */
    reviseProject(id, title, extra, author) {
      const head = record.head(id);
      const held = record.readFile(id, "bundle.md").text;
      const idLine = held.split("\n").find((l) => l.startsWith("id:"));
      const text = projMd(title, extra).replace("---\n", `---\n${idLine}\n`);
      return promotion.promote({ bundleId: id, base: head.bundleSha, snapKey: `k${++n}`, author,
        files: [{ path: "bundle.md", text }], meta: { object_type: "project" } });
    },
    join(projectId, memberId, state = "joined") {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, 0, 't', 't')`, projectId, memberId, state);
    },
    /** A real inquiry bundle at `state`, drawn on by `projects`. */
    inquiry(projects = [], state = "open") {
      const id = `INQ-2026-${String(++ni).padStart(4, "0")}-q`;
      commitBundle(id, "inquiry", ["---", `id: ${id}`, "object_type: inquiry", `title: "${id}"`, `current_state: ${state}`, "---", "", "## Question", "", "Why?", ""].join("\n"), state);
      for (const p of projects) cite(id, p);
      return id;
    },
    setInquiryState(id, state) { st.sql.exec(`UPDATE bundles SET current_state=? WHERE bundle_id=?`, state, id); },
    /** A determination (a real CONF- bundle; its facts conformance's stand-in's). */
    determine({ project, outcomes, act = null, findings = [] } = {}) {
      const id = `CONF-2026-${String(++nd).padStart(4, "0")}-determination`;
      commitBundle(id, "determination", ["---", `id: ${id}`, "object_type: determination", `title: "${id}"`, "current_state: recorded", "---", "", "D.", ""].join("\n"), "recorded");
      determinations.set(id, { id, project, act: { id: act ?? `ACT-2026-${String(nd).padStart(4, "0")}`, actor: { role: "Town Clerk", body: "City of Port Ellery" } },
        outcomes, findings, at: clock.now, superseded_by: null });
      return id;
    },
    supersede(id, by) { determinations.get(id).superseded_by = by; },
    standard(id, { superseded = false } = {}) { standardsHeld.set(id, { superseded_by: superseded ? "STD-2026-9999-x" : null }); return id; },
    /** A planning run (ai-runs' stand-in), opened through the registered check and listener as `open` would. */
    openRun({ plan, project, actor = V("bob"), principal = RUN_PRINCIPAL, proposals = 20, status = "running", mode = "plan", skill = "planning@1" } = {}) {
      const run = `RUN-${++nr}`;
      const check = reg.checks.find((c) => c.mode === "plan");
      const said = mode === "plan" ? check.fn({ contextType: "project", contextId: project, plan, actor, viewer: actor }) : null;
      if (said) return said;
      runs.set(run, { run, status, mode, context_type: "project", context_id: project, principal_plane: principal, plan, skill,
                      bounds: { proposals: { allowed: proposals, consumed: 0 } } });
      for (const l of reg.listeners) l.fn({ run, contextType: "project", contextId: project });
      return { ok: true, run };
    },
    principalGate: runPrincipalGate,
  };
  return w;
}

/* On a basis-versions world's host (`on`), connections' tables already exist in a shape leg-earning's migration does not take, so
   leg-earning cannot be built there. R7's read is the one `projectsDrawingOn` makes over the real `refs` rows that world's connections wrote. */
function onHostLegEarning(st) {
  return { projectsDrawingOn: (id) => [...st.sql.exec(`SELECT DISTINCT r.bundle_id AS p FROM refs r JOIN bundles b ON b.bundle_id = r.bundle_id
    WHERE r.target_id=? AND r.kind='cites' AND b.object_type='project' ORDER BY r.bundle_id`, id)].map((r) => r.p) };
}

export function projMd(title, extra = []) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          `objective: "Find out what happened."`, ...extra, "references: []", "state_history: []", "---", "",
          "## Objective", "", "Find out.", ""].join("\n");
}

/** The common world: alice (owner) and bob joined in P; carol invited, not joined; dave a member outside it; Q a second
 *  project of dave's. An open inquiry I drawn on by P; a determination D of P, noncompliant on S1, compliant on S2,
 *  unclear on S3. */
export function seeded(opts = {}) {
  const w = world(opts);
  for (const m of ["alice", "bob", "carol", "dave"]) w.member(m);
  w.P = w.project("Budget watch", "alice");
  w.join(w.P, "bob");
  w.join(w.P, "carol", "invited");
  w.Q = w.project("Harbour watch", "dave");
  w.I = w.inquiry([w.P]);
  w.D = w.determine({ project: w.P, outcomes: [{ standard: "STD-2026-0001-a", outcome: "noncompliant" },
    { standard: "STD-2026-0002-b", outcome: "compliant" }, { standard: "STD-2026-0003-c", outcome: "unclear" }] });
  w.SI = { kind: "inquiry", inquiry: w.I };
  w.S1 = { kind: "outcome", determination: w.D, standard: "STD-2026-0001-a" };
  w.S2 = { kind: "outcome", determination: w.D, standard: "STD-2026-0002-b" };
  w.S3 = { kind: "outcome", determination: w.D, standard: "STD-2026-0003-c" };
  return w;
}

/** Open a plan in P about `subjects` by bob; throws on refusal. */
export function opened(w, subjects = [w.SI, w.S1]) {
  const r = w.ap.planOpen({ project: w.P, subjects, title: "What we do about it", author: V("bob"), viewer: V("bob") });
  if (!r.ok) throw new Error(`fixture open refused: ${JSON.stringify(r).slice(0, 400)}`);
  w.PL = r.id;
  return r;
}

/** Add an option by bob; throws on refusal. */
export function option(w, fields = {}) {
  const r = w.ap.optionAdd({ plan: w.PL, summary: "Write to the clerk", category: "awareness", subjects: [w.S1], author: V("bob"),
                             viewer: V("bob"), ...fields });
  if (!r.ok) throw new Error(`fixture option refused: ${JSON.stringify(r).slice(0, 400)}`);
  return r.option;
}

/** Choose options by bob; throws on refusal. */
export function choose(w, options, extra = {}) {
  const r = w.ap.optionDispose({ plan: w.PL, options, disposition: "chosen", author: V("bob"), viewer: V("bob"), ...extra });
  if (!r.ok) throw new Error(`fixture choose refused: ${JSON.stringify(r).slice(0, 400)}`);
  return r;
}

export const by = (who, extra = {}) => ({ author: V(who), viewer: V(who), ...extra });
/** R42: a member's reason for taking an outward step before the infraction it serves is documented. */
export const FIRST = Object.freeze({ why_first: "A deadline comes first" });
