/* op-grades: T45's grades (R32), at the module's exports. Every op T45's owners serve (the ops `op-declarations` R49
   declares), graded by R5 and R3, each op named here with the grade read from its owner's requirements. `op-declarations`
   merges after this module in layer 11, so the totality is held here over a stand-in of the table it declares, by
   `affordances` R12's rule; the real totality runs again at its merge. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import * as T45 from "../../../src/op-grades/t45.mjs";
import { reqText, between, ticked, readRows, asksNotTheAccount } from "./declared.mjs";

/** @param {string} op @returns {string | null | undefined} */
const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op]?.ground : null;
/** @param {string} op */
const isRead = (op) => {
  const sentence = NON_ACTS[op];
  return typeof sentence === "string" && sentence.startsWith("read: ") && /writes nothing$/.test(sentence);
};
/** @param {{ [op: string]: string }} ops */
const grades = (ops) => Object.fromEntries(Object.keys(ops).map((op) => [op, gradeOf(op)]));

/* R32's grades, op by op, each read from its owner */
/** @type {{ [op: string]: string }} */
const R32_WRITES = {
  /* action-plans R39, R40 */
  scenariosetaside: "reasoned", scenariorestore: "reasoned", planpause: "reasoned", planresume: "reasoned",
  /* answers R34 (R32: a member's own standing question) */
  standingendset: "caller-owned",
  /* duties R30 (as dutypropose) */
  dutyfromresponse: "undetermined",
  /* actions R80, R87, R88 */
  actionreceipt: "undetermined", actionscope: "reasoned", actionpromise: "reversible",
  /* action-holds R11, R12 */
  holdnoticesent: "undetermined", pressurerecord: "undetermined",
  /* following R22, R23, R25 (R32 names them) */
  followend: "reversible", watchlink: "undetermined", watchanswer: "undetermined",
  /* filings R36, R42, R47 */
  filingsecondapprove: "terminal", jointsignatory: "undetermined", holdnoticeprepare: "undetermined",
  /* case-check R1 (graded as publish, K2839; terminal with it since R37, T47) */
  publishcheck: "terminal",
  /* project-roster R21, R24 */
  projectscopeset: "reasoned", projectapprovalset: "reasoned",
  /* action-replies R1, R2 */
  actionreplybearing: "reversible", actionbearingpropose: "reversible", arosefrom: "undetermined",
  /* consequences R17, R21, R22 */
  successrecord: "undetermined", successrevise: "reasoned", outcomecarry: "undetermined",
  /* plan-work R1, R4, R5, R6, R8, R11 */
  matteroutcomeset: "reversible", planreviewrhythm: "caller-owned", planreviewrecord: "undetermined",
  prepitemadd: "undetermined", prepitemtakeup: "caller-owned", prepitemdone: "undetermined", plancomment: "reversible",
  statusreportsave: "undetermined", itemtakeup: "caller-owned",
  /* action-clocks R18 (as clockadopt) */
  clockstate: "undetermined",
  /* conformance R36 */
  curelink: "reversible", cureunlink: "reasoned",
  /* local-facts R10, R11, R13 */
  ruledraft: "reasoned", ruleconfirm: "undetermined", rulewithdraw: "reasoned",
  /* instance-setup R77 (B6, K2896; as coarchiveset) */
  declaredstakeset: "reversible",
  /* (T46; K2881) case-account R13, declared after the T45 merge: kept in her own hidden project, no reason asked */
  advocacycheck: "undetermined",
};
/* the code each `reasoned` op's owner refuses an absent reason with */
/** @type {{ [op: string]: string }} */
const R32_CODES = {
  scenariosetaside: "PLAN_NO_REASON", scenariorestore: "PLAN_NO_REASON", planpause: "PLAN_NO_REASON",
  planresume: "PLAN_NO_REASON", actionscope: "SCOPE_NO_REASON", projectscopeset: "NO_REASON",
  projectapprovalset: "NO_REASON", successrevise: "SUCCESS_NO_REASON", cureunlink: "CONFORMANCE_NO_REASON",
  ruledraft: "RULE_NO_REASON", rulewithdraw: "RULE_NO_REASON",
};
/* each `reversible` op and the owner's published act that takes it back (R3) */
/** @type {{ [op: string]: string }} */
const TAKEN_BACK_BY = {
  followend: "followend", actionpromise: "actionpromise", actionreplybearing: "actionreplybearing",
  actionbearingpropose: "actionbearingpropose", curelink: "cureunlink", matteroutcomeset: "matteroutcomeset",
  plancomment: "plancomment", declaredstakeset: "declaredstakeset",
};
/* every other op T45's owners serve: a read, or (statusreportdraft) a labeled draft that writes nothing */
const R32_READS = readRows(T45.T45_NON_ACTS);
/* (T46; K2881) agent-worker R76's two record drafts beside plan-work's */
const R32_DRAFTS = ["statusreportdraft", "infractiondraft", "bearingdraft"];
const ALL = [...Object.keys(R32_WRITES), ...R32_READS, ...R32_DRAFTS];
/* (K2885, K2887) T45's acts that affordances R51 makes ACTS rows on an action target: no NON_ACTS row, and those refused a
   machine by name in MACHINE_REFUSALS with their owners' codes (R32's T45 bullet) */
