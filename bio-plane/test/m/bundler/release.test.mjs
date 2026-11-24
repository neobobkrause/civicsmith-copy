/* bundler's release tooling (T19 BOB-5): requirement-named tests at the module's interface,
 * build/requirements/bundler.md R11–R23. R11–R15 are called as functions; R16–R23 are run as the
 * commands an operator runs, against a throwaway fixture repository (`repo.mjs`), with `fetch` stubbed
 * (`stubfetch.mjs`), a fake `wrangler`, and a throwaway release key checked by stock `ssh-keygen`.
 * Nothing here reaches a real account or writes the real repository. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { stripJsonc, parseJsonc } from "../../../scripts/jsonc.mjs";
import { versionSites, resolveVersion } from "../../../scripts/resolve-version.mjs";
import { deriveBindings, serviceTargets, deriveLimits, limitsReadBack, deriveCrons } from "../../../scripts/derive-bindings.mjs";
import { planeMember, discoverMembers, buildMember, manifestFrom, verifyStatic } from "../../../scripts/fleet-bundle.mjs";
import {
  fleetStatement, NS_FLEET, NS_RELEASE, verifySshsig, NS_RELEASE_NOTICE, releaseNoticeStatement, verifyReleaseNotice,
} from "../../../src/sshsig.mjs";
import { signSshsig, signerPublicLine } from "../../../scripts/sign-sshsig.mjs";
import {
  makeRepo, addMember, addContainerMember, addScannerMember, buildAll, run, snapshot, readJson, writeJson, rm, hex, planeConfig,
  VERSION, ACCOUNT, PLANE, PLANE_CRON, DIGEST, CONTAINER_PACKAGES, SCANNER_PACKAGES, DIGEST_A, DIGEST_B, scannerClasses, NOTES,
} from "./repo.mjs";

const refused = (r, code) => {
  assert.notEqual(r.status, 0, `${code}: exits non-zero\n${r.stdout}\n${r.stderr}`);
  assert.ok(r.stderr.includes(`REFUSED [${code}]`), `${code} on stderr:\n${r.stderr}\n${r.stdout}`);
};
const tryThrow = (fn) => { try { fn(); } catch (e) { return e; } assert.fail("did not throw"); };

/* ------------------------------------------------------------------------ R11 */

test("R11: stripJsonc removes line and block comments, keeps each line comment's newline, and leaves every quoted string whole", () => {
  const src = [
    '{ "$schema": "https://example.test/schema.json", // a comment with "quotes" and \'ticks\'',
    '  /* a block',
    '     over lines with // inside */ "a": "x // not a comment", "b": \'y /* not a block */\',',
    '  "c": "esc \\" // still a string", "d": "back\\\\", // the string closed at the escaped backslash',
    '  "e": 1 /* inline */ }',
  ].join("\n");
  const out = stripJsonc(src);
  assert.equal(out.split("\n").length, src.split("\n").length - 1 /* the block's newline goes with it */);
  assert.ok(out.includes('"https://example.test/schema.json"'));
  assert.ok(out.includes('"x // not a comment"') && out.includes("'y /* not a block */'"));
  assert.ok(out.includes('"esc \\" // still a string"') && out.includes('"back\\\\"'));
  assert.doesNotMatch(out, /a comment with|\/\* a block|over lines|inline|closed at/);
  assert.equal(stripJsonc('"a" // c\n"b"'), '"a" \n"b"', "the line comment's newline is kept");
  assert.equal(stripJsonc("no comments at all"), "no comments at all");
});

test("R11: parseJsonc returns the parsed object, or throws naming what did not parse", () => {
  assert.deepEqual(parseJsonc('// x\n{ "u": "https://a.test//b", /* y */ "n": [1, 2] }\n'), { u: "https://a.test//b", n: [1, 2] });
  const e = tryThrow(() => parseJsonc("{ broken", "agent-worker/wrangler.jsonc"));
  assert.ok(e instanceof Error);
  assert.match(e.message, /^agent-worker\/wrangler\.jsonc did not parse as JSONC: /);
  assert.match(tryThrow(() => parseJsonc("[")).message, /^config did not parse as JSONC: /);
});

/* ------------------------------------------------------------------------ R12 */

test("R12: the version sites are the plane's then each member's package.json version and wrangler vars.VERSION, where present; agreement resolves", async () => {
  const root = await makeRepo({ build: false });
  try {
    addMember(root, "gamma-worker");
    rmSync(join(root, "gamma-worker/package.json"));                 /* a member without one: not a site */
    const sites = versionSites(root).map((s) => [s.file, s.key, s.version]);
    assert.deepEqual(sites, [
      ["bio-plane/package.json", "version", VERSION], ["bio-plane/wrangler.jsonc", "vars.VERSION", VERSION],
      ["alpha-worker/package.json", "version", VERSION], ["alpha-worker/wrangler.jsonc", "vars.VERSION", VERSION],
      ["beta-worker/package.json", "version", VERSION], ["beta-worker/wrangler.jsonc", "vars.VERSION", VERSION],
      ["gamma-worker/wrangler.jsonc", "vars.VERSION", VERSION],
    ]);
    const r = resolveVersion(root);
    assert.equal(r.ok, true);
    assert.equal(r.version, VERSION);
    assert.equal(r.sites.length, 7);
    assert.deepEqual(r.findings, [], "no findings when every site agrees");
  } finally { rm(root); }
});

test("R12: a site behind or ahead of bio-plane/package.json is one finding naming the file, the key and the edit; no authority is one finding; never throws", async () => {
  const root = await makeRepo({ build: false });
  try {
    const pj = join(root, "alpha-worker/package.json");
    writeJson(pj, { ...readJson(pj), version: "1.2.2" });               /* behind */
    const wj = join(root, "beta-worker/wrangler.jsonc");
    writeFileSync(wj, readFileSync(wj, "utf8").replace(`"VERSION": "${VERSION}"`, '"VERSION": "1.3.0"'));   /* ahead */
    const r = resolveVersion(root);
    assert.equal(r.ok, false);
    assert.equal(r.version, VERSION);
    assert.equal(r.findings.length, 2);
    assert.match(r.findings[0], /alpha-worker\/package\.json declares version = "1\.2\.2".*bio-plane\/package\.json declares "1\.2\.3"[\s\S]*EDIT: set version in alpha-worker\/package\.json to "1\.2\.3"/);
    assert.match(r.findings[1], /beta-worker\/wrangler\.jsonc declares vars\.VERSION = "1\.3\.0"[\s\S]*EDIT: set vars\.VERSION in beta-worker\/wrangler\.jsonc to "1\.2\.3"/);

    const ppj = join(root, "bio-plane/package.json");
    const { version: _gone, ...noVersion } = readJson(ppj);
    writeJson(ppj, noVersion);
    const none = resolveVersion(root);
    assert.equal(none.ok, false);
    assert.equal(none.version, null);
    assert.equal(none.findings.length, 1);
    assert.match(none.findings[0], /bio-plane\/package\.json declares no `version`/);
  } finally { rm(root); }
});

test("R12: resolveVersionOrExit returns the version, or prints REFUSED [VERSION_SKEW] with the findings and exits 1", async () => {
  const root = await makeRepo({ build: false });
  try {
    const lib = pathToFileURL(join(root, "bio-plane/scripts/resolve-version.mjs")).href;
    const code = `const m = await import(${JSON.stringify(lib)}); console.log("got " + m.resolveVersionOrExit());`;
    const ok = run(root, ".", ["--input-type=module", "-e", code]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /^got 1\.2\.3$/m);
    const pj = join(root, "alpha-worker/package.json");
    writeJson(pj, { ...readJson(pj), version: "0.9.0" });
    const bad = run(root, ".", ["--input-type=module", "-e", code]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /REFUSED \[VERSION_SKEW\]/);
    assert.match(bad.stderr, /EDIT: set version in alpha-worker\/package\.json to "1\.2\.3"/);
    assert.doesNotMatch(bad.stdout, /^got/m);
  } finally { rm(root); }
});

/* ------------------------------------------------------------------------ R13 */

test("R13: deriveBindings emits VERSION and INSTANCE_NAME, the vars, buckets, services (bio-plane becomes the slug), browser, and instance tokens only when given; no Durable Object", () => {
  const cfg = planeConfig({ version: "0.0.1", services: [{ binding: "SELF", service: "bio-plane" }, { binding: "PDF", service: "pdf-worker" }] });
  const base = [
    { type: "plain_text", name: "VERSION", text: "9.9.9" },
    { type: "plain_text", name: "INSTANCE_NAME", text: "grp" },
    { type: "plain_text", name: "MODE", text: "fixture" },
    { type: "r2_bucket", name: "CAPTURES", bucket_name: "c" },
    { type: "r2_bucket", name: "PUBLISHED", bucket_name: "p" },
    { type: "service", name: "SELF", service: "grp" },
    { type: "service", name: "PDF", service: "pdf-worker" },
    { type: "browser", name: "BROWSER" },
  ];
  assert.deepEqual(deriveBindings(cfg, { slug: "grp", version: "9.9.9" }), base, "VERSION is the argument's, never vars.VERSION");
  assert.deepEqual(deriveBindings(cfg, { slug: "grp", version: "9.9.9", instanceClaudeToken: "c-tok", instanceAiToken: "a-tok" }), [...base,
    { type: "secret_text", name: "INSTANCE_AI_TOKEN", text: "a-tok" }], "never a Claude credential, even when one is offered (K1502)");
  assert.deepEqual(deriveBindings(cfg, { slug: "grp", version: "9.9.9", instanceAiToken: "a-tok" }).at(-1),
    { type: "secret_text", name: "INSTANCE_AI_TOKEN", text: "a-tok" });
  const all = deriveBindings(cfg, { slug: "grp", version: "9.9.9", instanceClaudeToken: "c", instanceAiToken: "a" });
  assert.ok(!all.some((b) => b.type === "durable_object_namespace"), "no Durable Object binding");
  assert.ok(!all.some((b) => /CLAUDE/i.test(b.name) || b.text === "c"), "no Claude credential under any name");
  const { browser: _b, r2_buckets: _r, services: _s, ...bare } = cfg;
  assert.deepEqual(deriveBindings({ ...bare, vars: {} }, { slug: "s", version: "1" }),
    [{ type: "plain_text", name: "VERSION", text: "1" }, { type: "plain_text", name: "INSTANCE_NAME", text: "s" }]);
});

test("R14: deriveBindings refuses NO_SLUG, NO_VERSION, each declared unknown binding class by name, an unnamed browser, and a phantom target; serviceTargets lists targets but the slug", () => {
  const cfg = planeConfig();
  assert.match(tryThrow(() => deriveBindings(cfg, { version: "1" })).message, /^REFUSED \[NO_SLUG\]/);
  assert.match(tryThrow(() => deriveBindings(cfg, { slug: "s" })).message, /^REFUSED \[NO_VERSION\]/);
  const classes = ["kv_namespaces", "d1_databases", "queues", "analytics_engine_datasets", "ai", "vectorize", "hyperdrive",
    "dispatch_namespaces", "mtls_certificates", "send_email", "wasm_modules", "data_blobs", "text_blobs"];
  for (const k of classes) {
    const e = tryThrow(() => deriveBindings({ ...cfg, [k]: k === "ai" ? { binding: "AI" } : [{ binding: "X" }] }, { slug: "s", version: "1" }));
    assert.match(e.message, new RegExp(`^REFUSED \\[UNKNOWN_BINDING_CLASS\\]: wrangler\\.jsonc declares ${k},`), k);
  }
  const two = tryThrow(() => deriveBindings({ ...cfg, queues: [{}], hyperdrive: [{}] }, { slug: "s", version: "1" }));
  assert.match(two.message, /declares queues, hyperdrive,/, "each one named");
  assert.equal(deriveBindings({ ...cfg, kv_namespaces: [] }, { slug: "s", version: "1" }).length > 0, true, "an empty class is not declared");
  for (const browser of [{}, { binding: "" }, null, { binding: 3 }])
    assert.match(tryThrow(() => deriveBindings({ ...cfg, browser }, { slug: "s", version: "1" })).message, /^REFUSED \[BROWSER_BINDING_UNNAMED\]/);
  assert.match(tryThrow(() => deriveBindings(cfg, { slug: "bio-plane", version: "1" })).message, /^REFUSED \[PHANTOM_TARGET\]/);
  const b = deriveBindings(planeConfig({ services: [{ binding: "SELF", service: "bio-plane" }, { binding: "A", service: "agent-worker" },
    { binding: "P", service: "pdf-worker" }] }), { slug: "grp", version: "1" });
  assert.deepEqual(serviceTargets(b, "grp"), ["agent-worker", "pdf-worker"]);
});

/* ------------------------------------------------------------------------ R15 */

test("R15: deriveLimits returns subrequests and cpu_ms, refusing a missing or non-positive-integer subrequests and any other key; limitsReadBack's three verdicts; neither makes a request", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("R15 made a request"); };
  try {
    assert.deepEqual(deriveLimits({ limits: { subrequests: 500, cpu_ms: 30000 } }), { subrequests: 500, cpu_ms: 30000 });
    assert.deepEqual(deriveLimits({ limits: { subrequests: 50 } }), { subrequests: 50 });
    for (const cfg of [{}, null, { limits: {} }, { limits: { subrequests: 0 } }, { limits: { subrequests: -5 } },
      { limits: { subrequests: 1.5 } }, { limits: { subrequests: "500" } }, { limits: { cpu_ms: 10 } }])
      assert.match(tryThrow(() => deriveLimits(cfg)).message, /^REFUSED \[NO_SUBREQUEST_LIMIT\]/, JSON.stringify(cfg));
    assert.match(tryThrow(() => deriveLimits({ limits: { subrequests: 5, memory: 1, cpu_ms: 2 } })).message,
      /^REFUSED \[UNKNOWN_LIMIT_KEY\]: wrangler\.jsonc's limits declares memory,/);

    const want = { subrequests: 500 };
    for (const s of [null, undefined, "x", {}, { limits: {} }, { limits: { subrequests: null } }])
      assert.equal(limitsReadBack(s, want).verdict, "UNDETERMINED", JSON.stringify(s));
    assert.match(limitsReadBack(null, want).why, /could not be read/);
    assert.match(limitsReadBack({}, want).why, /state no limits\.subrequests/);
    const mis = limitsReadBack({ limits: { subrequests: 50 } }, want);
    assert.equal(mis.verdict, "MISMATCH");
    assert.match(mis.why, /50.*500/);
    assert.deepEqual(limitsReadBack({ limits: { subrequests: 500 } }, want), { verdict: "MATCH", why: "limits.subrequests 500 read back" });
  } finally { globalThis.fetch = realFetch; }
});

/* ------------------------------------------------------------------------ R16 */

test("R16: npm run build writes the plane's bundle and manifest by R5 from the committed sources alone — it renders and embeds no signing page, even beside a stale one — and prints size, SHA-256 and input counts", async () => {
  const root = await makeRepo({ build: false, members: {} });
  try {
    writeFileSync(join(root, "bio-plane/src/plane/index.mjs"),
      'import { tag } from "../tag.mjs";\nexport default { fetch() { return new Response(tag); } };\n');
    /* The old entry path, left beside the plane's own: the bundle must not start from it (T20, K846). */
    writeFileSync(join(root, "bio-plane/src/index.mjs"), 'export { default } from "./plane/index.mjs";\n');
    /* A committed generated source that its generator would now render differently: a build that ran the generator
       would rewrite it (R16: it calls no step that generates a source file). */
    const stale = "export const SIGN_HTML = 'a committed file, whatever it says';\n";
    writeFileSync(join(root, "bio-plane/src/signpage.mjs"), stale);
    const r = spawnSync("npm", ["run", "build"], { cwd: join(root, "bio-plane"), encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(readFileSync(join(root, "bio-plane/src/signpage.mjs"), "utf8"), stale, "no source file was generated or rewritten by the build");
    const plane = planeMember(root);
    const art = readFileSync(join(plane.abs, plane.bundle.outfile));
    const built = await buildMember(plane);
    assert.ok(art.equals(built.bytes), "the written bundle is what the recipe builds from the committed sources");
    const manifest = readJson(join(plane.abs, plane.bundle.manifest));
    assert.deepEqual(manifest, manifestFrom(plane, built));
    assert.ok(!manifest.inputs.some((i) => i.path === "src/signpage.mjs"), "no signing page is an input of the bundle");
    assert.equal(manifest.recipe.entry, "src/plane/index.mjs", "the plane's own entry (plane R6)");
    assert.ok(manifest.inputs.some((i) => i.path === "src/plane/index.mjs"));
    assert.ok(!manifest.inputs.some((i) => i.path === "src/index.mjs"), "the old entry is not an input");
    assert.match(r.stdout, new RegExp(`bio-plane: built dist/bio-plane\\.bundled\\.mjs — ${art.length} B, sha256 ${hex(art)}`));
    assert.match(r.stdout, new RegExp(`bio-plane: wrote dist/bio-plane\\.bundle\\.json — ${manifest.inputs.length} first-party input\\(s\\), 0 vendored`));
  } finally { rm(root); }
});

test("R16: the plane is built from its own entry, the one its wrangler.jsonc's main names, and that file exists", () => {
  const plane = planeMember();
  assert.equal(plane.bundle.entry, "src/plane/index.mjs");
  assert.equal(plane.entry, plane.bundle.entry);
  assert.ok(existsSync(join(plane.abs, plane.bundle.entry)), "the entry exists in the repository");
  const cfg = parseJsonc(readFileSync(join(plane.abs, "wrangler.jsonc"), "utf8"), "bio-plane/wrangler.jsonc");
  assert.equal(cfg.main, plane.bundle.entry, "the bundle and a wrangler deploy start from one module");
});

/* --------------------------------------------------------------- R17, R18 */

const SLUG = "grp";
const deployRepo = () => makeRepo({ plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }] } } });
const CF = { CF_TOKEN: "cf-secret-token-value", CF_ACCT: ACCOUNT };
const ASSET = "dist/bio-plane.bundled.mjs";
const deploy = (root, { args = [SLUG, VERSION, ASSET], env = CF, stub } = {}) =>
  run(root, "bio-plane", ["scripts/deploy.mjs", ...args], { env, stub });
