/* agent-harness — its requirements, tested at its interface (`src/harness.mjs`, `src/subsession.mjs`), pure.
 *
 * Every live id R1–R19 of `build/requirements/agent-harness.md` is named by a test here, in its title. The module is
 * pure (R8), so nothing is stood up: the tables are walked directly, exhaustively where a requirement says "never",
 * and a run is driven the way the Worker shell drives it (`walk` below: `nextStep`, then `advance`, a judgement
 * applied only at a judged row). What only the shell does (the plane calls, the HTTP status) is agent-worker's and is
 * tested there. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

import * as HARNESS from "../src/harness.mjs";
import * as SUBSESSION from "../src/subsession.mjs";
import { DEPLOYED_MODES, RUN_MODES, checkCondition } from "../../bio-plane/src/run-rules/index.mjs";
import { CONDITION_KINDS } from "../../bio-plane/src/observation-log/vocabulary.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

const {
  CONTROL_FLOW, PLAN_FLOW, FIRST_STEP, MODES, LEVELS, BUDGET_BOUNDS, PLAN_BUDGET_BOUNDS, PLAN_MAX_PASSES,
  DEFAULT_MAX_PASSES, JUDGEABLE, NOT_JUDGEABLE, PLAN_READS,
  nextStep, nextPlanStep, gateStep, stopBecause, planStopBecause, passLimit, advance, planAdvance, applyJudgement,
  flowFor,
} = HARNESS;
const {
  REPORT_KEYS, REPORT_STATES, CITATION_KEYS, SUMMARY_MAX, ADDRESS_MAX, CITATIONS_MAX, REPORT_MAX_BYTES, SPAWN_KEYS,
  SUBSESSION_OPS, checkReport, spawnContract, spawnContracts, takeReports,
} = SUBSESSION;

/* A run driven as the shell drives it: from the gate, each step's decision applied by `advance`; at a judged row the
   next judgement (if any is left) is applied first. Returns the trace, the close and the judgements consumed. */
function walk(start, judgements = [], { flow = CONTROL_FLOW, limit = 200, newEachPass = false } = {}) {
  const next = flow === PLAN_FLOW ? nextPlanStep : nextStep;
  const move = flow === PLAN_FLOW ? planAdvance : advance;
  const queue = [...judgements];
  let state = { step: FIRST_STEP, pass: 0, ...start };
  const trace = [];
  let used = 0;
  for (let i = 0; i < limit; i++) {
    if (flow[state.step]?.judged && queue.length) {
      const j = queue.shift();
      used++;
      const applied = applyJudgement(state, j);
      if (!applied.ok) return { trace, refused: { step: state.step, fields: applied.overreach }, used, state };
      state = applied.state;
    }
    const d = next(state);
    trace.push(`${state.step}>${d.step}`);
    if (d.step === "close") return { trace, bound: d.bound, why: d.why, used, state: move(state, d) };
    state = move(state, d);
    /* newEachPass: stands for a pass that submitted a candidate (R15), so only the pass limit ends the run */
    if (newEachPass && state.step === "plan") state = { ...state, passAdded: true };
  }
  throw new Error("walk did not close");
}

const spent = (bound) => ({ [bound]: { allowed: 1, consumed: 1 } });

/* ============================================================ R1: the control-flow table */
test("R1: the rows are exactly gate-mode, resume, plan, fanout, collect, compose, dedup, submit, adjust, next-pass, close", () => {
  assert.deepEqual(Object.keys(CONTROL_FLOW), ["gate-mode", "resume", "plan", "fanout", "collect", "compose", "dedup",
    "submit", "adjust", "next-pass", "close"]);
  for (const [row, r] of Object.entries(CONTROL_FLOW)) {
    assert.ok(Array.isArray(r.to), `${row} declares its steps`);
    for (const to of r.to) assert.ok(to in CONTROL_FLOW, `${row} -> ${to} names a row`);
  }
  assert.deepEqual(CONTROL_FLOW.close.to, []);
});

test("R1: nextStep never returns a step outside its row's declared steps, over every combination of what it reads", () => {
  const escapes = [];
  const queue = (n) => Array.from({ length: n }, (_, i) => ({ name: `c${i}` }));
  for (const step of [...Object.keys(CONTROL_FLOW), undefined])
    for (const mode of ["check", "investigate", "extract", "plan", "", "wat", undefined])
      for (const pass of [0, 1, 3])
        for (const maxPasses of [undefined, 0, 1, 3])
          for (const refusal of [null, { code: "X" }])
            for (const adjusted of [false, true])
              for (const q of [0, 1, 2])
                for (const budget of [undefined, spent("fetches"), spent("wallclock"), { fetches: { allowed: 0, consumed: 4 } }])
                  for (const resumeAt of [null, "collect", "adjust", "gate-mode", "close", "wat"]) {
                    const d = nextStep({ step, mode, pass, maxPasses, refusal, adjusted, budget, resumeAt, queue: queue(q),
                                         resumedFrom: pass });
                    const at = step ?? FIRST_STEP;
                    const legal = at === "close" ? d.step === "close" : CONTROL_FLOW[at].to.includes(d.step);
                    if (!legal) escapes.push(`${at}->${d.step}`);
                    assert.equal(typeof d.why, "string");
                  }
  assert.deepEqual([...new Set(escapes)], []);
});

test("R1: there is no edge from compose to submit, and none from submit back to itself on a refusal", () => {
  assert.equal(CONTROL_FLOW.compose.to.includes("submit"), false);
  for (const q of [[], [{ name: "a" }], [{ name: "a" }, { name: "b" }]])
    for (const adjusted of [false, true])
      assert.equal(nextStep({ step: "submit", mode: "check", pass: 0, maxPasses: 3, refusal: { code: "X" }, adjusted, queue: q }).step,
        "adjust");
  /* compose goes to dedup whatever it composed, even nothing. */
  for (const candidates of [[], [{ name: "a" }]])
    assert.equal(nextStep({ step: "compose", pass: 0, maxPasses: 3, candidates }).step, "dedup");
});

test("R1: an unknown step closes with `completed` and says so", () => {
  for (const step of ["nowhere", "fan-out", "CLOSE"]) {
    const d = nextStep({ step, pass: 0, maxPasses: 3 });
    assert.deepEqual([d.step, d.bound], ["close", "completed"]);
    assert.equal(d.why, localize("agent-harness.harness.at_is_not_a_row", "'{at}' is not a row in this table", { at: step }));
    assert.ok(d.why.includes(step));
  }
});

/* ============================================================ R2: the gate */
test("R2: gate-mode is first: a run with no step starts there, and nothing in it is judged", () => {
  assert.equal(FIRST_STEP, "gate-mode");
  assert.equal(Object.keys(CONTROL_FLOW)[0], "gate-mode");
  assert.equal(CONTROL_FLOW["gate-mode"].judged, null);
  assert.deepEqual(nextStep({ mode: "check", pass: 0, maxPasses: 3 }).step, "resume");
  assert.deepEqual(nextStep({ mode: "investigate" }).bound, "mode-not-deployed");
});

test("R2: the deployed modes are those MODES marks deployed, agreeing with run-rules' DEPLOYED_MODES: check and plan; investigate and extract are not", () => {
  const deployed = Object.entries(MODES).filter(([, m]) => m.deployed).map(([k]) => k);
  assert.deepEqual(deployed, ["check", "plan"]);
  assert.deepEqual(deployed, DEPLOYED_MODES.filter((m) => RUN_MODES.includes(m)));
  assert.equal(MODES.investigate.deployed, false);
  assert.equal(MODES.extract.deployed, false);
  /* each mode MODES marks deployed passes the gate on either table, and only those */
  for (const flow of [CONTROL_FLOW, PLAN_FLOW])
    for (const mode of Object.keys(MODES)) {
      const r = walk({ mode, maxPasses: 1 }, [], { flow });
      if (deployed.includes(mode)) assert.equal(r.trace[0], "gate-mode>resume", mode);
      else assert.deepEqual([r.trace, r.bound], [["gate-mode>close"], "mode-not-deployed"], mode);
    }
  /* check walks CONTROL_FLOW; plan (since T46) walks PLAN_FLOW, R6, to its one pass */
  assert.equal(flowFor("check"), CONTROL_FLOW);
  assert.equal(walk({ mode: "check", maxPasses: 1 }).trace.includes("plan>fanout"), true);
  assert.equal(flowFor("plan"), PLAN_FLOW);
  const plan = walk({ mode: "plan" }, [], { flow: flowFor("plan") });
  assert.deepEqual([plan.trace, plan.bound],
    [["gate-mode>resume", "resume>read", "read>compose", "compose>dedup", "dedup>close"], "completed"]);
  /* the why names the deployed modes as MODES marks them, for every refused word */
  for (const mode of ["investigate", "extract", "sorcery", ""])
    assert.ok(gateStep({ mode }).why.includes(`deployed now: ${deployed.join(", ")};`), mode);
});

