#!/usr/bin/env node
/* The live walk's two people on a fresh p3dev copy: after its install, claim it as founder, invite one member and join as
 * them, so `npm run journey -- --live <address>` (journey-check's live arm) has the four credentials it reads.
 *
 * Every value is generated here and written ONLY to a file outside the repository, mode 600 (default
 * ~/.p3dev/<slug>.env), as `export` lines: JOURNEY_ADMIN_HANDLE, JOURNEY_ADMIN_PASSWORD, JOURNEY_MEMBER_HANDLE,
 * JOURNEY_MEMBER_PASSWORD, and the copy's bootstrap credential. None is ever printed. The file is written before the first
 * write to the copy, so a run that stops part way can be run again and resumes from it.
 *
 * The copy's bootstrap credential (the plane's ADMIN_TOKEN secret) is generated here and set on the plane's script, which
 * CLAUDE.md's Cloudflare paragraph allows for a development deployment and a secret the session generated. A script
 * that already holds an ADMIN_TOKEN this file did not set is refused, never overwritten.
 *
 * usage, from the repository root, with CLOUDFLARE_API_TOKEN (or CF_TOKEN) for account 20b533579290b9b93168345edd3b7f72:
 *   node bio-plane/scripts/p3dev-walk-setup.mjs <p3dev-slug> [--address https://<slug>.<sub>.workers.dev] [--out <file>] [--walk]
 * `--walk` then runs the live walk with those credentials in its environment (never on its command line), and, where the
 * Worker <slug>-testpage is deployed (journey-check F5), its workers.dev address as JOURNEY_CITY_ORIGIN. Otherwise:
 *   set -a; . ~/.p3dev/<slug>.env; set +a; (cd bio-plane/src/journey-check && npm run journey -- --live <address>)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, realpathSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { isP3devName } from "./p3dev.mjs";
import { testpageName } from "../src/journey-check/testpage/page.mjs";

export const ACCOUNT = "20b533579290b9b93168345edd3b7f72";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KEYS = ["P3DEV_BOOTSTRAP_TOKEN", "JOURNEY_ADMIN_HANDLE", "JOURNEY_ADMIN_PASSWORD", "JOURNEY_MEMBER_HANDLE", "JOURNEY_MEMBER_PASSWORD"];

export class Refused extends Error { constructor(code, msg) { super(`REFUSED [${code}]: ${msg}`); this.code = code; } }

const secret = () => randomBytes(24).toString("base64url");
const tail = () => randomBytes(3).toString("hex");

/** Fresh credentials, or those `held` already names (a resumed run). Handles fit membership's HANDLE_PATTERN. */
export function credentials(held = {}) {
  return {
    P3DEV_BOOTSTRAP_TOKEN: held.P3DEV_BOOTSTRAP_TOKEN || secret(),
    JOURNEY_ADMIN_HANDLE: held.JOURNEY_ADMIN_HANDLE || `jadmin-${tail()}`,
    JOURNEY_ADMIN_PASSWORD: held.JOURNEY_ADMIN_PASSWORD || secret(),
    JOURNEY_MEMBER_HANDLE: held.JOURNEY_MEMBER_HANDLE || `jmember-${tail()}`,
    JOURNEY_MEMBER_PASSWORD: held.JOURNEY_MEMBER_PASSWORD || secret(),
    P3DEV_STAGE: held.P3DEV_STAGE || "new",
  };
}

