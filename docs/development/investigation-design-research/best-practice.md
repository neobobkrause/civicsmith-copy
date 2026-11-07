# Investigation methodology and tooling: current best practice, and where Civicsmith stands

**Research note for the `investigation` design lane.** Written 2026-11-06. It is not canon and decides nothing. Every outside claim cites a public source listed at the end, accessed 2026-11-06. Product citations are `file:line` in `/home/user/civicsmith-copy` at the tree read on that date.

**Abbreviations for product files**
- **INV** `docs/architecture/BIO_Investigation_v0_1.md`
- **CF** `docs/architecture/BIO_Content_Framework_v0_10.md`
- **DB** `docs/architecture/BIO_Declared_Bias_v0_1.md`
- **CM** `docs/architecture/BIO_Case_Making_v0_1.md`
- **AIR** `docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md`
- **PUB** `docs/architecture/BIO_Publication_v0_1.md`
- **req/x** `build/requirements/x.md`

**How sources were read.** Five primary texts were downloaded and their text extracted: ICD 203, Heuer's *Psychology of Intelligence Analysis*, the CIA *Tradecraft Primer*, the Berkeley Protocol, the Bellingcat/GLAN methodology, and NIST AI 600-1. Quotations from these are verbatim. Some sources were blocked (403 errors from UNESCO, TCIJ and the College of Policing) or are not public (NATO AJP-2.1). For those, the note relies on secondary reporting and marks it **[secondary]**.

**Prior work this note does not repeat.** `docs/development/GRADE-A-CAPTURE.md` §3 already covers capture-level evidentiary standards: Berkeley Protocol ¶153–156, hashing and FRE 902. `docs/development/PRACTICE-SURVEY.md` covers tool conventions. This note is about *method*: how an investigation reasons, tests itself, is reviewed, and uses AI.

---

## 1. Structured analytic techniques

### 1.1 Analysis of Competing Hypotheses (Heuer)

**What it says.** Heuer, *Psychology of Intelligence Analysis* (CIA CSI, 1999), ch. 8, sets out an eight-step procedure:
1. Identify the possible hypotheses, using "a group of analysts with different perspectives".
2. List the evidence and arguments.
3. Build a hypotheses × evidence matrix and analyse its "diagnosticity".
4. Refine the matrix and drop evidence with no diagnostic value.
5. Draw tentative conclusions "by trying to disprove the hypotheses rather than prove them".
6. Analyse how sensitive the conclusion is to a few critical items of evidence.
7. Report "the relative likelihood of all the hypotheses, not just the most likely one".
8. Identify milestones that would show events are taking a different course.

Two points are central:
- **Diagnosticity.** Evidence consistent with every hypothesis "may have no diagnostic value".
- **Disconfirmation.** "What is difficult to find, and is most significant when found, is hard evidence that is clearly inconsistent with a reasonable hypothesis".

Heuer also says "any written argument for a certain judgment is incomplete unless it also discusses alternative judgments that were considered and why they were rejected", and that ACH leaves "an audit trail to show what they considered". The method is still current: it is among the 66 techniques in Pherson & Heuer, *Structured Analytic Techniques* (3rd ed., CQ Press/SAGE, 2019/2020).

**Where Civicsmith follows**
- **A neutral objective.** The objective's condition "states what the record must hold for the matter to be decided, not which answer is hoped for" (INV:52). The determination ranges over complied / did not comply / unclear (INV:53). For compliance questions this is in effect a closed set of hypotheses, and compliance "has met its objective either way" (INV:53). This is better than satisficing on one favoured answer.
- **The falsifier is accounted for.** A conclusion states its falsifier, or states and attributes its absence, in the signed case (CM:694–710). This matches ACH step 8 and Heuer's call to say in advance what would change one's mind.
- **Contrary evidence has equal standing.** Evidence that cuts against is shown "as prominently" (INV:55; CF invariant 7, CF:329). A cutting-against leg is a first-class leg role (req/inquiry-grammar:26, R68).
- **Strength names its weakest legs** (CM:284, CM:694). This is a structural form of ACH step 6's sensitivity check.
- **Dead ends and "looked, absent" are kept** (INV:68–69, INV:83). This is part of the audit trail.

**Where Civicsmith departs or lacks**
- **Hypotheses are single assertions about nodes, not alternative answers.** A hypothesis is a labelled row about nodes (kinds `cause`, `identity`, `relation`, `flow`, `other`; req/hypotheses:18, R1). It can never be a leg or move a grade (req/hypotheses:26, R5; :68, R8). The record has no object that groups mutually exclusive explanations of one question. So no evidence is ever assessed *against several hypotheses at once*, and nothing computes or shows diagnosticity.
- **Cause questions have no competing-explanations surface.** A cause "stays a labelled hypothesis" (INV:119; req/hypotheses R9), which is right for publication. But the members have no place to set the district's stated cause, a member's suspected cause and other candidates side by side and test them.
- **Hypothesis generation has no group step.** The system offers its own hypotheses apart (INV:109; req/hypotheses:42, R16), which helps against a single member's blind spot. But nothing asks a *group* to brainstorm alternatives before evidence gathering, as Heuer's step 1 does.

**Open questions**
- Should a question be able to hold a *set* of competing hypotheses, each leg marked consistent / inconsistent / not applicable per hypothesis? The system could then flag non-diagnostic legs (consistent with all), still as a labelled signal (INV:108) and never as a grade.
- Should a published conclusion list the alternatives considered and why each was rejected (ACH step 7)? Today it publishes the falsifier, but not the rejected rivals.

### 1.2 Key Assumptions Check, Quality of Information Check, contrarian techniques

