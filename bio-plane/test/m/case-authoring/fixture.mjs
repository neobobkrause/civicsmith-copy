/* case-authoring over the modules it uses, each the real one (record-core, membership, credentials, promotion,
   provenance, attestation, extraction's tables, content, entities, connections, inquiry, basis-versions, strength, bias, observation-log,
   reevaluation, publication, publish-schedule, ratification, contradiction, network-notices), on a real SQLite database (node:sqlite) standing in for a Durable Object's
   storage. What a later module fills is a stand-in the test controls: the run gate `ai-runs` registers with
   contradiction (its R13; `runs` below), the review provider (publication R23, which
   `review` registers once extracted) and its `case_drafts` table (review R26's read contract); and what case-carriage's
   `documentCopy` (its R16) answers of a member document's publication copy, when a test sets it (`copies` below). Every test drives
   `case-authoring` at its interface: `publishCase`, `publishPreflight`, `tensionsToDisclose`, its ops, its exports. The
   real `case-inputs` (`w.ci`, T47; N908) is built first, on the same clock, so a test records through it what other acts
   record about a case (an acknowledgement, a draft of what changed, an outcome, the open requests' source) before the
   act reads it. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { attestationOf } from "../../../src/attestation/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { biasOf, BIAS_SCHEMA } from "../../../src/bias/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { reevaluationOf } from "../../../src/reevaluation/index.mjs";
import { publicationOf } from "../../../src/publication/index.mjs";
import { publishScheduleOf } from "../../../src/publish-schedule/index.mjs";
import { ratificationOf, completenessFields } from "../../../src/ratification/index.mjs";
import { contradictionOf } from "../../../src/contradiction/index.mjs";
import { Capture } from "../../../src/capture/index.mjs";
import { doorbellOf } from "../../../src/doorbell/index.mjs";
import { sourcesOf } from "../../../src/sources/index.mjs";
import { networkNoticesOf } from "../../../src/network-notices/index.mjs";
import { caseAuthoringOf } from "../../../src/case-authoring/index.mjs";
import { caseAccountOf } from "../../../src/case-account/index.mjs";
import { caseInputsOf } from "../../../src/case-inputs/index.mjs";
import { caseDisclosuresOf } from "../../../src/case-disclosures/index.mjs";
import { caseCarriageOf } from "../../../src/case-carriage/index.mjs";
import { parseImportedFindingRef, importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { caseImportOf } from "../../../src/case-import/index.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { importedWorld } from "../case-import/fixtures.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { linesOf } from "../../../src/lines/index.mjs";
import { moneyOf } from "../../../src/money/index.mjs";
import { peopleOf } from "../../../src/people/index.mjs";

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
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
export const NOW = "2026-09-28T01:00:00Z";
export const T0 = "2026-09-27T00:00:00Z";
/* The statement, the justification, the scope and the bias acknowledgement a well-formed act authors. */
export const AUTHORED = Object.freeze({
  scope: "Whether the contract was awarded as the minutes say.",
  statement: "It does not cover the award's later amendments.",
  subjectPosition: "not_sought",
  subjectJustification: "The award is a public record and the question is whether it was followed.",
  biasAcknowledgement: "We read the minutes as the authoritative account of the meeting.",
  excluded: [],
  /* R55 (case-disclosures R27): the publishing owner attests holding no undeclared tie to anything the case names */
  tieAttested: true,
});

/* case-carriage R16 (T39; N806): what `documentCopy` answers a document this copy fetched, carried as captured. */
export const FETCHED_COPY = Object.freeze({ state: "public", copy: null, refused: null });

/* R38: what changed in an edition above 1, as a member writes it (the fixture's `publish` sends it on every act). */
export const WHAT_CHANGED = Object.freeze({ text: "The amendments were requested and are now excluded by name." });

/* review's table (its R26 read contract) and the columns its draft act writes. */
const CASE_DRAFTS = `CREATE TABLE IF NOT EXISTS case_drafts (draft_id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  case_id TEXT, params TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL, statement_by TEXT)`;

/** The dead answer of the stand-in review provider, C-87.1's code, as `review` builds it from no argument. */
export const DEAD = Object.freeze({ ok: false, reason: "NO_REVIEW_COPY", code: "NO_REVIEW_COPY", check: "C-87.1",
  translation: "(the review copy's dead answer)" });

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
      : newCase ? "NEW-CASE" : "DERIVED-CASE"),
    statedEdition: (ident, newCase) => (ident.caseId || newCase ? ident.edition : null),
    liveGrant,
    grantAdmitsCaseEdition: (s, c, e) => { const l = liveGrant(s); return !!(l && l.grant.case_id === c && Number(l.grant.edition) === Number(e)); },
    grantAdmits: (s, c, e) => { const l = liveGrant(s); return !!(l && l.grant.case_id === c && Number(l.grant.edition) === Number(e)); },
    deadAnswer: () => ({ ...DEAD }),
  };
}

