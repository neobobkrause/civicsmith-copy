/* publication — R30 (D-246; BIO_Publication_v0_1.md §3 rule 16): a published rendering is verified by `pixels_sha256` over
   its normalised samples, taken before any container is built, and the file's own SHA-256 is recorded beside it,
   labelled informative. Driven at the module's interface: the edition is the real commit (`signFinding` →
   `commitEdition`), the case's container the real `recordCaseManifest`, and the verification `renderingsByPixels`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, sha, NOW } from "./fixture.mjs";

const F = "INQ-2026-0001";
const CASE = "CASE-2026-0001";
const PX = sha("the page's normalised samples");
/* the same page rendered on two runtimes: the same pixels in different PNG bytes */
const WORKERD = sha("png bytes, workerd's deflate");
const NODE = sha("png bytes, node's deflate");

function base() {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc("INFO-2026-0001-minutes");
  w.inquiry(F, { legs: [{ target: "INFO-2026-0001-minutes" }] });
  const roles = [{ target: F, version_sha: w.head(F) }];
  return { w, proj, roles };
}
const bundlePart = (w) => ({ sha256: w.head(F), path: "bundle.md", kind: "bundle", bytes: 10 });

test("R30 a published rendering carries pixels_sha256 as its verifying value and its file hash beside it, labelled informative; a reader's pixel hash verifies it whatever file bytes their copy has", () => {
  const { w } = base();
  const r = w.signFinding(F, { shas: [bundlePart(w),
    { sha256: WORKERD, path: "renderings/page-1.png", kind: "rendering", bytes: 129366, pixels_sha256: PX }] });
  assert.equal(r.ok, true);
  assert.deepEqual(w.row(`SELECT sha256, kind, pixels_sha256 FROM published_shas WHERE path='renderings/page-1.png'`),
                   { sha256: WORKERD, kind: "rendering", pixels_sha256: PX });
  assert.equal(w.row(`SELECT pixels_sha256 FROM published_shas WHERE path='bundle.md'`).pixels_sha256, null, "only a rendering carries one");
  const parts = JSON.parse(w.row(`SELECT parts FROM published_bundles WHERE bundle_id=?`, F).parts);
  assert.deepEqual(parts.find((p) => p.kind === "rendering"),
                   { path: "renderings/page-1.png", sha256: WORKERD, kind: "rendering", bytes: 129366,
                     pixels_sha256: PX, verified_by: "pixels_sha256", sha256_role: "informative" });
  assert.deepEqual(Object.keys(parts.find((p) => p.kind === "bundle")).sort(), ["bytes", "kind", "path", "sha256"]);
  /* a copy rendered on node has other file bytes (NODE) and the same pixels: the pixel hash verifies it */
  assert.notEqual(NODE, WORKERD);
  const v = w.p.renderingsByPixels(PX.toUpperCase());
  assert.deepEqual(v, { ok: true, pixels_sha256: PX, renderings: [{ bundle_id: F, path: "renderings/page-1.png",
    published: NOW, pixels_sha256: PX, sha256: WORKERD, sha256_role: "informative" }] });
  assert.deepEqual(w.p.renderingsByPixels(sha("other pixels")), { ok: true, pixels_sha256: sha("other pixels"), renderings: [] });
  for (const bad of [null, "", "abc", 7, `${PX}0`]) assert.deepEqual(w.p.renderingsByPixels(bad), { ok: false, reason: "MALFORMED" });
});

test("R30 a rendering without its pixel hash is never published: the commit is MALFORMED and writes nothing", () => {
  for (const pixels of [undefined, null, "", "zz", PX.toUpperCase()]) {
    const { w } = base();
    const r = w.signFinding(F, { shas: [bundlePart(w),
      { sha256: WORKERD, path: "renderings/page-1.png", kind: "rendering", bytes: 129366, pixels_sha256: pixels }] });
    assert.deepEqual([r.ok, r.reason], [false, "MALFORMED"], String(pixels));
    assert.equal(w.count("published_bundles"), 0);
    assert.equal(w.count("published_shas"), 0);
  }
});

test("R30 the container's manifest states a rendering by the pixel hash taken before it was built: a rendering file without one is MALFORMED and nothing is recorded; with one it is registered with it", () => {
  const { w, proj, roles } = base();
  w.prepare(CASE, 1, { project: proj, roles });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" })) }).ok, true);
  assert.equal(w.signFinding(F).ok, true);
  const file = { path: `${F}/renderings/page-1.png`, sha256: NODE, kind: "rendering", bytes: 132691 };
  const before = w.count("published_shas");
  const bare = w.p.recordCaseManifest({ caseId: CASE, edition: 1, manifest: { files: [file] }, manifestSha: sha("manifest"), bytes: 5 });
  assert.deepEqual([bare.reason, bare.field], ["MALFORMED", "pixels_sha256"]);
  assert.equal(w.count("published_shas"), before);
  assert.equal(w.row(`SELECT manifest_sha FROM published_cases WHERE case_id=?`, CASE).manifest_sha, null);
  const ok = w.p.recordCaseManifest({ caseId: CASE, edition: 1, manifest: { files: [{ ...file, pixels_sha256: PX }] },
                                      manifestSha: sha("manifest"), bytes: 5 });
  assert.equal(ok.ok, true);
  assert.deepEqual(w.p.renderingsByPixels(PX).renderings.map((r) => [r.bundle_id, r.path, r.sha256, r.sha256_role]),
                   [[CASE, `${F}/renderings/page-1.png`, NODE, "informative"]]);
});
