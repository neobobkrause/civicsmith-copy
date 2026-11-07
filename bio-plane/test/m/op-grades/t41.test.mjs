/* op-grades: the handle ops' grades (R29) and T41's grades (R30), at the module's exports. Every op `op-declarations`
   R41, R42, R43 and R45 declares, with `actionseekspropose` (`actions` R73), graded by R5 and R3, each op named here and
   each grade read from its owner's requirements; the four ops DEC-188 (8) retires gone from every table. `op-declarations`
   merges after this module (K2507), so the totality is held here over a stand-in of the table it declares, by
   `affordances` R12's rule; the real totality runs again at its merge. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import { T41_RUNGS, T41_RUNG_ABSENT, T41_NON_ACTS } from "../../../src/op-grades/t41.mjs";
import { reqText, between, ticked, readRows, declaredSentence } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;
const isRead = (op) => typeof NON_ACTS[op] === "string" && NON_ACTS[op].startsWith("read: ");
const grades = (ops) => Object.fromEntries(Object.keys(ops).map((op) => [op, gradeOf(op)]));

/* ---- R29 ----------------------------------------------------------------------------------------------------------- */
test("R29 R34: handlechange `caller-owned` as setpassword, its member-directed sentence stating the refusal it is (T46, "
   + "R34); handlecheck a read that never names who holds a handle; neither a machine refusal; both phone acts", () => {
  assert.equal(gradeOf("handlechange"), "caller-owned");
  assert.equal(gradeOf("handlechange"), gradeOf("setpassword"));
  assert.equal(NON_ACTS.handlechange, "member-directed: a handle is fixed at joining; this act refuses every change, "
    + "`HANDLE_FIXED`, and writes nothing");
  assert.equal(NON_ACTS.handlecheck, declaredSentence("member-roster", "handlecheck"));
  assert.equal(gradeOf("handlecheck"), null, "a read takes no grade");
  assert.deepEqual(["handlechange", "handlecheck"].filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.deepEqual(["handlechange", "handlecheck"].map(phoneOf), [true, true]);
  /* negative control */
  assert.notEqual(gradeOf("handlecheck"), "caller-owned");
});

/* ---- R30 ----------------------------------------------------------------------------------------------------------- */
/* R30's grades, op by op, as it states them */
const R30_WRITES = {
  projectaikeepaway: "reasoned", milestoneremove: "reasoned", milestoneitemremove: "reasoned",
  projectclosewithgaps: "reasoned", hypothesissetaside: "reasoned", guidereview: "reasoned", guideretire: "reasoned",
  stepaccept: "reasoned",
  stepcreate: "reversible", stepstart: "reversible", stepend: "reversible", stepwait: "reversible",
  stepwaitremove: "reversible", stepcostadd: "reversible", stepcostremove: "reversible", questionfollow: "reversible",
  stepsrunai: "reversible", milestoneset: "reversible", milestonerevise: "reversible", hypothesistakeup: "reversible",
  noteshare: "reversible", noteunshare: "reversible", approvalruleset: "reversible", actionseekspropose: "reversible",
  stepoutcome: "reversible", stepbywhen: "reversible",
  accountusesset: "substrate", ailimitset: "substrate", exploreapprove: "substrate",
  stepreminder: "caller-owned", milestonereminder: "caller-owned",
  findmute: "caller-owned",
  readpages: "observational",
  stepdelete: "undetermined", steprefer: "undetermined", stepproduct: "undetermined", costmessage: "undetermined",
  findaccept: "undetermined", reportkeep: "undetermined", interviewkeep: "undetermined", narrativeclaim: "undetermined",
  claimfindstep: "undetermined", claimfound: "undetermined", planaccept: "undetermined", projectwatch: "undetermined",
  proposalaccept: "undetermined", bearingnote: "undetermined", guidedraft: "undetermined", guideoffer: "undetermined",
  guideadopt: "undetermined", accountpropose: "undetermined", caseapprove: "undetermined", grouptestset: "undetermined",
  captureupload: "undetermined", steplearn: "undetermined",
  guidepropose: "reversible", guideproposetocivicsmith: "undetermined",
};
/* the code each `reasoned` op's owner refuses an absent reason with (driven in affordances' R19 tests) */
const R30_CODES = {
  projectaikeepaway: "AI_KEEP_AWAY_NO_REASON", milestoneremove: "INVESTIGATION_NO_REASON",
  milestoneitemremove: "INVESTIGATION_NO_REASON", projectclosewithgaps: "CLOSE_BAD_REASON",
  hypothesissetaside: "PROPOSAL_NO_REASON", guidereview: "GUIDE_REASON_MISSING", guideretire: "GUIDE_REASON_MISSING",
  stepaccept: "STEP_BAD_TEXT",
};
/* each `reversible` op and the owner's published act that takes it back (R3) */
const TAKEN_BACK_BY = {
  stepcreate: "stepend", stepstart: "stepend", stepend: "stepstart", stepwait: "stepwaitremove",
  stepwaitremove: "stepwait", stepcostadd: "stepcostremove", stepcostremove: "stepcostadd",
  questionfollow: "questionfollow", stepsrunai: "stepend", milestoneset: "milestoneremove",
  milestonerevise: "milestonerevise", hypothesistakeup: "hypothesiswithdraw", noteshare: "noteunshare",
  noteunshare: "noteshare", approvalruleset: "approvalruleset", actionseekspropose: "actionseekspropose",
  stepoutcome: "stepoutcome", stepbywhen: "stepbywhen", guidepropose: "guidedraft",
};
/* every other op of op-declarations R41, R43 and R45: a read */
/* T41's read rows (`handlecheck` is R29's); `aiusage`'s row is re-worded here (R30) and lives in T33's table */
const R30_READS = [...readRows(T41_NON_ACTS).filter((op) => op !== "handlecheck"), "aiusage"];
const RETIRED = ["aiceilingset", "aicopyceilingset", "accountswitchset", "groupswitchset"];

test("R30: every write op-declarations R41, R43 and R45 declares, and actionseekspropose, carries R30's grade, the "
   + "reasoned ones backed by their owner's code in JUSTIFICATION_REFUSALS and each reversible one taken back by a graded "
   + "act; each with a NON_ACTS reason that is no read and no capture act", () => {
  const got = grades(R30_WRITES);
  assert.deepEqual(got, R30_WRITES);
  assert.deepEqual(Object.keys(R30_WRITES).filter((op) => R30_WRITES[op] === "reasoned").sort(),
    Object.keys(R30_CODES).sort());
  for (const [op, code] of Object.entries(R30_CODES)) assert.ok(JUSTIFICATION_REFUSALS.includes(code), `${op}: ${code}`);
  assert.equal(new Set(JUSTIFICATION_REFUSALS).size, JUSTIFICATION_REFUSALS.length, "no code twice");
  assert.deepEqual(Object.keys(R30_WRITES).filter((op) => R30_WRITES[op] === "reversible").sort(),
    Object.keys(TAKEN_BACK_BY).sort());
  for (const [op, by] of Object.entries(TAKEN_BACK_BY)) assert.notEqual(gradeOf(by), null, `${op} taken back by ${by}`);
  for (const op of Object.keys(R30_WRITES)) {
    assert.ok(typeof NON_ACTS[op] === "string" && NON_ACTS[op].length > 30 && !isRead(op), op);
    assert.ok(!NON_ACTS[op].startsWith("capture-directed:"), `${op} is no capture act`);
  }
  for (const [op, e] of Object.entries(T41_RUNG_ABSENT)) assert.ok(e.is.length > 40, op);
  /* each beside the precedent R30 names */
  for (const [op, like] of [["findmute", "queuemute"], ["accountusesset", "keyedserviceswitch"],
    ["actionseekspropose", "actionlawspropose"]])
    assert.equal(gradeOf(op), gradeOf(like), `${op} as ${like}`);
  assert.match(NON_ACTS.actionseekspropose, /^action-directed: a machine \(or a member\) proposes/);
  /* negative controls: a misgrade is seen, and stepdelete, noteunshare and caseapprove are not `reasoned` (K2569) */
  assert.notDeepEqual({ ...got, stepdelete: "reasoned" }, R30_WRITES);
  assert.deepEqual(["stepdelete", "noteunshare", "caseapprove"].map(gradeOf), ["undetermined", "reversible", "undetermined"]);
});

test("R30: every other op of those lists is a read, a NON_ACTS row beginning `read: …` with no grade; aiusage's sentence "
   + "names no ceiling", () => {
  for (const op of R30_READS) {
    assert.ok(isRead(op) && NON_ACTS[op].length > 20, op);
    assert.equal(gradeOf(op), null, op);
  }
  assert.doesNotMatch(NON_ACTS.aiusage, /ceiling/);
  assert.match(NON_ACTS.aiusage, /limit/);
  /* negative control */
  assert.ok(!isRead("stepcreate"));
});

test("R30 R5 R18 R57: none of T41's ops is in MACHINE_REFUSALS; every one is a phone act (the project account's credential "
   + "acts, which answered phone false, left in T53, R57); no statement, weight, larger-screen entry or alias is added", () => {
  const ALL = [...Object.keys(R30_WRITES), ...R30_READS, "handlechange", "handlecheck"];
  assert.deepEqual(ALL.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.deepEqual(ALL.filter((op) => !phoneOf(op)).sort(), []);
  for (const op of ALL) {
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), op);
  }
  /* negative control: a credential ground is off the phone */
  assert.equal(phoneOf("keyedserviceset"), false);
});

