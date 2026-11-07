#!/usr/bin/env node
/* ai-catalogue — a development deployment's own catalogue key, made and used at its deploy.
 *
 *   CIVICSMITH_TEST_INSTANCE=<slug> CF_TOKEN=... CF_ACCT=20b533579290b9b93168345edd3b7f72 \
 *     node bio-plane/src/ai-catalogue/dev-key.mjs <slug> [--dry-run]
 *
 * Run by the process's `deploy dev` after the plane is deployed. `<slug>` is the plane Worker's own name, as
 * `scripts/deploy.mjs <slug>` names it (`p3dev-t1`), and must begin `p3dev-`. Before anything is set the Worker is
 * looked up (`wrangler deployments list --name <slug>`); a Worker that is not there is refused, so the secrets are
 * never what creates one. It:
 *  1. generates an ed25519 key pair in memory, its public line commented `bio-ai-catalogue` + `DEVELOPMENT_KEY_MARK`;
 *  2. signs the development seed (`DEVELOPMENT_SEED`, F2), the seed a copy takes where `DEVELOPMENT_VAR` is "1", in
 *     `NS_AI_CATALOGUE` with it, and checks that the
 *     signature verifies against the keys a development build trusts and is refused by a release build's;
 *  3. hands the plane, as its own variables, `DEVELOPMENT_VAR` = "1", the public line (`DEVELOPMENT_KEY_VAR`) and the
 *     armored signature (`SEED_SIGNATURE_VAR`), and holds the private half (PKCS#8) only as the Worker secret
 *     `DEVELOPMENT_SIGNING_SECRET`, all four in one `wrangler secret bulk` read from stdin.
 * The private half is never printed, never written to disk or a log: it lives in this process's memory and wrangler's
 * stdin only, wrangler's own log file is switched off, and anything wrangler prints is passed on with every value this
 * run made masked. With `--dry-run` it does steps 1 and 2 and names what it would set; nothing is sent.
 *
 * It refuses any account but the product's development account and any Worker name that does not begin `p3dev-`
 * (the project's standing approvals); Bob's offline catalogue keys are never used, and this file never holds them.
 * The four values are stored as Worker secrets, not plain_text bindings: a secret is set on a deployed script without
 * a re-upload, and `scripts/deploy.mjs` keeps every `secret_text` binding at the next upload (its keep_bindings). */
import { webcrypto } from "node:crypto";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { CATALOGUE_KEYS, NS_AI_CATALOGUE, aiCatalogueStatement, verifyAiCatalogue } from "../sshsig.mjs";
import { DEVELOPMENT_SEED, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_VAR, DEVELOPMENT_KEY_MARK,
  catalogueKeysFor } from "./seed.mjs";

/** The one account a development catalogue key is set in. */
export const DEVELOPMENT_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
/** The fixed name of the Worker secret that holds the development catalogue key's private half (PKCS#8, base64). */
export const DEVELOPMENT_SIGNING_SECRET = "AI_CATALOGUE_DEVELOPMENT_SIGNING_KEY";
/** The comment of a development catalogue key's public line. */
export const DEVELOPMENT_KEY_COMMENT = `bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`;

/** The line printed alone, once the p3dev- name, the account, the test-instance mark and the Worker's presence have all
 *  been checked and passed, in a dry run and a real one alike; never when any of them fails (F1). */
export const GUARD_LINE = "p3dev guard: passed";

const WORKER_RE = /^p3dev-[a-z0-9][a-z0-9-]*$/;

/* ------------------------------------------------------------------ an SSHSIG signer (PROTOCOL.sshsig), in memory */

const te = new TextEncoder();
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const join = (...parts) => {
  const o = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0; for (const p of parts) { o.set(p, i); i += p.length; }
  return o;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? te.encode(v) : v; return join(u32(b.length), b); };
