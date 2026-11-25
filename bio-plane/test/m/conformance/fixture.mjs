/* conformance over the modules it uses, each the real one (record-core, membership, promotion, content, inquiry,
   strength, reevaluation, publication, standards, contradiction), on a real SQLite database (node:sqlite) standing in for a Durable
   Object's storage. The modules those reach in turn are created by their own factories on the same host. What a later
   module fills (the producing group, `instance-setup`'s fact) and the readings content reads through extraction are
   stand-ins the test controls. The ceremonies that publish a case (`case-authoring`, `ratification`) are played through
   publication's R21 and R22, exactly as those modules call them. A contradiction candidate is formed by contradiction's
   own pairing and proposed through its door, a run gate standing in for `ai-runs`; `basis-versions`, which it reaches
   for a duty's reach and a question's conclusion, is a stand-in built from its stated interface. T33-70: the real
   `entities` (the actor's office entity, the participants) and `events` (the act is an event, with its dated facts and
   participants; a document's own date is a dated fact, which contradiction reads, K1610). The bridge (instance-setup
   R50) is the test's `offices` map, given as conformance's `officeEntityOf`. T35-61: `calculations` (R29's measures) is
   a stand-in built from its stated `read` (its R8–R10: asynchronous, the stored results and grade facts, a calculation
   withheld from a viewer answered exactly as an absent one), holding the test's `calcs`. T45-23: the real `case-check`
   (a case checked for publication and held unsigned, its state computed at each read), its preparation played by a
   stand-in for `case-authoring` built from its stated `publishPreflight` and `publishCase` (storing the preparation
   through publication's R21, as case-authoring does) and its lapse reads by a stand-in for `case-carriage` the test
   controls (`lapse`); the real `accepted-work`, its one registration filled by a stand-in for `case-import` built from
   its stated R16 functions (`finding`, `openFlags`, `withdrawals`, `moves`) over the test's `imports`, and
   `case-import`'s `importedCase` (its R4 as T46 built it: `group_fields`, its viewer rule) over the same. Every test drives `conformance` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { contentOf, canonicalExtent } from "../../../src/content/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { reevaluationOf } from "../../../src/reevaluation/index.mjs";
import { publicationOf } from "../../../src/publication/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { contradictionOf, inquiryServices } from "../../../src/contradiction/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { caseCheckOf } from "../../../src/case-check/index.mjs";
import { acceptedWorkOf } from "../../../src/accepted-work/index.mjs";
import { conformanceOf, conformanceOps } from "../../../src/conformance/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { importedWorld } from "../case-import/fixtures.mjs";
import { concludeAct } from "../basis-versions/fixtures.mjs";

/* case-import's real answer for an import it does not hold (its R4), from its published fixture: a store with no import. */
const noImport = (await importedWorld({ imports: [] })).ci;

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* The plane's shape (K316, K313): workerd's `sql.exec` answers a cursor (iterable once, `toArray()`, `one()`), not an
   array, so `[0]` or `.length` of it is undefined; and it refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB
   pattern too complex"), which node:sqlite does not. This storage answers as workerd does, so code that indexes a
   cursor or writes a long pattern fails here as it would in the Durable Object. */
export const WORKERD_PATTERN_CAP = 50;
export function cursor(rows) {
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

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
      if (literal.some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP)) throw new Error("LIKE or GLOB pattern too complex");
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

export const V = (id) => `member:${id}`;
export const MACHINE = "class:daemon";
/** The one run `ai-runs`' stand-in gate answers as running (contradiction R13). */
export const RUN = "RUN-2026-0001";
export const NOW = "2026-09-28T01:00:00Z";
export const SIG = (n = 1) => `-----BEGIN SSH SIGNATURE-----\nsig${n}\n-----END SSH SIGNATURE-----`;
export const KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIKEY";
/** A text layer's chain, unscoped. */
export const LAYER = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: null, calibration: null }];
/** A text unit of one page, as extraction's index holds it. */
export const U = (page, text, truncated = false) =>
  ({ extent: canonicalExtent({ kind: "pdf-page", page }), ref: `page ${page + 1}`, text, truncated });

/* The column inquiry writes on record-core's `bundles` (its R40), which the store's additive list creates today. The
   basis count and the superseded-by index are in inquiry's own table since T18 (its R36), which its `migrate()` makes. */
