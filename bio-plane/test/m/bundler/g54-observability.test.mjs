/* G54 (3)(d), K4426: the deploy of the plane derives, sends and reads back `observability`. The raw script upload turned
 * Workers Logs off on biosmoke8 (the 2026-10-20 03:35Z upload), which is why no line names why two case files were not built.
 * Driven as release.test.mjs drives the deploy: the real `deploy.mjs` copied into a fixture repository, its fetch stubbed
 * (`stubfetch.mjs`), which models the platform: an upload whose metadata has no `observability` leaves the script's settings
 * without the key. Nothing here reaches a real account. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonc } from "../../../scripts/jsonc.mjs";
import { deriveObservability, observabilityReadBack, deriveBindings } from "../../../scripts/derive-bindings.mjs";
import { makeRepo, run, rm, VERSION, ACCOUNT, PLANE, PLANE_CRON } from "./repo.mjs";

const SLUG = "grp";
const CF = { CF_TOKEN: "cf-secret-token-value", CF_ACCT: ACCOUNT };
const ASSET = "dist/bio-plane.bundled.mjs";
const SERVICES = [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }];
const repo = (config = {}) => makeRepo({ plane: { config: { services: SERVICES, ...config } } });
const deploy = (root, stub, flags = []) => run(root, "bio-plane", ["scripts/deploy.mjs", SLUG, VERSION, ASSET, ...flags], { env: CF, stub });
// fixtures-own: platform the Cloudflare API's own answers to the deploy's account calls, a scripted-network double of the platform; no module answers for them
const okStub = (extra = {}) => ({ subdomain: "sub", put: "accept", scripts: { "alpha-worker": { settings: {} } }, ...extra });
const uploads = (r) => r.calls.filter((c) => c.method === "PUT" && !c.url.endsWith("/schedules"));
const schedulePuts = (r) => r.calls.filter((c) => c.method === "PUT" && c.url.endsWith("/schedules"));
const ON = { enabled: true };
/** The fixture plane's script as an account that already holds everything the deploy would send. */
const settled = (root, { settings = {}, ...extra } = {}) => ({
  body: readFileSync(join(root, "bio-plane", ASSET), "utf8"), schedules: [PLANE_CRON],
  settings: { limits: { subrequests: 500 }, observability: ON,
    bindings: deriveBindings(parseJsonc(readFileSync(join(root, "bio-plane/wrangler.jsonc"), "utf8")), { slug: SLUG, version: VERSION }),
    ...settings },
  ...extra });
const atServing = (root, script) => okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: script }, serving: { [SLUG]: VERSION } });

test("R15: deriveObservability states {enabled: true} from the config and refuses a config that does not turn Workers Logs on or carries a key it does not know; observabilityReadBack tells MATCH, MISMATCH and UNREADABLE and makes no request", () => {
  assert.deepEqual(deriveObservability({ observability: { enabled: true } }), { enabled: true });
  const code = (cfg) => { try { deriveObservability(cfg); } catch (e) { return /\[([A-Z_]+)\]/.exec(e.message)?.[1] ?? e.message; } return "no refusal"; };
  for (const [label, cfg] of [["no config", undefined], ["no key", {}], ["null", { observability: null }], ["a boolean", { observability: true }],
    ["enabled false", { observability: { enabled: false } }], ["enabled a string", { observability: { enabled: "true" } }],
    ["no enabled", { observability: {} }], ["a list", { observability: [ON] }]])
    assert.equal(code(cfg), "NO_OBSERVABILITY", label);
  for (const key of ["head_sampling_rate", "logs", "traces", "invocation_logs"])
    assert.equal(code({ observability: { enabled: true, [key]: 1 } }), "UNKNOWN_OBSERVABILITY_KEY", key);
  assert.deepEqual(deriveObservability(parseJsonc(readFileSync(join(PLANE, "wrangler.jsonc"), "utf8"), "wrangler.jsonc")), { enabled: true },
    "the real plane's configuration turns Workers Logs on and states nothing else");

  const want = deriveObservability({ observability: ON });
  assert.equal(observabilityReadBack({ observability: { enabled: true } }, want).verdict, "MATCH");
  assert.equal(observabilityReadBack({ observability: { enabled: true, head_sampling_rate: 1, logs: { enabled: true } } }, want).verdict, "MATCH",
    "a rate or a sub-setting the platform adds is not a difference; only `enabled` was sent");
  for (const [label, settings] of [["no key (how the platform reports it off)", { limits: {} }], ["enabled false", { observability: { enabled: false } }],
    ["enabled missing", { observability: {} }], ["not an object", { observability: "on" }]])
    assert.equal(observabilityReadBack(settings, want).verdict, "MISMATCH", label);
  for (const settings of [null, undefined, "x"]) assert.equal(observabilityReadBack(settings, want).verdict, "UNREADABLE", String(settings));
});

