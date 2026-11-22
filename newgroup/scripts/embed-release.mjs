/* Embeds the current bio-plane release into the wizard as a string, so the
 * wizard uploads exactly one module into the group's account and depends on
 * no repository, no CDN, and no second fetch at install time.
 *
 * Run from newgroup/: `npm run embed`. Expects the sibling ../bio-plane tree
 * with its devDependencies installed (esbuild does the bundling there).
 *
 * WHY THIS REFUSES (D-106, 2026-07-31). The installer shipped 0.35.0 while the
 * plane ran 0.48.0, thirteen releases, and nobody noticed. The cause was not a
 * forgotten build step: this script read the embedded version out of
 * `bio-plane/wrangler.jsonc`, and NOTHING ELSE IN THE TREE READS THAT FIELD.
 * `scripts/deploy.mjs` binds VERSION from its command line, so every release
 * since 0.35.0 deployed correctly while the config literal sat untouched. A
 * field with exactly one reader, and that reader a build step whose output
 * nobody inspects, is a field that rots invisibly. Re-running the old script
 * today would still have embedded 0.35.0.
 *
 * So: `bio-plane/package.json` is the AUTHORITY, because that is the version a
 * release is cut from and the version RELEASE.json carries. Every other place
 * the version appears must agree with it or this refuses to build. The check is
 * equality, never a comparison: "newer" is not a defence, because a wrangler
 * config ahead of package.json is the same class of drift in the other
 * direction and equally worth stopping.
 *
 * WHY THIS NO LONGER BUILDS (2026-09-18, DIST). This script used to run
 * `npm run build` in bio-plane and embed whatever the working tree compiled
 * to, labelled with package.json's version. Between releases that is NOT the
 * signed release: measured on 5ea27761, the committed embed was the signed
 * 0.58.0 asset (sha256 72fce1e9...) and one `npm run embed` replaced it with
 * an unsigned build of 834 later commits (9efea448...) still calling itself
 * 0.58.0. `npm test` and `npm run build` both ran it, so the installer's own
 * gate put an unsigned plane under a signed version's name, and the installer
 * installs its built-in copy WITHOUT verifying it (it is the fallback). So the
 * embed now COPIES the signed asset from release/ and refuses unless the bytes
 * hash to RELEASE.json's sha256, carry a signature that verifies against the
 * installer's own ARMED_SIGNERS, and name the version package.json names.
 * It builds nothing and is idempotent: between cuts it rewrites the same file.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { verifySshsig, NS_RELEASE, NS_FLEET, fleetStatement } from "../../bio-plane/src/sshsig.mjs";
import { ARMED_SIGNERS, planeLimits, reportsBuilds } from "../src/steps/index.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Resolve the version to embed, or throw naming the disagreement.
 *
 *  Pure, taking the file CONTENTS rather than paths, so the refusal can be
 *  tested without a build and without a fixture tree on disk. Every throw says
 *  which file is authority and what to change, because the person who trips
 *  this is mid-release and should not have to read the script to act on it.
 */
export function resolveVersion({ packageJson, wranglerJsonc }) {
  let pkg;
  try { pkg = JSON.parse(packageJson); }
  catch (e) { throw new Error(`bio-plane/package.json does not parse: ${e.message}`); }

  const version = pkg && pkg.version;
  if (typeof version !== "string" || !SEMVER.test(version)) {
    throw new Error(
      `bio-plane/package.json has no usable "version" (got ${JSON.stringify(version)}). `
      + "It is the authority for what the installer embeds; nothing can be built without it.");
  }

  const m = /"VERSION":\s*"([^"]*)"/.exec(wranglerJsonc);
  if (!m) {
    throw new Error(
      "bio-plane/wrangler.jsonc declares no VERSION var. It is the version `wrangler dev` "
      + `binds locally, so it must agree with package.json (${version}) or local runs lie `
      + "about which plane they are.");
  }
  if (m[1] !== version) {
    throw new Error(
      "REFUSING TO EMBED: version sources disagree.\n"
      + `  bio-plane/package.json    ${version}   <- authority, cut releases from this\n`
      + `  bio-plane/wrangler.jsonc  ${m[1]}\n`
      + "This is D-106: wrangler.jsonc's VERSION has no other reader, so it drifts silently "
      + "and the installer ships whatever it last said. Set wrangler.jsonc to "
      + `"VERSION": "${version}" and build again.`);
  }
  return version;
}

