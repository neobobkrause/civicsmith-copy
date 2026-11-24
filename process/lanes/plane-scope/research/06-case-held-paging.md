Length: 93 lines. Last section: "Sources read".

# Case study: `r10-held-paging.test.mjs` (screens-intake R4, cause R33, group G6)

## In plain words, for the owner

**What the screen is.** `screens-intake` draws the member's screens for bringing documents in: Add (upload a file or capture a web address), Held, Set aside, and opening a file. A **held** document is one the team has collected but nobody has yet vouched for ("released") or set aside. The **Held** screen lists them so a member can tick some and vouch for them, set them aside with a reason, or open one.

**What went wrong (re-walk 9, cause R33).** The Held list stopped at 50 rows, said "more are waiting" with no way to see them, showed everyone's documents, and a release ticked rows from every project. You had already decided (DEC-97 clause 1) that the list is per member and per project. The fix: open on "Mine", offer an "Everyone's" filter, and add a "Show the next" button that fetches the next 50.

**What this test checks.** It files 60 documents, opens Held, and checks: page one shows 50 of the viewer's own; the "more" sentence comes with a button; the button asks for page two using the bookmark ("next") the store handed back; page two shows the other 10, none repeated; a "back" button exists; switching to "Everyone's" re-reads from page one with no member filter; a project's page asks for that project.

**Why it starts the whole plane program: convenience, not need.** Nothing in this behaviour depends on Cloudflare's real runtime. The diagnosis that found the cause marked its platform check "None (a plane read over the DO's table)", and the job that wrote the test recorded "Platform N" (none). The test boots the real Worker because the screens-intake job had just built `realplane.mjs` for three *other* causes in the same batch, and K4990 forbids a hand-made stand-in for the store's answer. But screens-intake already has a real store that runs in plain Node, and its own `t51-fix4.test.mjs` already files 60 real documents and opens Held over it. It stops one step short: it never presses "next" or the filter.

**Verdict: (c).** This can be a plain screens-intake test with only earlier modules. It means about 20 lines added to `t51-fix4.test.mjs`. Almost nothing is lost, and the test would drop from about 30 seconds to a few seconds. Confidence: high.

**If it fails during plane's job.** It is almost never plane's fault. The screen's paging belongs to screens-intake (183). The bookmark and the member filter belong to `capture` (48), which already proves them on its own. Under Process4, plane's job would report the flaw to ARCH. ARCH places it against screens-intake or capture, and plane's job stays blocked until that module's fix merges. The test sits with plane today only because it starts plane's program.

## 1. What the test checks, and the requirement it proves

Test file: `bio-plane/test/m/screens-intake/r10-held-paging.test.mjs` (104 lines).
- Setup `:18-34`: the founder signs in through the real door (`realplane.mjs:29-35`). Then 60 times it does `captureupload` of a small text file through the door (`:26`) and files it with the screen's own `CAPTURE_SCREEN.parts.promoteDocument` (`:28`), using a kit whose `call` goes to the door (`:20-22`). Then `whoami` (`:32`).
- `heldPage` `:37-44`: opens the served page with interface-shell's harness in Node (`page.mjs:83-88`), with every op forwarded to Miniflare (`realplane.mjs:38-46`). It records each `heldcaptures` answer.
- Test 1 `:49-72`: one page read sending `member` = viewer and `limit` 50; 50 rows drawn; the real answer has `truncated: true` and a string `next`; a `[data-more]` sentence and a `[data-after]` door; pressing it sends `after` = `next`, still with `member`; 10 rows; 60 distinct overall; no "more" sentence; a `[data-back]` door.
- Test 2 `:74-95`: the `ch-who` choice changed to "all" re-reads with no `member` and no `after`; 50 rows; changed back, it sends `member` again.
- Test 3 `:97-104`: `/app/held/PROJ-2026-0001-pothole-repairs-at` sends `project` and `member`, and draws no sentence or door. The project does not exist. Only the request and an empty list are checked.

Requirement, `process/modules/screens-intake.md:20` (R4), its fix-round-10 clause: "(Fix round 10, cause 33; K5056; DEC-97 clause 1: per member and per project) The list is per member and per project ... it opens on the viewer's own captures ("mine") with a filter to everyone's in her team, sent as `member`, and it pages by the answer's `after` and `next` ... Test: with 60 held, the first page names 50, the door to the next sends `after` equal to the answer's `next` and shows the other 10; "mine" sends `member`; a project's page carries the project." R70 (`screens-intake.md:81`) restates the drawn list (DEC-435) and asks for each state "through the world's real `heldcaptures`".

