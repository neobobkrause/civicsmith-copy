<!-- Snapshot of the claude.ai document https://claude.ai/artifact/THTtouNJzkhmHqyR4Pfa4g, exported 2026-11-07T05:45Z for the account switch. The live document stays the working copy until Bob says otherwise. -->

# Investigation: best-practice departures (Q9)

Nov 7, 2026 · @Bob Krause

The investigation design meets or beats current practice in most places. Seven departures need Bob's decision; the lane recommends adopting five, keeping one as already ruled, and passing one to the publication lane. None of the five weakens a principle: each adds a record or a measure, and none lets the machine conclude.

## At a glance

| # | Departure | Practice it departs from | Lane's recommendation | Who builds it |
| --- | --- | --- | --- | --- |
| 1 | A hypothesis is one labelled claim; no rival set | Heuer's ACH; ICD 203 standard 4; Berkeley ¶27 | **Adopt**: a question may hold rival hypotheses, each leg marked against each | hypotheses, inquiry |
| 2 | No key-assumptions record; the standing CHECK is not designed | CIA Tradecraft Primer; ICD 203 §1.3 | **Adopt**: a conclusion lists its key assumptions; CHECK runs at concluding and before signing | inquiry, AI roles |
| 3 | How a look was made is not kept (INV:85) | Berkeley ¶27, ch. VI; Bellingcat | **Adopt**: each look keeps its query and portal or reading guide | observation-log, steps |
| 4 | A second reading of conclusions is optional (INV:170) | Berkeley fn. 168 | **Adopt**: on by default for a group of two or more; a group of one states its absence | investigation; publication shows it |
| 5 | AI acceptance measured only group-wide; recall of contrary evidence untested | NIST AI 600-1 | **Adopt**: test investigations report recall of contrary passages, with a release bar | ai-use, contradiction |
| 6 | Ordinary legs carry no reason in words; a case states no funder | Toulmin; IFCN 3 | **Optional reason** on a leg; **funding to the publication lane** (BD-13) | inquiry; publication |
| 7 | No likelihood words; no source-reliability score; firsthand is grade D | ICD 203 §2; Admiralty; UK 3×5×2 | **Keep, as ruled** (INV:119; DB:275–281); a word gloss beside each letter goes to ux | — |

## 1. Rival hypotheses

**Recommendation: adopt option B.** A question may hold a set of rival hypotheses, and a member marks each leg as consistent, inconsistent or not bearing on each one.

**Today.** A hypothesis is one labelled claim about nodes, and it can never be a leg or move a grade (`hypotheses` R1, R5, R8). Nothing sets a district's stated cause beside a member's suspected cause and tests both against the same evidence. Compliance questions already have a closed set (complied, did not comply, unclear; INV:53), so the gap is in cause and identity questions.

**Practice.** Heuer's Analysis of Competing Hypotheses weighs each item of evidence against every rival, and the conclusion comes from trying to disprove each rival, not prove one. Evidence consistent with every rival "may have no diagnostic value". ICD 203 standard 4 and Berkeley ¶27 ask for multiple working hypotheses.

**Options**

- **A. Keep as is.** It is simplest, but cause questions stay single-track, and a one-sided case is harder to see.
- **B. Rival sets, marked by members (recommended).** Each mark is a member's act, labelled, and never moves a grade. The system may flag a leg consistent with every rival as "does not tell them apart", as a labelled signal (INV:108). The project shows the rivals still standing.
- **C. Full ACH matrix with scores.** This is rejected, because the product keeps no stored score (INV:108).

**What changes.** `hypotheses` gains rival sets and per-leg marks. `inquiry` shows the rivals still standing. Under BD-13, publication decides how a case lists the rivals it rejected.

## 2. Key assumptions and a standing red team

**Recommendation: adopt both.** A conclusion lists its key assumptions. The adversarial CHECK role runs at two fixed points.

**Today.** Declared bias records a lens (DB:67, DB:72), but nothing records the factual premises that bridge a gap. An example is "the posted agenda is the version the board voted on". The AI roles document calls CHECK "the role most worth building" (AIR:141–143), yet marks the standing CHECK "not designed" (AIR:164).

**Practice.** The CIA Tradecraft Primer's Key Assumptions Check lists the premises a judgment rests on, then keeps only those that must be true. ICD 203 §1.3 asks for such premises to be stated where they bridge gaps. Red teaming is standard before release.

**Options**

- **A. Keep as is.** Assumptions stay invisible, and the only adversarial reading is the review of exclusions at publication (PUB:531).
- **B. Assumptions, plus CHECK at concluding and before signing (recommended).** Each assumption is a "find the record" step where the record could confirm it, as recalled claims already are (INV:140). One the record never confirms stays visible beside the strength. CHECK runs when a member adopts a conclusion and again before a case is signed, raising labelled signals only.
- **C. CHECK running continuously.** This costs more AI spend, and it adds noise during exploration.

