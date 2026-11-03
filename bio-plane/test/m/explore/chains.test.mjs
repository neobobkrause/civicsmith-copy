/* explore at its interface: every meaningful chain between two ends (R30), the most direct (R31), shorter chains beside a member's
   own (R32), a search kept after a stop by time (R33), the four ops' own budget (R34) and their declaration (R35). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { exploreOf } from "../../../src/explore/index.mjs";
import { exploreOps, DECLARED_OPS } from "../../../src/explore/ops.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { BOUNDS, CHAIN_LIMITS } from "../../../src/connection-grammar/index.mjs";
import { defaultRegistry } from "../../../src/connection-grammar/index.mjs";
import { seeded, ANN, ZONE as MZONE } from "../money/fixture.mjs";
import { AT, ZONE, valid, ent, conn, world, byOwner, makeStore, makeOwner, OWNER_KINDS } from "./fixtures/owners.mjs";

const V = "alice";
const [A, B, C, D, E, F, G, H] = [1, 2, 3, 4, 5, 6, 7, 8].map(ent);
const make = (conns, o = {}) => { const w = world(byOwner(conns), o); return { ...w, x: exploreOf(null, { registry: w.registry, ...(o.ctx ?? {}) }) }; };
const ask = (x, extra = {}) => x.connectionsBetween({ from: A, to: E, at: AT, viewer: V, ...extra });
const route = (c) => c.steps.map((s) => s.id).join(">");
const routes = (r) => r.chains.map(route);
const strip = (r) => { const { elapsed_ms, owner_calls, ...rest } = r; return rest; };

/* a world on a fake clock: every owner call takes `step` milliseconds */
const clocked = (conns, step, ctx = {}) => {
  const clock = { t: 0 };
  const log = { push: () => { clock.t += step; } };
  const opts = Object.fromEntries(Object.keys(OWNER_KINDS).map((o) => [o, { log }]));
  const w = world(byOwner(conns), { opts });
  return { clock, ...w, x: exploreOf(null, { registry: w.registry, now: () => clock.t, wall: () => clock.t, ...ctx }) };
};

/* A to E by a 2-step, a 3-step and a 4-step route, and a longer way round that none of the tests asks for */
const routesWorld = () => [
  conn("line:part_of", A, B, { id: "ab" }), conn("line:part_of", B, E, { id: "be" }),
  conn("line:reports_to", A, C, { id: "ac" }), conn("line:reports_to", C, D, { id: "cd" }), conn("line:funds", D, E, { id: "de" }),
  conn("line:oversees", A, F, { id: "af" }), conn("line:oversees", F, G, { id: "fg" }), conn("line:oversees", G, H, { id: "gh" }), conn("line:oversees", H, E, { id: "he" }),
];

test("R30 every meaningful chain between two ends, fewest steps first; explore with `to` still lists only the shortest level", () => {
  const { x } = make(routesWorld());
  const r = ask(x);
  assert.equal(r.ok, true);
  assert.deepEqual(routes(r), ["ab>be", "ac>cd>de", "af>fg>gh>he"]);
  assert.deepEqual(r.chains.map((c) => c.step_count), [2, 3, 4]);
  assert.equal(r.found, 3);
  assert.equal(r.listed, 3);
  assert.equal(r.cut_by_limit, false);
  assert.equal(r.more_may_exist, false);
  assert.equal(r.stopped, undefined);
  assert.equal(r.complete_through_steps, r.depth);
  assert.ok(r.chains.every((c) => c.level_complete && c.grade && c.strength && c.label === "evidenced"));
  assert.ok(r.chains.every((c) => c.steps.every((s) => "from_label" in s && "to_label" in s)), "each step carries its ends' names (R26)");
  const e = x.explore({ from: A, to: E, at: AT, viewer: V });
  assert.deepEqual(e.paths.map((p) => p.hops.map((h) => h.id).join(">")), ["ab>be"]);
  assert.equal(JSON.stringify(strip(e)), JSON.stringify(strip(x.explore({ from: A, to: E, at: AT, viewer: V }))));
  assert.equal(strip(ask(x, { kinds: ["line:part_of", "line:oversees", "line:funds"] })).chains.length, 2, "control: kinds that leave out the 3-step's reports_to list two");
  assert.deepEqual(routes(ask(x, { kinds: ["line:part_of", "line:oversees", "line:funds"] })), ["ab>be", "af>fg>gh>he"]);
});

