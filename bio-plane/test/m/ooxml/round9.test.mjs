/* The ooxml module's fix-round-9 requirements (T51; build/requirements/ooxml.md R3, R5, R6, R10, R11, R30, R31,
 * R35, R36, R37, R38): the limits of the reader path, the ratio and encryption refusals, templates, the flavour of a
 * file read by ranges, the one decode, the character-reference rule and the listing in one pass. Every test names
 * the requirement it checks in its title. Archives are written by ./zip.mjs and test-support's `makeZip`; the
 * cases built here use fixed seeds written into the test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import * as M from "../../../src/ooxml.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { buildZip, TYPES, MAIN, contentTypes, opc, odf, prng } from "./zip.mjs";
import { makeZip } from "../../make-zip.mjs";

const {
  readContainer, readPart, discriminate, walkRels, readCoreProperties, parseRels, parseCoreProperties,
  parseContentTypes, listArchive, decodeText, readPartPieces, cutAfterTag, declaredTextBytes, sizeGuard,
  MEASURED_OOXML_TEXT_BOUND_BYTES, STREAMED_TEXT_BOUND_BYTES, MEMBER_MAX, ARCHIVE_TOTAL_MAX, ARCHIVE_RATIO_MAX,
  OFFICE_ENTRIES_MAX, ARCHIVE_DIRECTORY_MAX, ARCHIVE_NAME_MAX, ARCHIVE_ENTRIES_MAX, ARCHIVE_DEPTH_MAX,
  ARCHIVE_TREE_TOTAL_MAX, ARCHIVE_TREE_ENTRIES_MAX, STRUCTURAL_PART_MAX, ARCHIVE_LIMITS,
} = M;

/** @typedef {import("../../../src/ooxml.mjs").Discrimination} Discrimination */
/** @typedef {import("../../../src/ooxml.mjs").ZipEntry} ZipEntry */
/** @typedef {import("./zip.mjs").ZipMember} ZipMember */
/** @typedef {import("./zip.mjs").OpcFlavour} OpcFlavour */
/**
 * A discrimination without its signals.
 * @typedef {Object} DiscriminationBody
 * @property {boolean} ok
 * @property {string} [format]
 * @property {string} [why]
 * @property {string | null} [variant]
 * @property {string} [mainPart]
 * @property {"high"} [confidence]
 * @property {string} [flavourDeclared]
 * @property {number} [limit]
 * @property {true} [final]
 */
/** @typedef {{ mimetype?: string, manifest?: boolean, content?: boolean, extra?: ZipMember[] }} OdfOptions */
/** @typedef {"ARCHIVE_ENTRIES_MAX" | "ARCHIVE_TOTAL_MAX" | "MEMBER_MAX" | "OFFICE_ENTRIES_MAX" | "ARCHIVE_DIRECTORY_MAX" | "ARCHIVE_NAME_MAX" | "ARCHIVE_RATIO_MAX" | "ARCHIVE_DEPTH_MAX" | "ARCHIVE_TREE_TOTAL_MAX" | "ARCHIVE_TREE_ENTRIES_MAX"} LimitName */
/** @typedef {{ name: string, data: string, local: { uncompressedSize: number }, central: { uncompressedSize: number } }} DeclaredMember a member test-support's `makeZip` writes with declared sizes */

const MIB = 1024 * 1024;
/** @type {(d: Uint8Array) => Uint8Array} */
const deflate = (d) => new Uint8Array(deflateRawSync(d));
/** @type {(s: string) => Uint8Array} */
const enc = (s) => new TextEncoder().encode(s);
/** @type {(d: Discrimination) => DiscriminationBody} */
const withoutSignals = ({ signals, ...rest }) => rest;
/** @type {(s: string, bom?: boolean) => Uint8Array} */
const u16le = (s, bom = true) => { const b = new Uint8Array((s.length + (bom ? 1 : 0)) * 2); const v = new DataView(b.buffer); let at = 0; if (bom) { v.setUint16(0, 0xfeff, true); at = 2; } for (let i = 0; i < s.length; i++) v.setUint16(at + 2 * i, s.charCodeAt(i), true); return b; };
/** @type {(s: string, bom?: boolean) => Uint8Array} */
const u16be = (s, bom = true) => { const b = new Uint8Array((s.length + (bom ? 1 : 0)) * 2); const v = new DataView(b.buffer); let at = 0; if (bom) { v.setUint16(0, 0xfeff, false); at = 2; } for (let i = 0; i < s.length; i++) v.setUint16(at + 2 * i, s.charCodeAt(i), false); return b; };
/** @type {(s: string) => Uint8Array} */
const latin1 = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const CREDIT = "<cp:coreProperties xmlns:cp=\"x\" xmlns:dc=\"y\"><dc:creator>Zoë</dc:creator></cp:coreProperties>";

/** @typedef {{ size: number, read: (offset: number, length: number) => Promise<Uint8Array> }} RangedSource */
/** @typedef {{ reads: [number, number][], source: RangedSource }} Ranged */

/**
 * A range source over `bytes` that records every read.
 * @param {Uint8Array} bytes
 * @param {{ fail?: (offset: number, length: number) => boolean }} [options]
 * @returns {Ranged}
 */
function ranged(bytes, { fail = () => false } = {}) {
  /** @type {[number, number][]} */
  const reads = [];
  return {
    reads,
    source: {
      size: bytes.length,
      async read(offset, length) {
        reads.push([offset, length]);
        if (fail(offset, length)) throw new Error("gone");
        return bytes.slice(offset, offset + length);
      },
    },
  };
}

/* ---------------------------------------------------------------- R3 / R30 */

test("R3 readContainer refuses a count, a directory and a name over their limits, by name, final, before the directory is walked", () => {
  assert.equal(OFFICE_ENTRIES_MAX, 100000);
  assert.equal(ARCHIVE_DIRECTORY_MAX, 16 * MIB);
  assert.equal(ARCHIVE_NAME_MAX, 4096);
  const one = [{ name: "a", data: "a" }];
  // the end record (ZIP64's, past 65,535) declares more entries than the limit: refused whatever the directory holds
  const n = OFFICE_ENTRIES_MAX + 1;
  assert.deepEqual(readContainer(makeZip([{ name: "a", data: "a" }], { zip64: true, zip64Record: { entries: n, diskEntries: n } })),
    { ok: false, why: "OFFICE_ENTRIES_MAX", limit: OFFICE_ENTRIES_MAX, final: true });
  // a directory declared larger than the limit
  assert.deepEqual(readContainer(buildZip(one, { eocd: { cdSize: ARCHIVE_DIRECTORY_MAX + 1 } })),
    { ok: false, why: "ARCHIVE_DIRECTORY_MAX", limit: ARCHIVE_DIRECTORY_MAX, final: true });
  // at the directory limit exactly the refusal is R3's older one: the directory runs past the end record
  assert.deepEqual(readContainer(buildZip(one, { eocd: { cdSize: ARCHIVE_DIRECTORY_MAX } })), { ok: false, why: "central_directory_truncated" });
  // a name over the limit, and at it
  const long = buildZip([{ name: "n".repeat(ARCHIVE_NAME_MAX + 1), data: "x" }]);
  assert.deepEqual(readContainer(long), { ok: false, why: "ARCHIVE_NAME_MAX", limit: ARCHIVE_NAME_MAX, final: true });
  const atName = readContainer(buildZip([{ name: "n".repeat(ARCHIVE_NAME_MAX), data: "x" }]));
  assert.equal(atName.ok, true);
  // the same entries really present: 100,000 are read, 100,001 are not
  /** @type {(count: number) => Uint8Array} */
  const many = (count) => makeZip(Array.from({ length: count }, (_, i) => ({ name: `e${i}`, data: "", method: 0 })), { zip64: true });
  const atLimit = readContainer(many(OFFICE_ENTRIES_MAX));
  assert.equal(atLimit.ok, true);
  assert.equal(atLimit.count, OFFICE_ENTRIES_MAX);
  assert.deepEqual(readContainer(many(OFFICE_ENTRIES_MAX + 1)), { ok: false, why: "OFFICE_ENTRIES_MAX", limit: OFFICE_ENTRIES_MAX, final: true });
});

