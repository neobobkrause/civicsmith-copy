/* publication — G47t (K4677): a kind `attestation` token is registered with the capture it stamps (`published_shas.
   capture_sha`), cleared to NULL when a second capture names it, never filled where NULL. Driven through the real commit
   (`signCase`); `case-carriage` is the real module with `holdMaterials` answering the `files` the test names until
   CASE-CARRIAGE #15 merges, and the seam test over the real carriage stays red by name until then. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, V, NOW, sha } from "./fixture.mjs";
import { migratePublication } from "../../../src/publication/schema.mjs";

const F = "INQ-2026-0001", DOC = "INFO-2026-0001-minutes", CASE = "CASE-2026-0001";
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));
const A = sha("capture A"), B = sha("capture B");
const tok = (name) => sha(`token ${name}`);

function base() {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc(DOC);
  w.inquiry(F, { legs: [{ target: DOC }] });
  const roles = [{ target: F, version_sha: w.head(F) }];
  return { w, proj, roles };
}
/* case-carriage whose `holdMaterials` answers `files` as the test names them; every other door is the real module's */
function carrying(w, filesFor) {
  const real = w.realCarriage ??= w.p.caseCarriage;
  const stand = new Proxy(real, { get: (t, k) => (k === "holdMaterials"
    ? (...a) => ({ files: filesFor(), materials: [], unheld: [] })
    : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  Object.defineProperty(w.p, "caseCarriage", { value: stand, configurable: true });
}
const att = (token, capture_sha, ref = DOC) => ({ sha256: token, ref, path: `materials/${token}`, kind: "attestation", bytes: 12, ...(capture_sha === undefined ? {} : { capture_sha }) });
const doc = (s, ref = DOC) => ({ sha256: s, ref, path: `materials/${s}`, kind: "document", bytes: 20 });
const commit = (w, proj, roles, edition, files) => {
  carrying(w, () => files);
  w.prepare(CASE, edition, { project: proj, roles });
  const r = w.signCase(CASE, edition, { project: proj, roster: roster(roles) });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
};
const capOf = (w, token) => w.rows(`SELECT capture_sha FROM published_shas WHERE sha256=? AND kind='attestation'`, token).map((r) => r.capture_sha);

test("R57 R40 a k = 2 case (two captures of one ref, each with its own token): each attestation row holds its own capture's sha, every other row null", () => {
  const { w, proj, roles } = base();
  commit(w, proj, roles, 1, [doc(A), doc(B), att(tok("a"), A), att(tok("b"), B), att(tok("both"), null)]);
  assert.deepEqual(capOf(w, tok("a")), [A]);
  assert.deepEqual(capOf(w, tok("b")), [B]);
  assert.deepEqual(capOf(w, tok("both")), [null], "a token the carriage says is shared stores null");
  for (const s of [A, B]) assert.deepEqual(w.rows(`SELECT capture_sha FROM published_shas WHERE sha256=? AND kind='document'`, s), [{ capture_sha: null }]);
  assert.deepEqual(w.rows(`SELECT capture_sha FROM published_shas WHERE kind NOT IN ('attestation') AND capture_sha IS NOT NULL`), [],
                   "no other kind carries a capture");
});

test("R57 R40 a later edition: a token named by one capture keeps it; a token a different capture names becomes NULL (shared); the same capture again changes nothing; a NULL is never filled", () => {
  const { w, proj, roles } = base();
  commit(w, proj, roles, 1, [att(tok("a"), A), att(tok("s"), A), att(tok("once"), A)]);
  commit(w, proj, roles, 2, [att(tok("a"), A), att(tok("s"), B), att(tok("b"), B)]);
  assert.deepEqual(capOf(w, tok("a")), [A], "the same capture again changes nothing");
  assert.deepEqual(capOf(w, tok("s")), [null], "A then B: shared");
  assert.deepEqual(capOf(w, tok("b")), [B]);
  assert.deepEqual(capOf(w, tok("once")), [A], "not named again: untouched");
  commit(w, proj, roles, 3, [att(tok("s"), A), att(tok("s2"), undefined)]);
  assert.deepEqual(capOf(w, tok("s")), [null], "a stored NULL is never rewritten to a value");
  assert.deepEqual(capOf(w, tok("s2")), [null], "an entry without the key stores null");
});

test("R57 R40 control: a one-capture-per-source case registers every row's six old columns as before, and the public registry's shas: read is unchanged", () => {
  const { w, proj, roles } = base();
  commit(w, proj, roles, 1, [doc(A), att(tok("a"), A)]);
  const six = (kind) => w.rows(`SELECT sha256, bundle_id, path, kind, bytes, published FROM published_shas WHERE kind=?`, kind);
  assert.deepEqual(six("document"), [{ sha256: A, bundle_id: DOC, path: `materials/${A}`, kind: "document", bytes: 20, published: NOW }]);
  assert.deepEqual(six("attestation"), [{ sha256: tok("a"), bundle_id: DOC, path: `materials/${tok("a")}`, kind: "attestation", bytes: 12, published: NOW }]);
  assert.deepEqual(w.rows(`SELECT sha256, bundle_id, path, kind, bytes, published FROM published_shas WHERE kind='case_document'`).length, 1);
});

test("R40 R-OLD an old six-column store is migrated: its rows keep the six columns and read capture_sha NULL, a second boot changes nothing, and a later commit never fills the NULL", () => {
  const { w, proj, roles } = base();
  const sql = w.st.sql;
  sql.exec(`DROP TABLE published_shas`);
  sql.exec(`CREATE TABLE published_shas (sha256 TEXT NOT NULL, bundle_id TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL,
            bytes INTEGER, published TEXT NOT NULL, PRIMARY KEY (sha256, bundle_id, path))`);
  sql.exec(`INSERT INTO published_shas VALUES (?,?,?,?,?,?)`, tok("old"), DOC, `materials/${tok("old")}`, "attestation", 7, "2026-01-01T00:00:00Z");
  migratePublication(sql);
  const after = w.rows(`SELECT * FROM published_shas WHERE sha256=?`, tok("old"));
  assert.deepEqual(after, [{ sha256: tok("old"), bundle_id: DOC, path: `materials/${tok("old")}`, kind: "attestation", bytes: 7,
                             published: "2026-01-01T00:00:00Z", capture_sha: null, pixels_sha256: null }]);
  migratePublication(sql);
  assert.deepEqual(w.rows(`SELECT * FROM published_shas WHERE sha256=?`, tok("old")), after, "a second boot changes nothing");
  commit(w, proj, roles, 1, [att(tok("old"), A)]);
  assert.deepEqual(capOf(w, tok("old")), [null], "a later commit never rewrites the null to a value");
});

test("R31 R40 published_shas is declared as before: exempt from purge, admin-only export, no expunge, stored, seen as its bundle", () => {
  const { w } = base();
  const d = w.record.declaredTables().find((x) => x.name === "published_shas");
  assert.deepEqual([d.module, d.purge, d.export, d.expunge, d.derive, d.sight], ["publication", "exempt", "admin-only", "none", "stored", "bundle"]);
});

test("R57 R40 seam, over the real case-carriage: a stamped capture's token is registered with the capture it stamps (red by name until CASE-CARRIAGE #15 merges)", () => {
  const { w, proj, roles } = base();
  const id = "INFO-2026-0003-stamped", body = `the text of ${id}`, token = "TSA-TOKEN-BYTES";
  const prov = { documents: [{ file: `snapshots/${id}.txt`, locator: `https://example.org/${id}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: sha(body), encoding: "utf8", bytes: Buffer.byteLength(body) },
    origin: { kind: "named_request" }, timestamp: { service: "tsa.example", token_file: "attestations/stamp.tsr" } }] };
  const md = w.text(DOC).replace(new RegExp(DOC, "g"), id);
  const res = w.promotion.promote({ bundleId: id, base: null, snapKey: "k-stamped", author: V("alice"),
    files: [{ path: "bundle.md", text: md }, { path: `snapshots/${id}.txt`, text: body },
            { path: "attestations/stamp.tsr", text: token }, { path: "data/provenance.json", text: JSON.stringify(prov) }],
    meta: { object_type: "information" }, register: [{ sha256: sha(body), path: `snapshots/${id}.txt`, encoding: "utf8", bytes: Buffer.byteLength(body) }] });
  assert.equal(res.ok, true);
  assert.equal(w.prov.recordReceipt({ addressNorm: `example.org/${id}`, captureSha: sha(body), retrieved: NOW, via: "direct" }).recorded, true);
  w.prepare(CASE, 1, { project: proj, roles, materials: [{ ref: id, kind: "document", sha: sha(body), text_sha: null, included: true, rests_under: "load_bearing" }] });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster: roster(roles) }).ok, true);
  assert.deepEqual(capOf(w, sha(token)), [sha(body)]);
});
