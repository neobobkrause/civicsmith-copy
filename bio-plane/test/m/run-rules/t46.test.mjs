/* run-rules T46-13 (N897 (2), K2816; N919, K2892; N920; N913, DEC-194): R29, the test-instance exception
   (`partAdmittedOn`, `partAdmitted`, `untestedLabel`); R30, its refusal `AI_PART_NOT_DEPLOYED`; R16, R21 and R14's flags
   set and gated through R29; R27's `statusreport`; R31, two C-109 rows read by key from `words.json`; R32 (T47-71; DEC-198),
   C-22.30 read by key from it too. Each refusal has its negative control beside it (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import { partAdmittedOn, partAdmitted, untestedLabel, partRefusal, UNTESTED_WORDS, partDeployableOn, partDeployable,
         testBarHeld, TEST_BAR_PARTS, CIVICSMITH_TEST_SET, DEPLOYMENT_SEQUENCE, DEPLOYED_MODES, deployedModesFor,
         ASK_MODE, DRAFT_MODE, ENQUIRE_MODE, ACTION_DRAFTS, ACTION_DRAFT_KINDS, DRAFT_KINDS, DRAFT_REACH, draftMayRead,
         draftKindDeployed, startAllowed, RUN_MODES, deployable, AI_RUN_CHECKS, AI_RUN_OWN_CHECKS, AI_RUN_OPEN_CHECKS,
         AI_RUN_PLAN_CHECKS, RUN_RULES_WORDS, RETIRED_CHECKS, translationOf } from "../../../src/run-rules/index.mjs";
import { refusal } from "./helpers.mjs";
import { WORD } from "./words.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const EMPTY = Object.freeze({ id: "fixture", version: 2, matters: Object.freeze([]) });
const FULL = Object.freeze({ id: "fixture", version: 2, matters: Object.freeze([{ id: "M1" }]) });
const bar = (part, set = FULL, extra = {}) => ({ part, set: set.id, set_version: set.version, false_alarm_rate: 0,
                                                 passed: true, graded_by: "harness", at: "2026-10-12T00:00:00Z", ...extra });
const ver = (mode) => ({ mode, run: `RUN-${mode}`, verified_by: "member:ann", at: "t", evidence: "op=audit clean" });
const CHAIN = DEPLOYMENT_SEQUENCE.order.filter((m) => !Object.prototype.hasOwnProperty.call(DEPLOYMENT_SEQUENCE.deploys_apart, m));
/** A part whose chain is not met with no verification held: a chain mode after the first. */
const chainBlocked = (p) => CHAIN.indexOf(p) > 0;
const labelOf = (part) => ({ kind: "untested", part, set: CIVICSMITH_TEST_SET.id, set_version: CIVICSMITH_TEST_SET.version,
                             words: "ai.label.untested" });

test("R29: untestedLabel(part) answers {kind: 'untested', part, set, set_version, words: 'ai.label.untested'}, frozen, naming Civicsmith's set at its current version, for every part in TEST_BAR_PARTS, and null for anything else; never throws", () => {
  assert.equal(UNTESTED_WORDS, "ai.label.untested");
  for (const p of TEST_BAR_PARTS) {
    const l = untestedLabel(p);
    assert.deepEqual(l, labelOf(p), p);
    assert.deepEqual(Object.keys(l), ["kind", "part", "set", "set_version", "words"], p);
    assert.ok(Object.isFrozen(l), p);
  }
  for (const x of ["", "draft", "draft:", "draft:prose", "Check", " ask", "explorer", "__proto__", "toString", null, undefined,
                   3, true, ["ask"], { part: "ask" }])
    assert.equal(untestedLabel(x), null, String(x));
  assert.equal(untestedLabel(), null);
});