test("R3 the refusals on a limit reach discriminate as the container's own, with their figure, final", async () => {
  const z = buildZip([{ name: "n".repeat(ARCHIVE_NAME_MAX + 1), data: "x" }]);
  const r = await discriminate(z);
  assert.deepEqual(withoutSignals(r), { ok: false, why: "ARCHIVE_NAME_MAX", limit: ARCHIVE_NAME_MAX, final: true });
  const { source } = ranged(z);
  assert.deepEqual(await discriminate(source), r);
});

test("R30 the limits are the READ_BOUNDS rows' active figures, taken through boundOf, and a refusal on one is final", () => {
  /** @type {[LimitName, [string, string]][]} */
  const rows = [
    ["ARCHIVE_ENTRIES_MAX", ["archive", "members"]], ["ARCHIVE_TOTAL_MAX", ["archive", "unpacked_bytes"]], ["MEMBER_MAX", ["archive", "member_bytes"]],
    ["OFFICE_ENTRIES_MAX", ["office", "entries"]], ["ARCHIVE_DIRECTORY_MAX", ["archive", "directory"]], ["ARCHIVE_NAME_MAX", ["archive", "name"]],
    ["ARCHIVE_RATIO_MAX", ["archive", "ratio"]], ["ARCHIVE_DEPTH_MAX", ["archive", "depth"]], ["ARCHIVE_TREE_TOTAL_MAX", ["archive", "unpacked_bytes"]],
    ["ARCHIVE_TREE_ENTRIES_MAX", ["archive", "members"]],
  ];
  for (const [name, [kind, row]] of rows) {
    assert.equal(M[name], boundOf(kind, row), name);
    assert.equal(ARCHIVE_LIMITS[name], boundOf(kind, row), name);
  }
  assert.deepEqual(Object.keys(ARCHIVE_LIMITS), rows.map(([name]) => name));
  assert.equal(STRUCTURAL_PART_MAX, boundOf("office", "structural_part_bytes"));
  assert.equal(ARCHIVE_DEPTH_MAX, 3);
  assert.equal(ARCHIVE_TREE_TOTAL_MAX, ARCHIVE_TOTAL_MAX);
  assert.equal(ARCHIVE_TREE_ENTRIES_MAX, ARCHIVE_ENTRIES_MAX);
});

/* --------------------------------------------------------------------- R6 */

test("R6 and R35 the 20 MiB text bound and the 32 MiB ceiling are the office rows' alpha figures, taken through boundOf", () => {
  assert.equal(MEASURED_OOXML_TEXT_BOUND_BYTES, boundOf("office", "text_bytes"));
  assert.equal(MEASURED_OOXML_TEXT_BOUND_BYTES, 20971520);
  assert.equal(STREAMED_TEXT_BOUND_BYTES, boundOf("office", "streamed_text_bytes"));
  assert.equal(STREAMED_TEXT_BOUND_BYTES, 33554432);
  const guard = sizeGuard(MEASURED_OOXML_TEXT_BOUND_BYTES + 1);
  assert.equal(guard.ok, false);
  assert.deepEqual(guard.bound, boundOf("office", "text_bytes"));
});

/* --------------------------------------------------------------------- R5 */

test("R5 an encrypted member (ZipCrypto bit 0, 6 or 13, or AES method 99) is stated MEMBER_ENCRYPTED with its name, never inflate_failed", async () => {
  for (const flags of [0x0001, 0x0040, 0x2000, 0x0001 | 0x0008]) {
    const z = buildZip([{ name: "secret.xml", data: "payload", flags }, { name: "plain.xml", data: "ok" }]);
    const c = readContainer(z);
    assert.deepEqual(await readPart(z, c, "/secret.xml"), { ok: false, why: "MEMBER_ENCRYPTED", name: "secret.xml" }, `flags ${flags}`);
    assert.deepEqual(await readPart(z, c, "plain.xml"), { ok: true, bytes: enc("ok") });
  }
  // AES: method 99 in the directory
  const aes = buildZip([{ name: "a.xml", data: "payload", cd: { method: 99 } }]);
  assert.deepEqual(await readPart(aes, readContainer(aes), "a.xml"), { ok: false, why: "MEMBER_ENCRYPTED", name: "a.xml" });
  // the writers of test-support: the traditional, strong and AES forms
  for (const encrypted of ["traditional", "strong", "aes"]) {
    const z = makeZip([{ name: "e.xml", data: "payload", encrypted }]);
    assert.deepEqual(await readPart(z, readContainer(z), "e.xml"), { ok: false, why: "MEMBER_ENCRYPTED", name: "e.xml" }, encrypted);
  }
  // a flag that is not an encryption flag (bit 3, the data descriptor) does not refuse
  const desc = buildZip([{ name: "d.xml", data: "fine", flags: 0x0008 }]);
  assert.deepEqual(await readPart(desc, readContainer(desc), "d.xml"), { ok: true, bytes: enc("fine") });
  // an entry of a hand-made container that carries no flags is judged by its local header's
  const local = buildZip([{ name: "h.xml", data: "payload", flags: 0x0001, cd: { flags: 0 } }]);
  const handMade = readContainer(local);
  assert.ok(handMade.ok);
  /** @type {Map<string, ZipEntry>} */
  const noNames = new Map(null);
  const bare = { ...handMade, entries: handMade.entries.map((e) => ({ ...e })), byName: noNames };
  bare.byName = new Map(bare.entries.map((e) => [e.name, e]));
  assert.deepEqual(await readPart(local, bare, "h.xml"), { ok: false, why: "MEMBER_ENCRYPTED", name: "h.xml" });
  // every caller states it as any other readPart refusal
  const ct = buildZip([{ name: "[Content_Types].xml", data: contentTypes({ "/word/document.xml": TYPES.docx }), flags: 1 }, { name: "word/document.xml", data: "<d/>" }]);
  assert.equal((await discriminate(ct)).why, "content_types_unreadable:MEMBER_ENCRYPTED");
  const core = buildZip([{ name: "docProps/core.xml", data: CREDIT, flags: 1 }]);
  assert.deepEqual(await readCoreProperties(core, readContainer(core)), { ok: false, why: "MEMBER_ENCRYPTED" });
});

/* -------------------------------------------------------------------- R31 */

