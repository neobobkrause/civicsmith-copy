/* inquiry over the modules it uses, each the real one (record-core, membership, promotion, provenance, content,
   extraction, entities, connections), on a real SQLite database (node:sqlite) standing in for a Durable
   Object's storage. What later modules register with it (publication's facts `caseMember` and `publishedRegistry`,
   reevaluation's `onRaised`, strength's `onGrounded`) are stand-ins the test controls; retrieval's selections are the real ones (`select` makes them through `selectionCreate`). Every
   test drives `inquiry` at its interface. */
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
import { retrievalOf, observationOf } from "../../../src/retrieval/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { biasOf } from "../../../src/bias/index.mjs";
import { inquiryOf, inquiryFindings } from "../../../src/inquiry/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { captureOf } from "../../../src/capture/index.mjs";

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

/* The column the store's additive list still creates on record-core's `bundles`, where this module wrote the subject
   entity until T19 (R40; since then it is written to this module's own table, and the column is inert). A store
   written before T18 also held the leg count and the superseded-by index there (`legacyColumns`, R36's move). */
const BUNDLE_COLUMNS = ["inquiry_subject_entity TEXT"];
export const LEGACY_BUNDLE_COLUMNS = ["inquiry_basis_count INTEGER", "inquiry_superseded_by TEXT"];
/* The strength columns as they stood on `bundles` before strength moved them to `strength_cache` (its R23; legacy-store
   added them). No strength module is registered here, so the real retrieval's search reads them where they stand. */
const STRENGTH_COLUMNS = ["inquiry_capture_strength TEXT", "inquiry_capture_state TEXT", "inquiry_connection_strength TEXT",
                          "inquiry_connection_state TEXT"];

/** `calculations`: a stand-in for calculations' status read (R11, its R31). `capture`: the real capture module (R58).
 *  `realRetrieval`: the real retrieval module over the same storage (its selections, its projection's decorations,
 *  its search), instead of the stand-in whose selections the test controls. `legacyColumns`: `bundles` as a store
 *  written before T18 holds it (R36's move). `bias`: the real bias module over the same storage, migrated, with this
 *  module's findings registered with it as `plane` registers them (R53, `inquiryFindings`). `view`: the active
 *  jurisdiction view the dated waits read their time zone from (R55, R57), a function; absent, the record's own. */
