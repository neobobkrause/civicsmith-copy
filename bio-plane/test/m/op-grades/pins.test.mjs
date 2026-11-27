/* op-grades: the content of its tables pinned until T45 only in `affordances`' tests (N891; T45-38; AFFORDANCES #29 J1,
   K2773), pinned here at this module's exports so that `affordances` may drop its copies (T45-39). No requirement changes
   and no id is added: each test pins R1–R32 as written. This module uses nothing (P4), so no owner and no later module is
   imported: what affordances read from an owner's op map or checks table is named here as the requirements name it. */
import test from "node:test";
import assert from "node:assert/strict";
import { reqText, between, ticked, tickedAll, worded, joinedCodes, asksNotTheAccount, readRows } from "./declared.mjs";
import * as G from "../../../src/op-grades/index.mjs";
import { T33_RUNGS, T33_RUNG_ABSENT, T33_NON_ACTS } from "../../../src/op-grades/t33.mjs";
import { T34_RUNGS, T34_RUNG_ABSENT, T34_NON_ACTS } from "../../../src/op-grades/t34.mjs";
import { T35_RUNGS, T35_RUNG_ABSENT } from "../../../src/op-grades/t35.mjs";
import { T36_RUNG_ABSENT } from "../../../src/op-grades/t36.mjs";
import { T41_RUNG_ABSENT } from "../../../src/op-grades/t41.mjs";
import { T45_RUNGS, T45_RUNG_ABSENT } from "../../../src/op-grades/t45.mjs";
import { T50_RUNGS } from "../../../src/op-grades/t50.mjs";

const { RUNGS, RUNG_ABSENT, NON_ACTS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_CORRECTION_KEY,
        OP_ALIASES } = G;
/** @import { Absence } from "../../../src/op-grades/declared.mjs" */
/** @typedef {Array<string | undefined>} Ops ops as the requirement helpers read them */
/**
 * @typedef {{ irreversible: Ops, attested: Ops, terminal: Ops, reversible: Ops, reasoned: Ops, [rung: string]: Ops }} Bands
 * each rung's ops, as a test states them
 */
/** @typedef {{ reversible: string[], reasoned: string[], terminal: string[], [band: string]: string[] }} Dec88Bands DEC-88's three bands */

/**
 * The value `v`, which the line reading it requires to be there (as reading a member of it threw when it was not).
 * @template T
 * @param {T | undefined} v
 * @param {string} name
 * @returns {T}
 */
const held = (v, name) => {
  if (v === undefined) throw new TypeError(`${name} is not held`);
  return v;
};
/**
 * The band `rung` of `bands`, which must be one of them (as `bands[rung].push` threw on any other).
 * @param {{ readonly [rung: string]: Ops }} bands
 * @param {string | undefined} rung
 * @returns {Ops}
 */
const bandOf = (bands, rung) => held(rung === undefined ? undefined : bands[rung], `the band ${rung}`);

/** @param {string} op */
const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op]?.ground : null;
/** @param {string} op */
const ungraded = (op) => !Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op);
/** @param {string} op */
const readWritesNothing = (op) => {
  const reason = NON_ACTS[op];
  return typeof reason === "string" && reason.startsWith("read: ")
    && reason.length > 40 && /writes nothing$/.test(reason);
};
/** @param {Readonly<{ [op: string]: string }>} rungs */
const bandsOf = (rungs) => {
  /** @type {{ [rung: string]: string[] }} */
  const got = {};
  for (const [op, r] of Object.entries(rungs)) (got[r] ??= []).push(op);
  for (const k of Object.keys(got)) got[k]?.sort();
  return got;
};
/** @param {Readonly<{ [op: string]: Absence }>} absent */
const undeterminedOf = (absent) => Object.keys(absent).filter((op) => absent[op]?.ground === "undetermined").sort();

/* ---- R1, R3: RUNGS as a closed partition ---------------------------------------------------------------------------- */
/* DEC-88's three bands, as op-grades R1 states them (the backticked ops of its sentence, read from the requirement) */
const R1_TEXT = reqText(1);
const DEC88_TEXT = R1_TEXT.slice(R1_TEXT.indexOf("DEC-88's three bands"));
/**
 * @param {string} from
 * @param {string} [to]
 */