test("R31 a member declared over its compressed size times ARCHIVE_RATIO_MAX is refused before any inflation, with its figures, final", async () => {
  /** @type {string[]} */
  const inflated = [];
  /** @type {new (f: string) => object} */
  const RealDS = globalThis.DecompressionStream;
  globalThis.DecompressionStream = class extends RealDS { /** @param {string} f */ constructor(f) { inflated.push(f); super(f); } };
  try {
    const kernel = deflate(enc("x"));
    // declared one over the ratio's reach; at the reach exactly the member is read (and then judged by its size)
    const reach = kernel.length * ARCHIVE_RATIO_MAX;
    const over = buildZip([{ name: "a.xml", data: "x", cd: { usize: reach + 1 } }]);
    assert.deepEqual(await readPart(over, readContainer(over), "a.xml"),
      { ok: false, why: "ARCHIVE_RATIO_MAX", name: "a.xml", declared: reach + 1, limit: ARCHIVE_RATIO_MAX, final: true });
    assert.deepEqual(inflated, []);
    const at = buildZip([{ name: "a.xml", data: "x", cd: { usize: reach } }]);
    const atRead = await readPart(at, readContainer(at), "a.xml");
    assert.equal(atRead.ok, false);
    assert.equal(atRead.why, "size_mismatch");
    // a zero compressed size with a non-zero declared one
    const zero = buildZip([{ name: "z.xml", data: "", method: 0, cd: { usize: 5 } }]);
    const zeroRead = await readPart(zero, readContainer(zero), "z.xml");
    assert.equal(zeroRead.ok, false);
    assert.equal(zeroRead.why, "ARCHIVE_RATIO_MAX");
    // empty and honest members are read; a stored member's ratio is 1
    const honest = buildZip([{ name: "e", data: "" }, { name: "s", data: "stored", method: 0 }, { name: "r", data: "ab".repeat(5000) }]);
    const c = readContainer(honest);
    assert.equal((await readPart(honest, c, "e")).ok, true);
    assert.equal((await readPart(honest, c, "s")).ok, true);
    assert.equal((await readPart(honest, c, "r")).ok, true);
  } finally {
    globalThis.DecompressionStream = RealDS;
  }
  // every caller states it as any other readPart refusal
  const core = buildZip([{ name: "docProps/core.xml", data: CREDIT, cd: { usize: 1000000 } }]);
  const coreRead = await readCoreProperties(core, readContainer(core));
  assert.equal(coreRead.ok, false);
  assert.equal(coreRead.why, "ARCHIVE_RATIO_MAX");
  const media = buildZip([{ name: "m/a.png", data: "x", cd: { usize: 1000000 } }]);
  const out = await M.withContainerImages({ ok: true }, { ok: true, bytes: media, container: readContainer(media) }, "m/");
  assert.ok("imagesWhy" in out);
  assert.equal(out.imagesWhy, "media_part_unreadable:m/a.png:ARCHIVE_RATIO_MAX");
});

test("R31 the XML parts the module decodes itself are refused above STRUCTURAL_PART_MAX declared, before inflation, final; at it they are read", async () => {
  /** @type {(head: string, tail: string, size: number) => string} */
  const spaces = (head, tail, size) => head + " ".repeat(size - head.length - tail.length) + tail;
  /** @type {string[]} */
  const inflated = [];
  /** @type {new (f: string) => object} */
  const RealDS = globalThis.DecompressionStream;
  globalThis.DecompressionStream = class extends RealDS { /** @param {string} f */ constructor(f) { inflated.push(f); super(f); } };
  try {
    const over = STRUCTURAL_PART_MAX + 1;
    /** @type {(name: string) => object} */
    const refusal = (name) => ({ ok: false, why: "STRUCTURAL_PART_MAX", name, declared: over, limit: STRUCTURAL_PART_MAX, final: true });
    // a 100 MiB-class .rels and a [Content_Types].xml of zeros, at a ratio the ratio check passes
    const zeros = new Uint8Array(over);
    const z = buildZip([
      { name: "[Content_Types].xml", data: zeros }, { name: "_rels/.rels", data: zeros }, { name: "docProps/core.xml", data: zeros },
      { name: "word/document.xml", data: "<d/>" },
    ]);
    const c = readContainer(z);
    assert.equal((await discriminate(z)).why, "content_types_unreadable:STRUCTURAL_PART_MAX");
    assert.deepEqual((await walkRels(z, c)).undetermined, [{ part: "_rels/.rels", why: "STRUCTURAL_PART_MAX" }]);
    assert.deepEqual(await readCoreProperties(z, c), { ok: false, why: "STRUCTURAL_PART_MAX" });
    // readPart itself is not the structural reader: the member is a member
    assert.equal((await readPart(z, c, "docProps/core.xml")).ok, true);
    void refusal;
  } finally {
    globalThis.DecompressionStream = RealDS;
  }
  // at the limit exactly, a part is read
  const at = buildZip([{ name: "docProps/core.xml", data: spaces("<cp:coreProperties xmlns:cp=\"x\" xmlns:dc=\"y\"><dc:creator>Ann</dc:creator>", "</cp:coreProperties>", STRUCTURAL_PART_MAX) }]);
  const atCore = await readCoreProperties(at, readContainer(at));
  assert.ok(atCore.ok);
  assert.equal(atCore.creator, "Ann");
  assert.ok(inflated.length >= 1);
});

/* --------------------------------------------------------------- R10, R11 */

/** @type {[OpcFlavour, string, string][]} */
const TEMPLATES = [
  ["docx", "dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"],
  ["pptx", "potx", "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml"],
  ["pptx", "ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml"],
];

test("R10 and R11 a template or a show (dotx, potx, ppsx) is read as its twin, with its variant; macro-enabled and plain files are unchanged", async () => {
  for (const [twin, variant, type] of TEMPLATES) {
    const z = buildZip([{ name: "[Content_Types].xml", data: contentTypes({ [`/${MAIN[twin]}`]: type }) }, { name: MAIN[twin], data: "<m/>" }]);
    const r = await discriminate(z);
    assert.deepEqual(withoutSignals(r), { ok: true, format: twin, variant, mainPart: MAIN[twin], confidence: "high" }, variant);
    assert.ok(r.signals.some((s) => s.includes(type)));
    const absent = buildZip([{ name: "[Content_Types].xml", data: contentTypes({ [`/${MAIN[twin]}`]: type }) }]);
    assert.deepEqual(withoutSignals(await discriminate(absent)), { ok: true, format: "undetermined", why: "declared_main_part_absent", flavourDeclared: twin });
    assert.equal((await discriminate(z, null, M.OOXML_FLAVOURS)).why, "opc_main_part_unrecognized");
    const row = M.CONTAINER_FLAVOURS.find((f) => f.variant === variant);
    assert.deepEqual(row, { partMap: "opc", flavour: twin, variant, mainContentType: type, conventionalMainPart: MAIN[twin] });
  }
  const names = M.CONTAINER_FLAVOURS.map((f) => f.variant ?? f.flavour);
  assert.deepEqual(names.slice(12, 15), ["dotx", "potx", "ppsx"]);
  assert.deepEqual(names.slice(15), ["odt", "ods", "odp"]);
  /** @type {OpcFlavour[]} */
  const plain = ["docx", "xlsx", "pptx"];
  for (const f of plain) assert.equal((await discriminate(buildZip(opc(f)))).variant, null);
});

