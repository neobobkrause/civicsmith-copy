/* action-clocks' calendar: a business count states the confirmation of every holiday year it reads and counts on the value
   that governs on this instance, for the offices the action is addressed to or filed at (R10; jurisdictions R43;
   local-facts R2); and the local facts a live deadline reads (R11). On the test profile (its weekend Sunday alone),
   on a variant of it whose deadlines name no closure list (`officeCalendarProfile`), and on the first profile's
   office-specific 2026 entries (M-189–M-191; K936). K1519: a closure list's entries (jurisdictions R47) are never read
   as the office calendar; each is a local fact at its own path (R12, N562; local-facts R6). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, ALICE, MACHINE, actionMd, CLK, officeCalendarProfile, determinations } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import { factPath } from "../../../src/local-facts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { combine, get } from "../../../../jurisdictions/index.mjs";

const M = V("alice"), BOB = V("bob");
const A = "ACTN-2026-0001-a", B = "ACTN-2026-0002-b", C = "ACTN-2026-0003-c", D = "ACTN-2026-0004-d";
const TEST = combine(["test-port-ellery"]).view, FIRST = combine(["oakland-alameda"]).view;
const office = (role, body) => ({ state: "named", role, body });
const fm = (counterparty, action_kind, at) => ({ counterparty, action_kind, correspondence: [{ direction: "sent", at }] });
const R5 = { rule: "r", days: 5, count: "business", starts: "received", basis: "TEST" };
const OFFICE = { "test-port-ellery": officeCalendarProfile() };
const count = (d, f, view, factOf) => clocks.computeDeadline(d, f, view, factOf === undefined ? {} : { factOf });
/* The paths of the holiday entries of a view for a year, keyed by their offices ("all" for every office). */
const pathOf = (view, year, offices = null) => {
  const h = view.holidays.find((x) => x.year === year && JSON.stringify(x.offices ?? null) === JSON.stringify(offices));
  return factPath({ profile: h.profile, fact: "holidays", year, ...(offices ? { offices } : {}) });
};
const CLERK = office("Town Clerk", "City of Port Ellery"), SELECT = office("Selectboard", "Port Ellery Selectboard");
const CPL = (role, body) => ["counterparty:", "  state: named", `  role: ${role}`, `  body: ${body}`];

