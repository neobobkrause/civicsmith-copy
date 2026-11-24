#!/usr/bin/env node
/* Deploy a signed release to a Worker, and believe only the bytes.
 *
 * The lesson this encodes was learned the hard way on 2026-07-28: a deploy
 * returned an HTML error page instead of JSON, the script threw while parsing
 * it, and the instance was still running the previous version. A retry
 * succeeded. The tempting conclusion was "do not retry after an unexpected
 * response". That is the wrong lesson.
 *
 * The right one is that the API's answer is not evidence either way. A success
 * response can precede a rollout that has not happened yet; an HTML error page
 * can be a gateway hiccup in front of an upload that landed. So this never
 * reports success from what the API said. It reads the script BACK from the
 * account, hashes it, and compares against the signed asset. That comparison is
 * the only thing here that decides anything, and it is equally capable of
 * catching a silent failure and a silent success.
 *
 * Retrying is therefore safe rather than reckless: a PUT of a whole script is
 * idempotent, and the verification runs regardless of how many attempts it took
 * or what any of them claimed.
 *
 * The old process's release-baton gate (`--thread`, `--force-without-baton`,
 * reading `docs/development/kickoffs/BATON.md` from `main`) was removed with that
 * process's tooling in T19 (K648, K749): who cuts a release is the process's
 * question, not this script's.
 *
 * A TEST DEPLOY (bundler R40; K4180, K4186): `--test-instance` deploys a named branch's BUILT plane bundle, unsigned, to a
 * trial copy. It is for a copy the environment marks as a test instance (CIVICSMITH_TEST_INSTANCE names it) in the
 * test account only; any other copy and any other account is refused before a request is made. It reads no signed
 * release: the bytes deployed are the file given, verified by reading them back as ever. Each step logs what it
 * deploys and the target it can return to. `--dry-run` runs every check and read and deploys nothing.
 *
 * WORKERS LOGS (G54; K4426): the upload sends wrangler.jsonc's `observability` ({ enabled: true }), because a script PUT that
 * sends none turns them off (biosmoke8, 2026-10-20: no line named why two case files were not built). The script's settings
 * are read back after the bytes and the limits, and a difference, an absent key or an unreadable answer refuses success.
 *
 * THE CRON SCHEDULE (G1; K4565, K4566, K4570): after the upload the script's schedules are PUT from wrangler.jsonc's
 * `triggers.crons` and read back, and a failure or a difference refuses success (a raw script PUT sets none, and whether it
 * keeps the ones held is unconfirmed). Needs the token scope the upload already uses (Workers Scripts Write). The first add
 * can take up to 15 minutes to propagate to the cron runner; the smoke waits.
 *
 * usage (bundler R17, R18, R34, R40, R41), from bio-plane/:
 *   CF_TOKEN=... CF_ACCT=... node scripts/deploy.mjs <slug> <version> <asset> [--test-instance] [--dry-run]
 *     [--store-location <hint>] [--store-generation <n>]
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolveVersion } from "./resolve-version.mjs";

/* G83 (R41): two flags take a value. A value is the next argument unless that is another flag or there is none, which is
   then no value at all (refused below, by name), so a flag's value is never taken for a positional argument. */
const ARGS = process.argv.slice(2), FLAG_VALUES = {}, VALUE_AT = new Set();
for (const flag of ["--store-location", "--store-generation"]) {
  const i = ARGS.indexOf(flag);
  if (i < 0) continue;
  const v = ARGS[i + 1];
  FLAG_VALUES[flag] = v === undefined || v.startsWith("--") ? null : v;
  if (FLAG_VALUES[flag] !== null) VALUE_AT.add(i + 1);
}
const [slug, version, assetPath] = ARGS.filter((a, i) => !a.startsWith("--") && !VALUE_AT.has(i));
const TEST = process.argv.includes("--test-instance"), DRY = process.argv.includes("--dry-run");
const TOKEN = process.env.CF_TOKEN, ACCT = process.env.CF_ACCT;
if (!slug || !version || !assetPath || !TOKEN || !ACCT) {
  console.error("usage: CF_TOKEN=... CF_ACCT=... node scripts/deploy.mjs <slug> <version> <asset> [--test-instance] [--dry-run] [--store-location <hint>] [--store-generation <n>]");
  process.exit(2);
}

/* R40: A TEST DEPLOY NAMES ITS COPY AND ITS ACCOUNT, and both are checked before the first request. The mark is the
   environment's (the `deploy-test` environment sets CIVICSMITH_TEST_INSTANCE to the copy it may touch), so a copy
   nobody marked, or a different one, is not reachable by typing a slug. */
