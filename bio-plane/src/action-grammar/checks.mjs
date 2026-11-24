/* action-grammar — the action document's arms, readers and rows (requirements: `build/requirements/action-grammar.md`,
 * R1, R2, R3, R7–R15, R20–R28; K6, K64).
 * Since T45 layer 9 (T45-25; N858, N861, N879, N880, N882–N884, N892 (b); `BIO_Action_v0_2.md`): the vocabularies R2 adds,
 * the press arm's `holder` (R8), the override's ground (R15), the action's new fields (R20–R25: `copied`, `partners`,
 * `press_terms`, an entry's `office_status`, `found_elsewhere` and `speaker`, `reply_owed`, `follows_action`, the claim
 * bearings, the stages per law), the audit's arms over them and C-11.1's `owed_by` (R7), and C-117.30–.58, the rows of the
 * codes `actions` and these arms mint (R9; K2845, K2849); C-117.22 retired. The phrasing lists and the
 * finder (R16–R19) are `./phrasings.mjs` and `./finder.mjs`, re-exported here. Each awaiting T46's stamp.
 * Since T46 layer 9 (T46-31; R26; DEC-194, N913; K2953): twenty-four of the C-117.30–.58 rows take their translations from
 * `words.json` by key (`ACTION_GRAMMAR_WORDS`), codes, numbers and `where`s unmoved; awaiting T47's stamp.
 * Since T47 layer 9 (T47-36; R27, N959; R28, N961, K2982): `clockMovesNotMechanical` states R33's mechanical rule by the date
 * alone (a timed entry's instant is `actions`' own arm, its R98), and an absent or malformed `todayIso` passes no entry; the
 * `where`s of the twelve rows whose raising site moved to `action-records` (C-73.2–.5, C-90.2, C-90.6, C-117.39, C-117.48–.52)
 * name `src/action-records/index.mjs`, codes, numbers and translations unmoved; awaiting T48's stamp.
 * Since T41 layer 9 (T41-46a; H30 (1), K2505): R13's `seeks` (`seeksOf`, `seeksFindings`, C-117.29 `SEEKS_REFUSED`) and the
 * outcome `none_exists` (C-94.5's translation names it); R14's C-32.21 `MACHINE_CANNOT_STATE_SEEKS`, `actions`' fence (K2561);
 * each awaiting T42's stamp.
 *
 * Copied from `actions/checks.mjs` in T19 layer 9 with its comments (that file is deleted since, K914; `actions` reads each
 * of these from here): the kinds this instance accepts (`actionKinds`, `kindReadsAsWritten`, `PRODUCT_KINDS`), the records law
 * (`recordsLawRefusal`, `recordsLawFindings`, `recordsLawOf`), the counterparty and its readers, R33's mechanical clock
 * rule, the tier history's reader and arm, the governing-laws reader and arm, `respondsToEdgeFindings` (C-6.1's
 * `responds_to` arm), the records-request lifecycle's reader, `consequenceState` (DEC-14), `checkActionExtension`
 * (C-2.10's action arms and C-11.1), `RESOLUTIONS`, and the rows `actions`' acts mint: C-32.3, C-32.4, C-32.18–C-32.20,
 * C-33.3–C-33.9, C-72, C-73, C-90, C-94, C-101 and C-117 (C-117.5, `PENDING_CLOCKS_BAD_BEFORE`, is `action-clocks`'; N428).
 * Every value, finding and sentence is the copy's, unchanged; only C-73.6's `where` names its new site (stamped by 1.50.0).
 * Since T34 layer 9 (T34-87; DEC-149, K1811): a member reads "your group's Civicsmith" where three sentences said "this
 * instance" or "the plane" (`requestLifecycleOf`'s `says`, C-2.10's kind finding, C-101.1's translation, awaiting T35's stamp).
 * Since T33 layer 9 (K1657): C-117.26–.28, the rows of `actions`' `NO_SUBJECT` (its R62), `MACHINE_CANNOT_SET_PROCEEDING` and
 * `NOT_A_PROCEEDING` (its R65; C-117.28 retired at T48, K3243: `entities`' C-91.9 is the one site), awaiting promotion's stamp; and C-11.1's past date is read on the office's local day
 * (R7, K1444 (iii)) through `civil-time`.
 * Since T27 layer 9: C-117.23–.25 (`actions` R52, R56, R58; DEC-113, N518; awaiting T28's stamp).
 * Since T20 layer 9: C-117.20–.22 (`actions` R52, K899 (7); stamped by 1.51.0), and a member reads "record" where the
 * copy said "bundle" (K899 (1): `respondsToEdgeFindings`' repair here, `actionBasisFindings`' target finding in
 * `./grammar.mjs`); identifiers keep their names.
 *
 * The vocabularies and the leg, ledger, quote and lifecycle grammars are `./grammar.mjs`' (moved from the catalogue),
 * re-exported here so this file is the module's one face; `LAW_LEVELS` is `jurisdictions`' (its R31), re-exported, never
 * a copy. Nothing here imports the catalogue. Pure (R10): no record, no network, and the clock only as
 * `checkActionExtension`'s default when `ctx.nowMs` is not given. */

import { isMachineIdentity, BUNDLE_ID_RE, OBJECT_TYPES, idPattern } from "../record-grammar/index.mjs";
import { ACTION_KINDS, RISK_TIERS, riskTierState, ACTION_BASIS_KINDS, CORRESPONDENCE_DIRECTIONS, actionBasisFindings,
         correspondenceFindings, isQuoteEntry, quoteValue, quoteFindings, QUOTE_KEYS, lifecycleFindings,
         CORRESPONDENCE_STAGES, CORRESPONDENCE_OUTCOMES, DECISION_STAGES, LIFECYCLE_KEYS, lawProposalLabel,
         RFC_RESPONSE_WINDOW_PRECEDENT, SUCCESS_RECORD_ID_RE } from "./grammar.mjs";
import { LAW_LEVELS } from "../../../jurisdictions/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { localDay, isCalendarDate } from "../civil-time/index.mjs";
import { PHRASINGS, PHRASING_KINDS, ASSERTION_RESOLUTIONS, PHRASING_MIN, PHRASING_MAX, SENTENCES_MAX, SENTENCE_MAX,
         RESOLUTION_WORDS_MAX, readAs, phrasingsFor, pointOut, assertionResolutionFindings,
         assertionsUnresolved } from "./finder.mjs";

export { ACTION_KINDS, RISK_TIERS, riskTierState, ACTION_BASIS_KINDS, CORRESPONDENCE_DIRECTIONS, actionBasisFindings,
         correspondenceFindings, isQuoteEntry, quoteValue, quoteFindings, QUOTE_KEYS, lifecycleFindings,
         CORRESPONDENCE_STAGES, CORRESPONDENCE_OUTCOMES, DECISION_STAGES, LIFECYCLE_KEYS, lawProposalLabel, LAW_LEVELS,
         RFC_RESPONSE_WINDOW_PRECEDENT, SUCCESS_RECORD_ID_RE };
/* T45 (R16–R19): the phrasing lists and the finder are `./finder.mjs`' and `./phrasings.mjs`', re-exported here;
   `PHRASING_KINDS` is `jurisdictions`' own binding (its R86), never a copy. */
export { PHRASINGS, PHRASING_KINDS, ASSERTION_RESOLUTIONS, PHRASING_MIN, PHRASING_MAX, SENTENCES_MAX, SENTENCE_MAX,
         RESOLUTION_WORDS_MAX, readAs, phrasingsFor, pointOut, assertionResolutionFindings, assertionsUnresolved };

/* The catalogue's finding shape (record-grammar's, its R11), for the arms here. */
function f(check, severity, message, repairs, code) {
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  if (code) out.code = code;
  return out;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/* R12 (T33-72; S0-10, B0.8, K1470): the subject registry's key shape is record-grammar's one id table's (`idPattern`, its
   R47), never a copy here: a counter of four or more digits, so `ENT-2026-10000` is a key and every key valid before
   stays valid. The finding's sentence is unchanged, so a document written before T33 reads byte-identically. */
const ENTITY_ID_RE = idPattern('ENT');
const UNWRITABLE = /["\\\r\n]/;

/* ---------------------------------------------------------------------------------------------- R7: the endings */

/** R7, R13 (REC-39; D3, K590): HOW A RESOLVED ACTION ENDED, the one array C-2.10's finding, `actionMove`'s
 *  `NO_RESOLUTION` and the published vocabulary (`affordances`) read. Moved from the catalogue in T18 (its only product
 *  importer was `actions`). `completed` is allowed on any kind: the action was carried out and no counterparty's
 *  answer decides it; what happened is the action's own outcome (R26, DEC-14). */
export const RESOLUTIONS = Object.freeze(["complied", "denied", "escalated", "withdrawn", "completed"]);

/* ---------------------------------------------------------------------------------------------- R10: the kinds */

/** R10: the kinds this module's own rules are written for, offered on every instance. Every other kind comes from the
 *  active profiles' combined view (`jurisdictions` R25); no kind, law, office or deadline is written here. */
export const PRODUCT_KINDS = Object.freeze(["records_request", "request_for_comment", "other"]);

/** R10, R40: the kinds this instance accepts on a creation: the product's own, then the view's `action_kinds`. */
export function actionKinds(view) {
  const out = [...PRODUCT_KINDS];
  for (const k of (view && Array.isArray(view.action_kinds) ? view.action_kinds : []))
    if (k && typeof k.kind === "string" && !out.includes(k.kind)) out.push(k.kind);
  return out;
}

/** R4, R41: a kind an action was written with before R10 (the legacy suite, `cpra_request` among them) reads as
 *  written: the audit does not flag it and a revision may carry it forward. Only a creation is asked R10. */
export function kindReadsAsWritten(kind) { return typeof kind === "string" && ACTION_KINDS.includes(kind); }

/* ---------------------------------------------------------------------------------------------- R4–R6: the records law */

/** R4: the longest `law` a records request carries: a citation, never the law's text. */
export const RECORDS_LAW_MAX = 200;

/** R4, R6 (N297, K275): C-2.10's law arm, and the one site that mints `RECORDS_LAW_REFUSED`. `law` is stated only on a
 *  `records_request`, as a string of at most `RECORDS_LAW_MAX` characters with no quote, backslash or line break;
 *  absent reads undetermined. Answers null, or the refusal with its row and each finding (`{check, detail, repairs}`):
 *  the write refuses by it and the audit reports its findings, so the two say one thing. */
export function recordsLawRefusal(fm) {
  if (!fm || typeof fm !== "object" || !Object.prototype.hasOwnProperty.call(fm, "law")) return null;
  const law = fm.law;
  if (law === null || law === undefined || law === "") return null;
  const found = fm.action_kind !== "records_request"
    ? { message: localize('action-grammar.checks.law_is_stated_on_a', 'law is stated on a \'{String}\' action: only a records_request carries the law it is made under (R4)', { String: String(String(fm.action_kind).slice(0, 40)) }), repairs: ["remove law, or make the kind records_request"] }
    : typeof law !== "string" || !law.trim() || law.length > RECORDS_LAW_MAX || UNWRITABLE.test(law)
      ? { message: localize('action-grammar.checks.law_is_not_a_citation', 'law is not a citation of 1 to {RECORDS_LAW_MAX} characters with no quote, backslash or line break (R4)', { RECORDS_LAW_MAX: String(RECORDS_LAW_MAX) }), repairs: ["state the law by its citation"] }
      : null;
  if (!found) return null;
  const row = GOVERNING_LAW_CHECKS.RECORDS_LAW_REFUSED;
  /* DEC-49 REGION is-records-law */
  return { ok: false, reason: "RECORDS_LAW_REFUSED", code: "RECORDS_LAW_REFUSED", check: row.check, translation: row.translation,
           detail: `${found.message}. Nothing was written.`,
           findings: [{ check: "C-2.10", detail: found.message, repairs: found.repairs }] };
  /* END DEC-49 REGION is-records-law */
}

/** R4, R6: the law arm's findings, as the audit reports them (R37), read from `recordsLawRefusal`, each carrying its
 *  code. */
export function recordsLawFindings(fm, findings) {
  const r = recordsLawRefusal(fm);
  if (r) for (const x of r.findings) findings.push(f(x.check, "error", x.detail, x.repairs, r.code));
}

/** R5: the records law's state as the record can support it: `stated` by a member, `machine_stated` (written by a
 *  machine credential before C-32.20's fence, read from its recorded author class and never rewritten), or
 *  `undetermined`. `author` is the recorded author of the version that first stated it, when the caller has it. */
export function recordsLawOf(fm, author = null) {
  const law = fm && typeof fm.law === "string" && fm.law.trim() ? fm.law.trim() : null;
  if (!fm || fm.action_kind !== "records_request" || !law)
    return { state: "undetermined", law: null,
             says: word("action-grammar.says.undetermined_member_stated") };
  if (author && isMachineIdentity(author))
    return { state: "machine_stated", law, by: author,
             says: word('action-grammar.says.machine_stated_machine') };
  return { state: "stated", law, ...(author ? { by: author } : {}), says: word("action-grammar.says.stated_member") };
}

/* ---------------------------------------------------------------------------------------------- R13: what a records request seeks */

/** R13 (T41; H30 (1), intent R33, K2505): the most items one records request's `seeks` states, and the longest part. */
export const SEEKS_MAX = 12;
export const SEEKS_PART_MAX = 200;
const SEEKS_PARTS = ["progression", "entity", "stage"];

/* An item is well formed when it is exactly `{progression, entity, stage}`, each a non-empty string of at most
   SEEKS_PART_MAX characters; answers why not, or null. */
function seeksItemFault(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return "is not a {progression, entity, stage} entry";
  const extra = Object.keys(item).filter((k) => !SEEKS_PARTS.includes(k));
  if (extra.length) return `carries ${extra.map((k) => k.slice(0, 40)).join(", ")}: an entry names only its progression, entity and stage`;
  for (const k of SEEKS_PARTS) {
    const v = item[k];
    if (typeof v !== "string" || !v.trim() || v.length > SEEKS_PART_MAX)
      return `${k} is not a non-empty string of at most ${SEEKS_PART_MAX} characters`;
  }
  return null;
}
const seeksKey = (item) => JSON.stringify(SEEKS_PARTS.map((k) => item[k]));

/** R13: the stages of progression instances a `records_request` asks the records for, as its `seeks` states them: each
 *  well-formed item once, in order, as `{progression, entity, stage}`; `[]` when absent, on another kind, or when `seeks`
 *  is not a list. Pure; never throws. */
export function seeksOf(fm) {
  if (!fm || typeof fm !== "object" || fm.action_kind !== "records_request" || !Array.isArray(fm.seeks)) return [];
  const seen = new Set();
  const out = [];
  for (const item of fm.seeks) {
    if (seeksItemFault(item)) continue;
    const key = seeksKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ progression: item.progression, entity: item.entity, stage: item.stage });
  }
  return out;
}

/** R13: C-117.29 `SEEKS_REFUSED`, the one site that mints it. Pushes one finding for each fault, each carrying the row's
 *  check and code: `seeks` stated on another kind than `records_request` (and nothing more is asked of it); `seeks` not a
 *  list of 1 to SEEKS_MAX items; each malformed item; each item repeating an earlier one; each item whose stage `facts`
 *  says its progression does not declare. `facts.stages` is the caller's reading of `progressions` (`actions` R70):
 *  `{[progression]: [stage key, …]}` for a progression it holds, `null` for one it does not; a progression it names no
 *  entry for is not judged here. Absent `seeks` (undefined or null) pushes nothing. It reads no record; never throws. */
