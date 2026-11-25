/* law-relations: recodification across addresses (R3), the connection owner's read (R7), the reads for standards (R10,
   R12) and sight of both ends (R19). Moved from standards' law.test.mjs and reads.test.mjs (its R24, R28), driven over
   the test's host. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, REASON, codeOf } from "./fixture.mjs";
import { LawRecords, CONNECTION_KINDS, CONNECTION_OWNER, IN_FORCE_METHOD, LAW_RELATIONS, COURT_LINKS, weakestCeiling }
  from "../../../src/law-relations/index.mjs";
import { ownerConformance, createRegistry, derivedId, BOUNDS, LOWEST_GRADE } from "../../../src/connection-grammar/index.mjs";
import { BASIS_GRADES } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const rel = (w, type, from, to, citation, effective, by = "bob") => {
  const r = w.law.lawRelate({ type, from, to, citation, ...(effective ? { effective } : {}), reason: REASON, author: V(by), viewer: V(by) });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return r.relation.id;
};

test("R3 R20 addressesOf follows adopted renumbers and recodifies relations both ways and answers every key and portion the provision has been held under, each with the relation and its effective date or event; withdrawn ones, other types and ones whose passage the viewer may not read are not followed; bounded by connection-grammar's default depth (truncated past it); a blank key is the host's STANDARD_NO_ID; it never throws and writes nothing", () => {
  const w = seeded();
  const s = [];
  for (let i = 0; i < 11; i++) s.push(w.standard({ key: `/eli/x/sb/${100 + i}`, portion: `${100 + i}(a)` }));
  const r = (type, from, to, i) => rel(w, type, s[from].id, s[to].id, s[from].t, `20${10 + i}-01-01`);
  r("renumbers", 1, 0, 1);
  const recod = r("recodifies", 1, 2, 2);
  r("amends", 3, 0, 3);
  const before = w.snapshot();
  const a = w.law.addressesOf({ key: "/eli/x/sb/100", viewer: V("carol") });
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  assert.deepEqual([a.ok, a.key, a.portion, a.held_under], [true, "/eli/x/sb/100", null, [s[0].id]]);
  assert.deepEqual(a.addresses.map((x) => [x.standard, x.key, x.portion, x.via.type, x.via.effective.date, x.depth]),
                   [[s[1].id, "/eli/x/sb/101", "101(a)", "renumbers", "2011-01-01", 1],
                    [s[2].id, "/eli/x/sb/102", "102(a)", "recodifies", "2012-01-01", 2]]);
  assert.equal(a.truncated, false);
  assert.ok(!a.addresses.some((x) => x.standard === s[3].id), "an amendment is not an address");
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/sb/100", portion: "100(a)", viewer: V("carol") }).held_under, [s[0].id]);
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/sb/100", portion: "9", viewer: V("carol") }).held_under, []);
  /* from the other end, the same provision */
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/sb/102", viewer: V("carol") }).addresses.map((x) => x.standard), [s[1].id, s[0].id]);
  /* an enactment event */
  const ev = w.standard({ key: "/eli/x/sb/200" });
  w.law.lawRelate({ type: "renumbers", from: ev.id, to: s[0].id, citation: ev.t, effective: { event: "EVT-2026-abcdefghijklmnop", edge: "end" }, reason: REASON, author: V("bob") });
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/sb/200" }).addresses[0].via.effective, { event: "EVT-2026-abcdefghijklmnop", edge: "end" });
  /* a passage the viewer may not read: not followed for that viewer */
  const P = w.project("alice");
  const hidden = w.passage({ project: P });
  const sealed = w.standard({ key: "/eli/x/sb/300", texts: [hidden] });
  w.law.lawRelate({ type: "recodifies", from: sealed.id, to: s[0].id, citation: hidden, effective: "2020-01-01", reason: REASON, author: V("alice") });
  assert.ok(!w.law.addressesOf({ key: "/eli/x/sb/100", viewer: V("carol") }).addresses.some((x) => x.standard === sealed.id));
  assert.ok(w.law.addressesOf({ key: "/eli/x/sb/100", viewer: V("alice") }).addresses.some((x) => x.standard === sealed.id));
  /* withdrawn: not followed */
  w.law.lawWithdraw({ relation: recod, reason: "not a recodification", author: V("bob") });
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/sb/100", viewer: V("carol") }).addresses.map((x) => x.standard).sort(), [s[1].id, ev.id].sort(),
                   "both at depth 1, in relation id order");
  /* a chain longer than the default depth (8) is cut and said so */
  for (let i = 3; i < 10; i++) r("renumbers", i + 1, i, i);
  r("renumbers", 3, 2, 30);
  const long = w.law.addressesOf({ key: "/eli/x/sb/110" });
  assert.equal(BOUNDS.depth_default, 8);
  assert.deepEqual([long.truncated, long.addresses.length, Math.max(...long.addresses.map((x) => x.depth))], [true, 8, 8]);
  assert.match(long.why, /past 8 steps/);
  for (const key of ["", "  ", null, undefined]) {
    const b = w.law.addressesOf({ key });
    assert.deepEqual([b.reason, b.host, b.op], ["STANDARD_NO_ID", true, "addresses"]);
  }
  for (const args of [undefined, { key: 7 }, { key: {} }, { key: "/eli/x", portion: {} }]) assert.doesNotThrow(() => w.law.addressesOf(args));
  w.reads.idsAtKey = () => { throw new Error("broken"); };
  const broken = w.law.addressesOf({ key: "/eli/x/sb/100" });
  assert.deepEqual([broken.ok, broken.addresses, broken.truncated], [true, [], true], "never throws");
});