**What it says.** The CIA *Tradecraft Primer* (2009) describes several techniques:
- **Key Assumptions Check.** "List and review the key working assumptions on which fundamental judgments rest". It is "most useful at the beginning of an analytic project" and worth rechecking "prior to finalizing judgments". The goal is "not to undermine or abandon key assumptions; rather, it is to make them explicit and identify what information or developments would demand rethinking them". The method has four steps: write the analytic line down; articulate the stated and unstated premises; challenge each; keep only those that "must be true".
- **Quality of Information Check.** "Having multiple sources on an issue is not a substitute for having good information that has been thoroughly examined"; otherwise "judgments can become anchored to weak information".
- **Contrarian techniques.** Devil's Advocacy, Team A/Team B, High-Impact/Low-Probability, "What If?" and Red Team Analysis.

**Where Civicsmith follows**
- **Information quality is continuous and structural.** Every leg carries an earned grade (req/leg-earning:74, R10). Stale content re-grades its legs (req/inquiry R41). Uncertainty "is carried, not resolved" (CF:322). This goes further than a periodic Quality of Information Check.
- **Some assumptions have a home as declared bias.** DB "inference" statements license or block inference patterns (DB:72), and "scrutiny" statements raise the bar for a source (DB:67). These are declared assumptions, printed in the case and re-checkable under another lens (INV:169).

**Where Civicsmith lacks**
- **No assumptions artefact.** The canon has no construct for "what must be true for this conclusion to hold". Example: "the posted agenda is the version the board voted on", or "the contract's time extension was not approved off-record". Declared bias covers a *lens*, not the factual premises that bridge gaps. ICD 203 asks for such premises to be stated "when they serve as the linchpin of an argument or when they bridge key information gaps" (§1.3).
- **No standing contrarian role.** AIR §7.4 names the CHECK role, which "reads adversarially", as "the role most worth building and the one sequenced first" (AIR:141–143). Its status table still reads "a standing CHECK over a project | not designed" (AIR:164).
  - The publication review copy does ask a recipient to *attack* the exclusion statement (PUB:531). That is a red-team step at the publication gate only.

**Open questions**
- Should a conclusion carry a short list of key assumptions, each one a "find the record" step where possible (as INV:140 does for recalled claims)? An assumption the record never confirms would then stay visible beside the strength.
- Is the CHECK role (AIR §7.4) the lane's red team? If so, should the investigation design name when it runs: at concluding, at quiet (INV:76), before publication?

### 1.3 ICD 203 Analytic Standards (US Intelligence Community)

**What it says.** ICD 203 (signed 2 January 2015, technically amended 21 January 2022) sets five standards, among them being objective and "based on all available sources". Analysts "must employ reasoning techniques and practical mechanisms that reveal and mitigate bias". Its nine tradecraft standards include:
- (1) describe the "quality and credibility of underlying sources";
- (2) express and explain uncertainty, with a fixed seven-band likelihood vocabulary ("almost no chance … almost certain", 01–99%), and never combine a confidence level and a likelihood in one sentence;
- (3) "clearly distinguish statements that convey underlying intelligence information … from statements that convey assumptions or judgments";
- (4) "identify and assess plausible alternative hypotheses";
- (6) "acknowledge significant supporting and contrary information";
- (7) state how judgments are consistent with, or a change from, earlier ones;
- (d) "identify and address critical information gaps".

**Where Civicsmith follows**
- **(3) Information versus judgment.** Civicsmith follows this strongly:
  - narrative is kept apart from evidence (INV:139–143);
  - the machine's work is apart from members' work (INV:109; AIR rule 3);
  - "as recalled" is a stated baseline (INV:143);
  - "cause not established" (INV:119).
- **(d) Gaps.** Gaps are the work list, and progress is computed from the record and never reported (INV:52; req/intent:92, R19).
- **(6) Contrary information** (INV:55).
- **(7) Change.** A new edition states what changed (INV:166).
- **(1) Source quality** is carried, but as *provenance grades* (CF §8.1, CF:697–700), not as credibility. See §1.4.

**Where Civicsmith deliberately departs**
- **No likelihood or confidence words.** Civicsmith's voice "gives no verdict, likelihood or rating words" (INV:119), and the system keeps "no stored score" (INV:108). It expresses uncertainty instead as:
  - grade letters on two axes (capture and connection);
  - strength beside a bar the project sets (INV:54; PUB:53);
  - explicit absence ("looked for and not found", INV:143).

  This is a coherent alternative: it states *what would be needed to check* rather than a subjective probability (CF:708). It does mean Civicsmith's output does not map onto the language intelligence and some legal readers expect.
- **(4) Alternatives** are lacking (§1.1).

**Open question.** Should the case's standalone checker, or a reader's rendering, offer an *optional* translation from the bar to plain likelihood-free audience phrases? CM:276 already sketches these: "records suggest" / "the record establishes" / "worth checking". The aim is to state the outcome in the terms each audience uses for its standard, with no probability involved.

### 1.4 Source reliability and information credibility grading (Admiralty / NATO / UK 3×5×2)

**What it says.**
- **Admiralty / NATO system [secondary].** It grades *source reliability* A–F and *information credibility* 1–6, independently. A is "reliable", F is "reliability cannot be judged"; 1 is "confirmed by independent sources", 6 is "cannot be judged". A new source is F by default. The public US Army statement of the matrix is FM 2-22.3, Appendix B; NATO AJP-2.1 is not public.
- **UK policing's 3×5×2** (College of Policing APP, guidance updated 2026) **[secondary]**. It keeps a source grade (reliable / untested / not reliable) apart from an information grade on how the source knows it. A is "known directly to the source", B is indirectly known but corroborated, through to E, suspected to be false. An officer's own observation is graded A.
- **Bellingcat/GLAN (2022).** Bellingcat separates source from content: "A biased or non-credible source can still post content that can be independently verified, and this material should be assessed on a case-by-case basis."

