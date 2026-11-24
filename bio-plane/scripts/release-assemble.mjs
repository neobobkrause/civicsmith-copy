#!/usr/bin/env node
/* Assemble a release that carries the WHOLE FLEET, and refuse to assemble one
 * that cannot be believed.
 *
 * ---- WHAT THIS EXISTS TO PREVENT, MEASURED ---------------------------------
 *
 * `release/RELEASE.json` carried ONE asset (the plane) with one sha256 and one
 * signature, and `newgroup` installs only what the release names — so a group
 * got a plane and no fleet, which is D-115's "an instance quietly doing less".
 * The obvious fix is a `fleet` array. On 2026-09-10 that obvious fix was
 * measured and IT WOULD HAVE SHIPPED A LIE:
 *
 *   the released plane asset was cut 2026-08-05 (da67aa4d…)
 *   bio-plane/src had moved 114 commits / +19,027 lines since
 *   THREE of pdf-worker's six build inputs LIVE IN bio-plane/src (FL-9's finding)
 *   all three hashed EQUAL to the tree, so the member bundle was fresh
 *
 * A `fleet` array added then would have published, inside ONE signed release,
 * `pdfstructure.mjs` as of today (inside pdf-worker) and as of a month earlier
 * (inside the plane). One release, two versions of the same source, one
 * signature over all of it. That is D-298, and it is the reason this file is a
 * gate and not a serialiser.
 *
 * ---- THE THREE REFUSALS ----------------------------------------------------
 *
 *  1. EVERY ASSET IS PROVED FRESH, by FL-9/FL-10's guard rather than by a
 *     second implementation of it (D-112: one path, no drift). `verifyFresh`
 *     builds each member from source with write:false and byte-compares against
 *     the artifact read from disk BEFORE the build. A stale artifact REFUSES.
 *     It also answers, from the build's own metafile, whether the output still
 *     imports anything a one-part script upload cannot resolve — which is
 *     precisely the installer's constraint, so the guard that protects the
 *     repository is the same one that protects the install.
 *
 *  2. THE SIGNATURE COVERS THE SET, NOT EACH FILE. One signature per asset
 *     would let anyone who can serve the manifest DROP a member: every
 *     remaining signature still verifies, and the installer silently installs
 *     less. So `fleetSig` signs a canonical payload naming the plane AND every
 *     member together. Removing a member, swapping one, or pairing this fleet
 *     with a different plane all invalidate it.
 *
 *  3. THE PLANE LINE IS IN THAT PAYLOAD ON PURPOSE. It is what makes the
 *     signature say "these members were built against THIS plane", which is the
 *     exact claim D-298 found unbacked.
 *
 * ---- BACKWARD COMPATIBILITY, AND WHY IT IS ADDITIVE ------------------------
 *
 * `version`, `sha256`, `asset`, `sig` and `signer` KEEP their present meaning:
 * `sig` is still an SSHSIG over the PLANE ASSET BYTES in namespace
 * `bio-release`. Every installer already deployed keeps working unchanged. The
 * fleet arrives as two NEW keys (`fleet`, `fleetSig`) that an older installer
 * ignores. Re-pointing `sig` at a combined manifest was the tidier design and
 * was rejected: it would make every installed copy fail verification and fall
 * back to its built-in release — safe, but it freezes every existing install
 * silently, and silence is the failure mode this project keeps paying for.
 *
 * An installer that finds NO `fleet` key installs the plane and MUST SAY SO
 * (D-106's class). It must never treat absence as "no members exist".
 *
 * NEGATIVE CONTROL: RUN 2026-09-10, five arms, every refusal DRIVEN rather than
 * described, and every on-disk arm restored BYTE-IDENTICALLY (verified by hash
 * after each) —
 *   (a) GUARD_CANNOT_RUN — with pdf-worker/node_modules absent, the byte arm
 *       cannot run and assembly REFUSES rather than skipping the guard on an
 *       artifact it is about to sign. Found on this tool's first run, not
 *       contrived.
 *   (b) STALE_OR_UNINSTALLABLE — 13 bytes appended to the committed
 *       agent-worker artifact; refused, naming both hashes and both lengths
 *       (48,405 committed vs 48,392 fresh) and the command that fixes it.
 *   (c) VERSION_DISAGREES — `--version 0.57.0` against sources reading 0.56.0
 *       is refused, so the flag cannot fake a bump the tree has not made.
 *   (d) VERSION_ALREADY_RELEASED — the live state of this tree: every source
 *       reads 0.56.0 while the plane artifact is FL-10's rebuild, so assembly
 *       refuses to publish a second, different 0.56.0. THIS ARM WROTE THE
 *       REFUSAL: the check did not exist until the first dry-run reported
 *       "a release cut now would carry 3 assets at 0.56.0" and that sentence
 *       was false in a way no other check could see.
 *   (e) PLANE_SIG_DOES_NOT_COVER_ASSET — sources temporarily bumped to 0.57.0
 *       to get past (d), then assembled without --sign: stock ssh-keygen says
 *       "Signature verification failed: incorrect signature" and assembly
 *       refuses. This one was a printed NOTE first, which is not a gate.
 *   FLEET_SIG_REJECTED is the same `verifyWith` call as (e) with a different
 *   namespace and payload, and is NOT separately driven — stated rather than
 *   claimed.
 * NEGATIVE CONTROL, SECOND PASS: RUN 2026-09-12, when `ocr-worker` arrived with
 * upload parts (CPDF-10 / IC-78) — (g) MEMBER_PART_MISSING, the declared
 * `assets/eng.traineddata` moved aside: refused, because releasing without a
 * declared part publishes a member that cannot run while the manifest says it
 * is complete; (h) MEMBER_PART_DISAGREES, one byte appended to that model:
 * refused, naming both hashes — the engine or model changing underneath a
 * member is staleness exactly as a changed source is, and CPDF-15's measured
 * fidelity is a fidelity of THOSE EXACT BYTES. Both restored byte-identically,
 * verified by hash. MEMBER_PART_UNHASHED (a manifest with no hash for a
 * declared part) is NOT driven — it requires hand-editing a generated manifest,
 * and it is stated rather than claimed.
 *
 * ---- ASSEMBLED APART FROM SIGNED (bundler R30; T36-2, K1936 Q4 step 2, N713) ----------
 *
 * A session ASSEMBLES and never signs: every check above runs, and what is to be signed (the plane asset and the
 * fleet payload) is written out, with no seed anywhere near it. Signing runs in ONE place, the repository's GitHub
 * Actions environment that holds `BIO_RELEASE_SEED` as its secret and waits for Bob, its required reviewer: one
 * approval signs one release. So `--sign` refuses `[NOT_SIGNING_ENVIRONMENT]` anywhere but a GitHub Actions run,
 * BEFORE it reads the seed — no command a session runs reads it — and the release is completed from the
 * signatures only when stock `ssh-keygen` accepts each (R23). The workflow (`.github/workflows/release-sign.yml`) is
 * BOB's; the commands it calls, in order, from the repository root of the commit being released:
 *
 *   1. npm ci                                                  (in bio-plane/: the library's esbuild)
 *   2. node bio-plane/scripts/bundles.mjs --install-dirs
 *        the directories the byte guard needs installed, one per line, the plane's first (R22)
 *      npm ci                                                  (in each directory it printed after the plane's)
 *   3. node bio-plane/scripts/release-assemble.mjs --version <V> --dry-run
 *        every R22 check; writes nothing; no seed
 *   4. node bio-plane/scripts/release-assemble.mjs --version <V> --sign
 *        in the environment holding BIO_RELEASE_SEED: re-runs every check on this commit, takes the release's
 *        signer from the seed's own key (refusing SIGNER_DISAGREES when RELEASE.json names another), signs the plane
 *        asset (bio-release), the payload (bio-release-fleet) and the release notice (bio-release-notice, R32),
 *        refuses unless stock ssh-keygen accepts all three for that signer, and only then writes `release/`, the
 *        notice `release/NOTICE.json` beside the assets
 *   5. node bio-plane/scripts/release-advisories.mjs --out <file>
 *        R29's report over what the release ships, for the operator (it refuses nothing)
 *
 * Signatures made elsewhere complete a release the same way, without the seed:
 *   node bio-plane/scripts/release-assemble.mjs --version <V> --fleet-sig <file> --plane-sig <file> --notice-sig <file>
 *
 * Every run reads the release's notes from `release/notes/<V>.json`, `{date, security, notes: {members,
 * administrators, must_do}}`, and refuses NO_NOTES or NOTES_UNREADABLE before anything is written (R32).
 *
 * usage (bundler R22, R23, R30, R32; moved from the old process's `tools/` in T19), from the repository root:
 *   node bio-plane/scripts/release-assemble.mjs --dry-run
 *   node bio-plane/scripts/release-assemble.mjs --version 0.57.0 --emit-payload <file> [--emit-plane <file>] [--emit-notice <file>]
 *   node bio-plane/scripts/release-assemble.mjs --version 0.57.0 --sign          (GitHub Actions only, R30)
 *   node bio-plane/scripts/release-assemble.mjs --version 0.57.0 --fleet-sig <file> [--plane-sig <file>] --notice-sig <file>
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import {
  REPO_ROOT, discoverMembers, planeMember, verifyFresh, freshBuildRunnable, sha256, isContainer, containerParts,
  workerPart, WORKER_PART_PATH, containerImageFindings, bundleExports, bindingFindings,
} from "./fleet-bundle.mjs";
/* The statement and its namespace come from the module the INSTALLER also
   imports. Neither side builds the bytes it signs or verifies — see the comment
   on `fleetStatement`. This file defined its own copy for exactly one commit. */
