/* run-rules R11 (was ai-runs R35's share), R12 (as ai-runs R39), R15 (K660) and R20 (T33-49): the table of every run refusal's row,
   the one map `AI_RUN_CHECKS` and `translationOf`, and no place named in the module's outward text. */
import test from "node:test";
import assert from "node:assert/strict";
import * as RR from "../../../src/run-rules/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { WORD } from "./words.mjs";
import { AI_RUN_CHECKS as OBSERVATION_LOG_ROWS } from "../../../src/observation-log/index.mjs";

const { AI_RUNS_CHECKS, AI_RUN_OWN_CHECKS, AI_RUN_ACT_SHAPE_CHECKS, AI_RUNS_CONTEXT_CHECKS, SURFACE_RUN_CHECKS,
        AI_RUN_OPEN_CHECKS, AI_RUN_PLAN_CHECKS, AI_USE_CHECKS, AI_RUN_CHECKS, RETIRED_CHECKS, translationOf } = RR;

/** R11's rows minted here, by code, with the site that mints each. */
const MINTED_HERE = {
  AI_RUN_BOUND_UNNAMED: ["C-22.5", "src/run-rules/rules.mjs checkBound"],
  AI_RUN_SKILL_VERSION_UNNAMED: ["C-22.7", "src/run-rules/skill-version.mjs checkSkillVersion"],
  AI_RUN_NOT_PROJECT_MEMBER: ["C-22.8", "src/run-rules/rules.mjs projectGate"],
  AI_RUN_NO_SUCH_CONTEXT: ["C-22.11", "src/run-rules/rules.mjs checkRunContextKind"],
  AI_RUN_NOT_PRINCIPAL: ["C-22.12", "src/run-rules/rules.mjs runPrincipalGate"],
  AI_RUN_CONSUME_INVALID: ["C-22.13", "src/run-rules/rules.mjs checkConsume"],
  AI_RUN_BOUND_PLANE_COUNTED: ["C-22.14", "src/run-rules/rules.mjs checkConsume"],
  AI_RUN_BOUND_UNKNOWN: ["C-22.15", "src/run-rules/rules.mjs checkConsume"],
  AI_RUN_BOUND_NO_ALLOWANCE: ["C-22.16", "src/run-rules/rules.mjs checkConsume"],
  AI_RUN_STATE_TOO_LARGE: ["C-22.18", "src/run-rules/rules.mjs checkRunState"],
  AI_RUN_NOT_A_MEMBER_ACT: ["C-22.19", "src/run-rules/rules.mjs startAllowed"],
  AI_RUN_VERIFICATION_UNFIT: ["C-22.20", "src/run-rules/deployment.mjs checkVerification"],
  AI_ASK_BOUND_ABOVE_CEILING: ["C-22.21", "src/run-rules/rules.mjs checkAskBounds"],
  AI_TEST_BAR_UNFIT: ["C-22.22", "src/run-rules/test-bar.mjs checkTestBarRecord"],
  AI_RUN_READ_NO_AI: ["C-22.23", "src/run-rules/rules.mjs checkPagesRead"],
  AI_RUN_ORIGIN_UNKNOWN: ["C-22.25", "src/run-rules/rules.mjs originAllowed"],
  AI_RUN_EXPLORE_NOT_DEPLOYABLE: ["C-22.27", "src/run-rules/rules.mjs originAllowed"],
  AI_PART_NOT_DEPLOYED: ["C-22.29", "src/run-rules/test-bar.mjs partRefusal"],
  LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE: ["C-22.31", "src/run-rules/rules.mjs levelEmptyHolds"],
  PART_WITHDRAWN: ["C-22.34", "src/run-rules/test-bar.mjs partRefusal"],
};
/** The C-22 rows of ai-runs' T41 acts (B3, B4; K2482, K2485), minted by ai-runs (its R73, R75) and read here by key. */
const AI_RUNS_C22 = { AI_GROUP_TEST_INVALID: "C-22.24", AI_RUN_EXPLORE_NEEDS_STEP: "C-22.26", AI_RUN_STEP_UNKNOWN: "C-22.28",
                      /* R32 (T46; K2947; ai-runs R18) */
                      MEMBER_RUN_MODE_NOT_ADMITTED: "C-22.30" };
