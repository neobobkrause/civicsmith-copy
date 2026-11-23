/* plane: A STORE WRITTEN BY A RELEASED PLANE BOOTS ON THIS ONE (Process4: ARCH's decision "migrate-released", 23 Nov 2026; store-assembly R3, through
   the whole plane). Reads nothing from git: the stores are committed fixtures. */
/* REC-143 — A STORE WRITTEN BY A RELEASED PLANE BOOTS ON THIS ONE.
 *
 * WHY THIS SUITE EXISTS. Every release from 0.59.0 to 0.63.0 BRICKED an existing
 * store: `#migrate` ran the whole schema before its additive ALTER list, the schema
 * carried an index on a column only that list adds, and on a store created before
 * the column existed the index threw inside `blockConcurrencyWhile`. The Durable
 * Object then answered nothing. **The battery never saw it because every suite
 * builds a FRESH store**, and a fresh store gets every column from CREATE TABLE.
 * DIST found it live on biosmoke7, at 0.62.0.
 *
 * SO THE FIXTURE IS WHAT THE RELEASED PLANE ITSELF WROTE, NOT A SCHEMA SOMEBODY TYPED.
 * For each release a group may hold, its SIGNED BUNDLE, checked against its manifest's
 * own `sha256`, built and wrote a store once (`test/m/plane/migrate-released-capture.mjs`, run by
 * hand with the history fetched; ARCH's decision "migrate-released", 23 Nov 2026), and
 * that store is committed under `test/m/plane/fixtures/migrate-released/`, the release's commit and
 * the bundle's sha256 beside it. This suite copies each store and boots the current
 * plane on it; it reads nothing from git and boots no released bundle. A suite that
 * built the old shape by hand could agree with itself for free; the released bytes
 * cannot, because nobody here chose them.
 *
 * WHAT IT ASSERTS, per release (store-assembly R3, observed through the whole plane):
 * (1) the old plane made a store and wrote rows into it (held at the capture, which
 * writes nothing unless each such check holds); (2) the current plane ANSWERS on that store — `op=bootstrap`, `op=stats` and
 * `op=audit` all reach the Durable Object, and `op=selftest` answers; (3) the
 * migrated store has EXACTLY THE SHAPE A FRESH ONE HAS — every table, every column
 * (read with `table_xinfo`, so a generated column is seen), every index and trigger
 * a fresh store holds, and no table a fresh store lacks; (4) the rows the old plane
 * wrote survive, value for value; (5) a SECOND boot is clean.
 *
 * Property (3) is the general form of the sweep: it catches an ALTER-added column a
 * schema statement depends on (this defect), AND the reverse — a column the schema
 * assumes that nothing ever adds to an old table — with no list anybody maintains.
 *
 * WHAT IT CANNOT SEE: a store shape no release in RELEASES produced (a store born on
 * a release before 0.58.0 and never upgraded is not driven here — 0.58.0 is the last
 * release known to boot, so it is the floor a group can be standing on), and data
 * semantics beyond the rows seeded below. AND THE REFERENCE IS BUILT BY THE CODE UNDER
 * TEST: a defect that left a fresh store and a migrated one lacking the SAME thing
 * would compare equal here. That half is every other suite's, which all build fresh.
 *
 * TWO PATHS PER STORE A GROUP MAY HOLD. Section 2: a store BORN on each release.
 * Section 3: the path a group actually walked — born on 0.58.0, upgraded to a
 * withdrawn release (whose own bytes bricked it at the capture, the reproduction),
 * rolled back to 0.58.0 as DIST rolled biosmoke7 back, then upgraded to this plane.
 */
import "../stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import "../sandbox.mjs";               /* D-186: owns $TMPDIR for this process and removes it on exit */
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir, availableParallelism } from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { RELEASES, WITHDRAWN, FIXTURES, slug, INSTANCE, buildCurrent, bootBuilt, client, groupOf, shapeOf } from "../m/plane/migrate-released-kit.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${String(JSON.stringify(got)).slice(0, 1500)}`}`);
  ok ? pass++ : fail++;
};

/* ==================================================================== 0
 * THE REFERENCE: a store the CURRENT plane builds fresh. The shape every migrated
 * store must equal.
 * ================================================================== */
console.log("\n--- 0. the reference shape: a fresh store on the current plane ---");
/* the current plane as it deploys: its bundle, built once from the checkout (the kit's `buildCurrent`), booted for the reference and every store */
const BUILT = await buildCurrent(mkdtempSync(join(tmpdir(), "rec143-current-")));
const freshMf = bootBuilt(BUILT, mkdtempSync(join(tmpdir(), "rec143-fresh-")));
const FRESH = await shapeOf(client(freshMf, { current: true }));
/* D-436's POSITIVE half, on the one store in this suite the current plane is BORN on: its first boot
   records the bound name. Without this, every "records NOTHING" below would pass just as well if the
   binding never reached the store — a uniformly absent answer and a correct rule look identical. */
const FRESH_GROUP = await groupOf(client(freshMf, { current: true }));
await freshMf.dispose();
const freshTables = Object.keys(FRESH.tables || {});
console.log(`    fresh store: ${freshTables.length} tables, ${(FRESH.others || []).length} indexes/triggers/views`);
t("ARMED: the fresh reference store answered its own schema", FRESH.error ?? null, null);
/* Floored, because a shape comparison against an EMPTY reference passes for free. */
t("ARMED: the fresh reference is non-trivial (>= 80 tables, >= 100 indexes and triggers)",
  [freshTables.length >= 80, (FRESH.others || []).length >= 100], [true, true]);