test("R10 boundsOn answers the temporal relations whose to is the standard and which are not withdrawn, in relation id order, each with its type and effective date or enactment event and edge; it reads no viewer and writes nothing", () => {
  const w = seeded();
  const node = w.standard(), x = w.standard(), y = w.standard();
  const P = w.project("alice");
  const hidden = w.passage({ project: P });
  const sealed = w.standard({ texts: [hidden] });
  const ids = [rel(w, "amends", x.id, node.id, x.t, "2021-01-01"), rel(w, "repeals", y.id, node.id, y.t, { event: "EVT-2026-abcdefghijklmnop", edge: "start" }),
               rel(w, "renumbers", sealed.id, node.id, hidden, "2022-02-02", "alice")];
  const gone = rel(w, "recodifies", y.id, node.id, y.t, "2023-01-01");
  w.law.lawWithdraw({ relation: gone, reason: "wrong", author: V("bob") });
  rel(w, "refers_to", x.id, node.id, x.t);                    // referential: no bound
  rel(w, "amends", node.id, x.id, node.t, "2021-01-01");     // from the node: bounds x, not node
  const before = w.snapshot();
  const b = w.law.boundsOn(node.id);
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  assert.deepEqual(b.map((r) => r.relation_id), [...ids].sort(), "every viewer's: no sight is asked");
  const by = new Map(b.map((r) => [r.relation_id, r]));
  assert.deepEqual([by.get(ids[0]).type, by.get(ids[0]).effective_date], ["amends", "2021-01-01"]);
  assert.deepEqual([by.get(ids[1]).type, by.get(ids[1]).effective_event, by.get(ids[1]).effective_edge, by.get(ids[1]).effective_date],
                   ["repeals", "EVT-2026-abcdefghijklmnop", "start", null]);
  assert.deepEqual(w.law.boundsOn("STD-2026-9999-x"), []);
});

