/* action-records against action-grammar PR 396 (notice action-grammar:396; action-grammar R31, R5; LAW_LAYER_MAX added):
   `governingLawsOf` now answers each entry as `{level, citation, layer}` (`layer: null` when absent), and C-2.10's
   governing-law arm now judges a stated `layer`. This module reads the list only through `governingLawsOf` (R1's answer,
   `governing_laws`, passed through whole) and loads `GOVERNING_LAW_CHECKS` only for its rows (C-73.1–C-73.5, which PR 396
   left as they were); it mints no C-2.10 finding. So it needs no change: R1's answer carries each law's layer as the one
   reader answers it, and R7's refusals keep their rows. R21 (a proposal that keeps its own layer) is t53-layer.test.mjs's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, MACHINE, A, B } from "./fixture.mjs";
import { governingLawsOf, GOVERNING_LAW_CHECKS, LAW_LAYER_MAX } from "../../../src/action-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const stated = (entries) => ["governing_laws:", ...entries.flatMap(([c, layer]) =>
  ["  - level: state", `    citation: "${c}"`, ...(layer === undefined ? [] : [`    layer: "${layer}"`])]),
  "governing_laws_by: member:alice", 'governing_laws_at: "2026-09-02T00:00:00Z"'];

test("notice action-grammar:396 (R1): actionLawsPropose answers the list as governingLawsOf reads it, each law with its layer (null when absent)", () => {
  const w = world();
  w.action(A, stated([["Act s.1", "state-layer-a"], ["Act s.2"]]));
  const p = w.r.actionLawsPropose({ target: A, laws: [{ level: "state", citation: "Other" }], proposer: MACHINE, viewer: MACHINE });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual(p.governing_laws, governingLawsOf(w.fm(A)), "the one reader's answer, whole");
  assert.deepEqual(p.governing_laws.laws.map((l) => l.layer), ["state-layer-a", null]);
  /* control: a malformed layer (over LAW_LAYER_MAX) is never answered as a layer; the list still reads as stated */
  w.action(B, stated([["Act s.3", "x".repeat(LAW_LAYER_MAX + 1)]]));
  const q = w.r.actionLawsPropose({ target: B, laws: [{ level: "state", citation: "Other" }], proposer: MACHINE, viewer: MACHINE });
  assert.deepEqual([q.governing_laws.state, q.governing_laws.laws[0].layer], ["stated", null]);
  assert.equal(parseFrontmatter(w.text(B)).data.governing_laws[0].citation, "Act s.3", "the act writes no file");
});

test("notice action-grammar:396 (R7, R14): lawEntries' refusals keep their GOVERNING_LAW_CHECKS rows; a layer in a proposed entry is not a refusal", () => {
  const w = world();
  const rows = [w.r.lawEntries([]), w.r.lawEntries(Array.from({ length: 13 }, (_, i) => ({ level: "city", citation: `B${i}` }))),
    w.r.lawEntries([{ level: "nowhere", citation: "x" }]), w.r.lawEntries([{ level: "state", citation: "" }])];
  assert.deepEqual(rows.map((r) => [r.reason, r.check, r.translation]),
    ["NO_LAWS", "TOO_MANY_LAWS", "BAD_LAW_LEVEL", "BAD_CITATION"].map((c) => [c, GOVERNING_LAW_CHECKS[c].check, GOVERNING_LAW_CHECKS[c].translation]));
  assert.deepEqual(rows.map((r) => r.check), ["C-73.2", "C-73.5", "C-73.3", "C-73.4"]);
  /* control: an entry carrying a layer is judged on its shape as before */
  assert.equal(w.r.lawEntries([{ level: "state", citation: "Act s.1", layer: "state-layer-a" }]).ok, true);
});
