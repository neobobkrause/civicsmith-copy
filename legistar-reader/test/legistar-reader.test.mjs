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
/** @import { Given, GivenList, Facts, LegistarContext, LegistarAssessment } from "../index.mjs" */
/** @import { PartialView } from "../../docprofile/registry.mjs" */

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
/**
 * A list as JSON.parse gives it.
 * @typedef {ReadonlyArray<unknown>} ParsedList
 */
/**
 * An object as JSON.parse gives it.
 * @typedef {{ readonly [field: string]: unknown }} ParsedObject
 */
/** @param {unknown} v @returns {v is ParsedList} */
const isParsedList = (v) => Array.isArray(v);
/** @param {unknown} v @returns {v is ParsedObject} */
const isParsedObject = (v) => typeof v === "object" && v !== null;
/** @param {Given | undefined} v @returns {v is GivenList} */
const isGivenList = (v) => Array.isArray(v);
/* A fixture's JSON as `Given`, each part checked as it is read. */
/** @param {unknown} v @returns {Given} */
const jsonOf = (v) => {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (isParsedList(v)) return v.map(jsonOf);
  if (!isParsedObject(v)) return null;
  /** @type {{ [field: string]: Given }} */
  const out = {};
  for (const [k, x] of Object.entries(v)) out[k] = jsonOf(x);
  return out;
};
/** @param {string} name @returns {Given} */
const loadJson = (name) => jsonOf(JSON.parse(readFileSync(join(FIX, name + ".json"), "utf8")));
/**
 * A captured fixture: its address, when it was taken, and the API's answer with contact fields removed.
 * @typedef {{ locator: string | null, captured_at: string | null, body: Given }} Fixture
 */
/** @param {string} name @returns {Fixture} */
const load = (name) => {
  const f = loadJson(name);
  if (f === null || typeof f !== "object" || isGivenList(f)) throw new Error(`${name} is not a captured fixture`);
  const { locator, captured_at, body } = f;
  return { locator: typeof locator === "string" ? locator : null, captured_at: typeof captured_at === "string" ? captured_at : null, body: body ?? null };
};
/* A list fixture's rows, each a source object. */
/** @param {string} name @returns {Facts[]} */
const bodyOf = (name) => {
  const body = load(name).body;
  /** @type {Facts[]} */
  const out = [];
  if (isGivenList(body)) for (const o of body) if (o !== null && typeof o === "object" && !isGivenList(o)) out.push(o);
  return out;
};
/* The 50 gold events of `gold.json`. */
/** @returns {Facts[]} */
const goldEvents = () => {
  const g = loadJson("gold");
  const events = g !== null && typeof g === "object" && !isGivenList(g) ? g.events : null;
  /** @type {Facts[]} */
  const out = [];
  if (isGivenList(events)) for (const o of events) if (o !== null && typeof o === "object" && !isGivenList(o)) out.push(o);
  return out;
};
/* The entry at `i`, which the test has made sure is there. */
/** @template T @param {ReadonlyArray<T>} list @param {number} i @returns {T} */
const at = (list, i) => {
  const x = list[i];
  if (x === undefined) throw new Error(`no entry ${i}`);
  return x;
};

/* The test profile's view: Port Ellery's clerk writes "CALLED OFF" for a cancelled meeting,
   "Extraordinary" for a special one and "Joint" for a concurrent one, and its harbour board
   meets under two names. None of these is a word of the first profile. */
/** @type {PartialView} */
const PORT = {
  vocabulary: {
    meeting_markers: [
      { marker: "cancelled", pattern: { re: "CALLED OFF", flags: "i" }, basis: "TEST", profile: "test-port-ellery", bases: [{ profile: "test-port-ellery", basis: "TEST" }] },
      { marker: "special", pattern: { re: "\\bExtraordinary\\b", flags: "i" }, basis: "TEST", profile: "test-port-ellery", bases: [{ profile: "test-port-ellery", basis: "TEST" }] },
      { marker: "concurrent", pattern: { re: "\\bJoint\\b", flags: "i" }, basis: "TEST", profile: "test-port-ellery", bases: [{ profile: "test-port-ellery", basis: "TEST" }] },
    ],
    body_variants: [
      { pattern: { re: "Harbou?r (?:Board|Commission)", flags: "i" }, organisation: "port-ellery-harbour-board", basis: "TEST", profile: "test-port-ellery", bases: [{ profile: "test-port-ellery", basis: "TEST" }] },
    ],
  },
};
/* For the captured Oakland events, the one marker R16's cancelled gold rows need, written here
   as test data (the first profile's own words are `jurisdictions`', T33-2). */
