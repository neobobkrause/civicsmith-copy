/* ai-runs R085-7 (K3477; WALK-085 F2): R82, a dispatch waits only for agent-worker to accept the segment; R83, a lease of ten
   minutes; R84, a segment's end logged, a stopped segment continued, an error ending the run. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, T0, agentWorker } from "./world.mjs";
import { aiRunsOps } from "../../../src/ai-runs/index.mjs";

const ACCEPTS = { status: 202, body: { accepted: true, run_id: "R1" } };
const minutes = (n) => new Date(Date.parse(T0) + n * 60000).toISOString().replace(".000Z", "Z");
const logOf = (w, run = "R1") => w.rows(`SELECT * FROM observation_log WHERE authority_kind='run' AND authority=? ORDER BY seq`, run);

/** ann's own check run on her own sign-in, her session its principal, with the agent-worker binding `aw`. */
async function memberRun(aw, env = {}) {
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50", ...env } });
  await w.group("ann", "bob", { noAccount: ["ann", "bob"] });
  await w.signin("ann");
  await w.account("bob");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  const o = await w.runs.open(OPEN({ principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" }));
  assert.equal(o.started, true, JSON.stringify(o));
  return w;
}
/** The plane's `op=airuntick`, as the control plane calls it: identities in the query, the rest in the body. */
const airuntick = (w, body, who = "member:ann") => aiRunsOps(w.runs, new URL(`http://plane/airuntick?principal=${who}&viewer=${who}&actor=${who}`),
  { run: "R1", ...body }).airuntick();

test("R82: a dispatch waits only for agent-worker to accept the segment — a worker that accepts at once (202) and runs on is RUNNING and counts as dispatched, the run's lease counted from it; control: a worker that never answers is the call that did not complete, with the run-still-resumable entry", async () => {
  const aw = agentWorker(ACCEPTS);
  const w = await memberRun(aw);
  const r = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: minutes(3) });
  assert.deepEqual([r.dispatched, r.dispatch.state, r.dispatch.status], [true, "RUNNING", 202]);
  assert.equal(aw.calls.length, 1);
  assert.equal(logOf(w).length, 0, "an accepted segment writes no failure entry");
  assert.equal(w.row(`SELECT expires FROM ai_runs WHERE run='R1'`).expires, minutes(13), "R83: ten minutes from the dispatch");
  /* control */
  const slow = await memberRun(agentWorker("hang"));
  const c = await slow.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.deepEqual([c.dispatched, c.dispatch.state], [false, "SILENT"]);
  assert.equal(logOf(slow).length, 1);
  assert.match(logOf(slow)[0].detail, /did not complete .*still resumable/);
});

test("R82: the wait for acceptance is ten seconds by default — nothing answers before it, the call that did not complete answers at it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const aw = agentWorker("hang");
  const w = await memberRun(aw, { AI_RUN_DISPATCH_WAIT_MS: undefined });
  let out = null;
  const p = w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" }).then((x) => { out = x; });
  /* until the call is made (its wait timer is set in the same step), not a fixed number of turns: the sealed key and the mint
     are awaited first, and under load they take as many turns as they take */
  for (let i = 0; i < 100000 && aw.calls.length === 0; i++) await new Promise((res) => setImmediate(res));
  assert.equal(aw.calls.length, 1, "the call was made");
  t.mock.timers.tick(9999);
  for (let i = 0; i < 5; i++) await new Promise((res) => setImmediate(res));
  assert.equal(out, null, "not yet at 9.999 s");
  t.mock.timers.tick(1);
  await p;
  assert.deepEqual([out.dispatched, out.dispatch.state], [false, "SILENT"]);
});

test("R83: a running run's lease lapses ten minutes after its last tick — one with no tick for ten minutes is reaped with bound lease; control: a tick nine minutes after the last extends it", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const o = await w.runs.open(OPEN({ run: "A" }));
  await w.runs.open(OPEN({ run: "B" }));
  assert.equal(o.started, true);
  assert.equal(w.row(`SELECT expires FROM ai_runs WHERE run='A'`).expires, minutes(10));
  const tk = await w.runs.tick({ run: "B", viewer: "admin", caller: ORG, at: minutes(9) });
  assert.equal(tk.expires, minutes(19), "the tick at 9 minutes extends it to 19");
  assert.equal(w.runs.reapDue(Date.parse(minutes(9.9))), 0);
  const r = w.runs.reap(Date.parse(minutes(10.1)));
  assert.deepEqual(r.reaped.map((x) => [x.run, x.terminated, x.bound]), [["A", true, "lease"]]);
  assert.equal(w.row(`SELECT status FROM ai_runs WHERE run='B'`).status, "running", "control: the ticked run lives on");
  assert.equal(w.runs.reap(Date.parse(minutes(19.1))).reaped[0].run, "B");
});

