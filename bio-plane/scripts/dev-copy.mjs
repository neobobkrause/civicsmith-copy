#!/usr/bin/env node
/* dev-copy.mjs — PUT UP, SEED AND REMOVE A WHOLE DEVELOPMENT COPY OF CIVICSMITH, BY NAME (release R43, R44, R45;
 * ARCH's decision "The walks' commands and development copies", 22 Nov 2026).
 *
 * The walks are made on development copies in the one development account the process config names
 * (`process.json`, `hosting.development_account`). This command is run by ARCH's session from the repository's root,
 * with the deploy token in the environment:
 *
 *   node bio-plane/scripts/dev-copy.mjs deploy <copy>    build from the checkout, unsigned, and put the copy up (R43)
 *   node bio-plane/scripts/dev-copy.mjs seed <copy>      give the copy its starting data, leaving its first-use door open (R44)
 *   node bio-plane/scripts/dev-copy.mjs remove <copy>    delete everything named for the copy, and read back that nothing is left (R45)
 *
 *   environment: CF_TOKEN (or CLOUDFLARE_API_TOKEN), and CF_ACCT (or CLOUDFLARE_ACCOUNT_ID), which must be the
 *   development account; CIVICSMITH_DEV_COPIES, optionally, the folder outside the repository that keeps each copy's
 *   instance values (default ~/.civicsmith/dev-copies)
 *
 * ---- THE ONE ACCOUNT -----------------------------------------------------------------------------------------------
 * The account the environment names is compared with the process config's before any request is made, and any other
 * is refused [NOT_DEVELOPMENT_ACCOUNT]. Every request then names that one account in its path: there is no other
 * account this command can address.
 *
 * ---- NAMES THAT NO INSTALLED SITE CAN TAKE --------------------------------------------------------------------------
 * A copy is a name of 1 to 12 lower-case letters and digits, beginning with a letter. Everything put up for it is named
 * `civicsmith-walks-development-copy-<copy>-<role>`: the plane (`plane`), the documents site (`documents`), each fleet
 * member (its own name) and the two storage buckets (`captures`, `published`). An installed site names its plane by its
 * slug, at most 40 characters, its members and containers `<member>-<slug>`, and its buckets `bio-captures-<slug>` and
 * `bio-published-<slug>` (the installer, `newgroup`). Every Worker name here is 41 characters or more and begins with no
 * member's name, and no bucket here begins `bio-`, so none can be an installed site's. No copy's name is the beginning
 * of another's followed by a hyphen, so what is named for one copy is never named for another.
 *
 * ---- INSTANCE VALUES -----------------------------------------------------------------------------------------------
 * The plane's instance values (ADMIN_TOKEN, PROBE_TOKEN, DAEMON_TOKEN, ACCOUNT_SEAL_SECRET: 32 random bytes each,
 * base64url, as an install makes them) are made fresh at each deploy of a copy, sent as the plane's secrets, and kept
 * only in one file outside the repository, readable by its owner alone, for `seed` to use. None is ever printed,
 * written to the repository or used for another copy.
 *
 * ---- HOW A COPY IS PUT UP ------------------------------------------------------------------------------------------
 * The checkout is built by `bundles.mjs` (R46). Each Worker is deployed by wrangler from a configuration generated from
 * its own `wrangler.jsonc` beside it and removed afterwards: the copy's name, the development account, the copy's
 * buckets, and every service and Durable Object target renamed to the copy's. A plane and its members bind each other,
 * so the members are deployed first without their service bindings (those whose Durable Objects another member's
 * binding names first), then the plane, its secrets, and the members again whole. A container member's images are
 * pulled by the digest its marker names and pushed to the account's registry first, as `deploy-fleet.mjs` does. Each
 * step prints what it deployed. A copy already up is replaced in place.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, chmodSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { parseJsonc } from "./jsonc.mjs";
import { discoverMembers, markerIsContainer, containerClasses, imageReference } from "./fleet-bundle.mjs";
/** @import { Member } from "./fleet-bundle.mjs" */

/**
 * A Worker's configuration, as its `wrangler.jsonc` states it.
 * @typedef {Record<string, any>} WranglerConfig
 */
