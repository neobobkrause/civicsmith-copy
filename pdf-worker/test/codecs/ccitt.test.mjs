/* image-codecs R2, R6: `ccittDecode` at its interface (build/requirements/image-codecs.md).
 *
 * INDEPENDENT EXPECTATIONS (R6). Every expected picture is libtiff's decode of the
 * same stream, written by `fixtures/make-ccitt-fixtures.py` into
 * `fixtures/ccitt-variants.json`: libtiff shares no line with `ccittdecode.mjs`.
 * The scan's stream is a real council resolution's (84,797 B, G4), and libtiff's
 * digest of it is the one the page fixtures have carried since 2026-08-08. If a
 * fixture changes, re-run the script; never copy a failing run's output. */
import "../../../bio-plane/test/sandbox.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ccittDecode } from "../../src/ccittdecode.mjs";

/** One stream of `fixtures/ccitt-variants.json` and libtiff's decode of it.
 *  @typedef {Object} Variant
 *  @property {string} name
 *  @property {string} coding "group4", "group3" or "tiff_ccitt"
 *  @property {number} K
 *  @property {number} columns
 *  @property {number} rows
 *  @property {boolean} byteAlign
 *  @property {string} data_b64 the stream, base64
 *  @property {number} rows_expected the rows libtiff decoded
 *  @property {string} libtiff_sha256 the digest of libtiff's picture, padding bits 0
 *  @property {number} white the 1-bits in libtiff's picture */
/** @typedef {Object} CcittFixtures @property {string} provenance @property {Variant[]} variants */

const FIX = /** @type {CcittFixtures} decodes the recorded ccitt-variants.json, written by make-ccitt-fixtures.py */ (JSON.parse(readFileSync(new URL("fixtures/ccitt-variants.json", import.meta.url), "utf8")));
const V = FIX.variants;
/** @param {Variant} v @returns {Uint8Array} */
const bytesOf = (v) => new Uint8Array(Buffer.from(v.data_b64, "base64"));
/** @param {Variant} v @param {{ K?: number, rows?: number }} [extra]
 *  @returns {{ K?: number | undefined, columns?: number | undefined, rows?: number | undefined, byteAlign?: boolean | undefined }} */
const optsOf = (v, extra = {}) => ({ K: Object.hasOwn(extra, "K") ? extra.K : v.K, columns: v.columns, rows: Object.hasOwn(extra, "rows") ? extra.rows : v.rows, byteAlign: v.byteAlign });
/** @param {Uint8Array} b @returns {string} */
const sha = (b) => createHash("sha256").update(b).digest("hex");
/** The one fixture `pick` names (none is a broken fixture file). @param {(v: Variant) => boolean} pick @returns {Variant} */
function variant(pick) {
  const v = V.find(pick);
  if (v === undefined) throw new Error("ccitt-variants.json lacks the fixture this test names");
  return v;
}

/** The decoder's rows with the bits past the last column cleared: R2 packs rows
 *  to a byte and says nothing of the padding, libtiff's reference pads with 0.
 *  @param {Uint8Array} packed @param {number} columns @param {number} rows @returns {Uint8Array} */
function padded0(packed, columns, rows) {
  const rb = Math.ceil(columns / 8), out = Uint8Array.from(packed.subarray(0, rb * rows));
  const keep = columns % 8 ? (0xff << (8 - (columns % 8))) & 0xff : 0xff;
  for (let y = 0; y < rows; y++) { const at = y * rb + rb - 1; out[at] = (out[at] ?? NaN) & keep; }
  return out;
}
const BITS = Uint8Array.from({ length: 256 }, (_, i) => [...i.toString(2)].filter((c) => c === "1").length);
/** @param {Uint8Array} b @returns {number} */
const popcount = (b) => b.reduce((n, x) => n + (BITS[x] ?? NaN), 0);

test("R2 R6 the fixtures: libtiff's decode of every coding R2 names, the scan included", () => {
  assert.match(FIX.provenance, /^libtiff /);
  const codings = new Set(V.map((v) => `${v.coding}:${v.K}:${v.byteAlign}`));
  assert.deepEqual([...codings].sort(), ["group3:0:false", "group4:-1:false", "tiff_ccitt:0:true"]);
  assert.ok(V.some((v) => v.name === "scan-page-group4" && v.libtiff_sha256 === "e54f07066bcf32a7b105cf43bb331e29c95dafa05e1cf0176c2164811f3417ef"));
  for (const v of V) assert.match(v.libtiff_sha256, /^[0-9a-f]{64}$/, v.name);
});