// fixtures-own: platform the Cloudflare API's own answers to the deploy's account calls, a scripted-network double of the platform; no module answers for them
const okStub = (extra = {}) => ({ subdomain: "sub", put: "accept", scripts: { "alpha-worker": { settings: {} } }, ...extra });
/** The script uploads: a deploy's schedules PUT (G1) is a PUT too, but is not an upload; `anyPut` counts both. */
const puts = (r) => r.calls.filter((c) => c.method === "PUT" && !c.url.endsWith("/schedules"));
const anyPut = (r) => r.calls.filter((c) => c.method === "PUT");
/** The bindings R13 derives for the fixture plane, as an account that already holds them reads them back. */
const derivedOnScript = (root) =>
  deriveBindings(parseJsonc(readFileSync(join(root, "bio-plane/wrangler.jsonc"), "utf8")), { slug: SLUG, version: VERSION });

test("R17: missing arguments or credentials exit 2 with the usage line; a skewed tree or a disagreeing version argument refuses; a non-plane slug exits 3; all before any request", async () => {
  const root = await deployRepo();
  try {
    for (const [args, env] of [[[SLUG, VERSION], CF], [[SLUG], CF], [[], CF], [[SLUG, VERSION, ASSET], { CF_ACCT: ACCOUNT }],
      [[SLUG, VERSION, ASSET], { CF_TOKEN: "t" }]]) {
      const r = deploy(root, { args, env, stub: okStub() });
      assert.equal(r.status, 2, JSON.stringify(args));
      assert.match(r.stderr, /usage: CF_TOKEN=\.\.\. CF_ACCT=\.\.\. node scripts\/deploy\.mjs <slug> <version> <asset>/);
      assert.deepEqual(r.calls, []);
    }
    const arg = deploy(root, { args: [SLUG, "1.2.4", ASSET], stub: okStub() });
    refused(arg, "VERSION_ARGUMENT_DISAGREES");
    assert.equal(arg.status, 1);
    assert.deepEqual(arg.calls, []);
    for (const notPlane of ["pdf-worker"]) {
      const r = deploy(root, { args: [notPlane, VERSION, ASSET], stub: okStub() });
      assert.equal(r.status, 3, notPlane);
      assert.match(r.stderr, new RegExp(`\`${notPlane}\` is not a plane`));
      assert.deepEqual(r.calls, []);
    }
    /* K3807: the old `civicos` Worker is deleted and no deploy names it: it is an ordinary slug, not a refused non-plane. */
    const old = deploy(root, { args: ["civicos", VERSION, ASSET], stub: okStub() });
    assert.notEqual(old.status, 3);
    assert.doesNotMatch(old.stderr, /is not a plane|civicos-ui|deploy-ui/);
    const pj = join(root, "beta-worker/package.json");
    writeJson(pj, { ...readJson(pj), version: "1.2.2" });
    const skew = deploy(root, { stub: okStub() });
    refused(skew, "VERSION_SKEW");
    assert.equal(skew.status, 1);
    assert.match(skew.stderr, /beta-worker\/package\.json/);
    assert.deepEqual(skew.calls, []);
  } finally { rm(root); }
});

test("R17: every service target but the slug must be found in the account, or BINDING_TARGET_MISSING / PREFLIGHT_UNREADABLE, before any upload", async () => {
  const root = await deployRepo();
  try {
    const missing = deploy(root, { stub: okStub({ scripts: {} }) });
    refused(missing, "BINDING_TARGET_MISSING");
    assert.match(missing.stderr, /"alpha-worker"/);
    assert.match(missing.stderr, /node scripts\/deploy-fleet\.mjs alpha-worker --instance grp/);
    assert.deepEqual(puts(missing), []);
    assert.ok(!missing.calls.some((c) => c.url.includes(`/scripts/${SLUG}/settings`)), "the slug itself is never pre-flighted");
    const unreadable = deploy(root, { stub: okStub({ scripts: { "alpha-worker": { settingsStatus: 500 } } }) });
    refused(unreadable, "PREFLIGHT_UNREADABLE");
    assert.deepEqual(puts(unreadable), []);
    const unreachable = deploy(root, { stub: okStub({ unreachable: ["/scripts/alpha-worker/settings"] }) });
    refused(unreachable, "PREFLIGHT_UNREADABLE");
    assert.deepEqual(puts(unreachable), []);
  } finally { rm(root); }
});

test("R17: the old release-baton gate is gone: no --thread is asked for and nothing reads BATON.md", async () => {
  const root = await deployRepo();
  try {
    const r = deploy(root, { stub: okStub() });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.calls.every((c) => new URL(c.url).host === "api.cloudflare.com" || c.url.includes(".workers.dev")), "no other host");
    assert.doesNotMatch(r.stdout + r.stderr, /baton/i);
  } finally { rm(root); }
});

test("R18: uploads with R13's bindings and R15's limits, keeps secret_text, Durable Object and service bindings, states each token without printing it, never sends a Claude credential (R13), and succeeds on bytes and limits read back", async () => {
  const root = await deployRepo();
  try {
    const tokens = { INSTANCE_CLAUDE_TOKEN: "claude-secret-xyz", INSTANCE_AI_TOKEN: "ai-secret-xyz" };
    const r = deploy(root, { env: { ...CF, ...tokens }, stub: okStub() });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const [p] = puts(r);
    assert.equal(puts(r).length, 1);
    const cfg = parseJsonc(readFileSync(join(root, "bio-plane/wrangler.jsonc"), "utf8"));
    assert.deepEqual(p.metadata.bindings, deriveBindings(cfg, { slug: SLUG, version: VERSION,
      instanceAiToken: tokens.INSTANCE_AI_TOKEN }));
    assert.ok(!p.metadata.bindings.some((b) => /CLAUDE/i.test(b.name) || b.text === tokens.INSTANCE_CLAUDE_TOKEN),
      "R13: an INSTANCE_CLAUDE_TOKEN in the environment is never sent");
    assert.deepEqual(p.metadata.keep_bindings, ["secret_text", "durable_object_namespace", "service"]);
    assert.deepEqual(p.metadata.limits, deriveLimits(cfg));
    assert.equal(p.metadata.main_module, "index.mjs");
    assert.equal(p.moduleBytes, readFileSync(join(root, "bio-plane", ASSET)).length);
    assert.ok(p.url.endsWith(`/accounts/${ACCOUNT}/workers/scripts/${SLUG}`) && p.bearer);
    const all = r.stdout + r.stderr;
    for (const v of [...Object.values(tokens), CF.CF_TOKEN]) assert.ok(!all.includes(v), "no secret printed");
    assert.match(r.stdout, /INSTANCE_CLAUDE_TOKEN is set in this environment and IGNORED/);
    assert.match(r.stdout, /INSTANCE_AI_TOKEN present in this environment — it will be SENT/);
    assert.match(r.stdout, /verified: deployed bytes are hash-identical to the signed asset/);
    assert.match(r.stdout, /verified: limits\.subrequests 500 read back/);
    assert.match(r.stdout, /rollout: serving 1\.2\.3 after/);

    const none = deploy(root, { stub: okStub() });
    assert.equal(none.status, 0);
    assert.doesNotMatch(none.stdout, /INSTANCE_CLAUDE_TOKEN/);
    assert.match(none.stdout, /INSTANCE_AI_TOKEN not in this environment — NOT sent/);
    assert.ok(!puts(none)[0].metadata.bindings.some((b) => b.type === "secret_text"));
  } finally { rm(root); }
});

test("R18: bytes that never read back equal exit 1 after four attempts saying nothing was applied; a limits mismatch exits 1; an undetermined limit is not stated as verified", async () => {
  const root = await deployRepo();
  try {
    const never = deploy(root, { stub: okStub({ put: "ignore" }) });
    assert.equal(never.status, 1);
    assert.equal(puts(never).length, 4);
    assert.match(never.stderr, /never matched the signed asset/);
    assert.match(never.stderr, /Nothing was half-applied/);
    assert.doesNotMatch(never.stdout, /verified/);

    const html = deploy(root, { stub: okStub({ put: "ignore", scripts: { "alpha-worker": { settings: {} }, [SLUG]: { scriptStatus: 502 } } }) });
    assert.equal(html.status, 1, "an unreadable read-back is never a match");
    assert.equal(puts(html).length, 4);

    const mis = deploy(root, { stub: okStub({ settingsAfterPut: { limits: { subrequests: 50 } } }) });
    assert.equal(mis.status, 1);
    assert.match(mis.stderr, /\[LIMITS_MISMATCH\]/);
    assert.doesNotMatch(mis.stdout, /rollout:/);

    const und = deploy(root, { stub: okStub({ settingsAfterPut: { observability: { enabled: true } } }) });
    assert.equal(und.status, 0);
    assert.match(und.stdout, /limits: UNDETERMINED — the script settings state no limits\.subrequests\. The ceiling sent \(500\) is NOT confirmed/);
    assert.doesNotMatch(und.stdout, /verified: limits/);
    assert.match(und.stdout, /rollout: serving 1\.2\.3 after/, "and it still waits on the rollout");
  } finally { rm(root); }
});

test("R18: already-deployed bytes serving the version with matching limits upload nothing; otherwise a metadata deploy proceeds; the rollout wait never fails the deploy", async () => {
  const root = await deployRepo();
  try {
    const body = readFileSync(join(root, "bio-plane", ASSET), "utf8");
    const bindings = derivedOnScript(root);
    const done = deploy(root, { stub: okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: { body, settings: { limits: { subrequests: 500 }, bindings, observability: { enabled: true } }, schedules: [PLANE_CRON] } },
      serving: { [SLUG]: VERSION } }) });
    assert.equal(done.status, 0, done.stderr);
    assert.deepEqual(anyPut(done), [], "nothing is uploaded and no schedule is set");
    assert.match(done.stdout, /already byte-identical AND serving 1\.2\.3 AND limits\.subrequests 500 read back AND every derived binding present AND schedules \*\/5 \* \* \* \* held AND Workers Logs on; nothing to do/);

    for (const [label, scripts, serving] of [
      ["serving an older version", { body, settings: { limits: { subrequests: 500 }, bindings, observability: { enabled: true } } }, "1.2.2"],
      ["limits not ours", { body, settings: { limits: { subrequests: 9 }, bindings, observability: { enabled: true } } }, VERSION],
    ]) {
      const r = deploy(root, { stub: okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: scripts }, serving: { [SLUG]: serving } }) });
      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      assert.equal(puts(r).length, 1, label);
      assert.match(r.stdout, /a METADATA deploy proceeds/, label);
    }

    const slow = deploy(root, { stub: okStub({ servingAfterPut: "never", serving: { [SLUG]: "1.2.2" } }) });
    assert.equal(slow.status, 0);
    assert.match(slow.stdout, /ROLLOUT NOT CONFIRMED after 60s: \/version still does not answer 1\.2\.3/);
    assert.equal(slow.calls.filter((c) => c.url.endsWith(".workers.dev/version")).length, 15, "fifteen checks four seconds apart: 60 seconds");
    const nosub = deploy(root, { stub: okStub({ subdomain: null }) });
    assert.equal(nosub.status, 0);
    assert.match(nosub.stdout, /could not learn the workers\.dev subdomain, so which build is SERVING is unconfirmed/);
  } finally { rm(root); }
});

test("R34: a derived binding missing or different on the script makes a deploy of identical bytes serving the version with matching limits a metadata deploy, reported as such; an undeclared plain_text on the script is kept unchanged", async () => {
  const root = await deployRepo();
  try {
    const body = readFileSync(join(root, "bio-plane", ASSET), "utf8");
    const full = derivedOnScript(root);
    const undeclared = { type: "plain_text", name: "JURISDICTION_PROFILES", text: "{\"ca\":1}" };
    const account = (bindings) => okStub({ scripts: { "alpha-worker": { settings: {} },
      [SLUG]: { body, settings: { limits: { subrequests: 500 }, bindings, observability: { enabled: true } } } }, serving: { [SLUG]: VERSION } });
    const lacking = full.filter((b) => !(b.type === "service" && b.name === "AGENT"));
    assert.equal(lacking.length, full.length - 1);
    for (const [label, bindings, what] of [
      ["a service binding missing", [...lacking, undeclared], /service AGENT is missing/],
      ["a service pointing elsewhere", [...full.map((b) => (b.name === "AGENT" ? { ...b, service: "other-worker" } : b)), undeclared],
        /service AGENT points at "other-worker", not "alpha-worker"/],
      ["a plain_text of another value", [...full.map((b) => (b.name === "MODE" ? { ...b, text: "old" } : b)), undeclared],
        /plain_text MODE points at "old", not "fixture"/],
      ["an R2 bucket of another name", [...full.map((b) => (b.type === "r2_bucket" && b.name === "CAPTURES" ? { ...b, bucket_name: "old" } : b)), undeclared],
        /r2_bucket CAPTURES points at "old", not "c"/],
      ["an R2 bucket missing", [...full.filter((b) => b.name !== "PUBLISHED"), undeclared], /r2_bucket PUBLISHED is missing/],
    ]) {
      const r = deploy(root, { stub: account(bindings) });
      assert.equal(r.status, 0, `${label}: ${r.stdout}${r.stderr}`);
      assert.equal(puts(r).length, 1, `${label}: one metadata upload`);
      assert.match(r.stdout, /derived bindings differ on the script — a METADATA deploy proceeds \(the same script, the new bindings\)/, label);
      assert.match(r.stdout, what, label);
      assert.doesNotMatch(r.stdout, /nothing to do/, label);
      const sent = puts(r)[0].metadata.bindings;
      assert.deepEqual(sent.filter((b) => b.name !== "JURISDICTION_PROFILES"), full, `${label}: R13's bindings, unchanged`);
      assert.deepEqual(sent.filter((b) => b.name === "JURISDICTION_PROFILES"), [undeclared], `${label}: the undeclared plain_text is sent again, unchanged`);
      assert.equal(puts(r)[0].moduleBytes, Buffer.byteLength(body), `${label}: the same script`);
      assert.match(r.stdout, /kept: 1 plain_text binding\(s\) on the script that this deploy does not derive, sent unchanged — JURISDICTION_PROFILES/, label);
    }
  } finally { rm(root); }
});

test("R34: a deploy of different bytes keeps every undeclared plain_text on the script and derives the rest; a binding R13 derives wins over the script's value of that name", async () => {
  const root = await deployRepo();
  try {
    const full = derivedOnScript(root);
    const onScript = [{ type: "plain_text", name: "JURISDICTION_PROFILES", text: "p" }, { type: "plain_text", name: "OTHER", text: "o" },
      { type: "plain_text", name: "MODE", text: "old" }, { type: "secret_text", name: "SOME_SECRET" }];
    const r = deploy(root, { stub: okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: { body: "old bytes", settings: { limits: { subrequests: 500 }, bindings: onScript } } } }) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const sent = puts(r)[0].metadata.bindings;
    assert.deepEqual(sent, [...full, onScript[0], onScript[1]], "R13's bindings, then the two undeclared plain_text bindings as they were");
    assert.equal(sent.filter((b) => b.name === "MODE").length, 1);
    assert.equal(sent.find((b) => b.name === "MODE").text, "fixture");
    assert.deepEqual(puts(r)[0].metadata.keep_bindings, ["secret_text", "durable_object_namespace", "service"], "secrets and the rest ride keep_bindings as before");
    const fresh = deploy(root, { stub: okStub() });
    assert.equal(fresh.status, 0, "an instance not on the account yet has nothing to keep");
    assert.deepEqual(puts(fresh)[0].metadata.bindings, full);
    assert.doesNotMatch(fresh.stdout, /kept:/);
  } finally { rm(root); }
});

test("R34 (control): with every derived binding present and the bytes matching, serving the version with matching limits, it uploads nothing; an undeclared plain_text on the script is no difference", async () => {
  const root = await deployRepo();
  try {
    const body = readFileSync(join(root, "bio-plane", ASSET), "utf8");
    const bindings = [...derivedOnScript(root), { type: "plain_text", name: "JURISDICTION_PROFILES", text: "p" }, { type: "secret_text", name: "INSTANCE_AI_TOKEN" }];
    const r = deploy(root, { env: { ...CF, INSTANCE_AI_TOKEN: "x" }, stub: okStub({ scripts: { "alpha-worker": { settings: {} },
      [SLUG]: { body, settings: { limits: { subrequests: 500 }, bindings, observability: { enabled: true } }, schedules: [PLANE_CRON] } }, serving: { [SLUG]: VERSION } }) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(anyPut(r), []);
    assert.match(r.stdout, /AND every derived binding present AND schedules \*\/5 \* \* \* \* held AND Workers Logs on; nothing to do/);
  } finally { rm(root); }
});

test("R34 (control): settings of a script that exists that cannot be read refuse BINDINGS_UNREADABLE before any upload, as an answer that is not the script's settings does", async () => {
  const root = await deployRepo();
  try {
    const body = readFileSync(join(root, "bio-plane", ASSET), "utf8");
    for (const stub of [
      okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: { body, settingsStatus: 500 } }, serving: { [SLUG]: VERSION } }),
      okStub({ unreachable: [`/scripts/${SLUG}/settings`] }),
    ]) {
      const r = deploy(root, { stub });
      refused(r, "BINDINGS_UNREADABLE");
      assert.equal(r.status, 1);
      assert.deepEqual(puts(r), []);
    }
  } finally { rm(root); }
});

/* ------------------------------------------------------ R18, schedules (G1; K4565, K4566, K4570) */

/* A script PUT carries no cron schedule, and whether it keeps the ones the script holds is unconfirmed, so every deploy sets
   the schedules wrangler.jsonc declares (`triggers.crons`) with `PUT .../schedules` after the upload, reads them back, and
   refuses success on a failure or a mismatch. The fixture plane declares the one cron the real plane will (PLANE_CRON). */
const schedules = (r) => r.calls.filter((c) => c.url.endsWith(`/scripts/${SLUG}/schedules`));
/** The fixture plane's own script as an account that already holds everything this deploy would send, schedules aside. */
const settledScript = (root, extra = {}) => ({ body: readFileSync(join(root, "bio-plane", ASSET), "utf8"),
  settings: { limits: { subrequests: 500 }, bindings: derivedOnScript(root), observability: { enabled: true } }, ...extra });

