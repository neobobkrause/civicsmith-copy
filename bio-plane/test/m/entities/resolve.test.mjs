/* entities' recogniser and testimony at its interface: R9–R13, R27. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";

test("R9 the cascade: A on the reference's fold, else B on the key's (differing from the reference's), else C on the label's, else unresolved; every matching entity at that tier; it stops at the first tier for every entity", () => {
  const { e, read } = world();
  const byRef = e.createEntity({ note: "a subject the test registers", kind: "ordinance", label: "Ord One", aliases: ["ord:26-1"] }).entity_id;
  const byKey = e.createEntity({ note: "a subject the test registers", kind: "ordinance", label: "Ord Two", aliases: ["26-2"] }).entity_id;
  const byKey2 = e.createEntity({ note: "a subject the test registers", kind: "fund", label: "Other", aliases: ["26-2"] }).entity_id;
  const byName = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Harbour Office" }).entity_id;
  const loser = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Clerk" }).entity_id;
  read("INFO-1", sha("r9"), [
    { kind: "ORD", key: "26-1", label: "Clerk" },          /* A on byRef; the label's C for `loser` is never minted */
    { kind: "ord", key: "26-2", label: "Harbour Office" },  /* B on both key holders; no C for byName */
    { kind: "doc", key: "9", label: "harbour  OFFICE" },    /* C */
    { kind: "doc", key: "10", label: "nobody" },           /* unresolved */
    { ref: "file:7", kind: "file", key: "file:7", label: null },  /* key folds to the reference: no B tier */
  ]);
  const r = e.resolve({ captureSha: sha("r9"), resolvedBy: MACHINE });
  const got = r.resolved.map((m) => [m.ref, m.entity_id, m.grade]).sort();
  assert.deepEqual(got, [["doc:9", byName, "C"], ["ORD:26-1", byRef, "A"], ["ord:26-2", byKey, "B"], ["ord:26-2", byKey2, "B"]].sort());
  assert.ok(!got.some(([, id]) => id === loser), "an A on one entity suppresses a C on another (the fall-through arm)");
  const a = r.resolved.find((m) => m.grade === "A");
  assert.equal(a.basis, "ORD:26-1", "the reference as the reading carries it; matched on its fold");
  assert.match(a.method, /composite key/);
  const b = r.resolved.find((m) => m.grade === "B");
  assert.equal(b.basis, "26-2");
  assert.match(b.method, /key '26-2'/);
  const c = r.resolved.find((m) => m.grade === "C");
  assert.equal(c.basis, "harbour  OFFICE");
  assert.match(c.method, /correspondence/);
  assert.deepEqual(r.unresolved.map((u) => u.ref).sort(), ["doc:10", "file:7"]);
  assert.ok(!r.resolved.some((m) => m.grade === "D"), "never a D");
});

test("R10 a resolution is keyed (capture, reference, entity): a stronger grade raises in place with raised_from, an equal or weaker one is kept; established only for A and B, needs_confirmation for C", () => {
  const { e, read, rows } = world();
  const ent = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Port Office" }).entity_id;
  read("INFO-1", sha("r10"), [{ kind: "po", key: "1", label: "Port Office" }]);
  const c = e.resolve({ captureSha: sha("r10") }).resolved[0];
  assert.deepEqual([c.grade, c.established, c.needs_confirmation, c.raised], ["C", false, true, false]);
  assert.equal(e.resolve({ captureSha: sha("r10") }).resolved[0].kept, true, "an equal grade is kept");
  e.addAlias({ entityId: ent, alias: "po:1" });
  const a = e.resolve({ captureSha: sha("r10") }).resolved[0];
  assert.deepEqual([a.grade, a.raised, a.raised_from, a.established, a.needs_confirmation], ["A", true, "C", true, false]);
  assert.equal(rows(`SELECT COUNT(*) AS n FROM resolutions`)[0].n, 1, "never a second row");
  const t = e.testify({ captureSha: sha("r10"), ref: "po:1", entityId: ent, basis: "b" });
  assert.deepEqual([t.grade, t.kept], ["A", true], "testimony after an A keeps the A");
  assert.equal(rows(`SELECT grade, established FROM resolutions`)[0].grade, "A");
  /* B is established */
  const k = e.createEntity({ note: "a subject the test registers", kind: "office", label: "K", aliases: ["77"] }).entity_id;
  read("INFO-2", sha("r10b"), [{ kind: "k", key: "77", label: "x" }]);
  const bb = e.resolve({ captureSha: sha("r10b") }).resolved.find((m) => m.entity_id === k);
  assert.deepEqual([bb.grade, bb.established, bb.needs_confirmation], ["B", true, false]);
});

