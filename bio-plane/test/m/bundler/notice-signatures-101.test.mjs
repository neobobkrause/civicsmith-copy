/* Provider notice signatures:101 (signatures R57, R58, PR 101): CATALOGUE_KEYS now holds Bob's two catalogue keys, and no
 * test key. Confirmed, no code change here: this module reads no catalogue key (its release signs and verifies against the
 * release `signer` only, signatures R33, R35), and the plane bundle carries the list as signatures writes it, a bundle built
 * before the change being refused stale by R7's check (the gather, R44), never shipped. R57's page is signatures', not a
 * fleet member's part. Driven over this tree's bundler scripts and a fixture plane that bundles the real sshsig.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CATALOGUE_KEYS, RELEASE_KEYS } from "../../../src/sshsig.mjs";
import { makeRepo, run, rm, buildAll, PLANE } from "./repo.mjs";

const blob = (line) => line.trim().split(/\s+/)[1];

/* bundler's own scripts (its paths in this START's list under bio-plane/scripts/) */
const OWN = ["fleet-bundle.mjs", "provenance.mjs", "build-plane.mjs", "deploy.mjs", "derive-bindings.mjs", "resolve-version.mjs", "jsonc.mjs",
  "release-assemble.mjs", "deploy-fleet.mjs", "bundles.mjs", "release-advisories.mjs", "third-party.json", "p3dev.mjs", "p3dev-walk-setup.mjs", "release-gather.mjs"];

test("notice signatures:101: no bundler script reads CATALOGUE_KEYS or holds a catalogue key, and no catalogue key is a release key", () => {
  assert.ok(CATALOGUE_KEYS.length >= 2, "Bob's catalogue key and its recovery key, and any development key signatures adds");
  for (const f of OWN) {
    const text = readFileSync(join(PLANE, "scripts", f), "utf8");
    assert.ok(!text.includes("CATALOGUE_KEYS"), `${f} reads CATALOGUE_KEYS`);
    assert.ok(!/catalogue-keys\.html/.test(text), `${f} ships signatures' offline page (R57)`);
    for (const line of CATALOGUE_KEYS) assert.ok(!text.includes(blob(line)), `${f} holds a catalogue key`);
  }
  const release = new Set(RELEASE_KEYS.map(blob));
  for (const line of CATALOGUE_KEYS) assert.ok(!release.has(blob(line)), "a catalogue key never signs a release");
});

test("notice signatures:101: a plane bundle carries CATALOGUE_KEYS as sshsig.mjs writes it, and one built before a key change is refused stale by the gather", async () => {
  const root = await makeRepo({ build: false });
  const out = join(mkdtempSync(join(tmpdir(), "notice101-")), "out");
  try {
    writeFileSync(join(root, "bio-plane/src/plane/index.mjs"),
      `import { CATALOGUE_KEYS } from "../sshsig.mjs";\nexport class Store {}\nexport default { fetch() { return new Response(CATALOGUE_KEYS.join("\\n")); } };\n`);
    await buildAll(root);
    const bundle = readFileSync(join(root, "bio-plane/dist/bio-plane.bundled.mjs"), "utf8");
    for (const line of CATALOGUE_KEYS) assert.ok(bundle.includes(blob(line)), `the bundle carries ${line.split(" ").at(-1)}`);
    assert.equal(run(root, ".", ["bio-plane/scripts/release-gather.mjs", join(out, "..", "ok")]).status, 0, "control: fresh, it gathers");
    /* a key line changes after the build, as PR 101 changed it */
    const p = join(root, "bio-plane/src/sshsig.mjs");
    writeFileSync(p, readFileSync(p, "utf8").replace(blob(CATALOGUE_KEYS[1]), "AAAAC3NzaC1lZDI1NTE5AAAAIJV3JkW3PRnHj5TY4aWn399MUyQ1z4JKUtfWZKbt3qJI"));
    const stale = run(root, ".", ["bio-plane/scripts/release-gather.mjs", out]);
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stderr, /REFUSED \[STALE_ARTIFACT\][\s\S]*bio-plane: STALE BUNDLE — the source src\/sshsig\.mjs/);
    assert.throws(() => readdirSync(out), "nothing written");
  } finally { rm(root); rmSync(join(out, ".."), { recursive: true, force: true }); }
});