/** R20's rows, minted by ai-runs (its R52) and answers, read here by key. */
const USE = { AI_NO_ACCOUNT: "C-109.10", NOT_YOUR_CEILING: "C-109.11" };
/** R20's retired codes (T40; N812; K2373, K2400), each with its number, never reused, and its replacement in ai-use. */
const RETIRED = { AI_USE_CEILING_REACHED: ["C-109.8", "AI_LIMIT_REACHED"], AI_USE_COPY_CEILING_REACHED: ["C-109.9", "AI_LIMIT_REACHED"],
                  AI_CEILING_INVALID: ["C-109.12", "AI_LIMIT_INVALID"] };
/** Of R20's rows, those that set a ceiling rather than hold a run or ask back. */
const SETTING = ["NOT_YOUR_CEILING"];
/** R11's rows minted by ai-runs and read here by key. */
const AI_RUNS_ACTS = {
  AI_RUN_CAPABILITY_UNAVAILABLE: "C-33.29", AI_RUN_NO_CONTEXT: "C-33.30", AI_RUN_ALREADY_OPEN: "C-33.31",
  AI_RUN_RERUN_SELF: "C-33.45", AI_RUN_RERUN_UNKNOWN: "C-33.46", AI_RUN_RERUN_OTHER_CONTEXT: "C-33.47",
  AI_RUNS_NO_CONTEXT_TYPE: "C-36.1", AI_RUNS_UNKNOWN_CONTEXT_TYPE: "C-36.2", AI_RUNS_NO_CONTEXT_ID: "C-36.3",
  SURFACE_NO_RUN: "C-66.1", SURFACE_RUN_NOT_RUNNING: "C-66.2", SURFACE_NO_BOUND: "C-66.3", SURFACE_BOUND_REACHED: "C-66.4",
  AI_RUN_MODE_NOT_DEPLOYED: "C-109.1",
  /* F2, F3 (coordinator ruling 5 Nov 03:50; ai-runs R40, R106) */
  PART_NOT_PASSED: "C-109.15", AI_RUN_IDEM_INVALID: "C-109.16",
};
/** R15's rows, minted by ai-runs (its R46, R47). */
const PLANNING = {
  AI_RUN_PLAN_REQUIRED: "C-109.2", AI_RUN_PLAN_UNEXPECTED: "C-109.3", AI_RUN_PLAN_NEEDS_PROJECT: "C-109.4",
  AI_RUN_PLAN_NEEDS_MEMBER: "C-109.5", AI_RUN_PLAN_NO_SEARCH: "C-109.6", AI_RUN_MODE_UNCHECKED: "C-109.7",
  /* R28 (K2820, K2822; ai-runs R77): the re-examination run's two, in the same family */
  AI_RUN_REEXAM_NEEDS_RESPONSE: "C-109.13", AI_RUN_REEXAM_OPEN: "C-109.14",
};
const REGION = { AI_RUN_MODE_UNCHECKED: "check", AI_RUN_REEXAM_NEEDS_RESPONSE: "reexam", AI_RUN_REEXAM_OPEN: "reexam" };
const OBSERVATION_LOG_C22 = ["C-22.1", "C-22.2", "C-22.3", "C-22.4", "C-22.6", "C-22.9", "C-22.10", "C-22.17",
  /* T53-601 (observation-log R40, R41): its two field rows */ "C-22.32", "C-22.33"];

function wellFormed(code, row) {
  assert.deepEqual(Object.keys(row).sort(), ["check", "translation", "where"], code);
  assert.match(row.check, /^C-\d+\.\d+$/, code);
  assert.equal(typeof row.translation, "string", code);
  assert.ok(row.translation.length >= 40, `${code}'s translation is a sentence a member reads`);
  assert.equal(typeof row.where, "string", code);
}

