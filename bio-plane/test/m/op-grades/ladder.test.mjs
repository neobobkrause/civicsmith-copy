/* op-grades: the ladder and the grades (R1–R4), machine refusals and non-acts (R5), the phone set (R18) and the two
   invariants (R19, R20), each at the module's exports. Backing (`affordances` R19), the machine drive (`affordances` R20)
   and the totality (`affordances` R12) stay in `affordances`' tests, which read these tables; this module uses nothing
   (P4), so no owner is imported here. */
import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../../../src/op-grades/index.mjs";
import { reqText, between, ticked, tickedCodes, worded, asksNotTheAccount, declaredSentence, tickedAll } from "./declared.mjs";

const { RUNG_LADDER, RUNGS, RUNG_ABSENT, RUNG_ABSENCE_GROUNDS, JUSTIFICATION_REFUSALS, IRREVERSIBLE_CORRECTION_KEY,
        CONSEQUENCE_STATEMENTS, LARGER_SCREEN_ACTS, MACHINE_REFUSALS, NON_ACTS, OP_ALIASES, phoneOf } = G;
const words = (s) => s.trim().split(/[\s,]+/).filter(Boolean);
const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;

/* ---- R1: the ladder and every rung it names, as R1 lists them ---------------------------------------------------- */
/* (T47) R37 re-grades `publish` from irreversible to terminal (it prepares; caseratify signs; K3100 doubt 9), and R35
   moves `inboxpull` from R2's `undetermined` to `reversible` */
const R1_TEXT = reqText(1);
/* R1 states the other bands as plain words */
const BAND = (from, to) => worded(between(R1_TEXT, from, to));
const R1 = {
  irreversible: [],
  attested: BAND("attested ", "; terminal"),
  terminal: [...BAND("; terminal ", "; reversible "), "publish"],
  reversible: [...BAND("; reversible ", "; reasoned "), "inboxpull"],
  reasoned: BAND("; reasoned ", "DEC-88's three bands"),
};
/* DEC-88's three bands (K1038, J1): its 57, moved from RUNG_ABSENT into RUNGS, as the backticked ops of R1's sentence */
const DEC88_TEXT = R1_TEXT.slice(R1_TEXT.indexOf("DEC-88's three bands"));
const DEC88 = {
  reversible: ticked(between(DEC88_TEXT, "reversible ", "; reasoned ")),
  reasoned: ticked(between(DEC88_TEXT, "reasoned ", " (DEC-88 banded")),
  terminal: ticked(between(DEC88_TEXT, "terminal ")),
};

test("R1: RUNG_LADDER is reversible, reasoned, terminal, attested, irreversible, low to high, and RUNGS assigns every op "
   + "R1 names, DEC-88's 57 among them, the rung R1 gives it", () => {
  assert.deepEqual(RUNG_LADDER, ["reversible", "reasoned", "terminal", "attested", "irreversible"]);
  for (const [rung, ops] of Object.entries(R1)) for (const op of ops) assert.equal(RUNGS[op], rung, op);
  assert.equal(Object.values(DEC88).flat().length, 57);
  for (const [rung, ops] of Object.entries(DEC88)) for (const op of ops) {
    assert.equal(RUNGS[op], rung, op);
    assert.ok(!Object.hasOwn(RUNG_ABSENT, op), `${op} left RUNG_ABSENT`);
  }
  /* every rung any op carries is a rung of the ladder */
  for (const [op, rung] of Object.entries(RUNGS)) assert.ok(RUNG_LADDER.includes(rung), op);
  /* negative control: a misgraded op is seen */
  const wrong = (rungs) => Object.entries(R1).flatMap(([rung, ops]) => ops.filter((op) => rungs[op] !== rung));
  assert.deepEqual(wrong(RUNGS), []);
  assert.deepEqual(wrong({ ...RUNGS, retire: "reasoned" }), ["retire"]);
});

