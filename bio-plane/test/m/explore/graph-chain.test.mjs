/* explore at its interface, T48 (T48-24): the connection graph's read (R21), a walk stopped at its depth (R22),
   `exploreverify` over a chain (R23), a declared step walked as its attached source (R24), and the ops that carry them
   (R14). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { exploreOf, exploreOps, STOPPED_SENTENCE, DEPTH_SENTENCE, AT_DEPTH_MAX, LEAD_SENTENCE } from "../../../src/explore/index.mjs";
import { nodeRefusal } from "../../../src/explore/answer.mjs";
import { stepNeitherWhy, sharesNoRecordWhy } from "../../../src/explore/rederive.mjs";
import { DECLARED_LABEL, LOWEST_GRADE, hubBoundOf } from "../../../src/connection-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { AT, INQUIRY, ZONE, ent, evt, conn, world, byOwner, makeStore } from "./fixtures/owners.mjs";

const V = "alice";
const A = ent(1), B = ent(2), C = ent(3), D = ent(4), E = ent(5);
const make = (conns, o = {}) => { const w = world(byOwner(conns), o); return { ...w, x: exploreOf(null, { registry: w.registry, ...(o.ctx ?? {}) }) }; };
const ids = (p) => p.hops.map((h) => h.id).join(">");
const strip = (r) => ({ ...r, elapsed_ms: 0, owner_calls: 0 });
const FORBIDDEN = ["knows", "network", "conflict", "suspicious", "most connected"];

test("R21 the connection graph: a centre with a person one ring out and an organisation two rings out answers three nodes, two steps with their words, grades and citations, and the organisation stopped at the ring", () => {
  const person = conn("line:belongs_to", A, B, { id: "a-b", grade: { assertion: "B", ends: ["A", "B"] } });
  const org = conn("line:seat_on", B, C, { id: "b-c", grade: { assertion: "C", ends: ["B", "C"] } });
  const { x } = make([person, org, conn("line:part_of", C, D, { id: "c-d" })]);
  const g = x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.equal(g.ok, true);
  assert.equal(g.centre, A);
  assert.deepEqual(g.at, AT);
  assert.equal(g.rings, 2, "two rings by default");
  assert.deepEqual(g.nodes, [A, B, C].map((id, ring) => ({ id, ring, id_kind: "ENT", label: null, entity_kind: null })));
  assert.deepEqual(g.steps.map((s) => [s.id, s.from, s.to, s.kind, s.word, s.class]), [["a-b", A, B, "line:belongs_to", "belongs to", "evidentiary"], ["b-c", B, C, "line:seat_on", "seat on", "evidentiary"]]);
  assert.deepEqual(g.steps.map((s) => s.grade), [person.grade, org.grade], "each step's grade as its owner answered it");
  assert.deepEqual(g.steps.map((s) => s.evidence), [person.evidence, org.evidence], "each step's citation as its owner answered it");
  assert.deepEqual(g.steps.map((s) => s.valid), [person.valid, org.valid]);
  assert.ok(g.steps.every((s) => s.label === undefined && s.undetermined === undefined));
  assert.deepEqual(g.stopped, [{ node: C, why: "ring" }], "the organisation's own steps were not walked");
  assert.equal(g.stopped_sentence, STOPPED_SENTENCE);
  assert.equal(STOPPED_SENTENCE, word("explore.stopped_sentence"));
  assert.ok(!JSON.stringify(g).includes("c-d"), "beyond the outer ring nothing is answered");
  for (const k of ["visited", "budget_ms", "elapsed_ms"]) assert.equal(typeof g[k], "number", k);
  assert.equal(g.visited, 3);
  // One ring: the person, stopped at the ring.
  const one = x.neighbourhood({ centre: A, at: AT, viewer: V, rings: 1 });
  assert.deepEqual([one.nodes.map((n) => n.id), one.steps.map((s) => s.id), one.stopped], [[A, B], ["a-b"], [{ node: B, why: "ring" }]]);
});

test("R21 R7 control: a step withheld from the viewer leaves nodes, steps and visited as if it were never held", () => {
  const open = conn("line:belongs_to", A, B, { id: "open" });
  const fenced = [conn("line:belongs_to", A, C, { id: "fenced", seen_by: ["carol"] }), conn("line:seat_on", C, D, { id: "behind" })];
  const alice = make([open, ...fenced]).x.neighbourhood({ centre: A, at: AT, viewer: V });
  const none = make([open]).x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(strip(alice), strip(none));
  for (const s of ["fenced", "behind", C, D]) assert.ok(!JSON.stringify(alice).includes(s), s);
  const carol = make([open, ...fenced]).x.neighbourhood({ centre: A, at: AT, viewer: "carol" });
  assert.deepEqual(carol.nodes.map((n) => n.id), [A, C, B, D], "in the order of the paths: the step `fenced` sorts before `open`");
  assert.equal(carol.visited, 4);
});

test("R21 refusals in R1's order with the centre in from's place, then BAD_RINGS; a missing viewer fails closed first", () => {
  const { x } = make([conn("line:belongs_to", A, B)]);
  assert.equal(x.neighbourhood({ centre: A, at: AT }).refused, "VIEWER_MISSING");
  const no = x.neighbourhood({ at: AT, viewer: V });
  assert.equal(no.refused, "NO_NODE");
  assert.equal(no.why, nodeRefusal(undefined, "centre", true).why);
  assert.equal(x.neighbourhood({ centre: "not-an-id", viewer: V, rings: 9 }).refused, "BAD_NODE");
  assert.equal(x.neighbourhood({ centre: A, viewer: V, kinds: ["nope"], rings: 9 }).refused, "NO_DATE");
  assert.equal(x.neighbourhood({ centre: A, at: { value: "2026-02-31", precision: "day", zone: ZONE }, viewer: V }).refused, "BAD_DATE");
  const k = x.neighbourhood({ centre: A, at: AT, viewer: V, kinds: ["nope"], rings: 9 });
  assert.equal(k.refused, "UNKNOWN_KIND");
  assert.match(k.why, /nope/);
  for (const rings of [0, 3, "2", 1.5, -1]) assert.equal(x.neighbourhood({ centre: A, at: AT, viewer: V, rings }).refused, "BAD_RINGS", String(rings));
  for (const rings of [1, 2, null, undefined]) assert.equal(x.neighbourhood({ centre: A, at: AT, viewer: V, rings }).ok, true, String(rings));
  for (const r of [no, k]) assert.ok(r.why.length > 10);
});

test("R21 R2 R3 it is the one walk to depth `rings`: each step once even when reached from both ends, nodes and steps in the order of the paths that reach them, never ranked or scored", () => {
  const conns = [
    conn("line:belongs_to", A, B, { id: "s1" }), conn("line:belongs_to", A, C, { id: "s2" }),
    conn("line:seat_on", B, D, { id: "s3" }), conn("line:seat_on", C, D, { id: "s4" }), conn("event_voted", A, evt(1), { id: "s5" }),
  ];
  const { x } = make(conns);
  const g = x.neighbourhood({ centre: A, at: AT, viewer: V });
  const walked = x.explore({ from: A, at: AT, viewer: V, depth: 2 });
  const order = [];
  for (const p of walked.paths) for (const h of p.hops) if (!order.includes(h.id)) order.push(h.id);
  assert.deepEqual(g.steps.map((s) => s.id), order, "steps in the walk's path order, each once");
  assert.equal(new Set(g.steps.map((s) => s.id)).size, g.steps.length);
  assert.deepEqual(g.steps.map((s) => s.id).sort(), ["s1", "s2", "s3", "s4", "s5"], "D reached from both B and C: both steps answered");
  assert.equal(g.nodes.filter((n) => n.id === D).length, 1, "a node reached from both ends once");
  assert.deepEqual(g.nodes.find((n) => n.id === evt(1)), { id: evt(1), ring: 1, id_kind: "EVT", label: null, entity_kind: null }, "the id's kind as the id grammar reads it");
  assert.equal(g.visited, walked.visited);
  assert.deepEqual(g.stopped.filter((s) => s.why === "ring").map((s) => s.node), [D]);
  // Kinds limit the walk as R2's do.
  const lines = x.neighbourhood({ centre: A, at: AT, viewer: V, kinds: ["line:belongs_to"] });
  assert.deepEqual(lines.steps.map((s) => s.id), ["s1", "s2"]);
  for (const s of g.steps) for (const key of Object.keys(s)) assert.ok(!/score|rank|centrality|weight/i.test(key), key);
  for (const n of g.nodes) for (const key of Object.keys(n)) assert.ok(!/score|rank|centrality|weight|degree/i.test(key), key);
  const text = JSON.stringify(g).toLowerCase();
  for (const w of FORBIDDEN) assert.ok(!text.includes(w), w);
});

test("R21 R6 R4 a declared step is labelled declared at the lowest grade, a hunch labelled a hunch with no grade and only within its inquiry, a derived step carries its derivation, an undetermined step is marked", () => {
  const conns = [
    conn("member_of", A, B, { id: "decl" }), conn("hunch_tie", A, C, { id: "hun" }), conn("mentioned_together", A, D),
    conn("line:seat_on", A, E, { id: "open-end", valid: { from: "2025-01-01", to: null, precision: "day", zone: ZONE } }),
  ];
  const { x } = make(conns);
  const g = x.neighbourhood({ centre: A, at: AT, viewer: V, scope: { inquiry: INQUIRY } });
  const by = Object.fromEntries(g.steps.map((s) => [s.kind, s]));
  assert.deepEqual([by.member_of.label, by.member_of.grade, by.member_of.word], [DECLARED_LABEL, { assertion: LOWEST_GRADE, ends: [LOWEST_GRADE, LOWEST_GRADE] }, "grouped under"]);
  assert.deepEqual([by.hunch_tie.label, by.hunch_tie.grade], ["hunch", null]);
  assert.deepEqual(by.mentioned_together.derived, conns[2].derived);
  assert.equal(by["line:seat_on"].undetermined.why.key, "civil-time.end_stated");
  const out = x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.ok(!out.steps.some((s) => s.kind === "hunch_tie"), "no hunch without its inquiry");
  assert.equal(x.neighbourhood({ centre: A, at: AT, viewer: V, scope: "x" }).refused, "BAD_SCOPE");
});

test("R21 R5 R20 every place the walk stopped short is named: a hub with its kind, bound and set size, a fan-out cut, the node bound, the time budget", () => {
  // A hub one ring out, judged per kind.
  const hub = [conn("line:belongs_to", A, B, { id: "to-hub" })];
  for (let i = 0; i < 1001; i++) hub.push(conn("line:holds:employee", ent(2000 + i), B));
  const h = make(hub).x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(h.stopped.filter((s) => s.why === "hub"), [{ node: B, why: "hub", kind: "line:holds:employee", bound: hubBoundOf("line:holds:employee"), set_size: 1001 }]);
  assert.equal(h.stopped_sentence, STOPPED_SENTENCE);
  assert.equal(h.complete, false);
  // A fan-out an owner pages beyond the kind's bound.
  const many = [];
  for (let i = 0; i < 1100; i++) many.push(conn("line:part_of", A, ent(3000 + i)));
  const f = make(many, { opts: { lines: { noHub: true, pageSize: 1000 } } }).x.neighbourhood({ centre: A, at: AT, viewer: V, rings: 1 });
  assert.deepEqual(f.stopped.filter((s) => s.why === "fanout"), [{ node: A, why: "fanout", kind: "line:part_of", bound: 1000 }]);
  assert.equal(f.nodes.length, 1001);
  // The node bound.
  const wide = [];
  for (let i = 0; i < 6; i++) {
    const mid = ent(10 + i);
    wide.push(conn("line:part_of", A, mid));
    for (let j = 0; j < 999; j++) wide.push(conn("line:seat_on", mid, ent(20000 + i * 1000 + j)));
  }
  const n = make(wide).x.neighbourhood({ centre: A, at: AT, viewer: V });
  const nodesStop = n.stopped.filter((s) => s.why === "nodes");
  assert.equal(nodesStop.length, 1);
  assert.ok(nodesStop[0].node.startsWith("ENT-"));
  assert.deepEqual([n.truncated, n.undetermined, n.visited], [true, true, 5000]);
  // The time budget.
  let clock = 0;
  const { registry } = make([conn("line:belongs_to", A, B), conn("line:seat_on", B, C)]);
  const t = exploreOf(null, { registry, now: () => (clock += 10), budget_ms: 25 }).neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(t.stopped.filter((s) => s.why === "time").length, 1);
  assert.equal(t.budget_ms, 25);
  assert.match(t.why, /time budget/);
});

test("R21 R9 the graph's read writes nothing", () => {
  const store = makeStore();
  const { x, registry } = make([conn("line:belongs_to", A, B), conn("member_of", B, C), conn("hunch_tie", A, D)], { store });
  const before = store.snapshot(), owners = JSON.stringify(registry.owners());
  x.neighbourhood({ centre: A, at: AT, viewer: V, scope: { inquiry: INQUIRY } });
  x.neighbourhood({ centre: B, at: AT, viewer: V, rings: 1 });
  assert.equal(store.snapshot(), before);
  assert.equal(JSON.stringify(registry.owners()), owners);
});

test("R22 a walk stopped at its depth says so: a three-hop chain walked to depth 2 answers depth_stopped naming the second node, with the sentence; control: walked past its end, false", () => {
  const log = [];
  const opts = { lines: { log } };
  const chain = [conn("line:part_of", A, B, { id: "ab" }), conn("line:part_of", B, C, { id: "bc" }), conn("line:part_of", C, D, { id: "cd" })];
  const { x } = make(chain, { opts });
  const two = x.explore({ from: A, at: AT, viewer: V, depth: 2 });
  assert.equal(two.depth_stopped, true);
  assert.deepEqual(two.at_depth, [C]);
  assert.equal(two.at_depth_truncated, undefined);
  assert.equal(two.depth_sentence, DEPTH_SENTENCE);
  assert.equal(DEPTH_SENTENCE, word("explore.depth_sentence"));
  assert.ok(!log.some((c) => c.node === C), "the node at the depth was not asked about");
  assert.ok(!JSON.stringify(two).includes("cd"), "nothing says it has further steps");
  const past = x.explore({ from: A, at: AT, viewer: V, depth: 4 });
  assert.equal(past.depth_stopped, false);
  assert.equal(past.at_depth, undefined);
  assert.equal(past.depth_sentence, undefined);
  // At depth 3 the chain's end lies at the depth and was not asked: the walk cannot say it ends there.
  log.length = 0;
  const three = x.explore({ from: A, at: AT, viewer: V, depth: 3 });
  assert.deepEqual([three.depth_stopped, three.at_depth], [true, [D]]);
  assert.ok(!log.some((c) => c.node === D));
  // The requirement's own case (K3243): a chain of three nodes, two steps, walked to depth 2 names the far node; to depth 3, false.
  const short = make([conn("line:part_of", A, B, { id: "ab" }), conn("line:part_of", B, C, { id: "bc" })]).x;
  assert.deepEqual([short.explore({ from: A, at: AT, viewer: V, depth: 2 }).depth_stopped, short.explore({ from: A, at: AT, viewer: V, depth: 2 }).at_depth], [true, [C]]);
  assert.equal(short.explore({ from: A, at: AT, viewer: V, depth: 3 }).depth_stopped, false);
  // A walk that runs out of steps before its depth: false.
  assert.equal(make([conn("line:part_of", A, B)]).x.explore({ from: A, at: AT, viewer: V, depth: 3 }).depth_stopped, false);
});

test("R22 its presets and the graph's read say so too; at most 500 nodes are named, at_depth_truncated past that; with `to`, a walk that found its end before the depth is not stopped there", () => {
  const chain = [conn("line:part_of", A, B, { id: "ab" }), conn("line:reports_to", B, C, { id: "bc" }), conn("line:part_of", C, D, { id: "cd" })];
  const { x } = make(chain);
  const c = x.chain({ from: A, at: AT, viewer: V });
  assert.equal(c.depth_stopped, false, "the chain ends before depth 8");
  const pb = x.pathBetween({ from: A, to: C, at: AT, viewer: V, depth: 2 });
  assert.deepEqual([pb.depth_stopped, pb.at_depth], [true, [C]]);
  assert.equal(x.pathBetween({ from: A, to: B, at: AT, viewer: V, depth: 3 }).depth_stopped, false, "the end found at depth 1 stops the walk there");
  const g = x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual([g.depth_stopped, g.at_depth, g.depth_sentence], [true, [C], DEPTH_SENTENCE]);
  assert.equal(x.flowsFrom({ from: A, at: AT, viewer: V }).depth_stopped, false);
  assert.equal(x.relationsOf({ event: evt(1), at: AT, viewer: V }).depth_stopped, false);
  // Past 500.
  const wide = [];
  for (let i = 0; i < AT_DEPTH_MAX + 20; i++) wide.push(conn("line:seat_on", A, ent(4000 + i)));
  const w = make(wide).x.explore({ from: A, at: AT, viewer: V, depth: 1 });
  assert.equal(w.depth_stopped, true);
  assert.equal(w.at_depth.length, AT_DEPTH_MAX);
  assert.equal(w.at_depth_truncated, true);
  assert.deepEqual(w.at_depth, w.paths.slice(0, AT_DEPTH_MAX).map((p) => p.hops[0].to), "in the order of their paths");
});

/** A derived step and an evidentiary one, sharing B. */
function chainWorld(extra = []) {
  const declared = conn("member_of", B, C, { id: "decl" });
  const d = conn("mentioned_together", A, B, { as_of: "2026-02-01", method: "co-mention", inputs: [{ source: "INFO-2026-0001-a-source" }] });
  const ev = conn("line:part_of", B, C, { id: "LIN-2026-00000000000000ev" });
  const hunch = conn("hunch_tie", C, D, { id: "HYP-2026-0001-a-hunch" });
  const onHunch = conn("mentioned_together", C, D, { method: "on-hunch", inputs: ["HYP-2026-0001-a-hunch"] });
  const store = makeStore();
  const { registry } = world(byOwner([declared, d, ev, hunch, onHunch, ...extra]), { store });
  return { x: exploreOf(null, { registry }), store, d, ev, declared, onHunch };
}
const params = (c) => ({ kind: c.kind, from: c.from, to: c.to, as_of: c.derived.as_of, method: c.derived.method, id: c.id });
const cited = (c) => ({ id: c.id, kind: c.kind, owner: c.owner, from: c.from, to: c.to });

