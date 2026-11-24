#!/usr/bin/env node
/* Deploy ONE fleet member to ONE instance, with every binding target TEMPLATED
 * from that instance's slug.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT `bio-plane/scripts/deploy.mjs`.
 * That script deploys the PLANE. It sends a hardcoded binding list and a
 * `keep_bindings` tuned to the plane's own shape, and it refuses `pdf-worker`
 * BY NAME (D-201) because pointing it at another worker deletes
 * bindings that worker needs. `kickoffs/DIST-NEXT.md` tells the next session "if
 * you deploy a fleet member, do not reach for deploy.mjs" — and until now that
 * sentence named no alternative, which is a rule without a mechanism. This is
 * the mechanism.
 *
 * THE DEFECT IT EXISTS TO FIX, measured 2026-08-10 and re-measured 2026-09-10:
 * `agent-worker/wrangler.jsonc` declares `service PLANE -> "bio-plane"`, and
 * NO WORKER IS EVER DEPLOYED UNDER THE NAME `bio-plane`. The plane's worker name
 * is the INSTANCE name (D-102): the smoke instance is `biosmoke7` and a group's
 * instance is named by the group. So Cloudflare refuses the deploy outright —
 *
 *     Service binding 'PLANE' references Worker 'bio-plane' which was not found
 *     [code: 10143]
 *
 * — which is D-292. The fix is NOT to write `biosmoke7` into the tracked config:
 * that hardcodes the smoke instance into a file meant to be installed into
 * arbitrary group accounts, which is the same defect inverted. The fix is to
 * SUBSTITUTE the instance slug at deploy time, which is what this does.
 *
 * WHY IT SHELLS OUT TO WRANGLER INSTEAD OF PUTTING BYTES LIKE deploy.mjs DOES.
 * Each member's `wrangler.jsonc` names its committed, guarded bundle as `main`
 * (D-297 settled that a member ships one bundled, hashed, signed artifact, which
 * `fleet-bundle.mjs` guards), and wrangler carries everything else a member's
 * config states — its upload parts' module rules, its containers, its buckets and
 * crons — from that one file, so this tool substitutes the slug and hands the
 * config over rather than re-deriving each class of binding. The generated config
 * below is a TEMP FILE, deleted in a finally, and the tracked config is never
 * written to. (The INSTALLER cannot run wrangler: it installs the release's
 * signed assets and parts, bundler R22–R25.)
 *
 * A CONTAINER MEMBER (bundler R26; N624, K1705) deploys the same way, with one step
 * before it: its image, named by digest in its own marker, is pulled and pushed to
 * Cloudflare's registry with the account's token (the project's own copy; since K2912
 * the images are named on `ghcr.io/believeinoakland` and copied into each account's
 * registry, K3028), and the generated
 * config's `containers[].image` names that pushed copy. A member with several classes
 * (T36-2) pushes each class's image and points each `containers[]` entry at its own
 * class's copy, by `class_name`. A token that cannot reach
 * Containers is refused by name before anything is pulled, pushed or deployed —
 * 0.80.0 shipped without its container for exactly that (K1705 (3)).
 *
 * A TEST DEPLOY (bundler R40; K4180, K4186): `--test-instance` deploys a named branch's BUILT member, unsigned, for a trial
 * copy. The copy must be the one the environment marks (CIVICSMITH_TEST_INSTANCE names it) and the member's pinned
 * account the test account; anything else is refused before a request is made. It reads no signed release. It logs the
 * artifact deployed and the target it can return to (the bytes now deployed under the member's name).
 *
 * usage (bundler R19, R20, R26, R40; moved from the old process's `tools/` in T19), from the repository root:
 *   node bio-plane/scripts/deploy-fleet.mjs <member> --instance <slug> [--test-instance]
 *   node bio-plane/scripts/deploy-fleet.mjs agent-worker --instance biosmoke7 --dry-run
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./jsonc.mjs";   /* R11: one parser, shared with release-assemble.mjs */
import { imageReference, markerIsContainer, containerClasses } from "./fleet-bundle.mjs";   /* R24–R26: one reading of a container */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i === -1 ? null : (argv[i + 1] ?? ""); };
const DRY = argv.includes("--dry-run");
const TEST = argv.includes("--test-instance");
const TEST_ACCOUNT = "20b533579290b9b93168345edd3b7f72";   /* R40: the one account a test deploy may reach */
const member = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--instance");
const instance = flag("--instance");

