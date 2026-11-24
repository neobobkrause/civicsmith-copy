#!/usr/bin/env node
/* Build the Worker that hosts agent-runner's container (R12) into one self-contained module, committed, with the
 * manifest beside it (its sha256 and every input's), by bundler's recipe, as every fleet member's bundle is
 * (bundler R24: a container member that declares a `bundle` is guarded like any member). `@cloudflare/containers`
 * is a devDependency inlined here; the image never installs it (`npm ci --omit=dev`).
 *
 * Run from agent-runner/: `npm run build` (needs `npm ci` here and in bio-plane/, which holds esbuild).
 */
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

const member = discoverMembers().find((m) => m.name === "agent-runner");
if (!member) throw new Error("agent-runner declares no fleet-member.json — it cannot be discovered");
if (!member.bundle) throw new Error("agent-runner/fleet-member.json declares no `bundle` block");

const { built, manifest } = await writeMember(member);
console.log(`agent-runner: built ${member.bundle.outfile} — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`agent-runner: wrote ${member.bundle.manifest} — ${manifest.inputs.length} first-party input(s), `
  + `${manifest.vendoredInputs.length} vendored`);
