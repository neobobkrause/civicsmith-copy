/* entities at T50 (T50-59; N1190, N1193, N1092, N1086, N1116; K3598, K3630; DEC-300 (1)): R54 a body or institution may carry
   a forum kind; R55 `aliasesOf`; R56 `labelsOf`; R35's `label` read column; and plan rule 6, the words by key (setup-words).
   Every test drives `entities` at its interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { world, sha, MACHINE } from "./fixture.mjs";
import { FORUM_KINDS, FORUM_ENTITY_KINDS, ENTITY_KINDS, ALIASES_LIMIT_DEFAULT, ALIASES_LIMIT_MAX, LABELS_IDS_MAX, WORD_KEYS,
         IDSPACE_CHECKS, ENTITY_CHECKS, entitiesOps, noSuchEntity, noEntity, notAProceeding } from "../../../src/entities/index.mjs";
import { FORUM_KINDS as JURISDICTION_FORUM_KINDS } from "../../../../jurisdictions/index.mjs";
import { word, hasWord, WORD_ROWS } from "../../../src/setup-words/index.mjs";

const NOTE = "a subject the test registers";
const VIEWER = "member:ann";
const count = (w, t) => w.rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;
const ops = (w, op, params = {}, body = null) => {
  const url = new URL("https://x.example/");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return entitiesOps(w.e, url, body)[op]();
};
const raw = (key) => WORD_ROWS.find((r) => r[0] === key)[1];

/* ---------------------------------------------------------------- R54 */

test("R54 the forum kinds are jurisdictions' FORUM_KINDS, the one list: this module exports that same list and holds no copy", () => {
  assert.equal(FORUM_KINDS, JURISDICTION_FORUM_KINDS);
  assert.deepEqual([...FORUM_KINDS], ["court", "commission", "grand_jury", "auditor", "other"]);
  assert.deepEqual([...FORUM_ENTITY_KINDS], ["body", "institution"]);
});

test("R54 entitycreate of a body with forum_kind court is answered by entitieskind with kind body and that forum_kind, and by readEntity; each FORUM_KINDS member is accepted for a body and an institution", () => {
  const w = world({ profiles: ["test-port-ellery"] });
  const made = ops(w, "entitycreate", {}, { kind: "body", label: "Marlow County Superior Court", note: NOTE, forum_kind: "court", declaredBy: VIEWER });
  assert.deepEqual([made.ok, made.kind, made.forum_kind], [true, "body", "court"]);
  assert.equal(w.e.readEntity({ entityId: made.entity_id }).entity.forum_kind, "court");
  assert.equal(w.rows(`SELECT forum_kind FROM entities WHERE entity_id=?`, made.entity_id)[0].forum_kind, "court");
  const listed = ops(w, "entitieskind", { kind: "body", viewer: VIEWER });
  assert.deepEqual(listed.entities.map((e) => [e.entity_id, e.kind, e.forum_kind, e.label]), [[made.entity_id, "body", "court", "Marlow County Superior Court"]]);
  assert.equal(ops(w, "entity", { id: made.entity_id, viewer: VIEWER }).entity.forum_kind, "court");
  assert.equal(ops(w, "entitybyalias", { alias: "marlow county superior court", viewer: VIEWER }).entities[0].forum_kind, "court");
  for (const kind of ["body", "institution"])
    for (const fk of FORUM_KINDS) {
      const r = w.e.createEntity({ kind, label: `${kind} ${fk}`, note: NOTE, forum_kind: fk });
      assert.deepEqual([r.ok, r.forum_kind], [true, fk], `${kind} ${fk}`);
      assert.equal(w.e.readEntity({ entityId: r.entity_id }).entity.forum_kind, fk);
    }
});

