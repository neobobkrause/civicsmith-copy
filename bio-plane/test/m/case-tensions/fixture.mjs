/* case-tensions over the modules it uses, each the real one (record-core, membership, promotion, provenance), on a
   real SQLite database (node:sqlite) shaped as workerd's storage (a cursor, never an array; K316), standing in for a Durable Object's storage. Never publication's fixture, which is later in the order (P4;
   case-carriage's precedent): `publication`'s provider (K1505 (3), its R61) is a stand-in over in-memory case editions,
   each door answering exactly the shape the module's header names, its splice spliced as publication R21 splices
   (through case-grammar's section locators). What a later or other module answers is a stand-in the test controls:
   `basis-versions`' `testimonyReach` (`w.reach`), `contradiction` R29's `unresolvedRecordOn`, capture's
   `captureAccountsOf` (`w.actors`). Findings are bundles promoted through `promotion`, whose current sha is the pin.
   Every test drives `case-tensions` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { SECTIONS, sourceBlockLines, materialsLines, materialAttestationLines } from "../../../src/case-grammar/index.mjs";
import { caseTensionsOf, caseTensionsOps } from "../../../src/case-tensions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
export const V = (id) => `member:${id}`;
export const NOW = "2026-09-28T01:00:00Z";

/* workerd's `sql.exec` answers a cursor: rows are read by iterating it (or `toArray()`/`one()`). */
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

/** A stand-in for `publication`'s provider (its R61), over `editions` (`key -> {case_id, edition, text, doc_sha, signed,
 *  ratified, roster: [{bundle_id, version_sha, role}]}`) and `owners` (`case_id -> project_id`). Every door call is
 *  recorded in `calls`; a door named in `fail` throws. */
export function publicationStandIn() {
  const editions = new Map(), owners = new Map(), calls = [], fail = new Set();
  const key = (c, e) => `${c}\u0000${Number(e)}`;
  const sorted = () => [...editions.values()].sort((a, b) => (a.case_id < b.case_id ? -1 : a.case_id > b.case_id ? 1 : a.edition - b.edition));
  const rec = (door, args) => { calls.push([door, ...args]); if (fail.has(door)) throw new Error(`${door} is down`); };
  const provider = {
    module: "publication",
    pins(bundleId, sha) {
      rec("pins", [bundleId, sha]);
      return sorted().flatMap((e) => e.roster.filter((m) => m.bundle_id === bundleId && m.version_sha === sha)
        .map((m) => ({ case_id: e.case_id, edition: e.edition, version_sha: m.version_sha, role: m.role ?? null,
                       project_id: owners.get(e.case_id) ?? null })));
    },
    preparations(bundleId) {
      rec("preparations", [bundleId]);
      return sorted().filter((e) => !e.signed && e.text.includes(`  - target: ${bundleId}\n`))
        .map((e) => ({ case_id: e.case_id, edition: e.edition, text: e.text, ratified: !!e.ratified }));
    },
    caseDocument(caseId, edition) {
      rec("caseDocument", [caseId, edition]);
      const e = editions.get(key(caseId, edition));
      return e ? { case_id: e.case_id, edition: e.edition, doc_sha: e.doc_sha, text: e.text, signed: e.signed,
                   project_id: owners.get(e.case_id) ?? null } : null;
    },
    members(caseId, edition) {
      rec("members", [caseId, edition]);
      const e = editions.get(key(caseId, edition));
      return e ? e.roster.map((m) => ({ bundle_id: m.bundle_id, version_sha: m.version_sha ?? null })) : [];
    },
    latestRatified({ project = null, after = "", limit = 201 } = {}) {
      rec("latestRatified", [{ project, after, limit }]);
      const latest = new Map();
      for (const e of sorted()) if (e.ratified) latest.set(e.case_id, e.edition);
      return [...latest].filter(([c]) => c > (after || "") && (!project || owners.get(c) === project))
        .slice(0, limit).map(([c, ed]) => ({ case_id: c, edition: ed, project_id: owners.get(c) ?? null }));
    },
    signedDocumentsNaming(text, limit) {
      rec("signedDocumentsNaming", [text, limit]);
      return sorted().filter((e) => e.signed && e.text.includes(text)).slice(0, limit).map((e) => ({ text: e.text }));
    },
    /* publication R21's splice: one named section of an UNSIGNED document still at `docSha`. */
    reauthorSection({ caseId, edition, docSha = null, section, lines }) {
      rec("reauthorSection", [{ caseId, edition, docSha, section }]);
      const e = editions.get(key(caseId, edition));
      const held = { case_id: caseId, edition, doc_sha: e ? e.doc_sha : null };
      if (!e) return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_held") };
      if (e.signed) return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_signed") };
      if (docSha && e.doc_sha !== docSha) return { ok: true, ...held, reauthored: false, why: "moved" };
      const all = e.text.split("\n");
      const at = SECTIONS[section](all);
      if (!at) return { ok: true, ...held, reauthored: false, why: `no ${section} section` };
      const text = [...all.slice(0, at.f0), ...lines.frontmatter, ...all.slice(at.f1, at.b0), ...lines.body, ...all.slice(at.b1)].join("\n");
      if (text === e.text) return { ok: true, ...held, reauthored: false };
      e.text = text; e.doc_sha = sha(text);
      return { ok: true, case_id: caseId, edition, doc_sha: e.doc_sha, reauthored: true };
    },
  };
  return {
    provider, editions, owners, calls, fail,
    put(caseId, edition, text, { project = null, roster = [], signed = false, ratified = signed } = {}) {
      if (project !== null && !owners.has(caseId)) owners.set(caseId, project);
      const e = { case_id: caseId, edition: Number(edition), text, doc_sha: sha(text), signed, ratified, roster };
      editions.set(key(caseId, edition), e);
      return e;
    },
    get: (caseId, edition) => editions.get(key(caseId, edition)) || null,
  };
}

