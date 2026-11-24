/* basis-version-grammar — the grammar (R1–R7): the version block's findings, the machine, and the ONE assembler of a
 * version's composition that the freeze and the projection (`basis-versions` R6, R7) both read.
 *
 * COPIED FROM `basis-versions` (`src/basis-versions/grammar.mjs`) in T51 (T51-148; K624, K3946), unchanged but for the
 * names `BASIS_VERSION_GRAMMAR_CHECKS` and `fmSafe` (held here), the registration's `module` parameter (R6) and the
 * rows' `where`. `basisVersionFindings` moved to `basis-versions` from the check catalogue in T19 layer 6 (K766, K787),
 * with its rows and vocabularies in `./checks.mjs`; record-core's C-2.8 slot runs it through the registration (R6). It
 * also holds `#canon`, `versionsIn` (the old `basisVersionsOf`, distinct from `basis-versions`' factory) and
 * `compositionDiff`. Pure; nothing here throws but a refused registration. */

import { BUNDLE_ID_RE, ISO_TS_RE, OBJECT_TYPES, normalizeType, isMachineIdentity, BASIS_ROLES, BASIS_GRADES, GRADE_AXES,
         GRADE_SOURCES } from "../record-grammar/index.mjs";
import { GROUND_LABEL_RE, leadLegFindings, checkLegExtentGrammar, registerInquiryGrammar, IMPORTED_FINDING_RE,
         importedLegFindings, calculationLegFindings, occurrenceLegFindings, derivedConnectionLegFindings,
         standardLegFindings, DERIVATION_FIELDS, parseOccurrenceRef, DERIVED_CONNECTION_ID_RE, CALCULATION_REF_RE } from "../inquiry-grammar/index.mjs";
import { themeLegFindings } from "../connections/index.mjs";
import { legContentId, legExtent } from "../content/index.mjs";
import { canonicalExtent } from "../textchain.mjs";
import { BASIS_VERSION_GRAMMAR_CHECKS, VERSION_KIND_CHECKS, VERSION_STATES, VERSION_REASON_REQUIRED, versionNeedsReason,
         VERSION_RELATIONSHIPS, VERSION_NAME_RE, SUGGEST_KINDS, SUFFICIENCY_UNCLAIMED, isSufficiencyUnclaimed } from "./checks.mjs";
import { word, localize } from '../setup-words/index.mjs';

/* R13: the one way this module names a version leg in a sentence: its place, read by key (`leg_of_version`). */
const legPlace = (n, name) => localize('basis-version-grammar.grammar.leg_of_version', "Leg {n} of version '{name}'", { n: String(n), name: String(name) });

export { BASIS_VERSION_GRAMMAR_CHECKS, VERSION_KIND_CHECKS, VERSION_STATES, VERSION_MACHINE, VERSION_REASON_REQUIRED,
         versionNeedsReason, VERSION_RELATIONSHIPS, VERSION_NAME_RE, SUGGEST_KINDS, SUFFICIENCY_UNCLAIMED,
         SUFFICIENCY_CLAIM_STATES, sufficiencyClaimState, isSufficiencyUnclaimed } from "./checks.mjs";

/** R5: frontmatter-safe text: the restricted grammar has no escapes, so a derived string loses its line breaks, and a
 *  quote or backslash becomes an apostrophe. An authored field is refused by name before it gets here. Idempotent. */
export function fmSafe(s) {
  return String(s ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "'").trim();
}

/* The catalogue's finding shape (`f`, legacy-checks), copied for `basisVersionFindings`: a finding is
   `{check, severity, message}`, with `repairable` and `repairs` when repairs are named and `code` when one is. */
function f(check, severity, message, repairs, code) {
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  if (code) out.code = code;
  return out;
}

/** R3 (N522): whether a leg's target is an imported finding reference (`inquiry-grammar` R11), never a local id. */
export function isImportedRef(t) {
  return typeof t === "string" && IMPORTED_FINDING_RE.test(t.trim());
}

/** R3 (K3873): whether a leg's target is a calculation's id, a duty occurrence ref or a derived connection's id: named by
 *  the leg, not a bundle of this record. */
export function isDerivedKindRef(t) {
  return typeof t === "string" && (CALCULATION_REF_RE.test(t) || parseOccurrenceRef(t) !== null || DERIVED_CONNECTION_ID_RE.test(t));
}

/** PL-1 / IS-1 — the version block's grammar, at BOTH gates through one function.
 *
 *  THE AUTHORED SHAPE IS THREE SIBLING ARRAYS joined by the version's NAME:
 *
 *      basis_versions[]        one row per version  (name, description,
 *                              relationship, state, derived_from, hidden,
 *                              claim, run, author, at, regroup_*)
 *      basis_version_grounds[] one row per (version, ground) with its
 *                              attribution — REC-45's act at the version's grain
 *      basis_version_legs[]    one row per leg, carrying `version` and `ground`
 *
 *  and that is `basis[]`/`grounds[]`'s own idiom one level up rather than a new
 *  one. It is also what the restricted frontmatter grammar can actually express:
 *  the parser reads arrays of objects with SCALAR properties, so a version
 *  carrying its legs as a nested array would not parse at all — measured against
 *  `parseFrontmatter` before the shape was chosen, not assumed.
 *
 *  TWO BOUNDS STATED RATHER THAN SILENTLY VIOLATED, both standing decisions of
 *  the record this item does not get to move:
 *
 *  1. **CORRECTED 2026-09-14 BY REC-84, AND THE OLD RULE IS QUOTED RATHER THAN
 *     DELETED because a superseded rule is corrected with its reason.** This
 *     bound read: *"D-164 IS UNLANDED, so a version's legs address WHOLE
 *     BUNDLES. There is no extent, no offset and no extraction method on a
 *     version leg, because the record cannot express one yet … when D-164 lands,
 *     the field arrives here with a writer rather than as a nullable column that
 *     reads like a precision the record never had."* D-164 landed: IC-83 (the
 *     `content` table and its writer, REC-82) and IC-84 (this grammar, REC-84).
 *     **The prediction held exactly** — `inquiry_basis_version_legs.content_id`
 *     arrived NULLABLE AND WITHOUT ITS WRITER at REC-82, deliberately, and the
 *     writer is REC-84's. A version leg may now carry an `extent` (IC-1's union,
 *     flattened onto the leg by `legExtent`) or name a part outright by
 *     `content_id`; absent, it means the whole document and NOT `unstated`
 *     (Bob's 5.3). The grammar is `checkLegExtentGrammar`, shared with
 *     `basis[]`'s own loop, and it fires here as C-25.10.
 *  2. **D-184 / C-2.8 bound the leg vocabulary to information or inquiry.** Not
 *     projects, not actions, not entities — C-25.10 refuses everything else by
 *     name, at the version's own grain, because a version's legs do not pass
 *     through `checkInquiryBasis`'s loop over `basis[]`.
 *
 *  AND A THIRD BOUND, on what is NOT checked here: the transitive basis DAG. A
 *  version leg naming this inquiry is refused (C-25.14) because that is a fact
 *  about one document, but a leg naming an inquiry that transitively rests on
 *  this one is a cycle only the STORE can see, and it is refused at `basis[]` by
 *  `#basisCyclePath` at the moment a version's legs become the basis. That is
 *  IS-2's accept path and it was not built; PL-1 records the edge rather than
 *  half-building a second cycle walk that would drift from the first. Built
 *  since: the accept refuses it through `inquiry`'s one walk, `cyclePath`
 *  (`VERSION_BASIS_CYCLE`, C-25.27, R12).
 *
 *  VERSION LEGS ARE DELIBERATELY *NOT* REQUIRED IN `references[]`, which is the
 *  one place this diverges from `basis[]`'s rules (C-6.3). `references[]` is what
 *  the INQUIRY points at; `refs` is its projection and the re-evaluation walk
 *  reads it. A SUGGESTED alternative account is not the inquiry's stance, and
 *  requiring its legs in `references[]` would let any machine suggestion silently
 *  expand the inquiry's own edge set — and with it the reverse index, the
 *  re-evaluation obligation and the cycle surface — before a member had accepted
 *  anything. The protection a reader actually needs is that the target EXISTS,
 *  and the store supplies it: promote resolves every version leg against
 *  `bundles` and refuses one that points at nothing, which is the resolve-or-refuse
 *  posture `action_basis` and `supersedes` already take.
 */
