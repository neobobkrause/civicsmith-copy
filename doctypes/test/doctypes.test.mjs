/* doctypes — requirement-named tests for the seven types (R1–R8, R18, R20–R24), at the
 * module's interface: `doctypes/index.mjs`. The types are read the way docprofile reads
 * them, through a registry `registerDoctypes` filled (./read.mjs), and every type is read
 * under made-up profiles that are not the first profile (R20): Port Alder and Lakemont in
 * ./fixtures.mjs. The regulation reader's sections, definitions and exceptions (R9–R19) are
 * in ./regulation-sections.test.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as dt from "../index.mjs";
import { CONFIDENCE, EVENTS, SIGNIFICANCE, event, worstSignificance } from "../../site-profiles/index.mjs";
import { CONTRACT } from "../../docprofile/doctypes/index.mjs";
import { flattenText, makeLocator } from "../../docprofile/readtext.mjs";
import { combine, list } from "../../jurisdictions/index.mjs";
import {
  PORT_ALDER, LAKEMONT, view, EMPTY, HELD, PE, PE_POLICY, PA_AGENDA, PA_MINUTES, PA_REPORT, PA_BYLAW, PA_DIRECTORY, calendarHtml,
} from "./fixtures.mjs";
import { CASES, pairsOf } from "./golden-cases.mjs";
import { registryOf, readWith, typeFor } from "./read.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** @import { ContentType, Connection, Entity, ReaderView, SuppliedPage, SuppliedText } from "../../docprofile/doctypes/index.mjs" */
/** @import { Practice, Weekend, Holiday } from "../../jurisdictions/index.mjs" */
/** @import { EventHead } from "../../site-profiles/index.mjs" */
/** @import { CaseContext, TypedReading } from "./golden-cases.mjs" */
/** @import { MeetingCalendarType } from "../meeting-calendar.mjs" */
/** @import { MeetingMinutesType } from "../meeting-minutes.mjs" */
/** @import { MeetingAgendaType } from "../meeting-agenda.mjs" */
/** @import { StaffReportType } from "../staff-report.mjs" */
/** @import { RegulationType } from "../regulation.mjs" */
/** @import { PolicyType } from "../policy.mjs" */
/** @import { StaffDirectoryType } from "../staff-directory.mjs" */
/** @import { GenericType } from "../generic.mjs" */

/**
 * One of the module's eight types under its own kind, as `doctypes/index.mjs` names it.
 * @typedef {MeetingCalendarType | MeetingMinutesType | MeetingAgendaType | StaffReportType | RegulationType | PolicyType | StaffDirectoryType | GenericType} OwnType
 */
/**
 * A case's reading as the tests hold it: the type that read it, under its own kind, the reading, and the context.
 * @typedef {Object} HeldReading
 * @property {OwnType} t
 * @property {object} p
 * @property {CaseContext} ctx
 */
/**
 * One case's verdict in the golden file: the type, how sure, on what, what else, and the reading as JSON.
 * @typedef {Object} GoldenVerdict
 * @property {string} type
 * @property {string} confidence
 * @property {unknown} signals
 * @property {unknown} also
 * @property {unknown} parsed
 */
/**
 * One pair's assessment in the golden file: its events and whether it was meaningful, as JSON.
 * @typedef {Object} GoldenAssessment
 * @property {unknown} events
 * @property {unknown} meaningful
 */
/**
 * The golden file, `fixtures/docprofile-verdicts.json`: every case's verdict by its id, every pair's assessment by
 * `<id>|<id>`.
 * @typedef {Object} GoldenFile
 * @property {{ [id: string]: GoldenVerdict }} readings
 * @property {{ [pair: string]: GoldenAssessment }} assess
 */
/**
 * What every type's `assess` answers, as R5 reads it: whether the change means something, its events and why.
 * @typedef {{ readonly meaningful: boolean | null, readonly events: ReadonlyArray<EventHead>, readonly why: string }} Assessed
 */
/**
 * A reading as R5's change reads it: its entities' facts, and three facts of its own a type may hold.
 * @typedef {Object} Changeable
 * @property {Array<{ facts?: object | null | undefined }> | null | undefined} [entities]
 * @property {unknown} [title]
 * @property {unknown} [recommendation]
 * @property {unknown} [number]
 */
/**
 * The position the R7 locator hands back: a page that is the offset itself.
 * @typedef {Object} OffsetPage
 * @property {"pdf-page"} kind
 * @property {string} ref
 * @property {number} page
 * @property {null} rect
 */

const { DOCTYPES, registerDoctypes } = dt;
const PA = view(PORT_ALDER);
const LK = view(LAKEMONT);
const REG = (() => { const r = registryOf([]); registerDoctypes(r.register); return r; })();
/** The module's eight types under their own kinds, in R1's order. @type {ReadonlyArray<OwnType>} */
const OWN = [dt.meetingCalendar, dt.meetingMinutes, dt.meetingAgenda, dt.staffReport, dt.regulation, dt.policy, dt.staffDirectory,
             dt.generic];
/** The type DOCTYPES holds under `key`, which is the module's named type `handle` itself, read through its own kind.
 *  @template {OwnType} T
 *  @param {string} key
 *  @param {T} handle
 *  @returns {T}
 *  @throws {TypeError} when DOCTYPES holds no type under `key`, or another than `handle` */
