/* THE FLEET'S BUILD STEP, AND THE GUARD THAT MAKES A COMMITTED ARTIFACT SAFE.
 *
 * ONE implementation of the recipe and ONE implementation of the check. Every
 * member's `scripts/build.mjs` and the plane's `scripts/build-plane.mjs` are thin
 * callers of this, and its verification is read by the fleet gate
 * (`bio-plane/test/system/fleetbundles.test.mjs`), `scripts/bundles.mjs` (R21) and
 * `scripts/release-assemble.mjs` (R22), never re-implemented by any of them. A second copy of a rule is how the next one goes stale in
 * silence — this estate has measured that five times (the note in the retired
 * `scripts/coverage.mjs` on the fleet `control` flag, where the arm written to
 * prove a fix came back GREEN because nothing read the flag any more).
 *
 * ---- WHY THIS EXISTS AT ALL (BOB, 2026-09-10, answering DIST's DELEGATION) ---
 *
 * `newgroup` is a Worker. It cannot run `wrangler` and it cannot bundle, and
 * `agent-worker` is three modules, so a one-part script upload — which is all an
 * installer has — cannot resolve them. An installable fleet therefore needs one
 * bundled, hashed, signed artifact PER MEMBER.
 *
 * FLEET's own ruling said the SOURCE deploys, not a bundle, because a committed
 * bundle is "a second place its version lives and a committed artifact that can
 * drift from its source (D-106's class)". **That objection is ANSWERED here, not
 * overruled.** The instrument is the one this record always reaches for — a
 * hash-verified copy of exact bytes, never a second codebase
 * (`newgroup/scripts/embed-release.mjs`) — and the
 * shape is `check-versions`': EQUALITY, in both directions, refusing rather than
 * preferring whichever side looks newer.
 *
 * **A STALE ARTIFACT FAILS INSTEAD OF SHIPPING.** That is the whole product of
 * this file.
 *
 * ---- WHY IT LIVES IN `bio-plane/scripts/` ----------------------------------
 *
 * Because `esbuild` is here. `bio-plane/node_modules` is the only install in the
 * repository that carries it for every member, the repository ROOT has no
 * `node_modules` at all, and `agent-worker` deliberately has no dependencies of
 * its own. A library outside `bio-plane/` could not `import "esbuild"` (the old
 * process's `tools/`, retired in T19, could not, which is why this never lived there). The precedent
 * is `newgroup/scripts/embed-release.mjs`, which already expects "the sibling
 * ../bio-plane tree with its devDependencies installed".
 *
 * ---- THE TRAP THIS FILE WAS WRITTEN AROUND, MEASURED 2026-09-10 -------------
 *
 * **esbuild writes its input paths into the output as comments, RELATIVE TO THE
 * PROCESS WORKING DIRECTORY.** The identical `pdf-worker` source built from
 * `pdf-worker/` and from `bio-plane/` differs by 30 bytes — `// src/index.mjs`
 * against `// ../pdf-worker/src/index.mjs`, and the mirror of that for the plane
 * sources it imports. The first measurement taken for this item read
 * `identical: false` and looked exactly like a stale committed artifact; it was
 * a false stale produced by the instrument's own cwd.
 *
 * So `absWorkingDir` is PINNED to the member directory, the pin is RECORDED in
 * the committed manifest, and the gate asserts the pin as well as the bytes. A
 * guard that cries wolf gets switched off, which is the same outcome as not
 * having one.
 *
 * **The same false stale, one layer down: esbuild writes a module's RESOLVED path,
 * and by default it resolves SYMLINKS.** Measured 2026-09-23 (BOB #29, reproduced
 * by FLEET #4): in a worktree whose `node_modules` is a symlink to another
 * checkout, `pdf-worker` built `// ../../../../../../../home/user/bio/pdf-worker/
 * node_modules/unpdf/dist/pdfjs.mjs` where the committed bundle has
 * `// node_modules/unpdf/dist/pdfjs.mjs`, and this guard read 84/3 on identical
 * source. So `preserveSymlinks` is ON: a module is named by the path it was
 * reached through, which is the member-relative one on every layout. A real
 * install has no symlinks, so the committed bytes do not move, and the manifest's
 * recipe does not record the flag because no layout makes it vary.
 *
 * ---- WHAT THE MANIFEST IS FOR, AND WHY IT IS NOT DECORATION -----------------
 *
 * The byte-identity arm needs the member's dependencies INSTALLED (unpdf, for
 * `pdf-worker`), and a fresh checkout has none — there `verifyFresh` says it
 * could not check (bundler R7) and `test/system/fleetbundles.test.mjs` reports a
 * SKIP. **A guard that skips is not a guard**, so the manifest carries the sha256
 * of every INPUT, and the input
 * check runs on any machine with no install at all. The two arms cover different
 * halves and say which half they are:
 *
 *   - INPUT HASHES catch first-party drift — a member's own source, or the PLANE
 *     source a member imports — everywhere, always, with zero dependencies.
 *     This is the arm FL-9 exists for.
 *   - THE FRESH BUILD catches everything, including a dependency's bytes moving,
 *     and runs wherever those bytes are present. **The case it cannot check is
 *     the case where the unverifiable inputs are also unchangeable**: a
 *     dependency's bytes cannot drift in a checkout that does not contain them.
 *     The member's `package-lock.json` hash is recorded too, so a lock that moved
 *     without a rebuild is caught by the dependency-free arm.
 *
 * ---- WHAT THIS FILE MUST NEVER DO -------------------------------------------
 *
 * **VERIFICATION NEVER WRITES.** `buildMember` takes `write` and the gate always
 * passes `false`. A guard that regenerates the artifact it is about to compare
 * against agrees with itself for free, which is the defect wearing the costume of
 * a guard. The two sides are: bytes esbuild produced from the SOURCE FILES just
 * now, and bytes read from a COMMITTED FILE before the build ran. Nothing in
 * this module lets those be the same buffer.
 */
import { build, version as ESBUILD_VERSION } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse as acornParse, tokenizer as acornTokenizer, tokTypes as acornTypes } from "../src/setup-words/vendor/acorn.mjs";   /* R38: the parser setup-words reads calls with; R2: its tokenizer finds the characters to escape */
/* THIS WALK IS GUARDED RATHER THAN NAMED. Found by the census in the old
   `hygiene.test.mjs` (deleted in T20): it went red on this file the first full
   run after it was written, before anyone read the diff, the sixth time that
   ratchet caught a new walk on the day it landed.
   WHY GUARDED AND NOT NAMED: `discoverMembers` walks the REPOSITORY ROOT for
   `fleet-member.json`, which is the second discovery path M0-15 named — a
   manifest enrols a WHOLE DIRECTORY, so it is a larger hole than an untracked
   suite, not a smaller one — and this module's count FEEDS A FLOOR in
   `test/system/fleetbundles.test.mjs`. The named list's own rule says naming is
   defensible for a walk that only REPORTS and much weaker for one whose count
   feeds a ratchet, because a floor set while a phantom was present is
   permanently too high and gets switched off. `fleetProvenance` below is a
   caller of `provenance.mjs`'s one mechanism (bundler R9), never a second
   statement of the rule. */
import { readGitProvenance, reportProvenance, repoPath } from "./provenance.mjs";
import { parseJsonc } from "./jsonc.mjs";   /* R11: the module's one reader */

export const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

/* The recipe every member shares. A member's `fleet-member.json` may override
   `entry`, `outfile`, `manifest` and `external`; it may NOT override `format` or
   `platform`, because those two are what make the output a Worker module and a
   member that needed a different answer would not be a fleet member. */
export const RECIPE = Object.freeze({ format: "esm", platform: "neutral" });
export const DEFAULT_EXTERNAL = Object.freeze(["cloudflare:workers", "node:*"]);

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/* The remedy every staleness finding names (N31): the one command that rebuilds
   every bundle a change staled, each by its member's own `npm run build`
   (bundler R21), run from the repository root. One string, so the findings
   cannot drift apart when the command moves again. */
const REBUILD = "Run `node bio-plane/scripts/bundles.mjs` from the repository root, "
  + "which rebuilds every bundle this change staled";

/* ---------------------------------------------------------------- discovery */
/* Members are DISCOVERED by their own marker file (D-117), never hand-listed
   here: a list maintained by hand is a list that silently falls behind the
   thing it lists (bundler R1).

   A member opts INTO a bundle by carrying a `bundle` block. A member without one
   is not a defect and is not silently skipped either — the gate names it, so a
   `bundle` block DELETED is visible rather than being a member that quietly
   stops being guarded.

   A CONTAINER MEMBER (bundler R24; N578, K1601) is the one exception, and it is
   stated by its own marker, never inferred: `"kind": "container"` AND an `image`
   block. Its deliverable is an image, named by digest, not a Worker bundle, so it
   is listed with its kind and its image and is not bundle-guarded for want of
   one. A marker that says `container` and states no image is not a container
   member: it falls through to the ordinary rule and is named as unguarded. A
   container member that DOES declare a `bundle` (the Worker hosting its class,
   T34-74) is guarded like any member.

   A CONTAINER MEMBER WITH MORE THAN ONE CLASS (R25, R27; T36-2, `file-scanner` R10) states its classes as a
   `containers` list, each entry `{class_name, image, max_instances?, bind?}` with its own `image` block, in place of
   the one top-level `image`; `max_instances` and `bind` not stated on a class are read from the member's top level
   (the marker stating them once for every class), and are never defaulted. A `containers` list whose every entry has
   an `image` block is that member's "image block" for R24. */
const isBlock = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const classList = (meta) =>
  (Array.isArray(meta.containers) && meta.containers.length && meta.containers.every((c) => isBlock(c) && isBlock(c.image))
    ? meta.containers : null);

/** R24 read off a marker itself (what `deploy-fleet.mjs` holds): `kind: "container"` and an image block, the top-level
 *  one or a `containers` list whose every entry has one. */
export const markerIsContainer = (meta) => isBlock(meta) && meta.kind === "container" && (isBlock(meta.image) || !!classList(meta));

export function isContainer(member) {
  return !!member && member.kind === "container"
    && (isBlock(member.image) || (Array.isArray(member.containers) && member.containers.length > 0));
}

/** Does the bundle guard (R6, R7, R21, R22) cover this member? Every member but a
 *  container member with no Worker bundle (R24). */
export const isGuarded = (member) => !isContainer(member) || !!member.bundle;

export function discoverMembers(repoRoot = REPO_ROOT) {
  const out = [];
  for (const dir of readdirSync(repoRoot).filter((d) => !d.startsWith("."))) {
    const marker = join(repoRoot, dir, "fleet-member.json");
    let text;
    try { text = readFileSync(marker, "utf8"); }
    catch (e) {
      if (e.code === "ENOENT" || e.code === "ENOTDIR") continue;   /* not a member */
      throw e;
    }
    /* A marker that does not parse is an error, never a member that silently
       stops being guarded. */
    let meta;
    try { meta = JSON.parse(text); }
    catch (e) { throw new Error(`fleet member marker ${marker} is not valid JSON: ${e.message}`); }
    const container = meta.kind === "container";
    const image = container && isBlock(meta.image) ? meta.image : null;
    const classes = container ? classList(meta) : null;
    out.push({
      dir,
      name: meta.name || dir,
      abs: join(repoRoot, dir),
      entry: meta.entry || (meta.bundle && meta.bundle.entry) || null,
      bundle: meta.bundle || null,
      kind: typeof meta.kind === "string" && meta.kind ? meta.kind : "worker",
      image,
      /* R24: a member with several classes is listed with each class's name and image. */
      ...(classes ? { containers: classes.map((c) => ({ class_name: c.class_name ?? null, image: c.image })) } : {}),
      marker: meta,
    });
  }
  /* Code-point order, then the directory: the same list on every machine and
     locale, whatever order the file system walks in. */
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return out.sort((a, b) => cmp(a.name, b.name) || cmp(a.dir, b.dir));
}