const BUNDLE_COLUMNS = ["inquiry_subject_entity TEXT"];
/* The columns of extraction's tables that inquiry, content and connections join. */
const EXTRACTION_JOINED = [
  `CREATE TABLE readings (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, content_type TEXT, reading TEXT,
     at TEXT, capture_format TEXT)`,
  `CREATE TABLE reading_refs (capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL, ref TEXT NOT NULL, ref_kind TEXT,
     ref_key TEXT, label TEXT, pos_kind TEXT, pos TEXT, pos_ref TEXT, occurrence TEXT NOT NULL DEFAULT '',
     seq INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (capture_sha, ref, occurrence))`,
  `CREATE TABLE reading_ref_terms (capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL, ref TEXT NOT NULL,
     src TEXT NOT NULL, term TEXT NOT NULL, PRIMARY KEY (capture_sha, ref, src, term))`,
  `CREATE TABLE reading_text_source (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL,
     transcribed INTEGER NOT NULL DEFAULT 0, terminal_step TEXT, engines TEXT, derivation_cap TEXT,
     steps INTEGER NOT NULL DEFAULT 0, chain TEXT, calibrations TEXT)`,
];

/** The readings extraction would provide: `readings[sha] = {chain, pageCount, …}`, `units[sha] = {units, state}`. */
function readings() {
  const r = { readings: {}, units: {}, readFor: {} };
  r.provider = {
    readingOf: (s) => (r.readings[s] ? { reading: { page_boxes: null }, chain: null, pageCount: null,
      textContainer: null, captureFormat: null, ...r.readings[s] } : null),
    unitsOf: (s) => r.units[s] || { units: [], state: null },
    capturesReadFor: (b) => (r.readFor[b] || []).map((capture_sha) => ({ capture_sha, at: null })),
    onReading: () => ({ ok: true }),
  };
  return r;
}