test("R29: on an empty set with testInstance exactly true, partAdmittedOn admits check, ask, draft:own_words and transcribe, each labelled — and every part of TEST_BAR_PARTS whose chain stands; control: testInstance false, absent, \"yes\" or any other non-true admits none", () => {
  for (const p of ["check", "ask", "draft:own_words", "transcribe"])
    assert.deepEqual(partAdmittedOn(EMPTY, p, {}, { testInstance: true }), { admitted: true, untested: labelOf(p) }, p);
  /* the whole table: every part, the chain standing or not */
  for (const p of TEST_BAR_PARTS) {
    const got = partAdmittedOn(EMPTY, p, { verifications: [], testBars: [] }, { testInstance: true });
    assert.deepEqual(got, chainBlocked(p) ? { admitted: false, untested: null } : { admitted: true, untested: labelOf(p) }, p);
    assert.ok(Object.isFrozen(got), p);
  }
  /* control: only the literal true is a test instance */
  for (const opts of [{ testInstance: false }, {}, undefined, null, { testInstance: "yes" }, { testInstance: "true" },
                      { testInstance: 1 }, { testInstance: [true] }, { testInstance: { on: true } }, Object.create({ testInstance: true }),
                      "testInstance", true])
    for (const p of TEST_BAR_PARTS)
      assert.deepEqual(partAdmittedOn(EMPTY, p, {}, opts), { admitted: false, untested: null }, `${p} ${JSON.stringify(opts)}`);
});

test("R29: the exception never lifts the chain — investigate with no verification of check is refused even with testInstance true, extract until both are verified; with the chain held it is admitted, labelled (control)", () => {
  const ti = { testInstance: true };
  assert.deepEqual(partAdmittedOn(EMPTY, "investigate", {}, ti), { admitted: false, untested: null });
  assert.deepEqual(partAdmittedOn(EMPTY, "investigate", { verifications: [ver("investigate")] }, ti), { admitted: false, untested: null });
  assert.deepEqual(partAdmittedOn(EMPTY, "investigate", { verifications: [ver("check")] }, ti), { admitted: true, untested: labelOf("investigate") });
  assert.deepEqual(partAdmittedOn(EMPTY, "extract", { verifications: [ver("check")] }, ti), { admitted: false, untested: null });
  assert.deepEqual(partAdmittedOn(EMPTY, "extract", { verifications: [ver("check"), ver("investigate")] }, ti),
                   { admitted: true, untested: labelOf("extract") });
  /* an unfit verification counts for nothing */
  assert.deepEqual(partAdmittedOn(EMPTY, "investigate", { verifications: [{ ...ver("check"), verified_by: "class:daemon" }] }, ti),
                   { admitted: false, untested: null });
  /* plan deploys apart: the chain never decides it */
  assert.deepEqual(partAdmittedOn(EMPTY, "plan", {}, ti), { admitted: true, untested: labelOf("plan") });
});

test("R29: the label follows the bar, not the instance — (T53) the bar is the entry's Gate 1 record: a passing one admits unlabelled whatever testInstance; a passed R75 record on a set with matters no longer opens the gate, so it is labelled on a test instance and refused elsewhere, as a failed, unfit, other-set or earlier-version record is", () => {
  const gate = (part) => ({ part, entry_id: "e1", verdict: "passes", limits: [], partial_coverage: false,
    suiteVersions: { bank: 1, scorer: 1, thresholds: 1, image: 1 }, tier: "full", grade: "MEASURED", at: "2026-10-12T00:00:00Z" });
  const GATE_OF = (p) => (p === "draft:case_account" || p === "draft:account_check") ? "account"
    : (p.startsWith("draft:") || p === "enquire") ? "draft" : (p === "extract" || p === "read") ? "read"
    : (p === "ask" || p === "transcribe") ? p : "run";
  for (const p of TEST_BAR_PARTS) {
    const held = { gateRecords: [gate(GATE_OF(p))], verifications: CHAIN.map(ver) };
    for (const opts of [{ testInstance: true, entry_id: "e1" }, { testInstance: false, entry_id: "e1" }, { entry_id: "e1" }])
      assert.deepEqual(partAdmittedOn(FULL, p, held, opts), { admitted: true, untested: null }, `${p} ${JSON.stringify(opts)}`);
  }
  for (const extra of [{}, { passed: false }, { set: "group:oak" }, { set_version: 1 }, { false_alarm_rate: 2 }]) {
    const held = { testBars: [bar("ask", FULL, extra)] };
    assert.deepEqual(partAdmittedOn(FULL, "ask", held, { testInstance: true }), { admitted: true, untested: labelOf("ask") }, JSON.stringify(extra));
    assert.deepEqual(partAdmittedOn(FULL, "ask", held, { testInstance: false }), { admitted: false, untested: null }, JSON.stringify(extra));
  }
  /* Gate 1 passed but the chain not: refused, test instance or not */
  assert.deepEqual(partAdmittedOn(FULL, "investigate", { gateRecords: [gate("run")] }, { testInstance: true, entry_id: "e1" }), { admitted: false, untested: null });
});

