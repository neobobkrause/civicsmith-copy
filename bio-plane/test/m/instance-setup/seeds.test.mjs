/* The bridge and the seats (R50–R52; K1682's readings 1–4, K1683) at the module's interface: the module over the real
   record-core, an injected profile view (the held profiles carry none of T33's seeding data until N613), the registry
   stand-in coded to `entities` and `lines` (fixture), and Legistar captures read by the real `legistar-reader`. One test
   runs the real `entities` and `lines` over the real held profile. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { boot, frame, registryOver, providers, storage, applyRecordSchema } from "./fixture.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { InstanceSetup } from "../../../src/setup.mjs";
import { get as heldProfile, list as heldList } from "../../../../jurisdictions/index.mjs";
import { INSTANCE_SETUP_CHECKS, LEGISTAR_SCHEMES, SEED_MACHINE } from "../../../src/setup.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { BASIS as LEGISTAR_BASIS } from "../../../../legistar-reader/index.mjs";

const PID = "t-seeding";
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = clone(heldProfile("test-port-ellery"));
const SCHEMES = [
  { scheme: "ellery_office", label: "office number", entity_kinds: ["office"], space: "office", form: "t-office", systems: ["ellery.profile"], basis: "TEST" },
  { scheme: "ellery_body", label: "body number", entity_kinds: ["body"], space: "body", form: "t-body", systems: ["ellery.profile"], basis: "TEST" },
  { scheme: "ellery_org", label: "organisation number", entity_kinds: ["institution"], space: "institution", form: "t-org", systems: ["ellery.profile"], basis: "TEST" },
  { scheme: LEGISTAR_SCHEMES.body, label: "Legistar BodyId", entity_kinds: ["body"], space: "body", form: "t-legistar", systems: ["portellery.legistar"], basis: "TEST" },
  { scheme: LEGISTAR_SCHEMES.person, label: "Legistar PersonId", entity_kinds: ["person"], space: "person", form: "t-legistar", systems: ["portellery.legistar"], basis: "TEST" },
  { scheme: LEGISTAR_SCHEMES.seat, label: "Legistar OfficeRecordId", entity_kinds: ["office"], space: "office", form: "t-legistar", systems: ["portellery.legistar"], basis: "TEST" },
];
/* The spaces are the real closed list (idspaces); each test scheme names a form of its own, shaped by what its ids look
   like, so a value is recognised in exactly its scheme's form. */
const form = (name, re) => ({ form: name, pattern: { re }, normal: [{ group: 1 }], basis: "TEST" });
const TEST_SPACES = {
  office: { forms: [form("t-office", "^(O-\\d+)$"), form("t-legistar", "^(\\d+)$")] },
  body: { forms: [form("t-body", "^(B-\\d+)$"), form("t-legistar", "^(\\d+)$"), form("t-court", "^(MC-\\d+)$"), form("t-docket", "^(DK-\\d+)$")] },
  institution: { forms: [form("t-org", "^(T-\\d+)$")] },
  person: { forms: [form("t-legistar", "^(\\d+)$")] },
};
/* What the active test profiles add to the registry's view. */
const viewOf = (profiles) => ({ identifier_schemes: profiles.flatMap((p) => p.identifier_schemes || []), spaces: TEST_SPACES });
/* The test profile with T33's seeding data as K1682 reads it: counterparty `ids`, `within` and `organisation`, the
   schemes, and a MemberType map under the Legistar vocabulary. */
function profileView({ drop = [] } = {}) {
  const p = clone(base);
  p.id = PID; p.test = false;
  p.identifier_schemes = [...(p.identifier_schemes || []).filter((x) => !SCHEMES.some((t) => t.scheme === x.scheme)), ...SCHEMES];
  p.vocabulary = { ...(p.vocabulary || {}),
    member_types: [{ member_type: "Member", capacity: "elected", basis: "TEST" }, { member_type: "Chair", capacity: "elected", basis: "TEST" }] };
  p.counterparties = [
    { role: "Town Clerk", body: "City of Port Ellery", level: "city", elected: false, basis: "TEST",
      ids: { office: { scheme: "ellery_office", id: "O-1" }, body: { scheme: "ellery_body", id: "B-1" } } },
    { role: "Selectboard", body: "Port Ellery Selectboard", level: "city", elected: true, basis: "TEST", organisation: "selectboard",
      ids: { office: { scheme: "ellery_office", id: "O-2" }, body: { scheme: "ellery_body", id: "B-2" } },
      within: { label: "Town of Port Ellery", kind: "institution", ids: { scheme: "ellery_org", id: "T-1" } } },
    { role: "Harbour District Board", body: "Port Ellery Harbour District", level: "district", elected: true, basis: "TEST" },
    { role: "Examiner of Accounts", body: "Marlow County Audit Office", level: "county", elected: false, basis: "TEST",
      ids: { office: { scheme: "ellery_office", id: "O-4" }, body: { scheme: "ellery_body", id: "B-4" } },
      within: { label: "Marlow County", kind: "institution" } },
    { role: "Commissioner", body: "Harbour Commission", level: "district", elected: false, basis: "TEST", organisation: "selectboard",
      ids: { office: { scheme: "ellery_office", id: "O-5" }, body: { scheme: "ellery_body", id: "B-5" } } },
  ].filter((_, i) => !drop.includes(i));
  return p;
}
const jurisOver = (views) => ({
  list: () => Object.values(views()),
  get: (id) => views()[id] || null,
  combine: () => ({ ok: true, conflicts: [], view: {} }),
});

/* Legistar captures of a client that is not the first profile's (legistar-reader R14). Contact fields are present in
   the source, as Legistar serves them, so the test can find that none of their values is copied (K1485). */
