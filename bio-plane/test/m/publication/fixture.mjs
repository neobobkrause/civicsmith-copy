/* publication over the modules it uses, each the real one (record-core, membership, credentials, promotion, provenance,
   content, connections, inquiry, basis-versions, reevaluation; content reached through connections), on a real SQLite database (node:sqlite) standing in for a Durable Object's
   storage. What a later module registers (instance-setup's fact `producingGroup`, review's provider) is a stand-in the
   test controls; so are `standards` and `entities` when a test gives them (R72 reads them at a commit), and
   project-roster's `projectScope` (its R23; R78 reads it at a commit), answering from `w.scopes`, each ask in `w.scopeAsks`. The ceremonies that write through this module (`ratification`, `case-authoring`) are played by the
   test through R21 and R22, exactly as those modules call them. Every test drives `publication` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { reevaluationOf } from "../../../src/reevaluation/index.mjs";
import { sourcesOf } from "../../../src/sources/index.mjs";
import { publicationOf, publicationOps, captureBlockLines, sourceBlockLines } from "../../../src/publication/index.mjs";
import { acceptedWorkOf } from "../../../src/accepted-work/index.mjs";
import { caseTensionsOf, caseTensionsOps } from "../../../src/case-tensions/index.mjs";
import { materialsLines, materialAttestationLines, acceptedWorkBlockLines, calculationsLines,
         timelineLines } from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { standardReadWorld } from "../standards/fixtures.mjs";

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
/** standards' own answer for an id it does not hold, or one `viewer` may not read (its fixture `standardReadWorld`), made
 *  when first asked: the one answer (`NO_SUCH_STANDARD`) a stand-in for `standardRead` gives beside the ones it holds. */
