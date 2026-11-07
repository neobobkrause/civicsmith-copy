/* scheduler — the provider notice case-carriage:658 (case-carriage PR 658, T53): case-carriage changed its source and no
   requirement text. The `document-copy` consumer (R25) calls `copyBatch({})`, `copyWake(now)` and `onCopyWork`; this checks,
   against the real case-carriage in its own test world, that each is still a function of the shape R25 reads, that the
   registration is taken, and that an idle instance's copyWake answers null so no alarm is held. No code of this module
   changed; copies.test.mjs drives a real copy through it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "../../../src/scheduler/index.mjs";
import { storage } from "./fixture.mjs";
import { world as ccWorld, NOW as CC_NOW } from "../case-carriage/fixture.mjs";

test("notice case-carriage:658, R25, R9, R15: the real case-carriage still offers copyBatch, copyWake and onCopyWork as R25 reads them; the registration is taken; with nothing queued document-copy is not due and holds no alarm", async () => {
  const w = ccWorld();
  for (const m of ["copyBatch", "copyWake", "onCopyWork"]) assert.equal(typeof w.cc[m], "function", m);
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { caseCarriage: () => w.cc } });
  assert.deepEqual(s.listenTo({ caseCarriage: w.cc }).caseCarriage, { ok: true, module: "scheduler" });
  assert.deepEqual(s.faults(), []);
  const T = Date.parse(CC_NOW);
  assert.equal(w.cc.copyWake(T), null);
  const r = await s.onAlarm(T);
  assert.equal("doccopy" in r, false);
  assert.equal(st.alarm, null);
  const b = await w.cc.copyBatch({});
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(b.copied, 0);
});
