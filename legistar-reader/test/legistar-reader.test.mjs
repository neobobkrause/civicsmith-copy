/* legistar-reader's tests, at its interface (requirements `build/requirements/legistar-reader.md`).
 *
 * The captured fixtures beside this file are keyless reads of Oakland's Legistar Web API taken
 * 2026-10-05 by `fixtures/capture.mjs`, contact fields dropped before they were written (K1485).
 * The local words a reader needs (meeting markers, body variants) come from a view built here for
 * the test profile's place, Port Ellery, never from the first profile, and the synthetic captures
 * are of a client other than the first profile's (R14). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  legistar, detect, parse, assess, nextPage, readPages, registerLegistar, readAddress,
  KEY, BASIS, PUBLISHED_LABEL, CONTACT_FIELDS, isContactField, ENDPOINTS,
} from "../index.mjs";
import { CONTRACT, CONFIDENCE, makeRegistry, EVENTS } from "../../docprofile/registry.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (name) => JSON.parse(readFileSync(join(FIX, name + ".json"), "utf8"));

/* The test profile's view: Port Ellery's clerk writes "CALLED OFF" for a cancelled meeting,
   "Extraordinary" for a special one and "Joint" for a concurrent one, and its harbour board
   meets under two names. None of these is a word of the first profile. */
const PORT = {
  vocabulary: {
    meeting_markers: [
      { marker: "cancelled", pattern: { re: "CALLED OFF", flags: "i" }, basis: "TEST" },
      { marker: "special", pattern: { re: "\\bExtraordinary\\b", flags: "i" }, basis: "TEST" },
      { marker: "concurrent", pattern: { re: "\\bJoint\\b", flags: "i" }, basis: "TEST" },
    ],
    body_variants: [
      { pattern: { re: "Harbou?r (?:Board|Commission)", flags: "i" }, organisation: "port-ellery-harbour-board", basis: "TEST" },
    ],
  },
};
/* For the captured Oakland events, the one marker R16's cancelled gold rows need, written here
   as test data (the first profile's own words are `jurisdictions`', T33-2). */
const CAPTURED = { vocabulary: { meeting_markers: [{ marker: "cancelled", pattern: { re: "CANCELL(?:ED|ATION)", flags: "i" }, basis: "TEST" }] } };

const PE = "https://webapi.legistar.com/v1/portellery";
const ctxOf = (locator, body, extra = {}) => ({ locator, text: JSON.stringify(body), view: PORT, ...extra });
const fixCtx = (name, extra = {}) => { const f = load(name); return { locator: f.locator, text: JSON.stringify(f.body), view: CAPTURED, at: f.captured_at, ...extra }; };
const CAPTURES = ["bodies", "persons", "officerecords-0", "officerecords-1", "events-3y", "eventitems-9451",
  "votes-232591", "votes-232594", "votes-232608", "matters-2025-06"];

/* ---------------------------------------------------------------- R1 */

test("R1 detect matches every captured endpoint at CERTAIN, and a single record at its own address", () => {
  for (const name of CAPTURES) {
    const d = detect(fixCtx(name));
    assert.equal(d.match, true, name);
    assert.equal(d.confidence, CONFIDENCE.CERTAIN, name);
  }
  for (const id of load("gold").events.map((e) => e.EventId)) {
    const d = detect(fixCtx(`gold/${id}`));
    assert.equal(d.match, true, String(id));
    assert.equal(d.confidence, CONFIDENCE.CERTAIN);
  }
  for (const [endpoint, { id }] of Object.entries(ENDPOINTS)) {
    const d = detect(ctxOf(`${PE}/${endpoint}`, [{ [id]: 7 }]));
    assert.equal(d.match, true, endpoint);
  }
});

