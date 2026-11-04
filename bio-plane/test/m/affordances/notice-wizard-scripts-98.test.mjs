/* affordances: provider notice wizard-scripts:98 (its R54, PR 98: the screen registry re-taken at 30af4350f2, 91 screens).
   Confirmed, no code change: R37's `screens` is `wizard-scripts`' registered registry passed through unchanged
   (`facts.mjs` `screens()` answers `registeredScreens()`), so the screens R54 adds and the acts it registers reach the
   untargeted answer with nothing held here. Driven over wizard-scripts' own world (`../wizard-scripts/fixture.mjs`),
   registered with every op the carried registry names, as its own R54 tests register it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "../wizard-scripts/fixture.mjs";
import { SCREEN_REGISTRY, SCREEN_REGISTRY_SOURCE } from "../../../src/wizard-scripts/index.mjs";
import { affordancesOf } from "../../../src/affordances/facts.mjs";

/* every op the carried registry names, declared and owed: the member op table once each is declared */
const ALL_OPS = [...new Set(SCREEN_REGISTRY.flatMap((s) => [...s.acts, ...s.owed.map((o) => (typeof o === "string" ? o : o.op))]))];

function scene(lacking = []) {
  const w = world({ register: false });
  w.member("frank");
  const r = w.wz.wizardRegister({ ops: ALL_OPS.filter((o) => !lacking.includes(o)) });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return { w, a: affordancesOf(w.host, { record: w.record, membership: w.membership, wizardScripts: w.wz }) };
}

test("notice wizard-scripts:98 (R37): the untargeted answer's screens are wizard-scripts' R54 registry as registered, unchanged", () => {
  assert.equal(SCREEN_REGISTRY_SOURCE.commit, "30af4350f2", "R54's pin");
  const { w, a } = scene();
  const out = a.screens({ viewer: "member:frank" });
  assert.equal(out.ok, true);
  assert.deepEqual(out.screens, w.wz.registeredScreens(), "passed through as registered");
  assert.deepEqual(out.screens.map((s) => s.id), SCREEN_REGISTRY.map((s) => s.id), "every carried screen, in the registry's order");
  assert.equal(out.screens.length, 91, "R54: 91 screens");
  const at = new Map(out.screens.map((s) => [s.id, s.acts]));
  /* the acts R54 registers, each on its screen */
  for (const [screen, op] of [["setup", "factconfirm"], ["queue", "signerknown"], ["capture", "captureuploadabort"], ["document", "resolve"],
    ["question", "leggrade"], ["ceremony", "leggrade"], ["counsel", "counselpacketread"], ["counsel", "counselpacketexport"],
    ["connect", "accountreferenceset"], ["connect", "accountreferenceremove"], ["document", "contradictionflag"]])
    assert.ok(at.get(screen)?.includes(op), `${screen} carries ${op}`);
  assert.ok(!at.get("registers")?.includes("registerimport"), "registerimport is gone from registers");
});

test("notice wizard-scripts:98 (R37) control: an op the table lacks is not carried, as wizard-scripts R13 registers it", () => {
  const { a } = scene(["counselpacketread"]);
  const counsel = a.screens({ viewer: "member:frank" }).screens.find((s) => s.id === "counsel");
  assert.deepEqual(counsel.acts.includes("counselpacketread"), false);
  assert.ok(counsel.acts.includes("counselpacketexport"));
});
