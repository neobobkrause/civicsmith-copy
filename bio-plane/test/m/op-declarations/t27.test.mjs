/* op-declarations R12 and R13: the specs of T27's ops — the litigation hold's release and its two reads (N518; DEC-113,
   K1134 (3); actions R56–R58) and the docket's ops and public reads (N520; DEC-116, DEC-100; docket R1–R8, R12, R14,
   R15; public-read R21) — each compared whole with the stamps its lists name, both session sets and its NEEDS row, in
   the form of R10's tests in `t23.test.mjs`. Each comparison has a negative control: a drifted table is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE } = O;
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsHolding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
const plain = (spec) => ({ ...spec, ...(Array.isArray(spec.classes) ? { classes: [...spec.classes] } : {}),
                           ...(Array.isArray(spec.machineClasses) ? { machineClasses: [...spec.machineClasses] } : {}) });
const MEMBER_PROBE = ["admin", "member", "probe"];
const SESSION_ONLY = { classes: ["admin", "member"], machineClasses: [], mutating: false };
const PUBLIC = { classes: null, mutating: false };

/* The stamps each list confers at the door (control-plane reads the lists): `author`, the positional identity, for
   `QUERY_AUTHOR_ACTIONS`; `viewer` for the action layer's acts and reads and the docket's acts and reads; `author` for
   the two docket acts any member performs and `by` for the three the manager performs. A public read's list stamps
   nothing. */
const STAMPS = { QUERY_AUTHOR_ACTIONS: ["author"], ACTION_LAYER_ACTIONS: ["viewer"], ACTION_LAYER_READS: ["viewer"],
                 DOCKET_ACTIONS: ["viewer"], DOCKET_READS: ["viewer"], DOCKET_AUTHOR: ["author"], DOCKET_BY: ["by"],
                 DOCKET_PUBLIC_READS: [] };
const stampsOf = (op, lists = listsHolding(op)) => [...new Set(lists.flatMap((l) => STAMPS[l] ?? []))].sort();

/* R12's ops as it lists them: the spec, the op it is declared as (`like`), the lists that name it, its stamps and its
   NEEDS row (affordances R33 names the two reads, so each carries a present null). */
const R12 = {
  actionholdrelease: { spec: { classes: MEMBER_PROBE, mutating: true }, like: "actionhold", needs: "contribute",
                       lists: ["ACTION_HOLDS_ACTIONS", "ACTION_LAYER_ACTIONS", "QUERY_AUTHOR_ACTIONS"], stamps: ["author", "viewer"] },
  actionholdpreview: { spec: { classes: MEMBER_PROBE, mutating: false }, needs: null,
                       lists: ["ACTION_HOLDS_READS", "ACTION_LAYER_READS"], stamps: ["viewer"] },
  projectholds:      { spec: { classes: MEMBER_PROBE, mutating: false }, needs: null,
                       lists: ["ACTION_HOLDS_READS", "ACTION_LAYER_READS"], stamps: ["viewer"] },
};
/* R13's ops as it lists them. Every member op is a member session's only, `knocksof`'s fence; the reads and the public
   reads carry a present null NEEDS row (affordances R34 names each in NON_ACTS). */
const R13 = {
  docketfile:       { spec: { ...SESSION_ONLY, mutating: true }, like: "noticepost", needs: "contribute",
                      lists: ["DOCKET_ACTIONS", "DOCKET_AUTHOR"], stamps: ["author", "viewer"] },
  docketpressure:   { spec: { ...SESSION_ONLY, mutating: true }, like: "noticepost", needs: "contribute",
                      lists: ["DOCKET_ACTIONS", "DOCKET_AUTHOR"], stamps: ["author", "viewer"] },
  docketdecline:    { spec: { ...SESSION_ONLY, mutating: true }, like: "noticepost", needs: "contribute",
                      lists: ["DOCKET_ACTIONS", "DOCKET_BY"], stamps: ["by", "viewer"] },
  docketpost:       { spec: { ...SESSION_ONLY, mutating: true }, like: "noticepost", needs: "contribute",
                      lists: ["DOCKET_ACTIONS", "DOCKET_BY"], stamps: ["by", "viewer"] },
  docket:           { spec: SESSION_ONLY, like: "notices", needs: null, lists: ["DOCKET_READS"], stamps: ["viewer"] },
  docketprepare:    { spec: SESSION_ONLY, like: "noticeprepare", needs: null, lists: ["DOCKET_BY", "DOCKET_READS"],
                      stamps: ["by", "viewer"] },
  docketinvitation: { spec: SESSION_ONLY, like: "notices", needs: null, lists: ["DOCKET_READS"], stamps: ["viewer"] },
  docketpublic:     { spec: PUBLIC, like: "publishedcase", needs: null, lists: ["DOCKET_PUBLIC_READS"], stamps: [] },
  docketfeed:       { spec: PUBLIC, like: "publishedcase", needs: null, lists: ["DOCKET_PUBLIC_READS"], stamps: [] },
};
const ALL = { ...R12, ...R13 };
const PUBLIC_OPS = Object.keys(ALL).filter((op) => ALL[op].spec.classes === null);
const SESSION_REACHED = Object.keys(ALL).filter((op) => ALL[op].spec.classes !== null);
const admitsBearer = (op, cls) => Array.isArray(OPS[op].classes)
  && (Array.isArray(OPS[op].machineClasses) ? OPS[op].machineClasses : OPS[op].classes).includes(cls);

