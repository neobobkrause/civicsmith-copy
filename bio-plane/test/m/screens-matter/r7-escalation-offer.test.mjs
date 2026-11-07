/* screens-matter R7 (T53; JOURNEYS; changes R3, R6; answers R-68, matter half, BLOCKS): a matter with a dated event and a determination offers the escalation.
   Each case through the world's real reads and acts (`screens-action`'s matter world: a project, an event its minutes date, a published finding, two
   standards); the words are read from the word table, never copied. */
import test from "node:test";
import assert from "node:assert/strict";
import { matterWorld, determine, inWorld } from "../screens-action/world-A.mjs";
import { openIn } from "../screens-action/world.mjs";
import { main, text, ops, press, button, W } from "../screens-action/page.mjs";

const NONE = ["screen.matter.unavailable", "screen.matter.event.none"];
const STEPS = ["screen.matter.unavailable.step.determine", "screen.matter.unavailable.step.consequences", "screen.matter.unavailable.step.escalation"];

test("R7: a project with a dated event and a noncompliant determination draws Open an escalation and Decline to escalate, each with what it does, and neither sentence", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  for (const path of [`/app/matter/${w.project}`, `/app/matter/${det}`]) {
    const p = await openIn(w.world, w.me, path);
    const t = text(p);
    assert.ok(ops(p).includes("escalationopen"), `${path}: Open an escalation`);
    assert.ok(ops(p).includes("declinetoescalate"), `${path}: Decline to escalate`);
    assert.equal(button(p, "escalationopen").dataset.determination, det, `${path}: the act names its determination`);
    for (const k of ["act.escalationopen.does", "act.declinetoescalate.does"]) assert.ok(t.includes(W(k)), `${path}: what ${k} says`);
    for (const k of NONE) assert.ok(!t.includes(W(k)), `${path}: no ${k}`);
  }
  // opened from the project's matter, the escalation is of that determination, and the page goes to it
  const p = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  await press(p, "escalationopen", { reason: "the city has not put it right" });
  const st = await w.me.read("escalationstatus", { query: { determination: det } });
  assert.equal(st.escalations.length, 1, "opened on the determination the button carried");
  const q = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  assert.ok(!ops(q).includes("escalationopen"), "an open escalation is not offered again");
  assert.ok(main(q).querySelector(`a[href="/app/matter/${encodeURIComponent(det + "~" + st.escalations[0].id)}"]`), "the project's matter links to it");
});

test("R7: with no determination and no dated event, the matter draws Not available yet with each reason and the step that clears it, and the event sentence with the way to record one", async () => {
  const { world, me } = await inWorld({ handle: "olive" });
  const project = await world.recipes.project(me, "Stormwater");
  const p = await openIn(world, me, `/app/matter/${project}`);
  const t = text(p);
  for (const k of NONE) assert.ok(t.includes(W(k)), k);
  for (const k of STEPS) assert.ok(t.includes(W(k)), k);
  assert.ok(main(p).querySelector(`a[data-way="timeline"][href="/app/timeline/${encodeURIComponent(project)}"]`), "the way to record a dated event: the project's Timeline");
  assert.ok(!ops(p).includes("escalationopen") && !ops(p).includes("declinetoescalate"), "neither act");
});

test("R7 control: escalation R27's decline records, and the matter draws declined on the project's matter and the determination's", async () => {
  const w = await matterWorld();
  const det = await determine(w);
  const p = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  await press(p, "declinetoescalate", { reason: "the city is already fixing it" });
  const st = await w.me.read("escalationstatus", { query: { determination: det } });
  assert.equal((st.declines || []).length, 1, "the decline is recorded on the determination the button carried");
  const said = W("screen.matter.declined", { reason: st.declines[0].reason });
  for (const path of [`/app/matter/${w.project}`, `/app/matter/${det}`]) {
    const q = await openIn(w.world, w.me, path);
    assert.ok(text(q).includes(said), `${path}: declined`);
  }
});
