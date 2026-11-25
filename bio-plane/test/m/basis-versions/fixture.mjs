/* basis-versions over the modules it uses, each the real one (record-core, membership, promotion, provenance, content,
   connections for the `refs` edges), on a real SQLite database (node:sqlite) standing in for a Durable Object's
   storage. What `inquiry` provides (its earned registry, `legCapped`, the cycle walk, `basisFor` and its `inquiry_basis` table) is a
   provider the test controls, as `basisVersionsOf`'s `deps.inquiry` takes it; the case-member fact is the test's too.
   The readings extraction would write (`readings`, `reading_refs`) and the resolutions entities would write are rows the
   test inserts, as those modules' writers would. Every test drives `basis-versions` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { readingSourceJson, readingOccurrenceKey } from "../../../src/textchain.mjs";

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

export const LAYER = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: null, calibration: null }];
export const V = (id) => `member:${id}`;
export const MACHINE = "class:daemon";

export function world({ now = "2026-09-28T01:00:00Z", caseMemberFact = true, withRetrieval = false, acceptedWork = null,
                        bias = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  const facts = { caseMember: new Set() };
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  if (caseMemberFact) promotion.registerFact("caseMember", "publication", (id) => facts.caseMember.has(id));
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  const realEx = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  realEx.migrate();
  const readings = {};
  const content = contentOf(host, { record, membership, provenance: prov, now: () => clock.now,
    extraction: { readingOf: (s) => (readings[s] ? { reading: {}, chain: LAYER, pageCount: 50, containerExtent: undefined,
                                                   textContainer: null, captureFormat: null, ...readings[s] } : null),
                  unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [], onReading: () => ({ ok: true }) } });
  content.migrate();
  const capture = {};   /* connections' link projection is not driven here */
  const entities = entitiesOf(host, { record, membership, provenance: prov, now: () => clock.now });
  entities.migrate();
  const k = connectionsOf(host, { record, membership, promotion, content, capture, entities, now: () => clock.now,
    extraction: { onReading: () => ({ ok: true }), pdfStructure: async () => ({ status: 404, body: {} }) } });
  k.migrate();
  /* inquiry's table and services, as the test controls them */
  st.db.exec(`CREATE TABLE IF NOT EXISTS inquiry_basis (bundle_id TEXT NOT NULL, ord INTEGER NOT NULL, target_id TEXT NOT NULL)`);
  const inq = { ceilings: {}, cycles: {}, calls: [] };
  const inquiry = {
    earned: (subject, targets) => { inq.calls.push(["earned", subject, [...targets]]);
      return { earned: { capture: Object.fromEntries(targets.map((t) => [t, inq.ceilings[t] ?? null])) } }; },
    legCapped: (stated, e, id) => {
      if (!e) return null;
      if (e.grade == null) return { grade: null, why: `undetermined for ${id}` };
      return "ABCD".indexOf(stated) >= "ABCD".indexOf(e.grade) ? null : { grade: e.grade, why: `capped at ${e.grade} for ${id}` };
    },
    cyclePath: (id, targets) => { for (const t of targets) if (inq.cycles[t]) return [id, t, id]; return null; },
    /* inquiry R16's read over the table the test fills: the first `limit` legs by ord, `truncated` one past */
    basisFor: (id, { limit = null } = {}) => {
      inq.calls.push(["basisFor", id, limit]);
      const legs = st.sql.exec(`SELECT ord, target_id FROM inquiry_basis WHERE bundle_id=? ORDER BY ord`, id);
      return Number.isInteger(limit) && limit > 0
        ? { ok: true, bundleId: id, legs: legs.slice(0, limit), limit, truncated: legs.length > limit }
        : { ok: true, bundleId: id, legs };
    },
  };
  /* With `withRetrieval`, the real retrieval, handed to the factory as the plane's host hands it (R42); the observation
     log's rows are not read by the single-bundle projection, so its reader is an empty one. */
  const retrieval = withRetrieval
    ? retrievalOf(host, { record, membership, promotion, extraction: realEx, observation: {}, now: () => Date.parse(clock.now) })
    : null;
  if (retrieval) retrieval.migrate();
  /* `acceptedWork`: accepted-work's leg check (its R3) as the test controls it; absent, accepted-work's own. `bias`:
     bias's `statementInForce` (its R49, for R48) as the test controls it; absent, bias's own on this host */
  const bv = basisVersionsOf(host, { record, membership, promotion, content, inquiry, retrieval, now: () => clock.now,
                                     ...(acceptedWork ? { acceptedWork } : {}), ...(bias ? { bias } : {}) });
  bv.migrate();
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, content, k, bv, retrieval, clock, facts, inq, readings,
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    sha: (id) => record.head(id)?.bundleSha ?? null,
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    /** An information bundle registering one capture (its bytes a short text). */
    doc(id, text = `bytes of ${id}`) {
      const c = { path: "snapshots/c0.txt", text, sha: sha(text) };
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path: c.path, text: c.text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(c)] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) }] });
      if (!r.ok) throw new Error(`fixture doc refused: ${JSON.stringify(r).slice(0, 400)}`);
      readings[c.sha] = {};
      return c.sha;
    },
    /** An inquiry bundle with the given frontmatter lines (after its fixed head), promoted as a creation. */
    inquiry(id, lines = [], { author = V("alice") } = {}) {
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author,
        files: [{ path: "bundle.md", text: inqMd(id, lines) }], meta: { object_type: "inquiry" } });
      return r;
    },
    /** A revision of a held bundle's bundle.md, every other file carried. */
    revise(id, text, { author = V("alice"), type = "inquiry" } = {}) {
      const files = [{ path: "bundle.md", text }];
      for (const p of record.livePaths(id)) if (p !== "bundle.md") {
        const f = record.readFile(id, p);
        files.push(f.text != null ? { path: p, text: f.text } : { path: p, blobSha: f.blobSha, bytes: f.bytes });
      }
      return promotion.promote({ bundleId: id, base: record.head(id).bundleSha, snapKey: `k${++n}`, author, files,
                                 meta: { object_type: type } });
    },
    /** A project, owned (and so joined) by `owner`, citing `cites` (inquiry ids); `severed` ones marked so. */
    project(title, owner, cites = [], { severed = [], extra = [] } = {}) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites, severed, extra) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** A reference the reading of `capSha` found at `page`, as extraction's reader writes it. */
    readRef(capSha, bundleId, ref, page) {
      const pos = { kind: "pdf-page", page, ref: `page ${page + 1}` };
      st.sql.exec(`INSERT OR REPLACE INTO reading_refs (capture_sha, bundle_id, ref, pos_kind, pos, pos_ref, occurrence, seq)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)`, capSha, bundleId, ref, pos.kind, readingSourceJson(pos), pos.ref,
                  readingOccurrenceKey(pos));
      st.sql.exec(`INSERT OR IGNORE INTO readings (capture_sha, bundle_id, content_type, reader_version, found, entity_count, reading, at)
                   VALUES (?, ?, 'doc', '1', 1, 0, '{}', ?)`, capSha, bundleId, clock.now);
    },
  };
  return w;
}