test("R11: the table holds exactly the rows the pure rules mint (each where naming this module's site, C-22.7's skill-version.mjs checkSkillVersion) and the rows of ai-runs' acts, each code once with its number; every refusal carries its row", () => {
  const want = { ...Object.fromEntries(Object.entries(MINTED_HERE).map(([c, [n]]) => [c, n])), ...AI_RUNS_C22, ...AI_RUNS_ACTS, ...PLANNING, ...USE };
  assert.deepEqual(Object.fromEntries(Object.entries(AI_RUNS_CHECKS).map(([c, r]) => [c, r.check])), want);
  const numbers = Object.values(AI_RUNS_CHECKS).map((r) => r.check);
  assert.equal(new Set(numbers).size, numbers.length, "one condition per C-number");
  for (const [code, row] of Object.entries(AI_RUNS_CHECKS)) wellFormed(code, row);
  for (const [code, [, site]] of Object.entries(MINTED_HERE)) assert.ok(AI_RUNS_CHECKS[code].where.startsWith(site), code);
  for (const code of [...Object.keys(AI_RUNS_C22), ...Object.keys(AI_RUNS_ACTS), ...Object.keys(PLANNING), ...Object.keys(USE)])
    assert.match(AI_RUNS_CHECKS[code].where, code === "NOT_YOUR_CEILING" ? /^src\/ai-use\/index\.mjs / : /^src\/ai-runs\/index\.mjs /,
      `${code} is minted by ${code === "NOT_YOUR_CEILING" ? "ai-use (its R2; B6)" : "ai-runs"}`);
  /* the families as published, one object across them */
  assert.deepEqual(Object.keys(AI_RUN_OWN_CHECKS).sort(), [...Object.keys(MINTED_HERE), ...Object.keys(AI_RUNS_C22)].sort());
  assert.equal(Object.keys(AI_RUN_ACT_SHAPE_CHECKS).length, 6);
  assert.deepEqual(Object.keys(AI_RUNS_CONTEXT_CHECKS), ["AI_RUNS_NO_CONTEXT_TYPE", "AI_RUNS_UNKNOWN_CONTEXT_TYPE", "AI_RUNS_NO_CONTEXT_ID"]);
  assert.deepEqual(Object.keys(SURFACE_RUN_CHECKS), ["SURFACE_NO_RUN", "SURFACE_RUN_NOT_RUNNING", "SURFACE_NO_BOUND", "SURFACE_BOUND_REACHED"]);
  assert.deepEqual(Object.keys(AI_RUN_OPEN_CHECKS), ["AI_RUN_MODE_NOT_DEPLOYED", "PART_NOT_PASSED"]);
  assert.deepEqual(Object.keys(RR.AI_RUN_IDEM_CHECKS), ["AI_RUN_IDEM_INVALID"]);
  for (const fam of [AI_RUN_OWN_CHECKS, AI_RUN_ACT_SHAPE_CHECKS, AI_RUNS_CONTEXT_CHECKS, SURFACE_RUN_CHECKS, AI_RUN_OPEN_CHECKS, RR.AI_RUN_IDEM_CHECKS, AI_RUN_PLAN_CHECKS, AI_USE_CHECKS])
    for (const [code, row] of Object.entries(fam)) assert.equal(AI_RUNS_CHECKS[code], row, code);
  /* each refusal R2–R8, R10, R17–R19, R23, R26 and R30 mint is built from its row here */
  const minted = [RR.checkBound("x"), RR.checkSkillVersion(""), RR.projectGate({ actor: "a", contextType: "project" }),
    RR.checkRunContextKind({ contextType: "x" }), RR.runPrincipalGate({}), RR.checkConsume({ fetches: -1 }, { map: true }),
    RR.checkConsume({ lease: 0 }, { map: true }), RR.checkConsume({ x: 1 }, { map: true }),
    RR.checkConsume([{ bound: "fetches" }], { list: true }), RR.checkRunState("x".repeat(262144)),
    RR.startAllowed({}), RR.checkVerification(null), RR.checkAskBounds({ turns: 13, bytes: 1, wall_ms: 1, reads: 1 }),
    RR.checkTestBarRecord(null), RR.checkPagesRead({ limits: [{ on: true }] }), RR.originAllowed({}),
    RR.originAllowed({ origin: "explore" }), RR.partRefusal("ask"), RR.levelEmptyHolds({ scope: { documents: 0 } }),
    RR.partRefusal("check", "A", { set: { id: "s", version: 1, matters: [{ id: "M1" }] }, held: { testBars: [{ part: "check",
      entry_id: "A", set: "s", set_version: 1, false_alarm_rate: 0, passed: false, graded_by: "harness", at: "t" }] } })];
  assert.deepEqual(minted.map((r) => r.code), Object.keys(MINTED_HERE));
  /* R35's answer is a verdict, not a refusal: `holds: false` where the others say `ok: false` */
  for (const r of minted) assert.deepEqual([r.ok ?? r.holds, r.check, r.translation], [false, AI_RUNS_CHECKS[r.code].check, AI_RUNS_CHECKS[r.code].translation]);
});

