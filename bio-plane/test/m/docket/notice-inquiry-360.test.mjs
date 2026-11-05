/* notice inquiry:360 (T53; PR 360; inquiry R87–R90): `inquiry` now lets a member name, change or take off who a question
   is about after it exists (`setSubject`, R87), and afterwards `subjectEntityOf` (its R43) answers the new value; R88–R90
   add a subject history read this module does not use. docket reads one thing of inquiry: `subjectEntityOf`, for an
   edition's named subjects (R1's `DOCKET_NOT_THE_SUBJECT`, R26's source). Confirmed with no code change: the named subject
   is, as R1's term says, what `subjectEntityOf` answers at the act, so a subject changed after publication is the one a
   `from: {kind: "subject"}` filing names, and one taken off leaves the edition with no named subject from that finding. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, file, SUBJECT, OTHER_SUBJECT } from "./fixture.mjs";

test("notice inquiry:360 (R1) the named subject follows subjectEntityOf after the finding's subject is changed or taken off", () => {
  const w = seeded();
  assert.equal(file(w).ok, true, "the subject as first stated files");
  assert.equal(file(w, { from: { kind: "subject", entity: OTHER_SUBJECT } }).reason, "DOCKET_NOT_THE_SUBJECT");
  w.subjects.set(w.F1, OTHER_SUBJECT);
  assert.equal(file(w, { from: { kind: "subject", entity: OTHER_SUBJECT } }).ok, true, "the changed subject files");
  assert.equal(file(w).reason, "DOCKET_NOT_THE_SUBJECT", "the earlier subject is no longer a named subject");
  w.subjects.delete(w.F1);
  for (const entity of [SUBJECT, OTHER_SUBJECT])
    assert.equal(file(w, { from: { kind: "subject", entity } }).reason, "DOCKET_NOT_THE_SUBJECT", "control: a subject taken off names none");
});
