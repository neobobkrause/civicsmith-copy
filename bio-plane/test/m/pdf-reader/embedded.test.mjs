/* pdf-reader: requirement-named tests for the embedded file's streaming hash (R22: an embedded file is "hashed as it streams,
 * never held"; fix round 9, G125e), at the module's interface. The record's `sha256` and `bytes` are checked against
 * node:crypto's digest of the same bytes; the memory test reads a 60 MiB embedded file in a process of its own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { build, FONT_OBJS, FONTS, bytesOf } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, LinkRecord, IntraLink } from "../../../src/pdfstructure.mjs" */
/** @import { StreamBody, Objects } from "./pdf.mjs" */

/** `x`; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} x
 *  @param {string} what
 *  @returns {T} */
const must = (x, what) => { if (x === undefined || x === null) throw new Error(`${what}: none`); return x; };
/** The reading of a whole file; a thrown failure naming the refusal when it is refused.
 *  @param {PdfStructureAnswer} a
 *  @returns {PdfStructure} */
const reading = (a) => { if (!a.ok) throw new Error(`expected a reading, got ${a.reason}`); return a; };
/** `base` with `changes` laid over it, as a new table (the object numbers in the order JavaScript gives integer keys).
 *  @param {Objects} base
 *  @param {Objects} changes
 *  @returns {Objects} */
const over = (base, changes) => {
  /** @type {Objects} */
  const all = {};
  for (const [k, v] of Object.entries(base)) all[k] = v;
  for (const [k, v] of Object.entries(changes)) all[k] = v;
  return all;
};
/** A link that is an `intra` record; a thrown failure naming `what` when it is absent or another partition.
 *  @param {LinkRecord | undefined} l
 *  @param {string} what
 *  @returns {IntraLink} */
const intraLink = (l, what) => { const x = must(l, what); if (x.partition !== "intra") throw new Error(`${what}: a ${x.partition} record`); return x; };
/** A link's `why`, when it is an undetermined record; undefined for any other.
 *  @param {LinkRecord} l
 *  @returns {string | undefined} */
const whyOf = (l) => (l.partition === "undetermined" ? l.target.why : undefined);
/** One stream case: its label, the stream, and (where it is stated) whether it is read.
 *  @typedef {{ label: string, stream: StreamBody }} StreamCase */
/** @typedef {{ label: string, stream: StreamBody, ok: boolean }} ReadCase */
/** What the child process ended with.
 *  @typedef {{ code: number | null, signal: string | null, out: string, err: string }} ChildEnd */
/** The members of `embedded`'s message this test reads: `intra` as printed (the files, each `EmbeddedFile`).
 *  @typedef {{ ok: boolean, intra: unknown, peakMB: number }} EmbeddedReport */

/** `embedded`'s message as the child printed it, decoded; a thrown failure naming the member that is missing or wrong.
 *  `intra` is kept as printed, for the comparison with the files expected.
 *  @param {string} text
 *  @returns {EmbeddedReport} */
function embeddedReport(text) {
  /** @type {unknown} */
  const v = JSON.parse(text);
  if (typeof v !== "object" || v === null) throw new Error("embedded message: not an object");
  const ok = "ok" in v ? v.ok : undefined;
  const peakMB = "peakMB" in v ? v.peakMB : undefined;
  if (typeof ok !== "boolean") throw new Error("embedded message: no ok");
  if (typeof peakMB !== "number") throw new Error("embedded message: no peakMB");
  return { ok, intra: "intra" in v ? v.intra : undefined, peakMB };
}

const CHILD = fileURLToPath(new URL("./memory-child.mjs", import.meta.url));
/** The hex SHA-256 of `b`.
 *  @param {Uint8Array} b
 *  @returns {string} */
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
/** `n` bytes that do not compress to nothing and are not the same at any two lengths (a seeded linear congruence).
 *  @param {number} n
 *  @param {number} [seed]
 *  @returns {Uint8Array} */
const noise = (n, seed = 1) => { const b = new Uint8Array(n); let x = seed >>> 0; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; b[i] = x >>> 24; } return b; };
/** ASCIIHex of `b`, ended by `>`.
 *  @param {Uint8Array} b
 *  @returns {string} */
const hexOf = (b) => Buffer.from(b).toString("hex").toUpperCase() + ">";

/** A one-page file with `data` attached by a FileAttachment annotation, the stream's dictionary entries `dict`.
 *  @param {StreamBody} stream
 *  @param {string} [trailing]
 *  @returns {Uint8Array} */
