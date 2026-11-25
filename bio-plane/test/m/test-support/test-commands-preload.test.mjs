/* test-support R18: "only the test commands load it" — both of them load the same preload, so a value over the platform's
 * single-value limit (2,098,176 B) is refused under each. The two commands are the module's own files: `npm test`
 * (bio-plane/package.json's `test` script, what a contributor runs) and the module runner (.github/scripts/module-tests.mjs).
 * Each command's `--import` target is read from its own file, then a child is run with exactly those preloads on a
 * 2,100,000 B bound value, which the platform refuses. A control with no preload accepts the same value, so the refusal
 * is the preload's. (Moved from plane's G123h, fix round 9, S-40; ARCH decision "Plane's tests go to the modules they prove".) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PLANE = fileURLToPath(new URL("../../../", import.meta.url));
const REPO = resolve(PLANE, "..");
const PRELOAD = resolve(PLANE, "test/platform-sqlite.mjs");

/** The `--import` targets of the `npm test` script, resolved against the directory npm runs it in (bio-plane). */
const npmTestPreloads = () => {
  const words = JSON.parse(readFileSync(resolve(PLANE, "package.json"), "utf8")).scripts.test.split(/\s+/);
  return words.flatMap((w, i) => (w === "--import" && words[i + 1] ? [resolve(PLANE, words[i + 1])] : []));
};

/** The module runner's preload: the path it resolves from the repository root and hands to each child as `--import`. */
const runnerPreloads = () => {
  const src = readFileSync(resolve(REPO, ".github/scripts/module-tests.mjs"), "utf8");
  const path = src.match(/const preload = resolve\("([^"]+)"\)/)?.[1];
  assert.ok(path, "module-tests.mjs names its preload");
  assert.match(src, /\["--import", preload, "--test"/, "module-tests.mjs hands its preload to every child it runs");
  return [resolve(REPO, path)];
};

const PROBE = `import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE t(v TEXT)");
  try { db.prepare("INSERT INTO t VALUES (?)").run("x".repeat(2_100_000)); process.stdout.write("ACCEPTED"); }
  catch (e) { process.stdout.write("REFUSED " + e.errcode); }`;
const childEnv = () => { const env = { ...process.env }; delete env.NODE_OPTIONS; return env; };
/** Runs the probe in a child with the given preloads, from `cwd`, and answers what it wrote. */
const probe = (preloads, cwd) =>
  spawnSync(process.execPath, [...preloads.flatMap((p) => ["--import", p]), "--input-type=module", "-e", PROBE],
    { cwd, encoding: "utf8", env: childEnv() }).stdout;

test("R18 `npm test` and the module runner each load exactly the platform-sqlite preload", () => {
  assert.deepEqual(npmTestPreloads(), [PRELOAD], "npm test");
  assert.deepEqual(runnerPreloads(), [PRELOAD], "the module runner");
});

test("R18 a 2,100,000 B bound value is refused (errcode 18) under each test command's preloads, and accepted with none", () => {
  assert.match(probe(npmTestPreloads(), PLANE), /^REFUSED 18$/, "npm test");
  assert.match(probe(runnerPreloads(), REPO), /^REFUSED 18$/, "the module runner");
  assert.equal(probe([], PLANE), "ACCEPTED", "control: no preload");
});
