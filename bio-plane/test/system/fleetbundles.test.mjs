/* NEGATIVE CONTROL: DECLARED HERE, RUN BY `test/fleetbundles.control.mjs` — deliberately NOT a `.test.mjs`, because it EDITS REAL SOURCES while it runs and neither `node --test` over `test/system/` nor the fleet walk must discover it (PL-3/PL-4/PL-11's precedent). THE HARNESS LIVES INSIDE THIS WORKTREE and never in a shared scratchpad, which a concurrent worker overwrote between ARM and RESTORE once already (PL-10). Every arm is armed ALONE, every restore is verified BY sha256 AND BY CONTENT (`cmp`), and every arm names what MUST fail AND what MUST NOT. ALL SIX ARMS RUN 2026-09-10 IN WORKTREE agent-abe10acbf93247266; baseline recorded at each arm.
   **BASELINE 43 pass / 0 fail, exit 0** (read from the process's own status, never a pipeline's), before each arm.
   (1) **THE ARM THIS ITEM EXISTS FOR — A SOURCE MOVES AND THE ARTIFACT DOES NOT.** Append one export to `agent-worker/src/harness.mjs` and do NOT rebuild -> **42 pass, 1 FAIL, exit 1**, naming `agent-worker`, naming `src/harness.mjs`, and saying STALE BUNDLE. pdf-worker held. **DECLARED WRONG FIRST AND CORRECTED INTO SOMETHING STRONGER RATHER THAN SMOOTHED, and this is the most useful thing the control found:** it was declared to fail from BOTH arms and the BYTE-IDENTITY ARM STAYED GREEN, because `harness.mjs` is a NON-ENTRY module and **esbuild TREE-SHAKES an unused export out of one** — the bundle really was byte-identical to a fresh build of the changed source. **So byte-identity alone would have PASSED a real source change**, and the dependency-free input-hash arm is the load-bearing one rather than a fallback for machines that cannot build. Arm (1b) is the pair that proves the other half.
   (1b) **THE SAME CHANGE ON THE ENTRY.** Append one export to `agent-worker/src/index.mjs` -> **39 pass, 4 FAIL, exit 1**: the input-hash arm AND the byte-identity arm AND the manifest-sha arm, because an ENTRY's exports are not tree-shaken. pdf-worker held.
   (2) **THE SAME ARM ON `pdf-worker` SPECIFICALLY**, because it is the member that was ALREADY missing this guard and a one-member fix would pass arm (1) while leaving it open. Append one export to `pdf-worker/src/index.mjs` -> **39 pass, 4 FAIL, exit 1**, naming `pdf-worker` and `src/index.mjs`; agent-worker held.
   (2, SECOND VARIANT — `2-noinstall`) **THE SAME ARM WITH `pdf-worker/node_modules` RENAMED AWAY**, which is a FRESH CHECKOUT's condition and the one that matters -> **36 pass, 1 FAIL, exit 1**. The byte-identity arm SKIPPED BY NAME (`SKIP  pdf-worker: byte-identity not runnable here`) and **the dependency-free input-hash arm STILL FAILED**, naming `pdf-worker` and `src/index.mjs`; `agent-worker`'s byte-identity arm still RAN, as declared. A guard that skips on the machine where it matters is not a guard.
   (2b) **THE CROSS-TREE ARM, and it is the one nobody would have looked for.** THREE of `pdf-worker`'s six build inputs are the PLANE's (`../bio-plane/src/pdfstructure.mjs`, `subresources.mjs`, `cpu.mjs`). Append one export to `bio-plane/src/pdfstructure.mjs` -> **42 pass, 1 FAIL, exit 1**, naming `pdf-worker` and `../bio-plane/src/pdfstructure.mjs`; `agent-worker` held, as declared, because it does not import the plane. A change to the plane stales a fleet member's artifact, from a directory whose author has no reason to think about `pdf-worker`.
   (3) **THE ARTIFACT ITSELF EDITED.** Append one line to `agent-worker/dist/agent-worker.bundled.mjs` -> **40 pass, 3 FAIL, exit 1**, naming the manifest mismatch (`does not match its own manifest`) and failing byte-identity; pdf-worker held. The manifest is not a second opinion about the artifact; it is a hash OF it.
   (4) **THE GUARD DELETED.** Remove the `bundle` block from `pdf-worker/fleet-member.json` -> **30 pass, 5 FAIL, exit 1**, naming `pdf-worker: declares no `bundle` block`. **TWO GATES FIRED OVER ONE ARM and both are recorded rather than claimed as one:** the per-member naming AND the GUARDED FLOOR. Discovery is the only evidence, so a member that stops declaring itself must not stop existing (VF-3's lesson, one file over).
   ---- FL-10's ARMS (D-298: the plane's own bundle gets the guard), RUN 2026-09-10 IN WORKTREE bio-worktrees/FLEET, APPENDED — no FL-9 arm edited. **BASELINE 56 pass / 0 fail, exit 0** before each arm.
   (6) **FL-10's OWN ARM, AND THE TREE-SHAKE PAIR IN ONE** — append one export to `bio-plane/src/pdfstructure.mjs` (NON-entry) and rebuild nothing -> **54 pass, 2 FAIL, exit 1**: bio-plane's input-hash arm naming `src/pdfstructure.mjs` AND pdf-worker's cross-tree arm naming `../bio-plane/src/pdfstructure.mjs` — the SAME plane edit stales BOTH committed artifacts by name. **The plane's BYTE arm stayed GREEN, as declared: esbuild tree-shakes the unused export, so byte-identity alone would have passed this real source change** — FL-9's measurement holding on the plane, which is FL-10's NC (2) satisfied by measurement rather than assertion. agent-worker held.
   (6b) **THE SAME CHANGE ON THE PLANE'S ENTRY** (`src/index.mjs`, exports not tree-shaken) -> **52 pass, 4 FAIL, exit 1**: input-hash, byte-identity, the manifest-sha arm, AND the comment-only sensitivity assertion — the fourth is the same change seen by the sensitivity probe, not a second cause. Both members held.
   (8) **OVER-STRICTNESS, PLANE HALF** — a legitimate `npm run build` of the unchanged plane must leave the tree byte-identical (`git status --porcelain` empty; run after the commit, like (5a)) and the suite green at the baseline figure.
   (5) **OVER-STRICTNESS, and these must all PASS.** [(b) and (c) RETIRED in T20 with `tools/` and `scripts/coverage.mjs`, which they read; the driver runs (a) alone — see its header.] (a) Rebuild BOTH members from unchanged sources — a legitimately rebuilt, byte-identical bundle must still pass and the tree must be UNCHANGED afterwards (`git status --porcelain` empty). **RUN AFTER THE COMMIT, deliberately: the tree-unchanged half is only a statement about a clean tree.** (b) A docs-only change must not fail the build — this suite must be OUTSIDE the doc-facing set `tools/gates.mjs` derives, READ OFF `gates.mjs --explain` since M0-152 (see M0-152's line below; the restatement this sentence described is superseded). (c) `node scripts/coverage.mjs --strict` exits 0, read from the process's own status.
   ---- M0-188's ARMS (the remedy a finding hands its reader), RUN 2026-09-24 IN THIS WORKTREE, APPENDED — no earlier arm edited. **BASELINE 96 pass / 0 fail, exit 0** before each arm; every restore verified by CONTENT and by sha256 at 31888 B.
   (10) **THE ROW'S OWN ARM — RESTORE ONE SITE'S PRE-M0-188 SENTENCE.** Put `Run \`npm run build\` in ${member.dir}/ and commit the artifact with the change.` back on the (b) input-hash finding, ALONE, leaving that finding's DIAGNOSIS half untouched -> **92 pass, 4 FAIL, exit 1**, and all four are (j): the behavioural `npm run build` arm, the behavioural at-least-four-name-`node tools/bundles.mjs` arm (3, not >= 4), the TOTAL over the guard's source (1, not 0), and the TOTAL's corpus floor (11, not >= 12). **Every DIAGNOSIS assertion HELD as declared** — (b) STALE BUNDLE, (d) the manifest mismatch, (g)/(h)/(i) the upload parts, every byte-identity arm: the remedy is the only thing that moved. The anchor is the remedy sentence PLUS the line above it, because the sentence alone occurs TWICE (here and in `verifyFresh`) and an anchor matching both would arm two sites. **THE ARM'S OWN PROBES WERE WRONG FIRST AND `m025-arm-anchor-witness.test.mjs` CAUGHT IT IN THE GATE — recorded, not smoothed:** they read the suite's output through `r.out.includes("FAIL  (b) and says it is a STALE BUNDLE")`, and that literal exists in NO candidate subject (the `FAIL  ` prefix is a runtime marking, not text in this file), so A4 fired at the D-276 class — a quote that could never match. The probes now select FAIL lines with the driver's own `failingLabels` helper and quote this suite's LABEL text, each occurring EXACTLY ONCE here, so the quote dies loudly if a label is ever changed in place. A control's probes are held to the rule the control exists to enforce.
   (10b) **OVER-STRICTNESS, A SPELLING THE ARM WAS NOT WRITTEN FOR** — the same site reworded around the SAME command (`Rebuild with \`node tools/bundles.mjs\` — it rebuilds every bundle this change staled — and commit the artifacts.`) -> **96 pass, 0 fail, exit 0**. **THIS ARM CAME BACK WRONG THE FIRST TIME AND IS RECORDED RATHER THAN SMOOTHED, and it is the most useful thing this control found:** (j)'s first draft SELECTED its corpus with a filter for the SENTENCE SHAPE of a remedy (`/\bRun \`|\band run \`/`), the reworded site fell OUT of that corpus, and a PASSING over-strictness arm went red at **95 pass, 1 FAIL** on the corpus floor. A filter of sentence shapes is the list-of-spellings defect one layer in from the defect this row exists to fix, so the filter was REMOVED: (j) now asserts over EVERY finding produced, which no rewording can move.
   (10c) **OVER-STRICTNESS, AND IT ASSERTS THE MATCHER'S DECLARED BLIND SPOT RATHER THAN PROMISING IT** — append a plain COMMENT to the guard naming `npm run build` unescaped -> **96 pass, 0 fail, exit 0**. The TOTAL arm's stated reach is the backtick-ESCAPED spelling inside a template literal, which is what a remedy looks like and what a comment is not; this arm is that sentence driven instead of asserted.
   ---- ARM 9 (FLEET #4 on BOB #29's diagnosis, 2026-09-23), APPENDED. **BASELINE 91 pass / 0 fail, exit 0.** (9) **THE INSTALL LAYOUT** — remove the `preserveSymlinks: true,` line from `optionsFor` in `scripts/fleet-bundle.mjs` and build through a SYMLINKED `pdf-worker/node_modules` (ambient in a worktree sharing another install; otherwise the harness parks the real directory and symlinks it) -> **84 pass, 7 FAIL, exit 1**: all four `… preserves symlinks …` recipe assertions, and pdf-worker's byte-identity, manifest-sha and comment-only assertions. agent-worker, ocr-worker and bio-plane byte arms held (none vendors from `node_modules`). Run on BOTH layouts, same tally; both restores verified by content and sha256. With the flag dropped on a REAL install (no symlink) the tally is **87 pass, 4 FAIL**, the four recipe assertions only, measured the same day: the byte arm cannot see the defect there, which is why they exist.
   ---- M0-152 (2026-09-25), arm 5(b) CORRECTED and two arms APPENDED beside it — no other arm edited. [All three RETIRED in T20 with `tools/gates.mjs`, their whole subject; the record below is of the runs as made.] **(5b) READ THE GATE, NOT A RESTATEMENT OF IT.** Until M0-152, (5b) decided "doc-facing?" itself, `includes(<the prose directory>)` over this suite and its driver read WHOLE, comments included — the rule as it stood before M0-143 made `gates.mjs` read every file as CODE (comments blanked by `walkfloor.mjs` `stripComments`) and follow the tools a suite names in code, so the arm and the gate disagreed the moment either file grew such a comment, and the arm never saw the edge rule. It now runs `gates.mjs --explain` and reads the derived line; `--explain` prints that line in EVERY class since M0-152 (it printed only for DOCS, so a code diff — this control's own — left nothing to read). **BASELINE (5b), clean tree at this commit: class TARGETED (the branch's own committed diff is code — the case the old DOCS-only printing left unreadable), doc-facing false; driver baseline 91 pass / 0 fail, arm 5 (a) tree UNCHANGED, (c) coverage exit 0.** (5b-comment) **THE ROW'S NEGATIVE CONTROL** — append a comment naming the prose directory to this suite -> class TARGETED, **the gate says false, the superseded whole-file read says true: they DISAGREE**, as declared. (5b-code) **OVER-LENIENCY** — append CODE whose string names it -> the gate says **true**, so the verdict is not false for free. **THE ENABLING CHANGE DISARMED** (`|| EXPLAIN` removed from `gates.mjs`, restored sha256- and cmp-identical at 106,257 B): (5b-comment) reads the gate's verdict **null** and `held: false`, and `gates.test.mjs` fails EXACTLY "M0-152: ...and `--explain` prints the SAME derived doc-facing set there" (125 pass, 1 FAIL).
   ---- RE-POINTED 2026-10-06 (BUNDLER #8, T34-6; N586): arm (1) now appends to `agent-harness/src/harness.mjs`, where T33's split moved agent-worker's harness (its own `src/harness.mjs` is a re-export file the build no longer reaches). Run alone on the T34 tree: **111 pass, 1 FAIL, exit 1**, naming `agent-worker` and `../agent-harness/src/harness.mjs` with STALE BUNDLE; the byte-identity arm held (tree-shaken, as declared above); restored by content and sha256.
   ======================================================================== */