test("R30 refusals in R1's order, then no end, the same end, the limit and the budget", () => {
  const { x } = make(routesWorld());
  assert.equal(x.connectionsBetween({ from: A, to: E, at: AT }).refused, "VIEWER_MISSING");
  assert.equal(x.connectionsBetween({ to: E, at: AT, viewer: V }).refused, "NO_NODE");
  assert.equal(x.connectionsBetween({ from: A, to: "bad", at: AT, viewer: V }).refused, "BAD_NODE");
  assert.equal(x.connectionsBetween({ from: A, to: E, viewer: V }).refused, "NO_DATE");
  assert.equal(x.connectionsBetween({ from: A, to: E, at: AT, viewer: V, kinds: ["nope"] }).refused, "UNKNOWN_KIND");
  assert.equal(x.connectionsBetween({ from: A, to: E, at: AT, viewer: V, depth: 11 }).refused, "DEPTH_OVER_MAX");
  assert.equal(x.connectionsBetween({ from: A, at: AT, viewer: V }).refused, "EXPLORE_NO_END");
  assert.equal(x.connectionsBetween({ from: A, to: A, at: AT, viewer: V }).refused, "EXPLORE_SAME_END");
  assert.equal(ask(x, { limit: CHAIN_LIMITS.chains.max + 1 }).refused, "CHAIN_LIMIT_OVER_MAX");
  assert.equal(ask(x, { limit: 0 }).refused, "CHAIN_LIMIT_INVALID");
  assert.equal(ask(x, { budget_ms: 0 }).refused, "BUDGET_OUT_OF_RANGE");
  assert.equal(ask(x, { limit: 0, budget_ms: 0 }).refused, "CHAIN_LIMIT_INVALID", "the limit is judged before the budget");
  for (const r of [x.connectionsBetween({ from: A, at: AT, viewer: V }), ask(x, { budget_ms: 0 })]) assert.ok(r.why.length > 10, "every refusal says why");
});

test("R30 forty parallel payments between two nodes are one step carrying the count; no chain repeats a node", () => {
  const pays = Array.from({ length: 40 }, (_, i) => conn("payment", A, B, { id: `pay-${String(i).padStart(2, "0")}` }));
  const { x } = make([...pays, conn("line:part_of", B, E, { id: "be" }), conn("line:part_of", A, E, { id: "ae" }), conn("line:part_of", B, A, { id: "ba" })]);
  const r = ask(x);
  assert.deepEqual(routes(r).sort(), ["ae", "pay-00>be", "ba>be"].sort());
  const first = r.chains.find((c) => c.steps[0].id === "pay-00");
  assert.equal(first.steps[0].count, 40);
  assert.equal(first.steps[0].members.length, 40);
  for (const c of r.chains) {
    const seen = new Set([A]);
    let at = A;
    for (const s of c.steps) { at = s.from === at ? s.to : s.from; assert.ok(!seen.has(at), `${route(c)} repeats ${at}`); seen.add(at); }
  }
});

test("R30 a limit cuts the list, not the search: listed, found, cut_by_limit, more_may_exist, and no stop recorded", () => {
  const { x } = make(routesWorld());
  const r = ask(x, { limit: 2 });
  assert.equal(r.listed, 2);
  assert.equal(r.found, 3);
  assert.equal(r.cut_by_limit, true);
  assert.equal(r.more_may_exist, true);
  assert.equal(r.stopped, undefined);
  assert.deepEqual(routes(r), ["ab>be", "ac>cd>de"]);
});

test("R30 a hub is never asked for its list: a chain through it is listed with both its steps marked, two hubs beside each other leave it unlisted, and the hub is named", () => {
  const crowd = (hub, n, from) => Array.from({ length: n }, (_, i) => conn("line:part_of", ent(from + i), hub, { id: `crowd-${hub}-${i}` }));
  const bound = 1001;
  // one hub between the ends
  const one = make([conn("line:part_of", A, H, { id: "ah" }), conn("line:part_of", B, H, { id: "bh" }), ...crowd(H, bound, 1000)]);
  const r = one.x.connectionsBetween({ from: A, to: B, at: AT, viewer: V });
  assert.deepEqual(routes(r), ["ah>bh"]);
  assert.deepEqual(r.chains[0].steps.map((s) => s.hub?.node), [H, H]);
  assert.equal(r.chains[0].steps[0].hub.kind, "line:part_of");
  assert.ok(r.chains[0].steps[0].hub.set_size > bound);
  assert.equal(r.hubs.length, 1);
  assert.equal(r.hubs[0].node, H);
  assert.equal(r.more_may_exist, true);
  assert.equal(r.stopped.reason, "hub");
  // two hubs side by side: the step between them is in neither's answer, so the chain through both is absent
  const two = make([conn("line:part_of", A, H, { id: "ah" }), conn("line:part_of", H, G, { id: "hg" }), conn("line:part_of", G, B, { id: "gb" }),
    ...crowd(H, bound, 1000), ...crowd(G, bound, 3000)]);
  const t = two.x.connectionsBetween({ from: A, to: B, at: AT, viewer: V });
  assert.equal(t.found, 0);
  assert.deepEqual(t.hubs.map((h) => h.node).sort(), [G, H].sort());
  assert.equal(t.more_may_exist, true);
  assert.ok(t.absence, "no chain states the level it looked at");
});