/* ---- THE PLANE ITSELF, GUARDED BY THE SAME LIBRARY (FL-10, D-298) ----------
 *
 * DIST measured the MIRROR of FL-9's defect: `dist/bio-plane.bundled.mjs` was
 * 114 commits stale against `src` and the tests could not tell — a test of the
 * artifact proves it WORKS, never that it MATCHES its source.
 *
 * The plane is DELIBERATELY NOT a `fleet-member.json` member: that marker
 * makes a directory a fleet member, and a fleet member holds no store binding
 * (each member's own tests hold it to that), which the plane necessarily
 * violates — it IS the store. So the plane arrives as an exported descriptor
 * with the same `bundle` shape, consumed by the gate and by
 * `scripts/build-plane.mjs`, and `discoverMembers`' walk and the fleet gate's
 * `GUARDED_FLOOR` keep their meaning untouched.
 *
 * The plane's build has no pre-step (bundler R16, K3807): the bundle is cut from the committed sources alone, and
 * no step generates a source file before it.
 *
 * The entry is the plane's own Worker entry, `src/plane/index.mjs` (plane R6),
 * the same file `wrangler.jsonc`'s `main` names, so the bundle and a wrangler
 * deploy start from one module (T20, K846). */
const PLANE_ENTRY = "src/plane/index.mjs";
export function planeMember(repoRoot = REPO_ROOT) {
  return {
    dir: "bio-plane",
    name: "bio-plane",
    abs: join(repoRoot, "bio-plane"),
    wholeWordTable: true,                /* R38: the plane carries the whole word table */
    entry: PLANE_ENTRY,
    bundle: {
      entry: PLANE_ENTRY,
      outfile: "dist/bio-plane.bundled.mjs",
      manifest: "dist/bio-plane.bundle.json",
      external: [...DEFAULT_EXTERNAL],
    },
  };
}

/* ---- A CONTAINER MEMBER'S DESCRIPTOR (bundler R25; N610, K1678 (1)) ----------
 *
 * The one part a container member carries beyond its Worker bundle: what the
 * installer needs to create (or roll out) the Containers application and bind its
 * class into the members that call it. It is COPIED from the member's own marker,
 * never defaulted (IC-82's copy-never-default condition, one part over), so a
 * field the marker does not state is a refusal naming that field. The image is
 * named only by digest, in agent-runner R7's own form, because an install that
 * names a tag installs whatever the tag points at that day. */
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPOSITORY = /^[a-z0-9.-]+(:[0-9]+)?\/[a-z0-9._/-]+$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** `<repository>@sha256:<64 hex>` from a container member's `image` block, or
 *  `{missing}` naming the first field that does not say it. Shared by the release
 *  (R25) and the deploy (R26), so the two cannot name the image differently. */
export function imageReference(image) {
  if (!image || typeof image !== "object") return { missing: "image" };
  if (typeof image.repository !== "string" || !REPOSITORY.test(image.repository) || image.repository.includes("@"))
    return { missing: "image.repository" };
  if (typeof image.digest !== "string" || !DIGEST.test(image.digest)) return { missing: "image.digest" };
  return { reference: `${image.repository}@${image.digest}` };
}

/* ---- THE NPM PACKAGES A LOCKFILE INSTALLS (bundler R27, R28 (a); F20, F21) ----
 *
 * Read off the lockfile npm itself installs from, so the list is the install's
 * without running it: every entry under `packages` whose key is a `node_modules/`
 * path and that is not marked `dev`, one per installed copy (a nested copy is a
 * second entry). The name is the entry's own `name` where npm records one (an
 * alias), else the path's last package segment. A lockfile that is not npm 7+'s
 * shape (no `packages` map) is unread, never an empty list. */
const packageOfPath = (key) => {
  const seg = key.split("node_modules/").pop().split("/");
  return seg[0].startsWith("@") ? `${seg[0]}/${seg[1]}` : seg[0];
};
const byNameVersion = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : a.version > b.version ? 1 : 0);

/** `{packages: [{name, version}]}` sorted by name then version, or `{unread}` naming the file, or the package
 *  with no version. Never throws. */
export function npmProductionPackages(lockPath, label = lockPath) {
  let lock;
  try { lock = JSON.parse(readFileSync(lockPath, "utf8")); }
  catch (e) { return { unread: `${label} ${e.code === "ENOENT" ? "is missing" : "does not parse"}` }; }
  if (!lock || typeof lock.packages !== "object" || lock.packages === null || Array.isArray(lock.packages))
    return { unread: `${label} does not parse: it has no \`packages\` map (npm 7 or later writes one)` };
  const packages = [];
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (!key.includes("node_modules/") || !entry || typeof entry !== "object" || entry.dev === true) continue;
    const name = typeof entry.name === "string" && entry.name ? entry.name : packageOfPath(key);
    if (typeof entry.version !== "string" || !entry.version)
      return { unread: `${label} names the installed package ${name} (${key}) without a version` };
    packages.push({ name, version: entry.version });
  }
  return { packages: packages.sort(byNameVersion) };
}

/** R27: a container member's image packages, from its own `package-lock.json` (the file its image's `npm ci
 *  --omit=dev` installs from). */
export const containerPackages = (member) =>
  npmProductionPackages(join(member.abs, "package-lock.json"), `${member.dir}/package-lock.json`);

/* ---- AN IMAGE WHOSE PACKAGES ARE NOT NPM'S (bundler R27, R28 (b); T36-2, rev. 2 §2 R10) ----
 *
 * `file-scanner`'s images install ClamAV, LibreOffice and Poppler from their base's system packages, which no
 * lockfile names. So the member commits a PACKAGE STATEMENT for each such image and names it in the class's
 * `image.packages` (member-relative):
 *
 *   { "ecosystem": "Debian:12",                      the OSV ecosystem its packages belong to (R28, R29)
 *     "base": { "repository": "…", "digest": "sha256:<64 hex>" },   the base image it was taken against
 *     "packages": [ { "name": "clamav", "version": "1.4.3+dfsg-1" }, … ] }
 *
 * The statement is pinned with its base: a base digest other than the one the marker pins (`image.base.digest`)
 * describes some other image, so it is unread, never believed. A class with no `image.packages` installs from npm,
 * and its list is the member's `package-lock.json`'s, as before. */
const STATEMENT_ECOSYSTEM = /^[A-Za-z][A-Za-z0-9.+:_ -]*$/;

/** `{ecosystem, packages: [{name, version}]}` sorted by name then version, or `{unread}` naming the file, the package
 *  or the digest. Never throws. */