const TEST_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
if (TEST) {
  if (process.env.CIVICSMITH_TEST_INSTANCE !== slug) {
    console.error(`REFUSED [NOT_A_TEST_INSTANCE]: \`${slug}\` is not marked as a test instance: CIVICSMITH_TEST_INSTANCE is ${process.env.CIVICSMITH_TEST_INSTANCE ? `\`${process.env.CIVICSMITH_TEST_INSTANCE}\`` : "not set"}.`);
    console.error("A test deploy goes only to the copy the environment marks. Nothing was requested or deployed.");
    process.exit(1);
  }
  if (ACCT !== TEST_ACCOUNT) {
    console.error(`REFUSED [WRONG_ACCOUNT]: a test deploy goes to account ${TEST_ACCOUNT} only; CF_ACCT is ${ACCT}.`);
    console.error("Nothing was requested or deployed.");
    process.exit(1);
  }
}

/* DS-2 / D-116: THE VERSION AUTHORITY SPANS THE FLEET, CHECKED BEFORE ANYTHING
   ELSE HAPPENS.
   This script takes the version as a POSITIONAL ARGUMENT, which means that until
   now the operator's typing was the only thing deciding what a deploy claimed to
   be — nothing compared it to what the repository declares, and nothing compared
   the plane's declaration to the fleet's. Measured 2026-09-11, five of the six
   declaring sites disagreed with the authority and no instrument said so.
   Two refusals, and they are different failures:
     - the TREE disagrees with itself (a member behind or ahead of the plane), or
     - the ARGUMENT disagrees with the tree, which is a typo about to be signed. */
{
  const r = resolveVersion();
  if (!r.ok) {
    console.error("REFUSED [VERSION_SKEW]: the fleet does not agree on one version, so this");
    console.error("deploy cannot say what it is deploying.");
    console.error(`  authority: bio-plane/package.json = ${JSON.stringify(r.version)}`);
    for (const f of r.findings) console.error("  - " + f);
    process.exit(1);
  }
  if (version !== r.version) {
    console.error("REFUSED [VERSION_ARGUMENT_DISAGREES]: the version on the command line is not");
    console.error("the version this tree declares.");
    console.error(`  argument : ${JSON.stringify(version)}`);
    console.error(`  declared : ${JSON.stringify(r.version)}  (bio-plane/package.json, the authority)`);
    console.error("  A deploy stamps VERSION into the worker's bindings and the rollout gate then");
    console.error("  waits for that string to SERVE. A typo here does not fail loudly: it deploys,");
    console.error("  serves a version nothing else in the repository claims, and the next reader");
    console.error("  cannot tell which bytes are running. Fix the argument, or bump the tree.");
    process.exit(1);
  }
  console.log(`version: ${r.version} — plane and ${r.sites.length - 2} fleet site(s) agree`);
}

/* SAY WHAT GOES OUT, because an absence that is not stated is indistinguishable
   from one nobody checked. A deploy never carries a Claude credential (K1502):
   an INSTANCE_CLAUDE_TOKEN left in the operator's environment is named as
   ignored, never sent. The values themselves are never printed. */
{
  if (typeof process.env.INSTANCE_CLAUDE_TOKEN === "string" && process.env.INSTANCE_CLAUDE_TOKEN.length > 0)
    console.log("INSTANCE_CLAUDE_TOKEN is set in this environment and IGNORED — a deploy never carries a"
      + " Claude credential (K1502); it is not sent.");
  /* DIST-9 (D-260's deploy half): the organisation `ai` credential rides the same way, and is never generated —
     a member mints it on the instance (DS-3). */
  const hasAi = typeof process.env.INSTANCE_AI_TOKEN === "string" && process.env.INSTANCE_AI_TOKEN.length > 0;
  console.log(hasAi
    ? "instance ai: INSTANCE_AI_TOKEN present in this environment — it will be SENT and will replace whatever"
      + " the instance holds (value not printed; confirmed by the wake entry, not by this line)"
    : "instance ai: INSTANCE_AI_TOKEN not in this environment — NOT sent. Any value already on the instance is"
      + " KEPT (keep_bindings: secret_text); without one, every wake says NO_INSTANCE_AI_CREDENTIAL.");
}

/* ---- D-201: this script deploys THE PLANE, and nothing else ----
 *
 * The metadata below is the plane's: it declares VERSION, INSTANCE_NAME, the
 * plane's vars, its two R2 buckets and its service bindings, derived from the
 * plane's own wrangler.jsonc (bundler R13), and keeps only the instance's
 * `secret_text`, `durable_object_namespace` and `service` bindings (R18). Point
 * this at a worker whose bindings are a different shape and the PUT does not
 * merely deploy the wrong code: it binds the plane's vars, buckets and services
 * into that worker and DROPS every binding of a class it neither sends nor keeps.
 *
 * A slug ALLOWLIST is not available: plane instances are named by the groups
 * that install them, so their slugs are arbitrary by design and cannot be
 * enumerated here. What CAN be enumerated is the workers in this project that
 * are known NOT to be planes, each with its own deploy path.
 */
const NOT_A_PLANE = {
  "pdf-worker": "a fleet member, not a plane. It reads R2 CAPTURES, holds no PUBLISHED " +
                "binding and no Durable Object, and writes nothing — this script's metadata " +
                "would bind it all three. Deploy it with scripts/deploy-fleet.mjs.",
};

if (Object.hasOwn(NOT_A_PLANE, slug)) {
  console.error(`REFUSING: \`${slug}\` is not a plane, and this script deploys the plane's metadata.`);
  console.error(`  ${NOT_A_PLANE[slug]}`);
  console.error("");
  console.error("This refusal is D-201. The hazard is not the wrong code — it is that the PUT");
  console.error("carries this script's bindings, so bindings the target worker needs and the");
  console.error("plane does not are DELETED. Verifying the bytes afterwards would pass.");
  process.exit(3);
}

