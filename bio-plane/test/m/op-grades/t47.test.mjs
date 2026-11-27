/* op-grades: T47's grades (R35, R36, R37; K3104's `peopledirectory`), at the module's exports. Every op T47's owners add,
   graded by R5 and R3, each op named here with the grade read from its owner's requirements and a negative control
   (K874); R35's two ops leaving the `undetermined` ground; and `publish` re-graded as the preparation it now is (R37;
   K3100 doubt 9). `op-declarations` merges after this module in layer 11, so the totality is held here over a stand-in of
   the rows it declares (its R55, R57, R59, R61), by `affordances` R12's rule; the real totality runs again at its merge. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import * as T47 from "../../../src/op-grades/t47.mjs";
import { readRows, declaredSentence } from "./declared.mjs";

/** @param {string} op */
const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op]?.ground : null;
/** @param {string} op */
const isRead = (op) => {
  const why = NON_ACTS[op];
  return typeof why === "string" && why.startsWith("read: ") && /writes nothing$/.test(why) && why.length > 30;
};

/* R36's and R37's writes, op by op, each read from its owner */
/** @type {{ [op: string]: string }} */
const R36_WRITES = { drawquestion: "reversible", projectbarset: "reasoned", monitorset: "reversible" };
/** @type {{ [op: string]: string }} */
const R37_WRITES = { unlock: "credential", reauth: "credential", passwordresetlink: "credential",
  passwordreset: "credential", grouplogoset: "reversible", grouplanguagesset: "reversible", signrequest: "reversible" };
/** @type {{ [op: string]: string }} */
const WRITES = { ...R36_WRITES, ...R37_WRITES };
const READS = readRows(T47.T47_NON_ACTS);
const ALL = [...Object.keys(WRITES), ...READS];
/* each `reversible` op and the owner's published act that takes it back (R3) */
/** @type {{ [op: string]: string }} */
const TAKEN_BACK_BY = { drawquestion: "sever", monitorset: "monitorset", grouplogoset: "grouplogoset",
  grouplanguagesset: "grouplanguagesset", signrequest: "taskresolve" };

/* ---- R35 ----------------------------------------------------------------------------------------------------------- */
test("R35: deepercheck is held in RUNG_ABSENT under `observational`, as deeperbatch, its NON_ACTS sentence unchanged; inboxpull leaves RUNG_ABSENT for `reversible`, its NON_ACTS sentence unchanged; both phone acts, neither a machine refusal; control: safecopyrequest stays `undetermined`", () => {
  assert.equal(RUNG_ABSENT.deepercheck?.ground, "observational");
  assert.equal(gradeOf("deepercheck"), gradeOf("deeperbatch"), "as deeperbatch");
  assert.match(RUNG_ABSENT.deepercheck?.is ?? "", /verdict note naming no member/);
  assert.match(RUNG_ABSENT.deepercheck?.is ?? "", /\(file-safety R3, R10, R13\)$/);
  assert.equal(NON_ACTS.deepercheck, declaredSentence("file-safety", "deepercheck"));
  assert.equal(RUNGS.inboxpull, "reversible");
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "inboxpull"));
  assert.match(NON_ACTS.inboxpull ?? "", /^knock-directed: a member pulls one knock into the record/);
  /* the act R35 names as taking it back is graded */
  assert.equal(RUNGS.heldsetaside, "reasoned");
  assert.deepEqual(["deepercheck", "inboxpull"].map(phoneOf), [true, true]);
  for (const op of ["deepercheck", "inboxpull"]) assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  /* controls */
  assert.equal(RUNG_ABSENT.safecopyrequest?.ground, "undetermined");
  assert.notEqual(gradeOf("deepercheck"), "undetermined");
  assert.notEqual(gradeOf("inboxpull"), "undetermined");
});

/* ---- R36 ----------------------------------------------------------------------------------------------------------- */
test("R36: projectlist and projectquestions are reads, `read: …`, ungraded", () => {
  for (const op of ["projectlist", "projectquestions"]) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  assert.match(NON_ACTS.projectlist ?? "", /project-roster R26/);
  assert.match(NON_ACTS.projectquestions ?? "", /basis-versions R50/);
  /* negative control */
  assert.ok(!isRead("drawquestion"));
});

