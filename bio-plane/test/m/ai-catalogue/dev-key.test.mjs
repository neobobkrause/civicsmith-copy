/* ai-catalogue: a development deployment's own catalogue key (dev-key.mjs) and the keys a build trusts (catalogueKeysFor,
 * signatures R59). The seed is the one this release carries (R39); the copy is the fixture's real one (keys: null, so it
 * takes signatures' CATALOGUE_KEYS as the plane does). Wrangler is never run: the command is handed a recorder, or the
 * stand-in fake-wrangler.mjs for the spawn path. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { CATALOGUE_KEYS, NS_AI_CATALOGUE, aiCatalogueStatement, verifyAiCatalogue } from "../../../src/sshsig.mjs";
import * as catalogue from "../../../src/ai-catalogue/index.mjs";
import { newKey, sign, world, AT } from "./fixture.mjs";

const { RELEASE_SEED, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, catalogueKeysFor, isDevelopmentKey } = catalogue;
/* The names are written out here, so the file loads without the change and each test, not the file, fails. */
const DEVELOPMENT_KEY_VAR = "AI_CATALOGUE_DEVELOPMENT_KEY";
const DEVELOPMENT_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
const DEVELOPMENT_SIGNING_SECRET = "AI_CATALOGUE_DEVELOPMENT_SIGNING_KEY";
/* dev-key.mjs is loaded inside each test; without it each test fails on this assertion (the load error is not passed on) */
async function devKey() {
  let mod = null;
  try { mod = await import("../../../src/ai-catalogue/dev-key.mjs"); } catch { mod = null; }
  assert.ok(mod && typeof mod.main === "function", "the development catalogue key command (dev-key.mjs) is not there");
  return mod;
}

const ENV = { CIVICSMITH_TEST_INSTANCE: "p3dev-t1", CF_TOKEN: "token-for-test", CF_ACCT: DEVELOPMENT_ACCOUNT };
const BOB = CATALOGUE_KEYS.filter((l) => !isDevelopmentKey(l));
const FAKE = fileURLToPath(new URL("./fake-wrangler.mjs", import.meta.url));

/** Runs the command with a recorder for wrangler; answers {code, out, calls, sets, vars}. `listCode` is the lookup's
 *  exit (0: the Worker is there), `bulkCode` the secrets'. */
async function run(argv, env = ENV, { listCode = 0, bulkCode = 0 } = {}) {
  const { main } = await devKey();
  const lines = [], calls = [];
  const code = await main(argv, env, { log: (l) => lines.push(String(l)), err: (l) => lines.push(String(l)),
    wrangler: async (a) => { calls.push(a);
      return { code: a.args[0] === "deployments" ? listCode : bulkCode, stdout: "ok\n", stderr: "" }; } });
  const sets = calls.filter((c) => c.args[0] === "secret");
  return { code, out: lines.join("\n"), calls, sets, vars: sets[0] ? JSON.parse(sets[0].stdin) : null };
}
const bulkOf = (a) => (a.args[0] === "secret" ? JSON.parse(a.stdin) : null);
const publicOnly = (vars) => Object.fromEntries(Object.entries(vars).filter(([k]) => k !== DEVELOPMENT_SIGNING_SECRET));
const releaseEnv = (vars) => Object.fromEntries(Object.entries(publicOnly(vars)).filter(([k]) => k !== DEVELOPMENT_VAR));

