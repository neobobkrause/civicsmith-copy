/* reevaluation over the modules it uses, each the real one (record-core, membership, promotion, provenance, content,
   entities, connections, inquiry, basis-versions, strength, contradiction, sources), on a real SQLite database (node:sqlite)
   standing in for a Durable Object's storage. What a later module registers (publication's facts `caseMember` and
   `publishedRegistry`, its R7), the readings content reads through extraction (its R30 `readingOf`, R36 `unitsOf`), retrieval's
   selections, ai-runs' run gate (contradiction R21) and the doorbell's pulled knocks (`pulledKnocksOf`, its R18, the one read
   `sources` makes of it) are stand-ins the test controls. Every test drives
   `reevaluation` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf, canonicalExtent } from "../../../src/content/index.mjs";
import { connectionsOf } from "../../../src/connections/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { contradictionOf, inquiryServices } from "../../../src/contradiction/index.mjs";
import { sourcesOf } from "../../../src/sources/index.mjs";
import { reevaluationOf } from "../../../src/reevaluation/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { calculationsOf } from "../../../src/calculations/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { standardsEmptyReads } from "../standards/fixtures.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

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
/** A text layer's chain, unscoped. */
export const LAYER = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: null, calibration: null }];
/** A text unit of one page, as extraction's index holds it. */
export const U = (page, text, truncated = false) =>
  ({ extent: canonicalExtent({ kind: "pdf-page", page }), ref: `page ${page + 1}`, text, truncated });

/* The columns inquiry writes on record-core's `bundles` (its R40), which the plane's store (`src/plane/store.mjs`) adds
   today. */
const BUNDLE_COLUMNS = ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"];

/* The columns of extraction's four tables that inquiry, content, entities, connections and basis-versions join. */
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

/** R34, R35, R36: what events, calculations and standards answer when a test does not build the real one: no event
 *  is aliased or read, and no standard is held. Each registration is kept so a test can see it was made. */
export function quietUpstreams() {
  const reg = { events: [], calculations: [] };
  return {
    reg,
    events: { onEventChanged: (m, fn) => (reg.events.push({ m, fn }), { ok: true }), eventForAct: () => ({ ok: true, found: false }),
              readEvent: () => ({ ok: true, found: false }) },
    calculations: { onInputChanged: (m, fn) => (reg.calculations.push({ m, fn }), { ok: true }) },
    standards: (({ standardsAt, standardsWithPortion, addressesOf }) =>
      ({ standardsAt: () => standardsAt, standardsWithPortion: () => standardsWithPortion, addressesOf: () => addressesOf }))(standardsEmptyReads()),
  };
}

/** R34–R36: the real events, calculations and standards, built over the fixture's host (a `world({upstreams})`
 *  argument): events over the test profile (its zone, read from the instance's active profiles), reading no captures (a test attests by testimony); standards over the
 *  test profile (its instrument keys); calculations with no money, duties or people registered (a test lays a held
 *  calculation down and tells it through `moneyChanged`, calculations R11). Each is built before reevaluation, so its
 *  factory's registrations land on them. */
export function realUpstreams(h) {
  h.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
  const events = eventsOf(h.host, { record: h.record, membership: h.membership, provenance: h.prov, content: h.content,
                                    entities: h.entities, extraction: {}, now: () => h.clock.now });
  events.migrate();
  const standards = standardsOf(h.host, { record: h.record, membership: h.membership, promotion: h.promotion,
                                          content: h.content, events: () => events, now: () => h.clock.now });
  const calculations = calculationsOf(h.host, { record: h.record, membership: h.membership, content: h.content,
                                                provenance: h.prov, now: () => h.clock.now });
  return { events, standards, calculations };
}

