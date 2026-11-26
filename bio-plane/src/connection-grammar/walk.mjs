// @ts-check
/* connection-grammar: what a path means, as pure reads over a list of connections from start to end (R12–R14).
   The weakest hop governs; nothing averages, scores or ranks how connected anything is (K1442, K1471; R17). No walker
   lives here: `explore` walks and builds on these (R16). */
import { compare } from '../civil-time/index.mjs';
import { BASIS_GRADES } from '../record-grammar/index.mjs';
import { DECLARED_LABEL, HUNCH_LABEL, LOWEST_GRADE } from './shape.mjs';
import { word } from '../setup-words/index.mjs';
import { isObj, isList, isTable } from './raw.mjs';
/** @import { RawFields } from './raw.mjs' */
/** @import { Refusal } from './shape.mjs' */

/**
 * The place of a grade letter in `BASIS_GRADES`, strongest first; -1 for anything else.
 * @param {unknown} g
 * @returns {number}
 */
const rank = (g) => (typeof g === 'string' ? BASIS_GRADES.indexOf(g) : -1);
/**
 * The weaker of two grade letters.
 * @param {string | undefined} a
 * @param {string | undefined} b
 * @returns {string | undefined}
 */
const weaker = (a, b) => (rank(a) >= rank(b) ? a : b);
/**
 * A grade letter as a hop gives it, or undefined where it gives none.
 * @param {unknown} x
 * @returns {string | undefined}
 */
const gradeOf = (x) => (typeof x === 'string' ? x : undefined);
/**
 * The hops of a path given as a list of connections or as `{hops, quantities}`; null for anything else.
 * @param {unknown} p
 * @returns {unknown[] | null}
 */
const hopsOf = (p) => {
  if (isList(p)) return p;
  const hops = isObj(p) ? p.hops : undefined;
  return isList(hops) ? hops : null;
};
/**
 * The hops of a path when it is a non-empty list of objects; null otherwise.
 * @param {unknown} hops
 * @returns {RawFields[] | null}
 */
const pathOf = (hops) => {
  if (!isList(hops) || hops.length === 0) return null;
  /** @type {RawFields[]} */
  const out = [];
  for (const h of hops) { if (!isObj(h)) return null; out.push(h); }
  return out;
};

/**
 * The grade of a chain: the weakest assertion grade and the weakest end grade over its hops (R12).
 * @param {unknown} path
 * @returns {{assertion: null, end: null, refused?: undefined, why: string}
 *   | {assertion: string | undefined, end: string | undefined, refused?: undefined, why?: undefined}
 *   | {assertion?: undefined, end?: undefined, refused: string, why: string}}
 */
export function chainGrade(path) {
  const hops = pathOf(path);
  if (!hops) return { refused: 'PATH_EMPTY', why: word('connection-grammar.why.path_non_empty') };
  let assertion = BASIS_GRADES[0], end = BASIS_GRADES[0];
  for (const hop of hops) {
    if (hop.label === HUNCH_LABEL) {
      return { assertion: null, end: null, why: word('connection-grammar.why.hop_hunch_carries', { id: String(hop.id) }) };
    }
    if (hop.label === DECLARED_LABEL) { assertion = end = LOWEST_GRADE; continue; }
    const g = hop.grade;
    const pair = isObj(g) ? g.ends : undefined;
    const ends = isList(pair) && pair.length === 2 && !pair.some((x) => rank(x) < 0) ? pair : null;
    if (!isObj(g) || rank(g.assertion) < 0 || ends === null) {
      return { refused: 'GRADE_INVALID', why: word('connection-grammar.why.hop_carries_grade', { id: String(hop.id), basis_grades: String(BASIS_GRADES.join(' ')) }) };
    }
    assertion = weaker(assertion, gradeOf(g.assertion));
    end = weaker(end, weaker(gradeOf(ends[0]), gradeOf(ends[1])));
  }
  return { assertion, end };
}

/**
 * `lead` when any hop is declared or a hunch, naming those hops; otherwise `evidenced` (R13). A lead is never a basis
 * for a finding (K1467, K1487).
 * @param {unknown} path
 * @returns {{basis_for_finding: boolean, hops: unknown[], label: string, refused?: undefined, why?: undefined}
 *   | {basis_for_finding?: undefined, hops?: undefined, label: string, refused?: undefined, why?: undefined}
 *   | {basis_for_finding?: undefined, hops?: undefined, label?: undefined, refused: string, why: string}}
 */