test("R18: after the script upload the schedules of wrangler.jsonc's triggers.crons are PUT, then read back, and success is stated only after the read-back matches, even where the script PUT clears them", async () => {
  const root = await deployRepo();
  try {
    const r = deploy(root, { stub: okStub({ scriptPutClearsSchedules: true }) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const at = (pred) => r.calls.findIndex(pred);
    const upload = at((c) => c.method === "PUT" && c.url.endsWith(`/scripts/${SLUG}`));
    const set = at((c) => c.method === "PUT" && c.url.endsWith("/schedules"));
    const read = r.calls.findLastIndex((c) => c.method === "GET" && c.url.endsWith("/schedules"));
    assert.ok(upload >= 0 && set > upload, "the schedules are PUT after the script is");
    assert.ok(read > set, "and read back after they are PUT");
    assert.deepEqual(r.calls[set].schedules, [{ cron: PLANE_CRON }], "the cron of the config, nothing else");
    assert.ok(r.calls[set].url.endsWith(`/accounts/${ACCOUNT}/workers/scripts/${SLUG}/schedules`) && r.calls[set].bearer);
    assert.match(r.stdout, /verified: schedules \*\/5 \* \* \* \* read back/);
    assert.ok(r.stdout.indexOf("verified: schedules") < r.stdout.indexOf("rollout:"), "the rollout wait follows the verified schedules");
    assert.equal(puts(r).length, 1);
  } finally { rm(root); }
});

test("R18: a schedules PUT that fails, one that answers and keeps nothing, a read-back that lacks the cron, differs, or cannot be read each refuse success [SCHEDULES_NOT_SET | SCHEDULES_MISMATCH | SCHEDULES_UNREADABLE], exit 1, with no rollout wait and no verified line", async () => {
  const root = await deployRepo();
  try {
    for (const [label, extra, code, what] of [
      ["the PUT refused", { schedulesPut: "reject" }, "SCHEDULES_NOT_SET", /HTTP 403/],
      ["the PUT unreachable", { unreachable: ["/schedules"] }, "SCHEDULES_NOT_SET", /fetch failed/],
      ["the PUT answered and kept nothing, the script PUT having cleared them", { schedulesPut: "ignore", scriptPutClearsSchedules: true }, "SCHEDULES_MISMATCH", /holds none/],
      ["the read-back differs", { schedulesStored: ["0 0 * * *"] }, "SCHEDULES_MISMATCH", /0 0 \* \* \*/],
      ["the read-back holds the cron and another", { schedulesStored: [PLANE_CRON, "0 0 * * *"] }, "SCHEDULES_MISMATCH", /0 0 \* \* \*/],
      ["the read-back cannot be read", { schedulesGet: 500 }, "SCHEDULES_UNREADABLE", /HTTP 500/],
    ]) {
      const r = deploy(root, { stub: okStub(extra) });
      assert.equal(r.status, 1, `${label}\n${r.stdout}${r.stderr}`);
      assert.match(r.stderr, new RegExp(`REFUSING TO REPORT SUCCESS \\[${code}\\]`), label);
      assert.match(r.stderr, what, label);
      assert.doesNotMatch(r.stdout, /verified: schedules|rollout:/, label);
      assert.equal(puts(r).length, 1, `${label}: the bytes were uploaded and verified; only the schedules are refused`);
    }
  } finally { rm(root); }
});

test("R18: a plane whose wrangler.jsonc declares no cron sets its script's schedules to none and reads that back; an invalid cron list refuses [INVALID_CRONS] before any request", async () => {
  const none = await makeRepo({ plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }], triggers: null } } });
  try {
    const r = deploy(none, { stub: okStub({ scriptPutClearsSchedules: true }) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.calls.find((c) => c.method === "PUT" && c.url.endsWith("/schedules")).schedules, [], "the config's own list: none");
    assert.match(r.stdout, /schedules: wrangler\.jsonc declares no cron/);
    assert.match(r.stdout, /verified: schedules none read back/);
  } finally { rm(none); }
  const services = [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }];
  for (const [label, triggers] of [
    ["a field short", { crons: ["*/5 * * *"] }], ["a field long", { crons: ["*/5 * * * * *"] }], ["words", { crons: ["every five minutes"] }],
    ["a number", { crons: [5] }], ["not a list", { crons: "*/5 * * * *" }], ["four crons (three is the platform's limit)", { crons: ["0 * * * *", "1 * * * *", "2 * * * *", "3 * * * *"] }],
    ["the same cron twice", { crons: [PLANE_CRON, PLANE_CRON] }], ["triggers not an object", ["*/5 * * * *"]],
  ]) {
    const root = await makeRepo({ plane: { config: { services, triggers } } });
    try {
      for (const flags of [[], ["--dry-run"]]) {
        const r = deploy(root, { args: [SLUG, VERSION, ASSET, ...flags], stub: okStub() });
        assert.notEqual(r.status, 0, label);
        assert.match(r.stderr, /REFUSED \[INVALID_CRONS\]/, label);
        assert.deepEqual(r.calls, [], `${label}${flags[0] ? " (dry-run)" : ""}: refused before any request`);
      }
    } finally { rm(root); }
  }
});

test("R18: deriveCrons reads triggers.crons: none declared is the empty list, a valid list is returned as written, and each invalid shape is refused [INVALID_CRONS] naming the cron", () => {
  assert.deepEqual(deriveCrons({}), []);
  assert.deepEqual(deriveCrons({ triggers: {} }), []);
  assert.deepEqual(deriveCrons({ triggers: { crons: [] } }), []);
  assert.deepEqual(deriveCrons({ triggers: { crons: [PLANE_CRON] } }), [PLANE_CRON]);
  assert.deepEqual(deriveCrons({ triggers: { crons: ["0 0 * * *", "17 3 * * 1-5", "*/10 * * * *"] } }), ["0 0 * * *", "17 3 * * 1-5", "*/10 * * * *"]);
  for (const crons of [["*/5 * * *"], ["*/5 * * * * *"], [""], ["a b c d e f"], [7], [null], "*/5 * * * *", [PLANE_CRON, PLANE_CRON], ["0 * * * *", "1 * * * *", "2 * * * *", "3 * * * *"]])
    assert.match(tryThrow(() => deriveCrons({ triggers: { crons } })).message, /^REFUSED \[INVALID_CRONS\]/, JSON.stringify(crons));
  assert.match(tryThrow(() => deriveCrons({ triggers: ["*/5 * * * *"] })).message, /^REFUSED \[INVALID_CRONS\]/);
  assert.match(tryThrow(() => deriveCrons({ triggers: { crons: ["*/5 * * *"] } })).message, /"\*\/5 \* \* \*"/, "names the cron");
});

test("R34: identical bytes serving the version with matching limits and bindings are still a metadata deploy while the script's schedules are not the config's; with them present it uploads nothing and sets nothing", async () => {
  const root = await deployRepo();
  try {
    for (const [label, schedules_] of [["none held", []], ["another held", ["0 0 * * *"]], ["the cron and another held", [PLANE_CRON, "0 0 * * *"]]]) {
      const r = deploy(root, { stub: okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: settledScript(root, { schedules: schedules_ }) }, serving: { [SLUG]: VERSION } }) });
      assert.equal(r.status, 0, `${label}: ${r.stdout}${r.stderr}`);
      assert.match(r.stdout, /schedules differ on the script — a METADATA deploy proceeds/, label);
      assert.doesNotMatch(r.stdout, /nothing to do/, label);
      assert.equal(puts(r).length, 1, label);
      assert.deepEqual(r.calls.find((c) => c.method === "PUT" && c.url.endsWith("/schedules")).schedules, [{ cron: PLANE_CRON }], label);
    }
    const held = deploy(root, { stub: okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: settledScript(root, { schedules: [PLANE_CRON] }) }, serving: { [SLUG]: VERSION } }) });
    assert.equal(held.status, 0, held.stdout + held.stderr);
    assert.match(held.stdout, /AND every derived binding present AND schedules \*\/5 \* \* \* \* held AND Workers Logs on; nothing to do/);
    assert.deepEqual(held.calls.filter((c) => c.method === "PUT"), [], "nothing is uploaded and no schedule is set");
    const unreadable = deploy(root, { stub: okStub({ schedulesGet: 500, scripts: { "alpha-worker": { settings: {} }, [SLUG]: settledScript(root, { schedules: [PLANE_CRON] }) }, serving: { [SLUG]: VERSION } }) });
    assert.doesNotMatch(unreadable.stdout, /nothing to do/, "schedules that cannot be read are not ones that match");
    assert.equal(unreadable.status, 1);
  } finally { rm(root); }
});

test("R40: --dry-run prints the schedules step with the crons it would set and what the script holds now, sends nothing but reads, and refuses as the real run does an invalid cron list and the schedules of a script that exist and cannot be read", async () => {
  const root = await deployRepo();
  try {
    const dry = (stub) => deploy(root, { args: [SLUG, VERSION, ASSET, "--dry-run"], stub });
    const first = dry(okStub());
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /schedules: after the upload PUT \.\.\.\/schedules sets \*\/5 \* \* \* \* and reads it back; a failure or a difference refuses success/);
    assert.match(first.stdout, /schedules now: the script is not deployed, so it holds none/);
    assert.match(first.stdout, /--dry-run: nothing was deployed/);
    const exists = dry(okStub({ scripts: { "alpha-worker": { settings: {} }, [SLUG]: settledScript(root, { schedules: ["0 0 * * *"] }) } }));
    assert.equal(exists.status, 0, exists.stdout + exists.stderr);
    assert.match(exists.stdout, /schedules now: 0 0 \* \* \* \(not the config's\)/);
    assert.deepEqual(first.calls.concat(exists.calls).filter((c) => c.method !== "GET"), [], "reads only");
    const unreadable = dry(okStub({ schedulesGet: 500, scripts: { "alpha-worker": { settings: {} }, [SLUG]: settledScript(root) } }));
    refused(unreadable, "SCHEDULES_UNREADABLE");
    assert.equal(unreadable.status, 1);
    assert.deepEqual(unreadable.calls.filter((c) => c.method !== "GET"), []);
    assert.doesNotMatch(unreadable.stdout, /nothing was deployed/);
  } finally { rm(root); }
});

/* ------------------------------------------------------------------------ R11, driven */

/* RE-WRITTEN 2026-10-12 (BUNDLER #17, T47-4; P20): R11's "one implementation" was tested by reading the four callers'
   SOURCE TEXT for an import line and for no `function parseJsonc`. It is now driven at the interface: in a fixture
   repository the module's reader is replaced by a MARKED one that also reads a `#` line, a syntax no other JSONC
   reader accepts, and every config carries such a line. A caller reading any config through a copy of its own would
   refuse or crash on it; each command runs as it always does, and the marked reader records that each called it. */
test("R11: one implementation serves every caller in the module: deploy, resolve-version, deploy-fleet and release-assemble each read every config through it", async () => {
  const root = await makeRepo({ plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }] } } });
  const work = mkdtempSync(join(tmpdir(), "bundler-r11-"));
  try {
    const scripts = join(root, "bio-plane/scripts");
    writeFileSync(join(scripts, "jsonc-real.mjs"), readFileSync(join(scripts, "jsonc.mjs")));
    writeFileSync(join(scripts, "jsonc.mjs"), [
      'import { appendFileSync } from "node:fs";',
      'import { stripJsonc as real } from "./jsonc-real.mjs";',
      'export function stripJsonc(text) { return real(text.split("\\n").filter((l) => !l.startsWith("#")).join("\\n")); }',
      "export function parseJsonc(text, what = \"config\") {",
      '  const caller = (new Error().stack.split("\\n").slice(2).find((l) => /scripts\\/[\\w-]+\\.mjs/.test(l)) || "").match(/scripts\\/([\\w-]+\\.mjs)/);',
      '  if (process.env.JSONC_LOG) appendFileSync(process.env.JSONC_LOG, JSON.stringify({ caller: caller && caller[1], what }) + "\\n");',
      "  try { return JSON.parse(stripJsonc(text)); } catch (e) { throw new Error(`${what} did not parse as JSONC: ${e.message}`); }",
      "}", ""].join("\n"));
    const configs = ["bio-plane", "alpha-worker", "beta-worker"].map((d) => join(root, d, "wrangler.jsonc"));
    for (const c of configs) writeFileSync(c, "# read only by the module's one JSONC reader\n" + readFileSync(c, "utf8"));
    const log = join(work, "jsonc.log");
    const read = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
    const commands = [
      ["resolve-version.mjs", ".", ["bio-plane/scripts/resolve-version.mjs"], {}, /every site agrees/],
      ["deploy.mjs", "bio-plane", ["scripts/deploy.mjs", SLUG, VERSION, ASSET], { stub: okStub(), env: CF }, /verified: deployed bytes/],
      ["deploy-fleet.mjs", ".", ["bio-plane/scripts/deploy-fleet.mjs", "alpha-worker", "--instance", SLUG, "--dry-run"],
        { stub: { subdomain: "sub", scripts: { [SLUG]: {} } }, env: { CF_TOKEN: "t" } }, /--dry-run: nothing was deployed/],
      ["release-assemble.mjs", ".", ["bio-plane/scripts/release-assemble.mjs", "--dry-run"], {}, /--dry-run: nothing written/],
    ];
    for (const [script, cwd, args, opts, done] of commands) {
      rmSync(log, { force: true });
      const r = run(root, cwd, args, { ...opts, env: { ...(opts.env || {}), JSONC_LOG: log } });
      assert.equal(r.status, 0, `${script}: a config with the marked syntax is read as it always is\n${r.stdout}${r.stderr}`);
      assert.match(r.stdout, done, script);
      assert.ok(read().some((x) => x.caller === script), `${script} itself reads through the module's reader: ${JSON.stringify(read())}`);
    }
    /* The marker is no ordinary JSONC: without the module's reader, a config carrying it does not parse. */
    assert.throws(() => JSON.parse(stripJsonc(readFileSync(configs[0], "utf8"))));
    assert.equal(existsSync(join(PLANE, "..", "tools", "jsonc.mjs")), false, "the old process's tools/jsonc.mjs is gone");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

/* --------------------------------------------------------------- R19, R20 */

const fleet = (root, args, { env = { CF_TOKEN: "cf-secret-token-value" }, stub = { subdomain: "sub", scripts: { [SLUG]: {} } } } = {}) =>
  run(root, ".", ["bio-plane/scripts/deploy-fleet.mjs", ...args], { env, stub });

test("R19: refuses NO_MEMBER, NO_INSTANCE, NOT_A_FLEET_MEMBER, NO_CONFIG, UNPARSEABLE_CONFIG, ACCOUNT_NOT_PINNED and NO_TOKEN", async () => {
  const root = await makeRepo({ build: false });
  try {
    refused(fleet(root, []), "NO_MEMBER");
    refused(fleet(root, ["alpha-worker"]), "NO_INSTANCE");
    refused(fleet(root, ["alpha-worker", "--instance", ""]), "NO_INSTANCE");
    const notMember = fleet(root, ["bio-plane", "--instance", SLUG]);
    refused(notMember, "NOT_A_FLEET_MEMBER");
    assert.doesNotMatch(notMember.stderr, /civicos|deploy-ui/, "K3807: its message names no deploy for the old interface");
    refused(fleet(root, ["no-such", "--instance", SLUG]), "NOT_A_FLEET_MEMBER");
    addMember(root, "gamma-worker");
    rmSync(join(root, "gamma-worker/wrangler.jsonc"));
    refused(fleet(root, ["gamma-worker", "--instance", SLUG]), "NO_CONFIG");
    writeFileSync(join(root, "gamma-worker/wrangler.jsonc"), "{ not: jsonc");
    refused(fleet(root, ["gamma-worker", "--instance", SLUG]), "UNPARSEABLE_CONFIG");
    addMember(root, "delta-worker", { account: null });
    refused(fleet(root, ["delta-worker", "--instance", SLUG]), "ACCOUNT_NOT_PINNED");
    const nt = fleet(root, ["alpha-worker", "--instance", SLUG], { env: {} });
    refused(nt, "NO_TOKEN");
    assert.deepEqual(nt.calls, []);
    assert.equal(fleet(root, ["alpha-worker", "--instance", SLUG, "--dry-run"], { env: { CLOUDFLARE_API_TOKEN: "t" } }).status, 0,
      "CLOUDFLARE_API_TOKEN serves as the token");
  } finally { rm(root); }
});

test("R19: the bio-plane target becomes the slug and every other is kept; each target must be found in the account; it prints member, instance, account and each binding", async () => {
  const root = await makeRepo({ build: false });
  try {
    addMember(root, "gamma-worker", { services: [{ binding: "PLANE", service: "bio-plane" }, { binding: "PDF", service: "pdf-worker" }] });
    const stub = { subdomain: "sub", scripts: { [SLUG]: {}, "pdf-worker": {} } };
    const r = fleet(root, ["gamma-worker", "--instance", SLUG, "--dry-run"], { stub });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^member {3}: gamma-worker$/m);
    assert.match(r.stdout, /^instance : grp$/m);
    assert.match(r.stdout, new RegExp(`^account  : ${ACCOUNT}$`, "m"));
    assert.match(r.stdout, /PLANE -> grp {2}\(was the phantom "bio-plane"\)/);
    assert.match(r.stdout, /PDF -> pdf-worker {2}\(left as written\)/);
    const checked = r.calls.filter((c) => /\/workers\/scripts\/[^/]+\/settings$/.test(c.url)).map((c) => c.url.split("/").at(-2));
    assert.deepEqual(checked, [SLUG, "pdf-worker"]);
    assert.ok(r.calls.every((c) => c.url.includes(`/accounts/${ACCOUNT}/`)), "asked of the pinned account");

    const miss = fleet(root, ["gamma-worker", "--instance", SLUG], { stub: { scripts: { [SLUG]: {} } } });
    refused(miss, "BINDING_TARGET_MISSING");
    assert.match(miss.stderr, /"pdf-worker"/);
    assert.deepEqual(miss.wrangler, []);
    refused(fleet(root, ["gamma-worker", "--instance", SLUG], { stub: { scripts: { [SLUG]: {}, "pdf-worker": { settingsStatus: 403 } } } }), "PREFLIGHT_UNREADABLE");
    refused(fleet(root, ["gamma-worker", "--instance", SLUG], { stub: { scripts: { [SLUG]: {} }, unreachable: ["pdf-worker"] } }), "PREFLIGHT_UNREADABLE");
  } finally { rm(root); }
});

