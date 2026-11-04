/* plane G123b, G123c (fix round 9; S-39, S-40; K4787): THE SHAPE HARNESS'S OWN TESTS. The harness (`shape/harness.mjs`) runs the real plane in a capped child; what it measures and what it injects must itself be shown.
   R84 names the harness's reads (the cap convention is G123a's test in `g41-shape.test.mjs`). Each test runs a 3 MiB CSV (a few ticks, a few seconds) through `shapeRun`:
   G123b  a buffer held inside ONE tick shows in that tick's `peakMB` (the sampler is inside the tick; it was cleared on the next line, so `peakMB` was a tick-boundary reading), a clean tick does not
   G123c  each fault injector acts at the tick it names, through the real object (`injected`), and the control run beside it is untouched: a store that refuses writes, an owner that throws at its entry,
          the evidence object gone, a kill after k statements (a new object over the same storage), a restart, and the poke after the restart; the 2 MB value shim is applied in the suite process.
   Counts only (R-CLOCK): no assertion reads a time. Run under the preload (`npm test`, `module-tests.mjs`): `node --import ./test/platform-sqlite.mjs --test test/m/plane/shape-harness.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeRun, csvDoc, shimApplied } from "./shape/harness.mjs";

const run = (faults = {}, extra = {}) => shapeRun({ doc: csvDoc(3 * 1048576), faults, maxTicks: 8, readingFor: false, ...extra }, { capMB: null });
const control = await run();
const total = control.done.units;

test("G123c: the platform's 2 MB value shim is applied in the suite process, and the control run reads the file whole, injecting nothing at any tick", async () => {
  assert.equal(await shimApplied(), true, "run under --import test/platform-sqlite.mjs (npm test and the module runner do)");
  assert.equal(control.died, false);
  /* T53: the tick count follows runtime-limits' per-tick budget (two ticks before T53-511, four since), so it is not pinned here; no tick injects */
  assert.ok(control.ticks.length >= 2, `the file takes more than one tick: ${control.ticks.length}`);
  assert.deepEqual(control.ticks.map((t) => t.injected), control.ticks.map(() => []), "the control injects nothing");
  assert.equal(control.done.state.state, "whole");
});

test("R84 G123b: a buffer held inside one tick shows in that tick's peakMB; the clean tick beside it and the control do not", async () => {
  const LEAK_MB = 150;
  const r = await run({ leakAt: 1, leakMB: LEAK_MB });
  assert.deepEqual(r.ticks[0].injected, ["leak"]);
  assert.ok(r.ticks[0].aboveBaseMB >= LEAK_MB, `tick 1 peak ${r.ticks[0].aboveBaseMB} MB above base`);
  assert.ok(r.ticks[1].aboveBaseMB < LEAK_MB / 2, `tick 2 peak ${r.ticks[1].aboveBaseMB} MB above base: the leak ended with its tick`);
  assert.ok(control.ticks[0].aboveBaseMB < LEAK_MB / 2, "control");
});

test("G123c: storeFailAt refuses the object's writes for that tick alone: it writes no unit, an ordinary tick does", async () => {
  const r = await run({ storeFailAt: 1 });
  assert.deepEqual(r.ticks[0].injected, ["storeFail"]);
  assert.equal(r.ticks[0].counts.unitsWritten, 0);
  assert.ok(control.ticks[0].counts.unitsWritten > 0, "control");
  assert.ok(!r.ticks[1].injected.length, "the next tick is not failed");
});

test("G123c: entryThrowsAt makes the reading owner throw at its entry for that tick: the row states the throw and counts a try, the next tick reads", async () => {
  const r = await run({ entryThrowsAt: 1 });
  assert.deepEqual(r.ticks[0].injected, ["entryThrows"]);
  assert.equal(r.ticks[0].counts.unitsWritten, 0);
  assert.ok(r.ticks[0].rows[0].attempts >= 1 && r.ticks[0].rows[0].last_why, JSON.stringify(r.ticks[0].rows));
  assert.ok(r.done.units >= 1, "the read goes on");
});

test("G123c: objectGoneAt deletes the evidence object: no unit is written and the row states why it is owed", async () => {
  const r = await run({ objectGoneAt: 1 }, { maxTicks: 3 });
  assert.deepEqual(r.ticks[0].injected, ["objectGone"]);
  assert.equal(r.done.units, 0);
  assert.ok(r.ticks[0].rows[0].last_why, JSON.stringify(r.ticks[0].rows));
});

test("G123c: killAt kills the object after k statements and the platform builds a new one over the same storage: the tick ran fewer statements than the control's and the read is finished by the new object", async () => {
  const r = await run({ killAt: 1, killAfterSql: 60 });
  assert.deepEqual(r.ticks[0].injected, ["kill", "restart"]);
  assert.ok(r.ticks[0].counts.sql <= 61 && r.ticks[0].counts.sql < control.ticks[0].counts.sql, `${r.ticks[0].counts.sql} statements`);
  assert.equal(r.done.units, total, "every unit once");
  assert.equal(r.done.state.state, "whole");
});

test("G123c: restartAt builds a new object over the same storage after that tick, and the poke helper reports whether one ordinary request found the alarm armed before and after", async () => {
  const r = await run({ restartAt: 1, pokeAfterRestart: true });
  assert.deepEqual(r.ticks[0].injected, ["restart"]);
  assert.equal(r.done.units, total);
  const p = r.ticks[0].poked;
  assert.ok(p && typeof p.armedBefore === "boolean" && typeof p.armedAfter === "boolean" && p.status === 200, JSON.stringify(p));
  assert.equal(control.ticks[0].poked, null, "control: no poke");
});