test("R54 absent, none is held (never guessed, never other): a body, an institution or an office without one reads null, and is in no forum_kind filter", () => {
  const w = world();
  const a = w.e.createEntity({ kind: "body", label: "Harbour Commission", note: NOTE }).entity_id;
  const b = w.e.createEntity({ kind: "institution", label: "Harbour Trust", note: NOTE, forum_kind: null }).entity_id;
  const c = w.e.createEntity({ kind: "office", label: "Harbour Clerk", note: NOTE }).entity_id;
  const court = w.e.createEntity({ kind: "body", label: "Harbour Court", note: NOTE, forum_kind: "court" }).entity_id;
  for (const id of [a, b, c]) assert.equal(w.e.readEntity({ entityId: id }).entity.forum_kind, null, id);
  assert.equal(w.e.createEntity({ kind: "body", label: "B", note: NOTE }).forum_kind, null);
  assert.equal("forum_kind" in w.e.createEntity({ kind: "office", label: "O", note: NOTE }), false, "an office answers none");
  const all = w.e.entitiesOfKind({ kind: "body", viewer: VIEWER }).entities;
  assert.deepEqual(all.map((e) => [e.label, e.forum_kind]), [["Harbour Commission", null], ["Harbour Court", "court"], ["B", null]]);
  for (const fk of FORUM_KINDS) {
    const got = w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: fk }).entities.map((e) => e.entity_id);
    assert.equal(got.includes(a), false, `a body without one is in no filter: ${fk}`);
  }
  assert.deepEqual(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: "court" }).entities.map((e) => e.entity_id), [court]);
  assert.deepEqual(w.e.entitiesOfKind({ kind: "office", viewer: VIEWER }).entities.map((e) => Object.keys(e)),
                   Array(2).fill(["entity_id", "kind", "label", "note", "named_by_member", "confirmed_by", "contact", "law", "declared_by", "at"]), "an office item answers no forum_kind");
});

test("R54 control: forum_kind on a person (or any kind but body and institution) is refused FORUM_KIND_NOT_FOR_KIND, a value outside the list UNKNOWN_FORUM_KIND naming it, both before an id is allocated and writing nothing", () => {
  const w = world();
  const seq = () => w.rows(`SELECT next FROM seq WHERE scope='ENT-2026'`)[0]?.next ?? 0;
  w.e.createEntity({ kind: "body", label: "Seed", note: NOTE });
  const before = [count(w, "entities"), count(w, "entity_aliases"), seq()];
  for (const kind of ENTITY_KINDS.filter((k) => !FORUM_ENTITY_KINDS.includes(k) && k !== "proceeding")) {
    const r = w.e.createEntity({ kind, label: `x ${kind}`, note: NOTE, forum_kind: "court" });
    assert.deepEqual([r.ok, r.reason, r.kind], [false, "FORUM_KIND_NOT_FOR_KIND", kind], kind);
    assert.match(r.detail, /body or institution/);
  }
  const person = w.e.createEntity({ kind: "person", label: "Pat", note: NOTE, forum_kind: "court" });
  assert.equal(person.reason, "FORUM_KIND_NOT_FOR_KIND");
  for (const bad of ["tribunal", "Court", "COURT", "", " court", 7, true, {}, ["court"]]) {
    const r = w.e.createEntity({ kind: "body", label: "Bad", note: NOTE, forum_kind: bad });
    assert.deepEqual([r.ok, r.reason], [false, "UNKNOWN_FORUM_KIND"], JSON.stringify(bad));
    assert.deepEqual(r.forum_kinds, [...FORUM_KINDS], "the answer names the list");
    for (const fk of FORUM_KINDS) assert.match(r.detail, new RegExp(fk));
  }
  assert.equal(w.e.createEntity({ kind: "proceeding", note: NOTE, forum_kind: "court", proceeding: {} }).reason, "FORUM_KIND_NOT_FOR_KIND", "a proceeding carries none of its own");
  assert.deepEqual([count(w, "entities"), count(w, "entity_aliases"), seq()], before, "nothing written, no id allocated");
});

test("R54 the refusals come after R1's own (kind, label, note) and a sector refusal is unchanged; the organisation sector is held beside the forum kind", () => {
  const w = world();
  assert.equal(w.e.createEntity({ label: "x", note: NOTE, forum_kind: "tribunal" }).reason, "NO_KIND");
  assert.equal(w.e.createEntity({ kind: "body", note: NOTE, forum_kind: "tribunal" }).reason, "ENTITY_NO_LABEL");
  assert.equal(w.e.createEntity({ kind: "body", label: "x", forum_kind: "tribunal" }).reason, "ENTITY_NO_NOTE");
  assert.equal(w.e.createEntity({ kind: "body", label: "x", note: NOTE, sector: "club", forum_kind: "court" }).reason, "UNKNOWN_SECTOR");
  const r = w.e.createEntity({ kind: "body", label: "County Court", note: NOTE, sector: "government", forum_kind: "court" });
  assert.deepEqual([r.ok, r.sector, r.forum_kind], [true, "government", "court"]);
  const e = w.e.readEntity({ entityId: r.entity_id }).entity;
  assert.deepEqual([e.sector, e.forum_kind], ["government", "court"]);
});

