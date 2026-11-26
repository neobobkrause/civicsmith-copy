// @ts-check
/* record-grammar: the bundle check, `checkBundle`, with its structural arms (C-1, C-2.1–.6, C-3.1, C-4, C-5, C-6.1–.2's
   core, C-12–C-14, C-16, C-17.1) and the grammars seam its type arms are filled through (R28). Copied from the check
   catalogue at T19 with their comments (draft-T19, rule 2; K653 BOB-6). The type arms are not here: each is a place in
   the order (`EXTENSION_ARMS`) that its owner's registered grammar fills (`opts.grammars`, record-core R67), so a
   bundle's findings, their ids, severities and order are the catalogue's own (the catalogue was deleted at T19's close,
   K855). Pure over the files it is handed: no store, no network; the clock is
   read only where the caller passes no `nowMs` (C-16.3, C-16.5), as the catalogue's has always read it. */

import { BUNDLE_ID_RE, ANN_ID_RE, FILENAME_RE, ISO_TS_RE, idPattern } from './ids.mjs';
import { OBJECT_TYPES, normalizeType } from './types.mjs';
import { CORE_FIELDS, FORBIDDEN_ALIASES, parseFrontmatter } from './frontmatter.mjs';
import { HEADINGS, HEADINGS_WHEN, isCaseMemberBytes, STATES, sectionText } from './document.mjs';
import { localize } from '../setup-words/index.mjs';
/** @import { Frontmatter } from './frontmatter.mjs' */

// ---------------------------------------------------------------------------
// Finding helper
// ---------------------------------------------------------------------------

/**
 * @typedef {{check: string, severity: 'error'|'warn'|'info', message: string, repairable?: boolean, repairs?: string[], code?: string}} Finding
 */

/** REC-56 / D-206, 2026-08-05: THE OPTIONAL `code`, and why it exists.
 *
 *  REC-54 split C-18.9's chain arm into three findings because *no chain
 *  recorded*, *a chain recorded and empty* and *a chain field that is not a
 *  chain* are three different facts about the record with three different
 *  repairs — a gap in what was captured, a derivation that RAN and FOUND
 *  NOTHING, and a writer producing malformed output. It then stated the
 *  residual rather than hiding it: `op=audit`'s TALLY is keyed by CHECK ID, so
 *  all three land on `C-18.9` and the distinction reaches a reader only through
 *  the offender detail, which is bounded at 20 bundles per page against a page
 *  of up to 1,000. **A tally that collapses them re-creates in the REPORT the
 *  conflation the check just removed from the DATA**, which is the whole of
 *  D-206 and it is a real defect rather than a tidiness note.
 *
 *  IT IS DECIDED HERE AND THE TALLY CHANGES. CLAUDE.md is not ambiguous about
 *  which way: *"Absence at one level is not evidence of absence at the next …
 *  Saying which of those is true is a first-class obligation, not a diagnostic
 *  detail."* An audit answer that can only say "thirty C-18.9 errors" is
 *  refusing that obligation at exactly the surface an operator reads before
 *  calling anything done.
 *
 *  WHY A CODE ON THE FINDING RATHER THAN A SECOND CHECK ID: a check id is a
 *  RULE, versioned and registered, and three ids for one rule would be the
 *  vocabulary drifting to serve a report. A code is a discriminator WITHIN a
 *  rule, and it is minted at the same call site as the finding it describes.
 *
 *  WHY THIS IS NOT THE D-113 CLASS (a parallel list that falls out of step):
 *  the tally is DERIVED from the findings the checks actually produced, not
 *  from a hand-kept register beside them. A code cannot go stale, because there
 *  is nowhere for it to go stale relative to. The one property that could drift
 *  — a code is stable-shaped and unique within its check — is the minting arm's
 *  to keep: no structural arm here passes a code (N469, T21).
 *
 *  OPTIONAL AND ADDITIVE. 142 of the catalogue's 145 repairable findings pass
 *  none, the property is then absent, and `op=audit`'s `tallyDetail` key is
 *  absent when nothing on the page carried a code.
 *
 * @param {string} check
 * @param {'error'|'warn'|'info'} severity
 * @param {string} message
 * @param {string[]} [repairs]
 * @param {string} [code]
 * @returns {Finding} */
function f(check, severity, message, repairs, code) {
  /** @type {Finding} */
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  if (code) out.code = code;
  return out;
}

// ---------------------------------------------------------------------------
// Bundle context: injected file access so both call sites share one codebase.
// files: Map<relativePath, Uint8Array|string>. sha256: async (bytes) => hex.
// ---------------------------------------------------------------------------

/**
 * @typedef {{folderName: string, files: Map<string, Uint8Array|string>, sha256: (bytes: Uint8Array|string) => Promise<string>, nowMs?: number | undefined, maxPackageAgeDays?: number | undefined, maxReevalAgeDays?: number | undefined, elidedPaths?: Set<string> | string[] | undefined, resolveTarget?: ((id: string) => boolean) | undefined, releaseRegistry?: object | null | undefined, publishedRegistry?: object | null | undefined, publishedCaseRegistry?: object | null | undefined, earnedRegistry?: object | null | undefined, sha512?: ((bytes: Uint8Array) => Promise<Uint8Array>) | null | undefined}} BundleInput
 */
/** What every arm reads, a registered grammar's among them (R39): the input as handed in, the parsed front matter and the
 *  body, and the defaults filled in.
 * @typedef {{folderName: string, files: Map<string, Uint8Array|string>, elided: Set<string>, sha256: (bytes: Uint8Array|string) => Promise<string>, nowMs: number | undefined, maxPackageAgeDays: number, maxReevalAgeDays: number, knownSchemas: string[], resolveTarget: ((id: string) => boolean) | undefined, releaseRegistry: object | null, publishedRegistry: object | null, publishedCaseRegistry: object | null, earnedRegistry: object | null, sha512: ((bytes: Uint8Array) => Promise<Uint8Array>) | null, fm: Frontmatter | null, body: string}} BundleContext
 */
/** A registered grammar (record-core R67): its module, the check ids it claims, and its arm.
 * @typedef {{module: string, ids: string[], arm: (ctx: BundleContext, findings: Finding[]) => void | Promise<void>}} Grammar
 */

/** An object read member by member. @typedef {{readonly [key: string]: unknown}} Members */
/** @param {unknown} v @returns {v is Members} */
const isMembers = (v) => v !== null && typeof v === 'object';
/** A list read item by item. @typedef {readonly unknown[]} List */
/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);
/* A front-matter value's member, read as the language reads `v.key`: an object's or a list's member, nothing on a
   string, number or boolean (no name read here is on their prototypes), and the language's own TypeError on null. */
/** @param {unknown} v @param {string} key @returns {unknown} */
function memberOf(v, key) {
  if (isMembers(v)) return v[key];
  if (v === null || v === undefined) throw new TypeError(`Cannot read properties of ${v} (reading '${key}')`);
  return undefined;
}
/* Whether `list` holds `v`, as `includes` answers it for these lists of names (no list here holds NaN). */
/** @template T @param {readonly T[]} list @param {unknown} v @returns {boolean} */
const holds = (list, v) => {
  for (const x of list) if (x === v) return true;
  return false;
};

/** @param {Uint8Array | string | undefined} v @returns {string} */
function asText(v) {
  if (typeof v === 'string') return v;
  return new TextDecoder().decode(v);
}

/** Presence semantics (1.13.0): a path exists if its bytes are in files OR
 *  it is declared elided (present in the store, deliberately not carried).
 *  Used ONLY by existence assertions; byte checks read ctx.files directly.
 * @param {BundleContext} ctx @param {string} path @returns {boolean} */
function hasFile_(ctx, path) {
  return ctx.files.has(path) || (ctx.elided && ctx.elided.has(path));
}

// ---------------------------------------------------------------------------
// Check families
// ---------------------------------------------------------------------------

/* R56 (T43; N854; K231, K2625): THE ONE C-1.1 JUDGMENT. Does the front matter's id disagree with the folder it is filed
   under? True exactly when `fm.id` is a string not equal, byte for byte, to `folderName`: no trimming, no case fold, so an
   id padded with white space disagrees. A non-string or absent id is not this arm's: C-1.2 refuses it. `checkIdentity`
   below and the write door (promotion R38) both run this function, so the gate and the door cannot judge one id two
   ways (one code, one site: K231). */
/** @param {{readonly [key: string]: unknown} | null | undefined} fm @param {unknown} folderName @returns {boolean} */
export function idDisagrees(fm, folderName) {
  const id = fm?.id;
  return typeof id === 'string' && id !== folderName;
}

/* T47-1 (R62; N958, K3028): A SUCCESS RECORD IS A DOCUMENT `checkBundle` ADMITS. `consequences` promotes each one as a
   `success_record` object (R59) whose id is a bare `SUC-<year>-<counter>`, with no slug, and writes `schema:
   success_record@1`; before this the gate refused every one of them (C-1.2 on the id, C-2.5 on the type). It is admitted
   on its own terms, not by widening R1: `BUNDLE_ID_RE`, its prefix set and `HEADINGS` are unchanged, so a reference target
   or an annotation is judged exactly as before. The id is admitted only as a `SUC` core (`idPattern`, R47) and only under
   `object_type: success_record`: a slug after it, a `SUC` id under another type, or the type under another prefix is
   refused as before (C-1.2, C-2.5). */
