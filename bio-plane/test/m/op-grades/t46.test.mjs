/* op-grades: T46's grades (R33) and `handlechange`'s sentences as the refusal it now is (R34), at the module's exports.
   Every op T46 adds, graded by R5 and R3, each op named here with the grade read from its owner's requirements and a
   negative control (K874). `op-declarations` merges after this module in layer 11, so the totality is held here over a
   stand-in of the rows it declares (its R50, R51), by `affordances` R12's rule; the real totality runs again at its
   merge. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import * as T46 from "../../../src/op-grades/t46.mjs";
import { declaredSentence } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;
const isRead = (op) => typeof NON_ACTS[op] === "string" && NON_ACTS[op].startsWith("read: ")
  && /writes nothing$/.test(NON_ACTS[op]) && NON_ACTS[op].length > 30;
const isDraft = (op) => typeof NON_ACTS[op] === "string" && NON_ACTS[op].startsWith("draft: ")
  && /writes nothing of the record/.test(NON_ACTS[op]);

/* R33's writes, op by op, each read from its owner */
const R33_WRITES = { infolevelset: "caller-owned", escalationstoppursuing: "reasoned", escalationreopen: "reasoned",
  airundispatch: "undetermined" };
const R33_READS = ["infolevel", "joindoors", "clockproposals"];
const R33_DRAFTS = ["statusreportassist", "textcheck"];
/* the acts affordances R52 (amending R51) makes ACTS rows on an action target */
const R33_ACTS = ["escalationstoppursuing", "escalationreopen"];
const ALL = [...Object.keys(R33_WRITES), ...R33_READS, ...R33_DRAFTS];

test("R33: infolevelset `caller-owned` as memberlanguageset, with its personal-state sentence; infolevel a read of the "
   + "viewer's own level", () => {
  assert.equal(gradeOf("infolevelset"), "caller-owned");
  assert.equal(gradeOf("infolevelset"), gradeOf("memberlanguageset"), "as memberlanguageset");
  assert.ok(!Object.hasOwn(RUNGS, "infolevelset"));
  assert.match(RUNG_ABSENT.infolevelset.is, /\(instance-setup R79\)$/);
  assert.equal(NON_ACTS.infolevelset, declaredSentence("instance-setup", "infolevelset"));
  assert.ok(isRead("infolevel"));
  assert.equal(gradeOf("infolevel"), null, "a read takes no grade");
  /* negative controls: another ground, or the read graded, would be seen */
  assert.notEqual(gradeOf("infolevelset"), "credential");
  assert.ok(!isRead("infolevelset"));
});

test("R33: statusreportassist writes nothing and takes no rung; its sentence a draft, as statusreportdraft's, naming the "
   + "sourced items, the plane's draft door and that the report kept is the member's", () => {
  assert.equal(gradeOf("statusreportassist"), null);
  assert.ok(isDraft("statusreportassist"));
  assert.ok(NON_ACTS.statusreportdraft.startsWith("draft: "), "as statusreportdraft's");
  for (const re of [/the items, each with its source/, /a plan's status report/, /through the plane's draft door/,
    /the report kept is the member's$/]) assert.match(NON_ACTS.statusreportassist, re);
  assert.notEqual(NON_ACTS.statusreportassist, NON_ACTS.statusreportdraft, "apart from statusreportdraft");
  /* negative control */
  assert.ok(!isRead("statusreportassist"));
});

test("R33: escalationstoppursuing and escalationreopen `reasoned`, backed by ESCALATION_NO_REASON already in the family; "
   + "ACTS rows (affordances R52), so no NON_ACTS row, and MACHINE_REFUSALS gains both with MACHINE_CANNOT_STOP", () => {
  for (const op of R33_ACTS) {
    assert.equal(RUNGS[op], "reasoned", op);
    assert.ok(!Object.hasOwn(RUNG_ABSENT, op), op);
    assert.ok(!Object.hasOwn(NON_ACTS, op), `${op} is an act, never a non-act too`);
    assert.equal(MACHINE_REFUSALS[op], "MACHINE_CANNOT_STOP", op);
    assert.equal(phoneOf(op), true, `${op}: phone follows the rung`);
  }
  assert.equal(JUSTIFICATION_REFUSALS.filter((c) => c === "ESCALATION_NO_REASON").length, 1, "already in the family, once");
  assert.equal(gradeOf("escalationstoppursuing"), gradeOf("escalationsuspend"), "as escalation's other reasoned acts");
  /* negative controls: the code demanded of a non-stopped escalation is no reason; escalationend stays terminal */
  for (const c of ["NOT_STOPPED", "NOT_OPEN", "MACHINE_CANNOT_STOP"]) assert.ok(!JUSTIFICATION_REFUSALS.includes(c), c);
  assert.equal(RUNGS.escalationend, "terminal");
});

test("R33: the member-run door's op, airundispatch, stated absent `undetermined` on R3's rule, run-directed, not a machine "
   + "refusal, a phone act", () => {
  assert.equal(gradeOf("airundispatch"), "undetermined");
  assert.ok(!Object.hasOwn(RUNGS, "airundispatch"));
  assert.match(RUNG_ABSENT.airundispatch.is, /\(ai-runs R18\)$/);
  assert.equal(NON_ACTS.airundispatch, "run-directed: keyed by a run the caller opened on her own sign-in; starts its next "
    + "segment for her only; moves no bundle");
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "airundispatch"));
  assert.equal(phoneOf("airundispatch"), true);
  /* negative controls */
  assert.notEqual(gradeOf("airundispatch"), "credential");
  assert.ok(!NON_ACTS.airundispatch.startsWith("capture-directed:"));
});