const DEC88_BAND = (from, to) => ticked(between(DEC88_TEXT, from, to));
/** @type {Dec88Bands} */
const DEC88 = {
  reversible: DEC88_BAND("reversible ", "; reasoned "),
  reasoned: DEC88_BAND("reasoned ", " (DEC-88 banded"),
  terminal: DEC88_BAND("terminal "),
};
/* R1's first sentences state the other bands as plain words */
/**
 * @param {string} from
 * @param {string} to
 */
const R1_BAND = (from, to) => worded(between(R1_TEXT, from, to));
/* R30 (T41): its backticked ops, band by band; K2583 adds the guides' two (`guidepropose` as `extractpropose`,
   `guideproposetocivicsmith` as `guideoffer`) */
const R30 = reqText(30);
const K2583 = ticked(between(R30, "(K2583)", " `undetermined`"));
const T41_REASONED = ticked(between(R30, "assigns `reasoned` to", "; `reversible` to"));
const T41_REVERSIBLE = [...ticked(between(R30, "; `reversible` to", ". `RUNG_ABSENT`")), K2583[0]];
const T41_UNDETERMINED = [...ticked(between(R30, "`undetermined` (R3's rule):", "(K2570); `caller-owned` also")), K2583[2]];
/* the ops a requirement assigns to a rung in its first bullet: "assigns `<rung>` to `op`" */
/**
 * @param {number} n
 * @param {string} rung
 */
const ASSIGNED = (n, rung) => ticked(between(reqText(n), `assigns \`${rung}\` to`, " ("))[0];

test("R1 R3 R33 (N891): RUNGS is a closed partition — every op it ranks is one a requirement ranks, in its band, and no other; DEC-88's three bands word for word among them; a misbanded op, or one of the 57 left out, is seen", () => {
  /** @type {Bands} */
  const want = {
    irreversible: ["publishat", "publishatmove" /* R14 */],
    attested: [...R1_BAND("attested ", "; terminal"), ASSIGNED(7, "attested") /* R7 */, ASSIGNED(9, "attested") /* R9 */],
    terminal: ["retire", "actionholdrelease" /* R8 */, "publish" /* R37 (T47; K3100 doubt 9) */],
    reversible: [...R1_BAND("; reversible ", "; reasoned"), "importwatch", "importunwatch" /* R12 */,
      "publishatcancel" /* R14 */, "inboxpull" /* R35 (T47) */, ...DEC88.reversible],
    reasoned: [...R1_BAND("; reasoned ", "DEC-88's three bands"), "templateretire", "factconfirm" /* R6 */,
      "docketfile", "docketdecline" /* R9 */, "importaccept", "importacceptwithdraw", "importflag", "importflagclear" /* R10 */,
      "wizardretire" /* R11 */, ...DEC88.reasoned],
  };
  want.terminal.push(...DEC88.terminal);
  /* R13, R17, R22: the per-tranche tables, each pinned op by op in owners.test.mjs and t35.test.mjs */
  for (const t of [T33_RUNGS, T34_RUNGS, T35_RUNGS]) for (const [op, r] of Object.entries(t)) bandOf(want, r).push(op);
  /* R23–R31, R32, named by hand as their requirements word them */
  want.reasoned.push("standardinforcethrough", "standardinforcethroughwithdraw", "spotcheckvisit", "releasescanhold",
    "aikeepaway", "obscuremarkwithdraw", ...T41_REASONED);
  want.reversible.push("translationadopt", "translationconfirm", "translationrevert", "obscuremark", ...T41_REVERSIBLE);
  want.reasoned.push("scenariosetaside", "scenariorestore", "planpause", "planresume", "actionscope", "projectscopeset",
    "projectapprovalset", "successrevise", "cureunlink", "ruledraft", "rulewithdraw");
  want.reversible.push("followend", "actionpromise", "actionreplybearing", "actionbearingpropose", "curelink",
    "matteroutcomeset", "plancomment", "declaredstakeset" /* B6, K2896 */);
  want.terminal.push("publishcheck" /* graded as publish (K2883), so terminal with it since R37 */);
  /* R33 (T46) */
  want.reasoned.push("escalationstoppursuing", "escalationreopen");
  want.terminal.push("filingsecondapprove");
  /* R36, R37 (T47) */
  want.reversible.push("drawquestion", "monitorset", "grouplogoset", "grouplanguagesset", "signrequest");
  want.reasoned.push("projectbarset");
  /* R38, R40, R41 (T48) */
  want.reversible.push("actionreplyquoting", "updatelater", "updatestart", "planask");
  want.reasoned.push("updateskip", "stepsource", "stepsourcewithdraw");
  /* K4323 (fix round 2; contradiction R61): a member's flag of two documents, reasoned (FLAG_NO_REASON) */
  want.reasoned.push("contradictionflag");
  /* R45, R47 (T50) */
  for (const [op, r] of Object.entries(T50_RUNGS)) bandOf(want, r).push(op);
  for (const [a, op] of Object.entries(OP_ALIASES)) if (Object.hasOwn(RUNGS, op)) bandOf(want, RUNGS[op]).push(a);
  for (const k of Object.keys(want)) want[k]?.sort();
  assert.deepEqual(bandsOf(RUNGS), want);
  assert.equal(Object.values(DEC88).flat().length, 57);
  /* the per-tranche tables are spread whole */
  for (const [op, r] of Object.entries(T45_RUNGS)) assert.equal(RUNGS[op], r, op);
  /* negative controls */
  assert.notDeepEqual(bandsOf({ ...RUNGS, testify: "reversible" }), want);
  const { suggest, ...withoutOne } = RUNGS;
  assert.equal(suggest, "reversible");
  assert.notDeepEqual(bandsOf(withoutOne), want);
});