/* a seeded generator, so every run builds the same graphs */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

/** the reference: one-direction enumeration of node-simple paths up to the depth, each pair's hops grouped by kind and ends */
function reference(hops, from, to, depth) {
  const pair = new Map();
  for (const h of hops) {
    const k = [h.from, h.to].sort().join("|");
    if (!pair.has(k)) pair.set(k, new Map());
    const g = JSON.stringify([h.kind, h.from, h.to]);
    pair.get(k).set(g, [...(pair.get(k).get(g) ?? []), h.id]);
  }
  const adj = new Map();
  for (const h of hops) for (const [u, v] of [[h.from, h.to], [h.to, h.from]]) { if (!adj.has(u)) adj.set(u, new Set()); adj.get(u).add(v); }
  const out = [];
  const go = (u, seen, steps) => {
    if (steps.length >= depth) return;
    for (const v of adj.get(u) ?? []) {
      if (seen.has(v)) continue;
      const groups = [...pair.get([u, v].sort().join("|")).values()].map((ids) => ids.reduce((a, b) => (a <= b ? a : b)));
      for (const g of groups) {
        if (v === to) out.push([...steps, g].join(">"));
        else go(v, new Set([...seen, v]), [...steps, g]);
      }
    }
  };
  go(from, new Set([from]), []);
  return out;
}

test("R30 over 200 random graphs with no bound hit, the chains equal a reference one-direction enumerator", () => {
  const r = rng(53);
  const kinds = ["line:part_of", "line:reports_to", "payment"];
  let checked = 0;
  for (let g = 0; g < 200; g++) {
    const n = 5 + Math.floor(r() * 4), nodes = Array.from({ length: n }, (_, i) => ent(200 + i));
    const hops = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const copies = r() < 0.28 ? 1 + Math.floor(r() * 2) : 0;
      for (let c = 0; c < copies; c++) { const [u, v] = r() < 0.5 ? [nodes[i], nodes[j]] : [nodes[j], nodes[i]]; hops.push(conn(kinds[Math.floor(r() * 3)], u, v, { id: `h${String(hops.length).padStart(3, "0")}` })); }
    }
    const depth = 2 + Math.floor(r() * 7);
    const { x } = make(hops);
    const got = x.connectionsBetween({ from: nodes[0], to: nodes[n - 1], at: AT, viewer: V, depth, limit: 200 });
    const want = reference(hops, nodes[0], nodes[n - 1], depth);
    assert.equal(got.found, want.length, `graph ${g}`);
    if (want.length <= 200) assert.deepEqual(routes(got).sort(), want.sort(), `graph ${g}`);
    assert.equal(got.stopped?.reason === "time" || got.stopped?.reason === "nodes", false);
    checked += want.length;
  }
  assert.ok(checked > 200, "the graphs hold chains to compare");
});

test("R30 a pair six steps apart is answered whole where a one-direction walk stops at the node bound", () => {
  const conns = [conn("line:part_of", A, B, { id: "s1" }), conn("line:part_of", B, C, { id: "s2" }), conn("line:part_of", C, D, { id: "s3" }),
    conn("line:part_of", E, D, { id: "s4" }), conn("line:part_of", F, E, { id: "s5" }), conn("line:part_of", G, F, { id: "s6" })];
  // A's side fans out to well over the node bound: 40 x 40 x 4 beyond A
  let n = 1000;
  for (let i = 0; i < 40; i++) {
    const mid = ent(n++);
    conns.push(conn("line:belongs_to", A, mid, { id: `f1-${i}` }));
    for (let j = 0; j < 40; j++) {
      const leaf = ent(n++);
      conns.push(conn("line:belongs_to", mid, leaf, { id: `f2-${i}-${j}` }));
      for (let k = 0; k < 4; k++) conns.push(conn("line:belongs_to", leaf, ent(n++), { id: `f3-${i}-${j}-${k}` }));
    }
  }
  const { x } = make(conns);
  const oneWay = x.explore({ from: A, to: G, at: AT, viewer: V, depth: 6 });
  assert.equal(oneWay.paths.length, 0);
  assert.equal(oneWay.truncated, true, "the one-direction walk met the node bound before the sixth level");
  assert.equal(oneWay.visited, BOUNDS.nodes);
  const r = x.connectionsBetween({ from: A, to: G, at: AT, viewer: V, depth: 6 });
  assert.deepEqual(routes(r), ["s1>s2>s3>s4>s5>s6"]);
  assert.equal(r.stopped, undefined);
  assert.ok(r.visited < BOUNDS.nodes);
  assert.equal(r.complete_through_steps, 6);
});

