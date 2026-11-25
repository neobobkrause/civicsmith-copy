/* connections over the modules it uses, each the real one (record-core, membership, promotion, provenance, content,
   extraction, capture), on a real SQLite database (node:sqlite) standing in for a Durable Object's storage at its shape (a cursor, K316). What
   `entities` would write (its `entities` and `resolutions` tables, a read contract here) and what extraction's reader
   would write (`reading_refs`) are rows the test inserts, as those modules' writers would; extraction's
   `pdfStructure` is a provider the test controls (R49). Every test drives `connections` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { readingSourceJson, readingOccurrenceKey } from "../../../src/textchain.mjs";
import { normalizeAddress } from "../../../src/subresources.mjs";
import { unheldStructure } from "../extraction/fixtures.mjs";

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` or `.length` of it is undefined. It also refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB
   pattern too complex"), which node:sqlite does not (K313). This storage answers as workerd does, so code that indexes
   a cursor or writes a long pattern fails here as it would in the Durable Object (K316; content's fixture's). */
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

/** A text layer's chain, unscoped (content's fixture's). */
export const LAYER = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: null, calibration: null }];

export const V = (id) => `member:${id}`;
export const MACHINE = "class:daemon";

export function world({ now = "2026-09-27T03:00:00.000Z", env = {} } = {}) {
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
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  promotion.registerFact("caseMember", "publication", () => false);
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  const realEx = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  realEx.migrate();
  const structures = {};
  const readingListeners = [];
  const extraction = {
    onReading: (module, fn) => { readingListeners.push({ module, fn }); return { ok: true }; },
    pdfStructure: async ({ sha: s }) => (structures[s] ? { status: 200, body: structures[s] } : unheldStructure({ sha: s })),
  };
  const content = contentOf(host, { record, membership, provenance: prov,
    extraction: { readingOf: () => null, unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [],
                  onReading: () => ({ ok: true }) }, now: () => clock.now });
  content.migrate();
  const capture = captureOf(host, { record, governor: {}, provenance: prov });
  capture.migrate();
  const entities = entitiesOf(host, { record, membership, provenance: prov, now: () => clock.now });
  entities.migrate();
  const k = connectionsOf(host, { record, membership, promotion, content, extraction, capture, entities, env, now: () => clock.now });
  k.migrate();
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, content, capture, entities, k, clock, structures, readingListeners,
    row: (q, ...a) => st.sql.exec(q, ...a).toArray()[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a).toArray(),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    snapshot(tables) {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        if (!tables || tables.includes(name)) out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM ${name}`).toArray());
      return out;
    },
    /** An information bundle registering one capture per text, with the address it was fetched from. */
    doc(id, texts = [], { references = [], locators = [] } = {}) {
      const caps = texts.map((t, i) => ({ path: `snapshots/c${i}.txt`, text: t, sha: sha(t) }));
      const files = [{ path: "bundle.md", text: infoMd(id, references) }];
      for (const c of caps) files.push({ path: c.path, text: c.text });
      files.push({ path: "data/provenance.json", text: JSON.stringify({ documents: caps.map((c, i) => provDoc(c, locators[i])) }, null, 2) });
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: "member:alice", files,
        meta: { object_type: "information" },
        register: caps.map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
      if (!r.ok) throw new Error(`fixture promote refused: ${JSON.stringify(r).slice(0, 400)}`);
      return caps.map((c) => c.sha);
    },
    /** A revision of a held bundle's bundle.md (its references), every other file carried. */
    revise(id, references) {
      const head = record.head(id);
      const files = [{ path: "bundle.md", text: infoMd(id, references) }];
      for (const p of record.livePaths(id)) if (p !== "bundle.md") {
        const f = record.readFile(id, p);
        files.push(f.text != null ? { path: p, text: f.text } : { path: p, blobSha: f.blobSha, bytes: f.bytes });
      }
      const r = promotion.promote({ bundleId: id, base: head.bundleSha, snapKey: `k${++n}`, author: "member:alice", files,
                                    meta: { object_type: "information" } });
      if (!r.ok) throw new Error(`fixture revise refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    },
    /** A project bundle, owned by `owner` (a member id), with a document of its own inside. */
    project(title, owner) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: `member:${owner}`, ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`,
                  id, `Cover ${id}`, `h_${id}`, role);
    },
    entity(id, label = id) { st.sql.exec(`INSERT OR IGNORE INTO entities (entity_id, kind, label, at) VALUES (?, 'body', ?, ?)`, id, label, clock.now); },
    /** A resolution, as entities writes it. */
    resolve(capSha, bundleId, ref, entityId, grade) {
      st.sql.exec(`INSERT OR REPLACE INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method, established, at)
                   VALUES (?, ?, ?, ?, ?, 'test', ?, ?)`, capSha, bundleId, ref, entityId, grade,
                  grade === "A" || grade === "B" ? 1 : 0, clock.now);
    },
    /** A reference read at `pages` (null for unplaced), as extraction's reader writes it. */
    read(capSha, bundleId, ref, pages = [null]) {
      pages.forEach((p, seq) => {
        const pos = p == null ? null : { kind: "pdf-page", page: p, ref: `page ${p + 1}` };
        st.sql.exec(`INSERT OR REPLACE INTO reading_refs (capture_sha, bundle_id, ref, pos_kind, pos, pos_ref, occurrence, seq)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, capSha, bundleId, ref, pos ? pos.kind : null,
                    pos ? readingSourceJson(pos) : null, pos ? pos.ref : null, readingOccurrenceKey(pos), seq);
      });
    },
    /** A content row over a capture (content's own mint). */
    mint(bundleId, capSha, extent) {
      const r = content.mint({ bundleId, captureSha: capSha, extent, mintedBy: "member:alice", at: clock.now,
        context: { chain: LAYER, pageCount: 1000, container: null } });
      if (!r.ok) throw new Error(`fixture mint refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r.content_id;
    },
    /** A receipt: the capture was fetched from `address` at `at`. */
    receipt(address, capSha, at = "2026-09-26T00:00:00Z", via = "direct") {
      prov.recordReceipt({ address, addressNorm: normalizeAddress(address), captureSha: capSha, retrieved: at, via });
    },
    /** The links capture recorded in a source capture (deferred until resolved). */
    links(sourceCapture, sourceBundle, addresses, capturedAt = "2026-09-26T12:00:00Z") {
      return capture.recordLinks({ sourceCapture, sourceBundle, capturedAt,
        links: addresses.map((a) => ({ address: a, address_norm: normalizeAddress(a), type: "deferred" })) });
    },
    settle: () => new Promise((r) => setImmediate(r)),
  };
  return w;
}

export function infoMd(id, references = []) {
  const refs = references.length
    ? ["references:", ...references.flatMap((r) => [`  - rel: ${r.rel || "cites"}`, `    target: ${r.target}`,
        `    status: ${r.status || "confirmed"}`, `    note: "${r.note || ""}"`])]
    : ["references: []"];
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, ...refs, "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

export function projMd(title) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
}

export function provDoc(c, locator) {
  return {
    file: c.path, locator: locator || `https://example.org/${c.path}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: c.sha, encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
  };
}