G6 is a group of re-walk 9's causes (R29-R34), diagnosed in `build/plan/diagnosis-R10-c.md`. R33 is at its "## R33 (G6)" section. Placement: `build/plan/placement-R10-c.md:38`, `:46`. Ruling K5056 (`build/rulings.md:5051`): "R33 is Bob's DEC-97 clause 1 ... paging is a screen detail."

**Whose code does the behaviour.**
- Screen (screens-intake 183): `bio-plane/src/screens-intake/held.mjs:9-20` (`heldReads`: `member` for "mine", `after` from the kept page); `:138-148` (the "more" sentence only with its door, `data-after` = `next`, `data-back`); `:150-152` (the `ch-who` choice); `:283-293` (the act: next or back, `limit: 50`, `fields: "picker"`, `project`, `member`, `after`).
- Paging and member filter (capture 48): `bio-plane/src/capture/index.mjs:2069` `heldCaptures({member, project, ..., limit, after, viewer, ...})`; the cursor is checked at `:2087-2088`; `truncated` and `next` are answered at `:2163-2164` and `:2190-2191`; the op map is at `:3843`.
- Door: stamps `viewer` from the session and routes `heldcaptures` to capture (control-plane 195 and plane 196 here; store-request's Node door does the same, `bio-plane/test/m/store-request/door.mjs:345`).
- Setup only: `captureupload` (acquisition and capture through the door), `allocid` and `promote`, called by screens-intake's `promoteDocument`.

## 2. What screens-intake does, and what held and paging are

screens-intake (`process/modules/order.txt:183`) is a drawing module. Its public files are `bio-plane/src/screens-intake/index.mjs` and `archive.mjs` (`process/modules/screens-intake.json`). It draws Add and capture, Held, Set aside, Archive and open-file. It holds no data. Every fact comes from an op answered by an owner module, here mostly `capture`.

"Held" means captured and filed, but not yet vouched for or set aside (R4, R13). "Paging" means the store answers at most `limit` rows plus a bookmark (`next`). The screen sends that bookmark back as `after` to get the following rows.

## 3. Why the test starts plane's program

What `realplane.mjs` starts (`:18-27`): Miniflare (workerd) with `scriptPath` = `bio-plane/src/plane/index.mjs`, the `Store` Durable Object on SQLite, the R2 buckets `CAPTURES` and `PUBLISHED`, and secret bindings.

Facts of the real runtime the behaviour depends on: **none found.**
- `diagnosis-R10-c.md`, R33: "**Platform check.** None (a plane read over the DO's table)." Its planned failing-first test was "the screen test harness over the scripted plane, then once over the real `capture` for the cursor", plus a capture-side test with a "real store from `plane/fixture.mjs`", in plain Node.
- `placement-R10-c.md:3` defines platform codes (N none, P workerd/Miniflare, L live copy). The screens-intake job record says, for R33, "(4) Platform N, L (more than 50 held)" (`build/jobs/T51/screens-intake.md:768`). L means the live copy is re-walked with more than 50 held. It does not mean workerd.
- The screen code runs in Node either way (`page.mjs:83-88`, interface-shell's `boot`). Only the op answers come from workerd.

Why the real plane was used anyway (`build/jobs/T51/screens-intake.md:758`, `:768`): the batch-3 job (B51) fixed R5, R35b, R36, R14 and R33 together. It wrote "a new test helper `realplane.mjs` (the REAL plane, Miniflare, behind the served page)" to serve "the three real-plane test files": `r10-pending`, `r10-open-file`, `r10-refused-kind`, and this one. The helper's header cites K4990, K4993 and K4995: "a test takes another module's answer from the provider's own code, never builds it" (`realplane.mjs:1-4`).

The record also gives the gap that let R33 through: "the double answered `truncated: true` with no `next`, and no test paged". In the same job, `t51-fix4.test.mjs`'s double was made to page as capture R77 does. So the real plane was a reachable harness that guarantees real answers. It was not chosen because the behaviour needs workerd.

Git history: this repository copy has a squashed history. `git log --follow` on the test and on `realplane.mjs` shows only bulk commits from 22-23 Nov 2026 (`42995c5f`, `3a007549`, `867992f4`, `c6b16a57`, `08e126c7`), none about this test. The reasons above come from the job record, the diagnosis and the placement instead.

## 4. Could screens-intake prove it on its own?

screens-intake's tests (`bio-plane/test/m/screens-intake/`, about 50 files) already run over a real store in plain Node.
- `page.mjs:24-27`: `members()` builds `storeWorld()` from `../store-request/fixtures.mjs`. That is store-request (175), wrapping store-assembly's (174) world, the whole assembled store on Node SQLite with the door's stamps. Both come before screens-intake (183). `store-request` is in screens-intake's `uses` (`process/modules/screens-intake.json`).
- `page.mjs:94-100`: `openWorld()` opens a screen over that store.
- `t51-fix4.test.mjs:6-9`: "Fix round 10 (K5054): over the REAL store. A document held is held by real acts (... an upload and its promotion)". `:248-251` files `n` documents through `world.recipes.hold`, which does `captureupload`, `allocid` and `promote` through the door (`store-request/door.mjs:695-706`).
- `t51-fix4.test.mjs:273-290`: with **60 documents held**, it opens `/app/held` and asserts the picker read is `{limit:"50", fields:"picker", member:"mai"}`, 50 rows drawn, and the "more" sentence. That is half of this test already. The other half is to press `[data-after]`, then check `after` = the real `next`, 10 rows, 60 distinct, no sentence, a back door, then the `ch-who` change and the project page. Each uses only harness calls this file already uses (`press`, `main`, `p.byOp`).
- The paging itself is proven at its owner. `bio-plane/test/m/capture/archive.test.mjs:204-220` holds 60, reads `limit` 50, gets `truncated: true` and a `next`, and `next` returns exactly the other 10 in order. `:145-147` proves the `member` and `project` filters.

What would be lost by moving it:
- workerd's own SQLite and R2 under the 60 uploads, and plane's `index.mjs` routing and control-plane's real `makeFetch` for `heldcaptures`. Neither is part of R4. Whole-door routing of `heldcaptures` is plane's and control-plane's to prove in their own tests.
- The setup's use of the screen's own `promoteDocument` instead of the store recipe. If wanted, the same kit can call `world.door` (as `t51-fix4.test.mjs:256-266` already does for `crucial`).
- Nothing about the paging behaviour.

What it would take: about 20 lines in `t51-fix4.test.mjs` (or a new file beside it using `members` and `openWorld`). Then delete `r10-held-paging.test.mjs`, and remove it from `process/modules/plane.json:103`. `realplane.mjs` stays while the other three files use it.

**Verdict: (c)**, high confidence. It needs a real store answer, and that store is already in the owner's test toolkit from earlier modules. It does not need plane's runtime. If one counts store-request's `storeWorld` as a "whole-program store", it sits at the (b)/(c) boundary. But screens-intake already uses that store in its own tests, so nothing new is needed and the test belongs with the module.

## 5. If it fails during plane's job

Likely causes, by owner:
- **screens-intake** (`held.mjs`): it does not send `member` or `after`, or draws the sentence without its door. These are the assertions of tests 1-3.
- **capture** (`capture/index.mjs:2069-2191`): a wrong `next`, a repeated or missing row, or the `member` filter.
- **plane or control-plane:** routing, the `viewer` stamp, sign-in (`realplane.mjs:29-35`), or the boot of the Store.
- **acquisition, capture or promote:** a setup failure on upload (`:27`, `:29`).

Only the third group is plane's. Under Process4, as given in this brief (design part 2, section 3; the process repository is not cloned here, so I did not read its text), a job that finds a flaw in another module reports it to ARCH. ARCH places it against that module, and the job is recorded blocked until that module merges.

So a red here in plane's job most likely blocks plane on a screens-intake or capture fix that those modules' own tests could have caught earlier. This test would have caught a screens-intake regression only at module 196. A regression of the screen half shows up in screens-intake's own job only if that job also runs the plane-owned test, which is unknown for the current runner.

Run: I ran this file alone once (repository root, `node --import ./bio-plane/test/platform-sqlite.mjs --test --test-force-exit <file>`). Result: 3 of 3 pass, 29.7 s wall. Test 1 took 27.8 s, nearly all of it booting Miniflare and the 60 uploads. Tests 2 and 3 took 0.3 s and 0.04 s.

## Sources read

`bio-plane/test/m/screens-intake/r10-held-paging.test.mjs`, `realplane.mjs`, `page.mjs:24-27,83-100`, `t51-fix4.test.mjs:1-12,245-330`; `bio-plane/src/screens-intake/held.mjs` (lines cited); `bio-plane/src/capture/index.mjs:2069-2191,3843`; `bio-plane/test/m/capture/archive.test.mjs:145-147,204-220`; `bio-plane/test/m/store-request/fixtures.mjs:1-60`, `door.mjs:345,695-706`; `process/modules/screens-intake.md` (R4, R70), `screens-intake.json`, `plane.json:103`, `order.txt`; `build/plan/diagnosis-R10-c.md` (R33), `placement-R10-c.md:3,38,46`; `build/jobs/T51/screens-intake.md:756-786`; `build/rulings.md` K4426, K4428, K4990, K4993, K4995, K5056.