export function basisVersionFindings(fm, findings) {
  const rows = fm?.basis_versions;
  const legRows = Array.isArray(fm?.basis_version_legs) ? fm.basis_version_legs : [];
  const groundRows = Array.isArray(fm?.basis_version_grounds) ? fm.basis_version_grounds : [];
  const push = (key, message, repairs) => {
    const row = BASIS_VERSION_GRAMMAR_CHECKS[key];
    findings.push(f(row.check, 'error', message, repairs, key));
  };
  /* PL-3 / IS-4 — the same shape reading the SUGGEST family's registry. A second
     REGISTRY, deliberately not a second membership test: the kind vocabulary is
     `SUGGEST_KINDS` and this arm calls it rather than re-typing the five. C-27.15's row is
     `VERSION_KIND_CHECKS` (`./checks.mjs`), the one C-27 row this module raises. */
  const pushSuggest = (key, message, repairs) => {
    const row = VERSION_KIND_CHECKS[key];
    findings.push(f(row.check, 'error', message, repairs, key));
  };

  if (rows === undefined || rows === null) {
    /* NO VERSION BLOCK IS LEGAL and always will be: every inquiry in the record
       today has none, and IS-1 adds an alternative to `basis[]` rather than
       replacing it. But an ORPHANED joined row is not "no block" — it is a
       version's legs with no version, which is the checkGrounds precedent for
       checking the attached arrays even when the anchor is absent. */
    for (let i = 0; i < legRows.length; i++)
      push('VERSION_ORPHAN_ROW', localize('basis-version-grammar.grammar.leg_no_basis_versions', "{place} has no basis_versions[] block to belong to", { place: legPlace(i + 1, String(legRows[i]?.version).slice(0, 48)) }));
    for (let i = 0; i < groundRows.length; i++)
      push('VERSION_ORPHAN_ROW', localize('basis-versions.grammar.basis_version_grounds_i_names', 'basis_version_grounds[{i}] names version \'{String}\' and there is no basis_versions[] block', { i: String(i), String: String(String(groundRows[i]?.version).slice(0, 48)) }));
    return;
  }
  if (!Array.isArray(rows)) {
    push('VERSION_ORPHAN_ROW', localize('basis-version-grammar.grammar.basis_versions_is_not_an', 'basis_versions is not an array'));
    return;
  }

  const byName = new Map();               // name -> index in basis_versions[]
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i];
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      push('VERSION_ORPHAN_ROW', localize('basis-versions.grammar.basis_versions_i_is_not', 'basis_versions[{i}] is not an object', { i: String(i) }));
      continue;
    }
    const name = typeof v.name === 'string' ? v.name.trim() : '';
    if (!name || !VERSION_NAME_RE.test(name)) {
      /* R54: a name outside the form has a code of its own; NOT_UNIQUE is only for a name another version carries */
      push('VERSION_NAME_MALFORMED', localize('basis-versions.grammar.basis_versions_i_name_string', 'basis_versions[{i}].name \'{String}\' is not a version name: 1 to 64 characters of letters, digits, spaces, \'-\', \'_\' and \'.\', naming this account of the evidence so a member can ask for it by name', { i: String(i), String: String(String(v.name).slice(0, 60)) }));
      continue;
    }
    if (byName.has(name)) {
      push('VERSION_NAME_NOT_UNIQUE', localize('basis-versions.grammar.basis_versions_i_names_name', 'basis_versions[{i}] names \'{name}\', which basis_versions[{get}] already names: a version name is unique WITHIN ITS INQUIRY (global uniqueness would make naming absurd), and derived_from reads by name', { i: String(i), name: String(name), get: String(byName.get(name)) }),
        ['rename this version', 'or, if this is an edit of the other, derive it: give it its own name and derived_from the original']);
      continue;
    }
    byName.set(name, i);

    if (typeof v.description !== 'string' || v.description.trim().length < 12) {
      push('VERSION_NO_DESCRIPTION', localize('basis-versions.grammar.basis_versions_i_name_carries', 'basis_versions[{i}] (\'{name}\') carries no description: every version carries a textual description of the composition, held to a commit message\'s standard — what changed and why — because it is what survives a conversation that was deliberately not kept', { i: String(i), name: String(name) }),
        [localize('basis-version-grammar.grammar.describe_what_this_reading_of', 'describe what this reading of the evidence is and why it differs from the others')]);
    }
    if (!VERSION_STATES.includes(v.state)) {
      push('VERSION_STATE_UNKNOWN', localize('basis-versions.grammar.basis_versions_i_name_is', 'basis_versions[{i}] (\'{name}\') is in state \'{String}\': a version is one of {VERSION_STATES}', { i: String(i), name: String(name), String: String(String(v.state).slice(0, 40)), VERSION_STATES: String(VERSION_STATES.join(', ')) }));
    }
    /* PL-3 / IS-4 — THE SUGGESTION KIND, checked at the DOCUMENT gate as well as
       at the endpoint. ABSENT IS LEGAL and always will be: every version a
       member composes by hand carries no kind, and IS-4 adds a machine writer
       rather than replacing the authored path. A kind that is PRESENT and
       outside section 9's five is refused, because what a suggestion claims to
       be decides how it is read. */
    if (v.kind !== undefined && v.kind !== null && v.kind !== ''
        && !Object.prototype.hasOwnProperty.call(SUGGEST_KINDS, String(v.kind).trim())) {
      pushSuggest('VERSION_KIND_UNKNOWN', localize('basis-versions.grammar.basis_versions_i_name_kind', 'basis_versions[{i}] (\'{name}\').kind is \'{String}\': a suggestion is one of {keys} (section 9), and the set is closed so that a run reporting an empty search is distinguishable from a run that reported nothing', { i: String(i), name: String(name), String: String(String(v.kind).slice(0, 40)), keys: String(Object.keys(SUGGEST_KINDS).join(', ')) }),
        [localize('basis-version-grammar.grammar.name_one_of_the_five', 'name one of the five kinds'), localize('basis-version-grammar.grammar.or_leave_kind_out_entirely', 'or leave kind out entirely — a version a member composed is not a suggestion of any kind')]);
    }
    if (v.hidden !== undefined && v.hidden !== null && typeof v.hidden !== 'boolean') {
      push('VERSION_HIDDEN_NOT_BOOLEAN', localize('basis-versions.grammar.basis_versions_i_name_hidden', 'basis_versions[{i}] (\'{name}\').hidden is \'{String}\': hiding a version is a boolean, because hiding it is ALL it does — the version stays in the record and stays queryable (DEC-29(b), D-214), so there is no third value for this field to hold', { i: String(i), name: String(name), String: String(String(v.hidden).slice(0, 40)) }));
    }
    /* PL-2 / IS-2, layer 2 of the reason rule. `versionNeedsReason` is the ONE
       predicate — imported by the six acts (`./index.mjs`) and called here — so the
       two layers cannot come to disagree about which states carry a reason. */
    if (versionNeedsReason(v.state)) {
      const why = typeof v.state_reason === 'string' ? v.state_reason.trim() : '';
      const by = typeof v.state_by === 'string' ? v.state_by.trim() : '';
      if (why.length < 8 || !by || isMachineIdentity(by))
        push('VERSION_DISPOSITION_UNATTRIBUTED', localize('basis-versions.grammar.basis_versions_i_name_is_2', 'basis_versions[{i}] (\'{name}\') is in state \'{state}\' and carries state_by \'{String}\' with state_reason \'{why}\': {VERSION_REASON_REQUIRED} are the two states a member enters WITH a recorded reason (§6 rule 4), and the reason carries the name of the member who authored it — never a machine\'s, because a machine may propose an account of the evidence and may never settle one', { i: String(i), name: String(name), state: String(v.state), String: String(String(v.state_by).slice(0, 40)), why: String(why.slice(0, 40)), VERSION_REASON_REQUIRED: String(VERSION_REASON_REQUIRED.join(' and ')) }),
          ['record state_by (a named member), state_at (an ISO timestamp) and state_reason on this version',
           localize('basis-version-grammar.grammar.or_leave_the_version_suggested', 'or leave the version suggested — a state nobody has moved it into needs no reason')]);
      if (!ISO_TS_RE.test(String(v.state_at || '')))
        push('VERSION_DISPOSITION_UNATTRIBUTED', localize('basis-versions.grammar.basis_versions_i_name_is_3', 'basis_versions[{i}] (\'{name}\') is in state \'{state}\' and requires \'state_at\' as an ISO timestamp (got \'{String}\'): a decision made before a strength was seen is a different act from one made after it, and only a date lets a reader tell', { i: String(i), name: String(name), state: String(v.state), String: String(String(v.state_at).slice(0, 40)) }));
    }
  }

  /* THE DERIVATION EDGE, and the tree it has to be. */
  for (const [name, i] of byName) {
    const df = rows[i].derived_from;
    if (df === undefined || df === null || df === '' || df === 'null') continue;
    if (typeof df !== 'string' || !byName.has(df.trim())) {
      push('VERSION_DERIVED_FROM_UNKNOWN', localize('basis-versions.grammar.basis_versions_i_name_is_4', 'basis_versions[{i}] (\'{name}\') is derived_from \'{String}\', which is not a version of this inquiry: the derivation edge is how alternatives read as a tree rather than a pile', { i: String(i), name: String(name), String: String(String(df).slice(0, 60)) }),
        ['name a version that exists in basis_versions[]', 'or set derived_from: null — a version a run composed fresh has no parent']);
    }
  }
  for (const [name, i] of byName) {
    const seen = new Set([name]);
    let cur = rows[i].derived_from;
    while (typeof cur === 'string' && byName.has(cur.trim())) {
      const p = cur.trim();
      if (seen.has(p)) {
        push('VERSION_DERIVATION_CYCLE', localize('basis-versions.grammar.basis_versions_i_name_sits', 'basis_versions[{i}] (\'{name}\') sits in a derived_from cycle through \'{p}\': versions form a TREE, and a tree has a root — a cycle leaves no answer to which of these came first', { i: String(i), name: String(name), p: String(p) }));
        break;
      }
      seen.add(p);
      cur = rows[byName.get(p)].derived_from;
    }
  }

  /* THE JOINED ARRAYS. Orphans first, so a typo in `version` is named as a typo
     rather than surfacing three checks later as a version with no legs. */
  const legsOf = new Map();               // version name -> [ [index, leg] ]
  for (let i = 0; i < legRows.length; i++) {
    const l = legRows[i];
    const vn = l && typeof l.version === 'string' ? l.version.trim() : '';
    if (!byName.has(vn)) {
      push('VERSION_ORPHAN_ROW', localize('basis-version-grammar.grammar.leg_version_not_in_block', "{place} belongs to a version that is not in basis_versions[]", { place: legPlace(i + 1, String(l?.version).slice(0, 60)) }));
      continue;
    }
    if (!legsOf.has(vn)) legsOf.set(vn, []);
    legsOf.get(vn).push([i, l]);
  }
  /* DEC-65's SINGLE-PART LICENCE NEEDS THE COUNT BEFORE THE VERDICT, which is
     why this pre-pass exists and is not folded into the loop below. The arm that
     judges `asserted_by` runs per ROW, and whether the licence applies is a
     property of the WHOLE VERSION — how many parts it declares. Judging row 1 of
     2 before row 2 has been seen would have exempted the first part of a
     two-part version, which is exactly the widening DEC-65 forbids.
     COUNTED OVER DISTINCT, WELL-FORMED LABELS, deliberately: a malformed label
     and a duplicate label are each already their own C-25.6 finding below, and a
     version does not earn the licence by declaring its one real part twice. */
  const partsOf = new Map();              // version name -> Set(distinct valid label)
  for (const g0 of groundRows) {
    const vn0 = g0 && typeof g0.version === 'string' ? g0.version.trim() : '';
    if (!byName.has(vn0)) continue;
    const l0 = typeof g0.ground === 'string' ? g0.ground.trim() : '';
    if (!l0 || !GROUND_LABEL_RE.test(l0)) continue;
    if (!partsOf.has(vn0)) partsOf.set(vn0, new Set());
    partsOf.get(vn0).add(l0);
  }

  const groundsOf = new Map();            // version name -> Map(label -> row index)
  for (let i = 0; i < groundRows.length; i++) {
    const g = groundRows[i];
    const vn = g && typeof g.version === 'string' ? g.version.trim() : '';
    if (!byName.has(vn)) {
      push('VERSION_ORPHAN_ROW', localize('basis-versions.grammar.basis_version_grounds_i_names_2', 'basis_version_grounds[{i}] names version \'{String}\', which is not in basis_versions[]', { i: String(i), String: String(String(g?.version).slice(0, 60)) }));
      continue;
    }
    const label = typeof g.ground === 'string' ? g.ground.trim() : '';
    if (!label || !GROUND_LABEL_RE.test(label)) {
      push('VERSION_GROUND_UNASSERTED', localize('basis-versions.grammar.basis_version_grounds_i_ground', 'basis_version_grounds[{i}].ground \'{String}\' is not a ground label: up to 48 characters of letters, digits, spaces, \'-\' and \'_\'', { i: String(i), String: String(String(g.ground).slice(0, 60)) }));
      continue;
    }
    if (!groundsOf.has(vn)) groundsOf.set(vn, new Map());
    if (groundsOf.get(vn).has(label)) {
      push('VERSION_GROUND_UNASSERTED', localize('basis-versions.grammar.basis_version_grounds_i_declares', 'basis_version_grounds[{i}] declares \'{label}\' a second time for version \'{vn}\': one ground, one assertion, one member answering for it', { i: String(i), label: String(label), vn: String(vn) }));
      continue;
    }
    groundsOf.get(vn).set(label, i);
    /* REC-46's one predicate, never a word list: `token:member` and `class:member`
       reached the record here when this was asked as a word list.
       AND SINCE PL-19 / DEC-65 SHAPE (b) THE PREDICATE IS ASKED, NEVER THE
       LITERAL. `sufficiencyClaimState` is the ONE place the field's states are
       decided (PL-17), so a fourth state added there reaches this arm without
       this arm being edited — the REC-46 lesson taken a second time.

       THE LICENCE, AND ITS EXACT BOUND. DEC-65 (answered 2026-08-09) permits a
       version that declares EXACTLY ONE part to carry the explicit no-claim
       value in this field, and nothing wider. The arithmetic is the whole
       argument: with one part there is no MAXIMUM to take, so §12 derives the
       same conservative weakest-leg answer whether or not anybody asserted
       independent sufficiency — no member is credited with a structural claim
       they did not make, and DEC-32's default is what you get either way. With
       TWO parts the maximum is live, and an unclaimed part in that maximum is
       precisely the finding-made-stronger-by-nobody this rule exists to refuse.
       So the second case is refused BY NAME below rather than falling through.

       WHAT IS *NOT* LICENSED, stated because a reader will reach for it: a
       MACHINE'S STAMP is still refused on a single-part version. The licence is
       for the record saying `nobody claimed this` OUTRIGHT, never for the record
       saying `a machine claimed this` — those are different findings and the
       second is the overclaim DEC-65 was raised about. A BLANK is still refused
       too: undetermined is first-class only when it is STATED. */
    /* ASKED AS A PREDICATE, AND THE `typeof` ARM IS KEPT BESIDE IT RATHER THAN
       FOLDED IN. `isSufficiencyUnclaimed` coerces (`String(x ?? '')`), which is
       right for a caller-supplied identity and wrong for a frontmatter field
       that may hold a number or an object — so the shape test stays where it
       has always been, in the arm below that already carries it. Absent is not
       machine and is not the no-claim value either: three findings, three arms.

       Two independent `if`s, each answering its own question, so the refusal
       that says a machine may not sign is produced by a guard that visibly asks
       the one predicate (an `if/else if` on a state name once let the licence
       arm answer it). `test/m/basis-versions/sufficiency-state.test.mjs` (R3)
       proves both arms. */
    const singlePart = (partsOf.get(vn)?.size ?? 0) === 1;
    const noClaim = typeof g.asserted_by === 'string' && isSufficiencyUnclaimed(g.asserted_by);
    if (noClaim && !singlePart) {
      push('VERSION_GROUND_UNASSERTED', localize('basis-versions.grammar.basis_version_grounds_i_declares_2', 'basis_version_grounds[{i}] declares \'{label}\' one of {size} separately sufficient parts of version \'{vn}\' and records that nobody asserted it: a reading whose strength is the STRONGEST of its parts takes that maximum over a part somebody signed for, so the explicit no-claim value is open only to a version carrying exactly ONE part, where there is no maximum to take (DEC-65)', { i: String(i), label: String(label), size: String(partsOf.get(vn).size), vn: String(vn) }),
        [localize('basis-version-grammar.grammar.name_the_member_asserting_that', 'name the member asserting that this ground is independently sufficient'),
         localize('basis-versions.grammar.or_put_every_leg_of', 'or put every leg of version \'{vn}\' in ONE part — a reading nobody has asserted the structure of is read as its weakest leg', { vn: String(vn) })]);
    }
    if (!noClaim
        && (typeof g.asserted_by !== 'string' || g.asserted_by.trim() === '' || isMachineIdentity(g.asserted_by))) {
      push('VERSION_GROUND_UNASSERTED', localize('basis-versions.grammar.basis_version_grounds_i_asserted', 'basis_version_grounds[{i}].asserted_by \'{String}\' is not a named member: "these legs are enough on their own" is an authored judgment that makes the finding STRONGER, so it carries the name of the member making it — never a machine\'s, and a machine-composed version PROPOSES the structure rather than asserting it', { i: String(i), String: String(String(g.asserted_by).slice(0, 40)) }),
        [localize('basis-version-grammar.grammar.name_the_member_asserting_that', 'name the member asserting that this ground is independently sufficient'),
         localize('basis-versions.grammar.or_on_a_version_carrying', 'or, on a version carrying exactly ONE part, record \'{SUFFICIENCY_UNCLAIMED}\' — the record saying outright that nobody claimed it, which is not the same as a machine\'s name standing where a member\'s has to be', { SUFFICIENCY_UNCLAIMED: String(SUFFICIENCY_UNCLAIMED) })]);
    }
    if (!ISO_TS_RE.test(String(g.at || ''))) {
      push('VERSION_GROUND_UNASSERTED', localize('basis-versions.grammar.basis_version_grounds_i_requires', 'basis_version_grounds[{i}] requires \'at\' as an ISO timestamp (got \'{String}\'): a structure authored after a strength was seen is a different act from one authored before it (DEC-32), and only a date lets a reader tell', { i: String(i), String: String(String(g.at).slice(0, 40)) }));
    }
  }

  /* PER VERSION: the legs, the partition, and the relationship it claims. */
  for (const [name, i] of byName) {
    const legs = legsOf.get(name) || [];
    const declared = groundsOf.get(name) || new Map();
    const labels = new Set();

    for (const [li, leg] of legs) {
      const place = legPlace(li + 1, name);
      /* MK-4 / C-54.1: the same named refusal at the version's grain. */
      if (leadLegFindings(place, leg, findings)) continue;
      /* D-162 / C-81.1: the theme refusal at the version's grain. */
      if (themeLegFindings(place, leg, findings)) continue;
      const t = leg.target;
      /* R3 (N522; DEC-112 (6)): a leg on another group's finding (`inquiry-grammar` R11's reference) has its form
         judged there (C-21.3) in place of the id, grade and extent arms: it names a finding and one edition, carries
         no grade and no extent. Whether an acceptance is in force is the promotion check's (`./index.mjs`, R6). */
      const lbl = place;
      const imported = importedLegFindings(lbl, leg, findings);
      /* R3 (K3873; N1215): a leg on a calculation, a duty occurrence or a derived connection is judged by the same arms
         as the question's own (`inquiry-grammar` R14, R15, R17), in place of the id, grade and extent arms: its grades are
         derived, so it states none and no part. Role and note are asked as of any leg. */
      const derived = !imported && (calculationLegFindings(lbl, leg, findings) || occurrenceLegFindings(lbl, leg, findings)
                                    || derivedConnectionLegFindings(lbl, leg, findings));
      let standard = false;
      if (imported || derived) {
        /* judged by R11's arm, its findings C-21.3; or by the derived arm just run */
      } else if (typeof t !== 'string' || !BUNDLE_ID_RE.test(t)) {
        push('VERSION_LEG_NOT_CITABLE', localize('basis-version-grammar.grammar.leg_target_not_canonical', "{place} has a target '{String}' that is not a canonical record id", { place, String: String(String(t).slice(0, 40)) }));
      } else if (typeof fm?.id === 'string' && t === fm.id) {
        push('VERSION_LEG_SELF', localize('basis-version-grammar.grammar.leg_rests_on_this_inquiry', "{place} rests on {t}, which is this inquiry: a question is not evidence for its own answer, in any account of it", { place, t: String(t) }));
      } else {
        const tt = normalizeType(OBJECT_TYPES[t.split('-')[0]]);
        /* R10 (K3873; N1251): a held standard is judged by `inquiry-grammar` R13's arm, never refused for its kind; the grade
           and extent arms then stay silent on a leg it refused (a second complaint about one broken field helps nobody) */
        if (tt === 'standard') standard = standardLegFindings(lbl, leg, findings);
        else if (tt !== 'information' && tt !== 'inquiry')
          push('VERSION_LEG_NOT_CITABLE', localize('basis-version-grammar.grammar.leg_target_kind', "{place} has a target '{t}' that is a {tt}: a leg rests on information, a calculation, a duty occurrence, a derived connection or another inquiry, nothing else (D-184)", { place, t: String(t), tt: String(tt) }));
      }
      if (!BASIS_ROLES.includes(leg.role))
        push('VERSION_LEG_NOT_CITABLE', localize('basis-version-grammar.grammar.leg_role', "{place} has a role '{String}' that is not one of: {BASIS_ROLES}", { place, String: String(String(leg.role).slice(0, 40)), BASIS_ROLES: String(BASIS_ROLES.join(', ')) }));
      /* the grade and extent arms do not ask a leg on another group's finding (R11's arm refuses either outright) or a
         derived one (its arm did) */
      if (!imported && !derived && !standard) {
        if (leg.grade !== undefined && leg.grade !== null && !BASIS_GRADES.includes(leg.grade))
          push('VERSION_LEG_NOT_CITABLE', localize('basis-version-grammar.grammar.leg_grade', "{place} has a grade '{String}' that is not one of: {BASIS_GRADES} (absent or null means undetermined, and is STATED as such)", { place, String: String(String(leg.grade).slice(0, 40)), BASIS_GRADES: String(BASIS_GRADES.join(', ')) }));
        if (leg.grade_axis !== undefined && leg.grade_axis !== null && !GRADE_AXES.includes(leg.grade_axis))
          push('VERSION_LEG_NOT_CITABLE', localize('basis-version-grammar.grammar.leg_grade_axis', "{place} has a grade_axis '{String}' that is not one of: {GRADE_AXES}", { place, String: String(String(leg.grade_axis).slice(0, 40)), GRADE_AXES: String(GRADE_AXES.join(', ')) }));
        if (leg.grade_source !== undefined && leg.grade_source !== null && !GRADE_SOURCES.includes(leg.grade_source))
          push('VERSION_LEG_NOT_CITABLE', localize('basis-version-grammar.grammar.leg_grade_source', "{place} has a grade_source '{String}' that is not one of: {GRADE_SOURCES}", { place, String: String(String(leg.grade_source).slice(0, 40)), GRADE_SOURCES: String(GRADE_SOURCES.join(', ')) }));
        /* REC-84 / IC-84 (1): THE EXTENT AT THE VERSION'S OWN GRAIN, C-25.10,
           through the SAME function `basis[]` runs — and it is what retires bound
           (1) in this function's header, which said D-164 was unlanded so a
           version's legs address whole bundles. They no longer must. The header
           bound is corrected there rather than deleted, because a superseded rule
           is corrected with its reason and never quietly removed. */
        /* THE C-NUMBER IS READ OUT OF THE MAP AND NEVER TYPED, which is this
           function's own stated discipline ("`basisVersionFindings` reads the
           C-number OUT of this map at every site"): a second literal is a second
           place for the number to drift. Typed here, that arm once went red. */
        checkLegExtentGrammar(leg, place,
          BASIS_VERSION_GRAMMAR_CHECKS.VERSION_LEG_NOT_CITABLE.check, findings);
      }

      const g = typeof leg.ground === 'string' ? leg.ground.trim() : '';
      /* R3 (`inquiry-grammar` R68): a leg that names no ground is a necessary leg (or, cutting against, in none); one that
         names a ground is judged as any ground a leg names. */
      if (!g) continue;
      if (!GROUND_LABEL_RE.test(g)) {
        push('VERSION_GROUND_UNASSERTED', localize('basis-version-grammar.grammar.leg_ground_not_label', "{place} has a ground '{g}' that is not a ground label", { place, g: String(g.slice(0, 60)) }));
        continue;
      }
      labels.add(g);
      if (!declared.has(g))
        push('VERSION_GROUND_UNASSERTED', localize('basis-version-grammar.grammar.leg_ground_undeclared', "{place} names ground '{g}', which no basis_version_grounds[] row declares: a ground that nobody asserted is independently sufficient cannot be one, and the finding must not take a maximum over a branch no member signed for", { place, g: String(g) }),
          [localize('basis-versions.grammar.add_a_basis_version_grounds', 'add a basis_version_grounds[] row for version \'{name}\', ground \'{g}\', with asserted_by and at', { name: String(name), g: String(g) })]);
    }
    for (const [label, gi] of declared) {
      if (!labels.has(label))
        push('VERSION_ORPHAN_ROW', localize('basis-versions.grammar.basis_version_grounds_gi_declares', 'basis_version_grounds[{gi}] declares \'{label}\' for version \'{name}\', which no leg of that version belongs to: a ground is a partition OF THE LEGS, and an empty one asserts that nothing is sufficient on its own', { gi: String(gi), label: String(label), name: String(name) }));
    }
    /* R3 (fix round 10, cause 30b; K5077; `inquiry-grammar` R68, DEC-32 clause 4): the partition need not cover the legs. A
       supporting leg that names no ground, beside legs that do, is a necessary leg of the version, the unlabelled
       supporting legs together its one necessary part, and no finding; a version with no ground at all is clean. What
       stays refused is each ground's own accounting, above and below: a label in form, declared once, none empty, a
       leg naming one naming a declared one. */

    /* THE RELATIONSHIP: required, and checked AGAINST the partition. */
    const rel = typeof rows[i].relationship === 'string' ? rows[i].relationship.trim().toLowerCase() : '';
    if (!VERSION_RELATIONSHIPS.includes(rel)) {
      push('VERSION_NO_RELATIONSHIP', localize('basis-versions.grammar.basis_versions_i_name_relationship', 'basis_versions[{i}] (\'{name}\').relationship is \'{String}\': every version states how its legs compose — {VERSION_RELATIONSHIPS} — because a version with no relationship field re-ships the flat implicit-AND basis REC-42 corrected, and the two readings give different strengths', { i: String(i), name: String(name), String: String(String(rows[i].relationship).slice(0, 40)), VERSION_RELATIONSHIPS: String(VERSION_RELATIONSHIPS.join(' or ')) }),
        [localize('basis-version-grammar.grammar.relationship_and_every_ground_is', 'relationship: and — every ground is necessary and the finding is no stronger than its weakest leg'),
         localize('basis-version-grammar.grammar.relationship_or_the_grounds_are', 'relationship: or — the grounds are alternatives, each claimed sufficient on its own by a named member')]);
    } else if (labels.size) {
      const implied = labels.size > 1 ? 'or' : 'and';
      if (implied !== rel)
        push('VERSION_RELATIONSHIP_DISAGREES', localize('basis-versions.grammar.basis_versions_i_name_states', 'basis_versions[{i}] (\'{name}\') states relationship \'{rel}\' and is grouped into {size} ground{v1}, which composes as \'{implied}\': the stated relationship is what a member affirms at the accept ceremony, so it must be the one the structure actually has — otherwise an accepter signs for a reading that is not written down', { i: String(i), name: String(name), rel: String(rel), size: String(labels.size), v1: String(labels.size === 1 ? '' : 's'), implied: String(implied) }),
          [localize('basis-version-grammar.grammar.state_relationship_implied', 'state relationship: {implied}', { implied: String(implied) }),
           rel === 'or' ? localize('basis-version-grammar.grammar.or_split_the_legs_into', 'or split the legs into the grounds you meant to be alternatives')
                        : localize('basis-version-grammar.grammar.or_merge_the_grounds_into', 'or merge the grounds into one — legs in one ground are all necessary')]);
    }

    /* DEC-50 / §6.7: THE ATTRIBUTED REGROUP. */
    const parent = typeof rows[i].derived_from === 'string' ? rows[i].derived_from.trim() : '';
    if (parent && byName.has(parent)) {
      const parentLabels = new Set();
      for (const [, l] of (legsOf.get(parent) || []))
        if (typeof l.ground === 'string' && l.ground.trim()) parentLabels.add(l.ground.trim());
      const sameShape = parentLabels.size === labels.size
        && [...labels].every((x) => parentLabels.has(x));
      const parentRel = typeof rows[byName.get(parent)].relationship === 'string'
        ? rows[byName.get(parent)].relationship.trim().toLowerCase() : '';
      if ((!sameShape || parentRel !== rel) && (labels.size || parentLabels.size)) {
        const by = rows[i].regroup_by;
        const note = rows[i].regroup_note;
        if (typeof by !== 'string' || by.trim() === '' || isMachineIdentity(by)
            || !ISO_TS_RE.test(String(rows[i].regroup_at || ''))
            || typeof note !== 'string' || note.trim().length < 8)
          push('VERSION_REGROUP_UNATTRIBUTED', localize('basis-versions.grammar.basis_versions_i_name_regroups', 'basis_versions[{i}] (\'{name}\') regroups the partition it inherited from \'{parent}\' and carries no attributed regroup act: DEC-50 licenses no unattributed structural edit, so the version records regroup_by (a named member, never a machine), regroup_at (an ISO timestamp) and regroup_note (the reason)', { i: String(i), name: String(name), parent: String(parent) }),
            ['record regroup_by, regroup_at and regroup_note on this version',
             localize('basis-version-grammar.grammar.or_leave_the_partition_as', 'or leave the partition as it was inherited — an edit that only changes the evidence is not a regroup')]);
      }
    }
  }
}