test("R1 R8 R14 R32 R33 R37 (N891): the closed `terminal` set is retire, DEC-88's two, actionholdrelease, (T45) filingsecondapprove and (T47, R37) publish and publishcheck, which prepare; `irreversible` is the two that set when a signed edition publishes", () => {
  /** @param {string} r */
  const of = (r) => Object.keys(RUNGS).filter((op) => RUNGS[op] === r && !Object.hasOwn(OP_ALIASES, op)).sort();
  const TERMINAL = [...R1_BAND("; terminal ", "; reversible "), ASSIGNED(8, "terminal") /* R8 */, ...DEC88.terminal,
    "filingsecondapprove" /* R33 */, "publish", "publishcheck" /* R37: graded as publish */];
  assert.deepEqual(of("terminal"), TERMINAL.sort());
  assert.deepEqual(of("irreversible"), ["publishat", "publishatmove"]);
  /* negative control */
  assert.notDeepEqual(of("terminal"), TERMINAL.filter((op) => op !== "publish"));
});

/* ---- R3: the `undetermined` ground, closed, with its tally ----------------------------------------------------------- */
/* R3's 21 (its plain words, and K921's seven in backticks), less inboxpull, which R35 (T47) moves to `reversible`, and
   planopen, which R47 (T50) moves too */
const R3_TEXT = reqText(3);
const R3_LEFT = [...worded(between(R3_TEXT, "leaving 21 `undetermined`:", " and K921's seven")),
  ...tickedAll(between(R3_TEXT, "K921's seven (R6:", ")"))].filter((op) => op !== "inboxpull" && op !== "planopen");
