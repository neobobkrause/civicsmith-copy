/* action-grammar at T53 (N1257; K5458): R31, the readers keep a law's layer and C-2.10's governing-law arm judges it.
   At the module's interface, driven with documents; each with its negative control (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import * as AG from "../../../src/action-grammar/index.mjs";
import { DOCS, NOW } from "./corpus.mjs";
import { pushed, ZONE } from "./fixture.mjs";

const audit = (fm) => pushed((f) => AG.checkActionExtension({ fm, nowMs: NOW, zone: ZONE }, f)).findings;
const withLaws = (list) => ({ ...structuredClone(DOCS["laws-clean"]), governing_laws: list });
const layerFindings = (fm) => audit(fm).filter((x) => /\.layer\b/.test(x.message));

test("R31: governingLawsOf answers {level, citation, layer} for each law, layer null when absent; recordsLawOf answers law_layer the same way", () => {
  const g = AG.governingLawsOf(withLaws([{ level: "state", citation: "Records Act s.1", layer: "state-test" }, { level: "city", citation: "Bylaw 4" }]));
  assert.equal(g.state, "stated");
  assert.deepEqual(g.laws, [{ level: "state", citation: "Records Act s.1", layer: "state-test" }, { level: "city", citation: "Bylaw 4", layer: null }]);
  const law = { ...structuredClone(DOCS["law-clean"]), law_layer: "state-test" };
  assert.equal(AG.recordsLawOf(law, "member:a").law_layer, "state-test");
  assert.equal(AG.recordsLawOf(law, "token:agent").law_layer, "state-test");
  assert.equal(AG.recordsLawOf(DOCS["law-clean"], "member:a").law_layer, null);
  assert.equal(AG.recordsLawOf(DOCS["clean-records-request"]).law_layer, null);
});

test("R31: C-2.10's governing-law arm refuses a layer that is not a non-empty single-line string of at most 200 characters, naming governing_laws[i].layer; negative control: no layer anywhere, or a well-formed one, passes unchanged", () => {
  assert.equal(AG.LAW_LAYER_MAX, 200);
  for (const bad of ["x".repeat(201), "", "  ", "a\nb", 5, {}, ["a"]]) {
    const got = layerFindings(withLaws([{ level: "state", citation: "s.1" }, { level: "state", citation: "s.2", layer: bad }]));
    assert.equal(got.length, 1, JSON.stringify(bad));
    assert.equal(got[0].check, "C-2.10");
    assert.match(got[0].message, /^governing_laws\[1\]\.layer /);
    assert.equal(AG.governingLawsOf(withLaws([{ level: "state", citation: "s.2", layer: bad }])).laws[0].layer, null, "a malformed layer is never answered as one");
  }
  assert.deepEqual(audit(DOCS["laws-clean"]), [], "no layer anywhere: C-2.10 unchanged");
  assert.deepEqual(audit(withLaws([{ level: "state", citation: "s.1", layer: "x".repeat(200) }, { level: "city", citation: "Bylaw 4", layer: null }])), []);
});