/** @type {PartialView} */
const CAPTURED = { vocabulary: { meeting_markers: [{ marker: "cancelled", pattern: { re: "CANCELL(?:ED|ATION)", flags: "i" }, basis: "TEST", profile: "test-port-ellery", bases: [{ profile: "test-port-ellery", basis: "TEST" }] }] } };

const PE = "https://webapi.legistar.com/v1/portellery";
/** @param {string} locator @param {unknown} body @param {{ at?: string }} [extra] @returns {LegistarContext} */
const ctxOf = (locator, body, extra = {}) => ({ locator, text: JSON.stringify(body), view: PORT, ...extra });
/** @param {string} name @returns {LegistarContext} */
const fixCtx = (name) => { const f = load(name); return { locator: f.locator, text: JSON.stringify(f.body), view: CAPTURED, at: f.captured_at }; };
const CAPTURES = ["bodies", "persons", "officerecords-0", "officerecords-1", "events-3y", "eventitems-9451",
  "votes-232591", "votes-232594", "votes-232608", "matters-2025-06"];

/* ---------------------------------------------------------------- R1 */

test("R1 detect matches every captured endpoint at CERTAIN, and a single record at its own address", () => {
  for (const name of CAPTURES) {
    const d = detect(fixCtx(name));
    assert.equal(d.match, true, name);
    assert.equal(d.confidence, CONFIDENCE.CERTAIN, name);
  }
  for (const id of goldEvents().map((e) => e.EventId)) {
    const d = detect(fixCtx(`gold/${String(id)}`));
    assert.equal(d.match, true, String(id));
    assert.equal(d.confidence, CONFIDENCE.CERTAIN);
  }
  for (const [endpoint, id] of [["bodies", "BodyId"], ["persons", "PersonId"], ["officerecords", "OfficeRecordId"], ["events", "EventId"],
    ["eventitems", "EventItemId"], ["votes", "VoteId"], ["matters", "MatterId"]]) {
    const d = detect(ctxOf(`${PE}/${endpoint}`, [{ [String(id)]: 7 }]));
    assert.equal(d.match, true, endpoint);
  }
});

test("R1 anything else does not match, and malformed JSON says why", () => {
  /** @param {LegistarContext} ctx @param {RegExp} re */
  const no = (ctx, re) => { const d = detect(ctx); assert.equal(d.match, false); assert.equal(d.confidence, CONFIDENCE.NONE); assert.match("why" in d ? d.why : "", re); };
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
  assert.equal(r.member?.key, KEY);
  assert.equal(r.confidence, CONFIDENCE.CERTAIN);
  assert.throws(() => registerLegistar(null), TypeError);
});

/* ---------------------------------------------------------------- R2 */

test("R2 parse gives endpoint, client, rows, page and facts; every row its kind, key, the source's ids, facts, index and system assertion", () => {
  for (const name of CAPTURES) {
    const f = load(name);
    const body = bodyOf(name);
    const p = parse(fixCtx(name));
    const addr = readAddress(f.locator);
    if ("why" in addr) assert.fail(addr.why);
    const spec = ENDPOINTS[addr.endpoint];
    assert.equal(p.endpoint, addr.endpoint);
    assert.equal(p.client, "oakland");
    assert.equal(p.rows.length, body.length, name);
    assert.equal(p.facts.count, body.length);
    assert.equal(p.facts.assertion, "system");
    assert.equal(p.facts.basis, BASIS);
    const page = p.page;
    assert.ok(page && Number.isInteger(page.skip));
    p.rows.forEach((r, i) => {
      const o = at(body, i);
      assert.equal(r.kind, spec.kind);
      assert.equal(r.key, `legistar:${spec.kind}:${String(o[spec.id])}`);
      assert.equal(r.source, i);
      assert.equal(r.assertion, "system");
      assert.equal(r.basis, "as recorded by Legistar");
      assert.equal(r.ids[spec.id], o[spec.id]);
      assert.ok(r.facts && typeof r.facts === "object");
    });
  }
  const seat = at(parse(fixCtx("officerecords-1")).rows, 0);
  const o = at(bodyOf("officerecords-1"), 0);
  assert.deepEqual(seat.ids, { OfficeRecordId: o.OfficeRecordId, PersonId: o.OfficeRecordPersonId, BodyId: o.OfficeRecordBodyId });
  const one = parse(fixCtx("gold/9016"));
  assert.equal(one.rows.length, 1);
  assert.equal(one.page, null);
  assert.equal(one.facts.record, 9016);
});