test("R54 R45 is unchanged: a proceeding's forum is any registered entity, and the facet's forum_kind stays the proceeding kind's, whatever forum_kind the forum carries", () => {
  const w = world({ profiles: ["test-port-ellery"] });
  const court = w.e.createEntity({ kind: "institution", label: "Marlow County Court", note: NOTE, sector: "government" }).entity_id;
  const tagged = w.e.createEntity({ kind: "institution", label: "Another Court", note: NOTE, sector: "government", forum_kind: "other" }).entity_id;
  for (const forum of [court, tagged]) {
    const p = w.e.createEntity({ kind: "proceeding", note: NOTE, proceeding: { forum, kind: "commitment_suit", number: `MC-26-000${forum === court ? 1 : 2}` } });
    assert.equal(p.ok, true, JSON.stringify(p));
    assert.equal(p.proceeding.forum_kind, "court", "the proceeding kind's forum kind");
    assert.equal(w.e.readEntity({ entityId: p.entity_id }).entity.forum_kind, null, "a proceeding carries no forum_kind of its own");
  }
});

test("R54 entitiesOfKind takes forum_kind as one value or a list, lists only the entities carrying one of them, in entity_id order with the page rules; a value outside the list is refused UNKNOWN_FORUM_KIND (after the kind, before the viewer); an unrecognised viewer sees none", () => {
  const w = world();
  const id = (fk, label) => w.e.createEntity({ kind: "body", label, note: NOTE, ...(fk ? { forum_kind: fk } : {}) }).entity_id;
  const c1 = id("court", "Court One"), m1 = id("commission", "Commission One"), n1 = id(null, "Plain Body"),
        g1 = id("grand_jury", "Jury One"), c2 = id("court", "Court Two"), o1 = id("other", "Other One");
  const ids = (r) => r.entities.map((e) => e.entity_id);
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER })), [c1, m1, n1, g1, c2, o1]);
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: "court" })), [c1, c2]);
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: ["commission", "court"] })), [c1, m1, c2], "a list: any of them");
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: ["court", "court"] })), [c1, c2]);
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: [] })), [c1, m1, n1, g1, c2, o1], "an empty list is no filter");
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: null })), [c1, m1, n1, g1, c2, o1]);
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "institution", viewer: VIEWER, forum_kind: "court" })), [], "the filter is within the kind asked");
  assert.deepEqual(ids(w.e.entitiesOfKind({ kind: "person", viewer: VIEWER, forum_kind: "court" })), []);
  /* a page of the filtered set */
  const p1 = w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: ["court", "other"], limit: 2 });
  assert.deepEqual([ids(p1), p1.truncated, p1.next, p1.limit], [[c1, c2], true, c2, 2]);
  const p2 = w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: ["court", "other"], limit: 2, after: p1.next });
  assert.deepEqual([ids(p2), p2.truncated, p2.next], [[o1], false, null]);
  /* refusals */
  for (const bad of ["tribunal", ["court", "tribunal"], "", 3, "Court"]) {
    const r = w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: bad });
    assert.deepEqual([r.ok, r.reason], [false, "UNKNOWN_FORUM_KIND"], JSON.stringify(bad));
    assert.deepEqual(r.forum_kinds, [...FORUM_KINDS]);
  }
  assert.equal(w.e.entitiesOfKind({ viewer: VIEWER, forum_kind: "tribunal" }).reason, "NO_KIND", "the kind is asked first");
  assert.equal(w.e.entitiesOfKind({ kind: "nope", viewer: VIEWER, forum_kind: "tribunal" }).reason, "UNKNOWN_KIND");
  assert.equal(w.e.entitiesOfKind({ kind: "body", forum_kind: "tribunal" }).reason, "UNKNOWN_FORUM_KIND", "the filter is judged before the viewer");
  assert.equal(w.e.entitiesOfKind({ kind: "body", forum_kind: "court" }).reason, "VIEWER_MISSING");
  assert.deepEqual(w.e.entitiesOfKind({ kind: "body", viewer: "stranger", forum_kind: "court" }).entities, []);
  assert.equal(w.e.entitiesOfKind({ kind: "body", viewer: MACHINE, forum_kind: "court" }).count, 2, "a machine viewer is recognised");
  /* the op: one value or a comma-separated list; a value outside the list refused */
  assert.deepEqual(ids(ops(w, "entitieskind", { kind: "body", viewer: VIEWER, forum_kind: "court" })), [c1, c2]);
  assert.deepEqual(ids(ops(w, "entitieskind", { kind: "body", viewer: VIEWER, forum_kind: "commission, court" })), [c1, m1, c2]);
  assert.deepEqual(ids(ops(w, "entitieskind", { kind: "body", viewer: VIEWER, forum_kind: "" })), [c1, m1, n1, g1, c2, o1]);
  assert.equal(ops(w, "entitieskind", { kind: "body", viewer: VIEWER, forum_kind: "court,tribunal" }).reason, "UNKNOWN_FORUM_KIND");
  assert.equal(ops(w, "entitieskind", { kind: "body", viewer: VIEWER }).count, 6);
});

