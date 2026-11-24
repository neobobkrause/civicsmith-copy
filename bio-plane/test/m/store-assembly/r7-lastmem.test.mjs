/* store-assembly's copy of plane's test. plane R92 -> R72 (fix round 7, G69; diagnosis-R7-reading.md R2): `last_mem` IS NULL WHEN THE PLATFORM CANNOT MEASURE IT, and a finished row leaves its last run.
   workerd's `process.memoryUsage()` answers all zeros, so `0` was written as if it were a reading, and a good tick left no trace at all
   (the row is deleted when it ends). Now an unmeasurable memory is NULL; and the plane keeps the last run of every (digest, kind) beyond
   the row, in `keeps_last` (the plane's own table, declared to purge with `keeps_pending`): milliseconds, own milliseconds, awaited
   milliseconds, memory, outcome and instant. The memory proof stays the capped-child harness. */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage } from "./fixture.mjs";
import { pendingOf, pendingOps } from "../../../src/store-assembly/pending.mjs";
/* extraction's published answers, made by its real code */
const { readHeldAnswer: { read: readDone, piece, final: readFinal } } = await import("../extraction/fixtures.mjs");

const D = "c".repeat(64);

async function reporting(shape, fn) {
  const real = process.memoryUsage;
  process.memoryUsage = Object.assign(() => shape, { rss: real.rss });
  try { return await fn(); } finally { process.memoryUsage = real; }
}
const ZEROS = { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };

test("R72 (G69): a platform that reports zeros gives `last_mem` NULL on the row, never 0; the same row measured by a platform that reports bytes stores them", async () => {
  // fixtures-generic: AGAIN   (a retry word no module gives: the row is measured whatever the owner's answer)
  const mk = () => { const { ctx } = storage(); const h = pendingOf(ctx, { workers: { reading: async () => ({ ok: false, reason: "AGAIN" }) } }); h.migrate(); return { ctx, h }; };
  await reporting(ZEROS, async () => {
    const { h } = mk();
    await h.owe({ kind: "reading", sha: D });
    await h.consumer().tick(Date.now() + 1000);
    assert.equal(h.list({ sha: D })[0].last_mem, null);
  });
  await reporting({ rss: 123_456_789, heapTotal: 1, heapUsed: 2, external: 3, arrayBuffers: 4 }, async () => {
    const { h } = mk();
    await h.owe({ kind: "reading", sha: D });
    await h.consumer().tick(Date.now() + 1000);
    assert.equal(h.list({ sha: D })[0].last_mem, 123_456_789);
  });
});

test("R72 (G69): after a row ends `finished`, the last run of that digest and kind is still answered: `ledgerLast` and `owedwork&sha=`'s `last`", async () => {
  await reporting(ZEROS, async () => {
    let t = 9_000_000;
    const { ctx } = storage();
    const h = pendingOf(ctx, { now: () => t, clock: () => t, workers: { reading: async () => { t += 1_500; return readDone(); } } });
    h.migrate();
    await h.owe({ kind: "reading", sha: D });
    await h.consumer().tick(t);
    assert.deepEqual(h.list({ sha: D }), [], "the row is gone: nothing is owed");
    const [last] = h.ledgerLast({ sha: D });
    assert.deepEqual([last.kind, last.outcome, last.last_ms, last.own_ms, last.wait_ms, last.last_mem], ["reading", "finished", 1500, 1500, 0, null]);
    assert.equal(typeof last.at, "number");
    const said = await pendingOps(h, new URL(`http://do/owedwork?sha=${D}`)).owedwork();
    assert.deepEqual([said.ok, said.owed, said.last.length, said.last[0].last_ms], [true, [], 1, 1500]);
    /* control: a digest never run answers an empty list, and the counts read (no digest) carry no `last` */
    assert.deepEqual(h.ledgerLast({ sha: "e".repeat(64) }), []);
    assert.equal(Object.hasOwn(await pendingOps(h, new URL("http://do/owedwork")).owedwork(), "last"), false);
  });
});

test("R72 (G69): a later run replaces the last run of its (digest, kind); a final stop and a retry are kept as their outcomes; a piece that goes on is `more`", async () => {
  let t = 11_000_000, n = 0;
  // fixtures-generic: SLOW   (a retry word no module gives: the first run is tried again, whatever the word)
  const answers = [{ ok: false, reason: "SLOW" }, await piece(), await readFinal()];
  const { ctx } = storage();
  const h = pendingOf(ctx, { now: () => t, clock: () => t, workers: { reading: async () => { t += 100 * (n + 1); return answers[n++]; } } });
  h.migrate();
  await h.owe({ kind: "reading", sha: D });
  const seen = [];
  for (let i = 0; i < 3; i++) {
    await h.consumer().tick(t + 10 * 3_600_000 * (i + 1));
    t += 10 * 3_600_000;
    const [last] = h.ledgerLast({ sha: D });
    seen.push([last.outcome, last.last_ms]);
  }
  assert.deepEqual(seen, [["retried", 100], ["more", 200], ["final", 300]]);
  assert.equal(h.ledgerLast({ sha: D }).length, 1, "one entry for each (digest, kind)");
});