const API = "https://webapi.legistar.com/v1/portellery";
const AT = "2026-10-05T22:02:52.746Z";
const BODIES = [
  { BodyId: 10, BodyName: "Selectboard of Port Ellery", BodyTypeName: "Board" },
  { BodyId: 11, BodyName: "Selectboard of Port Ellery (POSTPONED)", BodyTypeName: "Board" },
  { BodyId: 20, BodyName: "Harbour Commissioners", BodyTypeName: "Commission" },
  { BodyId: 30, BodyName: "Port Ellery City Hall", BodyTypeName: "Requestors" },
  { BodyId: 40, BodyName: "Marlow County Audit Office", BodyTypeName: "Office" },
  { BodyId: 41, BodyName: "Marlow County Audit Office Extraordinary", BodyTypeName: "Office" },
];
const CONTACT = { PersonEmail: "ada@private.example", PersonPhone: "555-0100", PersonAddress1: "1 Secret Lane", PersonWWW: "https://ada.example" };
const PERSONS = [
  { PersonId: 100, PersonFullName: "Ada  Lovelace", PersonActiveFlag: 1, ...CONTACT },
  { PersonId: 101, PersonFullName: "Ada Lovelace", PersonActiveFlag: 1 },
  { PersonId: 102, PersonFullName: "Grace Hopper", PersonActiveFlag: 1 },
];
const REC = (id, person, body, type, start, end) => ({ OfficeRecordId: id, OfficeRecordPersonId: person, OfficeRecordBodyId: body,
  OfficeRecordMemberType: type, OfficeRecordStartDate: `${start}T00:00:00`, OfficeRecordEndDate: end ? `${end}T00:00:00` : null,
  OfficeRecordEmail: "seat@private.example" });
const RECORDS = [
  REC(500, 100, 10, "Member", "2024-01-08", "2028-01-03"),
  REC(501, 101, 11, "Chair", "2020-01-06", "2024-01-07"),
  REC(502, 102, 40, "Alternate", "2025-02-01", null),
  REC(503, 999, 10, "Member", "2022-01-03", null),
  REC(504, 102, 20, "Member", "2021-01-04", null),
];
const CAPS = {
  ["b".repeat(64)]: { locator: `${API}/bodies`, text: JSON.stringify(BODIES), at: AT },
  ["c".repeat(64)]: { locator: `${API}/persons`, text: JSON.stringify(PERSONS), at: AT },
  ["d".repeat(64)]: { locator: `${API}/officerecords`, text: JSON.stringify(RECORDS), at: AT },
};
const SHAS = { bodies: "b".repeat(64), persons: "c".repeat(64), officerecords: ["d".repeat(64)] };

async function world({ view = profileView(), env = {} } = {}) {
  let views = { [PID]: view };
  const reg = await registryOver(() => viewOf(Object.values(views)), Object.keys(CAPS));
  const prov = providers({ admins: ["admin"] });
  const w = await boot({ env, prov, now: () => Date.parse("2026-10-06T12:00:00Z"),
    more: { jurisdictions: jurisOver(() => views), entities: reg.entities, lines: reg.lines,
            readCapture: async (sha) => CAPS[sha] || null } });
  if (!env.JURISDICTION_PROFILES) w.record.setSetting("jurisdiction_profiles", [PID], "test");
  return { ...w, reg, setView: (v) => { views = { [PID]: v }; } };
}
const whats = (list) => list.map((x) => `${x.what}:${x.role ?? x.OfficeRecordId ?? x.body ?? ""}`);

test("R50 officesSeed seeds each profile office as an office and its body as a body under the profile's identifiers, with post_in office→body and part_of body→the organisation it is within, machine-attributed from the profile entry; an entity whose identifier the entry lacks is not seeded, and the answer says which", async () => {
  const w = await world();
  const r = w.m.officesSeed({ by: "admin" });
  assert.equal(r.ok, true);
  assert.deepEqual(whats(r.seeded), ["body:Town Clerk", "office:Town Clerk", "post_in:Town Clerk",
    "body:Selectboard", "office:Selectboard", "post_in:Selectboard", "organisation:Selectboard", "part_of:Selectboard",
    "body:Examiner of Accounts", "office:Examiner of Accounts", "post_in:Examiner of Accounts",
    "body:Commissioner", "office:Commissioner", "post_in:Commissioner"]);
  assert.deepEqual(r.already, []);
  const why = Object.fromEntries(r.unseeded.map((x) => [`${x.what}:${x.role}`, x.why]));
  assert.deepEqual(Object.keys(why), ["part_of:Town Clerk", "body:Harbour District Board", "office:Harbour District Board",
    "part_of:Examiner of Accounts", "part_of:Commissioner"]);
  assert.equal(why["office:Harbour District Board"], word("setup.why.profile_names_identifier", { what: "office", field: "ids.office" }));
  assert.equal(why["body:Harbour District Board"], word("setup.why.profile_names_identifier", { what: "body", field: "ids.body" }));
  assert.equal(why["part_of:Town Clerk"], word("setup.why.profile_names_organization"));
  assert.equal(why["part_of:Examiner of Accounts"], word("setup.why.profile_names_organization_body", { ids: "identifier (within.ids)" }));
  /* the entities: kinds, labels, the machine's stamp, a note citing the profile entry, the identifier and its basis */
  const E = w.reg.entities;
  const sel = r.seeded.find((x) => x.what === "office" && x.role === "Selectboard");
  const office = E.ents.get(sel.entity_id);
  assert.deepEqual([office.kind, office.label, office.declared_by], ["office", "Selectboard, Port Ellery Selectboard", SEED_MACHINE]);
  assert.equal(office.note, word("setup.note.office_action_addressed", { cite: localize("instance-setup.setup.cite_office_basis", "jurisdiction profile {profile}, {entry} (basis: {basis})", { profile: PID, entry: "counterparties[1]", basis: "TEST" }) }));
  const bodyId = r.seeded.find((x) => x.what === "body" && x.role === "Selectboard").entity_id;
  const body = E.ents.get(bodyId);
  assert.deepEqual([body.kind, body.label, body.sector], ["body", "Port Ellery Selectboard", "government"]);
  const orgId = r.seeded.find((x) => x.what === "organisation").entity_id;
  assert.deepEqual([E.ents.get(orgId).kind, E.ents.get(orgId).label], ["institution", "Town of Port Ellery"]);
  assert.deepEqual(E.idents.find((x) => x.entity_id === sel.entity_id),
    { entity_id: sel.entity_id, scheme: "ellery_office", id: "O-2", basis: { system: "ellery.profile", row: `${PID}/counterparties[1]/office` }, by: SEED_MACHINE });
  /* no entity for the entry with no identifiers, and none named by name */
  assert.equal([...E.ents.values()].some((e) => /Harbour District/.test(e.label)), false);
  /* the lines: machine, from a system rule whose ids name both ends, its source the profile entry */
  const L = w.reg.lines.lines;
  assert.deepEqual(L.map((x) => x.kind), ["post_in", "post_in", "part_of", "post_in", "post_in"]);
  const postIn = L.find((x) => x.from === sel.entity_id);
  assert.deepEqual([postIn.kind, postIn.to, postIn.by, postIn.basis.rule, postIn.basis.source],
    ["post_in", bodyId, SEED_MACHINE, "a jurisdiction profile's office entry, seeded at setup", { profile: PID, entry: "counterparties[1]" }]);
  assert.deepEqual(postIn.basis.ids, { from: { scheme: "ellery_office", id: "O-2" }, to: { scheme: "ellery_body", id: "B-2" } });
  assert.equal(postIn.valid.zone, "America/Halifax");
  const partOf = L.find((x) => x.kind === "part_of");
  assert.deepEqual([partOf.to, partOf.basis.ids], [orgId, { from: { scheme: "ellery_body", id: "B-2" }, to: { scheme: "ellery_org", id: "T-1" } }]);
  assert.deepEqual(r.counts, { seeded: 14, already: 0, unseeded: 5 });
});

