/* lines' test fixture: a Durable Object storage stand-in over node:sqlite at the plane's shape (`sql.exec` answering a
   cursor, `transactionSync` nesting as savepoints), with the real modules lines uses: record-core, membership,
   provenance, content (the extent check), entities (the registry, scheme identifiers, the proceeding facet and
   resolutions), events (`when` and `onWhenChanged`) and connection-grammar. `extraction` is not lines' use: it is the
   one `content` and `events` make for this storage, reached through `content` to lay down a reading. The view is the
   fictional test profile's, to which the fixture adds one organisation scheme as test data (the profile names persons'
   schemes only). Every test drives `lines` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { Entities } from "../../../src/entities/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { createRegistry } from "../../../src/connection-grammar/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { Lines } from "../../../src/lines/index.mjs";
import { makePromotion } from "../promotion/fixtures.mjs";

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
export const MACHINE = "class:admin";
export const ANN = "member:ann";
export const HFX = "America/Halifax";
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

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

/* The test profile's view with one organisation scheme added as test data: `test_org`, numeric, for offices, bodies
   and institutions (a register's own body and office ids, R4). */
function testView() {
  const view = structuredClone(combine(["test-port-ellery"]).view);
  const numeric = { form: "test-org", pattern: { re: "^(\\d+)$" }, normal: [{ group: 1 }], basis: "TEST" };
  view.spaces = { ...view.spaces, object: { ...(view.spaces.object || { label: "object" }), forms: [...((view.spaces.object || {}).forms || []), numeric] } };
  view.identifier_schemes = [...(view.identifier_schemes || []),
    { scheme: "test_org", label: "register organisation id", entity_kinds: ["office", "body", "institution"], space: "object", form: "test-org", basis: "TEST" }];
  return view;
}

let tick = 0;
/* A fresh record with lines over it. `profiles` sets the active jurisdiction profiles (record-core R26). */
export function world({ profiles = ["test-port-ellery"] } = {}) {
  const st = storage();
  const host = { storage: st };
  const record = recordOf(host);
  record.migrate();
  if (profiles) record.setSetting("jurisdiction_profiles", profiles, "test");
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = makePromotion().p;
  const prov = provenanceOf(host, { record, membership, promotion, now: () => "2026-09-27T00:00:00Z" });
  prov.migrate();
  const content = contentOf(host, { record, membership, provenance: prov });
  content.extraction.migrate();
  content.migrate();
  const view = testView();
  const ents = new Entities(st, { record, membership, provenance: prov });
  ents.migrate();
  ents.view = () => ({ ...view, conflicts: [] });
  const clock = () => new Date(Date.UTC(2026, 9, 1, 0, 0, tick++)).toISOString();
  const ev = eventsOf(host, { record, membership, provenance: prov, content, extraction: content.extraction, entities: ents,
                              now: clock, view: () => view });
  ev.migrate();
  const registry = createRegistry();
  const l = new Lines(st, { record, provenance: prov, content, entities: ents, events: ev, registry, now: clock });
  l.migrate();
  for (const m of ["ann", "outsider"])
    st.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, role, status) VALUES (?, 'c', 'member', 'active')`, m);
  let n = 0;
  const w = {
    st, host, record, membership, prov, content, ents, ev, registry, l,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)], one: (q, ...a) => [...st.sql.exec(q, ...a)][0] || null,
    bundle(id, { type = "information", project = "" } = {}) {
      st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version, project)
                   VALUES (?, ?, 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1, ?)`, id, type, project ?? "");
      return id;
    },
    /* A captured document homed in `bundleId`, fetched directly, with an empty reading; `refs` its references. */
    held(bundleId, captureSha, { address = "https://records.example/doc", project = "", refs = [] } = {}) {
      w.bundle(bundleId, { project });
      st.sql.exec(`INSERT OR REPLACE INTO register (capture_sha, bundle_id, path, encoding, bytes, registered)
                   VALUES (?, ?, 'snapshots/x', 'utf8', 1, '2026-09-27T00:00:00Z')`, captureSha, bundleId);
      prov.recordReceipt({ address, addressNorm: address.toLowerCase(), captureSha, retrieved: "2026-09-27T00:00:00Z", via: "direct" });
      content.extraction.writeReading({ bundleId, captureSha, composed: true,
        reading: { content_type: "text/html", reader_version: 1, found: true, at: "2026-09-27T00:00:00Z", entities: refs } });
      return captureSha;
    },
    /* A project with one participant. */
    project(id, participant) {
      w.bundle(id, { type: "project" });
      st.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, role, status) VALUES (?, 'c', 'member', 'active')`, participant);
      st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, 'joined', 1, '2026-01-01', '2026-01-01')`, id, participant);
      return id;
    },
    /* A registered entity; a proceeding with its facet (entities R45). */
    ent(kind, label) {
      const proceeding = kind === "proceeding"
        ? { forum: w.ent("institution", `${label}, its forum`), kind: "commitment_suit", number: `MC-26-${String(1000 + n++).slice(-4)}` } : undefined;
      const r = ents.createEntity({ kind, label, note: `${label}, registered by the test`, declaredBy: ANN, proceeding });
      if (!r.ok) throw new Error(`${kind} ${label}: ${r.reason} ${r.detail}`);
      return r.entity_id;
    },
    /* A scheme identifier held by entities' own act (its R43). */
    identify(entityId, scheme, id) {
      const r = ents.addIdentifier({ entityId, scheme, id: String(id), basis: "the test's cited source", by: ANN });
      if (!r.ok) throw new Error(`addIdentifier: ${r.reason} ${r.detail}`);
    },
    /* An event attested by a dated fact (`value` a day or minute) of a fresh capture, or undated by an extent. */
    event(value = null) {
      const s = w.held(`INFO-2026-${String(9000 + n++)}`, sha(`event capture ${n}-${Math.random()}`));
      const att = value === null ? { captureSha: s, extent: { kind: "document" } } : { datedFactId: w.dated(s, value) };
      const r = ev.createEvent({ kind: "meeting", attestations: [att], by: ANN });
      if (!r.ok) throw new Error(`createEvent: ${r.reason} ${r.detail}`);
      return r.event_id;
    },
    dated(s, value) {
      const f = ev.recordDatedFact({ captureSha: s, extent: { kind: "document" }, kind: "meeting", value, method: "read by a member", by: ANN });
      if (!f.ok) throw new Error(`recordDatedFact: ${f.reason} ${f.detail}`);
      return f.dated_fact.dated_fact_id;
    },
    /* Moves an event's `when` by a member's acts in events: a new dated attestation, chosen to govern. */
    move(eventId, value) {
      const s = w.held(`INFO-2026-${String(9000 + n++)}`, sha(`move ${n}-${Math.random()}`));
      const a = ev.attest({ eventId, attestation: { datedFactId: w.dated(s, value) }, by: ANN });
      if (!a.ok) throw new Error(`attest: ${a.reason} ${a.detail}`);
      return ev.chooseGoverning({ eventId, attestationId: a.attestation_id, reason: "the later minutes correct it", by: ANN });
    },
    /* A member's testimony line: the shortest valid act. */
    say(kind, from, to, more = {}) {
      const r = w.l.recordLine({ kind, from, to, basis: { statement: "I was there" }, by: ANN, ...more });
      if (!r.ok) throw new Error(`${kind}: ${r.reason} ${r.detail}`);
      return r.line_id;
    },
  };
  return w;
}