test("R10 a business count reads the holiday entries for all offices and those naming the action's ONE office (its addressee when a named office, else its kind's venue; K986), and no other office's; never a closure list's (K1519)", () => {
  /* Wednesday 2026-08-12, the weekend Sunday alone: the Town Clerk's office alone is closed Friday 14 August. Thu 13,
     (Fri 14), Sat 15, (Sun 16), Mon 17, Tue 18, Wed 19; for another office Thu 13 … Tue 18. */
  assert.equal(count(R5, fm(CLERK, "records_request", "2026-08-12"), TEST).date, "2026-08-19", "the Clerk's closure is counted");
  assert.equal(count(R5, fm(SELECT, "records_request", "2026-08-12"), TEST).date, "2026-08-18", "for another office it is not");
  /* Saturday 2026-08-29: the venue of a commitment claim is closed Monday 31 August; a records request's is not. With no
     office addressed, the venue decides; with an office addressed, the addressee does. */
  const one = { ...R5, days: 1 }, AUD = { state: "audience", description: "residents" };
  assert.equal(count(one, fm(AUD, "commitment_claim", "2026-08-29"), TEST).date, "2026-09-01", "the venue's closure is counted");
  assert.equal(count(one, fm(AUD, "records_request", "2026-08-29"), TEST).date, "2026-08-31");
  assert.equal(count(one, fm(SELECT, "commitment_claim", "2026-08-29"), TEST).date, "2026-08-31", "the addressee, not the venue");
  /* the all-offices entry binds every office: Friday 3 July (Thu 2, Sat 4, Mon 6, Tue 7, Wed 8). */
  for (const f of [fm(CLERK, "records_request", "2026-07-01"), fm({ state: "audience", description: "residents" }, "other", "2026-07-01")])
    assert.equal(count(R5, f, TEST).date, "2026-07-08");
  /* the entries read are stated, each once, the others' not, and no closure list among them (K1519): the 'court' and
     'town' lists of 2026 carry no `offices` and were once read as the calendar for all offices. */
  const read = count(R5, fm(CLERK, "records_request", "2026-08-12"), TEST).calendar.years.map((y) => [y.year, y.list, y.offices]);
  assert.deepEqual(read, [[2026, null, ["Town Clerk"]], [2026, null, null]]);
  /* 1 January 2026 is a 'town' and 'court' closure and an all-office holiday; 17 March a 'town' one and an all-office
     one; 31 August a 'court' one only: an office count is not moved by the lists' days. */
  assert.equal(count({ ...R5, days: 1 }, fm(SELECT, "other", "2026-08-29"), TEST).date, "2026-08-31", "the 'court' list's 31 August is not the office calendar's");
  assert.deepEqual(clocks.yearEntries(TEST, [], 2026).entries.map((h) => [h.list ?? null, h.offices ?? null]), [[null, null]],
    "yearEntries reads no list entry");
  assert.deepEqual(clocks.actionOffices(fm(CLERK, "commitment_claim", "2026-08-28"), TEST),
    [{ role: "Town Clerk", body: "City of Port Ellery" }]);
  assert.deepEqual(clocks.actionOffices(fm(AUD, "commitment_claim", "2026-08-28"), TEST), [{ venue: "commitment_claim" }]);
  assert.deepEqual(clocks.actionOffices(fm({ state: "named", kind: "press", role: "Reporter", organisation: "x" }, "other", "x"), TEST), [],
    "a named non-office and a kind with no venue are no office");
});

test("R10 R12 a rule that names a closure list counts on that list alone, and the list's entry is read at its own local-facts path (list=<name>), stated by its own status apart from the office calendar's: unconfirmed, confirmed, corrected (counted on, naming its member and date, and still counted on once confirmed, N603) and disputed (N562)", () => {
  const w = world();
  w.action(A, CPL("Town Clerk", "City of Port Ellery"));
  w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-08-12", account: "sent", viewer: M, author: M });
  const propose = () => w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal;
  const town = TEST.holidays.find((h) => h.list === "town" && h.year === 2026);
  const townPath = factPath({ profile: town.profile, fact: "holidays", year: 2026, list: "town" });
  assert.match(townPath, /list=town/);
  assert.notEqual(townPath, pathOf(TEST, 2026), "never the office calendar's path for the same year and offices");
  const act = (path, a, x = {}) => {
    const r = w.localFacts.factConfirm({ path, act: a, how: "the town's published list", by: M, viewer: M, ...x });
    assert.equal(r.ok, true, JSON.stringify(r)); return r;
  };
  /* unconfirmed: the 'town' list closes no day in the period, so the Clerk's own 14 August does not move it: Thu 13 … Tue 18. */
  let p = propose();
  assert.equal(p.entry.date, "2026-08-18");
  assert.deepEqual(p.calendar.years.map((y) => [y.year, y.list, y.status, y.path]), [[2026, "town", "unconfirmed", townPath]]);
  assert.equal(p.calendar.status, "unconfirmed");
  assert.deepEqual(p.calendar.says, ["counted on an unconfirmed calendar (TEST, never confirmed here): the closure list 'town', 2026"]);
  /* the reader answers the list's entry at its own path, as any holiday year. */
  const read = clocks.factReader(w.localFacts, M);
  assert.deepEqual([read(town).path, read(town).status], [townPath, "unconfirmed"]);
  /* confirming the office calendar does not confirm the list, nor the list the office calendar. */
  act(pathOf(TEST, 2026), "confirm");
  assert.equal(propose().calendar.status, "unconfirmed");
  act(townPath, "confirm");
  p = propose();
  assert.deepEqual([p.calendar.status, p.calendar.says, p.calendar.years[0].status], ["confirmed", [], "confirmed"]);
  assert.equal(read(TEST.holidays.find((h) => h.year === 2026 && !h.list && h.offices)).status, "unconfirmed", "the Clerk's office entry is its own fact");
  /* corrected: the town closes 14 August too; the count counts on the correction (Thu 13, (Fri 14), Sat 15 … Wed 19). */
  const c = act(townPath, "correct", { by: BOB, viewer: BOB, value: [...town.days, { date: "2026-08-14", name: "Harbour Fair" }],
                                        source: "the town's notice of 2026-08-01" });
  p = propose();
  assert.deepEqual([p.entry.date, p.calendar.status], ["2026-08-19", "corrected"]);
  assert.deepEqual([p.calendar.years[0].corrected_by, p.calendar.years[0].corrected_at], [BOB, c.at.slice(0, 10)]);
  assert.deepEqual(p.calendar.says, [`counted on a calendar corrected locally by ${BOB}, ${c.at.slice(0, 10)}: the closure list 'town', 2026`]);
  /* N603: a correction since confirmed still governs, and the count reads confirmed. */
  act(townPath, "confirm");
  p = propose();
  assert.deepEqual([p.entry.date, p.calendar.status, p.calendar.says], ["2026-08-19", "confirmed", []]);
  /* disputed: undetermined, with why; nothing is counted. */
  act(townPath, "dispute", { by: BOB, viewer: BOB });
  p = propose();
  assert.equal(p.entry.date, null); assert.match(p.undetermined, /closure list 'town'.*disputed/);
});