/* ---------------------------------------------------------------- R3 */

test("R3 no row carries a contact field: every named field and any field naming an e-mail, phone, fax, street or web address", () => {
  const values = new Map(/** @type {Array<[string, string]>} */ ([]));
  let n = 0;
  /** @param {string} field @returns {string} */
  const v = (field) => { const s = `contact-${field}-${++n}-zz9@example.invalid`; values.set(field, s); return s; };
  /** @type {{ [field: string]: Given }} */
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
  /** @param {Given} x @param {string} path @returns {void} */
  const walk = (x, path) => {
    if (isGivenList(x)) return x.forEach((y, i) => walk(y, path + "." + i));
    if (!x || typeof x !== "object") return;
    for (const [k, y] of Object.entries(x)) { assert.equal(isContactField(k), false, path + "." + k); walk(y, path + "." + k); }
  };
  for (const name of CAPTURES) walk(jsonOf(JSON.parse(JSON.stringify(parse(fixCtx(name)).rows))), name);
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
  /** @param {number} i */
  const f = (i) => at(rows, i).facts;
  assert.deepEqual([f(0).BodyId, f(0).name, f(0).type], [10, "Harbour Board", "Board"]);
  assert.deepEqual([f(0).status, f(0).meeting_kind, f(0).organisation, f(0).base], [null, null, "port-ellery-harbour-board", "Harbour Board"]);
  assert.deepEqual([f(1).BodyId, f(1).status, f(1).base, f(1).organisation], [11, "cancelled", "Harbour Board", "port-ellery-harbour-board"]);
  assert.deepEqual(at(rows, 1).markers, ["cancelled"]);
  assert.deepEqual([f(2).BodyId, f(2).meeting_kind, f(2).status, f(2).base], [12, "special", null, "Meeting of the Harbour Commission"]);
  assert.deepEqual([f(3).meeting_kind, f(3).base], ["concurrent", "Meeting of the Town Council and the Harbour Board"]);
  assert.deepEqual([f(4).organisation, f(4).meeting_kind, f(4).status], [null, null, null]);
  /* every captured body: a name carrying the view's cancellation word is cancelled, no other is */
  const captured = bodyOf("bodies");
  parse(fixCtx("bodies")).rows.forEach((r, i) => {
    const c = at(captured, i);
    assert.equal(r.facts.BodyId, c.BodyId);
    assert.equal(r.facts.name, c.BodyName);
    assert.equal(r.facts.type, c.BodyTypeName);
    assert.equal(r.facts.status, /CANCELL(?:ED|ATION)/i.test(String(c.BodyName)) ? "cancelled" : null);
  });
});

/* ---------------------------------------------------------------- R5 */

test("R5 persons: {PersonId, name, name_normal, active}; one folded name under two ids gives two rows naming each other", () => {
  const captured = bodyOf("persons");
  const rows = parse(fixCtx("persons")).rows;
  const folded = new Map(/** @type {Array<[Given | undefined, Array<Given | undefined>]>} */ ([]));
  rows.forEach((r, i) => {
    const o = at(captured, i);
    assert.deepEqual(Object.keys(r.facts).sort(), ["PersonId", "active", "name", "name_normal"]);
    assert.equal(r.facts.name, o.PersonFullName);
    assert.equal(r.facts.name_normal, String(o.PersonFullName).replace(/\s+/g, " ").trim());
    assert.equal(r.facts.active, o.PersonActiveFlag === 1);
    folded.set(r.facts.name_normal, [...(folded.get(r.facts.name_normal) || []), r.facts.PersonId]);
  });
  let pairs = 0;
  for (const r of rows) {
    const same = (folded.get(r.facts.name_normal) ?? []).filter((id) => id !== r.facts.PersonId);
    if (same.length) { pairs++; assert.deepEqual(r.same_name_as, same); } else assert.equal(r.same_name_as, undefined);
  }
  assert.ok(pairs >= 2, "the measured double-spaced duplicate is among the captured persons");
  const two = parse(ctxOf(`${PE}/persons`, [
    { PersonId: 5, PersonFullName: "Mara  Okafor", PersonActiveFlag: 1 }, { PersonId: 6, PersonFullName: "Mara Okafor", PersonActiveFlag: 0 }])).rows;
  assert.equal(two.length, 2);
  assert.deepEqual(at(two, 0).same_name_as, [6]);
  assert.deepEqual(at(two, 1).same_name_as, [5]);
  assert.equal(at(two, 0).facts.name, "Mara  Okafor");
});

