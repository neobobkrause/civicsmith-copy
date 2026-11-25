// @ts-check
/* explore: the one walk across every owner of a relationship (R2–R9, R15). Breadth-first from a node over the owners
   registered with `connection-grammar`, as of a stated date, within its bounds; each hop is the owner's answer,
   unchanged; a path's grade is its weakest hop's; it writes nothing and records no one's exploring (R9). A declared
   step with an attached source is walked as that source (R24); a walk stopped at its depth says so (R22). Every preset
   and the connection graph's read are this walk over a kind set (R10, R21). */
import { BOUNDS, chainGrade, chainLabel, orderPaths, exhausted } from '../connection-grammar/index.mjs';
import { OBSERVATION_STATES } from '../observation-log/index.mjs';
import { kindsByOwner, makeReader } from './reader.mjs';
import { nameEnds } from './labels.mjs';
import {
  refuse, isObj, filled, viewerRefusal, nodeRefusal, dateRefusal, depthOrRefusal, dateText,
  LEAD_SENTENCE, DECLARED_MARK, HUNCH_MARK, NOT_ASSERTED,
} from './answer.mjs';
import { word, localize } from '../setup-words/index.mjs';

/** What a path's stated quantity is, when an answer is ordered by one (R3). */
export const QUANTITY_OF_PATH = word('explore.quantity_of_path');
/** The order every answer states (R3, connection-grammar R14). */
export const PATH_ORDER = word('explore.path_order');

/**
 * The kinds a walk is asked over: each must be registered (UNKNOWN_KIND, naming it); absent means every registered
 * kind (R1, R2).
 * @param {any} registry @param {unknown} kinds
 */
export function resolveKinds(registry, kinds) {
  if (kinds === undefined || kinds === null) return { kinds: registry.owners().flatMap((o) => o.kinds.map((k) => k.kind)) };
  if (!Array.isArray(kinds) || kinds.some((k) => !filled(k))) return { refusal: refuse('UNKNOWN_KIND', localize('explore.walk.kinds_is_list', 'kinds is a list of the kinds owners registered')) };
  const unknown = kinds.find((k) => registry.kindOf(k) === null);
  if (unknown !== undefined) return { refusal: refuse('UNKNOWN_KIND', word('explore.no.owner_registered_kind', { kind: String(String(unknown).slice(0, 60)) })) };
  return { kinds: [...new Set(kinds)] };
}

/**
 * The arguments every walk checks, in R1's order after the viewer (which fails closed before anything is read).
 * @param {any} registry @param {any} a @param {string} [fromName] what the start is called in refusals (R21: `centre`)
 */
export function checkWalkArgs(registry, a, fromName = 'from') {
  const arg = isObj(a) ? a : {};
  const r = viewerRefusal(arg.viewer) || nodeRefusal(arg.from, fromName, true) || nodeRefusal(arg.to, 'to', false) || dateRefusal(arg.at);
  if (r) return { refusal: r };
  const k = resolveKinds(registry, arg.kinds);
  if (k.refusal) return k;
  const d = depthOrRefusal(arg.depth);
  if (d.refusal) return d;
  if (arg.sortBy !== undefined && arg.sortBy !== null && !filled(arg.sortBy)) return { refusal: refuse('UNKNOWN_QUANTITY', localize('explore.walk.sort_by_names', 'sortBy names a quantity a step states')) };
  if (arg.scope !== undefined && arg.scope !== null && !(isObj(arg.scope) && filled(arg.scope.inquiry))) {
    return { refusal: refuse('BAD_SCOPE', localize('explore.walk.scope_names_one', 'a scope names one inquiry: the working inquiry whose hunch steps may be walked')) };
  }
  return { kinds: k.kinds, depth: d.depth };
}

/** The kind an attached source of a declared step is registered as (`connections` R69; R24). */
export const STEP_SOURCE = 'step_source';
/** What a walk stopped at its depth says (R22): the nodes there were not asked about. */
export const DEPTH_SENTENCE = word('explore.depth_sentence');
/** How many nodes at the depth an answer names (R22). */
export const AT_DEPTH_MAX = 500;

/**
 * A declared step backed by a standing attached source the viewer may see is walked as that source (R24): the
 * `step_source` hop whose `evidence[0].relation` is the declared hop's id takes its place, carrying `backs`. The
 * sources are read at the node through the registry even when the asked kinds do not name them, so a sourced step is
 * never shown as a lead; one the viewer may not see is never answered by its owner, so the declared hop stands (R6, R7).
 * @param {any} registry @param {any} r a reader @param {string} node @param {any[]} items @param {string[]} kinds
 */
