/* agent-harness — T53's requirements R20–R24 (K5457), at the module's interface (`src/harness.mjs`), pure.
 *
 * The other modules' names are read from their own exports (`run-rules`' modes, draft kinds, fine parts and gate
 * parts), never hand-listed here (K3268). */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MODES, CONTROL_FLOW, PLAN_FLOW, flowFor, RESUMABLE, publishableState, resumeFrom, nextStep, advance,
  CAPABILITY_NAMES, COSTS, ROLE_NEEDS, needOf, partOf, PARTS, disclosureGate,
  STATE_HOLDS_PROVIDER_STATE, PROVIDER_STATE_KEY, resumeAt,
} from "../src/harness.mjs";
import {
  RUN_MODES, DRAFT_KINDS, ASK_MODE, ENQUIRE_MODE, GATE_PARTS, GATE_PART_OF, TEST_BAR_PARTS, gatePartOf,
} from "../../bio-plane/src/run-rules/index.mjs";

/* The roles the modules use: each judged row of each mode's table, the sub-session, ask and a standing question's AI
   half, enquire and explore, each draft kind, transcription and reading inside documents. */
function rolesUsed({ modes = Object.keys(MODES), flows = flowFor, drafts = DRAFT_KINDS } = {}) {
  const judged = modes.flatMap((m) => {
    const f = flows(m);
    return Object.keys(f).filter((r) => f[r].judged).map((r) => `${m}:${r}`);
  });
  return [...judged, "subsession", ASK_MODE.mode, "standing", ENQUIRE_MODE.mode, "explore",
    ...drafts.map((k) => `draft:${k}`), "transcribe", "read"];
}
const missing = (roles) => roles.filter((r) => needOf(r) === null);

/* ============================================================ R20: ROLE_NEEDS */
test("R20: ROLE_NEEDS is total over the roles the modules use, each {capabilities, cost} within the vocabulary", () => {
  assert.deepEqual(CAPABILITY_NAMES, ["tools", "schema_output", "image_input", "parallel_tools", "min_context"]);
  assert.deepEqual(Object.keys(MODES), [...RUN_MODES], "the modes are run-rules'");
  assert.deepEqual(missing(rolesUsed()), [], "every role has a row");
  assert.ok(Object.isFrozen(ROLE_NEEDS));
  for (const [role, n] of Object.entries(ROLE_NEEDS)) {
    assert.deepEqual(Object.keys(n).sort(), ["capabilities", "cost"], role);
    assert.ok(COSTS.includes(n.cost), `${role}: cost ${n.cost}`);
    for (const c of n.capabilities) assert.ok(CAPABILITY_NAMES.includes(c), `${role}: ${c} is in the vocabulary`);
    assert.equal(needOf(role), n);
  }
  assert.equal(needOf("no-such-role"), null);
  assert.equal(needOf(undefined), null);
});

test("R20: no entry holds a model name, an id or a price", () => {
  const text = JSON.stringify(ROLE_NEEDS);
  for (const re of [/claude|gpt|gemini|llama|mistral|sonnet|opus|haiku|fable/i, /\d{4}-?\d{2}-?\d{2}/, /[$€£]|price|usd/i,
    /\b(?:model|id)\b/i])
    assert.doesNotMatch(text, re);
});

test("R20 control: a role added to a mode without a row fails the totality test", () => {
  assert.deepEqual(missing(rolesUsed({ modes: [...Object.keys(MODES), "watch"], flows: (m) => (m === "watch" ? CONTROL_FLOW : flowFor(m)) })),
    ["watch:plan", "watch:collect", "watch:compose", "watch:dedup", "watch:adjust"]);
  assert.deepEqual(missing(rolesUsed({ drafts: [...DRAFT_KINDS, "newkind"] })), ["draft:newkind"]);
});

/* ============================================================ R21: partOf */
test("R21: partOf's values are exactly run-rules' six gate parts, both ways", () => {
  assert.deepEqual([...PARTS].sort(), [...GATE_PARTS].sort());
  assert.deepEqual([...new Set(Object.values(GATE_PART_OF))].sort(), [...GATE_PARTS].sort());
  const names = [...Object.keys(ROLE_NEEDS), ...TEST_BAR_PARTS, ...Object.keys(MODES), "ask", "standing", "extract", "read",
    "transcribe", "enquire", "explore", "case_account", "account_check"];
  const values = new Set();
  for (const n of names) {
    const p = partOf(n);
    assert.ok(GATE_PARTS.includes(p), `${n} maps to a gate part (${p})`);
    values.add(p);
  }
  assert.deepEqual([...values].sort(), [...GATE_PARTS].sort(), "every gate part has a role");
  /* the fine parts run-rules judges agree with it */
  for (const fine of TEST_BAR_PARTS) assert.equal(partOf(fine), gatePartOf(fine), fine);
  assert.equal(partOf("check"), "run"); assert.equal(partOf("plan:compose"), "run"); assert.equal(partOf("subsession"), "run");
  assert.equal(partOf("extract"), "read"); assert.equal(partOf("standing"), "ask");
  assert.equal(partOf("draft:case_account"), "account"); assert.equal(partOf("draft:own_words"), "draft");
  assert.equal(partOf("no-such-role"), null);
});

