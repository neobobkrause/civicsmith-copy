/* entities' T33 work at its interface (T33-25): the ENT- counter without a ceiling (R1), the sector (R42), scheme
   identifiers and the identifier tier (R9, R43, R44), the proceeding facet and its registration from a capture (R45,
   R46), the declared relations as a connection owner (R26, R47, R48) and the explicit table declarations (R49). Run
   over the test profile (a jurisdiction that is not the first profile's, layers.md rule 3). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { entitiesOf, SECTORS, ORGANISATION_KINDS, CONNECTION_KINDS, CONNECTION_DECLARES, OWNER_REGISTRATION,
         TABLE_DECLARATIONS, ENTITIES_TABLES } from "../../../src/entities/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { reasonText } from "../../../src/civil-time/index.mjs";
import { kindOf, neighbours as registryNeighbours, ownerConformance, checkConnection, BOUNDS, DECLARED_LABEL,
         LOWEST_GRADE, isRecordId } from "../../../src/connection-grammar/index.mjs";

const PE = ["test-port-ellery"];
const NOTE = "a subject the test registers";
const MIN = "https://minutes.port-ellery.example/a/1";
const count = (w, t) => w.rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;

test("R1 the ENT- counter has no ceiling: after ENT-<year>-9999 the next is ENT-<year>-10000, allocated, read back and a record id", () => {
  const w = world();
  w.st.sql.exec(`INSERT INTO seq (scope, next) VALUES ('ENT-2026', 9999)`);
  const a = w.e.createEntity({ note: NOTE, kind: "office", label: "Nine Thousand" });
  const b = w.e.createEntity({ note: NOTE, kind: "office", label: "Ten Thousand" });
  assert.deepEqual([a.entity_id, b.entity_id], ["ENT-2026-9999", "ENT-2026-10000"]);
  assert.equal(w.e.readEntity({ entityId: b.entity_id }).entity.label, "Ten Thousand");
  assert.equal(w.e.has("ENT-2026-10000"), true);
  assert.equal(isRecordId("ENT-2026-10000"), true, "the id grammar accepts it");
  const r = w.e.declareRelation({ relation: "overlaps", fromEntity: a.entity_id, toEntity: b.entity_id, justification: "j", citation: "c" });
  assert.equal(r.ok, true, "the 10,000th is usable wherever an id is");
});

test("R42 an organisation carries a sector of the closed eight: absent is undetermined, never guessed; outside the list UNKNOWN_SECTOR, a sector on another kind NOT_AN_ORGANISATION, each before anything is written; sectors() answers the list", () => {
  const w = world();
  assert.deepEqual(SECTORS, ["government", "company", "nonprofit", "association", "political", "religious", "education", "other"]);
  assert.deepEqual(w.e.sectors(), [...SECTORS]);
  w.e.sectors().push("x");
  assert.equal(w.e.sectors().length, 8);
  assert.deepEqual(ORGANISATION_KINDS, ["institution", "body", "movement"]);
  for (const kind of ORGANISATION_KINDS) {
    const none = w.e.createEntity({ note: NOTE, kind, label: `A ${kind}` });
    assert.equal(none.sector, "undetermined", kind);
    assert.equal(w.e.readEntity({ entityId: none.entity_id }).entity.sector, "undetermined");
    for (const sector of SECTORS) {
      const s = w.e.createEntity({ note: NOTE, kind, label: `${kind} ${sector}`, sector });
      assert.equal(w.e.readEntity({ entityId: s.entity_id }).entity.sector, sector, `${kind} ${sector}`);
    }
  }
  const before = [count(w, "entities"), count(w, "entity_aliases"), w.rows(`SELECT next FROM seq WHERE scope='ENT-2026'`)[0].next];
  for (const sector of ["undetermined", "Government", "club", 7, ""]) {
    const r = w.e.createEntity({ note: NOTE, kind: "body", label: "Club", sector });
    assert.deepEqual([r.ok, r.reason, r.sectors], [false, "UNKNOWN_SECTOR", [...SECTORS]], JSON.stringify(sector));
  }
  for (const kind of ["office", "person", "fund", "proceeding", "place", "program"]) {
    const r = w.e.createEntity({ note: NOTE, kind, label: "X", sector: "government" });
    assert.deepEqual([r.ok, r.reason, r.kind], [false, "NOT_AN_ORGANISATION", kind], kind);
  }
  assert.deepEqual([count(w, "entities"), count(w, "entity_aliases"), w.rows(`SELECT next FROM seq WHERE scope='ENT-2026'`)[0].next], before,
                   "no id allocated, nothing written");
  const office = w.e.createEntity({ note: NOTE, kind: "office", label: "Clerk's Office" });
  assert.equal("sector" in office, false);
  assert.equal(w.e.readEntity({ entityId: office.entity_id }).entity.sector, null, "a kind that is not an organisation has none");
  /* an organisation registered before T33 (no sector held) reads undetermined */
  w.st.sql.exec(`INSERT INTO entities (entity_id, kind, label, note, declared_by, at) VALUES ('ENT-2025-0001', 'institution', 'Old', 'n', null, '2025-01-01')`);
  assert.equal(w.e.readEntity({ entityId: "ENT-2025-0001" }).entity.sector, "undetermined");
});

test("R42 setSector sets or corrects by a stamped act, refusing NO_SUCH_ENTITY, NOT_AN_ORGANISATION, UNKNOWN_SECTOR, then NO_REASON; the earlier value is kept in its history, never erased; a repeat writes nothing", () => {
  const w = world();
  const org = w.e.createEntity({ note: NOTE, kind: "institution", label: "Harbour Trust" }).entity_id;
  const office = w.e.createEntity({ note: NOTE, kind: "office", label: "Harbourmaster" }).entity_id;
  assert.equal(w.e.setSector({ sector: "company", note: "n" }).reason, "NO_ENTITY");
  assert.equal(w.e.setSector({ entityId: "ENT-2026-0404", sector: "company", note: "n" }).reason, "NO_SUCH_ENTITY");
  assert.equal(w.e.setSector({ entityId: office, sector: "zzz", note: "" }).reason, "NOT_AN_ORGANISATION", "the kind before the value");
  assert.equal(w.e.setSector({ entityId: org, sector: "zzz", note: "" }).reason, "UNKNOWN_SECTOR", "the value before the note");
  assert.equal(w.e.setSector({ entityId: org, sector: "undetermined", note: "n" }).reason, "UNKNOWN_SECTOR");
  for (const note of [undefined, null, "", "  "]) assert.equal(w.e.setSector({ entityId: org, sector: "company", note }).reason, "NO_REASON");
  assert.equal(count(w, "entity_sectors"), 0);
  assert.equal(w.e.readEntity({ entityId: org }).entity.sector, "undetermined");
  const s1 = w.e.setSector({ entityId: org, sector: "nonprofit", note: "its filing says a public benefit trust", by: "member:ann" });
  assert.deepEqual([s1.ok, s1.sector, s1.prior, s1.by], [true, "nonprofit", "undetermined", "member:ann"]);
  const s2 = w.e.setSector({ entityId: org, sector: "company", note: "corrected: it is a company", by: MACHINE });
  assert.deepEqual([s2.prior, s2.by], ["nonprofit", MACHINE]);
  const again = w.e.setSector({ entityId: org, sector: "company", note: "again", by: "member:bo" });
  assert.deepEqual([again.ok, again.already], [true, true]);
  const ent = w.e.readEntity({ entityId: org }).entity;
  assert.equal(ent.sector, "company");
  assert.deepEqual(ent.sector_history.map((h) => [h.prior, h.sector, h.by, h.note]),
                   [["undetermined", "nonprofit", "member:ann", "its filing says a public benefit trust"],
                    ["nonprofit", "company", MACHINE, "corrected: it is a company"]]);
  assert.equal(ent.sector_history_truncated, false);
  assert.equal(count(w, "entity_sectors"), 2, "the repeat wrote nothing");
});

