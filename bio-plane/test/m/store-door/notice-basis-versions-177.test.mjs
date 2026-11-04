/* Provider notice basis-versions:177 (PR 177; basis-versions R60): `basisVersions` grades a version's leg on a member's
   typing as the record grades it, adding `graded_by`. The door fences `basisversions` as a project-naming read (R2,
   `PROJECT_NAMING_READS`) and answers its route's answer as given (R1). Confirmed with no code change: through the door,
   over basis-versions' own map on inquiry's real world (the providers' fixtures, K4990), the read answers what
   `basisVersions` answers, its record-graded legs whole. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { inqMd, block } from "../basis-versions/fixture.mjs";
import { basisVersionsOf, basisVersionsOps } from "../../../src/basis-versions/index.mjs";
import { TYPED_UNCHECKED_GRADE } from "../../../src/textchain.mjs";
import { dispatch, PROJECT_NAMING_READS } from "../../../src/store-door/dispatch.mjs";

const AT = "2026-09-27T00:00:00Z", Q = "INQ-2026-5391-typed", DOC = "INFO-2026-5391-typed";

test("notice basis-versions:177 (store-door R1, R2; basis-versions R60): `basisversions` through the door answers basis-versions' own answer — a typed leg graded by the record (`graded_by: record`, the unchecked typing's grade) — unchanged (control: the read is still fenced as naming a project)", async () => {
  assert.deepEqual(PROJECT_NAMING_READS.basisversions, ["id", "project"]);
  const w = world(); w.member("ruth"); w.member("alice");
  const bv = basisVersionsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  bv.migrate();
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const tx = w.content.transcribe({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.", transcriber: "ruth", viewer: V("ruth"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  const lines = block({ refs: [DOC],
    versions: [{ name: "typed", description: "the reading on the typing", relationship: "and", state: "suggested", hidden: false, derived_from: null, author: "member:alice", at: AT }],
    grounds: [{ version: "typed", ground: "main", asserted_by: "member:alice", at: AT }],
    legs: [{ version: "typed", target: DOC, role: "supports", ground: "main", content_id: tx.content_id }] });
  const p = w.promote(Q, inqMd(Q, lines));
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 600));

  const store = { routes: (url, body) => basisVersionsOps(bv, url, body), membership: () => w.membership };
  const res = await dispatch(new Request(`http://do/basisversions?id=${Q}&viewer=admin`), store);
  const got = await res.json();
  assert.equal(got.ok, true, JSON.stringify(got).slice(0, 400));
  const direct = bv.basisVersions({ id: Q, viewer: "admin" });
  assert.deepEqual(got.result, JSON.parse(JSON.stringify(direct)));
  const [leg] = got.result.versions[0].legs;
  assert.deepEqual([leg.content_id, leg.grade, leg.graded_by], [tx.content_id, TYPED_UNCHECKED_GRADE, "record"]);
});
