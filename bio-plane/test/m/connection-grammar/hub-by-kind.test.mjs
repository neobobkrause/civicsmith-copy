/* connection-grammar at its interface: the hub bound per kind (R10's `hub_by_kind`), as R6 judges a node a hub, R19's
   registry read refuses a hub answered below its kind's bound, and R9's battery catches a hub shown as items. A sample
   owner of two kinds: `event_voted` (a member's vote, bound 4,000) and `event_held` (bound 1,000). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRegistry, ownerConformance, BOUNDS, hubBoundOf } from "../../../src/connection-grammar/index.mjs";
import { tie, AT, UNDATED } from "./fixtures/owner.mjs";
import { answerOf, refusalOf } from "./fixtures/reads.mjs";
import { isList } from "../../../src/connection-grammar/raw.mjs";
/** @import { KindSpec, Connection, Registry } from "../../../src/connection-grammar/shape.mjs" */
/** @import { SampleConnection, ReadArgs } from "./fixtures/owner.mjs" */
/** @import { ReadAnswer } from "./fixtures/reads.mjs" */

/**
 * The whole numbers from 0 below `n`.
 * @param {number} n
 * @returns {number[]}
 */
const range = (n) => {
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
};
/** @type {KindSpec[]} */
const KINDS = [
  { kind: "event_voted", word: "voted on", class: "evidentiary" },
  { kind: "event_held", word: "held a meeting on", class: "evidentiary" },
];
const MEMBER = "ENT-2026-0001";
// Undated, so undetermined at every date and marked so (R6); the battery runs with the owner declaring it (R9).
/**
 * The `i`th connection of one kind at MEMBER, undated and marked undetermined.
 * @param {string} kind
 * @param {number} i
 * @returns {SampleConnection}
 */
const conn = (kind, i) => ({ ...tie(`${kind}-${String(i).padStart(5, "0")}`, MEMBER, `ENT-2026-${10000 + i}`, { ...UNDATED }), kind, owner: "votes",
  undetermined: { why: { key: "civil-time.start_stated", vars: {} } } });

/**
 * An owner holding `votes` votes and `held` meetings at MEMBER, judging a hub per kind as R6 says, paged at the
 * fan-out. `wholeSet`: it judges a hub on the whole set's size against `hub` (1,000), not per kind. `noHub`: it never
 * answers a hub, paging every item instead.
 * @param {{votes?: number, held?: number, wholeSet?: boolean, noHub?: boolean}} [opts]
 * @returns {(args: ReadArgs) => unknown}
 */
function makeOwner({ votes = 0, held = 0, wholeSet = false, noHub = false } = {}) {
  const rows = [...range(votes).map((i) => conn("event_voted", i)), ...range(held).map((i) => conn("event_held", i))];
  return ({ node, kinds, page, viewer }) => {
    if (viewer === undefined || viewer === null) return { refused: "VIEWER_MISSING", why: "no viewer" };
    const set = rows.filter((c) => (c.from === node || c.to === node) && (!isList(kinds) || kinds.includes(c.kind)));
    if (!noHub) {
      const size = wholeSet ? (set.length > BOUNDS.hub ? set.length : 0)
        : Math.max(0, ...KINDS.map(({ kind }) => { const n = set.filter((c) => c.kind === kind).length; return n > hubBoundOf(kind) ? n : 0; }));
      if (size) return { items: [], hub: { set_size: size, why: "more connections of one kind than its bound" } };
    }
    const start = typeof page === "number" ? page : 0;
    const end = start + BOUNDS.fanout;
    return end < set.length ? { items: set.slice(start, end), next: end } : { items: set.slice(start) };
  };
}
/**
 * A registry with the votes owner as `opts` makes it.
 * @param {{votes?: number, held?: number, wholeSet?: boolean, noHub?: boolean}} opts
 * @returns {Registry}
 */
const registry = (opts) => {
  const r = createRegistry();
  const res = r.registerOwner({ owner: "votes", kinds: KINDS, neighbours: makeOwner(opts) });
  assert.equal("ok" in res && res.ok, true);
  return r;
};
/**
 * One read of the votes owner at MEMBER, as Alice; no kinds named asks the owner's kinds.
 * @param {Registry} r
 * @param {string[]} [kinds]
 * @param {unknown} [page]
 * @returns {ReadAnswer}
 */
const read = (r, kinds, page) => r.neighbours({ owner: "votes", node: MEMBER, ...(kinds ? { kinds } : {}), at: AT, page, viewer: "alice", scope: null });
/**
 * Every page of one read, joined; the first answer that carries no items where one does not.
 * @param {Registry} r
 * @param {string[]} kinds
 * @returns {Connection[] | ReadAnswer}
 */
const pages = (r, kinds) => {
  /** @type {Connection[]} */
  const out = [];
  /** @type {unknown} */
  let page;
  for (;;) {
    const a = read(r, kinds, page);
    if (!("items" in a)) return a;
    out.push(...a.items);
    const next = a.next;
    if (next === undefined) return out;
    page = next;
  }
};
/**
 * The battery over the votes owner, declared undated and group-wide, at MEMBER for Alice.
 * @param {{votes?: number, held?: number, wholeSet?: boolean, noHub?: boolean}} opts
 * @param {string[]} expected
 * @param {object} [fx]
 */
