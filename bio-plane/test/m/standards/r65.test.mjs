/* standards R65 (T53; N1260, DEC-410, DEC-447): `standardsBinding`, the standards that bind a body, read from the body.
   Driven at the module's interface over the test profile (`test-port-ellery`), through the real acts (R40, R43). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, REASON } from "./fixture.mjs";
import { WORD } from "./words.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, standardsOps } from "../../../src/standards/index.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");
const later = (w, iso) => { w.clock.now = iso; };

/* a body (a registered entity), an ordinance it issued that adopts one standard, a law imposing another on it, and a
   third standard declared a benchmark against it */
function scene(w) {
  const board = w.entity("Port Ellery Selectboard"), other = w.entity("Marlow Schools Board");
  const adoptingPassage = w.passage().contentId, lawPassage = w.passage().contentId;
  const adopted = w.declare({ cite: "MHS 101-2020 edition", kind: "standard", issuer: "MHSI", period: { from: "2020-01-01", to: null } }).id;
  const imposed = w.declare({ cite: "NFPA 1-2021", kind: "standard", issuer: "NFPA", period: { from: "2021-01-01", to: null } }).id;
  const compared = w.declare({ cite: "ISO 9001:2015", kind: "standard", issuer: "ISO", period: { from: "2015-01-01", to: null } }).id;
  const ordinance = w.declare({ cite: "PEBL § 80", text: [adoptingPassage], issuer: board }).id;
  const law = w.declare({ cite: "PEBL § 81", text: [lawPassage], issuer: "Port Ellery Selectboard" }).id;
  return { board, other, adoptingPassage, lawPassage, adopted, imposed, compared, ordinance, law };
}

function bound(w) {
  const s = scene(w);
  /* the imposition first and the adoption later, so newest first puts the adoption first, which no sort by kind
     descending, by id or by insertion order would (attempt 1's review, B) */
  later(w, "2026-09-28T02:00:00.000Z");
  const i = w.s.impositionRecord({ standard: s.imposed, body: s.board, law: s.law, citation: s.lawPassage, reason: REASON,
                                   author: V("alice"), viewer: V("alice") });
  assert.equal(i.ok, true, JSON.stringify(i).slice(0, 300));
  later(w, "2026-09-28T03:00:00.000Z");
  const a = w.s.adoptionRecord({ standard: s.adopted, act: s.ordinance, edition: "2020", from: "2021-07-01", mode: "by_reference",
                                 citation: s.adoptingPassage, reason: REASON, author: V("bob"), viewer: V("bob") });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  later(w, "2026-09-28T04:00:00.000Z");
  const b = w.s.benchmarkDeclare({ standard: s.compared, body: s.board, reason: REASON, author: V("bob"), viewer: V("bob") });
  assert.equal(b.ok, true, JSON.stringify(b).slice(0, 300));
  return { ...s, a, i, b };
}

test("R65 standardsBinding answers a body's adoption and imposition with their standards and says, newest first, and never its benchmark declaration; it writes nothing", () => {
  const w = seeded();
  const s = bound(w);
  const before = w.snapshot();
  const r = w.s.standardsBinding({ body: s.board, viewer: V("carol") });
  const says = WORD("standard.binding.binds", { body: "Port Ellery Selectboard" });
  assert.ok(s.a.adoption.at > s.i.imposition.at, "the adoption is the newer record");
  assert.deepEqual(r, { ok: true, body: s.board, limit: 50, truncated: false, bindings: [
    { kind: "adoption", id: s.a.adoption.id, body: s.board, act: s.ordinance, edition: "2020", from: { date: "2021-07-01" },
      mode: "by_reference", citation: s.adoptingPassage, by: V("bob"), at: s.a.adoption.at, says,
      standard: s.adopted, title: "MHS 101-2020 edition" },
    { kind: "imposition", id: s.i.imposition.id, body: s.board, law: s.law, citation: s.lawPassage, by: V("alice"),
      at: s.i.imposition.at, says, standard: s.imposed, title: "NFPA 1-2021" },
  ] });
  assert.equal(JSON.stringify(r).includes(s.b.benchmark.id), false, "the benchmark is no binding");
  assert.deepEqual(w.snapshot(), before, "it writes nothing and records no one");
  /* the door answers as the read does */
  const door = standardsOps(w.s, new URL(`http://x/?op=standardsbinding&body=${s.board}&viewer=${encodeURIComponent(V("carol"))}`), {}).standardsbinding();
  assert.deepEqual(door, r);
});