test("R30 a hop the viewer may not see leaves chains, found and visited as if absent; a declared hop is a lead", () => {
  const withHidden = routesWorld().map((c) => (c.id === "ab" ? { ...c, seen_by: ["bob"] } : c));
  const without = routesWorld().filter((c) => c.id !== "ab");
  const a = ask(make(withHidden).x), b = ask(make(without).x);
  assert.deepEqual(strip(a), strip(b));
  assert.deepEqual(routes(a), ["ac>cd>de", "af>fg>gh>he"]);
  const lead = make([conn("proxy_for", A, B, { id: "decl" }), conn("line:part_of", B, E, { id: "be" })]);
  const r = lead.x.connectionsBetween({ from: A, to: E, at: AT, viewer: V });
  assert.equal(r.chains[0].label, "lead");
  assert.equal(r.chains[0].strength.lead, true);
  assert.ok(r.chains[0].lead.sentence);
});

test("R30 a search that finds nothing states its level, and a search stopped by time keeps the chains found whole and says it may have more", () => {
  const { x } = make(routesWorld());
  const none = x.connectionsBetween({ from: A, to: ent(77), at: AT, viewer: V });
  assert.equal(none.found, 0);
  assert.ok(none.absence.state);
  const slow = clocked(routesWorld(), 100);
  const r = ask(slow.x, { budget_ms: 700 });
  assert.equal(r.stopped.reason, "time");
  assert.equal(r.more_may_exist, true);
  assert.ok(r.complete_through_steps < r.depth);
  for (const c of r.chains) assert.equal(c.level_complete, c.step_count <= r.complete_through_steps);
});

test("R31 the most direct chain: the stronger of the fewest steps, how many tie, and the first evidenced one beside a lead", () => {
  // two 2-step chains whose weakest steps are B and C: the B one
  const strong = make([conn("line:part_of", A, B, { id: "x1", grade: { assertion: "B", ends: ["B", "B"] } }), conn("line:part_of", B, E, { id: "x2", grade: { assertion: "A", ends: ["A", "A"] } }),
    conn("line:part_of", A, C, { id: "y1", grade: { assertion: "C", ends: ["B", "B"] } }), conn("line:part_of", C, E, { id: "y2", grade: { assertion: "A", ends: ["A", "A"] } })]);
  const s = strong.x.mostDirect({ from: A, to: E, at: AT, viewer: V });
  assert.deepEqual(s.most_direct.steps.map((z) => z.id), ["x1", "x2"]);
  assert.equal(s.equally_short, 0);
  assert.equal(s.most_direct_evidenced, undefined, "control: an evidenced chain needs no other");
  // two of equal strength, on different dates: the earlier, one tying
  const tie = make([conn("line:part_of", A, B, { id: "p1", valid: valid("2020-01-01", "2030-01-01") }), conn("line:part_of", B, E, { id: "p2", valid: valid("2020-01-01", "2030-01-01") }),
    conn("line:part_of", A, C, { id: "q1", valid: valid("2022-01-01", "2030-01-01") }), conn("line:part_of", C, E, { id: "q2", valid: valid("2022-01-01", "2030-01-01") })]);
  const t = tie.x.mostDirect({ from: A, to: E, at: AT, viewer: V });
  assert.deepEqual(t.most_direct.steps.map((z) => z.id), ["p1", "p2"]);
  assert.equal(t.equally_short, 1);
  // a 2-step chain through a declared step and a 3-step all-evidenced chain
  const lead = make([conn("proxy_for", A, B, { id: "d1" }), conn("line:part_of", B, E, { id: "d2" }), conn("line:part_of", A, C, { id: "e1" }), conn("line:part_of", C, D, { id: "e2" }), conn("line:part_of", D, E, { id: "e3" })]);
  const l = lead.x.mostDirect({ from: A, to: E, at: AT, viewer: V });
  assert.deepEqual(l.most_direct.steps.map((z) => z.id), ["d1", "d2"]);
  assert.equal(l.most_direct.label, "lead");
  assert.deepEqual(l.most_direct_evidenced.steps.map((z) => z.id), ["e1", "e2", "e3"]);
  // a lead with nothing evidenced beside it
  const only = make([conn("proxy_for", A, B, { id: "d1" }), conn("line:part_of", B, E, { id: "d2" })]).x.mostDirect({ from: A, to: E, at: AT, viewer: V });
  assert.equal(only.most_direct_evidenced, null);
  assert.equal(only.searched.complete, true);
  // no key says a score, a rank or a centre
  assert.doesNotMatch(JSON.stringify([s, t, l, only]), /"(score|rank|central)[a-z_]*"/i);
});

