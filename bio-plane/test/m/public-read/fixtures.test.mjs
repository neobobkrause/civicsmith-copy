/* public-read's published fixtures (fixtures.mjs): each export is checked against the real answer the module gives, so a user
   module that takes its value from here takes the real one. R34 (the one identity source's registration refusals), R6 and
   R23 (the case file's build refusals, G54). Each claim has its negative control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupIdentityRegistrar, assembleCaseContainerRefusal, publishedCaseSeveralCases, docketPublicOfCase,
         publishedCaseWithEvidence } from "./fixtures.mjs";

test("R34 groupIdentityRegistrar answers the real refusals: a malformed registration is PROVIDER_MALFORMED, the first stands, and a second is PROVIDER_DECLARED with the first's group still held", () => {
  const out = groupIdentityRegistrar();
  assert.deepEqual([out.malformed.ok, out.malformed.reason], [false, "PROVIDER_MALFORMED"]);
  assert.equal(typeof out.malformed.detail, "string");
  assert.deepEqual(out.first, { ok: true });
  assert.deepEqual([out.declared.ok, out.declared.reason], [false, "PROVIDER_DECLARED"]);
  assert.equal(out.group, "parks-group", "the first registration stands");
  /* negative control: a fresh instance takes the same source a first time, so the refusal above is the real second registration */
  assert.deepEqual(groupIdentityRegistrar().first, { ok: true });
});

test("R6 R23 assembleCaseContainerRefusal answers the real build refusals: MATERIAL_MISSING at materials, BUCKET_FAILED at bucket_put, and CASE_FILE_NOT_ASSEMBLED naming the finding whose bytes are absent", async () => {
  const out = await assembleCaseContainerRefusal();
  assert.deepEqual([out.materialMissing.ok, out.materialMissing.code, out.materialMissing.step], [false, "MATERIAL_MISSING", "materials"]);
  assert.deepEqual([out.bucketFailed.ok, out.bucketFailed.code, out.bucketFailed.step], [false, "BUCKET_FAILED", "bucket_put"]);
  assert.deepEqual([out.notAssembled.ok, out.notAssembled.reason, out.notAssembled.finding], [false, "CASE_FILE_NOT_ASSEMBLED", "INQ-2026-0001"]);
  /* negative control: a refusal is not a built case file, so none of the three carries a manifest */
  for (const r of [out.materialMissing, out.bucketFailed, out.notAssembled]) assert.equal(r.manifest_sha, undefined);
});

test("R39 publishedCaseSeveralCases answers the real publishedcase: by the finding's id alone FINDING_IN_SEVERAL_CASES naming both cases, and by caseId that case's edition 1", async () => {
  const out = await publishedCaseSeveralCases();
  assert.deepEqual([out.byFinding.ok, out.byFinding.reason, out.byFinding.check], [false, "FINDING_IN_SEVERAL_CASES", "C-44.2"]);
  assert.deepEqual([...out.byFinding.cases].sort(), ["CASE-2026-0101", "CASE-2026-0102"]);
  assert.deepEqual([out.byCase.ok, out.byCase.caseId, out.byCase.edition], [true, "CASE-2026-0101", 1]);
  /* negative control: asked with a caseId the answer is that case's edition, not a refusal, so the refusal is about the id alone */
  assert.equal(out.byCase.reason, undefined);
  assert.equal(Object.hasOwn(out.byCase, "cases"), false);
});

test("R21 docketPublicOfCase answers the real docket of CASE: its one public entry is the posted withdrawal, and the answer carries the docket's feed", async () => {
  const out = await docketPublicOfCase();
  assert.deepEqual([out.ok, out.case, out.entries.length], [true, "CASE-2026-0101", 1]);
  assert.equal(out.entries[0].fields.kind, "withdrawal");
  assert.equal(out.feed, "op=docketfeed&case=CASE-2026-0101");
  /* negative control: the entry carries the reason posted, so the answer is this docket's, not an empty or another case's */
  assert.equal(out.entries[0].fields.reason, "We no longer stand behind edition 1.");
  assert.notEqual(out.last_entry, null);
});

test("F1 R3 R53 publishedCaseWithEvidence answers the real publishedcase: its evidence is materials.materials, two rows each with entry {name, locator, fingerprint}, equal to the store's publishedcase for the same edition; an edition with no material answers materials.materials empty", async () => {
  const out = await publishedCaseWithEvidence();
  assert.equal(out.answer.ok, true);
  assert.equal(Array.isArray(out.answer.materials), false, "the evidence is a wrapper, not an array");
  assert.deepEqual(Object.keys(out.answer.materials).sort(), ["attestations", "materials"]);
  const rows = out.answer.materials.materials;
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.deepEqual(Object.keys(r.entry).sort(), ["fingerprint", "locator", "name"]);
    assert.deepEqual(r.entry, { name: r.title, locator: r.origin, fingerprint: r.sha }, "the entry is read from the signed row");
    assert.equal(r.included, true, "its bytes open by its sha");
  }
  assert.notDeepEqual(rows[0].entry, rows[1].entry);
  assert.deepEqual(rows.map((r) => r.entry), out.store.materials.materials.map((r) => r.entry),
                   "the Worker's answer and the store's are one");
  /* negative control: an edition listing no material answers the same wrapper, its rows empty */
  assert.equal(out.none.ok, true);
  assert.deepEqual(out.none.materials.materials, []);
});
