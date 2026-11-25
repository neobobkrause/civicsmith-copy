/* entities' registry at its interface: R1–R8, R26, R28, R30. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { ENTITY_KINDS, RELATION_KINDS, ENTITY_CHECKS } from "../../../src/entities/index.mjs";

test("R1 createEntity refuses NO_KIND, UNKNOWN_KIND naming the closed list, then ENTITY_NO_LABEL with its own row (C-91.6) (ENTITY_NO_NOTE's arm follows); otherwise ENT-<year>-NNNN with the canonical and each distinct folded alias once, in one transaction", () => {
  const { e, rows } = world();
  assert.equal(e.createEntity({ label: "x" }).reason, "NO_KIND");
  assert.equal(e.createEntity({ note: "a subject the test registers", kind: "  ", label: "x" }).reason, "NO_KIND");
  const u = e.createEntity({ note: "a subject the test registers", kind: "theme", label: "x" });
  assert.equal(u.reason, "UNKNOWN_KIND");
  for (const k of ENTITY_KINDS) assert.ok(u.detail.includes(k));
  const row = ENTITY_CHECKS.ENTITY_NO_LABEL;
  assert.deepEqual([row.check, row.where], ["C-91.6", "src/entities/index.mjs createEntity > is-entity-labelled"]);
  assert.equal(row.translation, word("refusal.ENTITY_NO_LABEL"));
  for (const label of [undefined, null, "", "   ", " \t\n "]) {
    const nl = e.createEntity({ note: "a subject the test registers", kind: "office", label });
    assert.deepEqual([nl.ok, nl.reason, nl.code, nl.check, nl.translation], [false, "ENTITY_NO_LABEL", "ENTITY_NO_LABEL", row.check, row.translation], String(label));
    assert.equal(typeof nl.detail, "string");
  }
  assert.equal(e.createEntity({ label: "" }).reason, "NO_KIND", "the kind is refused first");
  assert.equal(rows(`SELECT COUNT(*) AS n FROM entities`)[0].n, 0, "a refusal writes nothing");
  const r = e.createEntity({ kind: " Office ", label: "  City   Clerk ", note: "n".repeat(3000),
                             aliases: ["city clerk", "Clerk", "CLERK", "   ", "The Clerk"], declaredBy: "member:ann" });
  assert.equal(r.ok, true);
  assert.match(r.entity_id, /^ENT-2026-\d{4}$/);
  assert.equal(r.kind, "office");
  assert.equal(r.label, "City Clerk");
  assert.equal(r.alias_count, 3, "the label, 'clerk', 'the clerk': duplicates of a fold and empty folds are dropped");
  assert.deepEqual(Object.keys(r).sort(), ["alias_count", "at", "entity_id", "kind", "label", "ok"]);
  assert.equal(rows(`SELECT note FROM entities`)[0].note.length, 2000);
  const long = e.createEntity({ note: "a subject the test registers", kind: "office", label: "L".repeat(300) });
  assert.equal(long.label.length, 200);
  const r2 = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Second" });
  assert.equal(Number(r2.entity_id.slice(-4)), Number(long.entity_id.slice(-4)) + 1);
  const canon = rows(`SELECT alias, canonical FROM entity_aliases WHERE entity_id=? ORDER BY canonical DESC`, r.entity_id);
  assert.equal(canon[0].alias, "City Clerk");
  assert.equal(canon[0].canonical, 1);
});

test("R1 (DEC-88) createEntity refuses ENTITY_NO_NOTE with its own row (C-91.8) when the declarer's note is absent, not a string, blank or only whitespace, asked after ENTITY_NO_LABEL and before anything is written: no id allocated, no entity, no alias", () => {
  const { e, rows } = world();
  const counts = () => rows(`SELECT (SELECT COUNT(*) FROM entities) AS ents, (SELECT COUNT(*) FROM entity_aliases) AS als`)[0];
  const first = e.createEntity({ kind: "office", label: "Harbour Office", note: "the office that keeps the harbour's register", aliases: ["ho"] });
  assert.equal(first.ok, true);
  const before = counts();
  assert.deepEqual([before.ents, before.als], [1, 2]);
  const row = ENTITY_CHECKS.ENTITY_NO_NOTE;
  for (const note of [undefined, null, "", "   ", " \t\n ", 7, 0, true, {}, ["a note"]]) {
    const r = e.createEntity({ kind: "office", label: "Port Board", note, aliases: ["pb", "the board"], declaredBy: "member:ann" });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "ENTITY_NO_NOTE", "ENTITY_NO_NOTE", "C-91.8", row.translation], JSON.stringify(note));
    assert.equal(typeof r.detail, "string");
    assert.ok(r.detail.length > 0);
    assert.equal("entity_id" in r, false, "no id is answered");
  }
  const omitted = e.createEntity({ kind: "office", label: "Port Board" });
  assert.equal(omitted.reason, "ENTITY_NO_NOTE", "a note left out of the request");
  assert.deepEqual(counts(), before, "nothing was written: the entity count and the alias count are unchanged");
  /* the order: the kind, then the label, then the note */
  assert.equal(e.createEntity({ label: "x" }).reason, "NO_KIND");
  assert.equal(e.createEntity({ kind: "theme", label: "x" }).reason, "UNKNOWN_KIND");
  assert.equal(e.createEntity({ kind: "office", label: " " }).reason, "ENTITY_NO_LABEL", "the label is asked before the note");
  assert.equal(e.createEntity({ kind: "office", label: " ", note: "a note" }).reason, "ENTITY_NO_LABEL");
  /* negative control: a noted entity is created, takes the next id (no refusal allocated one), and its note reads back */
  const noted = e.createEntity({ kind: "body", label: "Port Board", note: "  the board that sets the harbour's dues  ", declaredBy: "member:ann" });
  assert.equal(noted.ok, true);
  assert.equal(Number(noted.entity_id.slice(-4)), Number(first.entity_id.slice(-4)) + 1, "the next allocated id is unchanged by the refusals");
  assert.deepEqual(counts(), { ents: before.ents + 1, als: before.als + 1 });
  assert.equal(e.readEntity({ entityId: noted.entity_id }).entity.note, "  the board that sets the harbour's dues  ", "the note as the declarer gave it");
  assert.equal(e.entitiesByAlias({ alias: "Port Board" }).entities[0].note, "  the board that sets the harbour's dues  ");
  /* a longer note is kept, cut to 2,000 characters, never refused */
  const long = e.createEntity({ kind: "fund", label: "Dues Fund", note: "d".repeat(2600) });
  assert.equal(long.ok, true);
  assert.equal(e.readEntity({ entityId: long.entity_id }).entity.note, "d".repeat(2000));
  const exact = e.createEntity({ kind: "fund", label: "Exact Fund", note: "x".repeat(2000) });
  assert.equal(e.readEntity({ entityId: exact.entity_id }).entity.note.length, 2000);
});

