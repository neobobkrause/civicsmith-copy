/* odf-reader: the envelope facts shared by the three entries — meta.xml's
 * core properties, the manifest's embedded members, the Pictures/ images
 * (build/requirements/odf-reader.md R28–R30; R28 and R29 as read in the job
 * record's Q1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import { buildZip, members, pkg, withCd, metaXml, manifestXml, sha256, enc, OVER_BOUND } from "./pkg.mjs";

/** @typedef {import("../../../src/odf.mjs").Envelope} Envelope */
/** @typedef {import("./pkg.mjs").Flavour} Flavour */

const ENTRIES = { odt: odtEntry, ods: odsEntry, odp: odpEntry };
/** @type {Flavour[]} */
const FLAVOURS = ["odt", "ods", "odp"];
/** @param {{ evidentiary: Envelope }} s @param {string} kind */
const items = (s, kind) => s.evidentiary.items.filter((i) => i.kind === kind);
/** @param {{ evidentiary: Envelope }} s @param {string} part */
const stated = (s, part) => s.evidentiary.undetermined.filter((u) => u.part === part);
/** @param {string} name @param {string} data */
const intra = (name, data) => ({ partition: "intra", wrapper: linkWrapper.intra(sha256(enc(data))),
  target: { sha256: sha256(enc(data)), name, bytes: enc(data).length }, source: null });
/** @param {string} why @param {string} name */
const undet = (why, name) => ({ partition: "undetermined", wrapper: null, target: { why, name }, source: null });

/* ------------------------------------------------------------------ R28 */

test("R28 every part outside content.xml that is not read is stated in evidentiary.undetermined with the part and why, on every entry", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    // no meta.xml at all: the absence is said, never silent
    const none = await e.structure(pkg(f));
    assert.ok(none.ok);
    assert.equal(items(none, "core-properties").length, 0);
    assert.deepEqual(stated(none, "meta.xml").map(({ part, why }) => ({ part, why })), [{ part: "meta.xml", why: "part_absent" }]);
    const absent = stated(none, "meta.xml")[0];
    assert.ok(absent);
    assert.equal(typeof absent.detail, "string");
    // meta.xml present but unreadable, or unparseable
    const crc = await e.structure(buildZip(withCd(members(f, { meta: metaXml({ "dc:title": "t" }) }), "meta.xml", { crc: 1 })));
    assert.ok(crc.ok);
    assert.deepEqual(stated(crc, "meta.xml"), [{ part: "meta.xml", why: "crc_mismatch" }]);
    const junk = await e.structure(pkg(f, { meta: "<not-meta/>" }));
    assert.ok(junk.ok);
    assert.deepEqual(stated(junk, "meta.xml"), [{ part: "meta.xml", why: "core_properties_unparseable" }]);
    // the manifest unreadable or unparseable: stated, and notes say intra was not looked for
    const mcrc = await e.structure(buildZip(withCd(members(f), "META-INF/manifest.xml", { crc: 1 })));
    assert.ok(mcrc.ok);
    assert.deepEqual(stated(mcrc, "META-INF/manifest.xml"), [{ part: "META-INF/manifest.xml", why: "crc_mismatch" }]);
    assert.ok(mcrc.notes.some((n) => /manifest\.xml could not be read \(crc_mismatch\)/.test(n) && /not looked for/.test(n)));
    const mjunk = await e.structure(pkg(f, { manifest: "<nothing/>" }));
    assert.ok(mjunk.ok);
    assert.deepEqual(stated(mjunk, "META-INF/manifest.xml"), [{ part: "META-INF/manifest.xml", why: "manifest_unparseable" }]);
    assert.ok(mjunk.notes.some((n) => /manifest_unparseable/.test(n)));
    // a fully read package states nothing about parts it read
    const full = await e.structure(pkg(f, { meta: metaXml({ "dc:title": "t" }) }));
    assert.ok(full.ok);
    assert.deepEqual(full.evidentiary.undetermined, []);
    // parts() carries the same statements
    const p = await e.parts(pkg(f));
    assert.ok(p.ok);
    assert.deepEqual(p.undetermined.map((u) => [u.part, u.why]), [["meta.xml", "part_absent"]]);
    // the old blanket markers are gone once the parts are read
    for (const s of [none, full, crc]) assert.ok(s.evidentiary.undetermined.every((u) => u.why !== "outside_content_xml_not_read"));
  }
});

