/* release R21, R22, R46: every bundle is built afresh from the checkout by its member's own build, into its dist/, and
 * that build is what bundles.mjs checks and release-assemble.mjs carries; never a bundle that was there before. Run as
 * an operator runs the commands, against a throwaway fixture repository (`repo.mjs`); nothing reaches an account. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { planeMember, discoverMembers, verifyStatic } from "../../../scripts/fleet-bundle.mjs";
import { makeRepo, addMember, run, snapshot, readJson, writeJson, rm, hex } from "./repo.mjs";

const refused = (r, code) => {
  assert.notEqual(r.status, 0, `${code}: exits non-zero\n${r.stdout}\n${r.stderr}`);
  assert.ok(r.stderr.includes(`REFUSED [${code}]`), `${code} on stderr:\n${r.stderr}\n${r.stdout}`);
};
/** @type {(m: import("../../../scripts/fleet-bundle.mjs").Member) => import("../../../scripts/fleet-bundle.mjs").BundleBlock} */
const bundleOf = (m) => { if (!m.bundle) throw new Error(`${m.name} declares its bundle`); return m.bundle; };
const bundles = (root, args = []) => run(root, ".", ["bio-plane/scripts/bundles.mjs", ...args]);
const assemble = (root, args = [], env = {}) => run(root, ".", ["bio-plane/scripts/release-assemble.mjs", ...args], { env });

/** R46: a member's own build, followed by `then` (a script run in the member's directory after the build). */
function buildThen(root, name, then) {
  writeFileSync(join(root, name, "then.mjs"), then);
  const p = join(root, name, "package.json");
  writeJson(p, { ...readJson(p), scripts: { build: "node build.mjs && node then.mjs" } });
}
/** The repository's state outside every `dist/`: what a command that only builds bundles must leave as it was. */
const outsideDist = (snap) => Object.fromEntries(Object.entries(snap).filter(([k]) => !k.split("/").includes("dist")));
/** The bytes a build of `m` from the checkout gives, in memory (the recipe each member's build runs). */
const inMemory = async (root, m) => {
  const lib = await import(pathToFileURL(join(root, "bio-plane/scripts/fleet-bundle.mjs")).href);
  return (await lib.buildMember(m)).bytes;
};

test("R21, R46: bundles.mjs builds every guarded bundle afresh into its dist/ by the member's own npm run build, checks each, and never reads what was there before", async () => {
  const root = await makeRepo({ build: false });
  try {
    /* a bundle left in dist/ from before, which no step may take for the build's output */
    mkdirSync(join(root, "alpha-worker/dist"), { recursive: true });
    writeFileSync(join(root, "alpha-worker/dist/alpha-worker.bundled.mjs"), "export default 'an earlier build';\n");
    const before = outsideDist(snapshot(root));
    const r = bundles(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /3 guarded bundle\(s\) — alpha-worker, beta-worker, bio-plane/);
    for (const m of [...discoverMembers(root), planeMember(root)]) {
      assert.match(r.stdout, new RegExp(`building ${m.name} \\(npm run build in ${m.dir}/\\)`));
      const bytes = readFileSync(join(m.abs, bundleOf(m).outfile));
      assert.match(r.stdout, new RegExp(`${m.name} — BUILT ${bundleOf(m).outfile} ${bytes.length} B, sha256 ${hex(bytes)}; a second build gives the same bytes`));
      assert.ok(bytes.equals(await inMemory(root, m)), `${m.name}: what its build wrote is what the checkout builds to`);
      assert.equal(readJson(join(m.abs, bundleOf(m).manifest)).sha256, hex(bytes), `${m.name}: its manifest is this build's`);
      assert.deepEqual(verifyStatic(m).findings, [], m.name);
    }
    assert.match(r.stdout, /bundles: 3 of 3 built and checked$/m);
    assert.deepEqual(outsideDist(snapshot(root)), before, "it writes nothing outside the members' dist/");
    /* a source change is in the next build, with nothing to mark stale */
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), 'export const word = "changed";\n');
    assert.equal(bundles(root).status, 0);
    assert.match(readFileSync(join(root, "alpha-worker/dist/alpha-worker.bundled.mjs"), "utf8"), /changed/);
  } finally { rm(root); }
});