test("R1 R44: the correction path DEC-19 requires beside the top rung is a key, never a sentence, and "
   + "JUSTIFICATION_REFUSALS is the family of codes by which an owner asks the member's own account", () => {
  assert.equal(IRREVERSIBLE_CORRECTION_KEY, "screen.ceremony.permanent");
  assert.ok(!Object.hasOwn(G, "IRREVERSIBLE_CORRECTION_PATH"), "the sentence's old name is gone, so no reader takes a key for it");
  assert.equal(new Set(JUSTIFICATION_REFUSALS).size, JUSTIFICATION_REFUSALS.length, "no code twice");
  /* the codes R1 names (the reasoned acts it backs), and NO_REASON, the code the family begins with */
  const R1_CODES = tickedCodes(R1_TEXT).filter((c) => !Object.hasOwn(G, c) && !c.endsWith("_PATH"));
  assert.ok(R1_CODES.length >= 4);
  for (const c of ["NO_REASON", ...R1_CODES]) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
  /* the codes that demand an object, an identifier or evidence of a document stay out: R1's rule, over any code */
  assert.deepEqual(JUSTIFICATION_REFUSALS.filter(asksNotTheAccount), []);
  assert.ok(asksNotTheAccount("NO_TARGET") && asksNotTheAccount("NO_ID") && asksNotTheAccount("NO_KIND"));
});

/* ---- R2, R3 -------------------------------------------------------------------------------------------------------- */
test("R2: RUNG_ABSENT names each op with one ground of RUNG_ABSENCE_GROUNDS (substrate, credential, caller-owned, "
   + "observational, undetermined), each ground carrying its sentence; no op is in both tables; the ops R2 names hold the "
   + "ground it gives them", () => {
  assert.deepEqual(Object.keys(RUNG_ABSENCE_GROUNDS),
    ["substrate", "credential", "caller-owned", "observational", "undetermined"]);
  for (const [g, s] of Object.entries(RUNG_ABSENCE_GROUNDS)) assert.ok(typeof s === "string" && s.length > 80, g);
  for (const [op, e] of Object.entries(RUNG_ABSENT)) {
    assert.ok(Object.hasOwn(RUNG_ABSENCE_GROUNDS, e.ground), `${op}: ${e.ground}`);
    assert.ok(typeof e.is === "string" && e.is.length > 0, op);
  }
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
  const R2 = { contradictionrecommend: "undetermined", contradictionoptin: "undetermined",
    contradictionrespond: "undetermined", signerregister: "credential", signerrevoke: "credential",
    knockerconsent: "credential", communicationprepare: "undetermined",
    templatesave: "undetermined", actioncreate: "undetermined", actionpressure: "undetermined",
    optionadd: "undetermined", optionpropose: "undetermined", optionadopt: "undetermined", checkpointrecord: "undetermined",
    optionstart: "undetermined", reminderset: "caller-owned", reminderanswer: "caller-owned" };
  for (const [op, ground] of Object.entries(R2)) assert.equal(RUNG_ABSENT[op]?.ground, ground, op);
  assert.equal(RUNG_ABSENT.signerregister.ground, RUNG_ABSENT.signeradd.ground);
  assert.equal(RUNG_ABSENT.knockerconsent.ground, RUNG_ABSENT.knock.ground);
  assert.equal(RUNG_ABSENT.reminderset.ground, RUNG_ABSENT.queuesnooze.ground);
  /* R35 (T47) amends R2: inboxpull is no longer stated absent */
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "inboxpull"));
});

test("R3 R35 R47: no rung is added for an act corrected forward: DEC-88 left 21 `undetermined`, R35 (T47) moves inboxpull "
   + "out, leaving 20, R47 (T50) moves planopen out, leaving 19, and with R7's, R9's and R10's the count reads 23 — each named "
   + "here `undetermined`, and the ladder has no other rung", () => {
  const R3 = words(`contradictionrecommend contradictionoptin contradictionrespond communicationprepare
    templatesave actioncreate actionpressure optionadd optionpropose optionadopt checkpointrecord optionstart
    templatedraft templaterevise templatepropose templatesubmit templatereview templatecomment templateapprove`);
  assert.equal(R3.length, 19);
  const R23 = [...R3, "whatchangedpropose", "docketpressure", "caseimport", "caseimportdocument"];
  for (const op of R23) assert.equal(RUNG_ABSENT[op]?.ground, "undetermined", op);
  assert.equal(gradeOf("planopen"), "reversible", "R47: planopen left the ground");
  assert.notEqual(gradeOf("inboxpull"), "undetermined", "R35: inboxpull left the ground");
  assert.equal(RUNG_LADDER.length, 5);
  /* `undetermined` holds only where neither rule holds: no op graded undetermined also asks a reason in R1's lists */
  for (const op of [...R1.reasoned, ...DEC88.reasoned]) assert.notEqual(gradeOf(op), "undetermined", op);
});