/* ---- D-108: the bytes landing is not the same as the new build serving ----
 *
 * Verifying the deployed script proves the BYTES are right. It says nothing
 * about which build is answering requests, and on 2026-07-31 those came apart
 * visibly: seconds after a byte-identical verification of 0.52.0, `/version`
 * answered 0.51.0, two probes were answered by the previous build and a third
 * by the new one. The rollout is PER-ISOLATE AND NOT ATOMIC, so a verification
 * issued in that window can receive a MIX and reach opposite conclusions about
 * the same property.
 *
 * That nearly produced a false security finding: a probe appeared to show new
 * code honouring a forged locator, when the old code was answering.
 *
 * So this waits for the instance to actually SERVE the version before the
 * script reports done. It is not a pass/fail on the deploy, because the deploy
 * succeeded: it is a gate on believing anything measured afterwards. A
 * non-answer is reported loudly rather than silently tolerated, because the
 * whole point is to stop the next person trusting a probe too early.
 */
async function workersSubdomain() {
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/workers/subdomain`,
      { headers: { authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.success && j.result ? j.result.subdomain : null;
  } catch { return null; }
}

async function confirmServing(want) {
  const sub = await workersSubdomain();
  if (!sub) {
    console.log("rollout: could not learn the workers.dev subdomain, so which build is SERVING is unconfirmed.");
    console.log("         The bytes are verified. Do not measure behaviour until /version answers " + want + ".");
    return;
  }
  const url = `https://${slug}.${sub}.workers.dev/version`;
  const t0 = Date.now();
  for (let attempt = 1; attempt <= 15; attempt++) {
    let seen = null;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) seen = (await r.text()).trim();
    } catch { /* mid-rollout a request can simply fail; that is not an answer either */ }
    if (seen === want) {
      console.log(`rollout: serving ${want} after ${Math.round((Date.now() - t0) / 1000)}s (${attempt} check${attempt === 1 ? "" : "s"})`);
      /* Said even on success, because /version is served by the WORKER and the
         Durable Object is a separate cycle: an op routed into the DO can still
         answer from the previous route map for a while after this line prints. */
      console.log("         NOTE: this confirms the Worker. Ops routed into the Durable Object");
      console.log("         (anything reaching op= handlers backed by the store) may lag briefly.");
      return;
    }
    if (attempt === 1) console.log(`rollout: serving ${seen || "(no answer)"}, waiting for ${want}…`);
    await new Promise((s) => setTimeout(s, 4000));
  }
  console.log("");
  console.log(`  !! ROLLOUT NOT CONFIRMED after 60s: /version still does not answer ${want}.`);
  console.log("  !! The signed bytes ARE deployed; this is about which build is answering.");
  console.log("  !! DO NOT verify behaviour yet. A probe now can be answered by the previous");
  console.log("  !! build and look exactly like a defect in the new one (D-108).");
  console.log("");
}

/* R42 (G84; K4753, K4755): the script's start-up time, as Cloudflare's upload answer states it. Source: Cloudflare API
   reference, Workers > Scripts > "Upload Worker Module" (PUT /accounts/{account_id}/workers/scripts/{script_name},
   https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/): the answer is
   `{ success, result: { ..., startup_time_ms: number } }`; wrangler reads `result.startup_time_ms` from the same upload
   and prints "Worker Startup Time". An answer without a finite number there is "unreported". */