export function statementPackages(path, label, baseDigest) {
  let st;
  try { st = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { return { unread: `${label} ${e.code === "ENOENT" ? "is missing" : "does not parse"}` }; }
  if (!isBlock(st)) return { unread: `${label} does not parse: it is not a JSON object` };
  if (typeof st.ecosystem !== "string" || !STATEMENT_ECOSYSTEM.test(st.ecosystem))
    return { unread: `${label} does not parse: it names no ecosystem` };
  if (!Array.isArray(st.packages)) return { unread: `${label} does not parse: it has no \`packages\` list` };
  const digest = isBlock(st.base) ? st.base.digest : undefined;
  if (typeof digest !== "string" || !DIGEST.test(digest))
    return { unread: `${label} names no base image digest (\`base.digest\`, sha256:<64 hex>)` };
  if (digest !== baseDigest)
    return { unread: `${label} was taken against the base ${digest}, not the base the marker pins (${baseDigest ?? "none"})` };
  const packages = [];
  for (const p of st.packages) {
    const name = isBlock(p) && typeof p.name === "string" && p.name ? p.name : null;
    if (!name) return { unread: `${label} names a package with no name: ${JSON.stringify(p)}` };
    if (typeof p.version !== "string" || !p.version) return { unread: `${label} names the package ${name} without a version` };
    packages.push({ name, version: p.version });
  }
  return { ecosystem: st.ecosystem, packages: packages.sort(byNameVersion) };
}

/** A container member's classes, each as the part describes it: one entry per class, `{class_name, image,
 *  max_instances, bind}` with `max_instances` and `bind` taken from the class, else from the member's top level.
 *  One class (the top-level `image` form, or a `containers` list of one) or several. `multi` is true only for more
 *  than one. `conflict` names a marker that states both forms. */
export function containerClasses(member) {
  const meta = (member && member.marker) || {};
  const list = classList(meta);
  if (!list) return { classes: [{ class_name: meta.class_name, image: meta.image, max_instances: meta.max_instances, bind: meta.bind }], multi: false };
  const conflict = isBlock(meta.image) ? "image (a top-level image beside a `containers` list)" : null;
  return {
    classes: list.map((c) => ({ class_name: c.class_name, image: c.image,
      max_instances: c.max_instances !== undefined ? c.max_instances : meta.max_instances,
      bind: c.bind !== undefined ? c.bind : meta.bind })),
    multi: list.length > 1, conflict,
  };
}

/** R27: one class's image packages, `{ecosystem, packages}` or `{unread}`: its package statement where the class names
 *  one, else the member's npm lockfile. */
export function classPackages(member, cls) {
  const img = isBlock(cls && cls.image) ? cls.image : {};
  if (img.packages === undefined) {
    const r = containerPackages(member);
    return r.unread ? r : { ecosystem: "npm", packages: r.packages };
  }
  if (typeof img.packages !== "string" || !img.packages || img.packages.startsWith("/") || img.packages.split("/").includes(".."))
    return { unread: `${member.dir}/fleet-member.json names no package statement for ${cls.class_name} as a member-relative path` };
  const base = isBlock(img.base) && typeof img.base.digest === "string" ? img.base.digest : null;
  return statementPackages(join(member.abs, img.packages), `${member.dir}/${img.packages}`, base);
}

/** R33: each class's `instance_type` as the member's own `wrangler.jsonc` `containers` block states it (a size name, or
 *  the platform's custom size block), keyed by `class_name`: `{types: Map}`, or `{unread}` naming the file when it does
 *  not parse. A member with no configuration, or a class the block does not list or lists with no `instance_type`, has
 *  none to carry: the field is left out and the platform's default applies, never a guessed size. */
export function containerInstanceTypes(member) {
  const types = new Map();
  let text;
  try { text = readFileSync(join(member.abs, "wrangler.jsonc"), "utf8"); }
  catch (e) { return e.code === "ENOENT" ? { types } : { unread: `${member.dir}/wrangler.jsonc cannot be read` }; }
  let cfg;
  try { cfg = parseJsonc(text, `${member.dir}/wrangler.jsonc`); } catch (e) { return { unread: `${member.dir}/wrangler.jsonc does not parse` }; }
  for (const c of isBlock(cfg) && Array.isArray(cfg.containers) ? cfg.containers : [])
    if (isBlock(c) && typeof c.class_name === "string" && c.instance_type !== undefined) types.set(c.class_name, c.instance_type);
  return { types };
}

const validInstanceType = (t) => (typeof t === "string" && t.trim() !== "") || (isBlock(t) && Object.keys(t).length > 0);

/** One class's descriptor, or the fields it lacks. `cls.instance_type`, where the configuration states one (R33), is
 *  written after `max_instances`. */
function classDescriptor(cls, memberNames, packages) {
  const missing = [];
  const img = imageReference(cls.image);
  if (img.missing) missing.push(img.missing);
  const policy = cls.image && cls.image.schedulingPolicy;
  if (policy !== undefined && policy !== "default") missing.push("image.schedulingPolicy");
  if (typeof cls.class_name !== "string" || !IDENTIFIER.test(cls.class_name)) missing.push("class_name");
  if (!Number.isInteger(cls.max_instances) || cls.max_instances < 1) missing.push("max_instances");
  const bindOk = Array.isArray(cls.bind) && cls.bind.length > 0 && cls.bind.every((b) =>
    b && typeof b === "object" && typeof b.member === "string" && memberNames.includes(b.member)
    && typeof b.binding === "string" && IDENTIFIER.test(b.binding));
  if (!bindOk) missing.push("bind");
  if (cls.instance_type !== undefined && !validInstanceType(cls.instance_type)) missing.push("instance_type");
  if (missing.length) return { missing };
  const descriptor = {
    class_name: cls.class_name,
    image: img.reference,
    scheduling_policy: "default",
    max_instances: cls.max_instances,
    ...(cls.instance_type !== undefined ? { instance_type: cls.instance_type } : {}),
    bind: cls.bind.map((b) => ({ member: b.member, binding: b.binding })),
    ...(packages ? { packages: packages.map((p) => ({ name: p.name, version: p.version })) } : {}),
  };
  return { descriptor, bytes: Buffer.from(JSON.stringify(descriptor, null, 2) + "\n") };
}

/** The `container.json` part for a one-class container member (its top-level marker): `{descriptor, bytes}`, or
 *  `{missing: [field, …]}` naming every field the marker does not state in the form the part needs. `memberNames`
 *  are the fleet's members, which `bind` must name. `packages`, where given, is R27's list, written as the part's
 *  last field; the others are unchanged by it. */
export function containerDescriptor(member, memberNames = [], { packages = null } = {}) {
  const meta = (member && member.marker) || {};
  const d = classDescriptor({ class_name: meta.class_name, image: meta.image, max_instances: meta.max_instances, bind: meta.bind },
    memberNames, packages);
  if (!member || !member.bundle) return { missing: ["bundle", ...(d.missing || [])] };
  return d;
}

/** R25, R27: every `Container` part a container member carries, one per class: `{parts: [{path, class_name,
 *  descriptor, bytes}]}`. One class is `container.json`, as before; with several, each class is
 *  `container/<class_name>.json`. Refusals, in the order the release checks them: `{missing: [field, …], class?}`
 *  (R25, the class named when there are several), then `{unread}` (R27). Each class's packages are `classPackages`';
 *  `packages: false` leaves them out. */
export function containerParts(member, memberNames = [], { packages = true } = {}) {
  const found = containerClasses(member);
  const { multi, conflict } = found;
  if (!member || !member.bundle) return { missing: ["bundle"] };
  if (conflict) return { missing: [conflict] };
  /* R33: each class's own size from the member's configuration. A configuration that does not parse is unread, named
     as a field the descriptor needs, never a size left out in silence. */
  const sizes = containerInstanceTypes(member);
  if (sizes.unread) return { missing: [`instance_type (${sizes.unread})`] };
  const classes = found.classes.map((c) => (sizes.types.has(c.class_name) ? { ...c, instance_type: sizes.types.get(c.class_name) } : c));
  const seen = new Set();
  for (const cls of classes) {
    const d = classDescriptor(cls, memberNames, null);
    if (d.missing) return multi ? { missing: d.missing, class: typeof cls.class_name === "string" && cls.class_name ? cls.class_name : "(unnamed)" } : { missing: d.missing };
    if (seen.has(cls.class_name)) return { missing: ["class_name"], class: cls.class_name };
    seen.add(cls.class_name);
  }
  const parts = [];
  for (const cls of classes) {
    let pk = null;
    if (packages) {
      const r = classPackages(member, cls);
      if (r.unread) return { unread: r.unread };
      pk = r.packages;
    }
    const d = classDescriptor(cls, memberNames, pk);
    parts.push({ path: multi ? `container/${cls.class_name}.json` : "container.json", class_name: cls.class_name,
      descriptor: d.descriptor, bytes: d.bytes });
  }
  return { parts };
}

/* ---- WHAT A CONTAINER IMAGE WAS BUILT FROM (bundler R36, R37; N1210, K3674) ------------------------------------------
 *
 * The image itself is built by the GitHub workflow, never in a session (rulings-active §4, K1898). What a session and
 * the release assembly can do is compare, so "container code changed under an unchanged digest" is a comparison and
 * not a rebuild: each class's `image` block records, beside its `digest`, `source_sha256`, the SHA-256 of the files
 * the image is built from. Those files are the class's Dockerfile (`build.dockerfile`, on the class or the member,
 * member-relative) and every file or directory it COPYs or ADDs from the build context (the member's directory), each
 * hashed with its member-relative path, in path order, so a changed byte, a renamed or removed file or an added one in
 * a copied directory moves the hash. The Dockerfile's base image digest is a line of the Dockerfile, so a base moved
 * moves the hash too. A `COPY --from=` copies from another stage and names no context file; a wildcard, a URL or a
 * path outside the context cannot be hashed and is unread, never skipped. */
export const SOURCE_FIELD = "source_sha256";
const HEX64 = /^[0-9a-f]{64}$/;

const copiedSources = (dockerfile) => {
  const out = [];
  const logical = dockerfile.replace(/\\\r?\n/g, " ").split(/\r?\n/);
  for (const line of logical) {
    const m = /^\s*(?:COPY|ADD)\s+(.*)$/i.exec(line);
    if (!m) continue;
    let rest = m[1].trim(), fromStage = false;
    while (rest.startsWith("--")) {
      const flag = /^(--\S+)\s*(.*)$/.exec(rest);
      if (!flag) break;
      if (/^--from=/i.test(flag[1])) fromStage = true;
      rest = flag[2];
    }
    if (fromStage) continue;
    let args;
    if (rest.startsWith("[")) { try { args = JSON.parse(rest); } catch { return { unread: `a COPY or ADD line it cannot read: ${line.trim()}` }; } }
    else args = rest.split(/\s+/).filter(Boolean);
    if (!Array.isArray(args) || args.length < 2 || !args.every((a) => typeof a === "string"))
      return { unread: `a COPY or ADD line it cannot read: ${line.trim()}` };
    out.push(...args.slice(0, -1));
  }
  return { sources: out };
};

const filesUnder = (abs, rel, acc) => {
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return false; }
  for (const e of entries) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) { if (!filesUnder(join(abs, e.name), r, acc)) return false; }
    else acc.push(r);
  }
  return true;
};

/** The class's `build` block: its own where the marker states several classes, else the member's. */
const buildOf = (member, className) => {
  const meta = (member && member.marker) || {};
  const list = classList(meta);
  const entry = list ? list.find((c) => c.class_name === className) : null;
  return isBlock(entry && entry.build) ? entry.build : (isBlock(meta.build) ? meta.build : {});
};

