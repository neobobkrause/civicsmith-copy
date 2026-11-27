/* doc-clean, fix round 9 (G124 quotes, G125c the DOCX case, G133d the linear scan, G136c the written entry count;
 * requirements R3, R5, R6, R11, R12). Every package here is written by test-support's ZIP writer (`zipChunks64`) or
 * `makeZip`; Info-ZIP's `unzip` and Python's `zipfile` are the independent readers of the copy (R5). */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { cleanDocument, CLEAN_MAX_BYTES, CLEAN_MAX_PART_BYTES, CLEAN_MAX_ENTRIES, CLEAN_REFUSALS } from "../../../src/doc-clean/index.mjs";
import { TAG_MAX, newScan } from "../../../src/doc-clean/xml.mjs";
import { readContainer } from "../../../src/ooxml.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { zipChunks64 } from "../../make-zip.mjs";
import { docx, makeZip, unzipCopy, enc } from "./fixtures.mjs";
/** @import { CleanAnswer } from "../../../src/doc-clean/index.mjs" */
/** @import { ChunkEntry, ZipEntry } from "../../make-zip.mjs" */
/** @import { CopiedPart } from "./fixtures.mjs" */

const SRC = new URL("../../../src/doc-clean/", import.meta.url).pathname;
const DIR = mkdtempSync(join(tmpdir(), "doc-clean-round9-"));
const NO_UNZIP = !spawnSync("unzip", ["-v"], { encoding: "utf8" }).error ? false : "Info-ZIP unzip is not installed";
const NO_PYTHON = !spawnSync("python3", ["--version"], { encoding: "utf8" }).error ? false : "python3 is not installed";

/** @param {CleanAnswer} r what a failed assertion on `r.ok` says */
const why = (r) => (r.ok ? undefined : r.detail);
/** @param {CleanAnswer} r the answer's `bytes`, undefined where it holds none */
const bytesOf = (r) => (r.ok && !r.clean ? r.bytes : undefined);
/** One part of a copy, as an entry `makeZip` writes again. @param {CopiedPart} p @returns {ZipEntry} */
const asEntry = (p) => ({ name: p.name, data: p.data, method: p.method });

/** The entries of the fixture DOCX, with `n` small stored entries appended; written as ZIP64 when there are many.
 *  @param {number} extraCount @param {Uint8Array} [base] @returns {Promise<Uint8Array>} */
async function bigDocx(extraCount, base = docx()) {
  const entries = unzipCopy(base).parts.map(/** @param {CopiedPart} p @returns {ChunkEntry} */ (p) => ({ name: p.name, data: p.data, method: p.method }));
  /* short names and classic local headers keep 100,000 entries inside the 16 MiB a document may be */
  for (let i = 0; i < extraCount; i++) entries.push({ name: `x/${i}`, data: enc("p"), method: 0, zip64: false });
  /** @type {Uint8Array[]} */
  const chunks = [];
  for await (const c of zipChunks64(entries)) chunks.push(c);
  return new Uint8Array(Buffer.concat(chunks));
}
/** @param {Uint8Array} z */
const names = (z) => { const c = readContainer(z); assert.equal(c.ok, true, c.ok ? undefined : c.why); return c.entries.map((e) => e.name); };
/** @param {CleanAnswer} r @param {string} code @param {RegExp} [detail] */
const refused = (r, code, detail) => {
  /** @type {CleanAnswer} */
  const whole = r;
  assert.equal(r.ok, false, `expected ${code}, got ${r.ok ? "an answer" : r.code}`);
  assert.equal(r.code, code, r.detail);
  if (detail) assert.match(r.detail, detail);
  assert.equal("bytes" in whole ? whole.bytes : undefined, undefined, "a refusal answers nothing else");
};
/** The end-of-directory record a ZIP states, read by a walk of its own: the 16-bit count and, when ZIP64's record
 *  precedes it, that record's 64-bit count.
 *  @param {Uint8Array} z */
