/* wizard-scripts R54 (T53; BOB's ruling (a), 4 Nov 2026; amends R53): the registry re-taken at `30af4350f2`, the last
   commit to move the design's `registry.json` on the tranche. Driven at the module's interface over the carried data and
   the vendored design files; the generator runs as a command, as R44 to R53's tests do. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { currentAct } from "../../../src/wizard-scripts/data.mjs";
import { GENERATED, SOURCES } from "../../../src/wizard-scripts/build-data.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_DIR = join(HERE, "source");
const GEN_DIR = fileURLToPath(new URL("../../../src/wizard-scripts/", import.meta.url));
const BUILD = fileURLToPath(new URL("../../../src/wizard-scripts/build-data.mjs", import.meta.url));
const DESIGN_REGISTRY = fileURLToPath(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url));
const at = (f) => JSON.parse(readFileSync(join(SOURCE_DIR, f), "utf8"));
const run = (...args) => spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8" });
const screen = (id) => wz.SCREEN_REGISTRY.find((s) => s.id === id);

const file = at("registry.json");
const acts = file.screens.flatMap((s) => s.acts);
const count = (status) => acts.filter((a) => a.status === status).length;

test("R54 (T53; BOB's ruling (a); amends R53) the registry is re-taken at 30af4350f2: SCREEN_REGISTRY_SOURCE names that commit, the vendored file is the tranche's design file byte for byte, with 91 screens and 678 acts (461 declared, 82 function, 135 owed; 118 owed ops)", () => {
  assert.equal(SOURCES.registry.commit, "30af4350f2");
  assert.equal(wz.SCREEN_REGISTRY_SOURCE.commit, "30af4350f2");
  assert.equal(readFileSync(join(SOURCE_DIR, "registry.json"), "utf8"), readFileSync(DESIGN_REGISTRY, "utf8"), "R50's: the vendored file is the design's");
  assert.deepEqual([wz.SCREEN_REGISTRY.length, acts.length, count("declared"), count("function"), count("owed")], [91, 678, 461, 82, 135]);
  assert.equal(new Set(acts.filter((a) => a.status === "owed").map((a) => a.op)).size, 118);
});

test("R54: the acts new at 30af4350f2 are registered on their screens; the status changes keep their acts registered; registerimport is owed no more and registerfileimport is; every non-owed act of b1adf4236d, kept whole beside the carried file, is still registered", () => {
  for (const [id, op] of [["setup", "factconfirm"], ["queue", "signerknown"], ["capture", "captureuploadabort"], ["document", "resolve"],
                          ["question", "leggrade"], ["ceremony", "leggrade"], ["counsel", "counselpacketread"], ["counsel", "counselpacketexport"],
                          ["connect", "aiownadd"], ["connect", "aiaccountremove"], ["document", "contradictionflag"]])
    assert.ok(screen(id).acts.includes(op), `${id}: ${op} is registered`);
  const owedOn = (f, id) => f.screens.find((s) => s.id === id).acts.filter((a) => a.status === "owed").map((a) => a.op);
  assert.ok(!owedOn(file, "registers").some((o) => /registerimport /.test(o)), "registerimport is gone");
  assert.ok(owedOn(file, "registers").some((o) => /registerfileimport /.test(o)), "registerfileimport is owed in its place");
  assert.ok(owedOn(file, "members").some((o) => /adminproposalcancel /.test(o)) && owedOn(file, "capture").some((o) => /previewmore /.test(o)));
  for (const owed of ["adminproposalcancel", "previewmore"]) assert.ok(!wz.SCREEN_REGISTRY.some((s) => s.acts.includes(owed)), `owed ${owed} is not registered as a served act (R13)`);
  const earlier = at("registry-b1adf4236d.json");
  assert.equal(earlier.screens.reduce((n, s) => n + s.acts.length, 0), 656, "the earlier file is kept whole: 656 acts");
  assert.ok(!earlier.screens.find((s) => s.id === "setup").acts.some((a) => a.op === "factconfirm"), "control: the earlier file lacks factconfirm on setup");
  for (const s of earlier.screens)
    for (const a of s.acts.filter((x) => x.status !== "owed" && currentAct(x.op) !== null)) assert.ok(screen(s.id).acts.includes(currentAct(a.op)), `${s.id}: ${a.op} still registered`);
});

test("R54: build-data.mjs --check passes on the committed files; a one-byte change to the generated registry fails it; the library and the front doors are unchanged", () => {
  assert.equal(run("--check").status, 0, "the carried generated files are what their sources give");
  const dir = mkdtempSync(join(tmpdir(), "wz-r54-"));
  try {
    for (const f of GENERATED) copyFileSync(join(GEN_DIR, f), join(dir, f));
    const path = join(dir, "screen-registry.mjs");
    writeFileSync(path, readFileSync(path, "utf8").replace("30af4350f2", "30af4350f1"));
    const r = run("--check", "--out", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /screen-registry\.mjs is stale/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(wz.CIVICSMITH_LIBRARY_SOURCE.commit, "d129238bf3");
  assert.equal(wz.FRONT_DOORS_SOURCE.commit, "1cc4a957f0");
});