test("R20: --dry-run deploys nothing; otherwise wrangler deploys from the member's directory with a generated config removed afterwards, success or failure, the tracked config never written", async () => {
  const root = await makeRepo({ build: false });
  try {
    const tracked = join(root, "alpha-worker/wrangler.jsonc");
    const trackedBefore = readFileSync(tracked);
    const gen = join(root, "alpha-worker/.wrangler.deploy.generated.json");
    const dry = fleet(root, ["alpha-worker", "--instance", SLUG, "--dry-run"]);
    assert.equal(dry.status, 0);
    assert.deepEqual(dry.wrangler, []);
    assert.match(dry.stdout, /--dry-run: nothing was deployed/);

    const stub = { subdomain: "sub", scripts: { [SLUG]: {} }, serving: { "alpha-worker": JSON.stringify({ version: VERSION }) } };
    const ok = fleet(root, ["alpha-worker", "--instance", SLUG], { stub });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.wrangler.length, 1);
    const w = ok.wrangler[0];
    assert.deepEqual(w.args.slice(0, 2), ["deploy", "-c"]);
    assert.ok(w.args[2].endsWith("/alpha-worker/.wrangler.deploy.generated.json"), w.args[2]);
    assert.equal(realpathSync(w.cwd), realpathSync(join(root, "alpha-worker")));
    assert.equal(w.token, "present");
    const want = parseJsonc(trackedBefore.toString());
    want.services = [{ binding: "PLANE", service: SLUG }];
    assert.deepEqual(JSON.parse(w.config), want, "the generated config is the tracked one with the slug substituted");
    assert.ok(readFileSync(tracked).equals(trackedBefore), "the tracked config is never written");
    assert.equal(existsSync(gen), false, "removed after success");
    assert.match(ok.stdout, /rollout: alpha-worker serving 1\.2\.3 after/);

    const fail = fleet(root, ["alpha-worker", "--instance", SLUG], { env: { CF_TOKEN: "t", WRANGLER_EXIT: "7" }, stub });
    assert.equal(fail.status, 7, "wrangler's failure is the exit");
    assert.equal(existsSync(gen), false, "removed after failure");
    assert.ok(readFileSync(tracked).equals(trackedBefore));
    assert.doesNotMatch(fail.stdout, /rollout:/);

    const slow = fleet(root, ["alpha-worker", "--instance", SLUG], { stub: { ...stub, serving: { "alpha-worker": JSON.stringify({ version: "1.0.0" }) } } });
    assert.equal(slow.status, 0);
    assert.match(slow.stdout, /ROLLOUT NOT CONFIRMED after 60s/);
    assert.equal(slow.calls.filter((c) => c.url.endsWith(".workers.dev/version")).length, 15);
  } finally { rm(root); }
});

/* ------------------------------------------------------------------------ R21 */

const bundles = (root, args = []) => run(root, ".", ["bio-plane/scripts/bundles.mjs", ...args]);

test("R21: --check surveys every guarded bundle by R6, names each finding, writes nothing, and exits 1 when any is stale, 0 when none", async () => {
  const root = await makeRepo();
  try {
    const fresh = bundles(root, ["--check"]);
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
    assert.match(fresh.stdout, /3 guarded bundle\(s\) — alpha-worker, beta-worker, bio-plane/);
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), 'export const word = "changed";\n');
    writeFileSync(join(root, "bio-plane/src/tag.mjs"), 'export const tag = "changed";\n');
    const before = snapshot(root);
    const stale = bundles(root, ["--check"]);
    assert.equal(stale.status, 1);
    for (const m of discoverMembers(root).concat(planeMember(root)))
      for (const f of verifyStatic(m).findings) assert.ok(stale.stdout.includes(f), `names: ${f}`);
    assert.match(stale.stdout, /2 of 3 bundle\(s\) are STALE — alpha-worker, bio-plane/);
    assert.deepEqual(snapshot(root), before, "--check writes nothing");
    const lib = await import(pathToFileURL(join(root, "bio-plane/scripts/bundles.mjs")).href);
    assert.equal(await lib.run({ repoRoot: root, check: true, log: () => {} }), 1, "run({check}) is the same survey");
  } finally { rm(root); }
});

test("R21: it rebuilds each stale member by its own npm run build, reports rebuilt only when bytes changed and which, surveys again, and exits 0 only when all is fresh", async () => {
  const root = await makeRepo();
  try {
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), 'export const word = "changed";\n');
    writeFileSync(join(root, "beta-worker/src/word.mjs"), 'export const word = "beta-worker";\nexport const unused = 1;\n');
    const r = bundles(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /rebuilding alpha-worker \(npm run build in alpha-worker\/\)/);
    assert.match(r.stdout, /alpha-worker — REBUILT dist\/alpha-worker\.bundled\.mjs \d+ B — artifact sha256 [0-9a-f]{64} \(was [0-9a-f]{64}\), manifest moved/);
    assert.match(r.stdout, /beta-worker — REBUILT dist\/beta-worker\.bundled\.mjs \d+ B — artifact BYTE-IDENTICAL, manifest moved/,
      "an unused export is tree-shaken: only the manifest moved, and it says so");
    assert.match(r.stdout, /2 rebuilt \(alpha-worker, beta-worker\), 0 already byte-identical, 1 already fresh, 0 STILL STALE/);
    for (const m of discoverMembers(root).concat(planeMember(root))) assert.deepEqual(verifyStatic(m).findings, [], m.name);

    /* A build that exits 0 having changed nothing, and one that fails: named, and the exit is 1. */
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), 'export const word = "again";\n');
    const pa = join(root, "alpha-worker/package.json");
    writeJson(pa, { ...readJson(pa), scripts: { build: "node -e 0" } });
    writeFileSync(join(root, "bio-plane/src/tag.mjs"), 'export const tag = "moved";\n');
    const pp = join(root, "bio-plane/package.json");
    writeJson(pp, { ...readJson(pp), scripts: { build: "exit 3" } });
    const bad = bundles(root);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /alpha-worker — rebuilt, NOTHING MOVED/);
    assert.match(bad.stdout, /! STILL alpha-worker: STALE BUNDLE/);
    assert.match(bad.stdout, /0 rebuilt, 1 already byte-identical, 1 already fresh, 2 STILL STALE \(alpha-worker, bio-plane\), 1 could not be rebuilt \(bio-plane: its build exited 3\)/);
  } finally { rm(root); }
});

/* --------------------------------------------------------------- R22, R23 */

const assemble = (root, args = [], env = {}) => run(root, ".", ["bio-plane/scripts/release-assemble.mjs", ...args], { env });
const envelope = () => `BIOKEY-RAW1.test.${randomBytes(32).toString("base64")}`;
/* R30: `--sign` runs only in the GitHub Actions signing environment; these tests stand in for it, with a throwaway key. */
const SIGNING = { GITHUB_ACTIONS: "true" };

/** The payload R22 must sign, computed here from the fixture's files and configs. */
function expectedPayload(root, version = VERSION) {
  const lib = { plane: planeMember(root), members: discoverMembers(root).filter((m) => m.bundle) };
  const art = (m) => readFileSync(join(m.abs, m.bundle.outfile));
  const members = lib.members.map((m) => {
    const cfg = parseJsonc(readFileSync(join(m.abs, "wrangler.jsonc"), "utf8"));
    const parts = (m.bundle.assets || []).map((p) => {
      const b = readFileSync(join(m.abs, p));
      return { path: p, type: p.endsWith(".bin") ? "Data" : "CompiledWasm", sha256: hex(b), bytes: b.length };
    });
    /* R33: a class's size, as the member's own configuration states it (by hand), after max_instances; none when none. */
    const sized = (cls) => { const x = (cfg.containers || []).find((k) => k.class_name === cls);
      return x && x.instance_type !== undefined ? { instance_type: x.instance_type } : {}; };
    /* R25: a container member's descriptor, written here from its marker's fields by hand. */
    const mk = readJson(join(m.abs, "fleet-member.json"));
    if (mk.kind === "container" && Array.isArray(mk.containers)) {
      /* R25, R27 (T36-2): one part per class, each with its own image and its statement's packages (SCANNER_PACKAGES). */
      for (const c of mk.containers) {
        const b = Buffer.from(JSON.stringify({ class_name: c.class_name, image: `${c.image.repository}@${c.image.digest}`,
          scheduling_policy: "default", max_instances: c.max_instances ?? mk.max_instances, ...sized(c.class_name),
          bind: c.bind ?? mk.bind, packages: SCANNER_PACKAGES[c.class_name] }, null, 2) + "\n");
        parts.push({ path: `container/${c.class_name}.json`, type: "Container", sha256: hex(b), bytes: b.length, buf: b });
      }
    } else if (mk.kind === "container") {
      /* R27: the image's packages, as the fixture's lockfile states them (CONTAINER_PACKAGES, by hand), last. */
      const b = Buffer.from(JSON.stringify({ class_name: mk.class_name, image: `${mk.image.repository}@${mk.image.digest}`,
        scheduling_policy: "default", max_instances: mk.max_instances, ...sized(mk.class_name), bind: mk.bind,
        packages: CONTAINER_PACKAGES }, null, 2) + "\n");
      parts.push({ path: "container.json", type: "Container", sha256: hex(b), bytes: b.length, buf: b });
    }
    /* R25 (N772): the Worker part, written here from the config by hand, each bucket by its role. */
    const ROLE = { "bio-captures": "captures", "bio-published": "published" };
    const r2 = (cfg.r2_buckets || []).map((x) => ({ binding: x.binding, bucket: ROLE[x.bucket_name] }));
    const crons = (cfg.triggers && cfg.triggers.crons) || [];
    if (r2.length || crons.length) {
      const b = Buffer.from(JSON.stringify({ r2_buckets: r2, crons }, null, 2) + "\n");
      parts.push({ path: "worker.json", type: "Worker", sha256: hex(b), bytes: b.length, buf: b });
    }
    return { member: m.name, asset: `${m.name}.bundled.mjs`, sha256: hex(art(m)), bytes: art(m).length,
      compat: { date: cfg.compatibility_date, flags: cfg.compatibility_flags || [] },
      services: (cfg.services || []).map((s) => ({ binding: s.binding, service: s.service })), parts };
  });
  const p = art(lib.plane);
  const bufs = Object.fromEntries(members.flatMap((m) => m.parts.filter((x) => x.buf).map((x) => [`${m.member}/${x.path}`, x.buf])));
  for (const m of members) m.parts = m.parts.map(({ buf: _b, ...x }) => x);
  return { payload: fleetStatement({ version, plane: { sha256: hex(p), bytes: p.length, asset: "bio-plane.bundled.mjs" }, members }),
    members, plane: { sha256: hex(p), bytes: p.length, buf: p }, bufs };
}

/** R32: the notice the release must sign, from the fixture's notes file and the payload, through signatures' statement. */
function expectedNotice(root, payload, version = VERSION) {
  const n = readJson(join(root, "release/notes", `${version}.json`));
  const notice = { version, date: n.date, manifest: hex(Buffer.from(payload, "utf8")), security: n.security, notes: n.notes };
  return { notice, statement: Buffer.from(releaseNoticeStatement(notice)) };
}

test("R22: a fresh fleet assembles; the payload is signatures' fleetStatement over the plane and every member; --emit-payload writes it; --dry-run writes nothing else", async () => {
  const root = await makeRepo({ members: { "alpha-worker": { flags: null }, "beta-worker": { assets: { "assets/model.bin": "MODEL-1", "assets/core.wasm": "\0asm" } } } });
  try {
    const { payload } = expectedPayload(root);
    assert.match(payload, /compat=2026-07-01\+- /, "an absent flags key is the stated empty list");
    const before = snapshot(root);
    const out = join(mkdtempSync(join(tmpdir(), "bundler-emit-")), "payload.txt");
    const r = assemble(root, ["--dry-run", "--emit-payload", out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(readFileSync(out, "utf8"), payload);
    assert.ok(r.stdout.includes(payload), "the payload is printed");
    assert.match(r.stdout, /--dry-run: nothing written\. A release cut now would carry 3 assets at 1\.2\.3/);
    assert.deepEqual(snapshot(root), before, "nothing in the repository written");
    rmSync(out);
    const v = assemble(root, ["--dry-run", "--version", VERSION]);
    assert.equal(v.status, 0, "--version equal to the resolved version is accepted");
  } finally { rm(root); }
});

test("R22: refuses NO_ARTIFACT, NO_MANIFEST, GUARD_CANNOT_RUN, STALE_OR_UNINSTALLABLE and MANIFEST_DISAGREES, writing nothing", async () => {
  const root = await makeRepo({ members: { "alpha-worker": {}, "beta-worker": { assets: { "assets/model.bin": "MODEL-1" } }, "gamma-worker": { vendored: true } } });
  const cases = [
    ["NO_ARTIFACT", (r) => rmSync(join(r, "alpha-worker/dist/alpha-worker.bundled.mjs"))],
    ["NO_MANIFEST", (r) => rmSync(join(r, "alpha-worker/dist/alpha-worker.bundle.json"))],
    ["GUARD_CANNOT_RUN", (r) => rmSync(join(r, "gamma-worker/node_modules"), { recursive: true })],
    ["GUARD_CANNOT_RUN", (r) => writeFileSync(join(r, "alpha-worker/src/word.mjs"), 'export { word } from "./missing.mjs";\n')],
    ["STALE_OR_UNINSTALLABLE", (r) => writeFileSync(join(r, "alpha-worker/src/word.mjs"), 'export const word = "drifted";\n')],
    ["MANIFEST_DISAGREES", (r) => { const p = join(r, "alpha-worker/dist/alpha-worker.bundle.json"); writeJson(p, { ...readJson(p), sha256: "0".repeat(64) }); }],
  ];
  try {
    const pristine = snapshot(root);
    for (const [code, arrange] of cases) {
      const save = new Map(Object.keys(pristine).map((k) => [k, readFileSync(join(root, k))]));
      arrange(root);
      const before = snapshot(root);
      const r = assemble(root, ["--dry-run"]);
      refused(r, code);
      assert.deepEqual(snapshot(root), before, `${code}: nothing written`);
      for (const [k, b] of save) writeFileSync(join(root, k), b);
      if (code === "GUARD_CANNOT_RUN" && !existsSync(join(root, "gamma-worker/node_modules"))) addMember(root, "gamma-worker", { vendored: true });
    }
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "restored, it assembles");
  } finally { rm(root); }
});

test("R22: refuses a declared part missing, unhashed, untyped or disagreeing, an unstated compatibility date, version skew, a disagreeing --version and a version already released with another plane", async () => {
  const root = await makeRepo();
  const beta = (p) => join(root, "beta-worker", p);
  const cases = [
    ["MEMBER_PART_MISSING", () => rmSync(beta("assets/model.bin"))],
    ["MEMBER_PART_UNHASHED", () => { const m = readJson(beta("dist/beta-worker.bundle.json")); delete m.assets; writeJson(beta("dist/beta-worker.bundle.json"), m); }],
    ["MEMBER_PART_DISAGREES", () => writeFileSync(beta("assets/model.bin"), "MODEL-2")],
    ["MEMBER_PART_UNTYPED", () => { const c = parseJsonc(readFileSync(beta("wrangler.jsonc"), "utf8")); delete c.rules; writeJson(beta("wrangler.jsonc"), c); }],
    ["MEMBER_COMPAT_UNSTATED", () => { const c = parseJsonc(readFileSync(beta("wrangler.jsonc"), "utf8")); delete c.compatibility_date; writeJson(beta("wrangler.jsonc"), c); }],
    ["VERSION_SKEW", () => writeJson(beta("package.json"), { ...readJson(beta("package.json")), version: "1.2.4" })],
    ["VERSION_DISAGREES", () => {}, ["--version", "9.9.9"]],
    ["VERSION_ALREADY_RELEASED", () => writeJson(join(root, "release/RELEASE.json"), { version: VERSION, sha256: "f".repeat(64) })],
  ];
  try {
    const pristine = new Map(Object.keys(snapshot(root)).map((k) => [k, readFileSync(join(root, k))]));
    for (const [code, arrange, args = []] of cases) {
      arrange();
      const before = snapshot(root);
      refused(assemble(root, ["--dry-run", ...args]), code);
      assert.deepEqual(snapshot(root), before, `${code}: nothing written`);
      for (const k of Object.keys(snapshot(root))) if (!pristine.has(k)) rmSync(join(root, k));
      for (const [k, b] of pristine) writeFileSync(join(root, k), b);
    }
    const { plane } = expectedPayload(root);
    writeJson(join(root, "release/RELEASE.json"), { version: VERSION, sha256: plane.sha256 });
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "the same version with the same plane is not a second release");
  } finally { rm(root); }
});

const sshVerify = (signerLine, sig, bytes, ns) => {
  const dir = mkdtempSync(join(tmpdir(), "bundler-ver-"));
  try {
    writeFileSync(join(dir, "allowed"), `p ${signerLine.split(" ").slice(0, 2).join(" ")}\n`);
    writeFileSync(join(dir, "s.sig"), sig);
    execFileSync("ssh-keygen", ["-Y", "verify", "-f", join(dir, "allowed"), "-I", "p", "-n", ns, "-s", join(dir, "s.sig")], { input: bytes, stdio: "pipe" });
    return true;
  } catch { return false; } finally { rmSync(dir, { recursive: true, force: true }); }
};

test("R23: --sign signs the plane in bio-release and the payload in bio-release-fleet, verified by stock ssh-keygen, then copies every asset and part and writes RELEASE.json", async () => {
  const root = await makeRepo();
  try {
    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes(seed.split(".")[2]), "the seed is never printed");
    const { payload, members, plane } = expectedPayload(root);
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.deepEqual(Object.keys(rel), ["version", "sha256", "bytes", "asset", "sig", "signer", "fleet", "fleetSig"]);
    assert.deepEqual({ ...rel, sig: null, fleetSig: null }, { version: VERSION, sha256: plane.sha256, bytes: plane.bytes,
      asset: "bio-plane.bundled.mjs", sig: null, signer, fleet: members, fleetSig: null });
    assert.ok(sshVerify(signer, rel.sig, plane.buf, NS_RELEASE), "stock ssh-keygen accepts sig over the plane");
    assert.ok(sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET), "stock ssh-keygen accepts fleetSig over the payload");
    assert.equal((await verifySshsig(rel.fleetSig, new TextEncoder().encode(payload), NS_FLEET, [signer])).ok, true);
    for (const m of [planeMember(root), ...discoverMembers(root)])
      assert.ok(readFileSync(join(root, "release", `${m.name}.bundled.mjs`)).equals(readFileSync(join(m.abs, m.bundle.outfile))), m.name);
    assert.equal(readFileSync(join(root, "release/beta-worker/assets/model.bin"), "utf8"), "MODEL-1", "a part under <member>/<path>");
  } finally { rm(root); }
});

