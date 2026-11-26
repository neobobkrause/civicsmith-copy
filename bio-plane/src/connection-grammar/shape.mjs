// @ts-check
/* connection-grammar: the one shape every relationship the record holds is presented in (R1), and the derived id a
   leg cites and a checker re-derives (R11). Pure: nothing here reads a store, the network or a clock (R16). */
import { BASIS_GRADES, idPattern, canonicalJson, sha256HexSync } from '../record-grammar/index.mjs';
import { word, localize } from '../setup-words/index.mjs';
import { isObj, isList, filled, text } from './raw.mjs';
/** @import { RawFields } from './raw.mjs' */

/**
 * A kind's registered entry: its owner, the members' word for it and its class (R2, R4).
 * @typedef {Object} KindEntry
 * @property {string} owner
 * @property {string} word
 * @property {string} class
 */
/**
 * A kind as an owner registers it and as `owners` lists it (R2, R4).
 * @typedef {Object} KindSpec
 * @property {string} kind
 * @property {string} word
 * @property {string} class
 */
/**
 * A registered owner and its kinds, as `owners` lists it (R4).
 * @typedef {Object} OwnerListing
 * @property {string} owner
 * @property {KindSpec[]} kinds
 */
/**
 * A connection's grade: its assertion's letter and its two ends' (R1, R12).
 * @typedef {Object} Grade
 * @property {string} assertion
 * @property {string[]} ends
 */
/**
 * How a derived connection was made: the method, its inputs as the owner gives them, and when (R1, R11).
 * @typedef {Object} Derivation
 * @property {string} method
 * @property {unknown[]} inputs
 * @property {string} as_of
 */
/**
 * An item undetermined at the date asked, with `civil-time`'s reason exactly as it answers it (R6).
 * @typedef {Object} Undetermined
 * @property {{key: string, vars: object}} why
 */
/**
 * One connection in the one shape (R1). `valid` is `civil-time`'s validity value.
 * @typedef {Object} Connection
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} kind
 * @property {string} owner
 * @property {unknown} valid
 * @property {{source: string}[]} evidence
 * @property {Grade | null} grade
 * @property {Derivation | null} derived
 * @property {string | null} [label]
 * @property {string} [scope]
 * @property {Undetermined} [undetermined]
 */
/**
 * A hub: a node whose set of one kind exceeds that kind's bound, named by its set size (R6, R10).
 * @typedef {Object} Hub
 * @property {number} set_size
 * @property {string} why
 */
/**
 * What an owner holds for a node as a table and did not read (R20).
 * @typedef {Object} Unread
 * @property {string} what
 * @property {string} why
 */
/**
 * An owner's answer to one `neighbours` read that keeps the contract (R6, R7, R8, R20). `next` is the owner's own
 * token for the next page, handed back to it unchanged.
 * @typedef {Object} NeighboursAnswer
 * @property {Connection[]} items
 * @property {unknown} [next]
 * @property {boolean} [truncated]
 * @property {Hub} [hub]
 * @property {Unread[]} [unread]
 */
/**
 * One read of a registered owner (R19): the owner, the node, the kinds asked, the date, the page, the member reading
 * and the working inquiry, the last five passed to the owner unchanged. A missing viewer is refused (R7).
 * @typedef {Object} NeighboursCall
 * @property {string} owner
 * @property {string} node
 * @property {string[]} [kinds]
 * @property {unknown} at
 * @property {unknown} [page]
 * @property {unknown} [viewer]
 * @property {unknown} scope
 */
/**
 * A registry of owners: its five services (R2-R5, R19), none of which can be replaced.
 * @typedef {{
 *   readonly registerOwner: (arg: unknown) => ({ok: boolean, owner: string} | Refusal),
 *   readonly owners: () => OwnerListing[],
 *   readonly kindOf: (kind: unknown) => (KindEntry | null),
 *   readonly checkConnection: (c: unknown) => ({errors: FieldError[], ok: boolean} | {errors?: undefined, ok: boolean}),
 *   readonly neighbours: (arg: NeighboursCall) => (Refusal | PassedRefusal | (Refusal & {failures: ReadFailure[]}) | NeighboursAnswer)
 * }} Registry
 */
/**
 * One error of a connection against the shape, naming its field (R1, R18).
 * @typedef {Object} FieldError
 * @property {string} field
 * @property {string} why
 */
/**
 * One failure of an owner's answer or of the battery: the check that failed, and why (R9, R19).
 * @typedef {Object} ReadFailure
 * @property {string} check
 * @property {string} why
 */
/**
 * An owner's own refusal, which a registry's read hands back unchanged (R19): its `why` is as the owner gave it.
 * @typedef {Object} PassedRefusal
 * @property {string} refused
 * @property {unknown} [why]
 */
/**
 * A refusal: which kind of no, and why (R18).
 * @typedef {Object} Refusal
 * @property {string} refused
 * @property {string} why
 */