test("R65 limit: 1 answers one record with truncated: true and a next that continues to the other; a limit outside 1 to 200 is refused STANDARD_LIMIT_INVALID", () => {
  const w = seeded();
  const s = bound(w);
  const p1 = w.s.standardsBinding({ body: s.board, limit: 1, viewer: V("carol") });
  assert.deepEqual([p1.limit, p1.truncated, p1.next, p1.bindings.map((x) => x.id)], [1, true, s.a.adoption.id, [s.a.adoption.id]]);
  const p2 = w.s.standardsBinding({ body: s.board, limit: 1, after: p1.next, viewer: V("carol") });
  assert.deepEqual([p2.truncated, p2.next, p2.bindings.map((x) => x.id)], [false, undefined, [s.i.imposition.id]]);
  /* through the door, as strings */
  const door = standardsOps(w.s, new URL(`http://x/?body=${s.board}&limit=1&after=${p1.next}&viewer=${encodeURIComponent(V("carol"))}`), {}).standardsbinding();
  assert.deepEqual(door.bindings.map((x) => x.id), [s.i.imposition.id]);
  for (const limit of [0, 201, -1, 1.5, "abc", "0", "201"])
    assert.equal(codeOf(w.s.standardsBinding({ body: s.board, limit, viewer: V("carol") })), "STANDARD_LIMIT_INVALID", String(limit));
  for (const limit of [1, 200, "200", null, ""])
    assert.equal(codeOf(w.s.standardsBinding({ body: s.board, limit, viewer: V("carol") })), "ok", String(limit));
  assert.equal(w.s.standardsBinding({ body: s.board, limit: 200, viewer: V("carol") }).bindings.length, 2);
});

test("R65 newest first by when each was recorded, whatever its kind: a later imposition comes before the adoption, which comes before the earlier imposition", () => {
  const w = seeded();
  const s = bound(w);
  const third = w.declare({ cite: "ICC IFC-2024", kind: "standard", issuer: "ICC", period: { from: "2024-01-01", to: null } }).id;
  const thirdPassage = w.passage().contentId;
  const thirdLaw = w.declare({ cite: "PEBL § 82", text: [thirdPassage], issuer: "Port Ellery Selectboard" }).id;
  later(w, "2026-09-28T05:00:00.000Z");
  const i2 = w.s.impositionRecord({ standard: third, body: s.board, law: thirdLaw, citation: thirdPassage, reason: REASON,
                                    author: V("alice"), viewer: V("alice") });
  assert.equal(i2.ok, true, JSON.stringify(i2).slice(0, 300));
  const r = w.s.standardsBinding({ body: s.board, viewer: V("carol") });
  assert.deepEqual(r.bindings.map((x) => [x.kind, x.id, x.standard]),
                   [["imposition", i2.imposition.id, third], ["adoption", s.a.adoption.id, s.adopted], ["imposition", s.i.imposition.id, s.imposed]]);
  /* paging walks the same order */
  const ids = [];
  let after = null;
  for (let k = 0; k < 4; k++) {
    const p = w.s.standardsBinding({ body: s.board, limit: 1, after, viewer: V("carol") });
    ids.push(...p.bindings.map((x) => x.id));
    if (!p.truncated) { assert.equal(p.next, undefined); break; }
    after = p.next;
  }
  assert.deepEqual(ids, r.bindings.map((x) => x.id));
});

