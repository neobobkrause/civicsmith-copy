/* format-registry: requirement-named tests for the built-in zip entry (build/requirements/format-registry.md
 * R28) and its place last in the roster (R23), at the module's interface. The bytes rule is tested as an
 * equivalence with ooxml's own discriminate over plain, ZIP64, malformed, office and OpenDocument containers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormat, listFormats, detectFormat } from "../../../src/formats.mjs";
import * as ooxml from "../../../src/ooxml.mjs";
import { makeZip, officeZip, odfZip } from "./zipfix.mjs";
/** @import { FormatEntry, FormatDetection } from "../../../src/formats.mjs" */

/** @param {string} s @returns {Uint8Array} */
const enc = (s) => new TextEncoder().encode(s);
/** @param {FormatDetection | Promise<FormatDetection>} d @returns {FormatDetection} */
const now = (d) => { if (d instanceof Promise) throw new Error("detectFormat answered later"); return d; };
/** @param {string} format @returns {FormatEntry} */
const entryOf = (format) => { const e = getFormat(format); if (!e) throw new Error(`no entry registered for ${format}`); return e; };
/** @param {string} slot @returns {never} */
const missing = (slot) => { throw new Error(`a container flavour without ${slot}`); };
const zip = entryOf("zip");
const FALSY = [null, undefined, 0, "", false, NaN];
const ZIP_TYPES = ["application/zip", "application/x-zip-compressed"];

const PLAIN = makeZip([{ name: "minutes/2026-01.txt", data: "the minutes" }, { name: "minutes/" , data: "", method: 0 },
  { name: "budget.csv", data: "a,b\n1,2\n", method: 0 }]);
const PLAIN_ZIP64 = makeZip([{ name: "a.txt", data: "a" }, { name: "b.bin", data: "bb", method: 0 }], { zip64: true });

/** Every container this suite builds, named.
 * @type {Array<[string, Uint8Array]>} */
const CONTAINERS = [
  ["plain", PLAIN],
  ["plain, one stored member", makeZip([{ name: "x", data: "x", method: 0 }])],
  ["plain, a comment", makeZip([{ name: "a.txt", data: "a" }], { comment: "an archive comment" })],
  ["plain, a UTF-8 name", makeZip([{ name: "Résumé.txt", data: "r", utf8: true }])],
  ["plain, an unsafe name", makeZip([{ name: "../../etc/passwd", data: "p" }])],
  ["plain, a nested zip", makeZip([{ name: "inner.zip", data: PLAIN, method: 0 }])],
  ["plain, a member named mimetype/ (a directory)", makeZip([{ name: "mimetype/", data: "", method: 0 }])],
  ["plain, a member named mimetype.txt", makeZip([{ name: "mimetype.txt", data: "x" }])],
  ["plain, [Content_Types].xml under a leading slash", makeZip([{ name: "/[Content_Types].xml", data: "<Types/>" }])],
  ["plain, a member named [content_types].xml", makeZip([{ name: "[content_types].xml", data: "<Types/>" }])],
  ["plain ZIP64", PLAIN_ZIP64],
  ["truncated central directory", makeZip([{ name: "a.txt", data: "a" }], { truncateDirectory: true })],
  ["no EOCD", PLAIN.subarray(0, PLAIN.length - 22)],
  ["cut in half", PLAIN.subarray(0, Math.floor(PLAIN.length / 2))],
  ["magic only", enc("PK\x03\x04junk")],
  ["empty archive (EOCD only, no local header)", makeZip([])],
  ["OPC map, unparseable", makeZip([{ name: "[Content_Types].xml", data: "not xml" }, { name: "word/document.xml", data: "<x/>" }])],
  ["OPC map, no main part declared", makeZip([{ name: "[Content_Types].xml", data: "<Types></Types>" }])],
  ["OPC map and a mimetype member", makeZip([{ name: "mimetype", data: "application/vnd.oasis.opendocument.text", method: 0 },
    { name: "[Content_Types].xml", data: "<Types></Types>" }])],
  ["mimetype not first", odfZip("application/vnd.oasis.opendocument.text", { mimetypeLast: true })],
  ["mimetype compressed", odfZip("application/vnd.oasis.opendocument.text", { mimetypeMethod: 8 })],
  ["mimetype under a leading slash", odfZip("application/vnd.oasis.opendocument.text", { mimetypeName: "/mimetype" })],
  ["mimetype of an EPUB", odfZip("application/epub+zip")],
  ["mimetype with a trailing newline", odfZip("application/vnd.oasis.opendocument.text\n")],
  ...ooxml.CONTAINER_FLAVOURS.map((f) => {
    assert.ok(f);
    /** @type {[string, Uint8Array]} */
    const named = [`${("variant" in f ? f.variant : undefined) ?? f.flavour} (${f.partMap ?? "opc"})`,
      (f.partMap ?? "opc") === "odf"
        ? ("mimetype" in f ? odfZip(f.mimetype) : missing("mimetype"))
        : ("mainContentType" in f ? officeZip(f.mainContentType, f.conventionalMainPart) : missing("mainContentType"))];
    return named;
  }),
  ["html", enc("<!doctype html><html></html>")],
  ["pdf", enc("%PDF-1.7\n%%EOF\n")],
  ["text", enc("plain words")],
];