test("dev-key: a seed signed by a generated development key verifies on a development deployment, and the copy is current from it", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const dk = await devKey();
  assert.deepEqual([dk.DEVELOPMENT_ACCOUNT, dk.DEVELOPMENT_SIGNING_SECRET, catalogue.DEVELOPMENT_KEY_VAR],
    [DEVELOPMENT_ACCOUNT, DEVELOPMENT_SIGNING_SECRET, DEVELOPMENT_KEY_VAR]);
  const r = await run(["p3dev-t1"]);
  assert.equal(r.code, 0, r.out);
  /* the slug is the plane Worker's own name: it is looked up, then its secrets are set, both on p3dev-t1 */
  assert.deepEqual(r.calls.map((c) => c.args), [["deployments", "list", "--name", "p3dev-t1"],
    ["secret", "bulk", "--name", "p3dev-t1"]]);
  assert.equal(r.calls[0].stdin ?? "", "");
  for (const c of r.calls) assert.equal(c.account, DEVELOPMENT_ACCOUNT);
  assert.deepEqual(Object.keys(r.vars).sort(),
    [DEVELOPMENT_VAR, DEVELOPMENT_KEY_VAR, SEED_SIGNATURE_VAR, DEVELOPMENT_SIGNING_SECRET].sort());
  assert.equal(r.vars[DEVELOPMENT_VAR], "1");
  assert.ok(isDevelopmentKey(r.vars[DEVELOPMENT_KEY_VAR]));
  assert.equal(CATALOGUE_KEYS.includes(r.vars[DEVELOPMENT_KEY_VAR]), false);
  const { cat } = await world({ keys: null, env: publicOnly(r.vars) });
  assert.equal(cat.seedAtStart.outcome, "found");
  const s = cat.catalogueState({ at: AT });
  assert.deepEqual([s.state, s.source], ["current", "seed"]);
});

test("dev-key: the same signed seed is refused UNKNOWN_KEY on a release environment, the copy unavailable", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const r = await run(["p3dev-t1"]);
  for (const env of [releaseEnv(r.vars), { [SEED_SIGNATURE_VAR]: r.vars[SEED_SIGNATURE_VAR] },
    { ...releaseEnv(r.vars), [DEVELOPMENT_VAR]: "true" }]) {
    const { cat } = await world({ keys: null, env });
    assert.equal(cat.seedAtStart.code, "UNKNOWN_KEY", JSON.stringify(Object.keys(env)));
    assert.equal(cat.catalogueState({ at: AT }).state, "unavailable");
    assert.equal(cat.entriesFor({ part: "ask", at: AT }).code, "CATALOGUE_UNAVAILABLE");
  }
  assert.deepEqual(await verifyAiCatalogue(RELEASE_SEED.statement, r.vars[SEED_SIGNATURE_VAR], 0),
    await verifyAiCatalogue(RELEASE_SEED.statement, r.vars[SEED_SIGNATURE_VAR], 0, BOB));
  assert.equal((await verifyAiCatalogue(RELEASE_SEED.statement, r.vars[SEED_SIGNATURE_VAR], 0)).ok, false);
});

test("dev-key: the private half goes to wrangler's stdin only and appears in no output, the run's or wrangler's", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const lines = [];
  let seen = null;
  const code = await main(["p3dev-t1"], ENV, { log: (l) => lines.push(String(l)), err: (l) => lines.push(String(l)),
    wrangler: async (a) => { const v = bulkOf(a); if (!v) return { code: 0, stdout: "", stderr: "" };
      seen = v; return { code: 0, stdout: `echo ${a.stdin}\n`, stderr: `secret ${v[DEVELOPMENT_SIGNING_SECRET]}\n` }; } });
  assert.equal(code, 0);
  const secret = seen[DEVELOPMENT_SIGNING_SECRET];
  assert.ok(secret.length > 40);
  /* it is a real ed25519 private key: it signs, and the public line verifies what it signs */
  const priv = await webcrypto.subtle.importKey("pkcs8", Buffer.from(secret, "base64"), { name: "Ed25519" }, false, ["sign"]);
  const raw = Buffer.from(seen[DEVELOPMENT_KEY_VAR].split(" ")[1], "base64").subarray(19);
  const sig = await sign({ priv, raw }, NS_AI_CATALOGUE, aiCatalogueStatement(RELEASE_SEED.statement));
  assert.equal((await verifyAiCatalogue(RELEASE_SEED.statement, sig, 0, [seen[DEVELOPMENT_KEY_VAR]])).ok, true);
  const out = lines.join("\n");
  assert.equal(out.includes(secret), false);
  for (let i = 0; i + 24 <= secret.length; i += 8) assert.equal(out.includes(secret.slice(i, i + 24)), false);
  assert.match(out, new RegExp(DEVELOPMENT_SIGNING_SECRET));
});