test("R54 a store written before T50 lacks the column: migrate adds it, its entities read none, and a new one can carry a forum kind; it is idempotent", () => {
  const w = world();
  const old = w.e.createEntity({ kind: "body", label: "Old Body", note: NOTE }).entity_id;
  w.st.sql.exec(`ALTER TABLE entities DROP COLUMN forum_kind`);
  assert.equal(w.rows(`PRAGMA table_info(entities)`).some((c) => c.name === "forum_kind"), false);
  w.e.migrate();
  w.e.migrate();
  assert.equal(w.rows(`PRAGMA table_info(entities)`).filter((c) => c.name === "forum_kind").length, 1);
  assert.equal(w.e.readEntity({ entityId: old }).entity.forum_kind, null);
  const fresh = w.e.createEntity({ kind: "body", label: "New Court", note: NOTE, forum_kind: "court" }).entity_id;
  assert.deepEqual(w.e.entitiesOfKind({ kind: "body", viewer: VIEWER, forum_kind: "court" }).entities.map((e) => e.entity_id), [fresh]);
});

/* ---------------------------------------------------------------- R55 */

function people() {
  const w = world();
  const mk = (kind, label, aliases = []) => w.e.createEntity({ kind, label, note: NOTE, aliases, declaredBy: VIEWER }).entity_id;
  const pat = mk("person", "Pat Quill", ["P. Quill", "Patricia Quill"]);
  const lee = mk("person", "Lee Marsh", ["L. Marsh"]);
  const clerk = mk("office", "Harbour Clerk", ["The Clerk"]);
  const body = mk("body", "Harbour Board", ["The Board"]);
  return { ...w, pat, lee, clerk, body };
}

test("R55 aliasesOf answers the standing aliases of the entities of the given kinds as {entity_id, kind, label, alias}, in entity id then alias order; the canonical label is one; another kind is not answered", () => {
  const w = people();
  const r = w.e.aliasesOf({ kinds: ["person", "office"], viewer: VIEWER });
  assert.deepEqual([r.ok, r.aliases.length, r.limit, r.truncated, r.next], [true, 7, ALIASES_LIMIT_DEFAULT, false, null]);
  assert.deepEqual(r.aliases.map((a) => Object.keys(a)), Array(7).fill(["entity_id", "kind", "label", "alias"]));
  assert.deepEqual(r.aliases.map((a) => [a.entity_id, a.kind, a.label, a.alias]), [
    [w.pat, "person", "Pat Quill", "P. Quill"], [w.pat, "person", "Pat Quill", "Pat Quill"], [w.pat, "person", "Pat Quill", "Patricia Quill"],
    [w.lee, "person", "Lee Marsh", "L. Marsh"], [w.lee, "person", "Lee Marsh", "Lee Marsh"],
    [w.clerk, "office", "Harbour Clerk", "Harbour Clerk"], [w.clerk, "office", "Harbour Clerk", "The Clerk"],
  ]);
  assert.equal(r.aliases.some((a) => a.kind === "body"), false, "a kind not asked is not answered");
});

test("R55 order is entity id, then the alias's fold; a kind asked once as a string; kinds as asked, distinct", () => {
  const w = people();
  const one = w.e.aliasesOf({ kinds: "office", viewer: VIEWER });
  assert.deepEqual(one.aliases.map((a) => [a.entity_id, a.alias]), [[w.clerk, "Harbour Clerk"], [w.clerk, "The Clerk"]]);
  const both = w.e.aliasesOf({ kinds: ["person", "office", "person", " OFFICE "], viewer: VIEWER });
  assert.deepEqual(Object.keys(both).sort(), ["aliases", "limit", "next", "ok", "truncated"]);
  const ids = both.aliases.map((a) => a.entity_id);
  assert.deepEqual(ids, [...ids].sort(), "entity id order");
  const norm = (s) => s.toLowerCase();
  for (const id of new Set(ids)) {
    const mine = both.aliases.filter((a) => a.entity_id === id).map((a) => norm(a.alias));
    assert.deepEqual(mine, [...mine].sort(), "alias order within an entity");
  }
  /* a body is of the closed list: answered when asked (R51 refuses only a kind outside it) */
  assert.deepEqual(w.e.aliasesOf({ kinds: ["body"], viewer: VIEWER }).aliases.map((a) => a.alias), ["Harbour Board", "The Board"]);
});