t("ARMED: the fresh reference carries the three indexes the sweep found on list-added columns",
  ["index:inquiry_basis_content", "index:inquiry_basis_version_legs_content", "index:reading_text_source_cal"]
    .map((n) => (FRESH.others || []).includes(n)), [true, true, true]);
t(`D-436 POSITIVE: a store BORN on the current plane records the bound INSTANCE_NAME ('${INSTANCE}') at its first boot, `
  + "source bootstrap — so the binding reaches the store in this harness",
  FRESH_GROUP, [true, INSTANCE, "bootstrap"]);

/* ==================================================================== 1
 * THE FIXTURES: the store each signed release wrote, committed with the release's commit
 * and the bundle's sha256 (the capture checked the bytes against the manifest).
 * ================================================================== */
console.log("\n--- 1. the fixtures are the stores the signed releases wrote ---");
const LABELS = [...RELEASES.map(([v]) => `born on ${v}`),
  ...RELEASES.filter(([v]) => WITHDRAWN.has(v)).map(([v]) => `0.58.0 -> ${v} -> 0.58.0 -> current`)];
const COMMIT = Object.fromEntries(RELEASES);
const FIX = {};
for (const label of LABELS) {
  const dir = join(FIXTURES, slug(label));
  const cap = existsSync(join(dir, "capture.json")) ? JSON.parse(readFileSync(join(dir, "capture.json"), "utf8")) : null;
  t(`${label}: its store is committed, with what the release read back`, [cap !== null && cap.label === label, existsSync(join(dir, "store"))], [true, true]);
  if (!cap) continue;
  t(`${label}: written by the releases named, at the commits RELEASES names, each bundle's sha256 recorded`,
    cap.path.map((p) => [p.commit === COMMIT[p.version], /^[0-9a-f]{64}$/.test(p.bundle_sha256)]), cap.path.map(() => [true, true]));
  t(`${label}: ARMED — the rows the release wrote are there to survive (a bundle, a leg, a version leg, its files)`,
    [cap.rows[0]?.length, cap.rows[1]?.length, cap.rows[2]?.length, (cap.rows[3]?.[0]?.n ?? 0) > 0, typeof cap.served], [1, 1, 1, true, "string"]);
  FIX[label] = { dir, cap };
}
t("ARMED: every release in the list, and every withdrawn path, is a fixture", Object.keys(FIX).length, LABELS.length);

/* ==================================================================== 2
 * A STORE BORN ON EACH RELEASE boots on the current plane.
 * 3. THE PATH A GROUP ACTUALLY WALKED: a store born on 0.58.0, UPGRADED to a withdrawn release (whose own bytes
 *    bricked it, reproduced at the capture), ROLLED BACK to 0.58.0 (what DIST did to biosmoke7), then upgraded to
 *    the current plane.
 * ================================================================== */
/* The stores are independent (each its own copy and its own miniflare), and a plane's boot is prepared on its process's one main
   thread, so the stores are booted in up to four child processes side by side (`../m/plane/migrate-released-runner.mjs`), to keep the
   run inside the required run's bound (plane's tests "complete yet fast and efficient"). Each child records every check of its stores
   and the suite prints them all here, in the order of LABELS, exactly as a one-at-a-time run prints them; a child that fails to answer
   is a failure named with its stores. */
const runs = LABELS.filter((label) => FIX[label]);
const share = Math.max(1, Math.min(4, availableParallelism(), runs.length));
const work = mkdtempSync(join(tmpdir(), "rec143-runs-"));
writeFileSync(join(work, "fresh.json"), JSON.stringify(FRESH));
const RUNNER = fileURLToPath(new URL("../m/plane/migrate-released-runner.mjs", import.meta.url));
const SQLITE = fileURLToPath(new URL("../platform-sqlite.mjs", import.meta.url));
const parts = Array.from({ length: share }, (_, p) => runs.map((label, i) => ({ label, i })).filter(({ i }) => i % share === p));
const results = new Array(runs.length);
await Promise.all(parts.map((part, p) => new Promise((done) => {
  const fixtures = part.map(({ label }) => ({ label, dir: FIX[label].dir, cap: FIX[label].cap }));
  const input = join(work, `part-${p}.json`), output = join(work, `result-${p}.json`);
  writeFileSync(input, JSON.stringify({ fixtures, fresh: join(work, "fresh.json"), built: BUILT }));
  execFile(process.execPath, ["--import", SQLITE, RUNNER, input, output], { maxBuffer: 256 << 20 }, (err, stdout, stderr) => {
    let got = null;
    try { got = JSON.parse(readFileSync(output, "utf8")); } catch { got = null; }
    part.forEach(({ label, i }, q) => {
      results[i] = got && got[q] && got[q].label === label ? got[q].checks
        : [[`${label}: its child process answered`, String((err && err.message) || stderr || "no result").slice(0, 600), null]];
    });
    done();
  });
})));
let n = 1;
runs.forEach((label, i) => {
  n++;
  console.log(`\n--- ${n}. a store ${label} boots on the current plane ---`);
  for (const [l, got, want] of results[i]) t(l, got, want);
});

console.log(`\nmigrate-released: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