/**
 * Everything named for one copy.
 * @typedef {Object} CopyNames
 * @property {string} prefix what begins every name of this copy, ending in a hyphen
 * @property {string} plane the plane's Worker
 * @property {string} documents the documents site's Worker
 * @property {(member: string) => string} member a fleet member's Worker
 * @property {(role: "captures"|"published") => string} bucket a storage bucket
 * @bound every Worker name: 41 to 63 characters of a-z, 0-9 and -, beginning with the prefix
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {string} what begins the name of everything put up for any development copy */
export const PREFIX = "civicsmith-walks-development-copy-";
/** @type {RegExp} a copy's name */
export const COPY_RE = /^[a-z][a-z0-9]{0,11}$/;
/** @type {readonly string[]} the plane's instance values, made fresh for each copy */
export const INSTANCE_VALUES = Object.freeze(["ADMIN_TOKEN", "PROBE_TOKEN", "DAEMON_TOKEN", "ACCOUNT_SEAL_SECRET"]);
/** @type {string} the team short name the walks index's test data gives (section 5), recorded as the copy's group */
export const GROUP = "lakeshore-tenants";
const API = "https://api.cloudflare.com/client/v4";
const BUCKET_ROLE = /** @type {Record<string, "captures"|"published">} */ ({ CAPTURES: "captures", PUBLISHED: "published" });

/**
 * The names of everything put up for `copy`.
 * @param {string} copy
 * @returns {CopyNames}
 * @throws {Error} `REFUSED [BAD_COPY]` for a name that is not 1 to 12 lower-case letters and digits beginning with a letter
 */
export function copyNames(copy) {
  if (typeof copy !== "string" || !COPY_RE.test(copy))
    throw new Error(`REFUSED [BAD_COPY]: ${JSON.stringify(copy)} is not a copy's name: 1 to 12 lower-case letters and digits, beginning with a letter.`);
  const prefix = `${PREFIX}${copy}-`;
  return { prefix, plane: `${prefix}plane`, documents: `${prefix}documents`, member: (m) => `${prefix}${m}`,
    bucket: (role) => `${prefix}${role}` };
}

/**
 * A Worker's configuration for the copy, generated from its own: the copy's name, the one account, the copy's buckets,
 * and each service and Durable Object target renamed to the copy's. `services: false` leaves out the service bindings
 * (a member's first deploy, before the plane is up).
 * @param {WranglerConfig} cfg the Worker's own configuration
 * @param {{name: string, account: string, names: CopyNames, members: string[], plane?: boolean, services?: boolean, host?: string, main?: string}} how
 * @returns {WranglerConfig}
 * @throws {Error} `REFUSED [UNKNOWN_TARGET]` for a service or Durable Object target that is neither the plane nor a
 *   member; `REFUSED [UNKNOWN_BUCKET]` for a bucket binding that is neither CAPTURES nor PUBLISHED
 */
export function generatedConfig(cfg, { name, account, names, members, plane = false, services = true, host, main }) {
  const out = JSON.parse(JSON.stringify(cfg));
  delete out.$schema;
  out.name = name;
  out.account_id = account;
  if (main) out.main = main;
  /** @type {(target: string, what: string) => string} */
  const target = (t, what) => {
    if (t === "bio-plane") return names.plane;
    if (members.includes(t)) return names.member(t);
    throw new Error(`REFUSED [UNKNOWN_TARGET]: ${cfg.name}'s ${what} names ${JSON.stringify(t)}, which is neither the plane nor a fleet member, so a copy has nothing to bind it to.`);
  };
  if (Array.isArray(out.services)) {
    if (services) out.services = out.services.map((s) => ({ ...s, service: target(s.service, `service ${s.binding}`) }));
    else delete out.services;
  }
  if (out.durable_objects && Array.isArray(out.durable_objects.bindings))
    out.durable_objects.bindings = out.durable_objects.bindings.map((b) =>
      (b.script_name ? { ...b, script_name: target(b.script_name, `Durable Object ${b.name}`) } : b));
  if (Array.isArray(out.r2_buckets))
    out.r2_buckets = out.r2_buckets.map((b) => {
      const role = BUCKET_ROLE[b.binding];
      if (!role) throw new Error(`REFUSED [UNKNOWN_BUCKET]: ${cfg.name}'s bucket binding ${JSON.stringify(b.binding)} is neither CAPTURES nor PUBLISHED, so a copy has no bucket for it.`);
      return { binding: b.binding, bucket_name: names.bucket(role) };
    });
  if (plane) {
    out.workers_dev = true;
    out.vars = { ...(out.vars || {}), INSTANCE_NAME: name, ...(host ? { OWN_HOSTS: host } : {}) };
  }
  return out;
}

