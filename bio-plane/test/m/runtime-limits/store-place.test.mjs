/* runtime-limits: where the platform keeps the team's room (R27, R28; fix round 7 G83, K4746, K4747, K4752, K4754).
 * A recording namespace takes the exact arguments of idFromName and get; one Miniflare run proves the
 * option reaches a real binding (local workerd places nothing: that is all it can prove). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STORE_HINTS, storeHint, storeGeneration, storeId, storeStub } from "../../../src/store-place.mjs";

const HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "apac-ne", "apac-se", "oc", "afr", "me"];

/** @typedef {{ id: string }} FakeId */
/** @typedef {{ stub: FakeId }} FakeStub */
/** @typedef {[string, unknown[]]} Call a method's name and the exact arguments it was given */

/** A recording namespace: each call's exact arguments, in order. */
function recorder() {
  /** @type {Call[]} */
  const calls = [];
  /** @type {import("../../../src/store-place.mjs").Rooms<FakeId, FakeStub>} */
  const STORE = {
    idFromName: (...a) => { calls.push(["idFromName", a]); return { id: a[0] }; },
    get: (...a) => { calls.push(["get", a]); return { stub: a[0] }; },
  };
  return { STORE, calls };
}
/** The arguments of the i-th call. @param {Call[]} calls @param {number} i @returns {unknown[]} */
const argsOf = (calls, i) => calls[i]?.[1] ?? [];

test("R27: STORE_HINTS is the frozen list of exactly the eleven hints", () => {
  assert.deepEqual([...STORE_HINTS], HINTS);
  assert.ok(Object.isFrozen(STORE_HINTS));
});

test("R27: storeHint answers a value that is exactly one of the eleven, else null", () => {
  for (const h of HINTS) assert.equal(storeHint({ STORE_LOCATION: h }), h);
  /** @type {unknown[]} */
  const bads = ["", " wnam", "wnam ", "WNAM", "Wnam", "bogus", "eu", 5, null, undefined, {}, ["wnam"]];
  for (const bad of bads) {
    assert.equal(storeHint({ STORE_LOCATION: bad }), null, String(bad));
  }
  assert.equal(storeHint({}), null);
  assert.equal(storeHint(undefined), null);
});

test("R27: storeGeneration is a whole number of 2 or more matching /^[1-9][0-9]*$/, else 1", () => {
  /** @param {unknown} v */
  const g = (v) => (v === undefined ? storeGeneration({}) : storeGeneration({ STORE_GENERATION: v }));
  /** @type {[unknown, number][]} */
  const cases = [[undefined, 1], ["1", 1], ["0", 1], ["-2", 1], ["2.5", 1], ["2.0", 1], [" 2", 1], ["2 ", 1],
    ["02", 1], ["", 1], ["abc", 1], [2, 1], [null, 1], ["2", 2], ["17", 17], ["10", 10]];
  for (const [v, want] of cases) {
    assert.equal(g(v), want, JSON.stringify(v));
  }
  assert.equal(g("99999999999999999999"), 1, "beyond a safe integer is no generation");
  assert.equal(storeGeneration(undefined), 1);
});

test("R28: storeStub without a hint passes no second argument; names are unchanged at generation 1", () => {
  const { STORE, calls } = recorder();
  storeStub({ STORE }, "bio");
  storeStub({ STORE, STORE_GENERATION: "1" }, "scratch");
  assert.deepEqual(calls, [
    ["idFromName", ["bio"]], ["get", [{ id: "bio" }]],
    ["idFromName", ["scratch"]], ["get", [{ id: "scratch" }]],
  ]);
  assert.equal(argsOf(calls, 1).length, 1);
});

test("R28: storeStub with a hint passes {locationHint}; a generation suffixes the object's name only", () => {
  const { STORE, calls } = recorder();
  storeStub({ STORE, STORE_LOCATION: "wnam" }, "bio");
  storeStub({ STORE, STORE_LOCATION: "weur", STORE_GENERATION: "2" }, "bio");
  storeStub({ STORE, STORE_GENERATION: "2" }, "scratch");
  assert.deepEqual(calls, [
    ["idFromName", ["bio"]], ["get", [{ id: "bio" }, { locationHint: "wnam" }]],
    ["idFromName", ["bio~g2"]], ["get", [{ id: "bio~g2" }, { locationHint: "weur" }]],
    ["idFromName", ["scratch~g2"]], ["get", [{ id: "scratch~g2" }]],
  ]);
  assert.equal(argsOf(calls, 5).length, 1);
});

test("R28: storeId equals what storeStub used, and an invalid hint is passed as none", () => {
  const { STORE, calls } = recorder();
  /** @type {import("../../../src/store-place.mjs").RoomEnv<FakeId, FakeStub>} */
  const env = { STORE, STORE_GENERATION: "3", STORE_LOCATION: "bogus" };
  const id = storeId(env, "bio");
  assert.deepEqual(id, { id: "bio~g3" });
  storeStub(env, "bio");
  assert.deepEqual(calls[1], ["idFromName", ["bio~g3"]]);
  assert.deepEqual(calls[2], ["get", [{ id: "bio~g3" }]]);
});

/** @typedef {{ equals(other: RealId): boolean }} RealId */
/** @typedef {{ fetch(url: string): Promise<{ text(): Promise<string> }> }} RealStub */
/** The binding Miniflare hands back, read as the namespace this test drives (the test's own channel).
 *  @param {unknown} v @returns {v is import("../../../src/store-place.mjs").Rooms<RealId, RealStub>} */
const isRooms = (v) => typeof v === "object" && v !== null && "idFromName" in v && typeof v.idFromName === "function"
  && "get" in v && typeof v.get === "function";

test("R28: with a hint on the real binding, the stub works (workerd places nothing locally)", async () => {
  const { Miniflare } = await import("miniflare");
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: "2025-01-01",
    durableObjects: { STORE: "Room" },
    script: `export class Room { async fetch() { return new Response("room"); } }
             export default { fetch() { return new Response("x"); } }`,
  });
  try {
    const env = await mf.getBindings();
    const STORE = env.STORE;
    assert.ok(isRooms(STORE), "the binding is a record-object namespace");
    const stub = storeStub({ STORE, STORE_LOCATION: "wnam", STORE_GENERATION: "2" }, "bio");
    assert.equal(await (await stub.fetch("http://do/")).text(), "room");
    assert.ok(storeId({ STORE, STORE_GENERATION: "2" }, "bio").equals(STORE.idFromName("bio~g2")));
  } finally { await mf.dispose(); }
});
