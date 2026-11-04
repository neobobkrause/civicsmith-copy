/* review: the T53 provider notices strength:176, case-grammar:202, case-authoring:228 and publication:229.

   Each provider changed something this module reads; each test below drives this module's real code over the provider's
   real code, in case-authoring's own test world (its published fixture: real record, membership, strength, publication,
   ratification and case-authoring), with this module's real instance filling publication's review provider in place of
   that world's stand-in. Nothing of another module's answer is built here.

   - strength:176 (its R46, R47: a typed passage counts at the record's grade). This module reads only the project's bar
     (`projectBar`, R11's `required_strength`), which PR 176 did not change: confirmed, no code change.
   - case-grammar:202 (its R35-R39: format bio-case-document/10, ungraded and typed passages). This module reads only the
     approval digest (`approvalSubjectSha`, R31) and a document's review comments (`reviewCommentsOf`, R33), neither
     changed; a /10 document is approved at its digest: confirmed, no code change.
   - case-authoring:228 (its R91: a carried-forward refusal names its `field`). R13's `missing` is the publish gate's own
     first refusal, whole, so the field reaches the copy: confirmed, no code change.
   - publication:229 (its R80-R82: an edition's commit records its passages in four new `published_cases` columns). This
     module reads `published_cases` only for the top edition and its scope (R5, R39), by name; a real commit with the
     new columns still answers both: confirmed, no code change. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { world, V, AUTHORED } from "../case-authoring/fixture.mjs";
import { reviewOf } from "../../../src/review/index.mjs";
import { CASE_DOCUMENT_FORMAT, approvalSubjectSha } from "../../../src/case-grammar/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-r";
const FRESH = { statement: "It does not cover the later amendments to the award.",
                subjectJustification: "The award is public, and the question is whether its terms were kept.",
                biasAcknowledgement: "We still read the minutes as the account of the meeting, as of this edition.",
                excluded: [{ description: "the amendments, which this edition names", reason: "not yet obtained" }] };
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");

/* case-authoring's world without its stand-in review provider, and this module's real instance on the same host. */
function setup() {
  const w = world({ provider: false });
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q, [{ target: DOC }]);
  w.finding(Q2, [{ target: DOC2 }]);
  const A = w.project("A", "alice", [Q, Q2]);
  const r = reviewOf(w.host, { record: w.record, membership: w.membership, strength: w.strength,
                               publication: w.publication, caseAuthoring: w.ca, ratification: w.ratification,
                               basisVersions: w.basisVersions });
  return { w, A, r };
}
/* edition 1 of a case, prepared by case-authoring and signed through publication's commit */
function published(w, A) {
  const x = w.publish(A, "alice", [Q], { excluded: [{ description: "the side letter", reason: "not in hand" }] });
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 300));
  w.ratify(x);
  return x;
}

test("notice strength:176 (R11): the copy's required_strength is strength's own projectBar for the draft's project, after strength's typed-passage change", () => {
  const { w, A, r } = setup();
  const d = r.act({ act: "draft", author: "alice", project: A, targets: [Q], ...FRESH });
  assert.equal(d.ok, true, JSON.stringify(d));
  const c = r.copy({ draft: d.draftId, viewer: V("alice") });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  assert.deepEqual(c.required_strength, w.strength.projectBar(A));
  assert.notEqual(c.required_strength, undefined);
});

test("notice case-grammar:202 (R31): a next edition case-authoring prepares now declares bio-case-document/10, and an approver approves it at case-grammar's approval digest", () => {
  const { w, A, r } = setup();
  const one = published(w, A);
  const x = w.publish(A, "alice", [Q2], { ...FRESH, caseId: one.caseId });
  assert.deepEqual([x.ok, x.edition], [true, 2], JSON.stringify(x).slice(0, 300));
  const doc = w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, x.caseId, x.edition);
  assert.match(doc.text, new RegExp(CASE_DOCUMENT_FORMAT.replace("/", "\\/")));
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  w.member("adm", { role: "admin" });
  assert.equal(r.approvalRuleSet({ approvers: ["alice"], by: "adm" }).ok, true);
  const ok = r.caseApprove({ case: x.caseId, edition: x.edition, docSha: approvalSubjectSha(doc.text), by: "alice" });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  /* control: the stored text's plain digest is not the approval digest, and names nothing to approve */
  const no = r.caseApprove({ case: x.caseId, edition: x.edition, docSha: sha(doc.text + "x"), by: "alice" });
  assert.equal(no.ok, false);
});

test("notice case-authoring:228 (R13): a draft carrying edition 1's bias acknowledgement forward is missing the publish gate's own refusal, its field (case-authoring R91) included, and nothing is written", () => {
  const { w, A, r } = setup();
  const x = published(w, A);
  const d = r.act({ act: "draft", author: "alice", project: A, caseId: x.caseId, targets: [Q2], roles: { [Q2]: "load_bearing" },
                    ...AUTHORED, whatChanged: { text: "Q2 joins." }, ...FRESH, biasAcknowledgement: x.bias_acknowledgement });
  assert.equal(d.ok, true, JSON.stringify(d));
  r.copy({ draft: d.draftId, viewer: V("alice") });   // a first read creates the empty tables its reads use (local-facts)
  const before = w.snapshot();
  const c = r.copy({ draft: d.draftId, viewer: V("alice") });
  assert.equal(c.gates, "refused", JSON.stringify(c.missing));
  assert.deepEqual([c.missing[0].reason, c.missing[0].field], ["BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD", "bias_acknowledgement"]);
  assert.deepEqual(w.snapshot(), before, "the dry run is rolled back");
  /* control: with all four fresh the gate passes and missing is empty */
  r.act({ act: "draft", author: "alice", draft: d.draftId, biasAcknowledgement: FRESH.biasAcknowledgement });
  const ok = r.copy({ draft: d.draftId, viewer: V("alice") });
  assert.deepEqual([ok.gates, ok.missing], ["passed", []], JSON.stringify(ok.missing));
});

test("notice publication:229 (R5, R39): after a real commit that records the passage columns, a new draft of the case stands at the next edition and begins from edition 1's findings and scope", () => {
  const { w, A, r } = setup();
  const x = published(w, A);
  const row = w.row(`SELECT scope, ungraded_state, typed_state FROM published_cases WHERE case_id=? AND edition=1`, x.caseId);
  assert.notEqual(row.ungraded_state, undefined, "publication's PR 229 columns are present");
  assert.equal(row.ungraded_state, "stated");
  const d = r.act({ act: "draft", author: "alice", project: A, caseId: x.caseId });
  assert.deepEqual([d.ok, d.caseId, d.edition], [true, x.caseId, 2], JSON.stringify(d));
  const c = r.copy({ draft: d.draftId, viewer: V("alice") });
  assert.deepEqual(c.findings.map((f) => f.target), [Q]);
  assert.equal(c.authored.scope, row.scope);
  /* control: the case's own rows are as they were */
  assert.equal(w.count("published_cases"), 1);
});