test("R36: drawquestion `reversible` as cite, sever taking the edge back; its NON_ACTS sentence word for word", () => {
  assert.equal(RUNGS.drawquestion, "reversible");
  assert.equal(gradeOf("drawquestion"), gradeOf("cite"), "as cite");
  assert.equal(NON_ACTS.drawquestion, declaredSentence("citation", "drawquestion"));
  /* BAD_NOTE is a note's shape, never a reason (control) */
  assert.ok(!JUSTIFICATION_REFUSALS.includes("BAD_NOTE"));
  assert.notEqual(gradeOf("drawquestion"), "reasoned");
});

test("R36: projectbarset `reasoned`, PROJECT_BAR_NO_REASON joining JUSTIFICATION_REFUSALS once; its sentence never the group's bar, gating nothing; no consequence statement, unlike strengthbar", () => {
  assert.equal(RUNGS.projectbarset, "reasoned");
  assert.equal(JUSTIFICATION_REFUSALS.filter((c) => c === "PROJECT_BAR_NO_REASON").length, 1);
  assert.equal(NON_ACTS.projectbarset, declaredSentence("strength", "projectbarset"));
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "projectbarset"));
  /* control: the group's bar keeps its statement and its own code */
  assert.ok(Object.hasOwn(CONSEQUENCE_STATEMENTS, "strengthbar"));
  assert.ok(JUSTIFICATION_REFUSALS.includes("BAR_NO_REASON"));
});

test("R36: monitorset `reversible`, a later monitorset taking it back; its NON_ACTS sentence word for word", () => {
  assert.equal(RUNGS.monitorset, "reversible");
  assert.equal(NON_ACTS.monitorset, declaredSentence("monitoring", "monitorset"));
  /* control: the monitor tick stays a capture act's reason and its own ground */
  assert.equal(RUNG_ABSENT.monitor?.ground, "observational");
  assert.notEqual(NON_ACTS.monitorset, NON_ACTS.monitor);
});

