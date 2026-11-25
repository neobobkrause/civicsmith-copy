/* entities at T51 (T51-30; N1207, N1236; K3665, K3771, K3839; DEC-308 (3), DEC-330 A15, A31, A51): R58 a resolution says how
   it was matched (`matched_by`) and `resolutionsFor` answers what the document names (`names`); R57 `onlyByIdentifier`; R59
   `subjectsNamed`; R60 `similarSubjects`; R61 a naming candidate's `page`. Every test drives `entities` at its interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";
import { entitiesOps, MATCHED_BY, ONLY_BY_IDENTIFIER_IDS_MAX, SUBJECTS_LIMIT_DEFAULT, SUBJECTS_LIMIT_MAX,
         SIMILAR_LIMIT_DEFAULT, SIMILAR_LIMIT_MAX } from "../../../src/entities/index.mjs";

const NOTE = "a subject the test registers";
const PE = ["test-port-ellery"];
const VIEWER = "member:ann";
const pg = (n) => ({ kind: "pdf-page", ref: `p.${n}`, page: n - 1, rect: null });
const dump = (w) => ["entities", "entity_aliases", "entity_relations", "resolutions", "resolution_defects", "entity_identifiers"]
  .map((t) => w.rows(`SELECT * FROM ${t}`));
const ops = (w, op, params = {}) => {
  const url = new URL("https://x.example/");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return entitiesOps(w.e, url, null)[op]();
};

/* Pat Quill holds the bar number BAR12345 (a scheme identifier); a reference whose key is that number resolves to Pat by it. */
function people() {
  const w = world({ profiles: PE });
  const pat = w.e.createEntity({ note: NOTE, kind: "person", label: "Pat Quill" }).entity_id;
  assert.equal(w.e.addIdentifier({ entityId: pat, scheme: "marlow_bar", id: "BAR12345", basis: "the roll", by: "member:ann" }).ok, true);
  return { ...w, pat };
}
const byId = (key, label = "x", extra = {}) => ({ kind: "person", key, label, ...extra });

/* ---------------------------------------------------------------- R58 */

test("R58 every resolution says how its grade was reached: the identifier tier `identifier`, an alias of the reference `reference`, of its key `reference_key`, of its label `label`, a member's testimony `testimony`; MATCHED_BY lists the five", () => {
  const w = people();
  const ord = w.e.createEntity({ note: NOTE, kind: "ordinance", label: "Ord One", aliases: ["ord:26-1"] }).entity_id;
  const fund = w.e.createEntity({ note: NOTE, kind: "fund", label: "Other", aliases: ["26-2"] }).entity_id;
  const office = w.e.createEntity({ note: NOTE, kind: "office", label: "Harbour Office" }).entity_id;
  w.read("INFO-1", sha("mb"), [byId("bar 12345"), { kind: "ord", key: "26-1", label: "n" }, { kind: "ord", key: "26-2", label: "n" },
                              { kind: "doc", key: "9", label: "Harbour Office" }, { kind: "doc", key: "10", label: "unrelated" }]);
  const r = w.e.resolve({ captureSha: sha("mb"), resolvedBy: MACHINE });
  const got = Object.fromEntries(r.resolved.map((m) => [m.entity_id, [m.grade, m.matched_by]]));
  assert.deepEqual(got, { [w.pat]: ["A", "identifier"], [ord]: ["A", "reference"], [fund]: ["B", "reference_key"], [office]: ["C", "label"] });
  const t = w.e.testify({ captureSha: sha("mb"), ref: "doc:10", entityId: office, basis: "I know", resolvedBy: VIEWER });
  assert.deepEqual([t.grade, t.matched_by], ["D", "testimony"]);
  const read = Object.fromEntries(w.e.resolutionsFor({ captureSha: sha("mb"), viewer: MACHINE }).resolutions.map((x) => [`${x.ref}|${x.entity_id}`, x.matched_by]));
  assert.deepEqual(read, { [`person:bar 12345|${w.pat}`]: "identifier", [`ord:26-1|${ord}`]: "reference", [`ord:26-2|${fund}`]: "reference_key",
                           [`doc:9|${office}`]: "label", [`doc:10|${office}`]: "testimony" });
  assert.deepEqual([...MATCHED_BY], ["identifier", "reference", "reference_key", "label", "testimony"]);
  /* control: the recogniser never writes a value outside the list, and a resolution it did not match is not invented */
  assert.ok(w.rows(`SELECT matched_by FROM resolutions`).every((x) => MATCHED_BY.includes(x.matched_by)));
});

