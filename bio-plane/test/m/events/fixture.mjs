/* events' test fixture: a Durable Object storage stand-in over node:sqlite at the plane's shape (`sql.exec` answering a
   cursor, `transactionSync` nesting as savepoints) with the real modules events uses — record-core, membership,
   extraction (the readings), provenance (the register and the capture grade), content (the extent check and office
   metadata), entities (the registry and resolutions) and reading-pipeline's hook registry — and the fictional test
   profile (R42). Every test drives `events` at its interface, over the real `entities` (its scheme identifiers, the
   proceeding facet and resolutions). Both modules read one jurisdiction view, the test profile's, to which a test may
   add Legistar's two schemes and their numeric forms as test data (the profile names none, N561's kind of gap). */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { Extraction } from "../../../src/extraction/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { Entities } from "../../../src/entities/index.mjs";
import { readHooksOf } from "../../../src/reading-pipeline/hooks.mjs";
import { layerChainFor } from "../../../src/reading-pipeline/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { promotionOver } from "../promotion/fixtures.mjs";

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = { next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
              [Symbol.iterator]() { return c; }, toArray() { const o = rows.slice(i); i = rows.length; return o; } };
  return c;
}
export function storage() {
  const db = new DatabaseSync(":memory:");
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) db.exec(t);
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

export const MACHINE = "class:daemon";
export const MEMBER = "member:alice";
export const OUTSIDER = "member:outsider";
export const ZONE = "America/Halifax";

/* The test profile's view, to which a test may add Legistar's person and body schemes over numeric forms in the `person`
   and `body` spaces (R22, `jurisdictions` R3), as test data, never in product code. Its vote values are the profile's own
   (`vocabulary.vote_values`, `jurisdictions` R58, R62); `votes` replaces them as test data, `votes: "none"` removes them
   (a profile that holds none, as the first profile today, R11). */
export function testView({ legistar = false, votes = null } = {}) {
  const c = combine(["test-port-ellery"]);
  const view = structuredClone(c.view);
  if (legistar) {
    const numeric = (form) => ({ form, pattern: { re: "^(\\d+)$" }, normal: [{ group: 1 }], basis: "TEST" });
    view.spaces = { ...view.spaces,
      person: { ...view.spaces.person, forms: [...view.spaces.person.forms, numeric("legistar-person")] },
      body: { ...view.spaces.body, forms: [...view.spaces.body.forms, numeric("legistar-body")] } };
    view.identifier_schemes = [...(view.identifier_schemes || []),
      { scheme: "legistar_person", label: "Legistar PersonId", entity_kinds: ["person"], space: "person", form: "legistar-person", basis: "TEST" },
      { scheme: "legistar_body", label: "Legistar BodyId", entity_kinds: ["body"], space: "body", form: "legistar-body", basis: "TEST" }];
  }
  if (votes === "none") delete view.vocabulary.vote_values;
  else if (votes) view.vocabulary = { ...view.vocabulary, vote_values: votes };
  return view;
}

/** The work a call does in the store, as statements run and rows read (N1063): a measure of cost that, unlike a clock,
 *  does not change with the machine's load, so a bound on it proves the same at any load. */
export function metered(w, fn) {
  const sql = w.st.sql, exec = sql.exec;
  let statements = 0, rows = 0;
  sql.exec = (...a) => { statements++; const c = exec.apply(sql, a); const all = c.toArray(); rows += all.length; return cursorOf(all); };
  try { const value = fn(); return { value, statements, rows }; } finally { sql.exec = exec; }
}
const cursorOf = (rows) => cursor(rows);