test("R50 a repeat seeds nothing again (already: true for each entity and line), an entity a member already identified is taken as held, and an office the profile no longer names is never deleted, its lines left as they stand", async () => {
  const w = await world();
  const first = w.m.officesSeed({ by: "admin" });
  const ents = w.reg.entities.ents.size, lines = w.reg.lines.lines.length;
  const again = w.m.officesSeed({ by: "admin" });
  assert.deepEqual(again.seeded, []);
  assert.deepEqual(whats(again.already), whats(first.seeded));
  for (const a of again.already) assert.equal(a.entity_id ?? a.line_id, (first.seeded.find((s) => s.what === a.what && s.role === a.role)).entity_id
    ?? first.seeded.find((s) => s.what === a.what && s.role === a.role).line_id);
  assert.deepEqual([w.reg.entities.ents.size, w.reg.lines.lines.length], [ents, lines]);
  /* the profile stops naming the Town Clerk: nothing is deleted, the office keeps its line */
  w.setView(profileView({ drop: [0] }));
  const later = w.m.officesSeed({ by: "admin" });
  assert.equal(later.already.some((x) => x.role === "Town Clerk"), false);
  assert.deepEqual([w.reg.entities.ents.size, w.reg.lines.lines.length], [ents, lines]);
  assert.equal(w.m.officeEntityOf({ role: "Town Clerk", body: "City of Port Ellery" }), first.seeded.find((x) => x.what === "office").entity_id);
  /* an entity a member already holds under the profile's identifier is taken, not seeded again */
  const w2 = await world();
  const mine = w2.reg.entities.createEntity({ kind: "office", label: "the clerk", note: "a member's own", declaredBy: "ruth" });
  w2.reg.entities.addIdentifier({ entityId: mine.entity_id, scheme: "ellery_office", id: "O-1", basis: "the town's list", by: "ruth" });
  const r2 = w2.m.officesSeed({ by: "admin" });
  assert.deepEqual(r2.already.map((x) => [x.what, x.role, x.entity_id]), [["office", "Town Clerk", mine.entity_id]]);
  assert.equal(r2.seeded.find((x) => x.what === "post_in" && x.role === "Town Clerk").what, "post_in");
});

test("R50 officesSeed is an administrator's act (NOT_AN_ADMIN, membership R84, its stamp from the query), runs at setup once R13 records the profiles, and with no active profile seeds nothing and says so", async () => {
  const w = await world();
  for (const by of [null, "", "ruth", "class:daemon"]) {
    const r = w.m.officesSeed({ by });
    assert.deepEqual([r.ok, r.reason], [false, "NOT_AN_ADMIN"], String(by));
  }
  const forged = await (await frame(w.m, new Request("http://do/officesseed?by=ruth", { method: "POST", body: JSON.stringify({ by: "admin", boot: true }) }))).json();
  assert.equal(forged.result.reason, "NOT_AN_ADMIN");
  assert.equal(w.reg.entities.ents.size, 0);
  /* at setup: the first boot records the bound profiles (R13), then seeds their offices as the machine */
  const b = await world({ env: { JURISDICTION_PROFILES: PID } });
  assert.equal(b.started.profiles.recorded, true);
  assert.deepEqual([b.started.offices.ok, b.started.offices.by, b.started.offices.counts.seeded], [true, SEED_MACHINE, 14]);
  /* a later boot does not seed again */
  const again = await boot({ st: b.st, env: { JURISDICTION_PROFILES: PID }, more: {} });
  assert.equal("offices" in again.started, false);
  /* none active */
  const n = await world();
  n.record.setSetting("jurisdiction_profiles", [], "test");
  const none = n.m.officesSeed({ by: "admin" });
  assert.deepEqual([none.ok, none.seeded.length, none.unseeded.length], [true, 0, 0]);
  assert.equal(none.detail, word("instance-setup.offices.detail.no_profile"));
});

