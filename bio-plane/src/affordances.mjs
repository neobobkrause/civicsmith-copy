/* REC-19: the act catalogue behind op=affordances — what may be DONE to an
 * object, published by the plane (D-139, standing doctrine DEC-8).
 *
 * DEC-8, restated because every act surface builds on this file: the act
 * pre-flight is PLANE-SOURCED always. A surface may render a refusal it
 * received and may never compute one. Publication (op=affordances) is the
 * default; the dry run for the one act whose refusal turns on state a surface
 * cannot see — publication — is `case-authoring`'s op=publishpreflight (its R34,
 * N364), a read and never an act here (NON_ACTS.publishpreflight).
 * No act surface exists before this op, so what this file publishes is the
 * whole of what a surface may know about "what can I do here".
 *
 * WHAT IS DERIVED AND FROM WHERE. An act appears for a target if and only if
 * the plane's own data says the act's op would accept that object as it stands:
 *
 *   - the STATE MACHINE comes from the catalogue's exported STATES table,
 *     imported and never copied (the op=dispose hazard, not repeated);
 *   - the LIVE-CITES facts come from the store's own #citesInto predicate —
 *     the SAME one retire's CITED guard runs, extracted so the publication and
 *     the refusal cannot disagree (an equality that costs nothing is not
 *     evidence; a shared predicate costs the truth);
 *   - `needs` and `mode` are composed at the control plane from NEEDS and
 *     SESSION_OPS, the tables that actually gate the call;
 *   - `weight` is the set-application weight each acting module hard-codes
 *     (the legacy store's selectionResolve doctrine, now record-core's
 *     selection and `perItem`): declared here and CROSS-CHECKED by the suite
 *     against the weight the acting op itself reports.
 *
 * `rung` IS THE INTERACTION-CONSTRUCTS WEIGHT LADDER, AND FW-14 HAS ASSIGNED IT.
 * The ladder is `op-grades'` `RUNG_LADDER` (its R1) — reversible / reasoned / terminal /
 * attested / IRREVERSIBLE, top rung per DEC-19 as amended, with the correction
 * path published beside it. Every op the control plane declares mutating either
 * carries a rung in `RUNGS` or is named in `RUNG_ABSENT` with the ground on which
 * it has none, and `unaccounted(opTable)` (R12) answers that TOTAL IN BOTH
 * DIRECTIONS over the control plane's table of ops.
 *
 * FW-14 (2026-08-08) superseded REC-19's refusal to assign rungs: a rung is derived from what the code enforces,
 * and a rung with no backing is still forbidden.
 *
 * TOTALITY, AND THE DRIFT GUARD. Every op in the control plane's NEEDS table is
 * either an ACT here or named in NON_ACTS with the reason it is not
 * object-directed. `unaccounted(opTable)` below (R12) answers, NAMING the op,
 * any that is in neither set; a caller holding the control plane's tables asks
 * it, so an op added to NEEDS cannot ship unpublished and unexplained.
 *
 * SCOPE. The acts published are the OBJECT-DIRECTED ones: the ops whose subject
 * is a bundle in a given state — the selection-backed set the S-10/S-11 ladder
 * built. Ops that act on captures, entities, tasks, members, selections or the
 * roster are NON_ACTS with their reasons; several are real acts on OTHER kinds
 * of objects and later items fold them in (REC-15 the publication pre-flight).
 *
 * REC-24 (2026-08-05): an `action` publishes `actionmove` and `actioncorrespond`, derived from the same imported
 * state table.
 */

/* The record's grammar (record-grammar R1–R3, its R24's pure face): the state machines, read through its vocabulary
   lookup, and the type normaliser. */
import { STATES, normalizeType, vocabFor,
         /* REC-43 / DEC-39. The two letters the co-attestation fence states are
            the RULE's own, imported from where the grade the refusal enforces is
            defined, so the sentence a member reads and the grade the gate will
            accept cannot drift. See ATTEST_FENCE below. */
         EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE } from "./record-grammar/index.mjs";
/* PL-17 / DEC-65. The third `asserted_by` state and its texts, imported from `basis-versions`, the module that mints the
   value and classifies it (`sufficiencyClaimState`) — a surface holding its own copy of what "nobody claimed this" is
   called is the same drift every import in this list exists to close. */
import { SUFFICIENCY_CLAIM_STATES } from "./basis-versions/index.mjs";
/* N65 (3), R26 (K768): the action loop's vocabularies are `action-grammar`'s (its R1, R2), the objects `actions`' acts
   refuse against: the kinds offered with no profile active (`PRODUCT_KINDS`, actions R10), the risk tiers, the
   governing-law levels (`jurisdictions'` array, which action-grammar re-exports and `op=actionlaws` refuses against), a
   leg's kinds, the correspondence directions, stages and outcomes (D-147, C-94), and how an action ended. No kind is
   held here. */
import { PRODUCT_KINDS, RISK_TIERS, LAW_LEVELS, ACTION_BASIS_KINDS, CORRESPONDENCE_DIRECTIONS,
         CORRESPONDENCE_STAGES, CORRESPONDENCE_OUTCOMES, RESOLUTIONS } from "./action-grammar/index.mjs";
/* R51 (T45): the closed vocabularies T45's owners refuse against, each the owner's very object (R4): action-grammar's
   (its T45 R2), the five bases of a deadline (action-clocks R2), a plan's states (action-plans), a matter's states
   (plan-work), the harm words (consequences R9) and a project's scopes (project-roster R21, a static of its class). */
import { OVERRIDE_GROUNDS, PHRASING_KINDS, ASSERTION_RESOLUTIONS, PRESS_RECORD_TERMS, FOUND_ELSEWHERE_KINDS, BEARINGS,
         PROMISE_KINDS, CLOCK_OWED_BY } from "./action-grammar/index.mjs";
import { BASIS_KINDS as CLOCK_BASIS_KINDS } from "./action-clocks/index.mjs";
import { PLAN_STATES } from "./action-plans/index.mjs";
import { MATTER_STATES } from "./plan-work/index.mjs";
import { ADDRESSED_WORDS } from "./consequences/index.mjs";
import { ProjectRoster } from "./project-roster/index.mjs";
/* REC-14 / DEC-13: the three subject positions are `ratification'`s, whose case-document check refuses against them
   (C-2.8, C-41). */
import { SUBJECT_POSITIONS } from "./ratification/index.mjs";
/* REC-37: a leg's roles are `inquiry'`s, whose `op=cite` refuses without one (NO_ROLE / BAD_ROLE). */
import { BASIS_ROLES } from "./inquiry/index.mjs";
/* N345 (R4): the contradiction inquiry's frozen vocabularies are `inquiry'`s (its R46), the one list of each that
   `contradiction`'s acts and inquiry's grammar (R47) refuse against; the reasons a lead is dismissed for are
   `contradiction'`s (its R31, DISMISSAL_REASON_UNKNOWN). */
import { CONTRADICTION_COORDINATES, PLURALITY_DIFFERENCES, RESOLUTION_KINDS, NORM_CANONS } from "./inquiry/index.mjs";
import { DISMISSAL_REASONS } from "./contradiction/index.mjs";
/* N364 (R28, R29): the two prompts whose words are other modules' — DEC-81 item 3's reader sentence is
   `case-authoring`'s (its R36, the words its case document prints beside a self-attested capture), and what a consent
   binds and what a withdrawal binds are `sources'` (its R7, the statements its consent acts answer with). Imported so a
   surface reads the very sentence the act and the document state, never a copy. */
import { SELF_ATTESTED_SENTENCE } from "./case-authoring/index.mjs";
import { CONSENT_STATEMENT, WITHDRAWAL_STATEMENT } from "./sources/index.mjs";
/* PL-2 / IS-2. THE SIXTH STATE MACHINE, imported from where it is defined and
   enforced — `basis-versions` — the `op=dispose` hazard, not repeated. §6 rule 4
   requires it: *"the machine publishes the new machine through op=affordances,
   or every surface showing version states holds a second copy of the rule — the
   drift class DEC-8 closed."* */
import { VERSION_MACHINE, VERSION_REASON_REQUIRED } from "./basis-versions/index.mjs";
/* SK-7: the four states of a content row's `minted_by`, imported from the
   module that CLASSIFIES the value — a surface holding its own copy of what "a
   machine marked this citable" is called is the drift every import here closes,
   and this one lands on a field 14.4 requires be labelled. */
import { CONTENT_MINT_STATES } from "./content/index.mjs";
/* R30 (K921, K922 (3)): the template library's states, uses and review outcomes are `filing-templates'` (its R21), the
   arrays its acts refuse against, and a local fact's acts and statuses `local-facts'` (its R7); each published as the
   owner's own object (R4). */
import { TEMPLATE_STATES, TEMPLATE_USES, REVIEW_OUTCOMES } from "./filing-templates/index.mjs";
import { LOCAL_FACT_ACTS, LOCAL_FACT_STATUSES } from "./local-facts/index.mjs";
/* R34 (N520; DEC-116): the docket's shelves, entry kinds, a filing's proposals and the kinds of pressure a docket entry is
   marked with are `docket'`s (its R1, R2, R6), the arrays its acts refuse against; each published as the owner's own
   object (R4). */
import { SHELVES as DOCKET_SHELVES, ENTRY_KINDS as DOCKET_ENTRY_KINDS, PROPOSALS as DOCKET_PROPOSALS,
         PRESSURE_KINDS as DOCKET_PRESSURE_KINDS } from "./docket/index.mjs";
/* R13–R16, R23 (T9, K225): the facts the derivation below reads, one object as it stands and one caller as they are,
   extracted from the legacy store with the three joined-project predicates, whose only caller they were; and (N13) the
   op map that answers `op=affordancefacts`. */
export { affordancesOf, affordancesOps } from "./affordances/facts.mjs";
/* R17 (T19): `op=affordances`, the composition and the door's arm, with the gate and the stamps handed in by the control
   plane. */
export { affordancesAnswer, affordancesOp } from "./affordances/door.mjs";
/* R48 (N726; DEC-174 (3), DEC-99): the one table of what each act does, generated once from the design stream's text;
   R49 serves it, the very object, in the answer with no target. */
export { ACT_HELP, ACT_HELP_KEYS, BROWSER_ACTS } from "./affordances/act-help.mjs";
/* K1974 (`plan/draft-T35-splits.md` A-1): THE GRADING TABLES ARE `op-grades'` (its R1–R22): the ladder, its correction
   path, the `reasoned` family, the absence grounds, the consequence statements, the larger-screen acts, the Irreversible
   weight, `RUNGS`, `RUNG_ABSENT`, `MACHINE_REFUSALS`, `NON_ACTS` and `phoneOf`. Read here by reference and never copied
   (R4, R11, R12, R19, R20, R36): `VOCABULARIES` publishes the same objects, `deriveActs` reads `MACHINE_REFUSALS`,
   `decorate` reads `RUNGS`, `RUNG_ABSENT` and `phoneOf`, and `unaccounted` (R12) checks the totality over them. */
import { RUNG_LADDER, IRREVERSIBLE_CORRECTION_KEY, RUNG_ABSENCE_GROUNDS, CONSEQUENCE_STATEMENTS, LARGER_SCREEN_ACTS,
         IRREVERSIBLE_WEIGHT, RUNGS, RUNG_ABSENT, MACHINE_REFUSALS, NON_ACTS, phoneOf, OP_ALIASES } from "./op-grades/index.mjs";
/* R39 (T33-85): the new closed vocabularies with the members' words, read at the call from the composed owners. */
import { composedVocabularies, EVENTS_VOCABULARY_KEYS } from "./affordances/words.mjs";
/* R62, R64 (K3366; DEC-253): this module holds no member-facing English; every label, prompt and sentence is a key read through `word`. */
import { word, hasWord } from "./setup-words/index.mjs";

/* R64: an act's name is `act.<id>.name` (`act.<id>.name.selected` for a set act, which names the act over a selection), read
 * through `word`. An act with no such key fails the load by its id, so the plane never publishes an act it cannot name. */
export const actName = (id, selected = false) => {
  const key = `act.${id}.name${selected ? ".selected" : ""}`;
  if (!hasWord(key)) throw new Error(`NO_ACT_NAME: act ${id} has no word ${key}`);
  return word(key);
};

/* The disposition set: the target states op=dispose may write. Every other
 * inquiry state is entered by its own act with its own entry requirements
 * (REC-13/14/16 bring them), never by a bulk flip; the legacy machine's
 * `elevated` is not a state in the inquiry machine at all and the store
 * refuses it BAD_TARGET_STATE. It is ONE array (REC-11), and since T7 it is
 * inquiry's, the module whose op=dispose refuses against it (INQUIRY #1 J2.3),
 * re-exported unchanged so VOCABULARIES publishes the very object the refusal
 * reads (R4, R6). */
export { DISPOSITIONS } from "./inquiry/index.mjs";
import { DISPOSITIONS } from "./inquiry/index.mjs";

/* REC-31 x REC-14, decided at their merge: the states op=reopen picks a
 * question back up FROM. It is the disposition set PLUS `published`, and it is
 * ONE array for the same reason DISPOSITIONS is — the store's refusal and the
 * published act must not be able to disagree about what "reopenable" means.
 *
 * WHY `published` BELONGS HERE AND `concluded` DOES NOT, which is the whole of
 * the distinction and is not a softening of REC-31's rule. That rule refuses
 * reverting a finding WITH NO EDITION RECORDED: a concluded inquiry quietly
 * returning to open still wearing its conclusion leaves nothing behind saying
 * the group changed its mind, which is why `concluded` is refused BY NAME and
 * the edition machinery is where that move belongs. A PUBLISHED case has the
 * opposite property. Its editions are ratified, signed and immutable, and
 * DEC-12 is explicit that reopening does not unpublish: every edition keeps
 * answering with its own signature, attestor, time and gate version. So the
 * hazard the exclusion guards against cannot arise on this edge — there is
 * nothing to erase — while the need is real, because published -> open is the
 * ONLY route to a second edition and an act the catalog permits that no caller
 * can perform is the state machine lying.
 *
 * ONE reopen act, not two: "pick this question back up" is one verb, and a
 * second control meaning the same thing on a different state is exactly the
 * drift this file exists to prevent.
 *
 * ===== CASE-4 / DEC-72, 2026-09-10: `published` LEAVES THIS ARRAY AND THE RULE
 * IT STOOD FOR DOES NOT. Every word of the reasoning above is still true; what
 * is no longer true is that a case-member finding WEARS A STATE. DEC-72 ends the
 * `published` lifecycle state and makes publication THE CASE RELATION, so a
 * published finding now sits at `concluded` — the exact state this array refuses
 * BY NAME. Left alone, that is not a conservative outcome: it would refuse
 * reopening to every published case in the record and leave `op=publish`'s
 * second edition, which DEC-12 requires, with no route to it.
 *
 * So the test in `reopen()` is now a DISJUNCTION and this array is only half of
 * it: reopenable FROM A DISPOSITION (this array, unchanged in meaning), OR
 * BECAUSE THE DOCUMENT IS A CASE MEMBER (the store's own case-relation
 * predicate, which cannot live in this file because it is a query). The
 * `concluded` exclusion is thereby PRESERVED EXACTLY WHERE IT WAS AIMED: a
 * concluded finding that was never published is still refused BY NAME with
 * REC-31's own reason, and only the case relation lifts it. Making the whole of
 * `concluded` reopenable would have been the softening this comment warns
 * against, and it is the over-strictness arm CASE-4's control runs.
 *
 * The array stays exported and stays the refusal's `reopenable:` payload,
 * because it is still the answer to "which states does reopening pick a question
 * up from" — the case relation is not a state and does not belong in it.
 *
 * R6 (N52): the array is promotion's, whose `reopen` refuses against it (its R24), re-exported unchanged. */
