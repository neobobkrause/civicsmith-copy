/* skills R5 against run-rules PR 407 (notice run-rules:407): run-rules added AI_RUN_IDEM_CHECKS (AI_RUN_IDEM_INVALID,
   C-109.16, ai-runs' retried-write refusal) and spreads it into AI_RUN_CHECKS. This module reads that table by key and
   never copies it, so it needs no change: the pack's refusals layer carries the new row with run-rules' own check and
   translation, and the skill's own key (C-22.7) is unchanged. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPack } from "../../../src/skillpack.mjs";
import { SKILL_CHECKS, SKILL_CHECK_KEYS } from "../../../src/skilldoctrine.mjs";
import { AI_RUN_CHECKS, AI_RUN_IDEM_CHECKS } from "../../../src/run-rules/index.mjs";
import { published } from "./fixture.mjs";

test("notice run-rules:407 (R5): the refusals layer carries AI_RUN_IDEM_INVALID with run-rules' own check and translation, read by key", () => {
  const { disclosed } = renderPack(published());
  for (const [code, row] of Object.entries(AI_RUN_IDEM_CHECKS)) {
    assert.equal(AI_RUN_CHECKS[code], row, `${code} is in run-rules' AI_RUN_CHECKS`);
    assert.deepEqual(disclosed.refusals.body[code], { check: row.check, says: row.translation }, `${code} reaches the pack`);
  }
  assert.equal(disclosed.refusals.body.AI_RUN_IDEM_INVALID.check, "C-109.16");
});

test("notice run-rules:407 (R25): the skill's own refusal key is unchanged: C-22.7 alone", () => {
  assert.deepEqual(SKILL_CHECK_KEYS, ["AI_RUN_SKILL_VERSION_UNNAMED"]);
  assert.deepEqual(Object.keys(SKILL_CHECKS), ["AI_RUN_SKILL_VERSION_UNNAMED"]);
});
