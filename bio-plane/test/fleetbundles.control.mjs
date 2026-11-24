/* FL-9's, FL-10's, FLEET #4's, M0-188's AND M0-152's NEGATIVE CONTROL DRIVER — eighteen arms
 * plus a baseline, re-runnable in one step:
 *
 * TALLY MOVED 2026-09-25 at c22-batch29's union of M0-188 (on main) and M0-152, COUNTED off the table
 * rather than added up: `1 1b 2 2-noinstall 2b 3 4 5 5b-comment 5b-code 6 6b 7 8 9 10 10b 10c` is EIGHTEEN.
 * M0-188's *"fifteen"* was itself one short — it named arm 9's missed append and then added its three to
 * twelve rather than thirteen, so main's table held SIXTEEN — and M0-152 appended `5b-comment` and
 * `5b-code` without moving the head (its side still read *"twelve"*). The third decay by APPEND.
 *
 * TALLY MOVED 2026-09-24 (M0-188) from *"twelve arms plus a baseline"*, which was
 * already stale by one when it was corrected: FLEET #4 appended arm 9 on 2026-09-23
 * without moving the head. M0-188 appends 10, 10b and 10c, so twelve -> fifteen, and
 * the drift is named rather than quietly absorbed — the same treatment M0-29 gave it
 * below, and the second time this number has decayed by APPEND.
 *
 * TALLY CORRECTED 2026-09-14 (M0-29, D-343). This line read *"six arms plus a
 * baseline"* and the driver announces THIRTEEN. THIS ONE DECAYED IN TWO STEPS
 * AND ONLY THE SECOND IS THE ONE THE RECORD ALREADY KNEW ABOUT:
 *
 *   - It was ALREADY FALSE IN ITS OWN LANDING COMMIT `d83695b` (FL-9), where the
 *     table held EIGHT arms plus a baseline — the variants `1b`, `2-noinstall`
 *     and `2b` were written during the item, after the head sentence, and the
 *     six the sentence names are the six the item set out with.
 *   - `3607b3b` (FL-10) then APPENDED `6`, `6b`, `7` and `8` — its own claim says
 *     so in those words — taking the table to twelve arms plus a baseline.
 *
 * The count now names BOTH items, because a driver whose head names one item and
 * whose arms serve two is the state that let the number drift unread. THE ARMS
 * ARE REAL: every one has its own anchor, subject and declared must-fail /
 * must-not pair, so the DECLARATION is corrected and no arm is restored or
 * removed (`casepin.control.mjs` is D-333's worked precedent).
 *
 *     node test/fleetbundles.control.mjs          # every arm, in order
 *     node test/fleetbundles.control.mjs 2b       # one arm
 *
 * DELIBERATELY NOT A `.test.mjs`: it EDITS REAL SOURCES and RENAMES a real
 * `node_modules`, and a file a `node --test` run discovers must never be one that
 * rewrites the tree underneath the suites running beside it (PL-3/PL-4/PL-11).
 * Named to `node --test` explicitly, it refuses and touches nothing (T23, K1120).
 *
 * THE THREE RULES THIS PROJECT PAID FOR, obeyed here:
 *
 *   1. PRISTINE COPIES LIVE INSIDE THIS WORKTREE, never in a shared scratchpad.
 *      PL-10's harness was overwritten mid-turn by a concurrent worker writing
 *      the same path. Each snapshot is held in memory for the arm and written
 *      back in a `finally`, so an arm that throws still restores.
 *   2. EVERY RESTORE IS VERIFIED BY CONTENT **AND** BY sha256, with a byte floor.
 *      UI-38 met a harness that reported a byte-identical restore over a file it
 *      had not restored.
 *   3. THE SUITE'S OUTPUT IS CAPTURED TO A FILE, NEVER TO A PIPE. D-282: a suite
 *      calling `process.exit()` discards unflushed PIPE writes, and a tally read
 *      `-1` for exactly that reason on a control that looked fine. The suite's
 *      EXIT STATUS is read from `spawnSync().status`, which is the process's own
 *      and never a pipeline's.
 *
 * NOTHING HERE WRITES A COMMITTED ARTIFACT (T23, K1118): arms 5 and 8 rebuild in memory; every other arm edits a
 * source and restores it by content and sha256.
 *
 * EACH ARM IS ARMED ALONE, with every other defence held open, and each names
 * what MUST fail AND what MUST NOT.
 *
 * RE-POINTED 2026-10-01 (LEGACY-TESTS #18, T20; N442, N31, N438): `tools/` and `scripts/coverage.mjs` are deleted, so
 * arm 5's (b) and (c) and M0-152's two arms beside it (`5b-comment`, `5b-code`), whose whole subject was the gate's
 * doc-facing derivation and coverage's floor, are retired with them; arm 6b arms the plane's entry where it now is,
 * `src/plane/index.mjs`; arms 10, 10b and 10c arm the ONE remedy constant (`REBUILD`) in `fleet-bundle.mjs`, which the
 * suite's arm (j) now reads through `verifyStatic`'s findings, never through the guard's source. The tally, counted off
 * the table below: `1 1b 2 2-noinstall 2b 3 4 5 6 6b 7 8 9 10 10b 10c` is SIXTEEN arms plus a baseline.
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, rmSync, lstatSync, symlinkSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoverMembers, planeMember, buildMember, manifestFrom } from "../scripts/fleet-bundle.mjs";

/* REFUSES UNDER THE TEST RUNNER (T23, K1120): `node --test` runs its files in parallel, so this driver's armed source
   edits would land under the suites beside it. Run by the runner (which sets NODE_TEST_CONTEXT in each file's
   process), it exits at once, before the pen is made or any file is touched. */