test("R11 resolve refuses NO_SHA, NO_REF, then NO_SUCH_REFERENCE; without ref every reference in one transaction; the counts; the per-item set form (C-75)", () => {
  const { e, read } = world();
  e.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha" });
  read("INFO-1", sha("r11"), [{ kind: "a", key: "1", label: "Alpha" }, { kind: "b", key: "2", label: "Nobody" }]);
  read("INFO-2", sha("r11b"), [{ kind: "c", key: "3", label: "Alpha" }]);
  assert.equal(e.resolve({}).reason, "NO_SHA");
  assert.equal(e.resolve({ captureSha: sha("r11"), ref: "" }).reason, "NO_REF");
  assert.equal(e.resolve({ captureSha: sha("r11"), ref: "z:9" }).reason, "NO_SUCH_REFERENCE");
  const one = e.resolve({ captureSha: sha("r11"), ref: "a:1" });
  assert.deepEqual([one.references, one.resolved_count, one.unresolved_count], [1, 1, 0]);
  const all = e.resolve({ captureSha: sha("r11") });
  assert.deepEqual([all.references, all.resolved_count, all.unresolved_count], [2, 1, 1]);
  assert.deepEqual(all.unresolved, [{ ref: "b:2", kind: "b", key: "2", label: "Nobody" }]);
  const none = e.resolve({ captureSha: sha("never-read") });
  assert.deepEqual([none.ok, none.references], [true, 0]);
  const set = e.resolve({ items: [{ captureSha: sha("r11b") }, { captureSha: "" }, "x"], resolvedBy: MACHINE });
  assert.equal(set.op, "resolve");
  assert.equal(set.weight, "per-item");
  assert.equal(set.count, 3);
  assert.deepEqual(set.items.map((i) => i.outcome), ["applied", "retained", "retained"]);
  assert.equal(set.items[0].resolved[0].resolved_by, MACHINE);
  assert.equal(set.items[1].reason, "NO_SHA");
  assert.equal(e.resolve({ items: [] }).reason, "SET_NO_ITEMS");
});

test("R12 testify refuses NO_SHA, NO_REF, NO_ENTITY, the act-shape NO_BASIS, NO_SUCH_REFERENCE, then NO_SUCH_ENTITY; records D, never established, a method naming the testifier and basis; never lowers", () => {
  const { e, read } = world();
  const ent = e.createEntity({ note: "a subject the test registers", kind: "person", label: "Pat" }).entity_id;
  read("INFO-1", sha("r12"), [{ kind: "x", key: "1", label: "unrelated" }]);
  const base = { captureSha: sha("r12"), ref: "x:1", entityId: ent, basis: "I saw it", resolvedBy: "member:ann" };
  assert.equal(e.testify({ ...base, captureSha: "" }).reason, "NO_SHA");
  assert.equal(e.testify({ ...base, ref: "" }).reason, "NO_REF");
  assert.equal(e.testify({ ...base, entityId: "" }).reason, "NO_ENTITY");
  const nb = e.testify({ ...base, basis: "  " });
  assert.deepEqual([nb.reason, nb.code, !!nb.check, !!nb.translation], ["NO_BASIS", "NO_BASIS", true, true]);
  assert.equal(e.testify({ ...base, ref: "x:2" }).reason, "NO_SUCH_REFERENCE");
  assert.equal(e.testify({ ...base, entityId: "ENT-2026-0404" }).reason, "NO_SUCH_ENTITY");
  const t = e.testify(base);
  assert.deepEqual([t.ok, t.grade_declared, t.grade, t.established, t.needs_confirmation], [true, "D", "D", false, false]);
  assert.match(t.method, /member:ann/);
  assert.match(t.method, /stated basis/);
  assert.equal(t.basis, "I saw it");
  assert.equal(t.resolved_by, "member:ann");
  const again = e.testify({ ...base, basis: "again" });
  assert.equal(again.kept, true);
});

