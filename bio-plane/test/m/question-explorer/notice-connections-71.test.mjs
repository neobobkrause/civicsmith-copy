/* question-explorer over connections PR 71 (notice connections:71): PR 71 changed connections' neighbours, explore, hubs
   and named_in answers; this module reads only `asserted` (R2's ties) and `read({captureSha})` (R4's connection find).
   Confirmed with no code change: a connection find is gauged and offered on connections' real `read` answer, made by
   connections' own code over its own world when the test runs (its `fixture.mjs`, K4990), never written by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as connectionsWorld, V } from "../connections/fixture.mjs";
import { world, Q, DOC, DOC2, CALLER } from "./fixture.mjs";

const E = "ENT-2026-0001";

/* Two documents about one subject in connections' own world (the same ids as this world's DOC and DOC2): its real read. */
function realRead() {
  const c = connectionsWorld();
  c.member("alice");
  c.entity(E, "The Ordinance");
  const [a] = c.doc(DOC, ["alpha"]);
  const [b] = c.doc(DOC2, ["beta"]);
  c.resolve(a, DOC, "Ord. 1", E, "A"); c.read(a, DOC, "Ord. 1", [2]);
  c.resolve(b, DOC2, "Ord. 1", E, "A"); c.read(b, DOC2, "Ord. 1", [null]);
  c.k.derive({ entityId: E });
  return { a, b, read: (args) => c.k.read({ ...args, viewer: V("alice") }) };
}

test("notice connections:71 (R4, R5): a connection the run located is found on connections' real read({captureSha}) answer, gauged, and offered once; control: a connection about another subject is not located", async () => {
  const w = await world().standard();
  const real = realRead();
  w.connections.read = (args) => real.read({ captureSha: args.captureSha, limit: args.limit });
  const o = await w.openRun("group");
  const f = w.p.find({ run: o.run, kind: "connection", ref: { a: real.b, b: real.a, entity: E }, bearing: "unclear",
                       how: "both name the ordinance", caller: CALLER });
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.equal(f.ref, `${[real.a, real.b].sort().join(":")}:${E}`);
  assert.deepEqual(w.p.findsFor({ viewer: "member:alice" }).finds.map((x) => [x.find, x.question]), [[f.find, Q]]);
  /* Control: the same pair under another entity is no connection connections holds. */
  const other = w.p.find({ run: o.run, kind: "connection", ref: { a: real.a, b: real.b, entity: "ENT-2026-0999" },
                           bearing: "unclear", how: "x", caller: CALLER });
  assert.equal(other.code, "EXPLORE_FIND_UNKNOWN");
});