test("R10 on the first profile's office-specific 2026 entries (M-189–M-191): each office counts on its own entry; an office no entry names, with no entry for all offices, leaves the year undetermined", () => {
  const one = { ...R5, days: 1 }, two = { ...R5, days: 2 };
  const audience = { state: "audience", description: "the court" };
  /* Tuesday 2026-11-10: the State Controller's offices close 11 November (M-191); the city's offices do not (M-190). */
  const state = count(one, fm(office("State Controller", "California State Controller's Office"), "other", "2026-11-10"), FIRST);
  assert.deepEqual([state.date, state.calendar.years.map((y) => y.basis)], ["2026-11-12", ["M-191"]]);
  const city = count(one, fm(office("Controller", "City of Oakland Finance Department"), "other", "2026-11-10"), FIRST);
  assert.deepEqual([city.date, city.calendar.years.map((y) => y.basis)], ["2026-11-11", ["M-190"]]);
  /* Thursday 2026-07-02: the court (the venue of a records petition) closes Friday 3 July (M-189); the city on Saturday 4th. */
  const court = count(two, fm(audience, "records_petition", "2026-07-02"), FIRST);
  assert.deepEqual([court.date, court.calendar.years.map((y) => y.basis)], ["2026-07-07", ["M-189"]]);
  assert.equal(count(two, fm(office("City Auditor", "Office of the City Auditor, City of Oakland"), "other", "2026-07-02"), FIRST).date, "2026-07-06");
  /* an office no entry names: undetermined, naming it; so is an action with no office, the year having no entry for all. */
  const jury = count(one, fm(office("Civil Grand Jury", "Alameda County Civil Grand Jury"), "other", "2026-07-02"), FIRST);
  assert.equal(jury.date, null); assert.match(jury.why, /Civil Grand Jury/); assert.match(jury.why, /2026/);
  const none = count(one, fm(audience, "other", "2026-07-02"), FIRST);
  assert.equal(none.date, null); assert.match(none.why, /does not cover for every office/);
  /* the addressee is the office even where the kind has a venue an entry names: the jury, no entry naming it. */
  assert.equal(count(two, fm(office("Civil Grand Jury", "Alameda County Civil Grand Jury"), "records_petition", "2026-07-02"), FIRST).date, null);
  /* a request to the City Auditor counts on M-190's entry, though the kind's venue (the portal) is named by none. */
  const auditor = count(one, fm(office("City Auditor", "Office of the City Auditor, City of Oakland"), "records_request", "2026-11-10"), FIRST);
  assert.deepEqual([auditor.date, auditor.calendar.years.map((y) => y.basis)], ["2026-11-11", ["M-190"]]);
  /* the same office in the next year, which the profile does not list: undetermined. */
  assert.match(count(one, fm(office("Controller", "x"), "other", "2026-12-31"), FIRST).why, /2027/);
});