test("R13 onResolved and onResolveAttempt: one registration per module (LISTENER_DECLARED); resolved listeners per insert or raise, none for a kept one; attempt listeners per reference tried; a throwing listener fails the resolve and rolls it back", () => {
  const { e, read, rows } = world();
  const ent = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha" }).entity_id;
  read("INFO-1", sha("r13"), [{ kind: "a", key: "1", label: "Alpha" }, { kind: "b", key: "2", label: "nobody" }]);
  const resolved = [], attempts = [];
  assert.equal(e.onResolved("connections", (x) => resolved.push(x)).ok, true);
  assert.equal(e.onResolved("connections", () => {}).reason, "LISTENER_DECLARED");
  assert.equal(e.onResolveAttempt("observation-log", (x) => attempts.push(x)).ok, true);
  assert.equal(e.onResolveAttempt("observation-log", () => {}).reason, "LISTENER_DECLARED");
  e.resolve({ captureSha: sha("r13"), resolvedBy: MACHINE });
  assert.deepEqual(resolved, [{ entityId: ent, captureSha: sha("r13"), ref: "a:1", grade: "C", raised: false }]);
  assert.equal(attempts.length, 2);
  const [a0, a1] = attempts;
  assert.deepEqual([a0.captureSha, a0.bundleId, a0.ref, a0.matches.length, a0.resolvedBy], [sha("r13"), "INFO-1", "a:1", 1, MACHINE]);
  assert.match(a0.considered, /composite key/);
  assert.deepEqual([a1.ref, a1.matches.length], ["b:2", 0]);
  e.resolve({ captureSha: sha("r13") });
  assert.equal(resolved.length, 1, "a kept resolution runs none");
  e.addAlias({ entityId: ent, alias: "a:1" });
  e.resolve({ captureSha: sha("r13") });
  assert.deepEqual(resolved.at(-1), { entityId: ent, captureSha: sha("r13"), ref: "a:1", grade: "A", raised: true });
  e.testify({ captureSha: sha("r13"), ref: "b:2", entityId: ent, basis: "b" });
  assert.equal(resolved.at(-1).grade, "D");
  /* a listener that throws fails the resolve */
  const { e: e2, read: read2, rows: rows2 } = world();
  e2.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha" });
  read2("INFO-1", sha("r13x"), [{ kind: "a", key: "1", label: "Alpha" }]);
  e2.onResolved("connections", () => { throw new Error("listener down"); });
  assert.throws(() => e2.resolve({ captureSha: sha("r13x") }), /listener down/);
  assert.equal(rows2(`SELECT COUNT(*) AS n FROM resolutions`)[0].n, 0, "rolled back");
  assert.equal(rows(`SELECT COUNT(*) AS n FROM resolutions`)[0].n, 2);
});

test("R27 grade states how a reference was matched and nothing else: a C never reads as established, the recogniser never mints D, a held grade only rises", () => {
  const { e, read } = world();
  const ent = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Beta" }).entity_id;
  read("INFO-1", sha("r27"), [{ kind: "b", key: "1", label: "Beta" }]);
  e.testify({ captureSha: sha("r27"), ref: "b:1", entityId: ent, basis: "said so" });
  const c = e.resolve({ captureSha: sha("r27") }).resolved[0];
  assert.deepEqual([c.grade, c.raised_from, c.established], ["C", "D", false]);
  for (const r of e.resolutionsFor({ captureSha: sha("r27"), viewer: MACHINE }).resolutions)
    assert.equal(r.established, false);
  e.addAlias({ entityId: ent, alias: "1" });
  assert.equal(e.resolve({ captureSha: sha("r27") }).resolved[0].grade, "B");
  e.withdrawAlias({ entityId: ent, alias: "1", reason: "wrong" });
  e.withdrawAlias({ entityId: ent, alias: "Beta", reason: "wrong" });
  assert.equal(e.resolve({ captureSha: sha("r27") }).resolved_count, 0);
  assert.equal(e.resolutionsFor({ captureSha: sha("r27"), viewer: MACHINE }).resolutions[0].grade, "B", "never falls");
});

