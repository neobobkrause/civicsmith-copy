// @ts-check
/* connection-grammar: what an owner's `neighbours` answer must be, checked at the interface (R6, R8, R20). A registry's
   `neighbours` and the conformance battery (R9) judge every answer by the same rules. Sight (R7) depends on the
   owner's own visibility, so only the battery, over the owner's fixture, can check it. */
import { validAt, reasonText } from '../civil-time/index.mjs';
import { BOUNDS, hubBoundOf } from './bounds.mjs';
import { connectionErrors } from './shape.mjs';
import { word, localize, hasWord } from '../setup-words/index.mjs';
import { isObj, isList, isTable, filled, text } from './raw.mjs';
/** @import { WordVars, Reason } from '../setup-words/index.mjs' */
/** @import { RawFields } from './raw.mjs' */
/** @import { KindEntry, ReadFailure, PassedRefusal, NeighboursAnswer } from './shape.mjs' */

/**
 * An owner's registered read: called with one argument, the read's fields; what it answers is judged here (R6).
 * @typedef {(args: RawFields) => unknown} NeighboursRead
 */
/**
 * What an answer is judged against: the owner, its kinds, the kinds asked, the node, the date, the working inquiry,
 * and the registry's reader of kinds.
 * @typedef {Object} ReadContext
 * @property {string} owner
 * @property {string[]} ownKinds
 * @property {unknown} [kinds]
 * @property {unknown} node
 * @property {unknown} at
 * @property {unknown} scope
 * @property {(k: string) => (KindEntry | null)} kindOf
 */

/**
 * Whether `v` is a thenable: an object or function with a `then` method.
 * @param {unknown} v
 * @returns {boolean}
 */
const isThenable = (v) => v !== null && (typeof v === 'object' || typeof v === 'function') && 'then' in v && typeof v.then === 'function';
const ID = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;

/**
 * R6 (civil-time R30): an undetermined `why` is a `{key, vars}`, its key a word the list fills with those vars, or
 * a localize id (any dotted id, not held by the list), with vars an object. Never throws.
 * @param {unknown} why
 * @returns {boolean}
 */
function reasonFills(why) {
  const key = isObj(why) ? text(why.key) : null;
  const vars = isObj(why) ? why.vars : undefined;
  if (key === null || !ID.test(key) || !isObj(vars)) return false;
  if (!hasWord(key)) return true;
  try { word(key, wordVarsOf(vars)); return true; } catch { return false; }
}

/**
 * A reason's vars as `setup-words`' `word` reads them (its R11, R19): each own name whose value is neither absent nor
 * null, a value with a text `key` read as a reason with its own vars, any other value as `String` writes it. `word`
 * fills a sentence from these exactly as from the vars given.
 * @param {unknown} vars
 * @returns {WordVars}
 */
function wordVarsOf(vars) {
  /** @type {{[name: string]: string | number | Reason}} */
  const out = {};
  if (!isTable(vars)) return out;
  for (const name of Object.getOwnPropertyNames(vars)) {
    const v = vars[name];
    if (v === undefined || v === null) continue;
    const key = isObj(v) ? v.key : undefined;
    out[name] = isObj(v) && typeof key === 'string' ? { key, vars: wordVarsOf(v.vars) } : String(v);
  }
  return out;
}

/**
 * Whether `v` is a read an owner registers: a function, called with one argument (R6).
 * @param {unknown} v
 * @returns {v is NeighboursRead}
 */
export const isRead = (v) => typeof v === 'function';

/**
 * What `civil-time`'s `validAt` answers for an item at the date asked; a throw is read as undetermined, its message
 * the reason.
 * @param {RawFields} item
 * @param {unknown} at
 * @returns {unknown}
 */
function validityAt(item, at) {
  try { return validAt({ valid: item.valid, basis: item.basis }, at); } catch (e) {
    return { undetermined: true, why: String(isObj(e) && 'message' in e ? e.message ?? e : e) };
  }
}

/**
 * Whether an answer is a refusal `{refused, why}`.
 * @param {unknown} a
 * @returns {a is PassedRefusal}
 */
export const isRefusal = (a) => isObj(a) && filled(a.refused);

/**
 * Whether an answer keeps the contract: `failures` is what `answerFailures` found in it, and is empty.
 * @param {unknown} answer
 * @param {ReadFailure[]} failures
 * @returns {answer is NeighboursAnswer}
 */
export const keepsContract = (answer, failures) => failures.length === 0 && isObj(answer);

/**
 * The failures of one answer of an owner's `neighbours`, each `{check, why}`; empty when it conforms.
 * @param {unknown} answer
 * @param {ReadContext} ctx
 * @returns {ReadFailure[]}
 */