/** The world: the real layer-2 modules and provenance, the stand-ins, and case-tensions created on the host with the
 *  provider registered (unless `provider: false`). */
export function world({ group = "test-group", provider = true, contradiction = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  const groupRef = { value: group };
  promotion.registerFact("producingGroup", "instance-setup", () => groupRef.value);
  promotion.registerFact("citedBy", "connections", () => []);
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  /* basis-versions' testimonyReach: `reach` maps a finding to the observations it reaches itself (`self`) and through
     another (`via`), as its R-shape answers. */
  const reach = new Map();
  const basisVersions = { testimonyReach(ids) {
    const self = [], via = [];
    for (const id of ids) { const r = reach.get(id) || {}; self.push(...(r.self || [])); via.push(...(r.via || [])); }
    return { self: [...new Set(self)], via };
  } };
  const actors = new Map(), accounts = new Map();
  const capture = { captureAccountsOf: (s) => ({ captureSha: s, actors: (actors.get(s) || []).map((a) => ({ actor: a, at: NOW })),
                                                 accounts: accounts.get(s) || [] }) };
  const ctr = contradiction || { unresolvedRecordOn: ({ finding, sha }) => ({ ok: true, wrote: false, finding, sha, candidates: [], truncated: false }) };
  const pub = publicationStandIn();
  const ct = caseTensionsOf(host, { record, membership, promotion, basisVersions, contradiction: ctr, capture,
                                    now: () => clock.now });
  if (provider) {
    const r = ct.registerPublicationProvider("publication", pub.provider);
    if (!r.ok) throw new Error(`fixture provider refused: ${JSON.stringify(r)}`);
  }
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, clock, groupRef, reach, actors, accounts, pub, ct,
    row: (q, ...a) => [...st.sql.exec(q, ...a)][0] ?? null,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => [...st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n,
    snapshot(tables = null) {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        if (!tables || tables.includes(name)) out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM "${name}"`)]);
      return out;
    },
    op(name, query = {}, body = null) {
      const url = new URL(`http://do/${name}`);
      for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
      return caseTensionsOps(ct, url, body)[name]();
    },
    member(id, { role = "member", handle = `h_${id}`, cover = `Cover ${id}`, status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, cover, handle, role, status);
    },
    /** A project `id` whose owners are `owners` (membership's participants table, as membership's own rows hold them). */
    project(id, owners = []) {
      owners.forEach((m, i) => st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, owner_order, created, updated)
                                             VALUES (?, ?, 'joined', 1, ?, 't', 't')`, id, m, i));
      return id;
    },
    /** A finding stand-in: an information bundle promoted through promotion, its `bundle.md` `words` (a new revision
     *  when it exists). Answers its current sha. */
    finding(id, words = "first") {
      const head = record.head(id);
      const res = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id, words) }], meta: { object_type: "information" } });
      if (!res.ok) throw new Error(`fixture finding refused: ${JSON.stringify(res).slice(0, 400)}`);
      return record.head(id).bundleSha;
    },
    head: (id) => record.head(id)?.bundleSha ?? null,
    /** A member's firsthand observation, through provenance's `testify`. */
    observe(author, words = `I saw it, ${author}.`) {
      const r = prov.testify({ words, observedAt: "2026-09-27", title: `Observation by ${author}`, author });
      if (!r.ok) throw new Error(`fixture testify refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundle_id;
    },
    /** An unsigned case document of one edition, as case-authoring stores it through publication. */
    prepare(caseId, edition, opts = {}) {
      return pub.put(caseId, edition, caseDoc(caseId, edition, opts), { project: opts.project ?? "PROJ-1" });
    },
    /** Ratification's commit of a case edition: the document signed, the edition ratified, the roster pinned. */
    sign(caseId, edition, { roster = null, ratified = true } = {}) {
      const e = pub.get(caseId, edition);
      if (!e) throw new Error("fixture sign: prepare first");
      e.signed = true; e.ratified = ratified;
      e.roster = roster ?? caseRolesOf(e.text);
      return e;
    },
  };
  return w;
}

const caseRolesOf = (text) => [...text.matchAll(/^ {2}- target: (\S+)\n {4}version_sha: (\S+)\n(?: {4}edition: \S+\n)? {4}role: (\S+)$/gm)]
  .map((m) => ({ bundle_id: m[1], version_sha: m[2], role: m[3] }));

export function infoMd(id, words = "first") {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", `A document: ${words}.`, ""].join("\n");
}

/** A `bio-case-document/6` case document, with the fields this module reads: `roles` ([{target, version_sha, role?}]),
 *  `findings` (else the roles' targets), `attributions` (a run is written only when given: [{observation, level,
 *  shown, chosen_at_edition}]), `tensions` (`case_tensions` rows, written when given), `sources` (case-grammar R1's
 *  rows), `materials`, `attestations` (its R12 rows), through case-grammar's own line builders; `format` (`/6` unless
 *  given) is the format it declares. */
export function caseDoc(caseId, edition, { project = "PROJ-1", roles = [], findings = null, attributions = null,
                                           tensions = null, sources = null, materials = [], attestations = [],
                                           format = "bio-case-document/6" } = {}) {
  const scalar = (v) => (v === null || v === undefined ? "null" : typeof v === "string" ? `"${v}"` : String(v));
  const fm = ["---", `format: ${format}`, `case_id: ${caseId}`, `case_edition: ${edition}`, `case_project: ${project}`,
    "case_roles:", ...roles.flatMap((r) => [`  - target: ${r.target}`, `    version_sha: ${r.version_sha}`,
      `    role: ${r.role ?? "load_bearing"}`]),
    "case_findings:", ...(findings ?? roles.map((r) => r.target)).map((f) => `  - ${f}`),
    ...(attributions ? ["observation_attributions:", ...attributions.flatMap((r) => [
      ...(r.capture ? [`  - capture: ${r.capture}`] : [`  - observation: ${r.observation}`]),
      `    level: ${r.level ?? "null"}`, `    shown: ${r.shown == null ? "null" : `"${r.shown}"`}`,
      `    chosen_at_edition: ${r.chosen_at_edition ?? "null"}`])] : []),
    ...(tensions ? [`tensions_disclosed: ${tensions.length}`, "tensions_highlighted: 0",
      ...(tensions.length ? ["case_tensions:", ...tensions.flatMap((r) => Object.entries(r)
        .map(([k, v], i) => `${i ? "   " : "  -"} ${k}: ${scalar(v)}`))] : ["case_tensions: []"])] : []),
    ...(sources ? sourceBlockLines(sources) : []),
    "method:", "  grading: grading/1", '  checks: "1.0.0"',
    ...materialsLines(materials), ...materialAttestationLines(attestations),
    "---"];
  const body = ["", "## Scope", "", "The question.", "",
    ...(attributions ? ["## Whose Words These Are", "", "old words", ""] : []),
    "## What This Excludes", "", "Nothing else.", ""];
  return [...fm, ...body].join("\n");
}
