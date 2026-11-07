# Canon research: publication, ratification, docket, signatures, case making, and the principles

Worker: canon-publication (read-only), for the `publication` design lane (session_018BhcecVeBq3c6BYSyTV3Ph). Tree: tranche `705f8823` ("Merge PR 669: lane/publication-seed into tranche"). Every `path:line` below is at that commit. Paths without a directory prefix are under `docs/architecture/`. **(inference)** marks my own reading as opposed to what a text says.

Read whole: `BIO_Publication_v0_1.md` (744 lines), `BIO_Case_Making_v0_1.md` (1330), `BIO_Distribution_v0_1.md` (201), `BIO_Investigation_v0_1.md` (172), `BIO_Design_Requirements_v2.md` (503), the Design Principles artifact (https://claude.ai/artifact/MvsMPnJnk3o32FBeqgdxT1). Read in the sections that touch the topic, each section whole: Roadmap v5 §3–§8 and §10–§12; System Design §1, §7 and row 13; Functional Architecture Layer 3; CORPUS-STANDARD §4; CONSTRUCTS (front matter; it has nothing on publication); Membership v2 §1–§3, §5, §6 (signing key), §7 case ratification, §8; Declared Bias (hunch debt, the acknowledgement, DEC-103/117, regrade, the two-audience choice, the proposed-revision ruling); State Rules §4.4–§4.5, §5.4, the expunge invariant and the amendments at the foot; TAD v10 §4, §5, §8.2 and the bias note; Capability Ladders §2's cross-cutting rulings, §9A, §10 and COURTS' policy points; Action v0_2 lines 17, 24, rules 15 and 17; the old product CLAUDE.md (`docs/archive/CLAUDE-2026-09-26-old-process.md` §2–§5); and the DECISIONS.md entries for DEC-25, DEC-106, DEC-128, DEC-147, DEC-180 and DEC-461.

---

## 1. Principles that bind the lane

The lane's charter: design lanes "decide design and wording" in their own folders "within the product's principles" (`CLAUDE.md:11`; `docs/development/publication-design/README.md:3`). The principles live in four places, from the top down:

**A. Core values and operational principles** (the mission). These are `BIO_Complete_Roadmap_v5.md:337-388` and are repeated in `BIO_Design_Requirements_v2.md:434-469`. The roadmap describes them as "Every operational and design element derives from these four axioms" (`BIO_Complete_Roadmap_v5.md:341`).
- Value 3: "Accountability is built on credible facts. Nothing else holds up." (`BIO_Complete_Roadmap_v5.md:352`)
- OP1: "We hold government to the law and its stated policies. We take no position on what the policies should be." (`:368`). This bounds what a case may argue. Design Requirement 7's amendment keeps it: "Policy advocacy and candidate support are not part of it; Operational Principle 1 stands" (`BIO_Design_Requirements_v2.md:178`).
- OP2: "Show your work. Always." (`:371`). This is the root of the complete edition, the case file, recreation and the in-band stamp.
- OP4: "When the evidence changes, the findings change." (`:375`). This is the root of editions and re-evaluation.
- OP5: "Credibility is demonstrated by the work. Not by credentials, title, or assertion." (`:378`)
- OP7: "No group speaks for Believe in Oakland." (`:384`). Compare DEC-118: the group leads and Civicsmith is never the publisher.
- OP8: "Pressure against supporters is evidence ... Document everything." (`:387`). This links to the docket's pressure marks (`BIO_Capability_Ladders_v0_1.md:1396`).
- Roadmap UX principle: "System prevents errors before publication (compliance dashboard)." (`BIO_Complete_Roadmap_v5.md:799`)

**B. Design Requirements (15)**. The status line says "the system fails if any requirement is violated" (`BIO_Design_Requirements_v2.md:3`). The ones that bear on publication:
- R1, custodians and not authorities: "Administrators are custodians of shared infrastructure, not authorities over the network's content, direction, or work products." (`:83-85`). Two administrators are a recommendation on a group's own copy (DEC-134, `:80-83`).
- R2: one person must be able to "publish findings without requiring assistance from or approval by anyone else" (`:92-96`). This is why rule 11's second reader is disclosed and never enforced (`BIO_Publication_v0_1.md:113`), and why Investigation's approval rule is off by default (`BIO_Investigation_v0_1.md:170`).
- R4: "No review board. No approval process. Any group publishes at any time." (`:110`)
- R5: "No canonical source of truth ... Acceptance is public and traceable" (`:128-131`). This is the root of import, recreation and acceptance.
- R6 as amended (K1483): people materially involved are named with their acts, positions, ties and interests; "Every person a work product names has a recorded basis, checked before publication; the documents it relies on travel whole and unredacted." (`:152-172`)
- R8: evidence is separated from legal strategy, with three risk tiers and a counsel packet "never published" (`:192-236`).
- R10: a directory without pre-approval, flags that "remain visible", mirrorable data (`:279-295`), and DEC-111's move to believeincities.org (`:297-306`).
- R12: "No tool has authority to approve, reject, or gate any work product or action." (`:364-365`)
- R13 and R14: built for active opposition (`:371-388`); "Published work survives the dissolution of the group that produced it." (`:401-402`)
- The bias addendum, as amended by DEC-20: "only an uncleared HUNCH refuses publication ... Ordinary bias debt is DISCLOSED and TRAVELS with every published case" (`:490-503`).

**C. The stance and the doctrine spine** (`BIO_System_Design.md`).
- "The product is therefore **the trustworthiness of the record** ... A defect that lets the record claim more than it can support is worse than a missing feature." (`BIO_System_Design.md:33-36`)
- "undetermined is first-class and must be stated; an equality or outcome that costs nothing to produce is not evidence; derived things inform, authored acts bind" (`:38-41`)
- Spine: "the publication fence sits on the provenance chain"; "A case is a production of a project; publication is one-way; return is a new edition" (DEC-72, DEC-19, DEC-12); "inform once at the act, never nag" (DEC-69) (`:263-269`).
- The canon cites these as "`CLAUDE.md` §2/§4". That text now lives only in `docs/archive/CLAUDE-2026-09-26-old-process.md:54-57` ("'Less narrative' binds us first") and `:109-110` ("Never invent an attribution ... a gate that pressures someone into inventing one is a bug in the gate"). See §6.

**D. The Design Principles** (approved by Bob on 3 October 2026; 58 principles; https://claude.ai/artifact/MvsMPnJnk3o32FBeqgdxT1). The page says it is "the yardstick every screen ... is checked against" and that "A principle changes only by a later ruling." The ones that bind publication screens and wording:
- 1.1 "Never nag, never second-guess" (DEC-69). 1.2 "Nothing chosen for a member unseen." 1.6 "The member's words stay the member's": "Every reason, conclusion and signature is a member's own" (a drafted "What changed" statement is machine work until adopted).
- 3.1 "'Undetermined' is an answer, never an error." 3.2 "Five gaps, five names" (Undetermined, Withheld, Unrated, Nobody looked, Refused). 3.4 "Never one score" ("Capture B · connection C", never "B-"). 3.6 "A grade is about checking, not truth." 3.7 "History is the record: Corrections are added, never erased" (example: a withdrawn docket entry). 3.10 "What you may not see is withheld whole." 3.11 "Never claim more protection than there is" ("not public", never "secret").
- 4.2 "Friction matches weight ... Irreversible acts only go through the publication ceremony." 4.3 "Weight is read before the click." 4.4 "Consequence in the world raises friction." 4.5 "Outward acts say so at the act." 4.6 "Refusals teach."
- 5.1 "Two spaces, two frames ... Publishing is the only crossing." 5.2 "In-between material is labelled" (review copies). 5.3 "Every case shows its path" ("working → shared for review → published"). 5.4 another group's case is marked, read-only, and recreated or not.
- 6.1 "The assistant proposes, never concludes ... never concludes, signs, sends". 6.2 "Machine work looks like machine work." 6.5 "No shortcut past an act's safeguards."
- 8.1 WCAG 2.2 AA for "every published form (page, print and file)". 8.5 "a translated case is never presented as the signed case." 8.6 a phone does not sign or publish "for now". 8.7 "The public reads least, so explain most." 8.8 print and the complete edition are always light.
- 9.3 "The group leads": "Civicsmith is credited quietly." 9.6 "Nothing loaded from outside the group's copy" (the public case included).
- The artifact's footer says it is "Kept in the repository at docs/development/ux-substrate/design-principles.html". That file no longer exists: `docs/development/ux-substrate/` holds README, layouts.html, marks, screens and visual-language. Its README links the artifact (`docs/development/ux-substrate/README.md:17`).

**E. Doctrine stated inside the construct documents that acts as principle for this lane**
- "Publishing IS an irreversible act! It's (one of?) the only irreversible acts" (DEC-19, `BIO_Publication_v0_1.md:44`). The review copy keeps "ONE irreversible act, not two" (`:408`).
- The fence is on the provenance chain: undetermined authority "STATED, dated, and carried into what the public reads. Silence is refused" (`:105`).
- A gate must not push someone to invent: "a gate that pushes a member to recruit a signature is a bug in the gate" (`:113`). "a gate that pressured a member into filling a gap to get a review copy out would be a bug in the gate" (`:525`).
- "The tool should make a supported case easy to build and an unsupported one hard to state" (`BIO_Case_Making_v0_1.md:341-345`). The threat model is symmetric and "its more dangerous half is ours" (`:311-317`).
- A case's completeness claim "is the most dangerous one this system can make" and stays "an explicit AUTHORED ACT", never a checkbox (`BIO_Case_Making_v0_1.md:455-459, 545-553`).
- "Lying is not bias", and a case carries no stories (D56, D57; `BIO_Case_Making_v0_1.md:345`; `BIO_Investigation_v0_1.md:165-167`).
- "Bad actors are ... identified BY EVIDENCE, never assumed by role" (`BIO_Case_Making_v0_1.md:323-329`).
- The machine never concludes, and a label is not a refusal: Capability Ladders §10 (`BIO_Capability_Ladders_v0_1.md:1406-1436`). Every rung keeps it, and "the rule changes only by his ruling" (`:1408`).

---

## 2. Publication canon (`BIO_Publication_v0_1.md`)

**Standing of the document.** "v0.1 DRAFT ... Awaiting Bob's review. It RULES NOTHING: every rule below is restated from the ledger it was ruled in" (`:3`). Rulings were folded in up to DEC-270 (2026-10-15), and the status ends "as of 2026-10-15" (`:3`). It is the level-1 home of construct 13 (`:5`; `BIO_System_Design.md:92`). It does not own the inquiry and finding, the bias doctrine, cover and handle, platforms, interaction constructs or bucket isolation (`:744`).

### 2.1 What is published, and what publication is
- Publication is "the point where the record's trustworthiness becomes public and irreversible", the act by which the group "STANDS BEHIND a production" so that a stranger "with no credential and without this instance's cooperation" can verify it (`:44`). The path is release → stand behind → ground → conclude → accept → ratify → publish (`:44`).
- Three consequences: the projection is content-addressed, signed and readable by non-BIO tooling; it may not claim more than the record supports; "a correction moves forward, never back", so revision is a new EDITION (`:46`).
- The objects (`:50-60`):
  - the **case**, a production of a PROJECT (DEC-72, DEC-44);
  - the **bar** (`required_strength`), a property of the project, "strictest wins";
  - the **edition**, where a citation names an edition and "supersession is surfaced, not followed";
  - the **exclusion statement**, fresh per edition (C-21.1);
  - the **bias acknowledgement**;
  - the **case document**, the signed artefact;
  - the **timeline**, frozen at signing, with the lanes "what they did" and "what we did" never mixed (K1494);
  - **the people named**, each with a recorded basis (K1483);
  - the **published projection** (`published_*` tables and the `PUBLISHED` bucket, "structurally separate").
- The forms (DEC-112, `:340-354`). The test is "ANYBODY can review it, and even recreate it, without a Civicsmith copy" (`:342`).
  - **The public page.** Each finding opens with "Relied on · meets this project's bar (capture B, connection C)", "never a bare 'meets'"; then "a case has two strengths, never one" (`:344`).
  - **The complete edition.** A self-contained file with no length limit, ordered so a reader can stop early, carrying "How to check this case yourself" and the identifying notice. "It may never be printed; printing is incidental" (`:346`). (inference: "may never be printed" probably means "need never be printed". The wording reads as a prohibition and is worth confirming.)
  - **The case file.** A published, versioned, complete structured record, split and never trimmed, with an open specification and a standalone checker (`:348`).
  - **Presentability gate.** "Publication is refused while a relied-on (load-bearing) finding rests on material that cannot travel in the case file whole". Material under supporting findings travels as fingerprint, origin and archive, "labelled as not included". The warning says copyright is the group's judgement (`:350`).
  - **Off-the-record sources.** Material travels whole, and only the source's identity is "Withheld" with its reason. An anonymous member's testimony needs "an independent corroborating leg" before a relied-on finding is signed (DEC-119, DEC-102; `:352`).
  - **Import.** Recreation per finding gives Recreated, Recreated in part or Did not recreate. "Recreating is not endorsing", and acceptance is a reasoned act (DEC-96) (`:354`).
- **Printed lens.** Every bias statement in force is printed into the signed case, with the publisher's acknowledgement first and DEC-117's two closing sentences verbatim (`BIO_Declared_Bias_v0_1.md:553-566`).

### 2.2 By whom
- Rule 2: "Only a project publishes, and only its manager": "the publisher is a manager of the project, by default its owner; a case requires at least one load-bearing member" (DEC-72, `:65`).
- Case ratification's two questions are spelt once in `Store#caseAuthority`. **Authority**: an OWNER of the project signs (C-57.1). **Delivery**: the founder or a JOINED member delivers (C-56.1). "Delivering is carriage, not direction" (`:72-76`; `BIO_Membership_Architecture_v2.md:832-852`). An administrator with no role in the project may not deliver (`BIO_Membership_Architecture_v2.md:838-840`).
- Membership §5: "**publish** — ratify, which additionally requires a registered signing key. The capability governs the surface; the key governs the authority." (`BIO_Membership_Architecture_v2.md:593-594`). A key may be registered only to an enrolled, active member (D-158, `:657-679`).
- Machines never publish: `MACHINE_CANNOT_PUBLISH` (`BIO_Declared_Bias_v0_1.md:505-506`). Principle 6.1.
- Attribution, rule 7: a member's contribution is attributed at one of four levels (group, project, cover, name), which is the member's own choice. Since DEC-102 the level also sets the testimony's weight, and group or project level counts as anonymous (`:109`). Handles appear in the record and covers are never published (`BIO_Membership_Architecture_v2.md:177-203`).
- Public identity: the slug is public and written once. The display name is shown only with the slug. A domain is shown only while verified (`:588-678`). The group leads, with "Made with Civicsmith" in small type (DEC-118, `:688-692`). The group's own logo is optional (DEC-125, `:701-704`). Civicsmith's mark is "a maker's credit, never an endorsement or a seal" (DEC-126, `:706-710`).

### 2.3 Gates (what refuses publication, and what never does)
- **Refuses:**
  - an uncleared HUNCH (`UNCLEARED_HUNCH`, rule 4, `:106`; `BIO_Declared_Bias_v0_1.md:285-307`);
  - a finding below the project bar (`BELOW_PROJECT_STRENGTH`) or not concluded (`NOT_CONCLUDED`, `:528`; `BIO_State_Rules_Consistency_v1_5.md:1753-1762`);
  - an absent bias acknowledgement (`NO_BIAS_ACKNOWLEDGEMENT`), or one carried forward from the last edition (`BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD`) (`BIO_Declared_Bias_v0_1.md:503-519`);
  - a stale exclusion statement (C-21.1, `:55`);
  - a relied-on finding resting on material that cannot travel (`:350`);
  - an anonymous-only relied-on finding with no corroborating leg (`:352`);
  - a person named without a recorded basis (`:59`);
  - a sentence the record contradicts (D56; `BIO_Investigation_v0_1.md:165`);
  - the fence: a chain absent, malformed or empty (C-18.9, `:105`, `:289`).
- **Never refuses:**
  - ordinary bias debt, which is disclosed (`:106`);
  - want of a second reader's acknowledgement (rule 11, `:113`);
  - a one-axis bar, where the unset axis is `null` and stated in words (rule 14, `:160-168`);
  - an unresolved RECORD contradiction, which is disclosed (DEC-76, `BIO_Case_Making_v0_1.md:866`);
  - an UNRATED strength, which is "honest, publishable, and impossible to hide" (R1, `BIO_Case_Making_v0_1.md:1168-1170`);
  - since DEC-461, passages left ungraded: "signing lists every passage still ungraded ... and the edition states it was published with them ungraded" (`docs/development/DECISIONS.md:7050-7062`).
- **The preflight** (REC-15) runs the real refusals "BEFORE the first screen" (DEC-80, `:305-307`).
- **Investigation adds** (`BIO_Investigation_v0_1.md:165-171`):
  - every sentence of the case's account, and of the case's statements about itself, is checked against the evidence it cites;
  - framing is allowed only under a printed bias statement;
  - a group may set an approval rule naming members whose approval is needed before signing, "off by default, so a group of one is never blocked".

### 2.4 Ratification and the ceremony
- The order is the case document first, then each member finding signed: `ratifyCaseDocument` commits the case and its pins "BEFORE any member signs a finding" (`:80-82`).
- Nothing crosses outside a ratified case. (a) A finding crosses only at a sha a RATIFIED case pins (C-58.2). (b) Any other bundle crosses only as evidence a pinned finding rests on (C-58.3). (c) What already crossed stays crossed, and the count was 0 (`:80-99`; D-431).
- Publishing writes nothing on a member finding. Everything the old promotion wrote is stated ONCE, in the case document (rule 12, `:116-117`; D-442).
- **The ceremony was undeferred by DEC-80 (2026-09-29)** (`:298-310`).
  - Its five steps: "what becomes permanent"; "what this rests on"; "what you are leaving out" (exclusion statement and acknowledgements, what was searched, bias, disclosed record contradictions per DEC-76, consent for any source identity per DEC-78); "the edition this creates"; "sign" (`:300-305`).
  - "**An owner signs in the browser**": a browser-held key registered as the owner's attesting key produces the same `sshsig`, confirmed by passphrase or device unlock. Founder delivery (D-421) "stays as a fallback" (`:307-310`).
  - NOT BUILT (`:8`, `:728`).
- Friction: "Irreversible acts only go through the publication ceremony" (principle 4.2). On a phone, signing happens "on a larger screen for now" (principle 8.6).
- Later rulings shape the ceremony but are not in this document (see §6.1):
  - **DEC-147** (2026-10-06): "Publish now" or "Publish at…". The signed edition waits, unpublished, as "Signed · publishes <date, time>". At the time every check is re-run, and if anything changed it does not publish and tells the owner once. The owner may cancel or move the time. The public page shows both the signing date and the publishing date (`docs/development/DECISIONS.md:2337-2352`).
  - **DEC-180**: a Photos step marks faces and number plates for obscuring (`docs/development/DECISIONS.md:2811-2825`).

### 2.5 Signatures and keys
- The case document is signed. The format has moved through four versions:
  - `/2` (rule 12) adds per-member editions and frozen strength pairs;
  - `/3` (rule 13) requires the bias manifest and the acknowledgement list, and C-41.13 refuses one without them;
  - `/4` (rule 18) requires the pending-adoption disclosure (C-41.14) and the pinned citation edges (C-41.15).
  - Older documents "ratify exactly as written" (`:115`, `:119-127`, `:193-239`).
- The gate stamp names the check-catalogue version, "one version names exactly one catalogue" (rule 17, `:186-192`).
- A rendering is verified by its pixels: `pixels_sha256` verifies, and the file's sha is "informative only". RULED and NOT BUILT (rule 16, `:179-185`).
- **Key custody** (`BIO_Distribution_v0_1.md:168-201`):
  - three keys: the release key (`bio-release`, `bio-release-fleet`), the recovery key (Bob only, offline), and "a **ratify key** | a member's ratifications (`bio-ratify`) | that member's copy's signer registry ... never the installer | the member's own" (`:172-178`);
  - namespaces "are what stop a ratification signature installing software" (`:47`);
  - the development ratify key `BIO_RATIFY_SEED` is replaced at the custody sitting (`:180`);
  - "RULED NOT BUILT until they land" (`:170`).
- A group's public page "lists its owners' public signing keys, without names", so a reader can check that a notice's or a case's key belongs to that group (DEC-111, `BIO_Publication_v0_1.md:332`).
- Docket entries are signed by "the project's manager ... with their registered key in a short step" (`:370`).

### 2.6 The docket (DEC-100, DEC-116; `:356-374`)
- "A case is a waypoint, not an end product." Each case has a docket of "dated entries beside it, each naming the edition it concerns, growing while the signed editions never change" (`:358`).
- **Standing.** The named subject has party-like standing. The group may grant standing by a signed entry with a reason, and withdrawing it covers future submissions only. There are no confidential entries. "Only the submitter redacts its own material", and the group may decline redacted submissions. Off-the-record contacts with the subject need not be disclosed (`:360`).
- **Three shelves** (`:362`):
  1. "stands behind as accurately listed", which vouches for the listing and is "not agreeing with it";
  2. "Reactions elsewhere", labelled "Listed by the group. Not evidence. Not endorsed.";
  3. "In our record only".
  - Checks are on form, never merit. "A docket entry never makes anything evidence."
- **Required core**, each a To-do for the manager: every subject response; the subject's captured public statements; a newer edition (quoting §5A's statement); a withdrawal; and anything the case would have had to disclose at signing (`:364`).
- **Outside responses.** They are found by pasting a link, by a watch, or by the assistant's labelled suggestion. A member chooses record, public or both, with a reason. A public reaction shows a short summary "marked as the group's words, never the article whole" (`:366`).
- **A reply that names a private person** is listed without its text, and the subject is asked to resend it (`:368`).
- **Who acts.** Any member files to the record. Only the manager places an entry in public. "An entry is taken back by a later entry with a reason, never deleted." (`:370`)
- **How it travels.** By pull only: the public page, a feed per case with "no list of readers kept", citing groups' copies, and the directory. "Civicsmith sends no email." A citing copy that cannot read the feed says "Could not read the publisher's docket", never that nothing changed (`:374`).
- **Actions write to the docket.** A member's act puts a dated outcome entry on the published case's docket (`BIO_Action_v0_2.md:70`, rule 17). Layer 9 writes to it "by a member's act (layer 9 calling layer 8)" (`BIO_Capability_Ladders_v0_1.md:1396`).

### 2.7 Schedule and outward signals
- "Working on" notices (DEC-111, `:320-338`). They come only from a project and only from its owner, after the warning (`:324`). They carry the group's slug, never a member's name; the owner's own wording, "never filled in from the project's contents"; a since-date; the activity level (five worded steps, members' acts only, re-signed monthly); optional "Interested in collaborating"; and links to the cases (`:326-328`). Weekly sealed proofs are opened at publication (`:330`). They are signed like a case (`:332`). Their honest limit: "A signature proves who said it, not that it is true" (`:336`). The network site's policy is Bob's as domain holder, "not Civicsmith's rules" (`:338`).
- Every later edition carries "What changed in this edition, and why". The system may draft it as labelled machine work. Citing copies watch other groups' editions, and "Nothing is pushed between groups" (DEC-101, `:312-318`).
- The civicsmith.org listing is declined or removed only under the published four-part rule, "never for a group's views, its conclusions, or whom it holds to account" (DEC-255, DEC-270, `:376-380`).
- Scheduled publishing (DEC-147) is in the ledger and the requirements, not in this document (see §6.1).

### 2.8 Public reading
- Rule 10: "The public read path is credential-free and pinned to the record namespace". `op=verify` and `op=publishedmanifest` answer from the projection only (`:112`). Membership §8.2 says published-record reconstruction "requires nothing at all ... Nothing can be withheld here, by construction" (`BIO_Membership_Architecture_v2.md:1404-1410`).
- An UNSIGNED case document answers only to project standing or a live grant. Everyone else gets the answer for a non-existent case, so enumeration learns nothing. A SIGNED one is public (`:244`, `:412-420`).
- Rule 9 / DEC-31: "Anything leaving the instance addressed to someone carries hash, date, author and both threshold floors in-band" (`:111`).
- Audiences: an audience is "a READER of a published case". Divergence is "a property of the OUTPUT ACT rather than of the case". The falsifiable test is "If the second audience built costs a new `action_kind` and a rendering, this is right. If it costs a field on the case, it is wrong." (`:384`). Three divergences: certification and persistence are "unmade", and addressing is answered by §6A (`:386-392`). The eight audiences are enumerated only in `docs/archive/research/AUDIENCES.md`, which carries a correction banner. DEC-128 regrouped audiences into three rings and made newsrooms a core audience (`docs/development/DECISIONS.md:2067-2081`).
- The bar is set in plain letters with the line "Civicsmith has no guidance yet on what particular audiences expect". Audience guidance comes later "as a sourced fact in the jurisdiction profile ... never preselected" (DEC-105, `:680-686`). The catalogue of standards by audience is "OWED" (`:586`, `:730`).
- Principle 8.7: "The public reads least, so explain most."

### 2.9 Review copy (§6A): the addressed act that never leaves
- It "stands BESIDE publish", is MARKED, is "as complete as a full publication can be", and "NAMES WHAT IS MISSING". It is named "*advance copy* or *review copy* ... **not *pre-publish***" (`:396-398`).
- It is mutable, because "Only a real publish is not" mutable (`:406`).
- The grant (`:425-433`):
  - scoped to one production;
  - revocable;
  - read and comment, not edit;
  - attributed;
  - never a third bucket.
- Who may act (`:435-446`):
  - a holder of the project's edit permission authors;
  - only the OWNER issues or revokes, with "no administrator bypass";
  - there is "No two-person rule".
- The bearer secret is stored hashed, and a dead secret reads exactly like one that never existed (`:450-455`).
- The member's door alone offers export. Every page carries the in-band quartet. The file leaves out the roster and the comments. The record does not log exports (`:507-519`).
- The exclusion statement leads the copy. The gates' refusals become the list of what is missing "rather than applied as a wall" (`:527-531`).

### 2.10 Corrections, withdrawal, removal
- **Corrections.** "A correction always moves forward" (rule 1, `:64`). "A claim can be removed from a finding, rescinding it to an inquiry; the published edition stays" (`:64`). Every later edition states what changed (§5A). A published case "cannot be divided. It can only be superseded" (`BIO_Case_Making_v0_1.md:639-642`). A published child names its parent and its siblings (R4, `:1306-1310`).
- **Withdrawal** (DEC-116, `:372`). "Withdrawal is not a correction: a correction says 'here is what we now conclude'; a withdrawal says 'we no longer stand behind this'." It is the manager's signed docket entry naming one edition or all, with a published reason. The edition "stays readable under a stamp". It is "never lifted", so standing behind the case again needs a new edition. It sends re-evaluation notices (State Rules §5.4). "It never erases."
- **Court order** (K1480). It is complied with, "never silently": captured, named in a signed docket entry, and the edition stamped. Sealing and unsealing orders are handled the same way (`:372`; `BIO_Capability_Ladders_v0_1.md:161`, `:1102`).
- **Personal facts** (K1493). Removal "leaving a marker" reaches this instance, future exports and future editions. "Past editions stand" (`:372`; `BIO_State_Rules_Consistency_v1_5.md:1295-1316`).

---

## 3. Case Making canon (`BIO_Case_Making_v0_1.md`)

**Standing.** This is a reasoning record, "Superseded as design authority (by the plane, `docs/development/DECISIONS.md`, and DEC-72 for the case section); complete as the reasoning record. Read it for WHY" (`:3`). "several body sentences are now false as written" (`:3`, list `:7-16`).

- **The frame** (Bob): "answer questions, make a case, tell a story, and take action". The path is questioning → exploring → discovering → documenting → impacting, "*And* sharing the products" (`:94-104`). "'Output' is a noun and also a verb ... A design that names only the noun will end up with a case file nobody had to decide to publish" (`:122-126`).
- **The work versus the output.** "a **project** is the investigation, private and allowed to contain dead ends; a **case** is what leaves" (`:141-144`).
- **Why a case exists.** "a case makes a COMPLETENESS CLAIM and a finding does not ... the most dangerous one this system can make. A published finding that is true but selectively chosen is not a lie at the finding level and IS a lie at the case level" (`:448-459`). The gate is "has the author stated what was excluded, and why" (`:477-484`). "A case is ADDRESSED and a finding is not" (`:488-491`).
- **DEC-72 amendment.** The case is "a PRODUCTION OF A PROJECT — a set of finding-versions plus the publishing project, published by a project owner against the project's own bar, members pinned by version" (`:588-596`). `published` leaves the inquiry machine, and "only a CONCLUDED finding may be a case member" survives as `NOT_CONCLUDED` (`BIO_State_Rules_Consistency_v1_5.md:1725-1783`).
- **Audience is rendering.** "one case with audience-shaped renderings". The sharp difference is "the strength a claim must reach before that audience can use it". A rendering "says what it excluded and why" (`:268-288`). There is a caution against designing for four audiences at once: "a second audience costs a RENDERING rather than a rewrite" (`:347-357`).
- **Less narrative** (4a). A story is what the record supports; a narrative is an imposed frame. "nothing that drafts framing FOR a member". The exception is D56: the system may draft the account in labelled framings, every sentence is checked, and only framing that follows a printed bias statement stays. D57: "a case carries no stories" (`:331-345`).
- **Strength.** R2 makes it a PAIR, never a scalar, as two populations: capture over documents and connection over edges (`:1240-1278`). R1 with DEC-18: an ungraded leg is INERT and named; UNRATED is the boundary case and publishable (`:1153-1214`). DEC-32: grounds compose AND/OR (`:789-804`; spine `BIO_System_Design.md:265-266`). The falsifier is "ACCOUNTED FOR", and "no falsifier stated" is published with who accepted it (`:699-735`).
- **Division** (`:621-665`). Division is necessary under weakest-link. A published case cannot be divided. "A published case is an INPUT, not a terminus", and a citing inquiry inherits its strength (`:653-662`). R4: division costs at least what severance costs, and a published child names its parent and siblings (`:1296-1310`).
- **Contradiction** (`:806-886`). Contradictions in the world are "golden nuggets". A contradiction in the record is a defect with a duty to identify, present and resolve. Imprecision is not a contradiction (`:822-846`). DEC-76: resolving one is an inquiry with a recorded kind. "A finding resting on an unresolved RECORD contradiction may be published, with the contradiction disclosed" (`:866`). DEC-77: met inline, with context that supports and never silently decides (`:868`).
- **The action plan and publication.**
  - "the gate belongs at the ACT, not at the reasoning" (`:1012-1014`).
  - Support status (established, short of the standard, hypothetical) shows wherever a plan element does (`:1030-1055`).
  - "**What, if any, of a plan is PUBLISHED?**" The provisional answer: "the plan is WORKING material and is never published" (DEC-25, deferred; `:1112-1124`; `docs/development/DECISIONS.md:418-440`).
  - Action v0_2 rule 15 now says "A published case's record of actions holds the group's outward acts only: never the plan's deliberation, never a confidential act, never a counsel matter" (`BIO_Action_v0_2.md:66`). See §5.
  - "AN ACTION IS NEVER A LEG" (D-181, `:1126-1145`).
- **Fee quotes and records requests**, in Case Making §2 because `action` is the impact substrate. "The record asserts only what was quoted, by whom, when, for which request" (`:193-203`). Governing laws are named by citation and never encoded (`:205-231`). The records-request lifecycle (`:233-254`). "A quote is read 'by' the action's own counterparty name, matched EXACTLY; when nothing matches, it is stated as undetermined (D-148's gap). NOT BUILT" (`:229-231`). This is the same ruling as Publication rule 15(d); see §6.2.
- **Open questions never reconciled** (`:1312-1330`, flagged at `:16`). Q2 (one object with renderings) and Q4 (strength) are answered in the body. Q5 (tension inside one case) is answered by DEC-76. Q6 (the action-to-consequence loop) is now Action v0_2's.

---

## 4. Distribution (`BIO_Distribution_v0_1.md`)

- v0.1 DRAFT, "RULES NOTHING", "Awaiting Bob's review", "as of 2026-09-25" (`:3`).
- "**The distribution model IS the product.**" A sovereign instance in the group's own account, with "no hosted service, no central record, no operator who can read a group's evidence" (`:31`). The boundary buys "a stranger can verify what it published without the instance's cooperation" (`:39`).
- Two buckets per instance, `CAPTURES` and `PUBLISHED` (`:37`). **Today one account's instances share one `bio-published` bucket, which "breaks the publication fence across groups"**. Isolation is planned, not built, and sequenced after the member surfaces (`:145`; `BIO_Publication_v0_1.md:290`, `:738`).
- Release signing and the namespace split (`bio-release`, `bio-release-fleet`, `bio-ratify`). The namespaces stop "a ratification signature installing software" (`:47`).
- Key custody (§10, K1936, K2277): the three keys, rotation in four acts, no revocation list, and the recovery key's single use. "RULED NOT BUILT until they land" (`:168-201`). Relevant to the lane: the **ratify key is the member's own**, held in the copy's signer registry (`:178`), and DEC-80 puts it in the owner's browser (`BIO_Publication_v0_1.md:307-310`).
- Installer gate (DEC-415): "Check my account" before install (`:82`). This matters to publication only indirectly.
- The development `BIO_RATIFY_SEED` is replaced at the custody sitting (`:180`). The standing approvals let sessions "cause those deployments to sign development releases and development catalogue seeds with the signing secrets they hold" but never "sign anything with my own offline keys" (`CLAUDE.md:9`, `:13`).

---

## 5. Touchpoints in other canon

| doc | what touches the lane | cite |
|---|---|---|
| Membership v2 | Ratification is a consequential act needing attribution. The fence between buckets is "The load-bearing fence", not membership. Cover never published, handle in the record, pairing published per member. `publish` capability plus key. Key only for an enrolled member (D-158). Case ratification: owner signs, joined or founder delivers. §8.2 public reconstruction needs nothing. | `:102-114`, `:156-162`, `:177-203`, `:593-594`, `:657-679`, `:832-852`, `:1404-1410` |
| Declared Bias | Bias debt disclosed versus HUNCH DEBT disqualifying. Manifest computed and frozen, acknowledgement authored "at the time of export by the publisher (not a pre-check checkbox)". Fresh per edition. One per case per edition. DEC-103 full lens printed. DEC-117 two sentences. Regrade ruled to be built (D59). "Published work carries its bias manifest, and opponents will quote it." | `:285-347`, `:472-539`, `:553-566`, `:581`, `:591-597` |
| State Rules v1.5 | `published` leaves the inquiry machine. `NOT_CONCLUDED`. `PUBLISHED_CANNOT_BE_SET_DOWN`. Cascade on retraction (`reeval_pending`). Expunge tombstone: past published editions stand. `confidential` never published, never retroactively. The legacy Work Product "distribution" mechanics (frozen `dist-NNNN`, audience internal or external). A document signed under a WRONG producer: "a correcting act is undesigned". | `:1725-1783`, `:1088-1104`, `:1295-1316`, `:931-933`, `:978-984`, `:1822-1823` |
| TAD v10 | Work Product as a "publishable member", focusing versus distribution, internal versus external readiness, "no transitive trust" (revised, `:11`), risk tiering at external distribution, the distribution surface (audience, strictness, risk tier, directory). Pre-DEC-72 vocabulary. | `:422-518`, `:545-579`, `:913-916` |
| Functional Arch. v3 | Layer 3 "Evaluate and publish": the Compliance Skill evaluates before publication, and the readiness ladder advances only on recorded evaluations. Communication "show your work, institutional framing, policy neutral". | `:384-397`, `:408-414` |
| Capability Ladders | Cross-cutting rulings: removal and court orders, published timeline, member ties ("each publishing member attests to no undeclared tie"). §9A Actions: the published record of actions, "checked and held" findings, docket writes. §10 doctrine every rung keeps. DEC-461 amendment (ungraded passages). | `:159-163`, `:1102`, `:1396`, `:1401-1404`, `:1406-1436` |
| Investigation v0.1 (in force) | Cites Publication for checks, five screens, browser signing, "scheduled publishing", editions, docket, withdrawal (`:163`). New in §11: the account checked sentence by sentence; self-statements checked; no stories; framing only under a printed statement; reader re-check under a lens; **approval rule off by default**; **reviewers: "A reviewer's objection does not travel with the case automatically"**, a non-included reviewer may add comments afterwards as anyone outside may; accept a whole case in one act. | `:161-172` |
| Action v0_2 (approved) | Determinations rest on published findings, "checked for publication and held" findings, or accepted findings. A held determination moves to the edition when published. Published record of actions. Docket outcome entries. "stopped pursuing" shown dated with reason inside. Counsel matters never published (also `build/requirements/publication.md` R78). | `:17`, `:24`, `:66`, `:70` |
| Roadmap §11 | Origin mark (DEC-92), acceptance as a reasoned act (DEC-96), import and recreation (DEC-112), "working on" (DEC-111). | `BIO_Complete_Roadmap_v5.md:697-743` |
| DECISIONS ledger | DEC-106 two spaces, path marker. DEC-128 audiences in three rings, newsrooms core, "releasing a case when its story runs". DEC-147 scheduled publishing. DEC-180 photos obscured in the published copy. DEC-461 ungraded passages stated. DEC-25 plan not published (deferred). | `docs/development/DECISIONS.md:1716`, `:2067`, `:2337`, `:2811`, `:7050`, `:418` |

Requirement modules exist below this canon and are not read here: `build/requirements/publication.md`, `docket.md`, `case-authoring.md`, `case-account.md`, `case-carriage.md`, `case-catalogue.md`, `case-check.md`, `case-checker.md`, `case-disclosures.md`, `case-grammar.md`, `case-import.md`, `case-inputs.md`, `case-tensions.md`, `signatures.md`, `credentials.md`, `publish-schedule.md`, `ratification.md`, `review.md`, `screens-publish.md`, `screens-public.md`, `network-notices.md`, `public-read.md`. They carry DEC-147 (`publish-schedule.md`; `ratification.md` R42, R49) and DEC-461 (`ratification.md` R62, R63), which the Publication canon does not.

---

## 6. Stale, conflicting or unresolved points

### 6.1 Rulings not folded into the Publication canon
This is against CORPUS-STANDARD §4 rule 2: "A ruling about a construct is folded into the construct's home document" (`CORPUS-STANDARD.md:137-139`).
- **DEC-147, scheduled publishing** (2026-10-06, `docs/development/DECISIONS.md:2337-2352`). It is absent from `BIO_Publication_v0_1.md`: the word "schedul" occurs there only in session names. Yet Investigation cites "scheduled publishing" as being in "Publication §3, §5, §5A and §5D" (`BIO_Investigation_v0_1.md:163`). This also qualifies Publication's ceremony and DEC-19's moment of publication, which today is "the moment an owner signs".
- **DEC-180** (photos), **DEC-461** (ungraded passages stated in the edition), **D56/D57** (the account check, no stories; folded into Case Making and Investigation but not Publication), **Investigation's approval rule (D60)**, and the **published record of actions** with "checked and held" cases (Action v0_2): none of these appear in Publication. (inference: there may be more. I did not sweep `build/rulings.md` past 2026-10-15.)
- Publication's status date is 2026-10-15 (`:3`). Distribution's is "as of 2026-09-25" although its §5 gained DEC-415 (2026-10-22) and §10 gained K2277 (2026-10-08) (`BIO_Distribution_v0_1.md:3`, `:82`, `:198`). That is against CORPUS-STANDARD §4 rule 1 (`CORPUS-STANDARD.md:133-136`).

### 6.2 Is Publication §3 rule 15(d) stale? Yes, and so are (b) and (c)
- Rule 15 says: "(a) BUILT ... (b)–(d) NOT BUILT (rowed)" (`BIO_Publication_v0_1.md:175-177`).
- **(b) is BUILT.** `op=reviewcopy` answers `newCase` since REC-199 (IC-285). The same document says so at `:3` and `:251`, and in §6A.4 (`:3`, "the copy's `case` block carries `newCase`").
- **(c) is BUILT.** The copy's date is its LAST change since REC-200 (IC-284) (`:488-504`; `:3`).
- **(d) is built in substance in the plane, with a caveat (inference from code).** (d) is a fee-quote rule (D-148's gap), not a review-copy rule. Its home is Case Making §2 (`BIO_Case_Making_v0_1.md:229-231`), which also still says "NOT BUILT".
  - The plane's `actionQuotes` reads quotes `counterparty=` as "the action's own named counterparty, matched exactly as written". An empty answer names its level (`no_quote_by_name`). An action whose counterparty is stated undetermined "is reachable only by its request" (`bio-plane/src/actions/index.mjs:2441-2539`).
  - Not verified: whether a quote row ever states its "by" as undetermined in words. The row carries `counterparty` and `party` as stored.
  - So (d)'s "NOT BUILT" is at least partly stale, and the rule sits in the wrong construct document. A requirements or code worker should confirm.
- Rule 15(a) itself has an open residue. The ruling says "joined participants", but the build "CALLS the single read's fence, which admits every participant and not only a joined one, a gap raised to BOB" (`:170`, `:175-176`). §4 then describes that as intended: "shown to every participant the plane admits, the invited-not-joined member included" (`:10`, `:271-273`). It is unclear whether this was ruled.

### 6.3 Internal staleness in `BIO_Publication_v0_1.md`
- §2's table names the case document `bio-case-document/2` (`:57`). `/3` and `/4` are now authored (`:115`, `:202-203`).
- §4 lists "C-41.1–.12 the case-document family" (`:289`). C-41.13 to C-41.15 exist (`:115`, `:212`, `:233`).
- The Incomplete note under §6A says "What is NOT built: the review refusal codes' canned translations" (`:10`). The status line says D-448 built them (`:3`).
- The Incomplete note for §3 rule 11 says both "The `/3` format IS BUILT" and "STILL NOT BUILT of rule 13: the `/3` format, the case document's own `completeness.author`" (`:12`). Rule 13's body likewise ends "NOT BUILT: the `/3` format" (`:127`), after REC-188 and REC-212 are recorded as built (`:115`, `:127`).
- §6A.3 calls D-573 "a design question ... reported by D-543 and not invented here" (`:505`). The status line says D-573 was ruled by BOB #34 at 01:05Z on 2026-09-25 (`:3`).
- The Incomplete note under §8 and the §9 row call risk tiers "half-built: the UI writes placeholder values" and "half-built and dishonest (D-182)" (`:16`, `:734`). §8's body says "The placeholders that satisfied the check are gone" (`:720`).
- The Incomplete note under §3 rule 2 says C-21.2 "forces that order" (`:14`). The rule's body says "no longer since D-598" (`:103`). The serve-edge gap itself is still marked "Not decided; for BOB".
- §5's first paragraph says "Until then a member reaches the placeholder" (`:296`). It is retired by DEC-80 (`:298-299`).
- §9's row "attribution levels ... no surface" (`:729`). System Design records `op=attribute` built on the plane (MK-7, IC-319) (`BIO_System_Design.md:92`). That is consistent if read as plane built and member surface absent, but the row does not say so.
- Rule 11: "Whether an unresolved objection to the statement travels with the published case is doctrine, and NOT ruled here" (`:113`, also `:12`). **Investigation (in force, K2420) answers it**: "A reviewer's objection does not travel with the case automatically" (`BIO_Investigation_v0_1.md:171`). Publication was not updated.
- §5C says "It may never be printed; printing is incidental" (`:346`). This is probably meant as "it need never be printed" (inference). As written it reads as a ban, which conflicts with principle 8.8 ("print and the complete edition are always light") and principle 8.1 (print accessibility).

### 6.4 Conflicts across documents
- **Membership v2's Incomplete note says D-429 is "UNDECIDED"** (`BIO_Membership_Architecture_v2.md:13`). Publication §3 rule 2 records it applied by BOB #15 and built by REC-140, and D-431 decided by BOB #16 (`BIO_Publication_v0_1.md:66-99`).
- **Declared Bias says the acknowledgement "is written into EVERY member finding before the sha is taken"** (`BIO_Declared_Bias_v0_1.md:512-514`). Publication rule 12 says publishing writes nothing on a member finding, and the case document carries it (`BIO_Publication_v0_1.md:116-117`).
- **Declared Bias says a `/4` carrying the proposed-revision marker is "not REC-210's"**, so it is still open there (`BIO_Declared_Bias_v0_1.md:207-210`). It is built as `/4`, C-41.14 (`BIO_Publication_v0_1.md:193-219`).
- **Declared Bias §Bias debt says `op=publishpreflight` "exists"**, and its own Incomplete note says it is deferred (`BIO_Declared_Bias_v0_1.md:12`, `:294`, `:345`, `:439`). Publication §5 says the preflight (REC-15) is undeferred and NOT BUILT (`:8`, `:305`).
- **"Manager" versus "owner".** Rule 2 says the publisher is "a manager of the project, by default its owner" (`:65`). Docket placement and withdrawal are "the manager's" (`:364`, `:370`, `:372`). Signing (C-57.1), grants (§6A.2) and notices (§5B) are the OWNER's (`:72-76`, `:439-445`, `:324`). Nothing defines a manager who is not an owner. (inference: the vocabulary is unreconciled. It matters for who may sign docket entries and withdrawals.)
- **The Work Product and "distribution" model** (TAD §4–§5; State Rules §4.5; Functional Architecture Layer 3) predates DEC-72. It speaks of a frozen `dist-NNNN`, audience internal or external, and a readiness ladder advanced by Compliance and Argument Evaluation skills (`BIO_Technical_Architecture_Decisions_v10.md:487-518`; `BIO_State_Rules_Consistency_v1_5.md:978-984`; `BIO_Functional_Architecture_v3.md:384-397`). None of that is reconciled with case, edition and review copy. Design Requirements R4 and R12 still name a "compliance skill" that "remain[s] unbuilt" (`BIO_Design_Requirements_v2.md:8`).
- **DEC-25** (no part of a plan published) is still "deferred" in the ledger (`docs/development/DECISIONS.md:418-440`; `BIO_Case_Making_v0_1.md:13`). Action v0_2 already rules a published record of the group's outward acts (`BIO_Action_v0_2.md:66`). (inference: this is compatible, because outward acts are not the plan's deliberation. But DEC-25's trigger may have fired and the ledger was not closed.)
- **Principles cited at a file that no longer holds them.** The canon cites "`CLAUDE.md` §2, §4, §5" for the stance and "undetermined is first-class" (for example `BIO_System_Design.md:28`, `:33`, `:263`; `BIO_Publication_v0_1.md:164`, `:545`, `:562`). The current `CLAUDE.md` holds only the standing approvals and Process3 (`CLAUDE.md:1-22`). The text is in `docs/archive/CLAUDE-2026-09-26-old-process.md:40-113`.
- **The Design Principles artifact names a repository copy that is gone** (§1D).
- **A stale line citation.** Capability Ladders cites "Pub §5C L399–408" (`BIO_Capability_Ladders_v0_1.md:1147`). §5C is now at `BIO_Publication_v0_1.md:340-354`.
- **Distribution's "the fleet: three members"** (`BIO_Distribution_v0_1.md:52`, `:154`). The account now holds more workers (file-scanner, ocr, pdf, sheet, agent-runner; `CLAUDE.md:9`). This is not publication's concern beyond the shared published bucket (inference).

### 6.5 Unresolved in canon (open items carried as open)
- The certification and persistence divergences are "unmade" (`:386-391`). The catalogue of standards by audience is "OWED" (`:586`, `:730`).
- §3 rule 16's pixel-verified rendering is NOT BUILT (`:185`). The complete edition, case file, checker and import are NOT BUILT, and "today's container holds no rendering and no capture bytes" (`:736`). The docket and withdrawal are NOT BUILT (`:735`). The ceremony is NOT BUILT (`:728`).
- Multi-instance isolation: the fence across groups in one account is "not structural" (`:738`).
- A finding ratified before its evidence never serves the edge to it. "Not decided; for BOB" (`:14`, `:100-104`).
- A wrongly-produced signed document has no correcting act: "undesigned" (`BIO_State_Rules_Consistency_v1_5.md:1822-1823`).
- Rule 13's residue: "a publisher who retypes a sentence an editor wrote ... is credited with it" (`:12`, `:132-133`). There is also no surface that sends `draft=` (`:156`, `:740`).
- D-542 is the DEC-49 guard's reach by op, "NOT BUILT" (`:3`).

---

## 7. Open questions, and whose call

**Bob's** (values, policy, audiences, principles):
1. **DEC-147 and DEC-19.** Does a signed but waiting edition change the doctrine of the irreversible moment? Bob ruled B. The canon still needs to state when publication happens: at signing, or at release. (Fold; the substance is ruled.)
2. **Rule 11's open doctrine.** Does an unresolved objection to the exclusion statement travel with the case? Investigation §11 says not automatically (K2420). Confirm that this closes Publication's "NOT ruled".
3. **Manager versus owner.** May a non-owner "manager" place docket entries, grant standing or withdraw an edition? The canon is silent on what a manager is.
4. **DEC-25.** Is the published record of actions (Action v0_2 rule 15) the answer to DEC-25, or does the deferral stand for anything beyond outward acts?
5. **Audiences.** The catalogue of standards by audience is owed. Its research trigger (DEC-105) is a group asking, or a challenge. Newsrooms are a core audience (DEC-128). Do any audience-specific output acts (certification, persistence) need ruling before the lane designs renderings?
6. **The serve-edge gap** (a finding ratified before its evidence) is marked "for BOB" (`:14`).
7. **Rule 15(a)'s fence.** May an invited-not-joined participant list drafts? The ruling said joined, and the build admits all participants.
8. **§5C's "may never be printed".** Is printing allowed? (Likely a wording fix, but it touches principle 8.8.)

**The lane's** (design and wording, within the principles above):
- The ceremony's screens: the five steps, the Photos step, publish now or at a set time, preflight before the first screen, weight marks, the outward-act warnings, the browser-signing words.
- The docket's three shelves on the public page, entry forms, the To-do wording, "Could not read the publisher's docket".
- Withdrawal and court-order stamps.
- The public page's finding lede and "two strengths" sentence.
- The complete-edition layout and "How to check this case yourself".
- The review-copy band and path marker (DEC-106).
- The case-account check's flags.
- The import and recreation marks (principle 5.4).
- "Working on" notice wording and the listing-rule display.
- The five gap names (3.2) as they appear in published forms.

**Process and BOB, not the lane:**
- Folding DEC-147, DEC-180, DEC-461, D56/D57, D60 and the Action v0_2 touchpoints into `BIO_Publication_v0_1.md`, and correcting the stale lines in §6.2 to §6.4. These are canon documents outside the lane's folder. (inference: they belong to BOB under CORPUS-STANDARD §4.)