/* A person with the test profile's schemes, and a capture of a minute book that the record located on 2026-09-27. */
function people() {
  const w = world({ profiles: PE });
  const pat = w.e.createEntity({ note: NOTE, kind: "person", label: "Pat Quill" }).entity_id;
  const lee = w.e.createEntity({ note: NOTE, kind: "person", label: "Lee Quill" }).entity_id;
  const office = w.e.createEntity({ note: NOTE, kind: "office", label: "Harbourmaster" }).entity_id;
  return { ...w, pat, lee, office };
}

test("R43 addIdentifier refuses, in order and writing nothing, NO_ENTITY, NO_SUCH_ENTITY, UNKNOWN_SCHEME naming the schemes, SCHEME_NOT_FOR_KIND, IDENTIFIER_NOT_IN_SPACE, BAD_VALIDITY, NO_BASIS, then IDENTIFIER_TAKEN naming the holder", () => {
  const w = people();
  const ok = { entityId: w.pat, scheme: "marlow_bar", id: "bar 12345", basis: "the bar's published roll", by: "member:ann" };
  assert.equal(w.e.addIdentifier({ ...ok, entityId: "" }).reason, "NO_ENTITY");
  assert.equal(w.e.addIdentifier({ ...ok, entityId: "ENT-2026-0404", scheme: "nope" }).reason, "NO_SUCH_ENTITY");
  const us = w.e.addIdentifier({ ...ok, scheme: "nope", id: "?" });
  /* naming the active profiles' identifier_schemes, as jurisdictions' own combine gives them (its R52), never a list held here */
  const schemes = combine(PE).view.identifier_schemes.map((x) => x.scheme);
  assert.deepEqual([us.reason, us.schemes], ["UNKNOWN_SCHEME", schemes]);
  assert.ok(schemes.includes("ellery_person") && schemes.includes("marlow_bar"));
  assert.equal(w.e.addIdentifier({ ...ok, scheme: "proceeding" }).reason, "UNKNOWN_SCHEME", "the reserved scheme is held only through a proceeding's facet");
  assert.equal(world().e.addIdentifier({ ...ok, entityId: world().e.createEntity({ note: NOTE, kind: "person", label: "P" }).entity_id }).reason,
               "NO_SUCH_ENTITY", "(a fresh world's id is not this one's)");
  const nk = w.e.addIdentifier({ ...ok, entityId: w.office, id: "?" });
  assert.deepEqual([nk.reason, nk.kind, nk.entity_kinds], ["SCHEME_NOT_FOR_KIND", "office", ["person"]]);
  const ns = w.e.addIdentifier({ ...ok, id: "P123", valid: "bad", basis: "" });
  assert.deepEqual([ns.reason, ns.space, ns.forms], ["IDENTIFIER_NOT_IN_SPACE", "person", ["bar-number"]], "another scheme's form in the same space is not this scheme's");
  for (const valid of ["2026", [], { from: "2026-01-01" }, { from: null, to: null, precision: "week" },
                       { from: "2026-02-31", to: null, precision: "day", zone: "UTC" },
                       { from: { value: "2026-01-01", event: "EVT-2026-0001" }, to: null, precision: "day", zone: "UTC" },
                       { from: "2026-01-01", to: null, precision: "day", zone: "Mars/Olympus" }]) {
    const r = w.e.addIdentifier({ ...ok, valid, basis: "" });
    assert.equal(r.reason, "BAD_VALIDITY", JSON.stringify(valid));
  }
  for (const basis of [undefined, null, "", "  ", 7, {}, { system: "", row: "1" }]) {
    const r = w.e.addIdentifier({ ...ok, basis });
    assert.deepEqual([r.reason, r.code], ["NO_BASIS", "NO_BASIS"], JSON.stringify(basis));
  }
  assert.equal(count(w, "entity_identifiers"), 0, "nothing written by a refusal");
  const held = w.e.addIdentifier(ok);
  assert.deepEqual([held.ok, held.scheme, held.id, held.normal, held.form, held.by, held.basis], [true, "marlow_bar", "bar 12345", "BAR12345", "bar-number", "member:ann", "the bar's published roll"]);
  const rep = w.e.addIdentifier({ ...ok, id: "BAR12345", basis: "again" });
  assert.deepEqual([rep.ok, rep.already], [true, true], "a repeat on the same entity, by its normal form");
  const taken = w.e.addIdentifier({ ...ok, entityId: w.lee });
  assert.deepEqual([taken.reason, taken.holder, taken.normal], ["IDENTIFIER_TAKEN", w.pat, "BAR12345"]);
  assert.equal(count(w, "entity_identifiers"), 1);
});