/* ---- THE DOCUMENTS SITE (R43) ---------------------------------------------------------------------------------------
   The copy's own small site serving, at fixed addresses, each document the walks' journeys capture (walks index,
   section 7, item 1): Housing notice 2026-118 (J06, J15, J29) and its amended edition at the same address (J23), the
   city's report to council and its list of repair orders (J09), the adopted budget and the annual financial report
   (J12), and a court order and its register (J14). Every document is made up for the walks, in the walks index's own
   test data (section 5). Which edition of the notice is served is held by the site, the same for every request:
   `POST /_walk/notice/amended` serves the amended edition at the notice's address, `POST /_walk/notice/original` the
   first. */

const page = (title, body) => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>\n<body>\n${body}\n</body></html>\n`;

/**
 * Housing notice 2026-118, in its first edition (28 days) or as amended (14 days).
 * @param {boolean} amended
 * @returns {string}
 */
export function noticePage(amended) {
  const days = amended ? 14 : 28;
  return page("City of Lakeshore — Housing notice 2026-118", `<header><p>City of Lakeshore, Department of Housing Inspection</p>
<h1>Housing notice 2026-118</h1>
<p>Issued 12 March 2026${amended ? "; amended 2 November 2026" : ""}</p></header>
<main>
<h2>Property</h2>
<p>14 Lakeshore Row, Lakeshore. Owner of record: the landlord of 14 Lakeshore Row.</p>
<h2>Findings</h2>
<p>An inspection on 4 March 2026 found that the roof over the upper flats of 14 Lakeshore Row admits water when it rains, and that water comes through the ceiling of at least one occupied flat.</p>
<h2>Order</h2>
<p>Under the Lakeshore Housing Code, section 7.3, the owner is ordered to repair the roof of 14 Lakeshore Row so that it no longer admits water, within ${days} days of this notice.</p>
<p>Failure to comply may lead to a reinspection fee and to proceedings in the Lakeshore County Court.</p>
</main>
<footer><p>City of Lakeshore. Housing notice 2026-118.</p></footer>`);
}

/** The city's list of housing repair orders for 2026, one row an order, Housing notice 2026-118 among them. */
function ordersCsv() {
  const rows = [["order", "address", "issued", "due", "status"]];
  const streets = ["Lakeshore Row", "Harbor Street", "Mill Road", "Elm Avenue", "Quay Lane"];
  for (let i = 101; i <= 140; i++) {
    const n = i === 118 ? 14 : 2 + ((i * 7) % 60);
    const street = i === 118 ? "Lakeshore Row" : streets[i % streets.length];
    const month = 1 + (i % 9), due = 1 + ((i + 1) % 9);
    const status = i === 118 ? "open" : i % 7 === 0 ? "open" : i % 5 === 0 ? "reinspection due" : "complied";
    rows.push([`2026-${i}`, `${n} ${street}`, `2026-${String(month).padStart(2, "0")}-12`, `2026-${String(Math.max(due, month)).padStart(2, "0")}-28`, status]);
  }
  rows[18] = ["2026-118", "14 Lakeshore Row", "2026-03-12", "2026-04-09", "open"];
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

/** @type {Readonly<Record<string, {title: string, type: string, body: string|null}>>} each document's fixed address on the site; the notice's body is chosen by its edition */
export const DOCUMENTS = Object.freeze({
  "/lakeshore/housing/notices/2026-118": { title: "Housing notice 2026-118 (J06, J15, J29; amended: J23)", type: "text/html; charset=utf-8", body: null },
  "/lakeshore/council/reports/housing-repair-orders-2026": { title: "Report to Council on housing repair orders (J09)", type: "text/html; charset=utf-8",
    body: page("City of Lakeshore — Report to Council: housing repair orders, 2026", `<h1>Report to Council: housing repair orders</h1>
<p>Presented to the Lakeshore City Council by the Department of Housing Inspection, 20 October 2026.</p>
<h2>Summary</h2>
<p>The Department issued 40 housing repair orders. Landlords complied with 85 percent of the orders the Department issued.</p>
<h2>Notes</h2>
<p>The list of orders is published by the Department as a spreadsheet.</p>`) },
  "/lakeshore/data/housing-repair-orders-2026.csv": { title: "List of housing repair orders, a spreadsheet (J09)", type: "text/csv; charset=utf-8", body: ordersCsv() },
  "/lakeshore/finance/adopted-budget-2026": { title: "Adopted budget, fiscal year 2026 (J12)", type: "text/html; charset=utf-8",
    body: page("City of Lakeshore — Adopted Budget, fiscal year 2026", `<h1>City of Lakeshore Adopted Budget</h1>