test("R10 the count states each year's confirmation through local-facts: unconfirmed, confirmed, corrected (counting on the correction, naming its member and date), and undetermined when disputed; a calendar count states none", () => {
  const w = world({ override: OFFICE });
  const clerk = pathOf(TEST, 2026, ["Town Clerk"]), all26 = pathOf(TEST, 2026);
  w.action(A, CPL("Town Clerk", "City of Port Ellery"));
  w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-08-12", account: "sent", viewer: M, author: M });
  const propose = () => w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal;
  const act = (path, a, x = {}) => {
    const r = w.localFacts.factConfirm({ path, act: a, how: "the clerk's published calendar, read 2026-09-28", by: M, viewer: M, ...x });
    assert.equal(r.ok, true, JSON.stringify(r)); return r;
  };
  /* no member has confirmed: counted, and said to be counted on an unconfirmed calendar, naming the source. */
  let p = propose();
  assert.equal(p.entry.date, "2026-08-19");
  assert.equal(p.calendar.status, "unconfirmed");
  assert.deepEqual(p.calendar.years.map((y) => [y.path, y.status]), [[clerk, "unconfirmed"], [all26, "unconfirmed"]]);
  assert.equal(p.calendar.says.length, 2);
  for (const s of p.calendar.says) assert.equal(s, word("action-clocks.counted_unconfirmed_calendar", { basis: "TEST", last_at: word("action-clocks.confirmed"), which: "" }));
  /* one confirmed, one not: still unconfirmed, the confirmed one not named among what is said. */
  act(all26, "confirm");
  p = propose();
  assert.deepEqual([p.calendar.status, p.calendar.says.length, p.entry.date], ["unconfirmed", 1, "2026-08-19"]);
  /* both confirmed: counted as before, nothing said. */
  act(clerk, "confirm");
  p = propose();
  assert.deepEqual([p.calendar.status, p.calendar.says, p.entry.date], ["confirmed", [], "2026-08-19"]);
  assert.ok(p.calendar.years.every((y) => y.status === "confirmed"));
  /* corrected: the correction governs (the Clerk is open on 14 August), naming the member and the date. */
  const c = act(clerk, "correct", { by: BOB, viewer: BOB, value: [],
                                    source: "the clerk's notice of 2026-09-20" });
  p = propose();
  assert.deepEqual([p.calendar.status, p.entry.date], ["corrected", "2026-08-18"]);
  const y = p.calendar.years.find((x) => x.path === clerk);
  assert.deepEqual([y.status, y.corrected_by, y.corrected_at], ["corrected", BOB, c.at.slice(0, 10)]);
  assert.deepEqual(p.calendar.says, [`counted on a calendar corrected locally by ${BOB}, ${c.at.slice(0, 10)}`]);
  /* a correction since confirmed: confirmed, and still counted on the correction that governs. */
  act(clerk, "confirm");
  p = propose();
  assert.deepEqual([p.calendar.status, p.calendar.says, p.entry.date], ["confirmed", [], "2026-08-18"]);
  /* disputed: undetermined, with why; nothing is counted. */
  act(all26, "dispute", { by: BOB, viewer: BOB });
  p = propose();
  assert.equal(p.entry.date, null); assert.match(p.undetermined, /disputed/);
  assert.equal(w.rows(`SELECT date FROM action_clock_proposals WHERE bundle_id=?`, A)[0].date, null);
  /* a confirmation lapsed at its horizon (a holiday year's, at that year's end): unconfirmed again, naming its source
     and the date of the lapsed confirmation. */
  const x = world({ override: OFFICE });
  x.action(B, ["clock:", ...CLK("2027-12-01"), ...CPL("Town Clerk", "City of Port Ellery")]);
  x.actions.actionCorrespond({ target: B, direction: "sent", at: "2026-12-30", account: "sent", viewer: M, author: M });
  for (const path of [pathOf(TEST, 2026), pathOf(TEST, 2026, ["Town Clerk"]), pathOf(TEST, 2027)])
    assert.equal(x.localFacts.factConfirm({ path, act: "confirm", how: "the calendar", by: M, viewer: M }).ok, true);
  const q = () => x.c.clockPropose({ target: B, rule: "records_answer", proposer: M, viewer: M }).proposal;
  /* Wed 2026-12-30: Thu 31, (Fri 1 January), Sat 2, (Sun 3), Mon 4, Tue 5, Wed 6. */
  assert.deepEqual([q().calendar.status, q().entry.date], ["confirmed", "2027-01-06"]);
  /* 2027-01-02T00:00Z is still 1 January in the profile's zone, and 2026 has ended there (local-facts R3). */
  x.clock.ms = Date.parse("2027-01-02T00:00:00Z");
  const lapsed = q();
  assert.deepEqual([lapsed.calendar.status, lapsed.entry.date], ["unconfirmed", "2027-01-06"]);
  const lapsedSays = word("action-clocks.counted_unconfirmed_calendar", { basis: "TEST", last_at: "2026-09-28", which: "" });
  assert.deepEqual(lapsed.calendar.says, [lapsedSays, lapsedSays], "the two 2026 entries");
  /* a local-facts that cannot answer reads as absent: undetermined. */
  const absent = clocks.computeDeadline(R5, fm(CLERK, "records_request", "2026-08-12"), TEST, { factOf: () => ({ status: "absent", why: "x" }) });
  assert.equal(absent.date, null); assert.match(absent.why, /cannot be read/);
  /* a calendar count reads no holiday and states none. */
  const cal = clocks.computeDeadline({ ...R5, count: "calendar" }, fm(CLERK, "records_request", "2026-08-12"), TEST, { factOf: () => { throw new Error("read"); } });
  assert.deepEqual([cal.date, cal.start, "calendar" in cal], ["2026-08-17", "2026-08-12", false]);
  /* a pure caller that reads no confirmation says so. */
  assert.equal(count(R5, fm(CLERK, "records_request", "2026-08-12"), TEST).calendar.status, "not_read");
});

