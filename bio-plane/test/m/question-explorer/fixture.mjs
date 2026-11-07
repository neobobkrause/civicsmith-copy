/* question-explorer over the modules it uses: the real record-core, membership and ai-accounts on a real SQLite
   database (node:sqlite) standing in for a Durable Object's storage, and stand-ins the test controls for the rest, each
   written to its requirements' Provides as `questionExplorerOf`'s deps take them (K61, K120): `steps` (R1 `stepCreate`,
   R5 `stepEnd`, R6 `stepDelete`, R9 `recordProduct`, R17 `findRecipients`), `ai-use` (R6 `exploreAllowed`, R9
   `exploreAsk`, R10 `estimate`), `ai-runs` (R9 `open` with T41's `step` and `origin`, R13 `close` answering R76's
   actual cost, R29 `boundOf`/`consumeBound`, R75's test bar and group results, R78's `partAdmitted` over `run-rules`
   R29 with the deployment's test-instance fact `w.testInstance`), `run-rules` R19's deploy gate,
   `capture-requests` (its door, R49's refusal, R55's `step`), `connections` (R4 `read`, R54 `asserted`), `retrieval`
   (R23 `contentAxis`, R69 `zone`), `inquiry` (R43 `subjectEntityOf`), `leg-earning` (R4 `basisFor`, R13
   `projectsDrawingOnPaged`) and `basis-versions` (`currentOf`). Every stand-in records the calls made to it. Bundles,
   files, and the read contracts this module joins (`entities` R35's `entities` and `resolutions`, `content` R45's
   `content`) are written in their stated columns. Every test drives question-explorer at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { legEarningOf } from "../../../src/leg-earning/index.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { runProductionsOf } from "../../../src/run-productions/index.mjs";
import { captureRequestsOf } from "../../../src/capture-requests/index.mjs";
import { questionExplorerOf } from "../../../src/question-explorer/index.mjs";
import * as runRules from "../../../src/run-rules/index.mjs";
import { contentContextFor } from "../content/fixtures.mjs";
import { catalogueFor } from "../ai-accounts/catalogue.mjs";
import { gateOf } from "../ai-catalogue/fixture.mjs";
import { LAYER } from "../content/fixture.mjs";

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
/* A test set with one matter (Civicsmith's own holds none yet, so it opens nothing), and the records that hold its bar. */
export const TEST_SET = Object.freeze({ id: "civicsmith", version: 1, matters: [{ id: "m1", title: "a matter" }] });
export const bar = (part, over = {}) => ({ part, set: "civicsmith", set_version: 1, false_alarm_rate: 0.1, passed: true,
                                            graded_by: "harness", at: "2026-10-01T00:00:00Z", ...over });
export const VERIFIED_CHECK = { mode: "check", run: "RUN-0", verified_by: "member:dana", at: "2026-10-01T00:00:00Z", evidence: "seen" };
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export const NOW = "2026-10-10T09:00:00Z";
export const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-r", Q3 = "INQ-2026-0003-s";
export const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", HDOC = "INFO-2026-0009-h";
export const PROJ = "PROJ-2026-0001-p", HPROJ = "PROJ-2026-0009-h";
export const ENT = "ENT-2026-10001", PERSON = "ENT-2026-10002", PERSON2 = "ENT-2026-10003";
/* A capture's sha with its text kept, so `w.doc` can hold the same capture in content's real chain (content's fixture). */
const CAP_TEXT = new Map();
export const capOf = (text) => { const s = sha(text); CAP_TEXT.set(s, text); return s; };
export const CAP = capOf("capture of a"), CAP2 = capOf("capture of b"), HCAP = capOf("capture of h");

function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
  };
  return c;
}

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
  };
  return {
    db, sql,
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}

/* The read contracts of earlier modules this one joins, in their stated columns. */
const CONTRACT_TABLES = `
CREATE TABLE IF NOT EXISTS entities (entity_id TEXT PRIMARY KEY, kind TEXT NOT NULL, at TEXT);
CREATE TABLE IF NOT EXISTS resolutions (capture_sha TEXT, bundle_id TEXT, ref TEXT, entity_id TEXT, grade TEXT, established INTEGER);
CREATE TABLE IF NOT EXISTS refs (bundle_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (bundle_id, target_id, kind));
CREATE TABLE IF NOT EXISTS register (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, path TEXT, encoding TEXT,
  bytes INTEGER, registered TEXT, authored INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS captured_locators (capture_sha TEXT, address TEXT, retrieval_locator TEXT, address_norm TEXT);
CREATE TABLE IF NOT EXISTS links (address TEXT, fragment TEXT, source_capture TEXT, address_norm TEXT);
CREATE TABLE IF NOT EXISTS reading_refs (capture_sha TEXT, ref TEXT, kind TEXT, key TEXT);
CREATE TABLE IF NOT EXISTS content (content_id TEXT PRIMARY KEY, capture_sha TEXT, bundle_id TEXT, extent_kind TEXT, extent TEXT,
  ref TEXT, stale INTEGER, minted_by TEXT, cited_as TEXT, chain_kind TEXT);
`;