export function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

export function inqMd(id, lines = [], { state = "open" } = {}) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
          `current_state: ${state}`, "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "surfaced_by: human", ...lines, "---", "",
          "## Question", "", "What happened?", "", "## Session Log", ""].join("\n");
}

export function projMd(title, cites = [], severed = [], extra = []) {
  const refs = [...cites.map((t) => ({ t, s: "confirmed" })), ...severed.map((t) => ({ t, s: "severed" }))];
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          ...(refs.length ? ["references:", ...refs.flatMap(({ t, s }) => [`  - rel: cites`, `    target: ${t}`,
                                                                         `    status: ${s}`, `    note: ""`])]
                          : ["references: []"]),
          "state_history: []", ...extra, "---", "", "## Objective", "", "Find out.", "", "## Session Log", ""].join("\n");
}

export function provDoc(c) {
  return {
    file: c.path, locator: `https://example.org/${c.path}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: c.sha, encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
  };
}

/** The frontmatter lines of a version block: `versions` rows, `grounds` rows, `legs` rows, each an object. */
export function block({ basis = [], versions = [], grounds = [], legs = [], refs = [] } = {}) {
  const val = (v) => (typeof v === "number" || typeof v === "boolean" ? String(v)
    : Array.isArray(v) ? `[${v.join(", ")}]` : v === null ? "null" : `"${v}"`);
  const rows = (key, list) => (list.length
    ? [`${key}:`, ...list.flatMap((o) => Object.entries(o).map(([k, v], i) => `${i ? "    " : "  - "}${k}: ${val(v)}`))]
    : []);
  return [
    ...(refs.length ? ["references:", ...refs.flatMap((t) => [`  - rel: cites`, `    target: ${t}`, `    status: confirmed`,
                                                               `    note: ""`])] : ["references: []"]),
    "state_history: []",
    ...rows("basis", basis), ...rows("basis_versions", versions), ...rows("basis_version_grounds", grounds),
    ...rows("basis_version_legs", legs)];
}

/** A well-formed one-part version over `targets`, named `name`. */
export function version(name, targets, extra = {}) {
  return {
    versions: [{ name, description: `the reading called ${name}`, relationship: "and", state: "suggested", hidden: false,
                 derived_from: null, author: "member:alice", at: "2026-09-27T00:00:00Z", ...extra }],
    grounds: targets.length ? [{ version: name, ground: "main", asserted_by: "member:alice", at: "2026-09-27T00:00:00Z" }] : [],
    legs: targets.map((t) => ({ version: name, target: t, role: "supports", ground: "main" })),
  };
}

/** Two version blocks merged. */
export function merge(...bs) {
  const out = { basis: [], versions: [], grounds: [], legs: [], refs: [] };
  for (const b of bs) for (const k of Object.keys(out)) out[k].push(...(b[k] || []));
  return out;
}
