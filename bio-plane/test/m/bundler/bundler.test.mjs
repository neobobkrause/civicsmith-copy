/* bundler: requirement-named tests at the module's interface
 * (build/requirements/bundler.md). Each test names the requirement id it checks
 * in its title. Every build runs over a tiny fixture member in a temporary
 * directory; esbuild comes from the plane's installed dependencies. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync, symlinkSync,
  cpSync, existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  REPO_ROOT, RECIPE, DEFAULT_EXTERNAL, discoverMembers, optionsFor, buildMember, manifestFrom,
  writeMember, verifyStatic, verifyFresh, freshBuildRunnable, unresolvableSpecifiers, sha256,
  isContainer, isGuarded, containerDescriptor, imageReference, containerClasses, containerParts, classPackages,
  statementPackages, markerIsContainer, workerPart, WORKER_PART_PATH, BUCKET_ROLES,
  SOURCE_FIELD, containerSourceHash, containerImageStates, containerImageFindings, recordContainerDigest,
  planeMember, wordKeysOf, bundleExports, bindingFindings, releaseBindingFindings, asciiOutput,
} from "../../../scripts/fleet-bundle.mjs";
import { build as esbuildBuild } from "esbuild";
import { parseJsonc } from "../../../scripts/jsonc.mjs";
import {
  readGitProvenance, stateOf, contentStateOf, classifyDiscovered, reportProvenance, repoPath,
} from "../../../scripts/provenance.mjs";

const hex = (b) => createHash("sha256").update(b).digest("hex");
const tmp = (tag) => mkdtempSync(join(tmpdir(), `bundler-${tag}-`));

/** Writes a fixture member under `root/dir`: a two-file first-party source, one
 *  vendored dependency under node_modules, a lockfile, and the declared externals. */
function fixture(root, dir = "probe", { name = dir, lock = true, vendored = true, external } = {}) {
  const abs = join(root, dir);
  mkdirSync(join(abs, "src"), { recursive: true });
  writeFileSync(join(abs, "src/dep.mjs"), "export const N = 1;\n");
  writeFileSync(join(abs, "src/index.mjs"),
    'import { N } from "./dep.mjs";\n'
    + (vendored ? 'import { V } from "fakedep";\n' : "const V = 0;\n")
    + 'import { env } from "cloudflare:workers";\n'
    + 'import { readFileSync } from "node:fs";\n'
    + "export default { fetch() { return new Response(String(N + V) + typeof env + typeof readFileSync); } };\n");
  if (vendored) {
    mkdirSync(join(abs, "node_modules/fakedep"), { recursive: true });
    writeFileSync(join(abs, "node_modules/fakedep/package.json"),
      JSON.stringify({ name: "fakedep", version: "1.0.0", type: "module", exports: "./index.mjs" }));
    writeFileSync(join(abs, "node_modules/fakedep/index.mjs"), "export const V = 40;\n");
  }
  if (lock) writeFileSync(join(abs, "package-lock.json"), JSON.stringify({ name, lockfileVersion: 3 }) + "\n");
  const bundle = { entry: "src/index.mjs", outfile: `dist/${name}.bundled.mjs`, manifest: `dist/${name}.bundle.json` };
  if (external) bundle.external = external;
  writeFileSync(join(abs, "fleet-member.json"), JSON.stringify({ name, entry: "src/index.mjs", bundle }));
  return discoverMembers(root).find((m) => m.name === name);
}