test("R1 C-91.8 ENTITY_NO_NOTE is this module's own row, with R1's translation word for word, naming no place (R31); its number is its own", () => {
  const row = ENTITY_CHECKS.ENTITY_NO_NOTE;
  assert.deepEqual([row.check, row.where], ["C-91.8", "src/entities/index.mjs createEntity > is-entity-noted"]);
  assert.equal(row.translation, word("refusal.ENTITY_NO_NOTE"));
  assert.ok(Object.isFrozen(row));
  assert.ok(!/oakland|alameda|legistar/i.test(row.translation), "R31");
  const checks = Object.values(ENTITY_CHECKS).map((r) => r.check);
  assert.equal(new Set(checks).size, checks.length, "no other row shares C-91.8");
  assert.notEqual(row.translation, ENTITY_CHECKS.ENTITY_NO_LABEL.translation);
});

test("R2 addAlias refuses NO_ENTITY, NO_ALIAS, NO_SUCH_ENTITY, then ALREADY_ALIASED naming the held alias; one fold may be held by different entities", () => {
  const { e } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "City Clerk" }).entity_id;
  const b = e.createEntity({ note: "a subject the test registers", kind: "person", label: "Pat Doe" }).entity_id;
  assert.equal(e.addAlias({ alias: "x" }).reason, "NO_ENTITY");
  const nr = ENTITY_CHECKS.NO_ALIAS;
  assert.deepEqual([nr.check, nr.where], ["C-33.25", "src/entities/index.mjs noAlias > is-alias-named"], "this module's own row (copied, T18)");
  for (const alias of [undefined, null, "", " \t ", "\n\n"]) {
    const na = e.addAlias({ entityId: a, alias });
    assert.deepEqual([na.ok, na.reason, na.code, na.check, na.translation], [false, "NO_ALIAS", "NO_ALIAS", nr.check, nr.translation],
                     `a name that folds to nothing (${JSON.stringify(alias)}): the module's row`);
    assert.equal(typeof na.detail, "string");
  }
  assert.equal(e.readEntity({ entityId: a }).entity.aliases.length, 1, "a refused alias writes nothing");
  assert.equal(e.addAlias({ entityId: "ENT-2026-9999", alias: "x" }).reason, "NO_SUCH_ENTITY");
  const dup = e.addAlias({ entityId: a, alias: "  CITY clerk " });
  assert.equal(dup.reason, "ALREADY_ALIASED");
  assert.equal(dup.alias, "City Clerk");
  const ok = e.addAlias({ entityId: a, alias: "  The   Clerk ", declaredBy: "member:ann" });
  assert.deepEqual([ok.ok, ok.alias], [true, "The Clerk"]);
  assert.equal(e.addAlias({ entityId: b, alias: "the clerk" }).ok, true, "an ambiguous name is not refused");
  assert.equal(e.entitiesByAlias({ alias: "The Clerk" }).count, 2);
});