/**
 * The five archives a range source must answer as the bytes do.
 * @returns {Record<string, Uint8Array>}
 */
function discriminateCases() {
  /** @type {(name: string, size: number) => ZipMember} */
  const stored = (name, size) => ({ name, data: new Uint8Array(size).map((_, i) => (i * 7919) & 255), method: 0 });
  return {
    docx: buildZip(opc("docx")),
    "docx with a large picture": buildZip(opc("docx", [stored("word/media/big.bin", 3 * MIB)])),
    xlsx: buildZip(opc("xlsx")),
    pptx: buildZip(opc("pptx")),
    odt: buildZip(odf("odt")),
    "plain zip": buildZip([{ name: "a.txt", data: "a" }]),
    "opc, no flavour": buildZip([{ name: "[Content_Types].xml", data: contentTypes({ "/x.xml": "application/x" }) }, { name: "x.xml", data: "<x/>" }]),
    "declared part absent": buildZip(opc("docx").filter((m) => m.name !== MAIN.docx)),
    "unparseable types": buildZip([{ name: "[Content_Types].xml", data: "nope" }]),
    "odf not first": buildZip((() => { const m = odf("odt"); m.unshift(...m.splice(1, 1)); return m; })()),
    "corrupt directory": buildZip([{ name: "a", data: "a" }], { eocd: { cdSize: 999 } }),
    "zip64 sentinel": buildZip([{ name: "a", data: "a" }], { eocd: { cdOffset: 0xffffffff } }),
    "not a zip": enc("%PDF-1.7 and more text than four bytes"),
    short: enc("PK"),
    empty: new Uint8Array(0),
    "comment tail": buildZip(opc("pptx"), { comment: "c".repeat(300) }),
  };
}

test("R11 discriminate over a range source answers exactly as for the same bytes given whole, signals included", async () => {
  for (const [label, bytes] of Object.entries(discriminateCases())) {
    const whole = await discriminate(bytes);
    const { source } = ranged(bytes);
    assert.deepEqual(await discriminate(source), whole, label);
    assert.deepEqual(await discriminate(source, "application/zip"), await discriminate(bytes, "application/zip"), label);
  }
});

test("R11 a file of any size is judged from its end record, its central directory and the small parts it names, never from its head", async () => {
  // a docx of 24 MiB + 1 byte whose size is pictures: the flavour is read, and almost nothing of it
  const pad = new Uint8Array(24 * MIB).map((_, i) => (i * 31 + (i >> 8)) & 255);
  const z = buildZip(opc("docx", [{ name: "word/media/huge.bin", data: pad, method: 0 }]));
  assert.ok(z.length > 24 * MIB);
  const { reads, source } = ranged(z);
  const r = await discriminate(source);
  assert.deepEqual(withoutSignals(r), { ok: true, format: "docx", variant: null, mainPart: "word/document.xml", confidence: "high" });
  const bytesRead = reads.reduce((n, [, length]) => n + length, 0);
  assert.ok(bytesRead < 256 * 1024, `read ${bytesRead} bytes of ${z.length}`);
  assert.ok(reads.every(([offset, length]) => offset + length <= z.length));
  // the same for a stored-first ODF and for an 8 MiB - 1 / 8 MiB + 1 file: no size changes the answer
  for (const size of [8 * MIB - 1, 8 * MIB + 1, 20 * MIB + 1]) {
    /** @type {OdfOptions} */
    const withExtra = { extra: [{ name: "Pictures/p.bin", data: new Uint8Array(size).fill(7), method: 0 }] };
    /** @type {OdfOptions} */
    const none = {};
    const big = buildZip(odf("ods", [{ name: "Pictures/p.bin", data: new Uint8Array(size).fill(7), method: 0 }].length ? withExtra : none));
    const got = ranged(big);
    assert.equal((await discriminate(got.source)).format, "ods", `${size}`);
    assert.ok(got.reads.reduce((n, [, length]) => n + length, 0) < 256 * 1024);
  }
});

test("R11 a range source that cannot be read answers source_unreadable and never throws", async () => {
  const z = buildZip(opc("docx"));
  assert.deepEqual(withoutSignals(await discriminate(ranged(z, { fail: () => true }).source)), { ok: false, why: "source_unreadable" });
  assert.deepEqual(withoutSignals(await discriminate(ranged(z, { fail: (o) => o === 0 }).source)), { ok: false, why: "source_unreadable" });
  for (const size of [-1, 1.5, NaN, "9", undefined]) {
    assert.deepEqual(withoutSignals(await discriminate({ size, read: async () => z })), { ok: false, why: "source_unreadable" });
  }
  assert.deepEqual(withoutSignals(await discriminate({ size: z.length, read: async () => "not bytes" })), { ok: false, why: "source_unreadable" });
  // a part read through a range source answers as the bytes do
  const c = readContainer(z);
  assert.deepEqual(await readPart(ranged(z).source, c, "word/document.xml"), await readPart(z, c, "word/document.xml"));
  const failed = await readPart(ranged(z, { fail: () => true }).source, c, "word/document.xml");
  assert.equal(failed.ok, false);
  assert.equal(failed.why, "source_unreadable");
});

/* ---------------------------------------------------------------- R36 */

const CAFE = "Café résumé — naïve “quoted” €5 ÿ";

test("R36 decodeText reads UTF-8 with or without a BOM, UTF-16 with or without a BOM, and says what decided it", () => {
  const plain = decodeText(enc(CAFE), { name: "t.txt" });
  assert.deepEqual(plain, { ok: true, text: CAFE, encoding: "utf-8", assumed: true, replaced: 0, replaced_ratio: 0, disagree: [] });
  const bom = decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc(CAFE)]), { name: "t.txt" });
  assert.deepEqual(bom, { ok: true, text: CAFE, encoding: "utf-8", assumed: false, replaced: 0, replaced_ratio: 0, disagree: [] });
  /** @type {[string, Uint8Array, string][]} */
  const marked = [
    ["UTF-16LE BOM", u16le(CAFE), "utf-16le"], ["UTF-16BE BOM", u16be(CAFE), "utf-16be"],
  ];
  for (const [label, bytes, encoding] of marked) {
    assert.deepEqual(decodeText(bytes, { name: "t.txt" }), { ok: true, text: CAFE, encoding, assumed: false, replaced: 0, replaced_ratio: 0, disagree: [] }, label);
  }
  // without a mark: text laid out as UTF-16 is read as UTF-16
  const ascii = "plain ascii text of a UTF-16 file, nothing else";
  const got1 = decodeText(u16le(ascii, false), {});
  assert.ok(got1.ok);
  assert.equal(got1.text, ascii);
  const got2 = decodeText(u16le(ascii, false), {});
  assert.ok(got2.ok);
  assert.equal(got2.encoding, "utf-16le");
  const got3 = decodeText(u16be(ascii, false), {});
  assert.ok(got3.ok);
  assert.equal(got3.text, ascii);
  const got4 = decodeText(u16be(ascii, false), {});
  assert.ok(got4.ok);
  assert.equal(got4.encoding, "utf-16be");
  for (const bytes of [u16le(ascii, false), u16be(ascii, false)]) {
    const unmarked = decodeText(bytes, {});
    assert.ok(unmarked.ok);
    assert.ok(!unmarked.text.includes("\u0000"));
  }
  // empty is a real, assumed UTF-8 zero
  assert.deepEqual(decodeText(new Uint8Array(0), {}), { ok: true, text: "", encoding: "utf-8", assumed: true, replaced: 0, replaced_ratio: 0, disagree: [] });
});