import { NS_FLEET, fleetStatement, NS_RELEASE_NOTICE, releaseNoticeStatement } from "../src/sshsig.mjs";
import { parseJsonc } from "./jsonc.mjs";
import { resolveVersion } from "./resolve-version.mjs";
import { signSshsig, signerPublicLine } from "./sign-sshsig.mjs";   /* signatures' release signer (its R33, R35) */

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i === -1 ? null : (argv[i + 1] ?? ""); };
const DRY = argv.includes("--dry-run");
const SIGN = argv.includes("--sign");
const EMIT = flag("--emit-payload");
const EMIT_PLANE = flag("--emit-plane");
const EMIT_NOTICE = flag("--emit-notice");

const RELEASE_DIR = join(REPO_ROOT, "release");
const RELEASE_JSON = join(RELEASE_DIR, "RELEASE.json");
const NOTICE_JSON = join(RELEASE_DIR, "NOTICE.json");

const die = (code, msg, detail) => {
  console.error(`REFUSED [${code}]: ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
};

/* R30: SIGNING HAPPENS IN THE SIGNING ENVIRONMENT ONLY, and this is checked before anything else, the seed
   included: a session that passes `--sign` is refused without the seed ever being read. */
if (SIGN && process.env.GITHUB_ACTIONS !== "true")
  die("NOT_SIGNING_ENVIRONMENT", "--sign runs only in the repository's GitHub Actions signing environment (bundler R30).",
    "Sessions assemble and never sign. Assemble with --dry-run or --emit-payload; the release-sign workflow signs,\n"
    + "on Bob's approval, with the seed it alone holds. Signatures made there complete a release with\n"
    + "--fleet-sig <file> --plane-sig <file> --notice-sig <file>. BIO_RELEASE_SEED was not read.");

/* ---------------------------------------------------------------- the assets */

const plane = planeMember();
const discovered = discoverMembers();

/* EVERY DISCOVERED MEMBER IS RELEASED OR REFUSED, NEVER SKIPPED. This filtered to
   members with a `bundle` until T34, so a member whose block was deleted dropped
   out of a signed release in silence — D-115's "an instance quietly doing less",
   one step before the installer. */
for (const m of discovered) {
  if (!m.bundle && !isContainer(m))
    die("NO_ARTIFACT", `${m.name} is a fleet member and declares no \`bundle\` block, so it has no artifact to release.`,
      "Every member a release names ships a guarded bundle. Restore the member's `bundle` block, rebuild, and commit.");
}

