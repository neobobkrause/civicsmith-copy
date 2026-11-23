/* bundler's generic recipe, built over fixture members only: proves R1 (discovery), R2 (one recipe, the same bytes from
 * any checkout layout), R3 (writes only when asked), R4 (the manifest), R5 (writeMember) and R8 (the specifier scan). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RECIPE, DEFAULT_EXTERNAL, discoverMembers, optionsFor, buildMember, manifestFrom, writeMember, verifyStatic,
  unresolvableSpecifiers, verifyFresh,
} from "../../../../scripts/fleet-bundle.mjs";
import { scratch, makeMember, snapshot, hex, threw, put, withBundle, same } from "./fixture.mjs";

const s = scratch("build");
/** @type {import("./fixture.mjs").BundledMember} */
let probe;
/** @type {any} */
let built;   /* one fixture member and one build of it, shared by R2, R4 and R8 */
before(async () => { probe = makeMember(s.root, "probe"); built = await buildMember(probe); });
after(() => s.done());

/* ------------------------------------------------------------------------- R1 */

test("R1: discoverMembers lists every member of a repository with its directory and entry point, in a stable code-point order", () => {
  const { root, done } = scratch("r1");
  try {
    makeMember(root, "zed", { name: "b-worker", vendored: false });
    makeMember(root, "alpha", { name: "c-worker", vendored: false });
    makeMember(root, "mid", { name: "a-worker", vendored: false });
    put(join(root, ".hidden"), { "fleet-member.json": JSON.stringify({ name: "a-hidden", entry: "src/index.mjs" }) });   /* a dot directory is not the fleet */
    mkdirSync(join(root, "not-a-member"));                                  /* no marker */
    writeFileSync(join(root, "a-file.txt"), "x");                           /* not a directory */
    mkdirSync(join(root, "plain"));
    writeFileSync(join(root, "plain", "fleet-member.json"), JSON.stringify({ name: "d-worker", entry: "src/main.mjs" }));
    mkdirSync(join(root, "unnamed"));
    writeFileSync(join(root, "unnamed", "fleet-member.json"), JSON.stringify({ bundle: { entry: "src/b.mjs" } }));

    const got = discoverMembers(root);
    assert.deepEqual(got.map((m) => [m.name, m.dir, m.entry]), [
      ["a-worker", "mid", "src/index.mjs"], ["b-worker", "zed", "src/index.mjs"], ["c-worker", "alpha", "src/index.mjs"],
      ["d-worker", "plain", "src/main.mjs"], ["unnamed", "unnamed", "src/b.mjs"],
    ], "by name; a member with no name is named by its directory; the entry falls back to bundle.entry");
    for (const m of got) assert.equal(m.abs, join(root, m.dir), `${m.name}: abs is its directory`);
    assert.equal(got.find((m) => m.name === "d-worker").bundle, null, "a member without a bundle block is listed, not dropped");
    assert.deepEqual(discoverMembers(root), got, "the same repository gives the same list");
  } finally { done(); }
});

test("R1: names sort by code point, not the locale, and a name held by two directories is ordered by directory", () => {
  const { root, done } = scratch("r1order");
  try {
    for (const [dir, name] of [["b", "same"], ["a", "same"], ["c", "Z-upper"], ["d", "a-lower"]]) makeMember(root, dir, { name, vendored: false });
    assert.deepEqual(discoverMembers(root).map((m) => `${m.name}@${m.dir}`), ["Z-upper@c", "a-lower@d", "same@a", "same@b"]);
  } finally { done(); }
});

test("R1: a marker that is not valid JSON is an error naming it, never a member silently dropped", () => {
  const { root, done } = scratch("r1bad");
  try {
    makeMember(root, "good", { vendored: false });
    mkdirSync(join(root, "broken"));
    writeFileSync(join(root, "broken", "fleet-member.json"), "{ not json");
    const e = threw(() => discoverMembers(root));
    assert.match(e.message, /^fleet member marker .*broken[\\/]fleet-member\.json is not valid JSON: /);
  } finally { done(); }
});

/* ------------------------------------------------------------------------- R2 */

test("R2: one recipe: ES module output, platform-neutral, the declared externals, the working directory pinned to the member, symlinks preserved", () => {
  const o = optionsFor(probe);
  assert.deepEqual(RECIPE, { format: "esm", platform: "neutral" });
  assert.deepEqual([o.format, o.platform, o.bundle, o.preserveSymlinks, o.absWorkingDir, o.metafile],
    ["esm", "neutral", true, true, probe.abs, true]);
  assert.deepEqual(o.entryPoints, ["src/index.mjs"]);
  assert.deepEqual(DEFAULT_EXTERNAL, ["cloudflare:workers", "node:*"]);
  assert.deepEqual(o.external, [...DEFAULT_EXTERNAL], "no declared externals: the default");
  const custom = withBundle(probe, { external: ["cloudflare:workers", "fakedep"] });
  assert.deepEqual(optionsFor(custom).external, ["cloudflare:workers", "fakedep"], "the member's declared externals replace the default");
});

