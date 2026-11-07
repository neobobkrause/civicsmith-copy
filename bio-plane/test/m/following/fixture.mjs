/* following's test fixture: a Durable Object storage stand-in over node:sqlite (the plane's `sql.exec` cursor shape,
   `transactionSync` as savepoints) with the real modules following reads through — record-core, membership,
   extraction (the readings events reads), provenance (the register a landing writes; product code imports neither,
   promotion reaches them), entities (the body's identifiers) and
   events (its Legistar import and observed meetings) — over the fictional test profile, to which a test adds a
   Legistar system and body scheme as test data (the profile names none).
   Services injected, coded to their requirements (K1563 (1)): `content`'s extent context (no container extent held); `monitoring`'s host (its R65: pause, epoch,
   claim, running, ranked, land; `land` registers the capture under a new bundle in the request's project and writes
   the document's reading as promotion's projection does, extraction R20), its `schedule` (R16's unscheduled
   `per_meeting` rows) and `monitor` (R1–R10's answer); and `capture.acquire`'s capture-request arm (acquisition
   R21–R23), serving bytes a test puts at an address, answering `unchanged` to a matching `heldSha`; and `standards`' reads
   R20 and R21 use (its R5, R8, R34, R37; `law-relations` R11 through its R48), over the policies a test holds in
   `w.policies`, with `content`'s table (its R45 read contract, a policy's text passages) created for the test. */
import { DatabaseSync } from "node:sqlite";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { Extraction } from "../../../src/extraction/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { Entities } from "../../../src/entities/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { followingOf } from "../../../src/following/index.mjs";
import { monitoringOf, MONITOR_PAUSE_SETTING } from "../../../src/monitoring/index.mjs";
import { noSuchPlan } from "../../../src/action-plans/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { listenerRefusal } from "../../../src/membership/index.mjs";
import { acquireRefusals } from "../acquisition/fixtures.mjs";
import { standardRead as standardReadFixture } from "../standards/fixtures.mjs";
import { occurrences as occurrencesFixture } from "../duties/fixtures.mjs";
import { watchReaderRegistrar } from "../plan-work/fixtures.mjs";
import { standingQuestions as standingQuestionsFixture } from "../answers/fixtures.mjs";
import { monitorAnswer } from "../monitoring/fixtures.mjs";
import { registersOf } from "../../../src/registers/index.mjs";
import { acquisitionOf, streamRegister, probeRegister, sourceChanged, keyedFetch } from "../../../src/acquisition/index.mjs";
import { bucket, captureStore, governor } from "../acquisition/fixture.mjs";

/* The refusals of the providers following's stand-ins answer, each made by the provider's real code (K4990; fix round 10):
   acquire's FETCH_FAILED, standards' NO_SUCH_STANDARD, duties' NO_SUCH_DUTY, plan-work's registration refusals and answers'
   standing-question refusals. A stand-in returns a copy, with the id the test's own call named. */
const FETCH_FAILED = await acquireRefusals({ kind: "fetch_failed" });
const NO_SUCH_STANDARD = standardReadFixture().absent;
const NO_SUCH_DUTY = occurrencesFixture().absent;
const WATCH_READER = watchReaderRegistrar();
const STANDING = standingQuestionsFixture();

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? s : Buffer.from(s)).digest("hex");
export const MACHINE = "class:daemon";
export const MEMBER = "member:alice";
export const BOB = "member:bob";
export const OUTSIDER = "member:outsider";
export const T0 = Date.UTC(2026, 9, 6, 12, 0, 0);
export const DAY = 86400000;
export const CLIENT = "ellery";
export const API = `https://webapi.legistar.com/v1/${CLIENT}`;

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = { next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
              [Symbol.iterator]() { return c; }, toArray() { const o = rows.slice(i); i = rows.length; return o; } };
  return c;
}
function storage() {
  const db = new DatabaseSync(":memory:");
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) db.exec(t);
  let n = 0;
  return {
    db,
    sql: { exec(q, ...args) {
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    } },
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}