test("R31 a search that runs out of time before the first meeting level is complete answers null, undetermined, with the stop; refusals are R30's", () => {
  const long = [];
  const ids = [A, B, C, D, E, F, G, H];
  for (let i = 0; i + 1 < ids.length; i++) long.push(conn("line:part_of", ids[i], ids[i + 1], { id: `l${i}` }));
  const slow = clocked(long, 100);
  const r = slow.x.mostDirect({ from: A, to: H, at: AT, viewer: V, budget_ms: 300 });
  assert.equal(r.most_direct, null);
  assert.equal(r.undetermined, true);
  assert.equal(r.stopped.reason, "time");
  assert.equal(r.more_may_exist, true);
  const fast = clocked(long, 1).x.mostDirect({ from: A, to: H, at: AT, viewer: V });
  assert.equal(fast.most_direct.step_count, 7);
  assert.equal(fast.stopped, undefined);
  const { x } = make(long);
  assert.equal(x.mostDirect({ from: A, to: A, at: AT, viewer: V }).refused, "EXPLORE_SAME_END");
  assert.equal(x.mostDirect({ from: A, to: H, at: AT, viewer: V, budget_ms: 10001 }).refused, "BUDGET_OUT_OF_RANGE");
  assert.equal(x.mostDirect({ from: A, to: H, at: AT, viewer: V, limit: 0 }).refused, undefined, "no limit is read");
});

const own = (id, kind, from, to) => ({ id, kind, from, to });
test("R32 shorter chains beside a member's own: cited alternatives, leads apart, equal length in neither, and the member's chain left alone", () => {
  const { x } = make([...routesWorld(), conn("proxy_for", A, D, { id: "decl" })]);
  const mine = [own("ac", "line:reports_to", A, C), own("cd", "line:reports_to", C, D), own("de", "line:funds", D, E)];
  const r = x.shorterThan({ chain: mine, at: AT, viewer: V });
  assert.equal(r.ok, true);
  assert.equal(r.chain_steps, 3);
  assert.deepEqual(r.shorter.evidenced.map(route), ["ab>be"]);
  assert.equal(r.fewest_steps, 2);
  assert.ok(r.shorter.evidenced[0].steps.every((s) => s.grade && s.members.every((m) => m.evidence.length)), "each step is graded and each member cites");
  assert.deepEqual(r.shorter.leads.map(route), ["decl>de"], "an alternative through a declared step is a lead, apart from the evidenced ones");
  assert.equal(r.shorter.leads[0].label, "lead");
  assert.equal(r.complete, true);
  assert.ok(r.searched.kinds.length && r.searched.depth === 2 && Array.isArray(r.searched.hubs));
  // a chain already the most direct: empty lists and what was searched
  const direct = x.shorterThan({ chain: [own("ab", "line:part_of", A, B), own("be", "line:part_of", B, E)], at: AT, viewer: V });
  assert.deepEqual(direct.shorter, { evidenced: [], leads: [] });
  assert.equal(direct.fewest_steps, null);
  assert.ok(direct.searched.depth >= 1);
  // a one-hop chain answers empty lists
  const one = x.shorterThan({ chain: [own("pay", "payment", A, E)], at: AT, viewer: V });
  assert.deepEqual(one.shorter, { evidenced: [], leads: [] });
  // an equal-length alternative is in neither
  const equal = x.shorterThan({ chain: [own("ab", "line:part_of", A, B), own("be", "line:part_of", B, E)], at: AT, viewer: V });
  assert.equal(JSON.stringify(equal.shorter).includes("ac"), false);
  assert.doesNotMatch(JSON.stringify(r), /(better|worse|wrong|roundabout)/i);
});

test("R32 the member's chain is checked first: invalid, without ends, gapped; exploreverify keeps its own refusals", () => {
  const { x } = make(routesWorld());
  const ok = [own("ac", "line:reports_to", A, C), own("cd", "line:reports_to", C, D)];
  assert.equal(x.shorterThan({ chain: [], at: AT, viewer: V }).refused, "OWN_CHAIN_INVALID");
  assert.equal(x.shorterThan({ chain: Array.from({ length: 11 }, (_, i) => own(`h${i}`, "line:part_of", A, B)), at: AT, viewer: V }).refused, "OWN_CHAIN_INVALID");
  assert.equal(x.shorterThan({ chain: [{ kind: "line:part_of", from: A, to: B }], at: AT, viewer: V }).refused, "OWN_CHAIN_INVALID");
  assert.equal(x.shorterThan({ chain: [own("a", "line:part_of", A, B), own("b", "line:part_of", B, A)], at: AT, viewer: V }).refused, "OWN_CHAIN_INVALID", "the ends are told apart");
  const noTo = x.shorterThan({ chain: [own("ac", "line:reports_to", A, C), { id: "cd", kind: "line:reports_to", from: C }], at: AT, viewer: V });
  assert.equal(noTo.refused, "OWN_CHAIN_NO_ENDS");
  assert.match(noTo.why, /cd/);
  const gap = x.shorterThan({ chain: [...ok, own("fg", "line:oversees", F, G)], at: AT, viewer: V });
  assert.equal(gap.refused, "OWN_CHAIN_GAPPED");
  assert.match(gap.why, /fg/);
  assert.equal(x.shorterThan({ chain: ok, viewer: V }).refused, "NO_DATE");
  assert.equal(x.shorterThan({ chain: ok, at: AT }).refused, "VIEWER_MISSING");
  assert.equal(x.shorterThan({ chain: ok, at: AT, viewer: V, limit: 201 }).refused, "CHAIN_LIMIT_OVER_MAX");
  // control: exploreverify's BAD_CHAIN and CHAIN_BROKEN answer as before
  assert.equal(x.rederive({ chain: [], viewer: V }).refused, "BAD_CHAIN");
  assert.equal(x.rederive({ chain: [{ id: "ab", kind: "line:part_of", owner: "lines", from: A, to: B }, { id: "fg", kind: "line:oversees", owner: "lines", from: F, to: G }], viewer: V }).refused, "CHAIN_BROKEN");
});