test("R2: a mode that is not deployed closes mode-not-deployed at its first step, before any bound, fan-out, request or suggestion", () => {
  for (const mode of ["investigate", "extract", "sorcery", null, undefined, "", "Check", " check", "Plan", "plan "]) {
    /* even with every budget spent and the pass limit reached: the gate is asked before any bound */
    for (const state of [{}, { budget: { ...spent("fetches"), ...spent("subsessions"), ...spent("wallclock") }, pass: 9, maxPasses: 1 }]) {
      for (const flow of [CONTROL_FLOW, PLAN_FLOW]) {
        const r = walk({ mode, ...state }, [], { flow });
        assert.deepEqual([r.trace, r.bound], [["gate-mode>close"], "mode-not-deployed"], `${String(mode)}`);
      }
      assert.deepEqual(gateStep({ mode, ...state }).bound, "mode-not-deployed");
    }
  }
  /* a deployed mode with a spent budget passes the gate and stops on the bound after it */
  const r = walk({ mode: "check", budget: spent("fetches"), maxPasses: 3 });
  assert.deepEqual([r.trace, r.bound], [["gate-mode>resume", "resume>close"], "fetches"]);
});

test("R2: its why tells a mode the table holds and has not deployed from a word it does not hold, and names the deployed modes", () => {
  /* the gate's sentence, as the product composes it from the mode's sentence (localize equality, K3810) */
  const gateWhy = (which) => localize("agent-harness.harness.which_check_is_the_first", "{which}. CHECK is the first deployed mode (§2); deployed now: {deployed}; not yet: {waiting}. investigate-fresh enables only after CHECK's first live run is verified (VF-5/SK-4). This gate is a row in the control-flow table and never a sentence in the skill.", { which, deployed: "check, plan", waiting: "investigate, extract" });
  for (const mode of ["investigate", "extract"]) {
    const why = gateStep({ mode }).why;
    const which = localize("agent-harness.harness.mode_key_is_not_deployed", "mode '{key}' is not deployed yet — it is a row in this table ({does}), and enabling it is an EDIT to this file under review, never a request parameter", { key: mode, does: MODES[mode].does });
    assert.equal(why, gateWhy(which));
  }
  for (const mode of ["sorcery", "Check", ""]) {
    const why = gateStep({ mode }).why;
    const which = localize("agent-harness.harness.mode_v1_is_not_deployed", "mode '{v1}' is not deployed — it is no mode this table knows at all (the table holds: {keys})", { v1: mode || "(none)", keys: "check, investigate, extract, plan" });
    assert.equal(why, gateWhy(which));
  }
  assert.equal(gateStep({}).why, gateWhy(localize("agent-harness.harness.mode_v1_is_not_deployed", "mode '{v1}' is not deployed — it is no mode this table knows at all (the table holds: {keys})", { v1: "(none)", keys: "check, investigate, extract, plan" })));
});

/* ============================================================ R3: the stop and the pass limit */
test("R3: above every row after the gate, stopBecause asks fetches, subsessions, wallclock in that order; the first spent closes", () => {
  assert.deepEqual(BUDGET_BOUNDS, ["fetches", "subsessions", "wallclock"]);
  const all = { ...spent("fetches"), ...spent("subsessions"), ...spent("wallclock") };
  assert.equal(stopBecause({ budget: all, pass: 0, maxPasses: 3 }), "fetches");
  assert.equal(stopBecause({ budget: { ...all, fetches: { allowed: 2, consumed: 1 } }, pass: 0, maxPasses: 3 }), "subsessions");
  assert.equal(stopBecause({ budget: { wallclock: { allowed: 5, consumed: 9 } }, pass: 0, maxPasses: 3 }), "wallclock");
  /* consumed >= allowed: equal stops, one under does not */
  assert.equal(stopBecause({ budget: { fetches: { allowed: 4, consumed: 4 } }, pass: 0, maxPasses: 3 }), "fetches");
  assert.equal(stopBecause({ budget: { fetches: { allowed: 4, consumed: 3 } }, pass: 0, maxPasses: 3 }), null);
  /* a bound outside the three never stops a run from this table */
  assert.equal(stopBecause({ budget: { runtime: { allowed: 1, consumed: 9 }, lease: { allowed: 1, consumed: 9 } }, pass: 0, maxPasses: 3 }), null);
  /* and it is asked above every row after the gate */
  for (const step of Object.keys(CONTROL_FLOW).filter((s) => !["gate-mode", "close"].includes(s)))
    for (const bound of BUDGET_BOUNDS) {
      const d = nextStep({ step, mode: "check", pass: 0, maxPasses: 3, budget: spent(bound), queue: [{ name: "a" }], resumeAt: "fanout" });
      assert.deepEqual([d.step, d.bound], ["close", bound], `${step}/${bound}`);
      assert.equal(d.why, localize("agent-harness.harness.the_stopped_budget_is_spent", "the '{stopped}' budget is spent. §14b.6: when a bound stops a run, the log says WHICH bound and where", { stopped: bound }));
    }
});

test("R3: an absent or non-positive allowance never stops a run", () => {
  for (const row of [undefined, null, {}, { allowed: 0, consumed: 9 }, { allowed: -1, consumed: 9 }, { allowed: "x", consumed: 9 },
                     { consumed: 9 }, { allowed: null, consumed: 9 }])
    for (const bound of BUDGET_BOUNDS)
      assert.equal(stopBecause({ budget: { [bound]: row }, pass: 0, maxPasses: 3 }), null, `${bound} ${JSON.stringify(row)}`);
  assert.equal(stopBecause({ pass: 0, maxPasses: 3 }), null);
  assert.equal(stopBecause({ budget: null, pass: 0, maxPasses: 3 }), null);
});

test("R3: then pass count >= the pass limit closes `completed`; the limit is max_passes when positive, else 3", () => {
  assert.equal(DEFAULT_MAX_PASSES, 3);
  for (const [maxPasses, limit] of [[1, 1], [2, 2], [5, 5], [undefined, 3], [null, 3], [0, 3], [-2, 3], ["x", 3], ["4", 4]]) {
    assert.equal(passLimit(maxPasses), limit, `limit for ${JSON.stringify(maxPasses)}`);
    assert.equal(stopBecause({ pass: limit - 1, maxPasses }), null);
    assert.equal(stopBecause({ pass: limit, maxPasses }), "completed");
    assert.equal(stopBecause({ pass: limit + 1, maxPasses }), "completed");
  }
  /* a spent bound is named before the pass limit */
  assert.equal(stopBecause({ budget: spent("wallclock"), pass: 3, maxPasses: 3 }), "wallclock");
});

test("R3: a pass counts when it is done (next-pass): a driven run makes exactly the limit's passes", () => {
  for (const [maxPasses, passes] of [[1, 1], [2, 2], [undefined, 3], [0, 3]]) {
    const r = walk({ mode: "check", maxPasses, passAdded: true }, [], { newEachPass: true });
    assert.equal(r.bound, "completed");
    assert.equal(r.state.pass, passes);
    assert.equal(r.trace.filter((x) => x.startsWith("next-pass>")).length, passes);
    assert.equal(r.why, localize("agent-harness.harness.pass_of_passlimit_passes_are", "{pass} of {passLimit} passes are done; the loop's termination is the table's and not the model's", { pass: String(passes), passLimit: String(passes) }));
  }
  /* entering next-pass moves the counter; no other move does */
  assert.equal(advance({ step: "dedup", pass: 1 }, { step: "next-pass" }).pass, 2);
  for (const to of ["plan", "fanout", "collect", "compose", "dedup", "submit", "adjust", "close"])
    assert.equal(advance({ step: "resume", pass: 1 }, { step: to }).pass, 1);
});