const typeOf = (key, handle) => {
  const t = DOCTYPES.find((x) => x.key === key);
  if (t === undefined) throw new TypeError(`DOCTYPES holds no type ${key}`);
  if (t !== handle) throw new TypeError(`DOCTYPES' ${key} is not the module's named type`);
  return handle;
};
/** A type DOCTYPES holds (or a registry found), under its own kind: the module's named type that it is.
 *  @param {ContentType | undefined} t
 *  @returns {OwnType}
 *  @throws {TypeError} when `t` is none of the module's eight types */
const own = (t) => {
  const o = OWN.find((x) => x === t);
  if (o === undefined) throw new TypeError(`${t ? t.key : t} is none of the module's named types`);
  return o;
};
/** One of the module's types, read as any of them. @param {OwnType} t @returns {OwnType} */
const anyOwn = (t) => t;
/** @param {{ readonly entities: ReadonlyArray<Entity> }} r @returns {string[]} */
const keys = (r) => r.entities.map((e) => e.key);
/** A text an assertion then matches: a missing one fails here, as matching it would have failed.
 *  @param {string | null | undefined} s
 *  @returns {string} */
const said = (s) => { assert.ok(typeof s === "string", "a text to match"); return s; };
/** The connection of `relation` among `conns`; there must be one, as reading it would have needed.
 *  @param {ReadonlyArray<Connection>} conns
 *  @param {string} relation
 *  @returns {Connection} */
const connection = (conns, relation) => {
  const c = conns.find((x) => x.relation === relation);
  assert.ok(c !== undefined, `a ${relation} connection`);
  return c;
};
/** A connection's `expected_by`, read as before: a temporal connection's, and nothing of a referential one.
 *  @param {Connection} c
 *  @returns {string | null | undefined} */
const expectedBy = (c) => ("expected_by" in c ? c.expected_by : undefined);
/** A list of values of no stated kind. @typedef {ReadonlyArray<unknown>} UnknownList */
/** Whether a value is a list. @param {unknown} v @returns {v is UnknownList} */
const isList = (v) => Array.isArray(v);
/** Whether a reading's entities, where it has any, are a list of objects whose facts are objects, as R5's change
 *  reads them.
 *  @param {object} x
 *  @returns {x is Changeable} */
const changeable = (x) => {
  const entities = "entities" in x ? x.entities : undefined;
  if (!entities) return true;
  return isList(entities) && entities.every((e) => {
    if (typeof e !== "object" || e === null) return false;
    const facts = "facts" in e ? e.facts : undefined;
    return facts === undefined || typeof facts === "object";
  });
};
/** The golden file, decoded (R2: this module's own fixture). @returns {GoldenFile} */
const readGolden = () => /** @type {GoldenFile} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/docprofile-verdicts.json", import.meta.url), "utf8")));
const NOW = "2026-03-20T12:00:00Z";
const ORDER = ["meeting_calendar", "meeting_minutes", "meeting_agenda", "staff_report", "regulation", "policy", "staff_directory", "generic"];

/* ------------------------------------------------------------------ R1, R2 */

test("R1 DOCTYPES lists the eight types in registration order, generic alone the fallback", () => {
  assert.deepEqual(DOCTYPES.map((t) => t.key), ORDER);
  assert.deepEqual(DOCTYPES.filter((t) => t.fallback === true).map((t) => t.key), ["generic"]);
  for (const t of DOCTYPES) if (t.key !== "generic") assert.notEqual(t.fallback, true, t.key);
  assert.ok(Object.isFrozen(DOCTYPES), "the order is not a list a caller edits");
  // the order decides: minutes and an agenda both certain, the minutes (earlier) win
  const both = PA_MINUTES + "\n" + PA_AGENDA;
  assert.equal(typeFor(REG, { text: both, view: PA }).type?.key, "meeting_minutes");
  /** @type {ReadonlyArray<"key" | "label" | "version" | "contract" | "detect" | "parse" | "assess">} */
  const members = ["key", "label", "version", "contract", "detect", "parse", "assess"];
  for (const t of DOCTYPES) for (const f of members)
    assert.ok(t[f] !== undefined, `${t.key}.${f}`);
});

test("R2 registerDoctypes calls register once per type in R1's order, and registers nothing the second time", () => {
  /** @type {string[]} */
  const seen = [];
  /** @param {ContentType} m */
  const reg = (m) => { seen.push(m.key); };
  const first = registerDoctypes(reg);
  assert.deepEqual(seen, ORDER);
  assert.equal(first.registered, 8);
  const again = registerDoctypes(reg);
  assert.equal(again.registered, 0);
  assert.match(said(again.why), /already/);
  assert.deepEqual(seen, ORDER, "nothing more registered");
  // a real registry, by its register function and then whole: still eight, once each
  const r = registryOf([]);
  registerDoctypes(r.register);
  registerDoctypes(r);
  registerDoctypes(r.register);
  assert.deepEqual(r.all().map((m) => m.key), ORDER);
  // the registry whole first, then its function
  const r2 = registryOf([]);
  registerDoctypes(r2);
  registerDoctypes(r2.register);
  assert.deepEqual(r2.all().map((m) => m.key), ORDER);
  // a registry already holding some keeps them and gains the rest, still never twice
  const r3 = registryOf([]);
  const head = DOCTYPES[0];
  assert.ok(head !== undefined);
  r3.register(head);
  assert.equal(registerDoctypes(r3).registered, 7);
  assert.deepEqual(r3.all().map((m) => m.key), ORDER);
  assert.throws(() => registerDoctypes(null), TypeError);
  // what docprofile's registry needs: the fallback answers when nothing is recognised
  assert.equal(REG.recognise({ text: "a letter about nothing", view: PA }).member?.key, "generic");
});