/* The placeholder every fleet config names, and the reason this tool exists. It
   is a NAME IN A FILE and never a worker in an account. */
const PHANTOM = "bio-plane";

const die = (code, msg, detail) => {
  console.error(`REFUSED [${code}]: ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
};

if (!member) die("NO_MEMBER", "name the fleet member to deploy.",
  "usage: node bio-plane/scripts/deploy-fleet.mjs <member> --instance <slug>");
if (!instance) die("NO_INSTANCE",
  "--instance is required and has NO DEFAULT, deliberately.",
  "A default would be a hardcoded instance name, which is the defect (D-292) this tool exists to fix.");
/* R40: a test deploy goes only to the copy the environment marks, checked before anything is read or requested. */
if (TEST && process.env.CIVICSMITH_TEST_INSTANCE !== instance)
  die("NOT_A_TEST_INSTANCE", `\`${instance}\` is not marked as a test instance: CIVICSMITH_TEST_INSTANCE is ${process.env.CIVICSMITH_TEST_INSTANCE ? `\`${process.env.CIVICSMITH_TEST_INSTANCE}\`` : "not set"}.`,
    "A test deploy goes only to the copy the environment marks. Nothing was requested or deployed.");

/* STRUCTURAL: this tool deploys FLEET MEMBERS. Membership is decided by the
   member's own marker file (D-117), not by a name list here, so it cannot be
   pointed at the plane or at `newgroup` even by mistake — the
   mirror of deploy.mjs's NOT_A_PLANE refusal, from the other side. */
const memberDir = join(ROOT, member);
if (!existsSync(join(memberDir, "fleet-member.json"))) {
  die("NOT_A_FLEET_MEMBER",
    `"${member}" carries no fleet-member.json, so it is not a fleet member.`,
    "The plane is deployed with bio-plane/scripts/deploy.mjs. This tool deploys only\n" +
    "members that declare themselves one.");
}

let marker;
try { marker = JSON.parse(readFileSync(join(memberDir, "fleet-member.json"), "utf8")); }
catch (e) { die("UNPARSEABLE_CONFIG", `${member}/fleet-member.json did not parse.`, String(e.message)); }
/* R24's definition, from the member's own marker: `kind: "container"` and an `image` block (one per class, for a
   member with several classes). */
const CONTAINER = markerIsContainer(marker);

const cfgPath = join(memberDir, "wrangler.jsonc");
if (!existsSync(cfgPath)) die("NO_CONFIG", `"${member}" has no wrangler.jsonc.`);
let cfg;
try { cfg = parseJsonc(readFileSync(cfgPath, "utf8"), `${member}/wrangler.jsonc`); }
catch (e) { die("UNPARSEABLE_CONFIG", `${member}/wrangler.jsonc did not parse.`, String(e.message)); }

/* THE TEMPLATING, and it is the whole point. Every service target equal to the
   phantom becomes the instance slug. A target that is NOT the phantom is left
   exactly as written — this tool substitutes one known placeholder and never
   guesses at a name somebody meant on purpose. */
const substituted = [];
for (const svc of cfg.services || []) {
  if (svc.service === PHANTOM) {
    svc.service = instance;
    substituted.push(`${svc.binding} -> ${instance}  (was the phantom "${PHANTOM}")`);
  } else {
    substituted.push(`${svc.binding} -> ${svc.service}  (left as written)`);
  }
}

console.log(`member   : ${member}`);
console.log(`instance : ${instance}`);
console.log(`account  : ${cfg.account_id || "(not pinned — wrangler will choose, which CLAUDE.md forbids)"}`);
console.log("bindings :");
for (const line of substituted) console.log(`   ${line}`);
if (!substituted.length) console.log("   (none declared)");

if (!cfg.account_id) {
  die("ACCOUNT_NOT_PINNED",
    `${member}/wrangler.jsonc does not pin account_id.`,
    "With no pin the MACHINE's OAuth session decides where this goes, and this machine\n" +
    "defaults to the neo persona. A deploy would SUCCEED into the wrong account with no\n" +
    "error to notice (CLAUDE.md, measured 2026-07-31).");
}

/* R40: and only to the test account, whatever the member's own configuration pins. */
if (TEST && cfg.account_id !== TEST_ACCOUNT)
  die("WRONG_ACCOUNT", `a test deploy goes to account ${TEST_ACCOUNT} only; ${member}/wrangler.jsonc pins ${cfg.account_id}.`,
    "Nothing was requested or deployed.");

/* R26: what a container member deploys is stated by its own files before any request: the image by digest in its
   marker, and the container in its own config. Neither is defaulted. */
/* A member with several classes (T36-2, `file-scanner`) deploys each class's image, and each `containers[]` entry of
   its own config names the class it runs behind, so the pushed copy reaches the right class and no class deploys
   without its container. */
let images = [];   /* [{class_name, reference, digest}], one per class */
let MULTI = false;
if (CONTAINER) {
  const { classes, multi, conflict } = containerClasses({ marker });
  MULTI = multi;
  if (conflict) die("CONTAINER_UNDESCRIBED", `${member} is a container member and its fleet-member.json states ${conflict}.`,
    "A member with several classes names each class's image in its `containers` list, and no top-level image.");
  for (const cls of classes) {
    const img = imageReference(cls.image);
    if (img.missing) {
      die("CONTAINER_UNDESCRIBED",
        `${member} is a container member and its fleet-member.json does not state${multi ? `, for its class ${cls.class_name},` : ""} `
        + `${img.missing} as \`<repository>\` and \`sha256:<64 hex>\`.`,
        "The image is deployed only by digest. The release writes the digest when it publishes the image.");
    }
    images.push({ class_name: cls.class_name, reference: img.reference, digest: cls.image.digest });
  }
  if (!Array.isArray(cfg.containers) || !cfg.containers.length) {
    die("CONTAINER_UNDESCRIBED", `${member} is a container member and its wrangler.jsonc declares no \`containers\`.`,
      "Its Worker would deploy with no container behind its class. The member's own config states the container.");
  }
  if (multi) {
    const named = new Set(images.map((i) => i.class_name));
    const stray = cfg.containers.filter((c) => !c || !named.has(c.class_name)).map((c) => (c && c.class_name) || "(unnamed)");
    const bare = [...named].filter((n) => !cfg.containers.some((c) => c && c.class_name === n));
    if (stray.length || bare.length)
      die("CONTAINER_UNDESCRIBED",
        `${member}'s wrangler.jsonc \`containers\` and its marker's classes disagree`
        + `${stray.length ? `: the config names ${stray.join(", ")}, which the marker states no image for` : ""}`
        + `${bare.length ? `${stray.length ? ";" : ":"} the marker's ${bare.join(", ")} has no container in the config` : ""}.`,
        "Each class deploys behind its own container, named by its class_name in both files.");
  }
  for (const i of images) console.log(`image    : ${MULTI ? `${i.class_name} ` : ""}${i.reference}`);
}

