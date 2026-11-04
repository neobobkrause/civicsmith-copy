#!/usr/bin/env node
/* journey-check F5: deploy the walk's fixed test page, the Worker `<slug>-testpage` (`p3dev-t1-testpage`), to the product's development account.
 *
 *   node bio-plane/src/journey-check/testpage/deploy.mjs <slug> [--dry-run]
 *
 * `deploy dev` runs it (process/config.json) with CIVICSMITH_TEST_INSTANCE, CF_TOKEN and CF_ACCT set. Its limits, each checked
 * before any call: a slug matching /^p3dev-[a-z0-9][a-z0-9-]*$/ and equal to CIVICSMITH_TEST_INSTANCE; CF_ACCT equal to account
 * 20b533579290b9b93168345edd3b7f72 (and CLOUDFLARE_ACCOUNT_ID, where set); one module, with no binding, no secret, no route and no custom domain; its workers.dev
 * address turned on. The token is read from the environment and never printed. `--dry-run` says what it would do and calls
 * nothing. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { testpageName, testpageSource } from "./page.mjs";

export const ACCOUNT = "20b533579290b9b93168345edd3b7f72";
export const GUARD_LINE = "p3dev guard: passed";
export const COMPATIBILITY_DATE = "2026-10-01";

export class Refused extends Error { constructor(code, msg) { super(`REFUSED [${code}]: ${msg}`); this.code = code; } }

/** What the deploy would do, checked: `{name, account, metadata, source}`. Throws Refused before any call. */
export function plan(slug, env = process.env) {
  if (typeof slug !== "string" || !/^p3dev-[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Refused("NOT_A_P3DEV_NAME", `the copy's slug ${JSON.stringify(slug ?? null)} is not a p3dev- Worker name.`);
  const name = testpageName(slug);
  if (name.length > 63) throw new Refused("NOT_A_P3DEV_NAME", `${name} is longer than a Worker name may be.`);
  if (env.CIVICSMITH_TEST_INSTANCE !== slug)
    throw new Refused("NOT_THE_COPY", `CIVICSMITH_TEST_INSTANCE names ${JSON.stringify(env.CIVICSMITH_TEST_INSTANCE ?? null)}, not ${slug}.`);
  if (env.CF_ACCT !== ACCOUNT) throw new Refused("WRONG_ACCOUNT", `this deploy acts in account ${ACCOUNT} only; CF_ACCT names ${JSON.stringify(env.CF_ACCT ?? null)}.`);
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT)
    throw new Refused("WRONG_ACCOUNT", `this deploy acts in account ${ACCOUNT} only; CLOUDFLARE_ACCOUNT_ID names ${env.CLOUDFLARE_ACCOUNT_ID}.`);
  const metadata = { main_module: "worker.mjs", compatibility_date: COMPATIBILITY_DATE, bindings: [] };
  return { name, account: ACCOUNT, metadata, source: testpageSource() };
}

/** The deploy: upload the module, turn on its workers.dev address. `fetchOf` is the network. Answers the Worker's name. */
export async function deploy(slug, { env = process.env, dryRun = false, fetchOf = fetch, log = console.log } = {}) {
  const p = plan(slug, env);
  /* deploy dev accepts the step only on this exact line, printed once the checks above pass, dry run or not */
  log(GUARD_LINE);
  const api = `https://api.cloudflare.com/client/v4/accounts/${p.account}/workers/scripts/${p.name}`;
  log(`testpage : ${p.name} in account ${p.account}, ${p.source.length} bytes, no binding, no secret, no route${dryRun ? " (dry run: nothing sent)" : ""}`);
  if (dryRun) return p.name;
  const token = env.CF_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Refused("NO_TOKEN", "CF_TOKEN (or CLOUDFLARE_API_TOKEN) is not set.");
  const said = async (r) => { let j = null; try { j = await r.json(); } catch { /* by status */ } return { ok: r.ok && (!j || j.success !== false), status: r.status }; };
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(p.metadata)], { type: "application/json" }));
  fd.append("worker.mjs", new Blob([p.source], { type: "application/javascript+module" }), "worker.mjs");
  const up = await said(await fetchOf(api, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: fd }));
  if (!up.ok) throw new Refused("UPLOAD_FAILED", `the upload of ${p.name} was refused (HTTP ${up.status}).`);
  const sub = await said(await fetchOf(`${api}/subdomain`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ enabled: true }) }));
  if (!sub.ok) throw new Refused("ADDRESS_FAILED", `${p.name}'s workers.dev address could not be turned on (HTTP ${sub.status}).`);
  log(`testpage : ${p.name} deployed, its workers.dev address on`);
  return p.name;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  deploy(argv.find((a) => !a.startsWith("--")), { dryRun: argv.includes("--dry-run") })
    .catch((e) => { console.error(e instanceof Refused ? e.message : `FAILED: ${e && e.message}`); process.exit(1); });
}