test("R33 gradeRank ranks the catalogue's grades in its own order, strongest highest; no other value has a rank", async () => {
  const { gradeRank } = await import("../../../src/entities/index.mjs");
  const { BASIS_GRADES } = await import("../../../src/record-grammar/grades.mjs");
  assert.deepEqual(Object.keys(gradeRank), [...BASIS_GRADES]);
  for (let i = 1; i < BASIS_GRADES.length; i++) assert.ok(gradeRank[BASIS_GRADES[i - 1]] > gradeRank[BASIS_GRADES[i]]);
  assert.deepEqual(gradeRank, { A: 4, B: 3, C: 2, D: 1 });
  for (const v of [null, undefined, "", "E", "a", "established"]) assert.equal(gradeRank[v], undefined);
  assert.ok(Object.isFrozen(gradeRank));
  /* the rank R10 raises by: D < C < B < A */
  const { e, read } = world();
  const ent = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Rank" }).entity_id;
  read("INFO-1", sha("r33"), [{ kind: "k", key: "1", label: "Rank" }]);
  e.testify({ captureSha: sha("r33"), ref: "k:1", entityId: ent, basis: "b" });
  assert.equal(e.resolve({ captureSha: sha("r33") }).resolved[0].raised_from, "D");
});

test("R34 isEstablished(grade) is true exactly for A and B", async () => {
  const { isEstablished } = await import("../../../src/entities/index.mjs");
  assert.deepEqual(["A", "B", "C", "D", null, undefined, "", "a", "E"].map((g) => isEstablished(g)),
                   [true, true, false, false, false, false, false, false, false]);
});

test("R13 (N202) registrations are refused through membership's listenerRefusal (LISTENER_MALFORMED, LISTENER_DECLARED) and the listeners run in the modules' total order, whatever order they registered in", async () => {
  const { listenerRefusal, MODULE_ORDER } = await import("../../../src/membership/index.mjs");
  const { e, read } = world();
  e.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha" });
  read("INFO-1", sha("r13o"), [{ kind: "a", key: "1", label: "Alpha" }]);
  const f = () => {};
  for (const reg of ["onResolved", "onResolveAttempt"]) {
    for (const [m, fn] of [["", f], [null, f], ["bias", null], ["bias", "fn"]])
      assert.deepEqual(e[reg](m, fn), listenerRefusal([], m, fn), `${reg} ${m} ${fn}`);
    assert.equal(e[reg]("", f).code, "LISTENER_MALFORMED");
  }
  const order = [], attempts = [];
  /* registered against the order: a later module first, then an unknown one, then earlier ones */
  for (const m of ["observation-log", "zz-unlisted", "connections", "progressions"]) {
    assert.equal(e.onResolved(m, () => order.push(m)).ok, true);
    assert.equal(e.onResolveAttempt(m, () => attempts.push(m)).ok, true);
  }
  const dup = e.onResolved("connections", f);
  assert.deepEqual(dup, listenerRefusal([{ module: "connections" }], "connections", f));
  assert.deepEqual([dup.code, dup.module], ["LISTENER_DECLARED", "connections"]);
  e.resolve({ captureSha: sha("r13o") });
  /* the expected order is MODULE_ORDER's own (K1543): under T33 observation-log precedes progressions */
  const byOrder = ["observation-log", "connections", "progressions"].sort((x, y) => MODULE_ORDER.indexOf(x) - MODULE_ORDER.indexOf(y));
  assert.ok(byOrder.every((m) => MODULE_ORDER.includes(m)), "each listed module is in the total order");
  assert.deepEqual(order, [...byOrder, "zz-unlisted"], "total order, a module not in it last");
  assert.deepEqual(attempts, [...byOrder, "zz-unlisted"]);
});