test("R2: the built bytes are one ES module bundling first-party and vendored code and importing only the declared externals", async () => {
  const text = built.bytes.toString("utf8");
  assert.match(text, /\bexport\s*\{/, "ES module output");
  assert.match(text, /from\s*"cloudflare:workers"/);
  assert.match(text, /from\s*"node:fs"/);
  assert.doesNotMatch(text, /from\s*"fakedep"|from\s*"\.\/dep\.mjs"/, "first-party and vendored modules are bundled");
  assert.doesNotMatch(text, /\brequire\(/, "platform-neutral ESM: no CommonJS shim");
  const out = join(s.root, "r2-out.mjs");
  writeFileSync(out, built.bytes.toString("utf8").replace(/import\s*\{[^}]*\}\s*from\s*"cloudflare:workers";?/, "const env = {};"));
  assert.equal(await (await (await import(`file://${out}`)).default.fetch()).text(), "41objectfunction", "it runs as its source does");
  const ext = await buildMember(withBundle(probe, { external: [...DEFAULT_EXTERNAL, "fakedep"] }));
  assert.match(ext.bytes.toString("utf8"), /from\s*"fakedep"/, "a declared external stays an import");
});

test("R2: the same source gives the same bytes from any process working directory and from a checkout whose node_modules is a symlink", async () => {
  const other = scratch("r2other"), shared = scratch("r2dep");
  const cwd = process.cwd();
  try {
    const bytes = [];
    for (const dir of [probe.abs, tmpdir(), other.root]) { process.chdir(dir); bytes.push((await buildMember(probe)).bytes); }
    process.chdir(cwd);
    for (const b of bytes) assert.ok(same(b, built.bytes), "the process's working directory never reaches the bytes");

    /* A second checkout, deeper, whose node_modules is a symlink into another tree. */
    const deep = makeMember(join(other.root, "deeper", "checkout"), "probe");
    cpSync(join(deep.abs, "node_modules"), join(shared.root, "node_modules"), { recursive: true });
    rmSync(join(deep.abs, "node_modules"), { recursive: true });
    symlinkSync(join(shared.root, "node_modules"), join(deep.abs, "node_modules"), "dir");
    const linked = (await buildMember(deep)).bytes;
    assert.ok(same(linked, built.bytes), "a symlinked install in another layout gives the same bytes");
    assert.ok(!linked.toString("utf8").includes(shared.root) && !built.bytes.toString("utf8").includes(s.root), "no absolute path reaches the bytes");
  } finally { process.chdir(cwd); other.done(); shared.done(); }
});

/* ------------------------------------------------------------------------- R3 */

test("R3: buildMember writes the artifact only when write is true, and then exactly the bytes it returns", async () => {
  const m = makeMember(s.root, "r3");
  const out = join(m.abs, m.bundle.outfile);
  const before = snapshot(m.abs);
  for (const opts of [undefined, {}, { write: false }]) {
    assert.ok((await buildMember(m, opts)).bytes.length > 0);
    assert.equal(existsSync(out), false, `no artifact for ${JSON.stringify(opts)}`);
  }
  assert.deepEqual(snapshot(m.abs), before, "nothing in the member was created or changed");
  const b = await buildMember(m, { write: true });
  assert.ok(same(readFileSync(out), b.bytes), "write:true writes exactly the built bytes");
  assert.equal(b.sha256, hex(b.bytes));
  assert.equal(existsSync(join(m.abs, m.bundle.manifest)), false, "buildMember writes no manifest");
});

/* ------------------------------------------------------------------------- R4 */

test("R4: the manifest records the artifact's SHA-256, every first-party input's, every vendored input's, the lockfile's, and the pinned working directory", async () => {
  const man = manifestFrom(probe, built);
  assert.deepEqual([man.member, man.artifact, man.sha256, man.bytes], [probe.name, probe.bundle.outfile, hex(built.bytes), built.bytes.length]);
  assert.deepEqual({ ...man.recipe, esbuild: typeof man.recipe.esbuild, ascii: typeof man.recipe.ascii },
    { entry: "src/index.mjs", format: "esm", platform: "neutral", external: [...DEFAULT_EXTERNAL], absWorkingDir: "<member directory>",
      esbuild: "string", ascii: "object" });
  assert.deepEqual(man.inputs.map((i) => i.path).sort(), ["src/dep.mjs", "src/index.mjs"]);
  for (const i of [...man.inputs, ...man.vendoredInputs]) {
    const bytes = readFileSync(join(probe.abs, i.path));
    assert.deepEqual([i.sha256, i.bytes], [hex(bytes), bytes.length], i.path);
  }
  assert.deepEqual(man.vendoredInputs.map((i) => i.path), ["node_modules/fakedep/index.mjs"]);
  assert.deepEqual(man.lock, { path: "package-lock.json", sha256: hex(readFileSync(join(probe.abs, "package-lock.json"))) });
  assert.ok(!JSON.stringify(man).includes(s.root), "no absolute path in the manifest");
  const noLock = makeMember(s.root, "nolock", { lock: false, vendored: false });
  assert.equal(manifestFrom(noLock, await buildMember(noLock)).lock, null, "no lockfile is recorded as none");
});

/* ------------------------------------------------------------------------- R5 */

test("R5: writeMember builds with writing on and writes the artifact and its manifest, which verify", async () => {
  const m = makeMember(s.root, "r5");
  const { built: b, manifest } = await writeMember(m);
  const art = readFileSync(join(m.abs, m.bundle.outfile));
  assert.ok(same(art, b.bytes));
  assert.ok(same(art, (await buildMember(m)).bytes), "the written artifact is what the recipe builds");
  const onDisk = JSON.parse(readFileSync(join(m.abs, m.bundle.manifest), "utf8"));
  assert.deepEqual(onDisk, manifest);
  assert.deepEqual(onDisk, manifestFrom(m, b));
  assert.equal(onDisk.sha256, hex(art));
  assert.deepEqual(verifyStatic(m).findings, [], "what it writes verifies statically");
  const fresh = await verifyFresh(m, art);
  assert.deepEqual([fresh.checked, fresh.findings], [true, []], "and freshly");
});

/* ------------------------------------------------------------------------- R8 */

test("R8: every static import or export-from specifier that is neither bundled nor an allowed external is listed once, sorted; a dynamic import() is not", () => {
  const text = [
    'import { a } from "zeta";',
    'import b from "./local.mjs";',
    'import "bare-side-effect";',
    'export * from "re-exported";',
    'export { c } from "named-reexport";',
    "import {\n  d,\n} from \"multi-line\";",
    'import{e}from"minified";import{f}from"node:fs";',
    'function g(){return 1}import{h}from"after-a-brace";export{g}',
    'import { env } from "cloudflare:workers";',
    "import { i } from 'single-quoted';",
    'import { a2 } from "zeta";',
    'const later = () => import("dynamic-only");',
    'const s = "import x from \\"in-a-string\\"";',
  ].join("\n");
  assert.deepEqual(unresolvableSpecifiers(text),
    ["./local.mjs", "after-a-brace", "bare-side-effect", "minified", "multi-line", "named-reexport", "re-exported", "single-quoted", "zeta"]);
  assert.deepEqual(unresolvableSpecifiers(text, ["zeta", "minified", "multi-line", "./local.mjs", "bare-side-effect", "re-exported",
    "named-reexport", "single-quoted", "after-*"]), ["cloudflare:workers", "node:fs"], "the allowed list replaces the default; a trailing * is a prefix");
  assert.deepEqual(unresolvableSpecifiers(""), []);
});

test("R8: a fully bundled artifact lists nothing; an undeclared external is listed; a dynamic import() is left to verifyFresh, which names it from the metafile", async () => {
  assert.deepEqual(unresolvableSpecifiers(built.bytes.toString("utf8")), []);
  const ext = withBundle(probe, { external: [...DEFAULT_EXTERNAL, "fakedep"] });
  const text = (await buildMember(ext)).bytes.toString("utf8");
  assert.deepEqual(unresolvableSpecifiers(text), ["fakedep"]);
  assert.deepEqual(unresolvableSpecifiers(text, ext.bundle.external), []);

  const dyn = makeMember(s.root, "dyn", { vendored: false,
    src: 'export default { async fetch() { const m = await import("https://example.test/x.mjs"); return new Response(String(m)); } };\n' });
  await writeMember(dyn);
  const committed = readFileSync(join(dyn.abs, dyn.bundle.outfile));
  assert.deepEqual(unresolvableSpecifiers(committed.toString("utf8")), [], "the scan does not list a dynamic import");
  const r = await verifyFresh(dyn, committed);
  assert.equal(r.checked, true);
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0], /^dyn: the built module still imports https:\/\/example\.test\/x\.mjs \(dynamic-import\)/);
  assert.ok(verifyStatic(dyn).findings.every((f) => !/x\.mjs/.test(f)), "the static arm leaves it to the fresh build");
});
