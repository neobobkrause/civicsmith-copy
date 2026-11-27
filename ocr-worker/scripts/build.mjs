#!/usr/bin/env node
/* Build the ocr-worker into ONE self-contained module, PLUS the two upload parts
 * a wasm member cannot bundle away.
 *
 * The esbuild recipe is NOT written here. It lives in
 * `bio-plane/scripts/fleet-bundle.mjs`, which is also what
 * `bio-plane/test/system/fleetbundles.test.mjs` builds with when it asserts this
 * committed artifact is byte-identical to a fresh build of its source. One
 * expression of the recipe, or the build and the guard can disagree and the
 * guard is the one that would be wrong.
 *
 * THE PRE-STEP NO OTHER MEMBER HAS, and it is the plane's `embed:sign` shape:
 * `src/tesslib.mjs` is GENERATED from `node_modules/tesseract-wasm/dist/lib.js`
 * by two anchored substitutions (read `scripts/embed-tesslib.mjs` for which
 * measurement refused the alternative in each case). The render is COMMITTED and
 * input-hashed like any other source, and the gate closes the loop the input
 * hashes cannot see — a changed vendor whose render was never re-run — by
 * re-rendering in memory and comparing. Nothing in the gate writes.
 *
 * Run from ocr-worker/: `npm run build`. `--embed-only` regenerates the glue and
 * stops, which is what a vendor bump wants before it rebuilds.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";
import { renderFromVendor, TESSLIB_OUT, TESSLIB_VENDOR } from "./embed-tesslib.mjs";

const embedOnly = process.argv.includes("--embed-only");

const rendered = renderFromVendor();
if (rendered == null) {
  /* NAMED, never silently skipped. A build that quietly kept a committed render
     it could not verify is exactly the staleness this whole guard exists for. */
  console.log(`ocr-worker: tesseract-wasm is not installed (${TESSLIB_VENDOR} is absent), so`
    + ` src/tesslib.mjs was NOT regenerated. Run \`npm ci\` in ocr-worker/ before a vendor bump;`
    + ` the committed render stands and the gate's re-render arm will SKIP BY NAME here.`);
  if (embedOnly) process.exit(2);
} else {
  const before = (() => { try { return readFileSync(TESSLIB_OUT, "utf8"); } catch { return null; } })();
  if (before !== rendered) {
    writeFileSync(TESSLIB_OUT, rendered);
    console.log(`ocr-worker: regenerated src/tesslib.mjs from the vendor (${rendered.length} B)`);
  } else {
    console.log("ocr-worker: src/tesslib.mjs is already the render of the installed vendor");
  }
  if (embedOnly) process.exit(0);
}

const member = discoverMembers().find((m) => m.name === "ocr-worker");
if (!member) throw new Error("ocr-worker declares no fleet-member.json — it cannot be discovered");
const bundle = member.bundle;
if (!bundle) throw new Error("ocr-worker/fleet-member.json declares no `bundle` block");

const { built, manifest } = await writeMember(member);
console.log(`ocr-worker: built ${bundle.outfile}`
  + ` — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`ocr-worker: wrote ${bundle.manifest}`
  + ` — ${manifest.inputs.length} first-party input(s), ${manifest.vendoredInputs.length} vendored,`
  + ` ${(manifest.assets || []).length} upload asset(s)`);
for (const a of manifest.assets || [])
  console.log(`            asset ${a.path} — ${a.bytes} B, sha256 ${a.sha256}`);
