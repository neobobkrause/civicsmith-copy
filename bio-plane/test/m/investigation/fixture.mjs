/* investigation over the modules it uses: record-core, membership, promotion, observation-log, provenance, steps and
   leg-earning (over connections and the modules it is made over) are the real ones, on a real SQLite database
   (node:sqlite) standing in for a Durable Object's storage, at the plane's shape (`sql.exec` answers a cursor), as
   `steps`' own fixture builds them. `basis-versions` (its R41 `projectQuestions` and R22 `conclusionRecordOf`), `intent`
   (its `progress`, `gaps`, `watchSet`), `inquiry` (its R55 `questionWaits`, R58 `documentWaits`) and `capture-requests`
   (its R23 `captureRequests`) stand in at the interfaces this module reads, each answering from a table the test
   sets, so a test states exactly what the record holds. Every test drives `investigation` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { legEarningOf } from "../../../src/leg-earning/index.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";
import { investigationOf, INVESTIGATION_TABLES } from "../../../src/investigation/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
  };
  return c;
}
function storage() {
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

export const ANN = "member:ann", BOB = "member:bob", CAT = "member:cat", DAN = "member:dan", OUT = "member:out", BOSS = "member:boss";
export const AI = "class:ai/tok1";
export const NOW = "2026-10-09T18:00:00.000Z";
/* P1: Ann owns, Bob joined, Out invited; P2: Bob owns; PH: hidden, Cat owns. */
export const P1 = "PROJ-2026-0001", P2 = "PROJ-2026-0002", PH = "PROJ-2026-0003";
/* Q1, Q2: questions P1 draws on; Q3: one P2 draws on too; QH: inside the hidden project. */
export const Q1 = "INQ-2026-0001-a", Q2 = "INQ-2026-0002-b", Q3 = "INQ-2026-0003-c", QH = "INQ-2026-0004-h";