const SUC_CORE_RE = idPattern('SUC');
const SUCCESS_RECORD = 'success_record';
/** @param {Frontmatter | null} fm @param {string} id @returns {boolean} */
const isSuccessRecordDoc = (fm, id) => normalizeType(fm?.object_type) === SUCCESS_RECORD && SUC_CORE_RE !== null && SUC_CORE_RE.test(id);

/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkIdentity(ctx, findings) {
  const id = ctx.fm?.id;
  if (typeof id !== 'string' || !(BUNDLE_ID_RE.test(id) || isSuccessRecordDoc(ctx.fm, id))) {
    findings.push(f('C-1.2', 'error', localize('record-grammar.bundle.frontmatter_id_id_does_not', 'frontmatter id \'{id}\' does not match the canonical ID grammar', { id: String(id) })));
  }
  if (idDisagrees(ctx.fm, ctx.folderName)) {
    findings.push(f('C-1.1', 'error', localize('record-grammar.bundle.folder_name_foldername_does_not', 'folder name \'{folderName}\' does not equal frontmatter id \'{id}\'', { folderName: String(ctx.folderName), id: String(id) }),
      [localize('record-grammar.bundle.restore_folder_name_from_frontmatter_id', 'restore folder name from frontmatter id'), localize('record-grammar.bundle.restore_frontmatter_id_from_folder_name', 'restore frontmatter id from folder name if history confirms it')]));
  }
  // annotation records
  /** @type {Set<string>} */
  const seen = new Set();
  for (const path of ctx.files.keys()) {
    if (!path.startsWith('annotations/')) continue;
    const name = path.slice('annotations/'.length);
    if (!name.endsWith('.json')) { findings.push(f('C-1.3', 'error', localize('record-grammar.bundle.annotation_file_name_is_not', 'annotation file \'{name}\' is not a .json record', { name: String(name) }))); continue; }
    /* An annotation record is the writer's (record-core); its shape is stated here until its owner offers a reader. */
    /** @type {{id?: string}} */
    let rec;
    try { rec = /** @type {{id?: string}} */ (JSON.parse(asText(ctx.files.get(path)))); }
    catch { findings.push(f('C-1.3', 'error', localize('record-grammar.bundle.annotation_record_name_does_not', 'annotation record \'{name}\' does not parse', { name: String(name) }))); continue; }
    const rid = rec.id;
    if (typeof rid !== 'string' || !ANN_ID_RE.test(rid)) {
      findings.push(f('C-1.3', 'error', localize('record-grammar.bundle.annotation_id_rid_does_not', 'annotation id \'{rid}\' does not match the v1.1 timestamp-author grammar', { rid: String(rid) })));
      continue;
    }
    if (!rid.startsWith(ctx.folderName + '.ann-')) {
      findings.push(f('C-1.3', 'error', localize('record-grammar.bundle.annotation_rid_does_not_belong', 'annotation \'{rid}\' does not belong to parent \'{folderName}\'', { rid: String(rid), folderName: String(ctx.folderName) })));
    }
    const expectedFile = rid.slice(ctx.folderName.length + 1) + '.json'; // ann-<ts>-<author>.json
    if (name !== expectedFile) {
      findings.push(f('C-1.3', 'error', localize('record-grammar.bundle.annotation_file_name_does_not', 'annotation file \'{name}\' does not match its id (expected \'{expectedFile}\')', { name: String(name), expectedFile: String(expectedFile) })));
    }
    if (seen.has(rid)) {
      findings.push(f('C-1.3', 'error', localize('record-grammar.bundle.duplicate_annotation_id_rid', 'duplicate annotation id \'{rid}\'', { rid: String(rid) }), [localize('record-grammar.bundle.adjust_the_later_record_timestamp_suffix', 'adjust the later record timestamp suffix by one second, logged')]));
    }
    seen.add(rid);
  }
  // annotations_open is a derived convenience, checker-verified (spec 3.1)
  let pending = 0;
  for (const path of ctx.files.keys()) {
    if (!path.startsWith('annotations/') || !path.endsWith('.json')) continue;
    try { if (/** @type {{state?: unknown}} */ (JSON.parse(asText(ctx.files.get(path)))).state === 'pending') pending++; } catch { /* reported above */ }
  }
  const fm = ctx.fm;
  const open = fm ? fm.annotations_open : undefined;
  if (fm && typeof open === 'number' && open !== pending) {
    findings.push(f('C-1.3', 'warn', localize('record-grammar.bundle.annotations_open_is_annotations_open', 'annotations_open is {annotations_open} but {pending} annotation record(s) are pending', { annotations_open: String(open), pending: String(pending) }), ['refresh annotations_open on the next write']));
  }
}

/* T33-1 (R3): `OBJECT_TYPES` also names the types of T33's new objects, which are table rows and never bundles. The
   bundle check reads only the bundle prefixes' types, so `object_type: event` is still not a known type here (C-2.5)
   and a prefix outside R1's set implies none, exactly as before the new keys. T47-1 (R62): the success record's `SUC`
   joins them here alone, so `success_record` is a known type and `SUC` implies it (C-2.5); R1's set is unchanged. */
/* The bundle prefixes' types, R1's prefixes (`ID_PREFIXES`, in its order) and `SUC` (R62), read by a prefix's name. */
/** @type {ReadonlyMap<string, string>} */
const BUNDLE_TYPES = new Map([
  ['INFO', OBJECT_TYPES.INFO], ['PROB', OBJECT_TYPES.PROB], ['FOCUS', OBJECT_TYPES.FOCUS], ['INQ', OBJECT_TYPES.INQ], ['PROJ', OBJECT_TYPES.PROJ],
  ['ACTN', OBJECT_TYPES.ACTN], ['BIAS', OBJECT_TYPES.BIAS], ['STD', OBJECT_TYPES.STD], ['CONF', OBJECT_TYPES.CONF], ['CONS', OBJECT_TYPES.CONS],
  ['ESC', OBJECT_TYPES.ESC], ['ASP', OBJECT_TYPES.ASP], ['GOAL', OBJECT_TYPES.GOAL], ['PLN', OBJECT_TYPES.PLN], ['SUC', OBJECT_TYPES.SUC]
]);

/* T40 (N809, K2390; R39): A TYPE IS ONE OF THE TABLES' OWN KEYS. `vocabFor` answers an inherited key too (R34), so an
   `object_type` of `toString`, `constructor` or `__proto__` read `HEADINGS` and `STATES` as a function or
   `Object.prototype`, and `checkBundle` threw on the bytes instead of answering them. Here the declared spelling and
   then the normalized type are looked up by own key only, so such a type is unknown exactly as `memo` is: C-2.5, and no
   heading or state arm. The id prefix's implied type is read the same way. */
/* The tables read by a type's name, each a copy of the vocabulary's own entries, which nothing writes. */
/** @type {Readonly<Record<string, string[]>>} */
const HEADINGS_OF = { information: HEADINGS.information, inquiry: HEADINGS.inquiry, focus: HEADINGS.focus, project: HEADINGS.project, action: HEADINGS.action, bias: HEADINGS.bias, problem: HEADINGS.problem };
/** @type {Readonly<Record<string, {heading: string, whenCaseMember?: boolean, states?: string[]}[]>>} */
const CONDITIONAL_OF = { inquiry: HEADINGS_WHEN.inquiry, focus: HEADINGS_WHEN.focus, problem: HEADINGS_WHEN.problem };
/** A type's state machine (R35). @typedef {{readonly legal: readonly string[], readonly edges: object}} StateMachine */
/** @type {Readonly<Record<string, StateMachine>>} */
const MACHINE_OF = {
  information: STATES.information,
  inquiry: STATES.inquiry,
  focus: STATES.focus,
  project: STATES.project,
  action: STATES.action,
  bias: STATES.bias,
  standard: STATES.standard,
  determination: STATES.determination,
  consequence: STATES.consequence,
  escalation: STATES.escalation,
  aspiration: STATES.aspiration,
  goal: STATES.goal,
  action_plan: STATES.action_plan,
  success_record: STATES.success_record,
  problem: STATES.problem
};
/* The forbidden aliases with their canonical names, in `FORBIDDEN_ALIASES`' own order. */
/** @type {[string, string][]} */
const ALIAS_PAIRS = [['status', FORBIDDEN_ALIASES.status], ['state', FORBIDDEN_ALIASES.state], ['pipeline_state', FORBIDDEN_ALIASES.pipeline_state], ['verdict', FORBIDDEN_ALIASES.verdict], ['type', FORBIDDEN_ALIASES.type], ['updated', FORBIDDEN_ALIASES.updated], ['modified', FORBIDDEN_ALIASES.modified]];
/** @param {object} o @param {string} k @returns {boolean} */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/* A type's entry, its own key first, then its normalized name's; a front-matter value is a key as the language makes
   one of it (it is never a symbol). */
/** @template V @param {Readonly<Record<string, V>>} table @param {unknown} t @returns {V | undefined} */
const typeVocab = (table, t) => {
  const k = String(t), n = String(normalizeType(t));
  return own(table, k) ? table[k] : own(table, n) ? table[n] : undefined;
};