test("R43 IDENTIFIER_TAKEN when another entity holds the scheme and normal form with a validity that overlaps or is unstated; validities apart may share it", () => {
  const w = people();
  const day = (from, to) => ({ from, to, precision: "day", zone: "America/Los_Angeles" });
  const base = { scheme: "ellery_person", id: "P001", basis: "the minute book's member list", by: "member:ann" };
  assert.equal(w.e.addIdentifier({ ...base, entityId: w.pat, valid: day("2020-01-01", "2022-12-31") }).ok, true);
  assert.equal(w.e.addIdentifier({ ...base, entityId: w.lee, valid: day("2022-06-01", null) }).reason, "IDENTIFIER_TAKEN", "overlaps");
  assert.equal(w.e.addIdentifier({ ...base, entityId: w.lee }).reason, "IDENTIFIER_TAKEN", "unstated on one side");
  assert.equal(w.e.addIdentifier({ ...base, entityId: w.lee, valid: day(null, "2021-01-01") }).reason, "IDENTIFIER_TAKEN", "an open start overlaps");
  assert.equal(w.e.addIdentifier({ ...base, entityId: w.lee, valid: day("2022-12-31", null) }).reason, "IDENTIFIER_TAKEN", "the same last day overlaps");
  const apart = w.e.addIdentifier({ ...base, entityId: w.lee, valid: day("2023-01-01", null) });
  assert.equal(apart.ok, true, "a number reissued after the first holder's validity ended");
  assert.deepEqual(apart.valid, day("2023-01-01", null));
  /* a withdrawn holding takes nothing */
  const zed = w.e.createEntity({ note: NOTE, kind: "person", label: "Zed" }).entity_id;
  assert.equal(w.e.addIdentifier({ ...base, id: "P777", entityId: w.pat }).ok, true);
  assert.equal(w.e.withdrawIdentifier({ entityId: w.pat, scheme: "ellery_person", id: "p777", reason: "a misreading", by: "member:ann" }).ok, true);
  assert.equal(w.e.addIdentifier({ ...base, id: "P777", entityId: zed }).ok, true);
});

test("R43 a machine holds an identifier only from a system rule: basis {system, row}, the system one that issues or lists the scheme (K1443), stamped as R4 says", () => {
  const w = people();
  const m = { entityId: w.pat, scheme: "ellery_person", id: "P002", by: "class:daemon" };
  for (const basis of ["the minute book", { system: "ellery.ledger", row: "7" }, { system: "ellery.minutes" }, null])
    assert.equal(w.e.addIdentifier({ ...m, basis }).reason, "NO_BASIS", JSON.stringify(basis));
  assert.match(w.e.addIdentifier({ ...m, basis: "x" }).detail, /system rule/);
  const ok = w.e.addIdentifier({ ...m, basis: { system: "ellery.minutes", row: "person/2" } });
  assert.deepEqual([ok.ok, ok.by, ok.basis], [true, "class:daemon", { system: "ellery.minutes", row: "person/2" }]);
  /* a scheme listing no system admits no machine */
  assert.equal(w.e.addIdentifier({ ...m, scheme: "marlow_bar", id: "BAR00001", basis: { system: "ellery.minutes", row: "1" } }).reason, "NO_BASIS");
  /* a member may cite a system's row too */
  assert.equal(w.e.addIdentifier({ entityId: w.lee, scheme: "marlow_bar", id: "BAR00001", basis: { system: "the bar", row: 9 }, by: "member:ann" }).ok, true);
});

test("R43 R44 withdrawIdentifier withdraws as R8 withdraws an alias; identifiersOf lists every identifier, withdrawn ones marked with who, when and why; readEntity carries them; neither read throws", () => {
  const w = people();
  w.e.addIdentifier({ entityId: w.pat, scheme: "marlow_bar", id: "BAR12345", basis: "the roll", by: "member:ann" });
  w.e.addIdentifier({ entityId: w.pat, scheme: "ellery_person", id: "P003", basis: "the minute book", by: "member:ann" });
  assert.equal(w.e.withdrawIdentifier({ scheme: "marlow_bar", id: "x", reason: "r" }).reason, "NO_ENTITY");
  assert.equal(w.e.withdrawIdentifier({ entityId: w.pat, scheme: "marlow_bar", id: "BAR12345" }).reason, "NO_REASON");
  assert.equal(w.e.withdrawIdentifier({ entityId: w.pat, scheme: "marlow_bar", id: "BAR99999", reason: "r" }).reason, "NO_SUCH_IDENTIFIER");
  assert.equal(w.e.withdrawIdentifier({ entityId: w.lee, scheme: "marlow_bar", id: "BAR12345", reason: "r" }).reason, "NO_SUCH_IDENTIFIER");
  const wd = w.e.withdrawIdentifier({ entityId: w.pat, scheme: "marlow_bar", id: " bar12345 ", reason: "another Pat Quill", by: "member:bo" });
  assert.deepEqual([wd.ok, wd.identifier.withdrawn.by, wd.identifier.withdrawn.reason], [true, "member:bo", "another Pat Quill"]);
  const again = w.e.withdrawIdentifier({ entityId: w.pat, scheme: "marlow_bar", id: "BAR12345", reason: "x", by: MACHINE });
  assert.deepEqual([again.already, again.identifier.withdrawn.by], [true, "member:bo"]);
  assert.equal(count(w, "entity_identifiers"), 2, "nothing deleted");
  const list = w.e.identifiersOf(w.pat);
  assert.deepEqual([list.ok, list.truncated, list.limit], [true, false, 500]);
  assert.deepEqual(list.identifiers.map((i) => [i.scheme, i.normal, i.by, !!i.at, i.withdrawn && i.withdrawn.reason]).sort(),
                   [["ellery_person", "P003", "member:ann", true, null], ["marlow_bar", "BAR12345", "member:ann", true, "another Pat Quill"]]);
  assert.deepEqual(w.e.readEntity({ entityId: w.pat }).entity.identifiers, list.identifiers);
  assert.equal(w.e.readEntity({ entityId: w.pat }).entity.identifiers_truncated, false);
  assert.equal(w.e.identifiersOf("").reason, "NO_ENTITY");
  assert.deepEqual(w.e.identifiersOf("ENT-2026-0404").identifiers, []);
  for (const bad of [undefined, null, 7, {}]) assert.doesNotThrow(() => w.e.identifiersOf(bad));
  /* the withdrawn one matches nothing new (R44) */
  assert.equal(w.e.entityByIdentifier({ scheme: "marlow_bar", id: "BAR12345" }), null);
});