<p>Fiscal year 2026 (1 July 2025 to 30 June 2026). Adopted by the City Council on 17 June 2025.</p>
<table>
<thead><tr><th>Department</th><th>Line</th><th>Adopted amount</th></tr></thead>
<tbody>
<tr><td>Housing Inspection</td><td>Housing code inspections</td><td>$1,240,000</td></tr>
<tr><td>Housing Inspection</td><td>Reinspection and enforcement</td><td>$310,000</td></tr>
<tr><td>Public Works</td><td>Street maintenance</td><td>$4,875,000</td></tr>
</tbody></table>`) },
  "/lakeshore/finance/annual-financial-report-2026": { title: "Annual financial report, fiscal year 2026 (J12)", type: "text/html; charset=utf-8",
    body: page("City of Lakeshore — Annual Financial Report, fiscal year 2026", `<h1>City of Lakeshore Annual Financial Report</h1>
<p>For the fiscal year ended 30 June 2026.</p>
<table>
<thead><tr><th>Department</th><th>Line</th><th>Actual</th></tr></thead>
<tbody>
<tr><td>Housing Inspection</td><td>Housing code inspections</td><td>$1,198,450</td></tr>
<tr><td>Housing Inspection</td><td>Reinspection and enforcement</td><td>$287,120</td></tr>
<tr><td>Public Works</td><td>Street maintenance</td><td>$4,912,300</td></tr>
</tbody></table>`) },
  "/courts/lakeshore-county/cv-2026-0412/order-2026-09-15": { title: "Court order in CV-2026-0412 (J14)", type: "text/html; charset=utf-8",
    body: page("Lakeshore County Court — Order, CV-2026-0412", `<h1>Lakeshore County Court</h1>
<p>Case number CV-2026-0412. City of Lakeshore v. the landlord of 14 Lakeshore Row.</p>
<h2>Order</h2>
<p>Dated 15 September 2026.</p>
<p>1. The respondent, the landlord of 14 Lakeshore Row, shall complete the repair of the roof of 14 Lakeshore Row required by Housing notice 2026-118 no later than 15 December 2026.</p>
<p>2. The respondent shall file proof of the completed repair with the Court by 22 December 2026.</p>
<p>By the Court.</p>`) },
  "/courts/lakeshore-county/cv-2026-0412/register": { title: "Court register of CV-2026-0412 (J14)", type: "text/html; charset=utf-8",
    body: page("Lakeshore County Court — Register, CV-2026-0412", `<h1>Register of actions: CV-2026-0412</h1>
<p>Lakeshore County Court. City of Lakeshore v. the landlord of 14 Lakeshore Row. Proceeding over the roof of 14 Lakeshore Row.</p>
<table>
<thead><tr><th>Date</th><th>Filing</th></tr></thead>
<tbody>
<tr><td>2026-07-02</td><td>Petition to enforce Housing notice 2026-118, filed by the City of Lakeshore</td></tr>
<tr><td>2026-08-11</td><td>Response of the landlord of 14 Lakeshore Row</td></tr>
<tr><td>2026-09-15</td><td>Order: repair of the roof by 15 December 2026</td></tr>
</tbody></table>`) },
});

/**
 * The documents site's Worker module: the documents at their addresses, an index at `/`, and the notice's edition held
 * in a Durable Object (`Edition`).
 * @returns {string}
 */
export function documentsModule() {
  const docs = Object.fromEntries(Object.entries(DOCUMENTS).map(([p, d]) => [p, { ...d, body: d.body }]));
  return `import { DurableObject } from "cloudflare:workers";