test("R3 declareRelation refuses in order UNKNOWN_RELATION, NO_ENDS, SELF_RELATION, NO_JUSTIFICATION, the act-shape NO_CITATION, NO_SUCH_ENTITY naming the end; REL-<year>-NNNN with no grade", () => {
  const { e } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "A" }).entity_id;
  const b = e.createEntity({ note: "a subject the test registers", kind: "body", label: "B" }).entity_id;
  const u = e.declareRelation({ relation: "A", fromEntity: a, toEntity: b, justification: "j", citation: "c" });
  assert.equal(u.reason, "UNKNOWN_RELATION");
  assert.match(u.detail, /grade is NOT a relation/i);
  for (const k of RELATION_KINDS) assert.ok(u.detail.includes(k));
  assert.equal(e.declareRelation({ relation: "member_of", fromEntity: a }).reason, "NO_ENDS");
  assert.equal(e.declareRelation({ relation: "member_of", fromEntity: a, toEntity: a }).reason, "SELF_RELATION");
  assert.equal(e.declareRelation({ relation: "member_of", fromEntity: a, toEntity: b, justification: " " }).reason, "NO_JUSTIFICATION");
  const nc = e.declareRelation({ relation: "member_of", fromEntity: a, toEntity: b, justification: "j" });
  assert.equal(nc.reason, "NO_CITATION");
  assert.equal(nc.code, "NO_CITATION");
  assert.ok(nc.check && nc.translation, "the act-shape row's check and translation");
  const nf = e.declareRelation({ relation: "member_of", fromEntity: "ENT-2026-0404", toEntity: b, justification: "j", citation: "c" });
  assert.deepEqual([nf.reason, nf.end], ["NO_SUCH_ENTITY", "from"]);
  const nt = e.declareRelation({ relation: "member_of", fromEntity: a, toEntity: "ENT-2026-0404", justification: "j", citation: "c" });
  assert.deepEqual([nt.reason, nt.end], ["NO_SUCH_ENTITY", "to"]);
  const r = e.declareRelation({ relation: " Member_Of ", fromEntity: a, toEntity: b, justification: "j".repeat(5000),
                                citation: "c".repeat(3000), grade: "A" });
  assert.match(r.relation_id, /^REL-2026-\d{4}$/);
  assert.equal(r.relation, "member_of");
  assert.equal(r.justification.length, 4000);
  assert.equal(r.citation.length, 2000);
  assert.equal("grade" in r, false);
  assert.equal("grade" in e.readRelation({ relationId: r.relation_id }).relation, false);
});