test("R3 R33 R35 (N891): the `undetermined` ground is closed — exactly R3's 21 less inboxpull (R35) and the ops ruled onto it later on R3's rule, deepercheck no longer among them, and no other; the 78 held before DEC-88 are the 21 and DEC-88's 57; a later op left out, or one of the 57 left there, is seen", () => {
  const LATER = ["whatchangedpropose", "docketpressure", "caseimport", "caseimportdocument", "wizardrevise",
    "wizardpropose", "wizardsubmit", "wizardapprove", ...undeterminedOf(T33_RUNG_ABSENT), ...undeterminedOf(T34_RUNG_ABSENT),
    ...undeterminedOf(T35_RUNG_ABSENT), "safecopyrequest", "translationmark" /* R39 (T48): translationdraft left the ground */,
    ...T41_UNDETERMINED, "pagetranscribe",
    /* R32 (T45), named by hand */
    "dutyfromresponse", "actionreceipt", "holdnoticesent", "pressurerecord", "watchlink", "watchanswer", "jointsignatory",
    "holdnoticeprepare", "arosefrom", "successrecord", "outcomecarry", "clockstate", "planreviewrecord", "prepitemadd",
    "prepitemdone", "statusreportsave", "ruleconfirm", "advocacycheck" /* K2881 */,
    /* R45 (T50): `actioninquiry`, the one new `undetermined` op T50 adds (wizarddraft and planopen left the ground, R47) */
    "actioninquiry",
    /* R33 (T46), named by hand */
    "airundispatch",
    ...Object.entries(OP_ALIASES).filter(([, op]) => RUNG_ABSENT[op]?.ground === "undetermined").map(([a]) => a)];
  assert.equal(new Set(LATER).size, LATER.length);
  assert.deepEqual(undeterminedOf(T36_RUNG_ABSENT), ["safecopyrequest"]);
  assert.deepEqual(undeterminedOf(T41_RUNG_ABSENT), [...T41_UNDETERMINED].sort());
  assert.equal(undeterminedOf(T45_RUNG_ABSENT).length, 18);
  const left = undeterminedOf(RUNG_ABSENT).filter((op) => !LATER.includes(op));
  assert.deepEqual(left, [...R3_LEFT].sort());
  assert.equal(left.length, 19, "R3's count: DEC-88 moved 57 of the 78 into RUNGS, and R35 inboxpull and R47 planopen left");
  assert.equal(undeterminedOf(RUNG_ABSENT).length, LATER.length + 19);
  assert.ok(!undeterminedOf(RUNG_ABSENT).includes("inboxpull") && !undeterminedOf(RUNG_ABSENT).includes("deepercheck"));
  /* the 78 held before DEC-88: the 21 (inboxpull among them then) and the 57 together */
  const before78 = [...R3_LEFT, "planopen", "inboxpull", ...Object.values(DEC88).flat()];
  assert.equal(before78.length, 78);
  assert.equal(new Set(before78).size, 78);
  for (const op of Object.values(DEC88).flat()) {
    assert.ok(op !== undefined && Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op), op);
  }
  /* negative controls */
  assert.notDeepEqual(undeterminedOf({ ...RUNG_ABSENT, suggest: { ground: "undetermined", is: "x" } })
    .filter((op) => !LATER.includes(op)), [...R3_LEFT].sort());
  assert.deepEqual(undeterminedOf(RUNG_ABSENT).filter((op) => !LATER.includes(op) || op === "ruleconfirm")
    .filter((op) => !R3_LEFT.includes(op)), ["ruleconfirm"]);
});

/* ---- R2, R5: layer 9's NON_ACTS and read rows ------------------------------------------------------------------------ */
/* the stated absences R2 names for layer 9 (K705, K723, K732), with the ground it gives them; planopen left the ground at R47 */
const R2_TEXT = reqText(2);
/**
 * An op and its ground, as an entry of a table (the op as the table's key would spell it).
 * @param {string | undefined} op
 * @param {string} ground
 * @returns {[string, string]}
 */
