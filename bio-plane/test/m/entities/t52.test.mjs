/* entities T52: R67, a document's prose is read for followed names; testimony of a whole document. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";

/* A free-prose capture: a reading that recorded no reference, with its text units, through extraction's writer. */
function prose(w, bundleId, captureSha, texts) {
  w.bundle(bundleId);
  return w.x.writeReading({ bundleId, captureSha, composed: true,
    reading: { content_type: "text/plain", reader_version: 1, found: true, at: "2026-09-27T00:00:00Z", entities: [] },
    textUnits: texts.map((text, page) => ({ extent: { kind: "pdf-page", page }, ref: `p. ${page + 1}`, text })) });
}
const person = (e, label, aliases = []) => e.createEntity({ note: "a subject the test registers", kind: "person", label, aliases }).entity_id;
const company = (e, label, aliases = []) => e.createEntity({ note: "a subject the test registers", kind: "institution", sector: "company", label, aliases }).entity_id;

test("R67 resolve without ref reads a reference-less document's prose: each followed name found is a grade-C candidate in unresolved, nothing is resolved; testify without ref records it", () => {
  const w = world(), { e } = w;
  const pat = person(e, "Maria Alvarez", ["M. Alvarez"]);
  const co = company(e, "Harbor Freight Co");
  const absent = person(e, "Nobody Named");
  prose(w, "INFO-1", sha("memo"), ["Memo to file. Councilmember MARÍA ALVAREZ met with", "the staff of harbor  freight co. about the lease."]);
  const r = e.resolve({ captureSha: sha("memo"), resolvedBy: MACHINE });
  assert.deepEqual([r.ok, r.resolved_count, r.references], [true, 0, 0]);
  assert.deepEqual(r.unresolved, [
    { kind: "name", key: "Maria Alvarez", label: "Maria Alvarez", entityId: pat, grade: "C", needs_confirmation: true },
    { kind: "name", key: "Harbor Freight Co", label: "Harbor Freight Co", entityId: co, grade: "C", needs_confirmation: true },
  ]);
  assert.ok(!r.unresolved.some((u) => u.entityId === absent));
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM resolutions`)[0].n, 0, "a candidate is never a resolution");
  for (const [id, who] of [[pat, "Maria"], [co, "Harbor"]]) {
    const t = e.testify({ captureSha: sha("memo"), entityId: id, basis: `the memo names ${who}`, resolvedBy: "member:ann" });
    assert.deepEqual([t.ok, t.grade, t.established, t.resolved_by], [true, "D", false, "member:ann"]);
  }
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM resolutions WHERE grade='D'`)[0].n, 2);
  assert.deepEqual(e.resolve({ captureSha: sha("memo") }).unresolved, [], "an entity already held on the capture is not offered again");
});

test("R67 a standing alias is read; a name that is part of another word, or a withdrawn alias, is not found", () => {
  const w = world(), { e } = w;
  const ann = person(e, "Ann Lee", ["Annie Lee"]);
  const gone = person(e, "Bo Chen", ["Bobby Chen"]);
  e.withdrawAlias({ entityId: gone, alias: "Bobby Chen", reason: "wrong", withdrawnBy: MACHINE });
  prose(w, "INFO-1", sha("p1"), ["Planned Annie Lee visit; Bobby Chen unmentioned; Dann Leesburg appears; Bo Chens too"]);
  const r = e.resolve({ captureSha: sha("p1") });
  assert.deepEqual(r.unresolved.map((u) => [u.entityId, u.key]), [[ann, "Annie Lee"]]);
  prose(w, "INFO-2", sha("p2"), ["Ann Leesburg and Dann Lee"]);
  assert.deepEqual(e.resolve({ captureSha: sha("p2") }).unresolved, []);
});

test("R67 control: a document with a recognised reference resolves as R9 states and its prose is not read; a single-reference resolve reads no prose", () => {
  const w = world(), { e } = w;
  const ord = e.createEntity({ note: "a subject the test registers", kind: "ordinance", label: "Ord One", aliases: ["ord:26-1"] }).entity_id;
  const pat = person(e, "Maria Alvarez");
  w.read("INFO-1", sha("ref"), [{ kind: "ORD", key: "26-1", label: "x" }]);
  w.x.writeReading({ bundleId: "INFO-1", captureSha: sha("ref"), composed: true,
    reading: { content_type: "text/plain", reader_version: 1, found: true, at: "2026-09-27T00:00:00Z", entities: [{ kind: "ORD", key: "26-1", label: "x" }] },
    textUnits: [{ extent: { kind: "pdf-page", page: 0 }, ref: "p. 1", text: "Maria Alvarez signed ORD 26-1" }] });
  const r = e.resolve({ captureSha: sha("ref") });
  assert.deepEqual(r.resolved.map((m) => [m.entity_id, m.grade]), [[ord, "A"]]);
  assert.ok(!r.unresolved.some((u) => u.kind === "name"), "prose is not read when a reference resolved");
  prose(w, "INFO-2", sha("one"), ["Maria Alvarez"]);
  assert.deepEqual(e.resolve({ captureSha: sha("one"), ref: "x:1" }).reason, "NO_SUCH_REFERENCE");
});

test("R67 testify without ref: the document must be one the record holds (NO_SUCH_REFERENCE), the entity must exist, a basis is still required; an empty ref is still NO_REF", () => {
  const w = world(), { e } = w;
  const pat = person(e, "Maria Alvarez");
  prose(w, "INFO-1", sha("held"), ["Maria Alvarez"]);
  const base = { captureSha: sha("held"), entityId: pat, basis: "b", resolvedBy: "member:ann" };
  assert.equal(e.testify({ ...base, ref: "" }).reason, "NO_REF");
  assert.equal(e.testify({ ...base, basis: " " }).reason, "NO_BASIS");
  assert.equal(e.testify({ ...base, captureSha: sha("never") }).reason, "NO_SUCH_REFERENCE");
  assert.equal(e.testify({ ...base, entityId: "ENT-2026-0404" }).reason, "NO_SUCH_ENTITY");
  assert.equal(e.testify(base).ok, true);
  assert.equal(e.testify({ ...base, basis: "again" }).kept, true);
  assert.equal(e.resolutionsFor({ captureSha: sha("held") }).names[0].entity_id, pat);
});
