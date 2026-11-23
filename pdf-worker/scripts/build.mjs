#!/usr/bin/env node
/* Build the pdf-worker into ONE self-contained module, in `dist/`. The output is
 * never committed (R45; ARCH's decision "Committed built files", 22 Nov 2026):
 * `dist/` holds only a `.gitignore`, and whatever needs the bundle — a test, a
 * deployment, a release — builds it here first by running this script.
 *
 * `unpdf` (pdf.js) is INLINED here and never enters the plane's module graph:
 * that separation is the whole point of the fleet (adding unpdf to the plane
 * broke 21 miniflare suites — a bare npm specifier cannot resolve in the plane's
 * un-bundled source, MEASUREMENTS.md 2026-07-31).
 *
 * ---- FL-9, 2026-09-10: THE RECIPE MOVED, AND SO DID WHAT THIS PRODUCES ------
 *
 * The esbuild options are no longer written here. They live in
 * `bio-plane/scripts/fleet-bundle.mjs`, which is ALSO what
 * `bio-plane/test/system/fleetbundles.test.mjs` builds with when it asserts this
 * committed artifact is byte-identical to a fresh build of its source. **One
 * expression of the recipe, or the build and the guard can disagree and the
 * guard is the one that would be wrong.**
 *
 * This step also writes `dist/pdf-worker.bundle.json` — the artifact's sha256,
 * its byte length, the exact recipe, and the sha256 of every input — beside the
 * bundle it describes.
 *
 * Run from pdf-worker/: `npm run build`.
 */
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

const member = discoverMembers().find((m) => m.name === "pdf-worker");
if (!member) throw new Error("pdf-worker declares no fleet-member.json — it cannot be discovered");
if (!member.bundle) throw new Error("pdf-worker/fleet-member.json declares no `bundle` block");

const { built, manifest } = await writeMember(member);
console.log(`pdf-worker: built ${member.bundle.outfile}`
  + ` — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`pdf-worker: wrote ${member.bundle.manifest}`
  + ` — ${manifest.inputs.length} first-party input(s), ${manifest.vendoredInputs.length} vendored`);