/* THE CANONICAL FORM is line-oriented with a fixed field order and a fixed separator, and every value is escaped so
   the encoding is INJECTIVE: two different compositions cannot canonicalise to one string, which is the whole property
   a freeze rests on. Backslash first, then tab and newline, in that order. */
function canon(v) {
  return String(v ?? "").replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n");
}

/* R3, R7: the type a leg's target names. A calculation's id is a row, an occurrence ref and a derived connection's id are
   no bundle's, so each is named for what it is; any other target by its id's prefix. */
function legTargetType(target) {
  const t = String(target || "").trim();
  if (parseOccurrenceRef(t) !== null) return "occurrence";
  if (DERIVED_CONNECTION_ID_RE.test(t)) return "derived_connection";
  return normalizeType(OBJECT_TYPES[t.split("-")[0]]) ?? "";
}

/** R5: the document's version block, normalised into the rows the two tables take, each with its legs, grounds and
 *  composition. THE GROUND ROWS ARE SORTED and the legs are NOT: a ground is a set member, while a leg carries an
 *  ordinal that makes it addressable, so reordering legs IS a change to the composition. What happened TO a version
 *  (state, hidden, who moved it, its affirmation and regroup, author, at, run) is outside the composition, so the
 *  freeze does not shut the state machine. `kind` and a leg's referent are emitted only when present, so every
 *  composition frozen before they existed stays byte-identical. */