test("K1683 officeOf(entityId, profile) answers {role, body} for an office this module seeded from a profile, else null; officeEntityOf({role, body}) answers its entity id, else null", async () => {
  const w = await world();
  const r = w.m.officesSeed({ by: "admin" });
  const sel = r.seeded.find((x) => x.what === "office" && x.role === "Selectboard").entity_id;
  assert.deepEqual(w.m.officeOf(sel, PID), { role: "Selectboard", body: "Port Ellery Selectboard", profile: PID });
  assert.deepEqual(w.m.officeOf(sel), { role: "Selectboard", body: "Port Ellery Selectboard", profile: PID });
  assert.equal(w.m.officeOf(sel, "another-profile"), null);
  const bodyEnt = r.seeded.find((x) => x.what === "body" && x.role === "Selectboard").entity_id;
  for (const x of [bodyEnt, "ENT-2026-9999", "", null, 7]) assert.equal(w.m.officeOf(x, PID), null, String(x));
  assert.equal(w.m.officeEntityOf({ role: "Selectboard", body: "Port Ellery Selectboard" }), sel);
  assert.equal(w.m.officeEntityOf({ role: " Selectboard ", body: "Port Ellery Selectboard " }), sel);
  for (const q of [{ role: "Harbour District Board", body: "Port Ellery Harbour District" }, { role: "Selectboard" }, {}, undefined])
    assert.equal(w.m.officeEntityOf(q), null, JSON.stringify(q));
});

test("R51 a profile body matches a Legistar body only by exact equality after normalisation: the term fold, markers read as the base body, the body-variant map; one form's several BodyIds are one match, each held on the body entity with the capture as basis; no match or more than one is left unmatched with its candidates, never resolved by a near name", async () => {
  const w = await world();
  w.m.officesSeed({ by: "admin" });
  const r = await w.m.seatsSeed({ ...SHAS, by: "admin" });
  assert.equal(r.ok, true);
  const m = Object.fromEntries(r.matches.map((x) => [x.body, x.bodies.map((b) => b.BodyId)]));
  /* the variant map (and the cancellation marker) bring 10 and 11 to "selectboard"; the special marker brings 41 to 40's base */
  assert.deepEqual(m, { "Port Ellery Selectboard": [10, 11], "Marlow County Audit Office": [40, 41] });
  const un = Object.fromEntries(r.unmatched.map((x) => [x.body, x]));
  assert.deepEqual(Object.keys(un).sort(), ["City of Port Ellery", "Harbour Commission", "Port Ellery Harbour District"]);
  /* a near name is a candidate, never a match */
  assert.deepEqual(un["City of Port Ellery"].candidates, [{ BodyId: 30, name: "Port Ellery City Hall" }]);
  assert.equal(un["City of Port Ellery"].why, word("setup.why.legistar_body_normalized"));
  /* two forms each equal to a different Legistar body: more than one, unmatched, both named */
  assert.deepEqual(un["Harbour Commission"].candidates.map((c) => c.BodyId).sort(), [10, 11, 20]);
  assert.equal(un["Harbour Commission"].why, word("setup.why.normalized_forms_equal"));
  /* the BodyIds held on the seeded body, basis the capture's row */
  const sel = w.m.officeEntityOf({ role: "Selectboard", body: "Port Ellery Selectboard" });
  const selBody = w.reg.lines.lines.find((x) => x.from === sel && x.kind === "post_in").to;
  assert.deepEqual(w.reg.entities.idents.filter((x) => x.scheme === LEGISTAR_SCHEMES.body && x.entity_id === selBody)
    .map((x) => [x.id, x.basis]), [["10", { system: "portellery.legistar", row: "legistar:body:10" }], ["11", { system: "portellery.legistar", row: "legistar:body:11" }]]);
  assert.equal(w.reg.entities.idents.some((x) => x.scheme === LEGISTAR_SCHEMES.body && ["20", "30"].includes(x.id)), false);
  /* a profile body R50 could not seed is matched and said to be held nowhere */
  const w2 = await world({ view: Object.assign(profileView(), {}) });
  const unseededBody = await w2.m.seatsSeed({ ...SHAS, by: "admin" });
  for (const x of unseededBody.matches) assert.equal(x.why, word("setup.why.profile_names_identifier", { what: "body", field: "ids.body" }));
  assert.equal(w2.reg.entities.idents.length, 0);
});

