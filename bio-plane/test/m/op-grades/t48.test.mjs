/* op-grades: T48's grades (R38, R39, R40, R41) and `MARKS` (R42), at the module's exports. Every op T48's owners add,
   graded by R5 and R3, each op named here with the grade read from its owner's requirements and a negative control
   (K874). `affordances` and `op-declarations` merge after this module in layer 11, so the totality is held here over the
   tables themselves (an op is graded, or a read or draft, or an ACTS row with a machine refusal); the real totality runs
   again at their merges. R42 reads the design stream's registry and kit as files, at the commit the marks name. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf, MARKS, MARK_SOURCES } from "../../../src/op-grades/index.mjs";
import * as T48 from "../../../src/op-grades/t48.mjs";
import { MARKS_KIT_COMMIT } from "../../../src/op-grades/marks.mjs";

/* the source the marks of reads name (K4259; fix round 2, C76): a read asks no reason, so its mark is Reversible */
const READ_RULING = "K4259, a ruling";
import { reqText, ticked, readRows, asksNotTheAccount, declaredSentence, doesSentence, registeredOpGrades } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;
const isRead = (op) => typeof NON_ACTS[op] === "string" && NON_ACTS[op].startsWith("read: ")
  && /writes nothing$/.test(NON_ACTS[op]) && NON_ACTS[op].length > 30;
const root = (p) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const countOf = (code) => JUSTIFICATION_REFUSALS.filter((c) => c === code).length;

const WRITES = { actionreplyquoting: "reversible", updateskip: "reasoned", updatelater: "reversible",
  updatestart: "reversible", planask: "reversible", stepsource: "reasoned", stepsourcewithdraw: "reasoned",
  lookedsince: "caller-owned" };
const R39_ROWS = { translationdraft: "caller-owned" };
const READS = readRows(T48.T48_NON_ACTS);
const R41_READS = READS.filter((op) => op !== "proceedingdates" && op !== "updatenotice");
/* the ops R41 names that T48's tables hold */
const R41_CONTROL = ticked(reqText(41)).filter((op) => Object.hasOwn(T48.T48_RUNGS, op) || Object.hasOwn(T48.T48_RUNG_ABSENT, op)
  || Object.hasOwn(T48.T48_NON_ACTS, op));
const UPDATE = declaredSentence("instance-setup", "updatelater");
const STEP = declaredSentence("connections", "stepsource");

/* ---- R38 ----------------------------------------------------------------------------------------------------------- */
test("R38: actionreplyquoting `reversible` as actionreplybearing, an ACTS row on an action with no NON_ACTS row, a machine "
   + "refused it by MACHINE_CANNOT_RECORD_QUOTING, a phone act; no reason is asked, so it is not in the justification family",
() => {
  assert.equal(RUNGS.actionreplyquoting, "reversible");
  assert.equal(gradeOf("actionreplyquoting"), gradeOf("actionreplybearing"), "as actionreplybearing");
  assert.equal(MACHINE_REFUSALS.actionreplyquoting, "MACHINE_CANNOT_RECORD_QUOTING");
  assert.ok(!Object.hasOwn(NON_ACTS, "actionreplyquoting"), "an act is never a non-act too");
  assert.equal(phoneOf("actionreplyquoting"), true);
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "actionreplyquoting"));
  /* controls: actionreplybearing's code is its own, and the new op is not graded reasoned */
  assert.equal(MACHINE_REFUSALS.actionreplybearing, "MACHINE_CANNOT_RECORD_BEARING");
  assert.notEqual(gradeOf("actionreplyquoting"), "reasoned");
});