export function world({ group = "test-group" } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  for (const c of BUNDLE_COLUMNS) st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  for (const t of EXTRACTION_JOINED) st.db.exec(t);
  const clock = { now: NOW };
  const now = () => clock.now;
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now });
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  const ex = readings();
  const content = contentOf(host, { record, membership, extraction: ex.provider, now });
  content.provenance.migrate();
  content.migrate();
  const k = inquiryOf(host, { record, membership, promotion, content, now,
                              retrieval: { selectionResolve: noSelection().selectionResolve } });
  k.migrate();
  k.entities.migrate();
  k.connections.migrate();
  /* strength's factory does not reach inquiry itself (reported, CONFORMANCE #1): it is given the reads it walks. */
  const strength = strengthOf(host, { record, membership, now,
    inquiry: { basisFor: (id, o) => k.basisFor(id, o), earned: (e, t) => k.earned(e, t), legCapped,
               subjectEntityOf: (id) => k.subjectEntityOf(id) } });
  /* the registry and the world's events, the real modules on this host (layer 5); the view gives events its zone */
  const entities = k.entities;
  const view = { time_zone: { value: "UTC" } };
  const events = eventsOf(host, { record, membership, content, extraction: ex.provider, provenance: content.provenance,
                                  entities, readHooks: {}, view: () => view, now });
  events.migrate();
  const reevaluation = reevaluationOf(host, { record, membership, promotion, inquiry: k, content, strength, now });
  reevaluation.basisVersions.migrate();
  const publication = publicationOf(host, { record, membership, promotion, inquiry: k, now });
  const standards = standardsOf(host, { record, membership, promotion, content, now });
  standards.migrate();
  /* basis-versions as contradiction reads it (its R16–R19, R22, R37, R41): no project draws on an inquiry here, and its
     no-project conclude writes the question's conclusion through promotion, as that module does. */
  let n = 0;
  const bv = {
    projectsDrawingOn() { const out = []; out.bound = 32; out.truncated = false; return out; },
    conclusionOf: () => null,
    projectQuestions: () => ({ items: [], cursor: null }),
    conclude(args) {
      const head = record.head(args.target);
      const text = record.readFile(args.target, "bundle.md").text
        .replace(/^current_state: .*$/m, "current_state: concluded")
        .replace(/^prior_state: .*$/m, `prior_state: ${head.currentState}`)
        .replace(/\n---\n/, `\nconclusion: "${args.conclusion}"\nfalsifier: "${args.falsifier || "a record showing otherwise"}"\n---\n`);
      const r = promotion.promote({ bundleId: args.target, base: head.bundleSha, snapKey: `conclude${++n}`,
        author: args.author, files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
      /* basis-versions' answer to the concluded question, from its published fixture (K4990); the write above is this stand-in's */
      return r.ok ? concludeAct({ kind: "concluded", target: args.target }) : r;
    },
  };
  const contradiction = contradictionOf(host, { record, membership, promotion, basisVersions: bv, entities: {},
    extraction: { readingOf: (s) => ex.provider.readingOf(s) }, inquiry: inquiryServices(host), now });
  contradiction.migrate();
  /* ai-runs' gate, standing in: the one run `RUN` is running, and anyone may propose under it. */
  contradiction.registerRunGate("test", (id) => (id === RUN ? { found: true, running: true, refusal: null }
                                                            : { found: false, running: false, refusal: null }));
  /* the bridge, standing in for instance-setup R50: "role|body" → the office entity seeded for it */
  const offices = new Map();
  /* calculations' read (its R8–R10), standing in: `calcs[id] = {answer, hiddenFrom?}`, `answer` the stored calculation
     as read answers it; absent and withheld alike `{ok: true, found: false, calc_id}` */
  const calcs = new Map();
  /* every call of the stand-in's read is counted (R30: a refused act reads no calculation) */
  const calcReads = { n: 0 };
  const calculations = {
    async read({ calcId = null, viewer = null } = {}) {
      calcReads.n++;
      const c = calcs.get(calcId);
      if (!c || !viewer || (c.hiddenFrom || []).includes(viewer)) return { ok: true, found: false, calc_id: calcId };
      return { ok: true, found: true, calc_id: calcId, ...structuredClone(c.answer) };
    },
  };
  /* case-carriage's three lapse reads (its R4, R5, R13), and from T46 the same three over the interval since the check
     (its R19–R21, which case-check R2 latches through), standing in: none lapsed unless the test says so */
  const lapse = { sources: [], accepted: null, marks: [], fail: false };
  const sourcesLapsed = () => { if (lapse.fail) throw new Error("the sources read failed"); return lapse.sources; };
  const caseCarriage = {
    sourcesLapsed, acceptedWorkLapsed: () => lapse.accepted, marksLapsed: () => lapse.marks,
    sourcesLapsedSince: () => sourcesLapsed(), acceptedWorkLapsedSince: () => lapse.accepted,
    marksLapsedSince: () => lapse.marks,
  };
  /* case-authoring's pre-flight and preparation (its R34, R14), standing in: every case is ready; the preparation is a
     case document of the named case and edition, stored through publication's R21 */
  const caseAuthoring = {
    publishPreflight: () => ({ ready: true, first: null, blockers: [] }),
    publishCase: (a) => {
      const caseId = a.caseId, edition = a.edition ?? 1;
      const roles = (a.targets || []).map((t) => ({ target: t, version_sha: record.head(t).bundleSha, edition, role: "load_bearing" }));
      const text = caseDoc(caseId, edition, { project: a.project, roles });
      const st = publication.storeCaseDocument({ case: caseId, edition, text, author: a.author ?? V("olive"), at: NOW });
      if (!st.ok) return st;
      return { ok: true, caseId, edition, project: a.project,
               findings: roles.map((r) => ({ target: r.target, bundleSha: r.version_sha, role: r.role })), caseDocument: text };
    },
    calculationsAtPublication: async () => null,
  };
  const caseCheck = caseCheckOf(host, { record, publication, caseAuthoring, caseCarriage, now });
  /* case-import's R16 functions and R4 read, standing in, over `imports`: `findings` keyed "ref|edition" → {group,
     case, pair, acceptance}; `moves` the publisher moves as accepted-work R8 answers them; `editions` keyed
     "import|edition" → the importedCase edition's facts; `fail` makes every read throw (unreadable) */
  const imports = { findings: new Map(), moves: [], editions: new Map(), hiddenFrom: [], fail: false, caseFail: false,
                    caseReads: [] };
  const acceptedWork = acceptedWorkOf(host, { record, promotion });
  acceptedWork.registerAcceptedWork("case-import", {
    finding: ({ ref, edition, viewer }) => {
      if (imports.fail) throw new Error("the import could not be read");
      if (viewer && imports.hiddenFrom.includes(viewer)) return null;
      const f = imports.findings.get(`${ref}|${edition}`);
      return f ? { ref, edition, ...structuredClone(f) } : null;
    },
    openFlags: () => ({ flags: [], complete: true }),
    withdrawals: () => ({ withdrawals: [], cursor: null }),
    moves: ({ after = null, limit = 200 } = {}) => {
      if (imports.fail) throw new Error("the moves could not be read");
      const from = after ? imports.moves.findIndex((m) => m.move === after) + 1 : 0;
      const page = imports.moves.slice(from, from + limit);
      return { moves: structuredClone(page), cursor: from + limit < imports.moves.length ? page[page.length - 1].move : null };
    },
  });
  /* importedCase as case-import R4 states it (T46): a viewer who is not an active member (one never sent included) is
     answered as if no import exists; an edition answers `group_fields` (R34's keys and `read_at`) or `group_fields:
     null` with its note. `editions` "import|edition" → `{group_fields?, ...}` as the edition answers; `caseFail` makes
     the read throw; `caseReads` lists each read's viewer. */
  const caseImport = {
    importedCase: ({ import: imp, edition, viewer = null }) => {
      imports.caseReads.push(viewer);
      if (imports.caseFail) throw new Error("the import could not be read");
      const m = typeof viewer === "string" && viewer.startsWith("member:") ? viewer.slice(7) : null;
      const active = m && st.sql.exec(`SELECT status FROM members WHERE member_id=?`, m).toArray()[0]?.status === "active";
      const e = active ? imports.editions.get(`${imp}|${edition}`) : null;
      if (!e) return noImport.importedCase({ import: imp, edition, viewer });
      const gf = e.group_fields === undefined ? null : e.group_fields;
      return { ok: true, import: imp, edition: { edition, imported_at: NOW, imported_by: "olive", ...e, group_fields: gf,
                                                 ...(gf === null ? { group_fields_note: "not recorded at import" } : {}) } };
    },
  };
  const c = conformanceOf(host, { record, membership, promotion, content, inquiry: k, strength, reevaluation,
                                  publication, standards, contradiction, events, entities, calculations, now,
                                  caseCheck, acceptedWork, caseImport,
                                  officeEntityOf: ({ role, body }) => offices.get(`${role}|${body}`) ?? null });
  const w = {
    st, host, record, membership, promotion, content, k, strength, reevaluation, publication, standards, contradiction, c,
    clock, ex, entities, events, offices, view, calcs, calcReads, caseCheck, acceptedWork, lapse, imports,
    row: (q, ...a) => st.sql.exec(q, ...a).toArray()[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a).toArray(),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    snapshot(tables = null) {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        if (!tables || tables.includes(name)) out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM "${name}"`).toArray());
      return out;
    },
    /** An op, as the plane's op map runs it: `query` the control plane's search params, `body` its JSON. */
    op(name, query = {}, body = null) {
      const url = new URL(`http://do/${name}`);
      for (const [key, v] of Object.entries(query)) if (v != null) url.searchParams.set(key, String(v));
      return conformanceOps(c, url, body)[name]();
    },
    member(id, { role = "member", handle = `h_${id}`, cover = `Cover ${id}`, status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, cover, handle, role, status);
    },
    project(title, owner, { visibility = null } = {}) {
      const res = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" },
        ...(visibility ? { visibility } : {}) });
      if (!res.ok) throw new Error(`fixture project refused: ${JSON.stringify(res).slice(0, 400)}`);
      return res.bundleId;
    },
    /** A participant `member` of `project`, invited by its owner and joined. */
    join(project, owner, member) {
      const inv = membership.projectInvite({ projectId: project, handle: `h_${member}`, by: owner, viewer: V(owner) });
      if (inv && inv.ok === false) throw new Error(`fixture invite refused: ${JSON.stringify(inv)}`);
      const j = membership.projectJoin({ projectId: project, by: member, viewer: V(member) });
      if (j && j.ok === false) throw new Error(`fixture join refused: ${JSON.stringify(j)}`);
    },
    cap: (name, text = `bytes of ${name}`) => ({ path: `snapshots/${name}.txt`, text, sha: sha(text) }),
    /** A document (information bundle) holding `captures` (default: one of its own), registered in that order. */
    doc(id, captures = null) {
      const caps = captures || [w.cap(`${id}-0`, `the text of ${id}`)];
      const files = [{ path: "bundle.md", text: infoMd(id) }];
      for (const x of caps) files.push({ path: x.path, text: x.text });
      files.push({ path: "data/provenance.json", text: JSON.stringify({ documents: caps.map((x) => provDoc(x)) }, null, 2) });
      const res = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"), files,
        meta: { object_type: "information" },
        register: caps.map((x) => ({ sha256: x.sha, path: x.path, encoding: "utf8", bytes: Buffer.byteLength(x.text) })) });
      if (!res.ok) throw new Error(`fixture doc refused: ${JSON.stringify(res).slice(0, 400)}`);
      return caps;
    },
    /** A capture read, with its text units; and retrieved from `address` at `at`. */
    read(capSha, units = null, { pageCount = 3, state = "whole" } = {}) {
      ex.readings[capSha] = { chain: LAYER, pageCount };
      if (units) ex.units[capSha] = { units: units.map((u, i) => ({ extent: u.extent, ref: u.ref ?? `u${i}`, text: u.text,
                                                                      truncated: !!u.truncated })), state };
    },
    at(capSha, address, retrieved) {
      content.provenance.recordReceipt({ address: `https://${address}`, addressNorm: address, captureSha: capSha, retrieved });
    },
    /** A passage of a capture, minted as content. */
    passage(bundleId, capSha, extent = { kind: "pdf-page", page: 1 }) {
      const m = content.mint({ bundleId, captureSha: capSha, extent, mintedBy: V("bo") });
      if (!m.ok) throw new Error(`fixture passage refused: ${JSON.stringify(m).slice(0, 300)}`);
      return m.content_id;
    },
    /** A document with one read capture and one minted passage of it: `{doc, cap, content}`. With `doctype` or
     *  `date`, its reader states them (extraction's `readings` row and its reading's top-level `date`). */
    evidence(id, text = `the text of ${id}`, { doctype = null, date = null } = {}) {
      const [cp] = w.doc(id, [w.cap(`${id}-0`, text)]);
      w.read(cp.sha, [U(0, "page one"), U(1, text)]);
      if (doctype || date) {
        ex.readings[cp.sha].reading = { page_boxes: null, ...(date ? { date } : {}) };
        st.sql.exec(`INSERT OR REPLACE INTO readings (capture_sha, bundle_id, content_type, reading) VALUES (?,?,?,?)`,
                    cp.sha, id, doctype, JSON.stringify({ content_type: doctype, ...(date ? { date } : {}) }));
      }
      const out = { doc: id, cap: cp, content: w.passage(id, cp.sha) };
      /* the reader's date is also the document's own as events holds it (a dated fact, its R1), which contradiction's
         own dates read (its K4; K1610) */
      if (date) out.dated = w.dated(out, date);
      return out;
    },
    /** A document's own date, `value`, as events holds it: a member's dated fact at the evidence's passage (its R1). */
    dated(ev, value, { kind = "issued" } = {}) {
      const r = events.recordDatedFact({ captureSha: ev.cap.sha, extent: { kind: "pdf-page", page: 1 }, kind, value,
                                         method: "a member's reading of the document", by: V("alice") });
      if (!r.ok) throw new Error(`fixture dated fact refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r.dated_fact.dated_fact_id;
    },
    /** An entity of the registry (`office`, `person`, …), declared by a member. */
    entity(kind, label, sector = undefined) {
      const r = entities.createEntity({ kind, label, note: `The ${kind} ${label}, registered for the test.`,
                                        declaredBy: V("olive"), ...(sector ? { sector } : {}) });
      if (!r.ok) throw new Error(`fixture entity refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r.entity_id;
    },
    /** An event the record attests: by `ev`'s dated fact at `date` (or its passage, undated, when `date` is null), with
     *  `participants` `[{entityId, role}]` stated by the same attestation. Answers its id. */
    event(ev, { kind = "order", date = "2026-03-02", participants = [], by = V("olive") } = {}) {
      const attestation = date ? { datedFactId: w.dated(ev, date) }
                               : { captureSha: ev.cap.sha, extent: { kind: "pdf-page", page: 1 } };
      const r = events.createEvent({ kind, attestations: [attestation],
                                     participants: participants.map((p) => ({ ...p, attestation: 0 })), by });
      if (!r.ok) throw new Error(`fixture event refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.event_id;
    },
    /** A contradiction taken up as a question (contradiction R35): two passages, one a rule and one an act, legs of one
     *  inquiry that supports with the first and cuts against with the second (K1); the pair proposed `record` under the
     *  run (a duty), then taken up by `by` framed around side `a`. Answers `{inquiry, candidate, rule, act, sides}`,
     *  `sides` the candidate's own `a` and `b` as contradiction shows them. */
    contradicted({ by = V("olive"), question = "Did the closure follow the notice rule?" } = {}) {
      const tag = String(++n).padStart(4, "0");
      const rule = w.evidence(`INFO-2026-${tag}-rule`, "thirty days' public notice is required before a closure",
                              { doctype: "ordinance", date: "2020-01-01" });
      const act = w.evidence(`INFO-2026-${tag}-act`, "the playground was closed on 2 March with no notice",
                             { doctype: "minutes", date: "2026-03-02" });
      const holder = `INQ-2026-${tag}-tension`;
      w.inquiry(holder, { legs: [{ target: rule.doc, role: "supports", content_id: rule.content },
                                 { target: act.doc, role: "cuts_against", content_id: act.content }] });
      const pair = contradiction.pairs({ key: "K1", viewer: MACHINE }).pairs
        .find((p) => p.a.inquiry === holder && p.b.inquiry === holder);
      if (!pair) throw new Error(`fixture: no K1 pair formed over ${holder}`);
      const pr = contradiction.propose({ run: RUN, proposedBy: MACHINE, viewer: MACHINE, caller: MACHINE,
        proposals: [{ key: "K1", a: pair.a, b: pair.b, label: "record", reason: "the rule and the act disagree" }] });
      if (!pr.ok) throw new Error(`fixture propose refused: ${JSON.stringify(pr).slice(0, 400)}`);
      const candidate = pr.candidates[0].candidate;
      const up = contradiction.takeUp({ candidate, question, frame: "a", viewer: by, author: by });
      if (!up.ok) throw new Error(`fixture take-up refused: ${JSON.stringify(up).slice(0, 400)}`);
      /* the candidate's own sides, `a` and `b` as contradiction orders them (its R15) and shows them (its R25) */
      const shown = contradiction.candidatesFor({ on: { candidate }, viewer: MACHINE }).candidates[0];
      return { inquiry: up.inquiry, candidate, rule, act, sides: { a: shown.a, b: shown.b } };
    },
    /** An inquiry through promotion (so inquiry's check and projection run); `legs` as inquiry's grammar. */
    inquiry(id, opts = {}) {
      const res = w.promote(id, inquiryMd(id, opts));
      if (!res.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(res).slice(0, 600)}`);
      return res;
    },
    promote(id, text, type = "inquiry") {
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: V("alice"), files: [{ path: "bundle.md", text }], meta: { object_type: type } });
    },
    head: (id) => record.head(id)?.bundleSha ?? null,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = w.text(id); return t ? parseFrontmatter(t).data : null; },
    /** A finding published in a ratified edition of `caseId` owned by `project`, its pin the finding's current sha, with
     *  its frozen pair `strength` (rows `{axis, grade}`), through publication's R21 and R22 as case-authoring and
     *  ratification call them. Answers the pin. */
    publish(finding, project, { caseId = "CASE-2026-0001", edition = 1, role = "load_bearing",
                                strength = [{ axis: "capture", grade: "B" }, { axis: "connection", grade: "C" }] } = {}) {
      const pin = w.head(finding);
      const roles = [{ target: finding, version_sha: pin, edition, role }];
      const text = caseDoc(caseId, edition, { project, roles,
                                              strength: strength.map((s) => ({ target: finding, ...s })) });
      const prep = publication.storeCaseDocument({ case: caseId, edition, text, author: V("olive"), at: NOW });
      if (!prep.ok) throw new Error(`fixture prepare refused: ${JSON.stringify(prep)}`);
      const sc = record.transact(() => publication.commitCaseEdition({ case: caseId, edition, project,
        scope: "The question.", completeness: { statement: "It leaves out the minutes.", author: V("olive") },
        biasAcknowledgement: "none declared", bar: null,
        roster: [{ bundle_id: finding, version_sha: pin, role }], sigArmored: SIG(edition), attestorKey: KEY,
        attestorMember: "olive", gateVersion: "plane-gate/test", deliveredBy: V("olive"), at: NOW }));
      if (!sc.ok) throw new Error(`fixture case edition refused: ${JSON.stringify(sc)}`);
      const sf = record.transact(() => publication.commitEdition({ bundleId: finding, bundleSha: pin, edition: undefined,
        title: `Finding ${finding}`, completeness: null, strength: null, memberCarriesBlocks: false, group: "test-group",
        edges: [], shas: [{ sha256: pin, path: "bundle.md", kind: "bundle", bytes: 10 }], attestorKey: KEY,
        attestorMember: "olive", gateVersion: "plane-gate/test", sigArmored: SIG(90 + edition), deliveredBy: V("olive"),
        at: NOW }));
      if (!sf.ok) throw new Error(`fixture finding edition refused: ${JSON.stringify(sf)}`);
      const items = publication.publishedEditionsOf({ finding, project }).items;
      if (!items.some((i) => i.case === caseId && i.edition === edition))
        throw new Error(`fixture publish: ${finding} is not in ${caseId} edition ${edition}: ${JSON.stringify(items)}`);
      return pin;
    },
    /** A case of `project` naming `findings` (an id or a list), checked for publication and held unsigned (case-check
     *  R1), at `caseId` edition `edition`. Answers the check as case-check answers it. */
    hold(findings, project, { caseId = "CASE-2026-0101", edition = 1 } = {}) {
      const r = caseCheck.checkAndHold({ caseId, edition, project, targets: [].concat(findings), author: V("olive"),
                                         viewer: V("olive") });
      if (!r.ok) throw new Error(`fixture hold refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    },
    /** Another group's finding `finding` of import `imp` at `edition`, held by the stand-in and accepted by this group
     *  (unless `accepted: false`). Answers its ref. */
    accept(imp, finding, { edition = 1, group = "Hayward Parents", caseId = "CASE-2026-0900", accepted = true,
                           pair = { capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" } } } = {}) {
      const ref = `imported:${imp}/${finding}`;
      imports.findings.set(`${ref}|${edition}`, { import: imp, group, case: caseId, edition, finding, pair,
        acceptance: accepted ? { by: "olive", at: "2026-09-20T00:00:00Z", reason: "checked", checked: [], gaps: [] } : null });
      return ref;
    },
    /** A publisher move recorded by the stand-in (accepted-work R8's shape). */
    move(imp, { kind = "withdrawal", edition = 1, at = "2026-10-01T00:00:00Z", date = "2026-09-30", caseId = "CASE-2026-0900",
                taken_back = null } = {}) {
      const m = { move: `MOVE-${imports.moves.length + 1}`, import: imp, group: "Hayward Parents", case: caseId, kind, edition,
                  seq: imports.moves.length + 1, date, at, what_changed: kind === "edition" ? "revised" : null,
                  reason: kind === "withdrawal" ? "withdrawn" : null, key_listed: true, taken_back };
      imports.moves.push(m);
      return m;
    },
    /** A standard held by `standards`, declared by a member through its R1 with the declarer's `reason` (DEC-88), its
     *  text a passage of its own document. */
    standard(cite, { kind = "ordinance", issuer = "Parks Department", period = { from: "2020-01-01", to: null },
                     supersedes = undefined, author = V("olive"), text = null,
                     reason = "The group holds the parks department to this rule." } = {}) {
      const t = text || w.evidence(`INFO-2026-${String(900 + ++n).padStart(4, "0")}-text`).content;
      const r = standards.standardDeclare({ cite, kind, issuer, text: [t], period, reason,
                                            ...(supersedes ? { supersedes } : {}), author, viewer: author });
      if (!r.ok) throw new Error(`fixture standard refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.id;
    },
  };
  return w;
}