test("R29: the exception never sets or reads a deploy flag and never counts as a bar held — deployedModesFor() and DEPLOYED_MODES unchanged by it, a part whose flag is false (enquire, the action drafts) answered on the bar alone, partDeployable and testBarHeld unchanged; testInstance is no request field", () => {
  const before = [...deployedModesFor()];
  for (const p of TEST_BAR_PARTS) partAdmitted(p, {}, { testInstance: true });
  assert.deepEqual([...deployedModesFor()], before);
  assert.deepEqual([...DEPLOYED_MODES], before);
  assert.deepEqual([ENQUIRE_MODE.deployed, ACTION_DRAFTS.deployed], [false, false]);
  /* the gate reads no flag: a part whose own flag is false is still answered on the bar (the door asks the flag) */
  for (const p of ["enquire", ...ACTION_DRAFT_KINDS.map((k) => `draft:${k}`)])
    assert.deepEqual(partAdmitted(p, {}, { testInstance: true }), { admitted: true, untested: labelOf(p) }, p);
  /* no bar is counted held: R19's own answers stay false on Civicsmith's set */
  for (const p of TEST_BAR_PARTS) {
    assert.equal(testBarHeld(p, []), false, p);
    assert.equal(partDeployable(p, { verifications: CHAIN.map(ver) }), false, p);
  }
  /* testInstance is the gate's fourth argument alone: one inside `held` is no fact of the deployment */
  assert.deepEqual(partAdmitted("ask", { testInstance: true }), { admitted: false, untested: null });
  assert.deepEqual(partAdmitted("ask", { testInstance: true }, {}), { admitted: false, untested: null });
});

test("R29: partAdmitted(part, held, opts) is partAdmittedOn on Civicsmith's set; never throws, anything that is not a part answered not admitted", () => {
  for (const p of TEST_BAR_PARTS) for (const opts of [{ testInstance: true }, {}])
    for (const held of [{}, { verifications: CHAIN.map(ver), testBars: [bar(p, CIVICSMITH_TEST_SET)] }])
      assert.deepEqual(partAdmitted(p, held, opts), partAdmittedOn(CIVICSMITH_TEST_SET, p, held, opts), p);
  for (const p of ["", "draft", "nope", null, undefined, 3, ["ask"]])
    for (const opts of [{ testInstance: true }, undefined])
      assert.deepEqual(partAdmitted(p, {}, opts), { admitted: false, untested: null }, String(p));
  for (const [set, held] of [[null, null], [3, "x"], [undefined, 3], [{ id: "", matters: [] }, []]])
    assert.deepEqual(partAdmittedOn(set, "ask", held, { testInstance: true }), { admitted: true, untested: labelOf("ask") });
  assert.deepEqual(partAdmitted(), { admitted: false, untested: null });
});