/** R36, R37: `{sha256}` of the files one class's image is built from, or `{unread}` saying which cannot be read. */
export function containerSourceHash(member, className) {
  const dockerfileRel = buildOf(member, className).dockerfile;
  const label = `${member.dir}/fleet-member.json`;
  if (typeof dockerfileRel !== "string" || !dockerfileRel || dockerfileRel.startsWith("/") || dockerfileRel.split("/").includes(".."))
    return { unread: `${label} names no member-relative \`build.dockerfile\` for ${className}` };
  let text;
  try { text = readFileSync(join(member.abs, dockerfileRel), "utf8"); }
  catch { return { unread: `${member.dir}/${dockerfileRel} cannot be read` }; }
  const copied = copiedSources(text);
  if (copied.unread) return { unread: `${member.dir}/${dockerfileRel} has ${copied.unread}` };
  const files = new Set([dockerfileRel.replace(/^\.\//, "")]);
  for (const src of copied.sources) {
    const rel = src.replace(/^\.\//, "").replace(/\/+$/, "") || ".";
    if (/[*?[\]]/.test(rel) || /^[a-z]+:\/\//i.test(rel) || rel.startsWith("/") || rel.split("/").includes(".."))
      return { unread: `${member.dir}/${dockerfileRel} copies ${src}, which is a wildcard, an address or a path outside the build context` };
    let st;
    try { st = statSync(join(member.abs, rel)); } catch { return { unread: `${member.dir}/${dockerfileRel} copies ${src}, which is not in the tree` }; }
    if (st.isDirectory()) {
      const acc = [];
      if (!filesUnder(join(member.abs, rel), rel === "." ? "" : rel, acc)) return { unread: `${member.dir}/${rel} cannot be read` };
      for (const f of acc) files.add(f.replace(/^\//, ""));
    } else files.add(rel);
  }
  const h = createHash("sha256");
  for (const f of [...files].sort()) h.update(`${f}\0${sha256(readFileSync(join(member.abs, f)))}\n`);
  return { sha256: h.digest("hex") };
}

/** R37: every class of a container member against what its image was built from: `[{class_name, state, why}]`, `state`
 *  `current`, `stale` (the files differ from what the recorded digest was built from), `unrecorded` (the marker
 *  records nothing it was built from) or `unread` (the files cannot be hashed). Makes no request and writes nothing. */
export function containerImageStates(member) {
  const { classes } = containerClasses(member);
  return classes.map((cls) => {
    const name = typeof cls.class_name === "string" && cls.class_name ? cls.class_name : "(unnamed)";
    const now = containerSourceHash(member, name);
    if (now.unread) return { class_name: name, state: "unread", why: now.unread };
    const recorded = isBlock(cls.image) ? cls.image[SOURCE_FIELD] : undefined;
    if (typeof recorded !== "string" || !HEX64.test(recorded))
      return { class_name: name, state: "unrecorded", why: `its image block records no \`${SOURCE_FIELD}\`, so what the digest was built from is unknown` };
    if (recorded !== now.sha256)
      return { class_name: name, state: "stale", why: `its image files are now ${now.sha256.slice(0, 16)}…, the digest was built from ${recorded.slice(0, 16)}…` };
    return { class_name: name, state: "current", why: null };
  });
}

/** R37: the findings, each `{class_name, text}`, for the classes whose image is not provably built from the files now. */
export function containerImageFindings(member) {
  return containerImageStates(member).filter((s) => s.state !== "current").map((s) => ({ class_name: s.class_name,
    text: `${member.name}: the image of its class ${s.class_name} is not provably built from the code now in the tree — ${s.why}.` }));
}

/** R36: record the digest the build produced for one class, in both files that name it, in one step: the marker's image
 *  block (`digest`, and `source_sha256` of the files now) and the image the member's `wrangler.jsonc` container block
 *  names (its repository kept, its digest replaced). Returns `{files: [member-relative paths written]}` or
 *  `{refused: CODE, message}`, having written nothing. */
export function recordContainerDigest(member, className, digest) {
  const refuse = (refused, message) => ({ refused, message });
  if (typeof digest !== "string" || !DIGEST.test(digest))
    return refuse("CONTAINER_DIGEST_INVALID", `${JSON.stringify(digest)} is not an image digest, sha256:<64 hex>`);
  if (!isContainer(member)) return refuse("CONTAINER_UNDESCRIBED", `${member.name} is not a container member`);
  const meta = JSON.parse(JSON.stringify(member.marker));
  const list = classList(meta);
  const entry = list ? list.find((c) => c.class_name === className) : (meta.class_name === className ? meta : null);
  if (!entry || !isBlock(entry.image)) return refuse("CONTAINER_UNDESCRIBED", `${member.name} states no container class ${className}`);
  const src = containerSourceHash(member, className);
  if (src.unread) return refuse("CONTAINER_UNDESCRIBED", `${member.name}'s class ${className}: ${src.unread}`);
  const wranglerPath = join(member.abs, "wrangler.jsonc");
  let wtext, cfg;
  try { wtext = readFileSync(wranglerPath, "utf8"); cfg = parseJsonc(wtext, `${member.dir}/wrangler.jsonc`); }
  catch (e) { return refuse("CONTAINER_UNDESCRIBED", `${member.dir}/wrangler.jsonc cannot be read: ${String(e.message).split("\n")[0]}`); }
  const block = (isBlock(cfg) && Array.isArray(cfg.containers) ? cfg.containers : []).find((c) => isBlock(c) && c.class_name === className);
  const named = block && typeof block.image === "string" ? /^(.+)@(sha256:[0-9a-f]{64})$/.exec(block.image) : null;
  if (!named) return refuse("CONTAINER_UNDESCRIBED", `${member.dir}/wrangler.jsonc names no \`<repository>@sha256:<64 hex>\` image for the container of ${className}`);
  if (wtext.split(block.image).length !== 2)
    return refuse("CONTAINER_UNDESCRIBED", `${member.dir}/wrangler.jsonc names the image ${block.image} more than once, so which is ${className}'s is not clear`);
  const image = {};
  for (const [k, v] of Object.entries(entry.image)) {
    if (k === SOURCE_FIELD) continue;
    image[k] = k === "digest" ? digest : v;
    if (k === "digest") image[SOURCE_FIELD] = src.sha256;
  }
  entry.image = image;
  writeFileSync(join(member.abs, "fleet-member.json"), JSON.stringify(meta, null, 2) + "\n");
  writeFileSync(wranglerPath, wtext.replace(block.image, `${named[1]}@${digest}`));
  return { files: [`${member.dir}/fleet-member.json`, `${member.dir}/wrangler.jsonc`] };
}

/* ---- A MEMBER'S OWN BUCKETS AND SCHEDULE (bundler R25; N772, K2155) -----------
 *
 * The fleet statement's `services` carry a member's service bindings and nothing else, so a member that binds an R2
 * bucket or states a cron (`file-scanner`'s `CAPTURES` and its daily refresh; the readers' `CAPTURES`) carries one more
 * part, type `Worker`, at `worker.json`: `{r2_buckets: [{binding, bucket}], crons}`, copied from the member's own
 * `wrangler.jsonc` and never defaulted. A bucket is named by its ROLE, never by the account's bucket name, so the
 * installer binds the copy's own bucket of that role and a later per-copy name needs no new release. The roles are the
 * plane's two buckets, as this project's configs name them; any other bucket is refused by its binding. The statement's
 * format is unchanged: the part rides `parts=` like every other.
 * (K4094) A member with its own Durable Objects adds `durable_objects: {bindings: [{name, class_name}], migrations:
 * [{tag, classes}]}`, copied the same way: the bindings with no `script_name` (another script's object is not the
 * member's to bind) and its migrations in order, each `new_sqlite_classes` under its tag. The installer reads them from
 * the signed release rather than from a table of its own. */
export const WORKER_PART_PATH = "worker.json";
export const BUCKET_ROLES = Object.freeze({ "bio-captures": "captures", "bio-published": "published" });

/** A member's own Durable Objects from its parsed config (K4094): `{bindings, migrations}`, or null when it owns none.
 *  Names each binding without a name or class and each migration that is not `{tag, new_sqlite_classes}` (the forms
 *  the installer reads) into `missing`. */
function ownDurableObjects(c, missing) {
  const dob = c.durable_objects === undefined ? {} : c.durable_objects;
  const list = isBlock(dob) && dob.bindings !== undefined ? dob.bindings : [];
  if (!isBlock(dob) || !Array.isArray(list)) missing.push("durable_objects.bindings");
  const bindings = [];
  for (const b of Array.isArray(list) ? list : []) {
    if (isBlock(b) && b.script_name !== undefined) continue;
    if (!isBlock(b) || typeof b.name !== "string" || !b.name || typeof b.class_name !== "string" || !b.class_name) {
      missing.push("durable_objects.bindings");
      continue;
    }
    bindings.push({ name: b.name, class_name: b.class_name });
  }
  const migs = c.migrations === undefined ? [] : c.migrations;
  if (!Array.isArray(migs)) missing.push("migrations");
  const migrations = [];
  for (const m of Array.isArray(migs) ? migs : []) {
    const classes = isBlock(m) ? m.new_sqlite_classes : undefined;
    if (!isBlock(m) || Object.keys(m).some((k) => k !== "tag" && k !== "new_sqlite_classes") || typeof m.tag !== "string" || !/^v[0-9]+$/.test(m.tag)
        || !Array.isArray(classes) || !classes.every((x) => typeof x === "string" && x)) {
      missing.push("migrations");
      continue;
    }
    migrations.push({ tag: m.tag, classes: [...classes] });
  }
  return bindings.length || migrations.length ? { bindings, migrations } : null;
}

/** A member's `Worker` part from its parsed `wrangler.jsonc`: `{part: null}` when it binds no bucket, states no cron
 *  and owns no Durable Object; `{part: {descriptor, bytes}}`; or `{missing: [what, …]}` naming each binding whose bucket
 *  has no role (by its binding name), each list that is not one (`r2_buckets`, `triggers.crons`) and each Durable Object
 *  or migration the part cannot state. Never throws. */
export function workerPart(cfg) {
  const c = isBlock(cfg) ? cfg : {};
  const missing = [];
  const r2 = c.r2_buckets === undefined ? [] : c.r2_buckets;
  if (!Array.isArray(r2)) missing.push("r2_buckets");
  const buckets = [];
  for (const b of Array.isArray(r2) ? r2 : []) {
    const binding = isBlock(b) && typeof b.binding === "string" && b.binding ? b.binding : null;
    const role = binding && typeof b.bucket_name === "string" && Object.hasOwn(BUCKET_ROLES, b.bucket_name) ? BUCKET_ROLES[b.bucket_name] : null;
    if (!role) { missing.push(binding || "(an R2 bucket binding with no name)"); continue; }
    buckets.push({ binding, bucket: role });
  }
  const triggers = c.triggers === undefined ? {} : c.triggers;
  const crons = isBlock(triggers) && triggers.crons !== undefined ? triggers.crons : (isBlock(triggers) ? [] : null);
  if (!Array.isArray(crons) || !crons.every((x) => typeof x === "string" && x.trim()))
    missing.push("triggers.crons");
  const objects = ownDurableObjects(c, missing);
  if (missing.length) return { missing };
  if (!buckets.length && !crons.length && !objects) return { part: null };
  const descriptor = { r2_buckets: buckets, crons: [...crons], ...(objects ? { durable_objects: objects } : {}) };
  return { part: { descriptor, bytes: Buffer.from(JSON.stringify(descriptor, null, 2) + "\n") } };
}

/* ---- THE RELEASE IS COHERENT: EVERY BINDING NAMES WHAT THE RELEASE EXPORTS (bundler R39; K4176) ---------------------
 *
 * agent-worker 0.86.0 bound `REMOTE` to agent-runner's class `RemoteSession`, which agent-runner's bundle did not
 * export, and Cloudflare refused agent-worker (code 10061) at deploy: nothing on the build machine could see it. The
 * names a member's configuration binds are checked here against the names the bundles that would ship export, read from
 * the build's own metafile (never from the source, where a class can exist and not be exported). */

/** The names a built bundle exports (`default` included), from the build's metafile: the output that is the member's
 *  artifact, else the build's only output. */
export function bundleExports(member, built) {
  const outputs = (built && built.metafile && built.metafile.outputs) || {};
  const out = outputs[member.bundle.outfile] || Object.values(outputs)[0];
  return new Set(out && Array.isArray(out.exports) ? out.exports : []);
}

/** R39: the bindings of a release that name something the release does not export. `units` is the plane and every member
 *  the release carries, each `{name, config, exports}`: its parsed `wrangler.jsonc` (null: none) and the names its
 *  bundle exports. Returns one finding per binding, `{member, binding, name, text}`: `name` is the class or service,
 *  `text` says it for a person. A service names the plane or a member; a Durable Object binding with a `script_name`
 *  names a member exporting its class, one without names its own bundle's; a container class and each class a migration
 *  creates, renames to or transfers are its own bundle's. Never throws. */
export function bindingFindings(units) {
  const list = Array.isArray(units) ? units : [];
  const byName = new Map(list.map((u) => [u.name, u]));
  const names = (x) => (Array.isArray(x) ? x : []);
  const out = [];
  for (const u of list) {
    const c = isBlock(u.config) ? u.config : {};
    const mine = new Set(u.exports);
    const found = (binding, name, text) => out.push({ member: u.name, binding, name, text: `${u.name}: ${text}` });
    for (const s of names(c.services)) {
      if (!isBlock(s) || byName.has(s.service)) continue;
      found(s.binding, s.service, `service binding ${s.binding} names ${s.service}, which is neither the plane nor a member of this release`);
    }
    const dob = isBlock(c.durable_objects) ? c.durable_objects : {};
    for (const b of names(dob.bindings)) {
      if (!isBlock(b)) continue;
      const host = b.script_name === undefined || b.script_name === u.name ? u : byName.get(b.script_name);
      if (!host) found(b.name, b.class_name, `Durable Object binding ${b.name} names class ${b.class_name} of the script ${b.script_name}, which is not a member of this release`);
      else if (!new Set(host.exports).has(b.class_name))
        found(b.name, b.class_name, `Durable Object binding ${b.name} names class ${b.class_name}, which the bundle of ${host.name} does not export`);
    }
    for (const k of names(c.containers)) {
      if (isBlock(k) && !mine.has(k.class_name))
        found(k.class_name, k.class_name, `container class ${k.class_name} is not exported by its bundle`);
    }
    for (const m of names(c.migrations)) {
      if (!isBlock(m)) continue;
      const created = [...names(m.new_classes), ...names(m.new_sqlite_classes),
        ...names(m.renamed_classes).map((r) => (isBlock(r) ? r.to : undefined)),
        ...names(m.transferred_classes).map((r) => (isBlock(r) ? r.to : undefined))];
      for (const cls of created)
        if (typeof cls === "string" && !mine.has(cls)) found(`migration ${m.tag}`, cls, `migration ${m.tag} creates class ${cls}, which its bundle does not export`);
    }
  }
  return out;
}

/** R39 over a set of members (the plane's descriptor included): builds each without writing, reads its configuration
 *  and returns `{findings, unchecked}`; a member that cannot be built here is named in `unchecked` with why, never
 *  left out silently. */
export async function releaseBindingFindings(members) {
  const units = [], unchecked = [];
  for (const m of members) {
    let built, config = null;
    try { built = await buildMember(m, { write: false }); }
    catch (e) { unchecked.push({ name: m.name, reason: `a fresh build failed here: ${String(e.message).split("\n")[0]}` }); continue; }
    try { config = parseJsonc(readFileSync(join(m.abs, "wrangler.jsonc"), "utf8"), `${m.name}/wrangler.jsonc`); }
    catch (e) { if (e.code !== "ENOENT") { unchecked.push({ name: m.name, reason: String(e.message).split("\n")[0] }); continue; } }
    units.push({ name: m.name, config, exports: bundleExports(m, built) });
  }
  return { findings: bindingFindings(units), unchecked };
}

/** The three repository-relative paths a guarded member stands on. */
export function memberPaths(member, repoRoot = REPO_ROOT) {
  const rel = (p) => repoPath(repoRoot, join(member.abs, p));
  return {
    marker: rel("fleet-member.json"),
    artifact: member.bundle ? rel(member.bundle.outfile) : null,
    manifest: member.bundle ? rel(member.bundle.manifest) : null,
  };
}

/** D-238, one directory over: say which of the discovered items another checkout
 *  could actually see. The CALLER decides what to do with it — here the gate
 *  measures its floor against the REPRODUCIBLE count, because a floor met by a
 *  phantom is permanently too high and a ratchet that cannot pass is one that
 *  gets switched off. Never called by the build scripts: a build does not need
 *  git, and a build step that failed without it would be a new dependency
 *  nobody asked for. */
export function fleetProvenance(members, { repoRoot = REPO_ROOT, log = console.log } = {}) {
  const prov = readGitProvenance(repoRoot);
  const items = [];
  for (const m of members) {
    const p = memberPaths(m, repoRoot);
    items.push({ path: p.marker, what: `${m.name}'s fleet manifest`, counted: "enrolled the member" });
    if (p.artifact) items.push({ path: p.artifact, what: `${m.name}'s committed artifact`, counted: "guarded as one asset" });
    if (p.manifest) items.push({ path: p.manifest, what: `${m.name}'s bundle manifest`, counted: "the hashes every arm reads" });
  }
  return reportProvenance({ prov, items, instrument: "the fleet bundle guard",
    corpus: `${members.length} fleet member(s)`, log });
}

/* ---- A PURE-ASCII BUNDLE (bundler R2; T51 fix round 6, G39; diagnosis-R6-idle.md) ------------------------------------
 *
 * V8 holds a script's source one byte a character only when every character is ASCII; one character above U+00FF anywhere
 * in it makes it hold the WHOLE text two bytes a character. The plane's bundle was 32.5 MB of source held as 65 MB, which
 * is 36 MB of the 86 MB its Store idles at in workerd (measured in raw workerd by bisecting V8's old-space cap: 86 as built,
 * 76 with comments stripped alone, 50 pure ASCII). esbuild already writes strings and identifiers ASCII (`charset`); what
 * it leaves are its comments (`minifyWhitespace` strips them), the text of template literals (lowered to strings, which
 * `charset` then escapes) and the non-ASCII characters of regex literals, which no esbuild option escapes. So the recipe is
 * those three options and `asciiOutput`, a token-aware pass over the result: a string or regex literal's non-ASCII
 * character becomes `\uXXXX` (`\u{X}` for an astral one in a `u`/`v` regex), which means the same in both; a licence
 * banner (`legalComments: "eof"`, the default, kept) has its characters written as `\uXXXX` text; anything else, above all
 * the raw text of a template literal that was not lowered (which would change a tagged template's `raw`), refuses the build
 * `[NON_ASCII_REMAINS]` and is never edited.
 *
 * Which builds: a fleet member and the plane. The standalone case checker (`case-checker/build-program.mjs`, DEC-112) is the
 * open, auditable program a person reads, so its descriptor, which is neither, keeps its form; `bundle.ascii` (a boolean)
 * overrides the rule either way. The options are recorded in the manifest's `recipe.ascii` and `verifyStatic` checks them. */
export const ASCII_RECIPE = Object.freeze({ charset: "ascii", legalComments: "eof", minifyWhitespace: true, templateLiterals: "lowered" });

/** The esbuild options the recipe adds (for a caller that builds with its own esbuild call: pair them with `asciiOutput`). */
export const asciiOptions = () => ({ charset: ASCII_RECIPE.charset, legalComments: ASCII_RECIPE.legalComments,
  minifyWhitespace: ASCII_RECIPE.minifyWhitespace, supported: { "template-literal": false } });

/** Does this member's bundle get the pure-ASCII recipe? */
export const asciiOf = (member) =>
  member && member.bundle && typeof member.bundle.ascii === "boolean" ? member.bundle.ascii : !!(member && (member.marker || member.wholeWordTable));

const NON_ASCII = /[^\x00-\x7f]/gu;
const HAS_NON_ASCII = /[^\x00-\x7f]/;
const hex4 = (c) => `\\u${c.toString(16).padStart(4, "0")}`;
/** The ASCII spelling of `text`'s characters: surrogate pairs as two `\uXXXX`, or as one `\u{X}` when `braced`. */
function escapeChars(text, braced) {
  return text.replace(NON_ASCII, (ch) => {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) return braced ? `\\u{${cp.toString(16)}}` : hex4(0xd800 + ((cp - 0x10000) >> 10)) + hex4(0xdc00 + ((cp - 0x10000) & 0x3ff));
    return hex4(cp);
  });
}

/** R2: the bytes with every character above 0x7F escaped as above; the same bytes when there is none. Throws
 *  `REFUSED [NON_ASCII_REMAINS]` naming the line and the token when a character is anywhere else. */
export function asciiOutput(bytes) {
  let any = false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] > 0x7f) { any = true; break; }
  if (!any) return bytes;
  const text = Buffer.from(bytes).toString("utf8");
  const where = (pos) => `line ${text.slice(0, pos).split("\n").length}`;
  const refuse = (pos, what) => { throw new Error(`REFUSED [NON_ASCII_REMAINS]: a character above U+007F is in ${what} at ${where(pos)}, which the ASCII pass will not edit (bundler R2)`); };
  const edits = [];
  const comment = (_block, _t, start, end) => {
    const raw = text.slice(start, end);
    if (HAS_NON_ASCII.test(raw)) edits.push([start, end, escapeChars(raw, false)]);
  };
  for (const tok of acornTokenizer(text, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true, onComment: comment })) {
    const raw = text.slice(tok.start, tok.end);
    if (!HAS_NON_ASCII.test(raw)) continue;
    if (tok.type === acornTypes.string) edits.push([tok.start, tok.end, escapeChars(raw, false)]);
    else if (tok.type === acornTypes.regexp) {
      const flags = tok.value && tok.value.flags ? tok.value.flags : "";
      edits.push([tok.start, tok.end, escapeChars(raw, /[uv]/.test(flags))]);
    } else refuse(tok.start, tok.type === acornTypes.template ? "the raw text of a template literal" : `a ${tok.type.label} token`);
  }
  edits.sort((a, b) => a[0] - b[0]);
  let out = "", at = 0;
  for (const [start, end, to] of edits) { out += text.slice(at, start) + to; at = end; }
  out += text.slice(at);
  const left = out.search(HAS_NON_ASCII);
  if (left !== -1) refuse(left, "text outside every token");
  return Buffer.from(out, "latin1");
}

/** The esbuild options for one member. Exported so the build step and the gate
 *  cannot disagree about the recipe — there is one expression of it. */
export function optionsFor(member) {
  const b = member.bundle;
  return {
    absWorkingDir: member.abs,          /* PINNED — see the header. */
    preserveSymlinks: true,             /* the install LAYOUT never reaches the bytes — see the header. */
    entryPoints: [b.entry],
    outfile: b.outfile,
    bundle: true,
    format: RECIPE.format,
    platform: RECIPE.platform,
    external: [...(b.external || DEFAULT_EXTERNAL)],
    metafile: true,
    ...(asciiOf(member) ? asciiOptions() : {}),
  };
}

const isVendored = (p) => p.split("/").includes("node_modules");

/** The UPLOAD PARTS a member declares beside its bundle, member-relative.
 *  Absent for every member that is a one-part upload, which is both of the
 *  members that existed before `ocr-worker`. Read through one function so the
 *  build step, the manifest and the gate cannot disagree about what an asset is
 *  — the same rule the recipe itself follows. */
export function assetsOf(member) {
  const a = member && member.bundle ? member.bundle.assets : null;
  return Array.isArray(a) ? a.filter((p) => typeof p === "string" && p) : [];
}

/* ---- THE WORD ROWS A MEMBER CARRIES (bundler R38; K3953) ----------------------------------------------------------
 *
 * `setup-words/rows.mjs` is the interface's whole word table (some 18,000 rows, 3.4 MB). A fleet member reads a few
 * dozen keys of it, yet bundled whole it is parsed on every cold start. So a member's bundle carries only the rows its
 * own inputs can read, found in two steps: a PROBE build (the table stubbed empty) names the member's first-party
 * inputs; each is parsed with the vendored parser setup-words itself uses (never a pattern), and every call of `word`,
 * `localize` or `hasWord` gives its first argument's literal key, or the literal prefix a built key starts with
 * (`'refusal.' + code`, `` `refusal.${code}` ``). The real build then replaces the `rows.mjs` import with a module of
 * exactly those rows (all the rows named, all the rows under a prefix), in the table's own order.
 *
 * A key with no literal prefix (a bare variable, a call's result: a wrapper reading a variable key) cannot be bounded, and
 * neither can anything that could read the table other than through a call: `word` used as a value, `WORD_ROWS`
 * imported outside setup-words' own index, a dynamic import of the table. For such a member the build keeps the WHOLE
 * table, never failing and never leaving a row out, and its manifest says `words: "all"` with `wordSites`, every site by
 * file and line (K3958): each is an entry of its own module's job, and once none is left every member keeps only its own
 * rows. The plane's bundle carries the whole table (`wholeWordTable`), as does any build that is not a fleet member's
 * (the standalone case checker's), and a member whose inputs do not reach the table
 * is built exactly as before and records nothing. */
const WORD_FUNCTIONS = new Set(["word", "localize", "hasWord"]);
const WORD_ROWS_PATH = /(^|[\\/])setup-words[\\/]rows\.mjs$/;
const WORD_INDEX_PATH = /(^|[\\/])setup-words[\\/]index\.mjs$/;
const SCOPES = /^(Program|BlockStatement|StaticBlock|SwitchStatement|CatchClause|ForStatement|ForInStatement|ForOfStatement|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;

/** The names a binding pattern declares. */
function patternNames(p, into) {
  if (!p) return;
  if (p.type === "Identifier") into.add(p.name);
  else if (p.type === "ObjectPattern") p.properties.forEach((q) => patternNames(q.type === "RestElement" ? q.argument : q.value, into));
  else if (p.type === "ArrayPattern") p.elements.forEach((q) => patternNames(q, into));
  else if (p.type === "AssignmentPattern") patternNames(p.left, into);
  else if (p.type === "RestElement") patternNames(p.argument, into);
}

/** The names a scope-making node declares for its own body (parameters and function name, `var`s anywhere inside it
 *  but a nested function, the lets, consts, classes and functions of its statement lists, an exported one too). Import
 *  bindings are left out: `word` imported is the call this reads. The rule of setup-words' build, so both agree on
 *  what a call is. */
function declaredNames(node) {
  const into = new Set();
  const hoist = (n, top) => {
    if (!n || typeof n.type !== "string") return;
    if ((n.type === "ExportNamedDeclaration" || n.type === "ExportDefaultDeclaration") && n.declaration) return hoist(n.declaration, top);
    if (n.type === "VariableDeclaration") for (const d of n.declarations) { if (n.kind === "var" || top) patternNames(d.id, into); }
    else if ((n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") && n.id) { if (top) into.add(n.id.name); return; }
    if (/Function/.test(n.type) || n.type === "ClassBody") return;
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => hoist(c, false));
      else if (v && typeof v.type === "string") hoist(v, false);
    }
  };
  if (/Function/.test(node.type)) {
    node.params.forEach((q) => patternNames(q, into));
    if (node.type === "FunctionExpression" && node.id) into.add(node.id.name);
    hoist(node.body, false);
    if (node.body.type === "BlockStatement") node.body.body.forEach((st) => hoist(st, true));
  } else if (node.type === "Program" || node.type === "BlockStatement" || node.type === "StaticBlock") {
    node.body.forEach((st) => hoist(st, true));
    node.body.forEach((st) => hoist(st, false));
  } else if (node.type === "SwitchStatement") node.cases.forEach((c) => c.consequent.forEach((st) => hoist(st, true)));
  else if (node.type === "CatchClause") patternNames(node.param, into);
  else if (/^For(In|Of)?Statement$/.test(node.type)) { const i = node.init ?? node.left; if (i?.type === "VariableDeclaration") hoist(i, true); }
  return into;
}

/** What a key expression starts with, as `[{text, whole}]` (`whole`: the text is the entire key), or null when some
 *  branch has no literal prefix: a string, a template, a `+` chain from its left, both arms of a `?:`, `||` or `??`. */
function keyShapes(node) {
  if (!node) return null;
  if (node.type === "Literal") return typeof node.value === "string" ? [{ text: node.value, whole: true }] : null;
  if (node.type === "TemplateLiteral") {
    if (node.expressions.length === 0) return [{ text: node.quasis[0].value.cooked, whole: true }];
    const head = node.quasis[0].value.cooked;
    return head ? [{ text: head, whole: false }] : null;
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = keyShapes(node.left);
    if (!left) return null;
    const right = keyShapes(node.right);
    return left.flatMap((l) => {
      if (!l.whole) return [l];
      return right ? right.map((r) => ({ text: l.text + r.text, whole: r.whole })) : [{ text: l.text, whole: false }];
    });
  }
  if (node.type === "ConditionalExpression") {
    const a = keyShapes(node.consequent), b = keyShapes(node.alternate);
    return a && b ? [...a, ...b] : null;
  }
  if (node.type === "LogicalExpression" && (node.operator === "||" || node.operator === "??")) {
    const a = keyShapes(node.left), b = keyShapes(node.right);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

/** R38: what one source text asks of the word table: `{exact, prefixes, sites}` (sets of keys and of literal prefixes,
 *  and a `where:line: why` for each call whose key has no literal prefix, each use of `word` other than as a callee,
 *  and each read of the whole table). `index` is true for setup-words' own index, the one input that holds `WORD_ROWS`. */
export function wordKeysOf(source, where, { index = false } = {}) {
  const options = { ecmaVersion: "latest", locations: true, allowHashBang: true, allowReturnOutsideFunction: true };
  let ast;
  try { ast = acornParse(source, { ...options, sourceType: "module" }); }
  catch { try { ast = acornParse(source, { ...options, sourceType: "script" }); }
    catch (e) { throw new Error(`${where} cannot be parsed to find the word rows it reads: ${e.message}`); } }
  const exact = new Set(), prefixes = new Set();
  const sites = [];
  const refuse = (node, why) => { sites.push(`${where}:${node.loc.start.line}: ${why}`); };
  const visit = (node, parent, shadowed) => {
    if (!node || typeof node.type !== "string") return;
    if (SCOPES.test(node.type)) {
      const own = declaredNames(node);
      if ([...WORD_FUNCTIONS].some((f) => own.has(f))) shadowed = new Set([...shadowed, ...[...WORD_FUNCTIONS].filter((f) => own.has(f))]);
    }
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && WORD_FUNCTIONS.has(node.callee.name) && !shadowed.has(node.callee.name)) {
      const name = node.callee.name;
      const arg = node.arguments[0];
      const shapes = arg && arg.type !== "SpreadElement" ? keyShapes(arg) : null;
      if (!shapes || shapes.some((s) => s.text === "")) refuse(node, `the key of ${name}(…) has no literal prefix, so the word rows it can read are unknown; write the key, or a literal prefix and the rest (bundler R38)`);
      else for (const s of shapes) (s.whole ? exact : prefixes).add(s.text);
    } else if (node.type === "Identifier" && WORD_FUNCTIONS.has(node.name) && !shadowed.has(node.name)) {
      const p = parent;
      const named = !p
        || (p.type === "CallExpression" && p.callee === node)
        || p.type === "ImportSpecifier" || p.type === "ExportSpecifier" || p.type === "ImportDefaultSpecifier"
        || (p.type === "MemberExpression" && p.property === node && !p.computed)
        || (p.type === "Property" && p.key === node && !p.computed && !p.shorthand)
        || (p.type === "MethodDefinition" && p.key === node && !p.computed) || (p.type === "PropertyDefinition" && p.key === node && !p.computed)
        || (p.type === "FunctionDeclaration" && p.id === node) || (p.type === "VariableDeclarator" && p.id === node);
      if (!named) refuse(node, `${node.name} is used other than as a call, so the word rows it can read are unknown (bundler R38)`);
    }
    if (!index && node.type === "ImportDeclaration" && (WORD_ROWS_PATH.test(String(node.source.value))
        || node.specifiers.some((s) => s.type === "ImportSpecifier" && s.imported.name === "WORD_ROWS")))
      refuse(node, "imports the whole word table, which a member's bundle does not carry (bundler R38)");
    if (!index && (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source
        && (WORD_ROWS_PATH.test(String(node.source.value))
          || (node.specifiers || []).some((s) => s.local && s.local.name === "WORD_ROWS")))
      refuse(node, "re-exports the whole word table, which a member's bundle does not carry (bundler R38)");
    if (node.type === "ImportExpression" && !(node.source.type === "Literal" && !WORD_ROWS_PATH.test(String(node.source.value))))
      refuse(node, "imports a module by a dynamic address, which could read the whole word table (bundler R38)");
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, node, shadowed));
      else if (v && typeof v.type === "string") visit(v, node, shadowed);
    }
  };
  visit(ast, null, new Set());
  return { exact, prefixes, sites };
}

/** R38 trims the bundle of a fleet member (one a `fleet-member.json` enrols, which `discoverMembers` marks). The plane
 *  (`wholeWordTable`) and any other descriptor handed to `buildMember` (the standalone case checker's) carry the table whole. */
const trimsWords = (member) => !!member.marker && !member.wholeWordTable;
const isWordRows = (p) => WORD_ROWS_PATH.test(p);
const SOURCE_EXT = /\.(mjs|js|cjs)$/;
const WORD_STUB = "export const WORDS_COMMIT = \"\";\nexport const WORD_ROWS = Object.freeze([]);\n";

/** An esbuild plugin that answers the `rows.mjs` import with `contents` (the stub, or the trimmed module). */
const wordRowsPlugin = (contents) => ({
  name: "bundler-r38-word-rows",
  setup(b) { b.onLoad({ filter: WORD_ROWS_PATH }, () => ({ contents, loader: "js" })); },
});

/** R38: the word rows a member keeps, or null when its inputs do not reach the table (or it is the plane, which
 *  carries the whole table). `probe` is a build of the member with the table stubbed out. Returns `{rows, total,
 *  text, sha256}`: the kept rows' count, the table's size, the module that stands for the table in the bundle and the
 *  SHA-256 of the kept rows; or, when some site could read any row (K3958), `{rows: "all", total, sites, text: null}`
 *  and the table is left whole. */
export async function keptWordRows(member, probe) {
  const paths = Object.keys(probe.metafile.inputs);
  const rowsInput = paths.find(isWordRows);
  if (!trimsWords(member) || !rowsInput) return null;
  const exact = new Set(), prefixes = new Set(), sites = [];
  for (const p of paths) {
    if (isWordRows(p) || isVendored(p) || !SOURCE_EXT.test(p)) continue;
    const keys = wordKeysOf(readFileSync(join(member.abs, p), "utf8"), p, { index: WORD_INDEX_PATH.test(p) });
    keys.exact.forEach((k) => exact.add(k));
    keys.prefixes.forEach((k) => prefixes.add(k));
    sites.push(...keys.sites);
  }
  const table = await import(pathToFileURL(join(member.abs, rowsInput)).href);
  if (sites.length)
    return { rows: "all", total: table.WORD_ROWS.length, text: null, sha256: null,
      sites: [...new Set(sites.map((x) => x.match(/^(.*?:\d+): /)[1]))].sort() };
  const prefixList = [...prefixes];
  const kept = table.WORD_ROWS.filter((r) => exact.has(r[0]) || prefixList.some((pre) => r[0].startsWith(pre)));
  const body = kept.map((r) => `  ${JSON.stringify(r)},`).join("\n");
  const text = "/* GENERATED INTO THE BUNDLE by bundler R38: the rows of the word table this member's inputs can read, "
    + `${kept.length} of ${table.WORD_ROWS.length}, in the table's order. */\n`
    + `export const WORDS_COMMIT = ${JSON.stringify(table.WORDS_COMMIT)};\n`
    + `export const WORD_ROWS = Object.freeze([\n${body}\n]);\n`;
  return { rows: kept.length, total: table.WORD_ROWS.length, text, sha256: sha256(JSON.stringify(kept)) };
}

/** R38: the manifest's account of the word rows a build carries, as the fields to spread into it: `{words: {rows,
 *  sha256}}` for a trimmed table, `{words: "all", wordSites}` for the whole table kept for the sites named, `{}` for a
 *  member whose inputs do not reach the table or the plane. */
export const wordsManifest = (w) => !w ? {} : w.rows === "all" ? { words: "all", wordSites: w.sites } : { words: { rows: w.rows, sha256: w.sha256 } };

/** Build one member. `write: false` (the default) NEVER touches the tree. */
export async function buildMember(member, { write = false, mutateEntry = null } = {}) {
  /* Silent: a failure arrives as the thrown error, never as stray stderr. */
  const opts = { ...optionsFor(member), write: false, logLevel: "silent" };   /* esbuild never writes: R2's pass runs on the bytes first */
  /* R38: which word rows this member's bundle carries (null: the whole table, or none reachable). */
  let words = null;
  if (trimsWords(member)) {
    const probe = await build({ ...optionsFor(member), write: false, logLevel: "silent", plugins: [wordRowsPlugin(WORD_STUB)] });
    words = await keptWordRows(member, probe);
  }
  opts.plugins = words && words.text ? [wordRowsPlugin(words.text)] : [];
  /* The independence proof's hook, and the ONLY way anything mutates a source
     here: an in-memory suffix on the ENTRY's contents. Nothing on disk moves.
     **A CALLER MUST PASS SOMETHING THAT SURVIVES THE BUILD.** esbuild STRIPS
     ordinary comments, so a comment-only suffix produces a BYTE-IDENTICAL bundle
     — measured 2026-09-10, and it is the reason the input-hash arm is not
     redundant with the byte-identity arm but STRICTER than it. */
  if (mutateEntry) {
    opts.plugins.push({
      name: "fl9-mutate-entry",
      setup(b) {
        const entryAbs = join(member.abs, member.bundle.entry);
        b.onLoad({ filter: /\.mjs$/ }, (args) => {
          if (resolve(args.path) !== resolve(entryAbs)) return null;
          return { contents: readFileSync(args.path, "utf8") + mutateEntry, loader: "js" };
        });
      },
    });
  }
  const res = await build(opts);
  let bytes = Buffer.from(res.outputFiles[0].contents);
  if (asciiOf(member)) bytes = asciiOutput(bytes);
  if (write) {
    mkdirSync(join(member.abs, dirname(member.bundle.outfile)), { recursive: true });
    writeFileSync(join(member.abs, member.bundle.outfile), bytes);
  }
  const inputs = Object.entries(res.metafile.inputs)
    .map(([path, v]) => ({ path, bytes: v.bytes }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { bytes, sha256: sha256(bytes), inputs, metafile: res.metafile, words };
}

/** The committed manifest, computed from a build. */
export function manifestFrom(member, built) {
  const hashOf = (rel) => {
    try { return sha256(readFileSync(join(member.abs, rel))); } catch { return null; }
  };
  const first = built.inputs.filter((i) => !isVendored(i.path));
  const vendored = built.inputs.filter((i) => isVendored(i.path));
  const assets = assetsOf(member);
  let lock = null;
  try {
    lock = { path: "package-lock.json", sha256: sha256(readFileSync(join(member.abs, "package-lock.json"))) };
  } catch { /* a member with no dependencies has no lock, and that is legal */ }
  return {
    _comment: "GENERATED by bio-plane/scripts/fleet-bundle.mjs. Do not edit. "
      + "The gate bio-plane/test/system/fleetbundles.test.mjs asserts every figure here against the tree; "
      + "a stale artifact FAILS instead of shipping (FL-9, BOB 2026-09-10).",
    member: member.name,
    artifact: member.bundle.outfile,
    sha256: built.sha256,
    bytes: built.bytes.length,
    recipe: {
      entry: member.bundle.entry,
      format: RECIPE.format,
      platform: RECIPE.platform,
      external: [...(member.bundle.external || DEFAULT_EXTERNAL)],
      absWorkingDir: "<member directory>",   /* pinned; never an absolute path, which would not travel */
      esbuild: ESBUILD_VERSION,
      ascii: asciiOf(member) ? { ...ASCII_RECIPE } : false,   /* R2, G39 */
    },
    /* Paths are as ESBUILD names them, which — with `absWorkingDir` pinned — is
       member-relative and therefore identical in every checkout. THREE of
       `pdf-worker`'s six inputs are `../bio-plane/src/*`, so a change to the
       PLANE stales a fleet member's artifact. That was true before this item and
       written down nowhere (IC-68, finding 3). */
    inputs: first.map((i) => ({ path: i.path, bytes: i.bytes, sha256: hashOf(i.path) })),
    vendoredInputs: vendored.map((i) => ({ path: i.path, bytes: i.bytes, sha256: hashOf(i.path) })),
    /* ---- CPDF-10: THE UPLOAD PARTS A BUNDLE CANNOT SWALLOW ------------------
     *
     * `ocr-worker` is the first member that is NOT a one-part upload, and it is
     * not one for a PLATFORM reason rather than a build one: Workers FORBID
     * runtime wasm compilation, so `tesseract-core.wasm` must arrive as a module
     * the platform compiled at upload time. No bundler makes that one part.
     * Its language model rides the same way so the exact bytes are hashed here
     * rather than fetched at runtime from somewhere nothing pins.
     *
     * Those files are declared as `bundle.external`, which means ESBUILD NEVER
     * SEES THEM and they appear in no `inputs` list — so without this arm the
     * staleness guard would cover every line of the member's source and NONE of
     * the 5.95 MB that actually decides what its output says. A guard with that
     * shape is the FL-9 defect one directory over.
     *
     * THE KEY IS EMITTED ONLY FOR A MEMBER THAT DECLARES ASSETS, so
     * `pdf-worker`'s and `agent-worker`'s committed manifests are byte-unchanged
     * by this addition — asserted in `fleetbundles.test.mjs`, not assumed. An
     * asset a member declares and does not HAVE is `sha256: null`, which
     * `verifyStatic` treats as staleness rather than as an absence to tolerate:
     * unlike a vendored dependency, an upload part is committed, so it is never
     * legitimately missing. */
    ...(assets.length ? { assets: assets.map((rel) => ({
      path: rel,
      bytes: (() => { try { return readFileSync(join(member.abs, rel)).length; } catch { return null; } })(),
      sha256: hashOf(rel),
    })) } : {}),
    /* R38: the word rows the bundle carries, only for a member whose inputs reach the table. */
    ...wordsManifest(built.words),
    lock,
  };
}

/** Write the artifact and its manifest. The ONLY writing path in this module. */
export async function writeMember(member) {
  mkdirSync(join(member.abs, dirname(member.bundle.outfile)), { recursive: true });
  const built = await buildMember(member, { write: true });
  const manifest = manifestFrom(member, built);
  writeFileSync(join(member.abs, member.bundle.manifest), JSON.stringify(manifest, null, 2) + "\n");
  return { built, manifest };
}

/* ------------------------------------------------------------- the specifier
 * scan: "can an installer upload this as ONE part and have it resolve?"
 *
 * Read off the COMMITTED BYTES, never off the build, because the committed bytes
 * are what an installer would ship.
 *
 * **IT SCANS STATIC IMPORT AND EXPORT STATEMENTS, AND THAT FENCE IS DELIBERATE
 * RATHER THAN LEFT UNDONE.** Those are the set a one-part upload must resolve at
 * module INSTANTIATION, which is the property in question. A first draft also
 * matched `import("...")` anywhere in the text and reported `pdf-worker` as
 * unresolvable over a STRING inside pdf.js's dead CDN-wrapper helper — a regex
 * cannot tell code from string content, and a guard that cries wolf gets
 * switched off. The authoritative, PARSER-derived list of everything the output
 * still imports, dynamic imports included, is checked separately in
 * `verifyFresh` from esbuild's own metafile, wherever a fresh build is runnable.
 * Two instruments, each honest about its reach. */
/** Is `specifier` one of the `allowed` externals? A trailing `*` is a prefix. */
const isAllowed = (allowed, specifier) =>
  allowed.some((a) => (a.endsWith("*") ? specifier.startsWith(a.slice(0, -1)) : specifier === a));

export function unresolvableSpecifiers(text, allowed = DEFAULT_EXTERNAL) {
  const ok = (s) => isAllowed(allowed, s);
  const found = new Set();
  const re = /(?:^|[;}\n])\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g;   /* `}`: a minified statement can follow one (R2) */
  const bare = /(?:^|[;}\n])\s*import\s*["']([^"']+)["']/g;
  for (const re2 of [re, bare]) {
    let m;
    while ((m = re2.exec(text))) if (!ok(m[1])) found.add(m[1]);
  }
  return [...found].sort();
}

/* --------------------------------------------------------------- the checks */
/* Every check returns FINDINGS — a finding is a failure, an empty list is a
   pass — and every finding NAMES THE MEMBER, because the item's own acceptance
   says the gate must fail naming the member. */

/** The dependency-free half. Runs on any checkout, with no install at all. */
export function verifyStatic(member) {
  const findings = [];
  const add = (what) => findings.push(`${member.name}: ${what}`);

  /* R24: a container member with no Worker bundle has no artifact to be stale. It
     is listed, and `guarded: false` says so, so no caller reads it as checked. */
  if (!isGuarded(member)) return { findings, manifest: null, committed: null, guarded: false };

  if (!member.bundle) {
    add("declares no `bundle` block in fleet-member.json, so nothing guards its artifact. "
      + "Every fleet member commits a guarded bundle (FL-9, BOB 2026-09-10).");
    return { findings, manifest: null, committed: null };
  }

  let manifest;
  try { manifest = JSON.parse(readFileSync(join(member.abs, member.bundle.manifest), "utf8")); }
  catch (e) {
    add(`its committed manifest ${member.bundle.manifest} is missing or unreadable (${e.message}). `
      + `${REBUILD}.`);
    return { findings, manifest: null, committed: null };
  }

  let committed;
  try { committed = readFileSync(join(member.abs, member.bundle.outfile)); }
  catch (e) {
    add(`its committed artifact ${member.bundle.outfile} is missing (${e.message}). `
      + `${REBUILD}.`);
    return { findings, manifest, committed: null };
  }

  /* (a) the artifact is the one the manifest describes */
  const got = sha256(committed);
  if (got !== manifest.sha256)
    add(`the committed artifact does not match its own manifest — `
      + `${member.bundle.outfile} is sha256 ${got}, the manifest says ${manifest.sha256}.`);
  if (committed.length !== manifest.bytes)
    add(`the committed artifact is ${committed.length} B, the manifest says ${manifest.bytes} B.`);

  /* (b) THE ARM THIS ITEM EXISTS FOR — a source moved and the artifact did not.
     Dependency-free, so it fires on every machine including a fresh checkout. */
  for (const inp of manifest.inputs || []) {
    let live;
    try { live = readFileSync(join(member.abs, inp.path)); }
    catch {
      add(`a recorded build input has vanished: ${inp.path}. The committed bundle cannot be `
        + `reproduced, so it is STALE by definition. ${REBUILD}.`);
      continue;
    }
    const liveSha = sha256(live);
    if (liveSha !== inp.sha256)
      add(`STALE BUNDLE — the source ${inp.path} has changed since ${member.bundle.outfile} was built `
        + `(source is now sha256 ${liveSha}, the bundle was built from ${inp.sha256}). `
        + `${REBUILD}, and commit the artifacts with the change.`);
  }
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0)
    add("its manifest records NO first-party inputs, so the dependency-free staleness arm would "
      + "pass over any source change at all. An empty input list is the emptiest possible green.");

  /* (b2) A VENDORED INPUT THAT IS PRESENT IS CHECKED TOO. Absent, it is not a
     finding — a fresh checkout has no member install and that is the normal
     condition, not a defect. Present and DIFFERENT is staleness exactly like any
     other input, and catching it here rather than only in the byte-identity arm
     means it is caught even when that arm is skipped for some other member. */
  for (const inp of manifest.vendoredInputs || []) {
    let live;
    try { live = readFileSync(join(member.abs, inp.path)); } catch { continue; }
    const liveSha = sha256(live);
    if (liveSha !== inp.sha256)
      add(`STALE BUNDLE — the vendored input ${inp.path} has changed since ${member.bundle.outfile} `
        + `was built (now sha256 ${liveSha}, the bundle was built from ${inp.sha256}). `
        + `${REBUILD}.`);
  }

  /* (b3) CPDF-10 — THE UPLOAD PARTS. Dependency-free like (b), and it is the
     arm that matters most for the member that has them: `ocr-worker`'s stated
     transcription fidelity is a measurement OF the exact wasm core and language
     model bytes it carries, so a model swapped underneath it makes a `cap` in
     the record a claim about something else. THREE conditions, and the third is
     the one an `inputs`-shaped arm would not have:

       - a declared asset that is ABSENT is staleness, not a tolerated gap. An
         upload part is COMMITTED (unlike a vendored dependency, which is
         legitimately missing in a fresh checkout), so absent means the artifact
         cannot be reproduced or installed.
       - a declared asset whose bytes MOVED is staleness in the ordinary way.
       - an asset the member DECLARES and the manifest does not RECORD — the
         asymmetry, and the direction that fails open: a member could otherwise
         gain a part that nothing hashes simply by being rebuilt with an older
         library. The manifest is checked against the member's declaration, not
         only the other way round. */
  const declaredAssets = assetsOf(member);
  const recordedAssets = Array.isArray(manifest.assets) ? manifest.assets : [];
  for (const rel of declaredAssets) {
    const rec = recordedAssets.find((a) => a && a.path === rel);
    if (!rec) {
      add(`it declares the upload asset ${rel} and its committed manifest records NO hash for it, `
        + `so nothing would notice those bytes changing. ${REBUILD}.`);
      continue;
    }
    let live = null;
    try { live = readFileSync(join(member.abs, rel)); } catch { /* named below */ }
    if (!live) {
      add(`STALE BUNDLE — the declared upload asset ${rel} is MISSING. An upload part is committed, `
        + `so an absent one means this member cannot be installed or reproduced. `
        + `Restore it. ${REBUILD}.`);
      continue;
    }
    const liveSha = sha256(live);
    if (liveSha !== rec.sha256)
      add(`STALE BUNDLE — the upload asset ${rel} has changed since ${member.bundle.outfile} was built `
        + `(now sha256 ${liveSha}, the manifest records ${rec.sha256}). This member's stated fidelity `
        + `is a measurement OF these bytes, so a swap here is a claim about something else. `
        + `Re-measure the engine. ${REBUILD}.`);
    if (rec.bytes != null && live.length !== rec.bytes)
      add(`STALE BUNDLE — the upload asset ${rel} is ${live.length} B, the manifest says ${rec.bytes} B.`);
  }
  for (const rec of recordedAssets)
    if (rec && !declaredAssets.includes(rec.path))
      add(`its committed manifest records an upload asset ${rec.path} the member no longer declares. `
        + `An asset that stops being declared stops being shipped, which is a change nobody stated. `
        + `${REBUILD}.`);

  /* (c) the lock moved without a rebuild */
  let liveLock = null;
  try { liveLock = sha256(readFileSync(join(member.abs, "package-lock.json"))); } catch { /* none */ }
  const recordedLock = manifest.lock ? manifest.lock.sha256 : null;
  if (liveLock !== recordedLock)
    add(`STALE BUNDLE — package-lock.json has changed since the bundle was built `
      + `(lock is now ${liveLock ?? "absent"}, the bundle was built against ${recordedLock ?? "no lock"}). `
      + `${REBUILD}.`);

  /* (d) the recipe the manifest records is the recipe the member declares, and
     the toolchain that built it is the toolchain in the tree. A bundle built by
     an esbuild no longer installed cannot be reproduced, which is staleness. */
  const want = {
    entry: member.bundle.entry,
    format: RECIPE.format,
    platform: RECIPE.platform,
    external: [...(member.bundle.external || DEFAULT_EXTERNAL)],
    absWorkingDir: "<member directory>",
    esbuild: ESBUILD_VERSION,
    ascii: asciiOf(member) ? { ...ASCII_RECIPE } : false,
  };
  for (const k of Object.keys(want)) {
    const a = JSON.stringify(want[k]), b = JSON.stringify((manifest.recipe || {})[k]);
    if (a !== b)
      add(`the committed manifest's recipe.${k} is ${b}, the tree says ${a}. `
        + (k === "esbuild"
          ? "A bundle built by a toolchain that is no longer installed cannot be reproduced. "
          : "")
        + `${REBUILD}.`);
  }

  /* (e) INSTALLABLE WITHOUT BUNDLING — the property `newgroup` needs, asserted
     against the committed bytes rather than against the build. */
  const unresolved = unresolvableSpecifiers(committed.toString("utf8"), manifest.recipe?.external || DEFAULT_EXTERNAL);
  if (unresolved.length)
    add(`its committed artifact still imports ${unresolved.join(", ")}, which a one-part script `
      + "upload cannot resolve — so an installer that cannot bundle could not install it.");

  return { findings, manifest, committed };
}

/** Is the fresh-build arm runnable here? A member with no vendored inputs is
 *  always runnable; one with them needs those bytes present. Named rather than
 *  guessed, so a SKIP says exactly what is absent and what to do. */
export function freshBuildRunnable(member, manifest) {
  const missing = (manifest.vendoredInputs || [])
    .filter((i) => { try { readFileSync(join(member.abs, i.path)); return false; } catch { return true; } })
    .map((i) => i.path);
  return missing.length
    ? { runnable: false, reason: `${missing.length} vendored input(s) are not installed, e.g. ${missing[0]} `
        + `— run \`npm ci\` in ${member.dir}/ to make the byte-identity arm runnable here` }
    : { runnable: true, reason: null };
}

/** The full half: a fresh build of the SOURCE, byte-compared with the artifact
 *  that was read from disk BEFORE this ran. Never writes.
 *
 *  Returns `{ checked: true, findings, built }`, or, where the member's committed
 *  manifest names vendored inputs that are not installed here or the source
 *  does not build here, `{ checked: false, reason, findings: null, built: null }`: it could not check,
 *  and there is no empty list of findings a caller could read as fresh. */
export async function verifyFresh(member, committed) {
  /* R24: nothing to rebuild, and that is neither stale nor fresh. */
  if (!isGuarded(member))
    return { checked: false, guarded: false, findings: null, built: null,
      reason: `${member.name}: not checked — a container member with no Worker bundle is not bundle-guarded (bundler R24)` };
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(join(member.abs, member.bundle.manifest), "utf8")); }
  catch { /* no manifest to read: the build itself is the test of what is installed */ }
  if (manifest) {
    const { runnable, reason } = freshBuildRunnable(member, manifest);
    if (!runnable) return { checked: false, reason: `${member.name}: not checked — ${reason}`, findings: null, built: null };
  }
  let built;
  try { built = await buildMember(member, { write: false }); }
  catch (e) {
    /* A source that does not build here (a dependency not installed, with no
       manifest to say so first) is not a fresh artifact: say it was not checked. */
    return { checked: false, reason: `${member.name}: not checked — a fresh build of ${member.bundle.entry} `
      + `failed here: ${String(e.message).split("\n").slice(0, 2).join(" ")}`, findings: null, built: null };
  }
  const findings = [];
  if (Buffer.compare(built.bytes, committed) !== 0)
    findings.push(`${member.name}: STALE BUNDLE — a fresh build of ${member.bundle.entry} is `
      + `${built.bytes.length} B / sha256 ${built.sha256}, the committed ${member.bundle.outfile} is `
      + `${committed.length} B / sha256 ${sha256(committed)}. They must be byte-identical. `
      + `${REBUILD}, and commit the artifacts with the change.`);

  /* R38: the rows kept are covered too. The bytes already carry them; this names the disagreement, and catches a
     manifest that records rows a fresh build no longer keeps (or keeps none of). */
  if (manifest) {
    const was = JSON.stringify({ words: manifest.words, wordSites: manifest.wordSites });
    const now = JSON.stringify(wordsManifest(built.words));
    if (was !== now)
      findings.push(`${member.name}: STALE BUNDLE — the manifest's word rows are ${was}, a fresh build's are ${now}. ${REBUILD}, and commit the artifacts with the change.`);
  }

  /* THE PARSER'S OWN ANSWER to "what does this output still import", which is the
     half a lexical scan of the bytes cannot give honestly — it covers DYNAMIC
     imports too, and it cannot mistake a string for a statement. It is available
     only here, because it comes out of a build. */
  const allowed = member.bundle.external || DEFAULT_EXTERNAL;
  for (const out of Object.values(built.metafile.outputs || {}))
    for (const imp of out.imports || [])
      if (imp.external !== false && !isAllowed(allowed, imp.path))
        findings.push(`${member.name}: the built module still imports ${imp.path} (${imp.kind}), `
          + "which a one-part script upload cannot resolve — so an installer that cannot bundle "
          + "could not install it.");
  return { checked: true, findings, built };
}