const groundOf = (op, ground) => [String(op), ground];
const LAYER9_ABSENT = Object.fromEntries([
  ...ticked(between(R2_TEXT, "It holds (K705, K723)", ", ground `undetermined`")).map((op) => groundOf(op, "undetermined")),
  ...ticked(between(R2_TEXT, "and (K732)", ", ground `undetermined`")).filter((op) => op !== "planopen").map((op) => groundOf(op, "undetermined")),
  ...ticked(between(R2_TEXT, "`optionstart`, ground `undetermined`, and ", ", ground `caller-owned`")).map((op) => groundOf(op, "caller-owned")),
]);
const LAYER9_GATED_READS = ["optionstartpreview", "standardinforce"];
test("R2 R5 (N891): layer 9's stated absences (R2) carry their sentence and ground, and a NON_ACTS reason of more than ten characters and no capture act unless affordances R51 makes them ACTS rows; its two gated reads a `read:` reason writing nothing and no grade; actionriskpropose named", () => {
  /* the ones affordances R51 makes ACTS rows are named in NON_ACTS no longer (R32's T45 bullet; R33 adds the two escalation acts) */
  const ACTS_NOW = [...ticked(between(reqText(32), "leave `NON_ACTS`:", "(and `holdnoticeprepare`")), "escalationstoppursuing",
    "escalationreopen"];
  assert.ok(Object.keys(LAYER9_ABSENT).length >= 10);
  for (const [op, ground] of Object.entries(LAYER9_ABSENT)) {
    assert.equal(RUNG_ABSENT[op]?.ground, ground, op);
    assert.ok(held(RUNG_ABSENT[op], op).is.length > 20, op);
    if (ACTS_NOW.includes(op)) assert.ok(!Object.hasOwn(NON_ACTS, op), op);
    else {
      const reason = NON_ACTS[op];
      assert.ok(typeof reason === "string" && reason.length > 10 && !reason.startsWith("capture-directed:"), op);
    }
  }
  for (const op of ACTS_NOW.flatMap((op) => op !== undefined && (Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op)) ? [op] : []))
    assert.ok(!Object.hasOwn(NON_ACTS, op), op);
  for (const op of LAYER9_GATED_READS) { assert.ok(readWritesNothing(op), op); assert.ok(ungraded(op), op); }
  assert.ok(Object.hasOwn(NON_ACTS, "actionriskpropose"));
  /* negative control */
  assert.ok(Object.hasOwn({ ...NON_ACTS, monitoring: "read: x" }, "monitoring"));
});

/* ---- R5: every reason, and the substrate and directed forms ---------------------------------------------------------- */
test("R5 (N891): every NON_ACTS reason is a sentence of more than ten characters, `capture-directed:` exactly for attest, attesttext and monitor; acts and their own non-act rows are apart (sourceconsent, contradictionresolve, knock, knockerconsent named nowhere in NON_ACTS)", () => {
  for (const [op, r] of Object.entries(NON_ACTS)) assert.ok(typeof r === "string" && r.length > 10, op);
  assert.deepEqual(Object.keys(NON_ACTS).filter((op) => held(NON_ACTS[op], op).startsWith("capture-directed:")).sort(),
    ["attest", "attesttext", "monitor"]);
  for (const op of ["sourceconsent", "contradictionresolve", "knock", "knockerconsent"])
    assert.ok(!Object.hasOwn(NON_ACTS, op), op);
});

test("R2 R5 R6 (N891): the substrate and directed forms — the provenance pair `substrate` and document-directed; templatesave draft-directed citing filings R32; the grant's door named by exactly the four it reaches; the template grant's revoke on reviewrevoke's ground", () => {
  for (const op of ["provenancechain", "provenanceroute"]) {
    assert.equal(RUNG_ABSENT[op]?.ground, "substrate", op);
    assert.ok(!Object.hasOwn(RUNGS, op), op);
    const reason = NON_ACTS[op];
    assert.ok(reason?.startsWith("document-directed: ") && reason.length > 60, op);
  }
  assert.ok(held(NON_ACTS.templatesave, "templatesave").startsWith("draft-directed:"));
  assert.match(held(RUNG_ABSENT.templatesave, "templatesave").is, /filings R32/);
  const DOOR = ["templatereview", "templatecomment", "templateread", "templatecomments"];
  const TEMPLATE = Object.keys(NON_ACTS).filter((op) => op.startsWith("template") && op !== "templatesave");
  for (const op of TEMPLATE) assert.equal(held(NON_ACTS[op], op).includes("reached also through a review grant's door"), DOOR.includes(op), op);
  assert.equal(held(RUNG_ABSENT.templategrantrevoke, "templategrantrevoke").ground, held(RUNG_ABSENT.reviewrevoke, "reviewrevoke").ground);
  assert.match(held(NON_ACTS.contradictionpairs, "contradictionpairs"), /five named keys/);
  assert.doesNotMatch(held(NON_ACTS.ratify, "ratify"), /deferred/i);
  for (const re of [/`pulled` arm is the pull/, /op=inboxpull/, /reason on every arm/]) assert.match(held(NON_ACTS.inboxresolve, "inboxresolve"), re);
  /* negative control */
  assert.ok(!held(NON_ACTS.templates, "templates").includes("reached also through a review grant's door"));
});