/* a chain of nine records, read slowly on a fake clock, so that a search needs several slices */
const slowChain = () => {
  const ids = Array.from({ length: 9 }, (_, i) => ent(300 + i));
  const conns = [];
  for (let i = 0; i + 1 < ids.length; i++) conns.push(conn("line:part_of", ids[i], ids[i + 1], { id: `k${i}` }));
  conns.push(conn("line:reports_to", ids[0], ids[3], { id: "short" }), conn("line:reports_to", ids[3], ids[8], { id: "short2" }));
  return { ids, conns };
};

test("R33 a stop by time offers a token; continuing twice ends with the chains one call with the full budget answers, in the same order", () => {
  const { ids, conns } = slowChain();
  const args = { from: ids[0], to: ids[8], at: AT, viewer: V };
  const whole = clocked(conns, 10).x.connectionsBetween({ ...args, budget_ms: 10000 });
  assert.equal(whole.stopped, undefined);
  const slow = clocked(conns, 10);
  let r = slow.x.connectionsBetween({ ...args, budget_ms: 250 });
  assert.equal(r.stopped.reason, "time");
  assert.equal(r.more_may_exist, true);
  assert.equal(r.resumable, true);
  assert.equal(typeof r.resume, "string");
  assert.ok(r.chains.every((c) => c.steps.length && c.grade), "the chains of the first slice are whole");
  assert.equal(r.slice, 1);
  let slices = 1;
  while (r.resume && slices < 20) { r = slow.x.continueWalk({ resume: r.resume, budget_ms: 250, viewer: V }); slices++; assert.equal(r.slice, slices); }
  assert.ok(slices >= 3, "the search needed three slices");
  assert.equal(r.resume, undefined, "control: a search that finishes carries no token");
  assert.deepEqual(routes(r), routes(whole));
  assert.deepEqual(r.chains.map((c) => c.level_complete), whole.chains.map((c) => c.level_complete));
  assert.equal(r.found, whole.found);
  assert.equal(whole.resume, undefined);
});

test("R33 a changed token, another member's, an old one and none are refused, writing nothing; most direct and shorter ones continue too", () => {
  const { ids, conns } = slowChain();
  const slow = clocked(conns, 10);
  const r = slow.x.connectionsBetween({ from: ids[0], to: ids[8], at: AT, viewer: V, budget_ms: 250 });
  const flip = (t) => t.slice(0, 20) + (t[20] === "A" ? "B" : "A") + t.slice(21);
  assert.equal(slow.x.continueWalk({ resume: flip(r.resume), viewer: V }).refused, "BAD_RESUME");
  assert.equal(slow.x.continueWalk({ resume: "not a token", viewer: V }).refused, "BAD_RESUME");
  assert.equal(slow.x.continueWalk({ resume: r.resume, viewer: "mallory" }).refused, "RESUME_OTHER_VIEWER");
  assert.equal(slow.x.continueWalk({ viewer: V }).refused, "NO_RESUME");
  assert.equal(slow.x.continueWalk({ resume: r.resume }).refused, "VIEWER_MISSING");
  assert.equal(slow.x.continueWalk({ resume: r.resume, viewer: V, budget_ms: 10001 }).refused, "BUDGET_OUT_OF_RANGE");
  const fifteen = 15 * 60 * 1000;
  slow.clock.t += fifteen - 60000;
  assert.equal(slow.x.continueWalk({ resume: r.resume, viewer: V, budget_ms: 250 }).refused, undefined, "at 14 minutes it still continues");
  slow.clock.t += 2 * 60000;
  assert.equal(slow.x.continueWalk({ resume: r.resume, viewer: V }).refused, "RESUME_EXPIRED");
  // the most direct and the shorter ones are continued as themselves
  const p = clocked(conns, 10);
  let d = p.x.mostDirect({ from: ids[0], to: ids[8], at: AT, viewer: V, budget_ms: 120 });
  assert.equal(d.stopped?.reason, "time");
  for (let i = 0; d.resume && i < 20; i++) d = p.x.continueWalk({ resume: d.resume, budget_ms: 120, viewer: V });
  assert.equal(d.most_direct.step_count, 2);
  assert.ok("equally_short" in d);
  const mine = [own("k0", "line:part_of", ids[0], ids[1]), own("k1", "line:part_of", ids[1], ids[2]), own("k2", "line:part_of", ids[2], ids[3]), own("k3", "line:part_of", ids[3], ids[4]), own("k4", "line:part_of", ids[4], ids[5]), own("k5", "line:part_of", ids[5], ids[6]), own("k6", "line:part_of", ids[6], ids[7]), own("k7", "line:part_of", ids[7], ids[8])];
  const sh = clocked(conns, 10);
  let s = sh.x.shorterThan({ chain: mine, at: AT, viewer: V, budget_ms: 150 });
  assert.equal(s.stopped?.reason, "time");
  for (let i = 0; s.resume && i < 30; i++) s = sh.x.continueWalk({ resume: s.resume, budget_ms: 150, viewer: V });
  assert.equal(s.complete, true);
  assert.ok(s.shorter.evidenced.length >= 1);
});

