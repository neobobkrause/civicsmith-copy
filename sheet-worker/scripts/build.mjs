#!/usr/bin/env node
/* Build sheet-worker's bundle and manifest through bundler's one recipe (`bio-plane/scripts/fleet-bundle.mjs`),
 * which the fleet guard also builds with when it checks the committed artifact. The engine wasm is built separately
 * (`npm run build:engine`) and committed; this step hashes it into the manifest as an upload part.
 * Run from sheet-worker/: `npm run build`. */
import { fileURLToPath } from "node:url";
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

/** @returns {Promise<void>} */
async function main() {
  const member = discoverMembers().find((m) => m.name === "sheet-worker");
  const bundle = member ? member.bundle : undefined;
  if (!member || !bundle) throw new Error("sheet-worker/fleet-member.json is missing or declares no bundle");
  const { built, manifest } = await writeMember(member);
  console.log(`sheet-worker: built ${bundle.outfile} — ${built.bytes.length} B, sha256 ${built.sha256}`);
  console.log(`sheet-worker: wrote ${bundle.manifest} — ${manifest.inputs.length} first-party input(s), `
    + `${manifest.vendoredInputs.length} vendored, ${(manifest.assets || []).length} upload asset(s)`);
  for (const a of manifest.assets || []) console.log(`            asset ${a.path} — ${a.bytes} B, sha256 ${a.sha256}`);
}

/* Run as a script only, so that importing this file builds nothing (R21). */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