function startupOf(answer) {
  const ms = answer && answer.result && typeof answer.result === "object" ? answer.result.startup_time_ms : undefined;
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? `${ms} ms` : "unreported";
}

const source = readFileSync(assetPath, "utf8");
const want = createHash("sha256").update(readFileSync(assetPath)).digest("hex");
const api = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/workers/scripts/${slug}`;

/* keep_bindings preserves the instance's secrets and its Durable Object
   namespace. There is deliberately NO migrations field: the class already
   exists, and re-sending new_sqlite_classes at a live store is how a record
   gets endangered. */

/* D-202 CLOSED HERE, 2026-09-14: the binding list DERIVES from wrangler.jsonc
   with the slug substituted (D-292), instead of living as a second hand-carried
   copy in this file — the two had no mechanism keeping them equal and measured
   unequal for a month (biosmoke7: zero service bindings against four declared).
   The derivation is `derive-bindings.mjs`, pure and test-driven (bundler R13–R15); it refuses
   any config binding class it does not carry, so the deletion-through-omission
   this file was bitten by cannot recur silently.
   BEHAVIOURAL CHANGE, MADE DELIBERATELY AND WITH THE OWNERS TOLD (delegations
   to RECORD and CAPTURE in CLAIMS.md, 2026-09-14): the first deploy through
   this derivation SENDS the config's service bindings — SELF arms REC-26's
   monitor cadence and CAP-3's archive fallback on the deployed instance, and
   the fleet bindings arm the plane's Tier-3 paths. The targets are
   pre-flighted below so a missing worker is OUR refusal, not code 10143. */
import { deriveStorePlace, deriveBindings, serviceTargets, deriveLimits, limitsReadBack, deriveCrons, schedulesReadBack, deriveObservability, observabilityReadBack } from "./derive-bindings.mjs";
import { parseJsonc } from "./jsonc.mjs";   /* R11: the module's one reader */
const wranglerCfg = parseJsonc(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"), "bio-plane/wrangler.jsonc");
/* G83 (R41): where the team's room runs, from the flags, validated before anything is requested. The hint list is
   runtime-limits' (`STORE_HINTS`), read only when a hint is given. */
const storePlace = deriveStorePlace(
  { location: FLAG_VALUES["--store-location"], generation: FLAG_VALUES["--store-generation"] },
  "--store-location" in FLAG_VALUES ? (await import("../src/store-place.mjs")).STORE_HINTS : []);
const meta = {
  main_module: "index.mjs",
  compatibility_date: wranglerCfg.compatibility_date,
  compatibility_flags: wranglerCfg.compatibility_flags || [],
  /* The organisation `ai` credential rides the environment, never printed; no
     Claude credential is ever derived (K1502). */
  bindings: deriveBindings(wranglerCfg, {
    slug, version,
    instanceAiToken: process.env.INSTANCE_AI_TOKEN || undefined,
  }),
  keep_bindings: ["secret_text", "durable_object_namespace", "service"],
  /* D-54: the subrequest ceiling the config states with its reason, never the
     platform's default of the month. deriveLimits REFUSES a config without it,
     before anything is uploaded. */
  limits: deriveLimits(wranglerCfg),
  /* G54 (K4426): Workers Logs. An upload that sends none turns them off on the script (biosmoke8, 2026-10-20), so the config's
     setting is sent every time and read back below. deriveObservability REFUSES a config that does not state it, before
     anything is uploaded. */
  observability: deriveObservability(wranglerCfg),
};
meta.bindings.push(...storePlace.bindings);
/* G1: the cron schedule rides no metadata field, so it is set by its own call after the upload (below). An invalid list
   is refused here, before any request, as a config without a subrequest ceiling is. */
const crons = deriveCrons(wranglerCfg);
const cronText = (l) => (l.length ? l.join(" | ") : "none");

/* D-54's read-back: the deployed script's settings, asked of the account. */
async function settingsNow() {
  try {
    const r = await fetch(`${api}/settings`, { headers: { authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.success ? j.result : null;
  } catch { return null; }
}

/* G1 (K4565, K4566, K4570): THE PLANE'S CRON SCHEDULE IS SET BY THIS DEPLOY, AND READ BACK.
   The upload above is a raw script PUT whose metadata has no schedule field, and whether such a PUT keeps or clears the
   schedules the script holds is unconfirmed (Cloudflare's text says wrangler replaces them). So after every upload the
   schedules endpoint is PUT with the crons of wrangler.jsonc and read back, and success is refused on a failure or any
   difference, never a note: the cron is the one clock outside the Durable Object that notices it has stalled. */
async function schedulesNow() {
  let r;
  try { r = await fetch(`${api}/schedules`, { headers: { authorization: `Bearer ${TOKEN}` } }); }
  catch (e) { return { unreadable: (e && e.message) || String(e) }; }
  if (r.status === 404) return { absent: true };
  if (!r.ok) return { unreadable: `HTTP ${r.status}` };
  let j = null;
  try { j = await r.json(); } catch { /* said below */ }
  const list = j && j.success && j.result && Array.isArray(j.result.schedules) ? j.result.schedules : null;
  if (!list || list.some((x) => !x || typeof x.cron !== "string")) return { unreadable: "an answer that is not the script's schedules" };
  return { held: list.map((x) => x.cron) };
}

function refuseSchedules(code, why) {
  console.error(`REFUSING TO REPORT SUCCESS [${code}]: ${why}`);
  console.error("The bytes are deployed; the script's cron schedule is not the config's, so nothing outside the Durable Object");
  console.error("would notice a stalled alarm (K4565). Nothing is verified past this line.");
  process.exit(1);
}

async function setSchedules() {
  console.log(crons.length ? `schedules: setting ${cronText(crons)} …` : "schedules: wrangler.jsonc declares no cron; setting the script's schedules to none …");
  let r;
  try {
    r = await fetch(`${api}/schedules`, { method: "PUT", body: JSON.stringify(crons.map((cron) => ({ cron }))),
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" } });
  } catch (e) { return refuseSchedules("SCHEDULES_NOT_SET", `the schedules request failed (${(e && e.message) || e}).`); }
  let said = null;
  try { said = await r.json(); } catch { /* the status decides */ }
  if (!r.ok || (said && said.success === false))
    return refuseSchedules("SCHEDULES_NOT_SET", `HTTP ${r.status}${said && said.errors ? " " + JSON.stringify(said.errors).slice(0, 200) : ""}.`);
  /* The answer is not evidence either way (the lesson of this file's header): the schedules are asked of the account. */
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const now = await schedulesNow();
    last = now.held ? schedulesReadBack(now.held, crons) : { verdict: "UNREADABLE", why: now.absent ? "the script was not found" : `the script's schedules could not be read (${now.unreadable})` };
    if (last.verdict === "MATCH") { console.log(`verified: ${last.why}`); return; }
    if (attempt < 3) await new Promise((s) => setTimeout(s, 3000));
  }
  refuseSchedules(last.verdict === "MISMATCH" ? "SCHEDULES_MISMATCH" : "SCHEDULES_UNREADABLE", `${last.why}.`);
}