/* ---- R4, R8: the consequence statements' keys --------------------------------------------------------------------- */
test("R4 R8 R21 R24 R44 (N891): every CONSEQUENCE_STATEMENTS entry is {friction, key} naming one key of words.json, no two alike; the correction path is the key screen.ceremony.permanent", () => {
  /** @type {string[]} */
  const keys = [];
  for (const [op, c] of Object.entries(CONSEQUENCE_STATEMENTS)) {
    assert.deepEqual(Object.keys(c).sort(), ["friction", "key"], op);
    assert.ok(["dialog", "in-place"].includes(c.friction), op);
    assert.match(c.key, /^(consequence|screen)\.[a-z.-]+$/, op);
    keys.push(c.key);
  }
  assert.equal(new Set(keys).size, keys.length, "no key twice");
  assert.equal(CONSEQUENCE_STATEMENTS.filingapprove.key, "consequence.filingapprove");
  assert.equal(CONSEQUENCE_STATEMENTS.actionholdrelease.key, "consequence.actionholdrelease");
  assert.equal(IRREVERSIBLE_CORRECTION_KEY, "screen.ceremony.permanent");
  /* negative control */
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "publishcheck"));
});

/* ---- R13, R17: T33's merged-table identity ------------------------------------------------------------------------ */
test("R13 R17 (N891): the merged tables carry each entry of T33's tables op for op, each stated absence the very entry object with its sentence; T34's table names groupswitchset no longer; personexpunge is no alias's op", () => {
  for (const [op, r] of Object.entries(T33_RUNGS)) assert.equal(RUNGS[op], r, op);
  for (const [op, e] of Object.entries(T33_RUNG_ABSENT)) {
    assert.equal(RUNG_ABSENT[op], e, op);
    assert.ok(typeof e.is === "string" && e.is.length > 40, op);
  }
  for (const [op, why] of Object.entries(T33_NON_ACTS)) assert.equal(NON_ACTS[op], why, op);
  assert.equal(Object.hasOwn(T34_NON_ACTS, "groupswitchset"), false);
  /** @type {readonly string[]} */
  const aliasOps = Object.values(OP_ALIASES);
  assert.equal(aliasOps.includes("personexpunge"), false);
  /* negative control: a copy, not the entry, is seen */
  const [op, e] = held(Object.entries(T33_RUNG_ABSENT)[0], "T33_RUNG_ABSENT's first entry");
  assert.notEqual({ ...e }, RUNG_ABSENT[op]);
});

/* ---- R1, R19: the justification family's exclusions --------------------------------------------------------------- */
test("R1 (N891): JUSTIFICATION_REFUSALS holds only codes that ask the member's account, the codes the requirements say join it among them, and no code that asks an object, an identifier, a choice, a form or a member", () => {
  for (const c of JUSTIFICATION_REFUSALS) assert.match(c, /^[A-Z_]+$/);
  /* the codes op-grades' own requirements say join the family (R6, R9–R11, R15, R23–R25, R28, R30, R32, R36, R38, R40) */
  const JOINED = joinedCodes(G);
  assert.ok(JOINED.length >= 20);
  for (const c of JOINED) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
  /* R1's deliberate exclusions, as a rule over a code (a refusal of an object, an identifier, a choice, a form, a member or
     a machine) rather than a list of other modules' codes (BOB K4072) */
  assert.deepEqual(JUSTIFICATION_REFUSALS.filter(asksNotTheAccount), []);
  /* negative controls: the rule sees such a code, and the family is no wider than the rule allows */
  for (const c of ["NO_TARGET", "NO_SUCH_KNOCK", "NOT_AN_ADMIN", "ENTITY_NO_LABEL"]) assert.ok(asksNotTheAccount(c), c);
  assert.ok(asksNotTheAccount("MACHINE_CANNOT_ACT_ON_CANDIDATE") && asksNotTheAccount("NOTE_TOO_LONG"));
  assert.ok([...JUSTIFICATION_REFUSALS, "NO_TARGET"].filter(asksNotTheAccount).length === 1);
});