test("R58 a stronger grade raises the resolution in place and its matched_by becomes the stronger one's; an equal or weaker one keeps the held value, testimony after an A keeping `identifier`", () => {
  const w = people();
  const ent = w.e.createEntity({ note: NOTE, kind: "office", label: "Port Office" }).entity_id;
  w.read("INFO-1", sha("mbr"), [{ kind: "po", key: "1", label: "Port Office" }]);
  const c = w.e.resolve({ captureSha: sha("mbr") }).resolved[0];
  assert.deepEqual([c.grade, c.matched_by], ["C", "label"]);
  w.e.addAlias({ entityId: ent, alias: "po:1" });
  const a = w.e.resolve({ captureSha: sha("mbr") }).resolved[0];
  assert.deepEqual([a.grade, a.raised, a.matched_by], ["A", true, "reference"]);
  const t = w.e.testify({ captureSha: sha("mbr"), ref: "po:1", entityId: ent, basis: "b" });
  assert.deepEqual([t.grade, t.kept, t.matched_by], ["A", true, "reference"], "testimony after an A keeps the match");
  assert.equal(w.rows(`SELECT matched_by FROM resolutions`)[0].matched_by, "reference");
  /* identifier first, then testimony */
  w.read("INFO-2", sha("mbi"), [byId("bar 12345")]);
  w.e.resolve({ captureSha: sha("mbi") });
  const k = w.e.testify({ captureSha: sha("mbi"), ref: "person:bar 12345", entityId: w.pat, basis: "b" });
  assert.deepEqual([k.grade, k.kept, k.matched_by], ["A", true, "identifier"]);
  /* testimony, then a name raises it to C and takes `label` */
  w.read("INFO-3", sha("mbd"), [{ kind: "po", key: "9", label: "Port Office" }]);
  w.e.testify({ captureSha: sha("mbd"), ref: "po:9", entityId: ent, basis: "b" });
  const up = w.e.resolve({ captureSha: sha("mbd") }).resolved[0];
  assert.deepEqual([up.grade, up.raised_from, up.matched_by], ["C", "D", "label"]);
});

test("R58 a store written before matched_by gets the column once, filled from the tier its method sentence names, and a sentence none of them wrote stays null, never guessed", () => {
  const w = people();
  const ord = w.e.createEntity({ note: NOTE, kind: "ordinance", label: "Ord One", aliases: ["ord:26-1"] }).entity_id;
  w.e.createEntity({ note: NOTE, kind: "fund", label: "Other", aliases: ["26-2"] });
  const off = w.e.createEntity({ note: NOTE, kind: "office", label: "Harbour Office" }).entity_id;
  w.read("INFO-1", sha("bf"), [byId("bar 12345"), { kind: "ord", key: "26-1", label: "n" }, { kind: "ord", key: "26-2", label: "n" },
                              { kind: "doc", key: "9", label: "Harbour Office" }, { kind: "doc", key: "10", label: "n" }]);
  w.e.resolve({ captureSha: sha("bf") });
  w.e.testify({ captureSha: sha("bf"), ref: "doc:10", entityId: off, basis: "b" });
  w.rows(`UPDATE resolutions SET method='something an older version wrote' WHERE entity_id=?`, ord);
  const want = Object.fromEntries(w.rows(`SELECT ref, matched_by FROM resolutions`).map((r) => [r.ref, r.matched_by]));
  w.st.db.exec(`ALTER TABLE resolutions DROP COLUMN matched_by`);
  w.e.migrate();
  const got = Object.fromEntries(w.rows(`SELECT ref, matched_by FROM resolutions`).map((r) => [r.ref, r.matched_by]));
  assert.deepEqual(got, { ...want, "ord:26-1": null });
  assert.deepEqual([got["person:bar 12345"], got["ord:26-2"], got["doc:9"], got["doc:10"]], ["identifier", "reference_key", "label", "testimony"]);
  const read = w.e.resolutionsFor({ captureSha: sha("bf"), viewer: MACHINE }).resolutions.find((x) => x.ref === "ord:26-1");
  assert.equal(read.matched_by, null, "read back as null");
  /* a second boot changes nothing */
  const before = dump(w);
  w.e.migrate();
  assert.deepEqual(dump(w), before);
});