test("R33: joindoors and clockproposals are reads, each `read: …` writing nothing and ungraded: an administrator's, never "
   + "a door's secret; the standing proposals clockadopt adopts", () => {
  for (const op of ["joindoors", "clockproposals"]) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  assert.match(NON_ACTS.joindoors, /to an administrator, never a door's secret/);
  assert.match(NON_ACTS.clockproposals, /standing clock proposals on an action the viewer may see, which clockadopt adopts/);
  /* negative control: the act it names stays graded */
  assert.equal(gradeOf("clockadopt"), "undetermined");
});

test("R33: textcheck writes nothing and takes no rung; its sentence a draft naming the four readings, a labeled proposal "
   + "for the member, never rewriting the text", () => {
  assert.equal(gradeOf("textcheck"), null);
  assert.ok(isDraft("textcheck"));
  for (const re of [/sentences of a prepared outward text/, /an assertion, a position, an own-benefit ask or a staff member named/,
    /labeled proposal for the member/, /never rewrites the text/]) assert.match(NON_ACTS.textcheck, re);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "textcheck"));
  /* negative control */
  assert.ok(!isRead("textcheck"));
});

test("R33 R5 R18 R21 R4: of T46's ops MACHINE_REFUSALS holds exactly the two escalation acts; every one is a phone act; "
   + "no consequence statement (escalationstoppursuing's is owed by the design stream, K2960), Irreversible weight, "
   + "larger-screen entry or alias is added", () => {
  assert.deepEqual(ALL.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)).sort(), [...R33_ACTS].sort());
  assert.deepEqual(ALL.filter((op) => !phoneOf(op)), []);
  for (const op of ALL) {
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), op);
    assert.ok(!(NON_ACTS[op] ?? "").startsWith("capture-directed:"), op);
  }
  /* negative control: a credential ground is off the phone */
  assert.equal(phoneOf("keyedserviceset"), false);
});

test("R33: T46's tables hold exactly these ops, the module's tables carrying those very entries; none both graded and "
   + "stated absent", () => {
  assert.deepEqual(Object.keys(T46).sort(), ["T46_NON_ACTS", "T46_RUNGS", "T46_RUNG_ABSENT"]);
  assert.deepEqual([...Object.keys(T46.T46_RUNGS), ...Object.keys(T46.T46_RUNG_ABSENT)].sort(),
    Object.keys(R33_WRITES).sort());
  assert.deepEqual(Object.keys(T46.T46_NON_ACTS).sort(), ALL.filter((op) => !R33_ACTS.includes(op)).sort());
  for (const [op, v] of Object.entries(T46.T46_RUNGS)) assert.equal(RUNGS[op], v, op);
  for (const [op, e] of Object.entries(T46.T46_RUNG_ABSENT)) {
    assert.equal(RUNG_ABSENT[op], e, op);
    assert.ok(e.is.length > 60, op);
  }
  for (const [op, w] of Object.entries(T46.T46_NON_ACTS)) assert.equal(NON_ACTS[op], w, op);
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
});

/* `unaccounted`'s two totalities over a stand-in of op-declarations R50's and R51's rows (t45.test.mjs' shape): each write
   mutating, each read and draft not, every op gated by a NEEDS row; the two escalation acts are ACTS rows */
const STAND_IN = [...Object.keys(R33_WRITES).map((op) => ({ op, mutating: true, gated: true })),
  ...[...R33_READS, ...R33_DRAFTS].map((op) => ({ op, mutating: false, gated: true }))];