test("R38: proceedingdates is a read, `read: …`, ungraded; readtranslate takes no rung, its sentence begins `draft: …` "
   + "(labeled machine work, the original one tap away, held nowhere); both phone acts, neither a machine refusal; "
   + "followregister and reviewgrant keep their grades", () => {
  assert.ok(isRead("proceedingdates"));
  assert.equal(gradeOf("proceedingdates"), null);
  assert.match(NON_ACTS.proceedingdates, /following R30/);
  assert.match(NON_ACTS.readtranslate, /^draft: a machine translation of one passage of the group's own writing/);
  assert.match(NON_ACTS.readtranslate, /labeled machine work, the original one tap away; held nowhere and writes nothing/);
  assert.equal(gradeOf("readtranslate"), null);
  assert.ok(!NON_ACTS.readtranslate.startsWith("read: "));
  for (const op of ["proceedingdates", "readtranslate"]) {
    assert.equal(phoneOf(op), true, op);
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  }
  assert.equal(RUNG_ABSENT.reviewgrant.ground, "credential");
  assert.equal(RUNGS.followregister, "reversible", "followregister keeps its grade (following R29's `proceeding` changes none)");
  assert.ok(!Object.hasOwn(T48.T48_RUNGS, "followregister") && !Object.hasOwn(T48.T48_RUNG_ABSENT, "reviewgrant"));
  /* IRREVERSIBLE_WEIGHT and CONSEQUENCE_STATEMENTS gain none */
  for (const op of ["actionreplyquoting", "proceedingdates", "readtranslate"]) {
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
  }
  /* control: a write is not a read */
  assert.ok(!isRead("actionreplyquoting") && !Object.hasOwn(NON_ACTS, "actionreplyquoting"));
});

/* ---- R39 ----------------------------------------------------------------------------------------------------------- */
test("R39 (K4247): translationdraft leaves `undetermined` for `caller-owned`; groupdescriptiondraft is a read with no row, "
   + "its owner's NON_ACTS sentence unchanged; each a phone act and no machine refusal; control: translationmark stays "
   + "`undetermined`", () => {
  for (const [op, g] of Object.entries(R39_ROWS)) {
    assert.equal(RUNG_ABSENT[op].ground, g, op);
    assert.ok(!Object.hasOwn(RUNGS, op), op);
    assert.ok(RUNG_ABSENT[op].is.length > 40, op);
    assert.equal(phoneOf(op), true, op);
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  }
  assert.equal(RUNG_ABSENT.translationdraft.ground, "caller-owned");
  assert.match(NON_ACTS.translationdraft, /^translation-directed: keyed by a language and interface words; drafts labeled machine work/);
  assert.equal(NON_ACTS.groupdescriptiondraft, declaredSentence("store-door", "groupdescriptiondraft"));
  /* control: a read carries no ground, so the draft has no row in either table (K4247) */
  assert.equal(Object.hasOwn(RUNG_ABSENT, "groupdescriptiondraft"), false);
  assert.equal(Object.hasOwn(RUNGS, "groupdescriptiondraft"), false);
  assert.equal(NON_ACTS.securitymap, doesSentence("securitymap"));
  /* the ground is as memberlanguageset's */
  assert.equal(gradeOf("translationdraft"), gradeOf("memberlanguageset"));
  /* controls */
  assert.equal(RUNG_ABSENT.translationmark.ground, "undetermined");
  assert.notEqual(RUNG_ABSENT.translationdraft.ground, "undetermined");
  /* the tally of `undetermined` ops falls by one: no R39 op is among them */
  const undetermined = Object.keys(RUNG_ABSENT).filter((op) => RUNG_ABSENT[op].ground === "undetermined");
  for (const op of Object.keys(R39_ROWS)) assert.ok(!undetermined.includes(op), op);
  assert.ok(undetermined.includes("translationmark"));
});

test("R39 (K4210): securitymap is graded `read` once: its NON_ACTS sentence stands and no absence, rung or machine refusal "
   + "holds it; control: a fresh instance refuses a ground on it, as its owner's declaration would (ground-on-read)", async () => {
  assert.equal(NON_ACTS.securitymap, doesSentence("securitymap"));
  const TABLES = { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS };
  assert.deepEqual(Object.keys(TABLES).filter((t) => Object.hasOwn(TABLES[t], "securitymap")), ["NON_ACTS"]);
  /* control: the declaration a ground would make, on an instance not yet read, is refused naming the op */
  const fresh = await import("../../../src/op-grades/index.mjs?instance=t48-k4210");
  assert.throws(() => fresh.registerDeclaredOps({ credentials: { securitymap: { classes: ["admin"], machineClasses: [],
    mutating: false, weight: "caller-owned", description: "securitymap", fields: { accepts: [], requires: [] } } } }),
  (e) => e.code === "DECLARED_OP_BAD_WEIGHT" && e.message.includes("securitymap") && e.message.includes("ground-on-read"));
});

/* ---- R40 ----------------------------------------------------------------------------------------------------------- */
test("R40: updateskip `reasoned`, UPDATE_SKIP_NO_REASON joining JUSTIFICATION_REFUSALS once; updatelater and updatestart "
   + "`reversible`, asking no reason; the three acts' one release-directed sentence; updatenotice a read; none a machine "
   + "refusal, a statement or an Irreversible weight; every one a phone act; control: updatelater is not backed",
() => {
  assert.equal(RUNGS.updateskip, "reasoned");
  assert.equal(countOf("UPDATE_SKIP_NO_REASON"), 1);
  assert.equal(RUNGS.updatelater, "reversible");
  assert.equal(RUNGS.updatestart, "reversible");
  for (const op of ["updateskip", "updatelater", "updatestart"]) {
    assert.equal(NON_ACTS[op], UPDATE, op);
    assert.equal(phoneOf(op), true, op);
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op) && !LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
  }
  assert.ok(isRead("updatenotice"));
  assert.equal(gradeOf("updatenotice"), null);
  assert.match(NON_ACTS.updatenotice, /instance-setup R89/);
  /* controls: updatelater has no refusal code in the backed set, and updatestart is not reasoned */
  assert.ok(![...JUSTIFICATION_REFUSALS].some((c) => /^UPDATE_(LATER|START)/.test(c)));
  assert.notEqual(RUNGS.updatestart, "reasoned");
  assert.notDeepEqual({ ...RUNGS, updatelater: "reasoned" }, RUNGS);
});

