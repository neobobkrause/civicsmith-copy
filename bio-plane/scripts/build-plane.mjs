#!/usr/bin/env node
/* Build the PLANE into its committed one-part bundle, plus the manifest the
 * FL-9 gate reads — the plane's thin caller on agent-worker's pattern (FL-10).
 *
 * D-298 is why this exists: the committed `dist/bio-plane.bundled.mjs` was 114
 * commits stale against `src` and nothing could tell, because a test of the
 * artifact proves it WORKS, never that it MATCHES. The recipe lives in
 * `scripts/fleet-bundle.mjs` — ONE expression, shared with both fleet members
 * and with the gate that verifies all three.
 *
 * The build calls no step that generates a source file (bundler R16): the
 * bundle is cut from the committed sources alone, so a stale committed source
 * is named by the gate and never silently regenerated here.
 *
 * Run from bio-plane/: `npm run build`.
 */
import { planeMember, writeMember } from "./fleet-bundle.mjs";

const plane = planeMember();
const bundle = plane.bundle;
if (!bundle) throw new Error("bio-plane: the plane's descriptor declares no bundle (bundler's planeMember)");
const { built, manifest } = await writeMember(plane);
console.log(`bio-plane: built ${bundle.outfile}`
  + ` — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`bio-plane: wrote ${bundle.manifest}`
  + ` — ${manifest.inputs.length} first-party input(s), ${manifest.vendoredInputs.length} vendored`);