if (process.env.NODE_TEST_CONTEXT) {
  console.log("fleetbundles.control.mjs: a hand-run negative control, not a test; run it alone: node test/fleetbundles.control.mjs [arm]");
  process.exit(0);
}

const DIR = dirname(fileURLToPath(import.meta.url));
const PLANE = join(DIR, "..");
const REPO = join(PLANE, "..");
const PEN = join(PLANE, ".nc-fleetbundles");        /* inside this worktree, rule 1 */
const LOG = join(PEN, "run.out");
const SUITE = join(DIR, "system", "fleetbundles.test.mjs");   /* moved to test/system/ (K612); re-pointed T20 */

const sha = (b) => createHash("sha256").update(b).digest("hex");
const FLOOR = 200;                                   /* a "restore" of a truncated file is not a restore */

mkdirSync(PEN, { recursive: true });

/* REWRITTEN 2026-10-02 (BUNDLER #6, T23; K1118, bundler R10): arms 5 and 8 ran a real `npm run build`, which WROTE the
   committed `dist/` artifacts and manifests, so a run of bundler's test set left `bio-plane/dist/` modified wherever
   the tree's bundle was stale. They now rebuild IN MEMORY (`buildMember` with `write: false`, then `manifestFrom`, the
   very pair `writeMember` writes) and compare against the committed bytes: the same over-strictness claim, and nothing
   on disk moves. */
async function rebuildMatches(member) {
  let built;
  try { built = await buildMember(member, { write: false }); }
  catch (e) { return `NOT REBUILT (${String(e.message).split("\n")[0]})`; }
  const read = (rel) => { try { return readFileSync(join(member.abs, rel)); } catch { return null; } };
  const art = read(member.bundle.outfile), man = read(member.bundle.manifest);
  const manNow = Buffer.from(JSON.stringify(manifestFrom(member, built), null, 2) + "\n");
  const differs = [art && built.bytes.equals(art) ? null : member.bundle.outfile,
                   man && manNow.equals(man) ? null : member.bundle.manifest].filter(Boolean);
  return differs.length ? `DIFFERS from the committed ${differs.join(" and ")}` : "byte-identical to the committed artifact and manifest";
}

