#!/usr/bin/env node
/* bundles.mjs — BUILD EVERY BUNDLE AFRESH FROM THE CHECKOUT, AND SAY WHAT IT BUILT (release R21, R46).
 *
 * No bundle is committed (ARCH's decision "Committed built files", 22 Nov 2026). Whatever needs one — a test, a
 * deployment, a release — builds it from the checkout first, and this command is how: it builds the plane and every
 * guarded fleet member into its own `dist/`, by the member's OWN build (`npm run build` in its directory, which runs
 * its `scripts/build.mjs` and any pre-step, as `ocr-worker`'s regenerates `src/tesslib.mjs`), and then holds what that
 * build wrote to the fleet guard: the inputs its manifest records are the tree's, the artifact imports nothing a
 * one-part upload cannot resolve, and a second build of the same checkout gives the same bytes. It never reads,
 * compares with or copies a bundle that was there before: the artifact and manifest are removed before each build, so
 * nothing earlier can be taken for this build's output.
 *
 * The set is DERIVED, never listed here: `discoverMembers` (bundler R1) for the fleet, by each member's own
 * `fleet-member.json`, and `planeMember` for the plane, which has no marker and is the one entry named.
 *
 * From the repository root (bundler R21; moved from the old process's `tools/` in T19):
 *   node bio-plane/scripts/bundles.mjs              build every bundle into its dist/ and check each; 0 all good, 1 any not
 *   node bio-plane/scripts/bundles.mjs --check      build every bundle in memory and check each; writes nothing; 0 / 1
 *   node bio-plane/scripts/bundles.mjs --install-dirs
 *                    print, one per line, each directory whose `npm ci` the byte guard needs, the plane's first
 *                    (run after the plane's own `npm ci`): the release-sign workflow's install list (R30, R22)
 *   node bio-plane/scripts/bundles.mjs --containers
 *                    list each container member's classes whose image is not provably built from the code now in the
 *                    tree (R37), as `STALE <member> <class>` (or UNRECORDED, UNREAD); writes nothing; 0 none, 1 any.
 *                    The release workflow builds exactly these images (R36)
 *   node bio-plane/scripts/bundles.mjs --record-image <member> <class> <digest>
 *                    R36's recording half, run by the workflow after it has built and pushed the image: writes the
 *                    digest the build produced and the files it was built from into the member's fleet-member.json,
 *                    and the digest into the image its wrangler.jsonc container block names, both or neither
 *
 * HOW THE IMAGE BUILD AND THIS MODULE MEET (R36, R37; rulings-active §4, K1898). The image is built by the GitHub
 * workflow `container-images.yml`, never in a session or by this module. The workflow asks `--containers` which images
 * the code has outrun, builds and pushes those, and gives each class's digest to `--record-image`; the release
 * assembly (`release-assemble.mjs`) then refuses `[CONTAINER_IMAGE_STALE]` for any class still outrun.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
/** @import { Member, Manifest, Bytes, Built } from "./fleet-bundle.mjs" */

/**
 * What a member's own build wrote: the artifact and its manifest, or why there are none.
 * @typedef {{ok: true, artifact: Bytes, manifest: Manifest, sha256: string, code?: undefined, why?: undefined}
 *   | {ok: false, code: "BUILD_FAILED"|"NO_ARTIFACT"|"NO_MANIFEST", why: string, artifact?: undefined, manifest?: undefined, sha256?: undefined}} FreshBuild
 * @bound sha256: 64 lower-case hex, the artifact's
 */
/** @typedef {(line: string) => void} Log */

/* The library needs `esbuild` from `bio-plane/node_modules` (its header says
   why), so it is imported LAZILY and its absence is NAMED: a fresh checkout
   with no install would otherwise fail here with a bare ERR_MODULE_NOT_FOUND for
   a package the reader never asked for. */
/**
 * @returns {Promise<typeof import("./fleet-bundle.mjs")>}
 * @throws {Error} naming the missing install when the library cannot be loaded
 */
