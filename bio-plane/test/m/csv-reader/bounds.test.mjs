/* csv-reader R6 and R22 (fix round 9, G124 quotes; K4835 (1)): the ceilings this module keeps are runtime-limits' rows,
   taken through `boundOf`, with no numeric literal for a ceiling here. The behaviour at each limit is tested in text.test.mjs
   (R6, R22), standard-size.test.mjs and large-text.test.mjs; this file is the one quote check the plan's G124 asks for: the
   module's own declaration of each ceiling resolves to the table (K3268: no figure listed by hand in the test). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MEASURED_CSV_TEXT_BOUND_BYTES } from "../../../src/csv-reader/index.mjs";
import { boundOf, READ_BOUNDS } from "../../../src/read-bounds.mjs";

const SOURCE = readFileSync(new URL("../../../src/csv-reader/index.mjs", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("R6 the bytes ceiling is the csv bytes row of READ_BOUNDS at its active figure: the standard's, since the light kinds take it (K4834)", () => {
  assert.equal(MEASURED_CSV_TEXT_BOUND_BYTES, boundOf("csv", "bytes"));
  const row = READ_BOUNDS.csv?.bytes;
  if (!row) assert.fail("READ_BOUNDS has no csv/bytes row");
  assert.equal(MEASURED_CSV_TEXT_BOUND_BYTES, row.standard);
  assert.ok(MEASURED_CSV_TEXT_BOUND_BYTES > row.alpha, "no longer the alpha figure of 17 MiB");
});

test("R6 R22 the module declares its ceilings through boundOf and holds no numeric literal for one", () => {
  /** @type {[string, string, string][]} each constant's name, and the kind and row it resolves to */
  const ceilings = [["MEASURED_CSV_TEXT_BOUND_BYTES", "csv", "bytes"], ["CSV_ROWS_MAX", "csv", "rows"], ["CSV_COLUMNS_MAX", "sheet", "columns"],
    ["CELL_CHARS_MAX", "sheet", "cell_chars"], ["CELL_KEPT_CHARS", "sheet", "cell_kept_chars"]];
  for (const [name, kind, row] of ceilings) {
    assert.match(SOURCE, new RegExp(`const ${name} = boundOf\\("${kind}", "${row}"\\)`), `${name} resolves to the ${kind}.${row} row`);
  }
  for (const literal of [/\b17\s*\*\s*1024/, /\b20\s*\*\s*1024/, /\b24\s*\*\s*1024/, /\b32\s*\*\s*1024/, /\b50\s*\*\s*1024/, /\b50000000\b/, /\b52428800\b/, /\b1048576\b/, /\b16384\b/, /\b32767\b/]) {
    assert.doesNotMatch(SOURCE, literal, `no literal ${literal} for a ceiling`);
  }
});
