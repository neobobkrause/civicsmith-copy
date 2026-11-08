# BIO Declared Bias, v0.1 DRAFT

**Status** · The doctrine of bias as a declared, justified, first-class construct: three statement kinds, bundles and adoption, the subject registry and the masking safeguards, bias debt versus HUNCH DEBT, the authored acknowledgement at export, differential traversal and the cross-group rerun. Titled "v0.1 DRAFT, drafted July 27, 2026, from Bob's proposal"; its header's "nothing here is ratified doctrine, no check exists, no code implements it" is now false — it carries three RULED markers (DEC-6 and DEC-15 of 2026-08-01, DEC-46 of 2026-08-04, built by REC-47), one AMENDED (DEC-20) and one STRUCK sentence (D-188), and the plane carries `object_type: bias`, `op=biasmanifest`, the acknowledgement, and — since D-84 (2026-09-23) — the manifest stamped into every newly published case document. Partially complete: a v0.1 body with dated rulings layered in place and a header never re-dated. Read the "READ THIS FIRST" banner in the hunch section before anything else — bias debt and HUNCH DEBT mean opposite things for publication and the body once said otherwise. Bias debt is RAISED since D-86 (2026-09-23) and SETTLED since REC-207 (2026-09-24, BOB #32's ruling of 2026-09-23 23:42Z): one disclosed, never-blocking obligation per run whose lens moved, and three acts that settle it — the lens moving back, a re-run under the lens now in force, and a member's resolve with a required stated reason — each RECORDED, append-only, and read back by `op=biasdebt` (`construct-status.json` 7.bias-debt). Since REC-188 the gate refuses a `bio-case-document/3` without the manifest (C-41.13). **§Differential traversal and the cross-group rerun and Incomplete sections AMENDED 2026-10-09 (K2420; D59; `BIO_Investigation_v0_1.md`): regrade is to be built.** as of 2026-10-09 (REC-207 BUILT BOB #32's ruling of 2026-09-23 23:42Z: what settles a bias-debt obligation; REC-187 BUILT BOB #31's ruling — the manifest names the ADOPTED revision and hashes exactly its statements; D-468 then made the bias state machine ENFORCED at the write path rather than merely declared (C-26.12), which closes the adopted-set half of the adoption residue; REC-210 BUILT BOB #32's: an adoption pinning a still-PROPOSED revision is a REPLACEMENT and SAYS so, on the act's answer and on op=biasmanifest, and the ruling moved into §"Bias bundles and adoption").

**Place in the system** · Owns construct 7 of `BIO_System_Design.md` §3 (declared bias) and the subject-registry requirement, which D-83 makes the same construct as the Content Framework's entity axis. `BIO_Content_Framework_v0_10.md` §13 defers to it; `BIO_Interaction_Constructs_v0_1.md` consumes it for the TASK clock; `BIO_Case_Making_v0_1.md` for hunch debt on plan premises.