/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkFrontmatterContract(ctx, findings) {
  const fm = ctx.fm;
  if (!fm) return;
  for (const key of CORE_FIELDS) {
    if (!(key in fm)) findings.push(f('C-2.2', 'error', localize('record-grammar.bundle.required_core_field_key_is', 'required core field \'{key}\' is missing', { key: String(key) })));
  }
  for (const [alias, canonical] of ALIAS_PAIRS) {
    if (alias in fm) findings.push(f('C-2.3', 'error', localize('record-grammar.bundle.forbidden_alias_alias_present_canonical', 'forbidden alias \'{alias}\' present (canonical name is \'{canonical}\')', { alias: String(alias), canonical: String(canonical) }), [localize('record-grammar.bundle.rename_alias_to_canonical', 'rename \'{alias}\' to \'{canonical}\'', { alias: String(alias), canonical: String(canonical) })]));
  }
  const ot = fm.object_type;
  if (!holds([...BUNDLE_TYPES.values()], normalizeType(ot))) {
    findings.push(f('C-2.5', 'error', localize('record-grammar.bundle.object_type_ot_is_not', 'object_type \'{ot}\' is not a known type', { ot: String(ot) })));
  } else {
    const prefix = fm.id && String(fm.id).split('-')[0];
    const wantType = typeof prefix === 'string' && BUNDLE_TYPES.has(prefix) ? BUNDLE_TYPES.get(prefix) : undefined;
    if (wantType && wantType !== normalizeType(ot)) findings.push(f('C-2.5', 'error', localize('record-grammar.bundle.id_prefix_prefix_implies_wanttype', 'id prefix \'{prefix}\' implies \'{wantType}\' but object_type is \'{ot}\'', { prefix: String(prefix), wantType: String(wantType), ot: String(ot) })));
    const schema = fm.schema;
    /* N-A1 (T18): a type name may hold `_` (`action_plan`, the first that does), so the stamp's type part does too. */
    const sm = typeof schema === 'string' && /^([a-z][a-z_]*)@(\d+)$/.exec(schema);
    if (!sm) findings.push(f('C-2.5', 'error', localize('record-grammar.bundle.schema_stamp_form', 'schema stamp \'{schema}\' is not of the form <type>@<n>', { schema: String(schema) })));
    else {
      if (normalizeType(sm[1]) !== normalizeType(ot)) findings.push(f('C-2.5', 'error', localize('record-grammar.bundle.schema_stamp_schema_does_not', 'schema stamp \'{schema}\' does not match object_type \'{ot}\'', { schema: String(schema), ot: String(ot) })));
      if (!holds(ctx.knownSchemas, schema)) findings.push(f('C-2.5', 'error', localize('record-grammar.bundle.schema_version_schema_is_not', 'schema version \'{schema}\' is not known to this check catalog', { schema: String(schema) })));
    }
  }
  for (const key of ['created', 'last_updated']) {
    const v = fm[key];
    if (typeof v === 'string' && !ISO_TS_RE.test(v)) {
      findings.push(f('C-2.6', 'error', localize('record-grammar.bundle.key_v1_is_not_iso', '{key} \'{v1}\' is not ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)', { key: String(key), v1: String(v) })));
    }
  }
  const producedBy = fm.produced_by;
  if (producedBy && typeof producedBy === 'object') {
    if (!memberOf(producedBy, 'mode')) findings.push(f('C-2.2', 'error', 'produced_by.mode is missing'));
    if (!memberOf(producedBy, 'capability_tier')) findings.push(f('C-2.2', 'error', 'produced_by.capability_tier is missing'));
  }
}

