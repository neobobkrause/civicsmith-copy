/* bundler F1 (walk p3dev-l3, 4 Nov): a `--test-instance` deploy marks the copy a test instance on the plane itself, by
 * binding CIVICSMITH_TEST_INSTANCE=<slug> beside INSTANCE_NAME (ai-runs R78 answers test_instance from the two being
 * equal); a production deploy never sends it, and drops one held on the script instead of keeping it (R34). Driven at
 * deriveBindings over the real plane config, and at deploy.mjs's command line in a fixture repository over the stubbed
 * account (stubfetch.mjs), as p3dev.test.mjs's command tests are. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveBindings, keptPlainText, TEST_INSTANCE_BINDING } from "../../../scripts/derive-bindings.mjs";
import { slugPlane } from "../../../scripts/p3dev.mjs";
import { parseJsonc } from "../../../scripts/jsonc.mjs";
import { makeRepo, run, rm, VERSION, PLANE, ACCOUNT } from "./repo.mjs";

const SLUG = "p3dev-l3";
const realPlane = () => parseJsonc(readFileSync(join(PLANE, "wrangler.jsonc"), "utf8"), "bio-plane/wrangler.jsonc");
const mark = (bindings) => bindings.filter((b) => b.name === TEST_INSTANCE_BINDING);
const named = (bindings, name) => bindings.find((b) => b.name === name);

test("F1: the derived bindings of a --test-instance deploy carry CIVICSMITH_TEST_INSTANCE equal to INSTANCE_NAME, a plain deploy's carry none", () => {
  assert.equal(TEST_INSTANCE_BINDING, "CIVICSMITH_TEST_INSTANCE", "the name ai-runs reads on the Worker's env");
  const test = deriveBindings(slugPlane(realPlane(), { slug: SLUG }), { slug: SLUG, version: VERSION, testInstance: true });
  assert.deepEqual(mark(test), [{ type: "plain_text", name: TEST_INSTANCE_BINDING, text: SLUG }]);
  assert.equal(named(test, "INSTANCE_NAME").text, mark(test)[0].text, "the mark equals INSTANCE_NAME, so the plane answers test_instance: true");
  assert.deepEqual(mark(deriveBindings(realPlane(), { slug: "grp", version: VERSION })), [], "a plain deploy binds no mark");
  assert.deepEqual(mark(deriveBindings(realPlane(), { slug: "grp", version: VERSION, testInstance: "yes" })), [], "only true marks it");
  /* a config var of that name decides nothing: the deploy's flag does */
  const cfg = { ...realPlane(), vars: { ...(realPlane().vars || {}), [TEST_INSTANCE_BINDING]: "grp" } };
  assert.deepEqual(mark(deriveBindings(cfg, { slug: "grp", version: VERSION })), [], "a production deploy never sends it, even from vars");
  assert.deepEqual(mark(deriveBindings(cfg, { slug: SLUG, version: VERSION, testInstance: true })).map((b) => b.text), [SLUG]);
});

test("F1, R34: a held CIVICSMITH_TEST_INSTANCE is never kept: a plain deploy drops it, other held plain_text is kept unchanged", () => {
  const held = [{ type: "plain_text", name: TEST_INSTANCE_BINDING, text: "grp" }, { type: "plain_text", name: "JURISDICTION_PROFILES", text: "x" },
    { type: "plain_text", name: "VERSION", text: "0.0.1" }, { type: "secret_text", name: "S" }];
  const derived = deriveBindings(realPlane(), { slug: "grp", version: VERSION });
  assert.deepEqual(keptPlainText(held, derived), [{ type: "plain_text", name: "JURISDICTION_PROFILES", text: "x" }]);
  assert.deepEqual(keptPlainText(held, derived, ["JURISDICTION_PROFILES"]), [], "a name the flags remove is not kept");
});

/* ---- deploy.mjs itself, in a fixture repository ---- */

const TEST_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
const repo = (account) => makeRepo({ members: { "alpha-worker": { account } },
  plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }] } } });
const ASSET = "dist/bio-plane.bundled.mjs";
const upload = (r) => r.calls.find((c) => c.method === "PUT" && c.metadata);

test("F1: deploy.mjs --test-instance uploads the plane with CIVICSMITH_TEST_INSTANCE=<slug> beside INSTANCE_NAME, and says so", async () => {
  const root = await repo(TEST_ACCOUNT);
  try {
    const stub = { subdomain: "sub", put: "accept", scripts: { [SLUG]: { body: "x", settings: {} }, [`alpha-worker-${SLUG}`]: { settings: {} } } };
    const r = run(root, "bio-plane", ["scripts/deploy.mjs", SLUG, VERSION, ASSET, "--test-instance"],
      { env: { CF_TOKEN: "t", CF_ACCT: TEST_ACCOUNT, CIVICSMITH_TEST_INSTANCE: SLUG }, stub });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const b = upload(r).metadata.bindings;
    assert.deepEqual(mark(b), [{ type: "plain_text", name: TEST_INSTANCE_BINDING, text: SLUG }]);
    assert.equal(named(b, "INSTANCE_NAME").text, SLUG);
    assert.match(r.stdout, new RegExp(`^test instance: ${TEST_INSTANCE_BINDING}=${SLUG} is bound on the plane$`, "m"));
  } finally { rm(root); }
});

test("F1: a plain deploy.mjs never uploads CIVICSMITH_TEST_INSTANCE, and removes one the script holds instead of keeping it", async () => {
  const root = await repo(ACCOUNT);
  try {
    const stub = { subdomain: "sub", put: "accept", scripts: { "alpha-worker": { settings: {} },
      grp: { body: "x", settings: { bindings: [{ type: "plain_text", name: TEST_INSTANCE_BINDING, text: "grp" }, { type: "plain_text", name: "KEPT", text: "k" }] } } } };
    const r = run(root, "bio-plane", ["scripts/deploy.mjs", "grp", VERSION, ASSET], { env: { CF_TOKEN: "t", CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "grp" }, stub });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const b = upload(r).metadata.bindings;
    assert.deepEqual(mark(b), [], "a production deploy never sends the mark");
    assert.deepEqual(named(b, "KEPT"), { type: "plain_text", name: "KEPT", text: "k" }, "control: other held plain_text is kept (R34)");
    assert.match(r.stdout, /^test instance: CIVICSMITH_TEST_INSTANCE is held on grp and is removed \(not a test deploy\)$/m);
  } finally { rm(root); }
});