**What changes.** `inquiry` gains assumptions on a conclusion. The ai-design lane designs CHECK's triggers, through BOB.

## 3. Search log

**Recommendation: adopt.** Each look keeps its parameters: the portal or source searched, the query or filter, and the reading guide used. The step's own history still goes unkept.

**Today.** "How it found its data is history the record does not need" (INV:85). The record keeps each look's outcome, including "looked, absent" (INV:83). A case states what was searched and with what outcome (INV:92). An outside reader cannot tell how thoroughly something was searched, or repeat the search.

**Practice.** Berkeley ¶27 notes that "the browser, search engine, search terms and syntax used may lead to very different results", and asks investigators to document each phase. Bellingcat's methodology records how material was found.

**Options**

- **A. Keep as is.** The risk is lower for public records than for social media, because the record already names the portal.
- **B. Parameters on each look (recommended).** A "looked, found nothing" becomes something an outside checker can repeat. This amends INV:85 only for a look's parameters, not for the step's path.
- **C. A full session log.** This is rejected: it is the history INV:85 rightly refuses.

**What changes.** The canon amends INV:85, which is a canon change, so it waits on Q7. `observation-log` and `steps` keep a look's parameters.

## 4. An independent reading of conclusions

**Recommendation: adopt option B.** In a group of two or more, one member who did not adopt a conclusion reads it before it can be published. A group of one states that no second reading was possible.

**Today.** Approval is off by default, "so a group of one is never blocked" (INV:170). Reviewer comments travel only if the publisher includes them (INV:171). The only mandatory second reading is the check of what was left out (INV:163).

**Practice.** Berkeley recommends peer review (fn. 168) and says accuracy improves through it (¶30).

**Options**

- **A. Keep as is.** It is the fastest path, but a one-member reading can be published unseen in a group of five.
- **B. Default on, absence stated (recommended).** A group may still switch the second reading off, but the case then says so. This follows the pattern the canon already uses for a missing falsifier (CM:694–710), and a group of one is never blocked.
- **C. Required, with no switch.** This is rejected, because it would block a group of one.

**What changes.** `investigation` holds the default. Publication shows the reading, or its stated absence, under BD-13.

## 5. AI over-reliance and recall of contrary evidence

**Recommendation: adopt options B and C.** The test investigations report the AI's recall of contrary and exculpatory passages as a separate measure, with a bar a reading part must meet before release. A counter-proposal pass asks "what in this document cuts against?"

**Today.** Code checks that each quote the AI proposes really is in the document (INV:107, INV:121, INV:165), which is precision. Nothing states that the AI's misses are measured. If it systematically skips evidence against the case, the case is one-sided and every citation still checks out. Acceptance unchanged is measured only across the group, never per member (INV:106; DEC-68).

**Practice.** NIST AI 600-1 names over-reliance (Human-AI Configuration) and homogenization as risks to measure before deployment. AP and Reuters treat AI output as an unvetted lead.

**Options**

- **A. Keep as is.** Precision is strong, but recall is unknown.
- **B. A contrary-recall measure and bar (recommended).** It uses the test investigations INV:123 already requires, so it needs no new apparatus.
- **C. A counter-proposal pass at reading time (recommended).** It works at the moment of acceptance and measures no member, so DEC-68 stands.
- **D. Per-member acceptance rates.** This is rejected, because DEC-68 rules it out.

**What changes.** `ai-use` holds the measure and its bar. `contradiction`, or the reading part, holds the counter-proposal pass. The ai-design lane is consulted through BOB.

## 6. A leg's reason, and who funded the work

**Recommendation: an optional reason on a leg, and funding passed to the publication lane.**

**Today.** An ordinary leg has a role and a grade, but no line saying why the passage bears on the claim (INV:107). Determinations already carry a captured, graded warrant: the rule that binds (INV:53). Who paid for the system's finds is shown only to the account's owners (INV:111). A published case names no funder.

**Practice.** Toulmin's warrant, and claim–evidence–reasoning, make the reasoning a part of the argument that others can attack. IFCN commitment 3 requires disclosing funding.

**Options for the reason**

- **A. None.** This keeps legs light.
- **B. Optional, in the member's own words (recommended).** CHECK and the case's sentence check can read it, and the machine never writes it (AIR rule 1).
- **C. Required on every leg.** This is heavy for routine legs whose bearing is obvious.

**Funding.** What a case states belongs to publication (BD-13), so the lane passes this to the publication lane with IFCN 3 as the reason.