/* ---- R41 ----------------------------------------------------------------------------------------------------------- */
test("R41: aiuseovertime, exploregraph, standardproposals, filingread and pressurefor are reads, `read: …`, ungraded, no "
   + "machine refusal, phone acts; control: planask is not a read", () => {
  for (const op of R41_READS) {
    assert.ok(isRead(op), op);
    assert.equal(gradeOf(op), null, op);
    assert.equal(phoneOf(op), true, op);
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  }
  assert.match(NON_ACTS.aiuseovertime, /ai-use R14/);
  assert.match(NON_ACTS.exploregraph, /explore R21/);
  assert.match(NON_ACTS.standardproposals, /standards R57/);
  assert.match(NON_ACTS.filingread, /filings R59/);
  assert.match(NON_ACTS.pressurefor, /action-holds R16/);
  assert.ok(!isRead("planask") && !isRead("stepsource") && !isRead("lookedsince"));
});

test("R41 (K3297): planask `reversible` as airunopen; not an ACTS row (its subject is a plan), so it has a plan-directed "
   + "NON_ACTS row and no MACHINE_REFUSALS row; optionpropose keeps its grade", () => {
  assert.equal(RUNGS.planask, "reversible");
  assert.equal(gradeOf("planask"), gradeOf("airunopen"), "as airunopen");
  assert.equal(RUNGS.airunclose, "reversible", "the act that ends the run it opens is graded");
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "planask"));
  assert.match(NON_ACTS.planask, /^plan-directed: keyed by a plan; a member asks the assistant for options on it/);
  assert.match(NON_ACTS.optionpropose, /^plan-directed: /, "as the plan acts T45 left");
  assert.equal(phoneOf("planask"), true);
  assert.equal(RUNG_ABSENT.optionpropose.ground, "undetermined", "optionpropose keeps its grade");
  /* control: no op of R41 enters MACHINE_REFUSALS */
  for (const op of R41_CONTROL) assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
});