/** The test profile's view with a Legistar system (API and site hosts of one origin) and a body scheme it issues, and a
 *  register system a person scheme names, as test data. */
export function testView({ legistar = true } = {}) {
  const view = structuredClone(combine(["test-port-ellery"]).view);
  if (legistar) {
    view.systems = [...(view.systems || []),
      { origin: "ellery.legistar", name: "Legistar (test)", hosts: ["webapi.legistar.com"], path: { re: "^/v1/ellery(/|$)", flags: "i" }, basis: "TEST" },
      { origin: "ellery.legistar", name: "Legistar site (test)", hosts: ["ellery.legistar.com"], basis: "TEST" },
      { origin: "ellery.licences", name: "Licence register (test)", hosts: ["licences.ellery.example"], basis: "TEST" }];
    const numeric = (form) => ({ form, pattern: { re: "^(\\d+)$" }, normal: [{ group: 1 }], basis: "TEST" });
    view.spaces = { ...view.spaces,
      body: { ...view.spaces.body, forms: [...view.spaces.body.forms, numeric("legistar-body")] },
      person: { ...view.spaces.person, forms: [...view.spaces.person.forms, { form: "licence", pattern: { re: "^(L-\\d{5})$" }, normal: [{ group: 1 }], basis: "TEST" }] } };
    view.identifier_schemes = [...(view.identifier_schemes || []),
      { scheme: "legistar_body", label: "Legistar BodyId", entity_kinds: ["body"], space: "body", form: "legistar-body", systems: ["ellery.legistar"], basis: "TEST" },
      { scheme: "ellery_licence", label: "licence number", entity_kinds: ["person"], space: "person", form: "licence", systems: ["ellery.licences"], basis: "TEST" }];
  }
  return view;
}

/** A fresh world: the real modules, the injected host, monitoring and capture, and `following` over them. T53: the real
 *  `registers` on the same host (its R1, R32–R34, R44), over the world's view; with `keyed`, acquisition's own store on the
 *  same record (an evidence bucket, the call ledger of `acquisitionOf`, a governor), `keyed.credentials` its key holder and
 *  `keyed.profile` the profile it reads limits from, handed to following as its keyed path (R41, R42). */