test("R23 exploreverify over a chain: a derived and an evidentiary step answer matches true, the evidentiary step not re-derived; control: a tampered id on the derived step answers false; nothing is written", () => {
  const { x, store, d, ev } = chainWorld();
  const before = store.snapshot();
  const ok = x.rederive({ chain: [params(d), cited(ev)], viewer: V });
  assert.equal(ok.ok, true);
  assert.equal(ok.matches, true);
  assert.equal(ok.lead, false);
  assert.equal(ok.hops.length, 2);
  assert.deepEqual([ok.hops[0].rederived, ok.hops[0].matches, ok.hops[0].recomputed_id], [true, true, d.id]);
  assert.deepEqual(ok.hops[1], { id: ev.id, rederived: false, class: "evidentiary" });
  assert.equal(ok.undetermined, undefined);
  const bad = x.rederive({ chain: [{ ...params(d), id: "0".repeat(64) }, cited(ev)], viewer: V });
  assert.equal(bad.matches, false);
  assert.equal(bad.hops[0].why, word("explore.text.id_asked_id"));
  assert.equal(store.snapshot(), before);
});

test("R23 each derived step is answered as R12 and R19 answer it, with the scope passed to every owner; lead when any step is declared or a hunch; an undetermined step makes the chain matches false with undetermined", () => {
  const { x, d, ev, declared, onHunch } = chainWorld();
  const lead = x.rederive({ chain: [params(d), cited(declared)], viewer: V });
  assert.deepEqual([lead.matches, lead.lead], [true, true]);
  assert.deepEqual(lead.hops[1], { id: "decl", rederived: false, class: "declared" });
  // R19 through the chain: without the inquiry the hunch the derivation rests on is not read.
  const outside = x.rederive({ chain: [params(d), cited(ev), params(onHunch)], viewer: V });
  assert.deepEqual([outside.matches, outside.undetermined, outside.hops[2].undetermined], [false, true, true]);
  const inside = x.rederive({ chain: [params(d), cited(ev), params(onHunch)], viewer: V, scope: { inquiry: INQUIRY } });
  assert.deepEqual([inside.matches, inside.undetermined, inside.hops[2].declared_or_hunch], [true, undefined, true]);
  assert.deepEqual(inside.scope, { inquiry: INQUIRY });
  // Each derived step answers exactly what the single call answers.
  const single = x.rederive({ ...params(onHunch), viewer: V, scope: { inquiry: INQUIRY } });
  assert.deepEqual(inside.hops[2], { rederived: true, ...single });
  // A step of an unregistered kind, or named under another owner, is not settled.
  const unknown = x.rederive({ chain: [params(d), { id: "z", kind: "nope", owner: "lines" }], viewer: V });
  assert.deepEqual([unknown.matches, unknown.undetermined, unknown.hops[1].class], [false, true, null]);
  const wrongOwner = x.rederive({ chain: [params(d), { ...cited(ev), owner: "money" }], viewer: V });
  assert.deepEqual([wrongOwner.matches, wrongOwner.undetermined], [false, true]);
});

