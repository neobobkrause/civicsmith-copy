#!/usr/bin/env node
/* Build agent-worker into ONE self-contained module, committed.
 *
 * ---- WHY THIS FILE EXISTS, AND WHOSE DECISION IT IS -------------------------
 *
 * `wrangler.jsonc` recorded FLEET's ruling that THE SOURCE DEPLOYS, NOT A
 * BUNDLE, because a committed bundle is "a second place its version lives and a
 * committed artifact that can drift from its source (D-106's class)". The ruling
 * named its own reversal condition. **BOB reversed it on 2026-09-10**, under the
 * standing delegation and as MECHANISM rather than doctrine, answering DIST's
 * DELEGATION: adopt the GUARD pattern.
 *
 * The forcing fact is DIST's, measured: **`newgroup` is a Worker. It cannot run
 * `wrangler` and it cannot bundle**, and this member is several modules
 * (`index.mjs` imports its own files and `agent-harness`', `agent-model`'s and the plane's), so the one-part
 * script upload an installer has cannot resolve them. An installable fleet needs
 * one bundled, hashed, signed artifact per member.
 *
 * **The drift objection is ANSWERED, not overruled.** The committed artifact
 * ships beside `dist/agent-worker.bundle.json` — its sha256, its byte length,
 * the exact recipe, and the sha256 of every input — and
 * `bio-plane/test/system/fleetbundles.test.mjs` asserts the artifact is byte-identical
 * to a fresh build of its source. **A stale artifact FAILS instead of shipping.**
 * That is the instrument this record always reaches for: a hash-verified copy of
 * exact bytes, never a second codebase.
 *
 * THE MEMBER STILL DEPENDS ON NOTHING FROM npm. The recipe lives in
 * `bio-plane/scripts/fleet-bundle.mjs` and `esbuild` resolves from the plane's
 * install, the same way `newgroup/scripts/embed-release.mjs` already expects
 * "the sibling ../bio-plane tree with its devDependencies installed".
 *
 * Run from agent-worker/: `npm run build`.
 */
import { discoverMembers, writeMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

const member = discoverMembers().find((m) => m.name === "agent-worker");
if (!member) throw new Error("agent-worker declares no fleet-member.json — it cannot be discovered");
if (!member.bundle) throw new Error("agent-worker/fleet-member.json declares no `bundle` block");

const { built, manifest } = await writeMember(member);
console.log(`agent-worker: built ${member.bundle.outfile}`
  + ` — ${built.bytes.length} B, sha256 ${built.sha256}`);
console.log(`agent-worker: wrote ${member.bundle.manifest}`
  + ` — ${manifest.inputs.length} first-party input(s), ${manifest.vendoredInputs.length} vendored`);