/** The four classes of kind, closed (R2). None is a measure of how connected a node is (R17). */
export const CLASSES = Object.freeze(['evidentiary', 'derived', 'declared', 'hunch']);
/** The label a declared connection carries (R1). @type {string} */
export const DECLARED_LABEL = localize('connection-grammar.shape.label_declared', 'declared, not evidenced');
/** The label a hunch connection carries (R1). */
export const HUNCH_LABEL = 'hunch';
/** The lowest grade, which a declared assertion carries and a declared hop gives a chain (R1, R12). */
export const LOWEST_GRADE = BASIS_GRADES[BASIS_GRADES.length - 1];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRECISIONS = ['day', 'minute', 'second', 'edtf'];
/** @type {Map<string, RegExp>} */
const FORMS = new Map([
  ['day', /^\d{4}-\d{2}-\d{2}$/],
  ['minute', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/],
  ['second', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/],
  ['edtf', /^\S+$/],
]);
const FIELDS = ['id', 'from', 'to', 'kind', 'owner', 'valid', 'evidence', 'grade', 'derived'];

/**
 * Whether `v` is one of the letters of `record-grammar`'s `BASIS_GRADES`.
 * @param {unknown} v
 * @returns {boolean}
 */
const isGrade = (v) => typeof v === 'string' && BASIS_GRADES.includes(v);
/**
 * Whether `v` is a pair of grade letters, `[from_grade, to_grade]`.
 * @param {unknown} v
 * @returns {boolean}
 */
const gradePair = (v) => {
  if (!isList(v)) return false;
  return v.length === 2 && v.every(isGrade);
};
/**
 * A named field of a value read as it comes: `from` or `to` of a connection, a validity, or a hop.
 * @param {RawFields} o
 * @param {'from' | 'to'} end
 * @returns {unknown}
 */
const endOf = (o, end) => (end === 'from' ? o.from : o.to);
/** @type {('from' | 'to')[]} */
const ENDS = ['from', 'to'];

/**
 * Whether `v` is a record id of record-grammar's id grammar (R21), as `checkConnection` reads `from` and `to` (R1): an
 * id core of its prefix in that prefix's `ID_TABLE` form, a legacy form included (`idPattern`, record-grammar R47),
 * alone or followed by `-` and a slug of `-`-joined runs of `[a-z0-9]`. Anything else, a non-string included, is false.
 * Never throws.
 * @param {unknown} v
 * @returns {boolean}
 */
export function isRecordId(v) {
  if (typeof v !== 'string') return false;
  const re = patternOf(v.split('-')[0]);
  if (!re) return false;
  if (re.test(v)) return true;
  for (let i = v.indexOf('-'); i !== -1; i = v.indexOf('-', i + 1)) {
    if (re.test(v.slice(0, i)) && SLUG.test(v.slice(i + 1))) return true;
  }
  return false;
}

/**
 * The id grammar's pattern for an id core's prefix (`record-grammar`'s `idPattern`), or null where it has none or
 * refuses the prefix.
 * @param {string | undefined} prefix
 * @returns {RegExp | null}
 */
function patternOf(prefix) {
  try { return idPattern(prefix); } catch { return null; }
}

/**
 * Why one end of a validity is not well formed at its precision, or null when it is.
 * @param {unknown} b
 * @param {string} precision
 * @returns {string | null}
 */
function boundError(b, precision) {
  if (b === null) return null;
  if (typeof b === 'string') return FORMS.get(precision)?.test(b) ? null : `is not a value of ${precision} precision`;
  if (isObj(b)) {
    if ('value' in b) return 'gives both a value and an event';
    if (!filled(b.event) || !filled(b.edge)) return 'names an event bound without its event and edge';
    return null;
  }
  return 'is neither null, a value nor an event bound';
}

/**
 * The errors of one validity, each a sentence that names its field.
 * @param {unknown} valid
 * @returns {string[]}
 */
function validErrors(valid) {
  if (!isObj(valid)) return ['valid is not a validity {from, to, precision, zone}'];
  /** @type {string[]} */
  const out = [];
  const given = valid.precision;
  const precision = typeof given === 'string' && PRECISIONS.includes(given) ? given : null;
  if (precision === null) out.push(`valid.precision is not one of ${PRECISIONS.join(', ')}`);
  if (!filled(valid.zone)) out.push('valid.zone is not a zone name');
  for (const end of ENDS) {
    if (!(end in valid)) { out.push(`valid.${end} is absent (null means "not stated")`); continue; }
    if (precision === null) continue;
    const e = boundError(endOf(valid, end), precision);
    if (e) out.push(`valid.${end} ${e}`);
  }
  return out;
}

/**
 * The id of a derived connection: the SHA-256 of the canonical JSON of its five fields (R11, K1447).
 * Throws a TypeError naming the field when one is not a non-empty string.
 * @param {{kind: string, from: string, to: string, as_of: string, method: string}} f
 * @returns {string}
 */