/**
 * @param {FormatDetection | null} r
 * @param {string} [confidence]
 * @returns {asserts r is FormatDetection}
 */
function isZipHit(r, confidence = "likely") {
  assert.ok(r);
  assert.equal(r.format, "zip");
  assert.equal(r.confidence, confidence);
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0 && r.signals.every((s) => typeof s === "string"));
  assert.deepEqual(Object.keys(r), ["format", "confidence", "signals"]);
}

test("R23: the roster is the twelve built-in entries, zip last", () => {
  assert.deepEqual(listFormats(), ["jpeg", "png", "html", "pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "zip"]);
  assert.equal(zip.format, "zip");
});

test("R28: zip detect with bytes answers zip exactly when ooxml.discriminate answers format zip, over every container", async () => {
  let zips = 0;
  for (const [label, bytes] of CONTAINERS) {
    const d = await ooxml.discriminate(bytes);
    const r = zip.detect(bytes, null);
    if (d.ok === true && d.format === "zip") { isZipHit(r); zips++; }
    else assert.equal(r, null, `${label}: discriminate answered ${d.ok ? d.format : ("why" in d ? d.why : undefined)}, detect must answer null`);
    // content type is not consulted while bytes are truthy
    for (const ct of ZIP_TYPES) assert.deepEqual(zip.detect(bytes, ct), r, label);
  }
  assert.ok(zips >= 9, "the plain containers are recognised");
  // anything truthy that is not a Uint8Array is read as discriminate reads it
  for (const b of [PLAIN.buffer.slice(PLAIN.byteOffset, PLAIN.byteOffset + PLAIN.byteLength), Buffer.from(PLAIN),
    new DataView(PLAIN.buffer, PLAIN.byteOffset, PLAIN.byteLength), "PK\x03\x04", [80, 75, 3, 4], {}, 1, true]) {
    const d = await ooxml.discriminate(b);
    const r = zip.detect(b, null);
    if (d.ok === true && d.format === "zip") isZipHit(r); else assert.equal(r, null);
  }
});

test("R28: zip detect is synchronous, reads the central directory only, and never inflates a part", () => {
  const saved = globalThis.DecompressionStream;
  globalThis.DecompressionStream = class { constructor() { throw new Error("zip detect inflated a part"); } };
  try {
    for (const [, bytes] of CONTAINERS) {
      const r = zip.detect(bytes, null);
      assert.ok(r === null || (typeof r === "object" && !(r instanceof Promise) && (!("then" in r) || typeof r.then !== "function")));
    }
    // a member whose deflate data is garbage still lists: detect never reads member data
    const broken = makeZip([{ name: "a.txt", data: "aaaaaaaaaaaaaaaa" }]);
    const at = 30 + "a.txt".length;
    const was = broken[at];
    assert.ok(was !== undefined);
    broken[at] = was ^ 0xff;
    isZipHit(zip.detect(broken, null));
  } finally { globalThis.DecompressionStream = saved; }
});

test("R28: an office or OpenDocument file never detects as zip, and the registry routes each to its own entry first", () => {
  for (const f of ooxml.CONTAINER_FLAVOURS) {
    assert.ok(f);
    const variant = "variant" in f ? f.variant : undefined;
    const bytes = (f.partMap ?? "opc") === "odf"
      ? ("mimetype" in f ? odfZip(f.mimetype) : missing("mimetype"))
      : ("mainContentType" in f ? officeZip(f.mainContentType, f.conventionalMainPart) : missing("mainContentType"));
    assert.equal(zip.detect(bytes, null), null, variant ?? f.flavour);
    const r = now(detectFormat(bytes, "application/zip"));
    assert.equal(r.format, f.flavour, `${variant ?? f.flavour} wins over zip and over its declared type`);
    assert.deepEqual(r, entryOf(f.flavour).detect(bytes, null));
  }
  isZipHit(now(detectFormat(PLAIN, null)));
  assert.deepEqual(detectFormat(PLAIN, "application/pdf"), zip.detect(PLAIN, null), "bytes outrank a declared type");
  assert.deepEqual(detectFormat(PLAIN, "text/csv"), zip.detect(PLAIN, null));
});

test("R28: zip detect without bytes — exactly application/zip or application/x-zip-compressed is likely; anything else null", () => {
  for (const b of FALSY) {
    for (const ct of ZIP_TYPES) {
      const r = zip.detect(b, ct);
      isZipHit(r);
      assert.ok(r.signals.some((s) => s.includes(ct)));
    }
    for (const ct of ["APPLICATION/ZIP", "Application/Zip", "application/zip; charset=binary", " application/zip",
      "application/zip ", "application/x-zip", "application/x-zip-compressed ", "multipart/x-zip", "application/octet-stream",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "", null, undefined, 0, {}]) {
      assert.equal(zip.detect(b, ct), null, `${String(b)} / ${String(ct)}`);
    }
  }
  for (const ct of ZIP_TYPES) {
    assert.deepEqual(detectFormat(null, ct), zip.detect(null, ct));
    assert.deepEqual(detectFormat(enc("words no entry claims"), ct), zip.detect(null, ct));
  }
});

test("R28: zip parts(bytes) is ooxml.listArchive(bytes)'s own result, unchanged; structure and text are null", async () => {
  assert.equal(zip.structure, null);
  assert.equal(zip.text, null);
  assert.equal(typeof zip.parts, "function");
  assert.ok(zip.parts);
  /** @param {Uint8Array} b */
  const range = (b) => ({ size: b.length, read: async (/** @type {number} */ o, /** @type {number} */ n) => b.slice(o, o + n) });
  /** @type {Array<[string, Uint8Array]>} */
  const withEmpty = [...CONTAINERS, ["empty bytes", new Uint8Array(0)]];
  for (const [label, bytes] of withEmpty) {
    assert.deepEqual(await zip.parts(bytes), await ooxml.listArchive(bytes), label);
    assert.deepEqual(await zip.parts(range(bytes)), await ooxml.listArchive(range(bytes)), `${label} as a range source`);
  }
  const listed = await zip.parts(PLAIN);
  assert.deepEqual(listed, await ooxml.listArchive(PLAIN));
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.entries.map((e) => e.name), ["minutes/2026-01.txt", "minutes/", "budget.csv"]);
  // and it is what the registry's detect→parts path reaches
  const reached = entryOf(now(detectFormat(PLAIN, null)).format);
  assert.ok(reached.parts);
  assert.deepEqual(await reached.parts(PLAIN), await ooxml.listArchive(PLAIN));
});