test("R58 resolutionsFor answers `names`, one entry per entity the capture's resolutions name, the strongest resolution's grade and matched_by, mentions counted, label and kind as R56 reads them, strongest first then label then id", () => {
  const w = people();
  const other = w.e.createEntity({ note: NOTE, kind: "office", label: "Quill" }).entity_id;
  const beta = w.e.createEntity({ note: NOTE, kind: "body", label: "Beta Board", aliases: ["bb"] }).entity_id;
  const alpha = w.e.createEntity({ note: NOTE, kind: "body", label: "Alpha Board", aliases: ["ab"] }).entity_id;
  w.read("INFO-1", sha("nm"), [byId("bar 12345", "n"), byId("BAR12345", "n"), { kind: "z", key: "1", label: "Quill" },
                              { kind: "z", key: "2", label: "Quill" }, { kind: "z", key: "3", label: "Beta Board" },
                              { kind: "z", key: "4", label: "Alpha Board" }]);
  w.e.resolve({ captureSha: sha("nm") });
  const r = w.e.resolutionsFor({ captureSha: sha("nm"), viewer: MACHINE });
  assert.deepEqual(r.names, [
    { entity_id: w.pat, label: "Pat Quill", kind: "person", grade: "A", established: true, needs_confirmation: false, matched_by: "identifier", mentions: 2 },
    { entity_id: alpha, label: "Alpha Board", kind: "body", grade: "C", established: false, needs_confirmation: true, matched_by: "label", mentions: 1 },
    { entity_id: beta, label: "Beta Board", kind: "body", grade: "C", established: false, needs_confirmation: true, matched_by: "label", mentions: 1 },
    { entity_id: other, label: "Quill", kind: "office", grade: "C", established: false, needs_confirmation: true, matched_by: "label", mentions: 2 },
  ]);
  assert.equal(r.names_truncated, false);
  /* the spec's pair: a reference equal to a held identifier, and a label folding to another's alias */
  const w2 = people();
  w2.e.createEntity({ note: NOTE, kind: "office", label: "Quill" });
  w2.read("INFO-1", sha("pair"), [byId("bar 12345", "n"), { kind: "q", key: "1", label: "Quill" }]);
  w2.e.resolve({ captureSha: sha("pair") });
  assert.deepEqual(w2.e.resolutionsFor({ captureSha: sha("pair"), viewer: MACHINE }).names.map((n) => [n.grade, n.matched_by, n.mentions]),
                   [["A", "identifier", 1], ["C", "label", 1]]);
  /* testimony after an A keeps `identifier` (R10); testimony alone is `testimony` at D */
  w2.e.testify({ captureSha: sha("pair"), ref: "person:bar 12345", entityId: w2.pat, basis: "b" });
  w2.e.testify({ captureSha: sha("pair"), ref: "q:1", entityId: w2.pat, basis: "b" });
  const after = w2.e.resolutionsFor({ captureSha: sha("pair"), viewer: MACHINE }).names.find((n) => n.entity_id === w2.pat);
  assert.deepEqual([after.grade, after.matched_by, after.mentions], ["A", "identifier", 2]);
  /* the cut: names_truncated by reading one past, at the same limit as the resolutions */
  const cut = w.e.resolutionsFor({ captureSha: sha("nm"), limit: 2, viewer: MACHINE });
  assert.deepEqual([cut.names.length, cut.names_truncated], [2, true]);
  assert.deepEqual(w.e.resolutionsFor({ captureSha: sha("nm"), limit: 4, viewer: MACHINE }).names_truncated, false);
  /* a capture nothing resolves names nothing; an entity gone reads null label and kind */
  assert.deepEqual(w.e.resolutionsFor({ captureSha: sha("never") , viewer: MACHINE }).names, []);
  w.rows(`DELETE FROM entities WHERE entity_id=?`, other);
  assert.deepEqual(w.e.resolutionsFor({ captureSha: sha("nm"), viewer: MACHINE }).names.find((n) => n.entity_id === other).label, null);
});

test("R14 resolutionsFor answers `unresolved`: the references of the capture no entity resolution holds, in reading order, each {ref, label, page}; a fully resolved reading answers []; a testimony or a resolution resolves one; bounded at the limit with `unresolved_truncated`", () => {
  const w = people();
  w.e.createEntity({ note: NOTE, kind: "office", label: "Harbour Master" });
  w.read("INFO-1", sha("un"), [
    { kind: "z", key: "1", label: "Zed Person", source: pg(3) },
    byId("bar 12345", "n"),
    { kind: "z", key: "2", label: "Harbour Master" },
    { kind: "z", key: "3", label: "Alpha Person" },
    { kind: "z", key: "4", label: "Mid Person", source: pg(1) },
  ]);
  w.e.resolve({ captureSha: sha("un") });
  const r = w.e.resolutionsFor({ captureSha: sha("un"), viewer: MACHINE });
  assert.deepEqual(r.unresolved, [
    { ref: "z:1", label: "Zed Person", page: 3 },
    { ref: "z:3", label: "Alpha Person", page: null },
    { ref: "z:4", label: "Mid Person", page: 1 },
  ]);
  assert.equal(r.unresolved_truncated, false);
  /* a member's testimony names a subject for one: it is no longer unresolved */
  assert.equal(w.e.testify({ captureSha: sha("un"), ref: "z:3", entityId: w.pat, basis: "b" }).ok, true);
  assert.deepEqual(w.e.resolutionsFor({ captureSha: sha("un"), viewer: MACHINE }).unresolved.map((u) => u.ref), ["z:1", "z:4"]);
  /* the cut: by reading one past the limit */
  const cut = w.e.resolutionsFor({ captureSha: sha("un"), limit: 1, viewer: MACHINE });
  assert.deepEqual([cut.unresolved.map((u) => u.ref), cut.unresolved_truncated], [["z:1"], true]);
  assert.equal(w.e.resolutionsFor({ captureSha: sha("un"), limit: 2, viewer: MACHINE }).unresolved_truncated, false);
  /* the op answers it too */
  assert.deepEqual(ops(w, "resolutions", { sha256: sha("un"), viewer: MACHINE }).unresolved.map((u) => u.ref), ["z:1", "z:4"]);
});