test("R36 decodeText keeps undeclared UTF-8 with stray bytes as UTF-8 when its valid sequences number at least four times its invalid bytes, and reads real Latin-1 as windows-1252 (G169)", () => {
  const body = "L'œuvre de l'été: résumé, naïve, café, Zoë";
  /** @type {(at: number, byte: number) => Uint8Array} */
  const stray = (at, byte) => { const b = enc(body); return Uint8Array.from([...b.subarray(0, at), byte, ...b.subarray(at)]); };
  // one stray byte in the middle: UTF-8, assumed, one replacement, every other character true
  const mid = decodeText(stray(20, 0xff), { name: "u.txt" });
  assert.equal(mid.ok, true);
  assert.equal(mid.encoding, "utf-8");
  assert.equal(mid.assumed, true);
  assert.equal(mid.replaced, 1);
  assert.ok(mid.text.includes("œuvre") && mid.text.includes("résumé") && mid.text.includes("Zoë"));
  assert.equal(mid.text.replace("\ufffd", ""), body);
  // a character cut off at the end is one invalid run: still UTF-8
  const cut = Uint8Array.from([...enc(body), 0xc3]);
  const tail = decodeText(cut, {});
  assert.ok(tail.ok);
  assert.equal(tail.encoding, "utf-8");
  assert.equal(tail.assumed, true);
  assert.equal(tail.replaced, 1);
  assert.ok(tail.text.startsWith(body));
  // the boundary: exactly four valid sequences against one invalid byte is UTF-8; three is not
  const four = Uint8Array.from([...enc("éééé"), 0xff]);
  const got5 = decodeText(four, {});
  assert.ok(got5.ok);
  assert.equal(got5.encoding, "utf-8");
  const got6 = decodeText(Uint8Array.from([...enc("ééé"), 0xff]), {});
  assert.ok(got6.ok);
  assert.equal(got6.encoding, "windows-1252");
  // controls: real Latin-1 (no valid sequence), and one valid against one invalid, stay windows-1252
  const latin = decodeText(latin1("Caf\xe9 r\xe9sum\xe9 na\xefve"), {});
  assert.ok(latin.ok);
  assert.equal(latin.encoding, "windows-1252");
  assert.equal(latin.assumed, true);
  assert.equal(latin.replaced, 0);
  const got7 = decodeText(Uint8Array.from([...enc("é"), 0xff]), {});
  assert.ok(got7.ok);
  assert.equal(got7.encoding, "windows-1252");
  // a declared encoding is unchanged
  const got8 = decodeText(stray(20, 0xff), { declared: "windows-1252" });
  assert.ok(got8.ok);
  assert.equal(got8.encoding, "windows-1252");
  const got9 = decodeText(stray(20, 0xff), { declared: "utf-8" });
  assert.ok(got9.ok);
  assert.equal(got9.encoding, "utf-8");
});

test("R36 decodeText reads windows-1252 and ISO-8859-x by declaration or by detection, and never leaves a replacement character for what its declared encoding decodes", () => {
  const cp1252 = latin1("Caf\xe9 r\xe9sum\xe9 \x80 \x93q\x94");
  const detected = decodeText(cp1252, { name: "l.txt" });
  assert.equal(detected.ok, true);
  assert.equal(detected.text, "Café résumé € “q”");
  assert.deepEqual([detected.encoding, detected.assumed, detected.replaced, detected.replaced_ratio], ["windows-1252", true, 0, 0]);
  for (const declared of ["windows-1252", "WINDOWS-1252", "iso-8859-1", "latin1", "cp1252", "us-ascii"]) {
    const r = decodeText(cp1252, { declared, name: "l.txt" });
    assert.ok(r.ok);
    assert.equal(r.text, "Café résumé € “q”", declared);
    assert.deepEqual([r.encoding, r.assumed], ["windows-1252", false], declared);
  }
  // ISO-8859-2: byte 0xB1 is ą, not the Latin-1 ±
  const latin2 = decodeText(Uint8Array.from([0x7a, 0xb1, 0x62]), { declared: "ISO-8859-2" });
  assert.ok(latin2.ok);
  assert.deepEqual([latin2.text, latin2.encoding, latin2.assumed], ["ząb", "iso-8859-2", false]);
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (const declared of ["windows-1252", "iso-8859-1", "iso-8859-2", "iso-8859-15"]) {
    const r = decodeText(all, { declared });
    assert.equal(r.ok, true, declared);
    assert.equal(r.replaced, 0, declared);
  }
  // a declared UTF-8 that the bytes are not: what cannot be decoded is counted, not hidden
  const bad = new Uint8Array([...enc("ab"), 0xff, ...enc("cd"), 0xc3]);
  const r = decodeText(bad, { declared: "utf-8" });
  assert.ok(r.ok);
  assert.equal(r.text, "ab�cd�");
  assert.deepEqual([r.replaced, r.replaced_ratio, r.assumed], [2, 2 / 6, false]);
  // characters, not UTF-16 units: an astral character counts once
  const astral = decodeText(enc("😀😀�"), {});
  assert.ok(astral.ok);
  assert.deepEqual([astral.replaced, astral.replaced_ratio], [1, 1 / 3]);
});

test("R36 decodeText answers ENCODING_UNSUPPORTED with the source's name for a declared encoding it cannot decode, and never reads one as another", () => {
  for (const declared of ["shift_jis", "gb2312", "koi8-r", "klingon", "utf-32", "x-user-defined", "iso-8859-12", "windows-1259"]) {
    assert.deepEqual(decodeText(enc("abc"), { declared, name: "page.html" }), { ok: false, why: "ENCODING_UNSUPPORTED", name: "page.html" }, declared);
  }
  assert.deepEqual(decodeText(enc("<?xml version=\"1.0\" encoding=\"Shift_JIS\"?><a/>"), { kind: "xml", name: "p.xml" }), { ok: false, why: "ENCODING_UNSUPPORTED", name: "p.xml" });
  assert.deepEqual(decodeText(enc("<meta charset=\"big5\">"), { kind: "html", name: "p.html" }), { ok: false, why: "ENCODING_UNSUPPORTED", name: "p.html" });
  const got10 = decodeText(enc("abc"), { declared: "klingon" });
  assert.equal(got10.ok, false);
  assert.equal(got10.name, null);
});