/* ---------------------------------------------------------------------- R3 */

test("R3 every type takes its local facts from ctx.view, and with no view from every non-test held profile", () => {
  const lkAgenda = PA_AGENDA.replace(/PA-(\d{3})/g, "LK00$1").replace(/Harbor Commission/g, "Lakemont Council")
    .replace(/Town of Port Alder/g, "City of Lakemont");
  /** No view given is no `view` in the context (`undefined` read as absent).
   *  @param {string} t @param {ReaderView | undefined} v */
  const ag = (t, v) => {
    if (v === undefined) return typeOf("meeting_agenda", dt.meetingAgenda).parse({ text: t });
    return typeOf("meeting_agenda", dt.meetingAgenda).parse({ text: t, view: v });
  };
  assert.deepEqual(keys(ag(PA_AGENDA, PA)), ["PA-101", "PA-102", "PA-103"]);
  assert.deepEqual(keys(ag(PA_AGENDA, LK)), []);
  assert.deepEqual(keys(ag(lkAgenda, LK)), ["LK00101", "LK00102", "LK00103"]);
  assert.equal(ag(PA_AGENDA, PA).body, "Harbor Commission");
  assert.equal(ag(PA_AGENDA, LK).body, null);

  /** @param {ReaderView} v */
  const mins = (v) => typeOf("meeting_minutes", dt.meetingMinutes).parse({ text: PA_MINUTES, view: v });
  assert.deepEqual(keys(mins(PA)), ["PA-101", "PA-103"]);
  assert.deepEqual(keys(mins(LK)), []);
  assert.equal(mins(LK).body, null);

  /** @param {string} t @param {ReaderView} v */
  const rep = (t, v) => typeOf("staff_report", dt.staffReport).parse({ text: t, view: v });
  assert.deepEqual(keys(rep(PA_REPORT, PA)).sort(), ["bylaw:2041", "file:PA-117", "order:1990", "pac:4.12"]);
  assert.deepEqual(keys(rep(PA_REPORT, LK)), []);
  assert.equal(typeOf("staff_report", dt.staffReport).detect({ text: PA_REPORT, view: LK }).match, false);

  /** @param {ReaderView} v */
  const reg = (v) => typeOf("regulation", dt.regulation).parse({ text: PA_BYLAW, view: v });
  assert.equal(reg(PA).instrument, "bylaw");
  assert.deepEqual(keys(reg(PA)).sort(), ["order:1990", "pac:4.12"]);
  assert.equal(reg(LK).title, null);
  // the code's section forms too: Port Alder's code read under its own view only
  const pa = PA;
  const code = "4-12 Mooring fees.\n(a)\nFees are set by order.";
  assert.equal(typeOf("regulation", dt.regulation).parse({ text: code, view: pa }).form, "code");
  assert.equal(typeOf("regulation", dt.regulation).parse({ text: code, view: LK }).form, null);

  // the calendar's practice threshold, the view's
  const cal = typeOf("meeting_calendar", dt.meetingCalendar);
  const parsed = cal.parse({ text: calendarHtml([["7", "Harbor Commission", "3/2/2026"]]) });
  /** @param {ReaderView} v */
  const due = (v) => expectedBy(connection(cal.connections(parsed, parsed, { now: NOW, view: v }), "minutes_not_yet_published"));
  assert.equal(due(PA), "2026-03-12");
  assert.equal(due(LK), "2026-04-01");
  assert.equal(due(EMPTY), null);

  // the directory holds no local vocabulary at all
  /** @param {ReaderView} v */
  const d = (v) => keys(typeOf("staff_directory", dt.staffDirectory).parse({ text: PA_DIRECTORY, view: v }));
  assert.deepEqual(d(PA), d(LK));
  assert.deepEqual(d(PA), d(EMPTY));

  // no view: every NON-TEST held profile, combined; never a test profile
  const combined = combine(list().filter((x) => !x.test).map((x) => x.id));
  const held = combined.ok ? combined.view : undefined;
  const legacy = PA_AGENDA.replace(/PA-(\d)(\d\d)/g, "26-0$1$2");
  assert.deepEqual(keys(ag(legacy, undefined)), keys(ag(legacy, held)));
  assert.deepEqual(keys(ag(legacy, undefined)), ["26-0101", "26-0102", "26-0103"]);
  assert.deepEqual(keys(ag(legacy, EMPTY)), []);
  assert.deepEqual(keys(ag(PA_AGENDA.replace(/PA-(\d{3})/g, "M$1/26"), undefined)), [], "a test profile is never the fallback");
});

/* ---------------------------------------------------------------------- R4 */

test("R4 each type declares a contract, SUBSTANCE or MEMBERSHIP, generic SUBSTANCE", () => {
  const want = new Map([
    ["meeting_calendar", /** @copyof docprofile:CONTRACT.MEMBERSHIP */ ("membership")],
    ["meeting_agenda", /** @copyof docprofile:CONTRACT.MEMBERSHIP */ ("membership")],
    ["meeting_minutes", /** @copyof docprofile:CONTRACT.MEMBERSHIP */ ("membership")],
    ["staff_directory", /** @copyof docprofile:CONTRACT.MEMBERSHIP */ ("membership")],
    ["staff_report", /** @copyof docprofile:CONTRACT.SUBSTANCE */ ("substance")],
    ["regulation", /** @copyof docprofile:CONTRACT.SUBSTANCE */ ("substance")],
    ["policy", /** @copyof docprofile:CONTRACT.SUBSTANCE */ ("substance")],
    ["generic", /** @copyof docprofile:CONTRACT.SUBSTANCE */ ("substance")]]);
  /** @type {ReadonlyArray<string | undefined>} */
  const contracts = [CONTRACT.SUBSTANCE, CONTRACT.MEMBERSHIP];
  for (const t of DOCTYPES) {
    assert.ok(contracts.includes(t.contract), t.key);
    assert.equal(t.contract, want.get(t.key), t.key);
    assert.ok(Number.isInteger(t.version), t.key);
  }
});