test("R55 a withdrawn alias is absent (the standing aliases only), and a withdrawal of the canonical label does not take the entity out of the rest", () => {
  const w = people();
  const before = w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER }).aliases.map((a) => a.alias);
  assert.ok(before.includes("P. Quill"));
  assert.equal(w.e.withdrawAlias({ entityId: w.pat, alias: "P. Quill", reason: "mistaken", withdrawnBy: VIEWER }).ok, true);
  const after = w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER }).aliases;
  assert.deepEqual(after.map((a) => a.alias), before.filter((a) => a !== "P. Quill"));
  assert.equal(w.e.entitiesByAlias({ alias: "P. Quill" }).count, 0, "R6's reading agrees");
  /* an added alias appears */
  w.e.addAlias({ entityId: w.lee, alias: "Dr Marsh", declaredBy: VIEWER });
  assert.ok(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER }).aliases.some((a) => a.entity_id === w.lee && a.alias === "Dr Marsh"));
  /* the same fold held by two entities is answered once for each */
  w.e.addAlias({ entityId: w.pat, alias: "L. Marsh", declaredBy: VIEWER });
  assert.deepEqual(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER }).aliases.filter((a) => a.alias === "L. Marsh").map((a) => a.entity_id), [w.pat, w.lee].sort());
});

test("R55 paging across limit: limit 1-5,000 (default 1,000) published, truncated by reading one past, next continuing without a gap or a repeat", () => {
  const w = world();
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(w.e.createEntity({ kind: "person", label: `Person ${i}`, note: NOTE, aliases: [`alias ${i}a`, `alias ${i}b`] }).entity_id);
  const full = w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER });
  assert.equal(full.aliases.length, 12);
  for (const limit of [1, 2, 3, 5, 11, 12]) {
    const seen = [];
    let after = null, pages = 0;
    for (;;) {
      const r = w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit, ...(after ? { after } : {}) });
      assert.equal(r.limit, limit);
      assert.ok(r.aliases.length <= limit);
      seen.push(...r.aliases);
      pages++;
      assert.equal(r.truncated, r.next !== null, "next only when one more follows");
      if (!r.truncated) break;
      after = r.next;
    }
    assert.deepEqual(seen, full.aliases, `limit ${limit}`);
    assert.equal(pages, Math.ceil(12 / limit), `limit ${limit}: pages`);
  }
  assert.deepEqual([w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit: 12 }).truncated, w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit: 11 }).truncated], [false, true]);
  /* the limit is clamped and published; a bare entity id continues after that entity */
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit: 0 }).limit, 1);
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit: -4 }).limit, 1);
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit: 999999 }).limit, ALIASES_LIMIT_MAX);
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, limit: "nope" }).limit, ALIASES_LIMIT_DEFAULT);
  assert.deepEqual([ALIASES_LIMIT_DEFAULT, ALIASES_LIMIT_MAX], [1000, 5000]);
  const rest = w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, after: ids[1] }).aliases;
  assert.deepEqual(rest.map((a) => a.entity_id), full.aliases.filter((a) => a.entity_id > ids[1]).map((a) => a.entity_id));
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, after: ids[3] }).aliases.length, 0);
});

test("R55 control: a viewer membership does not recognise (or none) gets none; a kind named wrongly is refused as R51 refuses it; it writes nothing and never throws", () => {
  const w = people();
  const tables = ["entities", "entity_aliases", "entity_relations", "resolutions"].map((t) => count(w, t));
  for (const viewer of ["stranger", "", null, undefined, "member:", 7]) {
    const r = w.e.aliasesOf({ kinds: ["person", "office"], viewer });
    assert.deepEqual([r.ok, r.aliases, r.truncated, r.next], [true, [], false, null], String(viewer));
  }
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: MACHINE }).aliases.length, 5, "a machine viewer is recognised");
  assert.equal(w.e.aliasesOf({ kinds: ["person"], viewer: "admin" }).aliases.length, 5);
  for (const [kinds, reason] of [[undefined, "NO_KIND"], [[], "NO_KIND"], [[""], "NO_KIND"], [["person", " "], "NO_KIND"], [null, "NO_KIND"],
                                 [["theme"], "UNKNOWN_KIND"], [["person", "theme"], "UNKNOWN_KIND"], ["Nope", "UNKNOWN_KIND"], [[7], "NO_KIND"]]) {
    const r = w.e.aliasesOf({ kinds, viewer: VIEWER });
    assert.deepEqual([r.ok, r.reason], [false, reason], JSON.stringify(kinds));
    assert.deepEqual(r.reason === "UNKNOWN_KIND" ? r.kinds : [...ENTITY_KINDS], [...ENTITY_KINDS]);
  }
  assert.doesNotThrow(() => w.e.aliasesOf());
  assert.doesNotThrow(() => w.e.aliasesOf({ kinds: ["person"], viewer: VIEWER, after: {}, limit: {} }));
  assert.deepEqual(["entities", "entity_aliases", "entity_relations", "resolutions"].map((t) => count(w, t)), tables);
  /* it is an in-process read, not an op */
  assert.equal("aliasesOf" in entitiesOps(w.e, new URL("https://x.example/"), {}), false);
});

