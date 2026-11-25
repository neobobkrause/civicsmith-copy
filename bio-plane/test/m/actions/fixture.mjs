/* actions over the modules it uses, each the real one where it writes or reads the record (record-core, membership,
   promotion, provenance), on a real SQLite database (node:sqlite) standing in for a Durable Object's storage, answering
   as workerd's does (a cursor, and its LIKE/GLOB cap; K313, K316). What actions registers with retrieval, the
   capture content presents for a document (R11), connections' `refs` projection
   (R25's `responses`) are stand-ins the test controls; conformance is the real module (it brings reevaluation and
   inquiry, whose columns on `bundles` are added here), or a stand-in in its R9 shape where a test passes one (R8). Every test drives
   `actions` at its interface. */
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { actionsOf } from "../../../src/actions/index.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { Retrieval } from "../../../src/retrieval/index.mjs";
import { actionRegistrar } from "../retrieval/fixtures.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import * as grammar from "../../../src/action-grammar/index.mjs";
import { DatabaseSync } from "node:sqlite";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` or `.length` of it is undefined. It also refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB
   pattern too complex"), which node:sqlite does not (K313). This storage answers as workerd does (K316). */
export const WORKERD_PATTERN_CAP = 50;
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() {
      const rest = c.toArray();
      if (rest.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${rest.length}`);
      return rest[0];
    },
  };
  return c;
}
/** A Durable Object's storage over an in-memory SQLite database. */
export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
      const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
      if ([...literal, ...bound].some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP))
        throw new Error("LIKE or GLOB pattern too complex");
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

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
export const V = (id) => `member:${id}`;
export const ALICE = "alice";
export const MACHINE = "class:daemon";
export const NOW_MS = Date.parse("2026-09-28T12:00:00Z");

/** An action's bundle.md; `fm` lines are joined into its front matter. */
export function actionMd(id, lines = [], { state = "planned" } = {}) {
  return ["---", `id: ${id}`, "object_type: action", `title: ${id}`, `current_state: ${state}`,
          'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', ...lines, "---", "", "An action.", ""]
    .join("\n");
}
export const CP = ["counterparty:", "  state: named", "  role: Town Clerk", "  body: Town of Port Ellery"];

