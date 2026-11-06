/* load-check R1: runProfile refuses a wrong account and the shared copy before any request, and steps up a ramp to the
 * first step that breaks a budget, returning the steps before it. */
import test from "node:test";
import assert from "node:assert/strict";
import { runProfile, LoadRefusal } from "../../../src/load-check/index.mjs";
import { budgetOf } from "../../../src/read-bounds.mjs";
import { fixtureCopy, profile, fast } from "./fixture-copy.mjs";

const seeded = (copy) => Object.assign(copy, { seed: { by: "load-check", team: "p3dev-load-team", documents: [] } });

test("R1 a copy of a wrong account is refused with no request made", async () => {
  const copy = seeded(fixtureCopy({ account: "0000000000000000000000000000beef" }));
  await assert.rejects(runProfile(copy, profile(), [5, 10], fast), (e) => e instanceof LoadRefusal && e.code === "ACCOUNT_NOT_PERMITTED");
  assert.equal(copy.state.requests.length, 0);
  assert.equal(copy.state.gauges, 0);
});

test("R1 the shared test copy is refused with no request made", async () => {
  const copy = seeded(fixtureCopy({ shared: true }));
  await assert.rejects(runProfile(copy, profile(), [5], fast), (e) => e.code === "SHARED_COPY");
  assert.equal(copy.state.requests.length + copy.state.gauges, 0);
});

test("R1 latency rising with members stops at the step that crosses the budget and returns the steps before it", async () => {
  /* the screens take 100 ms a member: 1,500 ms at 15 holds screen_load's 2,000 ms; 2,500 ms at 25 does not */
  const copy = seeded(fixtureCopy({ latency: (op, members) => (op === "cite" ? 20 : 100 * members) }));
  const r = await runProfile(copy, profile(), [5, 10, 15, 25, 40], fast);
  assert.equal(r.completed, true);
  assert.deepEqual(r.steps.map((s) => s.members), [5, 10, 15]);
  assert.equal(r.broken.members, 25);
  assert.equal(r.rated, 15);
  assert.ok(r.broken.broke.includes("home"));
  assert.ok(!copy.state.requests.some((q) => q.members === 40), "no step after the break");
  const home = r.steps[2].items.home;
  assert.equal(home.class, "screen_load");
  assert.equal(home.ceiling_ms, budgetOf("screen_load").ceiling_ms);
  for (const k of ["median", "p90", "p99", "hops", "requests", "repeats", "samples"]) assert.ok(Number.isFinite(home[k]), k);
  assert.equal(r.steps[2].items.held.repeats, r.steps[2].items.held.requests / 2, "a read asked twice in a screen is a repeat");
  assert.ok(Number.isFinite(r.steps[0].cost) && r.steps[0].cost > 0);
  assert.deepEqual(r.steps[0].door_wait, { median: 3, p90: 3 });
  assert.deepEqual(r.steps[0].errors, {});
});

test("R1 a step failing over 1 % of operations stops the ramp, errors counted by code", async () => {
  let n = 0;
  const copy = seeded(fixtureCopy({ fail: (op, members) => (members >= 10 && ++n % 20 === 0 ? "BUSY" : null) }));
  const r = await runProfile(copy, profile(), [5, 10, 15], fast);
  assert.deepEqual(r.steps.map((s) => s.members), [5]);
  assert.equal(r.broken.members, 10);
  assert.equal(r.broken.failing, true);
  assert.ok(r.broken.errors.BUSY > 0);
});

test("R1 an op not declared by op-declarations is refused before any request", async () => {
  const copy = seeded(fixtureCopy());
  await assert.rejects(runProfile(copy, profile({ items: { x: { reads: ["nosuchop"] } } }), [5], fast), (e) => e.code === "UNDECLARED_OP");
  assert.equal(copy.state.requests.length, 0);
});