**Where Civicsmith follows**
- **Two independent axes.** Capture grade (how the bytes were obtained) and connection grade (how a link was established) are graded separately (CF:697–700; req/leg-earning:18, R1). This mirrors the two-axis principle.
- **Content over source.** There is no reputation score: "BIO keeps no credence, reputation or trust SCORE for a source … bad actors are identified by EVIDENCE" (DB:275–281). This matches Bellingcat's separation of source and content.

**Where Civicsmith departs**
- **No source-reliability axis at all.** It was refused on principle (DB:275–281). The nearest tool is a *declared* scrutiny statement about a source (DB:67), printed and re-checkable under another lens. Doctrine and policing consider a source-reliability axis essential; Civicsmith replaces it with declared, attributable lenses. This is a defensible and notable departure, and outside readers may not expect it.
- **Firsthand observation is inverted.** In 3×5×2, firsthand observation is grade A. In Civicsmith a member's firsthand account is testimony at grade D (CF:700; INV:141). Civicsmith grades *how checkable* a claim is, not how good the knowledge is: "it rests on her word and is harder for others to check, not that it is less true" (INV:141). The semantics are sound, but the letter clashes with policing and Admiralty conventions, where A is best for direct knowledge.

**Open question.** Readers trained on Admiralty or 3×5×2 will read "D" as "not usually reliable". Should published cases render the grade letters with their meaning in words ("D: a member's own account; no captured document") rather than the bare letter?

---

## 2. Open-source investigation standards

### 2.1 Berkeley Protocol on Digital Open Source Investigations (OHCHR / UC Berkeley, 2020; 2022 edition)

**What it says**
- **Objectivity.** Investigators "must ensure that they approach their investigations objectively, developing and deploying multiple working hypotheses and not favouring any particular theory" (¶27). "The browser, search engine, search terms and syntax used may lead to very different results" (¶27).
- **Accuracy.** Accuracy "is often improved through the use and testing of multiple working hypotheses and/or peer review" (¶30). "Analytical conclusions should not be exaggerated or overstated" (¶30).
- **Cycle.** Six phases (online inquiry, preliminary assessment, collection, preservation, verification, investigative analysis) form a repeating cycle. "Investigators should document their activities during each phase" (ch. VI summary).
- **Chain of custody** is "the chronological documentation of the sequence of custodians … and documentation of the control, date and time, transfer, analysis and disposition" (¶167).
- **Verification** has three strands: source analysis ("assessing a source's credibility and reliability", ¶177), technical analysis (¶183) and content analysis (¶187). The protocol warns of "circular reporting, decontextualization of information and misinterpretation" (¶187).
- **Reporting** (ch. VII, ¶208–210): "Exculpatory information should be included, as should an explanation of any redactions or gaps". Reports should "clearly distinguish" public content from "the judgment or opinion of investigators". They should state "how the investigators went about their work". They should give "an indication of the completeness of the underlying data, especially if data are deliberately excluded". "Peer review is recommended" (fn. 168).

**Where Civicsmith follows**
- **Completeness, exclusions and searches** are well covered:
  - a published case "states what was searched and with what outcome, computed from the record's looks" (INV:92);
  - the exclusion statement leads the review copy (PUB:531);
  - "what was left out, and why" is checked like any other sentence (INV:166);
  - a second member checks what was left out (INV:163; PUB §3 rule 11).
- **Exculpatory material.** Compliance "is recorded with the same care" (INV:53), and cutting-against legs are prominent (INV:55).
- **Judgment versus content** (INV:139–143; AIR rule 3).
- **Preservation and integrity.** Raw bytes are hashed and never rewritten (CF invariant 1). Publication is signed and records the signer and the delivering principal (AIR rule 4).
- **Data minimisation and people.** No private life is investigated, and the system never explores a person on its own (INV:148–149). This matches the protocol's ethical principles.
- **Circular reporting** is partly addressed. CHECK is designed to raise "an OR-branch whose legs share an origin" (AIR:143), but it is not built.

**Where Civicsmith departs**
- **The search process is not recorded.** INV:85 says of a step: "How it found its data is history the record does not need." Berkeley ¶27 and the Bellingcat/GLAN methodology (§2.2) treat *how* things were found (search terms, tools, starting conditions) as part of showing objectivity. Civicsmith keeps the *outcome* of looks, including absence (INV:83), but not the queries or paths that produced them. For a public-records investigation the risk is lower than for social media, because the sources are portals the record names. Still, "what was searched" (INV:92) cannot show *how thoroughly* without the query.
- **Peer review is optional.** Approval is off by default "so a group of one is never blocked" (INV:170), and reviewer comments travel only if the publisher includes them (INV:171). Berkeley recommends peer review. The second member's check of exclusions is the only mandatory second reading.
- **Multiple working hypotheses** have no structure (§1.1).

**Open questions**
- Should a look in the observation log record its query and portal (or the reading guide used), so that "looked, absent" can be reproduced by an outside checker? This would not revive per-step "how", only the parameters of a look.
- For a group larger than one, should one independent reading of the conclusions (not only the exclusions) be the default, with a group of one stating its absence the way a missing falsifier is stated (CM:694–710)?

### 2.2 Bellingcat methodology

**What it says.** The Bellingcat/GLAN *Methodology for Online Open Source Investigations* (Justice and Accountability Unit, updated 14 December 2022) lists its bias mitigations (¶30):
- "Beginning an investigation with no settled hypothesis";
- "Actively pursuing all lines of inquiry … by searching for a military justification for each … attack";
- searching all platforms, including hostile ones;
- "intensive verification on each piece of content whether it is posted by pro-Ukraine or pro-Russian sources";
- "a list of questions in the methodology to ensure that no relevant lines of inquiry are skipped";
- "separate review of investigations by the team leader and legal team".

