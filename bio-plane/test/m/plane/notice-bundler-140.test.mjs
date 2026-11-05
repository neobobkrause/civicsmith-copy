/* Provider notice bundler:140 (PR 140: `deriveBindings` changed; `TEST_INSTANCE_BINDING` and `keptPlainText` added, F1).
   This module's use of bundler is its deployment config (R7, R27): `deploy.mjs` derives the plane's bindings from
   `wrangler.jsonc` with `deriveBindings`. Confirmed with no code change: the plane's config declares no test-instance mark
   in its `vars`, so whether a deploy is a test instance (ai-runs R78) is the deploy's flag, never the config, and the
   bindings R7 and R27 name (`STORE`'s class aside, the `FILE_SCANNER` service, the `vars`) are derived as before.
   Control: the same config deployed with the test flag carries the mark, bound to the slug. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "../../../scripts/jsonc.mjs";
import { deriveBindings, keptPlainText, TEST_INSTANCE_BINDING } from "../../../scripts/derive-bindings.mjs";

const PLANE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const cfg = parseJsonc(readFileSync(join(PLANE, "wrangler.jsonc"), "utf8"));

test("notice bundler:140 (R7, R27): the plane's wrangler.jsonc carries no test-instance mark, so a production deploy of it binds none and keeps none held; FILE_SCANNER and the config's vars are derived as before; control: a --test-instance deploy binds the mark to the slug", () => {
  assert.equal(Object.hasOwn(cfg.vars || {}, TEST_INSTANCE_BINDING), false, "the config declares no test-instance mark");
  const prod = deriveBindings(cfg, { slug: "p3dev-plane", version: cfg.vars.VERSION });
  assert.equal(prod.some((b) => b.name === TEST_INSTANCE_BINDING), false);
  assert.deepEqual(prod.find((b) => b.name === "FILE_SCANNER"), { type: "service", name: "FILE_SCANNER", service: "file-scanner" });
  for (const [k, v] of Object.entries(cfg.vars)) assert.equal(prod.find((b) => b.name === k)?.text, String(v), k);
  /* a mark held on the script from an earlier test deploy is not kept by a production one */
  const held = [{ type: "plain_text", name: TEST_INSTANCE_BINDING, text: "p3dev-plane" }];
  assert.deepEqual(keptPlainText(held, prod), []);
  /* control: the deploy's flag, never the config, binds it */
  const testDeploy = deriveBindings(cfg, { slug: "p3dev-plane", version: cfg.vars.VERSION, testInstance: true });
  assert.deepEqual(testDeploy.filter((b) => b.name === TEST_INSTANCE_BINDING),
    [{ type: "plain_text", name: TEST_INSTANCE_BINDING, text: "p3dev-plane" }]);
});
