/* case-inputs over the modules it uses, each the real one (record-core, membership, publication publish-schedule, case-account), on a real SQLite database (node:sqlite) standing in for a Durable Object's
   storage. It builds `case-inputs` alone: `case-authoring` is later in the order and is never built here (the split
   map's §3, §7 risk 1). So the case documents a test needs are written as `case-authoring`'s `op=publish` and
   ratification's commit would leave them: an unsigned one stored through `publication.storeCaseDocument` (its R21),
   with the acknowledgement list and the statement's writer this module answers, and a signed one by writing
   `case_documents`, `cases` and `published_cases` directly (publication R40's tables). What a later module fills is a
   stand-in the test controls: the review provider (publication R23, which `review` registers) over its `case_drafts`
   table (review R26's read contract). Every test drives `case-inputs` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { publicationOf } from "../../../src/publication/index.mjs";
import { publishScheduleOf } from "../../../src/publish-schedule/index.mjs";
import { caseAccountOf } from "../../../src/case-account/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { publicReadOf } from "../../../src/public-read/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { fmSafe, outcomesLines, CASE_DOCUMENT_FORMAT } from "../../../src/case-grammar/index.mjs";
import { caseInputsOf, registerCaseInputsPublicReads, ackFrontmatterLines, ackBodyLines } from "../../../src/case-inputs/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
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
/* R24: the team's slug, the fact `producingGroup` (promotion R40) as instance-setup registers it. */
export const SLUG = "test-group";
export const NOW = "2026-09-28T01:00:00Z";
export const T0 = "2026-09-27T00:00:00Z";
/* The statement a well-formed preparation prints. */
export const STATEMENT = "It does not cover the award's later amendments.";
/* R1 (DEC-88): every acknowledgement carries the acknowledger's words; a test proving the refusal passes its own. */
export const WORDS = "I read what this case leaves out and agree it is stated.";

/* review's table (its R26 read contract) and the columns its draft act writes. */
const CASE_DRAFTS = `CREATE TABLE IF NOT EXISTS case_drafts (draft_id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  case_id TEXT, params TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL, statement_by TEXT)`;

/** The dead answer of the stand-in review provider, C-87.1's code, in the shape `review` builds it (its `refusal`): the
 *  canned `translation` and the `detail` sentence, both strings. The stand-in holds placeholders for the two sentences
 *  and never copies them (K3810); fixtures.test.mjs checks their presence and type against the real answer's shape. */
export const DEAD = Object.freeze({ ok: false, reason: "NO_REVIEW_COPY", code: "NO_REVIEW_COPY", check: "C-87.1",
  translation: "(the review copy's dead answer)", detail: "(the review copy's dead detail)" });

/* The review provider `review` fills (publication R23), over its own tables as the test holds them. `grants` maps a
   secret fingerprint to `{grant_id, draft_id, case_id, edition, recipient, revoked}`. */
function reviewProvider(w) {
  const identity = (d) => {
    const named = d && d.case_id ? String(d.case_id) : null;
    if (!named) return { caseId: null, edition: 1 };
    const t = w.row(`SELECT MAX(edition) AS m FROM published_cases WHERE case_id=?`, named);
    return { caseId: named, edition: (t && t.m != null ? Number(t.m) : 0) + 1 };
  };
  const draftForMember = (draftId, viewer) => {
    const d = w.row(`SELECT * FROM case_drafts WHERE draft_id=?`, String(draftId ?? "").trim());
    if (!d) return null;
    const who = String(viewer ?? "").startsWith("member:") ? String(viewer).slice(7) : null;
    return who && w.row(`SELECT 1 AS x FROM project_participants WHERE project_id=? AND member_id=?`, d.project_id, who)
      ? d : null;
  };
  const liveGrant = (secretSha) => {
    const g = w.grants.get(String(secretSha ?? ""));
    if (!g || g.revoked) return null;
    const d = w.row(`SELECT * FROM case_drafts WHERE draft_id=?`, g.draft_id);
    if (!d) return null;
    const now = identity(d);
    if ((now.caseId ?? null) !== (g.case_id ?? null) || now.edition !== Number(g.edition)) return null;
    return { grant: g, draft: d };
  };
  return {
    draftForMember, draftFor: draftForMember,
    draftIdentity: identity,
    caseIdentitySentence: (caseId, edition, newCase) => (caseId ? `the next edition (${edition}) of ${caseId}`
      : newCase ? "NEWCASE-IDENTITY" : "DERIVEDCASE-IDENTITY"),
    statedEdition: (ident, newCase) => (ident.caseId || newCase ? ident.edition : null),
    liveGrant,
    grantAdmitsCaseEdition: (s, c, e) => { const l = liveGrant(s); return !!(l && l.grant.case_id === c && Number(l.grant.edition) === Number(e)); },
    grantAdmits: (s, c, e) => { const l = liveGrant(s); return !!(l && l.grant.case_id === c && Number(l.grant.edition) === Number(e)); },
    deadAnswer: () => ({ ...DEAD }),
  };
}