Investigators "maintain a log of search terms" so that the record shows "whether you did carry out an unbiased search" (¶17). They cite the "Original Online Source", the earliest poster (p. ~5). Bellingcat's general practice is widely described as "show your work" [secondary: Reuters Institute; Big Think].

**Where Civicsmith follows**
- **Pursuing the innocent explanation.** The objective is met whichever way the evidence falls, and compliance gets equal care (INV:53). This is the analogue of "searching for a military justification".
- **Reading guides.** A guide is a checklist of what to look for in one kind of document (INV:122), the analogue of Bellingcat's "list of questions". It is measured before shipping and reviewed by another member.
- **Content verification is independent of source.** There is no credence ledger (DB:275).

**Where Civicsmith departs:** the search log (§2.1); a review separate from the investigators is optional (INV:170).

**Open question.** A reading guide covers *one kind of document*. Should there also be **matter guides**: per type of investigation (a contract award, a records-request refusal, a budget variance), a list of alternative explanations and lawful justifications a question must look for before concluding? Bellingcat's "military justification" check is the model.

### 2.3 Verification handbooks

**What it says.** The European Journalism Centre's *Verification Handbook* series (ed. Craig Silverman; 3rd volume, *For Disinformation and Media Manipulation*, April 2020) teaches the same core as Berkeley **[secondary]**: provenance, source, date, location and motivation. It deals mainly with user-generated content and manipulation.

**Civicsmith.** Its sources are mostly official publications captured from the publisher (CF §8.1 grade A/B), so the handbook's social-media techniques apply mainly to chance finds and doorbell drops (INV:94). The provenance-first stance is shared. Manipulation by the publisher itself (a changed agenda after the vote) is met by change tracking and version pinning (CF §18.1).

---

## 3. Investigative journalism method

### 3.1 Hypothesis-based inquiry (UNESCO, *Story-Based Inquiry*)

**What it says [secondary; primary blocked].** Mark Lee Hunter et al., *Story-Based Inquiry: A Manual for Investigative Journalists* (UNESCO/ARIJ, 2009; 2nd edition via the Centre for Investigative Journalism, 2025/2026). The reporter "formulat[es] the story they hope to write as a hypothesis that will be verified or disproved", then "seek[s] open source data to verify the hypothesis". A **master file** holds the hypothesis, a timeline, sources and quotes, guiding questions and observations. It also logs contacts and promises to sources, "of critical importance if your investigation is challenged".

**Where Civicsmith follows**
- **Remembered claims become steps.** "A claim in the narrative becomes something to find" (INV:140). This is hypothesis-to-verification at the level of single claims.
- **The question as master file.** The question carries "the work done on it … its evidence and its answer" (INV:87–93), effectively a structured master file.
- **Dated status reports** are drafted from the record (INV:79).

**Where Civicsmith departs, deliberately**
- **The objective is neutral, not a story.** SBI starts from the story one *hopes* to write. Civicsmith's objective "states what the record must hold … not which answer is hoped for" (INV:52). This lowers SBI's known confirmation-bias risk.
- **No stories.** "A case carries no stories, context or human-interest accounts" (INV:167; CM §4a). SBI makes the story the organising device. The departure is principled: Civicsmith publishes findings, not journalism.

**Open question.** SBI's hypothesis is falsifiable by design. Should a project's intake (INV:118) capture the member's *expected* answer as a declared hunch? It would then be visible and testable rather than unspoken, which fits DB's "hunch as temporary declared bias".

### 3.2 Fact-checking standards (IFCN Code of Principles)

**What it says.** The International Fact-Checking Network (Poynter) has five commitments:
1. Non-partisanship and fairness: "using the same standard for every fact check".
2. Transparency of sources: "provide all sources in enough detail that readers can replicate their work".
3. Transparency of funding and organisation: "ensure that funders have no influence over the conclusions".
4. Transparency of methodology.
5. An open and honest corrections policy, so that those who saw the original see the fix.

**Where Civicsmith follows**
- **Replication.** The signed case, the standalone checker and recreation by another group (INV:169, INV:172; PUB §5C) go well past "enough detail to replicate".
- **Same standard.** The bar is a project property, "strictest wins" (PUB:53). Contradicting finds are graded identically (CM:284–288).
- **Corrections.** Editions with "what changed" (INV:166), withdrawal, and re-evaluation of importers' acceptances (INV:172).

**Where Civicsmith departs or lacks**
- **Funding.** Who paid for the system's finds is shown only to the account owners (INV:111), and shared costs are worked out privately (INV:72). That is reasonable for working material. But nothing in INV requires a *published case* to disclose who funded or sponsored the investigation.

**Open question.** Should a published case carry a funding/sponsorship statement alongside the bias statement (DEC-103)? It would serve IFCN's "funders have no influence" test.

### 3.3 Documentation and chain of custody

See Berkeley ¶167 (§2.1) and `GRADE-A-CAPTURE.md` §3.

**Civicsmith.** Capture identity is the hash of served bytes (CF invariant 1). Every reading of a capture is kept with its tier and member (CF front matter, D-536). Ratification records signer and deliverer (AIR rule 4). Transcripts are device-local and deleted at publication, with a litigation hold (AIR rule 6).

**Gap.** Berkeley's custody chain records *transfers* and *analysis* events. Civicsmith records captures and acts. Whether it records each export, import and recreation of a case as a custody event is ruled in PUB §5C, not here. Not examined further.

---

## 4. Evidence and provenance modelling

### 4.1 W3C PROV