test("R23 refusals: BAD_CHAIN for an empty chain, one over 10 or a step of neither form, CHAIN_BROKEN for consecutive steps sharing no record, each naming the step; a malformed scope BAD_SCOPE; no chain answers as before", () => {
  const { x, d, ev } = chainWorld();
  assert.equal(x.rederive({ chain: [params(d)] }).refused, "VIEWER_MISSING");
  for (const chain of [[], Array.from({ length: 11 }, () => cited(ev)), "x", null]) assert.equal(x.rederive({ chain, viewer: V }).refused, "BAD_CHAIN", JSON.stringify(chain));
  for (const step of [{}, { id: "x" }, { id: "x", kind: "line:part_of" }, { ...params(d), method: "" }, { ...params(d), from: "nope" }, { id: d.id, kind: d.kind, owner: d.owner }, "LIN-2026-00000000000000ev"]) {
    const r = x.rederive({ chain: [params(d), step], viewer: V });
    assert.equal(r.refused, "BAD_CHAIN", JSON.stringify(step));
    assert.equal(r.why, stepNeitherWhy(2));
  }
  const broken = x.rederive({ chain: [params(d), { ...cited(ev), from: D, to: E }], viewer: V });
  assert.equal(broken.refused, "CHAIN_BROKEN");
  assert.equal(broken.why, sharesNoRecordWhy(2, 1));
  assert.equal(x.rederive({ chain: [params(d)], viewer: V, scope: "INQ" }).refused, "BAD_SCOPE");
  const one = x.rederive({ ...params(d), viewer: V });
  assert.equal(one.matches, true);
  assert.equal(one.hops, undefined, "without a chain the answer is R12's");
  assert.equal(one.lead, undefined);
  assert.equal(one.held_id, d.id);
});

