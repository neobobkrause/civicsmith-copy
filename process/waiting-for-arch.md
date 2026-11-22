# Waiting for ARCH

Written by civicsmith's set-up session (Process4 design part 7, section 4, act 8) on 22 Nov 2026, from the
set-up brief (`process/lanes/civicsmith/setup-session-brief.md` in `neobobkrause/process4`). ARCH does not
exist until ROOT starts, so what the set-up session found and did not decide is kept here. **Nothing here is
decided.** ARCH corrects the module list or places the work before any job opens on the modules concerned.

## 1. Tests that reach a later module

The module list was converted from `build/modules.json` as it stands on main, in order, reshaping nothing; no
test was moved and no product file changed. The PROCESS civicsmith lane sorted the third reading's findings
into thirteen groups, each with the kind it proposes (A: the test belongs in the later module; B: a shared
helper or fixture belongs in an earlier module's public files; C: wrong boundary, design part 2 section 8;
D: the order can change; E: an earlier module used but not declared). The full list, with every file and
line: https://github.com/neobobkrause/process4/blob/main/process/lanes/civicsmith/later-module-tests.md

1. Tests that boot the real plane: 62 files of 21 modules (record-core, membership, promotion, host-governor, provenance, capture, reading-pipeline, agent-worker, reevaluation, affordances, queue, instance-setup, screens-intake, screens-daily, screens-inquiry, screens-publish, control-plane, roster-reader, office-readers, store-assembly, as the lane lists them) reach plane. Proposed kind: A.
2. Product-wide walks: test-support, promotion, file-safety, lines, answers, docket, following, answer-envelope, control-plane walk the whole product. Proposed kind: A (C if ARCH wants one final whole-product module).
3. The declared-operations registry: test-support's `declared-ops.mjs` and the tests of answers, op-declarations, store-assembly, screens-settings, control-plane, op-grades, affordances; case-import, link-sweep, queue, op-grades and store-door reach op-grades or op-declarations. Proposed kind: C.
4. interface-shell and the screens modules (screens-entry to screens-action); plane's `t47`/`t50` import the screens modules. Proposed kind: C.
5. bundler and the fleet: bundler's tests bundle pdf-worker, ocr-worker, sheet-worker, file-scanner, agent-harness, agent-runner, agent-worker, plane, read pdf-reader, site-profiles, subresources, court-citations, and import installer. Proposed kind: C.
6. Tooling through another package's folder: pdf-pixels, pdf-worker, agent-worker, roster-reader, bundler resolve through bio-plane's `package.json`; pdf-pixels through ocr-worker's; budget-doctypes through pdf-worker's `node_modules`. Proposed kind: B.
7. Reading a later module's config: bundler, scheduler, control-plane read plane's `wrangler.jsonc`; agent-runner reads agent-worker's. Proposed kind: A.
8. Reading a later module's source: record-grammar to entities, lines, progressions, money, inquiry; action-grammar to action-records, actions; actions to action-holds; pdf-worker to admission; journey-check to op-declarations. Proposed kind: A.
9. Running a later module's code in a child process or probe: signatures to capture, case-checker; pdf-reader to docprofile, doctypes, reading-pipeline. Proposed kind: A.
10. Fixtures in another module's test folder: jurisdictions to legistar-reader; public-read to image-cover; store-request to doctypes; screens-intake to pdf-reader. Proposed kind: B (A the alternative for jurisdictions).
11. Service bindings to a later worker's bundle: doctypes to ocr-worker; roster-reader to pdf-worker. Proposed kind: D or A.
12. pdf-pixels and pdf-worker share one package folder; pdf-worker's `test-script.test.mjs` lists image-codecs' tests. Proposed kind: C.
13. Earlier modules used without declaring them: 27 module pairs (e.g. admission to capture; control-plane to lines, calculations, workbooks, scheduler, pdf-worker; installer and stewards to plane's `wrangler.jsonc`; installer to sheet-worker; queue to op-grades). Proposed kind: E.

A note for ARCH, deciding nothing: "Under Process4 a file belongs to the module whose entry lists the longest
matching path (build text 2, section 3), so a test file can be given to a later module by naming its path in
that module's `tests`, with no file moved."

Known, not a fault: an entry whose `uses` names a later module is refused by `check` at that module's first
job. `check` sees only imports by file path inside the product; the references above are not declared
imports, so the lane's list is their only finder.

The set-up session's own scan of literal import paths (static, dynamic and `require`, by pattern, not by a
parser) agrees: one import reaches a later module, queue to op-declarations (group 3), and these reach an
earlier module not in `uses`: queue to op-grades; journey-check to test-support, control-plane,
screens-intake, ocr-worker, op-declarations, screens-wizards, screens-investigate, screens-publish,
screens-action, site.

