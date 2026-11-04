/* case-disclosures T53: the notice strength:176 (strength R46, R47; DEC-464) and R35, R36, R46.
   Over the module's own world (`fixture.mjs`: record-core, membership, provenance, content, inquiry, strength, each the
   real one on one host). A member types a page through content's own `transcribe` and a second member checks it
   through `transcriptionAttest`, so the typed passage and its grade are the real modules' answers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, sha } from "./fixture.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { ungradedPassagesOf } from "../../../src/case-grammar/index.mjs";
import { GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS, gradingMethodText } from "../../../src/strength/index.mjs";
import { ungradedLines, ungradedBodyLines, UNGRADED_BODY_KEY, subjectNaming } from "../../../src/case-disclosures/index.mjs";

const D1 = "INFO-2026-0001-a", D2 = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", F = "INQ-2026-0002-f";
const AT = "2026-09-27T00:00:00Z";
const GRADED = { grade: "B", grade_axis: "capture", grade_source: "capture" };
const HUNCH = { grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice", date: "2026-09-27" };
const cited = (cid) => `"${cid}"`;
const page = (n) => JSON.stringify({ kind: "pdf-page", page: n });

/* ------------------------------------------------------------------------------- notice strength:176 */

test("notice strength:176 (strength R46, R47; R15): a leg on a typed passage reaches the grading_facts row at the typing's grade, D unchecked and C once a second member checked it, never the document's B, and says it is typed and whether checked, with no name; the case is signed under the method version naming the rule", () => {
  const w = world(); w.member("alice"); w.member("bo");
  w.doc(D1, {}, { receipt: true });
  const content = contentOf(w.host);
  const tx = content.transcribe({ bundleId: D1, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                  transcriber: "alice", viewer: V("alice"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  w.finding(Q, [{ target: D1, content_id: cited(tx.content_id) }]);
  const before = w.cd.findingFacts([{ id: Q }], V("alice"));
  assert.equal(before.grading.length, 1);
  assert.equal(before.grading[0].grade, "D");
  assert.equal(before.grading[0].grade_axis, "capture");
  assert.deepEqual(before.grading[0].typed, { checked: false });
  assert.equal(JSON.stringify(before.grading[0]).includes("alice"), false, "no typist's name in the grading facts");
  /* a typed passage is graded: it is no ungraded passage (R35) */
  assert.deepEqual(before.ungraded, []);
  const chk = content.transcriptionAttest({ contentId: tx.content_id, attestor: "bo", viewer: V("bo"),
                                            at: "2026-09-27T01:00:00Z", note: "The typing matches the page." });
  assert.equal(chk.ok, true, JSON.stringify(chk).slice(0, 300));
  const after = w.cd.findingFacts([{ id: Q }], V("alice"));
  assert.equal(after.grading[0].grade, "C");
  assert.deepEqual(after.grading[0].typed, { checked: true });
  assert.equal(JSON.stringify(after.grading[0]).includes("\"bo\""), false, "no checker's name in the grading facts");
  /* R5: the method the case is signed under is strength's newest, whose words name the typed-passage rule */
  assert.equal(w.cd.methodOf().grading, GRADING_METHOD_VERSION);
  assert.equal(GRADING_METHOD_VERSIONS.at(-1), GRADING_METHOD_VERSION);
  assert.match(String(gradingMethodText(GRADING_METHOD_VERSION)), /[Tt]yped passage/);
});

test("notice strength:176 (control): a leg on a passage no member typed keeps its own reading: no typed field, and an ungraded leg stays ungraded", () => {
  const w = world(); w.member("alice");
  const a = w.doc(D1, {}, { receipt: true });
  w.content(sha("p0"), a, D1, "p0", page(0));
  w.finding(Q, [{ target: D1, content_id: cited(sha("p0")) }]);
  const f = w.cd.findingFacts([{ id: Q }], V("alice"));
  assert.equal(f.grading[0].grade, null);
  assert.equal(Object.hasOwn(f.grading[0], "typed"), false);
});

/* ----------------------------------------------------------------------------------------------- R35 */

/* Two findings over two documents: Q with p1 ungraded, p2 graded, p3 ungraded; F with p4 ungraded and a hunch leg p5. */
function ungradedWorld({ gradeP1 = false } = {}) {
  const w = world(); w.member("alice");
  const a = w.doc(D1, {}, { receipt: true }), b = w.doc(D2, {}, { title: "Minutes of the board" });
  for (const [n, cap, doc, at] of [[1, a, D1, 0], [2, a, D1, 1], [3, b, D2, 0], [4, b, D2, 1], [5, a, D1, 2]])
    w.content(sha(`p${n}`), cap, doc, `p${n}`, page(at));
  w.finding(Q, [{ target: D1, content_id: cited(sha("p1")), ...(gradeP1 ? GRADED : {}) },
                { target: D1, content_id: cited(sha("p2")), ...GRADED },
                { target: D2, content_id: cited(sha("p3")) }]);
  w.finding(F, [{ target: D2, content_id: cited(sha("p4")) },
                { target: D1, content_id: cited(sha("p5")), ...HUNCH }]);
  return w;
}

test("R35 (T53; DEC-461): findingFacts answers `ungraded`, one {finding, ord, content_id, title, role} per leg with a passages row and no counted grade, member then ord order: three over two findings; grade one and two remain", () => {
  const w = ungradedWorld();
  const f = w.cd.findingFacts([{ id: Q }, { id: F }], V("alice"));
  assert.deepEqual(f.ungraded, [
    { finding: Q, ord: 0, content_id: sha("p1"), title: `Document ${D1}`, role: "supports" },
    { finding: Q, ord: 2, content_id: sha("p3"), title: "Minutes of the board", role: "supports" },
    { finding: F, ord: 0, content_id: sha("p4"), title: "Minutes of the board", role: "supports" },
  ]);
  const g = ungradedWorld({ gradeP1: true }).cd.findingFacts([{ id: Q }, { id: F }], V("alice"));
  assert.deepEqual(g.ungraded.map((e) => [e.finding, e.ord]), [[Q, 2], [F, 0]]);
});

test("R35 (control): all graded answers []; a hunch leg is never listed; a finding gradingFacts refuses adds no entry and stays in unread; R15's rows are unchanged beside it", () => {
  const w = world(); w.member("alice");
  const a = w.doc(D1, {}, { receipt: true });
  w.content(sha("g1"), a, D1, "g1", page(0));
  w.content(sha("h1"), a, D1, "h1", page(1));
  w.finding(Q, [{ target: D1, content_id: cited(sha("g1")), ...GRADED }, { target: D1, content_id: cited(sha("h1")), ...HUNCH }]);
  const f = w.cd.findingFacts([{ id: Q }, { id: D1 }], V("alice"));
  assert.deepEqual(f.ungraded, []);
  assert.deepEqual(f.unread.map((u) => u.finding), [D1]);
  assert.deepEqual(f.grading.map((g) => [g.finding, g.ord, g.grade, g.grade_source]), [[Q, 0, "B", "capture"], [Q, 1, "B", "hunch"]]);
  assert.deepEqual(f.passages.map((p) => [p.finding, p.ord, p.content_id]), [[Q, 0, sha("g1")], [Q, 1, sha("h1")]]);
});

/* ----------------------------------------------------------------------------------------------- R36 */

const readBack = (lines) => ungradedPassagesOf(parseFrontmatter(["---", "format: bio-case-document/10", ...lines, "---", ""].join("\n")).data);

test("R36 (T53; DEC-461): ungradedLines writes R35's entries through case-grammar's block writer and its reader returns them in order; ungradedBodyLines writes the one fixed sentence once, by its key", () => {
  const w = ungradedWorld();
  const { ungraded } = w.cd.findingFacts([{ id: Q }, { id: F }], V("alice"));
  const lines = ungradedLines(ungraded);
  const back = readBack(lines);
  assert.equal(back.state, "stated");
  assert.deepEqual(back.rows, ungraded.map(({ finding, ord, content_id }) => ({ finding, ord, content_id })));
  /* the rows are the entries and nothing else (R20): no title or role is written */
  assert.equal(lines.join("\n").includes("Minutes of the board"), false);
  const body = ungradedBodyLines(ungraded);
  assert.equal(body.filter((l) => l).length, 1);
  assert.equal(typeof body[0], "string");
  assert.ok(body[0].length > 0);
  assert.equal(UNGRADED_BODY_KEY, "case-disclosures.document.ungraded_body");
  assert.deepEqual(ungradedBodyLines(ungraded.slice(0, 1)), body, "the sentence is fixed, whatever the entries");
});

test("R36 (control): no entries write no block and no sentence, so the document there has the bytes of an earlier format", () => {
  assert.deepEqual(ungradedLines([]), []);
  assert.deepEqual(ungradedBodyLines([]), []);
  assert.deepEqual(ungradedLines(null), []);
  assert.deepEqual(ungradedBodyLines(undefined), []);
  assert.deepEqual(readBack(ungradedLines([])), { state: "stated", rows: [], detail: null });
});

/* ----------------------------------------------------------------------------------------------- R46 */

const ORG = { entity_id: "ENT-org-1", kind: "institution", label: "Harbor Works Inc.", contact_kind: "phone", contact_value: "555-0100" };
const PERSON = { entity_id: "ENT-person-1", kind: "person", label: "Pat Doe", contact_kind: "address", contact_value: "1 Elm St" };
const basis = (person, kind) => ({ person, basis: kind, ref: kind === "act_or_position" ? { line: "LINE-1", event: "EVT-1" } : "LINE-1" });

test("R46 (T53; K5571 (2)): an organisation with a recorded act_or_position basis answers {named: true, name}; the same subject with no recorded basis answers {named: false}; the instance answers the same", () => {
  assert.deepEqual(subjectNaming({ subject: ORG, bases: [basis(ORG.entity_id, "act_or_position")], viewer: V("alice") }),
                   { named: true, name: ORG.label });
  assert.deepEqual(subjectNaming({ subject: ORG, bases: [], viewer: V("alice") }), { named: false });
  assert.deepEqual(subjectNaming({ subject: ORG, bases: [basis("ENT-other", "act_or_position")] }), { named: false });
  const w = world();
  assert.deepEqual(w.cd.subjectNaming({ subject: ORG, bases: [basis(ORG.entity_id, "act_or_position")], viewer: V("alice") }),
                   { named: true, name: ORG.label });
  /* a person on a recorded public basis may be named */
  assert.deepEqual(subjectNaming({ subject: PERSON, bases: [basis(PERSON.entity_id, "act_or_position")] }),
                   { named: true, name: PERSON.label });
});

test("R46 (control): a private person with any basis answers {named: false}; the answer carries no address or phone number (R26); it never throws", () => {
  for (const other of ["act_or_position", "tie", "consent", "prior_publication"])
    assert.deepEqual(subjectNaming({ subject: PERSON, bases: [basis(PERSON.entity_id, "private_party"), basis(PERSON.entity_id, other)] }),
                     { named: false });
  assert.deepEqual(subjectNaming({ subject: PERSON, bases: [basis(PERSON.entity_id, "private_party")] }), { named: false });
  const named = subjectNaming({ subject: ORG, bases: [basis(ORG.entity_id, "act_or_position")] });
  assert.equal(JSON.stringify(named).includes("555-0100"), false);
  assert.equal(JSON.stringify(subjectNaming({ subject: PERSON, bases: [basis(PERSON.entity_id, "act_or_position")] })).includes("Elm"), false);
  for (const bad of [undefined, null, {}, { subject: "x" }, { subject: ORG, bases: "nope" }, { subject: { ...ORG, label: "" }, bases: [basis(ORG.entity_id, "tie")] }])
    assert.deepEqual(subjectNaming(bad), { named: false });
});