/* THE FLEET'S BUILD GUARD (FL-9, BOB 2026-09-10, answering DIST's DELEGATION).
 *
 * **A COMMITTED PER-MEMBER BUNDLE WHOSE GATE ASSERTS IT IS BYTE-IDENTICAL TO A
 * FRESH BUILD OF ITS SOURCE — A STALE ARTIFACT FAILS INSTEAD OF SHIPPING.**
 *
 * WHY IT LIVES IN THE PLANE'S `test/` AND NOT IN A MEMBER'S. The old battery
 * (`battery.mjs`, deleted in T20) SKIPPED a fleet member's suites when that member
 * had no `node_modules` — loudly and by name, which is the right treatment for a
 * member's own suite and the wrong one for a guard. **A guard that skips is not a
 * guard.** `pdf-worker`'s own suites were run by NOTHING for eight days for exactly
 * this reason. This suite runs from the repository root whichever member is
 * installed: in the `regression` workflow's `node --test` over `bio-plane/test/system/`
 * and in the verify step of every layer close (`build/manifest.md`, "Generated
 * artifacts").
 *
 * ---- HOW THE TWO SIDES ARE KEPT GENUINELY INDEPENDENT -----------------------
 *
 * This estate has been bitten six times by an expectation DERIVED FROM THE THING
 * UNDER TEST, which moves with it and proves nothing. This suite compares a
 * BUILD to an ARTIFACT, so it is squarely in that class and the separation is
 * made structural rather than promised:
 *
 *   1. The committed artifact is READ FROM DISK BEFORE any build runs, and the
 *      build runs with `write: false` — `fleet-bundle.mjs`'s verification path
 *      cannot touch the tree. Nothing here can end up comparing one buffer with
 *      itself.
 *   2. The expectation is not derived from the artifact. It is derived from the
 *      SOURCE FILES — `src/*.mjs`, and for `pdf-worker` three files in
 *      `bio-plane/src/` — by running esbuild over them. Different files,
 *      different producer.
 *   3. **THE SUITE PROVES ITS OWN GUARD CAN FAIL, ON EVERY RUN, WITHOUT BEING
 *      ARMED.** Section 4 builds a SYNTHETIC member in a temp directory, verifies
 *      it GREEN, changes one byte of its source, and requires the same check to
 *      go RED — then restores it and requires GREEN again. Section 5 rebuilds
 *      each REAL member with one comment appended to its entry IN MEMORY and
 *      requires the bytes to differ from the committed artifact. A guard nobody
 *      has seen fail is a guard nobody has seen.
 *
 * ---- WHAT EACH ARM COVERS, AND WHAT IT CANNOT ------------------------------
 *
 * The byte-identity arm needs the member's dependencies installed; a fresh
 * checkout has none. So the INPUT-HASH arm — every build input's sha256, recorded
 * in the committed manifest — runs with no install at all and is what catches the
 * case this item exists for. The case the byte arm cannot check is the case where
 * the unverifiable inputs are also unchangeable: a dependency's bytes cannot
 * drift in a checkout that does not contain them, and a lock that moved without a
 * rebuild is caught by the dependency-free arm anyway.
 */
