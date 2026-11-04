/* Provider notice wizard-scripts:163 (PR 163, a change of source with no requirement text). PR 163 re-pointed the library's steps
   that named retired AI-account acts: "Set up and claim" step 12 to `aiaccountadd`, and "Connect your Claude account" steps 5 and 8
   to `aiownadd` and `aiaccountremove`. The guide reads each script's steps from the store (`wizardread`) and rings exactly the act a
   step names (R2), so this module needs no change; this test confirms it over the scripts as merged. The scripts and the steps are
   named as the notice names them; every act walked is read from the library's export (K3268). Every op the guide calls is answered
   by the real store (`world.mjs`). */
import test from "node:test";
import assert from "node:assert/strict";
import { standIn } from "./standin.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { team, CIVICSMITH_LIBRARY } from "./world.mjs";

const ACT_OPS = new Set(Object.keys(OPS).filter((op) => OPS[op].mutating !== false && op !== "wizardprogress"));
/* the scripts PR 163 re-pointed, as the library exports them, and the steps it re-pointed in each */
const REPOINTED = [{ id: "WIZ-c887066cc553dd41", steps: [12] }, { id: "WIZ-74328804ddae3503", steps: [5, 8] }]
  .map((r) => ({ ...r, script: CIVICSMITH_LIBRARY.find((s) => s.id === r.id) }));
const unique = (a) => a.filter((v, i) => a.indexOf(v) === i);

/** Walks `script` by Next from its first step to its last, each step's screen drawing every act the script names there except
 *  those in `hide`, until a side trip starts; answers the guide's rings in the main run, the screens it opened and the steps it said were absent. */
async function walk(t, script, { hide = [] } = {}) {
  const drawn = {};
  for (const st of script.steps) if (st.act && !hide.includes(st.act)) (drawn[st.screen] ||= []).push(st.act);
  const g = standIn({ team: t, as: t.rosa, drawn });
  await g.enter("home");
  await g.control("start", { script: script.id, at: "1" });
  const absent = [], rings = [];
  for (let i = 1; i <= script.steps.length && g.view.ui.run; i++) {
    if (g.view.ui.run.parent) break; // a step's side trip (R5) is its own script's walk, not this one's
    if (g.view.ui.absent) absent.push(i);
    rings.push(...g.rings.splice(0));
    if (i < script.steps.length) await g.control("next");
  }
  return { g, absent, rings };
}

test("notice wizard-scripts:163: the re-pointed steps name acts OPS holds, and every act of both scripts is in OPS", () => {
  for (const r of REPOINTED) {
    assert.ok(r.script, `${r.id} is in the library`);
    for (const n of r.steps) assert.ok(r.script.steps[n - 1].act, `${r.id} step ${n} names an act`);
    for (const st of r.script.steps) if (st.act) assert.ok(Object.hasOwn(OPS, st.act), `${r.id}: ${st.act} is in OPS`);
  }
});

test("notice wizard-scripts:163: the guide walks each re-pointed script as merged, ringing each step's act once in order and pressing nothing", async () => {
  const t = await team();
  for (const r of REPOINTED) {
    const s = r.script;
    const { g, absent, rings } = await walk(t, s);
    assert.deepEqual(rings, s.steps.map((st) => st.act).filter(Boolean), `${s.id}: the rings are its steps' acts`);
    for (const n of r.steps) assert.ok(rings.includes(s.steps[n - 1].act), `${s.id}: step ${n}'s re-pointed act is rung`);
    assert.deepEqual(absent, [], `${s.id}: every act is found on its screen`);
    assert.deepEqual(unique(g.nav.map(([screen]) => screen)).slice(0, unique(s.steps.map((st) => st.screen)).length),
      unique(s.steps.map((st) => st.screen)), `${s.id}: it opens its steps' screens`);
    assert.deepEqual(g.requests.filter((q) => ACT_OPS.has(q.op)).map((q) => q.op), [], `${s.id}: the guide presses nothing`);
  }
});

test("notice wizard-scripts:163 control: where the screen does not draw a re-pointed act for the member, its step says so and offers Next", async () => {
  const t = await team();
  for (const r of REPOINTED) {
    const s = r.script;
    const hide = r.steps.map((n) => s.steps[n - 1].act);
    const { g, absent } = await walk(t, s, { hide });
    assert.deepEqual(absent, r.steps, `${s.id}: exactly the re-pointed steps are absent`);
    assert.ok(g.text().length > 0, `${s.id}: the guide still runs`);
  }
});
