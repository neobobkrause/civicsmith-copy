/* lines at its interface: the bound cache moved with its event in the same transaction (R6), and a read failing
   closed on a stale cache (R7). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, ANN } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const T = { statement: "I attended the swearing-in" };

test("R6 bound_cache holds each bound resolved: a value as given, an event bound as the event's when edge, null when the event has no when; one onWhenChanged registration moves every bounded line's cache inside the event's transaction, on the real events", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master");
  const sworn = w.event("2021-03-04");
  const left = w.event();
  const r = w.l.recordLine({ kind: "holds", from: p, to: o, capacity: "appointed",
                             valid: { from: { event: sworn, edge: "start" }, to: { event: left, edge: "end" } }, basis: T, by: ANN });
  assert.equal(r.ok, true);
  const cache = () => w.one(`SELECT * FROM line_bound_cache WHERE line_id=?`, r.line_id);
  assert.deepEqual([cache().from_instant, cache().to_instant], ["2021-03-04", null], "an event with no when is not stated");
  const v = w.l.recordLine({ kind: "holds", from: p, to: o, capacity: "acting", valid: { from: "2019-02-01", to: "2019-06-30" }, basis: T, by: ANN });
  assert.deepEqual([w.one(`SELECT from_instant, to_instant FROM line_bound_cache WHERE line_id=?`, v.line_id)].map((c) => [c.from_instant, c.to_instant])[0],
                   ["2019-02-01", "2019-06-30"]);
  /* the event moves: the cache moves with it, in the event's transaction */
  assert.equal(w.move(sworn, "2021-04-01").ok, true);
  assert.equal(cache().from_instant, "2021-04-01");
  assert.equal(w.move(left, "2024-06-30").ok, true);
  assert.deepEqual([cache().to_instant, cache().to_precision, cache().to_zone], ["2024-06-30", "day", "America/Halifax"]);
  assert.equal(w.l.holderAt({ office: o, at: "2024-06-30", viewer: ANN }).holder, p, "a to-bound reads through the event's whole day");
  assert.deepEqual(w.l.holderAt({ office: o, at: "2024-07-01", viewer: ANN }).why, { key: "lines.why.no_line_covers", vars: {} });
  /* a failed event write rolls the cache back with it: a later module's listener throws, so events undoes the move */
  let boom = false;
  assert.equal(w.ev.onWhenChanged("local-facts", () => { if (boom) throw new Error("this listener fails"); }).ok, true);
  boom = true;
  assert.equal(w.move(sworn, "2022-01-01").reason, "LISTENER_FAILED");
  assert.equal(cache().from_instant, "2021-04-01");
  assert.deepEqual(w.record.rebuildAndCompare("lines", "line_bound_cache"), { same: true });
  /* one registration: a second is refused */
  assert.equal(w.l.migrate().already, true);
  assert.equal(w.ev.onWhenChanged("lines", () => {}).reason, "LISTENER_DECLARED");
});

test("R7 a read of a line whose bound_cache differs from its rebuild fails closed: valid undetermined, why 'cache stale', and it is counted by neither structureAt nor holderAt", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const h = w.l.recordLine({ kind: "holds", from: p, to: o, capacity: "elected", valid: { from: "2020-01-01", to: "2024-12-31" }, basis: T, by: ANN });
  const s = w.l.recordLine({ kind: "part_of", from: o, to: b, valid: { from: "2010-01-01", to: "2030-01-01" }, basis: T, by: ANN });
  assert.equal(w.l.holderAt({ office: o, at: "2022-05-01", viewer: ANN }).holder, p);
  assert.equal(w.l.structureAt({ entity: o, at: "2022-05-01", viewer: ANN }).held.length, 2);
  w.st.sql.exec(`UPDATE line_bound_cache SET to_instant='2099-12-31'`);
  const read = w.l.readLine({ lineId: h.line_id, viewer: ANN }).line;
  assert.deepEqual(read.valid, { undetermined: true, why: { key: "lines.why.cache_stale", vars: {} } });
  const hold = w.l.holderAt({ office: o, at: "2022-05-01", viewer: ANN });
  assert.equal(hold.holder, null);
  assert.deepEqual(hold.lines, [{ line_id: h.line_id, why: { key: "lines.why.cache_stale", vars: {} }, state: "undetermined" }]);
  const st = w.l.structureAt({ entity: o, at: "2022-05-01", viewer: ANN });
  assert.equal(st.held.length, 0);
  assert.deepEqual(st.undetermined.map((u) => u.why), [{ key: "lines.why.cache_stale", vars: {} }, { key: "lines.why.cache_stale", vars: {} }]);
  assert.notDeepEqual(w.record.rebuildAndCompare("lines", "line_bound_cache"), { same: true });
  /* a rebuild clears it */
  w.record.rebuildDerived("lines", "line_bound_cache");
  assert.equal(w.l.holderAt({ office: o, at: "2022-05-01", viewer: ANN }).holder, p);
  /* a row marked stale, and a missing row, fail closed too */
  w.st.sql.exec(`INSERT INTO derived_stale (module, table_name, key_json, marked_at) VALUES ('lines','line_bound_cache',?, 'x')`,
                JSON.stringify([["line_id", s.line_id]]));
  assert.deepEqual(w.l.readLine({ lineId: s.line_id, viewer: ANN }).line.valid.why, { key: "lines.why.cache_stale", vars: {} });
  w.st.sql.exec(`DELETE FROM line_bound_cache WHERE line_id=?`, h.line_id);
  assert.deepEqual(w.l.readLine({ lineId: h.line_id, viewer: ANN }).line.valid.why, { key: "lines.why.cache_stale", vars: {} });
});

test("R6 (K1563 (1)) linesOf(host) is the one instance per host, wired by default to that host's real events, entities and content: its event bounds are read through that host's events", async () => {
  const { storage, ANN: who } = await import("./fixture.mjs");
  const { recordOf } = await import("../../../src/record-core/index.mjs");
  const { membershipOf } = await import("../../../src/membership/index.mjs");
  const { provenanceOf } = await import("../../../src/provenance/index.mjs");
  const { contentOf } = await import("../../../src/content/index.mjs");
  const { entitiesOf } = await import("../../../src/entities/index.mjs");
  const { eventsOf } = await import("../../../src/events/index.mjs");
  const { linesOf } = await import("../../../src/lines/index.mjs");
  const host = { storage: storage() };
  const record = recordOf(host); record.migrate();
  record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "test");
  membershipOf(host, { record }).migrate();
  provenanceOf(host).migrate();
  const content = contentOf(host); content.extraction.migrate(); content.migrate();
  const ents = entitiesOf(host); ents.migrate();
  const ev = eventsOf(host); ev.migrate();
  const l = linesOf(host);
  assert.equal(linesOf(host), l, "one instance per host");
  l.migrate();
  const p = ents.createEntity({ kind: "person", label: "Ada Example", note: "a person", declaredBy: who }).entity_id;
  const o = ents.createEntity({ kind: "office", label: "Harbour Master", note: "an office", declaredBy: who }).entity_id;
  const e = ev.createEvent({ kind: "meeting", attestations: [{ testimony: "I was at the swearing-in", statement: "I was at the swearing-in" }], by: who });
  assert.equal(e.ok, true, JSON.stringify(e));
  const r = l.recordLine({ kind: "holds", from: p, to: o, capacity: "appointed", valid: { from: { event: e.event_id, edge: "start" } },
                           basis: { statement: "sworn in that day" }, by: who });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(l.readLine({ lineId: r.line_id, viewer: who }).line.valid.from.event, /^EVT-/);
});