export { REOPENABLE_FROM } from "./promotion/index.mjs";
import { REOPENABLE_FROM } from "./promotion/index.mjs";

/* REC-35 (UI-13): a closed vocabulary is published as the array its enforcing module refuses against, never
 * harvested from a refusal's wording; the arrays now live with their owners (R6, below). */

/* 2026-09-14, REC-81: every citation into the content framework in this file
 * names a SECTION rather than a line. The line numbers they carried went stale
 * the moment the framework gained front matter — 89 lines, measured — and
 * CORPUS-STANDARD.md §4.6 rules that a citation into a design document names
 * the SECTION. */

/* R6 (N49): the entity registry's kinds and safeguard 4's three declared-relation predicates are `entities'`
 * (its R2, R3), and a progression stage's closed requiredness vocabulary (framework 8.2) is `progressions'`, each
 * the array its own write path refuses against, re-exported unchanged: the
 * store no longer holds those refusals, and the arrays moved to the modules that do. */
export { ENTITY_KINDS, RELATION_KINDS } from "./entities/index.mjs";
export { STAGE_REQUIREDNESS } from "./progressions/index.mjs";
import { ENTITY_KINDS, RELATION_KINDS } from "./entities/index.mjs";
import { STAGE_REQUIREDNESS } from "./progressions/index.mjs";

/* REC-16 / DEC-29(b): THE DIVIDE PROMPT'S WORDING, and it is an ACCEPTANCE
 * CLAUSE rather than copy.
 *
 * Bob's ruling keeps the contextual prompt — the moment the weakest leg is
 * named is the moment a member can actually act on the structure — and attaches
 * ONE requirement instead of a timing rule: *"the prompt's wording must state
 * the disclosure — that the other question stays on the record and the
 * published child will name it — so what is offered is visibly honesty, not
 * concealment."* The hazard it answers is real and specific: division's visible
 * effect is a HIGHER publishable strength, so a surface offering it beside a
 * weak leg is a surface proposing an act that makes the member's case look
 * stronger, and that is only legitimate because nothing leaves the record.
 *
 * IT LIVES HERE, not in a surface, for DEC-8's reason exactly: a surface
 * renders what it RECEIVED. A prompt that stated the disclosure in one client
 * and not in another would be the forbidden surface-side map, one layer up from
 * the act list this file already publishes. Published on the act, so every
 * surface that can offer the act has the wording that must accompany it, and
 * the suite asserts the string.
 *
 * WHAT IT MUST SAY, and each clause is load-bearing: that NOTHING IS DROPPED
 * (every leg gets a home, including one that cuts against you — the apportionment
 * refuses to lose a leg, which is why division cannot do severance's work at a
 * discount); that THE OTHER QUESTION STAYS ON THE RECORD; and that A PUBLISHED
 * CHILD NAMES ITS PARENT AND ITS SIBLINGS to its readers. */
export const DIVIDE_PROMPT = word("prompt.inquirydivide");

/* REC-45 / DEC-29(b), on REC-16's mechanism exactly: THE GROUPING PROMPT.
 *
 * WHY THIS ACT WARRANTS ONE AT ALL, and the argument is DIVIDE_PROMPT's with
 * the hazard one notch sharper. Division's prompt exists because division's
 * visible effect is a HIGHER publishable strength, so a surface offering it is
 * proposing an act that makes the member's case look stronger. Grouping is the
 * SAME shape and more direct: OR takes the MAXIMUM, so this is the one act in
 * the record that raises a finding's grade without adding a single new piece of
 * evidence. DEC-32 names the hazard in those words — *"a member has a standing
 * incentive to bundle a weak ground beside a strong one and publish at the
 * strong one's grade"* — and names the three things that contain it: the
 * assertion is AUTHORED and carries a name, the compound falsifier is the
 * check, and each group's legs stay VISIBLE so a reader tests sufficiency
 * rather than taking it. Two of those three are mechanism this plane enforces,
 * and they are what this wording states.
 *
 * IT LIVES HERE for DEC-8's reason, unchanged from DIVIDE_PROMPT: a surface
 * renders what it RECEIVED and never composes a prompt of its own, so a
 * sentence that appeared in one client and not another would be the forbidden
 * surface-side map one layer up from the act list.
 *
 * EVERY CLAUSE IS MECHANISM, and that is a deliberate boundary rather than a
 * stylistic one. Each sentence below is a fact about what this plane DOES,
 * checkable against code and asserted clause by clause in the suite: (1) what
 * the field means, in the words checkGrounds' own refusal already uses; (2) the
 * MAX composition in `#axisResult`; (3) the server stamp and its carry-forward
 * rule in `groundInquiry`; (4) the branches surviving redaction and being
 * frozen into signed bytes (`published_strength_grounds` in a member published
 * before BIO_Publication_v0_1.md §3 rule 12, `case_strength_grounds` in the case
 * document since — D-442 — required by C-2.8 either way; the prompt's "a
 * published case carries each group … inside the signed bytes" is true of both);
 * (5) the AND default. NOTHING here states a doctrine the record does
 * not already enforce — REC-45 was scoped to report such a sentence as a DEC
 * candidate rather than write one, and one was reported rather than written
 * (DEC-32's operational test, *"would refuting this alone change the
 * conclusion?"*, which belongs to UI-27's elicitation and not to this act).
 *
 * AND IT CARRIES NO ANALYST VOCABULARY, which is DEC-32 clause 1 and is binding
 * on any member-facing string: no AND, no OR, no disjunction, no branch, and
 * not the word `ground` itself — including in this act's own label. The wire
 * name is `inquiryground` because a wire name is not a surface; the sentence a
 * member reads says GROUP. */
export const GROUND_PROMPT = word("prompt.inquiryground");

/* REC-43 / DEC-39, on REC-16's mechanism exactly: THE CO-ATTESTATION HONESTY
 * FENCE. Third prompt, and the first whose WORDS ARE NOT THIS FILE'S.
 *
 * THE SENTENCE IS BOB'S AND IS TAKEN VERBATIM from the DEC-39 entry. It is not
 * paraphrased, not tightened, and not improved, and that is a rule about this
 * string rather than a courtesy: DEC-39 rules that the fence states GRADE
 * DOCTRINE — what an attestation is worth — so a session rewording it would be
 * a session amending doctrine at a keyboard. If it is wrong, it is amended in
 * DECISIONS.md and this string follows; the drift guards below are built so
 * that a change made HERE and nowhere else is visible rather than silent.
 *
 * THE ONE STRUCTURAL ACCOMMODATION, stated rather than smoothed away. DEC-39
 * renders the wording as a markdown blockquote: three parts, each opened by a
 * bold label, with the question in the first part italicised. `prompt` is a
 * plain string in the published act shape (DIVIDE_PROMPT and GROUND_PROMPT are
 * both single prose strings), so the `**`/`*` markers and the blockquote's line
 * breaks — which are the DECISIONS.md file's RENDERING and not part of the
 * sentence — are not carried. Every WORD, its order, its punctuation and its
 * capitalisation (`TRUE`) are unchanged, and the deliberate three-part shape
 * survives in the three labels the ruling itself wrote. Nothing was added.
 *
 * WHAT THE RULING CORRECTS, because it is the reason the sentence exists and a
 * later reader must not trim it back to the old one. The surface's wording said
 * what co-attestation DOES ("raises Grade B toward evidentiary weight") and what
 * it CANNOT do ("never reaches Grade A") and never said WHAT QUESTION IT
 * ANSWERS — so a reader reaches for it to solve a DIRECTNESS problem it has
 * nothing to do with. Bob's own trial example was a coroner's courtroom
 * testimony held only as a newspaper account: it READ like the co-attestation
 * case and is not one. The first part is what the old sentence omitted, the
 * second is that misreading, the third is the existing fence unchanged.
 *
 * IT LIVES HERE for DEC-8's reason, unchanged from the two prompts above: a
 * surface renders what it RECEIVED and never composes a prompt of its own. The
 * surface authored this sentence until this item (`ATTEST_YIELDS_GRADE` in the
 * interface it replaced), which DEC-39 calls the last member-facing claim about
 * the record's semantics that the record did not own; UI-28 renders the
 * publication and stops writing one.
 *
 * AND THE TWO GRADE LETTERS ARE COMPOSED FROM THE RULE, WHICH IS THE WHOLE
 * POINT OF THE ITEM. `Grade B` and `Grade A` are not typed here: the ceiling is
 * `EARNED_CAPTURE_CEILING`, imported from `record-grammar`, the one definition
 * of the grades that the earned-leg check refuses a leg claiming more than it
 * against, and the unreachable letter is `UNREACHABLE_CAPTURE_GRADE`, the rank
 * of `BASIS_GRADES` immediately above it, defined beside it. So the
 * published sentence is a FUNCTION of the enforced rule rather than a copy that
 * happens to agree with it today — REC-35's finding restated on a sentence
 * instead of an array, and an identical copy would agree at zero cost, which is
 * why the affordances suite's drift guard is STRUCTURAL as well as behavioural.
 *
 * IT REFUSES TO COMPOSE A SENTENCE IT CANNOT MAKE TRUE. If the ceiling were
 * ever raised to the strongest grade there would be no unreachable letter, and
 * "it never reaches Grade null" is worse than no fence at all. That is a load
 * failure, not a fallback: the module fails to evaluate and the whole plane
 * fails to start, which is the only honest outcome for a doctrine string whose
 * doctrine has moved out from under it. */
export const attestFence = (ceiling, unreachable) => {
  if (!ceiling || !unreachable)
    throw new Error("the co-attestation fence states a ceiling AND the grade above it (DEC-39); "
                  + "with no grade above the ceiling the sentence cannot be composed truthfully");
  return word("prompt.attest.fence", { ceiling, unreachable });
};

export const ATTEST_FENCE = attestFence(EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE);

/* R28 (N364; DEC-81 item 3): THE SELF-ATTESTED PROMPT, ON `publish`. A load-bearing Grade B whose co-attestation failed
 * may be published, deliberately and visibly, by the owner's attributed acknowledgement; the case then marks that
 * document "self-attested only". The sentence a member reads before choosing that is DEC-81 item 3's "stated for
 * readers", verbatim, and it is `case-authoring`'s very string (its R36), the one the case document prints beside the
 * mark — so the words offered before the act and the words published by it cannot drift. Not composed here, not
 * copied here. */
export const SELF_ATTESTED_PROMPT = SELF_ATTESTED_SENTENCE;

/* R29 (N364; DEC-78 item 5(d)): THE CONSENT PROMPT, ON `sourceconsent`. Consent to go public is asked at the moment of
 * publishing and stated as permanent: what is published under it stays published, and a withdrawal binds only later
 * publications. The two sentences are `sources'` (its R7), the statements its consent and withdrawal acts answer with,
 * joined, so the prompt says exactly what the act will record and nothing the act does not keep. */
export const CONSENT_PROMPT = `${CONSENT_STATEMENT} ${WITHDRAWAL_STATEMENT}`;

/* N80 (T8): op=acquire's `note` (`acquireGradeNote`, `ACQUIRE_GRADE_NOTE`) is `capture`'s, which composes its own
 * answer from the same two letters and refuses to compose it without both (`capture/acquire.mjs`; K225 (4)).
 * The copy that stood here, REC-48's third statement of the doctrine, left with it: the note is a receipt of the act
 * that captured, and this module publishes what may be done, not what an act answered. */

/* The object vocabularies, published the way op=searchfields publishes the
 * query language, so a surface never keeps a copy. Each is the object its
 * enforcing module refuses against (R4). */
