/* Provider notice wizard-scripts:98 (PR 98; wizard-scripts R54): the registry is re-taken at 30af4350f2, by which `question`
 * registers `leggrade` (declared, "Record this grade") and `document` `resolve`. The question's grade act (R139's fold) is
 * now a registry act, so it is labelled as every registry act is, `act.leggrade.label.question` (R5's rule; the design's
 * words hold no `screen.question.leggrade.act` now), and the screen's acts are exactly the registry's as wizard-scripts carries it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { SCREEN_REGISTRY, SCREEN_REGISTRY_SOURCE } from "../../../src/wizard-scripts/index.mjs";
import { SCREENS } from "./fixtures.mjs";

test("notice wizard-scripts:98: question's leggrade is the registry's act, labelled by act.leggrade.label.question, a word the table holds", () => {
  assert.equal(SCREEN_REGISTRY_SOURCE.commit, "30af4350f2");
  const reg = SCREEN_REGISTRY.find((s) => s.id === "question");
  assert.ok(reg.acts.includes("leggrade"), "the registry lists leggrade on question");
  const act = SCREENS.find((s) => s.id === "question").acts.find((a) => a.op === "leggrade");
  assert.equal(act.label, "act.leggrade.label.question");
  assert.ok(hasWord(act.label), "a words.json word");
  assert.ok(SCREENS.find((s) => s.id === "question").words.includes(act.label), "listed among the screen's keys");
});

test("notice wizard-scripts:98: every act this module's screens draw that the registry declares is the registry's for that screen", () => {
  for (const s of SCREENS) {
    const reg = SCREEN_REGISTRY.find((r) => r.id === s.id);
    assert.ok(reg, `${s.id} is a registry screen`);
    for (const a of s.acts) if (reg.acts.includes(a.op)) assert.ok(hasWord(a.label), `${s.id} ${a.op}: ${a.label} is a word`);
  }
  /* control: document's resolve, which R54 registers there, is drawn there */
  assert.ok(SCREEN_REGISTRY.find((r) => r.id === "document").acts.includes("resolve"));
  assert.ok(SCREENS.find((s) => s.id === "document").acts.some((a) => a.op === "resolve"));
});