test("R21 control: a role mapped to a fine name such as draft:reading is not a gate part", () => {
  assert.ok(!GATE_PARTS.includes("draft:reading"));
  assert.equal(partOf("draft:reading"), "draft");
  /* a map that answered the fine name would fail the both-ways check above */
  const wrong = (n) => (n === "draft:reading" ? "draft:reading" : partOf(n));
  assert.ok(!Object.keys(ROLE_NEEDS).every((n) => GATE_PARTS.includes(wrong(n))));
});

/* ============================================================ R22: disclosureGate */
test("R22: a recipient in account.disclosed passes; one not in it is refused, naming it", () => {
  const account = { disclosed: [{ provider: "acme", host: "api.acme.example" }] };
  assert.deepEqual(disclosureGate(account, { provider: "acme", host: "api.acme.example" }), { ok: true });
  assert.deepEqual(disclosureGate(account, { provider: "other", host: "api.other.example" }),
    { ok: false, recipient: { provider: "other", host: "api.other.example" } });
  assert.deepEqual(disclosureGate(null, { provider: "acme", host: "api.acme.example" }).ok, false);
});

test("R22 control: the same provider at another host is not disclosed", () => {
  const account = { disclosed: [{ provider: "acme", host: "api.acme.example" }] };
  assert.deepEqual(disclosureGate(account, { provider: "acme", host: "eu.acme.example" }),
    { ok: false, recipient: { provider: "acme", host: "eu.acme.example" } });
});

/* ============================================================ R23: no provider-held state */
test("R23: RESUMABLE holds no key named or shaped as a session, response, conversation or continuation id", () => {
  assert.deepEqual(RESUMABLE.filter((k) => PROVIDER_STATE_KEY.test(k)), []);
  for (const k of ["continuation", "conversation_id", "session_id", "sessionId", "previous_response_id", "responseId", "thread_id"])
    assert.match(k, PROVIDER_STATE_KEY, k);
});

test("R23: a state carrying continuation is refused STATE_HOLDS_PROVIDER_STATE naming the key, not dropped", () => {
  for (const flow of [CONTROL_FLOW, PLAN_FLOW]) {
    const r = publishableState({ step: "collect", pass: 1, reports: [], continuation: "abc" }, 4096, flow);
    assert.equal(r.ok, false);
    assert.equal(r.code, STATE_HOLDS_PROVIDER_STATE);
    assert.equal(r.reason, r.code);
    assert.equal(r.key, "continuation");
    assert.equal(typeof r.detail, "string");
    assert.equal(r.state, undefined, "nothing is published");
  }
});

test("R23 control: the existing keys publish, and the record's own response id is not provider state", () => {
  const full = Object.fromEntries(RESUMABLE.map((k) => [k, null]));
  const r = publishableState({ ...full, step: "collect", pass: 1, response: "RESP-1", mode: "check" }, 0);
  assert.notEqual(r.ok, false);
  assert.deepEqual(Object.keys(r.state), RESUMABLE);
  assert.equal(r.restarted, null);
});

/* ============================================================ R24: resumeAt */
test("R24: a stop at collect leaves the next step collect, the pass unchanged and nothing consumed", () => {
  const state = { step: "collect", pass: 1, reports: [{ level: "meaning" }],
    budget: { fetches: { allowed: 5, consumed: 2 }, wallclock: { allowed: 100, consumed: 40 } } };
  const before = structuredClone(state);
  const r = resumeAt(state, "collect");
  assert.equal(r.next, "collect");
  assert.deepEqual(r.state, before);
  assert.equal(r.state.pass, 1);
  assert.deepEqual(r.state.budget, before.budget);
  assert.deepEqual(resumeAt(state, { at: "collect", completed: false }), r);
  assert.deepEqual(state, before, "the argument is not changed");
});

test("R24 control: a completed collect advances to compose, as advance does", () => {
  const state = { step: "collect", pass: 1, maxPasses: 3, reports: [] };
  const r = resumeAt(state, { at: "collect", completed: true });
  assert.equal(r.next, "compose");
  assert.deepEqual(r.state, advance(state, nextStep(state)));
  /* a published state taken up with resumeFrom resumes at the step it names */
  assert.equal(resumeFrom({ step: "collect", pass: 1 }).at, "collect");
});
