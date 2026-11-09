/* F3 (dist pass PR 624; coordinator ruling, 6 Nov 11:54): fleetbundles.control.mjs must control the fleetbundles suite as it
 * now runs, which builds every bundle into its own temp dir and compares two builds, reading no dist/. These tests hold the
 * control's arm table (`fleetbundles-arms.mjs`) and its driver without running the suite: every arm applies to the tree as
 * it stands and edits no artifact, the driver runs that table and grades it, and an entry arm really breaks its member's
 * build. The full control is a hand run (`node test/fleetbundles.control.mjs`), never a test: it edits real sources. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ARMS, grade, replaceOnce, SYNTAX_BREAK } from "./fleetbundles-arms.mjs";
import { discoverMembers, buildMember } from "../../../scripts/fleet-bundle.mjs";
import { PLANE } from "./repo.mjs";

const ROOT = join(PLANE, "..");
const CONTROL = join(PLANE, "test", "fleetbundles.control.mjs");

test("F3: no arm edits a file under dist/ or an artifact, and each states what it must do and the names that show it", () => {
  assert.ok(ARMS.length >= 8, `${ARMS.length} arms`);
  assert.deepEqual(ARMS.filter((a) => a.file && /(^|\/)dist\//.test(a.file)).map((a) => a.id), []);
  assert.deepEqual(ARMS.filter((a) => a.file && /\.bundled\.mjs$|\.bundle\.json$/.test(a.file)).map((a) => a.id), []);
  for (const a of ARMS) {
    assert.ok(["fail", "pass"].includes(a.expect), `${a.id}: expect`);
    assert.ok(a.names.length > 0 && a.holds.length > 0, `${a.id}: names and holds`);
  }
  assert.equal(new Set(ARMS.map((a) => a.id)).size, ARMS.length, "ids are distinct");
  assert.ok(ARMS.some((a) => a.id === "baseline" && a.expect === "pass" && !a.file), "a baseline arm, nothing armed");
  assert.ok(ARMS.filter((a) => a.expect === "pass" && a.file).length >= 1, "at least one over-strictness arm that must pass");
});

test("F3: every arm's edit applies to the tree as it stands, its anchor found once, and changes the file", () => {
  for (const a of ARMS.filter((x) => x.file)) {
    const p = join(ROOT, a.file);
    assert.ok(existsSync(p), `${a.id}: ${a.file} exists`);
    const before = readFileSync(p, "utf8");
    const after = a.edit(before);
    assert.notEqual(after, before, `${a.id}: the edit moves ${a.file}`);
  }
  assert.throws(() => replaceOnce("a b a", "a", "c"), /occurs 2 time/);
  assert.throws(() => replaceOnce("a b", "z", "c"), /occurs 0 time/);
});

test("F3: the arms cover a broken member build, a broken plane build, two builds that differ, a recipe flag and a member's bundle declaration", () => {
  const ids = new Set(ARMS.map((a) => a.id));
  for (const id of ["1", "2", "2b", "4", "5", "9"]) assert.ok(ids.has(id), id);
  const byId = Object.fromEntries(ARMS.map((a) => [a.id, a]));
  assert.ok(byId["2b"].names.includes("bio-plane: its bundle did not build"));
  assert.ok(byId["5"].names.some((n) => n.includes("a fresh build of")), "arm 5 is read by the byte-identity assertions");
});

test("F3: the driver runs the arm table and grades each run, and refuses under the test runner before touching a file", () => {
  const src = readFileSync(CONTROL, "utf8");
  assert.match(src, /from "\.\/m\/bundler\/fleetbundles-arms\.mjs"/);
  assert.match(src, /grade\(arm, r\)/);
  assert.match(src, /process\.exit\(wrong\.length \? 1 : 0\)/, "the driver fails when an arm did not behave");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /dist\//, "the driver's code names no dist/ path");
  const refuse = src.indexOf("NODE_TEST_CONTEXT"), firstWrite = src.indexOf("mkdirSync(PEN");
  assert.ok(refuse > 0 && refuse < firstWrite, "the runner refusal comes before the pen is made");
});

test("F3: grade() passes a run that behaved as declared and names what did not", () => {
  const arm = ARMS.find((a) => a.id === "2");
  const out = (s) => `  FAIL  pdf-worker: the committed artifact is readable\n        pdf-worker: its bundle did not build: x\n${s}\nfleetbundles: 1 pass, 1 fail\n`;
  assert.deepEqual(grade(arm, { status: 1, out: out("") }), []);
  assert.match(grade(arm, { status: 0, out: out("") }).join(";"), /did not fail the suite/);
  assert.match(grade(arm, { status: 1, out: out("  FAIL  agent-worker: x") }).join(";"), /should hold/);
  /* a build-breaking arm may stop the suite before its tally (mayDie), but only with a failing exit and the member named */
  assert.deepEqual(grade(arm, { status: 1, out: "        pdf-worker: its bundle did not build: x\nError: Build failed\n" }), []);
  assert.match(grade(arm, { status: 1, out: "Error: Build failed\n" }).join(";"), /missing: pdf-worker: its bundle did not build/);
  const base = ARMS.find((a) => a.id === "baseline");
  assert.match(grade(base, { status: 1, out: "died" }).join(";"), /no tally/);
  assert.match(grade(ARMS.find((a) => a.id === "5"), { status: 1, out: "died" }).join(";"), /no tally/, "a recipe arm may not die");
  assert.deepEqual(grade(base, { status: 0, out: "fleetbundles: 9 pass, 0 fail\n" }), []);
  assert.match(grade(base, { status: 1, out: "  FAIL  x\nfleetbundles: 8 pass, 1 fail\n" }).join(";"), /exit 1, want 0/);
});

test("F3: arm 2's change, applied in memory to pdf-worker's entry, breaks its build, and the entry unchanged builds", async () => {
  const m = discoverMembers(ROOT).find((x) => x.name === "pdf-worker");
  await assert.rejects(buildMember(m, { write: false, mutateEntry: SYNTAX_BREAK }), /Build failed/);
  const built = await buildMember(m, { write: false });
  assert.ok(built.bytes.length > 0);
});