test("R41: stepsource `reasoned` as connectionassert, STEP_SOURCE_NO_BASIS joining JUSTIFICATION_REFUSALS once; "
   + "stepsourcewithdraw `reasoned` on NO_REASON, already there; both carry one relation-directed sentence", () => {
  assert.equal(RUNGS.stepsource, "reasoned");
  assert.equal(gradeOf("stepsource"), gradeOf("connectionassert"), "as connectionassert");
  assert.equal(RUNGS.stepsourcewithdraw, "reasoned");
  assert.equal(countOf("STEP_SOURCE_NO_BASIS"), 1);
  assert.equal(countOf("NO_REASON"), 1, "already in the family, once");
  assert.equal(NON_ACTS.stepsource, STEP);
  assert.equal(NON_ACTS.stepsourcewithdraw, STEP);
  for (const op of ["stepsource", "stepsourcewithdraw"]) assert.equal(phoneOf(op), true, op);
  /* controls: the shape-refusals connections R68 lists are not a reason (R1's rule over a code: none asks an object, an
     identifier, a choice, a form or a member) */
  assert.deepEqual(JUSTIFICATION_REFUSALS.filter(asksNotTheAccount), []);
  assert.ok(asksNotTheAccount("NO_SUCH_RELATION") && asksNotTheAccount("STEP_SOURCE_BASIS_TOO_LONG"));
  assert.equal(new Set(JUSTIFICATION_REFUSALS).size, JUSTIFICATION_REFUSALS.length, "no code twice");
});

test("R41: lookedsince is stated absent `caller-owned` as memberlanguageset, its sentence personal state answered to the "
   + "member alone; a phone act, no machine refusal", () => {
  assert.equal(RUNG_ABSENT.lookedsince.ground, "caller-owned");
  assert.equal(gradeOf("lookedsince"), gradeOf("memberlanguageset"));
  assert.match(NON_ACTS.lookedsince, /^personal state, keyed by member: the instant she last looked at Home, answered to her alone and recorded at the read; moves no bundle$/);
  assert.equal(phoneOf("lookedsince"), true);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "lookedsince"));
  assert.ok(RUNG_ABSENT.lookedsince.is.length > 40);
  assert.ok(!Object.hasOwn(RUNGS, "lookedsince"));
});

test("R38 R39 R40 R41: T48's tables hold exactly these ops, none both graded and stated absent; every grade as the owner's "
   + "requirement words it", () => {
  const T48W = { ...Object.fromEntries(Object.keys(T48.T48_RUNGS).map((o) => [o, T48.T48_RUNGS[o]])),
    ...Object.fromEntries(Object.keys(T48.T48_RUNG_ABSENT).map((o) => [o, T48.T48_RUNG_ABSENT[o].ground])) };
  assert.deepEqual(T48W, WRITES);
  for (const [op, g] of Object.entries({ ...WRITES, ...R39_ROWS })) assert.equal(gradeOf(op), g, op);
  for (const op of Object.keys(T48.T48_RUNGS)) assert.ok(!Object.hasOwn(T48.T48_RUNG_ABSENT, op), op);
  for (const [op, e] of Object.entries(T48.T48_RUNG_ABSENT)) assert.ok(e.is.length > 40, op);
  /* every other op of T48 carries a NON_ACTS row, a read or a draft, or is an ACTS row with a machine refusal */
  const nonActs = Object.keys(T48.T48_NON_ACTS).sort();
  assert.deepEqual(nonActs, [...READS, "readtranslate", "planask", "stepsource", "stepsourcewithdraw", "lookedsince", "updateskip",
    "updatelater", "updatestart"].sort());
  assert.deepEqual(Object.keys(T48.T48_MACHINE_REFUSALS).sort(), ["actionreplyquoting"]);
  for (const op of Object.keys(T48.T48_MACHINE_REFUSALS)) assert.ok(!Object.hasOwn(NON_ACTS, op), op);
  for (const [op, s] of Object.entries(NON_ACTS)) assert.ok(typeof s === "string" && s.length > 10, op);
  /* none of the grades is reached through an alias */
  for (const op of Object.keys(T48W)) assert.ok(!Object.hasOwn(OP_ALIASES, op), op);
  /* negative control: a T48 op left out of the tables is seen */
  const { planask, ...without } = RUNGS;
  assert.equal(planask, "reversible");
  assert.notDeepEqual(Object.keys(without).filter((o) => o in WRITES).sort(), Object.keys(WRITES).filter((o) => o in RUNGS).sort());
});