/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkHeadings(ctx, findings) {
  const ot = ctx.fm?.object_type;
  /* Normalisation site 1 (REC-10): through the catalog's own alias
     machinery, never a raw table lookup patched with duplicate keys; by own
     key only (`typeVocab`, R39). */
  const required = typeVocab(HEADINGS_OF, ot);
  if (!required) return; // type invalid; C-2.5 already fired
  /* REC-14: the state-conditional canon. Permitted in every state, required in
     the states that name it — read through typeVocab like the base set, so a
     legacy focus/problem document is judged by its own contract here too. */
  const conditional = typeVocab(CONDITIONAL_OF, ot) || [];
  const canonical = [...required, ...conditional.map(c => c.heading)];
  const present = (ctx.body.match(/^## .*$/gm) || []).map(h => h.trimEnd());
  for (const h of required) {
    if (!present.includes(h)) findings.push(f('C-3.1', 'error', localize('record-grammar.bundle.required_heading_h_is_missing', 'required heading \'{h}\' is missing', { h: String(h) }), [localize('record-grammar.bundle.insert_canonical_heading_h_with', 'insert canonical heading \'{h}\' with empty body', { h: String(h) })]));
  }
  for (const c of conditional) {
    /* CASE-4 / DEC-72: the condition is THE CASE RELATION, not a state word.
       `states:` is gone from this shape because the state it named is gone from
       the machine; the requirement is unchanged. */
    const owed = c.whenCaseMember ? isCaseMemberBytes(ctx.fm)
               : holds(c.states || [], ctx.fm?.current_state);
    if (owed && !present.includes(c.heading))
      findings.push(f('C-3.1', 'error', localize('record-grammar.bundle.required_heading_heading_is_missing', 'required heading \'{heading}\' is missing: a member of a published case carries it', { heading: String(c.heading) }), [localize('record-grammar.bundle.insert_canonical_heading_heading_with', 'insert canonical heading \'{heading}\' with the assertion in it', { heading: String(c.heading) })]));
  }
  for (const h of present) {
    if (!canonical.includes(h)) findings.push(f('C-3.1', 'error', localize('record-grammar.bundle.heading_h_is_not_in', 'heading \'{h}\' is not in the canonical set for {ot}', { h: String(h), ot: String(ot) }), [localize('record-grammar.bundle.rename_to_the_canonical_heading_preserving', 'rename to the canonical heading, preserving body')]));
  }
}

/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkStateLegality(ctx, findings) {
  const ot = ctx.fm?.object_type;
  /* Normalisation site 1 (REC-10), same as checkHeadings: the second rename
     patched this lookup with STATES.problem = STATES.focus instead of
     normalising, and DATA-MODEL.md §2.7 measured what that costs. */
  const spec = typeVocab(MACHINE_OF, ot);
  const fm = ctx.fm;
  if (!spec || !fm) return;
  const cur = fm.current_state;
  /* CASE-4 / DEC-72: `legacy` is READ HERE AND NOWHERE ELSE, which is the point
     of it being a separate key. A word this machine no longer produces is still
     a word its own signed history carries, and refusing bytes we ourselves
     ratified would make the catalog reject the record. It is deliberately NOT
     folded into `legal`: every OTHER reader of this table — the affordance
     derivation, the transition guards, `edgesFrom` — asks what the machine can
     DO, and must see the shorter list. */
  const legacy = memberOf(spec, 'legacy');
  const readable = [...spec.legal, ...(isList(legacy) ? legacy : [])];
  if (!holds(readable, cur)) {
    findings.push(f('C-4.1', 'error', localize('record-grammar.bundle.current_state_cur_is_not', 'current_state \'{cur}\' is not legal for {ot} (legal: {legal})', { cur: String(cur), ot: String(ot), legal: String(spec.legal.join(', ')) })));
  }
  const history = fm.state_history;
  const hist = Array.isArray(history) ? history : [];
  for (let i = 0; i < hist.length; i++) {
    const e = hist[i];
    if (typeof e !== 'object' || e === null) { findings.push(f('C-4.2', 'error', localize('record-grammar.bundle.state_history_i_is_not', 'state_history[{i}] is not an object', { i: String(i) }))); continue; }
    const timestamp = memberOf(e, 'timestamp');
    if (typeof timestamp === 'string' && !ISO_TS_RE.test(timestamp)) {
      findings.push(f('C-2.6', 'error', localize('record-grammar.bundle.state_history_i_timestamp_timestamp', 'state_history[{i}].timestamp \'{timestamp}\' is not ISO 8601 UTC', { i: String(i), timestamp: String(timestamp) })));
    }
  }
}

/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkWriteCompleteness(ctx, findings) {
  const fm = ctx.fm;
  if (!fm) return;
  const created = fm.created, lastUpdated = fm.last_updated;
  if (typeof created === 'string' && typeof lastUpdated === 'string' && lastUpdated < created) {
    findings.push(f('C-13.1', 'error', localize('record-grammar.bundle.last_updated_last_updated_precedes', 'last_updated \'{last_updated}\' precedes created \'{created}\'', { last_updated: String(lastUpdated), created: String(created) })));
  }
  const history = fm.state_history;
  const hist = Array.isArray(history) ? history : [];
  if (hist.length > 0) {
    const newest = memberOf(hist[hist.length - 1], 'timestamp');
    if (typeof newest === 'string' && typeof lastUpdated === 'string' && lastUpdated < newest) {
      findings.push(f('C-13.1', 'error', localize('record-grammar.bundle.last_updated_precedes_the_newest', 'last_updated precedes the newest state_history timestamp \'{newest}\'', { newest: String(newest) })));
    }
  }
  if (typeof created === 'string' && typeof lastUpdated === 'string' && lastUpdated > created) {
    const idx = ctx.body.indexOf('## Session Log');
    const section = idx >= 0 ? ctx.body.slice(idx, ctx.body.indexOf('\n## ', idx + 1) === -1 ? undefined : ctx.body.indexOf('\n## ', idx + 1)) : '';
    if (!/^### Session /m.test(section)) {
      findings.push(f('C-13.2', 'error', localize('record-grammar.bundle.record_has_been_updated_but_carries', 'record has been updated but carries no Session Log entry'), [localize('record-grammar.bundle.append_the_missing_session_log_entry', 'append the missing Session Log entry naming the gap')]));
    }
  }
}

/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkFormatHygiene(ctx, findings) {
  const escapeRe = /\\[#*_\-\[\]!~&]/;
  for (const [path, content] of ctx.files) {
    const name = path.split('/').pop() || path;
    if (!FILENAME_RE.test(name) || name.includes(' ') || !name.includes('.') || !/\.[a-z0-9]+$/.test(name)) {
      findings.push(f('C-14.2', 'error', localize('record-grammar.bundle.filename_path_violates_the_naming', 'filename \'{path}\' violates the naming rule', { path: String(path) }), [localize('record-grammar.bundle.rename_file_and_update_references', 'rename file and update references')]));
    }
    if (name.endsWith('.md')) {
      const text = asText(content);
      const m = escapeRe.exec(text);
      if (m) findings.push(f('C-14.1', 'error', localize('record-grammar.bundle.escaped_markdown_character_v1_in', 'escaped markdown character \'{v1}\' in {path}', { v1: String(m[0]), path: String(path) }), ['normalize to clean markdown']));
    }
    if (name.endsWith('.json')) {
      try { JSON.parse(asText(content)); }
      catch { findings.push(f('C-14.3', 'error', localize('record-grammar.bundle.path_does_not_parse_as', '{path} does not parse as JSON', { path: String(path) }), ['restore from history'])); }
    }
  }
  const listed = ctx.fm?.visuals;
  const visuals = Array.isArray(listed) ? listed : [];
  const svgOnDisk = [...ctx.files.keys()].filter(p => !p.includes('/') && p.endsWith('.svg'));
  for (const v of visuals) {
    if (typeof v !== 'object' || !memberOf(v, 'file') || !memberOf(v, 'description')) {
      findings.push(f('C-14.4', 'error', localize('record-grammar.bundle.visuals_entry_stringify_lacks_file', 'visuals entry {stringify} lacks file+description', { stringify: String(JSON.stringify(v).slice(0, 50)) })));
      continue;
    }
    const file = memberOf(v, 'file');
    if (!(typeof file === 'string' && ctx.files.has(file))) findings.push(f('C-14.4', 'error', localize('record-grammar.bundle.visuals_entry_file_has_no', 'visuals entry \'{file}\' has no file on disk', { file: String(file) })));
  }
  for (const svg of svgOnDisk) {
    if (!visuals.some(v => Boolean(v) && memberOf(v, 'file') === svg)) {
      findings.push(f('C-14.4', 'error', localize('record-grammar.bundle.svg_svg_on_disk_is', 'svg \'{svg}\' on disk is absent from the visuals array', { svg: String(svg) })));
    }
  }
}

/** @param {BundleContext} ctx @param {Finding[]} findings */
async function checkQueueAndBase(ctx, findings) {
  // C-16.5: stale advisory artifacts (claims, presence markers, and, at
  // 1.12.0, checkpointed-promotion gate verdicts) never lie around.
  // PROMOTING/PRESENCE are execution-scoped: stale at 10 minutes.
  // GATE_PASSED-<hash8> is a promotion checkpoint (KICKOFF-P2M6 4a item 2):
  // it must survive retry cadences across executions, so its window is 48
  // hours; it is hash-bound to one manifest, honored only fresh, and the
  // promoter removes it on successful consumption, so a survivor here is a
  // crashed or superseded promotion worth surfacing.
  // LEASE-<actor> (1.14.0, P2M8 A2) is the edit lease's marker: it carries
  // its OWN expiry ({acquired, expires}, ten-minute TTL renewed at five),
  // so it is stale exactly when past its self-declared expires; the
  // endpoint sweeps expired leases on sight and a survivor here is a
  // crashed holder, the same failure class as a crashed promoter.
  const staleMs = 10 * 60 * 1000;
  const gateMarkerStaleMs = 48 * 60 * 60 * 1000;
  for (const p of ctx.files.keys()) {
    const gm = /^GATE_PASSED-[0-9a-f]{8}\.json$/.exec(p);
    const lm = gm ? null : /^LEASE-[A-Za-z0-9][A-Za-z0-9-]{0,63}\.json$/.exec(p);
    const m = (gm || lm) ? null : /^(PROMOTING|PRESENCE)-.+\.json$/.exec(p);
    if (!gm && !lm && !m) continue;
    /** @type {boolean} */
    let stale;
    if (lm) {
      /** @type {number | null} */
      let expires = null;
      try { expires = Date.parse(/** @type {{expires?: string}} */ (JSON.parse(asText(ctx.files.get(p)))).expires || ''); } catch { /* fallthrough */ }
      const at = expires;
      stale = at === null || Number.isNaN(at) || (ctx.nowMs ?? Date.now()) > at;
    } else {
      const windowMs = gm ? gateMarkerStaleMs : staleMs;
      /** @type {number | null} */
      let ts = null;
      try { const rec = /** @type {{ts?: string, 'started-at'?: string, started_at?: string}} */ (JSON.parse(asText(ctx.files.get(p)))); ts = Date.parse(rec.ts || rec['started-at'] || rec.started_at || ''); } catch { /* fallthrough */ }
      const at = ts;
      stale = at === null || Number.isNaN(at) || (ctx.nowMs ?? Date.now()) - at > windowMs;
    }
    if (stale) {
      findings.push(f('C-16.5', 'info', localize('record-grammar.bundle.stale_advisory_artifact_p_crashed', 'stale advisory artifact \'{p}\' (crashed or ended actor)', { p: String(p) }), [localize('record-grammar.bundle.delete_the_stale_claim_or_presence', 'delete the stale claim or presence marker')]));
    }
  }
  const manifestRaw = ctx.files.get('PENDING_PROMOTION.json');
  const pendingFiles = [...ctx.files.keys()].filter(p => p.endsWith('.pending'));

  if (!manifestRaw) {
    for (const p of pendingFiles) {
      findings.push(f('C-16.4', 'error', localize('record-grammar.bundle.orphaned_pending_file_p_with', 'orphaned pending file \'{p}\' with no manifest', { p: String(p) }), [localize('record-grammar.bundle.complete_consumption_archive_manifest_delete_consumed', 'complete consumption: archive manifest, delete consumed files (idempotent)')]));
    }
    return;
  }
  /* The package's manifest is its producer's (promotion); its shape is stated here until its owner offers a reader. */
  /** @typedef {{target?: unknown, base?: unknown, files?: ({name?: string, sha256?: string} | null)[], created?: unknown}} PendingManifest */
  /** @type {PendingManifest} */
  let man;
  try { man = /** @type {PendingManifest} */ (JSON.parse(asText(manifestRaw))); }
  catch { findings.push(f('C-16.1', 'error', 'PENDING_PROMOTION.json does not parse')); return; }

  for (const k of ['target', 'base', 'files', 'created', 'author', 'skill_version']) {
    if (!(k in man)) findings.push(f('C-16.1', 'error', `manifest missing '${k}'`));
  }
  const target = man.target;
  if (target && target !== ctx.folderName) {
    findings.push(f('C-16.1', 'error', localize('record-grammar.bundle.manifest_target_target_does_not', 'manifest target \'{target}\' does not match record \'{folderName}\'', { target: String(target), folderName: String(ctx.folderName) })));
  }
  /** @type {Set<string>} */
  const listed = new Set();
  const manifestFiles = man.files;
  if (Array.isArray(manifestFiles)) {
    for (const entry of manifestFiles) {
      const name = entry ? entry.name : undefined, sha = entry ? entry.sha256 : undefined;
      if (!entry || !name || !sha) {
        findings.push(f('C-16.1', 'error', localize('record-grammar.bundle.manifest_files_entry_stringify_lacks', 'manifest files entry {stringify} lacks name+sha256', { stringify: String(JSON.stringify(entry)) })));
        continue;
      }
      listed.add(name + '.pending');
      const pending = ctx.files.get(name + '.pending');
      if (!pending) {
        findings.push(f('C-16.2', 'error', localize('record-grammar.bundle.package_file_name_pending_listed', 'package file \'{name}.pending\' listed in manifest is missing', { name: String(name) }), [localize('record-grammar.bundle.discard_the_package_with_a_finding', 'discard the package with a finding to the producing author'), localize('record-grammar.bundle.re_produce_the_package_from_the', 're-produce the package from the originating session outputs')]));
        continue;
      }
      const hash = await ctx.sha256(pending);
      if (hash !== sha) {
        findings.push(f('C-16.2', 'error', `hash mismatch on '${name}.pending' (manifest ${String(sha).slice(0, 12)}…, actual ${hash.slice(0, 12)}…)`, [localize('record-grammar.bundle.discard_the_package_never_promote', 'discard the package (never promote)'), 're-produce the package']));
      }
    }
  }
  for (const p of pendingFiles) {
    if (!listed.has(p)) findings.push(f('C-16.4', 'error', localize('record-grammar.bundle.pending_file_p_is_not', 'pending file \'{p}\' is not listed in the manifest', { p: String(p) }), [localize('record-grammar.bundle.complete_consumption_or_discard_with_reason', 'complete consumption or discard with reason')]));
  }
  // staleness
  const created = man.created;
  if (typeof created === 'string' && ISO_TS_RE.test(created)) {
    const ageDays = ((ctx.nowMs ?? Date.now()) - Date.parse(created)) / 86400000;
    if (ageDays > ctx.maxPackageAgeDays) {
      findings.push(f('C-16.3', 'warn', localize('record-grammar.bundle.pending_package_is_floor_days', 'pending package is {floor} days old (policy {maxPackageAgeDays})', { floor: String(Math.floor(ageDays)), maxPackageAgeDays: String(ctx.maxPackageAgeDays) }), ['promote now', localize('record-grammar.bundle.discard_with_reason_if_superseded_preserving', 'discard with reason if superseded, preserving the manifest as a record')]));
    }
  } else {
    findings.push(f('C-16.1', 'error', localize('record-grammar.bundle.manifest_created_created_is_not', 'manifest created \'{created}\' is not ISO 8601 UTC', { created: String(man.created) })));
  }
  // (base coherence follows below)
  const live = ctx.files.get('bundle.md');
  const base = man.base;
  if (live && typeof base === 'string') {
    const liveHash = await ctx.sha256(live);
    if (liveHash === base) {
      findings.push(f('C-17.1', 'info', localize('record-grammar.bundle.pending_package_base_matches_live_bundle', 'pending package base matches live bundle.md: fast-forward eligible')));
    } else {
      findings.push(f('C-17.1', 'warn', localize('record-grammar.bundle.pending_package_base_string_does', 'pending package base {String}… does not match live bundle.md {liveHash}…: divergence', { String: String(String(base).slice(0, 12)), liveHash: String(liveHash.slice(0, 12)) }), [localize('record-grammar.bundle.rebase_via_a_reconciliation_session', 'rebase via a reconciliation session'), 'supersede: human selects one, the other preserved as a diverged branch in _history', localize('record-grammar.bundle.apply_disjoint_if_file_sets_prove', 'apply-disjoint if file sets prove disjoint (requires history manifests)')]));
    }
  }
}

// ---------------------------------------------------------------------------
// Step-4 families: C-5 append-only, C-6 references, C-12 history, C-15 recheck.
// ---------------------------------------------------------------------------

/* `links_to` joined the vocabulary with 0.45.0, and it is the only value here
   that is NOT a member's act. Every other relation is something a member
   decided: this document cites that one, supersedes it, was elevated into it.
   `links_to` is something the SOURCE asserted and BIO observed, and in a system
   whose subject is who claimed what, "we say these are connected" and "the
   City's page carried an anchor tag" cannot be the same edge.
   *
   * It also differs in what it claims about VERSION. A member citing declares
   which thing they mean. An observed link declares nothing: the page's author
   did not say which edition of the target they intended and usually did not
   think about it. So a links_to edge carries a contemporaneity verdict, and
   `undetermined` is its resting state.
   *
   * A member may PROMOTE an observed links_to into a cites, which is a member's
   act and is recorded as one. That promotion is the point of holding it. */
/* REC-24 (g) adds `responds_to`, and it arrives WITH A PRODUCER AND A CONSUMER
   because REC-16 already paid for the alternative: `supersedes` sat in this
   array for weeks with zero occurrences in store.mjs, and membership of the
   vocabulary meant only that C-6.1 would not refuse the string. So the edge
   arrives governed. It is written by op=actioncorrespond onto the CAPTURED
   REPLY — the response document points back at the action, which is the
   direction SB-OUTPUT's A10 row names — and it is read by op=projection's
   derived action block, which answers "what responded to this action" as one
   indexed lookup over refs_target. Its requirement (below) is that the target
   is an ACTION: an edge saying "this is a response" that points at a question
   or a document asserts a correspondence that never happened. */
const REL_VOCAB = ['cites', 'relates_to', 'elevated_into', 'initiates', 'derived_from', 'supersedes', 'corroborates', 'links_to', 'responds_to'];
/* Source-asserted relations. Not a member's claim, so surfaces that count what a
   group has said about its material must exclude them, and a corroboration count
   that included them would be counting the source agreeing with itself. */
const SOURCE_ASSERTED_RELS = ['links_to'];
const EDGE_STATUS = ['proposed', 'confirmed', 'severed'];

/** @param {BundleContext} ctx @returns {string | null} */
function latestHistorySnapshot(ctx) {
  const snaps = [...ctx.files.keys()].filter(p => /^_history\/bundle_.*\.md$/.test(p)).sort();
  return snaps.length ? (snaps[snaps.length - 1] ?? null) : null;
}

/** C-5: append-only surfaces never mutated, verified against the latest history snapshot. */
/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkAppendOnly(ctx, findings) {
  const snapPath = latestHistorySnapshot(ctx);
  const fm = ctx.fm;
  if (!snapPath || !fm) return; // nothing to compare against yet
  const snap = parseFrontmatter(asText(ctx.files.get(snapPath)));
  const snapData = snap.data;
  if (!snapData) return; // a malformed snapshot is C-12's problem
  /* REC-136 / INVESTIGATIVE-SESSION.md §7.1 item 7: a project's `conclusions`
     is the SAME kind of surface as `state_history` — every conclusion and
     withdrawal a project made, readable forever (DEC-19) — so it is held by the
     same rule, structurally rather than by the writer's convention. */
  for (const key of ['state_history', 'conclusions']) {
    const priorValue = snapData[key], liveValue = fm[key];
    const prior = Array.isArray(priorValue) ? priorValue : [];
    const live = Array.isArray(liveValue) ? liveValue : [];
    if (live.length < prior.length) {
      findings.push(f('C-5.1', 'error', localize('record-grammar.bundle.key_shrank_from_length_to', '{key} shrank from {length} to {length_2} entries vs. the latest snapshot', { key: String(key), length: String(prior.length), length_2: String(live.length) }), ['restore from _history and re-append new material']));
    } else {
      for (let i = 0; i < prior.length; i++) {
        if (JSON.stringify(prior[i]) !== JSON.stringify(live[i])) {
          findings.push(f('C-5.1', 'error', localize('record-grammar.bundle.key_i_was_modified_retroactively', '{key}[{i}] was modified retroactively (append-only surface)', { key: String(key), i: String(i) }), ['restore from _history and re-append new material']));
          break;
        }
      }
    }
  }
  const rn = sectionText(snap.body, '## Review Notes');
  if (rn && rn.trim() !== '## Review Notes' && !ctx.body.includes(rn.trimEnd())) {
    findings.push(f('C-5.1', 'error', localize('record-grammar.bundle.review_notes_content_from_the', 'Review Notes content from the prior version is missing or altered (verbatim-immutable)'), ['restore from _history and re-append new material', localize('record-grammar.bundle.record_a_tamper_finding_if_history', 'record a tamper finding if history lacks the original')]));
  }
  const priorLog = sectionText(snap.body, '## Session Log') || '';
  for (const header of priorLog.match(/^### Session .*$/gm) || []) {
    if (!ctx.body.includes(header)) {
      findings.push(f('C-5.1', 'error', localize('record-grammar.bundle.session_log_entry_header_from', 'Session Log entry \'{header}\' from the prior version is missing (append-only surface)', { header: String(header.slice(0, 60)) }), ['restore from _history and re-append new material']));
    }
  }
  // changes.json prefix, when a prior snapshot of it exists
  const chSnaps = [...ctx.files.keys()].filter(p => /^_history\/data\/changes_.*\.json$/.test(p)).sort();
  const liveCh = ctx.files.get('data/changes.json');
  if (chSnaps.length && liveCh) {
    try {
      /* data/changes.json is its writer's (record-core); its shape is stated here until its owner offers a reader. */
      const priorRecs = /** @type {{records?: object[]}} */ (JSON.parse(asText(ctx.files.get(chSnaps[chSnaps.length - 1] ?? '')))).records || [];
      const liveRecs = /** @type {{records?: object[]}} */ (JSON.parse(asText(liveCh))).records || [];
      if (liveRecs.length < priorRecs.length || JSON.stringify(liveRecs.slice(0, priorRecs.length)) !== JSON.stringify(priorRecs)) {
        findings.push(f('C-5.1', 'error', localize('record-grammar.bundle.data_changes_json_records_were_mutated', 'data/changes.json records were mutated or removed (append-only surface)'), ['restore from _history and re-append new material']));
      }
    } catch { /* parse findings elsewhere */ }
  }
}

/** C-6: reference shape, substrate independence, required edges, and (when a resolver is injected) target resolution. */
/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkReferences(ctx, findings) {
  const refList = ctx.fm?.references;
  const refs = Array.isArray(refList) ? refList : [];
  for (let i = 0; i < refs.length; i++) {
    const r = refs[i];
    if (typeof r !== 'object' || r === null) { findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_is_not_an', 'references[{i}] is not an object', { i: String(i) }))); continue; }
    const rel = memberOf(r, 'rel'), assertedBy = memberOf(r, 'asserted_by'), address = memberOf(r, 'address');
    const verdict = memberOf(r, 'verdict'), status = memberOf(r, 'status');
    if (!holds(REL_VOCAB, rel)) findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_rel_rel_is', 'references[{i}].rel \'{rel}\' is not in the closed vocabulary', { i: String(i), rel: String(rel) }), [localize('record-grammar.bundle.map_to_the_nearest_vocabulary_value', 'map to the nearest vocabulary value'), 'sever with reason']));
    /* A source-asserted edge has to say so on its face and carry the two things
       that distinguish it from a member's citation: the address the source
       actually wrote, and a verdict about which version it pointed at. Without
       the address it is unattributable; without the verdict it reads as a
       settled connection when the usual answer is that nothing established it. */
    if (holds(SOURCE_ASSERTED_RELS, rel)) {
      if (assertedBy !== 'source')
        findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_rel_rel_is_2', 'references[{i}].rel \'{rel}\' is source-asserted and must carry asserted_by: \'source\', so it is never read as a member\'s claim', { i: String(i), rel: String(rel) })));
      if (typeof address !== 'string' || !address)
        findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_rel_rel_must', 'references[{i}].rel \'{rel}\' must carry the address the source wrote, as a comment string beside the canonical target', { i: String(i), rel: String(rel) })));
      if (!holds(['contemporaneous', 'superseded', 'undetermined'], verdict))
        findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_rel_rel_must_2', 'references[{i}].rel \'{rel}\' must carry a contemporaneity verdict of contemporaneous, superseded or undetermined; undetermined is the resting state and must be stated rather than omitted', { i: String(i), rel: String(rel) })));
    } else if (assertedBy === 'source') {
      findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_rel_rel_is_3', 'references[{i}].rel \'{rel}\' is a member\'s relation and cannot be asserted_by \'source\'', { i: String(i), rel: String(rel) })));
    }
    if (!holds(EDGE_STATUS, status)) findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_status_status_is', 'references[{i}].status \'{status}\' is not one of: {EDGE_STATUS}', { i: String(i), status: String(status), EDGE_STATUS: String(EDGE_STATUS.join(', ')) })));
    const t = memberOf(r, 'target');
    if (typeof t !== 'string' || /:\/\/|[/\\]|drive\.google/i.test(t)) {
      findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_target_string_looks', 'references[{i}].target \'{String}\' looks like a substrate locator; targets are canonical IDs only', { i: String(i), String: String(String(t).slice(0, 40)) })));
    } else if (!BUNDLE_ID_RE.test(t)) {
      findings.push(f('C-6.1', 'error', localize('record-grammar.bundle.references_i_target_t_does', 'references[{i}].target \'{t}\' does not match the canonical ID grammar', { i: String(i), t: String(t) })));
    } else if (ctx.resolveTarget) {
      if (!ctx.resolveTarget?.(t)) {
        findings.push(f('C-6.2', 'error', localize('record-grammar.bundle.references_i_target_t_does_2', 'references[{i}].target \'{t}\' does not resolve in the store', { i: String(i), t: String(t) }), ['restore target from history', 're-point to the successor object (derived_from chain)', localize('record-grammar.bundle.sever_the_edge_with_a_reason', 'sever the edge with a reason note')]));
      }
    }
  }
  /* C-6.3 raises nothing here (K904, form (b); N456, T21): its last arm here, a project whose `workproduct_state` was
     `distributed` with no `distributions/`, went with the hand-written project stage, which `project-stage` now
     computes at the read. C-6.3's basis-in-references arm is inquiry-grammar's (C-2.8's family). */
  /* REC-16: `supersedes` gains requirements, the way `links_to` has them (C-6.1). They are inquiry's, the
     supersession and division-disclosure arms, and since T19 they are not called from here: `checkBundle` runs them as
     the `checkSupersession` arm, directly after this function, where a registered grammar takes its place (draft-T19,
     rule 2), so the findings keep their order. */
}