export function chainLabel(path) {
  const all = pathOf(path);
  if (!all) return { refused: 'PATH_EMPTY', why: word('connection-grammar.why.path_non_empty') };
  const hops = all.filter((h) => h.label === DECLARED_LABEL || h.label === HUNCH_LABEL).map((h) => h.id);
  return hops.length ? { label: 'lead', hops, basis_for_finding: false } : { label: 'evidenced' };
}

/**
 * The start a hop states, as `civil-time` compares it (a value with its precision and zone, or the bound as the hop
 * states it), or null when it states none.
 * @param {RawFields} hop
 * @returns {unknown}
 */
function fromOf(hop) {
  const v = hop.valid;
  if (!isObj(v)) return null;
  const stated = v.from;
  const at = isObj(stated) ? stated.at : undefined;
  const b = isObj(stated) ? (at === undefined ? null : at) : stated;
  if (b === null || b === undefined) return null;
  return typeof b === 'string' ? { value: b, precision: v.precision, zone: v.zone } : b;
}

/**
 * Whether two starts are the same value, precision and zone.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
const same = (a, b) => {
  const x = isObj(a) ? a : {}, y = isObj(b) ? b : {};
  return x.value === y.value && x.precision === y.precision && x.zone === y.zone;
};

/**
 * The earliest `valid.from` over a path, or null when its hops do not settle one (R14).
 * @param {RawFields[]} hops
 * @returns {unknown}
 */
function earliestFrom(hops) {
  const froms = hops.map(fromOf);
  if (froms.includes(null)) return null;
  return froms.find((f) => froms.every((o) => o === f || same(f, o) || compare(f, o) === 'before')) ?? null;
}

/**
 * The hops' ids joined, the last order of paths (R14).
 * @param {RawFields[]} hops
 * @returns {string}
 */
const idKey = (hops) => hops.map((h) => String(h.id)).join('\u0000');
/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Orders paths by hop count, then the earliest `valid.from` (undetermined last), then the hops' ids; with `by`, by
 * that stated quantity first, descending. No other order or score is offered (R14, K1471). A `by` that is not a
 * non-empty string is refused.
 * @param {unknown} paths
 * @param {{by?: unknown}} [opts]
 * @returns {Refusal | unknown[]}
 */
export function orderPaths(paths, opts = {}) {
  if (!isList(paths)) return { refused: 'PATHS_INVALID', why: 'paths is a list, each a non-empty list of connections or {hops, quantities}' };
  /** @type {{p: unknown, hops: RawFields[]}[]} */
  const given = [];
  for (const p of paths) {
    const hops = pathOf(hopsOf(p));
    if (!hops) return { refused: 'PATHS_INVALID', why: 'paths is a list, each a non-empty list of connections or {hops, quantities}' };
    given.push({ p, hops });
  }
  /** @type {unknown} */
  const o = opts;
  const by = isObj(o) ? o.by : undefined;
  if (by !== undefined && (typeof by !== 'string' || by === '')) return { refused: 'BY_INVALID', why: word('connection-grammar.why.names_quantity_carried') };
  const rows = given.map(({ p, hops }) => {
    const quantities = isObj(p) ? p.quantities : undefined;
    const q = isTable(quantities) && typeof by === 'string' ? quantities[by] : undefined;
    return { p, hops, ids: idKey(hops), q: typeof q === 'number' && Number.isFinite(q) ? q : null, start: earliestFrom(hops) };
  });
  rows.sort((a, b) => cmpStr(a.ids, b.ids));
  rows.sort((a, b) => {
    if (by !== undefined) {
      const qa = a.q, qb = b.q;
      if (qa !== null && qb !== null && qa !== qb) return qb - qa;
      if ((qa === null) !== (qb === null)) return qa === null ? 1 : -1;
    }
    if (a.hops.length !== b.hops.length) return a.hops.length - b.hops.length;
    const sa = a.start, sb = b.start;
    if ((sa === null) !== (sb === null)) return sa === null ? 1 : -1;
    if (sa && sb && !same(sa, sb)) {
      const c = compare(sa, sb);
      if (c === 'before') return -1;
      if (c === 'after') return 1;
    }
    return cmpStr(a.ids, b.ids);
  });
  return rows.map((r) => r.p);
}