/* R34: the same read, told apart: a script that does not exist yet (404) has no bindings to keep or compare, and one
   whose settings cannot be read has bindings this deploy cannot see, which a PUT could delete. */
async function bindingsNow() {
  let r;
  try { r = await fetch(`${api}/settings`, { headers: { authorization: `Bearer ${TOKEN}` } }); }
  catch (e) { return { unreadable: (e && e.message) || String(e) }; }
  if (r.status === 404) return { settings: null, bindings: [] };
  if (!r.ok) return { unreadable: `HTTP ${r.status}` };
  let j = null;
  try { j = await r.json(); } catch { /* said below */ }
  if (!j || !j.success || !j.result || typeof j.result !== "object") return { unreadable: "an answer that is not the script's settings" };
  return { settings: j.result, bindings: Array.isArray(j.result.bindings) ? j.result.bindings : [] };
}

/* G54: Workers Logs are asked of the account, never believed from the PUT's answer (the lesson of this file's header). The
   settings are read up to three times, because an answer can precede what it describes; success is refused when they do not
   report `observability.enabled` as sent, or cannot be read. */
async function confirmObservability() {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const now = await bindingsNow();
    last = now.unreadable !== undefined
      ? { verdict: "UNREADABLE", why: `the script's settings could not be read (${now.unreadable})` }
      : now.settings === null ? { verdict: "UNREADABLE", why: "the script was not found" }
      : observabilityReadBack(now.settings, meta.observability);
    if (last.verdict === "MATCH") { console.log(`verified: ${last.why}`); return; }
    if (attempt < 3) await new Promise((s) => setTimeout(s, 3000));
  }
  console.error(`REFUSING TO REPORT SUCCESS [${last.verdict === "MISMATCH" ? "OBSERVABILITY_MISMATCH" : "OBSERVABILITY_UNREADABLE"}]: ${last.why}.`);
  console.error("The bytes are deployed; the script's Workers Logs are not what the config sent, so a failure on it would leave no line to name it (G54).");
  console.error("Nothing is verified past this line.");
  process.exit(1);
}