test("R65 R37 a standard the viewer may not see contributes no record and is not counted: the answer is the same as for a body with none", () => {
  const w = seeded();
  const board = w.entity("Port Ellery Selectboard");
  const P = w.project("Source material", "alice");
  const hidden = w.passage("leaked", { text: "Staff shall follow the waiver procedure." });
  w.st.sql.exec(`UPDATE content SET bundle_id=? WHERE content_id=?`, P, hidden.contentId);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, P, hidden.bundleId);
  const policy = w.declare({ cite: "HSO 4/21 para 3", kind: "policy", issuer: "Harbour Master", text: [hidden.contentId],
                             author: V("alice"), viewer: V("alice") });
  assert.equal(policy.ok, true, JSON.stringify(policy).slice(0, 300));
  const lawPassage = w.passage().contentId;
  const law = w.declare({ cite: "PEBL § 81", text: [lawPassage], issuer: "Port Ellery Selectboard" }).id;
  const i = w.s.impositionRecord({ standard: policy.id, body: board, law, citation: lawPassage, reason: REASON,
                                   author: V("alice"), viewer: V("alice") });
  assert.equal(i.ok, true, JSON.stringify(i).slice(0, 300));
  /* a second hidden record, so that a read counting hidden records would answer truncated at limit 1 (attempt 1's review, A) */
  const policy2 = w.declare({ cite: "HSO 5/21 para 1", kind: "policy", issuer: "Harbour Master", text: [hidden.contentId],
                              author: V("alice"), viewer: V("alice") });
  assert.equal(policy2.ok, true, JSON.stringify(policy2).slice(0, 300));
  const lawPassage2 = w.passage().contentId;
  const law2 = w.declare({ cite: "PEBL § 83", text: [lawPassage2], issuer: "Port Ellery Selectboard" }).id;
  const i2 = w.s.impositionRecord({ standard: policy2.id, body: board, law: law2, citation: lawPassage2, reason: REASON,
                                    author: V("alice"), viewer: V("alice") });
  assert.equal(i2.ok, true, JSON.stringify(i2).slice(0, 300));
  const seen = w.s.standardsBinding({ body: board, viewer: V("alice") });
  assert.deepEqual(seen.bindings.map((x) => x.standard).sort(), [policy.id, policy2.id].sort(), "who may see them is told them");
  /* control: for who may see them, limit 1 is truncated */
  const seen1 = w.s.standardsBinding({ body: board, limit: 1, viewer: V("alice") });
  assert.deepEqual([seen1.truncated, seen1.bindings.length, typeof seen1.next], [true, 1, "string"]);
  const other = w.s.standardsBinding({ body: board, limit: 1, viewer: V("carol") });
  const none = w.s.standardsBinding({ body: w.entity("Marlow Schools Board"), limit: 1, viewer: V("carol") });
  assert.deepEqual(other, { ...none, body: board });
  assert.deepEqual(other.bindings, []);
  assert.equal(other.truncated, false);
  assert.equal("next" in other, false);
  assert.equal(JSON.stringify(other).includes(policy.id) || JSON.stringify(other).includes(policy2.id), false);
  /* one visible record beside the two hidden: at limit 1 the viewer who may not see them gets it alone, untruncated */
  const open = w.declare({ cite: "NFPA 101-2021", kind: "standard", issuer: "NFPA", period: { from: "2021-01-01", to: null } }).id;
  const lawPassage3 = w.passage().contentId;
  const law3 = w.declare({ cite: "PEBL § 84", text: [lawPassage3], issuer: "Port Ellery Selectboard" }).id;
  const i3 = w.s.impositionRecord({ standard: open, body: board, law: law3, citation: lawPassage3, reason: REASON,
                                    author: V("alice"), viewer: V("alice") });
  assert.equal(i3.ok, true, JSON.stringify(i3).slice(0, 300));
  const mixed = w.s.standardsBinding({ body: board, limit: 1, viewer: V("carol") });
  assert.deepEqual([mixed.truncated, "next" in mixed, mixed.bindings.map((x) => x.id)], [false, false, [i3.imposition.id]]);
});

test("R65 an empty body is NO_ENTITY, a body the record lacks NO_SUCH_ENTITY, and a body bound by nothing answers bindings: []; standardRead's bindings (R63) answer as before", () => {
  const w = seeded();
  const s = bound(w);
  for (const body of [null, undefined, "", "   "])
    assert.equal(codeOf(w.s.standardsBinding({ body, viewer: V("carol") })), "NO_ENTITY", String(body));
  const unknown = w.s.standardsBinding({ body: "ENT-2026-9999", viewer: V("carol") });
  assert.equal(codeOf(unknown), "NO_SUCH_ENTITY");
  assert.deepEqual(w.s.standardsBinding({ body: s.other, viewer: V("carol") }),
                   { ok: true, body: s.other, bindings: [], limit: 50, truncated: false });
  /* control: R63 answers each standard's records as before, the benchmark included and no `standard` or `title` added */
  const read = (id) => w.s.standardRead({ id, viewer: V("carol") }).bindings;
  assert.deepEqual(read(s.compared).map((x) => [x.kind, x.id, x.body]), [["benchmark", s.b.benchmark.id, s.board]]);
  assert.deepEqual(read(s.imposed).map((x) => Object.keys(x).sort()),
                   [["at", "body", "by", "citation", "id", "kind", "law", "says"]]);
  assert.deepEqual(read(s.adopted).map((x) => [x.kind, x.id, x.act]), [["adoption", s.a.adoption.id, s.ordinance]]);
});

test("R65 standards declares standardsbinding: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  const mkEnv = () => { const w = seeded(); w.board = w.entity("Port Ellery Selectboard"); return w; };
  const call = async (given) => {
    const env = mkEnv();
    const fields = "body" in given ? { ...given, body: env.board } : given;
    const q = new URLSearchParams({ op: "standardsbinding", viewer: V("bob"),
      ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
    return standardsOps(env.s, new URL("http://x/?" + q), fields).standardsbinding();
  };
  const named = (answer, field) => !!answer && answer.ok === false
    && ({ body: ["NO_ENTITY"], limit: ["STANDARD_LIMIT_INVALID"], after: ["STANDARD_FIELD_INVALID"] }[field] || []).includes(answer.code);
  await declaredOpHolds({ op: "standardsbinding", declaration: DECLARED_OPS.standardsbinding, call, refusedNaming: named,
    same: (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason) });
});