/* ---------------------------------------------------------------- R56 */

test("R56 labelsOf answers {label, kind} for two registered ids and null for an unknown one, in one read, keyed by the id as asked", () => {
  const w = people();
  const r = w.e.labelsOf({ ids: [w.pat, "ENT-2026-9999", w.clerk], viewer: VIEWER });
  assert.deepEqual(r.labels, { [w.pat]: { label: "Pat Quill", kind: "person" }, "ENT-2026-9999": null, [w.clerk]: { label: "Harbour Clerk", kind: "office" } });
  assert.deepEqual([r.ok, r.count], [true, 3]);
  assert.equal(r.labels[w.pat].label, w.e.readEntity({ entityId: w.pat }).entity.label, "the canonical label");
  /* an alias added or withdrawn does not move the canonical label; a non-string id is null and an empty list is empty */
  w.e.addAlias({ entityId: w.pat, alias: "Q", declaredBy: VIEWER });
  assert.equal(w.e.labelsOf({ ids: [w.pat], viewer: VIEWER }).labels[w.pat].label, "Pat Quill");
  assert.deepEqual(w.e.labelsOf({ ids: [], viewer: VIEWER }), { ok: true, labels: {}, count: 0 });
  assert.deepEqual(w.e.labelsOf({ ids: [7, null, "", w.lee], viewer: VIEWER }).labels, { [w.lee]: { label: "Lee Marsh", kind: "person" }, "": null });
  /* a repeated id is answered once; a name that is an object key is just an id */
  assert.deepEqual(Object.keys(w.e.labelsOf({ ids: [w.pat, w.pat, "__proto__", "constructor"], viewer: VIEWER }).labels), [w.pat, "__proto__", "constructor"]);
  assert.equal(w.e.labelsOf({ ids: ["__proto__"], viewer: VIEWER }).labels.__proto__, null);
  /* every kind is answered */
  const body = w.e.labelsOf({ ids: [w.body], viewer: VIEWER }).labels[w.body];
  assert.deepEqual(body, { label: "Harbour Board", kind: "body" });
});

test("R56 control: more than 500 ids are refused TOO_MANY_IDS (500 are answered); a viewer membership does not recognise is answered every one null; ids that are no list are NO_ENTITY; it writes nothing and never throws", () => {
  const w = people();
  const ids = Array.from({ length: LABELS_IDS_MAX }, (_, i) => `ENT-2026-${String(9000 + i).padStart(4, "0")}`);
  ids[0] = w.pat;
  const ok = w.e.labelsOf({ ids, viewer: VIEWER });
  assert.deepEqual([ok.ok, ok.count, ok.labels[w.pat].label], [true, 500, "Pat Quill"]);
  const over = w.e.labelsOf({ ids: [...ids, w.lee], viewer: VIEWER });
  assert.deepEqual([over.ok, over.reason, over.count, over.max], [false, "TOO_MANY_IDS", 501, 500]);
  assert.equal("labels" in over, false);
  assert.equal(LABELS_IDS_MAX, 500);
  for (const viewer of ["stranger", "", null, undefined]) {
    const r = w.e.labelsOf({ ids: [w.pat, w.clerk, "ENT-2026-9999"], viewer });
    assert.deepEqual(r.labels, { [w.pat]: null, [w.clerk]: null, "ENT-2026-9999": null }, String(viewer));
  }
  assert.equal(w.e.labelsOf({ ids: [w.pat], viewer: MACHINE }).labels[w.pat].kind, "person");
  for (const bad of [undefined, null, "ENT-2026-0001", {}, 5]) {
    const r = w.e.labelsOf({ ids: bad, viewer: VIEWER });
    assert.deepEqual([r.ok, r.reason, r.code], [false, "NO_ENTITY", "NO_ENTITY"], JSON.stringify(bad));
  }
  assert.doesNotThrow(() => w.e.labelsOf());
  const tables = ["entities", "entity_aliases"].map((t) => count(w, t));
  w.e.labelsOf({ ids: [w.pat], viewer: VIEWER });
  assert.deepEqual(["entities", "entity_aliases"].map((t) => count(w, t)), tables);
  assert.equal("labelsOf" in entitiesOps(w.e, new URL("https://x.example/"), {}), false, "an in-process read, not an op");
});

