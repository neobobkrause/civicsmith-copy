/* op-declarations R11: the spec of T24's op (N490, DEC-115, K1134), action-plans' `optionstartpreview` (its R37), compared
   whole with the stamps its lists name, both session sets and its NEEDS row, in the form of R10's tests in
   `t23.test.mjs`. Each comparison has a negative control: a drifted table is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE } = O;
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsHolding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
const plain = (spec) => ({ ...spec, ...(Array.isArray(spec.classes) ? { classes: [...spec.classes] } : {}),
                           ...(Array.isArray(spec.machineClasses) ? { machineClasses: [...spec.machineClasses] } : {}) });
const OP = "optionstartpreview";
const SPEC = { classes: ["admin", "member", "probe"], mutating: false };
/* The stamps each list confers at the door (control-plane reads the lists): `author`, the positional identity, for
   `QUERY_AUTHOR_ACTIONS`; `viewer` for the action layer's acts and reads. */
const STAMPS = { QUERY_AUTHOR_ACTIONS: ["author"], ACTION_LAYER_ACTIONS: ["viewer"], ACTION_LAYER_READS: ["viewer"] };
const stampsOf = (op, lists = listsHolding(op)) => [...new Set(lists.flatMap((l) => STAMPS[l] ?? []))].sort();

test("R11, R2: OPS holds a spec for optionstartpreview — a read (not mutating), classes admin, member and probe, no machineClasses, optionstart's classes — naming no ai (negative control: a mutating or fenced spec is seen)", () => {
  assert.ok(Object.hasOwn(OPS, OP), "no spec");
  assert.deepEqual(plain(OPS[OP]), SPEC);
  assert.deepEqual([...OPS[OP].classes], [...OPS.optionstart.classes]);
  assert.equal(OPS.optionstart.mutating, true);
  assert.ok(!("machineClasses" in OPS[OP]));
  assert.ok(!JSON.stringify(OPS[OP]).includes('"ai"'));
  assert.notDeepEqual(plain({ ...OPS[OP], mutating: true }), SPEC);
  assert.notDeepEqual(plain({ ...OPS[OP], machineClasses: [] }), SPEC);
  assert.notDeepEqual(plain({ ...OPS[OP], classes: ["admin", "member"] }), SPEC);
});

test("R11, R3: optionstartpreview is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session), with a present null NEEDS row (a read needs no capability; affordances names it in NON_ACTS), and is not unattended (negative control: optionstart, which it previews, needs contribute)", () => {
  assert.ok(SESSION_OPS.member.has(OP), "not in the member session set");
  assert.ok(SESSION_OPS.admin.has(OP), "not in the founder's session set");
  assert.equal(ACT_GATE.mode(OP), "session");
  assert.ok(Object.hasOwn(NEEDS, OP), "no NEEDS row");
  assert.equal(NEEDS[OP], null);
  assert.equal(ACT_GATE.needs(OP), null);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, OP));
  assert.equal(ACT_GATE.needs("optionstart"), "contribute");
  assert.equal(ACT_GATE.mode("nosuchpreview"), "machine");
});

test("R11, R4: the act lists name optionstartpreview's stamps — author (query-stamped, the start's own expression) and viewer — through ACTION_PLANS_PREVIEWS, QUERY_AUTHOR_ACTIONS and ACTION_LAYER_ACTIONS, as optionstart is stamped; it is no act of ACTION_PLANS_ACTIONS and no read of ACTION_PLANS_READS (negative control: out of QUERY_AUTHOR_ACTIONS it would lose author)", () => {
  assert.deepEqual(listsHolding(OP), ["ACTION_LAYER_ACTIONS", "ACTION_PLANS_PREVIEWS", "QUERY_AUTHOR_ACTIONS"]);
  assert.deepEqual(stampsOf(OP), ["author", "viewer"]);
  assert.deepEqual(stampsOf(OP), stampsOf("optionstart"));
  assert.deepEqual([...O.ACTION_PLANS_PREVIEWS], [OP]);
  assert.ok(!O.ACTION_PLANS_ACTIONS.includes(OP) && !O.ACTION_PLANS_READS.includes(OP));
  /* No proposal's label stamp, and not in a planning run's scope: a preview is a member's look before an act. */
  assert.ok(!O.PLAN_PROPOSAL_ACTIONS.includes(OP));
  assert.ok(!PLAN_RUN_SCOPE.reads.includes(OP) && !PLAN_RUN_SCOPE.writes.includes(OP));
  assert.deepEqual(stampsOf(OP, listsHolding(OP).filter((l) => l !== "QUERY_AUTHOR_ACTIONS")), ["viewer"]);
});

test("R11, R6: optionstartpreview, the op action-plans R37 adds, has a spec and every table names it — OPS, NEEDS, both session sets and an act list — and it is a name the door answers", () => {
  assert.match(OP, /^[a-z]+$/);
  assert.ok(Object.hasOwn(OPS, OP) && Object.hasOwn(NEEDS, OP) && SESSION_OPS.member.has(OP) && SESSION_OPS.admin.has(OP));
  assert.ok(listsHolding(OP).length > 0);
});