test("R1 anything else does not match, and malformed JSON says why", () => {
  const no = (ctx, re) => { const d = detect(ctx); assert.equal(d.match, false); assert.equal(d.confidence, CONFIDENCE.NONE); assert.match(d.why, re); };
  no(ctxOf("https://example.org/v1/portellery/events", [{ EventId: 1 }]), /not a Legistar Web API address/);
  no(ctxOf("https://portellery.legistar.com/Calendar.aspx", [{ EventId: 1 }]), /not a Legistar Web API address/);
  no(ctxOf(`${PE}/actions`, [{ ActionId: 1 }]), /does not read/);
  no(ctxOf(`${PE}/`, []), /no endpoint|not a Legistar/);
  no({ locator: `${PE}/events`, text: "[{\"EventId\": 1,", view: PORT }, /not JSON/);
  no({ locator: `${PE}/events`, text: "<html></html>", view: PORT }, /not JSON/);
  no({ locator: `${PE}/events`, view: PORT }, /no text/);
  no({ text: "[]" }, /no address/);
  no(ctxOf(`${PE}/events`, { EventId: 1 }), /not an array/);
  no(ctxOf(`${PE}/events`, [{ EventId: 1 }, { BodyId: 2 }]), /entry 1 carries no EventId/);
  no(ctxOf(`${PE}/events`, [{ EventId: "1" }]), /carries no EventId/);
  no(ctxOf(`${PE}/events`, [1, 2]), /not an object/);
  no(ctxOf(`${PE}/persons`, [{ EventId: 1 }]), /carries no PersonId/);
  no(ctxOf(`${PE}/events/12`, { EventId: 13 }), /not the 12/);
  no(ctxOf(`${PE}/events/12`, "x"), /not an object/);
});

test("R1 the type is registered through the registry seam, once, under its key, as MEMBERSHIP", () => {
  assert.equal(legistar.key, KEY);
  assert.equal(KEY, "legistar_api");
  assert.equal(legistar.contract, CONTRACT.MEMBERSHIP);
  const reg = makeRegistry();
  registerLegistar(reg.register);
  registerLegistar(reg.register);
  assert.equal(reg.all().length, 1);
  const r = reg.recognise(fixCtx("events-3y"));
  assert.equal(r.member.key, KEY);
  assert.equal(r.confidence, CONFIDENCE.CERTAIN);
  assert.throws(() => registerLegistar(null), TypeError);
});

/* ---------------------------------------------------------------- R2 */

test("R2 parse gives endpoint, client, rows, page and facts; every row its kind, key, the source's ids, facts, index and system assertion", () => {
  for (const name of CAPTURES) {
    const f = load(name);
    const p = parse(fixCtx(name));
    const addr = readAddress(f.locator);
    const spec = ENDPOINTS[addr.endpoint];
    assert.equal(p.endpoint, addr.endpoint);
    assert.equal(p.client, "oakland");
    assert.equal(p.rows.length, f.body.length, name);
    assert.equal(p.facts.count, f.body.length);
    assert.equal(p.facts.assertion, "system");
    assert.equal(p.facts.basis, BASIS);
    assert.ok(p.page && Number.isInteger(p.page.skip));
    p.rows.forEach((r, i) => {
      const o = f.body[i];
      assert.equal(r.kind, spec.kind);
      assert.equal(r.key, `legistar:${spec.kind}:${o[spec.id]}`);
      assert.equal(r.source, i);
      assert.equal(r.assertion, "system");
      assert.equal(r.basis, "as recorded by Legistar");
      assert.equal(r.ids[spec.id], o[spec.id]);
      assert.ok(r.facts && typeof r.facts === "object");
    });
  }
  const seat = parse(fixCtx("officerecords-1")).rows[0];
  const o = load("officerecords-1").body[0];
  assert.deepEqual(seat.ids, { OfficeRecordId: o.OfficeRecordId, PersonId: o.OfficeRecordPersonId, BodyId: o.OfficeRecordBodyId });
  const one = parse(fixCtx("gold/9016"));
  assert.equal(one.rows.length, 1);
  assert.equal(one.page, null);
  assert.equal(one.facts.record, 9016);
});

/* ---------------------------------------------------------------- R3 */

test("R3 no row carries a contact field: every named field and any field naming an e-mail, phone, fax, street or web address", () => {
  const values = new Map();
  let n = 0;
  const v = (field) => { const s = `contact-${field}-${++n}-zz9@example.invalid`; values.set(field, s); return s; };
  const person = { PersonId: 1, PersonFullName: "Ada Quill", PersonActiveFlag: 1 };
  for (const k of CONTACT_FIELDS.filter((k) => k.startsWith("Person"))) person[k] = v(k);
  for (const k of ["PersonHomeAddress", "PersonMobilePhone", "PersonWebsite", "PersonStreet", "PersonFaxNumber", "PersonEMail3"]) person[k] = v(k);
  const seat = { OfficeRecordId: 2, OfficeRecordPersonId: 1, OfficeRecordBodyId: 3, OfficeRecordMemberType: "Member",
    OfficeRecordStartDate: "2020-01-01T00:00:00", OfficeRecordEndDate: null,
    OfficeRecordEmail: v("OfficeRecordEmail"), OfficeRecordTitle: v("OfficeRecordTitle"), OfficeRecordDistrict: v("OfficeRecordDistrict"),
    OfficeRecordPhone: v("OfficeRecordPhone") };
  const body = { BodyId: 3, BodyName: "Harbour Board", BodyTypeName: "Board", BodyContactEmail: v("BodyContactEmail"),
    BodyContactPhone: v("BodyContactPhone"), BodyContactAddress: v("BodyContactAddress") };
  const out = JSON.stringify([
    parse(ctxOf(`${PE}/persons`, [person])), parse(ctxOf(`${PE}/officerecords`, [seat])), parse(ctxOf(`${PE}/bodies`, [body])),
  ]);
  for (const [field, s] of values) assert.equal(out.includes(s), false, `${field}'s value reached the output`);
  for (const f of CONTACT_FIELDS) assert.equal(isContactField(f), true, f);
  /* and no key of any row of any capture names a contact field */
  const walk = (x, path) => {
    if (Array.isArray(x)) return x.forEach((y, i) => walk(y, path + "." + i));
    if (!x || typeof x !== "object") return;
    for (const [k, y] of Object.entries(x)) { assert.equal(isContactField(k), false, path + "." + k); walk(y, path + "." + k); }
  };
  for (const name of CAPTURES) walk(parse(fixCtx(name)).rows, name);
});