test("R11: AI_RUN_CHECKS answers observation-log's C-22 rows and this table's as one map, and translationOf(code) a received code's translation from it, or null", () => {
  assert.deepEqual(Object.values(OBSERVATION_LOG_ROWS).map((r) => r.check).sort(), [...OBSERVATION_LOG_C22].sort());
  assert.deepEqual(Object.keys(AI_RUN_CHECKS).sort(), [...Object.keys(OBSERVATION_LOG_ROWS), ...Object.keys(AI_RUNS_CHECKS)].sort());
  for (const [code, row] of Object.entries(OBSERVATION_LOG_ROWS)) assert.equal(AI_RUN_CHECKS[code], row, `${code} is observation-log's own row`);
  for (const [code, row] of Object.entries(AI_RUNS_CHECKS)) assert.equal(AI_RUN_CHECKS[code], row, code);
  assert.ok(Object.isFrozen(AI_RUN_CHECKS));
  /* converted from airun's R35/R26 arm: every code's translation is a sentence, and translationOf answers each */
  for (const [code, row] of Object.entries(AI_RUN_CHECKS)) {
    assert.ok(row.translation.length >= 40, code);
    assert.equal(translationOf(code), row.translation, code);
  }
  for (const c of ["NOT_A_CODE", "", null, undefined, "__proto__", "toString", "constructor"]) assert.equal(translationOf(c), null, String(c));
});

test("R15: the rows of ai-runs R46–R47's codes join the table, each with its number and translation, minted by ai-runs; no later module's row is held here", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(AI_RUN_PLAN_CHECKS).map(([c, r]) => [c, r.check])), PLANNING);
  for (const [code, row] of Object.entries(AI_RUN_PLAN_CHECKS)) {
    wellFormed(code, row);
    assert.equal(AI_RUN_CHECKS[code], row);
    assert.equal(translationOf(code), row.translation);
    assert.equal(row.where, `src/ai-runs/index.mjs open > is-airun-open-${REGION[code] ?? "plan"}, reached from op=airunopen`);
    /* R31 (T46): the re-examination rows are words.json's, which say it as "Nothing was started:" */
    assert.match(row.translation, code.startsWith("AI_RUN_REEXAM_") ? /^Nothing was started: / : /^Nothing was run, because /,
                 `${code}: says nothing ran`);
  }
  /* no two planning codes share a sentence: each names its own condition */
  const texts = Object.values(AI_RUN_PLAN_CHECKS).map((r) => r.translation);
  assert.equal(new Set(texts).size, texts.length);
  /* control: action-plans' planning codes are that module's rows, not this table's */
  for (const code of Object.keys(AI_RUN_CHECKS)) assert.doesNotMatch(code, /^ACTION_PLAN|^PLAN_/, code);
});

