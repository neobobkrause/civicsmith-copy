/* The committed bundle, booted under workerd (miniflare) with its wasm as the CompiledWasm part the platform compiles
 * at upload: the path a deployed member takes, end to end, through a real R2 binding. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import * as contract from "../src/contract.mjs";
import { workbook } from "./xlsx.mjs";
import { MEMBER_DIR, WASM_PATH, SHA } from "./helpers.mjs";

const BUNDLE = `${MEMBER_DIR}dist/sheet-worker.bundled.mjs`;

function boot(bindings) {
  return new Miniflare({
    modulesRoot: MEMBER_DIR,
    modules: [
      { type: "ESModule", path: BUNDLE, contents: readFileSync(BUNDLE, "utf8") },
      { type: "CompiledWasm", path: WASM_PATH, contents: readFileSync(WASM_PATH) },
    ],
    compatibilityDate: "2026-07-01",
    r2Buckets: ["CAPTURES"],
    bindings: { VERSION: "test", ...bindings },
  });
}

const on = boot({ SHEET_RECOMPUTE: "on" });
const off = boot({ SHEET_RECOMPUTE: "off" });
after(() => Promise.all([on.dispose(), off.dispose()]));

const WB = workbook({ sheets: [{ name: "S", cells: [{ r: "A1", v: 0.1 }, { r: "A2", f: "A1+0.2", v: 0.30000000000000004 },
  { r: "A3", f: "TODAY()", v: 0 }, { r: "A4", f: "@A1:A2", v: 0 }] }] });

async function put(mf, key, bytes) {
  const r2 = await mf.getR2Bucket("CAPTURES");
  await r2.put(key, bytes);
}
const recompute = (mf, body) => mf.dispatchFetch("https://sheet-worker/recompute", { method: "POST", body: JSON.stringify(body) });

test("R2, R8 (workerd): the committed configuration's switch is honoured, and /version asks the loaded engine", async () => {
  await put(off, `bio/captures/${SHA}`, WB);
  const r = await recompute(off, { capture_sha: SHA, store: "bio" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).reason, "NOT_ENABLED");
  const v = await (await on.dispatchFetch("https://sheet-worker/version")).json();
  assert.deepEqual(v, {
    ok: true, name: "sheet-worker", version: "test", engine: "ironcalc", engine_version: contract.ENGINE_VERSION,
    wasm_bytes: contract.WASM_BYTES, wasm_sha256: contract.WASM_SHA256, engine_loaded: true, enabled: true,
    bounds: { max_unzipped_bytes: contract.MAX_UNZIPPED_BYTES, max_cells: contract.MAX_CELLS, time_budget_ms: contract.TIME_BUDGET_MS },
  });
});

test("R1, R4, R5, R6, R10 (workerd): a workbook in R2 is recomputed by the platform-compiled engine, and the bucket is unchanged", async () => {
  await put(on, `scratch/captures/${SHA}`, WB);
  const r = await recompute(on, { capture_sha: SHA, store: "scratch" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.engine_version, contract.ENGINE_VERSION);
  const by = Object.fromEntries(body.cells.map((c) => [c.source.ref, c]));
  assert.equal(by["S!A2"].value, 0.1 + 0.2);
  assert.equal(by["S!A3"].volatile, true);
  assert.deepEqual([by["S!A4"].error, by["S!A4"].cause], ["#VALUE!", "implicit_intersection"]);
  const missing = await recompute(on, { capture_sha: "cd".repeat(32), store: "bio" });
  assert.equal(missing.status, 404);
  const r2 = await on.getR2Bucket("CAPTURES");
  const listed = await r2.list();
  assert.deepEqual(listed.objects.map((o) => o.key).sort(), [`scratch/captures/${SHA}`]);
  assert.deepEqual(new Uint8Array(await (await r2.get(`scratch/captures/${SHA}`)).arrayBuffer()), WB);
});

test("R3, R9 (workerd): refusals and unknown routes through the platform", async () => {
  await put(on, `bio/captures/${"ef".repeat(32)}`, new TextEncoder().encode("not a workbook"));
  const r = await (await recompute(on, { capture_sha: "ef".repeat(32), store: "bio" })).json();
  assert.deepEqual([r.ok, r.reason, r.not_recomputed], [false, "NOT_A_WORKBOOK", contract.NOT_RECOMPUTED]);
  const u = await on.dispatchFetch("https://sheet-worker/transcribe", { method: "POST", body: "{}" });
  assert.equal(u.status, 404);
  assert.equal((await u.json()).reason, "UNKNOWN");
});