/* ---- THE SIZE AND START-UP BUDGETS (bundler R31; N840, K2547) -----------------
 *
 * Cloudflare takes a Worker of up to 64 MiB uncompressed and gives its global scope 1 s to evaluate. Nothing measured
 * either until T42: the plane went from 8.0 MiB to 14.6 MiB in five days (K2547) and no check could see it. So every
 * fleet member's built artifact, and the plane's, is measured against a budget with room below the platform's limit:
 * past 32 MiB is a warning, past 48 MiB a failure; a global scope slower than 500 ms is a warning. Each figure is
 * printed by the fleet gate, so BOB reports them at each layer close.
 *
 * THE START-UP TIME IS A FRESH IMPORT IN THIS PROCESS (Node, not workerd), and what that measures is stated rather
 * than assumed:
 *   - `cloudflare:*` cannot be imported outside workerd, so each is answered by a stub that exports every name the
 *     artifact imports from it (a class; `env` an object). The stub costs nothing measurable; what the artifact's own
 *     global scope does with those names is still run.
 *   - an upload part (`bundle.assets`) arrives on the platform already compiled (wasm) or as bytes, so it is read and
 *     compiled BEFORE the clock starts and handed to the import as that value: the timed window is the artifact's own
 *     load, parse, link and global-scope evaluation, which is what the platform's limit is about.
 *   - the import is fresh: a URL no earlier import used, so a module cache can never make a second run free.
 * The hooks that do this are registered for the one import and removed after it, and reach only the artifact's own
 * imports. Node's and workerd's V8 differ in flags and machines differ in speed, so the figure is a measurement to
 * watch and warn on, never a failure. */
