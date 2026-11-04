/* action-plans against strength PR 176 (notice strength:176; strength R46, R47, DEC-464): a leg on a typed passage now
   counts on the capture axis at the passage's grade (the typist's word, one step more once a second member checked it),
   and the grading method gains a new version; a stored version keeps its stored grade. This module reads only
   `strength.projectBar` (unchanged) and, for a determined subject, each finding's frozen pair as the determination
   records it (R7's `short` / `established`), so it needs no change: a finding frozen at a typed passage's grade is
   measured against the bar like any other letter, and a later check of the typing moves no plan's support until a new
   determination freezes a new pair. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, V, by } from "./fixture.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

const typedFinding = (grade) => [{ finding: "INQ-typed", frozen: { capture: { grade }, connection: { grade: "A" } } }];

test("notice strength:176 (R7): a finding frozen at an unchecked typing's grade is short of a capture bar at the checked typing's grade, and one frozen at the checked grade meets it", () => {
  assert.notEqual(TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE);
  const w = seeded();
  w.bars.set(w.P, { capture: TYPED_CHECKED_GRADE, connection: null });
  const unchecked = w.determine({ project: w.P, outcomes: [{ standard: "S", outcome: "noncompliant" }], findings: typedFinding(TYPED_UNCHECKED_GRADE) });
  const r = w.ap.planOpen({ project: w.P, subjects: [{ kind: "outcome", determination: unchecked, standard: "S" }], title: "Typed", ...by("bob") });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.subjects[0].support, "short");
  const checked = w.determine({ project: w.P, outcomes: [{ standard: "S", outcome: "noncompliant" }], findings: typedFinding(TYPED_CHECKED_GRADE) });
  const r2 = w.ap.planOpen({ project: w.P, subjects: [{ kind: "outcome", determination: checked, standard: "S" }], title: "Checked", ...by("bob") });
  assert.equal(r2.subjects[0].support, "established");
  /* control (strength R46's: a stored version keeps its stored grade): the first plan still reads its determination's
     frozen letter, short, after the second determination freezes the checked grade */
  assert.equal(w.ap.planRead({ id: r.id, viewer: V("bob") }).subjects[0].support, "short");
});