test("R44 entityByIdentifier answers the one entity holding the scheme identifier in its normal form, valid at `at` when given (civil-time.validAt, undetermined answered as such), or null; never throws", () => {
  const w = people();
  const day = (from, to) => ({ from, to, precision: "day", zone: "America/Los_Angeles" });
  const base = { scheme: "ellery_person", id: "P010", basis: "the minute book", by: "member:ann" };
  w.e.addIdentifier({ ...base, entityId: w.pat, valid: day("2020-01-01", "2022-12-31") });
  w.e.addIdentifier({ ...base, entityId: w.lee, valid: day("2023-01-01", null) });
  w.e.addIdentifier({ ...base, id: "P011", entityId: w.lee });
  const at = (d) => w.e.entityByIdentifier({ scheme: "ellery_person", id: "p010", at: { value: d, precision: "day", zone: "America/Los_Angeles" } });
  const in21 = at("2021-05-05");
  assert.deepEqual([in21.entity_id, in21.kind, in21.label, in21.normal, in21.undetermined], [w.pat, "person", "Pat Quill", "P010", undefined]);
  const in25 = at("2025-05-05");
  assert.deepEqual([in25.entity_id, in25.undetermined, typeof in25.why.key], [w.lee, true, "string"], "no end is stated: undetermined, answered as such");
  assert.match(reasonText(in25.why), /no end is stated/);
  assert.equal(at("2019-05-05"), null, "out for both");
  const none = w.e.entityByIdentifier({ scheme: "ellery_person", id: "P010" });
  assert.deepEqual([none.undetermined, none.candidates], [true, [w.pat, w.lee].sort()], "two holders and no date: not settled here");
  assert.equal(w.e.entityByIdentifier({ scheme: "ellery_person", id: "P011" }).entity_id, w.lee);
  for (const q of [{}, { scheme: "nope", id: "P010" }, { scheme: "ellery_person", id: "zzz" }, { scheme: "ellery_person", id: "P999" },
                   { scheme: "ellery_person", id: "P011", at: "not a date" }, null, undefined]) {
    assert.doesNotThrow(() => w.e.entityByIdentifier(q ?? undefined));
  }
  assert.equal(w.e.entityByIdentifier({ scheme: "ellery_person", id: "P999" }), null);
  assert.equal(w.e.entityByIdentifier({ scheme: "ellery_person", id: "P011", at: "not a date" }).entity_id, w.lee, "no validity stated: in, whatever the date");
  w.e.addIdentifier({ ...base, id: "P012", entityId: w.pat, valid: day("2020-01-01", null) });
  assert.equal(w.e.entityByIdentifier({ scheme: "ellery_person", id: "P012", at: "not a date" }).undetermined, true, "a stated validity on an unreadable date");
});