import "../stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import "../sandbox.mjs";               /* D-186: owns $TMPDIR for this process and removes it on exit */
import { Miniflare } from "miniflare";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPO_ROOT, discoverMembers, buildMember, writeMember, verifyStatic, verifyFresh,
  freshBuildRunnable, unresolvableSpecifiers, sha256, fleetProvenance, memberPaths,
  planeMember, assetsOf, optionsFor, isContainer, isGuarded,
  BUDGET, MIB, sizeVerdict, startVerdict, measureStart, budgetReport, releaseBindingFindings, ASCII_RECIPE,
} from "../../scripts/fleet-bundle.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
/* A finding is a failure. Printing them is not decoration: the item's acceptance
   is that the gate FAILS **NAMING THE MEMBER**, and a reader who cannot see the
   name cannot act on the red. */
const show = (findings) => { for (const f of findings) console.log(`         ! ${f}`); };

/* THE FLOOR, and it is a ratchet rather than a count. The member walk is
   DISCOVERY-driven (D-117), which is right and has one hole: a member that stops
   declaring itself stops existing, and `2 of 2 guarded` reads exactly as green
   as it did before a directory was deleted. Move this only UPWARD and only to a
   figure a green run PRINTED. */
/* MOVED 2026-09-12 by CPDF-10: 2 -> 3, the fleet's third member (`ocr-worker`,
   the Tier-3 OCR path). Moved to a figure a green run PRINTED and in the SAME
   turn as the member that invalidates it, which is the rule a floor with slack
   breaks. */
/* MOVED 2026-10-05 by BUNDLER #7 (T33-18a, K1513): 3 -> 4, the fleet's fourth
   member (`sheet-worker`, T33-18, the IronCalc recompute), in the same merge
   window as the member, by the same rule. */
const GUARDED_FLOOR = 4;

const members = discoverMembers(REPO_ROOT);

console.log("\n--- 1 · every fleet member is DISCOVERED, and every one of them is GUARDED ---");
/* T34-6 (BUNDLER #8; N578, bundler R24): `agent-runner` is the fleet's first CONTAINER member — its deliverable is an
   image named by digest, not a Worker bundle — so it is discovered and listed here, and not bundle-guarded below. */
/* T36-2 (BUNDLER #10; rev. 2 §2 R10): `file-scanner`, the fleet's second container member and its first with two
   classes (T36-5), is listed with each class's image: a two-class member answers its classes' repositories, in its
   marker's order; a one-class member its one image, as before.
   RE-POINTED T51 (N1242, K3805, bundler R35): the real fleet's markers name the three images on Docker Hub,
   `docker.io/civicsmith/…@sha256`, which an installer pulls with no credential; red until file-scanner's (T51-9) and
   agent-runner's (T51-64) own jobs merge their markers. */
t("members discovered by their own marker file, never a list kept here",
  members.map((m) => m.name), ["agent-runner", "agent-worker", "file-scanner", "ocr-worker", "pdf-worker", "sheet-worker"]);
t("agent-runner and file-scanner are listed as container members, each with its images (R24)",
  members.filter(isContainer).map((m) => [m.name, m.kind,
    ...(m.containers ? m.containers.map((c) => c.image.repository) : [m.image.repository])]),
  [["agent-runner", "container", "docker.io/civicsmith/agent-runner"],
   ["file-scanner", "container", "docker.io/civicsmith/file-scanner-scanner", "docker.io/civicsmith/file-scanner-renderer"]]);

/* D-238. `git stash` is REPOSITORY-WIDE across every worktree and `push -u`
   carries untracked files, so a `pop` can deposit a whole fleet directory —
   manifest and all — into a tree that never wrote it. The floor below is
   therefore measured against what ANOTHER CHECKOUT COULD SEE, not against what
   this walk counted, because a floor met by a phantom is permanently too high
   and a ratchet that cannot pass is one somebody switches off. */
const prov = fleetProvenance(members);
const off = new Set(prov.off.map((r) => r.path));
const reproducible = members.filter((m) => {
  if (!m.bundle) return false;
  const p = memberPaths(m);
  return !prov.verified || [p.marker, p.artifact, p.manifest].every((x) => !off.has(x));
}).length;
const counted = members.filter((m) => m.bundle).length;
if (reproducible !== counted)
  console.log(`        ${counted} guarded member(s) counted; ${reproducible} of them stand on files in the commit`);
t(`at least ${GUARDED_FLOOR} REPRODUCIBLE member(s) declare a committed bundle (the floor — a member DIRECTORY deleted is invisible to any per-member check, and a phantom one must not satisfy it)`,
  reproducible >= GUARDED_FLOOR, true);
/* R24: the one exemption is a container member with no Worker bundle, stated by its own marker; a marker that merely
   drops its `bundle` block is still named here. */
t("every discovered member declares one — a member with no `bundle` block is NAMED, never silently unguarded",
  members.filter((m) => !m.bundle && isGuarded(m)).map((m) => m.name), []);

/* The committed bytes are taken HERE, before a single build runs anywhere in
   this file. Everything downstream compares against this snapshot. */
const committedOf = new Map();
for (const m of members) {
  if (!m.bundle) continue;
  try { committedOf.set(m.name, readFileSync(join(m.abs, m.bundle.outfile))); }
  catch { committedOf.set(m.name, null); }
}

console.log("\n--- 2 · THE DEPENDENCY-FREE ARM: the committed artifact against the sources it was built from ---");
const manifests = new Map();
for (const m of members) {
  const { findings, manifest } = verifyStatic(m);
  manifests.set(m.name, manifest);
  show(findings);
  t(`${m.name}: no staleness, no recipe drift, no unresolvable import`, findings, []);
}