test("R52 each seat on a matched body is seeded: an office per OfficeRecordId, seat_on to the body, the holder a person under its PersonId, holds with capacity by the profile's MemberType map and the record's start and end as given, dated as recorded by Legistar, machine-attributed, its basis the capture row", async () => {
  const w = await world();
  w.m.officesSeed({ by: "admin" });
  const r = await w.m.seatsSeed({ ...SHAS, by: "admin" });
  const E = w.reg.entities, L = w.reg.lines.lines;
  const seatOf = (id) => E.idents.find((x) => x.scheme === LEGISTAR_SCHEMES.seat && x.id === String(id));
  const personOf = (id) => E.idents.find((x) => x.scheme === LEGISTAR_SCHEMES.person && x.id === String(id));
  /* seats of bodies 10, 11 and 40 only: 504 is on body 20, which no profile body matched */
  assert.deepEqual(E.idents.filter((x) => x.scheme === LEGISTAR_SCHEMES.seat).map((x) => x.id), ["500", "501", "502", "503"]);
  assert.equal(seatOf(504), undefined);
  const s500 = E.ents.get(seatOf(500).entity_id);
  assert.deepEqual([s500.kind, s500.label, s500.declared_by], ["office", "Member, Port Ellery Selectboard", SEED_MACHINE]);
  assert.equal(s500.note, word("setup.note.seat_legistar_office", { label: "Port Ellery Selectboard", office_record_id: 500, legistar_basis: LEGISTAR_BASIS, given: "Member" }));
  const holds = L.filter((x) => x.kind === "holds");
  assert.deepEqual(holds.map((x) => [E.ents.get(x.from).label, E.ents.get(x.to).label, x.capacity, x.valid.from, x.valid.to]), [
    ["Ada Lovelace", "Member, Port Ellery Selectboard", "elected", "2024-01-08", "2028-01-03"],
    ["Ada Lovelace", "Chair, Port Ellery Selectboard", "elected", "2020-01-06", "2024-01-07"]]);
  const h = holds[0];
  assert.deepEqual([h.by, h.basis.rule, h.basis.source, h.basis.system, h.basis.recorded_at, h.basis.row, h.valid.precision, h.valid.zone],
    [SEED_MACHINE, "a Legistar office record", "d".repeat(64), "legistar_api", "2026-10-05T22:02:52Z", 0, "day", "America/Halifax"]);
  assert.deepEqual(h.basis.ids, { from: { scheme: LEGISTAR_SCHEMES.person, id: "100" }, to: { scheme: LEGISTAR_SCHEMES.seat, id: "500" } });
  assert.equal(r.seeded.find((x) => x.what === "holds").dated, "as recorded by Legistar on 2026-10-05T22:02:52Z");
  const seatOn = L.filter((x) => x.kind === "seat_on");
  assert.equal(seatOn.length, 4);
  for (const x of seatOn) assert.deepEqual([x.by, E.ents.get(x.from).kind, E.ents.get(x.to).kind], [SEED_MACHINE, "office", "body"]);
  /* an unmapped MemberType seeds the seat and the person and no holder line; a PersonId the persons capture lacks seeds no person */
  const und = Object.fromEntries(r.holders_undetermined.map((x) => [x.OfficeRecordId, x.why]));
  assert.match(und[502], /maps no capacity for the MemberType "Alternate"/);
  assert.match(und[503], /holds no PersonId 999/);
  assert.ok(personOf(102));
  assert.equal(personOf(999), undefined);
  assert.equal(holds.some((x) => x.to === seatOf(502).entity_id), false);
  /* a matched body with no office record seeds nothing and is stated */
  assert.deepEqual(r.bodies_without_records.map((x) => x.BodyId), [41]);
  assert.equal(r.bodies_without_records[0].why, word("setup.why.legistar_holds_office"));
});

test("R50 R51 R52 a body the profile identifies is seeded though its office has no identifier, and its Legistar match and seats follow; the MemberType map's entry for the seat's body's organisation is read before the entry for all bodies, and a type mapped for neither is undetermined", async () => {
  const view = profileView();
  delete view.counterparties[1].ids.office;                         // the Selectboard's office: no identifier
  view.vocabulary.member_types = [
    { member_type: "Member", organisation: "selectboard", capacity: "appointed", basis: "TEST" },
    { member_type: "Member", capacity: "elected", basis: "TEST" },
    { member_type: "Alternate", capacity: "appointed", basis: "TEST" },
    { member_type: "Chair", organisation: "harbour", capacity: "elected", basis: "TEST" }];
  const w = await world({ view });
  const o = w.m.officesSeed({ by: "admin" });
  const at = (list, what, role) => list.find((x) => x.what === what && x.role === role);
  assert.ok(at(o.seeded, "body", "Selectboard"), "the body is seeded under ids.body");
  assert.equal(at(o.unseeded, "office", "Selectboard").why, word("setup.why.profile_names_identifier", { what: "office", field: "ids.office" }));
  assert.equal(at(o.unseeded, "post_in", "Selectboard").why, word("setup.why.held_under_identifier", { office: "office" }));
  assert.ok(at(o.seeded, "part_of", "Selectboard"), "the body's part_of line needs only the body and its organisation");
  assert.equal(w.m.officeEntityOf({ role: "Selectboard", body: "Port Ellery Selectboard" }), null);
  const r = await w.m.seatsSeed({ ...SHAS, by: "admin" });
  assert.deepEqual(r.matches.find((m) => m.body === "Port Ellery Selectboard").bodies.map((b) => b.BodyId), [10, 11]);
  const holds = r.seeded.filter((x) => x.what === "holds");
  /* Member on the selectboard: its organisation's entry (appointed), not the all-bodies one (elected); Alternate on the
     audit office, which has no organisation: the all-bodies entry; Chair: mapped only for another organisation */
  assert.deepEqual(holds.map((h) => [h.OfficeRecordId, h.capacity]), [[500, "appointed"], [502, "appointed"]]);
  const und = Object.fromEntries(r.holders_undetermined.map((x) => [x.OfficeRecordId, x.why]));
  assert.match(und[501], /maps no capacity for the MemberType "Chair" on selectboard or on all bodies/);
});

test("R52 two PersonIds with one whitespace-normalised name are two persons, each naming the other and never merged; no contact field is copied anywhere; a repeat seeds nothing again", async () => {
  const w = await world();
  w.m.officesSeed({ by: "admin" });
  const r = await w.m.seatsSeed({ ...SHAS, by: "admin" });
  const E = w.reg.entities;
  const p100 = E.idents.find((x) => x.scheme === LEGISTAR_SCHEMES.person && x.id === "100").entity_id;
  const p101 = E.idents.find((x) => x.scheme === LEGISTAR_SCHEMES.person && x.id === "101").entity_id;
  assert.notEqual(p100, p101);
  assert.deepEqual([E.ents.get(p100).label, E.ents.get(p101).label], ["Ada Lovelace", "Ada Lovelace"]);
  const noted = (id, other) => `${word("setup.note.legistar_person", { person_id: id, basis: LEGISTAR_BASIS })} ${word("setup.note.legistar_lists_under", { x: `PersonId ${other}` })}`;
  assert.equal(E.ents.get(p100).note, noted(100, 101));
  assert.equal(E.ents.get(p101).note, noted(101, 100));
  assert.deepEqual(r.same_names.map((x) => [x.PersonId, x.same_name_as]), [[100, [101]], [101, [100]]]);
  /* no identity claim is made by the machine: nothing but entities, identifiers and lines was written */
  const everything = JSON.stringify([...E.ents.values(), E.idents, w.reg.lines.lines, r]);
  for (const v of [...Object.values(CONTACT), "seat@private.example"]) assert.equal(everything.includes(v), false, v);
  const n = [E.ents.size, E.idents.length, w.reg.lines.lines.length];
  const again = await w.m.seatsSeed({ ...SHAS, by: "admin" });
  assert.deepEqual(again.seeded, []);
  assert.deepEqual([E.ents.size, E.idents.length, w.reg.lines.lines.length], n);
  assert.ok(again.already.length >= 12);
});