test("R24 a path through a declared member_of with a source attached answers the step_source step, with backs naming the relation, and is no lead; control: once the source is withdrawn the same path is a lead", () => {
  const rel = conn("member_of", A, B, { id: "REL-2026-0001" });
  const src = conn("step_source", A, B, { id: "SRC-2026-0001", relation: "REL-2026-0001", grade: { assertion: "B", ends: [LOWEST_GRADE, LOWEST_GRADE] } });
  const onward = conn("line:part_of", B, C, { id: "onward" });
  const withSource = make([rel, src, onward]).x;
  for (const kinds of [undefined, ["member_of", "line:part_of"], ["member_of", "step_source", "line:part_of"]]) {
    const r = withSource.explore({ from: A, at: AT, viewer: V, ...(kinds ? { kinds } : {}) });
    const p = r.paths.find((q) => q.hops.length === 2);
    assert.equal(ids(p), "SRC-2026-0001>onward", String(kinds));
    assert.equal(p.label, "evidenced");
    assert.equal(p.lead, undefined);
    assert.equal(p.hops[0].backs, "REL-2026-0001");
    assert.equal(p.hops[0].kind, "step_source");
    assert.equal(p.hops[0].evidence[0].relation, "REL-2026-0001");
    assert.ok(!r.paths.some((q) => q.hops.some((h) => h.id === "REL-2026-0001")), "the declared step is not walked beside it");
    assert.deepEqual(p.grade, { assertion: "B", end: LOWEST_GRADE }, "graded by the source");
  }
  // The graph's read takes it the same way.
  const g = withSource.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(g.steps.map((s) => [s.id, s.kind, s.backs, s.label]), [["SRC-2026-0001", "step_source", "REL-2026-0001", undefined], ["onward", "line:part_of", undefined, undefined]]);
  // Withdrawn: no source answered, the declared step is walked as R6 says.
  const withdrawn = make([rel, onward]).x.explore({ from: A, at: AT, viewer: V });
  const p = withdrawn.paths.find((q) => q.hops.length === 2);
  assert.equal(ids(p), "REL-2026-0001>onward");
  assert.equal(p.label, "lead");
  assert.equal(p.lead.sentence, LEAD_SENTENCE);
});