const R32_ACTS = [...ticked(between(reqText(32), "leave `NON_ACTS`:", "`MACHINE_REFUSALS` (R5) gains")), "holdnoticeprepare",
  "actionbearingpropose"].filter((op) => Object.hasOwn(R32_WRITES, op));
const R32_MACHINE = { holdnoticesent: "MACHINE_CANNOT_SEND", actionreceipt: "MACHINE_CANNOT_CORRESPOND",
  actionscope: "MACHINE_CANNOT_SET_SCOPE", actionpromise: "MACHINE_CANNOT_RECORD_PROMISE",
  actionreplybearing: "MACHINE_CANNOT_RECORD_BEARING", arosefrom: "MACHINE_CANNOT_LINK",
  clockstate: "MACHINE_CANNOT_STATE_CLOCK", itemtakeup: "MACHINE_CANNOT_PLAN" };

test("R32 (K2881): every write T45's owners serve carries R32's grade — the reasoned ones backed by their owner's code in JUSTIFICATION_REFUSALS, each reversible one taken back by a graded act of its owner, following's and answers' as R32 names them — each non-act with a NON_ACTS reason that is no read and no capture act, each act with none", () => {
  const got = grades(R32_WRITES);
  assert.deepEqual(got, R32_WRITES);
  assert.deepEqual(Object.keys(R32_WRITES).filter((op) => R32_WRITES[op] === "reasoned").sort(), Object.keys(R32_CODES).sort());
  for (const [op, code] of Object.entries(R32_CODES)) assert.ok(JUSTIFICATION_REFUSALS.includes(code), `${op}: ${code}`);
  assert.deepEqual(Object.keys(R32_WRITES).filter((op) => R32_WRITES[op] === "reversible").sort(),
    Object.keys(TAKEN_BACK_BY).sort());
  for (const [op, by] of Object.entries(TAKEN_BACK_BY)) assert.notEqual(gradeOf(by), null, `${op} taken back by ${by}`);
  for (const op of R32_ACTS) assert.ok(!Object.hasOwn(NON_ACTS, op), `${op} is an act, never a non-act too`);
  for (const op of Object.keys(R32_WRITES).filter((op) => !R32_ACTS.includes(op))) {
    assert.ok(typeof NON_ACTS[op] === "string" && NON_ACTS[op].length > 40 && !NON_ACTS[op].startsWith("read: "), op);
    assert.ok(!NON_ACTS[op].startsWith("capture-directed:"), `${op} is no capture act`);
    assert.ok(!NON_ACTS[op].startsWith("draft: "), `${op} writes`);
  }
  for (const [op, e] of Object.entries(T45.T45_RUNG_ABSENT)) assert.ok(e.is.length > 60, op);
  /* each beside the precedent R32 reads it by */
  /** @type {[string, string][]} */
  const likenesses = [["dutyfromresponse", "dutypropose"], ["pressurerecord", "actionpressure"],
    ["filingsecondapprove", "filingapprove"], ["holdnoticeprepare", "communicationprepare"], ["clockstate", "clockadopt"],
    ["statusreportsave", "reportkeep"], ["prepitemdone", "checkpointrecord"], ["ruleconfirm", "templateapprove"],
    ["plancomment", "reviewcomment"], ["actionbearingpropose", "actionseekspropose"], ["publishcheck", "publish"],
    ["itemtakeup", "reminderset"], ["standingendset", "standingend"], ["declaredstakeset", "coarchiveset"],
    ["advocacycheck", "captureupload"]];
  for (const [op, like] of likenesses)
    assert.equal(gradeOf(op), gradeOf(like), `${op} as ${like}`);
  /* negative controls: a misgrade is seen, and the grounds class (K1025) is not extended */
  assert.notDeepEqual({ ...got, actionscope: "undetermined" }, R32_WRITES);
  assert.notEqual(gradeOf("actionreceipt"), gradeOf("actioncorrespond"));
  assert.notEqual(gradeOf("successrecord"), gradeOf("consequencerecord"));
});