test("R12 weakestCeiling answers the weakest transcription ceiling among the passages, or the lowest grade with why when any is undetermined or not held; it is pure and never throws", () => {
  const S = (g, why) => ({ transcription: { ceiling: g, ...(why ? { why } : {}) } });
  assert.deepEqual(BASIS_GRADES, ["A", "B", "C", "D"]);
  assert.equal(LOWEST_GRADE, "D");
  for (const [standings, ids, grade] of [[{ a: S("A") }, ["a"], "A"], [{ a: S("A"), b: S("C") }, ["a", "b"], "C"],
                                         [{ a: S("B"), b: S("A") }, ["a", "b"], "B"], [{ a: S("D"), b: S("A") }, ["a", "b"], "D"]])
    assert.deepEqual(weakestCeiling(standings, ids), { grade, why: null }, JSON.stringify(ids));
  const u = weakestCeiling({ a: S("A"), b: S(null, "the chain is not read") }, ["a", "b"]);
  assert.equal(u.grade, "D");
  assert.match(u.why, /lowest grade, because b…: the chain is not read/);
  const missing = weakestCeiling({ a: S("A") }, ["a", "zz"]);
  assert.equal(missing.grade, "D");
  assert.match(missing.why, /zz…: not held/);
  assert.deepEqual(weakestCeiling({}, []), { grade: "D", why: null }, "no passage: the lowest grade");
  const cyclic = {}; cyclic.self = cyclic;
  const hostile = new Proxy({}, { get() { throw new Error("no"); } });
  for (const [s, ids] of [[null, ["a"]], [undefined, undefined], [7, [1]], [{ a: 1 }, ["a"]], [{ a: { transcription: 9 } }, ["a"]],
                          [cyclic, ["self"]], [hostile, ["a"]], [{ a: S("A") }, "a"], [{ a: S("A") }, [Symbol("s")]], [{ a: S("Z") }, ["a"]]])
    assert.doesNotThrow(() => { const r = weakestCeiling(s, ids); assert.ok(BASIS_GRADES.includes(r.grade)); });
  const st = { a: S("B"), b: S("C") };
  const copy = JSON.stringify(st);
  assert.deepEqual(weakestCeiling(st, ["a", "b"]), weakestCeiling(st, ["a", "b"]), "the same answer every time");
  assert.equal(JSON.stringify(st), copy, "nothing changed");
});

/* A world for the owner: standards related, a court link, a fenced relation, events. */
function ownerWorld() {
  const w = seeded();
  const P = w.project("alice");
  const node = w.standard({ from: "2010-01-01", to: "2030-12-31" });
  const inside = w.standard({ from: "2010-01-01", to: "2030-12-31" });
  const open = w.standard({ from: "2010-01-01", to: null });
  const later = w.standard({ from: "2023-01-01", to: "2030-12-31" });
  const court = w.standard({ kind: "court", from: "2015-01-01", to: "2030-12-31" });
  const hidden = w.passage({ project: P });
  const fencedFrom = w.standard({ texts: [hidden] });
  const ids = {
    in: rel(w, "refers_to", inside.id, node.id, inside.t),
    undetermined: rel(w, "refers_to", open.id, node.id, open.t),
    out: rel(w, "amends", later.id, node.id, later.t, "2023-01-01"),
    link: w.law.courtLink({ type: "interprets", from: court.id, to: node.id, citation: court.t, reason: REASON, author: V("bob") }).link.id,
    fenced: rel(w, "defines", fencedFrom.id, node.id, hidden, null, "alice"),
  };
  const withdrawn = rel(w, "excepts", inside.id, node.id, inside.t);
  w.law.lawWithdraw({ relation: withdrawn, reason: "recorded twice", author: V("bob") });
  const meeting = w.event({ day: "2022-05-05" }), fenced = w.event({ day: "2022-05-05", project: P }), undated = w.event();
  return { w, node: node.id, ids, withdrawn, meeting, fenced, undated, open: open.id };
}

