/* bundler's recipe tests: the fixtures they build. Every member here is a tiny fixture written into a temporary
 * directory; nothing reads or builds the repository's own fleet, the plane, or any later module's file. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, dirname } from "node:path";
import { discoverMembers } from "../../../../scripts/fleet-bundle.mjs";

/** @typedef {import("../../../../scripts/fleet-bundle.mjs").Member} Member */
/** @typedef {Member & {bundle: import("../../../../scripts/fleet-bundle.mjs").BundleBlock}} BundledMember */

export const hex = (b) => createHash("sha256").update(b).digest("hex");

/** A temporary directory and its removal. */
export function scratch(tag) {
  const root = mkdtempSync(join(tmpdir(), `bundler-recipe-${tag}-`));
  return { root, done: () => rmSync(root, { recursive: true, force: true }) };
}

/** Write `files` ({relative path: text}) under `abs`. */
export function put(abs, files) {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(abs, rel)), { recursive: true });
    writeFileSync(join(abs, rel), text);
  }
}

/** A fixture fleet member under `root/dir`, discovered as `discoverMembers` lists it: a two-file first-party source,
 *  optionally one vendored dependency under node_modules (`fakedep`), a lockfile, and the declared externals. `src`
 *  replaces `src/index.mjs`; `files` adds more; `bundle` and `marker` merge into the marker.
 *  @returns {BundledMember} */
export function makeMember(root, dir = "probe", {
  name = dir, lock = true, vendored = true, external, src, files = {}, bundle = {}, marker = {},
} = {}) {
  const abs = join(root, dir);
  put(abs, {
    "src/dep.mjs": "export const N = 1;\n",
    "src/index.mjs": src ?? ('import { N } from "./dep.mjs";\n'
      + (vendored ? 'import { V } from "fakedep";\n' : "const V = 0;\n")
      + 'import { env } from "cloudflare:workers";\n'
      + 'import { readFileSync } from "node:fs";\n'
      + "export default { fetch() { return new Response(String(N + V) + typeof env + typeof readFileSync); } };\n"),
    ...files,
  });
  if (vendored) put(abs, {
    "node_modules/fakedep/package.json": JSON.stringify({ name: "fakedep", version: "1.0.0", type: "module", exports: "./index.mjs" }),
    "node_modules/fakedep/index.mjs": "export const V = 40;\n",
  });
  if (lock) writeFileSync(join(abs, "package-lock.json"), JSON.stringify({ name, lockfileVersion: 3 }) + "\n");
  const b = { entry: "src/index.mjs", outfile: `dist/${name}.bundled.mjs`, manifest: `dist/${name}.bundle.json`, ...bundle };
  if (external) b.external = external;
  writeFileSync(join(abs, "fleet-member.json"), JSON.stringify({ name, entry: "src/index.mjs", bundle: b, ...marker }));
  const m = discoverMembers(root).find((x) => x.name === name);
  if (!m) throw new Error(`fixture ${name} under ${dir} is not discovered`);
  return descriptor(m);
}

/** A descriptor shaped by hand from a member (a field changed, removed or added, or none at all), as a caller may hand
 *  one to the recipe. @param {any} d @returns {any} */
export const descriptor = (d) => d;

/** The findings of a verifyFresh that checked, as one text; fails when it did not check.
 *  @param {{checked: boolean, findings: string[] | null}} r */
export function checkedFindings(r) {
  assert.equal(r.checked, true, "the fresh build was checked");
  return (r.findings || []).join("\n");
}

/** `m` with its bundle block's fields `over` replaced. @param {Member} m @param {object} over @returns {BundledMember} */
export const withBundle = (m, over) => descriptor({ ...m, bundle: { ...m.bundle, ...over } });

/** Byte equality of two buffers. @param {Uint8Array} a @param {Uint8Array} b */
export const same = (a, b) => Buffer.compare(a, b) === 0;

/** Every file and directory under `dir` with its bytes, size and mtime: the whole state a call could change. */
export function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { out[relative(dir, p) + "/"] = "dir"; walk(p); }
      else { const s = statSync(p); out[relative(dir, p)] = `${hex(readFileSync(p))} ${s.mtimeMs} ${s.size}`; }
    }
  };
  walk(dir);
  return out;
}

/** The offset of the first byte over 0x7F, or -1. */
export const nonAscii = (buf) => { for (let i = 0; i < buf.length; i++) if (buf[i] > 0x7f) return i; return -1; };

/** The error `fn` throws; fails when it throws none. */
export function threw(fn) {
  try { fn(); } catch (e) { return e; }
  assert.fail("did not throw");
}

/** git in `cwd`, with a throwaway identity and no signing; fails the test on a non-zero exit. */
export function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.email=fixture@example.test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false",
    "-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