export const VOCABULARIES = {
  /* R26 (N65 (3)): the kinds an action may be created with are `actions'` answer (its R10, R40): the product's own,
     then the active profiles' `action_kinds`. Which profiles are active is an instance's setting, so this module-level
     value is actions' answer with none active (`PRODUCT_KINDS`), and `vocabulariesFor(kinds)` below publishes the
     answer an instance's actions gives at the moment of the call. No kind is held here. */
  action_kind: PRODUCT_KINDS,
  /* D-149. The levels a records request's governing law is stated at, published so the surface that offers
     `op=actionlaws` keeps no copy — `actions'` array (jurisdictions', which it re-exports), which the act's
     refusal (BAD_LAW_LEVEL) and C-2.10 read. */
  law_levels: LAW_LEVELS,
  dispositions: DISPOSITIONS,
  /* REC-14 / DEC-13. Published so a ceremony surface never keeps its own copy
     of the three positions. WHICH position a group takes gates NOTHING —
     nothing in the plane reads it, and a group that deliberately gave no notice
     publishes exactly as one that sought comment and printed the reply. What is
     gated is that the position is declared and justified. */
  subject_positions: SUBJECT_POSITIONS,
  /* REC-37. The roles a leg of a question's basis may carry, published beside
     the widened `cite` act because that act now REQUIRES one and refuses by
     name without it (NO_ROLE / BAD_ROLE). A surface that had to keep its own
     copy of these two words would be the surface deciding what `cuts_against`
     is called, and invariant 7's storage is not a rendering detail. Imported
     from the catalog function that enforces the set — there is one place these
     words live and it is not this file. */
  basis_roles: BASIS_ROLES,
  /* REC-35, UI-13's delegation. The three closed vocabularies of the INTENT
     layer — the entity registry's kinds, safeguard 4's declared-relation
     predicates, and a progression stage's requiredness. They are published for
     the same reason every set above is: a surface that had to keep its own copy
     would be the surface deciding what a `movement` or an `unless_exception` is
     called, and the write path would refuse a token the surface had just
     offered. Each is the array its owning module's refusal validates against —
     imported, never transcribed, so a kind added to the registry appears on
     every surface on its next load and cannot be added to one without the
     other. */
  entity_kinds: ENTITY_KINDS,
  relation_kinds: RELATION_KINDS,
  stage_requiredness: STAGE_REQUIREDNESS,
  /* REC-38, UI-19's measured gap. The action loop's two closed vocabularies —
     what a leg of an action's basis DOES (`rests_on` / `advances`, DEC-14), and
     which way a correspondence entry went (`sent` / `received` / `no_response`,
     DEC-13's non-response recorded as a fact rather than a silence). REC-24
     built both ops and exported both arrays from the check catalogue; neither
     reached here, and the cost was measured rather than argued: UI-19 could not
     offer a basis leg at all, so `request_for_comment` — the ONE kind DEC-13
     requires legs for — had to be filtered out of its own intake, and an action
     could be authored with a counterparty and a kind and nothing it rests on.
     Present-and-refused is what a published vocabulary prevents; absent-and-
     stated is what a surface must do until there is one.
     `actions'` arrays (N65 (3)), against which C-2.10's own findings validate
     (`actionBasisFindings`, `correspondenceFindings`) and whose BAD_DIRECTION
     refusal reads its `legal` list — the same direction `action_kind` above
     takes. One array. */
  action_basis_kinds: ACTION_BASIS_KINDS,
  correspondence_directions: CORRESPONDENCE_DIRECTIONS,
  /* D-147: THE RECORDS-REQUEST LIFECYCLE's closed sets — the stages an entry may state, by direction, and the
     outcomes a decision carries as the body gave it. Published so a surface offers them before a member is
     refused, the REC-39 reasoning below; the SAME objects C-94 judges against. */
  correspondence_stages: CORRESPONDENCE_STAGES,
  correspondence_outcomes: CORRESPONDENCE_OUTCOMES,
  /* REC-39, UI-24's second measured gap and the LAST of the action loop's closed
     sets to reach here. How an action ENDED: C-2.10 requires one of these four
     the moment an action's state is `resolved`, and `op=actionmove` refuses
     NO_RESOLUTION without one.
     WHY PUBLISHING IT IS NOT A CONVENIENCE, and the shape of the gap is worth
     keeping: the words were reachable before this — out of the `legal` list on
     op=actionmove's own NO_RESOLUTION refusal, which is what UI-19's chooser
     reads — so the option set was a property of a REFUSAL rather than of the
     record. A surface could not offer a resolution until the plane had already
     told the member no, and a set that only exists inside a refusal cannot be
     rendered anywhere a refusal has not happened. Published, it is a fact about
     what an action may be, available to a surface that is merely describing the
     act.
     `actions'` array (N65 (3)), against which C-2.10's own finding validates
     and whose NO_RESOLUTION refusal reads its `legal` list — the same direction
     `action_kind`, `action_basis_kinds` and `correspondence_directions` above
     take. One array, three readers. */
  resolutions: RESOLUTIONS,
  /* D-182 (BIO_Case_Making_v0_1.md §2, `risk_tier`, RULED by BOB #21): an action's risk tier IN WORDS — Bob's
     three from the mission of record and the UNDETERMINED that is written wherever no member stated one. A
     code->text map for `sufficiency_claim_states`' reason below: the sentence IS the tier's meaning, and a
     surface holding its own copy would be the surface deciding what tier 2 means, which is why the interface
     could offer no chooser before this. `actions'` map (R26, its R40), against which C-2.10 validates and
     whose `riskTierState()` turns a stored value into one of its keys. One map, three readers. */
  risk_tiers: RISK_TIERS,
  /* PL-2 / IS-2 — THE SIXTH STATE MACHINE, PUBLISHED. §6 rule 4's third
     consequence is not a nicety: without this, every surface that shows a
     version's state holds its own copy of which states exist and which moves
     are legal, and a copy is the DEC-8 drift class this whole file exists to
     close. Published as the machine ITSELF — the state list AND the edge table —
     because a surface that knows only the states must still guess which control
     to offer, and guessing is what produces a control the plane then refuses.
     `version_reason_required` travels with it for the same reason: a surface
     that must ask for a reason before it sends the act cannot know WHEN to ask
     unless the plane says so, and the alternative is a member typing a reason
     into a form that discards it, or worse, an act refused after the fact.
     IMPORTED, never restated: one table, three readers (the catalog defines it,
     the store enforces it, this publishes it). */
  version_states: VERSION_MACHINE.legal,
  version_edges: VERSION_MACHINE.edges,
  version_reason_required: VERSION_REASON_REQUIRED,
  /* FW-14 — THE RUNG LADDER ITSELF, low to high, and the correction path that
     DEC-19 requires to travel with its top rung. Published for the reason every
     vocabulary above is: a surface that renders `rung: "irreversible"` needs to
     know where that sits, and the alternative is every surface holding its own
     copy of the order — the DEC-8 drift class this file exists to close. The
     correction path rides with it because "irreversible" alone is the half of
     DEC-19 that overclaims: a member told an act cannot be undone, and not told
     that correction moves forward, has been misled by the surface.
     Defined once in `op-grades`' `RUNG_LADDER` / `IRREVERSIBLE_CORRECTION_KEY` (its R1), published here by
     reference (K1974). */
  rung_ladder: RUNG_LADDER,
  /* K3369: the correction path is a word key (`op-grades` R1), published as `rung_correction_key`; a reader draws it with `word(key)`. */
  rung_correction_key: IRREVERSIBLE_CORRECTION_KEY,
  rung_absence_grounds: RUNG_ABSENCE_GROUNDS,
  /* `op-grades` R4, R21 (DEC-88 (4), DEC-142): the judgement calls' friction and consequence statement, by act id. */
  rung_consequences: CONSEQUENCE_STATEMENTS,
  /* `op-grades` R21 (DEC-143; K1774): the acts that can never be undone, shown with the Irreversible weight. */
  irreversible_weight: IRREVERSIBLE_WEIGHT,
  /* PL-17 / DEC-65 — THE THIRD `asserted_by` STATE, PUBLISHED WITH ITS WORDS.
     Published for a reason this file can MEASURE rather than assert: the
     interface it replaced rendered a grounding receipt's `Asserted by` field
     VERBATIM, so the moment a field can hold anything but a
     person's name, a surface with no vocabulary prints a machine word at a
     member. That is the defect this whole file closes, arriving in a field
     whose entire subject is not overclaiming.
     A code->text map rather than a list, unlike every vocabulary above it,
     because the states are not interchangeable words a surface picks between —
     each one is a different thing the record is saying about who claimed what,
     and the sentence IS the state's meaning. `sufficiencyClaimState()` in the
     catalogue is what turns a stored value into one of these keys; a surface
     that reads the field itself and matches on the literal has rebuilt the
     predicate. Imported, never restated. */
  sufficiency_claim_states: SUFFICIENCY_CLAIM_STATES,
  /* SK-7 / framework Part II 14.4 (Bob's 5.7) — WHO MARKED A PASSAGE AS
     CITABLE, in words. Published for `sufficiency_claim_states`' reason exactly,
     and the reason is measurable rather than stylistic: `content.minted_by`
     holds an IDENTITY, and from this item that identity can be a machine
     credential's `class:ai/<tokenId>` stamp. A surface with no vocabulary
     renders the stored string, which is how a grounding receipt came to print
     the `Asserted by` field verbatim one field over. So the
     plane answers WHICH STATE the row is in and publishes the SENTENCE for it,
     and no surface invents wording for a distinction 5.7 requires be shown.
     A code->text map, not a list, for the same reason its neighbour is one: the
     four states are not interchangeable words a surface picks between — each is
     a different thing the record is saying about who marked this passage, and
     the sentence IS the state's meaning. `contentMintState()` in the catalogue
     turns a stored value into one of these keys, and a surface that matches on
     the literal `minted_by` has rebuilt the predicate; every content-row
     projection already carries the plane's own answer in its `mint` block. */
  content_mint_states: CONTENT_MINT_STATES,
  /* N345 (R4): what a member offers when a contradiction is clarified, resolved or dismissed — the respects in which
     two sides may differ (K1–K4), the named differences between two projects' conclusions (K5), the kinds a
     resolution records, the canons a conflict of norms is reconciled by, and the reasons a lead is set aside for. Each
     is the array its enforcing module refuses against (CLARIFY_COORDINATE_UNKNOWN, RESOLUTION_KIND_UNKNOWN,
     RESOLUTION_INCOMPLETE, DISMISSAL_REASON_UNKNOWN), so a surface offers a choice before a member is refused it. */
  contradiction_coordinates: CONTRADICTION_COORDINATES,
  plurality_differences: PLURALITY_DIFFERENCES,
  resolution_kinds: RESOLUTION_KINDS,
  norm_canons: NORM_CANONS,
  dismissal_reasons: DISMISSAL_REASONS,
  /* R30 (K921, T21): what a member offers when a template is drafted, filed under and reviewed, and when a local fact
     is acted on and read — each the array its owner refuses against (TEMPLATE_USE_REFUSED, REVIEW_REFUSED,
     FACT_ACT_REFUSED) or answers in (a version's state, a fact's status), so a surface offers a choice before a member
     is refused it. */
  template_states: TEMPLATE_STATES,
  template_uses: TEMPLATE_USES,
  template_review_outcomes: REVIEW_OUTCOMES,
  local_fact_acts: LOCAL_FACT_ACTS,
  local_fact_statuses: LOCAL_FACT_STATUSES,
  /* R34 (N520; DEC-116): what a member offers when an entry is filed for the docket, posted to a shelf or marked as
     pressure — each the array `docket` refuses against (DOCKET_NO_REASON's proposals, DOCKET_KIND_UNKNOWN,
     PRESSURE_REFUSED) or answers in (a public entry's shelf and kind), so a surface offers a choice before a member is
     refused it. */
  docket_shelves: DOCKET_SHELVES,
  docket_entry_kinds: DOCKET_ENTRY_KINDS,
  docket_proposals: DOCKET_PROPOSALS,
  docket_pressure_kinds: DOCKET_PRESSURE_KINDS,
  /* R36 (DEC-122 (1); `op-grades` R18): the acts a phone surface leaves for a larger screen beyond the ladder's own. */
  larger_screen_acts: LARGER_SCREEN_ACTS,
  /* R51 (T45): what a member offers when she overrides on a ground, resolves a pointed-out sentence, notes press terms,
     records a response found elsewhere or a reply's bearing on a claim, notes a promise, says who owes a date and on what
     basis, pauses a plan, states a matter's state, words a harm addressed or sets a project's scope — each the array its
     owner refuses against, so a surface offers a choice before a member is refused it. Escalation states with "stopped
     pursuing" and the links `arose_from` and `cures` are not here: no owner exports them yet (the job's record). */
  override_grounds: OVERRIDE_GROUNDS,
  phrasing_kinds: PHRASING_KINDS,
  assertion_resolutions: ASSERTION_RESOLUTIONS,
  press_record_terms: PRESS_RECORD_TERMS,
  found_elsewhere_kinds: FOUND_ELSEWHERE_KINDS,
  bearings: BEARINGS,
  promise_kinds: PROMISE_KINDS,
  clock_owed_by: CLOCK_OWED_BY,
  clock_basis_kinds: CLOCK_BASIS_KINDS,
  plan_states: PLAN_STATES,
  matter_states: MATTER_STATES,
  addressed_words: ADDRESSED_WORDS,
  project_scopes: ProjectRoster.PROJECT_SCOPES,
};

/* R26 (N65 (3)): the vocabularies an instance publishes, with `action_kind` the kinds its `actions` accepts at the
 * moment of the call (actions R10, R40: `actionsOf(host).kinds()`, the product's own and then the active profiles'),
 * and every other key the same object `VOCABULARIES` holds (R4). Pure: the caller asks actions and hands the answer
 * here. An answer that is not a list of strings is not a kind list, and the product's kinds are published instead
 * (actions' answer with no profile active), never a partial list.
 *
 * R67, R68 (T51): `profile` is the store's answer to `affordancevocab` (./affordances/facts.mjs), what only the instance's
 * active profiles know: `proceeding_kinds`, a list of `{kind, label, forum_kind}` (an entry without a string `kind` left
 * out), and `action_kind_labels`, an object from a profile-defined kind to its non-empty `label`. A key the store did not
 * answer as that shape is left out of the answer, never answered empty, so a surface can tell "none" from "could not ask". */
export function vocabulariesFor(kinds, profile = null) {
  const ok = Array.isArray(kinds) && kinds.length > 0 && kinds.every((k) => typeof k === "string" && k.length > 0);
  const p = profile && typeof profile === "object" ? profile : {};
  const profiled = {};
  if (Array.isArray(p.proceeding_kinds))
    profiled.proceeding_kinds = p.proceeding_kinds.filter((k) => k && typeof k === "object" && typeof k.kind === "string")
      .map(({ kind, label, forum_kind }) => ({ kind, label: typeof label === "string" ? label : null, forum_kind: forum_kind ?? null }));
  if (p.action_kind_labels && typeof p.action_kind_labels === "object" && !Array.isArray(p.action_kind_labels))
    profiled.action_kind_labels = Object.fromEntries(Object.entries(p.action_kind_labels)
      .filter(([, label]) => typeof label === "string" && label.trim().length > 0));
  /* R39: T33's vocabularies, each `{values, words}`, present only where its owner is composed (./affordances/words.mjs). */
  /* R39 (E14): `events` registers in the Durable Object only, so an isolate that has not started it composes none of its
     five; the store's answer carries them, composed where the owner is registered, and fills what this isolate lacks. */
  const composed = composedVocabularies();
  const carried = {};
  const fromStore = p.events_vocabularies && typeof p.events_vocabularies === "object" ? p.events_vocabularies : {};
  for (const k of EVENTS_VOCABULARY_KEYS) {
    const v = fromStore[k];
    if (!composed[k] && v && Array.isArray(v.values) && v.words && typeof v.words === "object") carried[k] = v;
  }
  return { ...VOCABULARIES, action_kind: ok ? kinds : PRODUCT_KINDS, ...profiled, ...carried, ...composed };
}