/* ---------------------------------------------------------------- R4 */

test("R4 bodies: {BodyId, name, type}; markers from the view give the base body, status and kind of meeting; the variant map its organisation", () => {
  const rows = parse(ctxOf(`${PE}/bodies`, [
    { BodyId: 10, BodyName: "Harbour Board", BodyTypeName: "Board" },
    { BodyId: 11, BodyName: "Harbour Board - CALLED OFF", BodyTypeName: "Board" },
    { BodyId: 12, BodyName: "Extraordinary Meeting of the Harbour Commission", BodyTypeName: "Special Meeting" },
    { BodyId: 13, BodyName: "Joint Meeting of the Town Council and the Harbour Board", BodyTypeName: "Council" },
    { BodyId: 14, BodyName: "Town Council", BodyTypeName: "Council" },
  ])).rows;
  const f = (i) => rows[i].facts;
  assert.deepEqual([f(0).BodyId, f(0).name, f(0).type], [10, "Harbour Board", "Board"]);
  assert.deepEqual([f(0).status, f(0).meeting_kind, f(0).organisation, f(0).base], [null, null, "port-ellery-harbour-board", "Harbour Board"]);
  assert.deepEqual([f(1).BodyId, f(1).status, f(1).base, f(1).organisation], [11, "cancelled", "Harbour Board", "port-ellery-harbour-board"]);
  assert.deepEqual(rows[1].markers, ["cancelled"]);
  assert.deepEqual([f(2).BodyId, f(2).meeting_kind, f(2).status, f(2).base], [12, "special", null, "Meeting of the Harbour Commission"]);
  assert.deepEqual([f(3).meeting_kind, f(3).base], ["concurrent", "Meeting of the Town Council and the Harbour Board"]);
  assert.deepEqual([f(4).organisation, f(4).meeting_kind, f(4).status], [null, null, null]);
  /* every captured body: a name carrying the view's cancellation word is cancelled, no other is */
  const captured = load("bodies").body;
  parse(fixCtx("bodies")).rows.forEach((r, i) => {
    assert.equal(r.facts.BodyId, captured[i].BodyId);
    assert.equal(r.facts.name, captured[i].BodyName);
    assert.equal(r.facts.type, captured[i].BodyTypeName);
    assert.equal(r.facts.status, /CANCELL(?:ED|ATION)/i.test(captured[i].BodyName) ? "cancelled" : null);
  });
});

/* ---------------------------------------------------------------- R5 */

test("R5 persons: {PersonId, name, name_normal, active}; one folded name under two ids gives two rows naming each other", () => {
  const captured = load("persons").body;
  const rows = parse(fixCtx("persons")).rows;
  const folded = new Map();
  rows.forEach((r, i) => {
    const o = captured[i];
    assert.deepEqual(Object.keys(r.facts).sort(), ["PersonId", "active", "name", "name_normal"]);
    assert.equal(r.facts.name, o.PersonFullName);
    assert.equal(r.facts.name_normal, o.PersonFullName.replace(/\s+/g, " ").trim());
    assert.equal(r.facts.active, o.PersonActiveFlag === 1);
    folded.set(r.facts.name_normal, [...(folded.get(r.facts.name_normal) || []), r.facts.PersonId]);
  });
  let pairs = 0;
  for (const r of rows) {
    const same = folded.get(r.facts.name_normal).filter((id) => id !== r.facts.PersonId);
    if (same.length) { pairs++; assert.deepEqual(r.same_name_as, same); } else assert.equal(r.same_name_as, undefined);
  }
  assert.ok(pairs >= 2, "the measured double-spaced duplicate is among the captured persons");
  const two = parse(ctxOf(`${PE}/persons`, [
    { PersonId: 5, PersonFullName: "Mara  Okafor", PersonActiveFlag: 1 }, { PersonId: 6, PersonFullName: "Mara Okafor", PersonActiveFlag: 0 }])).rows;
  assert.equal(two.length, 2);
  assert.deepEqual(two[0].same_name_as, [6]);
  assert.deepEqual(two[1].same_name_as, [5]);
  assert.equal(two[0].facts.name, "Mara  Okafor");
});

