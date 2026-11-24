Length: 24 lines. Last section: "Settled with ARCH".

# The plane-scope lane's folder

The plane-scope lane of civicsmith: a standing design responsibility for the plane module's scope, opened on the owner's decision of 23 Nov 2026 ("open a lane for the plane module's scope, so I can understand it and fix it"). Its design decisions rank 5 on `process/ranking.md`.

## What is here

- `research/`: the lane's research. Its index, `research/README.md`, gives one line for each file; every later session of the lane reads that index first and adds to it. `research/evidence-rules.md` holds the rules every finding is held to (measured, read, or not checked).
- `design.md`: the lane's design: each module's promises proven by its own tests, plane's 120 whole-program tests moved to the modules they prove, the arm routing in the door, the re-stacking, and the plan as one sequence; proof modules after plane only for a test whose route fails. Rewritten 24 Nov 2026 by lane #3; sent to ARCH the same day.
- `page/plane-scope.html`: the source of the first design page.

## Design pages

- [Civicsmith Plane Scope](https://claude.ai/artifact/X5PJuyRPjLtP9G7Wsry37L): what plane holds, what the research found about its 120 borrowed tests, and the lane's current recommendation. Rewritten 24 Nov 2026 by lane #3.
- [Civicsmith layers: research report](https://claude.ai/artifact/HA4xENnaXEjX8cx4SQeAoL): the report of the layer research the owner asked for on 23 Nov 2026: the five layers (model, middleware, front door, launcher, UI) as they are stacked today, what that costs, the re-stacked architecture and the plan. A document on claude.ai, filled in stage by stage; the evidence behind each section is in `research/`.

## Settled with ARCH

- ARCH #11, 23 Nov 2026: option B can be built as given, on the terms recorded in `design.md`; nothing is built while the owner's halt stands or before he chooses.
- ARCH #11, 23 Nov 2026: the layer research goes on as the owner asked; its proposal, with the dependency facts behind each move, goes to ARCH before anything appears on the owner's page as buildable. The module order and interfaces are ARCH's. The fault in `bio-plane/test/declared-ops.mjs` (it reads later modules' files) is placed against `test-support`.
- ARCH #11, 24 Nov 2026: the layer proposal (PR 1310) can be built as given, B first and then the re-stacking in the lane's steps, on eight conditions recorded in `design.md` section 6 (splits 8a and 8b added; steps 7 to 12 only on the owner's choice of the re-stacking).
- ARCH #11, 24 Nov 2026: the design of lane #3 (each module's promises proven by its own tests; the routing in the door; the plan as one sequence) can be built as given, on the conditions recorded in `design.md` section 6; it is built on main's code after the owner's drop of tranche t1, each route proven again at its own job.
- ARCH #12, 24 Nov 2026, after sending the design back once (one-merge moves; reaches made by path; two slips): the reworked design can be built as given; the deployable program's files go to the top module (replacing condition 6), the extractor and the test runners to journey-check, bundler's discovery to release (`design.md` section 6).