/* ---------------------------------------------------------------------- R5 */

test("R5 every event a type's assess emits is the catalogue's, and meaningful is isMeaningful(events)", () => {
  const golden = readGolden();
  const parsed = new Map(/** @type {Array<[string, HeldReading]>} */ ([]));
  for (const c of CASES) { const r = readWith(REG, c.supplied, c.ctx); parsed.set(c.id, { t: own(r.doctype.type), p: r.parsed, ctx: c.ctx }); }
  /** @type {{ [id: string]: TypedReading }} */
  const reads = {};
  for (const [k, v] of parsed) reads[k] = { type: v.t.key };
  // every pair of readings of one type, and each reading against a changed copy of itself
  /** @param {object} p @returns {object} */
  const mutate = (p) => { const b = structuredClone(p);
    if (!changeable(b)) throw new TypeError("a reading's entities are a list of entities");
    const entities = b.entities;
    if (entities && entities.length) {
      const first = entities[0];
      if (first === undefined) throw new TypeError("Cannot read properties of undefined (reading 'facts')");
      first.facts = { ...first.facts, outcome: "Rejected", subject: "x" }; entities.pop(); }
    /** @type {ReadonlyArray<"title" | "recommendation" | "number">} */
    const facts = ["title", "recommendation", "number"];
    for (const k of facts) if (b[k]) b[k] = `${b[k]} (changed)`;
    return b; };
  let n = 0;
  for (const [a, b] of pairsOf(reads)) {
    const pa = parsed.get(a);
    const pb = parsed.get(b);
    assert.ok(pa !== undefined && pb !== undefined);
    /** @type {Array<[object, object]>} */
    const runs = [[pa.p, pb.p], [pa.p, mutate(pa.p)]];
    for (const [x, y] of runs) {
      /** @type {Assessed} */
      const r = pa.t.assess(x, y, pb.ctx);
      for (const e of r.events) {
        assert.ok(Object.hasOwn(EVENTS, e.type), `${a}: ${e.type} is in the catalogue`);
        /* the catalogue's significance for the type, as site-profiles' `event` grades it */
        assert.equal(e.significance, event(e.type).significance);
      }
      const meaningful = r.meaningful;
      if (meaningful !== null) assert.equal(meaningful, worstSignificance(r.events) === SIGNIFICANCE.EVENT, `${a}|${b}`);
      else assert.deepEqual(r.events, []);
      n++;
    }
  }
  assert.ok(n >= 100 && Object.keys(golden.assess).length > 0);
});

/* ---------------------------------------------------------------------- R6 */

test("R6 every connection is referential or temporal, each in its own shape", () => {
  const cal = typeOf("meeting_calendar", dt.meetingCalendar);
  const a = cal.parse({ text: calendarHtml([["1", "Harbor Commission", "3/2/2026", null, "11"]]) });
  const b = cal.parse({ text: calendarHtml([["1", "Harbor Commission", "3/2/2026", null, "11"],
    ["2", "Select Board", "3/4/2026", null, "21", "22"], ["3", "Harbor Commission", "4/2/2026"]]) });
  const conns = cal.connections(a, b, { now: NOW, view: PA });
  assert.ok(conns.length >= 5);
  for (const c of conns) {
    if (c.connection === /** @copyof docprofile:CONNECTION.REFERENTIAL */ ("referential")) assert.deepEqual(Object.keys(c).sort(), ["connection", "from", "relation", "to", "why"]);
    else {
      assert.equal(c.connection, /** @copyof docprofile:CONNECTION.TEMPORAL */ ("temporal"));
      assert.deepEqual(Object.keys(c).sort(), ["at", "connection", "expected_by", "from", "relation", "to", "why"]);
    }
  }
  const rel = new Set(conns.map((c) => `${c.connection}:${c.relation}`));
  for (const x of ["referential:is_the_agenda_for", "referential:is_the_minutes_of", "referential:held_by",
                   "temporal:minutes_published_after", "temporal:minutes_not_yet_published", "temporal:agenda_not_yet_published"])
    assert.ok(rel.has(x), x);
  // no other type emits a connection of a third shape
  for (const d of DOCTYPES) {
    const t = own(d);
    if (typeof t.connections === "function" && t !== cal)
      for (const c of t.connections?.(t.parse({ text: "", view: PA }), t.parse({ text: "", view: PA }), { view: PA }) || [])
        assert.ok([/** @copyof docprofile:CONNECTION.REFERENTIAL */ ("referential"),
                   /** @copyof docprofile:CONNECTION.TEMPORAL */ ("temporal")].includes(c.connection));
  }
});

/* ---------------------------------------------------------------------- R7 */

