/* wizard-library: the carried screen registry, re-taken from the design file on the tranche (R50, R41, R13). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCREEN_REGISTRY, SCREEN_REGISTRY_SOURCE } from "../../../../src/wizard-scripts/screen-registry.mjs";
import { SOURCES, GENERATED, generate, firstDifference } from "../../../../src/wizard-scripts/build-data.mjs";
import { screensFromFile, registryActGaps } from "../../../../src/wizard-scripts/data.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const SRC = fileURLToPath(new URL("../../../../src/wizard-scripts/", import.meta.url));
const DESIGN = fileURLToPath(new URL("../../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url));
const vendored = readFileSync(join(here, "registry.json"), "utf8");
const earlier = JSON.parse(readFileSync(join(here, "registry-b1adf4236d.json"), "utf8"));

test("R50: the vendored registry.json is the design's registry.json on the tranche, byte for byte", () => {
  assert.equal(vendored, readFileSync(DESIGN, "utf8"));
});

test("R50, R13: SCREEN_REGISTRY is the reading of the vendored file, and names it by commit, path and SHA-256", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(SCREEN_REGISTRY)), screensFromFile(JSON.parse(vendored)));
  assert.equal(SCREEN_REGISTRY_SOURCE.commit, SOURCES.registry.commit);
  assert.equal(SCREEN_REGISTRY_SOURCE.path, "docs/development/ux-substrate/screens/registry.json");
  assert.equal(SCREEN_REGISTRY_SOURCE.sha256, createHash("sha256").update(vendored).digest("hex"));
  assert.match(SCREEN_REGISTRY_SOURCE.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(SCREEN_REGISTRY) && Object.isFrozen(SCREEN_REGISTRY[0].acts), "the carried data is frozen");
});

test("R50, R13: document registers resolve, its last act in the design file; the acts the file adds are registered on their screens", () => {
  const acts = (id) => SCREEN_REGISTRY.find((s) => s.id === id).acts;
  assert.equal(acts("document").at(-1), "resolve");
  assert.ok(acts("document").includes("contradictionflag"));
  for (const [id, op] of [["setup", "factconfirm"], ["queue", "signerknown"], ["question", "leggrade"],
    ["counsel", "counselpacketread"], ["counsel", "counselpacketexport"], ["connect", "accountreferenceset"], ["connect", "accountreferenceremove"]])
    assert.ok(acts(id).includes(op), `${op} on ${id}`);
});

test("R50: the counts at the carried commit; every act and owed op of the kept earlier file at b1adf4236d is still carried", () => {
  const file = JSON.parse(vendored);
  const all = file.screens.flatMap((s) => s.acts);
  assert.equal(file.screens.length, 91);
  assert.equal(all.length, 662);
  assert.equal(SCREEN_REGISTRY.length, 91);
  const owedOps = new Set(SCREEN_REGISTRY.flatMap((s) => s.owed.map((o) => o.op)));
  assert.equal(owedOps.size, 105);
  for (const s of screensFromFile(earlier)) {
    const now = SCREEN_REGISTRY.find((x) => x.id === s.id);
    assert.ok(now, `screen ${s.id}`);
    for (const a of s.acts) assert.ok(now.acts.includes(a), `${a} on ${s.id}`);
    for (const o of s.owed) assert.ok(now.owed.some((x) => x.op === o.op), `owed ${o.op} on ${s.id}`);
  }
  for (const s of SCREEN_REGISTRY) for (const o of s.owed) assert.ok(Number.isInteger(o.at) && o.at >= 0 && o.at <= s.acts.length, `${o.op}'s place on ${s.id}`);
});

test("R41: the carried files are what their sources generate; a one-byte change to the vendored registry makes the registry stale, by line", () => {
  const made = generate(here);
  for (const name of GENERATED) assert.equal(firstDifference(readFileSync(join(SRC, name), "utf8"), made.files[name]), null, name);
  const dir = mkdtempSync(join(tmpdir(), "wizard-library-"));
  try {
    cpSync(here, dir, { recursive: true });
    writeFileSync(join(dir, "registry.json"), vendored.replace("\"resolve\"", "\"resolvf\""));
    const changed = generate(dir);
    const d = firstDifference(readFileSync(join(SRC, "screen-registry.mjs"), "utf8"), changed.files["screen-registry.mjs"]);
    assert.match(String(d), /^line \d+: /);
    assert.equal(firstDifference(readFileSync(join(SRC, "front-doors.mjs"), "utf8"), changed.files["front-doors.mjs"]), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R41: generate names a missing source; firstDifference at its bounds", () => {
  const dir = mkdtempSync(join(tmpdir(), "wizard-library-"));
  try { assert.throws(() => generate(dir), /ENOENT|no such file/); } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(firstDifference("a\nb", "a\nb"), null);
  assert.equal(firstDifference("a", "a\nb"), 'line 2: have null, the sources give "b"');
  assert.equal(firstDifference("x\n", "y\n"), 'line 1: have "x", the sources give "y"');
});

test("R13, R41: the reading of a registry file at its bounds: nothing read from no file; an owed act of the wrong form is not carried; an op listed twice is one act; a gap is named", () => {
  assert.deepEqual(screensFromFile(null), []);
  assert.deepEqual(screensFromFile({}), []);
  const [s] = screensFromFile({ screens: [{ id: "x", name: "X", purpose: "p", acts: [
    { op: "a", status: "declared" }, { op: "a", status: "function" }, { op: "owed:b K1", status: "owed" },
    { op: "owed:B", status: "owed" }, { op: "c", status: "design" }] }] });
  assert.deepEqual(s, { id: "x", name: "X", purpose: "p", acts: ["a"], owed: [{ op: "b", dec: "K1", at: 1 }] });
  assert.deepEqual(registryActGaps({ screens: [s], declared: ["a"] }), [{ screen: "x", act: "b", owed: true }]);
  assert.deepEqual(registryActGaps({ screens: [s], declared: new Set(["a", "b"]) }), []);
  assert.deepEqual(registryActGaps(), []);
});