test("R36 decodeText takes the declaration from the text itself by kind, a header's declaration over the text's, and a mark over both", () => {
  /** @type {(label: string, body: string) => Uint8Array} */
  const prolog = (label, body) => latin1(`<?xml version="1.0" encoding="${label}"?><a>${body}</a>`);
  const got11 = decodeText(prolog("ISO-8859-1", "caf\xe9"), { kind: "xml" });
  assert.ok(got11.ok);
  assert.equal(got11.text.endsWith("café</a>"), true);
  const latinProlog = decodeText(prolog("ISO-8859-1", "caf\xe9"), { kind: "xml" });
  assert.ok(latinProlog.ok);
  assert.deepEqual(((r) => [r.encoding, r.assumed])(latinProlog), ["windows-1252", false]);
  const utf8Prolog = decodeText(prolog("UTF-8", "caf\xc3\xa9"), { kind: "xml" });
  assert.ok(utf8Prolog.ok);
  assert.deepEqual(((r) => [r.encoding, r.assumed])(utf8Prolog), ["utf-8", false]);
  // another kind does not read the prolog
  const got12 = decodeText(prolog("ISO-8859-1", "caf\xe9"), { kind: "text" });
  assert.ok(got12.ok);
  assert.equal(got12.assumed, true);
  /** @type {(head: string) => Uint8Array} */
  const html = (head) => latin1(`<html><head>${head}</head><body>caf\xe9</body></html>`);
  const got13 = decodeText(html("<meta charset=windows-1252>"), { kind: "html" });
  assert.ok(got13.ok);
  assert.equal(got13.text.includes("café"), true);
  const got14 = decodeText(html("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=iso-8859-1\">"), { kind: "html" });
  assert.ok(got14.ok);
  assert.equal(got14.text.includes("café"), true);
  // the header wins over the meta (H5)
  const conflict = decodeText(html("<meta charset=\"utf-8\">"), { kind: "html", declared: "windows-1252" });
  assert.ok(conflict.ok);
  assert.equal(conflict.text.includes("café"), true);
  assert.deepEqual([conflict.encoding, conflict.assumed], ["windows-1252", false]);
  // a byte-order mark wins over a header
  const marked = decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc("café")]), { declared: "windows-1252" });
  assert.ok(marked.ok);
  assert.deepEqual([marked.text, marked.encoding], ["café", "utf-8"]);
  // UTF-16 named by a text that is plainly 8-bit is not UTF-16
  const got15 = decodeText(prolog("UTF-16", "abc"), { kind: "xml" });
  assert.ok(got15.ok);
  assert.equal(got15.text.endsWith("abc</a>"), true);
  // a prolog in UTF-16 without a mark is found by its layout and is not assumed
  const u16xml = u16le("<?xml version=\"1.0\" encoding=\"UTF-16\"?><a>é</a>", false);
  const r = decodeText(u16xml, { kind: "xml" });
  assert.ok(r.ok);
  assert.deepEqual([r.text.endsWith("<a>é</a>"), r.encoding, r.assumed], [true, "utf-16le", false]);
});

test("R36 decodeText lists the windows whose detected encoding differs from the file's, and [] for a text decoded in one piece", () => {
  const WINDOW = 65536;
  /** @type {(n: number) => string} */
  const line = (n) => `line ${n} café\n`;
  // a Latin-1 file with a stretch of UTF-8 in the middle window
  /** @type {string[]} */
  const parts = [];
  for (let i = 0; parts.join("").length < 3 * WINDOW; i++) parts.push(line(i));
  const latin = latin1(parts.join("").replaceAll("café", "caf\xe9"));
  const mixed = latin.slice();
  const utf8Window = enc("ÄÖÜ ".repeat(Math.floor(WINDOW / 7)) + "x".repeat(WINDOW % 7));
  assert.equal(utf8Window.length, WINDOW);
  mixed.set(utf8Window, WINDOW);
  const r = decodeText(mixed, { name: "m.txt" });
  assert.ok(r.ok);
  assert.equal(r.encoding, "windows-1252");
  assert.deepEqual(r.disagree, [WINDOW]);
  const got16 = decodeText(latin, { name: "m.txt" });
  assert.ok(got16.ok);
  assert.deepEqual(got16.disagree, []);
  // a UTF-8 file with a Latin-1 stretch is not valid UTF-8 as a whole: it is read as the legacy charset it is
  // declared UTF-8, the stretch is a disagreeing window
  const utf8 = enc(parts.join(""));
  const withLatin = utf8.slice();
  withLatin.set(latin1("caf\xe9 ".repeat(1000)), 2 * WINDOW + 50);
  const d = decodeText(withLatin, { declared: "utf-8" });
  assert.ok(d.ok);
  assert.equal(d.encoding, "utf-8");
  assert.deepEqual(d.disagree, [2 * WINDOW]);
  assert.ok(d.replaced > 0);
  // a text of one piece, and UTF-16, have nothing to disagree
  const got17 = decodeText(utf8.subarray(0, 1000), {});
  assert.ok(got17.ok);
  assert.deepEqual(got17.disagree, []);
  const got18 = decodeText(u16le(parts.join("")), {});
  assert.ok(got18.ok);
  assert.deepEqual(got18.disagree, []);
});

test("R36 decodeText is pure, never throws on odd arguments, and its answer for the same bytes is the same", () => {
  const bytes = enc(CAFE);
  const first = decodeText(bytes, { declared: "utf-8", name: "n", kind: "xml" });
  assert.deepEqual(decodeText(bytes.slice(), { declared: "utf-8", name: "n", kind: "xml" }), first);
  const ODD = [undefined, null, 0, -1, "", "PK", {}, [], Symbol("s"), () => 0, true, NaN];
  for (const x of ODD) {
    assert.doesNotThrow(() => decodeText(x, x));
    assert.doesNotThrow(() => decodeText(bytes, x));
    const r = decodeText(x, x);
    assert.equal(typeof r.ok, "boolean");
  }
  const got19 = decodeText(bytes.buffer, undefined);
  assert.ok(got19.ok);
  assert.equal(got19.text, CAFE);
  const got20 = decodeText(Array.from(bytes), null);
  assert.ok(got20.ok);
  assert.equal(got20.text, CAFE);
  const got21 = decodeText(bytes, { declared: "" });
  assert.ok(got21.ok);
  assert.equal(got21.assumed, true);
});

test("R36 every part the module decodes to text goes through decodeText: a UTF-16 part is read, not found empty", async () => {
  const types = contentTypes({ "/word/document.xml": TYPES.docx });
  const z = buildZip([
    { name: "[Content_Types].xml", data: u16le(types) }, { name: "word/document.xml", data: "<d/>" },
    { name: "_rels/.rels", data: u16be("<Relationships><Relationship Id=\"a\" Target=\"https://x.example/\" TargetMode=\"External\"/></Relationships>") },
    { name: "docProps/core.xml", data: u16le(CREDIT) },
  ]);
  const c = readContainer(z);
  assert.equal((await discriminate(z)).format, "docx");
  assert.equal((await walkRels(z, c)).outbound.length, 1);
  assert.equal((await readCoreProperties(z, c)).creator, "Zoë");
  // the same parts in Latin-1 under their prolog
  const legacy = buildZip([
    { name: "docProps/core.xml", data: latin1("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><cp:coreProperties xmlns:cp=\"x\" xmlns:dc=\"y\"><dc:creator>Zo\xeb</dc:creator></cp:coreProperties>") },
    { name: "_rels/.rels", data: latin1("<?xml version=\"1.0\" encoding=\"Shift_JIS\"?><Relationships/>") },
  ]);
  const lc = readContainer(legacy);
  assert.equal((await readCoreProperties(legacy, lc)).creator, "Zoë");
  // a declaration it cannot decode is the part's own unparseable refusal
  assert.deepEqual((await walkRels(legacy, lc)).undetermined, [{ part: "_rels/.rels", why: "rels_unparseable" }]);
  // an ODF mimetype in UTF-16 is the media type it spells
  const odt = buildZip([{ name: "mimetype", data: u16le(TYPES.odt, false), method: 0 }, { name: "META-INF/manifest.xml", data: "<m/>" }, { name: "content.xml", data: "<c/>" }]);
  assert.equal((await discriminate(odt)).format, "odt");
});