## 2. Owners given to files that `build/modules.json` left to no module

`build/modules.json` lists `not_product` paths (12,701 tracked files) that no module owned. Process4 gives
every file in the repository one owner: a module, a lane's folder, or the process's own named files (design
part 2, section 1). The set-up session gave each a module by the rules below, so that the list is whole; each
is ARCH's to correct.

- bundler: `release/` (the release bundles and assets `release-assemble.mjs` writes), `bio-plane/dist/`, and the
  workflows `deploy-test.yml`, `container-images.yml`, `release-sign.yml` (bundler holds the deploy and
  release scripts).
- test-support: `.github/scripts/` (the product's every-module test runner), the workflow `regression.yml`, and
  `.claude/hooks/` (the start-up hook that installs Node 26 and the packages for tests).
- plane: `bio-plane/DEPLOY.md`, `bio-plane/DEPLOY-DASHBOARD.md`, `bio-plane/SETUP.md` (plane holds bio-plane's
  package and deployment config). installer: `bio-plane/INSTALLER.md`.
- journey-check, the last module, for the whole-product files with no code of one module: `docs/`,
  `requirements/`, `build/` (the earlier processes' records, `build/modules.json` among them),
  `README.md`, `.gitignore`, `.env.example`, `.worktreeinclude`.
- Left to no module, as the process's own named files: `CLAUDE.md`, `.claude/settings.json`, `.claude/rules/`
  (the standing safety rules kept beside the approvals), `process.json`, `process/`, and
  `.github/workflows/module-tests.yml` (the required run, copied unchanged from Process4).

Points for ARCH: `build/tools/test/words-convert.test.mjs` is a test file now owned through journey-check's
`files`, not its `tests`, so no module's run includes it. `release/` and `bio-plane/dist/` hold committed
built files, which design part 2, section 6 says are never committed.

## 3. `public`

`build/modules.json` has no interface field. Each entry's `public` lists the module's files that another
module's code or tests import by a literal relative path, found by pattern; helpers that other modules'
tests import are among them. plane, stewards and journey-check have none. ARCH narrows or widens each.

## 4. `check` on the code as it stands

Tried once by the set-up session with the pinned tool, on the first two modules only: `check setup-words`
exits 1 with 551 disagreements (518 in the vendored `bio-plane/src/setup-words/vendor/acorn.mjs`, 33 in
its tests), and `check record-grammar` exits 1 with 59 (22 in code, 37 in tests), all "(a) a comment
disagrees with". The required run runs `check` before a module's tests, so such a module's first job fails
until its comments agree or ARCH decides otherwise. The other 176 modules were not tried.

## 5. The process config's commands

- `test_command` is `node --import ./bio-plane/test/platform-sqlite.mjs --test`: the same command
  `.github/scripts/module-tests.mjs` runs for each module, written directly so that no product file
  changed; the required run appends the module's test files. pdf-worker's own `npm test` adds
  `--test-force-exit --test-concurrency=1`, which this command does not.
- `walk.build_and_serve` (`npm --prefix bio-plane run build && npm --prefix bio-plane run dev`) serves the
  plane alone, and takes no copy's name.
- `walk.run_steps` (`node bio-plane/src/journey-check/journey.mjs --live`) takes a copy's address and walks
  every journey; it does not take named steps.
- `deploy.deploy` (`node bio-plane/scripts/deploy.mjs`) takes the copy's name first, then a version and an
  asset, with `--test-instance`; the container workers need `node bio-plane/scripts/deploy-fleet.mjs
  <member> --instance <name> --test-instance` (Docker), and site, newgroup and stewards `wrangler deploy`.
  No one command deploys a whole copy by its name.
- `deploy.seed`: no command. Seeding is the plane's admin operations `instancegroupseed`, `officesseed`,
  `seatsseed`.
- `deploy.remove`: no command. The installer's remove mode and the archived
  `build/plan/archive/R085/wipe-0.85.0.mjs` delete scripts, container applications, R2 objects and buckets by
  REST.

No new script was written.