test("R24 R7 a source the viewer may not see leaves the declared step a lead and reveals nothing; a source of another relation backs nothing", () => {
  const rel = conn("member_of", A, B, { id: "REL-2026-0001" });
  const hidden = conn("step_source", A, B, { id: "SRC-2026-0009", relation: "REL-2026-0001", seen_by: ["carol"] });
  const alice = make([rel, hidden]).x.explore({ from: A, at: AT, viewer: V, kinds: ["member_of"] });
  assert.deepEqual([alice.paths.map(ids), alice.paths[0].label], [["REL-2026-0001"], "lead"]);
  assert.ok(!JSON.stringify(alice).includes("SRC-2026-0009"));
  assert.deepEqual(strip(alice), strip(make([rel]).x.explore({ from: A, at: AT, viewer: V, kinds: ["member_of"] })));
  const carol = make([rel, hidden]).x.explore({ from: A, at: AT, viewer: "carol", kinds: ["member_of"] });
  assert.deepEqual([carol.paths.map(ids), carol.paths[0].label], [["SRC-2026-0009"], "evidenced"]);
  const other = conn("step_source", A, B, { id: "SRC-2026-0002", relation: "REL-2026-0042" });
  const r = make([rel, other]).x.explore({ from: A, at: AT, viewer: V, kinds: ["member_of"] });
  assert.deepEqual([r.paths.map(ids), r.paths[0].label], [["REL-2026-0001"], "lead"]);
});