**What it says.** PROV-DM (W3C Recommendation, 30 April 2013):
- **Entity**: "a physical, digital, conceptual, or other kind of thing";
- **Activity**: "something that occurs over a period of time and acts upon or with entities";
- **Agent**: "something that bears some form of responsibility";
- **Relations**: generation, usage, derivation (including quotation and primary source), attribution, and association with a **Plan** ("a set of actions or steps intended");
- **Delegation** ("actedOnBehalfOf");
- **Bundle**: "a named set of provenance descriptions, and is itself an entity", so provenance can itself have provenance.

**Where Civicsmith follows (by structure, not by vocabulary)**

| PROV | Civicsmith |
| --- | --- |
| Activity | step |
| Generation | "what it produced, through the provenance of that data" (INV:85) |
| Agent | a member by handle or "the system" (INV:85) |
| Plan | reading guide |
| Delegation | an AI credential acting under a task scope minted by a member (AIR rule 5) |
| Quotation | a passage tied to its exact quote (INV:127) |
| Primary Source | testimony (INV:141) |

**Where Civicsmith departs**
- **Usage is dropped.** A step keeps what it *generated* but not what it *used* or how (INV:85). In PROV terms, `used` and the Plan for a step are dropped.
- **No interoperable export.** There is no PROV (or similar) serialisation, so outside tools (newsrooms, courts, researchers) cannot ingest the provenance graph without Civicsmith's own checker.

**Open question.** Should the case container's provenance be exportable as PROV-O/JSON-LD, so a third party can traverse "this sentence → this leg → this passage → this capture → this fetch" with standard tools?

### 4.2 Argument structure: Toulmin, claim–evidence–reasoning, Wigmore

**What they say**
- **Toulmin**, *The Uses of Argument* (Cambridge UP, 1958; updated 2003): an argument has a **claim**, **data/grounds**, a **warrant** linking them, **backing** for the warrant, a **qualifier** ("probably") and a **rebuttal** (conditions that defeat the claim) [secondary summaries].
- **Claim–Evidence–Reasoning** (McNeill & Krajcik, Pearson, 2011/2012) is the classroom form. Reasoning "shows why the data counts as evidence", and a **rebuttal** addresses alternative explanations [secondary].
- **Wigmore charting**, as modernised in Anderson, Schum & Twining, *Analysis of Evidence* (2nd ed., Cambridge UP, 2005), works through a formal sequence: case theory, then a **key list** of propositions, then a chart of the inferential chains from evidence to the ultimate probanda. The chain includes "ancillary" evidence about the credibility of each item [secondary for step order].

**Where Civicsmith follows**
- **Claim.** An inquiry adopts a claim as its answer (CM:670–680).
- **Grounds.** Legs, graded (req/inquiry R4–R6).
- **Structure.** Grounds partitions with AND/OR branches (DEC-32; req/inquiry-grammar:26, R68) are a light Wigmore-style structure.
- **Rebuttal.** The accounted falsifier (CM:694–710) and cutting-against legs.
- **Qualifier.** Strength beside the bar, categorical rather than modal.
- **Warrant for determinations.** "The rule that binds" (INV:53) is held as a standard and is itself a leg target with its own capture ceiling (req/leg-earning:31, R8). That is a captured, graded warrant, which is unusually rigorous.
- **Ancillary evidence.** Connection grade (CF §8.1) plays the role of Wigmore's ancillary evidence on each link.

**Where Civicsmith lacks**
- **No warrant for ordinary legs.** An ordinary leg has a role and a grade, but no recorded *warrant*: why this passage bears on this claim. The member's reading at acceptance "is recorded as proposed or edited" (INV:107), but the requirements read do not show it as a field of the leg that a reviewer or the CHECK role can attack.

**Open question.** Should each leg carry a one-line warrant in the member's words ("the change order's date precedes the board vote, so the vote could not have approved it")? The case's sentence check (INV:165) could then test reasoning as well as citation. AIR rule 1 already forbids the machine to write it.

### 4.3 Legal standards of proof as analogy

**What it says.** US law sets graded burdens of persuasion: preponderance (civil), clear and convincing (intermediate), beyond a reasonable doubt (criminal) (Cornell LII *Wex*). The standard is set by the *purpose* of the proceeding, not by the evidence.

**Where Civicsmith follows.** This is exactly CM's argument: "'enough' is not a property of the evidence but of what you intend to do with it", so the bar is a project's *declaration*, published beside what was reached, and never a threshold inside the claim (CM:690–697; INV:54). The audience ladder ("records suggest" / "the record establishes" / "worth checking", CM:276) is a standards-of-proof analogy.

**Where Civicsmith departs.** Legal standards are probabilistic in spirit. Civicsmith's bar is a pair of provenance letters (PUB:160). The bar measures how checkable the support is, not how persuasive it is. A case can meet a strict A/A bar and still rest on a weak inference, which is why the warrant (§4.2) and alternatives (§1.1) matter.

---

## 5. Bias and collaborative investigation

### 5.1 Cognitive bias mitigation

**What it says.** ICD 203 requires "practical mechanisms that reveal and mitigate bias". Heuer ch. 8 says people "give more weight to information that supports a hypothesis … we should do just the opposite". Berkeley ¶27 calls for multiple working hypotheses and countering search-engine bias. Bellingcat ¶30 lists the mitigations given in §2.2.

**Where Civicsmith follows, and goes beyond**
- **Declared Bias** makes the lens part of the record (DB:42–103). Verdict-shaped statements are refused as malformed (DB:89). Hunches must be cleared before publication (DB:283). Readers can re-check under another lens (INV:169). The surveyed practice has no equivalent: Bellingcat *describes* its biases, while Civicsmith *records and applies* them.
- **Goals cannot filter evidence** (CF invariant 7; req/intent:94, R21).
- **The failure asymmetry is explicit**: "When uncertain, be noisy" (CF:315).
- **Nothing measures a member** (INV:44), which removes one incentive to perform for metrics.

