# Case-making: the design pass

**Status** · The record of the case-making design pass: the frame in Bob's words, the observations, the collapse of focus/finding/case into one recursive INQUIRY, naming and division, what a CLAIM is, the action plan, and the R1–R4 resolutions the adversarial pass forced. "Opened 2026-08-01 (session BOB) as the D-127 design pass Bob directed … Nothing here is settled unless it says so." Its 2026-08-10 status correction rules the file non-authoritative: the collapse HAS SHIPPED, and "what is authoritative is no longer this file. It is the plane, and the rulings the pass produced — DEC-15 through DEC-32 and the R1–R4 resolutions." Superseded as design authority (by the plane, `docs/development/DECISIONS.md`, and DEC-72 for the case section); complete as the reasoning record. Read it for WHY; several body sentences are now false as written (below). **One of them was CORRECTED IN PLACE 2026-09-17 (REC-117) rather than left to the list — *the falsifier is REQUIRED* in §What a CLAIM is, which Bob overruled the same day; a non-authoritative reasoning record may carry stale sentences, but a sentence that states the OPPOSITE of a live ruling misleads a reader about what was decided, and it was load-bearing in an argument.** §CONTRADICTION's IDENTIFY is designed at level 2 (BOB #16, 2026-09-19, `CONTRADICTION-IDENTIFY-DESIGN.md`). **§2 GAINED TWO RULINGS OF BOB'S ON 2026-09-22 (D-148, D-149), folded by BOB #26: a fee quote is EVIDENCE, and a records request names EVERY law that governs the agency asked, by citation. The fee quote is BUILT (D-148, 2026-09-23: a quote on a received correspondence entry, projected to `action_quotes`, read by op=actionquotes); D-149 is BUILT ON BOTH HALVES: the plane's (2026-09-23: `op=actionlaws`) and the MEMBER SURFACE (UI-90, 2026-09-24: the action page's governing-laws list and act, with no default level and the plane's own undetermined sentence) — `construct-status.json` 8.governing-laws — and the MACHINE PROPOSAL, its last NOT BUILT half, is BUILT 2026-09-24 (REC-195): `op=actionlawspropose` stores a proposal of citations and levels apart from the member's list, read labelled machine work, and the list moves only through the member's own act. AND THE MEMBER SURFACE FOR THAT PROPOSAL IS BUILT 2026-09-24 (UI-102), which was 8.governing-laws' last NOT BUILT half: the action page renders each proposal beside the list under the plane's own label, and offers NO control that would set the list from one — adopting is not an act the record has.** §2's `risk_tier` ruling (D-182) is BUILT in the plane, 2026-09-23: `node tools/status.mjs 8.risk-tier`; its write-side fence (a machine credential may not set or change a tier, MACHINE_CANNOT_SET_RISK_TIER, REC-189) is BUILT 2026-09-24, and its member-facing chooser is built on BOTH intake surfaces — `civicos-ui/app.html`'s action intake (UI-85) and the plane's setup page (D-483). **That write-side fence stopped trusting the CALLER'S envelope on 2026-09-24 (D-505): it opened on `meta.object_type` while every reader of the tier derives it from the promoted DOCUMENT's own `object_type`, so a machine credential's action, sent under a `meta` naming another type, landed a stated tier 1 — measured through `op=promote`, with the tier in the bytes, in `action_risk_tier` and findable at `op=search q=risk:1`. The guard now asks both types, as a UNION (IC-266, PROPOSED I3 MAJOR: a refusal where an answer stood, no new code or check). Its declared residue: the `replay` exemption is caller-asserted, pinned by an arm rather than closed, and routed to BOB.** **THE SAME ENVELOPE, ONE STEP OUT, CLOSED 2026-09-24 (D-510, D-505's finding 3): `promote` wrote `bundles.object_type` from the CALLER'S envelope and gated the `action_basis`, `correspondence` and `action_quotes` projections on it, while `#projectRow`'s action columns were already read off the promoted DOCUMENT's own front matter — so an action promoted under an `information` envelope landed TYPED INFORMATION, with its risk tier in the indexed column and its basis and correspondence PROJECTED NOWHERE: the record holding an action it does not index as one. The promoted type is now the DOCUMENT's own through `normalizeType`, at every site that decides what the record SAYS about those bytes, and an envelope stating a type that contradicts it is REFUSED by name (ENVELOPE_TYPE_DISAGREES, C-86.1, a new DEC-49 family; IC-279, PROPOSED I3 MAJOR). A `replay` is exempt from the refusal and NOT from the derivation — the record's own history must be holdable verbatim, but what the record says about those bytes is the bytes' own word — and that exemption remains caller-asserted, which is D-511's.** **AND EVERY FENCE ASKS THE SAME TYPE, 2026-09-24 (D-526):** D-510 parsed the document BELOW the fences, so REC-141's mint, D-85's surfacing gate, 7.1's name scan, REC-181's retirement arm, D-149's carry-forward and C-26's bias gate in the store — and `create_projects`, the migration-replay admission and D-78's `surfaced_by` restamp on the control plane — still asked the ENVELOPE; WHICH refusal a caller met depended on it, and an envelope stating NO type (legal, and outside D-510's refusal) skipped them, so an action creation filling in its own governing laws, a machine's question outside any run, a project created without `create_projects` and owned by nobody, a question keeping the `surfaced_by` its bytes claimed and a malformed bias set all LANDED (measured on 8bdf20e6). The type is now derived ONCE at the top of each plane's promote path, the document's own through `normalizeType`, the envelope only where the document states none, and every one of those reads it; `#projectRow`'s action columns ask through `normalizeType` too. **§2 GAINED BOB #33's RISK-TIER REVISION RULING (2026-09-24), folded and BUILT by REC-214: a member revises a tier by `op=actionrisktier`, an authored, append-only act with a REQUIRED reason, and every earlier tier, its author and its reason stay readable in `risk_tier_history`; `promote` refuses any other writer that moves either (C-90.1, IC-291) — `node tools/status.mjs 8.risk-tier-revision`.** **ITS MEMBER SURFACE IS BUILT 2026-09-25 (UI-104):** the action page shows the tier history and offers the revise act with a required reason, nothing preselected. **§2's RECORDS-REQUEST LIFECYCLE IS BUILT IN THE PLANE 2026-09-25 (D-147):** stages, outcomes and a member-stated due date with its citation on correspondence entries (C-94), read back as one dated chain on `op=projection`'s action block, a due date nobody stated reading UNDETERMINED — `node tools/status.mjs 8.records-lifecycle`. **§CONTRADICTION GAINED DEC-76 (Bob, 2026-09-29): a contradiction is conditional, and a taken-up candidate becomes an inquiry whose conclusion records its kind. DEC-77 the same day: it is met inline by default, and context supports without silently deciding.** **§4a AMENDED 2026-10-09 (K2420; D56, D57; `BIO_Investigation_v0_1.md`): the system may draft a case's written account from the evidence, checked sentence by sentence, and a case carries no stories.** as of 2026-10-09.

**Place in the system** · The reasoning behind construct 8 of `BIO_System_Design.md` §3 (intent and inquiry) **[audited 2026-09-17: the quotation below is Bob's framing of 2026-08-01 and the design has since LANDED — this document is it, and construct 8 reads built]**: "CASE-MAKING is undesigned, and it is what the whole system is for" (D-127). Its rulings feed M9 and M10; `BIO_Interaction_Constructs_v0_1.md` takes FINDING as case-making's substrate from it; the thread itself is paused behind DEC-33 until Bob reopens it.

**Incomplete sections** ·
- §2. `action` IS the impact substrate — the fee quote as evidence (D-148) and the governing laws of a records request (D-149), both RULED 2026-09-22, are BUILT in the plane. The fee quote (2026-09-23): C-2.10's quote grammar, `action_quotes`, op=actionquotes; the records-request lifecycle that extends its grammar is BUILT (D-147, 2026-09-25): see §2's lifecycle paragraph; its member surface is not built. The governing laws (2026-09-23): a member sets the list by `op=actionlaws`, a machine is refused by name, `promote` sets it no other way, and an action with none reads UNDETERMINED. The MEMBER SURFACE is BUILT (UI-90, 2026-09-24): the action page lists the governing laws at the levels the plane publishes, offers the act with NO default level, and renders the plane's own undetermined sentence for an empty list — this bullet said it was not built, which was true when written and is corrected here rather than left standing. The MACHINE PROPOSAL of a list is BUILT (REC-195, 2026-09-24): `op=actionlawspropose` writes `action_law_proposals` — citations and levels under the proposer's own name, keyed apart from the member's list and never in the action's bytes — and `op=projection`'s action block serves it beside `governing_laws` under the catalogue's own label, so a machine's proposal is read AS machine work and the list stays the member's until the member acts. This bullet said it was not built, which was true when written and is corrected here rather than left standing. The PROPOSAL'S MEMBER SURFACE is BUILT (UI-102, 2026-09-24): the action page renders `governing_laws_proposals` beside the list, each proposal under the plane's own label sentence and never one of the page's own, and it offers NO control that would set the list from a proposal — the form that act opens still opens on an EMPTY row with proposals standing, because adopting is not an act the record has and a list a member did not author is not the member's. Driven against a real plane by `civicos-ui/test/ui102-laws-proposals.test.mjs`. This bullet said that surface was still owed, which was true when written and is corrected here rather than left standing. Still owed under D-149: whether the kinds gain a law-neutral records request is PROPOSED, not decided (`cpra_request` is unchanged). The `risk_tier` ruling (D-182) is built on BOTH intake surfaces: the member UI's action intake offers the published words as a chooser since UI-85 (2026-09-24), and the plane's own setup page since D-483 (2026-09-24) — a radio group over the published vocabulary, unset by default, where a form nobody touched still writes UNDETERMINED. (A machine credential's promote setting or changing a tier is refused by name since REC-189, and since D-505 that refusal reads the PROMOTED DOCUMENT's own `object_type` as well as the caller's envelope — the envelope-only guard let a machine set the tier by calling its action something else. Since D-510, 2026-09-24, the divergent envelope does not reach that fence at all: it is refused above it (ENVELOPE_TYPE_DISAGREES, C-86.1), and `bundles.object_type` and the action projections are derived from the document, so the disagreement D-505 measured — `action_risk_tier` read off the bytes beside an `object_type` read off the envelope — is unreachable for any promotion that is not a replay. D-505's union stays and is still reached where the envelope states no type at all. Owed and NOT built: the `replay` exemption is caller-asserted, so a machine asserting `replay` still lands a stated tier; D-505 pins it in `risk-tier.test.mjs` §7 arm (ix) and routes the doctrine question — may a caller-asserted flag exempt a machine fence? — to BOB.) **A REVISION MAY NOT RETYPE ITS BUNDLE (D-547, 2026-09-25):** `promote` wrote `bundles.object_type` from the revision's derived type with no comparison to the head's, so a revision could turn an action into an inquiry in place and every type-scoped fence then asked the wrong machine; a non-replay revision whose derived type differs from the head's (both through `normalizeType`, so `focus` is not a retype) is now refused REVISION_RETYPES_BUNDLE (C-86.2) before the first write. Replay stays exempt, for D-510's reason. The corpus held NO retyped bundle to report (M-156: 0 of 31 in `bio`, 0 of 17 in `scratch`, 2026-09-25). **THE TITLE AND THE STATE ARE THE DOCUMENT'S TOO (D-563, 2026-09-25):** D-510's derivation extended to what a document is CALLED and where it STANDS — `promote` derives `title`, `current_state`, `prior_state` (and the `closed_reason` 7.11 reads) from the promoted bytes, the envelope only where they state none, and 7.1's name scan, 7.11's owner test, REC-181's retirement arm, the bias state edge and the projection all read the derived values; a non-replay envelope contradicting the document is refused by name (ENVELOPE_TITLE_DISAGREES C-86.3, ENVELOPE_STATE_DISAGREES C-86.4). `created` and `last_updated` are NOT derived: the documents state them and the row still records the envelope's (M-172 measured the head rows: 0 title, 0 state and 11 `prior_state` drifts in `bio`).
BOB.) The member's REVISION of a tier after intake (BOB #33, 2026-09-24) is BUILT in the plane by REC-214 — `op=actionrisktier`, append-only with a required reason. The member SURFACE is BUILT (UI-104, 2026-09-25): the action page shows the tier history beside the governing-laws list and offers the act with a required reason and no tier preselected. Owed and NOT built: a labelled machine PROPOSAL of a reconsideration read beside the history (REC-215). An intake tier's author is not recorded, so the history states it UNDETERMINED.
- §Naming: three names for three phases, and the type name question — DEC-72 rules a case is a PRODUCTION of a project, not a phase; the open → concluded → published states are superseded.
- §Division: one inquiry becomes two or more — items 3 and 5 were written for case-as-phase; re-read under DEC-72.
- §What a CLAIM is, and why it is a field rather than an object — "`inquiry_basis` does not exist in the schema" is false; "Awaiting Bob" and "DEC-32 remains open" are stale (decided 2026-08-04); the contradiction question is open. **The threshold argument's SECOND LEG was CORRECTED 2026-09-17 (REC-117) and the section is current on it:** *the falsifier is REQUIRED* was overruled by Bob — `NO_FALSIFIER` is a condition a member may override, stated and attributed, including in the published record — so the leg is REPLACED by *the falsifier is ACCOUNTED FOR* rather than struck, because it was one of three carrying the argument and striking it would have left an argument that no longer closes with nothing saying so. Shipped in the plane (`op=conclude` `no_falsifier=1`, `falsifier_override_by`/`_at`, C-2.8's three outcomes, `op=publishedcase`'s `authored.falsifier_override`).
- §THE ACTION PLAN — "not yet in the review document"; S11's backward question (D-165) deferred, trigger: S11 exists and members are answering the backward question by hand (Bob, 2026-08-03; `MILESTONES.md` M10 watches it); DEC-25 deferred with its provisional; "Ten surfaces are specified today" is dated. Item 8 RULES an action is never a basis leg (D-181, BOB #29, 2026-09-23); an observed absence of a reply as a leg is deferred, trigger: a real non-response case needs the absence graded.
- §CONTRADICTION — Q14 ANSWERED 2026-09-17 in doctrine and in two of its three cases; the IRRECONCILABLE PAIR is answered without a claim object by DEC-76 (Bob, 2026-09-29), which also rules a contradiction CONDITIONAL and its resolution an inquiry with a recorded kind. IDENTIFY / PRESENT / RESOLVE are specified as separable mechanisms and NONE is built; the acceptance test for IDENTIFY is its over-strictness arm. IDENTIFY's inputs are DESIGNED at level 2 (`CONTRADICTION-IDENTIFY-DESIGN.md`, 2026-09-19); PRESENT and RESOLVE are not, and follow its first measurement.
- §R1 — the residual laundering hazard is D-159: deferred, trigger: M10 has run with a real group — then read `op=versionstrength`'s `ungraded[]` ratio and each leg's reason (`MILESTONES.md` M10 watches it).
- §Open questions this pass must answer — the heading is duplicated in one line; of eight questions only Q7 is marked answered though Q1, Q2 and Q4 were answered in the body; never reconciled.

**Contents**
- [The frame, in Bob's words](#the-frame-in-bobs-words)
- [Observations, offered as input to the pass](#observations-offered-as-input-to-the-pass)
  - [1. The constructs conflate the WORK with the OUTPUT, and the substrate already has the fence](#1-the-constructs-conflate-the-work-with-the-output-and-the-substrate-already-has-the-fence)
  - [2. `action` IS the impact substrate, and it exists](#2-action-is-the-impact-substrate-and-it-exists)
  - [3. Audience difference is probably RENDERING, and the sharp version is claim strength](#3-audience-difference-is-probably-rendering-and-the-sharp-version-is-claim-strength)
  - [4. CORRECTED — the administrator is not an inverted threat model, and the threat is symmetric](#4-corrected-the-administrator-is-not-an-inverted-threat-model-and-the-threat-is-symmetric)
  - [4a. "Less narrative" is a design constraint, and it cuts against how such tools usually work](#4a-less-narrative-is-a-design-constraint-and-it-cuts-against-how-such-tools-usually-work)
  - [5. A caution about designing for four audiences at once](#5-a-caution-about-designing-for-four-audiences-at-once)
- [Are focus / project / action / case the right constructs? — asked and answered](#are-focus-project-action-case-the-right-constructs-asked-and-answered)
  - [The test](#the-test)
  - [What is right, and why each earns its place](#what-is-right-and-why-each-earns-its-place)
  - [What is missing](#what-is-missing)
  - [On adding constructs, having just argued for fewer](#on-adding-constructs-having-just-argued-for-fewer)
- [Is a case anything other than a published finding? — Bob, 2026-08-01](#is-a-case-anything-other-than-a-published-finding-bob-2026-08-01)
  - [Why it cannot be a state on a finding](#why-it-cannot-be-a-state-on-a-finding)
  - [What follows for the gate, and it parallels something already built](#what-follows-for-the-gate-and-it-parallels-something-already-built)
  - [The remaining distinction, smaller but real](#the-remaining-distinction-smaller-but-real)
- [THEY COLLAPSE. Focus, finding and case are one recursive object — Bob, 2026-08-01](#they-collapse-focus-finding-and-case-are-one-recursive-object-bob-2026-08-01)
  - [Every defence reduces to a STATE or a FIELD, not a type](#every-defence-reduces-to-a-state-or-a-field-not-a-type)
  - [What the collapse BUYS, which is not only tidiness](#what-the-collapse-buys-which-is-not-only-tidiness)
  - [What must NOT be lost in the collapse](#what-must-not-be-lost-in-the-collapse)
  - [What does NOT collapse](#what-does-not-collapse)
  - [The god-object risk, WITHDRAWN as stated and narrowed to what is real](#the-god-object-risk-withdrawn-as-stated-and-narrowed-to-what-is-real)
- [Naming: three names for three phases, and the type name question](#naming-three-names-for-three-phases-and-the-type-name-question)
- [Division: one inquiry becomes two or more](#division-one-inquiry-becomes-two-or-more)
- [What a CLAIM is, and why it is a field rather than an object — 2026-08-03](#what-a-claim-is-and-why-it-is-a-field-rather-than-an-object-2026-08-03)
  - [Can one finding hold SEVERAL claims? Not today, and the alternative is already expressible](#can-one-finding-hold-several-claims-not-today-and-the-alternative-is-already-expressible)
- [CONTRADICTION — Q14 ANSWERED, and the premise was INVERTED — Bob, 2026-09-17](#contradiction-q14-answered-and-the-premise-was-inverted-bob-2026-09-17)
  - [The three cases, and only one of them carries a DUTY](#the-three-cases-and-only-one-of-them-carries-a-duty)
  - [Three mechanisms, separable, built in this order](#three-mechanisms-separable-built-in-this-order)
  - [RULED 2026-09-29 (DEC-76): a contradiction is conditional, and resolving one is an inquiry](#ruled-2026-09-29-dec-76-a-contradiction-is-conditional-and-resolving-one-is-an-inquiry)
  - [What still needs the claim object, and is Bob's — ANSWERED 2026-09-29 by DEC-76 (above), without the object](#what-still-needs-the-claim-object-and-is-bobs-answered-2026-09-29-by-dec-76-above-without-the-object)
  - [Two constructs share the word, and conflating them is the hazard](#two-constructs-share-the-word-and-conflating-them-is-the-hazard)
- [THE ACTION PLAN — mapped 2026-08-03, not yet in the review document](#the-action-plan-mapped-2026-08-03-not-yet-in-the-review-document)
  - [1 · What a plan answers, and why it is not an inquiry](#1-what-a-plan-answers-and-why-it-is-not-an-inquiry)
  - [2 · The object question, and the argument that settles it](#2-the-object-question-and-the-argument-that-settles-it)
  - [3 · Structure — borrow the progression vocabulary, do NOT borrow the progression object](#3-structure-borrow-the-progression-vocabulary-do-not-borrow-the-progression-object)
  - [4 · Variation by user type is already expressible, and lands in the right place](#4-variation-by-user-type-is-already-expressible-and-lands-in-the-right-place)
  - [5 · Where the machine helps, within DEC-24's boundary and adding no exception to it](#5-where-the-machine-helps-within-dec-24s-boundary-and-adding-no-exception-to-it)
  - [6 · The surface — S11, and the journey gains a stage](#6-the-surface-s11-and-the-journey-gains-a-stage)
  - [6a · PLANNING FROM WHAT IS NOT YET ESTABLISHED — agreed, and it is not a concession](#6a-planning-from-what-is-not-yet-established-agreed-and-it-is-not-a-concession)
  - [6b · THE TWO HARD PARTS, SCOPED DOWN — 2026-08-03](#6b-the-two-hard-parts-scoped-down-2026-08-03)
  - [7 · ONE QUESTION THIS MAP DOES NOT ANSWER, and it is Bob's](#7-one-question-this-map-does-not-answer-and-it-is-bobs)
  - [8 · AN ACTION IS NEVER A LEG OF A QUESTION'S BASIS — RULED 2026-09-23 by BOB #29 (D-181)](#8-an-action-is-never-a-leg-of-a-questions-basis-ruled-2026-09-23-by-bob-29-d-181)
- [Resolutions forced by the adversarial pass, 2026-08-01](#resolutions-forced-by-the-adversarial-pass-2026-08-01)
  - [R1 · An UNDETERMINED leg leaves the chain UNRATED. It does not floor it and is never ignored.](#r1-an-undetermined-leg-leaves-the-chain-unrated-it-does-not-floor-it-and-is-never-ignored)
  - [R2 · Capture grade and connection grade are TWO scales and must never be composed into one number](#r2-capture-grade-and-connection-grade-are-two-scales-and-must-never-be-composed-into-one-number)
  - [R3 · The collapse deletes the system's only cycle guard, and must replace it explicitly](#r3-the-collapse-deletes-the-systems-only-cycle-guard-and-must-replace-it-explicitly)
  - [R4 · Division must cost at least what severance costs](#r4-division-must-cost-at-least-what-severance-costs)
- [Open questions this pass must answer](#open-questions-this-pass-must-answer)

---

**A RECORD OF THE PASS.** Opened 2026-08-01 (session BOB) as the D-127 design pass Bob
directed: his framing as he gives it, and the observations and questions it raised.
Nothing here is settled unless it says so.

> **STATUS CORRECTED 2026-08-10 (session BOB). This header read "IN PROGRESS — do not
> build from this file yet", and that instruction is now false and misleading.** The
> collapse it works out — focus, finding and case as one recursive INQUIRY — **HAS
> SHIPPED**: `inquiry`, `conclude`, `citeinquiry`, `inquiryground` and `inquirystrength`
> all exist in the plane with their own suites. A reader taking the old line at face
> value would conclude the built system's central object was still speculative.
>
> **What is authoritative is no longer this file.** It is the plane, and the rulings the
> pass produced — DEC-15 through DEC-32 and the R1–R4 resolutions — which live in
> `docs/development/DECISIONS.md` and are indexed by `node tools/decided.mjs`. Read this
> for WHY the collapse happened and what it had to preserve; read the record for what is
> true today.
>
> Not edited otherwise: a pass is a record of what it concluded, and correcting its body
> in place would hide that the reasoning arrived in this order.

## The frame, in Bob's words

**The purpose.** Civicsmith is about telling a story — equivalently, making a case. The
substrate collects the record, extracts meaning rigorously, understands the
legal/regulatory/policy framework, makes connections, and figures out how
{information, money, responsibility, relationships, decisions, power} is SUPPOSED to
flow, how it ACTUALLY flows, and where the system works and where it does not. A
meta-level above all of that: **answer questions, make a case, tell a story, and take
action to affect this living civic system.** Nothing about how Civicsmith works is more
important than supporting users along that path.

**The path.** Questioning → exploring → discovering (understanding) → documenting →
impacting. *And* sharing the products of that process with the outside world.

**The member-facing constructs today**, which Bob is explicitly open to changing,
evolving, or replacing: **focuses, projects, actions, and case files.**

**The audiences, and what "sharing" means to each** — the point being that one
substrate serves genuinely different outputs:

| audience | what they are doing |
| --- | --- |
| media | **reporting** |
| activists | **fixing** — and supporting when they can |
| government administrators | **understanding, tracking, adjusting, responding** to the communities they serve |
| lawyers | **supporting a claim, or changing a claim** |
| …and so on | the list is open |

## Observations, offered as input to the pass

> **"Output" is a noun and also a verb** (Bob, 2026-08-01). Worth holding onto through
> this pass: the artifact and the ACT of releasing it are different things, and the
> plane already models the act — ratification is outputting, and it is the boundary
> where a claim stops being ours and starts being answerable. A design that names only
> the noun will end up with a case file nobody had to decide to publish.

### 1. The constructs conflate the WORK with the OUTPUT, and the substrate already has the fence

`focus` / `project` / `action` describe WORK. A case file, as UI-PLAN U12 describes it,
is an OUTPUT: a narrative with interactive story visuals, print as first-class, read
start to finish by a member of the public.

The plane already draws that line and the constructs have not caught up to it: the
**two-bucket fence** separates the working corpus from the published, and
**ratification** is the boundary act — a signed, irreversible statement that this is
what we stand behind. So there is an existing, load-bearing distinction between *what
we are working on* and *what we assert*, and the member-facing vocabulary does not
express it.

A candidate shape, not a decision: a **project** is the investigation, private and
allowed to contain dead ends; a **case** is what leaves, carrying only what it can
stand behind. The dead ends stay in the project, which matters — D-81 already argues
that a recorded dead end is what makes the next member's work cheaper.

### 2. `action` IS the impact substrate, and it exists

A previous session's claim that "impacting has no substrate" was WRONG and is corrected
here. The `action` object type has been in the check catalogue throughout:

- states `planned → active → awaiting_response → resolved | abandoned`
- headings `## Plan`, `## Status`, `## Correspondence`, `## Session Log`, `## Review Notes`
- fields `action_kind`, `risk_tier`, `counterparty`

**`risk_tier`, RULED 2026-09-21 by BOB #21 (D-182; SCHEDULER #6's Q4): both halves, in one row.** The three
tiers already carry Bob's own meanings in the mission of record (`BIO_Complete_Roadmap_v5.md` §8): **1, file
freely; 2, file with caution; 3, do not file without counsel** (evidence published, filing templates not
included). A surface publishes those words (REC-38's pattern) and invents none. And `risk_tier` gains an
UNDETERMINED value, as authority and counterparty did (D-130), written wherever no member has stated a tier.
Today's writers default to 1, which tells a member an action is safe to file freely when nobody assessed it:
an overclaim on the one field that carries legal exposure. Only a member's authored act sets 1, 2 or 3, and **once a member has set a tier, no machine credential may change it,
not even back to `undetermined`**: erasing an authored assessment is itself an act on it (BOB #32, 2026-09-24,
REC-189's finding). A machine may PROPOSE that a tier be reconsidered, as labelled machine work. **BUILT 2026-09-23 (D-182):** `RISK_TIERS` and `riskTierState()` in the check catalogue, published as `vocabularies.risk_tiers`; an action's read carries `risk_tier` and `risk_tier_words`, and an absent tier reads UNDETERMINED. Actions written at the old default are not back-filled: they read 1, as their bytes say. **FENCED 2026-09-24 (REC-189):** *only a member's authored act* is now enforced at the write — `promote` refuses a machine credential stating a tier of 1, 2 or 3 that differs from the version it replaces (`MACHINE_CANNOT_SET_RISK_TIER`, C-32.19); carrying a member's tier forward unchanged is not refused. **BOB #32 (2026-09-24 01:44Z):** once a member has set a tier a machine may not write it at all — dropping it to `undetermined` is refused by the same name; where no member ever set one, the machine may leave it undetermined. **The member's chooser, BUILT 2026-09-24 ON BOTH INTAKE SURFACES.** *(UI-85)* the member UI's action intake offers `vocabularies.risk_tiers` in the plane's words, `undetermined` preselected and no number a default, and writes a tier only when the member chose a key of the published map. *(D-483)* the plane's SETUP PAGE offers a radio group over `vocabularies.risk_tiers` as published — the labels are the vocabulary's own sentences and the settable keys are derived through `riskTierState`, so `undetermined` is not offered as a choice — with NOTHING preselected, and a form nobody touched still writes `undetermined`. D-483's own note that `civicos-ui/app.html` has no such control is CORRECTED HERE: UI-85 built it on the other side of this integration, and the two landings crossed.

**A MEMBER REVISES A TIER AS AN AUTHORED, APPEND-ONLY ACT, RULED 2026-09-24 by BOB #33** (the "Risk-tier revision"
ruling, sent 21:18Z and recorded in the BOB inbox entry of 21:55Z; folded here by REC-214, which built it). Before
it, no member could set or revise a tier after intake, and a revision by any other route would have left no trace.
The ruling, in full: a member-class act, `actionrisktier`, writes through the ONE front-matter path every reader
derives the tier from; a machine credential is refused `MACHINE_CANNOT_SET_RISK_TIER`; a member may revise ANY tier,
up or down, as an AUTHORED act recording who, when and a REQUIRED reason; and it is APPEND-ONLY — the prior tier,
its author and its reason stay readable in the action's tier history, and nothing is ever silently overwritten.
The reason is the field's legal exposure: the record must show that a "do not file without counsel" tier was
changed, and by whom. **BUILT 2026-09-24 (REC-214):** `op=actionrisktier` (member class, `contribute`) states 1, 2
or 3 with a reason of 1 to 500 characters, writes `risk_tier` in the action's own bytes — so the read, the
`action_risk_tier` column and `op=search q=risk:` agree without a second writer — and APPENDS one entry `{tier,
prior, by, at, reason}` to `risk_tier_history[]`, recording it in the Session Log as well. `riskTierHistoryOf` in
the check catalogue is the one reader: `op=projection`'s action block serves it beside `risk_tier`, oldest first,
and C-2.10 judges the same chain on bytes (each `prior` the tier before it, the last entry the tier stated).
**No other writer moves either:** `promote` refuses a revision that changes the tier or edits the history without
the act, and a creation that states a history (`RISK_TIER_REWRITTEN`, C-90.1; IC-291). A creation may still state
a tier — that is intake — and carrying the tier and history forward unchanged is not refused, for a member or a
machine. `undetermined` is not a tier the act sets: it is what an action reads when nobody has assessed it, the
rule `actionlaws` keeps for an empty list; and a revision to the tier already held is refused, since the history
records changes. **What the record cannot say, stated rather than inferred:** an intake writes its tier with no
author of its own, so the history reads the INTAKE tier's author as UNDETERMINED, in words — naming the action's
creator would be an inference, not a record. A machine may PROPOSE a reconsideration only as labelled machine work,
read BESIDE this history and never written into it (REC-215, a read and never an act in ACTS, as every `*propose`
op is NON_ACTS per REC-195) — NOT BUILT. The member surface that shows the history and offers the act is BUILT
(UI-104, 2026-09-25): the action page renders `risk_tier_history` in the plane's words beside the governing-laws
list and offers `actionrisktier` with a REQUIRED reason and nothing preselected; this sentence said it was not built,
which was true when written. A promote under `replay` is exempt from the fence with the whole action block, which is D-511's residue.

**A FEE QUOTE IS EVIDENCE, RULED BY BOB 2026-09-22 (D-148):** *"Yes, a price quote is evidence"* — about the body
that quoted it, not an obstacle to the request. Folded by BOB #26. A quote arrives as a `received` correspondence
entry and gains a structured QUOTE on that entry: the amount and currency as quoted, the stated basis verbatim
(hours, rate, per page, as the body put it), and the `sent` entry it answers — the request's own text is its
scope. Capture-or-testify is unchanged (DEC-13): the quote letter captured, or a member's account at D. A
revision or a waiver is a LATER entry naming the quote it revises, so "dropped a $1,083 charge entirely once
challenged" is two entries and both stand. The quotes are projected from the bytes into an indexed table that
`purge` clears (D-21: stated once, in the document), so a read can set them side by side by counterparty and by
request. **The record asserts only what was quoted, by whom, when, for which request.** That two requests
sought the same records, or that a quote exceeds what the governing law allows, is a MEMBER's claim in an
inquiry resting on those entries (DEC-24); the machine may set quotes side by side and never judges one.

**A RECORDS REQUEST NAMES EVERY LAW THAT GOVERNS IT, RULED BY BOB 2026-09-22 (D-149):** *"ALL records laws
apply. If a request is made in California, the both the federal and state laws apply. If there are local
sunshine regulations, then they would apply as well."* Folded by BOB #26, with one correction told to Bob the
same day: the layers follow the AGENCY ASKED, not where the requester stands — federal FOIA (5 U.S.C. §552)
governs federal agencies only, a California state or local agency is governed by the California Public Records
Act, and a city with a sunshine ordinance (Oakland's) adds its own. So a records-request action carries a LIST
of the laws that govern the agency it is sent to — federal, state and local, every one that applies — each named
by CITATION and set by a member's authored act; the machine may propose the list from the counterparty,
labelled as machine work, and never sets it. **THE PROPOSAL IS BUILT 2026-09-24 (REC-195),** the half
D-149's own landing left: `op=actionlawspropose` stores citations and levels in `action_law_proposals` under the
credential that proposed them, apart from the member's list and never in the action's bytes, and the action's read
carries them beside the list under the plane's own label (machine work, or a member's proposal, with the published
sentence). **THE MEMBER SURFACE FOR THE PROPOSAL IS BUILT 2026-09-24 (UI-102):** the action page renders each proposal beside the list, inside the same section, under the plane's own label sentence and with no sentence of the page's own — and it offers NO CONTROL on a proposal at all. That absence is the item rather than an omission: there is no act that adopts a proposal, so a "use this" control could only prefill the member's authored statement with a machine's citations, which is the surface making the legal claim the act exists to have a member make. The form that act opens therefore still opens on an EMPTY row with proposals standing against the action. It never sets the list — structurally, because nothing on that path writes bytes at all — and
**nothing relates a proposal to the list a member later states**: that a member acted BECAUSE of a proposal is a
claim about a person that the record cannot support. What a proposal is derived FROM is the proposer's own business:
the plane maps no agency to a law, which is D-149's own rule that it encodes none. An empty list is UNDETERMINED and stated, never a default (the
design's implicit federal assumptions were wrong for Oakland on every axis D-149 lists). **The plane encodes
no law's rules** — fees, clocks, appeals: a citation stays true when a law changes (a 2026 California bill to
loosen the fee rules is pending) and an encoded rule goes stale silently; a member reads the law, and a fee
quote (above) is read against it by a member. `cpra_request` already names one law in its KIND: every action
written with it stands unchanged and counts as its member's statement that the CPRA governs, and nothing else
is inferred from it; whether the kinds gain a law-neutral records request is the builder's to propose through
the interface protocol. **PROPOSED by D-149's builder and ADOPTED as the direction 2026-09-23 by BOB #32:** a law-neutral
`records_request` kind that carries a `law` field, since a sovereign group may sit outside California; `cpra_request`
stays readable as written. A quote is read "by" the action's own counterparty name, matched EXACTLY; when nothing
matches, it is stated as undetermined (D-148's gap). NOT BUILT (rowed behind the M9/M10 product rows; the integrator
mints the IC).

**THE RECORDS-REQUEST LIFECYCLE, DESIGNED 2026-09-22 by BOB #27 (D-147, on SCHEDULER #13's LED-7 question), on the
pattern of D-148 and bound by D-149.** Each stage after the request is its OWN correspondence entry naming the entry it
answers or follows, so the lifecycle reads as a chain of dated entries and `awaiting_response` stops hiding it. A `sent`
entry may be the request, a fee-waiver request, an appeal (naming the decision it appeals) or a court filing; a
`received` entry may be an acknowledgement, a fee estimate (D-148's QUOTE), a fee-waiver decision, an extension notice,
a production (partial or final, naming the documents it delivered), a denial (whole or partial, the exemptions cited
as the body cited them), or an appeal or court decision. A decision carries its OUTCOME in a closed vocabulary
(granted · denied · partial · reversed · affirmed · none stated), as the body gave it. **The clock is never encoded**
(D-149: the plane encodes no law's rules): a member may state on an entry the date by which the NEXT stage is due and
the citation it comes from — one of the action's D-149 citations — and with none stated the due date is UNDETERMINED.
The plane derives only what costs nothing to invent: the time elapsed between entries, and that a stated due date
passed with no answering entry — D-128's declared-versus-observed flow measured on our own request. No reversal rate or
response shape is assumed (the row's FY2024 figures vary by an order of magnitude between agencies). **BUILT
2026-09-25 (D-147), in the plane:** an entry's `stage`, `follows`, `outcome`, `exemptions`, `due_by` and `due_cite` are
flat keys on the correspondence entry, judged by the catalog's `lifecycleFindings` at op=actioncorrespond, at C-2.10
and at promote (C-94.1–11); the two closed sets are published as `vocabularies.correspondence_stages` and
`correspondence_outcomes`; `op=projection`'s action block reads the chain back through `requestLifecycleOf`, each
entry with the days since the entry it follows and its due date STATED (with whether its citation is on the list now,
and a status derived at the read's instant) or UNDETERMINED with the plane's sentence. A due date's citation is
judged against the action's governing laws WHEN IT IS STATED, at the op only: a document-level rule would make a
later change to the list refuse the action's own history. Not built: a member surface, and a cross-action index of
passed due dates (the chain is read per action from its bytes).

`awaiting_response`, `## Correspondence` and `counterparty` are unmistakably
**outward-facing**: a records request, a letter to a council member, a complaint, a
demand. That is impact modelled at the object level.

What is missing is not the object but its CONNECTIONS: nothing links an action to the
findings that justified it, to the case it advances, or to the outcome it produced. So
the record can hold "we wrote to the city" and cannot say "because of these three
findings, and here is what came back, and here is what that changed." **The loop from
evidence to action to consequence is the thing that is unbuilt** — and the consequence
half is itself new evidence about how the system responds, which is exactly D-128's
declared-versus-actual flow measured on our own intervention.

### 3. Audience difference is probably RENDERING, and the sharp version is claim strength

The tempting read is four case types. The better read is one case with audience-shaped
renderings, because the underlying structure — what we assert, what it rests on, what
would falsify it — does not change with the reader.

But the sharp form of the difference is not format, it is **the strength a claim must
reach before that audience can use it.** A journalist can publish "records suggest"; a
lawyer needs "the record establishes"; an administrator may act on "worth checking."
So:

- a case carries CLAIMS, each with the evidence it rests on and a derived strength;
- a rendering SELECTS what clears the threshold that audience needs, and says what it
  excluded and why.

That connects directly to work already designed: D-72's connection grades (A–D) are the
input nothing consumes, and a case's strength being **the weakest link along its chain**
is the natural composition rule. It also gives invariant 7 a mechanism rather than an
exhortation: a finding that cuts against the case has the same strength computation as
one that supports it, so it cannot be quietly excluded by a rendering without the
exclusion being visible.

### 4. CORRECTED — the administrator is not an inverted threat model, and the threat is symmetric

This section originally read "the administrator archetype inverts the threat model" and
treated an adversarial default as the given. Bob corrected it on 2026-08-01 and the
correction is doctrine:

> "Whatever happens in the world, there is usually those who are supportive of that
> thing and those that aren't. The potential for threats exist for both ends of that
> continuum and everybody in between. Some people are willing to damage a publisher,
> but there are other times people who make claims that reach far beyond what the
> evidence can support… the goal of CivicOS is to improve outcomes using greater
> understanding, less narrative, and accountability… nowhere in the doctrine is anything
> like 'Stick it to the man!' It's about better government… If we start by assuming that
> at the highest level all stakeholders want better outcomes in the public interest,
> then we're all on the same side. — Even though, there are bad actors among us."

**So an administrator is not an inversion. They are a stakeholder like any other**, and
the question I raised as doctrine dissolves: there is one system serving people who want
better outcomes, and the archetypes differ in what they DO with a case rather than in
whose side they are on.

**The threat model is SYMMETRIC, and its more dangerous half is ours.** Someone may
damage a publisher; someone may also make claims far beyond what the evidence supports.
Reading this codebase against that: almost every hard-won rule defends against the
SECOND — `undetermined` is first-class and must be stated, an equality that costs
nothing to produce is not evidence, grade tracks directness and never technique, the
publication fence, the refusal to invent an authority to get past a gate. **The primary
threat model has always been self-directed; the doctrine just made it explicit.**

That reframes claim strength (observation 3) entirely. It is not a convenience for
lawyers. **It is the core defence against this project's own characteristic failure**,
and it is why a rendering must state what it excluded rather than silently omit it.

**Bad actors are real and are identified BY EVIDENCE, never assumed by role.** Corrupt
officials, power-hungry politicians, greedy organisations, people seeking financial
security beyond what the system can afford — all exist. None of that licenses a
structural prior. Concretely, and this binds the entity work in M4: **the subject
registry (D-83) must carry no adversarial attribute**, no suspicion flag, no
category-level prior. An entity is an entity; what is claimed about it is claimed with
evidence attached, or it is not claimed.

### 4a. "Less narrative" is a design constraint, and it cuts against how such tools usually work

Bob has said both *"CivicOS is about telling a story"* and *"less narrative"*, and they
are not in tension once the words are separated:

- a **story** is what the record supports, told so a person can follow it;
- a **narrative** is a frame imposed on the material, which the material then gets
  fitted to.

A case-making tool that makes it easy to build a COMPELLING story is dangerous, because
compellingness and support are different axes and the tool would be optimising the
wrong one. **The tool should make a supported case easy to build and an unsupported one
hard to state.** That is an inversion of how storytelling and case-building tools
normally work, and it should be visible in the surface: strength shown rather than
hidden, exclusions named rather than dropped, and nothing that drafts framing FOR a member — the same rule as never prefilling a justification, extended from a field to a whole argument. **One exception, ruled by Bob on 2026-10-09 (D56; `BIO_Investigation_v0_1.md` §11):** the system may draft a case's written account from the evidence, in one or more framings, each labelled as the system's. The member writes the account, from a draft or from nothing, and it is published as hers. Before publication every sentence is checked against the evidence it cites: an unsupported sentence is tied to evidence or removed, a sentence the record contradicts is refused, and only framing that follows a printed bias statement may stay, marked in the text. An unsupported claim is never relabelled as bias: lying is not bias. **And a case carries no stories, context or human-interest accounts (D57).** The *story* above is the account the record supports; personal and human-interest stories belong in other publications.

### 5. A caution about designing for four audiences at once

Designing for four archetypes simultaneously is the reliable way to build something
that is nobody's. This project's own discipline points the other way: measure the case
you can actually observe — this group, Oakland — and design so that a second audience
costs a RENDERING rather than a rewrite.

That is the framework's §9 cost-table discipline applied to audiences instead of to
formats, and it has the same falsifiable test: when the second archetype arrives, does
it cost a rendering, or does it cost a new case model? If the latter, the decomposition
was wrong.

## Are focus / project / action / case the right constructs? — asked and answered

Bob asked directly, 2026-08-01. **Yes for what they cover; no for completeness**, and
the gap is in one identifiable place.

### The test

The constructs should cover the PATH with no verb unhomed. Mapping them:

| verb | construct | state |
| --- | --- | --- |
| questioning | **focus** — an open question or obstacle | built: `surfaced → elevated / deferred / dismissed` |
| exploring, discovering | **project** — the investigation, carrying an `objective` | built: `forming → investigating → matured → closed` |
| **documenting** | — | **NOTHING** |
| impacting | **action** — outward-facing | built: `planned → active → awaiting_response → resolved / abandoned`, with `counterparty` and `## Correspondence` |
| sharing / outputting | **case** | a UI concept only (`UI-PLAN` U12); not an object type |

Two of the five are unhomed, and the pattern is not random: **the middle of the path
and its end are missing** — precisely the part this design pass exists for.

### What is right, and why each earns its place

- **focus and project are correctly SEPARATE**, and the temptation to merge them should
  be resisted. A question can be tracked without committing an investigation to it,
  which is exactly what D-79's aggregation-and-ageing discipline needs for
  machine-surfaced findings: hundreds of open questions is survivable, hundreds of open
  investigations is not. `elevated_into` already models the promotion.
- **action is right and is UNDERUSED**, not wrong. Its shape is outward-facing and
  correct; what it lacks is connections (observation 2).
- **`information` is the fifth object and is absent from Bob's list of four.** Worth
  naming: it is the evidence unit, and the omission may be deliberate — it is substrate
  the member consumes rather than a construct they drive. But a member does create it,
  so whether it is a process construct is a real question rather than a formality.

### What is missing

**1. THE FINDING — a claim, what it rests on, and its strength. This is the big one.**
Documenting has no object. Today a finding is prose inside a project's `bundle.md`, or
it is implicit in a citation edge. It cannot be pointed at, cited, contradicted,
graded, or composed.

It cannot be folded into an existing type, and the reasons are not stylistic:

- **not a `focus`** — a focus is an open QUESTION, a finding is a provisional ANSWER.
  Opposite polarity, and merging them means the record cannot distinguish "we wonder"
  from "we found", which is the distinction the whole system exists to keep.
- **not `information`** — information is a captured DOCUMENT; a finding is a claim
  DERIVED from documents. Merging them lets a claim inherit a document's provenance
  without having a basis of its own, which is the overclaiming failure this project's
  entire discipline defends against.

**Everything the pass has proposed presupposes it.** Claim strength (observation 3) has
nothing to compute over without it; D-72's connection grades have no consumer;
invariant 7 has nothing to route equally; a case is prose rather than something
composable.

**2. THE CASE AS A RECORD OBJECT.** It is Bob's construct and the right one, and it
exists only as a UI notion. If a case is what LEAVES and what a group stands behind, it
needs states and a gate — because the boundary act already exists and currently
ratifies BUNDLES, not cases.

**3. THE FLOW MODEL** (D-128) — how the institution is supposed to work, declared and
refined over time. Not a focus (not a question), not a project (not an investigation),
not an action. It is a reference model many investigations read, and Bob named evolving
that understanding as a core capability.

### On adding constructs, having just argued for fewer

This is a different axis from the interaction-construct count and the test is different.
An INTERACTION construct earns its place if a member learns a shape once and reuses it.
A RECORD OBJECT TYPE earns its place if **the record must make a distinct kind of claim
about it**. A finding claims something documents do not claim; a case asserts something
a project does not assert. Those pass the test. Adding them does not reopen the
two-construct interaction decision, because all three are things the QUEUE and the ACT
already reach.

## Is a case anything other than a published finding? — Bob, 2026-08-01

The question nearly collapses the object, and it should be recorded that it nearly did.
Three of the four defences fail:

- **Composition fails.** "A case composes several findings" is not a distinction if a
  finding's basis may include other findings. Recursion handles it, and the root
  finding is then the case.
- **Narrative order fails.** A reading order is a property of the RENDERING, not of the
  object. Same answer as audience thresholds.
- **Audience threshold fails**, for the reason already given in observation 3: that is
  rendering.

**One survives, and it is enough: a case makes a COMPLETENESS CLAIM and a finding does
not.**

- A **finding** claims: *X is true, and here is what it rests on.*
- A **case** claims: *these things, taken together, support this conclusion — and this
  is the material set.*

That second assertion is a different kind of claim, and it is **the most dangerous one
this system can make.** A published finding that is true but selectively chosen is not
a lie at the finding level and IS a lie at the case level. Selection is precisely how
overclaiming happens in case-making, which makes this the case-making face of the
symmetric threat model Bob set out — the half that is ours.

### Why it cannot be a state on a finding

The tempting simplification is `finding.published = true`. It fails on reuse:

**A finding must NOT assert completeness, so that it can be reused across cases. A case
must, so that it can be trusted.** If findings carried a completeness burden they would
become case-specific and stop being reusable units; if cases did not carry it, nothing
would ever be accountable for what was left out. Two different claims, two objects, and
the difference is not publication state.

### What follows for the gate, and it parallels something already built

A system cannot VERIFY completeness — no gate can know what a group did not look at. It
can do what this record does everywhere else with what it cannot establish: make the
claim **visible, attributable and stated**.

So a case's gate is not *"are these findings true"* — that is each finding's own gate,
already inherited. It is **"has the author stated what was excluded, and why."**

That is the release flow's shape exactly (U5: typed acknowledgment and mitigation,
**never prefilled**), raised from a document to an argument. And it gives invariant 7 —
a finding that cuts against the goal is surfaced as prominently as one that supports it
— its enforcement point: the exclusion is an authored field on the case, so leaving
something out is an act with a name on it rather than an absence nobody can see.

### The remaining distinction, smaller but real

**A case is ADDRESSED and a finding is not.** A case is made TO someone FOR something —
reporting to the public, a claim to a court, a fix asked of a body. That is where
`action` connects: the ask is an action, and the case is what justifies it. A finding is
addressed to no one.

**Provisional conclusion of the pass:** case survives as an object, on the completeness
claim alone. If a later session finds a way to make completeness attributable without a
distinct object, the collapse is worth revisiting — but the burden is on that argument,
not on this one.

## THEY COLLAPSE. Focus, finding and case are one recursive object — Bob, 2026-08-01

Bob: *"Really, I'm wondering if focus, finding, and case are all the same thing. More to
the point, I need to see a reason why they're each different and must remain different.
If we can't then they should collapse."*

**I cannot produce a sufficient reason, and the previous two sections of this document
were structure looking for a justification.** Recorded in full, including what failed,
because the failures are the argument.

### Every defence reduces to a STATE or a FIELD, not a type

| defence offered | why it fails |
| --- | --- |
| a focus is a QUESTION, a finding is an ANSWER | that is "does this node have a conclusion yet" — a lifecycle state |
| a finding may not be empty; a focus may | a per-stage requirement, exactly as C-2.7 already makes `content_hash` an entry requirement for `verified` |
| a case asserts COMPLETENESS, a finding does not | a field, and an authored one. It survives the collapse intact — see below |
| a finding is REUSABLE, a case is BOUNDED | the same field, read the other way |
| composition — a case gathers findings | **Bob's point: if a finding may rest on earlier findings, recursion already does this and the root finding IS the case** |
| publication changes what the record owes the world | a stage with heavy semantics. The plane already models exactly this: ratification is irreversible and a published hash answers forever |

So the object is one thing with a recursive basis and a lifecycle:

    an INQUIRY — a question, which may gather evidence and other inquiries,
                 which may reach a conclusion,
                 which may be published as something the group stands behind

`focus` is that object early. `finding` is it once it concludes. `case` is it once it
is published and asserts its own material set. **A conclusion resting on conclusions is
free**, which is what the domain actually looks like: you ask, you gather, you conclude,
and your conclusion becomes an input to a larger question.

### What the collapse BUYS, which is not only tidiness

- **Recursion for nothing.** The layered-argument structure the pass needs stops being a
  feature and becomes the shape of the object.
- **One mental model**, and it matches how research feels. This is the audience rule
  paying out: a member learns *an inquiry* rather than three things and the rules for
  moving between them.
- **D-79 applies uniformly.** A machine-surfaced question and a machine-derived
  conclusion are the same type, so aggregation, ageing, and D-82's must-look-derived
  rule are written once.
- **Claim strength composes naturally** — weakest link along a basis chain, where the
  chain may include other inquiries.

### What must NOT be lost in the collapse

**The completeness assertion stays an explicit AUTHORED ACT at the publication stage.**
It must not become an implicit consequence of a state change. The reasoning from the
previous section survives unchanged and is now a stage requirement rather than a type:
publishing asserts *"this is the material set"*, no gate can verify it, so the record
does what it does with everything it cannot establish — makes it visible, attributable
and stated, with what was EXCLUDED named by its author and never prefilled.

If the collapse quietly turns that into a checkbox, the collapse has cost the one thing
the separate object was protecting.

### What does NOT collapse

- **`information`** — a captured document with provenance and custody. Evidence, not a
  claim about evidence. Merging it would let a claim inherit a document's provenance
  without a basis of its own.
- **`action`** — outward-facing engagement with a `counterparty` and correspondence. An
  inquiry is a thought; an action is a thing done to the world.
- **`project`** — and this one is worth stating because it looked collapsible too. Its
  states resemble the inquiry lifecycle, but its real content is **governance**: owners,
  participants, the three visibility positions (D-15), fork, name uniqueness. A project
  is a CONTAINER WITH MEMBERSHIP AND ACCESS CONTROL; an inquiry is a claim structure.
  Different axis, and merging them would put access control on every question.

**So the member-facing set becomes four: information · inquiry · action · project** —
evidence, claim, engagement, workspace. Down from five, and each answers a different
question: *what did we capture · what do we assert · what did we do · who is working on
this.*

### The god-object risk, WITHDRAWN as stated and narrowed to what is real

Bob: *"changing its name as it evolves doesn't make it god-like."* Correct, and the
risk as I wrote it was over-weighted. Phase naming is vocabulary, not structure, and a
long lifecycle is not itself a hazard — the check catalogue already carries forty-nine
per-state requirements, each with a number and a stated reason, and has not become a
thicket.

What remains, smaller and real: **every stage requirement must name the doctrine it
enforces.** That is the catalogue's existing discipline applied to a new type, not a
new burden. Without it a lifecycle accumulates rules nobody can justify — which is a
risk of any state machine, not of this one.

## Naming: three names for three phases, and the type name question

> **AMENDED 2026-08-10 (DEC-72, Bob): the third "phase" is now its own OBJECT.** The
> collapse below STANDS for inquiry and finding — one recursive object, a finding being
> an inquiry that reached a conclusion. **`case` is no longer a phase of that object: a
> case is a PRODUCTION OF A PROJECT** — a set of finding-versions plus the publishing
> project, published by a project owner against the project's own bar, members pinned by
> version. A finding serves many cases; a project spans many cases. What this section
> says about the names' member-facing role survives; what it says about `case` being the
> same object in a later phase does not. `docs/archive/CASE-AS-PRODUCTION.md` is the
> design; DEC-72 is the ruling.

**RULED by Bob, 2026-08-01: `inquiry` early (NOT `focus`), `finding` once it concludes,
`case` once published.** Same object, different phases, different names.

**This session's determination on how that is expressed**, since a phase called
"inquiry" on a type called `inquiry` reads badly:

- the TYPE is `inquiry`;
- the STATE values are neutral and machine-facing — `open` → `concluded` → `published`,
  with the existing triage dispositions surviving as exits;
- **`inquiry` / `finding` / `case` are the MEMBER-FACING NAMES for those phases**, which
  is what Bob asked for and what a member reads everywhere.

That keeps the state vocabulary clean and gives the member the three words that
describe what they are looking at.

**The rename cost, stated honestly: this is the concept's SECOND rename.** `problem`
became `focus` in 0.35.0, and the append-only constraint means `problem` is still a
legal alias in existing history and no history row was rewritten. `focus` → `inquiry`
adds a third name for one thing. The precedent handles it exactly — canonical
vocabulary changes everywhere, prior names stay legal where they already exist,
projections normalise — and PLAN.md records the whole shape of that migration. It is
not free, and it is affordable, and it should not happen a third time.

## Division: one inquiry becomes two or more

**RULED by Bob: the lifecycle must include dividing into 2 or more.** Composition came
free with recursion; division does not, and working through it produces four things.

**1. The sub-question case is already free; the genuinely new case is SUPERSESSION.**
Two different things wear the word "split":

- *this question has parts* — B and C are inquiries the parent cites as basis. Recursion
  already does this; nothing new is needed.
- *this question was MALFORMED* — A was one question and is actually two. A does not
  continue. This is the new capability. **CORRECTED 2026-08-01: an earlier version of this line said `supersedes` is already in `REL_VOCAB`, as if the mechanism existed. It does not.** VERIFIED: `supersedes`, `relates_to`, `initiates`, `corroborates` and `elevated_into` have ZERO occurrences in `store.mjs` — no producer and, for four of them, no consumer either; only `cites`, `derived_from` and `links_to` are actually created. `elevated_into` is REQUIRED by C-6.3 and written by no op at all. So membership of `REL_VOCAB` means only that C-6.1 will not refuse the string: division needs its edge BUILT, not merely permitted. The same correction applies to any design that leans on a relation being 'already in the vocabulary'.

**2. Apportioning the basis is an AUTHORED act, never automatic.** If A gathered thirty
documents and four sub-inquiries, dividing means deciding which belong to B, which to C,
and which to both. A machine cannot decide that, and evidence must never be silently
reassigned — the split records who apportioned what.

**3. A PUBLISHED case cannot be divided.** It can only be superseded by new inquiries
that cite it. A published hash answers forever and somebody may already have acted on
it; retraction and revision are different acts, and dividing a case after the world has
relied on it would be revision pretending to be housekeeping.

**4. Weakest-link composition makes division NECESSARY, not merely convenient** — and
this is the part worth keeping. If a case is only as strong as its weakest leg, then an
inquiry mixing one well-supported claim with one thin one is worth exactly the thin one.
Without division a member's only options are to overclaim (publish the mix at the
strong claim's apparent strength) or to stay silent (publish nothing). **Division is the
mechanism by which the strength rule does not force that choice**: separate the thin
leg, publish the strong claim honestly at its own strength, and leave the weak one open
as what it is. That makes division a doctrine requirement rather than a convenience.

**5. A published case is an INPUT, not a terminus** (Bob, 2026-08-01). It cannot be
divided, and it can be cited as basis by another inquiry or taken up by another project.
That is what keeps the record cumulative instead of a series of dead ends: a case
answers a question and becomes evidence for the next one, and because recursion is the
basis mechanism, this needs no new machinery — a later inquiry cites it exactly as it
cites a document. Two consequences worth holding: the citing inquiry inherits the cited
case's STRENGTH as one leg of its own weakest-link chain, so a case built on a case
cannot be stronger than the case beneath it; and a case that is later superseded leaves
everything that cited it needing re-evaluation, which is the same obligation the record
already carries when a capture's basis moves.

**And merging is free**, for symmetry: two members independently opening inquiries into
the same thing is resolved by a parent that cites both. No new mechanism.

## What a CLAIM is, and why it is a field rather than an object — 2026-08-03

Bob, in review: *"So what's a claim? Is it an answer to the question posed in an inquiry?…
Is a claim the object when it doesn't have enough supporting evidence, and a conclusion is
when it does?"* Determined here because the collapse left the word undefined, and an
undefined word in the middle of the design is how *"a claim can rest on another claim"* got
written and had to be corrected.

**An inquiry is a QUESTION and has no truth value. A claim is a PROPOSITION and can be true
or false. Concluding is the inquiry ADOPTING a claim as its answer** — not a third object, but
the relationship between the two, carrying the basis and the falsifier. This is why a leg
attaches to the CLAIM rather than to the conclusion, which is Bob's own correction in the same
review and is right.

**A claim is a FIELD of an inquiry, not an object, and it is not a phase.** Three things follow
and each was a candidate reading that fails:

- **Claim and conclusion are not one object in two states.** The inquiry is the object; the
  claim is what it holds; concluding is the act.
- **They are NOT distinguished by evidential sufficiency, and that reading must be refused.**
  *"Claim = not enough evidence yet, conclusion = enough"* puts a sufficiency threshold in the
  middle of the record, which this project has refused three times: `AUDIENCES.md` §5 forbids a
  per-reader gate, §4 Q2 calls a global strength floor *"its own doctrine problem"*, and DEC-15
  routed around it rather than through it. The deeper reason is that **"enough" is not a
  property of the evidence but of what you intend to do with it** — enough to publish a question
  is not enough to refer to a prosecutor — so a threshold in the object would have to pick one
  purpose and impose it on every other. What discharges the need for one is already built into
  the design: strength is DERIVED and names its weakest legs; **the falsifier is ACCOUNTED FOR —
  stated, or its absence stated, attributed and published**; and DEC-15's project-declared
  required strength lets a GROUP declare its own standard, published beside what was actually
  reached. A declaration, not a gate.

  > **CORRECTED 2026-09-17 (REC-117), AND THE SECOND LEG IS REPLACED RATHER THAN STRUCK.** Bob,
  > ruling on `NO_FALSIFIER`: *"NO_FALSIFIER is a condition that should be surfaced. But I think
  > it should also be something a member can override either temporarily or in the published
  > record."* The clause read **the falsifier is REQUIRED**, and it was LOAD-BEARING: it is one
  > of THREE things offered as together discharging the need for a sufficiency threshold in the
  > claim object. **Deleting it would have left an argument that no longer closes and nothing
  > saying so** — a design going quietly incoherent, which no gate in this repository would
  > catch. So it is replaced, and what now discharges the need in its place is **the same move
  > the other two legs already make: a DECLARATION.** `op=conclude` no longer refuses a finding
  > whose falsifier is unstated; it refuses one whose falsifier is unstated AND UNACCOUNTED FOR.
  > A member may conclude with no falsifier by SAYING SO, and the record then carries *no
  > falsifier stated* as a first-class value — never blank, never inferred from an empty field —
  > naming who accepted the absence and when, on every surface the finding appears on and inside
  > the signed bytes of the published case.
  >
  > **Why that is not a weakening of the argument, and is arguably the stronger form.** A
  > REQUIREMENT discharged the threshold by making every conclusion checkable. But a gate that
  > will not let a member past without a falsifier **PRESSURES THEM INTO INVENTING ONE**, and an
  > invented falsifier is a conclusion that LOOKS checkable and is not — the record claiming more
  > than it can support, by the shorter route and with no trace. That is the same reasoning that
  > moved the publication fence off the content axis onto the provenance chain; it is why
  > undetermined is first-class and must be STATED; and it is DEC-69 (a gate may not compel a
  > member) read at this altitude. **A reader of a concluded finding therefore learns exactly
  > what they learned before** — what would overturn this, or that nobody has said what would,
  > and who decided that was acceptable — **and the second answer is now TRUE where it used to be
  > unobtainable.** All three legs are now declarations, which is what the paragraph's own last
  > sentence has claimed since it was written.
  >
  > **What this does NOT do, stated so the next reader does not have to test it.** It does not
  > touch the claim object, the collapse, or DEC-32's falsifier-COUNT test — *one proposition,
  > one falsifier* is a rule about what a finding IS, and a finding whose one falsifier is
  > recorded as unstated still has exactly one. It does not make the condition invisible: the
  > refusal still fires for every caller that does not explicitly ask for the override, which is
  > the SURFACING half of Bob's ruling and is asserted in the direction that fails. And it admits
  > exactly one wrong answer — **a SILENT override**. An override missing its member or its date
  > is refused by C-2.8 in its own right, because a record that has stopped requiring a falsifier
  > without saying who decided that is worse than one that never asked.
- **A conclusion does not silently revert when its evidence weakens.** Strength genuinely can
  fall — a grade regraded down, a leg severed, a capture that proves to be archival rather than
  direct. When it does, DEC-16 already makes that an EVENT propagating to every ancestor, and
  DEC-12 already permits REOPENING as an act with a name and a date. Nothing reverts by itself,
  because a conclusion that un-concludes with nobody accountable is the record changing its mind
  in silence.

### Can one finding hold SEVERAL claims? Not today, and the alternative is already expressible

Bob: *"a finding can have multiple claims. (That's true, right?)"* **It is not true as built, and
the honest answer is that it may not need to be.**

Several propositions — *the transfer happened*, *no resolution authorised it*, *the balance fell
below the statutory floor* — are expressed as SEPARATE INQUIRIES that the larger one rests on.
In that sense a finding does draw on many claims, because **a leg pointing at a concluded
inquiry is a leg pointing at that inquiry's claim.** Composition is what the recursion is for.

**The argument for keeping it a field is the collapse's own test.** A claim with legs is shaped
exactly like an inquiry with legs, so a claim nested inside a finding is an inquiry denied its
own identity — it cannot be cited by anything else, published on its own, or given its own
falsifier. Promoting it rebuilds the multiplicity the collapse removed, which is the argument
that closed focus/finding/case.

**Two things could still force the promotion, and both are open:**

1. **Ergonomics, and it is MEASURABLE rather than arguable.** If every component proposition
   must become a full inquiry with its own falsifier, stating one finding may cost more than a
   volunteer's evening. That is observable once M9 ships and should be measured, not predicted.
2. **CONTRADICTION, which is §4 Q14. ANSWERED 2026-09-17 — see §CONTRADICTION below, which
   inverted this premise: contradiction is an OUTPUT the system exists to find, not an edge case
   to tolerate. What remains undesigned is only the IRRECONCILABLE PAIR **[audited 2026-09-17: STILL TRUE, as of 2026-09-17]** Two claims that
   conflict, both held, neither abandoned. `role: cuts_against` is one leg's polarity, not a structure for two claims
   contradicting each other. **If a claim ever becomes an object, this is the reason it will** —
   and note the two cases are different: Bob's question is about COMPOSITION, which recursion
   already answers, while Q14 is about CONTRADICTION — **which §CONTRADICTION now answers in two of its three cases (2026-09-17); the irreconcilable pair, once thought to need this object, is answered without it by DEC-76, 2026-09-29.**

`inquiry_basis` does not exist in the schema, so all of this is still free.
**CLARIFIED 2026-08-03 by Bob, and the question sharpens rather than closes.** *"I'm not
necessarily suggesting that claims can themselves contain sub-claims. But I wonder if a
finding with multiple claims is appropriate in some situations."* His example, recorded
because it is the best test case the question has: an inquiry asks *"Can a parallel
municipal power utility develop distribution lines separate from those of another utility in
overlapping service territory?"* One claim's legs cite utility regulations that conflict
with parallel distribution; a SECOND claim's legs cite rights enshrined in the state
constitution and the court decisions that clarify them. **Two parallel claims — two
independent bodies of support answering one question — not nesting.** That distinguishes it
from the composition case above (which recursion already answers) and from Q14's
contradiction case (**answered 2026-09-17 in §CONTRADICTION except for the irreconcilable pair**): this is PLURALITY — same conclusion-shape, two
grounds. The two candidate shapes are `0..n` claims on one finding, or two inquiries under a
parent whose published rendering reassembles them; forcing the example into two inquiries
would split an answer a reader needs whole, which is the strongest argument yet against the
field reading. Still OPEN, leaning toward plurality; `inquiry_basis` does not exist, so both
shapes remain cheap.
**RAISED AS DEC-32, 2026-08-03 (session BOB), with a worked recommendation:** plurality shaped
as GROUNDS rather than claim-objects — one finding, one conclusion, `1..n` named grounds, each a
labelled partition of the basis legs the member asserts is INDEPENDENTLY SUFFICIENT; today's
flat basis is the degenerate one-ground case. The consequence that matters: grounds compose
DISJUNCTIVELY — the finding's strength is its strongest sufficient ground, each ground's
strength the weakest leg within it — so the utility example publishes at the constitutional
ground's strength with the regulatory ground beside it, where today's weakest-leg rule would
hold the whole finding down and push the member toward division. A suspended leg suspends its
ground; the finding suspends only when every ground is (DEC-18's pattern, one level up).
Contradiction (§4 Q14) stays separate: grounds agree on the conclusion. Awaiting Bob.
**CLARIFIED AGAIN 2026-08-03 (Bob): "what that really is is multiple claims" — conceded;
each ground IS a claim, the same proposition on a distinct basis. The test that now carries
the design: COUNT THE FALSIFIERS. One proposition, one falsifier, several independent bases
→ plurality inside one finding (DEC-32's shape, whatever the surface calls the parts).
Different propositions → different falsifiers → separate inquiries, composed by recursion,
rendered together. DEC-32 remains open.**

## CONTRADICTION — Q14 ANSWERED, and the premise was INVERTED — Bob, 2026-09-17

**Q14 sat undesigned **[audited 2026-09-17: historical narration, not a live gap]** for six weeks on the stated grounds that *the contradiction shape has no
consumer*. Bob supplied the consumer and reversed the sign of the question.** Verbatim:

> *"Why CAN'T a record hold two findings that flatly contradict each other… A situation like that
> might be the very thing that the investigation is searching for. The regulation that says one
> thing but action that doesn't conform. The city department saying one thing in March and other
> in October. I contend that contradictions are golden nuggets that shouldn't be 'fixed', but
> rather drawn attention to."*

**That is doctrine, and it changes what this construct IS: contradiction is not an edge case the
model must tolerate, it is an OUTPUT the system exists to find.** The section above reserved this
question **[audited 2026-09-17: quoting the reservation this section ANSWERS]** — *"CONTRADICTION, which is §4 Q14 and is undesigned… If a claim ever becomes an object,
this is the reason it will"* — and this section answers the part that does not need the object.

### The three cases, and only one of them carries a DUTY

Bob refined it into three, and the distinction is load-bearing because it decides what is OWED.

| case | what it is | what it obliges |
| --- | --- | --- |
| **in the WORLD** | the rule requires X and the department did not-X; the department said X in March and Y in October | **A FINDING.** The system's product. Kept, published, drawn attention to, never "fixed" |
| **in the RECORD** | one part of our own holding asserts a fact and another asserts its opposite | **A DEFECT IN OUR HOLDING, with a DUTY to identify, present and resolve** — because in one of the two places the record is wrong, and trustworthiness of the record is the whole product |
| **NEITHER** | *"spending was reduced a little"* vs *"spending dropped a lot"* | **NOTHING. This is not a contradiction** — two descriptions at different precision of one fact |

**THE FIRST CASE IS EXPRESSIBLE TODAY AND NOTHING STRUCTURAL IS MISSING.** *The rule requires X and
the department did not-X* is ONE inquiry whose CONCLUSION IS the discrepancy, supported by legs on
both sides. What is missing is that nothing PROPOSES one and nothing DRAWS ATTENTION to it — a
detection and surfacing capability, not an architecture change. **So the golden nuggets are
reachable without reopening claim-as-field, and they should be taken first.**

**THE SECOND CASE IS THE FIRST CONTRADICTION SHAPE WITH A DUTY ATTACHED RATHER THAN A CAPABILITY**,
and it must not be folded into the first. They share a detector; they do not share an obligation.

**THE THIRD CASE IS THE ITEM.** A detector that cannot tell imprecision from genuine double-speak
will bury members in false conflicts and be switched off inside a week — this estate's own recorded
failure mode for alarms, and the reason `strandedwork.mjs`'s over-strictness arm exists. **So the
acceptance test for IDENTIFY is its OVER-STRICTNESS ARM, not its recall.** Bob's own examples of
cause are the hard part rather than colour: *"a difference of opinion…, a misquote, or genuine
double-speak by a politician."* The first is not a contradiction at all.

### Three mechanisms, separable, built in this order

1. **IDENTIFY** — detect candidate conflicts. Its acceptance test is the over-strictness arm above. **Designed
   2026-09-19 (level 2): `docs/development/CONTRADICTION-IDENTIFY-DESIGN.md`** — pairing in the plane by four named
   keys, judgement as labelled machine work in five labels, the false-conflict rate over a fixture as the gate.
2. **PRESENT** — a member sees BOTH SIDES with enough context to judge, in the record's own words,
   never a machine verdict (DEC-24, D-82).
3. **RESOLVE** — a MEMBER'S act, attributed, never silent, and it never deletes either side:
   content rows go `stale`, never away.

**RESOLUTION RECORDS ITS KIND, AND THIS IS WHERE THE CIVIC VALUE IS.** A vocabulary that flattened
every cause to *resolved* would throw away the thing worth having: **genuine double-speak, resolved
and recorded, is a FINDING ABOUT THE SUBJECT** — produced as a by-product of keeping our own record
straight. So at least one kind must be able to PROMOTE the conflict INTO a finding rather than
closing it, which is case two turning into case one.

### RULED 2026-09-29 (DEC-76): a contradiction is conditional, and resolving one is an inquiry

Bob, 2026-09-29, agreeing with four recommendations; the full ruling is DEC-76 in `docs/development/DECISIONS.md`. **A contradiction is two assertions that cannot both hold IN THE SAME RESPECT** (subject, time or occasion, scope, meaning, observer or method, accurate capture, applicability). His example: *"The bride wore a red dress"* and *"The bride wore a white dress"* may both be so, one at the ceremony and one at the reception, or as different guests saw one dress. A candidate is an APPARENT conflict; resolving it finds the respect in which the sides differ, the side that is wrong, or that the conflict is genuine, and an assumption offered to dissolve it is a claim that needs evidence. **A candidate a member takes up becomes an INQUIRY**, and its resolution is that inquiry's conclusion, recording its kind in three families: DISSOLVED, CORRECTED, GENUINE (double-speak promotes into a finding; obligation against act routes into `conformance`; a conflict of norms is explored by the canons that reconcile rules and, if none does, is itself a finding; an irreconcilable pair is held, both sides kept). **This answers the irreconcilable pair below without a claim object.** A finding resting on an unresolved RECORD contradiction may be published, with the contradiction disclosed. PRESENT and RESOLVE are still to be designed at level 2 on these terms.

**PRESENTATION, RULED THE SAME DAY (DEC-77).** A contradiction is met INLINE by default, where its two points already sit: a tension mark opens a short *how do these differ?* clarifier over DEC-76's coordinates, and only *they really conflict* or *not sure* opens the contradiction inquiry as a screen of its own. Six forms serve six purposes (compare, timeline, assumptions check, competing-hypotheses matrix, the auditor's Criteria / Condition / Cause / Effect finding, the in-place marker). Context SUPPORTS and never silently decides: facts the record holds are filled in with their source, judgements are recommended with a reason and accepted in one attributed act the record remembers as acceptance, nothing is preselected unseen, and the acceptance rate is measured as the guard against steering.

### What still needs the claim object, and is Bob's — ANSWERED 2026-09-29 by DEC-76 (above), without the object

**The IRRECONCILABLE PAIR** — two findings about ONE question, each well supported, that cannot both
be true, where the record declines to choose and keeps both. `role: cuts_against` is one leg's
polarity and cannot express it. The section above says *"if a claim ever becomes an object, this is
the reason it will"*, and that is now live. **It is the one part of Q14 this session does not
decide** (answered by DEC-76 on 2026-09-29, without a claim object: see the RULED subsection).

### Two constructs share the word, and conflating them is the hazard

**`BIO_Content_Framework_v0_10.md`'s *contradicting aspirations* is a DIFFERENT CONSTRUCT.** It was
ruled 2026-07-30 — contradicting aspirations are WELCOMED, *"what the system looks for is CONTACT,
not contradiction"*, because judging whether two aspirations truly conflict is semantic work the
system cannot do. **That is the goal axis. This section is about conflicting CLAIMS.** They share a
word and nothing else, and a reader who merges them will import *we do not judge conflict* into the
one case that carries a duty to resolve it. Named here because the corpus's own single-authority
sweep is what this hazard is for.

## THE ACTION PLAN — mapped 2026-08-03, not yet in the review document

Bob, 2026-08-03: *"the finding of a project indicate[s] that some government action (or action
by some other person or organization) doesn't conform to the law, policies, regulations, stated
intentions/promises, or other restrictions. In situations like this, an action plan needs to be
constructed. This action plan may differ based on the user type (journalist, activist, lawyer,
etc.) or other very important (strategic, tactical, political, financial, temporal) factors. The
system must include a surface that lays out the set of action options and depicts them together
with the dependencies, deadlines, resources required, and other factors. The system (with support
of AI skills) may suggest an action plan that includes a progressive series of steps with
dependency graphs keyed to possible outcomes of each step."*

This section is the MAP he asked for, before anything is added to the review document.

### 1 · What a plan answers, and why it is not an inquiry

A finding of NONCONFORMITY says conduct departed from a standard — a law, a policy, a
regulation, a stated intention or promise, or another restriction. Note the structure this
already has and needs no new machinery: **such a claim has legs pointing at BOTH the standard
and the conduct**, and both are ordinary evidence.

A plan answers *"what do we do about it?"* — and that is decisively **not a claim about the
world**. It has no truth value, no falsifier, and evidence does not bear on it. So it fails the
inquiry test at the first question, and cannot be modelled as one.

### 2 · The object question, and the argument that settles it

Three candidate shapes:

| shape | why it fails, or does not |
| --- | --- |
| a field on the finding | the plan outlives and outgrows the finding, and may serve several findings at once |
| a set of `action` bundles in a `proposed` state, with edges between them | **the near miss.** It reuses an object that exists and models decline as a state, which the collapse precedent favours. It fails on one thing: an `action` is defined as *"an outward engagement — something SENT to somebody outside the group"*, and an option never taken was never sent |
| **a distinct object holding candidate STEPS** | **recommended** |

**The decisive argument is the options NOT taken.** *"We considered a grand-jury referral and
did not pursue it, because the filing window closes before we can reach the required strength"*
is exactly the kind of authored decision this record exists to hold — it is the same doctrine as
the completeness statement (what you left out, authored, never prefilled) and as invariant 7
(what cuts against travels the same path as what supports). If an option only becomes an object
once chosen, every rejected option vanishes and the plan silently overstates the group's
deliberation. **A plan must be able to hold what it decided against.**

So: a PLAN holds STEPS. A step that is taken produces an `action` (the existing object, unchanged,
still the outward engagement). A step declined keeps its reason and stays visible.

### 3 · Structure — borrow the progression vocabulary, do NOT borrow the progression object

`progression_stages` already carries most of the shape: `stage_no`, `after_stage` (dependency),
`within_interval` (deadline), `required`. A plan's steps want exactly those, plus three things
progressions do not have:

- **outcome-keyed branching.** `after_stage` is linear. Bob asks for *"dependency graphs keyed
  to possible outcomes of each step"* — each step declares its possible OUTCOMES (records
  produced / denied / ignored past the statutory deadline) and later steps hang off a specific
  outcome. This is a decision tree, not a chain, and it is the genuinely new structure.
- **resources.** What a step costs: money, member hours, expertise the group may not hold,
  standing to bring it.
- **disposition.** chosen · declined-with-reason · done · blocked.

**AND THEY MUST NOT SHARE AN OBJECT, for a doctrinal reason rather than a technical one.** A
progression models what SOMEBODY ELSE is supposed to do, and its entire purpose is to make a gap
DETECTABLE and raise it as a finding about the world. A plan models what WE intend to do. If the
two shared machinery, **our own missed deadline would surface as a finding about the record** —
converting a management fact into evidence, which is precisely the overclaiming this project's
threat model is pointed at. Same shape, opposite subject, separate objects.

### 4 · Variation by user type is already expressible, and lands in the right place

The plan varies by journalist / activist / lawyer, and by strategic, tactical, political,
financial and temporal factors. This needs no new axis: **capabilities, journeys and surfaces
vary by USER TYPE** (`AUDIENCES.md` §0, unchanged), and the action repertoire is part of the
journey. The seven `action_kind` values already shipped — `cpra_request`, `grand_jury`,
`controller_referral`, `public_comment`, `media`, `litigation_support`, `other` — with
`risk_tier` 1–3, are that repertoire's first draft.

The plan therefore belongs to a PROJECT + FINDING, never to a person: a lawyer's project and a
journalist's project may build different plans from the SAME finding, and each project already
declares the evidentiary strength its work requires (DEC-17). **A step may be blocked because
the finding has not reached the project's declared strength** — which is the first place that
declaration does mechanical work rather than only being disclosed.

### 5 · Where the machine helps, within DEC-24's boundary and adding no exception to it

- **SUGGEST a plan** (PURSUE): propose steps, sequencing, contingencies. Under DEC-24 rule 1 a
  suggested plan is a set of CANDIDATES; the member adopts, edits or declines each, with a
  reason. The machine never adopts a step.
- **CHECK a plan** (CHECK): an unreachable deadline; a step depending on a resource the group
  does not have; **an unhandled branch — an outcome with no next step**, which is the most
  valuable check because it is the one a person misses; a step whose finding is below the
  project's declared strength; a deadline now passed.
- Rule 4 holds unchanged: a checker RAISES into a queue, never edits the plan.

### 6 · The surface — S11, and the journey gains a stage

Ten surfaces are specified today; this is an eleventh. S10 THE ACTION PAGE holds ONE outward
engagement. **S11 THE ACTION PLAN holds the graph**: options, dependencies, deadlines, resources,
branches keyed to outcomes, and the declined options with their reasons.

The journey inserts cleanly and the existing edges are unchanged:

    finding → S11 PLAN → S10 individual actions → consequence → back in as evidence

`impacting` is currently the stage with *no working process whatsoever*, so nothing is being
retrofitted.

### 6a · PLANNING FROM WHAT IS NOT YET ESTABLISHED — agreed, and it is not a concession

Bob, 2026-08-03: *"the process of building up an understanding of what's needed to justify an
action isn't the same as claiming that the action is justified. Not at all! Agreed?"*

**Agreed, and the design already contains the principle — this applies it one level up.** A
HUNCH is a connection asserted ahead of its evidence so a line of thought can be followed
(DEC-15). An UNSUPPORTED CLAIM is a standing objective the system can pursue (DEC-22). Both
were ruled legitimate on the same reasoning: investigation must be free, and what is gated is
PUBLICATION. Planning from an unestablished finding is the identical move, and refusing it
would contradict two rulings already made.

**The argument that matters most is what refusal would COST.** An investigator will do this
reasoning regardless — in a notebook, in their head, in an email thread. Refusing to hold it
does not make the record more honest; it makes the record LESS COMPLETE, and pushes the actual
shape of the investigation into exactly the places this system exists to replace. A record that
cannot say *"we were working toward this"* cannot show how a case was really built.

**THE PRINCIPLE, stated so no build session re-litigates it: the gate belongs at the ACT, not
at the reasoning.** A plan may rest on premises not yet established. An act that reaches outside
the group may not be taken on them. That is the same line publication already draws.

#### Two directions of exploration, and both are first-class

- **FORWARD, from a hypothesis.** *"If this finding held, what action options would open up?"*
  Asserts nothing about whether the finding holds. It maps consequence.
- **BACKWARD, from an action.** *"Given what this project has already established, what
  additional findings or claims would ALSO need to be true for action X to be a credible option
  worth considering?"*

**The backward question is the more valuable of the two, and it is the objectives engine
pointed at a new target.** Its output is not prose — it is a WORK LIST: the specific findings
that do not yet exist or are not yet established, each of which becomes an objective under
DEC-22, pursued by the member and by the machine together. This is how investigators actually
build cases, and it is the single most productive thing the system could compute.

#### The safeguard is LABELLING, not refusal — and Bob named it first

*"A property of action plans that are presented is which elements of the plan are currently
supported by the evidence."* Every element of a plan carries its **support status**, and it is
never absent or implied:

| status | meaning |
| --- | --- |
| **established** | rests on findings that have reached the project's declared required strength |
| **short of the standard** | rests on real findings that have not yet reached that strength — the gap named, per leg |
| **hypothetical** | rests on a finding that does not yet exist, held as an explicit premise |

**Rendering rule, and it is the whole safeguard:** a plan element's support status is displayed
wherever the element is, in the same treatment everywhere, exactly as `undetermined` is. A plan
that showed its steps without their support status would be the overclaiming failure — not
because it planned from a hypothesis, but because it hid that it had.

**Consequences for the build:**
- A hypothetical premise in a plan is DECLARED, and it is **HUNCH DEBT** — so nothing
  resting on it can be published while it stands, which needs no new gate. *(Read "bias
  debt of the hunch kind" 2026-08-05; corrected per D-188 / DEC-46 (d), because the
  general term names the class that does NOT block and the hunch is the one that does.)*
- An outward act's pre-flight REFUSES when its step is not `established`, naming the premise
  and the shortfall. This is where the project's declared required strength (DEC-17) does
  mechanical work.
- The backward question's output is objectives (DEC-22), not commentary.

### 6b · THE TWO HARD PARTS, SCOPED DOWN — 2026-08-03

Both were named as blockers on specifying S11. Bob dispositioned both, and neither is a blocker
any more.

#### Resources: an ATTACHED LIST, not a model

Bob: *"That depends on the action, right? But the complexity of figuring out the resources
needed for every action is maybe too big and uncertain at this point. I would simply suggest
that there being a means of collecting and presenting associated resource[s] be a part of the
action plan. (a collapsable list?)"*

**Adopted, and the reasoning is worth keeping because it is a general lesson about this design.**
A typed resource model would have to decide, in advance and for every action kind, what
categories exist — money, hours, expertise, standing, political capital, someone's willingness
to be named — and the enumeration would be wrong for the first group that used it. **An open
list attached to a step is honest about the uncertainty in a way a premature schema is not**,
and it does not foreclose the schema later: real lists from real groups are the evidence a
schema would need, and none exists yet. This is the same instinct as `MEASUREMENTS.md` — do not
write a constant nobody measured.

So: a step carries a **RESOURCES list**, free-form entries, collapsed by default and expandable.
No enumerated categories, no required fields, no arithmetic over it. What it buys is that the
question *"what would this cost us?"* has somewhere to live at the moment a group is deciding.

#### Action preconditions: DEFERRED, with the derivation path named

Bob: *"Knowing what each kind of action requires before it's worth attempting may also [be] too
difficult to take on now. But what we do know is that it could be figured out through some
combination of supporting evidence already gathered, mechanical means, and AI support."*

**Deferred, and the second sentence is the part to keep**, because it converts an open-ended
research problem into a bounded one with three named inputs:

- **supporting evidence already gathered** — what this project has established is itself part of
  the answer; the gap is relative to a corpus that exists, not to an abstract standard;
- **mechanical means** — some preconditions are structural and checkable without judgement (a
  filing window against a date, a standing requirement against who the group is, an exhaustion
  requirement against actions already recorded);
- **AI support** — for the procedural knowledge that is neither in the corpus nor mechanical.

**What this changes for the build: the BACKWARD question is deferred; the plan is not.** A plan
can be authored, ordered, branched, costed and labelled with support status today, with the
member supplying what an action requires. What waits is the system ANSWERING *"what else would
have to be true for X to be credible?"* on its own. That is a capability added later to a
structure that already exists, not a prerequisite for it. Recorded as D-165.

#### Consequence for S11

With resources scoped to an attached list and preconditions deferred, **S11 is specifiable
now** for everything except the backward question. Its state inventory can be drawn: the plan
with its steps, dependencies, deadlines, branches keyed to outcomes, declined options with
reasons, resources collapsed, and each element's support status. Only the *tell me what is
missing* affordance waits on D-165.

### 7 · ONE QUESTION THIS MAP DOES NOT ANSWER, and it is Bob's

**What, if any, of a plan is PUBLISHED?** A group's strategic deliberation — *we considered
litigation and cannot afford it*, *we are timing this before a council vote* — is plausibly the
most sensitive material the system will ever hold, and precisely what an opponent would most
want. It is also the material most likely to be sought under legal process.

Running provisionally, and the conservative branch: **the plan is WORKING material and is never
published.** What legitimately crosses into publication is already covered elsewhere — an
action's OUTCOME can become evidence (DEC-14 governs impact claims), and the group's declared
position on contacting the subject is published by DEC-13. Neither requires publishing the
deliberation. **Recommendation: keep it that way, explicitly, and make the two-bucket fence's
default cover plans by construction rather than by a permission check.** Raised as DEC-25.

### 8 · AN ACTION IS NEVER A LEG OF A QUESTION'S BASIS — RULED 2026-09-23 by BOB #29 (D-181)

C-2.8 refuses an `action` as a basis leg (`bio-checks.mjs` `checkInquiryBasis`: *a leg rests on
information or on another inquiry, nothing else*), and the overdue→finding loop carries the action
as a `references[]` edge instead. **That is right, and it is a ruling, not a deferral.** DEC-14's
own determination already drew the line at the write path: *promoting an outcome to an impact claim
requires a basis leg pointing at evidence that is not our own action.* A leg is what GRADES a
claim; an action is our own act, so a claim graded by it rests partly on something we produced —
the costs-nothing outcome (`CLAUDE.md` §5) turned on ourselves, which is what DEC-14 forbids.

What a non-response finding needs is not the action as evidence but the action as its SUBJECT.
*"We asked on this date and nothing came back by that date"* is an OUTCOME in DEC-14's vocabulary —
a dated fact sayable at full strength with no causal claim — and the act it is about travels as the
edge that names it (`references[]`; a reply travels as `responds_to`, REC-24). BUILD-ORDER's
*"an inquiry whose basis includes this action and its clock"* (archived research, O3) is superseded
by this paragraph. **The one question left, and it is a different construct:** whether an
observed ABSENCE of a reply — the look for a response and its `LOOKED_ABSENT`, with the authority
that looked (`STORE-AS-CACHE.md` §ABSENCE AS DATA; D-129) — may be a basis leg. Trigger: a real
group's non-response case needs that absence GRADED rather than stated; it is then designed as an
observation-as-leg, never as an action-as-leg.

## Resolutions forced by the adversarial pass, 2026-08-01

The critique found 10 doctrine hits, 13 correctness, 3 usability. Four are contradictions
in THIS design rather than in the code, so they are resolved here. All four were verified
against the source before deciding.

### R1 · An UNDETERMINED leg leaves the chain UNRATED. It does not floor it and is never ignored.

The three storyboards gave three different answers, and the code they proposed reusing
gives a fourth: `#weakerGrade` (`store.mjs:3444-3446`) ranks an unknown grade with
`|| 0`, i.e. **below grade D** — weaker than the worst grade there is.

Decided, and the reasoning is doctrinal rather than aesthetic:

- **Ignoring it launders.** A chain whose weakest leg is invisible is exactly the
  overclaiming this project's threat model calls the more dangerous half.
- **Flooring it below D punishes honesty.** It would make recording `undetermined`
  expensive, pressuring a member to invent a determination to keep a grade — which is
  precisely the pressure D-97 removed at the intake gate and D-114 refused to recreate at
  the publication gate. Moving that pressure into strength would reintroduce it a third
  time.
- **UNRATED states the truth.** The chain has no computed strength, and says which leg is
  why. A case may still publish with strength stated as UNRATED pending that leg —
  honest, publishable, and impossible to hide.

**THE WORD IS `UNRATED`, NOT `SUSPEND`, and the rename is not cosmetic.** The
reconciliation pass found that `SUSPEND` already means something ELSE in `SB-OUTPUT`
section 5.1, and that `BUILD-ORDER`'s REC-12 says "ship SUSPEND" citing that file — so a
worker following the build order in good faith would have built the behaviour R1
forbids, while every document appeared to agree. A word two designs use differently is
worse than a word neither has, because the disagreement is invisible until it ships.

**Consequence for the build: `#weakerGrade` MUST NOT be reused unchanged.** A null grade
is not a weak grade; it is the absence of one, and the two must not share a rank.

**AMENDED 2026-08-02 by Bob (DEC-18) — an ungraded leg is INERT, and UNRATED becomes the
boundary case rather than the rule.** *"An ungraded leg doesn't contribute to a conclusion,
but if there are other graded legs, then it doesn't suspend the conclusion either."*

This is not the behaviour R1 forbade, and the distinction is the whole amendment. R1's
first bullet refused grading on the determined legs **while the ungraded leg still counted
as part of what the conclusion rested on** — support drawn from a leg that paid nothing
toward strength. The amendment removes the support as well as the cost:

- **An ungraded leg contributes NOTHING.** Not weighed, not averaged, does not floor, does
  not unrate. It sits in the basis, named and visible, as a leg that is present and **not
  yet load-bearing**.
- **The conclusion is graded on its load-bearing legs**, which is honest because those are
  the only legs it rests on.
- **UNRATED survives as the boundary case.** If EVERY leg is ungraded there are no
  load-bearing legs, the conclusion rests on nothing established, and it is UNRATED.
- **Every ungraded leg is named, one or many** (Bob, same review: *"more than one leg may
  have no established grade, in which case every such leg will be named."*). This is what
  keeps INERT from meaning INVISIBLE, and it is the clause the build must not drop.

The consequence for `#weakerGrade` is UNCHANGED and if anything sharpened: a null grade
still must not share a rank with a real one, because the comparator must now EXCLUDE the
null leg from the population rather than rank it anywhere in it.

**The residual hazard, named because the amendment creates it.** An ungraded leg costs the
conclusion nothing, so leaving a leg ungraded is now the cheapest way to keep an
inconvenient one out of the reckoning — a laundering path in the opposite direction from
the one R1 closed. Three things already stand against it and they are named here so no
build session assumes a fourth is needed: every ungraded leg is NAMED on the case and in
the index row; the completeness statement is authored and must say what the case leaves
out; and invariant 7 makes a leg that cuts against travel the same path as one that
supports. Whether that is sufficient is D-159, and it is a question for use rather than for
argument.

### R2 · Capture grade and connection grade are TWO scales and must never be composed into one number

Both run A–D and they measure different things. `CAPTURE-FIDELITY.md:40` records that
Grade A is out of a Worker's reach, and the Intake Doctrine rules that **neither axis
substitutes for the other**. Weakest-link across a mixed chain substitutes them by
construction — a category error this design introduced by saying "strength composes as
the weakest link" without asking *the weakest link of what*.

**REFINED 2026-08-01 after reading the code's own stated intent, which R2's first
version talked past.** `store.mjs:3441-3443` says, deliberately: *"Reuses the resolution
grade rank so the two axes cannot drift."* That is an argument FOR sharing a scale, made
by the person who built it, and it deserves an answer rather than an override. Reading
the fuller comment at 3434-3439, the pair it composes is a connection's TWO ENDS — how
each end resolved to the shared entity — and both are section 8.1 grades. **That
composition is sound and R2 does not forbid it.**

What R2 forbids is narrower and must be named precisely, because the first version did
not: **CAPTURE grade must never be composed with CONNECTION grade.** Capture grade
measures directness of acquisition (A is a WACZ chain of custody and is out of a Worker's
reach; B is a direct fetch, or an archive replay of the publisher's raw bytes, labelled "via
archive"; C is reference only, a locator without archived bytes or a rewritten replay; the
Intake Doctrine §3 defines them). Connection grade measures what would be
needed to check an inference. They answer different questions and the Intake Doctrine
rules neither substitutes for the other — but they share the letters A–D, which is what
makes the error easy and invisible.

Decided: **a chain's strength is a PAIR, never a scalar.** A chain carries the weakest CAPTURE
grade among its evidentiary legs and the weakest CONNECTION grade among its inferential
legs, and nothing averages, mixes or collapses them. A rendering may show both; no
rendering may reduce them to one letter.

Two smaller consequences: **no surface may display Grade A for a direct capture** (the
suite already has a negative control on this), and a case resting on one capture and one
inference has two strengths, which is more honest than any single number would be.

**AMENDED 2026-08-02 by Bob (DEC-21) — the CONCLUSION above stands; the MECHANISM below it
was wrong.** Bob: *"A capture is the act of reading a document in. A connection is an edge
between 2 or more pieces of information… They're different things. So why are those grades
combined?"*

They are not combined, and the word **PAIR** invited the reading that they are one two-part
score. What does not survive is R2's account of which legs carry which axis:

- a **CAPTURE** grade is a property of an INFORMATION object — how the bytes were read in;
- a **CONNECTION** grade is a property of an EDGE between pieces of information.

A leg of a basis IS an edge pointing at a target. So the leg has a connection grade of its
own, and if its target is a document, that document has a capture grade. **One document leg
carries BOTH** — which R2's own corrected example already showed (*"capture ⟨B⟩ … connection
⟨A⟩"*). "Evidentiary legs versus inferential legs" cannot survive its own worked example.

Corrected: a conclusion reports **two independent measurements over two different
POPULATIONS**, not one measurement over two kinds of leg.

| | ranges over | answers |
| --- | --- | --- |
| **CAPTURE** | every DOCUMENT the conclusion reaches | *how well do we know these are the bytes the body published?* |
| **CONNECTION** | every EDGE the conclusion rests on | *how well established are the relationships this reasoning uses?* |

Reported side by side because a reader needs both. Side by side is not composition.

**Unchanged and not to be re-opened:** a connection's OWN grade is composed from its two
ends (`connections.a_grade`, `b_grade` — how each end resolved to the shared entity), and
that composition is legitimate because both ends measure the same kind of thing. The schema
carries exactly this shape.

### R3 · The collapse deletes the system's only cycle guard, and must replace it explicitly

Verified: `store.mjs:2092-2104` refuses a citation whose members are not `information`,
and its comment names the side effect — *"this also catches a Project citing itself,
which is a cycle with nothing to mean."* The only cycle protection in the record is an
accident of a type check.

Under the collapse an inquiry citing an inquiry is the POINT, so that type check goes and
takes the guard with it — while strength becomes an unbounded recursive derive-on-read.
A self-citing or cyclic basis graph would not merely be meaningless, it would not
terminate.

Decided: the basis graph is a DAG, enforced at write. An inquiry may not cite itself
transitively, the refusal names the cycle it found, and derivation carries a depth bound
whose exhaustion is reported as `undetermined` (R1) rather than as a failure.

### R4 · Division must cost at least what severance costs

The critique's sharpest finding, and it inverts an argument this document makes. Division
was justified as the mechanism that stops weakest-link forcing a member to overclaim or
stay silent. The abuse is the same mechanism: **dividing is a cheaper way to shed a
finding that cuts against you than severing it**, and a published child currently
discloses neither its parent nor its siblings. Invariant 7 — a finding that cuts against
the case is surfaced as prominently as one that supports it — is defeated by a
housekeeping operation.

Decided: division carries severance's friction and then some. It requires an authored
reason; the divided parent RECORDS where every leg went, including legs that cut against;
and **a published child names its parent and its siblings.** A reader who can see one half
of a divided inquiry can see that the other half exists. Without that, division is a
laundering path with a tidy name.

## Open questions this pass must answer

1. Do `focus` / `project` / `action` / `case file` survive, evolve, or get replaced?
   Bob is explicitly open on this and it is the first question.
2. Is a case ONE object with audience renderings, or several? (Observation 3 argues
   one, and names the falsifiable test.)
3. How does a claim state what it rests on and what would falsify it?
4. How is a case's strength derived, and does the weakest-link rule hold?
5. How do contradicting findings live inside one case? (D-80 rules contradiction is a
   thing to FIND rather than prevent — so a case must be able to hold tension without
   resolving it.)
6. What closes the loop from action to consequence, and how does a consequence become
   evidence about the system's own responsiveness?
7. ~~Is the government-administrator archetype in scope?~~ **ANSWERED 2026-08-01: yes,
   and the question was malformed.** All stakeholders are assumed to want better
   outcomes; archetypes differ in what they DO with a case, not in whose side they are
   on. What remains open is narrower and real: an administrator's instance holds the
   body's own material, so what does the two-bucket fence protect there, and from whom?
8. What does the ladder look like once case-making is at the top rather than appended?