/* ---------------------------------------------------------------- R6 */

test("R6 officerecords: seats only, {OfficeRecordId, PersonId, BodyId, role, start, end}; end null when absent, end_planned past the capture's date", () => {
  for (const name of ["officerecords-0", "officerecords-1"]) {
    const f = load(name);
    const day = f.captured_at.slice(0, 10);
    parse(fixCtx(name)).rows.forEach((r, i) => {
      const o = f.body[i];
      assert.deepEqual(Object.keys(r.facts).sort(), ["BodyId", "OfficeRecordId", "PersonId", "end", "role", "start"]);
      assert.equal(r.facts.role, o.OfficeRecordMemberType);
      assert.equal(r.facts.start, o.OfficeRecordStartDate.slice(0, 10));
      assert.equal(r.facts.end, o.OfficeRecordEndDate ? o.OfficeRecordEndDate.slice(0, 10) : null);
      assert.equal(r.end_planned, r.facts.end !== null && r.facts.end > day);
    });
  }
  const seat = { OfficeRecordId: 1, OfficeRecordPersonId: 2, OfficeRecordBodyId: 3, OfficeRecordMemberType: "Chair",
    OfficeRecordTitle: "Vice Mayor", OfficeRecordDistrict: "District 4", OfficeRecordFullName: "Ada Quill",
    OfficeRecordStartDate: "2025-01-06T00:00:00", OfficeRecordEndDate: "2029-01-01T00:00:00" };
  const r = parse(ctxOf(`${PE}/officerecords`, [seat], { at: "2026-10-05T12:00:00Z" })).rows[0];
  assert.equal(r.facts.end, "2029-01-01");
  assert.equal(r.end_planned, true);
  assert.equal(JSON.stringify(r).includes("Vice Mayor") || JSON.stringify(r).includes("District 4"), false);
  const u = parse(ctxOf(`${PE}/officerecords`, [seat])).rows[0];
  assert.equal(u.end_planned, null);
  assert.match(u.end_planned_why, /date was not given/);
  const open = parse(ctxOf(`${PE}/officerecords`, [{ ...seat, OfficeRecordEndDate: undefined }], { at: "2026-10-05" })).rows[0];
  assert.equal(open.facts.end, null);
  assert.equal(open.end_planned, false);
});

/* ---------------------------------------------------------------- R7 */

const EVENT_FACTS = ["BodyId", "EventId", "agenda_file", "agenda_last_published", "agenda_status", "body", "date", "in_site",
  "meeting_kind", "minutes_file", "minutes_last_published", "minutes_status", "organisation", "status", "time"].sort();

test("R7 events: each field as given, date the EventDate's day and time EventTime as written, never joined; a cancelled body gives one cancelled event", () => {
  const f = load("events-3y");
  const rows = parse(fixCtx("events-3y")).rows;
  assert.equal(rows.length, f.body.length);
  let cancelled = 0;
  rows.forEach((r, i) => {
    const o = f.body[i];
    assert.deepEqual(Object.keys(r.facts).sort(), EVENT_FACTS);
    assert.equal(r.facts.EventId, o.EventId);
    assert.equal(r.facts.BodyId, o.EventBodyId);
    assert.equal(r.facts.body, o.EventBodyName);
    assert.equal(r.facts.date, o.EventDate.slice(0, 10));
    assert.equal(r.facts.time, o.EventTime);
    assert.equal(r.facts.agenda_status, o.EventAgendaStatusName);
    assert.equal(r.facts.minutes_status, o.EventMinutesStatusName);
    assert.equal(r.facts.agenda_file, o.EventAgendaFile);
    assert.equal(r.facts.minutes_file, o.EventMinutesFile);
    assert.equal(r.facts.in_site, o.EventInSiteURL);
    const c = /CANCELL(?:ED|ATION)/i.test(o.EventBodyName);
    assert.equal(r.facts.status, c ? "cancelled" : null);
    if (c) cancelled++;
  });
  assert.ok(cancelled > 0);
  const one = parse(ctxOf(`${PE}/events`, [{ EventId: 1, EventBodyId: 11, EventBodyName: "Harbour Board - CALLED OFF",
    EventDate: "2026-02-03T00:00:00", EventTime: "6:00 PM" }])).rows;
  assert.equal(one.length, 1);
  assert.deepEqual([one[0].facts.status, one[0].facts.date, one[0].facts.time, one[0].facts.organisation],
    ["cancelled", "2026-02-03", "6:00 PM", "port-ellery-harbour-board"]);
});