/* ---- A CONTAINER MEMBER'S DESCRIPTOR (R25, R27; N610, K1678 (1), K1730, K1881) ----
   The member's Worker bundle is its asset, like any member's; its `container.json`
   is one more part, so the fleet signature covers the image digest exactly as it
   covers every other part's bytes. Checked HERE, before any build runs or anything
   is written: a descriptor the marker cannot state is a release that cannot install
   its container. A member with more than one class (`file-scanner`'s `FileScanner`
   and `SafeViewRenderer`, T36-2) carries one part per class, `container/<class>.json`.

   A CONTAINER MEMBER WITH NO WORKER BUNDLE IS LEFT OUT, BY NAME (K1730), as 0.80.0
   left agent-runner out (K1705): there is no Worker to host its class, so no
   installer could run it, and the fleet signature covers only what ships. It is
   printed, never dropped in silence, and it is the only member a release may omit. */
const leftOut = discovered.filter((m) => isContainer(m) && !m.bundle);
for (const m of leftOut)
  console.log(`left out: ${m.name} — a container member with no Worker bundle to host its class (bundler R24, K1730); `
    + "the release and its fleet signature do not carry it");
const containerPartsOf = new Map();
const carried = discovered.filter((x) => !leftOut.includes(x)).map((x) => x.name);
for (const m of discovered.filter((x) => isContainer(x) && x.bundle)) {
  /* R25 for every class first, then R27: a descriptor the marker cannot state is refused before any package is read. */
  const d = containerParts(m, carried, { packages: false });
  if (d.missing) {
    die("CONTAINER_UNDESCRIBED",
      `${m.name} is a container member and its fleet-member.json does not state`
        + `${d.class ? `, for its class ${d.class},` : ""} ${d.missing.join(", ")}.`,
      "The release copies the container's descriptor from the member's own marker and never defaults it:\n"
      + "  image          { repository, digest: \"sha256:<64 hex>\" } — the digest the release wrote when it published the image\n"
      + "  class_name     the Durable Object class the container runs behind\n"
      + "  max_instances  a positive integer\n"
      + "  bind           [{ member, binding }] — each a member this release carries, and the binding it calls the class by\n"
      + "  image.schedulingPolicy, where stated, \"default\"\n"
      + "A member with several classes states them as `containers: [{ class_name, image, max_instances?, bind? }]`, each\n"
      + "class's max_instances and bind read from the class, else from the member's top level.");
  }
  /* R37 (N1210, K3674): the digest the part will carry must be the one built from the code now in the tree. A class whose
     files differ from what its recorded digest was built from is refused here, naming it, before anything is built or
     written; so is a class that records nothing it was built from, which no comparison can clear. */
  const imageFindings = containerImageFindings(m);
  if (imageFindings.length)
    die("CONTAINER_IMAGE_STALE",
      `${m.name} is a container member and the code of its image changed under an unchanged digest.`,
      imageFindings.map((f) => `  - ${f.text}`).join("\n") + "\n"
      + "The release builds the image of a changed container member in the GitHub workflow and records the digest it\n"
      + "produced with `node bio-plane/scripts/bundles.mjs --record-image <member> <class> <digest>` (R36), which writes\n"
      + "the marker's digest and the files it was built from, and the container's image in the member's wrangler.jsonc.\n"
      + "`node bio-plane/scripts/bundles.mjs --containers` lists the classes that need it.");
  /* R27 (F20): each image's packages — npm's from the lockfile its `npm ci --omit=dev` installs from, or a system
     image's from the member's committed package statement pinned with its base digest — so the fleet signature states
     what each image runs without building it. Unread is a refusal, never an empty list. */
  const full = containerParts(m, carried);
  if (full.unread)
    die("CONTAINER_PACKAGES_UNREAD", `${m.name} is a container member and ${full.unread}.`,
      "The release lists every package each of the member's images installs: from the member's own package-lock.json\n"
      + "(its packages not marked dev), or, for an image whose packages are not npm's, from the package statement its\n"
      + "class names (`image.packages`), taken against the base digest the marker pins (`image.base.digest`).\n"
      + "Restore or regenerate the file (`npm install --package-lock-only`, or the statement from the pinned base), then assemble again.");
  containerPartsOf.set(m.name, full.parts.map((p) => ({ path: p.path, type: "Container", sha256: sha256(p.bytes),
    bytes: p.bytes.length, data: p.bytes })));
}

const members = discovered.filter((m) => !leftOut.includes(m));
const all = [plane, ...members];

/* ---- A MEMBER'S BUCKETS AND SCHEDULE (R25; N772, K2155) ---------------------
   A member whose own config binds an R2 bucket or states a cron carries one `Worker` part, `worker.json`, so the
   fleet signature covers what an installer must bind and schedule for it. Checked HERE, before any build runs or
   anything is written, like a container's descriptor: a bucket with no role the installer can bind is a release that
   cannot install that member whole. */
