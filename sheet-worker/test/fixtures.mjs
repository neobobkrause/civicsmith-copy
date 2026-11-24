/* Fixtures sheet-worker publishes for the tests of other modules (fixtures rule, K4990): each is made by this module's
 * real code when the test runs, never stored. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeEngine } from "../src/enginecore.mjs";
import { makeMember } from "../src/member.mjs";

const MODULE = new WebAssembly.Module(readFileSync(fileURLToPath(new URL("../assets/sheet-engine.wasm", import.meta.url))));

/** The real member's answer to a recompute request while `SHEET_RECOMPUTE` is unset: `{ok:false, reason:"NOT_ENABLED"}`
 *  with its `not_recomputed` and `detail`, answered 200 before any bytes are read (R2). The body, parsed. */
export async function recomputeNotEnabled() {
  const member = makeMember(makeEngine(MODULE));
  const req = new Request("https://sheet-worker/recompute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ capture_sha: "ab".repeat(32), store: "bio" }),
  });
  const res = await member.fetch(req, {});
  return res.json();
}
