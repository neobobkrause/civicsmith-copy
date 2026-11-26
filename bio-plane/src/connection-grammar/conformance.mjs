// @ts-check
/* connection-grammar: the battery each owner runs in its own job, over its own fixture (R9; B §(b) option (ii)). It
   reads the owner's `neighbours` directly, as `explore` would through the registry, and reports every failure it
   finds, each `{check, why}`. The fixture is metadata over the owner's own data:
     {node, at, kinds?, in, out, undetermined, viewers: {sees, blind}, fenced, expected, scope?, hunch?, hub?: {node, at}}
   each id one of the owner's connections at `node`; `expected` the complete set of ids `sees` gets at `node`/`at`
   within `scope`. An owner may declare what its kinds cannot show (N560): `undated`, they state no `valid`, so the
   fixture names no `in`, `out` or `undetermined`; `group_wide`, it holds no fenced item, so the fixture names no
   `fenced`. A declared check is answered in `inapplicable`, never in `failures`, and the declaration is itself
   checked over the owner's answers, so it cannot hide a dated or a fenced item. */
import { canonicalJson } from '../record-grammar/index.mjs';
import { createRegistry } from './registry.mjs';
import { answerFailures, isRead, isRefusal } from './reads.mjs';
import { hubBoundOf } from './bounds.mjs';
import { word, localize } from '../setup-words/index.mjs';
import { isObj, isList, isTable, filled } from './raw.mjs';
/** @import { RawFields } from './raw.mjs' */
/** @import { ReadFailure } from './shape.mjs' */
/** @import { ReadContext } from './reads.mjs' */

/** The most pages the battery follows before it calls the paging unbounded. */
const PAGE_LIMIT = 10000;
const OTHER_SCOPE = 'not-the-fixture-inquiry';
/** What an owner may declare its kinds cannot show (R9, N560). */
const DECLARATIONS = Object.freeze(['undated', 'group_wide']);

/**
 * A list's entries in order, as text sorts them.
 * @param {unknown[]} a
 * @returns {unknown[]}
 */
const sorted = (a) => [...a].sort();
/**
 * Whether two lists hold the same entries, in any order.
 * @param {unknown[]} a
 * @param {unknown[]} b
 * @returns {boolean}
 */
const sameSet = (a, b) => canonicalJson(sorted(a)) === canonicalJson(sorted(b));
/**
 * Whether a validity states a start or an end.
 * @param {unknown} v
 * @returns {boolean}
 */
const statesDates = (v) => {
  if (!isObj(v)) return false;
  const from = v.from, to = v.to;
  return (from !== null && from !== undefined) || (to !== null && to !== undefined);
};
/**
 * The entries of a list that are objects, read as they come.
 * @param {unknown[]} list
 * @returns {RawFields[]}
 */
const objectsOf = (list) => {
  /** @type {RawFields[]} */
  const out = [];
  for (const v of list) if (isObj(v)) out.push(v);
  return out;
};

/**
 * R6, R10: the kinds whose items, over pages joined, exceed that kind's hub bound: a hub shown as items.
 * @param {RawFields[]} items
 * @returns {string[]}
 */
function hubsShown(items) {
  /** @type {[unknown, number][]} */
  const none = [];
  const n = new Map(none);
  for (const i of items) n.set(i.kind, (n.get(i.kind) ?? 0) + 1);
  return [...n].filter(([k, c]) => c > hubBoundOf(k)).map(([k, c]) => word('connection-grammar.items_hub_bound', { count: String(c), key: String(k), key_2: String(hubBoundOf(k)) }));
}

/**
 * The battery an owner runs over its own fixture (R9). It reads `{owner, neighbours, kinds, fixture, declares?}`,
 * `declares` being `{undated?, group_wide?}`; anything malformed is a failure, never a throw.
 * @param {unknown} arg
 * @returns {{ok: boolean, failures: {check: string, why: string}[], inapplicable?: {check: string, why: string}[]}}
 */