test("R14 control: a fully resolved reading answers `unresolved: []`, so does a capture with no reading; a reference read at several places is one, at its first", () => {
  const w = people();
  w.read("INFO-1", sha("all"), [byId("bar 12345", "n")]);
  w.e.resolve({ captureSha: sha("all") });
  const full = w.e.resolutionsFor({ captureSha: sha("all"), viewer: MACHINE });
  assert.deepEqual([full.unresolved, full.unresolved_truncated], [[], false]);
  assert.deepEqual(w.e.resolutionsFor({ captureSha: sha("nothing"), viewer: MACHINE }).unresolved, []);
  w.read("INFO-1", sha("multi2"), [{ kind: "k", key: "1", label: "Nobody", source: pg(9), occurrences: [pg(9), pg(2)] }]);
  assert.deepEqual(w.e.resolutionsFor({ captureSha: sha("multi2"), viewer: MACHINE }).unresolved, [{ ref: "k:1", label: "Nobody", page: 9 }]);
});

/* ---------------------------------------------------------------- R57 */

test("R57 onlyByIdentifier counts a visible capture whose resolutions to the entity include `identifier` and none by reference, reference key or label: three captures carry the identifier, one also the name, answers 2; a fourth in a hidden bundle leaves it 2 to an outsider and counts for a participant", () => {
  const w = people();
  w.project("PROJ-2026-0001-x", "insider");
  w.read("INFO-1", sha("a"), [byId("bar 12345")]);
  w.read("INFO-2", sha("b"), [byId("BAR12345"), byId("bar12345", "n"), byId("BAR 12345")]);   /* three references, one capture */
  w.read("INFO-3", sha("c"), [byId("BAR12345"), { kind: "n", key: "1", label: "Pat Quill" }]);   /* the name too */
  w.read("PROJ-2026-0001-x", sha("hidden"), [byId("bar 12345")]);
  for (const s of ["a", "b", "c", "hidden"]) w.e.resolve({ captureSha: sha(s) });
  const before = dump(w);
  const one = (viewer) => w.e.onlyByIdentifier({ ids: [w.pat], viewer });
  assert.deepEqual(one("member:outsider"), { ok: true, entities: [{ entity_id: w.pat, documents: 2 }], count: 1 });
  assert.equal(one("member:insider").entities[0].documents, 3, "a participant sees the fourth");
  assert.equal(one(MACHINE).entities[0].documents, 3);
  assert.deepEqual(dump(w), before, "writes nothing");
  assert.ok(!JSON.stringify(one("member:outsider")).includes("hidden"));
  /* the entity named in every capture answers 0; an entity no capture names that way, and an id no entity holds, 0 */
  const other = w.e.createEntity({ note: NOTE, kind: "office", label: "Harbour Office" }).entity_id;
  const out = w.e.onlyByIdentifier({ ids: [other, "ENT-2026-0404", w.pat], viewer: MACHINE });
  assert.deepEqual(out.entities.map((x) => [x.entity_id, x.documents]), [[other, 0], ["ENT-2026-0404", 0], [w.pat, 3]]);
});

test("R57 control: a name match in every capture answers 0; a testified capture alone answers 0; testimony neither counts nor disqualifies; a resolution held before matched_by (null) neither counts nor disqualifies, never guessed", () => {
  const w = people();
  w.read("INFO-1", sha("n1"), [byId("bar 12345"), { kind: "n", key: "1", label: "Pat Quill" }]);
  w.read("INFO-2", sha("n2"), [byId("BAR12345"), { kind: "n", key: "2", label: "Pat Quill" }]);
  for (const s of ["n1", "n2"]) w.e.resolve({ captureSha: sha(s) });
  const only = () => w.e.onlyByIdentifier({ ids: [w.pat], viewer: MACHINE }).entities[0].documents;
  assert.equal(only(), 0, "a name match in every capture");
  /* testimony alone */
  const t = people();
  t.read("INFO-1", sha("t1"), [{ kind: "x", key: "1", label: "unrelated" }]);
  t.e.testify({ captureSha: sha("t1"), ref: "x:1", entityId: t.pat, basis: "I know" });
  assert.equal(t.e.onlyByIdentifier({ ids: [t.pat], viewer: MACHINE }).entities[0].documents, 0, "a testified capture alone");
  /* testimony beside an identifier match: counts, and does not disqualify */
  t.read("INFO-2", sha("t2"), [byId("bar 12345"), { kind: "x", key: "2", label: "unrelated" }]);
  t.e.resolve({ captureSha: sha("t2") });
  t.e.testify({ captureSha: sha("t2"), ref: "x:2", entityId: t.pat, basis: "I know" });
  assert.equal(t.e.onlyByIdentifier({ ids: [t.pat], viewer: MACHINE }).entities[0].documents, 1);
  /* null: a name row held before matched_by does not disqualify, an identifier row held before does not count */
  w.rows(`UPDATE resolutions SET matched_by=NULL WHERE capture_sha=? AND matched_by='label'`, sha("n1"));
  assert.equal(only(), 1, "the held-before name row disqualifies nothing");
  w.rows(`UPDATE resolutions SET matched_by=NULL WHERE capture_sha=? AND matched_by='identifier'`, sha("n1"));
  assert.equal(only(), 0, "the held-before identifier row counts nothing");
});