const unaccountedOver = (rows, acts = R33_ACTS) => {
  const mutating = new Set(rows.filter((r) => r.mutating).map((r) => r.op));
  const gated = new Set(rows.filter((r) => r.gated).map((r) => r.op));
  return {
    unpublished: [...gated].filter((op) => !Object.hasOwn(NON_ACTS, op) && !acts.includes(op)).sort(),
    unranked: [...mutating].filter((op) => !Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op)).sort(),
    stale: rows.map((r) => r.op).filter((op) => !mutating.has(op) && (Object.hasOwn(RUNGS, op)
      || Object.hasOwn(RUNG_ABSENT, op)) || !gated.has(op) && Object.hasOwn(NON_ACTS, op)).sort(),
  };
};
test("R33: affordances R12's totality holds over a stand-in of op-declarations R50's and R51's rows — none unpublished, "
   + "unranked or stale", () => {
  assert.deepEqual(unaccountedOver(STAND_IN), { unpublished: [], unranked: [], stale: [] });
  /* negative controls: without affordances' ACTS rows (T46-45) the escalation acts read unpublished; an ungraded new op
     is unranked; a draft carried as a write is unranked, a write carried as a read stale */
  assert.deepEqual(unaccountedOver(STAND_IN, []).unpublished, [...R33_ACTS].sort());
  assert.deepEqual(unaccountedOver([...STAND_IN, { op: "infolevelnew", mutating: true, gated: true }]).unranked,
    ["infolevelnew"]);
  assert.deepEqual(unaccountedOver(STAND_IN.map((r) => r.op === "textcheck" ? { ...r, mutating: true } : r)).unranked,
    ["textcheck"]);
  assert.deepEqual(unaccountedOver(STAND_IN.map((r) => r.op === "infolevelset" ? { ...r, mutating: false } : r)).stale,
    ["infolevelset"]);
});

test("R33 (K2998): clockadopt is an ACTS row on an action (affordances R52) — it leaves NON_ACTS, MACHINE_REFUSALS gains "
   + "it with MACHINE_CANNOT_ADOPT_CLOCK, and its `undetermined` absence stands", () => {
  assert.ok(!Object.hasOwn(NON_ACTS, "clockadopt"), "an act, never a non-act too");
  assert.equal(MACHINE_REFUSALS.clockadopt, "MACHINE_CANNOT_ADOPT_CLOCK");
  assert.equal(RUNG_ABSENT.clockadopt.ground, "undetermined");
  assert.ok(!Object.hasOwn(RUNGS, "clockadopt"));
  assert.equal(phoneOf("clockadopt"), true);
  /* negative controls: its proposal (clockpropose) stays a non-act with no machine refusal; the read beside it too */
  for (const op of ["clockpropose", "clockproposals"]) {
    assert.ok(Object.hasOwn(NON_ACTS, op), op);
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), op);
  }
});

/* ---- R34 ----------------------------------------------------------------------------------------------------------- */
test("R34: handlechange stays where R29 puts it (`caller-owned`, no rung, phone true) and its sentences state the refusal "
   + "it now is — NON_ACTS word for word, its absence naming membership R129 and never R124; neither says a handle is "
   + "changeable or shown as formerly; handlecheck unchanged", () => {
  assert.equal(gradeOf("handlechange"), "caller-owned");
  assert.ok(!Object.hasOwn(RUNGS, "handlechange"));
  assert.equal(phoneOf("handlechange"), true);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "handlechange"));
  assert.equal(NON_ACTS.handlechange, "member-directed: a handle is fixed at joining; this act refuses every change, "
    + "`HANDLE_FIXED`, and writes nothing");
  const is = RUNG_ABSENT.handlechange.is;
  assert.match(is, /membership R129/);
  assert.doesNotMatch(is, /R124/);
  for (const s of [NON_ACTS.handlechange, is]) {
    assert.doesNotMatch(s, /changeable/, s);
    assert.doesNotMatch(s, /formerly/, s);
    assert.match(s, /HANDLE_FIXED/, s);
  }
  assert.equal(NON_ACTS.handlecheck, declaredSentence("member-roster", "handlecheck"));
  /* negative control: R29's earlier sentence would be seen */
  const old = "member-directed: the caller's own handle, changeable until their work is first in a published case; "
    + "earlier handles kept and shown as formerly; moves no bundle";
  assert.notEqual(NON_ACTS.handlechange, old);
  assert.match(old, /changeable/);
});