function endCounts(z) {
  const b = Buffer.from(z), e = b.length - 22;
  assert.equal(b.readUInt32LE(e), 0x06054b50, "an end record at the end");
  /** @type {{ field: number, zip64: number | null }} */
  const out = { field: b.readUInt16LE(e + 10), zip64: null };
  const loc = e - 20;
  if (loc >= 0 && b.readUInt32LE(loc) === 0x07064b50) {
    const at = Number(b.readBigUInt64LE(loc + 8));
    assert.equal(b.readUInt32LE(at), 0x06064b50, "ZIP64's end record where its locator says");
    assert.equal(Number(b.readBigUInt64LE(at + 24)), Number(b.readBigUInt64LE(at + 32)));
    assert.equal(at + 12 + Number(b.readBigUInt64LE(at + 4)), loc, "ZIP64's end record ends where its locator starts");
    out.zip64 = Number(b.readBigUInt64LE(at + 32));
  }
  return out;
}
/** @param {Uint8Array} z @param {string} tag */
const unzipList = (z, tag) => {
  const f = join(DIR, `${tag}.docx`);
  writeFileSync(f, z);
  const r = spawnSync("unzip", ["-Z1", f], { encoding: "utf8", maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split("\n").filter(Boolean);
};
/** @param {Uint8Array} z @param {string} tag */
const pythonList = (z, tag) => {
  const f = join(DIR, `${tag}.py.docx`);
  writeFileSync(f, z);
  const r = spawnSync("python3", ["-I", "-c", "import sys,zipfile;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", f], { encoding: "utf8", maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split("\n").filter(Boolean);
};

// ---- R5, R6 (G136c, DOCS C1): the written entry count equals the read count ----

/** C1: a DOCX of `extra + 10` entries is copied whole, the written count the read count less what R6 removes.
 *  @param {number} extra */
async function copiedWhole(extra) {
  const original = await bigDocx(extra);
  const read = names(original);
  assert.equal(read.length, extra + 10, "the fixture holds the entries it says");
  const r = await cleanDocument(original);
  assert.equal(r.ok, true, why(r));
  assert.equal(r.clean, false);
  const kept = read.filter((n) => n !== "docProps/custom.xml");
  assert.deepEqual(names(r.bytes), kept, "every entry R2 and R6 do not remove, in the original's order");
  const end = endCounts(r.bytes);
  if (kept.length >= 0xffff) {
    assert.equal(end.field, 0xffff, "the 16-bit count is ZIP64's sentinel");
    assert.equal(end.zip64, kept.length, "ZIP64's record states the count written");
  } else {
    assert.equal(end.field, kept.length);
    assert.equal(end.zip64, null);
  }
  if (!NO_UNZIP) assert.deepEqual(unzipList(r.bytes, `c1-${extra}`), kept, "Info-ZIP lists the same entries");
  if (!NO_PYTHON) assert.deepEqual(pythonList(r.bytes, `c1-${extra}`), kept, "Python's zipfile lists the same entries");
}

test("R5 R6 DOCS C1 a DOCX of 65544 entries is copied whole: written count == read count less the parts R6 removes, in order, the end record agreeing (Info-ZIP and Python list the same names)", () => copiedWhole(65534));
test("R5 R6 DOCS C1 a DOCX of 65545 entries is copied whole: written count == read count less the parts R6 removes, in order, the end record agreeing (Info-ZIP and Python list the same names)", () => copiedWhole(65535));
test("R5 R6 DOCS C1 a DOCX of 70010 entries is copied whole: written count == read count less the parts R6 removes, in order, the end record agreeing (Info-ZIP and Python list the same names)", () => copiedWhole(70000));
test("R5 R6 DOCS C1 a DOCX of 100000 entries is copied whole: written count == read count less the parts R6 removes, in order, the end record agreeing (Info-ZIP and Python list the same names)", () => copiedWhole(100000 - 10));

test("R5 R6 the copy of a ZIP64 DOCX is the same on a second clean, byte for byte, and its clean copy is clean:true", async () => {
  const original = await bigDocx(70000);
  const a = await cleanDocument(original), b = await cleanDocument(original);
  assert.equal(a.ok, true);
  assert.deepEqual(bytesOf(a), bytesOf(b));
  const again = await cleanDocument(bytesOf(a));
  assert.equal(again.ok, true, why(again));
  assert.equal(again.clean, true, "a copy carries nothing more to remove");
});

test("R5 R6 a DOCX with 70,009 entries and no metadata part to remove answers its entries all, written count == read count", async () => {
  const original = await bigDocx(70000, docx({ meta: false }));
  const read = names(original);
  const r = await cleanDocument(original);
  assert.equal(r.ok, true, why(r));
  if (!r.clean) {
    assert.equal(endCounts(r.bytes).zip64 ?? endCounts(r.bytes).field, names(r.bytes).length);
    assert.deepEqual(names(r.bytes), read);
  }
});

// ---- R3: TOO_MANY_ENTRIES, the ratio ----

test("R3 R12 TOO_MANY_ENTRIES: a package of more entries than boundOf(office, entries) is refused with its count, nothing written; one of exactly that many is copied", async () => {
  assert.equal(CLEAN_MAX_ENTRIES, boundOf("office", "entries"));
  assert.ok(Object.hasOwn(CLEAN_REFUSALS, "TOO_MANY_ENTRIES"), "the refusal has its meaning");
  const over = await bigDocx(CLEAN_MAX_ENTRIES + 1 - 10);
  assert.equal(endCounts(over).zip64 ?? endCounts(over).field, CLEAN_MAX_ENTRIES + 1, "the fixture states one entry over (readContainer itself refuses it, ooxml R3/R31)");
  refused(await cleanDocument(over), "TOO_MANY_ENTRIES", new RegExp(`${CLEAN_MAX_ENTRIES + 1} entries.*${CLEAN_MAX_ENTRIES}`));
  const exact = await bigDocx(CLEAN_MAX_ENTRIES - 10);
  assert.equal(names(exact).length, CLEAN_MAX_ENTRIES);
  const r = await cleanDocument(exact);
  assert.equal(r.ok, true, why(r));
  assert.ok(!r.clean, "a copy");
  assert.equal(names(r.bytes).length, CLEAN_MAX_ENTRIES - 1, "the one part R6 removes");
});

test("R3 DOCUMENT_UNREADABLE: a part declaring a ratio past the table's is refused by name from the directory, before it is inflated; the densest honest part is copied", async () => {
  const ratio = boundOf("archive", "ratio");
  const parts = unzipCopy(docx()).parts.map(asEntry);
  const zeros = new Uint8Array(4 * 1024 * 1024);
  const honest = makeZip([...parts, { name: "word/extra/zeros.txt", data: zeros }]);
  const container = readContainer(honest);
  assert.ok(container.ok, "the honest package is read");
  const c = container.entries.find((e) => e.name === "word/extra/zeros.txt");
  assert.ok(c, "the zeros part is there");
  assert.ok(c.uncompressedSize / c.compressedSize <= ratio, `deflate's densest part is ${c.uncompressedSize / c.compressedSize}:1`);
  const ok = await cleanDocument(honest);
  assert.equal(ok.ok, true, why(ok));
  const small = enc("x".repeat(50));
  const lying = makeZip([...parts, { name: "word/extra/lie.txt", data: small, method: 0, central: { uncompressedSize: small.length * ratio + 1 } }]);
  refused(await cleanDocument(lying), "DOCUMENT_UNREADABLE", /part word\/extra\/lie\.txt declares \d+ bytes in 50, over the ratio of 1100/);
  const edge = makeZip([...parts, { name: "word/extra/edge.txt", data: small, method: 0, central: { uncompressedSize: small.length * ratio } }]);
  const e = await cleanDocument(edge);
  assert.ok(e.ok === false ? !/ratio/.test(e.detail) : true, "at the ratio the bound is not the reason");
  const dense = makeZip([...parts, { name: "word/extra/dense.bin", data: small, method: 0, central: { compressedSize: 0, uncompressedSize: 1 } }]);
  refused(await cleanDocument(dense), "DOCUMENT_UNREADABLE", /ratio/);
});

// ---- R11 (G133d, DOCS O7/P6/D4): the scan is linear, counted, yields; a long tag is refused ----

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
/** A DOCX whose `word/document.xml` is `body`; the rest the fixture's.
 *  @param {Uint8Array} body @returns {Uint8Array} */
function withBody(body) {
  const parts = unzipCopy(docx({ images: false })).parts.map(/** @param {CopiedPart} p @returns {ZipEntry} */ (p) => ({ name: p.name, data: p.name === "word/document.xml" ? body : p.data, method: p.method }));
  return makeZip(parts);
}
/** @param {string} inner */
const doc = (inner) => enc(`<?xml version="1.0"?><w:document ${W}><w:body>${inner}</w:body></w:document>`);

/** O7: the bytes scanned for the part `make` writes are at most 4 times its length, counted, not timed.
 *  @param {() => Uint8Array} make */
async function scannedLinearly(make) {
  const body = make();
  const z = withBody(body);
  const scan = newScan();
  const r = await cleanDocument(z, { scan });
  assert.ok(typeof r.ok === "boolean");
  assert.ok(scan.scanned <= 4 * body.length, `scanned ${scan.scanned} bytes of a ${body.length}-byte part`);
  assert.ok(scan.scanned > 0);
}

test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 200,000 declarations <!x>", () => scannedLinearly(() => doc("<w:p><w:ins w:author=\"A\"/></w:p>" + "<!x>".repeat(200000))));
test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 40,000 copies of <a b=\"", () => scannedLinearly(() => doc("<w:p><w:ins w:author=\"A\"/></w:p>" + "<a b=\"".repeat(40000))));
test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 20,000 unclosed <w:comment ", () => scannedLinearly(() => doc("<w:p><w:ins w:author=\"A\"/></w:p>" + "<w:comment ".repeat(20000))));
test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 200,000 declarations without a closing tag", () => scannedLinearly(() => enc(`<?xml version="1.0"?><w:document ${W}><w:ins w:author="A"/>` + "<!x>".repeat(200000))));
test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 100,000 end tags </a>", () => scannedLinearly(() => doc("<w:ins w:author=\"A\"/>" + "</a>".repeat(100000))));
test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 100,000 comments and processing instructions", () => scannedLinearly(() => doc("<w:ins w:author=\"A\"/>" + "<!--c--><?p ?>".repeat(50000))));
test("R11 DOCS O7 the bytes scanned are at most 4 times the part's, counted not timed: 50,000 attributes in one tag", () => scannedLinearly(() => doc("<w:ins w:author=\"A\" " + 'q="" '.repeat(50000) + "/>")));