/* ---- R4 ------------------------------------------------------------------------------------------------------------ */
test("R4 R44: CONSEQUENCE_STATEMENTS maps DEC-88's six judgement calls to {friction, key}: dialog for attribute, "
   + "leadshare, entitycreate, strengthbar and filingapprove, in-place for workobjective; frozen, their rungs unchanged", () => {
  const SIX = { attribute: "dialog", leadshare: "dialog", entitycreate: "dialog", strengthbar: "dialog",
    filingapprove: "dialog", workobjective: "in-place" };
  assert.ok(Object.isFrozen(CONSEQUENCE_STATEMENTS));
  for (const [op, friction] of Object.entries(SIX)) {
    const e = CONSEQUENCE_STATEMENTS[op];
    assert.ok(Object.isFrozen(e), op);
    assert.deepEqual(Object.keys(e), ["friction", "key"], op);
    assert.equal(e.friction, friction, op);
    assert.equal(e.key, `consequence.${op}`, op);
  }
  assert.deepEqual([RUNGS.attribute, RUNGS.leadshare, RUNGS.entitycreate, RUNGS.strengthbar, RUNGS.filingapprove,
    RUNGS.workobjective], ["reasoned", "reasoned", "reasoned", "reasoned", "terminal", "reasoned"]);
  /* an entry holds no English (R44): control, a copy carrying a sentence is seen */
  for (const e of Object.values(CONSEQUENCE_STATEMENTS)) assert.ok(!Object.hasOwn(e, "statement"));
  assert.ok(Object.hasOwn({ ...CONSEQUENCE_STATEMENTS.attribute, statement: "x" }, "statement"));
  /* only the six, R8's actionholdrelease, R21's personexpunge and (K2049) standardrelease, R24's openwithwarning
     (beside its ground) and (T53) R55's rowexpunge carry one */
  assert.deepEqual(Object.keys(CONSEQUENCE_STATEMENTS).sort(),
    [...Object.keys(SIX), "actionholdrelease", "personexpunge", "standardrelease", "openwithwarning", "rowexpunge"].sort());
});

/* ---- R5 ------------------------------------------------------------------------------------------------------------ */
/* K4279 (R5): `export` is a NON_ACT whose sentence is corpus-export's declared description word for word (R50 (b)), read from
   the word table; its rung-absence stays as the substrate ground, and no machine refusal names it. */