test("R7 CONNECTION_KINDS holds this module's law-relation kinds and court links (evidentiary) and \"in force at an event's date\" (derived), each with its members' word, under the owner name standards; for a standard node, neighbours answers its relations and links valid at at, an undetermined one marked so, withdrawn ones not at all, a fenced one only to who may read its passage; a missing viewer is refused; the owner-conformance battery passes", () => {
  assert.equal(CONNECTION_OWNER, "standards");
  assert.deepEqual(CONNECTION_KINDS.map((k) => k.kind), [...LAW_RELATIONS.temporal.map((t) => `law_${t}`), ...LAW_RELATIONS.referential.map((t) => `law_${t}`),
                                                         ...COURT_LINKS.map((t) => `court_${t}`), "in_force_at_event"]);
  assert.deepEqual(CONNECTION_KINDS.map((k) => k.word), ["amends", "repeals", "renumbers", "recodifies", "refers to", word("label.connectionkinds.law_defines"),
    word("label.connectionkinds.law_excepts"), "implements", "incorporates", "interprets", "applies", "holds invalid", "requires", word("label.connectionkinds.in_force_at_event")]);
  assert.deepEqual(CONNECTION_KINDS.filter((k) => k.class === "derived").map((k) => k.kind), ["in_force_at_event"]);
  assert.ok(CONNECTION_KINDS.every((k) => Object.isFrozen(k)) && Object.isFrozen(CONNECTION_KINDS));
  const reg = createRegistry();
  const { w, node, ids } = ownerWorld();
  const owner = { owner: CONNECTION_OWNER, kinds: CONNECTION_KINDS.map((k) => ({ ...k })), neighbours: (a) => w.law.neighbours(a) };
  assert.equal(reg.registerOwner(owner).ok, true, "the registry accepts the kinds and words");
  const r = ownerConformance({ ...owner, fixture: { node, at: "2022-06-01T12:00:00Z", in: ids.in, out: ids.out, undetermined: ids.undetermined,
    viewers: { sees: V("alice"), blind: V("carol") }, fenced: ids.fenced, expected: [ids.in, ids.undetermined, ids.link, ids.fenced] } });
  assert.deepEqual(r, { ok: true, failures: [] }, JSON.stringify(r.failures));
  const before = w.snapshot();
  const a = w.law.neighbours({ node, at: "2022-06-01T12:00:00Z", viewer: V("carol") });
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  const byId = new Map(a.items.map((i) => [i.id, i]));
  assert.deepEqual([...byId.keys()].sort(), [ids.in, ids.undetermined, ids.link].sort());
  for (const i of a.items) assert.equal(reg.checkConnection(i).ok, true, JSON.stringify(reg.checkConnection(i)));
  assert.deepEqual([byId.get(ids.in).kind, byId.get(ids.link).kind, byId.get(ids.in).owner, byId.get(ids.in).evidence],
                   ["law_refers_to", "court_interprets", "standards", [{ source: byId.get(ids.in).evidence[0].content_id, content_id: byId.get(ids.in).evidence[0].content_id }]]);
  assert.ok(byId.get(ids.undetermined).undetermined.why, "an undetermined item is marked");
  /* before the amendment took effect the amending relation is out: valid from its effective date */
  assert.ok(!a.items.some((i) => i.id === ids.out));
  assert.ok(w.law.neighbours({ node, at: "2023-06-01T12:00:00Z", viewer: V("carol") }).items.some((i) => i.id === ids.out));
  assert.deepEqual(w.law.neighbours({ node, at: "2024-06-01T12:00:00Z", viewer: V("carol"), kinds: ["court_interprets"] }).items.map((i) => i.id), [ids.link]);
  assert.deepEqual(w.law.neighbours({ node, at: "2024-06-01T12:00:00Z", viewer: V("carol"), kinds: ["law_amends", "nope"] }).items.map((i) => i.id), [ids.out]);
  for (const viewer of [undefined, null, ""]) assert.equal(w.law.neighbours({ node, at: "2024-06-01T12:00:00Z", viewer }).refused, "VIEWER_MISSING");
  assert.deepEqual(w.law.neighbours({ node: "STD-2026-9999-x", at: "2024-06-01T12:00:00Z", viewer: V("carol") }).items, []);
  assert.deepEqual(w.law.neighbours({ node: 7, at: "2024-06-01T12:00:00Z", viewer: V("carol") }).items, []);
});