test("R12: no place is named in the module's behaviour or outward text — its rows' translations, its vocabularies' sentences, its refusals' details, the deployment order", () => {
  const PLACE = /oakland|alameda|california|berkeley|san francisco|sacramento|\bcounty of\b|\bcity of\b/i;
  const texts = [
    ...Object.values(AI_RUNS_CHECKS).map((r) => r.translation),
    ...Object.values(RR.RUN_BOUNDS), ...Object.values(RR.RUN_ENDINGS), ...Object.values(RR.STANDARD_BASIS),
    ...Object.values(RR.RUN_CONTEXTS), ...Object.values(RR.PROJECT_GATE_GROUNDS),
    RR.checkBound("x").detail, RR.checkConsume({ x: 1 }, { map: true }).detail, RR.checkConsume("x", { map: true }).detail,
    RR.checkConsume({ lease: 1 }, { map: true }).detail, RR.checkConsume({ mints: 1 }, { map: true }).detail,
    RR.checkConsume({ fetches: -1 }, { map: true }).detail, RR.checkConsume([{ bound: "fetches" }], { list: true }).detail,
    RR.checkConsume({ a: 1 }, { list: true }).detail, RR.checkConsume([3], { list: true }).detail,
    RR.checkSkillVersion("3").detail, RR.checkSkillVersion("").detail,
    RR.projectGate({ actor: "a", contextType: "project", contextId: "P" }).detail,
    RR.checkRunContextKind({ contextType: "x" }).detail, RR.checkRunContextKind({ contextType: "project" }).detail,
    RR.runPrincipalGate({}).detail, RR.runPrincipalGate({ act: "x" }).detail,
    RR.checkRunState({ notes: "x".repeat(262144) }).detail,
    JSON.stringify(RR.DEPLOYMENT_SEQUENCE), JSON.stringify(RR.ASK_MODE), JSON.stringify(RR.DRAFT_MODE), JSON.stringify(RR.ASK_BOUNDS),
    JSON.stringify(RR.VERIFICATION_RECORDED), RR.startAllowed({}).detail,
    RR.startAllowed({ mode: "check", standing: { author: "member:a" } }).detail, RR.startAllowed({ mode: "draft" }).detail,
    RR.checkVerification({}).detail,
    RR.checkAskBounds([]).detail, RR.checkAskBounds({ x: 1 }).detail, RR.checkAskBounds({ turns: 0 }).detail,
    RR.checkAskBounds({ turns: 1.5 }).detail, RR.checkAskBounds({ turns: 99 }).detail, RR.checkAskBounds({}).detail,
    JSON.stringify(RR.ENQUIRE_MODE), JSON.stringify(RR.DRAFT_REACH), JSON.stringify(RR.TEST_BAR_RECORD),
    JSON.stringify(RR.TEST_MATTER_SHAPE), JSON.stringify(RR.CIVICSMITH_TEST_SET), ...RR.RUN_ORIGINS,
    RR.checkTestBarRecord({}).detail, RR.checkPagesRead({ limits: [{}] }).detail, RR.originAllowed({ origin: "explore" }).detail,
    RR.originAllowed({ origin: "x" }).detail, RR.startAllowed({ mode: "enquire" }).detail,
    RR.originAllowed({ origin: "x", mode: "plan" }).detail, JSON.stringify(RR.ACTION_DRAFTS), ...RR.PLAN_ORIGINS,
    RR.partRefusal("ask").detail, JSON.stringify(RR.untestedLabel("ask")), RR.UNTESTED_WORDS, ...Object.values(RR.RUN_RULES_WORDS),
  ];
  for (const t of texts) assert.equal(PLACE.test(String(t)), false, String(t).slice(0, 80));
  /* control: the pattern does catch a place */
  assert.equal(PLACE.test("the City of Anywhere"), true);
});