/* ---------------------------------------------------------------- R8 */

test("R8 the last-published times are UTC instants, each with its label", () => {
  const f = load("events-3y");
  parse(fixCtx("events-3y")).rows.forEach((r, i) => {
    const o = f.body[i];
    for (const [k, src] of [["agenda_last_published", "EventAgendaLastPublishedUTC"], ["minutes_last_published", "EventMinutesLastPublishedUTC"]]) {
      if (o[src] == null) { assert.equal(r.facts[k], null); continue; }
      assert.equal(r.facts[k], o[src] + "Z");
      assert.ok(!Number.isNaN(Date.parse(r.facts[k])));
    }
    assert.deepEqual(r.labels, { agenda_last_published: PUBLISHED_LABEL, minutes_last_published: PUBLISHED_LABEL });
  });
  assert.match(PUBLISHED_LABEL, /upper bound/);
});

/* ---------------------------------------------------------------- R9 */

test("R9 eventitems and votes as the source names them", () => {
  const items = load("eventitems-9451").body;
  parse(fixCtx("eventitems-9451")).rows.forEach((r, i) => {
    const o = items[i];
    assert.deepEqual(Object.keys(r.facts).sort(),
      ["EventId", "EventItemId", "MatterFile", "MatterId", "action", "agenda_number", "mover", "passed", "seconder", "title"]);
    assert.deepEqual([r.facts.EventItemId, r.facts.EventId, r.facts.agenda_number, r.facts.MatterId, r.facts.MatterFile, r.facts.title, r.facts.action],
      [o.EventItemId, o.EventItemEventId, o.EventItemAgendaNumber, o.EventItemMatterId, o.EventItemMatterFile, o.EventItemTitle, o.EventItemActionName]);
    assert.equal(r.facts.passed, o.EventItemPassedFlag === null ? null : o.EventItemPassedFlag === 1);
    for (const [k, id, nm] of [["mover", "EventItemMoverId", "EventItemMover"], ["seconder", "EventItemSeconderId", "EventItemSeconder"]])
      assert.deepEqual(r.facts[k], o[id] != null ? { PersonId: o[id] } : o[nm] ? { name: o[nm] } : null);
  });
  const named = parse(ctxOf(`${PE}/eventitems`, [{ EventItemId: 9, EventItemEventId: 1, EventItemMoverId: null,
    EventItemMover: "Councilmember Quill", EventItemSeconderId: 44, EventItemSeconder: "Okafor", EventItemPassedFlag: 0 }])).rows[0];
  assert.deepEqual(named.facts.mover, { name: "Councilmember Quill" });
  assert.deepEqual(named.facts.seconder, { PersonId: 44 });
  assert.equal(named.facts.passed, false);
  for (const name of ["votes-232594", "votes-232608"]) {
    const votes = load(name).body;
    assert.ok(votes.length > 0);
    parse(fixCtx(name)).rows.forEach((r, i) => {
      const o = votes[i];
      assert.deepEqual(r.facts, { VoteId: o.VoteId, EventItemId: o.VoteEventItemId, PersonId: o.VotePersonId, value: o.VoteValueName, result: o.VoteResult });
    });
  }
});

/* ---------------------------------------------------------------- R10 */

test("R10 matters' enactment fields; a null enactment date stays null, never filled from the passed date", () => {
  const ms = load("matters-2025-06").body;
  let unfilled = 0;
  parse(fixCtx("matters-2025-06")).rows.forEach((r, i) => {
    const o = ms[i];
    const day = (v) => (v == null ? null : v.slice(0, 10));
    assert.deepEqual(r.facts, { MatterId: o.MatterId, MatterFile: o.MatterFile, type: o.MatterTypeName, status: o.MatterStatusName,
      intro_date: day(o.MatterIntroDate), passed_date: day(o.MatterPassedDate), enactment_number: o.MatterEnactmentNumber,
      enactment_date: day(o.MatterEnactmentDate) });
    if (o.MatterEnactmentDate == null && o.MatterPassedDate != null) { unfilled++; assert.equal(r.facts.enactment_date, null); }
  });
  assert.ok(unfilled > 0, "the capture holds a passed matter with no enactment date");
});

