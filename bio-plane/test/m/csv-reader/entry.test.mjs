/* csv-reader, R1–R3: the entry's format, detection and parts() (build/requirements/csv-reader.md). Every test
 * drives the entry through its exported interface on bodies built by ./fixtures.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry } from "../../../src/csv-reader/index.mjs";
import * as F from "./fixtures.mjs";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* ------------------------------------------------------------------ R1 */

test("R1 the entry's format is csv, and it carries the registry's slots including dialect", () => {
  assert.equal(csvEntry.format, "csv");
  /** @type {[string, unknown][]} each slot by its name */
  const slots = [["detect", csvEntry.detect], ["parts", csvEntry.parts], ["structure", csvEntry.structure], ["text", csvEntry.text], ["dialect", csvEntry.dialect]];
  for (const [slot, fn] of slots) assert.equal(typeof fn, "function", `csv.${slot}`);
});

/* ------------------------------------------------------------------ R2 */

test("R2 csv detect(bytes, _) is null for every bytes value, whatever the content type", () => {
  const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const bodies = [new Uint8Array(0), new TextEncoder().encode("a,b\n1,2\n3,4\n"), new TextEncoder().encode("x;y\n"),
    zipMagic, new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62, 0x0a]), new ArrayBuffer(8)];
  for (const b of bodies) for (const ct of ["text/csv", "application/csv", "text/comma-separated-values", null]) {
    assert.equal(csvEntry.detect(b, ct), null);
  }
});

test("R2 csv detect(null, contentType): likely for text/csv, its two older synonyms and text/tab-separated-values, case-folded; null otherwise (text/plain, ms-excel and octet-stream are R21's)", () => {
  for (const ct of ["text/csv", "TEXT/CSV", "Text/Csv", "application/csv", "APPLICATION/CSV", "text/comma-separated-values", "Text/Comma-Separated-Values",
    "text/tab-separated-values", "TEXT/TAB-SEPARATED-VALUES"]) {
    const d = F.known(csvEntry.detect(null, ct), ct);
    assert.equal(d.format, "csv", ct);
    assert.equal(d.confidence, "likely");
    assert.ok(d.signals.length > 0);
    assert.deepEqual(csvEntry.detect(undefined, ct), d);
  }
  for (const ct of ["text/plain", "application/vnd.ms-excel", "application/octet-stream", XLSX_CONTENT_TYPE, "text/csvx", "csv", "", null, undefined]) {
    assert.equal(csvEntry.detect(null, ct), null, String(ct));
  }
  /* a content type that is not text at all */
  for (const ct of [42, {}]) assert.equal(csvEntry.detect(null, ct), null, String(ct));
});

/* ------------------------------------------------------------------ R3 */

test("R3 csv parts: empty_body for zero-length bytes", async () => {
  assert.deepEqual(await csvEntry.parts(new Uint8Array(0)), { ok: false, why: "empty_body" });
  assert.deepEqual(await csvEntry.parts(new ArrayBuffer(0)), { ok: false, why: "empty_body" });
  assert.deepEqual(await csvEntry.structure(new Uint8Array(0)), { ok: false, container: "csv", reason: "empty_body" });
  assert.deepEqual(await csvEntry.text(new Uint8Array(0)), { ok: false, container: "csv", reason: "empty_body" });
});

test("R3 csv parts: decoder_unavailable:<encoding> when the BOM declares an encoding the runtime cannot decode", async (t) => {
  const Real = TextDecoder;
  /* the runner's mock, undone when the test ends: a runtime with no UTF-16 decoder */
  t.mock.method(globalThis, "TextDecoder", /** @param {string} [label] @param {{ fatal?: boolean, ignoreBOM?: boolean }} [o] */ function (label, o) {
    if (/utf-16/i.test(String(label))) throw new RangeError("no decoder");
    return new Real(label, o);
  });
  const le = await csvEntry.parts(new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x2c, 0x00]));
  assert.equal(le.ok, false);
  assert.equal(F.partsRefused(le).why, "decoder_unavailable:utf-16le");
  const be = await csvEntry.parts(new Uint8Array([0xfe, 0xff, 0x00, 0x61]));
  assert.equal(F.partsRefused(be).why, "decoder_unavailable:utf-16be");
});

test("R3 csv parts: ok:true for every non-empty decodable body, whatever the dialect could determine", async () => {
  const bodies = ["a,b\n1,2\n", "one line only", "a;b\n1,2\n", "\n", "x", "caf\xe9,1\n2,3\n", "a,b;c\n1,2;3\n"];
  for (const s of bodies) {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0));
    const p = await csvEntry.parts(bytes);
    assert.equal(p.ok, true, JSON.stringify(s));
  }
  /* a byte no legacy charset defines (0x81) leaves the encoding undetermined; 0x96 is windows-1252's en dash, assumed (R7) */
  const undetermined = await csvEntry.parts(new Uint8Array([0x61, 0x81, 0x2c, 0x62, 0x0a]));
  assert.equal(undetermined.ok, true);
  assert.equal(F.partsRead(undetermined).encoding.encoding, null);
  const assumed = F.partsRead(await csvEntry.parts(new Uint8Array([0x61, 0x96, 0x2c, 0x62, 0x0a])));
  assert.equal(assumed.encoding.encoding, "windows-1252");
  assert.equal(assumed.encoding.assumed, true);
});