const labelling = (table, calls = []) => ({ labelsOf: ({ ids, viewer }) => { calls.push({ ids: [...ids], viewer }); return Object.fromEntries(ids.map((id) => [id, table[id] ?? null])); } });

test("R25 a centre with a person one ring out joined by a step_source step answers the person's label, the step's attached_by and at, and the organisation two rings out label null when unnamed; every node carries label and entity_kind, the kind only for an ENT- node", () => {
  const src = Object.assign(conn("step_source", A, B, { id: "SRC-2026-0001", relation: "REL-2026-0001" }), { attached_by: "member:bo", at: "2026-02-10T09:00:00Z" });
  const rel = conn("member_of", A, B, { id: "REL-2026-0001" });
  const seat = conn("line:seat_on", B, C, { id: "b-c" });
  const calls = [];
  const { x } = make([rel, src, seat], { ctx: { entities: labelling({ [A]: { label: "Alice Alder", kind: "person" }, [B]: { label: "Bo Birch", kind: "person" } }, calls) } });
  const g = x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(g.nodes.map((n) => [n.id, n.ring, n.label, n.entity_kind]), [[A, 0, "Alice Alder", "person"], [B, 1, "Bo Birch", "person"], [C, 2, null, null]]);
  const s = g.steps.find((q) => q.kind === "step_source");
  assert.equal(s.attached_by, "member:bo");
  assert.equal(s.at, "2026-02-10T09:00:00Z");
  assert.equal(calls.length, 1, "one bounded read");
  assert.deepEqual([calls[0].ids, calls[0].viewer], [[A, B, C], V]);
  // Control: a step of another kind carries neither key.
  const other = g.steps.find((q) => q.kind === "line:seat_on");
  assert.ok(!("attached_by" in other) && !("at" in other));
  // A node's label is never its id; an id the read answers as its own name is no name.
  const same = make([seat], { ctx: { entities: labelling({ [B]: { label: B, kind: "person" } }) } }).x.neighbourhood({ centre: B, at: AT, viewer: V });
  assert.equal(same.nodes[0].label, null);
  // A node that is not an entity record carries label null and entity_kind null, and is not read.
  const rows = [conn("line:belongs_to", A, evt(7), { id: "a-e" })];
  const calls2 = [];
  const h = make(rows, { ctx: { entities: labelling({ [A]: { label: "Alice Alder", kind: "person" } }, calls2) } }).x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(h.nodes.map((n) => [n.id, n.label, n.entity_kind]), [[A, "Alice Alder", "person"], [evt(7), null, null]]);
  assert.deepEqual(calls2[0].ids, [A]);
  // No entities reader: names are absent, never invented.
  const bare = make(rows).x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(bare.nodes.map((n) => [n.label, n.entity_kind]), [[null, null], [null, null]]);
});

