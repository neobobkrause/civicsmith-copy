/* screens-inquiry fix round 9 (T51), the seam (R-SEAM) of R130's picture refusal (G135b (4); K4426 check "Still MISSING" row 7; K4990): the whole path from the member's own upload of a
 * picture the OCR member refuses to what the Document page draws, over the REAL plane and the REAL OCR member (both booted by Miniflare from their own code, the member from its
 * committed bytes), nothing scripted: the refusal is the member's own, `IMAGE_TOO_LARGE`, carried by reading-pipeline as the reading's `ocr_refused`. The page draws it with the word
 * held for the code (`refusal.IMAGE_TOO_LARGE`), never as the generic "declined (PAGE_NOT_RENDERABLE)"; the test asserts the key's word (K3810), never a sentence. */
import "../../sandbox.mjs";
import "./fixtures.mjs"; /* registers every owner's declarations before anything reads an op (R81) */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { boot, counted } from "../interface-shell/harness.mjs";
import { generate } from "../../imggen.mjs";
import { SCREENS, main, word } from "./fixtures.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
/* the member booted from its committed bytes (what ocr-worker's own helper does; ocr-worker is not in this module's `uses`, so the recipe is stated here) */
const MEMBER = (f) => fileURLToPath(new URL("../../../../ocr-worker/" + f, import.meta.url));
const ocrWorkerDef = () => ({ name: "ocr-worker", modulesRoot: MEMBER(""), compatibilityDate: "2026-07-01", r2Buckets: ["CAPTURES"], bindings: { VERSION: "test" },
  modules: [{ type: "ESModule", path: MEMBER("dist/ocr-worker.bundled.mjs"), contents: readFileSync(MEMBER("dist/ocr-worker.bundled.mjs"), "utf8") },
    { type: "CompiledWasm", path: MEMBER("assets/tesseract-core.wasm"), contents: readFileSync(MEMBER("assets/tesseract-core.wasm")) },
    { type: "Data", path: MEMBER("assets/eng.traineddata"), contents: readFileSync(MEMBER("assets/eng.traineddata")) }] });
const ADM = "adm-r9refuse-0123456789abcdef", PASSWORD = "the founder's long password";
const mf = new Miniflare({ workers: [
  { name: "plane", modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
    serviceBindings: { OCR_WORKER: "ocr-worker" },
    bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-r9refuse-0123456789abcdef", PROBE_TOKEN: "prb-r9refuse-0123456789abcdef", VERSION: "4.6.0", INSTANCE_NAME: "r9refuse-town",
                GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" } },
  ocrWorkerDef(),
] });
after(() => mf.dispose());
const ORIGIN = "https://group.example";
const door = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);
async function founder() {
  await (await door("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) })).arrayBuffer();
  const signed = await (await door("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  return { authorization: `Bearer ${signed.result.token}` };
}
const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
  call: async (op, { query = {}, body } = {}) => (await door(`/api/?${new URLSearchParams({ op, ...query })}`, { method: body === undefined ? "GET" : "POST",
    headers: { ...auth, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json() });
const rawForwarded = (auth) => Object.fromEntries(Object.keys(OPS).map((op) => [op, async (req) => {
  const r = await door(`/api/?${new URLSearchParams({ ...req.query, op })}`, { method: req.body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
    ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }) });
  return { status: r.status, json: await r.json().catch(() => null) };
}]));
/** every forwarding function is counted, so `settle()` waits on a late forwarded read (interface-shell K5242) */
const forwarded = (auth) => Object.fromEntries(Object.entries(rawForwarded(auth)).map(([op, f]) => [op, counted(f)]));
const upload = async (auth, bytes, name, type) => (await (await door(`/api/?op=captureupload&statement=r9refuse&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, { method: "POST", headers: auth, body: bytes })).json()).result;
const until = async (p, done, ms = 60000) => {
  const end = Date.now() + ms;
  for (;;) { await p.settle(20); if (done()) return true; if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)); }
};
const text = (el) => String(el && el.textContent || "");

test("R130 G135b (the real plane, the real OCR member) a picture the member refuses as too large: the plane's reading names the refusal's own reason, and the Document page draws the word held for IMAGE_TOO_LARGE, never PAGE_NOT_RENDERABLE", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  /* a PNG whose frame is far over the picture renderer's bound: the member refuses it on its own (no hand-built answer) */
  const img = generate({ kind: "png", seed: 9135, frame: [9000, 9000], mode: "L", size: { lines: 1 } });
  const bytes = Buffer.from(await img.bytes());
  const up = await upload(auth, bytes, "huge.png", "image/png");
  assert.ok(up && up.capture && up.document, "the upload is held: " + JSON.stringify(up).slice(0, 300));
  const promoted = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "huge.png", locator: up.document.locator, project: "" });
  assert.equal(promoted.refused, undefined, JSON.stringify(promoted).slice(0, 300));
  /* the plane's reading, waited for until the member has been asked */
  let reading = null;
  for (const end = Date.now() + 120000; Date.now() < end;) {
    reading = (await (await door(`/api/?op=reading&sha256=${up.capture.sha256}`, { headers: auth })).json()).result;
    if (reading && reading.found === true && reading.more !== true && reading.reading && Array.isArray(reading.reading.ocr_refused)) break;
    await new Promise((x) => setTimeout(x, 400));
  }
  const refused = reading && reading.reading && reading.reading.ocr_refused;
  assert.ok(Array.isArray(refused) && refused.length === 1, "the plane's reading lists the page the member refused: " + JSON.stringify(reading).slice(0, 600));
  assert.equal(refused[0].reason, "IMAGE_TOO_LARGE", "with the member's own reason, not PAGE_NOT_RENDERABLE");
  const p = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/document/" + promoted.bundleId });
  await until(p, () => !!main(p).querySelector("[data-text-state]"));
  const shown = text(main(p));
  assert.ok(shown.includes(word("refusal.IMAGE_TOO_LARGE")), "the page draws the word held for the refusal's code");
  assert.ok(!/PAGE_NOT_RENDERABLE|declined \(/.test(shown), "and never the generic declined sentence or the member's code");
});