test("R84: a segment's end is appended to the run's log at level meaning, subject 'segment -> end', its refusal codes in the detail; one that stopped on its own bound with the run not done is dispatched again without a member's act; control: one that ended done is not", async () => {
  const aw = agentWorker(ACCEPTS);
  const w = await memberRun(aw);
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" })).dispatched, true);
  assert.equal(aw.calls.length, 1);
  const t = await airuntick(w, { segment_end: { by: null, done: false, refusals: ["REPORT_UNLOCATED", "AI_LOG_STATE_UNKNOWN"] } });
  assert.deepEqual([t.ticked, t.segment_end.next, t.segment_end.dispatch.dispatched, t.segment_end.dispatch.state], [true, "continue", true, "RUNNING"]);
  assert.equal(aw.calls.length, 2, "the plane dispatched the next segment");
  assert.equal(aw.calls[1].url, "https://agent-worker/run");
  assert.equal(aw.calls[1].body.run_id, "R1");
  const end = logOf(w).filter((x) => x.subject === "segment -> end");
  assert.equal(end.length, 1);
  assert.equal(end[0].level, "meaning");
  assert.match(end[0].detail, /REPORT_UNLOCATED, AI_LOG_STATE_UNKNOWN/);
  /* control: done */
  const d = await airuntick(w, { segment_end: { by: "the table", done: true, refusals: [] } });
  assert.deepEqual([d.ticked, d.segment_end.next, d.segment_end.dispatch], [true, "done", undefined]);
  assert.equal(aw.calls.length, 2, "a segment that ended done is not dispatched again");
  assert.equal(logOf(w).filter((x) => x.subject === "segment -> end").length, 2, "its end is logged all the same");
  /* an error: logged with its code, not dispatched again, the run left to its lease */
  const e = await airuntick(w, { segment_end: { by: null, done: false, refusals: [], error: "PROVIDER_DOWN" } });
  assert.deepEqual([e.ticked, e.segment_end.next, e.segment_end.dispatch, e.status, e.ended], [true, "error", undefined, "running", undefined]);
  assert.equal(aw.calls.length, 2, "a segment that ended in an error is not dispatched again");
  const ends = logOf(w).filter((x) => x.subject === "segment -> end");
  assert.equal(ends.length, 3);
  assert.match(ends[2].detail, /PROVIDER_DOWN/);
  assert.equal(w.runs.reap(Date.now() + 3600000).reaped[0].bound, "lease", "the lease ends it");
  /* control: a tick without a segment end dispatches nothing and logs no end */
  const w2 = await memberRun(agentWorker(ACCEPTS));
  await airuntick(w2, {});
  assert.equal(logOf(w2).filter((x) => x.subject === "segment -> end").length, 0);
});

test("R84: a continuation under R18's principal rules — a run whose principal the plane cannot dispatch for is not dispatched, one entry saying why, the run waiting for its principal; a run already ended is not continued", async () => {
  const aw = agentWorker(ACCEPTS);
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` } } });
  await w.group("ann");
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ run: "R1" }))).started, true);        // the organisation credential's run, no instance credential held
  const t = await w.runs.tickAndContinue({ run: "R1", viewer: "admin", caller: ORG, segment_end: { by: null, done: false, refusals: [] } });
  assert.deepEqual([t.segment_end.next, t.segment_end.dispatch.dispatched, t.segment_end.dispatch.state], ["continue", false, "WITHHELD"]);
  assert.equal(aw.calls.length, 0, "nothing reached the binding");
  const rows = logOf(w).filter((x) => x.subject === "segment -> end");
  assert.equal(rows.length, 2, "the end, and the continuation not dispatched");
  assert.match(rows[1].detail, /not dispatched .*still resumable/);
  /* an ended run: its tick is the stated no-op, nothing logged, nothing sent */
  assert.equal((await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG })).terminated, true);
  const late = await w.runs.tickAndContinue({ run: "R1", viewer: "admin", caller: ORG, segment_end: { by: null, done: false, refusals: [] } });
  assert.deepEqual([late.ticked, late.segment_end], [false, undefined]);
  assert.equal(aw.calls.length, 0);
});