const DOCS = ${JSON.stringify(docs)};
const NOTICE = ${JSON.stringify({ original: noticePage(false), amended: noticePage(true) })};
export class Edition extends DurableObject {
  async fetch(req) {
    const u = new URL(req.url);
    if (req.method === "POST") { await this.ctx.storage.put("amended", u.pathname === "/amended"); }
    return new Response((await this.ctx.storage.get("amended")) ? "amended" : "original");
  }
}
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const edition = env.EDITION.get(env.EDITION.idFromName("notice"));
    if (u.pathname === "/_walk/notice/amended" || u.pathname === "/_walk/notice/original") {
      if (req.method !== "POST") return new Response("POST to change the notice's edition", { status: 405 });
      const r = await edition.fetch("https://edition" + u.pathname.slice("/_walk/notice".length), { method: "POST" });
      return new Response("the notice's address now serves its " + (await r.text()) + " edition\\n");
    }
    if (u.pathname === "/") {
      const list = Object.entries(DOCS).map(([p, d]) => '<li><a href="' + p + '">' + d.title + "</a></li>").join("\\n");
      return new Response("<!doctype html><title>Development copy documents</title><h1>Documents the walks capture</h1><ul>" + list + "</ul>", { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    const d = DOCS[u.pathname];
    if (!d) return new Response("not found", { status: 404 });
    const body = d.body ?? NOTICE[(await (await edition.fetch("https://edition/")).text())];
    return new Response(body, { headers: { "content-type": d.type } });
  },
};
`;
}

/* ---- the command ------------------------------------------------------------------------------------------------- */

/** @typedef {(line: string) => void} Log */

class Refused extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(`REFUSED [${code}]: ${message}`); this.code = code; }
}
/** @type {(code: string, message: string) => never} */
const refuse = (code, message) => { throw new Refused(code, message); };

/**
 * The development account, and the token, from the process config and the environment: refused before any request
 * when the environment names another account, or none, or no token.
 * @param {Record<string, string|undefined>} env
 * @param {string} root
 * @returns {{account: string, token: string}}
 */
export function accountOf(env, root = ROOT) {
  let dev = null;
  try { dev = JSON.parse(readFileSync(join(root, "process.json"), "utf8")).hosting.development_account; } catch { /* named below */ }
  if (typeof dev !== "string" || !/^[0-9a-f]{32}$/.test(dev))
    refuse("NO_DEVELOPMENT_ACCOUNT", "process.json names no development account (hosting.development_account), so no copy can be put anywhere.");
  const given = env.CF_ACCT || env.CLOUDFLARE_ACCOUNT_ID;
  if (given !== dev)
    refuse("NOT_DEVELOPMENT_ACCOUNT", `the environment names account ${given ? JSON.stringify(given) : "none"} (CF_ACCT or CLOUDFLARE_ACCOUNT_ID); a development copy goes only to the development account ${dev}, which process.json names. Nothing was requested.`);
  const token = env.CF_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (!token) refuse("NO_TOKEN", "CF_TOKEN (or CLOUDFLARE_API_TOKEN), the deploy token, is not set. Nothing was requested.");
  return { account: dev, token };
}

/**
 * Where a copy's instance values are kept: outside the repository, or refused.
 * @param {string} copy
 * @param {Record<string, string|undefined>} env
 * @param {string} root
 * @returns {string}
 */
export function stateFile(copy, env, root = ROOT) {
  const dir = resolve(env.CIVICSMITH_DEV_COPIES || join(homedir(), ".civicsmith", "dev-copies"));
  const rel = relative(root, dir);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)))
    refuse("STATE_IN_REPOSITORY", `${dir} is inside the repository; a copy's instance values are never written there.`);
  return join(dir, `${copy}.json`);
}

/**
 * Requests to the one account. Each answer's JSON, or a refusal naming the request and the status; nothing secret is
 * in either.
 * @param {string} account
 * @param {string} token
 */
function accountApi(account, token) {
  /** @param {string} method @param {string} path under /accounts/<account> @param {any} [body] @param {number[]} [okAlso] */
  return async (method, path, body, okAlso = []) => {
    const r = await fetch(`${API}/accounts/${account}${path}`, {
      method, headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }).catch((e) => refuse("REQUEST_FAILED", `${method} ${path}: ${e.message}`));
    const j = await r.json().catch(() => null);
    if (!r.ok && !okAlso.includes(r.status))
      refuse("REQUEST_FAILED", `${method} ${path} answered ${r.status}${j && j.errors && j.errors[0] ? `: ${j.errors[0].message}` : ""}`);
    return { status: r.status, result: j && j.result };
  };
}

/**
 * Run a program, its output passed through; refused by `code` when it does not exit 0.
 * @param {string} cmd @param {string[]} args @param {{cwd: string, env?: Record<string, string|undefined>, code: string, what: string, log: Log}} o
 */
function step(cmd, args, { cwd, env, code, what, log }) {
  const r = spawnSync(cmd, args, { cwd, env: env || process.env, encoding: "utf8", timeout: 25 * 60_000 });
  const out = [r.stdout || "", r.stderr || ""].join("").trimEnd();
  if (out) for (const line of out.split("\n")) log(`    | ${line}`);
  if (r.status !== 0) refuse(code, `${what} exited ${r.status}${r.error ? ` (${r.error.message})` : ""}.`);
}