/** Every published token value that must not survive into the artifact. */
export function publishedTokens(secretsTxt) {
  return secretsTxt.trim().split("\n").map((l) => l.split("=")[1]).filter(Boolean);
}

/** Refuse unless `bytes` are the release RELEASE.json describes, for the
 *  version the tree names. Pure except for the signature check, which is the
 *  installer's own verifier against the installer's own keys. Returns null,
 *  or the reason in words a person mid-release can act on. */
export async function checkSignedAsset({ manifest, bytes, version, signers = ARMED_SIGNERS }) {
  if (!manifest || typeof manifest !== "object") return "release/RELEASE.json is missing or does not parse.";
  if (manifest.version !== version) {
    return `REFUSING TO EMBED: release/RELEASE.json is ${JSON.stringify(manifest.version)} but bio-plane/package.json `
      + `is ${version}. Only a SIGNED release is embedded; cut and sign ${version} `
      + "(node bio-plane/scripts/release-assemble.mjs --sign) before embedding it.";
  }
  const got = createHash("sha256").update(bytes).digest("hex");
  if (got !== manifest.sha256) {
    return `REFUSING TO EMBED: release/${manifest.asset} hashes ${got.slice(0, 16)}... but RELEASE.json `
      + `records ${String(manifest.sha256).slice(0, 16)}.... The asset is not the release that was signed.`;
  }
  if (!signers.length) return "REFUSING TO EMBED: the installer lists no ARMED_SIGNERS, so nothing can vouch for the asset.";
  if (typeof manifest.sig !== "string" || !manifest.sig.trim()) return "REFUSING TO EMBED: RELEASE.json carries no signature.";
  const v = await verifySshsig(manifest.sig, new Uint8Array(bytes), NS_RELEASE, signers);
  if (!v.ok) return `REFUSING TO EMBED: the release signature does not verify against the installer's keys (${v.reason}).`;
  return null;
}

/** R23 (T46; N897 (4)): the container classes the release names, `[{member, class_name, image}]`, read from its signed
 *  fleet statement's `Container` parts, so the install and update pages can say before the install begins which part
 *  the release this installer carries cannot install. A release naming no signed fleet names none (`[]`). A fleet that is
 *  named but does not verify against the installer's own keys, or a part whose bytes are not the ones it signed, or a
 *  description that does not read, refuses the embed: the pages state only what the release signed. `readPart(member,
 *  path)` answers a part's bytes (from `release/<member>/<path>`). */
