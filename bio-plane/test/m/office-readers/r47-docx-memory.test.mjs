/* office-readers R44 (fix round 10, cause 11a; K5053): the retained-objects count is made before the part is held whole, so a docx
   of more than 250,000 objects is refused by name with {n, bound} however large its part, and the read never uses more than 85 %
   of the object's cap. C7 (walk C-7): a 19 MiB part holding 100,000 one-cell tables, refused. A12 (walk A-12): 200,000
   paragraphs, read whole. Both in a child whose old space is the cap of `capFor(128)`. */
/** @import { Undetermined, WalkExceeded } from "../../../src/docx.mjs" */
/** @import { R47Idle } from "./r47-peak-child.mjs" */
/** @import { DocRecipe } from "../../docgen.mjs" */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../../docgen.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import * as F from "./fixtures.mjs";
import { capFor } from "../../../src/byte-ledger.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";

/** @type {(file: string, args: string[], options?: {maxBuffer?: number, timeout?: number}) => Promise<{stdout: string, stderr: string}>} */
const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
/* The platform case: the object is 128 MB and the plane's own state (idle) is beside the read; the read has `capFor(128)` (78 MB)
   of old space above that state, and the module's own margin is 85 % of it. The child measures from its start (the file's bytes in
   hand) over `parts()` and `text()` both; its old space is its idle heap plus `capFor(128)`. */
/** @type {DocRecipe} */
const C7 = { kind: "docx", seed: "rw9-C-7c", ladder: "one-cell-tables", size: { partBytes: 19 * 1024 * 1024, units: 100000 } };
/** @type {DocRecipe} */
const A12 = { kind: "docx", seed: "rw9-A-12", size: { units: 200000 } };
const CAP = capFor(128);
const MARGIN = 0.85 * CAP;

/**
 * The child's answer to `--read`, as the cases read it: `refusal` the statement of the bound passed, or null.
 * @typedef {Object} R47Read
 * @property {number} aboveStartMB
 * @property {true} ok
 * @property {number | null} documentLength
 * @property {number} paragraphs
 * @property {WalkExceeded | null} refusal
 */

/**
 * The least memory above its start that two reads of the package held, in a child whose old space is its idle heap
 * plus `capFor(128)`: a docx made from `recipe`, or the pptx bytes `recipe` is.
 * @param {{after: (fn: () => void) => void, diagnostic: (message: string) => void}} t the case's context
 * @param {DocRecipe | Uint8Array} recipe
 * @param {"docx" | "pptx"} [kind]
 * @returns {Promise<R47Read>}
 */
