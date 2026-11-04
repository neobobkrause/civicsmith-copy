/* ai-runs R46, R47 (K660): the planning run — its plan, its refusals in order, and the open check a later module
   registers; and R27's migrated arm (K674). `plan` is not deployed today (run-rules R14), so the arms past R40 run in a
   world whose deployed modes are handed in-process (`deployedModes`), as the reviewed change that deploys it will. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ } from "./world.mjs";
import { migratedSurfacing } from "../inquiry/fixtures.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";

const PLN = "PLN-2026-0001";
const BOB = { contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" };

async function planWorld(opts = {}) {
  const w = world({ deployedModes: ["check", "plan"], ...opts });
  await w.group("ann", "bob");
  w.bundle(INQ);
  w.project(PROJ, "ann", { joined: ["bob"] });
  return w;
}
function refused(r, code) {
  assert.deepEqual([r.started, r.code, r.check, r.translation], [false, code, AI_RUNS_CHECKS[code].check, AI_RUNS_CHECKS[code].translation],
    JSON.stringify(r).slice(0, 200));
}

test("R46: in mode plan — no plan AI_RUN_PLAN_REQUIRED, a context other than project AI_RUN_PLAN_NEEDS_PROJECT, no member AI_RUN_PLAN_NEEDS_MEMBER, a search allowance AI_RUN_PLAN_NO_SEARCH, in that order, nothing written on any; a plan in any other mode AI_RUN_PLAN_UNEXPECTED", async () => {
  const w = await planWorld();
  const before = w.dump();
  const open = (o) => w.runs.open(OPEN({ mode: "plan", ...o }));
  /* each refusal, with every later condition also failing, so the order is what decides */
  refused(await open({ contextType: "inquiry", contextId: INQ, bounds: [{ bound: "fetches", allowed: 2 }] }), "AI_RUN_PLAN_REQUIRED");
  refused(await open({ plan: "   ", ...BOB }), "AI_RUN_PLAN_REQUIRED");
  refused(await open({ plan: PLN, contextType: "inquiry", contextId: INQ, bounds: [{ bound: "fetches", allowed: 2 }] }), "AI_RUN_PLAN_NEEDS_PROJECT");
  refused(await open({ plan: PLN, ...BOB, actor: null, bounds: [{ bound: "fetches", allowed: 2 }] }), "AI_RUN_PLAN_NEEDS_MEMBER");
  for (const bound of ["fetches", "subsessions"]) {
    const r = await open({ plan: PLN, ...BOB, bounds: [{ bound: "proposals", allowed: 5 }, { bound, allowed: 1 }] });
    refused(r, "AI_RUN_PLAN_NO_SEARCH");
    assert.equal(r.bound, bound);
  }
  /* a plan in any other mode, today too */
  refused(await w.runs.open(OPEN({ plan: PLN })), "AI_RUN_PLAN_UNEXPECTED");
  refused(await w.runs.open(OPEN({ mode: "check", plan: "" })), "AI_RUN_PLAN_UNEXPECTED");
  assert.equal(w.dump(), before, "nothing written on any");
  /* after R40: an undeployed mode naming a plan is C-109.1, not a plan refusal */
  refused(await w.runs.open(OPEN({ mode: "extract", plan: PLN })), "AI_RUN_MODE_NOT_DEPLOYED");
  /* controls: a check run with no plan lands, and a plan run naming no search allowance reaches the open check */
  assert.equal((await w.runs.open(OPEN())).started, true);
  refused(await open({ run: "R2", plan: PLN, ...BOB, bounds: [{ bound: "proposals", allowed: 5 }, { bound: "wallclock", allowed: 60000 }] }), "AI_RUN_MODE_UNCHECKED");
});

test("R46, R40, R78 (T46; T53; run-rules R14, R29, R36, K2892): plan is deployed by its own flag yet admitted only through partAdmitted on the account's entry — with no Gate 1 record for its gate part (run, which check shares) and no test instance an open in mode plan is refused C-109.1 whatever it names, as check is; with the record held it passes R40 and, no check registered, is refused AI_RUN_MODE_UNCHECKED", async () => {
  const w = world({ bars: [] });
  await w.group("ann", "bob");
  w.project(PROJ, "ann", { joined: ["bob"] });
  w.bundle(INQ);
  refused(await w.runs.open(OPEN({ mode: "plan", plan: PLN, ...BOB })), "AI_RUN_MODE_NOT_DEPLOYED");
  refused(await w.runs.open(OPEN({ mode: "plan" })), "AI_RUN_MODE_NOT_DEPLOYED");
  refused(await w.runs.open(OPEN()), "AI_RUN_MODE_NOT_DEPLOYED");
  assert.equal(w.count("ai_runs"), 0);
  const held = world();
  await held.group("ann", "bob");
  held.project(PROJ, "ann", { joined: ["bob"] });
  refused(await held.runs.open(OPEN({ mode: "plan", plan: PLN, ...BOB })), "AI_RUN_MODE_UNCHECKED");
  assert.equal(held.count("ai_runs"), 0);
});