/* ---------------------------------------------------------------- R6 */

test("R6 officerecords: seats only, {OfficeRecordId, PersonId, BodyId, role, start, end}; end null when absent, end_planned past the capture's date", () => {
  for (const name of ["officerecords-0", "officerecords-1"]) {
    const day = String(load(name).captured_at).slice(0, 10);
    const body = bodyOf(name);
    parse(fixCtx(name)).rows.forEach((r, i) => {
      const o = at(body, i);
      assert.deepEqual(Object.keys(r.facts).sort(), ["BodyId", "OfficeRecordId", "PersonId", "end", "role", "start"]);
      assert.equal(r.facts.role, o.OfficeRecordMemberType);
      assert.equal(r.facts.start, String(o.OfficeRecordStartDate).slice(0, 10));
      const end = o.OfficeRecordEndDate;
      assert.equal(r.facts.end, end ? String(end).slice(0, 10) : null);
      assert.equal(r.end_planned, r.facts.end !== null && String(r.facts.end) > day);
    });
  }
  const seat = { OfficeRecordId: 1, OfficeRecordPersonId: 2, OfficeRecordBodyId: 3, OfficeRecordMemberType: "Chair",
    OfficeRecordTitle: "Vice Mayor", OfficeRecordDistrict: "District 4", OfficeRecordFullName: "Ada Quill",
    OfficeRecordStartDate: "2025-01-06T00:00:00", OfficeRecordEndDate: "2029-01-01T00:00:00" };
  const r = at(parse(ctxOf(`${PE}/officerecords`, [seat], { at: "2026-10-05T12:00:00Z" })).rows, 0);
  assert.equal(r.facts.end, "2029-01-01");
  assert.equal(r.end_planned, true);
  assert.equal(JSON.stringify(r).includes("Vice Mayor") || JSON.stringify(r).includes("District 4"), false);
  const u = at(parse(ctxOf(`${PE}/officerecords`, [seat])).rows, 0);
  assert.equal(u.end_planned, null);
  assert.match(u.end_planned_why ?? "", /date was not given/);
  const open = at(parse(ctxOf(`${PE}/officerecords`, [{ ...seat, OfficeRecordEndDate: undefined }], { at: "2026-10-05" })).rows, 0);
  assert.equal(open.facts.end, null);
  assert.equal(open.end_planned, false);
});

/* ---------------------------------------------------------------- R7 */

const EVENT_FACTS = ["BodyId", "EventId", "agenda_file", "agenda_last_published", "agenda_status", "body", "date", "in_site",
  "meeting_kind", "minutes_file", "minutes_last_published", "minutes_status", "organisation", "status", "time"].sort();

