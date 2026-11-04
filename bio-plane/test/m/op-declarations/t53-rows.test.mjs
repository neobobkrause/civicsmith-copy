/* op-declarations R6, R19, R34 (T53; T53-603; BOB's ruling, 4 Nov): the three ops T53's owners serve that had no spec
   are declared in their owners' families — events' `eventwithdraw` (events R61, an open act, `usewithdraw`'s posture),
   money's `moneyfiscalyears` (money R39, R40, a read) and entities' `federaloffices` (entities R68, a read for a
   member's session) — each served by its owner's own map, and each member op among them named under an ACT_HELP_ABSENT
   ground until affordances holds its text. Negative controls beside each. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, OP_FAMILIES, OP_STAMPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { eventsOps } from "../../../src/events/index.mjs";
import { moneyOps } from "../../../src/money/index.mjs";
import { entitiesOps } from "../../../src/entities/index.mjs";
import { explained } from "./help.mjs";

const keysOf = (mapFn) => Object.keys(mapFn({}, new URL("http://plane/"), {}));
const ROWS = {
  eventwithdraw:    { family: "events",   map: eventsOps,   mutating: true,  classes: ["admin", "member", "probe"], ground: "unexplained", stamp: "by" },
  moneyfiscalyears: { family: "money",    map: moneyOps,    mutating: false, classes: ["admin", "member", "probe"], ground: "read", stamp: "viewer" },
  federaloffices:   { family: "entities", map: entitiesOps, mutating: false, classes: ["admin", "member", "probe"], machineClasses: [], ground: "read", stamp: "viewer" },
};
const groundOf = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([n]) => n);

test("T53 rows: eventwithdraw, moneyfiscalyears and federaloffices each have a spec in their owner's family, served by its map", () => {
  for (const [op, want] of Object.entries(ROWS)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.equal(OPS[op].mutating, want.mutating, `${op}: mutating`);
    assert.deepEqual([...OPS[op].classes].sort(), want.classes, `${op}: classes`);
    if (want.machineClasses) assert.deepEqual([...OPS[op].machineClasses], want.machineClasses, `${op}: machineClasses`);
    assert.equal(OPS[op].classes.includes("ai"), false, op);
    assert.ok(Object.hasOwn(OP_FAMILIES[want.family].kinds, op), `${op} is not in ${want.family}'s family`);
    assert.ok(keysOf(want.map).includes(op), `${op} is not served by ${want.family}'s map`);
    assert.ok(OP_STAMPS[op].includes(want.stamp), `${op} is not stamped ${want.stamp}`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
  }
  /* negative control: a name no owner serves has no spec */
  assert.equal(Object.hasOwn(OPS, "eventunwithdraw"), false);
});

test("T53 rows (R34): each is named under one ACT_HELP_ABSENT ground until affordances explains it, never both", () => {
  for (const [op, want] of Object.entries(ROWS)) {
    if (explained(op)) assert.deepEqual(groundOf(op), [], `${op} is explained and named`);
    else assert.deepEqual(groundOf(op), [want.ground], `${op}'s ground`);
  }
  /* negative control: an op that is neither has no ground */
  assert.deepEqual(groundOf("eventunwithdraw"), []);
});
