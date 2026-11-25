/* entities' module-level services and its stated read contract at its interface: R35, R36, R37 (and R11, R12, R14 through extraction's noSha). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { noSuchEntity, noEntity, NO_ENTITY_DETAIL, ENTITY_CHECKS, isEstablished } from "../../../src/entities/index.mjs";
import { noSha, NO_SHA_DETAIL, EXTRACTION_CHECKS } from "../../../src/extraction/index.mjs";

test("R35 the read contract: entities(entity_id key, kind the entity's kind (K1563), at the instant R1 answers) and resolutions(capture_sha, bundle_id, ref, entity_id, grade, established), established 1 exactly when R34 holds of the grade", () => {
  const { e, read, rows } = world();
  const cols = (t) => rows(`PRAGMA table_info(${t})`);
  const ent = cols("entities");
  assert.deepEqual(ent.filter((c) => c.pk).map((c) => c.name), ["entity_id"], "entity_id is the key");
  assert.ok(ent.some((c) => c.name === "at"));
  assert.ok(ent.some((c) => c.name === "kind"), "kind is in the contract (K1563)");
  const res = cols("resolutions").map((c) => c.name);
  for (const c of ["capture_sha", "bundle_id", "ref", "entity_id", "grade", "established"]) assert.ok(res.includes(c), c);
  /* `at` is the instant the entity was created, the time R1 answers */
  const made = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha", aliases: ["a:1", "22"] });
  assert.equal(rows(`SELECT at FROM entities WHERE entity_id=?`, made.entity_id)[0].at, made.at);
  /* `kind` is the kind R1 answers and R5 reads, one of the closed list, for every kind (retrieval reads person/post) */
  for (const kind of e.kinds()) {
    const k = kind === "proceeding" ? null : e.createEntity({ note: "a subject the test registers", kind, label: `K ${kind}` });
    if (!k) continue;
    assert.equal(rows(`SELECT kind FROM entities WHERE entity_id=?`, k.entity_id)[0].kind, k.kind, kind);
    assert.equal(e.readEntity({ entityId: k.entity_id }).entity.kind, kind);
  }
  assert.equal(rows(`SELECT kind FROM entities WHERE entity_id=?`, made.entity_id)[0].kind, "office");
  e.createEntity({ note: "a subject the test registers", kind: "office", label: "Beta" });
  /* every grade the record can hold, written by every path that writes one: A, B, C by the recogniser, D by
     testimony, and a raise in place (R10) */
  read("INFO-1", sha("k1"), [{ kind: "a", key: "1", label: "x" }, { kind: "b", key: "22", label: "y" },
                              { kind: "c", key: "3", label: "Alpha" }, { kind: "d", key: "4", label: "nobody" },
                              { kind: "e", key: "5", label: "Beta" }]);
  e.testify({ captureSha: sha("k1"), ref: "e:5", entityId: made.entity_id, basis: "said so" });
  e.resolve({ captureSha: sha("k1"), resolvedBy: MACHINE });
  e.testify({ captureSha: sha("k1"), ref: "d:4", entityId: made.entity_id, basis: "said so" });
  e.addAlias({ entityId: made.entity_id, alias: "d:4" });
  e.resolve({ captureSha: sha("k1") });   /* raises d:4 from D to A */
  const held = rows(`SELECT capture_sha, bundle_id, ref, entity_id, grade, established FROM resolutions`);
  assert.deepEqual([...new Set(held.map((r) => r.grade))].sort(), ["A", "B", "C", "D"]);
  assert.ok(held.some((r) => r.ref === "d:4" && r.grade === "A"), "a raised row");
  for (const r of held) {
    assert.equal(r.established, isEstablished(r.grade) ? 1 : 0, `${r.ref} ${r.grade}`);
    assert.equal(r.capture_sha, sha("k1"));
    assert.equal(r.bundle_id, "INFO-1");
    assert.ok(rows(`SELECT 1 AS x FROM entities WHERE entity_id=?`, r.entity_id).length, "entity_id names a registered entity");
  }
  /* a later module joins them in its own SQL, as retrieval's frontier and contradiction do */
  const joined = rows(`SELECT r.capture_sha, e.at FROM resolutions r JOIN entities e ON e.entity_id = r.entity_id
                        WHERE r.established = 1 ORDER BY r.ref`);
  assert.deepEqual(joined.map((j) => j.at), held.filter((r) => isEstablished(r.grade)).sort((a, b) => a.ref < b.ref ? -1 : 1)
    .map((r) => rows(`SELECT at FROM entities WHERE entity_id=?`, r.entity_id)[0].at));
});