test("R7 events: each field as given, date the EventDate's day and time EventTime as written, never joined; a cancelled body gives one cancelled event", () => {
  const body = bodyOf("events-3y");
  const rows = parse(fixCtx("events-3y")).rows;
  assert.equal(rows.length, body.length);
  let cancelled = 0;
  rows.forEach((r, i) => {
    const o = at(body, i);
    assert.deepEqual(Object.keys(r.facts).sort(), EVENT_FACTS);
    assert.equal(r.facts.EventId, o.EventId);
    assert.equal(r.facts.BodyId, o.EventBodyId);
    assert.equal(r.facts.body, o.EventBodyName);
    assert.equal(r.facts.date, String(o.EventDate).slice(0, 10));
    assert.equal(r.facts.time, o.EventTime);
    assert.equal(r.facts.agenda_status, o.EventAgendaStatusName);
    assert.equal(r.facts.minutes_status, o.EventMinutesStatusName);
    assert.equal(r.facts.agenda_file, o.EventAgendaFile);
    assert.equal(r.facts.minutes_file, o.EventMinutesFile);
    assert.equal(r.facts.in_site, o.EventInSiteURL);
    const c = /CANCELL(?:ED|ATION)/i.test(String(o.EventBodyName));
    assert.equal(r.facts.status, c ? "cancelled" : null);
    if (c) cancelled++;
  });
  assert.ok(cancelled > 0);
  const one = parse(ctxOf(`${PE}/events`, [{ EventId: 1, EventBodyId: 11, EventBodyName: "Harbour Board - CALLED OFF",
    EventDate: "2026-02-03T00:00:00", EventTime: "6:00 PM" }])).rows;
  assert.equal(one.length, 1);
  const first = at(one, 0);
  assert.deepEqual([first.facts.status, first.facts.date, first.facts.time, first.facts.organisation],
    ["cancelled", "2026-02-03", "6:00 PM", "port-ellery-harbour-board"]);
});

/* ---------------------------------------------------------------- R8 */

test("R8 the last-published times are UTC instants, each with its label", () => {
  const body = bodyOf("events-3y");
  parse(fixCtx("events-3y")).rows.forEach((r, i) => {
    const o = at(body, i);
    /** @type {Array<[string, string]>} */
    const pairs = [["agenda_last_published", "EventAgendaLastPublishedUTC"], ["minutes_last_published", "EventMinutesLastPublishedUTC"]];
    for (const [k, src] of pairs) {
      if (o[src] == null) { assert.equal(r.facts[k], null); continue; }
      assert.equal(r.facts[k], String(o[src]) + "Z");
      assert.ok(!Number.isNaN(Date.parse(String(r.facts[k]))));
    }
    assert.deepEqual(r.labels, { agenda_last_published: PUBLISHED_LABEL, minutes_last_published: PUBLISHED_LABEL });
  });
  assert.match(PUBLISHED_LABEL, /upper bound/);
});

/* ---------------------------------------------------------------- R9 */

test("R9 eventitems and votes as the source names them", () => {
  const items = bodyOf("eventitems-9451");
  /* who the source names, as R9 reads it: a PersonId where given, else the name as text */
  /** @param {Given | undefined} id @param {Given | undefined} nm @returns {Facts | null} */
  const person = (id, nm) => {
    if (id != null) {
      /** @type {Facts} */
      const p = { PersonId: id };
      return p;
    }
    if (nm) {
      /** @type {Facts} */
      const w = { name: nm };
      return w;
    }
    return null;
  };
  parse(fixCtx("eventitems-9451")).rows.forEach((r, i) => {
    const o = at(items, i);
    assert.deepEqual(Object.keys(r.facts).sort(),
      ["EventId", "EventItemId", "MatterFile", "MatterId", "action", "agenda_number", "mover", "passed", "seconder", "title"]);
    assert.deepEqual([r.facts.EventItemId, r.facts.EventId, r.facts.agenda_number, r.facts.MatterId, r.facts.MatterFile, r.facts.title, r.facts.action],
      [o.EventItemId, o.EventItemEventId, o.EventItemAgendaNumber, o.EventItemMatterId, o.EventItemMatterFile, o.EventItemTitle, o.EventItemActionName]);
    assert.equal(r.facts.passed, o.EventItemPassedFlag === null ? null : o.EventItemPassedFlag === 1);
    /** @type {Array<[string, string, string]>} */
    const who = [["mover", "EventItemMoverId", "EventItemMover"], ["seconder", "EventItemSeconderId", "EventItemSeconder"]];
    for (const [k, id, nm] of who)
      assert.deepEqual(r.facts[k], person(o[id], o[nm]));
  });
  const named = at(parse(ctxOf(`${PE}/eventitems`, [{ EventItemId: 9, EventItemEventId: 1, EventItemMoverId: null,
    EventItemMover: "Councilmember Quill", EventItemSeconderId: 44, EventItemSeconder: "Okafor", EventItemPassedFlag: 0 }])).rows, 0);
  assert.deepEqual(named.facts.mover, { name: "Councilmember Quill" });
  assert.deepEqual(named.facts.seconder, { PersonId: 44 });
  assert.equal(named.facts.passed, false);
  for (const name of ["votes-232594", "votes-232608"]) {
    const votes = bodyOf(name);
    assert.ok(votes.length > 0);
    parse(fixCtx(name)).rows.forEach((r, i) => {
      const o = at(votes, i);
      assert.deepEqual(r.facts, { VoteId: o.VoteId, EventItemId: o.VoteEventItemId, PersonId: o.VotePersonId, value: o.VoteValueName, result: o.VoteResult });
    });
  }
});