/** The case document's runs this module reads and re-authors, as `case-authoring`'s `caseDocumentText` writes them
 *  (`format`, `case_project`, the `completeness:` block with `author`, `statement_by` and the draft link above `statement_sha`,
 *  the list's two runs through this module's renderers, and `## What Was Searched` after the list's prose), the rest of
 *  a real document left out. `outcomes` is case-grammar R29's block; `format` the format the document declares (the
 *  one in force unless given) and `blocks` further front-matter lines a test writes with case-grammar's own writers;
 *  `withAckRuns` false leaves out the list's prose run, as a document authored before it was. */
export function caseDocText({ caseId, edition, project, statement, author, writer = null, acks, link = null,
                              outcomes = [], withAckRuns = true, format = CASE_DOCUMENT_FORMAT, blocks = [] }) {
  return ["---", `format: ${format}`, `case_id: ${caseId}`, `case_edition: ${edition}`, `case_project: ${project}`,
    ...outcomesLines(outcomes), ...blocks,
    "completeness:",
    `  statement: "${fmSafe(statement)}"`,
    `  author: ${author}`,
    ...(writer ? [`  statement_by: ${writer.by ?? "null"}`] : []),
    `  at: "${NOW}"`,
    ...(link ? [`  draft: ${link.draft}`, `  draft_named_by: ${link.by}`, `  draft_named_at: "${link.at}"`] : []),
    ...ackFrontmatterLines(acks),
    "completeness_excluded:",
    "---", "", "## What This Excludes", "", statement, "",
    ...(writer ? [`WRITER-LINE ${writer.stated}`, ""] : []),
    ...(withAckRuns ? ackBodyLines(acks, project) : []), "",
    "## What Was Searched", "", "Nothing was searched in this fixture.", ""].join("\n");
}