/* PRE-FLIGHT: every service target must EXIST, checked before the upload rather
   than discovered as Cloudflare's 10143. This is D-292 turned from a note into a
   guard: the refusal names the missing worker and what to do, instead of a
   vendor error code the reader has to decode. */
const TOKEN = process.env.CF_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
if (!TOKEN) die("NO_TOKEN", "CF_TOKEN / CLOUDFLARE_API_TOKEN is not set.", "It lives in .env; do not print it.");

async function scriptExists(slug) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.account_id}/workers/scripts/${slug}/settings`,
    { headers: { authorization: `Bearer ${TOKEN}` } });
  if (r.status === 404) return false;
  if (!r.ok) throw new Error(`checking ${slug}: http ${r.status}`);
  return true;
}

for (const svc of cfg.services || []) {
  let ok;
  try { ok = await scriptExists(svc.service); }
  catch (e) { die("PREFLIGHT_UNREADABLE", `could not check whether "${svc.service}" exists.`, String(e.message)); }
  if (!ok) {
    die("BINDING_TARGET_MISSING",
      `binding ${svc.binding} points at "${svc.service}", which does not exist in this account.`,
      svc.service === instance
        ? `The instance "${instance}" is not deployed. Deploy the plane first —\n` +
          "a fleet member binds to a plane that is already there."
        : `That name was left as written because it is not the phantom "${PHANTOM}".\n` +
          "Either it is a typo, or that worker has to be deployed first.");
  }
  console.log(`preflight: ${svc.service} exists`);
}

/* R26: THE TOKEN MUST REACH CONTAINERS, asked of the account before anything is pulled, pushed or deployed. A deploy
   that found out at `wrangler containers push` would have half-applied nothing and said nothing useful; 0.80.0's
   cut met it as wrangler's bare "Authentication error" (K1705 (3)). */
if (CONTAINER) {
  const unreachable = (why) => die("CONTAINERS_UNREACHABLE",
    `the token cannot reach Containers in account ${cfg.account_id} (${why}).`,
    "The account's API token lacks Containers access: it needs the Containers edit permission\n"
    + "(`containers.write`) on this account, and the account needs Workers Paid. Nothing was pushed or deployed.");
  let r;
  try {
    r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.account_id}/containers/applications`,
      { headers: { authorization: `Bearer ${TOKEN}` } });
  } catch (e) { unreachable(`no answer: ${e.message}`); }
  if (!r.ok) unreachable(`http ${r.status}`);
  console.log(`preflight: Containers reachable in ${cfg.account_id}`);
}