/* ------------------------------------------------------------------ R29 */

test("R29 meta.xml present: one core-properties item, fields mapped by meaning, each null when the file omits it", async () => {
  const full = metaXml({
    "meta:initial-creator": "First Author", "dc:creator": "Last Editor",
    "meta:creation-date": "2026-01-01T00:00:00", "dc:date": "2026-02-02T00:00:00",
    "dc:title": "A &amp; B", "meta:editing-cycles": " 7 ", "meta:generator": "Producer/1.0", "dc:description": "not emitted",
  });
  for (const f of FLAVOURS) {
    const s = await ENTRIES[f].structure(pkg(f, { meta: full }));
    assert.ok(s.ok);
    assert.deepEqual(items(s, "core-properties"), [{
      kind: "core-properties", creator: "First Author", lastModifiedBy: "Last Editor",
      revision: " 7 ", revisionNumber: 7, created: "2026-01-01T00:00:00", modified: "2026-02-02T00:00:00",
      title: "A & B", source: null,
    }]);
    assert.deepEqual(stated(s, "meta.xml"), []);
    const sparse = await ENTRIES[f].structure(pkg(f, { meta: metaXml({ "meta:editing-cycles": "PT1H" }) }));
    assert.ok(sparse.ok);
    assert.deepEqual(items(sparse, "core-properties"), [{
      kind: "core-properties", creator: null, lastModifiedBy: null, revision: "PT1H", revisionNumber: null,
      created: null, modified: null, title: null, source: null,
    }]);
    // over the text guard, meta.xml is still read: it is not content.xml
    const over = await ENTRIES[f].structure(buildZip(withCd(members(f, { meta: full }), "content.xml", { usize: OVER_BOUND })));
    assert.ok(over.ok);
    assert.equal(items(over, "core-properties").length, 1);
  }
});

test("R29 the manifest's embedded members become sha256 intra links; images, fonts and the package's own parts do not; failures are stated links", async () => {
  const fontFaces = `<style:font-face style:name="F1"><svg:font-face-src><svg:font-face-uri xlink:href="Fonts/font1.ttf"/></svg:font-face-src></style:font-face>`;
  const data = {
    "Object 1/content.xml": "<office:document-content>chart</office:document-content>",
    "Object 1/styles.xml": "<styles/>",
    "ObjectReplacements/Object 1": "replacement bytes",
    "blob.bin": "OLE blob",
    "Pictures/image.png": "PNG bytes",
    "Pictures/legacy.svm": "SVM bytes",
    "Fonts/font1.ttf": "font one",
    "Fonts/font2.ttf": "font two, never named by content.xml",
    "Thumbnails/thumbnail.png": "thumb",
    "Configurations2/accelerator/current.xml": "<x/>",
    "styles.xml": "<s/>", "settings.xml": "<s/>", "manifest.rdf": "<rdf/>",
  };
  const listed = [
    ...Object.keys(data), "Object 1/", "blob.bin", "missing.bin", { path: "secret.bin", encrypted: true },
    "content.xml", "meta.xml", "mimetype",
  ];
  for (const f of FLAVOURS) {
    const extra = [...Object.entries(data).map(([name, d]) => ({ name, data: d })), { name: "secret.bin", data: "ciphertext" }];
    const s = await ENTRIES[f].structure(pkg(f, { fonts: fontFaces, manifestEntries: listed, extra }));
    assert.ok(s.ok);
    assert.deepEqual(s.links.filter((l) => l.partition === "intra" || l.partition === "undetermined"), [
      intra("Object 1/content.xml", data["Object 1/content.xml"]),
      intra("Object 1/styles.xml", data["Object 1/styles.xml"]),
      intra("ObjectReplacements/Object 1", data["ObjectReplacements/Object 1"]),
      intra("blob.bin", data["blob.bin"]),
      intra("Pictures/legacy.svm", data["Pictures/legacy.svm"]),
      intra("Fonts/font2.ttf", data["Fonts/font2.ttf"]),
      undet("manifest_member_absent", "missing.bin"),
      undet("embedding_encrypted", "secret.bin"),
    ]);
    assert.equal(s.counts.intra, 6);
    assert.equal(s.counts.undetermined, 2);
    assert.ok(!s.notes.some((n) => /no intra link/.test(n)));
    // an embedded member that will not inflate is a stated link, never a hash of bad bytes
    const bad = await ENTRIES[f].structure(buildZip(withCd(members(f, { manifestEntries: ["blob.bin"], extra: [{ name: "blob.bin", data: "x" }] }), "blob.bin", { crc: 3 })));
    assert.ok(bad.ok);
    assert.deepEqual(bad.links, [undet("embedding_unreadable:crc_mismatch", "blob.bin")]);
    // over the bound, no member is inflated and each is stated
    const big = await ENTRIES[f].structure(buildZip(withCd(members(f, { manifestEntries: ["a.bin", "b.bin"],
      extra: [{ name: "a.bin", data: "a" }, { name: "b.bin", data: "b" }] }), "a.bin", { usize: OVER_BOUND })));
    assert.ok(big.ok);
    const why = `embeddings_over_size_bound:${OVER_BOUND + 1}>${20 * 1024 * 1024}`;
    assert.deepEqual(big.links, [undet(why, "a.bin"), undet(why, "b.bin")]);
    // a manifest listing nothing embedded: the empty partition is explained
    const plain = await ENTRIES[f].structure(pkg(f, { manifestEntries: ["Pictures/p.png", "styles.xml"], extra: [{ name: "Pictures/p.png", data: "p" }] }));
    assert.ok(plain.ok);
    assert.equal(plain.counts.intra, 0);
    assert.ok(plain.notes.includes("no intra link: META-INF/manifest.xml lists no embedded member"));
  }
});

