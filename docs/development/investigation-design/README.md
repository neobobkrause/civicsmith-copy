# The investigation design lane

This folder belongs to the `investigation` design lane (`process/config.json` `lanes`; BD-2, `DECISIONS.md`, 6 Nov 2026). The lane's area is INVESTIGATION-DESIGN's (K2076): the investigation engine, and the project treated as an investigation. Its canon is `docs/architecture/BIO_Investigation_v0_1.md` (K2417, K2420).

**What this folder holds.** Only what the product's build reads: sources, and generators whose outputs are built inputs to the release. Those outputs are `generated` rows in `process/config.json`, built at layer close, deploy and release, and never committed. Nothing in the build reads this folder yet, so it holds only this README.

**What it does not hold:**
- **Design documents, drafts, working notes and hand-offs** are claude.ai artifacts, recorded with `p3 lane artifact investigation`.
- **Research** is in the sibling `docs/development/investigation-design-research/`. Read its `index.md` first.
- **Decisions Bob makes** are recorded in `DECISIONS.md`, quoted with date and source. The old D, H and K numbering is retired.
