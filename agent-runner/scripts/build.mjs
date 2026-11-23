#!/usr/bin/env node
/* Build the Worker that hosts agent-runner's container (R12) into one self-contained module in `dist/`, with the
 * manifest beside it (its sha256 and every input's), by bundler's recipe, as every fleet member's bundle is
 * (bundler R24: a container member that declares a `bundle` is guarded like any member). `@cloudflare/containers`
 * is a devDependency inlined here; the image never installs it (`npm ci --omit=dev`).
 *
 * R43: nothing in `dist/` is committed but its `.gitignore`; the bundle and manifest are built there by this script
 * whenever a test, a deployment or a release needs them. Each file is written whole to a temporary name and renamed
 * into place, so test files building at once never read a half-written bundle.
 *
 * Run from agent-runner/: `npm run build` (needs `npm ci` here and in bio-plane/, which holds esbuild). Tests call
 * `buildAgentRunner()`.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverMembers, buildMember, manifestFrom } from "../../bio-plane/scripts/fleet-bundle.mjs";

/** agent-runner's fleet member, as bundler discovers it. */
export function agentRunnerMember() {
  const member = discoverMembers().find((m) => m.name === "agent-runner");
  if (!member) throw new Error("agent-runner declares no fleet-member.json — it cannot be discovered");
  bundleOf(member);
  return member;
}

/** The member's `bundle` block; a member without one cannot be built. */
const bundleOf = (member) => {
  if (!member.bundle) throw new Error("agent-runner/fleet-member.json declares no `bundle` block");
  return member.bundle;
};

/** Write `data` to `path` whole: a temporary file beside it, then one rename. */
function writeWhole(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/** Build the bundle and its manifest into `dist/`; answers `{built, manifest, bundlePath, manifestPath}`. */
export async function buildAgentRunner() {
  const member = agentRunnerMember();
  const built = await buildMember(member, { write: false });
  const manifest = manifestFrom(member, built);
  const bundle = bundleOf(member);
  const bundlePath = join(member.abs, bundle.outfile);
  const manifestPath = join(member.abs, bundle.manifest);
  writeWhole(bundlePath, built.bytes);
  writeWhole(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return { built, manifest, bundlePath, manifestPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bundle = bundleOf(agentRunnerMember());
  const { built, manifest } = await buildAgentRunner();
  console.log(`agent-runner: built ${bundle.outfile} — ${built.bytes.length} B, sha256 ${built.sha256}`);
  console.log(`agent-runner: wrote ${bundle.manifest} — ${manifest.inputs.length} first-party input(s), `
    + `${manifest.vendoredInputs.length} vendored`);
}
