// @ts-check
/* record-grammar: the document grammar every type is judged by: the heading sets (C-3.1), the state machines (C-4),
   the type-keyed vocabulary lookup, the case-member predicate and the one section slicer. Moved from the check
   catalogue at T19 with their comments. */

import { normalizeType } from './types.mjs';
/** @import { Frontmatter } from './frontmatter.mjs' */
import { word } from '../setup-words/index.mjs';

/** Literal heading constants per type (spec Section 4).
 *
 * The inquiry collapse CHANGED this vocabulary, unlike the problem→focus
 * rename which kept it: a legacy focus/problem document carries the heading
 * set it was authored under, and append-only means it keeps validating
 * against that set forever (a rename that invalidated the past would be a
 * purge wearing a new name — focus.test.mjs's own words). So the legacy
 * spellings keep their own entries HERE as the record of the old contract,
 * `problem` pointing at the SAME array as `focus` so the two cannot drift,
 * and vocabFor below judges a document by its DECLARED spelling first with
 * the NORMALIZED type as the fallback. */
/* `problem` is the same array as `focus` (`===`), and the last key, as it has always been (R32). */
const FOCUS_HEADINGS = ['## Statement', '## Why It Matters', '## Open Questions', '## Session Log', '## Review Notes'];
/** @type {{information: string[], inquiry: string[], focus: string[], project: string[], action: string[], bias: string[], problem: string[]}} */
export const HEADINGS = {
  information: ['## Summary', '## Provenance Notes', '## Session Log', '## Review Notes'],
  inquiry: ['## Question', word('conformance.rests'), '## Conclusion', word('conformance.falsify'), '## Session Log', '## Review Notes'],
  focus: FOCUS_HEADINGS,
  project: ['## Thesis Summary', '## Open Questions', '## Ruled Out', '## Session Log', '## Review Notes'],
  action: ['## Plan', '## Status', '## Correspondence', '## Session Log', '## Review Notes'],
  /* PL-12 / D-84 — THE BIAS BUNDLE'S HEADING SET, and the third heading is the
     one that is not decoration.
     `## Statements` is the prose the members read; the STATEMENTS THEMSELVES
     live in frontmatter as `statements[]`, exactly as an inquiry's legs live in
     `basis[]`, because D-21 forbids a second place to state a fact and the
     projection below is a projection of the DOCUMENT.
     `## Adoption` is where the group records the process by which it adopted
     this set. The doctrine deliberately does not define that process — "defined
     and documented by that group, in the group's own process document" — and
     requires only that adoption is a recorded, member-authored transition. So
     the heading is where the group's own account of it lands, and it is what
     makes `op=biasadopt`'s row point at something a reader can check.
     `## What This Does Not Enforce` IS DEC-54 (b) IN THE DOCUMENT'S OWN BYTES.
     The ruling is that the unenforceable residue is "a first-class published
     output, not a log line": a case saying "held to AP's standards" must also
     say which of AP's standards this system does not check, because in four of
     five documented verification failures the countable rules were formally
     satisfied while the uncountable properties failed. A residue that lived
     only in an op's answer would be exactly the log line the ruling refuses —
     it would not travel with the bundle, and a stranger reading the bytes after
     this instance is gone would meet the enforcement without the caveat. It is
     REQUIRED IN EVERY STATE rather than only in `adopted`, and C-26.7 refuses
     it EMPTY on an adopted bundle, because a heading nobody filled is the
     checkbox C-21.1 exists to refuse arriving one layer down. */
  bias: ['## Statements', '## Adoption', '## What This Does Not Enforce', '## Session Log', '## Review Notes'],
  problem: FOCUS_HEADINGS
};
/* One legacy vocabulary, two spellings: same object, so no drift. */


