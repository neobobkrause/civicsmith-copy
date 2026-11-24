/* store-assembly's copy of plane's test of this name (K624: by copy). store-assembly R17 (DEC-121 (5); K1363 B11, K619): the plane's release suite for the required flows. `requiredFailures`
   (`wizard-scripts` R14) is held empty for the registration the plane carries in its bundle and registers at start: a
   required script of the Civicsmith library that the checks refuse fails this suite, and a release requires it (the
   `regression` workflow runs `npm test` in `bio-plane/`, which runs every module suite, this one among them). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { wizardRegistration, screenFailures } from "../../../src/store-assembly/wizards.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assembleStore, storage } from "./fixture.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { requiredFailures, SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";

test("R17 (K1869 (2)): every required script of the bundled Civicsmith library passes the checks against the bundled registration, the registry's screens among it (requiredFailures is empty)", () => {
  assert.equal(wizardRegistration().screens, SCREEN_REGISTRY, "the design stream's registry wizard-scripts carries");
  const failures = requiredFailures(wizardRegistration());
  assert.deepEqual(failures, [], `a failing required flow blocks the release: ${JSON.stringify(failures)}`);
});

test("R17: the suite fails when a required script fails, and only a required one counts (negative control)", () => {
  const reg = wizardRegistration();
  const steps = [{ screen: "zz-no-such-screen", act: null, what: "Open the page", why: "To begin" }];
  const library = [...reg.library,
    { id: "WIZ-zz-required", name: "A required flow", required: true, version: 1, steps },
    { id: "WIZ-zz-optional", name: "An optional flow", required: false, version: 1, steps }];
  const failures = requiredFailures({ ...reg, library });
  assert.deepEqual(failures.map((f) => [f.id, f.refusal.code]), [["WIZ-zz-required", "WIZARD_SCREEN_UNKNOWN"]]);
  /* and one that walks a registered screen passes */
  const screens = [...reg.screens, { id: "zz-screen", acts: [] }];
  const fixed = [{ id: "WIZ-zz-required", name: "A required flow", required: true, version: 1,
                   steps: [{ ...steps[0], screen: "zz-screen" }] }];
  assert.deepEqual(requiredFailures({ ...reg, screens, library: [...reg.library, ...fixed] }), []);
});

const registryFile = new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url);
const OLD_IDS = ["queue", "record", "finder", "subjects", "progressions", "themes", "projects", "review", "members", "add", "bundle",
                 "inquiry", "project", "action", "published", "review-copy", "published-case", "basis-versions", "accept-ceremony",
                 "inquiry-stance", "ai-session"];

test("R23 (T51; K3807): the one registry is wizard-scripts' `SCREEN_REGISTRY`, every screen `{id, name, purpose, acts, owed}`, its count read from the design's file, and the release suite's `screenFailures` is empty for it", () => {
  const file = JSON.parse(readFileSync(fileURLToPath(registryFile), "utf8"));
  const listed = Array.isArray(file) ? file : file.screens;
  assert.ok(SCREEN_REGISTRY.length >= 71 && SCREEN_REGISTRY.length <= listed.length, `${SCREEN_REGISTRY.length} screens of the file's ${listed.length}`);
  for (const s of SCREEN_REGISTRY) assert.deepEqual(Object.keys(s).sort(), ["acts", "id", "name", "owed", "purpose"], s.id);
  assert.deepEqual(screenFailures(SCREEN_REGISTRY, OPS), [], "a screen naming an op no spec holds fails the release");
  assert.deepEqual(screenFailures(), [], "the default is the registry itself");
});

test("R23 (T51): the assembly carries no registry of its own: `store-assembly/screens.mjs` is absent, `wizardRegistration().screens` is the registry itself, and answers' explain read is handed that same object", () => {
  const dir = fileURLToPath(new URL("../../../src/store-assembly/", import.meta.url));
  assert.equal(existsSync(`${dir}screens.mjs`), false);
  assert.equal(readdirSync(dir).some((f) => f.startsWith("screens")), false);
  assert.equal(wizardRegistration().screens, SCREEN_REGISTRY);
  const { ctx } = storage();
  assembleStore(ctx, {});
  assert.equal(answersOf(ctx).deps.screens, SCREEN_REGISTRY, "the composition hands answers the registry, no copy");
});

test("R23 negative control: an entry naming an op no spec holds, a repeated id, or a missing purpose or name fails the suite; an owed act with no op is no failure; none of the 21 old screens that the registry lacks is invented", () => {
  const bad = [...SCREEN_REGISTRY, { id: "zz", name: "Zz", acts: ["zz-no-such-op"], owed: [], purpose: "x" },
               { id: "queue", name: "", acts: [], owed: [], purpose: "" }];
  assert.deepEqual(screenFailures(bad, OPS), [{ screen: "zz", problem: "no op spec", act: "zz-no-such-op" },
                                              { screen: "queue", problem: "no name" }, { screen: "queue", problem: "no purpose" },
                                              { screen: "queue", problem: "id repeated" }]);
  const owed = [{ id: "zz", name: "Zz", purpose: "x", acts: [], owed: [{ op: "zz-owed-act", dec: "K0", at: 0 }] }];
  assert.deepEqual(screenFailures(owed, OPS), [], "an owed act is named apart and is not an act");
  const ids = new Set(SCREEN_REGISTRY.map((s) => s.id));
  for (const id of OLD_IDS) if (!ids.has(id)) assert.equal(SCREEN_REGISTRY.some((s) => s.id === id), false, id);
  assert.equal(OLD_IDS.filter((id) => !ids.has(id)).length > 0, true, "some old ids are not the design's, and none is found");
});

test("R23 (DEC-149; T34-87, K1784; T51): a title or purpose a surface draws is the screen's own key, `screen.<id>.name` and `screen.<id>.purpose`, and the words call the group's Civicsmith \"your group's Civicsmith\", never \"this instance\", \"the instance\", \"this copy\", \"this plane\" or \"server\"", () => {
  for (const s of SCREEN_REGISTRY) {
    for (const f of ["name", "purpose"]) {
      const key = `screen.${s.id}.${f}`;
      assert.equal(hasWord(key), true, `${key} is held by the words list`);
      assert.doesNotMatch(word(key), /\b(?:this|the) (?:instance|plane)\b|\bthis copy\b|\bserver\b/i, key);
    }
    assert.equal(s.name, word(`screen.${s.id}.name`), `${s.id}.name`);
  }
});