export function derivedId(f) {
  /** @type {unknown} */
  const given = f;
  if (!isObj(given)) throw new TypeError('derivedId takes {kind, from, to, as_of, method}');
  const kind = text(given.kind), from = text(given.from), to = text(given.to), asOf = text(given.as_of), method = text(given.method);
  if (kind === null) throw new TypeError('derivedId: kind is not a non-empty string');
  if (from === null) throw new TypeError('derivedId: from is not a non-empty string');
  if (to === null) throw new TypeError('derivedId: to is not a non-empty string');
  if (asOf === null) throw new TypeError('derivedId: as_of is not a non-empty string');
  if (method === null) throw new TypeError('derivedId: method is not a non-empty string');
  return sha256HexSync(canonicalJson({ kind, from, to, as_of: asOf, method }));
}

/**
 * The errors of one connection against the shape (R1), each naming its field; `kindOf` is the registry's reader.
 * @param {unknown} c
 * @param {(kind: string) => (KindEntry | null)} kindOf
 * @returns {FieldError[]}
 */
export function connectionErrors(c, kindOf) {
  if (!isObj(c)) return [{ field: 'connection', why: word('connection-grammar.why.connection_object') }];
  /** @type {FieldError[]} */
  const errors = [];
  /** @param {string} field @param {string} why */
  const err = (field, why) => { errors.push({ field, why }); };
  for (const f of FIELDS) if (!(f in c)) err(f, `${f} is absent; every field of the shape is present`);
  if ('id' in c && !filled(c.id)) err('id', 'id is not a non-empty string');
  for (const end of ENDS) if (end in c && !isRecordId(endOf(c, end))) err(end, `${end} is not a record id of the id grammar`);
  const owner = text(c.owner);
  if ('owner' in c && owner === null) err('owner', 'owner is not a non-empty string');
  if ('valid' in c) for (const why of validErrors(c.valid)) err('valid', why);
  const kind = text(c.kind);
  const entry = kind !== null ? kindOf(kind) : null;
  if ('kind' in c) {
    if (kind === null) err('kind', 'kind is not a non-empty string');
    else if (!entry) err('kind', `kind ${kind.slice(0, 60)} is registered to no owner`);
    else if (owner !== null && entry.owner !== owner) err('kind', `kind ${kind} is registered to ${entry.owner}, not ${owner}`);
  }
  const cls = entry?.class;
  if ('evidence' in c) {
    const entries = c.evidence;
    if (!isList(entries)) err('evidence', 'evidence is not a list');
    else {
      if (entries.some((e) => !isObj(e) || !filled(e.source))) err('evidence', 'an evidence entry does not name its cited source');
      if (cls === 'evidentiary' && entries.length === 0) err('evidence', 'an evidentiary connection names at least one cited source');
    }
  }
  if ('grade' in c) {
    const grade = c.grade;
    if (cls === 'hunch') {
      if (grade !== null) err('grade', 'a hunch carries no grade');
    } else if (!isObj(grade) || !isGrade(grade.assertion) || !gradePair(grade.ends)) {
      err('grade', localize('connection-grammar.shape.grade_shape', 'grade is not {shape} in the letters {letters}', { shape: '{assertion, ends: [from_grade, to_grade]}', letters: BASIS_GRADES.join(' ') }));
    } else if (cls === 'declared' && grade.assertion !== LOWEST_GRADE) {
      err('grade', `a declared connection's assertion carries the lowest grade, ${LOWEST_GRADE}`);
    }
  }
  const label = c.label;
  if (cls === 'declared' && label !== DECLARED_LABEL) err('label', `a declared connection carries the label "${DECLARED_LABEL}"`);
  if (cls === 'hunch') {
    if (label !== HUNCH_LABEL) err('label', `a hunch connection carries the label "${HUNCH_LABEL}"`);
    if (!filled(c.scope)) err('scope', 'a hunch connection names the working inquiry that holds it');
  }
  if (cls && cls !== 'declared' && cls !== 'hunch' && label !== undefined && label !== null) {
    err('label', `an ${cls} connection carries neither the declared nor the hunch label`);
  }
  if ('derived' in c) {
    const d = c.derived;
    if (cls === 'derived') {
      const method = isObj(d) ? text(d.method) : null;
      const asOf = isObj(d) ? text(d.as_of) : null;
      if (!isObj(d) || method === null || !isList(d.inputs) || asOf === null) {
        err('derived', 'a derived connection carries derived: {method, inputs, as_of}');
      } else {
        const from = endOf(c, 'from'), to = endOf(c, 'to');
        if (kind !== null && typeof from === 'string' && isRecordId(from) && typeof to === 'string' && isRecordId(to)
          && c.id !== derivedId({ kind, from, to, as_of: asOf, method })) {
          err('id', 'a derived connection\'s id is derivedId of its kind, from, to, as_of and method');
        }
      }
    } else if (d !== null) {
      err('derived', 'only a derived connection carries derived; others carry null');
    }
  }
  return errors;
}