export function seeksFindings(fm, facts, findings) {
  if (!fm || typeof fm !== "object" || fm.seeks === undefined || fm.seeks === null) return;
  const row = ACTION_CATALOGUE_CHECKS.SEEKS_REFUSED;
  const REPAIRS = ["name each stage sought as {progression, entity, stage}, once each, at most twelve, each stage one its progression declares"];
  /* DEC-49 REGION is-seeks */
  const push = (message, repairs = REPAIRS) => findings.push(f(row.check, "error", message, repairs, "SEEKS_REFUSED"));
  if (fm.action_kind !== "records_request") {
    push(localize('action-grammar.checks.seeks_is_stated_on_a', 'seeks is stated on a \'{String}\' action: only a records_request names the stages it asks the records for (R13)', { String: String(String(fm.action_kind).slice(0, 40)) }), ["remove seeks, or make the kind records_request"]);
    return;
  }
  if (!Array.isArray(fm.seeks) || !fm.seeks.length) {
    push(localize('action-grammar.checks.seeks_is_not_a_list_of', 'seeks is not a list of 1 to {SEEKS_MAX} {progression, entity, stage} entries (R13)', { SEEKS_MAX: String(SEEKS_MAX) }));
    return;
  }
  if (fm.seeks.length > SEEKS_MAX)
    push(localize('action-grammar.checks.seeks_holds_length_entries_at', 'seeks holds {length} entries; at most {SEEKS_MAX} (R13)', { length: String(fm.seeks.length), SEEKS_MAX: String(SEEKS_MAX) }));
  const stages = facts && typeof facts === "object" && facts.stages && typeof facts.stages === "object" ? facts.stages : null;
  const seen = new Set();
  fm.seeks.forEach((item, i) => {
    const fault = seeksItemFault(item);
    if (fault) { push(`seeks[${i}] ${fault} (R13)`); return; }
    const key = seeksKey(item);
    if (seen.has(key)) { push(localize('action-grammar.checks.seeks_i_repeats_an_earlier', 'seeks[{i}] repeats an earlier entry: each stage sought is named once (R13)', { i: String(i) })); return; }
    seen.add(key);
    if (!stages || !Object.prototype.hasOwnProperty.call(stages, item.progression)) return;
    const declared = stages[item.progression];
    if (declared === null)
      push(localize('action-grammar.checks.seeks_i_progression_progression_is', 'seeks[{i}].progression \'{progression}\' is not a progression this record holds (R13)', { i: String(i), progression: String(item.progression.slice(0, 40)) }));
    else if (!Array.isArray(declared) || !declared.includes(item.stage))
      push(localize('action-grammar.checks.seeks_i_stage_stage_is', 'seeks[{i}].stage \'{stage}\' is not a stage progression \'{progression}\' declares (R13)', { i: String(i), stage: String(item.stage.slice(0, 40)), progression: String(item.progression.slice(0, 40)) }));
  });
  /* END DEC-49 REGION is-seeks */
}

/* ---------------------------------------------------------------------------------------------- R9: the counterparty */

/** R9 (D1, K590): the named addressee kinds. An office (`kind` absent reads `office`) is named by role and body; the
 *  others (a reporter by role and outlet, an organisation, another civic group) by role and organisation. */
export const ADDRESSEE_KINDS = Object.freeze(["office", "press", "organisation", "group"]);
/** R9: the longest description of an audience addressee. */
export const AUDIENCE_DESCRIPTION_MAX = 500;

/** R9: the counterparty as an office, `{role, body}`, from either shape: the office shape as written, or the earlier
 *  `{state: named, name}` read with its name as the office's role and no body. Null for any other addressee: a named
 *  non-office, an audience, an undetermined or absent one. */
export function counterpartyOffice(cp) {
  if (!cp || typeof cp !== "object" || Array.isArray(cp) || cp.state !== "named") return null;
  if (cp.kind !== undefined && cp.kind !== null && cp.kind !== "office") return null;
  const role = typeof cp.role === "string" && cp.role.trim() ? cp.role.trim() : null;
  const body = typeof cp.body === "string" && cp.body.trim() ? cp.body.trim() : null;
  if (role || body) return { role, body, level: typeof cp.level === "string" ? cp.level : null,
                             entity_id: typeof cp.entity_id === "string" ? cp.entity_id : null, legacy: false };
  const name = typeof cp.name === "string" && cp.name.trim() ? cp.name.trim() : null;
  return name ? { role: name, body: null, level: null, entity_id: typeof cp.entity_id === "string" ? cp.entity_id : null,
                  legacy: true } : null;
}

/** R3, R9, R27: the name a quote's counterparty is matched by: an office as "role, body" (an earlier name as written),
 *  another named addressee as "role, organisation", and none for an audience or an undetermined one. */
export function counterpartyName(cp) {
  const o = counterpartyOffice(cp);
  if (o) return o.legacy || !o.body ? o.role : o.role ? `${o.role}, ${o.body}` : o.body;
  if (!cp || typeof cp !== "object" || Array.isArray(cp) || cp.state !== "named" || !ADDRESSEE_KINDS.includes(cp.kind)) return null;
  const role = typeof cp.role === "string" ? cp.role.trim() : "";
  const org = typeof cp.organisation === "string" ? cp.organisation.trim() : "";
  return role && org ? `${role}, ${org}` : null;
}

/** R8, R9: whether the addressee is an office (`ADDRESSEE_NOT_AN_OFFICE` asks it of a breach action). */
export function addresseeIsOffice(cp) { return !!counterpartyOffice(cp); }

/* ---------------------------------------------------------------------------------------------- R33: the clock's mechanical write */

/** R33 (I-11), R27 (T47; N959): the one machine write to a clock is `deadline-recheck`, which may move a `pending` entry
 *  whose date has passed to `overdue`, and nothing else. Answers, as `[{ord, from, to}]` compared by position, every entry
 *  whose status moved otherwise. This is R33's DATE rule alone: an entry passes once its held `date` is before
 *  `todayIso`'s day, and no time of day is read, so a timed entry (`due_at`, `action-clocks` R3) moved on its own day is
 *  answered like any other; admitting it once its instant has passed is `actions`' own arm (its R98), which filters this
 *  answer. A `todayIso` that names no day passes no entry. */
export function clockMovesNotMechanical(heldClock, nextClock, todayIso) {
  const held = Array.isArray(heldClock) ? heldClock : [];
  const next = Array.isArray(nextClock) ? nextClock : [];
  /* R27: `todayIso`'s day, or null when it names none (before T47 an absent one read as the text "undefined" or "null",
     after every date, and so passed every entry). */
  const today = typeof todayIso === "string" && DATE_RE.test(todayIso.slice(0, 10)) ? todayIso.slice(0, 10) : null;
  const bad = [];
  for (let i = 0; i < Math.max(held.length, next.length); i++) {
    const a = held[i], b = next[i];
    const sa = a && typeof a === "object" ? a.status : undefined;
    const sb = b && typeof b === "object" ? b.status : undefined;
    if (sa === sb) continue;
    const passed = !!today && a && typeof a.date === "string" && DATE_RE.test(a.date) && a.date < today;
    if (sa === "pending" && sb === "overdue" && passed) continue;
    bad.push({ ord: i, from: sa ?? null, to: sb ?? null });
  }
  return bad;
}

/* REC-214 (BOB #33, 2026-09-24, "Risk-tier revision"; BIO_Case_Making_v0_1.md §2, `risk_tier`): A MEMBER'S
 * REVISION OF A TIER IS AN AUTHORED, APPEND-ONLY ACT. `op=actionrisktier` is the one writer of
 * `risk_tier_history[]`; each entry is one revision — the tier it set, the tier it replaced (`prior`), who, when,
 * and the REQUIRED reason — and the act appends, never edits. The reason is stored as the member wrote it; the
 * restricted frontmatter grammar has no escapes, so a quote, backslash or line break is refused, not rewritten. */
export const RISK_TIER_REASON_MAX = 500;
export const RISK_TIER_HISTORY_MAX = 200;

/** REC-214: THE ONE READER OF AN ACTION'S TIER HISTORY. The action's read (`op=projection`'s action block), the
 *  act's own answer read this (R8, proved by `test/m/action-grammar/`), so what a surface is shown and what the bytes hold cannot come
 *  apart (UI-104 renders it; REC-215's labelled machine proposal is read BESIDE it and never inside it).
 *
 *  `revisions` is oldest first, exactly as the act appended them. `intake` is the tier the action held before its
 *  first revision — the tier it was created with — and its author is UNDETERMINED IN WORDS: an intake writes
 *  `risk_tier` with no attribution of its own (UI-85, D-483), so the record cannot say which member stated it,
 *  and saying the action's creator did would be an inference it cannot support. With no revision, `intake` is
 *  the current tier. An entry the grammar cannot read is returned with `readable: false`, never dropped: an
 *  append-only history that silently loses a row is the overwrite this act exists to refuse. */
export function riskTierHistoryOf(fm) {
  const raw = fm && Array.isArray(fm.risk_tier_history) ? fm.risk_tier_history : [];
  const revisions = raw.map((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { ord: i, readable: false };
    const tier = riskTierState(e.tier);
    const prior = riskTierState(e.prior);
    const by = typeof e.by === 'string' && e.by.trim() ? e.by.trim() : null;
    const at = typeof e.at === 'string' && e.at.trim() ? e.at.trim() : null;
    const reason = typeof e.reason === 'string' && e.reason.trim() ? e.reason.trim() : null;
    return { ord: i, readable: tier !== null && tier !== 'undetermined' && prior !== null && !!by && !!at && !!reason,
             tier, tier_words: RISK_TIERS[tier] ?? null, prior, prior_words: RISK_TIERS[prior] ?? null,
             by, at, reason };
  });
  const current = riskTierState(fm ? fm.risk_tier : undefined);
  const intakeTier = revisions.length ? revisions[0].prior : current;
  return {
    current, current_words: RISK_TIERS[current] ?? null,
    intake: { tier: intakeTier, tier_words: RISK_TIERS[intakeTier] ?? null, by: null,
              stated: intakeTier === 'undetermined'
                ? word('action-grammar.member_stated_tier')
                : word('action-grammar.stated_action_created') },
    revisions,
    stated: revisions.length
      ? word('action-grammar.revision_member_reason', { revisions: String(revisions.length), plural: String(revisions.length === 1 ? '' : 's') })
      : word('action-grammar.revised_tier_action'),
  };
}

/** REC-214: C-2.10's tier-history arm. Judges the SHAPE and the CHAIN — each entry names a member, a time, a
 *  reason, a tier of 1, 2 or 3 and the tier it replaced; each `prior` is the tier the entry before it set; and
 *  the last entry's tier is the tier the document states. A chain that does not close is the record claiming a
 *  history its bytes do not carry. It cannot judge whether a reason is a good one, and does not try. */
function riskTierHistoryFindings(fm, findings) {
  if (!Object.prototype.hasOwnProperty.call(fm, 'risk_tier_history') || fm.risk_tier_history === null
      || (Array.isArray(fm.risk_tier_history) && !fm.risk_tier_history.length)) return;
  if (!Array.isArray(fm.risk_tier_history)) {
    findings.push(f('C-2.10', 'error', 'risk_tier_history is not a list of revisions (REC-214)'));
    return;
  }
  if (fm.risk_tier_history.length > RISK_TIER_HISTORY_MAX)
    findings.push(f('C-2.10', 'error', `risk_tier_history holds ${fm.risk_tier_history.length} entries; at most ${RISK_TIER_HISTORY_MAX}`));
  const h = riskTierHistoryOf(fm);
  let prev = null;
  for (const e of h.revisions) {
    if (!e.readable) {
      findings.push(f('C-2.10', 'error', `risk_tier_history[${e.ord}] is not a revision: each names tier (1, 2 or 3), `
        + 'prior, by, at and a reason (REC-214)', ['revise the tier with op=actionrisktier']));
      prev = null; continue;
    }
    if (isMachineIdentity(e.by))
      findings.push(f('C-2.10', 'error', localize('action-grammar.checks.risk_tier_history_ord_by', 'risk_tier_history[{ord}].by \'{by}\' is a machine identity: a risk tier is revised by a member\'s authored act (REC-214)', { ord: String(e.ord), by: String(e.by.slice(0, 40)) })));
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(e.at))
      findings.push(f('C-2.10', 'error', `risk_tier_history[${e.ord}].at '${e.at}' is not a timestamp`));
    if (e.reason.length > RISK_TIER_REASON_MAX)
      findings.push(f('C-2.10', 'error', `risk_tier_history[${e.ord}].reason is longer than ${RISK_TIER_REASON_MAX} characters`));
    if (e.prior === e.tier)
      findings.push(f('C-2.10', 'error', `risk_tier_history[${e.ord}] replaces tier ${e.tier} with itself: a revision changes the tier`));
    if (prev && e.prior !== prev.tier)
      findings.push(f('C-2.10', 'error', localize('action-grammar.checks.risk_tier_history_ord_prior', 'risk_tier_history[{ord}].prior is {prior}, and the revision before it set {tier}: the history does not close (REC-214)', { ord: String(e.ord), prior: String(e.prior), tier: String(prev.tier) })));
    prev = e;
  }
  const last = h.revisions[h.revisions.length - 1];
  if (last && last.readable && last.tier !== h.current)
    findings.push(f('C-2.10', 'error', localize('action-grammar.checks.risk_tier_is_current_and', 'risk_tier is {current} and the last revision in risk_tier_history set {tier}: the tier stated is not the tier the history ends on (REC-214)', { current: String(h.current), tier: String(last.tier) }),
      ['revise the tier with op=actionrisktier']));
}
/* The most citations one act may set. Not a legal bound — a request under three levels names a handful — but
   a statement bound: every entry lands in the document's frontmatter and on every read of the action. */
export const GOVERNING_LAWS_MAX = 12;
/* The longest citation, in characters: a citation names a law ("Cal. Gov. Code § 7920.000 et seq."), it does
   not quote one. */
export const CITATION_MAX = 200;

/** D-149: WHICH LAWS GOVERN THIS ACTION, AS THE RECORD CAN SUPPORT IT. The one reader: the action's own read
 *  (`op=projection`'s action block) reads this function (R8, proved by `test/m/action-grammar/`), so the sentence a reader is shown and
 *  the state it describes cannot come apart.
 *
 *  TWO STATES, AND THE SECOND IS THE ITEM. `stated` — a member set the list, and it is returned exactly as
 *  authored with who set it and when. `undetermined` — no member has stated which laws govern this action, and
 *  the answer SAYS SO IN WORDS rather than returning an empty list a reader would take as "none apply" or,
 *  worse, as the federal default the design's earlier drafts assumed (wrong for Oakland on every axis D-149
 *  lists). Nothing is inferred from the counterparty, the kind or the group.
 *
 *  `cpra_request` IS THE ONE KIND THAT NAMES A LAW, and it is read as exactly that and nothing more: the kind
 *  is its member's statement that the CPRA governs (D-149), so the undetermined sentence names it — and the
 *  LIST stays undetermined, because whether a federal law or a local ordinance also governs is not in the
 *  kind. The document is not rewritten and no citation is synthesised from the kind. */
export function governingLawsOf(fm) {
  const raw = fm && Array.isArray(fm.governing_laws) ? fm.governing_laws : [];
  const laws = raw.filter((l) => l && typeof l === 'object' && !Array.isArray(l))
    .map((l) => ({ level: String(l.level ?? ''), citation: String(l.citation ?? '') }));
  if (laws.length) {
    return { state: 'stated', laws,
             by: typeof fm.governing_laws_by === 'string' && fm.governing_laws_by ? fm.governing_laws_by : null,
             at: typeof fm.governing_laws_at === 'string' && fm.governing_laws_at ? fm.governing_laws_at : null,
             stated: word('action-grammar.governing_law_stated', { laws: String(laws.length), plural: String(laws.length === 1 ? '' : 's') }) };
  }
  /* R41: an action written with an old kind that named a records law reads as written; the sentence says so and
     names no law itself (no outward text of this module names one). */
  const kindNames = fm && fm.action_kind === 'cpra_request';
  return { state: 'undetermined', laws: [], by: null, at: null,
           stated: word('action-grammar.undetermined_member_stated', { value: kindNames ? localize('action-grammar.checks.kind_as_written_named', ' This action\'s kind, as written, named the records law it was made under; the record names no law from it, and nothing else is inferred from the kind.') : '' }) };
}

/** D-149: C-2.10's governing-law arm. Judges the SHAPE of `governing_laws[]` and the coherence of its
 *  attribution; it cannot judge whether a citation is the right law, and says so by not trying — a member
 *  reads the law. Absent or `[]` is the honest undetermined and passes; a list is attributed or it is refused,
 *  because a citation nobody stated is the record asserting a legal frame no member chose. */