test("R30: partRefusal(part) is AI_PART_NOT_DEPLOYED (C-22.29), the gate's refusal form and its one minting site, naming the part, its detail the row's words read by key (T53); C-109.1 and C-51.7 keep their codes, numbers and sites", () => {
  const row = AI_RUN_OWN_CHECKS.AI_PART_NOT_DEPLOYED;
  assert.equal(row.check, "C-22.29");
  assert.equal(AI_RUN_CHECKS.AI_PART_NOT_DEPLOYED, row);
  assert.match(row.where, /^src\/run-rules\/test-bar\.mjs partRefusal, /);
  /* T53: read by key ai.refused.aipartnotdeployed once the word table holds it; until then C-22.29's own word */
  assert.equal(row.translation, localize("ai.refused.aipartnotdeployed", WORD("refusal.AI_PART_NOT_DEPLOYED")));
  assert.equal(translationOf("AI_PART_NOT_DEPLOYED"), row.translation);
  for (const p of ["ask", "draft:own_words", "draft:statusreport", "plan"]) {
    const r = refusal(partRefusal(p), "AI_PART_NOT_DEPLOYED");
    assert.deepEqual([r.check, r.part], ["C-22.29", p]);
    assert.equal(r.detail, row.translation, p);
  }
  /* it is the refusal of exactly the answers the gate does not admit (control: an admitted part needs none) */
  assert.equal(partAdmitted("ask", {}).admitted, false);
  assert.equal(partAdmitted("ask", {}, { testInstance: true }).admitted, true);
  /* never throws: a part that is not a string is named as its first 40 characters */
  for (const x of [null, undefined, 3, "x".repeat(99), {}]) assert.equal(refusal(partRefusal(x), "AI_PART_NOT_DEPLOYED").part.length <= 40, true);
  /* the next free number: C-22.28 was the last taken, and no retired number is reused */
  const c22 = Object.values(AI_RUN_CHECKS).map((r) => r.check).filter((c) => c.startsWith("C-22.")).map((c) => Number(c.slice(5)));
  assert.equal(c22.filter((n) => n > 28 && n < 32).sort().join(), "29,30,31", "29 R30's, 30 R32's, 31 R35's");
  assert.equal(new Set(c22).size, c22.length);
  for (const r of Object.values(RETIRED_CHECKS)) assert.notEqual(r.check, "C-22.29");
  /* control: the codes it stands beside keep theirs */
  assert.deepEqual([AI_RUN_OPEN_CHECKS.AI_RUN_MODE_NOT_DEPLOYED.check, AI_RUN_OPEN_CHECKS.AI_RUN_MODE_NOT_DEPLOYED.where],
                   ["C-109.1", "src/ai-runs/index.mjs open > is-airun-open-mode, reached from op=airunopen"]);
  assert.equal(Object.values(AI_RUN_CHECKS).some((r) => r.check === "C-51.7"), false, "C-51.7 stays extraction's");
});

test("R16, R21, R14: ask's, draft's and plan's flags are true (each its own reviewed change), and each part they deploy is still admitted only through R29 — on Civicsmith's set, holding no passed record, nothing runs but on a test instance, labelled", () => {
  assert.deepEqual([ASK_MODE.deployed, DRAFT_MODE.deployed, DEPLOYMENT_SEQUENCE.deploys_apart.plan.deployed], [true, true, true]);
  for (const m of ["ask", "draft", "plan"]) assert.equal(DEPLOYED_MODES.includes(m), true, m);
  const parts = ["ask", "plan", ...DRAFT_KINDS.map((k) => `draft:${k}`)];
  for (const p of parts) {
    assert.deepEqual(partAdmitted(p, {}), { admitted: false, untested: null }, `${p}: the bar still gates every other instance`);
    assert.deepEqual(partAdmitted(p, {}, { testInstance: true }), { admitted: true, untested: labelOf(p) }, p);
  }
  /* the mode draft is measured per kind: the bare mode is no part */
  assert.equal(TEST_BAR_PARTS.includes("draft"), false);
  /* control: enquire and the action drafts keep their flags false; investigate and extract stay undeployed */
  assert.equal(DEPLOYED_MODES.includes("enquire"), false);
  for (const k of ACTION_DRAFT_KINDS) assert.equal(draftKindDeployed({ kind: k }), false, k);
  for (const m of ["investigate", "extract"]) assert.equal(DEPLOYED_MODES.includes(m), false, m);
});