/* ---- R42 ----------------------------------------------------------------------------------------------------------- */
const REGISTRY = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const KIT = readFileSync(root("docs/development/ux-substrate/screens/mock-kit.js"), "utf8");
const KIT_WEIGHT = Object.fromEntries([...KIT.match(/const WEIGHT = \{([\s\S]*?)\n\};/)[1].matchAll(/([A-Za-z_0-9]+):(\d)/g)]
  .map(([, k, v]) => [k, Number(v)]));
const WNAME = ["", "Reversible", "Reasoned", "Terminal", "Signed", "Irreversible"];
const nameOf = (a) => (a.startsWith("owed:") ? a.slice(5).split(" ")[0] : a);
const REGISTRY_OPS = [...new Set(REGISTRY.screens.flatMap((s) => s.acts.map((a) => nameOf(a.op))))].sort();
/* an act is rungless when no table grades it: the registered tables (R49), so an op its owner grades is not rungless (B27) */
const rungless = (m, op) => !Object.hasOwn(m.RUNGS, op)
  && !(Object.hasOwn(m.RUNG_ABSENT, op) && m.RUNG_ABSENT[op].ground === "undetermined");

test("R42: MARKS is frozen and total over the registry's rungless acts — a read, an op stated absent under a ground other "
   + "than `undetermined`, or an op no table grades — and holds no other op; each value is a kit weight name; each entry "
   + "names its source", async () => {
  assert.ok(Object.isFrozen(MARKS) && Object.isFrozen(MARK_SOURCES));
  const reg = await registeredOpGrades();
  const want = REGISTRY_OPS.filter((op) => rungless(reg, op));
  /* an owner's grade for an op a mark held before (its unread mark, B11) is the one exception: the mark is the owner's to drop */
  const graded = Object.keys(MARKS).filter((op) => !want.includes(op));
  for (const op of graded) assert.ok(Object.hasOwn(reg.RUNGS, op) || Object.hasOwn(reg.RUNG_ABSENT, op), op);
  assert.deepEqual(Object.keys(MARKS).filter((op) => !graded.includes(op)).sort(), want);
  assert.deepEqual(Object.keys(MARK_SOURCES).sort(), Object.keys(MARKS).sort());
  assert.ok(want.length > 80, "the registry lists many rungless acts");
  for (const op of want) {
    assert.ok(WNAME.slice(1).includes(MARKS[op]), `${op}: ${MARKS[op]}`);
    assert.equal(typeof MARK_SOURCES[op], "string", op);
    assert.ok(MARK_SOURCES[op].length > 20, op);
  }
  /* controls: a registry op left out, or a rung-graded op added, is seen */
  const { login, ...withoutLogin } = MARKS;
  assert.equal(login, "Reversible");
  assert.notDeepEqual(Object.keys(withoutLogin).sort(), want);
  assert.notDeepEqual(Object.keys({ ...MARKS, publish: "Terminal" }).sort(), Object.keys(MARKS).sort());
});