function governingLawsFindings(fm, findings) {
  const has = Object.prototype.hasOwnProperty.call(fm, 'governing_laws');
  const by = typeof fm.governing_laws_by === 'string' ? fm.governing_laws_by.trim() : '';
  const at = typeof fm.governing_laws_at === 'string' ? fm.governing_laws_at.trim() : '';
  if (!has || fm.governing_laws === null || (Array.isArray(fm.governing_laws) && !fm.governing_laws.length)) {
    if (by || at)
      findings.push(f('C-2.10', 'error',
        'governing_laws is empty and governing_laws_by/_at name an act that set it: an attribution with no '
        + 'list asserts a statement the document does not carry (D-149)',
        ['set the list with op=actionlaws', 'or remove governing_laws_by and governing_laws_at']));
    return;
  }
  if (!Array.isArray(fm.governing_laws)) {
    findings.push(f('C-2.10', 'error', 'governing_laws is not a list of {level, citation} entries (D-149)'));
    return;
  }
  if (fm.governing_laws.length > GOVERNING_LAWS_MAX)
    findings.push(f('C-2.10', 'error', `governing_laws holds ${fm.governing_laws.length} entries; at most ${GOVERNING_LAWS_MAX}`));
  fm.governing_laws.forEach((l, i) => {
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      findings.push(f('C-2.10', 'error', `governing_laws[${i}] is not a {level, citation} entry`)); return;
    }
    /* R31 (`jurisdictions`): the profile's law levels; D-149's `local`, on an action recorded before, reads as written. */
    if (!LAW_LEVELS.includes(l.level) && l.level !== 'local')
      findings.push(f('C-2.10', 'error', `governing_laws[${i}].level '${l.level}' is not one of: ${LAW_LEVELS.join(', ')}`));
    const c = typeof l.citation === 'string' ? l.citation.trim() : '';
    if (!c) findings.push(f('C-2.10', 'error', `governing_laws[${i}].citation is empty: a law is named by its citation`));
    else if (c.length > CITATION_MAX)
      findings.push(f('C-2.10', 'error', `governing_laws[${i}].citation is longer than ${CITATION_MAX} characters`));
  });
  if (!by || isMachineIdentity(by))
    findings.push(f('C-2.10', 'error',
      by ? `governing_laws_by '${by.slice(0, 40)}' is a machine identity: the laws governing a request are a member's authored statement (D-149)`
         : 'governing_laws carries no governing_laws_by: a list of governing laws is a member\'s authored statement and names who made it (D-149)',
      ['set the list with op=actionlaws, signed in as a member']));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(at))
    findings.push(f('C-2.10', 'error', `governing_laws_at '${at}' is not a timestamp: the act that set the list is dated`));
}
/* The longest `why` a proposal may carry against one citation, in characters. A why says what the proposer
   read the citation off — "the counterparty is a California city agency" — and is never the law's text. */
export const LAW_PROPOSAL_WHY_MAX = 240;
/** D-130 / REC-23: the counterparty is THREE-VALUED, and the shape is `source`'s.
 *
 *  WHAT WAS WRONG. C-2.10 refused an EMPTY counterparty and accepted any
 *  non-empty string, so the intake surfaces' literal `to be named` satisfied
 *  the check by being a string and the record asserted a counterparty it did
 *  not have. That is the overclaiming class, in the one construct that reaches
 *  outside the system — and it is the same pressure D-97 removed at the intake
 *  gate when it made authority three-valued rather than forcing a caller to
 *  invent one. `undetermined` is first-class and must be STATED.
 *
 *  THE SHAPE, and why it is this one. `counterparty` becomes a MAP:
 *
 *      counterparty:
 *        state: named | undetermined
 *        name: City Clerk                 # required under `named`
 *        entity_id: ENT-2026-0007         # OPTIONAL, under `named` only
 *        basis: <why it is not determined> # required under `undetermined`
 *
 *  A one-level map of scalars at two spaces is exactly what the restricted
 *  frontmatter grammar admits (spec 2.2/3.3) and exactly what `source:
 *  {locator, authority, retrieved}` already is. Nothing here nests further:
 *  where a block needed a map AND a list, REC-14 and REC-16 split it into two
 *  TOP-LEVEL keys (`completeness` / `completeness_excluded`, `division` /
 *  `division_apportionment`) because the grammar cannot carry a map holding an
 *  array of objects. The counterparty needs no such split — it is one party,
 *  four scalars — so it is one block and the precedent is untouched.
 *
 *  NO COUNTERPARTY TABLE, and `entity_id` is why the temptation exists. A
 *  separate counterparty registry would be a second subject registry with a
 *  different doctrine attached, and that is exactly where a structural prior by
 *  ROLE would eventually be added — which this project's stance forbids
 *  outright (bad actors are identified BY EVIDENCE, never assumed by role). So
 *  a counterparty that is a known subject POINTS INTO the one registry and the
 *  registry stays the only place a party is described.
 *
 *  WHAT THIS CHECK CANNOT DO, stated rather than implied. (a) It cannot resolve
 *  `entity_id`: the catalog is a pure function over an injected filesystem and
 *  its only resolver seam is `resolveTarget`, which answers for BUNDLE ids.
 *  The shape is checked here; resolution would need a new seam threaded from
 *  `actions`' write, and no caller needs it yet. (b) It cannot detect
 *  invention in general — a member who types "the relevant department" gets
 *  past every rule below. The check is a BOUNDARY, not a prose judge; the
 *  control that stops the invention is the surface's radio pair with no third
 *  option and no default (UI-19), and a check that permits `undetermined`
 *  without a control that OFFERS it just moves the invention one field over.
 *  So exactly ONE placeholder is named here, and it is named because it was
 *  MACHINE-WRITTEN on every action by two intake surfaces rather than typed by
 *  anyone. */
const COUNTERPARTY_STATES = ['named', 'audience', 'undetermined'];
/* The one placeholder, compared case-folded and trimmed. It is the exact string
   `mdFor` wrote in `civicos-ui/app.html` and `src/setup.mjs` until it was
   deleted from both, so a bundle carrying it was written by a machine that had
   no counterparty and said one anyway. */
const COUNTERPARTY_PLACEHOLDER = word('action-grammar.named');
/** REC-24 (g): WHAT A `responds_to` EDGE MUST CARRY, written as
 *  supersedesEdgeFindings' twin and for its stated reason — the first PRODUCER
 *  of a relation arrives together with the relation's requirements, so the
 *  vocabulary never holds a member that means nothing.
 *
 *  ONE requirement, and it is the only one that is a fact about the bytes: the
 *  target is an ACTION id. The edge asserts "this document is what came back
 *  when we asked", and an edge of that name pointing at a question or at
 *  another document asserts a correspondence that never happened — the same
 *  class as a supersedes edge to nothing, which asserts a lineage. Resolution
 *  of the target in the store is enforced at the write, where a resolver exists
 *  (the supersedes precedent, for the same reason).
 *
 *  NO REASON IS REQUIRED, deliberately, and the asymmetry with `supersedes` is
 *  the point rather than an omission. Supersession is a member's JUDGEMENT that
 *  one question replaced another, and an unexplained replacement cannot be
 *  checked. A responds_to edge is not a judgement at all: it records that a
 *  document arrived in answer to an ask, and op=actioncorrespond writes it from
 *  a correspondence entry that already carries the date, the medium, the party
 *  and either the hash or the named account. Demanding prose on top of that
 *  would be asking a member to justify a fact the ledger already holds. */
export function respondsToEdgeFindings(fm, findings) {
  const refs = Array.isArray(fm?.references) ? fm.references : [];
  refs.forEach((r, i) => {
    if (!r || typeof r !== 'object' || r.rel !== 'responds_to') return;
    const target = typeof r.target === 'string' ? r.target : '';
    if (!BUNDLE_ID_RE.test(target) || OBJECT_TYPES[target.split('-')[0]] !== 'action') {
      findings.push(f('C-6.1', 'error',
        `references[${i}] is a responds_to edge whose target '${String(r.target).slice(0, 40)}' is not an ACTION: `
        + `this edge says "this is what came back when we asked", so it points at the ask`,
        ['point the edge at the ACTN- record whose correspondence this answers',
         'or use relates_to, which claims nothing about an exchange']));
    }
  });
}
/** C-2.10's counterparty arm (D-130 / REC-23). See COUNTERPARTY_STATES above for
 *  the shape, why it is `source`'s, why there is no counterparty table, and the
 *  two things this check deliberately cannot do.
 *
 *  THE COHERENCE RULE, which is the half the item's four refusals imply rather
 *  than list: the STATE and the CONTENT must say the same thing. A `named`
 *  counterparty with no name asserts an addressee that is not there; an
 *  `undetermined` counterparty carrying a name (or an `entity_id`, which names
 *  harder — it points at a registry subject) asserts one while wearing the
 *  label that says it does not. Both are the D-130 move in a different field,
 *  so both are refused here rather than left for a reader to notice. */
export function counterpartyFindings(fm, findings) {
  const isPlaceholder = (v) =>
    typeof v === 'string' && v.trim().toLowerCase() === COUNTERPARTY_PLACEHOLDER;
  const REPAIRS = [
    'name the addressee: counterparty.state = named with role and body (an office), or kind press, organisation or group with role and organisation',
    'or describe an audience: counterparty.state = audience with counterparty.description',
    'or state that it is undetermined: counterparty.state = undetermined with an authored counterparty.basis saying why',
  ];
  const cp = fm && typeof fm === 'object' ? fm.counterparty : undefined;

  /* The pre-REC-23 flat shape, and the one every action written before this
     item carries. Named separately from a missing block because the repair is
     different: the fact is present and its shape is wrong, except when the
     "fact" is the machine's own placeholder, which has no fact under it. */
  if (typeof cp === 'string') {
    findings.push(f('C-2.10', 'error', isPlaceholder(cp)
      ? `counterparty is the placeholder '${cp.trim()}', which asserts a counterparty this action does not have (D-130). It is not a name and it is not an honest undetermined`
      : `counterparty '${cp.trim().slice(0, 40)}' is a bare string; it is a block of {state, name, basis} so that "we do not know yet" can be STATED rather than invented`,
      REPAIRS));
    return;
  }
  if (!cp || typeof cp !== 'object' || Array.isArray(cp)) {
    findings.push(f('C-2.10', 'error',
      'counterparty block is missing: an action names who it is addressed to, or states that it is undetermined and why',
      REPAIRS));
    return;
  }

  if (!COUNTERPARTY_STATES.includes(cp.state)) {
    findings.push(f('C-2.10', 'error',
      `counterparty.state '${cp.state}' is not one of: ${COUNTERPARTY_STATES.join(', ')}`, REPAIRS));
    return;
  }

  /* R9 (`jurisdictions` R24; D1, K590): the ADDRESSEE. A named one is an office `{kind?: office, role, body, level?,
     entity_id?}` or a press, organisation or group `{kind, role, organisation}`; an audience is described; never a
     person. The earlier `{state: named, name}` reads as written, its name as the office's (`counterpartyOffice`), and is
     not refused by the audit; a WRITE that states a new counterparty in that shape is refused at the act (R7). Each
     finding names its arm. */
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const name = str(cp.name), role = str(cp.role), body = str(cp.body), basis = str(cp.basis);
  const org = str(cp.organisation), description = str(cp.description);
  const entityId = cp.entity_id === undefined || cp.entity_id === null ? '' : String(cp.entity_id).trim();
  for (const [k, v] of [['name', name], ['role', role], ['body', body], ['organisation', org], ['basis', basis],
                        ['description', description]])
    if (isPlaceholder(v))
      findings.push(f('C-2.10', 'error', `counterparty.${k} is the placeholder '${COUNTERPARTY_PLACEHOLDER}', which is not `
        + 'an addressee or a reason (D-130)', REPAIRS));
  if (cp.state === 'named') {
    const kind = cp.kind === undefined || cp.kind === null ? 'office' : cp.kind;
    if (!ADDRESSEE_KINDS.includes(kind)) {
      findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_kind_string_is_not', 'counterparty.kind \'{String}\' is not one of: {ADDRESSEE_KINDS} (R9, arm: kind)', { String: String(String(cp.kind).slice(0, 40)), ADDRESSEE_KINDS: String(ADDRESSEE_KINDS.join(', ')) }), REPAIRS));
      return;
    }
    if (kind === 'office') {
      if (!name && (!role || !body))
        findings.push(f('C-2.10', 'error', 'counterparty.state is named and the office is not: a named office is stated '
          + 'by its official role and the body it belongs to (R9, arm: office)', REPAIRS));
      if (org)
        findings.push(f('C-2.10', 'error', 'counterparty names an office and carries an organisation: an office is '
          + 'stated by its role and body (R9, arm: office)', REPAIRS));
    } else {
      if (!role || !org)
        findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_is_a_named_kind', 'counterparty is a named {kind} with no {v1}: a {kind_2} addressee is stated by a role and the organisation it belongs to, never a person by name (R9, arm: {kind_3})', { kind: String(kind), v1: String(!role ? 'role' : 'organisation'), kind_2: String(kind), kind_3: String(kind) }), REPAIRS));
      for (const [k, v] of [['body', body], ['name', name], ['level', str(cp.level)]])
        if (v) findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_is_a_named_kind_2', 'counterparty is a named {kind} and carries {k}: only an office carries one (R9, arm: {kind_2})', { kind: String(kind), k: String(k), kind_2: String(kind) }), REPAIRS));
    }
    if (entityId && !ENTITY_ID_RE.test(entityId))
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.checks.counterparty_entity_id_string_is', "counterparty.entity_id '{String}' is not a subject registry key (ENT-YYYY-NNNN)", { String: entityId.slice(0, 40) }),
        ['point entity_id at the office in the subject registry, or omit it: it is optional']));
    holderFindings(cp, kind, findings, REPAIRS);
  } else if (cp.state === 'audience') {
    if (!description)
      findings.push(f('C-2.10', 'error', 'counterparty.state is audience and counterparty.description is empty: an '
        + 'audience addressee is described in words (R9, arm: audience)', REPAIRS));
    else if (description.length > AUDIENCE_DESCRIPTION_MAX || UNWRITABLE.test(String(cp.description)))
      findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_description_is_not_1', 'counterparty.description is not 1 to {AUDIENCE_DESCRIPTION_MAX} characters with no quote, backslash or line break (R9, arm: audience)', { AUDIENCE_DESCRIPTION_MAX: String(AUDIENCE_DESCRIPTION_MAX) }), REPAIRS));
    const asserted = [['name', name], ['role', role], ['body', body], ['organisation', org], ['entity_id', entityId]]
      .filter(([, v]) => v);
    if (asserted.length)
      findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_is_an_audience_and', 'counterparty is an audience and carries {map}: an audience is described, never named (R9, arm: audience)', { map: String(asserted.map(([k]) => k).join(', ')) }), REPAIRS));
    holderFindings(cp, 'audience', findings, REPAIRS);
  } else {
    if (!basis)
      findings.push(f('C-2.10', 'error',
        'counterparty.state is undetermined and counterparty.basis is empty: undetermined is first-class and must be '
        + 'STATED, so an action that does not know who it is addressed to says what it does know (R9, arm: undetermined)',
        ['author counterparty.basis: what has been established so far, and what would settle it']));
    const asserted = [['name', name], ['role', role], ['body', body], ['organisation', org], ['entity_id', entityId]]
      .filter(([, v]) => v);
    if (asserted.length)
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.checks.counterparty_state_is_undetermined_and', 'counterparty.state is undetermined and it carries {map}: the block asserts a counterparty and denies having one in the same breath (R9, arm: undetermined)', { map: String(asserted.map(([k]) => k).join(', ')) }),
        ['set state: named if that is the addressee', 'or clear them and leave the basis to say what is known']));
    holderFindings(cp, 'undetermined', findings, REPAIRS);
  }
}
/** R8 (T45; N879; Actions D12; v0.2 rule 7 "A reporter's name is kept inside the group as the role's holder"): the press
 *  arm may carry the reporter who holds the role, in the bytes the flat text `holder: "<name>"` (K2849: the counterparty
 *  is a one-level map), presented by the reads as `holder: {name}`, which is read here too; the name is 1 to
 *  `HOLDER_NAME_MAX` characters with no quote, backslash or line break. A malformed holder, or one on any other arm, is one
 *  C-2.10 finding naming the arm `holder` (`actions` answers it `COUNTERPARTY_REFUSED`, its R9). Absent (or null) pushes
 *  nothing, so every finding on a counterparty without a holder is unchanged. */
export const HOLDER_NAME_MAX = 200;
function holderFindings(cp, arm, findings, repairs) {
  if (cp.holder === undefined || cp.holder === null) return;
  if (arm !== 'press') {
    const what = arm === 'audience' ? 'an audience' : arm === 'undetermined' ? 'undetermined' : `a named ${arm}`;
    findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_is_what_and_carries', 'counterparty is {what} and carries holder: only a reporter is named, as the holder of the press role (R9, arm: holder)', { what: String(what) }), repairs));
    return;
  }
  const h = cp.holder;
  const name = typeof h === 'string' ? h
    : h && typeof h === 'object' && !Array.isArray(h) && Object.keys(h).every((k) => k === 'name') ? h.name : null;
  if (!(typeof name === 'string' && name.trim() && name.length <= HOLDER_NAME_MAX && !UNWRITABLE.test(name)))
    findings.push(f('C-2.10', 'error', localize('action-grammar.checks.counterparty_holder_is_not_the', 'counterparty.holder is not the reporter\'s name, 1 to {HOLDER_NAME_MAX} characters and no quote, backslash or line break (R9, arm: holder)', { HOLDER_NAME_MAX: String(HOLDER_NAME_MAX) }), repairs));
}
/** D-147: THE LIFECYCLE, READ BACK AS ONE DATED CHAIN — a pure function over one document and a day, so
 *  `actions`' read and any other reader agree by construction. Every entry answers with its stage (or
 *  that none was stated), the entry it follows, the days elapsed since that entry, what followed it, and
 *  its due date: STATED with its citation and whether that citation is on the action's list now, or
 *  UNDETERMINED with the sentence saying so. `due.status` is DERIVED against `today` and nothing else:
 *  `open` (not yet passed, nothing followed), `passed_unanswered`, `followed_by_due`, `followed_after_due`.
 *  It never derives a due date, and it states no rate, pattern or judgement about the body. */
