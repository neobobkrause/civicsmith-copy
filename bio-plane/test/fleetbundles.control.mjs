/* FLEETBUNDLES' NEGATIVE CONTROL, redesigned for the suite as it now runs (bundler F3; coordinator ruling, 6 Nov 11:54).
 *
 *     node test/fleetbundles.control.mjs          # every arm, in order
 *     node test/fleetbundles.control.mjs 2b       # one arm
 *
 * Since the dist pass (PR 624, f6b3977e2f) `test/system/fleetbundles.test.mjs` reads no `dist/`: it builds every guarded
 * bundle and the plane into its own temp dir and builds a second time to compare. The arms that edited a committed
 * artifact, or edited a source and expected a committed artifact to go stale, controlled nothing any more and are
 * retired. Each arm now (a) breaks a build, (b) makes two builds differ or drops a recipe flag, (c) removes a member's
 * bundle declaration, or (d) moves the remedy text the suite's synthetic subject hands a reader; two arms are
 * over-strictness probes that must pass. The arms are data in `test/m/bundler/fleetbundles-arms.mjs`, which
 * `test/m/bundler/f3-control.test.mjs` holds; this driver applies each to the real tree, runs the suite, restores the
 * file by content and sha256, and GRADES the run: it exits 1 when any arm did not behave as it declares.
 *
 * DELIBERATELY NOT A `.test.mjs`: it edits real sources, and a file a `node --test` run discovers must never rewrite the
 * tree under the suites beside it. Run by the test runner it refuses and touches nothing.
 *
 * Its rules, kept from the old driver: the suite's output goes to a FILE in a pen inside this worktree, never a pipe
 * (a suite calling process.exit() drops unflushed pipe writes); its exit status is the process's own; every restore is
 * verified by content AND sha256, and a restore that fails stops the driver. Nothing here writes under any `dist/`. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ARMS, grade } from "./m/bundler/fleetbundles-arms.mjs";

if (process.env.NODE_TEST_CONTEXT) {
  console.log("fleetbundles.control.mjs: a hand-run negative control, not a test; run it alone: node test/fleetbundles.control.mjs [arm]");
  process.exit(0);
}

const DIR = dirname(fileURLToPath(import.meta.url));
const PLANE = join(DIR, "..");
const REPO = join(PLANE, "..");
const PEN = join(PLANE, ".nc-fleetbundles");
const SUITE = join(DIR, "system", "fleetbundles.test.mjs");
const sha = (b) => createHash("sha256").update(b).digest("hex");

function runSuite(id) {
  const log = join(PEN, `arm-${id}.out`);
  const r = spawnSync("node", [SUITE], { cwd: PLANE, encoding: "utf8", maxBuffer: 1 << 28 });
  const out = (r.stdout || "") + (r.stderr || "");
  writeFileSync(log, out);
  return { status: r.status, out: readFileSync(log, "utf8") };
}

function armed(arm, body) {
  if (!arm.file) return body();
  const path = join(REPO, arm.file);
  const before = readFileSync(path);
  const after = Buffer.from(arm.edit(before.toString("utf8")));   /* throws before the tree is touched when the anchor is not once */
  if (after.equals(before)) throw new Error(`arm ${arm.id} changes nothing in ${arm.file}`);
  try {
    writeFileSync(path, after);
    return body();
  } finally {
    writeFileSync(path, before);
    const back = readFileSync(path);
    const ok = back.equals(before) && sha(back) === sha(before);
    console.log(`    restore ${arm.file}: content=${back.equals(before)} sha256=${sha(back) === sha(before)} bytes=${back.length}`);
    if (!ok) { console.error("RESTORE FAILED: stop and fix the tree by hand"); process.exit(3); }
  }
}

const only = process.argv[2];
const arms = only ? ARMS.filter((a) => a.id === only) : ARMS;
if (!arms.length) { console.error(`no such arm: ${only}`); process.exit(2); }
mkdirSync(PEN, { recursive: true });
const wrong = [];
for (const arm of arms) {
  console.log(`\n================ ARM ${arm.id} (must ${arm.expect.toUpperCase()}) ================\n  ${arm.label}`);
  const r = armed(arm, () => runSuite(arm.id));
  const tally = /fleetbundles: (\d+) pass, (\d+) fail/.exec(r.out);
  console.log(`  -> ${tally ? `${tally[1]} pass, ${tally[2]} fail` : "no tally"}, exit ${r.status}`);
  for (const l of r.out.split("\n").filter((x) => x.startsWith("  FAIL  ")).slice(0, 12)) console.log(`     RED: ${l.slice(8)}`);
  const w = grade(arm, r);
  console.log(w.length ? `  ARM ${arm.id} DID NOT BEHAVE: ${w.join("; ")}` : `  ARM ${arm.id}: as declared`);
  if (w.length) wrong.push(arm.id);
}
rmSync(PEN, { recursive: true, force: true });
console.log(`\nfleetbundles control: ${arms.length - wrong.length} of ${arms.length} arm(s) as declared${wrong.length ? `; NOT: ${wrong.join(", ")}` : ""}`);
process.exit(wrong.length ? 1 : 0);