test("R30 R25 (DEC-188 (8)): aiceilingset, aicopyceilingset, accountswitchset and groupswitchset leave RUNG_ABSENT and "
   + "NON_ACTS, as assistantset left them; no table names them", () => {
  for (const op of [...RETIRED, "assistantset"]) {
    for (const t of [RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS]) assert.ok(!Object.hasOwn(t, op), op);
    assert.equal(gradeOf(op), null, op);
  }
  /* negative control: a retired op left in a table would be seen */
  assert.ok(Object.hasOwn({ ...NON_ACTS, groupswitchset: "x" }, "groupswitchset"));
});

test("R29 R30: T41's tables hold exactly these ops, none both graded and stated absent", () => {
  const writes = [...Object.keys(R30_WRITES), "handlechange"].sort();
  assert.deepEqual([...Object.keys(T41_RUNGS), ...Object.keys(T41_RUNG_ABSENT)].sort(), writes);
  assert.deepEqual(Object.keys(T41_NON_ACTS).sort(),
    [...writes, ...R30_READS.filter((op) => op !== "aiusage"), "handlecheck"].sort());
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
});

/* ---- the totality over a stand-in table (affordances R12's rule; K2507) -------------------------------------------- */
/* The ops op-declarations R41, R42, R43 and R45 declare, with actionseekspropose, as `{op, mutating, gated}`: each act
   mutating, `readpages` mutating (it spends a run's bound), every op gated by a NEEDS row. `handlecheck` is public, with a
   `null` NEEDS row as `noticespublic`'s (op-declarations R42 as K2574 words it), so it is gated here. */
