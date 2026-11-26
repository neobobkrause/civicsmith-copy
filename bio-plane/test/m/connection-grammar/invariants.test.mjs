/* connection-grammar at its interface: purity (R16), no measure of connectedness (R17), and every no saying why (R18). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as cg from "../../../src/connection-grammar/index.mjs";
import { KINDS, NODE, AT, INQUIRY, makeNeighbours, fixture, tie, said } from "./fixtures/owner.mjs";
import { isList } from "../../../src/connection-grammar/raw.mjs";
/** @import { Refusal, PassedRefusal, ReadFailure, NeighboursAnswer } from "../../../src/connection-grammar/shape.mjs" */

/**
 * A registry read's answer, where it answers and does not refuse.
 * @param {Refusal | PassedRefusal | (Refusal & {failures: ReadFailure[]}) | NeighboursAnswer} res
 * @returns {NeighboursAnswer}
 */
const answerOf = (res) => {
  assert.ok(!("refused" in res));
  return res;
};
/**
 * A stand-in for a host service that fails the test when it is called.
 * @param {string} name
 * @returns {() => never}
 */
const trap = (name) => () => { throw new Error(`${name} was read`); };

test("R16 pure: every service runs with no clock, no network and no store, and holds only what is registered in memory", (t) => {
  t.mock.method(Date, "now", trap("Date.now")); t.mock.method(globalThis, "fetch", trap("fetch"));
  t.mock.method(Math, "random", trap("Math.random")); t.mock.method(performance, "now", trap("performance.now"));
  try {
    const r = cg.createRegistry();
    const res = r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours() });
    assert.equal("ok" in res && res.ok, true);
    r.owners(); r.kindOf("sample_tie"); r.checkConnection(tie("c", NODE, "ENT-2026-0002"));
    assert.ok(Array.isArray(answerOf(r.neighbours({ owner: "sample", node: NODE, kinds: ["sample_tie"], at: AT, viewer: "alice", scope: INQUIRY })).items));
    assert.equal(cg.ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(), fixture: fixture() }).ok, true);
    cg.chainGrade([tie("c", NODE, "ENT-2026-0002")]); cg.chainLabel([said("d", NODE, "ENT-2026-0007")]);
    cg.orderPaths([[tie("c", NODE, "ENT-2026-0002")]]); cg.exhausted({ visited: 1, reason: "time" }); cg.depthOf(3);
    cg.derivedId({ kind: "k", from: NODE, to: NODE, as_of: "2026-01-01", method: "m" });
  } finally {
    t.mock.restoreAll();
  }
  // No walker and no stored path: nothing offered walks from a node or keeps a path.
  for (const name of Object.keys(cg)) assert.doesNotMatch(name, /walk|path(?!s$)|explore|traverse|store|save/i, name);
});

test("R17 nothing offers a measure of how connected a node is, a centrality, or a score across kinds", () => {
  for (const name of Object.keys(cg)) assert.doesNotMatch(name, /degree|central|score|rank|count|popular|connected/i, name);
  assert.deepEqual(Object.keys(cg.BOUNDS).sort(), ["depth_default", "depth_max", "fanout", "hub", "hub_by_kind", "nodes", "time_budget_ms"]);
  // The per-kind hub bound limits work on one kind's set; no bound mixes kinds or ranks nodes.
  assert.ok(Object.values(cg.BOUNDS.hub_by_kind).every((n) => Number.isInteger(n) && n > 0));
  assert.deepEqual(cg.CLASSES, ["evidentiary", "derived", "declared", "hunch"]);
  const r = cg.createRegistry();
  for (const w of ["most connected", "centrality", "influence score", "network hub", "knows"]) {
    const res = r.registerOwner({ owner: "o", kinds: [{ kind: "k", word: w, class: "derived" }], neighbours: () => ({ items: [] }) });
    assert.equal("refused" in res ? res.refused : undefined, "WORD_FORBIDDEN", w);
  }
  // A walk's semantics answer grades, labels and an order, never a number about a node.
  const p = [tie("a", NODE, "ENT-2026-0002"), tie("b", "ENT-2026-0002", "ENT-2026-0003")];
  assert.deepEqual(Object.keys(cg.chainGrade(p)).sort(), ["assertion", "end"]);
  assert.deepEqual(cg.chainLabel(p), { label: "evidenced" });
  const ordered = cg.orderPaths([p]);
  assert.ok(isList(ordered) && ordered.every(isList));
  // A hub is named by its set size alone: the one count, and never a ranking among nodes.
  const h = cg.createRegistry();
  h.registerOwner({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours() });
  const hub = answerOf(h.neighbours({ owner: "sample", node: "ENT-2026-9999", at: AT, viewer: "alice", scope: null })).hub;
  assert.ok(hub);
  assert.deepEqual(Object.keys(hub).sort(), ["set_size", "why"]);
});

test("R18 every refusal and every undetermined answer says which kind of no and why", () => {
  const r = cg.createRegistry();
  r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours() });
  const noes = [
    r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: () => ({}) }),
    r.registerOwner({}),
    r.neighbours({ owner: "sample", node: NODE, at: AT, scope: null }),
    r.neighbours({ owner: "x", node: NODE, at: AT, viewer: "a", scope: null }),
    cg.depthOf(11), cg.depthOf(0), cg.exhausted({ reason: "x" }), cg.chainGrade([]), cg.chainLabel(null), cg.orderPaths(null),
  ];
  for (const n of noes) {
    const no = typeof n === "object" && "refused" in n ? n : null;
    assert.match(String(no?.refused), /^[A-Z_]+$/, JSON.stringify(n));
    const why = no?.why;
    assert.ok(typeof why === "string" && why.length > 10, JSON.stringify(n));
  }
  for (const reason of cg.EXHAUSTION_REASONS) assert.ok(cg.exhausted({ visited: 0, reason }).why.length > 10);
  const hunchGrade = cg.chainGrade([{ ...said("d", NODE, "ENT-2026-0007"), label: cg.HUNCH_LABEL }]);
  assert.ok((hunchGrade.why ?? "").length > 10);
  const items = answerOf(r.neighbours({ owner: "sample", node: NODE, at: AT, viewer: "alice", scope: INQUIRY })).items;
  for (const i of items) {
    const u = i.undetermined;
    if (u) assert.ok(u.why.key.length && typeof u.why.vars === "object");
  }
  const bad = r.checkConnection({});
  assert.equal(bad.ok, false);
  assert.ok((bad.errors ?? []).every((e) => e.field && e.why.length > 5));
});