export function versionsIn(fm) {
  const rows = Array.isArray(fm?.basis_versions) ? fm.basis_versions : [];
  const legRows = Array.isArray(fm?.basis_version_legs) ? fm.basis_version_legs : [];
  const groundRows = Array.isArray(fm?.basis_version_grounds) ? fm.basis_version_grounds : [];
  const str = (x) => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const name = str(v.name);
    if (name === null) continue;
    const legs = [];
    for (let li = 0; li < legRows.length; li++) {
      const l = legRows[li];
      if (!l || typeof l !== "object" || str(l.version) !== name) continue;
      legs.push({
        /* The row's index in `basis_version_legs[]`, so the projection finds this leg in the content plan resolved
           over the raw array. Not a column and not part of the composition. */
        src_ord: li,
        /* What this leg rests on, inside the composition, only when it is not the whole document (an absent extent
           and `extent_kind: document` are one value, Bob's 5.3). */
        referent: (() => {
          const cid = legContentId(l);
          if (cid) return `id:${cid}`;
          const ce = canonicalExtent(legExtent(l));
          return ce === canonicalExtent({ kind: "document" }) ? null : ce;
        })(),
        target_id: typeof l.target === "string" ? l.target : "",
        target_type: legTargetType(l.target),
        /* R3 (K3873): a derived connection's five fields, inside the composition so the freeze sees them; null on every
           other leg */
        derivation: DERIVATION_FIELDS.some((k) => str(l[k]) !== null) ? DERIVATION_FIELDS.map((k) => str(l[k])) : null,
        role: typeof l.role === "string" ? l.role : "",
        grade: l.grade ?? null, grade_axis: l.grade_axis ?? null, grade_source: l.grade_source ?? null,
        note: typeof l.note === "string" ? l.note : null,
        /* the document's own authored date, never the server's clock */
        at: l.date != null ? String(l.date) : null,
        ground: str(l.ground) ?? "",
        /* D-595 (BOB #34, K182): the capture a leg is pinned to, inside the composition so the freeze sees the pin */
        capture: str(l.extent_capture),
        /* R3 (N522): the edition a leg on another group's finding names, inside the composition so the freeze sees it */
        edition: l.target_edition === undefined || l.target_edition === null || String(l.target_edition).trim() === ""
          ? null : String(l.target_edition).trim(),
      });
    }
    const grounds = groundRows
      .filter((g) => g && typeof g === "object" && str(g.version) === name && str(g.ground) !== null)
      .map((g) => ({ ground: str(g.ground), asserted_by: str(g.asserted_by),
                     at: str(g.at), statement: typeof g.statement === "string" ? g.statement : null }))
      .sort((a, b) => (a.ground < b.ground ? -1 : a.ground > b.ground ? 1 : 0));
    const c = canon;
    const kind = str(v.kind);
    const composition = [
      `name\t${c(name)}`,
      ...(kind === null ? [] : [`kind\t${c(kind)}`]),
      `description\t${c(v.description)}`,
      `claim\t${c(v.claim)}`,
      `relationship\t${c(typeof v.relationship === "string" ? v.relationship.trim().toLowerCase() : "")}`,
      `derived_from\t${c(str(v.derived_from) === "null" ? null : str(v.derived_from))}`,
      ...grounds.map((g) => `ground\t${c(g.ground)}\t${c(g.asserted_by)}\t${c(g.at)}\t${c(g.statement)}`),
      ...legs.map((l, k) => `leg\t${k}\t${c(l.target_id)}\t${c(l.target_type)}\t${c(l.role)}\t${c(l.grade)}\t`
                          + `${c(l.grade_axis)}\t${c(l.grade_source)}\t${c(l.note)}\t${c(l.at)}\t${c(l.ground)}`),
      /* after the leg lines, so a composition with no referent is byte-identical to one frozen before referents */
      ...legs.flatMap((l, k) => (l.referent === null ? [] : [`leg_referent\t${k}\t${c(l.referent)}`])),
      /* and the pin, after the referents and only when a leg carries one, for the same byte-identity reason */
      ...legs.flatMap((l, k) => (l.capture === null ? [] : [`leg_capture\t${k}\t${c(l.capture)}`])),
      /* and the edition a leg on another group's finding names (N522), last, for the same byte-identity reason */
      ...legs.flatMap((l, k) => (l.edition === null ? [] : [`leg_edition\t${k}\t${c(l.edition)}`])),
      /* and a derived connection's derivation (K3873), after those, for the same reason */
      ...legs.flatMap((l, k) => (l.derivation === null ? [] : [`leg_derivation\t${k}\t${l.derivation.map(c).join("\t")}`])),
    ].join("\n");
    out.push({
      name, ord: i,
      description: typeof v.description === "string" ? v.description : "",
      relationship: typeof v.relationship === "string" ? v.relationship.trim().toLowerCase() : "",
      state: typeof v.state === "string" ? v.state : "",
      derived_from: str(v.derived_from) === "null" ? null : str(v.derived_from),
      hidden: v.hidden === true ? 1 : 0,
      kind,
      claim: typeof v.claim === "string" ? v.claim : null,
      /* §14b.7: named, never resolved; a version outlives the run that proposed it */
      run: str(v.run),
      author: str(v.author), at: str(v.at),
      state_by: str(v.state_by), state_at: str(v.state_at),
      state_reason: typeof v.state_reason === "string" ? v.state_reason : null,
      /* DEC-32 clause 4: kept as the record's own text; the read that publishes it splits it */
      affirmed_parts: typeof v.affirmed_parts === "string" && v.affirmed_parts.trim() ? v.affirmed_parts : null,
      regroup_by: str(v.regroup_by), regroup_at: str(v.regroup_at),
      regroup_note: typeof v.regroup_note === "string" ? v.regroup_note : null,
      composition, legs, grounds,
    });
  }
  return out;
}