test("R11 calendarFactsRead lists, once each, the holiday entries and office hours a live business-day deadline reads, from this year to its latest pending entry's (at least the next), with the actions reading each; writes nothing", () => {
  const w = world({ override: OFFICE });
  w.action(A, [...CPL("Town Clerk", "City of Port Ellery"), "clock:", ...CLK("2028-03-01"), ...CLK("2029-01-05", "met")]);
  w.action(B, CPL("Town Clerk", "City of Port Ellery"));
  w.promote(C, actionMd(C, [...CPL("Selectboard", "Port Ellery Selectboard"), "action_kind: bylaw_complaint"]));
  w.action(D, CPL("Selectboard", "Port Ellery Selectboard"));
  w.actions.actionMove({ target: D, to: "abandoned", reason: "dropped", viewer: M, author: M });
  const before = w.rows(`SELECT (SELECT COUNT(*) FROM manifest) AS m, (SELECT COUNT(*) FROM action_reminders) AS r`);
  const r = w.c.calendarFactsRead({ viewer: M });
  const hours = (o) => factPath({ profile: "test-port-ellery", fact: "hours", office: o });
  assert.ok(hours({ venue: "records_request" }) && hours({ role: "Town Clerk", body: "City of Port Ellery" }), "both name a fact");
  const want = [
    [pathOf(TEST, 2026), [A, B]], [pathOf(TEST, 2026, ["Town Clerk"]), [A, B]], [pathOf(TEST, 2027), [A, B]],
    [hours({ role: "Town Clerk", body: "City of Port Ellery" }), [A, B]],
  ].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  assert.deepEqual(r.paths.map((p) => [p.path, p.actions.map((x) => x.action)]), want,
    "a kind with no business deadline (C) reads nothing; a closed action (D) reads nothing; 2028 is not listed, so is no fact; another office's entry, and the venue's hours (the addressee is the office), are not read");
  assert.equal(new Set(r.paths.map((p) => p.path)).size, r.paths.length, "once each");
  assert.deepEqual([r.as_of, r.actions_limit, r.truncated], ["2026-09-28", 500, false]);
  assert.deepEqual(w.rows(`SELECT (SELECT COUNT(*) FROM manifest) AS m, (SELECT COUNT(*) FROM action_reminders) AS r`), before, "writes nothing");
  /* an action addressing no office reads its kind's venue's hours. */
  w.promote("ACTN-2026-0005-e", actionMd("ACTN-2026-0005-e", ["counterparty:", "  state: audience", "  description: residents", "action_kind: records_request"]));
  assert.deepEqual(w.c.calendarFactsRead({ viewer: M }).paths.find((p) => p.path === hours({ venue: "records_request" })).actions,
    [{ action: "ACTN-2026-0005-e", project: null, created_by: M }]);
  /* the horizon moves with the instance clock: from 2027, the 2026 entries are no longer read. */
  const later = w.c.calendarFactsRead({ viewer: M, now: Date.parse("2027-02-01T00:00:00Z") });
  assert.deepEqual(later.paths.map((p) => p.path).filter((x) => x.includes("2026")), []);
  assert.ok(later.paths.some((p) => p.path === pathOf(TEST, 2027)));
  /* only visible actions; with no active profile, nothing is read. */
  assert.deepEqual(w.c.calendarFactsRead({ viewer: "nobody" }).paths, []);
  const bare = world({ profiles: null });
  bare.action(A, CPL("Town Clerk", "City of Port Ellery"));
  assert.deepEqual(bare.c.calendarFactsRead({ viewer: M }).paths, []);
  /* K1519: a deadline counted on a closure list reads no office-calendar entry (the test profile's own business deadline
     counts on 'town'); what it reads of the list is R11's next test's. */
  const lists = world();
  lists.action(A, [...CPL("Town Clerk", "City of Port Ellery"), "clock:", ...CLK("2028-03-01")]);
  const listed = lists.c.calendarFactsRead({ viewer: M }).paths.map((p) => p.path);
  for (const x of [pathOf(TEST, 2026), pathOf(TEST, 2026, ["Town Clerk"]), pathOf(TEST, 2027)])
    assert.ok(!listed.includes(x), `no office-calendar entry: ${x}`);
});

