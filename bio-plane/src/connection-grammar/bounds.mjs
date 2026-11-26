// @ts-check
/* connection-grammar: the bounds of every walk (R10) and the shape a walk answers when it stops at one (R15). No bound
   measures how connected a node is (R17): each limits work, never ranks. */

import { word } from '../setup-words/index.mjs';
import { isObj } from './raw.mjs';
/** @import { Refusal } from './shape.mjs' */

/** The hub bound of every kind not named in `hub_by_kind` (R10). */
const HUB = 1000;

/**
 * The hub bound per kind (R10; N566, K2063): `event_voted`, `events`' kind for a member's vote, 4,000 (a four-year
 * term is about 3,400 votes at the desk figure); every kind not named here is `hub`'s. A protective limit (K1881).
 * Frozen, with no prototype, so `hub_by_kind[kind] ?? hub` reads a named kind's bound and nothing inherited.
 */
const HUB_BY_KIND_HELD = Object.freeze({ __proto__: null, event_voted: 4000 });
/** @type {Readonly<{event_voted: number}>} */
const HUB_BY_KIND = HUB_BY_KIND_HELD;
/** @type {ReadonlyMap<string, number>} */
const HUB_OF_KIND = new Map([['event_voted', HUB_BY_KIND.event_voted]]);

/** The walk bounds (K1470; legistar-events §6). `time_budget_ms` is a default every walk may lower. */
export const BOUNDS = Object.freeze({
  depth_default: 8,
  depth_max: 10,
  fanout: 1000,
  nodes: 5000,
  hub: HUB,
  hub_by_kind: HUB_BY_KIND,
  time_budget_ms: 10000,
});

/**
 * The hub bound of one kind: its own in `hub_by_kind`, else `hub` (R6, R10). A node whose set of that kind exceeds it
 * is a hub, answered by its set size with no items.
 * @param {unknown} kind
 * @returns {number}
 */
export const hubBoundOf = (kind) => (typeof kind === 'string' ? HUB_OF_KIND.get(kind) ?? HUB : HUB);

/**
 * The depth a walk runs to: 8 when none is asked, the asked depth from 1 to 10, else a refusal saying why (R10, R18).
 * @param {unknown} [requested]
 * @returns {number | Refusal}
 */
export function depthOf(requested) {
  if (requested === undefined || requested === null) return BOUNDS.depth_default;
  if (typeof requested !== 'number' || !Number.isInteger(requested) || requested < 1) {
    return { refused: 'DEPTH_INVALID', why: word('connection-grammar.why.depth_whole_number', { depth_max: String(BOUNDS.depth_max), requested: String(String(requested).slice(0, 40)) }) };
  }
  if (requested > BOUNDS.depth_max) {
    return { refused: 'DEPTH_OVER_MAX', why: word('connection-grammar.why.walk_goes_hops', { depth_max: String(BOUNDS.depth_max), requested: String(requested) }) };
  }
  return requested;
}

/** @type {Readonly<{depth: string, nodes: string, fanout: string, hub: string, time: string}>} */
const WHY = Object.freeze({
  depth: word('connection-grammar.walk_reached_depth'),
  nodes: word('connection-grammar.walk_visited_bound', { nodes: String(BOUNDS.nodes) }),
  fanout: word('connection-grammar.node_connections_hop', { fanout: String(BOUNDS.fanout) }),
  hub: word('connection-grammar.walk_reached_hub', { hub: String(BOUNDS.hub), event_voted: String(HUB_BY_KIND.event_voted) }),
  time: word('connection-grammar.walk_used_time'),
});

/** The bounds a walk can stop at (R15). @type {readonly string[]} */
export const EXHAUSTION_REASONS = Object.freeze(['depth', 'nodes', 'fanout', 'hub', 'time']);
/** @type {ReadonlyMap<string, string>} */
const WHY_OF = new Map([['depth', WHY.depth], ['nodes', WHY.nodes], ['fanout', WHY.fanout], ['hub', WHY.hub], ['time', WHY.time]]);

/**
 * What a walk that stopped at a bound answers: truncated and undetermined, never a partial path shown as complete
 * (R15, K1442, K1470).
 * @param {{visited?: unknown, reason?: unknown}} [arg]
 * @returns {{refused: string, truncated?: undefined, undetermined?: undefined, visited?: undefined, why: string}
 *   | {refused?: undefined, truncated: boolean, undetermined: boolean, visited: number, why: string}}
 */
export function exhausted(arg) {
  /** @type {unknown} */
  const given = arg;
  const visited = isObj(given) ? given.visited : undefined;
  const reason = isObj(given) ? given.reason : undefined;
  const why = typeof reason === 'string' ? WHY_OF.get(reason) : undefined;
  if (why === undefined) {
    return { refused: 'REASON_UNKNOWN', why: word('connection-grammar.why.walk_stops_none', { exhaustion_reasons: String(EXHAUSTION_REASONS.join(', ')), reason: String(String(reason).slice(0, 40)) }) };
  }
  if (typeof visited !== 'number' || !Number.isInteger(visited) || visited < 0) {
    return { refused: 'VISITED_INVALID', why: word('connection-grammar.why.visited_count_nodes') };
  }
  return { truncated: true, undetermined: true, why, visited };
}