const workerPartOf = new Map();
for (const m of members) {
  const wpath = join(m.abs, "wrangler.jsonc");
  if (!existsSync(wpath)) continue;              /* no config: MEMBER_COMPAT_UNSTATED names it below */
  const w = workerPart(parseJsonc(readFileSync(wpath, "utf8"), `${m.name}/wrangler.jsonc`));
  if (w.missing)
    die("WORKER_UNDESCRIBED",
      `${m.name}'s wrangler.jsonc does not state, as the release's Worker part needs, ${w.missing.join(", ")}.`,
      "The release copies a member's buckets and schedule from its own config and never defaults them:\n"
      + "  r2_buckets     [{ binding, bucket_name }] — each bucket one of the plane's own, named by its role in the part:\n"
      + "                 bio-captures (captures) or bio-published (published); any other has no role an installer can bind\n"
      + "  triggers.crons a list of cron expressions, where the member states a schedule\n"
      + "  durable_objects, migrations  its own Durable Objects ({name, class_name}) and migrations ({tag, new_sqlite_classes}), as its config states them");
  if (w.part) workerPartOf.set(m.name, { path: WORKER_PART_PATH, type: "Worker", sha256: sha256(w.part.bytes),
    bytes: w.part.bytes.length, data: w.part.bytes });
}

function committedArtifact(m) {
  const p = join(m.abs, m.bundle.outfile);
  /* The fleet's one rebuild command (N31, bundler R21), as every staleness finding names it: it builds
     each member by its own `npm run build`, pre-steps included, and says which it rebuilt. */
  if (!existsSync(p)) die("NO_ARTIFACT", `${m.name} has no committed ${m.bundle.outfile}.`,
    "Run `node bio-plane/scripts/bundles.mjs` from the repository root, and commit the artifacts.");
  return readFileSync(p);                      // read BEFORE any build runs
}

console.log("assets discovered:");
for (const m of all) console.log(`   ${m.name.padEnd(14)} ${m.bundle.outfile}`);

/* ---- REFUSAL 1: every asset proved fresh, by the landed guard -------------- */

const entries = [];
const bindingUnits = [];   /* R39: each member's configuration and the names its fresh bundle exports */
for (const m of all) {
  const committed = committedArtifact(m);
  const manifestPath = join(m.abs, m.bundle.manifest);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  if (!manifest) die("NO_MANIFEST", `${m.name} has no ${m.bundle.manifest}.`,
    "The bundle manifest carries the input hashes the guard reads. Rebuild the member.");

  const runnable = freshBuildRunnable(m, manifest);
  if (!runnable.runnable) {
    /* A GUARD THAT SKIPS IS NOT A GUARD — FL-9's own words, and a release is the
       last place to accept one. The fleet gate (`test/system/fleetbundles.test.mjs`)
       may legitimately skip this arm; an assembler may not, because the artifact
       is about to be SIGNED. */
    die("GUARD_CANNOT_RUN",
      `${m.name}: the byte-identity arm cannot run here, and a release will not be assembled on a skipped guard.`,
      runnable.reason);
  }

  const { checked, reason, findings, built } = await verifyFresh(m, committed);
  /* The build itself can fail here with every vendored input present: that is
     the same skipped guard, never a pass (R7). */
  if (!checked) die("GUARD_CANNOT_RUN",
    `${m.name}: the byte-identity arm could not run here, and a release will not be assembled on a skipped guard.`,
    reason);
  if (findings.length) {
    die("STALE_OR_UNINSTALLABLE", `${m.name} did not pass the fleet build guard.`,
      findings.map((f) => "  - " + f).join("\n"));
  }
  if (sha256(committed) !== manifest.sha256) {
    die("MANIFEST_DISAGREES", `${m.name}: ${m.bundle.manifest} records ${manifest.sha256.slice(0, 16)}… `
      + `but the artifact hashes ${sha256(committed).slice(0, 16)}….`,
      "The manifest and the artifact must be written by the same build.");
  }
  /* The member's DECLARED service bindings, taken from its own config and
     carried into the signed statement exactly as written — phantom and all.
     The installer substitutes the instance slug at upload, so the slug is never
     a value that arrived over the network. */
  const wrangler = join(m.abs, "wrangler.jsonc");
  const wcfg = existsSync(wrangler)
    ? parseJsonc(readFileSync(wrangler, "utf8"), `${m.name}/wrangler.jsonc`)
    : null;
  const services = (wcfg?.services || []).map((s) => ({ binding: s.binding, service: s.service }));
  bindingUnits.push({ name: m.name, config: wcfg, exports: bundleExports(m, built) });
  /* IC-82, under FLEET's copy-never-default condition: the member's UPLOAD
     FACTS are COPIED from its own config at cut time, and a member whose
     config does not state them REFUSES assembly — a default supplied here is
     the installer-guessing defect one layer up, wearing the signature it
     should have been refused by. An ABSENT flags key is wrangler's own
     spelling of the empty list (ocr-worker's deliberate, commented state) and
     is copied as the stated []; an absent compatibility_date is the gap. */
  let compat = null;
  if (m.name !== "bio-plane") {
    if (!wcfg || typeof wcfg.compatibility_date !== "string" || !wcfg.compatibility_date) {
      die("MEMBER_COMPAT_UNSTATED",
        `${m.name}'s wrangler.jsonc states no compatibility_date, and IC-82 forbids defaulting one.`,
        "The manifest COPIES upload facts from the member's own config. State the date there\n"
        + "(FLEET's file, FLEET's truth), then assemble again.");
    }
    compat = { date: wcfg.compatibility_date, flags: wcfg.compatibility_flags || [] };
  }
  /* Each part's module type, from the member's own `rules` — the very rules
     3607b5c had to fix. A part no rule covers refuses; extension inference is
     the defect IC-82 exists to keep out of group accounts. */
  const globToRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
  const typeOfPart = (rel) => {
    for (const r of wcfg?.rules || []) {
      if ((r.globs || []).some((g) => globToRe(g).test(rel))) return r.type;
    }
    return null;
  };
  /* THE MEMBER'S OTHER UPLOAD PARTS. `ocr-worker` (CPDF-10 / IC-78) ships a
     tesseract wasm core and a language model beside its bundle — declared
     `external` so esbuild does not inline them, and `assets` so FL-9's guard
     hashes them. An installer that uploaded only the bundle would deploy a
     member that fails at runtime with no engine, and the release would have
     SAID it was complete. Each part is hashed HERE and the hash is required to
     match the committed manifest, so the guard's reading and the release's
     reading cannot diverge. */
  const parts = [];
  for (const rel of m.bundle.assets || []) {
    const abs = join(m.abs, rel);
    if (!existsSync(abs)) {
      die("MEMBER_PART_MISSING",
        `${m.name} declares the upload part ${rel}, and it is not in the tree.`,
        "A member's declared parts are what an installer must ship beside its bundle.\n"
        + "Releasing without one publishes a member that cannot run.");
    }
    const bytes = readFileSync(abs);
    const declared = (manifest.assets || []).find((a) => a.path === rel);
    if (!declared) {
      die("MEMBER_PART_UNHASHED",
        `${m.name}'s manifest does not hash the declared part ${rel}.`,
        "The bundle manifest must carry a hash for every part, or the guard is not\n"
        + "watching the bytes the release is about to sign. Rebuild the member.");
    }
    if (declared.sha256 !== sha256(bytes)) {
      die("MEMBER_PART_DISAGREES",
        `${m.name}'s part ${rel} does not match its manifest.`,
        `  manifest: ${declared.sha256}\n  on disk : ${sha256(bytes)}\n`
        + "The engine or model underneath this member changed without a rebuild.");
    }
    const ptype = typeOfPart(rel);
    if (!ptype) {
      die("MEMBER_PART_UNTYPED",
        `${m.name}'s part ${rel} matches no module rule in its wrangler.jsonc, and IC-82 forbids inferring one.`,
        "The part's module type is what 3607b5c had to fix at deploy; state the rule in the\n"
        + "member's own config (FLEET's file), then assemble again.");
    }
    parts.push({ path: rel, type: ptype, sha256: sha256(bytes), bytes: bytes.length, from: abs });
  }
  for (const c of containerPartsOf.get(m.name) || []) {
    if (parts.some((p) => p.path === c.path))
      die("CONTAINER_UNDESCRIBED", `${m.name} declares an upload part named ${c.path}, which is the container descriptor's own path.`,
        "Rename the member's part: a container descriptor is written by the release from the marker.");
    parts.push(c);
  }
  const wp = workerPartOf.get(m.name);
  if (wp) {
    if (parts.some((p) => p.path === wp.path))
      die("WORKER_UNDESCRIBED", `${m.name} declares an upload part named ${wp.path}, which is the Worker part's own path.`,
        "Rename the member's part: the Worker part is written by the release from the member's config.");
    parts.push(wp);
  }
  if (parts.length) {
    console.log(`       + ${parts.length} upload part(s): `
      + parts.map((x) => `${x.path} (${x.bytes} B)`).join(", "));
  }
  entries.push({ member: m.name, asset: `${m.name}.bundled.mjs`, sha256: sha256(committed),
                 bytes: committed.length, from: join(m.abs, m.bundle.outfile), services, parts,
                 ...(compat ? { compat } : {}) });
  console.log(`guard: ${m.name} fresh — ${built.bytes.length} B, sha256 ${sha256(committed).slice(0, 16)}…`);
}