test("R42: every value is the design kit's WEIGHT for the op (the kit's `owed_` key for an owed act), an op the kit does not "
   + "name Reasoned, the kit's default; the kit and the registry are read at the commit the marks name", () => {
  assert.equal(MARKS_KIT_COMMIT, "0310c4953d");
  for (const op of Object.keys(MARKS)) {
    /* notewrite is the one entry a ruling, not the kit, sets (R46, DEC-300 (5)); t50.test.mjs names it. versionnotice is a
       read, marked by its ruling (K4259, B30); t50.test.mjs names it. */
    if (op === "notewrite" || MARK_SOURCES[op].startsWith(READ_RULING)) continue;
    const w = KIT_WEIGHT[op] ?? KIT_WEIGHT[`owed_${op}`];
    assert.equal(MARKS[op], WNAME[w ?? 2], op);
    assert.match(MARK_SOURCES[op], w ? /^mock-kit\.js WEIGHT at 0310c4953d$/ : /^kit default at 0310c4953d/, op);
  }
  /* the kit now names acquire Reversible (K3284), so it is read from the kit like any other and no override remains */
  assert.equal(KIT_WEIGHT.acquire, 1);
  assert.equal(MARKS.acquire, "Reversible");
  assert.match(MARK_SOURCES.acquire, /^mock-kit\.js WEIGHT at 0310c4953d$/);
  assert.ok(Object.values(MARK_SOURCES).every((s) => !s.startsWith("K3284")), "no entry still names the retired override");
  /* the examples R42 names: login is reversible, promote reasoned; and the interface-shell R64 examples */
  assert.equal(MARKS.login, "Reversible");
  assert.equal(MARKS.promote, "Reasoned");
  assert.equal(MARKS.search, "Reversible");
  assert.equal(MARKS.startfrom, "Reversible");
  assert.equal(MARKS.queuemute, "Reversible");
  assert.equal(MARKS.claim, "Signed");
  /* an op the kit does not name is Reasoned (control) */
  const unnamed = Object.keys(MARKS).filter((op) => op !== "notewrite" && !MARK_SOURCES[op].startsWith(READ_RULING) && KIT_WEIGHT[op] === undefined
    && KIT_WEIGHT[`owed_${op}`] === undefined);
  assert.ok(unnamed.length > 0);
  for (const op of unnamed) assert.equal(MARKS[op], "Reasoned", op);
});

test("R42: MARKS grades nothing — no op in RUNGS is in MARKS, no `undetermined` op is, and RUNGS, RUNG_ABSENT, NON_ACTS and "
   + "phoneOf answer as before for every marked op", () => {
  for (const op of Object.keys(MARKS)) {
    assert.ok(!Object.hasOwn(RUNGS, op), `${op} has a rung`);
    assert.notEqual(RUNG_ABSENT[op]?.ground, "undetermined", op);
  }
  /* the marks did not move a grade: acquire stays substrate, promote substrate, login in no rung table */
  assert.equal(RUNG_ABSENT.acquire.ground, "substrate");
  assert.equal(RUNG_ABSENT.promote.ground, "substrate");
  assert.ok(!Object.hasOwn(RUNGS, "login") && !Object.hasOwn(RUNG_ABSENT, "login"));
  assert.equal(phoneOf("acquire"), true);
  assert.equal(phoneOf("claim"), false, "a credential act stays off the phone: the Signed mark moved nothing");
  assert.equal(phoneOf("login"), true);
  /* a graded op takes no mark, however the kit weighs it (control) */
  assert.ok(!Object.hasOwn(MARKS, "cite") && !Object.hasOwn(MARKS, "updatestart") && !Object.hasOwn(MARKS, "planask"));
  assert.ok(!Object.hasOwn(MARKS, "testify"));
  assert.notDeepEqual(Object.keys({ ...MARKS, cite: "Reversible" }).sort(), Object.keys(MARKS).sort());
});