/** R6: whether a held composition and an offered one are the same version. A composition stored before the
 *  `leg_capture` line existed (K182) is compared with the offered one's `leg_capture` lines left out: that stored form
 *  never froze the pin, so its first re-projection adds the line instead of freezing the version shut. */
export function sameComposition(held, offered) {
  if (held === offered) return true;
  const h = String(held ?? "");
  if (/(^|\n)leg_capture\t/.test(h)) return false;
  return String(offered ?? "").split("\n").filter((x) => !x.startsWith("leg_capture\t")).join("\n") === h;
}

/** R5 (K182): what a submitted version becomes in the document, the one normaliser a writer and a comparison both read
 *  (moved from `#suggestionPersisted`, so `run-productions` compares C-27.5 and C-27.10 against the written form without
 *  a copy). Every value is frontmatter-safe (`fmSafe`, idempotent); a field the write would omit is null (an omitted line
 *  and a blank one are different documents); a ground with no label is dropped; a ground is asserted by the author, or
 *  by the explicit no-claim value when the author is a machine (PL-19 / DEC-65: a machine's stamp never stands where a
 *  member's has to); a leg cites the whole document (`extent_kind: document`) and carries its pinned capture when it
 *  names one (D-595). It normalises no further than the document does. */
export function versionAsWritten({ kind, name, description, claim, relationship, derived_from, run, author, at, level,
                                   observed_at, grounds, legs } = {}) {
  const fs = (x) => fmSafe(x);
  const blank = (x) => !(typeof x === "string" && x.trim() !== "");
  const opt = (x) => (blank(x) ? null : fs(x));
  return {
    version: {
      name: fs(name), kind: fs(kind), description: fs(description), claim: opt(claim),
      relationship: fs(String(relationship ?? "and").trim().toLowerCase()),
      derived_from: opt(derived_from), run: fs(run), author: blank(author) ? null : fs(author), at: fs(at),
      level: opt(level), observed_at: opt(observed_at),
    },
    grounds: (grounds || []).filter((g) => g && !blank(g.ground)).map((g) => ({
      ground: fs(g.ground), asserted_by: isMachineIdentity(author) ? SUFFICIENCY_UNCLAIMED : fs(author ?? ""),
      at: fs(at), statement: opt(g?.statement) })),
    legs: (legs || []).map((l) => ({
      target: fs(l?.target), role: fs(String(l?.role ?? "supports")),
      ground: opt(l?.ground), grade: opt(l?.grade), grade_axis: opt(l?.grade_axis),
      grade_source: opt(l?.grade_source), note: opt(l?.note), date: opt(l?.date),
      /* a leg on another group's finding names its edition and carries no extent (inquiry-grammar R11; N522) */
      ...(isImportedRef(l?.target)
        ? { target_edition: Number.isInteger(l?.target_edition) ? l.target_edition : opt(l?.target_edition == null ? null : String(l.target_edition)) }
        : { extent_kind: "document", ...(blank(l?.extent_capture) ? {} : { extent_capture: fs(l.extent_capture) }) }) })),
  };
}