export async function releaseContainers({ manifest, readPart, signers = ARMED_SIGNERS }) {
  if (!Array.isArray(manifest.fleet) || !manifest.fleet.length || !manifest.fleetSig) return [];
  let payload;
  try {
    payload = fleetStatement({ version: manifest.version,
      plane: { sha256: manifest.sha256, bytes: manifest.bytes, asset: manifest.asset || "bio-plane.bundled.mjs" },
      members: manifest.fleet });
  } catch (e) { throw new Error(`REFUSING TO EMBED: the release's fleet statement cannot be rebuilt (${e.message}).`); }
  const v = await verifySshsig(manifest.fleetSig, new TextEncoder().encode(payload), NS_FLEET, signers);
  if (!v.ok) throw new Error(`REFUSING TO EMBED: the release's fleet signature does not verify against the installer's keys (${v.reason}).`);
  const out = [];
  for (const m of manifest.fleet) for (const p of (m.parts || []).filter((x) => x.type === "Container")) {
    let bytes;
    try { bytes = readPart(m.member, p.path); }
    catch { throw new Error(`REFUSING TO EMBED: release/${m.member}/${p.path}, a part the fleet statement signs, is missing.`); }
    if (createHash("sha256").update(bytes).digest("hex") !== p.sha256)
      throw new Error(`REFUSING TO EMBED: release/${m.member}/${p.path} is not the part the fleet statement signs.`);
    let d;
    try { d = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { d = null; }
    if (!d || typeof d.class_name !== "string" || typeof d.image !== "string")
      throw new Error(`REFUSING TO EMBED: release/${m.member}/${p.path} names no class and image.`);
    out.push({ member: m.member, class_name: d.class_name, image: d.image });
  }
  return out;
}

/** R33 (K3441, K3442; K4210): the release PACKED, the signed bytes gzipped and written as base64 in a JavaScript string literal
 *  (printable ASCII only). At 0.86.0 the plane is 29 MB; held as a string in the bundle it was held twice by the engine (the
 *  bundle's source text and the literal's heap string), and the real-size install and update went past a Worker's memory. Packed it
 *  is 10 MB as base64, and the installer expands it once, a few MB at a time, into the one Blob the act uploads (`index.mjs`,
 *  `builtInRelease`), checking the bytes it gets against the manifest's `sha256`. Deterministic: the same bytes always give the
 *  same literal (gzip level 9, no name or time in the header). */
export function packedLiteral(bytes) {
  return '"' + gzipSync(bytes, { level: 9 }).toString("base64") + '"';
}

/** The embed (R26): resolve the version, check the signed asset, refuse any published token value, and write
 *  `release.mjs` as generated. Takes its directories so the whole step runs against a fixture tree; `main` passes the
 *  real ones. Throws the reason in words; returns what it wrote. */
export async function embedRelease({ planeDir, releaseDir, out, signers = ARMED_SIGNERS }) {
  const version = resolveVersion({
    packageJson: readFileSync(path.join(planeDir, "package.json"), "utf8"),
    wranglerJsonc: readFileSync(path.join(planeDir, "wrangler.jsonc"), "utf8"),
  });

  const manifest = JSON.parse(readFileSync(path.join(releaseDir, "RELEASE.json"), "utf8"));
  const bytes = readFileSync(path.join(releaseDir, manifest.asset || "bio-plane.bundled.mjs"));
  const refused = await checkSignedAsset({ manifest, bytes, version, signers });
  if (refused) throw new Error(refused);
  const src = bytes.toString("utf8");

  /* Refuse to embed a release that still contains any published token value.
     The denylist protects the runtime; this protects the artifact. */
  for (const s of publishedTokens(readFileSync(path.join(planeDir, "SECRETS.txt"), "utf8"))) {
    if (src.includes(s)) throw new Error("published token value found in the bundled release; refusing to embed");
  }

  /* R23 (T46): the container images the signed fleet names, for the pages. */
  const containers = await releaseContainers({ manifest, signers,
    readPart: (member, p) => readFileSync(path.join(releaseDir, member, p)) });

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out,
    "/* GENERATED by scripts/embed-release.mjs. Do not edit. */\n"
    + `export const RELEASE_VERSION = ${JSON.stringify(version)};\n`
    + `export const RELEASE_CONTAINERS = Object.freeze(${JSON.stringify(containers)}.map((c) => Object.freeze(c)));\n`
    /* R61: the release's own signed manifest (its fleet statement and signatures), so the built-in plane is installed with its
       own members and never with another release's. */
    + `export const RELEASE_MANIFEST = Object.freeze(${JSON.stringify(manifest)});\n`
    /* What the installer reads from the release's text (R20's limits, R15's build fields) is read here, from the verified bytes, so
       the installer need not expand the release to know it. */
    + `export const RELEASE_FACTS = Object.freeze(${JSON.stringify({ limits: planeLimits(bytes), capable: reportsBuilds(bytes) })});\n`
    + `export const RELEASE_PACKED = ${packedLiteral(bytes)};\n`);
  return { version, sha256: manifest.sha256, bytes: bytes.length, containers: containers.length };
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const { version, sha256, bytes, containers } = await embedRelease({ planeDir: path.resolve(here, "../../bio-plane"),
    releaseDir: path.resolve(here, "../../release"), out: path.resolve(here, "../src/release.mjs") });
  console.log(`embedded the SIGNED bio-plane ${version} (sha256 ${sha256.slice(0, 16)}...), ${bytes} bytes, naming ${containers} container class(es), into src/release.mjs`);
}

/* Importable for tests without running a build. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