**Where Civicsmith lacks.** Mechanisms *against confirmation bias inside a project* are thin. Nothing prompts alternatives (§1.1), assumptions (§1.2) or a contrarian pass (§1.2) before concluding. Declared bias addresses a known lens, not an unknown one.

### 5.2 Red teaming

See §1.2. The review copy asks for an attack on the exclusion statement (PUB:531). A standing CHECK is "not designed" (AIR:164).

### 5.3 Distributed and crowdsourced investigation quality control

**What it says.** The best-known failure is Reddit's /r/findbostonbomber (April 2013). Crowd speculation named innocent people, among them the missing student Sunil Tripathi, and the media amplified it. Reddit's general manager publicly apologised for an "online witch hunt" [secondary: Global News, PCWorld, The World]. The lessons drawn are no naming without verification, moderation, and separating leads from accusations. The Berkeley Protocol and Bellingcat both pair open collaboration with closed review: Bellingcat separates "inducted" investigators and reviews by a team lead and the legal team (¶30).

**Where Civicsmith follows, strongly**
- "Rumours become leads, never questions aimed at a person" (INV:135).
- A warning at any act naming a person in no public role (INV:148; req/inquiry R59).
- The system never explores a person on its own (INV:149).
- Hidden projects are uncountable (INV:58).
- A published finding resting on an anonymous account must be corroborated first (INV:141).
- Contradictions across projects are paired deterministically and surfaced to both parties without exposing hidden ones (req/contradiction:11; R49–R52).
- Each project concludes for itself on shared steps (INV:86), which keeps the independence of judgments that crowd quality depends on.

**Where Civicsmith departs.** Crowd quality control usually relies on *reputation*: moderator trust, contributor track records. Civicsmith refuses reputation (DB:275) and per-member measures (INV:44). Its remaining safeguard is evidential: grades, the bar, and the sentence check at publication (INV:165). This is consistent, but it means that before publication a group has no signal of whose acceptances are careless. See §6 on automation bias.

---

## 6. AI-assisted investigation

**What current guidance says**
- **AP** (16 August 2023): "Any output from a generative AI tool should be treated as unvetted source material", and staff "must apply their editorial judgment and AP's sourcing standards".
- **Reuters** (memo from Galloni and Freedman, May 2023): "If your name is on a story, you are responsible"; "Be skeptical and verify"; disclose AI use when it materially affects the result; "rigorous oversight by newsroom editors".
- **Poynter** AI ethics starter kit (March 2024; updated 25 June 2025): transparency, accuracy, human oversight, accountability [partly secondary].
- **NIST AI 600-1**, Generative AI Profile (July 2024), names among its twelve risks:
  - **Confabulation**: "confidently stated but erroneous or false content";
  - **Human-AI Configuration**: "automation bias, over-reliance";
  - **Information Integrity**: content that does not "distinguish fact from opinion or fiction or acknowledge uncertainties";
  - **Harmful Bias or Homogenization**.

  It notes that outputs "may also include confabulated logic or citations" and recommends: "Review and verify sources and citations in GAI system outputs during pre-deployment risk measurement and ongoing monitoring".
- **Measured citation failure.**
  - The Tow Center (CJR, March 2025) found eight AI search tools gave incorrect or misleading citations in over 60% of tests, and premium tiers were more confidently wrong [secondary for figures].
  - Stanford RegLab/HAI (2024, preregistered) found commercial legal AI research tools hallucinated in roughly 17–33% of queries [secondary for figures; vendors disputed them].

**Where Civicsmith follows, often ahead of the guidance**
- **Unvetted, human-accepted.** "The machine proposes. A member accepts on the evidence … The machine never concludes, determines or attests" (INV:46; AIR rules 1, 4). No machine credential can perform an attested act (AIR rule 4).
- **Citations verified by code, not trust.**
  - A passage the AI proposes keeps the document's grade only when "the publisher's own words are in the document, checked there by code, and any number or date … read there by code and checked by the member" (INV:107).
  - Every sentence of a note is tied to a quote, "and any sentence that cannot be tied is left out" (INV:121).
  - Every sentence of a case account is checked against the evidence it cites, and contradicted sentences are refused (INV:165).

  This answers confabulated citations (NIST; Tow Center) structurally.
- **AI reading of images.** OCR by AI is "undetermined until its accuracy is measured" (INV:120; req/leg-earning:40, R15).
- **Pre-deployment measurement.** No AI part reaches members until it passes test investigations with human-written answers (INV:123; INV:155). Signals carry a measured false-alarm rate (INV:108; req/hypotheses:42, R16). Prompts are pinned to measured digests (req/contradiction:23, R2). This is NIST MEASURE in practice.
- **Accountability.** The account is published as the member's (INV:165), matching Reuters' "your name is on a story". AI work is labelled as the system's (INV:111).
- **Information Integrity.** "Cause not established" by default, and stated causes are quoted as stated (INV:119).
- **The AI does not enter the record by itself.** It may read any public site, but nothing it reads enters the record unless captured at a member's or the record's request (AIR rules 11–12).