test("R36: sever and reinstate keep `reasoned` (R1), ACTS rows with no NON_ACTS row, their backing naming a question's own legs beside a project's cites (citation R15); capturerequest keeps `substrate`, both its sentences naming a member's own request beside a run's (capture-requests R56)", () => {
  for (const op of ["sever", "reinstate"]) {
    assert.equal(RUNGS[op], "reasoned", op);
    assert.ok(!Object.hasOwn(NON_ACTS, op), `${op} is an act, never a non-act too`);
  }
  assert.equal(RUNG_ABSENT.capturerequest?.ground, "substrate");
  for (const s of [RUNG_ABSENT.capturerequest?.is, NON_ACTS.capturerequest]) {
    assert.match(s ?? "", /a member's own request for later/, s);
    assert.match(s ?? "", /capture-requests R56/, s);
  }
  assert.match(NON_ACTS.capturerequest ?? "", /keyed by run and address/, "a run's request still named");
  /* control: a sentence naming the run alone would be seen */
  assert.doesNotMatch("the investigative session's request for a capture, keyed by run and address", /own request/);
});

/* ---- R37 ----------------------------------------------------------------------------------------------------------- */
test("R37: unlock and reauth stated absent on the `credential` ground, session-directed, citing credentials R65, R66, R71; off the phone by R18", () => {
  for (const op of ["unlock", "reauth"]) {
    assert.equal(gradeOf(op), "credential", op);
    assert.ok(!Object.hasOwn(RUNGS, op), op);
    assert.match(NON_ACTS[op] ?? "", /^session-directed: the caller's own/, op);
    assert.equal(phoneOf(op), false, op);
  }
  assert.match(RUNG_ABSENT.unlock?.is ?? "", /\(credentials R65, R71\)$/);
  assert.match(RUNG_ABSENT.reauth?.is ?? "", /\(credentials R66, R71\)$/);
  /* control: the caller's own sign-out stays caller-owned and a phone act */
  assert.equal(gradeOf("signout"), "caller-owned");
  assert.equal(phoneOf("signout"), true);
});

test("R37: the reset link — passwordreset on the `credential` ground as recover; passwordresetlook a public read; passwordresetlink on the `credential` ground (credentials R69 asks no reason, so no code backs a reasoned rung)", () => {
  assert.equal(gradeOf("passwordreset"), "credential");
  assert.equal(gradeOf("passwordreset"), gradeOf("recover"), "as recover");
  assert.ok(isRead("passwordresetlook"));
  assert.equal(gradeOf("passwordresetlook"), null);
  assert.match(NON_ACTS.passwordresetlook ?? "", /reached with no session/);
  assert.equal(gradeOf("passwordresetlink"), "credential");
  for (const op of ["passwordresetlink", "passwordreset"]) assert.match(RUNG_ABSENT[op]?.is ?? "", /\(credentials R69\)$/, op);
  /* control: no reset code is in the family, which a reasoned rung would need */
  for (const c of ["RESET_LINK_DEAD", "RESET_LINK_MEMBER_NOT_ACTIVE"]) assert.ok(!JUSTIFICATION_REFUSALS.includes(c), c);
  assert.ok(!Object.hasOwn(RUNGS, "passwordresetlink"));
});

test("R37: grouplogoset and grouplanguagesset `reversible`, an administrator's settings a later set replaces; grouplanguages a public read", () => {
  for (const op of ["grouplogoset", "grouplanguagesset"]) {
    assert.equal(RUNGS[op], "reversible", op);
    assert.match(NON_ACTS[op] ?? "", /^setting: .*an administrator's act, a later one replacing it; moves no bundle$/, op);
  }
  assert.ok(isRead("grouplanguages"));
  assert.match(NON_ACTS.grouplanguages ?? "", /public, no credential/);
  /* control: the group's name stays a substrate absence beside them */
  assert.equal(gradeOf("groupnameset"), "substrate");
});

test("R37: signrequest `reversible`, the owner's resolution of the To do taking it back; case-directed; tasks refuses a machine itself, so no MACHINE_REFUSALS row", () => {
  assert.equal(RUNGS.signrequest, "reversible");
  assert.equal(RUNGS.taskresolve, "reversible", "the act that takes it back is graded");
  assert.match(NON_ACTS.signrequest ?? "", /^case-directed: keyed by a prepared case edition/);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "signrequest"));
  /* control: the signing it asks for stays attested */
  assert.equal(RUNGS.caseratify, "attested");
});

test("R37 K3104: signintrace and peopledirectory are reads, ungraded; the trace names no token, secret or code, the directory never the group's members", () => {
  for (const op of ["signintrace", "peopledirectory"]) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  assert.match(NON_ACTS.signintrace ?? "", /never a token, secret or code/);
  assert.match(NON_ACTS.peopledirectory ?? "", /never the group's members/);
  /* control */
  assert.ok(!isRead("signrequest"));
});

test("R37 R1 R14 R21 (K3100 doubt 9): publish is re-graded `terminal`, the preparation it now is (case-authoring R34, R76; caseratify signs), and publishcheck with it; both leave IRREVERSIBLE_WEIGHT, publishat and publishatmove keep `irreversible` and the weight; MACHINE_CANNOT_PUBLISH stays; no consequence statement is added", () => {
  assert.equal(RUNGS.publish, "terminal");
  assert.equal(RUNGS.publishcheck, RUNGS.publish, "graded as publish (K2883)");
  for (const op of ["publish", "publishcheck"]) assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
  for (const op of ["publishat", "publishatmove"]) {
    assert.equal(RUNGS[op], "irreversible", op);
    assert.ok(IRREVERSIBLE_WEIGHT.includes(op), op);
  }
  assert.equal(MACHINE_REFUSALS.publish, "MACHINE_CANNOT_PUBLISH");
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "publish"));
  assert.equal(RUNGS.caseratify, "attested", "the signing that publishes");
  assert.equal(phoneOf("publish"), false, "R18: a terminal rung");
  /* negative control: the old grade would put it back in the weight */
  assert.notEqual(RUNGS.publish, "irreversible");
});

test("R36 R37 R5 R18: none of T47's ops is a machine refusal, a capture act, an alias, a consequence statement, an Irreversible weight or a larger-screen act; phone follows the rung or ground, the four credential acts off it", () => {
  assert.deepEqual(ALL.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.deepEqual(ALL.filter((op) => !phoneOf(op)).sort(), ["passwordreset", "passwordresetlink", "reauth", "unlock"]);
  /** @type {readonly string[]} */
  const aliasTargets = Object.values(OP_ALIASES);
  for (const op of ALL) {
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !aliasTargets.includes(op), op);
    assert.ok(NON_ACTS[op]?.startsWith("capture-directed:") === false, op);
  }
  /* negative control */
  assert.equal(phoneOf("drawquestion"), true);
});