/* ---------------------------------------------------------------- R35 */

test("R35 (T50; N1092) the table entities states its label column, the canonical label, beside entity_id, kind and at, so a later module lists names in one read of its own SQL", () => {
  const w = people();
  const cols = w.rows(`PRAGMA table_info(entities)`).map((c) => c.name);
  for (const c of ["entity_id", "kind", "label", "at"]) assert.ok(cols.includes(c), c);
  const made = w.e.createEntity({ kind: "person", label: "  Sam   Quill ", note: NOTE, aliases: ["S. Quill"] });
  assert.equal(made.label, "Sam Quill");
  const row = w.rows(`SELECT entity_id, kind, label, at FROM entities WHERE entity_id=?`, made.entity_id)[0];
  assert.deepEqual([row.label, row.kind, row.at], ["Sam Quill", "person", made.at], "the label R1 answers, kept cleaned; the instant R1 answers");
  /* newest first with names, as retrieval's browse lists them: one read, no per-row call */
  const listed = w.rows(`SELECT entity_id, label FROM entities WHERE kind IN ('person','office') ORDER BY at DESC, entity_id DESC`);
  assert.equal(listed[0].entity_id, made.entity_id);
  assert.deepEqual(listed.map((r) => r.label), ["Sam Quill", "Harbour Clerk", "Lee Marsh", "Pat Quill"]);
  /* the column is the canonical alias: an added alias does not move it, and it is what labelsOf and readEntity answer */
  w.e.addAlias({ entityId: made.entity_id, alias: "Zed Quill", declaredBy: VIEWER });
  assert.equal(w.rows(`SELECT label FROM entities WHERE entity_id=?`, made.entity_id)[0].label, "Sam Quill");
  assert.equal(w.e.labelsOf({ ids: [made.entity_id], viewer: VIEWER }).labels[made.entity_id].label, "Sam Quill");
  assert.equal(w.e.readEntity({ entityId: made.entity_id }).entity.label, "Sam Quill");
  assert.equal(w.rows(`SELECT alias FROM entity_aliases WHERE entity_id=? AND canonical=1`, made.entity_id)[0].alias, "Sam Quill");
});

/* ------------------------------------------------- plan rule 6: words by key */