/** A case document (`bio-case-document/6`, the one format publication commits, its R58): the facts publication reads
 *  from it, with `/6`'s `method:` block and its `materials:` and `material_attestations:` blocks (case-grammar R11,
 *  R12). No finding of these scenes rests on a material, so both blocks are empty, written as case-grammar's
 *  `materialsLines([])` and `materialAttestationLines([])` write them (`case-grammar` is not in conformance's uses,
 *  so its builders are not imported here). */
export function caseDoc(caseId, edition, { project, roles = [], strength = [] } = {}) {
  return ["---", "format: bio-case-document/6", `case_id: ${caseId}`, `case_edition: ${edition}`, `case_project: ${project}`,
    "case_roles:", ...roles.flatMap((r) => [`  - target: ${r.target}`, `    version_sha: ${r.version_sha}`,
      `    edition: ${r.edition ?? 1}`, `    role: ${r.role ?? "load_bearing"}`]),
    "case_findings:", ...roles.map((r) => `  - ${r.target}`),
    ...(strength.length ? ["case_strength:", ...strength.flatMap((s) => [`  - target: ${s.target}`, `    axis: ${s.axis}`,
      `    state: ${s.state ?? "graded"}`, `    grade: ${s.grade}`])] : ["case_strength: []"]),
    "completeness:", "  author: member:olive", `  at: "${NOW}"`, "completeness_excluded: []", "case_citations: []",
    "method:", '  grading: "grading/1"', '  checks: "1.0.0"',
    "materials: []", "material_attestations: []",
    "---", "", "## Scope", "", "The question.", "", "## What This Excludes", "", "Nothing else.", "",
    "## What Was Searched", "", "Everything.", ""].join("\n");
}