export function world({ provider = true, now = null, publicReads = true } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW, ms: "2026-09-28T01:00:00.000Z" };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* publication (layer 8), the real one on this host: its tables (R40), its review provider (R23), its standing test (R1)
     and its splice (R21). */
  const publication = publicationOf(host, { record, membership, now: () => clock.now });
  /* publish-schedule (layer 8, after publication; N823): the waiting editions R4 reads (its R1, R7). */
  const publishSchedule = publishScheduleOf(host, { record, membership, publication, now: () => clock.now });
  /* case-account (layer 8, directly before this module): its R5's shape of an outcome's cites. */
  const account = caseAccountOf(host, { record, membership });
  st.db.exec(CASE_DRAFTS);
  /* R21, R24 (T51): the entities this team holds, the producing group's slug, and public-read, which the module registers
     `casedetailspublic` with. */
  const entities = entitiesOf(host, { record, membership });
  entities.migrate();
  const promotion = promotionOf(host, { record, membership });
  promotion.registerFact("producingGroup", "instance-setup", () => SLUG);
  const publicRead = publicReadOf(host);
  let n = 0, cases = 0;
  const w = {
    st, host, record, membership, publication, publishSchedule, account, entities, promotion, publicRead, clock, grants: new Map(),
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    fm: (text) => parseFrontmatter(String(text || "")).data || {},
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM "${name}"`));
      return out;
    },
  };
  if (provider) publication.registerReviewProvider("review", reviewProvider(w));
  const clockOf = now || ((p) => (p === "millisecond" ? clock.ms : clock.now));
  w.ci = caseInputsOf(host, { record, membership, publication, publishSchedule, account, entities, promotion, now: clockOf });
  /* R24: registered where the plane registers the public reads (it is not a part of creating the instance) */
  if (publicReads) w.publicReadsRegistration = registerCaseInputsPublicReads(host, { publicRead });
  /* The tables record-core holds declared for modules this world does not build (provenance, content, inquiry and
     others), created empty with the key columns the purge reads (record-core R21), so a whole-store purge runs here as
     it runs over the whole plane. Nothing of this module's is among them. */
  const held = new Set(st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name));
  for (const d of record.declaredTables())
    if (!held.has(d.name)) {
      const cols = [...new Set([...(d.keys || []), ...(d.clears || [])])];
      st.db.exec(`CREATE TABLE "${d.name}" (${["fixture_row INTEGER", ...cols.map((c) => `"${c}" TEXT`)].join(", ")})`);
      held.add(d.name);
    }
  Object.assign(w, {
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute","publish"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    /** A project owned (and so joined) by `owner`: its row in record-core's `bundles` (its R37) and the owner's in
     *  membership's `project_participants`, as promotion's commit of a project leaves them, hidden (the default). */
    project(title, owner) {
      const id = `PROJ-2026-${String(++n).padStart(4, "0")}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
      st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated,
                   bundle_sha) VALUES (?, 'project', 'test-group', ?, 'forming', ?, ?, ?)`, id, title, T0, T0, "0".repeat(64));
      w.join(id, owner, "joined", 1);
      return id;
    },
    join(project, member, state = "joined", owner = 0) {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, invited_by, created, updated)
                   VALUES (?, ?, ?, ?, 'alice', 't', 't')`, project, member, state, owner);
    },
    /** A draft of `project` (review's table), its params the op=publish arguments. */
    draft(id, project, params, { caseId = null, by = "alice", statementBy = by } = {}) {
      st.sql.exec(`INSERT OR REPLACE INTO case_drafts (draft_id, project_id, case_id, params, created_by, created_at,
                   updated_by, updated_at, statement_by) VALUES (?,?,?,?,?,?,?,?,?)`,
                  id, project, caseId, JSON.stringify(params), by, T0, by, T0, statementBy);
    },
    grant(secretSha, g) { w.grants.set(secretSha, { revoked: false, ...g }); },
    /** One case edition prepared and stored unsigned, as `case-authoring`'s op=publish leaves it: the statement's writer
     *  (R3) and the acknowledgement list (R2) read as it reads them, the named draft's link stated, and case-grammar
     *  R29's block of `outcomes` (each `{outcome, kind, text, cites, on, carried_by, carried_at}`). A new case takes the
     *  next fixture id. Answers `{caseId, edition, writer, acks, doc_sha}`. */
    prepare(project, author, { caseId = null, edition = 1, statement = STATEMENT, draft = null, outcomes = [],
                                withAckRuns = true, format, blocks } = {}) {
      const id = caseId || `CASE-2026-${String(++cases).padStart(4, "0")}`;
      const named = draft ? w.row(`SELECT * FROM case_drafts WHERE draft_id=?`, draft) : null;
      const writer = w.ci.statementWriter(project, id, edition, statement, author, named);
      const link = draft ? { draft, by: author, at: NOW } : null;
      const acks = w.ci.statementAcknowledgements(project, id, edition, statement, author, writer, null, link);
      const text = caseDocText({ caseId: id, edition, project, statement, author, writer, acks, link, outcomes, withAckRuns,
                                 format, blocks });
      const stored = publication.storeCaseDocument({ caseId: id, edition, text, author, at: NOW, draft });
      if (!stored.ok) throw new Error(`fixture prepare refused: ${JSON.stringify(stored).slice(0, 300)}`);
      return { caseId: id, edition, writer, acks, doc_sha: stored.doc_sha };
    },
    /** The edition signed, as ratification's commit leaves it (publication R40): the document's signature and instant,
     *  the case's `cases` row (written at its first ratification) and its `published_cases` row. */
    ratify({ caseId, edition }, project, { at = "2026-09-28T02:00:00Z" } = {}) {
      st.sql.exec(`UPDATE case_documents SET sig_armored=?, attestor_key='key-1', attestor_member='alice', gate_version='1.37.0',
                   ratified_at=? WHERE case_id=? AND edition=?`, `sig-${caseId}-${edition}`, at, caseId, edition);
      st.sql.exec(`INSERT OR IGNORE INTO cases (case_id, project_id, opened) VALUES (?,?,?)`, caseId, project, at);
      st.sql.exec(`INSERT OR REPLACE INTO published_cases (case_id, edition, opened, ratified_at) VALUES (?,?,?,?)`,
                  caseId, edition, at, at);
    },
    /** A case of `project` with a ratified first edition, prepared by `owner`; answers its id. */
    ratifiedCase(project, owner) {
      const c = w.prepare(project, owner);
      w.ratify(c, project);
      return c.caseId;
    },
    docOf: (caseId, edition) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, caseId, edition),
  });
  return w;
}
