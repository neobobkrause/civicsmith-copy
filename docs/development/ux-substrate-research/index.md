# The ux lane's research area: index

Read this first. This folder is the ux lane's ground truth. It holds what the lane researched about the canon, the existing code and best practice in its area, with citations. Every later session and every `lane ask` worker reads it before deciding. A decision that departs from it says why.

This folder is research, not build input. Nothing in the product's build reads it, and it holds no sources or generators. Those live in `docs/development/ux-substrate/`, and the design documents are claude.ai artifacts (listed in that folder's `README.md`).

Researched against tranche `705f8823d1` (6 Nov 2026), with the process pinned at `56f8c932`. A citation of the form `file:line` refers to that commit.

| file | what it holds |
| --- | --- |
| [`qualification-2026-11-06.md`](qualification-2026-11-06.md) | The dated qualification record: what was researched, by which workers, the sources, the reconciled ground truth, and the open questions. **Read it second.** |
| [`canon-process.md`](canon-process.md) | The process canon. It covers the Foundations' lane lines (SES-14, SES-15, SES-19 to SES-23, P17), bob.md rule 5, and how `lane.mjs` starts, qualifies, asks, records artifacts and ends. It also covers the gate's lane-only path, lane-charters §1 and §3, the CLAUDE.md lane rule and its history, the config and ledger rows, and the old UX-DESIGN charter (HANDOFF §1–§7, which parts still hold). It quotes K945, K3053, K3460 and K5295 exactly. |
| [`canon-product.md`](canon-product.md) | The product canon. The appendix covers every DEC from DEC-96 to DEC-489 (394 entries, none open; 81 are Bob's). It also covers the canon documents that constrain design and wording, including Bob's verbatim UX principles of 28 Jul (UI-KICKOFF.md:158-215), and his UX K-rulings. Further sections cover the stream's amendments to `docs/architecture/` and stale canon text. |
| [`requirements.md`](requirements.md) | The requirements of the modules the lane serves. ux-design R1–R3 come first, followed by about 45 modules that bind words, screens, the registry, the library, the visual language, the installer and the front door. It also lists the requirements still owed to UX, the missing icons and the pin drift. |
| [`code.md`](code.md) | The existing code. It has all 90 files in `docs/development/ux-substrate/` (source or generated, builder, readers), the build graph, the generated config rows, and product readers with file:line. It ends with 14 health findings, among them `layouts.html` over the size cap, the `escalationdecline` drift, the 15 failures in `check_library.py`, unread files and stale `lane/ux-*` branches. |
| [`artifacts.md`](artifacts.md) | The nine design artifacts, read whole. It holds the 58 principles and 7 voice traits verbatim, brand words, the name, the 27 journeys, visual tokens, the 91 screens and their states, and the measures map. It also records every question to Bob and its ruling, and the contradictions and drift between artifacts. |
| [`best-practice.md`](best-practice.md) | Current public best practice, cited with dates: WCAG 2.2, ADA Title II and 508, plain language (ISO 24495-1, GOV.UK), GOV.UK and USWDS patterns, DTCG design tokens, AI disclosure (EU AI Act Art. 50, NIST), C2PA, showing uncertainty, onboarding and front doors, and usability research. For each, it says where the product follows or departs. |
| [`wcag-gaps.md`](wcag-gaps.md) | The WCAG 2.2 AA gaps as a list to schedule: the lane's own (W1–W8) and the modules' (M1–M4), each with its criterion, where it is and its size, plus the contractions call still open (6 Nov). |

## Keeping it true

- Research a question this folder does not answer, with workers as at qualification, and record the finding here.
- Revise a finding that the canon or the code has overtaken, and keep this index true.
- A change here lands as a lane-only pull request into `tranche`.
- A new qualification adds a new dated `qualification-<YYYY-MM-DD>.md`. Earlier records are kept.
