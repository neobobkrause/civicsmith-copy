/* Notice membership:77 (membership R154, PR 77): membership's delegates answer what `member-roster` answers. answers reads
   three of them, `isAdministrator` (R13's tallies, the rule services' and the standing AI half's switches), `inSight`
   (R2's hidden-project scrub) and `listenerRefusal` (R27's `onStandingSet`, the standing answerer). PR 77 added tests and
   struck R154's mark; it changed no code that answers calls. Confirmed here: what answers decides from each matches what
   member-roster answers over the same store, so nothing in answers needs to change. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, V } from "./fixture.mjs";
import { listenerRefusal as rosterRefusal } from "../../../src/member-roster/index.mjs";
import { listenerRefusal as membershipRefusal } from "../../../src/membership/index.mjs";

const BOB = V("bob"), CAROL = V("carol"), ALICE = V("alice");

test("notice membership:77 answers' administrator checks follow membership's isAdministrator delegate, which answers as member-roster does", () => {
  const w = answersWorld();
  const roster = w.membership.members;
  for (const id of ["alice", "bob", "carol", "nobody"])
    assert.equal(w.membership.isAdministrator(id), roster.isAdministrator(id), id);
  /* alice (an administrator) reads the tallies and switches; bob and carol are refused NOT_AN_ADMIN */
  assert.equal(w.a.tallies({ viewer: ALICE, from: "2026-01-01", to: "2026-12-31" }).ok, true);
  for (const v of [BOB, CAROL]) {
    assert.equal(w.a.tallies({ viewer: v, from: "2026-01-01", to: "2026-12-31" }).reason, "NOT_AN_ADMIN");
    assert.equal(w.a.standingAiSwitch({ on: true, by: v }).reason, "NOT_AN_ADMIN");
  }
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
});

test("notice membership:77 answers' listener refusals are membership's listenerRefusal, member-roster's own function and rows", () => {
  const w = answersWorld();
  assert.equal(w.a.onStandingSet("scheduler", () => {}).ok, true);
  const second = w.a.onStandingSet("scheduler", () => {});
  assert.equal(second.reason ?? second.code, "LISTENER_DECLARED");
  const malformed = w.a.onStandingSet("other", "not a function");
  assert.equal(malformed.reason ?? malformed.code, "LISTENER_MALFORMED");
  /* membership re-exports member-roster's own listenerRefusal (R154), so the row is the one member-roster mints */
  assert.equal(membershipRefusal, rosterRefusal);
  const row = (r) => [r.ok, r.code, r.check, r.translation];
  assert.deepEqual(row(second), row(rosterRefusal(new Map([["scheduler", () => {}]]), "scheduler", () => {})));
  assert.deepEqual(row(malformed), row(rosterRefusal(new Map(), "other", "not a function")));
});

test("notice membership:77 R2's scrub follows membership's inSight delegate: a hidden project's row is dropped for a non-participant and kept for its participant", () => {
  const w = answersWorld();
  const P = w.project("Carol's work", "carol");
  const roster = w.membership.members;
  for (const v of [BOB, CAROL]) if (typeof roster.inSight === "function")
    assert.equal(w.membership.inSight(P, v), roster.inSight(P, v), v);
  const read = (grant, viewer) => w.a.logRead({ grant, viewer, op: "search", args: {}, answer: { ok: true, hits: [{ bundle_id: P }] } });
  assert.deepEqual(read("g-carol", CAROL).hits, [{ bundle_id: P }]);
  assert.deepEqual(read("g-bob", BOB).hits, []);
});