console.log("\n--- 2a · the manifest records the inputs it actually has, including the ones ACROSS TREES ---");
{
  /* IC-68 finding 3, asserted rather than described: three of `pdf-worker`'s
     inputs are the PLANE's, so a change in `bio-plane/src/` stales this member's
     artifact. Nothing said so anywhere before this item. */
  const pdf = manifests.get("pdf-worker");
  const cross = (pdf?.inputs || []).filter((i) => i.path.startsWith("../bio-plane/")).map((i) => i.path).sort();
  t("pdf-worker's build reaches into the PLANE's source, and the manifest hashes those files too",
    cross, ["../bio-plane/src/cpu.mjs", "../bio-plane/src/pdfstructure.mjs", "../bio-plane/src/read-bounds.mjs", "../bio-plane/src/setup-words/index.mjs", "../bio-plane/src/setup-words/rows.mjs", "../bio-plane/src/subresources.mjs"]); // setup-words since the words pass (K3949): pdfstructure and subresources read their sentences by key; read-bounds since PDF-WORKER #6 quotes READ_BOUNDS (G124a, K4875)
  const agent = manifests.get("agent-worker");
  /* CORRECTED 2026-09-12 BY FL-6, never exempted: the roster was three modules
     when FL-9 pinned it. FL-6 added `src/cascade.mjs` AND the member's first
     CROSS-TREE input — the plane's `tokens.mjs`, imported for the ONE denylist
     so publication-is-revocation has one expression — which is exactly the
     input class this manifest exists to hash (pdf-worker's three plane inputs,
     one section down). The old assertion going red on the first post-FL-6
     build is this guard working, not an obstacle. */
  /* T50-1 (BUNDLER #19; N1107, N1156, N1171; K3268, K3353, K3568): this was a hand-listed roster of the member's inputs,
     re-pinned at every merge that moved one (27 -> 28 at T47-4, then 36 in the bundle and 28 here), and so red whenever
     another module's job changed what agent-worker imports. A roster written here is a second copy of what the build
     reaches, which is how the list fell behind. The record is now asserted against the two things that decide it, never
     against a list: the committed manifest records exactly the first-party files a fresh build of the member reaches
     (esbuild's own metafile, nothing written), each with its size, and the manifest's recipe names the member's entry
     as one of them. */
  const agentMember = members.find((m) => m.name === "agent-worker");
  const reached = (await buildMember(agentMember, { write: false })).inputs
    .filter((i) => !i.path.split("/").includes("node_modules"));
  const recorded = agent?.inputs || [];
  const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  t("agent-worker's recorded inputs are exactly the first-party files a fresh build of it reaches — none missing, none extra",
    recorded.map((i) => i.path).sort(), reached.map((i) => i.path).sort());
  t("and each is recorded with the size the build read, and the member's own entry is among them",
    [recorded.slice().sort(byPath).map((i) => i.bytes), recorded.some((i) => i.path === agentMember.bundle.entry)],
    [reached.slice().sort(byPath).map((i) => i.bytes), true]);
  t("a build that reaches nothing would be the emptiest green: the record is not empty",
    recorded.length > 0, true);
  t("and it vendors nothing: the member still imports NOTHING from npm",
    (agent?.vendoredInputs || []).length, 0);
  t("every recorded input carries a hash — a null sha256 would be an input nothing checks",
    members.flatMap((m) => (manifests.get(m.name)?.inputs || []).filter((i) => !i.sha256).map((i) => `${m.name}:${i.path}`)), []);

  /* CPDF-10: `ocr-worker` reaches into TWO other trees — CPDF-12's renderer in
     `pdf-worker/src/` and the plane sources behind it — so a change in either
     stales this member's artifact, exactly as it does `pdf-worker`'s. Asserted
     rather than described, on IC-68 finding 3's precedent one member over.
     CORRECTED BY D-320 (2026-09-25), not exempted: the renderer gained its
     baseline JPEG decoder, `pdf-worker/src/dctdecode.mjs`, so the member now
     reaches FIVE cross-tree sources; the list as written would have let that
     fifth one go unhashed-by-assertion. CORRECTED AGAIN by D-622 (T3, entry
     N33): the renderer's JBIG2 and JPX decoders and their shared MQ coder are
     three more, EIGHT in all. CORRECTED AGAIN by T4 (K115, entry T4-5): the
     renderer's CCITT fax decoder, `pdf-worker/src/ccittdecode.mjs`, is a
     ninth. */
  const ocr = manifests.get("ocr-worker");
  /* T50-1 (BUNDLER #19; B2/B3, OCR-WORKER #6's R23; K3268): asserted against what a fresh build reaches, never a hand
     list: the cross-tree inputs the manifest records are exactly those the build reaches, and they still span both the
     renderer's tree and the plane's. */
  const ocrMember = members.find((m) => m.name === "ocr-worker");
  const ocrCross = (list) => list.map((i) => i.path).filter((p) => p.startsWith("../")).sort();
  const ocrReached = (await buildMember(ocrMember, { write: false })).inputs.filter((i) => !i.path.split("/").includes("node_modules"));
  t("ocr-worker's recorded cross-tree inputs are exactly those a fresh build of it reaches — none missing, none extra",
    ocrCross(ocr?.inputs || []), ocrCross(ocrReached));
  t("and they reach into the RENDERER's tree and the PLANE's",
    ["../bio-plane/", "../pdf-worker/"].map((d) => ocrCross(ocr?.inputs || []).some((p) => p.startsWith(d))), [true, true]);
  t("and it vendors NOTHING — its engine is a committed upload part, not an npm install, so its byte arm can never skip",
    (ocr?.vendoredInputs || []).length, 0);
}

console.log("\n--- 2b · THE UPLOAD PARTS: a member that is not a one-part upload, and the bytes its grade rests on ---");
{
  /* CPDF-10's additive arm. `ocr-worker` carries a wasm core and a language
     model as MODULE PARTS — Workers forbid compiling wasm at runtime, so there
     is no bundler trick that makes them one part. They are declared `external`,
     which means esbuild never sees them and they appear in NO input list: without
     this the guard would cover every line of the member's source and none of the
     5.95 MB that decides what its output says. That is FL-9's own defect, one
     directory over. */
  const ocr = manifests.get("ocr-worker");
  t("the member's upload parts are recorded in its committed manifest, with a hash each",
    (ocr?.assets || []).map((a) => a.path).sort(),
    ["assets/eng.traineddata", "assets/tesseract-core.wasm"]);
  t("and every one carries a real sha256 and a byte count",
    (ocr?.assets || []).filter((a) => !a.sha256 || !a.bytes).map((a) => a.path), []);
  /* THE ENGINE'S OWN DIGESTS, and they are not this item's numbers: CPDF-15
     pinned these exact bytes when it measured the GO verdict, and this member
     reproduces them from a fresh install and a fresh fetch. The `cap` in every
     chain this member writes is a measurement OF these two files. */
  const byPath = Object.fromEntries((ocr?.assets || []).map((a) => [a.path, a]));
  t("the wasm core is the one CPDF-15 measured, by digest and by byte count",
    [byPath["assets/tesseract-core.wasm"]?.sha256, byPath["assets/tesseract-core.wasm"]?.bytes],
    ["3822dc6ee83d507f2bd2f83b97a3dd5dabf3ea71a9836d951602c9054615137e", 1839004]);
  t("and the language model likewise — a different model is a different measurement",
    [byPath["assets/eng.traineddata"]?.sha256, byPath["assets/eng.traineddata"]?.bytes],
    ["7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2", 4113088]);
  /* THE OTHER TWO MEMBERS ARE UNTOUCHED BY THE ADDITION, which is the constraint
     the arm was written under: the key is emitted only for a member that declares
     assets, so no committed manifest moved. */
  t("a member that declares no upload part records no `assets` key at all — nothing else's manifest moved",
    ["agent-worker", "pdf-worker"].map((n) => manifests.get(n)?.assets === undefined), [true, true]);
}

console.log("\n--- 3 · THE BYTE-IDENTITY ARM: a fresh build of the SOURCE against the COMMITTED artifact ---");
/* THE INSTALL LAYOUT NEVER REACHES THE BYTES (BOB #29 and FLEET #4, 2026-09-23). esbuild names a module by its
   RESOLVED path, so a `node_modules` that is a SYMLINK to another checkout put `../../../../home/...` into
   pdf-worker's boundary comments and this arm read 84/3 on identical source. The flag is asserted HERE, on the
   recipe, because a real install has no symlink and the byte arm below cannot see the defect on it: this line
   is what fails on EVERY layout when the flag is dropped (fleetbundles.control.mjs arm 9). */
for (const m of [...members.filter((x) => x.bundle), planeMember()])
  t(`${m.name}: its build recipe preserves symlinks, so the install layout cannot reach the bytes`,
    optionsFor(m).preserveSymlinks, true);
const freshRan = [];
for (const m of members) {
  if (!m.bundle) continue;
  const committed = committedOf.get(m.name);
  if (!committed) { t(`${m.name}: the committed artifact is readable`, false, true); continue; }
  const { runnable, reason } = freshBuildRunnable(m, manifests.get(m.name) || {});
  if (!runnable) {
    /* SKIPPED LOUDLY AND BY NAME — D-93's treatment, never a silent pass and
       never folded into the green figure. The arm above still covered this
       member's sources, which is why a skip here is not a hole. */
    console.log(`  SKIP  ${m.name}: byte-identity not runnable here — ${reason}`);
    console.log(`        (the dependency-free input-hash arm in section 2 DID run for ${m.name})`);
    continue;
  }
  const { findings, built } = await verifyFresh(m, committed);
  show(findings);
  t(`${m.name}: a fresh build of ${m.bundle.entry} is byte-identical to the committed ${m.bundle.outfile}`,
    findings, []);
  t(`${m.name}: and the manifest's sha256 is that same build's`, built.sha256, manifests.get(m.name)?.sha256);
  console.log(`        ${m.name}: ${built.bytes.length} B · sha256 ${built.sha256}`);
  freshRan.push(m.name);
}
t("the byte-identity arm ran for at least one member — an arm that never runs is not an arm",
  freshRan.length >= 1, true);