test("R34 the four ops take their own budget: 1,500 ms by default, up to 10,000, an instance's lower budget still lowers it; the others keep 10,000", () => {
  const { conns, ids } = slowChain();
  const args = { from: ids[0], to: ids[8], at: AT, viewer: V };
  const dflt = clocked(conns, 100).x.connectionsBetween(args);
  assert.equal(dflt.budget_ms, 1500);
  assert.equal(dflt.stopped.reason, "time");
  const wide = clocked(conns, 100).x.connectionsBetween({ ...args, budget_ms: 10000 });
  assert.equal(wide.budget_ms, 10000);
  assert.equal(wide.stopped, undefined);
  assert.equal(clocked(conns, 100).x.connectionsBetween({ ...args, budget_ms: 10001 }).refused, "BUDGET_OUT_OF_RANGE");
  assert.equal(clocked(conns, 100).x.connectionsBetween({ ...args, budget_ms: 1.5 }).refused, "BUDGET_OUT_OF_RANGE");
  const low = clocked(conns, 100, { budget_ms: 25 }).x.connectionsBetween({ ...args, budget_ms: 5000 });
  assert.equal(low.budget_ms, 25);
  assert.equal(low.stopped.reason, "time");
  const old = clocked(conns, 1).x.explore({ from: ids[0], at: AT, viewer: V });
  assert.equal(old.budget_ms, BOUNDS.time_budget_ms, "explore keeps its 10,000 ms and takes no budget argument");
  // two paths of equal length differing in strength are ordered by strength
  const { x } = make([conn("line:part_of", A, B, { id: "w1", grade: { assertion: "C", ends: ["B", "B"] } }), conn("line:part_of", B, E, { id: "w2" }), conn("line:part_of", A, C, { id: "s1" }), conn("line:part_of", C, E, { id: "s2" })]);
  assert.deepEqual(x.explore({ from: A, to: E, at: AT, viewer: V }).paths.map((p) => p.hops.map((h) => h.id).join(">")), ["s1>s2", "w1>w2"]);
});

/* the door's declarations of the four ops (R35), held as the door runs them */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes) => (answer, field) => !!answer && typeof answer === "object" && (codes[field] ?? []).some((c) => answer.refused === c || answer.code === c);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y) || (x && y && (x.refused ?? x.code) === (y.refused ?? y.code) && x.ok === y.ok);
const call = (op) => async (given) => {
  const { x } = make(routesWorld());
  const q = new URLSearchParams({ op, viewer: V });
  const url = new URL("http://x/?" + q);
  return await exploreOps(x, url, given)[op]();
};
const chainValue = [own("ab", "line:part_of", A, B), own("be", "line:part_of", B, E)];

for (const [op, refusedNaming, values] of [
  ["exploreall", { from: ["NO_NODE"], to: ["EXPLORE_NO_END"], at: ["NO_DATE"] }, { from: A, to: E, at: AT }],
  ["explorepath", { from: ["NO_NODE"], to: ["EXPLORE_NO_END"], at: ["NO_DATE"] }, { from: A, to: E, at: AT }],
  ["exploreshorter", { chain: ["OWN_CHAIN_INVALID"], at: ["NO_DATE"] }, { chain: chainValue, at: AT }],
  ["explorecontinue", { resume: ["NO_RESUME"] }, { resume: "x" }],
]) {
  test(`R35 explore declares ${op}: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused`, async () => {
    assert.equal(DECLARED_OPS[op].mutating, false);
    assert.deepEqual(DECLARED_OPS[op].classes, ["admin", "member", "probe"]);
    assert.equal(DECLARED_OPS[op].weight, "read");
    await declaredOpHolds({ op, declaration: DECLARED_OPS[op], call: call(op), refusedNaming: named(refusedNaming), values, same });
  });
}