**Incomplete sections** ·
- §header — "no check exists, no code implements it" is stale; the bias type, the manifest op and the acknowledgement exist.
- §Statement anatomy — the subject lists are superseded; both defer to the registry vocabulary (RULED 2026-08-01).
- §Bias bundles and adoption — the manifest now travels with publication (D-84, 2026-09-23): stamped into the signed case document and frozen. Since REC-187 (2026-09-24) a manifest's `revision` is the ADOPTED revision and `statements_sha` is over exactly its statements (BOB #31). Since REC-188 (2026-09-24) the gate REQUIRES the block of a `bio-case-document/3`, which op=publish authors (C-41.13); a /2 document authored before D-84 carries none and still ratifies. `op=biasadopt` taken on a later PROPOSED revision re-pins to those proposed bytes and lifts the adopted lens: RULED a REPLACEMENT by BOB #32 (2026-09-24) and MARKED since REC-210 — `pins_proposed` on the act's answer and `pins_proposed[]` on op=biasmanifest. For an ADOPTED set that sequence is CLOSED 2026-09-24 by D-468: `op=promote` now holds every bias-set move to the declared STATES edges read from the current head and refuses any other by name (BIAS_ILLEGAL_TRANSITION, C-26.12), so an adopted set cannot stand at `proposed` again — from `adopted` the only moves are `retired` and a revision that stays at `adopted`, which RE-PINS, and the section's own sentence *"Amending an adopted set is a NEW REVISION of the same bundle under append-only history — which re-pins"* is what the machine now leaves as the way to amend one. REC-210's marker still reads where it is reachable, an adoption of a set standing at `proposed` (composed at c21-batch28, where REC-210 and D-468 first met). The FROZEN case-document block states it since REC-219 (2026-09-25, BOB #34): a `bio-case-document/4` carries `bias_manifest.pins_proposed`, its sentence and `bias_manifest_pins_proposed[]` (bundle, revision, scope, state) beside the unchanged `no manifest was in force`, saying nothing about when or whether the revision takes effect, and C-41.14 refuses a /4 silent about it (`BIO_Publication_v0_1.md` §3 rule 18); /3 documents are read as they are.
- §Integration with the epistemics ladder — the mechanical binding is a stated prerequisite; no ruling, no op.
- §Bias debt, and HUNCH DEBT — says `op=publishpreflight` "exists"; it is deferred with REC-15 behind DEC-33; the sequencing paragraph predates PL-12.
- §Sequencing — "Not a build order".

**Contents**
- [Why this exists](#why-this-exists)
- [The construct](#the-construct)
  - [Statement kinds, a closed set of three](#statement-kinds-a-closed-set-of-three)
  - [The malformedness rule (the discipline that keeps this honest)](#the-malformedness-rule-the-discipline-that-keeps-this-honest)
  - [Statement anatomy](#statement-anatomy)
- [Bias bundles and adoption](#bias-bundles-and-adoption)
  - [RULED 2026-09-24 by BOB #32: adopting a PROPOSED revision replaces the lens (REC-187's finding)](#ruled-2026-09-24-by-bob-32-adopting-a-proposed-revision-replaces-the-lens-rec-187s-finding)
  - [RULED 2026-08-01: the subject vocabulary is the registry's, and the malformedness rule is the constraint](#ruled-2026-08-01-the-subject-vocabulary-is-the-registrys-and-the-malformedness-rule-is-the-constraint)
- [Integration with the epistemics ladder](#integration-with-the-epistemics-ladder)
  - [RULED 2026-09-23 by BOB #31: there is no credence ledger (D-53; S17-1 Q1)](#ruled-2026-09-23-by-bob-31-there-is-no-credence-ledger-d-53-s17-1-q1)
- [Bias debt, and HUNCH DEBT](#bias-debt-and-hunch-debt)
  - [RULED 2026-09-23 by BOB #32: what settles a bias-debt obligation (D-86)](#ruled-2026-09-23-by-bob-32-what-settles-a-bias-debt-obligation-d-86)
  - [RULED 2026-08-01: a HUNCH is temporary declared bias, and it is HUNCH DEBT](#ruled-2026-08-01-a-hunch-is-temporary-declared-bias-and-it-is-hunch-debt)
- [The bias acknowledgement, authored at export](#the-bias-acknowledgement-authored-at-export)
  - [RULED 2026-10-01 by Bob (DEC-103): the full lens is printed into the signed case](#ruled-2026-10-01-by-bob-dec-103-the-full-lens-is-printed-into-the-signed-case)
- [Differential traversal and the cross-group rerun](#differential-traversal-and-the-cross-group-rerun)
- [The two-audience choice, made knowingly](#the-two-audience-choice-made-knowingly)
- [Sequencing](#sequencing)

---

Drafted July 27, 2026, from Bob's proposal in the 2026-07-27 trust session and
the construct discipline agreed there. DRAFT means under discussion: nothing
here is ratified doctrine, no check exists, no code implements it. It is
recorded so the constructs survive the session in exact form.

## Why this exists

Bias is real, it is everywhere, and the most dangerous bias is the denied one.
BIO cannot make its members lensless, so the honest system makes the lens part
of the record. Declared bias legitimizes bias as a visible, first-class
construct: the author must declare and justify their bias for the system to
honor it, and any BIO work done under bias carries the fully declared bias as
part of the evidentiary record of that work. The pedigree to cite when
defending this in public: rules of evidence (adverse-inference rules are
declared inference bias in judicial dress), newsroom sourcing standards, and
the Bayesian requirement that priors be stated before the data arrives.

Terminology: this document says DECLARED BIAS for the construct, because the
word "bias" also names the document flaws the construct exists to counter
(exaggeration, false attribution, labeling others' statements false, selective
or falsified evidence). The reclamation of the word is deliberate and kept; the
modifier keeps the two senses from blurring in doctrine.

## The construct

A **bias** is a set of **statements**. A statement is one declarative that
affects belief about evidence and about the attributed source of evidence.

### Statement kinds, a closed set of three

**scrutiny** — assigns an elevated scrutiny process to a source before that
source's claims may bear load. Example: "Anything that Donald Trump says needs
to be cross-checked for accuracy." Effect: a conclusion resting on an
un-cross-checked claim from the subject draws an evaluation finding.

**inference** — licenses or blocks a specific inference pattern. Example: "The
city attorney often refuses to respond to media requests, so a lack of
response from the city attorney is not an indication of agreement or
disagreement with statements made by others." Effect: a derivation whose
load-bearing step is a blocked inference draws an evaluation finding.

**pattern** — an evidenced empirical claim about an institution's or source's
behavior. Example: "The Oakland Auditor uses its discretion to control the
narrative, which limits identified remediation options." By the epistemics
ladder a pattern statement IS analysis, so it must cite evidence in the
record: a pattern statement without at least one citation cannot leave draft.
Effect: available for citation by analysis like any other analysis; it does
not automatically fail anything.

### The malformedness rule (the discipline that keeps this honest)

A statement that pre-assigns a truth value wholesale to a source or speaker
("X lies," "everything from Y is false") is MALFORMED and refused, no matter
who declares it. Declared bias may raise scrutiny, constrain inference, and
assert evidenced patterns. It may never issue verdicts. The mirror test: the
list of biased-document flaws is exactly the list of things a bias statement
must never itself commit. The construct that fights undeclared distortion is
held to a higher standard than the distortion.

### Statement anatomy

Each statement carries: a stable id within its bundle; its kind; its subject
(the source, institution, office, or topic it addresses); the declarative
text; a required justification; citations (anchored, once anchored citations
exist; required for kind=pattern); and, on instance-level statements only, a
lock flag.

## Bias bundles and adoption

Bias sets are BUNDLES, object_type `bias`, so they inherit everything bundles
already have: append-only history, member-authored transitions, convergent
promotion, conformance checks, and the store. Nothing new is invented for
governance:

**Instance level.** Admins define instance bias. The process by which a group
agrees to adopt a bias bundle at the instance level is defined and documented
by that group, in the group's own process document; the system requires only
that adoption is a recorded, member-authored transition under that documented
process. Adopted instance statements may carry `locked: true`.

**Project level.** Project managers define project bias. A project bias bundle
may add statements and may OVERRIDE (nullify or replace) instance statements.
An override must name the instance statement id it nullifies, so overrides are
structurally loud: recorded as overrides, visible as a diff against the
instance set, reviewed at ratification where the group's check re-enters.

**Locks.** A project override naming a locked instance statement is a
conformance error, full stop. Bob's ruling: if the project managers don't like
it, they can build their project in another instance. Locks bind projects
only; the instance may amend or retire its own locked statements through its
documented adoption process.

**The masking attack, and the safeguards against it.** The attack: a project
does not nullify an instance statement, it ADDS a statement whose net effect
limits or neutralizes one. Five safeguards, layered:

1. **Override is defined by EFFECT, not by form.** Any project statement whose
   effect LOOSENS an instance statement on the same subject (weakens its
   scrutiny demand, licenses an inference it blocks, narrows its reach) IS an
   override, whatever it calls itself, and must name the statement it loosens.
   Loosening a locked statement is a conformance error regardless of framing:
   locks protect the statement's effect, not its text.
2. **Strictest wins in the effective set.** Where statements conflict and no
   named override resolves them, evaluations apply the strictest applicable
   statement. A semantic contradiction that slips past detection therefore
   loosens nothing mechanically; it merely sits in the record looking evasive.
3. **Subject collisions are loud.** Every statement declares its subject. A
   project statement whose subject overlaps an instance statement's subject is
   flagged as an INTERACTION, requires a justification that addresses the
   interaction explicitly, and travels the same review path as an override:
   diffed against the instance set and reviewed at ratification.
4. **Subjects are registry entries, not free text.** Statements do not name
   their subjects in prose; they reference a SUBJECT REGISTRY the instance
   maintains as a bundle: entries for sources, institutions, offices and
   movements, each with its aliases, plus DECLARED RELATIONS between entries
   (proxy_for, member_of, overlaps), each relation justified and citable like
   a pattern statement. Mechanical equivalence extends exactly as far as the
   registry declares: if the registry relates MAGA to Trump, a project
   statement on one collides with an instance statement on the other; if it
   does not, no machine can honestly claim they are the same subject, and the
   design does not pretend one can. What the registry guarantees instead is
   that introducing a NEW subject is itself a loud, reviewed act: a project
   statement referencing a subject the instance registry does not carry is
   flagged for exactly the interaction review an override gets. Semantic
   equivalence is finished where all semantics are finished here: at
   evaluation time, where the evaluator (AI-assisted, member-owned) applies
   statements by meaning rather than string match, and at the adversarial
   backstop, since a rerun by an opposing group will name the dodge in
   public.
5. **The group is the backstop.** Effect comparison is mechanical for
   inference statements and largely mechanical for scrutiny statements;
   pattern statements and artful language are not fully machine-judgeable, and
   the design does not pretend otherwise. What the machine guarantees is that
   nothing on a shared subject is QUIET; the ratification review is where
   human judgment finishes the job.

**Effective bias** for a piece of work = the adopted instance statements at
pinned revisions, minus project nullifications of unlocked statements, plus
project replacements and additions. Every work product cites its BIAS
MANIFEST: the list of (bias bundle id, revision) in force plus a hash of the
computed effective statement set. The manifest is part of the evidentiary
record and travels with publication.

### RULED 2026-09-24 by BOB #32: adopting a PROPOSED revision replaces the lens (REC-187's finding)

*Raised by REC-187 as a finding and ruled at 00:42Z; MOVED here from "Bias debt, and HUNCH DEBT" by REC-210, where it
had been recorded beside the debt it is not about — this section is where adoption is specified, and a ruling about what
an adoption PINS belongs in it.*

An adoption pins exactly the bytes the member read and chose. Adopting a proposed, not-yet-accepted revision is a
REPLACEMENT: the adopter's lens becomes those bytes, and it stays on them whatever later happens to the proposal. It is
never a pre-authorisation of whatever the proposal becomes. The adoption and its read SAY that they pin a proposed
revision.

**BUILT (REC-210, 2026-09-24) — the marker, in both places the ruling names.** `op=biasadopt` answers
`pins_proposed`, true exactly when the revision it froze stands at `proposed`, and its `note` says the act REPLACES
that scope's lens with bytes the group has offered and not accepted rather than pre-authorising whatever the
proposal becomes. `op=biasmanifest` carries `pins_proposed[]` — one entry per adoption whose PINNED revision is not
`adopted`, naming the set, the revision, that revision's own state and the member who adopted it — with
`pins_proposed_stated` saying what the list means. Both fields are ABSENT when no adoption pins a proposed revision,
so their presence is the claim; adopting an accepted revision marks nothing.

**It is a fact about the PIN, not a second spelling of `in_force`, and not a second column.** It is derived from the
pinned revision's own bytes, so it moves by itself when promotion re-pins an adoption to the revision it mints
(BOB #31, REC-187) and moves back when a member adopts a later proposal. `in_force: false` says no lens stands over
the scope's work; the marker says a member's authored act put proposed bytes there instead. That difference is the
whole ruling: before REC-210 the read of a scope whose adoption had been moved onto a later proposal was
indistinguishable from the read of a group that had never adopted anything. The required sentence *"no manifest was
in force"* is true of such a moment and is unchanged; the marker sits beside it.

**What is NOT marked, stated.** The FROZEN `bias_manifest` block a published case document carries (D-84, format
`bio-case-document/3`) has no field for this, so a case published while the scope's only adoption pins a proposed
revision still signs *"no manifest was in force"* — true of that moment, silent about the replacement. Carrying the
marker into the signed bytes is a document-format change (a `/4`) and C-41.13's, and is not REC-210's.

### RULED 2026-08-01: the subject vocabulary is the registry's, and the malformedness rule is the constraint

**Every kind the SUBJECT REGISTRY carries is a legal subject for a bias statement.**
Decided by session BOB (DEC-6), raised by FRAMEWORK from the FW-6 registry slice. The
registry is ONE construct serving both this doctrine and the content framework's entity
axis (D-83), so its vocabulary is the union — source, institution, office, movement,
person, body, ordinance, parcel, contract, fund — and a bias statement may name any of
them. No `kind` whitelist is written at the bias-statement write path.

**First, a correction to this document.** "Statement anatomy" above says a subject is
*"the source, institution, office, or TOPIC it addresses"*; safeguard 4 says the registry
carries *"sources, institutions, offices and MOVEMENTS"*. Those are two different lists,
and the "four safeguard-4 kinds" a later reader would have built a gate on were never
four agreed kinds. The registry's vocabulary is now the single answer and both sentences
above defer to it.

**Why a narrow list is not a safeguard.** It was proposed as one. Check what it would
guard: `office` is already inside it, and a statement whose subject is an office —
asserting a prior against whoever holds it — is the closest thing in this system to the
structural-prior-by-role that `CLAUDE.md` forbids outright. The kinds it would exclude
(person, ordinance, contract, fund) are the specific, citable, evidence-bearing ones. The
whitelist admits the doctrinally riskiest kind and refuses the safest. It protects
nothing.

**And why the wider vocabulary is the more honest one.** This construct is a DISCLOSURE:
it exists so that what a group already believes is stated where a reader can discount it.
A group that campaigned against a measure, or that already believes a named official acts
in bad faith, HOLDS that bias whatever the vocabulary permits. Refusing the subject kind
does not remove the bias — it removes the declaration of it and pushes it into the
unstated priors, which is exactly the masking the five safeguards exist to defeat. A
vocabulary restriction on a disclosure construct makes the record less honest.

**What constrains a bias statement is unchanged, and is sufficient:** the malformedness
rule (raise scrutiny, constrain inference, assert evidenced patterns — never issue a
verdict, refused no matter who declares it), the citation requirement on `kind=pattern`,
strictest-wins in the effective set, the loud interaction review a new subject triggers,
and the group as backstop. Every one operates identically whatever the subject's kind, and
none of the five is a kind restriction. Safeguard 4's own argument is about
registry-versus-free-text and about declared relations, not about a closed list.

**The residual, with its trigger, so nobody re-raises it early and nobody forgets it.**
The sharpest edge is a bare `scrutiny` statement naming a NATURAL PERSON with a
justification and no citations. It is admitted here. If practice shows it used to do what
the malformedness rule forbids — a verdict wearing a scrutiny statement's clothes — the fix
is a one-line predicate on `kind` at the write path, and it belongs to Bob, because it is
doctrine about a named individual. **Trigger: the first bias bundle carrying a
person-subject statement that a reviewer challenges as a verdict.** There is nothing to
reason from until a real one exists.

## Integration with the epistemics ladder

Conclusions are graded on how they follow only from evidence and analysis
UNDER THE DECLARED BIAS SET IN FORCE. The consumers are the argument
evaluations Projects already carry (C-9.1 gates work product state on them):
an evaluation consults the effective set; scrutiny statements demand recorded
corroboration for flagged sources; inference statements refuse blocked
inferences as load-bearing; pattern statements stand as citable analysis.

Prerequisite: for bias to bind mechanically rather than remain guidance
humans apply by hand, evidence items need source attribution the system can
match, which anchored citations were already going to carry (an evidence item
is an anchored selection within a document, attributed to a source).

### RULED 2026-09-23 by BOB #31: there is no credence ledger (D-53; S17-1 Q1)

BIO keeps no credence, reputation or trust SCORE for a source or a piece of content, whether it is computed or authored,
shared or a group's own. A score like that is a prior against a class of actor, and the stance refuses one: bad actors
are identified by EVIDENCE. What a member brings is declared here as bias, and evidence accrues to it. S-11 step 5 is
re-scoped to *show the findings the record holds ABOUT a source*. Those findings are evidence, each with its own grade.
That read becomes a row only if S-11 is scheduled. **Bob may overrule this; it was put to him on 2026-09-23.**

## Bias debt, and HUNCH DEBT

> **READ THIS FIRST — the two terms are not the same and the difference decides
> what may be published (DEC-20, Bob, 2026-08-02; vocabulary corrected 2026-08-05
> per DEC-46 (d), D-188).**
>
> - **BIAS DEBT is DISCLOSED.** A lens changed, so some analysis owes a re-run.
>   It marks the work, TRAVELS with it, is shown to the reader, and **does not
>   block publication or ratification.**
> - **HUNCH DEBT is DISQUALIFYING.** A hunch is a connection graded ahead of its
>   evidence. It **must be cleared before publication**, refused by name
>   (`op=publishpreflight` → `UNCLEARED_HUNCH`).
>
> The principle underneath, which the old blanket rule did not have: **a hunch
> inflates a GRADE, and ordinary bias only frames interpretation.** A declared
> standing position is a lens a reader can apply or discount for themselves, and
> it costs the reader nothing to be told. A case published over an uncleared
> hunch states a strength that is not true.
>
> **WHY THIS BANNER EXISTS.** The section below once said, flatly, that *a work
> product carrying bias debt cannot be ratified for publication*. On 2026-08-04
> **Bob re-read that sentence as contradicting the doctrine — and Bob authored
> the ruling.** If the person who decided it misreads the text, every later
> reader will. So: say **HUNCH DEBT** wherever the disqualifying rule is meant,
> and reserve *bias debt* for the general disclosed class.

When a bias is added or changed, existing analysis is not silently stale and
not retroactively invalidated: it is marked as carrying **bias debt**, meaning
a re-run is owed. The old work remains honest as written, because it cites the
bias manifest that was in force when it was made; the debt marker records the
delta between that manifest and the current effective set, so the record
always shows exactly which statement changes a piece of analysis has not yet
been re-evaluated under. Debt is tracked per work product, is visible wherever
the work is consulted, and is cleared by re-running the evaluation (or the
analysis, where the change reaches it) under the current set. Tracking is
continuous; settlement is BATCHABLE, so a group can accumulate changes and
re-run in one pass rather than being stalled by every amendment. ~~A work
product carrying bias debt cannot advance its workproduct_state or be ratified
for publication until the debt is settled.~~ **STRUCK 2026-08-05 (D-188), and
struck rather than deleted because this exact sentence is the one Bob re-read as
a contradiction — a reader who remembers it must be able to see that it is gone
and why.** It is replaced by the amendment immediately below: only HUNCH DEBT
disqualifies; ordinary bias debt is disclosed and travels.

**AMENDED 2026-08-02 by Bob (DEC-20). The blanket rule above is REPLACED: only a
HUNCH blocks publication.** *"Not all bias needs to be cleared before a piece is
published. The only bias type that must be clear before publication is hunches."*
And, in the same review: *"Bias is public and accompanies every published case
produced under that bias."*

**The two sentences together give the principle the blanket rule did not have:
bias debt is DISCLOSED; hunch debt is DISQUALIFYING — because a hunch inflates a
GRADE and ordinary bias only frames interpretation.** A declared standing position
is a lens a reader can apply or discount for themselves, and it is published with
the case precisely so they can; it costs the reader nothing to be told. A hunch is
different in kind — a connection asserted ahead of its evidence, carrying a grade it
has not earned — so a case published over an uncleared hunch states a strength that
is not true, which is the overclaiming half of this project's threat model. The
blanket rule was reaching for the hunch case and caught everything.

So: ordinary bias debt marks the work, travels with it, is shown to the reader, and
does NOT block ratification. Uncleared HUNCH debt refuses publication, by name,
before any signature exists (`op=publishpreflight` → `UNCLEARED_HUNCH`). The
workproduct_state half of the old rule is likewise narrowed to hunches.

### RULED 2026-09-23 by BOB #32: what settles a bias-debt obligation (D-86)

Three acts settle a bias-debt obligation, and each is RECORDED; none clears it silently. (1) **The lens moves back**,
as built. (2) **A re-run under the CURRENT lens** discharges the debt of the run it re-runs, and the obligation is
closed with the discharging run's id and lens pins, so a reader sees WHICH run settled it. A re-run under any other
lens discharges nothing. (3) **A member's resolve with a REQUIRED stated reason**: an authored act, attributed, dated
and append-only. It needs no re-run, because a member may judge that the lens change does not bear on the finding.
Derived informs, authored binds (DEC-24), and a member is never forced (DEC-69).

**BUILT 2026-09-24 by REC-207**, and what was built is named here so it can be checked rather than believed.
Every settlement — all three — goes through ONE writer and appends a row to `bias_debt_settlements`
(`bio-plane/src/store.mjs` `#biasDebtSettle`), which is the structural half of *each is RECORDED*: a second
writer is how one of the three comes to clear a debt without a row. **(1) The lens moves back** is D-86's
sweep, unchanged in effect and no longer silent — it wrote a bare `cleared_at` before this landing, so a
reader could see THAT the obligation had gone and never WHY; it now records that the sweep settled it, with
no actor and no reason, because a sweep is not a person and attributing it to one would be an invented
attribution. **(2) A re-run under the CURRENT lens.** The link is AUTHORED at the open — `op=airunopen`
takes `rerun_of`, the opener's own word about which run this one re-runs, judged at the door (a self
reference, a run this caller cannot see, and a run in another context are each refused by name, C-33.45 to
C-33.47) — and the DISCHARGE is taken at that run's own `op=airunclose`, because a run that was opened and
never ran has not re-run anything. "Under the current lens" is ONE comparison and it is `op=airun`'s, never
a second one: the lens the run was FORMED under (the manifest it was handed) against the lens in force for
its context now. Where either side has no hash the answer is UNDETERMINED and nothing is discharged — two
absent hashes agree on nothing. The obligation is closed with the discharging run's id and both lens pins.
**(3) A member's resolve**, `op=biasdebtresolve`, which refuses a missing reason by name (C-26.16) and
refuses a machine credential by SHAPE (C-26.15), and records the member, the date, the reason and the pins.
A settlement is APPENDED and never replaced, so a lens that moves ONWARDS raises NEW debt with the old
settlement still on record, while a sweep that finds the SAME lens delta leaves an authored settlement
standing — a member is not asked the same question twice (DEC-69). `op=biasdebt` reads all of it back, which
is what makes *never cleared silently* a fact a reader can check. Driven by
`bio-plane/test/rec207-bias-debt-settle.test.mjs`.

### RULED 2026-08-01: a HUNCH is temporary declared bias, and it is HUNCH DEBT

> *Heading corrected 2026-08-05 (D-188 / DEC-46 (d)). It read "and it is bias
> debt", which is true only in the loose sense that a hunch IS a declared bias —
> and false in the sense every reader takes from this document, where "bias
> debt" is the disclosed class that does not block. The hunch is the
> DISQUALIFYING kind. Bob's quotation below is left exactly as he said it,
> because a quotation is evidence and is not edited; the vocabulary note after
> it is what reconciles his words with the term this document now uses.*

Bob, 2026-08-01 (DEC-15). **Exploration and discovery are distinct processes from
publishing**, and the investigative phase needs something the publishing phase must
not tolerate:

> *"Sometimes a valuable element of putting a case together comes down to a hunch. A
> hunch can come in many shapes and sizes. They can also be dead wrong. But they're
> important factors that can help bring an investigation together when there doesn't
> appear to be any other way to do so. But another way of looking at a hunch is that
> it's temporary bias. The investigator thinks this is true. In order for it to be
> useful during the investigative phases of an inquiry, hunch-based connections must be
> given a temporary high enough grade that otherwise disconnected evidence can be
> brought together and related where they otherwise wouldn't without that hunch.
> However — and this is important — a hunch is bias debt. It must be cleared before a
> finding can be published. A published case must pass the gate of sound and credible
> without any hunch connections."*

*(Bob's words, 2026-08-01, unedited. Where he says "a hunch is bias debt", this
document now says **HUNCH DEBT** — D-188 / DEC-46 (d). His rule is unchanged;
only the term for it is made unambiguous, because the general term had come to
mean the class that does NOT block.)*

**A hunch is a connection asserted by a member ahead of its evidence.** It is declared
bias in the exact sense this document already defines — a disposition of the
investigator that shapes what gets related to what — and it is DECLARED rather than
tacit, which is the whole difference between a hunch and the undeclared prior this
construct exists to surface.

**It carries a grade, and the grade is the point.** A hunch-based connection takes a
temporary grade high enough to make otherwise disconnected evidence traversable. This is
the only authored grade permitted above D, and it is permitted precisely because it
cannot survive publication. `grade_source: 'hunch'` sits beside `'resolution'` (earned
from the record) and `'testimony'` (a member's signed grade-D account), carries an author
and a date, and is **visible as a hunch on every surface from the moment it is made** —
not disclosed at publication. The failure this construct invites is a hunch quietly
ageing into a fact because nobody re-read the leg, and the defence is that it never
stops announcing itself.

**And it needs no new gate, which is why this ruling sits in THIS section.** The
blocking sentence struck above — *a work product carrying bias debt cannot advance its
workproduct_state or be ratified for publication until the debt is settled* — was
written for a bias statement CHANGING and leaving old analysis owed a re-run, and
registering the hunch as a kind of declared bias made it reach Bob's rule for free.

> **CORRECTED 2026-08-05 (D-188 / DEC-46 (d)), and this paragraph is where the
> whole confusion started.** The sentence it leans on has since been STRUCK by
> DEC-20: ordinary bias debt does NOT block, so it can no longer carry the hunch
> rule on its back. **The hunch rule survives intact and is now stated in its own
> right rather than inherited** — uncleared HUNCH DEBT refuses publication, by
> name, before any signature exists. The "no new gate" claim also still holds:
> the gate is `op=publishpreflight` → `UNCLEARED_HUNCH`, which exists. What
> changed is that the rule is now written down as its own rule, so nobody has to
> derive the disqualifying case from a sentence about the disclosed one.

**What CLEARING means follows from the same paragraph rather than needing its own
ruling.** Debt is *cleared by re-running the evaluation under the current set*. Retiring
a hunch changes the effective set; clearing the debt is re-running the analysis without
the hunch's licensing effect. So the test is **not** "delete the leg" and **not** "leave
it in, unrated" — it is that **the case must still hold when the hunch is removed from
the set.** In practice a leg whose grade came from a hunch has by then either acquired a
real grade or has none, and an ungraded leg suspends its axis (R1), so a case leaning on
an uncleared hunch cannot publish at a claimed strength. `op=publishpreflight` refuses
`UNCLEARED_HUNCH` and names every leg, before any signature exists.

**A hunch is not an `undetermined` leg and must never be composed as one.** R1 suspends
an axis when a grade is ABSENT; a hunch grade is PRESENT and asserted. During `open` it
links the evidence it joins — that is what makes it useful, for traversal, search and
suggestion — but it never lifts a strength reading, and the case is simply unpublishable
while it stands. Treating a hunch as undetermined would destroy exactly the
traversability this ruling exists to preserve. **CORRECTED 2026-10-01 by Bob (DEC-104):**
this paragraph said a hunch "composes normally" while open; a hunch counts for nothing in
any strength reading (strength R5), which says how many hunches it left out. The hunch's
letter stays on the link itself, in the hunch style, as the member's stated confidence when
the guess was made, beside the words "not counted". A standing "Hunches to clear" list sits
on the question and project pages (status where the work lives, never a notification), and
the check before publishing lists them again.

**Sequencing, stated so a later session does not conclude the bias half was forgotten:**
registering a hunch as a first-class statement in the bias manifest needs
`object_type: bias`, which the check catalogue does not yet carry (D-84). So the
leg-level `grade_source` and the publication refusal ship with the claim layer, where
they bite; the manifest registration lands with D-84.

## The bias acknowledgement, authored at export

**RULED 2026-08-04 by Bob (DEC-46 (2)); BUILT 2026-08-05 by REC-47.**

> *"Inclusion of a bias must be acknowledged and signed off on at the time of
> export by the publisher (not a pre-check checkbox)."*

**A published case carries the bias it was produced under as a fact a reader
weighs.** This is DEC-20's *"bias is public and accompanies every published case
produced under that bias"*, made operative — and it is a DISCLOSURE, never a
bar. Nothing reads which bias is named; nothing refuses a case for carrying one.

**TWO THINGS TRAVEL TOGETHER AND THEY ARE NOT THE SAME THING.**

| | what it is | how it is produced |
| --- | --- | --- |
| the bias **MANIFEST** | the lens itself — bundle ids, revisions, a hash of the effective statement set | **computed and stamped** by the plane |
| the bias **ACKNOWLEDGEMENT** | the publisher's account of what that lens did to *this edition's* findings | **AUTHORED** by the member, in the ceremony |

**BOTH ARE BUILT (D-84, 2026-09-23).** `op=publish` computes the manifest in
force for the case's project scope — each (bias bundle id, revision) pair and
`statements_sha` over the whole effective set — and stamps it into the case
document before its hash is taken (`bias_manifest`, `bias_manifest_bundles`, and
`## Bias Manifest` in the body). The signature freezes it: nothing recomputes it,
so a lens adopted afterwards moves `op=biasmanifest` and never a published case.
With nothing adopted the document says *no manifest was in force*.
**REQUIRED since REC-188 (2026-09-24)**: a `bio-case-document/3` — what `op=publish` now authors — without
the `bias_manifest` map (a boolean `in_force`; in force, the 64-hex `statements_sha`; not in force, the
stated sentence) or its `bias_manifest_bundles` list is refused by C-41.13, so *disclosed* holds because the
gate refuses the absence and not because the writer happens to stamp it. A /2 document keeps ratifying.

**The rules, as shipped:**

- **Authored, never prefilled.** A machine credential is refused
  (`MACHINE_CANNOT_PUBLISH`); an absent acknowledgement is refused by name
  (`NO_BIAS_ACKNOWLEDGEMENT`). A pre-flight checkbox would be the checkbox these
  gates exist to refuse.
- **Fresh per edition, under C-21.1's byte-check.** Reprinting the previous
  edition's sentence is refused (`BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD`),
  because it is evidence nobody looked.
- **In the signed bytes, and in the container.** It is written into EVERY member
  finding before the sha is taken, so a stranger holding one finding — or the
  zip, once this instance is gone — can read the lens without our cooperation.
- **One per case per edition.** A case is scoped to the project that gathered
  its findings, and one project is one effective bias; two members who signed
  different acknowledgements are refused (`CASE_ASSERTION_DIVERGED`), never
  reconciled. Findings produced under *different* source biases are DEC-46 (3)'s
  case and land as separate projects.

**WHY IT IS BYTE-CHECKED WHEN THE CASE'S SCOPE STATEMENT IS NOT**, since the two
now sit side by side under different rules. The test is not *could this
legitimately stay the same* — it is **what the field is a claim about.** A
statement of FACT ABOUT THE CASE (its scope; the manifest) does not move between
editions, and holding it to a difference manufactures one — *a gate that
pressures someone into inventing one is a bug in the gate*. An AUTHOR'S CLAIM
ABOUT THIS EDITION'S MATERIAL (completeness, the subject justification, this
acknowledgement) is a fresh act each time, because the material is what changed.

Nobody is ever asked to invent a change in their bias. *"The lens is unchanged,
and here is what it means for the findings added since edition 1"* is a true
sentence a publisher can write. And the failure modes are not symmetric: a stale
scope misdescribes the question, while a stale acknowledgement asserts that the
publisher weighed their own lens against material they never looked at — a claim
about an act that did not happen, which is the overclaiming half of this
project's threat model.

The full reasoning is at `checkCompletenessFreshness` in
`bio-plane/checks/bio-checks.mjs`, beside the rule it discriminates from.

**RULED 2026-09-23 by BOB #31 — WHICH REVISION THE ACKNOWLEDGEMENT NAMES (D-84 / PL-12).** The ADOPTED one. Promotion to
`adopted` re-pins the adoption to the adopted bundle_sha, the case stamps that sha, and `op=biasmanifest` hashes THAT revision's
statements — one quantity under one name, never a proposed sha beside a later projection's hash (BOB.md rule 7). Rowed first
in the backlog; the hash change goes through one IC.

**BUILT 2026-09-24 by REC-187.** `promote()` re-pins every adoption of a set in the transaction that mints its `adopted`
revision. A lens is IN FORCE when its PINNED revision stands at `adopted` — the head is asked only whether the set was
retired — so a later revision merely proposed neither moves the lens nor lifts it. `op=biasmanifest` reads each pinned
revision's statements and residue out of THAT revision's bytes, never the head's projection, and a pin whose bytes the
record cannot produce is answered UNDETERMINED, never "not in force". `bio-plane/test/d84-case-manifest.test.mjs` §4
recomputes the stamped hash from the stamped shas' bytes alone across propose → adopt → later propose.

### RULED 2026-10-01 by Bob (DEC-103): the full lens is printed into the signed case

Readers see the lens itself, not only its name and fingerprint. At publication every statement in force is printed into the
signed case: its kind in plain words, its subject, its text, and its justification and evidence directly beneath, citing only
published or otherwise public material and stating how many citations are withheld (never which). The published page shows
"The lens this case was produced under": the publisher's acknowledgement first, then each statement with its reasons, then two
lines on why groups declare bias. On screen it opens collapsed to one line per statement with its justification; in print it is
always full. Because the statements are in the signed bytes, the lens survives print, download and the group's system going
away. The publisher sees exactly what will be printed before signing. Earlier cases keep only the manifest's fingerprint.

**The two lines, RULED 2026-10-02 by Bob (DEC-117).** The section ends with these two sentences, verbatim: "Everyone who
investigates looks through a lens: what they care about and expect to find. An undeclared lens is the most dangerous kind."
and "This group declares its lens, with its reasons and its evidence, so that you can weigh its findings knowing how it
looked at the material."

## Differential traversal and the cross-group rerun

Because the record is re-derivable, two capabilities follow:

**Regrade (mechanical).** Hold evidence and analysis fixed, swap effective
bias B1 for B2, re-run the evaluations, and produce a structured diff: for
each conclusion, its grade under each lens, and the causal chain from each
differing statement to the finding it produced to the premise it touched to
the conclusion it moved. This is the tool that lets a user not just see
different conclusions side by side but dive into the package and understand
the impact of each difference at the analysis and conclusion levels. Honest
limit, named now: regrade re-grades conclusions against the analysis that
exists; it cannot synthesize the analysis a different group would have
written under a different lens. **RULED 2026-10-09 by Bob (D59; K2417): regrade is to be BUILT, after steps and the question explorer.** When a bias statement is applied (more scrutiny on a source, an inference blocked), the leg or conclusion it touches records that statement, and the case file carries those records. The standalone checker takes a lens (as published, bias removed, or the reader's own) and reports for each finding whether it still meets the bar and which statements made the difference, stating on every report the honest limit above. An importing group's own lens is applied in its assessment of an imported case (`BIO_Investigation_v0_1.md` §11).

**Rerun (human).** A work product from one group, with its enclosed bias
manifest, can be rerun by another group under that group's own bias. The two
products sit side by side with possibly very different conclusions, and the
disagreement is LOCALIZED TO NAMED LENS DIFFERENCES instead of narrative
against narrative. This is the no-transitive-trust decision made operational
between groups: the receiving group re-establishes trust at its own hop by
rerunning the work, not by accepting the producing group's reputation.

## The two-audience choice, made knowingly

Published work carries its bias manifest, and opponents will quote it. The
trade is accepted deliberately: a declared, justified, evidence-citing
scrutiny rule is more respectable than the undeclared lens every institution
operates with, and the malformedness rule is what makes each statement
survivable when read aloud by an adversary.

## Sequencing

Not a build order. Dependencies as decided: bulk release (S-11 step 5) is
first in the queue; anchored citations precede evidence attribution; evidence
attribution precedes mechanical bias binding. Declared bias can begin life as
bundles and doctrine (declaration, adoption, manifests, human-applied
evaluation) before the mechanical binding exists, and the regrade tool comes
last because it needs everything above it.
