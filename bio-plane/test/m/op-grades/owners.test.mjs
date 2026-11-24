/* op-grades: the owners' ops, graded (R6–R17), at the module's exports. Each grade is the one its requirement reads from
   the owner; the owners are not imported (this module uses nothing, P4): their maps, their refusals and the totality over
   the control plane's table are `affordances`' tests (its R12, R19, R20). The T33 and T34 cases moved here from
   `affordances`' `t33.test.mjs` and `t34.test.mjs` (the table cases and the alias table). */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, OP_ALIASES,
         aliased, phoneOf } from "../../../src/op-grades/index.mjs";
import { T33_RUNGS, T33_RUNG_ABSENT, T33_NON_ACTS } from "../../../src/op-grades/t33.mjs";
import { T34_RUNGS, T34_RUNG_ABSENT, T34_NON_ACTS } from "../../../src/op-grades/t34.mjs";
import { readRows, declaredSentence, doesSentence, declaredAliases, ownerReads, collectDeclaredOps, reqText, tickedAll } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;
const isRead = (op) => typeof NON_ACTS[op] === "string" && NON_ACTS[op].startsWith("read: ");
const notMachine = (ops) => assert.deepEqual(ops.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
const grades = (ops) => Object.fromEntries(Object.keys(ops).map((op) => [op, gradeOf(op)]));

/* ---- R6 ------------------------------------------------------------------------------------------------------------ */
test("R6: filing-templates' and local-facts' ops — templateretire and factconfirm `reasoned` with their codes in the "
   + "family; the two grants `credential`; the seven template acts `undetermined`; each with its NON_ACTS reason", () => {
  const W = { templateretire: "reasoned", factconfirm: "reasoned", templatereviewgrant: "credential",
    templategrantrevoke: "credential", templatedraft: "undetermined", templaterevise: "undetermined",
    templatepropose: "undetermined", templatesubmit: "undetermined", templatereview: "undetermined",
    templatecomment: "undetermined", templateapprove: "undetermined" };
  assert.deepEqual(grades(W), W);
  for (const c of ["TEMPLATE_REASON_REFUSED", "FACT_HOW_REFUSED"]) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
  assert.equal(RUNG_ABSENT.templatereviewgrant.ground, RUNG_ABSENT.reviewgrant.ground);
  const T = "template-directed: keyed by a template or one of its versions, reached from the template library; writes "
    + "this module's rows and moves no bundle";
  for (const op of Object.keys(W).filter((op) => op.startsWith("template"))) assert.ok(NON_ACTS[op].startsWith(T), op);
  for (const op of ["templatereview", "templatecomment", "templateread", "templatecomments"])
    assert.match(NON_ACTS[op], /reached also through a review grant's door$/, op);
  assert.equal(NON_ACTS.factconfirm, declaredSentence("local-facts", "factconfirm"));
  for (const op of ["templates", "factstatus", "factsdue"]) assert.ok(isRead(op), op);
});

/* ---- R7 ------------------------------------------------------------------------------------------------------------ */
test("R7: T23's ops — whatchangedpropose `undetermined`, noticepost `attested` as caseratify, each with its NON_ACTS "
   + "reason, the reads `read:` and network-notices' public reads `read: public, no credential`", () => {
  assert.equal(RUNG_ABSENT.whatchangedpropose.ground, "undetermined");
  assert.equal(RUNGS.noticepost, "attested");
  assert.equal(RUNGS.noticepost, RUNGS.caseratify);
  assert.equal(NON_ACTS.whatchangedpropose, declaredSentence("case-inputs", "whatchangedpropose"));
  assert.equal(NON_ACTS.noticepost, declaredSentence("network-notices", "noticepost"));
  for (const op of ["escalationreasondraft", "whatchangeddrafts", "sweeps", "noticeprepare", "notices"])
    assert.ok(isRead(op), op);
  for (const op of ["activitymethod", "noticespublic", "groupkeyspublic"])
    assert.equal(NON_ACTS[op], "read: public, no credential", op);
});

/* ---- R8 ------------------------------------------------------------------------------------------------------------ */
test("R8: actionholdrelease is `terminal`, a named exception (actionhold stays `reasoned`), HOLD_REFUSED backs both, its "
   + "consequence entry is the dialog DEC-113 words, by key (R44); (T45, K2887) both are ACTS rows, in MACHINE_REFUSALS by "
   + "MACHINE_CANNOT_SET_HOLD and no longer in NON_ACTS",
() => {
  assert.deepEqual([RUNGS.actionholdrelease, RUNGS.actionhold], ["terminal", "reasoned"]);
  assert.ok(JUSTIFICATION_REFUSALS.includes("HOLD_REFUSED"));
  const s = CONSEQUENCE_STATEMENTS.actionholdrelease;
  assert.equal(s.friction, "dialog");
  assert.equal(s.key, "consequence.actionholdrelease");
  for (const op of ["actionholdpreview", "projectholds"]) assert.ok(isRead(op), op);
  for (const op of ["actionholdrelease", "actionhold"]) {
    assert.equal(MACHINE_REFUSALS[op], "MACHINE_CANNOT_SET_HOLD", op);
    assert.ok(!Object.hasOwn(NON_ACTS, op), `${op} is an act, never a non-act too`);
  }
  /* negative control: the reads stay non-acts and no machine refusal */
  notMachine(["actionholdpreview", "projectholds"]);
});

/* ---- R9 ------------------------------------------------------------------------------------------------------------ */
test("R9: the docket's ops — docketfile and docketdecline `reasoned` (DOCKET_NO_REASON in the family), docketpost "
   + "`attested`, docketpressure `undetermined`, each case-directed, the reads and public reads apart", () => {
  const W = { docketfile: "reasoned", docketdecline: "reasoned", docketpost: "attested", docketpressure: "undetermined" };
  assert.deepEqual(grades(W), W);
  assert.ok(JUSTIFICATION_REFUSALS.includes("DOCKET_NO_REASON"));
  for (const op of Object.keys(W)) assert.equal(NON_ACTS[op], declaredSentence("docket", "docketfile"), op);
  for (const op of ["docket", "docketprepare", "docketinvitation"]) assert.ok(isRead(op), op);
  for (const op of ["docketpublic", "docketfeed"]) assert.equal(NON_ACTS[op], "read: public, no credential", op);
  notMachine(Object.keys(W));
});

/* ---- R10, R12 ------------------------------------------------------------------------------------------------------ */
const IMPORT = declaredSentence("case-import", "import_directed");
test("R10: case-import's and case-checker's ops — the four DEC-96 acts `reasoned` with both codes in the family, "
   + "caseimport and caseimportdocument `undetermined`, each import-directed; the reads and public reads apart; none a "
   + "machine refusal", () => {
  const W = { importaccept: "reasoned", importacceptwithdraw: "reasoned", importflag: "reasoned",
    importflagclear: "reasoned", caseimport: "undetermined", caseimportdocument: "undetermined" };
  assert.deepEqual(grades(W), W);
  for (const c of ["IMPORT_ACCEPT_NO_REASON", "IMPORT_FLAG_NO_ISSUE"]) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
  for (const op of Object.keys(W)) assert.equal(NON_ACTS[op], IMPORT, op);
  for (const op of ["importedcases", "importedcase"]) assert.ok(isRead(op), op);
  for (const op of ["casechecker", "casefilespec"]) assert.equal(NON_ACTS[op], "read: public, no credential", op);
  notMachine(Object.keys(W));
});

test("R12: importwatch and importunwatch are `reversible`, each taking the other back, with R10's sentence, and neither "
   + "is a machine refusal", () => {
  assert.deepEqual([RUNGS.importwatch, RUNGS.importunwatch], ["reversible", "reversible"]);
  assert.deepEqual([NON_ACTS.importwatch, NON_ACTS.importunwatch], [IMPORT, IMPORT]);
  notMachine(["importwatch", "importunwatch"]);
});

/* ---- R11 ----------------------------------------------------------------------------------------------------------- */
test("R11 R47: wizard-scripts' ops — wizardretire `reasoned` (WIZARD_REASON_REFUSED in the family), the four drafting acts "
   + "`undetermined` and the save `wizarddraft` `reversible` (R47), the editor grant and revoke `credential`, wizardprogress `observational`; each with its reason, "
   + "baseupdates and the other reads `read:`, none a machine refusal", () => {
  const W = { wizardretire: "reasoned", wizarddraft: "reversible", wizardrevise: "undetermined",
    wizardpropose: "undetermined", wizardsubmit: "undetermined", wizardapprove: "undetermined",
    wizardeditorgrant: "credential", wizardeditorrevoke: "credential", wizardprogress: "observational" };
  assert.deepEqual(grades(W), W);
  assert.ok(JUSTIFICATION_REFUSALS.includes("WIZARD_REASON_REFUSED"));
  /* the owner's declaration is the truth (K4168, B20): an op whose owner words it as `act.<op>.does` holds that sentence */
  for (const op of Object.keys(W).filter((op) => op !== "wizardprogress")) assert.equal(NON_ACTS[op], doesSentence(op) ?? 
    "wizard-directed: keyed by a script or one of its versions, reached from the library or a screen's mark; writes "
    + "this module's rows and moves no bundle", op);
  assert.equal(NON_ACTS.wizardprogress, "tally: unattributed, keyed by a script's version; names no member");
  /* `wizards` is declared in its owner's words, which do not lead with "read: " (K4168): a read all the same, ungraded */
  const WIZARD_READS = readRows(NON_ACTS).filter((op) => op.startsWith("wizard") || op === "baseupdates");
  assert.ok(WIZARD_READS.length >= 6);
  for (const op of WIZARD_READS) assert.ok(isRead(op), op);
  assert.equal(NON_ACTS.wizards, doesSentence("wizards"));
  assert.equal(gradeOf("wizards"), null);
  notMachine(Object.keys(W));
});

/* ---- R13 (moved from affordances' t33.test.mjs) -------------------------------------------------------------------- */
const T33_WRITES = {
  datedfact: "observational", editacts: "observational", readoptin: "substrate", eventcreate: "undetermined",
  eventattest: "undetermined", eventgovern: "reversible", participantadd: "undetermined", participantcorrect: "reasoned",
  eventmerge: "reasoned", eventsplit: "reasoned", eventrelate: "reversible", eventrelationwithdraw: "reasoned",
  actalias: "undetermined", eventimport: "substrate", registerimport: "substrate",
  linerecord: "reversible", linewithdraw: "reasoned", linecurrentthrough: "undetermined",
  moneyrecord: "reversible", moneywithdraw: "reasoned", moneysetcreate: "undetermined", moneysetinclude: "reasoned",
  moneysetexclude: "reasoned", moneysetpropose: "undetermined", moneyfundtype: "undetermined",
  moneycheckparam: "undetermined", moneydetectordefine: "undetermined", moneydetectorswitch: "reversible",
  moneydetectorsrun: "substrate", moneydetectorgate: "substrate",
  dutypropose: "undetermined", dutyadopt: "reversible", dutydeclare: "reversible", dutyrevise: "reasoned",
  dutywithdraw: "reasoned", dutymatch: "reasoned", dutytransition: "reasoned",
  identityclaim: "reasoned", identitywithdraw: "reasoned", personfact: "reversible", personfactwithdraw: "reasoned",
  personexpunge: "reasoned", membertie: "reversible", membertiewithdraw: "reasoned", sourcepersonlink: "reasoned",
  interestcheckdefine: "undetermined", interestcheckswitch: "reversible", interestcheckgate: "substrate",
  hypothesishold: "reversible", hypothesisrevise: "reasoned", hypothesiswithdraw: "reasoned",
  notewrite: "caller-owned", noteturn: "caller-owned",
  tabledeclare: "undetermined", bindingadopt: "undetermined", moneyingest: "reasoned", calculationcreate: "undetermined",
  calculationaccept: "undetermined", calculationdraw: "undetermined", recordset: "observational", patterngate: "substrate",
  patternswitch: "reversible",
  workbookadd: "undetermined", workbookbind: "reversible", workbookunbind: "reasoned", workbookrecompute: "observational",
  workbooklintexplain: "reasoned", workbookmethodnote: "reasoned", workbooksecondcheck: "undetermined",
  answercheck: "observational", ruleservicesswitch: "substrate", standingset: "caller-owned", standingend: "caller-owned",
  standingaiswitch: "substrate",
  followbody: "reversible", unfollow: "reversible", followregister: "reversible", followpersonquery: "reversible",
  followportal: "reversible", permeetingbody: "reversible", refreshregister: "substrate",
  lawrelate: "reasoned", lawwithdraw: "reasoned", lawpropose: "undetermined", courtlink: "reasoned", courttreat: "reasoned",
  accountreferenceset: "credential", accountreferenceremove: "credential",
  aigrantmint: "credential", keyedserviceset: "credential", keyedserviceswitch: "substrate",
  sourcekeyed: "undetermined", entityidentify: "reasoned", waitlook: "caller-owned", exportrender: "substrate",
  clockadopt: "undetermined", airunverify: "reasoned",
  clockpropose: "reversible", capturerequestplatformmark: "reversible", capturerequestplatformunmark: "reversible",
  officesseed: "substrate", seatsseed: "substrate", disclosureshown: "caller-owned",
  ask: "caller-owned", askusage: "observational",
};
/* T33's reads (R13): every row of T33's table that is a read, by its "read: " lead or by its owner's declared weight `read`
   (a read its owner words without the lead holds the owner's sentence, K4168; `ownerReads` finds it from the declarations) */
const OWNER_READS = await ownerReads(T33_NON_ACTS);
const T33_READS = [...new Set([...readRows(T33_NON_ACTS), ...OWNER_READS.map(({ op }) => op)])];
/* `reversible`: the published act of the owner that takes each result back */
const TAKEN_BACK_BY = {
  eventgovern: "eventgovern", eventrelate: "eventrelationwithdraw", linerecord: "linewithdraw", moneyrecord: "moneywithdraw",
  moneydetectorswitch: "moneydetectorswitch", dutyadopt: "dutywithdraw", dutydeclare: "dutywithdraw",
  personfact: "personfactwithdraw", interestcheckswitch: "interestcheckswitch", hypothesishold: "hypothesiswithdraw",
  patternswitch: "patternswitch", workbookbind: "workbookunbind", followbody: "unfollow", followregister: "unfollow",
  followpersonquery: "unfollow", followportal: "unfollow", unfollow: "followbody", permeetingbody: "permeetingbody",
  /* (T42) the three t33.mjs grades `reversible` that this map did not hold, so the set is now checked whole */
  clockpropose: "clockpropose", capturerequestplatformmark: "capturerequestplatformunmark",
  capturerequestplatformunmark: "capturerequestplatformmark",
  /* (T50, R47) membertie is reversible: membertiewithdraw takes it back (DEC-300 (5)) */
  membertie: "membertiewithdraw",
};
/* the code each reasoned op is refused with when the member's account is absent (driven in affordances' R19 tests) */
const REASON_CODE = {
  participantcorrect: "NO_REASON", eventmerge: "NO_REASON", eventsplit: "NO_REASON", eventrelationwithdraw: "NO_REASON",
  linewithdraw: "NO_REASON", moneywithdraw: "NO_REASON", moneysetinclude: "NO_REASON", moneysetexclude: "NO_REASON",
  dutyrevise: "DUTY_NO_REASON", dutywithdraw: "DUTY_NO_REASON", dutymatch: "DUTY_NO_REASON", dutytransition: "NO_CAUSE",
  identityclaim: "NO_NOTE", identitywithdraw: "NO_REASON", personfactwithdraw: "NO_REASON", personexpunge: "NO_REASON",
  membertiewithdraw: "NO_REASON", sourcepersonlink: "NO_EVIDENCE",
  hypothesisrevise: "HYPOTHESIS_NO_REASON", hypothesiswithdraw: "HYPOTHESIS_NO_REASON", moneyingest: "NO_REASON",
  workbookunbind: "NO_REASON", workbooklintexplain: "NO_NOTE", workbookmethodnote: "NO_PURPOSE",
  lawrelate: "STANDARD_NO_REASON", lawwithdraw: "STANDARD_NO_REASON", courtlink: "STANDARD_NO_REASON",
  courttreat: "STANDARD_NO_REASON", entityidentify: "NO_BASIS", airunverify: "AI_RUN_VERIFICATION_UNFIT",
};
/* a write op-declarations gives no NEEDS row (UNATTENDED_BY_DECISION): graded, never named in NON_ACTS; and (T46, R33,
   K2998) `clockadopt`, an ACTS row on an action (affordances R52), graded and named in MACHINE_REFUSALS instead */
const UNGATED_WRITES = ["askusage"];
const ACTS_NOW = ["clockadopt"];

test("R13 R3: every op T33 publishes is graded — each write its rung or one ground, each read a NON_ACT with its sentence, every "
   + "gated op its reason; each `reversible` taken back by a graded act and each `reasoned` backed by a code of the family; "
   + "none a machine refusal", () => {
  assert.deepEqual(grades(T33_WRITES), T33_WRITES);
  assert.deepEqual([...Object.keys(T33_RUNGS), ...Object.keys(T33_RUNG_ABSENT)].sort(), Object.keys(T33_WRITES).sort());
  assert.deepEqual(Object.keys(T33_NON_ACTS).sort(),
    [...Object.keys(T33_WRITES).filter((op) => !UNGATED_WRITES.includes(op) && !ACTS_NOW.includes(op)), ...T33_READS].sort());
  for (const op of T33_READS) { assert.ok(isRead(op) || OWNER_READS.some((r) => r.op === op), op); assert.equal(gradeOf(op), null, op); }
  /* the owner's declared sentence as its row holds it (K5157: a sentence whose key rows.mjs has not yet got is the owner's en, not a missing word) */
  for (const { op, sentence } of OWNER_READS) assert.equal(NON_ACTS[op], sentence, op);
  for (const op of Object.keys(T33_WRITES).filter((op) => !UNGATED_WRITES.includes(op) && !ACTS_NOW.includes(op)))
    assert.ok(!isRead(op) && NON_ACTS[op].length > 20, op);
  for (const op of ACTS_NOW) assert.ok(!Object.hasOwn(NON_ACTS, op) && Object.hasOwn(MACHINE_REFUSALS, op), op);
  for (const op of UNGATED_WRITES) assert.ok(!Object.hasOwn(NON_ACTS, op), op);
  assert.deepEqual(Object.keys(T33_WRITES).filter((op) => T33_WRITES[op] === "reversible").sort(),
    Object.keys(TAKEN_BACK_BY).sort(), "every reversible T33 op names the act that takes it back");
  for (const [op, by] of Object.entries(TAKEN_BACK_BY)) {
    assert.equal(RUNGS[op], "reversible", op);
    assert.notEqual(gradeOf(by), null, by);
  }
  const reasoned = Object.keys(T33_WRITES).filter((op) => T33_WRITES[op] === "reasoned");
  assert.deepEqual(reasoned.sort(), Object.keys(REASON_CODE).sort());
  for (const [op, code] of Object.entries(REASON_CODE)) assert.ok(JUSTIFICATION_REFUSALS.includes(code), `${op}: ${code}`);
  notMachine([...Object.keys(T33_WRITES).filter((op) => !ACTS_NOW.includes(op)), ...T33_READS]);
  /* negative control */
  assert.notDeepEqual(grades({ ...T33_WRITES, notewrite: "x" }), { ...T33_WRITES, notewrite: "undetermined" });
});

/* K5159 (fix round 10): `ownerReads` above looks only at T33's own keys, so a declared read with no row in T33 was never looked
   for (OP-GRADES #27 J29). Here every read its owner declares is looked for, over the owners R13 names (read from its text, not
   typed here): each must be a NON_ACT, so a missing row fails. */
const DECLARED = await collectDeclaredOps(new URL("../../../../", import.meta.url).pathname);
const R13_OWNERS = new Set(tickedAll(reqText(13)).filter((m) => Object.values(DECLARED.owners).includes(m)));
const R13_DECLARED_READS = Object.keys(DECLARED.ops).filter((op) => DECLARED.ops[op].weight === "read" && R13_OWNERS.has(DECLARED.owners[op]));

test("R13 (K5159): every read an owner R13 names declares is a NON_ACT, with no rung or ground; a declared read with no row fails "
   + "here; control: the same owners' writes are graded, not read", () => {
  assert.ok(R13_OWNERS.has("answers") && R13_DECLARED_READS.length >= 10, "the reads of R13's owners are found");
  assert.deepEqual(R13_DECLARED_READS.filter((op) => !Object.hasOwn(NON_ACTS, op)), [], "every declared read holds its NON_ACTS row");
  for (const op of R13_DECLARED_READS) assert.equal(gradeOf(op), null, op);
  /* control: a write of an owner R13 names is not a read: answers declares standingquestionset as a mutating act */
  assert.equal(DECLARED.owners.standingquestionset, "answers");
  assert.equal(DECLARED.ops.standingquestionset.mutating, true);
  assert.notEqual(DECLARED.ops.standingquestionset.weight, "read");
});

/* ---- R14 ----------------------------------------------------------------------------------------------------------- */
test("R14 R37: publishat and publishatmove `irreversible` (publishing's own weight; publish itself prepares since R37), "
   + "publishatcancel `reversible`, each with its NON_ACTS reason, publishschedule a read; phone false, false, true; none "
   + "a machine refusal", () => {
  assert.deepEqual([RUNGS.publishat, RUNGS.publishatmove, RUNGS.publishatcancel],
    ["irreversible", "irreversible", "reversible"]);
  assert.notEqual(RUNGS.publishat, RUNGS.publish, "R37: publish prepares; the set time is weighed as publishing");
  assert.equal(NON_ACTS.publishat, declaredSentence("ratification", "publishat"));
  for (const op of ["publishatmove", "publishatcancel"]) assert.equal(NON_ACTS[op], declaredSentence("publish-schedule", "publishatcancel"), op);
  assert.ok(isRead("publishschedule"));
  assert.deepEqual(["publishat", "publishatmove", "publishatcancel"].map(phoneOf), [false, false, true]);
  assert.deepEqual([RUNGS.caseratify], ["attested"], "the signing that takes a cancel back is graded");
  notMachine(["publishat", "publishatmove", "publishatcancel", "publishschedule"]);
});

/* ---- R15 ----------------------------------------------------------------------------------------------------------- */
test("R15: notewrite and noteturn `caller-owned` as reminderset, note-directed, notes a read, phone true, no machine "
   + "refusal; HYPOTHESIS_NO_REASON joins the family and NO_REASON stays", () => {
  const ND = declaredSentence("hypotheses", "notewrite");
  for (const op of ["notewrite", "noteturn"]) {
    assert.equal(RUNG_ABSENT[op].ground, "caller-owned", op);
    assert.equal(RUNG_ABSENT[op].ground, RUNG_ABSENT.reminderset.ground, op);
    assert.equal(NON_ACTS[op], ND, op);
    assert.equal(phoneOf(op), true, op);
  }
  assert.ok(isRead("notes"));
  notMachine(["notewrite", "noteturn", "notes"]);
  for (const c of ["HYPOTHESIS_NO_REASON", "NO_REASON"]) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
  assert.deepEqual([RUNGS.hypothesisrevise, RUNGS.hypothesiswithdraw], ["reasoned", "reasoned"]);
});

/* ---- R16 ----------------------------------------------------------------------------------------------------------- */
test("R16 R39: groupdescriptiondraft and writinghelp carry their owner's draft sentence and are no machine refusal; neither "
   + "takes a rung or a ground, both being reads (R39, K4247)", () => {
  assert.equal(NON_ACTS.groupdescriptiondraft, declaredSentence("store-door", "groupdescriptiondraft"));
  assert.equal(NON_ACTS.writinghelp, doesSentence("writinghelp"));
  assert.equal(gradeOf("writinghelp"), null);
  assert.equal(gradeOf("groupdescriptiondraft"), null, "a read carries no ground");
  notMachine(["groupdescriptiondraft", "writinghelp"]);
});

/* ---- R17 (moved from affordances' t34.test.mjs) -------------------------------------------------------------------- */
const T34_WRITES = {
  invitewithdraw: "credential", websitekeycreate: "credential", websitekeyset: "credential", websitekeyrevoke: "credential",
  joinlinkenable: "credential", joinlinkset: "credential", joinlinkreplace: "credential", joinlinkoff: "credential",
  websiteinvite: "credential", joinlinkinvite: "credential", courtnoticeset: "substrate", groupdescriptionset: "substrate",
  checkrequest: "undetermined", checktake: "undetermined", checkrecord: "reasoned",
  groupkeyset: "credential", groupkeyremove: "credential", groupkeyswitch: "substrate",
  groupkeynoticeseen: "caller-owned", placewanted: "substrate", memberlanguageset: "caller-owned",
};
/* a read its owner words without the "read: " lead holds the owner's sentence (K4168): startfrom */
const T34_READS = [...readRows(T34_NON_ACTS), ...Object.keys(T34_NON_ACTS).filter((op) => T34_NON_ACTS[op] === doesSentence(op))];
const T34_PUBLIC = ["websiteinvite", "joinlinkinvite", "groupdescription", "courtnotice"];
test("R17: every op T34 declares carries the grade read from its owner, each gated op its NON_ACTS reason, the public "
   + "ones none; checkrecord's CHECK_NO_REASON is in the family", () => {
  assert.deepEqual(grades(T34_WRITES), T34_WRITES);
  assert.deepEqual([...Object.keys(T34_RUNGS), ...Object.keys(T34_RUNG_ABSENT)].sort(), Object.keys(T34_WRITES).sort());
  for (const [op, e] of Object.entries(T34_RUNG_ABSENT)) assert.ok(e.is.length > 40, op);
  for (const [op, like] of [["groupkeyset", "keyedserviceset"], ["groupkeyswitch", "keyedserviceswitch"],
    ["courtnoticeset", "groupnameset"], ["placewanted", "officesseed"], ["websiteinvite", "knock"],
    ["groupkeynoticeseen", "disclosureshown"], ["memberlanguageset", "standingset"]])
    assert.equal(gradeOf(op), gradeOf(like), op);
  /* `startfrom` is declared in its owner's words, which do not lead with "read: " (K4168) */
  for (const op of T34_READS) { assert.ok(op === "startfrom" ? NON_ACTS[op] === doesSentence(op) : isRead(op), op); assert.equal(gradeOf(op), null, op); }
  for (const op of T34_PUBLIC) assert.ok(!Object.hasOwn(NON_ACTS, op), op);
  const gated = Object.keys(T34_WRITES).filter((op) => !T34_PUBLIC.includes(op));
  assert.deepEqual(Object.keys(T34_NON_ACTS).sort(), [...gated, ...T34_READS].sort());
  for (const op of gated) assert.ok(NON_ACTS[op].length > 30 && !isRead(op), op);
  assert.ok(JUSTIFICATION_REFUSALS.includes("CHECK_NO_REASON"));
  notMachine([...Object.keys(T34_WRITES), ...T34_READS]);
});

test("R17: each of op-declarations R21's aliases takes its op's very grade and reason through one frozen table — an "
   + "alias never differs from its op", async () => {
  assert.ok(Object.isFrozen(OP_ALIASES));
  /* the count is op-declarations' own alias table, read by path as the declared rows are (declared.mjs), never a written number (B27) */
  const DECLARED_ALIASES = await declaredAliases();
  assert.deepEqual(Object.keys(OP_ALIASES).sort(), Object.keys(DECLARED_ALIASES).sort());
  assert.ok(Object.keys(OP_ALIASES).length > 0);
  /* K2054: `expunge` is no alias since K1901 (`personexpunge` is a declared op), so nothing grades it */
  assert.ok(!Object.hasOwn(OP_ALIASES, "expunge"));
  assert.deepEqual([RUNGS.expunge, RUNG_ABSENT.expunge, NON_ACTS.expunge], [undefined, undefined, undefined]);
  /* K2239 (DEC-182 (2)): `claimidentity` is withdrawn; the same-person claim is `identityclaim` alone */
  assert.ok(!Object.hasOwn(OP_ALIASES, "claimidentity"));
  assert.deepEqual([RUNGS.claimidentity, RUNG_ABSENT.claimidentity, NON_ACTS.claimidentity], [undefined, undefined, undefined]);
  assert.ok(Object.hasOwn(RUNGS, "identityclaim"));
  for (const [a, op] of Object.entries(OP_ALIASES)) {
    /* named as a non-act, or (T45, R32: filingsent) an ACTS row in MACHINE_REFUSALS */
    assert.ok(Object.hasOwn(NON_ACTS, op) || Object.hasOwn(MACHINE_REFUSALS, op), `${op}, ${a}'s op, is named`);
    assert.equal(NON_ACTS[a], NON_ACTS[op], a);
    assert.equal(RUNGS[a], RUNGS[op], a);
    assert.equal(RUNG_ABSENT[a], RUNG_ABSENT[op], `${a}: the same entry object`);
    assert.equal(gradeOf(a), gradeOf(op), a);
    assert.equal(phoneOf(a), phoneOf(op), a);
  }
  for (const a of ["ruleanswer", "reconcile"]) assert.equal(gradeOf(a), null, a);
  assert.deepEqual(aliased({ rule: "x" }), { ruleanswer: "x" });
  assert.deepEqual(aliased({}), {});
});
