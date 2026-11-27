/* N34's and N75's measurement, re-runnable: the JPX decoder's live memory
 * against its output, over real OpenJPEG codestreams of page sizes.
 *
 *   node pdf-worker/test/codecs/jpx-memory.probe.mjs
 *
 * Needs python3 with Pillow built with OpenJPEG (it writes the images). Not a
 * test: it measures, prints a table, and asserts nothing. Each image is decoded
 * in a worker thread while this thread samples that thread's V8 heap and
 * external memory every 2 ms (`worker.getHeapStatistics()`), so the figure is
 * the decode's own isolate, heap and ArrayBuffers together, with garbage not
 * yet collected included, as an isolate's memory is. Recorded in
 * build/jobs/T4/image-codecs.md (2026-09-27, the whole-plane decode) and
 * build/jobs/T9/image-codecs.md (2026-09-28, the line-based decode, N75: the
 * working set is the 8-bit output and under 2 MB of buffers for these). */
import "../../../bio-plane/test/sandbox.mjs";

import { Worker, workerData, parentPort } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** @typedef {"L" | "RGB"} Mode Pillow's mode */
/** @typedef {readonly [number, number, Mode, boolean, number | null]} ProbeImage width, height, mode, irreversible (9/7), tile edge or null */
/**
 * The worker's answer once its decode is done.
 * @typedef {Object} ProbeDecoded
 * @property {number} ms the decode's wall time
 * @property {string} decoded "WxHxC", never empty
 */
/**
 * The worker's answer once its decode is refused.
 * @typedef {Object} ProbeRefused
 * @property {number} ms the time to the refusal
 * @property {string | undefined} refused the refusal's feature, else its message
 * @property {number | undefined} working_set the working set a memory refusal declares
 */
/** @typedef {ProbeDecoded | ProbeRefused} ProbeResult */
/** @typedef {{ used_heap_size: number, external_memory: number }} HeapFigures */

/** @param {number} ms @returns {Promise<void>} */
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** @type {readonly ProbeImage[]} */
const IMAGES = [
  [1280, 1680, "L", false, null], [1280, 1680, "RGB", true, null], [1700, 2200, "RGB", true, null],
  [2000, 2600, "RGB", true, null], [2550, 3300, "L", false, null], [2550, 3300, "RGB", true, null],
  [2550, 3300, "RGB", false, null], [2550, 3300, "RGB", true, 1024], [3500, 4600, "L", true, null],
  [4400, 4600, "RGB", true, null],
];

const port = parentPort;                           // a MessagePort in a worker, null in the main thread
if (port !== null) {
  const { decodeJpx, JpxRefusal } = await import("../../src/jpxdecode.mjs");
  /** @type {string} the codestream's path in the temp folder */
  const file = workerData;
  const d = readFileSync(file);                    // a Buffer is a Uint8Array: no second copy
  await pause(50);
  const t0 = Date.now();
  try {
    const o = decodeJpx(d);
    /** @type {ProbeDecoded} */
    const done = { ms: Date.now() - t0, decoded: `${o.width}x${o.height}x${o.comps}` };
    port.postMessage(done);
  } catch (e) {
    const err = e;
    /** @type {ProbeRefused} */
    const refused = err instanceof JpxRefusal
      ? { ms: Date.now() - t0, refused: err.detail.feature ?? err.message, working_set: err.detail.working_set_bytes }
      : { ms: Date.now() - t0, refused: err instanceof Error ? err.message : undefined, working_set: undefined };   // no detail: its message
    port.postMessage(refused);
  }
} else {
  const dir = mkdtempSync(join(tmpdir(), "jpxmem-"));
  const py = `
import random, sys, json
from PIL import Image, ImageDraw
random.seed(7)
for w, h, mode, irr, tile in json.loads(sys.argv[1]):
    im = Image.new(mode, (w, h), "white"); d = ImageDraw.Draw(im)
    for i in range(400):
        x, y = random.randrange(w), random.randrange(h)
        c = tuple(random.randrange(256) for _ in range(3)) if mode == "RGB" else random.randrange(256)
        d.rectangle([x, y, x + random.randrange(10, 300), y + random.randrange(5, 40)], fill=c)
    kw = {"irreversible": irr}
    if tile: kw["tile_size"] = (tile, tile)
    im.save(sys.argv[2] + f"/{w}x{h}-{mode}-{'97' if irr else '53'}{'-t' + str(tile) if tile else ''}.j2k", "JPEG2000", **kw)
`;
  execFileSync("python3", ["-c", py, JSON.stringify(IMAGES), dir]);
  console.log("image | output MB | live peak above idle MB (heap, external) | result");
  /** @param {number} b bytes @returns {string} megabytes, one decimal */
  const mb = (b) => (b / 1e6).toFixed(1);
  for (const [w, h, mode, irr, tile] of IMAGES) {
    const f = join(dir, `${w}x${h}-${mode}-${irr ? "97" : "53"}${tile ? `-t${tile}` : ""}.j2k`);
    const nc = mode === "RGB" ? 3 : 1;
    const ws = w * h * nc;
    const worker = new Worker(new URL(import.meta.url), { workerData: f });
    /** @type {{ base: number | null }} the isolate's level at the first sample; a field, so the timer's write is seen */
    const idle = { base: null };
    let peak = 0, heap = 0, ext = 0;
    const iv = setInterval(async () => {
      try {
        /** @type {HeapFigures} */
        const s = await worker.getHeapStatistics();
        const now = s.used_heap_size + s.external_memory;
        idle.base ??= now;
        if (now > peak) { peak = now; heap = s.used_heap_size; ext = s.external_memory; }
      } catch { /* the worker has ended */ }
    }, 2);
    /** @type {ProbeResult} */
    const m = await new Promise((r) => worker.once("message", r));
    clearInterval(iv);
    await worker.terminate();
    const base = idle.base;                        // as `peak - base` did: a null base counts 0
    console.log(`${w}x${h} ${mode} ${irr ? "9/7" : "5/3"}${tile ? ` ${tile}-tiles` : ""} | ${mb(ws)} | ${mb(peak - (base ?? 0))} (${mb(heap)}, ${mb(ext)}) | ${"decoded" in m ? `decoded in ${m.ms} ms` : `refused: ${m.refused}`}`);
  }
}