test("R7 R12 an evidentiary item is graded by its passage's transcription ceiling and each end's text (weakestCeiling, through the host's gradeOf), valid over its from standard's period from its effective date or enactment event's day; for an event node neighbours answers the held standards in force at the event's when (through the host), each a derived item with its method and connection-grammar's derivedId, an undetermined in-force answer marked so; an event the viewer may not read, or with no when, answers nothing", () => {
  const { w, node, ids, meeting, fenced, undated, open } = ownerWorld();
  const item = w.law.neighbours({ node, at: "2022-06-01T12:00:00Z", viewer: V("carol") }).items.find((i) => i.id === ids.in);
  const expect = w.reads.gradeOf([item.evidence[0].content_id]);
  assert.deepEqual([item.grade.assertion, item.grade_why], [expect.grade, expect.why]);
  assert.deepEqual(item.valid, { from: "2010-01-01", to: "2030-12-31", precision: "day", zone: "UTC" });
  /* an effective event's day starts the item's validity */
  const x = w.standard({ from: "2010-01-01", to: "2030-12-31" });
  const enact = w.event({ day: "2024-02-02" });
  const byEvent = w.law.lawRelate({ type: "amends", from: x.id, to: node, citation: x.t, effective: { event: enact, edge: "start" }, reason: REASON, author: V("bob") }).relation.id;
  const ev = w.law.neighbours({ node, at: "2024-03-01T00:00:00Z", viewer: V("carol") }).items.find((i) => i.id === byEvent);
  assert.equal(ev.valid.from, "2024-02-02");
  assert.ok(!w.law.neighbours({ node, at: "2024-01-01T00:00:00Z", viewer: V("carol") }).items.some((i) => i.id === byEvent));
  /* an event node */
  const at = "2022-05-05T18:00:00Z", day = "2022-05-05";
  const a = w.law.neighbours({ node: meeting, at, viewer: V("carol") });
  const reg = createRegistry();
  reg.registerOwner({ owner: CONNECTION_OWNER, kinds: CONNECTION_KINDS.map((k) => ({ ...k })), neighbours: (q) => w.law.neighbours(q) });
  assert.equal(reg.neighbours({ owner: CONNECTION_OWNER, node: meeting, at, viewer: V("carol") }).items.length, a.items.length, "the registry judges the answer conforming");
  const covering = w.reads.idsCovering(day).filter((sid) => w.reads.inForceAt({ standard: sid, date: day, viewer: V("carol") }).state !== "not_in_force");
  assert.deepEqual(a.items.map((i) => i.to).sort(), covering.filter((sid) => w.reads.inForceAt({ standard: sid, date: day, viewer: V("carol") }).ok).sort());
  assert.ok(a.items.length >= 5);
  for (const i of a.items) {
    assert.equal(i.kind, "in_force_at_event");
    assert.deepEqual(i.derived, { method: IN_FORCE_METHOD, inputs: [meeting, i.to], as_of: day });
    assert.equal(i.id, derivedId({ kind: i.kind, from: meeting, to: i.to, as_of: day, method: IN_FORCE_METHOD }));
    assert.deepEqual([i.grade.assertion, i.grade.ends[0], i.evidence], [LOWEST_GRADE, LOWEST_GRADE, []]);
    assert.equal(i.in_force.state, w.reads.inForceAt({ standard: i.to, date: day }).state);
    assert.equal(reg.checkConnection(i).ok, true, JSON.stringify(reg.checkConnection(i)));
  }
  const gone = w.standard({ from: "2010-01-01", to: "2011-01-01" }).id;
  assert.ok(!w.law.neighbours({ node: meeting, at, viewer: V("carol") }).items.some((i) => i.to === gone), "not in force on the day");
  const u = a.items.find((i) => i.to === open);
  assert.deepEqual([u.in_force.state, typeof u.undetermined.why.key], ["undetermined", "string"], "an undetermined in-force answer is marked, its reason keyed");
  assert.deepEqual(w.law.neighbours({ node: fenced, at, viewer: V("carol") }).items, [], "an event the viewer may not read");
  assert.ok(w.law.neighbours({ node: fenced, at, viewer: V("alice") }).items.length > 0);
  assert.deepEqual(w.law.neighbours({ node: undated, at, viewer: V("carol") }).items, [], "an event with no when");
  assert.deepEqual(w.law.neighbours({ node: "EVT-2026-nothingheldhere00", at, viewer: V("carol") }).items, []);
  assert.deepEqual(w.law.neighbours({ node: meeting, at, viewer: V("carol"), kinds: ["law_amends"] }).items, [], "kinds asked");
});

test("R7 the hub bound and paging: a node with more items than BOUNDS.hub is named, never expanded; up to it, at most BOUNDS.fanout per page with next continuing, the pages joined equal to the unpaged set", () => {
  const w = seeded();
  const node = w.standard(), x = w.standard();
  const many = (n) => { for (let i = 0; i < n; i++) rel(w, "refers_to", x.id, node.id, x.t); };
  many(BOUNDS.hub);
  const all = w.law.neighbours({ node: node.id, at: "2022-06-01T12:00:00Z", viewer: V("carol") });
  assert.equal(all.items.length, BOUNDS.hub);
  assert.equal(all.hub, undefined);
  many(1);
  const hub = w.law.neighbours({ node: node.id, at: "2022-06-01T12:00:00Z", viewer: V("carol") });
  assert.deepEqual([hub.items, hub.hub.set_size], [[], BOUNDS.hub + 1]);
  assert.match(hub.hub.why, /never expanded/);
});