**What changes.** `inquiry` gains an optional reason on a leg.

## 7. Conventions readers know

**Recommendation: keep as ruled.** A word gloss beside each grade letter goes to the ux lane as a display matter.

**Today.** The product gives no likelihood or rating words (INV:119) and keeps no credence or reputation score for a source; bad actors are identified by evidence (DB:275–281). Grades measure how checkable a claim is, so a member's firsthand account is grade D: "harder for others to check, not … less true" (INV:141, CF:700).

**Practice.** ICD 203 uses seven fixed likelihood bands. The Admiralty system and the UK 3×5×2 scheme grade source reliability separately, and both grade direct knowledge as best.

**Why keep.** Both choices are ruled doctrine, and each is a coherent alternative. Stating what would be needed to check a claim is more useful to a civic reader than a subjective probability. The real cost is misreading: a reader trained on Admiralty will read "D" as unreliable. A gloss fixes that without changing the doctrine, for example "D: a member's own account; no captured document".

**What changes.** Nothing in this lane. The gloss goes to the ux lane through BOB.

## What stays as is

These already meet or beat practice; the lane recommends no change.

| Practice | How the design meets it | Where |
| --- | --- | --- |
| Keep evidence apart from judgment (ICD 203 standard 3) | Narrative kept apart from evidence, and the machine's work apart from members' | INV:139–143, INV:109 |
| Treat gaps as the work (ICD 203 d) | Gaps are the work list, and progress is computed from the record | INV:52 |
| Give contrary evidence equal standing (Berkeley ch. VII) | Evidence against is shown as prominently, and compliance is recorded with the same care | INV:53, INV:55 |
| Say what would change the conclusion (Heuer step 8) | The falsifier is stated, or its absence attributed | CM:694–710 |
| Disclose completeness and exclusions (Berkeley ¶210) | What was searched and left out is stated and checked | INV:92, INV:166 |
| Preserve with integrity (Berkeley ¶167) | Raw bytes hashed and never rewritten; signed publication | CF invariant 1 |
| Make bias explicit (ICD 203 a) | Declared bias, printed and re-checkable under another lens; regrade is built | DB:42–103 |
| Verify AI citations (NIST AI 600-1) | Every quote and sentence checked by code | INV:107, INV:121, INV:165 |
| Measure AI before release (NIST) | No AI part reaches members before it passes test investigations | INV:123 |
| Never name on rumour | No private life investigated; the system never explores a person on its own | INV:148–149 |

## Sources

INV is `docs/architecture/BIO_Investigation_v0_1.md`, CM `BIO_Case_Making_v0_1.md`, CF `BIO_Content_Framework_v0_10.md`, DB `BIO_Declared_Bias_v0_1.md`, AIR `BIO_Assistant_and_AI_Roles_v0_1.md`, PUB `BIO_Publication_v0_1.md`, all on tranche. The full research, with 24 sources, is `docs/development/investigation-design-research/best-practice.md`.

- [ICD 203: Analytic Standards](https://www.dni.gov/files/documents/ICD/ICD-203.pdf), ODNI, 2015, amended 2022
- [Psychology of Intelligence Analysis](https://www.cia.gov/resources/csi/books-monographs/psychology-of-intelligence-analysis-2/), Heuer, CIA CSI, 1999, ch. 8
- [A Tradecraft Primer](https://www.cia.gov/resources/csi/static/955180a45afe3f5013772c313b16face/Tradecraft-Primer-apr09.pdf), CIA, 2009
- [Berkeley Protocol on Digital Open Source Investigations](https://www.ohchr.org/sites/default/files/2024-01/OHCHR_BerkeleyProtocol.pdf), OHCHR and UC Berkeley, 2022
- [Bellingcat and GLAN methodology](https://www.bellingcat.com/app/uploads/2022/12/JA-Manual-for-PUBLICATION.pdf), 2022
- [IFCN commitments](https://ifcncodeofprinciples.poynter.org/the-commitments), Poynter
- [NIST AI 600-1: Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1), July 2024
- [AP standards on generative AI](https://www.niemanlab.org/2023/08/not-a-replacement-of-journalists-in-any-way-ap-clarifies-standards-around-generative-ai/), August 2023
- [Reuters guidance on AI](https://talkingbiznews.com/media-news/what-reuters-is-telling-its-journalists-about-using-artificial-intelligence/), May 2023
- [Intelligence source and information reliability](https://en.wikipedia.org/wiki/Intelligence_source_and_information_reliability) (secondary, for the Admiralty grades)
- [Toulmin's argument model](https://courses.lumenlearning.com/suny-englishcomp2kscopexmaster/chapter/toulmins-argument-model/) (secondary)
