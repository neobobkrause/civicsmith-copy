/* connections: a document as a hop's end, the kind `named_in` (R74-R76; T53; N1260, DEC-409), and the co-mention hub
   judged on `mentioned_together` alone (R75). Every read is driven at the module's interface (`neighbours`), and through
   connection-grammar's registry with the caller's host, the path explore's walk takes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, MACHINE } from "./fixture.mjs";
import { defaultRegistry, ownerConformance, hubBoundOf, LOWEST_GRADE } from "../../../src/connection-grammar/index.mjs";
import { NAMED_IN_KIND, NAMED_IN_KINDS, NAMED_IN_DECLARES, NAMED_IN_READ_LIMIT, namedInId, STEP_SOURCE_KIND, MENTIONED_KIND,
         CO_MENTION_HUB } from "../../../src/connections/index.mjs";

const E = "ENT-2026-0201", F = "ENT-2026-0202", G = "ENT-2026-0203";
const A = "INFO-2026-0201-a", B = "INFO-2026-0202-b", H = "INFO-2026-0250-h";
const at = "2026-10-01";
const ask = (w, args) => w.k.neighbours({ at, scope: null, ...args });
const named = (r) => r.items.filter((i) => i.kind === NAMED_IN_KIND);
/* Many held documents at once: the `bundles` row record-core writes at a promotion, alone (a full promotion each would
   take minutes over a thousand). */
