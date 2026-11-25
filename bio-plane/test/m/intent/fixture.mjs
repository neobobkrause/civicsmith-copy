/* intent over the modules it uses, the real ones where they need no module outside intent's uses (record-core,
   membership, credentials, promotion, entities, progressions, provenance and money, whose facts R31 totals; and, under
   them, events, whose dated facts give a stage document its own date (progressions R16, R37), with extraction and
   content), and the fictional test profile through jurisdictions (its time zone governs the stage dates), on a real SQLite database (node:sqlite) standing in for a Durable
   Object's storage. Retrieval's selections and inquiry's `dispose` (R20–R22: the selection resolved, each member moved to
   the disposition with its reason and author) are the real ones over the same storage, each call recorded. Three are
   stand-ins in the shape of their Provides, which the test controls and records: inquiry's `personFacts` (R59, over
   `persons`, which a test fills), ai-runs' `open` (R9–R10) and capture-requests' reads (`captureRequests`, R23;
   `requestById`, R43).
   Every test drives `intent` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { progressionsOf } from "../../../src/progressions/index.mjs";
import { intentOf } from "../../../src/intent/index.mjs";
import { registeredHomes } from "../provenance/fixtures.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { Money } from "../../../src/money/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` or `.length` of it is undefined. It also refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB
   pattern too complex"), which node:sqlite does not (K313). This storage answers as workerd does, so code that indexes
   a cursor or writes a long pattern fails here as it would in the Durable Object (K316). */
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

export const V = (id) => `member:${id}`;
export const MACHINE = "class:ai";
export const NOW = "2026-09-28T01:00:00Z";
export const DAY = 86400000;
/** The fictional test profile's time zone (`test-port-ellery`), the one that governs here: stage dates and money periods. */
export const ZONE = "America/Halifax";

/** `plane`: build as the plane does (N179): intent first, reaching progressions through the host, and progressions
 *  after it with the plane's `env` (the plane's constructor builds `intentOf(ctx)` before the scheduler reaches
 *  `progressionsOf(ctx, {env})`). */
