#!/usr/bin/env node
/* ONE version across the plane and every fleet member, and a refusal that names
 * the exact edit. DS-2 / D-116.
 *
 * ---- WHY THE FLEET NEEDS ONE VERSION AT ALL --------------------------------
 *
 * A release is now a SET of artifacts — the plane plus each member — carried by
 * one `RELEASE.json` under one `version`, and covered by one signature over a
 * statement that names all of them (D-297, `fleetStatement`). If members carried
 * their own version numbers, that single `version` field would be a claim about
 * nothing: a release stamped 0.57.0 could contain a member built as 0.1.0, and
 * the only honest thing to write in the manifest would be "several". So the
 * fleet shares the plane's version, and `bio-plane/package.json` is THE declared
 * authority — one source of truth, no second number to age separately, which is
 * D-106's rule applied across a directory boundary instead of within one.
 *
 * ---- WHAT WAS ACTUALLY WRONG, MEASURED 2026-09-11 --------------------------
 *
 *   bio-plane    package.json 0.56.0   wrangler VERSION 0.56.0
 *   pdf-worker   package.json 0.1.0    wrangler VERSION 0.1.0
 *   agent-worker package.json 0.1.0    wrangler VERSION 0.1.0
 *
 * Five of six sites disagreed with the authority and NOTHING refused, because
 * nothing had ever compared them: `deploy.mjs` takes the version as a positional
 * ARGUMENT, so the operator's typing has been the only thing deciding what a
 * deploy claims to be. `resolveVersion` did not exist — DS-2's own row names it
 * as though it did, which is the "a note is not an item" class this lane has now
 * hit three times (D-292, D-297, here).
 *
 * ---- BOTH DIRECTIONS, AND WHY THAT IS NOT PEDANTRY -------------------------
 *
 * The refusal fires when a member is BEHIND the authority and when it is AHEAD.
 * Behind is the ordinary staleness. Ahead is the dangerous one: it means someone
 * bumped a member alone, and a release cut then would ship an artifact claiming a
 * version the plane has never been built as — a number that will later be cut
 * properly and mean something else. A version is a promise about bytes
 * (release-assemble.mjs's VERSION_ALREADY_RELEASED), and two different byte sets
 * must never wear one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, discoverMembers, planeMember } from "./fleet-bundle.mjs";
import { parseJsonc } from "./jsonc.mjs";   /* N12: the product's own reader */

/* Discovery is fleet-bundle.mjs's (bundler R1) and is CONSUMED here, never
   re-implemented: a second walk could let the set this checks drift from the set
   that gets built and signed — which is the failure this file exists to make
   impossible one level up. */

/** Every place a version is declared, as {file, key, version}. */
export function versionSites(repoRoot = REPO_ROOT) {
  const sites = [];
  const add = (dir, name) => {
    const pkgPath = join(repoRoot, dir, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      sites.push({ file: `${dir}/package.json`, key: "version", version: pkg.version ?? null, member: name });
    } catch { /* a member without a package.json declares no version; not a site */ }
    const wPath = join(repoRoot, dir, "wrangler.jsonc");
    try {
      const w = parseJsonc(readFileSync(wPath, "utf8"), `${dir}/wrangler.jsonc`);
      const v = w?.vars?.VERSION;
      if (v !== undefined) sites.push({ file: `${dir}/wrangler.jsonc`, key: "vars.VERSION", version: v, member: name });
    } catch { /* no config, or unparseable — the build guard reports that, not this */ }
  };
  const plane = planeMember(repoRoot);
  add(plane.dir, plane.name);
  for (const m of discoverMembers(repoRoot)) add(m.dir, m.name);
  return sites;
}

/**
 * Resolve the fleet's one version.
 * Returns { ok: true, version, sites } when every site agrees with the
 * authority, or { ok: false, version, findings, sites } naming each
 * disagreement and the exact edit that fixes it. NEVER throws on skew — the
 * caller decides whether skew is fatal, and every caller so far says yes.
 */
export function resolveVersion(repoRoot = REPO_ROOT) {
  const sites = versionSites(repoRoot);
  const authority = sites.find((s) => s.file === "bio-plane/package.json");
  if (!authority || !authority.version) {
    return { ok: false, version: null, sites, findings: [
      "bio-plane/package.json declares no `version`, and it is THE authority. "
      + "Nothing else can be checked until it does."] };
  }
  const want = authority.version;
  const findings = [];
  for (const s of sites) {
    if (s.file === authority.file) continue;
    if (s.version === want) continue;
    findings.push(
      `${s.file} declares ${s.key} = ${JSON.stringify(s.version)}, but the authority `
      + `bio-plane/package.json declares ${JSON.stringify(want)}.\n`
      + `      EDIT: set ${s.key} in ${s.file} to "${want}".`);
  }
  return { ok: findings.length === 0, version: want, sites, findings };
}

/** The shape every caller wants: resolve, or print the refusal and exit 1. */
export function resolveVersionOrExit(repoRoot = REPO_ROOT, label = "version") {
  const r = resolveVersion(repoRoot);
  if (r.ok) return r.version;
  console.error(`REFUSED [VERSION_SKEW]: the fleet does not agree on one ${label}.`);
  console.error(`  authority: bio-plane/package.json = ${JSON.stringify(r.version)}`);
  for (const f of r.findings) console.error("  - " + f);
  console.error("  A release carries ONE version over a SET of artifacts. Two byte sets must");
  console.error("  never wear one number, and a member must not claim a version the plane has");
  console.error("  never been built as.");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = resolveVersion();
  for (const s of r.sites) {
    console.log(`  ${s.file.padEnd(32)} ${s.key.padEnd(12)} ${String(s.version)}`
      + (s.file === "bio-plane/package.json" ? "   <- authority" : ""));
  }
  if (r.ok) { console.log(`\nfleet version: ${r.version} — every site agrees`); process.exit(0); }
  console.log("");
  resolveVersionOrExit();
}
