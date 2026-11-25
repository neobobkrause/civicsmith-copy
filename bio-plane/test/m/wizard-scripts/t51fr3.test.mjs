/* wizard-scripts R49 (T51 fix round 3; C64; DEC-401, DEC-402; K4356; amends R47, R48): the registry re-taken at `43379a1a44`, where
   `request` gains the act `entitycreate` ("Use this office"), so a member can name a federal office from the records request.
   Every test drives the module at its interface, over the carried data and the vendored design file it is held equal to; the
   generator is run as a command, as R44 to R48's tests do. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { GENERATED, SOURCES } from "../../../src/wizard-scripts/build-data.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_DIR = join(HERE, "source");
const GEN_DIR = fileURLToPath(new URL("../../../src/wizard-scripts/", import.meta.url));
const BUILD = fileURLToPath(new URL("../../../src/wizard-scripts/build-data.mjs", import.meta.url));
const sha = (f) => createHash("sha256").update(readFileSync(join(SOURCE_DIR, f), "utf8"), "utf8").digest("hex");
const at = (f) => JSON.parse(readFileSync(join(SOURCE_DIR, f), "utf8"));
const run = (...args) => spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8" });

const file = at("registry.json");
const acts = file.screens.flatMap((s) => s.acts);
const count = (status) => acts.filter((a) => a.status === status).length;

test("R49 (T51 fix round 3; C64; DEC-401, DEC-402; K4356; amends R47, R48) the registry is re-taken at 43379a1a44: SCREEN_REGISTRY_SOURCE names that commit and the file's sha256, with 83 screens and 564 acts (435 declared, 83 function, 46 owed; 42 owed ops); request registers entitycreate; build-data.mjs --check passes on the committed files", () => {
  assert.deepEqual(wz.SCREEN_REGISTRY_SOURCE, { commit: "b1adf4236d", path: "docs/development/ux-substrate/screens/registry.json", sha256: sha("registry.json") });
  assert.equal(SOURCES.registry.commit, "b1adf4236d");
  assert.deepEqual([wz.SCREEN_REGISTRY.length, acts.length, count("declared"), count("function"), count("owed")], [91, 656, 452, 83, 121]);
  assert.equal(new Set(acts.filter((a) => a.status === "owed").map((a) => a.op)).size, 105, "the owed ops at b1adf4236d (42 at 43379a1a44)");
  const request = wz.SCREEN_REGISTRY.find((s) => s.id === "request");
  assert.ok(request.acts.includes("entitycreate"), "DEC-402: a member names a federal office from the records request");
  assert.equal(run("--check").status, 0, "the carried generated files are what their sources give");
});

test("R49 control: the earlier registry, kept whole beside the carried one at 654a735535, lacks entitycreate on request; every act request had is still registered; a one-byte change to the generated registry fails --check", () => {
  const earlier = at("registry-654a735535.json");
  assert.equal(earlier.screens.length, 83, "the kept file at 654a735535");
  const before = earlier.screens.find((s) => s.id === "request").acts.map((a) => a.op);
  assert.ok(!before.includes("entitycreate") || earlier.screens.find((s) => s.id === "request").acts.find((a) => a.op === "entitycreate").status === "owed",
    "control: the earlier file did not draw the act on request");
  const now = wz.SCREEN_REGISTRY.find((s) => s.id === "request").acts;
  for (const op of before) assert.ok(now.includes(op), `${op}: still on request`);

  const dir = mkdtempSync(join(tmpdir(), "wz-r49-"));
  try {
    for (const f of GENERATED) copyFileSync(join(GEN_DIR, f), join(dir, f));
    assert.equal(run("--check", "--out", dir).status, 0, "the copies of the carried files pass");
    const path = join(dir, "screen-registry.mjs");
    writeFileSync(path, readFileSync(path, "utf8").replace("b1adf4236d", "43379a1a45"));
    const r = run("--check", "--out", dir);
    assert.equal(r.status, 1, "a one-byte change to the generated registry fails --check");
    assert.match(r.stderr, /screen-registry\.mjs is stale/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