/* ---------------------------------------------------------------- R10 */

test("R10 matters' enactment fields; a null enactment date stays null, never filled from the passed date", () => {
  const ms = bodyOf("matters-2025-06");
  let unfilled = 0;
  parse(fixCtx("matters-2025-06")).rows.forEach((r, i) => {
    const o = at(ms, i);
    /** @param {Given | undefined} v */
    const day = (v) => (v == null ? null : String(v).slice(0, 10));
    const enactment = r.facts.enactment_date;
    assert.deepEqual(r.facts, { MatterId: o.MatterId, MatterFile: o.MatterFile, type: o.MatterTypeName, status: o.MatterStatusName,
      intro_date: day(o.MatterIntroDate), passed_date: day(o.MatterPassedDate), enactment_number: o.MatterEnactmentNumber,
      enactment_date: day(o.MatterEnactmentDate) });
    const unenacted = o.MatterEnactmentDate == null, passed = o.MatterPassedDate != null;
    if (unenacted && passed) { unfilled++; assert.equal(enactment, null); }
  });
  assert.ok(unfilled > 0, "the capture holds a passed matter with no enactment date");
});

/* ---------------------------------------------------------------- R11 */

test("R11 a full page may continue and names the next; a short page does not; pages join by key with conflicts reported", () => {
  const p0 = parse(fixCtx("officerecords-0"));
  const p1 = parse(fixCtx("officerecords-1"));
  assert.equal(p0.rows.length, 1000);
  const page0 = p0.page, page1 = p1.page, next0 = page0?.next;
  assert.deepEqual([page0?.skip, page0?.top, page0?.may_continue], [0, 1000, true]);
  assert.equal(next0, "https://webapi.legistar.com/v1/oakland/officerecords?$top=1000&$skip=1000");
  assert.equal(nextPage(load("officerecords-0").locator, page0), next0);
  assert.deepEqual([page1?.skip, page1?.top, page1?.may_continue, page1?.next], [1000, 1000, false, null]);
  assert.equal(nextPage(load("officerecords-1").locator, page1), null);
  assert.equal(nextPage(`${PE}/persons`), `${PE}/persons?$skip=1000`);
  const ev = load("events-3y").locator;
  assert.equal(nextPage(ev), String(ev) + "&$skip=1000");
  assert.equal(nextPage(`${PE}/events?$skip=2000&$filter=x`), `${PE}/events?$skip=3000&$filter=x`);
  assert.equal(nextPage(`${PE}/events/12`), null);
  assert.equal(nextPage("https://example.org/x"), null);
  const all = readPages([p0, p1]);
  assert.equal(all.rows.length, 1262);
  assert.equal(new Set(all.rows.map((r) => r.key)).size, 1262);
  assert.deepEqual([all.pages, all.complete, all.conflicts.length], [2, true, 0]);
  const partial = readPages([p0]);
  assert.equal(partial.complete, false);
  assert.match(partial.why ?? "", /further page/);
  const a = parse(ctxOf(`${PE}/persons`, [{ PersonId: 1, PersonFullName: "Ada Quill" }, { PersonId: 2, PersonFullName: "B" }]));
  const b = parse(ctxOf(`${PE}/persons?$skip=1000`, [{ PersonId: 1, PersonFullName: "Ada Quill-Okafor" }, { PersonId: 2, PersonFullName: "B" }]));
  const j = readPages([a, b]);
  assert.equal(j.rows.length, 2);
  assert.equal(j.conflicts.length, 1);
  assert.equal(at(j.conflicts, 0).key, "legistar:person:1");
  assert.equal(at(j.rows, 0).facts.name, "Ada Quill");
  const other = readPages([a, parse(ctxOf(`${PE}/bodies`, [{ BodyId: 1, BodyName: "X" }]))]);
  assert.equal(other.rows.length, 2);
  assert.equal(other.refused.length, 1);
});

