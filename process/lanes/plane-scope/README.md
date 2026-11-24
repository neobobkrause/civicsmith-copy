Length: 18 lines. Last section: "Settled with ARCH".

# The plane-scope lane's folder

The plane-scope lane of civicsmith: a standing design responsibility for the plane module's scope, opened on the owner's decision of 23 Nov 2026 ("open a lane for the plane module's scope, so I can understand it and fix it"). Its design decisions rank 5 on `process/ranking.md`.

## What is here

- `research/`: the lane's research. Its index, `research/README.md`, gives one line for each file; every later session of the lane reads that index first and adds to it. `research/evidence-rules.md` holds the rules every finding is held to (measured, read, or not checked).
- `design.md`: the lane's design: plane's scope (option B with ARCH's terms), the re-stacking's design proven on a scratch copy, the lane's recommendation (B and the capture move first; the re-stacking after, in steps, on the owner's choice), the 13-step plan. Rewritten 24 Nov 2026 by lane #2.
- `page/plane-scope.html`: the source of the first design page.

## Design pages

- [Civicsmith Plane Scope](https://claude.ai/artifact/X5PJuyRPjLtP9G7Wsry37L): what plane holds and why, the choices A, B and C, and the lane's first recommendation. Published 23 Nov 2026.
- [Civicsmith layers: research report](https://claude.ai/artifact/HA4xENnaXEjX8cx4SQeAoL): the report of the layer research the owner asked for on 23 Nov 2026: the five layers (model, middleware, front door, launcher, UI) as they are stacked today, what that costs, the re-stacked architecture and the plan. A document on claude.ai, filled in stage by stage; the evidence behind each section is in `research/`.

## Settled with ARCH

- ARCH #11, 23 Nov 2026: option B can be built as given, on the terms recorded in `design.md`; nothing is built while the owner's halt stands or before he chooses.
- ARCH #11, 23 Nov 2026: the layer research goes on as the owner asked; its proposal, with the dependency facts behind each move, goes to ARCH before anything appears on the owner's page as buildable. The module order and interfaces are ARCH's. The fault in `bio-plane/test/declared-ops.mjs` (it reads later modules' files) is placed against `test-support`.