/* REC-14: headings that are CANONICAL for a type but required only in a
 * particular STATE. `## What This Excludes` is the completeness assertion's
 * home in the body, and C-3.1 refuses BOTH a missing required heading AND an
 * unexpected one — so until it is in the canonical set the exclusion cannot be
 * written at all, and once it is REQUIRED everywhere every open inquiry in the
 * corpus would carry an empty one.
 *
 * An empty heading on a question nobody has published is exactly the checkbox
 * C-21.1 exists to refuse, one layer down: it would make the canonical shape of
 * an inquiry include a promise it has not made. So the heading is PERMITTED in
 * every state (it can be drafted before publication, which is what the
 * ceremony's ordering needs — authoring the exclusion changes the sha, so it
 * cannot be written after the signature) and REQUIRED of a CASE MEMBER.
 *
 * CASE-4 / DEC-72, 2026-09-10: THE CONDITION WAS `states: ['published']` AND THE
 * STATE IT NAMED NO LONGER EXISTS. It was right when written — `published` was
 * the inquiry's last lifecycle state, so "is this document published" and "is
 * this document's current_state published" were one question. DEC-72 separates
 * them: a finding's lifecycle ends at `concluded` and publication is THE CASE
 * RELATION. The requirement itself has not moved one inch — the exclusion
 * assertion is owed by a document that is a member of a published case — so what
 * changes is only how the condition is asked, and it is now asked of the case
 * relation the bytes themselves carry. Keying it on the state word would have
 * silently stopped requiring the heading the moment the word left the machine,
 * which is a gate that disappears rather than a gate that was lifted. */
/** A heading owed only in some documents: in a case member's (`whenCaseMember`), or in the `states` named.
 * @typedef {{heading: string, whenCaseMember?: boolean, states?: string[]}} ConditionalHeading */
/* `focus` and `problem` are the same empty array (`===`), after `inquiry`, as they have always been (R33). */
/** @type {ConditionalHeading[]} */
const NO_CONDITIONAL = [];
/** @type {{inquiry: ConditionalHeading[], focus: ConditionalHeading[], problem: ConditionalHeading[]}} */
export const HEADINGS_WHEN = {
  inquiry: [{ heading: '## What This Excludes', whenCaseMember: true }],
  focus: NO_CONDITIONAL,
  problem: NO_CONDITIONAL
};

/* CORRECTED BY MK-2 (IC-142), never exempted, AND IT IS THE MOST DANGEROUS LINE
   IN THAT ITEM — found by its own control arm, not by reading. This read
   `s.length === 2`, which was "the frozen PAIR" while there were two axes. A case
   member resting on a member's testimony freezes THREE rows (the testimony axis
   beside capture and connection), and under the old predicate it stopped being a
   case member at all: ratification's checkPublishedExtension never ran over it and op=ratify
   would have read it as an ordinary inquiry — the ceremony silently unchecked,
   with every assertion about it passing over nothing. The measured symptom was a
   frozen block carrying an axis this record does not measure and drawing no
   finding. So the predicate asks what it always meant — a NON-TRIVIAL frozen
   array of axis objects, which a stray `published_strength: []` still is not —
   and leaves WHICH axes, and how many, to ratification's checkPublishedExtension, which refuses
   anything but capture and connection once each and testimony at most once. It
   FAILS CLOSED: a malformed frozen block is dragged into the ceremony and
   refused there, rather than let out of it. */
/** @param {Frontmatter | null | undefined} fm @returns {boolean} */
export const isCaseMemberBytes = (fm) => {
  const s = fm?.published_strength;
  return Array.isArray(s) && s.length >= 2
    && s.every((a) => a !== null && typeof a === 'object' && !Array.isArray(a) && typeof a.axis === 'string');
};

/* THE type-keyed vocabulary lookup (REC-10, normalisation site 1 of 4).
 * Membership questions go through normalizeType (C-2.5); vocabulary
 * questions — which heading set, which state machine — resolve the
 * DECLARED spelling first, because the collapse changed those vocabularies
 * and a legacy document is judged by the contract it was written under,
 * then fall back to the normalized type, so a canonical document and any
 * future alias whose vocabulary did not change need no duplicate keys.
 * checkHeadings and checkStateLegality MUST look up through this rather
 * than raw table[ot]: the second rename left them un-normalized and
 * patched with duplicate keys, and DATA-MODEL.md §2.7 measured what that
 * costs a third name. */
/** @template V @param {Readonly<Record<string, V>>} table @param {string} t @returns {V | undefined} */
export const vocabFor = (table, t) => table[t] !== undefined ? table[t] : table[normalizeType(t)];