test("R23: without --sign the fleet signature comes from --fleet-sig and the plane's from RELEASE.json; each must verify for the release's signer or it refuses, writing nothing", async () => {
  const root = await makeRepo();
  try {
    const seed = envelope(), signer = signerPublicLine(seed);
    const { payload, plane } = expectedPayload(root);
    const relPath = join(root, "release/RELEASE.json");
    const sigFile = join(mkdtempSync(join(tmpdir(), "bundler-sig-")), "fleet.sig");
    const goodPlane = signSshsig(seed, plane.buf, NS_RELEASE);
    const attempt = (rel, args, env = {}) => {
      writeJson(relPath, rel);
      const before = snapshot(root);
      const r = assemble(root, args, env);
      return { r, unchanged: JSON.stringify(snapshot(root)) === JSON.stringify(before) };
    };
    const expectRefused = (code, rel, args, env) => { const { r, unchanged } = attempt(rel, args, env); refused(r, code); assert.ok(unchanged, `${code}: nothing written`); };

    expectRefused("NO_SEED", { signer }, ["--sign"], SIGNING);
    expectRefused("SIGNING_FAILED", { signer }, ["--sign"], { BIO_RELEASE_SEED: "not-an-envelope", ...SIGNING });
    expectRefused("NO_PLANE_SIG", { signer }, []);
    expectRefused("PLANE_SIG_DOES_NOT_COVER_ASSET", { signer, sig: signSshsig(seed, Buffer.from("older plane"), NS_RELEASE) }, []);
    /* With --sign the signer is the seed's own key (R30's T47 clause): another key in RELEASE.json is SIGNER_DISAGREES
       and none is written from the seed, each tested under R30 below. */
    expectRefused("NO_FLEET_SIG", { signer, sig: goodPlane }, []);
    writeFileSync(sigFile, signSshsig(seed, payload + "member dropped\n", NS_FLEET));
    expectRefused("FLEET_SIG_REJECTED", { signer, sig: goodPlane }, ["--fleet-sig", sigFile]);
    writeFileSync(sigFile, signSshsig(seed, payload, NS_RELEASE));
    expectRefused("FLEET_SIG_REJECTED", { signer, sig: goodPlane }, ["--fleet-sig", sigFile]);

    const fleetSig = signSshsig(seed, payload, NS_FLEET);
    writeFileSync(sigFile, fleetSig);
    const noticeFile = join(sigFile, "..", "notice.sig");
    writeFileSync(noticeFile, signSshsig(seed, expectedNotice(root, payload).statement, NS_RELEASE_NOTICE));
    const { r } = attempt({ version: "1.2.2", signer, sig: goodPlane }, ["--fleet-sig", sigFile, "--notice-sig", noticeFile]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(relPath);
    assert.equal(rel.sig, goodPlane);
    assert.equal(rel.fleetSig, fleetSig);
    assert.equal(rel.version, VERSION);
    assert.ok(existsSync(join(root, "release/alpha-worker.bundled.mjs")));
    rmSync(sigFile);
  } finally { rm(root); }
});

/* --------------------------------------------------------- R24, R25, R26 */

test("R24: bundles.mjs surveys a container member with no Worker bundle as listed, not guarded, never stale; one with a bundle is surveyed like any member", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner", { bundle: false });
    addContainerMember(root, "hosted");
    await buildAll(root);
    const r = bundles(root, ["--check"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /4 guarded bundle\(s\) — alpha-worker, beta-worker, bio-plane, hosted/);
    assert.match(r.stdout, /1 container member\(s\) listed, not bundle-guarded \(no Worker bundle\) — runner/);
    assert.doesNotMatch(r.stdout, /runner: declares no/);
    const full = bundles(root);
    assert.equal(full.status, 0, "and a rebuild run has nothing to rebuild and nothing it could not");
    writeFileSync(join(root, "hosted/src/word.mjs"), 'export const word = "moved";\n');
    const stale = bundles(root, ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /1 of 4 bundle\(s\) are STALE — hosted/);
  } finally { rm(root); }
});

test("R22: a worker member that declares no bundle block refuses NO_ARTIFACT, never drops out of the release", async () => {
  const root = await makeRepo();
  try {
    const p = join(root, "alpha-worker/fleet-member.json");
    const { bundle: _b, ...rest } = readJson(p);
    writeJson(p, rest);
    const before = snapshot(root);
    const r = assemble(root, ["--dry-run"]);
    refused(r, "NO_ARTIFACT");
    assert.match(r.stderr, /alpha-worker is a fleet member and declares no `bundle` block/);
    assert.deepEqual(snapshot(root), before);
  } finally { rm(root); }
});

test("R25: a container member's container.json part (type Container, its marker's descriptor) is in the signed payload, written under <member>/container.json, and listed in RELEASE.json", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    await buildAll(root);
    const { payload, members, bufs } = expectedPayload(root);
    const runner = members.find((m) => m.member === "runner");
    const part = runner.parts.find((x) => x.path === "container.json");
    assert.equal(part.type, "Container");
    assert.match(payload, new RegExp(`^member runner .* parts=container\\.json:Container:${part.sha256}:${part.bytes}$`, "m"));
    assert.equal(JSON.parse(bufs["runner/container.json"]).image, `docker.io/civicos/runner@${DIGEST}`);

    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.ok(dry.stdout.includes(payload), "the payload the fleet signature covers carries the descriptor's hash");
    assert.equal(existsSync(join(root, "release/runner")), false, "--dry-run writes nothing");

    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.deepEqual(rel.fleet, members);
    assert.ok(readFileSync(join(root, "release/runner/container.json")).equals(bufs["runner/container.json"]), "the exact bytes hashed");
    assert.ok(readFileSync(join(root, "release/runner.bundled.mjs")).equals(readFileSync(join(root, "runner/dist/runner.bundled.mjs"))),
      "its asset is its Worker bundle, like any member's");
    assert.ok(sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET));
    assert.equal(existsSync(join(root, "runner/container.json")), false, "never written into the member's tree");
  } finally { rm(root); }
});

test("R25: a container member with a Worker bundle whose marker lacks a field of the part, or states no digest in the pinned form, is refused CONTAINER_UNDESCRIBED naming the field, before anything is written", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    await buildAll(root);
    const marker = join(root, "runner/fleet-member.json");
    const good = readFileSync(marker);
    const seed = envelope();
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer: signerPublicLine(seed) });
    const cases = [
      ["image.digest", (m) => { m.image.digest = null; }],
      ["image.digest", (m) => { m.image.digest = "sha256:" + "ab".repeat(31); }],
      ["image.repository", (m) => { delete m.image.repository; }],
      ["image.schedulingPolicy", (m) => { m.image.schedulingPolicy = "regional"; }],
      ["class_name", (m) => { delete m.class_name; }],
      ["max_instances", (m) => { m.max_instances = 0; }],
      ["bind", (m) => { m.bind = [{ member: "no-such-worker", binding: "RUNNER" }]; }],
      ["class_name, max_instances", (m) => { delete m.class_name; delete m.max_instances; }],
    ];
    for (const [field, mutate] of cases) {
      const m = JSON.parse(good);
      mutate(m);
      writeJson(marker, m);
      const before = snapshot(root);
      const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
      refused(r, "CONTAINER_UNDESCRIBED");
      assert.ok(r.stderr.includes(`runner is a container member and its fleet-member.json does not state ${field}.`), `${field}:\n${r.stderr}`);
      assert.doesNotMatch(r.stdout, /guard: /, `${field}: refused before any build ran`);
      assert.deepEqual(snapshot(root), before, `${field}: nothing written`);
    }
    writeFileSync(marker, good);
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "restored, it assembles");
  } finally { rm(root); }
});

test("R25: a container member that declares no Worker bundle is left out of the release by name (K1730), and the fleet signature covers only what ships", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner", { bundle: false, marker: { image: { repository: "docker.io/civicos/runner", digest: null } } });
    await buildAll(root);
    const { payload, members } = expectedPayload(root);
    assert.deepEqual(members.map((m) => m.member), ["alpha-worker", "beta-worker"]);
    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /left out: runner — a container member with no Worker bundle to host its class/);
    assert.ok(dry.stdout.includes(payload), "the payload names no runner");
    assert.doesNotMatch(payload, /runner/);
    assert.match(dry.stdout, /would carry 3 assets/);

    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(readJson(join(root, "release/RELEASE.json")).fleet.map((e) => e.member), ["alpha-worker", "beta-worker"]);
    assert.equal(existsSync(join(root, "release/runner")), false);

    /* A hosted container member may not bind a member the release leaves out. */
    addContainerMember(root, "hosted", { marker: { bind: [{ member: "runner", binding: "X" }] } });
    await buildAll(root);
    const bad = assemble(root, ["--dry-run"]);
    refused(bad, "CONTAINER_UNDESCRIBED");
    assert.match(bad.stderr, /hosted is a container member and its fleet-member\.json does not state bind\./);
  } finally { rm(root); }
});

// fixtures-own: platform the Cloudflare API's own answers to the container deploy's account calls, a scripted-network double of the platform; no module answers for them
const containerStub = (extra = {}) => ({ subdomain: "sub", containers: 200, scripts: { [SLUG]: {} },
  serving: { runner: JSON.stringify({ version: VERSION }) }, ...extra });

test("R26: deploy-fleet pushes a container member's image to Cloudflare's registry with the account's token, by digest, then deploys its Worker and container from its own config with the pushed image", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    const tracked = join(root, "runner/wrangler.jsonc");
    const trackedBefore = readFileSync(tracked);
    const r = fleet(root, ["runner", "--instance", SLUG], { stub: containerStub() });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const ref = `docker.io/civicos/runner@${DIGEST}`, tag = `runner:${"ab".repeat(6)}`;
    assert.deepEqual(r.docker.map((d) => d.args), [["pull", ref], ["tag", ref, tag]], "pulled by digest, tagged by digest");
    assert.equal(r.wrangler.length, 2);
    assert.deepEqual(r.wrangler[0].args, ["containers", "push", tag]);
    assert.equal(r.wrangler[0].token, "present", "pushed with the account's token");
    assert.deepEqual(r.wrangler[1].args.slice(0, 2), ["deploy", "-c"]);
    const want = parseJsonc(trackedBefore.toString());
    want.containers = want.containers.map((c) => ({ ...c, image: `registry.cloudflare.com/${ACCOUNT}/${tag}` }));
    assert.deepEqual(JSON.parse(r.wrangler[1].config), want, "its own config, the container naming the project's pushed copy");
    for (const w of r.wrangler) assert.equal(realpathSync(w.cwd), realpathSync(join(root, "runner")));
    assert.ok(readFileSync(tracked).equals(trackedBefore), "the tracked config is never written");
    assert.equal(existsSync(join(root, "runner/.wrangler.deploy.generated.json")), false);
    assert.ok(r.calls.some((c) => c.url.endsWith(`/accounts/${ACCOUNT}/containers/applications`) && c.bearer));
    assert.match(r.stdout, /preflight: Containers reachable/);
    assert.match(r.stdout, /rollout: runner serving 1\.2\.3 after/);
    assert.ok(!(r.stdout + r.stderr).includes("cf-secret-token-value"), "the token is never printed");
  } finally { rm(root); }
});

test("R26: a token that cannot reach Containers is refused CONTAINERS_UNREACHABLE, naming what the account lacks, before anything is pushed or deployed; --dry-run pushes and deploys nothing", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    for (const stub of [containerStub({ containers: 403 }), containerStub({ containers: 401 }), containerStub({ containers: 500 }),
      containerStub({ unreachable: ["/containers/"] })]) {
      for (const args of [["runner", "--instance", SLUG], ["runner", "--instance", SLUG, "--dry-run"]]) {
        const r = fleet(root, args, { stub });
        refused(r, "CONTAINERS_UNREACHABLE");
        assert.match(r.stderr, new RegExp(`cannot reach Containers in account ${ACCOUNT}`));
        assert.match(r.stderr, /needs the Containers edit permission/);
        assert.deepEqual([r.docker, r.wrangler], [[], []], "nothing pulled, pushed or deployed");
      }
    }
    const dry = fleet(root, ["runner", "--instance", SLUG, "--dry-run"], { stub: containerStub() });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /--dry-run: nothing was pushed or deployed/);
    assert.deepEqual([dry.docker, dry.wrangler], [[], []]);
    /* A worker member never asks for Containers. */
    const w = fleet(root, ["alpha-worker", "--instance", SLUG, "--dry-run"], { stub: containerStub({ containers: 403 }) });
    assert.equal(w.status, 0, w.stderr);
    assert.ok(!w.calls.some((c) => c.url.includes("/containers/")));
  } finally { rm(root); }
});

test("R26: a container member with no pinned digest, or whose config declares no container, is refused CONTAINER_UNDESCRIBED before any request; a failed pull or push exits with its status and deploys nothing", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner", { marker: { image: { repository: "docker.io/civicos/runner", digest: null } } });
    const nodigest = fleet(root, ["runner", "--instance", SLUG, "--dry-run"], { stub: containerStub() });
    refused(nodigest, "CONTAINER_UNDESCRIBED");
    assert.match(nodigest.stderr, /does not state image\.digest/);
    assert.deepEqual([nodigest.calls, nodigest.docker, nodigest.wrangler], [[], [], []]);

    addContainerMember(root, "plain", { containers: false });
    const noconf = fleet(root, ["plain", "--instance", SLUG], { stub: containerStub() });
    refused(noconf, "CONTAINER_UNDESCRIBED");
    assert.match(noconf.stderr, /plain is a container member and its wrangler\.jsonc declares no `containers`/);
    assert.deepEqual([noconf.calls, noconf.docker, noconf.wrangler], [[], [], []]);

    addContainerMember(root, "runner");
    const gen = join(root, "runner/.wrangler.deploy.generated.json");
    const pull = fleet(root, ["runner", "--instance", SLUG], { env: { CF_TOKEN: "t", DOCKER_EXIT: "4" }, stub: containerStub() });
    assert.equal(pull.status, 4, "the pull's failure is the exit");
    assert.match(pull.stderr, /Nothing was deployed/);
    assert.equal(pull.docker.length, 1);
    assert.deepEqual(pull.wrangler, []);
    const push = fleet(root, ["runner", "--instance", SLUG], { env: { CF_TOKEN: "t", WRANGLER_EXIT: "6" }, stub: containerStub() });
    assert.equal(push.status, 6, "the push's failure is the exit");
    assert.deepEqual(push.wrangler.map((w) => w.args[0]), ["containers"], "no deploy after a failed push");
    assert.equal(existsSync(gen), false);
  } finally { rm(root); }
});

/* ------------------------------------------- R25, R26: a member with two classes (T36-2) */

test("R25: a container member with two classes carries one Container part per class, container/<class>.json, each its own image, covered by the fleet signature and written under <member>/", async () => {
  const root = await makeRepo({ build: false });
  try {
    addScannerMember(root, "scanner");
    await buildAll(root);
    const { payload, members, bufs } = expectedPayload(root);
    const scanner = members.find((m) => m.member === "scanner");
    assert.deepEqual(scanner.parts.map((p) => [p.path, p.type]),
      [["container/FileScanner.json", "Container"], ["container/SafeViewRenderer.json", "Container"]]);
    assert.equal(JSON.parse(bufs["scanner/container/FileScanner.json"]).image, `docker.io/civicos/file-scanner@${DIGEST_A}`);
    assert.equal(JSON.parse(bufs["scanner/container/SafeViewRenderer.json"]).image, `docker.io/civicos/safe-view@${DIGEST_B}`);
    for (const p of scanner.parts) assert.ok(payload.includes(`${p.path}:Container:${p.sha256}:${p.bytes}`), p.path);

    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.ok(dry.stdout.includes(payload), "the payload the fleet signature covers carries both descriptors' hashes");

    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.deepEqual(rel.fleet, members);
    for (const c of ["FileScanner", "SafeViewRenderer"])
      assert.ok(readFileSync(join(root, `release/scanner/container/${c}.json`)).equals(bufs[`scanner/container/${c}.json`]), c);
    assert.equal(existsSync(join(root, "release/scanner/container.json")), false, "no one-class part beside them");
    assert.ok(sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET));
  } finally { rm(root); }
});

test("R25: a class of a two-class member lacking a field is refused CONTAINER_UNDESCRIBED naming the class and the field, before anything is built or written", async () => {
  const root = await makeRepo({ build: false });
  try {
    addScannerMember(root, "scanner");
    await buildAll(root);
    const marker = join(root, "scanner/fleet-member.json");
    const good = readFileSync(marker);
    const cases = [
      ["for its class SafeViewRenderer, image.digest", (m) => { m.containers[1].image.digest = null; }],
      ["for its class FileScanner, max_instances", (m) => { m.containers[0].max_instances = 0; }],
      ["for its class FileScanner, bind", (m) => { delete m.bind; }],
      ["for its class FileScanner, class_name", (m) => { m.containers[1].class_name = "FileScanner"; }],
    ];
    for (const [named, mutate] of cases) {
      const m = JSON.parse(good);
      mutate(m);
      writeJson(marker, m);
      const before = snapshot(root);
      const r = assemble(root, ["--dry-run"]);
      refused(r, "CONTAINER_UNDESCRIBED");
      assert.ok(r.stderr.includes(`scanner is a container member and its fleet-member.json does not state, ${named}.`), `${named}:\n${r.stderr}`);
      assert.doesNotMatch(r.stdout, /guard: /, `${named}: refused before any build ran`);
      assert.deepEqual(snapshot(root), before, `${named}: nothing written`);
    }
    writeFileSync(marker, good);
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "restored, it assembles");
  } finally { rm(root); }
});

