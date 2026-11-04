/* wizard-scripts R51 (K5046 (c)): `ADMIN_ACTS` and `ADMIN_SCREENS`, exported frozen data, and the fixture `noSuchWizard`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seeded, V } from "./fixture.mjs";
import { noSuchWizard } from "./fixtures.mjs";
import { ADMIN_ACTS, ADMIN_SCREENS, SCREEN_REGISTRY, CIVICSMITH_LIBRARY } from "../../../src/wizard-scripts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

/* R51's list is read from the requirement it is written in (the contract, K3268): the backquoted names after "the administrator's
   acts on the team:" and before "(45 names)" on R51's line. A test never hand-lists another module's operations. */
const REQUIREMENTS = readFileSync(new URL("../../../../build/requirements/wizard-scripts.md", import.meta.url), "utf8");
const R51_LINE = REQUIREMENTS.split("\n").find((l) => l.startsWith("- **R51**"));
const R51_LIST = R51_LINE.slice(R51_LINE.indexOf("on the team:"), R51_LINE.indexOf("(45 names)"));
const R51_ACTS = [...R51_LIST.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
/* F1 (T53; amends R51): the five names F1 drops, read from F1's line (its first five backquoted names after "five ops") */
const F1_LINE = REQUIREMENTS.split("\n").find((l) => l.startsWith("- **F1**"));
const F1_DROPPED = [...F1_LINE.slice(F1_LINE.indexOf("does not hold:")).matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((n) => R51_ACTS.includes(n)).slice(0, 5);
const ACTS = R51_ACTS.filter((n) => !F1_DROPPED.includes(n));
/* the control: an act a member does without administering, the first act of the join screen as the registry gives it */
const REGISTRY = JSON.parse(readFileSync(new URL("./source/registry.json", import.meta.url), "utf8"));
const MEMBER_ACT = REGISTRY.screens.find((s) => s.id === "join").acts[0].op;

test("R51 ADMIN_ACTS holds exactly the administrator acts R51 names less F1's five (40) and ADMIN_SCREENS exactly `updates`, both frozen", () => {
  assert.ok(R51_LINE, "R51 is in the requirement");
  assert.equal(R51_ACTS.length, 45);
  assert.deepEqual(F1_DROPPED, ["groupkeyset", "groupkeyremove", "groupkeyswitch", "scanmirror", "officeconfirm"]);
  assert.equal(ACTS.length, 40);
  assert.ok(ADMIN_ACTS instanceof Set && Object.isFrozen(ADMIN_ACTS));
  assert.deepEqual([...ADMIN_ACTS], ACTS, "the members and their order");
  assert.ok(!ADMIN_ACTS.has(MEMBER_ACT), "a member's own act is not an administrator's");
  assert.ok(Array.isArray(ADMIN_SCREENS) && Object.isFrozen(ADMIN_SCREENS));
  assert.deepEqual([...ADMIN_SCREENS], ["updates"]);
});

/* The interface-shell pair, `bio-plane/src/interface-shell/index.mjs` (`ADMIN_ACTS`, `ADMIN_SCREENS`), is the copy these were taken from
   (R51's list above is the same 45 names and `updates`); interface-shell's Wave B job deletes its pair and imports these (K624), or makes
   its own test of equality. A test here cannot import it: interface-shell is a later module (architecture check). */

test("R51 handed to the registration, startFrom omits a script whose first act is among ADMIN_ACTS for a plain member and lists it for an administrator", () => {
  const ops = [...new Set(SCREEN_REGISTRY.flatMap((s) => [...s.acts, ...(s.owed || []).map((o) => o.op)]))];
  const w = seeded({ register: false });
  assert.equal(w.wz.wizardRegister({ screens: SCREEN_REGISTRY, ops, library: CIVICSMITH_LIBRARY, adminActs: [...ADMIN_ACTS], adminScreens: [...ADMIN_SCREENS] }).ok, true);
  const setup = word("wizard.WIZ-4d42b0233d48913f.name");
  const named = (r) => r.scripts.map((s) => s.name);
  assert.ok(!named(w.wz.startFrom({ viewer: V("frank") })).includes(setup));
  assert.ok(named(w.wz.startFrom({ viewer: V("erin") })).includes(setup));
});

test("R51 noSuchWizard is the real NO_SUCH_WIZARD refusal of the wizard-script read for an unknown id", () => {
  const r = noSuchWizard();
  assert.equal(r.ok, false);
  assert.equal(r.reason, "NO_SUCH_WIZARD");
  assert.equal(r.code, "NO_SUCH_WIZARD");
  assert.equal(r.script, "WIZ-0000000000000000");
});