function withFile(stream, trailing = "") {
  return build(over(FONT_OBJS, {
    1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>",
    100: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${FONTS} >> /Contents 101 0 R /Annots [402 0 R] >>`,
    101: { data: "BT /F1 12 Tf 40 700 Td (page) Tj ET" },
    400: stream, 401: "<< /Type /Filespec /F (a.bin) /EF << /F 400 0 R >> >>",
    402: "<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] /Contents (a.bin) /FS 401 0 R >>",
  }), { trailer: trailing });
}
/** The reading's intra records and the records of embedded files it could not decode.
 *  @param {PdfStructure} r
 *  @returns {LinkRecord[]} */
const intra = (r) => r.links.filter((l) => l.partition === "intra" || whyOf(l) === "embedded_stream_undecodable");

const SIZES = [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 4096, 100_003];

test("R22: an embedded file's sha256 and length are exact at every block boundary, unfiltered or Flate, whichever way the filter is written", async () => {
  for (const n of SIZES) {
    const data = noise(n, n + 7);
    const want = sha256(data);
    /** @type {StreamCase[]} */
    const streams = [
      { label: "unfiltered", stream: { dict: "/Type /EmbeddedFile", data } },
      { label: "Flate", stream: { dict: "/Type /EmbeddedFile /Filter /FlateDecode", data: new Uint8Array(deflateSync(data)) } },
      { label: "Fl", stream: { dict: "/Type /EmbeddedFile /Filter /Fl", data: new Uint8Array(deflateSync(data, { level: 0 })) } },
      { label: "[Flate]", stream: { dict: "/Type /EmbeddedFile /Filter [/FlateDecode]", data: new Uint8Array(deflateSync(data, { level: 9 })) } },
    ];
    for (const { label, stream } of streams) {
      const r = reading(await extractPdfStructure(withFile(stream)));
      const got = intra(r);
      assert.equal(got.length, 1, `${n} ${label}`);
      const first = must(got[0], `${n} ${label}`);
      assert.equal(first.partition, "intra", `${n} ${label}: ${JSON.stringify(first.target)}`);
      const rec = intraLink(first, `${n} ${label}`);
      assert.equal(rec.target.sha256, want, `${n} ${label}`);
      assert.equal(rec.target.bytes, n, `${n} ${label}`);
      assert.equal(rec.target.name, "a.bin");
    }
  }
});

test("R22: the streams the streaming hash does not take are decoded whole as before and hash the same (ASCII stages, a Flate stream with bytes after its end, a predictor), and a stream that is not valid is stated undecodable", async () => {
  const data = noise(5000, 3);
  const want = sha256(data);
  const z = new Uint8Array(deflateSync(data));
  /** @type {ReadCase[]} */
  const cases = [
    { label: "ASCIIHex", stream: { dict: "/Filter /ASCIIHexDecode", data: bytesOf(hexOf(data)) }, ok: true },
    { label: "ASCIIHex then Flate", stream: { dict: "/Filter [/ASCIIHexDecode /FlateDecode]", data: bytesOf(hexOf(z)) }, ok: true },
    { label: "Flate with trailing bytes", stream: { dict: "/Filter /FlateDecode", data: Uint8Array.from([...z, 0x0a, 0x0a, 0x0a]) }, ok: true },
    { label: "a stream cut short", stream: { dict: "/Filter /FlateDecode", data: z.subarray(0, z.length - 40) }, ok: false },
    { label: "a filter it does not know", stream: { dict: "/Filter /LZWDecode", data }, ok: false },
  ];
  for (const { label, stream, ok } of cases) {
    const r = reading(await extractPdfStructure(withFile(stream)));
    const got = intra(r);
    assert.equal(got.length, 1, label);
    const first = must(got[0], label);
    if (ok) {
      assert.equal(first.partition, "intra", label);
      const rec = intraLink(first, label);
      assert.equal(rec.target.sha256, want, label);
      assert.equal(rec.target.bytes, data.length, label);
    } else {
      assert.equal(whyOf(first), "embedded_stream_undecodable", label);
    }
  }
  /* a PNG predictor is undone, as it was: the record is the hash of what the predictor leaves */
  const cols = 10, rows = noise(cols * 6, 5);
  const framed = new Uint8Array(rows.length + 6);
  for (let r = 0; r < 6; r++) { framed[r * (cols + 1)] = 0; framed.set(rows.subarray(r * cols, r * cols + cols), r * (cols + 1) + 1); }
  const pred = reading(await extractPdfStructure(withFile({ dict: `/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns ${cols} >>`, data: new Uint8Array(deflateSync(framed)) })));
  assert.equal(intraLink(intra(pred)[0], "predictor").target.sha256, sha256(rows));
});

/** The child's `embedded` reading of `file`, run in a process of its own.
 *  @param {string} file
 *  @returns {Promise<ChildEnd>} */
function child(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--expose-gc", CHILD, "embedded", file], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", /** @param {Buffer} d */ (d) => (out += d));
    p.stderr.on("data", /** @param {Buffer} d */ (d) => (err += d));
    p.on("close", /** @param {number | null} code @param {string | null} signal */ (code, signal) => resolve({ code, signal, out, err }));
  });
}

test("R22: a 60 MiB embedded file is hashed without being held: heap + array buffers stay far under its size, and its hash is exact", async () => {
  /* 60 MiB of text that compresses to a small stream, so the file is small and everything held is what the reader holds */
  const unit = noise(4096, 11);
  const big = new Uint8Array(60 * 1048576);
  for (let o = 0; o < big.length; o += unit.length) big.set(unit, o);
  const want = sha256(big);
  const dir = mkdtempSync(join(tmpdir(), "pdf-embedded-"));
  try {
    const file = join(dir, "big.pdf");
    writeFileSync(file, withFile({ dict: "/Type /EmbeddedFile /Filter /FlateDecode", data: new Uint8Array(deflateSync(big, { level: 9 })) }));
    const r = await child(file);
    assert.equal(r.code, 0, r.err.slice(-400));
    const m = embeddedReport(r.out);
    assert.equal(m.ok, true);
    assert.deepEqual(m.intra, [{ sha: want, bytes: big.length }]);
    assert.ok(m.peakMB < 24, `peak ${m.peakMB.toFixed(1)} MB above the baseline for a 60 MiB embedded file`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