/* ---------------------------------------------------------------- R37 */

const BAD_REFERENCES = ["&#x110000;", "&#99999999999;", "&#xD800;", "&#xDFFF;", "&#0;", "&#x0;", "&#12ab;", "&#;", "&#x;", "&#xZZ;", "&#65"];

test("R37 a character reference naming no scalar value never makes a service throw: the part is unparseable, the same on every call, final", async () => {
  for (const bad of BAD_REFERENCES) {
    const core = `<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>a${bad}b</dc:creator></cp:coreProperties>`;
    const rels = `<Relationships><Relationship Id="r" Target="https://x.example/p${bad}q" TargetMode="External"/></Relationships>`;
    const types = `<Types><Override PartName="/word/document.xml" ContentType="a${bad}b"/></Types>`;
    for (let call = 0; call < 2; call++) {
      assert.deepEqual(parseCoreProperties(core), { ok: false, why: "core_properties_unparseable", final: true }, bad);
      assert.deepEqual(parseRels(rels), { ok: false, why: "rels_unparseable", final: true }, bad);
      assert.deepEqual(parseContentTypes(types), { ok: false, why: "content_types_unparseable", final: true }, bad);
    }
    const z = buildZip([
      { name: "[Content_Types].xml", data: types }, { name: "_rels/.rels", data: rels }, { name: "docProps/core.xml", data: core },
      { name: "word/document.xml", data: "<d/>" },
    ]);
    const c = readContainer(z);
    assert.deepEqual(await readCoreProperties(z, c), { ok: false, why: "core_properties_unparseable", final: true }, bad);
    assert.deepEqual((await walkRels(z, c)).undetermined, [{ part: "_rels/.rels", why: "rels_unparseable", final: true }], bad);
    assert.deepEqual(withoutSignals(await discriminate(z)), { ok: true, format: "undetermined", why: "content_types_unparseable", final: true }, bad);
  }
});

test("R37 a rels target holding a lone surrogate is refused, and a reference to a scalar value is decoded", () => {
  for (const lone of ["\uD800", "\uDC00", "x\uD83Dy", "\uDE00\uD83D"]) {
    const xml = `<Relationships><Relationship Id="r" Target="https://x.example/${lone}" TargetMode="External"/></Relationships>`;
    assert.deepEqual(parseRels(xml), { ok: false, why: "rels_unparseable", final: true }, JSON.stringify(lone));
    // what subresources does with a target: it must not be able to throw
    assert.doesNotThrow(() => parseRels(xml));
  }
  // the references that name scalar values, in the forms XML allows (a lower-case x only), and a well-formed pair
  assert.deepEqual(parseCoreProperties(`<cp:coreProperties xmlns:cp="x"><dc:creator>&#X43;</dc:creator></cp:coreProperties>`), { ok: false, why: "core_properties_unparseable", final: true });
  const ok = parseCoreProperties(`<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>&#65;&#x42;&#x43;&#x1F600;&#x10FFFF;&#1;&amp;😀</dc:creator></cp:coreProperties>`);
  assert.equal(ok.ok, true);
  assert.equal(ok.creator, "ABC😀\u{10FFFF}\u0001&😀");
  const rels = parseRels(`<Relationships><Relationship Id="r" Target="a&#x20;b" TargetMode="External"/></Relationships>`);
  assert.ok(rels.ok);
  assert.equal(rels.relationships[0]?.target, "a b");
  // the old refusals are unchanged and are not final
  assert.deepEqual(parseRels("<nothing/>"), { ok: false, why: "rels_unparseable" });
  assert.deepEqual(parseCoreProperties("<nothing/>"), { ok: false, why: "core_properties_unparseable" });
  assert.deepEqual(parseContentTypes("<nothing/>"), { ok: false, why: "content_types_unparseable" });
});

test("R37 a part of unterminated tags is read in one pass, not once per tag", () => {
  const unterminated = `<Relationships>${"<Relationship Id=\"a\" Target=\"".repeat(40000)}`;
  const t0 = performance.now();
  const r = parseRels(unterminated);
  assert.equal(r.ok, true);
  assert.ok(performance.now() - t0 < 2000);
  const many = parseRels(`<Relationships>${"<Relationship Id=\"a\" Target=\"b\" ".repeat(20000)}`);
  assert.equal(many.ok, true);
});

/* ---------------------------------------------------------------- R38 */

/* The parts a source that fetches a file in parts of PART bytes would fetch: a read that falls in a part other than
 * the last one read costs a fetch. */
/**
 * @param {[number, number][]} reads
 * @param {number} PART
 * @returns {number}
 */
function fetches(reads, PART) {
  let last = -1, count = 0;
  for (const [offset, length] of reads) {
    for (let part = Math.floor(offset / PART); part <= Math.floor((offset + Math.max(length, 1) - 1) / PART); part++) {
      if (part !== last) { count++; last = part; }
    }
  }
  return count;
}

/**
 * @param {number} count
 * @param {number} size
 * @returns {ZipMember[]}
 */
function entriesOf(count, size) {
  const r = prng(38);
  return Array.from({ length: count }, (_, i) => ({ name: `member-${i}.bin`, data: Uint8Array.from({ length: size }, () => Math.floor(r() * 256)), method: 0 }));
}
/** @type {(n: number, seed: number) => number[]} */
const shuffled = (n, seed) => { const r = prng(seed); const order = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } return order; };

test("R38 a shuffled central directory is listed with at most twice the part reads of the same archive in physical order, and the same rows", async () => {
  const members = entriesOf(2000, 2048);
  const physical = buildZip(members);
  const order = shuffled(members.length, 38);
  const shuffledZip = buildZip(members, { cdOrder: order });
  const PART = 64 * 1024;
  const a = ranged(physical);
  const b = ranged(shuffledZip);
  const listA = await listArchive(a.source);
  const listB = await listArchive(b.source);
  assert.equal(listA.ok, true); assert.equal(listB.ok, true);
  assert.equal(fetches(b.reads, PART) <= 2 * fetches(a.reads, PART), true, `${fetches(b.reads, PART)} against ${fetches(a.reads, PART)}`);
  // the local headers are read in the order they lie in the file
  const headerReads = b.reads.slice(3).map(([offset]) => offset); // after the end record, its locator and the directory
  assert.deepEqual(headerReads, headerReads.toSorted((x, y) => x - y));
  // R27's answer is unchanged: the rows are the directory's, in its order, equal to the whole-bytes answer
  assert.deepEqual(listB, await listArchive(shuffledZip));
  const rowsB = listB.entries;
  assert.ok(rowsB);
  assert.deepEqual(rowsB.map((r) => r.index), rowsB.map((_, i) => i));
  assert.deepEqual(rowsB.map((r) => r.name), order.map((i) => members[i]?.name));
  /** @type {(list: import("../../../src/ooxml.mjs").ArchiveListing) => object} */
  const byName = (list) => {
    const rows = list.entries;
    assert.ok(rows);
    return Object.fromEntries(rows.map(({ index, ...row }) => [row.name, row]));
  };
  assert.deepEqual(byName(listB), byName(listA));
});