export function world({ group = "test-group", provider = true, now = null, record: recordWrap = null, ratification: ratWrap = null,
                        inquiry: inqWrap = null, deps = {}, realImports = false, standards = null, copying = false } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  /* The columns inquiry writes on record-core's `bundles` (its R40), which the store's additive list creates today. */
  for (const c of ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"])
    st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW, ms: "2026-09-28T01:00:00.000Z" };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* credentials (layer 2, after membership): the signer keys and agent credentials ratification's pre-flight reads
     (membership's `attestingKeys` copy reads its table), registered with membership at its start (its R16, R17, R20). */
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  /* promotion (layer 2) is created by the first module that joins it, on this host (K61), and case-authoring does not
     use it itself: the fixture reaches the one instance through inquiry's (below). */
  const prov = provenanceOf(host, { record, membership, now: () => clock.now });
  prov.migrate();
  /* G9 (fix round 6; K4573): `copying` gives case-carriage the evidence store and the bucket a member document's copy is
     made from and held in (as the live plane binds them), so a test can run its real `copyBatch` and `copyNow`: bytes held
     in `w.evidence.held` by digest, copies in `w.bucket.held`. The instance is made here, before any module that reaches it
     without them (the host keeps the first). */
  const evidence = copying ? (() => {
    const held = new Map();
    return { held,
      async head(k) { const b = held.get(k); return b ? { size: b.length } : null; },
      async get(k) { const b = held.get(k); return b ? { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) } : null; },
      async put(k, bytes) { held.set(k, Buffer.from(bytes)); return { key: k }; } };
  })() : null;
  const bucket = copying ? (() => {
    const objects = new Map();
    return { held: objects,
      async put(k, bytes, opts = {}) { objects.set(k, { bytes: Buffer.from(bytes), opts }); return { key: k }; },
      async get(k) { const o = objects.get(k); return o ? { arrayBuffer: async () => o.bytes, ...o.opts } : null; },
      async head(k) { const o = objects.get(k); return o ? { size: o.bytes.length } : null; } };
  })() : null;
  if (copying) {
    record.evidenceStore = () => ({ head: (d) => evidence.head(String(d)), get: (d) => evidence.get(String(d)),
                                    put: (d, b) => evidence.put(String(d), b) });
    caseCarriageOf(host, { record, membership, bucket, store: "bio", provenance: prov, now: () => clock.now });
  }
  /* attestation (layer 3, after provenance), the real one: the attestations a capture holds (its R7), R55 (case-disclosures R2)'s read. */
  const attestation = attestationOf(host, { record, provenance: prov });
  /* capture (layer 3), its late attestations and signed accounts (its R68, R69) and its inbox (R72's read), and sources
     (layer 3) over it, each the real one; nothing here fetches. Created before any module that reaches sources on this storage, so its
     one instance keeps the test's clock. */
  const capture = new Capture(st, { record, env: { INSTANCE_NAME: "test", VERSION: "0.0.0" }, governor: null,
                                    provenance: prov, membership });
  capture.migrate();
  /* doorbell (layer 3, after capture), the real one on this host: it creates the `inbox` its knocks are pulled from
     (its R25; K2710: capture no longer creates it since T43-8), which `knocked` below writes and capture's R72 reads. */
  doorbellOf(host, { capture, record, provenance: prov, credentials });
  const sources = sourcesOf(host, { record, membership, capture, now: () => Date.parse(clock.now) });
  const ex = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  ex.migrate();
  const readings = {};
  const exProvider = {
    readingOf: (s) => (readings[s] ? { reading: {}, chain: null, pageCount: 50, containerExtent: undefined,
                                       textContainer: null, captureFormat: null, ...readings[s] } : null),
    unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [], onReading: () => ({ ok: true }),
  };
  const content = contentOf(host, { record, membership, provenance: prov, extraction: exProvider, now: () => clock.now });
  content.migrate();
  const retrieval = noSelection().retrieval;
  /* the record of people (layer 5), each the real module built on this host (K1619: never reached through inquiry):
     the registry, the world's events, the lines between entities, money facts and people, which case-disclosures reads
     for the people a case names (its R24–R27) and R57's timeline reads through events. */
  const entities = entitiesOf(host, { record, membership, provenance: prov });
  entities.migrate();
  const events = eventsOf(host, { record, membership, content, extraction: exProvider, provenance: prov, entities, readHooks: {},
                                  now: () => clock.now });
  events.migrate();
  const lines = linesOf(host, { record, provenance: prov, content, entities, events, now: () => clock.now });
  lines.migrate();
  const money = moneyOf(host, { record, membership, entities, provenance: prov, events, lines, now: () => clock.now });
  money.migrate();
  const people = peopleOf(host, { record, membership, entities, provenance: prov, content, sources, events, lines, money,
                                  duties: { dutiesOf: () => ({ ok: true, duties: [] }) }, now: () => clock.now });
  people.migrate();
  /* `standards`, when a test gives one, answers `standardRead` and `bindsAt` (standards R5, R43) for inquiry's legs and
     publication's criteria (R61, publication R75); else each reaches the real module on this host. */
  const held = standards ? { standards } : {};
  const inquiry = inquiryOf(host, { record, membership, content, retrieval, provenance: prov, entities, ...held,
                                    now: () => clock.now });
  inquiry.migrate();
  const promotion = inquiry.promotion;
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  /* connections, the one instance on this host (K1619), its tables migrated here */
  const connections = connectionsOf(host);
  connections.migrate();
  const basisVersions = basisVersionsOf(host, { record, membership, promotion, content,
    inquiry: { earned: (s, t) => inquiry.earned(s, t), legCapped, cyclePath: (id, t) => inquiry.cyclePath(id, t) },
    now: () => clock.now });
  basisVersions.migrate();
  const strength = strengthOf(host, { record, membership,
    inquiry: { basisFor: (id, o) => inquiry.basisFor(id, o), earned: (e, t) => inquiry.earned(e, t), legCapped,
               subjectEntityOf: (id) => inquiry.subjectEntityOf(id) },
    versions: basisVersions, producingGroup: () => group, now: () => clock.now });
  for (const s of BIAS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";"))
    if (s.trim()) st.db.exec(s);
  const bias = biasOf(host, { record, membership, promotion, entities });
  const observations = observationLogOf(host, { record, membership, provenance: prov, extraction: null,
                                                now: () => clock.now });
  observations.migrate();
  const reevaluation = reevaluationOf(host, { record, membership, promotion, inquiry, content, provenance: prov,
                                              strength, basisVersions, now: () => clock.now });
  const publication = publicationOf(host, { record, membership, promotion, inquiry, basisVersions, entities, ...held,
                                            now: () => clock.now });
  /* publish-schedule (layer 8, after publication; N823): the waiting editions R58 and R59 read (its R1, R7), the real
     one on this host, which registers its waiting source with publication (its R8). */
  const publishSchedule = publishScheduleOf(host, { record, membership, publication, now: () => clock.now });
  const ratification = ratificationOf(host, { record, membership, promotion, provenance: prov, inquiry, basisVersions,
                                              publication });
  /* contradiction (layer 6), on this host; the runs its gate answers for are the test's: {status, principal}. */
  const contradiction = contradictionOf(host, { record, extraction: ex, membership, promotion, entities, basisVersions,
                                                now: () => clock.now });
  contradiction.migrate();
  const runs = new Map();
  contradiction.registerRunGate("test", (id, viewer, caller) => {
    const r = runs.get(id);
    if (!r) return { found: false, running: false, refusal: null };
    return { found: true, running: r.status === "running",
             refusal: caller === r.principal ? null : { ok: false, reason: "AI_RUN_NOT_PRINCIPAL", code: "AI_RUN_NOT_PRINCIPAL" } };
  });
  st.db.exec(CASE_DRAFTS);
  /* `case-import`: the real one composed on this host (it fills accepted-work's registration itself, its R16), its
     checker scripted at case-checker's R1 (`w.checks`); else the stand-in, registered with accepted-work's one instance
     on this host (K1307), reached through strength, which reads it (its R33). */
  const checks = { group: "other-group", case: "CASE-2026-0900", edition: 1, findings: [] };
  const imports = realImports
    ? caseImportOf(host, { record, membership, strength, acceptedWork: strength.acceptedWork,
                           reevaluation: { acceptanceWithdrawn: () => ({ ok: true, told: true, dependents: 0 }) },
                           checkCaseFile: async () => ({ format: "bio-case-file/1", case: checks.case, edition: checks.edition,
                             group: checks.group, checker: { grading_versions: ["bio-grading/1"], checks_version: "1.57.0" },
                             integrity: { departures: [] }, signatures: { case: { verified: true } },
                             publication_checks: { findings: [] }, complete_edition: { equal: true },
                             statement: "Recreating shows the case intact and consistent, not true.",
                             findings: checks.findings.map((f) => ({ role: "load_bearing", result: "recreated", missing: [],
                                                                     differs: [], bar_met: "not_asked", ...f })) }),
                           now: () => Date.parse(clock.now) })
    : importsStandIn();
  if (!realImports) strength.acceptedWork.registerAcceptedWork("case-import", imports.registration);
  const w = {
    imports, checks,
    st, host, record, membership, credentials, promotion, prov, content, entities, connections, inquiry, basisVersions, strength,
    bias, observations, reevaluation, publication, publishSchedule, ratification, contradiction, runs, clock, readings, grants: new Map(),
    capture, sources, attestation, extraction: ex,
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM "${name}"`));
      return out;
    },
  };
  if (provider) publication.registerReviewProvider("review", reviewProvider(w));
  /* network-notices (layer 8), the real one on this host; `notices` lets a test set what its `noticeReferenceOf` (its
     R19) answers for a project, any value, where the real module would need a signed notice. A project not in it is
     answered by the real module. */
  w.networkNotices = networkNoticesOf(host, { record, membership, credentials, promotion, provenance: prov, capture,
                                             publication });
  w.notices = new Map();
  const networkNotices = { noticeReferenceOf: (project) => (w.notices.has(project) ? w.notices.get(project)
                                                                                  : w.networkNotices.noticeReferenceOf(project)) };
  /* case-disclosures (N529), composed here before case-authoring as the plane composes it (N536, K1355): the modules it
     reads are handed to it, a test's own stand-in for one of them (`deps`) included; case-authoring reaches this one
     instance on the host and hands it nothing. */
  const caseRecord = recordWrap ? recordWrap(record) : record;
  const READ_BY_DISCLOSURES = ["contradiction", "provenance", "attestation", "capture", "sources", "extraction",
                               "caseImport", "promotion", "inquiry", "strength", "entities", "lines", "money", "people",
                               "caseCarriage"];
  const given = (k) => Object.fromEntries(Object.entries(deps).filter(([d]) => k(d)));
  /* case-carriage (layer 8), the real one on this host, which case-disclosures reads for a photo's marks (its R10) and
     a member document's publication copy (its R16, T39; N806), and publication's commit for what lapsed (its R13). The
     fixture's documents are member documents recorded `clean` (`documentCopy` below). `copies` maps a capture's digest
     to an answer R16's read gives case-disclosures in place of the real one, or to a function of the digest answering
     it (one that throws: a read that fails). A test's own `deps.caseCarriage` replaces it whole. */
  w.copies = new Map();
  if (copying) Object.assign(w, { evidence, bucket });
  const carriage = caseCarriageOf(host);
  /* `w.copyNow`, when a test sets it, answers `copyNow` in place of the real one (G9: the act's wiring, apart from case-carriage's
     own copy); unset, the real instance answers, whatever it has. */
  const caseCarriage = new Proxy(carriage, { get: (t, p) => (p === "documentCopy"
    ? (captureSha) => { const a = w.copies.get(captureSha); return typeof a === "function" ? a(captureSha) : a ?? t.documentCopy(captureSha); }
    : p === "copyNow" && w.copyNow ? w.copyNow
    : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  w.cc = carriage;
  const disclosures = caseDisclosuresOf(host, { storage: st, entities, events, lines, money, people, membership,
    now: () => clock.now, record: caseRecord, contradiction, provenance: prov, attestation, capture, sources,
    extraction: ex, caseImport: imports, promotion, inquiry, strength, caseCarriage,
    ...given((d) => READ_BY_DISCLOSURES.includes(d)) });
  w.disclosures = disclosures;
  /* `inquiry` (a wrap) changes only what case-authoring reads of inquiry: R56's and R57's tests give a finding legs on a
     calculation or an event, which inquiry's own gate does not yet admit at promotion (C-2.8). */
  /* R63 (D56): case-disclosures R30's judgment of the account, the real one unless a test sets `w.judgeAccount`, which
     receives what case-authoring hands R30 and answers in its place (`w.judged` records each hand-over). */
  w.judged = [];
  const judgedDisclosures = new Proxy(disclosures, { get: (t, p) => (p === "accountJudged"
    ? (a) => { w.judged.push(a); return w.judgeAccount ? w.judgeAccount(a) : t.accountJudged(a); }
    : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  /* R69 (N839, K2608): `case-account`, built first on this host as the plane builds it before case-authoring (its R12),
     with the runs an account draft names, ai-runs' `runFor` over the test's own `runs` (as contradiction's gate above;
     a run is seen by every viewer but "nobody"), and the same judged disclosures and inquiry case-authoring reads.
     case-authoring reaches this one instance on the host and hands it nothing. */
  const aiRuns = { runFor: (id, viewer) => (runs.has(String(id)) && viewer !== "nobody"
    ? { run: String(id), status: runs.get(String(id)).status, mode: "draft" } : null) };
  const clockOf = now || ((p) => (p === "millisecond" ? clock.ms : clock.now));
  const caseInquiry = inqWrap ? inqWrap(deps.inquiry || inquiry) : deps.inquiry || inquiry;
  const chain = (h, cacc = null, ci = null) => {
    cacc ??= caseAccountOf(h, { record: caseRecord, membership, inquiry: caseInquiry, runs: aiRuns,
                                disclosures: judgedDisclosures, now: clockOf });
    ci ??= caseInputsOf(h, { record: caseRecord, membership, publication, publishSchedule, account: cacc, now: clockOf });
    const ca = caseAuthoringOf(h, { record: caseRecord, membership, basisVersions, inputs: ci,
      strength, bias, observations, reevaluation, publication, publishSchedule, ratification: ratWrap ? ratWrap(ratification) : ratification,
      networkNotices, now: clockOf, caseCarriage: deps.caseCarriage || caseCarriage,
      disclosures: judgedDisclosures, events,
      ...given((d) => !READ_BY_DISCLOSURES.includes(d) || d === "inquiry" || d === "strength"),
      inquiry: caseInquiry });
    return { cacc, ci, ca };
  };
  ({ cacc: w.cacc, ci: w.ci, ca: w.ca } = chain(host));
  /* A reload: a second host over the same storage, with its own instance of this module (a Durable Object coming up again),
     holding nothing in memory that the first held; the modules it asks keep their one instance and their tables. */
  w.reload = () => chain({ storage: st }, w.cacc, w.ci).ca;
  Object.assign(w, { events, lines, money, people });
  let n = 0;
  Object.assign(w, {
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    head: (id) => record.head(id)?.bundleSha ?? null,
    fm: (text) => parseFrontmatter(String(text || "")).data || {},
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute","publish"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    /** R55 (case-disclosures R6): a whole extracted-text index for `captureSha` (extraction R36's `unitsOf` reads it), one unit per entry of
     *  `units` (`{text, truncated?}`), or with `state` other than whole; the fixture's documents carry one unless asked
     *  not to (`text: false`). */
    indexText(captureSha, bundleId, units = [{ text: `the text of ${bundleId}` }], state = "whole") {
      st.sql.exec(`INSERT OR REPLACE INTO capture_text_state (capture_sha, bundle_id, state, offered, written, over_bound,
                   unaddressable, truncated, skipped_named, chain_kind, at) VALUES (?,?,?,?,?,0,0,?,0,'text',?)`,
                  captureSha, bundleId, state, units.length, units.length, units.filter((u) => u.truncated).length, T0);
      units.forEach((u, i) => st.sql.exec(`INSERT OR REPLACE INTO capture_text (capture_sha, bundle_id, extent_kind, extent,
                   ref, seq, text, truncated, chain_kind) VALUES (?,?,'doc-para',?,?,?,?,?,'text')`,
                  captureSha, bundleId, JSON.stringify({ kind: "doc-para", para: i + 1 }), `paragraph ${i + 1}`, i, u.text,
                  u.truncated ? 1 : 0));
    },
    /** An information bundle registering one capture, its text indexed whole unless `text: false`; answers the
     *  capture's sha. No receipt fetched it, so it is a member document (provenance R62): its publication copy is
     *  recorded `copy` (default `clean`, carried whole; null records none, so it reads `pending`). */
    doc(id, text = `bytes of ${id}`, { text: indexed = true, copy = "clean" } = {}) {
      const c = { path: "snapshots/c0.txt", text, sha: sha(text) };
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path: c.path, text: c.text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(c)] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) }] });
      if (!r.ok) throw new Error(`fixture doc refused: ${JSON.stringify(r).slice(0, 400)}`);
      if (indexed) w.indexText(c.sha, id);
      if (copy) w.documentCopy(c.sha, copy);
      return c.sha;
    },
    /** An inquiry whose basis is `legs` (each `{target, …leg fields}`), in `state`; `concluded` carries its own
     *  conclusion and falsifier (the no-project relationship's conclusion, §7.1 item 5). */
    finding(id, legs, { state = "concluded", lines = [], severed = [] } = {}) {
      const head = record.head(id);
      const r = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: V("alice"), files: [{ path: "bundle.md", text: inqMd(id, legs, { state, lines, severed }) }],
        meta: { object_type: "inquiry" } });
      if (!r.ok) throw new Error(`fixture finding refused: ${JSON.stringify(r).slice(0, 600)}`);
      return r;
    },
    /** A project owned (and so joined) by `owner`, citing `cites`; `extra` lines join its front matter. */
    project(title, owner, cites = [], { extra = [] } = {}) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites, extra) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** A project revision (its bundle.md), every other file carried. */
    reviseProject(id, title, owner, cites = [], extra = []) {
      return promotion.promote({ bundleId: id, base: record.head(id).bundleSha, snapKey: `k${++n}`, author: V(owner),
        files: [{ path: "bundle.md", text: projMd(title, cites, extra) }], meta: { object_type: "project" } });
    },
    join(project, member, state = "joined", owner = 0) {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, invited_by, created, updated)
                   VALUES (?, ?, ?, ?, 'alice', 't', 't')`, project, member, state, owner);
    },
    /** One act of op=publish by `owner` of `project` over `targets`, every member load-bearing unless `roles`. Every
     *  act says what changed (R38: an edition above 1 needs it, a first edition carries none); `over` replaces it. */
    publish(project, owner, targets, over = {}) {
      const roles = over.roles !== undefined ? over.roles : Object.fromEntries(targets.map((t) => [t, "load_bearing"]));
      return w.ca.publishCase({ ...AUTHORED, whatChanged: WHAT_CHANGED, project, targets, roles, viewer: V(owner),
                                author: owner, ...over });
    },
    /** Sign a prepared case edition through publication's commit (its R22), as op=caseratify does after its gate. */
    ratify(answer, { project = null, at = "2026-09-28T02:00:00Z" } = {}) {
      const doc = w.row(`SELECT doc_sha, text FROM case_documents WHERE case_id=? AND edition=?`, answer.caseId, answer.edition);
      const fm = w.fm(doc.text);
      const r = publication.commitCaseEdition({ caseId: answer.caseId, edition: answer.edition,
        project: project ?? fm.case_project, scope: fm.case_scope,
        completeness: { ...completenessFields(fm), subject_position: fm.completeness.subject_position ?? null,
                        author: fm.completeness.author ?? null },
        biasAcknowledgement: fm.bias_acknowledgement, bar: fm.required_strength,
        roster: (fm.case_roles || []).map((m) => ({ bundle_id: m.target, role: m.role, version_sha: m.version_sha })),
        docSha: doc.doc_sha, sigArmored: `sig-${answer.caseId}-${answer.edition}`, attestorKey: "key-1",
        attestorMember: fm.completeness.author, gateVersion: "1.37.0", deliveredBy: "founder", at });
      if (!r || r.ok === false) throw new Error(`fixture ratify refused: ${JSON.stringify(r).slice(0, 400)}`);
      /* ratification's commit dates the case edition's ratification (its R3), as the store's ceremony does today. */
      st.sql.exec(`UPDATE published_cases SET ratified_at=? WHERE case_id=? AND edition=? AND ratified_at IS NULL`,
                  at, answer.caseId, answer.edition);
      return r;
    },
    /** A draft of `project` (review's table), its params the op=publish arguments. */
    draft(id, project, params, { caseId = null, by = "alice", statementBy = by } = {}) {
      st.sql.exec(`INSERT OR REPLACE INTO case_drafts (draft_id, project_id, case_id, params, created_by, created_at,
                   updated_by, updated_at, statement_by) VALUES (?,?,?,?,?,?,?,?,?)`,
                  id, project, caseId, JSON.stringify(params), by, T0, by, T0, statementBy);
    },
    grant(secretSha, g) { w.grants.set(secretSha, { revoked: false, ...g }); },
    /** An information bundle registering one capture whose provenance document carries `extra` (attestations, a
     *  co-archive, attempts), fetched `direct` by this instance unless `receipt: false` (provenance R13: a Grade B
     *  capture, R24), else recorded `clean` as `doc` records it; answers the capture's sha. */
    graded(id, extra = {}, { receipt = true, text = `bytes of ${id}`, indexed = true } = {}) {
      const c = { path: "snapshots/c0.txt", text, sha: sha(text) };
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path: c.path, text: c.text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [{ ...provDoc(c), ...extra }] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) }] });
      if (!r.ok) throw new Error(`fixture graded refused: ${JSON.stringify(r).slice(0, 400)}`);
      if (indexed) w.indexText(c.sha, id);
      if (receipt) prov.recordReceipt({ address: `https://example.org/${id}`, addressNorm: `example.org/${id}`,
                                        captureSha: c.sha, retrieved: T0, via: "direct" });
      else w.documentCopy(c.sha, "clean");
      return c.sha;
    },
    /** A knock the doorbell received, already pulled into `captureSha` (capture R65, R72: the row of doorbell's `inbox`
     *  its read answers). */
    knocked(captureSha, { knockId = `KNOCK-2026-09-27-${captureSha.slice(0, 8)}`, received = T0, pseudonym = null } = {}) {
      st.sql.exec(`INSERT INTO inbox (knock_id, sha256, bytes, received, status, capture_sha, pulled_by, pulled_at,
                   pseudonym) VALUES (?, ?, 1, ?, 'pulled', ?, 'alice', ?, ?)`,
                  knockId, captureSha, received, captureSha, received, pseudonym);
      return knockId;
    },
    /** case-carriage R15's record of a member document's publication copy, as its `copyBatch` writes an outcome
     *  (`document_copies`, read by its R13 and R16): `state` `clean` (no details, carried whole), `copy` (`sha256` the
     *  cleaned copy's) or `refused` (`{code, detail}`), standing in for doc-clean's work on the bytes. */
    documentCopy(captureSha, state, { sha256 = null, refused = null } = {}) {
      st.sql.exec(`INSERT INTO document_copies (capture, state, sha256, refused_code, refused_detail, at)
                   VALUES (?,?,?,?,?,?)`, captureSha, state, sha256, refused?.code ?? null, refused?.detail ?? null, T0);
    },
  });
  return w;
}

