/* store-assembly's copy of plane's test. plane R91 -> R71 (fix round 7, G67; diagnosis-R7-reading.md R1, "What `last_ms` measures"): A ROW'S TIME IS ITS OWN. `started_at` was the alarm's
   instant, the same for every consumer and every row of the tick, so `last_ms` was the clock when the row ended minus the instant the whole
   alarm began: every earlier consumer and light row was in it. The row now starts at its own start; `own_ms` is the part that is the row's own
   (the 10 s bar's, BOB's reading of its own bar) and `wait_ms` the part it spent awaiting a worker (a service binding), reported apart.
   The clock is the injected one (R-CLOCK: no compute time is asserted; a stub advances it). */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, store } from "./fixture.mjs";
import { pendingOf } from "../../../src/store-assembly/pending.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
/* extraction's published answers, made by its real code */
const { readHeldAnswer: { read: readDone, piece } } = await import("../extraction/fixtures.mjs");

const D = "a".repeat(64), E = "b".repeat(64);

test("R71 (G67): a reading row after a 40 s render does not inherit it: `last_ms` and `own_ms` are the row's own 2 s, and `wait_ms` is reported apart", async () => {
  let t = 5_000_000;
  const { ctx } = storage();
  const h = pendingOf(ctx, { now: () => t, clock: () => t, workers: {
    subresources: async () => { t += 40_000; return { ok: true, done: true }; },   /* the earlier consumer: a 40 s render */
    reading: async () => { t += 2_000; return piece(); },
  } });
  h.migrate();
  await h.owe({ kind: "subresources", session: "s-render" });
  await h.owe({ kind: "reading", sha: D });
  const at = t;   /* the alarm's instant: one `at` for both rows */
  const out = await h.consumer().tick(at);
  assert.equal(out.pendingwork.asked, 2);
  const [reading] = h.list({ sha: D });
  assert.deepEqual([reading.last_ms, reading.own_ms, reading.wait_ms], [2000, 2000, 0]);
  /* the render's own time, kept beyond its ended row (R72) */
  const [render] = h.ledgerLast({ sha: "s-render" });
  assert.deepEqual([render.kind, render.outcome, render.last_ms, render.own_ms, render.wait_ms], ["subresources", "finished", 40_000, 40_000, 0]);
});

test("R71 (G67): control: a row that is the only one of its tick takes the same time as before, and a row that fails reports its own time too", async () => {
  let t = 5_000_000;
  const { ctx } = storage();
  // fixtures-generic: SLOW   (a retry word no module gives: the failing row is timed whatever the word)
  const h = pendingOf(ctx, { now: () => t, clock: () => t, workers: { reading: async (row) => { t += row.sha === D ? 3_000 : 500; return row.sha === D ? { ok: false, reason: "SLOW" } : readDone(); } } });
  h.migrate();
  await h.owe({ kind: "reading", sha: D });
  await h.consumer().tick(t);
  const [r] = h.list({ sha: D });
  assert.deepEqual([r.last_ms, r.own_ms, r.last_why ?? r.why], [3000, 3000, "SLOW"]);
});

test("R71 (G67): a worker awaited by the row is its `wait_ms`, apart from `own_ms`; the row's `last_ms` is both; a call that overlaps another is counted once", async () => {
  let t = 7_000_000;
  const advance = (ms) => { t += ms; };
  const x = await store({ env: { OCR_WORKER: { fetch: async () => { advance(25_000); return { ok: true }; } },
                                  PDF_WORKER: { fetch: async () => { advance(1_000); return { ok: true }; } } },
                          before: (ctx, env) => { pendingOf(ctx, { env, now: () => t, clock: () => t }); } });
  extractionOf(x.ctx).readHeld = async ({ env }) => {
    advance(3_000);                                   /* the row's own thread, between the awaits */
    await Promise.all([env.OCR_WORKER.fetch("https://ocr/page/1"), env.PDF_WORKER.fetch("https://pdf/info")]);
    advance(2_000);
    return readDone();
  };
  await pendingOf(x.ctx).owe({ kind: "reading", sha: E });
  await pendingOf(x.ctx).consumer().tick(t);
  const [r] = pendingOf(x.ctx).ledgerLast({ sha: E });
  /* the two calls start together at t0+3000: the OCR's 25 s and the PDF's 1 s run one after the other in this stub's clock, so the span is
     their union on the one clock: 26 s; the rest, 3 s + 2 s, is the row's own */
  assert.deepEqual([r.last_ms, r.wait_ms, r.own_ms], [31_000, 26_000, 5_000]);
});