/* The path of a named closure list's entry (local-facts R6), as R12 reads it. */
const listPath = (year, list, offices = null) =>
  factPath({ profile: "test-port-ellery", fact: "holidays", year, ...(offices ? { offices } : {}), list });

test("R11 (N689) calendarFactsRead also lists each entry of the named closure list a live deadline's closures or observed.closures reads, at its own list=<name> path (the one R12 reads), once each: the test profile's CPRA-like rule counts on 'town' and its observed practice names 'court', so both lists' entries are listed, each once", () => {
  const w = world();
  w.action(A, [...CPL("Town Clerk", "City of Port Ellery"), "clock:", ...CLK("2027-03-01")]);
  w.action(B, CPL("Town Clerk", "City of Port Ellery"));
  w.promote(C, actionMd(C, [...CPL("Selectboard", "Port Ellery Selectboard"), "action_kind: bylaw_complaint"]));
  const rule = TEST.deadlines.find((d) => d.rule === "records_answer");
  assert.deepEqual([rule.count, rule.closures, rule.observed.closures], ["business", "town", "court"], "the profile as the test reads it");
  const r = w.c.calendarFactsRead({ viewer: M });
  const town = listPath(2026, "town"), court = listPath(2026, "court");
  assert.match(town, /list=town/); assert.match(court, /list=court/);
  const hours = factPath({ profile: "test-port-ellery", fact: "hours", office: { role: "Town Clerk", body: "City of Port Ellery" } });
  assert.deepEqual(r.paths.map((p) => [p.path, p.actions.map((x) => x.action)]),
    [[court, [A, B]], [town, [A, B]], [hours, [A, B]]].sort((x, y) => (x[0] < y[0] ? -1 : 1)),
    "each list's 2026 entry (no 2027 entry of either list is held, so none is a fact); never the office calendar's; C's kind has no business-day deadline");
  assert.equal(new Set(r.paths.map((p) => p.path)).size, r.paths.length, "once each");
  /* each listed path is the one R12 reads the entry at, and a member can confirm it there. */
  const read = clocks.factReader(w.localFacts, M);
  for (const [list, path] of [["town", town], ["court", court]]) {
    const h = TEST.holidays.find((x) => x.list === list && x.year === 2026);
    assert.equal(read(h).path, path);
    assert.equal(w.localFacts.factConfirm({ path, act: "confirm", how: "the published list", by: M, viewer: M }).ok, true, path);
  }
  /* so the count's unconfirmed statement names a path calendarFactsRead lists. */
  const fresh = world();
  fresh.action(A, CPL("Town Clerk", "City of Port Ellery"));
  fresh.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-08-12", account: "sent", viewer: M, author: M });
  const p = fresh.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal;
  const paths = fresh.c.calendarFactsRead({ viewer: M }).paths.map((x) => x.path);
  for (const y of p.calendar.years.filter((x) => x.status === "unconfirmed")) assert.ok(paths.includes(y.path), y.path);
});