/** `case-import` at its ruled interface (its R4, R9, R16), standing in until it is composed here: another group's
 *  imported editions, the acceptances in force and the open flags, as a test sets them. `accept(...)` answers the ref a
 *  leg names; `flagsRead`, when set, answers `openFlagsOn` in place of the held flags (a failed or incomplete read). */
/* case-import's real refusal of an import and edition it holds none of (its R4), taken from its published fixture. */
const NO_SUCH_EDITION = (await importedWorld()).ci.importedCase({ import: "IMP-2026-9999", edition: 1 });

export function importsStandIn() {
  const editions = new Map(), acceptances = new Map(), flags = [];
  const key = (...a) => a.join("#");
  const s = {
    flagsRead: null,
    edition(imp, edition, { group = "other-group", caseId = "CASE-2026-0900", manifestSha = "f".repeat(64), findings = [] } = {}) {
      editions.set(key(imp, edition), { edition, group, case: caseId, manifest_sha: manifestSha, findings });
    },
    accept(imp, edition, finding, a = {}) {
      acceptances.set(key(imp, edition, finding), { by: "alice", at: T0, reason: "We recreated it whole.",
        checked: "every passage", gaps: null, ...a });
      return importedFindingRef(imp, finding);
    },
    withdraw(imp, edition, finding) { acceptances.delete(key(imp, edition, finding)); },
    flag(imp, edition, f) { flags.push({ import: imp, edition, open: true, finding: null, at: T0, ...f }); },
    clear(flag) { for (const f of flags) if (f.flag === flag) f.open = false; },
    acceptanceOf: ({ import: imp, edition, finding }) => acceptances.get(key(imp, edition, finding)) ?? null,
    openFlagsOn: ({ import: imp, edition }) => (s.flagsRead ? s.flagsRead({ import: imp, edition })
      : { ok: true, complete: true, flags: flags.filter((f) => f.open && f.import === imp && f.edition === edition)
          .map(({ flag, finding, issue, at }) => ({ flag, finding, issue, at })) }),
    /* as case-import R4 answers: the source group and case at the top, the edition in full under `edition` */
    importedCase: ({ import: imp, edition }) => {
      const e = editions.get(key(imp, edition));
      return e ? { ok: true, import: imp, group: e.group, case: e.case, editions: [{ edition: e.edition }],
                   edition: { edition: e.edition, manifest_sha: e.manifest_sha, findings: e.findings } }
               : { ...NO_SUCH_EDITION, import: imp, edition };
    },
  };
  s.registration = {
    finding: ({ ref, edition }) => {
      const p = parseImportedFindingRef(ref);
      const e = p && editions.get(key(p.import, edition));
      if (!p || !e) return null;
      const f = e.findings.find((x) => x.finding === p.finding) || {};
      return { ref, import: p.import, group: e.group, case: e.case, edition, finding: p.finding,
               manifest_sha: e.manifest_sha, result: f.result ?? null, pair: f.pair ?? null,
               acceptance: acceptances.get(key(p.import, edition, p.finding)) ?? null };
    },
    openFlags: ({ ref, edition }) => {
      const p = parseImportedFindingRef(ref);
      return { complete: true, flags: flags.filter((f) => p && f.open && f.import === p.import && f.edition === edition) };
    },
    withdrawals: () => ({ withdrawals: [], cursor: null }),
  };
  return s;
}