const reads = async () => JSON.parse(await readFile(
  new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules.entities;
const fill = (key) => word(key, Object.fromEntries((raw(key).match(/\{(\w+)\}/g) ?? []).map((p) => [p.slice(1, -1), "x"])));

test("plan rule 6 (N1116; DEC-258) every key the module reads is held by setup-words, each once, none empty; they are the `reads` list for entities in words-reads.json", async () => {
  assert.ok(Object.isFrozen(WORD_KEYS));
  assert.equal(new Set(WORD_KEYS).size, WORD_KEYS.length);
  for (const key of WORD_KEYS) {
    assert.equal(hasWord(key), true, key);
    assert.match(fill(key), /\S/, key);
  }
  const { reads: list } = await reads();
  assert.deepEqual([...WORD_KEYS].sort(), [...list].sort());
  assert.equal(hasWord("refusal.NO_SUCH_CODE_AT_ALL"), false, "control: a key the list lacks is not held");
  assert.throws(() => word("refusal.NO_SUCH_CODE_AT_ALL"), /UNKNOWN_WORD/);
});

test("plan rule 6 every refusal row's translation is the words of its key, refusal.<CODE>, and every row has one; the module-level refusals answer their row's words", () => {
  const rows = { ...IDSPACE_CHECKS, ...ENTITY_CHECKS };
  assert.equal(Object.keys(rows).length, 12);
  /* the two rows of R64 (K4364) hold a stand-in sentence under their key until the design's row lands: then the row's words govern */
  const STAND_IN = ["CONFIRM_NOT_AN_OFFICE", "NOT_NAMED_BY_A_MEMBER"];
  for (const [code, row] of Object.entries(rows)) {
    if (STAND_IN.includes(code)) {
      assert.equal(row.translation, hasWord(`refusal.${code}`) ? raw(`refusal.${code}`) : row.translation, code);
      assert.match(row.translation, /\S/, code);
      continue;
    }
    assert.equal(row.translation, raw(`refusal.${code}`), code);
    assert.ok(WORD_KEYS.includes(`refusal.${code}`), code);
  }
  assert.equal(noSuchEntity("ENT-2026-0404").translation, word("refusal.NO_SUCH_ENTITY"));
  assert.equal(noEntity().translation, word("refusal.NO_ENTITY"));
  assert.equal(notAProceeding().translation, word("refusal.NOT_A_PROCEEDING"));
  const w = world({ profiles: ["test-port-ellery"] });
  assert.equal(w.e.createEntity({ kind: "office", note: NOTE }).translation, word("refusal.ENTITY_NO_LABEL"));
  assert.equal(w.e.createEntity({ kind: "office", label: "x" }).translation, word("refusal.ENTITY_NO_NOTE"));
  assert.equal(w.e.addAlias({ entityId: "ENT-2026-0001", alias: " " }).translation, word("refusal.NO_ALIAS"));
  assert.equal(w.e.idMatch({ space: "nope" }).translation, word("refusal.IDSPACE_UNKNOWN"));
  assert.equal(w.e.idMatch({ space: "project", a: "zzz" }).translation, word("refusal.IDSPACE_VALUE_NOT_IN_SPACE"));
  assert.equal(w.e.idMatch({ space: "project", a: "WO-0001", b: "WO-0001", aCapture: sha("x"), bCapture: sha("y"), viewer: MACHINE }).translation,
               word("refusal.IDSPACE_CAPTURE_NOT_HELD"));
  /* control: the words say "team", never "group", where a person reads them (N1160) */
  for (const row of Object.values(rows)) assert.doesNotMatch(row.translation, /\bgroup\b/i);
});

test("plan rule 6 the other sentences at their sites are word(key, vars): the viewer-missing why, the places a reference is named, the considered list, the referent reading, the proceeding's note", () => {
  const w = world({ profiles: ["test-port-ellery"] });
  assert.equal(w.e.neighbours({ node: "ENT-2026-0001" }).why, word("duties.why.read_names_member"));
  const court = w.e.createEntity({ kind: "institution", label: "Marlow County Court", note: NOTE, sector: "government" }).entity_id;
  const cap = w.held("INFO-1", sha("row"), ["https://minutes.port-ellery.example/a/1"]);
  const r = w.e.registerProceeding({ captureSha: cap, extent: { kind: "pdf-page", page: 2 }, forum: court, number: "MC-26-0042", kind: "commitment_suit", declaredBy: VIEWER });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.e.readEntity({ entityId: r.entity_id }).entity.note,
               word("entities.clean_label.registered_captured_document", { sha: cap, extent: "page 3", number: "MC-26-0042" }));
  /* where a reading names the subject: its reference, its key, its label */
  const person = w.e.createEntity({ kind: "person", label: "Pat Quill", note: NOTE, aliases: ["person:Pat Quill"] }).entity_id;
  w.read("INFO-2", sha("by-label"), [{ kind: "person", key: "P1", label: "Pat Quill" }]);
  w.read("INFO-3", sha("by-key"), [{ kind: "thing", key: "Pat Quill", label: "x" }]);
  w.read("INFO-4", sha("by-ref"), [{ kind: "person", key: "Pat Quill", label: "y" }]);
  const named = w.e.namingDocuments({ entityId: person, viewer: MACHINE });
  const places = { ref: "entities.text.carries_reference", key: "entities.text.carries_reference_key", label: "entities.text.labels_reference" };
  assert.deepEqual([...new Set(named.documents.map((d) => d.matched_on))].sort(), ["key", "label", "ref"]);
  for (const d of named.documents) assert.ok(d.detail.includes(word(places[d.matched_on])), d.detail);
  /* what the recogniser considered, handed to the attempt listener */
  const tried = [];
  assert.equal(w.e.onResolveAttempt("observation-log", (a) => tried.push(a)).ok, true);
  w.e.resolve({ captureSha: sha("by-label") });
  assert.equal(tried[0].considered, `${word("entities.considered.composite_key")}, ${word("entities.considered.source_key")}, the name`);
  /* the referent the caller reads */
  const a = w.held("INFO-5", sha("a"), ["https://minutes.port-ellery.example/a/2"]);
  const b = w.held("INFO-6", sha("b"), ["https://minutes.port-ellery.example/a/3"]);
  const pair = w.e.idMatch({ space: "project", a: "WO-0001", b: "WO-0001", aCapture: a, bCapture: b, referent: "agrees", viewer: MACHINE });
  assert.equal(pair.ok, true, JSON.stringify(pair));
  assert.equal(pair.referent_reading, word("entities.referent_reading"));
  assert.equal(w.e.idMatch({ space: "project", a: "WO-0001", b: "WO-0001", aCapture: a, bCapture: b, viewer: MACHINE }).referent_reading, null, "control: none read, none said");
});
