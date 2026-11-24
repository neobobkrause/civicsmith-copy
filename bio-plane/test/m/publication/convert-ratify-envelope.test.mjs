/* publication — converted from `test/ratify-envelope.test.mjs` (REC-53), publication's share: "R15 a
   `recordcasemanifest` silence answering its op, never `MANIFEST_NOT_RECORDED`". The old suite, kept by K619, was deleted in T20.
   R15 as now worded keeps only the store half here: `recordCaseManifest` records a case edition's manifest once
   (`MALFORMED`, `NO_SUCH_CASE_EDITION`, `MANIFEST_EXISTS`) and is reached through its op. The silence itself (a store
   that never answered read as `STORE_DID_NOT_ANSWER`, never `MANIFEST_NOT_RECORDED`) and "no put" (the published
   bucket written only on an answered `ok`) live in `assembleCaseContainer`, which is `public-read` R6's since K651, so
   they are that module's to prove. What is proved here, at publication's interface: the op answers every body with an
   object naming its own reason (so the Worker's `rec || {reason: "MANIFEST_NOT_RECORDED"}` fallback is never reached
   through an answer of this module), no answer is ever `MANIFEST_NOT_RECORDED`, a refusal writes nothing, and a retry
   writes nothing. `services.test.mjs`' R15 test holds the values recorded; this extends it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world } from "./fixture.mjs";

const F = "INQ-2026-0001", CASE = "CASE-2026-0001", UNSIGNED = "CASE-2026-0002";
const SHA = "1".repeat(64), OTHER = "2".repeat(64);
const REFUSALS = ["MALFORMED", "NO_SUCH_CASE_EDITION", "MANIFEST_EXISTS"];

/* CASE edition 1 signed (a published case edition); CASE-2026-0002 edition 1 prepared and never signed. */
function signed() {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const roles = [{ target: F, version_sha: w.head(F) }];
  w.prepare(CASE, 1, { project: proj, roles });
  assert.equal(w.signCase(CASE, 1, { project: proj,
    roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" })) }).ok, true);
  w.prepare(UNSIGNED, 1, { project: proj, roles });
  return w;
}
const body = (over = {}) => ({ caseId: CASE, edition: 1, manifest: { format: "bio-case-container/6", case: CASE },
                               manifestSha: SHA, bytes: 42, ...over });
const without = (k) => { const b = body(); delete b[k]; return b; };

/* Every body the op can be handed that R15 refuses, with the refusal it names. */
const MALFORMED_BODIES = [null, undefined, {}, without("caseId"), without("edition"), without("manifest"),
  without("manifestSha"), body({ caseId: "" }), body({ edition: "x" }), body({ edition: 1.5 }),
  body({ manifest: null }), body({ manifest: "" }), body({ manifestSha: "" }), body({ manifestSha: null }),
  body({ edition: 0 }), body({ edition: null }), body({ edition: -1 }),
  /* found by this convert and fixed in this job: a hash that is not a SHA-256, and odd-typed values, are MALFORMED (they
     were recorded, or threw) */
  body({ manifestSha: "not-a-sha" }), body({ manifestSha: 7 }), body({ manifestSha: {} }), body({ manifestSha: "A".repeat(64) }),
  body({ manifestSha: SHA + "0" }), body({ caseId: [CASE] }), body({ caseId: 7 }), body({ bytes: {} }), body({ bytes: -1 }),
  body({ bytes: 1.5 }), body({ bytes: "42" })];
const NO_SUCH_BODIES = [body({ caseId: "CASE-NONE" }), body({ edition: 2 }), body({ caseId: UNSIGNED })];

test("R15 recordcasemanifest answers its op on every refused body: an object naming MALFORMED or NO_SUCH_CASE_EDITION, never MANIFEST_NOT_RECORDED, and every table untouched", () => {
  const w = signed();
  const before = w.snapshot();
  const answered = [];
  for (const [bodies, reason] of [[MALFORMED_BODIES, "MALFORMED"], [NO_SUCH_BODIES, "NO_SUCH_CASE_EDITION"]])
    for (const b of bodies) {
      const r = w.op("recordcasemanifest", {}, b);
      const at = JSON.stringify(b);
      assert.ok(r && typeof r === "object", `${at}: the op answers an object, so the Worker's fallback is never reached`);
      assert.deepEqual([r.ok, r.reason], [false, reason], at);
      assert.notEqual(r.reason, "MANIFEST_NOT_RECORDED", at);
      assert.deepEqual(w.snapshot(), before, `${at}: a refusal writes nothing`);
      answered.push(r);
    }
  assert.equal(answered.length, MALFORMED_BODIES.length + NO_SUCH_BODIES.length);
  /* an unsigned case edition is no case edition: its document is held, and no manifest is recorded for it */
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM case_documents WHERE case_id=?`, UNSIGNED).n, 1);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_cases WHERE case_id=?`, UNSIGNED).n, 0);
  assert.deepEqual([w.row(`SELECT manifest_sha, manifest FROM published_cases WHERE case_id=?`, CASE)],
                   [{ manifest_sha: null, manifest: null }]);
});

test("R15 recorded once: the first record writes only its case row and its hash, a retry of the same manifest answers ok and writes nothing, another hash is MANIFEST_EXISTS with nothing written; no answer is ever MANIFEST_NOT_RECORDED", () => {
  const w = signed();
  const answers = [];
  const rec = (b) => { const r = w.op("recordcasemanifest", {}, b); answers.push(r); return r; };
  const before = w.snapshot();
  const first = rec(body());
  assert.deepEqual(first, { ok: true, caseId: CASE, edition: 1, manifest_sha: SHA });
  const after = w.snapshot();
  const moved = Object.keys(after).filter((t) => after[t] !== before[t]).sort();
  assert.deepEqual(moved, ["published_cases", "published_shas"], "only the case row and the manifest's hash are written");
  assert.deepEqual(w.rows(`SELECT sha256, bundle_id, path, kind, bytes FROM published_shas WHERE kind='manifest'`),
                   [{ sha256: SHA, bundle_id: CASE, path: "MANIFEST.json", kind: "manifest", bytes: 42 }]);
  /* a retry (the Worker's re-ratification assembling the same container) answers ok, existed, and writes nothing, even
     one carrying another manifest under the recorded hash: the manifest held is the one that hash was recorded for */
  const retried = { ...first, existed: true };
  for (const retry of [body(), body({ edition: "1" }), body({ bytes: 42 }), body({ bytes: null }),
                       body({ manifest: { forged: true } })]) {
    assert.deepEqual(rec(retry), retried, JSON.stringify(retry));
    assert.deepEqual(w.snapshot(), after, "a retry writes nothing");
  }
  assert.deepEqual(JSON.parse(w.row(`SELECT manifest FROM published_cases WHERE case_id=?`, CASE).manifest), body().manifest);
  /* another hash under the same edition: refused, naming the one it holds, and nothing moves */
  const other = rec(body({ manifestSha: OTHER, manifest: { format: "bio-case-container/6", case: CASE, other: true } }));
  assert.deepEqual([other.ok, other.reason, other.caseId, other.edition, other.manifest_sha], [false, "MANIFEST_EXISTS", CASE, 1, SHA]);
  assert.equal(typeof other.detail, "string");
  assert.deepEqual(w.snapshot(), after, "MANIFEST_EXISTS writes nothing");
  /* the recorded hash still answers after the refusal, and the refused one never became published */
  assert.deepEqual(rec(body()), retried);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_shas WHERE sha256=?`, OTHER).n, 0);
  assert.equal(w.p.caseEditionState(CASE, 1).manifest_sha, SHA);
  /* the refusals after a record, too, answer by name and write nothing */
  for (const b of [...MALFORMED_BODIES, ...NO_SUCH_BODIES]) {
    const r = rec(b);
    assert.ok(r && typeof r === "object" && REFUSALS.includes(r.reason), JSON.stringify(b));
  }
  assert.deepEqual(w.snapshot(), after);
  assert.ok(answers.length > 20);
  for (const r of answers) {
    assert.ok(r && typeof r === "object");
    assert.ok(r.ok === true || REFUSALS.includes(r.reason), JSON.stringify(r));
    assert.notEqual(r.reason, "MANIFEST_NOT_RECORDED");
  }
});