test("R46, R47: a plan run passing the registered check lands with its plan stored verbatim, answered by read and runFor; no other run carries the key", async () => {
  const w = await planWorld();
  const heard = [];
  assert.deepEqual(w.runs.registerOpenCheck("action-plans", "plan", (a) => { heard.push(a); return null; }),
                   { ok: true, module: "action-plans", mode: "plan" });
  const r = await w.runs.open(OPEN({ run: "P1", mode: "plan", plan: PLN, ...BOB, bounds: [{ bound: "proposals", allowed: 5 }] }));
  assert.equal(r.started, true, JSON.stringify(r));
  /* R77 (T45): the check also receives the run's origin, and the response (null but for a re-examination) */
  assert.deepEqual(heard, [{ contextType: "project", contextId: PROJ, plan: PLN, actor: "bob", viewer: "member:bob",
                             origin: "member", response: null }]);
  assert.equal(w.row(`SELECT plan, mode FROM ai_runs WHERE run='P1'`).plan, PLN);
  const s = (await w.runs.read({ run: "P1", viewer: "member:bob" })).session;
  assert.deepEqual([s.mode, s.plan], ["plan", PLN]);
  assert.equal(Object.keys(s).at(-1), "plan");
  assert.equal(w.runs.runFor("P1", "member:bob").plan, PLN);
  await w.runs.open(OPEN({ run: "C1" }));
  assert.equal("plan" in (await w.runs.read({ run: "C1", viewer: "admin" })).session, false);
  assert.equal("plan" in w.runs.runFor("C1", "admin"), false);
  assert.equal(w.row(`SELECT plan FROM ai_runs WHERE run='C1'`).plan, null);
});

test("R47: registerOpenCheck — malformed LISTENER_MALFORMED, a second by the same module or for a held mode LISTENER_DECLARED; the check's refusal passed on unchanged and nothing written; no check, or one that cannot answer, AI_RUN_MODE_UNCHECKED", async () => {
  const w = await planWorld();
  const ok = () => null;
  for (const [m, mode, fn] of [["", "plan", ok], [null, "plan", ok], ["action-plans", "plan", 7], ["action-plans", "", ok], ["action-plans", null, ok]])
    assert.equal(w.runs.registerOpenCheck(m, mode, fn).code, "LISTENER_MALFORMED", `${m} ${mode}`);
  const open = () => w.runs.open(OPEN({ mode: "plan", plan: PLN, ...BOB }));
  refused(await open(), "AI_RUN_MODE_UNCHECKED");
  // fixtures-contract: action-plans plan-open-check
  const mine = { ok: false, code: "PLAN_CLOSED", check: "C-124.10", translation: "the plan's own sentence", detail: "d", extra: [1] };
  assert.equal(w.runs.registerOpenCheck("action-plans", "plan", () => mine).ok, true);
  assert.equal(w.runs.registerOpenCheck("action-plans", "check", ok).code, "LISTENER_DECLARED");
  const other = w.runs.registerOpenCheck("someone-else", "plan", ok);
  assert.deepEqual([other.code, other.module], ["LISTENER_DECLARED", "action-plans"]);
  const before = w.dump();
  const r = await open();
  assert.deepEqual(r, { run: "R1", started: false, ...mine }, "passed on unchanged");
  assert.equal(w.dump(), before);
  /* a check that throws, or answers neither null nor a refusal, cannot pass anything */
  for (const fn of [() => { throw new Error("x"); }, () => undefined, () => "yes", () => ({ ok: false })]) {
    const x = await planWorld();
    x.runs.registerOpenCheck("action-plans", "plan", fn);
    refused(await x.runs.open(OPEN({ mode: "plan", plan: PLN, ...BOB })), "AI_RUN_MODE_UNCHECKED");
    assert.equal(x.count("ai_runs"), 0);
  }
  /* a check registered for another mode applies to that mode */
  const y = await planWorld();
  y.runs.registerOpenCheck("later", "check", () => mine);
  assert.deepEqual(await y.runs.open(OPEN()), { run: "R1", started: false, ...mine });
});

test("R27 (K674): a question with no surfacing row answers inquiry's migratedSurfacing when it is not null, else not recorded; a row here wins", async () => {
  const f = migratedSurfacing();
  const w = world({ inquiry: f.inquiry });
  await w.group("ann");
  w.bundle(INQ);
  assert.ok(f.migratedAnswer, "inquiry answers the migrated question's surfacing");
  assert.deepEqual(await w.runs.surfacedIn(f.migrated, "admin"), f.migratedAnswer);
  assert.deepEqual(await w.runs.surfacedIn(f.plain, "admin"), { recorded: false, stated: "not recorded", run: null, lens: null });
  const throwing = world({ inquiry: { migratedSurfacing: () => { throw new Error("x"); } } });
  assert.equal((await throwing.runs.surfacedIn(f.migrated, "admin")).stated, "not recorded");
  /* a question this module holds a row for answers from it, not from the migration */
  await w.runs.open(OPEN({ bounds: [{ bound: "surfaces", allowed: 1 }] }));
  const x = world({ inquiry: f.inquiry });
  await x.group("ann"); x.bundle(INQ);
  await x.runs.open(OPEN({ bounds: [{ bound: "surfaces", allowed: 1 }] }));
  assert.equal(x.surface(f.migrated).ok, true);
  assert.equal((await x.runs.surfacedIn(f.migrated, "admin")).run, "R1");
});