test("R38 10,000 entries are listed whatever the directory's order, and 10,001 are refused whole by ARCHIVE_ENTRIES_MAX", async () => {
  const members = entriesOf(ARCHIVE_ENTRIES_MAX, 1024);
  const z = buildZip(members, { cdOrder: shuffled(members.length, 10000) });
  const { reads, source } = ranged(z);
  const listing = await listArchive(source);
  assert.equal(listing.ok, true);
  assert.equal(listing.count, ARCHIVE_ENTRIES_MAX);
  const rows = listing.entries;
  assert.ok(rows);
  assert.ok(rows.every((r) => r.verdict === "ok"));
  assert.ok(fetches(reads, 1024 * 1024) <= 2 * (Math.ceil(z.length / (1024 * 1024)) + 2));
  const over = buildZip(entriesOf(ARCHIVE_ENTRIES_MAX + 1, 1));
  assert.deepEqual(await listArchive(over), { ok: false, why: "ARCHIVE_ENTRIES_MAX", limit: ARCHIVE_ENTRIES_MAX, final: true, entries: null });
});

test("R38 the listing refuses a directory over ARCHIVE_DIRECTORY_MAX and a name over ARCHIVE_NAME_MAX, final, before reading the directory", async () => {
  const z = buildZip([{ name: "a", data: "a" }]);
  const { reads, source } = ranged(buildZip([{ name: "a", data: "a" }], { eocd: { cdSize: ARCHIVE_DIRECTORY_MAX + 1 } }));
  assert.deepEqual(await listArchive(source), { ok: false, why: "ARCHIVE_DIRECTORY_MAX", limit: ARCHIVE_DIRECTORY_MAX, final: true, entries: null });
  assert.ok(reads.every(([, length]) => length < ARCHIVE_DIRECTORY_MAX));
  assert.deepEqual(await listArchive(buildZip([{ name: "n".repeat(ARCHIVE_NAME_MAX + 1), data: "x" }])),
    { ok: false, why: "ARCHIVE_NAME_MAX", limit: ARCHIVE_NAME_MAX, final: true, entries: null });
  assert.equal((await listArchive(buildZip([{ name: "n".repeat(ARCHIVE_NAME_MAX), data: "x" }]))).ok, true);
  assert.equal((await listArchive(z)).ok, true);
});

/* ------------------------------------------------- R35, R36 in pieces */

/**
 * @param {Uint8Array} bytes
 * @param {string} name
 * @returns {Promise<{ r: import("../../../src/ooxml.mjs").PiecesRead, text: string }>}
 */
async function piecesOf(bytes, name) {
  const c = readContainer(bytes);
  /** @type {string[]} */
  const got = [];
  const r = await readPartPieces(bytes, c, name, cutAfterTag, (p) => got.push(p));
  return { r, text: got.join("") };
}

test("R35 readPartPieces decodes a member by its own encoding: UTF-16 by its BOM, its layout or its declaration, a legacy charset by its prolog", async () => {
  const body = "<a x=\"é€\">" + "word ".repeat(300000) + "</a>";
  /** @type {[string, Uint8Array][]} */
  const encoded = [["LE BOM", u16le(body)], ["BE BOM", u16be(body)], ["LE no BOM", u16le(body, false)], ["BE no BOM", u16be(body, false)], ["UTF-8 BOM", new Uint8Array([0xef, 0xbb, 0xbf, ...enc(body)])]];
  for (const [label, data] of encoded) {
    for (const method of [0, 8]) {
      const z = buildZip([{ name: "p.xml", data, method }]);
      const { r, text } = await piecesOf(z, "p.xml");
      assert.equal(r.ok, true, `${label} ${method}`);
      assert.equal(text, body, `${label} ${method}`);
    }
  }
  const legacyBody = "<a>" + "caf\xe9 ".repeat(100000) + "</a>";
  const legacy = buildZip([{ name: "p.xml", data: latin1(`<?xml version="1.0" encoding="ISO-8859-1"?>${legacyBody}`) }]);
  assert.equal((await piecesOf(legacy, "p.xml")).text.endsWith(legacyBody.replaceAll("\xe9", "é")), true);
  const sjis = buildZip([{ name: "p.xml", data: latin1("<?xml version=\"1.0\" encoding=\"Shift_JIS\"?><a>x</a>") }]);
  assert.deepEqual((await piecesOf(sjis, "p.xml")).r, { ok: false, why: "ENCODING_UNSUPPORTED", name: "p.xml" });
  // a member shorter than the bytes read to find the encoding
  const tiny = buildZip([{ name: "p.xml", data: u16le("<a/>") }]);
  assert.equal((await piecesOf(tiny, "p.xml")).text, "<a/>");
  const empty = buildZip([{ name: "p.xml", data: "" }]);
  assert.deepEqual(await piecesOf(empty, "p.xml"), { r: { ok: true, size: 0 }, text: "" });
});

/* ---------------------------------------------------------------- R7 (G126d) */

test("R7 the declared unpacked size of a container small on disk is large for every container kind, and a lying directory counts as large (G126d audit)", () => {
  /** @type {(name: string, n: number) => DeclaredMember} */
  const declared = (name, n) => ({ name, data: "x", local: { uncompressedSize: n }, central: { uncompressedSize: n } });
  /** @type {Record<string, DeclaredMember[]>} */
  const kinds = {
    xlsx: [declared("xl/worksheets/sheet1.xml", 20 * MIB + 1)], docx: [declared("word/document.xml", 20 * MIB + 1)],
    pptx: [declared("ppt/slides/slide1.xml", 20 * MIB + 1)], odt: [declared("content.xml", 20 * MIB + 1)],
    zip: [declared("data/big.txt", 20 * MIB + 1)],
  };
  for (const [kind, members] of Object.entries(kinds)) {
    /** @type {Uint8Array} */
    const z = makeZip(members);
    assert.ok(z.length < 3 * MIB, kind);
    const c = readContainer(z);
    const { total } = declaredTextBytes(c, (/** @type {string} */ n) => /\.(xml|txt)$/.test(n));
    assert.equal(total, 20 * MIB + 1, kind);
    assert.equal(sizeGuard(total).ok, false, kind);
  }
  // a directory whose sizes are not numbers is never shown to be small
  /** @type {Map<string, unknown>} */
  const noNames = new Map(null);
  const lying = { entries: [{ name: "content.xml", uncompressedSize: NaN }, { name: "a.xml", uncompressedSize: undefined }], byName: noNames };
  assert.equal(sizeGuard(declaredTextBytes(lying, () => true).total).ok, false);
  assert.equal(M.textPlan(declaredTextBytes(lying, () => true).total).read, "none");
});
