# Investigation lane: research area

The research area of the `investigation` design lane (`process/config.json` `lanes`; BD-2, `DECISIONS.md`:28). The lane covers INVESTIGATION-DESIGN's area (K2076): the investigation engine, and the project treated as an investigation. Its canon is `docs/architecture/BIO_Investigation_v0_1.md`, which Bob approved (K2417) and BOB placed (K2420).

**Read this file first.** Then read the latest `qualification-*.md`, then whichever topic file the question needs. A decision that departs from what these files hold says why.

Nothing here is read by the build. Sources and generators go in `docs/development/investigation-design/`, and design documents are claude.ai artifacts.

| File | What it holds |
| --- | --- |
| `qualification-2026-11-07.md` | The dated qualification record. It covers what was researched and by which workers, the sources (including those that could not be read), the open questions, and the ground truth the lane now holds. |
| `process-canon.md` | The Process3 rules that govern the lane. Covers the Foundations SES-14 and SES-19 to SES-23 (verbatim), the pinned `.process` lane rows, the gate's lane-only path, how asks arrive and what an answer must hold, and what counts as Bob's decision. Also the earlier lane's history (D, H and K numbering) and eleven conflicts between sources. |
| `canon.md` | The product's principles that bind investigation design, with their ranking. Has `BIO_Investigation_v0_1.md` summarised section by section, and the other architecture documents that define investigation terms. Ends with conflicts and stale points (Action v0.1 vs v0.2, the three meanings of "objective", the four names for a question, regrade, DEC-84). |
| `requirements.md` | Module by module, what the requirements of the modules this area serves ask of it: investigation, steps, question-explorer, reading-guides, intent, inquiry, hypotheses, leg-earning, contradiction, observation-log, skills, case-*, screens and providers. Includes ledger status and gaps: no ledger entry for `investigation-design`, `steps`, `hypotheses`, `observation-log`, `retrieval` or `project-roster`, and stale cross-references. |
| `prior-design.md` | The earlier INVESTIGATION-DESIGN lane, read from branch `design/investigation` @ 87134cce. Holds the design of record summarised, the D1–D66 register with status, H1–H43 with their fold status, the rulings traced, the T41 draft and the K2075 mapping, and N1272's real state. |
| `code.md` | A map of the code that implements the design (`bio-plane/src/investigation/`, steps, question-explorer, reading-guides and the modules they extend), with file and line. Lists gaps between the design of record and the code, and confirms that no build reads the lane folder. |
| `best-practice.md` | Current best practice in investigation method and tooling, with 24 cited public sources. Covers structured analytic techniques (ACH, ICD 203, key assumptions, source grading), open-source investigation (the Berkeley Protocol, Bellingcat), journalism (Story-Based Inquiry, IFCN), provenance and argument (W3C PROV, Toulmin, Wigmore), bias and red teaming, and AI-assisted investigation (NIST AI 600-1, newsroom guidance). Its §7 table marks where Civicsmith follows, departs or lacks. |

## Citation keys used across the files

- **INV** is `docs/architecture/BIO_Investigation_v0_1.md`.
- **F** is the Process3 Foundations, https://claude.ai/artifact/RVZ8szbF1UHHSETkcGrKw8, cited by section.
- **PR** is the pinned `.process`.
- **rulings** is `build/rulings.md`.
- **old lane** is branch `design/investigation` @ 87134cce.

Each file states its other keys at its head. The research files cite the tree at `617b48f5`, and the record cites `a480dd0e`. Line numbers may drift as the tranche moves.
