/* G83 (R41) and G84 (R42): `deploy.mjs --store-location / --store-generation`, and the start-up line printed after the
 * upload's answer. Driven as g54-observability.test.mjs drives the deploy: the real script in a fixture repository over the
 * stubbed account (`stubfetch.mjs`). The hint list is runtime-limits' real `STORE_HINTS` (R27), copied into the fixture:
 * these tests stay red by name until that provider has merged. The upload answer's shape in R42's tests is the documented one
 * (Cloudflare API reference, "Upload Worker Module": `result.startup_time_ms`), not a recorded real answer; the real figure
 * is read by BOB from the workflow's log at the redeploy. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { deriveStorePlace } from "../../../scripts/derive-bindings.mjs";
import { makeRepo, run, rm, VERSION, ACCOUNT, PLANE } from "./repo.mjs";

const SLUG = "grp";
const CF = { CF_TOKEN: "cf-secret-token-value", CF_ACCT: ACCOUNT };
const TEST_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
const TESTENV = { CF_TOKEN: "cf-secret-token-value", CF_ACCT: TEST_ACCOUNT, CIVICSMITH_TEST_INSTANCE: SLUG };
const testDeploy = (root, stub, flags = []) => run(root, "bio-plane", ["scripts/deploy.mjs", SLUG, VERSION, ASSET, "--test-instance", ...flags], { env: TESTENV, stub });
const ASSET = "dist/bio-plane.bundled.mjs";
const SERVICES = [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }];
const repo = () => makeRepo({ plane: { config: { services: SERVICES } } });
const deploy = (root, stub, flags = []) => run(root, "bio-plane", ["scripts/deploy.mjs", SLUG, VERSION, ASSET, ...flags], { env: CF, stub });
// fixtures-own: platform the Cloudflare API's own answers to the deploy's account calls, a scripted-network double of the platform; no module answers for them
const okStub = (extra = {}) => ({ subdomain: "sub", put: "accept", scripts: { "alpha-worker": { settings: {} } }, ...extra });
const uploads = (r) => r.calls.filter((c) => c.method === "PUT" && !c.url.endsWith("/schedules"));
const plain = (put, name) => put.metadata.bindings.find((b) => b.name === name);
const HAVE_HINTS = existsSync(join(PLANE, "src/store-place.mjs"));
const hints = async () => (await import(join(PLANE, "src/store-place.mjs"))).STORE_HINTS;
const code = (r) => /REFUSED \[([A-Z_]+)\]/.exec(r.stderr)?.[1];
/** An account whose script already holds `held` plain_text bindings (and nothing the deploy needs to change otherwise). */
const withHeld = (held) => okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: { body: "old", settings: { bindings: held.map(([name, text]) => ({ type: "plain_text", name, text })) } } } });

test("R41: runtime-limits' STORE_HINTS exists to validate against (red by name until that provider has merged)", () => {
  assert.ok(HAVE_HINTS, "bio-plane/src/store-place.mjs (runtime-limits R27) is not on this branch yet");
});

test("R41: deriveStorePlace emits each flag as a plain_text binding, refuses a bad hint or generation by name, and sends nothing for an absent flag; generation 1 sends none and removes the held one", () => {
  const H = ["wnam", "enam", "weur"];
  assert.deepEqual(deriveStorePlace({}, H), { bindings: [], remove: [] });
  assert.deepEqual(deriveStorePlace({ location: "wnam", generation: "2" }, H).bindings,
    [{ type: "plain_text", name: "STORE_LOCATION", text: "wnam" }, { type: "plain_text", name: "STORE_GENERATION", text: "2" }]);
  assert.deepEqual(deriveStorePlace({ generation: "1" }, H), { bindings: [], remove: ["STORE_GENERATION"] });
  const refusal = (a) => { try { deriveStorePlace(a, H); } catch (e) { return /\[([A-Z_]+)\]/.exec(e.message)?.[1]; } return "no refusal"; };
  for (const v of ["", "WNAM", " wnam", "wnam ", "mars", null, 5]) assert.equal(refusal({ location: v }), "BAD_STORE_LOCATION", String(v));
  for (const v of ["", "0", "02", "2.0", " 2", "-1", "+2", "1e3", "two", null, 2]) assert.equal(refusal({ generation: v }), "BAD_STORE_GENERATION", String(v));
  assert.equal(refusal({ generation: "10" }), "no refusal");
});

test("R41: --store-location and --store-generation are sent as plain_text bindings, each the value given; neither flag's value is read as a positional argument", async () => {
  const root = await repo();
  try {
    for (const flags of [["--store-location", "wnam", "--store-generation", "2"], ["--store-generation", "2", "--store-location", "wnam"]]) {
      const r = deploy(root, okStub(), flags);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const [put] = uploads(r);
      assert.deepEqual(plain(put, "STORE_LOCATION"), { type: "plain_text", name: "STORE_LOCATION", text: "wnam" });
      assert.deepEqual(plain(put, "STORE_GENERATION"), { type: "plain_text", name: "STORE_GENERATION", text: "2" });
    }
    const only = deploy(root, okStub(), ["--store-location", "apac-ne"]);
    assert.equal(only.status, 0, only.stdout + only.stderr);
    assert.equal(plain(uploads(only)[0], "STORE_LOCATION").text, "apac-ne");
    assert.equal(plain(uploads(only)[0], "STORE_GENERATION"), undefined, "a flag not given sends nothing");
  } finally { rm(root); }
});