/* ============================================================ R4: judgements */
test("R4: the judged rows are plan, collect, compose, dedup, adjust, and judgements are taken in order, one per judged row", () => {
  assert.deepEqual(Object.keys(CONTROL_FLOW).filter((s) => CONTROL_FLOW[s].judged), ["plan", "collect", "compose", "dedup", "adjust"]);
  /* one pass with four judgements: plan, collect, compose, dedup take them in order; no other row consumes one */
  const seen = [];
  const r = walk({ mode: "check", maxPasses: 1 }, [
    { targets: ["t"] }, { reports: [{ level: "meaning" }] }, { candidates: [{ name: "c" }] }, { queue: [] }]);
  for (const x of r.trace) seen.push(x.split(">")[0]);
  assert.equal(r.used, 4);
  assert.deepEqual([r.state.targets, r.state.reports, r.state.candidates, r.state.queue],
    [["t"], [{ level: "meaning" }], [{ name: "c" }], []]);
  assert.deepEqual(seen, ["gate-mode", "resume", "plan", "fanout", "collect", "compose", "dedup", "next-pass"]);
});

test("R4: a judged row with no judgement carries the state on", () => {
  const before = { step: "compose", pass: 0, maxPasses: 3, candidates: [{ name: "kept" }] };
  for (const j of [undefined, null, {}, "text", 7]) {
    const a = applyJudgement(before, j);
    assert.equal(a.ok, true);
    assert.deepEqual(a.state, before);
  }
  const r = walk({ mode: "check", maxPasses: 2, passAdded: true }, [], { newEachPass: true });
  assert.deepEqual([r.used, r.bound, r.state.pass], [0, "completed", 2]);
});

test("R4: a judgement naming pass, maxPasses, step, budget, mode, bound, run, store or target is refused, naming the fields", () => {
  assert.deepEqual(NOT_JUDGEABLE, ["pass", "maxPasses", "step", "budget", "mode", "bound", "run", "store", "target"]);
  for (const f of NOT_JUDGEABLE) {
    const a = applyJudgement({ pass: 0 }, { candidates: [], [f]: 1 });
    assert.deepEqual([a.ok, a.overreach, a.state], [false, [f], undefined]);
    assert.equal(typeof a.detail, "string");
    assert.ok(a.detail.includes(f));
  }
  const both = applyJudgement({}, { reports: [], target: "INQ-OTHER", mode: "x" });
  assert.deepEqual([both.ok, both.overreach], [false, ["target", "mode"]]);
  /* through a driven run: refused at the step that took it, nothing applied */
  const r = walk({ mode: "check", maxPasses: 3 }, [{ targets: [] }, { reports: [], target: "INQ-OTHER", mode: "x" }]);
  assert.deepEqual(r.refused, { step: "collect", fields: ["target", "mode"] });
  assert.equal(r.state.target, undefined);
});

test("R4: only targets, reports, candidates, queue, adjusted, submission, level, observed, governed, condition (and, at compose, disagreements, R19) are applied", () => {
  assert.deepEqual(JUDGEABLE, ["targets", "reports", "candidates", "queue", "adjusted", "submission", "level", "observed",
    "governed", "condition", "disagreements"]);
  const all = Object.fromEntries(JUDGEABLE.filter((k) => k !== "disagreements").map((k, i) => [k, `v${i}`]));
  const a = applyJudgement({ step: "plan", pass: 1 }, { ...all, whimsy: 2, bytes: "doc" });
  assert.equal(a.ok, true);
  assert.deepEqual(a.state, { step: "plan", pass: 1, ...all });
  /* the state handed in is not changed */
  const s = { pass: 0 };
  applyJudgement(s, { candidates: [1] });
  assert.deepEqual(s, { pass: 0 });
});

/* ============================================================ R5: the report contract */
const good = { level: "document", state: "PRESENT", observed_at: "log:7", summary: "s", citations: [{ address: "a" }] };

test("R5: a report has only level, state, observed_at, summary, citations, governed, condition; level and state required", () => {
  assert.deepEqual(Object.keys(REPORT_KEYS), ["level", "state", "observed_at", "summary", "citations", "governed", "condition"]);
  assert.deepEqual(Object.keys(REPORT_KEYS).filter((k) => REPORT_KEYS[k]), ["level", "state"]);
  assert.deepEqual(Object.keys(CITATION_KEYS), ["address"]);
  assert.equal(checkReport(good), null);
  assert.equal(checkReport({ ...good, governed: true, condition: "host-held" }), null);
  for (const extra of ["bytes", "body", "raw", "text", "description", "documents"]) {
    const r = checkReport({ ...good, [extra]: "x" });
    assert.deepEqual([r.code, r.fields], ["REPORT_UNKNOWN_FIELD", [extra]]);
  }
  assert.deepEqual(checkReport({ level: "meaning" }).fields, ["state"]);
  assert.deepEqual(checkReport({ state: "PRESENT" }).fields, ["level"]);
  assert.deepEqual(checkReport({ level: "", state: null }).fields, ["level", "state"]);
});

test("R5: level is one of the four, state one of the five", () => {
  assert.deepEqual(LEVELS, ["meaning", "content", "document", "internet"]);
  assert.deepEqual(Object.keys(REPORT_STATES), ["NEVER_LOOKED", "LOOKED_ABSENT", "LOOKED_INDETERMINATE", "PRESENT", "partial"]);
  for (const level of LEVELS) assert.equal(checkReport({ ...good, level }), null);
  for (const state of Object.keys(REPORT_STATES)) assert.equal(checkReport({ ...good, state }), null);
  for (const level of ["documents", "Meaning", "gossip"]) assert.equal(checkReport({ ...good, level }).code, "REPORT_LEVEL_UNKNOWN");
  for (const state of ["FOUND", "present", "ABSENT"]) assert.equal(checkReport({ ...good, state }).code, "REPORT_STATE_UNKNOWN");
});

test("R5: every state but NEVER_LOOKED needs observed_at; PRESENT and partial need a citation", () => {
  for (const state of ["LOOKED_ABSENT", "LOOKED_INDETERMINATE", "PRESENT", "partial"])
    for (const observed_at of [undefined, "", "  ", 7])
      assert.equal(checkReport({ level: "meaning", state, observed_at, citations: [{ address: "a" }] }).code, "REPORT_UNLOCATED");
  assert.equal(checkReport({ level: "meaning", state: "NEVER_LOOKED" }), null);
  assert.equal(checkReport({ level: "meaning", state: "LOOKED_ABSENT", observed_at: "l" }), null);
  assert.equal(checkReport({ level: "meaning", state: "LOOKED_INDETERMINATE", observed_at: "l" }), null);
  for (const state of ["PRESENT", "partial"])
    for (const citations of [undefined, null, []])
      assert.equal(checkReport({ level: "meaning", state, observed_at: "l", citations }).code, "REPORT_NO_CITATION");
});

test("R5: at most 20 citations, each exactly {address}, non-empty, at most 200 characters", () => {
  const n = (k, len = 1) => Array.from({ length: k }, (_, i) => ({ address: String(i).padEnd(len, "x") }));
  assert.equal(checkReport({ ...good, citations: n(CITATIONS_MAX, ADDRESS_MAX) }), null);
  assert.equal(CITATIONS_MAX, 20);
  assert.equal(ADDRESS_MAX, 200);
  const over = checkReport({ ...good, citations: n(21) });
  assert.deepEqual([over.code, over.bound, over.limit, over.got], ["REPORT_OVER_BOUND", "citations", 20, 21]);
  const long = checkReport({ ...good, citations: [{ address: "a".repeat(201) }] });
  assert.deepEqual([long.code, long.bound], ["REPORT_OVER_BOUND", "address"]);
  for (const c of [{ address: "a", text: "x" }, { address: "" }, { address: "   " }, { address: 7 }, {}, "a", null, ["a"]])
    assert.equal(checkReport({ ...good, citations: [c] }).code, "REPORT_CITATION_NOT_AN_ADDRESS", JSON.stringify(c));
  assert.equal(checkReport({ ...good, citations: "a" }).code, "REPORT_CITATIONS_NOT_A_LIST");
});

