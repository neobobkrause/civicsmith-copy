# Publication lane: open asks and pending work (hand-off, 7 Nov 2026)

Written at BOB's request for the account switch (7 Nov 2026, ~05:30Z), by lane session `session_018BhcecVeBq3c6BYSyTV3Ph`, at tranche `47b14150`. The next session of this lane reads `index.md`, then this file, then `qualification-2026-11-06.md`.

## Decided since qualification (recorded; nothing owed by the lane)

| Ask or decision | Outcome | Where |
|---|---|---|
| Ask 1: ratification F1, part 1, the second signature over `docketStatement` | Recorded by BOB as decided. Same sitting, a second step after the commit, through the door op `docketrecordedition`. Ratification gains no `uses` edge. Edition 1 files an entry. Fallback: core-due (docket R9(b)). | `lanes/asks.jsonl` (state branch); requirement changes BOB's to place |
| Ask 2: F1, part 2, "Publish at…" | The held entry is signed at scheduling, with `seq`, `previous` and `date` = the UTC day of `publish_at`. Placing another public entry re-signs it in the same act. It is discarded on cancel or stop, and re-signed on a move to another day. No format change to docket R6/R24 or case-import R18. | `lanes/asks.jsonl` |
| Ask 2 extension: AI-use provenance (BD-7) | Case document `/11`: per-sentence `sid` and `origin` (`human`, `ai_edited`, `ai_kept`, `declared_ai`), plus `review: {ratified_by, standard, affirmed}`. Docket `edition` entries gain an additive `document` (doc sha). Formats up to `/10` read `not_stated`. | `lanes/asks.jsonl`; `ai-provenance-in-product.md` |
| BD-8 to BD-12 | Review standard adopted (BD-8). Declared and affirmed AI help, with per-sentence provenance as an overlay that is off by default (BD-9). Unchanged-draft split kept (BD-10). AI page in place of a contact (BD-11). The name is "Civicsmith" (BD-12). | DECISIONS.md |
| BD-13 | The investigation/publication border: the investigation lane's Q6 draft with this lane's five edits. | DECISIONS.md:112 |

## Open asks and work this lane owes

1. **Funding disclosure (BD-13, BD-14 Q9.6). Owed; not started.**
   - The investigation lane's Q9 item 6 handed "funding disclosure" to this lane. Its paper is https://claude.ai/artifact/THTtouNJzkhmHqyR4Pfa4g, at Q9.6.
   - Next:
     1. Read Q9.6 there.
     2. Research best practice for disclosing who funded an investigation and its publishers (journalism codes, the Declared Bias canon `docs/architecture/BIO_Declared_Bias_v0_1.md`, case-disclosures requirements), and add it to the research area.
     3. Propose where a case states its funding (a signed `/11` field beside `review`?), what a group must say, and what is Bob's (whether disclosure is required, and its threshold).
   - Coordinate with the `/11` format so the signed format changes once (BD-7's rule).
2. **IV-5 (from the investigation lane, via BOB): a case states each look's parameters.**
   - Awaiting the proposal.
   - Ties to BD-14 Q9.3 (search parameters recorded on each look). The investigation lane owns the record of a look. This lane owns how a case states it (BD-13).
   - Also fold into `/11` if possible.
3. **IV-7 (from the investigation lane, via BOB): `SECOND_READING_MISSING` at signing, or a stated absence.**
   - Awaiting the proposal.
   - Ties to BD-14 Q9.4 (independent reading, on by default, with its absence stated).
   - The signing-side questions this lane must answer:
     - whether it is a refusal at signing or a statement the case carries;
     - where that statement sits in the case and the complete edition (frozen words, CG R33);
     - how the ceremony shows it (screens-publish R13, R88's "shown before signing" pattern).
4. **Review standard `civicsmith-review/1`: from draft to published.**
   - `docs/development/publication-design/review-standard/civicsmith-review-1.md` links to the "How Civicsmith uses AI" page (BD-11). The lane's draft of that page is `docs/development/publication-design/how-civicsmith-uses-ai.md`.
   - When the ux lane places the page, resolve the link and set `status: published` in one small lane PR, before any `/11` edition carries the id. After that, the id's text is frozen; a change is a new id.
5. **Words owed to the ux lane (BD-3). Sent through BOB; this lane answers its questions.**
   - F1 needs 1 to 3, and need 4 as revised for the held entry, (a) to (d).
   - The BD-7 first-exposure disclosure.
   - The BD-9 overlay and the `declared_ai` control.
   - The affirmation sentence.
   - The `/11` complete edition's marks and legend, which must be frozen per format.
6. **Requirement changes BOB is placing.** Check them as they land, against this lane's answers:
   - case-grammar `/11`;
   - case-account R6;
   - case-inputs;
   - wizard-scripts R27;
   - record-grammar R52;
   - case-authoring;
   - case-catalogue C-41.x;
   - case-checker;
   - public-read;
   - docket R4, R5, R6, R9(b), R32 and R33;
   - publish-schedule's listener;
   - ratification F1;
   - screens-publish R13.

## Still open from qualification (`qualification-2026-11-06.md`)

- **Manager versus owner:** one name for who places docket entries and withdraws editions. The wording is this lane's; it is Bob's if the actor changes.
- **The Publication canon** (`BIO_Publication_v0_1.md`) is marked DRAFT but is in force, and lacks DEC-147, DEC-180, DEC-461, D56/D57 and the published record of actions. Rule 15(b) to (d) is stale. The lane drafts a v0.2; Bob approves; BOB places it.
- **For BOB, from qualification:**
  - case-authoring F2: real publishes fail ratification's C-41.18/19 check, read from the requirement and not run;
  - `publication-design` has no ledger entry;
  - action-holds and action-replies have no ledger entry.
- **The Foundations' own spelling "CivicSmith"** (BD-12) is the coordinator's to correct; `canon-process.md:28` notes it.

## Standing research

`trust-transparency-tracking.md` ("Next review"):
- re-check after 2 Dec 2026, when the Art 50(2) transition ends;
- in Feb 2027: the Code signatories and icon layer, the Art 50 guidelines, the CAWG identity assertion;
- around Apr 2027: C2PA 2.6 and ISO/DIS 22144;
- before 1 Jan 2027: California SB 942/AB 853.

Open items: the AP and Reuters primary texts, and the stage of ISO/DIS 22144.