export async function library() {
  try {
    return await import("./fleet-bundle.mjs");
  } catch (e) {
    const err = new Error(
      "bundles: the fleet bundle library could not be loaded — " + e.message
      + "\nbundles: it resolves `esbuild` from bio-plane/node_modules. Run `npm ci` in bio-plane/.");
    err.cause = e;
    throw err;
  }
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const readOrNull = (p) => { try { return readFileSync(p); } catch { return null; } };

/** Every guarded bundle, the plane included.
 *
 *  `plane` is a PARAMETER rather than a probe for the plane's files, because a
 *  probe would drop the plane SILENTLY on the day its entry moved. The CLI always
 *  passes `true`; only a suite driving a synthetic repository root passes `false`.
 * @param {string|null} repoRoot absent is the repository's own root
 * @param {{plane?: boolean}} [options]
 * @returns {Promise<Member[]>} sorted by name
 */
export async function guardedBundles(repoRoot, { plane = true } = {}) {
  const lib = await library();
  const root = repoRoot || lib.REPO_ROOT;
  /* A container member with no Worker bundle (R24) has no bundle to build; `run` names it as listed, not guarded. */
  const all = [...lib.discoverMembers(root).filter(lib.isGuarded), ...(plane ? [lib.planeMember(root)] : [])];
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The members discovery lists that the bundle guard does not cover (R24).
 * @param {string|null} repoRoot absent is the repository's own root
 * @returns {Promise<Member[]>}
 */
export async function unguardedMembers(repoRoot) {
  const lib = await library();
  return lib.discoverMembers(repoRoot || lib.REPO_ROOT).filter((m) => !lib.isGuarded(m));
}

/**
 * R46: build one bundle afresh into its member's `dist/` by the member's own `npm run build`, after removing the
 * artifact and manifest a build writes, and read back what this build wrote. Its exit status and output are the
 * process's own (a `&&` chain reports the wrapper's status, which is how a killed run reads green).
 * @param {Member} member
 * @param {{log?: Log}} [options]
 * @returns {FreshBuild}
 */
export function buildFresh(member, { log = () => {} } = {}) {
  const b = member.bundle;
  if (!b) return { ok: false, code: "NO_ARTIFACT", why: "declares no `bundle` block, so it has no build of its own" };
  const artifactPath = join(member.abs, b.outfile), manifestPath = join(member.abs, b.manifest);
  rmSync(artifactPath, { force: true });
  rmSync(manifestPath, { force: true });
  const r = spawnSync("npm", ["run", "build"], { cwd: member.abs, encoding: "utf8" });
  const out = [r.stdout || "", r.stderr || ""].join("").trimEnd();
  if (out) for (const line of out.split("\n")) log(`         | ${line}`);
  if (r.status !== 0)
    return { ok: false, code: "BUILD_FAILED", why: `its build (npm run build in ${member.dir}/) exited ${r.status}`
      + `${r.error ? ` (${r.error.message})` : ""}${out ? `: ${out.split("\n").slice(-3).join(" / ")}` : ""}` };
  const artifact = readOrNull(artifactPath);
  if (!artifact) return { ok: false, code: "NO_ARTIFACT", why: `its build exited 0 and wrote no ${b.outfile}` };
  const manifest = readOrNull(manifestPath);
  if (!manifest) return { ok: false, code: "NO_MANIFEST", why: `its build exited 0 and wrote no ${b.manifest}` };
  return { ok: true, artifact, manifest: JSON.parse(manifest.toString("utf8")), sha256: sha(artifact) };
}

/**
 * The fleet guard over a build just written: bundler's `verifyStatic` over the files it wrote (its inputs are the
 * tree's, it is installable, its manifest agrees with it), then a second build of the same checkout, in memory, that
 * must give the same bytes (`verifyFresh`). Never writes.
 * @param {Member} member
 * @param {Bytes} artifact the bytes the member's build wrote
 * @returns {Promise<{findings: string[], built: Built|null, unchecked: string|null}>}
 */
export async function checkBuilt(member, artifact) {
  const lib = await library();
  const findings = [...lib.verifyStatic(member).findings];
  const fresh = await lib.verifyFresh(member, artifact);
  if (!fresh.checked) return { findings, built: null, unchecked: fresh.reason };
  return { findings: [...findings, ...fresh.findings.filter((f) => !findings.includes(f))], built: fresh.built, unchecked: null };
}

/**
 * R21, R46: build every guarded bundle afresh and check each. With `check`, each is built in memory only and nothing
 * is written; otherwise each is built into its `dist/` by its own build and that build is checked.
 * @param {{repoRoot?: string|null, check?: boolean, plane?: boolean, log?: Log}} [options]
 * @returns {Promise<0|1>} 0 when every bundle built and passed, 1 otherwise
 */
export async function run({ repoRoot = null, check = false, plane = true, log = console.log } = {}) {
  const lib = await library();
  const members = await guardedBundles(repoRoot, { plane });
  log(`bundles: ${members.length} guarded bundle(s) — ${members.map((m) => m.name).join(", ")}`);
  const listed = await unguardedMembers(repoRoot);
  if (listed.length)
    log(`bundles: ${listed.length} container member(s) listed, not bundle-guarded (no Worker bundle) — `
      + listed.map((m) => m.name).join(", "));

  /** @type {{name: string, why: string}[]} */
  const bad = [];
  for (const m of members) {
    if (!m.bundle) { bad.push({ name: m.name, why: "declares no `bundle` block, so it has no build of its own" }); continue; }
    if (check) {
      /* In memory: the same recipe the member's build runs, with nothing written. */
      let built;
      try { built = await lib.buildMember(m); }
      catch (e) { bad.push({ name: m.name, why: `it does not build: ${String(e instanceof Error ? e.message : e).split("\n")[0]}` }); continue; }
      const unresolved = lib.unresolvableSpecifiers(built.bytes.toString("utf8"), m.bundle.external || lib.DEFAULT_EXTERNAL);
      if (unresolved.length) { bad.push({ name: m.name, why: `its build imports ${unresolved.join(", ")}, which a one-part upload cannot resolve` }); continue; }
      log(`bundles: ${m.name} — builds ${built.bytes.length} B, sha256 ${built.sha256} (in memory; nothing written)`);
      continue;
    }
    log(`bundles: building ${m.name} (npm run build in ${m.dir}/)`);
    const res = buildFresh(m, { log });
    if (!res.ok) { bad.push({ name: m.name, why: res.why }); continue; }
    const { findings, unchecked } = await checkBuilt(m, res.artifact);
    if (unchecked) { bad.push({ name: m.name, why: `a second build could not run to check it: ${unchecked}` }); continue; }
    for (const f of findings) log(`         ! ${f}`);
    if (findings.length) { bad.push({ name: m.name, why: `${findings.length} finding(s) above` }); continue; }
    log(`bundles: ${m.name} — BUILT ${m.bundle.outfile} ${res.artifact.length} B, sha256 ${res.sha256}; a second build gives the same bytes`);
  }
  log(`bundles: ${members.length - bad.length} of ${members.length} built${check ? " in memory" : ""} and checked`
    + (bad.length ? `; ${bad.length} NOT (${bad.map((x) => `${x.name}: ${x.why}`).join("; ")})` : ""));
  return bad.length ? 1 : 0;
}

/** R30's second step: the directories, besides the plane's, a checkout must `npm ci` in before a release can be
 *  assembled — each guarded bundle's member that has a `package-lock.json` (its vendored inputs are what the byte
 *  guard rebuilds from), repository-relative, the plane first, then in discovery's order. Derived from discovery
 *  (R1), never listed by hand in the workflow. The library needs the plane's own install (esbuild), so the plane's
 *  `npm ci` comes first.
 * @param {string|null} [repoRoot] absent is the repository's own root
 * @returns {Promise<string[]>} repository-relative directories, `bio-plane` first
 */
export async function installDirs(repoRoot = null) {
  const lib = await library();
  const root = repoRoot || lib.REPO_ROOT;
  return ["bio-plane", ...lib.discoverMembers(root).filter((m) => m.bundle && existsSync(join(m.abs, "package-lock.json")))
    .map((m) => m.dir)];
}

/** R37: the state of every container member's classes, one line each for those not current, and the exit status:
 *  0 when every image is provably built from the code now in the tree, 1 otherwise. Writes nothing.
 * @param {{repoRoot?: string|null, log?: Log}} [options]
 * @returns {Promise<0|1>}
 */
export async function containerImages({ repoRoot = null, log = console.log } = {}) {
  const lib = await library();
  let bad = 0, classes = 0;
  for (const m of lib.discoverMembers(repoRoot || lib.REPO_ROOT).filter((x) => lib.isContainer(x))) {
    for (const st of lib.containerImageStates(m)) {
      classes++;
      if (st.state === "current") continue;
      bad++;
      log(`${st.state.toUpperCase()} ${m.name} ${st.class_name} — ${st.why}`);
    }
  }
  log(`containers: ${classes - bad} of ${classes} image(s) provably built from the code now in the tree`);
  return bad ? 1 : 0;
}

/** R36: record the digest the workflow's build produced for one class. Returns the exit status; a refusal prints
 *  `REFUSED [CODE]: …` and writes nothing.
 * @param {string} memberName
 * @param {string} className
 * @param {string} digest `sha256:<64 hex>`
 * @param {{repoRoot?: string|null, log?: Log, err?: Log}} [options]
 * @returns {Promise<0|1>}
 */
export async function recordImage(memberName, className, digest, { repoRoot = null, log = console.log, err = console.error } = {}) {
  const lib = await library();
  const member = lib.discoverMembers(repoRoot || lib.REPO_ROOT).find((m) => m.name === memberName);
  const r = member ? lib.recordContainerDigest(member, className, digest)
    : { refused: "CONTAINER_UNDESCRIBED", message: `${JSON.stringify(memberName)} is not a fleet member` };
  if (r.refused || !r.files) { err(`REFUSED [${r.refused}]: ${r.message}`); return 1; }
  log(`recorded: ${memberName} ${className} ${digest} — ${r.files.join(", ")}`);
  return 0;
}

/* Run as a command, never when IMPORTED — compared as RESOLVED PATHS rather than
   by a filename suffix, which an importing test file (`bundles.test.mjs`, retired)
   satisfied on some spellings, and which is how a module that exits the importing
   process gets written. */
const INVOKED = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (INVOKED && process.argv.includes("--install-dirs")) {
  for (const d of await installDirs()) console.log(d);
  process.exit(0);
}
if (INVOKED && process.argv.includes("--containers")) process.exit(await containerImages());
if (INVOKED && process.argv.includes("--record-image")) {
  const [member, cls, digest] = process.argv.slice(process.argv.indexOf("--record-image") + 1);
  process.exit(await recordImage(member, cls, digest));
}
if (INVOKED) {
  const check = process.argv.includes("--check");
  process.exit(await run({ check }));
}