test("R20: AI_NO_ACCOUNT, R18's AI_RUN_NOT_A_MEMBER_ACT and NOT_YOUR_CEILING are rows of the table, each with its number and a plain-words translation naming no cost (D12: a cost is answered only to the paying account's owners, by ai-use R10, R11, and these rows are read by any member); minted by ai-runs and answers (NOT_YOUR_CEILING by ai-use, B6) and read here by key", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(AI_USE_CHECKS).map(([c, r]) => [c, r.check])), USE);
  const all = { ...AI_USE_CHECKS, AI_RUN_NOT_A_MEMBER_ACT: AI_RUN_OWN_CHECKS.AI_RUN_NOT_A_MEMBER_ACT };
  for (const [code, row] of Object.entries(all)) {
    wellFormed(code, row);
    assert.equal(AI_RUN_CHECKS[code], row, code);
    assert.equal(translationOf(code), row.translation, code);
    assert.match(row.translation, SETTING.includes(code) ? /^Nothing was changed, because / : /^Nothing was (run|started), because /,
                 `${code}: says nothing ran or changed`);
    /* D12 (K1450 as amended): no translation names a price, a charge or a figure of money to whoever reads it */
    assert.doesNotMatch(row.translation, /\$|\bcost|\bprice|\bcharge|\bdollar|\bspend|\bbill|\btokens?\b|\bcredit/i, code);
    assert.doesNotMatch(row.translation, /\b[A-Z][A-Z_]{3,}\b/, `${code}: plain words, no machine word`);
  }
  /* B6 (K2514): AI_NO_ACCOUNT is minted by ai-runs (and answers); NOT_YOUR_CEILING by ai-use alone (its R2) */
  assert.match(AI_USE_CHECKS.AI_NO_ACCOUNT.where, /^src\/ai-runs\/index\.mjs /);
  assert.match(AI_USE_CHECKS.NOT_YOUR_CEILING.where, /^src\/ai-use\/index\.mjs /);
  assert.match(AI_RUN_OWN_CHECKS.AI_RUN_NOT_A_MEMBER_ACT.where, /^src\/run-rules\/rules\.mjs startAllowed, called from src\/ai-runs\/index\.mjs .* answers$/);
  assert.match(AI_USE_CHECKS.AI_NO_ACCOUNT.translation, /Claude account or an API key of your own/);
  /* K1755: the group's API key, held by an administrator and switched on, also serves a member; the row says both */
  assert.match(AI_USE_CHECKS.AI_NO_ACCOUNT.translation, /your team has no API key of its own switched on/);
  /* T40 (N812): or the account that would serve has this use switched off */
  assert.match(AI_USE_CHECKS.AI_NO_ACCOUNT.translation, /or the account that would serve has this use switched off/);
  assert.doesNotMatch(AI_USE_CHECKS.AI_NO_ACCOUNT.translation, /works only on the account of the member who asks/);
  assert.match(AI_USE_CHECKS.NOT_YOUR_CEILING.translation, /theirs alone to set or look at/);
  /* K1610: the copy's ceiling is refused NOT_AN_ADMIN, so this row names neither it nor its setter */
  assert.equal(AI_USE_CHECKS.NOT_YOUR_CEILING.where, "src/ai-use/index.mjs aiLimitSet, aiUsage, exploreApprove, estimate and "
    + "aiLimits (a member's account, its owner bar) and aiUsageMine, reached from op=ailimitset, op=aiusage, op=exploreapprove, "
    + "op=ailimits and ai-runs' batch estimate");
  /* B6: the retired ceiling acts of ai-runs are named nowhere in the row */
  assert.doesNotMatch(AI_USE_CHECKS.NOT_YOUR_CEILING.where, /ai-runs\/|aiCeilingSet/);
  assert.doesNotMatch(AI_USE_CHECKS.NOT_YOUR_CEILING.where + AI_USE_CHECKS.NOT_YOUR_CEILING.translation, /aiCopyCeilingSet|administrator|copy/);
  const texts = Object.values(all).map((r) => r.translation);
  assert.equal(new Set(texts).size, texts.length);
  /* control: the cost pattern does catch a cost */
  assert.match("this answer cost $0.02", /\$|\bcost/i);
});

