# BIO Intake Doctrine

**Status** · (DEC-141, 2026-10-06: a set-aside a question waits on, its screens) How material enters the record: admission requires provenance never relevance; the intake contract; capture grades; member-original records; independent verifiability; the distribution container; standing intent (named requests and ratified sweeps); release from hold and redaction; naming and criticality; the escalation ladder; the ratification and disposition patterns; creation authority. "Working Document, v1.1, July 2026", "Ratified July 18, 2026 on the operator's word, from draft 0.7", v1.1 minted July 20 — and it carries a v1.2 revision note of July 27, so the content is at v1.2 under a v1.1 header. Partially complete by design: "Sections accrete as the work forces each decision; a section absent here is a decision not yet forced", with §10 open and a named list of sections not yet forced. The caveat: its actor model names a daemon that ran on the retired substrate and is gone; the rules stand, the actor is now the plane's scheduler. **§8 GAINED A STORE-SIDE RULING ON 2026-09-22 (BOB #26, D-179): one capture, one home — the original's; a second registration of held bytes is refused by name — BUILT 2026-09-23 (D-179: `op=promote` refuses it before any write, CAPTURE_HELD_BY_ANOTHER_BUNDLE, C-53.13); the census of what a pre-fence move left behind is BUILT 2026-09-24 (REC-190: `op=homecensus`, read-only, the first holder stated undetermined).** **§2a ADDED 2026-09-24 (BOB #33): the doorbell, `op=knock`, the one route by which anyone, without an account, hands the group material; it folds BOB #32's ruling of that day that a published limit is a BOUND (D-496).** **AND §8 GAINED THE OTHER HALF OF THE REGISTER'S JOB ON 2026-09-24 (D-476): what a capture may CLAIM about bytes the record already holds. `op=acquire`'s `existed` answered a flat `false` for every MULTI-PART capture -- the claim THESE BYTES ARE NEW, on a question never asked, made on every re-fetch of a parted document the record holds. It now asks the REGISTER by the whole `capture_sha` and answers `true`, or `null` with its stated reason; never that false.** **AND §8 NOW SAYS WHAT THE REGISTER AUDIT MAY CALL A CAPTURE HELD IN PARTS (BOB #33, 2026-09-24 21:17Z; BUILT by D-533): "held in parts, all present" is sound when every named part is present and its digest verified; a missing part is named; an unresolvable row is UNDETERMINED, counted outside `sound`.** **AND THE SAME QUESTION FOR `op=attest` AND THE RATIFY GATE, BUILT 2026-09-24 (D-530): a capture held in parts is never called absent by its whole hash. Attest attests on the plane's own acquisition receipt, refuses CAPTURE_HELD_IN_PARTS (C-89.1) on the register alone, and the gate names a whole-hash row held in parts PLANE_HELD_IN_PARTS.** **AND A WHOLE-HASH ROW HELD IN PARTS NOW RATIFIES AND PUBLISHES (BOB #34, 2026-09-25 00:00Z; BUILT by D-556): the gate admits it when every part the record names is present and verifies, and refuses it by name otherwise (PLANE_PART_MISSING, PLANE_PART_UNVERIFIED); publication copies it part by part and re-verifies each digest at the destination. PLANE_HELD_IN_PARTS stays only for a row whose parts the record does not name.** **§2a GAINED DEC-78 (Bob, 2026-09-29): a knock has an unnamed source, named by its receipt; pulling admits it without vouching; a knocker may prove continuity by a secret.** **§3 GAINED DEC-81 (Bob, 2026-09-29): a co-attested Grade B is sufficient to publish; Grade A stays the ceiling (a ceiling, not a minimum: the venue sets the standard; `BIO_Action_v0_1.md` §4 rule 13) and is being researched.** **§1a GAINED the two product rules on personal facts (Bob, 2026-10-05: K1455, K1485, K1493).** as of 2026-10-01.

**Place in the system** · Owns construct 2 of `BIO_System_Design.md` §3 (intake, capture and provenance) and half of construct 10 (standing intent): "the State Rules specification governs bundle shape; this doctrine governs admission to the store." `BIO_State_Rules_Consistency_v1_5.md` realises it as the intake provenance register, I-18's ratification fence and drafted I-19; `BIO_Membership_Architecture_v2.md` §1 borrows its who-issued/how-captured split; the plane's C-18 rules and the sweep floor cite it.

**Incomplete sections** ·
- §header — says v1.1 while carrying the v1.2 revision note of July 27, 2026.
- §1 and §5 — "draft position".
- §1a — the incident procedure is "drafted if ever forced"; the chooses-not-to-hold case is "still deferred".
- §2 — landing "through the pending queue" is the retired substrate.
- §2a — how a member moves a knock into the record is RULED (DEC-78, Bob, 2026-09-29: pulling admits at `collected`, the source is an unnamed knocker with its receipt, the puller is the capturing actor, and a knocker may prove continuity by a secret) and NOT BUILT; the note travels with the capture, the contact stays in the inbox); and `RATE_IP` / `RATE_GLOBAL` have no member-facing translation yet (D-508).
- §3 — the checker advisory is pending; DEC-39's attest-fence wording, which this section is said to take, is not referenced here.
- §3c — bag ingestion "built when the first bag is produced or consumed".
- §4 and §4a — daemon-centred; the retention posture "deferred until forced"; "today the client authenticates the group, not the person" predates Membership v2 §6.
- §6 and §9 — the daemon rung and the endpoint version are the retired runtime.
- §8 — the collected-to-retired edge is "deliberately left unforced"; and a digest-level duplicate across bundles (the same content in different bytes) is not reached by the one-home refusal, which asks the bytes (D-179's scope, not rowed), nor by the census; and REPAIR of a home the census finds displaced is not designed and not rowed (BOB #31, 2026-09-23: the census's report stands alone); and whether the store holds the bytes of a PARTED capture that was acquired and never promoted is undetermined BY CONSTRUCTION -- no whole-document key exists anywhere for it -- so `op=acquire` states that rather than answering it (D-476, 2026-09-24); and the parted-capture audit (D-533) and the ratify gate (D-556) verify each PART's digest but not that the parts reassemble to the whole's (C-18.6's check; streaming the parts to verify the whole is not designed, D-530, 2026-09-24); and a whole-hash row whose parts the record does not name (no `parts` in the bundle's data/provenance.json) can be neither verified nor published, and is refused PLANE_HELD_IN_PARTS; and the gate's three plane findings for a parted row have no catalogue row or member translation, as no PLANE_ finding has (D-556, 2026-09-25).
- §10 — "open, with decision criteria … Decided at first sweep ratification".
- §Sections not yet forced — member intake, received work products, extraction standards, the acquisition second draft.

