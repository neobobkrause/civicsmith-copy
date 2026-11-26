// @ts-check
/* record-grammar: the restricted front-matter parser (R6–R11), with the core fields and forbidden aliases it
   recovers buried keys by (R10). Moved from the check catalogue at T18 with its comments. */

/**
 * @typedef {{check: string, severity: 'error'|'warn'|'info', message: string, repairable?: boolean, repairs?: string[], code?: string}} Finding
 */
/* `code` is the bundle check's (bundle.mjs); no finding of the parser's names one (R11). */
/** A scalar the grammar reads (R8): a string, a number, a boolean, null, or an inline `[a, b]` list of them.
 * @typedef {string | number | boolean | null | ScalarList} Scalar */
/** An inline `[a, b]` list (R8), or an array block's items (R7). @typedef {Array<Scalar | ScalarMap>} ScalarList */
/** A one-level map block's value, or an object element of an array block (R7).
 * @typedef {{[key: string]: Scalar}} ScalarMap */
/** A top-level key's value (R7): a scalar, a map block, or an array block of scalars and objects.
 * @typedef {string | number | boolean | null | Array<Scalar | ScalarMap> | ScalarMap} FieldValue */
/** The front matter's data, top-level key by key.
 * @typedef {{[key: string]: FieldValue}} Frontmatter */

/** Universal core fields (spec 3.1). */
import { localize } from '../setup-words/index.mjs';

export const CORE_FIELDS = [
  'id', 'object_type', 'schema', 'title', 'current_state', 'prior_state',
  'created', 'last_updated', 'produced_by', 'group', 'references',
  'state_history', 'annotations_open', 'reeval_pending', 'visuals'
];

/** Forbidden alias -> canonical (spec 3.3). */
export const FORBIDDEN_ALIASES = {
  status: 'current_state', state: 'current_state', pipeline_state: 'current_state',
  verdict: 'current_state', type: 'object_type', updated: 'last_updated', modified: 'last_updated'
};

/** A finding (R11): `repairable` and `repairs` only when a repair is named. The catalogue's own `f` also carries
 *  REC-56's optional `code`; no finding here has one.
 * @param {string} check
 * @param {'error'|'warn'|'info'} severity
 * @param {string} message
 * @param {string[]} [repairs]
 * @returns {Finding} */
function f(check, severity, message, repairs) {
  /** @type {Finding} */
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  return out;
}

/** @param {object} o @param {string} k @returns {boolean} */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** A key is written as an OWN data property, so `__proto__` in a document is a key like any other and never reaches
   the object's prototype.
 * @template V
 * @param {{[key: string]: V}} o
 * @param {string} k
 * @param {V} v */
function put(o, k, v) {
  Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true });
}

/* The open block's value, written into as the language writes into whatever the key holds now: a key recovered from
   stray indentation (R10) can replace a block's value with a scalar while the block stays open, and the language's own
   TypeError is then what the write meets, as before. */
/** @param {FieldValue} target @param {string} k @param {Scalar} v */
function putIn(target, k, v) {
  if (target === null || typeof target !== 'object') throw new TypeError('Object.defineProperty called on non-object');
  Object.defineProperty(target, k, { value: v, writable: true, enumerable: true, configurable: true });
}
/** @param {FieldValue} target @param {Scalar | ScalarMap} v */
function pushTo(target, v) {
  if (Array.isArray(target)) { target.push(v); return; }
  if (target === null) throw new TypeError("Cannot read properties of null (reading 'push')");
  throw new TypeError('data[topKey].push is not a function');
}

// ---------------------------------------------------------------------------
// Restricted-grammar frontmatter parser (spec 2.2, 3.3)
// Grammar: '---' fences; top-level keys at column 0; one-level maps at 2 spaces;
// arrays of scalars or of objects ('- ' at 2 spaces, object props at 4 spaces);
// inline [] arrays; optional '# ' comments after values; double or single quotes.
// ---------------------------------------------------------------------------

/** @param {string} raw @returns {string} */
function stripComment(raw) {
  let inS = false, inD = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || raw[i - 1] === ' ')) return raw.slice(0, i);
  }
  return raw;
}