test("R51 R52 seatsSeed is an administrator's act and reads only held Legistar captures of the named lists: NOT_AN_ADMIN, SEED_CAPTURE_UNREADABLE, SEED_CAPTURE_NOT_LEGISTAR (C-119.9, C-119.10); a refusal seeds nothing; with no active profile nothing is seeded and it says so", async () => {
  const w = await world();
  w.m.officesSeed({ by: "admin" });
  const n = [w.reg.entities.ents.size, w.reg.lines.lines.length];
  assert.equal((await w.m.seatsSeed({ ...SHAS, by: "ruth" })).reason, "NOT_AN_ADMIN");
  const named = (endpoint) => localize("instance-setup.setup.the_request_names_no_capture", "the request names no capture of Legistar's {endpoint}. Nothing was seeded.", { endpoint });
  const cases = [
    [{ ...SHAS, persons: null }, "SEED_CAPTURE_UNREADABLE", named("persons")],
    [{ ...SHAS, officerecords: [] }, "SEED_CAPTURE_UNREADABLE", named("officerecords")],
    [{ ...SHAS, bodies: "e".repeat(64) }, "SEED_CAPTURE_UNREADABLE", localize("instance-setup.setup.the_record_holds_no_readable", "the record holds no readable capture {sha}. Nothing was seeded.", { sha: "e".repeat(64) })],
    [{ ...SHAS, bodies: SHAS.persons }, "SEED_CAPTURE_NOT_LEGISTAR", localize("instance-setup.setup.capture_not_legistar_other", "capture {sha} is not a Legistar {endpoint} list (it is {found}). Nothing was seeded.", { sha: SHAS.persons, endpoint: "bodies", found: "persons" })],
  ];
  for (const [args, code, expected] of cases) {
    const r = await w.m.seatsSeed({ ...args, by: "admin" });
    assert.deepEqual([r.ok, r.reason, r.check, r.translation], [false, code, INSTANCE_SETUP_CHECKS[code].check, INSTANCE_SETUP_CHECKS[code].translation]);
    assert.equal(r.detail, expected);
  }
  assert.deepEqual([w.reg.entities.ents.size, w.reg.lines.lines.length], n);
  const route = await (await frame(w.m, new Request("http://do/seatsseed?by=ruth", { method: "POST", body: JSON.stringify({ ...SHAS, by: "admin" }) }))).json();
  assert.equal(route.result.reason, "NOT_AN_ADMIN");
  w.record.setSetting("jurisdiction_profiles", [], "test");
  const none = await w.m.seatsSeed({ ...SHAS, by: "admin" });
  assert.deepEqual([none.ok, none.matches.length, none.seeded.length], [true, 0, 0]);
  assert.equal(none.detail, word("instance-setup.bodies.detail.no_profile"));
});

/* The first profile as held (jurisdictions R61; N613) over the captures legistar-reader holds of its client (taken
   2026-10-05, contact fields dropped; legistar-reader R16), read as data, never imported. */
const LEGISTAR_FIXTURES = new URL("../../../../legistar-reader/test/fixtures/", import.meta.url);
function heldCaptures() {
  const caps = {}, shas = {};
  for (const f of ["bodies", "persons", "officerecords-0", "officerecords-1"]) {
    const j = JSON.parse(readFileSync(new URL(`${f}.json`, LEGISTAR_FIXTURES), "utf8"));
    const text = JSON.stringify(j.body);
    const sha = createHash("sha256").update(text).digest("hex");
    caps[sha] = { locator: j.locator, text, at: j.captured_at };
    shas[f] = sha;
  }
  return { caps, shas: { bodies: shas.bodies, persons: shas.persons, officerecords: [shas["officerecords-0"], shas["officerecords-1"]] } };
}