test("R26: deploy-fleet pushes each class's image of a two-class member by digest and points each of its config's containers at its own class's pushed copy", async () => {
  const root = await makeRepo({ build: false });
  try {
    addScannerMember(root, "scanner");
    const tracked = join(root, "scanner/wrangler.jsonc");
    const trackedBefore = readFileSync(tracked);
    const r = fleet(root, ["scanner", "--instance", SLUG], { stub: containerStub({ serving: { scanner: JSON.stringify({ version: VERSION }) } }) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const refA = `docker.io/civicos/file-scanner@${DIGEST_A}`, refB = `docker.io/civicos/safe-view@${DIGEST_B}`;
    const tagA = `scanner-filescanner:${"c3".repeat(6)}`, tagB = `scanner-safeviewrenderer:${"d4".repeat(6)}`;
    assert.deepEqual(r.docker.map((d) => d.args), [["pull", refA], ["tag", refA, tagA], ["pull", refB], ["tag", refB, tagB]]);
    assert.deepEqual(r.wrangler.map((w) => w.args.slice(0, 3)), [["containers", "push", tagA], ["containers", "push", tagB], ["deploy", "-c", r.wrangler[2].args[2]]]);
    const want = parseJsonc(trackedBefore.toString());
    want.containers = want.containers.map((c) => ({ ...c, image: `registry.cloudflare.com/${ACCOUNT}/${c.class_name === "FileScanner" ? tagA : tagB}` }));
    assert.deepEqual(JSON.parse(r.wrangler[2].config), want, "each class's container names its own pushed copy");
    assert.ok(readFileSync(tracked).equals(trackedBefore), "the tracked config is never written");
  } finally { rm(root); }
});

test("R26: a two-class member whose class states no digest, or whose config's containers and marker's classes disagree, is refused CONTAINER_UNDESCRIBED before any request", async () => {
  const root = await makeRepo({ build: false });
  try {
    const cls = scannerClasses();
    cls[1].image.digest = null;
    addScannerMember(root, "scanner", { classes: cls });
    const nod = fleet(root, ["scanner", "--instance", SLUG, "--dry-run"], { stub: containerStub() });
    refused(nod, "CONTAINER_UNDESCRIBED");
    assert.match(nod.stderr, /does not state, for its class SafeViewRenderer, image\.digest/);
    assert.deepEqual([nod.calls, nod.docker, nod.wrangler], [[], [], []]);

    addScannerMember(root, "scanner");
    const cfgPath = join(root, "scanner/wrangler.jsonc");
    const cfg = parseJsonc(readFileSync(cfgPath, "utf8"));
    writeJson(cfgPath, { ...cfg, containers: [cfg.containers[0], { ...cfg.containers[1], class_name: "Renderer" }] });
    const dis = fleet(root, ["scanner", "--instance", SLUG], { stub: containerStub() });
    refused(dis, "CONTAINER_UNDESCRIBED");
    assert.match(dis.stderr, /the config names Renderer, which the marker states no image for; the marker's SafeViewRenderer has no container in the config/);
    assert.deepEqual([dis.calls, dis.docker, dis.wrangler], [[], [], []]);
  } finally { rm(root); }
});

/* ------------------------------------------------------- R33: a container's size (T50; N1170, K3535) */

test("R33: a container member whose configuration names an instance_type is emitted with it inside the signed part, each class its own; a class naming none is emitted without the field", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner", { instanceType: "standard-1" });
    addScannerMember(root, "scanner", { instanceTypes: { FileScanner: "standard-2", SafeViewRenderer: { vcpu: 1, memory_mib: 2048, disk_mb: 4000 } } });
    addScannerMember(root, "mixed", { instanceTypes: { SafeViewRenderer: "basic" } });
    await buildAll(root);
    const { payload, members, bufs } = expectedPayload(root);
    const part = (buf) => JSON.parse(buf);
    assert.equal(part(bufs["runner/container.json"]).instance_type, "standard-1");
    assert.equal(part(bufs["scanner/container/FileScanner.json"]).instance_type, "standard-2");
    assert.deepEqual(part(bufs["scanner/container/SafeViewRenderer.json"]).instance_type, { vcpu: 1, memory_mib: 2048, disk_mb: 4000 });
    assert.equal(Object.hasOwn(part(bufs["mixed/container/FileScanner.json"]), "instance_type"), false, "a class naming none gets no field");
    assert.equal(part(bufs["mixed/container/SafeViewRenderer.json"]).instance_type, "basic");
    for (const m of members) for (const p of m.parts) assert.ok(payload.includes(`${p.path}:${p.type}:${p.sha256}:${p.bytes}`), `${m.member}/${p.path} is in the statement`);

    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.ok(dry.stdout.includes(payload), "the payload the fleet signature covers carries the sized parts' hashes");

    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.deepEqual(rel.fleet, members);
    for (const k of ["runner/container.json", "scanner/container/FileScanner.json", "scanner/container/SafeViewRenderer.json",
      "mixed/container/FileScanner.json", "mixed/container/SafeViewRenderer.json"])
      assert.ok(readFileSync(join(root, "release", k)).equals(bufs[k]), `${k}: the exact bytes hashed`);
    assert.ok(sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET));
  } finally { rm(root); }
});

test("R33 (control): a container member whose configuration names no instance_type is emitted without the field, never a guessed size", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    addScannerMember(root, "scanner");
    await buildAll(root);
    const { payload, bufs } = expectedPayload(root);
    for (const k of ["runner/container.json", "scanner/container/FileScanner.json", "scanner/container/SafeViewRenderer.json"])
      assert.doesNotMatch(bufs[k].toString(), /instance_type/, k);
    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.ok(dry.stdout.includes(payload), "and the parts are the same bytes the release always wrote");
    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(readFileSync(join(root, "release/runner/container.json"), "utf8"), /instance_type/);
  } finally { rm(root); }
});

test("R33 (control): an instance_type the configuration states that is not a size name or a size block is refused CONTAINER_UNDESCRIBED naming it, before anything is written", async () => {
  for (const bad of ["", "   ", 7, [], {}, null]) {
    const root = await makeRepo({ build: false });
    try {
      addContainerMember(root, "runner");
      editConfig(root, "runner", (c) => { c.containers[0].instance_type = bad; });
      await buildAll(root);
      const before = snapshot(root);
      const r = assemble(root, ["--dry-run"]);
      refused(r, "CONTAINER_UNDESCRIBED");
      assert.match(r.stderr, /runner is a container member and its fleet-member\.json does not state.* instance_type/, JSON.stringify(bad));
      assert.deepEqual(snapshot(root), before);
    } finally { rm(root); }
  }
});

/* ------------------------------------------------------- R25: a member's Worker part (N772, K2155) */

/** Rewrites a fixture member's wrangler.jsonc with `change` applied to its parsed config. */
const editConfig = (root, member, change) => {
  const p = join(root, member, "wrangler.jsonc");
  const c = parseJsonc(readFileSync(p, "utf8"));
  change(c);
  writeJson(p, c);
};

test("R25: a member whose wrangler.jsonc binds R2 buckets or states crons carries one Worker part, worker.json, each bucket by its role and the crons as stated, covered by the fleet signature, written under <member>/ and listed; a member with neither carries none", async () => {
  const root = await makeRepo({ build: false, members: { "alpha-worker": {}, "beta-worker": { assets: { "assets/model.bin": "MODEL-1" } },
    "gamma-worker": {}, "delta-worker": {} } });
  try {
    editConfig(root, "alpha-worker", (c) => { c.r2_buckets = [{ binding: "CAPTURES", bucket_name: "bio-captures" },
      { binding: "PUBLISHED", bucket_name: "bio-published" }]; c.triggers = { crons: ["17 4 * * *", "0 */6 * * *"] }; });
    editConfig(root, "beta-worker", (c) => { c.r2_buckets = [{ binding: "CAPTURES", bucket_name: "bio-captures" }]; });
    editConfig(root, "gamma-worker", (c) => { c.triggers = { crons: ["5 1 * * 1"] }; });
    editConfig(root, "delta-worker", (c) => { c.r2_buckets = []; c.triggers = { crons: [] }; });
    addScannerMember(root, "scanner");
    editConfig(root, "scanner", (c) => { c.r2_buckets = [{ binding: "CAPTURES", bucket_name: "bio-captures" }]; c.triggers = { crons: ["17 4 * * *"] }; });
    await buildAll(root);
    const { payload, members, bufs } = expectedPayload(root);
    const part = (m) => JSON.parse(bufs[`${m}/worker.json`]);
    assert.deepEqual(part("alpha-worker"), { r2_buckets: [{ binding: "CAPTURES", bucket: "captures" }, { binding: "PUBLISHED", bucket: "published" }],
      crons: ["17 4 * * *", "0 */6 * * *"] });
    assert.deepEqual(part("beta-worker"), { r2_buckets: [{ binding: "CAPTURES", bucket: "captures" }], crons: [] }, "buckets alone");
    assert.deepEqual(part("gamma-worker"), { r2_buckets: [], crons: ["5 1 * * 1"] }, "crons alone");
    assert.deepEqual(Object.keys(part("alpha-worker")), ["r2_buckets", "crons"]);
    assert.equal(bufs["delta-worker/worker.json"], undefined, "empty lists: no part");
    assert.ok(!JSON.stringify(Object.keys(bufs).filter((k) => k.endsWith("worker.json")).map((k) => bufs[k].toString())).includes("bio-captures"),
      "never the account's bucket name");
    assert.deepEqual(members.find((m) => m.member === "scanner").parts.map((p) => [p.path, p.type]),
      [["container/FileScanner.json", "Container"], ["container/SafeViewRenderer.json", "Container"], ["worker.json", "Worker"]],
      "a container member carries both");
    assert.deepEqual(members.find((m) => m.member === "beta-worker").parts.map((p) => p.path), ["assets/model.bin", "worker.json"]);
    assert.match(payload, /^bio-release-fleet\/2\n/, "the statement's format is unchanged");
    for (const m of ["alpha-worker", "beta-worker", "gamma-worker", "scanner"]) {
      const p = members.find((x) => x.member === m).parts.find((x) => x.path === "worker.json");
      assert.match(payload, new RegExp(`^member ${m} .*worker\\.json:Worker:${p.sha256}:${p.bytes}`, "m"), `${m}: in the signed payload`);
    }
    assert.doesNotMatch(payload, /^member delta-worker .*worker\.json/m);

    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.ok(dry.stdout.includes(payload), "the payload the fleet signature covers carries each Worker part's hash");

    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.deepEqual(rel.fleet, members);
    assert.ok(sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET));
    for (const m of ["alpha-worker", "beta-worker", "gamma-worker", "scanner"])
      assert.ok(readFileSync(join(root, `release/${m}/worker.json`)).equals(bufs[`${m}/worker.json`]), `${m}: the exact bytes hashed`);
    assert.equal(existsSync(join(root, "release/delta-worker/worker.json")), false);
    for (const m of ["alpha-worker", "scanner"]) assert.equal(existsSync(join(root, m, "worker.json")), false, "never written into the member's tree");

    /* The installer's own reading of the part (newgroup's workerDescriptor, its R44) takes it as written. */
    const ng = await import(pathToFileURL(join(PLANE, "..", "newgroup/src/index.mjs")).href);
    assert.deepEqual(ng.workerDescriptor(readFileSync(join(root, "release/alpha-worker/worker.json"))), { ok: true, d: part("alpha-worker") });
    assert.deepEqual(ng.workerDescriptor(readFileSync(join(root, "release/scanner/worker.json"))), { ok: true, d: part("scanner") });
  } finally { rm(root); }
});

test("R25: a bucket whose role is neither captures nor published is refused WORKER_UNDESCRIBED naming the binding, as is a list that is not one, before anything is built or written; a declared part at worker.json is refused", async () => {
  const root = await makeRepo();
  try {
    const cfgPath = join(root, "alpha-worker/wrangler.jsonc");
    const good = readFileSync(cfgPath);
    const cases = [
      ["ARCHIVE", (c) => { c.r2_buckets = [{ binding: "CAPTURES", bucket_name: "bio-captures" }, { binding: "ARCHIVE", bucket_name: "my-archive" }]; }],
      ["CAPTURES, PUBLISHED", (c) => { c.r2_buckets = [{ binding: "CAPTURES", bucket_name: "acct-captures" }, { binding: "PUBLISHED" }]; }],
      ["(an R2 bucket binding with no name)", (c) => { c.r2_buckets = [{ bucket_name: "bio-captures" }]; }],
      ["r2_buckets", (c) => { c.r2_buckets = { binding: "CAPTURES", bucket_name: "bio-captures" }; }],
      ["triggers.crons", (c) => { c.triggers = { crons: "17 4 * * *" }; }],
      ["triggers.crons", (c) => { c.triggers = { crons: ["17 4 * * *", ""] }; }],
      ["triggers.crons", (c) => { c.triggers = ["17 4 * * *"]; }],
    ];
    for (const [named, change] of cases) {
      editConfig(root, "alpha-worker", change);
      const before = snapshot(root);
      const r = assemble(root, ["--dry-run"]);
      refused(r, "WORKER_UNDESCRIBED");
      assert.ok(r.stderr.includes(`alpha-worker's wrangler.jsonc does not state, as the release's Worker part needs, ${named}.`), `${named}:\n${r.stderr}`);
      assert.doesNotMatch(r.stdout, /guard: /, `${named}: refused before any build ran`);
      assert.deepEqual(snapshot(root), before, `${named}: nothing written`);
      writeFileSync(cfgPath, good);
    }
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "restored, it assembles");

    /* A member's own upload part may not take the Worker part's path. */
    editConfig(root, "beta-worker", (c) => { c.r2_buckets = [{ binding: "CAPTURES", bucket_name: "bio-captures" }];
      c.rules.push({ type: "Data", globs: ["worker.json"] }); });
    const mk = join(root, "beta-worker/fleet-member.json");
    const marker = readJson(mk);
    marker.bundle.assets.push("worker.json");
    writeJson(mk, marker);
    writeFileSync(join(root, "beta-worker/worker.json"), "{}");
    await buildAll(root);
    const before = snapshot(root);
    const clash = assemble(root, ["--dry-run"]);
    refused(clash, "WORKER_UNDESCRIBED");
    assert.match(clash.stderr, /beta-worker declares an upload part named worker\.json, which is the Worker part's own path\./);
    assert.deepEqual(snapshot(root), before, "nothing written");
  } finally { rm(root); }
});

/* ------------------------------------------------------------------------ R30 */

const ENVSPY = join(import.meta.dirname, "envspy.mjs");

test("R30: --sign outside the GitHub Actions signing environment is refused NOT_SIGNING_ENVIRONMENT before the seed is read, before any build, writing nothing", async () => {
  const root = await makeRepo();
  try {
    const seed = envelope();
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer: signerPublicLine(seed) });
    const before = snapshot(root);
    for (const env of [{ BIO_RELEASE_SEED: seed }, { BIO_RELEASE_SEED: "not-an-envelope" }, {}, { BIO_RELEASE_SEED: seed, GITHUB_ACTIONS: "false" }]) {
      const r = assemble(root, ["--sign"], env);
      refused(r, "NOT_SIGNING_ENVIRONMENT");
      assert.equal(r.status, 1);
      assert.doesNotMatch(r.stderr, /NO_SEED|SIGNING_FAILED/, "refused before the seed is looked at: neither its absence nor its shape is reached");
      assert.doesNotMatch(r.stdout, /guard: |signed:/, "before any build, and nothing signed");
      assert.ok(!(r.stdout + r.stderr).includes(seed.split(".")[2]), "the seed is never printed");
      assert.deepEqual(snapshot(root), before, "nothing written");
    }
  } finally { rm(root); }
});

