/* standards over the modules it uses, each the real one (record-core, membership, promotion, content, and the
   provenance content builds on the same host), on a real SQLite database (node:sqlite) standing in for a Durable Object's storage. The readings
   content reads through extraction are a provider the test controls, as `contentOf`'s `deps.extraction` takes it.
   Jurisdiction profiles are the real ones: the test profile (`test-port-ellery`), and profile objects a test writes
   (never Oakland's, `layers.md` rule 3). Every test drives `standards` at its interface. Storage is at the plane's
   shape (K313, K316): `sql.exec` answers a cursor, as workerd's does, never an array, and refuses a LIKE or GLOB
   pattern over workerd's 50 bytes. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { EXTRACTION_SCHEMA } from "../../../src/extraction/schema.mjs";

export const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export const WORKERD_PATTERN_CAP = 50;

/* A cursor as workerd's `sql.exec` answers one: an iterator over the rows, read once, with `toArray()` and `one()`;
   never an array, so `[0]` or `.length` of it is undefined. */
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

/* The patterns a statement would hand LIKE or GLOB: its quoted literals, and every string it binds when it binds one. */
function patternsOf(q, args) {
  const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
  const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
  return [...literal, ...bound];
}

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      if (patternsOf(q, args).some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP))
        throw new Error("LIKE or GLOB pattern too complex");
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
  };
  /* the fixture's own reads, as arrays */
  const rows = (q, ...args) => [...sql.exec(q, ...args)];
  return {
    db, sql, rows,
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
export const NOW = "2026-09-28T01:00:00.000Z";
export const TEST_PROFILE = "test-port-ellery";
/** A citation the test profile's first source (the bylaws, `ordinance`, `city`) recognises, and one none does. */
export const BYLAW = "PEBL § 12", UNKNOWN_CITE = "Some Code § 4";
/** A declarer's reason (R1, DEC-88): every declaration and adoption in these tests sends one, except where a test proves
 *  its refusal. */
export const REASON = "The selectboard issues permits under it, so the group holds it to its own bylaw.";
const LAYER = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: null, calibration: null }];

/** A profile object of the test's own, valid under `jurisdictions.validate`, with the given standard sources. */
export function profile(id, sources) {
  return { id, name: `Profile ${id}`, covers: [`Place ${id}`], test: true, standard_sources: sources };
}
export const src = (source, re, extra = {}) => ({ source, kind: "statute", issuer: `Issuer of ${source}`, level: "state",
                                                  cite: { re }, basis: "TEST", ...extra });

/** `provenance(prov)`, when given, answers the provenance standards reads in place of content's (R38, R50: a test's
 *  wrapper over the real one). `written`: profile objects the test wrote, which the instance setting names by id; `jurisdictions.combine` (the
 *  real one) is handed the object for such an id and the id itself for a held profile. `combine` replaces it with a
 *  provider the test controls. */