/* R40: what this step deploys and where it can return to: the bytes now deployed under the member's name. */
if (TEST) {
  const name = cfg.name || member;
  const artifact = marker.bundle && marker.bundle.outfile;
  const artifactBytes = artifact && existsSync(join(memberDir, artifact)) ? readFileSync(join(memberDir, artifact)) : null;
  console.log(`test deploy: ${member} to ${instance} from ${artifact || "(no bundle)"} sha256 ${artifactBytes ? createHash("sha256").update(artifactBytes).digest("hex") : "(absent)"}`
    + " (a branch's built artifact: no release/ signature is read)");
  let was = null;
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.account_id}/workers/scripts/${name}`,
      { headers: { authorization: `Bearer ${TOKEN}`, accept: "application/javascript+module" } });
    if (r.ok) {
      const ct = r.headers.get("content-type") || "", body = Buffer.from(await r.arrayBuffer());
      let script = body;
      const mp = /multipart/i.test(ct) ? /boundary=(.+)$/i.exec(ct) : null;
      if (/multipart/i.test(ct)) {
        script = null;
        if (mp) {
          const part = body.toString("binary").split("--" + mp[1].replace(/"/g, "")).filter((p) => /\.mjs/.test(p))[0];
          if (part) script = Buffer.from(part.slice(part.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""), "binary");
        }
      }
      if (script) was = createHash("sha256").update(script).digest("hex");
    }
  } catch { /* unreadable is not a target */ }
  console.log(was
    ? `rollback : ${name} was ${was.slice(0, 16)}\u2026 \u2014 deploy those bytes again to return to it`
    : `rollback : ${name} is not deployed in ${cfg.account_id} (or is unreadable); delete the script to return to none`);
}

if (DRY) { console.log(`\n--dry-run: nothing was ${CONTAINER ? "pushed or " : ""}deployed.`); process.exit(0); }

/* Wrangler is a devDependency of `bio-plane` ONLY — no fleet member installs
   it, and none should: a second copy is a second version to drift. So the
   binary is resolved by PATH rather than by `npx`, which searches the CWD's
   own node_modules and fails from a member directory with
   "npx canceled due to missing packages" (measured 2026-09-10, this tool's
   first real run). The CWD still has to be the member's directory so wrangler
   resolves `main` and the module graph from there. */
const wrangler = join(ROOT, "bio-plane", "node_modules", ".bin", "wrangler");
const cfEnv = { ...process.env, CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: cfg.account_id };

/* R26: THE PROJECT'S OWN COPY OF THE IMAGE, pushed to Cloudflare's registry. The image is pulled BY DIGEST and tagged
   by its digest, so what is pushed is exactly the image the marker names and a re-run pushes the same tag. A failed
   step exits with its own status, and nothing is deployed after it. */
if (CONTAINER) {
  const pushedOf = new Map();
  for (const img of images) {
    const short = img.digest.slice("sha256:".length, "sha256:".length + 12);
    /* One class keeps the member's own name; several are told apart by class (a tag is lower case). */
    const tag = `${MULTI ? `${member}-${img.class_name.toLowerCase()}` : member}:${short}`;
    const steps = [
      ["docker", ["pull", img.reference], `pull ${img.reference}`],
      ["docker", ["tag", img.reference, tag], `tag it ${tag}`],
      [wrangler, ["containers", "push", tag], `push ${tag} to Cloudflare's registry`],
    ];
    for (const [cmd, args, what] of steps) {
      console.log(`\ncontainer: ${what}`);
      try { execFileSync(cmd, args, { cwd: memberDir, stdio: "inherit", env: cfEnv }); }
      catch (e) {
        console.error(`\ncontainer: ${what} FAILED: ${e.message}`);
        console.error("Nothing was deployed.");
        process.exit(Number.isInteger(e.status) && e.status !== 0 ? e.status : 1);
      }
    }
    pushedOf.set(img.class_name, `registry.cloudflare.com/${cfg.account_id}/${tag}`);
  }
  const only = images.length === 1 ? pushedOf.get(images[0].class_name) : null;
  cfg.containers = cfg.containers.map((c) => ({ ...c, image: MULTI ? pushedOf.get(c.class_name) : only }));
  for (const c of cfg.containers) console.log(`container: the generated config deploys ${MULTI ? `${c.class_name} ` : ""}${c.image}`);
}