test("R50 R51 R52 on the first profile as held (N613), measured: each body the profile identifies is seeded under its Legistar BodyId and every office it gives no identifier is not; 3 of its 5 bodies match a Legistar body after normalisation, the Council by its organisation with its cancellation form; the Council's 46 office records seed 46 seats and 46 elected holders by the Council's own MemberType map", async () => {
  const real = heldList().find((p) => p.test !== true);
  const held = heldProfile(real.id);
  const { caps, shas } = heldCaptures();
  const reg = await registryOver(() => ({ identifier_schemes: held.identifier_schemes || [], spaces: held.spaces || {} }), Object.keys(caps));
  const w = await boot({ prov: providers({ admins: ["admin"] }), now: () => Date.parse("2026-10-06T12:00:00Z"),
    more: { entities: reg.entities, lines: reg.lines, readCapture: async (sha) => caps[sha] || null } });
  w.record.setSetting("jurisdiction_profiles", [real.id], "test");
  const o = w.m.officesSeed({ by: "admin" });
  /* R50: a body is seeded under the profile's own identifier for it, an office only under its own, never by a name */
  const withBody = held.counterparties.filter((c) => c.ids && c.ids.body);
  assert.deepEqual(o.seeded.map((x) => [x.what, x.body, x.ident.id]), withBody.map((c) => ["body", c.body, c.ids.body.id]));
  for (const x of o.seeded) assert.deepEqual(reg.entities.idents.find((i) => i.entity_id === x.entity_id).basis,
    { system: held.identifier_schemes.find((sc) => sc.scheme === "legistar_body_id").systems[0], row: `${real.id}/${x.entry}/body` });
  const un = o.unseeded.map((x) => `${x.what}:${x.role}`);
  for (const c of held.counterparties) {
    assert.ok(un.includes(`office:${c.role}`), `${c.role}: no ids.office, so no office`);
    assert.equal(un.includes(`body:${c.role}`), !(c.ids && c.ids.body), c.role);
  }
  assert.equal(reg.lines.lines.length, 0, "no office and no organisation is identified, so no post_in or part_of line");
  for (const x of o.unseeded.filter((u) => u.what === "post_in")) assert.equal(x.why, word("setup.why.held_under_identifier", { office: "office" }));
  for (const x of o.unseeded.filter((u) => u.what === "part_of")) assert.equal(x.why, word("setup.why.profile_names_organization_body", { ids: "identifier (within.ids)" }));
  /* R51: the bridge over the held bodies list */
  const s = await w.m.seatsSeed({ ...shas, by: "admin" });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.deepEqual(s.matches.map((m) => [m.body, m.form, m.bodies.map((b) => b.BodyId)]), [
    ["Finance Department", "name:finance department", [171]],
    ["Oakland City Council", "organisation:city_council", [1, 226]],
    ["Office Of The City Auditor", "name:office of the city auditor", [16]]]);
  assert.deepEqual(s.unmatched.map((m) => [m.body, m.candidates]), [["Alameda County Civil Grand Jury", []], ["California State Controller's Office", []]]);
  /* the Council's body entity now holds both BodyIds: the profile's own (1, already) and the cancellation form's (226) */
  const council = o.seeded.find((x) => x.role === "City Council").entity_id;
  assert.deepEqual(reg.entities.idents.filter((i) => i.entity_id === council).map((i) => i.id), ["1", "226"]);
  /* R52: every Council office record is a seat with its holder, elected by the Council's own MemberType entries */
  const records = ["officerecords-0", "officerecords-1"].flatMap((f) =>
    JSON.parse(readFileSync(new URL(`${f}.json`, LEGISTAR_FIXTURES), "utf8")).body).filter((r) => [1, 226].includes(r.OfficeRecordBodyId));
  assert.equal(records.length, 46);
  const seats = s.seeded.filter((x) => x.what === "seat"), holds = s.seeded.filter((x) => x.what === "holds");
  assert.deepEqual([seats.length, holds.length, s.holders_undetermined.length], [46, 46, 0]);
  assert.deepEqual([...new Set(holds.map((h) => h.capacity))], ["elected"]);
  assert.deepEqual(new Set(seats.map((x) => x.OfficeRecordId)), new Set(records.map((r) => r.OfficeRecordId)));
  /* the two matched bodies Legistar keeps no office records for seed no seat, and say so */
  assert.deepEqual(s.bodies_without_records.map((b) => b.body).sort(), ["Finance Department", "Office Of The City Auditor"]);
  /* no contact value reaches the registry */
  const everything = JSON.stringify([[...reg.entities.ents.values()], reg.entities.idents, reg.lines.lines, s]);
  assert.equal(/@|PersonEmail|PersonPhone/.test(everything), false);
});

/* N756 (K2101): a held capture is read from the record's evidence store with its earliest receipt, and that receipt is
   read for the one capture through provenance's receiptsOfCapture (its R60), never by reading every receipt. The
   provenance here is a stand-in coded to R60 (its rows for the capture asked, a sha256: prefix and case ignored),
   holding many receipts at other captures; its every-receipt read throws, so a module that reached for it fails. */
test("R51 R52 (N756) a held capture is read with its earliest receipt asked of provenance for that one capture (receiptsOfCapture, its R60), never every receipt; a store holding many receipts at other captures seeds the same as one holding only the three", async () => {
  const run = async (noise) => {
    const asked = [];
    const receipts = [];
    for (const [sha, cap] of Object.entries(CAPS)) {
      receipts.push({ capture_sha: sha, address: cap.locator, first_retrieved: "2026-10-06T11:00:00Z", via: "direct" });
      receipts.push({ capture_sha: sha, address: `${cap.locator}?later`, first_retrieved: "2026-10-06T11:30:00Z", via: "direct" });
    }
    for (let i = 0; i < noise; i += 1)
      receipts.push({ capture_sha: createHash("sha256").update(`other-${i}`).digest("hex"), address: `${API}/bodies`,
                      first_retrieved: "2026-10-01T00:00:00Z", via: "direct" });
    const provenance = {
      receiptsOfCapture({ captureSha = null } = {}) {
        asked.push(captureSha);
        const s2 = typeof captureSha === "string" ? captureSha.trim().replace(/^sha256:/, "").toLowerCase() : "";
        const rows = /^[0-9a-f]{64}$/.test(s2) ? receipts.filter((r) => r.capture_sha === s2) : [];
        return { capture_sha: rows.length ? s2 : null, rows, observations: rows.length };
      },
      receipts() { throw new Error("every receipt was read"); },
    };
    const bucket = { get: async (sha) => (CAPS[sha] ? { arrayBuffer: async () => new TextEncoder().encode(CAPS[sha].text).buffer } : null) };
    const st = storage();
    const ctx = { storage: st };
    const real = recordOf(ctx);
    applyRecordSchema(st);
    const record = new Proxy(real, { get: (t, k) => (k === "evidenceStore" ? () => bucket
      : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
    let views = { [PID]: profileView() };
    const reg = await registryOver(() => viewOf(Object.values(views)), Object.keys(CAPS));
    const prov = providers({ admins: ["admin"] });
    const m = new InstanceSetup(ctx, {}, { record, membership: prov.membership, credentials: prov.credentials,
      promotion: prov.promotion, scheduler: prov.scheduler, capture: prov.capture, governor: prov.governor,
      fetch: prov.fetch, sleep: async () => {}, now: () => Date.parse("2026-10-06T12:00:00Z"),
      jurisdictions: jurisOver(() => views), entities: reg.entities, lines: reg.lines, provenance });
    await m.start({ firstBoot: false });
    real.setSetting("jurisdiction_profiles", [PID], "test");
    m.officesSeed({ by: "admin" });
    const r = await m.seatsSeed({ ...SHAS, by: "admin" });
    return { r, asked };
  };
  const quiet = await run(0), noisy = await run(500);
  assert.equal(quiet.r.ok, true, JSON.stringify(quiet.r).slice(0, 300));
  assert.ok(quiet.r.seeded.length > 0);
  assert.deepEqual(quiet.asked.sort(), [SHAS.bodies, SHAS.persons, ...SHAS.officerecords].sort(), "one read per capture, each for that capture");
  assert.deepEqual(noisy.asked.sort(), quiet.asked);
  /* the real `lines` allocates each line_id at random, so it is left out of the comparison */
  const noIds = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "line_id" ? undefined : v)));
  assert.deepEqual(noIds(noisy.r), noIds(quiet.r), "receipts at other captures change nothing");
  /* the earliest receipt is the capture's instant: the holds lines are dated by it */
  assert.ok(quiet.r.seeded.some((x) => x.what === "holds" && /on 2026-10-06T11:00:00Z$/.test(x.dated)), JSON.stringify(quiet.r.seeded.filter((x) => x.what === "holds")).slice(0, 300));
});

