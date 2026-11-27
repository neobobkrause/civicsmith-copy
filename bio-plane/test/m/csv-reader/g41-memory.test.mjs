/* csv-reader, proposed R19 (G41, K4636): a body is read in bounded memory, whatever its size up to the bound. No record list is
   kept and no cell is made at intake, so what the reader holds is the sheet's text and its row numbers. The read runs in a child
   at a small old-space cap (`--expose-gc`), and a record list or a cell list would not fit. The figures are the job's measure
   (lowest surviving cap for an 8 MiB body: 33 MB; what it still holds after a full GC with `parts` alive: 9.8 MB); no figure is
   asserted for the largest body, which is measured at the plane's real shape (the job record). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CHILD = fileURLToPath(new URL("./g41-memory-child.mjs", import.meta.url));
const MIB = 1024 * 1024;   // the children's body sizes are written out: 8 MiB (8388608) and 50 MiB less 1 KiB (52427776)

/** @typedef {{ok: boolean, bodyBytes: number, retainedMB: number, cellsHeld: boolean, cellsNull: boolean, textHasLast: boolean, lastCell: string | null}} ChildLine */

/** The last line g41-memory-child.mjs writes, read back.
 *  @param {string} stdout the child's standard output
 *  @returns {ChildLine}
 *  @throws {TypeError} when the line is not the child's */
function childLine(stdout) {
  const text = stdout.trim().split("\n").at(-1) ?? "";
  const out = JSON.parse(text);
  const ok = typeof out === "object" && out !== null && "ok" in out ? out.ok : undefined;
  const bodyBytes = typeof out === "object" && out !== null && "bodyBytes" in out ? out.bodyBytes : undefined;
  const retainedMB = typeof out === "object" && out !== null && "retainedMB" in out ? out.retainedMB : undefined;
  const cellsHeld = typeof out === "object" && out !== null && "cellsHeld" in out ? out.cellsHeld : undefined;
  const cellsNull = typeof out === "object" && out !== null && "cellsNull" in out ? out.cellsNull : undefined;
  const textHasLast = typeof out === "object" && out !== null && "textHasLast" in out ? out.textHasLast : undefined;
  const lastCell = typeof out === "object" && out !== null && "lastCell" in out ? out.lastCell : undefined;
  if (typeof ok !== "boolean" || typeof bodyBytes !== "number" || typeof retainedMB !== "number" || typeof cellsHeld !== "boolean"
    || typeof cellsNull !== "boolean" || typeof textHasLast !== "boolean" || (typeof lastCell !== "string" && lastCell !== null)) {
    throw new TypeError(`not the child's line: ${text}`);
  }
  return { ok, bodyBytes, retainedMB, cellsHeld, cellsNull, textHasLast, lastCell };
}

test("R19 (proposed) an 8 MiB CSV is read in a 64 MB old space with its cells held, its last row in the text and its last cell made by cellsIn, holding about its own size", () => {
  const r = spawnSync(process.execPath, ["--expose-gc", "--max-old-space-size=64", CHILD, "8388608"], { encoding: "utf8", timeout: 120_000 });
  assert.equal(r.status, 0, `the read survived (status ${r.status}, signal ${r.signal}): ${String(r.stderr).slice(0, 300)}`);
  const out = childLine(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.cellsHeld, true);
  assert.equal(out.cellsNull, true);
  assert.equal(out.textHasLast, true);
  assert.equal(out.lastCell, "LASTROWMARK");
  assert.ok(out.retainedMB < 2 * (out.bodyBytes / MIB), `what the read holds is about the text it made, not a record or cell list: ${out.retainedMB.toFixed(1)} MB for ${(out.bodyBytes / MIB).toFixed(1)} MiB`);
});

test("R19 R9 (L, G131i) a 50 MiB CSV, the standard's size, is read in a 192 MB old space with its cells held and its last row reached by cellsIn", () => {
  /* The platform check of the light kinds at the standard (the capped child; the workerd isolate is 128 MB in all, which this
     figure does not claim): the body's own bytes are outside the old space, the text is about its size, the walk holds no
     record list. Measured by the job: it survives at 144 MB and not at 128 MB (the job record). */
  const r = spawnSync(process.execPath, ["--expose-gc", "--max-old-space-size=192", CHILD, "52427776"], { encoding: "utf8", timeout: 300_000 });
  assert.equal(r.status, 0, `the read survived (status ${r.status}, signal ${r.signal}): ${String(r.stderr).slice(0, 300)}`);
  const out = childLine(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.cellsHeld, true);
  assert.equal(out.textHasLast, true);
  assert.equal(out.lastCell, "LASTROWMARK");
  assert.ok(out.retainedMB < 2 * (out.bodyBytes / MIB), `what the read holds is about the text it made: ${out.retainedMB.toFixed(1)} MB for ${(out.bodyBytes / MIB).toFixed(1)} MiB`);
});

