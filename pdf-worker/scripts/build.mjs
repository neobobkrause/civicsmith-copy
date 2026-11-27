#!/usr/bin/env node
/* Build the pdf-worker into ONE self-contained module, `dist/pdf-worker.bundled.mjs`,
 * with its manifest `dist/pdf-worker.bundle.json`. Neither is committed (R45;
 * ARCH's decision "Committed built files"): `dist/` holds only a `.gitignore`,
 * and this script builds the two there whenever a test, a deployment or a
 * release needs them.
 *
 * `unpdf` (pdf.js) is INLINED here and never enters the plane's module graph:
 * that separation is the whole point of the fleet (adding unpdf to the plane
 * broke 21 miniflare suites — a bare npm specifier cannot resolve in the plane's
 * un-bundled source, MEASUREMENTS.md 2026-07-31).
 *
 * ---- FL-9, 2026-09-10: THE RECIPE MOVED, AND SO DID WHAT THIS PRODUCES ------
 *
 * The esbuild options are not written here. They live in
 * `bio-plane/scripts/fleet-bundle.mjs`, the one recipe this script, the
 * module's test subject (`test/subject.mjs`) and the release tooling all build
 * with. The manifest states the artifact's sha256, its byte length, the exact
 * recipe, and the sha256 of every input.
 *
 * Run from pdf-worker/: `npm run build`.
 */
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

const member = discoverMembers().find((m) => m.name === "pdf-worker");
if (!member) throw new Error("pdf-worker declares no fleet-member.json — it cannot be discovered");
const bundle = member.bundle;
if (!bundle) throw new Error("pdf-worker/fleet-member.json declares no `bundle` block");

const { built, manifest } = await writeMember(member);
console.log(`pdf-worker: built ${bundle.outfile}`
  + ` — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`pdf-worker: wrote ${bundle.manifest}`
  + ` — ${manifest.inputs.length} first-party input(s), ${manifest.vendoredInputs.length} vendored`);