test("R4 R28 declared_by and resolved_by are recorded exactly as the control plane stamps them, a machine as class:<cls>", () => {
  const { e, read } = world();
  const m = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Machine Made", declaredBy: MACHINE });
  const ent = e.readEntity({ entityId: m.entity_id }).entity;
  assert.equal(ent.declared_by, MACHINE);
  assert.equal(ent.aliases[0].declared_by, MACHINE);
  const p = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Person Made", declaredBy: "member:ann" });
  assert.equal(e.addAlias({ entityId: p.entity_id, alias: "pm", declaredBy: "member:bo" }).ok, true);
  const al = e.readEntity({ entityId: p.entity_id }).entity.aliases.find((x) => x.alias === "pm");
  assert.equal(al.declared_by, "member:bo");
  const rel = e.declareRelation({ relation: "overlaps", fromEntity: m.entity_id, toEntity: p.entity_id, justification: "j", citation: "c", declaredBy: MACHINE });
  assert.equal(e.readRelation({ relationId: rel.relation_id }).relation.declared_by, MACHINE);
  read("INFO-1", sha("d"), [{ kind: "x", key: "1", label: "Person Made" }]);
  const r = e.resolve({ captureSha: sha("d"), resolvedBy: MACHINE });
  assert.equal(r.resolved[0].resolved_by, MACHINE);
  const t = e.testify({ captureSha: sha("d"), ref: "x:1", entityId: m.entity_id, basis: "I was there", resolvedBy: "member:ann" });
  assert.equal(t.resolved_by, "member:ann");
});

test("R5 readEntity: NO_ENTITY for an empty id, found:false for an absent one; aliases canonical first, every relation it is an end of with direction, oldest first", () => {
  const { e } = world();
  assert.equal(e.readEntity({}).reason, "NO_ENTITY");
  assert.deepEqual(e.readEntity({ entityId: "ENT-2026-0404" }), { ok: true, found: false, entity_id: "ENT-2026-0404", entity: null });
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Zed", aliases: ["alpha"], declaredBy: "member:ann" }).entity_id;
  const b = e.createEntity({ note: "a subject the test registers", kind: "body", label: "B" }).entity_id;
  const c = e.createEntity({ note: "a subject the test registers", kind: "body", label: "C" }).entity_id;
  const r1 = e.declareRelation({ relation: "member_of", fromEntity: a, toEntity: b, justification: "j", citation: "c" }).relation_id;
  const r2 = e.declareRelation({ relation: "overlaps", fromEntity: c, toEntity: a, justification: "j", citation: "c" }).relation_id;
  const got = e.readEntity({ entityId: a });
  assert.equal(got.found, true);
  const ent = got.entity;
  assert.deepEqual(Object.keys(ent).sort(), ["aliases", "aliases_truncated", "at", "confirmed_at", "confirmed_by", "contact", "declared_by", "defect_count", "defects",
    "defects_truncated", "entity_id", "forum_kind", "identifiers", "identifiers_truncated", "kind", "label", "law", "limit", "named_by_member", "note", "proceeding",
    "relations", "relations_limit", "relations_truncated", "sector", "sector_history", "sector_history_truncated"]);
  assert.deepEqual([ent.sector, ent.sector_history, ent.identifiers, ent.proceeding, ent.forum_kind], [null, [], [], null, null], "an office: no sector, no identifier, no facet, no forum kind");
  assert.deepEqual(ent.aliases.map((x) => [x.alias, x.canonical]), [["Zed", true], ["alpha", false]]);
  for (const x of ent.aliases) assert.ok(x.declared_by === "member:ann" && x.at);
  assert.deepEqual(ent.relations.map((r) => [r.relation_id, r.direction]), [[r1, "out"], [r2, "in"]]);
  for (const r of ent.relations) assert.equal("grade" in r, false);
});

test("R6 entitiesByAlias answers every entity holding the fold, in id order, ambiguity kept; an empty fold answers count 0; readRelation NO_RELATION and found:false", () => {
  const { e } = world();
  const b = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Board" }).entity_id;
  const a = e.createEntity({ note: "a subject the test registers", kind: "body", label: "Other", aliases: ["BOARD"] }).entity_id;
  const hit = e.entitiesByAlias({ alias: "  board " });
  assert.equal(hit.count, 2);
  assert.deepEqual(hit.entities.map((x) => x.entity_id), [b, a].sort());
  assert.equal(e.entitiesByAlias({ alias: "  " }).count, 0);
  assert.equal(e.entitiesByAlias({ alias: "nobody" }).count, 0);
  assert.equal(e.readRelation({}).reason, "NO_RELATION");
  assert.deepEqual(e.readRelation({ relationId: "REL-2026-0404" }), { ok: true, found: false, relation_id: "REL-2026-0404", relation: null });
});