export function world({ caseMembers = new Set(), group = "test-group", earnedOverride = null, upstreams = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  for (const c of BUNDLE_COLUMNS) st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  const published = { value: {} };
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  promotion.registerFact("caseMember", "publication", (id) => caseMembers.has(id));
  promotion.registerFact("publishedRegistry", "publication", (id, targets) => {
    const out = {};
    for (const t of [id, ...(targets || [])]) if (t && published.value[t]) out[t] = published.value[t];
    return out;
  });
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  /* extraction's tables, as far as the modules below join them (reevaluation does not use extraction); what each
     reading holds is the stand-in below. */
  for (const t of EXTRACTION_JOINED) st.db.exec(t);
  const ex = readings();
  const content = contentOf(host, { record, membership, provenance: prov, extraction: ex.provider, now: () => clock.now });
  content.migrate();
  /* entities is the one connections reaches on this host (reevaluation does not use it directly). */
  const connections = connectionsOf(host, { record, membership, promotion, content, extraction: ex.provider, capture: {} });
  const entities = connections.entities;
  entities.migrate();
  connections.migrate();
  const selections = new Map();
  const retrieval = {
    selectionResolve: ({ handle }) => {
      const s = selections.get(handle);
      return s ? { ok: true, members: s, drift: null } : noSelection({ handle }).answer;
    },
  };
  const k = inquiryOf(host, { record, membership, promotion, content, connections, entities, retrieval, provenance: prov,
                              now: () => clock.now });
  k.migrate();
  const basisVersions = basisVersionsOf(host, { record, membership, promotion, content,
    inquiry: { earned: (s, t) => k.earned(s, t), legCapped, cyclePath: (id, t) => k.cyclePath(id, t) },
    now: () => clock.now });
  basisVersions.migrate();
  const strength = strengthOf(host, { record, membership,
    inquiry: { basisFor: (id, o) => k.basisFor(id, o), earned: (e, t) => k.earned(e, t), legCapped,
               subjectEntityOf: (id) => k.subjectEntityOf(id) },
    versions: basisVersions, producingGroup: () => group, now: () => clock.now });
  /* contradiction (R27), the real one; its run gate answers every run as running, the caller its principal. */
  const c = contradictionOf(host, { record, extraction: ex.provider, membership, promotion, entities, basisVersions,
                                    inquiry: inquiryServices(host), now: () => clock.now });
  c.migrate();
  c.registerRunGate("test", () => ({ found: true, running: true, refusal: null }));
  /* inquiry as this module reads it; a test may bound what the record earns (R5). */
  const inquiry = new Proxy(k, { get: (t, p) => (p === "earned" && earnedOverride
    ? earnedOverride : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  /* sources (R28), the real one; the knocks the doorbell pulled are the stand-in `knocks` (capture sha -> knock rows). */
  const knocks = new Map();
  const sources = sourcesOf(host, { record, membership, doorbell: { pulledKnocksOf: (s) => knocks.get(s) || [] },
                                    now: () => Date.parse(clock.now) });
  /* events, calculations and standards (R34–R36): quiet stand-ins unless a test passes its own, built over this host */
  const quiet = quietUpstreams();
  const up = typeof upstreams === "function" ? upstreams({ host, record, membership, promotion, content, prov, entities, clock }) : {};
  const r = reevaluationOf(host, { record, membership, promotion, inquiry, content, provenance: prov, strength,
                                   basisVersions, contradiction: c, sources, now: () => clock.now,
                                   events: up.events ?? quiet.events, calculations: up.calculations ?? quiet.calculations,
                                   standards: up.standards ?? quiet.standards });
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, content, entities, connections, k, basisVersions, strength, c, r,
    clock, ex, selections, caseMembers, published, sources, knocks, quiet, up,
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM "${name}"`));
      return out;
    },
    cap: (name, text = `bytes of ${name}`) => ({ path: `snapshots/${name}.txt`, text, sha: sha(text) }),
    /** An information bundle holding `captures` (default: one of its own), registered in that order. `extra` lines
     *  join its front matter. */
    doc(id, captures = null, { extra = [], files: more = [], body = "A document." } = {}) {
      const caps = captures || [w.cap(`${id}-0`, `the text of ${id}`)];
      const files = [{ path: "bundle.md", text: infoMd(id, extra, body) }, ...more];
      for (const c of caps) files.push({ path: c.path, text: c.text });
      files.push({ path: "data/provenance.json", text: JSON.stringify({ documents: caps.map((c) => provDoc(c)) }, null, 2) });
      const res = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: "member:alice", files,
        meta: { object_type: "information" },
        register: caps.map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
      if (!res.ok) throw new Error(`fixture doc refused: ${JSON.stringify(res).slice(0, 400)}`);
      return caps;
    },
    /** A document's revision (its bundle.md with `extra` front-matter lines). */
    redoc(id, extra = [], files = []) {
      const res = promotion.promote({ bundleId: id, base: record.head(id).bundleSha, snapKey: `k${++n}`,
        author: "member:alice", files: [{ path: "bundle.md", text: infoMd(id, extra) }, ...files],
        meta: { object_type: "information" }, replay: true });
      if (!res.ok) throw new Error(`fixture redoc refused: ${JSON.stringify(res).slice(0, 400)}`);
      return res;
    },
    /** A capture read, with its text units; and retrieved from `address` at `at`. */
    read(capSha, units = null, { pageCount = 3, state = "whole" } = {}) {
      ex.readings[capSha] = { chain: LAYER, pageCount };
      if (units) ex.units[capSha] = { units: units.map((u, i) => ({ extent: u.extent, ref: u.ref ?? `u${i}`, text: u.text,
                                                                      truncated: !!u.truncated })), state };
    },
    at(capSha, address, retrieved) {
      prov.recordReceipt({ address: `https://${address}`, addressNorm: address, captureSha: capSha, retrieved });
    },
    /** A passage of a capture, minted as content. */
    passage(bundleId, capSha, extent = { kind: "pdf-page", page: 1 }) {
      const m = content.mint({ bundleId, captureSha: capSha, extent, mintedBy: V("bo") });
      if (!m.ok) throw new Error(`fixture passage refused: ${JSON.stringify(m).slice(0, 300)}`);
      return m.content_id;
    },
    /** An inquiry, created through promotion (so inquiry's check and projection run). */
    inquiry(id, opts = {}) {
      const res = w.promote(id, inquiryMd(id, opts));
      if (!res.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(res).slice(0, 600)}`);
      return res;
    },
    promote(id, text) {
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: "member:alice", files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
    },
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = w.text(id); return t ? parseFrontmatter(t).data : null; },
    project(title, owner, cites = []) {
      const res = promotion.promote({ base: null, snapKey: `k${++n}`, author: `member:${owner}`, ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites) }], meta: { object_type: "project" } });
      if (!res.ok) throw new Error(`fixture project refused: ${JSON.stringify(res).slice(0, 400)}`);
      return res.bundleId;
    },
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    /** contradiction's pairing and a run's proposal (its R8, R13): the first pair `key` forms, proposed with `label`;
     *  answers the candidate id. */
    candidate(key, label = "record", index = 0) {
      const p = c.pairs({ key, viewer: "class:admin" }).pairs[index];
      if (!p) throw new Error(`no ${key} pair formed`);
      const res = c.propose({ run: "RUN-2026-0001", proposedBy: "class:ai/tok1", viewer: "class:admin", caller: "member:alice",
                              proposals: [{ key, a: p.a, b: p.b, label, reason: "the machine's reason" }] });
      if (!res.ok) throw new Error(`propose refused: ${JSON.stringify(res).slice(0, 300)}`);
      return res.candidates[0].candidate;
    },
    /** A member names one side of a candidate wrong (contradiction R33): that side is marked stale (its R27). */
    wrong(candidate, side = "a", reason = "misread the table", author = "member:alice") {
      const res = c.clarify({ candidate, choice: "one_wrong", wrongSide: side, reason, viewer: "class:admin", author });
      if (!res.ok) throw new Error(`one_wrong refused: ${JSON.stringify(res).slice(0, 300)}`);
      return res;
    },
    /** An accepted version of an inquiry carrying a claim, laid down with the columns basis-versions' read contract
     *  names (its R38), and the inquiry's subject entity (inquiry R40's `inquiry_bundle_facts` column, N136). */
    claim(inquiryId, name, claim, subject = null) {
      const ord = st.sql.exec(`SELECT COUNT(*) AS n FROM inquiry_basis_versions WHERE bundle_id=?`, inquiryId)[0].n;
      st.sql.exec(`INSERT INTO inquiry_basis_versions (bundle_id, name, ord, description, relationship, state, hidden, claim, composition)
                   VALUES (?, ?, ?, 'd', 'and', 'accepted', 0, ?, 'c')`, inquiryId, name, ord, claim);
      if (subject) st.sql.exec(`INSERT INTO inquiry_bundle_facts (bundle_id, inquiry_subject_entity) VALUES (?, ?)
                                ON CONFLICT(bundle_id) DO UPDATE SET inquiry_subject_entity = excluded.inquiry_subject_entity`,
                               inquiryId, subject);
    },
    /** A knock pulled into capture `capSha` (doorbell R13), and its source read by a member (sources R1): the source id. */
    knocked(capSha, { pseudonym = null, knockId = `K-${capSha.slice(0, 8)}-${++n}` } = {}) {
      if (!st.sql.exec(`SELECT 1 AS x FROM members WHERE member_id='bob'`).length) w.member("bob");
      const list = knocks.get(capSha) || [];
      list.push({ knock_id: knockId, sha256: capSha, bytes: 10, received: "2026-09-27T00:00:00.000Z", pseudonym,
                  knocker_digest: pseudonym ? `digest-${pseudonym}` : null });
      knocks.set(capSha, list);
      const a = sources.sourceOf({ captureSha: capSha, viewer: V("bob") });
      if (!a.ok) throw new Error(`fixture sourceOf refused: ${JSON.stringify(a).slice(0, 300)}`);
      return a.sources ? a.sources[a.sources.length - 1].sourceId : a.sourceId;
    },
    /** A disclosure about `source` by bob (sources R2): an attribute moves the rung to partly_known, a name further. */
    disclose(source, revealed = { kind: "attribute", attribute: "role", value: "clerk" }, fields = {}) {
      const e = sources.recordDisclosure({ source, revealed, how: "self", knownTo: "group", evidence: "told to bob",
                                           sight: ["bob"], by: "bob", ...fields });
      if (!e.ok) throw new Error(`fixture disclosure refused: ${JSON.stringify(e).slice(0, 300)}`);
      return e;
    },
    /** R34, R35: an inquiry resting on ids no checked leg admits today (an event, an act, a calculation), laid down by a
     *  replayed promotion, as a legacy or replayed document holds one (K1624). */
    replayed(id, legs, { updated = null } = {}) {
      const head = record.head(id);
      let text = inquiryMd(id, { legs, refs: [] });
      if (updated) text = text.replace(`last_updated: "2026-09-27T00:00:00Z"`, `last_updated: "${updated}"`);
      const res = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`, author: "member:alice",
        files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" }, replay: true });
      if (!res.ok) throw new Error(`fixture replay refused: ${JSON.stringify(res).slice(0, 400)}`);
      return res;
    },
    /** R35: a held calculation naming money fact `fact` as its input, laid down in calculations' own tables (its R4's
     *  write, without the money module this fixture does not build). */
    calculation(calcId, fact) {
      st.sql.exec(`INSERT INTO calculations (calc_id, project, question, period_json, kind, recipe_json, inputs_json, method_version,
                     result_key, results_json, computed_at, recompute_status, created_by, created_at)
                   VALUES (?, NULL, 'How much was paid?', '{}', 'total', '{}', ?, 'bio-calc/1', 'k', '{}', ?, 'current', 'member:bob', ?)`,
                   calcId, JSON.stringify([{ name: "t", money: [fact] }]), clock.now, clock.now);
      st.sql.exec(`INSERT INTO calc_inputs (calc_id, project, input_name, input_kind, ref) VALUES (?, NULL, 't', 'money', ?)`, calcId, fact);
    },
    /** A published edition of `id` in the registry the store provides (promotion's fact). */
    publish(id, edition, { capture = null, connection = null, testimony = null, at = "2026-09-27T12:00:00Z" } = {}) {
      const e = published.value[id] || (published.value[id] = { object_type: "inquiry", latest: 0, editions: {} });
      e.editions[String(edition)] = { edition, ratified_at: at, capture, connection, ...(testimony ? { testimony } : {}) };
      e.latest = Math.max(e.latest, edition);
    },
  };
  return w;
}

/** An inquiry document. `legs`: [{target, role?, grade?, grade_axis?, grade_source?, ground?, target_edition?,
 *  content_id?, note?}]; `refs` defaults to a confirmed `cites` entry per leg target. */
export function inquiryMd(id, { question = `Is ${id} answered?`, legs = [], refs = null, state = "open",
                               prior = "null", extra = [], grounds = null, disposition = '""' } = {}) {
  const references = refs ?? [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t, rel: "cites" }));
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${question}"`,
    `current_state: ${state}`, `prior_state: ${prior}`, `created: "2026-09-27T00:00:00Z"`,
    `last_updated: "2026-09-27T00:00:00Z"`, "group: test-group",
    ...(references.length
      ? ["references:", ...references.flatMap((r) => [`  - target: ${r.target}`, `    rel: ${r.rel || "cites"}`,
          `    status: ${r.status || "confirmed"}`, ...(r.reason ? [`    reason: "${r.reason}"`] : [])])]
      : ["references: []"]),
    "state_history: []", "surfaced_by: human", `disposition_reason: ${disposition}`,
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role || "supports"}`,
      ...(l.grade ? [`    grade: ${l.grade}`] : []), ...(l.grade_axis ? [`    grade_axis: ${l.grade_axis}`] : []),
      ...(l.grade_source ? [`    grade_source: ${l.grade_source}`] : []), ...(l.ground ? [`    ground: ${l.ground}`] : []),
      ...(l.target_edition != null ? [`    target_edition: ${l.target_edition}`] : []),
      ...(l.content_id ? [`    content_id: ${l.content_id}`] : []), ...(l.note ? [`    note: "${l.note}"`] : [])])] : []),
    ...(grounds ? ["grounds:", ...grounds.flatMap((g) => [`  - ground: ${g.ground}`, `    asserted_by: ${g.asserted_by}`,
      `    at: "${g.at}"`])] : []),
    ...extra,
    "---", "", "## Question", "", question, "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}

export function infoMd(id, extra = [], body = "A document.") {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          ...extra, "---", "", "## Summary", "", body, ""].join("\n");
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