test("R36 R37: every write carries its grade, each reversible one taken back by a graded act, each a NON_ACTS reason that is no read; T47's tables hold exactly these ops, the module's tables carrying those very entries", () => {
  assert.deepEqual(Object.fromEntries(Object.keys(WRITES).map((op) => [op, gradeOf(op)])), WRITES);
  assert.deepEqual(Object.keys(WRITES).filter((op) => WRITES[op] === "reversible").sort(), Object.keys(TAKEN_BACK_BY).sort());
  for (const [op, by] of Object.entries(TAKEN_BACK_BY)) assert.notEqual(gradeOf(by), null, `${op} taken back by ${by}`);
  for (const op of Object.keys(WRITES)) assert.ok((NON_ACTS[op]?.length ?? 0) > 30 && !isRead(op), op);
  assert.deepEqual(Object.keys(T47).sort(), ["T47_NON_ACTS", "T47_RUNGS", "T47_RUNG_ABSENT"]);
  assert.deepEqual([...Object.keys(T47.T47_RUNGS), ...Object.keys(T47.T47_RUNG_ABSENT)].sort(), Object.keys(WRITES).sort());
  assert.deepEqual(Object.keys(T47.T47_NON_ACTS).sort(), [...ALL, "statementack", "reviewcomment"].sort());
  for (const [op, v] of Object.entries(T47.T47_RUNGS)) assert.equal(RUNGS[op], v, op);
  for (const [op, e] of Object.entries(T47.T47_RUNG_ABSENT)) { assert.equal(RUNG_ABSENT[op], e, op); assert.ok(e.is.length > 60, op); }
  for (const [op, w] of Object.entries(T47.T47_NON_ACTS)) assert.equal(NON_ACTS[op], w, op);
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
  /* negative control */
  assert.notDeepEqual({ ...WRITES, monitorset: "undetermined" }, WRITES);
});

/* `unaccounted`'s two totalities over a stand-in of op-declarations R55's, R57's, R59's and R61's rows: each write
   mutating, each read not, every op gated by a NEEDS row (a present null for the public and session-own ones) */
/** @typedef {{ op: string, mutating: boolean, gated: boolean }} StandInRow */
/** @type {StandInRow[]} */
const STAND_IN = [...Object.keys(WRITES).map((op) => ({ op, mutating: true, gated: true })),
  ...READS.map((op) => ({ op, mutating: false, gated: true }))];
/** @param {StandInRow[]} rows */
const unaccountedOver = (rows) => {
  const mutating = new Set(rows.filter((r) => r.mutating).map((r) => r.op));
  const gated = new Set(rows.filter((r) => r.gated).map((r) => r.op));
  return {
    unpublished: [...gated].filter((op) => !Object.hasOwn(NON_ACTS, op)).sort(),
    unranked: [...mutating].filter((op) => !Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op)).sort(),
    stale: rows.map((r) => r.op).filter((op) => !mutating.has(op) && (Object.hasOwn(RUNGS, op)
      || Object.hasOwn(RUNG_ABSENT, op)) || !gated.has(op) && Object.hasOwn(NON_ACTS, op)).sort(),
  };
};
test("R36 R37: affordances R12's totality holds over a stand-in of op-declarations' T47 rows — none unpublished, unranked or stale", () => {
  assert.deepEqual(unaccountedOver(STAND_IN), { unpublished: [], unranked: [], stale: [] });
  /* negative controls: an ungraded new op is unranked and unpublished; a read carried as a write is unranked, a write
     carried as a read stale */
  const left = unaccountedOver([...STAND_IN, { op: "grouplogonew", mutating: true, gated: true }]);
  assert.deepEqual([left.unranked, left.unpublished], [["grouplogonew"], ["grouplogonew"]]);
  assert.deepEqual(unaccountedOver(STAND_IN.map((r) => r.op === "peopledirectory" ? { ...r, mutating: true } : r)).unranked,
    ["peopledirectory"]);
  assert.deepEqual(unaccountedOver(STAND_IN.map((r) => r.op === "monitorset" ? { ...r, mutating: false } : r)).stale,
    ["monitorset"]);
});

/* ---- R5 (K3164) ---------------------------------------------------------------------------------------------------- */
test("R5 R1 (K3164): statementack and reviewcomment carry NON_ACTS rows by R5's rule, case-directed and review-directed, their grades unchanged; neither is a capture act or a machine refusal", () => {
  assert.equal(NON_ACTS.statementack, declaredSentence("case-inputs", "statementack"));
  assert.equal(NON_ACTS.reviewcomment, declaredSentence("review", "reviewcomment"));
  assert.deepEqual([RUNGS.statementack, RUNGS.reviewcomment], ["reasoned", "reversible"]);
  for (const op of ["statementack", "reviewcomment"]) {
    assert.ok(NON_ACTS[op]?.startsWith("capture-directed:") === false && !isRead(op), op);
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  }
  /* negative control: the publish-screen reads beside them stay reads */
  assert.ok(isRead("publishpreflight") && isRead("publishtensions"));
});