/* retrieval's own refusal of a selection it holds none of (its fixture `noSelection`), made when first asked */
let heldNone = null;
let heldStandards = null;
export const absentStandard = (id, viewer = "nobody") =>
  (heldStandards ||= standardReadWorld()).standardRead({ id: String(id), viewer });
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` or `.length` of it is undefined. It also refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB
   pattern too complex"), which node:sqlite does not (K313). This storage answers as workerd does, so code that indexes
   a cursor or writes a long pattern fails here as it would in the Durable Object (K316). */
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

/* `workerd: false` answers arrays, as this fixture did before K316: another module's fixture builds on `world()` and
   shapes the storage itself (filings'), so the default is kept for it; this module's own tests use `planeWorld`. */
export function storage({ workerd = false } = {}) {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      if (!workerd) {
        const st = db.prepare(q);
        return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
      }
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
export const MACHINE = "class:daemon";
export const NOW = "2026-09-28T01:00:00Z";
export const SIG = (n = 1) => `-----BEGIN SSH SIGNATURE-----\nsig${n}\n-----END SSH SIGNATURE-----`;
export const KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIKEY";

/* The columns inquiry writes on record-core's `bundles` (its R40), which the store's additive list creates today. */
const BUNDLE_COLUMNS = ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"];
/* The columns of extraction's tables that inquiry, content, connections and basis-versions join. */
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
const NO_READINGS = {
  readingOf: () => null, unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [], onReading: () => ({ ok: true }),
};

/** This module's tests: the world over storage shaped as workerd's (K316). */
export const planeWorld = (opts = {}) => world({ ...opts, workerd: true });

export function world({ group = "test-group", workerd = false, contradiction = null, standards = null, entities = null,
                        carriage = null, realRoster = false } = {}) {
  const st = storage({ workerd });
  const all = (c) => (Array.isArray(c) ? c : c.toArray());
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  for (const c of BUNDLE_COLUMNS) st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* credentials after membership, as the store builds them (K789): its tables, and its seam registered with membership. */
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  const groupRef = { value: group };
  promotion.registerFact("producingGroup", "instance-setup", () => groupRef.value);
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  for (const t of EXTRACTION_JOINED) st.db.exec(t);
  /* content (which inquiry and basis-versions use) is reached through connections' factory on this host. */
  const connections = connectionsOf(host, { record, membership, promotion, extraction: NO_READINGS, capture: {} });
  const content = connections.content;
  content.migrate();
  connections.entities.migrate();
  connections.migrate();
  const k = inquiryOf(host, { record, membership, promotion, content, connections, entities: connections.entities,
                              retrieval: { selectionResolve: (a) => (heldNone ||= noSelection()).selectionResolve(a) },
                              provenance: prov, now: () => clock.now });
  k.migrate();
  const basisVersions = basisVersionsOf(host, { record, membership, promotion, content,
    inquiry: { earned: (s, t) => k.earned(s, t), legCapped, cyclePath: (id, t) => k.cyclePath(id, t) },
    now: () => clock.now });
  basisVersions.migrate();
  /* sources (layer 3) over a stand-in for doorbell's one keyed read (`pulledKnocksOf`, sources R1, doorbell R18): the
     test pulls knocks with `w.knock`. Its clock is the world's, in milliseconds. */
  const knocks = [];
  const src = sourcesOf(host, { record, membership, now: () => Date.parse(clock.now),
    doorbell: { pulledKnocksOf: (captureSha) => knocks.filter((k) => k.sha256 === captureSha) } });
  /* reevaluation before publication, as the plane's store builds them: publication registers its cited parts with it (R41, R43). */
  const r = reevaluationOf(host, { record, membership, promotion, inquiry: k, content, connections, provenance: prov,
                                   basisVersions, now: () => clock.now });
  /* accepted-work (layer 6), the real module; what case-import registers with it is a stand-in each test controls. */
  const acceptedWork = acceptedWorkOf(host, { record, promotion });
  /* R57: extraction's indexed units of a capture, and R60: the actors capture recorded for one, as stand-ins the test
     sets (`w.units`, `w.actors`), each answering exactly the shape of the module's own read. */
  const units = new Map(), actors = new Map();
  const extraction = { unitsOf: (sha) => (units.has(sha) ? { capture_sha: sha, ...units.get(sha) }
                                                          : { capture_sha: sha, units: [], state: null }) };
  const capture = { captureAccountsOf: (sha) => ({ captureSha: sha, actors: (actors.get(sha) || []).map((a) => ({ actor: a, at: NOW })),
                                                   accounts: [] }) };
  /* R78: project-roster's R23 read, `{scope, since, by}`, `none` for a project with no scope set. */
  const scopes = new Map(), scopeAsks = [];
  const roster = { projectScope: (id) => { scopeAsks.push(id);
    return scopes.has(id) ? { scope: scopes.get(id), since: NOW, by: "olive" } : { scope: "none", since: null, by: null }; } };
  /* `realRoster`: no stand-in, so this module reaches project-roster itself, on this host (R78's default). */
  const p = publicationOf(host, { record, membership, credentials, promotion, inquiry: k, basisVersions, reevaluation: r,
                                  ...(realRoster ? {} : { roster }),
                                  ...(contradiction ? { contradiction } : {}), ...(standards ? { standards } : {}),
                                  ...(entities ? { entities } : {}), sources: src, acceptedWork, extraction,
                                  capture, provenance: prov, now: () => clock.now, ...(carriage || {}) });
  let n = 0;
  const w = {
    st, host, record, membership, credentials, promotion, prov, content, connections, k, basisVersions, r, p, clock, groupRef, src,
    acceptedWork, units, actors, scopes, scopeAsks,
    /** A knock pulled into the capture `captureSha` (capture R65), and its source minted as `sources` R1 mints it. */
    knock(captureSha, { knockId = `KNOCK-${knocks.length + 1}`, pseudonym = null, received = NOW, viewer = V("olive") } = {}) {
      knocks.push({ knock_id: knockId, sha256: captureSha, bytes: 10, received, pseudonym, knocker_digest: pseudonym ? `d-${pseudonym}` : null });
      const r = src.sourceOf({ captureSha, viewer });
      if (!r.ok) throw new Error(`fixture knock refused: ${JSON.stringify(r)}`);
      return all(st.sql.exec(`SELECT source_id FROM source_knocks WHERE knock_id=?`, knockId))[0].source_id;
    },
    row: (q, ...a) => all(st.sql.exec(q, ...a))[0] ?? null,
    rows: (q, ...a) => all(st.sql.exec(q, ...a)),
    count: (t) => all(st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`))[0].n,
    snapshot(tables = null) {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        if (!tables || tables.includes(name)) out[name] = JSON.stringify(all(st.sql.exec(`SELECT * FROM "${name}"`)));
      return out;
    },
    /** An op, as the plane's op map runs it: `query` the control plane's search params, `body` its JSON. The map spreads
     *  case-tensions' ops beside this module's, as the plane's does since T33-90 (N597). */
    op(name, query = {}, body = null) {
      const url = new URL(`http://do/${name}`);
      for (const [key, v] of Object.entries(query)) if (v != null) url.searchParams.set(key, String(v));
      return { ...caseTensionsOps(caseTensionsOf(host), url, body), ...publicationOps(p, url, body) }[name]();
    },
    member(id, { role = "member", handle = `h_${id}`, cover = `Cover ${id}`, status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, cover, handle, role, status);
    },
    project(title, owner) {
      const res = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" } });
      if (!res.ok) throw new Error(`fixture project refused: ${JSON.stringify(res).slice(0, 400)}`);
      return res.bundleId;
    },
    /** A document (information bundle) with one capture of its own, fetched by this copy: a `direct` receipt names it
     *  (provenance R62), so case-carriage carries it whole as captured (its R13, R16; T39). `fetched: false` leaves it
     *  with no receipt, a member document. `digest` names the capture's sha (a test that must state which captures a
     *  finding rests on); by default the sha of the document's own text. */
    doc(id, { fetched = true, digest = null } = {}) {
      const text = `the text of ${id}`, path = `snapshots/${id}.txt`, capSha = digest || sha(text);
      const res = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path, text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(path, text, capSha)] }, null, 2) }],
        meta: { object_type: "information" },
        register: [{ sha256: capSha, path, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
      if (!res.ok) throw new Error(`fixture doc refused: ${JSON.stringify(res).slice(0, 400)}`);
      if (fetched) {
        const rc = prov.recordReceipt({ addressNorm: `example.org/${id}`, captureSha: capSha, retrieved: NOW, via: "direct" });
        if (!rc.recorded) throw new Error(`fixture doc receipt refused: ${JSON.stringify(rc).slice(0, 400)}`);
      }
      return res;
    },
    /** An inquiry through promotion (so inquiry's check and projection run); `legs` as inquiry's grammar (a leg's `date`
     is its authored instant). */
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
    /** A member's firsthand observation, through provenance's `testify`. */
    observe(author, words = `I saw it, ${author}.`) {
      const r = prov.testify({ words, observedAt: "2026-09-27", title: `Observation by ${author}`, author });
      if (!r.ok) throw new Error(`fixture testify refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundle_id;
    },
    /** The unsigned case document of one edition, stored through R21 as case-authoring stores it. */
    prepare(caseId, edition, opts = {}) {
      const text = caseDoc(caseId, edition, opts);
      const r = p.storeCaseDocument({ case: caseId, edition, text, author: V(opts.author || "olive"), at: NOW });
      if (!r.ok) throw new Error(`fixture prepare refused: ${JSON.stringify(r)}`);
      return r;
    },
    /** Ratification's commit of a case edition (R22), inside a transaction as ratification makes it. */
    signCase(caseId, edition, { project = "PROJ-1", roster = [], signer = "olive", sig = SIG(edition), at = NOW,
                                completeness = { statement: "It leaves out the minutes.", author: V("olive") },
                                bar = null } = {}) {
      return record.transact(() => p.commitCaseEdition({ case: caseId, edition, project, scope: "The question.",
        completeness, biasAcknowledgement: "none declared", bar, roster, sigArmored: sig, attestorKey: KEY,
        attestorMember: signer, gateVersion: "plane-gate/test", deliveredBy: V(signer), at }));
    },
    /** A case edition signed BEFORE T28 (R58 refuses committing one now): its rows as the commit wrote them then, over
     *  a document stored through R21, so the reads of an older signed document can still be driven. */
    signLegacy(caseId, edition, { project = "PROJ-1", roster = [], signer = "olive", sig = SIG(edition), at = NOW,
                                  completeness = { statement: "It leaves out the minutes.", author: V("olive") }, bar = null,
                                  deliveredBy = V(signer) } = {}) {
      const doc = w.row(`SELECT doc_sha, text FROM case_documents WHERE case_id=? AND edition=?`, caseId, edition);
      if (!doc) throw new Error("fixture signLegacy: prepare the document first");
      st.sql.exec(`INSERT INTO cases (case_id,project_id,opened) VALUES (?,?,?) ON CONFLICT(case_id) DO NOTHING`, caseId, project, at);
      st.sql.exec(`INSERT INTO published_cases (case_id,edition,scope,completeness,bias_acknowledgement,bar,opened)
                   VALUES (?,?,?,?,?,?,?)`, caseId, edition, "The question.", JSON.stringify(completeness), "none declared",
                  bar ? JSON.stringify(bar) : null, at);
      roster.forEach((m, i) => st.sql.exec(`INSERT INTO published_case_members (case_id,edition,ord,bundle_id,version_sha,role)
                                            VALUES (?,?,?,?,?,?)`, caseId, edition, i, m.bundle_id, m.version_sha ?? null, m.role ?? null));
      st.sql.exec(`UPDATE case_documents SET sig_armored=?, attestor_key=?, attestor_member=?, gate_version=?, delivered_by=?,
                   ratified_at=? WHERE case_id=? AND edition=?`, sig, KEY, signer, "plane-gate/test", deliveredBy ?? null, at,
                  caseId, edition);
      st.sql.exec(`INSERT INTO published_shas (sha256,bundle_id,path,kind,bytes,published) VALUES (?,?,?,?,?,?)`,
                  doc.doc_sha, caseId, `case-document-edition-${edition}.md`, "case_document", Buffer.byteLength(doc.text), at);
      return { ok: true, caseId, edition };
    },
    /** Ratification's commit of one published edition (R22). */
    signFinding(bundleId, { edition = undefined, title = `Finding ${bundleId}`, edges = [], shas = null, signer = "olive",
                             sig = SIG(9), strength = null, memberCarriesBlocks = false, at = NOW } = {}) {
      const bundleSha = w.head(bundleId);
      return record.transact(() => p.commitEdition({ bundleId, bundleSha, edition, title, completeness: null, strength,
        memberCarriesBlocks, group: "test-group", edges,
        shas: shas || [{ sha256: bundleSha, path: "bundle.md", kind: "bundle", bytes: 10 }],
        attestorKey: KEY, attestorMember: signer, gateVersion: "plane-gate/test", sigArmored: sig,
        deliveredBy: V(signer), at }));
    },
  };
  return w;
}

/** A case document (`bio-case-document/6` unless `format`, with its `method:` and `materials:` blocks; R58; a `/7`
 *  one, identical in fields (case-grammar R1; DEC-124, K1365 (1)), states the same blocks): the facts this module reads from it. `roles`:
 *  [{target, version_sha, edition?, role?}]; `strength`: [{target, axis, state, grade}]; `excluded`: [{target,
 *  description, reason}]; `attributions`: [{observation, level, shown, chosen_at_edition}] (a run is written only when
 *  given); `citations`: rows for /4's `case_citations` ({target, version, capture?}; `capture` written when given);
 *  `tensions`: the /5 section as case-authoring writes it (case-authoring J1's shape): `{rows, sentences, depth?}`, each
 *  row's and sentence's fields written as given (a string quoted), `unread` ({target, legs}, K499) when given.
 *  `blocks`: `{captures?, sources?}`, R20's /5 blocks through `captureBlockLines` and
 *  `sourceBlockLines`. `materials`, `attestations`: /6's rows (case-grammar R12); `acceptedWork`, `acceptedWorkFlags`: its
 *  R16 rows, written when given. `calculations`, `timeline`: its R18 and R20 rows (T33), written with its line builders
 *  when given. */
export function caseDoc(caseId, edition, { project = "PROJ-1", roles = [], findings = null, strength = [], excluded = [],
                                           attributions = null, citations = [], tensions = null, format = null,
                                           excludes = "Nothing else.", ack = false, blocks = null,
                                           method = { grading: "grading/1", checks: "1.0.0" }, materials = [],
                                           attestations = [], acceptedWork = null, acceptedWorkFlags = null,
                                           calculations = null, timeline = null } = {}) {
  format ??= "bio-case-document/6";
  const v6 = format === "bio-case-document/6" || format === "bio-case-document/7";
  const scalar = (v) => (v === null || v === undefined ? "null" : typeof v === "string" ? `"${v}"` : String(v));
  const rowsOf = (key, list) => (list.length ? [`${key}:`, ...list.flatMap((r) => Object.entries(r)
    .map(([k, v], i) => `${i ? "   " : "  -"} ${k}: ${scalar(v)}`))] : [`${key}: []`]);
  const fm = ["---", `format: ${format}`, `case_id: ${caseId}`, `case_edition: ${edition}`, `case_project: ${project}`,
    "case_roles:", ...roles.flatMap((r) => [`  - target: ${r.target}`, `    version_sha: ${r.version_sha}`,
      `    edition: ${r.edition ?? 1}`, `    role: ${r.role ?? "load_bearing"}`]),
    "case_findings:", ...(findings ?? roles.map((r) => r.target)).map((f) => `  - ${f}`),
    ...(strength.length ? ["case_strength:", ...strength.flatMap((s) => [`  - target: ${s.target}`, `    axis: ${s.axis}`,
      `    state: ${s.state ?? "graded"}`, `    grade: ${s.grade}`])] : ["case_strength: []"]),
    "completeness:", "  author: member:olive", `  at: "${NOW}"`,
    ...(ack ? ["  statement_sha: abc", "  acknowledged: 0"] : []),
    ...(excluded.length ? ["completeness_excluded:", ...excluded.flatMap((x, i) => [`  - target: ${x.target}`,
      `    description: "${x.description ?? `row ${i}`}"`, `    reason: "${x.reason ?? "out of scope"}"`])]
      : ["completeness_excluded: []"]),
    ...(attributions ? ["observation_attributions:", ...attributions.flatMap((r) => [`  - observation: ${r.observation}`,
      `    level: ${r.level ?? "null"}`, `    shown: ${r.shown == null ? "null" : `"${r.shown}"`}`,
      `    chosen_at_edition: ${r.chosen_at_edition ?? "null"}`])] : []),
    ...(citations.length ? ["case_citations:", ...citations.flatMap((c) => [`  - target: ${c.target}`,
      `    version: ${c.version}`, ...(c.capture !== undefined ? [`    capture: ${c.capture ?? "null"}`] : [])])]
      : ["case_citations: []"]),
    ...(tensions ? [`tensions_disclosed: ${tensions.rows.length}`,
      `tensions_highlighted: ${tensions.rows.filter((r) => r.unseen_other_side).length}`,
      ...(tensions.depth ? [`tensions_depth_stated: "${tensions.depth}"`] : []),
      ...(tensions.unread ? rowsOf("case_tensions_unread", tensions.unread) : []),
      ...rowsOf("case_tensions", tensions.rows), ...rowsOf("case_tension_sentences", tensions.sentences || [])] : []),
    /* R20 (N364): the /5 blocks, written with this module's own line builders, as case-authoring writes them. */
    ...(blocks && blocks.captures ? captureBlockLines(blocks.captures) : []),
    ...(blocks && blocks.sources ? sourceBlockLines(blocks.sources) : []),
    /* case-grammar R11, R12, R16 (DEC-112, N522): /6's method and materials, and another group's work it rests on. */
    ...(v6 && method ? ["method:", `  grading: ${scalar(method.grading)}`, `  checks: ${scalar(method.checks)}`] : []),
    /* written with case-grammar's own line builders (its R12, R16), as case-authoring writes them */
    ...(v6 ? materialsLines(materials) : []),
    ...(v6 ? materialAttestationLines(attestations) : []),
    ...(acceptedWork || acceptedWorkFlags ? acceptedWorkBlockLines({ rows: acceptedWork || [], flags: acceptedWorkFlags || [] }) : []),
    ...(calculations ? calculationsLines(calculations) : []),
    ...(timeline ? timelineLines(timeline) : []),
    "---"];
  const body = ["", "## Scope", "", "The question.", "",
    ...(ack ? ["**Who else read this statement.** Nobody yet.", ""] : []),
    ...(attributions ? ["## Whose Words These Are", "", "old words", ""] : []),
    "## What This Excludes", "", excludes, "", "## What Was Searched", "", "Everything.", ""];
  return [...fm, ...body].join("\n");
}

export function inquiryMd(id, { question = `Is ${id} answered?`, legs = [], refs = null, state = "open", extra = [] } = {}) {
  const references = refs ?? [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites" }));
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${question}"`,
    `current_state: ${state}`, "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
    `last_updated: "2026-09-27T00:00:00Z"`, "group: test-group",
    ...(references.length
      ? ["references:", ...references.flatMap((r) => [`  - target: ${r.target}`, `    rel: ${r.rel || "cites"}`,
          `    status: ${r.status || "confirmed"}`])]
      : ["references: []"]),
    "state_history: []", "surfaced_by: human", 'disposition_reason: ""',
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role || "supports"}`,
                                                         ...(l.date ? [`    date: "${l.date}"`] : [])])] : []),
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

function provDoc(path, text, capSha = sha(text)) {
  return {
    file: path, locator: `https://example.org/${path}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: capSha, encoding: "utf8",
               bytes: Buffer.byteLength(text) },
    origin: { kind: "named_request" },
  };
}