/* ---- REFUSAL 1b: THE RELEASE IS COHERENT (R39; K4176) --------------------------------------------------------
   agent-worker 0.86.0 bound REMOTE to agent-runner's class RemoteSession, which agent-runner did not export, and
   Cloudflare refused it at deploy (10061): a release that cannot deploy whole. Every service and Durable Object
   binding, every container class and every migration class is held here to the names the FRESH bundles export (the
   bytes that would ship), before anything is written. */
{
  const incoherent = bindingFindings(bindingUnits);
  if (incoherent.length)
    die("BINDING_NOT_EXPORTED", `${incoherent.length} binding(s) of this release name a class or service the release does not export.`,
      incoherent.map((f) => `  - ${f.text}`).join("\n") + "\n"
      + "Cloudflare refuses such a member at deploy (code 10061 for a class, 10143 for a service). Export the class from the\n"
      + "bundle that hosts it, or correct the binding in the member's wrangler.jsonc, rebuild, and assemble again.");
}

/* ---- the version, and that the WHOLE FLEET agrees on it ------------------
   This checked only bio-plane's two files until DS-2. That was too narrow by
   exactly the amount that matters here: a release carries ONE version over a
   SET of artifacts, so a member declaring something else makes the manifest's
   `version` field a claim about nothing. The fleet-spanning resolver is the
   same one `deploy.mjs` refuses on, so the release and the deploy cannot
   disagree about what "the version" means. */
const version = flag("--version") || resolveVersion().version;
{
  const r = resolveVersion();
  if (!r.ok) {
    die("VERSION_SKEW", "the fleet does not agree on one version.",
      `  authority: bio-plane/package.json = ${JSON.stringify(r.version)}\n`
      + r.findings.map((f) => "  - " + f).join("\n"));
  }
  if (version !== r.version) {
    die("VERSION_DISAGREES",
      `--version ${version} does not match what the tree declares.`,
      `  declared: ${JSON.stringify(r.version)} (bio-plane/package.json, the authority)\n`
      + "A flag cannot fake a bump the tree has not made. Bump the authority and the\n"
      + "fleet together — `node bio-plane/scripts/resolve-version.mjs` names every site.");
  }
}

