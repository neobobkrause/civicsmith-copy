/* case-authoring: notice inquiry:360 (T53; inquiry R87–R90; DEC-457, DEC-481). A member now names or changes who a question
   is about (`setSubject`), by a revision of the question's document that moves only `subject_entity`, and reads the
   change's history (`subjectHistory`). This module reads a member's subject from its pinned bytes (R60) and the members'
   subjects for the timeline through `inquiry.subjectEntityOf` (R57); it calls neither new service. So it needs no change:
   a case prepared before the change keeps the subject its pin states (R13), and the next preparation pins the revision
   and states the new subject. Driven through the real inquiry and the real publishCase. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";
const docOf = (w, r) => w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;
const rolesOf = (w, r) => w.fm(docOf(w, r)).case_roles.map((x) => [x.target, x.version_sha, x.subject_entity]);

test("notice inquiry:360 (R60, R13, R57): a subject changed by setSubject is a revision of the question; a case prepared before keeps its pin and subject, the next preparation pins the revision and states the new subject, which inquiry's own read answers", () => {
  const w = world(); w.member("alice", { role: "admin" });
  const ent = (label) => {
    const r = w.entities.createEntity({ kind: "institution", label, sector: "government", note: `${label}, as named.`,
                                        declaredBy: V("alice") });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    return r.entity_id ?? r.entity.entity_id;
  };
  const A = ent("Fire Department"), B = ent("Water Board");
  w.doc(DOC);
  w.finding(Q, [{ target: DOC }], { lines: [`subject_entity: ${A}`] });
  const P = w.project("Team", "alice", [Q]);
  const before = w.publish(P, "alice", [Q], { tieAttested: true });
  assert.equal(before.ok, true, JSON.stringify(before).slice(0, 300));
  const pinned = w.head(Q);
  assert.deepEqual(rolesOf(w, before), [[Q, pinned, A]]);
  const set = w.inquiry.setSubject({ target: Q, subject: B, reason: "The board, not the department, made the award.",
                                     viewer: V("alice"), author: "alice" });
  assert.equal(set.ok, true, JSON.stringify(set).slice(0, 400));
  assert.notEqual(w.head(Q), pinned, "setSubject revises the question");
  assert.equal(w.inquiry.subjectEntityOf(Q), B);
  const history = w.inquiry.subjectHistory({ id: Q, viewer: V("alice") });
  assert.equal(history.ok, true);
  assert.deepEqual(history.changes.at(-1) && [history.changes.at(-1).act, history.changes.at(-1).from, history.changes.at(-1).to],
                   ["changed", A, B]);
  /* R13: the stored preparation is untouched */
  assert.deepEqual(rolesOf(w, before), [[Q, pinned, A]]);
  /* the next preparation pins the revision and states its subject (R60), read from its bytes */
  const after = w.publish(P, "alice", [Q], { tieAttested: true });
  assert.equal(after.ok, true, JSON.stringify(after).slice(0, 300));
  assert.deepEqual(rolesOf(w, after), [[Q, w.head(Q), B]]);
});