/* ---------------------------------------------------------------- R11 */

test("R11 a full page may continue and names the next; a short page does not; pages join by key with conflicts reported", () => {
  const p0 = parse(fixCtx("officerecords-0"));
  const p1 = parse(fixCtx("officerecords-1"));
  assert.equal(p0.rows.length, 1000);
  assert.deepEqual([p0.page.skip, p0.page.top, p0.page.may_continue], [0, 1000, true]);
  assert.equal(p0.page.next, "https://webapi.legistar.com/v1/oakland/officerecords?$top=1000&$skip=1000");
  assert.equal(nextPage(load("officerecords-0").locator, p0.page), p0.page.next);
  assert.deepEqual([p1.page.skip, p1.page.top, p1.page.may_continue, p1.page.next], [1000, 1000, false, null]);
  assert.equal(nextPage(load("officerecords-1").locator, p1.page), null);
  assert.equal(nextPage(`${PE}/persons`), `${PE}/persons?$skip=1000`);
  const ev = load("events-3y").locator;
  assert.equal(nextPage(ev), ev + "&$skip=1000");
  assert.equal(nextPage(`${PE}/events?$skip=2000&$filter=x`), `${PE}/events?$skip=3000&$filter=x`);
  assert.equal(nextPage(`${PE}/events/12`), null);
  assert.equal(nextPage("https://example.org/x"), null);
  const all = readPages([p0, p1]);
  assert.equal(all.rows.length, 1262);
  assert.equal(new Set(all.rows.map((r) => r.key)).size, 1262);
  assert.deepEqual([all.pages, all.complete, all.conflicts.length], [2, true, 0]);
  const partial = readPages([p0]);
  assert.equal(partial.complete, false);
  assert.match(partial.why, /further page/);
  const a = parse(ctxOf(`${PE}/persons`, [{ PersonId: 1, PersonFullName: "Ada Quill" }, { PersonId: 2, PersonFullName: "B" }]));
  const b = parse(ctxOf(`${PE}/persons?$skip=1000`, [{ PersonId: 1, PersonFullName: "Ada Quill-Okafor" }, { PersonId: 2, PersonFullName: "B" }]));
  const j = readPages([a, b]);
  assert.equal(j.rows.length, 2);
  assert.equal(j.conflicts.length, 1);
  assert.equal(j.conflicts[0].key, "legistar:person:1");
  assert.equal(j.rows[0].facts.name, "Ada Quill");
  const other = readPages([a, parse(ctxOf(`${PE}/bodies`, [{ BodyId: 1, BodyName: "X" }]))]);
  assert.equal(other.rows.length, 2);
  assert.equal(other.refused.length, 1);
});

/* ---------------------------------------------------------------- R12 */

const ev = (o) => ({ EventId: 1, EventBodyId: 10, EventBodyName: "Harbour Board", EventDate: "2026-02-03T00:00:00", EventTime: "6:00 PM",
  EventAgendaStatusName: "FINAL", EventMinutesStatusName: null, EventAgendaFile: null, EventMinutesFile: null,
  EventAgendaLastPublishedUTC: null, EventMinutesLastPublishedUTC: null, EventInSiteURL: "https://portellery.legistar.com/M.aspx?ID=1", ...o });
const two = (endpoint, before, after) => assess(parse(ctxOf(`${PE}/${endpoint}`, before)), parse(ctxOf(`${PE}/${endpoint}`, after)));
const types = (r) => r.events.map((e) => e.type).sort();