test("R57 refusals and bounds: NO_ENTITY for no ids, TOO_MANY_IDS beyond 500, each writing nothing; a viewer membership does not recognise is answered every one 0; the op reads `ids` from the query", () => {
  const w = people();
  w.read("INFO-1", sha("rf"), [byId("bar 12345")]);
  w.e.resolve({ captureSha: sha("rf") });
  for (const ids of [undefined, null, [], [""], [7], "ENT"]) {
    const r = w.e.onlyByIdentifier({ ids, viewer: MACHINE });
    assert.deepEqual([r.ok, r.reason, r.code], [false, "NO_ENTITY", "NO_ENTITY"], JSON.stringify(ids));
  }
  const max = Array.from({ length: ONLY_BY_IDENTIFIER_IDS_MAX }, (_, i) => `ENT-2026-${String(i).padStart(4, "0")}`);
  assert.equal(w.e.onlyByIdentifier({ ids: max, viewer: MACHINE }).count, 500);
  const over = w.e.onlyByIdentifier({ ids: [...max, "ENT-2026-9999"], viewer: MACHINE });
  assert.deepEqual([over.ok, over.reason, over.count, over.max], [false, "TOO_MANY_IDS", 501, 500]);
  for (const viewer of [null, undefined, "", "nonsense"])
    assert.equal(w.e.onlyByIdentifier({ ids: [w.pat], viewer }).entities[0].documents, 0, String(viewer));
  assert.deepEqual(ops(w, "entityidonly", { ids: ` ${w.pat},, `, viewer: MACHINE }).entities, [{ entity_id: w.pat, documents: 1 }]);
  assert.equal(ops(w, "entityidonly", { viewer: MACHINE }).reason, "NO_ENTITY");
});

/* ---------------------------------------------------------------- R59 */

function subjects() {
  const w = world();
  const fund = w.e.createEntity({ note: NOTE, kind: "fund", label: "Sewer Service Fund" }).entity_id;
  const ord = w.e.createEntity({ note: NOTE, kind: "ordinance", label: "Ordinance 26-4", aliases: ["Sewer Fund rate"] }).entity_id;
  const person = w.e.createEntity({ note: NOTE, kind: "person", label: "Sewer Smith" }).entity_id;
  const office = w.e.createEntity({ note: NOTE, kind: "office", label: "Fund Office" }).entity_id;
  return { ...w, fund, ord, person, office };
}

test("R59 subjectsNamed finds `sewer fund` in a fund labelled Sewer Service Fund and an ordinance with the alias Sewer Fund rate, count 2, each with its visible documents and the name that carried the terms; a capture in a hidden bundle leaves `documents` unchanged", () => {
  const w = subjects();
  w.project("PROJ-2026-0001-x", "insider");
  w.read("INFO-1", sha("s1"), [{ kind: "k", key: "1", label: "Sewer Service Fund" }]);
  w.read("INFO-2", sha("s2"), [{ kind: "k", key: "2", label: "Sewer Service Fund" }, { kind: "k", key: "3", label: "Sewer Fund rate" }]);
  w.read("PROJ-2026-0001-x", sha("sh"), [{ kind: "k", key: "4", label: "Sewer Service Fund" }]);
  for (const s of ["s1", "s2", "sh"]) w.e.resolve({ captureSha: sha(s) });
  const before = dump(w);
  const r = w.e.subjectsNamed({ q: "sewer fund", viewer: "member:outsider" });
  assert.deepEqual([r.ok, r.count, r.limit, r.truncated, r.next], [true, 2, SUBJECTS_LIMIT_DEFAULT, false, null]);
  assert.deepEqual(r.subjects.map((s) => [s.entity_id, s.kind, s.label, s.note, s.matched, s.documents]),
                   [[w.ord, "ordinance", "Ordinance 26-4", NOTE, "Sewer Fund rate", 1], [w.fund, "fund", "Sewer Service Fund", NOTE, "Sewer Service Fund", 2]]);
  assert.equal(w.e.subjectsNamed({ q: "sewer fund", viewer: "member:insider" }).subjects.find((s) => s.entity_id === w.fund).documents, 3, "a participant sees the fourth");
  assert.ok(!JSON.stringify(r).includes("PROJ-2026"));
  assert.deepEqual(dump(w), before, "writes nothing");
  /* the same fold: case, spacing and word order do not matter, a longer query does not match a shorter name */
  assert.equal(w.e.subjectsNamed({ q: "  FUND   sewer ", viewer: VIEWER }).count, 2);
  assert.equal(w.e.subjectsNamed({ q: "sewer fund rate", viewer: VIEWER }).count, 1);
  assert.equal(w.e.subjectsNamed({ q: "sewer fund rate extra", viewer: VIEWER }).count, 0);
  /* one term finds every subject carrying it, of any kind */
  assert.deepEqual(w.e.subjectsNamed({ q: "sewer", viewer: VIEWER }).subjects.map((s) => s.entity_id).sort(), [w.fund, w.ord, w.person].sort());
});

