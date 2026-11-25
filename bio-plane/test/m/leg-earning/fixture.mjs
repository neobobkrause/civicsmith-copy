/* leg-earning over the modules it uses, each the real one (record-core, membership, promotion, provenance, content,
   extraction, entities, connections), on a real SQLite database (node:sqlite) standing in for a Durable Object's
   storage. What a later module registers (publication's fact `caseMember`) is a stand-in the test controls. An inquiry
   is created through promotion, and its legs are written by this module's one write (`writeBasis`, R12) as `inquiry`'s
   projection writes them (inquiry is a later module, P4). Every test drives `leg-earning` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf, legContentId } from "../../../src/content/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { legEarningOf } from "../../../src/leg-earning/index.mjs";

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

export function world({ caseMembers = new Set(), group = "test-group", caseFact = true } = {}) {
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
  if (caseFact) promotion.registerFact("caseMember", "publication", (id) => caseMembers.has(id));
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
  const k = legEarningOf(host, { record, membership, promotion, content, connections, entities, provenance: prov,
                                 now: () => clock.now });
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, extraction, content, entities, connections, k, clock, caseMembers, groupRef,
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
    /** An inquiry, created through promotion, its legs written by R12's one write as inquiry's projection writes them
     *  (`legs(id)`). */
    inquiry(id, opts = {}) {
      const r = w.promote(id, inquiryMd(id, opts), null, opts.pkg);
      if (!r.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(r).slice(0, 600)}`);
      return { ...r, ...w.legs(id) };
    },
    /** A promotion of an inquiry document, its legs then written as `legs(id)` writes them; the promotion's answer
     *  with the legs' `content`. */
    promoteInquiry(id, text) {
      const r = w.promote(id, text);
      return r.ok ? { ...r, ...w.legs(id) } : r;
    },
    /** The legs of `id`'s current document written through R12's one write, as inquiry's projection (inquiry R12)
     *  writes them: each document leg's content row the one it names, else minted through content over the capture
     *  content's plan resolves, else none (R3's backfill reads it later). Answers `{content}` as the projection lists
     *  what it named or minted. */
    legs(id) {
      const fm = parseFm(w.text(id)) || {};
      const legs = Array.isArray(fm.basis) ? fm.basis.filter((l) => l && typeof l === "object") : [];
      const plan = content.citationPlan(legs);
      const projected = [];
      const rows = legs.map((leg, i) => {
        let cid = null;
        const cp = plan.get(i);
        if (cp && cp.isInfo) {
          cid = legContentId(leg);
          if (!cid && cp.captureSha) {
            const m = content.mint({ bundleId: leg.target, captureSha: cp.captureSha, extent: cp.extent, ctx: cp.ctx });
            if (m.ok) cid = m.content_id;
          }
          if (cid) projected.push({ ord: i, target: leg.target, content_id: cid });
        }
        return { ...leg, ord: i, at: leg.date ?? null, content_id: cid };
      });
      const wrote = k.writeBasis(id, rows);
      if (!wrote.ok) throw new Error(`fixture basis refused: ${JSON.stringify(wrote)}`);
      return projected.length ? { content: projected } : {};
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
      ...(l.content_id ? [`    content_id: ${l.content_id}`] : []), ...(l.note ? [`    note: "${l.note}"`] : []),
      ...(l.status ? [`    status: ${l.status}`] : [])])] : []),
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