test("R5: summary a string of at most 500; the whole at most REPORT_MAX_BYTES", () => {
  assert.equal(SUMMARY_MAX, 500);
  assert.equal(checkReport({ ...good, summary: "s".repeat(500) }), null);
  const over = checkReport({ ...good, summary: "s".repeat(501) });
  assert.deepEqual([over.code, over.bound], ["REPORT_OVER_BOUND", "summary"]);
  for (const summary of [{ pages: [] }, ["a"], 7]) assert.equal(checkReport({ ...good, summary }).code, "REPORT_SUMMARY_NOT_PROSE");
  /* the whole-report ceiling, reached through a field the per-field bounds do not cover */
  assert.equal(REPORT_MAX_BYTES, SUMMARY_MAX + CITATIONS_MAX * (ADDRESS_MAX + 20) + 400);
  const big = checkReport({ ...good, condition: "c".repeat(REPORT_MAX_BYTES) });
  assert.deepEqual([big.code, big.bound, big.limit], ["REPORT_OVER_BOUND", "report", REPORT_MAX_BYTES]);
  /* the largest report the field bounds allow still fits */
  assert.equal(checkReport({ ...good, summary: "s".repeat(500), citations: Array.from({ length: 20 }, (_, i) => ({ address: String(i).padEnd(200, "x") })),
                             governed: false, condition: "runtime-ceiling-reached" }), null);
});

test("R5: each breach is refused by its own code, as a refusal {ok:false, reason, code, detail}", () => {
  const cases = [
    [null, "REPORT_NOT_AN_OBJECT"], [[good], "REPORT_NOT_AN_OBJECT"], ["report", "REPORT_NOT_AN_OBJECT"],
    [{ ...good, bytes: "x" }, "REPORT_UNKNOWN_FIELD"],
    [{ state: "PRESENT" }, "REPORT_INCOMPLETE"],
    [{ ...good, level: "gossip" }, "REPORT_LEVEL_UNKNOWN"],
    [{ ...good, state: "FOUND" }, "REPORT_STATE_UNKNOWN"],
    [{ ...good, observed_at: undefined }, "REPORT_UNLOCATED"],
    [{ ...good, citations: [] }, "REPORT_NO_CITATION"],
    [{ ...good, citations: {} }, "REPORT_CITATIONS_NOT_A_LIST"],
    [{ ...good, citations: [{ address: "a", bytes: "x" }] }, "REPORT_CITATION_NOT_AN_ADDRESS"],
    [{ ...good, summary: "s".repeat(501) }, "REPORT_OVER_BOUND"],
    [{ ...good, summary: {} }, "REPORT_SUMMARY_NOT_PROSE"],
  ];
  for (const [report, code] of cases) {
    const r = checkReport(report);
    assert.equal(r.ok, false);
    assert.equal(r.code, code, JSON.stringify(report)?.slice(0, 80));
    assert.equal(r.reason, r.code);
    assert.equal(typeof r.detail, "string");
  }
});

/* ============================================================ R6: mode plan's table */
test("R6: PLAN_FLOW's rows are gate-mode, resume, read, compose, dedup, submit, adjust, close, held beside CONTROL_FLOW", () => {
  assert.deepEqual(Object.keys(PLAN_FLOW), ["gate-mode", "resume", "read", "compose", "dedup", "submit", "adjust", "close"]);
  assert.equal(flowFor("plan"), PLAN_FLOW);
  for (const mode of ["check", "investigate", "extract", "", undefined, "Plan"]) assert.equal(flowFor(mode), CONTROL_FLOW);
  for (const [row, r] of Object.entries(PLAN_FLOW)) for (const to of r.to) assert.ok(to in PLAN_FLOW, `${row} -> ${to}`);
  assert.equal(PLAN_FLOW.compose.to.includes("submit"), false);
});

test("R6: it has no fanout: no row and no edge names fanout, collect or next-pass, and its reads are none of airunspawn, capturerequest, suggest", () => {
  const rows = Object.keys(PLAN_FLOW), edges = Object.values(PLAN_FLOW).flatMap((r) => r.to);
  for (const absent of ["fanout", "collect", "next-pass", "plan"]) {
    assert.equal(rows.includes(absent), false);
    assert.equal(edges.includes(absent), false);
  }
  const subjects = [{ kind: "outcome", determination: "D", standard: "S" }, { kind: "inquiry", inquiry: "I", standards: ["S2"] }, { kind: "x" }];
  const ops = [PLAN_READS.plan("P"), PLAN_READS.plans("J"), PLAN_READS.profile(), ...subjects.flatMap((s) => PLAN_READS.subject(s))]
    .map((r) => r.op);
  /* exactly the reads R6's table makes (that each is a declared read is agent-worker's, its R37 over its own `ops.mjs`) */
  assert.deepEqual([...new Set(ops)].sort(), ["availableactions", "consequencesof", "determination", "plan", "plans",
    "profiles", "publishededitions", "standard"]);
  /* R6's own words: it calls no airunspawn, capturerequest or suggest */
  for (const op of ops)
    assert.ok(!["airunspawn", "capturerequest", "suggest"].includes(op), op);
});

test("R6: nextPlanStep never leaves a row's declared steps, and a refusal goes to adjust, never back to submit", () => {
  const escapes = [];
  for (const step of [...Object.keys(PLAN_FLOW), undefined])
    for (const mode of ["plan", "check", "nosuch"])
      for (const q of [[], [{ summary: "a" }], [{ summary: "a" }, { summary: "b" }]])
        for (const refusal of [null, { code: "R" }])
          for (const adjusted of [false, true])
            for (const pass of [0, 1])
              for (const budget of [{}, spent("proposals"), spent("wallclock"), spent("fetches")])
                for (const resumeAt of [null, "dedup", "compose", "submit", "fanout"]) {
                  const at = step ?? FIRST_STEP;
                  const d = nextPlanStep({ step, mode, queue: q, refusal, adjusted, pass, budget, resumeAt });
                  if (at === "close" ? d.step !== "close" : !PLAN_FLOW[at].to.includes(d.step)) escapes.push(`${at}->${d.step}`);
                }
  assert.deepEqual([...new Set(escapes)], []);
  assert.equal(nextPlanStep({ step: "submit", pass: 0, refusal: { code: "X" }, queue: [{ summary: "a" }] }).step, "adjust");
});

test("R6: one pass (the pass limit is 1), and stopBecause asks proposals then wallclock", () => {
  assert.equal(PLAN_MAX_PASSES, 1);
  assert.deepEqual(PLAN_BUDGET_BOUNDS, ["proposals", "wallclock"]);
  assert.equal(planStopBecause({ budget: { ...spent("proposals"), ...spent("wallclock") }, pass: 0 }), "proposals");
  assert.equal(planStopBecause({ budget: spent("wallclock"), pass: 0 }), "wallclock");
  assert.equal(planStopBecause({ budget: { ...spent("fetches"), ...spent("subsessions") }, pass: 0 }), null);
  assert.equal(planStopBecause({ pass: 1, maxPasses: 5 }), "completed");
  for (const step of ["resume", "read", "compose", "dedup", "submit", "adjust"])
    assert.deepEqual(nextPlanStep({ step, pass: 1 }).bound, "completed");
  /* a plan run walks its one pass and closes completed */
  const r = walk({ mode: "plan" }, [], { flow: PLAN_FLOW });
  assert.deepEqual([r.trace, r.bound, r.state.pass],
    [["gate-mode>resume", "resume>read", "read>compose", "compose>dedup", "dedup>close"], "completed", 1]);
  /* with a queue, one at a time until none remain (the shell takes each off the head as it submits), then the pass is done */
  assert.equal(nextPlanStep({ mode: "plan", step: "dedup", pass: 0, queue: [{ summary: "a" }] }).step, "submit");
  assert.equal(nextPlanStep({ mode: "plan", step: "submit", pass: 0, queue: [{ summary: "b" }] }).step, "submit");
  const last = nextPlanStep({ mode: "plan", step: "submit", pass: 0, queue: [] });
  assert.deepEqual([last.step, last.bound, planAdvance({ step: "submit", pass: 0 }, last).pass], ["close", "completed", 1]);
});

