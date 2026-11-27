/* ocr-worker R26 (fix round 10, cause 7; walk A8: turned and rotated pages not read upright nor stated sideways).
   A page of three lines is a sparse page: the engine's orientation claim is not dependable on it (it says 270 for every turning), so the one retry turn
   the member made on that claim turned an upright page the wrong way and tried no other. The statement R26 makes now: a page that would otherwise be refused
   (nothing read, or under R25's 0.2) is read a further way, each other quarter turn tried and the best-rated reading kept; an upright sparse page is
   never turned the wrong way. Through the member's real path: the committed engine, the real picture renderer, the real page renderer, the member's own handler. */
import "../../bio-plane/test/sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeMember } from "../src/member.mjs";
import { readFrame } from "../src/frame.mjs";
import { createOCREngine } from "../src/tesslib.mjs";
import { LEGIBLE_REFUSE_BELOW } from "../src/contract.mjs";
import { WASM, MODEL } from "./memberworker.mjs";
import { renderPictureToPixels } from "../../pdf-worker/src/picturepixels.mjs";
import { generate as generateImage } from "../../bio-plane/test/imggen.mjs";
import { generate as generatePdf } from "../../bio-plane/test/pdfgen.mjs";
/** @import { MemberEngine, CaptureBucket } from '../src/member.mjs' */
/** @import { CaptureSource } from '../src/contract.mjs' */

/** @param {Uint8Array} b @returns {string} */
const hex = (b) => createHash("sha256").update(b).digest("hex");
const wasmCore = await WebAssembly.compile(readFileSync(WASM));
const modelBytes = readFileSync(MODEL);
/** @type {MemberEngine} */
const engine = { name: "tesseract-wasm", version: "0.11.0", model: "tessdata_fast/eng", check: () => null,
  transcribeFrame: (rgba, width, height, opts) => readFrame(() => createOCREngine({ instantiateWasm: (info, receive) => { const i = new WebAssembly.Instance(wasmCore, info); receive(i, wasmCore); return i.exports; }, locateFile: /** @param {string} p */ (p) => p }), modelBytes, rgba, width, height, opts) };
/** @param {typeof renderPictureToPixels} render */
const viaBytes = (render) => /** @param {Uint8Array | CaptureSource} input @param {number} page */ async (input, page, opts) => render(input instanceof Uint8Array ? input : await input.readRange(0, input.size), page, opts);
const member = makeMember(engine, { renderPicture: viaBytes(renderPictureToPixels) });

/** @param {Uint8Array} bytes @param {number} [page] */
async function transcribe(bytes, page = 0) {
  const sha = hex(bytes), key = `scratch/captures/${sha}`;
  /** @type {CaptureBucket} */
  const bucket = { get: async (k, o) => { if (k !== key) return null; const r = o && o.range; const part = r ? bytes.subarray(r.offset, Math.min(bytes.length, r.offset + r.length)) : bytes; return { size: bytes.length, arrayBuffer: async () => part.slice().buffer }; } };
  const res = await member.fetch(new Request("http://ocr-worker/transcribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ capture_sha: sha, store: "scratch", pages: [page] }) }), { CAPTURES: bucket, VERSION: "stub-build" });
  return { status: res.status, body: await res.json() };
}

/** the turn that makes a page imggen turned by `turn` degrees upright again @param {number} turn @returns {number} */
const uprightTurn = (turn) => (360 - turn) % 360;

/** a sparse picture turned by `turn` degrees is read upright, its words read @param {number} turn */
const sparsePictureReadUpright = async (turn) => {
  const g = turn ? generateImage({ kind: "png", seed: "rw9-A-7", size: { pages: 1, lines: 3 }, degrade: { turn } }) : generateImage({ kind: "png", seed: "rw9-A-7", size: { pages: 1, lines: 3 } });
  const a = await transcribe(await g.bytes());
  assert.equal(a.status, 200);
  assert.equal(a.body.ok, true, JSON.stringify(a.body).slice(0, 400));
  assert.equal(a.body.image.turned_deg, uprightTurn(turn), `turned ${turn}: read at ${a.body.image.turned_deg}`);
  /* the share is the engine's own rating, 0.33 on these code-like lines even upright (the control), so what is judged is that it stands at R25's floor and the words are read */
  assert.ok(a.body.legibility && a.body.legibility.share >= LEGIBLE_REFUSE_BELOW, `share ${a.body.legibility && a.body.legibility.share}`);
  const text = a.body.pages[0].regions.map((r) => r.text).join("\n").toLowerCase();
  const found = g.truth.pages[0].lines.filter((line) => text.includes(line.split(" ")[1].toLowerCase()));
  assert.ok(found.length >= 2, `${found.length} of 3 lines' words read in ${JSON.stringify(text)}`);
};
test("R26 sparse picture (3 lines, upright): read upright, turned_deg 0, its words read", { timeout: 600_000 }, async () => { await sparsePictureReadUpright(0); });
test("R26 sparse picture (3 lines, turned 90): read upright, turned_deg 270, its words read", { timeout: 600_000 }, async () => { await sparsePictureReadUpright(90); });
test("R26 sparse picture (3 lines, turned 180): read upright, turned_deg 180, its words read", { timeout: 600_000 }, async () => { await sparsePictureReadUpright(180); });
test("R26 sparse picture (3 lines, turned 270): read upright, turned_deg 90, its words read", { timeout: 600_000 }, async () => { await sparsePictureReadUpright(270); });

test("R26 sparse scan (two pages of 3 lines, rotated 90 inside the PDF): each page is ok, read upright at the turn that undoes the rotation, its words read", { timeout: 600_000 }, async () => {
  const g = generatePdf({ kind: "pdf", seed: "rw9-A-8", fonts: ["type0"], size: { pages: 2, lines: 3 }, kinds: ["scan"], rotate: { every: 1, angle: 90 } });
  const bytes = await g.bytes();
  for (const page of [0, 1]) {
    const a = await transcribe(bytes, page);
    assert.equal(a.body.ok, true, `page ${page}: ${JSON.stringify(a.body).slice(0, 400)}`);
    assert.equal(a.body.image.turned_deg, uprightTurn(90), `page ${page}: read at ${a.body.image.turned_deg}`);
    /* the legibility the member states is the engine's own rating, which is low on these code-like lines (0.33 to 0.5 though every word is read), so what is judged here is the reading itself: each line's word */
    assert.ok(a.body.legibility && a.body.legibility.share >= LEGIBLE_REFUSE_BELOW, `page ${page}: share ${a.body.legibility && a.body.legibility.share}`);
    const text = a.body.pages[0].regions.map((r) => r.text).join("\n").toLowerCase();
    const found = g.truth.page(page + 1).ocr.filter((line) => text.includes(line.split(" ")[1].toLowerCase()));
    assert.ok(found.length >= 2, `page ${page}: ${found.length} of 3 lines' words read in ${JSON.stringify(text)}`);
  }
});
