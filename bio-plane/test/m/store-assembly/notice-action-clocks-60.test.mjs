/* store-assembly: the provider notice action-clocks:60 (PR 60; action-clocks R27, R28, R29, T53). R28 gives
   `clockPropose` a `layer` naming which jurisdiction layer's rule is meant when two active layers give one rule name
   (else NAME_AMBIGUOUS). This module's owner map serves `clockpropose` (R86) and declares its fields (R85), so the arm
   hands `layer` on from the body or the address, and the declaration accepts it. R27 (a read of action-clocks' own) and
   R29 (its adopt and clock state, which no arm of this module calls) need nothing here. Driven with the real
   action-clocks over its published fixture and `jurisdictions`' published test forest, combined by its real code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerOps, OWNER_MAP_DECLARED_OPS } from "../../../src/store-assembly/owner-ops.mjs";
import { world, V } from "../action-clocks/fixture.mjs";
import { FOREST, forestCopy } from "../../../../jurisdictions/test/fixtures/forest.mjs";

const M = V("alice");
const A = "ACTN-2026-0001-a";
const RULE = "records_response";
const CITY_A = "forest-city-a", CITY_B = "forest-city-b";
const LAYERS = ["forest-federal", "forest-state", "forest-county-a", CITY_A, "forest-county-b", CITY_B];
/* the forest's two city-like layers both give a rule named `records_response`, as action-clocks' own R28 test makes them */
function twoLayers() {
  const ls = forestCopy(FOREST.all).filter((l) => LAYERS.includes(l.id));
  for (const l of ls) if (l.id === CITY_A || l.id === CITY_B) { l.deadlines[0].rule = RULE; l.records_laws[0].response = RULE; }
  const w = world({ profiles: LAYERS, override: Object.fromEntries(ls.map((l) => [l.id, l])) });
  w.action(A);
  assert.equal(w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-06-05", account: "sent", viewer: M, author: M }).ok, true);
  return w;
}
const propose = (w, { query = {}, body } = {}) => {
  const u = new URL("http://do/clockpropose");
  for (const [k, v] of Object.entries({ ...query, proposer: M, viewer: M })) u.searchParams.set(k, v);
  return ownerOps({ actionClocks: () => w.c }, u, body).clockpropose();
};

test("notice action-clocks:60 (R86, action-clocks R28): `clockpropose` hands the body's `layer` to clockPropose, so a rule two layers give is proposed under the layer named", () => {
  const w = twoLayers();
  const p = propose(w, { body: { target: A, rule: RULE, layer: CITY_A } });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual([p.proposal.layer, p.proposal.key], [CITY_A, `${CITY_A}:${RULE}@${M}`]);
});

test("notice action-clocks:60 (R86): the address's `layer` is handed as the body's is; a body's stamps still lose", () => {
  const w = twoLayers();
  const p = propose(w, { query: { target: A, rule: RULE, layer: CITY_B }, body: { proposer: "member:forged", viewer: "member:forged" } });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual([p.proposal.layer, p.proposal.key], [CITY_B, `${CITY_B}:${RULE}@${M}`]);
});

test("notice action-clocks:60 control: with no `layer` named the owner's own refusal NAME_AMBIGUOUS is answered as given, naming both layers, and nothing is written", () => {
  const w = twoLayers();
  const p = propose(w, { body: { target: A, rule: RULE } });
  assert.equal(p.reason, "NAME_AMBIGUOUS");
  assert.deepEqual(p.layers.map((l) => l.layer).sort(), [CITY_A, CITY_B]);
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM action_clock_proposals")[0].n, 0);
});

test("notice action-clocks:60 (R85): `clockpropose`'s declaration accepts `layer`, and still requires only `target` and `rule`", () => {
  assert.deepEqual(OWNER_MAP_DECLARED_OPS.clockpropose.fields, { accepts: ["target", "rule", "layer"], requires: ["target", "rule"] });
});