test("R5 (K4279): NON_ACTS.export is corpus-export's declared sentence, word for word; export keeps its substrate ground and "
   + "no machine refusal names it", () => {
  assert.ok(NON_ACTS.export.length > 0);
  assert.equal(NON_ACTS.export, declaredSentence("corpus-export", "export"));
  assert.equal(RUNG_ABSENT.export.ground, "substrate");
  assert.equal(Object.hasOwn(MACHINE_REFUSALS, "export"), false);
});
test("R5: MACHINE_REFUSALS maps each act refused a machine by name to its code; NON_ACTS gives the reasons R5 names, "
   + "`capture-directed:` exactly for attest, monitor and attesttext", () => {
  const V = "MACHINE_CANNOT_MOVE_VERSION";
  /* R55's register rows are pinned against R55's own text in r55.test.mjs */
  const R55_OPS = new Set(tickedAll(between(reqText(55), "`MACHINE_REFUSALS` gains every register WRITE op", "; the reads")));
  assert.ok(R55_OPS.size >= 12);
  assert.deepEqual(Object.fromEntries(Object.entries(MACHINE_REFUSALS).filter(([op]) => !R55_OPS.has(op))), {
    release: "MACHINE_CANNOT_RELEASE", conclude: "MACHINE_CANNOT_CONCLUDE", withdrawconclusion: "MACHINE_CANNOT_CONCLUDE",
    reopen: "MACHINE_CANNOT_REOPEN", publish: "MACHINE_CANNOT_PUBLISH", inquirydivide: "MACHINE_CANNOT_DIVIDE",
    inquiryground: "MACHINE_CANNOT_GROUND", actionmove: "MACHINE_CANNOT_MOVE_ACTION",
    actioncorrespond: "MACHINE_CANNOT_CORRESPOND", actionlaws: "MACHINE_CANNOT_SET_LAWS",
    actionrisktier: "MACHINE_CANNOT_SET_RISK_TIER", versionaccept: V, versionreject: V, versionconsider: V,
    versionrevert: V, versioncurrent: V, versionhide: V, contradictionresolve: "MACHINE_CANNOT_ACT_ON_CANDIDATE",
    /* R8, R32 (T45; K2885, K2887): the acts affordances R51 makes ACTS rows, each with its owner's code */
    actionhold: "MACHINE_CANNOT_SET_HOLD", actionholdrelease: "MACHINE_CANNOT_SET_HOLD",
    actionpressure: "MACHINE_CANNOT_MARK_PRESSURE", holdnoticesent: "MACHINE_CANNOT_SEND",
    actionreceipt: "MACHINE_CANNOT_CORRESPOND", actionscope: "MACHINE_CANNOT_SET_SCOPE",
    actionpromise: "MACHINE_CANNOT_RECORD_PROMISE", actionreplybearing: "MACHINE_CANNOT_RECORD_BEARING",
    arosefrom: "MACHINE_CANNOT_LINK", escalationopen: "MACHINE_CANNOT_OPEN", escalationattach: "MACHINE_CANNOT_ATTACH",
    counselpacket: "MACHINE_CANNOT_NAME_COUNSEL", filingapprove: "MACHINE_CANNOT_APPROVE", filingsent: "MACHINE_CANNOT_FILE",
    clockstate: "MACHINE_CANNOT_STATE_CLOCK", reminderset: "MACHINE_CANNOT_SET_REMINDER", itemtakeup: "MACHINE_CANNOT_PLAN",
    /* R33 (T46; affordances R52): stopping and reopening an escalation, ACTS rows on an action */
    escalationstoppursuing: "MACHINE_CANNOT_STOP", escalationreopen: "MACHINE_CANNOT_STOP",
    /* R33 (T46; K2998): adopting a clock proposal, an ACTS row on an action */
    clockadopt: "MACHINE_CANNOT_ADOPT_CLOCK",
    /* R38 (T48; affordances R58): the quoting record, an ACTS row on an action */
    actionreplyquoting: "MACHINE_CANNOT_RECORD_QUOTING" });
  /* R32: the four that admit a machine take no row, and no ACTS row is also a non-act */
  for (const op of ["filingprepare", "communicationprepare", "holdnoticeprepare", "actionbearingpropose"])
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  for (const op of Object.keys(MACHINE_REFUSALS)) assert.ok(!Object.hasOwn(NON_ACTS, op), `${op} is an act, never a non-act too`);
  assert.deepEqual(Object.keys(NON_ACTS).filter((op) => NON_ACTS[op].startsWith("capture-directed:")).sort(),
    ["attest", "attesttext", "monitor"]);
  /* the three share the head of the sentence before its first semicolon: the one `contradiction` declares for dismiss */
  const CANDIDATE_HEAD = declaredSentence("contradiction", "contradictiondismiss").split(";")[0];
  for (const op of ["contradictiondismiss", "contradictionclarify", "contradictiontakeup"])
    assert.ok(NON_ACTS[op].startsWith(CANDIDATE_HEAD), op);
  assert.ok(NON_ACTS.contradictionrecommend.startsWith("run-directed:"));
  assert.ok(NON_ACTS.resolutiondefect.startsWith(declaredSentence("entities", "resolutiondefect").split(":")[0]));
  const CONFLICT_HEAD = declaredSentence("contradiction", "contradictionoptin").split(";")[0];
  for (const op of ["contradictionoptin", "contradictionrespond"]) assert.ok(NON_ACTS[op].startsWith(CONFLICT_HEAD), op);
  const R5_READS = ticked(reqText(5)).filter((op) => Object.hasOwn(NON_ACTS, op) && NON_ACTS[op].startsWith("read: "));
  assert.equal(R5_READS.length, 6);
  for (const op of R5_READS) assert.ok(NON_ACTS[op].startsWith("read: "), op);
  assert.match(NON_ACTS.ratify, /op=publishpreflight \(case-authoring R34\)/);
  for (const [op, why] of Object.entries(NON_ACTS)) assert.ok(typeof why === "string" && why.length > 0, op);
});