test("R12 assess grades each kind of change from the catalogue, and key order and white space give nothing", () => {
  assert.deepEqual(types(two("events", [ev(), ev({ EventId: 2 })], [ev()])), ["delisted"]);
  assert.deepEqual(types(two("events", [ev()], [ev(), ev({ EventId: 2 })])), ["scheduled"]);
  assert.deepEqual(types(two("persons", [{ PersonId: 1, PersonFullName: "A" }], [{ PersonId: 1, PersonFullName: "A" }, { PersonId: 2, PersonFullName: "B" }])), ["item_added"]);
  assert.deepEqual(types(two("events", [ev()], [ev({ EventBodyName: "Harbour Board - CALLED OFF" })])).filter((t) => t === "cancelled"), ["cancelled"]);
  assert.deepEqual(types(two("events", [ev()], [ev({ EventDate: "2026-02-10T00:00:00" })])), ["rescheduled"]);
  assert.deepEqual(types(two("events", [ev()], [ev({ EventTime: "5:00 PM" })])), ["rescheduled"]);
  assert.deepEqual(types(two("events", [ev()], [ev({ EventAgendaLastPublishedUTC: "2026-01-30T19:00:00" })])), ["agenda_published"]);
  assert.deepEqual(types(two("events", [ev({ EventMinutesLastPublishedUTC: "2026-02-10T19:00:00" })], [ev({ EventMinutesLastPublishedUTC: "2026-02-12T19:00:00" })])), ["minutes_published"]);
  const vote = (v) => [{ VoteId: 1, VoteEventItemId: 2, VotePersonId: 3, VoteValueName: v, VoteResult: 1 }];
  assert.deepEqual(types(two("votes", vote("Aye"), vote("No"))), ["outcome_changed"]);
  const item = (p) => [{ EventItemId: 1, EventItemEventId: 1, EventItemPassedFlag: p, EventItemTitle: "T" }];
  assert.deepEqual(types(two("eventitems", item(1), item(0))), ["outcome_changed"]);
  assert.deepEqual(types(two("bodies", [{ BodyId: 1, BodyName: "Harbour Board" }], [{ BodyId: 1, BodyName: "Harbour Commission" }])).filter((t) => t === "renamed"), ["renamed"]);
  assert.deepEqual(types(two("persons", [{ PersonId: 1, PersonFullName: "A" }], [{ PersonId: 1, PersonFullName: "A B" }])).filter((t) => t === "renamed"), ["renamed"]);
  assert.deepEqual(types(two("events", [ev()], [ev({ EventAgendaStatusName: "SUPPLEMENTAL" })])), ["item_changed"]);
  assert.deepEqual(types(two("matters", [{ MatterId: 1, MatterStatusName: "Pending" }], [{ MatterId: 1, MatterStatusName: "Passed" }])), ["item_changed"]);
  /* every event is the catalogue's, with the catalogue's grade, and meaningful is derived from them */
  const r = two("events", [ev(), ev({ EventId: 2 })], [ev({ EventDate: "2026-03-03T00:00:00" }), ev({ EventId: 3 })]);
  for (const e of r.events) assert.equal(e.significance, EVENTS[e.type].significance);
  assert.equal(r.meaningful, true);
  assert.ok(r.confirmed === null || Number.isInteger(r.confirmed.intact));
  /* key order and white space in the JSON give nothing */
  const f = load("events-3y");
  const reordered = f.body.map((o) => Object.fromEntries(Object.entries(o).reverse()));
  const same = assess(parse(fixCtx("events-3y")),
    parse({ locator: f.locator, text: JSON.stringify(reordered, null, 3), view: CAPTURED, at: f.captured_at }));
  assert.deepEqual(same.events, []);
  assert.equal(same.meaningful, false);
  assert.equal(same.confirmed.intact, f.body.length);
  /* a reading that holds nothing is a failed read, never a mass delisting */
  const empty = two("events", [ev()], []);
  assert.equal(empty.meaningful, null);
  assert.deepEqual(empty.events, []);
});

/* ---------------------------------------------------------------- R13 */

test("R13 pure: no store, no network, no clock; the same input gives the same answer", () => {
  const saved = { fetch: globalThis.fetch, now: Date.now, Date: globalThis.Date };
  const boom = () => { throw new Error("touched"); };
  globalThis.fetch = boom;
  Date.now = boom;
  try {
    const c = fixCtx("events-3y");
    const a = parse(c), b = parse({ ...c });
    assert.deepEqual(a, b);
    assert.equal(detect(c).match, true);
    assert.deepEqual(assess(a, b).events, []);
    readPages([a, b]);
    nextPage(c.locator, a.page);
  } finally { globalThis.fetch = saved.fetch; Date.now = saved.now; }
});

/* ---------------------------------------------------------------- R14 */

test("R14 no place in code: any client is read from the address, and every marker and map comes from the view", () => {
  for (const client of ["portellery", "xyzzy-town", "a"]) {
    const p = parse({ locator: `https://webapi.legistar.com/v1/${client}/events`, text: JSON.stringify([ev()]), view: PORT });
    assert.equal(p.client, client);
  }
  const called = [ev({ EventBodyName: "Harbour Board - CALLED OFF" })];
  const none = parse({ locator: `${PE}/events`, text: JSON.stringify(called), view: { vocabulary: {} } }).rows[0];
  assert.deepEqual([none.facts.status, none.facts.organisation], [null, null]);
  assert.equal(parse(ctxOf(`${PE}/events`, called)).rows[0].facts.status, "cancelled");
  /* the first profile's words mean nothing under the test profile's view */
  const oak = parse(ctxOf(`${PE}/events`, [ev({ EventBodyName: "*Public Safety Committee - CANCELLED" })])).rows[0];
  assert.equal(oak.facts.status, null);
});