/* ============================================================ R10: plan deployed, agreeing with run-rules */
test("R10: MODES.plan is deployed, check stays deployed, investigate and extract stay as they are", () => {
  assert.deepEqual(Object.entries(MODES).map(([k, m]) => [k, m.deployed]),
    [["check", true], ["investigate", false], ["extract", false], ["plan", true]]);
  assert.equal(MODES.plan.does, localize("agent-harness.harness.mode_plan_does", "propose options to one action plan, strongest first, through op=optionpropose; it decides, starts, prepares and sends nothing (BIO_Action_v0_1.md §4)"));
  /* the gate lets a plan-mode run through, on either table, and the run walks PLAN_FLOW */
  for (const flow of [CONTROL_FLOW, PLAN_FLOW]) {
    const d = (flow === PLAN_FLOW ? nextPlanStep : nextStep)({ mode: "plan", pass: 0 });
    assert.deepEqual([d.step, d.bound], ["resume", undefined]);
  }
  assert.equal(flowFor("plan"), PLAN_FLOW);
  assert.equal(walk({ mode: "plan" }, [], { flow: PLAN_FLOW }).bound, "completed");
});

test("R10: the harness's copy agrees with run-rules R14: every run mode deployed here exactly when DEPLOYED_MODES holds it", () => {
  /* the modes this table holds are exactly the modes a run may be in (run-rules' RUN_MODES, its order) */
  assert.deepEqual(Object.keys(MODES), [...RUN_MODES]);
  const disagree = Object.keys(MODES).filter((m) => MODES[m].deployed !== DEPLOYED_MODES.includes(m));
  assert.deepEqual(disagree, [], "the harness's MODES and run-rules' DEPLOYED_MODES disagree on these modes");
  assert.deepEqual(DEPLOYED_MODES.filter((m) => RUN_MODES.includes(m)),
    Object.entries(MODES).filter(([, m]) => m.deployed).map(([k]) => k));
  /* and the gate answers each run mode as run-rules does */
  for (const mode of RUN_MODES)
    assert.equal(gateStep({ mode }).bound === "mode-not-deployed", !DEPLOYED_MODES.includes(mode), mode);
});

/* ============================================================ R7: one sub-session per level */
const payload = { run: "RUN-1", context: { type: "inquiry", id: "INQ-1" }, mode: "check", skill: "s@1",
                  standard_pair: { a: 1 }, standard: { in_force: true, basis: "b", stated: "st", pair: "p", extra: "x" },
                  budget: [], manifest_like: "never copied" };

test("R7: sub-sessions run one per level, all four in LEVELS order, each under its own spawn contract", () => {
  const made = spawnContracts(payload);
  assert.equal(made.ok, true);
  assert.deepEqual(made.contracts.map((c) => c.level), LEVELS);
  for (const c of made.contracts) {
    assert.deepEqual(Object.keys(c), SPAWN_KEYS);
    assert.deepEqual(c.scope, SUBSESSION_OPS);
    assert.deepEqual(c.scope, ["meaningrows"]);
    /* R12: no subjects and no arms unless the payload or the caller gives them */
    assert.deepEqual(c.subjects, []);
    assert.deepEqual(c.arms, []);
    assert.deepEqual(c.standard, { in_force: true, basis: "b", stated: "st", pair: "p" });
    assert.ok(Object.isFrozen(c) && Object.isFrozen(c.context) && Object.isFrozen(c.returns));
  }
  /* no two share an object */
  assert.equal(new Set(made.contracts.map((c) => c.context)).size, 4);
  assert.equal(new Set(made.contracts.map((c) => c.returns)).size, 4);
  assert.equal(spawnContract({ level: "documents", payload }).code, "SPAWN_LEVEL_UNKNOWN");
  assert.equal(spawnContracts(null).code, "SPAWN_PAYLOAD_MISSING");
  assert.equal(spawnContracts({ ...payload, bias: {} }).code, "SPAWN_PAYLOAD_CARRIES_LENS");
});

test("R7: each returns only reports: the contract it is briefed with is R5's, and only returns that honour it are taken", () => {
  const { contracts } = spawnContracts(payload);
  for (const c of contracts)
    assert.deepEqual(c.returns, {
      keys: Object.keys(REPORT_KEYS), required: ["level", "state"], citation_keys: ["address"],
      states: Object.keys(REPORT_STATES), summary_max: SUMMARY_MAX, conditions: Object.keys(CONDITION_KINDS),
      citations_max: CITATIONS_MAX, address_max: ADDRESS_MAX,
      rule: localize("agent-harness.subsession.return_a_report_with_a", "return a REPORT with a citation, never documents. The parent re-reads by address.") });
  const returns = [good, { level: "content", state: "LOOKED_ABSENT", observed_at: "log:2", text: "the document" }, "bytes",
                   { level: "internet", state: "NEVER_LOOKED" }];
  const { taken, refused } = takeReports(returns);
  assert.deepEqual(taken, [good, { level: "internet", state: "NEVER_LOOKED" }]);
  assert.deepEqual(refused.map((r) => [r.level, r.code]), [["content", "REPORT_UNKNOWN_FIELD"], [null, "REPORT_NOT_AN_OBJECT"]]);
  /* a refused return never becomes an absence */
  assert.equal(taken.some((r) => r.level === "content"), false);
  assert.deepEqual(takeReports(undefined), { taken: [], refused: [] });
});

/* ============================================================ R8: pure */
/* Arguments for each exported function. Every function export must have a row, so a new export is tested here. */
const ARGS = {
  adjustedFrom: [{ a: 1 }, { a: 2 }], advance: [{ step: "dedup", pass: 1, submission: { a: 1 } }, { step: "next-pass" }],
  applyJudgement: [{ step: "plan" }, { targets: ["t"] }], applyPlanJudgement: [{ step: "compose" }, { candidates: [{ summary: "s" }] }],
  canonical: [{ b: [1, { c: 2 }], a: null }], earlierPlans: [{ plans: [{ id: "P1", project: "J" }, { id: "P2", project: "K" }] }, "J", "P0"],
  emptyLevelCandidates: [{ reports: [{ level: "document", state: "LOOKED_ABSENT", observed_at: "log:1", summary: "none" }],
                          scope: { document: { reads: 1, documents: 3 } } }, "INQ-1"],
  levelsWithoutScope: [{ reports: [{ level: "content", state: "LOOKED_ABSENT" }], scope: { content: { reads: 1, documents: 0 } } }],
  disagreementsToSettle: [{ disagreements: [{ record: "REC-1", levels: ["meaning", "content"] }], disagreed: [] }],
  disagreementKey: [{ record: "REC-1", levels: ["content", "meaning"] }],
  flowFor: ["plan"], gateStep: [{ mode: "investigate" }], nextPlanStep: [{ step: "dedup", pass: 0, queue: [{ summary: "a" }] }],
  nextStep: [{ step: "submit", pass: 0, maxPasses: 3, refusal: { code: "X" } }], passLimit: [0],
  planAdvance: [{ step: "dedup", pass: 0 }, { step: "close", pass_done: true }], planDedup: [[{ summary: "a" }, { summary: "a" }], { options: [] }],
  planStopBecause: [{ budget: spent("proposals") }], planSubjectReads: [{ subjects: [{ subject: { kind: "outcome", determination: "D", standard: "S" } }] }],
  proposalKey: [{ summary: "a", category: "legal", subjects: [] }], publishableState: [{ step: "submit", pass: 0, queue: ["x".repeat(100)] }, 50],
  resumableState: [{ step: "plan", pass: 1, extra: 1 }], resumeFrom: [{ step: "collect", pass: 1, reports: [] }], resumeTargets: [PLAN_FLOW],
  runContextTarget: [{ context: { type: "project", id: "P", questions: ["INQ-1"] } }], stateBytes: [{ a: "é" }],
  stepLog: [{ step: "collect", observed: "PRESENT", level: "meaning" }, { step: "compose", why: "w" }],
  stopBecause: [{ pass: 3 }], whyWithUndetermined: ["because", [{ op: "standard", id: "S", code: "X" }]],
  checkReport: [{ ...good, bytes: "x" }], citedAddresses: [[good, good]],
  documentHoldings: [[{ citation: "c", bundle: "b1", chain: { address_norm: "a", total: 2, versions: [{ bundle_id: "b1" }] } },
                      { citation: "d", refused: { code: "X" } }]],
  holdingsNote: [{ documents: 1, citations: 2, versions_cited: 1, versions_held: 2, unchained: 0, undetermined: 1 }],
  spawnContract: [{ level: "meaning", payload: { ...payload, subjects: { items: [{ id: "R-1", extent: "¶2", kind: "leg" }] } },
                    arms: ["leg"], targets: [{ id: "R-2", extent: null }] }], spawnContracts: [payload], takeReports: [[good, { bytes: 1 }]],
};