test("R36 noSuchEntity answers the one refusal: reason and code NO_SUCH_ENTITY, its row's check and translation, the id as asked, one fixed detail; extra adds and never replaces; writes nothing, never throws", () => {
  const row = ENTITY_CHECKS.NO_SUCH_ENTITY;
  assert.ok(row.check && row.translation);
  assert.match(row.where, /^src\/entities\/index\.mjs noSuchEntity > is-entity-registered$/);
  assert.ok(!/oakland|alameda|legistar/i.test(row.translation), "R31");
  const a = noSuchEntity("ENT-2026-0404");
  assert.deepEqual(Object.keys(a).sort(), ["check", "code", "detail", "entity_id", "ok", "reason", "translation"]);
  assert.deepEqual([a.ok, a.reason, a.code, a.check, a.translation, a.entity_id], [false, "NO_SUCH_ENTITY", "NO_SUCH_ENTITY", row.check, row.translation, "ENT-2026-0404"]);
  assert.equal(typeof a.detail, "string");
  assert.ok(a.detail.length > 0);
  const b = noSuchEntity("x", { end: "to", reason: "OTHER", code: "X", check: "C-0", translation: "t", entity_id: "y", detail: "d", ok: true });
  assert.deepEqual({ ...b }, { ...noSuchEntity("x"), end: "to" }, "extra adds its own fields and replaces none");
  assert.equal(b.detail, a.detail, "the same detail for every caller");
  assert.equal(noSuchEntity(undefined).entity_id, null);
  for (const extra of [null, undefined, 7, "s", [1, 2], new Proxy({}, { ownKeys() { throw new Error("hostile"); } })])
    assert.doesNotThrow(() => noSuchEntity("x", extra));
  /* writes nothing: a pure function of its arguments, the registry untouched */
  const { e, rows } = world();
  const before = rows(`SELECT COUNT(*) AS n FROM entities`)[0].n;
  noSuchEntity("ENT-2026-0001");
  assert.equal(rows(`SELECT COUNT(*) AS n FROM entities`)[0].n, before);
  assert.equal(e.has("ENT-2026-0404"), false);
});

test("R36 every act of this module answering the condition answers through noSuchEntity: R2, R3 (with end), R12 and R17", () => {
  const { e, read } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "A" }).entity_id;
  read("INFO-1", sha("n36"), [{ kind: "x", key: "1", label: "A" }]);
  const gone = "ENT-2026-0404";
  assert.deepEqual(e.addAlias({ entityId: gone, alias: "x" }), noSuchEntity(gone));
  const rel = { relation: "member_of", justification: "j", citation: "c" };
  assert.deepEqual(e.declareRelation({ ...rel, fromEntity: gone, toEntity: a }), noSuchEntity(gone, { end: "from" }));
  assert.deepEqual(e.declareRelation({ ...rel, fromEntity: a, toEntity: gone }), noSuchEntity(gone, { end: "to" }));
  assert.deepEqual(e.testify({ captureSha: sha("n36"), ref: "x:1", entityId: gone, basis: "b" }), noSuchEntity(gone));
  assert.deepEqual(e.namingDocuments({ entityId: gone, viewer: MACHINE }), noSuchEntity(gone));
  /* negative control: a registered entity is not refused */
  assert.equal(e.addAlias({ entityId: a, alias: "y" }).ok, true);
});