/* ---- REFUSAL 4: A PUBLISHED VERSION IS IMMUTABLE -------------------------
   Caught by this tool's own first dry-run, which is why it is here rather than
   in a comment about diligence. Every version source read 0.56.0 and passed the
   check above, while the plane artifact hashed d95d280d… — because FL-10 had
   just REBUILT it from a tree 114 commits past the one 0.56.0 was cut from. The
   version check compares sources to each other and CANNOT see that. So the
   assembler would have cheerfully signed a second, different 0.56.0, and every
   installer that had already fetched the first one would be holding bytes that
   no longer match the manifest under the same version number. A version is a
   promise about bytes; re-using one is the release-channel form of the record
   claiming more than it can support. Bump the version instead. */
{
  const prev = existsSync(RELEASE_JSON) ? JSON.parse(readFileSync(RELEASE_JSON, "utf8")) : null;
  const planeFresh = entries.find((e) => e.member === "bio-plane");
  if (prev && prev.version === version && prev.sha256 && prev.sha256 !== planeFresh.sha256) {
    die("VERSION_ALREADY_RELEASED",
      `${version} has already been released, with a DIFFERENT plane asset.`,
      `  released ${version}: ${prev.sha256}\n` +
      `  this tree  ${version}: ${planeFresh.sha256}\n` +
      "A version is a promise about bytes. Bump bio-plane/package.json and\n" +
      "bio-plane/wrangler.jsonc together, then assemble again.");
  }
}

/* ---- REFUSAL 2/3: the canonical payload naming the plane AND the members --- */

const planeEntry = entries.find((e) => e.member === "bio-plane");
const fleetEntries = entries.filter((e) => e.member !== "bio-plane")
  .sort((a, b) => a.member.localeCompare(b.member));

/* Built by the SHARED statement function, never here. */
const payload = fleetStatement({
  version,
  plane: { sha256: planeEntry.sha256, bytes: planeEntry.bytes, asset: "bio-plane.bundled.mjs" },
  members: fleetEntries,   /* carries services AND parts; both are signed */
});

console.log("\n──── the payload fleetSig covers ────");
process.stdout.write(payload);
console.log("─────────────────────────────────────");

/* ---- THE RELEASE NOTICE (bundler R32; T48-4, N1047, K3158) ------------------
   Each release publishes, beside its assets, a notice each group's Civicsmith checks for: the version, its date, the
   SHA-256 of the fleet payload (so the notice names the whole release it announces), a security mark, and notes in
   members' words. The notes are INSIDE what is signed: the statement is signatures' `releaseNoticeStatement` (its
   R47) over all five fields, signed in `bio-release-notice` (its R46), a namespace no other signature verifies in.
   The date, the mark and the notes are COPIED from the committed `release/notes/<version>.json`, never the clock and
   never a default: a release with no notes, or notes the statement refuses, is refused here, before anything is
   emitted or written, on every run (the dry run included, so the workflow's dry run proves them before it signs). */
const notesRel = `release/notes/${version}.json`;
const notesPath = join(RELEASE_DIR, "notes", `${version}.json`);
if (!existsSync(notesPath))
  die("NO_NOTES", `there are no release notes for ${version}: ${notesRel} is absent.`,
    "Every release carries a signed notice with its notes in members' words. Commit the notes file, then assemble again:\n"
    + `  ${notesRel}  { "date": "YYYY-MM-DD", "security": false,\n`
    + '    "notes": { "members": "…", "administrators": "…", "must_do": "" } }');
const NOTES_KEYS = ["date", "security", "notes", "version"];
const notesUnreadable = (field, why) => die("NOTES_UNREADABLE", `${notesRel} cannot make the release notice: ${field}.`, why);
let notesFile;
try { notesFile = JSON.parse(readFileSync(notesPath, "utf8")); }
catch (e) { notesUnreadable("(the file)", `  it does not parse as JSON: ${e.message}`); }
if (!notesFile || typeof notesFile !== "object" || Array.isArray(notesFile))
  notesUnreadable("(the file)", "  it is not a JSON object { date, security, notes }.");
for (const k of Object.keys(notesFile))
  if (!NOTES_KEYS.includes(k)) notesUnreadable(k, `  the notes file states \`${k}\`, which the notice does not carry; a field is copied, never ignored.`);
if (notesFile.version !== undefined && notesFile.version !== version)
  notesUnreadable("version", `  the notes file is for ${JSON.stringify(notesFile.version)}, and this release is ${version}.`);
const notice = { version, date: notesFile.date, manifest: sha256(Buffer.from(payload, "utf8")),
  security: notesFile.security, notes: notesFile.notes };
let noticeStatement;
try { noticeStatement = Buffer.from(releaseNoticeStatement(notice)); }
catch (e) {
  const field = /REFUSED \[NOTICE_FIELD\]: (.+)$/.exec(String(e.message))?.[1] ?? String(e.message);
  notesUnreadable(field, "  signatures' releaseNoticeStatement refuses it: date YYYY-MM-DD, security true or false, notes exactly\n"
    + "  { members, administrators, must_do }, each text of at most 8,000 characters, members and administrators non-empty.");
}
console.log(`notice: ${version} of ${notice.date}, manifest ${notice.manifest.slice(0, 16)}…, security ${notice.security ? "yes" : "no"} — from ${notesRel}`);

const existing =existsSync(RELEASE_JSON) ? JSON.parse(readFileSync(RELEASE_JSON, "utf8")) : {};