/* ------------------------------------------------------------------ R30 */

test("R30 text() carries images: Pictures/ content-addressed exhaustively off the central directory, or null with imagesWhy", async () => {
  for (const f of FLAVOURS) {
    const e = ENTRIES[f];
    const pics = [{ name: "Pictures/a.png", data: "png-a" }, { name: "Pictures/b.JPG", data: "jpg-b" }, { name: "Pictures/c.svm", data: "svm" }, { name: "Other/d.png", data: "d" }];
    // the manifest lists none of them: images do not depend on it
    const t = await e.text(pkg(f, { extra: pics }));
    assert.ok(t.ok);
    assert.deepEqual(t.images, [
      { kind: "image", ref: `image ${sha256(enc("png-a")).slice(0, 12)}`, part: sha256(enc("png-a")), mime: "image/png", name: "a.png" },
      { kind: "image", ref: `image ${sha256(enc("jpg-b")).slice(0, 12)}`, part: sha256(enc("jpg-b")), mime: "image/jpeg", name: "b.JPG" },
    ]);
    const none = await e.text(pkg(f));
    assert.ok(none.ok);
    assert.deepEqual(none.images, []);
    const bad = await e.text(buildZip(withCd(members(f, { extra: pics }), "Pictures/a.png", { crc: 2 })));
    assert.ok(bad.ok);
    assert.equal(bad.images, null);
    assert.equal(bad.imagesWhy, "media_part_unreadable:Pictures/a.png:crc_mismatch");
    // over the text guard, text() still carries images
    const over = await e.text(buildZip(withCd(members(f, { extra: pics }), "content.xml", { usize: OVER_BOUND })));
    assert.ok(over.ok);
    const overImages = over.images;
    assert.ok(overImages);
    assert.equal(overImages.length, 2);
    // an image is text()'s, never also an intra link in structure()
    const s = await e.structure(pkg(f, { extra: pics, manifestEntries: pics.map((p) => p.name) }));
    assert.ok(s.ok);
    assert.deepEqual(s.links.filter((l) => l.partition === "intra").map((l) => l.target).map((target) => ("name" in target ? target.name : undefined)), ["Pictures/c.svm", "Other/d.png"]);
  }
});