test("R2 R6 every fixture decodes to libtiff's picture, one packed row per row", () => {
  for (const v of V) {
    const out = ccittDecode(bytesOf(v), optsOf(v));
    assert.equal(out.rowsDecoded, v.rows_expected, `${v.name}: rows`);
    assert.equal(out.packed.length, Math.ceil(v.columns / 8) * out.rowsDecoded, `${v.name}: packed length`);
    const mine = padded0(out.packed, v.columns, out.rowsDecoded);
    assert.equal(sha(mine), v.libtiff_sha256, `${v.name}: libtiff's picture`);
    assert.equal(popcount(mine), v.white, `${v.name}: white bits`);
  }
});

test("R2 Group 4 and Group 3 one-dimensional, each against the same picture", () => {
  /** @type {Array<[string, string]>} */
  const none = [];
  const byPicture = new Map(none);
  for (const v of V.filter((x) => x.name !== "scan-page-group4")) {
    const k = v.name.replace(/-(group4|group3|tiff_ccitt)$/, "");
    const out = ccittDecode(bytesOf(v), optsOf(v));
    const h = sha(padded0(out.packed, v.columns, out.rowsDecoded));
    if (byPicture.has(k)) assert.equal(h, byPicture.get(k), `${v.name}: the same picture as the other codings`);
    else byPicture.set(k, h);
  }
  assert.equal(byPicture.size, 6);
});

test("R2 mixed mode (K > 0) is refused", () => {
  const v = variant((x) => x.coding === "group3");
  for (const K of [1, 2, 4]) assert.throws(() => ccittDecode(bytesOf(v), optsOf(v, { K })), /mixed-mode/);
});

test("R2 a stream that cannot be read is refused", () => {
  /* Vertical-left-3 codes (0000010) with no end: a0 never advances, so no row
   * can finish; the decoder refuses rather than looping or inventing a row. */
  const bits = "0000010".repeat(400);
  const data = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") { const at = i >> 3; data[at] = (data[at] ?? NaN) | (0x80 >> (i & 7)); }
  assert.throws(() => ccittDecode(data, { K: -1, columns: 64, rows: 4 }), /did not terminate/);
});

test("R2 a stream ending early returns the rows decoded, each libtiff's, and no invented row", () => {
  const v = variant((x) => x.name === "scan-page-group4");
  const whole = ccittDecode(bytesOf(v), optsOf(v));
  const rb = Math.ceil(v.columns / 8);
  for (const cut of [20000, 42398, 84000]) {
    const out = ccittDecode(bytesOf(v).subarray(0, cut), optsOf(v));
    assert.ok(out.rowsDecoded > 0 && out.rowsDecoded < v.rows, `cut at ${cut}: fewer rows (${out.rowsDecoded})`);
    assert.deepEqual(out.packed, whole.packed.subarray(0, out.rowsDecoded * rb), `cut at ${cut}: the rows decoded are the picture's`);
  }
  /* A stream with no data at all: no rows, never a white page. */
  const none = ccittDecode(new Uint8Array(0), { K: -1, columns: 100, rows: 10 });
  assert.deepEqual([none.rowsDecoded, none.packed.length], [0, 0]);
  /* One-dimensional data cut mid-row, likewise. */
  const g3 = variant((x) => x.name === "text-1728-group3");
  const g3whole = ccittDecode(bytesOf(g3), optsOf(g3));
  const g3cut = ccittDecode(bytesOf(g3).subarray(0, 9000), optsOf(g3));
  assert.ok(g3cut.rowsDecoded < g3.rows);
  assert.deepEqual(g3cut.packed, g3whole.packed.subarray(0, g3cut.rowsDecoded * Math.ceil(g3.columns / 8)));
});

test("R2 rows not declared (0): every row the data holds", () => {
  for (const v of V.filter((x) => x.coding === "group4")) {
    const out = ccittDecode(bytesOf(v), optsOf(v, { rows: 0 }));
    assert.equal(out.rowsDecoded, v.rows_expected, v.name);
  }
});