/* REC-38, UI-22's delegation: THE CAPTURE-DIRECTED ACTS' METADATA, and the
 * SHAPE IS THE WHOLE OF THIS ITEM'S DECISION — stated here rather than in a
 * commit message, because the next session will meet the same fork.
 *
 * THE FORK. `attest` was the last act in this plane whose member-facing label
 * was written by a surface: op=affordances published nothing for it, so
 * the interface it replaced spelled the label itself (UI-22 raised it rather
 * than papering over it). Two ways to fix that. Promote `attest` into ACTS with
 * an applies(), or publish a SEPARATE block for the capture-directed class.
 *
 * PROMOTING IT INTO `ACTS` WAS REJECTED, and not on taste — it would have been
 * DISHONEST in the precise way this file exists to prevent:
 *
 *   (1) THE SUBJECT IS WRONG. Every entry in ACTS is an act on A BUNDLE IN A
 *       GIVEN STATE; that is what the header says and what `deriveActs` is. The
 *       subject of op=attest is a CAPTURE SHA. A capture is not in a state, has
 *       no edges, and can be held by several bundles or by none.
 *   (2) THE DERIVATION HAS NOTHING TO DERIVE FROM. `applies()` is handed
 *       affordanceFacts — object_type, current_state, cites edges,
 *       basis legs. No capture sha is in that shape and no bucket is reachable
 *       from it. The only applies() writable over those facts is
 *       `ty === "information"`, which is NOT what op=attest gates on: it gates
 *       on evidence storage being configured (503), the sha being 64 hex
 *       (BAD_SHA) and THE BYTES ACTUALLY BEING IN THE STORE (NO_SUCH_CAPTURE).
 *       So an information bundle holding no capture would publish the act and
 *       the op would refuse it — a pre-flight disagreeing with the refusal it
 *       fronts, DEC-8's headline failure, arrived at by way of fixing a label.
 *   (3) IT WOULD SPLIT A CLASS. `monitor` is capture-directed for the same
 *       reason and would have stayed behind in NON_ACTS, so the two halves of
 *       one doctrine would sit in two registries with no rule relating them.
 *
 * WHAT IS PUBLISHED INSTEAD, and why it costs nothing to be honest: a block
 * beside `vocabularies` carrying id and LABEL for each capture-directed op —
 * and NOTHING ELSE, because everything else already has a home. `needs`, `mode`
 * and `rung` are composed at the control plane by `decorateAct`, the SAME
 * function every act in ACTS goes through, reading NEEDS, SESSION_OPS and RUNGS
 * — the tables that actually gate the call. That is what makes `RUNGS.attest`
 * reachable: it has been correct and unpublished since REC-19 only because
 * decorateAct ran over ACTS alone.
 *
 * SO THE LABEL IS THE ONLY NEW FACT, and it lives here for DISPOSITIONS' reason
 * exactly — one array, no copy. A surface renders it; a surface does not write
 * it.
 *
 * THESE STAY IN `NON_ACTS`. They are not object-directed acts and publishing
 * their metadata does not make them ones; the totality guard over NEEDS is
 * unchanged. What the suite adds is the OTHER totality — every NON_ACT whose
 * reason begins `capture-directed:` appears here, and nothing else does — so a
 * third capture-directed op cannot ship with no label either.
 *
 * A PROMPT NOW, AND THE PARAGRAPH THIS REPLACES WAS RIGHT WHEN IT WAS WRITTEN.
 * CORRECTED 2026-08-04 by REC-43 / DEC-39, stated rather than quietly reworded
 * because the reasoning it recorded is the reasoning that produced the ruling.
 * REC-38 wrote here that `attest` carries NO PROMPT deliberately — that the
 * co-attestation honesty fence was "a real candidate for DEC-29(b)'s `prompt`
 * treatment" but was NOT invented here, because no ruling attached it to the
 * act, the surface's own sentence is not a source, and guessing at one is what
 * RUNGS (`op-grades`) refuses. That refusal was correct and it is what routed
 * the question to Bob. DEC-39 answered it — PUBLISH IT, AND IT MUST STATE THE
 * QUESTION CO-ATTESTATION ANSWERS — so the act now carries `ATTEST_FENCE`, whose
 * words are Bob's and whose two grade letters are the enforced rule's. Nothing
 * about the RUNGS reasoning changes: `rung` here is still the sourced
 * `attested` and no rung is guessed anywhere in this file. */
export const CAPTURE_ACTS = [
  /* op=attest. The verb is "co-attest" because the group is not the only
     attestor: the plane asks an independent timestamp authority and stores what
     it returns. The object is THE CAPTURE and the label says so — attesting the
     bundle would be the claim we cannot make. */
  /* THE FENCE RIDES THE ACT (DEC-39, on DEC-29(b)/REC-16's mechanism): every
     surface that can offer co-attestation receives the wording that must
     accompany it, so the sentence cannot appear in one client and not another.
     The words are Bob's and the grade letters are the enforced rule's — the
     reasoning is on ATTEST_FENCE itself, where both consumers read it. */
  { id: "attest", label: actName("attest"), prompt: ATTEST_FENCE },
  /* op=monitor. One tick: re-fetch the source's locator and compare what it
     serves NOW against the bytes the provenance register says were captured
     from it. The label names the comparison rather than promising a watch — a
     tick is a check, and `unchanged` / `modified` / `removed` are its answers.
     NO RUNG, AND THE ABSENCE IS NOW STATED RATHER THAN LEFT BLANK (FW-14):
     `RUNG_ABSENT.monitor` carries the ground `observational` — the act records
     what was OBSERVED and not what anybody decided, so there is nothing to
     reverse; an observation is corrected by observing again. The sentence this
     replaces said "no document assigns one, and RUNGS carries only the sourced
     seven", which was true and is no longer the reason. */
  { id: "monitor", label: actName("monitor") },
  /* op=attesttext (CPDF-10). Capture-directed for `attest`'s reason exactly —
     the subject is a CAPTURE SHA and an extent within it, not a bundle in a
     state — so it lands here rather than splitting the class, which is the
     third reason PROMOTING `attest` INTO `ACTS` was rejected above.
     THE LABEL NAMES THE COMPARISON AND THE SCOPE, because both are the act.
     "Confirm" would be wrong: nothing is being approved. A member is saying
     they looked at the image and the text agrees with it, over the part they
     actually looked at — and a leg citing outside that part does not inherit
     it. A label that hid the scope would invite exactly the over-reading the
     extent exists to prevent.
     RUNG `reasoned` (DEC-88, K1038): the attestor's note on what they compared is
     required (content R43, ATTEST_NO_NOTE). It was `undetermined` until then, and
     `attested` was tried first and REFUSED (CPDF-10): it requires no authority the
     group does not hold alone. No rung is guessed anywhere in this file. */
  { id: "attesttext", label: actName("attesttext") },
];

/* One legal-edge lookup, over the IMPORTED table, THROUGH the catalog's own
 * vocabulary machinery (REC-10's normalisation, fifth consulting site): the
 * state-alias handling (`surfaced` a legal alias of `open`) is the TABLE'S OWN,
 * never a copy here.
 *
 * CORRECTED BY REC-13, and the correction is the MAP RULE itself. This took the
 * already-NORMALIZED type, which defeated the whole point of vocabFor: that
 * function resolves the DECLARED spelling first precisely because the inquiry
 * collapse CHANGED the vocabulary, and a legacy focus/problem document is
 * judged by the contract it was authored under. Handing it `inquiry` for a
 * `focus` document asked the wrong machine. It was invisible while the two
 * machines agreed on every state an act cared about; `concluded` is the first
 * state they DISAGREE about, and the defect it would have produced is the one
 * DEC-8 exists to forbid — op=affordances publishing `conclude` for a document
 * the store then refuses ILLEGAL_TRANSITION, a pre-flight disagreeing with the
 * refusal it fronts. So the DECLARED type is what reaches the map, and
 * `object_type` (normalized) still answers the membership questions below. */
const edgesFrom = (f) =>
  (vocabFor(STATES, f.declared_type ?? f.object_type)?.edges?.[f.current_state]) || [];

/* A count fact read as a number (R14, R16: facts are counts). An array — a hand-built facts object may still carry
 * ids — reads as its length; anything else as null, which never narrows an act (R10): `retire`'s "no confirmed
 * citation into it" is withheld only on a stated count above zero, and an act that needs at least one of something
 * is offered only on a stated count. */
const countOf = (v) => typeof v === "number" && Number.isFinite(v) ? v : Array.isArray(v) ? v.length : null;

/* PL-2 / IS-2. `edgesFrom` one construct down: does ANY reading this question
 * holds have a legal move to `to`, according to the SIXTH state machine's own
 * edge table? The table is `VERSION_MACHINE`'s and there is no copy here.
 *
 * WHY *ANY* AND NOT *ALL*, which is the honest reading and not a weakening: a
 * question holds several readings at once and they are in different states, so
 * the answer to "may this act be taken here" is "yes, on at least one of them" —
 * exactly as op=dispose is published when the machine offers a disposition edge
 * without promising that this caller's parameters will pass. WHICH reading is
 * the act's own parameter, and the store refuses one that cannot make the move
 * by name (C-25.25), naming the legal set it could have made. */
const anyVersionEdgeTo = (f, to) =>
  (f.basis_version_states ?? []).some((s) => (VERSION_MACHINE.edges[s] || []).includes(to));

/* The facts shape is `affordanceFacts()` (./affordances/facts.mjs, R14): object_type (NORMALIZED, for
 * membership), declared_type (the document's own spelling, for vocabulary —
 * REC-13), current_state, cites_in {confirmed, severed} (COUNTS of the edges INTO an
 * information target, read the way retire reads them — severed is not live),
 * cites_out {confirmed, severed, severed_reinstatable} (a project's own
 * citation edges by status, and — D-444 — how many of the severed ones could
 * actually be put back, asked through the same `#retiredNotCitable` predicate
 * `#edgeTransition` refuses on, because a bare count cannot say whether a
 * target has since been RETIRED),
 * basis_legs (REC-16: how many legs this question rests on), and rested_on
 * {working, frozen, severed} (REC-17: how many live basis legs rest ON it, by
 * whether the dependent can still withdraw one — COUNTS and never ids, because
 * this answer is about the target and naming its dependents would be §7.9's
 * reverse walk by a new door), and (N345) contradiction_inquiry (whether an
 * inquiry's document carries `contradiction`: `conclude` or `contradictionresolve`), and (N365)
 * contradiction_sides_seen (whether the viewer sees both sides of the candidate it names: `contradictionresolve`), and
 * (R55) legs_in {live, severed} (how many questions the viewer may see hold a leg on an information target, by the leg's
 * status: a question's own leg is severed and reinstated by `sever` and `reinstate`, citation R15). */