const held = (w, id) => w.st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                                       VALUES (?, 'information', 'test-group', ?, 'collected', 't', 't', ?)`, id, id, sha(id));

/* E is resolved in three captures of two documents (A's two captures at C and A, B's one at B) and in H, hidden from
   every member (a project no one joined); E and F are joined by a declared relation backed by a source in B; A also
   names F, so A and B are mentioned together through E and F. An unresolved reference is read in A. */
function setup() {
  const w = world();
  w.member("alice"); w.member("bob");
  w.entity(E, "The Commission"); w.entity(F, "The Department"); w.entity(G, "Nobody");
  const [a1, a2] = w.doc(A, ["alpha one", "alpha two"]);
  const [b] = w.doc(B, ["beta"]);
  const [h] = w.doc(H, ["hidden"]);
  w.receipt("https://example.org/a", a2, "2026-09-26T00:00:00Z", "direct");
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, H);
  w.resolve(a1, A, "the commission", E, "C"); w.resolve(a2, A, "Commission", E, "A");
  w.resolve(b, B, "the Commission", E, "B"); w.resolve(h, H, "Commission", E, "A");
  w.resolve(a1, A, "the department", F, "B"); w.resolve(b, B, "Department", F, "B");
  w.read(a1, A, "an unknown board", [1]);
  w.k.derive({ entityId: E }); w.k.derive({ entityId: F });
  const rel = w.entities.declareRelation({ fromEntity: E, toEntity: F, relation: "member_of", justification: "charter",
                                           citation: "Charter art. 2", declaredBy: "alice" });
  assert.equal(rel.ok, true, JSON.stringify(rel));
  const s = w.k.attachStepSource({ relation: rel.relation_id, captureSha: b, extent: { kind: "document" }, basis: "it says so",
                                   member: "alice", viewer: V("alice") });
  assert.equal(s.ok, true, JSON.stringify(s));
  return { w, a1, a2, b, h, rel: rel.relation_id };
}

test("R74: an entity resolved in three captures of two documents answers two named_in hops, one to each document through its strongest resolution, beside its step_source hops, unchanged; the shape is connection-grammar's", () => {
  const { w, a2, b } = setup();
  const before = ask(w, { node: E, viewer: V("alice"), kinds: [STEP_SOURCE_KIND] });
  assert.equal(before.items.length, 1);
  const all = ask(w, { node: E, viewer: V("alice") });
  assert.deepEqual(all.items.filter((i) => i.kind === STEP_SOURCE_KIND), before.items, "step_source hops unchanged");
  const hops = named(all);
  assert.deepEqual(hops.map((i) => i.to).sort(), [A, B]);
  const toA = hops.find((i) => i.to === A), toB = hops.find((i) => i.to === B);
  assert.deepEqual({ ...toA, grade_says: null }, {
    id: namedInId({ from: E, to: A, capture_sha: a2 }), from: E, to: A, kind: NAMED_IN_KIND, owner: "connections",
    valid: { from: null, to: null, precision: "day", zone: "UTC" },
    evidence: [{ source: A, capture_sha: a2, ref: "Commission" }],
    grade: { assertion: "A", ends: ["A", w.prov.captureGrade(a2).grade] }, grade_says: null, derived: null,
    undetermined: toA.undetermined });
  assert.match(toA.id, /^[0-9a-f]{64}$/);
  assert.deepEqual(toB.evidence, [{ source: B, capture_sha: b, ref: "the Commission" }]);
  assert.deepEqual(toB.grade, { assertion: "B", ends: ["B", LOWEST_GRADE] }, "a capture with no grade answers the lowest");
  assert.deepEqual(all.items.map((i) => i.id), [...all.items.map((i) => i.id)].sort(), "the union is ordered by hop id");
  /* The same hop from either end has the same id. */
  assert.ok(named(ask(w, { node: A, viewer: V("alice") })).some((i) => i.id === toA.id));
});

test("R74: from a document, its entities beside its mentioned_together hops; a declared relation is never a named_in hop; control: an unresolved reference makes no hop, and kinds: ['step_source'] on an entity answers what it did before", () => {
  const { w } = setup();
  const r = ask(w, { node: A, viewer: V("alice") });
  assert.deepEqual(named(r).map((i) => [i.from, i.to]).sort(), [[E, A], [F, A]]);
  const co = ask(w, { node: A, viewer: V("alice"), kinds: [MENTIONED_KIND] });
  assert.ok(co.items.length > 0);
  assert.deepEqual(r.items.filter((i) => i.kind === MENTIONED_KIND), co.items, "its co-mentions, unchanged");
  /* The declared relation E-F is no named_in hop from E: every hop runs to a document. */
  assert.ok(named(ask(w, { node: E, viewer: V("alice") })).every((i) => i.to === A || i.to === B));
  assert.ok(!JSON.stringify(r).includes("an unknown board"), "the unresolved reference makes no hop");
  assert.deepEqual(named(ask(w, { node: G, viewer: V("alice") })), [], "an entity no document resolves to has none");
  const only = ask(w, { node: E, viewer: V("alice"), kinds: [STEP_SOURCE_KIND] });
  assert.deepEqual(only, w.k.stepSources.neighbours({ node: E, viewer: V("alice"), kinds: [STEP_SOURCE_KIND], at, scope: null }));
  assert.deepEqual(Object.keys(only).sort(), ["items"]);
});

test("R74, R76: a document the viewer may not see is neither an item nor counted (set_size and why count the visible ones only); control: a viewer who may see both gets both; an absent viewer is refused", () => {
  const { w } = setup();
  const bob = ask(w, { node: E, viewer: V("bob"), kinds: [NAMED_IN_KIND] });
  assert.equal(bob.items.length, 2);
  assert.equal(bob.named_in.set_size, 2);
  assert.match(bob.named_in.why, /\b2\b/);
  assert.ok(!JSON.stringify(bob).includes(H), "nothing of the hidden document");
  const machine = ask(w, { node: E, viewer: MACHINE, kinds: [NAMED_IN_KIND] });
  assert.equal(machine.items.length, 3);
  assert.equal(machine.named_in.set_size, 3);
  assert.deepEqual(ask(w, { node: H, viewer: V("bob"), kinds: [NAMED_IN_KIND] }).items, [], "a hidden document answers as one not held");
  assert.equal(ask(w, { node: H, viewer: MACHINE, kinds: [NAMED_IN_KIND] }).items.length, 1);
  assert.equal(ask(w, { node: E, viewer: undefined }).refused, "VIEWER_MISSING");
  assert.deepEqual(ask(w, { node: E, viewer: "nobody-known", kinds: [NAMED_IN_KIND] }).items, [], "fails closed");
});

test("R76: a resolution set larger than the read limit answers truncated, every item marked, with the bound named; control: a set within it is not cut", () => {
  const w = world();
  w.entity(E);
  const docs = ["INFO-2026-0301-t", "INFO-2026-0302-t"];
  const caps = docs.map((d) => w.doc(d, [d])[0]);
  for (let i = 0; i <= NAMED_IN_READ_LIMIT; i++)
    w.resolve(caps[i % 2], docs[i % 2], `ref ${String(i).padStart(5, "0")}`, E, "B");
  const r = ask(w, { node: E, viewer: MACHINE, kinds: [NAMED_IN_KIND] });
  assert.equal(r.truncated, true);
  assert.ok(r.items.length > 0 && r.items.every((i) => i.truncated === true));
  assert.deepEqual(r.bounds.map((b) => [b.kind, b.limit]), [[NAMED_IN_KIND, NAMED_IN_READ_LIMIT]]);
  assert.match(r.bounds[0].why, new RegExp(String(NAMED_IN_READ_LIMIT)));
  const w2 = world();
  w2.entity(E);
  w2.resolve(w2.doc(docs[0], ["whole"])[0], docs[0], "r", E, "B");
  const whole = ask(w2, { node: E, viewer: MACHINE, kinds: [NAMED_IN_KIND] });
  assert.equal(whole.truncated, undefined);
  assert.equal(whole.items.length, 1);
});

test("R74: over the kind's hub bound (1,001 documents) the entity is answered hub with that set size and no items; at the bound it is answered as items, paged", () => {
  const w = world();
  w.entity(E);
  const n = hubBoundOf(NAMED_IN_KIND) + 1;
  for (let i = 0; i < n; i++) { const id = `INFO-2026-${String(1000 + i)}-n`; held(w, id); w.resolve(sha(`hub-${i}`), id, "r", E, "B"); }
  const hub = ask(w, { node: E, viewer: MACHINE });
  assert.deepEqual(hub.items, []);
  assert.equal(hub.hub.set_size, n);
  assert.ok(hub.hub.why);
  w.st.sql.exec(`DELETE FROM resolutions WHERE bundle_id = ?`, "INFO-2026-1000-n");
  const seen = [];
  let page = null;
  for (;;) {
    const p = ask(w, { node: E, viewer: MACHINE, page });
    assert.equal(p.hub, undefined);
    seen.push(...p.items.map((i) => i.id));
    if (!p.next) break;
    page = { after: p.next.after };
  }
  assert.equal(seen.length, n - 1);
  assert.equal(new Set(seen).size, n - 1);
});

test("R75: the co-mention hub (more than 32 documents) is judged on mentioned_together alone: the document node's hubs name the entity with set size 40 and no co-mention through it, yet its named_in hop to the entity stands, and the entity answers 40 named_in hops with no hub; control: at 32 documents the entity is no hub", () => {
  const build = (count) => {
    const w = world();
    w.entity(G);
    const docs = Array.from({ length: count }, (_, i) => `INFO-2026-${String(400 + i).padStart(4, "0")}-g`);
    for (const [i, id] of docs.entries()) { const [c] = w.doc(id, [`g${i}`]); w.resolve(c, id, "r", G, "B"); }
    w.k.derive({ entityId: G, limit: 5000 });
    return { w, docs };
  };
  const { w, docs } = build(40);
  const m = ask(w, { node: docs[0], viewer: MACHINE });
  assert.deepEqual(m.hubs.map((h) => [h.entity, h.set_size]), [[G, 40]]);
  assert.ok(m.hubs[0].why);
  assert.equal(m.items.filter((i) => i.kind === MENTIONED_KIND).length, 0, "no co-mention through the hub");
  assert.deepEqual(named(m).map((i) => [i.from, i.to]), [[G, docs[0]]], "the hub hides no named_in hop");
  const fromG = ask(w, { node: G, viewer: MACHINE });
  assert.equal(fromG.hub, undefined);
  assert.equal(named(fromG).length, 40);
  const ctl = build(CO_MENTION_HUB);
  const c = ask(ctl.w, { node: ctl.docs[0], viewer: MACHINE });
  assert.equal(c.hubs, undefined);
  assert.equal(c.items.filter((i) => i.kind === MENTIONED_KIND).length, CO_MENTION_HUB - 1);
});

test("R74: through connection-grammar's registry with the caller's host (explore's path), a walk from the entity reaches the document and from the document the entity; the owner-conformance battery passes for named_in", () => {
  const { w } = setup();
  const reg = (node, kinds) => defaultRegistry.neighbours({ owner: "connections", node, ...(kinds ? { kinds } : {}), at,
                                                           viewer: V("alice"), scope: null, host: w.host });
  const fromE = reg(E, [NAMED_IN_KIND]);
  assert.equal(fromE.refused, undefined, JSON.stringify(fromE).slice(0, 300));
  assert.deepEqual(fromE.items.map((i) => i.to).sort(), [A, B]);
  const fromA = reg(A);
  assert.equal(fromA.refused, undefined, JSON.stringify(fromA).slice(0, 300));
  assert.ok(fromA.items.some((i) => i.kind === NAMED_IN_KIND && i.from === E));
  const fromEall = reg(E);
  assert.equal(fromEall.refused, undefined, JSON.stringify(fromEall).slice(0, 300));
  assert.deepEqual([...new Set(fromEall.items.map((i) => i.kind))].sort(), [NAMED_IN_KIND, STEP_SOURCE_KIND]);

  const all = ask(w, { node: E, viewer: MACHINE, kinds: [NAMED_IN_KIND] });
  const fenced = all.items.find((i) => i.to === H).id;
  const fixture = { node: E, at, kinds: [NAMED_IN_KIND], viewers: { sees: MACHINE, blind: V("bob") }, fenced,
                    expected: all.items.map((i) => i.id).sort() };
  const r = ownerConformance({ owner: "connections", kinds: NAMED_IN_KINDS.map((x) => ({ ...x })),
                               neighbours: (a) => w.k.neighbours(a), fixture, declares: NAMED_IN_DECLARES });
  assert.deepEqual(r.failures, [], JSON.stringify(r.failures));
  assert.equal(r.ok, true);
});