test("dev-key: through the spawn path, a wrangler that echoes its stdin still shows no private key; its disk log is off", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const lines = [];
  let seen = null;
  const called = [];
  const code = await main(["p3dev-t1"], ENV, { log: (l) => lines.push(String(l)), err: (l) => lines.push(String(l)),
    wrangler: (a) => { called.push(a.args); seen = bulkOf(a) ?? seen; return runWrangler({ ...a, bin: FAKE }); } });
  assert.equal(code, 0);
  assert.deepEqual(called, [["deployments", "list", "--name", "p3dev-t1"], ["secret", "bulk", "--name", "p3dev-t1"]]);
  const out = lines.join("\n");
  assert.match(out, /args secret bulk --name p3dev-t1/);
  assert.match(out, new RegExp(`WRANGLER_WRITE_LOGS=false account=${DEVELOPMENT_ACCOUNT}`));
  assert.match(out, /\[masked\]/);
  const secret = seen[DEVELOPMENT_SIGNING_SECRET];
  for (let i = 0; i + 24 <= secret.length; i += 8) assert.equal(out.includes(secret.slice(i, i + 24)), false);
});

test("dev-key: a dry run looks the Worker up, sets nothing and prints no key material", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const r = await run(["p3dev-t1", "--dry-run"]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.calls.map((c) => c.args), [["deployments", "list", "--name", "p3dev-t1"]]);
  assert.equal(r.sets.length, 0);
  assert.match(r.out, /dry run/);
  assert.doesNotMatch(r.out.split(DEVELOPMENT_ACCOUNT).join(""), /[A-Za-z0-9+/]{32,}/);
});

test("dev-key: refuses any account but the development one, any name that is not p3dev-, and an unmarked copy; nothing is sent", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  for (const [argv, env, code] of [
    [["p3dev-t1"], { ...ENV, CF_ACCT: "0123456789abcdef0123456789abcdef" }, "WRONG_ACCOUNT"],
    [["p3dev-t1"], { ...ENV, CF_ACCT: undefined }, "WRONG_ACCOUNT"],
    [["t1"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "t1" }, "NOT_A_DEVELOPMENT_NAME"],
    [["p3dev-"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "p3dev-" }, "NOT_A_DEVELOPMENT_NAME"],
    [["biosmoke8"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "biosmoke8" }, "NOT_A_DEVELOPMENT_NAME"],
    [["../x"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "../x" }, "NOT_A_DEVELOPMENT_NAME"],
    [["T1"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "T1" }, "NOT_A_DEVELOPMENT_NAME"],
    [["t1 x"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "t1 x" }, "NOT_A_DEVELOPMENT_NAME"],
    [["p3dev-t1"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "p3dev-t2" }, "NOT_A_TEST_INSTANCE"],
  ]) {
    const r = await run(argv, env);
    assert.equal(r.code, 1, `${argv} ${code}`);
    assert.match(r.out, new RegExp(`REFUSED \\[${code}\\]`));
    assert.equal(r.calls.length, 0);
  }
  const failed = await run(["p3dev-t1"], ENV, { bulkCode: 1 });
  assert.equal(failed.code, 1);
  assert.match(failed.out, /REFUSED \[SECRETS_NOT_SET\]/);
});

test("dev-key: a Worker that is not deployed is refused NO_SUCH_WORKER and no secret is sent (a secret never creates a Worker)", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const r = await run(["p3dev-t1"], ENV, { listCode: 1 });
  assert.equal(r.code, 1);
  assert.match(r.out, /REFUSED \[NO_SUCH_WORKER\]/);
  assert.deepEqual(r.calls.map((c) => c.args), [["deployments", "list", "--name", "p3dev-t1"]]);
  assert.equal(r.sets.length, 0);
  /* through the spawn path: the stand-in answers a missing Worker as wrangler does */
  const lines = [], args = [];
  const code = await main(["p3dev-missing"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "p3dev-missing" },
    { log: (l) => lines.push(String(l)), err: (l) => lines.push(String(l)),
      wrangler: (a) => { args.push(a.args); return runWrangler({ ...a, bin: FAKE }); } });
  assert.equal(code, 1);
  assert.deepEqual(args, [["deployments", "list", "--name", "p3dev-missing"]]);
});