const battery = (opts, expected, fx = {}) => ownerConformance({ owner: "votes", kinds: KINDS, neighbours: makeOwner(opts), declares: { undated: true, group_wide: true },
  fixture: { node: MEMBER, at: AT, viewers: { sees: "alice" }, expected, ...fx } });
/**
 * The ids of the first `votes` votes and `held` meetings.
 * @param {number} votes
 * @param {number} held
 * @returns {string[]}
 */
const ids = (votes, held) => [...range(votes).map((i) => conn("event_voted", i).id), ...range(held).map((i) => conn("event_held", i).id)];

test("R6 R10 a vote set under 4,000 is not a hub: paged whole at the fan-out; over 4,000 it is a hub, named by its size with no items", () => {
  const r = registry({ votes: 3400 });
  const got = pages(r, ["event_voted"]);
  assert.ok(Array.isArray(got), JSON.stringify(got).slice(0, 300));
  assert.equal(got.length, 3400, "a four-year term's votes are read whole");
  for (const n of [4000, 4001]) {
    const a = answerOf(read(registry({ votes: n }), ["event_voted"]));
    if (n === 4000) assert.equal(a.hub, undefined, "4,000 is the bound, not over it");
    else { const hub = a.hub; assert.deepEqual(a.items, []); assert.equal(hub?.set_size, 4001); assert.ok(hub?.why.length); }
  }
  // Every other kind keeps hub's 1,000.
  assert.equal(answerOf(read(registry({ held: 1000 }), ["event_held"])).hub, undefined);
  const h = answerOf(read(registry({ held: 1001 }), ["event_held"]));
  assert.deepEqual([h.items, h.hub?.set_size], [[], 1001]);
  // The bound is per kind: 1,500 votes beside 900 meetings is no hub, each kind under its own bound.
  const mixed = pages(registry({ votes: 1500, held: 900 }), ["event_voted", "event_held"]);
  assert.ok(Array.isArray(mixed));
  assert.equal(mixed.length, 2400);
});

test("R19 R6 a hub answered below its kind's bound is refused whole as OWNER_NONCONFORMING naming hub; within another kind's bound it stands", () => {
  // An owner judging the whole set against 1,000 answers 1,500 votes as a hub: below the vote's 4,000, refused.
  const r = registry({ votes: 1500, wholeSet: true });
  const a = refusalOf(read(r, ["event_voted"]));
  assert.equal(a?.refused, "OWNER_NONCONFORMING");
  assert.ok(a?.failures.some((f) => f.check === "hub" && /4000/.test(f.why)), JSON.stringify(a?.failures));
  assert.equal(a?.items, false, "never trimmed");
  // Asked with a kind whose bound is 1,000, a set of 1,500 may be that kind's hub: it stands.
  const b = answerOf(read(registry({ held: 1500, wholeSet: true }), ["event_voted", "event_held"]));
  assert.deepEqual([b.items, b.hub?.set_size], [[], 1500]);
  // At or under every asked kind's bound, a hub is refused.
  const c = answerOf(read(registry({ held: 900, votes: 100, wholeSet: true }), ["event_held"]));
  assert.equal(c.hub, undefined, "under 1,000 the whole-set owner pages");
  const d = registry({ votes: 1000, wholeSet: false });
  assert.ok(Array.isArray(answerOf(read(d, undefined)).items), "no kinds named: the owner's kinds are asked");
});

test("R9 R6 the battery fails a hub shown as items, per kind, and passes a vote set under its bound read whole", () => {
  const whole = battery({ votes: 3400 }, ids(3400, 0));
  assert.deepEqual([whole.ok, whole.failures], [true, []], JSON.stringify(whole.failures.slice(0, 3)));
  const shownVotes = battery({ votes: 4001, noHub: true }, ids(4001, 0));
  assert.equal(shownVotes.ok, false);
  assert.ok(shownVotes.failures.some((f) => f.check === "hub" && /event_voted/.test(f.why) && /4000/.test(f.why)), JSON.stringify(shownVotes.failures.slice(0, 3)));
  const shownHeld = battery({ held: 1001, noHub: true }, ids(0, 1001));
  assert.ok(shownHeld.failures.some((f) => f.check === "hub" && /event_held/.test(f.why) && /1000/.test(f.why)), JSON.stringify(shownHeld.failures.slice(0, 3)));
  // The fixture's hub node: a vote hub over 4,000 passes; an owner that answers 1,500 votes as a hub fails.
  const OTHER = "ENT-2026-0002";
  const hubFx = { hub: { node: MEMBER, at: AT } };
  assert.equal(battery({ votes: 4001 }, [], { ...hubFx, node: OTHER }).ok, true);
  const low = battery({ votes: 1500, wholeSet: true }, [], { ...hubFx, node: OTHER });
  assert.equal(low.ok, false);
  assert.ok(low.failures.some((f) => f.check === "hub"), JSON.stringify(low.failures));
});