test("R11 (N689) a list a rule only rolls on is listed; a path a rule and its observed both name is listed once; a list entry for another office, a list no live deadline reads, and a rule naming a list it neither counts nor rolls on read nothing", () => {
  const p = structuredClone(get("test-port-ellery"));
  /* the records request: a calendar count that rolls on 'court', its observed practice 'court' too; a calendar count
     naming 'town' that neither counts nor rolls on it; and the business count, its 'town' list taken off (so it reads
     the office calendar). A 'court' 2027 entry for the Selectboard alone, and a 'town' 2027 entry for all offices. */
  p.deadlines = p.deadlines.map((d) => (d.rule !== "records_answer" ? d : (({ closures, observed, ...rest }) => rest)(d)));
  p.deadlines.push({ ...p.deadlines.find((d) => d.rule === "filing_reply"), rule: "records_roll", applies_to: "records_request",
                     closures: "court", observed: { closures: "court", status: "researched", basis: "TEST" } });
  p.deadlines.push({ ...p.deadlines.find((d) => d.rule === "filing_reply"), rule: "records_plain", applies_to: "records_request",
                     roll: undefined, closures: "town" });
  p.deadlines = p.deadlines.map((d) => JSON.parse(JSON.stringify(d)));
  const court26 = p.holidays.find((h) => h.list === "court" && h.year === 2026);
  p.holidays.push({ ...structuredClone(court26), year: 2027, offices: ["Selectboard"], days: [{ date: "2027-01-01", name: "New Year" }] });
  p.holidays.push({ ...structuredClone(p.holidays.find((h) => h.list === "town" && h.year === 2026)), year: 2027,
                    days: [{ date: "2027-01-01", name: "New Year" }] });
  const w = world({ override: { "test-port-ellery": p } });
  w.action(A, CPL("Town Clerk", "City of Port Ellery"));
  const listed = w.c.calendarFactsRead({ viewer: M }).paths.map((x) => x.path);
  assert.equal(listed.filter((x) => x === listPath(2026, "court")).length, 1, "rolled on, and named by both the rule and its observed: once");
  assert.ok(!listed.includes(listPath(2027, "court", ["Selectboard"])), "another office's list entry is not read");
  assert.ok(!listed.some((x) => /list=town/.test(x)), "'town' is named only by a rule that neither counts nor rolls on it");
  assert.ok(listed.includes(pathOf(TEST, 2026)) && listed.includes(pathOf(TEST, 2027)), "the business count, naming no list, reads the office calendar");
  /* addressed to the Selectboard, its 2027 'court' entry is read. */
  w.action(B, CPL("Selectboard", "Port Ellery Selectboard"));
  const r = w.c.calendarFactsRead({ viewer: M });
  assert.deepEqual(r.paths.find((x) => x.path === listPath(2027, "court", ["Selectboard"])).actions.map((a) => a.action), [B]);
  assert.deepEqual(r.paths.find((x) => x.path === listPath(2026, "court")).actions.map((a) => a.action), [A, B]);
  /* the pure predicate, at its interface. */
  assert.deepEqual(clocks.closureListsRead(p.deadlines.find((d) => d.rule === "records_roll")), ["court"]);
  assert.deepEqual(clocks.closureListsRead(p.deadlines.find((d) => d.rule === "records_plain")), []);
  assert.deepEqual(clocks.closureListsRead(rule0()), ["town", "court"]);
  for (const x of [null, undefined, 3, "x", {}, { count: "business" }]) assert.deepEqual(clocks.closureListsRead(x), [], String(x));
});
const rule0 = () => TEST.deadlines.find((d) => d.rule === "records_answer");