test("R59 subjectsNamed kinds narrow it, a withdrawn alias matches nothing, the answer pages by label fold then id with `next`, and it is never ranked or scored", () => {
  const w = subjects();
  assert.deepEqual(w.e.subjectsNamed({ q: "sewer", kinds: ["fund", "person"], viewer: VIEWER }).subjects.map((s) => s.kind), ["fund", "person"]);
  assert.deepEqual(w.e.subjectsNamed({ q: "sewer", kinds: "ordinance", viewer: VIEWER }).subjects.map((s) => s.entity_id), [w.ord]);
  w.e.withdrawAlias({ entityId: w.ord, alias: "Sewer Fund rate", reason: "wrong" });
  assert.equal(w.e.subjectsNamed({ q: "sewer", kinds: "ordinance", viewer: VIEWER }).count, 0);
  /* paging: five subjects, label order, two to a page */
  const p = world();
  const ids = ["Sewer Fund E", "Sewer Fund B", "Sewer Fund D", "Sewer Fund A", "Sewer Fund C"].map((label) => p.e.createEntity({ note: NOTE, kind: "fund", label }).entity_id);
  const seen = [];
  let after = null, pages = 0, last;
  do {
    last = p.e.subjectsNamed({ q: "sewer fund", limit: 2, after, viewer: VIEWER });
    assert.equal(last.count, 5, "count is the whole number matching, not the page's");
    seen.push(...last.subjects.map((s) => s.label));
    after = last.next; pages++;
  } while (last.truncated);
  assert.deepEqual([pages, seen, last.next], [3, ["Sewer Fund A", "Sewer Fund B", "Sewer Fund C", "Sewer Fund D", "Sewer Fund E"], null]);
  assert.deepEqual(ids.length, 5);
  assert.ok(seen.every((_, i, a) => i === 0 || a[i - 1] < a[i]));
  for (const s of last.subjects) assert.deepEqual(Object.keys(s).sort(), ["documents", "entity_id", "kind", "label", "matched", "note"]);
  /* the same label folds to one order, then the entity id */
  const t = world();
  const x = t.e.createEntity({ note: NOTE, kind: "fund", label: "Twin Fund" }).entity_id;
  const y = t.e.createEntity({ note: NOTE, kind: "office", label: "twin  FUND" }).entity_id;
  assert.deepEqual(t.e.subjectsNamed({ q: "twin", viewer: VIEWER }).subjects.map((s) => s.entity_id), [x, y]);
  /* limit clamps 1-200, default 50 */
  assert.deepEqual([p.e.subjectsNamed({ q: "sewer", limit: 9999, viewer: VIEWER }).limit, p.e.subjectsNamed({ q: "sewer", limit: -4, viewer: VIEWER }).limit,
                    p.e.subjectsNamed({ q: "sewer", viewer: VIEWER }).limit, p.e.subjectsNamed({ q: "sewer", limit: "junk", viewer: VIEWER }).limit],
                   [SUBJECTS_LIMIT_MAX, 1, 50, 50]);
});

test("R59 control: a q of punctuation is refused NO_QUERY, a kind outside the list UNKNOWN_KIND, each writing nothing; a viewer membership does not recognise answers count 0; the exact lookups R6 and R15 stay as they were; the op reads q, kinds, limit, after and viewer from the query", () => {
  const w = subjects();
  const before = dump(w);
  for (const q of ["!!!", "", "   ", null, undefined, 7]) {
    const r = w.e.subjectsNamed({ q, viewer: VIEWER });
    assert.deepEqual([r.ok, r.reason], [false, "NO_QUERY"], String(q));
  }
  const bad = w.e.subjectsNamed({ q: "sewer", kinds: ["fund", "tribunal"], viewer: VIEWER });
  assert.deepEqual([bad.ok, bad.reason, bad.kind], [false, "UNKNOWN_KIND", "tribunal"]);
  assert.equal(w.e.subjectsNamed({ q: "sewer", kinds: [""], viewer: VIEWER }).reason, "NO_KIND");
  for (const viewer of [null, undefined, "", "nonsense"]) {
    const r = w.e.subjectsNamed({ q: "sewer", viewer });
    assert.deepEqual([r.ok, r.count, r.subjects], [true, 0, []], String(viewer));
  }
  assert.deepEqual(dump(w), before);
  /* neither counts nor matches by terms */
  assert.equal(w.e.entitiesByAlias({ alias: "sewer fund", viewer: VIEWER }).count, 0, "R6 is the whole-alias lookup");
  assert.equal(w.e.entitiesByAlias({ alias: "Sewer Fund rate", viewer: VIEWER }).count, 1);
  const op = ops(w, "subjectsnamed", { q: "sewer", kinds: "fund, person", limit: "1", viewer: VIEWER });
  assert.deepEqual([op.subjects.length, op.count, op.truncated, op.kinds], [1, 2, true, ["fund", "person"]]);
  assert.deepEqual(ops(w, "subjectsnamed", { q: "sewer", kinds: "fund, person", limit: "1", after: op.next, viewer: VIEWER }).subjects.map((s) => s.kind), ["person"]);
  assert.equal(op.subjects[0].kind, "fund");
});