/* ---- R18 ----------------------------------------------------------------------------------------------------------- */
test("R18: phoneOf is false at terminal, attested and irreversible, for a credential absence, for every op in "
   + "IRREVERSIBLE_WEIGHT (T37, DEC-181) and for LARGER_SCREEN_ACTS (frozen, filingsent alone, R26), and true otherwise — "
   + "reads, captures and everyday acts", () => {
  assert.ok(Object.isFrozen(LARGER_SCREEN_ACTS));
  assert.deepEqual([...LARGER_SCREEN_ACTS], ["filingsent"]);
  /* an alias answers as its op (R17) */
  const expect = (id) => { const op = OP_ALIASES[id] ?? id;
    return !(["terminal", "attested", "irreversible"].includes(RUNGS[op])
      || RUNG_ABSENT[op]?.ground === "credential" || G.IRREVERSIBLE_WEIGHT.includes(op) || LARGER_SCREEN_ACTS.includes(op)); };
  for (const op of new Set([...Object.keys(RUNGS), ...Object.keys(RUNG_ABSENT), ...Object.keys(NON_ACTS)]))
    assert.equal(phoneOf(op), expect(op), op);
  /* one op of each rung, the larger-screen act, a credential absence, a read and an op no table names */
  const ofRung = (rung) => Object.keys(RUNGS).find((op) => RUNGS[op] === rung && !G.IRREVERSIBLE_WEIGHT.includes(op));
  const credential = Object.keys(RUNG_ABSENT).find((op) => RUNG_ABSENT[op].ground === "credential");
  const read = Object.keys(NON_ACTS).find((op) => NON_ACTS[op].startsWith("read: ") && !Object.hasOwn(RUNG_ABSENT, op));
  assert.deepEqual([ofRung("terminal"), ofRung("attested"), credential, ...LARGER_SCREEN_ACTS].map(phoneOf), [false, false, false, false]);
  assert.deepEqual([ofRung("reasoned"), ofRung("reversible"), read, "an-op-no-table-names"].map(phoneOf), [true, true, true, true]);
  assert.deepEqual(G.IRREVERSIBLE_WEIGHT.map(phoneOf).filter(Boolean), []);
  assert.equal(RUNGS.filingsent, "reasoned", "its rung alone would leave it on the phone");
  assert.deepEqual([phoneOf("filingrecordsent"), phoneOf("filingsent")], [false, false], "the alias as its op");
});

/* ---- R19, R20 ------------------------------------------------------------------------------------------------------ */
test("R19: nothing here writes — every export is data or a pure function, and calling each leaves every table as it was",
() => {
  const snap = () => JSON.stringify(Object.fromEntries(Object.entries(G).filter(([, v]) => typeof v !== "function")));
  const before = snap();
  for (const op of [...Object.keys(RUNGS), ...Object.keys(NON_ACTS), "nothing"]) phoneOf(op);
  const out = G.aliased(RUNGS);
  out.extra = "x";
  assert.equal(snap(), before);
  assert.deepEqual(Object.entries(G).filter(([, v]) => typeof v === "function").map(([k]) => k).sort(),
    ["aliased", "memberMayDo", "phoneOf", "registerDeclaredOps"], "R19 (T51; fix round 3 adds the pure memberMayDo): the one writer is registerDeclaredOps, R49's, and it changes this module's tables only");
  assert.ok(Object.isFrozen(OP_ALIASES) && Object.isFrozen(CONSEQUENCE_STATEMENTS) && Object.isFrozen(G.IRREVERSIBLE_WEIGHT));
});

test("R20: no place is named in this module's outward text — no sentence it serves (grounds, correction path, consequence "
   + "statements, absences, NON_ACTS reasons) names a jurisdiction, and NON_ACTS.idmatch names no local identifier system "
   + "or publisher", () => {
  const served = JSON.stringify([RUNG_ABSENCE_GROUNDS, IRREVERSIBLE_CORRECTION_KEY, CONSEQUENCE_STATEMENTS, RUNG_ABSENT,
    NON_ACTS, LARGER_SCREEN_ACTS, G.IRREVERSIBLE_WEIGHT]);
  const PLACES = /\b(Oakland|Alameda|California|Berkeley|San Francisco|Sacramento|Legistar|Granicus|Municode|OPD)\b/i;
  assert.equal(PLACES.exec(served), null);
  assert.match(NON_ACTS.idmatch, /identifier spaces the active profiles declare/);
  assert.equal(PLACES.exec(NON_ACTS.idmatch), null);
  assert.ok(PLACES.test(served.replace("the active profiles", "Oakland's profiles")), "negative control");
});