/**
 * R43: build the checkout and put the copy up.
 * @param {string} copy
 * @param {{env: Record<string, string|undefined>, root?: string, log?: Log}} o
 */
export async function deploy(copy, { env, root = ROOT, log = console.log }) {
  const names = copyNames(copy);
  const { account, token } = accountOf(env, root);
  const keep = stateFile(copy, env, root);
  const cf = accountApi(account, token);
  const wrangler = join(root, "bio-plane", "node_modules", ".bin", "wrangler");
  const wenv = { ...env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account };
  const started = Date.now();

  log(`dev-copy: deploying ${copy} to the development account ${account}, as ${names.prefix}*`);
  step(process.execPath, [join(root, "bio-plane", "scripts", "bundles.mjs")], { cwd: root, env, code: "BUILD_FAILED", what: "building the checkout (bundles.mjs)", log });
  log("built: the plane and every fleet member, from this checkout, unsigned");

  /* Fresh instance values, kept outside the repository before anything uses them. */
  const values = Object.fromEntries(INSTANCE_VALUES.map((n) => [n, randomBytes(32).toString("base64url")]));
  mkdirSync(dirname(keep), { recursive: true, mode: 0o700 });
  writeFileSync(keep, JSON.stringify({ copy, plane: names.plane, values }, null, 2) + "\n", { mode: 0o600 });
  chmodSync(keep, 0o600);
  log(`instance values: ${INSTANCE_VALUES.join(", ")} made fresh for ${copy}, kept in ${keep} (owner only); not printed`);

  const sub = (await cf("GET", "/workers/subdomain")).result;
  const subdomain = sub && sub.subdomain;
  if (!subdomain) refuse("REQUEST_FAILED", "the account states no workers.dev subdomain, so the copy would have no address.");
  const host = (w) => `${w}.${subdomain}.workers.dev`;

  for (const role of /** @type {const} */ (["captures", "published"])) {
    const r = await cf("POST", "/r2/buckets", { name: names.bucket(role) }, [409]);
    log(`bucket: ${names.bucket(role)} ${r.status === 409 ? "already there" : "made"}`);
  }

  const fleet = discoverMembers(root).filter((m) => existsSync(join(m.abs, "wrangler.jsonc")));
  const memberNames = fleet.map((m) => m.name);
  const configOf = (dir) => parseJsonc(readFileSync(join(dir, "wrangler.jsonc"), "utf8"), `${relative(root, dir)}/wrangler.jsonc`);
  /** @param {string} dir @param {WranglerConfig} gen @param {string} what */
  const wranglerDeploy = (dir, gen, what) => {
    const path = join(dir, ".wrangler.devcopy.generated.json");
    try {
      writeFileSync(path, JSON.stringify(gen, null, 2) + "\n");
      step(wrangler, ["deploy", "-c", path], { cwd: dir, env: wenv, code: "DEPLOY_FAILED", what: `wrangler deploy of ${what}`, log });
    } finally { rmSync(path, { force: true }); }
    log(`deployed: ${what} as ${gen.name}`);
  };

  /* A container member's images, pushed to the account's registry by the digest its marker names (deploy-fleet's R26). */
  /** @type {Map<string, WranglerConfig>} */
  const memberCfg = new Map();
  for (const m of fleet) {
    const cfg = configOf(m.abs);
    if (m.marker && markerIsContainer(m.marker) && Array.isArray(cfg.containers)) {
      const { classes, multi } = containerClasses(m);
      const pushed = new Map();
      for (const cls of classes) {
        const img = imageReference(cls.image);
        if (!img.reference) refuse("CONTAINER_UNDESCRIBED", `${m.name}'s marker names no image by digest${multi ? ` for ${cls.class_name}` : ""} (${img.missing}).`);
        const tag = `${names.member(m.name)}${multi ? `-${String(cls.class_name).toLowerCase()}` : ""}:${String(cls.image.digest).slice(7, 19)}`;
        step("docker", ["pull", img.reference], { cwd: m.abs, env: wenv, code: "DEPLOY_FAILED", what: `docker pull ${img.reference}`, log });
        step("docker", ["tag", img.reference, tag], { cwd: m.abs, env: wenv, code: "DEPLOY_FAILED", what: `docker tag ${tag}`, log });
        step(wrangler, ["containers", "push", tag], { cwd: m.abs, env: wenv, code: "DEPLOY_FAILED", what: `wrangler containers push ${tag}`, log });
        pushed.set(cls.class_name, `registry.cloudflare.com/${account}/${tag}`);
        log(`image: ${img.reference} pushed as ${tag}`);
      }
      cfg.containers = cfg.containers.map((c) => ({ ...c, image: pushed.get(multi ? c.class_name : classes[0].class_name) }));
    }
    memberCfg.set(m.name, cfg);
  }
  /* First the members a Durable Object binding names, then the others; each without its service bindings. */
  const named = new Set(fleet.flatMap((m) => ((memberCfg.get(m.name)?.durable_objects?.bindings) || []).map((b) => b.script_name).filter(Boolean)));
  const order = [...fleet.filter((m) => named.has(m.name)), ...fleet.filter((m) => !named.has(m.name))];
  const gen = (m, services) => generatedConfig(/** @type {WranglerConfig} */ (memberCfg.get(m.name)), { name: names.member(m.name), account, names, members: memberNames, services });
  for (const m of order) wranglerDeploy(m.abs, gen(m, false), `${m.name} (first, without its service bindings)`);

  const planeDir = join(root, "bio-plane");
  wranglerDeploy(planeDir, generatedConfig(configOf(planeDir), { name: names.plane, account, names, members: memberNames, plane: true,
    host: host(names.plane), main: "dist/bio-plane.bundled.mjs" }), "the plane");
  for (const n of INSTANCE_VALUES)
    await cf("PUT", `/workers/scripts/${names.plane}/secrets`, { name: n, text: values[n], type: "secret_text" });
  log(`secrets: ${INSTANCE_VALUES.join(", ")} sent to ${names.plane}`);
  for (const m of order) wranglerDeploy(m.abs, gen(m, true), `${m.name} (whole)`);

  const site = mkdtempSync(join(tmpdir(), "dev-copy-documents-"));
  try {
    writeFileSync(join(site, "documents.mjs"), documentsModule());
    wranglerDeploy(site, { name: names.documents, account_id: account, main: "documents.mjs", compatibility_date: "2026-07-01",
      workers_dev: true, durable_objects: { bindings: [{ name: "EDITION", class_name: "Edition" }] },
      migrations: [{ tag: "v1", new_sqlite_classes: ["Edition"] }] }, "the documents site");
  } finally { rmSync(site, { recursive: true, force: true }); }

  const minutes = (Date.now() - started) / 60_000;
  log(`\ncopy ${copy} is up (${minutes.toFixed(1)} minutes):`);
  log(`  address: https://${host(names.plane)}/`);
  log(`  documents site: https://${host(names.documents)}/`);
  for (const [p, d] of Object.entries(DOCUMENTS)) log(`    ${d.title}: https://${host(names.documents)}${p}`);
  log(`  the notice's amended edition (J23): POST https://${host(names.documents)}/_walk/notice/amended (and /original to return)`);
  return 0;
}