/** R6: which FIELD moved, for the freeze's refusal — a member told "this changed" without being told what is left to
 *  re-derive the diff the module has already computed. */
export function compositionDiff(before, after) {
  const a = String(before).split("\n"), b = String(after).split("\n");
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const field = String(a[i] ?? b[i]).split("\t")[0];
    if (a[i] === undefined) return word('basis-versions.text.added', { field: String(field) });
    if (b[i] === undefined) return word('basis-versions.text.removed', { field: String(field) });
    return `${field} changed`;
  }
  return "nothing changed";
}

/** R6: this module's grammar as record-core's grammar seam takes it (`registerGrammar`, its R67): it claims
 *  record-grammar R28's C-2.8 slot (`checkInquiryExtension`) whole, after `inquiry-grammar`'s registration, so
 *  record-core runs it at the sub-slot `inquiry-grammar` R6 offers (`rest()`): for an inquiry, after its entry, division
 *  and subject-entity findings and before its grounds and leg findings, where the catalogue's `checkInquiryBasis` called
 *  `basisVersionFindings`. For any other type it adds nothing, so a claimant left to run after an arm that returned
 *  early (record-core R67) changes no finding. */
export const BASIS_VERSION_GRAMMAR = Object.freeze({
  ids: Object.freeze(["C-2.8"]),
  arm(ctx, findings) {
    if (normalizeType(ctx?.fm?.object_type) !== "inquiry") return;
    basisVersionFindings(ctx.fm, findings);
  },
});

const grammarRegistered = new WeakSet();

/** R6: registers `BASIS_VERSION_GRAMMAR` with `record` as `module` (default `basis-versions`: the registrant is unchanged by
 *  the split, so record-core's `module`, `heldBy` and `grammars()` answers stay what they were), once per record, `inquiry-grammar`'s first
 *  (its R6 registration is idempotent), so module order is registration order (K775 (2)) whoever reaches this first. A
 *  record with no seam (a test's stand-in) is left alone; a refusal is a wiring defect and throws, as
 *  `inquiry-grammar`'s does. Answers record-core's answer, or `null` when nothing was registered. */
export function registerBasisVersionGrammar(record, module = "basis-versions") {
  if (!record || typeof record.registerGrammar !== "function" || grammarRegistered.has(record)) return null;
  registerInquiryGrammar(record);
  const answer = record.registerGrammar(module, BASIS_VERSION_GRAMMAR);
  if (answer && answer.ok === false)
    throw new Error(`${module}: record-core refused the version grammar: ${answer.reason}`
                    + `${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
  grammarRegistered.add(record);
  return answer;
}
