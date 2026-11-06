#!/usr/bin/env node
/* release-gather.mjs: GATHER EVERY GUARDED BUNDLE'S BUILT OUTPUT INTO ONE DIRECTORY, FOR A DEVELOPMENT RELEASE'S
 * ASSEMBLE STEP (bundler R44).
 *
 * Each guarded bundle (R1's members with a Worker bundle, and the plane: today agent-runner, agent-worker, bio-plane,
 * file-scanner, ocr-worker, pdf-worker, reader-container and sheet-worker) has its built artifact and manifest in its
 * own `dist/`, and may declare upload parts (`bundle.assets`, a wasm or a model) beside it. A development release
 * wants them in one place. This command copies, for every guarded bundle, its artifact, its manifest and each declared
 * upload part into the one directory named on its command line, each under its own file name.
 *
 * THE INSTALLER'S BUNDLE RIDES TOO (the dist pass, BOB 6 Nov 2026). `newgroup/dist/newgroup.bundled.mjs` is no longer
 * committed, and it is what a manual install pastes (newgroup/DEPLOY.md), so where the repository has the installer
 * (`newgroup/package.json`) its built bundle is gathered beside the fleet's, under its own name, and its absence is
 * refused NO_ARTIFACT like any other. It is built by `npm --prefix newgroup run build` (the process builds it before
 * the assemble, as every untracked generated file); its freshness is installer R82's guard, not R6's, so the survey
 * below does not read it.
 *
 * IT SHIPS NOTHING STALE. Before anything is written it asks the fleet gate's own dependency-free freshness check
 * (`bundles.mjs`' `survey`, which is `fleet-bundle.mjs`' `verifyStatic`, R6) about every bundle, and refuses when any
 * artifact, manifest or part is missing or any is stale. It keeps no second copy of that check.
 *
 * IT FLATTENS, SO IT REFUSES A CLASH. Two files with one name (two members declaring `assets/model.bin`, say) would
 * leave one silently overwritten; that is refused, naming the name and both sources, before anything is written. A
 * directory that already holds files is refused too, so a gather never mixes with an earlier one.
 *
 * It writes only into the named directory, and nothing at all when it refuses. It does not rebuild: a stale bundle is
 * rebuilt by `node bio-plane/scripts/bundles.mjs` first.
 *
 * usage, from anywhere:
 *   node bio-plane/scripts/release-gather.mjs <out-dir>
 * exit 0 gathered; 1 refused (`REFUSED [CODE]: …` on stderr); 2 usage.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guardedBundles, survey, library } from "./bundles.mjs";

/** The files one guarded bundle contributes: its artifact, its manifest and each declared upload part, member-relative.
 *  `assetsOf` is the library's own reading of `bundle.assets` (loaded lazily, as bundles.mjs loads it). */
export const bundleFiles = (member, assetsOf) =>
  member.bundle ? [member.bundle.outfile, member.bundle.manifest, ...assetsOf(member)] : [];

/** The installer's built bundle, repository-relative: gathered when the repository has the installer. */
export const INSTALLER_BUNDLE = "newgroup/dist/newgroup.bundled.mjs";
const installerFile = (root) => existsSync(join(root, "newgroup/package.json")) ? join(root, INSTALLER_BUNDLE) : null;

/** What a gather would write: `{ ok: true, files: [{name, member, from}] }` or `{ ok: false, refused, findings }`.
 *  Reads only. */
export async function planGather({ repoRoot = null } = {}) {
  const members = await guardedBundles(repoRoot);
  const { assetsOf, REPO_ROOT } = await library();
  const installer = installerFile(repoRoot || REPO_ROOT);
  const findings = [];
  /* missing first: a missing file is named as missing, and the freshness check then says the same in its words */
  for (const m of members)
    for (const rel of bundleFiles(m, assetsOf))
      if (!existsSync(join(m.abs, rel))) findings.push(`${m.name}: ${m.dir}/${rel} is missing`);
  if (installer && !existsSync(installer))
    findings.push(`newgroup: ${INSTALLER_BUNDLE} is missing (built by \`npm --prefix newgroup run build\`)`);
  if (findings.length) return { ok: false, refused: "NO_ARTIFACT", findings };
  for (const r of await survey(members)) findings.push(...r.findings);
  if (findings.length) return { ok: false, refused: "STALE_ARTIFACT", findings };
  const byName = new Map();
  const files = [];
  for (const m of members)
    for (const rel of bundleFiles(m, assetsOf)) {
      const name = basename(rel), from = join(m.abs, rel);
      const was = byName.get(name);
      if (was) { findings.push(`${name}: both ${was.member}/${was.rel} and ${m.dir}/${rel}`); continue; }
      byName.set(name, { member: m.dir, rel });
      files.push({ name, member: m.name, from });
    }
  if (installer) {
    const name = basename(INSTALLER_BUNDLE), was = byName.get(name);
    if (was) findings.push(`${name}: both ${was.member}/${was.rel} and ${INSTALLER_BUNDLE}`);
    else files.push({ name, member: "newgroup", from: installer });
  }
  if (findings.length) return { ok: false, refused: "NAME_CLASH", findings };
  return { ok: true, files, members: members.map((m) => m.name), installer: !!installer };
}

/** Gathers into `out`. Returns the exit status. */
export async function gather(out, { repoRoot = null, log = console.log, err = console.error } = {}) {
  const refuse = (code, why, findings = []) => {
    err(`REFUSED [${code}]: ${why}`);
    for (const f of findings) err(`  - ${f}`);
    err("Nothing was written.");
    return 1;
  };
  const dest = resolve(out);
  if (existsSync(dest)) {
    if (!statSync(dest).isDirectory()) return refuse("OUT_NOT_A_DIRECTORY", `${dest} exists and is not a directory`);
    const held = readdirSync(dest);
    if (held.length) return refuse("OUT_NOT_EMPTY", `${dest} already holds ${held.length} file(s), e.g. ${held[0]}`);
  }
  const plan = await planGather({ repoRoot });
  if (!plan.ok) {
    const why = { NO_ARTIFACT: "a guarded bundle's built output is missing",
      STALE_ARTIFACT: "a guarded bundle is stale; run `node bio-plane/scripts/bundles.mjs` to rebuild it",
      NAME_CLASH: "two files would be gathered under one name" }[plan.refused];
    return refuse(plan.refused, why, plan.findings);
  }
  mkdirSync(dest, { recursive: true });
  for (const f of plan.files) {
    copyFileSync(f.from, join(dest, f.name));
    log(`gathered: ${f.member} ${f.name}`);
  }
  log(`release-gather: ${plan.files.length} file(s) of ${plan.members.length} guarded bundle(s) (${plan.members.join(", ")})`
    + `${plan.installer ? " and the installer's bundle" : ""} into ${dest}`);
  return 0;
}

const INVOKED = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (INVOKED) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith("-")) {
    console.error("usage: node bio-plane/scripts/release-gather.mjs <out-dir>");
    process.exit(2);
  }
  process.exit(await gather(args[0]));
}
