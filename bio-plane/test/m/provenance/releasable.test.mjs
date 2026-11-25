/* provenance R81: the one helper that files a releasable bundle (`releasableBundle`), and the testimony filer that calls it.
   `ratification`'s `release` is a higher layer, so the entry requirements it asks (its R22: a well-formed `content_hash`,
   `data/dataset.json`, a file under `snapshots/`, a chain for each document) are read here off the filed bundle itself. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, infoMd, provDoc } from "./fixture.mjs";
import { releasableBundle } from "../../../src/provenance/index.mjs";
import { canonicalJson, parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const CHAIN = [{ who: "the publisher", asserts: "published these bytes", evidence: "retrieved and hashed", bound: false }];
const textOf = (r, path) => r.files.find((f) => f.path === path)?.text;

/* What `release` asks of a bundle's files, at the module's interface: the unmet entry requirements, by name. */
function missing(files) {
  const by = (p) => files.find((f) => f.path === p);
  const md = by("bundle.md");
  const ch = md && parseFrontmatter(md.text).data.content_hash;
  const out = [];
  if (!(typeof ch === "string" && /^sha256:[0-9a-f]{64}$/.test(ch))) out.push("content_hash");
  if (!by("data/dataset.json")) out.push("dataset");
  else if (ch !== `sha256:${sha(by("data/dataset.json").text)}`) out.push("content_hash is not the dataset's digest");
  if (!files.some((f) => f.path.startsWith("snapshots/"))) out.push("snapshots");
  const prov = by("data/provenance.json");
  const docs = prov ? JSON.parse(prov.text).documents : [];
  if (!docs.length || docs.some((d) => !Array.isArray(d.provenance_chain) || !d.provenance_chain.length)) out.push("chain");
  return out;
}

test("R81: the dataset is the canonical text of one row per whole document, and content_hash is its digest", () => {
  const text = "the bytes of a document";
  const doc = provDoc({ path: "snapshots/a.pdf", text }, { provenance_chain: CHAIN });
  const r = releasableBundle({ md: infoMd("INFO-2026-0001-a"), doc, locator: "https://example.org/a.pdf",
    snapshots: [{ path: "snapshots/a.pdf", blobSha: sha(text), sha256: sha(text), bytes: Buffer.byteLength(text) }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const expected = canonicalJson({ documents: [{ bytes: Buffer.byteLength(text), locator: "https://example.org/a.pdf", sha256: sha(text) }] });
  assert.equal(expected, `{"documents":[{"bytes":${Buffer.byteLength(text)},"locator":"https://example.org/a.pdf","sha256":"${sha(text)}"}]}`);
  assert.equal(textOf(r, "data/dataset.json"), expected, "byte-equal to the canonical text");
  assert.equal(r.dataset, expected);
  assert.equal(r.contentHash, `sha256:${sha(expected)}`);
  assert.equal(parseFrontmatter(textOf(r, "bundle.md")).data.content_hash, r.contentHash);
  assert.deepEqual(r.files.map((f) => f.path), ["bundle.md", "data/provenance.json", "data/dataset.json", "snapshots/a.pdf"]);
  assert.deepEqual(missing(r.files), []);
  const hashed = r.files.find((f) => f.path === "data/dataset.json");
  assert.deepEqual([hashed.sha256, hashed.bytes], [sha(expected), Buffer.byteLength(expected)]);
  /* A content_hash already in the front matter is replaced, never doubled. */
  const again = releasableBundle({ md: textOf(r, "bundle.md").replace(r.contentHash, "sha256:" + "0".repeat(64)), doc,
    locator: "https://example.org/a.pdf", snapshots: r.files.slice(3) });
  assert.equal(textOf(again, "bundle.md"), textOf(r, "bundle.md"));
});

test("R81: a pulled knock, an unpacked archive member and an upload each file a bundle `release` accepts", () => {
  for (const [method, origin] of [["acquire", { kind: "named_request" }], ["unpacked", { kind: "unpacked" }],
                                  ["uploaded", { kind: "upload" }], ["fetched", { kind: "doorbell" }]]) {
    const text = `bytes of the ${method} document`;
    const doc = provDoc({ path: `snapshots/${method}.bin`, text }, { origin, provenance_chain: CHAIN });
    doc.capture.method = method;
    const r = releasableBundle({ md: infoMd(`INFO-2026-0002-${method}`), doc,
      snapshots: [{ path: `snapshots/${method}.bin`, blobSha: sha(text), sha256: sha(text), bytes: Buffer.byteLength(text) }] });
    assert.equal(r.ok, true, method);
    assert.deepEqual(missing(r.files), [], method);
    assert.equal(JSON.parse(textOf(r, "data/dataset.json")).documents[0].locator, doc.locator, "the locator defaults to the document's");
  }
});

test("R81: it is pure and never throws; a document with no digest answers a refusal", () => {
  const snaps = [{ path: "snapshots/x", text: "x", bytes: 1, sha256: sha("x") }];
  const doc = provDoc({ path: "snapshots/x", text: "x" }, { provenance_chain: CHAIN });
  for (const [why, args, reason] of [
    ["no arguments", undefined, "NO_DOCUMENT_DIGEST"],
    ["a null document", { md: infoMd("INFO-2026-0003-a"), doc: null, snapshots: snaps }, "NO_DOCUMENT_DIGEST"],
    ["a malformed digest", { md: infoMd("INFO-2026-0003-a"), doc: { ...doc, capture: { ...doc.capture, sha256: "abc" } }, snapshots: snaps }, "NO_DOCUMENT_DIGEST"],
    ["no chain", { md: infoMd("INFO-2026-0003-a"), doc: { ...doc, provenance_chain: [] }, snapshots: snaps }, "NO_CHAIN"],
    ["no snapshot", { md: infoMd("INFO-2026-0003-a"), doc, snapshots: [] }, "NO_SNAPSHOT"],
    ["no front matter", { md: "no fence", doc, snapshots: snaps }, "NO_FRONT_MATTER"],
  ]) {
    const r = releasableBundle(args);
    assert.deepEqual([r.ok, r.reason, r.code, typeof r.detail], [false, reason, reason, "string"], why);
  }
  const input = { md: infoMd("INFO-2026-0003-a"), doc, snapshots: snaps };
  const before = JSON.stringify(input);
  assert.equal(releasableBundle(input).ok, true);
  assert.equal(JSON.stringify(input), before, "the input is not changed");
});

test("R81: a testimony is filed through the helper, with the dataset, its hash, the snapshot and the chain", () => {
  const w = world({ now: "2026-09-27T03:04:05.678Z" });
  const t = w.prov.testify({ words: "I saw it.", observedAt: "2026-09-20T18:05Z", author: V("ruth") });
  assert.equal(t.ok, true, JSON.stringify(t));
  const files = w.record.livePaths(t.bundle_id).map((path) => ({ path, text: w.record.readFile(t.bundle_id, path).text }));
  assert.deepEqual(missing(files), []);
  const ds = JSON.parse(files.find((f) => f.path === "data/dataset.json").text);
  assert.deepEqual(ds, { documents: [{ bytes: t.bytes, locator: ds.documents[0].locator, sha256: t.capture_sha }] });
  assert.equal(files.find((f) => f.path === "data/dataset.json").text, canonicalJson(ds), "canonical");
  assert.ok(files.some((f) => f.path === t.file && f.path.startsWith("snapshots/")));
});