**Where Civicsmith departs or lacks**
- **Automation bias is measured only at group level.** "How often each kind is accepted unchanged is measured across the group only, never per member" (INV:106). NIST's Human-AI Configuration risk is about *individual* over-reliance. A member who accepts everything unchanged is invisible, by design (DEC-68). The sentence check at publication catches *unsupported* sentences, not *over-accepted readings* that are supported but one-sided.
- **Omission (recall) is not named as a test.** The AI proposes "the passages worth citing" (INV:127). Code checks precision (the quote exists). But if the AI systematically misses exculpatory or contrary passages, no step in INV states that this is measured; NIST's Harmful Bias/Homogenization risk covers this. Test investigations with human answers (INV:123) *could* measure recall, but INV does not say they must, nor that contrary-evidence recall is reported separately.
- **"A fact the AI found loses no strength for that"** (INV:107). This is correct for provenance. But the AI's *selection* shapes what the members ever see. Practice (AP, Reuters) treats AI output as a lead to verify independently; Civicsmith treats a code-verified quote as verified. Both are defensible. The difference is selection, not accuracy.
- **Disclosure to readers.** Reuters discloses when AI use materially affects a story. INV labels system work within the record. Whether the published case tells readers which legs or passages were machine-proposed and member-accepted (the record keeps this, INV:106) is not stated in INV §11.