test("R27 (T46): DRAFT_KINDS gains statusreport after the action drafts — reach none (only the items plan-work R8 assembled, handed in by the door), draftMayRead false whatever the rest, deployed under draft's own flag with action_drafts playing no part, its test-bar part draft:statusreport, started only at the asking member's act (R18); not an action draft, a mode or a flag", () => {
  /* directly after the action drafts (R33's T48 `reading` follows it; t48.test.mjs) */
  const at = DRAFT_KINDS.indexOf("statusreport");
  assert.deepEqual([...DRAFT_KINDS].slice(at - 3, at), [...ACTION_DRAFT_KINDS]);
  assert.equal(ACTION_DRAFT_KINDS.includes("statusreport"), false);
  assert.equal(DRAFT_MODE.kinds.includes("statusreport"), true);
  /* its reach */
  assert.ok(Object.isFrozen(DRAFT_REACH.statusreport));
  assert.deepEqual(Object.keys(DRAFT_REACH.statusreport), ["scope", "means"]);
  assert.equal(DRAFT_REACH.statusreport.scope, "none");
  assert.equal(DRAFT_REACH.statusreport.means, "nothing of the record: only the items plan-work R8 assembled for the plan's "
    + "status report, handed in by the door");
  for (const firsthand of [undefined, null, false, true]) for (const suggestions of [true, false, undefined])
    assert.equal(draftMayRead({ kind: "statusreport", firsthand, suggestions }), false, JSON.stringify({ firsthand, suggestions }));
  /* draft's own flag alone */
  for (const draft of [true, false, undefined, "true"]) for (const action_drafts of [true, false, undefined]) {
    const flags = { ...(draft === undefined ? {} : { draft }), ...(action_drafts === undefined ? {} : { action_drafts }) };
    const want = draft === undefined ? DRAFT_MODE.deployed === true : draft === true;
    assert.equal(draftKindDeployed({ kind: "statusreport", flags }), want, JSON.stringify(flags));
  }
  assert.equal(draftKindDeployed({ kind: "statusreport" }), true, "today: draft's flag is true");
  /* its test-bar part */
  assert.equal(TEST_BAR_PARTS.includes("draft:statusreport"), true);
  assert.equal(partDeployableOn(FULL, "draft:statusreport", { testBars: [bar("draft:statusreport")] }), true);
  assert.equal(partDeployableOn(FULL, "draft:statusreport", { testBars: [bar("draft:textcheck")] }), false, "another kind's bar");
  /* R18's for any draft */
  assert.deepEqual(startAllowed({ startedBy: "member:ann", mode: "draft", kind: "statusreport" }), { ok: true });
  for (const standing of [undefined, { author: "member:ann" }])
    assert.match(refusal(startAllowed({ startedBy: "class:daemon", mode: "draft", kind: "statusreport", standing }), "AI_RUN_NOT_A_MEMBER_ACT").detail,
                 /^a draft, of whatever kind, starts only at the act of the member who asked for the help/);
  /* no mode, no flag of its own */
  assert.equal(RUN_MODES.includes("statusreport"), false);
  assert.equal(deployable("statusreport", []), false);
  assert.deepEqual([...deployedModesFor({ statusreport: false })], [...DEPLOYED_MODES]);
});