/** @param {string} text @param {number} page @returns {SuppliedPage} */
const pageOf = (text, page) => ({ page, text, undetermined: [] });
/** @param {ReadonlyArray<string>} texts @returns {SuppliedText} */
const pagesOf = (texts) => ({ pages: texts.map(pageOf), document: texts.filter(Boolean).join("\n") });

test("R7 a type places a reference only where locate says, once per reference with every occurrence, and no source without a locator", () => {
  /** @type {ReadonlyArray<readonly [string, OwnType, string]>} */
  const texts = [["meeting_agenda", dt.meetingAgenda, PA_AGENDA], ["staff_report", dt.staffReport, PA_REPORT],
                 ["regulation", dt.regulation, PA_BYLAW], ["staff_directory", dt.staffDirectory, PA_DIRECTORY],
                 ["meeting_minutes", dt.meetingMinutes, PA_MINUTES]];
  for (const [key, handle, text] of texts) {
    const bare = typeOf(key, handle).parse({ text, view: PA });
    for (const e of bare.entities) { assert.ok(!("source" in e), key); for (const o of e.occurrences || []) assert.equal(o, null); }
    const nul = typeOf(key, handle).parse({ text, view: PA, locate: () => null });
    for (const e of nul.entities) assert.ok(!("source" in e), `${key}: a null answer composes nothing`);
    const given = new Map(/** @type {Array<[string, OffsetPage]>} */ ([]));
    /** A reader locates a character offset, a number. @param {unknown} off @returns {OffsetPage} */
    const locate = (off) => {
      if (typeof off !== "number") throw new TypeError(`${key} located ${String(off)}, not an offset`);
      /** @type {OffsetPage} */
      const s = { kind: "pdf-page", ref: `p.${off}`, page: off, rect: null }; given.set(s.ref, s); return s; };
    const placed = typeOf(key, handle).parse({ text, view: PA, locate });
    assert.ok(placed.entities.length, key);
    for (const e of placed.entities) {
      const source = e.source;
      assert.ok(source !== undefined, `${key}: ${e.key} has a source`);
      const mine = given.get(source.ref);
      assert.equal(mine, source, `${key}: ${e.key} carries what locate gave`);
      const needle = String(e.facts.number || e.facts.section || e.facts.file || e.facts.address || e.key).toLowerCase();
      assert.ok(text.slice(mine.page, mine.page + 80).toLowerCase().includes(needle), `${key}: ${e.key} at ${mine.page}`);
      for (const o of e.occurrences || []) { assert.ok(o !== null); assert.equal(given.get(o.ref), o); }
      const occurrences = e.occurrences;
      if (occurrences) assert.equal(occurrences[0], e.source, "the first occurrence is the source");
    }
    assert.equal(new Set(placed.entities.map((e) => e.key)).size, placed.entities.length, `${key}: one entity per reference`);
  }
  // read on two pages: one entity, its first sighting the source, every occurrence in reading order
  const flat = flattenText(pagesOf(PA_AGENDA.split("Page 1")));
  const r = typeOf("meeting_agenda", dt.meetingAgenda).parse({ text: flat.text, view: PA, locate: makeLocator(flat.segments) });
  const first = r.entities.find((e) => e.key === "PA-101");
  assert.ok(first !== undefined);
  assert.deepEqual(first.source, { kind: "pdf-page", ref: "p.1", page: 0, rect: null });
  const occurrences = first.occurrences;
  assert.ok(occurrences !== undefined);
  assert.deepEqual(occurrences.map((s) => s && s.ref), ["p.1", "p.2"]);
  const second = r.entities.find((e) => e.key === "PA-102");
  assert.ok(second !== undefined);
  assert.ok(!("occurrences" in second), "read once: no occurrences");
});

/* ---------------------------------------------------------------------- R8 */

test("R8 the calendar's forward-looking connection reads ctx.now when given, the wall clock only when not", () => {
  const cal = typeOf("meeting_calendar", dt.meetingCalendar);
  const html = calendarHtml([["7", "Harbor Commission", "3/2/2026"]]);
  const p = cal.parse({ text: html });
  /** No now given is no `now` in the context (`undefined` read as absent). @param {string | undefined} now */
  const at = (now) => {
    const conns = now === undefined ? cal.connections(p, p, { view: PA }) : cal.connections(p, p, { now, view: PA });
    return conns.filter((c) => c.relation === "minutes_not_yet_published");
  };
  assert.equal(at("2026-03-20T12:00:00Z").length, 1, "after the meeting, by the given now");
  assert.equal(at("2026-03-01T12:00:00Z").length, 0, "before it, by the given now");
  // with no now, the wall clock: today is long after March 2026
  assert.equal(at(undefined).length, 1);
  assert.deepEqual(at("2026-03-20T12:00:00Z"), at("2026-03-20T12:00:00Z"));
});