const armor = (blob) => `-----BEGIN SSH SIGNATURE-----\n${b64(blob).replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;

async function sshsig(privateKey, raw, namespace, message) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", message));
  const signed = join(te.encode("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  const sig = new Uint8Array(await webcrypto.subtle.sign("Ed25519", privateKey, signed));
  return armor(join(te.encode("SSHSIG"), u32(1), sstr(join(sstr("ssh-ed25519"), sstr(raw))), sstr(namespace),
    sstr(new Uint8Array(0)), sstr("sha512"), sstr(join(sstr("ssh-ed25519"), sstr(sig)))));
}

/* ------------------------------------------------------------------ the key, the signature, the check */

/** A fresh development catalogue key and the seed signed with it: `{line, armored, secret}`, `secret` the private half
 *  as base64 PKCS#8. Nothing leaves memory. `seed` defaults to the development seed (F2). */
export async function makeDevelopmentKey({ seed = DEVELOPMENT_SEED } = {}) {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  const line = `ssh-ed25519 ${b64(join(sstr("ssh-ed25519"), sstr(raw)))} ${DEVELOPMENT_KEY_COMMENT}`;
  const armored = await sshsig(kp.privateKey, raw, NS_AI_CATALOGUE, aiCatalogueStatement(seed.statement));
  const secret = b64(new Uint8Array(await webcrypto.subtle.exportKey("pkcs8", kp.privateKey)));
  return { line, armored, secret };
}

/** The plane's variables for a made key: the three public ones and the secret, by name. */
export function variablesFor({ line, armored, secret }) {
  return { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: line, [SEED_SIGNATURE_VAR]: armored,
    [DEVELOPMENT_SIGNING_SECRET]: secret };
}

/** The signed seed verifies with the keys a development build trusts and is refused by a release build's. */
async function selfCheck(vars, seed) {
  const dev = await verifyAiCatalogue(seed.statement, vars[SEED_SIGNATURE_VAR], 0, catalogueKeysFor([...CATALOGUE_KEYS], vars));
  const release = await verifyAiCatalogue(seed.statement, vars[SEED_SIGNATURE_VAR], 0,
    catalogueKeysFor([...CATALOGUE_KEYS], { [DEVELOPMENT_KEY_VAR]: vars[DEVELOPMENT_KEY_VAR] }));
  return { dev: !!(dev && dev.ok), release: !!(release && release.ok) };
}

/* ------------------------------------------------------------------ wrangler, through stdin */

/* This file's own path, from the command line it runs by (this module names nothing of its own location otherwise). */
const SELF = process.argv[1] ? resolve(process.argv[1]) : "";
const IS_CLI = SELF.endsWith(`${sep}ai-catalogue${sep}dev-key.mjs`);
/* bio-plane's own wrangler, beside this file's package */
const WRANGLER = IS_CLI ? resolve(dirname(SELF), "..", "..", "node_modules", "wrangler", "bin", "wrangler.js") : "wrangler.js";

/** Runs wrangler with `args`, `stdin` written to it (empty when none); answers `{code, stdout, stderr}`. The child's
 *  environment is built here: the token and account by wrangler's names, its disk log off, no inherited log level. */
export function runWrangler({ args, stdin = "", token, account, bin = WRANGLER }) {
  return new Promise((resolve) => {
    const env = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? tmpdir(),
      CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account,
      WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG: "log", WRANGLER_SEND_METRICS: "false", CI: "1" };
    for (const k of ["HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy",
      "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]) if (process.env[k] !== undefined) env[k] = process.env[k];
    const child = spawn(process.execPath, [bin, ...args], { cwd: tmpdir(), env,
      stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", () => resolve({ code: 127, stdout, stderr: `${stderr}wrangler could not be started\n` }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

/** Every value this run made, masked, wherever it appears in `text` (wrangler's output is passed on through this). */
export function mask(text, vars) {
  let out = String(text ?? "");
  const values = Object.values(vars).filter((v) => typeof v === "string" && v.length > 8);
  for (const v of values) {
    out = out.split(v).join("[masked]");
    /* also any run of the secret long enough to identify it (a wrapped or partly echoed copy) */
    for (const piece of v.split(/\s+/).filter((p) => p.length >= 24)) out = out.split(piece).join("[masked]");
  }
  return out;
}

/* ------------------------------------------------------------------ the command */

/** The command. `argv` its arguments, `env` its environment; `log`/`err` print a line; `wrangler` sets the secrets.
 *  Answers the exit code. */
export async function main(argv, env = process.env, { log = console.log, err = console.error, wrangler = runWrangler,
  seed = DEVELOPMENT_SEED } = {}) {
  const dry = argv.includes("--dry-run");
  const [slug, ...extra] = argv.filter((a) => !a.startsWith("--"));
  if (!slug || extra.length || argv.some((a) => a.startsWith("--") && a !== "--dry-run")) {
    err("usage: CIVICSMITH_TEST_INSTANCE=<slug> CF_TOKEN=... CF_ACCT=... node bio-plane/src/ai-catalogue/dev-key.mjs <slug> [--dry-run]");
    return 2;
  }
  const worker = slug;
  if (!WORKER_RE.test(worker) || worker.length > 63) {
    err(`REFUSED [NOT_A_DEVELOPMENT_NAME]: \`${slug}\` is not a p3dev- Worker name. Nothing was set.`);
    return 1;
  }
  if (env.CF_ACCT !== DEVELOPMENT_ACCOUNT) {
    err(`REFUSED [WRONG_ACCOUNT]: a development catalogue key is set in account ${DEVELOPMENT_ACCOUNT} only; CF_ACCT is ${env.CF_ACCT ? `\`${env.CF_ACCT}\`` : "not set"}. Nothing was set.`);
    return 1;
  }
  if (env.CIVICSMITH_TEST_INSTANCE !== slug) {
    err(`REFUSED [NOT_A_TEST_INSTANCE]: \`${slug}\` is not marked as a test instance (CIVICSMITH_TEST_INSTANCE). Nothing was set.`);
    return 1;
  }
  if (!env.CF_TOKEN) { err("REFUSED [NO_TOKEN]: CF_TOKEN is not set. Nothing was set."); return 1; }
  /* the Worker is looked up in a dry run too (a read only): the guard line means every check passed */
  const auth = { token: env.CF_TOKEN, account: env.CF_ACCT };
  const found = await wrangler({ args: ["deployments", "list", "--name", worker], ...auth });
  if (found.code !== 0) {
    err(`REFUSED [NO_SUCH_WORKER]: ${worker} is not deployed in ${DEVELOPMENT_ACCOUNT} (wrangler deployments list exited ${found.code}); a secret is never what creates a Worker. Nothing was set.`);
    return 1;
  }
  log(GUARD_LINE);

  const vars = variablesFor(await makeDevelopmentKey({ seed }));
  const check = await selfCheck(vars, seed);
  if (!check.dev || check.release) {
    err(`REFUSED [SELF_CHECK]: the signed seed ${check.dev ? "verifies in a release build" : "does not verify in a development build"}. Nothing was set.`);
    return 1;
  }
  const names = Object.keys(vars).join(", ");
  log(`dev-key: generated a development catalogue key (${DEVELOPMENT_KEY_COMMENT}); the seed (seq ${seed.statement.seq}) signed with it verifies in a development build and is refused by a release build`);
  if (dry) {
    log(`dev-key: dry run: would set on ${worker} in ${DEVELOPMENT_ACCOUNT}, as Worker secrets through wrangler's stdin: ${names}. No secret was sent; the key is discarded.`);
    return 0;
  }
  log(`dev-key: setting on ${worker}: ${names} …`);
  const r = await wrangler({ args: ["secret", "bulk", "--name", worker], stdin: JSON.stringify(vars), ...auth });
  const said = mask(`${r.stdout ?? ""}${r.stderr ?? ""}`, vars).trim();
  if (said) for (const l of said.split("\n")) log(`  wrangler: ${l}`);
  if (r.code !== 0) {
    err(`REFUSED [SECRETS_NOT_SET]: wrangler exited ${r.code}; ${worker} may hold none of ${names}. The key is discarded.`);
    return 1;
  }
  log(`dev-key: ${worker} holds ${names}; the private half is the secret ${DEVELOPMENT_SIGNING_SECRET} alone`);
  return 0;
}

if (IS_CLI) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; },
    (e) => { console.error(`dev-key: failed: ${e && e.name ? e.name : "error"}. Nothing was set.`); process.exitCode = 1; });
}
