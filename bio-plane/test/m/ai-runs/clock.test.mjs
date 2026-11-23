/* ai-runs R10, R12, R14, R26, R52 (store-assembly R93; the instance clock, as ai-use's R17 reads it): where no `at` is handed, a
   run's open, tick, close and surfacing record their instants on the instance clock, the environment's `BIO_NOW_MS`, and a
   tick's spend is counted through ai-use on that day; with no pinned clock they read the wall clock as before. Every arm drives
   the module at its interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, USAGE, inquiryMd } from "./world.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

const PINNED = "2026-03-15T12:00:00Z";
const PINNED_MS = Date.parse(PINNED);
const LATER = "2026-03-15T12:10:00Z";   /* R83: the lease, ten minutes after the last tick or open */
const call = () => ({ mode: "check", model: "claude-model-x", usage: USAGE(), calls: 1 });

async function clockWorld(env) {
  const w = world({ env });
  await w.group("ann");
  w.bundle(INQ);
  aiUseOf(w.ctx);
  return w;
}

test("R10, R12, R14, R52 (the instance clock): with BIO_NOW_MS pinned and no `at` handed, the open, the tick and the close record the pinned instant, the lease runs from it, and the tick's spend is counted through ai-use on the pinned day", async () => {
  const w = await clockWorld({ BIO_NOW_MS: String(PINNED_MS) });
  const o = await w.runs.open(OPEN({ at: null }));
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  assert.deepEqual([o.created, o.expires], [PINNED, LATER]);
  const t = w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, usage: [call()] });
  assert.deepEqual([t.ticked, t.counted], [true, 1]);
  assert.deepEqual(w.rows(`SELECT day, calls FROM ai_usage`), [{ day: "2026-03-15", calls: 1 }]);
  assert.deepEqual(w.row(`SELECT created, updated, expires FROM ai_runs WHERE run = 'R1'`),
    { created: PINNED, updated: PINNED, expires: LATER });
  const c = await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG });
  assert.equal(c.terminated, true, JSON.stringify(c).slice(0, 300));
  assert.equal(w.row(`SELECT stopped_at FROM ai_runs WHERE run = 'R1'`).stopped_at, PINNED);
  assert.deepEqual(w.rows(`SELECT DISTINCT at FROM observation_log WHERE authority_kind = 'run'`), [{ at: PINNED }]);
});

test("R26 (the instance clock): a surfacing under a run records the pinned instant", async () => {
  const w = await clockWorld({ BIO_NOW_MS: String(PINNED_MS) });
  await w.runs.open(OPEN({ at: null, bounds: [{ bound: "surfaces", allowed: 1 }] }));
  const id = "INQ-2026-0101";
  const r = w.promotion.promote({ bundleId: id, base: null, files: [{ path: "bundle.md", text: inquiryMd(id) }], meta: {},
    snapKey: "s1", author: ORG, assistantPrincipal: ORG, run: "R1", actorViewer: "admin" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(Date.parse(r.surfaced_in.at), PINNED_MS);
});

test("R10, R52 (the instance clock), control: an `at` handed wins over the pinned clock, and with BIO_NOW_MS absent, empty or not a number the wall clock is read", async () => {
  const handed = await clockWorld({ BIO_NOW_MS: String(PINNED_MS) });
  const h = await handed.runs.open(OPEN({ at: "2026-07-01T00:00:00Z" }));
  assert.equal(h.created, "2026-07-01T00:00:00Z");
  for (const env of [{}, { BIO_NOW_MS: "" }, { BIO_NOW_MS: "soon" }]) {
    const w = await clockWorld(env);
    const before = Date.now() - 1000;
    const o = await w.runs.open(OPEN({ at: null }));
    const t = w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, usage: [call()] });
    const after = Date.now() + 1000;
    assert.ok(Date.parse(o.created) >= before && Date.parse(o.created) <= after, `${JSON.stringify(env)}: ${o.created}`);
    assert.equal(t.counted, 1);
    const day = w.row(`SELECT day FROM ai_usage`).day;
    assert.ok([new Date(before).toISOString().slice(0, 10), new Date(after).toISOString().slice(0, 10)].includes(day), day);
  }
});