test("R41: every hint of runtime-limits' list is accepted, and a value not on it is refused [BAD_STORE_LOCATION] before any request", async () => {
  const root = await repo();
  try {
    for (const h of await hints()) {
      const r = deploy(root, okStub(), ["--dry-run", "--store-location", h]);
      assert.equal(r.status, 0, `${h}: ${r.stdout}${r.stderr}`);
    }
    for (const bad of ["", "WNAM", " wnam", "mars"]) {
      const r = deploy(root, okStub(), ["--store-location", bad]);
      assert.equal(r.status, 1, JSON.stringify(bad));
      assert.equal(code(r), "BAD_STORE_LOCATION", JSON.stringify(bad));
      assert.deepEqual(r.calls, [], `${JSON.stringify(bad)}: refused before any request`);
    }
    for (const flags of [["--store-location"], ["--store-location", "--dry-run"]]) {
      const r = deploy(root, okStub(), flags);
      assert.equal(code(r), "BAD_STORE_LOCATION", flags.join(" ") + ": a flag with no value");
      assert.deepEqual(r.calls, []);
    }
  } finally { rm(root); }
});

test("R41: a generation that is not /^[1-9][0-9]*$/ is refused [BAD_STORE_GENERATION] before any request; controls: 2 and 10 are sent", async () => {
  const root = await repo();
  try {
    for (const bad of ["", "0", "02", "2.0", " 2", "-1", "x"]) {
      const r = deploy(root, okStub(), ["--store-generation", bad]);
      assert.equal(r.status, 1, JSON.stringify(bad));
      assert.equal(code(r), "BAD_STORE_GENERATION", JSON.stringify(bad));
      assert.deepEqual(r.calls, [], `${JSON.stringify(bad)}: refused before any request`);
    }
    assert.equal(code(deploy(root, okStub(), ["--store-generation"])), "BAD_STORE_GENERATION", "no value");
    for (const ok of ["2", "10"]) assert.equal(plain(uploads(deploy(root, okStub(), ["--store-generation", ok]))[0], "STORE_GENERATION").text, ok);
  } finally { rm(root); }
});

test("R41: with no flag no store binding is sent, and a held STORE_LOCATION and STORE_GENERATION are kept unchanged (R34's rule)", async () => {
  const root = await repo();
  try {
    const r = deploy(root, withHeld([["STORE_LOCATION", "wnam"], ["STORE_GENERATION", "2"], ["OTHER", "kept"]]));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const [put] = uploads(r);
    assert.equal(plain(put, "STORE_LOCATION").text, "wnam");
    assert.equal(plain(put, "STORE_GENERATION").text, "2");
    assert.equal(plain(put, "OTHER").text, "kept");
    const none = deploy(root, okStub());
    assert.equal(plain(uploads(none)[0], "STORE_LOCATION"), undefined);
    assert.equal(plain(uploads(none)[0], "STORE_GENERATION"), undefined);
  } finally { rm(root); }
});

test("R41: --store-generation 1 sends no STORE_GENERATION and removes a held one (the rollback), keeping a held STORE_LOCATION; a flag differing from the held value is a metadata deploy", async () => {
  const root = await repo();
  try {
    const r = deploy(root, withHeld([["STORE_LOCATION", "wnam"], ["STORE_GENERATION", "2"]]), ["--store-generation", "1"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const [put] = uploads(r);
    assert.equal(plain(put, "STORE_GENERATION"), undefined, "the held generation is gone");
    assert.equal(plain(put, "STORE_LOCATION").text, "wnam", "the location is kept");
    const change = deploy(root, withHeld([["STORE_GENERATION", "2"]]), ["--store-generation", "3"]);
    assert.equal(plain(uploads(change)[0], "STORE_GENERATION").text, "3");
    const dry = deploy(root, withHeld([["STORE_GENERATION", "2"]]), ["--dry-run", "--store-generation", "1"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /STORE_GENERATION removed/);
    assert.deepEqual(dry.calls.filter((c) => c.method !== "GET"), []);
  } finally { rm(root); }
});

test("R42: after the upload's answer the deploy prints `test deploy: startup <ms> ms` with the documented field result.startup_time_ms, after the upload and not before it", async () => {
  const root = await repo();
  try {
    const r = testDeploy(root, okStub({ startupTimeMs: 312 }));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const lines = r.stdout.split("\n").filter((l) => l.startsWith("test deploy: startup"));
    assert.deepEqual(lines, ["test deploy: startup 312 ms"]);
    assert.ok(r.stdout.indexOf("attempt 1: http 200") < r.stdout.indexOf("test deploy: startup"), "printed after the upload's answer");
    const t = testDeploy(root, okStub({ startupTimeMs: 0 }));
    assert.match(t.stdout, /^test deploy: startup 0 ms$/m, "zero is a figure");
  } finally { rm(root); }
});

test("R42: an answer without the field, or with one that is not a number, prints `test deploy: startup unreported` and the deploy still succeeds", async () => {
  const root = await repo();
  try {
    const r = testDeploy(root, okStub({ startupTimeMs: "none" }));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^test deploy: startup unreported$/m);
    assert.doesNotMatch(r.stdout, /startup \d/);
    const odd = testDeploy(root, okStub({ startupTimeMs: "fast" }));
    assert.equal(odd.status, 0, odd.stdout + odd.stderr);
    assert.match(odd.stdout, /^test deploy: startup unreported$/m);
    const plain = deploy(root, okStub({ startupTimeMs: 312 }));
    assert.equal(plain.status, 0, plain.stdout + plain.stderr);
    assert.doesNotMatch(plain.stdout, /test deploy:/, "R40's control: without --test-instance no test deploy line is printed");
  } finally { rm(root); }
});