/* The generated config is a TEMP FILE beside the member's own, so wrangler
   resolves `main` relative to the same directory. The tracked config is never
   written to — hardcoding the instance into it is the defect inverted. */
const genPath = join(memberDir, ".wrangler.deploy.generated.json");
let status = 1;   /* wrangler's own exit status on failure (R20), 1 when it gave none */
try {
  writeFileSync(genPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`\ngenerated: ${member}/.wrangler.deploy.generated.json (temporary)`);
  if (!existsSync(wrangler)) {
    throw new Error(`wrangler not found at ${wrangler} — run npm ci in bio-plane/ first ` +
      "(a fresh worktree has no node_modules; CLAUDE.md's measured trap).");
  }
  execFileSync(wrangler, ["deploy", "-c", genPath],
    { cwd: memberDir, stdio: "inherit", env: { ...process.env, CLOUDFLARE_API_TOKEN: TOKEN } });
  status = 0;
} catch (e) {
  if (Number.isInteger(e.status) && e.status !== 0) status = e.status;
  console.error(`\nwrangler deploy FAILED: ${e.message}`);
} finally {
  rmSync(genPath, { force: true });
  console.log("generated config removed");
}
if (status !== 0) process.exit(status);

/* A DEPLOY VERIFIED IS NOT A BUILD SERVING (CLAUDE.md, D-108). deploy.mjs waits
   for /version and so does this — the fleet members answer the same shape. */
async function subdomain() {
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.account_id}/workers/subdomain`,
      { headers: { authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.success ? j.result?.subdomain ?? null : null;
  } catch { return null; }
}

const want = String(cfg.vars?.VERSION ?? "");
const sub = await subdomain();
if (!sub || !want) {
  console.log("rollout: cannot confirm what is SERVING (no subdomain or no declared VERSION).");
  console.log("         The deploy reported success. Do not measure behaviour yet.");
  process.exit(0);
}
const url = `https://${member}.${sub}.workers.dev/version`;
const t0 = Date.now();
for (let attempt = 1; attempt <= 15; attempt++) {
  let seen = null;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) { const j = await r.json().catch(() => null); seen = j?.version ?? null; }
  } catch { /* mid-rollout a request can simply fail; that is not an answer */ }
  if (seen === want) {
    console.log(`rollout: ${member} serving ${want} after ${Math.round((Date.now() - t0) / 1000)}s`);
    process.exit(0);
  }
  if (attempt === 1) console.log(`rollout: serving ${seen ?? "(no answer)"}, waiting for ${want}…`);
  await new Promise((s) => setTimeout(s, 4000));
}
console.log(`\n  !! ROLLOUT NOT CONFIRMED after 60s: ${url} does not answer ${want}.`);
console.log("  !! The deploy succeeded; this is about which build is answering. Do not measure yet.");
process.exit(0);