**Contents**
- [0. Status and ratification](#0-status-and-ratification)
- [Revision history](#revision-history)
- [Revision history (drafts 0.1 through 0.7)](#revision-history-drafts-01-through-07)
- [1. What the store admits (D1, draft position)](#1-what-the-store-admits-d1-draft-position)
- [1a. Admission requires provenance, never relevance](#1a-admission-requires-provenance-never-relevance)
- [2. The intake contract (D2)](#2-the-intake-contract-d2)
- [2a. The doorbell: material from anyone (added 2026-09-24)](#2a-the-doorbell-material-from-anyone-added-2026-09-24)
- [3. Capture grades (D3)](#3-capture-grades-d3)
- [3a. Member-original records (added draft 0.3)](#3a-member-original-records-added-draft-03)
- [3b. Independent verifiability (added draft 0.4)](#3b-independent-verifiability-added-draft-04)
- [3c. The distribution container (added draft 0.5)](#3c-the-distribution-container-added-draft-05)
- [4. Standing intent: named requests and ratified sweeps (D5, first half)](#4-standing-intent-named-requests-and-ratified-sweeps-d5-first-half)
- [4a. Release from hold, and redaction (added draft 0.5)](#4a-release-from-hold-and-redaction-added-draft-05)
- [5. Naming and criticality (D4, draft position)](#5-naming-and-criticality-d4-draft-position)
- [6. The escalation ladder and blanket direction (added v1.1)](#6-the-escalation-ladder-and-blanket-direction-added-v11)
- [7. The ratification pattern as practiced (added v1.1)](#7-the-ratification-pattern-as-practiced-added-v11)
- [8. The disposition pattern (added v1.1)](#8-the-disposition-pattern-added-v11)
- [9. Creation authority boundaries (added v1.1)](#9-creation-authority-boundaries-added-v11)
- [10. Staging versus expunge (added v1.1; open, with decision criteria)](#10-staging-versus-expunge-added-v11-open-with-decision-criteria)
- [Sections not yet forced](#sections-not-yet-forced)
  - [Cross-reference: declared bias (July 27, 2026)](#cross-reference-declared-bias-july-27-2026)

---

Believe in Oakland

**Intake Doctrine**

Working Document, v1.1, July 2026

# 0. Status and ratification

> **Editorial note, July 27, 2026 (Bob's directive):** the construct formerly
> named **Problem** is renamed **Focus** throughout, which conveys its purpose
> non-judgmentally. Machine literals shown here use the target vocabulary
> (`focus`, `focus@1`, `focuses/`, `focus.md`); the legacy literals (`problem`,
> `problem@1`, `problems/`, `problem.md`) remain valid aliases in existing
> append-only history and in code until the rename arc lands.

Ratified July 18, 2026 on the operator's word, from draft 0.7 at
bio-bundle rev 0.1.40, per decision-q1-intake-doctrine-home.md: a
standalone governing document, versioned independently on its own
editorial cadence, joining the document set beside the State Rules
specification, the Bundle Skill Composite Design, and the Technical
Architecture Decisions. Authority ordering: the State Rules
specification governs bundle shape; this doctrine governs admission to
the store; the Design document governs write protocol. The M2'
acquisition skills and the authoring-check family name this document as
their governing standard, and it is written to be readable by a
collaborating journalist without the component taxonomies. Sections
accrete as the work forces each decision; a section absent here is a
decision not yet forced. The tree conforming to v1.0 is recorded in
VERSIONS.json's governing-document block from bio-bundle rev 0.1.41.
v1.1 was minted July 20, 2026 at bio-bundle rev 0.1.48 in the
documentation-first pass ordered by the operator, folding the practices
and rulings of the July 19 production sessions; its revision note
follows the v1.0 record below.

# Revision history

**Revision note, October 6, 2026.** One ruling of Bob's (K1852), Section 3:
a file inside a captured archive is part of it and carries its grade and
co-attestation unchanged when cut out unambiguously; otherwise it is not
filed; archives open automatically within limits; a file's later direct
capture may earn more, beside the first.

**Revision note (v1.2), July 27, 2026.** One operator ruling, Section 4:
what verification asserts (appears-to-be-what-it-claims, never accuracy),
and batch ratification legitimized by volume plus homogeneity of the
collection rather than by origin, with per-document transitions retained,
the acknowledgement recorded in the release record, and
crucial-criticality material excluded from batch release because F4's
co-attestation verification is per-document work. The former reading that
sweep origin alone forces per-document release is superseded: the
mechanical rule (C-18.1) was always that every release transition is
member-authored per document, and batch release satisfies it.

**Revision note (v1.1), July 20, 2026, bio-bundle rev 0.1.48.** Five
additions from production practice and operator rulings, no existing
section's meaning changed. (a) New Section 6 states the escalation
ladder as principle in the operator's formulation and defines blanket
direction, reconciling the practiced ladder with Section 4's
discovery-ratification clause (the D18 reconciliation). (b) New Section
7 records the ratification pattern as practiced through nine production
releases under I-18. (c) New Section 8 records the disposition pattern
from the July 19 cleanup: honest holds, ring-once duplicate folding,
monitoring disabled on dispositioned bundles. (d) New Section 9 states
creation authority boundaries across the three actor classes, made
concrete by the admission of creation-by-packaging. (e) New Section 10
carries the staging-versus-expunge question explicitly with its decision
criteria, to be decided at first sweep ratification. Companion note:
I-18 and I-20 enter the ratified State Rules v1.5 with their checks;
I-19 expunge remains drafted there pending its operation and check
family.

# Revision history (drafts 0.1 through 0.7)

Draft 0.7, July 18, 2026, rev 0.1.40. Draft 0.7 folds the adversarial
review's immediate amendments (phase2-adversarial-review.md, disposed
per adversarial-review-disposition.md): the expunge reconciliation of
the may-not-hold rail with the append-only history law and the off-store
posture for restricted-held originals (Sections 1a, 4a); the interim
release-log review control and the detached-signature target mechanism
for authenticated release (4a); the co-attestation verification
requirement at ratification (3); origin allowlists, https-only public
hosts, fetch caps, the collected-backlog ceiling, and the bounded
gathering-request grammar (4); and bag ingestion hygiene with publisher
signatures (3c). Draft 0.6 refines the may-not-hold rail with the
operator's discovery framing: the group cannot know what it holds until
it examines it, examination is the identification process, good-faith
receipt and examination are not the offense and knowing retention after
discovery is; the rail is discovery-then-action by an authorized member,
never pre-screening perfection, with lawful-but-confidential discoveries
routing to redaction. Draft 0.5 folded the operator's fourth review
round: the may-not-hold rail (contraband met with refusal and purge,
never fencing, distinct from the deferred chooses-not-to-hold editorial
section); release authority (the collected-to-verified transition is a
named member's decision, AI-assisted but member-made, gate-checkable,
staged named-now authenticated-later); redaction practices (derived
artifact, remove not mask, logged by class and reason, member-executed);
and the distribution container (Section 3c, the single-step zip
principle: BagIt RFC 8493 in ZIP form, whole-bag verification by one
standard tool or stock sha256sum). Draft 0.4 added the
independent-verifiability rule (Section 3b, the epistemic twin of R12:
the tool never gates verification; every trust primitive must have a
standard non-BIO verification path) and the positive form of the fetch
rule (policy-governed, never caller-governed; breadth is compatible with
accountability when the breadth is the ratified policy). Draft 0.3
folded the operator's second review round: standing intent in two forms
(named request and ratified sweep) with the ratification fence at
collected, the corrected rationale for excluding caller-directed fetch
(identity, auditability, editorial choice; not store integrity), the
pausable daemon with the due-slate manual path, mechanical
co-attestation as the Grade B trust-raiser, member-original records on
the custody chain, and corroboration as a first-class provenance
concept. Draft 0.2 folded two operator rulings from review: the two-axis
provenance principle (Section 3 preamble) and
admission-requires-provenance-never-relevance (Section 1a). Standalone
governing document per decision-q1-intake-doctrine-home.md; leaves this
tree at ratification. Authority ordering: the State Rules spec governs
bundle shape; this doctrine governs admission to the store; the Design
doc governs write protocol. Sections accrete as the M1'-M3' work forces
each decision; a section absent here is a decision not yet forced.

# 1. What the store admits (D1, draft position)

The unit of admission is the evidentiary series, not the source
document. One Information bundle carries one line of evidence (the Sewer
Service Fund transfer series), and the documents that attest it (an
auditor report, fund statements, a budget) live inside that bundle as
captures with per-document provenance. A document attesting two
independent lines of evidence is captured in each; storage is cheap and
cross-bundle capture references are a coupling the cascade would have to
walk. Rationale: consumers of the store reason about evidence, and the
reference graph (cites edges) should carry evidentiary dependency, not
file management. Revisit if a document class emerges whose whole content
is the evidence (a leaked memo, a court order); the draft position is
that such a document is itself a series of one.

# 1a. Admission requires provenance, never relevance

The store may hold any information carrying honest provenance. Relevance
to a stated need is not an admission criterion: information that
satisfies no gathering request and no live investigation is still
information with a provenance, admissible through any gated write path,
and its cost is attention (managed by criticality marking and the
navigation surfaces), not legality. The gathering-request mechanism of
Section 4 constrains what the daemon may autonomously fetch; it
constrains nothing about what the store may contain, with one exception
that is law, not doctrine. **What the group may not hold (added draft
0.5; refined draft 0.6):** material unlawful to possess is the one class
the ratification fence cannot manage as a holding state, because the
harm is the knowing holding. The epistemics run in one direction: the
group cannot know what it holds until it examines it, examination is the
identification process, and good-faith receipt and the act of examining
are not the offense; knowing retention after discovery is. So the rail's
shape is discovery-then-action, not pre-screening perfection: intake
proceeds in good faith under the fence; examination for release is the
sanctioned process by which material identifies itself as appropriate or
not; and upon discovery of unlawful material, an authorized member takes
prompt recorded action, destruction and any legally required reporting,
never silent retention. Discovery of lawful-but-confidential material
routes to the redaction process of Section 4a under the same authority.
Sweep definitions carry source-class and media-type constraints that
make exposure unlikely by construction; the full incident procedure is
drafted if ever forced. **Reconciliation with the append-only law (added
draft 0.7, per the adversarial review's F1).** Discovered material
reaches live state through promotion, which writes immutable history
snapshots under the append-only law, so destruction needs a sanctioned
mechanism or the rail is prose. Expunge is that mechanism and the one
exception to append-only history: the content is removed from live state
and from history and replaced by a tombstone recording the fact, date,
deciding authority, and reason class of the removal, never the content,
so the audit trail stays honest while the material does not persist.
Expunge is a named-member act under the same authority as release and
redaction; it enters State Rules v1.5 as its own invariant (drafted
there) and lands with its executable check when the operation is built,
per the Mechanical Verification Law. Whether sweep intake should
additionally stage before first promotion, so most discoveries happen
before any history snapshot exists, is weighed at the M2' build against
the fence's virtue that collected material is visible and durable;
staging as the front line and expunge for late discoveries may both be
right, and the decision is forced there, not here. Distinct from all of
that, and still deferred until forced: what the group CHOOSES not to
hold as editorial restraint (personal information about private
individuals being the anticipated class), which is an editorial policy
the group owns, not a schema rule. Two rules are product rules, not
editorial: no import bulk-copies home addresses or phone numbers (K1485),
and addresses and phone numbers are never published (K1493); otherwise
any personal fact a cited document states may be held (K1455).

# 2. The intake contract (D2)

Every submission, daemon or member, carries:

-   **The capture.** The document bytes as obtained, named by grade
    > (Section 3).

-   **Provenance, per document:** locator (the authoritative source
    > address, or "in hand" with chain-of-custody notes for member
    > submissions of unpublished material); authority (who issued the
    > document, free text in draft 0.1, controlled vocabulary revisited
    > when the corpus justifies one); retrieved (ISO-8601 UTC instant of
    > capture); capture method (which actor, which surface, which
    > grade); and the capturing actor's class (daemon, session, member).

-   **Classification and criticality** per the State Rules Information
    > schema: fact, analysis, or judgment; crucial or supporting. A
    > received work product from another group is analysis by rule,
    > never fact, per the no-transitive-trust storage form.

-   **The normalized dataset with its content hash,** where the document
    > yields structured content. The hash is over the normalized
    > dataset, never the raw capture (State Rules 4.1); a document with
    > no structured content hashes its canonical text extraction.

How it lands: as a gated Information bundle through the pending queue,
promotion consuming it. No intake path writes live state; the daemon and
the member are writers like every writer.

# 2a. The doorbell: material from anyone (added 2026-09-24)

The doorbell is the one route into an instance that needs no account, no token and no session: anyone may hand the group material. It
exists because a group whose purpose is accountability must be reachable by people who will not, or cannot, join it. It is the route
Membership v2 §1.2 sets against hand-carried material: what comes through it has an UNNAMED source, and the record says so rather than
supplying a name. **Corrected in place 2026-09-29 (DEC-78, Bob):** this said the doorbell's material has *NO attributed source*; a
whistleblower is still a source, so the record names the source as an unnamed knocker identified by the knock's receipt, never as none.

**What arrives is material, never an act.** A knock (`POST op=knock`, content as `contentB64` or `contentText`, with an optional `note` of
up to 2,000 characters and `contact` of up to 300) writes one row in the instance's doorbell inbox and, with evidence storage configured,
one object under `bio/inbox/<sha256>` in the working bucket, and changes nothing else. Its worst case is by construction a full inbox. The
bytes are held with their SHA-256 and byte count, the time received, and status `new`. The size cap is 8 MiB with evidence storage and
64 KiB without it (stored inline, and the refusal says large material needs evidence storage). An empty knock, a missing body, bad base64
and an oversized one are each refused by name. A store that does not answer is reported as silence, never as a rate refusal (REC-52): a
429 tells a member of the public they knocked too often, which is a claim that needs a count behind it.

**It does not enter the record by knocking.** Nothing leaves the doorbell inbox except to a signed-in member (`op=inbox`, `op=inboxget`),
who resolves each knock as `pulled`, `discarded` or back to `new`, recorded with when and by whom (`op=inboxresolve`). A knock is not a
capture and not a bundle; the §2 contract and the §1a admission rule apply when a member brings its material in, not before. This inbox
is not the task inbox of `docs/development/INBOX-GRAMMAR.md`, which holds work items for members; they share the word and nothing else.

**Pulling a knock, and who the record names (Bob, 2026-09-29, DEC-78).** Pulling ADMITS the knock's material to the record as a capture at
`collected` and commits the member to nothing more; vouching for it stays with release, a separate and weightier act. The capture names
TWO parties and never merges them. Its SOURCE is the knocker, unnamed: *received through the doorbell from an unnamed knocker*, with the
knock's receipt (its `KNOCK-…` id, digest, byte count and time received), so the record never calls the material unattributed or its
source unknown. Its CAPTURING ACTOR is the member who pulled it, by handle. Hand-carried material follows the same rule: its source is the
person who handed it over, named or unnamed as they chose, with when and how it was received as chain-of-custody notes, and the member who
brought it in is the capturing actor; the member is never recorded as the source of what someone else gave them (Membership v2 §1.2).
**A knocker may prove continuity.** A knocker who wants several knocks known as one source's gives the same knocker secret with each; the
record shows a pseudonym derived from it and states continuity as *the same knocker secret was presented*, which proves possession of the
secret and never identity. The secret is optional (a knocker may knock unlinked, or use a fresh one each time); it is held only as a keyed
digest under an instance key (as the rate fingerprint is), so neither a row nor a leak reveals it and the same secret used at two groups
does not link them; and the doorbell can generate a strong one and show it once on the receipt, since a guessable or reused identifier would
let someone else continue the pseudonym. The mechanism is BOB's; the rule is Bob's.
**The note travels; the contact does not (DEC-78).** The knock's `note` travels with the capture as the knocker's own words, labelled as
the knocker's and never as evidence of its truth. The `contact` stays in the doorbell inbox, readable by members and never in the record
or any publication, so a whistleblower's way of being reached cannot be published by accident.

**A source's identity evolves (Bob, 2026-09-29, DEC-78 item 5).** An unknown source may become a publicly known one: by revealing
themself to the group or in public, by parts of their identity (an occupation, say) appearing in a whistleblower filing, or by being found
and exposed by those hostile to their evidence. The record holds a source's identity as a HISTORY of disclosures, each dated and
attributed, never as one field overwritten, and each capture keeps its source as it stood when the material was received. Five rules
govern it (Bob, 2026-09-29): the group is never the FIRST to make a source more public (an identity detail is published only with the
source's consent to that audience, or where it is already public elsewhere, cited); a hostile exposure is recorded as the EXPOSER'S claim
and the group does not confirm it without the source's consent, since confirming is itself a disclosure; *known to the group, not
recorded* is a first-class state, and a recorded identity is seen only by named members with every read logged; consent to go public is
asked at the moment of publishing and stated as permanent, and withdrawing it binds only future publications; and a source's firmer
identity reaches the findings resting on their material as a re-evaluation notice, never a silent regrade.

**The limit is a BOUND (BOB #32, 2026-09-24, D-496).** A limit the instance publishes is one it holds, not the name of a bucket. The limits
are 12 knocks per source (a fingerprint of the connecting address, never the address) and 300 per instance, in any 10 minutes, counted in
the same transaction as the write so a race cannot slip past them. The count is a two-bucket weighted sliding window,
`est = prev × (1 − elapsed/W) + cur`, refused at `est ≥ limit`. The fixed bucket it replaced let a caller send the limit just before a
bucket edge and again just after it: twice the published number in less than one window, with the code doing exactly what it said. The
estimate is approximate in both directions, because it assumes the previous bucket's knocks were spread evenly. So the instance publishes
the bound together with its method, built from the same constants so the words and numbers cannot drift: *"at most 12 knocks from one
source in any 10 minutes, estimated by a sliding window"*, and the instance-wide 300 likewise. The sentence is returned as `stated` on
the 429, at the one moment a caller is held to it. If the word "estimated" is ever dropped, the limiter must become exact in the same
change.

**The doorbell as an inbox, its limits, its gatekeeper and its discard archive (Bob, 2026-10-01, DEC-108).** The doorbell's inbox
reads like an email inbox: knocks not yet handled are highlighted, and handled ones (pulled or discarded) stay visible. Members can
sort the list by time, by status, by whether the knocker presented a knocker secret, by the project affected, and so on. **The limits
are lowered** to at most 5 knocks from one source and 10 in total in any 10 minutes (replacing 12 and 300 above; the bound, its
estimate and its published sentence work as described). A would-be knocker is made aware whenever a limit is in effect, so nobody
believes they knocked when they did not. A group may enable a **gatekeeper** that identifies and dismisses obvious spam and
denial-of-service submissions, labelled as machine work. Discarded knocks, whether dismissed by the gatekeeper or by a member, go to a
**discard archive** in case a gem is buried in the flood, and the archive is cleared automatically on a tight schedule (Bob suggested
one week after receipt). The system keeps a **count-only tally** of knocks it turned away (a daily total for the whole doorbell, how
often the whole-doorbell limit was reached, and when last; never addresses, fingerprints, individual times or content), shown to members
as status on the inbox page and never as a notification, so the refusal's sentence can say truthfully that the group sees how often its
doorbell turns people away.

# 3. Capture grades (D3)

Provenance has two orthogonal axes, both recorded per document, neither
a quality score on the information itself. The source axis: who issued
the document and with what authority. The capture-chain axis: how
faithfully and verifiably the group obtained its copy. The grade lives
entirely on the capture-chain axis; it grades the copy's verifiability,
never the source's credibility and never the information's worth. A
Grade B capture of an auditor's report is strong source on a moderate
chain; a Grade A capture of a blog post is weak source on an airtight
chain; neither axis substitutes for the other. Grades are named honestly
because a claim about evidence is only as strong as its weakest named
layer:

-   **Grade A, evidentiary raw capture.** WACZ web-archive or equivalent
    > chain-of-custody capture of the source as served; the ceiling for
    > adversarial or legal use (a ceiling, not a minimum: the venue sets the
    > standard of evidence, and no action is refused for its grade;
    > `BIO_Action_v0_1.md` §4 rule 13, Bob 2026-09-30); produced by a network-capable agentic
    > session or the M2' fetch layer where the source permits. No route
    > builds one yet; the credible options are documented in
    > `docs/development/GRADE-A-CAPTURE.md` and DEFERRED (DEC-81 item 4).
    > **Corrected in place 2026-09-29 (DEC-81, Bob):** this said Grade A
    > was *required before external distribution of any work product
    > resting on the document*; no requirement enforced it and no route
    > can produce A, so a CO-ATTESTED Grade B is now sufficient to publish
    > (see Grade B).

-   **Grade B, fetched content.** The document bytes as fetched by a
    > capable surface, hashed at receipt, with locator and instant. What
    > the chat surface and the mechanical fetch layer produce.
    > Sufficient for internal work and for verified state; the gap to
    > Grade A is recorded in Provenance Notes, never papered over.
    > **A CO-ATTESTED Grade B (a trusted timestamp over its digest and a
    > third-party co-archive of its locator, below) is sufficient to
    > publish a work product resting on the document (DEC-81, Bob,
    > 2026-09-29); the published case discloses each document's capture
    > grade and whether it is co-attested.** A load-bearing Grade B whose
    > co-attestation failed may still be published: the ceremony's
    > pre-flight retries (a timestamp now proves existence by now; a fresh
    > co-archive whose bytes match corroborates), and if it is still
    > missing the owner proceeds only by an attributed acknowledgement with
    > a reason; the case marks the document "self-attested only", and the
    > capturing member may add a signed account of the capture. It is never
    > refused outright (DEC-81 item 3).

-   **Grade C, reference only.** A locator and citation without archived
    > bytes. Admissible only for sources that cannot be captured (a
    > physical record, a paywalled corpus the group may cite but not
    > archive), with the reason recorded. A Grade C source cannot back a
    > load-bearing claim in an externally distributed work product.

**Archive replays (Bob, 2026-11-07; BD-18).** A web archive fetched the
document from its publisher and held it before serving it to the group. A
replay of the archive's RAW bytes, meaning the publisher's response exactly
as the archive fetched it (for the Wayback Machine, its unmodified mode), is
therefore a Grade B capture, labelled "via archive". It records the snapshot
date as its fetch date and names the archive as custodian. DEC-81 applies as
to any Grade B: the archive cannot co-attest its own copy, so co-attestation
comes from a second archive or a trusted timestamp, and otherwise from the
owner's attributed acknowledgement, with the case marking the document
"self-attested only". A rewritten replay (the archive's toolbar, altered
links) is not the publisher's document. Where the raw bytes are not
available, it is Grade C, reference only.

An Information bundle's verified state requires Grade B or better on
every attesting document. Grade upgrades (B to A) are accretive adds:
the new capture lands beside the old, never replacing it.

**Raising a grade mechanically (added draft 0.3).** A self-recorded hash
proves integrity since capture, not origin: it is the group's
attestation of what the source served. Two cheap, automatable
co-attestations raise a Grade B capture toward evidentiary weight and
are REQUIRED of the M2' fetch layer wherever the source permits: (1) a
co-archive request (Internet Archive or equivalent) of the same locator
at capture time, creating an independent third-party timestamped record
the group does not control, with the archive locator recorded in
provenance; (2) a trusted timestamp over the capture hash, proving the
capture existed at the claimed instant. The full replayable transaction
capture (Grade A) remains the ceiling (not a minimum; the venue sets the standard, `BIO_Action_v0_1.md` §4 rule 13) for adversarially distributed work
products; co-attested Grade B is the working floor for verified state on
contested claims.

**Verification at ratification (added draft 0.7, per F4).**
Co-attestation earns its weight only if someone checks it. An attacker
holding a write token can fabricate plausible provenance fields, but
cannot backdate a third-party archive snapshot or forge a timestamp
token against its issuing authority; the countermeasure the design
already contains works only when enforced at review. Ratifying
crucial-criticality or contested material therefore requires the
reviewing member to verify the recorded co-attestations (visit the
co-archive locator, verify the timestamp token against its authority)
before releasing, and the review surface presents the source material
itself, never only an AI summary, so ratification is never a rubber
stamp on a possibly steered account. A genuine capture failure is
recorded honestly as attempted and unavailable, and material carrying it
inherits a lower ceiling for external distribution rather than a papered
gap. The checker surfaces crucial material lacking verifiable
co-attestation as an advisory finding when the M2' machinery lands.

**Members of a captured archive (Bob, 2026-10-06; K1852).** A file inside a
captured archive (a ZIP) is part of that archive, not derived from it. When
it can be cut out unambiguously (its size and checksum agree with the
archive's own index, and the index and the file's header agree), it is filed
as a capture of its own under its own digest, and it carries the archive's
capture grade and co-attestation unchanged: never stronger, never weaker.
Anyone can repeat the cut with stock tools and confirm the digest, so
Section 3b holds. A file that cannot be cut out unambiguously (corrupt,
ambiguous, encrypted, or over a published limit) is not filed at all, and
the reason is named; it is never filed at a lower letter. Archives are
opened automatically on capture, within published limits, and their files
are held for review beside the archive under Section 4's release rules. A
file may later earn a higher grade only by its own capture through another
route, landed beside the first by the accretive rule; nothing is regraded.

# 3a. Member-original records (added draft 0.3)

Records a member creates or obtains in person (an audio recording of a
public meeting, notes taken in the room, a printed agenda in hand) are
original evidence, not captures of published documents; their
capture-chain axis is chain of custody: who made or obtained the record,
when, with what device or in what setting, hashed at intake with the
member's attestation recorded. On the two axes:

-   **A recording of the event** is primary evidence: the source is the
    > event itself. Weight rises with corroboration (the official
    > recording or minutes, a second attendee's record, device
    > metadata). Open public meetings are recordable by right (Cal.
    > Gov. Code 54953.5); material from private contexts waits on the
    > deferred what-we-choose-not-to-hold section.

-   **A document obtained in hand** (the agenda) carries the issuing
    > body's authority with locator "in hand"; it cross-checks against
    > any posted copy, which is co-attestation.

-   **Notes** are a witness account: the member's perception, honestly
    > classified as such, admissible with full provenance, carrying
    > testimonial weight; alone they back a claim cautiously, and
    > corroborated they harden.

All three are evidence at different weights, and weight is the same
everywhere in this doctrine: source authority, times chain integrity,
times corroboration.

**Corroboration as provenance (added draft 0.3).** Corroboration is a
first-class provenance concept: an edge between independent records
attesting the same fact (two captures from unrelated origins, a
recording and the official minutes, a co-archive and the group's own
fetch). The reference graph carries these edges so evidentiary weight is
readable from the store, not asserted in prose.

# 3b. Independent verifiability (added draft 0.4)

The epistemic twin of R12: as the tool never gates the work, the tool
never gates the verification. Every provenance claim in a distributed
work product must be verifiable with standard, independently available
tools; BIO tooling may make verification convenient, never necessary.
The standards stack, binding on every trust primitive this doctrine or
the M2' machinery adopts:

-   Content hashes are SHA-256, verifiable with stock tooling
    > (sha256sum, openssl) on any machine.

-   Trusted timestamps are RFC 3161 tokens, verifiable with openssl ts
    > against the issuing authority.

-   Web captures at Grade A are WARC (ISO 28500) / WACZ, replayable in
    > independent open-source players the group does not control.

-   Co-archives are third-party public archives (Internet Archive or
    > equivalent) anyone can visit at the recorded locator.

-   Manifests and provenance blocks are documented plain JSON, readable
    > without software.

-   Member-original media adopts C2PA signed-capture provenance as
    > device and tool support permits.

A trust primitive with no non-BIO verification path is not adopted,
whatever its other merits. The outsider's verification story must read,
at every step, "check it yourself with tools you already trust."

# 3c. The distribution container (added draft 0.5)

The single-step rule, the operator's zip principle: the assembled trust
wrapper, not merely each primitive inside it, must be openable and
verifiable in one step by one standard, trusted, independently available
tool. The adopted container is BagIt (RFC 8493) in ordinary ZIP form:
the work product's payload subtree plus a manifest-sha256.txt (hash,
space, path) plus bag metadata. Any BagIt tool verifies the whole bag in
a single step, and the manifest format is simple enough that stock
sha256sum verifies it with no BagIt software at all. Inside the bag,
every layer keeps its own standard form per Section 3b: captures as
WACZ, timestamps as RFC 3161 token files, provenance as documented JSON.
The honest limit, stated so it is never papered over: single-step
verification covers structure and integrity completely (every byte
accounted for and unaltered); verifying an inner layer's semantics (a
timestamp's signature, a capture's replay) uses that layer's own
standard tool, because no off-the-shelf utility spans all semantics and
a BIO tool that did would violate 3b. Depth of verification is the
outsider's choice, and every depth has a non-BIO path.

**Ingesting bags (added draft 0.7, per F7).** A bag verifies integrity,
not authorship. Consuming another group's bag applies standard
extraction hygiene (every path validated against traversal before any
write), and publisher authenticity comes from a detached standard
signature over the bag manifest, the same mechanism as 4a's target
control, verified with off-the-shelf tooling. Recorded now; built when
the first bag is produced or consumed.

# 4. Standing intent: named requests and ratified sweeps (D5, first half)

The daemon fetches only what store state authorizes; no caller ever
directs a fetch by parameter. The rationale is not store integrity (the
queue, the gate, and provenance protect that regardless): it is
identity, since fetches run as the group's infrastructure and the group
must choose what it retrieves under its own name; auditability, since
"why does the group have this?" must always be answerable from store
state; and editorial choice, since what the group declines to hold is
the group's decision, not a caller's. The positive form of the rule
(added draft 0.4): fetching is policy-governed, never caller-governed. A
crawler indexing the whole web answers challenges by pointing at its own
published policy and its compliance with it; breadth is compatible with
accountability exactly when the breadth is the group's ratified policy.
The sweep below is that policy's form here, as wide as the group chooses
to ratify it.

Standing intent takes two forms, both store state, both written through
the gated path by a human:

-   **The named request.** Names a specific document or source: target
    > identity or stable locator, the credible-source constraint (the
    > authoritative publisher first; named mirrors only as recorded
    > fallback), criticality, cadence. Carried in the target bundle's
    > monitoring block plus data/gathering.json.

-   **The ratified sweep.** Names a query, not a document: scope,
    > source-class constraints, cadence, and a breadth budget. Within a
    > sweep's scope the daemon or an AI session may fetch what matches
    > and what it deems relevant nearby, recording the deeming actor and
    > the matched sweep in provenance.

**The ratification fence.** What a named request fetches may enter at
the state its verification earns. What a sweep brings back always lands
at collected, never higher: safely in the store, fully provenanced, and
fenced by the state machine itself. Human ratification is the
collected-to-verified transition, made per-document after intake. What
is ratified up front is the sweep's scope; what is ratified afterward is
each document's standing. AI and broad discovery range wide; verified
stays earned by human decision.

**What verification asserts, and batch ratification (operator ruling,
July 27, 2026).** Verification does not promise that anyone has
confirmed the accuracy of anything stated in a document. It is the
member's reassurance that the document APPEARS to be what it claims to
be: not a spam advertisement, not a phishing artifact, but the kind of
thing it presents itself as. Accuracy and credence are separate
questions the catalog does not yet model. From that definition follows
the batch rule: the factor legitimizing a bulk release is not how the
cache of documents was found but the volume of the collection combined
with little to no variance in the trustworthiness of its contents. A
hundred postings from a public jobs board are one judgment made
honestly once, whatever origin brought them in. Per-document remains
the requirement where the definition demands it: each document in a
batch still receives its own member-authored release transition in its
own record, the member's explicit acknowledgement of the batch's
homogeneity and of their mitigation steps (what they actually sampled
and checked) is recorded as part of the operation, and
crucial-criticality or contested material is NEVER batch-released,
because ratifying it requires verifying its co-attestations (Section 3,
F4), which is inherently per-document work. The security consequence is
named honestly: under batch release, the member's recorded sampling
honesty is the boundary against a poisoned document hiding in a
homogeneous batch, which is why the acknowledgement is a record, not a
dialog. Deferred until forced: the
retention posture for collected material never ratified (an attention
question, per Section 1a, not a legality question).

**The held-captures list (Bob, 2026-10-01, DEC-97).** Captures still
held, collected and not yet released or set aside, are listed per member
and per project, showing only what the viewer may see, sortable by age,
source and project, each row with its age, and nothing about them is
ever notified. A member ticks several (nothing is pre-ticked) and may
release them together as one batch release under the rule above, with
the recorded acknowledgement of homogeneity and what was sampled; set
them aside together with one reason (each stays held with that reason,
never deleted); or link them to a question. "Contested" material, which
is never batch-released, includes a document caught in an unresolved
contradiction; crucial and contested documents are shown as not
eligible, with the reason, before the member acts, so the batch act
never refuses unseen.

**A document set aside while a question waits on it (Bob, 2026-10-06, K1618; the screens RULED 2026-10-06 by the design session, DEC-141).**
A document captured for one member's question and set aside by another is never silent. (1) The held-captures list and the set-aside
act show, beside each held document, the question it was captured for and the member who asked ("for Ana's question “Were the FY2022
transfers authorised?”"); a question the viewer may not see is withheld whole ("Captured for a question you may not see": no title,
no asker, no count). (2) Setting aside a document an open question waits on opens the reason field in place, saying whose question
waits and that the reason will be shown to them; the reason is required and kept on the record (the act stays reasoned). (3) The
asker sees it on the question, never as a notification or queue item (DEC-94): a wait line in DEC-98's form, "Waiting: the 2024
budget PDF was set aside by Ben: “wrong year”", where the question shows its strength; the project's list of questions shows the
same wait mark. (4) Beside the wait, the asker may restore the document with a reason or find another source; every set-aside and
restore stays in the question's history, in order; there is no veto, quorum or count of disagreements.

Member-submitted documents in hand enter under Section 2 directly; their
gathering request is retroactive and optional (a member may plant one so
the daemon watches the source for changes thereafter).

**The manual path.** The daemon is pausable, and its due slate (every
named request and sweep currently due) is exportable as an interactive
prompt a member runs by hand in a chat session, the Alpha Pipeline
runner pattern. The tool never becomes the only way the group's standing
intent gets executed.

**Constraints as security controls (added draft 0.7, per F5 and F6).**
Named-request locators and sweep source-class constraints are explicit
origin allowlists, https-only, public hosts only, which forecloses both
lookalike origins satisfying a loose pattern and SSRF-shaped locators.
The breadth budget is a security control as much as attention hygiene:
per-tick fetch caps, a ceiling on the collected backlog awaiting
ratification (flooding collected until review becomes rubber-stamping is
an attack, not merely clutter), and an anomaly note when a sweep's yield
departs its history are all part of a sweep's ratified definition.
Gathering-request fields carry a bounded grammar the gate checks, so a
request record can never smuggle free text that a rendering surface
would interpolate as instructions; the due-slate exporter renders store
fields as quoted data inside fixed instruction framing; and examining
sessions treat collected material strictly as untrusted data, never as
instructions, a posture stated in the Data Extraction and Monitoring
skill texts that M2' mints.

# 4a. Release from hold, and redaction (added draft 0.5)

**Release authority.** The collected-to-verified transition is a
member's decision: AI may assist the review freely, but the decision is
made by, and recorded as, a named member. The transition's state_history
entry carries a member identity as author, never a surface or AI
identity, and this is mechanically checkable: a release transition
authored by a non-member identity fails the gate (an invariant candidate
that arrives with its check when the release path is built, per the
Mechanical Verification Law). Staged honestly: today the client
authenticates the group, not the person, so the rule lands as
named-member now, authenticated-member when the engagement layer adds
per-member credentials; the doctrine states the full rule and the tree
implements it in that order.

**The interim control (added draft 0.7, per F3).** Until authenticated
release, the author field is a string any write-token holder can set;
the mechanical check verifies form, not identity. The compensating
control is periodic member review of the release log: the members read
the store's verified transitions against their own memory of their acts,
and a release nobody made is an incident. Cheap, human, and honest about
what the check can and cannot see. The target mechanism, built at M3',
is a detached signature over the transition record using standard
tooling (minisign or SSH signatures), verifiable entirely outside BIO
tooling, which is exactly what Section 3b requires of a trust primitive.

**Redaction.** Material lawful to hold may still need redaction before
release. The practices: redaction produces a derived artifact, never an
in-place edit; the unredacted original stays held under restricted
handling or is destroyed by recorded decision. Redaction removes data
rather than masking it. Every redaction is logged by class and reason,
so the released artifact declares what was withheld and why, preserving
the verification story rather than quietly breaking it. AI may flag
redaction candidates during the held period; execution and approval are
member acts under the same named-member rule as release. The redacted
derivative is an ordinary capture-grade artifact with its own hash and a
derivation record in provenance, composing with the accretive model
unchanged.

**Off-store originals (added draft 0.7, per F1).** The store is designed
to mirror, fork, and distribute; it has no restricted tier, and a
restricted copy in a replicating substrate is a fiction. Until a
restricted tier exists, an unredacted original held under restricted
handling lives off-store, operator-held, with its hash and a derivation
record in the store so the redacted derivative's provenance still
verifies against material the store does not carry.

# 5. Naming and criticality (D4, draft position)

Production IDs follow the spec grammar with slugs naming the evidence,
not the document (sewer-transfer-series, not auditor-report-2022).
Crucial marks evidence a live Focus or Project cites as load-bearing;
supporting marks everything else; the checker already enforces nothing
here, and the doctrine deliberately keeps criticality as editorial
judgment recorded, not computed.

# 6. The escalation ladder and blanket direction (added v1.1)

The principle, in the operator's formulation: the workflow does
everything possible and practical so that humans focus on judgment,
assessment, communication, and action. The ladder that implements it has
three rungs, each engaging the next only for what the rung below cannot
do. The daemon executes named standing intent: mechanical capture,
mechanical change detection, mechanical bookkeeping, nothing it composes
and nothing it decides. A session discovers with its own tools: it reads
what the daemon gathered, follows the evidence to sources the standing
intent does not yet name, proposes new gathering requests, and prepares
everything a decision needs. Humans are engaged only for the impossible
or the impractical: acts of authority (ratification, release, elevation,
disposition, distribution), acts of judgment the tools cannot make, and
acts in the world.

**Blanket direction (the D18 reconciliation).** Section 4's rule stands:
discovery of new documents is proposed by sessions and ratified into
standing intent by humans. Production practice showed the ratification
can be given as a blanket: a member may direct a session, within a named
investigation scope, to plant the gathering requests its discovery
warrants, and that direction is itself the ratification for every
request within the scope, given once instead of per request. The blanket
is bounded exactly as a sweep is: it names its scope, it is recorded (in
the session's record and in each planted request's provenance, which
names the directing member), and it never extends to release, which
remains per-document under Section 4a whatever the breadth of the
gathering direction. A blanket direction is standing intent about intake
breadth; it is never standing intent about verification. The July 19
session's Legistar chain was planted under exactly this form and is the
worked example.

# 7. The ratification pattern as practiced (added v1.1)

Nine production releases under I-18 settled the working pattern,
recorded here so it is doctrine rather than habit. The session prepares:
it verifies the capture against archived bytes, extracts the canonical
dataset, computes the hashes, runs the gate locally, and assembles the
release package with the C-2.7 rebase (the dataset's canonical hash
becomes content_hash, the capture hash stays authoritative in the
register, and a change record accompanies the rebase). The member
releases: the collected-to-verified transition is the member's decision
under Section 4a, recorded with the member's name as author. The blurb
states exactly what the capture is and never more: an index-page capture
is released as a capture of an index page, not as a capture of the
documents the page lists, and the July 19 index-page releases are the
worked example. Review of crucial or contested material includes the
Section 3 co-attestation verification, and the review surface presents
the source material itself, never only an AI summary.

# 8. The disposition pattern (added v1.1)

From the July 19 cleanup, the pattern for material that enters the store
and should not proceed toward verified. Honest holds: a bundle held for
a stated reason stays at collected with the reason in Review Notes,
never silently parked and never deleted. Duplicate folding per
ring-once: byte-identical content is corroboration on the original
entry, never a second review item; the duplicate bundle is dispositioned
at collected with a Review Note naming the original, and the
corroboration edge lands on the original's register. Monitoring is
disabled on dispositioned bundles, so the daemon stops spending
attention on material the group has already judged. Everything stays at
collected because the state machine has no collected-to-retired edge;
whether one should exist is deliberately left unforced until the volume
of dispositioned material makes the answer real.

**RULED 2026-09-22 by BOB #26 (D-179, SCHEDULER #11's Q4): at the store, ONE CAPTURE, ONE HOME —
the ORIGINAL's.** The register is keyed by the bytes (`INTERFACES.md` I1 §1: `capture_sha` is the
identity of the bytes across the whole system), and the ring-once rule above lands the
corroboration on the original's register. Bob's ruling of 2026-07-30 says the same of the whole
record (`LINK-FIDELITY.md`, *a re-capture of a document the record already holds is the NORMAL
case*): identical content is corroboration on ONE register entry and never two, and a
confirmation is an OBSERVATION in `captured_locators`, never a bundle. The store did the
opposite: `op=promote` UPSERTs `register.bundle_id` on the `capture_sha` key, so registering held
bytes under a second bundle silently MOVED the row to the newcomer, and only an authored
observation was fenced (C-53.8). A compound key `(capture_sha, bundle_id)` is refused: it would
make one content two review items, and the version chain at an address (PL-10) and every read
that asks which bundle holds a capture rest on the one home. So a promote that would register
bytes already registered under ANOTHER bundle that still exists is REFUSED BY NAME, and the
refusal tells the member the document is already in the record, naming the holding bundle only
to a caller who may see it (D-15); the new address's observation, which `op=acquire` records
before any promote, is the corroboration. A re-registration under the SAME bundle (a revision)
is unchanged, and bytes whose home was purged register afresh. BUILT 2026-09-23 by D-179: `op=promote`
refuses it before any write (`#testimonyFence > is-register-home`, CAPTURE_HELD_BY_ANOTHER_BUNDLE, C-53.13),
driven through the op by `bio-plane/test/d179onehome.test.mjs`, which reads the first bundle's register row
back from the store and finds it byte-identical after the refusal.

**THE CENSUS OF WHAT THE FENCE CAME TOO LATE FOR — RULED 2026-09-23 22:03Z by BOB #31, BUILT 2026-09-24 by REC-190.**
The fence stops a NEW move; a store written before it may already hold one, and no read said so. `op=homecensus`
(admin and probe, read-only) lists every `files` or `history` row whose sha the register assigns to a DIFFERENT
bundle that still exists, grouped by the sha, naming the register's current holder as `home` and every other
bundle carrying the bytes as `held_by`. Only the register decides a home: a sha several bundles carry that the
register assigns to none of them (an identical ordinary file) is not listed, and a register row whose bundle is
gone names no home and is counted apart. Per the ruling, **the census's report stands alone**: it repairs nothing,
and **which bundle held the capture first is UNDETERMINED** — the register keeps one holder and no prior one — so
the answer says so (`first_holder: "UNDETERMINED"`) rather than guessing; nor can it tell a moved row from bytes
a bundle carried without ever registering them. The digest-level duplicate stays out of reach. Driven through the
op by `bio-plane/test/homecensus.test.mjs`, with the pre-fence move seeded at the store (IC-251).

**AND THE CENSUS'S OWN GAP WAS RULED 2026-09-24 by BOB #32, ONE DAY AFTER BOB #31 ORDERED THE CENSUS AND ON
THE SAME TREE THAT BUILT IT — the paragraph above says what `op=homecensus` REPORTS, this one says what may ever
be DONE about a row it names: A HOME IS FIXED BY THE FIRST REGISTRATION.** Registering is the
record's act. A bundle that carried bytes without registering them never made a home, so a later bundle that registered
the same bytes IS their home. Only a register row MOVED by the pre-fence UPSERT (D-179's residue) is a defect. The census
cannot tell the two apart, so a repair touches ONLY rows the record itself proves were moved (register history, or a
surviving prior row). Every other row stays STATED as undetermined between the two, and is never repaired by guess.

**AND WHAT A CAPTURE MAY CLAIM ABOUT BYTES THE RECORD ALREADY HOLDS — BUILT 2026-09-24 by D-476.** The register is
this section's answer to WHERE a document lives; it is also the only thing that can answer WHETHER the record
already holds one whose bytes the store keeps in parts. `op=acquire` answers a caller's `existed` for an ordinary
capture by asking R2 for the whole's own key before it writes (D-469). A multi-part capture has no such key — the
whole is never stored under its own hash, only its parts are — so that question was not asked at all and the op
answered a flat `false`. **That `false` is not the absence of a claim.** It says THESE BYTES ARE NEW, and it said it
on every re-fetch of a parted document the record holds, which is the case Bob's ruling of 2026-07-30 calls the
NORMAL one (`LINK-FIDELITY.md`). So the question that CAN be asked is asked, and it is this section's own: the
register, keyed by `capture_sha`, joined to `bundles` so a purged home is not a holding, naming no bundle to the
caller — D-15 needs no viewer for a yes-or-no about the bytes, which is all `existed` has ever said. Registered:
`true`. A miss, or a store that could not be consulted: `null`, with a sentence saying what was and was not asked.
WHAT STAYS UNDETERMINED BY CONSTRUCTION: a parted capture acquired and never promoted leaves its parts in the store
and no register row, so nothing anywhere can be asked by the whole hash; the parts THIS fetch made are reported in
that sentence as an observation only, because part boundaries follow the stream's chunking and need not be an
earlier fetch's; and the digest-level duplicate stays exactly as far out of reach as D-179 left it.

**AND WHAT THE AUDIT MAY CALL A CAPTURE HELD IN PARTS — RULED 2026-09-24 21:17Z by BOB #33, BUILT the same day by
D-533.** `op=registeraudit` asks, of every register row whose bytes are not in the bundle image, whether the working
bucket holds them, and it asked by the WHOLE key alone. A multi-part capture has no whole key (the paragraph above),
so a document filed exactly as C-18.1 describes, every byte of it held, audited `unbacked` and the record `sound:
false`: the audit called held bytes missing. **THE RULING:** `sound` reads true for a row held IN PARTS when every
part the record names is present and each part's digest is verified. That is a FOURTH state beside captured,
mismatched and unbacked, **"held in parts, all present"** (`held_in_parts`). A missing part is NAMED
(`missing_parts`) and makes the row unbacked. A row that resolves NEITHER way is **UNDETERMINED** and is counted
OUTSIDE `sound`, never inside it: `sound` speaks for the determined rows, and the undetermined ones are a count of
their own beside it with the reason each could not be resolved. WHERE THE RECORD NAMES THE PARTS: in the holding
bundle's intake provenance register, `data/provenance.json`, whose document for that `capture_sha` carries `parts:
[{file, sha256, bytes}]`; an unparsable register, or parts named without a digest and size, is undetermined. A part
is VERIFIED by the SHA-256 R2 itself checked at the put (both writers pass it) matching the digest the record names,
or, for a part stored without that checksum and no larger than one acquire part (8 MiB), by reading and hashing it; a
larger checksum-free part stays UNVERIFIED and its row undetermined, never passed. A part whose size or digest
disagrees is `mismatched`, named. NOT ASKED HERE: whether the parts reassemble to the whole's digest, which is
C-18.6's check at the gate and would mean reading every byte on every audit.

**AND WHAT ATTEST AND THE GATE MAY SAY OF A CAPTURE HELD IN PARTS — BUILT 2026-09-24 by D-530.** Two more readers asked
only for the whole-hash object and read a miss as absence. `op=attest` refused NO_SUCH_CAPTURE, "capture the document
before attesting it", and the setup surface attests straight after acquiring, so every document over one part was refused
that way. The ratify gate refused a register row naming a parted capture's WHOLE hash PLANE_MISSING_BYTES, "absent from
the working bucket". Both statements were false of bytes the record holds. On a whole-hash miss each now asks the store
the question this section answers, and keeps apart two witnesses of different strength. **The plane's own acquisition
receipt** (`captured_locators`) has one writer, `op=acquire`, and holds the hash the plane computed as the bytes arrived.
Nothing deletes a store's captures, so a receipt with no whole-hash object means the document is held in parts, and no
caller can write it. Attest ATTESTS on it and says the capture is held in parts. **The register alone** is a row
`op=promote` wrote from what its caller named, without reading the bytes (D-45). Attest does not rest a timestamp on it.
It refuses CAPTURE_HELD_IN_PARTS (C-89.1), which does not call the bytes missing. NO_SUCH_CAPTURE stays for a hash nothing
names, and its sentence now says what was asked. The gate still refuses a whole-hash row held in parts, because the
publish step copies a capture by the hash its row names, but now it names the finding PLANE_HELD_IN_PARTS. The setup
surface's own shape registers each PART; every part is an object under its own hash, and the gate passes it. Driven
through the ops by `bio-plane/test/d530-parted-attest.test.mjs`. WHAT STAYS OPEN: a parted capture whose whole hash the
plane never received can be neither attested nor published by that hash, and verifying a whole hash against its parts by
streaming them is not designed (verified 2026-09-24 by D-530: no document names it; routed to BOB #34).

**AND A WHOLE-HASH ROW HELD IN PARTS RATIFIES — RULED 2026-09-25 00:00Z by BOB #34, BUILT the same day by D-556.**
The paragraph above left the record contradicting itself: the audit called a parted capture SOUND when every part the
record names is present and verified (D-533), and the gate refused the same bytes PLANE_HELD_IN_PARTS, because
publication copied a capture by the whole hash its row names and no object lives under it. **THE RULING:** such a row
ratifies once the bytes can travel, and BOTH halves land together, never the gate alone, since a row that ratifies and
cannot be published claims more than the record can deliver. (1) **Publication copies a parted capture part by part**,
each under its own hash, and **re-verifies each digest at the destination**: every part is headed in the published
bucket and verified by the same rule the audit uses; a part not there, or whose digest fails or cannot be checked, is
named in the answer and the copy is reported INCOMPLETE, never ok. The whole's identity and its parts are published in
the bundle's own `data/provenance.json` beside them, so a reader can reassemble and check the whole; nothing is served
under the whole hash, and nothing claims to be. (2) **The gate admits the row when every part the record names is
present and verifies**, reading the parts where the audit reads them (the holding bundle's `data/provenance.json`), and
**refuses by name otherwise**: PLANE_PART_MISSING naming each missing part, or PLANE_PART_UNVERIFIED naming each part
whose size or digest disagrees, or whose digest could not be checked, or saying why the parts could not be read. A row
whose parts the record does not name is still refused PLANE_HELD_IN_PARTS: there is nothing to verify or to copy. One
rule serves all three readers (the audit, the gate and the destination check), in one place. Driven through the ops by
`bio-plane/test/d556partedpublish.test.mjs`. D-530 is not reopened. WHAT STAYS OPEN: that the parts reassemble to the
whole's digest (C-18.6) is not checked here either; and the three PLANE_ findings, like every PLANE_ finding, reach a
member inside GATE_REFUSED with no catalogue row or translation of their own.

# 9. Creation authority boundaries (added v1.1)

Made concrete by the admission of creation-by-packaging (the endpoint at
0.10.2). The daemon creates Information bundles from named standing
intent only, always at collected, never anything else and never higher.
Sessions create Focus and Project bundles through
creation-by-packaging, gated in the producing session, promoted like
every write; the first production Focus and Project were created
exactly this way. Elevation, release, disposition, and distribution are
member acts under Sections 4a and 7, whatever surface records them. No
actor class creates Actions mechanically; an Action is an act in the
world and begins as a member decision.

# 10. Staging versus expunge (added v1.1; open, with decision criteria)

The open question from the draft 0.7 reconciliation, carried explicitly
rather than by allusion. Sweep intake could stage before first
promotion, so most may-not-hold discoveries happen before any history
snapshot exists and expunge is rarely needed; or the fence's current
form could stand, with collected material visible and durable from first
promotion and expunge handling late discoveries. The decision criteria:
the fence's virtue is that collected material is visible, durable, and
reviewable by every member from the moment it lands, which staging
weakens; staging's virtue is that discovery-then-action mostly happens
before immutable history exists, which shrinks the expunge surface; and
the deciding facts are the observed rate of may-not-hold discoveries in
real sweep yield and the observed cost of expunge when exercised,
neither of which exists yet because no sweep has been ratified. Decided
at first sweep ratification, not before. Both-and remains admissible:
staging as the front line and expunge for late discoveries.

# Sections not yet forced

Member-intake specifics beyond the contract (M3'); received work
products from other groups as an intake class (the Cityside consumer
posture makes this concrete; drafted when the first one arrives);
extraction and normalization standards per document type (M2', with the
Data Extraction skill); the acquisition doctrine's second draft shaped
by the Cityside collaboration (original M4 exit).

## Cross-reference: declared bias (July 27, 2026)

Intake and release are lens-independent by design: verification asserts only
that a document appears to be what it claims to be, and no bias statement
changes what may be captured or verified. Declared bias
(BIO_Declared_Bias_v0_1.md) binds ABOVE this doctrine, at evidence, analysis
and conclusions; its one touch on this document's territory is at ratification
for publication, where a work product must carry its bias manifest, an authored
**bias acknowledgement** (DEC-46 (a), REC-47), and no unsettled **HUNCH DEBT**.

> *Corrected 2026-08-05 (D-188 / DEC-46 (d)). This read "no unsettled bias
> debt", which is the pre-DEC-20 blanket rule and reads as forbidding what the
> doctrine requires: ordinary bias debt is DISCLOSED and travels with a
> published case. Only an uncleared HUNCH refuses ratification for publication.*
