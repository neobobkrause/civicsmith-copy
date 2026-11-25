/* wizard-library's own tests of the carried screen registry, at the module's interface: the re-take of the design
 * file (R41, R50, R53, as the job that re-took it at `e5feed33be` placed it, PR 1355), the generated file equal to its
 * source, and `build-data.mjs --check` naming a stale file. Requirements: `process/modules/wizard-library.md`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCREEN_REGISTRY, SCREEN_REGISTRY_SOURCE } from "../../../../src/wizard-scripts/screen-registry.mjs";
import { SOURCES, GENERATED, generate, firstDifference } from "../../../../src/wizard-scripts/build-data.mjs";
import { screensFromFile } from "../../../../src/wizard-scripts/data.mjs";

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const GEN_DIR = join(SOURCE_DIR, "../../../../src/wizard-scripts");
const BUILD = join(GEN_DIR, "build-data.mjs");
const DESIGN = join(SOURCE_DIR, "../../../../../docs/development/ux-substrate/screens/registry.json");
const bytes = (name) => readFileSync(join(SOURCE_DIR, name));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const acts = (screens) => new Set(screens.flatMap((s) => [...s.acts.map((a) => `${s.id} ${a}`), ...s.owed.map((o) => `${s.id} owed:${o.op}`)]));

test("R50, R53: the vendored registry.json equals the design's docs/development/ux-substrate/screens/registry.json on the tranche byte for byte, so a design merge that moves the registry fails until it is re-taken", () => {
  assert.ok(bytes("registry.json").equals(readFileSync(DESIGN)), "re-take the registry: the design file has moved");
});

test("R41, R53: SCREEN_REGISTRY_SOURCE names the design commit the registry is re-taken at (e5feed33be), its path and the SHA-256 of the vendored file, and build-data.mjs's SOURCES names the same commit", () => {
  assert.equal(SOURCES.registry.commit, "e5feed33be");
  assert.deepEqual(SCREEN_REGISTRY_SOURCE, { commit: "e5feed33be", path: "docs/development/ux-substrate/screens/registry.json", sha256: sha(bytes("registry.json")) });
});

test("R41: SCREEN_REGISTRY is the vendored file read as screensFromFile reads it: 91 screens, 541 declared or function acts registered and 121 owed acts carried apart", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(SCREEN_REGISTRY)), screensFromFile(JSON.parse(bytes("registry.json").toString("utf8"))));
  assert.equal(SCREEN_REGISTRY.length, 91);
  assert.equal(SCREEN_REGISTRY.reduce((n, s) => n + s.acts.length, 0), 541);
  assert.equal(SCREEN_REGISTRY.reduce((n, s) => n + s.owed.length, 0), 121);
  assert.equal(new Set(SCREEN_REGISTRY.map((s) => s.id)).size, SCREEN_REGISTRY.length, "each screen once");
});

test("R53: at e5feed33be document registers resolve beside resolvetestify, and setup factconfirm, queue signerknown, question leggrade and counsel counselpacketread and counselpacketexport; every act of b1adf4236d, kept whole beside the carried file, is still registered (control: none is lost)", () => {
  const screen = (id) => SCREEN_REGISTRY.find((s) => s.id === id);
  assert.ok(screen("document").acts.includes("resolve"));
  assert.ok(screen("document").acts.includes("resolvetestify"));
  for (const [id, act] of [["setup", "factconfirm"], ["queue", "signerknown"], ["question", "leggrade"], ["counsel", "counselpacketread"], ["counsel", "counselpacketexport"]])
    assert.ok(screen(id).acts.includes(act), `${id} lists ${act}`);
  const before = acts(screensFromFile(JSON.parse(bytes("registry-b1adf4236d.json").toString("utf8"))));
  const now = acts(SCREEN_REGISTRY);
  assert.deepEqual([...before].filter((a) => !now.has(a)), []);
  assert.deepEqual([...now].filter((a) => !before.has(a)).sort(),
    ["counsel counselpacketexport", "counsel counselpacketread", "document resolve", "question leggrade", "queue signerknown", "setup factconfirm"]);
});

test("R41: the three carried files are what their sources generate, and build-data.mjs --check passes on them", () => {
  const made = generate(SOURCE_DIR);
  for (const name of GENERATED) assert.equal(firstDifference(readFileSync(join(GEN_DIR, name), "utf8"), made.files[name]), null, name);
  const run = spawnSync(process.execPath, [BUILD, "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
});

test("R41: build-data.mjs --check exits 1 and names the stale file after a one-byte change to the generated registry (control), and a missing source is refused by name", () => {
  const out = mkdtempSync(join(tmpdir(), "wizard-library-"));
  try {
    for (const name of GENERATED) copyFileSync(join(GEN_DIR, name), join(out, name));
    const text = readFileSync(join(out, "screen-registry.mjs"), "utf8");
    writeFileSync(join(out, "screen-registry.mjs"), text.replace("e5feed33be", "e5feed33bf"));
    const run = spawnSync(process.execPath, [BUILD, "--check", "--out", out], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /screen-registry\.mjs is stale: line \d+/);
    const none = spawnSync(process.execPath, [BUILD, "--check", "--from", out, "--out", out], { encoding: "utf8" });
    assert.equal(none.status, 1);
    assert.match(none.stderr, /registry\.json/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test("R41: firstDifference answers null for equal texts and the first differing line, by number, otherwise (bounds: a missing last line)", () => {
  assert.equal(firstDifference("a\nb", "a\nb"), null);
  assert.match(firstDifference("a\nb", "a\nc"), /^line 2: /);
  assert.match(firstDifference("a", "a\nb"), /^line 2: have null/);
});