export function questionMd(id, { subject = null, surfacedBy = "human", state = "open" } = {}) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
          `current_state: ${state}`, "prior_state: null", `surfaced_by: ${surfacedBy}`,
          ...(subject ? [`subject_entity: ${subject}`] : []),
          `created: "2026-10-01T00:00:00Z"`, `last_updated: "2026-10-01T00:00:00Z"`, "references: []",
          "state_history: []", "---", "", "## Question", "", "What happened?", ""].join("\n");
}

/* `migrate: false` builds the explorer through its factory alone, as a host that never calls its `migrate()` (R15);
   `w.tablesBefore` then names the explore tables the storage held just before the factory ran. */
/* `aiAccounts` hands question-explorer a stand-in for ai-accounts in place of the real one (the rest of the world
   keeps the real one). */
/* `basisVersions` hands it basis-versions' own answer in place of the stand-in below (a test's real `currentOf`). */
export function world({ gateOpen = true, testSet = TEST_SET, migrate = true, aiAccounts: standIn = null, basisVersions: bvIn = null } = {}) {
  const over = { aiAccounts: standIn, basisVersions: bvIn };
  const st = storage();
  const host = { storage: st };
  for (const t of RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";"))
    if (t.trim()) st.db.exec(t);
  st.db.exec(CONTRACT_TABLES);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* ai-accounts holds the accounts, their uses and the material limits (T48, N996 §5); credentials, which the other
     modules built here still take, reaches the same instance over the same storage (ai-accounts R32). */
  /* (T53) ai-accounts' accounts are of ai-catalogue's plans: the real catalogue, seeded from ai-catalogue's published
     fixture through ai-accounts' `catalogueFor` (as answers' and credentials' worlds take it); without it every account act
     fails closed CATALOGUE_UNAVAILABLE (ai-accounts R40, R63). `w.standard` awaits its seeding. */
  const catalogue = catalogueFor(host, { record });
  const aiAccounts = aiAccountsOf(host, { record, membership, sealSecret: "test-seal-secret-0123456789", catalogue });
  aiAccounts.migrate();
  const credentials = credentialsOf(host, { record, membership, sealSecret: "test-seal-secret-0123456789", catalogue });
  credentials.migrate();

  const calls = [];
  const note = (name, a) => calls.push({ name, a });
  const w = {
    st, host, record, membership, aiAccounts, credentials, catalogue, clock, calls,
    subjects: {}, units: {}, asserted: {}, conns: [], captures: {}, held: new Set(),
    runs: new Map(), bounds: new Map(),
    /* What the record holds for the deploy gate (run-rules R19, R75's records) over a test set with one matter. */
    testBars: [bar("investigate"), bar("explore")], verifications: [VERIFIED_CHECK],
    groupResults: [], openRefuse: null, closeRefuse: null, closeThrows: false, openDelay: 0,
    /* ai-runs R78's `testInstance()`: the deployment's fact. (run-rules PR 72, T53) R19 now admits a part only on a Gate 1
       record for an entry, and ai-runs' `partAdmitted(part)` names none, so off a test instance nothing opens the gate
       (run-rules R29: no `entry_id` admits nothing outside a test instance). An open world is therefore a test instance,
       the gate open on R16's exception; a test sets it false to see the gate shut. */
    testInstance: gateOpen,
    servedOn: null, gateRecords: [],
    row: (q, ...a) => [...st.sql.exec(q, ...a)][0] ?? null,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => [...st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n,
    calledAs: (name) => calls.filter((c) => c.name === name).map((c) => c.a),
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
  };
  if (!gateOpen) w.testBars = [];
  /* Gate 1 held for `entry` (ai-gate R37's record, in ai-catalogue's published `gateOf` form) for the gate part of
     `investigate` and `explore` (run-rules R36: both `run`), off a test instance: the gate then opens unlabelled on R7's
     bar alone. `verdict` other than passes shows Gate 1 not passed. */
  w.gate1 = (entry = "claude-a", verdict = "passes") => {
    w.servedOn = entry;
    w.gateRecords = [{ ...gateOf(verdict), part: "run", entry_id: entry, grade: "MEASURED" }];
    w.testInstance = false;
    return w;
  };

  const aiRuns = {
    /* R73 (K2490): the run opens first, then its system step is created through the real steps' stepCreate with `run`
       the open run (steps R1's machine arm, held through the run holder the fixture registers as ai-runs would); the
       answer names the step. */
    async open(a) {
      note("open", a);
      if (w.openDelay) await new Promise((r) => setTimeout(r, w.openDelay));
      if (w.openRefuse) return w.openRefuse;
      w.runs.set(a.run, { ...a, status: "running" });
      for (const b of a.bounds || []) w.bounds.set(`${a.run}|${b.bound}`, { allowed: b.allowed, consumed: 0 });
      note("stepCreate", { place: a.place, work: a.work, by: a.principalPlane, run: a.run });
      const made = realSteps.stepCreate({ place: a.place, work: a.work, by: a.principalPlane, run: a.run });
      if (!made || made.ok === false) { w.runs.delete(a.run); return made; }
      w.runs.get(a.run).step = made.step;
      return { ok: true, run: a.run, status: "running", step: made.step };
    },
    /* R73: at close it ends the run's step as steps R5 allows a machine. R17: asynchronous, as ai-runs' is, and it
       refuses what ai-runs refuses: a bound outside RUN_BOUNDS and RUN_ENDINGS (run-rules' `checkBound`) or a condition
       outside CONDITION_KINDS (`checkCondition`), answered in its refusal shape (`terminated: false`, the code); `w.closeRefuse`
       is a refusal a test sets; success answers the real shape (`terminated: true`, no `ok`). */
    async close(a) {
      note("close", a);
      if (w.closeThrows) throw new Error("ai-runs could not be reached");
      if (w.closeRefuse) return w.closeRefuse;
      const bad = runRules.checkBound(a.bound) || runRules.checkCondition(a.condition);
      if (bad) return { run: a.run, found: true, terminated: false, ...bad };
      const r = w.runs.get(a.run);
      if (r) {
        r.status = "stopped";
        const end = { step: r.step, end: a.stepEnd, ...(a.stepEnd === "set_aside" ? { reason: a.reason } : {}), by: r.principalPlane };
        note("stepEnd", end);
        const e = realSteps.stepEnd(end);
        if (!e || e.ok === false) throw new Error(`stepEnd: ${JSON.stringify(e)}`);
      }
      return { run: a.run, found: true, terminated: true, actual: { usd: 0.42 } };
    },
    /* R28: the run as run-productions reads it (sight through membership, as ai-runs answers it). */
    runFor(run, viewer) {
      const r = typeof run === "string" ? w.runs.get(run.trim()) : null;
      if (!r || !membership.inSight(r.contextId, viewer)) return null;
      return { run: r.run, status: r.status === "running" ? "running" : "stopped", mode: r.mode, context_type: r.contextType,
               context_id: r.contextId, principal_plane: r.principalPlane, principal_ai: r.principalAi };
    },
    boundOf(run, bound) { const b = w.bounds.get(`${run}|${bound}`); return b ? { ...b } : null; },
    consumeBound(run, bound, n) {
      note("consumeBound", { run, bound, n });
      const k = `${run}|${bound}`;
      const b = w.bounds.get(k) || { allowed: 0, consumed: 0 };
      w.bounds.set(k, { ...b, consumed: b.consumed + n });
      return null;
    },
    groupTestResults(a) { note("groupTestResults", a); return { ok: true, part: a.part, results: w.groupResults }; },
    /* R78: `partAdmitted(part)`, run-rules R29 on what the record holds, with the deployment's test-instance fact.
       (T53) run-rules judges Gate 1 per entry (its R19), and this module asks with no entry, so on tranche's ai-runs
       nothing is admitted unlabelled. `w.servedOn` stands for the entry ai-runs would judge if it named one (its
       `partAdmitted(part, entry)`, ai-runs PR 96), with `w.gateRecords` the Gate 1 records held for it (`w.gate1`), so
       that the bar path R7 and R16 state can be driven at all; null (the default) is tranche's answer. */
    partAdmitted(part, entry = null) {
      /* (ai-runs PR 391, F1) the module now names the entry the paying account serves the run on; with none named,
         `w.servedOn` stands for one as before. The Gate 1 records held are those of that entry (`w.gateRecords`). */
      note("partAdmitted", entry === null ? { part } : { part, entry });
      const on = entry !== null ? entry : w.servedOn;
      return runRules.partAdmittedOn(testSet, part,
        { verifications: w.verifications, testBars: w.testBars, gateRecords: w.gateRecords.filter((g) => g.entry_id === on) },
        { testInstance: w.testInstance, ...(on !== null ? { entry_id: on } : {}) });
    },
  };
  const connections = {
    edgeSevered: () => false,
    /* R22 `citesInto`: the projects whose document cites the question, from the `refs` the test writes (`w.draw`). */
    citesInto: (id) => ({ confirmed: [...st.sql.exec(`SELECT bundle_id FROM refs WHERE target_id=? AND kind='cites' ORDER BY bundle_id`, id)]
      .map((r) => r.bundle_id), severed: [] }),
    asserted(a) { note("asserted", a); return { ok: true, member: w.asserted[a.bundleId] || [], source: [], containment: [] }; },
    read(a) {
      note("connRead", a);
      return { connections: w.conns.filter((c) => c.a_capture_sha === a.captureSha || c.b_capture_sha === a.captureSha)
        .map((c) => ({ connection: c })) };
    },
  };
  const retrieval = {
    zone: () => "UTC",
    contentAxis(a) {
      note("contentAxis", a);
      const b = w.captures[a.captureSha];
      return b ? { found: true, capture_held: true, bundle_id: b } : { found: false, capture_held: false };
    },
  };
  const inquiry = { subjectEntityOf: (id) => w.subjects[id] ?? null };
  /* leg-earning is the real module (merged, K2485): its R13 pages over connections' `refs` read contract (R58), with
     the stand-in's `edgeSevered` (R22) answering every edge live; its R4 `basisFor` over its own `inquiry_basis`. */
  const legEarning = legEarningOf(host, { record, membership, connections,
                                          promotion: { fact: () => ({ ok: false }) }, content: {} });
  const basisVersions = over.basisVersions || { currentOf: (p) => ({ current: `reading of ${p}` }) };
  /* steps is the real module (merged, K2491): R17 `findRecipients` over leg-earning's drawing projects and its own
     follows. Its registrations with promotion and observation-log are answered by stand-ins (neither is read here). */
  const realSteps = stepsOf(host, { record, membership, legEarning,
    promotion: { registerStep: () => ({ ok: true }) },
    observationLog: { registerAuthority: () => ({ ok: true }), onLookAnswered: () => ({ ok: true }) } });

  /* ai-use is the real module (merged, K2488): R6 `exploreAllowed` over the real credentials' switches and limits, R9
     `exploreAsk`, `exploreApprove`, `exploreAsksPending`, R10 `estimate`. Each call is recorded on its way through. */
  const realAiUse = aiUseOf(host, { record, membership, credentials, connections, zone: "UTC" });
  const aiUse = Object.fromEntries(["exploreAllowed", "exploreAsk", "estimate", "exploreApprove", "exploreAsksPending"]
    .map((k) => [k, (a) => { note(k, a); return realAiUse[k](a); }]));
  /* ai-runs holds its runs (the run holder steps R1 asks for a machine's step, registered as ai-runs registers it). */
  realSteps.registerRunHolder("ai-runs", (by, run) => {
    const r = w.runs.get(run);
    return r && r.principalPlane === String(by).replace(/\/.*$/, "") ? { principal: r.principalPlane, enabled_by: r.enabledBy?.enabled_by ?? null } : null;
  });
  /* capture-requests is the real module (merged, K2504): its door (R1–R9), R49's held-address rule over provenance's
     `captured_locators` and `register` read contracts, and R55's `step`, read through the real steps. Its other
     providers (the observation log, the governor, capture, promotion, inquiry, standards) are not reached by the door. */
  const captureRequests = captureRequestsOf(host, {
    record, membership, runs: aiRuns, steps: realSteps, credentials,
    observations: { registerAuthority: () => ({ ok: true }) }, governor: {}, capture: {}, promotion: {}, inquiry: {},
    standards: () => ({}) });
  captureRequests.migrate();
  /* run-productions is the real module (merged, K2499): R24 `readPages` over the real credentials' limits and
     ai-runs' bounds (the stand-in's `runFor`, `boundOf`, `consumeBound`), a document's capture and its text units
     answered by content's and extraction's stand-ins (`w.units`). */
  const contentFx = contentContextFor();
  const runProductions = runProductionsOf(host, {
    record, membership, connections, aiRuns, credentials, steps: realSteps, legEarning,
    /* content is its real code over captures held by the real chain, from content's published fixture (K4990, K4995);
       `w.doc` registers each document's capture there. */
    content: { captureFor: (b, authored) => contentFx.captureFor(b, authored),
               contentContextFor: (sha) => contentFx.contentContextFor(sha), mint: (a) => contentFx.mint(a) },
    extraction: { unitsOf: (sha) => ({ units: w.units[sha] || [], state: "indexed" }) },
    strength: {}, citation: {}, basisVersions: { onCandidates: () => ({ ok: true }), onMachinePassage: () => null },
    /* inquiry's R62 slot and basis-versions' R49 slot (above), each of which run-productions registers its
       machine-passage read with (K2655, K2664): stand-ins, so this store needs none of inquiry's tables (none is read
       here). */
    inquiry: { onMachinePassage: (module) => ({ ok: true, module }) },
    now: () => Date.parse(clock.now) });
  runProductions.migrate();
  const tablesBefore = [...st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'explore_%' ORDER BY name`)]
    .map((r) => r.name);
  const p = questionExplorerOf(host, {
    record, membership, aiAccounts: over.aiAccounts || aiAccounts, connections, retrieval, inquiry, legEarning, basisVersions,
    aiRuns, captureRequests, runProductions,
    steps: realSteps, aiUse,
    held: () => { note("held", {}); return { verifications: w.verifications, testBars: w.testBars }; },
    testSet,
    now: () => Date.parse(clock.now),
  });
  if (migrate) p.migrate();
  Object.assign(w, { p, tablesBefore, legEarning, realSteps, aiUse, realAiUse, aiRuns, captureRequests, connections, retrieval });

  let rev = 0;
  w.bundle = (id, type, text, { project = null, state = null } = {}) => {
    st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, project)
                 VALUES (?, ?, 'g', ?, ?, 't', 't', ?, ?)
                 ON CONFLICT(bundle_id) DO UPDATE SET current_state=excluded.current_state, bundle_sha=excluded.bundle_sha`,
                id, type, id, state || (type === "inquiry" ? "open" : "collected"), sha(`${id}#${++rev}`), project);
    if (text != null)
      st.sql.exec(`INSERT INTO files (bundle_id, path, content, bytes, sha256) VALUES (?, 'bundle.md', ?, ?, ?)
                   ON CONFLICT(bundle_id, path) DO UPDATE SET content=excluded.content`, id, text, Buffer.byteLength(text), sha(text));
    membership.reindexProjectSight(id);
    return id;
  };
  w.member = (id, role = "member") => {
    st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, created, updated) VALUES (?, ?, ?, ?, 'active', 't', 't')`,
                id, `cover ${id}`, id, role);
    return id;
  };
  w.question = (id, { subject = null, surfacedBy = "human", state = "open", recipients = ["alice"] } = {}) => {
    w.bundle(id, "inquiry", questionMd(id, { subject, surfacedBy, state }), { state });
    w.subjects[id] = subject;
    w.follow(id, ...recipients);
    return id;
  };
  w.project = (id, participants = [], { owners = [], setting = "hidden" } = {}) => {
    w.bundle(id, "project", null);
    for (const m of participants)
      st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, 'joined', ?, 't', 't')`, id, m, owners.includes(m) ? 1 : 0);
    st.sql.exec(`INSERT INTO project_sight (project_id, setting) VALUES (?, ?)
                 ON CONFLICT(project_id) DO UPDATE SET setting=excluded.setting`, id, setting);
    return id;
  };
  /* Members follow a question by their own act (steps R16), so steps R17 answers them as its recipients. */
  w.follow = (question, ...members) => {
    for (const m of members) {
      const r = realSteps.questionFollow({ question, on: true, by: `member:${m}` });
      if (!r || r.ok === false) throw new Error(`follow ${m}: ${JSON.stringify(r)}`);
    }
  };
  /* An address the record already holds: an acquisition receipt's (provenance's `captured_locators`) for a capture
     registered to a document (capture-requests R49). */
  w.hold = (address, cap = CAP) => st.sql.exec(`INSERT INTO captured_locators (capture_sha, address, retrieval_locator, address_norm)
                                                VALUES (?, ?, ?, ?)`, cap, address, address, new URL(address).toString());
  /* A project draws on a question: its document cites it (connections' `refs`, R58). */
  w.draw = (question, project) => st.sql.exec(`INSERT OR IGNORE INTO refs (bundle_id, target_id, kind) VALUES (?, ?, 'cites')`, project, question);
  w.doc = (id, cap, { project = null, pages = 3 } = {}) => {
    w.bundle(id, "information", null, { project });
    w.captures[cap] = id;
    if (!CAP_TEXT.has(cap)) throw new Error(`w.doc: make the capture with capOf(text), not ${cap}`);
    const held = contentFx.world.cap(id, CAP_TEXT.get(cap));
    contentFx.world.doc(id, [held]);
    contentFx.world.read(held.sha, { chain: LAYER, pageCount: pages });
    st.sql.exec(`INSERT OR IGNORE INTO register (capture_sha, bundle_id, path, registered) VALUES (?, ?, ?, 't')`, cap, id, `snapshots/${id}`);
    w.units[cap] = Array.from({ length: pages }, (_, i) => ({ extent: { kind: "pdf-page", page: i }, ref: `page ${i + 1}`, text: `text of page ${i + 1}` }));
    return cap;
  };
  w.entity = (id, kind) => { st.sql.exec(`INSERT OR REPLACE INTO entities (entity_id, kind, at) VALUES (?, ?, 't')`, id, kind); return id; };
  w.resolve = (cap, bundleId, entity) =>
    st.sql.exec(`INSERT INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, established) VALUES (?, ?, 'r', ?, 'B', 1)`,
                cap, bundleId, entity);
  w.content = (id, bundleId, cap) =>
    st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, stale, minted_by)
                 VALUES (?, ?, ?, 'pdf-page', '{}', 'page 1', 0, 'member:alice')`, id, cap, bundleId);
  /* The standard world: alice, bob and carol members; dana an administrator, who holds the group's key (ai-accounts
     R5; its explore switch at its default, no); Q open with alice following it. */
  w.standard = async () => {
    for (const m of ["alice", "bob", "carol"]) w.member(m);
    w.member("dana", "admin");
    await catalogue.seeded;
    const k = await aiAccounts.groupKeySet({ key: "sk-ant-group-test", by: "member:dana" });
    if (!k || k.ok === false) throw new Error(`group key: ${JSON.stringify(k)}`);
    w.doc(DOC, CAP);
    w.doc(DOC2, CAP2);
    w.question(Q, { recipients: ["alice"] });
    return w;
  };
  /* An account's `explore` switch set by its owner's own act (ai-accounts R14); a project gets an account first (its
     key, R10, by its first owner, the first participant made one when it has none). */
  w.setExplore = async (owner, value) => {
    let by = "member:dana";
    if (owner.startsWith("project:")) {
      const id = owner.slice(8);
      let owners = membership.projectOwners(id);
      if (!owners.length) {
        st.sql.exec(`UPDATE project_participants SET owner=1 WHERE project_id=? AND member_id=(SELECT MIN(member_id) FROM project_participants WHERE project_id=?)`, id, id);
        owners = membership.projectOwners(id);
      }
      by = `member:${owners[0]}`;
      if (!aiAccounts.projectAccountState({ project: id, viewer: by }).held) {
        const k = await aiAccounts.projectKeySet({ project: id, key: `sk-ant-${id}`, by });
        if (!k || k.ok === false) throw new Error(`project key: ${JSON.stringify(k)}`);
      }
    } else if (owner.startsWith("member:")) by = owner;
    const r = aiAccounts.accountUsesSet({ owner, switch: "explore", on: value, by });
    if (!r || r.ok === false) throw new Error(`explore ${owner}: ${JSON.stringify(r)}`);
  };
  /* One of the account's owners approves exploring for today (ai-use R9). */
  w.approve = (owner) => {
    const by = owner === "group" ? "member:dana" : owner.startsWith("project:") ? `member:${membership.projectOwners(owner.slice(8))[0]}` : owner;
    const r = realAiUse.exploreApprove({ owner, day: clock.now.slice(0, 10), by, at: clock.now });
    if (!r || r.ok === false) throw new Error(`approve ${owner}: ${JSON.stringify(r)}`);
  };
  /* One tick with `owner`'s exploring set to yes, answering the run it opened. */
  w.openRun = async (owner = "group", question = Q) => {
    await w.setExplore(owner, "yes");
    const t = await p.exploreTick(clock.now);
    const o = t.opened.find((x) => x.question === question);
    if (!o) throw new Error(`no run opened: ${JSON.stringify(t)}`);
    return o;
  };
  return w;
}

export const CALLER = "class:ai";