test("catalogueKeysFor: a caller passing no list trusts Bob's lines alone, in any environment", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const { line } = await makeDevelopmentKey();
  const dev = { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: line };
  assert.deepEqual([...catalogueKeysFor(undefined, dev)], BOB);
  assert.deepEqual([...catalogueKeysFor(undefined, {})], BOB);
  assert.deepEqual([...catalogueKeysFor(null)], BOB);
});

test("catalogueKeysFor: the deployment's line is added only in a development build, and only a well-formed marked line", async () => {
  const { main, makeDevelopmentKey, runWrangler } = await devKey();
  const { line } = await makeDevelopmentKey();
  assert.deepEqual([...catalogueKeysFor([...CATALOGUE_KEYS], { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: line })],
    [...CATALOGUE_KEYS, line]);
  assert.deepEqual([...catalogueKeysFor([...CATALOGUE_KEYS], { [DEVELOPMENT_KEY_VAR]: line })], BOB);
  const plain = (await newKey()).line;                                 /* "throwaway": not marked development */
  const bad = [plain, `${line}\nssh-ed25519 AAAA x-development`, "ssh-rsa AAAAB3Nza x-development", BOB[0], 7, null];
  for (const v of bad)
    assert.deepEqual([...catalogueKeysFor([...CATALOGUE_KEYS], { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: v })],
      [...CATALOGUE_KEYS], String(v));
});

/* F1: `deploy dev`'s dry run accepts a step only if it exits 0 and prints this exact line alone on a line. */
const GUARD = "p3dev guard: passed";
const guardLines = (out) => out.split("\n").filter((l) => l.trim() === GUARD);

test("dev-key F1: prints 'p3dev guard: passed' alone on its own line once every guard check passes, in a dry run and a real run", async () => {
  await devKey();
  for (const argv of [["p3dev-t1", "--dry-run"], ["p3dev-t1"]]) {
    const r = await run(argv);
    assert.equal(r.code, 0, r.out);
    const lines = r.out.split("\n");
    assert.equal(lines.filter((l) => l === GUARD).length, 1, `${argv.join(" ")}:\n${r.out}`);
    /* printed after the Worker lookup and before any secret is sent */
    assert.equal(r.calls[0].args[0], "deployments");
  }
});

test("dev-key F1: never prints the guard line when a guard check fails, in a dry run or a real run", async () => {
  await devKey();
  const cases = [
    [["p3dev-t1"], { ...ENV, CF_ACCT: "0123456789abcdef0123456789abcdef" }, {}, "WRONG_ACCOUNT"],
    [["p3dev-t1"], { ...ENV, CF_ACCT: undefined }, {}, "WRONG_ACCOUNT"],
    [["biosmoke8"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "biosmoke8" }, {}, "NOT_A_DEVELOPMENT_NAME"],
    [["t1"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "t1" }, {}, "NOT_A_DEVELOPMENT_NAME"],
    [["p3dev-t1"], { ...ENV, CIVICSMITH_TEST_INSTANCE: "p3dev-t2" }, {}, "NOT_A_TEST_INSTANCE"],
    [["p3dev-t1"], { ...ENV, CIVICSMITH_TEST_INSTANCE: undefined }, {}, "NOT_A_TEST_INSTANCE"],
    [["p3dev-t1"], { ...ENV, CF_TOKEN: undefined }, {}, "NO_TOKEN"],
    [["p3dev-t1"], ENV, { listCode: 1 }, "NO_SUCH_WORKER"],
  ];
  for (const [argv, env, codes, code] of cases) for (const mode of [[], ["--dry-run"]]) {
    const r = await run([...argv, ...mode], env, codes);
    const label = `${[...argv, ...mode].join(" ")} ${code}`;
    assert.equal(r.code, 1, label);
    assert.match(r.out, new RegExp(`REFUSED \\[${code}\\]`), label);
    assert.deepEqual(guardLines(r.out), [], label);
    assert.equal(r.sets.length, 0, label);
  }
});