test("R7 has answers whether the registry holds the id; kinds and relationKinds answer the closed lists", () => {
  const { e } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "fund", label: "F" }).entity_id;
  assert.equal(e.has(a), true);
  assert.equal(e.has("ENT-2026-0404"), false);
  assert.equal(e.has(""), false);
  assert.equal(e.has(null), false);
  assert.deepEqual(e.kinds(), ["source", "institution", "office", "movement", "person", "body", "ordinance", "parcel", "contract", "fund",
    "program", "place", "proceeding"], "with program, place and proceeding (K1441)");
  assert.deepEqual(e.relationKinds(), ["proxy_for", "member_of", "overlaps"]);
  e.kinds().push("theme");
  assert.equal(e.kinds().length, 13, "a caller cannot widen the list");
  for (const k of ["program", "place"]) assert.equal(e.createEntity({ note: "a subject the test registers", kind: k, label: `A ${k}` }).ok, true, k);
});

test("R8 an alias or a relation is withdrawn, never erased: NO_REASON, NO_SUCH_ALIAS, NO_SUCH_RELATION, a repeat already:true; hidden from new matches and R6, still read as withdrawn; resolutions through it kept and marked", () => {
  const { e, read, rows } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "City Clerk", aliases: ["Clerk"] }).entity_id;
  const b = e.createEntity({ note: "a subject the test registers", kind: "body", label: "B" }).entity_id;
  read("INFO-1", sha("w1"), [{ kind: "doc", key: "1", label: "Clerk" }]);
  assert.equal(e.resolve({ captureSha: sha("w1") }).resolved[0].grade, "C");
  assert.equal(e.withdrawAlias({ entityId: a, alias: "Clerk" }).reason, "NO_REASON");
  assert.equal(e.withdrawAlias({ entityId: a, alias: "Nope", reason: "r" }).reason, "NO_SUCH_ALIAS");
  assert.equal(e.withdrawAlias({ entityId: "ENT-2026-0404", alias: "Clerk", reason: "r" }).reason, "NO_SUCH_ALIAS");
  assert.equal(e.withdrawAlias({ entityId: a, alias: "  ", reason: "r" }).reason, "NO_SUCH_ALIAS");
  const w = e.withdrawAlias({ entityId: a, alias: " clerk ", reason: "a different office", withdrawnBy: "member:ann" });
  assert.equal(w.ok, true);
  assert.equal(w.withdrawn.by, "member:ann");
  assert.deepEqual(w.resolutions_resting, [{ capture_sha: sha("w1"), ref: "doc:1", grade: "C" }]);
  assert.deepEqual([w.resolutions_resting_truncated, w.limit], [false, 500]);
  const before = rows(`SELECT * FROM entity_aliases`).length;
  const again = e.withdrawAlias({ entityId: a, alias: "Clerk", reason: "again", withdrawnBy: "member:bo" });
  assert.deepEqual([again.ok, again.already, again.withdrawn.by], [true, true, "member:ann"]);
  assert.equal(rows(`SELECT * FROM entity_aliases`).length, before);
  /* hidden */
  assert.equal(e.entitiesByAlias({ alias: "Clerk" }).count, 0);
  read("INFO-2", sha("w2"), [{ kind: "doc", key: "2", label: "Clerk" }]);
  assert.equal(e.resolve({ captureSha: sha("w2") }).resolved_count, 0, "matches nothing new");
  assert.equal(e.namingDocuments({ entityId: a, viewer: MACHINE }).names_used, 1, "the lookup walks live names only");
  /* still seen */
  const al = e.readEntity({ entityId: a }).entity.aliases.find((x) => x.alias === "Clerk");
  assert.deepEqual(al.withdrawn, { by: "member:ann", at: w.withdrawn.at, reason: "a different office" });
  assert.equal(e.addAlias({ entityId: a, alias: "clerk" }).reason, "ALREADY_ALIASED");
  /* kept and marked */
  const res = e.resolutionsFor({ captureSha: sha("w1"), viewer: MACHINE }).resolutions[0];
  assert.equal(res.grade, "C");
  assert.equal(res.withdrawn_name.alias, "Clerk");
  assert.equal(e.concerns({ entityId: a, viewer: MACHINE }).documents[0].withdrawn_name.alias, "Clerk");
  /* relations */
  const rel = e.declareRelation({ relation: "member_of", fromEntity: a, toEntity: b, justification: "j", citation: "c" }).relation_id;
  assert.equal(e.withdrawRelation({ relationId: rel }).reason, "NO_REASON");
  assert.equal(e.withdrawRelation({ relationId: "REL-2026-0404", reason: "r" }).reason, "NO_SUCH_RELATION");
  assert.equal(e.withdrawRelation({ reason: "r" }).reason, "NO_RELATION");
  const wr = e.withdrawRelation({ relationId: rel, reason: "mistaken", withdrawnBy: MACHINE });
  assert.equal(wr.ok, true);
  assert.equal(e.withdrawRelation({ relationId: rel, reason: "x" }).already, true);
  const rr = e.readRelation({ relationId: rel }).relation;
  assert.deepEqual([rr.withdrawn.by, rr.withdrawn.reason], [MACHINE, "mistaken"]);
  assert.equal(e.readEntity({ entityId: a }).entity.relations[0].withdrawn.reason, "mistaken");
  assert.equal(rows(`SELECT COUNT(*) AS n FROM entity_relations`)[0].n, 1, "nothing is deleted");
});