test("R11 the scan yields at least every 65,536 tokens: yieldNow is awaited once per 65,536 tokens of a part of 200,000", async () => {
  const body = doc("<w:ins w:author=\"A\"/>" + "<!x>".repeat(200000));
  let calls = 0;
  const scan = newScan(async () => { calls++; });
  const r = await cleanDocument(withBody(body), { scan });
  assert.equal(r.ok, true, why(r));
  assert.equal(scan.yields, calls);
  assert.ok(scan.tokens >= 200000);
  assert.equal(calls, Math.floor(scan.tokens / 65536), "one yield per 65,536 tokens, none missed");
  assert.ok(calls >= 3);
  /** @type {number[]} */
  const viaOption = []; // and through cleanDocument's own option
  await cleanDocument(withBody(body), { yieldNow: async () => { viaOption.push(1); } });
  assert.equal(viaOption.length, calls);
});

test("R11 a cleaner that crashes mid-clean (its yieldNow throws) leaves nothing behind: the next call answers the same as a first", async () => {
  const body = doc("<w:ins w:author=\"A\"/>" + "<!x>".repeat(100000));
  const z = withBody(body);
  const first = await cleanDocument(z);
  const crashed = await cleanDocument(z, { yieldNow: async () => { throw new Error("killed"); } });
  assert.equal(crashed.ok, false);
  assert.equal(crashed.code, "DOCUMENT_UNREADABLE");
  const next = await cleanDocument(z);
  assert.equal(next.ok, first.ok);
  assert.deepEqual(bytesOf(next), bytesOf(first));
});