test("R20 (T40; N812; K2373, K2400): AI_USE_CEILING_REACHED, AI_USE_COPY_CEILING_REACHED and AI_CEILING_INVALID are retired — no row of the table, no translation, each held in RETIRED_CHECKS with its number, never reused, and its ai-use replacement; NOT_YOUR_CEILING stays", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(RETIRED_CHECKS).map(([c, r]) => [c, [r.check, r.retired_for]])), RETIRED);
  assert.ok(Object.isFrozen(RETIRED_CHECKS));
  for (const r of Object.values(RETIRED_CHECKS)) assert.ok(Object.isFrozen(r));
  for (const code of Object.keys(RETIRED)) {
    assert.equal(Object.prototype.hasOwnProperty.call(AI_RUN_CHECKS, code), false, `${code} has no row`);
    assert.equal(Object.prototype.hasOwnProperty.call(AI_USE_CHECKS, code), false, code);
    assert.equal(translationOf(code), null, `${code} has no translation here`);
  }
  /* never reused: no row of the one map holds a retired number */
  const live = new Set(Object.values(AI_RUN_CHECKS).map((r) => r.check));
  for (const [code, [n]] of Object.entries(RETIRED)) assert.equal(live.has(n), false, `${n} (${code}) is not reused`);
  /* ai-use's rows are its own: none of its codes is a row here */
  for (const c of ["AI_LIMIT_REACHED", "AI_LIMIT_INVALID", "AI_USE_SWITCHED_OFF"]) assert.equal(translationOf(c), null, c);
  /* control: NOT_YOUR_CEILING and AI_NO_ACCOUNT stay, with their numbers */
  assert.equal(AI_RUN_CHECKS.NOT_YOUR_CEILING.check, "C-109.11");
  assert.equal(AI_RUN_CHECKS.AI_NO_ACCOUNT.check, "C-109.10");
});

test("R11, R20 (DEC-149, T34-86): a string a member reads names the group's Civicsmith as \"your group's Civicsmith\" — C-33.29 and C-109.1 say it (C-109.9 retired, R20), and STANDARD_BASIS' none-recorded needs no name; no translation or vocabulary sentence of this module says instance, copy, plane or server", () => {
  const named = {
    AI_RUN_CAPABILITY_UNAVAILABLE: WORD("refusal.AI_RUN_CAPABILITY_UNAVAILABLE"),
    AI_RUN_MODE_NOT_DEPLOYED: WORD("refusal.AI_RUN_MODE_NOT_DEPLOYED"),
  };
  for (const [code, text] of Object.entries(named)) {
    assert.equal(AI_RUNS_CHECKS[code].translation, text, code);
    assert.equal(translationOf(code), text, code);
  }
  assert.equal(RR.STANDARD_BASIS["none-recorded"], localize("run-rules.rules.basis_none_recorded", "no bar was recorded when this run was formed, and none is filled in afterwards"));
  /* every member-facing sentence this module holds: its rows' translations and its vocabularies' values */
  const OLD = /\b(instances?|cop(y|ies)|planes?|servers?)\b/i;
  const member = [...Object.entries(AI_RUNS_CHECKS).map(([c, r]) => [c, r.translation]),
    ...[RR.RUN_BOUNDS, RR.RUN_ENDINGS, RR.STANDARD_BASIS, RR.RUN_CONTEXTS, RR.PROJECT_GATE_GROUNDS]
      .flatMap((o) => Object.entries(o))];
  for (const [k, t] of member) assert.doesNotMatch(t, OLD, k);
  /* control: the pattern catches each old name */
  for (const t of ["this instance", "the team's copy", "the plane does", "the server"]) assert.match(t, OLD);
});