test("R12, R2: OPS holds a spec for each op N518 adds — actionholdrelease mutating as actionhold (admin, member, probe), actionholdpreview and projectholds reads (admin, member, probe) — none naming ai or carrying machineClasses (negative control: a drifted spec is seen)", () => {
  assert.equal(Object.keys(R12).length, 3);
  for (const op of Object.keys(R12)) {
    const want = R12[op];
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(OPS[op]), want.spec, op);
    if (want.like) assert.deepEqual(plain(OPS[op]), plain(OPS[want.like]), `${op} as ${want.like}`);
    assert.ok(!("machineClasses" in OPS[op]), op);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  }
  /* A machine reaches the release and actions refuses it by name, actionhold's posture: probe is admitted. */
  assert.equal(admitsBearer("actionholdrelease", "probe"), true);
  assert.notDeepEqual(plain({ ...OPS.actionholdrelease, mutating: false }), R12.actionholdrelease.spec);
  assert.notDeepEqual(plain({ ...OPS.projectholds, mutating: true }), R12.projectholds.spec);
  assert.notDeepEqual(plain({ ...OPS.actionholdpreview, machineClasses: [] }), R12.actionholdpreview.spec);
});

test("R12, R3: each of N518's ops is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session); NEEDS is contribute for actionholdrelease and a present null for actionholdpreview and projectholds, as optionstartpreview's; none is unattended (negative control: an op with no row reads as needing nothing)", () => {
  for (const [op, want] of Object.entries(R12)) {
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
    assert.equal(NEEDS[op], want.needs, op);
    assert.equal(ACT_GATE.needs(op), want.needs, op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
  assert.equal(NEEDS.actionholdrelease, NEEDS.actionhold);
  assert.equal(NEEDS.optionstartpreview, null);
  assert.ok(Object.hasOwn(NEEDS, "optionstartpreview"));
  assert.equal(Object.hasOwn(NEEDS, "action"), false);
});

test("R12, R4, R49: the act lists name N518's stamps — actionholdrelease beside actionhold, since T45 in action-holds' ACTION_HOLDS_ACTIONS (the hold moved with its owner), so author (query-stamped) and viewer; actionholdpreview and projectholds in ACTION_HOLDS_READS, so viewer (negative control: out of QUERY_AUTHOR_ACTIONS the release would lose author)", () => {
  for (const [op, want] of Object.entries(R12)) {
    assert.deepEqual(listsHolding(op), [...want.lists].sort(), op);
    assert.deepEqual(stampsOf(op), want.stamps, op);
  }
  assert.deepEqual(listsHolding("actionholdrelease"), listsHolding("actionhold"));
  assert.deepEqual([...O.ACTION_HOLDS_ACTIONS], ["actionpressure", "actionhold", "actionholdrelease"]);
  assert.deepEqual([...O.ACTION_HOLDS_READS], ["actionholdpreview", "projectholds"]);
  for (const op of [...O.ACTION_HOLDS_ACTIONS, ...O.ACTION_HOLDS_READS])
    assert.ok(!O.ACTIONS_ACTIONS.includes(op) && !O.ACTIONS_READS.includes(op), op);
  for (const op of Object.keys(R12)) assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
  assert.deepEqual(stampsOf("actionholdrelease", listsHolding("actionholdrelease").filter((l) => l !== "QUERY_AUTHOR_ACTIONS")),
                   ["viewer"]);
});

test("R13, R2: OPS holds a spec for each op docket adds — docketfile, docketpressure, docketdecline and docketpost mutating, docket, docketprepare and docketinvitation reads, each admin and member with machineClasses []; docketpublic and docketfeed classes null, not mutating — none naming ai (negative control: a drifted spec is seen)", () => {
  assert.equal(Object.keys(R13).length, 9);
  for (const [op, want] of Object.entries(R13)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(OPS[op]), want.spec, op);
    assert.deepEqual(plain(OPS[op]), plain(OPS[want.like]), `${op} as ${want.like}`);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  }
  assert.notDeepEqual(plain({ ...OPS.docketpost, machineClasses: ["admin"] }), R13.docketpost.spec);
  assert.notDeepEqual(plain({ ...OPS.docketprepare, mutating: true }), R13.docketprepare.spec);
  assert.notDeepEqual(plain({ ...OPS.docketfeed, classes: ["admin"] }), R13.docketfeed.spec);
});

test("R13, R2: no machine class, agent credential or operator token reaches a docket member op — machineClasses [] on each, so every bearer (admin, member, probe, daemon) is refused and only a session's kind is admitted", () => {
  const member = Object.keys(R13).filter((op) => OPS[op].classes !== null);
  assert.equal(member.length, 7);
  for (const op of member) {
    assert.deepEqual([...OPS[op].machineClasses], [], op);
    for (const cls of ["admin", "member", "probe", "daemon"]) assert.equal(admitsBearer(op, cls), false, `${op}: ${cls}`);
    /* An agent credential is admitted only to an op a member reaches with no machineClasses (R2): not these. */
    assert.ok("machineClasses" in OPS[op], op);
  }
  /* Negative control: an op without the fence admits a bearer. */
  assert.equal(admitsBearer("actionholdrelease", "admin"), true);
});

test("R13, R3: each docket member op is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session), the public reads in neither (machine); NEEDS is contribute exactly for the four mutating ops and a present null for the five reads; none is unattended", () => {
  for (const op of SESSION_REACHED) {
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
  }
  for (const op of PUBLIC_OPS) {
    assert.ok(!SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op), `${op} is in a session set`);
    assert.equal(ACT_GATE.mode(op), "machine", op);
  }
  assert.deepEqual(PUBLIC_OPS.sort(), ["docketfeed", "docketpublic"]);
  for (const [op, want] of Object.entries(R13)) {
    assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
    assert.equal(NEEDS[op], want.needs, op);
    assert.equal(ACT_GATE.needs(op), want.needs, op);
    /* contribute exactly for every mutating op a member's session reaches */
    assert.equal(NEEDS[op] === "contribute", OPS[op].mutating && SESSION_OPS.member.has(op), op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
});

test("R13, R4: the act lists name each docket op's stamps — author and viewer for docketfile and docketpressure; by and viewer for docketprepare, docketpost and docketdecline; viewer for docket and docketinvitation; nothing for the public reads", () => {
  for (const [op, want] of Object.entries(R13)) {
    assert.deepEqual(listsHolding(op), [...want.lists].sort(), op);
    assert.deepEqual(stampsOf(op), want.stamps, op);
  }
  assert.deepEqual([...O.DOCKET_ACTIONS], ["docketfile", "docketpressure", "docketdecline", "docketpost"]);
  assert.deepEqual([...O.DOCKET_READS], ["docket", "docketprepare", "docketinvitation"]);
  assert.deepEqual([...O.DOCKET_AUTHOR], ["docketfile", "docketpressure"]);
  assert.deepEqual([...O.DOCKET_BY], ["docketprepare", "docketdecline", "docketpost"]);
  assert.deepEqual([...O.DOCKET_PUBLIC_READS], ["docketpublic", "docketfeed"]);
  /* The docket's ops are in no other module's list: no action-layer author or viewer stamp, no plan-run scope. */
  for (const op of Object.keys(R13)) {
    assert.ok(listsHolding(op).every((l) => l.startsWith("DOCKET_")), op);
    assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
  }
  /* Negative control: an op in no list is stamped nothing; a stamped op moved out of its list loses its stamp. */
  assert.deepEqual(stampsOf("nosuchop"), []);
  assert.deepEqual(stampsOf("docketpost", ["DOCKET_ACTIONS"]), ["viewer"]);
});

test("R12, R13, R6: every op T27's modules serve has a spec the door answers by name — actions' three (R56–R58), docket's seven member ops (its map) and its two public reads (public-read R21) — and the tables name each one: OPS, NEEDS, an act list and, for a session's op, both session sets", () => {
  /* The names each owner serves: actions' map (actions R56–R58), docket's map (`docketOps`, docket R1–R8) and
     public-read's two docket reads (its R21). */
  const SERVED = ["actionholdrelease", "actionholdpreview", "projectholds", "docketfile", "docketpressure", "docket",
                  "docketprepare", "docketpost", "docketdecline", "docketinvitation", "docketpublic", "docketfeed"];
  assert.deepEqual([...SERVED].sort(), Object.keys(ALL).sort());
  for (const op of SERVED) {
    assert.match(op, /^[a-z]+$/, op);
    assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(NEEDS, op), `${op}: no spec or NEEDS row`);
    assert.ok(listsHolding(op).length > 0, `${op} is in no act list`);
    assert.equal(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), OPS[op].classes !== null, op);
  }
  /* A name docket does not serve is no op (negative control). */
  for (const op of ["docketwithdraw", "docketsigners", "coredue"]) assert.ok(!Object.hasOwn(OPS, op), op);
});