test("R32 (K2881): every other op T45's owners serve is a read, a NON_ACTS row beginning `read: …` that writes nothing and takes no grade; statusreportdraft is a draft, `draft: …`, writing nothing", () => {
  for (const op of R32_READS) {
    assert.ok(isRead(op) && (NON_ACTS[op] ?? "").length > 30, op);
    assert.equal(gradeOf(op), null, op);
  }
  for (const op of R32_DRAFTS) {
    const sentence = NON_ACTS[op] ?? "";
    assert.ok(sentence.startsWith("draft: ") && /writes nothing of the record/.test(sentence), op);
    assert.equal(gradeOf(op), null, op);
  }
  /* (T46; K2881) the two record drafts each name what they answer and that a member's own act keeps it */
  assert.match(NON_ACTS.infractiondraft ?? "", /infraction for one audience/);
  assert.match(NON_ACTS.bearingdraft ?? "", /bearing of each claim/);
  /* negative control */
  assert.ok(!isRead("successrecord"));
  assert.ok(!isRead("advocacycheck") && (NON_ACTS.advocacycheck ?? "").startsWith("project-directed: "));
});

test("R32 R1 (K2857): JUSTIFICATION_REFUSALS gains the codes T45's owners refuse an absent reason with — SCOPE_NO_REASON, ADDRESSED_NO_REASON (addressedrecord's, in place of NO_REASON), SUCCESS_NO_REASON, RULE_NO_REASON — and the reasons R32 names inside existing acts, CONTRADICTED_HELD, DOCUMENT_FIRST_NO_REASON and OVERRIDE_NO_GROUND, each once; the objects they ask for stay out; no existing rung changes", () => {
  for (const c of ["SCOPE_NO_REASON", "ADDRESSED_NO_REASON", "SUCCESS_NO_REASON", "RULE_NO_REASON", "CONTRADICTED_HELD",
    "DOCUMENT_FIRST_NO_REASON", "OVERRIDE_NO_GROUND"])
    assert.equal(JUSTIFICATION_REFUSALS.filter((x) => x === c).length, 1, c);
  assert.equal(new Set(JUSTIFICATION_REFUSALS).size, JUSTIFICATION_REFUSALS.length, "no code twice");
  /* the codes that ask an object, a choice or a form, never an account, stay out */
  assert.deepEqual(JUSTIFICATION_REFUSALS.filter(asksNotTheAccount), []);
  for (const c of ["SCOPE_UNCHANGED", "NO_SUCH_SCENARIO", "MACHINE_CANNOT_SET_SCOPE"]) assert.ok(asksNotTheAccount(c), c);
  /* the rungs of the existing acts those reasons sit inside are unchanged (R3's 21 hold optionstart) */
  assert.deepEqual([RUNGS.filingapprove, RUNG_ABSENT.optionstart?.ground, RUNGS.addressedrecord],
    ["terminal", "undetermined", "reasoned"]);
});

test("R32 R5 R18 R21 R37: of T45's ops MACHINE_REFUSALS holds exactly the eight acts R32 names, each with its owner's code, the two that admit a machine none; phone follows the rung (publishcheck and filingsecondapprove, terminal, off the phone); none carries the Irreversible weight (publishcheck left it with publish at R37); no consequence statement, larger-screen entry or alias is added", () => {
  assert.deepEqual(Object.fromEntries(ALL.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)).map((op) => [op, MACHINE_REFUSALS[op]])),
    R32_MACHINE);
  for (const op of ["holdnoticeprepare", "actionbearingpropose"]) assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  assert.deepEqual(ALL.filter((op) => !phoneOf(op)).sort(), ["filingsecondapprove", "publishcheck"]);
  assert.deepEqual(ALL.filter((op) => IRREVERSIBLE_WEIGHT.includes(op)), []);
  for (const op of ALL) {
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), op);
  }
  /* B6: an administrator's setting refused NOT_AN_ADMIN, no act and no machine refusal */
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "declaredstakeset") && (NON_ACTS.declaredstakeset ?? "").startsWith("setting: "));
  /* negative control: a reasoned T45 op is a phone act */
  assert.equal(phoneOf("actionscope"), true);
});

test("R32: T45's tables hold exactly these ops, none both graded and stated absent; the assertion resolution is filings' approval (reconciliation R1), no op of its own", () => {
  assert.deepEqual(Object.keys(T45).sort(), ["T45_NON_ACTS", "T45_RUNGS", "T45_RUNG_ABSENT"]);
  assert.deepEqual([...Object.keys(T45.T45_RUNGS), ...Object.keys(T45.T45_RUNG_ABSENT)].sort(), Object.keys(R32_WRITES).sort());
  assert.deepEqual(Object.keys(T45.T45_NON_ACTS).sort(), ALL.filter((op) => !R32_ACTS.includes(op)).sort());
  for (const [op, v] of Object.entries(T45.T45_RUNGS)) assert.equal(RUNGS[op], v, op);
  for (const [op, e] of Object.entries(T45.T45_RUNG_ABSENT)) assert.equal(RUNG_ABSENT[op], e, op);
  for (const [op, w] of Object.entries(T45.T45_NON_ACTS)) assert.equal(NON_ACTS[op], w, op);
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
  for (const t of [RUNGS, RUNG_ABSENT, NON_ACTS]) assert.ok(!Object.keys(t).some((op) => /assertionresol/.test(op)));
  /* not served in T45 (escalation R31, T46): no grade yet */
  for (const op of ["escalationstoppursuing", "escalationreopen"]) assert.equal(Object.hasOwn(NON_ACTS, op), false, op);
});