function sourcedSteps(registry, r, node, items, kinds) {
  const sk = registry.kindOf(STEP_SOURCE);
  if (!sk) return items;
  const declared = new Set(items.filter((h) => registry.kindOf(h.kind)?.class === 'declared').map((h) => h.id));
  if (!declared.size) return items;
  const asked = kinds.includes(STEP_SOURCE);
  const sources = asked ? items.filter((h) => h.kind === STEP_SOURCE) : (r.read(sk.owner, node, [STEP_SOURCE]) ?? []);
  const relationOf = (h) => (Array.isArray(h.evidence) && isObj(h.evidence[0]) ? h.evidence[0].relation : undefined);
  const backing = sources.filter((h) => declared.has(relationOf(h)));
  if (!backing.length) return items;
  const backed = new Set(backing.map(relationOf));
  const marked = new Map(backing.map((h) => [h, { ...h, backs: relationOf(h) }]));
  const out = [];
  for (const h of items) {
    if (backed.has(h.id) && registry.kindOf(h.kind)?.class === 'declared') continue;
    out.push(marked.get(h) ?? h);
  }
  if (!asked) out.push(...marked.values());
  return out;
}

/**
 * The one traversal (R2, R4, R5, R7, R15, R24): breadth-first from `from` to `depth`, each node read once per owner of
 * the asked kinds. It answers the reader's state, the level each node was reached at, every path found, how many nodes
 * were visited, and the nodes at the last level reached and whether that level is the depth (R22).
 * @param {{registry: any, now: () => number, budget_ms: number}} ctx
 * @param {{from: string, to?: string, kinds: string[], at: any, depth: number, scope?: {inquiry: string} | null, viewer: any, direction?: 'out'}} w
 */
export function traverse(ctx, w) {
  const { registry } = ctx;
  const scope = w.scope ? w.scope.inquiry : null;
  const byOwner = kindsByOwner(registry, w.kinds);
  const r = makeReader(ctx, { at: w.at, viewer: w.viewer, scope });
  /** @type {Map<string, number>} */
  const level = new Map([[w.from, 0]]);
  /** @type {Map<string, any[]>} */
  const best = new Map([[w.from, []]]);
  const found = [];
  let visited = 1;

  /** Paths into each node of a level: one per step into it, after the best path to its parent. */
  const settle = (nodes, into) => {
    for (const v of nodes) {
      const cands = into.get(v).map(({ parent, hop }) => [...best.get(parent), hop]);
      const ordered = /** @type {any[]} */ (orderPaths(cands));
      best.set(v, ordered[0]);
      for (const hops of ordered) found.push(hops);
    }
  };

  let frontier = [w.from], levels = 0, reachedTo = false;
  for (let d = 0; d < w.depth && frontier.length && !r.s.stop; d++) {
    const next = [];
    /** @type {Map<string, {parent: string, hop: any}[]>} */
    const into = new Map();
    level: for (const node of frontier) {
      let items = [];
      for (const [owner, kinds] of byOwner) {
        const got = r.read(owner, node, kinds);
        if (r.s.stop) break level;
        if (got) items.push(...got);
      }
      items = sourcedSteps(registry, r, node, items, w.kinds);
      if (r.s.stop) break level;
      for (const hop of items) {
        if (w.direction === 'out' && hop.from !== node) continue; // a money trail follows payer to payee
        const other = hop.from === node ? hop.to : hop.from;
        if (other === node) continue;
        const lv = level.get(other);
        if (lv !== undefined && lv <= d) continue; // reached already by a shorter path
        if (lv === undefined) {
          if (visited >= BOUNDS.nodes) { r.s.stop = 'nodes'; r.s.stop_node = node; break level; }
          level.set(other, d + 1);
          visited++;
          next.push(other);
          into.set(other, []);
        }
        /** @type {any[]} */ (into.get(other)).push({ parent: node, hop });
      }
    }
    // A level cut short by a bound still answers the paths it found: each is whole, and the answer says the set is not.
    settle(next, into);
    frontier = next;
    levels = d + 1;
    if (w.to !== undefined && w.to !== null && level.has(w.to)) { reachedTo = true; break; } // every shortest path into `to` is found
  }
  // The nodes at the depth were reached and never asked about (R22), in the order of their best paths (R3).
  const atDepth = levels === w.depth && frontier.length
    ? /** @type {any[]} */ (orderPaths(frontier.map((n) => ({ n, hops: best.get(n) })))).map((x) => x.n)
    : [];
  return { r, level, best, found, visited, atDepth, reachedTo };
}

/** What every walk answers about its depth (R22). @param {string[]} atDepth */
export function depthStop(atDepth) {
  if (!atDepth.length) return { depth_stopped: false };
  return { depth_stopped: true, at_depth: atDepth.slice(0, AT_DEPTH_MAX), ...(atDepth.length > AT_DEPTH_MAX ? { at_depth_truncated: true } : {}), depth_sentence: DEPTH_SENTENCE };
}