test("R11 at most 500 actions are read, `truncated` stated", () => {
  const w = world();
  const id = (i) => `ACTN-2026-${String(i).padStart(4, "0")}-z`;
  for (let i = 1; i <= 501; i++) w.promote(id(i), actionMd(id(i), [...CPL("Town Clerk", "City of Port Ellery"), "action_kind: records_request"]));
  const r = w.c.calendarFactsRead({ viewer: M });
  assert.equal(r.truncated, true);
  assert.equal(r.paths[0].actions.length, 500);
  assert.ok(!r.paths[0].actions.some((a) => a.action === id(501)));
});

test("R11 each path's actions are answered as {action, project, created_by}, the project and creator as R3 computes them (K1000): one created by a member in a project, one by a machine in another member's project", () => {
  const d = determinations([ALICE]);
  const w = world({ override: OFFICE, conformance: d.conformance });
  for (const x of [d.live, d.unclear]) w.doc(x);
  const rests = (t) => ["action_basis:", `  - target: ${t}`, "    kind: rests_on"];
  const kind = [...CPL("Town Clerk", "City of Port Ellery"), "action_kind: records_request", "clock:", ...CLK("2026-09-01")];
  assert.equal(w.promote(A, actionMd(A, [...kind, ...rests(d.live)])).ok, true);
  const byMachine = w.promote(B, actionMd(B, [...kind, ...rests(d.unclear)]), { author: MACHINE });
  assert.equal(byMachine.ok, true, JSON.stringify(byMachine).slice(0, 300));
  /* a later revision by another member: the creator is still the one whose write created it. */
  assert.equal(w.promote(A, w.text(A).replace("title: ", "title: x"), { author: BOB }).ok, true);
  const want = [{ action: A, project: d.project, created_by: M }, { action: B, project: d.project, created_by: MACHINE }];
  const r = w.c.calendarFactsRead({ viewer: M });
  assert.ok(r.paths.length >= 3);
  for (const p of r.paths) assert.deepEqual(p.actions, want, p.path);
  /* the same as R3 answers them (both carry a past pending entry). */
  assert.deepEqual(w.c.overdueClocks({ viewer: M }).items.map(({ action, project, created_by }) => ({ action, project, created_by })), want);
  /* the project is read as the viewer sees it: a determination the viewer may not see is passed over. */
  assert.deepEqual(w.c.calendarFactsRead({ viewer: BOB }).paths[0].actions.find((a) => a.action === B),
    { action: B, project: null, created_by: MACHINE });
});