export const MIB = 1024 * 1024;
export const BUDGET = Object.freeze({ sizeWarn: 32 * MIB, sizeFail: 48 * MIB, startWarnMs: 500 });

const mib = (n) => `${(n / MIB).toFixed(1)} MiB`;

/** R31, size: `{bytes, verdict, finding, warning}` for an artifact of `bytes`: `fail` past `sizeFail` (a finding),
 *  `warn` past `sizeWarn` (a warning), else `ok`. "Past" is strictly greater. */
export function sizeVerdict(member, bytes, budget = BUDGET) {
  const at = `${member.name}: its built artifact ${member.bundle ? member.bundle.outfile : ""} is ${bytes} B (${mib(bytes)})`;
  if (bytes > budget.sizeFail)
    return { bytes, verdict: "fail", warning: null,
      finding: `${at}, past the fleet's size budget of ${mib(budget.sizeFail)} (Cloudflare's limit is 64 MiB per Worker). `
        + "Splitting the plane into further Workers is an architecture question for Bob (K2547)." };
  if (bytes > budget.sizeWarn)
    return { bytes, verdict: "warn", finding: null, warning: `${at}, past the warning budget of ${mib(budget.sizeWarn)}.` };
  return { bytes, verdict: "ok", finding: null, warning: null };
}