/** @param {string} raw @returns {string | number | boolean | null | ScalarList} */
function parseScalar(raw) {
  let v = stripComment(raw).trim();
  if (v === '') return '';
  if (v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  /* Wrapped means two quote characters: a lone `"` or `'` is the string it is (R8). */
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    /** @type {ScalarList} */
    const items = [];
    if (inner === '') return items;
    for (const s of inner.split(',')) items.push(parseScalar(s));
    return items;
  }
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

/**
 * Parse bundle.md frontmatter under the restricted grammar.
 * @param {string} text full bundle.md content
 * @returns {{data: Frontmatter|null, findings: Finding[], body: string}}
 */
export function parseFrontmatter(text) {
  if (typeof text !== 'string') throw new TypeError('parseFrontmatter: text must be a string');
  /** @type {Finding[]} */
  const findings = [];
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.bundle_md_does_not_begin_with', 'bundle.md does not begin with a --- frontmatter fence')));
    return { data: null, findings, body: text };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { end = i; break; }
  if (end === -1) {
    findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.frontmatter_fence_is_never_closed', 'frontmatter fence is never closed')));
    return { data: null, findings, body: text };
  }

  /** @type {Frontmatter} */
  const data = {};
  /** @type {string | null} */
  let topKey = null;          // current open block key ('key:' with no value)
  /** @type {'map' | 'array' | null} */
  let topMode = null;         // 'map' | 'array' | null (undecided)
  /** @type {ScalarMap | null} */
  let curElem = null;         // current array element object

  const keyLine = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/;
  const indKeyLine = /^( +)([A-Za-z_][A-Za-z0-9_]*):(.*)$/;
  const itemLine = /^( +)- (.*)$/;

  for (let n = 1; n < end; n++) {
    const line = lines[n] ?? '';
    const stripped = stripComment(line);
    if (stripped.trim() === '') continue;

    const top = keyLine.exec(line);
    const item = top ? null : itemLine.exec(line);
    const ind = top || item ? null : indKeyLine.exec(line);
    if (top) {                                          // column-0 key
      const m = top;
      const key = m[1] ?? '';
      const rest = m[2] ?? '';
      topKey = null; topMode = null; curElem = null;
      if (own(data, key)) {
        findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.duplicate_top_level_key_key', 'duplicate top-level key \'{key}\' at line {v1}', { key: String(key), v1: String(n + 1) })));
      }
      if (stripComment(rest).trim() === '') {           // block start
        topKey = key; put(data, key, []);               // decided by first child; a block with none is [] (R7)
      } else {
        put(data, key, parseScalar(rest));
      }
    } else if (item) {                                  // '- ' array item
      const m = item;
      const indent = (m[1] ?? '').length;
      const rest = m[2] ?? '';
      const open = topKey;
      if (!open) {
        findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.array_item_outside_any_block', 'array item outside any block at line {v1}', { v1: String(n + 1) })));
        continue;
      }
      if (indent !== 2) findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.array_item_indented_indent_expected', 'array item indented {indent} (expected 2) at line {v1}', { indent: String(indent), v1: String(n + 1) })));
      const mode = topMode ?? 'array';
      if (topMode === null) { topMode = 'array'; put(data, open, []); }
      if (mode !== 'array') { findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.array_item_inside_a_map', 'array item inside a map block \'{topKey}\' at line {v1}', { topKey: String(open), v1: String(n + 1) }))); continue; }
      const km = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/.exec(rest);
      if (km && stripComment(km[2] ?? '').trim() !== '') {    // object element: '- key: value'
        /** @type {ScalarMap} */
        const elem = {};
        curElem = elem; put(elem, km[1] ?? '', parseScalar(km[2] ?? ''));
        pushTo(data[open] ?? null, elem);
      } else {                                          // scalar element
        curElem = null;
        pushTo(data[open] ?? null, parseScalar(rest));
      }
    } else if (ind) {                                   // indented key
      const m = ind;
      const indent = (m[1] ?? '').length;
      const key = m[2] ?? '';
      const rest = m[3] ?? '';
      const isCore = CORE_FIELDS.includes(key) || own(FORBIDDEN_ALIASES, key);
      const open = topKey, mode = topMode, elem = curElem;
      if (open && mode === null && indent === 2) { // first child decides: map
        topMode = 'map'; put(data, open, {});
        putIn(data[open] ?? null, key, parseScalar(rest));
      } else if (open && mode === 'map' && indent === 2) {
        putIn(data[open] ?? null, key, parseScalar(rest));
      } else if (open && mode === 'array' && elem && indent === 4) {
        put(elem, key, parseScalar(rest));
      } else {
        // A key indented where the grammar has no slot for it: the Alpha buried-key failure mode.
        if (isCore) {
          findings.push(f('C-2.4', 'error',
            localize('record-grammar.frontmatter.top_level_key_key_is', 'top-level key \'{key}\' is buried by stray indentation at line {v1} and will not register', { key: String(key), v1: String(n + 1) }),
            [localize('record-grammar.frontmatter.re_indent_key_to_column', 're-indent \'{key}\' to column 0', { key: String(key) })]));
          put(data, key, parseScalar(rest));            // recover for downstream checks
        } else {
          findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.key_key_indented_indent_does', 'key \'{key}\' indented {indent} does not fit the restricted grammar at line {v1}', { key: String(key), indent: String(indent), v1: String(n + 1) })));
        }
      }
    } else {
      findings.push(f('C-2.1', 'error', localize('record-grammar.frontmatter.line_v1_does_not_fit', 'line {v1} does not fit the restricted grammar: {line}', { v1: String(n + 1), line: String(line.slice(0, 60)) })));
    }
  }

  // undecided empty blocks are empty arrays: each block starts as one (above)

  return { data, findings, body: lines.slice(end + 1).join('\n') };
}