export function inquiryMd(id, { question = `Is ${id} answered?`, legs = [], state = "open", prior = "null",
                               disposition = '""', extra = [] } = {}) {
  const references = [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites" }));
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${question}"`,
    `current_state: ${state}`, `prior_state: ${prior}`, `created: "2026-09-27T00:00:00Z"`,
    `last_updated: "2026-09-27T00:00:00Z"`, "group: test-group",
    ...(references.length
      ? ["references:", ...references.flatMap((r) => [`  - target: ${r.target}`, `    rel: ${r.rel}`, "    status: confirmed"])]
      : ["references: []"]),
    "state_history: []", "surfaced_by: human", `disposition_reason: ${disposition}`,
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role || "supports"}`,
      ...(l.grade ? [`    grade: ${l.grade}`] : []), ...(l.grade_axis ? [`    grade_axis: ${l.grade_axis}`] : []),
      ...(l.grade_source ? [`    grade_source: ${l.grade_source}`] : []),
      ...(l.content_id ? [`    content_id: ${l.content_id}`] : [])])] : []),
    ...extra,
    "---", "", "## Question", "", question, "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}

export function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

export function projMd(title) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
}

export function provDoc(x) {
  return {
    file: x.path, locator: `https://example.org/${x.path}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: x.sha, encoding: "utf8",
               bytes: Buffer.byteLength(x.text) },
    origin: { kind: "named_request" },
  };
}

