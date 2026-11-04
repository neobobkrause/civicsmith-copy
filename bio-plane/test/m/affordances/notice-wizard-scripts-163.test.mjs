/* affordances: provider notice wizard-scripts:163 (PR 163: source only, no requirement text). wizard-scripts now carries
   each of ai-accounts' retired door ops (ai-accounts R35, R36, T53; op-declarations PR 95) as the T53 op that does its act,
   or as no act, wherever it reads the design files (`data.mjs` `RETIRED_ACTS`, `currentAct`): the registry's screens and
   every library step. Confirmed, no code change: R37's `screens` and `wizard_scripts` are wizard-scripts' registered
   answers passed through unchanged, so the untargeted answer carries the T53 ops and no retired one with nothing held
   here; and each op the change newly puts on a screen is accounted for by R49's act help or by op-declarations'
   `ACT_HELP_ABSENT` (its R34), so a surface reading `act_help` for a screen's acts finds every one placed. Driven over
   wizard-scripts' own world (`../wizard-scripts/fixture.mjs`), registered with every op the carried registry names. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "../wizard-scripts/fixture.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { RETIRED_ACTS } from "../../../src/wizard-scripts/data.mjs";
import { ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { affordancesOf } from "../../../src/affordances/facts.mjs";
import { ACT_HELP } from "../../../src/affordances/act-help.mjs";

const ALL_OPS = [...new Set(SCREEN_REGISTRY.flatMap((s) => [...s.acts, ...s.owed.map((o) => (typeof o === "string" ? o : o.op))]))];
const RETIRED = Object.keys(RETIRED_ACTS);
const REPLACEMENTS = [...new Set(Object.values(RETIRED_ACTS).filter((v) => v !== null))];

function untargeted() {
  const w = world({ register: false });
  w.member("frank");
  const r = w.wz.wizardRegister({ ops: ALL_OPS });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const a = affordancesOf(w.host, { record: w.record, membership: w.membership, wizardScripts: w.wz });
  const out = a.screens({ viewer: "member:frank" });
  assert.equal(out.ok, true);
  return { w, out };
}

test("notice wizard-scripts:163 (R37): the untargeted answer's screens carry the T53 ops in place of the retired ones, as wizard-scripts registers them", () => {
  assert.ok(RETIRED.length >= 12, "the retirement PR 163 reads");
  const { w, out } = untargeted();
  assert.deepEqual(out.screens, w.wz.registeredScreens(), "passed through as registered");
  const at = new Map(out.screens.map((s) => [s.id, s.acts]));
  for (const [screen, op] of [["setup", "aiaccountadd"], ["setup", "aiaccountswitch"], ["connect", "aiownadd"], ["connect", "aiaccountremove"]])
    assert.ok(at.get(screen)?.includes(op), `${screen} carries ${op}`);
  const bad = out.screens.flatMap((s) => s.acts.filter((op) => RETIRED.includes(op)).map((op) => `${s.id}: ${op}`));
  assert.deepEqual(bad, [], "no screen carries a retired op");
  /* the offered scripts' steps likewise name no retired op */
  const steps = out.wizard_scripts.flatMap((s) => (s.steps || []).map((t) => t.act)).filter((op) => RETIRED.includes(op));
  assert.deepEqual(steps, []);
});

test("notice wizard-scripts:163 (R49, R48): every op the change puts on a screen is placed by act help or by op-declarations' ACT_HELP_ABSENT; control: a retired op is in neither as a screen's act", () => {
  const { out } = untargeted();
  const onScreens = new Set(out.screens.flatMap((s) => s.acts));
  /* ACT_HELP_ABSENT groups the ops by ground: `{<group>: {ground, ops}}` */
  const absent = new Set(Object.values(ACT_HELP_ABSENT).flatMap((g) => (g && Array.isArray(g.ops) ? g.ops : [])));
  assert.ok(absent.size > 0);
  const placed = (op) => Object.hasOwn(ACT_HELP, op) || absent.has(op);
  for (const op of REPLACEMENTS) {
    assert.ok(onScreens.has(op), `${op} is on a screen`);
    assert.ok(placed(op), `${op}: act help or its absence is stated`);
  }
  /* control: the screens no longer ask act help for any retired op */
  for (const op of RETIRED) assert.equal(onScreens.has(op), false, `${op} on no screen`);
});