test("R9 the identifier tier: a reference or its key recognised in a scheme's space equal to an identifier an entity holds, not out at the capture's retrieval instant, resolves at A, the basis naming the scheme and the method the tier; an alias fold of the reference is still A; the cascade stops there", () => {
  const w = people();
  const day = (from, to) => ({ from, to, precision: "day", zone: "America/Los_Angeles" });
  w.e.addIdentifier({ entityId: w.pat, scheme: "marlow_bar", id: "BAR12345", basis: "the roll", by: "member:ann" });
  w.e.addIdentifier({ entityId: w.lee, scheme: "ellery_person", id: "P020", valid: day("2027-01-01", null), basis: "b", by: "member:ann" });
  w.e.addIdentifier({ entityId: w.lee, scheme: "ellery_person", id: "P021", valid: day("2026-01-01", "2026-12-31"), basis: "b", by: "member:ann" });
  w.e.addIdentifier({ entityId: w.lee, scheme: "ellery_person", id: "P022", valid: day("2025-01-01", "2025-12-31"), basis: "b", by: "member:ann" });
  w.e.addIdentifier({ entityId: w.lee, scheme: "ellery_person", id: "P023", valid: day("2026-01-01", null), basis: "b", by: "member:ann" });
  w.e.addIdentifier({ entityId: w.lee, scheme: "ellery_person", id: "P024", basis: "b", by: "member:ann" });
  w.e.withdrawIdentifier({ entityId: w.lee, scheme: "ellery_person", id: "P024", reason: "wrong", by: "member:ann" });
  const other = w.e.createEntity({ note: NOTE, kind: "office", label: "Quill" }).entity_id;
  w.read("INFO-1", sha("r9id"), [
    { kind: "person", key: "bar 12345", label: "Quill" },  /* the key's normal form: A on Pat; the label's C on `other` is never minted */
    { kind: "person", key: "P020", label: "x" },           /* valid only from 2027: out at retrieval, unresolved */
    { kind: "person", key: "P021", label: "x" },           /* in */
    { kind: "person", key: "P022", label: "x" },           /* ended 2025: out */
    { kind: "person", key: "P023", label: "x" },           /* no end stated: undetermined, still matched */
    { kind: "person", key: "P024", label: "x" },           /* withdrawn: nothing */
    { kind: "person", key: "P099", label: "x" },           /* in the space, held by none */
  ]);
  w.held("INFO-1", sha("r9id"), [MIN]);
  const r = w.e.resolve({ captureSha: sha("r9id"), resolvedBy: MACHINE });
  const got = r.resolved.map((m) => [m.ref, m.entity_id, m.grade]).sort();
  assert.deepEqual(got, [["person:P021", w.lee, "A"], ["person:P023", w.lee, "A"], ["person:bar 12345", w.pat, "A"]].sort());
  assert.ok(!got.some(([, id]) => id === other), "the A suppresses the C on another entity");
  const pat = r.resolved.find((m) => m.entity_id === w.pat);
  assert.equal(pat.basis, "marlow_bar BAR12345", "the basis names the scheme");
  assert.match(pat.method, /^scheme identifier -- /);
  assert.match(pat.method, /marlow_bar/);
  assert.equal(pat.established, true);
  assert.match(r.resolved.find((m) => m.ref === "person:P023").method, /undetermined \(.*no end is stated/);
  assert.match(r.resolved.find((m) => m.ref === "person:P021").method, /valid when the document was retrieved/);
  assert.deepEqual(r.unresolved.map((u) => u.ref).sort(), ["person:P020", "person:P022", "person:P024", "person:P099"]);
  /* an alias fold of the reference is A as before, and both tiers' entities resolve together */
  w.e.addAlias({ entityId: other, alias: "person:bar 12345" });
  const both = w.e.resolve({ captureSha: sha("r9id"), ref: "person:bar 12345" });
  assert.deepEqual(both.resolved.map((m) => [m.entity_id, m.grade]).sort(), [[w.pat, "A"], [other, "A"]].sort());
  assert.match(both.resolved.find((m) => m.entity_id === other).method, /composite key/);
  /* with no retrieval instant held, a stated validity cannot be judged out, and the method says so */
  w.read("INFO-2", sha("r9noinst"), [{ kind: "person", key: "P020", label: "x" }]);
  const ni = w.e.resolve({ captureSha: sha("r9noinst") });
  assert.deepEqual(ni.resolved.map((m) => [m.entity_id, m.grade]), [[w.lee, "A"]]);
  assert.match(ni.resolved[0].method, /retrieval instant is not held/);
  /* the name lookup's grade_if_resolved is the recogniser's (R17) */
  const look = w.e.namingDocuments({ entityId: w.lee, viewer: MACHINE });
  assert.ok(look.documents.every((d) => d.grade_if_resolved === null || typeof d.grade_if_resolved === "string"));
});

/* A forum, the test profile's proceeding kinds and its `proceeding` space. */
function courts() {
  const w = world({ profiles: PE });
  const court = w.e.createEntity({ note: NOTE, kind: "institution", label: "Marlow County Court", sector: "government" }).entity_id;
  const board = w.e.createEntity({ note: NOTE, kind: "body", label: "Harbour Commission", sector: "government" }).entity_id;
  return { ...w, court, board };
}

test("R45 a proceeding is created with its facet: a missing field PROCEEDING_FACET_MISSING naming it, the forum NO_SUCH_ENTITY naming forum, PROCEEDING_KIND_UNKNOWN, IDENTIFIER_NOT_IN_SPACE, a second of the same forum and number IDENTIFIER_TAKEN; each before anything is allocated", () => {
  const w = courts();
  const ok = { kind: "proceeding", note: "the suit over the harbour bond", declaredBy: "member:ann",
               proceeding: { forum: w.court, kind: "commitment_suit", number: "MC-26-0001" } };
  const seq = () => w.rows(`SELECT next FROM seq WHERE scope='ENT-2026'`)[0].next;
  const before = [count(w, "entities"), count(w, "entity_identifiers"), count(w, "entity_proceedings"), seq()];
  for (const [facet, field] of [[undefined, "forum"], [{}, "forum"], [{ forum: w.court }, "kind"],
                                [{ forum: w.court, kind: "commitment_suit" }, "number"], [{ forum: " ", kind: "x", number: "1" }, "forum"]]) {
    const r = w.e.createEntity({ ...ok, proceeding: facet });
    assert.deepEqual([r.reason, r.field], ["PROCEEDING_FACET_MISSING", field], JSON.stringify(facet));
  }
  const nf = w.e.createEntity({ ...ok, proceeding: { ...ok.proceeding, forum: "ENT-2026-0404", kind: "nope" } });
  assert.deepEqual([nf.reason, nf.field, nf.entity_id], ["NO_SUCH_ENTITY", "forum", "ENT-2026-0404"]);
  const nk = w.e.createEntity({ ...ok, proceeding: { ...ok.proceeding, kind: "nope", number: "zzz" } });
  assert.deepEqual([nk.reason, nk.kinds], ["PROCEEDING_KIND_UNKNOWN", ["commitment_suit", "harbour_inquiry"]]);
  const ns = w.e.createEntity({ ...ok, proceeding: { ...ok.proceeding, number: "MC-2026-1" } });
  assert.deepEqual([ns.reason, ns.space, ns.field, ns.forms], ["IDENTIFIER_NOT_IN_SPACE", "proceeding", "number", ["MC-yy-####", "UB/yyyy/##", "docket-####"]]);
  assert.equal(w.e.createEntity({ ...ok, note: " " }).reason, "ENTITY_NO_NOTE", "the note is still required");
  assert.deepEqual([count(w, "entities"), count(w, "entity_identifiers"), count(w, "entity_proceedings"), seq()], before, "nothing allocated or written");
  const p = w.e.createEntity({ ...ok, label: "Ellery v. Harbour Trust", aliases: ["the bond suit"] });
  assert.equal(p.ok, true);
  assert.equal(p.label, "Marlow County Court, MC-26-0001, suit on a budget commitment", "the forum's label, the number, the kind: never the caption");
  assert.deepEqual(p.proceeding, { forum: w.court, forum_kind: "court", number: "MC-26-0001", kind: "commitment_suit" });
  const taken = w.e.createEntity({ ...ok, proceeding: { ...ok.proceeding, number: "mc-26-0001" } });
  assert.deepEqual([taken.reason, taken.holder], ["IDENTIFIER_TAKEN", p.entity_id]);
  const elsewhere = w.e.createEntity({ ...ok, proceeding: { forum: w.board, kind: "harbour_inquiry", number: "MC-26-0001" } });
  assert.equal(elsewhere.ok, true, "the same number at another forum is another proceeding");
  assert.equal(elsewhere.proceeding.forum_kind, "commission");
  /* the facet is read back; the number is an alias and an identifier; the caller's label and the caption are aliases */
  const ent = w.e.readEntity({ entityId: p.entity_id }).entity;
  assert.deepEqual(ent.proceeding, { forum: w.court, forum_kind: "court", number: "MC-26-0001", kind: "commitment_suit", basis: null });
  assert.deepEqual(w.e.proceedingOf(p.entity_id), ent.proceeding);
  assert.deepEqual(ent.aliases.map((a) => [a.alias, a.canonical]).sort(),
    [["Ellery v. Harbour Trust", false], ["MC-26-0001", false], ["Marlow County Court, MC-26-0001, suit on a budget commitment", true], ["the bond suit", false]].sort());
  assert.deepEqual(ent.identifiers.map((i) => [i.scheme, i.forum, i.space, i.normal]), [["proceeding", w.court, "proceeding", "MC-26-0001"]]);
  assert.equal(w.e.proceedingOf(w.court), null, "null for any other kind");
  for (const x of [null, undefined, "", "ENT-2026-0404", 7]) assert.equal(w.e.proceedingOf(x), null);
  assert.equal(w.e.readEntity({ entityId: w.court }).entity.proceeding, null);
  /* a caption may be added as an alias after (K1452) */
  assert.equal(w.e.addAlias({ entityId: p.entity_id, alias: "In re the Harbour Bond" }).ok, true);
  /* a capture carrying the number resolves at grade A to every proceeding holding it */
  w.read("INFO-1", sha("docket"), [{ kind: "case", key: "mc-26-0001", label: "Ellery v. Harbour Trust" }]);
  const r = w.e.resolve({ captureSha: sha("docket") });
  assert.deepEqual(r.resolved.map((m) => [m.entity_id, m.grade]).sort(), [[p.entity_id, "A"], [elsewhere.entity_id, "A"]].sort());
  assert.equal(w.e.entityByIdentifier({ scheme: "proceeding", id: "mc-26-0001" }).undetermined, true, "two forums hold it");
});

test("R46 registerProceeding registers from a captured passage, attributed to whoever is stamped (a machine as class:<cls>) and shown for review, the passage its basis; refuses as R45 and NO_SUCH_REFERENCE for a capture not held or not visible; a forum already holding the number answers existed, adding the caption when new", () => {
  const w = courts();
  const cap = w.held("INFO-1", sha("register-row"), [MIN]);
  const base = { captureSha: cap, extent: { kind: "pdf-page", page: 2 }, forum: w.court, number: "MC-26-0042", kind: "commitment_suit",
                 caption: "Ellery v. Quill", declaredBy: "class:daemon" };
  assert.equal(w.e.registerProceeding({ ...base, captureSha: "" }).reason, "NO_SHA");
  const ue = w.e.registerProceeding({ ...base, extent: { kind: "nope" } });
  assert.deepEqual([ue.ok, ue.reason, ue.code], [false, "CONTENT_EXTENT_UNREADABLE", "CONTENT_EXTENT_UNREADABLE"], "content's extent grammar");
  assert.equal(w.e.registerProceeding({ ...base, extent: undefined }).reason, "CONTENT_EXTENT_UNREADABLE");
  assert.deepEqual([w.e.registerProceeding({ ...base, number: "" }).reason, w.e.registerProceeding({ ...base, number: "" }).field], ["PROCEEDING_FACET_MISSING", "number"]);
  assert.equal(w.e.registerProceeding({ ...base, captureSha: sha("never") }).reason, "NO_SUCH_REFERENCE");
  w.project("PROJ-2026-0001-x", "insider");
  const hid = w.held("PROJ-2026-0001-x", sha("hidden-row"), []);
  assert.equal(w.e.registerProceeding({ ...base, captureSha: hid, declaredBy: "member:outsider" }).reason, "NO_SUCH_REFERENCE", "an invisible capture answers as an absent one");
  assert.equal(w.e.registerProceeding({ ...base, captureSha: hid, viewer: "member:outsider" }).reason, "NO_SUCH_REFERENCE");
  assert.equal(w.e.registerProceeding({ ...base, forum: "ENT-2026-0404" }).reason, "NO_SUCH_ENTITY");
  assert.equal(w.e.registerProceeding({ ...base, kind: "nope" }).reason, "PROCEEDING_KIND_UNKNOWN");
  assert.equal(w.e.registerProceeding({ ...base, number: "42" }).reason, "IDENTIFIER_NOT_IN_SPACE");
  assert.equal(count(w, "entity_proceedings"), 0);
  const r = w.e.registerProceeding(base);
  assert.deepEqual([r.ok, r.existed, r.kind, r.label], [true, false, "proceeding", "Marlow County Court, MC-26-0042, suit on a budget commitment"]);
  assert.deepEqual(r.basis, { capture_sha: cap, extent: { kind: "pdf-page", page: 2, rect: null } });
  const ent = w.e.readEntity({ entityId: r.entity_id }).entity;
  assert.equal(ent.declared_by, "class:daemon", "attributed to the machine, named as one (DEC-52)");
  assert.equal(ent.note, word("entities.clean_label.registered_captured_document", { sha: cap, extent: "page 3", number: "MC-26-0042" }));
  assert.deepEqual(ent.proceeding.basis, { capture_sha: cap, extent: { kind: "pdf-page", page: 2, rect: null } });
  assert.deepEqual(ent.identifiers[0].basis, { capture_sha: cap, extent: { kind: "pdf-page", page: 2, rect: null } });
  assert.ok(ent.aliases.some((a) => a.alias === "Ellery v. Quill" && a.declared_by === "class:daemon"), "the caption is an alias");
  /* the same forum and number again: that entity, existed; a new caption added, a known one not twice */
  const again = w.e.registerProceeding({ ...base, number: "mc-26-0042", caption: "Ellery v. Quill" });
  assert.deepEqual([again.ok, again.existed, again.entity_id, again.caption_added], [true, true, r.entity_id, false]);
  const cap2 = w.e.registerProceeding({ ...base, caption: "Port Ellery v. P. Quill" });
  assert.deepEqual([cap2.existed, cap2.caption_added], [true, true]);
  assert.equal(count(w, "entity_proceedings"), 1);
  assert.ok(w.e.readEntity({ entityId: r.entity_id }).entity.aliases.some((a) => a.alias === "Port Ellery v. P. Quill"));
  /* a member registering is attributed to the member; a visible capture in a project the member joined */
  const mine = w.e.registerProceeding({ ...base, captureSha: hid, number: "MC-26-0043", declaredBy: "member:insider" });
  assert.deepEqual([mine.ok, w.e.readEntity({ entityId: mine.entity_id }).entity.declared_by], [true, "member:insider"]);
});

/* Relations around one subject: two live, one withdrawn. */
function related() {
  const w = world({ profiles: PE });
  const mk = (label) => w.e.createEntity({ note: NOTE, kind: "body", label }).entity_id;
  const [a, b, c, d] = ["Social Services", "Treatment Program", "Health Board", "Old Board"].map(mk);
  const r1 = w.e.declareRelation({ relation: "member_of", fromEntity: b, toEntity: a, justification: "the program sits in the department", citation: "the budget book, p. 4", declaredBy: "member:ann" }).relation_id;
  const r2 = w.e.declareRelation({ relation: "overlaps", fromEntity: a, toEntity: c, justification: "shared staff", citation: "the org chart" }).relation_id;
  const r3 = w.e.declareRelation({ relation: "proxy_for", fromEntity: d, toEntity: a, justification: "j", citation: "c" }).relation_id;
  w.e.withdrawRelation({ relationId: r3, reason: "mistaken", withdrawnBy: "member:ann" });
  return { ...w, a, b, c, d, r1, r2, r3 };
}
const AT = "2026-09-27T00:00:00Z";

test("R47 the module registers once at load as the connection owner of its three declared kinds, class declared, each with its word", () => {
  assert.deepEqual(OWNER_REGISTRATION, { ok: true, owner: "entities" });
  assert.deepEqual(CONNECTION_KINDS.map((k) => [k.kind, k.class]), [["proxy_for", "declared"], ["member_of", "declared"], ["overlaps", "declared"]]);
  for (const k of CONNECTION_KINDS) {
    assert.deepEqual(kindOf(k.kind), { owner: "entities", word: k.word, class: "declared" });
    assert.ok(k.word.trim(), k.kind);
  }
});

test("R47 neighbours answers the relations, not withdrawn, with the node at one end, in connection-grammar's shape: evidence the citation as declared, the lowest grade, labelled declared-not-evidenced, valid unstated and so marked undetermined; group-wide sight, a missing viewer refused; it writes nothing", () => {
  const w = related();
  const before = JSON.stringify(w.rows(`SELECT * FROM entity_relations`));
  for (const viewer of [undefined, null, ""]) assert.equal(w.e.neighbours({ node: w.a, at: AT, viewer }).refused, "VIEWER_MISSING");
  const all = w.e.neighbours({ node: w.a, at: AT, viewer: "member:ann", scope: null });
  assert.deepEqual(all.items.map((i) => i.id), [w.r1, w.r2], "the withdrawn relation is not walked");
  for (const i of all.items) {
    assert.deepEqual(checkConnection(i), { ok: true }, i.id);
    assert.equal(i.owner, "entities");
    assert.equal(i.label, DECLARED_LABEL);
    assert.deepEqual(i.grade, { assertion: LOWEST_GRADE, ends: [LOWEST_GRADE, LOWEST_GRADE] });
    assert.deepEqual([i.valid.from, i.valid.to], [null, null], "a relation holds no dates");
    assert.ok(typeof i.undetermined.why === "string" || typeof i.undetermined.why.key === "string", "a string, or a keyed reason");
    assert.equal(i.derived, null);
  }
  const m = all.items.find((i) => i.id === w.r1);
  assert.deepEqual([m.from, m.to, m.kind, m.evidence, m.declared_by], [w.b, w.a, "member_of",
    [{ source: "the budget book, p. 4", justification: "the program sits in the department" }], "member:ann"]);
  /* from either end */
  assert.deepEqual(w.e.neighbours({ node: w.b, at: AT, viewer: "member:ann" }).items.map((i) => i.id), [w.r1]);
  assert.deepEqual(w.e.neighbours({ node: w.c, at: AT, viewer: "member:ann" }).items.map((i) => i.id), [w.r2]);
  /* kinds */
  assert.deepEqual(w.e.neighbours({ node: w.a, kinds: ["overlaps"], at: AT, viewer: "member:ann" }).items.map((i) => i.id), [w.r2]);
  assert.deepEqual(w.e.neighbours({ node: w.a, kinds: ["employed_by"], at: AT, viewer: "member:ann" }).items, []);
  /* sight: every member viewer the same set (the registry is group-wide, C6, K1489), a machine too; an unrecognised viewer none */
  for (const viewer of ["member:bo", "member:outsider", MACHINE, "admin"])
    assert.deepEqual(w.e.neighbours({ node: w.a, at: AT, viewer }).items.map((i) => i.id), [w.r1, w.r2], viewer);
  assert.deepEqual(w.e.neighbours({ node: w.a, at: AT, viewer: "somebody" }).items, []);
  /* scope changes nothing for a declared kind (connection-grammar R8) */
  assert.deepEqual(w.e.neighbours({ node: w.a, at: AT, viewer: "member:ann", scope: "INQ-2026-0001" }), all);
  /* an unknown node, and an undated read, answer in shape */
  assert.deepEqual(w.e.neighbours({ node: "ENT-2026-0404", at: AT, viewer: "member:ann" }).items, []);
  assert.ok(w.e.neighbours({ node: w.a, viewer: "member:ann" }).items.every((i) => i.undetermined));
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM entity_relations`)), before, "writes nothing");
  /* through the plane's default registry, which judges every answer at the interface (K1563 (1)): with none open and
     no host, refused; the host the registry passes through, else the isolate's one instance; two open and no host,
     refused OWNER_HOST_AMBIGUOUS, never a guess */
  const q = { owner: "entities", node: w.a, at: AT, viewer: "member:ann", scope: null };
  assert.equal(registryNeighbours(q).refused, "OWNER_HOST_AMBIGUOUS", "none open in this process yet");
  const host = { storage: w.st };
  entitiesOf(host, { record: w.record, membership: w.membership, provenance: w.prov });
  assert.deepEqual(registryNeighbours({ ...q, host }), all, "conforming: the registry passes the answer whole");
  assert.deepEqual(registryNeighbours(q), all, "the isolate's one instance");
  assert.equal(registryNeighbours({ owner: "entities", node: w.a, at: AT, scope: null }).refused, "VIEWER_MISSING");
  const w2 = related();
  const host2 = { storage: w2.st };
  entitiesOf(host2, { record: w2.record, membership: w2.membership, provenance: w2.prov });
  const amb = registryNeighbours(q);
  assert.equal(amb.refused, "OWNER_HOST_AMBIGUOUS");
  assert.match(amb.why, new RegExp(word("entities.symbol.text")));
  assert.deepEqual(registryNeighbours({ ...q, host }), all, "a named host is answered from its own instance");
  assert.deepEqual(registryNeighbours({ ...q, node: w2.a, host: host2 }).items.map((i) => i.id), [w2.r1, w2.r2]);
});

test("R47 R9 (N560, T34-16) connection-grammar's owner-conformance battery runs over this owner, which declares its kinds undated and group-wide: the answer is ok whole, no failure, the at and sight checks answered inapplicable, the missing viewer still checked", () => {
  const w = related();
  assert.deepEqual(CONNECTION_DECLARES, { undated: true, group_wide: true });
  assert.ok(Object.isFrozen(CONNECTION_DECLARES));
  const hub = w.e.createEntity({ note: NOTE, kind: "body", label: "Hub" }).entity_id;
  for (let i = 0; i <= BOUNDS.hub; i++) {
    const x = w.e.createEntity({ note: NOTE, kind: "body", label: `Spoke ${i}` }).entity_id;
    w.e.declareRelation({ relation: "overlaps", fromEntity: hub, toEntity: x, justification: "j", citation: "c" });
  }
  /* an undated, group-wide fixture names no in, out, undetermined or fenced item (connection-grammar R9) */
  const fixture = { node: w.a, at: AT, viewers: { sees: "member:ann", blind: "member:bo" }, expected: [w.r1, w.r2],
                    hub: { node: hub, at: AT } };
  const run = (declares) => ownerConformance({ owner: "entities", kinds: CONNECTION_KINDS.map((k) => ({ ...k })),
                                               neighbours: (a) => w.e.neighbours(a), fixture, declares });
  const r = run({ ...CONNECTION_DECLARES });
  assert.deepEqual([r.ok, r.failures], [true, []], JSON.stringify(r.failures));
  assert.deepEqual(r.inapplicable.map((x) => x.check), ["at", "sight"]);
  for (const x of r.inapplicable) assert.match(x.why, /^entities declares/);
  /* negative controls: without the declaration the two checks fail and nothing else does; a declaration the owner's
     answers belie is caught (an undated owner's item stating a date; a group-wide owner's other viewer short an item) */
  const bare = run(undefined);
  assert.equal(bare.ok, false);
  assert.deepEqual([...new Set(bare.failures.map((f) => f.check))].sort(), ["at", "sight"], JSON.stringify(bare.failures));
  assert.equal("inapplicable" in bare, false);
  const dated = ownerConformance({ owner: "entities", kinds: CONNECTION_KINDS.map((k) => ({ ...k })), fixture, declares: CONNECTION_DECLARES,
    neighbours: (a) => { const n = w.e.neighbours(a); return n.items ? { ...n, items: n.items.map((i) => ({ ...i, valid: { ...i.valid, from: "2020-01-01" } })) } : n; } });
  assert.ok(dated.failures.some((f) => f.check === "declares" && /states a valid bound/.test(f.why)), JSON.stringify(dated.failures));
  const fenced = ownerConformance({ owner: "entities", kinds: CONNECTION_KINDS.map((k) => ({ ...k })), fixture, declares: CONNECTION_DECLARES,
    neighbours: (a) => { const n = w.e.neighbours(a); return a.viewer === "member:bo" && n.items ? { ...n, items: n.items.filter((i) => i.id !== w.r2) } : n; } });
  assert.ok(fenced.failures.some((f) => f.check === "declares" && /not the complete set/.test(f.why)), JSON.stringify(fenced.failures));
  /* R6 and R7 directly (K1563 (2)): a relation holds no dates and is marked undetermined at every date; the registry is
     the group's, every member viewer the same set; a missing viewer refused */
  for (const at of [AT, "1900-01-01T00:00:00Z", null]) {
    const got = w.e.neighbours({ node: w.a, at, viewer: "member:ann" }).items;
    assert.deepEqual(got.map((i) => i.id), [w.r1, w.r2], String(at));
    assert.ok(got.every((i) => i.valid.from === null && i.valid.to === null
      && (typeof i.undetermined.why === "string" || typeof i.undetermined.why.key === "string")), String(at));
  }
  for (const viewer of ["member:ann", "member:bo", "member:outsider"])
    assert.deepEqual(w.e.neighbours({ node: w.a, at: AT, viewer }).items.map((i) => i.id), [w.r1, w.r2], viewer);
  assert.equal(w.e.neighbours({ node: w.a, at: AT }).refused, "VIEWER_MISSING");
});

test("R48 both ends are indexed: one indexed read per end, at most the fan-out per page with next continuing in relation-id order; a node over the hub bound is named hub with no items", () => {
  const w = related();
  const plan = w.rows(`EXPLAIN QUERY PLAN SELECT * FROM entity_relations WHERE to_entity=? AND withdrawn_at IS NULL AND relation_id > ? ORDER BY relation_id`, w.a, "")
    .map((r) => r.detail).join(" ");
  assert.match(plan, /entity_relations_to(_id)?/);
  const planFrom = w.rows(`EXPLAIN QUERY PLAN SELECT * FROM entity_relations WHERE from_entity=? AND withdrawn_at IS NULL AND relation_id > ? ORDER BY relation_id`, w.a, "")
    .map((r) => r.detail).join(" ");
  assert.match(planFrom, /entity_relations_from(_id)?/);
  /* a page that continues from an id answers the rest, in order */
  const rest = w.e.neighbours({ node: w.a, at: AT, viewer: "member:ann", page: { after: w.r1 } });
  assert.deepEqual(rest.items.map((i) => i.id), [w.r2]);
  assert.equal(rest.next, undefined);
  /* the hub: more than BOUNDS.hub live relations */
  const hub = w.e.createEntity({ note: NOTE, kind: "body", label: "Hub" }).entity_id;
  for (let i = 0; i < BOUNDS.hub; i++) {
    const x = w.e.createEntity({ note: NOTE, kind: "body", label: `Member ${i}` }).entity_id;
    w.e.declareRelation({ relation: "member_of", fromEntity: x, toEntity: hub, justification: "j", citation: "c" });
  }
  const full = w.e.neighbours({ node: hub, at: AT, viewer: "member:ann" });
  assert.equal(full.items.length, BOUNDS.hub, "exactly the bound: answered whole, on one page");
  assert.equal(full.hub, undefined);
  assert.equal(full.next, undefined);
  const x = w.e.createEntity({ note: NOTE, kind: "body", label: "One More" }).entity_id;
  const extra = w.e.declareRelation({ relation: "overlaps", fromEntity: hub, toEntity: x, justification: "j", citation: "c" }).relation_id;
  const h = w.e.neighbours({ node: hub, at: AT, viewer: "member:ann" });
  assert.deepEqual([h.items, h.hub.set_size], [[], BOUNDS.hub + 1]);
  assert.equal(h.hub.why, word("entities.why.subject_end_declared", { size: BOUNDS.hub + 1, hub: BOUNDS.hub }));
  /* asking one kind counts that kind's set only; a withdrawal takes it back under the bound */
  assert.equal(w.e.neighbours({ node: hub, kinds: ["overlaps"], at: AT, viewer: "member:ann" }).items.length, 1);
  w.e.withdrawRelation({ relationId: extra, reason: "r" });
  assert.equal(w.e.neighbours({ node: hub, at: AT, viewer: "member:ann" }).items.length, BOUNDS.hub);
  /* an unrecognised viewer learns nothing of the hub */
  assert.deepEqual(w.e.neighbours({ node: hub, at: AT, viewer: "somebody" }), { items: [] });
});

test("R26 a declared relation is walked only as a declared hop at the lowest grade, never resolving a reference, never answering concerns, carrying no grade of its own", () => {
  const w = related();
  w.read("INFO-1", sha("r26b"), [{ kind: "x", key: "1", label: "Treatment Program" }]);
  assert.deepEqual(w.e.resolve({ captureSha: sha("r26b") }).resolved.map((m) => m.entity_id), [w.b], "the program, never its department");
  assert.equal(w.e.concerns({ entityId: w.a, viewer: MACHINE }).count, 0);
  assert.equal("grade" in w.e.readRelation({ relationId: w.r1 }).relation, false);
  const hop = w.e.neighbours({ node: w.a, at: AT, viewer: "member:ann" }).items.find((i) => i.id === w.r1);
  assert.deepEqual([hop.label, hop.grade.assertion], [DECLARED_LABEL, LOWEST_GRADE]);
});

test("R49 every table is declared explicitly through record-core.declareTable: the registry whole-store only, sight group, export yes; resolutions and their reports keyed to their bundle with the default form's classes", () => {
  const w = world();
  const mine = w.record.declaredTables().filter((d) => d.module === "entities");
  assert.deepEqual(mine.map((d) => d.name).sort(), [...ENTITIES_TABLES].sort());
  const by = Object.fromEntries(mine.map((d) => [d.name, d]));
  for (const t of ["entities", "entity_aliases", "entity_relations", "entity_identifiers", "entity_proceedings", "entity_sectors"])
    assert.deepEqual([by[t].keys, by[t].purge, by[t].expunge, by[t].export, by[t].sight, by[t].derive, by[t].version_chain],
                     [[], "clear", "none", "yes", "group", "stored", t === "entity_sectors"], t);
  for (const t of ["resolutions", "resolution_defects"])
    assert.deepEqual([by[t].keys, by[t].purge, by[t].expunge, by[t].export, by[t].sight, by[t].derive, by[t].version_chain],
                     [undefined, "clear", "none", "admin-only", "bundle", "stored", false], t);
  assert.deepEqual(TABLE_DECLARATIONS.map((d) => d.name).sort(), [...ENTITIES_TABLES].sort());
  assert.deepEqual(w.e.declareTables(), { ok: true, already: true }, "once per instance");
});