export const F = "INQ-2026-0001-finding";
export const DOC = "INFO-2026-0001-doc";

/** A project `Parks` owned by olive, with pat joined, quinn a member outside it and ron an administrator; one document
 *  with a minted passage (the act's evidence), a finding resting on it published in the project's ratified case
 *  edition, and a standard in force (a period with both ends). */
export function scene(opts = {}) {
  const w = world(opts);
  for (const m of ["olive", "pat", "quinn"]) w.member(m);
  w.member("ron", { role: "admin" });
  const proj = w.project("Parks", "olive");
  w.member("sam");
  w.join(proj, "olive", "pat");
  const ev = w.evidence(DOC);
  w.inquiry(F, { legs: [{ target: DOC }] });
  const pin = w.publish(F, proj);
  const std = w.standard("Parks Code 12.08.030", { period: { from: "2020-01-01", to: "2030-12-31" } });
  /* the act: the closure order, an event dated 2026-03-02 by the evidence, signed by a person (a participant) */
  const signer = w.entity("person", "Jane Roe");
  const act = w.event(ev, { participants: [{ entityId: signer, role: "signatory" }] });
  /** A valid determination of the scene's act (every field `over` replaces). */
  const input = (over = {}) => ({
    project: proj, author: V("olive"), viewer: V("olive"),
    act: { event: act, actor: { role: "Director of Parks", body: "Parks Department" }, evidence: [ev.content] },
    findings: [F], standards: [{ standard: std, outcome: "noncompliant" }],
    rows: [{ standard: std, requires: "thirty days' public notice before a closure", did: "closed with no notice",
             reading: "diverges", content: [ev.content] }],
    ...over });
  return { w, proj, ev, pin, std, input, act, signer };
}