/** Every file under `dir` with its bytes and mtime: the whole state a call could change. */
function snapshot(dir) {
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

/* ------------------------------------------------------------------------- R1 */

test("R1: discoverMembers lists every member of a repository, each with its directory and entry point, in a stable order", () => {
  const root = tmp("r1");
  try {
    fixture(root, "zed", { name: "b-worker", vendored: false });
    fixture(root, "alpha", { name: "c-worker", vendored: false });
    fixture(root, "mid", { name: "a-worker", vendored: false });
    fixture(root, ".hidden", { name: "hidden-worker", vendored: false });  /* a dot directory is not the fleet */
    mkdirSync(join(root, "not-a-member"));                                   /* no marker */
    writeFileSync(join(root, "a-file.txt"), "x");                            /* not a directory */
    const noBundle = join(root, "plain");
    mkdirSync(noBundle);
    writeFileSync(join(noBundle, "fleet-member.json"), JSON.stringify({ name: "d-worker", entry: "src/main.mjs" }));

    const got = discoverMembers(root);
    assert.deepEqual(got.map((m) => m.name), ["a-worker", "b-worker", "c-worker", "d-worker"]);
    for (const m of got) {
      assert.equal(m.abs, join(root, m.dir), `${m.name}: abs is its directory`);
      assert.ok(existsSync(join(m.abs, "fleet-member.json")), `${m.name}: the directory holds its marker`);
    }
    assert.deepEqual(got.map((m) => [m.dir, m.entry]),
      [["mid", "src/index.mjs"], ["zed", "src/index.mjs"], ["alpha", "src/index.mjs"], ["plain", "src/main.mjs"]]);
    assert.equal(got.find((m) => m.name === "d-worker").bundle, null, "a member without a bundle block is listed, not dropped");
    assert.deepEqual(discoverMembers(root), got, "the same repository gives the same list");

    /* The order is by name and does not depend on the locale or on the walk:
       names that differ only in case, and two directories with one name. */
    fixture(root, "dup2", { name: "Z-upper", vendored: false });
    const again = discoverMembers(root).map((m) => m.name);
    assert.deepEqual(again, [...again].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R1: a marker that cannot be read as JSON is an error naming it, never a member silently dropped", () => {
  const root = tmp("r1bad");
  try {
    fixture(root, "good", { vendored: false });
    mkdirSync(join(root, "broken"));
    writeFileSync(join(root, "broken", "fleet-member.json"), "{ not json");
    assert.throws(() => discoverMembers(root), /broken[\\/]fleet-member\.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R1: the repository's own fleet is discovered with each member's directory and entry point", () => {
  const got = discoverMembers();
  assert.equal(REPO_ROOT, join(import.meta.dirname, "..", "..", "..", ".."));
  const names = got.map((m) => m.name);
  for (const want of ["agent-worker", "ocr-worker", "pdf-worker"]) assert.ok(names.includes(want), want);
  for (const m of got) {
    assert.ok(m.dir && m.abs === join(REPO_ROOT, m.dir), m.name);
    assert.ok(existsSync(join(m.abs, m.entry)), `${m.name}: entry ${m.entry} exists`);
  }
});

/* ------------------------------------------------------------------------- R2 */

test("R2: one recipe: ES module output, platform-neutral, the declared externals, cwd pinned, symlinks preserved", () => {
  const root = tmp("r2opt");
  try {
    const m = fixture(root);
    const o = optionsFor(m);
    assert.equal(o.format, "esm");
    assert.equal(o.platform, "neutral");
    assert.deepEqual(RECIPE, { format: "esm", platform: "neutral" });
    assert.equal(o.absWorkingDir, m.abs);
    assert.equal(o.preserveSymlinks, true);
    assert.equal(o.bundle, true);
    assert.deepEqual(o.external, [...DEFAULT_EXTERNAL]);
    assert.deepEqual(DEFAULT_EXTERNAL, ["cloudflare:workers", "node:*"]);
    const custom = fixture(root, "custom", { external: ["cloudflare:workers", "node:*", "fakedep"] });
    assert.deepEqual(optionsFor(custom).external, ["cloudflare:workers", "node:*", "fakedep"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R2: the built bytes are an ES module that bundles first-party and vendored code and keeps only the declared externals", async () => {
  const root = tmp("r2out");
  try {
    const m = fixture(root);
    const { bytes } = await buildMember(m);
    const text = bytes.toString("utf8");
    assert.match(text, /\bexport\s*\{/, "ES module output");
    assert.match(text, /from\s*"cloudflare:workers"/);
    assert.match(text, /from\s*"node:fs"/);
    assert.doesNotMatch(text, /from\s*"fakedep"/, "a dependency not declared external is bundled");
    assert.doesNotMatch(text, /from\s*"\.\/dep\.mjs"/, "first-party modules are bundled");
    assert.match(text, /\b40\b/);
    assert.doesNotMatch(text, /\brequire\(/, "platform-neutral ESM: no CommonJS shim");
    const custom = fixture(root, "custom", { external: ["cloudflare:workers", "node:*", "fakedep"] });
    assert.match((await buildMember(custom)).bytes.toString("utf8"), /from\s*"fakedep"/,
      "a declared external stays an import");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R2: the same source gives the same bytes from any working directory and any checkout layout", async () => {
  const a = tmp("r2a"), b = tmp("r2b"), shared = tmp("r2dep");
  const cwd = process.cwd();
  try {
    const ma = fixture(a);
    process.chdir(ma.abs);
    const fromMember = (await buildMember(ma)).bytes;
    process.chdir(tmpdir());
    const fromElsewhere = (await buildMember(ma)).bytes;
    process.chdir(REPO_ROOT);
    const fromRepo = (await buildMember(ma)).bytes;
    process.chdir(cwd);
    assert.ok(fromMember.equals(fromElsewhere) && fromMember.equals(fromRepo), "cwd does not reach the bytes");

    /* A second checkout, deeper, whose node_modules is a symlink into another tree. */
    const mb = fixture(join(b, "deeper", "checkout"));
    cpSync(join(mb.abs, "node_modules"), join(shared, "node_modules"), { recursive: true });
    rmSync(join(mb.abs, "node_modules"), { recursive: true });
    symlinkSync(join(shared, "node_modules"), join(mb.abs, "node_modules"), "dir");
    const linked = (await buildMember(mb)).bytes;
    assert.ok(linked.equals(fromMember), "a symlinked install gives the same bytes as a real one");
    assert.match(linked.toString("utf8"), /V=40/, "the vendored code is bundled");
    assert.ok(!linked.toString("utf8").includes(shared) && !fromMember.toString("utf8").includes(a),
      "no absolute path reaches the bytes");
  } finally {
    process.chdir(cwd);
    for (const d of [a, b, shared]) rmSync(d, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------------- R3 */

test("R3: buildMember writes the artifact only when write is true", async () => {
  const root = tmp("r3");
  try {
    const m = fixture(root);
    const out = join(m.abs, m.bundle.outfile);
    const before = snapshot(m.abs);
    for (const opts of [undefined, {}, { write: false }]) {
      const built = await buildMember(m, opts);
      assert.ok(built.bytes.length > 0);
      assert.equal(existsSync(out), false, `no artifact for ${JSON.stringify(opts)}`);
    }
    assert.deepEqual(snapshot(m.abs), before, "nothing in the member changed");
    const built = await buildMember(m, { write: true });
    assert.ok(readFileSync(out).equals(built.bytes), "write:true writes exactly the built bytes");
    assert.equal(built.sha256, hex(built.bytes));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R4 */

test("R4: the manifest records the artifact's SHA-256, every first-party input's, the lockfile's, and the pinned working directory", async () => {
  const root = tmp("r4");
  try {
    const m = fixture(root);
    const built = await buildMember(m);
    const man = manifestFrom(m, built);
    assert.equal(man.member, m.name);
    assert.equal(man.artifact, m.bundle.outfile);
    assert.equal(man.sha256, hex(built.bytes));
    assert.equal(man.bytes, built.bytes.length);
    assert.equal(man.recipe.absWorkingDir, "<member directory>");
    assert.equal(man.recipe.format, "esm");
    assert.equal(man.recipe.platform, "neutral");
    assert.equal(man.recipe.entry, "src/index.mjs");
    assert.deepEqual(man.recipe.external, [...DEFAULT_EXTERNAL]);
    assert.deepEqual(man.inputs.map((i) => i.path).sort(), ["src/dep.mjs", "src/index.mjs"]);
    for (const i of man.inputs) {
      assert.equal(i.sha256, hex(readFileSync(join(m.abs, i.path))), i.path);
      assert.equal(i.bytes, readFileSync(join(m.abs, i.path)).length, i.path);
    }
    assert.deepEqual(man.vendoredInputs.map((i) => i.path), ["node_modules/fakedep/index.mjs"]);
    assert.equal(man.vendoredInputs[0].sha256, hex(readFileSync(join(m.abs, "node_modules/fakedep/index.mjs"))));
    assert.deepEqual(man.lock, { path: "package-lock.json", sha256: hex(readFileSync(join(m.abs, "package-lock.json"))) });
    assert.ok(!JSON.stringify(man).includes(root), "no absolute path in the manifest");

    const noLock = fixture(root, "nolock", { lock: false, vendored: false });
    assert.equal(manifestFrom(noLock, await buildMember(noLock)).lock, null, "no lockfile is recorded as none");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R5 */

test("R5: writeMember builds with writing on and writes the artifact and its manifest", async () => {
  const root = tmp("r5");
  try {
    const m = fixture(root);
    const { built, manifest } = await writeMember(m);
    const art = readFileSync(join(m.abs, m.bundle.outfile));
    assert.ok(art.equals(built.bytes));
    assert.ok(art.equals((await buildMember(m)).bytes), "the written artifact is what the recipe builds");
    const onDisk = JSON.parse(readFileSync(join(m.abs, m.bundle.manifest), "utf8"));
    assert.deepEqual(onDisk, manifest);
    assert.equal(onDisk.sha256, hex(art));
    assert.deepEqual(verifyStatic(m).findings, [], "what it writes verifies");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R6 */

test("R6: with no dependencies installed, a changed input or lockfile is reported stale, naming the input", async () => {
  const root = tmp("r6");
  try {
    const m = fixture(root);
    const { manifest } = await writeMember(m);
    rmSync(join(m.abs, "node_modules"), { recursive: true });            /* no dependencies installed */
    assert.deepEqual(verifyStatic(m).findings, [], "a fresh artifact verifies with nothing installed");

    for (const inp of manifest.inputs) {
      const p = join(m.abs, inp.path), before = readFileSync(p);
      writeFileSync(p, before + "\n/* one comment */\n");                 /* even a change the build would strip */
      const f = verifyStatic(m).findings;
      assert.ok(f.some((x) => x.includes("STALE") && x.includes(inp.path)), `${inp.path} changed: ${f}`);
      assert.ok(f.every((x) => x.startsWith(`${m.name}:`)), "each finding names the member");
      rmSync(p);
      assert.ok(verifyStatic(m).findings.some((x) => x.includes(inp.path)), `${inp.path} vanished`);
      writeFileSync(p, before);
      assert.deepEqual(verifyStatic(m).findings, [], `${inp.path} restored`);
    }

    const lock = join(m.abs, "package-lock.json"), lockBefore = readFileSync(lock);
    writeFileSync(lock, lockBefore + " ");
    assert.ok(verifyStatic(m).findings.some((x) => x.includes("STALE") && x.includes("package-lock.json")));
    rmSync(lock);
    assert.ok(verifyStatic(m).findings.some((x) => x.includes("package-lock.json")), "a lock removed");
    writeFileSync(lock, lockBefore);
    assert.deepEqual(verifyStatic(m).findings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R6: a vendored input that is present and changed, a moved artifact, or a changed recipe is stale too", async () => {
  const root = tmp("r6b");
  try {
    const m = fixture(root);
    await writeMember(m);
    const dep = join(m.abs, "node_modules/fakedep/index.mjs");
    writeFileSync(dep, "export const V = 41;\n");
    assert.ok(verifyStatic(m).findings.some((x) => x.includes("node_modules/fakedep/index.mjs")));
    writeFileSync(dep, "export const V = 40;\n");

    const art = join(m.abs, m.bundle.outfile), artBefore = readFileSync(art);
    writeFileSync(art, artBefore + "\n");
    assert.ok(verifyStatic(m).findings.length > 0, "an artifact that is not the one its manifest describes");
    writeFileSync(art, artBefore);

    const moved = { ...m, bundle: { ...m.bundle, external: ["cloudflare:workers", "node:*", "other"] } };
    assert.ok(verifyStatic(moved).findings.some((x) => x.includes("recipe.external")));
    assert.deepEqual(verifyStatic(m).findings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R7 */

test("R7: with dependencies installed, a fresh build must equal the committed bytes exactly", async () => {
  const root = tmp("r7");
  try {
    const m = fixture(root);
    await writeMember(m);
    const committed = readFileSync(join(m.abs, m.bundle.outfile));
    const ok = await verifyFresh(m, committed);
    assert.equal(ok.checked, true);
    assert.deepEqual(ok.findings, []);

    const flipped = Buffer.from(committed); flipped[flipped.length - 2] ^= 1;
    const bad = await verifyFresh(m, flipped);
    assert.equal(bad.checked, true);
    assert.ok(bad.findings.some((x) => x.includes("STALE")), "one byte different is stale");
    assert.equal((await verifyFresh(m, Buffer.concat([committed, Buffer.from("\n")]))).findings.length > 0, true);

    /* A dependency's bytes moved: only the fresh build can see it past the lockfile. */
    writeFileSync(join(m.abs, "node_modules/fakedep/index.mjs"), "export const V = 41;\n");
    assert.ok((await verifyFresh(m, committed)).findings.some((x) => x.includes("STALE")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R7: where the dependencies are not installed it says it could not check, never that the artifact is fresh", async () => {
  const root = tmp("r7b");
  try {
    const m = fixture(root);
    const { manifest } = await writeMember(m);
    const committed = readFileSync(join(m.abs, m.bundle.outfile));
    rmSync(join(m.abs, "node_modules"), { recursive: true });
    const r = await verifyFresh(m, committed);
    assert.equal(r.checked, false);
    assert.equal(r.findings, null, "no empty list of findings that a caller could read as fresh");
    assert.ok(typeof r.reason === "string" && r.reason.length > 0, "a reason is given");
    assert.match(r.reason, /node_modules\/fakedep\/index\.mjs/);
    assert.equal(freshBuildRunnable(m, manifest).runnable, false);
    /* A member with no dependencies is always checkable. */
    const bare = fixture(root, "bare", { vendored: false });
    await writeMember(bare);
    const rb = await verifyFresh(bare, readFileSync(join(bare.abs, bare.bundle.outfile)));
    assert.equal(rb.checked, true);
    assert.deepEqual(rb.findings, []);
    /* No manifest to name the dependencies, and they are absent: the build fails, and that is not fresh. */
    rmSync(join(m.abs, m.bundle.manifest));
    const rn = await verifyFresh(m, committed);
    assert.equal(rn.checked, false);
    assert.equal(rn.findings, null);
    assert.match(rn.reason, /fakedep/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R8 */

test("R8: every import specifier that is neither bundled nor an allowed external is listed, once, sorted", () => {
  const text = [
    "// src/index.mjs",
    'import { a } from "zeta";',
    'import b from "./local.mjs";',
    'import "bare-side-effect";',
    'export * from "re-exported";',
    'export { c } from "named-reexport";',
    "import {",
    "  d,",
    '} from "multi-line";',
    'import{e}from"minified";import{f}from"node:fs";',
    'import { env } from "cloudflare:workers";',
    'import { g } from "node:crypto";',
    'import { h } from \'single-quoted\';',
    'import { a2 } from "zeta";',
    "export default { x: 1 };",
  ].join("\n");
  assert.deepEqual(unresolvableSpecifiers(text),
    ["./local.mjs", "bare-side-effect", "minified", "multi-line", "named-reexport", "re-exported",
      "single-quoted", "zeta"]);
  assert.deepEqual(unresolvableSpecifiers(text, ["zeta", "minified", "multi-line", "./local.mjs",
    "bare-side-effect", "re-exported", "named-reexport", "single-quoted"]),
    ["cloudflare:workers", "node:crypto", "node:fs"], "the allowed list replaces the default, with * as a prefix");
  assert.deepEqual(unresolvableSpecifiers('import { v } from "cloudflare:workers";\nexport { v };\n'), []);
});

test("R8: a fully bundled artifact lists nothing, and one with an undeclared external lists it", async () => {
  const root = tmp("r8");
  try {
    const m = fixture(root);
    assert.deepEqual(unresolvableSpecifiers((await buildMember(m)).bytes.toString("utf8")), []);
    const ext = fixture(root, "ext", { external: ["cloudflare:workers", "node:*", "fakedep"] });
    const text = (await buildMember(ext)).bytes.toString("utf8");
    assert.deepEqual(unresolvableSpecifiers(text), ["fakedep"]);
    assert.deepEqual(unresolvableSpecifiers(text, ext.bundle.external), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R9 */

const git = (cwd, ...args) => {
  const r = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test("R9: each file is stated committed and unchanged, changed, staged, or untracked, and reported", () => {
  const root = tmp("r9");
  try {
    git(root, "init", "-q");
    for (const f of ["same.txt", "edited.txt", "sub/deleted.txt", "ignored-edit.txt"]) {
      mkdirSync(join(root, "sub"), { recursive: true });
      writeFileSync(join(root, f), `${f}\n`);
    }
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "c1");
    writeFileSync(join(root, "edited.txt"), "moved\n");
    rmSync(join(root, "sub/deleted.txt"));
    writeFileSync(join(root, "staged.txt"), "s\n");
    git(root, "add", "staged.txt");
    writeFileSync(join(root, "loose2.txt"), "x");
    writeFileSync(join(root, "ignored-edit.txt"), "staged change\n");
    git(root, "add", "ignored-edit.txt");
    writeFileSync(join(root, "loose.txt"), "u\n");

    const prov = readGitProvenance(root);
    const want = {
      "same.txt": ["in the commit", "unchanged"],
      "edited.txt": ["in the commit", "changed"],
      "sub/deleted.txt": ["in the commit", "changed"],
      "ignored-edit.txt": ["in the commit", "changed"],
      "staged.txt": ["staged, not yet committed", null],
      "loose.txt": ["UNTRACKED", null],
    };
    for (const [p, [state, content]] of Object.entries(want)) {
      assert.equal(stateOf(prov, p), state, p);
      assert.equal(contentStateOf(prov, p), content, p);
    }
    assert.equal(repoPath(root, join(root, "sub", "deleted.txt")), "sub/deleted.txt");

    const items = Object.keys(want).map((path) => ({ path, what: path, counted: "one" }));
    const c = classifyDiscovered(prov, items);
    assert.equal(c.verified, true);
    assert.equal(c.accounted, 6);
    assert.deepEqual(c.off.map((r) => r.path).sort(), ["loose.txt", "staged.txt"]);
    assert.deepEqual(c.changed.map((r) => r.path).sort(), ["edited.txt", "ignored-edit.txt", "sub/deleted.txt"]);
    assert.deepEqual(c.inCommit.sort(), ["edited.txt", "ignored-edit.txt", "same.txt", "sub/deleted.txt"]);
    for (const r of c.rows) assert.deepEqual([r.state, r.content], want[r.path], r.path);

    const lines = [];
    const rc = reportProvenance({ prov, items, instrument: "the probe", corpus: "6 files", log: (s) => lines.push(s) });
    const out = lines.join("\n");
    assert.deepEqual(rc.rows, c.rows);
    assert.match(out, /4 of 6 discovered item\(s\) are in the commit/);
    assert.match(out, /loose\.txt\s+\(UNTRACKED\)/);
    assert.match(out, /staged\.txt\s+\(staged, not yet committed\)/);
    for (const p of ["edited.txt", "ignored-edit.txt", "sub/deleted.txt"])
      assert.match(out, new RegExp(`${p.replace(".", "\\.")}\\s+\\(changed since the commit\\)`), p);
    assert.doesNotMatch(out, /same\.txt/, "an unchanged committed file needs no line");

    /* Committed and clean: one line, nothing named. */
    git(root, "add", "-A"); git(root, "commit", "-q", "-m", "c2");
    const clean = [];
    const cc = reportProvenance({ prov: readGitProvenance(root), items: [{ path: "same.txt", what: "w", counted: "c" }],
      instrument: "the probe", log: (s) => clean.push(s) });
    assert.equal(clean.length, 1);
    assert.deepEqual([cc.off, cc.changed], [[], []]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R9: where git cannot answer, every file is UNVERIFIED and the report says so, never clean", () => {
  const root = tmp("r9none");
  try {
    writeFileSync(join(root, "a.txt"), "a");
    const prov = readGitProvenance(root);
    assert.equal(prov.inHead, null);
    assert.equal(stateOf(prov, "a.txt"), "UNVERIFIED");
    assert.equal(contentStateOf(prov, "a.txt"), "UNVERIFIED");
    const lines = [];
    const c = reportProvenance({ prov, items: [{ path: "a.txt", what: "w", counted: "c" }], instrument: "x",
      log: (s) => lines.push(s) });
    assert.equal(c.verified, false);
    assert.match(lines.join("\n"), /UNVERIFIED over all 1/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------ R10 */

test("R10: no verifying call creates or changes a file, fresh or stale, installed or not", async () => {
  const root = tmp("r10");
  try {
    const m = fixture(root);
    const { manifest } = await writeMember(m);
    const committed = readFileSync(join(m.abs, m.bundle.outfile));
    const verifyAll = async () => {
      verifyStatic(m);
      freshBuildRunnable(m, manifest);
      await verifyFresh(m, committed);
      unresolvableSpecifiers(committed.toString("utf8"));
    };
    const states = [
      ["fresh", () => {}],
      ["a source changed", () => writeFileSync(join(m.abs, "src/dep.mjs"), "export const N = 2;\n")],
      ["the artifact removed", () => rmSync(join(m.abs, m.bundle.outfile))],
      ["the manifest removed", () => rmSync(join(m.abs, m.bundle.manifest))],
      ["the dependencies removed", () => rmSync(join(m.abs, "node_modules"), { recursive: true })],
    ];
    for (const [label, arrange] of states) {
      arrange();
      const before = snapshot(root);
      await verifyAll();
      assert.deepEqual(snapshot(root), before, `${label}: nothing written`);
    }
    /* A member whose dist directory does not exist yet: verifying does not create it. */
    const unbuilt = fixture(root, "unbuilt", { vendored: false });
    const before = snapshot(root);
    verifyStatic(unbuilt);
    await verifyFresh(unbuilt, Buffer.from(""));
    assert.deepEqual(snapshot(root), before);
    assert.equal(existsSync(join(unbuilt.abs, "dist")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R10: verifying the repository's own fleet writes nothing", async () => {
  const m = discoverMembers().find((x) => x.name === "agent-worker");
  const before = snapshot(m.abs);
  const { manifest, committed } = verifyStatic(m);
  if (freshBuildRunnable(m, manifest).runnable) await verifyFresh(m, committed);
  assert.deepEqual(snapshot(m.abs), before);
});

/* ------------------------------------------------------------------------ R24 */

const DIGEST = "sha256:" + "0f".repeat(32);
const IMAGE = { repository: "docker.io/civicos/runner", digest: DIGEST, platform: "linux/amd64", port: 8080, schedulingPolicy: "default" };

/** A container member's marker under `root/dir`, with no Worker bundle unless `bundle` is given. */
function containerFixture(root, dir, { image = IMAGE, noImage = false, kind = "container", extra = {} } = {}) {
  mkdirSync(join(root, dir, "src"), { recursive: true });
  writeFileSync(join(root, dir, "src/entry.mjs"), "export const runner = 1;\n");
  writeFileSync(join(root, dir, "fleet-member.json"), JSON.stringify({ name: dir, kind, entry: "src/entry.mjs",
    ...(noImage ? {} : { image }), ...extra }));
}

test("R24: a marker with kind container and an image block is a container member, listed with its kind and its image; every other member is listed as a worker", () => {
  const root = tmp("r24");
  try {
    fixture(root, "w", { name: "w-worker", vendored: false });
    containerFixture(root, "runner");
    containerFixture(root, "no-image", { noImage: true });                   /* says container, states no image */
    containerFixture(root, "odd-image", { image: "docker.io/x@sha256:0" });       /* an image that is not a block */
    const got = discoverMembers(root);
    assert.deepEqual(got.map((m) => [m.name, m.kind, isContainer(m)]),
      [["no-image", "container", false], ["odd-image", "container", false], ["runner", "container", true], ["w-worker", "worker", false]]);
    const runner = got.find((m) => m.name === "runner");
    assert.deepEqual(runner.image, IMAGE, "listed with its image, as its marker states it");
    assert.equal(runner.entry, "src/entry.mjs");
    assert.equal(runner.bundle, null);
    assert.equal(got.find((m) => m.name === "w-worker").image, null, "a worker has no image");
    assert.equal(got.find((m) => m.name === "no-image").image, null);
    /* Not bundle-guarded for want of a Worker bundle; a container member that declares one, and every other member, is. */
    assert.deepEqual(got.map((m) => [m.name, isGuarded(m)]),
      [["no-image", true], ["odd-image", true], ["runner", false], ["w-worker", true]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R24: verifyStatic and verifyFresh never report a container member with no Worker bundle stale, unguarded or missing an artifact, and say it is not guarded; one that states no image is still named unguarded", async () => {
  const root = tmp("r24v");
  try {
    containerFixture(root, "runner");
    containerFixture(root, "no-image", { noImage: true });
    const [noImage, runner] = discoverMembers(root);
    const before = snapshot(root);
    const s = verifyStatic(runner);
    assert.deepEqual(s, { findings: [], manifest: null, committed: null, guarded: false });
    const f = await verifyFresh(runner, null);
    assert.equal(f.checked, false, "nothing was checked, so it is never said to be fresh (R7)");
    assert.equal(f.guarded, false);
    assert.equal(f.findings, null);
    assert.match(f.reason, /^runner: not checked — a container member with no Worker bundle is not bundle-guarded/);
    assert.deepEqual(snapshot(root), before, "R10: nothing written");
    const named = verifyStatic(noImage).findings;
    assert.equal(named.length, 1);
    assert.match(named[0], /^no-image: declares no `bundle` block/, "a marker that is not a container member's is not exempt");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R24: a container member that declares a Worker bundle is guarded like any member: built, verified, and named stale when its source moves", async () => {
  const root = tmp("r24b");
  try {
    const m0 = fixture(root, "runner", { vendored: false });
    const marker = JSON.parse(readFileSync(join(m0.abs, "fleet-member.json"), "utf8"));
    writeFileSync(join(m0.abs, "fleet-member.json"), JSON.stringify({ ...marker, kind: "container", image: IMAGE }));
    const m = discoverMembers(root)[0];
    assert.equal(isContainer(m), true);
    assert.equal(isGuarded(m), true);
    await writeMember(m);
    assert.deepEqual(verifyStatic(m).findings, []);
    const fresh = await verifyFresh(m, readFileSync(join(m.abs, m.bundle.outfile)));
    assert.deepEqual([fresh.checked, fresh.findings], [true, []]);
    writeFileSync(join(m.abs, "src/dep.mjs"), "export const N = 9;\n");
    assert.ok(verifyStatic(m).findings.some((x) => x.includes("STALE") && x.includes("src/dep.mjs")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R24: the repository's own fleet lists agent-runner as a container member with its image, and only a container member goes unguarded", () => {
  const got = discoverMembers();
  const runner = got.find((m) => m.name === "agent-runner");
  assert.ok(runner, "agent-runner is listed");
  assert.equal(runner.kind, "container");
  assert.equal(isContainer(runner), true);
  /* R35 (T51; N1242, K3805): the real fleet's marker names the image on Docker Hub, by digest. */
  assert.equal(runner.image.repository, "docker.io/civicsmith/agent-runner");
  assert.deepEqual(got.filter((m) => !isGuarded(m)).map((m) => m.name).filter((n) => n !== "agent-runner"), [],
    "every other member is guarded");
  for (const m of got.filter((x) => !isContainer(x))) assert.equal(m.kind, "worker", m.name);
});

/* ------------------------------------------------------------- R25 (functions) */

test("R25: containerDescriptor writes the part from the marker — class_name, image as <repository>@sha256:<64 hex>, scheduling_policy default, max_instances, bind — and names every field it lacks", () => {
  const member = (marker, bundle = { entry: "src/index.mjs" }) => ({ name: "runner", bundle, marker });
  const full = { kind: "container", image: IMAGE, class_name: "AgentRunner", max_instances: 4,
    bind: [{ member: "agent-worker", binding: "RUNNER" }] };
  const names = ["agent-worker", "runner"];
  const d = containerDescriptor(member(full), names);
  const want = { class_name: "AgentRunner", image: `docker.io/civicos/runner@${DIGEST}`, scheduling_policy: "default",
    max_instances: 4, bind: [{ member: "agent-worker", binding: "RUNNER" }] };
  assert.deepEqual(d.descriptor, want);
  assert.deepEqual(Object.keys(d.descriptor), ["class_name", "image", "scheduling_policy", "max_instances", "bind"]);
  assert.equal(d.bytes.toString("utf8"), JSON.stringify(want, null, 2) + "\n");
  assert.equal(containerDescriptor(member({ ...full, image: { ...IMAGE, schedulingPolicy: undefined } }), names).descriptor.scheduling_policy,
    "default", "an unstated policy is default, the only one the part carries");

  const lacks = (marker, bundle) => containerDescriptor(member(marker, bundle), names).missing;
  assert.deepEqual(lacks(full, null), ["bundle"]);
  assert.deepEqual(lacks({ ...full, image: { ...IMAGE, digest: null } }), ["image.digest"]);
  for (const digest of ["sha256:" + "0f".repeat(31), "sha256:" + "0F".repeat(32), "0f".repeat(32), "sha512:" + "0f".repeat(32)])
    assert.deepEqual(lacks({ ...full, image: { ...IMAGE, digest } }), ["image.digest"], digest);
  for (const repository of [undefined, "", "runner", "docker.io/civicos/runner@sha256:x", "Docker.io/x/y"])
    assert.deepEqual(lacks({ ...full, image: { ...IMAGE, repository } }), ["image.repository"], String(repository));
  assert.deepEqual(lacks({ ...full, image: undefined }), ["image"]);
  assert.deepEqual(lacks({ ...full, image: { ...IMAGE, schedulingPolicy: "regional" } }), ["image.schedulingPolicy"]);
  for (const class_name of [undefined, "", "1Runner", "a-b"])
    assert.deepEqual(lacks({ ...full, class_name }), ["class_name"], String(class_name));
  for (const max_instances of [undefined, 0, -1, 1.5, "4"])
    assert.deepEqual(lacks({ ...full, max_instances }), ["max_instances"], String(max_instances));
  for (const bind of [undefined, [], [{ member: "no-such", binding: "RUNNER" }], [{ member: "agent-worker" }],
    [{ member: "agent-worker", binding: "bad-name" }], ["agent-worker"]])
    assert.deepEqual(lacks({ ...full, bind }), ["bind"], JSON.stringify(bind));
  assert.deepEqual(lacks({ kind: "container" }, null), ["bundle", "image", "class_name", "max_instances", "bind"],
    "every field it lacks, each named");
});

test("R25: imageReference names the image only by digest, in agent-runner R7's form, or names the field that does not say it", () => {
  assert.deepEqual(imageReference(IMAGE), { reference: `docker.io/civicos/runner@${DIGEST}` });
  assert.deepEqual(imageReference({ ...IMAGE, repository: "registry.example.test:5000/a/b" }),
    { reference: `registry.example.test:5000/a/b@${DIGEST}` });
  assert.deepEqual(imageReference(null), { missing: "image" });
  assert.deepEqual(imageReference({ ...IMAGE, digest: null }), { missing: "image.digest" });
  assert.deepEqual(imageReference({ ...IMAGE, repository: "runner" }), { missing: "image.repository" });
  /* The repository's own marker states no digest until the release publishes the image (T33-D1). */
  const runner = discoverMembers().find((m) => m.name === "agent-runner");
  const own = imageReference(runner.image);
  assert.ok(own.reference ? /@sha256:[0-9a-f]{64}$/.test(own.reference) : own.missing === "image.digest", JSON.stringify(own));
});

/* --------------------------------------------- R24, R25, R27: a member with two classes (T36-2) */

const BASE = "sha256:" + "1e".repeat(32), OTHER = "sha256:" + "2e".repeat(32);
const TWO = () => [
  { class_name: "FileScanner", max_instances: 4,
    image: { ...IMAGE, repository: "docker.io/civicos/file-scanner", base: { digest: BASE }, packages: "img/scan.json" } },
  { class_name: "SafeViewRenderer",
    image: { ...IMAGE, repository: "docker.io/civicos/safe-view", digest: "sha256:" + "3e".repeat(32), base: { digest: BASE } } },
];

test("R24: a container member stating its classes as a `containers` list, each with its own image, is a container member, listed with each class's name and image", () => {
  const root = tmp("r24multi");
  try {
    containerFixture(root, "scanner", { noImage: true, extra: { containers: TWO(), bind: [{ member: "x", binding: "B" }] } });
    containerFixture(root, "half", { noImage: true, extra: { containers: [TWO()[0], { class_name: "NoImage" }] } });
    const [half, scanner] = discoverMembers(root);
    assert.equal(isContainer(scanner), true);
    assert.equal(scanner.image, null, "no one top-level image");
    assert.deepEqual(scanner.containers, TWO().map((c) => ({ class_name: c.class_name, image: c.image })));
    assert.equal(isGuarded(scanner), false, "no Worker bundle: listed, not guarded, as any container member");
    assert.equal(isContainer(half), false, "a class with no image block is not a container member's list");
    assert.equal(markerIsContainer(scanner.marker), true);
    assert.equal(markerIsContainer(half.marker), false);
    assert.equal(markerIsContainer({ kind: "container", image: IMAGE }), true);
    assert.equal(markerIsContainer({ kind: "worker", image: IMAGE }), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R25: a member with more than one class gets one Container part per class, container/<class>.json, each its own class_name and image, max_instances and bind from the class else the member; one class is container.json as before", () => {
  const names = ["agent-worker", "plane-x"];
  const member = (marker) => ({ name: "scanner", dir: "scanner", abs: "/nowhere", bundle: { entry: "src/index.mjs" }, marker });
  const top = { kind: "container", containers: TWO(), max_instances: 1, bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] };
  const got = containerParts(member(top), names, { packages: false });
  assert.deepEqual(got.parts.map((p) => p.path), ["container/FileScanner.json", "container/SafeViewRenderer.json"]);
  assert.deepEqual(got.parts.map((p) => p.descriptor), [
    { class_name: "FileScanner", image: `docker.io/civicos/file-scanner@${DIGEST}`, scheduling_policy: "default", max_instances: 4,
      bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] },
    { class_name: "SafeViewRenderer", image: `docker.io/civicos/safe-view@sha256:${"3e".repeat(32)}`, scheduling_policy: "default",
      max_instances: 1, bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] },
  ], "each class its own image; max_instances from the class where stated, else the member's");
  for (const p of got.parts) assert.equal(p.bytes.toString("utf8"), JSON.stringify(p.descriptor, null, 2) + "\n");
  const perClassBind = TWO().map((c, i) => ({ ...c, bind: [{ member: "agent-worker", binding: i ? "RENDER" : "SCAN" }] }));
  assert.deepEqual(containerParts(member({ ...top, containers: perClassBind }), names, { packages: false }).parts.map((p) => p.descriptor.bind),
    [[{ member: "agent-worker", binding: "SCAN" }], [{ member: "agent-worker", binding: "RENDER" }]], "a class's own bind wins");

  /* One class, either form: the part is container.json, exactly what containerDescriptor writes. */
  const one = { kind: "container", image: IMAGE, class_name: "Runner", max_instances: 2, bind: [{ member: "agent-worker", binding: "R" }] };
  const single = containerParts(member(one), names, { packages: false });
  assert.deepEqual(single.parts.map((p) => [p.path, p.bytes.toString()]), [["container.json", containerDescriptor(member(one), names).bytes.toString()]]);
  const listOfOne = { kind: "container", containers: [{ class_name: "Runner", image: IMAGE }], max_instances: 2, bind: one.bind };
  assert.deepEqual(containerParts(member(listOfOne), names, { packages: false }).parts.map((p) => [p.path, p.bytes.toString()]),
    single.parts.map((p) => [p.path, p.bytes.toString()]), "a list of one is one class");
  assert.equal(containerClasses(member(listOfOne)).multi, false);
  assert.equal(containerClasses(member(top)).multi, true);
});

test("R25: a class lacking a field is refused naming the class and every field; a duplicated class, both forms at once, or no bundle are refused too", () => {
  const names = ["plane-x"];
  const member = (marker, bundle = { entry: "src/index.mjs" }) => ({ name: "scanner", dir: "scanner", abs: "/nowhere", bundle, marker });
  const base = { kind: "container", max_instances: 1, bind: [{ member: "plane-x", binding: "FILE_SCANNER" }] };
  const lacks = (containers, extra = {}) => containerParts(member({ ...base, containers, ...extra }), names, { packages: false });
  const [a, b] = TWO();
  assert.deepEqual(lacks([a, { ...b, image: { ...b.image, digest: null } }]), { missing: ["image.digest"], class: "SafeViewRenderer" });
  assert.deepEqual(lacks([{ ...a, max_instances: 0 }, b]), { missing: ["max_instances"], class: "FileScanner" });
  assert.deepEqual(lacks([a, b], { bind: undefined }), { missing: ["bind"], class: "FileScanner" }, "no bind on the class or the member");
  assert.deepEqual(lacks([a, { ...b, class_name: "bad-name", image: { ...b.image, schedulingPolicy: "regional" } }]),
    { missing: ["image.schedulingPolicy", "class_name"], class: "bad-name" }, "every field it lacks");
  assert.deepEqual(lacks([a, { ...b, class_name: undefined }]), { missing: ["class_name"], class: "(unnamed)" });
  assert.deepEqual(lacks([a, { ...b, class_name: "FileScanner" }]), { missing: ["class_name"], class: "FileScanner" }, "two classes, one name");
  assert.match(lacks([a, b], { image: IMAGE }).missing[0], /^image \(a top-level image beside a `containers` list\)$/);
  assert.deepEqual(containerParts(member({ ...base, containers: TWO() }, null), names), { missing: ["bundle"] });
});

test("R27: a class naming a package statement reads its packages from it, sorted, under the ecosystem it names, only when its base digest is the marker's; otherwise unread naming the file, the package or the digest", () => {
  const root = tmp("r27st");
  try {
    const dir = join(root, "scanner");
    mkdirSync(join(dir, "img"), { recursive: true });
    const st = { ecosystem: "Debian:12", base: { repository: "docker.io/library/debian", digest: BASE },
      packages: [{ name: "clamav", version: "1.4.3" }, { name: "bzip2", version: "1.0.8" }, { name: "clamav", version: "1.0.0" }] };
    const file = join(dir, "img/scan.json");
    const write = (o) => writeFileSync(file, typeof o === "string" ? o : JSON.stringify(o));
    write(st);
    const sorted = [{ name: "bzip2", version: "1.0.8" }, { name: "clamav", version: "1.0.0" }, { name: "clamav", version: "1.4.3" }];
    assert.deepEqual(statementPackages(file, "scanner/img/scan.json", BASE), { ecosystem: "Debian:12", packages: sorted });
    const m = { name: "scanner", dir: "scanner", abs: dir, bundle: { entry: "src/index.mjs" },
      marker: { kind: "container", containers: TWO(), max_instances: 1, bind: [{ member: "plane-x", binding: "F" }] } };
    const [scan, render] = containerClasses(m).classes;
    assert.deepEqual(classPackages(m, scan), { ecosystem: "Debian:12", packages: sorted });
    assert.deepEqual(classPackages(m, render), { unread: "scanner/package-lock.json is missing" },
      "a class naming no statement installs from npm: the member's lockfile");
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/x": { version: "1.0.0" } } }));
    assert.deepEqual(classPackages(m, render), { ecosystem: "npm", packages: [{ name: "x", version: "1.0.0" }] });
    const parts = containerParts(m, ["plane-x"]);
    assert.deepEqual(parts.parts.map((p) => p.descriptor.packages), [sorted, [{ name: "x", version: "1.0.0" }]], "each part its own image's list, last");

    const unread = () => statementPackages(file, "scanner/img/scan.json", BASE).unread;
    const cases = [
      ["scanner/img/scan.json is missing", () => rmSync(file)],
      ["scanner/img/scan.json does not parse", () => write("{ torn")],
      ["scanner/img/scan.json does not parse: it names no ecosystem", () => write({ ...st, ecosystem: undefined })],
      ["scanner/img/scan.json does not parse: it has no `packages` list", () => write({ ...st, packages: undefined })],
      ["scanner/img/scan.json names no base image digest", () => write({ ...st, base: { repository: "debian" } })],
      [`scanner/img/scan.json was taken against the base ${OTHER}, not the base the marker pins (${BASE})`, () => write({ ...st, base: { digest: OTHER } })],
      ["scanner/img/scan.json names the package bzip2 without a version", () => write({ ...st, packages: [{ name: "bzip2" }] })],
      ["scanner/img/scan.json names a package with no name", () => write({ ...st, packages: [{ version: "1" }] })],
    ];
    for (const [named, arrange] of cases) {
      arrange();
      const u = unread();
      assert.ok(typeof u === "string" && u.startsWith(named), `${named}: ${u}`);
      write(st);
    }
    assert.match(statementPackages(file, "scanner/img/scan.json", null).unread, /not the base the marker pins \(none\)/, "a marker pinning no base");
    const away = { ...scan, image: { ...scan.image, packages: "../elsewhere.json" } };
    assert.match(classPackages(m, away).unread, /names no package statement for FileScanner as a member-relative path/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------- R25 (functions): a member's Worker part (N772, K2155) */

test("R25: workerPart writes {r2_buckets, crons} from a member's config, each bucket by its role and the crons as stated; none for a member with neither; every binding with no role, and every list that is not one, named", () => {
  assert.equal(WORKER_PART_PATH, "worker.json");
  assert.deepEqual(BUCKET_ROLES, { "bio-captures": "captures", "bio-published": "published" }, "the plane's two buckets, the only roles");
  const cfg = { name: "m", r2_buckets: [{ binding: "PUBLISHED", bucket_name: "bio-published" }, { binding: "CAPTURES", bucket_name: "bio-captures" }],
    triggers: { crons: ["17 4 * * *"] }, services: [{ binding: "PLANE", service: "bio-plane" }] };
  const w = workerPart(cfg);
  const want = { r2_buckets: [{ binding: "PUBLISHED", bucket: "published" }, { binding: "CAPTURES", bucket: "captures" }], crons: ["17 4 * * *"] };
  assert.deepEqual(w.part.descriptor, want, "the config's order, the role for the bucket name");
  assert.equal(w.part.bytes.toString("utf8"), JSON.stringify(want, null, 2) + "\n");
  assert.deepEqual(workerPart({ r2_buckets: [{ binding: "CAPTURES", bucket_name: "bio-captures" }] }).part.descriptor,
    { r2_buckets: [{ binding: "CAPTURES", bucket: "captures" }], crons: [] });
  assert.deepEqual(workerPart({ triggers: { crons: ["0 0 * * *"] } }).part.descriptor, { r2_buckets: [], crons: ["0 0 * * *"] });
  for (const none of [{}, { r2_buckets: [], triggers: { crons: [] } }, { triggers: {} }, null, undefined])
    assert.deepEqual(workerPart(none), { part: null }, JSON.stringify(none));

  const lacks = (c) => workerPart(c).missing;
  assert.deepEqual(lacks({ r2_buckets: [{ binding: "ARCHIVE", bucket_name: "archive" }, { binding: "CAPTURES", bucket_name: "bio-captures" },
    { binding: "X" }, { bucket_name: "bio-published" }, "CAPTURES"] }),
    ["ARCHIVE", "X", "(an R2 bucket binding with no name)", "(an R2 bucket binding with no name)"], "each binding with no role, by name");
  assert.deepEqual(lacks({ r2_buckets: [{ binding: "C", bucket_name: "constructor" }] }), ["C"], "only the two roles, never an inherited key");
  assert.deepEqual(lacks({ r2_buckets: {} }), ["r2_buckets"]);
  for (const triggers of [{ crons: "17 4 * * *" }, { crons: [1] }, { crons: [" "] }, ["17 4 * * *"], "x"])
    assert.deepEqual(lacks({ triggers }), ["triggers.crons"], JSON.stringify(triggers));
  assert.deepEqual(lacks({ r2_buckets: [{ binding: "A", bucket_name: "a" }], triggers: { crons: [null] } }), ["A", "triggers.crons"], "both named");
});

test("R25: the repository's own members with buckets or crons carry a Worker part, every bucket with a role; file-scanner's names CAPTURES and its daily schedule", () => {
  const got = Object.fromEntries(discoverMembers().map((m) => {
    let cfg = null;
    try { cfg = parseJsonc(readFileSync(join(m.abs, "wrangler.jsonc"), "utf8")); } catch { /* a member with no config */ }
    return [m.name, cfg];
  }).filter(([, c]) => c));
  for (const [name, cfg] of Object.entries(got)) assert.equal(workerPart(cfg).missing, undefined, `${name}: every bucket has a role`);
  const scanner = workerPart(got["file-scanner"]).part.descriptor;
  assert.deepEqual(scanner.r2_buckets, [{ binding: "CAPTURES", bucket: "captures" }]);
  assert.ok(scanner.crons.length >= 1, "its schedule is stated");
});

test("R25 (K4094): workerPart states a member's own Durable Objects and migrations in order, each migration as {tag, classes}; another script's object (script_name) is not the member's and is left out; a part the Durable Objects alone need is written, and a member owning none is not", () => {
  const own = [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }];
  const cfg = { durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }, ...own] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["SegmentDriver"] }, { tag: "v2", new_sqlite_classes: ["CheckRecord"] }] };
  const w = workerPart(cfg);
  assert.deepEqual(w.part.descriptor, { r2_buckets: [], crons: [], durable_objects: { bindings: own,
    migrations: [{ tag: "v1", classes: ["SegmentDriver"] }, { tag: "v2", classes: ["CheckRecord"] }] } }, "the member's own objects, the migrations in order");
  assert.equal(w.part.bytes.toString("utf8"), JSON.stringify(w.part.descriptor, null, 2) + "\n");
  assert.deepEqual(workerPart({ durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }] } }), { part: null },
    "only another script's object: nothing of this member's to bind");
  assert.deepEqual(workerPart({ durable_objects: { bindings: [] }, migrations: [] }), { part: null }, "stated and empty: none");

  const lacks = (c) => workerPart(c).missing;
  assert.deepEqual(lacks({ durable_objects: { bindings: [{ name: "SCANNER" }] } }), ["durable_objects.bindings"], "a binding with no class");
  assert.deepEqual(lacks({ durable_objects: [{ name: "SCANNER", class_name: "FileScanner" }] }), ["durable_objects.bindings"], "a list that is not bindings");
  assert.deepEqual(lacks({ durable_objects: { bindings: [{ name: "SCANNER", class_name: "FileScanner" }] }, migrations: [{ tag: "1", new_sqlite_classes: ["FileScanner"] }] }),
    ["migrations"], "a tag the installer does not read");
  assert.deepEqual(lacks({ durable_objects: { bindings: [{ name: "S", class_name: "F" }] }, migrations: [{ tag: "v1", renamed_classes: [{ from: "A", to: "F" }] }] }),
    ["migrations"], "a migration that is not new classes is refused, never dropped");
  assert.deepEqual(lacks({ migrations: {} }), ["migrations"]);
});

test("R25 (K4094): over the repository's own fleet, each member's Worker part states the Durable Objects its configuration owns: agent-worker its two, agent-runner its one binding and every migration it declares, file-scanner its two", () => {
  const cfgOf = (name) => parseJsonc(readFileSync(join(discoverMembers().find((m) => m.name === name).abs, "wrangler.jsonc"), "utf8"));
  assert.deepEqual(workerPart(cfgOf("agent-worker")).part.descriptor.durable_objects, {
    bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }],
    migrations: [{ tag: "v1", classes: ["SegmentDriver"] }, { tag: "v2", classes: ["CheckRecord"] }] });
  const runner = workerPart(cfgOf("agent-runner")).part.descriptor.durable_objects;
  assert.deepEqual(runner.bindings, [{ name: "AGENT_RUNNER", class_name: "AgentRunner" }]);
  assert.deepEqual(runner.migrations, cfgOf("agent-runner").migrations.map((m) => ({ tag: m.tag, classes: m.new_sqlite_classes })));
  assert.deepEqual(workerPart(cfgOf("file-scanner")).part.descriptor.durable_objects.bindings,
    [{ name: "SCANNER", class_name: "FileScanner" }, { name: "RENDERER", class_name: "SafeViewRenderer" }]);
});


/* ------------------------------------------------------------------------ R35 */

const HUB_IMAGE = /^docker\.io\/civicsmith\/(agent-runner|file-scanner-scanner|file-scanner-renderer|reader-container)@sha256:[0-9a-f]{64}$/;
/** R35's real-fleet test (K2266), as a function of the members it is given: every image the container members state
 *  that is not `docker.io/civicsmith/<repository>@sha256:<64 hex>`, as the part R25 would write it. */
const imagesOf = (members) => members.filter(isContainer)
  .flatMap((m) => (m.containers ? m.containers.map((c) => c.image) : [m.image])).map((i) => imageReference(i).reference ?? "(none)");
const notOnDockerHub = (members) => imagesOf(members).filter((r) => !HUB_IMAGE.test(r));

test("R35: the real fleet's four container images (agent-runner's, file-scanner's two classes, reader-container's) are named docker.io/civicsmith/<repository>@sha256:<64 hex> by their markers, and the part R25 writes carries that address", () => {
  const members = discoverMembers();
  const images = imagesOf(members);
  assert.equal(images.length, 4, "agent-runner's image, file-scanner's two classes and reader-container's, no other");
  assert.deepEqual(notOnDockerHub(members), []);
  assert.deepEqual(images.map((r) => r.split("@")[0]).sort(),
    ["docker.io/civicsmith/agent-runner", "docker.io/civicsmith/file-scanner-renderer", "docker.io/civicsmith/file-scanner-scanner", "docker.io/civicsmith/reader-container"]);
  const names = members.map((m) => m.name);
  for (const m of members.filter(isContainer)) {
    const d = containerParts(m, names, { packages: false });
    assert.ok(d.parts, `${m.name}: ${JSON.stringify(d)}`);
    for (const part of d.parts) assert.match(part.descriptor.image, HUB_IMAGE, `${m.name} ${part.class_name}: no credential is needed to pull it`);
  }
});

test("R35: R24's and R25's fixtures name docker.io/<org>/…@sha256 markers and are listed and written as stated; control: a marker naming another registry is written as stated by R25, and the real-fleet test fails on it", () => {
  const root = tmp("r35");
  try {
    containerFixture(root, "hub", { image: { ...IMAGE, repository: "docker.io/civicsmith/agent-runner" },
      extra: { class_name: "Runner", max_instances: 2, bind: [{ member: "hub", binding: "RUNNER" }], bundle: { entry: "src/entry.mjs", outfile: "dist/a.mjs", manifest: "dist/a.json" } } });
    containerFixture(root, "ghcr", { image: { ...IMAGE, repository: "ghcr.io/believeinoakland/agent-runner" },
      extra: { class_name: "Runner", max_instances: 2, bind: [{ member: "hub", binding: "RUNNER" }], bundle: { entry: "src/entry.mjs", outfile: "dist/a.mjs", manifest: "dist/a.json" } } });
    const [ghcr, hub] = discoverMembers(root);
    assert.equal(containerDescriptor(hub, ["hub"]).descriptor.image, `docker.io/civicsmith/agent-runner@${DIGEST}`);
    assert.equal(containerDescriptor(ghcr, ["hub"]).descriptor.image, `ghcr.io/believeinoakland/agent-runner@${DIGEST}`, "emitted as written");
    assert.deepEqual(notOnDockerHub([hub]).length, 0);
    assert.deepEqual(notOnDockerHub([ghcr]), [`ghcr.io/believeinoakland/agent-runner@${DIGEST}`], "the real-fleet test fails on it");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* --------------------------------------------------------------------- R36, R37 */

const IMG_BASE = "sha256:" + "1c".repeat(32);
const NEW_DIGEST = "sha256:" + "9e".repeat(32);
/** A container member whose one class is built from a Dockerfile that COPYs `package.json` and `container/`, with its
 *  image's digest and source recorded as R36 leaves them (`recorded: false` for a marker that records no source). */
function imageMember(root, dir = "runner", { recorded = true, classes = null } = {}) {
  mkdirSync(join(root, dir, "container"), { recursive: true });
  writeFileSync(join(root, dir, "package.json"), '{"name":"runner"}\n');
  writeFileSync(join(root, dir, "container/app.mjs"), "export const app = 1;\n");
  writeFileSync(join(root, dir, "README.md"), "not copied into the image\n");
  const dockerfiles = classes || [{ class_name: "Runner", dockerfile: "Dockerfile" }];
  for (const c of dockerfiles)
    writeFileSync(join(root, dir, c.dockerfile), `FROM docker.io/library/node@${IMG_BASE}\nCOPY package.json ./\nCOPY container ./container/\nCOPY --from=build /out ./out\n`);
  const image = (c, i) => ({ repository: `docker.io/civicsmith/${dir}${i}`, digest: DIGEST, platform: "linux/amd64", port: 8080 });
  const marker = classes
    ? { name: dir, kind: "container", containers: dockerfiles.map((c, i) => ({ class_name: c.class_name, image: image(c, i), build: { dockerfile: c.dockerfile } })) }
    : { name: dir, kind: "container", class_name: "Runner", image: image(null, ""), build: { dockerfile: "Dockerfile" } };
  writeFileSync(join(root, dir, "fleet-member.json"), JSON.stringify(marker, null, 2) + "\n");
  writeFileSync(join(root, dir, "wrangler.jsonc"), `// the container block\n{\n  "containers": [\n`
    + dockerfiles.map((c, i) => `    // ${c.class_name}'s image\n    { "class_name": "${c.class_name}", "image": "ghcr.io/believeinoakland/${dir}${classes ? i : ""}@${DIGEST}", "max_instances": 1 }`).join(",\n")
    + `\n  ]\n}\n`);
  const member = () => discoverMembers(root).find((m) => m.name === dir);
  if (recorded) for (const c of dockerfiles) {
    const m = member();
    const r = recordContainerDigest(m, c.class_name, DIGEST);
    assert.ok(r.files, JSON.stringify(r));
  }
  return member;
}

test("R37: a class whose image files match what its recorded digest was built from is current; a changed byte in a copied file, an added file in a copied directory, a changed Dockerfile, or a file removed from a copied directory is stale, naming the class; a file the Dockerfile does not copy, and a COPY --from, change nothing", () => {
  const root = tmp("r37");
  try {
    const member = imageMember(root);
    const states = () => containerImageStates(member()).map((s) => [s.class_name, s.state]);
    assert.deepEqual(states(), [["Runner", "current"]]);
    assert.deepEqual(containerImageFindings(member()), []);
    writeFileSync(join(root, "runner/README.md"), "changed, still not copied\n");
    assert.deepEqual(states(), [["Runner", "current"]], "control: a file the image is not built from");
    for (const [change, undo] of [
      [() => writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 2;\n"), () => writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 1;\n")],
      [() => writeFileSync(join(root, "runner/container/extra.mjs"), "x\n"), () => rmSync(join(root, "runner/container/extra.mjs"))],
      [() => writeFileSync(join(root, "runner/Dockerfile"), `FROM docker.io/library/node@sha256:${"2d".repeat(32)}\nCOPY package.json ./\nCOPY container ./container/\n`),
        () => writeFileSync(join(root, "runner/Dockerfile"), `FROM docker.io/library/node@${IMG_BASE}\nCOPY package.json ./\nCOPY container ./container/\nCOPY --from=build /out ./out\n`)],
      [() => writeFileSync(join(root, "runner/package.json"), '{"name":"runner","x":1}\n'), () => writeFileSync(join(root, "runner/package.json"), '{"name":"runner"}\n')],
    ]) {
      change();
      assert.deepEqual(states(), [["Runner", "stale"]]);
      const f = containerImageFindings(member());
      assert.equal(f.length, 1);
      assert.equal(f[0].class_name, "Runner");
      assert.match(f[0].text, /^runner: .*class Runner/);
      undo();
      assert.deepEqual(states(), [["Runner", "current"]], "restored, current again");
    }
    rmSync(join(root, "runner/container/app.mjs"));
    assert.deepEqual(states(), [["Runner", "stale"]], "a file removed from a copied directory moves the hash");
    rmSync(join(root, "runner/container"), { recursive: true });
    assert.deepEqual(states(), [["Runner", "unread"]], "a copied path that is not in the tree cannot be hashed, and is not skipped");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R37: a marker that records nothing its digest was built from, or a source that is not a 64-hex digest, is unrecorded; a Dockerfile naming no file, copying a wildcard or an address, or a marker naming no Dockerfile, is unread", () => {
  const root = tmp("r37b");
  try {
    const member = imageMember(root, "runner", { recorded: false });
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unrecorded"]);
    const marker = join(root, "runner/fleet-member.json");
    const good = JSON.parse(readFileSync(marker, "utf8"));
    writeFileSync(marker, JSON.stringify({ ...good, image: { ...good.image, [SOURCE_FIELD]: "not-a-hash" } }));
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unrecorded"]);
    for (const line of ["COPY container/* ./container/", "ADD https://x.test/a.tar ./a.tar", "COPY ../outside ./x", "COPY [\"container\",", "ADD /abs ./x"]) {
      writeFileSync(join(root, "runner/Dockerfile"), `FROM x@${IMG_BASE}\n${line}\n`);
      assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unread"], line);
    }
    const { build: _b, ...noBuild } = good;
    writeFileSync(marker, JSON.stringify(noBuild));
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["unread"], "no build.dockerfile is named, never defaulted");
    assert.ok(containerSourceHash(member(), "Runner").unread);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R36: recording the digest a build produced writes it, and the files it was built from, into the marker's image block and the digest into the image the wrangler.jsonc container block names, both agreeing, keeping the wrangler comments and repository; the class is current afterwards", () => {
  const root = tmp("r36");
  try {
    const member = imageMember(root, "runner", { recorded: false });
    writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 3; // the changed code\n");
    const r = recordContainerDigest(member(), "Runner", NEW_DIGEST);
    assert.deepEqual(r, { files: ["runner/fleet-member.json", "runner/wrangler.jsonc"] });
    const marker = JSON.parse(readFileSync(join(root, "runner/fleet-member.json"), "utf8"));
    assert.equal(marker.image.digest, NEW_DIGEST);
    assert.equal(marker.image[SOURCE_FIELD], containerSourceHash(member(), "Runner").sha256);
    assert.equal(marker.image.repository, "docker.io/civicsmith/runner", "the other fields are untouched");
    assert.deepEqual(Object.keys(marker.image), ["repository", "digest", SOURCE_FIELD, "platform", "port"]);
    const wrangler = readFileSync(join(root, "runner/wrangler.jsonc"), "utf8");
    const cfg = parseJsonc(wrangler);
    assert.equal(cfg.containers[0].image, `ghcr.io/believeinoakland/runner@${NEW_DIGEST}`, "its own repository, the new digest");
    assert.match(wrangler, /^\/\/ the container block\n/);
    assert.match(wrangler, /\/\/ Runner's image/);
    assert.equal(imageReference(member().image).reference.split("@")[1], cfg.containers[0].image.split("@")[1], "the two files agree");
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["current"]);
    /* Changing the code again outruns the new digest until it is recorded again. */
    writeFileSync(join(root, "runner/container/app.mjs"), "export const app = 4;\n");
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["stale"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R36: a member with two classes records the digest of the class named and leaves the other's digest, source and image as they were", () => {
  const root = tmp("r36b");
  try {
    const classes = [{ class_name: "Scanner", dockerfile: "Dockerfile.scanner" }, { class_name: "Renderer", dockerfile: "Dockerfile.renderer" }];
    const member = imageMember(root, "multi", { classes });
    const before = JSON.parse(readFileSync(join(root, "multi/fleet-member.json"), "utf8"));
    writeFileSync(join(root, "multi/Dockerfile.renderer"), `FROM docker.io/library/node@${IMG_BASE}\nCOPY container ./container/\n`);
    assert.deepEqual(containerImageStates(member()).map((s) => [s.class_name, s.state]), [["Scanner", "current"], ["Renderer", "stale"]]);
    assert.ok(recordContainerDigest(member(), "Renderer", NEW_DIGEST).files);
    const after = JSON.parse(readFileSync(join(root, "multi/fleet-member.json"), "utf8"));
    assert.deepEqual(after.containers[0], before.containers[0], "the scanner is untouched");
    assert.equal(after.containers[1].image.digest, NEW_DIGEST);
    const cfg = parseJsonc(readFileSync(join(root, "multi/wrangler.jsonc"), "utf8"));
    assert.equal(cfg.containers[0].image, `ghcr.io/believeinoakland/multi0@${DIGEST}`);
    assert.equal(cfg.containers[1].image, `ghcr.io/believeinoakland/multi1@${NEW_DIGEST}`);
    assert.deepEqual(containerImageStates(member()).map((s) => s.state), ["current", "current"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R36: a digest that is not sha256:<64 hex> (CONTAINER_DIGEST_INVALID), a class the member does not state, a member that is not a container member, a wrangler.jsonc naming no digest image for the class, and a Dockerfile that cannot be hashed are each refused, with neither file written", () => {
  const root = tmp("r36c");
  try {
    const member = imageMember(root, "runner", { recorded: false });
    mkdirSync(join(root, "plain/src"), { recursive: true });
    writeFileSync(join(root, "plain/src/index.mjs"), "export default {};\n");
    writeFileSync(join(root, "plain/fleet-member.json"), JSON.stringify({ name: "plain", entry: "src/index.mjs" }));
    const files = () => ["runner/fleet-member.json", "runner/wrangler.jsonc", "plain/fleet-member.json"].map((f) => readFileSync(join(root, f), "utf8"));
    const before = files();
    const code = (r) => r.refused;
    for (const bad of ["sha256:abc", "abc", `sha256:${"A".repeat(64)}`, undefined, null, 5])
      assert.equal(code(recordContainerDigest(member(), "Runner", bad)), "CONTAINER_DIGEST_INVALID", String(bad));
    assert.equal(code(recordContainerDigest(member(), "NoSuchClass", NEW_DIGEST)), "CONTAINER_UNDESCRIBED");
    const plain = discoverMembers(root).find((m) => m.name === "plain");
    assert.equal(code(recordContainerDigest(plain, "Runner", NEW_DIGEST)), "CONTAINER_UNDESCRIBED", "a non-container member gets no digest");
    const w = join(root, "runner/wrangler.jsonc");
    const wrangler = readFileSync(w, "utf8");
    writeFileSync(w, wrangler.replace(/@sha256:[0-9a-f]{64}/, ":latest"));
    assert.equal(code(recordContainerDigest(member(), "Runner", NEW_DIGEST)), "CONTAINER_UNDESCRIBED", "a tag is not a digest");
    writeFileSync(w, wrangler);
    writeFileSync(join(root, "runner/Dockerfile"), "FROM x\nCOPY nothing-here ./\n");
    assert.equal(code(recordContainerDigest(member(), "Runner", NEW_DIGEST)), "CONTAINER_UNDESCRIBED");
    writeFileSync(join(root, "runner/Dockerfile"), `FROM docker.io/library/node@${IMG_BASE}\nCOPY package.json ./\nCOPY container ./container/\nCOPY --from=build /out ./out\n`);
    assert.deepEqual(files(), before, "nothing was written by any refusal");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------- R36 (T51-144): the two digests agree */

/** T51-144: each container class whose marker `image.digest` is not the digest its `wrangler.jsonc` container block
 *  (matched by class) names, as text naming the member and the class; `[]` when every class agrees. */
const digestDisagreements = (members) => members.filter(isContainer).flatMap((m) => {
  const cfg = parseJsonc(readFileSync(join(m.abs, "wrangler.jsonc"), "utf8"), `${m.dir}/wrangler.jsonc`);
  const blocks = Array.isArray(cfg.containers) ? cfg.containers : [];
  return containerClasses(m).classes.flatMap((cls) => {
    const marked = cls.image && cls.image.digest;
    const block = blocks.find((b) => b.class_name === cls.class_name);
    const named = block && typeof block.image === "string" ? block.image.split("@")[1] : null;
    return marked && marked === named ? [] : [`${m.name} ${cls.class_name}: fleet-member.json names ${marked}, wrangler.jsonc names ${named}`];
  });
});

test("R36 (T51-144): over the real fleet, each container class's fleet-member.json image.digest is the digest its wrangler.jsonc containers[] entry names, so a cut cannot leave one stale", () => {
  const members = discoverMembers();
  assert.equal(members.filter(isContainer).flatMap((m) => containerClasses(m).classes).length, 4, "agent-runner's class, file-scanner's two and reader-container's, no other");
  assert.deepEqual(digestDisagreements(members), []);
});

test("R36 (T51-144): control: a fixture whose two digests differ fails the agreement test naming the member and the class; the same fixture with them equal passes", () => {
  const root = tmp("t144");
  try {
    imageMember(root);
    const members = () => discoverMembers(root);
    assert.deepEqual(digestDisagreements(members()), [], "the fixture's two digests agree");
    const wrangler = join(root, "runner/wrangler.jsonc");
    writeFileSync(wrangler, readFileSync(wrangler, "utf8").replace(DIGEST, NEW_DIGEST));
    assert.deepEqual(digestDisagreements(members()),
      [`runner Runner: fleet-member.json names ${DIGEST}, wrangler.jsonc names ${NEW_DIGEST}`]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------------- R38 */

/* A fixture member that reads a small word table through the same three calls the product's `setup-words` serves. The
   table's rows are the product's own shape, [key, en, note, means, protected, origin]. */
const FIXTURE_ROWS = [
  ["refusal.ALPHA", "a", null, null, false, "design"], ["refusal.BETA", "b", null, null, false, "design"],
  ["plain.one", "o", null, null, false, "design"], ["plain.two", "t", null, null, false, "design"],
  ["plain.three", "h", null, null, false, "code"], ["other.x", "x", null, null, false, "design"],
  ["tpl.a", "p", null, null, false, "design"], ["tpl.b", "q", null, null, false, "design"],
];
const FIXTURE_INDEX = `import { WORD_ROWS, WORDS_COMMIT } from "./rows.mjs";
export { WORD_ROWS, WORDS_COMMIT };
const by = () => new Map(WORD_ROWS.map((r) => [r[0], r]));
export const hasWord = (key) => by().has(key);
export const word = (key) => by().get(key)[1];
export const localize = (id, en) => (by().get(id) ? by().get(id)[1] : en);
`;

/** A fixture member under `root/dir` whose `src/index.mjs` is `body`, with the table at `src/setup-words/`. */
function wordsFixture(root, body, { dir = "w", extra = {} } = {}) {
  const m = fixture(root, dir, { vendored: false });
  mkdirSync(join(m.abs, "src/setup-words"), { recursive: true });
  writeFileSync(join(m.abs, "src/setup-words/rows.mjs"),
    `export const WORDS_COMMIT = "abc";\nexport const WORD_ROWS = Object.freeze(${JSON.stringify(FIXTURE_ROWS)});\n`);
  writeFileSync(join(m.abs, "src/setup-words/index.mjs"), FIXTURE_INDEX);
  writeFileSync(join(m.abs, "src/index.mjs"),
    'import { word, localize, hasWord } from "./setup-words/index.mjs";\n' + body
    + "\nexport default { fetch() { return new Response(String(KEYS)); } };\n");
  for (const [rel, text] of Object.entries(extra)) writeFileSync(join(m.abs, rel), text);
  return m;
}

/** The keys of the rows a built bundle carries, read from its `WORD_ROWS` literal. */
function keptKeys(bytes) {
  const text = bytes.toString("utf8");
  const at = text.indexOf("WORD_ROWS=Object.freeze([");
  if (at < 0) return null;
  const end = text.indexOf("]])", at);
  return [...text.slice(at, end + 2).matchAll(/\[("(?:[^"\\]|\\.)*"),/g)].map((m) => JSON.parse(m[1]));
}

test("R38: a member's bundle carries exactly the rows its inputs name at word, localize and hasWord calls, in the table's order, and its manifest records their count and digest", async () => {
  const root = tmp("r38a");
  try {
    const m = wordsFixture(root,
      'const KEYS = [word("plain.two"), localize("plain.one", "fallback"), hasWord("other.x"), localize("not.in.table", "only here"),\n'
      + '  word(`tpl.a`), (KEYS_FLAG ? word("tpl.b") : word("plain.three"))];\nvar KEYS_FLAG = true;');
    const built = await buildMember(m);
    const want = FIXTURE_ROWS.map((r) => r[0]).filter((k) => ["plain.one", "plain.two", "plain.three", "other.x", "tpl.a", "tpl.b"].includes(k));
    assert.deepEqual(keptKeys(built.bytes), want, "the named rows, no other, in the table's own order");
    assert.ok(!built.bytes.toString("utf8").includes("refusal.ALPHA"), "a row nothing names is not in the bundle");
    assert.equal(built.words.rows, want.length);
    const kept = FIXTURE_ROWS.filter((r) => want.includes(r[0]));
    assert.equal(built.words.sha256, hex(JSON.stringify(kept)), "the digest is of the kept rows");
    assert.deepEqual(manifestFrom(m, built).words, { rows: want.length, sha256: hex(JSON.stringify(kept)) });
    /* the module's own rows import is replaced, so the bundle still answers every call */
    const out = join(root, "out.mjs"); writeFileSync(out, built.bytes);
    assert.equal((await import(`file://${out}`)).default.fetch().constructor, Response);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R38: control: a key built from a literal prefix ('refusal.' + code, or a template) keeps every row under that prefix", async () => {
  const root = tmp("r38b");
  try {
    const m = wordsFixture(root,
      "const code = process.argv.length ? 'ALPHA' : 'BETA';\nconst KEYS = [word('refusal.' + code), word(`tpl.${code}`)];");
    const built = await buildMember(m);
    assert.deepEqual(keptKeys(built.bytes), ["refusal.ALPHA", "refusal.BETA", "tpl.a", "tpl.b"], "all of refusal.*, all of tpl.*, nothing else");
    assert.equal(built.words.rows, 4);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R38: control: a key read from a bare variable keeps the whole table for that member, names every such site by file and line in its manifest (words: all), and the build does not fail", async () => {
  const root = tmp("r38c");
  try {
    const m = wordsFixture(root, "function say(k) {\n  return word(k);\n}\nconst KEYS = [say('plain.one'), hasWord(String(1))];");
    const built = await buildMember(m, { write: true });
    for (const [k] of FIXTURE_ROWS) assert.ok(built.bytes.toString("utf8").includes(`"${k}"`), `the whole table is kept: ${k}`);
    assert.deepEqual(built.words, { rows: "all", total: FIXTURE_ROWS.length, text: null, sha256: null, sites: ["src/index.mjs:3", "src/index.mjs:5"] });
    const man = manifestFrom(m, built);
    assert.equal(man.words, "all");
    assert.deepEqual(man.wordSites, ["src/index.mjs:3", "src/index.mjs:5"], "every site, by file and line");
    /* the build equals one with no trimming at all: the bytes of the table are the table's */
    const untrimmed = await buildMember({ ...m, wholeWordTable: true });
    assert.ok(Buffer.compare(built.bytes, untrimmed.bytes) === 0, "a member that keeps the whole table is built as the whole table is");
    /* a key with no literal head is the same: a template that starts with its variable, a call's result, no key, a spread */
    for (const body of ["const k = 'a';\nconst KEYS = word(`${k}.x`);", "const KEYS = word(String(1));", "const KEYS = word();", "const KEYS = word(...['plain.one']);"]) {
      const b = await buildMember(wordsFixture(root, body, { dir: "w2" }));
      assert.equal(b.words.rows, "all", body);
      assert.match(b.words.sites[0], /^src\/index\.mjs:\d+$/, body);
    }
    /* one literal site among bare ones does not trim: any unbounded site keeps every row */
    const mixed = await buildMember(wordsFixture(root, "const KEYS = [word('plain.one'), word(String(2))];", { dir: "w3" }));
    assert.equal(mixed.words.rows, "all");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R38: control: a read that is not a call (word used as a value, the whole table imported, a dynamic import) keeps the whole table naming the site; a word, localize or hasWord the file declares itself is not the call", async () => {
  const root = tmp("r38d");
  try {
    const all = async (body, dir) => (await buildMember(wordsFixture(root, body, { dir }))).words;
    assert.deepEqual((await all("const KEYS = ['plain.one'].map(word);", "v")).sites, ["src/index.mjs:2"]);
    assert.deepEqual((await all("import { WORD_ROWS } from './setup-words/index.mjs';\nconst KEYS = WORD_ROWS.length;", "t")).sites, ["src/index.mjs:2"]);
    assert.deepEqual((await all("const KEYS = await import('./' + 'setup-words/rows.mjs');", "d")).sites, ["src/index.mjs:2"]);
    /* a local function named word is that function's own call (setup-words' build uses the same rule) */
    const m = wordsFixture(root, "function pick(word) { return word(somethingElse()); }\nconst somethingElse = () => 'x';\nconst KEYS = [pick(() => 1), word('plain.one')];", { dir: "s" });
    assert.deepEqual(keptKeys((await buildMember(m)).bytes), ["plain.one"]);
    /* wordKeysOf, at the parser: sites are listed, not thrown, and the keys still gathered */
    const got = wordKeysOf("import {word} from 'x';\nword('a.b'); word(v); word('c.' + v);", "f.mjs");
    assert.deepEqual([[...got.exact], [...got.prefixes], got.sites.length], [["a.b"], ["c."], 1]);
    assert.match(got.sites[0], /^f\.mjs:2: /);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R38: the plane's bundle is unchanged: the plane carries the whole table, records no word rows, and is built by the plain recipe; a member whose inputs do not reach the table builds as before and records none", async () => {
  const plane = planeMember();
  assert.equal(plane.wholeWordTable, true);
  const built = await buildMember(plane);
  assert.equal(built.words, null);
  assert.equal(manifestFrom(plane, built).words, undefined, "the plane's manifest has no words field");
  /* the plane is built by the recipe alone (R2), as before R38: no plugin stands between it and the table */
  const recipe = await esbuildBuild({ ...optionsFor(plane), write: false, logLevel: "silent" });
  assert.ok(Buffer.compare(built.bytes, asciiOutput(Buffer.from(recipe.outputFiles[0].contents))) === 0, "byte-identical to the plain recipe's build");
  assert.ok(built.bytes.toString("utf8").includes("WORDS_COMMIT"), "with the whole table in it");
  const root = tmp("r38e");
  try {
    const none = fixture(root, "plain", { vendored: false });
    const b = await buildMember(none);
    assert.equal(b.words, null);
    assert.equal(manifestFrom(none, b).words, undefined);
    const whole = wordsFixture(root, "const KEYS = [word('plain.one')];", { dir: "all" });
    const wholeBuilt = await buildMember({ ...whole, wholeWordTable: true });
    /* a build that is no fleet member's (a descriptor with no marker, as the standalone case checker's) is not trimmed */
    const { marker: _marker, ...adHoc } = whole;
    const adHocBuilt = await buildMember({ ...adHoc, bundle: { ...adHoc.bundle, ascii: true } });   /* the same recipe (R2), so the bytes compare */
    assert.equal(adHocBuilt.words, null);
    assert.ok(Buffer.compare(adHocBuilt.bytes, wholeBuilt.bytes) === 0, "built whole");
    assert.equal(wholeBuilt.words, null);
    for (const [k] of FIXTURE_ROWS) assert.ok(wholeBuilt.bytes.toString("utf8").includes(`"${k}"`), `a member marked wholeWordTable keeps ${k}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R38: verifyFresh covers the rows kept: a manifest that records other rows than a fresh build keeps is stale, and one that records them is fresh", async () => {
  const root = tmp("r38f");
  try {
    const m = wordsFixture(root, "const KEYS = [word('plain.one'), word('plain.two')];");
    await writeMember(m);
    const committed = readFileSync(join(m.abs, m.bundle.outfile));
    const ok = await verifyFresh(m, committed);
    assert.equal(ok.checked, true); assert.deepEqual(ok.findings, []);
    const mf = join(m.abs, m.bundle.manifest);
    const man = JSON.parse(readFileSync(mf, "utf8"));
    assert.equal(man.words.rows, 2);
    for (const bad of [{ ...man.words, rows: 3 }, { ...man.words, sha256: "0".repeat(64) }, undefined, "all"]) {
      writeFileSync(mf, JSON.stringify({ ...man, words: bad }, null, 2));
      const r = await verifyFresh(m, committed);
      assert.equal(r.findings.length, 1, JSON.stringify(bad));
      assert.match(r.findings[0], /^w: STALE BUNDLE .*word rows/);
    }
    /* a member that keeps the whole table: its manifest's sites are covered the same way */
    const whole = wordsFixture(root, "const KEYS = [word(String(1))];", { dir: "wa" });
    await writeMember(whole);
    const wholeBytes = readFileSync(join(whole.abs, whole.bundle.outfile));
    assert.deepEqual((await verifyFresh(whole, wholeBytes)).findings, []);
    const wm = join(whole.abs, whole.bundle.manifest);
    const wman = JSON.parse(readFileSync(wm, "utf8"));
    assert.equal(wman.words, "all");
    writeFileSync(wm, JSON.stringify({ ...wman, wordSites: ["src/index.mjs:9"] }, null, 2));
    assert.equal((await verifyFresh(whole, wholeBytes)).findings.length, 1, "a moved site is stale");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** The rows the real fleet's members keep, stated by member in the test output. */
const REAL_WORDS = [];
const realBuildable = async (m) => {
  const manifest = (() => { try { return JSON.parse(readFileSync(join(m.abs, m.bundle.manifest), "utf8")); } catch { return null; } })();
  return manifest ? freshBuildRunnable(m, manifest).runnable : true;
};

test("R38: over the real fleet, each member that builds carries only the rows its inputs name (each member's row count stated); the bundles' keys are all named by literal at a call or under a literal prefix of its inputs", async () => {
  for (const m of discoverMembers().filter((x) => x.bundle)) {
    if (!(await realBuildable(m))) continue;     /* dependencies not installed here: freshBuildRunnable says so, as the fleet gate does */
    const built = await buildMember(m);
    /* a member whose inputs reach no word table records nothing (`words` null) and carries none of it (agent-runner:
       its Worker's own data holds the rows its image reads, K4011): the control is that no table input is bundled */
    if (built.words === null) {
      assert.ok(!Object.keys(built.metafile.inputs).some((p) => /setup-words\/rows\.mjs$/.test(p)), `${m.name} bundles the word table and records no rows`);
      continue;
    }
    if (built.words.rows === "all") continue;     /* keeps the whole table for a site of another module: the next test */
    const keys = keptKeys(built.bytes);
    assert.ok(keys && keys.length > 0 && keys.length === built.words.rows, `${m.name}: carries a word table of ${built.words?.rows} rows`);
    assert.ok(keys.length < 200, `${m.name}: ${keys.length} rows of ${built.words.total}, not the whole table`);
    const table = (await import(`file://${join(m.abs, Object.keys(built.metafile.inputs).find((p) => /setup-words\/rows\.mjs$/.test(p)))}`)).WORD_ROWS;
    assert.deepEqual(keys, table.map((r) => r[0]).filter((k) => new Set(keys).has(k)), `${m.name}: in the table's order`);
    /* independent of the parser: the sources of the member's bundled first-party inputs name every kept key as a
       quoted literal, or begin it with a literal prefix followed by a join (a `+` or a `${`) */
    const sources = Object.keys(built.metafile.inputs).filter((p) => !p.split("/").includes("node_modules") && /\.(mjs|js)$/.test(p) && !/setup-words\/rows/.test(p))
      .map((p) => readFileSync(join(m.abs, p), "utf8")).join("\n");
    const prefixes = [...sources.matchAll(/["'`]([A-Za-z0-9_.-]+\.)["'`]\s*\+|`([A-Za-z0-9_.-]+\.)\$\{/g)].map((x) => x[1] ?? x[2]);
    for (const k of keys)
      assert.ok(["\"", "'", "`"].some((q) => sources.includes(q + k + q)) || prefixes.some((p) => k.startsWith(p)), `${m.name}: ${k} is named by its inputs`);
    REAL_WORDS.push(`${m.name} ${keys.length} of ${built.words.total}`);
  }
  assert.ok(REAL_WORDS.length >= 3, `the members built here: ${REAL_WORDS.join("; ")}`);
  console.log(`# R38 real fleet: ${REAL_WORDS.join("; ")}`);
});

test("R38: over the real fleet, a member whose inputs hold a word read with a variable key keeps the whole table and its manifest names the sites by file and line (agent-worker today; K3958)", async () => {
  const keepsWhole = [];
  for (const m of discoverMembers().filter((x) => x.bundle)) {
    if (!(await realBuildable(m))) continue;
    const built = await buildMember(m);
    if (built.words?.rows !== "all") continue;
    keepsWhole.push(m.name);
    const man = manifestFrom(m, built);
    assert.equal(man.words, "all");
    assert.ok(man.wordSites.length > 0 && man.wordSites.every((s) => /^\S+\.mjs:\d+$/.test(s)), `${m.name}: each site is a file and a line`);
    assert.deepEqual(man.wordSites, [...man.wordSites].sort(), "in code-point order");
    for (const site of man.wordSites) {
      const [file, line] = [site.slice(0, site.lastIndexOf(":")), Number(site.slice(site.lastIndexOf(":") + 1))];
      assert.ok(readFileSync(join(m.abs, file), "utf8").split("\n").length >= line, `${site} is a line of its file`);
    }
    console.log(`# R38 real fleet: ${m.name} keeps the whole table (${built.words.total} rows) for ${man.wordSites.length} site(s): ${man.wordSites.join(", ")}`);
  }
  assert.ok(!keepsWhole.includes("pdf-worker") && !keepsWhole.includes("ocr-worker") && !keepsWhole.includes("sheet-worker"), `the members that keep the whole table: ${keepsWhole.join(", ")}`);
});

/* --------------------------------------------------------------------- R39 */

const unit = (name, exports, config = {}) => ({ name, exports, config });
const naming = (fs, member, binding, what) => fs.filter((f) => f.member === member && f.binding === binding && f.name === what);

test("R39: every kind of binding is held to what the release exports: a service names the plane or a member; a Durable Object with a script_name names a member whose bundle exports the class, one without names its own bundle's; a container class and each class a migration creates, renames to or transfers are exported by the member's own bundle", () => {
  const plane = unit("bio-plane", ["Store", "default"], { durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] },
    services: [{ binding: "SELF", service: "bio-plane" }, { binding: "PDF", service: "pdf-worker" }] });
  const pdf = unit("pdf-worker", ["default"], { services: [{ binding: "PLANE", service: "bio-plane" }] });
  const runner = unit("agent-runner", ["AgentRunner", "default"], {
    containers: [{ class_name: "AgentRunner" }], durable_objects: { bindings: [{ name: "AGENT_RUNNER", class_name: "AgentRunner" }] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["AgentRunner"] }] });
  const worker = unit("agent-worker", ["default", "SegmentDriver"], { services: [{ binding: "PLANE", service: "bio-plane" }],
    durable_objects: { bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" },
      { name: "REMOTE", class_name: "AgentRunner", script_name: "agent-runner" }] } });
  assert.deepEqual(bindingFindings([plane, pdf, runner, worker]), [], "a coherent release has no finding");

  /* the defect K4176 found: REMOTE names a class the other member's bundle lacks */
  const lacking = bindingFindings([plane, pdf, { ...runner, exports: ["default"] }, { ...worker,
    config: { ...worker.config, durable_objects: { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }] } } }]);
  const remote = naming(lacking, "agent-worker", "REMOTE", "RemoteSession");
  assert.equal(remote.length, 1, JSON.stringify(lacking));
  assert.match(remote[0].text, /agent-worker/);
  assert.match(remote[0].text, /REMOTE/);
  assert.match(remote[0].text, /RemoteSession/);
  assert.match(remote[0].text, /agent-runner/);

  /* a service naming no member of the release */
  const stray = bindingFindings([plane, { ...pdf, config: { services: [{ binding: "GHOST", service: "ghost-worker" }] } }]);
  assert.equal(naming(stray, "pdf-worker", "GHOST", "ghost-worker").length, 1);
  assert.equal(naming(stray, "bio-plane", "PDF", "pdf-worker").length, 0, "pdf-worker is in this release");
  /* a script_name naming no member */
  const nowhere = bindingFindings([unit("a", [], { durable_objects: { bindings: [{ name: "X", class_name: "C", script_name: "nobody" }] } })]);
  assert.equal(naming(nowhere, "a", "X", "C").length, 1);
  /* no script_name: the member's own bundle; a script_name naming itself is the same */
  const own = bindingFindings([unit("a", ["C"], { durable_objects: { bindings: [{ name: "X", class_name: "C" }, { name: "Y", class_name: "C", script_name: "a" }, { name: "Z", class_name: "D" }] } })]);
  assert.deepEqual(own.map((f) => [f.binding, f.name]), [["Z", "D"]]);
  /* a container class and the migration forms */
  const cont = bindingFindings([unit("a", ["A"], { containers: [{ class_name: "A" }, { class_name: "B" }],
    migrations: [{ tag: "v1", new_sqlite_classes: ["A", "M1"] }, { tag: "v2", new_classes: ["M2"] },
      { tag: "v3", renamed_classes: [{ from: "Old", to: "M3" }] }, { tag: "v4", transferred_classes: [{ from: "O", from_script: "s", to: "M4" }] },
      { tag: "v5", deleted_classes: ["Gone"] }] })]);
  assert.deepEqual(cont.map((f) => f.name).sort(), ["B", "M1", "M2", "M3", "M4"], "a deleted class needs no export");
  /* a config with none of these keys, or none at all, binds nothing */
  assert.deepEqual(bindingFindings([unit("a", []), { name: "b", exports: new Set(), config: null }]), []);
});

test("R43 (a): a class a member's migration deletes needs no export, and no binding of any member of the release may name it unless a later migration of its own member creates it again; the control is R39's creation without an export", () => {
  const runner = (migrations, exports = ["default"]) => unit("agent-runner", exports, { migrations });
  const worker = (bindings) => unit("agent-worker", ["default"], { durable_objects: { bindings } });
  const deleting = [{ tag: "v1", new_sqlite_classes: ["RemoteSession"] }, { tag: "v3", deleted_classes: ["RemoteSession"] }];
  /* deleted, unbound, not exported: coherent */
  assert.deepEqual(bindingFindings([runner(deleting), worker([])]), []);
  /* the other member still binds it: refused naming member, binding and class */
  const bound = bindingFindings([runner(deleting), worker([{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }])]);
  assert.equal(naming(bound, "agent-worker", "REMOTE", "RemoteSession").length, 1, JSON.stringify(bound));
  assert.match(bound[0].text, /agent-runner/);
  /* the member's own binding (no script_name) of its own deleted class is refused too */
  const own = bindingFindings([unit("a", [], { durable_objects: { bindings: [{ name: "X", class_name: "Gone" }] }, migrations: [{ tag: "v1", deleted_classes: ["Gone"] }] })]);
  assert.equal(naming(own, "a", "X", "Gone").length, 1, JSON.stringify(own));
  /* created again by a later migration of its own member (and exported): the binding stands */
  const again = [{ tag: "v1", deleted_classes: ["RemoteSession"] }, { tag: "v2", new_sqlite_classes: ["RemoteSession"] }];
  assert.deepEqual(bindingFindings([runner(again, ["default", "RemoteSession"]), worker([{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" }])]), []);
  /* control: a migration that creates a class its bundle does not export is refused as R39 states */
  assert.equal(naming(bindingFindings([runner([{ tag: "v1", new_sqlite_classes: ["RemoteSession"] }])]), "agent-runner", "migration v1", "RemoteSession").length, 1);
});

test("R43 (a): the release's Worker part states a member's migrations net of deletions: a deleted-only migration and a class a later migration deletes are no part of what an install creates, and a malformed deletion is named", () => {
  const cfg = (migrations) => ({ durable_objects: { bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" }] }, migrations });
  const part = (migrations) => workerPart(cfg(migrations));
  const read = (r) => r.part.descriptor.durable_objects.migrations;
  assert.deepEqual(read(part([{ tag: "v1", new_sqlite_classes: ["SegmentDriver", "RemoteSession"] }, { tag: "v2", deleted_classes: ["RemoteSession"] }])),
    [{ tag: "v1", classes: ["SegmentDriver"] }]);
  /* control: no deletion, the part is as before */
  assert.deepEqual(read(part([{ tag: "v1", new_sqlite_classes: ["SegmentDriver"] }])), [{ tag: "v1", classes: ["SegmentDriver"] }]);
  assert.deepEqual(part([{ tag: "v1", new_sqlite_classes: ["A"] }, { tag: "v2", deleted_classes: "A" }]).missing, ["migrations"]);
});

test("R43 (b): HEALTH, an ordinary class of the agent Worker beside SEGMENTS and CHECKS, is held to R39 as written: bound to a class the bundle exports it passes, to one it lacks it is refused", () => {
  const config = { durable_objects: { bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckDriver" }, { name: "HEALTH", class_name: "HealthProbe" }] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["SegmentDriver", "CheckDriver", "HealthProbe"] }] };
  assert.deepEqual(bindingFindings([unit("agent-worker", ["default", "SegmentDriver", "CheckDriver", "HealthProbe"], config)]), []);
  const lacking = bindingFindings([unit("agent-worker", ["default", "SegmentDriver", "CheckDriver"], config)]);
  assert.equal(naming(lacking, "agent-worker", "HEALTH", "HealthProbe").length, 1, JSON.stringify(lacking));
  assert.equal(naming(lacking, "agent-worker", "migration v1", "HealthProbe").length, 1, "its creating migration is held too");
});

test("R39: bundleExports reads the names the built bundle exports from the build, not from the source", async () => {
  const root = tmp("r39x");
  try {
    const abs = join(root, "probe");
    mkdirSync(join(abs, "src"), { recursive: true });
    writeFileSync(join(abs, "src/dep.mjs"), "export class FromDep {}\nexport class NeverExported {}\n");
    writeFileSync(join(abs, "src/index.mjs"), 'import { FromDep } from "./dep.mjs";\nclass Local {}\nexport { FromDep as Renamed, Local };\nexport class Direct {}\nexport default { fetch() { return new Response("ok"); } };\n');
    const m = { dir: "probe", name: "probe", abs, entry: "src/index.mjs", bundle: { entry: "src/index.mjs", outfile: "dist/probe.bundled.mjs", manifest: "dist/probe.bundle.json", external: [...DEFAULT_EXTERNAL] } };
    const built = await buildMember(m);
    assert.deepEqual([...bundleExports(m, built)].sort(), ["Direct", "Local", "Renamed", "default"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R39: over the real fleet as it stands, every service and Durable Object binding the plane's and each member's configuration declares names a class or service the release exports (red by name until agent-runner exports RemoteSession, K4176)", async () => {
  const members = [planeMember(), ...discoverMembers().filter((m) => m.bundle)];
  const { findings, unchecked } = await releaseBindingFindings(members);
  for (const u of unchecked) console.log(`# R39 real fleet: ${u.name} not checked: ${u.reason}`);
  assert.deepEqual(findings.map((f) => f.text), [], "every binding is exported by the bundle that would ship");
  assert.deepEqual(unchecked.map((u) => u.name), [], "every bundle was built, none left unread");
});