test("R30: no command a session runs reads BIO_RELEASE_SEED or writes a signature: assembly, the payload and plane asset it writes, completion from signatures made elsewhere, the refused --sign, the bundle survey and the advisory report", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r30-"));
  try {
    const seed = envelope(), signer = signerPublicLine(seed);
    const { payload, plane } = expectedPayload(root);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    /* The signatures, made "in the signing environment": here, by the test with a throwaway key. */
    writeFileSync(join(work, "fleet.sig"), signSshsig(seed, payload, NS_FLEET));
    writeFileSync(join(work, "plane.sig"), signSshsig(seed, plane.buf, NS_RELEASE));
    writeFileSync(join(work, "notice.sig"), signSshsig(seed, expectedNotice(root, payload).statement, NS_RELEASE_NOTICE));
    writeJson(join(work, "osv.json"), {});
    const spy = join(work, "spy.log");
    const session = [
      ["bio-plane/scripts/release-assemble.mjs", "--dry-run"],
      ["bio-plane/scripts/release-assemble.mjs", "--version", VERSION, "--emit-payload", join(work, "p.txt"), "--emit-plane", join(work, "plane.mjs")],
      ["bio-plane/scripts/release-assemble.mjs", "--sign"],
      ["bio-plane/scripts/release-assemble.mjs", "--version", VERSION, "--fleet-sig", join(work, "fleet.sig"), "--plane-sig", join(work, "plane.sig"),
        "--notice-sig", join(work, "notice.sig")],
      ["bio-plane/scripts/bundles.mjs", "--check"],
      ["bio-plane/scripts/bundles.mjs", "--install-dirs"],
      ["--import", join(import.meta.dirname, "osvstub.mjs"), "bio-plane/scripts/release-advisories.mjs"],
    ];
    for (const args of session) {
      const r = run(root, ".", ["--import", ENVSPY, ...args], { env: { BIO_RELEASE_SEED: seed, ENV_SPY_LOG: spy, OSV_STUB: join(work, "osv.json") } });
      const asked = existsSync(spy) ? readFileSync(spy, "utf8") : "";
      assert.equal(asked, "", `${args.join(" ")} asked for BIO_RELEASE_SEED:\n${asked}`);
      assert.ok(!(r.stdout + r.stderr).includes("BEGIN SSH SIGNATURE"), `${args.join(" ")} printed no signature`);
      assert.ok(!(r.stdout + r.stderr).includes(seed.split(".")[2]), "the seed is never printed");
    }
    /* The completion wrote the release from the signatures it was given, never from ones it made. */
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.equal(rel.sig, readFileSync(join(work, "plane.sig"), "utf8"));
    assert.equal(rel.fleetSig, readFileSync(join(work, "fleet.sig"), "utf8"));
    assert.equal(readJson(join(root, "release/NOTICE.json")).sig, readFileSync(join(work, "notice.sig"), "utf8"), "and the notice's (R32)");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R30: assembly writes what is to be signed — the fleet payload and the plane asset, exactly — without the seed, and nothing in the repository", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r30w-"));
  try {
    const { payload, plane } = expectedPayload(root);
    const before = snapshot(root);
    const r = assemble(root, ["--version", VERSION, "--dry-run", "--emit-payload", join(work, "p.txt"), "--emit-plane", join(work, "plane.mjs")]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(readFileSync(join(work, "p.txt"), "utf8"), payload, "the payload signed in bio-release-fleet");
    assert.ok(readFileSync(join(work, "plane.mjs")).equals(plane.buf), "the plane asset signed in bio-release, byte for byte");
    assert.match(r.stdout, new RegExp(`plane asset written to ${join(work, "plane.mjs").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.deepEqual(snapshot(root), before, "nothing in the repository written");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R30: a release is completed from signatures made elsewhere only when R23's checks accept them: --plane-sig and --fleet-sig, each verified by stock ssh-keygen for the release's signer", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r30c-"));
  try {
    const seed = envelope(), signer = signerPublicLine(seed), other = envelope();
    const { payload, plane } = expectedPayload(root);
    const relPath = join(root, "release/RELEASE.json");
    const fsig = join(work, "fleet.sig"), psig = join(work, "plane.sig");
    writeFileSync(fsig, signSshsig(seed, payload, NS_FLEET));
    const nsig = join(work, "notice.sig");
    writeFileSync(nsig, signSshsig(seed, expectedNotice(root, payload).statement, NS_RELEASE_NOTICE));
    const attempt = (planeSig, extra = []) => {
      writeJson(relPath, { version: "1.2.2", signer, sig: signSshsig(seed, Buffer.from("an older plane"), NS_RELEASE) });
      writeFileSync(psig, planeSig);
      const before = snapshot(root);
      const r = assemble(root, ["--version", VERSION, "--fleet-sig", fsig, "--plane-sig", psig, "--notice-sig", nsig, ...extra]);
      return { r, unchanged: JSON.stringify(snapshot(root)) === JSON.stringify(before) };
    };
    for (const [why, sig] of [["another key", signSshsig(other, plane.buf, NS_RELEASE)], ["another namespace", signSshsig(seed, plane.buf, NS_FLEET)],
      ["other bytes", signSshsig(seed, Buffer.from("not the plane"), NS_RELEASE)]]) {
      const { r, unchanged } = attempt(sig);
      refused(r, "PLANE_SIG_DOES_NOT_COVER_ASSET");
      assert.ok(unchanged, `${why}: nothing written`);
    }
    writeFileSync(fsig, signSshsig(other, payload, NS_FLEET));
    const badFleet = attempt(signSshsig(seed, plane.buf, NS_RELEASE));
    refused(badFleet.r, "FLEET_SIG_REJECTED");
    assert.ok(badFleet.unchanged);
    writeFileSync(fsig, signSshsig(seed, payload, NS_FLEET));
    const good = signSshsig(seed, plane.buf, NS_RELEASE);
    const { r } = attempt(good);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rel = readJson(relPath);
    assert.equal(rel.sig, good, "--plane-sig, not RELEASE.json's older sig");
    assert.ok(sshVerify(signer, rel.sig, plane.buf, NS_RELEASE) && sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET));
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R30 (T47, N944): with --sign the signer is the seed's own key: a RELEASE.json naming that key, or none, is signed, verified against it and written with its line; another key is refused SIGNER_DISAGREES naming both, before anything is signed or written", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r30s-"));
  try {
    const seed = envelope(), derived = signerPublicLine(seed);
    const key = (line) => line.split(" ").slice(0, 2).join(" ");
    const relPath = join(root, "release/RELEASE.json");
    const { payload, plane } = expectedPayload(root);
    const emit = join(work, "p.txt"), emitPlane = join(work, "plane.mjs");
    const sign = (rel) => {
      if (rel === undefined) rmSync(relPath, { force: true }); else writeJson(relPath, rel);
      const before = snapshot(root);
      const r = assemble(root, ["--sign", "--emit-payload", emit, "--emit-plane", emitPlane], { BIO_RELEASE_SEED: seed, ...SIGNING });
      return { r, unchanged: JSON.stringify(snapshot(root)) === JSON.stringify(before) };
    };

    /* Another key: refused by name, both keys named and nothing secret; nothing signed, nothing written, not even the
       payload or the plane asset --emit-payload and --emit-plane would have written. */
    const other = signerPublicLine(envelope());
    for (const named of [other, `${key(other)} release-key-of-another`, { not: "a line" }]) {
      const { r, unchanged } = sign({ version: "1.2.2", signer: named });
      refused(r, "SIGNER_DISAGREES");
      assert.ok(r.stderr.includes(key(derived)), `the seed's key named:\n${r.stderr}`);
      assert.ok(r.stderr.includes(typeof named === "string" ? key(named) : JSON.stringify(named)), `RELEASE.json's key named:\n${r.stderr}`);
      assert.doesNotMatch(r.stderr, /PLANE_SIG_DOES_NOT_COVER_ASSET/, "never refused as a signature that does not cover the asset");
      assert.doesNotMatch(r.stdout, /^signed:/m, "nothing signed");
      assert.ok(!(r.stdout + r.stderr).includes("BEGIN SSH SIGNATURE"), "no signature made or printed");
      assert.ok(!(r.stdout + r.stderr).includes(seed.split(".")[2]), "the seed is never printed");
      assert.ok(unchanged, "nothing in the repository written");
      assert.equal(existsSync(emit) || existsSync(emitPlane), false, "nothing emitted either");
    }

    /* The control: the same key, under any comment, is no disagreement. Signed, verified by stock ssh-keygen against
       the seed's key, and written with the seed's own line. */
    for (const [why, rel] of [["the same line", { version: "1.2.2", signer: derived }],
      ["the same key under another comment", { version: "1.2.2", signer: `${key(derived)} bob@release` }],
      ["no signer named", { version: "1.2.2" }], ["an empty signer", { version: "1.2.2", signer: "" }],
      ["no RELEASE.json at all", undefined]]) {
      const { r } = sign(rel);
      assert.equal(r.status, 0, `${why}:\n${r.stdout}${r.stderr}`);
      assert.doesNotMatch(r.stderr, /REFUSED/, why);
      const out = readJson(relPath);
      assert.equal(out.signer, derived, `${why}: written with the seed's own line`);
      assert.ok(sshVerify(derived, out.sig, plane.buf, NS_RELEASE), `${why}: the plane signature verifies for the seed's key`);
      assert.ok(sshVerify(derived, out.fleetSig, Buffer.from(payload), NS_FLEET), `${why}: the fleet signature verifies for it`);
      assert.match(r.stdout, /^verified: stock ssh-keygen accepts `sig` over the plane asset$/m, why);
      assert.equal(readFileSync(emit, "utf8"), payload, `${why}: the emitted payload is the one signed`);
      assert.ok(!(r.stdout + r.stderr).includes(seed.split(".")[2]), "the seed is never printed");
      rmSync(emit); rmSync(emitPlane);
    }

    /* Without --sign nothing is derived: the release is completed for the signer RELEASE.json names, as R23 says. */
    const otherSeed = envelope();
    writeFileSync(join(work, "fleet.sig"), signSshsig(otherSeed, payload, NS_FLEET));
    writeFileSync(join(work, "plane.sig"), signSshsig(otherSeed, plane.buf, NS_RELEASE));
    writeFileSync(join(work, "notice.sig"), signSshsig(otherSeed, expectedNotice(root, payload).statement, NS_RELEASE_NOTICE));
    writeJson(relPath, { version: "1.2.2", signer: signerPublicLine(otherSeed) });
    const done = assemble(root, ["--fleet-sig", join(work, "fleet.sig"), "--plane-sig", join(work, "plane.sig"),
      "--notice-sig", join(work, "notice.sig")], { BIO_RELEASE_SEED: seed });
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.equal(readJson(relPath).signer, signerPublicLine(otherSeed), "RELEASE.json's signer kept");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R30: the commands the signing workflow calls, in order, by their usage lines: the installs listed, the dry run, then --sign in the signing environment completes the release", async () => {
  const root = await makeRepo({ members: { "alpha-worker": {}, "beta-worker": { assets: { "assets/model.bin": "MODEL-1" } }, "gamma-worker": { vendored: true } } });
  try {
    /* 1–2: the plane's install, then the directories the byte guard needs, derived from discovery. */
    const inst = run(root, ".", ["bio-plane/scripts/bundles.mjs", "--install-dirs"]);
    assert.equal(inst.status, 0, inst.stderr);
    assert.deepEqual(inst.stdout.trim().split("\n"), ["bio-plane", "gamma-worker"], "the plane first, then each guarded member with a lockfile");
    /* 3: every R22 check, nothing written. */
    const before = snapshot(root);
    const dry = assemble(root, ["--version", VERSION, "--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.deepEqual(snapshot(root), before);
    /* 4: in the signing environment, signed, verified, written. */
    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--version", VERSION, "--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const { payload, plane } = expectedPayload(root);
    const rel = readJson(join(root, "release/RELEASE.json"));
    assert.ok(sshVerify(signer, rel.sig, plane.buf, NS_RELEASE) && sshVerify(signer, rel.fleetSig, Buffer.from(payload), NS_FLEET));
  } finally { rm(root); }
});

/* ------------------------------------------------------------------------ R32 */

const NOTICE_KEYS = ["version", "date", "manifest", "security", "notes", "sig", "signer"];
const notesPath = (root, v = VERSION) => join(root, "release/notes", `${v}.json`);

test("R32: --sign writes release/NOTICE.json beside the assets — version, the notes file's date, security and notes, the payload's SHA-256, the signature and the signer — and signatures' verifyReleaseNotice accepts it", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r32-"));
  try {
    const seed = envelope(), signer = signerPublicLine(seed);
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const emit = join(work, "notice.txt");
    const r = assemble(root, ["--sign", "--emit-notice", emit], { BIO_RELEASE_SEED: seed, ...SIGNING });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const { payload } = expectedPayload(root);
    const { notice, statement } = expectedNotice(root, payload);
    const out = readJson(join(root, "release/NOTICE.json"));
    assert.deepEqual(Object.keys(out), NOTICE_KEYS);
    assert.deepEqual({ ...out, sig: null }, { ...notice, sig: null, signer });
    assert.deepEqual([out.date, out.security, out.notes], [NOTES.date, NOTES.security, NOTES.notes], "copied from the notes file");
    assert.equal(out.manifest, hex(Buffer.from(payload, "utf8")), "the SHA-256 of the fleet payload: the whole release it announces");
    assert.equal(out.signer, readJson(join(root, "release/RELEASE.json")).signer, "the release's signer line");
    assert.ok(readFileSync(emit).equals(statement), "--emit-notice wrote the statement that was signed");
    const v = await verifyReleaseNotice({ version: out.version, date: out.date, manifest: out.manifest, security: out.security,
      notes: out.notes }, out.sig, "1.2.2", [signer]);
    assert.equal(v.ok, true, JSON.stringify(v));
    assert.ok(sshVerify(signer, out.sig, statement, NS_RELEASE_NOTICE), "stock ssh-keygen accepts it in bio-release-notice");
    assert.ok(!sshVerify(signer, out.sig, statement, NS_RELEASE), "and in no other namespace");
    assert.match(r.stdout, /^verified: stock ssh-keygen accepts the notice's sig over its statement$/m);
    /* The notes are inside what is signed: one character changed is no longer this signature's notice. */
    const tampered = { ...notice, notes: { ...notice.notes, must_do: notice.notes.must_do + "." } };
    assert.equal((await verifyReleaseNotice(tampered, out.sig, "1.2.2", [signer])).ok, false);
    assert.ok(!(r.stdout + r.stderr).includes(seed.split(".")[2]), "the seed is never printed");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R32: the date is the notes file's, never the clock's; a notice without --sign is completed from --notice-sig and written with it", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r32d-"));
  try {
    writeJson(notesPath(root), { ...NOTES, date: "2024-02-29", security: false, notes: { ...NOTES.notes, must_do: "" } });
    const seed = envelope(), signer = signerPublicLine(seed);
    const { payload, plane } = expectedPayload(root);
    const { notice, statement } = expectedNotice(root, payload);
    const emit = join(work, "n.txt");
    const dry = assemble(root, ["--dry-run", "--emit-notice", emit]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.ok(readFileSync(emit).equals(statement), "--emit-notice writes the statement, as --emit-payload writes the payload");
    assert.match(readFileSync(emit, "utf8"), /^date 2024-02-29$/m);
    assert.match(readFileSync(emit, "utf8"), /^security no$/m);
    writeFileSync(join(work, "f.sig"), signSshsig(seed, payload, NS_FLEET));
    writeFileSync(join(work, "p.sig"), signSshsig(seed, plane.buf, NS_RELEASE));
    writeFileSync(join(work, "n.sig"), signSshsig(seed, statement, NS_RELEASE_NOTICE));
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer });
    const r = assemble(root, ["--fleet-sig", join(work, "f.sig"), "--plane-sig", join(work, "p.sig"), "--notice-sig", join(work, "n.sig")]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = readJson(join(root, "release/NOTICE.json"));
    assert.deepEqual(out, { ...notice, sig: readFileSync(join(work, "n.sig"), "utf8"), signer });
    assert.equal(out.date, "2024-02-29");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R32: refuses NO_NOTES and NOTES_UNREADABLE naming the field — on a dry run and a signing run alike — before anything is emitted or written; a notes file with an empty `members` is NOTES_UNREADABLE", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r32n-"));
  try {
    const seed = envelope();
    writeJson(join(root, "release/RELEASE.json"), { version: "1.2.2", signer: signerPublicLine(seed) });
    const cases = [
      ["NO_NOTES", null, () => rmSync(notesPath(root))],
      ["NOTES_UNREADABLE", "notes.members", () => writeJson(notesPath(root), { ...NOTES, notes: { ...NOTES.notes, members: "" } })],
      ["NOTES_UNREADABLE", "notes.administrators", () => writeJson(notesPath(root), { ...NOTES, notes: { ...NOTES.notes, administrators: "" } })],
      ["NOTES_UNREADABLE", "notes.members", () => writeJson(notesPath(root), { ...NOTES, notes: { ...NOTES.notes, members: "x".repeat(8001) } })],
      ["NOTES_UNREADABLE", "notes", () => writeJson(notesPath(root), { ...NOTES, notes: { members: "m", administrators: "a" } })],
      ["NOTES_UNREADABLE", "(the file)", () => writeFileSync(notesPath(root), "{ torn")],
      ["NOTES_UNREADABLE", "(the file)", () => writeJson(notesPath(root), [NOTES])],
      ["NOTES_UNREADABLE", "date", () => writeJson(notesPath(root), { ...NOTES, date: "2026-02-30" })],
      ["NOTES_UNREADABLE", "date", () => { const { date: _d, ...rest } = NOTES; writeJson(notesPath(root), rest); }],
      ["NOTES_UNREADABLE", "security", () => writeJson(notesPath(root), { ...NOTES, security: "yes" })],
      ["NOTES_UNREADABLE", "version", () => writeJson(notesPath(root), { ...NOTES, version: "1.2.2" })],
      ["NOTES_UNREADABLE", "summary", () => writeJson(notesPath(root), { ...NOTES, summary: "not carried" })],
    ];
    const good = readFileSync(notesPath(root));
    for (const [code, field, arrange] of cases) {
      arrange();
      for (const [args, env] of [[["--dry-run", "--emit-notice", join(work, "n.txt"), "--emit-payload", join(work, "p.txt")], {}],
        [["--sign"], { BIO_RELEASE_SEED: seed, ...SIGNING }]]) {
        const before = snapshot(root);
        const r = assemble(root, args, env);
        refused(r, code);
        if (field) assert.ok(r.stderr.includes(`cannot make the release notice: ${field}.`), `${field}:\n${r.stderr}`);
        else assert.match(r.stderr, /release\/notes\/1\.2\.3\.json is absent/);
        assert.doesNotMatch(r.stdout, /^signed:/m, "nothing signed");
        assert.deepEqual(snapshot(root), before, `${code} ${field}: nothing written`);
        assert.equal(existsSync(join(work, "n.txt")) || existsSync(join(work, "p.txt")), false, "nothing emitted");
      }
      writeFileSync(notesPath(root), good);
    }
    writeJson(notesPath(root), { ...NOTES, version: VERSION });
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "a notes file stating the release's own version is accepted");
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R32: without --sign, no --notice-sig is NO_NOTICE_SIG, and a signature over other bytes, in another namespace or by another key is NOTICE_SIG_REJECTED, each writing nothing", async () => {
  const root = await makeRepo();
  const work = mkdtempSync(join(tmpdir(), "bundler-r32s-"));
  try {
    const seed = envelope(), signer = signerPublicLine(seed), other = envelope();
    const { payload, plane } = expectedPayload(root);
    const { notice, statement } = expectedNotice(root, payload);
    writeFileSync(join(work, "f.sig"), signSshsig(seed, payload, NS_FLEET));
    writeFileSync(join(work, "p.sig"), signSshsig(seed, plane.buf, NS_RELEASE));
    const relPath = join(root, "release/RELEASE.json");
    const nsig = join(work, "n.sig");
    const complete = (extra) => {
      writeJson(relPath, { version: "1.2.2", signer });
      const before = snapshot(root);
      const r = assemble(root, ["--fleet-sig", join(work, "f.sig"), "--plane-sig", join(work, "p.sig"), ...extra]);
      return { r, unchanged: JSON.stringify(snapshot(root)) === JSON.stringify(before) };
    };
    const none = complete([]);
    refused(none.r, "NO_NOTICE_SIG");
    assert.ok(none.unchanged, "NO_NOTICE_SIG: nothing written");
    const otherNotes = Buffer.from(releaseNoticeStatement({ ...notice, notes: { ...notice.notes, members: notice.notes.members + "!" } }));
    for (const [why, sig] of [["other bytes", signSshsig(seed, otherNotes, NS_RELEASE_NOTICE)],
      ["another namespace", signSshsig(seed, statement, NS_RELEASE)], ["another key", signSshsig(other, statement, NS_RELEASE_NOTICE)],
      ["the fleet signature", signSshsig(seed, payload, NS_FLEET)]]) {
      writeFileSync(nsig, sig);
      const { r, unchanged } = complete(["--notice-sig", nsig]);
      refused(r, "NOTICE_SIG_REJECTED");
      assert.ok(unchanged, `${why}: nothing written`);
      assert.equal(existsSync(join(root, "release/NOTICE.json")), false, `${why}: no notice`);
    }
    writeFileSync(nsig, signSshsig(seed, statement, NS_RELEASE_NOTICE));
    const { r } = complete(["--notice-sig", nsig]);
    assert.equal(r.status, 0, `the control: the right signature completes it\n${r.stdout}${r.stderr}`);
  } finally { rm(root); rmSync(work, { recursive: true, force: true }); }
});

test("R32 (amends R22, R30): no session command reads the seed or signs the notice; the dry run proves the notes and names the notice it would carry", async () => {
  const root = await makeRepo();
  try {
    const before = snapshot(root);
    const dry = assemble(root, ["--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /^notice: 1\.2\.3 of 2026-10-14, manifest [0-9a-f]{16}…, security yes — from release\/notes\/1\.2\.3\.json$/m);
    assert.match(dry.stdout, /and its notice from release\/notes\/1\.2\.3\.json\./);
    assert.deepEqual(snapshot(root), before, "--dry-run writes no notice");
    assert.equal(existsSync(join(root, "release/NOTICE.json")), false);
    const refusedSign = assemble(root, ["--sign"], { BIO_RELEASE_SEED: envelope() });
    refused(refusedSign, "NOT_SIGNING_ENVIRONMENT");
    assert.match(refusedSign.stderr, /--notice-sig <file>/, "the refusal names how a notice signed elsewhere completes the release");
  } finally { rm(root); }
});


/* ----------------------------------------------------------------- R36, R37 */

const containersCmd = (root, args) => run(root, ".", ["bio-plane/scripts/bundles.mjs", ...args]);
const readText = (root, rel) => readFileSync(join(root, rel), "utf8");
const NEW = "sha256:" + "7a".repeat(32);

test("R37: the release assembly refuses CONTAINER_IMAGE_STALE, naming the member and the class, for a container member whose code changed under an unchanged digest, and for one that records nothing its digest was built from, before anything is written; control: the same member with its digest rewritten by R36 is assembled", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    addScannerMember(root, "scanner");
    await buildAll(root);
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "control: every image is current");

    /* the code of one class changes; its digest does not */
    writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 'changed';\n");
    const before = snapshot(root);
    const stale = assemble(root, ["--dry-run"]);
    refused(stale, "CONTAINER_IMAGE_STALE");
    assert.match(stale.stderr, /runner is a container member/);
    assert.match(stale.stderr, /runner: .*class Runner/);
    assert.doesNotMatch(stale.stderr, /scanner/, "only the member that is stale is named");
    assert.deepEqual(snapshot(root), before, "nothing written");
    const real = assemble(root, ["--emit-payload", join(root, "p.txt")]);
    refused(real, "CONTAINER_IMAGE_STALE");
    assert.equal(existsSync(join(root, "p.txt")), false);

    /* R36's step records the digest the build produced; the same member is assembled */
    const rec = containersCmd(root, ["--record-image", "runner", "Runner", NEW]);
    assert.equal(rec.status, 0, rec.stdout + rec.stderr);
    const ok = assemble(root, ["--dry-run"]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);

    /* a class of a two-class member is named; the other class is not */
    writeFileSync(join(root, "scanner/Dockerfile.safeviewrenderer"), "FROM docker.io/library/node@sha256:" + "5b".repeat(32) + "\nCOPY package.json ./\n");
    const two = assemble(root, ["--dry-run"]);
    refused(two, "CONTAINER_IMAGE_STALE");
    assert.match(two.stderr, /class SafeViewRenderer/);
    assert.doesNotMatch(two.stderr, /class FileScanner/);
  } finally { rm(root); }
});