/** Legal states and transition edges per type (spec Section 4; edge set is catalog-versioned). */
/* The LEGACY focus machine (below), named once so `focus` and `problem` hold the same object. */
const FOCUS_STATES = {
  legal: ['surfaced', 'elevated', 'deferred', 'dismissed'],
  edges: {
    surfaced: ['elevated', 'deferred', 'dismissed'],
    deferred: ['surfaced', 'elevated', 'dismissed'],
    dismissed: ['surfaced', 'elevated', 'deferred'],
    elevated: []
  }
};
export const STATES = {
  information: {
    legal: ['collected', 'verified', 'retired'],
    edges: { collected: ['verified'], verified: ['retired'], retired: [] }
  },
  /* The INQUIRY machine (REC-10, extended by REC-13). `published` and
     `divided` still wait for REC-14/16, and they arrive TOGETHER WITH their
     entry requirements, so no state is ever legal before its gate exists —
     which is why `concluded` landed here in the same turn as
     checkInquiryExtension's concluded arm (inquiry-grammar's today) and op=conclude.
     `surfaced` is a LEGAL ALIAS of `open` (DATA-MODEL §2.7's recommendation):
     rewriting it would invent an authored fact and set current_state
     disagreeing with the document's own state_history (C-4.2), so it stays
     legal, appears wherever `open` appears — INCLUDING the new conclude edge,
     because refusing to conclude an inquiry merely because it spells its open
     state the old way would be the trap the alias exists to avoid — and the
     drift stays visible. `open` is legal[0] deliberately — setup.mjs derives
     FIRST_STATE from it.

     REC-13's edges, and only these: `open <-> concluded` both ways (a
     conclusion is revisable — reopening is how a group says the answer did
     not hold), and `concluded -> deferred|dismissed`, because a conclusion
     nobody publishes STILL AGES (D-79: a finding that silently stops being
     worked on is indistinguishable from one never made). Deliberately NOT
     added: `deferred -> concluded` and `dismissed -> concluded`. Concluding
     something the group set down means picking it back up first, and the
     machine already carries deferred/dismissed -> open for exactly that.
     `concluded -> surfaced` follows the table's own convention, where every
     existing edge into `open` names the alias beside it. */
  /* ============ CASE-4 / DEC-72, 2026-09-10: `published` LEAVES THIS MACHINE.
     THE STATE GOES; THE PRECONDITION IT ENFORCED DOES NOT, AND THAT DISTINCTION
     IS THE WHOLE ITEM.

     Bob's ruling (DEC-72) makes a case ITS OWN OBJECT — a set of
     finding-versions plus the publishing project — rather than a phase of a
     finding. `CASE-AS-PRODUCTION.md`: *"A finding's lifecycle ends at
     `concluded`; publication is the case relation."* Its supersession table
     rules on this table by name: *"`published` as an inquiry lifecycle state
     (State Rules per-type machine; ILLEGAL_TRANSITION publishing-only-from-
     concluded) — the precondition survives as 'only a CONCLUDED finding may be
     a case member'; the state itself becomes the case relation."*

     WHAT `concluded: [... 'published' ...]` WAS ACTUALLY DOING, and it is why
     deleting it alone would have been a defect rather than the change. That one
     array entry was carrying TWO facts at once. The first is that publishing
     moves the document to a new lifecycle state — that fact is what DEC-72
     deletes. The second is that publishing is reachable from `concluded` AND
     FROM NOWHERE ELSE — a material set cannot be asserted over a question with
     no conclusion — and THAT fact survives the ruling untouched. Because both
     rode on one array entry, removing the entry removes both: with no
     `published` anywhere in `edges`, the old guard
     `legalFrom.includes("published")` is false from EVERY state, which reads as
     a gate that refuses everything and is in fact a gate that has stopped
     asking. So `publishCase()` now carries the precondition EXPLICITLY, as its
     own named refusal (`NOT_CONCLUDED`) over `concluded` alone. A rule that used
     to be a side effect of a table is now a sentence, which is the only form in
     which it can survive the table.

     `published` IS STILL IN `legacy` BELOW AND THAT IS NOT A HEDGE. Ratified
     bytes are immutable and a store that has published anything holds documents
     whose frontmatter says `current_state: published` — bytes whose hash a
     stranger may already be verifying against. Rewriting them to say something
     else would break every pin that names them and would be this record editing
     what it already signed. The focus machine four rows down is kept whole for
     exactly this reason and states it in those words: a legacy document
     validates against the vocabulary it was authored under. So the word stays
     VALID and stops being REACHABLE — nothing in `edges` names it as a
     destination, which is what "removed from the state machine" means for a
     machine that cannot rewrite its own history. `legal` is what this machine
     produces; `legacy` is what it must still read.

     THE OUT-EDGES ARE KEPT for the same reason and only for it: a document
     already sitting at `published` must still be pickable-up, or the removal
     would strand every case ever published behind a state with no exit. Nothing
     new ever arrives there to use them.

     WHAT REPLACED THE STATE EVERYWHERE ELSE: the CASE RELATION. Every guard
     that read `current_state === 'published'` — cannot divide, cannot
     restructure, cannot move a version, the frozen/confirmed basis split,
     reopen's own gate — now asks whether the document's CURRENT VERSION is a
     case member, which CASE-5 made answerable by the pin (`bundle_sha =
     version_sha`). That is one question with one answer instead of a state word
     and a roster that could disagree, and it is also why CASE-4 needed no second
     mechanism to notice a revision: a revised member's head stops matching the
     pin, and that same inequality IS the revision flag.

     ============ The REC-14 / DEC-12 reasoning that put `published` here, kept
     because it is what the removal has to preserve. It was: reachable ONLY from
     `concluded` — a material set cannot be asserted over a question with no
     conclusion — and it leaves ONLY to `open` (and its `surfaced` alias), which
     is DEC-12's reopening: *"A closed finding can be reopened, and a published
     case can be revised, though when republished, the edition number must be
     incremented and the case treated as a separate document."*

     REOPENING DOES NOT UNPUBLISH, and this table is where that survives. The
     inquiry's STATE and its PUBLICATION HISTORY are two different records: the
     edges here move the working document, and published_bundles keeps every
     edition with its own signature, attestor, time and gate version forever.
     A revision therefore costs the full ceremony — published -> open ->
     concluded -> published at edition 2 — because each edition is a separate
     document that carries its own conclusion, its own falsifier and its own
     freshly authored completeness (C-21.1).

     DELIBERATELY NOT ADDED: `published -> deferred|dismissed`. Ageing is what
     happens to a finding NOBODY published (D-79); a published case cannot
     quietly stop being worked on, because it is already out in the world.
     `published -> published` is not an edge either: a new edition is entered
     through `open`, so the state_history a reader checks shows the reopening
     that produced it rather than a case that mutated in place. */
  /* REC-16 / DEC-28: `divided` joins, and it IS TERMINAL. It is a STATE and not
     a disposition, and the line between the two families is not terminality —
     `deferred` and `dismissed` are terminal-ish too — it is WHAT THE WORD
     CLAIMS ABOUT THE QUESTION. A disposition is a member's judgment about a
     well-formed question and the question survives it unchanged; `divided` says
     the QUESTION ITSELF was malformed, it was two questions, and the parent is
     corrected FORWARD into its children. That is DEC-19's shape and the
     supersession family, not the declination family. Its reason belongs to the
     ACT and `disposition_reason` is untouched.

     ENTERED FROM `open` (and its `surfaced` alias) AND FROM `concluded`, and
     NOT FROM `published` — inquiry's divide refuses that one BY NAME
     (PUBLISHED_CANNOT_DIVIDE) rather than as a generic illegal move, because
     the two are different statements: an EDITION says the case continues, a
     DIVISION says the parent was malformed, and a signed edition cannot be
     retroactively declared malformed without erasing what a reader relied on.
     DEC-12 changed publishing; it did not change this.

     DELIBERATELY NOT ADDED: `deferred|dismissed -> divided`. A question the
     group set DOWN is picked back up first (op=reopen), exactly as concluding
     one is — the machine already carries those edges, and dividing something
     nobody is working on would make the disposition a state nothing can be
     reasoned about from.

     TERMINAL, and structurally so rather than by policy: the parent's legs are
     OWNED by its children now, and un-dividing would be the record changing its
     mind in silence. `divided: []` is that fact, and it is what makes the
     children's `supersedes` edges the only forward path. */
  inquiry: {
    legal: ['open', 'deferred', 'dismissed', 'surfaced', 'concluded', 'divided'],
    /* CASE-4 / DEC-72: STATES THIS MACHINE NO LONGER PRODUCES AND MUST STILL
       READ. Valid in bytes that already carry them; named by no edge as a
       destination, so nothing can enter them again. See the block above. */
    legacy: ['published'],
    edges: {
      open: ['deferred', 'dismissed', 'concluded', 'divided'],
      surfaced: ['deferred', 'dismissed', 'concluded', 'divided'],
      deferred: ['open', 'surfaced', 'dismissed'],
      dismissed: ['open', 'surfaced', 'deferred'],
      /* `published` REMOVED from this list by CASE-4 — it was the only edge INTO
         the state, and with it gone the state is unreachable. The precondition
         it also carried (publishing only from `concluded`) is now publishCase()'s
         own NOT_CONCLUDED refusal. */
      concluded: ['open', 'surfaced', 'deferred', 'dismissed', 'divided'],
      /* KEPT so a document already at `published` is not stranded. No new
         document ever arrives here to use these. */
      published: ['open', 'surfaced'],
      divided: []
    }
  },
  /* The LEGACY focus machine, kept whole (elevated included) because a
     legacy focus/problem document validates against the vocabulary it was
     authored under — see the HEADINGS note. Nothing produces these states
     anymore; op=dispose runs on the inquiry machine above. */
  focus: FOCUS_STATES,
  /* K904 (form (b); N456, T21): A PROJECT'S STAGE IS COMPUTED, NOT WRITTEN. `project-stage` derives it at the read,
     so the machine writes only whether the project is open or closed: `forming` (legal[0]) and `closed`, each to the
     other. `investigating` and `matured` were the hand-written ladder; bytes that carry them stay valid (`legacy`),
     and they may only close. */
  project: {
    legal: ['forming', 'closed'],
    legacy: ['investigating', 'matured'],
    edges: {
      forming: ['closed'],
      investigating: ['closed'],
      matured: ['closed'],
      closed: ['forming']
    }
  },
  action: {
    legal: ['planned', 'active', 'awaiting_response', 'resolved', 'abandoned'],
    edges: {
      planned: ['active', 'abandoned'],
      active: ['awaiting_response', 'resolved', 'abandoned'],
      awaiting_response: ['active', 'resolved', 'abandoned'],
      resolved: [], abandoned: []
    }
  },
  /* PL-12 / D-84 — THE BIAS MACHINE, and `proposed` is DEC-54 (c) made
     structural rather than documented.
     `draft` is where a set is written. The doctrine already puts one rule on
     it — "a pattern statement without at least one citation cannot leave
     draft" — and C-26.4 is that rule, which is why it fires on the way OUT of
     draft rather than on the way in.
     `proposed` is the ONLY state an INHALE could ever reach, and the reason it
     exists as a state of its own. DEC-54 (c): "INHALE MEANS PROPOSE FOR
     ADOPTION, NEVER INSTALL. Adoption is an authored, attributed act (DEC-46,
     D-90, D-82). Otherwise adopting a policy becomes a way to LAUNDER a
     standard — 'we follow BBC standards' with nobody in the group having
     authored anything, which is the never-prefill violation wearing a
     compliance badge." A machine that could write `adopted` directly would BE
     that laundering, so the machine's ceiling is a state and not a convention.
     `adopted` is entered ONLY from `proposed`, and entering it is what
     `op=biasadopt` records with an author and a date.
     NO EDGE OUT OF `adopted` EXCEPT `retired`, and that is deliberate. An
     adopted set is PINNED (DEC-54 (d)) and a published case names the version
     it was held to; a set that could slide back to draft in place would make
     "the lens this case was produced under" unresolvable after the fact.
     Amending an adopted set is a NEW REVISION of the same bundle under
     append-only history — which re-pins — or a retirement and a successor.
     DELIBERATELY NOT ADDED: `draft -> adopted`. It is the only edge that could
     let a set become binding without ever having been proposed, and closing it
     is what makes the proposed state load-bearing rather than ceremonial.
     AND SINCE D-468 (2026-09-24) THIS TABLE IS ENFORCED AT THE WRITE PATH AND NOT
     ONLY DESCRIBED HERE. Everything above was true of the table and false of the
     plane: `op=promote` consulted no edge table, so `adopted -> proposed` landed
     and moved the head — a constraint that existed as a comment, which is the
     defect this repository meets most. `promote`'s `bias-state-edge` region now
     reads this table through `vocabFor` and refuses any move it does not declare
     (BIAS_ILLEGAL_TRANSITION, C-26.12). A revision that leaves a set where it
     stands is not a move and is not asked: that is how an adopted set is amended
     (`BIO_Declared_Bias_v0_1.md` §"Bias bundles and adoption"). This fence is
     THIS machine's alone — `promote` still asks no edge table for any other
     object_type. */
  bias: {
    legal: ['draft', 'proposed', 'adopted', 'retired'],
    edges: {
      draft: ['proposed', 'retired'],
      proposed: ['draft', 'adopted', 'retired'],
      adopted: ['retired'],
      retired: []
    }
  },
  /* K171 (1) (T8, N129): THE ACTION LAYER'S RECORD OBJECTS. A standard, a determination and a consequence part
     are each RECORDED once and never move: a correction is a new object that supersedes the old one (standards
     R4 and R6, conformance R7, consequences R6), so each machine is one state and no edge, and a promotion that
     names any other state is refused by `promote` (promotion R15). */
  standard: {
    legal: ['recorded'],
    edges: { recorded: [] }
  },
  determination: {
    legal: ['recorded'],
    edges: { recorded: [] }
  },
  consequence: {
    legal: ['recorded'],
    edges: { recorded: [] }
  },
  /* An escalation (escalation R21) is `open` while its stages run and `suspended` while a member has set it
     aside; `escalationResume` restores it at the same stage (R15). It is `ended` only by `escalationEnd`, once
     compliance is restored and the consequences are addressed (R14), and nothing leaves `ended`.
     T46-1 (R57; N910, K2844; State Rules §4.4): `stopped_pursuing` is the group's decision to stop pursuing it
     (`escalationStopPursuing`, escalation R31), from `open` or `suspended`, with a reason. It is never `ended` and never
     read as success, so it has no edge to `ended`; `escalationReopen` is its one way out, back to `open` at the stage
     where it stopped. Appended last, so `legal[0]` stays `open`. */
  escalation: {
    legal: ['open', 'suspended', 'ended', 'stopped_pursuing'],
    edges: {
      open: ['suspended', 'ended', 'stopped_pursuing'],
      suspended: ['open', 'ended', 'stopped_pursuing'],
      ended: [],
      stopped_pursuing: ['open']
    }
  },
  /* K198 (2) (T8, N159): intent's two pursuit documents (intent R26). An aspiration is held until it is retired;
     a goal is open until it is closed. Neither returns: intent's step refuses any other move
     (PURSUIT_STATE_MOVE_UNDECLARED), and this table states the same machine so the audit and the gate read the
     states as legal. */
  aspiration: {
    legal: ['held', 'retired'],
    edges: { held: ['retired'], retired: [] }
  },
  goal: {
    legal: ['open', 'closed'],
    edges: { open: ['closed'], closed: [] }
  },
  /* N-A1 (T18, K608): `action-plans`' plan (its R2, `PLN-`, `action_plan` in record-grammar's `OBJECT_TYPES`). A plan
     is `open` while the group works it and `closed` when a member closes it with a reason; nothing reopens it.
     T46-1 (R58; N914, K2848; State Rules §4.4): `paused` is a member setting the plan down with a reason (`planPause`,
     action-plans R40) while what it set running continues; `planResume` returns it to `open`, and a paused plan may be
     closed. It sits between the two in `legal`, the order R58 states; `legal[0]` stays `open`. `goal` keeps its own
     machine, `open` to `closed` alone. */
  action_plan: {
    legal: ['open', 'paused', 'closed'],
    edges: { open: ['paused', 'closed'], paused: ['open', 'closed'], closed: [] }
  },
  /* T46-1 (R59; N911, K2845): `consequences`' success record (its R17, `SUC-`, `success_record` in `OBJECT_TYPES`). It is
     RECORDED once and never moves, as a standard, a determination and a consequence part are: a correction is a successor
     (`successRevise`). Promoted with history like a finding (consequences R14's pattern), so it has this machine; it is not
     a bundle prefix (R1), so `HEADINGS` gains nothing. Since T47 (R62; N958) `checkBundle` admits its document under
     `success_record@1` and judges its state by this machine (bundle.mjs). */
  success_record: {
    legal: ['recorded'],
    edges: { recorded: [] }
  },
  /* One machine, two spellings: the legacy alias points at the SAME object, so
     the tables cannot drift apart. The last key, as it has always been. */
  problem: FOCUS_STATES
};

/* Exported for REC-22: the public read path renders `## Conclusion`,
   `## What Would Falsify This` and `## What This Excludes` out of the published
   bytes, and it must slice them exactly the way the catalog does. One parser,
   because a reader and a gate disagreeing about where a section ends is a
   disagreement about what the group published.
   T46-1 (R36, P8): only a string is a body. An array or a `String` object answered `indexOf` and `slice` too, so one
   was sliced as if it were text instead of refused; it is a `TypeError` now, as every other non-string already was. */
/** @param {string} body @param {string} heading @returns {string | null} */
export function sectionText(body, heading) {
  if (typeof body !== 'string') throw new TypeError('sectionText: body must be a string');
  const idx = body.indexOf(heading);
  if (idx < 0) return null;
  const next = body.indexOf('\n## ', idx + 1);
  return body.slice(idx, next === -1 ? undefined : next);
}