/**
 * R44: the copy's starting data, through the plane's own admin operation, leaving its first-use door open.
 * @param {string} copy
 * @param {{env: Record<string, string|undefined>, root?: string, log?: Log}} o
 */
export async function seed(copy, { env, root = ROOT, log = console.log }) {
  const names = copyNames(copy);
  const { account, token } = accountOf(env, root);
  const keep = stateFile(copy, env, root);
  const cf = accountApi(account, token);
  /** @type {{values: Record<string, string>}|null} */
  let kept = null;
  try { kept = JSON.parse(readFileSync(keep, "utf8")); } catch { /* named below */ }
  if (!kept || !kept.values || !kept.values.ADMIN_TOKEN)
    refuse("COPY_NOT_UP", `${copy} holds no instance values in ${keep}: it was not deployed from here, or was removed. Run \`dev-copy.mjs deploy ${copy}\` first.`);
  const sub = (await cf("GET", "/workers/subdomain")).result;
  const base = `https://${names.plane}.${sub && sub.subdomain}.workers.dev`;
  const v = await fetch(`${base}/version`).catch(() => null);
  if (!v || !v.ok) refuse("COPY_NOT_UP", `${base}/version does not answer${v ? ` (${v.status})` : ""}: the copy is not up.`);

  const r = await fetch(`${base}/api/?op=instancegroupseed`, { method: "POST",
    headers: { authorization: `Bearer ${kept.values.ADMIN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ slug: GROUP }) });
  const j = await r.json().catch(() => null);
  const code = j && (j.code || (j.error && j.error.code) || j.error);
  if (!r.ok && code !== "GROUP_ALREADY_RECORDED") refuse("SEED_FAILED", `instancegroupseed answered ${r.status}${code ? ` ${code}` : ""}.`);
  log(`seeded: the copy's group, ${GROUP} (walks index, section 5)${code === "GROUP_ALREADY_RECORDED" ? ", already recorded" : ""}`);

  const b = await fetch(`${base}/api/?op=bootstrap`).catch(() => null);
  const state = b && b.ok ? await b.json().catch(() => null) : null;
  if (!state || state.claimed !== false) refuse("DOOR_CLOSED", `${base}'s first-use door is not open after seeding (op=bootstrap answered ${state ? `claimed ${state.claimed}` : "nothing readable"}).`);
  log(`first-use door: open (no member, no sign-in, no team founded)`);
  log(`documents site: https://${names.documents}.${sub && sub.subdomain}.workers.dev/`);
  return 0;
}

/**
 * R45: delete every Worker, container application, bucket with its objects and database named for the copy, and read
 * the account back.
 * @param {string} copy
 * @param {{env: Record<string, string|undefined>, root?: string, log?: Log}} o
 */
export async function remove(copy, { env, root = ROOT, log = console.log }) {
  const names = copyNames(copy);
  const { account, token } = accountOf(env, root);
  const keep = stateFile(copy, env, root);
  const cf = accountApi(account, token);
  const mine = (n) => typeof n === "string" && n.startsWith(names.prefix);
  const read = async () => ({
    workers: ((await cf("GET", "/workers/scripts")).result || []).map((s) => s.id).filter(mine),
    containers: ((await cf("GET", "/containers/applications")).result || []).filter((c) => mine(c.name)),
    buckets: (((await cf("GET", "/r2/buckets")).result || {}).buckets || []).map((b) => b.name).filter(mine),
    databases: ((await cf("GET", "/d1/database")).result || []).filter((d) => mine(d.name)),
  });

  log(`dev-copy: removing ${copy} from the development account ${account} (everything named ${names.prefix}*)`);
  const found = await read();
  for (const c of found.containers) { await cf("DELETE", `/containers/applications/${c.id}`, undefined, [404]); log(`deleted: container application ${c.name}`); }
  for (const w of found.workers) { await cf("DELETE", `/workers/scripts/${w}?force=true`, undefined, [404]); log(`deleted: Worker ${w}`); }
  for (const b of found.buckets) {
    const objects = (await cf("GET", `/r2/buckets/${b}/objects`)).result || [];
    for (const o of objects) await cf("DELETE", `/r2/buckets/${b}/objects/${encodeURIComponent(o.key)}`, undefined, [404]);
    await cf("DELETE", `/r2/buckets/${b}`, undefined, [404]);
    log(`deleted: bucket ${b} and its ${objects.length} object(s)`);
  }
  for (const d of found.databases) { await cf("DELETE", `/d1/database/${d.uuid}`, undefined, [404]); log(`deleted: database ${d.name}`); }

  const left = await read();
  const leftover = [...left.workers.map((w) => `Worker ${w}`), ...left.containers.map((c) => `container application ${c.name}`),
    ...left.buckets.map((b) => `bucket ${b}`), ...left.databases.map((d) => `database ${d.name}`)];
  if (leftover.length) refuse("LEFTOVERS", `the account still holds, named for ${copy}: ${leftover.join(", ")}.`);
  rmSync(keep, { force: true });
  const n = found.workers.length + found.containers.length + found.buckets.length + found.databases.length;
  log(n ? `copy ${copy} removed: ${n} thing(s) deleted, and the account holds nothing named for it` : `copy ${copy} was not there: nothing named for it in the account`);
  return 0;
}

const USAGE = "usage: node bio-plane/scripts/dev-copy.mjs <deploy|seed|remove> <copy>";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, copy, ...rest] = process.argv.slice(2);
  const run = cmd === "deploy" ? deploy : cmd === "seed" ? seed : cmd === "remove" ? remove : null;
  if (!run || !copy || rest.length) { console.error(USAGE); process.exit(2); }
  else {
    try { process.exit(await run(copy, { env: process.env })); }
    catch (e) {
      console.error(e instanceof Refused || /^REFUSED \[/.test(String(e && e.message)) ? e.message : `dev-copy: ${e && e.message}`);
      process.exit(1);
    }
  }
}