export function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "${T0}"`,
          `last_updated: "${T0}"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

/** An inquiry document: `legs` its basis (each cited by a `cites` reference, confirmed unless its target is in `severed`);
 *  concluded in its own bytes. */
export function inqMd(id, legs = [], { state = "concluded", lines = [], severed = [] } = {}) {
  const val = (v) => (typeof v === "number" ? String(v) : `${v}`);
  /* a leg on another group's finding is not a reference (inquiry-grammar R11) */
  const refs = [...new Set(legs.map((l) => l.target).filter((t) => !/^(imported:|CALC-)/.test(String(t))))];
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
    `current_state: ${state}`, "prior_state: open", `created: "${T0}"`, `last_updated: "${T0}"`, "surfaced_by: human",
    ...(refs.length ? ["references:", ...refs.flatMap((t) => ["  - rel: cites", `    target: ${t}`,
                                                              `    status: ${severed.includes(t) ? "severed" : "confirmed"}`,
                                                              '    note: ""'])] : ["references: []"]),
    "state_history: []",
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => Object.entries({ role: "supports", ...l })
      .sort(([a], [b]) => (a === "target" ? -1 : b === "target" ? 1 : 0))
      .map(([k, v], i) => `${i ? "    " : "  - "}${k}: ${val(v)}`))] : []),
    ...(state === "concluded" ? [`conclusion: "the award followed the minutes"`, `falsifier: "a later amendment"`] : []),
    ...lines, "---", "", "## Question", "", `Was ${id} answered?`, "", "## Session Log", ""].join("\n");
}