export function world({ view = testView(), now = T0, realRetrieval = false, door = null, keyed = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const ev = keyed ? bucket() : null;
  const record = recordOf(host, keyed ? { evidence: ev, evidencePrefix: "bio/captures/" } : undefined);
  record.migrate();
  record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "test");
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* the real monitoring (its R65 host: pause, epoch, claim, running, ranked, and the landing through promotion) */
  const w0 = { t: now };
  const mon = monitoringOf(host, { record, membership, env: {}, now: () => w0.t, intent: null, publication: null });
  const promotion = mon.promotion;
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  const x = new Extraction(st, { record, membership, promotion });
  x.migrate();
  const prov = provenanceOf(host, { record, membership, promotion, now: () => "2026-10-01T00:00:00Z" });
  prov.migrate();
  const ents = new Entities(st, { record, membership, provenance: prov });
  ents.migrate();
  ents.view = () => ({ ...view, conflicts: [] });
  let clock = 0;
  /* content's extent context (its R12–R13) for a capture whose container extent this record does not hold */
  const content = { contentContextFor: () => ({ chain: null, pageCount: null, pageBoxes: null, container: { held: false }, format: null, office: null }) };
  const evs = eventsOf(host, { record, membership, provenance: prov, extraction: x, content, entities: ents,
                              now: () => new Date(Date.UTC(2026, 9, 1, 0, 0, clock++)).toISOString(), view: () => view });
  evs.migrate();
  for (const [m, role] of [["alice", "member"], ["bob", "member"], ["outsider", "member"], ["root", "admin"]])
    st.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, role, status, created, updated) VALUES (?, 'c', ?, 'active', '2026-01-01', '2026-01-01')`, m, role);

  const w = { st, host, record, membership, x, prov, ents, ev: evs, view, mon, promotion, get t() { return w0.t; }, set t(v) { w0.t = v; },
    rows: (q, ...a) => [...st.sql.exec(q, ...a)], one: (q, ...a) => [...st.sql.exec(q, ...a)][0] || null };

  /* ---- what bytes the network serves, and what capture did ---- */
  w.served = new Map();      /* address → string | {status} */
  w.store = new Map();       /* sha → bytes */
  w.readings = new Map();    /* address → {content_type, facts}: the reading a landing of that address carries */
  w.fetches = [];            /* each capture-request arm call's options */
  w.serve = (address, body) => { w.served.set(address, typeof body === "string" ? body : JSON.stringify(body)); };
  const capture = {
    async acquire(_body, opts) {
      w.fetches.push(opts);
      const q = opts.captureRequest;
      const got = w.served.get(q.locator);
      if (got === undefined) return structuredClone(FETCH_FAILED);
      const bytes = new TextEncoder().encode(got);
      const s = sha(bytes);
      w.store.set(s, bytes);
      if (q.heldSha === s) return { status: 200, body: { ok: true, existed: true, unchanged: true, capture: { sha256: s } } };
      const retrieved = new Date(w.t).toISOString().replace(/\.\d{3}Z$/, "Z");
      return { status: 200, body: { ok: true, existed: false, document: { locator: q.locator, retrieved, file: `snapshots/${s.slice(0, 12)}`,
        authority_state: "undetermined", authority_basis: `${retrieved}: fetched for a follow; no authority asserted`,
        origin: { kind: "named_request" }, attestation_attempts: [],
        ...(w.readings.has(q.locator) ? { reading: { content_type: w.readings.get(q.locator).content_type, reader_version: 1, found: true, at: retrieved,
                                                     entities: [], facts: w.readings.get(q.locator).facts } } : {}),
        provenance_chain: [{ who: "instance test (Civicsmith/0.0.0)", asserts: localize("following.fixture.these_bytes_served_for", "these bytes were served for {locator} at {retrieved}", { locator: String(q.locator), retrieved: String(retrieved) }), bound: false, via: "direct" }],
        capture: { method: q.render ? "rendered" : "direct", grade: "B", actor_class: opts.member ? "member" : "daemon", actor: opts.sessMember || null,
                   sha256: s, encoding: "binary", bytes: bytes.length, content_type: "application/json",
                   ...(q.credential ? { credentialed: { kind: q.credential.kind }, reproducible_by_public: false } : {}) } } } };
    },
  };

  /* ---- monitoring: its real host (R65), with `schedule` (R16's unscheduled per_meeting rows, which need retrieval's
     projection, a module following does not use) and `monitor` (R1–R10, monitoring's own tests') standing in ---- */
  w.landed = [];
  w.watched = [];            /* {bundle, address}: per_meeting subjects */
  w.monitored = [];
  const real = mon.sweepHost();
  const sweepHost = Object.freeze({ ...real, land: (request, filed, at, say) => {
    const r = real.land(request, filed, at, say);
    w.landed.push({ request, filed, at, say, bundle: r && r.bundle_id, answer: r });
    return r;
  } });
  w.pause = (on) => record.setSetting(MONITOR_PAUSE_SETTING, on ? { paused: true, by: "class:admin", at: "2026-10-01T00:00:00Z" } : { paused: false }, "class:admin");
  const monitoring = {
    sweepHost: () => sweepHost,
    schedule: () => ({ due: [], scheduled: [], unscheduled: w.watched.map((s) => ({ bundle: s.bundle, address: s.address, frequency: "per_meeting",
      reason: word("monitoring.cadence_meeting_schedule") })) }),
    /* monitoring's real answer (its published fixture): the nth call's answer is the nth tick's, each with its own capture */
    async monitor({ bundleId }) { w.monitored.push({ bundleId, at: w.t }); return (await monitorAnswer({ ticks: w.monitored.length, kind: "modified" })).answer; },
  };
  w.bundle = (id, { type = "information", project = "" } = {}) => {
    st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version, project)
                 VALUES (?, ?, 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1, ?)`, id, type, project);
    return id;
  };
  w.project = (id, participant = "alice") => {
    w.bundle(id, { type: "project" });
    st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, ?, 'joined', 1, '2026-01-01', '2026-01-01')`, id, participant);
    return id;
  };
  w.entity = (label, kind = "body") => ents.createEntity({ kind, label, note: "a subject the test registers", declaredBy: MEMBER }).entity_id;
  /* a proceeding registered with its facet {forum, kind, number} by entities (its R45), as events' own fixture does */
  let procN = 0;
  w.proceeding = (label, kind = "commitment_suit") => {
    const forum = w.entity(`${label}, its forum`, "institution");
    const r = ents.createEntity({ kind: "proceeding", label, note: "a proceeding the test registers", declaredBy: MEMBER,
                                  proceeding: { forum, kind, number: `MC-26-${String(1000 + procN++).slice(-4)}` } });
    if (!r.ok) throw new Error(`fixture: createEntity refused ${r.reason}: ${r.detail}`);
    return r.entity_id;
  };
  w.identify = (entityId, scheme, id) => {
    const r = ents.addIdentifier({ entityId, scheme, id: String(id), basis: "the test's cited source", by: MEMBER });
    if (!r.ok) throw new Error(`fixture: addIdentifier refused ${r.reason}: ${r.detail}`);
  };
  /* ---- standards: the policies a test holds, each {id, kind?, held?, text: [content ids], superseded_by?, access?,
     sight?: "group" | "bundle", readers?: [viewer], period?, version_basis?, temporal?: [law relations]} ---- */
  /* `content`'s table as its R45 read contract states it (the columns R20 reads, and those the row needs) */
  st.sql.exec(`CREATE TABLE IF NOT EXISTS content (content_id TEXT PRIMARY KEY, capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL,
               extent_kind TEXT NOT NULL, extent TEXT NOT NULL, ref TEXT NOT NULL, minted_by TEXT NOT NULL, at TEXT NOT NULL)`);
  w.policies = [];
  const pol = (id) => w.policies.find((p) => p.id === id) || null;
  const answer = (p) => ({ id: p.id, kind: p.kind || "policy", held: p.held || "text", text: p.text || [], access: p.access ?? null,
    superseded_by: p.superseded_by ?? null, sight: { class: p.sight || "group" }, period: p.period || { from: null, to: null },
    version_basis: p.version_basis ?? null });
  const reads = (p, viewer) => !!p && (viewer === MACHINE || (p.readers ? p.readers.includes(viewer) : /^member:/.test(String(viewer))));
  w.standardReads = 0;
  const standards = {
    standardsIn({ kind, after = null, limit = 200, viewer }) {
      w.standardReads++;
      const all = w.policies.filter((p) => (p.kind || "policy") === kind && reads(p, viewer)).sort((a, b) => (a.id < b.id ? -1 : 1))
        .filter((p) => after === null || p.id > after);
      const page = all.slice(0, limit);
      return { ok: true, items: page.map(answer), truncated: all.length > limit, cursor: all.length > limit ? page.at(-1).id : null };
    },
    standardRead({ id, viewer }) { const p = pol(id); return reads(p, viewer) ? { ok: true, ...answer(p) } : { ...structuredClone(NO_SUCH_STANDARD), id, standard: id }; },
    isMeasure(id, viewer) { const p = pol(id); return !!p && (p.held || "text") === "text" && reads(p, viewer); },
    lawRelationsOf({ standard }) { const p = pol(standard); return { ok: true, standard, temporal: (p && p.temporal) || [], referential: [] }; },
  };
  /* a policy's text passage, held from a capture with a direct receipt at `address` retrieved at `retrieved` */
  w.policyText = (contentId, captureSha, bundleId, address, retrieved) => {
    st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at) VALUES (?,?,?,'document','{}','the whole document','plane',?)`,
                contentId, captureSha, bundleId, retrieved);
    if (address) prov.recordReceipt({ address, addressNorm: address, captureSha, retrieved });
    return contentId;
  };
  w.standards = standards;
  /* ---- the plans, duties, standing questions and watched addresses the watches of R22–R26 read, each a stand-in coded
     to its provider's requirements (action-plans R6/R22 planRead, noSuchPlan, refusePlanClosed; plan-work R9's door,
     R13's matterPromiseDuties with R15's met_at; duties R7 readDuty, R9–R11 occurrencesOf; answers R16, R34; monitoring
     R32, R71, R72) ---- */
  w.plans = new Map();           /* id → {id, project, state, closed?: {at}, subjects: [{key}]} */
  w.plan = (id, { project, state = "open", closedAt = null, matters = ["inquiry:I-1"] } = {}) => {
    w.plans.set(id, { id, project, state, ...(closedAt ? { closed: { at: closedAt } } : {}), subjects: matters.map((key) => ({ key })) });
    return id;
  };
  w.close = (id, at) => { const p = w.plans.get(id); p.state = "closed"; p.closed = { at }; };
  const actionPlans = {
    planRead({ id, viewer }) {
      const p = w.plans.get(id);
      if (!p || (viewer != null && !membership.inSight(p.project, viewer))) return noSuchPlan(id ?? null);
      return { ok: true, ...structuredClone(p) };
    },
  };
  w.promises = new Map();        /* `${plan} ${matter}` → [duty ids] (the matter's adopted promise-duties) */
  w.dutiesHeld = new Map();      /* id → {act, project?, withdrawn?, occurrences: [{state, at?}]}; `at` the instant read met */
  w.occurrenceReads = 0;         /* duties.occurrencesOf calls (R27: never read for promises_met) */
  w.promiseReads = [];           /* matterPromiseDuties calls, {plan, matter, nowMs, viewer} */
  w.promiseAnswer = null;        /* (plan, matter, answer) → answer: a test's override of plan-work's answer */
  w.duty = (id, { act = "publish the audit", project = null, met = [] } = {}) => {
    w.dutiesHeld.set(id, { act, project, occurrences: met.map((at) => (at ? { state: "met", at } : { state: "pending" })) });
    return id;
  };
  const dutySeen = (d, viewer) => viewer === MACHINE || (!!d && (!d.project || membership.inSight(d.project, viewer)));
  const duties = {
    readDuty({ dutyId, viewer }) {
      const d = w.dutiesHeld.get(dutyId);
      return d && dutySeen(d, viewer) ? { ok: true, found: true, duty: { duty_id: dutyId, performance: { act: d.act }, withdrawn: d.withdrawn || null } }
        : { ok: true, found: false, duty_id: dutyId };
    },
    occurrencesOf({ dutyId, viewer }) {
      w.occurrenceReads++;
      const d = w.dutiesHeld.get(dutyId);
      if (!d || !dutySeen(d, viewer)) return { ...structuredClone(NO_SUCH_DUTY), duty_id: dutyId };
      return { ok: true, duty_id: dutyId, occurrences: d.occurrences.map((o, i) => ({ key: `k${i}`, state: o.state,
        evidence: o.at ? [{ kind: "event", event_id: "EV", at: o.at }] : [] })) };
    },
  };
  w.watchReaders = [];
  const planWork = {
    registerWatchReader(module, fn) {
      if (typeof fn !== "function" || !module) return structuredClone(module ? WATCH_READER.noReader : WATCH_READER.noModule);
      if (w.watchReaders.length) return { ...structuredClone(WATCH_READER.again), module: w.watchReaders[0].module };
      w.watchReaders.push({ module, fn });
      return { ok: true, module };
    },
    matterPromiseDuties({ plan, matter, nowMs, viewer }) {
      w.promiseReads.push({ plan, matter, nowMs, viewer });
      const p = actionPlans.planRead({ id: plan, viewer });
      if (!p.ok) return p;
      const key = typeof matter === "string" ? matter : matter && matter.key;
      if (!p.subjects.some((x) => x.key === key))
        return { ok: false, reason: "MATTER_NOT_OF_PLAN", code: "MATTER_NOT_OF_PLAN", check: "C-151.1", detail: localize("following.fixture.plan_not_about_matter", "the plan is not about that matter. Nothing was written."), plan };
      const ids = w.promises.get(`${plan} ${key}`) || [];
      const ds = ids.map((id) => ({ duty_id: id, occurrences: w.dutiesHeld.get(id).occurrences }));
      const all_met = ds.length > 0 && ds.every((d) => d.occurrences.length && d.occurrences.every((o) => o.state === "met"));
      /* R15: when all met, the instant the last of them was read met; else null */
      const met_at = all_met ? ds.flatMap((d) => d.occurrences.map((o) => o.at)).sort().at(-1) ?? null : null;
      const a = { ok: true, plan, matter: key, duties: ds, all_met, partial: false, met_at };
      return w.promiseAnswer ? w.promiseAnswer(plan, key, a) : a;
    },
  };
  w.questions = new Map();       /* id → {id, author, question, ends, ended} */
  w.question = (id, author, { ends = "2026-12-31", question = "Anything new on the budget?" } = {}) => {
    w.questions.set(id, { id, author, question, ends, ended: null });
    return id;
  };
  const answers = {
    standingQuestionsOf({ viewer }) { return { ok: true, questions: [...w.questions.values()].filter((q) => q.author === viewer).map((q) => ({ ...q })) }; },
    standingQuestionEnd({ id, author }) {
      const q = w.questions.get(id);
      if (!q || q.author !== author) return { ...structuredClone(STANDING.noSuch), id };
      q.ended = { at: new Date(w.t).toISOString().replace(/\.\d{3}Z$/, "Z"), by: author };
      return { ok: true, id, ended: q.ended };
    },
    standingQuestionEndSet({ id, ends, author }) {
      const q = w.questions.get(id);
      if (!q || q.author !== author) return { ...structuredClone(STANDING.noSuchEndSet), id };
      if (q.ended) return { ...structuredClone(STANDING.ended), id };
      const was = q.ends; q.ends = ends;
      return { ok: true, id, ends, was };
    },
  };
  w.addresses = [];              /* {address, bundle, until, projects} */
  w.address = (address, bundle, { projects = [] } = {}) => { w.bundle(bundle); w.addresses.push({ address, bundle, until: null, projects }); return address; };
  w.addressEnds = [];
  monitoring.monitoring = ({ viewer }) => ({ ok: true, items: w.addresses.filter((a) => membership.inSight(a.bundle, viewer))
    .map((a) => ({ state: "scheduled", address: a.address, bundle: a.bundle, until: a.until, ...(a.until ? {} : { ends: "none_set" }) })) });
  monitoring.addressWatchers = (address) => (w.addresses.find((a) => a.address === address) || { projects: [] }).projects;
  monitoring.addressWatchEnd = ({ address, until, by, viewer }) => {
    const a = w.addresses.find((x) => x.address === address && membership.inSight(x.bundle, viewer));
    if (!a) return { ok: false, reason: "NO_SUCH_ADDRESS", code: "NO_SUCH_ADDRESS" };
    if (w.addressRefusal) return w.addressRefusal;
    w.addressEnds.push({ address, until, by });
    a.until = until;
    return { ok: true, address, until };
  };
  /* ---- actions' `actionsFor` (its R30, R65) and action-clocks' `ourDeadlines` (its R18), over the actions a test holds in
     `w.actionRows`: {id, proceeding?, clock: [{status, owed_by, date, basis?, text?}]}. Both page in id order. ---- */
  w.actionRows = [];
  const actions = {
    actionsFor({ proceeding = null, after = null, limit = 200 } = {}) {
      const all = w.actionRows.filter((a) => (!proceeding || a.proceeding === proceeding) && (after === null || a.id > after)).sort((a, b) => (a.id < b.id ? -1 : 1));
      const page = all.slice(0, limit);
      return { ok: true, items: page.map((a) => ({ id: a.id })), limit, truncated: all.length > limit, cursor: page.length ? page.at(-1).id : null };
    },
  };
  w.deadlineReads = [];
  const actionClocks = {
    ourDeadlines({ from = null, to = null, after = null, limit = 500, viewer = null } = {}) {
      w.deadlineReads.push({ from, to, after, viewer });
      const all = [];
      for (const a of [...w.actionRows].sort((x, y) => (x.id < y.id ? -1 : 1)))
        a.clock.forEach((e, i) => {
          if (e.status !== "pending" || e.owed_by !== "group" || (from && e.date < from) || (to && e.date > to)) return;
          all.push({ action: a.id, ord: i, date: e.date, basis: e.basis ?? null, text: e.text ?? null, owed_by: "group", zone: "America/New_York", local_day: "2026-10-06", past: e.date < "2026-10-06" });
        });
      const from2 = after ? all.filter((d) => `${d.action}#${d.ord}` > after) : all;
      const page = from2.slice(0, limit);
      return { ok: true, items: page, limit, truncated: from2.length > limit, cursor: page.length ? `${page.at(-1).action}#${page.at(-1).ord}` : null };
    },
  };
  /* retrieval's door for the marks read (its R86, K31's pattern): a stand-in taking one registration, or, with
     `realRetrieval`, the real retrieval, whose `browse` (its R85) a test calls over the registered read */
  w.markReaders = [];
  const retrieval = door ? door : realRetrieval ? retrievalOf(host, { record, membership, promotion, extraction: x })
    : { registerBrowseMarks(module, fn) {
          const refused = listenerRefusal(w.markReaders, module, fn);
          if (refused) return refused;
          w.markReaders.push({ module, fn });
          return { ok: true, module };
        } };
  Object.assign(w, { actionPlans, duties, planWork, answers, actions, actionClocks, retrieval });
  /* registers, the real one on this host (T53), reading the world's view and clock; its imports run on its own alarm, never here */
  const registers = registersOf(host, { record, membership, promotion, entities: ents, view: () => view, now: () => w0.t,
    acquisition: { streamRegister, probeRegister, sourceChanged, keyedFetch }, store: { core: record, env: {}, provenance: prov } });
  w.registers = registers;
  /* the keyed path: acquisition's store over this record and provenance, its ledger acquisition's own instance (R131) */
  let keyedDep = null;
  if (keyed) {
    const profile = keyed.profile || null;
    const core = { evidenceStore: () => record.evidenceStore(), getSetting: (k, ...a) => (k === "jurisdiction_profiles" && profile ? [profile] : record.getSetting(k, ...a)) };
    const store = captureStore({ core, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9" }, gov: governor(), prov });
    store.acquisition = acquisitionOf(host, { record, provenance: prov, membership });
    if (keyed.credentials) store.credentials = keyed.credentials;
    store.followStanding = async (a) => w.f.followStanding(a);
    w.keyedStore = store;
    keyedDep = { store };
  }
  w.f = followingOf(host, { record, membership, capture, entities: ents, events: evs, monitoring, standards, view: () => view,
                            actionPlans, planWork, duties, answers, actions, actionClocks, retrieval, registers, ...(keyedDep ? { keyed: keyedDep } : {}), now: () => w.t,
                            bytes: async (s) => w.store.get(s) || (ev ? ev.held.get(`bio/captures/${s}`) || null : null) });
  w.capture = capture;
  w.monitoring = monitoring;
  w.sweepHost = sweepHost;
  return w;
}

/* ---- captured Legistar JSON for a fictional body (BodyId 41) ---- */
export const BODY_ID = 41;
export const meetingRow = (id, date, time, extra = {}) => ({ EventId: id, EventBodyId: BODY_ID, EventBodyName: "Port Ellery Selectboard",
  EventDate: `${date}T00:00:00`, EventTime: time, EventAgendaStatusName: "Final", EventMinutesStatusName: "Draft",
  EventAgendaLastPublishedUTC: null, EventMinutesLastPublishedUTC: null, EventInSiteURL: null, ...extra });
export const itemRow = (id, eventId, extra = {}) => ({ EventItemId: id, EventItemEventId: eventId, EventItemAgendaNumber: "1",
  EventItemMatterId: 900, EventItemMatterFile: "26-0001", EventItemTitle: "A resolution", EventItemActionName: "Adopted",
  EventItemPassedFlag: 1, EventItemMoverId: null, EventItemSeconderId: null, ...extra });
export const voteRow = (id, itemId, personId, value = "Content") => ({ VoteId: id, VoteEventItemId: itemId, VotePersonId: personId, VoteValueName: value, VoteResult: 1 });
export const matterRow = (id, extra = {}) => ({ MatterId: id, MatterFile: `26-${id}`, MatterTypeName: "Ordinance", MatterStatusName: "Introduced",
  MatterIntroDate: "2026-09-01T00:00:00", MatterPassedDate: null, MatterEnactmentNumber: null, MatterEnactmentDate: null, ...extra });

/** A followed Legistar body: registered, with its BodyId in the test scheme. */
export function body(w, label = "Port Ellery Selectboard") {
  const id = w.entity(label);
  w.identify(id, "legistar_body", BODY_ID);
  return id;
}

/** An observed meeting of `body` in `events`: a member's event concerning the body, attested by a dated fact of a held
 *  capture (`value` a local minute in the profile's zone), with `status`. */
export function observedMeeting(w, bodyId, value, status = "EventScheduled") {
  const s = sha(`meeting ${value} ${Math.random()}`);
  w.bundle("INFO-2026-0900-minutes");
  w.st.sql.exec(`INSERT OR REPLACE INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, 'INFO-2026-0900-minutes', 'snapshots/m', 'utf8', 1, '2026-10-01T00:00:00Z')`, s);
  w.x.writeReading({ bundleId: "INFO-2026-0900-minutes", captureSha: s, composed: true,
    reading: { content_type: "text/html", reader_version: 1, found: true, at: "2026-10-01T00:00:00Z", entities: [], facts: {} } });
  const df = w.ev.recordDatedFact({ captureSha: s, extent: { kind: "document" }, kind: "meeting", value, method: "read by a member", by: MEMBER });
  if (!df.ok) throw new Error(`fixture: dated fact refused ${df.reason}: ${df.detail}`);
  const e = w.ev.createEvent({ kind: "meeting", status, concerns: [bodyId], attestations: [{ datedFactId: df.dated_fact.dated_fact_id }], by: MEMBER });
  if (!e.ok) throw new Error(`fixture: createEvent refused ${e.reason}: ${e.detail}`);
  return e.event_id ?? e.event?.event_id;
}

/** An event of a proceeding in `events`: a member's event concerning it, dated by a fact of a held capture (`value` a
 *  local minute or day in the profile's zone). */
export function proceedingEvent(w, proceedingId, value, kind = "hearing", status = "EventScheduled") {
  const s = sha(`proceeding event ${kind} ${value} ${Math.random()}`);
  w.bundle("INFO-2026-0901-docket");
  w.st.sql.exec(`INSERT OR REPLACE INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, 'INFO-2026-0901-docket', 'snapshots/d', 'utf8', 1, '2026-10-01T00:00:00Z')`, s);
  w.x.writeReading({ bundleId: "INFO-2026-0901-docket", captureSha: s, composed: true,
    reading: { content_type: "text/html", reader_version: 1, found: true, at: "2026-10-01T00:00:00Z", entities: [], facts: {} } });
  const df = w.ev.recordDatedFact({ captureSha: s, extent: { kind: "document" }, kind, value, method: "read by a member", by: MEMBER });
  if (!df.ok) throw new Error(`fixture: dated fact refused ${df.reason}: ${df.detail}`);
  const e = w.ev.createEvent({ kind, status, concerns: [proceedingId], attestations: [{ datedFactId: df.dated_fact.dated_fact_id }], by: MEMBER });
  if (!e.ok) throw new Error(`fixture: createEvent refused ${e.reason}: ${e.detail}`);
  return { event: e.event_id ?? e.event?.event_id, capture: s };
}