/* ---------------------------------------------------------------- R12 */

/** @param {Facts} [o] */
const ev = (o) => ({ EventId: 1, EventBodyId: 10, EventBodyName: "Harbour Board", EventDate: "2026-02-03T00:00:00", EventTime: "6:00 PM",
  EventAgendaStatusName: "FINAL", EventMinutesStatusName: null, EventAgendaFile: null, EventMinutesFile: null,
  EventAgendaLastPublishedUTC: null, EventMinutesLastPublishedUTC: null, EventInSiteURL: "https://portellery.legistar.com/M.aspx?ID=1", ...o });
/** @param {string} endpoint @param {unknown} before @param {unknown} after */
const two = (endpoint, before, after) => assess(parse(ctxOf(`${PE}/${endpoint}`, before)), parse(ctxOf(`${PE}/${endpoint}`, after)));
/** @param {LegistarAssessment} r */
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
  /** @param {string} v */
  const vote = (v) => [{ VoteId: 1, VoteEventItemId: 2, VotePersonId: 3, VoteValueName: v, VoteResult: 1 }];
  assert.deepEqual(types(two("votes", vote("Aye"), vote("No"))), ["outcome_changed"]);
  /** @param {number} p */
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
  const confirmed = r.confirmed;
  assert.ok(confirmed === null || Number.isInteger(confirmed.intact));
  /* key order and white space in the JSON give nothing */
  const f = load("events-3y");
  const reordered = bodyOf("events-3y").map((o) => Object.fromEntries(Object.entries(o).reverse()));
  const same = assess(parse(fixCtx("events-3y")),
    parse({ locator: f.locator, text: JSON.stringify(reordered, null, 3), view: CAPTURED, at: f.captured_at }));
  assert.deepEqual(same.events, []);
  assert.equal(same.meaningful, false);
  assert.equal(same.confirmed?.intact, reordered.length);
  /* a reading that holds nothing is a failed read, never a mass delisting */
  const empty = two("events", [ev()], []);
  assert.equal(empty.meaningful, null);
  assert.deepEqual(empty.events, []);
});

/* ---------------------------------------------------------------- R13 */

test("R13 pure: no store, no network, no clock; the same input gives the same answer", (t) => {
  const boom = () => { throw new Error("touched"); };
  t.mock.method(globalThis, "fetch", boom);
  t.mock.method(Date, "now", boom);
  const c = fixCtx("events-3y");
  const a = parse(c), b = parse({ ...c });
  assert.deepEqual(a, b);
  assert.equal(detect(c).match, true);
  assert.deepEqual(assess(a, b).events, []);
  readPages([a, b]);
  nextPage(c.locator, a.page);
});

/* ---------------------------------------------------------------- R14 */

test("R14 no place in code: any client is read from the address, and every marker and map comes from the view", () => {
  for (const client of ["portellery", "xyzzy-town", "a"]) {
    const p = parse({ locator: `https://webapi.legistar.com/v1/${client}/events`, text: JSON.stringify([ev()]), view: PORT });
    assert.equal(p.client, client);
  }
  const called = [ev({ EventBodyName: "Harbour Board - CALLED OFF" })];
  const none = at(parse({ locator: `${PE}/events`, text: JSON.stringify(called), view: { vocabulary: {} } }).rows, 0);
  assert.deepEqual([none.facts.status, none.facts.organisation], [null, null]);
  assert.equal(at(parse(ctxOf(`${PE}/events`, called)).rows, 0).facts.status, "cancelled");
  /* the first profile's words mean nothing under the test profile's view */
  const oak = at(parse(ctxOf(`${PE}/events`, [ev({ EventBodyName: "*Public Safety Committee - CANCELLED" })])).rows, 0);
  assert.equal(oak.facts.status, null);
});

/* ---------------------------------------------------------------- R15 */