test("R8: every export is pure: equal arguments give equal answers, with no network, clock or randomness reached", () => {
  const fns = [...Object.entries(HARNESS), ...Object.entries(SUBSESSION)].filter(([, v]) => typeof v === "function");
  assert.deepEqual(fns.map(([k]) => k).filter((k) => !(k in ARGS)), [], "every function export has a row");
  const real = { fetch: globalThis.fetch, now: Date.now, random: Math.random };
  const called = [];
  globalThis.fetch = () => { called.push("fetch"); throw new Error("fetch called"); };
  Date.now = () => { called.push("Date.now"); throw new Error("Date.now called"); };
  Math.random = () => { called.push("Math.random"); throw new Error("Math.random called"); };
  try {
    for (const [name, fn] of fns) {
      const first = fn(...structuredClone(ARGS[name]));
      const second = fn(...structuredClone(ARGS[name]));
      assert.deepEqual(second, first, `${name} answers the same twice`);
      assert.deepEqual(fn(...structuredClone(ARGS[name])), first, `${name} keeps nothing between calls`);
    }
  } finally {
    globalThis.fetch = real.fetch; Date.now = real.now; Math.random = real.random;
  }
  assert.deepEqual(called, []);
});

test("R8: the module reads no binding, environment or storage: every export runs with each of those globals throwing", () => {
  /* the exports take everything as arguments; the only globals either file reaches are JSON, Object, Array, Number,
     String, Set, Map, TextEncoder and Math (none of them state) */
  const touched = [];
  for (const name of ["process", "localStorage", "caches", "navigator", "crypto", "performance"]) {
    const had = Object.getOwnPropertyDescriptor(globalThis, name);
    try {
      Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); throw new Error(`${name} read`); } });
      for (const [fname, fn] of [...Object.entries(HARNESS), ...Object.entries(SUBSESSION)].filter(([, v]) => typeof v === "function"))
        fn(...structuredClone(ARGS[fname]));
    } finally {
      if (had) Object.defineProperty(globalThis, name, had); else delete globalThis[name];
    }
  }
  assert.deepEqual(touched, []);
});

/* ============================================================ R9: none of agent-worker's declarations */
test("R9: no file of this module exports PLANE_OPS, NAMESPACES or MEANING_ARM (they are agent-worker's, in its ops.mjs)", async () => {
  const dir = new URL("../src/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort();
  assert.deepEqual(files, ["harness.mjs", "subsession.mjs"]);
  const found = [];
  for (const f of files) {
    const mod = await import(new URL(f, dir));
    for (const name of ["PLANE_OPS", "NAMESPACES", "MEANING_ARM"]) if (name in mod) found.push(`${f}: ${name}`);
  }
  assert.deepEqual(found, []);
});

/* ============================================================ R11: the contract's condition kinds */
test("R11: a contract's returns.conditions is non-empty, in the vocabulary's fixed order, and each kind passes checkCondition", () => {
  const { contracts } = spawnContracts(payload);
  for (const c of contracts) {
    assert.ok(Array.isArray(c.returns.conditions) && c.returns.conditions.length > 0, "conditions is a non-empty list");
    assert.deepEqual(c.returns.conditions, Object.keys(CONDITION_KINDS));
    for (const kind of c.returns.conditions) assert.equal(checkCondition(kind), null, kind);
  }
  /* the same list the plane's own checker admits: every kind, and only those, passes it */
  assert.deepEqual(spawnContract({ level: "meaning", payload }).contract.returns.conditions, Object.keys(CONDITION_KINDS));
});

test("R11: control: a kind outside the vocabulary is not offered in returns.conditions, and checkCondition refuses it", () => {
  const { contracts } = spawnContracts(payload);
  for (const word of ["not-a-condition", "host-held", "CAPTURE_COMPLETED", " monitoring-recheck-due"]) {
    assert.equal(contracts[0].returns.conditions.includes(word), false, word);
    const refused = checkCondition(word);
    assert.deepEqual([refused.ok, refused.code], [false, "AI_RUN_CONDITION_UNKNOWN"], word);
  }
});

/* ============================================================ R12: the contract's subjects and arms */
const twoSubjects = { ...payload, subjects: { items: [{ id: "REC-1", extent: "¶3", kind: "leg" }, { id: "REC-2", extent: null, kind: "cited" }] } };

test("R12: spawnContract carries subjects (the payload's items, then the level's targets) and arms, after scope: two subjects and one target give three, in that order, frozen", () => {
  const made = spawnContract({ level: "content", payload: twoSubjects, arms: ["leg", "passage"],
                               targets: [{ id: "INFO-3", extent: "¶1" }] });
  assert.equal(made.ok, true);
  const c = made.contract;
  assert.deepEqual(Object.keys(c).slice(Object.keys(c).indexOf("scope"), Object.keys(c).indexOf("scope") + 3),
    ["scope", "subjects", "arms"]);
  assert.deepEqual(c.subjects, [
    { id: "REC-1", extent: "¶3", kind: "leg" },
    { id: "REC-2", extent: null, kind: "cited" },
    { id: "INFO-3", extent: "¶1", kind: "target" },
  ]);
  assert.deepEqual(c.arms, ["leg", "passage"]);
  assert.ok(Object.isFrozen(c.subjects) && Object.isFrozen(c.subjects[0]) && Object.isFrozen(c.arms));
});

test("R12: control: a duplicate of a subject among the targets appears once, and absent subjects, targets or arms give an empty list", () => {
  const dup = spawnContract({ level: "meaning", payload: twoSubjects, arms: ["leg"],
                              targets: [{ id: "REC-1", extent: "¶3" }, { id: "REC-1", extent: "¶4" }] });
  assert.deepEqual(dup.contract.subjects.map((s) => [s.id, s.extent, s.kind]),
    [["REC-1", "¶3", "leg"], ["REC-2", null, "cited"], ["REC-1", "¶4", "target"]]);
  const bare = spawnContract({ level: "meaning", payload });
  assert.deepEqual([bare.contract.subjects, bare.contract.arms], [[], []]);
  const absent = spawnContract({ level: "meaning", payload, arms: null, targets: "not a list" });
  assert.deepEqual([absent.contract.subjects, absent.contract.arms], [[], []]);
  /* the payload is read key by key: a stray key on an item does not ride into the brief */
  const stray = spawnContract({ level: "meaning", payload: { ...payload, subjects: { items: [{ id: "X", extent: null, kind: "leg", secret: "s" }] } } });
  assert.deepEqual(stray.contract.subjects, [{ id: "X", extent: null, kind: "leg" }]);
});

test("R12: at most 50 subjects, the first 50 in order, and the list is held by value per contract", () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ id: `S-${i}`, extent: null, kind: "leg" }));
  const made = spawnContracts({ ...payload, subjects: { items } });
  assert.equal(made.contracts[0].subjects.length, 50);
  assert.equal(made.contracts[0].subjects[49].id, "S-49");
  assert.notEqual(made.contracts[0].subjects, made.contracts[1].subjects);
});

/* R18: a scope in which each named level was read once and held documents (the plane's four-level statement, set by the shell) */
const scopeOf = (levels, documents = 3) => Object.fromEntries(levels.map((l) => [l, { reads: 1, documents }]));

/* ============================================================ R13: the empty-level description */
test("R13: an empty-level candidate's description names the target as \"this question\", never its record id", () => {
  const state = { reports: [{ level: "document", state: "LOOKED_ABSENT", observed_at: "log:4", summary: "none" }], scope: scopeOf(LEVELS) };
  const [made] = HARNESS.emptyLevelCandidates(state, "INQ-2026-0042");
  assert.equal(made.target, "INQ-2026-0042");
  assert.equal(made.description, localize("agent-harness.harness.this_run_searched_the_reported", "this run searched the {reported} level of this question and found nothing supportable there; the search that establishes it is written in the run's observation log at {String}.", { reported: "documents", String: "log:4" }));
  assert.equal(made.description.includes("INQ-2026-0042"), false);
});

test("R13: control: the name stays level-empty-<level> for every empty level, and each description still says where its search is written", () => {
  const levels = ["meaning", "content", "document", "internet"];
  const reports = levels.map((level) => ({ level, state: "LOOKED_ABSENT", observed_at: `log:${level}`, summary: "" }));
  const made = HARNESS.emptyLevelCandidates({ reports, scope: scopeOf(LEVELS) }, "INQ-2026-0042");
  assert.deepEqual(made.map((c) => c.name), ["level-empty-meaning", "level-empty-content", "level-empty-documents", "level-empty-internet"]);
  made.forEach((c, i) => assert.ok(c.description.includes(reports[i].observed_at), c.name));
});