/** The world. `opts.zone` false holds no time zone. */
export function world(opts = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const w = { st, host, record, membership, clock: NOW };
  let tick = 0;
  const now = () => new Date(Date.parse(w.clock) + 1000 * tick++).toISOString();
  w.now = now;
  const promotion = promotionOf(host, { record, membership, now });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  promotion.registerFact("citedBy", "connections", () => []);
  promotion.registerFact("caseMember", "publication", () => false);
  const observationLog = observationLogOf(host, { record, membership, provenance: null, extraction: null, now: () => Date.parse(now()) });
  observationLog.migrate();
  const prov = provenanceOf(host, { record, membership, promotion, now });
  prov.migrate();
  const extraction = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  extraction.migrate();
  const content = contentOf(host, { record, membership, provenance: prov, extraction, now });
  content.migrate();
  const entities = entitiesOf(host, { record, membership, provenance: prov, now });
  entities.migrate();
  const connections = connectionsOf(host, { record, membership, promotion, content, extraction, capture: {}, entities });
  connections.migrate();
  const legEarning = legEarningOf(host, { record, membership, promotion, content, connections, entities, provenance: prov, now });
  const view = opts.zone === false ? () => null : () => ({ time_zone: { value: "America/Los_Angeles" } });
  const steps = stepsOf(host, { record, membership, promotion, observationLog, legEarning, view, now });
  Object.assign(w, { promotion, observationLog, prov, legEarning, steps, rows: (q, ...a) => [...st.sql.exec(q, ...a)] });

  /* the stand-ins' tables */
  w.drawn = new Map();        // project → [{inquiry, stance}]
  w.conclusions = new Map();  // `${project}|${q}` → [{act, state, claim, at}]
  w.progress = new Map();     // project → progress answer
  w.gapsOf = new Map();       // project → [gap]
  w.dated = new Map();        // question → [{index, text, date, state}]
  w.docWaits = new Map();     // question → [{document}]
  w.requests = new Map();     // `${question}|${state}` → [row]
  w.personNamed = null;       // a word whose presence in a text names a person in no public role
  const seesQ = (q, viewer) => { try { return membership.inSight(q, viewer) === true; } catch { return false; } };
  const basisVersions = {
    projectQuestions: ({ project, after }) => ({ items: (w.drawn.get(project) ?? []).filter((x) => !after || x.inquiry > after)
      .map((x) => ({ inquiry: x.inquiry, legs: false, stance: x.stance ?? "none" })), cursor: null }),
    conclusionRecordOf: (project, q, viewer) => {
      if (!membership.inSight(project, viewer)) return { history: [], stance: null };
      const h = w.conclusions.get(`${project}|${q}`) ?? [];
      return { history: h, stance: h.length ? h[h.length - 1] : null };
    },
  };
  const intent = {
    progress: ({ project }) => w.progress.get(project) ?? { ok: true, project, objective: "Know whether the award was proper", condition: null,
      computable: false, why: word("intent.why.progress_cannot_computed") },
    gaps: ({ project }) => ({ ok: true, project, gaps: w.gapsOf.get(project) ?? [] }),
    watchSet: ({ project }) => ({ entities: [`ENT-for-${project}`], progressions: [], captures: [], limit: 1000, truncated: false, cursor: null }),
  };
  const inquiry = {
    questionWaits: ({ question, viewer }) => (seesQ(question, viewer) ? { ok: true, question, waits: w.dated.get(question) ?? [] } : { ok: true, question, waits: [] }),
    documentWaits: ({ questions, viewer }) => ({ ok: true, questions: questions.filter((q) => seesQ(q, viewer)).map((q) => ({ question: q, waits: w.docWaits.get(q) ?? [] })) }),
  };
  const captureRequests = {
    captureRequests: ({ target, state }) => { const rows = w.requests.get(`${target}|${state}`) ?? []; return { count: rows.length, limit: 1, truncated: false, requests: rows }; },
  };
  const personWarning = ({ text, viewer }) => (w.personNamed && String(text).includes(w.personNamed)
    ? { code: "PERSON_IN_NO_PUBLIC_ROLE", key: "k", translation: "t", persons: [{ entity_id: "ENT-2026-0009", label: w.personNamed }], viewer } : null);
  w.intent = intent;          // the stand-in itself, so a test may answer differently (R18's pages, a failing read)
  w.inv = investigationOf(host, { record, membership, promotion, steps, legEarning, basisVersions, intent, inquiry, captureRequests,
                                  provenance: prov, view, now, personWarning });
  for (const [m, role] of [["ann", "member"], ["bob", "member"], ["cat", "member"], ["dan", "member"], ["out", "member"], ["boss", "admin"]])
    st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, created, updated) VALUES (?, 'c', ?, ?, 'active', '2026-01-01', '2026-01-01')`, m, `${m}-h`, role);
  w.bundle = (id, { type = "inquiry", project = "", title = `t ${id}`, state = "open" } = {}) => {
    st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version, project)
                 VALUES (?, ?, 'g', ?, ?, '2026-01-01', '2026-01-01', 'x', 1, ?)`, id, type, title, state, project ?? "");
    return id;
  };
  w.state = (id, state) => st.sql.exec(`UPDATE bundles SET current_state = ? WHERE bundle_id = ?`, state, id);
  w.participant = (project, member, { owner = false, state = "joined" } = {}) =>
    st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated, joined_at)
                 VALUES (?, ?, ?, ?, '2026-01-01', '2026-01-01', '2026-01-01')`, project, member, state, owner ? 1 : 0);
  w.project = (id, setting, owner, title) => {
    w.bundle(id, { type: "project", title });
    st.sql.exec(`INSERT OR REPLACE INTO project_sight (project_id, setting) VALUES (?, ?)`, id, setting);
    w.participant(id, owner, { owner: true });
  };
  w.project(P1, "discoverable", "ann", "Project One");
  w.participant(P1, "bob");
  w.participant(P1, "out", { state: "invited" });
  w.project(P2, "discoverable", "bob", "Project Two");
  w.project(PH, "hidden", "cat", "Hidden Project");
  w.bundle(Q1); w.bundle(Q2); w.bundle(Q3); w.bundle(QH, { project: PH });
  w.drawn.set(P1, [{ inquiry: Q1 }, { inquiry: Q2 }]);
  w.drawn.set(P2, [{ inquiry: Q3 }]);
  w.drawn.set(PH, [{ inquiry: QH }]);
  /* a machine holding run RUN-1 for Ann */
  w.runs = () => { w.inv.registerRunHolder("ai-runs", (by, run) => (by === AI && run === "RUN-1" ? { principal: ANN } : null));
                   w.steps.registerRunHolder("ai-runs", (by, run) => (by === AI && run === "RUN-1" ? { enabled_by: "ann-h's assistant", principal: ANN } : null)); };
  /** A step, created by `by` (Ann by default), its id; throws when refused. */
  w.step = (args = {}) => {
    const r = steps.stepCreate({ place: { questions: [Q1] }, work: "Ask the clerk for the 2025 contract file", by: ANN, ...args });
    if (!r.ok) throw new Error(`fixture stepCreate refused: ${JSON.stringify(r)}`);
    return r.step;
  };
  w.end = (step, end = "ended", by = ANN) => { steps.stepStart({ step, by }); const r = steps.stepEnd({ step, end, by }); if (!r.ok) throw new Error(JSON.stringify(r)); };
  /** A leg in a question's basis, as leg-earning holds it (its R12's table). */
  w.leg = (q, ord, target, role = "supports", grade = "B", at = NOW) =>
    st.sql.exec(`INSERT INTO inquiry_basis (bundle_id, ord, target_id, target_type, role, grade, at) VALUES (?,?,?,?,?,?,?)`, q, ord, target, "information", role, grade, at);
  w.tables = () => INVESTIGATION_TABLES.map((t) => t.name);
  /** Every row of every investigation table, for "nothing was written". */
  w.snapshot = () => JSON.stringify(w.tables().map((t) => w.rows(`SELECT * FROM ${t}`)));
  return w;
}

/** A project document, as the record holds one, for an act that revises it. */
export function projectMd(id, title = "Project One") {
  return ["---", `id: ${id}`, "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
    "prior_state: null", `created: "2026-10-03T00:00:00Z"`, `last_updated: "2026-10-03T00:00:00Z"`, "group: test-group",
    "objective: Know whether the award was proper", "references: []", "state_history: []", "---", "", "## Objective", "",
    "Know whether the award was proper.", "", "## Session Log", ""].join("\n");
}