test("R3 R8 the minutes-due date is the profile's practice counted by civil-time: business days on the profile's own closures", () => {
  const cal = typeOf("meeting_calendar", dt.meetingCalendar);
  /** @param {string} date @param {ReaderView} v @param {string} [now] @returns {Connection} */
  const due = (date, v, now = "2026-12-20T12:00:00Z") => {
    const p = cal.parse({ text: calendarHtml([["7", "Harbor Commission", date]]) });
    return connection(cal.connections(p, p, { now, view: v }), "minutes_not_yet_published");
  };
  // a made-up profile counting business days on its own weekend and office calendar (no Port Alder holiday is Oakland's)
  /** @type {Practice} */
  const practice = { minutes_due_days: { value: 10, count: "business", basis: "TEST" } };
  /** @type {Weekend} */
  const weekend = { days: ["sat", "sun"], citation: "Port Alder Code § 1-01", status: "researched", basis: "TEST" };
  /** @type {Holiday[]} */
  const holidays = [{ year: 2026, days: [{ date: "2026-03-09", name: "Harbor Day" }], status: "researched", basis: "TEST" }];
  const BUSINESS = structuredClone(PORT_ALDER);
  BUSINESS.id = "port-alder-business-test";
  BUSINESS.practice = practice;
  BUSINESS.weekend = weekend;
  BUSINESS.holidays = holidays;
  const bv = view(BUSINESS);
  // Monday 2 March: ten business days, skipping two weekends and Harbor Day, end Tuesday 17 March
  const b = due("3/2/2026", bv);
  assert.equal(expectedBy(b), "2026-03-17");
  assert.match(said(b.why), /more than 10 business days ago/);
  assert.equal(due("3/2/2026", bv, "2026-03-17T12:00:00Z").why, localize("doctypes.meeting-calendar.taken_place", "this meeting has taken place and no minutes are offered yet"),
    "on the due day itself, not yet late");
  // the same period in calendar days is not the same date
  assert.equal(expectedBy(due("3/2/2026", PA)), "2026-03-12");
  // a year the profile's closures do not cover: not counted, and why, never counted as though it had no holidays
  const late = due("12/28/2026", bv, "2027-02-01T12:00:00Z");
  assert.equal(expectedBy(late), null);
  assert.match(said(late.why), /could not be counted.*2027/);
  // no weekend stated: a business count is not made (the weekend is never assumed)
  const noWeekend = structuredClone(BUSINESS);
  noWeekend.id = "port-alder-noweekend-test";
  delete noWeekend.weekend;
  assert.equal(expectedBy(due("3/2/2026", view(noWeekend))), null);
  assert.match(said(due("3/2/2026", view(noWeekend)).why), /weekend/);
  // the held first profile: 10 business days (OMC 2.20.160) on the City's holiday list (K1504 (5)), as its practice names.
  // Tuesday 13 October 2026 gives 27 October; 19 November gives 7 December (Thanksgiving and the day after skipped)
  assert.equal(expectedBy(due("10/13/2026", HELD)), "2026-10-27");
  assert.match(said(due("10/13/2026", HELD).why), /more than 10 business days ago/);
  assert.equal(expectedBy(due("11/19/2026", HELD)), "2026-12-07");
  // the same practice naming no closure list, in a view holding its closures only as named lists: not counted, and why
  const unnamed = structuredClone(HELD);
  const unnamedPractice = unnamed.practice;
  assert.ok(unnamedPractice !== undefined);
  const minutesDue = unnamedPractice.minutes_due_days;
  assert.ok(minutesDue !== undefined);
  delete minutesDue.closures;
  assert.equal(expectedBy(due("10/13/2026", unnamed)), null);
  assert.match(said(due("10/13/2026", unnamed).why), /10 business days could not be counted/);
});

/* --------------------------------------------------------------------- R18 */

test("R18 the existing fixtures of every type give the verdicts docprofile gave, apart from the added readings", () => {
  const golden = readGolden();
  const ADDED = new Set(["form", "form_why", "sections", "sections_why", "section_digests", "definitions", "exceptions", "counts"]);
  /** The reading's own members, the added readings left out (a copy of its own enumerable members, less those).
   *  @param {object} p @returns {object} */
  const strip = (p) => { const q = { ...p }; for (const k of ADDED) Reflect.deleteProperty(q, k); return q; };
  /** An assessment with no section or form event, and its section comparison unsaid.
   *  @template {{ readonly events: ReadonlyArray<EventHead> }} A
   *  @param {A} r */
  const noSection = (r) => ({ ...r, events: r.events.filter((e) => !("key" in e) || (e.key !== "section" && e.key !== "form")),
                              sections_compared: undefined, sections_why: undefined });
  /* The views as they are: the held profiles and Port Alder name their codes' section
     forms (jurisdictions T33-2), so the new readings are shown to move no verdict. */
  {
    const parsed = new Map(/** @type {Array<[string, HeldReading]>} */ ([]));
    for (const c of CASES) {
      const ctx = c.ctx;
      const r = readWith(REG, c.supplied, ctx);
      const g = golden.readings[c.id];
      assert.ok(g !== undefined, `${c.id}: in the golden file`);
      const key = r.doctype.type?.key;
      assert.equal(key, g.type, `${c.id}: type`);
      assert.equal(r.doctype.confidence, g.confidence, `${c.id}: confidence`);
      assert.deepEqual(r.doctype.signals, g.signals, `${c.id}: signals`);
      assert.deepEqual(r.doctype.also, g.also, `${c.id}: also`);
      const reading = key === "regulation" ? strip(r.parsed) : r.parsed;
      assert.deepEqual(JSON.parse(JSON.stringify(reading)), g.parsed, `${c.id}: the reading, entities included`);
      parsed.set(c.id, { t: own(r.doctype.type), p: r.parsed, ctx });
    }
    for (const [pair, want] of Object.entries(golden.assess)) {
      const [a, b] = pair.split("|");
      /* a missing half is looked up as "undefined", as an object's member would have been */
      const pa = parsed.get(String(a));
      const pb = parsed.get(String(b));
      assert.ok(pa !== undefined && pb !== undefined, pair);
      const got = pa.t.assess(pa.p, pb.p, pb.ctx);
      /* the events and the verdict as JSON: the events a list, the verdict a boolean or null, each as it reads back */
      const g = noSection(got);
      assert.deepEqual(JSON.parse(JSON.stringify(g.events)), want.events, `${pair}: events`);
      assert.equal(g.meaningful, want.meaningful, `${pair}: meaningful`);
    }
  }
  assert.equal(Object.keys(golden.readings).length, CASES.length);
});