**Open questions**
- Should test investigations report the AI's **recall of contrary and exculpatory passages** as its own measure, with a bar a reading part must meet before release?
- Short of measuring members, is there an act-time safeguard against rubber-stamping? For example, the system could show at acceptance how many cutting-against passages in the same document were *not* proposed. Or a deliberate counter-proposal pass could run ("what in this document cuts against?").
- Should the published case state, per leg, whether the passage was machine-proposed (accepted as proposed / edited / member's own), as Reuters-style disclosure?

---

## 7. Summary: follows, departs, lacks

| Practice | Civicsmith | Evidence |
| --- | --- | --- |
| Separate information from judgment (ICD 203 §3) | **Follows, strongly** | INV:139–143, INV:119 |
| Gaps as first-class (ICD 203 d) | **Follows, strongly** | INV:52; req/intent:92 |
| Exculpatory and contrary evidence prominent (Berkeley ch. VII; ICD 203 §6) | **Follows** | INV:53, INV:55; CF:329 |
| Completeness and exclusions disclosed (Berkeley ¶210) | **Follows** | INV:92, INV:166; PUB:531 |
| Falsifier / indicators (Heuer step 8; ICD 203) | **Follows** | CM:694–710 |
| Hash, preserve, custody (Berkeley ¶167) | **Follows** | CF invariant 1; AIR rule 4 |
| Replicable sources (IFCN 2) | **Follows, beyond** | INV:169, INV:172 |
| Bias made explicit (ICD 203 a; Bellingcat ¶30) | **Follows, beyond** (Declared Bias) | DB:42–103 |
| AI as unvetted, human-accepted (AP, Reuters) | **Follows** | INV:46; AIR rules 1, 4 |
| Citation verification (NIST 600-1) | **Follows, beyond** (code-checked) | INV:107, INV:121, INV:165 |
| Pre-deployment AI measurement (NIST) | **Follows** | INV:123, INV:108 |
| No naming on rumour (Reddit 2013 lesson) | **Follows** | INV:135, INV:148–149 |
| Competing hypotheses and diagnosticity (Heuer; ICD 203 §4; Berkeley ¶27) | **Lacks** | req/hypotheses:18, R1 |
| Key assumptions check (Tradecraft Primer) | **Lacks** | no construct |
| Standing red team / contrarian pass | **Lacks** (designed, not built) | AIR:143, AIR:164 |
| Search log / how found (Berkeley ¶27; Bellingcat ¶17) | **Departs** | INV:85 |
| Peer review before publication (Berkeley fn. 168) | **Departs** (optional) | INV:170–171 |
| Source-reliability axis (Admiralty, 3×5×2) | **Departs, by ruling** | DB:275–281 |
| Likelihood vocabulary (ICD 203 §2) | **Departs, by design** | INV:119 |
| Firsthand = top grade (3×5×2) | **Inverts letter semantics** | CF:700; INV:141 |
| Explicit warrant per inference (Toulmin; Wigmore) | **Lacks** for ordinary legs | INV:107 |
| Funding disclosure (IFCN 3) | **Lacks** in the published case | INV:111 |
| Individual automation-bias safeguard (NIST) | **Departs** (group-level only) | INV:106 |
| AI recall of contrary evidence | **Not stated** | INV:123, INV:127 |
| PROV interoperability | **Lacks** an export | — |

---

## Sources

All accessed 2026-11-06.

1. *Intelligence Community Directive 203: Analytic Standards.* Office of the Director of National Intelligence. Signed 2 January 2015; technical amendment 21 January 2022. https://www.dni.gov/files/documents/ICD/ICD-203.pdf (served from https://archive.dni.gov/files/documents/ICD/ICD-203.pdf)
2. Richards J. Heuer Jr., *Psychology of Intelligence Analysis*, ch. 8 "Analysis of Competing Hypotheses". CIA Center for the Study of Intelligence, 1999. https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf (landing page: https://www.cia.gov/resources/csi/books-monographs/psychology-of-intelligence-analysis-2/)
3. *A Tradecraft Primer: Structured Analytic Techniques for Improving Intelligence Analysis.* US Government / CIA, March 2009 (file dated April 2009). https://www.cia.gov/resources/csi/static/955180a45afe3f5013772c313b16face/Tradecraft-Primer-apr09.pdf
4. Randolph H. Pherson and Richards J. Heuer Jr., *Structured Analytic Techniques for Intelligence Analysis*, 3rd ed. CQ Press/SAGE, 2019/2020. https://www.sagepub.com/en-us/cab/structured-analytic-techniques-for-intelligence-analysis/book255432
5. "Intelligence source and information reliability" (summarising US Army FM 2-22.3, *Human Intelligence Collector Operations*, 2006, App. B). Wikipedia. https://en.wikipedia.org/wiki/Intelligence_source_and_information_reliability [secondary]
6. "Completing an intelligence report" (3×5×2), Authorised Professional Practice: Intelligence management. College of Policing, 2026. https://www.college.police.uk/app/intelligence-management/completing-intelligence-report [secondary: page returned 403; content via search summary]
7. *Berkeley Protocol on Digital Open Source Investigations.* OHCHR and Human Rights Center, UC Berkeley School of Law; HR/PUB/20/2, New York and Geneva, 2022 (launched 1 December 2020). https://www.ohchr.org/sites/default/files/2024-01/OHCHR_BerkeleyProtocol.pdf
8. *Methodology for Online Open Source Investigations into Incidents Taking Place in Ukraine since 24 February 2022.* Bellingcat and Global Legal Action Network, Justice and Accountability Unit, last updated 14 December 2022. https://www.bellingcat.com/app/uploads/2022/12/JA-Manual-for-PUBLICATION.pdf
9. "How Bellingcat collects, verifies and archives digital evidence of war crimes in Ukraine." Reuters Institute for the Study of Journalism. https://reutersinstitute.politics.ox.ac.uk/news/how-bellingcat-collects-verifies-and-archives-digital-evidence-war-crimes-ukraine [secondary]
10. Craig Silverman (ed.), *Verification Handbook: For Disinformation and Media Manipulation.* European Journalism Centre, April 2020. https://datajournalism.com/read/handbook/verification-3 [secondary for contents]
11. Mark Lee Hunter et al., *Story-Based Inquiry: A Manual for Investigative Journalists.* UNESCO, 2009/2011. https://unesdoc.unesco.org/ark:/48223/pf0000193078 ; 2nd edition, Centre for Investigative Journalism, 2025/2026: https://tcij.org/handbooks/story-based-inquiry/ [secondary: both returned 403; method via ARIJ https://en.arij.net/news/the-a-to-z-of-story-based-inquiry-method/ and EJC https://medium.com/we-are-the-european-journalism-centre/organise-structure-present-effective-ways-of-working-with-information-for-investigative-fc624a735b93]
12. "The commitments", IFCN Code of Principles. International Fact-Checking Network, Poynter Institute. https://ifcncodeofprinciples.poynter.org/the-commitments
13. *PROV-DM: The PROV Data Model.* W3C Recommendation, 30 April 2013. https://www.w3.org/TR/prov-dm/ ; overview: https://www.w3.org/TR/prov-overview/
14. Stephen E. Toulmin, *The Uses of Argument.* Cambridge University Press, 1958; updated ed. 2003. Model summarised at https://courses.lumenlearning.com/suny-englishcomp2kscopexmaster/chapter/toulmins-argument-model/ [secondary]
15. Katherine L. McNeill and Joseph S. Krajcik, *Supporting Grade 5–8 Students in Constructing Explanations in Science: The Claim, Evidence and Reasoning Framework.* Pearson, 2011/2012. Summary: https://cadrek12.org/sites/default/files/McNeill_NSF2010_Final.pdf [secondary]
16. Terence Anderson, David Schum and William Twining, *Analysis of Evidence*, 2nd ed. Cambridge University Press, 2005. https://assets.cambridge.org/97805216/73167/frontmatter/9780521673167_frontmatter.pdf [front matter only]
17. "Burden of proof" and "Beyond a reasonable doubt", *Wex.* Legal Information Institute, Cornell Law School. https://www.law.cornell.edu/wex/burden_of_proof ; https://www.law.cornell.edu/wex/beyond_a_reasonable_doubt
18. "Reddit GM apologizes for 'dangerous speculation' stemming from Boston bombers subreddit." Global News, April 2013. https://globalnews.ca/news/501763/reddit-gm-apologizes-for-dangerous-speculation-stemming-from-boston-bombers-subreddit ; also PCWorld: https://www.pcworld.com/article/451461/reddit-apologizes-for-online-witch-hunt-for-boston-bombing-suspect.html [secondary]
19. "'Not a replacement of journalists in any way': AP clarifies standards around generative AI." Nieman Lab, 16 August 2023 (quoting AP's standards by Amanda Barrett). https://www.niemanlab.org/2023/08/not-a-replacement-of-journalists-in-any-way-ap-clarifies-standards-around-generative-ai/
20. "What Reuters is telling its journalists about using artificial intelligence." Talking Biz News, 14 May 2023 (quoting the memo from Alessandra Galloni and Alix Freedman). https://talkingbiznews.com/media-news/what-reuters-is-telling-its-journalists-about-using-artificial-intelligence/
21. Jennifer Orsi, "A lot has changed since we created AI ethics guidelines for newsrooms. Here's what you need to know now." Poynter, 26 June 2025. https://www.poynter.org/ethics-trust/2025/a-lot-has-changed-since-we-created-ai-ethics-guidelines-for-newsrooms-heres-what-you-need-to-know-now/ ; original kit (March 2024): https://www.poynter.org/ethics-trust/2024/how-to-create-newsroom-artificial-intelligence-ethics-policy/
22. *Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile* (NIST AI 600-1). National Institute of Standards and Technology, July 2024. https://doi.org/10.6028/NIST.AI.600-1 (PDF: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
23. Klaudia Jaźwińska and Aisvarya Chandrasekar, "AI Search Has a Citation Problem" (Tow Center for Digital Journalism). Columbia Journalism Review, March 2025. https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php [figures via Nieman Lab: https://www.niemanlab.org/2025/03/ai-search-engines-fail-to-produce-accurate-citations-in-over-60-of-tests-according-to-new-tow-center-study/]
24. "AI on Trial: Legal Models Hallucinate in 1 out of 6 (or More) Benchmarking Queries." Stanford HAI / RegLab, 2024. https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries [secondary for figures]