test("R26 a declared relation carries no grade and is never traversed to resolve a reference or to answer concerns (its walk as a declared hop is R47's test)", () => {
  const { e, read } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha Office" }).entity_id;
  const p = e.createEntity({ note: "a subject the test registers", kind: "body", label: "Proxy Body" }).entity_id;
  e.declareRelation({ relation: "proxy_for", fromEntity: p, toEntity: a, justification: "j", citation: "c" });
  read("INFO-1", sha("r26"), [{ kind: "x", key: "1", label: "Proxy Body" }]);
  const r = e.resolve({ captureSha: sha("r26") });
  assert.deepEqual(r.resolved.map((m) => m.entity_id), [p]);
  assert.equal(e.concerns({ entityId: a, viewer: MACHINE }).count, 0);
  assert.equal(e.strongestByCapture(a).size, 0);
});

test("R30 purge: the registry is cleared by the whole-store purge only; resolutions and resolution_defects are keyed to their bundle", () => {
  const { e, read, record, rows } = world();
  const a = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Alpha" }).entity_id;
  const b = e.createEntity({ note: "a subject the test registers", kind: "office", label: "Beta" }).entity_id;
  e.declareRelation({ relation: "overlaps", fromEntity: a, toEntity: b, justification: "j", citation: "c" });
  read("INFO-1", sha("p1"), [{ kind: "x", key: "1", label: "Alpha" }]);
  read("INFO-2", sha("p2"), [{ kind: "x", key: "2", label: "Alpha" }]);
  e.resolve({ captureSha: sha("p1") }); e.resolve({ captureSha: sha("p2") });
  e.reportResolutionDefect({ captureSha: sha("p1"), ref: "x:1", entityId: a, reason: "wrong", by: "member:ann" });
  e.reportResolutionDefect({ captureSha: sha("p2"), ref: "x:2", entityId: a, reason: "wrong", by: "member:ann" });
  const one = record.purge({ bundleId: "INFO-1" });
  assert.equal(one.removed.resolutions, 1);
  assert.equal(one.removed.resolution_defects, 1, "a defect report is keyed to its bundle");
  assert.deepEqual(rows(`SELECT capture_sha FROM resolution_defects`).map((r) => r.capture_sha), [sha("p2")]);
  for (const t of ["entities", "entity_aliases", "entity_relations", "entity_sectors", "entity_identifiers", "entity_proceedings"])
    assert.equal(one.removed[t] ?? 0, 0, t);
  assert.equal(rows(`SELECT COUNT(*) AS n FROM entities`)[0].n, 2);
  e.setSector({ entityId: e.createEntity({ note: "n", kind: "body", label: "Board" }).entity_id, sector: "government", note: "n" });
  assert.equal(record.purge({ bundleId: "INFO-2" }).removed.entity_sectors ?? 0, 0, "a bundle's purge leaves the registry");
  assert.equal(rows(`SELECT COUNT(*) AS n FROM entity_sectors`)[0].n, 1);
  const all = record.purge({});
  const tables = ["resolution_defects", "resolutions", "entities", "entity_aliases", "entity_relations", "entity_sectors",
                  "entity_identifiers", "entity_proceedings"];
  for (const t of tables) assert.ok(t in all.removed, t);
  for (const t of tables) assert.equal(rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n, 0, t);
});