console.log("\n--- 4 · THE GUARD PROVES IT CAN FAIL, on a subject this suite fully controls ---");
{
  /* A SYNTHETIC member, built and verified end to end through the SAME code path
     the real members use. This is the answer to "the two sides must genuinely
     come from different places": here the suite knows the ground truth, so a
     green that costs nothing would be visible immediately. */
  const root = mkdtempSync(join(tmpdir(), "fl9-selftest-"));
  try {
    const dir = join(root, "probe-worker");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/dep.mjs"), "export const N = 1;\n");
    writeFileSync(join(dir, "src/index.mjs"),
      "import { N } from \"./dep.mjs\";\nexport default { fetch() { return new Response(String(N)); } };\n");
    writeFileSync(join(dir, "fleet-member.json"), JSON.stringify({
      name: "probe-worker", entry: "src/index.mjs", surface: "SURFACE", testDir: "test",
      bundle: {
        entry: "src/index.mjs", outfile: "dist/probe-worker.bundled.mjs",
        manifest: "dist/probe-worker.bundle.json", external: ["cloudflare:workers", "node:*"],
      },
    }));
    const probe = discoverMembers(root).find((m) => m.name === "probe-worker");
    t("the synthetic member is discovered by the same walk the real ones are", !!probe, true);

    await writeMember(probe);
    t("(a) freshly built and freshly manifested, it verifies GREEN", verifyStatic(probe).findings, []);

    /* ARM: one byte of a source moves and the artifact does not. */
    const depPath = join(dir, "src/dep.mjs");
    const before = readFileSync(depPath);
    writeFileSync(depPath, "export const N = 2;\n");
    const armed = verifyStatic(probe).findings;
    t("(b) change one SOURCE byte without rebuilding -> the guard FAILS", armed.length > 0, true);
    t("(b) and the failure NAMES the member", armed.every((f) => f.startsWith("probe-worker:")), true);
    t("(b) and NAMES the file that moved", armed.some((f) => f.includes("src/dep.mjs")), true);
    t("(b) and says it is a STALE BUNDLE, not something the reader has to decode",
      armed.some((f) => f.includes("STALE BUNDLE")), true);
    const armedFresh = await verifyFresh(probe, readFileSync(join(dir, probe.bundle.outfile)));
    t("(b) the byte-identity arm fails on the same change, independently",
      armedFresh.findings.length > 0, true);

    /* RESTORE, verified by CONTENT and by sha256 — never by "I wrote it back". */
    writeFileSync(depPath, before);
    t("(c) restored BY CONTENT", readFileSync(depPath).equals(before), true);
    t("(c) restored BY sha256", sha256(readFileSync(depPath)), sha256(before));
    t("(c) and the guard is GREEN again — so the red above was the CHANGE and not the harness",
      verifyStatic(probe).findings, []);

    /* ARM: the ARTIFACT itself edited. The manifest is a hash OF the artifact,
       not a second opinion about it. */
    const artPath = join(dir, probe.bundle.outfile);
    const art = readFileSync(artPath);
    writeFileSync(artPath, Buffer.concat([art, Buffer.from("//x\n")]));
    const edited = verifyStatic(probe).findings;
    t("(d) edit the ARTIFACT and the guard FAILS on its own sha256",
      edited.some((f) => f.includes("does not match its own manifest")), true);
    writeFileSync(artPath, art);
    t("(d) restored BY CONTENT", readFileSync(artPath).equals(art), true);
    t("(d) GREEN again", verifyStatic(probe).findings, []);

    /* ARM: the guard DELETED. */
    const noBundle = { ...probe, bundle: null };
    const gone = verifyStatic(noBundle).findings;
    t("(e) a member that stops declaring a `bundle` block is NAMED, not silently dropped",
      gone.length === 1 && gone[0].startsWith("probe-worker:") && /no .bundle. block/.test(gone[0]), true);

    /* ---- CPDF-10's ARM, PROVED ON A SUBJECT THIS SUITE FULLY CONTROLS -------
     * The upload-part arm gets the same treatment every other arm here gets:
     * a synthetic member DECLARES an asset, is built, verifies GREEN, and then
     * each of the three ways an asset can go wrong is armed and must go RED.
     * A guard nobody has seen fail is a guard nobody has seen — and this one
     * guards the bytes a stated fidelity is a measurement OF. */
    mkdirSync(join(dir, "assets"), { recursive: true });
    const assetPath = join(dir, "assets/model.bin");
    writeFileSync(assetPath, Buffer.from("MODEL-v1"));
    const withAsset = { ...probe, bundle: { ...probe.bundle, assets: ["assets/model.bin"] } };
    await writeMember(withAsset);
    t("(f) a member declaring an upload part builds and verifies GREEN",
      verifyStatic(withAsset).findings, []);
    const manifestOf = () => JSON.parse(readFileSync(join(dir, withAsset.bundle.manifest), "utf8"));
    t("(f) and the part is recorded with its own hash",
      manifestOf().assets, [{ path: "assets/model.bin", bytes: 8, sha256: sha256(Buffer.from("MODEL-v1")) }]);

    const assetBefore = readFileSync(assetPath);
    writeFileSync(assetPath, Buffer.from("MODEL-v2"));
    const swapped = verifyStatic(withAsset).findings;
    t("(g) SWAP the model's bytes without rebuilding -> the guard FAILS", swapped.length > 0, true);
    t("(g) naming the member, the part, and STALE BUNDLE",
      [swapped.every((f) => f.startsWith("probe-worker:")),
       swapped.some((f) => f.includes("assets/model.bin")),
       swapped.some((f) => f.includes("STALE BUNDLE"))], [true, true, true]);
    t("(g) and it says WHY it matters here — the fidelity is a measurement OF these bytes",
      swapped.some((f) => /measurement OF these bytes/.test(f)), true);
    writeFileSync(assetPath, assetBefore);
    t("(g) restored BY CONTENT", readFileSync(assetPath).equals(assetBefore), true);
    t("(g) restored BY sha256", sha256(readFileSync(assetPath)), sha256(assetBefore));
    t("(g) GREEN again — so the red above was the CHANGE and not the harness",
      verifyStatic(withAsset).findings, []);

    rmSync(assetPath);
    const missing = verifyStatic(withAsset).findings;
    t("(h) an upload part that VANISHES is staleness, not a tolerated absence — unlike a vendored dependency it is committed",
      missing.some((f) => f.includes("MISSING") && f.includes("assets/model.bin")), true);
    writeFileSync(assetPath, assetBefore);
    t("(h) restored BY sha256", sha256(readFileSync(assetPath)), sha256(assetBefore));

    /* THE ASYMMETRIC ARM, and it is the one an `inputs`-shaped check would not
       have: a member that GAINS a part the manifest never recorded. Without it
       a member could acquire an unhashed upload part simply by being rebuilt
       against an older library, and every other arm would stay green. */
    const gainsOne = { ...probe, bundle: { ...probe.bundle, assets: ["assets/model.bin", "assets/extra.bin"] } };
    writeFileSync(join(dir, "assets/extra.bin"), Buffer.from("EXTRA"));
    t("(i) a member that DECLARES a part its manifest does not record is named — the direction that would otherwise fail open",
      verifyStatic(gainsOne).findings.some((f) => /records NO hash for it/.test(f) && f.includes("assets/extra.bin")), true);
    t("(i) and the mirror: a manifest recording a part the member no longer declares is named too",
      verifyStatic(probe).findings.some((f) => /no longer declares/.test(f) && f.includes("assets/model.bin")), true);
    t("(i) while the DECLARED-and-recorded member is still GREEN (over-strictness)",
      verifyStatic(withAsset).findings, []);

    /* ---- (j) M0-188's ARM — THE REMEDY A FINDING HANDS THE READER ----------
     * A gate message names the act that fixes it (`VERIFICATION.md`), and until
     * M0-188 every staleness finding here named `npm run build` in ONE member's
     * directory. **One `bio-plane/src/` edit stales THREE artifacts** (M0-178,
     * measured), so a worker who did as told rebuilt one and met the next at the
     * next gate — a red round per stale member, for a remedy that was never
     * wrong about the command, only about the SET.
     *
     * NO QUOTED ASSERTION ABOVE WAS SUPERSEDED BY THAT CHANGE, and that is
     * recorded rather than assumed: (b), (d), (g), (h) and (i) quote the
     * DIAGNOSIS half of a finding (`STALE BUNDLE`, `does not match its own
     * manifest`, `records NO hash for it`, `no longer declares`, `measurement
     * OF these bytes`), never its remedy, so all five still assert exactly what
     * they asserted before. The header's arm (8) does still say `npm run build`
     * and is CORRECT there: it is the member's own build being run legitimately,
     * not a remedy a finding hands out.
     *
     * TWO HALVES, because either alone is a green that costs too little:
     *   - BEHAVIOURAL, over findings this suite really produced from armed
     *     states above. It proves the new sentence reaches a reader.
     *   - TOTAL, over the source of `scripts/fleet-bundle.mjs`, because the
     *     behavioural half reaches only the arms this suite arms and the
     *     accepts-when is about EVERY site. **WHAT THIS MATCHER CAN SEE:** the
     *     backtick-quoted command spelling \`npm run build\` inside a template
     *     literal — which is what a finding's remedy looks like and what a plain
     *     comment does not (a comment writes the command unescaped). **WHAT IT
     *     CANNOT:** a remedy that spells the command without backticks, one
     *     assembled from variables, or one in any other file. `release-assemble.mjs`
     *     carried the same class and was NOT in this matcher's reach — named in
     *     M0-188's report rather than silently scored zero; its NO_ARTIFACT remedy
     *     names the same command since T22 (BUNDLER #5). */
    /* **THE FIRST DRAFT OF THIS ARM WAS WRONG AND ARM (10b) CAUGHT IT — recorded
     * rather than smoothed.** It selected its corpus with a filter for the
     * SENTENCE SHAPE of a remedy (/\bRun `|\band run `/) and then asserted over
     * what that filter returned. (10b) rewords one site to "Rebuild with `node
     * tools/bundles.mjs` …" — correct work in a spelling the filter did not
     * anticipate — and the site fell OUT of the corpus, taking the corpus below
     * its floor and turning a PASSING over-strictness arm red. A filter of
     * sentence shapes is the list-of-spellings defect `kickoffs/WORKER.md` names,
     * one layer in from the defect this row exists to fix. So there is no filter:
     * the arms assert over EVERY finding produced, which no rewording can move. */
    const produced = [...armed, ...swapped, ...missing, ...verifyStatic(gainsOne).findings];
    t("(j) the arms above really did produce findings — an empty corpus asserts nothing",
      produced.length >= 4, true);
    t("(j) NONE of them names the one-bundle command `npm run build` — asserted over every finding, unfiltered, so no spelling of a remedy can slip past it (M0-178's measured failure: one src edit stales three)",
      produced.filter((f) => f.includes("npm run build")), []);
    /* RE-POINTED 2026-10-01 (LEGACY-TESTS #18, T20; N442, N31): the remedy is now one constant in `fleet-bundle.mjs`
       naming `node bio-plane/scripts/bundles.mjs` (`tools/` is deleted), so the arm reads `verifyStatic`'s findings and
       never the guard's source text: the positive half, and a TOTAL over every finding produced, which is the reach the
       old source read stood in for (every site a finding can come from is armed above). */
    const REMEDY = "node bio-plane/scripts/bundles.mjs";
    t("(j) and at least four DO name `node bio-plane/scripts/bundles.mjs`, which rebuilds EVERY bundle the change staled — the positive half, so a finding that merely LOST its remedy cannot pass the arm above",
      produced.filter((f) => f.includes(REMEDY)).length >= 4, true);
    t("(j) TOTAL: every finding the armed states produced names that remedy — none is left without the act that fixes it",
      produced.filter((f) => !f.includes(REMEDY)), []);
    t("(j) and none names the retired `node tools/bundles.mjs` (N31)",
      produced.filter((f) => f.includes("tools/bundles.mjs")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("\n--- 5 · the REAL members: the comparison is sensitive to their real sources ---");
for (const m of members) {
  if (!m.bundle) continue;
  const committed = committedOf.get(m.name);
  if (!committed) continue;
  if (!freshBuildRunnable(m, manifests.get(m.name) || {}).runnable) {
    console.log(`  SKIP  ${m.name}: needs its own install to rebuild (see section 3)`);
    continue;
  }
  /* One export appended to the ENTRY, IN MEMORY — nothing on disk moves. If the
     committed artifact and a build of a CHANGED source came back equal, the
     comparison would be measuring nothing. */
  const mutated = await buildMember(m, { write: false, mutateEntry: "\nexport const __fl9Probe = \"fl9 independence probe\";\n" });
  t(`${m.name}: a build of a CHANGED entry is NOT the committed artifact`,
    Buffer.compare(mutated.bytes, committed) === 0, false);
  t(`${m.name}: and the change is visible in the output, so the build really consumed it`,
    mutated.bytes.toString("utf8").includes("fl9 independence probe"), true);

  /* AND THE OTHER DIRECTION, WHICH IS WHY THE TWO ARMS ARE NOT REDUNDANT.
     **esbuild STRIPS ordinary comments**, so a comment-only source change
     produces a BYTE-IDENTICAL bundle — measured here, on the real member, every
     run. The byte arm is BLIND to it and the input-hash arm is not, which makes
     the dependency-free arm STRICTER rather than a fallback for machines that
     cannot run the other one. Discovered by paying for it: this section's first
     draft appended a comment and read `identical` as a broken probe. */
  const commentOnly = await buildMember(m, { write: false, mutateEntry: "\n/* fl9 comment-only probe */\n" });
  t(`${m.name}: a COMMENT-only source change bundles byte-identically — so byte-identity alone would MISS it`,
    Buffer.compare(commentOnly.bytes, committed) === 0, true);
  t(`${m.name}: and the input-hash arm would NOT miss it, because the source's sha256 moved`,
    sha256(readFileSync(join(m.abs, m.bundle.entry)) + "\n/* fl9 comment-only probe */\n")
      !== (manifests.get(m.name)?.inputs || []).find((i) => i.path === m.bundle.entry)?.sha256, true);
}

console.log("\n--- 6 · INSTALLABLE WITHOUT BUNDLING: one part, nothing left to resolve ---");
for (const m of members) {
  if (!m.bundle) continue;
  const committed = committedOf.get(m.name);
  if (!committed) continue;
  const left = unresolvableSpecifiers(committed.toString("utf8"), m.bundle.external);
  t(`${m.name}: its committed artifact imports nothing a one-part upload could not resolve`, left, []);
}
t("agent-worker bundles to ONE file with ZERO import specifiers of any kind — the REFUSED multi-part alternative would buy nothing here",
  /(?:^|[;\n])\s*(?:import|export)[^;]*?\bfrom\s*["']/.test(committedOf.get("agent-worker")?.toString("utf8") || "x from \"y\""),
  false);

console.log("\n--- 7 · and the committed bytes really are a Worker: each boots under workerd from ONE part ---");
{
  /* The property `newgroup` needs, driven rather than argued. A static scan says
     nothing resolves; this says the runtime agrees. Both members expose a GET
     `/version` that needs no plane and no bytes. */
  for (const [name, extra] of [["agent-worker", { serviceBindings: { PLANE: () => new Response("{}") } }],
                               ["pdf-worker", { r2Buckets: ["CAPTURES"] }],
                               ["ocr-worker", { r2Buckets: ["CAPTURES"] }],
                               /* T33-18a (K1515): the fourth member boots the same way, with its wasm part. */
                               ["sheet-worker", { r2Buckets: ["CAPTURES"] }]]) {
    const m = members.find((x) => x.name === name);
    if (!m || !m.bundle || !committedOf.get(name)) { t(`${name}: present to boot`, false, true); continue; }
    const p = join(m.abs, m.bundle.outfile);
    /* CPDF-10: A MEMBER WITH UPLOAD PARTS BOOTS WITH THEM, and the modules array
       is how a boot expresses that — `modules:true` cannot. The parts are typed
       the way the PLATFORM types them at upload: `CompiledWasm` (Workers forbid
       compiling wasm at runtime, so this is the only way the core can arrive at
       all) and `Data`. `modulesRoot` is the MEMBER directory, because the module
       names are the specifiers the committed bundle imports. A member whose
       parts were missing would boot and then fail on its first page, which is
       why the version arm below asks the engine whether it is really there. */
    const assets = assetsOf(m);
    const wasmType = (rel) => (rel.endsWith(".wasm") ? "CompiledWasm" : "Data");
    const mf = new Miniflare({
      ...(assets.length
        ? { modulesRoot: m.abs,
            modules: [{ type: "ESModule", path: p, contents: committedOf.get(name).toString("utf8") },
                      ...assets.map((rel) => ({ type: wasmType(rel), path: join(m.abs, rel),
                                                contents: readFileSync(join(m.abs, rel)) }))] }
        : { modules: true, modulesRoot: "/", scriptPath: p, script: committedOf.get(name).toString("utf8") }),
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
      bindings: { VERSION: "bundle-gate" }, ...extra,
    });
    try {
      const res = await mf.dispatchFetch(`http://${name}/version`);
      const body = await res.json();
      t(`${name}: the COMMITTED bundle boots under workerd as one part and answers /version`,
        [res.status, body.name], [200, name]);
      t(`${name}: and it is the version the runtime bound, so the module really initialised`,
        body.version, "bundle-gate");
      /* CPDF-10: A MEMBER WITH UPLOAD PARTS IS ASKED WHETHER THEY ARRIVED. The
         boot above proves the JavaScript initialised; a member deployed without
         its wasm part initialises perfectly and then cannot transcribe anything.
         `ocr-worker` answers that on its own `/version`, so the gate asks. */
      if (assets.length)
        t(`${name}: and its upload parts really arrived — the engine reports itself loaded`,
          [body.engine_loaded, body.engine_unavailable], [true, undefined]);
    } finally { await mf.dispose(); }
  }
}

console.log("\n--- 8 · THE PLANE ITSELF (FL-10, D-298): the same guard, because `bundle.test.mjs` proves the artifact WORKS, never that it MATCHES ---");
{
  /* D-298, measured by DIST: `dist/bio-plane.bundled.mjs` sat 114 commits stale
     against `src` while the battery stayed green — `bundle.test.mjs` livefires
     the artifact, which proves it WORKS and says nothing about whether anyone
     ships from it. The plane is NOT a fleet member (it holds the store; the
     member rules would refuse it), so it arrives as `planeMember()`'s descriptor
     and the member walk and `GUARDED_FLOOR` keep their meaning. Booting the artifact is NOT re-proved here — that is
     `bundle.test.mjs`'s whole job, one file over. */
  const plane = planeMember(REPO_ROOT);

  /* The committed bytes are read from disk BEFORE any plane build runs — the
     same independence rule the members get at line one of this file. */
  let planeCommitted = null;
  try { planeCommitted = readFileSync(join(plane.abs, plane.bundle.outfile)); } catch { /* named below */ }
  t("bio-plane: the committed artifact is readable", !!planeCommitted, true);

  const { findings: planeStatic, manifest: planeManifest } = verifyStatic(plane);
  show(planeStatic);
  t("bio-plane: no staleness, no recipe drift, no unresolvable import — THE D-298 ARM, dependency-free",
    planeStatic, []);
  t("bio-plane: the manifest records first-party inputs for the whole plane, not a token few",
    (planeManifest?.inputs || []).length >= 40, true);
  /* N441 (LEGACY-TESTS #18, T20; K746, K758): docprofile's site recogniser, its events and handlers moved to
     site-profiles, and the plane reaches them across trees, so a change there stales the plane's artifact. The pins on
     docprofile's moved files are dropped (they left the agent-worker list with K683) and site-profiles' are pinned
     here, with the moved files asserted absent from docprofile's side. */
  const planeInputs = (planeManifest?.inputs || []).map((i) => i.path);
  t("bio-plane: the manifest hashes site-profiles' files, which the plane reaches across trees (N441)",
    planeInputs.filter((p) => p.startsWith("../site-profiles/")).sort(),
    ["../site-profiles/events.mjs", "../site-profiles/handlers/aspnet-webforms.mjs", "../site-profiles/handlers/client-rendered.mjs",
     "../site-profiles/handlers/conservative.mjs", "../site-profiles/handlers/wordpress.mjs", "../site-profiles/index.mjs",
     "../site-profiles/recogniser.mjs", "../site-profiles/region.mjs", "../site-profiles/scan.mjs"]); // scan.mjs since SITE-PROFILES #4 (G140, K4875)
  t("bio-plane: and no input names a docprofile file that moved to site-profiles",
    planeInputs.filter((p) => /^\.\.\/docprofile\/(index|recogniser|events)\.mjs$|^\.\.\/docprofile\/handlers\//.test(p)), []);
  t("bio-plane: and vendors NOTHING — the byte arm is runnable on any checkout, so it can never skip",
    (planeManifest?.vendoredInputs || []).length, 0);

  if (planeCommitted) {
    const { runnable, reason } = freshBuildRunnable(plane, planeManifest || {});
    /* No vendored inputs was asserted above, so a skip here is impossible by
       construction — asserted rather than assumed. */
    t(`bio-plane: the byte-identity arm is runnable (${reason || "no vendored inputs"})`, runnable, true);
    if (runnable) {
      const { findings, built } = await verifyFresh(plane, planeCommitted);
      show(findings);
      t(`bio-plane: a fresh build of ${plane.bundle.entry} is byte-identical to the committed ${plane.bundle.outfile}`,
        findings, []);
      t("bio-plane: and the manifest's sha256 is that same build's", built.sha256, planeManifest?.sha256);
      console.log(`        bio-plane: ${built.bytes.length} B · sha256 ${built.sha256}`);

      /* Sensitivity, both directions — the same pair section 5 proves for the
         members, proved on the plane because a comparison nobody has seen fail
         is a comparison nobody has seen. */
      const mutated = await buildMember(plane, { write: false, mutateEntry: "\nexport const __fl10Probe = \"fl10 independence probe\";\n" });
      t("bio-plane: a build of a CHANGED entry is NOT the committed artifact",
        Buffer.compare(mutated.bytes, planeCommitted) === 0, false);
      t("bio-plane: and the change is visible in the output, so the build really consumed it",
        mutated.bytes.toString("utf8").includes("fl10 independence probe"), true);
      const commentOnly = await buildMember(plane, { write: false, mutateEntry: "\n/* fl10 comment-only probe */\n" });
      t("bio-plane: a COMMENT-only source change bundles byte-identically — so byte-identity alone would MISS it",
        Buffer.compare(commentOnly.bytes, planeCommitted) === 0, true);
      t("bio-plane: and the input-hash arm would NOT miss it, because the source's sha256 moved",
        sha256(readFileSync(join(plane.abs, plane.bundle.entry)) + "\n/* fl10 comment-only probe */\n")
          !== (planeManifest?.inputs || []).find((i) => i.path === plane.bundle.entry)?.sha256, true);
    }
    const left = unresolvableSpecifiers(planeCommitted.toString("utf8"), plane.bundle.external);
    t("bio-plane: its committed artifact imports nothing outside its declared externals", left, []);
  }
}

console.log("\n--- 9 · R31: every member's SIZE and START-UP against the fleet's budget, printed for the layer close ---");
{
  /* T42-2 (BUNDLER #14; N840, K2547): Cloudflare's limits are 64 MiB uncompressed per Worker and 1 s for the global
     scope. The budget warns past 32 MiB and fails past 48 MiB, and warns past 500 ms; each member's figures are printed
     here so BOB reports them at each layer close. The plane is measured beside the members: it is the one near a limit. */
  t("R31: the budget is the one the requirement states — warn past 32 MiB, fail past 48 MiB, warn past 500 ms",
    [BUDGET.sizeWarn, BUDGET.sizeFail, BUDGET.startWarnMs], [32 * 1024 * 1024, 48 * 1024 * 1024, 500]);
  const measured = [];
  for (const m of [...members.filter((x) => x.bundle), planeMember(REPO_ROOT)]) {
    const r = await budgetReport(m);
    console.log(`        ${r.line}`);
    for (const w of r.warnings) console.log(`  WARN  ${w}`);
    show(r.findings);
    t(`R31: ${m.name}: its size and its start-up time are both MEASURED, and its size is within the 48 MiB budget`,
      [typeof r.bytes, typeof r.ms, r.findings], ["number", "number", []]);
    if (typeof r.bytes === "number" && typeof r.ms === "number") measured.push(m.name);
  }
  t("R31: every guarded member and the plane were measured — none left out of the figures BOB reports",
    measured, [...members.filter((x) => x.bundle).map((x) => x.name), "bio-plane"]);
}

console.log("\n--- 9a · R31's NEGATIVE CONTROL: synthetic artifacts that a budget must fail, warn on, and pass ---");
{
  /* K874: the check is seen to fail on a subject this suite fully controls, on every run. Each arm names what must
     fail and what must not. */
  t("R31: past is strictly greater — 48 MiB exactly warns, one byte more fails; 32 MiB exactly passes, one byte more warns",
    [48 * MIB, 48 * MIB + 1, 32 * MIB, 32 * MIB + 1].map((n) => sizeVerdict({ name: "x", bundle: null }, n).verdict),
    ["warn", "fail", "ok", "warn"]);
  t("R31: start-up past 500 ms warns and is never a failure; 500 ms exactly passes",
    [startVerdict({ name: "x" }, 500).verdict, startVerdict({ name: "x" }, 500.5).verdict], ["ok", "warn"]);

  const root = mkdtempSync(join(tmpdir(), "r31-budget-"));
  try {
    const dir = join(root, "r31-probe");
    mkdirSync(join(dir, "dist"), { recursive: true });
    mkdirSync(join(dir, "assets"), { recursive: true });
    /* The smallest valid wasm module, and a data part: the platform hands both to the global scope ready. */
    writeFileSync(join(dir, "assets/engine.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    writeFileSync(join(dir, "assets/model.bin"), Buffer.from("MODEL"));
    const SLOW_MS = 60, SLOW_FLOOR_MS = 50;
    const body = [
      'import { DurableObject, env as ENV } from "cloudflare:workers";',
      'import wasm from "../assets/engine.wasm";',
      'import model from "../assets/model.bin";',
      "globalThis.__r31Probe = (globalThis.__r31Probe || 0) + 1;",
      "globalThis.__r31Seen = [typeof DurableObject, typeof ENV, wasm instanceof WebAssembly.Module, model instanceof ArrayBuffer && model.byteLength];",
      /* CHANGE B2 (K2618): timed with `performance.now()`, never `Date.now()`, whose whole-millisecond truncation let
         the loop end up to 1 ms short of its figure, so a timing read back as 39.x ms failed `>= 40` on BOB's
         container. The loop now runs SLOW_MS by the same high-resolution clock the measurement uses, and the
         assertions ask for SLOW_FLOOR_MS, a margin below it: the measured window encloses the loop, so it can only
         be longer. */
      `const t0 = performance.now(); while (performance.now() - t0 < ${SLOW_MS}) { /* a slow global scope */ }`,
      "export class Probe extends DurableObject {}",
      "export default { fetch() { return new Response(\"ok\"); } };",
      "",
    ].join("\n");
    const artifact = body + "/*" + "x".repeat(4000) + "*/\n";
    writeFileSync(join(dir, "dist/probe.bundled.mjs"), artifact);
    const probe = { name: "r31-probe", abs: dir,
      bundle: { outfile: "dist/probe.bundled.mjs", assets: ["assets/engine.wasm", "assets/model.bin"] } };
    const size = Buffer.byteLength(artifact);

    const failing = await budgetReport(probe, { sizeWarn: 1000, sizeFail: 2000, startWarnMs: 60_000 });
    t("R31: (a) an artifact past the FAIL budget fails, naming the member, its size and the budget",
      [failing.size, failing.findings.length, failing.findings.every((f) => f.startsWith("r31-probe:")),
       failing.findings.some((f) => f.includes(`${size} B`) && /past the fleet's size budget/.test(f))],
      ["fail", 1, true, true]);
    const warning = await budgetReport(probe, { sizeWarn: 1000, sizeFail: 10 * MIB, startWarnMs: 60_000 });
    t("R31: (b) past the WARN budget only, it warns and does not fail",
      [warning.size, warning.findings, warning.warnings.length, /past the warning budget/.test(warning.warnings[0] || "")],
      ["warn", [], 1, true]);
    const within = await budgetReport(probe, { sizeWarn: 10 * MIB, sizeFail: 20 * MIB, startWarnMs: 60_000 });
    t("R31: (c) within both budgets, nothing fails and nothing warns (over-strictness)",
      [within.size, within.start, within.findings, within.warnings], ["ok", "ok", [], []]);

    const slow = await budgetReport(probe, { sizeWarn: 10 * MIB, sizeFail: 20 * MIB, startWarnMs: 10 });
    t("R31: (d) a global scope slower than its budget warns, naming the member and the time, and never fails",
      [slow.start, slow.findings, slow.ms >= SLOW_FLOOR_MS, slow.warnings.some((w) => w.startsWith("r31-probe:") && /global scope took \d+ ms/.test(w))],
      ["warn", [], true, true]);
    t("R31: (e) the import really evaluated the artifact's global scope, with its cloudflare: names and its upload parts as the platform hands them",
      globalThis.__r31Seen, ["function", "object", true, 5]);
    const before = globalThis.__r31Probe;
    const again = await measureStart(probe);
    t("R31: (f) every measurement is a FRESH import — the global scope ran again, so no module cache can make it free",
      [again.measured, globalThis.__r31Probe, again.ms >= SLOW_FLOOR_MS], [true, before + 1, true]);
    t("R31: (f) and the import hooks were removed after it — a cloudflare: import outside a measurement is Node's own refusal again",
      await import("cloudflare:workers").then(() => "resolved", () => "refused"), "refused");

    writeFileSync(join(dir, "dist/throws.bundled.mjs"), 'throw new Error("r31 boom");\nexport default {};\n');
    const throws = await budgetReport({ ...probe, bundle: { outfile: "dist/throws.bundled.mjs" } });
    t("R31: (g) an artifact whose global scope throws is UNMEASURED and fails by name — never a fast start by omission",
      [throws.ms, throws.findings.length, throws.findings.some((f) => /r31 boom/.test(f) && /start-up time is unmeasured/.test(f))],
      [null, 1, true]);
    const gone = await budgetReport({ ...probe, bundle: { outfile: "dist/absent.bundled.mjs" } });
    t("R31: (h) an artifact that is missing fails on its size and its start-up, never passes unmeasured",
      [gone.bytes, gone.ms, gone.findings.length], [null, null, 2]);
  } finally {
    rmSync(root, { recursive: true, force: true });
    delete globalThis.__r31Probe; delete globalThis.__r31Seen;
  }
}

console.log("\n--- 9 · the release is coherent: every binding names a class or service the release exports (R39; K4176) ---");
{
  /* A member bound to a class another member's bundle does not export is refused by Cloudflare at deploy (10061), so the
     release is checked here, against the bundles that would ship (built, not read from source). Red by name until
     agent-runner exports `RemoteSession` (agent-worker's REMOTE). */
  const { findings, unchecked } = await releaseBindingFindings([planeMember(), ...members.filter((m) => m.bundle)]);
  show(findings.map((f) => f.text));
  t("R39: every service and Durable Object binding, container class and migration class of the plane and each member is exported by the release's bundles", findings.map((f) => f.text), []);
  t("R39: every bundle was built here to read its exports", unchecked.map((u) => `${u.name}: ${u.reason}`), []);
}

console.log("\n--- 10 · every committed fleet bundle is pure ASCII (R2; G39), and its manifest records the recipe ---");
{
  /* One character above U+007F anywhere makes V8 hold the whole script two bytes a character (36 MB of the plane's 86 MB idle). */
  for (const m of [planeMember(), ...members.filter((x) => x.bundle)]) {
    const bytes = readFileSync(join(m.abs, m.bundle.outfile));
    let at = -1;
    for (let i = 0; i < bytes.length; i++) if (bytes[i] > 0x7f) { at = i; break; }
    t(`R2: ${m.name}'s committed bundle holds no byte over 0x7F`, at, -1);
    t(`R2: ${m.name}'s manifest records the ASCII recipe`, JSON.parse(readFileSync(join(m.abs, m.bundle.manifest), "utf8")).recipe.ascii, { ...ASCII_RECIPE });
  }
}

console.log(`\nfleetbundles: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
