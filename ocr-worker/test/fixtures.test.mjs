/* The fixtures ocr-worker publishes (`fixtures.mjs`), each called here and its real answer checked (K4990, K4995).
   `// fixtures-run:` lines name the user module and the fixture id whose contract this runs against the real code. */
import "../../bio-plane/test/sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { memberRefusal, pageNotRenderable, memberWorker } from "./fixtures.mjs";

// memberRefusal's real answers (extraction imports it directly: ocr-worker is earlier in the order; K4990)
/** the real member answers 200 ok:false with `reason` @param {string} reason */
const refusesWith = async (reason) => {
  const a = await memberRefusal(reason);
  assert.equal(a.ok, false);
  assert.equal(a.reason, reason);
  assert.ok(a.refusal && a.refusal.reason === reason, JSON.stringify(a).slice(0, 300));
  assert.ok(Array.isArray(a.deferred) && Array.isArray(a.notes));
};
test("fixture memberRefusal(PAGE_NOT_LEGIBLE): the real member answers 200 ok:false with that reason", async () => { await refusesWith("PAGE_NOT_LEGIBLE"); });
test("fixture memberRefusal(PIXELS_UNREADABLE): the real member answers 200 ok:false with that reason", async () => { await refusesWith("PIXELS_UNREADABLE"); });
test("fixture memberRefusal(ENGINE_FAILED): the real member answers 200 ok:false with that reason", async () => { await refusesWith("ENGINE_FAILED"); });
test("fixture memberRefusal(UNEXPECTED_FAILURE): the real member answers 200 ok:false with that reason", async () => { await refusesWith("UNEXPECTED_FAILURE"); });

test("fixture memberRefusal: a reason the member does not give is refused by the fixture", async () => {
  await assert.rejects(() => memberRefusal("busy"), /no such reason/);
});

// pageNotRenderable's real answer (reading-pipeline imports it directly: ocr-worker is earlier in the order; K4990)
test("fixture pageNotRenderable: the real member's PAGE_NOT_RENDERABLE with the renderer's own reason beside it", async () => {
  for (const renderReason of ["NOT_A_PDF", "EMPTY_FILE"]) {
    const a = await pageNotRenderable({ renderReason });
    assert.equal(a.ok, false);
    assert.equal(a.reason, "PAGE_NOT_RENDERABLE");
    assert.equal(a.page, 0);
    assert.deepEqual(a.deferred, []);
    assert.ok(Array.isArray(a.notes));
    const refusal = a.refusal;
    const render = refusal && refusal.render;
    assert.ok(render && typeof render.reason === "string" && render.detail !== undefined, JSON.stringify(a.refusal).slice(0, 300));
  }
});

// memberWorker's real answers (reading-pipeline imports it directly: ocr-worker is earlier in the order; K4990)
test("fixture memberWorker: the real member behind a front that logs the pages asked and applies one deviation to its real answers", { timeout: 600_000 }, async () => {
  /** @param {Miniflare} mf @param {string} name @param {string} sha @param {number[]} pages */
  const askPage = async (mf, name, sha, pages) => await (await (await mf.getWorker(name)).fetch("http://f/transcribe", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ capture_sha: sha, store: "scratch", pages }) })).json();
  const results = {};
  for (const mode of ["ok", "throw", "refuse", "version", "stray"]) {
    const fx = await memberWorker({ mode });
    const mf = new Miniflare({ workers: fx.workers });
    try {
      await fx.prepare(mf);
      const bucket = await mf.getR2Bucket("CAPTURES", fx.realName);
      await bucket.put(`scratch/captures/${fx.readable.sha}`, fx.readable.bytes);
      const out = {};
      if (mode === "throw") {
        const w = await mf.getWorker("ocr-worker");
        out.threw = await w.fetch("http://f/transcribe", { method: "POST", body: JSON.stringify({ capture_sha: fx.readable.sha, store: "scratch", pages: [3, 4] }) }).then((r) => r.status === 200 ? "answered" : "failed", () => "failed");
        out.page0 = await askPage(mf, "ocr-worker", fx.readable.sha, [0]);
      } else if (mode === "refuse") {
        out.refused = await askPage(mf, "ocr-worker", fx.readable.sha, [0, 1]);
        out.read = await askPage(mf, "ocr-worker", fx.readable.sha, [1]);
      } else if (mode === "version") {
        out.other = await askPage(mf, "ocr-worker", fx.readable.sha, [4]);
        out.same = await askPage(mf, "ocr-worker", fx.readable.sha, [0]);
      } else if (mode === "stray") {
        out.stray = await askPage(mf, "ocr-worker", fx.readable.sha, [2]);
      } else out.ok = await askPage(mf, "ocr-worker", fx.readable.sha, [0]);
      out.log = await fx.log(mf);
      results[mode] = out;
    } finally { await mf.dispose(); }
  }
  assert.equal(results.ok.ok.ok, true, JSON.stringify(results.ok.ok).slice(0, 300));
  assert.deepEqual(results.ok.log, [[0]]);
  assert.equal(results.throw.threw, "failed", "the member throws on page 3");
  assert.equal(results.throw.page0.ok, true);
  assert.deepEqual(results.throw.log, [[3, 4], [0]]);
  assert.equal(results.refuse.refused.ok, false);
  assert.equal(results.refuse.refused.reason, "PAGE_NOT_RENDERABLE");
  assert.deepEqual(results.refuse.refused.deferred, [1]);
  assert.equal(results.refuse.read.ok, true);
  assert.equal(results.refuse.read.pages[0].page, 1);
  assert.equal(results.version.other.version, "0.12.0");
  assert.notEqual(results.version.same.version, "0.12.0");
  assert.equal(results.stray.stray.pages[0].page, 5);
});