test("R14: an empty-level candidate's description holds neither a record id nor the sub-session's summary", () => {
  const summary = "nothing in INQ-2026-0002 or INFO-2026-0006-council-minutes";
  const state = { reports: LEVELS.map((level) => ({ level, state: "LOOKED_ABSENT", observed_at: `log:${level}`, summary })),
                  scope: scopeOf(LEVELS) };
  const made = HARNESS.emptyLevelCandidates(state, "INQ-2026-0002");
  assert.equal(made.length, LEVELS.length);
  for (const c of made) {
    assert.equal(/INQ-\d|INFO-\d/.test(c.description), false, c.name);
    assert.equal(c.description.includes("The sub-session reported"), false, c.name);
    assert.equal(c.description.includes("council-minutes"), false, c.name);
  }
});

test("R14: control: the name stays level-empty-<level> and the report's summary is left untouched in the state", () => {
  const reports = [{ level: "internet", state: "LOOKED_ABSENT", observed_at: "log:9", summary: "see INQ-2026-0002" }];
  const [made] = HARNESS.emptyLevelCandidates({ reports, scope: scopeOf(LEVELS) }, "INQ-2026-0002");
  assert.equal(made.name, "level-empty-internet");
  assert.equal(reports[0].summary, "see INQ-2026-0002");
});

/* ============================================================ R15: a pass that adds nothing closes the run */
test("R15: a pass whose candidates are all dropped as held closes before the next pass, and the close says why", () => {
  /* composed candidates, every one dropped by dedup: the queue is empty, so dedup goes to next-pass and no submit ran */
  const r = walk({ mode: "check", maxPasses: 3 }, [{ targets: ["t"] }, { reports: [] }, { candidates: [{ name: "held" }] }, { queue: [] }]);
  assert.equal(r.bound, "completed");
  assert.equal(r.state.pass, 1);
  assert.deepEqual(r.trace.filter((x) => x.startsWith("next-pass>")), ["next-pass>close"]);
  const addedNothing = localize("agent-harness.harness.pass_pass_added_no_new", "pass {pass} added no new candidate (each one composed was already held, or none was composed); a further pass would find nothing the record does not hold, so the run closes", { pass: "1" });
  assert.equal(r.why, addedNothing);
  /* a pass that composed none closes the same way */
  const none = walk({ mode: "check", maxPasses: 3 });
  assert.deepEqual([none.bound, none.state.pass], ["completed", 1]);
  assert.equal(none.why, addedNothing);
});

test("R15: control: a pass that submits a new candidate goes on to the next pass, below maxPasses", () => {
  /* the walk never writes, so drive dedup > submit > next-pass by hand */
  let s = { step: "dedup", pass: 0, maxPasses: 3, mode: "check", queue: [{ name: "new" }] };
  let d = nextStep(s);
  assert.equal(d.step, "submit");
  s = advance(s, d);
  assert.equal(s.passAdded, true);
  s = { ...s, queue: [] };
  d = nextStep(s);
  assert.equal(d.step, "next-pass");
  s = advance(s, d);
  d = nextStep(s);
  assert.deepEqual([d.step, s.pass], ["plan", 1]);
  s = advance(s, d);
  assert.equal(s.passAdded, false, "the next pass starts with none added");
});

test("R15: control: passAdded survives a segment break and a restart under the state ceiling", () => {
  const s = { step: "next-pass", pass: 1, passAdded: true };
  assert.equal(HARNESS.resumableState(s).passAdded, true);
  assert.equal(HARNESS.resumeFrom(HARNESS.resumableState(s)).state.passAdded, true);
  const big = { ...s, queue: ["x".repeat(500)] };
  const pub = HARNESS.publishableState(big, 100);
  assert.deepEqual([pub.restarted.at, pub.state.passAdded], ["next-pass", true]);
});

/* ============================================================ R16: a run that wrote nothing never closes completed */
test("R16: composed 1, written 0, at the last pass: the close is not completed and names the reason", () => {
  /* the pass limit closes (pass 1 of 1) with one candidate composed and sent to be written, none written */
  const s = { step: "next-pass", pass: 1, maxPasses: 1, mode: "check", composed: 1, kept: 1, wrote: 0, passAdded: true };
  const d = nextStep(s);
  assert.equal(d.step, "close");
  assert.notEqual(d.bound, "completed");
  assert.equal(d.bound, "nothing-written");
  assert.equal(d.reason, localize("agent-harness.harness.nothing_written_composed_candidate_s", "nothing written: {composed} candidate(s) composed, {kept} sent to be written, none written{v1}", { composed: "1", kept: "1", v1: "" }));
  assert.ok(d.why.includes(d.reason), "the close's why carries the reason");
  /* the same, driven as the shell drives it: compose one, keep it, the plane refuses it, the adjust drops it */
  let w = { step: "compose", pass: 0, maxPasses: 1, mode: "check", candidates: [{ name: "c" }] };
  w = advance(w, nextStep(w));
  w = advance({ ...w, queue: [{ name: "c" }] }, nextStep({ ...w, queue: [{ name: "c" }] }));
  w = advance({ ...w, queue: [], refusal: { code: "X" }, submission: { name: "c" } }, { step: "adjust" });
  w = advance({ ...w, adjusted: false }, nextStep({ ...w, adjusted: false, queue: [] }));
  const last = nextStep(w);
  assert.deepEqual([w.step, last.step, last.bound, w.composed, w.kept, w.wrote ?? 0], ["next-pass", "close", "nothing-written", 1, 1, 0]);
  /* the shell's own list of what it wrote, empty, says the same */
  assert.equal(nextStep({ ...s, wrote: undefined, written: [] }).bound, "nothing-written");
});

test("R16: control: a run that wrote something, or whose candidates were all held already, still closes completed", () => {
  const base = { step: "next-pass", pass: 1, maxPasses: 1, mode: "check", passAdded: true };
  /* one written */
  assert.equal(nextStep({ ...base, composed: 1, kept: 1, wrote: 1 }).bound, "completed");
  assert.equal(nextStep({ ...base, composed: 1, kept: 1, written: [{ name: "c" }] }).bound, "completed");
  /* composed and every one dropped by dedup as already held: nothing was lost */
  assert.equal(nextStep({ ...base, composed: 2, kept: 0, wrote: 0 }).bound, "completed");
  /* composed none */
  assert.equal(nextStep({ ...base, composed: 0 }).bound, "completed");
  /* a budget bound is not rewritten */
  assert.equal(nextStep({ ...base, composed: 1, kept: 1, budget: spent("fetches") }).bound, "fetches");
});

test("R16: control: advance counts composed, kept and written, and the counts survive a segment break", () => {
  let s = { step: "compose", pass: 0, candidates: [{ name: "a" }, { name: "b" }] };
  s = advance(s, nextStep(s));
  s = { ...s, queue: [{ name: "a" }] };
  s = advance(s, { step: "submit" });
  assert.deepEqual([s.composed, s.kept, s.wrote ?? 0], [2, 1, 0]);
  s = { ...s, step: "submit", queue: [], submission: { name: "a" }, refusal: null };
  s = advance(s, { step: "next-pass" });
  assert.equal(s.wrote, 1);
  const back = HARNESS.resumeFrom(HARNESS.resumableState({ ...s, step: "next-pass" })).state;
  assert.deepEqual([back.composed, back.kept, back.wrote], [2, 1, 1]);
});

/* ============================================================ R18: no absence for a level with nothing in scope */
const absent = (level) => ({ level, state: "LOOKED_ABSENT", observed_at: `log:${level}`, summary: "" });

test("R18: content reported empty with documents 0 and document reported empty with documents 3 give the one level-empty-documents candidate", () => {
  const state = { reports: [absent("content"), absent("document")],
                  scope: { content: { reads: 1, documents: 0 }, document: { reads: 2, documents: 3 } } };
  assert.deepEqual(HARNESS.emptyLevelCandidates(state, "INQ-1").map((c) => c.name), ["level-empty-documents"]);
  const without = HARNESS.levelsWithoutScope(state);
  assert.deepEqual(without.map((x) => x.level), ["content"]);
  /* run-rules R35's answer, carried whole */
  assert.deepEqual([without[0].holds, without[0].code, without[0].check],
    [false, "LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE", "C-22.31"]);
  assert.equal(typeof without[0].translation, "string");
});