/* ---------------------------------------------------------------- R15 */

test("R15 every row is what the source states: nothing inferred, completed or corrected, and no row is never no meeting", () => {
  const p = parse(ctxOf(`${PE}/events`, [{ EventId: 4, EventBodyId: null, EventBodyName: null, EventDate: null, EventTime: null }]));
  assert.deepEqual([p.rows[0].facts.date, p.rows[0].facts.time, p.rows[0].facts.BodyId, p.rows[0].facts.status], [null, null, null, null]);
  const odd = parse(ctxOf(`${PE}/events`, [ev({ EventDate: "2026-02-03T19:30:00", EventTime: "7:30PM ish" })])).rows[0];
  assert.deepEqual([odd.facts.date, odd.facts.time], ["2026-02-03", "7:30PM ish"]);
  const seat = parse(ctxOf(`${PE}/officerecords`, [{ OfficeRecordId: 1, OfficeRecordStartDate: "1999", OfficeRecordEndDate: "" }])).rows[0];
  assert.deepEqual([seat.facts.start, seat.facts.end, seat.facts.PersonId, seat.facts.role], ["1999", null, null, null]);
  const v = parse(ctxOf(`${PE}/votes`, [{ VoteId: 1 }])).rows[0];
  assert.deepEqual(v.facts, { VoteId: 1, EventItemId: null, PersonId: null, value: null, result: null });
  const items = parse(ctxOf(`${PE}/eventitems`, [{ EventItemId: 1 }])).rows[0];
  assert.deepEqual([items.facts.mover, items.facts.seconder, items.facts.passed], [null, null, null]);
  for (const name of CAPTURES) assert.equal(parse(fixCtx(name)).rows.length, load(name).body.length);
  assert.deepEqual(parse(ctxOf(`${PE}/votes`, [])).rows, []);
});

/* ---------------------------------------------------------------- R16 */

const to24 = (t) => { const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(t.trim()); let h = Number(m[1]) % 12; if (m[3].toUpperCase() === "P") h += 12; return `${String(h).padStart(2, "0")}:${m[2]}`; };

test("R16 tested on captured fixtures with contact fields stripped; the 50 gold events' date and time agree with the gold set", () => {
  const gold = load("gold").events;
  assert.equal(gold.length, 50);
  let cancelled = 0;
  for (const g of gold) {
    const r = parse(fixCtx(`gold/${g.EventId}`)).rows[0];
    assert.equal(r.facts.EventId, g.EventId);
    assert.equal(r.facts.date, g.start.slice(0, 10), String(g.EventId));
    assert.equal(to24(r.facts.time), g.start.slice(11, 16), String(g.EventId));
    assert.equal(r.facts.status === "cancelled", g.kind === "cancelled", String(g.EventId));
    if (g.kind === "cancelled") cancelled++;
  }
  assert.equal(cancelled, 14);
  /* what R16 names is all here: bodies, persons, both office-record pages, three years of events */
  assert.equal(parse(fixCtx("bodies")).rows.length, load("bodies").body.length);
  assert.ok(load("persons").body.length > 0);
  assert.equal(parse(fixCtx("officerecords-0")).rows.length + parse(fixCtx("officerecords-1")).rows.length, 1262);
  const days = parse(fixCtx("events-3y")).rows.map((r) => r.facts.date).sort();
  assert.ok(days[0] >= "2023-10-01" && days[days.length - 1] < "2026-10-06" && days[0] < "2023-11-01" && days[days.length - 1] > "2026-09-01");
  /* no fixture holds a contact field */
  const files = readdirSync(FIX).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
    .concat(readdirSync(join(FIX, "gold")).map((f) => "gold/" + f.replace(/\.json$/, "")));
  const walk = (x, where) => {
    if (Array.isArray(x)) return x.forEach((y) => walk(y, where));
    if (!x || typeof x !== "object") return;
    for (const [k, y] of Object.entries(x)) { assert.equal(isContactField(k), false, `${where}: ${k}`); walk(y, where); }
  };
  for (const f of files) walk(load(f), f);
});
