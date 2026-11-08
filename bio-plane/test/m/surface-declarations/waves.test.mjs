/* surface-declarations R10 (T53; K4599, N1264; PL10): a screen declares its reads as waves, checked at the declaration, and
   its hop count is derived (one for the session, one for each wave). R11 (PL11, PL15): `screenread` answers a screen's
   declared reads together; one refused read never spoils the others, a slow one is cut, a write is never batched. The reads
   named here are real ops the owners declare (read from `OPS`, never hand-built answers: the outcomes are the shape
   `screenread`'s caller hands in). */
import "../op-declarations/register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { opBudgets, SCREENREAD, declareScreenReads, screenHops, screenReadOf } from "../../../src/op-declarations/compose.mjs";
const OP_BUDGETS = opBudgets();

const read = (pred) => Object.keys(OPS).find((op) => OPS[op].mutating === false && pred(op));
const write = () => Object.keys(OPS).find((op) => OPS[op].mutating === true);
const A = read((op) => op === "heldat");
const B = read((op) => op === "bundlehistory");

test("R10: a screen declared with two waves is accepted, a later wave taking an earlier answer, and derives waves + 1 hops", () => {
  const reads = declareScreenReads("probe-screen", [
    { name: "where", op: A, args: { address: "x" }, wave: 1 },
    { name: "history", op: B, args: { bundle: { from: "where" } }, wave: 2 },
  ]);
  assert.equal(reads.length, 2);
  assert.ok(Object.isFrozen(reads) && Object.isFrozen(reads[0]) && Object.isFrozen(reads[1].args));
  assert.equal(screenHops(reads), 3);
});

test("R10: a read naming an unknown op, or the answer of a read in the same or a later wave, is refused naming it", () => {
  assert.throws(() => declareScreenReads("s", [{ name: "x", op: "nosuchreadop", wave: 1 }]), /UNKNOWN_OP nosuchreadop/);
  assert.throws(() => declareScreenReads("s", [
    { name: "a", op: A, args: { b: { from: "b" } }, wave: 1 }, { name: "b", op: B, wave: 2 }]), /LATER_WAVE_ARG b/);
  assert.throws(() => declareScreenReads("s", [
    { name: "a", op: A, wave: 1 }, { name: "b", op: B, args: { a: { from: "a" } }, wave: 1 }]), /LATER_WAVE_ARG a/);
  assert.throws(() => declareScreenReads("s", [{ name: "a", op: A, args: { q: { from: "nobody" } }, wave: 1 }]), /LATER_WAVE_ARG nobody/);
  assert.throws(() => declareScreenReads("s", [{ name: "a", op: A, wave: 2 }]), /BAD_WAVE/);
  assert.throws(() => declareScreenReads("s", [{ name: "a", op: A, wave: 1 }, { name: "a", op: B, wave: 1 }]), /DUPLICATE_READ/);
});

test("R10 control: a screen with one wave derives two hops", () => {
  const reads = declareScreenReads("one", [{ name: "a", op: A, wave: 1 }, { name: "b", op: B, wave: 1 }]);
  assert.equal(screenHops(reads), 2);
});

test("R11: screenread is a read op whose spec states its input and answer", () => {
  assert.equal(SCREENREAD.op, "screenread");
  assert.equal(SCREENREAD.kind, "read");
  assert.equal(SCREENREAD.mutating, false);
  assert.deepEqual([...SCREENREAD.input], ["screen", "params"]);
  assert.deepEqual([...SCREENREAD.answer], ["reads", "stamps", "server_ms"]);
  assert.equal(SCREENREAD.classes.includes("ai"), false);
});

test("R11: a write op in a screen's list is refused at the declaration", () => {
  const w = write();
  assert.throws(() => declareScreenReads("s", [{ name: "a", op: A, wave: 1 }, { name: "w", op: w, wave: 1 }]),
    new RegExp(`WRITE_IN_READS ${w}`));
});

test("R11: one refused read answers refused and the rest whole; a read past its bound is cut slow and the others answer", () => {
  const reads = declareScreenReads("s", [{ name: "a", op: A, wave: 1 }, { name: "b", op: B, wave: 1 }]);
  const refusal = { code: "CAPABILITY_REQUIRED" };
  const one = screenReadOf(reads, { a: { ok: false, status: 403, refusal, ms: 3 }, b: { ok: true, status: 200, body: { n: 1 }, ms: 4 } }, { viewer: 7 });
  assert.deepEqual(one.reads.a, { ok: false, status: 403, refusal });
  assert.deepEqual(one.reads.b, { ok: true, status: 200, body: { n: 1 } });
  assert.deepEqual(one.stamps, { viewer: 7 });
  const boundA = OP_BUDGETS[A].ceiling_ms;
  const boundB = OP_BUDGETS[B].ceiling_ms;
  const slow = screenReadOf(reads, { a: { ok: true, body: 1, ms: boundA + 1 }, b: { ok: true, body: 2, ms: 5 } });
  assert.deepEqual(slow.reads.a, { ok: false, status: "slow", bound_ms: boundA });
  assert.deepEqual(slow.reads.b, { ok: true, status: 200, body: 2 });
  /* a read that never answered is cut the same way; the answer never exceeds the sum of the bounds */
  const none = screenReadOf(reads, { b: { ok: true, body: 2, ms: 5 } });
  assert.equal(none.reads.a.status, "slow");
  assert.ok(none.server_ms <= boundA + boundB);
});

test("R11 control: a screen whose reads all succeed answers them all ok", () => {
  const reads = declareScreenReads("s", [{ name: "a", op: A, wave: 1 }, { name: "b", op: B, args: { x: { from: "a" } }, wave: 2 }]);
  const all = screenReadOf(reads, { a: { ok: true, body: 1, ms: 2 }, b: { ok: true, body: 2, ms: 3 } });
  assert.deepEqual(Object.values(all.reads).map((r) => r.ok), [true, true]);
  assert.equal(all.server_ms, 5);
});