/* ---- THE SIGNER IS THE SEED'S OWN KEY (bundler R30, T47; N944, K2937) ------
   0.82.0's first signing run signed with Bob's new key and then refused itself as PLANE_SIG_DOES_NOT_COVER_ASSET:
   this file verified against, and would have written, the `signer` RELEASE.json already named, still the development
   key. So with --sign the signer is DERIVED from the seed in use (signatures R35), and both signatures are verified
   against that key and written with its line. A RELEASE.json naming another key is refused HERE, naming both keys and
   nothing secret, before anything is signed or written: a key rotation is the act that edits `signer` (Distribution
   §10), never a signing run. No signer named at all is no disagreement: the derived line is written. */
const keyOf = (line) => (typeof line === "string" ? line.trim().split(/\s+/).slice(0, 2).join(" ") : JSON.stringify(line));
const named = (line) => line !== undefined && line !== null && !(typeof line === "string" && !line.trim());
let seed = null;
let signer = existing.signer;
if (SIGN) {
  seed = process.env.BIO_RELEASE_SEED;
  if (!seed) die("NO_SEED", "--sign needs BIO_RELEASE_SEED and it is not set.",
    "It is the signing environment's secret and is never printed (R30).");
  let derived;
  try { derived = signerPublicLine(seed); }
  catch (e) {
    die("SIGNING_FAILED", "could not read the release key from BIO_RELEASE_SEED.",
      `  ${String(e.message || e)}\n`
      + "BIO_RELEASE_SEED must be the BIOKEY-RAW1 envelope this project mints.");
  }
  if (named(existing.signer) && keyOf(existing.signer) !== keyOf(derived))
    die("SIGNER_DISAGREES", "release/RELEASE.json names a signer whose key is not the key of the seed in use.",
      `  RELEASE.json's signer: ${keyOf(existing.signer)}\n`
      + `  the seed's key       : ${keyOf(derived)}\n`
      + "Nothing was signed or written. If the release key was rotated, set `signer` in release/RELEASE.json to the new\n"
      + "key's line (the rotation's own act, Distribution §10) and sign again; otherwise the signing environment holds\n"
      + "the wrong seed.");
  signer = derived;
  console.log(`signer: ${keyOf(signer)} — the key of the seed in use${named(existing.signer) ? ", as RELEASE.json names it" : ""}`);
}

if (EMIT) { writeFileSync(EMIT, payload); console.log(`payload written to ${EMIT}`); }
/* R30: the other thing to be signed, the plane asset the payload names, byte for byte. */
if (EMIT_PLANE) { copyFileSync(planeEntry.from, EMIT_PLANE); console.log(`plane asset written to ${EMIT_PLANE}`); }
/* R32: the third thing to be signed, the notice's statement, byte for byte. */
if (EMIT_NOTICE) { writeFileSync(EMIT_NOTICE, noticeStatement); console.log(`notice statement written to ${EMIT_NOTICE}`); }

if (DRY) {
  console.log(`\n--dry-run: nothing written. A release cut now would carry ${entries.length} assets `
    + `at ${version}, all proved fresh against this tree, and its notice from ${notesRel}.`);
  process.exit(0);
}

/* ---- signing, and the acceptance is STOCK ssh-keygen ---------------------- */

const NS_RELEASE = "bio-release";

/** Sign `bytes` in `ns` with the release seed.
 *  NOT via `ssh-keygen -Y sign`: that wants an OpenSSH private key FILE and this
 *  project's seed is a `BIOKEY-RAW1.<label>.<b64 seed>` envelope — measured
 *  2026-09-13, it fails with "Couldn't load public key … No such file or
 *  directory". The doctrine is unaffected: stock ssh-keygen remains the
 *  ACCEPTANCE authority and `verifyWith` below is run on everything signed here,
 *  including immediately after signing it. See ./sign-sshsig.mjs (signatures). */
function signWith(bytes, ns) {
  try { return signSshsig(seed, bytes, ns); }
  catch (e) {
    die("SIGNING_FAILED", `could not sign in namespace ${ns}.`,
      `  ${String(e.message || e)}\n`
      + "BIO_RELEASE_SEED must be the BIOKEY-RAW1 envelope this project mints.");
  }
}