/* `unaccounted`'s two totalities over a stand-in of op-declarations R49's rows (t41.test.mjs' shape): each write
   mutating, each read and the draft not, every op gated by a NEEDS row */
const STAND_IN = [...Object.keys(R32_WRITES).map((op) => ({ op, mutating: true, gated: true })),
  ...[...R32_READS, ...R32_DRAFTS].map((op) => ({ op, mutating: false, gated: true }))];
/** @typedef {{ op: string, mutating: boolean, gated: boolean }} StandInRow */
/** @param {StandInRow[]} rows @param {string[]} [acts] */
const unaccountedOver = (rows, acts = R32_ACTS) => {
  const mutating = new Set(rows.filter((r) => r.mutating).map((r) => r.op));
  const gated = new Set(rows.filter((r) => r.gated).map((r) => r.op));
  return {
    unpublished: [...gated].filter((op) => !Object.hasOwn(NON_ACTS, op) && !acts.includes(op)).sort(),
    unranked: [...mutating].filter((op) => !Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op)).sort(),
    stale: rows.map((r) => r.op).filter((op) => !mutating.has(op) && (Object.hasOwn(RUNGS, op)
      || Object.hasOwn(RUNG_ABSENT, op)) || !gated.has(op) && Object.hasOwn(NON_ACTS, op)).sort(),
  };
};
test("R32: affordances R12's totality holds over a stand-in of op-declarations R49's rows — none unpublished, unranked or stale", () => {
  assert.deepEqual(unaccountedOver(STAND_IN), { unpublished: [], unranked: [], stale: [] });
  /* negative control: without affordances' ACTS rows (T45-39), the acts read unpublished */
  assert.deepEqual(unaccountedOver(STAND_IN, []).unpublished, [...R32_ACTS].sort());
  /* negative controls: an ungraded new op is unranked and unpublished; a write carried as a read is stale */
  const left = unaccountedOver([...STAND_IN, { op: "plannew", mutating: true, gated: true }]);
  assert.deepEqual([left.unranked, left.unpublished], [["plannew"], ["plannew"]]);
  assert.deepEqual(unaccountedOver(STAND_IN.map((r) => r.op === "curelink" ? { ...r, mutating: false } : r)).stale, ["curelink"]);
});

/* ---- R32 (T46; K2881, K2996): the five ops op-declarations declared after the T45 merge, each by name ------------- */
test("R32 (K2881, K2996): grouprules and advocacychecks reads, advocacycheck `undetermined` and project-directed, infractiondraft and bearingdraft drafts with no rung; none an act or a machine refusal; every one a phone act", () => {
  assert.equal(gradeOf("advocacycheck"), "undetermined");
  assert.match(RUNG_ABSENT.advocacycheck?.is ?? "", /\(case-account R13\)$/);
  assert.match(NON_ACTS.advocacycheck ?? "", /^project-directed: keyed by the member's own hidden project/);
  for (const op of ["grouprules", "advocacychecks"]) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  for (const op of ["infractiondraft", "bearingdraft"]) {
    const sentence = NON_ACTS[op] ?? "";
    assert.ok(sentence.startsWith("draft: ") && /writes nothing of the record/.test(sentence), op);
    assert.equal(gradeOf(op), null, op);
  }
  /* the five T46 adds to T45's tables beside R32's first lists (K2881, K2996): the last reads and drafts, the check */
  const FIVE = [...R32_READS.slice(-2), ...Object.keys(R32_WRITES).filter((op) => op === "advocacycheck"), ...R32_DRAFTS.slice(-2)];
  assert.equal(FIVE.length, 5);
  assert.deepEqual(FIVE.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.deepEqual(FIVE.map(phoneOf), FIVE.map(() => true));
  /* negative controls: the check is no read and no draft; a draft graded as a write would be seen */
  assert.ok(!isRead("advocacycheck") && !(NON_ACTS.advocacycheck ?? "").startsWith("draft: "));
  assert.notEqual(gradeOf("advocacycheck"), "caller-owned");
  assert.ok(!Object.hasOwn(RUNGS, "infractiondraft") && !Object.hasOwn(RUNG_ABSENT, "bearingdraft"));
});