/** The file's `export K=V` lines read back (values are base64url and handles, so no quoting is needed). */
export function readCreds(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^export ([A-Z0-9_]+)=([A-Za-z0-9_-]*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function writeCreds(file, creds) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const body = [...KEYS, "P3DEV_STAGE"].map((k) => `export ${k}=${creds[k]}`).join("\n") + "\n";
  writeFileSync(file, body, { mode: 0o600 });
  chmodSync(file, 0o600);
}

/** The out file must lie outside the repository. */
export function outsideRepo(file, root = ROOT) {
  const abs = resolve(file);
  let r = root;
  try { r = realpathSync(root); } catch { /* the path as given */ }
  const rel = relative(r, abs);
  return rel.startsWith("..") || isAbsolute(rel);
}

/** One op on the copy: POST /api/?op=<op> with a JSON body, an optional bearer. Answers the status and the store's own
 *  answer: the door relays an answer as `{ok: true, result}` (answer-envelope's relayAnswer), so `j` is that `result`,
 *  as the screens read it (R46); a door refusal (`ok` not true) is `j` as it came; an `ok: true` with no `result` is {}. */
export async function op(fetchOf, address, name, body, token = null) {
  const r = await fetchOf(`${address.replace(/\/+$/, "")}/api/?op=${name}`, { method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* said by the caller, by status */ }
  if (!j || typeof j !== "object") j = {};
  if (j.ok === true) j = j.result && typeof j.result === "object" ? j.result : {};
  return { status: r.status, j };
}
const said = (a) => { const code = a.j.code || a.j.reason; return `HTTP ${a.status}${typeof code === "string" && code ? ` ${code}` : ""}`; };   /* codes only, never a body */

/** Claim, sign in, invite and join. `save(creds)` is called after each stage, so a stop can resume. Prints no secret. */
export async function claimAndJoin({ address, creds, save, fetchOf = fetch, log = console.log, wait = (ms) => new Promise((s) => setTimeout(s, ms)) }) {
  const c = creds;
  if (c.P3DEV_STAGE === "new" || c.P3DEV_STAGE === "bootstrap") {
    let a;
    for (let i = 1; i <= 10; i++) {
      a = await op(fetchOf, address, "claim", { bootstrapToken: c.P3DEV_BOOTSTRAP_TOKEN, handle: c.JOURNEY_ADMIN_HANDLE, password: c.JOURNEY_ADMIN_PASSWORD });
      if (a.j.ok === true || (a.j.code || a.j.reason) !== "BOOTSTRAP_CREDENTIAL_UNSET") break;
      await wait(3000);   /* the secret reaches every isolate within seconds */
    }
    if (a.j.ok !== true) throw new Refused("CLAIM_FAILED", `the founder's claim was refused (${said(a)}); nothing else was done.`);
    c.P3DEV_STAGE = "claimed"; save(c);
    log(`claim    : founder ${"(handle in the file)"} claimed the copy`);
  }
  const login = await op(fetchOf, address, "login", { handle: c.JOURNEY_ADMIN_HANDLE, password: c.JOURNEY_ADMIN_PASSWORD, device: "own" });
  if (login.j.ok !== true || typeof login.j.token !== "string") throw new Refused("LOGIN_FAILED", `the founder could not sign in (${said(login)}).`);
  const session = login.j.token;
  if (c.P3DEV_STAGE === "claimed") {
    const add = await op(fetchOf, address, "memberadd", { memberId: c.JOURNEY_MEMBER_HANDLE, cover: "Journey walk member" }, session);
    if (add.j.ok !== true || typeof add.j.invite !== "string") throw new Refused("INVITE_FAILED", `the member's invitation was refused (${said(add)}).`);
    const join = await op(fetchOf, address, "enroll", { invite: add.j.invite, handle: c.JOURNEY_MEMBER_HANDLE, password: c.JOURNEY_MEMBER_PASSWORD });
    if (join.j.ok !== true) throw new Refused("JOIN_FAILED", `the member could not join (${said(join)}).`);
    c.P3DEV_STAGE = "joined"; save(c);
    log("join     : one member invited and joined");
  }
  const member = await op(fetchOf, address, "login", { handle: c.JOURNEY_MEMBER_HANDLE, password: c.JOURNEY_MEMBER_PASSWORD, device: "own" });
  if (member.j.ok !== true) throw new Refused("MEMBER_LOGIN_FAILED", `the member could not sign in (${said(member)}).`);
  log("sign-in  : founder and member both sign in");
  return c;
}

/* F5: the walk's fixed test page, `<slug>-testpage` (journey-check/testpage, deployed by `deploy dev`), on the account's
   workers.dev subdomain: its address when the Worker is deployed, else null, and the walk then reports capture by address as
   not walked. `settings` reads the script's settings (`{status}`). */
export async function testpageAddress(slug, subdomain, settings) {
  const name = testpageName(slug);
  const r = await settings(name);
  return r && r.status === 200 && subdomain ? `https://${name}.${subdomain}.workers.dev` : null;
}

/* The walk's environment: the credentials, and the test page's address (`JOURNEY_CITY_ORIGIN`) where there is one. */
export function walkEnv(base, creds, city) {
  const env = { ...base };
  for (const k of KEYS) env[k] = creds[k];
  delete env.JOURNEY_CITY_ORIGIN;
  if (city) env.JOURNEY_CITY_ORIGIN = city;
  return env;
}

async function cf(token, path, init = {}) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}${path}`,
    { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  let j = null;
  try { j = await r.json(); } catch { /* by status */ }
  return { status: r.status, ok: r.ok && (!j || j.success !== false), j };
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1] ?? null; };
  const slug = argv.find((a, i) => !a.startsWith("--") && !["--address", "--out"].includes(argv[i - 1]));
  if (!slug || !slug.startsWith("p3dev-") || !isP3devName(slug)) throw new Refused("NOT_A_P3DEV_NAME", `the copy ${JSON.stringify(slug ?? null)} does not begin with p3dev-.`);
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_TOKEN;
  if (!token) throw new Refused("NO_TOKEN", "CLOUDFLARE_API_TOKEN (or CF_TOKEN) is not set.");
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCT || ACCOUNT;
  if (acct !== ACCOUNT) throw new Refused("WRONG_ACCOUNT", `this helper acts in account ${ACCOUNT} only; the environment names ${acct}.`);
  const file = resolve(flag("--out") || join(homedir(), ".p3dev", `${slug}.env`));
  if (!outsideRepo(file)) throw new Refused("OUT_IN_REPO", `${file} is inside the repository; the credentials are written only outside it.`);

  const exists = await cf(token, `/workers/scripts/${slug}/settings`);
  if (exists.status === 404) throw new Refused("NO_COPY", `${slug} is not deployed in ${ACCOUNT}; install it first (deploy-test.yml).`);
  if (!exists.ok) throw new Refused("UNREADABLE", `could not read ${slug}'s settings (HTTP ${exists.status}).`);
  let address = flag("--address");
  const sub = await cf(token, "/workers/subdomain");
  const subdomain = sub.ok ? sub.j?.result?.subdomain || null : null;
  if (address && !new RegExp(`^https://${slug}\\.[a-z0-9-]+\\.workers\\.dev/?$`).test(address))
    throw new Refused("NOT_THE_COPY", `--address must be the copy's own https://${slug}.<subdomain>.workers.dev; the credentials go nowhere else.`);
  if (!address) {
    if (!subdomain) throw new Refused("NO_ADDRESS", "could not learn the workers.dev subdomain; pass --address.");
    address = `https://${slug}.${subdomain}.workers.dev`;
  }
  const city = await testpageAddress(slug, subdomain, (name) => cf(token, `/workers/scripts/${name}/settings`));
  console.log(city ? `testpage : ${city} (capture by address walks against it)` : `testpage : ${testpageName(slug)} is not deployed; capture by address will be reported as not walked`);

  const creds = credentials(readCreds(file));
  const save = (c) => writeCreds(file, c);
  save(creds);   /* before the first write to the copy */
  console.log(`creds    : ${file} (mode 600; values not printed)`);

  if (creds.P3DEV_STAGE === "new") {
    const list = await cf(token, `/workers/scripts/${slug}/secrets`);
    if (!list.ok) throw new Refused("UNREADABLE", `could not list ${slug}'s secret names (HTTP ${list.status}).`);
    const names = (list.j?.result || []).map((s) => s && s.name);
    if (names.includes("ADMIN_TOKEN"))
      throw new Refused("BOOTSTRAP_HELD", `${slug} already holds an ADMIN_TOKEN this helper did not set; it is not overwritten. Nothing was changed.`);
    const put = await cf(token, `/workers/scripts/${slug}/secrets`, { method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ADMIN_TOKEN", text: creds.P3DEV_BOOTSTRAP_TOKEN, type: "secret_text" }) });
    if (!put.ok) throw new Refused("BOOTSTRAP_NOT_SET", `could not set ${slug}'s ADMIN_TOKEN (HTTP ${put.status}).`);
    creds.P3DEV_STAGE = "bootstrap"; save(creds);
    console.log(`secret   : ADMIN_TOKEN set on ${slug} (generated here; value not printed)`);
  }

  await claimAndJoin({ address, creds, save });
  console.log(`\nready    : the live walk can run against ${address}`);
  console.log(`           set -a; . ${file}; set +a;${city ? ` JOURNEY_CITY_ORIGIN=${city}` : ""} (cd bio-plane/src/journey-check && npm run journey -- --live ${address})`);
  if (argv.includes("--walk")) {
    const env = walkEnv(process.env, creds, city);
    const r = spawnSync("npm", ["run", "journey", "--", "--live", address], { cwd: join(ROOT, "bio-plane", "src", "journey-check"), stdio: "inherit", env });
    process.exit(r.status ?? 1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e instanceof Refused ? e.message : `FAILED: ${e && e.message}`); process.exit(1); });
}