/* R34: where a derived binding is not on the deployed script as derived. A secret's value is never readable back, so
   a `secret_text` is not compared (the wake entry confirms it, as the header says). Each class is compared by what it
   points at: a `plain_text` by its text, a `service` by its target, an `r2_bucket` by its bucket, a `browser` by name. */
const POINTS_AT = { plain_text: (b) => b.text, service: (b) => b.service, r2_bucket: (b) => b.bucket_name, browser: () => "" };
function bindingDifferences(derived, deployedBindings) {
  const out = [];
  for (const b of derived) {
    const at = POINTS_AT[b.type];
    if (!at) continue;
    const has = deployedBindings.find((d) => d && d.name === b.name && d.type === b.type);
    if (!has) out.push(`${b.type} ${b.name} is missing`);
    else if (String(at(has) ?? "") !== String(at(b) ?? ""))
      out.push(`${b.type} ${b.name} points at ${JSON.stringify(at(has) ?? null)}, not ${JSON.stringify(at(b))}`);
  }
  return out;
}

/* Pre-flight every derived service target (except the self-reference, which
   this very PUT creates) so the refusal names the missing worker. */
for (const target of serviceTargets(meta.bindings, slug)) {
  let r;
  try {
    r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCT}/workers/scripts/${target}/settings`,
      { headers: { authorization: `Bearer ${TOKEN}` } });
  } catch (e) {
    /* A request that never answered establishes nothing either (R17). */
    console.error(`REFUSED [PREFLIGHT_UNREADABLE]: could not establish whether service target "${target}" exists (${(e && e.message) || e}); an unverified target is not a verified one.`);
    process.exit(1);
  }
  if (r.status === 404) {
    console.error(`REFUSED [BINDING_TARGET_MISSING]: the derived bindings target worker "${target}",`);
    console.error(`which does not exist on this account. Deploy the fleet member first`);
    console.error(`(node scripts/deploy-fleet.mjs ${target} --instance ${slug}), then deploy the plane.`);
    process.exit(1);
  }
  if (!r.ok) {
    console.error(`REFUSED [PREFLIGHT_UNREADABLE]: could not establish whether service target "${target}" exists (HTTP ${r.status}); an unverified target is not a verified one.`);
    process.exit(1);
  }
}

async function deployed() {
  let r;
  try { r = await fetch(api, { headers: { authorization: `Bearer ${TOKEN}`, accept: "application/javascript+module" } }); }
  catch { return null; }   /* unreadable is not a match */
  if (!r.ok) return null;
  const ct = r.headers.get("content-type") || "";
  const body = Buffer.from(await r.arrayBuffer());
  let script = body;
  if (/multipart/i.test(ct)) {
    const m = /boundary=(.+)$/i.exec(ct);
    if (!m) return null;
    const parts = body.toString("binary").split("--" + m[1].replace(/"/g, "")).filter((p) => /index\.mjs/.test(p));
    if (!parts.length) return null;
    const at = parts[0].indexOf("\r\n\r\n");
    script = Buffer.from(parts[0].slice(at + 4).replace(/\r\n$/, ""), "binary");
  }
  return createHash("sha256").update(script).digest("hex");
}

/* R34: every `plain_text` already on the script that R13 does not derive (JURISDICTION_PROFILES and the like) is sent
   again unchanged: the PUT replaces the script's bindings, and keep_bindings does not carry this class. Read here,
   before the PUT, and unreadable settings of a script that exists refuse, because a binding this deploy cannot see
   is one it could delete. */
const onScript = await bindingsNow();
if (onScript.unreadable !== undefined) {
  console.error(`REFUSED [BINDINGS_UNREADABLE]: could not read the bindings now on "${slug}" (${onScript.unreadable}); `
    + "a deploy that cannot see them could delete the plain_text bindings this one does not derive.");
  process.exit(1);
}
const derivedNames = new Set(meta.bindings.map((b) => b.name));
const kept = onScript.bindings.filter((b) => b && b.type === "plain_text" && !derivedNames.has(b.name) && !storePlace.remove.includes(b.name))
  .map((b) => ({ type: "plain_text", name: b.name, text: b.text }));
meta.bindings.push(...kept);
if (kept.length) console.log(`kept: ${kept.length} plain_text binding(s) on the script that this deploy does not derive, sent unchanged — ${kept.map((b) => b.name).join(", ")}`);
const differences = bindingDifferences(meta.bindings, onScript.bindings);
/* R41: a held binding the flags remove (`--store-generation 1`, the rollback) is a difference until it is gone. */
for (const name of storePlace.remove)
  if (onScript.bindings.some((b) => b && b.type === "plain_text" && b.name === name)) differences.push(`plain_text ${name} is held and is removed`);
if (storePlace.bindings.length || storePlace.remove.length)
  console.log(`store place: ${[...storePlace.bindings.map((b) => `${b.name}=${b.text}`), ...storePlace.remove.map((n) => `${n} removed`)].join(", ")}`);

const before = await deployed();
console.log(`before: ${before ? before.slice(0, 16) + "\u2026" : "(unreadable)"}`);
console.log(`signed: ${want.slice(0, 16)}\u2026  ${version}  ${source.length} bytes`);
const schedNow = await schedulesNow();
const schedMatch = !!schedNow.held && schedulesReadBack(schedNow.held, crons).verdict === "MATCH";
/* G54: what the script reports of Workers Logs now (its settings were read above, before the upload). */
const obsNow = onScript.settings ? observabilityReadBack(onScript.settings, meta.observability) : null;
const obsMatch = !!obsNow && obsNow.verdict === "MATCH";
if (TEST) {
  /* R40: what this step deploys, and where it can return to: the bytes now deployed under the copy's name. */
  console.log(`test deploy: ${slug} from ${assetPath} sha256 ${want} (a branch's built artifact: no release/ signature is read)`);
  console.log(before
    ? `rollback : ${slug} was ${before.slice(0, 16)}\u2026 \u2014 deploy those bytes again to return to it`
    : `rollback : ${slug} has no readable deployed bytes now (a first deploy, or unreadable); delete the script to return to none`);
}
if (before === want) {
  /* Bytes matching is HALF the question — found live on the 0.58.0 cut,
     2026-09-14, the first release whose plane bytes were identical to the
     previous version's. A deploy also carries METADATA (the VERSION var, the
     derived bindings), and skipping on byte-identity alone left /version
     answering 0.57.0 forever while the rollout gate waited for a build that
     was never sent. Byte-identical + already SERVING the target version is
     "nothing to do"; byte-identical alone is a metadata deploy and proceeds. */
  const sub = await workersSubdomain();
  let serving = null;
  if (sub) {
    try { serving = (await (await fetch(`https://${slug}.${sub}.workers.dev/version`)).text()).trim(); }
    catch { /* unknown is not "already done" */ }
  }
  /* D-54: and the limits must already read back, or the metadata is not ours. */
  const lim = limitsReadBack(await settingsNow(), meta.limits);
  /* R34: and so must the bindings this deploy derives, each with the same target or value. */
  /* G1: and so must the script's schedules, or a config that gains a cron is never set on a plane whose bytes did not change. */
  if (serving === version && lim.verdict === "MATCH" && differences.length === 0 && schedMatch && obsMatch) {
    console.log(`already byte-identical AND serving ${version} AND ${lim.why} AND every derived binding present AND schedules ${cronText(crons)} held AND Workers Logs on; nothing to do`);
    process.exit(0);
  }
  /* G54: and Workers Logs must already be on, or a config that gains them is never applied to a plane whose bytes did not change. */
  if (serving === version && lim.verdict === "MATCH" && schedMatch && !obsMatch)
    console.log(`bytes identical, serving ${version} and limits match, but Workers Logs are not on for the script — a METADATA deploy proceeds (the same script, observability sent again): ${obsNow ? obsNow.why : "the script's settings could not be found"}.`);
  if (serving === version && lim.verdict === "MATCH" && !schedMatch)
    console.log(`bytes identical, serving ${version} and limits match, but the schedules differ on the script — a METADATA deploy proceeds (the same script, the schedules set again): `
      + (schedNow.held ? schedulesReadBack(schedNow.held, crons).why : `they ${schedNow.absent ? "could not be found" : `could not be read (${schedNow.unreadable})`}`) + ".");
  if (serving === version && lim.verdict === "MATCH" && differences.length > 0)
    console.log(`bytes identical, serving ${version} and limits match, but the derived bindings differ on the script — a METADATA deploy proceeds (the same script, the new bindings): ${differences.join("; ")}.`);
  if (serving === version && lim.verdict !== "MATCH") console.log(`bytes identical and serving ${version}, but limits: ${lim.verdict} (${lim.why}) — a METADATA deploy proceeds.`);
  if (serving !== version)
    console.log(`bytes are identical but the instance serves ${serving ?? "(unreadable)"} — a METADATA deploy proceeds (VERSION var, derived bindings).`);
}

if (DRY) {
  /* G1: the step is shown, and refused as the real run refuses what it can already see: an invalid list is refused above,
     before any request, and schedules of a script that exists and cannot be read are refused here. */
  console.log(crons.length
    ? `schedules: after the upload PUT .../schedules sets ${cronText(crons)} and reads it back; a failure or a difference refuses success`
    : "schedules: wrangler.jsonc declares no cron; after the upload PUT .../schedules sets none and reads it back; a failure or a difference refuses success");
  console.log(`observability: the upload carries ${JSON.stringify(meta.observability)} and reads it back; a difference or an unreadable answer refuses success`);
  console.log(`observability now: ${!onScript.settings ? "the script is not deployed, so Workers Logs are off" : obsMatch ? "on" : "off (" + obsNow.why + ")"}`);
  if (schedNow.unreadable !== undefined) {
    console.error(`REFUSED [SCHEDULES_UNREADABLE]: could not read the schedules now on "${slug}" (${schedNow.unreadable}); a deploy that cannot read them back cannot verify them.`);
    process.exit(1);
  }
  console.log(schedNow.absent ? "schedules now: the script is not deployed, so it holds none"
    : `schedules now: ${cronText(schedNow.held)} (${schedMatch ? "the config's" : "not the config's"})`);
  console.log("\n--dry-run: nothing was deployed."); process.exit(0);
}

for (let attempt = 1; attempt <= 4; attempt++) {
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  fd.append("index.mjs", new Blob([source], { type: "application/javascript+module" }), "index.mjs");
  let r = null, text = "", answer = null;
  try { r = await fetch(api, { method: "PUT", headers: { authorization: `Bearer ${TOKEN}` }, body: fd }); text = await r.text(); }
  catch (e) { console.log(`attempt ${attempt}: the upload request failed (${(e && e.message) || e})`); }
  const ct = r ? r.headers.get("content-type") || "" : "";
  /* Reported, never believed. Every branch falls through to the same check. */
  if (!r) { /* said above */ }
  else if (ct.includes("json")) {
    let j = null; try { j = JSON.parse(text); } catch { /* claimed JSON, was not */ }
    answer = j;
    console.log(`attempt ${attempt}: http ${r.status}, api says ${j ? j.success : "unparseable"}`
      + (j && !j.success ? " " + JSON.stringify(j.errors).slice(0, 200) : ""));
  } else {
    console.log(`attempt ${attempt}: http ${r.status}, non-JSON (${ct || "no type"}), ${text.length} bytes`);
    console.log("  " + text.replace(/\s+/g, " ").slice(0, 180));
  }

  const now = await deployed();
  if (now === want) {
    console.log(`verified: deployed bytes are hash-identical to the signed asset`);
    /* R42: Cloudflare's start-up figure, printed from the upload's answer. It is only printed, never believed for state
       (this file's header), and never fails a deploy. Like R40's other lines it belongs to a test deploy: without
       --test-instance a deploy prints no `test deploy:` line (R40's control). */
    if (TEST) console.log(`test deploy: startup ${startupOf(answer)}`);
    /* D-54: the limit is read back, never believed from the PUT. A value that is
       not ours refuses success; a settings answer that does not state it is
       UNDETERMINED and said so, never counted as a match. */
    const lim = limitsReadBack(await settingsNow(), meta.limits);
    if (lim.verdict === "MISMATCH") {
      console.error(`REFUSING TO REPORT SUCCESS [LIMITS_MISMATCH]: ${lim.why}. The bytes are deployed; the ceiling is not the config's.`);
      process.exit(1);
    }
    console.log(lim.verdict === "MATCH"
      ? `verified: ${lim.why}`
      : `limits: UNDETERMINED — ${lim.why}. The ceiling sent (${meta.limits.subrequests}) is NOT confirmed; establish it before stating it.`);
    /* G54: and Workers Logs, which the upload turns off unless it sends them. */
    await confirmObservability();
    /* G1: after the upload, whatever it did to the schedules. */
    await setSchedules();
    await confirmServing(version);
    process.exit(0);
  }
  console.log(`  not yet: deployed ${now ? now.slice(0, 16) + "\u2026" : "(unreadable)"}`);
  if (attempt < 4) await new Promise((s) => setTimeout(s, 6000 * attempt));
}

console.error("REFUSING TO REPORT SUCCESS: the deployed bytes never matched the signed asset.");
console.error("The instance is running whatever it was running before. Nothing was half-applied:");
console.error("a script upload either replaces the module or does not.");
process.exit(1);
