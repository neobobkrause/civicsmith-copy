Length: 132 lines. Last section: "6. Gaps and things not found".

# Plane scope research 01: what the founding documents say the plane is

Written 23 Nov 2026 by a research worker for the plane-scope lane, on branch `work/plane-scope-research`. Read-only research; it decides nothing. Terms used below:

- **Plane**: the main Cloudflare Worker of one copy of civicsmith (`bio-plane`), plus the one Durable Object (a small server with its own SQLite database, here the class `Store`) that holds the record.
- **Composition root**: the one place in a program that builds all the parts and wires them together. Nothing else builds them.
- **workerd / Miniflare**: Cloudflare's real runtime, run locally. "In node" means plain Node.js with stand-ins for Cloudflare.
- **Whole-plane test**: a test that boots the entire plane (every module, as deployed) and talks to it through its front door, instead of testing one module alone.
- **Rn**: requirement number n in a module's file under `process/modules/`.

Ranking (`process/ranking.md`): mission (Roadmap §§1-5), then Design Requirements and Bob's rulings, then construct designs (System Design, Distribution), then module requirements, then ARCH's decisions. A lower one never overrides a higher one.

## 1. What the canon says the plane is

**The canon never uses the words "composition root" or "deployable unit".** Searched `docs/architecture/*.md`: not found. Those are the module file's own words. What the canon does say:

- **One instance = one plane in front of one record store.** `docs/architecture/BIO_System_Design.md` §2: "The instance is a **plane** (a Worker) fronting a **Durable Object with SQLite** that holds the **record**, with captured bytes in **R2**." The plane "captures", "extracts content", derives meaning; members author inquiries and cases; "The instance keeps itself current unattended (a scheduler on one reconciling alarm), tells the truth about what it is and can do, and can be left, mirrored and outlived."
- **The plane is the Worker that holds the doors and the op table.** `BIO_System_Design.md` §6 (runtime shape): "`bio-plane` — the Worker (`src/index.mjs`, the control plane and the OPS table) and the Durable Object `Store` (`src/store.mjs`, `src/schema.mjs`) with SQLite; bindings `CAPTURES` and `PUBLISHED` (R2), `PDF_WORKER`, `OCR_WORKER`, `AGENT_WORKER`, `SELF`." (Written before the module split; the file names are the old ones.) The fleet members (pdf-worker, ocr-worker, agent-worker) sit "beside it".
- **Distribution is the product.** `BIO_System_Design.md` §3, construct 15 ("Distribution: installer, releases, fleet, multi-instance"): "the distribution model IS the product — sovereign instances, not a hosted service". Its state column (not canon, `requirements/README.md`) says "the plane release is signed and carries the fleet" and "the plane the installer uploads is BOUND to the fleet members it uploads beside it".
- **The sovereign instance, spelled out.** `docs/architecture/BIO_Distribution_v0_1.md` §2: "An instance is: one plane Worker (`bio-plane`, the control plane and the OPS table) fronting one Durable Object `Store` with SQLite that holds the record; two R2 buckets ...; service bindings to the fleet members ...; the member surfaces (`civicos-ui`) proxied to it; a front page." What that boundary buys "is the whole product's trust: a group's evidence never transits a server we run; a group can be left, mirrored and outlived".
- **Every copy must behave as the record says, and prove it.** `BIO_Distribution_v0_1.md` §1: "Every rule below exists so that an instance installed by a stranger, into an account we never see, behaves exactly as the record describes and can prove it."
- **A deploy is believed only when read back.** `BIO_Distribution_v0_1.md` §6, "The deploy-to-serve ladder": "**A deploy verified is not a build serving** (D-108)". Eight rungs, "every rung read back rather than believed": the account pinned; no deploy from a tree main has not seen; version skew refused; "The bytes are read back and hashed against the signed asset"; the deploy settings (including the plane's own `limits.subrequests`, "a figure the plane states with its reason in `wrangler.jsonc`") read back; the rollout waited for; live verification in the scratch namespace "never the real record", where the canary `op=livefire` speaks a `verdict` (`pass`/`fail`) naming each failed assertion; and "Each part's OWN build, read where it runs" (the Durable Object reports its own `storeVersion`, separate from the Worker's `version`). §6 closes: "If a live probe contradicts the suite, establish which build answered before believing either".
- **The release is a signed statement about bytes.** `BIO_Distribution_v0_1.md` §3: "A release is a signed statement about bytes, and nothing about a release is decided by what a tool said — only by what was read back." The release object lists the plane's `sha256` and every fleet member's.
- **Where the plane's "Satisfies" line comes from.** `process/modules/plane.md` §Satisfies cites "`BIO_System_Design.md` §3, construct 15 (distribution: one instance, one deployable plane) and §2 (the trustworthiness of the record: a store written before opens after)". The bracketed phrases are paraphrases, not quotations. "One deployable plane" and "a store written before opens after" were searched for in `docs/architecture/`: not found. The nearest canon words are "The product is therefore **the trustworthiness of the record**" (which is in `BIO_System_Design.md` §1, not §2) and Distribution §1-§2 above. The idea that an older store must open on a newer plane is stated in requirements (`store-assembly` R3: "so a store written by any earlier release opens") and in ARCH's decision "Stores written by past releases", not in the construct designs read here.

## 2. What the plane module holds today

### Its own code

From `process/modules/plane.json` `files` and the tree:

| file | lines | what it is |
| --- | --- | --- |
| `bio-plane/src/plane/store.mjs` | 105 | the Durable Object class `Store`: calls `store-assembly`'s `assembleStore`, retires rooms of another generation, RPC methods (`ask`, `draft`, `dispatchMemberRun`, `groupFields`), alarm hand-off to `scheduler`, the heal on each request, timing headers |
| `bio-plane/src/plane/index.mjs` | 71 | the Worker's entry: `default { fetch, scheduled }` and `{ Store }` |
| `bio-plane/src/plane/door.mjs` | 131 | the hooks the Worker's door calls (public op, gated op, instance group) |
| `bio-plane/src/plane/watchdog.mjs` | 45 | the 5-minute cron's check of the `bio` and `scratch` rooms |
| `bio-plane/src/plane/arrival.mjs` | 19 | small helper |
| `bio-plane/scripts/build-plane.mjs` | 24 | builds the plane bundle (moved from `bundler` R16, now plane R115) |
| `bio-plane/wrangler.jsonc` | config | the deployment config: entry, bindings, subrequest and CPU limits, one cron |
| `bio-plane/dist/`, `DEPLOY.md`, `SETUP.md` and 3 more | | build output and deploy notes |

About 395 lines of code in all. Its Purpose (`process/modules/plane.md` §Purpose) still says it "builds every module on one Durable Object's storage, in the modules' order, runs their migrations before any request, ... assembles the one route map": that sentence predates the split and now describes `store-assembly`. Its last line still holds: "It holds no construct of its own: no table, no check row, no op and no answer."

Note: R1 ("`Store` calls `assembleStore`") is marked [not yet met], but `bio-plane/src/plane/store.mjs:41` already reads `this.#assembled = assembleStore(ctx, env, { deliver: deliverOwedRender })`. Not verified further here.

### What moved to store-assembly

`build/requirements/plane.md` (the earlier process's file, 114 requirement ids) against `process/modules/plane.md` (39 live ids, "Next number: 117"). 77 old ids are marked retired, every one "moved to `store-assembly` Rn" (76 citing K5046; R10 moved to `store-assembly` R100 by K5059). The 37 left are plane's today, plus R115 and R116 added on 22 Nov 2026. They are:

- **Building and migrating every module** (old R2, R3, R5): the construction order, the migration pass inside `blockConcurrencyWhile` ("so a store written by any earlier release opens", now `store-assembly` R3), the route map.
- **Every "the composition root composes X" requirement** (old R11-R41, R44, R45, R47, R49-R53, R57-R61): local-facts, docket, accepted-work, case-checker, case-import, wizard-scripts, file-safety, ai-use, publish-schedule, doorbell, case-account, the T45 action modules and others, each at its place.
- **The store's own services** (old R65-R110 range: the ask/draft/transcription doors, the owed-work ledger, declarations, owner map), now `store-assembly` R43-R84 and, after the size split, `store-services`.

The ruling is K5046 (`build/rulings.md`, 2026-10-25): "a new module `store-assembly` takes plane's composition body ... `assembleStore(ctx, env, {deliver})` holds the constructor body, `#migrate`, `routes` and `#dispatch` with plane's Worker-free files ... plane keeps `Store extends DurableObject` (calling it), `index.mjs` and `door.mjs`; split by copy, then delete (K624)." Its reason: "The screens' tests talk to the real store": a store that runs in plain node (`storeWorld()`) so screen tests can use the real store, not a hand-written fake.

So **the composition itself (building every module) is now store-assembly's.** Plane is the shell that puts that assembled store on Cloudflare: the Durable Object class, the Worker entry, the door hooks, the cron, the config and the build.

### Plane's 39 requirements, in two groups

**Group A, about the plane's own shell (27):** the class, the entry, the hooks, the config and the build.

- R1 the `Store` class calls `assembleStore`; R4 alarm is `scheduler`'s; R6 the Worker's exports; R7 `wrangler.jsonc` and `package.json` scripts; R8 the old `store.mjs`/`schema.mjs`/`src/index.mjs` gone; R9 writes no row, mints no refusal, answers no op.
- R13 subrequest ceiling stated (10000); R99 `cpu_ms` from `runtime-limits`; R27 `FILE_SCANNER` binding; R79 the `*/5` cron and `scheduled` watchdog; R103 the watchdog states when it ran.
- R95 every room via one helper, retired rooms inert; R102 any request re-arms the alarm; R78 the object states its I/O time; R96 the door's timing hook and the object's age.
- R46, R55, R62, R111, R114 the `Store`'s RPC methods (`dispatchMemberRun`, trace headers, `groupFields`, `ask`, `draft`); R76 the gated hook can defer a reading; R112 `pagetranscribe` through the gated hook; R113 `knock` through `doorbell`'s public op.
- R56 words by key (no English in plane's files); R64 the build has no render step; R115 the build writes bundle and manifest; R116 `dist/` holds no committed file.

**Group B, about how the whole plane, or another module inside it, behaves (12):** these are proofs that need the whole product booted, usually on workerd. The behaviour proved belongs to other modules.

- R42 `hypotheses`' renumbering and every boot migration run on workerd with no `TEMP` table (the `hypotheses` R23 test, moved here by K2950 "since only the plane's `Store` composes every migration").
- R43, R54 the whole bundle's start-up time within `bundler`'s 500 ms budget (the cost is other modules' top-level work).
- R48 the composed page's screens are the nine screens modules'.
- R63 the 503 under parallel reads: diagnose which layer answers it (Worker, admission window, object queue, binding); a cause in another module is "a REPORT to BOB ... not fixed here".
- R84 large sheets read whole on the platform (capture, reading, workbooks); R85 an oversized workbook refused at the real door (`workbooks`); R86 classification through all 17 types unchanged (`docprofile`); R88 a 25,000-row money ingest run to its end by the alarm (`calculations`, `scheduler`); R89 a failed finding copy healed by the alarm (`ratification`, `publication`); R93 twelve cheap reads stay fast while the alarm runs (`reading-pipeline`).
- R100 the object's memory as a shared total (a figure of `runtime-limits`, proved by reading the largest accepted file through the plane): partly the plane's own limit, partly other modules' behaviour.

### The tests plane holds

`process/modules/plane.json` lists 105 test paths; one is plane's own folder `bio-plane/test/m/plane/` (about 80 files, many of them Group B proofs: `g41-shape`, `g44-shape`, `g48-classify`, `g55-alarm-l`, `g57-heal`, `r7-contention`, `l75`-`l79`, the `r10-*` reading tests). The other 104 sit in other modules' folders: control-plane 53 (seam, walk and end-to-end files), top-level and `test/system/` 11 (with `migrate-released.test.mjs`), screens-inquiry 7, screens-intake 7 (with `realplane.mjs`, which boots `src/plane/index.mjs` in Miniflare), agent-worker 5 (with `plane-world.mjs`), capture 3, and 1-2 each from 13 more modules.

## 3. How plane came to hold other modules' tests

The history, in order (all rulings in `build/rulings.md` unless named):

1. **Plane is born as the composition root (Sept 2026).** K653 (2026-09-30), BOB-2: "the new modules as drafted (site-profiles, credentials, inquiry-grammar, action-grammar, plane)", in the T19 plan to remove the legacy `store.mjs`, `schema.mjs` and `src/index.mjs`. K617 (same day) is the size rule ("a product module whose own code passes about 4,000 lines ... is split"); it is cited as plane's basis but says nothing about plane itself. `build/layers.md` ruling 2 (Bob, 2026-09-25): "**Ops move with their construct.** Each op's handler moves at extraction into the module whose service it is. `control-plane` keeps only routing, authentication and the response envelope." So from the start every op and answer is some other module's; plane only wires.
2. **Plane is last but one in the order, so whole-plane tests point at it.** The module order rule (P4: a module may use only earlier ones) puts plane in layer 11 near the end (`build/layers.md` layer 11: "... control-plane, plane, installer-steps, installer, site, stewards, journey-check"). K861 (6) and K886 (2026-10-01): "host-governor, capture and agent-worker re-point their whole-plane tests to `src/plane/index.mjs`"; K867: "instance-setup joins T20 L11 to re-point four whole-plane tests". At that time the tests stayed in their own modules' folders and were counted as theirs.
3. **Tests that need every migration move to plane.** K2950 (2026-10-12): hypotheses' workerd test imported `plane/store.mjs`, a later module, and failed the order check; the "whole-store regression ... joins T46-62 (plane) as a test" (now plane R42).
4. **Platform-shape proofs land in plane (T51 fix rounds, Oct 2026).** K4426 (Bob, 2026-10-21): every defect gets its cause, why tests missed it, a failing-then-passing test, and "(4) where the behaviour depends on the live platform, a check at its real shape before the deploy". The only place the real platform shape exists in tests is the whole plane on workerd, so those checks became plane's: K4725 "PLANE #52 merged (G41, G44, G48, G56 proofs at the platform's shape ...)" (now R84-R86), then G55, G57, G82 (R88, R89, R93). K4781 and K4782 added the offline "whole plane in Miniflare" walk ("the seam file's way", `bio-plane/test/m/control-plane/t51-round*-seam.test.mjs`) before every live pass.
5. **K5046 / K5052 (2026-10-25) take the building out of plane.** The composition body went to `store-assembly` so that screens' tests could use the real store in node. K5052 (2): "`plane/door.mjs` stays in plane"; store-assembly's Suggestions: "`plane`'s construction tests that need no workerd move to `test/m/store-assembly/`; the workerd tests stay in `plane`." So after the split plane kept its shell **and** every test that needs workerd.
6. **Process4's module list (22 Nov 2026) gives plane the rest.** `process/decisions-arch.md` "Module list: order and ownership": "213 test files are given, by naming their paths, to the module that comes after everything they reach: whole-plane tests to `plane`, whole-product walks to `journey-check`, the declared-operations registry tests to `store-assembly`, the screen census to `control-plane` ... Twelve pieces of code work that would let some of those tests return to the module they test are owed to named modules' jobs". Why: "the list converted from the earlier process had tests reaching later modules in thirteen groups ... The order rule is part of every module's tests; a list that breaks it fails every job." This is where control-plane's 53 seam and walk files, the screens' `realplane` files and agent-worker's `plane-world` files became plane's.
7. **The same decision record gives plane the old-store proof.** "Stores written by past releases" (23 Nov 2026): `migrate-released.test.mjs` "is `plane`'s, not `release`'s. It proves that a store written by a past release opens on this plane ... (store-assembly R3, observed through the whole plane, as plane's other whole-plane tests are)". Its fixtures become captured stores of releases 0.58.0 to 0.86.0, committed as plane's test data.

In short: plane holds other modules' tests not because any canon text says the plane should own them, but because (a) the order rule sends a test to the first module after everything it touches, and (b) only the plane runs everything on the real platform. The rule that led there is an ownership rule, not a statement about what plane is for.

K1396 (2026-10-03), also cited: PLANE #20's readings stand (plane passes the Civicsmith library to `wizardRegister`). Nothing on scope.

## 4. The neighbours and where each meets plane

| module | what it is for (its Purpose) | its boundary with plane |
| --- | --- | --- |
| `store-assembly` | "The record store's assembly and the world its tests ask: it builds every module of the record store on one Durable Object's storage, in the modules' order, migrates them before any request, composes their registrations and ops maps into the one route map ... and publishes `storeWorld()`; it imports no platform module, so it runs in plain node." | Builds the store; plane hosts it. R96 forbids it importing any Cloudflare module or `plane`. Its `storeWorld()` stands in for the platform with doubles; R93 there: "the class is `plane`'s and is not in a world". So store-assembly proves the store in node; plane is the only place the store runs on the real runtime. |
| `store-services` | "The record store's own services, split from `store-assembly`": ask, draft, transcription doors, owed-work ledger, declarations, owner map. | Composed by store-assembly; plane only calls its doors through RPC (R111). |
| `control-plane` | "The instance's two doors: the Worker's HTTP entry and the record store's internal dispatch ... It decides where a call lands and who made it, never what the answer is." | Earlier than plane. Plane's Worker exports control-plane's `makeFetch` over plane's own hooks (`door.mjs`, R6), and hands `deliverOwedRender` to the store (R1). Control-plane's end-to-end walks boot the whole plane, so they are plane's tests today. |
| `release` | "The release tooling run from an operator's machine ...: one version across the fleet, a signed release ..., the stale bundles rebuilt, and a deploy of the plane or a fleet member believed only from the bytes read back. It stands after the plane and every fleet member, whose configuration and built artifacts it reads". | Placed just after plane. Plane builds its own bundle (R115) and owns its config; release reads them, signs, deploys and reads back (the Distribution §6 ladder). The old-store test was moved from release to plane. Release's own tests: the bundler folder and four `test/system/` files. |
| `journey-check` | "The release check: a Playwright walk of journeys 28 and 3 with screenshots, failing on any refusal, old page or missing screen. It is not product." `build/layers.md`: "against the installer, a local plane or a named test instance, over HTTP only; it carries no product capability, imports no module and is imported by none." | Last in the order. Tests the deployed product from outside, over HTTP. It too holds other modules' tests (26 paths: agent-worker controls, actions, answer-envelope, docket, file-safety, following, promotion, the row census), plus the earlier processes' scripts in `build/plan/` and `build/tools/` ("whole-product walks to `journey-check`"). Its tests list in `journey-check.json` shows no plane-specific file. |

The layering, then: store-assembly proves the store in node with fake platform; plane runs the real store on the real runtime locally (workerd/Miniflare); release proves the deployed bytes and the serving version; journey-check walks a running copy over HTTP like a member.

## 5. What the mission and principles say about how proof must be organised

None of these texts speaks of tests or modules directly. What bears on it:

- **The record must be trustworthy, and over-claiming is worse than missing.** `BIO_System_Design.md` §1: "The product is therefore **the trustworthiness of the record**: a group captures what a public body published and can prove later that it said what they claim. A defect that lets the record claim more than it can support is worse than a missing feature." And "**undetermined is first-class and must be stated**".
- **A probe is not a proof that something works.** `BIO_System_Design.md`, Incomplete sections, §3: "a probe proves a named thing is PRESENT, or ABSENT under the names searched — never that it WORKS (the battery's job)".
- **Believe nothing a tool said; read it back.** `BIO_Distribution_v0_1.md` §3 and §6 (quoted in section 1). The same rule applied to tests would say: a behaviour is proven where it runs as deployed, not where a stand-in runs.
- **Every copy, installed by a stranger, must behave as the record says.** `BIO_Distribution_v0_1.md` §1. And §2: a group "can be left, mirrored and outlived". A copy that updates must keep its record: an older store must open on a newer plane (stated in `store-assembly` R3 and ARCH's "Stores written by past releases", not in canon).
- **Core values and principles.** `BIO_Complete_Roadmap_v5.md` §4, value 3: "Accountability is built on credible facts. *Nothing else holds up.*" §5, principle 2: "Show your work. Always." Principle 4: "Follow the evidence wherever it goes. When the evidence changes, the findings change." Principle 5: "Credibility is demonstrated by the work. Not by credentials, title, or assertion." Read for proof: a claim of "met" should come with work anyone can rerun.
- **Quality by reproducibility, not gatekeepers.** `BIO_Design_Requirements_v2.md` Requirement 4: "Quality is enforced by publishing standards and reproducibility, not by gatekeepers." Requirement 15: "The system evolves through documented practice ... The system is subject to the same evidence-based evolution it demands of its work products."
- **Works at every scale; no single point of failure.** Requirement 2: "A single individual ... must be able to ... publish findings without requiring assistance from or approval by anyone else." Requirement 14: "No single point of failure exists in the system" and "Published work survives the dissolution of the group that produced it." Requirement 13: designed "to function under active opposition". These bear on the installed copy (it must run unattended and be honest about itself), not directly on test layout.
- **Bob's rulings on testing practice** (not canon construct designs, but rank 2 as owner rulings): K4426 (understand, test the walker's exact case, check at the platform's real shape before deploying); K4787 ("No test is 'load-dependent' ... The load of the copy shouldn't cause an error"; the suite runs alone, time-sensitive files also on one core).

## 6. Gaps and things not found

- "Composition root", "deployable unit", "one deployable plane", "a store written before opens after": not found in `docs/architecture/`. They are module-file wording.
- No canon text, ruling or ARCH decision read here says the plane module **should** own other modules' whole-plane proofs. That ownership comes from the order rule (decisions-arch, "Module list") and from workerd being available only at plane.
- The twelve "pieces of code work that would let some of those tests return to the module they test" (decisions-arch, "Module list") are not listed in that record; where they are listed was not searched.
- `process/decisions-arch.md` "Module splits for size" does not name plane (plane.md is 38,910 bytes, under the 60,000 limit). Not affected.
- `docs/development/DECISIONS.md` was not searched for K-numbers: the K rulings live in `build/rulings.md`. DEC rulings about plane: not searched.
- `plane.md` §Purpose still describes the work store-assembly now does; its `Uses` section says the composition lines "are `store-assembly`'s; this module's job prunes them". Both are stale text, noted, not judged.