test("R35 control: the rows declared before are unchanged", () => {
  assert.deepEqual(Object.keys(DECLARED_OPS).slice(0, 3), ["explore", "explorepreset", "exploreverify"]);
  assert.deepEqual(DECLARED_OPS.explore.fields, { accepts: ["from", "to", "kinds", "at", "depth", "sortBy", "scope"], requires: ["from", "at"] });
  assert.deepEqual(DECLARED_OPS.exploreall.fields.accepts, ["from", "to", "kinds", "at", "depth", "scope", "limit", "budget_ms"]);
  assert.equal(DECLARED_OPS.explorepath.fields.accepts.includes("limit"), false);
  void words; void ZONE; void makeStore; void makeOwner;
});

/* R36 over money's real owner (money's own test world): each of the five families is walked by flowsFrom, money_flow is no kind */
const FAMILIES = ["money_transfer", "money_payment", "money_contribution", "money_revenue", "money_other"];
const moneyWorld = () => {
  const s = seeded();
  const ids = {
    money_transfer: s.rec({ kind: "transfer", from: { entity: s.city, fund: s.general }, to: { entity: s.vendor }, amount: "90", as_read: "$90" }),
    money_payment: s.rec({}),
    money_contribution: s.rec({ kind: "gift", amount: "50", as_read: "$50" }),
    money_revenue: s.rec({ kind: "revenue", stage: "collected", amount: "80", as_read: "$80" }),
    money_other: s.rec({ kind: "debt", stage: "incurred", amount: "70", as_read: "$70" }),
  };
  return { s, ids, at: { value: "2014-03-01", precision: "day", zone: MZONE }, x: exploreOf(s.host) };
};

test("R36 flowsFrom walks each of the five money families, payer to payee, and its kind set is the five", () => {
  const { s, ids, at, x } = moneyWorld();
  assert.deepEqual([...x.presets().find((p) => p.name === "flowsFrom").kinds].sort(), [...FAMILIES].sort());
  const f = x.flowsFrom({ from: s.city, at, viewer: ANN });
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 400));
  const one = Object.fromEntries(f.paths.filter((p) => p.hops.length === 1).map((p) => [p.hops[0].id, p.hops[0]]));
  for (const k of FAMILIES) {
    const h = one[ids[k]];
    assert.ok(h, `${k}: the fact is walked by flowsFrom`);
    assert.deepEqual([h.kind, h.owner, h.from, h.to], [k, "money", s.city, s.vendor]);
  }
  for (const k of FAMILIES) {
    const r = x.explore({ from: s.city, at, viewer: ANN, depth: 1, kinds: [k] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.paths.map((p) => p.hops[0].id), [ids[k]], `${k} alone answers its own fact only`);
  }
  assert.equal(x.flowsFrom({ from: s.vendor, at, viewer: ANN }).paths.length, 0, "nothing flows out of the payee");
});

test("R36 money_flow is no longer a kind: explore with it is refused UNKNOWN_KIND and no preset names it", () => {
  const { s, at, x } = moneyWorld();
  assert.equal(defaultRegistry.kindOf("money_flow"), null);
  assert.equal(x.explore({ from: s.city, at, viewer: ANN, kinds: ["money_flow"] }).refused, "UNKNOWN_KIND");
  assert.ok(x.presets().every((p) => !p.kinds.includes("money_flow")));
});

test("R36 control: R16, R17 and R35 answer as before over the five families", () => {
  const { s, at, x } = moneyWorld();
  const f = x.flowsFrom({ from: s.city, at, viewer: ANN });
  /* R16: no answer asserts a connection beyond the cited hops, and no outward word of the five says what R16 forbids */
  assert.equal(f.note, x.explore({ from: s.city, at, viewer: ANN }).note);
  for (const k of FAMILIES) for (const bad of ["knows", "network", "conflict", "suspicious", "most connected"]) assert.equal(String(defaultRegistry.kindOf(k).word).toLowerCase().includes(bad), false, `${k}: ${bad}`);
  for (const k of FAMILIES) assert.equal(defaultRegistry.kindOf(k).class, "evidentiary", `${k} is evidentiary, never a declared relation (R17)`);
  assert.ok(f.paths.length >= 5 && f.paths.every((p) => p.label === "evidenced" && !p.lead && p.grade), "each money path is evidenced and graded, never a lead (R17)");
  /* R35: the declared rows are unchanged */
  assert.deepEqual(DECLARED_OPS.explorepreset.fields, { accepts: ["preset", "from", "to", "event", "at", "period", "depth", "a", "b", "kinds"], requires: ["preset"] });
  assert.deepEqual(Object.keys(DECLARED_OPS), ["explore", "explorepreset", "exploreverify", ...Object.keys(DECLARED_OPS).slice(3)]);
  for (const op of ["exploreall", "explorepath", "exploreshorter", "explorecontinue"]) assert.equal(DECLARED_OPS[op].mutating, false);
});
