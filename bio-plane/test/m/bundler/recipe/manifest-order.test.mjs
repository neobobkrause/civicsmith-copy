/* bundler R2, R4: the recipe gives the same bytes from any checkout, and the manifest records the inputs it was built
 * from. Both are proven here on a fixture member built in a temporary directory — the recipe's own promise, with no
 * fleet member involved: `buildMember` never writes unless told to (R3, R10), so these arms write nothing but the
 * fixture they make.
 *
 * Found by bundler #4 (PR 1422) and fixed by bundler #5: the input list was sorted with `localeCompare`, which asks the
 * machine's collation. The fixture's two parts are named so that the answer differs: a full-ICU Node orders
 * `src/part~two.mjs` before `src/parta.mjs`, code points order them the other way (measured 25 Nov 2026, Node 26.10.0),
 * so the order recorded in the manifest — and so the manifest's bytes — moved with the locale the build ran under. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMember, manifestFrom, sha256 } from "../../../../scripts/fleet-bundle.mjs";

/* A member of three inputs: the entry and two parts whose names collate differently from their code points. */
const PARTS = ["parta.mjs", "part~two.mjs"];
const INPUTS = ["src/entry.mjs", "src/parta.mjs", "src/part~two.mjs"];

function fixture() {
  const abs = mkdtempSync(join(tmpdir(), "bundler-recipe-"));
  mkdirSync(join(abs, "src"), { recursive: true });
  writeFileSync(join(abs, "src/entry.mjs"),
    `import { a } from "./${PARTS[0]}";\nimport { b } from "./${PARTS[1]}";\nexport default { a, b };\n`);
  writeFileSync(join(abs, "src", PARTS[0]), "export const a = 1;\n");
  writeFileSync(join(abs, "src", PARTS[1]), "export const b = 2;\n");
  return {
    dir: "recipe-probe", name: "recipe-probe", abs, entry: "src/entry.mjs",
    bundle: { entry: "src/entry.mjs", outfile: "dist/probe.bundled.mjs", manifest: "dist/probe.bundle.json" },
  };
}

test("R4: the recorded inputs are in code-point order, which no machine's collation can move", async () => {
  const member = fixture();
  try {
    const built = await buildMember(member);
    const paths = built.inputs.map((i) => i.path);
    assert.deepEqual(paths, INPUTS, "the three inputs, in code-point order");
    assert.deepEqual(paths, [...paths].sort(), "the order is the one a plain sort gives: by code points");
    /* The control: the order a collation gives is a DIFFERENT order on this machine, so an order read from the
       machine's locale would have failed this arm. */
    assert.notDeepEqual([...paths].sort((x, y) => x.localeCompare(y)), paths,
      "the fixture's names are ones this machine's collation orders differently — if this arm fails, the fixture no "
      + "longer tests what it was written for");
    assert.deepEqual(manifestFrom(member, built).inputs.map((i) => i.path), INPUTS,
      "the manifest records them in that same order");
  } finally { rmSync(member.abs, { recursive: true, force: true }); }
});

test("R4: each recorded input carries the bytes and the SHA-256 of the file as it now stands, and the lock when there is one", async () => {
  const member = fixture();
  try {
    const built = await buildMember(member);
    const manifest = manifestFrom(member, built);
    for (const inp of manifest.inputs) {
      const file = readFileSync(join(member.abs, inp.path));
      assert.equal(inp.sha256, sha256(file), `${inp.path}: the recorded hash is the file's`);
      assert.equal(inp.bytes, file.length, `${inp.path}: the recorded length is the file's`);
    }
    assert.equal(manifest.sha256, sha256(built.bytes), "the artifact's own hash is recorded");
    assert.equal(manifest.bytes, built.bytes.length);
    assert.deepEqual(manifest.vendoredInputs, [], "the fixture has no install, so no vendored input");
    assert.equal(manifest.lock, null, "a member with no package-lock.json records none");
    assert.equal(manifest.recipe.absWorkingDir, "<member directory>", "the pin is recorded, never an absolute path");
    writeFileSync(join(member.abs, "package-lock.json"), '{"lockfileVersion": 3}\n');
    assert.deepEqual(manifestFrom(member, built).lock,
      { path: "package-lock.json", sha256: sha256(readFileSync(join(member.abs, "package-lock.json"))) });
  } finally { rmSync(member.abs, { recursive: true, force: true }); }
});

test("R2: the same source gives the same bytes and the same manifest from any working directory", async () => {
  const member = fixture();
  const cwd = process.cwd();
  try {
    const first = await buildMember(member);
    const firstManifest = JSON.stringify(manifestFrom(member, first));
    process.chdir(member.abs);
    const second = await buildMember(member);
    const secondManifest = JSON.stringify(manifestFrom(member, second));
    process.chdir(tmpdir());
    const third = await buildMember(member);
    assert.equal(Buffer.compare(Buffer.from(first.bytes), Buffer.from(second.bytes)), 0,
      "the bundle built from the member's own directory is byte-identical");
    assert.equal(Buffer.compare(Buffer.from(first.bytes), Buffer.from(third.bytes)), 0,
      "and so is the one built from a third directory");
    assert.equal(secondManifest, firstManifest, "the manifest's bytes do not move with the working directory");
    assert.equal(JSON.stringify(manifestFrom(member, third)), firstManifest);
  } finally {
    process.chdir(cwd);
    rmSync(member.abs, { recursive: true, force: true });
  }
});

test("R3: a build writes nothing unless it is told to, and then writes just the artifact", async () => {
  const member = fixture();
  try {
    await buildMember(member);
    assert.throws(() => readFileSync(join(member.abs, member.bundle.outfile)), /ENOENT/,
      "the default build leaves no artifact behind");
    const built = await buildMember(member, { write: true });
    assert.equal(Buffer.compare(readFileSync(join(member.abs, member.bundle.outfile)), Buffer.from(built.bytes)), 0);
    assert.throws(() => readFileSync(join(member.abs, member.bundle.manifest)), /ENOENT/,
      "and writes no manifest: that is writeMember's (R5)");
  } finally { rmSync(member.abs, { recursive: true, force: true }); }
});