test("R19 a relation, link or treatment is answered by addressesOf, stillStanding, neighbours and lawRelationsOf only to a viewer the host's readable admits to both of its ends; otherwise it is neither answered nor counted, exactly as if absent, so a policy held at its source's bundle sight shows no relation to one who may not see it", async () => {
  const w = seeded();
  const P = w.project("alice");
  /* a policy held at its source's bundle sight: its own bundle is in alice's project, its passage is not */
  const policy = w.standard({ kind: "policy", key: "/eli/x/po/1", portion: "4", project: P });
  const statute = w.standard({ key: "/eli/x/st/1" });
  const court = w.standard({ kind: "court", from: "2015-01-01", to: null }), later = w.standard({ kind: "court", from: "2016-01-01", to: null, project: P });
  const r1 = rel(w, "implements", policy.id, statute.id, policy.t, null, "alice");
  const r2 = rel(w, "renumbers", policy.id, statute.id, policy.t, "2020-01-01", "alice");
  const link = w.law.courtLink({ type: "requires", from: court.id, to: { standard: policy.id, portion: "4" }, citation: court.t, reason: REASON, author: V("alice"), viewer: V("alice") });
  assert.equal(link.ok, true, JSON.stringify(link).slice(0, 200));
  const treat = w.law.courtTreat({ decision: court.id, treatment: "reversed", by_decision: later.id, citation: later.t, reason: REASON, author: V("alice"), viewer: V("alice") });
  assert.equal(treat.ok, true);
  assert.equal(w.content.contentRow(policy.t).bundle_id.startsWith("INFO-"), true, "the passage carol may read");
  assert.equal(w.reads.readable(policy.id, V("carol")), false, "the policy carol may not");
  /* carol: as if absent */
  const ofStatute = w.law.lawRelationsOf({ standard: statute.id, viewer: V("carol") });
  assert.deepEqual([ofStatute.temporal, ofStatute.referential, ofStatute.truncated], [[], [], false]);
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/st/1", viewer: V("carol") }).addresses, []);
  assert.deepEqual(w.law.neighbours({ node: statute.id, at: "2022-06-01T12:00:00Z", viewer: V("carol") }).items, []);
  assert.deepEqual(w.law.neighbours({ node: court.id, at: "2022-06-01T12:00:00Z", viewer: V("carol") }).items, [], "the link to the policy");
  const s = w.law.stillStanding({ decision: court.id, date: "2020-01-01", viewer: V("carol") });
  assert.deepEqual([s.state, s.treatments, s.by], ["undetermined", [], []], "the reversal by a decision carol may not read");
  assert.equal(codeOf(w.law.lawRelationsOf({ standard: policy.id, viewer: V("carol") })), "NO_SUCH_STANDARD");
  /* alice: every one */
  assert.deepEqual(w.law.lawRelationsOf({ standard: statute.id, viewer: V("alice") }).referential.map((x) => x.id), [r1]);
  assert.deepEqual(w.law.addressesOf({ key: "/eli/x/st/1", viewer: V("alice") }).addresses.map((x) => x.via.relation), [r2]);
  assert.deepEqual(w.law.neighbours({ node: statute.id, at: "2022-06-01T12:00:00Z", viewer: V("alice") }).items.map((i) => i.id).sort(), [r1, r2].sort());
  assert.deepEqual(w.law.neighbours({ node: court.id, at: "2022-06-01T12:00:00Z", viewer: V("alice") }).items.map((i) => i.id), [link.link.id]);
  assert.equal(w.law.stillStanding({ decision: court.id, date: "2020-01-01", viewer: V("alice") }).state, "not_standing");
  /* an internal read (no viewer sent) reads every one */
  assert.equal(w.law.lawRelationsOf({ standard: statute.id }).referential.length, 1);
  assert.equal(w.law.stillStanding({ decision: court.id, date: "2020-01-01" }).state, "not_standing");
});

test("R13 R16 the module answers as constructed over a host it was given, two LawRecords over two stores never sharing a row", () => {
  const a = seeded(), b = seeded();
  const x = a.standard(), y = a.standard();
  rel(a, "refers_to", x.id, y.id, x.t);
  assert.equal(a.count("law_relations"), 1);
  assert.equal(b.count("law_relations"), 0);
  assert.ok(a.law instanceof LawRecords && b.law instanceof LawRecords);
});
