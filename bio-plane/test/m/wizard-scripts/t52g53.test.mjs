/* wizard-scripts R50 (T51 fix round 6; G53; DEC-419; K4393, K4691; amends R49): the registry re-taken at `f72b2f8a4c`, where the
   design adds `projectjoin` to `start-send`, `request` and `action`. The shell's `checkScreens` admits a page's act only when
   the generated registry holds it, so the vendored file must stay the design's own file on the tranche. Every test drives the
   module at its interface, over the carried data and the vendored design file it is held equal to; the generator is run as a
   command, as R44 to R49's tests do. */
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
const DESIGN_REGISTRY = fileURLToPath(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url));
const read = (f) => readFileSync(join(SOURCE_DIR, f), "utf8");
const at = (f) => JSON.parse(read(f));
const run = (...args) => spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8" });

const file = at("registry.json");
const acts = file.screens.flatMap((s) => s.acts);
const count = (status) => acts.filter((a) => a.status === status).length;

test("R50 (T51 fix round 6; G53; K4691; amends R49) the vendored registry.json is the design's registry.json on the tranche, byte for byte, so a design-files merge that moves the registry fails here until the generated registry is re-taken (the gap: the screens' contract tests read the design file, the shell reads the generated copy)", () => {
  assert.equal(read("registry.json"), readFileSync(DESIGN_REGISTRY, "utf8"));
  assert.equal(wz.SCREEN_REGISTRY_SOURCE.sha256, createHash("sha256").update(readFileSync(DESIGN_REGISTRY, "utf8"), "utf8").digest("hex"), "and the generated registry names that file's sha256");
});

test("R50 (T51 fix round 6; G53; DEC-419; amends R49) the registry re-taken at f72b2f8a4c (84 screens and 609 acts, kept whole beside the carried file) and carried on at the pin R53 names: projectjoin is a registered act on start-send, request and action; the new screen registers has no page and registers its declared acts; every act the earlier file at 43379a1a44 registered is still registered; build-data.mjs --check passes", () => {
  const f72 = at("registry-f72b2f8a4c.json");
  assert.equal(f72.screens.length, 84, "the registry at f72b2f8a4c is kept whole beside it: 84 screens, 609 acts");
  assert.equal(f72.screens.reduce((n, s) => n + s.acts.length, 0), 609);
  for (const id of ["start-send", "request", "action"])
    assert.ok(wz.SCREEN_REGISTRY.find((s) => s.id === id).acts.includes("projectjoin"), `${id}: projectjoin is registered`);
  const registers = wz.SCREEN_REGISTRY.find((s) => s.id === "registers");
  assert.ok(registers, "T52's screen registers is carried");
  assert.ok(registers.acts.includes("search") && registers.acts.includes("explore"), "registers: its declared acts search and explore");
  const earlier = at("registry-43379a1a44.json");
  assert.equal(earlier.screens.reduce((n, s) => n + s.acts.length, 0), 564, "the earlier file is kept whole: 564 acts");
  for (const s of earlier.screens) {
    const now = wz.SCREEN_REGISTRY.find((x) => x.id === s.id);
    assert.ok(now, `${s.id}: still carried`);
    for (const a of s.acts.filter((x) => x.status !== "owed")) {
      if (s.id === "dash-action" && a.op === "taskresolve") continue;   /* DEC-437 (R53) */
      assert.ok(now.acts.includes(a.op), `${s.id}: ${a.op} still registered`);
    }
  }
  assert.equal(acts.length - 564, 92, "control: the diff adds acts only (564 to 656), but for dash-action's taskresolve (R53)");
  assert.equal(run("--check").status, 0, "the carried generated files are what their sources give");
});

test("R50 control: a one-byte change to the generated registry fails --check, and the library and the front doors are unchanged by the re-take", () => {
  const dir = mkdtempSync(join(tmpdir(), "wz-r50-"));
  try {
    for (const f of GENERATED) copyFileSync(join(GEN_DIR, f), join(dir, f));
    assert.equal(run("--check", "--out", dir).status, 0, "the copies of the carried files pass");
    const path = join(dir, "screen-registry.mjs");
    writeFileSync(path, readFileSync(path, "utf8").replace("b1adf4236d", "b1adf4236e"));
    const r = run("--check", "--out", dir);
    assert.equal(r.status, 1, "a one-byte change to the generated registry fails --check");
    assert.match(r.stderr, /screen-registry\.mjs is stale/);
    assert.ok(!/civicsmith-library|front-doors/.test(r.stderr), r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(wz.CIVICSMITH_LIBRARY_SOURCE.commit, "d129238bf3");
  assert.equal(wz.FRONT_DOORS_SOURCE.commit, "1cc4a957f0");
});

test("R53 (T51 fix round 10; DEC-438; SCREENS-INVESTIGATE #25 J45; K5302; amends R50) the registry is re-taken at b1adf4236d: SCREEN_REGISTRY_SOURCE names that commit, with 91 screens and 656 acts (452 declared, 83 function, 121 owed; 105 owed ops); standard registers standardinforcethrough, standardinforcethroughwithdraw, standardadoption, standardimpose and standardbenchmark; every act of c752a602da is still registered, kept whole beside it; the library and the front doors are unchanged; build-data.mjs --check passes", () => {
  assert.equal(SOURCES.registry.commit, "b1adf4236d");
  assert.equal(wz.SCREEN_REGISTRY_SOURCE.commit, "b1adf4236d");
  assert.deepEqual([wz.SCREEN_REGISTRY.length, acts.length, count("declared"), count("function"), count("owed")], [91, 656, 452, 83, 121]);
  assert.equal(new Set(acts.filter((a) => a.status === "owed").map((a) => a.op)).size, 105);
  const standard = wz.SCREEN_REGISTRY.find((s) => s.id === "standard");
  for (const op of ["standardinforcethrough", "standardinforcethroughwithdraw", "standardadoption", "standardimpose", "standardbenchmark"])
    assert.ok(standard.acts.includes(op), `standard: ${op} is registered`);
  const earlier = at("registry-c752a602da.json");
  assert.equal(earlier.screens.length, 91, "the earlier file is kept whole beside the carried one: 91 screens");
  assert.equal(earlier.screens.reduce((n, s) => n + s.acts.length, 0), 652, "and 652 acts");
  assert.ok(!earlier.screens.find((s) => s.id === "standard").acts.some((a) => a.op === "standardimpose"), "control: the earlier file has none of the five on standard");
  for (const s of earlier.screens) {
    const now = wz.SCREEN_REGISTRY.find((x) => x.id === s.id);
    assert.ok(now, `${s.id}: still carried`);
    for (const a of s.acts.filter((x) => x.status !== "owed")) {
      if (s.id === "dash-action" && a.op === "taskresolve") continue;   /* DEC-437 (B527) took it off the Action dashboard on purpose; home and queue still list it */
      assert.ok(now.acts.includes(a.op), `${s.id}: ${a.op} still registered`);
    }
  }
  assert.ok(!wz.SCREEN_REGISTRY.find((s) => s.id === "dash-action").acts.includes("taskresolve"), "DEC-437: dash-action no longer lists taskresolve");
  for (const id of ["home", "queue"]) assert.ok(wz.SCREEN_REGISTRY.find((s) => s.id === id).acts.includes("taskresolve"), `${id} still lists taskresolve`);
  assert.equal(wz.CIVICSMITH_LIBRARY_SOURCE.commit, "d129238bf3");
  assert.equal(wz.FRONT_DOORS_SOURCE.commit, "1cc4a957f0");
  assert.equal(run("--check").status, 0, "the carried generated files are what their sources give");
});
