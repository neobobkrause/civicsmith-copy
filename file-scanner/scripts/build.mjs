#!/usr/bin/env node
/* Build the Worker that answers file-scanner's binding and hosts its two container classes (R10) into one
 * self-contained module, committed, with the manifest beside it, by bundler's recipe, as every fleet member's bundle is
 * (bundler R24). `@cloudflare/containers` is a devDependency inlined here; neither image installs it.
 *
 * Run from file-scanner/: `npm run build` (needs `npm ci` here and in bio-plane/, which holds esbuild).
 */
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

const member = discoverMembers().find((m) => m.name === "file-scanner");
if (!member) throw new Error("file-scanner declares no fleet-member.json — it cannot be discovered");
if (!member.bundle) throw new Error("file-scanner/fleet-member.json declares no `bundle` block");

const { built, manifest } = await writeMember(member);
console.log(`file-scanner: built ${member.bundle.outfile} — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`file-scanner: wrote ${member.bundle.manifest} — ${manifest.inputs.length} first-party input(s), `
  + `${manifest.vendoredInputs.length} vendored`);