export const DUE_UNDETERMINED_SAYS = word('action-grammar.undetermined_member_stated_next');
const dayNumber = (d) => {
  const s = String(d ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
};
export function requestLifecycleOf(fm, today) {
  const entries = Array.isArray(fm?.correspondence) ? fm.correspondence : [];
  const laws = governingLawsOf(fm).laws.map((l) => l.citation);
  const day = String(today ?? '').slice(0, 10);
  const todayN = dayNumber(day);
  const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
  const ordOf = (v, i) => (/^\d+$/.test(str(v)) && Number(str(v)) < i ? Number(str(v)) : null);
  const followers = entries.map(() => []);
  entries.forEach((e, i) => {
    const p = e && typeof e === 'object' ? ordOf(e.follows, i) : null;
    if (p !== null) followers[p].push(i);
  });
  const chain = entries.map((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { ord: i, unreadable: true };
    const at = str(e.at).slice(0, 10);
    const follows = ordOf(e.follows, i);
    const prevAt = follows !== null && entries[follows] ? str(entries[follows].at).slice(0, 10) : '';
    const elapsed = follows !== null && dayNumber(at) !== null && dayNumber(prevAt) !== null
      ? dayNumber(at) - dayNumber(prevAt) : null;
    const next = followers[i];
    const dueBy = str(e.due_by), dueCite = str(e.due_cite);
    let due;
    if (dueBy && dueCite && dayNumber(dueBy) !== null) {
      const firstAt = next.length ? str(entries[next[0]].at).slice(0, 10) : '';
      const status = next.length
        ? (dayNumber(firstAt) !== null && dayNumber(firstAt) <= dayNumber(dueBy) ? 'followed_by_due' : 'followed_after_due')
        : (todayN !== null && dayNumber(dueBy) < todayN ? 'passed_unanswered' : 'open');
      due = { state: 'stated', by: dueBy, cite: dueCite, on_list: laws.includes(dueCite), status,
              ...(status === 'passed_unanswered' ? { days_past: todayN - dayNumber(dueBy) } : {}) };
    } else {
      due = { state: 'undetermined', says: DUE_UNDETERMINED_SAYS };
    }
    return {
      ord: i, direction: e.direction ?? null, at,
      stage: str(e.stage) || null, stage_stated: !!str(e.stage),
      follows, elapsed_days: elapsed,
      outcome: str(e.outcome) || null,
      ...(str(e.exemptions) ? { exemptions: str(e.exemptions) } : {}),
      ...(isQuoteEntry(e) ? { quote: { amount: str(e.quote_amount), currency: str(e.quote_currency) } } : {}),
      followed_by: next,
      ...(!next.length && todayN !== null && dayNumber(at) !== null ? { days_since: todayN - dayNumber(at) } : {}),
      due,
    };
  });
  return {
    entries: chain,
    passed_unanswered: chain.filter((c) => c.due && c.due.status === 'passed_unanswered').map((c) => c.ord),
    as_of: day,
    says: localize('action-grammar.checks.each_entry_is_dated_as', 'Each entry is dated as recorded and names the entry it follows. Your team\'s Civicsmith derives only the days between entries and whether a STATED due date passed with nothing following it; it encodes no law\'s clock and states no judgement about the body.'),
  };
}

/** DEC-14: what an action's recorded consequence CLAIMS, derived rather than
 *  asserted — a pure function over one document, so `actions`' write, the audit
 *  and any read agree by construction instead of by convention.
 *
 *  THE LINE IS STRUCTURAL AND AT THE WRITE PATH, which is the ruling's own
 *  wording. An action's recorded consequence is an OUTCOME by default: a dated,
 *  capturable, first-party fact about the body — a hearing convened, a study
 *  commissioned — that requires no causal claim at all and is carried at full
 *  strength. Promoting it to an IMPACT claim requires a `rests_on` leg pointing
 *  at evidence that is NOT OUR OWN ACTION: a council member's statement naming
 *  the report, a staff memo referencing it, a hearing record. What is refused
 *  is impact asserted from SEQUENCE ALONE, which is precisely the claim this
 *  record would refuse from a public body.
 *
 *  AND IT IS NOT A REFUSAL. `unproven` is a STATED STATE on R1's shape — no
 *  computed strength on this axis, and it names why — never a fifth grade and
 *  never a low one, because a low grade would say we established it weakly.
 *  So an impact claim with no outside evidence LANDS, and lands saying what it
 *  is. The machine never mints the stronger one (grade_source's discipline).
 *
 *  WHY A DOCUMENT THIS ACTION'S OWN CORRESPONDENCE PRODUCED DOES NOT COUNT: a
 *  reply we elicited is our own action's output. It is excellent evidence about
 *  the BODY (its non-response is fully claimable, DEC-13) and it is no evidence
 *  at all that our asking CAUSED anything — those are different claims and only
 *  one of them is about us. */
export function consequenceState(fm) {
  const c = fm?.consequence;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const claim = c.claim === 'impact' ? 'impact' : 'outcome';
  const description = typeof c.description === 'string' ? c.description.trim() : '';
  const at = typeof c.at === 'string' ? c.at.trim() : '';
  if (claim === 'outcome') {
    return { claim, state: 'recorded', determined: true, grade: null, evidence: [],
             description, at,
             detail: localize('action-grammar.checks.outcome_a_dated_first_party', 'OUTCOME: a dated first-party fact about the body, carried at full strength. It makes no causal claim, so there is nothing here to establish (DEC-14).') };
  }
  /* Our own correspondence's artifacts: elicited by this action, so they are its
     output and not outside evidence for it. */
  const ownArtifacts = new Set((Array.isArray(fm.correspondence) ? fm.correspondence : [])
    .map((e) => (e && typeof e === 'object' && typeof e.artifact_bundle_id === 'string') ? e.artifact_bundle_id : null)
    .filter(Boolean));
  const evidence = (Array.isArray(fm.action_basis) ? fm.action_basis : [])
    .filter((l) => l && typeof l === 'object' && l.kind === 'rests_on'
                && typeof l.target === 'string' && BUNDLE_ID_RE.test(l.target)
                && OBJECT_TYPES[l.target.split('-')[0]] !== 'action'
                && !ownArtifacts.has(l.target))
    .map((l) => l.target);
  if (!evidence.length) {
    return { claim, state: 'unproven', determined: false, grade: null, evidence: [],
             description, at,
             detail: localize('action-grammar.checks.unproven_this_action_claims_impact', 'UNPROVEN: this action claims IMPACT and rests on no evidence outside our own action, so the causal link is asserted from sequence alone. That is not a low score and not a failure — it is what we have not established. Cite something outside us (a statement naming the report, a staff memo, a hearing record) and it becomes a claim like any other (DEC-14).') };
  }
  return { claim, state: 'established', determined: true, grade: null, evidence,
           description, at,
           detail: `IMPACT rests on evidence that is not our own action: ${evidence.join(', ')}.` };
}

/* ---------------------------------------------------------------------------------------------- T45: the new fields */

/** R2 (T45; Actions D3, D4, D12, D13, D15, D18; v0.2 rules 2, 6, 8, 15, 16): the vocabularies of the fields T45 adds, each
 *  frozen, one binding read by every module and published by `affordances` as the others are. */
export const OVERRIDE_GROUNDS = Object.freeze(["legal_deadline", "irreversible_act"]);
export const PRESS_RECORD_TERMS = Object.freeze(["on_record", "background", "off_record"]);
export const FOUND_ELSEWHERE_KINDS = Object.freeze(["press", "report", "decision", "statement", "other"]);
export const BEARINGS = Object.freeze(["new_evidence", "disputed_without_evidence", "not_addressed"]);
export const PROMISE_KINDS = Object.freeze(["embargo", "anonymity", "other"]);
export const CLOCK_OWED_BY = Object.freeze(["group", "body", "undetermined"]);
/** R15, R21, R22, R24: the longest free text one of these fields carries (an act's `what`, a note, the office's words). */
export const FIELD_TEXT_MAX = 500;
/** R20: the most offices one action copies, and the most partners it names. */
export const COPIED_MAX = 20;
export const PARTNERS_MAX = 20;
/** R20, R22: the longest partner role or organisation, and a speaker's member id. */
export const PARTNER_TEXT_MAX = 200;
export const SPEAKER_MAX = 200;
/** R23 (K2859): the longest reason a member gives for whether a reply is owed. */
export const REPLY_OWED_REASON_MAX = 500;
/** R24: the most claims one reply is laid out by. */
export const BEARING_CLAIMS_MAX = 50;

const isBlock = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const stated = (v) => v !== undefined && v !== null;
const extraKeys = (o, keys) => Object.keys(o).filter((k) => !keys.includes(k)).map((k) => k.slice(0, 40));
/* A text of 1 to `max` characters, not blank, with no quote, backslash or line break (R8's text rule). */
const writable = (v, max) => typeof v === 'string' && !!v.trim() && v.length <= max && !UNWRITABLE.test(v);
/* A local date-time `YYYY-MM-DDTHH:MM` with a real date and a time from 00:00 to 23:59. */
const LOCAL_MINUTE_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/;
const isLocalMinute = (v) => typeof v === 'string' && LOCAL_MINUTE_RE.test(v) && isCalendarDate(v.slice(0, 10));
const coded = (message, code, repairs) => f('C-2.10', 'error', message, repairs, code);

/* R15 (K2849): the flat keys a `premise_override` holds in the bytes, the ground's part each carries. */
const GROUND_KEYS = Object.freeze({ ground_kind: 'kind', ground_citation: 'citation', ground_date: 'date', ground_what: 'what',
  ground_when: 'when' });
/** R15 (K2849): a `premise_override` as the reads present it, `{reason, ground}`, from its bytes' flat keys (`reason`,
 *  `ground_kind`, `ground_citation`, `ground_date`, or `ground_what`, `ground_when`): `ground` the parts stated, or null
 *  for an override that states none (one written before T45). An override already presented (`ground` a key) is answered
 *  as given; anything not a block answers null. Pure; never throws. */
export function premiseOverrideOf(po) {
  if (!isBlock(po)) return null;
  if (Object.prototype.hasOwnProperty.call(po, 'ground')) return { reason: po.reason ?? null, ground: po.ground ?? null };
  const ground = {};
  for (const [k, part] of Object.entries(GROUND_KEYS)) if (stated(po[k])) ground[part] = po[k];
  return { reason: po.reason ?? null, ground: Object.keys(ground).length ? ground : null };
}

/** R15 (T45; N884; Actions D3, D18; v0.2 rule 2): the gate's override ground. `override.ground` is
 *  `{kind: "legal_deadline", citation, date}` or `{kind: "irreversible_act", what, when}`; with none, or of another kind,
 *  `OVERRIDE_NO_GROUND`, naming both grounds; a part missing or malformed, or a key the kind lacks, `OVERRIDE_GROUND_REFUSED`
 *  naming the part, one finding each. `actions` asks it at the write that states an override (its R74) and mints the
 *  refusal from the first finding. Pure; never throws; pushes and answers nothing. */
export function overrideGroundFindings(override, findings) {
  const g = isBlock(override) ? override.ground : undefined;
  /* DEC-49 REGION is-override-ground */
  if (!isBlock(g) || !OVERRIDE_GROUNDS.includes(g.kind)) {
    findings.push(coded(`premise_override states no ground: an override rests on one of two grounds, a legal deadline `
      + 'that falls before a determination could be made (legal_deadline: its citation and date) or an imminent '
      + 'irreversible act (irreversible_act: what, and when) (R15)', 'OVERRIDE_NO_GROUND',
      ['state ground: {kind: legal_deadline, citation, date}', 'or ground: {kind: irreversible_act, what, when}']));
    return;
  }
  const parts = g.kind === 'legal_deadline' ? ['kind', 'citation', 'date'] : ['kind', 'what', 'when'];
  const refuse = (part, why) => findings.push(coded(`premise_override.ground.${part} ${why} (R15)`, 'OVERRIDE_GROUND_REFUSED',
    [`state the ${g.kind} ground's ${parts.slice(1).join(' and ')}, and nothing else`]));
  for (const k of extraKeys(g, parts)) refuse(k, `is not a part of a ${g.kind} ground`);
  if (g.kind === 'legal_deadline') {
    if (!writable(g.citation, CITATION_MAX))
      refuse('citation', `is not a citation of 1 to ${CITATION_MAX} characters with no quote, backslash or line break`);
    if (!isCalendarDate(g.date)) refuse('date', `'${String(g.date ?? '').slice(0, 40)}' is not a real calendar date (YYYY-MM-DD)`);
  } else {
    if (!writable(g.what, FIELD_TEXT_MAX))
      refuse('what', `is not 1 to ${FIELD_TEXT_MAX} characters with no quote, backslash or line break`);
    if (!isCalendarDate(g.when) && !isLocalMinute(g.when))
      refuse('when', `'${String(g.when ?? '').slice(0, 40)}' is not a real date (YYYY-MM-DD) or a local time (YYYY-MM-DDTHH:MM)`);
  }
  /* END DEC-49 REGION is-override-ground */
}

/* R20: the key two addressees are equal by: an office by its `entity_id` when it has one, else its role and body; another
   named addressee by its kind, role and organisation; each compared trimmed and case-folded. */
function officeEqual(a, b) {
  if (!a || !b) return false;
  if (a.entity_id && b.entity_id) return a.entity_id.trim() === b.entity_id.trim();
  const k = (o) => `${(o.role ?? '').toLowerCase()}|${(o.body ?? '').toLowerCase()}`;
  return !!(a.role || a.body) && k(a) === k(b);
}
function addresseeKey(cp) {
  const o = counterpartyOffice(cp);
  if (o) return o.entity_id ? `office:ent:${o.entity_id.trim()}` : `office:${(o.role ?? '').toLowerCase()}|${(o.body ?? '').toLowerCase()}`;
  const s = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  return `${s(cp.kind)}:${s(cp.role)}|${s(cp.organisation)}`;
}

/** R20 (T45; N883; Actions D12, D16; v0.2 rule 7 "one action per office addressed, others copied"): `copied`, absent or
 *  0 to `COPIED_MAX` named addressees (never an audience or undetermined), each checked as R8 checks a named counterparty,
 *  the finding naming `copied[i]` (`COUNTERPARTY_REFUSED`), two equal entries or more than `COPIED_MAX` the same; an office
 *  equal to the counterparty's office `COPIED_IS_ADDRESSEE`. Pure; never throws. */
export function copiedFindings(fm, findings) {
  const list = isBlock(fm) ? fm.copied : undefined;
  if (!stated(list)) return;
  const REPAIRS = ['copy each other office by its role and body (or a press, organisation or group by role and organisation), once each, at most twenty'];
  const refused = (message) => findings.push(coded(message, 'COUNTERPARTY_REFUSED', REPAIRS));
  if (!Array.isArray(list)) { refused(`copied is not a list of addressees (R20)`); return; }
  if (list.length > COPIED_MAX) refused(localize('action-grammar.checks.copied_holds_length_addressees_at', 'copied holds {length} addressees; at most {COPIED_MAX} (R20)', { length: String(list.length), COPIED_MAX: String(COPIED_MAX) }));
  const addressee = counterpartyOffice(fm.counterparty);
  const seen = new Set();
  list.forEach((cp, i) => {
    if (!isBlock(cp) || cp.state !== 'named') {
      refused(localize('action-grammar.checks.copied_i_is_not_a', 'copied[{i}] is not a named addressee: an office, a press, organisation or group by role, never an audience or an undetermined one (R20)', { i: String(i) }));
      return;
    }
    const own = [];
    counterpartyFindings({ counterparty: cp }, own);
    if (own.length) { for (const x of own) refused(`copied[${i}]: ${x.message}`); return; }
    const key = addresseeKey(cp);
    if (seen.has(key)) { refused(localize('action-grammar.checks.copied_i_repeats_an_earlier', 'copied[{i}] repeats an earlier copied addressee (R20)', { i: String(i) })); return; }
    seen.add(key);
    /* DEC-49 REGION is-copied */
    if (officeEqual(counterpartyOffice(cp), addressee))
      findings.push(coded(localize('action-grammar.checks.copied_i_is_the_office', 'copied[{i}] is the office the action is addressed to: the addressee is not also copied (R20)', { i: String(i) }),
        'COPIED_IS_ADDRESSEE', ['remove the addressee from copied']));
    /* END DEC-49 REGION is-copied */
  });
}

/** R20 (T45; N883; Actions D16; v0.2 §6 `partners`): `partners`, absent or 0 to `PARTNERS_MAX` organisations by role,
 *  `{role, organisation, entity_id?}`, role and organisation by R8's text rule, `entity_id` a subject registry key; any
 *  other key (a person's name), or a repeated organisation, `PARTNERS_REFUSED` naming the entry. Pure; never throws. */
export function partnersFindings(fm, findings) {
  const list = isBlock(fm) ? fm.partners : undefined;
  if (!stated(list)) return;
  /* DEC-49 REGION is-partners */
  const refused = (message) => findings.push(coded(message, 'PARTNERS_REFUSED',
    ['name each partner organisation once, by {role, organisation} and optionally its entity_id, never a person']));
  if (!Array.isArray(list)) { refused('partners is not a list of {role, organisation, entity_id?} entries (R20)'); return; }
  if (list.length > PARTNERS_MAX) refused(localize('action-grammar.checks.partners_holds_length_entries_at', 'partners holds {length} entries; at most {PARTNERS_MAX} (R20)', { length: String(list.length), PARTNERS_MAX: String(PARTNERS_MAX) }));
  const seen = [];
  list.forEach((p, i) => {
    if (!isBlock(p)) { refused(`partners[${i}] is not a {role, organisation, entity_id?} entry (R20)`); return; }
    const extra = extraKeys(p, ['role', 'organisation', 'entity_id']);
    if (extra.length) { refused(localize('action-grammar.checks.partners_i_carries_extra_a', 'partners[{i}] carries {extra}: a partner is an organisation by role, never a person (R20)', { i: String(i), extra: String(extra.join(', ')) })); return; }
    for (const k of ['role', 'organisation'])
      if (!writable(p[k], PARTNER_TEXT_MAX)) { refused(localize('action-grammar.checks.partners_i_k_is_not', 'partners[{i}].{k} is not 1 to {PARTNER_TEXT_MAX} characters with no quote, backslash or line break (R20)', { i: String(i), k: String(k), PARTNER_TEXT_MAX: String(PARTNER_TEXT_MAX) })); return; }
    if (stated(p.entity_id) && !(typeof p.entity_id === 'string' && ENTITY_ID_RE.test(p.entity_id.trim()))) {
      refused(localize('action-grammar.checks.partners_i_entity_id_string', 'partners[{i}].entity_id \'{String}\' is not a subject registry key (R20)', { i: String(i), String: String(String(p.entity_id).slice(0, 40)) })); return;
    }
    const me = { id: stated(p.entity_id) ? p.entity_id.trim() : null, org: p.organisation.trim().toLowerCase() };
    if (seen.some((o) => (o.id && me.id ? o.id === me.id : o.org === me.org))) { refused(`partners[${i}] repeats an earlier partner (R20)`); return; }
    seen.push(me);
  });
  /* END DEC-49 REGION is-partners */
}

/** R21 (T45; N879; Actions D12; v0.2 rule 8): `press_terms`, absent or `{on_record, embargo_until?, release_at?, note?}`,
 *  `on_record` one of `PRESS_RECORD_TERMS`, the two times local date-times, `note` at most `FIELD_TEXT_MAX` characters by
 *  R8's text rule; malformed or another key `PRESS_TERMS_REFUSED`; on an action whose counterparty is not the press arm
 *  `PRESS_TERMS_NOT_PRESS`. Pure; never throws. */
export function pressTermsFindings(fm, findings) {
  const t = isBlock(fm) ? fm.press_terms : undefined;
  if (!stated(t)) return;
  /* DEC-49 REGION is-press-terms */
  const cp = fm.counterparty;
  if (!(isBlock(cp) && cp.state === 'named' && cp.kind === 'press'))
    findings.push(coded('press_terms is stated on an action not addressed to the press: press terms are noted on a press '
      + 'action (R21)', 'PRESS_TERMS_NOT_PRESS', ['remove press_terms, or address the action to the press']));
  const refused = (message) => findings.push(coded(message, 'PRESS_TERMS_REFUSED',
    ['state press_terms as {on_record, embargo_until?, release_at?, note?}']));
  if (!isBlock(t)) { refused('press_terms is not a block of {on_record, embargo_until?, release_at?, note?} (R21)'); return; }
  const extra = extraKeys(t, ['on_record', 'embargo_until', 'release_at', 'note']);
  if (extra.length) refused(`press_terms carries ${extra.join(', ')}: it holds on_record, embargo_until, release_at and note (R21)`);
  if (!PRESS_RECORD_TERMS.includes(t.on_record))
    refused(localize('action-grammar.checks.press_terms_on_record_string', 'press_terms.on_record \'{String}\' is not one of: {PRESS_RECORD_TERMS} (R21)', { String: String(String(t.on_record ?? '').slice(0, 40)), PRESS_RECORD_TERMS: String(PRESS_RECORD_TERMS.join(', ')) }));
  for (const k of ['embargo_until', 'release_at'])
    if (stated(t[k]) && !isLocalMinute(t[k])) refused(localize('action-grammar.checks.press_terms_k_string_is', 'press_terms.{k} \'{String}\' is not a local date and time (YYYY-MM-DDTHH:MM) (R21)', { k: String(k), String: String(String(t[k]).slice(0, 40)) }));
  if (stated(t.note) && !(typeof t.note === 'string' && t.note.length <= FIELD_TEXT_MAX && !UNWRITABLE.test(t.note)))
    refused(localize('action-grammar.checks.press_terms_note_is_not', 'press_terms.note is not at most {FIELD_TEXT_MAX} characters with no quote, backslash or line break (R21)', { FIELD_TEXT_MAX: String(FIELD_TEXT_MAX) }));
  /* END DEC-49 REGION is-press-terms */
}

/** R22 (T45; N879, N880; Actions D12, D13; v0.2 rules 8, 16): the fields T45 adds to correspondence entry `i`, as
 *  `lifecycleFindings` is asked (at `actions`' R15 and in the audit), over the entry's flat keys (K2849: the parser reads
 *  no map inside a list item; the reads present `office_status: {words, status?}` and `found_elsewhere: {kind, note?}`):
 *  `office_words` (and `office_status`, the status token) only on a `received` entry carrying an `outcome`, `office_words`
 *  1 to `FIELD_TEXT_MAX` characters with no line break, else `OFFICE_STATUS_WITHOUT_OUTCOME`; `office_status` one of
 *  `facts.responseStatuses` (strings, or `{status}` entries as `jurisdictions` R58 holds them), else, or with none handed
 *  in, `OFFICE_STATUS_UNKNOWN`; `found_elsewhere` (the kind token) and `found_elsewhere_note` only on a `received` entry,
 *  else `FOUND_ELSEWHERE_REFUSED`, and with no `artifact_sha` `FOUND_ELSEWHERE_NEEDS_CAPTURE`;
 *  `speaker` only on a `sent` entry, a member id (`member:<id>` or bare) of 1 to `SPEAKER_MAX` characters, else
 *  `SPEAKER_REFUSED`. An entry with none of the three answers nothing. Answers the C-2.10 findings, each with its code.
 *  Pure; never throws. */
export function entryFieldFindings(entries, i, facts) {
  const out = [];
  if (!Array.isArray(entries)) return out;
  const e = entries[i];
  if (!isBlock(e)) return out;
  const at = `correspondence[${i}]`;
  /* DEC-49 REGION is-entry-fields */
  if (stated(e.office_words) || stated(e.office_status)) {
    const outcome = typeof e.outcome === 'string' ? e.outcome.trim() : '';
    if (e.direction !== 'received' || !outcome)
      out.push(coded(localize('action-grammar.checks.at_carries_the_offices_status', '{at} carries the office\'s status with no outcome: the office\'s own wording is quoted beside a received entry\'s outcome, never in its place (R22)', { at: String(at) }), 'OFFICE_STATUS_WITHOUT_OUTCOME', ['record the outcome, then quote the office\'s status beside it']));
    const words = e.office_words;
    if (!writable(words, FIELD_TEXT_MAX))
      out.push(coded(localize('action-grammar.checks.at_office_words_is_not', '{at}.office_words is not the office\'s wording of 1 to {FIELD_TEXT_MAX} characters with no quotation mark, backslash or line break (R22)', { at: String(at), FIELD_TEXT_MAX: String(FIELD_TEXT_MAX) }),
        'OFFICE_STATUS_WITHOUT_OUTCOME', ['quote the office\'s own words as office_words']));
    if (stated(e.office_status)) {
      const held = isBlock(facts) && Array.isArray(facts.responseStatuses)
        ? facts.responseStatuses.map((x) => (isBlock(x) ? x.status : x)).filter((x) => typeof x === 'string') : [];
      if (!held.includes(e.office_status))
        out.push(coded(localize('action-grammar.checks.at_office_status_string_is', '{at}.office_status \'{String}\' is not a status the team\'s jurisdiction profile holds for this kind (R22)', { at: String(at), String: String(String(e.office_status).slice(0, 40)) }), 'OFFICE_STATUS_UNKNOWN', ['quote the office\'s words alone, or name a status the profile holds']));
    }
  }
  if (stated(e.found_elsewhere) || stated(e.found_elsewhere_note)) {
    if (e.direction !== 'received')
      out.push(coded(localize('action-grammar.checks.at_carries_found_elsewhere_on', '{at} carries found_elsewhere on a \'{String}\' entry: a response found elsewhere is something received (R22)', { at: String(at), String: String(String(e.direction).slice(0, 40)) }), 'FOUND_ELSEWHERE_REFUSED'));
    else if (!FOUND_ELSEWHERE_KINDS.includes(e.found_elsewhere)
             || (stated(e.found_elsewhere_note) && !(typeof e.found_elsewhere_note === 'string'
                 && e.found_elsewhere_note.length <= FIELD_TEXT_MAX && !UNWRITABLE.test(e.found_elsewhere_note))))
      out.push(coded(localize('action-grammar.checks.at_found_elsewhere_is_not', '{at}.found_elsewhere is not one of {FOUND_ELSEWHERE_KINDS}, with a found_elsewhere_note of at most {FIELD_TEXT_MAX} characters and no quotation mark, backslash or line break (R22)', { at: String(at), FOUND_ELSEWHERE_KINDS: String(FOUND_ELSEWHERE_KINDS.join(', ')), FIELD_TEXT_MAX: String(FIELD_TEXT_MAX) }), 'FOUND_ELSEWHERE_REFUSED'));
    if (!(typeof e.artifact_sha === 'string' && e.artifact_sha.trim()))
      out.push(coded(localize('action-grammar.checks.at_records_a_response_found', '{at} records a response found elsewhere with no artifact_sha: it is held as a capture, never as an account alone (R22)', { at: String(at) }), 'FOUND_ELSEWHERE_NEEDS_CAPTURE', ['capture where it was found and record its sha256']));
  }
  if (stated(e.speaker)) {
    const sp = e.speaker;
    if (e.direction !== 'sent')
      out.push(coded(localize('action-grammar.checks.at_carries_a_speaker_on', '{at} carries a speaker on a \'{String}\' entry: a speaker spoke for the team in a sending (R22)', { at: String(at), String: String(String(e.direction).slice(0, 40)) }), 'SPEAKER_REFUSED'));
    else if (!(writable(sp, SPEAKER_MAX) && sp.trim().replace(/^member:/, '')))
      out.push(coded(localize('action-grammar.checks.at_speaker_is_not_a', '{at}.speaker is not a member id of 1 to {SPEAKER_MAX} characters (R22)', { at: String(at), SPEAKER_MAX: String(SPEAKER_MAX) }), 'SPEAKER_REFUSED'));
  }
  /* END DEC-49 REGION is-entry-fields */
  return out;
}

/** R23 (T45; S1 §C 2, 8; v0.2 rule 6, §5): `reply_owed` absent, `true` or `false`, else `REPLY_OWED_REFUSED`;
 *  `reply_owed` and `reply_owed_reason` (1 to `REPLY_OWED_REASON_MAX` characters by R8's text rule) are stated together or
 *  not at all, else `REPLY_OWED_REFUSED` (K2859: `actions` R82's reason, answered through here);
 *  `follows_action` absent or `{action, ord?}`, `action` an action's record id, `ord` a non-negative integer, else
 *  `FOLLOWS_ACTION_REFUSED`, and equal to `ctx.bundleId` (the document's own id, when the caller has it)
 *  `FOLLOWS_ACTION_SELF`. Pure; never throws. */
export function actionFieldFindings(fm, ctx, findings) {
  if (!isBlock(fm)) return;
  /* DEC-49 REGION is-action-fields */
  if (stated(fm.reply_owed) && fm.reply_owed !== true && fm.reply_owed !== false)
    findings.push(coded(localize('action-grammar.checks.reply_owed_string_is_not', 'reply_owed \'{String}\' is not true or false (R23)', { String: String(String(fm.reply_owed).slice(0, 40)) }), 'REPLY_OWED_REFUSED',
      ['state reply_owed: false when the body owes the team no reply, or leave it out']));
  /* K2859 (`actions` R82): reply_owed is stated with the member's reason, `reply_owed_reason`, and the reason with it; the
     one site of this condition, so `actions` answers its write through this arm (K231). */
  else if (stated(fm.reply_owed) !== stated(fm.reply_owed_reason)
           || (stated(fm.reply_owed_reason) && !writable(fm.reply_owed_reason, REPLY_OWED_REASON_MAX)))
    findings.push(coded(localize('action-grammar.checks.reply_owed_is_stated_with', 'reply_owed is stated with reply_owed_reason, the member\'s reason of 1 to {REPLY_OWED_REASON_MAX} characters with no quotation mark, backslash or line break, and the reason only with it (R23)', { REPLY_OWED_REASON_MAX: String(REPLY_OWED_REASON_MAX) }), 'REPLY_OWED_REFUSED',
      ['state reply_owed and your reason for it together']));
  const fa = fm.follows_action;
  if (stated(fa)) {
    const ok = isBlock(fa) && !extraKeys(fa, ['action', 'ord']).length && typeof fa.action === 'string'
      && BUNDLE_ID_RE.test(fa.action) && OBJECT_TYPES[fa.action.split('-')[0]] === 'action'
      && (!stated(fa.ord) || (Number.isInteger(fa.ord) && fa.ord >= 0));
    if (!ok)
      findings.push(coded('follows_action is not {action, ord?}: the record id of the action it follows and, optionally, '
        + 'the position of its entry (R23)', 'FOLLOWS_ACTION_REFUSED', ['name the earlier action by its record id']));
    else if (isBlock(ctx) && typeof ctx.bundleId === 'string' && fa.action === ctx.bundleId)
      findings.push(coded('follows_action names this action itself: an action follows an earlier one (R23)',
        'FOLLOWS_ACTION_SELF', ['name the earlier action it follows']));
  }
  /* END DEC-49 REGION is-action-fields */
}

/** R24 (T45; N880; Actions D13; v0.2 rule 16 "laid out claim by claim"): `claims`, 1 to `BEARING_CLAIMS_MAX`
 *  `{claim, bearing, note?}`, `claim` one of `legTargets` (the action's `advances` and `rests_on` targets, handed in), none
 *  twice, `bearing` one of `BEARINGS`, `note` at most `FIELD_TEXT_MAX` characters; each fault `BEARING_REFUSED` naming the
 *  item (its row `action-replies`' C-150, K2845). Asked for a member's layout and a proposal alike. Pure; never throws. */
export function bearingFindings(claims, legTargets, findings) {
  const legs = Array.isArray(legTargets) ? legTargets.filter((x) => typeof x === 'string') : [];
  /* DEC-49 REGION is-bearing */
  const refused = (message) => findings.push(coded(message, 'BEARING_REFUSED',
    [localize('action-grammar.checks.lay_the_reply_out_once', 'lay the reply out once per claim the action put, each with one of: {BEARINGS}', { BEARINGS: String(BEARINGS.join(', ')) })]));
  if (!Array.isArray(claims) || !claims.length || claims.length > BEARING_CLAIMS_MAX) {
    refused(localize('action-grammar.checks.claims_is_not_a_list_of', 'claims is not a list of 1 to {BEARING_CLAIMS_MAX} {claim, bearing, note?} entries (R24)', { BEARING_CLAIMS_MAX: String(BEARING_CLAIMS_MAX) })); return;
  }
  const seen = new Set();
  claims.forEach((c, i) => {
    const at = `claims[${i}]`;
    if (!isBlock(c) || extraKeys(c, ['claim', 'bearing', 'note']).length) { refused(localize('action-grammar.checks.claims_i_is_not_a', '{at} is not a {claim, bearing, note?} entry (R24)', { at })); return; }
    if (typeof c.claim !== 'string' || !legs.includes(c.claim)) { refused(localize('action-grammar.checks.at_claim_string_is_not', '{at}.claim \'{String}\' is not one of the action\'s legs (R24)', { at: String(at), String: String(String(c.claim ?? '').slice(0, 60)) })); return; }
    if (seen.has(c.claim)) { refused(localize('action-grammar.checks.at_repeats_the_claim_claim', '{at} repeats the claim \'{claim}\' (R24)', { at: String(at), claim: String(c.claim.slice(0, 60)) })); return; }
    seen.add(c.claim);
    if (!BEARINGS.includes(c.bearing)) refused(localize('action-grammar.checks.at_bearing_string_is_not', '{at}.bearing \'{String}\' is not one of: {BEARINGS} (R24)', { at: String(at), String: String(String(c.bearing ?? '').slice(0, 40)), BEARINGS: String(BEARINGS.join(', ')) }));
    else if (stated(c.note) && !(typeof c.note === 'string' && c.note.length <= FIELD_TEXT_MAX)) refused(localize('action-grammar.checks.at_note_is_longer_than', '{at}.note is longer than {FIELD_TEXT_MAX} characters (R24)', { at: String(at), FIELD_TEXT_MAX: String(FIELD_TEXT_MAX) }));
  });
  /* END DEC-49 REGION is-bearing */
}

/* R25: every stage of the records-request lifecycle, either direction. */
const ALL_STAGES = Object.freeze([...CORRESPONDENCE_STAGES.sent, ...CORRESPONDENCE_STAGES.received]);
const lawStageKnown = (item) => isBlock(item) && typeof item.stage === 'string' && ALL_STAGES.includes(item.stage);

/** R25 (T45; N858; v0.2 §5 "Which stages a law has comes from the profile"; `jurisdictions` R76): one `LAW_STAGE_UNKNOWN`
 *  finding per item of a records law's profile `stages` whose `stage` is not a stage of `CORRESPONDENCE_STAGES`, naming
 *  it; `[]` for a well-formed list, or no list. Pure; never throws. */
export function lawStagesFindings(stages) {
  if (!Array.isArray(stages)) return [];
  const out = [];
  /* DEC-49 REGION is-law-stages */
  stages.forEach((item, i) => {
    if (!lawStageKnown(item))
      out.push(coded(localize('action-grammar.checks.stages_i_stage_string_is', 'stages[{i}].stage \'{String}\' is not a stage of a records request: one of {ALL_STAGES} (R25)', { i: String(i), String: String(String(isBlock(item) ? item.stage : item).slice(0, 40)), ALL_STAGES: String(ALL_STAGES.join(', ')) }), 'LAW_STAGE_UNKNOWN',
        ['name the law\'s stage by the record\'s stage it is, or leave it out']));
  });
  /* END DEC-49 REGION is-law-stages */
  return out;
}

/** R25: whether `stage` is one of the law's `stages` (`in_law`, `not_in_law`), or `undetermined` when the stages are not
 *  held (absent, or not a list); never `in_law` by default, and never for a stage `lawStagesFindings` reports. Pure;
 *  never throws. */
export function stageInLaw(stage, stages) {
  if (!Array.isArray(stages)) return 'undetermined';
  return stages.some((item) => lawStageKnown(item) && item.stage === stage) ? 'in_law' : 'not_in_law';
}

/** R7 (K1444 (iii)): the local day of `nowMs` in `zone` (`civil-time.localDay`), or null with no zone, an unknown one or
 *  an unreadable time: a pending clock entry is past its date only once that day is after the entry's, and with no
 *  local day nothing is past, never the UTC day. */
function localTodayOf(nowMs, zone) {
  const z = typeof zone === "string" && zone.trim() ? zone.trim() : null;
  const n = Number(nowMs);
  if (!z || !Number.isFinite(n) || Math.abs(n) > 8.64e15) return null;
  const instant = new Date(Math.floor(n / 1000) * 1000).toISOString().replace(".000Z", "Z");
  let d = null;
  try { d = localDay(instant, z); } catch { d = null; }
  return typeof d === "string" ? d : null;
}

/** R37: C-2.10's action arms and C-11.1 over one action's document, as the audit runs them (`ctx.fm`, `ctx.nowMs`;
 *  `ctx.actionKinds`, the instance's R10 set, when the caller has it; `ctx.zone`, the IANA zone of the action's office
 *  or venue, R7; `ctx.bundleId`, the document's own id, when the caller has it, R23). */
export function checkActionExtension(ctx, findings) {
  if (ctx?.fm?.object_type !== 'action') return;
  const fm = ctx.fm;
  actionBasisFindings(fm, findings);
  correspondenceFindings(fm, findings);
  /* R10: a kind this instance offers; a kind an action was written with before reads as written (R4). */
  const kinds = Array.isArray(ctx.actionKinds) ? ctx.actionKinds : PRODUCT_KINDS;
  if (!kinds.includes(fm.action_kind) && !kindReadsAsWritten(fm.action_kind))
    findings.push(f('C-2.10', 'error', localize('action-grammar.checks.action_kind_action_kind_is', 'action_kind \'{action_kind}\' is not a kind your team\'s Civicsmith offers', { action_kind: String(fm.action_kind) })));
  recordsLawFindings(fm, findings);
  /* D-182: 1, 2, 3 or undetermined (absent reads undetermined); the words are RISK_TIERS'. */
  if (riskTierState(fm.risk_tier) === null) findings.push(f('C-2.10', 'error', `risk_tier '${fm.risk_tier}' is not one of ${Object.keys(RISK_TIERS).join(', ')}`));
  counterpartyFindings(fm, findings);
  governingLawsFindings(fm, findings);
  riskTierHistoryFindings(fm, findings);
  /* REC-39: the four words are RESOLUTIONS at module level (exported for
     op=affordances) so this finding, op=actionmove's own refusal and the
     published vocabulary read one array — the ACTION_KINDS line above exactly.
     The SENTENCE is derived from the array too: it used to transcribe the four
     words a second time inside the same statement that tested them, which is a
     copy at a distance of ten characters and is how a list and its own
     description come to disagree. */
  if (fm.current_state === 'resolved' && !RESOLUTIONS.includes(fm.resolution)) {
    findings.push(f('C-2.10', 'error', `resolved state requires resolution in: ${RESOLUTIONS.join(', ')}`));
  }
  // C-11: clock discipline
  const clock = Array.isArray(fm.clock) ? fm.clock : [];
  /* R7 (K1444 (iii)): the office's local day, never the UTC day; with no zone, no entry is past its date. */
  const today = localTodayOf(ctx.nowMs ?? Date.now(), ctx.zone);
  const STATUSES = ['pending', 'met', 'overdue', 'waived'];
  for (let i = 0; i < clock.length; i++) {
    const e = clock[i];
    if (!e || !e.text || !e.description) {
      findings.push(f('C-11.1', 'error', `clock[${i}] lacks the dual-audience {text, description} shape`)); continue;
    }
    if (!DATE_RE.test(e.date || '')) findings.push(f('C-11.1', 'error', localize('action-grammar.checks.clock_i_date_date_is', 'clock[{i}].date \'{date}\' is not YYYY-MM-DD', { i: String(i), date: String(e.date) })));
    if (typeof e.basis !== 'string' || e.basis.trim() === '') {
      findings.push(f('C-11.1', 'error', `clock[${i}] has no basis (the statute, order, or commitment the date derives from)`, ['supply basis']));
    }
    if (!STATUSES.includes(e.status)) findings.push(f('C-11.1', 'error', `clock[${i}].status '${e.status}' is not one of: ${STATUSES.join(', ')}`));
    /* R7 (T45; N882; Actions D15): who owes the date, when stated; absent reads undetermined, never defaulted. */
    if (e.owed_by !== undefined && e.owed_by !== null && !CLOCK_OWED_BY.includes(e.owed_by))
      findings.push(f('C-11.1', 'error', `clock[${i}].owed_by '${String(e.owed_by).slice(0, 40)}' is not one of: ${CLOCK_OWED_BY.join(', ')}`,
        [localize('action-grammar.checks.state_who_owes_the_date', 'state who owes the date: the team, the body, or undetermined')]));
    if (today && DATE_RE.test(e.date || '') && e.date < today && e.status === 'pending') {
      findings.push(f('C-11.1', 'error', `clock[${i}] '${e.text}' is silently past-due (${e.date} < today, status still pending)`,
        ['mark overdue', 'mark met', 'mark waived with reason']));
    }
  }
  /* R7 (T45): the fields T45 adds, each pushing nothing on a document written before it. An override written before T45
     states no ground and reads as written; `office_status.status` is judged at the act, against the profile as it stands
     then, never over history (so the audit hands no facts and drops that one code). */
  const override = premiseOverrideOf(fm.premise_override);
  if (override && override.ground !== null) overrideGroundFindings(override, findings);
  copiedFindings(fm, findings);
  partnersFindings(fm, findings);
  pressTermsFindings(fm, findings);
  const entries = Array.isArray(fm.correspondence) ? fm.correspondence : [];
  for (let i = 0; i < entries.length; i++)
    for (const x of entryFieldFindings(entries, i)) if (x.code !== 'OFFICE_STATUS_UNKNOWN') findings.push(x);
  actionFieldFindings(fm, { bundleId: ctx.bundleId }, findings);
}

/* The action layer's machine fences (C-32.3, C-32.4, C-32.18, C-32.19), split out of legacy-checks' MACHINE_FENCE_CHECKS
   whole, as strength took C-32.9 (K181 (3)). */
export const ACTION_FENCE_CHECKS = {
  MACHINE_CANNOT_MOVE_ACTION: {
    check: 'C-32.3',
    where: 'src/actions/index.mjs actionMove > is-machine-move-action',
    translation: word('refusal.MACHINE_CANNOT_MOVE_ACTION'),
  },
  /* REC-189 — D-182's ruling on the write side (BOB #21: *"Only a member's authored act sets 1, 2 or 3"*).
     Refuses a CHANGE of tier by a machine, never a presence: carrying a member's tier forward unchanged is
     not refused, nor is leaving undetermined a tier no member ever set. BOB #32 (2026-09-24 01:44Z): dropping a
     member's tier to undetermined IS a change and is refused. REC-214 (BOB #33, 2026-09-24): the same code refuses a
     machine at `op=actionrisktier`, the member's revision act, so the condition lives in ONE helper both `promote`'s
     action block and the act ask (`#machineRiskTierRefusal`) — one code, one site, one region. */
  MACHINE_CANNOT_SET_RISK_TIER: {
    check: 'C-32.19',
    where: 'src/actions/index.mjs #machineRiskTierRefusal > is-machine-set-risk-tier',
    translation: localize('action-grammar.checks.a_risk_tier_tells_whoever', 'A risk tier tells whoever reads this action whether it is safe to file, needs caution, or must not be filed without a lawyer, and somebody has to be answerable for that judgement. The credential that asked here is an automated one: it can carry forward the tier a member set, and where no member has set one it can leave the tier unstated, but it cannot set, change or remove one. Sign in to state the tier yourself.'),
  },
  MACHINE_CANNOT_CORRESPOND: {
    check: 'C-32.4',
    where: 'src/action-records/index.mjs correspondFence > is-machine-correspond',
    translation: word('refusal.MACHINE_CANNOT_CORRESPOND'),
  },
  /* D-149 (BIO_Case_Making_v0_1.md §2): stating which laws govern a records request is a member's authored
     act — the design's words are *set by a member's authored act*, and a machine may PROPOSE a list, labelled
     as machine work, and never set it. No proposal is built; the fence is the half that is. */
  MACHINE_CANNOT_SET_LAWS: {
    check: 'C-32.18',
    where: 'src/actions/index.mjs actionLaws > is-machine-set-laws',
    translation: word('refusal.MACHINE_CANNOT_SET_LAWS'),
  },
};

/* C-33.3–C-33.9, split out of legacy-checks' ACT_SHAPE_CHECKS the same way. */
export const ACTION_ACT_CHECKS = {
  NO_RESOLUTION: {
    check: 'C-33.3',
    where: 'src/actions/index.mjs actionMove > is-move-resolution',
    translation: word('refusal.NO_RESOLUTION'),
  },
  RESOLUTION_WITHOUT_RESOLVING: {
    check: 'C-33.4',
    where: 'src/actions/index.mjs actionMove > is-move-resolution',
    translation: word('refusal.RESOLUTION_WITHOUT_RESOLVING'),
  },
  BAD_DIRECTION: {
    check: 'C-33.5',
    where: 'src/actions/index.mjs actionCorrespond > is-correspond-direction',
    translation: word('refusal.BAD_DIRECTION'),
  },
  BAD_DATE: {
    check: 'C-33.6',
    where: 'src/action-records/index.mjs correspondEntryRefusal > is-correspond-entry',
    translation: word('refusal.BAD_DATE'),
  },
  CAPTURE_AND_TESTIMONY: {
    check: 'C-33.7',
    where: 'src/action-records/index.mjs correspondEntryRefusal > is-correspond-entry',
    translation: word('refusal.CAPTURE_AND_TESTIMONY'),
  },
  NEITHER_CAPTURE_NOR_TESTIMONY: {
    check: 'C-33.8',
    where: 'src/action-records/index.mjs correspondEntryRefusal > is-correspond-entry',
    translation: word('refusal.NEITHER_CAPTURE_NOR_TESTIMONY'),
  },
  UNREGISTERED_ARTIFACT: {
    check: 'C-33.9',
    where: 'src/action-records/index.mjs unregisteredArtifact > is-correspond-artifact',
    translation: word('refusal.UNREGISTERED_ARTIFACT'),
  },
};

/* =========================================================================
 * D-149 — THE GOVERNING-LAW FAMILY (C-73). `BIO_Case_Making_v0_1.md` §2, *A RECORDS REQUEST NAMES EVERY LAW
 * THAT GOVERNS IT* (Bob, 2026-09-22).
 *
 * The list is set by ONE act, `op=actionlaws`, and by nothing else — not at creation, not by a revision through
 * `op=promote`. That is what makes "an action with none reads undetermined" true of the BYTES and not only of a
 * read: a writer that filled a citation in at creation would pass every read-side assertion while the record
 * asserted a legal frame no member chose, so the creation arm is refused BY NAME (GOVERNING_LAWS_REWRITTEN).
 * The machine fence is C-32.18, in its own family.
 *
 * THE FOUR SHAPE ROWS MOVED THEIR `where` FROM `actionLaws` TO `#lawEntries` ON 2026-09-24 (REC-195), and the
 * move is the row's own rule working rather than a tidy-up: REC-195 adds a SECOND act that takes a list of
 * citations — `op=actionlawspropose`, the machine's PROPOSAL — and a `where` names THE SMALLEST SPAN IN WHICH
 * THE REFUSAL IS ENFORCED. Two acts each enforcing these four conditions in their own body would be two spans
 * for one row, which is the shape D-484 had to consolidate for `NO_BASIS`. So the grammar is one private helper
 * both acts ask, the region travelled with it unchanged, and the codes, the C-numbers and the translations are
 * the same four a member already meets.
 *
 * T47 (R28; N961, K2982): the helper moved with the governing-law acts to `action-records` (its `lawEntries`), and the four
 * rows' `where` with it; `actions` answers its acts through it.
 * ========================================================================= */
export const GOVERNING_LAW_CHECKS = {
  GOVERNING_LAWS_REWRITTEN: {
    check: 'C-73.1',
    where: 'src/actions/index.mjs #lawsFence > is-promote-governing-laws',
    translation: word('refusal.GOVERNING_LAWS_REWRITTEN'),
  },
  NO_LAWS: {
    check: 'C-73.2',
    where: 'src/action-records/index.mjs lawEntries > is-laws-entry',
    translation: word('refusal.NO_LAWS'),
  },
  BAD_LAW_LEVEL: {
    check: 'C-73.3',
    where: 'src/action-records/index.mjs lawEntries > is-laws-entry',
    /* N246 (R18): the levels are the profile's (`jurisdictions` R31), named here from `LAW_LEVELS` itself. */
    translation: word('refusal.BAD_LAW_LEVEL', { law_levels: String(LAW_LEVELS.join(', ')) }),
  },
  BAD_CITATION: {
    check: 'C-73.4',
    where: 'src/action-records/index.mjs lawEntries > is-laws-entry',
    translation: word('refusal.BAD_CITATION'),
  },
  TOO_MANY_LAWS: {
    check: 'C-73.5',
    where: 'src/action-records/index.mjs lawEntries > is-laws-entry',
    translation: word('refusal.TOO_MANY_LAWS'),
  },
  /* D-695 (R6): C-2.10's records-law arm (R4) at the write, a member's and a machine's alike: C-32.20 asks WHO
     states a law, this asks whether what is stated is a citation on a records request at all. */
  RECORDS_LAW_REFUSED: {
    check: 'C-73.6',
    where: 'src/action-grammar/checks.mjs recordsLawRefusal > is-records-law',
    translation: word('refusal.RECORDS_LAW_REFUSED'),
  },
};

/* D-148 / C-72 — A FEE QUOTE IS EVIDENCE (`BIO_Case_Making_v0_1.md` §2). The refusals of the quote grammar
 * (`quoteFindings`, which C-2.10 also reports over the document, each finding carrying the same code) and of
 * its read. The rule lives in ONE pure function; op=actioncorrespond refuses by these names before anything is
 * written, and op=actionquotes refuses a read that names neither axis. None of them judges a quote. */
export const QUOTE_CHECKS = {
  QUOTE_NOT_ON_RECEIVED: {
    check: 'C-72.1',
    where: 'src/actions/index.mjs actionCorrespond > is-quote-grammar',
    translation: word('refusal.QUOTE_NOT_ON_RECEIVED'),
  },
  QUOTE_AMOUNT_NOT_A_NUMBER: {
    check: 'C-72.2',
    where: 'src/actions/index.mjs actionCorrespond > is-quote-grammar',
    translation: word('refusal.QUOTE_AMOUNT_NOT_A_NUMBER'),
  },
  QUOTE_NO_CURRENCY: {
    check: 'C-72.3',
    where: 'src/actions/index.mjs actionCorrespond > is-quote-grammar',
    translation: word('refusal.QUOTE_NO_CURRENCY'),
  },
  QUOTE_ANSWERS_NO_SENT: {
    check: 'C-72.4',
    where: 'src/actions/index.mjs actionCorrespond > is-quote-grammar',
    translation: word('refusal.QUOTE_ANSWERS_NO_SENT'),
  },
  QUOTE_REVISES_NO_QUOTE: {
    check: 'C-72.5',
    where: 'src/actions/index.mjs actionCorrespond > is-quote-grammar',
    translation: word('refusal.QUOTE_REVISES_NO_QUOTE'),
  },
  QUOTE_TEXT_UNWRITABLE: {
    check: 'C-72.6',
    where: 'src/actions/index.mjs actionCorrespond > is-quote-writable',
    translation: word('refusal.QUOTE_TEXT_UNWRITABLE'),
  },
  QUOTE_READ_UNASKED: {
    check: 'C-72.7',
    where: 'src/actions/index.mjs actionQuotes > is-quote-read-axis',
    translation: word('refusal.QUOTE_READ_UNASKED'),
  },
  QUOTE_ANSWERS_NOT_AN_ORD: {
    check: 'C-72.8',
    where: 'src/actions/index.mjs actionQuotes > is-quote-read-axis',
    translation: word('refusal.QUOTE_ANSWERS_NOT_AN_ORD'),
  },
};

/* D-147 / C-94 — THE RECORDS-REQUEST LIFECYCLE (`BIO_Case_Making_v0_1.md` §2). The refusals of the lifecycle
 * grammar (`lifecycleFindings`, which C-2.10 also reports over the document, each finding carrying the same code)
 * and the two the op alone can judge: a due date's citation against the action's governing laws as they stand
 * when it is stated, and the writability of the prose a stage carries. None of them encodes a law's clock. */
export const LIFECYCLE_CHECKS = {
  STAGE_NOT_OF_DIRECTION: {
    check: 'C-94.1',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: localize('action-grammar.checks.that_stage_does_not_belong', 'That stage does not belong to this kind of entry. A request, a fee-waiver request, an appeal or a court filing is something sent; an acknowledgement, a fee estimate, a decision, an extension notice, a production or a denial is something received. A non-response carries no stage.'),
  },
  FOLLOWS_NO_ENTRY: {
    check: 'C-94.2',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: word('refusal.FOLLOWS_NO_ENTRY'),
  },
  APPEAL_NAMES_NO_DECISION: {
    check: 'C-94.3',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: word('refusal.APPEAL_NAMES_NO_DECISION'),
  },
  OUTCOME_NOT_ON_RECEIVED: {
    check: 'C-94.4',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: word('refusal.OUTCOME_NOT_ON_RECEIVED'),
  },
  OUTCOME_NOT_IN_VOCABULARY: {
    check: 'C-94.5',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    /* R13 (T41): the vocabulary gained none_exists, so the sentence naming it does; a changed translation, awaiting T42's
       stamp. */
    translation: localize('action-grammar.checks.an_outcome_is_one_of', 'An outcome is one of granted, denied, partial, reversed, affirmed, none exists (the body says no responsive record exists), or none stated (the body stated none).'),
  },
  DECISION_WITHOUT_OUTCOME: {
    check: 'C-94.6',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: localize('action-grammar.checks.a_decision_carries_its_outcome', 'A decision carries its outcome as the body gave it. If the body stated none, record none stated so the record says so rather than leaving it blank.'),
  },
  FEE_ESTIMATE_WITHOUT_QUOTE: {
    check: 'C-94.7',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: word('refusal.FEE_ESTIMATE_WITHOUT_QUOTE'),
  },
  DUE_HALF_STATED: {
    check: 'C-94.8',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: word('refusal.DUE_HALF_STATED'),
  },
  DUE_NOT_A_DATE: {
    check: 'C-94.9',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-grammar',
    translation: word('refusal.DUE_NOT_A_DATE'),
  },
  DUE_CITE_NOT_GOVERNING: {
    check: 'C-94.10',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-due-cite',
    translation: word('refusal.DUE_CITE_NOT_GOVERNING'),
  },
  LIFECYCLE_TEXT_UNWRITABLE: {
    check: 'C-94.11',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-writable',
    translation: word('refusal.LIFECYCLE_TEXT_UNWRITABLE'),
  },
  /* D-688 (R22): the token case of C-94.11 split out, so each code's sentence is true of what it refuses. */
  LIFECYCLE_TOKEN_MALFORMED: {
    check: 'C-94.12',
    where: 'src/actions/index.mjs actionCorrespond > is-lifecycle-token',
    translation: word('refusal.LIFECYCLE_TOKEN_MALFORMED'),
  },
};

/* REC-214 / C-90 — A MEMBER REVISES AN ACTION'S RISK TIER BY AN AUTHORED, APPEND-ONLY ACT (BOB #33, 2026-09-24,
 * "Risk-tier revision"; `BIO_Case_Making_v0_1.md` §2, `risk_tier`). The field carries legal exposure: the record
 * must show that a "do not file without counsel" tier was changed, by whom, when and why.
 *
 * `op=actionrisktier` is the one act that changes a tier after intake, and it writes through the one front-matter
 * path every reader derives the tier from (`risk_tier`, read by `riskTierState`), appending one entry to
 * `risk_tier_history[]`. A machine is refused at the act by C-32.19's own code, MACHINE_CANNOT_SET_RISK_TIER — not a
 * second code for the same condition. Four rows are the act's own conditions; the fifth is `promote`'s: a
 * revision that changes the tier or edits the history WITHOUT the act is refused, because a member's plain
 * revision from 3 to 1 would otherwise overwrite "do not file without counsel" with nothing recording that it
 * was ever there but an older snapshot. A creation may state a tier (that is intake) and may not state a history. */
export const RISK_TIER_REVISION_CHECKS = {
  RISK_TIER_REWRITTEN: {
    check: 'C-90.1',
    where: 'src/actions/index.mjs #tierFence > is-promote-risk-tier',
    translation: word('refusal.RISK_TIER_REWRITTEN'),
  },
  /* T47 (R28; N961): C-90.2's and C-90.6's sites moved to `action-records` (`badRiskTier`, `actionRiskPropose`). */
  BAD_RISK_TIER: {
    check: 'C-90.2',
    where: 'src/action-records/index.mjs badRiskTier > is-bad-risk-tier',
    translation: word('refusal.BAD_RISK_TIER'),
  },
  RISK_TIER_REASON_REFUSED: {
    check: 'C-90.3',
    where: 'src/actions/index.mjs actionRiskTier > is-risk-tier-act',
    translation: word('refusal.RISK_TIER_REASON_REFUSED'),
  },
  RISK_TIER_UNCHANGED: {
    check: 'C-90.4',
    where: 'src/actions/index.mjs actionRiskTier > is-risk-tier-act',
    translation: localize('action-grammar.checks.the_action_already_has_that', 'The action already has that risk tier, so there is nothing to revise. The history records changes; it has not been touched.'),
  },
  RISK_TIER_HISTORY_UNSPLICEABLE: {
    check: 'C-90.5',
    where: 'src/actions/index.mjs actionRiskTier > is-risk-tier-act',
    translation: word('refusal.RISK_TIER_HISTORY_UNSPLICEABLE'),
  },
  /* REC-215 (R28): a proposed tier's basis, the proposal's own field. A proposed tier that is not 1, 2 or 3 meets
     C-90.2's own code (BAD_RISK_TIER), the same condition. */
  RISK_PROPOSAL_BASIS_REFUSED: {
    check: 'C-90.6',
    where: 'src/action-records/index.mjs actionRiskPropose > is-risk-propose-basis',
    translation: word('refusal.RISK_PROPOSAL_BASIS_REFUSED'),
  },
};

/* =========================================================================
 * D-689 / C-32.20 (R5): WHO STATES A RECORDS LAW. A machine credential may create a records_request stating no law
 * and propose one (R19's shape); it may not state, change or remove `law`. A law written before this fence by a
 * machine is read MACHINE-STATED from its recorded author and never rewritten (`recordsLawOf`).
 * ========================================================================= */
export const RECORDS_LAW_FENCE_CHECKS = {
  MACHINE_CANNOT_STATE_RECORDS_LAW: {
    check: 'C-32.20',
    where: 'src/actions/index.mjs #machineRecordsLawRefusal > is-machine-state-records-law',
    translation: localize('action-grammar.checks.which_law_governs_a_records', 'Which law governs a records request is a judgement a member makes and answers for. The credential that asked here is an automated one: it can write the request as a records request that names no law, and it can propose the law for a member to consider, but it cannot state the law, and cannot change or remove one. Sign in to state the law yourself.'),
  },
  /* R14 (T41; K2561): WHO STATES WHAT A RECORDS REQUEST SEEKS (R13's `seeks`), `actions`' fence (its R72), beside C-32.20.
     A machine credential may propose the stages sought (`actions` R73); it may not state or change them. New in T41
     layer 9; awaiting T42's stamp. */
  MACHINE_CANNOT_STATE_SEEKS: {
    check: 'C-32.21',
    where: 'src/actions/index.mjs #seeksFence > is-machine-state-seeks',
    translation: word('refusal.MACHINE_CANNOT_STATE_SEEKS'),
  },
};

/* T46 (R26; DEC-194, N913; K2953, K2959): the words of `words.json` (`docs/development/ux-substrate/screens/words.json`) the
   twenty-four C-117 rows R26 names translate by, each `en` verbatim, read by key (`refusal.<CODE>`), as membership's
   `HANDLE_WORDS` and extraction's `TRANSCRIBE_WORDS` are. The design stream's words: re-worded there, then re-taken here
   by key; a row never holds a copy of its sentence. Codes, numbers, `where`s and behaviour are unmoved. Four rows keep
   their T45 translations in T46, returned to BOB until the sentence and the requirement agree: C-117.32
   `OVERRIDE_GROUND_REFUSED` and C-117.41 `OFFICE_STATUS_WITHOUT_OUTCOME` (each refuses more than its sentence says),
   C-117.55 `REPLY_OWED_REFUSED` (it also refuses a reply_owed stated without its reason, K2859) and C-117.57
   `LAW_STAGE_UNKNOWN` (its sentence names "Civicsmith" bare, DEC-149). `BEARING_REFUSED` is `action-replies'` row
   (C-150.3), re-worded at its one minting site (K231, K2953). C-117.58 (MACHINE_CANNOT_SET_COPIED) reads its key too: `words.json` has held it since T50.
   Changed translations, awaiting T47's stamp. */
export const ACTION_GRAMMAR_WORDS = Object.freeze(Object.fromEntries([
  "DETERMINATION_NOT_NONCOMPLIANT",
  "OVERRIDE_NO_GROUND",
  "COPIED_IS_ADDRESSEE",
  "MACHINE_CANNOT_SET_PARTNERS",
  "PARTNERS_REFUSED",
  "MACHINE_CANNOT_SET_PRESS_TERMS",
  "PRESS_TERMS_NOT_PRESS",
  "PRESS_TERMS_REFUSED",
  "RECEIPT_NOT_ON_SENT",
  "OFFICE_STATUS_UNKNOWN",
  "MACHINE_CANNOT_SET_REPLY_OWED",
  "NO_REPLY_OWED",
  "FOUND_ELSEWHERE_NEEDS_CAPTURE",
  "STAGE_NOT_IN_LAW",
  "FOLLOWS_ACTION_REWRITTEN",
  "FOLLOWS_ACTION_SELF",
  "MACHINE_CANNOT_SET_SCOPE",
  "SCOPE_NO_REASON",
  "SCOPE_UNCHANGED",
  "MACHINE_CANNOT_RECORD_PROMISE",
  "PROMISE_REFUSED",
  "FOUND_ELSEWHERE_REFUSED",
  "SPEAKER_REFUSED",
  "FOLLOWS_ACTION_REFUSED"
].map((code) => [`refusal.${code}`, word(`refusal.${code}`)])));

/* =========================================================================
 * D-717 / C-101 (R7): THE ACTION CATALOGUE AT THE ACT. Five arms of C-2.10 that ran only in the audit are enforced
 * at the write, each under its own name; `findings[]` carries the arm's own C-2.10 / C-11.1 sentences, so the act and
 * the audit say one thing. A MISSING counterparty and a pending entry PAST its date still land: the audit reports them
 * (R37). C-117.1 (K248's family for this module) is R33's direction rule for the one mechanical clock write.
 * ========================================================================= */
export const ACTION_CATALOGUE_CHECKS = {
  /* T34-87 (DEC-149, K1811): the translation says "your group's Civicsmith" where it said "this instance"; a changed
     translation, awaiting T35's stamp (plan Rules (5) 4). */
  ACTION_KIND_UNKNOWN: {
    check: 'C-101.1',
    where: 'src/actions/index.mjs #writeArms > is-promote-action-kind',
    translation: word('refusal.ACTION_KIND_UNKNOWN'),
  },
  RISK_TIER_REFUSED: {
    check: 'C-101.2',
    where: 'src/actions/index.mjs #writeArms > is-promote-tier-vocabulary',
    translation: word('refusal.RISK_TIER_REFUSED'),
  },
  COUNTERPARTY_REFUSED: {
    check: 'C-101.3',
    where: 'src/actions/index.mjs #writeArms > is-promote-counterparty',
    translation: localize('action-grammar.checks.an_action_says_who_it', 'An action says who it is addressed to: an office by its official role and the body it belongs to; a reporter, an organisation or another team by a role and the organisation; an audience described in words; or an undetermined addressee with a few words on what is known and what would settle it. This write carried a placeholder, a bare name outside those shapes, a person, or an addressee that said two things at once, so nothing was written. Leaving the addressee out is allowed while the action is a draft.'),
  },
  ACTION_RESOLUTION_REFUSED: {
    check: 'C-101.4',
    where: 'src/actions/index.mjs #writeArms > is-promote-action-resolution',
    translation: word('refusal.ACTION_RESOLUTION_REFUSED'),
  },
  CLOCK_REFUSED: {
    check: 'C-101.5',
    where: 'src/actions/index.mjs #writeArms > is-promote-clock',
    translation: word('refusal.CLOCK_REFUSED'),
  },
  CLOCK_STATUS_NOT_MECHANICAL: {
    check: 'C-117.1',
    where: 'src/actions/index.mjs #writeArms > is-promote-clock-mechanical',
    translation: word('refusal.CLOCK_STATUS_NOT_MECHANICAL'),
  },
  /* R43 (N217, K275): the one answer to one condition, that no action the caller may see answers to an id. Minted at one
     site, `noSuchAction`, which every later module answering that condition calls (filings, escalation); filings'
     C-115.2 and escalation's C-116.11 give way to it. */
  NO_SUCH_ACTION: {
    check: 'C-117.2',
    where: 'src/action-records/index.mjs noSuchAction > is-no-such-action',
    translation: word('refusal.NO_SUCH_ACTION'),
  },
  /* R3 (N237, K351): the projection reads at most 500 legs and 500 correspondence entries of one action. */
  ACTION_TOO_LARGE: {
    check: 'C-117.3',
    where: 'src/actions/index.mjs #tooLarge > is-action-too-large',
    translation: word('refusal.ACTION_TOO_LARGE'),
  },
  /* R13 (N217, K275): a move of an action states why; the condition is this act's own, so the code is too. */
  ACTION_MOVE_NO_REASON: {
    check: 'C-117.4',
    where: 'src/actions/index.mjs actionMove > is-move-reason',
    translation: word('refusal.ACTION_MOVE_NO_REASON'),
  },
  /* R8: an action recorded for a breach rests on a live conformance determination the author may see. */
  ACTION_NO_DETERMINATION: {
    check: 'C-117.6',
    where: 'src/actions/index.mjs #breachRefusal > is-breach-determination',
    translation: word('refusal.ACTION_NO_DETERMINATION'),
  },
  /* R9 (D1, K590): a breach action addresses an office; a press, organisation, group or audience addressee is for an
     action that seeks evidence or attention. */
  ADDRESSEE_NOT_AN_OFFICE: {
    check: 'C-117.7',
    where: 'src/actions/index.mjs #overrideAndAddressee > is-breach-addressee',
    translation: word('refusal.ADDRESSEE_NOT_AN_OFFICE'),
  },
  /* R8 (K600 (a)): the premise override is a member's open statement. */
  MACHINE_CANNOT_OVERRIDE: {
    check: 'C-117.8',
    where: 'src/actions/index.mjs #overrideAndAddressee > is-machine-override',
    translation: word('refusal.MACHINE_CANNOT_OVERRIDE'),
  },
  PREMISE_OVERRIDE_REWRITTEN: {
    check: 'C-117.9',
    where: 'src/actions/index.mjs #overrideAndAddressee > is-premise-override',
    translation: word('refusal.PREMISE_OVERRIDE_REWRITTEN'),
  },
  PREMISE_OVERRIDE_REFUSED: {
    check: 'C-117.19',
    where: 'src/actions/index.mjs #overrideAndAddressee > is-premise-override',
    /* T45 (K2849 (4)): the reason's refusal alone; the ground's are R15's (C-117.31, .32). Re-worded, awaiting T46's stamp. */
    translation: word('refusal.PREMISE_OVERRIDE_REFUSED'),
  },
  /* R45 (D5, K590): the group's contact for an action. */
  MACHINE_CANNOT_SET_CONTACT: {
    check: 'C-117.10',
    where: 'src/actions/index.mjs #contactAndPlan > is-machine-contact',
    translation: word('refusal.MACHINE_CANNOT_SET_CONTACT'),
  },
  CONTACT_NOT_A_MEMBER: {
    check: 'C-117.11',
    where: 'src/actions/index.mjs contactNotAMember > is-contact-member',
    translation: word('refusal.CONTACT_NOT_A_MEMBER'),
  },
  /* R46 (Bob's ruling 1 of 2026-09-29, K590): the plan an action was started from. */
  PLAN_LINK_REWRITTEN: {
    check: 'C-117.12',
    where: 'src/actions/index.mjs #contactAndPlan > is-plan-link',
    translation: word('refusal.PLAN_LINK_REWRITTEN'),
  },
  PLAN_LINK_REFUSED: {
    check: 'C-117.13',
    where: 'src/actions/index.mjs #contactAndPlan > is-plan-link',
    translation: word('refusal.PLAN_LINK_REFUSED'),
  },
  /* R48 (K597 (1)): pressure directed at the group, marked on what came back. */
  MACHINE_CANNOT_MARK_PRESSURE: {
    check: 'C-117.14',
    where: 'src/actions/index.mjs #pressureRefusal > is-pressure',
    translation: localize('action-grammar.checks.marking_a_reply_as_a', 'Marking a reply as a threat, retaliation, discrediting or legal harassment is a member\'s judgement, and somebody answers for it. The credential that asked here is an automated one, so it cannot mark one. Sign in to mark it yourself.'),
  },
  PRESSURE_REFUSED: {
    check: 'C-117.15',
    where: 'src/actions/index.mjs #pressureRefusal > is-pressure',
    translation: word('refusal.PRESSURE_REFUSED'),
  },
  PRESSURE_NOT_RECEIVED: {
    check: 'C-117.16',
    where: 'src/actions/index.mjs #pressureRefusal > is-pressure',
    translation: word('refusal.PRESSURE_NOT_RECEIVED'),
  },
  /* T45 (K2845, K2859): the moved hold rows retired once `actions` deleted its copy of the hold code (`action-holds`'
     C-149 holds them now): C-117.17 PRESSURE_MARKED, .18 PRESSURE_NO_ENTRY, .20 MACHINE_CANNOT_SET_HOLD, .21 HOLD_REFUSED,
     .23 HOLD_RELEASE_IS_ITS_OWN_ACT, .24 HOLD_PROJECTS_REFUSED, .25 HOLD_ALREADY_RELEASED; and C-117.22 HOLD_NO_LEGAL_MARK
     (R9). Their numbers are never reused. */
  /* R62, R65 (K1657; ACTIONS #12 J2 (1)): the codes `actions` mints for the addressee suggestion's subject and for the
     proceeding an action belongs to. New in T33 layer 9; awaiting promotion's stamp. */
  NO_SUBJECT: {
    check: 'C-117.26',
    where: 'src/actions/index.mjs addresseeSuggest > is-addressee-subject',
    translation: word('refusal.NO_SUBJECT'),
  },
  MACHINE_CANNOT_SET_PROCEEDING: {
    check: 'C-117.27',
    where: 'src/actions/index.mjs #heldLinks > is-machine-set-proceeding',
    translation: word('refusal.MACHINE_CANNOT_SET_PROCEEDING'),
  },
  /* R13 (T41; H30 (1), K2505): what a records request seeks. Minted here, by `seeksFindings` alone; `actions` refuses its
     write with it (its R70). New in T41 layer 9; awaiting T42's stamp. */
  SEEKS_REFUSED: {
    check: 'C-117.29',
    where: 'src/action-grammar/checks.mjs seeksFindings > is-seeks',
    translation: word('refusal.SEEKS_REFUSED'),
  },
  /* T45 (T45-25; R9, reconciliation R21; K2845, K2849): the rows of the codes `actions` mints (its R8, R74, R77–R88, R94,
     and its copied fence) and of the shape codes this module's field grammars push (R15, R20–R25), numbered from C-117.30
     in R9's order; each `where` names the raising site, `actions`' as its job names them (K2849 (2)). `action-holds`' and
     `action-replies`' codes are their own families, C-149 and C-150 (K2845): `BEARING_REFUSED`, which R24 pushes, is
     C-150's row. Translations the job's drafts for BOB, the UX stream's to revise. New in T45 layer 9; awaiting T46's
     stamp. Since T46 (R26; N913) twenty-four of them read their translation by key from `ACTION_GRAMMAR_WORDS` above;
     C-117.32, .41, .55, .57 and .58 keep the T45 drafts. Since T47 (R28; N961) the receipt, scope and promise rows
     (C-117.39, C-117.48–.52) name their sites in `action-records`, which raises them now. */
  DETERMINATION_NOT_NONCOMPLIANT: {
    check: 'C-117.30',
    where: 'src/actions/index.mjs #breachRefusal > is-breach-not-noncompliant',
    translation: ACTION_GRAMMAR_WORDS["refusal.DETERMINATION_NOT_NONCOMPLIANT"],
  },
  OVERRIDE_NO_GROUND: {
    check: 'C-117.31',
    where: 'src/actions/index.mjs #overrideAndAddressee > is-override-ground',
    translation: ACTION_GRAMMAR_WORDS["refusal.OVERRIDE_NO_GROUND"],
  },
  OVERRIDE_GROUND_REFUSED: {
    check: 'C-117.32',
    where: 'src/actions/index.mjs #overrideAndAddressee > is-override-ground',
    translation: localize('action-grammar.checks.the_ground_stated_for_acting', 'The ground stated for acting without a determination was incomplete or not in the form the record keeps: a legal deadline names its citation and a real date; an imminent act says what it is in up to 500 characters and when, as a date or a date and time. Nothing was written.'),
  },
  COPIED_IS_ADDRESSEE: {
    check: 'C-117.33',
    where: 'src/action-grammar/checks.mjs copiedFindings > is-copied',
    translation: ACTION_GRAMMAR_WORDS["refusal.COPIED_IS_ADDRESSEE"],
  },
  MACHINE_CANNOT_SET_PARTNERS: {
    check: 'C-117.34',
    where: 'src/actions/index.mjs #t45Fields > is-machine-set-partners',
    translation: ACTION_GRAMMAR_WORDS["refusal.MACHINE_CANNOT_SET_PARTNERS"],
  },
  PARTNERS_REFUSED: {
    check: 'C-117.35',
    where: 'src/actions/index.mjs #t45Fields > is-partners-entity',
    translation: ACTION_GRAMMAR_WORDS["refusal.PARTNERS_REFUSED"],
  },
  MACHINE_CANNOT_SET_PRESS_TERMS: {
    check: 'C-117.36',
    where: 'src/actions/index.mjs #t45Fields > is-machine-set-press-terms',
    translation: ACTION_GRAMMAR_WORDS["refusal.MACHINE_CANNOT_SET_PRESS_TERMS"],
  },
  PRESS_TERMS_NOT_PRESS: {
    check: 'C-117.37',
    where: 'src/action-grammar/checks.mjs pressTermsFindings > is-press-terms',
    translation: ACTION_GRAMMAR_WORDS["refusal.PRESS_TERMS_NOT_PRESS"],
  },
  PRESS_TERMS_REFUSED: {
    check: 'C-117.38',
    where: 'src/action-grammar/checks.mjs pressTermsFindings > is-press-terms',
    translation: ACTION_GRAMMAR_WORDS["refusal.PRESS_TERMS_REFUSED"],
  },
  RECEIPT_NOT_ON_SENT: {
    check: 'C-117.39',
    where: 'src/action-records/index.mjs actionReceipt > is-receipt-on-sent',
    translation: ACTION_GRAMMAR_WORDS["refusal.RECEIPT_NOT_ON_SENT"],
  },
  OFFICE_STATUS_UNKNOWN: {
    check: 'C-117.40',
    where: 'src/action-grammar/checks.mjs entryFieldFindings > is-entry-fields',
    translation: ACTION_GRAMMAR_WORDS["refusal.OFFICE_STATUS_UNKNOWN"],
  },
  OFFICE_STATUS_WITHOUT_OUTCOME: {
    check: 'C-117.41',
    where: 'src/action-grammar/checks.mjs entryFieldFindings > is-entry-fields',
    translation: localize('action-grammar.checks.the_offices_own_wording_of', 'The office\'s own wording of its status is quoted beside the outcome of what it sent back, never in its place, in up to 500 characters on one line. This entry carried the wording without an outcome, or the wording was not of that form, so nothing was written. Record the outcome first.'),
  },
  MACHINE_CANNOT_SET_REPLY_OWED: {
    check: 'C-117.42',
    where: 'src/actions/index.mjs #t45Fields > is-machine-set-reply-owed',
    translation: ACTION_GRAMMAR_WORDS["refusal.MACHINE_CANNOT_SET_REPLY_OWED"],
  },
  NO_REPLY_OWED: {
    check: 'C-117.43',
    where: 'src/actions/index.mjs actionCorrespond > is-no-reply-owed',
    translation: ACTION_GRAMMAR_WORDS["refusal.NO_REPLY_OWED"],
  },
  FOUND_ELSEWHERE_NEEDS_CAPTURE: {
    check: 'C-117.44',
    where: 'src/action-grammar/checks.mjs entryFieldFindings > is-entry-fields',
    translation: ACTION_GRAMMAR_WORDS["refusal.FOUND_ELSEWHERE_NEEDS_CAPTURE"],
  },
  STAGE_NOT_IN_LAW: {
    check: 'C-117.45',
    where: 'src/actions/index.mjs actionCorrespond > is-stage-in-law',
    translation: ACTION_GRAMMAR_WORDS["refusal.STAGE_NOT_IN_LAW"],
  },
  FOLLOWS_ACTION_REWRITTEN: {
    check: 'C-117.46',
    where: 'src/actions/index.mjs #t45Fields > is-follows-action-rewritten',
    translation: ACTION_GRAMMAR_WORDS["refusal.FOLLOWS_ACTION_REWRITTEN"],
  },
  FOLLOWS_ACTION_SELF: {
    check: 'C-117.47',
    where: 'src/action-grammar/checks.mjs actionFieldFindings > is-action-fields',
    translation: ACTION_GRAMMAR_WORDS["refusal.FOLLOWS_ACTION_SELF"],
  },
  MACHINE_CANNOT_SET_SCOPE: {
    check: 'C-117.48',
    where: 'src/action-records/index.mjs actionScope > is-scope',
    translation: ACTION_GRAMMAR_WORDS["refusal.MACHINE_CANNOT_SET_SCOPE"],
  },
  SCOPE_NO_REASON: {
    check: 'C-117.49',
    where: 'src/action-records/index.mjs actionScope > is-scope',
    translation: ACTION_GRAMMAR_WORDS["refusal.SCOPE_NO_REASON"],
  },
  SCOPE_UNCHANGED: {
    check: 'C-117.50',
    where: 'src/action-records/index.mjs actionScope > is-scope',
    translation: ACTION_GRAMMAR_WORDS["refusal.SCOPE_UNCHANGED"],
  },
  MACHINE_CANNOT_RECORD_PROMISE: {
    check: 'C-117.51',
    where: 'src/action-records/index.mjs actionPromise > is-promise',
    translation: ACTION_GRAMMAR_WORDS["refusal.MACHINE_CANNOT_RECORD_PROMISE"],
  },
  PROMISE_REFUSED: {
    check: 'C-117.52',
    where: 'src/action-records/index.mjs actionPromise > is-promise',
    translation: ACTION_GRAMMAR_WORDS["refusal.PROMISE_REFUSED"],
  },
  FOUND_ELSEWHERE_REFUSED: {
    check: 'C-117.53',
    where: 'src/action-grammar/checks.mjs entryFieldFindings > is-entry-fields',
    translation: ACTION_GRAMMAR_WORDS["refusal.FOUND_ELSEWHERE_REFUSED"],
  },
  SPEAKER_REFUSED: {
    check: 'C-117.54',
    where: 'src/action-grammar/checks.mjs entryFieldFindings > is-entry-fields',
    translation: ACTION_GRAMMAR_WORDS["refusal.SPEAKER_REFUSED"],
  },
  REPLY_OWED_REFUSED: {
    check: 'C-117.55',
    where: 'src/action-grammar/checks.mjs actionFieldFindings > is-action-fields',
    translation: localize('action-grammar.checks.whether_a_reply_is_owed', 'Whether a reply is owed is stated as yes or no, or left out, which reads as owed. Something else was stated, so nothing was written.'),
  },
  FOLLOWS_ACTION_REFUSED: {
    check: 'C-117.56',
    where: 'src/action-grammar/checks.mjs actionFieldFindings > is-action-fields',
    translation: ACTION_GRAMMAR_WORDS["refusal.FOLLOWS_ACTION_REFUSED"],
  },
  LAW_STAGE_UNKNOWN: {
    check: 'C-117.57',
    where: 'src/action-grammar/checks.mjs lawStagesFindings > is-law-stages',
    translation: localize('action-grammar.checks.a_records_law_in_the', 'A records law in the jurisdiction profile lists a stage the record does not know. Each of a law\'s stages is named by one of the record\'s stages of a records request, such as a request, an appeal or a decision. That stage is not read as one the law has.'),
  },
  MACHINE_CANNOT_SET_COPIED: {
    check: 'C-117.58',
    where: 'src/actions/index.mjs #t45Fields > is-machine-set-copied',
    translation: word("refusal.MACHINE_CANNOT_SET_COPIED"),
  },
  /* R9 (T51, K4047; actions R108): the minutes' passage rides on a reply to a public comment only. */
  MINUTES_NOT_PUBLIC_COMMENT: {
    check: 'C-117.59',
    where: 'src/actions/index.mjs actionCorrespond > is-minutes',
    translation: localize('action-grammar.checks.minutes_are_kept_only_on', 'Minutes can be kept only on a received reply to a public comment. This entry is not one, so remove the minutes, or record the reply on the public comment it answers. Nothing was written.'),
  },
  /* R9 (T51, K4047; actions R108): the minutes' shape: the meeting one line, the passage an extent. */
  BAD_MINUTES: {
    check: 'C-117.60',
    where: 'src/actions/index.mjs actionCorrespond > is-minutes',
    translation: localize('action-grammar.checks.the_minutes_are_malformed_the', 'The minutes are malformed: the meeting is not one line of 1 to 200 characters, or the passage is not an extent of a capture. Correct each part to that form, then record the minutes again. Nothing was written.'),
  },
};