test("R11 a tag longer than boundOf(xml, tag) is DOCUMENT_UNREADABLE naming the part; a tag of exactly that many bytes is read", async () => {
  assert.equal(TAG_MAX, boundOf("xml", "tag"));
  const open = '<w:ins w:author="A" x="', close = '"/>';
  /** @param {number} n */
  const exact = (n) => open + "y".repeat(n - open.length - close.length) + close;
  assert.equal(exact(TAG_MAX).length, TAG_MAX);
  const ok = await cleanDocument(withBody(doc(exact(TAG_MAX))));
  assert.equal(ok.ok, true, why(ok));
  /** @param {string} s */
  const tag = (s) => withBody(doc(s));
  refused(await cleanDocument(tag(exact(TAG_MAX + 1))), "DOCUMENT_UNREADABLE", /part word\/document\.xml has a tag of more than 65536 bytes/);
  refused(await cleanDocument(tag("<w:ins w:author=\"A\"/><w:t " + "z".repeat(TAG_MAX))), "DOCUMENT_UNREADABLE", /part word\/document\.xml/);
  refused(await cleanDocument(tag("<w:ins w:author=\"A\"/></w:t" + " ".repeat(TAG_MAX) + ">")), "DOCUMENT_UNREADABLE", /part word\/document\.xml/);
  refused(await cleanDocument(tag("<w:ins w:author=\"A\"/><!DOCTYPE " + "d".repeat(TAG_MAX) + ">")), "DOCUMENT_UNREADABLE", /part word\/document\.xml/);
  refused(await cleanDocument(tag("<w:ins w:author=\"A\"/><w:t a=\"" + "v".repeat(TAG_MAX) + "\"/>")), "DOCUMENT_UNREADABLE", /part word\/document\.xml/);
  const comment = await cleanDocument(tag("<w:ins w:author=\"A\"/><!--" + "c".repeat(3 * TAG_MAX) + "-->"));
  assert.equal(comment.ok, true, "a comment is content, not a tag");
});