export function projMd(title, cites = [], extra = []) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`,
          ...(cites.length ? ["references:", ...cites.flatMap((c) => {
            const o = typeof c === "string" ? { target: c } : c;
            return ["  - rel: cites", `    target: ${o.target}`, `    status: ${o.status || "confirmed"}`, '    note: ""',
                    ...(o.extent_capture ? [`    extent_capture: ${o.extent_capture}`] : [])];
          })] : ["references: []"]),
          "state_history: []", ...extra, "---", "", "## Objective", "", "Find out.", "", "## Session Log", ""].join("\n");
}

export function provDoc(c) {
  return {
    file: c.path, locator: `https://example.org/${c.path}`, retrieved: T0,
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: c.sha, encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
  };
}

/** The front-matter lines of one accepted reading of an inquiry (basis-versions R1–R5), named `name`, over `targets`,
 *  stating `claim`: the reading a project stands on and concludes (basis-versions R13, R16). */
export function readingLines(name, targets, claim = "the award followed the minutes") {
  return ["basis_versions:", `  - name: "${name}"`, `    description: "the reading called ${name}"`,
          `    relationship: "and"`, `    state: "accepted"`, "    hidden: false", "    derived_from: null",
          `    author: "member:alice"`, `    at: "${T0}"`, `    claim: "${claim}"`, `    state_by: "member:alice"`,
          `    state_at: "${T0}"`, `    state_reason: ""`,
          "basis_version_grounds:", `  - version: "${name}"`, `    ground: "main"`, `    asserted_by: "member:alice"`,
          `    at: "${T0}"`,
          "basis_version_legs:", ...targets.flatMap((t) => [`  - version: "${name}"`, `    target: ${t}`,
                                                              `    role: "supports"`, `    ground: "main"`])];
}

/** A project's CURRENT reading of `inquiry` (basis-versions R13, R15), as front-matter lines of the project. */
export function currentLines(inquiry, version = "first") {
  return ["current_versions:", `  - inquiry: "${inquiry}"`, `    version: "${version}"`, `    at: "${T0}"`,
          `    by: "member:alice"`];
}