test("R18: the upload's metadata carries observability {enabled: true} derived from wrangler.jsonc, and success is stated only after the script's settings read back as enabled, before the schedules are set", async () => {
  const root = await repo();
  try {
    const r = deploy(root, okStub());
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const [put] = uploads(r);
    assert.deepEqual(put.metadata.observability, deriveObservability(parseJsonc(readFileSync(join(root, "bio-plane/wrangler.jsonc"), "utf8"))));
    assert.deepEqual(put.metadata.observability, { enabled: true });
    const bytes = r.stdout.indexOf("verified: deployed bytes"), obs = r.stdout.indexOf("verified: observability"), sched = r.stdout.indexOf("verified: schedules");
    assert.ok(bytes >= 0 && obs > bytes && sched > obs, "bytes, then Workers Logs, then the schedules, each read back before it is stated");
    assert.ok(r.stdout.indexOf("rollout:") > sched, "the rollout wait follows");
    assert.ok(r.calls.findLastIndex((c) => c.method === "GET" && c.url.endsWith(`/scripts/${SLUG}/settings`)) > r.calls.findIndex((c) => c.method === "PUT" && !c.url.endsWith("/schedules")),
      "the settings are asked of the account after the upload, not believed from it");
  } finally { rm(root); }
});

test("R18: a read-back whose settings report Workers Logs off, absent, different or unreadable refuses success [OBSERVABILITY_MISMATCH | OBSERVABILITY_UNREADABLE], exit 1, with no schedules set and no rollout wait", async () => {
  const root = await repo();
  try {
    for (const [label, extra, code, what] of [
      ["the platform turned it off", { observabilityAfterPut: { enabled: false } }, "OBSERVABILITY_MISMATCH", /enabled false|off/],
      ["the settings state none", { settingsAfterPut: { limits: { subrequests: 500 } } }, "OBSERVABILITY_MISMATCH", /state no observability|off/],
      ["the settings cannot be read", { settingsUnreadableAfterPut: true }, "OBSERVABILITY_UNREADABLE", /HTTP 500|could not be read/],
    ]) {
      const r = deploy(root, okStub(extra));
      assert.equal(r.status, 1, `${label}\n${r.stdout}${r.stderr}`);
      assert.match(r.stderr, new RegExp(`REFUSING TO REPORT SUCCESS \\[${code}\\]`), label);
      assert.match(r.stderr, what, label);
      assert.doesNotMatch(r.stdout, /verified: observability|verified: schedules|rollout:/, label);
      assert.deepEqual(schedulePuts(r), [], `${label}: nothing past the refusal is done`);
      assert.equal(uploads(r).length, 1, `${label}: the bytes were uploaded and verified; only Workers Logs is refused`);
    }
  } finally { rm(root); }
});

test("R18: a wrangler.jsonc that does not turn Workers Logs on, or carries a key the derivation does not, is refused before any request, as one without a subrequest ceiling is; --dry-run refuses the same way", async () => {
  for (const [label, observability, code] of [["no observability", null, "NO_OBSERVABILITY"], ["enabled false", { enabled: false }, "NO_OBSERVABILITY"],
    ["a sampling rate", { enabled: true, head_sampling_rate: 0.1 }, "UNKNOWN_OBSERVABILITY_KEY"]]) {
    const root = await repo({ observability });
    try {
      for (const flags of [[], ["--dry-run"]]) {
        const r = deploy(root, okStub(), flags);
        assert.notEqual(r.status, 0, label);
        assert.match(r.stderr + r.stdout, new RegExp(`REFUSED \\[${code}\\]`), label);
        assert.deepEqual(r.calls, [], `${label}${flags[0] ? " (dry-run)" : ""}: refused before any request`);
      }
    } finally { rm(root); }
  }
});

test("R34: identical bytes serving the version with matching limits, bindings and schedules are still a metadata deploy while the script's Workers Logs are not on; with them on it uploads nothing", async () => {
  const root = await repo();
  try {
    for (const [label, settings] of [["no key", { observability: undefined }], ["enabled false", { observability: { enabled: false } }]]) {
      const r = deploy(root, atServing(root, settled(root, { settings })));
      assert.equal(r.status, 0, `${label}: ${r.stdout}${r.stderr}`);
      assert.match(r.stdout, /Workers Logs|observability/i, label);
      assert.match(r.stdout, /METADATA deploy proceeds/, label);
      assert.doesNotMatch(r.stdout, /nothing to do/, label);
      assert.equal(uploads(r).length, 1, label);
      assert.deepEqual(uploads(r)[0].metadata.observability, ON, label);
    }
    const held = deploy(root, atServing(root, settled(root)));
    assert.equal(held.status, 0, held.stdout + held.stderr);
    assert.match(held.stdout, /nothing to do/);
    assert.deepEqual(held.calls.filter((c) => c.method === "PUT"), [], "nothing is uploaded and nothing is set");
  } finally { rm(root); }
});

test("R40: --dry-run prints the observability the upload would send and what the script reports now, and sends nothing but reads", async () => {
  const root = await repo();
  try {
    const first = deploy(root, okStub(), ["--dry-run"]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /observability: the upload carries \{"enabled":true\}/);
    assert.match(first.stdout, /observability now: the script is not deployed/);
    const off = deploy(root, atServing(root, settled(root, { settings: { observability: undefined } })), ["--dry-run"]);
    assert.equal(off.status, 0, off.stdout + off.stderr);
    assert.match(off.stdout, /observability now: off/);
    const on = deploy(root, atServing(root, settled(root, { schedules: ["0 0 * * *"] })), ["--dry-run"]);
    assert.match(on.stdout, /observability now: on/);
    const same = deploy(root, atServing(root, settled(root)), ["--dry-run"]);
    assert.match(same.stdout, /Workers Logs on; nothing to do/, "everything held, Workers Logs included: nothing to do, as before");
    assert.deepEqual(first.calls.concat(off.calls, on.calls, same.calls).filter((c) => c.method !== "GET"), [], "reads only");
    assert.match(off.stdout, /nothing was deployed/);
  } finally { rm(root); }
});