export function world({ now = NOW, profiles = [TEST_PROFILE], written = [], construct = true, combine: combineWith = null,
                        events = null, keyedStore = null, citationLookup = null, provenance = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  /* extraction's `reading_refs`, under its read contract (extraction R58), which R21 reads; the fixture writes its rows */
  const refsTable = /CREATE TABLE IF NOT EXISTS reading_refs \([\s\S]*?\n\);/.exec(EXTRACTION_SCHEMA)[0].replace(/--[^\n]*/g, "");
  st.db.exec(refsTable);
  const clock = { now };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  /* the facts promotion reads from later modules, each under the module that registers it in the plane */
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  promotion.registerFact("citedBy", "connections", () => []);
  promotion.registerFact("caseMember", "publication", () => false);
  const ex = { readings: {}, units: {} };
  const extraction = {
    readingOf: (s) => (ex.readings[s] ? { reading: { page_boxes: null }, chain: LAYER, pageCount: 3, textContainer: null,
                                          captureFormat: null, ...ex.readings[s] } : null),
    unitsOf: (s) => ex.units[s] || { units: [], state: null },
    capturesReadFor: () => [],
    onReading: () => ({ ok: true }),
  };
  /* content builds provenance on the same host (standards reads it through content unless a test wraps it); the fixture reaches it there to
     migrate it and to record where a capture was retrieved from, for R5's newer capture. */
  const content = contentOf(host, { record, membership, extraction, now: () => clock.now });
  const prov = content.provenance;
  prov.migrate();
  content.migrate();
  if (profiles !== null) record.setSetting("jurisdiction_profiles", profiles, "admin");
  const byId = new Map(written.map((p) => [p.id, p]));
  /* the real events module over the same host (K1574), with no reading hook (standards reads no reading-pipeline); `events: "none"` wires none, to show what standards answers then */
  const ev = events === "none" ? null : events || eventsOf(host, { record, membership, content, extraction, provenance: prov,
                                                                   readHooks: {}, now: () => clock.now });
  if (ev && ev !== events) ev.migrate();
  /* the real entities module over the same host (R39, R35, R43: an issuer, a holder, a body) */
  const entities = entitiesOf(host, { record, membership, provenance: prov, now: () => clock.now });
  entities.migrate();
  /* R41: who captured a capture, as `capture.captureAccountsOf` answers it; the test says who (a stand-in for capture,
     whose own instance needs the host governor and attestation) */
  const actors = {};
  const capture = { captureAccountsOf: (sha) => ({ captureSha: sha, actors: (actors[sha] || []).map((actor) => ({ actor, at: "t" })),
                                                  accounts: [] }) };
  /* R16: the instance is constructed and never migrated by its caller. `construct: false` leaves it to the test. */
  const build = () => standardsOf(host, { record, membership, promotion, content, now: () => clock.now,
                                          combine: combineWith || ((ids) => combine(ids.map((id) => byId.get(id) ?? id))),
                                          events: () => ev, entities, capture, ...(keyedStore ? { keyedStore } : {}),
                                          ...(citationLookup ? { citationLookup } : {}),
                                          ...(provenance ? { provenance: provenance(prov) } : {}) });
  const s = construct ? build() : null;
  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, content, s, clock, ex, build, events: ev, entities, actors,
    /** A registered entity (R39: an issuer; R35: a discretion's holder; R43: a body): its id. */
    entity(label, { kind = "institution", sector = "government" } = {}) {
      const r = entities.createEntity({ kind, label, sector, note: `${label}, as the record names it.`, declaredBy: V("bob") });
      if (!r.ok) throw new Error(`fixture entity refused: ${JSON.stringify(r).slice(0, 300)}`);
      return r.entity_id ?? r.entity?.entity_id;
    },
    /** An inquiry's bundle (R47's question), filed in `project` when given. */
    inquiry(project = null) {
      const id = `INQ-2026-${String(++n).padStart(4, "0")}`;
      st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha,
                   project) VALUES (?, 'inquiry', 'test-group', 'Why?', 'open', 't', 't', ?, ?)`, id, sha(id), project);
      return id;
    },
    /** A held event (events R6) attested by a member's testimony, dated `value` (a day, or `{value, precision, zone}`)
     *  or undated; or, with `fencedTo`, by a dated fact of a document in a project of that member's (events R1, R7). */
    event({ value = null, kind = "meeting", by = V("bob"), fencedTo = null } = {}) {
      if (fencedTo) {
        const P = w.project(`Fence ${++n}`, fencedTo);
        const p = w.passage();
        st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, P, p.bundleId);
        const f = ev.recordDatedFact({ captureSha: p.capSha, extent: { kind: "pdf-page", page: 0 }, kind: "meeting", value,
                                       method: "a member's reading", by: V(fencedTo) });
        if (!f.ok) throw new Error(`fixture dated fact refused: ${JSON.stringify(f).slice(0, 300)}`);
        const e = ev.createEvent({ kind, attestations: [{ datedFactId: f.dated_fact.dated_fact_id }], by: V(fencedTo) });
        if (!e.ok) throw new Error(`fixture event refused: ${JSON.stringify(e).slice(0, 300)}`);
        return e.event_id;
      }
      const e = ev.createEvent({ kind, attestations: [{ testimony: "I was there.", ...(value !== null ? { value } : {}) }], by });
      if (!e.ok) throw new Error(`fixture event refused: ${JSON.stringify(e).slice(0, 300)}`);
      return e.event_id;
    },
    rows: (q, ...a) => st.rows(q, ...a),
    count: (t) => st.rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    fm: (id) => { const t = record.readFile(id, "bundle.md")?.text; return t ? parseFrontmatter(t).data : null; },
    snapshot() {
      const out = {};
      for (const { name } of st.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = st.rows(`SELECT * FROM ${name}`);
      return out;
    },
    member(id, { role = "member", status = "active" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
    },
    /** A captured document (an information bundle holding one capture), read with a text layer, and a passage of it
     *  minted as content: its content id. `project` files the document in that project instead. */
    passage(name = `doc${++n}`, { page = 0, address = null, retrieved = "2026-09-01T00:00:00Z", text: words = null } = {}) {
      const text = `bytes of ${name}`, capSha = sha(text), id = `INFO-2026-${String(++n).padStart(4, "0")}-${name}`;
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, { path: `snapshots/${name}.txt`, text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(`snapshots/${name}.txt`, capSha, text)] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: capSha, path: `snapshots/${name}.txt`, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
      if (!r.ok) throw new Error(`fixture document refused: ${JSON.stringify(r).slice(0, 400)}`);
      ex.readings[capSha] = { chain: LAYER, pageCount: 3 };
      /* the passage's words, indexed whole at its page, so `content.passageText` reads them (R19, R25) */
      if (words !== null) ex.units[capSha] = { units: [{ extent: { kind: "pdf-page", page }, text: words, seq: 0 }], state: "whole" };
      if (address) prov.recordReceipt({ address, addressNorm: address.replace(/^https?:\/\//, ""), captureSha: capSha, retrieved });
      const m = content.mint({ bundleId: id, captureSha: capSha, extent: { kind: "pdf-page", page }, mintedBy: V("alice") });
      if (!m.ok) throw new Error(`fixture mint refused: ${JSON.stringify(m).slice(0, 400)}`);
      return { contentId: m.content_id, bundleId: id, capSha };
    },
    /** A reference a reading of `capSha` (in `bundleId`) carries, under extraction's read contract (R21). */
    ref(capSha, bundleId, { ref, ref_kind = null, ref_key = null, label = null }) {
      st.sql.exec(`INSERT INTO reading_refs (capture_sha, bundle_id, ref, ref_kind, ref_key, label) VALUES (?,?,?,?,?,?)`,
                  capSha, bundleId, ref, ref_kind, ref_key, label);
    },
    /** A project owned by `owner`, through promotion. */
    project(title, owner) {
      const r = promotion.promote({ base: null, snapKey: `p${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** A standard declared by bob over a fresh passage, with the given fields over the defaults. */
    declare(fields = {}) {
      const text = fields.text ?? w.passage().contentId;
      return s.standardDeclare({ cite: BYLAW, kind: "ordinance", issuer: "Port Ellery Selectboard", reason: REASON, text,
                                 period: { from: "2020-01-01", to: "2030-12-31" }, author: V("bob"), viewer: V("bob"),
                                 ...fields });
    },
  };
  return w;
}

/** bob and carol members, alice an administrator. */
export function seeded(opts) {
  const w = world(opts);
  w.member("alice", { role: "admin" });
  w.member("bob");
  w.member("carol");
  return w;
}

function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

function provDoc(file, capSha, text) {
  return { file, locator: `https://example.org/${file}`, retrieved: "2026-09-27T00:00:00Z",
           authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
           capture: { method: "acquire", grade: "B", actor_class: "session", sha256: capSha, encoding: "utf8",
                      bytes: Buffer.byteLength(text) },
           origin: { kind: "named_request" } };
}

function projMd(title) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          `objective: "Find out."`, "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""]
    .join("\n");
}