/* Run the gate and read its OWN exit status. Output to a FILE (rule 3). */
function runSuite() {
  const r = spawnSync("node", [SUITE], { cwd: PLANE, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  writeFileSync(LOG, out);
  const m = /fleetbundles: (\d+) pass, (\d+) fail/.exec(out);
  return {
    status: r.status,
    /* A MISSING TALLY IS SCORED AS A FINDING, NOT AS ZERO. A suite that DIED
       before printing its tally is not a suite that passed nothing; PL-11's own
       control read the whole file as "stayed GREEN" for want of this. */
    pass: m ? Number(m[1]) : -1,
    fail: m ? Number(m[2]) : -1,
    out,
  };
}

/* Append-only source edit, snapshotted and restored with both proofs. */
function withAppended(file, suffix, body) {
  const before = readFileSync(file);
  if (before.length < FLOOR) throw new Error(`refusing to arm ${file}: ${before.length} B is below the floor`);
  try {
    writeFileSync(file, Buffer.concat([before, Buffer.from(suffix)]));
    return body();
  } finally {
    writeFileSync(file, before);
    const after = readFileSync(file);
    const byContent = after.equals(before);
    const byHash = sha(after) === sha(before);
    console.log(`    restore ${file.replace(REPO + "/", "")}: content=${byContent} sha256=${byHash} bytes=${after.length}`);
    if (!byContent || !byHash || after.length < FLOOR) throw new Error("RESTORE FAILED — stop and fix the tree by hand");
  }
}

function withJson(file, mutate, body) {
  const before = readFileSync(file);
  try {
    const o = JSON.parse(before.toString("utf8"));
    mutate(o);
    writeFileSync(file, JSON.stringify(o, null, 2) + "\n");
    return body();
  } finally {
    writeFileSync(file, before);
    const after = readFileSync(file);
    console.log(`    restore ${file.replace(REPO + "/", "")}: content=${after.equals(before)} sha256=${sha(after) === sha(before)} bytes=${after.length}`);
    if (!after.equals(before)) throw new Error("RESTORE FAILED — stop and fix the tree by hand");
  }
}

function withRenamed(path, body) {
  const parked = path + ".fl9-armed-away";
  if (!existsSync(path)) { console.log(`    (${path} is absent already — the arm is the ambient condition)`); return body(); }
  renameSync(path, parked);
  try { return body(); }
  finally {
    renameSync(parked, path);
    console.log(`    restore ${path.replace(REPO + "/", "")}: present=${existsSync(path)} parked-gone=${!existsSync(parked)}`);
    if (!existsSync(path) || existsSync(parked)) throw new Error("RESTORE FAILED — stop and fix the tree by hand");
  }
}

/* RE-POINTED 2026-10-06 (BUNDLER #8, T34-6; N586, K1615): the harness moved to `agent-harness` in T33's split, and
   agent-worker's own `src/harness.mjs` is a re-export file its build no longer reaches, so an arm appended there would
   move no input and arm nothing. The arm's subject is the same: a NON-entry module of agent-worker's build, now
   reached across trees, whose source moves while the artifact does not. */
const AGENT_HARNESS = join(REPO, "agent-harness/src/harness.mjs");
const PDF_ENTRY = join(REPO, "pdf-worker/src/index.mjs");
const PLANE_PDFSTRUCT = join(PLANE, "src/pdfstructure.mjs");
const AGENT_ARTIFACT = join(REPO, "agent-worker/dist/agent-worker.bundled.mjs");
const PDF_MANIFEST_FILE = join(REPO, "pdf-worker/fleet-member.json");
const PDF_NODE_MODULES = join(REPO, "pdf-worker/node_modules");

const SUFFIX = "\nexport const __fl9ArmedProbe = 1;\n";

/* WHICH assertions went red, named. "1 fail" is a number; the LABEL is the
   evidence, and an arm that fires a different assertion than the one it was
   written for is a finding rather than a pass. */
const failingLabels = (out) =>
  out.split("\n").filter((l) => l.trim().startsWith("FAIL ")).map((l) => l.trim().slice(5).trim());

const report = (label, r, { mustFail, mustNot }) => {
  console.log(`  -> ${r.pass} pass, ${r.fail} fail, exit ${r.status}`);
  console.log(`     MUST FAIL : ${mustFail}`);
  console.log(`     MUST NOT  : ${mustNot}`);
  for (const l of failingLabels(r.out)) console.log(`     RED: ${l}`);
  if (r.pass === -1) console.log("     !! THE SUITE PRINTED NO TALLY — it died rather than failing. That is a FINDING.");
  return r;
};
const named = (r, ...needles) => needles.every((n) => r.out.includes(n));

const ARMS = {
  baseline: {
    /* The count in this label is the SAME CLAIM as the head's tally and was stale the same way
       (`six` against a table of twelve); corrected 2026-09-14 by M0-29 with the head, because
       correcting one and leaving the other is the half-fix that makes the next reader believe
       the wrong half. Moved with the head again 2026-10-01 (BUNDLER #5, T22): T20 retired two
       arms and the head read sixteen while this still read eighteen. */
    label: "nothing armed — what distinguishes sixteen-arms-working from sixteen-arms-broken",
    run: () => {
      const r = runSuite();
      console.log(`  -> BASELINE ${r.pass} pass, ${r.fail} fail, exit ${r.status}`);
      return r;
    },
  },

  1: {
    label: "(1) THE ARM THIS ITEM EXISTS FOR — a member's SOURCE moves and its artifact does not. "
      + "Append one export to agent-harness/src/harness.mjs (agent-worker's harness, across trees) and do NOT rebuild.",
    run: () => withAppended(AGENT_HARNESS, SUFFIX, () => {
      const r = report("1", runSuite(), {
        mustFail: "exit non-zero, NAMING `agent-worker` and `../agent-harness/src/harness.mjs`, from the input-hash arm "
          + "(the byte-identity arm may hold: esbuild tree-shakes an unused export out of a non-entry module)",
        mustNot: "pdf-worker's own assertions, which have nothing to do with this file",
      });
      console.log(`     names member+file: ${named(r, "agent-worker:", "../agent-harness/src/harness.mjs")}`);
      console.log(`     says STALE BUNDLE: ${named(r, "STALE BUNDLE")}`);
      return r;
    }),
  },

  "1b": {
    label: "(1b) THE SAME CHANGE ON THE ENTRY, AND THE PAIR IS THE FINDING. Append one export to "
      + "agent-worker/src/index.mjs — this one DOES move the bundle's bytes, so BOTH arms fire. Arm (1) "
      + "appended to a NON-entry module and esbuild TREE-SHOOK the unused export, leaving the bundle "
      + "byte-identical: **byte-identity alone would have passed a real source change.** That is why the "
      + "input-hash arm is the load-bearing one and not a fallback for machines that cannot build.",
    run: () => withAppended(join(REPO, "agent-worker/src/index.mjs"), SUFFIX, () => {
      const r = report("1b", runSuite(), {
        mustFail: "exit non-zero from BOTH arms — the input-hash arm naming `src/index.mjs`, AND the "
          + "byte-identity arm, because an ENTRY's exports are not tree-shaken",
        mustNot: "pdf-worker",
      });
      console.log(`     names member+file: ${named(r, "agent-worker:", "src/index.mjs")}`);
      return r;
    }),
  },

  2: {
    label: "(2) THE SAME ARM ON `pdf-worker` SPECIFICALLY — the member that was ALREADY missing this guard, "
      + "so a one-member fix would pass arm (1) and leave this open. Append one export to pdf-worker/src/index.mjs.",
    run: () => withAppended(PDF_ENTRY, SUFFIX, () => {
      const r = report("2", runSuite(), {
        mustFail: "exit non-zero, NAMING `pdf-worker` and `src/index.mjs`",
        mustNot: "agent-worker's assertions",
      });
      console.log(`     names member+file: ${named(r, "pdf-worker:", "src/index.mjs")}`);
      return r;
    }),
  },

  "2-noinstall": {
    label: "(2, SECOND VARIANT) THE SAME ARM WITH `pdf-worker/node_modules` RENAMED AWAY — a FRESH CHECKOUT's "
      + "condition. The byte-identity arm must SKIP by name and the dependency-free input-hash arm must STILL FAIL. "
      + "A guard that skips on the machine where it matters is not a guard.",
    run: () => withRenamed(PDF_NODE_MODULES, () => withAppended(PDF_ENTRY, SUFFIX, () => {
      const r = report("2-noinstall", runSuite(), {
        mustFail: "exit non-zero, still NAMING `pdf-worker` and `src/index.mjs`, from the input-hash arm ALONE",
        mustNot: "a silent pass; and agent-worker's byte-identity arm, which needs no member install, must still RUN",
      });
      console.log(`     names member+file: ${named(r, "pdf-worker:", "src/index.mjs")}`);
      console.log(`     byte arm skipped BY NAME: ${named(r, "SKIP  pdf-worker: byte-identity not runnable here")}`);
      console.log(`     agent-worker's byte arm still ran: ${named(r, "agent-worker: a fresh build of src/index.mjs is byte-identical")}`);
      return r;
    })),
  },

  "2b": {
    label: "(2b) THE CROSS-TREE ARM — three of pdf-worker's six build inputs are the PLANE's. "
      + "Append one export to bio-plane/src/pdfstructure.mjs and rebuild NOTHING.",
    run: () => withAppended(PLANE_PDFSTRUCT, SUFFIX, () => {
      const r = report("2b", runSuite(), {
        mustFail: "exit non-zero, NAMING `pdf-worker` and `../bio-plane/src/pdfstructure.mjs` — a change to the PLANE "
          + "stales a fleet member's artifact, from a directory whose author has no reason to think about pdf-worker",
        mustNot: "agent-worker, which does not import the plane",
      });
      console.log(`     names member+cross-tree file: ${named(r, "pdf-worker:", "../bio-plane/src/pdfstructure.mjs")}`);
      console.log(`     agent-worker held: ${!r.out.includes("agent-worker: STALE") && named(r, "agent-worker: no staleness")}`);
      return r;
    }),
  },

  3: {
    label: "(3) THE ARTIFACT ITSELF EDITED — append one line to agent-worker/dist/agent-worker.bundled.mjs. "
      + "The manifest is a hash OF the artifact, not a second opinion about it.",
    run: () => withAppended(AGENT_ARTIFACT, "//x\n", () => {
      const r = report("3", runSuite(), {
        mustFail: "exit non-zero on the manifest's own sha256 AND on byte-identity",
        mustNot: "pdf-worker",
      });
      console.log(`     names the manifest mismatch: ${named(r, "does not match its own manifest")}`);
      return r;
    }),
  },

  4: {
    label: "(4) THE GUARD DELETED — remove the `bundle` block from pdf-worker/fleet-member.json. "
      + "Discovery is the only evidence, so a member that stops declaring itself must not stop existing.",
    run: () => withJson(PDF_MANIFEST_FILE, (o) => { delete o.bundle; }, () => {
      const r = report("4", runSuite(), {
        mustFail: "exit non-zero, NAMING `pdf-worker` as declaring no bundle block — rather than the member quietly "
          + "dropping out of the guarded set and the run reading green",
        mustNot: "agent-worker",
      });
      console.log(`     names the undeclared member: ${named(r, "pdf-worker: declares no `bundle` block")}`);
      return r;
    }),
  },

  5: {
    label: "(5) OVER-STRICTNESS — correct work must PASS: rebuild BOTH members from unchanged sources, IN MEMORY, and "
      + "the rebuild must equal the committed artifact and manifest byte for byte. ((b) and (c), the gate's doc-facing "
      + "set and coverage's floor, retired with `tools/` and `scripts/coverage.mjs`, T20.)",
    run: async () => {
      console.log("  (a) rebuilding both members from unchanged sources, writing nothing");
      for (const dir of ["agent-worker", "pdf-worker"]) {
        const m = discoverMembers(REPO).find((x) => x.dir === dir);
        console.log(`      ${dir}: ${await rebuildMatches(m)}`);
      }
      const r = report("5a", runSuite(), {
        mustFail: "nothing",
        mustNot: "any assertion — a legitimately rebuilt, byte-identical bundle must still pass",
      });

      return r;
    },
  },
};

/* ---- FL-10's ARMS, APPENDED (D-298: the plane's own bundle gets the guard).
 * No existing arm is edited. The plane's sources are armed the way arm 2b
 * already arms `src/pdfstructure.mjs` — transiently, restored with both
 * proofs — and NEVER `store.mjs` or `schema.mjs`, which is FL-10's own claim
 * rule made physical here. */
const PLANE_ENTRY = join(PLANE, "src/plane/index.mjs");   /* the plane's entry since T20 (plane R6, K846) */

ARMS["6"] = {
  label: "(6) FL-10's OWN ARM — a PLANE source moves and the committed plane bundle does not. Append one export "
    + "to bio-plane/src/pdfstructure.mjs (a NON-ENTRY module, so this is ALSO the tree-shake arm: esbuild "
    + "tree-shakes the unused export and byte-identity alone MISSES it — the input-hash arm must fail anyway). "
    + "The same file is one of pdf-worker's cross-tree inputs, so BOTH artifacts must go stale by name.",
  run: () => withAppended(PLANE_PDFSTRUCT, SUFFIX, () => {
    const r = report("6", runSuite(), {
      mustFail: "exit non-zero — bio-plane's input-hash arm NAMING `src/pdfstructure.mjs` AND pdf-worker's "
        + "cross-tree arm NAMING `../bio-plane/src/pdfstructure.mjs`; the plane BYTE arm alone would stay "
        + "green (tree-shaken), which is exactly why the input-hash arm is load-bearing",
      mustNot: "agent-worker, which imports nothing from the plane",
    });
    console.log(`     names bio-plane+file: ${named(r, "bio-plane:", "src/pdfstructure.mjs")}`);
    console.log(`     says STALE BUNDLE: ${named(r, "STALE BUNDLE")}`);
    console.log(`     pdf-worker cross-tree fired too: ${named(r, "pdf-worker:", "../bio-plane/src/pdfstructure.mjs")}`);
    console.log(`     agent-worker held: ${named(r, "agent-worker: no staleness")}`);
    return r;
  }),
};

ARMS["6b"] = {
  label: "(6b) THE SAME CHANGE ON THE PLANE'S ENTRY — src/plane/index.mjs, whose exports are NOT tree-shaken, "
    + "so the byte-identity arm AND the input-hash arm must BOTH fire.",
  run: () => withAppended(PLANE_ENTRY, SUFFIX, () => {
    const r = report("6b", runSuite(), {
      mustFail: "exit non-zero from BOTH plane arms — input-hash naming `src/plane/index.mjs`, and byte-identity, "
        + "because an ENTRY's exports survive the bundle",
      mustNot: "either fleet member's own assertions",
    });
    console.log(`     names bio-plane+file: ${named(r, "bio-plane:", "src/plane/index.mjs")}`);
    return r;
  }),
};

ARMS["8"] = {
  label: "(8) OVER-STRICTNESS, PLANE HALF — a legitimate rebuild of the UNCHANGED plane, in memory, must equal "
    + "the committed artifact and manifest byte for byte, and the suite stay green. RUN AFTER THE COMMIT, like "
    + "arm 5: the byte-equal half is only a statement about a clean tree.",
  run: async () => {
    console.log("  (a) rebuilding the plane from unchanged sources, writing nothing");
    console.log(`      bio-plane: ${await rebuildMatches(planeMember(REPO))}`);
    return report("8", runSuite(), {
      mustFail: "nothing",
      mustNot: "any assertion — a legitimately rebuilt, byte-identical plane bundle must still pass",
    });
  },
};

/* ---- ARM 9, APPENDED 2026-09-23 (FLEET #4, on BOB #29's diagnosis). No existing arm is edited. ---- */
const FLEET_BUNDLE = join(PLANE, "scripts/fleet-bundle.mjs");
const FLAG_LINE = "    preserveSymlinks: true,";

/* One exact line removed, restored with both proofs. The line must occur EXACTLY ONCE: an arm that
   removes the wrong occurrence, or none, would be a control that moved nothing. */
function withLineRemoved(file, line, body) {
  const before = readFileSync(file);
  const text = before.toString("utf8");
  const hits = text.split("\n").filter((l) => l.startsWith(line)).length;
  if (hits !== 1) throw new Error(`refusing to arm ${file}: the line occurs ${hits} time(s), not once`);
  try {
    writeFileSync(file, text.split("\n").filter((l) => !l.startsWith(line)).join("\n"));
    return body();
  } finally {
    writeFileSync(file, before);
    const after = readFileSync(file);
    console.log(`    restore ${file.replace(REPO + "/", "")}: content=${after.equals(before)} sha256=${sha(after) === sha(before)} bytes=${after.length}`);
    if (!after.equals(before)) throw new Error("RESTORE FAILED — stop and fix the tree by hand");
  }
}

/* The defect's CONDITION: pdf-worker's `node_modules` reached through a symlink. If it is one already
   (a worktree sharing another checkout's install), that is the ambient condition. If it is a real
   directory, it is parked beside itself and a symlink put in its place, so the bytes esbuild reads are
   the same bytes, only the PATH to them differs, which is the one variable the flag governs. */
function withSymlinkedInstall(path, body) {
  if (!existsSync(path)) throw new Error(`refusing to arm: ${path} is absent, and this arm needs an install to build`);
  if (lstatSync(path).isSymbolicLink()) { console.log(`    (${path.replace(REPO + "/", "")} is a symlink already — the ambient condition)`); return body(); }
  const parked = path + ".fl13-real";
  renameSync(path, parked);
  symlinkSync(parked, path, "dir");
  try { return body(); }
  finally {
    unlinkSync(path);
    renameSync(parked, path);
    const ok = existsSync(path) && !lstatSync(path).isSymbolicLink() && !existsSync(parked);
    console.log(`    restore ${path.replace(REPO + "/", "")}: real-directory=${ok}`);
    if (!ok) throw new Error("RESTORE FAILED — stop and fix the tree by hand");
  }
}

ARMS["9"] = {
  label: "(9) THE INSTALL LAYOUT — drop `preserveSymlinks` from the recipe and build pdf-worker through a "
    + "SYMLINKED node_modules. esbuild then names unpdf by its RESOLVED absolute-ish path, and the committed "
    + "bundle (built from a real install) no longer matches identical source.",
  run: () => withSymlinkedInstall(PDF_NODE_MODULES, () => withLineRemoved(FLEET_BUNDLE, FLAG_LINE, () => {
    const r = report("9", runSuite(), {
      mustFail: "exit non-zero: all four recipe assertions (`… preserves symlinks …`), AND pdf-worker's "
        + "byte-identity, manifest-sha and comment-only assertions, the member that vendors from node_modules",
      mustNot: "agent-worker's, ocr-worker's or bio-plane's byte-identity: none vendors from node_modules",
    });
    console.log(`     recipe assertion fired: ${named(r, "FAIL  pdf-worker: its build recipe preserves symlinks")}`);
    console.log(`     pdf-worker byte arm fired: ${named(r, "FAIL  pdf-worker: a fresh build of src/index.mjs is byte-identical")}`);
    console.log(`     agent-worker byte arm held: ${!r.out.includes("FAIL  agent-worker: a fresh build")}`);
    return r;
  })),
};

/* ---- ARMS 10, 10b, 10c, APPENDED 2026-09-24 (M0-188). No existing arm is edited. ----
   The subject is the REMEDY a staleness finding hands its reader. Until M0-188 all twelve
   said `npm run build` in ONE member's directory; one `bio-plane/src/` edit stales THREE
   artifacts (M0-178, measured), so a worker who obeyed rebuilt one and met the next at the
   next gate. The arms are (10) the row's own declared control, plus TWO over-strictness arms,
   because a matcher that only ever goes red is a matcher nobody has seen be right. */

/* Exactly-once replacement. An arm that matched zero times or twice is a finding, not a pass
   (WORKER.md: "arms that NEVER ARMED"), so the count is checked BEFORE the tree is touched. */
function withReplacedOnce(file, from, to, body) {
  const before = readFileSync(file);
  if (before.length < FLOOR) throw new Error(`refusing to arm ${file}: ${before.length} B is below the floor`);
  const text = before.toString("utf8");
  const hits = text.split(from).length - 1;
  if (hits !== 1) throw new Error(`refusing to arm ${file}: the anchor occurs ${hits} time(s), not once`);
  try {
    writeFileSync(file, text.replace(from, to));
    return body();
  } finally {
    writeFileSync(file, before);
    const after = readFileSync(file);
    console.log(`    restore ${file.replace(REPO + "/", "")}: content=${after.equals(before)} sha256=${sha(after) === sha(before)} bytes=${after.length}`);
    if (!after.equals(before) || sha(after) !== sha(before) || after.length < FLOOR)
      throw new Error("RESTORE FAILED — stop and fix the tree by hand");
  }
}

/* RE-ANCHORED 2026-10-01 (LEGACY-TESTS #18, T20; N442): the remedy is ONE constant, `REBUILD`, which every staleness
   finding carries, so the anchor is its first line and it occurs exactly once. */
const REMEDY_NOW = 'const REBUILD = "Run `node bio-plane/scripts/bundles.mjs` from the repository root, "';
const REMEDY_OLD = 'const REBUILD = "Run `npm run build` in the member\'s own directory, "';

ARMS["10"] = {
  label: "(10) M0-188's OWN ARM — put the one-bundle remedy back in the ONE constant every staleness finding "
    + "carries. Nothing else changes: each finding's DIAGNOSIS half is untouched.",
  run: () => withReplacedOnce(FLEET_BUNDLE, REMEDY_NOW, REMEDY_OLD, () => {
    const r = report("10", runSuite(), {
      mustFail: "exit non-zero on THREE (j) assertions: none-names-`npm run build`, at-least-four-name-"
        + "`node bio-plane/scripts/bundles.mjs` (0, not >= 4), and the TOTAL over every finding produced",
      mustNot: "any DIAGNOSIS assertion — (b) STALE BUNDLE, (d) the manifest mismatch, (g)/(h)/(i) the "
        + "upload-part arms, or any byte-identity arm: the remedy is the only thing that moved",
    });
    /* PROBED THROUGH `failingLabels` (A4's rule): each literal below is the suite's own label text and occurs EXACTLY
       ONCE in `fleetbundles.test.mjs`, so the quote dies loudly if a label is ever changed in place. */
    const red = failingLabels(r.out);
    const fired = (prefix) => red.some((l) => l.startsWith(prefix));
    console.log(`     the TOTAL arm fired by name: ${fired("(j) TOTAL: every finding the armed states produced names that remedy")}`);
    console.log(`     the positive arm fired by name: ${fired("(j) and at least four DO name")}`);
    console.log(`     the behavioural arm fired by name: ${fired("(j) NONE of them names the one-bundle command")}`);
    console.log(`     (b) STALE BUNDLE held: ${!fired("(b) and says it is a STALE BUNDLE")}`);
    return r;
  }),
};

ARMS["10b"] = {
  label: "(10b) OVER-STRICTNESS, A SPELLING THE ARM WAS NOT WRITTEN FOR — the constant reworded around the "
    + "SAME command. Correct work in an unanticipated spelling must PASS.",
  run: () => withReplacedOnce(FLEET_BUNDLE, REMEDY_NOW,
    'const REBUILD = "Rebuild with `node bio-plane/scripts/bundles.mjs`, from the repository root, "', () => {
    const r = report("10b", runSuite(), {
      mustFail: "nothing",
      mustNot: "any (j) assertion: the command is the same, only the sentence around it differs",
    });
    console.log(`     no (j) assertion fired: ${failingLabels(r.out).filter((l) => l.startsWith("(j) ")).length === 0}`);
    return r;
  }),
};

ARMS["10c"] = {
  label: "(10c) OVER-STRICTNESS — a plain COMMENT in the guard naming `npm run build` must NOT be read as a "
    + "remedy: the arm reads the findings a reader is handed, never the guard's text.",
  run: () => withAppended(FLEET_BUNDLE, "\n/* M0-188 over-strictness probe: a member is built by npm run build in its own directory. */\n", () => {
    const r = report("10c", runSuite(), {
      mustFail: "nothing",
      mustNot: "any (j) assertion — a comment is prose about how a member is built, not a remedy handed to a reader",
    });
    console.log(`     no (j) assertion fired: ${failingLabels(r.out).filter((l) => l.startsWith("(j) ")).length === 0}`);
    return r;
  }),
};

const only = process.argv[2];
const names = only ? [only] : Object.keys(ARMS);
for (const n of names) {
  const arm = ARMS[n];
  if (!arm) { console.error(`no such arm: ${n}`); process.exit(2); }
  console.log(`\n================ ARM ${n} ================\n  ${arm.label}`);
  await arm.run();
}
rmSync(PEN, { recursive: true, force: true });
console.log("\nall requested arms done; the pen is removed and every restore was verified above.");
