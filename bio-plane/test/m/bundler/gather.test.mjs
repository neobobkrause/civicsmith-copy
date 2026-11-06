/* bundler R44: `release-gather.mjs <out-dir>` gathers every guarded bundle's built output into one directory, refusing
 * a missing or stale artifact and two files with one name, writing nothing when it refuses. Driven at its command line
 * in a fixture repository (repo.mjs), with the plane and two members, one declaring an upload part. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeRepo, run, rm, buildAll } from "./repo.mjs";

const gather = (root, args) => run(root, ".", ["bio-plane/scripts/release-gather.mjs", ...args]);
const outDir = () => join(mkdtempSync(join(tmpdir(), "gather-out-")), "out");

test("R44: every guarded bundle's artifact, manifest and upload parts are gathered, byte for byte, under their own names", async () => {
  const root = await makeRepo();
  const out = outDir();
  try {
    const r = gather(root, [out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const want = {
      "bio-plane.bundled.mjs": "bio-plane/dist/bio-plane.bundled.mjs", "bio-plane.bundle.json": "bio-plane/dist/bio-plane.bundle.json",
      "alpha-worker.bundled.mjs": "alpha-worker/dist/alpha-worker.bundled.mjs", "alpha-worker.bundle.json": "alpha-worker/dist/alpha-worker.bundle.json",
      "beta-worker.bundled.mjs": "beta-worker/dist/beta-worker.bundled.mjs", "beta-worker.bundle.json": "beta-worker/dist/beta-worker.bundle.json",
      "model.bin": "beta-worker/assets/model.bin",
    };
    assert.deepEqual(readdirSync(out).sort(), Object.keys(want).sort());
    for (const [name, src] of Object.entries(want)) assert.deepEqual(readFileSync(join(out, name)), readFileSync(join(root, src)), name);
    assert.match(r.stdout, /7 file\(s\) of 3 guarded bundle\(s\) \(alpha-worker, beta-worker, bio-plane\)/);
  } finally { rm(root); rmSync(join(out, ".."), { recursive: true, force: true }); }
});

test("R44: a stale or missing artifact, a name clash and an occupied directory are each refused by code, writing nothing", async () => {
  const root = await makeRepo();
  const out = outDir();
  try {
    /* stale: a source moved after the build */
    writeFileSync(join(root, "alpha-worker/src/word.mjs"), 'export const word = "moved";\n');
    const stale = gather(root, [out]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /REFUSED \[STALE_ARTIFACT\]/);
    assert.match(stale.stderr, /alpha-worker: STALE BUNDLE — the source src\/word\.mjs/);
    assert.equal(existsSync(out), false, "nothing written");
    await buildAll(root);
    assert.equal(gather(root, [join(out, "..", "probe")]).status, 0, "control: rebuilt, it gathers");
    rmSync(join(out, "..", "probe"), { recursive: true, force: true });

    /* missing: the plane's artifact gone */
    const art = join(root, "bio-plane/dist/bio-plane.bundled.mjs"), bytes = readFileSync(art);
    rmSync(art);
    const missing = gather(root, [out]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /REFUSED \[NO_ARTIFACT\][\s\S]*bio-plane: bio-plane\/dist\/bio-plane\.bundled\.mjs is missing/);
    assert.equal(existsSync(out), false);
    writeFileSync(art, bytes);

    /* occupied */
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "left.txt"), "x");
    const busy = gather(root, [out]);
    assert.equal(busy.status, 1);
    assert.match(busy.stderr, /REFUSED \[OUT_NOT_EMPTY\]/);
    assert.deepEqual(readdirSync(out), ["left.txt"]);
    rmSync(out, { recursive: true, force: true });

    const usage = gather(root, []);
    assert.equal(usage.status, 2);
    assert.match(usage.stderr, /usage: node bio-plane\/scripts\/release-gather\.mjs <out-dir>/);
  } finally { rm(root); rmSync(join(out, ".."), { recursive: true, force: true }); }
});

test("R44: two members whose files share a name are refused [NAME_CLASH], naming the name and both sources", async () => {
  const root = await makeRepo({ members: { "alpha-worker": { assets: { "assets/model.bin": "A" } }, "beta-worker": { assets: { "assets/model.bin": "B" } } } });
  const out = outDir();
  try {
    const r = gather(root, [out]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /REFUSED \[NAME_CLASH\][\s\S]*model\.bin: both alpha-worker\/assets\/model\.bin and beta-worker\/assets\/model\.bin/);
    assert.equal(existsSync(out), false, "nothing written");
  } finally { rm(root); rmSync(join(out, ".."), { recursive: true, force: true }); }
});

/* The dist pass (BOB, 6 Nov 2026): the installer's bundle is not committed, so the development release carries it. */
test("R44: where the repository has the installer, its built bundle is gathered beside the fleet's, and its absence is refused NO_ARTIFACT", async () => {
  const root = await makeRepo();
  const out = outDir();
  try {
    mkdirSync(join(root, "newgroup/dist"), { recursive: true });
    writeFileSync(join(root, "newgroup/package.json"), JSON.stringify({ name: "bio-newgroup-wizard", private: true }));
    const missing = gather(root, [out]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /REFUSED \[NO_ARTIFACT\][\s\S]*newgroup: newgroup\/dist\/newgroup\.bundled\.mjs is missing/);
    assert.equal(existsSync(out), false, "nothing written");
    writeFileSync(join(root, "newgroup/dist/newgroup.bundled.mjs"), "export default {};\n");
    const r = gather(root, [out]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(readFileSync(join(out, "newgroup.bundled.mjs")), readFileSync(join(root, "newgroup/dist/newgroup.bundled.mjs")));
    assert.equal(readdirSync(out).length, 8);
    assert.match(r.stdout, /8 file\(s\) of 3 guarded bundle\(s\) \(alpha-worker, beta-worker, bio-plane\) and the installer's bundle/);
  } finally { rm(root); rmSync(join(out, ".."), { recursive: true, force: true }); }
});