export function world({ caseMembers = new Set(), published = null, group = "test-group", realRetrieval = false,
                        legacyColumns = false, bias: withBias = false, view = undefined, standards: withStandards = false,
                        duties = undefined, calculations = undefined, capture: withCapture = false } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  for (const c of [...BUNDLE_COLUMNS, ...(legacyColumns ? LEGACY_BUNDLE_COLUMNS : []), ...STRENGTH_COLUMNS])
    st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  const groupRef = { value: group };
  promotion.registerFact("producingGroup", "instance-setup", () => groupRef.value);
  promotion.registerFact("caseMember", "publication", (id) => caseMembers.has(id));
  promotion.registerFact("publishedRegistry", "publication", () => published);
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  const extraction = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  extraction.migrate();
  extraction.joinPromotion(promotion);   /* a document's reading (and its text chain) lands through the promotion, R20 */
  const content = contentOf(host, { record, membership, provenance: prov, extraction, now: () => clock.now });
  content.migrate();
  const capture = {};   /* connections' link projection is not driven here */
  const entities = entitiesOf(host, { record, membership, provenance: prov, now: () => clock.now });
  entities.migrate();
  const connections = connectionsOf(host, { record, membership, promotion, content, extraction, capture, entities });
  connections.migrate();
  /* R20: the selection is retrieval's own, the real one (K4990); `select(name, members)` makes it through `selectionCreate` and
     the test keeps asking by `name`, which is mapped to the handle the real code minted */
  const selections = new Map();
  const log = observationLogOf(host, { record, membership, provenance: prov, extraction });
  log.migrate();
  const real = retrievalOf(host, { record, membership, promotion, extraction, observation: observationOf(log, st.sql), now: () => Date.parse(clock.now) });
  const retrieval = new Proxy(real, { get: (t, p) => (p === "selectionResolve"
    ? (args) => t.selectionResolve({ ...args, handle: selections.get(args?.handle) ?? args?.handle })
    : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  retrieval.migrate();
  const bias = withBias ? biasOf(host, { record, membership, promotion, entities: null }) : null;
  if (bias) bias.migrate();
  /* R11: the real standards module on the same host, over the test profile (its R1's cite recognition), with no events */
  let standards = null;
  if (withStandards) {
    record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
    standards = standardsOf(host, { record, membership, promotion, content, events: () => null, now: () => clock.now });
  }
  /* R58: the real capture module on the same host (its R79, R81, R84), which a test drives through its own acts */
  const held = withCapture ? captureOf(host, { record, provenance: prov }) : null;
  if (held) held.migrate();
  const k = inquiryOf(host, { record, membership, promotion, content, connections, entities, retrieval, provenance: prov,
                              now: () => clock.now, ...(view !== undefined ? { view } : {}),
                              ...(calculations !== undefined ? { calculations } : {}), ...(held ? { capture: held } : {}),
                              ...(standards ? { standards } : {}), ...(duties !== undefined ? { duties } : {}) });
  k.migrate();
  if (bias) bias.registerWorkProducts("finding", inquiryFindings(host, bias));
  const raisedCalls = [];
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, bias, standards, held, extraction, content, entities, connections, retrieval, k, clock, selections, raisedCalls,
    caseMembers, groupRef,
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    /** An information bundle registering one capture per text, fetched directly from an address. `chain`, when given
     *  (a text-source chain, null for a reading with none, or a function of the capture's index answering either or
     *  undefined for no reading), gives each capture a reading carrying it, which extraction projects through the
     *  promotion (its R19, R20). */
    doc(id, texts = ["the text of " + id], { via = "direct", chain = undefined } = {}) {
      const caps = texts.map((t, i) => ({ path: `snapshots/c${i}.txt`, text: t, sha: sha(t) }));
      const files = [{ path: "bundle.md", text: infoMd(id) }];
      for (const c of caps) files.push({ path: c.path, text: c.text });
      const readingOf = (i) => {
        const ch = typeof chain === "function" ? chain(i) : chain;
        return ch === undefined ? null
          : { content_type: "meeting_calendar", reader_version: 1, found: false, at: "2026-09-27T00:00:00Z",
              entities: [], facts: {}, ...(ch === null ? {} : { text_source: ch }) };
      };
      files.push({ path: "data/provenance.json", text: JSON.stringify({ documents: caps.map((c, i) =>
        (readingOf(i) ? { ...provDoc(c), reading: readingOf(i) } : provDoc(c))) }, null, 2) });
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: "member:alice", files,
        meta: { object_type: "information" },
        register: caps.map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
      if (!r.ok) throw new Error(`fixture doc refused: ${JSON.stringify(r).slice(0, 400)}`);
      if (via) for (const c of caps)
        prov.recordReceipt({ address: `https://example.org/${id}/${c.path}`, addressNorm: `example.org/${id}/${c.path}`,
                             captureSha: c.sha, retrieved: "2026-09-27T00:00:00Z", via });
      return caps.map((c) => c.sha);
    },
    /** An inquiry, created through promotion (so inquiry's check and projection run). */
    inquiry(id, opts = {}) {
      const r = w.promote(id, inquiryMd(id, opts), null, opts.pkg);
      if (!r.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(r).slice(0, 600)}`);
      return r;
    },
    /** A promotion of `text` as `id`'s bundle.md over its head (or a creation). */
    promote(id, text, base = undefined, extra = {}) {
      const head = record.head(id);
      const b = base === undefined ? (head ? head.bundleSha : null) : base;
      return promotion.promote({ bundleId: id, base: b, snapKey: `k${++n}`, author: "member:alice",
        files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" }, ...(extra || {}) });
    },
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    project(title, owner, cites = []) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: `member:${owner}`, ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    entity(id, label = id) { st.sql.exec(`INSERT OR IGNORE INTO entities (entity_id, kind, label, at) VALUES (?, 'body', ?, ?)`, id, label, clock.now); },
    resolve(capSha, bundleId, ref, entityId, grade) {
      st.sql.exec(`INSERT OR REPLACE INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method, established, at)
                   VALUES (?, ?, ?, ?, ?, 'test', ?, ?)`, capSha, bundleId, ref, entityId, grade,
                  grade === "A" || grade === "B" ? 1 : 0, clock.now);
    },
    listen() {
      k.onRaised("reevaluation", (a) => { raisedCalls.push(a); return [{ bundle_id: "DEP", ord: 0, target: a.target }]; });
    },
    /** R11: a standard declared by `by` over a document-extent passage of a fresh document, with `fields` over these. */
    standard(fields = {}, by = "member:bob") {
      const id = `INFO-2026-${String(9000 + ++n)}-law`;
      const [cap] = w.doc(id, [`the text of the bylaw ${n}`]);
      const m = content.mint({ bundleId: id, captureSha: cap, extent: { kind: "document" }, mintedBy: by });
      if (!m.ok) throw new Error(`fixture mint refused: ${JSON.stringify(m).slice(0, 300)}`);
      const r = standards.standardDeclare({ cite: "PEBL § 12", kind: "ordinance", issuer: "Port Ellery Selectboard",
        reason: "The group holds the selectboard to its own bylaw.", text: [m.content_id],
        period: { from: "2020-01-01", to: "2030-12-31" }, author: by, viewer: by,
        ...(typeof fields === "function" ? fields(m.content_id) : fields) });
      if (!r.ok) throw new Error(`fixture standard refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.id;
    },
    /** A real selection named `name`: an enumeration of `members` (visible to the admin, owner "o"), or, for none, a query that
     *  matches nothing (an empty enumeration is not one retrieval makes). With `moved`, the first member is then revised, so the
     *  set has moved since it was selected (retrieval R20). */
    select(name, members, { moved = false } = {}) {
      let made = null;
      void retrieval.selectionCreate(members.length ? { owner: "o", viewer: "admin", ids: members }
                                                    : { owner: "o", viewer: "admin", q: "no-bundle-reads-this-words-7f3a" })
        .then((r) => { made = r; });
      const row = st.sql.exec(`SELECT handle FROM selections WHERE owner='o' ORDER BY created DESC, rowid DESC LIMIT 1`)[0];
      selections.set(name, row.handle);
      if (moved) w.promote(members[0], `${w.text(members[0])}\nAfter the selection, a note.\n`);
    },
    fm: (id) => parseFm(w.text(id)),
  };
  return w;
}

import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
const parseFm = (t) => (t ? parseFrontmatter(t).data : null);

/** An inquiry document. `legs`: [{target, role?, grade?, grade_axis?, grade_source?, ground?, author?, date?, note?,
 *  content_id?}]; `refs` defaults to a confirmed `cites` entry per leg target. */
export function inquiryMd(id, { question = `Is ${id} answered?`, legs = [], refs = null, state = "open",
                               prior = "null", extra = [], grounds = null, subject = null, history = "[]",
                               disposition = '""', body = [] } = {}) {
  const references = refs ?? [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites" }));
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${question}"`,
    `current_state: ${state}`, `prior_state: ${prior}`, `created: "2026-09-27T00:00:00Z"`,
    `last_updated: "2026-09-27T00:00:00Z"`, "group: test-group",
    ...(references.length
      ? ["references:", ...references.flatMap((r) => [`  - target: ${r.target}`, `    rel: ${r.rel || "cites"}`,
          `    status: ${r.status || "confirmed"}`, ...(r.reason ? [`    reason: "${r.reason}"`] : [])])]
      : ["references: []"]),
    ...(history === "[]" ? ["state_history: []"] : ["state_history:", ...history]),
    "surfaced_by: human", `disposition_reason: ${disposition}`,
    ...(subject ? [`subject_entity: ${subject}`] : []),
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role || "supports"}`,
      ...(l.grade ? [`    grade: ${l.grade}`] : []), ...(l.grade_axis ? [`    grade_axis: ${l.grade_axis}`] : []),
      ...(l.grade_source ? [`    grade_source: ${l.grade_source}`] : []), ...(l.ground ? [`    ground: ${l.ground}`] : []),
      ...(l.author ? [`    author: ${l.author}`] : []), ...(l.date ? [`    date: ${l.date}`] : []),
      ...(l.content_id ? [`    content_id: ${l.content_id}`] : []), ...(l.note ? [`    note: "${l.note}"`] : [])])] : []),
    ...(grounds ? ["grounds:", ...grounds.flatMap((g) => [`  - ground: ${g.ground}`, `    asserted_by: ${g.asserted_by}`,
      `    at: "${g.at}"`])] : []),
    ...extra,
    "---", "", "## Question", "", question, "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", ...body, "## Review Notes", ""].join("\n");
}

export function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

export function projMd(title, cites = []) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          ...(cites.length ? ["references:", ...cites.flatMap((c) => [`  - target: ${c.target || c}`, "    rel: cites",
            `    status: ${c.status || "confirmed"}`])] : ["references: []"]),
          "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
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