test("R31: C-109.13 and C-109.14 take their translations from words.json's refusal.<CODE>, read by key (RUN_RULES_WORDS), codes, numbers and wheres unmoved; C-22.25 AI_RUN_ORIGIN_UNKNOWN keeps its present translation, since words.json's speaks only of a planning run", () => {
  assert.ok(Object.isFrozen(RUN_RULES_WORDS));
  /* R32 (T47) adds C-22.30's key after R31's two, and R35 (T50) C-22.31's; t46's R32 test and t50's R35 test hold them */
  assert.deepEqual(Object.keys(RUN_RULES_WORDS), ["refusal.AI_RUN_REEXAM_NEEDS_RESPONSE", "refusal.AI_RUN_REEXAM_OPEN",
                                                   "refusal.MEMBER_RUN_MODE_NOT_ADMITTED",
                                                   "refusal.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE"]);
  for (const [key, en] of Object.entries(RUN_RULES_WORDS)) assert.equal(en, WORD(key), `${key} is the list's word, verbatim`);
  for (const [code, n] of [["AI_RUN_REEXAM_NEEDS_RESPONSE", "C-109.13"], ["AI_RUN_REEXAM_OPEN", "C-109.14"]]) {
    const row = AI_RUN_PLAN_CHECKS[code];
    assert.equal(row.translation, WORD(`refusal.${code}`), code);
    assert.equal(row.translation, RUN_RULES_WORDS[`refusal.${code}`], code);
    assert.deepEqual([row.check, row.where], [n, "src/ai-runs/index.mjs open > is-airun-open-reexam, reached from op=airunopen"], code);
    assert.equal(translationOf(code), WORD(`refusal.${code}`), code);
  }
  /* AI_RUN_ORIGIN_UNKNOWN: not read by key in T46 — its row keeps the sentence that is true in every mode */
  const origin = AI_RUN_OWN_CHECKS.AI_RUN_ORIGIN_UNKNOWN;
  assert.equal(origin.check, "C-22.25");
  assert.equal(origin.translation, localize("run-rules.checks.nothing_was_started_because_this", "Nothing was started, because this investigation did not say where it came from in a way the record knows: an investigation is started by a member or by exploring a question, and nothing else."));
  assert.notEqual(origin.translation, WORD("refusal.AI_RUN_ORIGIN_UNKNOWN"));
  assert.match(WORD("refusal.AI_RUN_ORIGIN_UNKNOWN"), /planning run/, "the list's sentence is a planning run's alone");
  assert.equal(Object.prototype.hasOwnProperty.call(RUN_RULES_WORDS, "refusal.AI_RUN_ORIGIN_UNKNOWN"), false);
  /* control: a word the list lacks fails loudly */
  assert.throws(() => WORD("refusal.NOT_A_CODE"), /holds no word/);
});

test("R32 (T47; N992; DEC-198): MEMBER_RUN_MODE_NOT_ADMITTED (C-22.30, the next free number after R30's) is a row of this module's table in DEC-83's form, minted by ai-runs R18 at dispatchMemberRun's region and read here by key; its translation is words.json's refusal.MEMBER_RUN_MODE_NOT_ADMITTED, read by key (RUN_RULES_WORDS), T46's interim sentence gone; code, number and where unmoved", () => {
  const row = AI_RUN_OWN_CHECKS.MEMBER_RUN_MODE_NOT_ADMITTED;
  assert.deepEqual(Object.keys(row).sort(), ["check", "translation", "where"]);
  assert.equal(row.check, "C-22.30");
  assert.equal(row.where, "src/ai-runs/index.mjs dispatchMemberRun > is-airun-member-dispatch, reached from op=airundispatch");
  /* the list's word, verbatim, read by key: the row's translation is RUN_RULES_WORDS' entry and the list's en */
  const key = "refusal.MEMBER_RUN_MODE_NOT_ADMITTED";
  assert.equal(RUN_RULES_WORDS[key], WORD(key), `${key} is the list's word, verbatim`);
  assert.equal(row.translation, WORD(key));
  assert.equal(row.translation, RUN_RULES_WORDS[key]);
  assert.equal(AI_RUN_CHECKS.MEMBER_RUN_MODE_NOT_ADMITTED, row);
  assert.equal(translationOf("MEMBER_RUN_MODE_NOT_ADMITTED"), WORD(key));
  /* control: T46's interim sentence is gone */
  const interim = "Nothing was started, because on your own Claude sign-in the assistant only checks and plans for you; "
    + "this kind of work needs your group's Civicsmith to run it.";
  assert.notEqual(row.translation, interim);
  assert.equal(Object.values(AI_RUN_CHECKS).some((r) => r.translation === interim), false);
  /* one condition per number, and none retired reused */
  const numbers = Object.values(AI_RUN_CHECKS).map((r) => r.check);
  assert.equal(numbers.filter((n) => n === "C-22.30").length, 1);
  for (const r of Object.values(RETIRED_CHECKS)) assert.notEqual(r.check, "C-22.30");
  /* control: R30's row is a different condition, and a key the list lacks still fails loudly */
  assert.notEqual(row.translation, AI_RUN_OWN_CHECKS.AI_PART_NOT_DEPLOYED.translation);
  assert.throws(() => WORD("refusal.MEMBER_RUN_MODE_NOT_ADMITTED_X"), /holds no word/);
});