/* ---------------------------------------------------------------- R60 */

function registry() {
  const w = world();
  const sewerFund = w.e.createEntity({ note: NOTE, kind: "fund", label: "Sewer Fund" }).entity_id;
  const service = w.e.createEntity({ note: NOTE, kind: "fund", label: "Sewer Service Fund" }).entity_id;
  const fund = w.e.createEntity({ note: NOTE, kind: "office", label: "Fund" }).entity_id;
  const swapped = w.e.createEntity({ note: NOTE, kind: "program", label: "Sewer Sevrice Fund" }).entity_id;
  return { ...w, sewerFund, service, fund, swapped };
}

test("R60 similarSubjects: Sewer Service Fund against a registered Sewer Fund answers `contains`, against Sewer Servce Fund `spelling`, against Sewer Service Fund `same`; ordered same, contains, spelling, then label fold and id; each says the name that is close and states a fact, no score", () => {
  const w = registry();
  const mis = w.e.createEntity({ note: NOTE, kind: "fund", label: "Sewer Servce Fund" }).entity_id;
  const before = dump(w);
  const r = w.e.similarSubjects({ name: "Sewer Service Fund", viewer: VIEWER });
  assert.deepEqual(r.similar.map((s) => [s.entity_id, s.closeness, s.alias]), [
    [w.service, "same", "Sewer Service Fund"], [w.sewerFund, "contains", "Sewer Fund"],
    [mis, "spelling", "Sewer Servce Fund"], [w.swapped, "spelling", "Sewer Sevrice Fund"]]);
  assert.deepEqual([r.ok, r.count, r.limit, r.truncated], [true, 4, SIMILAR_LIMIT_DEFAULT, false]);
  assert.deepEqual(Object.keys(r.similar[0]).sort(), ["alias", "closeness", "entity_id", "kind", "label", "note"]);
  assert.ok(r.similar.every((s) => !("score" in s) && !("closeness_score" in s)));
  assert.deepEqual(dump(w), before, "writes nothing and refuses nothing");
  /* the other direction of containment, and the spelling of a name registered shorter */
  assert.equal(w.e.similarSubjects({ name: "Sewer Fund", viewer: VIEWER }).similar.find((s) => s.entity_id === w.service).closeness, "contains");
  assert.equal(w.e.similarSubjects({ name: "Sewer Servce Fund", viewer: VIEWER }).similar.find((s) => s.entity_id === w.service).closeness, "spelling");
  /* one insertion, one deletion, one replacement and one swap of adjacent characters are each one edit */
  for (const near of ["Sewer Servicce Fund", "Sewer Servce Fund", "Sewer Servixe Fund", "Sewer Sevrice Fund"])
    assert.equal(w.e.similarSubjects({ name: near, viewer: VIEWER }).similar.find((s) => s.entity_id === w.service).closeness, "spelling", near);
  /* two edits are not close */
  assert.equal(w.e.similarSubjects({ name: "Sewer Servcie Fnd", viewer: VIEWER }).similar.some((s) => s.entity_id === w.service), false);
  /* an entity whose label is the same and whose alias is close is reported by its closest name */
  const both = w.e.createEntity({ note: NOTE, kind: "fund", label: "Water Fund", aliases: ["Sewer Service Fund"] }).entity_id;
  const hit = w.e.similarSubjects({ name: "sewer  service FUND", viewer: VIEWER }).similar.find((s) => s.entity_id === both);
  assert.deepEqual([hit.closeness, hit.alias, hit.label], ["same", "Sewer Service Fund", "Water Fund"]);
});