/* ---- R2, R5: the owners' reads write nothing ----------------------------------------------------------------------- */
test("R2 R5 (N891): every read row of NON_ACTS writes nothing and takes no grade, the closing words aside — the sources', doorbell's and capture's reads, T23's, the hold reads, the docket's, the imports', the wizard library's, the template library's, publishschedule, notes, and every T33 read; the public reads take no grade", () => {
  const rows = readRows(NON_ACTS);
  assert.ok(rows.length > 250);
  /* R39 grades translationdraft caller-owned; no read has a grade: groupdescriptiondraft and securitymap are reads (K4210, K4247) */
  const GRADED = tickedAll(reqText(39));
  for (const op of rows) if (!GRADED.includes(op)) assert.ok(ungraded(op), op);
  /* the reads whose sentence ends on its closing words: they write nothing */
  const WRITES_NOTHING = rows.filter((op) => /writes nothing$/.test(held(NON_ACTS[op], op)));
  assert.ok(WRITES_NOTHING.length >= 200);
  for (const op of WRITES_NOTHING) assert.ok(readWritesNothing(op), op);
  /* the public reads, and the two grant-door reads, end otherwise (R6; DEC-85) */
  const PUBLIC = rows.filter((op) => NON_ACTS[op] === "read: public, no credential");
  assert.ok(PUBLIC.length >= 8);
  const DOOR = ticked(between(reqText(6), "`templatereview`, `templatecomment` and the reads", " add")).flatMap((op) => op !== undefined && Object.hasOwn(NON_ACTS, op) ? [op] : []);
  assert.equal(DOOR.length, 2);
  for (const op of DOOR) assert.match(held(NON_ACTS[op], op), /^read: .*; writes nothing; reached also through a review grant's door$/, op);
  /* every other read names what it reads and who may read it */
  for (const op of rows.filter((op) => !WRITES_NOTHING.includes(op) && !PUBLIC.includes(op))) assert.ok(held(NON_ACTS[op], op).length > 30, op);
  /* the reads the requirements name (R5's contradiction reads, R6–R15's) are among those that write nothing */
  const NAMED = tickedAll(["5", "6", "7", "8", "9", "10", "11", "14", "15"].map((n) => reqText(n)).join("\n"))
    .filter((op) => rows.includes(op) && !PUBLIC.includes(op));
  assert.ok(NAMED.length >= 25);
  for (const op of NAMED) { assert.ok(held(NON_ACTS[op], op).startsWith("read: "), op); assert.ok(ungraded(op), op); }
  const R5_READS = ticked(reqText(5)).filter((op) => op !== undefined && rows.includes(op));
  assert.equal(R5_READS.length, 6);
  const T33_READS = Object.entries(T33_NON_ACTS).filter(([, why]) => why.startsWith("read: ")).map(([op]) => op);
  assert.ok(T33_READS.length > 80);
  for (const op of T33_READS) { assert.match(held(NON_ACTS[op], op), /writes nothing$/, op); assert.ok(ungraded(op), op); }
  /* the stated absences whose sentences the reads stand beside: every op R2 and R6–R15 name that RUNG_ABSENT holds */
  const ABSENT_TEXT = ["2", "6", "7", "9", "10", "11", "15"].map((n) => reqText(n)).join("\n");
  const LIKENED = [...ABSENT_TEXT.matchAll(/\bas `([a-z0-9]+)`/g)].map((m) => m[1]); // "as `knock`": the comparison, not the row
  const ABSENT = tickedAll(ABSENT_TEXT).filter((op) => Object.hasOwn(RUNG_ABSENT, op) && !LIKENED.includes(op));
  assert.ok(ABSENT.length >= 28);
  for (const op of ABSENT) assert.ok(held(RUNG_ABSENT[op], op).is.length > 40, op);
  /* negative control: a read that wrote would be seen */
  assert.equal(readWritesNothing("dispose"), false);
});