/** Stock `ssh-keygen -Y verify` is the acceptance authority, here as everywhere. */
function verifyWith(signer, sig, bytes, ns) {
  /* No signer named in RELEASE.json is no key to accept anything for: a refusal, never a crash. */
  if (typeof signer !== "string" || !signer.trim())
    return { ok: false, reason: "release/RELEASE.json names no `signer`, so no key can accept the signature" };
  const dir = join(tmpdir(), "bio-ver-" + Date.now() + "-" + Math.random().toString(36).slice(2));
  mkdirSync(dir, { recursive: true });
  const allowed = join(dir, "allowed"), sigPath = join(dir, "p.sig");
  const principal = "bio-release";
  writeFileSync(allowed, `${principal} ${signer.split(" ").slice(0, 2).join(" ")}\n`);
  writeFileSync(sigPath, sig);
  try {
    execFileSync("ssh-keygen", ["-Y", "verify", "-f", allowed, "-I", principal, "-n", ns, "-s", sigPath],
      { input: bytes, stdio: ["pipe", "pipe", "pipe"] });
    return { ok: true, reason: null };
  } catch (e) { return { ok: false, reason: String(e.stderr || e.message).trim() }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

let fleetSig = flag("--fleet-sig") ? readFileSync(flag("--fleet-sig"), "utf8") : null;
/* R30: a plane signature made in the signing environment arrives as a file; otherwise RELEASE.json's (R23). */
let planeSig = flag("--plane-sig") ? readFileSync(flag("--plane-sig"), "utf8") : (existing.sig ?? null);
/* R32: the notice's signature, made in the signing environment, arrives as a file; with --sign it is made below. */
let noticeSig = flag("--notice-sig") ? readFileSync(flag("--notice-sig"), "utf8") : null;
const planeBytes = readFileSync(planeEntry.from);

if (SIGN) {
  fleetSig = signWith(payload, NS_FLEET);
  planeSig = signWith(planeBytes, NS_RELEASE);
  noticeSig = signWith(noticeStatement, NS_RELEASE_NOTICE);
  console.log("signed: the plane asset, the fleet payload and the release notice, with the release key");
}

/* ---- REFUSAL 5: THE PLANE SIGNATURE MUST COVER THE PLANE BEING RELEASED ----
   I first wrote this as a printed NOTE ("`sig` was not regenerated here") and
   that was wrong in the way this project keeps paying for: a warning at the end
   of a successful run is not a gate. On a real cut the plane asset CHANGES, so
   carrying the previous `sig` forward writes a manifest whose signature does not
   verify over its own asset. The installer would refuse it and fall back to its
   built-in release — safe, silent, and indistinguishable from the repository
   being unreachable. So it is checked, with the same stock verifier the
   installer uses, and it REFUSES. */
{
  if (!planeSig) die("NO_PLANE_SIG", "there is no plane signature to publish.",
    "Pass --plane-sig <file> (made in the signing environment), or restore release/RELEASE.json's `sig`.");
  const v = verifyWith(signer, planeSig, planeBytes, NS_RELEASE);
  if (!v.ok) {
    die("PLANE_SIG_DOES_NOT_COVER_ASSET",
      "the plane signature does not verify over the plane asset being released.",
      `  asset  : bio-plane.bundled.mjs  sha256 ${planeEntry.sha256}\n` +
      `  verifier says: ${v.reason}\n` +
      "The plane artifact changed since `sig` was made. Re-sign it in the same act that\n" +
      "publishes it — run this tool with --sign.");
  }
  console.log("verified: stock ssh-keygen accepts `sig` over the plane asset");
}

if (!fleetSig) die("NO_FLEET_SIG", "no fleet signature supplied.",
  "Pass --fleet-sig <file> (made in the signing environment, R30).");

/* The fleet signature, checked by the same stock verifier — never by the code
   that produced it. A signature only its own author can check is worth nothing. */
{
  const v = verifyWith(signer, fleetSig, payload, NS_FLEET);
  if (!v.ok) die("FLEET_SIG_REJECTED", "stock ssh-keygen did NOT accept the fleet signature.", v.reason);
  console.log("verified: stock ssh-keygen accepts fleetSig over this payload");
}

/* R32: the notice's signature, checked by the same stock verifier, over the statement's exact bytes, in its own
   namespace, for the release's signer: a signature over other notes, another release or in another namespace is
   refused, and nothing is written. */
if (!noticeSig) die("NO_NOTICE_SIG", "no release notice signature supplied.",
  "Pass --notice-sig <file> (made in the signing environment over --emit-notice's statement, R30, R32).");
{
  const v = verifyWith(signer, noticeSig, noticeStatement, NS_RELEASE_NOTICE);
  if (!v.ok) die("NOTICE_SIG_REJECTED", "stock ssh-keygen did NOT accept the release notice signature.",
    `  namespace ${NS_RELEASE_NOTICE}, statement from ${notesRel}\n  verifier says: ${v.reason}`);
  console.log("verified: stock ssh-keygen accepts the notice's sig over its statement");
}

/* ---- write the release ---------------------------------------------------- */

mkdirSync(RELEASE_DIR, { recursive: true });
for (const e of entries) copyFileSync(e.from, join(RELEASE_DIR, e.asset));   /* the plane's is bio-plane.bundled.mjs */
/* Parts are published under the member's own name so two members declaring the
   same relative path cannot collide in one flat directory. */
for (const e of entries) {
  for (const part of e.parts || []) {
    const dest = join(RELEASE_DIR, e.member, part.path);
    mkdirSync(dirname(dest), { recursive: true });
    /* A container descriptor (from the marker) or a Worker part (from the config) is made here (R25), never a file in
       the member's tree. */
    if (part.data) writeFileSync(dest, part.data);
    else copyFileSync(part.from, dest);
  }
}

const out = {
  version,
  sha256: planeEntry.sha256,
  /* THE PLANE'S BYTE LENGTH IS PUBLISHED BECAUSE THE SIGNED STATEMENT CONTAINS
     IT. Without it the installer cannot rebuild the bytes fleetSig covers, and
     a perfectly good release would verify as tampered — the producer/verifier
     divergence `fleetStatement` exists to prevent, reappearing as MISSING DATA
     rather than as divergent code. Additive; older installers ignore it. */
  bytes: planeEntry.bytes,
  asset: "bio-plane.bundled.mjs",
  sig: planeSig,              // the PLANE signature, verified above over THIS asset
  signer,                     // with --sign, the seed's own key (R30); otherwise RELEASE.json's
  fleet: fleetEntries.map(({ member, asset, sha256: s, bytes, compat, services, parts }) =>
    ({ member, asset, sha256: s, bytes, compat, services,
       parts: (parts || []).map(({ path, type, sha256: ps, bytes: pb }) => ({ path, type, sha256: ps, bytes: pb })) })),
  fleetSig,
};
writeFileSync(RELEASE_JSON, JSON.stringify(out, null, 2) + "\n");
/* R32: the notice beside the assets, the five signed fields as signed, its signature and the release's signer. */
writeFileSync(NOTICE_JSON, JSON.stringify({ version: notice.version, date: notice.date, manifest: notice.manifest,
  security: notice.security, notes: notice.notes, sig: noticeSig, signer }, null, 2) + "\n");
console.log(`\nwrote release/RELEASE.json — ${version}, plane + ${fleetEntries.length} member(s)`);
console.log("wrote release/NOTICE.json — the release notice, its notes inside what is signed");
console.log("all three signatures were verified with stock ssh-keygen before these files were written.");