test("R21, R46: a build that writes no artifact, no manifest, fails, or does not give the same bytes twice is named and exits 1; the others are still built", async () => {
  const root = await makeRepo({ build: false, members: { "alpha-worker": {}, "beta-worker": {}, "gamma-worker": {}, "delta-worker": {} } });
  try {
    const pa = join(root, "alpha-worker/package.json");
    writeJson(pa, { ...readJson(pa), scripts: { build: "node -e 0" } });
    buildThen(root, "beta-worker", 'import { rmSync } from "node:fs";\nrmSync("dist/beta-worker.bundle.json");\n');
    const pp = join(root, "bio-plane/package.json");
    writeJson(pp, { ...readJson(pp), scripts: { build: "exit 3" } });
    /* gamma's build writes bytes the recipe does not give, with a manifest that agrees with them */
    buildThen(root, "gamma-worker", [
      'import { readFileSync, writeFileSync, appendFileSync } from "node:fs";',
      'import { createHash } from "node:crypto";',
      'appendFileSync("dist/gamma-worker.bundled.mjs", "\\n;0;\\n");',
      'const b = readFileSync("dist/gamma-worker.bundled.mjs"), m = JSON.parse(readFileSync("dist/gamma-worker.bundle.json", "utf8"));',
      'writeFileSync("dist/gamma-worker.bundle.json", JSON.stringify({ ...m, sha256: createHash("sha256").update(b).digest("hex"), bytes: b.length }));', ""].join("\n"));
    const r = bundles(root);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /alpha-worker: its build exited 0 and wrote no dist\/alpha-worker\.bundled\.mjs/);
    assert.match(r.stdout, /beta-worker: its build exited 0 and wrote no dist\/beta-worker\.bundle\.json/);
    assert.match(r.stdout, /bio-plane: its build \(npm run build in bio-plane\/\) exited 3/);
    assert.match(r.stdout, /! gamma-worker: /, "the second build's difference is named");
    assert.match(r.stdout, /delta-worker — BUILT dist\/delta-worker\.bundled\.mjs/, "a member that builds is built");
    assert.match(r.stdout, /bundles: 1 of 5 built and checked; 4 NOT \(alpha-worker: .*; beta-worker: .*; bio-plane: .*; gamma-worker: .*\)/);
  } finally { rm(root); }
});

test("R21, R46: --check builds every bundle in memory, writes nothing, and exits 0 when each builds and 1 naming one that does not", async () => {
  const root = await makeRepo({ build: false });
  try {
    const before = snapshot(root);
    const ok = bundles(root, ["--check"]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    for (const m of [...discoverMembers(root), planeMember(root)]) {
      const b = await inMemory(root, m);
      assert.match(ok.stdout, new RegExp(`${m.name} — builds ${b.length} B, sha256 ${hex(b)} \\(in memory; nothing written\\)`));
    }
    assert.match(ok.stdout, /bundles: 3 of 3 built in memory and checked$/m);
    assert.deepEqual(snapshot(root), before, "--check writes nothing, no dist/ among it");
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), 'export { word } from "./missing.mjs";\n');
    const bad = bundles(root, ["--check"]);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /1 NOT \(alpha-worker: it does not build: /);
    const lib = await import(pathToFileURL(join(root, "bio-plane/scripts/bundles.mjs")).href);
    assert.equal(await lib.run({ repoRoot: root, check: true, log: () => {} }), 1, "run({check}) is the same check");
    assert.deepEqual(outsideDist(snapshot(root)), outsideDist({ ...before, "alpha-worker/src/word.mjs": snapshot(root)["alpha-worker/src/word.mjs"] }));
  } finally { rm(root); }
});