async function measure(t, recipe, kind = "docx") {
  const dir = mkdtempSync(join(tmpdir(), "r47-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, `doc.${kind}`);
  const data = kind === "docx" && !(recipe instanceof Uint8Array) ? await generate(recipe).bytes() : recipe;
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received an instance of Object');
  }
  writeFileSync(file, data);
  const child = join(HERE, "r47-peak-child.mjs");
  const idle = /** @type {R47Idle} */ (JSON.parse((await run(process.execPath, ["--expose-gc", child, file, "--idle", kind])).stdout)).idleHeapMB;
  const oldSpace = Math.ceil(idle) + CAP;
  /** @returns {Promise<R47Read>} */
  const once = async () => /** @type {R47Read} */ (JSON.parse((await run(process.execPath, ["--expose-gc", `--max-old-space-size=${oldSpace}`, "--max-semi-space-size=2",
    child, file, "--read", kind], { maxBuffer: 1 << 26 })).stdout));
  /* the least of two: a collector that runs late shows in one run, not in both */
  const runs = [await once(), await once()];
  const best = runs.reduce((a, b) => (b.aboveStartMB < a.aboveStartMB ? b : a));
  t.diagnostic(`old space ${oldSpace} MB (idle ${idle.toFixed(1)} + capFor(128) ${CAP}); above start ${runs.map((r) => r.aboveStartMB.toFixed(1)).join(", ")} MB, the margin ${MARGIN.toFixed(1)} MB`);
  return best;
}

test("R44 (cause 11a) C7: a docx of a 19 MiB part holding 100,000 one-cell tables is refused TOO_MANY_OBJECTS with {n, bound} and the read stays within 85 % of capFor(128)", async (t) => {
  assert.equal(generate(C7).truth.units, 100000);
  const r = await measure(t, C7);
  assert.equal(r.ok, true);
  assert.equal(r.documentLength, null);
  const refusal = r.refusal;
  assert(refusal, "refused by name");
  assert.equal(refusal.bound, boundOf("office", "retained_objects"));
  assert.ok(refusal.n > refusal.bound, `n ${refusal.n}`);
  assert.equal(refusal.final, true);
  assert.ok(r.aboveStartMB <= MARGIN, `${r.aboveStartMB.toFixed(1)} MB above start is ${(100 * r.aboveStartMB / CAP).toFixed(1)} % of capFor(128) ${CAP} MB`);
});

test("R44 (cause 11a) A12: a docx of 200,000 paragraphs is read whole, within 85 % of capFor(128)", async (t) => {
  const r = await measure(t, A12);
  assert.equal(r.ok, true);
  assert.equal(r.refusal, null);
  const documentLength = r.documentLength;
  assert.ok(documentLength !== null && documentLength > 0);
  assert.equal(r.paragraphs, 200000);
  assert.ok(r.aboveStartMB <= MARGIN, `${r.aboveStartMB.toFixed(1)} MB above start is ${(100 * r.aboveStartMB / CAP).toFixed(1)} % of capFor(128) ${CAP} MB`);
});

/* the pptx twin (R44 names docx and pptx alike): one slide whose text part holds N paragraphs of a word */
/** @param {number} paragraphs @returns {Uint8Array} */
const deckOf = (paragraphs) => F.pptx({ slides: [{ file: "slide1.xml", xml: `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${"<a:p><a:r><a:t>word</a:t></a:r></a:p>".repeat(paragraphs)}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>` }] });

test("R44 (cause 11a) pptx: a deck of 280,000 paragraphs (a 9 MB slide part) is refused TOO_MANY_OBJECTS with {n, bound}, within 85 % of capFor(128)", async (t) => {
  const r = await measure(t, deckOf(280000), "pptx");
  assert.equal(r.ok, true);
  assert.equal(r.documentLength, null);
  const refusal = r.refusal;
  assert(refusal, "refused by name");
  assert.equal(refusal.bound, boundOf("office", "retained_objects"));
  assert.ok(refusal.n > refusal.bound);
  assert.equal(refusal.final, true);
  assert.ok(r.aboveStartMB <= MARGIN, `${r.aboveStartMB.toFixed(1)} MB above start`);
});

test("R44 (cause 11a) pptx control: a deck of 200,000 paragraphs is read whole, within 85 % of capFor(128)", async (t) => {
  const r = await measure(t, deckOf(200000), "pptx");
  assert.equal(r.ok, true);
  assert.equal(r.refusal, null);
  const documentLength = r.documentLength;
  assert.ok(documentLength !== null && documentLength > 0);
  assert.ok(r.aboveStartMB <= MARGIN, `${r.aboveStartMB.toFixed(1)} MB above start`);
});

test("R44 (cause 11a) every route: C7 is refused the same by text(bytes), text(parts) and structure(), and its parts() holds no body; A12 is read whole by each", async () => {
  const bytes = await generate(C7).bytes();
  const parts = await docxEntry.parts(bytes);
  assert.equal(parts.ok, true);
  assert.equal(parts.documentXml, null, "a refused body is not held");
  assert.equal(parts.documentBytes ?? null, null);
  const bound = boundOf("office", "retained_objects");
  /** @param {ReadonlyArray<Undetermined>} u */
  const refusal = (u) => u.find((x) => x.why === "TOO_MANY_OBJECTS");
  for (const t of [await docxEntry.text(bytes), await docxEntry.text(parts)]) {
    assert.equal(t.ok, true);
    assert.equal(t.document, null);
    assert.deepEqual(t.paragraphs, []);
    const r = refusal(t.undetermined);
    assert.ok(r && "bound" in r && r.bound === bound && "n" in r && r.n > bound && "final" in r && r.final === true);
  }
  const s = await docxEntry.structure(parts);
  assert(s.ok);
  const sr = refusal(s.evidentiary.undetermined);
  assert.ok(sr && "bound" in sr && sr.bound === bound && "n" in sr && sr.n > bound && "final" in sr && sr.final === true);
  const whole = await docxEntry.text(await generate(A12).bytes());
  assert(whole.ok);
  assert.equal(whole.paragraphs.length, 200000);
  assert.equal(whole.undetermined.find((x) => x.why === "TOO_MANY_OBJECTS"), undefined);
});