/* G59 (fix round 7): WHERE A SNAPSHOT'S COPY IS STORED, derived exactly as record-core's `snapPath` derives it: the key
   goes in the file's NAME before its last dot, or at the end of a name with no dot, and the dot is looked for in the name
   after the last `/`, never in the whole path. A name with no dot (`snapshots/upload-<sha>`, which the capture writer
   names so) once lost its last character to the extension formula and the checker looked for a copy that is not stored
   (C-12.2 "is missing", so a case citing a vouched upload could not be signed); a directory with a dot and a file
   without one (`a.b/c`) needs the cut at the last `/` first. */
/** @param {string} name @param {string | undefined} key @returns {string} */
function snapshotCopyPath(name, key) {
  const cut = name.lastIndexOf('/');
  const dir = cut === -1 ? '' : name.slice(0, cut + 1);
  const base = cut === -1 ? name : name.slice(cut + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? `_history/${dir}${base}_${key}` : `_history/${dir}${base.slice(0, dot)}_${key}${base.slice(dot)}`;
}

/* R65 (T52-2): a history file belongs to the manifest entry whose listed key ends its name's stem, whatever the key's
   form (a stamp with or without milliseconds; an infix a writer adds: `_links_`, `_bar`, `_plan`, `_close`, `takeup_`,
   `resolve_`). The key follows a `_` in the file's name and is followed by the extension's dot or the name's end;
   a key holding a dot (a stamp with milliseconds) is tried at each dot. History already written is never rewritten. */
/** @param {string} p @param {Set<string>} keys @returns {string | null} */
function listedKeyOf(p, keys) {
  const base = p.slice(p.lastIndexOf('/') + 1);
  for (let i = base.indexOf('_'); i !== -1; i = base.indexOf('_', i + 1)) {
    const rest = base.slice(i + 1);
    if (keys.has(rest)) return rest;
    for (let d = rest.indexOf('.'); d !== -1; d = rest.indexOf('.', d + 1)) {
      if (keys.has(rest.slice(0, d))) return rest.slice(0, d);
    }
  }
  return null;
}

/** C-12: history manifest coherence and snapshot accounting. */
/** @param {BundleContext} ctx @param {Finding[]} findings */
function checkHistoryCoherence(ctx, findings) {
  const histFiles = [...ctx.files.keys()].filter(p => p.startsWith('_history/'));
  const manRaw = ctx.files.get('_history/manifest.json');
  if (!manRaw) {
    if (histFiles.length) findings.push(f('C-12.1', 'error', '_history contains files but no manifest.json', [localize('record-grammar.bundle.rebuild_manifest_entry_from_surviving_files', 'rebuild manifest entry from surviving files')]));
    return;
  }
  /* The history manifest is its writer's (record-core); its shape is stated here until its owner offers a reader. */
  /** @typedef {{key?: string, kind?: unknown, created?: unknown, files?: unknown, snapshotted?: string[]}} HistoryEntry */
  /** @type {{entries?: (HistoryEntry | null)[]}} */
  let man;
  try { man = /** @type {{entries?: (HistoryEntry | null)[]}} */ (JSON.parse(asText(manRaw))); }
  catch { findings.push(f('C-12.1', 'error', '_history/manifest.json does not parse', [localize('record-grammar.bundle.rebuild_manifest_entry_from_surviving_files', 'rebuild manifest entry from surviving files')])); return; }
  const entryList = man.entries;
  const entries = Array.isArray(entryList) ? entryList : [];
  /** @type {Set<string>} */
  const keys = new Set();
  let prevKey = '';
  /** @type {string[]} */
  const bundleMdCreated = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    for (const k of ['key', 'kind', 'created', 'files']) if (!(k in (e || {}))) findings.push(f('C-12.1', 'error', `manifest entry[${i}] missing '${k}'`));
    const key = e?.key, created = e?.created, snapshotted = e?.snapshotted;
    if (key) {
      if (keys.has(key)) findings.push(f('C-12.1', 'error', localize('record-grammar.bundle.duplicate_manifest_key_key', 'duplicate manifest key \'{key}\'', { key: String(key) })));
      if (key < prevKey) findings.push(f('C-12.1', 'error', localize('record-grammar.bundle.manifest_keys_out_of_order', 'manifest keys out of order at \'{key}\'', { key: String(key) })));
      keys.add(key); prevKey = key;
    }
    // Collected, not maxed, because the newest bundle.md-changing entry has to
    // be excluded below. See the C-12.1 note at the comparison.
    if (typeof created === 'string' && Array.isArray(snapshotted) && snapshotted.includes('bundle.md')) {
      bundleMdCreated.push(created);
    }
    if (e?.kind === 'promotion' && key && !ctx.files.has(`_history/promotion_${key}.json`)) {
      findings.push(f('C-12.2', 'error', localize('record-grammar.bundle.promotion_record_for_key_is', 'promotion record for \'{key}\' is missing', { key: String(key) }), [localize('record-grammar.bundle.rebuild_manifest_entry_from_surviving_files', 'rebuild manifest entry from surviving files'), localize('record-grammar.bundle.record_a_history_loss_finding_and', 'record a history-loss finding and re-snapshot current state')]));
    }
    if (Array.isArray(snapshotted)) {
      for (const name of snapshotted) {
        const snapPath = snapshotCopyPath(name, key);
        // 1.16.5: hasFile_, not files.has. This is an EXISTENCE assertion, and
        // the 1.13.0 presence rule above says existence assertions consult
        // files UNION elided. Using files.has here made every tier-scoped read
        // report its history snapshots as lost: 71 phantom findings across a
        // 30-bundle store, and it forced a byte-complete image on any caller
        // that wanted to gate, which for a bundle carrying a 39.6MB capture
        // means pulling that capture and its history copies into memory to
        // answer a question about whether a file exists. Byte checks below are
        // unchanged and still read ctx.files directly.
        if (!hasFile_(ctx, snapPath)) {
          findings.push(f('C-12.2', 'error', localize('record-grammar.bundle.snapshot_snappath_recorded_in_manifest', 'snapshot \'{snapPath}\' recorded in manifest entry \'{key}\' is missing', { snapPath: String(snapPath), key: String(key) }), [localize('record-grammar.bundle.record_a_history_loss_finding_and', 'record a history-loss finding and re-snapshot current state')]));
        }
      }
    }
  }
  // The REFUSAL class (accelerator 0.12.8) is accounted for on its own terms,
  // not through the version manifest.
  //
  // A terminal refusal writes `_history/refused_<stamp>_<hash>.json` naming the
  // outcome, plus the preserved payload under `_history/refused_<stamp>_<hash>/`.
  // None of that is part of the version chain: it records material that never
  // entered history, so the manifest, which indexes promotions and the snapshots
  // they took, has nothing to say about it.
  //
  // Requiring a manifest entry anyway is what the first version of this check
  // did, and the consequence was severe: every terminal refusal permanently
  // froze the bundle it happened in, because the orphan finding is an error and
  // the gate judges the post-promotion image, so no later package could ever
  // pass. Observed live on INFO-2026-5460 on 2026-07-22, which is the bundle
  // holding migration_instant, so a single refused fence edit made the fence
  // itself unchangeable. Exactly the C-12.1 failure shape, by a second route.
  //
  // Accounting is not abandoned, only re-seated: a preserved payload must carry
  // its sibling record, and the record must parse and name an outcome, so
  // nothing sits in _history unexplained. The hash length is not constrained
  // here, because records written before the twins agreed on slice(0, 8) carry
  // the full digest and are honest history that must not go red retroactively.
  const REFUSAL_RECORD = /^_history\/refused_(\d{8}T\d{6}Z_[0-9a-f]{8,64}|unknown_[0-9a-f]{8,64}|[^/]*nomanifest)\.json$/;
  const REFUSAL_PAYLOAD = /^_history\/refused_(\d{8}T\d{6}Z_[0-9a-f]{8,64}|unknown_[0-9a-f]{8,64}|[^/]*nomanifest)\//;
  for (const p of histFiles) {
    if (p === '_history/manifest.json') continue;
    const rec = REFUSAL_RECORD.exec(p);
    if (rec) {
      /* A refusal record is its writer's (promotion); its shape is stated here until its owner offers a reader. */
      /** @type {{outcome?: unknown} | null} */
      let parsed = null;
      try { parsed = /** @type {{outcome?: unknown} | null} */ (JSON.parse(asText(ctx.files.get(p)))); } catch { /* reported below */ }
      const record = parsed;
      if (!record || !record.outcome) {
        findings.push(f('C-12.2', 'error', localize('record-grammar.bundle.refusal_record_p_does_not', 'refusal record \'{p}\' does not parse or names no outcome', { p: String(p) }),
          [localize('record-grammar.bundle.restore_the_refusal_record_from_history', 'restore the refusal record from history'), localize('record-grammar.bundle.remove_the_unexplained_refusal_artifacts', 'remove the unexplained refusal artifacts')]));
      }
      continue;
    }
    const pay = REFUSAL_PAYLOAD.exec(p);
    if (pay) {
      const sibling = `_history/refused_${pay[1]}.json`;
      if (!ctx.files.has(sibling)) {
        findings.push(f('C-12.2', 'error', localize('record-grammar.bundle.preserved_refusal_payload_p_has', 'preserved refusal payload \'{p}\' has no refusal record at \'{sibling}\'', { p: String(p), sibling: String(sibling) }),
          ['restore the refusal record', localize('record-grammar.bundle.remove_the_orphaned_preserved_payload', 'remove the orphaned preserved payload')]));
      }
      continue;
    }
    /* The key is followed by the extension's dot, or ends the name when the copy's name has none (G59). */
    const m = /_((?:\d{8}T\d{6}Z)_[0-9a-f]{8})(?:\.|$)/.exec(p) || /^_history\/promotion_(.+)\.json$/.exec(p);
    const key = m ? m[1] : null;
    if ((!key || !keys.has(key)) && !listedKeyOf(p, keys)) {
      findings.push(f('C-12.2', 'error', localize('record-grammar.bundle.history_file_p_maps_to', 'history file \'{p}\' maps to no manifest entry', { p: String(p) }), [localize('record-grammar.bundle.rebuild_manifest_entry_from_surviving_files', 'rebuild manifest entry from surviving files')]));
    }
  }
  // C-12.1 staleness: live bundle.md must not predate history.
  //
  // Two narrowings, both learned the hard way on 2026-07-22.
  //
  // 1. Only entries that CHANGED bundle.md count. last_updated is a field in
  //    bundle.md describing bundle.md; a promotion that touched only data/
  //    files has no business advancing it.
  //
  // 2. The newest such entry is excluded, because it is the promotion that
  //    WROTE the live bytes. Comparing a document against the moment its own
  //    package was assembled is circular, and `created` is assembly time, not
  //    content time. A document may legitimately carry an earlier semantic
  //    timestamp: a signed ratification records the transition INSTANT, which
  //    always precedes the packaging that delivers it.
  //
  // Without narrowing 2 a ratified bundle was permanently frozen. Its
  // last_updated is pinned by the release signature, which binds bundle.md's
  // bytes, so satisfying C-12.1 meant editing bundle.md and destroying the
  // ratification, while not editing it meant no further promotion could ever
  // gate. The registry bundle holds migration_instant, so that deadlock made
  // the fence itself unchangeable.
  //
  // What survives: a genuine revert still fails, because live is still
  // compared against every EARLIER bundle.md-changing promotion.
  const sorted = bundleMdCreated.slice().sort();
  sorted.pop();                                   // the promotion that wrote live
  const newestPrior = sorted.length ? sorted[sorted.length - 1] : '';
  const lastUpdated = ctx.fm?.last_updated;
  if (typeof lastUpdated === 'string' && newestPrior && lastUpdated < newestPrior) {
    findings.push(f('C-12.1', 'error', localize('record-grammar.bundle.live_last_updated_last_updated', 'live last_updated \'{last_updated}\' precedes an earlier history entry \'{newestPrior}\': the live bundle.md is older than a version already superseded', { last_updated: String(lastUpdated), newestPrior: String(newestPrior) }),
      [localize('record-grammar.bundle.restore_the_newer_bundle_md_from', 'restore the newer bundle.md from history'), 'correct last_updated to reflect the live content']));
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/* §1b (T18, K585 (2)): THE GRAMMARS SEAM (R28). A type grammar leaves the check catalogue by registering with
 * record-core (`registerGrammar(module, {ids, arm})`), whose audit and promotion's gate pass the registrations here as
 * `opts.grammars`, a list `[{module, ids, arm(ctx, findings)}]` in module order. Each type arm below is a PLACE in the
 * order, claimed by its whole id list: a grammar whose `ids` hold all of one arm's ids runs IN THAT ARM'S PLACE, over
 * the same `ctx`, so the findings keep their order; an arm no grammar claims runs nothing. (An arm's ids are the
 * grammar ids its own body raises; the helpers it calls go with it.) A grammar that claims no arm runs after the type
 * arms, in list order. A claim covering part of an arm, or two arms, or an id another grammar claims, is a caller's
 * defect and throws before any arm runs, as a malformed entry does. C-2.7's slot (`checkInformationExtension`) is
 * kept for capture's grammar, registered in T18, so its findings keep their place (K751). `checkSupersession` and
 * `checkRecheckCoverage` are inquiry's C-6.1 and C-15.1 arms, separated from `checkReferences` and kept in their
 * places; inquiry-grammar's registered grammar fills them (layer 6; K752). `checkProjectExtension` is C-2.9 alone since
 * C-9.1 left with the project stage's computation (K904, N456, T21); a grammar claiming C-9.1 beside it still fills it
 * whole, the extra id claiming no other slot (record-core R67). */
export const EXTENSION_ARMS = Object.freeze([
  { name: 'checkInformationExtension', ids: ['C-2.7'] },
  { name: 'checkInfo2Contract', ids: ['C-18.6', 'C-18.7'] },
  { name: 'checkSupersession', ids: ['C-6.1'] },
  { name: 'checkRecheckCoverage', ids: ['C-15.1'] },
  { name: 'checkInquiryExtension', ids: ['C-2.8'] },
  { name: 'checkProjectExtension', ids: ['C-2.9'] },
].map((a) => Object.freeze({ name: a.name, ids: Object.freeze(a.ids) })));
const GRAMMAR_ID_RE = /^C-\d+(\.\d+)?$/;

/* The registered grammars, judged whole before any arm runs: `byArm` maps a built-in arm's name to the grammar that
   replaces it, `rest` holds the others in list order. */
/** @param {Grammar[] | null | undefined} list @returns {{byArm: Map<string, Grammar>, rest: Grammar[]}} */
function grammarsOf(list) {
  /** @type {[string, Grammar][]} */
  const none = [];
  if (list === undefined || list === null) return { byArm: new Map(none), rest: [] };
  if (!Array.isArray(list)) throw new TypeError('checkBundle: opts.grammars is a list of {module, ids, arm}');
  const byArm = new Map(none);
  /** @type {Grammar[]} */
  const rest = [];
  /** @type {[string, string][]} */
  const noClaims = [];
  const claimed = new Map(noClaims);
  list.forEach((g, i) => {
    const at = `checkBundle: opts.grammars[${i}]`;
    if (!g || typeof g !== 'object') throw new TypeError(`${at} is not a {module, ids, arm} entry`);
    if (typeof g.module !== 'string' || g.module.trim() === '') throw new TypeError(`${at} names no module`);
    if (!Array.isArray(g.ids) || g.ids.length === 0 || !g.ids.every((id) => typeof id === 'string' && GRAMMAR_ID_RE.test(id)))
      throw new TypeError(`${at} (${g.module}): ids is a non-empty list of C-ids`);
    if (typeof g.arm !== 'function') throw new TypeError(`${at} (${g.module}): arm is not a function`);
    for (const id of g.ids) {
      if (claimed.has(id)) throw new RangeError(`${at} (${g.module}): ${id} is already claimed by ${claimed.get(id)}`);
      claimed.set(id, g.module);
    }
    const touched = EXTENSION_ARMS.filter((a) => a.ids.some((id) => g.ids.includes(id)));
    if (touched.length > 1)
      throw new RangeError(`${at} (${g.module}): claims ids of ${touched.map((a) => a.name).join(' and ')}; one grammar replaces one arm`);
    const [arm] = touched;
    if (arm && !arm.ids.every((id) => g.ids.includes(id)))
      throw new RangeError(`${at} (${g.module}): claims part of ${arm.name}, whose ids are ${arm.ids.join(', ')}; an arm is claimed whole`);
    if (arm) byArm.set(arm.name, g); else rest.push(g);
  });
  return { byArm, rest };
}

/**
 * Run all applicable checks over one bundle.
 * @param {BundleInput} input
 * @param {{knownSchemas?: string[] | undefined, grammars?: Grammar[] | null | undefined}} [opts]
 * @returns {Promise<{pass: boolean, findings: Finding[]}>}
 */
export async function checkBundle(input, opts = {}) {
  const grammars = grammarsOf(opts.grammars);
  /** @type {Finding[]} */
  const findings = [];
  const bundleRaw = input.files.get('bundle.md');
  const elidedPaths = input.elidedPaths;
  /** @type {BundleContext} */
  const ctx = {
    folderName: input.folderName,
    files: input.files,
    // 1.13.0 (three-tier read model): paths known to exist in the
    // authoritative store but whose bytes the caller deliberately did not
    // carry (a tier-scoped client mirror eliding snapshots/ and _history/).
    // Presence assertions ("this registered path must exist") consult
    // files UNION elided via hasFile_; byte checks (hashing, parsing,
    // history audits) stay files-only and skip elided content exactly as
    // they skip absent content, so nothing is ever verified against bytes
    // the caller does not hold. Inquiry's `checkInquiryEntry` passes nothing
    // here and is byte-complete as before.
    elided: elidedPaths instanceof Set ? elidedPaths
      : new Set(Array.isArray(elidedPaths) ? elidedPaths : []),
    sha256: input.sha256,
    nowMs: input.nowMs,
    maxPackageAgeDays: input.maxPackageAgeDays ?? 14,
    maxReevalAgeDays: input.maxReevalAgeDays ?? 30,
    /* inquiry@1 joins; focus@1 and problem@1 STAY KNOWN forever — schema
       stamps are document truth in append-only history (REC-10). */
    /* PL-12 / D-84: `bias@1`. A type whose schema stamp the catalog does not
       know is refused by C-2.5 before any type-specific check runs, so the
       stamp has to be admitted in the same turn as the type. */
    /* K171 (1) and K198 (2) (T8): the six types admitted above, each at schema 1, on `bias@1`'s reason; N-A1 (T18)
       `action_plan@1` likewise. */
    /* T47-1 (R62): `success_record@1`, the stamp `consequences` writes on every success record. */
    knownSchemas: opts.knownSchemas ?? ['information@1', 'information@2', 'inquiry@1', 'focus@1', 'problem@1', 'project@1', 'action@1', 'bias@1',
      'standard@1', 'determination@1', 'consequence@1', 'escalation@1', 'aspiration@1', 'goal@1', 'action_plan@1',
      'success_record@1'],
    resolveTarget: input.resolveTarget,
    // D2.3: the key registry, injected exactly like resolveTarget. Absent
    // is legal and means pre-migration behavior; absent WITH a
    // post-migration release is an error, never a skip.
    releaseRegistry: input.releaseRegistry || null,
    /* REC-14: the published projection, injected exactly like releaseRegistry
       and for the same reason — the checker is a pure function over a
       filesystem, and what OTHER cases were published (and at which editions,
       with which frozen pair) is not in this bundle. Shape:
         { <bundleId>: { latest: n, editions: { "1": {edition, completeness,
             capture: {state, grade}, connection: {state, grade}} } } }
       Absent means the caller holds no published record (`runGate` or
       inquiry's `checkInquiryEntry` handed none) and C-21.1/C-21.2 cannot fire.
       Ratification's gate injects it, and record-core's audit through
       publication's registered context (record-core R69), which is what keeps
       the absence from being a way through. */
    publishedRegistry: input.publishedRegistry || null,
    /* REC-44 / DEC-44: the CASE-altitude half of the same fact, injected on the
       same terms and separated for the reason DEC-44 gives — a case is a
       CONTAINER over one or more findings, so what the previous edition of THIS
       CASE asserted about its limits is not a fact about any one finding.
       Shape:
         { <caseId>: { latest: n, editions: { "1": {edition, scope,
             completeness, ratified_at} } } }
       Absent means the caller holds no published case record (`runGate`
       handed none, record-core's audit, inquiry's `checkInquiryEntry`) and
       C-21.1 cannot fire; ratification's gate injects it. Kept SEPARATE from
       publishedRegistry deliberately: one registry serving both altitudes is
       how the collapse this item corrects happened in the first place. */
    publishedCaseRegistry: input.publishedCaseRegistry || null,
    /* REC-18: the second fact the catalog cannot get from the bundle, and it is
       injected on exactly the same terms and for the same reason. What
       `resolutions` holds about this bundle's basis targets, and what `register`
       holds about their captures, is the record — not this document — so a
       checker over a filesystem has no way to compute an earned grade and says
       so rather than passing the leg (checkEarnedLeg). Shape:
         { subject_entity, subject_label, earned: {
             connection: { <target>: {grade, why, ...} },
             capture:    { <target>: {grade, why, ceiling?} } } }
       Absent means the caller cannot see the record (`runGate` or inquiry's
       `checkInquiryEntry` handed none). Ratification's gate injects it, and
       record-core's audit through inquiry's registered context (record-core R69). */
    earnedRegistry: input.earnedRegistry || null,
    sha512: input.sha512 || null,
    fm: null,
    body: ''
  };

  if (!bundleRaw) {
    findings.push(f('C-13.1', 'error', 'bundle.md is missing'));
  } else {
    const parsed = parseFrontmatter(asText(bundleRaw));
    findings.push(...parsed.findings);
    ctx.fm = parsed.data;
    ctx.body = parsed.body;
    checkIdentity(ctx, findings);
    checkFrontmatterContract(ctx, findings);
    checkHeadings(ctx, findings);
    checkStateLegality(ctx, findings);
    checkWriteCompleteness(ctx, findings);
    /* §1b: each type arm is a place in the order that a registered grammar fills; an arm no grammar claims runs
       nothing here, its built-in body being the module's that owns it (T19, rule 2). */
    /** @param {string} name */
    const typeArm = async (name) => {
      const g = grammars.byArm.get(name);
      if (g) await g.arm(ctx, findings);
    };
    await typeArm('checkInformationExtension');
    await typeArm('checkInfo2Contract');
    /* N325 (T14): `checkInboxGrammar(ctx, findings)` stood here. The inbox task grammar is queue's, a promotion check
       and an audit check it registers, so the bundle check does not run it; the export went in T15. */
    checkReferences(ctx, findings);
    await typeArm('checkSupersession');
    await typeArm('checkRecheckCoverage');
    await typeArm('checkInquiryExtension');
    /* CASE-5b: `checkCompletenessFreshness(ctx, findings)` STOOD HERE and is
       removed — C-21.1 at case altitude now runs over the CASE DOCUMENT, in ratification's
       `checkCaseDocument`, which is the only place its four fields exist. The
       call is deleted rather than left returning early: a check that can never
       fire is a rule nobody is enforcing wearing the costume of one. */
    await typeArm('checkProjectExtension');
    for (const g of grammars.rest) await g.arm(ctx, findings);
    /* checkCitationRegister ran here until FW-13 retired it (2026-08-08), and
       checkDeletionRecords beside it until FW-15 retired that too the same day.
       The catalogue's CHECK_RETIREMENTS said what each gated and why keeping it
       was wrong. The line below is not a replacement for the second: `checkAppendOnly`
       was ALREADY the enforcement, which is exactly why the ledger was a second
       account of one fact. */
    checkAppendOnly(ctx, findings);
    checkHistoryCoherence(ctx, findings);
  }
  checkFormatHygiene(ctx, findings);
  await checkQueueAndBase(ctx, findings);

  const pass = !findings.some(x => x.severity === 'error');
  return { pass, findings };
}