/* ---- R93 (T50; N1190; jurisdictions R94; entities R54): the forums of the combined view ---- */

const FORUM_SCHEMES = [
  { scheme: "ellery_court", label: "court number", entity_kinds: ["body"], space: "body", form: "t-court", systems: ["ellery.profile"], basis: "TEST" },
  { scheme: "ellery_docket", label: "docket book", entity_kinds: ["body"], space: "body", form: "t-docket", systems: ["ellery.profile"], basis: "TEST" },
];
const FORUMS = [
  { label: "Marlow County Bench (test)", forum_kind: "court", basis: "TEST",
    ids: [{ scheme: "ellery_court", id: "MC-1" }, { scheme: "ellery_docket", id: "DK-1" }] },
  { label: "Port Ellery Harbour Commission (test)", forum_kind: "commission", basis: "TEST" },
];
async function forumWorld(forums) {
  const view = profileView();
  view.identifier_schemes = [...view.identifier_schemes, ...FORUM_SCHEMES];
  const views = { [PID]: view };
  const reg = await registryOver(() => viewOf([view]));
  const juris = { ...jurisOver(() => views), combine: () => ({ ok: true, conflicts: [], view: forums === undefined ? {} : { forums } }) };
  const w = await boot({ prov: providers({ admins: ["admin"] }), now: () => Date.parse("2026-10-06T12:00:00Z"),
    more: { jurisdictions: juris, entities: reg.entities, lines: reg.lines } });
  w.record.setSetting("jurisdiction_profiles", [PID], "test");
  return { ...w, reg };
}
const forumsOf = (r) => [...r.seeded, ...r.already, ...r.unseeded].filter((x) => x.what === "forum");

test("R93 officesSeed seeds each forum of the combined view as a body entity carrying its forum_kind, under its identifiers, machine-attributed with the profile entry as basis; seeding twice writes each forum once, the second answering already; a forum with no identifier is listed unseeded with why", async () => {
  const w = await forumWorld(FORUMS);
  const first = w.m.officesSeed({ by: "admin" });
  assert.equal(first.ok, true);
  const court = first.seeded.find((x) => x.what === "forum");
  assert.equal(court.label, "Marlow County Bench (test)");
  const e = w.reg.entities.ents.get(court.entity_id);
  assert.deepEqual([e.kind, e.forum_kind, e.label, e.declared_by], ["body", "court", "Marlow County Bench (test)", SEED_MACHINE]);
  assert.equal(e.note, localize("instance-setup.setup.the_forum_kind_label_a", "The {forum_kind} {label}, a forum as the active {cite} names it; seeded at setup.", { forum_kind: "court", label: "Marlow County Bench (test)", cite: localize("instance-setup.setup.cite_forum_basis", "jurisdiction profile {id}, forum {label} (basis: {basis})", { id: PID, label: "Marlow County Bench (test)", basis: "TEST" }) }));
  const idents = w.reg.entities.idents.filter((x) => x.entity_id === court.entity_id);
  assert.deepEqual(idents.map((x) => [x.scheme, x.id, x.basis.system]), [["ellery_court", "MC-1", "ellery.profile"], ["ellery_docket", "DK-1", "ellery.profile"]]);
  const none = first.unseeded.find((x) => x.what === "forum");
  assert.equal(none.label, "Port Ellery Harbour Commission (test)");
  assert.equal(none.why, word("setup.why.profile_names_identifier", { what: "forum", field: "ids" }));
  assert.deepEqual(first.forums.map((f) => [f.label, f.state]), [["Marlow County Bench (test)", "seeded"], ["Port Ellery Harbour Commission (test)", "unseeded"]]);
  const ents = w.reg.entities.ents.size;
  const again = w.m.officesSeed({ by: "admin" });
  assert.deepEqual(forumsOf(again).map((x) => x.label + ":" + (again.already.includes(x) ? "already" : again.seeded.includes(x) ? "seeded" : "unseeded")),
    ["Marlow County Bench (test):already", "Port Ellery Harbour Commission (test):unseeded"]);
  assert.equal(w.reg.entities.ents.size, ents, "the second seeding wrote no entity");
  assert.equal(again.forums[0].entity_id, court.entity_id);
});

test("R93 control: a profile with no forums (the view holds none, or an empty list) writes no forum and lists none", async () => {
  for (const forums of [undefined, []]) {
    const w = await forumWorld(forums);
    const r = w.m.officesSeed({ by: "admin" });
    assert.equal(r.ok, true);
    assert.deepEqual(forumsOf(r), []);
    assert.deepEqual(r.forums, []);
    assert.equal([...w.reg.entities.ents.values()].some((e) => e.forum_kind), false);
  }
});