/* `recordAs(record)`, when given, is the record-core instance `actions` is handed (a test's spy over the real one). */
/* `deps`, when given, are further dependencies handed to `actionsOf` (a stand-in a test controls). */
export function world({ profiles = ["test-port-ellery"], retrieval = true, conformance = null, context = null, recordAs = null, deps = {} } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  /* inquiry's columns on `bundles`, as the store's boot migrates them. */
  for (const c of ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"])
    st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  /* connections' `refs` projection, as far as R25 joins it. */
  if (conformance) st.db.exec(`CREATE TABLE refs (bundle_id TEXT, target_id TEXT, kind TEXT)`);
  const clock = { ms: NOW_MS };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  if (profiles) record.setSetting("jurisdiction_profiles", profiles, V("admin"));
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => new Date(clock.ms).toISOString() });
  /* retrieval's projection table, made by retrieval's own migrate (K354), which the record's promotion writes. Its
     registrations below are the test's, so this instance joins no promotion. */
  new Retrieval({ storage: st, record, membership, promotion, extraction: {}, observation: {} }).migrate();
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  const prov = provenanceOf(host, { record, membership, promotion, now: () => new Date(clock.ms).toISOString() });
  prov.migrate();
  const captures = new Map();
  /* content as a stand-in for the capture a document presents (R11), and, for R108's passage, the real content's context of
     a capture (`contentContextFor`) once the real content is made below; an empty context before then, or with a conformance
     stand-in (which brings none). */
  let realContent = null;
  const reg = { facts: [], decorations: [] };
  /* retrieval's registrars are the real ones (its published `actionRegistrar`); each registration is also kept in `reg`,
     for the tests that read what actions registered. */
  const registrar = retrieval ? actionRegistrar() : null;
  const retrievalSeam = retrieval ? {
    registerActionFacts: (m, fn) => { reg.facts.push({ m, fn }); return registrar.registerActionFacts(m, fn); },
    registerProjectionDecoration: (m, fn) => { reg.decorations.push({ m, fn }); return registrar.registerProjectionDecoration(m, fn); },
  } : null;
  const a = actionsOf(host, { record: recordAs ? recordAs(record) : record, membership, promotion, retrieval: retrievalSeam, conformance,
                              content: { captureFor: (id) => captures.get(id) ?? null,
                                         contentContextFor: (s) => context ?? (realContent ? realContent.contentContextFor(s) : {}),
                                         mint: (args) => realContent.mint({ ...args, ...(context ? { context } : {}) }) },
                              now: () => clock.ms, ...deps });
  /* the real conformance (the default dep) brings inquiry onto this host through reevaluation: its tables, as the
     store's boot migrates them. */
  if (!conformance) {
    /* extraction's tables as far as content, entities and connections join them; what a reading holds is empty. */
    for (const q of [
      `CREATE TABLE readings (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, content_type TEXT, reading TEXT, at TEXT, capture_format TEXT)`,
      `CREATE TABLE reading_refs (capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL, ref TEXT NOT NULL, ref_kind TEXT, ref_key TEXT,
         label TEXT, pos_kind TEXT, pos TEXT, pos_ref TEXT, occurrence TEXT NOT NULL DEFAULT '', seq INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (capture_sha, ref, occurrence))`,
      `CREATE TABLE reading_ref_terms (capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL, ref TEXT NOT NULL, src TEXT NOT NULL,
         term TEXT NOT NULL, PRIMARY KEY (capture_sha, ref, src, term))`,
      `CREATE TABLE reading_text_source (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, transcribed INTEGER NOT NULL DEFAULT 0,
         terminal_step TEXT, engines TEXT, derivation_cap TEXT, steps INTEGER NOT NULL DEFAULT 0, chain TEXT, calibrations TEXT)`]) st.db.exec(q);
    const extraction = { readingOf: () => null, unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [],
                         onReading: () => ({ ok: true }) };
    const content = contentOf(host, { record, membership, provenance: prov, extraction });
    content.migrate();
    realContent = content;
    const connections = connectionsOf(host, { record, membership, promotion, content, extraction, capture: {} });
    connections.entities.migrate();
    connections.migrate();
    inquiryOf(host, { record, membership, promotion, content, connections, entities: connections.entities, provenance: prov }).migrate();
  }
  /* the dated lines, the events and the duties actions reaches on this host (T33-73): their tables, as the store's boot
     migrates them. */
  for (const m of [a.events, a.lines, a.duties]) if (m && typeof m.migrate === "function") m.migrate();
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, a, clock, reg, captures,
    rows: (q, ...x) => st.sql.exec(q, ...x).toArray(),
    row: (q, ...x) => st.sql.exec(q, ...x).toArray()[0] ?? null,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = w.text(id); return t ? parseFrontmatter(t).data : null; },
    /** A promotion of `id` with `text` as its bundle.md, by `author` (default a member). */
    promote(id, text, { author = V(ALICE), extra = {}, files = [], register = [] } = {}) {
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`, author,
        files: [{ path: "bundle.md", text }, ...files], meta: { object_type: text.includes("object_type: action") ? "action" : "information" },
        register, ...extra });
    },
    /** An action created by a member; throws when refused. */
    action(id, lines = [], opts = {}) {
      const r = w.promote(id, actionMd(id, [...CP, "action_kind: records_request", ...lines], opts), opts);
      if (!r.ok) throw new Error(`fixture action refused: ${JSON.stringify(r).slice(0, 500)}`);
      return r;
    },
    /** An information bundle registering one capture of its own; answers the capture's sha. */
    doc(id, words = `the text of ${id}`) {
      const s = sha(words);
      const text = ["---", `id: ${id}`, "object_type: information", `title: ${id}`, "current_state: collected",
                    'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', "---", "", "A document.", ""].join("\n");
      const r = w.promote(id, text, { files: [{ path: `snapshots/${id}.txt`, text: words }],
        register: [{ sha256: s, path: `snapshots/${id}.txt`, encoding: "utf8", bytes: Buffer.byteLength(words) }] });
      if (!r.ok) throw new Error(`fixture doc refused: ${JSON.stringify(r).slice(0, 400)}`);
      captures.set(id, s);
      return s;
    },
    decorate: (id, nowMs = clock.ms, viewer = null) =>
      reg.decorations[0].fn({ bundle_id: id, object_type: "action" }, { nowMs, viewer }),
  };
  return w;
}

/* R8 (T45; K2781 (4)): a breach action rests on a live determination noncompliant for at least one standard it names.
   A stand-in's outcomes in conformance R9's shape. */
export const STD = "STD-2026-0001-standard";
export const NONCOMPLIANT = Object.freeze([{ standard: STD, outcome: "noncompliant" }]);
export const COMPLIANT = Object.freeze([{ standard: STD, outcome: "compliant" }]);
/** A determination as conformance's determine act leaves it, read back by the real `determinationRead`: its row, its
 *  standard's outcome (the standard held, so a viewer who sees the project sees it, conformance R24), and its CONF-
 *  document; `outcome` per standard. */
export function realDetermination(w, D, project, { outcome = "noncompliant", author = V(ALICE) } = {}) {
  if (!w.record.head(STD)) {
    const r = w.promote(STD, ["---", `id: ${STD}`, "object_type: standard", `title: ${STD}`, "current_state: held",
      'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', "---", "", "s", ""].join("\n"), { extra: { replay: true } });
    if (!r.ok) throw new Error(`fixture standard refused: ${JSON.stringify(r).slice(0, 300)}`);
  }
  w.st.sql.exec(`INSERT INTO determinations (determination_id, project_id, act_id, act_minted, act_description, act_role,
    act_body, act_at, act_evidence, author, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    D, project, "ACT-2026-0001", 1, "the act", "Town Clerk", "Town of Port Ellery", "2026-09-01", "[]", author, "2026-09-02T00:00:00Z");
  w.st.sql.exec(`INSERT INTO determination_standards (determination_id, ord, standard_id, outcome, in_force, in_force_why)
    VALUES (?,?,?,?,?,?)`, D, 0, STD, outcome, "in_force", "the test's standard");
  const r = w.promote(D, ["---", `id: ${D}`, "object_type: determination", `title: ${D}`, "current_state: recorded",
    'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', "---", "", "d", ""].join("\n"), { extra: { replay: true } });
  if (!r.ok) throw new Error(`fixture determination refused: ${JSON.stringify(r).slice(0, 300)}`);
}

/** The codes another module mints, read from the rows `action-grammar` holds for them (its R9): each row's `where` names the
 *  module and function that mint the code, so a test names those codes through the declaration, not a list of its own. */
export function mintedIn(dir) {
  const out = {};
  for (const v of Object.values(grammar)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const [code, row] of Object.entries(v))
      if (row && typeof row === "object" && typeof row.where === "string" && row.where.startsWith(`src/${dir}/`)) out[code] = code;
  }
  return Object.freeze(out);
}