test("R60 control: Fund alone answers none by `contains` (a one-word name never matches by containment), a short fold never matches by spelling, an entity whose alias was withdrawn is not matched by that alias, kind narrows, and a name that folds to nothing is NO_ALIAS", () => {
  const w = registry();
  const one = w.e.similarSubjects({ name: "Fund", viewer: VIEWER });
  assert.deepEqual(one.similar.map((s) => [s.entity_id, s.closeness]), [[w.fund, "same"]], "only the equal fold, none by contains");
  assert.equal(w.e.similarSubjects({ name: "Sewer", viewer: VIEWER }).similar.length, 0, "one word: no containment");
  /* spelling needs six characters of fold at each end */
  const s = world();
  s.e.createEntity({ note: NOTE, kind: "office", label: "Clerk" });
  assert.equal(s.e.similarSubjects({ name: "Clerks", viewer: VIEWER }).similar.length, 0, "five characters at one end");
  s.e.createEntity({ note: NOTE, kind: "office", label: "Treasurer" });
  assert.equal(s.e.similarSubjects({ name: "Treasurar", viewer: VIEWER }).similar[0].closeness, "spelling");
  /* a withdrawn alias */
  const a = world();
  const ent = a.e.createEntity({ note: NOTE, kind: "ordinance", label: "Ord 26-4", aliases: ["Sewer Rate Fund"] }).entity_id;
  assert.equal(a.e.similarSubjects({ name: "Sewer Rate Fund", viewer: VIEWER }).similar[0].entity_id, ent);
  a.e.withdrawAlias({ entityId: ent, alias: "Sewer Rate Fund", reason: "wrong" });
  assert.equal(a.e.similarSubjects({ name: "Sewer Rate Fund", viewer: VIEWER }).count, 0);
  /* kind narrows, and is refused as R51 refuses it */
  assert.deepEqual(w.e.similarSubjects({ name: "Sewer Service Fund", kind: "program", viewer: VIEWER }).similar.map((x) => x.entity_id), [w.swapped]);
  assert.equal(w.e.similarSubjects({ name: "Sewer Service Fund", kind: "tribunal", viewer: VIEWER }).reason, "UNKNOWN_KIND");
  /* NO_ALIAS is R2's: the same code, check and sentence addAlias answers */
  for (const name of ["", "   ", null, undefined]) {
    const r = w.e.similarSubjects({ name, viewer: VIEWER });
    const own = w.e.addAlias({ entityId: w.fund, alias: name });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "NO_ALIAS", "NO_ALIAS", own.check, own.translation], String(name));
  }
  /* a viewer membership does not recognise answers none; the limit clamps 1-50, default 10, truncated by reading one past */
  assert.deepEqual(w.e.similarSubjects({ name: "Sewer Service Fund", viewer: null }).similar, []);
  const cut = w.e.similarSubjects({ name: "Sewer Service Fund", limit: 2, viewer: VIEWER });
  assert.deepEqual([cut.count, cut.limit, cut.truncated], [2, 2, true]);
  assert.deepEqual([w.e.similarSubjects({ name: "x y", limit: 999, viewer: VIEWER }).limit, w.e.similarSubjects({ name: "x y", limit: 0, viewer: VIEWER }).limit,
                    w.e.similarSubjects({ name: "x y", viewer: VIEWER }).limit], [SIMILAR_LIMIT_MAX, 1, 10]);
  const viaOp = ops(w, "entitysimilar", { name: "Sewer Service Fund", kind: "fund", limit: "1", viewer: VIEWER });
  assert.deepEqual([viaOp.similar.length, viaOp.similar[0].closeness, viaOp.truncated], [1, "same", true]);
});

/* ---------------------------------------------------------------- R61 */

test("R61 a naming candidate carries `page`, the page a reader sees (the first page 1): a reference placed on the fourth page answers 4, one with no position null, one placed by a position that is no page null; namingDocuments and namingIn alike", () => {
  const w = world();
  const ent = w.e.createEntity({ note: NOTE, kind: "office", label: "Harbour Master" }).entity_id;
  w.read("INFO-1", sha("pgs"), [
    { kind: "a", key: "1", label: "Harbour Master", source: pg(4) },
    { kind: "b", key: "2", label: "Harbour Master" },
    { kind: "c", key: "3", label: "Harbour Master", source: { kind: "sheet-cell", ref: "A1", sheet: "S", cell: "A1" } },
    { kind: "d", key: "4", label: "Harbour Master", source: pg(1) },
  ]);
  const before = dump(w);
  const page = (r) => Object.fromEntries(r.map((d) => [d.ref, d.page]));
  const doc = w.e.namingDocuments({ entityId: ent, viewer: MACHINE });
  assert.deepEqual(page(doc.documents), { "a:1": 4, "b:2": null, "c:3": null, "d:4": 1 });
  const grouped = w.e.namingIn({ captureShas: [sha("pgs")], kinds: ["office"], viewer: MACHINE });
  assert.deepEqual(page(grouped.candidates), { "a:1": 4, "b:2": null, "c:3": null, "d:4": 1 });
  assert.deepEqual(dump(w), before, "writes nothing");
  /* the candidate is otherwise as R17 answers it */
  const a = doc.documents.find((d) => d.ref === "a:1");
  assert.deepEqual([a.correspondence, a.grade_if_resolved, a.matched_on], ["name", "C", "label"]);
  /* a reference read on several pages is read at its first place */
  const m = world();
  const e2 = m.e.createEntity({ note: NOTE, kind: "office", label: "Clerk" }).entity_id;
  m.read("INFO-1", sha("multi"), [{ kind: "k", key: "1", label: "Clerk", source: pg(9), occurrences: [pg(9), pg(2)] }]);
  assert.equal(m.e.namingDocuments({ entityId: e2, viewer: MACHINE }).documents[0].page, 9);
});