/* ---------------------------------------------------------------- invariants */

test("R20 no place is named in this module's code, and every type is read under a profile that is not the first", () => {
  /* each type's reading of its text under Port Alder's view */
  assert.deepEqual(keys(typeOf("meeting_agenda", dt.meetingAgenda).parse({ text: PA_AGENDA, view: PA })), ["PA-101", "PA-102", "PA-103"]);
  assert.equal(typeOf("meeting_minutes", dt.meetingMinutes).parse({ text: PA_MINUTES, view: PA }).entities[0]?.facts.outcome, "Approved");
  assert.match(said(typeOf("staff_report", dt.staffReport).parse({ text: PA_REPORT, view: PA }).recommendation), /^Adopt Bylaw No\. 2041/);
  assert.equal(typeOf("regulation", dt.regulation).parse({ text: PA_BYLAW, view: PA }).instrument, "bylaw");
  assert.equal(typeOf("staff_directory", dt.staffDirectory).parse({ text: PA_DIRECTORY, view: PA }).entities.length, 6);
  assert.equal(typeOf("meeting_calendar", dt.meetingCalendar).parse({ text: calendarHtml([["5", "Harbor Commission", "3/3/2026"]]), view: PA })
    .entities[0]?.facts.body, "Harbor Commission");
  assert.deepEqual(typeOf("generic", dt.generic).parse({ text: "x", view: PA }), { entities: [], facts: {} });
  const ownText = new Map([["meeting_agenda", PA_AGENDA], ["meeting_minutes", PA_MINUTES],
    ["staff_report", PA_REPORT], ["regulation", PA_BYLAW], ["staff_directory", PA_DIRECTORY], ["generic", "x"],
    ["meeting_calendar", calendarHtml([["5", "B", "3/3/2026", null, "9"]])], ["policy", PE_POLICY]]);
  for (const t of DOCTYPES) {
    /* a type with no text of its own reads none: no `text` in the context */
    const text = ownText.get(t.key);
    const v = t.key === "policy" ? PE : PA;
    const found = text === undefined ? typeFor(REG, { view: v, locator: "https://r.test/Calendar.aspx" })
      : typeFor(REG, { text, view: v, locator: "https://r.test/Calendar.aspx" });
    assert.ok(found.type?.key === t.key, t.key);
  }
  // the first profile's shapes are not recognised when no active profile supplies them
  const oaklandShaped = PA_AGENDA.replace(/PA-(\d)(\d\d)/g, "26-0$1$2");
  for (const v of [PA, EMPTY]) assert.deepEqual(keys(typeOf("meeting_agenda", dt.meetingAgenda).parse({ text: oaklandShaped, view: v })), []);
  const cites = "Staff recommends amending O.M.C. Section 8.28 per Ordinance No. 13314 C.M.S. and file 26-0910.";
  assert.deepEqual(keys(typeOf("staff_report", dt.staffReport).parse({ text: cites, view: PA })), []);
  assert.deepEqual(keys(typeOf("regulation", dt.regulation).parse({ text: cites + " DOES ORDAIN", view: EMPTY })), []);
  assert.equal(typeOf("regulation", dt.regulation).parse({ text: "2.20.030 - Definitions.\nA.\nText.", view: PA }).form, null,
    "a code number no active profile names is no code section");
  // and the code itself names no place: every name the held profiles cover, searched in the source
  const places = new Set(/** @type {string[]} */ ([]));
  for (const p of list()) for (const c of p.covers || []) for (const w of String(c).split(/\W+/)) if (w.length > 4 && /^[A-Z]/.test(w)) places.add(w);
  for (const f of fs.readdirSync(new URL("..", import.meta.url)).filter((x) => x.endsWith(".mjs"))) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    for (const w of places) if (!["County", "Cities"].includes(w)) assert.ok(!new RegExp(`\\b${w}\\b`).test(src), `${f} names ${w} outside a comment`);
  }
});