export function world({ now = NOW, plane = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* K789: the founder's credential, and so whether the instance is claimed (membership R94), are credentials' (its
     R16, R17), built over the same storage after membership's tables. */
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  /* publication's two facts, which inquiry's dispose asks (CASE-4): no question here belongs to a published case */
  promotion.registerFact("caseMember", "publication", () => false);
  promotion.registerFact("publishedRegistry", "publication", () => null);
  const entities = entitiesOf(host, { record, membership, provenance: {}, now: () => clock.now });
  entities.migrate();
  /* the fictional test profile: its time zone is the one local-facts governs, which progressions reads (its R16) */
  record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "test");
  /* provenance's own published fixture: the real one over this record, membership and promotion, with nothing registered */
  const provenance = registeredHomes({ host, record, membership, promotion }).provenance;
  /* events (its R1, R27): a stage document's own date is the dated fact it holds for the capture (progressions R37);
     it reads extents through content and readings through extraction, whose tables the plane's migration makes */
  const extraction = extractionOf(host, { record, membership, promotion });
  extraction.migrate();
  const content = contentOf(host, { record, membership, provenance, extraction });
  content.migrate();
  const events = eventsOf(host, { record, membership, provenance, extraction, entities, now: () => clock.now });
  events.migrate();
  const buildProgressions = () => {
    const p = progressionsOf(host, { record, entities, provenance, now: () => clock.now,
      extraction: { readingOf: () => null }, events,
      ...(plane ? { env: plane.env } : {}) });
    p.migrate();
    return p;
  };
  let progressions = plane ? null : buildProgressions();
  const calls = { selections: [], handles: [], dispose: [], open: [], requests: [], requestById: [], personFacts: [] };
  /* retrieval's selections (its R18–R20) are the real ones, over the same storage, with an empty observation reader (selections read none); each call is recorded */
  const realRetrieval = retrievalOf(host, { record, membership, promotion, extraction, observation: {}, now: () => Date.parse(clock.now) });
  realRetrieval.migrate();
  const retrieval = {
    async selectionCreate(a) {
      calls.selections.push(a);
      const r = await realRetrieval.selectionCreate(a);
      if (r.ok) calls.handles.push(r.handle);
      return r;
    },
    selectionResolve: (a) => realRetrieval.selectionResolve(a),
  };
  /* inquiry's dispose (its R20–R22), over the selection: each member moves to the disposition, its reason and author
     recorded as inquiry records them (state_history, prior_state, disposition_reason), through promotion */
  /* inquiry's `personFacts` (its R59, read by intent R32): the record's facts for the persons a text or a subject names,
     over `persons` (entity id → {label, public_role}), which a test fills; each call recorded */
  const persons = new Map();
  const realInquiry = inquiryOf(host, { record, membership, promotion, content, entities, retrieval: realRetrieval, provenance,
                                       now: () => clock.now });
  realInquiry.migrate();
  realInquiry.connections.migrate();   /* inquiry's own connections, reached through it: promotion projects references into them */
  const inquiry = {
    personFacts({ text = "", subject = null, viewer = null } = {}) {
      calls.personFacts.push({ text, subject, viewer });
      const out = [];
      for (const [id, p] of persons)
        if (id === subject || (p.label && String(text).includes(p.label)))
          out.push({ entity_id: id, kind: "person", label: p.label, public_role: p.public_role === true, named: true });
      return out;
    },
    dispose(a) { calls.dispose.push(a); return realInquiry.dispose(a); },
  };
  const aiRuns = { open: async (a) => { calls.open.push(a); return { run: a.run ?? null, started: true, status: "running" }; } };
  /* capture-requests' read (its R23): the rows the viewer may see, oldest first, bounded; and its one read by key (its
     R43): a row whose `seenBy` (when set) does not name the viewer answers null, as an unknown one does */
  const requests = [];
  const captureRequests = {
    captureRequests: (a) => { calls.requests.push(a); return { count: requests.length, limit: a.limit, truncated: false, requests: [...requests] }; },
    requestById: (a) => {
      calls.requestById.push(a);
      const r = requests.find((x) => x.request === a.request);
      return r && (!r.seenBy || r.seenBy.includes(a.viewer)) ? { ...r } : null;
    },
  };
  /* money (R31) over the same storage, with provenance's register for its facts' sources; lines is not among intent's
     uses, and no fact here needs it (money fails closed where it would) */
  const money = new Money(st, { record, membership, entities, provenance, events, lines: null, now: () => clock.now });
  money.migrate();
  const i = intentOf(host, { record, membership, promotion, entities, ...(plane ? {} : { progressions }), inquiry, retrieval,
                             aiRuns, captureRequests, money, now: () => clock.now });
  i.migrate();
  if (plane) progressions = buildProgressions();
  let n = 0;
  const w = {
    st, host, record, membership, credentials, promotion, entities, progressions, i, clock, calls, requests, money,
    events, persons,
    /** A capture held in `bundleId` whose own date is `day`: the one dated fact events holds for it, recorded by a
     *  member (events R1; progressions R37). Answers the capture's digest. */
    dated(name, bundleId, day) {
      const sha = Buffer.from(String(name)).toString("hex").padEnd(64, "0").slice(0, 64);
      w.held(sha, bundleId);
      const r = events.recordDatedFact({ captureSha: sha, extent: { kind: "document" }, kind: "signed", value: day,
                                         method: "read by a member", by: V("alice") });
      if (!r.ok) throw new Error(`fixture dated fact refused: ${r.reason}: ${r.detail}`);
      return sha;
    },
    /** A capture registered in `bundleId` (provenance's register, its R48), the bundle an information bundle row. */
    held(sha, bundleId) {
      st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                   VALUES (?, 'information', 'test-group', ?, 'collected', ?, ?, 'x')`, bundleId, bundleId, clock.now, clock.now);
      st.sql.exec(`INSERT OR REPLACE INTO register (capture_sha, bundle_id, path, encoding, bytes, registered)
                   VALUES (?, ?, 'snapshots/x', 'utf8', 1, ?)`, sha, bundleId, clock.now);
      return sha;
    },
    /** The four stand-ins intent was built with, so a test can make one answer otherwise. */
    stand: { inquiry, retrieval, aiRuns, captureRequests },
    rows: (q, ...a) => st.sql.exec(q, ...a).toArray(),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = record.readFile(id, "bundle.md")?.text; return t ? parseFrontmatter(t).data : null; },
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM ${name}`).toArray());
      return out;
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
    /** A project created through promotion, `owner` its joined sole owner; `objective` its text (null for none). */
    project(title, owner, { objective = "Find out what happened.", visibility = null } = {}) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        ...(visibility ? { visibility } : {}),
        files: [{ path: "bundle.md", text: projMd(title, objective) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** A participant of a project, at a state (`joined`, `invited`, `leaving`). */
    join(projectId, memberId, state = "joined") {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, 0, 't', 't')`, projectId, memberId, state);
    },
    entity(id, kind = "body", label = id) {
      st.sql.exec(`INSERT OR IGNORE INTO entities (entity_id, kind, label, at) VALUES (?, ?, ?, ?)`, id, kind, label, clock.now);
    },
    relate(from, to, relation) {
      const r = entities.declareRelation({ fromEntity: from, toEntity: to, relation, justification: "declared in the test",
                                           citation: "the test", declaredBy: V("alice") });
      if (!r.ok) throw new Error(`fixture relation refused: ${JSON.stringify(r)}`);
      return r.relation_id;
    },
    /** A capture resolving to an entity at a grade, in an information bundle row. */
    resolve(capSha, bundleId, entityId, grade) {
      if (!record.head(bundleId))
        st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                     VALUES (?, 'information', 'test-group', ?, 'collected', ?, ?, 'x')`, bundleId, bundleId, clock.now, clock.now);
      st.sql.exec(`INSERT OR REPLACE INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method, established, at)
                   VALUES (?, ?, 'r', ?, ?, 'test', ?, ?)`, capSha, bundleId, entityId, grade,
                  grade === "A" || grade === "B" ? 1 : 0, clock.now);
    },
    /** The three-stage flow most tests use. */
    define(key = "proc") {
      const r = progressions.defineProgression({ progressionKey: key, label: "Procurement", declaredBy: V("alice"),
        basis: "a purchase is needed, then awarded, then contracted", stages: [
        { key: "need", cardinality: "1", required: "always" },
        { key: "award", after: "need", cardinality: "1", required: "always" },
        { key: "contract", after: "award", cardinality: "0..n", required: "usually" },
      ] });
      if (!r.ok) throw new Error(`fixture progression refused: ${JSON.stringify(r)}`);
      return r;
    },
    /** Thread `entityId` through `proc`, one capture per named stage at the given grades. */
    async thread(entityId, stages, key = "proc") {
      const placements = [];
      for (const [stage, grade] of Object.entries(stages)) {
        const sha = `${entityId}-${stage}`.toLowerCase();
        w.resolve(sha, `INFO-${entityId}-${stage}`, entityId, grade);
        placements.push({ stage, captureSha: sha });
      }
      const r = await progressions.threadInstance({ progressionKey: key, entityId, placements, threadedBy: V("alice") });
      if (!r.ok) throw new Error(`fixture thread refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r;
    },
    /** A money fact (money R1) concerning `entity`, recorded by a member through money's one append site, its source a
     *  capture held in `bundle` (a bundle in no project, seen by every member, unless one is named). `over` replaces
     *  any field: an exact 2025-26 cash payment of `amount` dollars. */
    fact(entity, amount, over = {}, { bundle = "INFO-LEDGER" } = {}) {
      const sha = w.held((++n).toString(16).padStart(64, "f"), bundle);
      const r = money.recordFact({ amount, as_read: `$${amount}`, currency: "USD", sign: "+", precision: "exact",
        kind: "payment", phase: "actual", stage: "paid", basis: "cash",
        period: { from: "2025-07-01", to: "2026-06-30", precision: "day", zone: ZONE },
        from: { as_written: "the treasurer" }, to: { as_written: "a vendor" }, concerns: [entity],
        source: { capture_sha: sha, extent: { kind: "pdf-page", page: 1 } }, by: V("alice"), ...over });
      if (!r.ok) throw new Error(`fixture money fact refused: ${r.reason}: ${r.detail}`);
      return r.fact_id;
    },
    /** An inquiry bundle created through promotion (the fixture's own author), for R17. */
    inquiry(id, { state = "surfaced", surfacedBy = "agent", author = MACHINE, created = clock.now } = {}) {
      const text = ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}?"`,
        `current_state: ${state}`, "prior_state: null", `created: "${created}"`, `last_updated: "${created}"`,
        "references: []", "state_history: []", `surfaced_by: ${surfacedBy}`, 'disposition_reason: ""', "---", "",
        "## Question", "", `Question ${id}?`, ""].join("\n");
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author, files: [{ path: "bundle.md", text }],
                                    meta: { object_type: "inquiry" } });
      if (!r.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(r).slice(0, 300)}`);
      st.sql.exec(`UPDATE manifest SET created=? WHERE bundle_id=?`, created, id);
      return r;
    },
    /** A raw revision of `id`'s bundle.md, through promotion, as `author`. */
    revise(id, text, author, extra = {}) {
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head.bundleSha, snapKey: `k${++n}`, author,
                                 files: [{ path: "bundle.md", text }], meta: {}, actorIdentity: author,
                                 actorViewer: author, ...extra });
    },
    /** A raw creation through promotion. */
    create(id, text, author, extra = {}) {
      return promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author, files: [{ path: "bundle.md", text }],
                                 meta: {}, ...extra });
    },
  };
  return w;
}

/** alice (an administrator), bob and carol (members); project P owned by alice, bob joined, carol invited only. */
export function seeded(opts) {
  const w = world(opts);
  w.member("alice", { role: "admin" });
  w.member("bob");
  w.member("carol");
  w.member("dave");
  const P = w.project("Contracts review", "alice");
  w.join(P, "bob");
  w.join(P, "carol", "invited");
  w.P = P;
  return w;
}

export function projMd(title, objective = "Find out what happened.") {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          ...(objective === null ? [] : [`objective: "${objective}"`]), "references: []", "state_history: []", "---", "",
          "## Objective", "", "Find out.", ""].join("\n");
}

/** The condition most tests set: ENT-1's `proc` instances, need and award placed, grade B or better, 50%. */
export const COND = { progression: "proc", entity: "ENT-1", required: { grade: "B", stages: ["need", "award"] },
                      satisfied: { share: 50 } };