let clock = 0;
/** A fresh record with the modules above and events over it. */
export function world({ view = testView(), now = null, profiles = true } = {}) {
  const st = storage();
  const host = { storage: st };
  const record = recordOf(host);
  record.migrate();
  if (profiles) record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "test");
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOver({ record, membership, host });
  const x = new Extraction(st, { record, membership, promotion });
  x.migrate();
  const prov = provenanceOf(host, { record, membership, promotion, now: () => "2026-09-27T00:00:00Z" });
  prov.migrate();
  const content = contentOf(host, { record, membership, provenance: prov, extraction: x });
  if (typeof content.migrate === "function") content.migrate();
  const ents = new Entities(st, { record, membership, provenance: prov });
  ents.migrate();
  /* entities reads the same view as events (the instance's one view; a test's added schemes are test data) */
  ents.view = () => ({ ...(typeof view === "function" ? view() : view), conflicts: [] });
  const hooks = readHooksOf(host);
  const ev = eventsOf(host, { record, membership, provenance: prov, extraction: x, content, entities: ents, readHooks: hooks,
                              now: now || (() => new Date(Date.UTC(2026, 9, 1, 0, 0, clock++)).toISOString()),
                              view: typeof view === "function" ? view : () => view });
  ev.migrate();
  for (const [m, role] of [["alice", "member"], ["bob", "member"], ["outsider", "member"], ["root", "admin"]])
    st.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, role, status, created, updated) VALUES (?, 'c', ?, 'active', '2026-01-01', '2026-01-01')`, m, role);
  const w = {
    st, host, record, membership, x, prov, content, ents, ev, hooks,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)], one: (q, ...a) => [...st.sql.exec(q, ...a)][0] || null,
    bundle(id, { type = "information", project = "" } = {}) {
      st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version, project)
                   VALUES (?, ?, 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1, ?)`, id, type, project);
      return id;
    },
    /* A project with one participant (membership R43 fences what belongs to it). */
    project(id, participant = "alice") {
      w.bundle(id, { type: "project" });
      st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, 'joined', 1, '2026-01-01', '2026-01-01')`, id, participant);
      return id;
    },
    /* A capture held in the register of `bundleId`, fetched direct (capture grade B), with a reading of `contentType`
       whose facts are `facts`, through extraction's writer; `units`, its text units, indexed by that writer. */
    capture(name, { bundleId = "INFO-2026-0001-a", project = "", contentType = "text/html", facts = {}, fetched = true, pages = null, extra = {}, units = null } = {}) {
      const s = sha(name);
      w.bundle(bundleId, { project });
      st.sql.exec(`INSERT OR REPLACE INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, ?, 'snapshots/x', 'utf8', 1, '2026-09-27T00:00:00Z')`, s, bundleId);
      if (fetched) prov.recordReceipt({ address: `https://example.test/${name}`, addressNorm: `https://example.test/${name}`, captureSha: s,
                                        retrieved: "2026-09-27T00:00:00Z", via: "direct" });
      x.writeReading({ bundleId, captureSha: s, composed: true, textUnits: units,
        reading: { content_type: contentType, reader_version: 1, found: true, at: "2026-09-27T00:00:00Z", entities: [],
                   facts, ...extra, ...(pages ? { page_count: pages, text_source: layerChainFor(null, { tier: 1, container: "pdf" }) } : {}) } });
      return s;
    },
    entity(label, kind = "person") {
      return ents.createEntity({ kind, label, note: "a subject the test registers", declaredBy: MEMBER }).entity_id;
    },
    /* A scheme identifier held on an entity by entities' own act (its R43), on a member's cited source. */
    identify(entityId, scheme, id) {
      const r = ents.addIdentifier({ entityId, scheme, id: String(id), basis: "the test's cited source", by: MEMBER });
      if (!r.ok) throw new Error(`fixture: addIdentifier refused ${r.reason}: ${r.detail}`);
      return r;
    },
    /* A proceeding registered with its facet {forum, kind, number} by entities (its R45). */
    proceeding(label, kind = "commitment_suit") {
      const forum = w.entity(`${label}, its forum`, "institution");
      const r = ents.createEntity({ kind: "proceeding", label, note: "a proceeding the test registers", declaredBy: MEMBER,
                                    proceeding: { forum, kind, number: `MC-26-${String(1000 + clock++).slice(-4)}` } });
      if (!r.ok) throw new Error(`fixture: createEntity refused ${r.reason}: ${r.detail}`);
      return r.entity_id;
    },
    /* An event attested by one dated fact of a fresh capture (`value` its date) or, with no value, by its extent. */
    event({ kind = "meeting", value = null, by = MEMBER, capture = null, dkind = "meeting", ...rest } = {}) {
      const s = capture || w.capture(`c-${Math.random()}`);
      const att = value === null ? { captureSha: s, extent: { kind: "document" } }
        : { datedFactId: ev.recordDatedFact({ captureSha: s, extent: { kind: "document" }, kind: dkind, value, method: "read by a member", by }).dated_fact.dated_fact_id };
      return ev.createEvent({ kind, attestations: [att], by, ...rest });
    },
  };
  return w;
}