test("R37 noEntity answers the one refusal: reason and code NO_ENTITY, its own row (C-91.5) with the required translation, the caller's detail or a fixed default; writes nothing, never throws", () => {
  const row = ENTITY_CHECKS.NO_ENTITY;
  assert.deepEqual([row.check, row.where], ["C-91.5", "src/entities/index.mjs noEntity > is-entity-named"]);
  assert.equal(row.translation, word("refusal.NO_ENTITY"));
  assert.ok(!/oakland|alameda|legistar/i.test(row.translation), "R31");
  const a = noEntity("what the id was for");
  assert.deepEqual(Object.keys(a).sort(), ["check", "code", "detail", "ok", "reason", "translation"]);
  assert.deepEqual([a.ok, a.reason, a.code, a.check, a.translation, a.detail],
                   [false, "NO_ENTITY", "NO_ENTITY", row.check, row.translation, "what the id was for"]);
  /* no sentence, or one that is not a sentence: the fixed default, the same every time */
  for (const d of [undefined, null, "", "   ", 7, {}, ["x"]]) {
    assert.doesNotThrow(() => noEntity(d));
    assert.deepEqual(noEntity(d), { ...a, detail: NO_ENTITY_DETAIL }, String(d));
  }
  assert.ok(NO_ENTITY_DETAIL.length > 0);
  assert.notEqual(ENTITY_CHECKS.NO_ENTITY.check, ENTITY_CHECKS.NO_SUCH_ENTITY.check, "its own row, apart from R36's");
  const { e, rows } = world();
  const before = rows(`SELECT (SELECT COUNT(*) FROM entities) + (SELECT COUNT(*) FROM entity_aliases) AS n`)[0].n;
  noEntity();
  assert.equal(rows(`SELECT (SELECT COUNT(*) FROM entities) + (SELECT COUNT(*) FROM entity_aliases) AS n`)[0].n, before);
  assert.equal(e.has(""), false);
});

test("R37 every act of this module answering a request that names no entity id answers through noEntity: R2, R5, R12, R15, R17 and alias withdrawal, for an id absent, not a string, or empty", () => {
  const { e, read } = world();
  read("INFO-1", sha("n37"), [{ kind: "x", key: "1", label: "A" }]);
  const acts = {
    addAlias: (id) => e.addAlias({ entityId: id, alias: "x" }),
    readEntity: (id) => e.readEntity({ entityId: id }),
    testify: (id) => e.testify({ captureSha: sha("n37"), ref: "x:1", entityId: id, basis: "b" }),
    concerns: (id) => e.concerns({ entityId: id, viewer: MACHINE }),
    namingDocuments: (id) => e.namingDocuments({ entityId: id, viewer: MACHINE }),
    withdrawAlias: (id) => e.withdrawAlias({ entityId: id, alias: "x", reason: "r" }),
  };
  for (const [name, act] of Object.entries(acts)) {
    const answers = [undefined, null, "", 42, { id: "ENT-2026-0001" }].map(act);
    for (const r of answers) {
      assert.deepEqual({ ...r, detail: null }, { ...noEntity(), detail: null }, name);
      assert.equal(typeof r.detail, "string");
      assert.ok(r.detail.length > 0);
    }
    /* each names what the id was for: its own sentence, never the default */
    assert.notEqual(answers[0].detail, NO_ENTITY_DETAIL, name);
    assert.deepEqual(answers[0], noEntity(answers[0].detail), name);
  }
  /* negative control: a named id is past this refusal */
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "A" }).entity_id;
  for (const [name, act] of Object.entries(acts)) assert.notEqual(act(a).reason, "NO_ENTITY", name);
});

test("R11 R12 R14 a request naming no capture digest answers through extraction's noSha (its R63), each act's own detail, minting no NO_SHA here", () => {
  const { e, read } = world();
  const ent = e.createEntity({ note: "a subject the test registers", kind: "office", label: "A" }).entity_id;
  read("INFO-1", sha("ns"), [{ kind: "x", key: "1", label: "A" }]);
  const acts = {
    resolve: (s) => e.resolve({ captureSha: s }),
    testify: (s) => e.testify({ captureSha: s, ref: "x:1", entityId: ent, basis: "b" }),
    resolutionsFor: (s) => e.resolutionsFor({ captureSha: s, viewer: MACHINE }),
  };
  for (const [name, act] of Object.entries(acts)) {
    const answers = [undefined, null, "", 7].map(act);
    for (const r of answers) {
      assert.deepEqual(r, noSha(r.detail), name);
      assert.deepEqual([r.reason, r.code, r.check], ["NO_SHA", "NO_SHA", EXTRACTION_CHECKS.NO_SHA.check], name);
    }
    assert.notEqual(answers[0].detail, NO_SHA_DETAIL, `${name} names what the digest was for`);
    assert.notEqual(act(sha("ns")).reason, "NO_SHA", `${name}: a named digest is past this refusal`);
  }
  /* R11's set form answers each item the single form's way */
  const set = e.resolve({ items: [{ captureSha: "" }] });
  assert.deepEqual(set.items[0].reason, "NO_SHA");
  assert.equal(set.items[0].check, EXTRACTION_CHECKS.NO_SHA.check);
  assert.ok(!Object.values(ENTITY_CHECKS).some((r) => /NO_SHA/.test(r.where)), "no row of this module's is NO_SHA's");
});
