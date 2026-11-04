/* Provider notice member-roster:286 (PR 286): `member-roster`'s module order (R61, its `MODULE_IDS`) gained a module,
   `reader-contract`, between `calibration` and `reading-pipeline`. membership re-exports that order (R154) and asks its
   registered reach readers (R150) and left-listeners (R158) in it, reading it live, so the new module ranks where the
   provider puts it with no change here. These tests hold that: membership's order is the provider's own, and a reader or
   listener registered under the new module's id is asked in the provider's order, never after an unlisted one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_ORDER } from "../../../src/membership/index.mjs";
import { MODULE_ORDER as ROSTER_ORDER } from "../../../src/member-roster/index.mjs";
import { MODULE_IDS } from "../../../src/member-roster/order.mjs";
import { world, V } from "./fixture.mjs";

const NEW_ID = "reader-contract";

test("member-roster:286 R154: membership's MODULE_ORDER is member-roster's own, holding every listed module, the new one included", () => {
  assert.equal(MODULE_ORDER, ROSTER_ORDER);
  for (const id of MODULE_IDS) assert.ok(MODULE_ORDER.includes(id), id);
  assert.ok(MODULE_ORDER.includes(NEW_ID));
});

/* The new module's neighbours in the provider's order, read from it, never hand-listed. */
function around(id) {
  const i = MODULE_ORDER.indexOf(id);
  assert.ok(i > 0 && i < MODULE_ORDER.length - 1, `${id} listed with a module either side`);
  return [MODULE_ORDER[i - 1], id, MODULE_ORDER[i + 1]];
}

async function projectWorld() {
  const w = await world().group("ann", "bob");
  w.project("PROJ-P", "The P project");
  w.m.projectClaimOwner({ projectId: "PROJ-P", memberId: "ann" });
  w.m.projectInvite({ projectId: "PROJ-P", handle: "bob", by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-P", by: "bob", viewer: V("bob") });
  return w;
}

test("member-roster:286 R150: reach readers registered under the new module and its neighbours, in reverse, are asked in the provider's order", async () => {
  const w = await projectWorld();
  const order = around(NEW_ID);
  const asked = [];
  assert.equal(w.m.registerProjectReach("not-a-listed-module", () => { asked.push("unlisted"); return []; }).ok, true);
  for (const m of [...order].reverse())
    assert.equal(w.m.registerProjectReach(m, () => { asked.push(m); return [`B-${m}`]; }).ok, true);
  assert.deepEqual(w.m.projectReach("PROJ-P"), order.map((m) => `B-${m}`));
  assert.deepEqual(asked, [...order, "unlisted"]);
});

test("member-roster:286 R158: left-listeners registered under the new module and its neighbours, in reverse, are called in the provider's order", async () => {
  const w = await projectWorld();
  const order = around(NEW_ID);
  const heard = [];
  assert.equal(w.m.onProjectLeft("not-a-listed-module", () => { heard.push("unlisted"); }).ok, true);
  for (const m of [...order].reverse())
    assert.equal(w.m.onProjectLeft(m, () => { heard.push(m); }).ok, true);
  assert.equal(w.m.projectRemove({ projectId: "PROJ-P", handle: "bob", by: "ann", viewer: V("ann") }).ok, true);
  assert.deepEqual(heard, [...order, "unlisted"]);
});