/** R31, start-up: `{ms, verdict, warning}`: `warn` past `startWarnMs`, else `ok`. Never a failure (see above). */
export function startVerdict(member, ms, budget = BUDGET) {
  if (ms > budget.startWarnMs)
    return { ms, verdict: "warn",
      warning: `${member.name}: its global scope took ${ms.toFixed(0)} ms to evaluate on a fresh import, past the warning `
        + `budget of ${budget.startWarnMs} ms (the platform allows 1 s).` };
  return { ms, verdict: "ok", warning: null };
}

/* The names an artifact imports statically from each `cloudflare:*` specifier, so its stub can export exactly them. */
function cloudflareImports(text) {
  const out = new Map();
  for (const m of text.matchAll(/(?:^|[;}\n])\s*import\s*\{([^}]*)\}\s*from\s*["'](cloudflare:[^"']+)["']/g)) {
    const names = out.get(m[2]) || new Set();
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
    out.set(m[2], names);
  }
  return out;
}

let freshImport = 0;

/** R31: the time to evaluate a member's built artifact's global scope, by a fresh import in this process.
 *  `{measured: true, ms}`, or `{measured: false, reason}` when the artifact cannot be read or its import throws (the
 *  reason names it). `artifact` overrides the path (member-relative); nothing is written. */