test("R21 deterministic over its inputs apart from R8, and nothing reads a store or the network", () => {
  for (const c of CASES) {
    const ctx = { ...c.ctx, view: c.ctx.view };
    assert.equal(JSON.stringify(readWith(REG, c.supplied, ctx).parsed), JSON.stringify(readWith(REG, c.supplied, ctx).parsed), c.id);
  }
  for (const f of fs.readdirSync(new URL("..", import.meta.url)).filter((x) => x.endsWith(".mjs"))) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    assert.ok(!/\bfetch\s*\(|node:(?:fs|net|http)|\bD1\b|\.prepare\s*\(|indexedDB|localStorage/.test(src), `${f} reads no store or network`);
    for (const m of src.matchAll(/from\s+"([^"]+)"/g))
      assert.ok(/^\.\/|^\.\.\/(?:docprofile|site-profiles|jurisdictions|bio-plane\/src\/civil-time|bio-plane\/src\/setup-words)\//.test(String(m[1])), `${f} imports only its declared uses: ${m[1]}`);
  }
});

test("R22 an unrecognised document is never assumed decorated, and a type without CERTAIN never asserts unchanged", () => {
  const g = typeOf("generic", dt.generic);
  const r = g.assess({ entities: [], facts: {} }, { entities: [], facts: {} }, { view: PA });
  assert.notEqual(r.meaningful, false, "generic never says nothing changed by itself");
  const likely = typeFor(REG, { text: "The Select Board DOES HEREBY RESOLVE that the harbor opens.", view: PA });
  assert.equal(likely.type?.key, "regulation");
  assert.equal(likely.confidence, CONFIDENCE.LIKELY);
  const none = typeFor(REG, { text: "a letter about nothing in particular", view: PA });
  assert.equal(none.type?.key, "generic");
  assert.equal(none.confidence, CONFIDENCE.NONE);
  for (const t of DOCTYPES) assert.ok(!("unchanged" in t), `${t.key} holds no verdict of its own`);
});

test("R23 a reading or a diff that found nothing is a failed reader, and a mass removal is never reported from one", () => {
  /** @type {ReadonlyArray<readonly [string, OwnType, string]>} */
  const cases = [["meeting_agenda", dt.meetingAgenda, PA_AGENDA], ["meeting_minutes", dt.meetingMinutes, PA_MINUTES],
                 ["staff_report", dt.staffReport, PA_REPORT], ["regulation", dt.regulation, PA_BYLAW],
                 ["staff_directory", dt.staffDirectory, PA_DIRECTORY]];
  for (const [key, handle, good] of cases) {
    const t = typeOf(key, handle);
    const a = t.parse({ text: good, view: PA });
    const b = t.parse({ text: "nothing", view: PA });
    for (const [x, y] of [[a, b], [b, a], [b, b]]) {
      const m = t.assess(x, y, { view: PA });
      assert.equal(m.meaningful, null, key);
      assert.deepEqual(m.events, [], key);
      assert.match(m.why, /./);
    }
  }
  const cal = typeOf("meeting_calendar", dt.meetingCalendar);
  const full = cal.parse({ text: calendarHtml([["1", "B", "3/3/2026"], ["2", "C", "3/4/2026"]]) });
  const empty = cal.parse({ text: calendarHtml([]) });
  const m = cal.assess(full, empty, { view: PA, now: NOW });
  assert.equal(m.meaningful, null);
  assert.ok(!m.events.some((e) => e.type === "item_pulled"), "no mass removal from a failed read");
});

test("R24 every no says which no and why", () => {
  assert.match(said(typeOf("regulation", dt.regulation).parse({ text: "DOES ORDAIN", view: PA }).number_why), /no caption/);
  assert.match(said(typeOf("regulation", dt.regulation).parse({ text: PA_BYLAW, view: PA }).number_why), /carries no number/);
  assert.equal(typeOf("regulation", dt.regulation).parse({ text: "nothing", view: PA }).form_why, localize("doctypes.regulation.no_form", "this text carries no enacting formula, no instrument caption under a body, and no section heading of a code the active jurisdiction profiles name, so it is read as neither an instrument nor a code section"));
  assert.match(said(typeOf("regulation", dt.regulation).parse({ text: "DOES ORDAIN", view: PA }).sections_why), /SECTION 1/);
  assert.equal(typeOf("meeting_agenda", dt.meetingAgenda).parse({ text: PA_AGENDA, view: EMPTY }).references_why, localize("doctypes.meeting-agenda.no_file_shape", "no active jurisdiction profile gives the shape of its legislative record's file numbers, so no item was read"));
  assert.equal(typeOf("meeting_minutes", dt.meetingMinutes).parse({ text: PA_MINUTES, view: EMPTY }).body_why, localize("doctypes.meeting-minutes.no_body_profile", "no active jurisdiction profile says how a body is named, so which body met is not read"));
  assert.match(said(typeOf("staff_directory", dt.staffDirectory).parse({ text: PA_DIRECTORY.replace("Harbor Staff Directory", "Harbor"), view: PA }).title_why), /./);
  assert.match(said(typeFor(REG, { text: "plain", view: PA }).type?.key), /generic/);
  const cal = typeOf("meeting_calendar", dt.meetingCalendar);
  const p = cal.parse({ text: calendarHtml([["7", "Harbor Commission", "3/2/2026"]]) });
  assert.match(said(connection(cal.connections(p, p, { now: NOW, view: EMPTY }), "minutes_not_yet_published").why), /not known/);
  /* read as any of the module's types is, its assess handed the context too */
  const reg = anyOwn(typeOf("regulation", dt.regulation));
  const a = reg.parse({ text: PA_BYLAW, view: PA });
  assert.match(reg.assess(a, a, { view: PA }).why, /./);
});

test("R4 R5 R1 a registry filled by registerDoctypes answers as docprofile's did: first CERTAIN, else best, else generic", () => {
  /** @type {ReadonlyArray<readonly [string, string]>} */
  const certain = [[PA_AGENDA, "meeting_agenda"], [PA_MINUTES, "meeting_minutes"], [PA_REPORT, "staff_report"],
                   [PA_BYLAW, "regulation"], [PA_DIRECTORY, "staff_directory"]];
  for (const [t, key] of certain) {
    const r = typeFor(REG, { text: t, view: PA });
    assert.equal(r.type?.key, key);
    assert.equal(r.confidence, CONFIDENCE.CERTAIN);
  }
  const both = typeFor(REG, { text: PA_MINUTES + "\n" + PA_AGENDA, view: PA });
  assert.ok(both.also.some((x) => x.key === "meeting_agenda"));
  assert.ok(registryOf(DOCTYPES).all().length === 8);
});