test("R22, R46: a release is assembled from bundles each built afresh by its own build, never one that was in dist/ before; two assemblies of one checkout carry the same payload, and --dry-run writes nothing outside dist/", async () => {
  const root = await makeRepo({ build: false });
  try {
    mkdirSync(join(root, "alpha-worker/dist"), { recursive: true });
    writeFileSync(join(root, "alpha-worker/dist/alpha-worker.bundled.mjs"), "export default 'an earlier build';\n");
    const before = outsideDist(snapshot(root));
    const out = join(mkdtempSync(join(tmpdir(), "release-emit-")), "payload.txt");
    const r = assemble(root, ["--dry-run", "--emit-payload", out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const m of [...discoverMembers(root), planeMember(root)]) {
      const bytes = readFileSync(join(m.abs, bundleOf(m).outfile));
      assert.ok(bytes.equals(await inMemory(root, m)), `${m.name}: built afresh into its dist/`);
      assert.ok(readFileSync(out, "utf8").includes(hex(bytes)), `${m.name}: the payload carries this build`);
    }
    assert.match(r.stdout, /--dry-run: nothing written to release\/ \(each bundle was built into its own dist\/, R46\)\. A release cut now would carry 3 assets/);
    assert.deepEqual(outsideDist(snapshot(root)), before, "nothing in the repository written outside the members' dist/");
    const again = join(mkdtempSync(join(tmpdir(), "release-emit-")), "payload.txt");
    assert.equal(assemble(root, ["--dry-run", "--emit-payload", again]).status, 0);
    assert.equal(readFileSync(again, "utf8"), readFileSync(out, "utf8"), "the same checkout, the same release");
  } finally { rm(root); }
});

test("R22, R46: refuses a build that fails, writes no artifact or manifest, cannot be checked by a second build, does not give the same bytes twice or disagrees with its manifest, writing nothing to the release", async () => {
  const root = await makeRepo({ members: { "alpha-worker": {}, "beta-worker": { assets: { "assets/model.bin": "MODEL-1" } }, "gamma-worker": { vendored: true } } });
  const pkg = (r, name, build) => { const p = join(r, name, "package.json"); writeJson(p, { ...readJson(p), scripts: { build } }); };
  const cases = [
    ["BUILD_FAILED", (r) => rmSync(join(r, "gamma-worker/node_modules"), { recursive: true })],
    ["BUILD_FAILED", (r) => writeFileSync(join(r, "alpha-worker/src/word.mjs"), 'export { word } from "./missing.mjs";\n')],
    ["NO_ARTIFACT", (r) => pkg(r, "alpha-worker", "node -e 0")],
    ["NO_MANIFEST", (r) => buildThen(r, "alpha-worker", 'import { rmSync } from "node:fs";\nrmSync("dist/alpha-worker.bundle.json");\n')],
    /* the vendored input is gone once the build has run: the second build, which checks it, cannot run */
    ["GUARD_CANNOT_RUN", (r) => buildThen(r, "gamma-worker", 'import { rmSync } from "node:fs";\nrmSync("node_modules", { recursive: true });\n')],
    /* the build writes bytes the checkout does not build to, with a manifest that agrees: two builds differ */
    ["STALE_OR_UNINSTALLABLE", (r) => buildThen(r, "alpha-worker", [
      'import { readFileSync, writeFileSync, appendFileSync } from "node:fs";',
      'import { createHash } from "node:crypto";',
      'appendFileSync("dist/alpha-worker.bundled.mjs", "\\n;0;\\n");',
      'const b = readFileSync("dist/alpha-worker.bundled.mjs"), m = JSON.parse(readFileSync("dist/alpha-worker.bundle.json", "utf8"));',
      'writeFileSync("dist/alpha-worker.bundle.json", JSON.stringify({ ...m, sha256: createHash("sha256").update(b).digest("hex"), bytes: b.length }));', ""].join("\n"))],
    ["MANIFEST_DISAGREES", (r) => buildThen(r, "alpha-worker", [
      'import { readFileSync, writeFileSync } from "node:fs";',
      'const m = JSON.parse(readFileSync("dist/alpha-worker.bundle.json", "utf8"));',
      'writeFileSync("dist/alpha-worker.bundle.json", JSON.stringify({ ...m, sha256: "0".repeat(64) }));', ""].join("\n"))],
  ];
  try {
    const pristine = snapshot(root);
    for (const [code, arrange] of cases) {
      const save = new Map(Object.keys(pristine).map((k) => [k, readFileSync(join(root, k))]));
      arrange(root);
      const before = outsideDist(snapshot(root));
      const r = assemble(root, ["--dry-run"]);
      refused(r, code);
      assert.deepEqual(outsideDist(snapshot(root)), before, `${code}: nothing written outside dist/`);
      for (const k of Object.keys(snapshot(root))) if (!save.has(k)) rmSync(join(root, k));
      for (const [k, b] of save) writeFileSync(join(root, k), b);
      if (!existsSync(join(root, "gamma-worker/node_modules"))) addMember(root, "gamma-worker", { vendored: true });
    }
    assert.equal(assemble(root, ["--dry-run"]).status, 0, "restored, it assembles");
  } finally { rm(root); }
});