const STAND_IN = [
  ...Object.keys(R30_WRITES).map((op) => ({ op, mutating: true, gated: true })),
  { op: "handlechange", mutating: true, gated: true },
  ...R30_READS.map((op) => ({ op, mutating: false, gated: true })),
  { op: "handlecheck", mutating: false, gated: true },
];
/* `unaccounted`'s two totalities restricted to the stand-in's ops, so the rest of the table is not presumed */
const unaccountedOver = (rows) => {
  const mutating = new Set(rows.filter((r) => r.mutating).map((r) => r.op));
  const gated = new Set(rows.filter((r) => r.gated).map((r) => r.op));
  const named = new Set(rows.map((r) => r.op));
  return {
    unpublished: [...gated].filter((op) => !Object.hasOwn(NON_ACTS, op)).sort(),
    unranked: [...mutating].filter((op) => !Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op)).sort(),
    stale: [...named].filter((op) => !mutating.has(op) && (Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op))
      || !gated.has(op) && Object.hasOwn(NON_ACTS, op)).sort(),
  };
};

test("R29 R30: affordances R12's totality holds over a stand-in of the table op-declarations declares — no op "
   + "unpublished, unranked or stale, and every T41 table key is in the stand-in", () => {
  assert.deepEqual(unaccountedOver(STAND_IN), { unpublished: [], unranked: [], stale: [] });
  const named = new Set(STAND_IN.map((r) => r.op));
  for (const op of [...Object.keys(T41_RUNGS), ...Object.keys(T41_RUNG_ABSENT), ...Object.keys(T41_NON_ACTS)])
    assert.ok(named.has(op), op);
  /* negative controls: an op added and not graded is unranked, a graded read is stale */
  assert.deepEqual(unaccountedOver([...STAND_IN, { op: "stepnew", mutating: true, gated: true }]).unranked, ["stepnew"]);
  assert.deepEqual(unaccountedOver(STAND_IN.map((r) => r.op === "stepcreate" ? { ...r, mutating: false } : r)).stale,
    ["stepcreate"]);
});

/* ---- R30 (K2583, B3): the five reading-guides ops op-declarations adds ------------------------------------------------ */
test("R30 (K2583): guidepropose graded as extractpropose (run-directed, labeled machine work); guideproposetocivicsmith "
   + "`undetermined` as guideoffer; guidefor, guide and guideproposals reads; none a machine refusal, all phone acts", () => {
  assert.equal(gradeOf("guidepropose"), gradeOf("extractpropose"));
  assert.equal(gradeOf("guidepropose"), "reversible");
  assert.ok(NON_ACTS.guidepropose.startsWith("run-directed:") && NON_ACTS.extractpropose.startsWith("run-directed:"));
  assert.equal(gradeOf("guideproposetocivicsmith"), gradeOf("guideoffer"));
  assert.equal(gradeOf("guideproposetocivicsmith"), "undetermined");
  assert.ok(!isRead("guideproposetocivicsmith") && NON_ACTS.guideproposetocivicsmith.startsWith("guide-directed:"));
  for (const op of ["guidefor", "guide", "guideproposals"]) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  /* the ops R30's K2583 sentence names: guidepropose, guideproposetocivicsmith (and the likenesses extractpropose and
     guideoffer, which are graded already), the reads guidefor, guide and guideproposals */
  const FIVE = ticked(between(reqText(30), "(K2583)", "Every other op")).filter((op) => Object.hasOwn(NON_ACTS, op) && !["extractpropose", "guideoffer"].includes(op));
  assert.equal(FIVE.length, 5);
  assert.deepEqual(FIVE.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.deepEqual(FIVE.map(phoneOf), FIVE.map(() => true));
  /* negative controls */
  assert.notEqual(gradeOf("guidepropose"), "reasoned");
  assert.ok(!isRead("guidepropose"));
});