export const ACTS = [
  /* S-11 step 5. collected -> verified is the one legal edge; the named-member
     and entry-requirement guards are act-time refusals the store words itself. */
  { id: "release", label: actName("release"), weight: "refuse", types: ["information"],
    applies: (f, ty) => ty === "information" && edgesFrom(f).includes("verified") },
  /* S-11 step 4. verified -> retired, AND nothing with a live cites edge: the
     same predicate the store's CITED refusal runs (#citesInto). A severed edge
     is a recorded decision to stop relying, so it does not block. */
  { id: "retire", label: actName("retire"), weight: "refuse", types: ["information"],
    applies: (f, ty) => ty === "information" && edgesFrom(f).includes("retired")
                     && !(countOf(f.cites_in?.confirmed) > 0) },
  /* S-11 step 3. An inquiry (né focus/problem — the type reaches here through
     normalizeType, so all three spellings land on this arm) may be
     dispositioned while the state machine offers a disposition edge; the
     disposition SET itself is in VOCABULARIES. */
  /* REC-17 / D-5 DELIBERATELY DOES NOT NARROW THIS ACT, and the reason is the
     release precedent rather than an oversight. Dismissal of a cited inquiry is
     now refused CITED — but `dismissed` is a PARAMETER of this act, not the
     act: `deferred` is the other target state, it is reversible, and it stays
     legal over a cited question (it raises the re-evaluation obligation instead
     of refusing). Publishing the act says the state machine permits the move,
     not that this caller's parameters will pass, which is exactly what release
     and conclude already say here. Narrowing it would unpublish DEFER on the
     one question a member most wants to defer. */
  /* CASE-4 / DEC-72, 2026-09-10: `!f.case_member`, and it restores a rule rather
     than adding one. The STATES table's own comment has said since REC-14 that
     `published -> deferred|dismissed` is DELIBERATELY not an edge — *"Ageing is
     what happens to a finding NOBODY published (D-79); a published case cannot
     quietly stop being worked on, because it is already out in the world."* The
     edge table was the enforcement; DEC-72 moves a case member to `concluded`,
     which DOES carry the disposition edges, so the rule had to become a
     condition. The store refuses PUBLISHED_CANNOT_BE_SET_DOWN by name, and this
     clause is what keeps the pre-flight from offering what that refuses. */
  { id: "dispose", label: actName("dispose"), weight: "refuse", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && !f.case_member
                     && DISPOSITIONS.some((d) => edgesFrom(f).includes(d)) },
  /* REC-13. An inquiry whose machine offers the `concluded` edge — `open`, and
     its `surfaced` alias, and nothing else. Weight `single`, the first act
     published that is NOT selection-backed: one conclusion answers one
     question, so there is no set to apply and no set-application weight to
     report (basis-versions' conclude carries the reasoning; the suite cross-checks
     the word against what the op itself returns). RUNG `reasoned` (FW-14) —
     AND THE SENTENCE THIS REPLACES WAS RIGHT WHEN IT WAS WRITTEN, so it is
     corrected rather than deleted. It read: "NO RUNG: no document assigns one …
     inventing 'reasoned' here because it feels reasoned is exactly the guessing
     this file refuses." That refusal was correct — REC-19 had no licence to
     assign — and the rung is NOT assigned now because it feels reasoned. It is
     assigned because the store REFUSES the act NO_CONCLUSION and NO_FALSIFIER
     without an authored account, which is Constructs:161's definition of the
     rung enforced in code. The suite asserts that backing. The entry requirements (a conclusion, a falsifier, at least
     one basis leg) and the named-member rule are ACT-TIME refusals the store
     words itself, the release precedent: publishing the act says the state
     machine permits the move, not that this caller's parameters will pass.
     CORRECTED 2026-09-17 (REC-117), AND THE RUNG SURVIVES THE CHANGE THAT
     BROKE THE SENTENCE. Bob ruled NO_FALSIFIER overridable, so `store.conclude`
     no longer refuses it unconditionally: a member may conclude with no
     falsifier by DECLARING the absence, which the record then carries in their
     name and with a date. The sentence above is left standing because it is
     still true of NO_CONCLUSION — which is refused unconditionally and has no
     override — and REC-76's finding is what makes that enough: the rung is
     graded by the FAMILY (`op-grades`' JUSTIFICATION_REFUSALS, its R1) and
     never by one spelling, so an act that still demands an authored account for
     WHAT was concluded is still `reasoned`. What the override changes is the
     ACCOUNT the member must give, never whether one is required: stating that
     no falsifier can honestly be given IS the authored account, and it is
     attributed. The one thing that would drop this rung is an override the
     plane could take SILENTLY, and that is the case C-2.8 and the store both
     refuse by name.
     REC-142 / INVESTIGATIVE-SESSION.md §7.1 item 8 — THE PROJECT ARM, and it is the store's own
     condition read from the other side. `store.conclude` accepts a PROJECT's conclusion on a
     question whose OWN state already reads `concluded` (REC-124: that state is the no-project
     relationship's, and one relationship's conclusion must not bar another's), but the edge table
     has no `concluded -> concluded` edge, so keyed on it alone the act the store accepts was never
     published there — the surface renders only what the plane publishes (DEC-8), and §7.1 item 8
     was honoured by the store and unreachable by a member (UI-65's DELEGATION).
     ONE ACT, NOT A SECOND ID (decided on REC-142's claim): the relationship is `project=`, the
     act's PARAMETER, as `withdrawconclusion` and `versioncurrent` leave WHICH project to theirs.
     `concludes_for_project` is the positional fact (D-310's shape) — the caller has JOINED some
     project it can see that live-cites the question — so a stranger, an invited member who never
     joined, an administrator who joined none (seeing it whole if discoverable, D54), and a machine credential
     (null) are not offered what the store would refuse them for every `project=` they could name.
     NO EDGE IS ADDED, AND THAT IS THE LIAR THIS REFUSES: a `concluded -> concluded` edge would
     publish the act to everybody and let the NO-PROJECT relationship conclude twice, re-opening a
     conclusion to itself. `conclude-project-arm.test.mjs` asserts both, through the op. */
  /* N345 (R8): NOT ON A CONTRADICTION INQUIRY. Its conclusion must carry the kind the conflict turned out to be
     (inquiry R47: RESOLUTION_MISSING at every door), which `conclude` does not ask, so it is withheld there and
     `contradictionresolve` below is offered instead. `=== true`: a null (a hand-built facts object) narrows nothing. */
  { id: "conclude", label: actName("conclude"), weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && f.contradiction_inquiry !== true
                     && (edgesFrom(f).includes("concluded")
                         || (f.current_state === "concluded" && f.concludes_for_project === true)) },
  /* N345 (R8; contradiction R36): RESOLVE a contradiction inquiry — its conclusion with the kind of resolution the
     conflict turned out to be. Offered where `conclude` would be on such an inquiry, by its state machine's arm: the
     act concludes the question itself through basis-versions' `conclude` WITHOUT a project (its R16), so it takes
     the edge to `concluded` and has no project arm (a question already concluded is ILLEGAL_TRANSITION there). Only on
     a STATED `true`: a null never widens. Which kind, the conclusion and the reading are the act's parameters, refused
     by name — the release precedent. Weight `single`: one question is resolved at a time. RUNG `reasoned`. */
  /* N365 (R8): AND NOT WHERE THE VIEWER CANNOT SEE BOTH SIDES. `resolve` refuses NOT_A_CONTRADICTION_INQUIRY to a
     viewer who cannot see every bundle each side of the linked candidate lives in (contradiction R36, C-93.27), and
     `contradiction_sides_seen` is that very check (its R56). `!== false`: a null (a hand-built facts object) narrows
     nothing (R10). */
  { id: "contradictionresolve", label: actName("contradictionresolve"),
    weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && f.contradiction_inquiry === true && edgesFrom(f).includes("concluded")
                     && f.contradiction_sides_seen !== false },
  /* REC-31. An inquiry the group SET DOWN, whose own machine offers the way
     back to `open`. TWO conditions and no third: the FROM state is in the
     published DISPOSITIONS array — the one array that says what "set down"
     means, the same one op=dispose writes INTO — and the catalog's edge table
     offers `open` from there. There is NO SECOND EDGE SOURCE and no state
     list local to this file; a legacy focus/problem document is excluded by
     the table itself, because its own vocabulary spells its open state
     `surfaced` and has no `open` edge at all.
     WHY THE DISPOSITION SET AND NOT THE WHOLE EDGE TABLE: `concluded -> open`
     is ALSO legal (REC-13 added it — a conclusion is revisable), and it is
     NOT this act. DEC-12 makes reopening a conclusion an EDITION, and REC-14
     builds that machinery; publishing `reopen` on a concluded inquiry would
     put a control on the strip that reverts a published finding with no
     edition recorded, which is the DEC-8 disagreement in the worse direction
     — a publication the store then has to refuse. The store refuses it by
     name (NOT_SET_DOWN) and this list does not offer it. Weight `single`: one
     question is picked back up at a time. RUNG `reasoned` (FW-14) — the line
     this replaces said "rung null for conclude's reasons … no document assigns
     this act a rung", which was true of REC-19 and is superseded by the same
     derivation conclude's is: the store refuses NO_REASON, so an authored
     account is REQUIRED and the rung is that requirement stated.
     EXTENDED AT THE REC-14 MERGE, and the exclusion above is UNCHANGED: the
     FROM set is REOPENABLE_FROM, which adds `published` and still refuses
     `concluded`. A published case's editions are signed and immutable and
     reopening does not unpublish them (DEC-12), so the "reverts a finding with
     no edition recorded" hazard this act was scoped around cannot arise there
     -- and published -> open is the only route to a second edition. The
     reasoning is on REOPENABLE_FROM itself, where both consumers read it. */
  /* CASE-4 / DEC-72, 2026-09-10: THE DISJUNCTION, AND IT MIRRORS `reopen()`'s
     GATE EXACTLY — that is the requirement rather than a coincidence, since a
     pre-flight that could disagree with the refusal it fronts is DEC-8's
     failure. The store now permits reopening from a disposition OR because the
     document is a member of a published case; `REOPENABLE_FROM` lost
     `published` with the state, and `edgesFrom` alone would offer this act on
     EVERY concluded finding, which the store refuses NOT_SET_DOWN with REC-31's
     own reason. */
  { id: "reopen", label: actName("reopen"), weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry"
                     && (REOPENABLE_FROM.includes(f.current_state) || !!f.case_member)
                     && edgesFrom(f).includes("open") },
  /* REC-14. An inquiry whose machine offers the `published` edge — which is
     `concluded` and nothing else, because a material set cannot be asserted
     over a question with no conclusion. Weight `single`, conclude's precedent:
     one case is published at a time and there is no set to apply.

     RUNG `irreversible` — THE LADDER'S TOP RUNG, AND THIS IS THE ONE OP THAT
     CARRIES IT (DEC-19 as amended, Bob 2026-08-03: *"Publishing IS an
     irreversible act! It's (one of?) the only irreversible acts."*). The
     correction path travels with it and is published as
     `vocabularies.rung_correction_key`, never instead of the rung: a further
     edition is a separate document and every published edition stands, a
     withdrawal is another attested act and both stand, and a finding can be
     rescinded to an inquiry by removing its claim. Nothing is erased.

     THE PARAGRAPH THIS REPLACES WAS RIGHT WHEN IT WAS WRITTEN AND IS KEPT IN
     SUBSTANCE, because its distinction is the one that makes this rung correct
     rather than lucky. It read: "publishing feels like the most `attested` act
     in the system, and `ratify` IS assigned that rung by Constructs:275. But
     this act is not the attestation — it AUTHORS the bytes that are then
     attested … Inventing 'attested' here because it sits next to ratify is
     exactly the guessing this file refuses." That is still true, and it is why
     `publish` is NOT `attested`: it is a rung ABOVE, on a ruling that names it,
     not a rung borrowed from its neighbour.

     The entry requirements (the completeness statement, the exclusion FIELD,
     the declared and justified subject position) and C-21.1's freshness check
     are ACT-TIME refusals the store words itself — the release precedent:
     publishing the act says the state machine permits the move, not that this
     caller's parameters will pass.

     `!f.case_member` IS THE OTHER HALF AND IT IS NOT NEW BEHAVIOUR. Before
     CASE-4 a member of a published case wore `current_state: published`, whose
     edge list carried no `published` destination, so the act was already not
     offered there — and `op=publish` would already have refused it, since
     publishing an unchanged member would mint a second edition of bytes nobody
     revised. The condition is now said instead of falling out of the table. A
     member that HAS been revised (reopened, worked, concluded again) is no
     longer pinned, so `case_member` is false and the act reappears — which is
     exactly DEC-12's second-edition route.

     CASE-4 / DEC-72, 2026-09-10: `edgesFrom(f).includes("published")` WAS THE
     PRECONDITION WEARING A STATE MACHINE'S CLOTHES, and it is now the
     precondition itself. There is no `published` destination in the inquiry
     machine any more, so that expression is FALSE FOR EVERY DOCUMENT — the act
     would have vanished from every affordance answer with the suite green,
     which is the failure mode a state removal produces if nobody looks. The
     condition was only ever true from `concluded` (it was `concluded`'s edge and
     no other state's), so `concluded` IS the expression, said plainly. This is
     the affordance-layer half of the same sentence `publishCase()`'s
     NOT_CONCLUDED refusal carries, and the two must agree: an act this file
     offers that the store then refuses is the pre-flight lying, which is the one
     thing affordances.mjs exists to prevent.

     D-310, 2026-09-10: `f.project_owner !== false` IS THE FOURTH CONDITION, AND
     IT IS THE ONE THIS ACT WAS MISSING RATHER THAN A NEW RULE. DEC-72 clause 5
     — *"Only a project OWNER publishes"* — has been enforced in `publishCase()`
     since CASE-2, which refuses a non-owner BY NAME (`NOT_THE_PROJECT_OWNER`).
     This predicate had no condition on who is asking, so a member who owns no
     project was offered publication on every concluded finding and would be
     refused at the act: the DEC-8 disagreement this file's header calls the one
     thing it exists to prevent, on the heaviest act in the system. CASE-6 found
     it while reading the op path the publication surface calls, and deliberately
     did not half-fix it inside a surfaces item.
     `!== false` AND NOT `=== true`, WHICH IS THE WHOLE OF THE SHAPE. The fact is
     three-valued and the third value is STATED: a machine-class credential holds
     no roster position, so the store answers `null` rather than `false`, and a
     null does not narrow. A machine credential's published act set is therefore
     unchanged by this clause — it is refused publication by a different rule at a
     different level (`MACHINE_CANNOT_PUBLISH`, DEC-49's fence, first in
     `publishCase()`), and a gate that quietly absorbed that second rule would be
     a fence tighter than its rule. Undetermined is first-class here as everywhere.
     AND IT IS "OWNER OF SOME PROJECT", deliberately. The project is a PARAMETER
     of `op=publish`; this file is asked about an INQUIRY and cannot know which
     project a caller will name, so the act says what every act here says — the
     record permits the move, not that this caller's parameters will pass — while
     no longer saying it to somebody for whom NO parameter could succeed. The
     per-pair question (may this viewer publish for THIS project) is a different
     fact and a different item, D-311, recorded at NON_ACTS' participation block.
     D-311, 2026-09-23: A MACHINE IS NOW WITHHELD `publish`, AND NOT BY THIS CLAUSE. The null above
     still does not narrow here; `deriveActs` withholds every act in `MACHINE_REFUSALS` from a caller
     the store states `actor_is_machine`, because `publishCase()` refuses that class BY NAME
     (MACHINE_CANNOT_PUBLISH) whatever its position. Two rules, two places — which is what this
     paragraph asked for — and the machine's is now published instead of discovered at the act. */
  /* REC-135 / INVESTIGATIVE-SESSION.md §7.1 item 4, 2026-09-19: `concluded` IS
     ASKED OF A RELATIONSHIP, SO THE STATE WORD IS NO LONGER THE WHOLE OF IT.
     `op=conclude&project=` writes the project's adoption onto the PROJECT and
     deliberately leaves the shared question's own state where it was (§7: one
     team's decision never moves another's). So a member whose team HAS concluded
     a shared question sees `current_state: open` on it, and this predicate — the
     affordance-layer half of publishCase()'s NOT_CONCLUDED sentence, which the
     paragraph above says the two must AGREE on — would have gone on hiding the
     act from exactly the member item 4 exists for.
     A DISJUNCTION AND NOT A REPLACEMENT, because both relationships publish: the
     no-project conclusion in a question's own bytes still admits a case (item 5
     reads it as the no-project relationship's and the case document now SAYS so),
     and `concluded_for_project` adds the project's own. `=== true` is the whole
     of the three-valued handling: a machine-class credential answers null there,
     does not widen, and keeps its own fence (MACHINE_CANNOT_PUBLISH). */
  /* REC-157 / INVESTIGATIVE-SESSION.md §7.1 item 9, 2026-09-21: `!f.case_member`
     IS NO LONGER THE WHOLE OF THE MEMBERSHIP HALF EITHER. It is the affordance-layer
     half of publishCase()'s ALREADY_A_CASE_MEMBER, and that refusal now asks the
     RELATIONSHIP too: a finding a case pins at its current bytes may still take a
     new edition when a joined project's conclusion has moved since every edition
     pinning those bytes (a withdrawal, then a conclusion on another reading, never
     moves the finding's bytes). Without this disjunct the store would accept that
     edition and the surface would never offer it — REC-142's defect shape, the
     route reachable by the raw op and by no member (Q12/DEC-8).
     A DISJUNCTION AND NOT A REPLACEMENT, REC-135's reason: `!f.case_member` still
     offers every finding no case pins, and `edition_warranted_for_project` is asked
     only of the ones a case does. `=== true` is the whole of the three-valued
     handling, as above: a null never widens. `case_member` itself is unchanged and
     so is every other act derived from it — reopen, dispose, inquiryground and
     inquirydivide ask whether these BYTES are frozen in a case, which a moved
     conclusion does not change. */
  /* R5, R28 (N364; DEC-81 item 3): THE SELF-ATTESTED PROMPT RIDES THE ACT, DIVIDE_PROMPT's mechanism. A case may rest on
     a load-bearing capture whose co-attestation failed, published by the owner's acknowledgement and marked
     "self-attested only"; every surface that offers publication receives the reader sentence that mark carries. */
  { id: "publish", label: actName("publish"), weight: "single", types: ["inquiry"],
    prompt: SELF_ATTESTED_PROMPT,
    applies: (f, ty) => ty === "inquiry"
                     && (f.current_state === "concluded" || f.concluded_for_project === true)
                     && (!f.case_member || f.edition_warranted_for_project === true)
                     && f.project_owner !== false },
  /* REC-16. An inquiry whose machine offers the `divided` edge — `open`, its
     `surfaced` alias, and `concluded` — AND WHICH RESTS ON SOMETHING. Weight
     `single`, conclude's precedent: one question is divided at a time.
     WHY THE BASIS COUNT IS PART OF THE DERIVATION AND NOT A DETAIL. The
     apportionment refuses to lose a leg and refuses to leave a child with
     nothing, so a question resting on ZERO legs cannot be divided at all —
     there is nothing to apportion, both children would inherit nothing, and the
     store refuses it NO_APPORTIONMENT. Publishing the act there would be
     precisely the DEC-8 disagreement: a pre-flight offering a control the
     refusal it fronts would then decline. ONE leg IS enough, and deliberately:
     two different questions may rest on the same document, and R4 permits a leg
     to land on one child or on BOTH.
     RUNG `reasoned` (FW-14): the store refuses NO_REASON, one authored reason
     per division (DEC-29), so the requirement Constructs:161 names is enforced
     here and the rung states it. THE OBSERVATION THIS REPLACES IS KEPT BECAUSE
     IT IS STILL THE RIGHT ANALYSIS AND IT DECIDED THE RUNG: "it is tempting to
     write `terminal` here because the parent never moves again — but the parent
     is corrected FORWARD into its children rather than ended, which is not what
     the ladder's `terminal` says." `terminal` is reserved for a state with no
     outgoing edge (op=retire alone); forward correction is not terminality, and
     that distinction is exactly why this act sits at `reasoned` and not above
     it.
     THE PROMPT rides the act (DEC-29(b)): every surface that can offer division
     receives the wording that must accompany it, because a surface renders what
     it received and never composes a prompt of its own. */
  /* THIRD CONDITION, ADDED BY REC-17 / D-5, and it is retire's condition
     one altitude up: division is TERMINAL for the parent, so it refuses CITED
     while a WORKING inquiry's live basis leg still rests on the question — and
     a pre-flight offering a control the refusal it fronts would decline is the
     DEC-8 disagreement this file exists to prevent. `rested_on.working` and not
     `.frozen`: a PUBLISHED dependent's basis is inside a signed edition and
     cannot withdraw a leg, so the store deliberately does not refuse on it (the
     reasoning is at divide()'s guard, where both consumers of the distinction
     can read it), and unpublishing the act here would disagree in the other
     direction. ONE predicate behind both, as with retire and #citesInto. */
  /* FOURTH CONDITION, ADDED BY CASE-4 / DEC-72, 2026-09-10, AND IT IS NOT A NEW
     RULE — IT IS AN OLD RULE THAT LOST ITS CARRIER. `op=inquirydivide` has
     refused PUBLISHED_CANNOT_DIVIDE since REC-16, and this predicate did not
     need to say so, because a published case wore `current_state: published`
     whose edge list has no `divided` in it — `edgesFrom` did the work. DEC-72
     ends that state: a case member sits at `concluded`, and `concluded` DOES
     carry the `divided` edge. So without this clause the act is offered on every
     published case and the store then refuses it, which is DEC-8's headline
     failure and was caught by `divide.test.mjs`'s own DEC-8 arm rather than
     reasoned about in advance. */
  { id: "inquirydivide", label: actName("inquirydivide"), weight: "single", types: ["inquiry"],
    prompt: DIVIDE_PROMPT,
    applies: (f, ty) => ty === "inquiry" && edgesFrom(f).includes("divided")
                     && !f.case_member
                     && countOf(f.basis_legs) >= 1
                     && !(countOf(f.rested_on?.working) > 0) },
  /* REC-45 / DEC-32: AUTHORING THE STRUCTURE. An inquiry that RESTS ON
     something, and whose record is still working.

     WHY THE LEG COUNT IS PART OF THE DERIVATION and not a detail, exactly as it
     is for division above: a partition is a partition OF THE LEGS, so a
     question resting on nothing has nothing to group and the store refuses it
     NO_BASIS. Publishing the act there would be a pre-flight offering a control
     the refusal it fronts would decline, which is the DEC-8 disagreement this
     file exists to prevent. ONE leg IS enough and deliberately so: a member may
     legitimately say that the single thing they have is enough on its own, and
     the act is also the only route BACK to an ungrouped basis.

     THE TWO STATES IT IS NOT OFFERED IN, and the store refuses each BY NAME so
     a caller that arrives anyway is told which rule it met.  `published`: the
     composed pair and the per-group breakdown are inside signed, ratified bytes
     (REC-14/REC-42), and re-partitioning underneath them would change what the
     document's own basis composes to while an edition on the record says
     otherwise — DEC-12's route is reopen, restructure, republish, which is the
     same shape PUBLISHED_CANNOT_DIVIDE takes one act over.  `divided`: the
     parent has been declared MALFORMED and carried forward into children that
     supersede it (REC-16), and re-deriving a terminal parent's strength after
     the fact would move a number its children's disclosure already pointed at.

     RUNG `reasoned` (FW-14). The line this replaces said "it is tempting to
     write `reasoned` here; that is the guessing this file refuses" — and the
     temptation is no longer what decides it: `groundInquiry` refuses NO_REASON,
     so an authored account is REQUIRED by the store and the rung is that
     enforcement stated rather than a feeling about the act's weight.

     WEIGHT `single`, conclude's precedent: one question's structure is authored
     at a time, and a bulk version would be the checkbox these constructs exist
     to refuse — the more so here, because this is the act that RAISES a grade.

     THE PROMPT RIDES THE ACT (DEC-29(b), REC-16's mechanism): every surface
     that can offer grouping receives the wording that must accompany it. The
     reasoning for why this act warrants one, and for the vocabulary bound every
     clause of it respects, is on GROUND_PROMPT itself.

     THE ENTRY REQUIREMENTS ARE ACT-TIME REFUSALS the store words itself — a
     reason on a RESTRUCTURE, a partition that is total, a label with an
     attributed row — the release precedent: publishing the act says the record
     permits the move, not that this caller's parameters will pass. */
  { id: "inquiryground", label: actName("inquiryground"), weight: "single", types: ["inquiry"],
    prompt: GROUND_PROMPT,
    /* CASE-4 / DEC-72: `f.current_state !== "published"` became
       `!f.case_member`. The exclusion is unchanged in meaning — a member of a
       signed edition cannot be restructured, and `op=inquiryground` refuses it
       PUBLISHED_CANNOT_RESTRUCTURE — but the state word is gone, so a predicate
       still naming it would offer this act on every published case and the op
       would then refuse it. That is a pre-flight disagreeing with the refusal it
       fronts, which is DEC-8's headline failure and the one thing this file
       exists to prevent. `divided` is untouched: it is still a state. */
    applies: (f, ty) => ty === "inquiry" && countOf(f.basis_legs) >= 1
                     && !f.case_member && f.current_state !== "divided" },
  /* S-10/S-11 step 1: citing. Published for BOTH ends, because the store's own
     guards are type-only on both: any information bundle may be cited (cite
     checks the member's TYPE and, since D-168, ONE fact about state: a RETIRED
     one is refused, so it is not published on one — see the entry below; this
     sentence said "citing retired material is permitted" until 2026-09-23),
     and any citing object may cite.
     Deriving a narrower answer here than the op gives would be this file
     inventing a rule the plane does not enforce.

     REC-37 ADDS THE THIRD TYPE, and it is the one that makes a record become a
     case: a QUESTION may cite, and what lands on it is a leg of the basis its
     answer rests on rather than a citation edge. An inquiry also appears here
     as a MEMBER — a leg may point at another question (basis recursion, DEC-23)
     — which is the same widening read from the other end. The store refuses a
     citing object that is neither NOT_A_PROJECT and a member that is neither
     NOT_CITABLE, and this entry publishes exactly that and no narrower rule.

     THE LABEL IS TYPE-NEUTRAL NOW, because one act publishing itself as "in a
     project" on a question would be the publication disagreeing with the op it
     fronts — the disagreement this file exists to prevent.

     REC-72 CHANGES NOTHING IN THIS ENTRY AND THAT IS THE POINT, stated so the
     next reader does not go looking for the edit. Widening `op=cite`'s CASE arm
     to admit a question as a MEMBER is a change to which sets the op accepts,
     not to which objects publish the act: an inquiry already published `cite`
     (as a citing object since REC-37, and as a member of somebody else's
     selection all along), and this row was already as wide as the op. What
     REC-72 did move is `sever`/`reinstate` below, because those two were
     NARROWER than the op they front. */
  /* REC-24 (c). An action whose own machine offers ANY onward state — which is
     everything except `resolved` and `abandoned`, and the table says so rather
     than this file listing them. ONE condition and no second: the entry
     requirements (an authored reason; a resolution when the target state is
     `resolved`) are ACT-TIME refusals the store words itself, the release
     precedent carried through conclude and reopen — publishing the act says the
     state machine permits a move, not that this caller's parameters will pass.
     Weight `single`: one action moves at a time and there is no set to apply.
     RUNG `reasoned` (FW-14), AND THE SUPERSEDED LINE IS THE CLEAREST EXAMPLE IN
     THIS FILE OF WHAT CHANGED. It read: "It is tempting to write `reasoned`
     because a reason is required, and that is exactly the guess RUNGS refuses."
     Under REC-19's rule — a rung comes from a DOCUMENT — that was correct.
     FW-14's rule is that a rung comes from what the code ENFORCES, and under it
     "a reason is required" is not a temptation, it is the evidence: the store
     refuses NO_REASON, and Constructs:161 defines `reasoned` as exactly that
     requirement. The same sentence, read against the two rules, gives opposite
     answers — which is why the rule change is written down rather than the
     conclusion alone. */
  { id: "actionmove", label: actName("actionmove"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && edgesFrom(f).length > 0 },
  /* REC-24 (d). Recording what was sent, what came back, or that nothing did.
     Published for an action in ANY state, and the breadth is deliberate: the
     store's own guard is the object's TYPE and nothing else, so narrowing here
     would be this file inventing a rule the plane does not enforce (the cite
     precedent). A resolved action can still have a late reply recorded against
     it — the exchange happened, and the ledger is the record of it — and a
     planned one can record a first approach.
     Weight `single`: the ledger is append-only, one entry at a time. RUNG
     `reasoned` (DEC-88), backed by its grounds (K1025, R19): the bytes or the member's account (actions R15–R16). */
  { id: "actioncorrespond", label: actName("actioncorrespond"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" },
  /* D-149. Stating which laws govern the request, on an action in ANY state, for actioncorrespond's reason:
     the store's own guard is the object's TYPE and nothing else. Weight `single`: one list, one act. */
  { id: "actionlaws", label: actName("actionlaws"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" },
  /* REC-214. Revising the risk tier, on an action in ANY state, for actioncorrespond's reason: the store's own
     guard is the object's TYPE and nothing else — a member may re-assess the legal exposure of a resolved action
     as much as a planned one. Weight `single`: one revision, one act, appended. RUNG `reasoned` (R27, K211). */
  { id: "actionrisktier", label: actName("actionrisktier"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" },
  /* ===== R51 (T45; v0.2 rule 1, S1 §D 12; DEC-8): EVERY ACT DIRECTED AT AN ACTION THAT T45'S OWNERS SERVE ==========
     Each is offered on an `action` target exactly where its own refusal would admit this caller (R18), read off R14's
     `action` facts (./affordances/facts.mjs), each asked through the read that refusal runs. Sight is every one's first
     gate and the facts are null for an action the viewer cannot see (R13). A machine is withheld each whose method refuses
     it by name (`MACHINE_REFUSALS`, R20); `filingprepare`, `communicationprepare`, `holdnoticeprepare` and
     `actionbearingpropose` take a machine's labelled work and stay offered to one. What turns on a PARAMETER (which entry,
     which ground, the reason, the words) is the act's own refusal, the release precedent: the record permits the move,
     not that this caller's parameters will pass. Every count is read through `countOf` and every flag on `=== true`: an
     absent fact offers nothing that needs it. Weight `single`: one act on one action. Not offered here, each with its
     reason (the job's record, K-ruled by BOB): the action's fields written through promotion (override, partners, press
     terms, "no reply owed", `follows_action`: no op), and the plan's acts (their subject is a plan). R52 (T46) adds what
     T45 deferred (K2898): stopping and reopening an escalation, `clockadopt` through action-clocks' read of the standing
     proposals, `filingsent` only on a draft needing no second approval, and attachment at stage 7 by purpose. An act whose
     refusal turns on WHICH of several things it names (`clockadopt`'s proposal, stage 7's purpose) carries them, read
     off the facts (`expand`, below `deriveActs`), so its own refusal of a wrong one is never the only way to learn. */
  /* action-holds R2: a hold is placed on the whole action, or on one of its entries; sight is its only gate on place. */
  { id: "actionhold", label: actName("actionhold"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && !!f.action },
  /* action-holds R5: released only where a hold is in place (HOLD_ALREADY_RELEASED). */
  { id: "actionholdrelease", label: actName("actionholdrelease"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.holds_in_place) > 0 },
  /* action-holds R1: pressure is marked on a received entry not yet marked (PRESSURE_NOT_RECEIVED, PRESSURE_MARKED). */
  { id: "actionpressure", label: actName("actionpressure"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.entries?.received_unmarked) > 0 },
  /* action-holds R11 and filings' hold notice: prepared and recorded sent only where a hold is in place (HOLD_NOT_IN_PLACE). */
  { id: "holdnoticeprepare", label: actName("holdnoticeprepare"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.holds_in_place) > 0 },
  { id: "holdnoticesent", label: actName("holdnoticesent"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.holds_in_place) > 0 },
  /* actions R80: a receipt is recorded on a sent entry (RECEIPT_NOT_ON_SENT). */
  { id: "actionreceipt", label: actName("actionreceipt"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.entries?.sent) > 0 },
  /* actions' scope (confidential set or removed, with a reason) and promise notes: sight only; which direction, and
     whether a promise stands to end, are parameters. */
  { id: "actionscope", label: actName("actionscope"), weight: "single",
    types: ["action"], applies: (f, ty) => ty === "action" && !!f.action },
  { id: "actionpromise", label: actName("actionpromise"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && !!f.action },
  /* action-replies R1, R2: a reply laid out claim by claim on a request for comment's received entry (BEARING_NOT_RFC);
     a response's arising matter linked from any received entry (AROSE_FROM_NOT_A_RESPONSE). */
  { id: "actionreplybearing", label: actName("actionreplybearing"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && f.action?.request_for_comment === true
                     && countOf(f.action?.entries?.received) > 0 },
  { id: "actionbearingpropose", label: actName("actionbearingpropose"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && f.action?.request_for_comment === true
                     && countOf(f.action?.entries?.received) > 0 },
  /* R58 (action-replies R10): a received reply of a request for comment may be recorded as asking not to be quoted, or the
     record withdrawn (QUOTING_NOT_RFC otherwise): the same facts as the layout, read through `bearingsOf`; a machine is
     refused it (MACHINE_CANNOT_RECORD_QUOTING, `MACHINE_REFUSALS`, `op-grades` R38). Which entry, which words are parameters. */
  { id: "actionreplyquoting", label: actName("actionreplyquoting"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && f.action?.request_for_comment === true
                     && countOf(f.action?.entries?.received) > 0 },
  { id: "arosefrom", label: actName("arosefrom"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.entries?.received) > 0 },
  /* escalation R1, R9 (join on override, R23): opened on the determination this action rests on, and the action
     attached to an escalation at a stage that takes one (escalation's `#pursuable` and `escalationAttach`). */
  { id: "escalationopen", label: actName("escalationopen"),
    weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && f.action?.escalation?.openable === true },
  /* R52 (escalation R34): at stage 7 the purposes R9 would admit for the action's addressee are carried as `purposes`
     (never one it refuses), so the purpose is chosen from what the act will accept; at stages 2 and 5 none is asked. */
  { id: "escalationattach", label: actName("escalationattach"), weight: "single",
    types: ["action"], applies: (f, ty) => ty === "action" && f.action?.escalation?.attachable === true,
    expand: (f) => [Array.isArray(f.action?.escalation?.attach_purposes) ? { purposes: f.action.escalation.attach_purposes } : {}] },
  /* R52 (escalation R31, R33): the group stops pursuing an escalation open or suspended (NOT_OPEN otherwise), and reopens
     one stopped (NOT_STOPPED otherwise), each with a member's reason; a machine is refused both (MACHINE_CANNOT_STOP). */
  { id: "escalationstoppursuing", label: actName("escalationstoppursuing"), weight: "single",
    types: ["action"], applies: (f, ty) => ty === "action" && f.action?.escalation?.stoppable === true },
  { id: "escalationreopen", label: actName("escalationreopen"), weight: "single",
    types: ["action"], applies: (f, ty) => ty === "action" && f.action?.escalation?.reopenable === true },
  /* filings R5, R23: prepared on an action not closed (ACTION_CLOSED); a filing only at a governing tier of 1 or 2
     (FILING_TIER_UNDETERMINED, TIER3_COUNSEL_PACKET). */
  { id: "filingprepare", label: actName("filingprepare"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && f.action?.closed === false && f.action?.preparable === true },
  { id: "communicationprepare", label: actName("communicationprepare"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && f.action?.closed === false },
  /* R52 (action-clocks R13, R20): a standing proposal adopted onto the action's clock, one act per proposal with a
     date, each naming the key `clockadopt` takes as `proposal`; none stands, none is offered. */
  { id: "clockadopt", label: actName("clockadopt"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.clock?.proposals) > 0,
    expand: (f) => f.action.clock.proposals.map((proposal) => ({ proposal })) },
  /* filings R6 (with R34, R43: the release of a contradicted sentence and each pointed-out sentence's resolution are its
     parameters, the plan's reconciliation R1): a draft of the group's voice not yet approved; R7: approved, not sent. */
  { id: "filingapprove", label: actName("filingapprove"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.drafts?.unapproved) > 0 },
  /* R52 (filings R50): `approved_unsent` counts only drafts answered `second_needed: false` (SECOND_APPROVAL_NEEDED). */
  { id: "filingsent", label: actName("filingsent"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.drafts?.approved_unsent) > 0 },
  /* filings R11 (claim or defence; T45: no determination needed): sight only, counsel being its parameter. */
  { id: "counselpacket", label: actName("counselpacket"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && !!f.action },
  /* action-clocks R18: the group's own deadline stated (sight only); R4: a reminder on a dated entry, while the
     action's standing reminders are under the bound (REMINDER_REFUSED, arms `entry`, `bound`). */
  { id: "clockstate", label: actName("clockstate"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && !!f.action },
  { id: "reminderset", label: actName("reminderset"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && countOf(f.action?.clock?.dated) > 0 && f.action?.clock?.reminders_room === true },
  /* plan-work R11: a member takes up a clock entry or a hold of this action (NO_SUCH_ITEM). */
  { id: "itemtakeup", label: actName("itemtakeup"), weight: "single", types: ["action"],
    applies: (f, ty) => ty === "action" && (countOf(f.action?.clock?.entries) > 0 || countOf(f.action?.holds_in_place) > 0) },
  /* PL-2 / IS-2 — THE SIX MEMBER OPS OF THE SIXTH STATE MACHINE.
   *
   * WHY THEY ARE `ACTS` AND NOT `NON_ACTS`, decided rather than assumed, and the
   * paragraph the IS-6 lander wrote above about `airunopen` predicted exactly
   * this: *"what a run eventually proposes IS an act on an object, and it is
   * IS-1's and IS-2's; that act will be an ACTS row, and this one is not it."*
   * The subject of these six is an inquiry's own basis — the question moves in
   * the member's hands when one is taken — which is what an object-directed act
   * is. The three run verbs are not acts because a run *changes NOTHING about*
   * the object it names; these change what the record stands on.
   *
   * THE DERIVATION IS OVER REAL FACTS AND NOT OVER THE TYPE. A question holding
   * no readings publishes none of the six, because the op would refuse
   * NO_SUCH_VERSION and a pre-flight offering a control the refusal it fronts
   * would decline is DEC-8's headline failure — the same reason `inquirydivide`
   * counts basis legs and `retire` counts live cites. The fact is
   * `basis_version_states`, which `affordanceFacts` (./affordances/facts.mjs) reads from the document; the RULE
   * over it is here, where every other act's rule lives, and `edgesFor` below is
   * the machine's OWN table so this file holds no state list of its own. Grep
   * it: no version-state word appears in any of the six entries.
   *
   * WEIGHT `single` on all six, conclude's precedent: one reading is settled at
   * a time and there is no set to apply. A bulk version would be the checkbox
   * these constructs exist to refuse, and the more so here, because this is the
   * family of acts that decides what a case rests on.
   *
   * RUNGS ON THESE SIX ARE NOT ALL THE SAME, AND THAT IS THE POINT (FW-14). The
   * line this replaces said "NO RUNG on any of them. It is tempting to write
   * `reasoned` on reject and consider because both REQUIRE a reason, and that is
   * exactly the guess RUNGS refuses." The observation was exactly right and is
   * now the derivation: `versionreject` and `versionconsider` ARE `reasoned`,
   * because `VERSION_REASON_REQUIRED` is `['considering', 'rejected']` and the
   * store enforces it through the ONE predicate `versionNeedsReason`.
   * THE OTHER FOUR ARE NOT, AND A TEXTUAL CLASSIFIER WOULD HAVE GOT THIS WRONG:
   * all six route through the same `#moveVersionState` and the same
   * `VERSION_NO_REASON` refusal, so anything grading these ops by finding that
   * code in the shared helper would have promoted four of them to a rung the
   * store does not enforce. R19's drive therefore performs the acts (this
   * module's tests), never reading the helper's text.
   * `versionrevert` and `versionhide` are `reversible` (revert's target state
   * reaches every state it runs from; hide is its own inverse — `hidden=false`).
   * `versionaccept` and `versioncurrent` are `reversible` since R27's ruling
   * (K211): acceptance is corrected FORWARD, and a published act (reconsider,
   * turn down, stand on another reading) takes its result back.
   *
   * THE ENTRY REQUIREMENTS ARE ACT-TIME REFUSALS the store words itself: which
   * version, the authored reason, the legal edge, the transitive cycle at accept,
   * acceptance before make-current, a project that draws on the question. The
   * release precedent — publishing the act says the machine permits the move,
   * not that this caller's parameters will pass. */
  { id: "versionaccept", label: actName("versionaccept"), weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && anyVersionEdgeTo(f, "accepted") },
  { id: "versionreject", label: actName("versionreject"), weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && anyVersionEdgeTo(f, "rejected") },
  { id: "versionconsider", label: actName("versionconsider"), weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && anyVersionEdgeTo(f, "considering") },
  { id: "versionrevert", label: actName("versionrevert"), weight: "single",
    types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && anyVersionEdgeTo(f, "suggested") },
  /* MAKE-CURRENT is offered when the question holds a reading a member has
     ACCEPTED, which is the store's own entry requirement (current implies
     accepted, §6 rule 5). Which PROJECT stands on it is the act's parameter and
     the store refuses an unnamed one — the dispose precedent, where the target
     state is a parameter rather than a second act. */
  { id: "versioncurrent", label: actName("versioncurrent"), weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && (f.basis_version_states ?? []).includes("accepted") },
  /* REC-136 / INVESTIGATIVE-SESSION.md §7.1 item 7: a PROJECT withdraws its
     conclusion, and the withdrawal APPENDS — the conclusion stays in the record.
     Offered on make-current's condition for make-current's reason: a project's
     conclusion adopts an ACCEPTED reading, so a question with none can carry no
     project conclusion to withdraw. WHICH project is the act's parameter, and
     the store refuses one that stands on no conclusion (NOTHING_TO_WITHDRAW) —
     the release precedent: publishing the act says the machine permits the
     move, not that this caller's parameters will pass. */
  { id: "withdrawconclusion", label: actName("withdrawconclusion"),
    weight: "single", types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && (f.basis_version_states ?? []).includes("accepted") },
  /* HIDE is offered wherever a reading exists AT ALL, in any state, and that
     breadth is deliberate rather than an omission: the prune offer's whole point
     (D-217a) is that accepting one reading offers to hide its ancestors, and a
     rejected reading is exactly the kind a member may want to keep visible or
     may want out of the way. The store gates on nothing but the version
     existing, so narrowing here would be this file inventing a rule the plane
     does not enforce — the cite precedent. */
  { id: "versionhide", label: actName("versionhide"), weight: "single",
    types: ["inquiry"],
    applies: (f, ty) => ty === "inquiry" && countOf(f.basis_versions) >= 1 },
  /* REC-134 / C-56: `f.project_participant !== false` on the PROJECT arm of cite, sever and
     reinstate, and only there. Each of the three edits the project's own document, and the
     store now refuses an actor who has not JOINED that project (`#projectAuthority`, §7.5) —
     which reaches every administrator, because an administrator SEES every discoverable project
     (and, at a hidden one's EXISTENCE, is answered facts with `project_participant: false`, D54)
     and so reached these acts through the sight gate alone. Offering them to such a caller would be
     the pre-flight disagreeing with the refusal it fronts (DEC-8). `!== false` for D-310's
     reason exactly: the fact is three-valued and a caller with no roster position (a `class:*`
     credential) reads null and is byte-unchanged. The information and question arms are not
     narrowed — citing FROM them is not an act on a project. */
  { id: "cite", label: actName("cite"), weight: "report",
    types: ["information", "project", "inquiry"],
    /* D-168 (2026-09-23, State Rules §4.1, BOB #30): a RETIRED Information bundle is not
       citable and the store refuses RETIRED_NOT_CITABLE for every caller, so the act is not
       offered on one — offering it would be the pre-flight disagreeing with the refusal it
       fronts (DEC-8). `source_status` is not read: a removed or modified source stays citable. */
    applies: (f, ty) => (ty === "information" && f.current_state !== "retired")
                     || (ty === "project" && f.project_participant !== false)
                     || ty === "inquiry" },
  /* S-11 step 2: withdrawing a citation without deleting it. From the CITED
     side: some CASE holds a live cites edge to it. From the case's own side:
     its references carry a confirmed cites edge.

     REC-72 CHANGED BOTH HALVES OF THE CITED SIDE, and each change is a rule.

     (i) A QUESTION IS NOW A CITED SIDE. `op=cite`'s case arm admits an inquiry
         (REC-72), so a case can draw on a question — and a case that could join
         a question and never leave it is a worse shape than one that can do
         neither, because there would then be no recorded way to stop drawing on
         it. The withdrawal is the same act on the same block of the same
         document, so it is offered wherever the edge can exist.

     (ii) THE FACT IS `cited_by_case` AND NOT `cites_in`, WHICH FIXES A LATENT
          DEC-8 DISAGREEMENT REC-37 LEFT. `#edgeTransition` — the one helper
          behind both these acts — refuses a citing object that is not a project
          (`NOT_A_PROJECT`). `cites_in` counts EVERY citer, and since REC-37 a
          QUESTION also writes `rel: cites` into its own references when it
          takes a basis leg. So an Information cited only by a question published
          `sever` on a target where the op would have refused. Nothing was
          looking for it: every suite's citer was a project. Withdrawing a basis
          LEG is a real gap and it is a different act — it belongs to the basis
          family (`inquiryground`, the version machine), not to this pair, and it
          is reported as a class finding rather than smuggled in here. */
  /* THE FACT IS READ DEFENSIVELY (`countOf`; `?? 0` until T43-17), the posture every fact added since
     REC-16 takes — `basis_legs`, `rested_on`, `basis_version_states` — and
     REC-72 learned why the hard way rather than by copying a style. Every count goes through `countOf` (R16), so a
     hand-built facts object that still carries ids is read as their number, never compared as an array. `deriveActs`
     is EXPORTED and two suites call it with hand-built facts objects; a fact
     read through a bare `.` threw a TypeError there, `repair-reachability`'s own
     `actsAt` helper SWALLOWED it in a `try/catch` and returned "no acts at any
     state", and its A3 judgement then reported six offenders that do not exist.
     An instrument reporting a wrong number is harder to notice than one
     reporting zero. In the plane the same crash would have taken the whole
     `op=affordances` answer down for every object. An absent count offers nothing
     that needs one, which is the SAFE direction: an act is not published where the
     fact behind it is not known, and DEC-8's rule is about never publishing one the op refuses. */
  /* R55 (T47; N977; citation R15): AND A QUESTION'S OWN LEG. `op=sever` now also acts on an inquiry's legs, with the
     question as its citing object and no joined project asked, so on an information target it is offered where a question
     the caller may see holds a live leg on it (`legs_in.live`, R14), as reinstate is where one holds a severed leg. Counts
     only, through `countOf`: an absent fact offers nothing (R10). */
  { id: "sever", label: actName("sever"), weight: "refuse",
    types: ["information", "inquiry", "project"],
    applies: (f, ty) => ((ty === "information" || ty === "inquiry") && countOf(f.cited_by_case?.confirmed) > 0)
                     || (ty === "information" && countOf(f.legs_in?.live) > 0)
                     || (ty === "project" && countOf(f.cites_out?.confirmed) > 0 && f.project_participant !== false) },
  /* REC-183 (State Rules §4.1, BOB #30): reinstating an edge onto a RETIRED Information bundle is
     refused RETIRED_NOT_CITABLE for every caller, so the act is not offered on one (DEC-8), as `cite`
     is not.

     D-444 NARROWS THE PROJECT ARM, which REC-183 left as a stated residue. The two arms ask the
     same question from the two ends of the edge. From the TARGET's end `current_state` answers it
     outright. From the PROJECT's end it cannot be answered by `cites_out.severed` at all: that is a
     count of the project's own severed edges and says nothing about what their targets have BECOME,
     so a project whose only severed edges point at retired items was offered an act the store then
     refused — a pre-flight disagreeing with the refusal it fronts. The store now states
     `severed_reinstatable`, counted through `#retiredNotCitable`, the predicate `#edgeTransition`
     itself runs; the arm keys on it and the offer cannot drift from the refusal.

     IT IS NARROWED AND NOT DROPPED, which is the whole of the accepts-when: a project holding a
     severed edge onto a LIVE target must still be offered `reinstate`, and the store must still
     accept it. Withholding the act from every project would satisfy "never offer what is refused"
     and cost a case the one recorded way to take a citation back up. `countOf` for the posture every
     fact added since REC-16 takes: absent reads as ZERO, the safe direction, because `deriveActs`
     is exported and two suites call it with hand-built facts. */
  { id: "reinstate", label: actName("reinstate"), weight: "refuse",
    types: ["information", "inquiry", "project"],
    applies: (f, ty) => ((ty === "information" || ty === "inquiry")
                         && (countOf(f.cited_by_case?.severed) > 0 || (ty === "information" && countOf(f.legs_in?.severed) > 0))
                         && !(ty === "information" && f.current_state === "retired"))
                     || (ty === "project" && countOf(f.cites_out?.severed_reinstatable) > 0
                         && f.project_participant !== false) },
  /* ===== D-311, 2026-09-23 · THE SEVEN ROSTER ACTS, FOLDED IN ON THE PER-PAIR FACT ==========
     They sat in NON_ACTS since REC-19 and D-310 decided they STAY there until a per-pair fact
     existed (NON_ACTS' participation block records it). It exists now:
     the store states `f.roster` — the caller's position IN THIS PROJECT, asked of the `by` stamp
     the roster acts themselves receive — and each predicate below is its own act's refusal
     stated as a condition, never D-310's "owner of SOME project":
       projectinvite      NOT_THE_OWNER            (`projectInvite`)   -> owner of THIS project
       projectjoin        NOT_INVITED              (`projectJoin`)     -> a participation row, not
                          `joined` (REC-186: a joined caller's join changes nothing)
       projectleave       NOT_A_PARTICIPANT/NOT_JOINED, LAST_COMMITTED_OWNER (`projectLeave`)
                          -> state `joined`, and an owner only while another owner is committed (R35)
       projectremove      NOT_THE_OWNER            (`projectRemove`)   -> owner of THIS project
       projectowneradd    NOT_THE_OWNER            (`projectOwnerAdd`) -> owner of THIS project
       projectownerremove NOT_THE_OWNER, LAST_OWNER, LAST_COMMITTED_OWNER (`projectOwnerRemove`) ->
                          owner, the one-owner floor clear and some owner committed (a one-owner
                          project, or one whose owners have all asked to leave, refuses EVERY parameter)
       projectownerrescue NOT_AN_ADMIN, NO_OWNERS, OWNERS_ARE_ACTIVE (membership `rescueRefusal`) -> open
     `projectremove` IS AN OWNER'S, NOT AN ADMINISTRATOR'S: Membership Architecture v2 §7.7
     REVERSED v1.4, and the store has refused a non-owner since. D-311's own row and D-310's
     argument both said "an ADMINISTRATOR's" — the v1.4 reading; each predicate here is derived
     from the refusal its op RAISES, which is what caught it.
     `projectjoin` IS OFFERED TO A PARTICIPANT WHO IS NOT JOINED — invited, or leaving (whose join
     withdraws the request, 7.6). CORRECTED by REC-186 on BOB #31's ruling of 2026-09-23 21:37Z: this
     read "offered to every participant, joined ones included … withholding it there would be a fence
     tighter than its rule". `projectJoin` stays idempotent and a joined caller's join still SUCCEEDS,
     but it changes nothing, and an offer that does nothing is an overclaim (DEC-8) — the store is not
     narrowed, only the offer. `projectleave` likewise is not offered to an owner who is the last
     COMMITTED one: `projectLeave` refuses LAST_COMMITTED_OWNER unless another owner has not asked to
     leave (membership R35, REC-224), which `f.roster.other_owner_committed` states (N45).
     WHAT THESE DO NOT SAY is what turns on a PARAMETER — the handle named, its status, the reason,
     the 7.10 votes still owed (CONSENSUS_REQUIRED, VOTES_SHORT) — the release precedent: the
     record permits the move, not that this caller's parameters will pass.
     `=== true` EVERYWHERE, and it is the shape an ADDITION takes: `f.roster` is null when no
     position could be asked (a DO-internal call, a non-project target), and an undetermined
     position must not publish an act. A credential's `by` is a minted stamp (`class:<cls>`; an assistant's
     `class:ai/<tokenId>`, N874), which holds no position, so its `f.roster` is null (R15) and a machine credential is
     offered none of the seven — each of which its class is refused.
     Weight `single`, conclude's precedent: one project's roster at a time, no set to apply. */
  { id: "projectinvite", label: actName("projectinvite"), weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && f.roster?.owner === true },
  { id: "projectjoin", label: actName("projectjoin"), weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && typeof f.roster?.state === "string" && f.roster.state !== "joined" },
  /* N45 (R18): an owner is offered leave only while ANOTHER owner stays committed (has not asked to leave), which is
     when membership R35 accepts it (LAST_COMMITTED_OWNER otherwise). The owner floor alone counted leaving owners too,
     so two owners could each be offered leave and the second refused. */
  { id: "projectleave", label: actName("projectleave"), weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && f.roster?.state === "joined"
                     && (f.roster?.owner !== true || f.roster?.other_owner_committed === true) },
  { id: "projectremove", label: actName("projectremove"), weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && f.roster?.owner === true },
  { id: "projectowneradd", label: actName("projectowneradd"), weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && f.roster?.owner === true },
  { id: "projectownerremove", label: actName("projectownerremove"), weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && f.roster?.owner === true && f.roster?.owner_floor_clear === true },
  { id: "projectownerrescue", label: actName("projectownerrescue"),
    weight: "single", types: ["project"],
    applies: (f, ty) => ty === "project" && f.roster?.rescue_open === true },
  /* REC-149 (Membership v2 §7.14): WHETHER THIS PROJECT CAN BE FOUND — an OWNER's recorded act on the project
     that is the TARGET. It asks the PAIR fact `project_target_owner` (`#isProjectOwner(target, caller)`, the one
     owner predicate `projectVisibilitySet` refuses on), never D-310's `project_owner` (owner of SOME project),
     which would offer it on every project to anyone owning any — D-311's argument (2) for the roster acts. It is
     offered on `=== true` ONLY: the store refuses every other caller, a machine credential included (C-70.2),
     so a null (no roster position) must not publish it — this is a NEW act, so no existing act set moves.
     Weight `single`: one project, one setting. */
  { id: "projectvisibilityset", label: actName("projectvisibilityset"), weight: "single",
    types: ["project"],
    applies: (f, ty) => ty === "project" && f.project_target_owner === true },
  /* N364 (R5, R29; K530): A MEMBER RECORDS A SOURCE'S CONSENT, with its evidence, for one disclosure and one audience
     (sources R7). AN ACTS ROW, NOT A NON-ACT, because the prompt must ride the act (DEC-78 item 5(d): consent to go public
     is asked at the moment of publishing, stated as permanent), and a prompt rides an act this file publishes.
     ITS SUBJECT IS A SOURCE'S ENTRY, WHICH NO BUNDLE'S FACTS DESCRIBE, so `applies` is false on every bundle: offering
     it beside an information bundle or a case would be the pre-flight offering an act about a person on an object that
     is not that person — `attest`'s argument (2) above, one noun over. It reaches a surface through the catalogue
     (op=affordances with no target, R17), decorated with its rung and prompt, for the view that shows a source's
     history. Weight `single`: one entry, one audience, one act. NOT in MACHINE_REFUSALS: `recordConsent` answers a
     machine NO_SUCH_SOURCE (a machine names no member who may read a source), never a MACHINE_* code (R20). RUNG
     `reasoned` (R2). */
  { id: "sourceconsent", label: actName("sourceconsent"), weight: "single",
    types: ["source"], prompt: CONSENT_PROMPT,
    applies: () => false },
];

/* D-126 — THE FOURTH WEIGHT, `per-item`, AND THE FOUR ACTS THAT TAKE A SET.
 *
 * NOTIFICATIONS.md §Applying a handler to a selection: *"each item independently succeeds or is RETAINED
 * WITH A REASON."* `refuse` stops the whole set on drift and hands over nothing; `report` proceeds and says
 * what moved; `single` has no set. `per-item` is none of them: every item is tried on its own, the ones
 * the act accepts are applied, and each one it refuses is kept, carrying that act's own refusal as its
 * reason. The mechanism is record-core's `perItem` (its R49), and these ops reach it when the body carries
 * `items` (a caller who sends no `items` gets the single act, unchanged). D-291 added a FOURTH, `op=resolve`,
 * whose items are captured documents rather than queue items (BIO_Interaction_Constructs §S).
 *
 * WHY A TABLE OF ITS OWN AND NOT ROWS IN `ACTS`: all four are NON_ACTS (`op-grades`) for reasons that still hold
 * — a proposal disposition is keyed on a derived proposal, a task act on a task and a resolution on a
 * capture sha, never on a bundle's state — so an `applies()` over `affordanceFacts` would have nothing to read. What a surface needs from
 * the plane is the WEIGHT (so it knows a selection is one call, not N) and the SET KEY; both are published
 * here, and `op=affordances` serves this table as `set_acts`. The bound, `PER_ITEM_MAX`, is record-core's (its
 * R49, N91), whose `perItem` enforces it, re-exported here unchanged (R6), so the number a surface reads is the
 * one the act enforces. */
export { PER_ITEM_MAX } from "./record-core/index.mjs";
export const PER_ITEM_ACTS = [
  /* REC-205: `item_keys` is the act's three IDENTITY SHAPES and is now ENFORCED as well as published —
     record-core's `perItem` is handed this very array by the acting module (tasks', queue's) and refuses to let a shared value of ONE shape reach an
     item that named another, which is what lets a project-scoped finding and a progression finding be
     handled in the same call. `definitionVersion` JOINS `shared_keys` (REC-211/IC-273): the act has
     taken it as a shared field since REC-211 — a set over one progression names the version once — and
     it was published in neither list, so a surface holding only this table could not complete an
     instance-scoped item in a set. It is an identity of nothing, so it is shared and never narrowed. */
  { id: "proposedispose", label: actName("proposedispose", true), weight: "per-item",
    set_key: "items", item_keys: [["key"], ["progressionKey", "stageKey"], ["project", "finding"]],
    shared_keys: ["to", "reason", "kind", "definitionVersion"] },
  { id: "taskresolve", label: actName("taskresolve", true), weight: "per-item",
    set_key: "items", item_keys: [["id"]], shared_keys: [] },
  { id: "taskforward", label: actName("taskforward", true), weight: "per-item",
    set_key: "items", item_keys: [["id"]], shared_keys: ["to"] },
  /* D-291 (BIO_Interaction_Constructs §S, BOB #32 2026-09-23 23:30Z): a member's selection of captured
     documents resolved in ONE call — each document's references run through the recogniser exactly as the
     single act runs them, each document applied or retained with that act's own reason. */
  { id: "resolve", label: actName("resolve", true), weight: "per-item",
    set_key: "items", item_keys: [["captureSha"], ["captureSha", "ref"]], shared_keys: ["ref"] },
];

export const ACT_IDS = new Set(ACTS.map((a) => a.id));

/* The derivation: which acts exist for THIS object as it stands. Pure over the
 * facts the store read, so a suite can hold it to the store's own refusals. */
export function deriveActs(facts) {
  const ty = normalizeType(facts.object_type);
  /* D-311: a machine is withheld what its class is refused — on a STATED true only; a null
     (no author stamp was sent) narrows nothing, D-310's three-valued shape. */
  const machine = facts.actor_is_machine === true;
  return ACTS.filter((a) => a.applies(facts, ty) && !(machine && Object.hasOwn(MACHINE_REFUSALS, a.id)))
    /* R52: an act naming what it takes (a proposal's key, the purposes it admits) is answered once per named thing */
    .flatMap((a) => (a.expand ? a.expand(facts).map((named) => (Object.keys(named).length ? { ...a, ...named } : a)) : [a]));
}

/* R52: the keys an expanded act names, carried by `decorate` beside R11's (the act's own parameter names). */
const NAMED_KEYS = ["proposal", "purposes"];

/* R11: one act, decorated for a caller. `gate` is the control plane's, built from the tables that actually gate the
 * call (`NEEDS`, `SESSION_OPS`): `{needs(op), mode(op)}`, `mode` one of `session`, `admin-session`, `machine`. Every
 * key is present and a value the record does not hold is a STATED null, never an omitted key — so a queue item's
 * option and an `op=affordances` act for the same subject are one shape from one function. `rung_absence` is the
 * ground of a classified absence (FW-14): a null rung beside a stated ground is undetermined STATED (R24). `phone` is
 * R36's, always a boolean. An act R52 expands also carries what it names (`proposal`, `purposes`). */
export function decorate(act, gate) {
  const id = act.id;
  return {
    id, label: act.label, weight: act.weight ?? null,
    needs: gate?.needs?.(id) ?? null,
    mode: gate?.mode?.(id) ?? null,
    rung: Object.hasOwn(RUNGS, id) ? RUNGS[id] : null,
    rung_absence: Object.hasOwn(RUNG_ABSENT, id) ? RUNG_ABSENT[id].ground : null,
    prompt: act.prompt ?? null,
    phone: phoneOf(id),
    ...Object.fromEntries(NAMED_KEYS.filter((k) => act[k] !== undefined).map((k) => [k, act[k]])),
  };
}

/* R41 (Q1-7; for `answers`' explain read): A REFUSAL EXPLAINED FROM ITS TRANSLATION AND A DRY RUN. For a refusal an op
 * gave: the refusal's catalogue row as its owner holds it — read through `rowOf(code)`, the plane's lookup over the owners'
 * check families, handed in by the caller as `gate` is (this module precedes the control plane that holds it), never
 * re-worded here — beside the op's rung, absence ground, prompt and weight (R11), and, with a target's facts (R13–R14,
 * asked by the caller of the instance method in ./affordances/facts.mjs), the acts R17 would answer for this caller on it
 * now: `deriveActs` over the facts, nothing performed. So the explanation states what the caller may do instead. A code
 * no row holds answers `translation: null` with `refusal.uncatalogued` in `detail`, read through `word` (R64, R21). Writes
 * nothing (R22) and never throws. `acts` is null with no target, and [] for a target the caller cannot see. */
const ALL_PUBLISHED = () => [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS];
export function explainRefusal(arg) {
  const { op = null, code = null, facts = null, gate = null, rowOf = null } = arg && typeof arg === "object" ? arg : {};
  const id = typeof op === "string" && op ? op : null;
  const c = typeof code === "string" && code ? code : null;
  let row = null;
  try { row = c && typeof rowOf === "function" ? rowOf(c) : null; } catch { row = null; }
  const catalogued = !!row && typeof row.translation === "string" && row.translation.length > 0;
  let d = { rung: null, rung_absence: null, prompt: null, weight: null };
  try { if (id) d = decorate(ALL_PUBLISHED().find((a) => a.id === id) ?? { id, label: id }, gate); } catch { /* stated nulls */ }
  let acts = null;
  try {
    if (facts && typeof facts === "object")
      acts = facts.ok === true ? deriveActs(facts).map((a) => decorate(a, gate)) : [];
  } catch { acts = null; }
  return { op: id, code: c,
           translation: catalogued ? row.translation : null,
           check: catalogued && typeof row.check === "string" ? row.check : null,
           detail: catalogued ? null : word("refusal.uncatalogued"),
           rung: d.rung, rung_absence: d.rung_absence, prompt: d.prompt, weight: d.weight, acts };
}

/* R12: the totality DEC-8 and FW-14 require, as a service over the control plane's table of ops, each
 * `{op, mutating, gated}`, rather than a suite reading another module's source. The two totalities are over two
 * sets: publication over the ops a capability gates (`gated`: the op has a `NEEDS` row, so a session reaches it and
 * a surface could offer it; a row without the key counts as gated), rungs over every mutating op. `unpublished`: a
 * gated op in none of the four registries. `unranked`: a mutating op with neither a rung nor a stated absence.
 * `stale`: a key of `RUNGS` or `RUNG_ABSENT` the table does not carry as mutating, or of `NON_ACTS` the table does not
 * carry at all (K4279: an owner-declared read the door serves is not stale). An alias of a published act is published (R51). All three empty is the totality; each list is sorted, so
 * an answer names the ops. */
export function unaccounted(opTable) {
  const rows = Array.isArray(opTable) ? opTable.filter((r) => r && typeof r.op === "string") : [];
  const all = new Set(rows.filter((r) => r.gated !== false).map((r) => r.op));
  const carried = new Set(rows.map((r) => r.op));
  const mutating = new Set(rows.filter((r) => r.mutating === true).map((r) => r.op));
  const published = new Set([...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].map((a) => a.id));
  /* T45 (R51): an alias answers as its op (`op-grades` R17, op-declarations R21), so an alias of a published act is
     published with it — `filingrecordsent` with `filingsent`, an act on an action since R51. */
  for (const [alias, op] of Object.entries(OP_ALIASES)) if (published.has(op)) published.add(alias);
  const has = (o, k) => Object.hasOwn(o, k);
  const unpublished = [...all].filter((op) => !published.has(op) && !has(NON_ACTS, op));
  const unranked = [...mutating].filter((op) => !has(RUNGS, op) && !has(RUNG_ABSENT, op));
  const stale = [...new Set([
    ...Object.keys(RUNGS).filter((op) => !mutating.has(op)),
    /* T48 (`op-grades` R39; K3301): an op held `caller-owned` without a rung (a member's own request or own read, such as
       `groupdescriptiondraft` and `securitymap`) is accounted for carried as mutating or, being drawn with no weight, as a gated
       read the door declares `ownread`; any other absence ground still wants the mutating row. */
    ...Object.keys(RUNG_ABSENT).filter((op) => !mutating.has(op)
      && !(RUNG_ABSENT[op]?.ground === "caller-owned" && all.has(op))),
    /* K4279 (R12): a NON_ACT is stale only when the table has no row for it at all; an owner-declared read the door serves is not. */
    ...Object.keys(NON_ACTS).filter((op) => !carried.has(op)),
  ])];
  return { unpublished: unpublished.sort(), unranked: unranked.sort(), stale: stale.sort() };
}