test("R18: a level reported empty with no read at all gives none, whatever the scope says of its documents", () => {
  for (const scope of [undefined, null, {}, { document: undefined }, { document: { reads: 0, documents: 5 } }, { document: {} },
                       { document: { reads: 1 } }, { document: { reads: 1, documents: "3" } }, "scope"]) {
    const state = { reports: [absent("document")], scope };
    assert.deepEqual(HARNESS.emptyLevelCandidates(state, "INQ-1"), [], JSON.stringify(scope));
    assert.deepEqual(HARNESS.levelsWithoutScope(state).map((x) => x.level), ["document"], JSON.stringify(scope));
  }
});

test("R18: control: a level whose scope holds a document (the statement over its reads) keeps its candidate, and only LOOKED_ABSENT levels are asked", () => {
  const state = { reports: [absent("meaning"), { level: "content", state: "LOOKED_INDETERMINATE", observed_at: "log:c" },
                            { level: "internet", state: "PRESENT", observed_at: "log:i", citations: [{ address: "a" }] }],
                  scope: { meaning: { reads: 2, documents: 2 }, content: { reads: 1, documents: 0 }, internet: { reads: 1, documents: 0 } } };
  assert.deepEqual(HARNESS.levelsWithoutScope(state), []);
  assert.deepEqual(HARNESS.emptyLevelCandidates(state, "INQ-1").map((c) => c.name), ["level-empty-meaning"]);
  /* each of the four levels is decided by its own scope */
  const all = { reports: LEVELS.map(absent), scope: { meaning: { reads: 1, documents: 0 }, content: { reads: 1, documents: 1 } } };
  assert.deepEqual(HARNESS.emptyLevelCandidates(all, "INQ-1").map((c) => c.name), ["level-empty-content"]);
});

test("R18: scope is in RESUMABLE and survives a segment break and a restart under the state ceiling, and no judgement sets it", () => {
  assert.ok(HARNESS.RESUMABLE.includes("scope"));
  const scope = { document: { reads: 1, documents: 3 } };
  const s = { step: "compose", pass: 1, scope };
  assert.deepEqual(HARNESS.resumableState(s).scope, scope);
  assert.deepEqual(HARNESS.resumeFrom(HARNESS.resumableState(s)).state.scope, scope);
  assert.deepEqual(HARNESS.publishableState({ ...s, queue: ["x".repeat(500)] }, 300).state.scope, scope);
  assert.equal(JUDGEABLE.includes("scope"), false);
  const a = applyJudgement({ step: "compose", scope }, { scope: { document: { reads: 9, documents: 9 } }, candidates: [] });
  assert.deepEqual(a.state.scope, scope, "a judgement naming scope leaves it as the shell set it");
});

/* ============================================================ R19: a level disagreement named once */
const pair = (record, a = "meaning", b = "content") => ({ record, levels: [a, b] });

test("R19: a judgement naming two pairs lists both; after the step, the same two named in the next pass list none and no pass is entered because of them", () => {
  const two = [pair("REC-1"), pair("REC-2", "content", "document")];
  let s = { step: "compose", pass: 0, maxPasses: 3, mode: "check", candidates: [] };
  const a = applyJudgement(s, { disagreements: two });
  assert.equal(a.ok, true);
  s = a.state;
  assert.deepEqual(HARNESS.disagreementsToSettle(s), two);
  const d = nextStep(s);
  assert.equal(d.step, "dedup");
  s = advance(s, d);
  assert.deepEqual(HARNESS.disagreementsToSettle(s), []);
  assert.equal(s.disagreed.length, 2);
  assert.deepEqual([s.passAdded, s.pass, s.maxPasses], [undefined, 0, 3], "a pair changes neither passAdded nor the pass limit");
  /* the next pass names the same two (one with its levels the other way round): none to settle, and the pass was not opened by them */
  const run = walk({ mode: "check", maxPasses: 3, disagreed: s.disagreed },
    [{ targets: [] }, { reports: [] }, { disagreements: [pair("REC-1", "content", "meaning"), two[1]] }, { queue: [] }]);
  assert.equal(run.state.disagreed.length, 2);
  assert.deepEqual(HARNESS.disagreementsToSettle({ disagreements: [two[0], two[1]], disagreed: run.state.disagreed }), []);
  assert.deepEqual(run.trace.filter((x) => x.startsWith("next-pass>")), ["next-pass>close"], "added nothing, so no further pass");
  assert.deepEqual([run.bound, run.state.pass], ["completed", 1]);
});

test("R19: it is applied at compose only, resumable as disagreed, and at most 10 pairs are settled in all", () => {
  assert.ok(JUDGEABLE.includes("disagreements") && HARNESS.RESUMABLE.includes("disagreed"));
  for (const step of ["plan", "collect", "dedup", "adjust"])
    assert.equal("disagreements" in applyJudgement({ step }, { disagreements: [pair("REC-1")] }).state, false, step);
  const kept = applyJudgement({ step: "compose" }, { disagreements: [pair("REC-1")] }).state;
  assert.deepEqual(kept.disagreements, [pair("REC-1")]);
  const back = HARNESS.resumeFrom(HARNESS.resumableState({ step: "dedup", pass: 1, disagreed: ["k1", "k2"] })).state;
  assert.deepEqual(back.disagreed, ["k1", "k2"]);
  assert.deepEqual(HARNESS.publishableState({ step: "dedup", pass: 1, disagreed: ["k1"], queue: ["x".repeat(500)] }, 300).state.disagreed, ["k1"]);
  /* ten settled in all: the eleventh, named later, is not listed, whatever the pass */
  let s = { step: "compose", pass: 0, disagreements: Array.from({ length: 10 }, (_, i) => pair(`REC-${i}`)) };
  assert.equal(HARNESS.disagreementsToSettle(s).length, 10);
  s = advance(s, { step: "dedup" });
  assert.deepEqual(HARNESS.disagreementsToSettle({ ...s, disagreements: [pair("REC-10")] }), []);
  /* a duplicate within one list is listed once; a close from compose settles them too */
  const dup = { step: "compose", disagreements: [pair("R"), pair("R", "content", "meaning")] };
  assert.equal(HARNESS.disagreementsToSettle(dup).length, 1);
  assert.equal(advance(dup, { step: "close" }).disagreed.length, 1);
});

test("R19: control: an eleventh pair, a pair naming one level twice and a pair with an empty record are refused, naming the key", () => {
  const eleven = Array.from({ length: 11 }, (_, i) => pair(`REC-${i}`));
  const refused = (d) => applyJudgement({ step: "compose" }, { disagreements: d });
  const a = refused(eleven);
  assert.deepEqual([a.ok, a.overreach, a.state], [false, ["disagreements[10]"], undefined]);
  assert.deepEqual(refused([pair("R", "meaning", "meaning")]).overreach, ["disagreements[0].levels"]);
  assert.deepEqual(refused([pair("  ")]).overreach, ["disagreements[0].record"]);
  assert.deepEqual(refused([pair("")]).overreach, ["disagreements[0].record"]);
  assert.deepEqual(refused([{ record: "R", levels: ["meaning", "gossip"] }]).overreach, ["disagreements[0].levels"]);
  assert.deepEqual(refused([{ record: "R", levels: ["meaning"] }]).overreach, ["disagreements[0].levels"]);
  assert.deepEqual(refused([{ record: "R", levels: ["meaning", "content"], note: "free text" }]).overreach, ["disagreements[0].note"]);
  assert.deepEqual(refused("REC-1").overreach, ["disagreements"]);
  assert.deepEqual(refused([null]).overreach, ["disagreements[0]"]);
  /* refused at any step, and through a driven run at the step that took it, nothing applied */
  assert.equal(applyJudgement({ step: "plan" }, { disagreements: eleven }).ok, false);
  const r = walk({ mode: "check", maxPasses: 3 }, [{ targets: [] }, { reports: [] }, { disagreements: eleven }]);
  assert.deepEqual(r.refused, { step: "compose", fields: ["disagreements[10]"] });
  assert.equal(r.state.disagreements, undefined);
  /* ten is the most that is accepted */
  assert.equal(refused(eleven.slice(0, 10)).ok, true);
});