test("R11 a long tag in an ODF part and in an embedded SVG is refused naming that part; the refusal answers no bytes", async () => {
  const meta = enc(`<?xml version="1.0"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"><office:meta><meta:generator>G</meta:generator><x ${"a".repeat(TAG_MAX)}></x></office:meta></office:document-meta>`);
  const parts = unzipCopy(docx({ images: false })).parts.map(asEntry);
  const svg = enc('<svg xmlns="http://www.w3.org/2000/svg"><g ' + "k".repeat(TAG_MAX) + "></g></svg>");
  refused(await cleanDocument(makeZip([...parts, { name: "word/media/long.svg", data: svg }])), "DOCUMENT_UNREADABLE", /part word\/media\/long\.svg/);
  assert.ok(meta.length > TAG_MAX);
});

// ---- R3 (G125c, SCAN D7/D8): the image inside an uploaded DOCX ----

/** @param {number} v */
const be32 = (v) => [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
/** @param {Uint8Array} b */
const crc = (b) => { let c = -1; for (const x of b) c = (crcTable[(c ^ x) & 255] ?? 0) ^ (c >>> 8); return (c ^ -1) >>> 0; };
/** @param {string} type @param {number[]} [data] */
const chunk = (type, data = []) => { const t = [...enc(type), ...data]; return [...be32(data.length), ...t, ...be32(crc(Uint8Array.from(t)))]; };
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** @param {number} w @param {number} h @param {Uint8Array[]} [idat] */
const png = (w, h, idat = [new Uint8Array(deflateSync(new Uint8Array(0)))]) =>
  Uint8Array.from([...PNG_SIG, ...chunk("IHDR", [...be32(w), ...be32(h), 8, 6, 0, 0, 0]), ...idat.flatMap((d) => chunk("IDAT", [...d])), ...chunk("IEND")]);

/** @param {string} name @param {Uint8Array} data */
const inDocx = (name, data) => docx({ extra: [{ name, data }] });

test("R3 SCAN D7 a DOCX holding a 70-byte PNG that declares 30,000,000 x 1 RGBA is refused IMAGE_TOO_LARGE naming the image, the isolate alive", async () => {
  const hostile = png(30000000, 1);
  assert.ok(hostile.length < 100);
  const r = await cleanDocument(inDocx("word/media/stride.png", hostile));
  refused(r, "IMAGE_TOO_LARGE", /^part word\/media\/stride\.png: /);
});

test("R3 SCAN D7 a DOCX holding a PNG within image-cover R10's bounds (a stride and a chunk count well inside them) is copied, not refused", async () => {
  const r = await cleanDocument(inDocx("word/media/small.png", png(1000, 1, [new Uint8Array(deflateSync(new Uint8Array(1 + 4000)))])));
  assert.equal(r.ok, true, why(r));
});

test("R3 SCAN D7 a DOCX holding a PNG of 1,000,000 empty IDAT chunks is refused IMAGE_TOO_LARGE naming the image", async () => {
  const many = png(1, 1, Array.from({ length: 1000000 }, () => new Uint8Array(0)));
  refused(await cleanDocument(inDocx("word/media/chunks.png", many)), "IMAGE_TOO_LARGE", /^part word\/media\/chunks\.png: /);
});

test("R3 SCAN D8 a DOCX holding a JPEG of 2,000,000 two-byte markers is refused IMAGE_TOO_LARGE naming the image", async () => {
  const markers = new Uint8Array(2 + 2 * 2000000 + 2);
  markers.set([0xff, 0xd8]);
  for (let i = 0; i < 2000000; i++) markers.set([0xff, 0x01], 2 + 2 * i);
  markers.set([0xff, 0xd9], markers.length - 2);
  refused(await cleanDocument(inDocx("word/media/markers.jpeg", markers)), "IMAGE_TOO_LARGE", /^part word\/media\/markers\.jpeg: /);
});

// ---- R12 (G124): no numeric literal for a ceiling the module keeps ----

/** What `expr`, decimal literals joined by `*` and `**`, is as strict-mode JavaScript reads it (`**` before `*`, `**`
 *  from the right), or null where strict mode refuses one of its literals (a leading zero).
 *  @param {string} expr @returns {number | null} */
function valueOf(expr) {
  if (expr.split(/\s*\*{1,2}\s*/).some((l) => /^0\d/.test(l))) return null;
  return expr.split(/\s*(?<!\*)\*(?!\*)\s*/)
    .map((factor) => factor.split(/\s*\*\*\s*/).map(Number).reduceRight((power, base) => base ** power))
    .reduce((product, f) => product * f);
}

test("R12 every ceiling is read from READ_BOUNDS: CLEAN_MAX_BYTES, the entry bound, the tag bound, the ratio; and no source line of the module holds a literal of one", async () => {
  assert.equal(CLEAN_MAX_BYTES, boundOf("document", "clean_bytes"));
  assert.equal(CLEAN_MAX_ENTRIES, boundOf("office", "entries"));
  assert.equal(TAG_MAX, boundOf("xml", "tag"));
  assert.equal(CLEAN_MAX_PART_BYTES, boundOf("document", "part_bytes"));
  const figures = [boundOf("document", "clean_bytes"), CLEAN_MAX_PART_BYTES, boundOf("office", "entries"), boundOf("xml", "tag"), boundOf("archive", "ratio")];
  /** @param {string} text */
  const code = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/(?![/*])(?:[^/\\\n]|\\.)+\/[a-z]*/g, '""'));
  const files = readdirSync(SRC).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length >= 5, "the module's files were found");
  /** @type {string[]} */
  const found = [];
  for (const f of files) {
    code(readFileSync(join(SRC, f), "utf8")).forEach((line, i) => {
      if (/\bYIELD_TOKENS\s*=/.test(line)) return; // the pass's yield cadence is R11's own figure, not a ceiling it keeps
      for (const m of line.matchAll(/\b\d+(?:\s*(?:\*\*|\*)\s*\d+)*\b/g)) {
        const expr = m[0].replace(/_/g, "");
        const v = valueOf(expr);
        if (v === null) continue;
        if (figures.includes(v) || [16777216, 33554432, 100000, 65536].includes(v)) found.push(`${f}:${i + 1}: ${expr}`);
      }
    });
  }
  assert.deepEqual(found, [], "a ceiling's figure written as a literal");
});