test("R15 every row is what the source states: nothing inferred, completed or corrected, and no row is never no meeting", () => {
  const p = parse(ctxOf(`${PE}/events`, [{ EventId: 4, EventBodyId: null, EventBodyName: null, EventDate: null, EventTime: null }]));
  const row = at(p.rows, 0);
  assert.deepEqual([row.facts.date, row.facts.time, row.facts.BodyId, row.facts.status], [null, null, null, null]);
  const odd = at(parse(ctxOf(`${PE}/events`, [ev({ EventDate: "2026-02-03T19:30:00", EventTime: "7:30PM ish" })])).rows, 0);
  assert.deepEqual([odd.facts.date, odd.facts.time], ["2026-02-03", "7:30PM ish"]);
  const seat = at(parse(ctxOf(`${PE}/officerecords`, [{ OfficeRecordId: 1, OfficeRecordStartDate: "1999", OfficeRecordEndDate: "" }])).rows, 0);
  assert.deepEqual([seat.facts.start, seat.facts.end, seat.facts.PersonId, seat.facts.role], ["1999", null, null, null]);
  const v = at(parse(ctxOf(`${PE}/votes`, [{ VoteId: 1 }])).rows, 0);
  assert.deepEqual(v.facts, { VoteId: 1, EventItemId: null, PersonId: null, value: null, result: null });
  const items = at(parse(ctxOf(`${PE}/eventitems`, [{ EventItemId: 1 }])).rows, 0);
  assert.deepEqual([items.facts.mover, items.facts.seconder, items.facts.passed], [null, null, null]);
  for (const name of CAPTURES) assert.equal(parse(fixCtx(name)).rows.length, bodyOf(name).length);
  assert.deepEqual(parse(ctxOf(`${PE}/votes`, [])).rows, []);
});

/* ---------------------------------------------------------------- R16 */

/** @param {Given | undefined} t @returns {string} */
const to24 = (t) => {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(String(t).trim());
  if (!m) throw new Error(`not a clock time: ${String(t)}`);
  let h = Number(m[1]) % 12; if ((m[3] ?? "").toUpperCase() === "P") h += 12; return `${String(h).padStart(2, "0")}:${m[2] ?? ""}`;
};

test("R16 tested on captured fixtures with contact fields stripped; the 50 gold events' date and time agree with the gold set", () => {
  const gold = goldEvents();
  assert.equal(gold.length, 50);
  let cancelled = 0;
  for (const g of gold) {
    const r = at(parse(fixCtx(`gold/${String(g.EventId)}`)).rows, 0);
    assert.equal(r.facts.EventId, g.EventId);
    assert.equal(r.facts.date, String(g.start).slice(0, 10), String(g.EventId));
    assert.equal(to24(r.facts.time), String(g.start).slice(11, 16), String(g.EventId));
    assert.equal(r.facts.status === "cancelled", g.kind === "cancelled", String(g.EventId));
    if (g.kind === "cancelled") cancelled++;
  }
  assert.equal(cancelled, 14);
  /* what R16 names is all here: bodies, persons, both office-record pages, three years of events */
  assert.equal(parse(fixCtx("bodies")).rows.length, bodyOf("bodies").length);
  assert.ok(bodyOf("persons").length > 0);
  assert.equal(parse(fixCtx("officerecords-0")).rows.length + parse(fixCtx("officerecords-1")).rows.length, 1262);
  const days = parse(fixCtx("events-3y")).rows.map((r) => String(r.facts.date)).sort();
  const firstDay = days[0] ?? "", lastDay = days[days.length - 1] ?? "";
  assert.ok(firstDay >= "2023-10-01" && lastDay < "2026-10-06" && firstDay < "2023-11-01" && lastDay > "2026-09-01");
  /* no fixture holds a contact field */
  const files = readdirSync(FIX).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
    .concat(readdirSync(join(FIX, "gold")).map((f) => "gold/" + f.replace(/\.json$/, "")));
  /** @param {Given} x @param {string} where @returns {void} */
  const walk = (x, where) => {
    if (isGivenList(x)) return x.forEach((y) => walk(y, where));
    if (!x || typeof x !== "object") return;
    for (const [k, y] of Object.entries(x)) { assert.equal(isContactField(k), false, `${where}: ${k}`); walk(y, where); }
  };
  for (const f of files) walk(loadJson(f), f);
});