test("R25 R7 a hidden step leaves nodes, steps, visited and the names read as if absent; more than 500 entity nodes are read in bounded reads", () => {
  const open = conn("line:belongs_to", A, B, { id: "a-b" });
  const fenced = conn("line:seat_on", A, C, { id: "a-c", seen_by: ["carol"] });
  const table = { [A]: { label: "Alice Alder", kind: "person" }, [B]: { label: "Bo Birch", kind: "person" }, [C]: { label: "Cy Cedar", kind: "institution" } };
  const callsA = [], callsB = [];
  const withHidden = make([open, fenced], { ctx: { entities: labelling(table, callsA) } }).x.neighbourhood({ centre: A, at: AT, viewer: V });
  const without = make([open], { ctx: { entities: labelling(table, callsB) } }).x.neighbourhood({ centre: A, at: AT, viewer: V });
  assert.deepEqual(strip(withHidden), strip(without));
  assert.ok(!JSON.stringify(withHidden).includes("Cy Cedar") && !JSON.stringify(callsA).includes(C));
  assert.deepEqual(callsA, callsB);
  const wide = Array.from({ length: 700 }, (_, i) => conn("line:belongs_to", A, ent(100 + i), { id: `w-${i}` }));
  const calls = [];
  const g = make(wide, { ctx: { entities: labelling({}, calls) }, opts: { lines: { noHub: true, pageSize: 1000 } } }).x.neighbourhood({ centre: A, at: AT, viewer: V, rings: 1 });
  assert.equal(g.nodes.length, 701);
  assert.ok(calls.length >= 2 && calls.every((c) => c.ids.length <= 500));
  assert.equal(calls.reduce((n, c) => n + c.ids.length, 0), 701);
});

test("R14 exploreOps gains exploregraph, and exploreverify reads chain from the body; the viewer from the query string only", () => {
  const { x, d, ev } = chainWorld();
  const url = new URL(`https://instance.example/?viewer=${V}`);
  const ops = exploreOps(x, url, { centre: A, at: AT, viewer: "mallory" });
  assert.deepEqual(Object.keys(ops).sort(), ["explore", "exploregraph", "explorepreset", "exploretimeline", "exploreverify"]);
  assert.deepEqual(strip(ops.exploregraph()), strip(x.neighbourhood({ centre: A, at: AT, viewer: V })));
  assert.equal(exploreOps(x, new URL("https://instance.example/"), { centre: A, at: AT, viewer: V }).exploregraph().refused, "VIEWER_MISSING");
  const v = exploreOps(x, url, { chain: [params(d), cited(ev)] }).exploreverify();
  assert.deepEqual([v.matches, v.hops.length], [true, 2]);
  assert.equal(exploreOps(x, url, { chain: [] }).exploreverify().refused, "BAD_CHAIN");
});
