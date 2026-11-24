#!/usr/bin/env node
/* Build the pdf-worker into ONE self-contained module. The output is committed
 * so a fresh worktree's suite (`test/structure.test.mjs`) can load it under
 * miniflare without installing `unpdf` — exactly as the plane commits
 * dist/bio-plane.bundled.mjs.
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
 * This step now also writes `dist/pdf-worker.bundle.json` — the artifact's
 * sha256, its byte length, the exact recipe, and the sha256 of every input — so
 * the staleness check runs on a checkout with no `node_modules` at all. This
 * member had committed a bundle since 2026-07-31 with nothing asserting it
 * matched its source; DIST measured that gap on 2026-09-10 and it is what FL-9
 * closes for BOTH members.
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