export function ownerConformance(arg) {
  /** @type {ReadFailure[]} */
  const failures = [];
  /** @type {ReadFailure[]} */
  const inapplicable = [];
  /** @param {string} check @param {string} why */
  const fail = (check, why) => { failures.push({ check, why }); };
  // The inapplicable checks are stated only when a declaration made one so; else the answer is {ok, failures} (K1733).
  const done = () => ({ ok: failures.length === 0, failures, ...(inapplicable.length ? { inapplicable } : {}) });
  const given = isObj(arg) ? arg : {};
  const owner = given.owner, neighbours = given.neighbours, kinds = given.kinds, fx = given.fixture, declares = given.declares;

  if (declares !== undefined) {
    const table = isTable(declares) ? declares : null;
    const stray = table !== null ? Object.keys(table).find((k) => !DECLARATIONS.includes(k)) : undefined;
    const bad = table === null ? 'is not an object'
      : stray !== undefined ? `names ${stray.slice(0, 40)}, which is not one of ${DECLARATIONS.join(', ')}`
      : Object.values(table).some((v) => v !== undefined && typeof v !== 'boolean') ? 'gives a value that is neither true nor false'
      : null;
    if (bad) { fail('declares', `the declaration {undated?, group_wide?} ${bad}`); return done(); }
  }
  const undated = isObj(declares) && declares.undated === true;
  const groupWide = isObj(declares) && declares.group_wide === true;
  if (undated) inapplicable.push({ check: 'at', why: word('connection-grammar.why.declares_kinds_undated', { owner: String(owner) }) });
  if (groupWide) inapplicable.push({ check: 'sight', why: word('connection-grammar.why.declares_holds_fenced', { owner: String(owner) }) });

  const reg = createRegistry();
  const r = reg.registerOwner({ owner, kinds, neighbours });
  if ('refused' in r) { fail('registration', `${r.refused}: ${r.why}`); return done(); }
  const registered = reg.owners()[0]?.kinds ?? [];
  const fixtureWhy = 'the fixture names {node, at, viewers: {sees, blind}, expected, in, out, undetermined, fenced}';
  if (!isRead(neighbours) || !isObj(fx)) { fail('fixture', fixtureWhy); return done(); }
  const fxNode = fx.node, fxAt = fx.at, viewers = fx.viewers, expected = fx.expected, fxKinds = fx.kinds, fxHub = fx.hub;
  if (!filled(fxNode) || fxAt === undefined || !isObj(viewers) || !isList(expected)) { fail('fixture', fixtureWhy); return done(); }
  const ownKinds = registered.map((k) => k.kind);
  /** @type {unknown[]} */
  const asked = isList(fxKinds) ? fxKinds : ownKinds;
  const scope = fx.scope ?? null;
  /**
   * What an answer at `node` within `sc` is judged against.
   * @param {unknown} node
   * @param {unknown} sc
   * @returns {ReadContext}
   */
  const ctx = (node, sc) => ({ owner: r.owner, ownKinds, kinds: asked, node, at: fxAt, scope: sc, kindOf: reg.kindOf });

  /**
   * One raw call; a throw is a failure, never the battery's crash.
   * @param {RawFields} args
   * @returns {unknown}
   */
  const call = (args) => {
    try { return neighbours(args); } catch (e) { fail('answer', `neighbours threw: ${String(isObj(e) && 'message' in e ? e.message ?? e : e).slice(0, 200)}`); return null; }
  };

  /**
   * Every page for one viewer and scope, joined; null when a page fails.
   * @param {unknown} viewer
   * @param {unknown} sc
   * @param {unknown} [node]
   * @param {unknown} [at]
   * @param {unknown[]} [ks]
   * @returns {{items: RawFields[]} | null}
   */
  const collect = (viewer, sc, node = fxNode, at = fxAt, ks = asked) => {
    /** @type {unknown[]} */
    const items = [];
    /** @type {unknown} */
    let page;
    /** @type {Set<unknown>} */
    const pages = new Set();
    for (let i = 0; i < PAGE_LIMIT; i++) {
      const a = call({ node, kinds: ks, at, page, viewer, scope: sc });
      if (a === null) return null;
      if (isRefusal(a)) { fail('answer', localize('connection-grammar.conformance.refused_refused_for_viewer_string', 'refused {refused} for viewer {String}: {why}', { refused: String(a.refused), String: String(String(viewer)), why: String(a.why) })); return null; }
      const f = answerFailures(a, { ...ctx(node, sc), at, kinds: ks });
      const got = isObj(a) ? a.items : undefined;
      const next = isObj(a) ? a.next : undefined;
      if (f.length || !isList(got)) { failures.push(...f); return null; }
      items.push(...got);
      if (next === undefined || next === null) return { items: objectsOf(items) };
      const key = canonicalJson(next);
      if (pages.has(key)) { fail('paging', 'next repeats a page already read'); return null; }
      pages.add(key);
      page = next;
    }
    fail('paging', localize('connection-grammar.conformance.paging_did_not_end_within', 'paging did not end within {PAGE_LIMIT} pages', { PAGE_LIMIT: String(PAGE_LIMIT) }));
    return null;
  };

  // R7: a missing viewer is refused, never read as an administrator or the public.
  const nobody = call({ node: fxNode, kinds: asked, at: fxAt, viewer: undefined, scope });
  if (!isRefusal(nobody) || nobody.refused !== 'VIEWER_MISSING') fail('sight', 'a read with no viewer is not refused VIEWER_MISSING');

  // Determinism: two identical calls give identical answers.
  const once = () => call({ node: fxNode, kinds: asked, at: fxAt, viewer: viewers.sees, scope });
  const a1 = once(), a2 = once();
  let same = false;
  try { same = canonicalJson(a1) === canonicalJson(a2); } catch { same = false; }
  if (!same) fail('determinism', 'two identical calls gave different answers');

  const sees = collect(viewers.sees, scope);
  if (sees) for (const why of hubsShown(sees.items)) fail('hub', localize('connection-grammar.conformance.node_is_a_hub_shown', '{node} is a hub shown as items: {why}; a hub is named, never shown', { node: String(fxNode), why: String(why) }));
  if (sees) {
    const ids = sees.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) fail('paging', 'an item is answered on two pages');
    if (!sameSet(ids, expected)) fail('paging', localize('connection-grammar.conformance.the_pages_joined_length_items', 'the pages joined ({length} items) are not the complete set the fixture expects ({length_2})', { length: String(ids.length), length_2: String(expected.length) }));
    /** @type {[unknown, RawFields][]} */
    const pairs = sees.items.map((i) => [i.id, i]);
    const byId = new Map(pairs);
    // R6: the date rule, one connection in, one out, one undetermined; unless the owner declares its kinds undated.
    if (undated) {
      const dated = sees.items.find((i) => statesDates(i.valid));
      if (dated) fail('declares', localize('connection-grammar.conformance.owner_declares_its_kinds_undated', '{owner} declares its kinds undated, yet {id} states a valid bound', { owner: String(owner), id: String(dated.id) }));
    } else {
      if (!byId.has(fx.in) || byId.get(fx.in)?.undetermined !== undefined) fail('at', localize('connection-grammar.conformance.in_in_at_the_date', '{in} (in at the date) is not returned unmarked', { in: String(fx.in) }));
      if (byId.has(fx.out) || !filled(fx.out)) fail('at', localize('connection-grammar.conformance.out_out_at_the_date', '{out} (out at the date) is returned, or the fixture names none', { out: String(fx.out) }));
      if (!byId.has(fx.undetermined) || !isObj(byId.get(fx.undetermined)?.undetermined)) fail('at', localize('connection-grammar.conformance.undetermined_undetermined_at_the_date', '{undetermined} (undetermined at the date) is not returned marked undetermined', { undetermined: String(fx.undetermined) }));
    }
    // R7: the fenced item reaches the viewer who may see it, and nothing of it reaches the one who may not; unless the
    // owner declares it holds no fenced item, when the other viewer gets the complete set. The missing viewer is
    // checked above either way.
    if (groupWide) {
      const blindViewer = viewers.blind;
      if (blindViewer !== undefined) {
        const other = collect(blindViewer, scope);
        if (other && !sameSet(other.items.map((i) => i.id), expected)) fail('declares', localize('connection-grammar.conformance.owner_declares_it_holds_no', '{owner} declares it holds no fenced item, yet the other viewer\'s pages are not the complete set', { owner: String(owner) }));
      }
    } else {
      if (!byId.has(fx.fenced)) fail('sight', localize('connection-grammar.conformance.fenced_fenced_is_not_returned', '{fenced} (fenced) is not returned to the viewer who may see it', { fenced: String(fx.fenced) }));
      const blind = collect(viewers.blind, scope);
      if (blind) {
        const bids = blind.items.map((i) => i.id);
        if (bids.includes(fx.fenced)) fail('sight', localize('connection-grammar.conformance.fenced_fenced_is_returned_to', '{fenced} (fenced) is returned to the viewer who may not see it', { fenced: String(fx.fenced) }));
        if (!sameSet(bids, expected.filter((x) => x !== fx.fenced))) fail('sight', 'the other viewer\'s pages are not the complete set less the fenced item');
      }
    }
  }

  // R6: kinds limited to those asked, each read asking one kind alone.
  for (const k of asked) {
    const got = collect(viewers.sees, scope, fxNode, fxAt, [k]);
    if (got && sees && !sameSet(got.items.map((i) => i.id), sees.items.filter((i) => i.kind === k).map((i) => i.id))) {
      fail('kinds', localize('connection-grammar.conformance.asking_k_alone_does_not', 'asking {k} alone does not give exactly the {k_2} items of the whole set', { k: String(k), k_2: String(k) }));
    }
  }

  // R8: a hunch only within the working inquiry that holds it.
  if (registered.some((k) => k.class === 'hunch')) {
    if (!filled(fx.hunch) || !filled(fx.scope)) fail('scope', 'an owner of hunch kinds names a hunch and its working inquiry in its fixture');
    else {
      if (sees && !sees.items.some((i) => i.id === fx.hunch)) fail('scope', localize('connection-grammar.conformance.hunch_hunch_is_not_returned', '{hunch} (hunch) is not returned within its inquiry', { hunch: String(fx.hunch) }));
      for (const sc of [null, OTHER_SCOPE]) {
        const got = collect(viewers.sees, sc);
        if (got && got.items.some((i) => reg.kindOf(i.kind)?.class === 'hunch')) fail('scope', localize('connection-grammar.conformance.a_hunch_is_returned_with', 'a hunch is returned with scope {sc}', { sc: String(sc) }));
      }
    }
  }

  // R6: a hub is named by its set size, with no items.
  const hub = fxHub;
  if (hub !== undefined) {
    const h = isObj(hub) ? call({ node: hub.node, kinds: asked, at: hub.at ?? fxAt, viewer: viewers.sees, scope }) : null;
    if (!isObj(h) || isRefusal(h) || !isObj(h.hub)) fail('hub', 'the fixture\'s hub node is not answered as a hub');
    const hubNode = isObj(hub) ? hub.node : undefined;
    const hubAt = isObj(hub) ? hub.at ?? fxAt : fxAt;
    if (isObj(h) && !isRefusal(h)) failures.push(...answerFailures(h, { ...ctx(hubNode, scope), at: hubAt }));
    // R6, R10: the bound is per kind. Asked one kind alone, a hub answer is judged against that kind's own bound.
    if (isObj(hub) && asked.length > 1) {
      for (const k of asked) {
        const one = call({ node: hub.node, kinds: [k], at: hubAt, viewer: viewers.sees, scope });
        if (isObj(one) && !isRefusal(one) && one.hub !== undefined) {
          failures.push(...answerFailures(one, { ...ctx(hub.node, scope), at: hubAt, kinds: [k] }).filter((f) => f.check === 'hub'));
        }
      }
    }
  }
  return done();
}
