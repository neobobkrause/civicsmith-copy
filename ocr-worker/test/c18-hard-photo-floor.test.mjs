/* pdf-pixels R44 (C18, T51 fix round 2), proved through this module's engine; and ocr-worker R24, which rests on it: the
 * engine reads the PREPARED picture, and the preparation is what makes the walk's hard photograph readable.
 *
 * Taken from pdf-pixels' pagepixels.test.mjs (ARCH's module-list decision, 22 Nov 2026, item 9): that block reached this
 * module's engine and model, so it lives with the engine. The photographs are this module's own fixtures, the same bytes
 * as pdf-pixels' `picture-variants.json` pages of the same names, with their words in `page-words.json`.
 *
 * `page-hard` is the walk's hard photograph: 231 words of small print at 110 dpi, tilted 2.4 degrees, with perspective,
 * noise and blur 1.0. Measured through the engine: unprepared 2 percent of its words, prepared 56 percent, so the floor on
 * it is 52 percent. `page-hard-blur` leaves nothing to read in a smaller page (under 10 percent; stating its legibility is
 * R25's, `g128i-l26-photo.test.mjs`), so no floor is claimed there, only that the preparation never reads less of it.
 * The share read counts each word of the page once per occurrence, case and punctuation ignored. */
import "../../bio-plane/test/sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readFrame } from "../src/frame.mjs";
import { pngToSamples, samplesToRgba } from "../src/pngsamples.mjs";
import { createOCREngine } from "../src/tesslib.mjs";
import { WASM, MODEL } from "./memberworker.mjs";
import { renderPictureToPixels } from "../../pdf-worker/src/picturepixels.mjs";

const HARD_FLOOR = 0.52;
const FIX = (n) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url))));
const TRUTH = JSON.parse(Buffer.from(FIX("page-words.json")).toString("utf8"));

const wasmCore = await WebAssembly.compile(readFileSync(WASM));
const modelBytes = readFileSync(MODEL);
const makeEngine = () => createOCREngine({ instantiateWasm: (info, receive) => { const i = new WebAssembly.Instance(wasmCore, info); receive(i, wasmCore); return i.exports; }, locateFile: (p) => p });

const words = (x) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const shareRead = (truth, got) => {
  const left = new Map(); for (const w of words(got)) left.set(w, (left.get(w) || 0) + 1);
  const want = words(truth); let hit = 0;
  for (const w of want) if (left.get(w) > 0) { hit++; left.set(w, left.get(w) - 1); }
  return want.length ? hit / want.length : 0;
};

/** the share of a photograph's words the engine reads, prepared or not, as the member asks the picture renderer (R23, R24) */
async function shareOf(name, prepare) {
  const r = await renderPictureToPixels(FIX(`${name}.jpg`), 0, { maxEdge: 4096, grey: true, ...(prepare ? { prepare: true } : {}) });
  assert.equal(r.ok, true, `${name}: the picture renderer refused it: ${JSON.stringify(r).slice(0, 200)}`);
  const s = await pngToSamples(r.bytes);
  assert.equal(s.ok, true, `${name}: the rendered PNG could not be read`);
  const out = await readFrame(makeEngine, modelBytes, samplesToRgba(s), s.width, s.height);
  assert.equal(out.ok, true, `${name}: the engine failed: ${JSON.stringify(out).slice(0, 200)}`);
  return shareRead(TRUTH[name], out.regions.map((g) => g.text).join(" "));
}

test(`pdf-pixels R44 (C18), ocr-worker R24: page-hard, the walk's hard photograph, is read at least ${HARD_FLOOR * 100} percent prepared, and under that floor unprepared`, { timeout: 600_000 }, async () => {
  const prepared = await shareOf("page-hard", true), raw = await shareOf("page-hard", false);
  console.log(`        page-hard: prepared ${Math.round(prepared * 100)} %, unprepared ${Math.round(raw * 100)} %`);
  assert.ok(prepared >= HARD_FLOOR, `prepared, ${prepared.toFixed(2)} of its words were read`);
  assert.ok(raw < HARD_FLOOR, `control: unprepared, ${raw.toFixed(2)} were read, so the preparation is not the cause`);
});

test("pdf-pixels R44 (C18) control: the preparation never reads fewer of page-hard-blur's words than the unprepared picture", { timeout: 600_000 }, async () => {
  const prepared = await shareOf("page-hard-blur", true), raw = await shareOf("page-hard-blur", false);
  console.log(`        page-hard-blur: prepared ${Math.round(prepared * 100)} %, unprepared ${Math.round(raw * 100)} %`);
  assert.ok(prepared >= raw, `prepared ${prepared.toFixed(2)}, unprepared ${raw.toFixed(2)}`);
});