export async function measureStart(member, { artifact = member.bundle && member.bundle.outfile } = {}) {
  const { registerHooks } = await import("node:module");
  const abs = join(member.abs, artifact);
  let text;
  try { text = readFileSync(abs, "utf8"); }
  catch (e) { return { measured: false, reason: `${member.name}: its built artifact ${artifact} cannot be read (${e.message})` }; }
  const artifactUrl = pathToFileURL(abs).href;
  const url = `${artifactUrl}?r31-fresh=${process.pid}-${++freshImport}-${Date.now()}`;
  const stubs = new Map();
  for (const [spec, names] of cloudflareImports(text)) {
    const body = [...names].map((n) => (n === "env" ? `export const env = {};` : `export class ${n} {}`)).join("\n");
    stubs.set(spec, `data:text/javascript,${encodeURIComponent(body || "export {};")}`);
  }
  /* The upload parts, compiled and read BEFORE the clock starts, as the platform has them before the global scope runs. */
  const parts = new Map();
  const key = `__bundlerR31Parts${freshImport}`;
  try {
    for (const rel of assetsOf(member)) {
      const bytes = readFileSync(join(member.abs, rel));
      parts.set(pathToFileURL(join(member.abs, rel)).href,
        rel.endsWith(".wasm") ? new WebAssembly.Module(bytes) : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
    }
  } catch (e) {
    return { measured: false, reason: `${member.name}: an upload part cannot be read or compiled (${e.message})` };
  }
  globalThis[key] = Object.fromEntries(parts);
  const fromArtifact = (ctx) => typeof ctx.parentURL === "string" && ctx.parentURL.split("?")[0] === artifactUrl;
  const hooks = registerHooks({
    resolve(spec, ctx, next) {
      if (fromArtifact(ctx)) {
        if (stubs.has(spec)) return { url: stubs.get(spec), shortCircuit: true };
        const target = new URL(spec, artifactUrl).href;
        if (parts.has(target)) return { url: `bundler-r31-part:${encodeURIComponent(target)}`, shortCircuit: true };
      }
      return next(spec, ctx);
    },
    load(u, ctx, next) {
      if (u.startsWith("bundler-r31-part:")) {
        const target = decodeURIComponent(u.slice("bundler-r31-part:".length));
        return { format: "module", shortCircuit: true,
          source: `export default globalThis[${JSON.stringify(key)}][${JSON.stringify(target)}];` };
      }
      return next(u, ctx);
    },
  });
  try {
    const t0 = performance.now();
    await import(url);
    return { measured: true, ms: performance.now() - t0 };
  } catch (e) {
    return { measured: false, reason: `${member.name}: a fresh import of ${artifact} threw: ${String(e && e.message).split("\n")[0]}` };
  } finally {
    hooks.deregister();
    delete globalThis[key];
  }
}

/** R31, the whole check for one member: its size and its start-up time against `budget`. `findings` are failures;
 *  `warnings` are printed, never failed; `line` is the one line the gate prints for the member. */
export async function budgetReport(member, budget = BUDGET) {
  const findings = [], warnings = [];
  let bytes = null;
  try { bytes = readFileSync(join(member.abs, member.bundle.outfile)).length; }
  catch (e) { findings.push(`${member.name}: its built artifact ${member.bundle.outfile} cannot be read (${e.message}), so its size is unmeasured`); }
  const size = bytes === null ? null : sizeVerdict(member, bytes, budget);
  if (size && size.finding) findings.push(size.finding);
  if (size && size.warning) warnings.push(size.warning);
  const run = await measureStart(member);
  const start = run.measured ? startVerdict(member, run.ms, budget) : null;
  if (!run.measured) findings.push(`${run.reason}, so its start-up time is unmeasured`);
  if (start && start.warning) warnings.push(start.warning);
  const line = `${member.name}: ${bytes === null ? "size unmeasured" : `${bytes} B (${mib(bytes)}) ${size.verdict}`} · `
    + `${start ? `global scope ${start.ms.toFixed(0)} ms ${start.verdict}` : "start-up unmeasured"}`;
  return { name: member.name, bytes, size: size && size.verdict, ms: start ? start.ms : null, start: start && start.verdict,
    findings, warnings, line };
}