export function answerFailures(answer, ctx) {
  /** @type {ReadFailure[]} */
  const out = [];
  /** @param {string} check @param {string} why */
  const fail = (check, why) => { out.push({ check, why }); };
  if (isThenable(answer)) return [{ check: 'answer', why: 'neighbours must answer synchronously' }];
  const items = isObj(answer) ? answer.items : undefined;
  if (!isObj(answer) || !isList(items)) return [{ check: 'answer', why: 'an answer is {items, next?, truncated?, hub?, unread?}' }];
  // R20: what the owner holds for the node as a table and did not read, each {what, why}; optional.
  const u = answer.unread;
  if (u !== undefined) {
    if (!isList(u) || u.some((e) => !isObj(e) || !filled(e.what) || !filled(e.why))) {
      fail('unread', localize('connection-grammar.reads.unread_shape', 'unread is a list of entries, each with a non-empty what and a non-empty why'));
    }
  }
  if (items.length > BOUNDS.fanout) fail('fanout', localize('connection-grammar.reads.a_page_holds_at_most', 'a page holds at most {fanout} items; this one holds {length}', { fanout: String(BOUNDS.fanout), length: String(items.length) }));
  const kindsAsked = ctx.kinds;
  const asked = isList(kindsAsked) ? kindsAsked : null;
  const h = answer.hub;
  if (h !== undefined) {
    // R6, R10: a hub is a node whose set of one kind exceeds that kind's bound. The answer names no kind, so its set
    // must exceed the least bound of the owner's kinds that were asked.
    const mine = ctx.ownKinds.filter((k) => !asked || asked.includes(k));
    const pool = mine.length ? mine : ctx.ownKinds;
    const bound = pool.length ? Math.min(...pool.map(hubBoundOf)) : BOUNDS.hub;
    const setSize = isObj(h) ? h.set_size : undefined;
    const size = typeof setSize === 'number' && Number.isInteger(setSize) ? setSize : null;
    if (!isObj(h) || size === null || !filled(h.why)) fail('hub', 'a hub is answered {set_size, why}');
    else if (size <= bound) fail('hub', localize('connection-grammar.reads.a_hubs_set_of_one', 'a hub\'s set of one kind exceeds that kind\'s bound, here at least {bound}; {set_size} does not', { bound: String(bound), set_size: String(size) }));
    if (items.length) fail('hub', localize('connection-grammar.reads.hub_with_items', 'a hub is answered with no items, never a partial set shown as whole'));
  }
  /** @type {Set<unknown>} */
  const seen = new Set();
  const scope = ctx.scope;
  for (const item of items) {
    /** @type {string} */
    const name = isObj(item) && filled(item.id) ? String(item.id) : word('connection-grammar.item_without');
    const errors = connectionErrors(item, ctx.kindOf);
    for (const e of errors) {
      const check = e.field === 'label' ? 'label' : e.field === 'id' && /derivedId/.test(e.why) ? 'derived_id' : 'shape';
      fail(check, `${name}: ${e.why}`);
    }
    if (!isObj(item)) continue;
    if (seen.has(item.id)) fail('paging', localize('connection-grammar.reads.name_is_answered_twice_on', '{name} is answered twice on one page', { name: String(name) }));
    seen.add(item.id);
    const kind = item.kind;
    if (item.owner !== ctx.owner || typeof kind !== 'string' || !ctx.ownKinds.includes(kind)) fail('kinds', localize('connection-grammar.reads.name_is_not_of_owner', '{name} is not of {owner}\'s own kinds', { name: String(name), owner: String(ctx.owner) }));
    else if (asked && !asked.includes(kind)) fail('kinds', localize('connection-grammar.reads.name_is_of_kind_kind', '{name} is of kind {kind}, which was not asked', { name: String(name), kind: String(kind) }));
    if (item.from !== ctx.node && item.to !== ctx.node) fail('node', localize('connection-grammar.reads.name_does_not_have_the', '{name} does not have the node at either end', { name: String(name) }));
    if (errors.some((e) => e.field === 'valid')) continue;
    const v = validityAt(item, ctx.at);
    const undetermined = item.undetermined;
    if (v === 'out') fail('at', localize('connection-grammar.reads.name_is_out_at_the', '{name} is out at the date asked, so it is not returned', { name: String(name) }));
    else if (v === 'in') { if (undetermined !== undefined) fail('at', localize('connection-grammar.reads.name_is_in_at_the', '{name} is in at the date asked, yet marked undetermined', { name: String(name) })); }
    else if (!isObj(undetermined)) fail('at', localize('connection-grammar.reads.name_is_undetermined_at_the', '{name} is undetermined at the date asked and is not marked undetermined: {why}', { name: String(name), why: reasonText(isObj(v) ? v.why : undefined) }));
    else if (!reasonFills(undetermined.why)) fail('at', localize('connection-grammar.reads.reason_not_filled', '{name} is marked undetermined, but its reason is not a key with the vars the word list fills, nor a localize id', { name: String(name) }));
    if (typeof kind === 'string' && ctx.kindOf(kind)?.class === 'hunch' && (scope === null || scope === undefined || item.scope !== scope)) {
      fail('scope', localize('connection-grammar.reads.name_is_a_hunch_returned', '{name} is a hunch returned outside the working inquiry that holds it', { name: String(name) }));
    }
  }
  return out;
}