/**
 * The walk itself, over already-checked arguments.
 * @param {{registry: any, now: () => number, budget_ms: number}} ctx
 * @param {{from: string, to?: string, kinds: string[], at: any, depth: number, sortBy?: string, scope?: {inquiry: string} | null, viewer: any, direction?: 'out'}} w
 */
export function walk(ctx, w) {
  const { registry, budget_ms } = ctx;
  const { r, found, visited, atDepth } = traverse(ctx, w);
  const elapsed_ms = r.elapsed();
  const { hubs, fanout, refusals, unread, stop } = r.s;
  let paths = found.map((hops) => describePath(registry, hops, w.sortBy));
  if (w.to !== undefined && w.to !== null) paths = paths.filter((p) => p.hops[p.hops.length - 1].from === w.to || p.hops[p.hops.length - 1].to === w.to);
  if (w.sortBy) {
    const stated = found.some((hops) => hops.some((h) => isObj(h.quantities) && typeof h.quantities[w.sortBy] === 'number'));
    if (!stated) return refuse('UNKNOWN_QUANTITY', localize('explore.walk.no_step_in_the_walk', 'no step in the walk states the quantity {sortBy}', { sortBy: String(w.sortBy) }));
  }
  paths = /** @type {any[]} */ (orderPaths(paths, w.sortBy ? { by: w.sortBy } : {}));
  // Each hop of each path answered carries its two ends' names, read once for the distinct ends (R26).
  const named = nameEnds(ctx, paths.flatMap((p) => p.hops), w.viewer);
  paths = paths.map((p) => ({ ...p, hops: p.hops.map(named) }));
  const complete = r.complete();
  const answer = {
    ok: true, from: w.from, ...(w.to ? { to: w.to } : {}), at: w.at, kinds: w.kinds, scope: w.scope ?? null,
    order: w.sortBy ? { by: w.sortBy, quantity: QUANTITY_OF_PATH, then: PATH_ORDER } : { by: PATH_ORDER },
    paths, hubs, fanout_truncated: fanout, owner_refusals: refusals,
    visited, depth: w.depth, ...depthStop(atDepth), budget_ms, elapsed_ms, owner_calls: r.s.calls, complete, note: NOT_ASSERTED,
    ...(stop ? exhausted({ visited, reason: stop }) : {}),
  };
  if (!paths.length) answer.absence = absence(w, complete, unread);
  else if (unread.length) answer.unread = unread;
  return answer;
}

/**
 * One path as the answer gives it: its hops as their owners answered them, its grade (the weakest hop's on each
 * axis), its label, and what holds at the date (R3, R4, R6).
 * @param {any} registry @param {any[]} hops @param {string} [by]
 */
export function describePath(registry, hops, by) {
  const marks = [];
  for (const h of hops) {
    const cls = registry.kindOf(h.kind)?.class;
    if (cls === 'declared') marks.push({ hop: h.id, mark: DECLARED_MARK });
    else if (cls === 'hunch') marks.push({ hop: h.id, mark: HUNCH_MARK, grade: null });
    else if (cls === 'derived') marks.push({ hop: h.id, mark: 'derived', derivation: h.derived });
  }
  const label = chainLabel(hops);
  const undet = hops.filter((h) => isObj(h.undetermined));
  const p = {
    hops, grade: chainGrade(hops), label: label.label, ...(label.label === 'lead' ? { lead: { hops: label.hops, sentence: LEAD_SENTENCE } } : {}),
    marks, at_date: undet.length ? 'undetermined' : 'in',
    ...(undet.length ? { undetermined: { hops: undet.map((h) => h.id), why: undet.map((h) => ({ hop: h.id, why: h.undetermined.why })) } } : {}),
  };
  if (by) {
    const last = hops[hops.length - 1];
    const q = isObj(last.quantities) && typeof last.quantities[by] === 'number' ? last.quantities[by] : null;
    /** @type {any} */ (p).quantities = { [by]: q };
  }
  return p;
}

/** An answer with no path states its level and what it could not read (R8, D59). */
function absence(w, complete, unread) {
  const state = complete ? 'LOOKED_ABSENT' : 'LOOKED_INDETERMINATE';
  return {
    level: 'meaning', state, meaning: OBSERVATION_STATES[state],
    searched: word('explore.searched', { kinds: String(w.kinds.length), s: String(w.kinds.length === 1 ? '' : 's'), at: String(dateText(w.at)), depth: String(w.depth), from: String(w.from), to: String(w.to ? ` toward ${w.to}` : '') }),
    reach: word('explore.reach'),
    unread,
  };
}
