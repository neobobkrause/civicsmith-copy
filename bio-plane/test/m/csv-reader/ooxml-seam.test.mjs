/* csv-reader R7, the seam with ooxml's `decodeText` (its R36; the plan's section 2c, interface 5). csv-reader decides an
   encoding per window and decodes each field under it, which a whole-bytes `decodeText` cannot stream, so this module keeps
   its own decision; this seam test is the agreement between the two on whole bodies: where ooxml's job merges `decodeText`,
   the encoding it names for a body is the one `dialect()` names. Green since OOXML #4 merged (K4864). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry } from "../../../src/csv-reader/index.mjs";
import * as ooxml from "../../../src/ooxml.mjs";
import { enc } from "./fixtures.mjs";

const u16le = (s, bom) => { const out = bom ? [0xff, 0xfe] : []; for (const c of s) { const n = c.charCodeAt(0); out.push(n & 255, n >> 8); } return new Uint8Array(out); };

test("R7 seam (ooxml decodeText, merged by OOXML #4): the encoding decodeText names for a body is the encoding dialect() names", () => {
  assert.equal(typeof ooxml.decodeText, "function", "ooxml.decodeText is merged (plan 2c.5)");
  const bodies = [
    ["utf-8, BOM", new Uint8Array([0xef, 0xbb, 0xbf, ...enc("a,é\n1,2\n")]), "utf-8"],
    ["utf-8, no BOM", enc("a,é’日本\n1,2\n"), "utf-8"],
    ["windows-1252", Uint8Array.from("a,caf\xe9\n1,\x93q\x94\n", (c) => c.charCodeAt(0)), "windows-1252"],
    ["utf-16le, BOM", u16le("a,é\n1,2\n", true), "utf-16le"],
    ["utf-16le, no BOM", u16le("a,b,cde\n1,2,3f\n", false), "utf-16le"],
  ];
  for (const [name, body, want] of bodies) {
    const seen = ooxml.decodeText(body, { name: "x.csv", kind: "text" });
    assert.equal(seen.ok, true, name);
    assert.equal(seen.encoding, want, `${name}: decodeText`);
    assert.equal(csvEntry.dialect(body).encoding, want, `${name}: dialect()`);
    assert.equal(csvEntry.dialect(body).assumed, seen.assumed, `${name}: assumed`);
  }
});