test("R37: a container member whose marker records no source its digest was built from is refused CONTAINER_IMAGE_STALE, as a digest nothing can prove current", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner", { sealed: false });
    await buildAll(root);
    const r = assemble(root, ["--dry-run"]);
    refused(r, "CONTAINER_IMAGE_STALE");
    assert.match(r.stderr, /records no `source_sha256`/);
  } finally { rm(root); }
});

test("R36: bundles.mjs --containers lists the classes whose image the code has outrun and exits 1, writing nothing; --record-image writes the digest the build produced into the marker and the wrangler.jsonc container block, both agreeing, after which the list is empty and exit 0", async () => {
  const root = await makeRepo({ build: false });
  try {
    addScannerMember(root, "scanner");
    await buildAll(root);
    const clean = containersCmd(root, ["--containers"]);
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /containers: 2 of 2 image\(s\) provably built/);

    writeFileSync(join(root, "scanner/container/app.mjs"), "export const app = 'new';\n");
    const before = snapshot(root);
    const listed = containersCmd(root, ["--containers"]);
    assert.equal(listed.status, 1);
    assert.match(listed.stdout, /^STALE scanner FileScanner /m);
    assert.match(listed.stdout, /^STALE scanner SafeViewRenderer /m);
    assert.deepEqual(snapshot(root), before, "listing writes nothing");

    const rec = containersCmd(root, ["--record-image", "scanner", "FileScanner", DIGEST_A.replace(/c3/g, "e5")]);
    assert.equal(rec.status, 0, rec.stdout + rec.stderr);
    const rec2 = containersCmd(root, ["--record-image", "scanner", "SafeViewRenderer", NEW]);
    assert.equal(rec2.status, 0, rec2.stdout + rec2.stderr);
    const marker = readJson(join(root, "scanner/fleet-member.json"));
    assert.equal(marker.containers[0].image.digest, DIGEST_A.replace(/c3/g, "e5"));
    assert.equal(marker.containers[1].image.digest, NEW);
    const cfg = parseJsonc(readText(root, "scanner/wrangler.jsonc"));
    assert.equal(cfg.containers[0].image, `docker.io/civicos/file-scanner@${DIGEST_A.replace(/c3/g, "e5")}`, "its own repository, the digest the build produced");
    assert.equal(cfg.containers[1].image, `docker.io/civicos/safe-view@${NEW}`);
    assert.equal(containersCmd(root, ["--containers"]).status, 0);
  } finally { rm(root); }
});

test("R36: a change to a non-container member's code writes no digest: bundles.mjs --record-image refuses a worker member, an unknown member, a class it does not state and a digest that is not sha256:<64 hex>, leaving every file as it was; --containers is silent about workers", async () => {
  const root = await makeRepo({ build: false });
  try {
    addContainerMember(root, "runner");
    await buildAll(root);
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), "export const word = 'changed';\n");
    const before = snapshot(root);
    for (const [args, code] of [
      [["alpha-worker", "Runner", NEW], "CONTAINER_UNDESCRIBED"], [["no-such", "Runner", NEW], "CONTAINER_UNDESCRIBED"],
      [["runner", "Nope", NEW], "CONTAINER_UNDESCRIBED"], [["runner", "Runner", "sha256:short"], "CONTAINER_DIGEST_INVALID"],
      [["runner", "Runner"], "CONTAINER_DIGEST_INVALID"]]) {
      const r = containersCmd(root, ["--record-image", ...args]);
      refused(r, code);
      assert.equal(r.status, 1);
    }
    assert.deepEqual(snapshot(root), before);
    const listed = containersCmd(root, ["--containers"]);
    assert.equal(listed.status, 0, "the changed worker is no container image's concern");
    assert.doesNotMatch(listed.stdout, /alpha-worker/);
  } finally { rm(root); }
});

/* --------------------------------------------------------------------- R39 */

test("R39: the release assembly refuses BINDING_NOT_EXPORTED, naming the member, the binding and the class, for a Durable Object binding to a class the other member's bundle lacks, before anything is written; control: with the class exported it assembles", async () => {
  const root = await makeRepo({ build: false });
  try {
    editConfig(root, "alpha-worker", (c) => { c.durable_objects = { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "beta-worker" }] }; });
    await buildAll(root);
    const before = snapshot(root);
    const dry = assemble(root, ["--dry-run"]);
    refused(dry, "BINDING_NOT_EXPORTED");
    assert.match(dry.stderr, /alpha-worker/);
    assert.match(dry.stderr, /REMOTE/);
    assert.match(dry.stderr, /RemoteSession/);
    assert.match(dry.stderr, /beta-worker/);
    assert.deepEqual(snapshot(root), before, "nothing written");
    const real = assemble(root, ["--emit-payload", join(root, "p.txt")]);
    refused(real, "BINDING_NOT_EXPORTED");
    assert.equal(existsSync(join(root, "p.txt")), false, "no payload emitted either");

    /* the class exported by the bundle that would ship: the same release assembles */
    writeFileSync(join(root, "beta-worker/src/index.mjs"), readFileSync(join(root, "beta-worker/src/index.mjs"), "utf8") + "export class RemoteSession {}\n");
    await buildAll(root);
    const ok = assemble(root, ["--dry-run"]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);

    /* exported by the SOURCE but not the bundle (a different name from the one bound) is still refused */
    editConfig(root, "alpha-worker", (c) => { c.durable_objects.bindings[0].class_name = "RemoteSessions"; });
    refused(assemble(root, ["--dry-run"]), "BINDING_NOT_EXPORTED");
  } finally { rm(root); }
});

test("R39: a service naming no member of the release, a container class and a migration class that no bundle exports are each refused BINDING_NOT_EXPORTED, naming the member and the class; a service bound to the plane's templated name and an own Durable Object the bundle exports pass", async () => {
  const root = await makeRepo({ build: false });
  try {
    /* passes: the phantom plane, another member, an own object the plane exports */
    editConfig(root, "alpha-worker", (c) => { c.services = [{ binding: "PLANE", service: "bio-plane" }, { binding: "BETA", service: "beta-worker" }]; });
    await buildAll(root);
    assert.equal(assemble(root, ["--dry-run"]).status, 0);

    editConfig(root, "alpha-worker", (c) => { c.services = [{ binding: "GHOST", service: "ghost-worker" }]; });
    const svc = assemble(root, ["--dry-run"]);
    refused(svc, "BINDING_NOT_EXPORTED");
    assert.match(svc.stderr, /alpha-worker/);
    assert.match(svc.stderr, /GHOST/);
    assert.match(svc.stderr, /ghost-worker/);
    editConfig(root, "alpha-worker", (c) => { c.services = [{ binding: "PLANE", service: "bio-plane" }]; });

    editConfig(root, "alpha-worker", (c) => { c.migrations = [{ tag: "v1", new_sqlite_classes: ["Unbuilt"] }]; });
    const mig = assemble(root, ["--dry-run"]);
    refused(mig, "BINDING_NOT_EXPORTED");
    assert.match(mig.stderr, /alpha-worker/);
    assert.match(mig.stderr, /Unbuilt/);
    editConfig(root, "alpha-worker", (c) => { delete c.migrations; });

    addContainerMember(root, "runner");
    await buildAll(root);
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "control: the container member's class is exported");
    editConfig(root, "runner", (c) => { c.containers[0].class_name = "Missing"; });
    const cont = assemble(root, ["--dry-run"]);
    refused(cont, "BINDING_NOT_EXPORTED");
    assert.match(cont.stderr, /runner/);
    assert.match(cont.stderr, /Missing/);
    assert.doesNotMatch(cont.stderr, /alpha-worker/, "only the member that is incoherent is named");
  } finally { rm(root); }
});

/* --------------------------------------------------------------------- R40 */

const TEST_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
const OTHER_ACCOUNT = "ffffffffffffffffffffffffffffffff";
const COPY = "trial-copy";
const OLD_BYTES = "// what the account holds now";
/** A fixture fleet pinned to the test account, with no `release/` signature anywhere: the branch's built artifacts only. */
const testFleet = () => makeRepo({ members: { "alpha-worker": { account: TEST_ACCOUNT }, "beta-worker": { account: TEST_ACCOUNT } },
  plane: { config: { services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "alpha-worker" }] } } });
const MARK = { CIVICSMITH_TEST_INSTANCE: COPY };
// fixtures-own: platform the Cloudflare API's own answers to the test-instance deploy's account calls, a scripted-network double of the platform; no module answers for them
const testStub = (extra = {}) => ({ subdomain: "sub", put: "accept", scripts: { [COPY]: { body: OLD_BYTES }, "alpha-worker": { body: OLD_BYTES, settings: {} } },
  serving: { "alpha-worker": JSON.stringify({ version: VERSION }), "beta-worker": JSON.stringify({ version: VERSION }) }, ...extra });
const testFleetDeploy = (root, member, { env = { CF_TOKEN: "t", ...MARK }, flags = ["--test-instance", "--dry-run"], instance = COPY, stub = testStub() } = {}) =>
  run(root, ".", ["bio-plane/scripts/deploy-fleet.mjs", member, "--instance", instance, ...flags], { env, stub });
const testPlaneDeploy = (root, { env = { CF_TOKEN: "t", CF_ACCT: TEST_ACCOUNT, ...MARK }, flags = ["--test-instance", "--dry-run"], slug = COPY, stub = testStub() } = {}) =>
  run(root, "bio-plane", ["scripts/deploy.mjs", slug, VERSION, ASSET, ...flags], { env, stub });

test("R40: a marked test copy and the right account run every member in order and then the plane in the dry-run arm, from built artifacts with no release/ signature, each step with its log line and its rollback target and nothing deployed", async () => {
  const root = await testFleet();
  try {
    assert.equal(existsSync(join(root, "release/RELEASE.json")), false, "no signed release exists in this fixture");
    const names = discoverMembers(root).map((m) => m.name);
    assert.deepEqual(names, ["alpha-worker", "beta-worker"], "the order the module lists the members in (R1)");
    const before = snapshot(root);
    for (const member of names) {
      const r = testFleetDeploy(root, member);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, new RegExp(`^test deploy: ${member} to ${COPY} from dist/${member}\\.bundled\\.mjs sha256 [0-9a-f]{64}`, "m"));
      assert.match(r.stdout, /no release\/ signature is read/);
      assert.deepEqual(r.wrangler, [], "dry-run deploys nothing");
      assert.deepEqual(r.calls.filter((c) => c.method !== "GET"), [], "and sends nothing but reads");
    }
    /* each member's rollback target is what the account holds under its name now */
    const alpha = testFleetDeploy(root, "alpha-worker");
    assert.match(alpha.stdout, new RegExp(`^rollback : alpha-worker was ${hex(OLD_BYTES).slice(0, 16)}`, "m"));
    const beta = testFleetDeploy(root, "beta-worker");
    assert.match(beta.stdout, /^rollback : beta-worker is not deployed in 20b533579290b9b93168345edd3b7f72/m);
    const plane = testPlaneDeploy(root);
    assert.equal(plane.status, 0, plane.stdout + plane.stderr);
    assert.match(plane.stdout, new RegExp(`^test deploy: ${COPY} from ${ASSET} sha256 ${hex(readFileSync(join(root, "bio-plane", ASSET)))}`, "m"));
    assert.match(plane.stdout, new RegExp(`^rollback : ${COPY} was ${hex(OLD_BYTES).slice(0, 16)}`, "m"));
    assert.match(plane.stdout, /--dry-run: nothing was deployed/);
    assert.deepEqual(plane.calls.filter((c) => c.method === "PUT"), [], "the plane's dry run uploads nothing");
    assert.deepEqual(snapshot(root), before, "and writes nothing");

    /* the same steps for real: the built artifacts go out unsigned, verified by the bytes read back */
    const realFleet = testFleetDeploy(root, "alpha-worker", { flags: ["--test-instance"] });
    assert.equal(realFleet.status, 0, realFleet.stdout + realFleet.stderr);
    assert.equal(realFleet.wrangler.length, 1);
    assert.match(realFleet.stdout, /^rollback : alpha-worker was /m);
    const realPlane = testPlaneDeploy(root, { flags: ["--test-instance"] });
    assert.equal(realPlane.status, 0, realPlane.stdout + realPlane.stderr);
    assert.equal(puts(realPlane).length, 1);
    assert.match(realPlane.stdout, /verified: deployed bytes are hash-identical to the signed asset/);
  } finally { rm(root); }
});

test("R40: a copy the environment does not mark as a test instance, and an account other than the test account, are each refused naming it before any request is made, by deploy-fleet.mjs and by deploy.mjs", async () => {
  const root = await testFleet();
  try {
    const attempts = [
      [() => testFleetDeploy(root, "alpha-worker", { env: { CF_TOKEN: "t" } }), "NOT_A_TEST_INSTANCE", COPY],
      [() => testFleetDeploy(root, "alpha-worker", { env: { CF_TOKEN: "t", CIVICSMITH_TEST_INSTANCE: "another-copy" } }), "NOT_A_TEST_INSTANCE", COPY],
      [() => testPlaneDeploy(root, { env: { CF_TOKEN: "t", CF_ACCT: TEST_ACCOUNT } }), "NOT_A_TEST_INSTANCE", COPY],
      [() => testPlaneDeploy(root, { env: { CF_TOKEN: "t", CF_ACCT: TEST_ACCOUNT, CIVICSMITH_TEST_INSTANCE: "another-copy" } }), "NOT_A_TEST_INSTANCE", COPY],
      [() => testPlaneDeploy(root, { env: { CF_TOKEN: "t", CF_ACCT: OTHER_ACCOUNT, ...MARK } }), "WRONG_ACCOUNT", OTHER_ACCOUNT],
    ];
    for (const [go, code, named] of attempts) {
      const r = go();
      refused(r, code);
      assert.ok(r.stderr.includes(named), `${code} names ${named}:\n${r.stderr}`);
      assert.deepEqual(r.calls, [], `${code}: no request was made`);
      assert.deepEqual(r.wrangler, []);
    }
    /* a member whose configuration pins another account */
    addMember(root, "gamma-worker", { account: OTHER_ACCOUNT });
    const wrong = testFleetDeploy(root, "gamma-worker");
    refused(wrong, "WRONG_ACCOUNT");
    assert.ok(wrong.stderr.includes(OTHER_ACCOUNT));
    assert.deepEqual(wrong.calls, []);
    assert.deepEqual(wrong.wrangler, []);
    /* the order of the checks: the mark first, then the account */
    const both = testPlaneDeploy(root, { env: { CF_TOKEN: "t", CF_ACCT: OTHER_ACCOUNT } });
    refused(both, "NOT_A_TEST_INSTANCE");

    /* control: without the flag the signed-release path is unchanged: no mark is asked for and any account is served */
    const plain = testPlaneDeploy(root, { env: { CF_TOKEN: "t", CF_ACCT: OTHER_ACCOUNT }, flags: [], stub: testStub() });
    assert.equal(plain.status, 0, plain.stdout + plain.stderr);
    assert.doesNotMatch(plain.stdout, /test deploy:|rollback :/);
    const plainFleet = testFleetDeploy(root, "gamma-worker", { env: { CF_TOKEN: "t" }, flags: ["--dry-run"] });
    assert.equal(plainFleet.status, 0, plainFleet.stdout + plainFleet.stderr);
    assert.doesNotMatch(plainFleet.stdout, /test deploy:|rollback :/);
  } finally { rm(root); }
});
