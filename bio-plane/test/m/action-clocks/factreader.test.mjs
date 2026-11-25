/* action-clocks' reader of the calendar's confirmations at its interface (R12; K998, N474, D6): `factReader(localFacts,
   viewer)`, the `factOf` `computeDeadline` takes, over the real `local-facts` module (the fixture's `localFactsOf`), and
   the one reader R10's own count uses. On the test profile. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, officeCalendarProfile } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import { factPath } from "../../../src/local-facts/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const M = V("alice"), BOB = V("bob");
const A = "ACTN-2026-0001-a";
const TEST = combine(["test-port-ellery"]).view;
const entryOf = (year, offices = null) =>
  TEST.holidays.find((h) => h.year === year && JSON.stringify(h.offices ?? null) === JSON.stringify(offices));
const pathOf = (h) => factPath({ profile: h.profile, fact: "holidays", year: h.year, ...(h.offices ? { offices: h.offices } : {}) });
const ALL26 = entryOf(2026), CLERK26 = entryOf(2026, ["Town Clerk"]);
const CPL = ["counterparty:", "  state: named", "  role: Town Clerk", "  body: City of Port Ellery"];
const R5 = { rule: "r", days: 5, count: "business", starts: "received", basis: "TEST" };
const FM = { counterparty: { state: "named", role: "Town Clerk", body: "City of Port Ellery" }, action_kind: "records_request",
             correspondence: [{ direction: "sent", at: "2026-08-12" }] };
const counts = (w) => ["manifest", "files", "local_fact_acts", "action_reminders", "action_clock_proposals"]
  .map((t) => w.rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n);

/* A world with an action addressed to the Town Clerk, received 2026-08-12, whose records_answer deadline is a business
   count reading the 2026 entries for all offices and for the Town Clerk. */
function setUp() {
  const w = world({ override: { "test-port-ellery": officeCalendarProfile() } });
  w.action(A, CPL);
  w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-08-12", account: "sent", viewer: M, author: M });
  const act = (h, a, x = {}) => {
    const r = w.localFacts.factConfirm({ path: pathOf(h), act: a, how: "the clerk's published calendar", by: M, viewer: M, ...x });
    assert.equal(r.ok, true, JSON.stringify(r)); return r;
  };
  const propose = () => w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal;
  return { w, act, propose };
}

test("R12 factReader answers each holiday entry as R10's count reads it, over the real local-facts: unconfirmed, confirmed, corrected (its value, says, member and day) and disputed; it writes nothing; a disputed year is \"disputed in your group's Civicsmith\" (DEC-149)", () => {
  const { w, act } = setUp();
  const read = clocks.factReader(w.localFacts, M);
  assert.equal(typeof read, "function");
  const before = counts(w);
  /* unconfirmed: no member has acted; the profile's value governs. */
  const u = read(CLERK26);
  assert.deepEqual(u, { path: pathOf(CLERK26), status: "unconfirmed", why: u.why, value: CLERK26.days, corrected: false,
                        says: null, by: null, at: null, last_at: null });
  assert.equal(typeof u.why, "string");
  /* confirmed: the latest act's member and day. */
  const c = act(CLERK26, "confirm");
  const k = read(CLERK26);
  assert.deepEqual([k.status, k.value, k.corrected, k.by, k.at], ["confirmed", CLERK26.days, false, M, c.at.slice(0, 10)]);
  /* corrected: the correction's value governs, with its says, member and day. */
  const x = act(CLERK26, "correct", { by: BOB, viewer: BOB, value: [], source: "the clerk's notice of 2026-09-20" });
  const r = read(CLERK26);
  assert.deepEqual(r, { path: pathOf(CLERK26), status: "corrected", why: r.why, value: [], corrected: true,
                        says: `corrected locally by ${BOB}, ${x.at.slice(0, 10)}`, by: BOB, at: x.at.slice(0, 10), last_at: null });
  /* disputed: who disputed it and when. */
  const d = act(ALL26, "dispute", { by: BOB, viewer: BOB });
  const s = read(ALL26);
  assert.deepEqual([s.path, s.status, s.by, s.at, s.corrected], [pathOf(ALL26), "disputed", BOB, d.at.slice(0, 10), false]);
  /* each as the count reads it: the corrected Clerk's closure is not counted, the disputed year leaves it undetermined. */
  const n = clocks.computeDeadline(R5, FM, TEST, { factOf: read });
  assert.equal(n.date, null); assert.match(n.why, /disputed in your team's Civicsmith by member:bob/);
  /* the reads wrote nothing beyond the members' own acts. */
  const acts = counts(w);
  read(CLERK26); read(ALL26); clocks.computeDeadline(R5, FM, TEST, { factOf: read });
  assert.deepEqual(counts(w), acts, "factReader writes nothing");
  assert.equal(acts[2] - before[2], 3, "only the three acts the members made");
});

test("R12 a lapsed confirmation is unconfirmed, naming the day it was made; the count says so", () => {
  const { w, act, propose } = setUp();
  const c = act(CLERK26, "confirm");
  w.clock.ms = Date.parse("2027-01-02T00:00:00Z");
  const r = clocks.factReader(w.localFacts, M)(CLERK26);
  assert.deepEqual([r.status, r.last_at], ["unconfirmed", c.at.slice(0, 10)]);
  /* the count says so, naming the lapsed confirmation's day beside the year never confirmed. */
  const p = propose();
  assert.equal(p.calendar.status, "unconfirmed");
  assert.deepEqual(p.calendar.years.map((y) => [y.path, y.status]), [[pathOf(CLERK26), "unconfirmed"], [pathOf(ALL26), "unconfirmed"]]);
  assert.deepEqual(p.calendar.says, [`counted on an unconfirmed calendar (TEST, ${c.at.slice(0, 10)})`,
                                     "counted on an unconfirmed calendar (TEST, never confirmed here)"]);
});

test("R12 negative controls: an entry naming no local fact, a factStatus that throws or refuses, or an answer local-facts cannot give is absent with why; nothing is thrown; the count says it \"cannot be read in your group's Civicsmith\" (DEC-149)", () => {
  const { w } = setUp();
  const read = clocks.factReader(w.localFacts, M);
  /* an entry naming no local fact (a closure list's name local-facts cannot name among them). */
  for (const h of [{ ...CLERK26, list: "not a list!" }, null, undefined, 7, "x", {}, { profile: "Not A Profile", year: 2026 }, { ...CLERK26, year: "soon" },
                   { ...CLERK26, offices: [] }, { get profile() { throw new Error("x"); } }]) {
    const r = read(h);
    assert.deepEqual([r.status, r.why, r.path], ["absent", word("action-clocks.why.holiday_entry_names"), null], String(h));
  }
  /* a fact the active profiles do not hold: local-facts' own answer (refused or absent), absent with why. */
  const gone = read({ ...CLERK26, year: 2031 });
  assert.equal(gone.status, "absent"); assert.equal(typeof gone.why, "string"); assert.ok(gone.why.length > 0);
  /* a factStatus that throws. */
  const boom = clocks.factReader({ factStatus: () => { throw new Error("storage gone"); } }, M)(CLERK26);
  assert.deepEqual(boom, { path: pathOf(CLERK26), status: "absent", why: "local facts' read failed: storage gone" });
  const odd = clocks.factReader({ factStatus: () => { throw { get message() { throw new Error("x"); } }; } }, M)(CLERK26);
  assert.deepEqual([odd.status, odd.why], ["absent", "local facts' read failed"]);
  /* a factStatus that refuses, or answers nothing. */
  const refused = clocks.factReader({ factStatus: () => ({ ok: false, reason: "NO_SUCH_FACT" }) }, M)(CLERK26);
  assert.deepEqual(refused, { path: pathOf(CLERK26), status: "absent", why: "local facts refused the read: NO_SUCH_FACT" });
  for (const ans of [null, undefined, 3, "x"])
    assert.deepEqual(clocks.factReader({ factStatus: () => ans }, M)(CLERK26),
      { path: pathOf(CLERK26), status: "absent", why: word("action-clocks.why.local_facts_answer") }, String(ans));
  /* an answer local-facts cannot give: a status outside its vocabulary, none, or a shape that throws when read. */
  for (const status of ["maybe", undefined, 4]) {
    const r = clocks.factReader({ factStatus: () => ({ ok: true, status }) }, M)(CLERK26);
    assert.deepEqual([r.status, r.path], ["absent", pathOf(CLERK26)]); assert.equal(r.why, word("action-clocks.why.local_facts_answered", { status: String(status ?? "none") }));
  }
  const trap = clocks.factReader({ factStatus: () => ({ ok: true, status: "confirmed", get governs() { throw new Error("x"); } }) }, M)(CLERK26);
  assert.deepEqual([trap.status, trap.why], ["absent", word("action-clocks.why.local_facts_answered_shape")]);
  /* each such answer makes a business count undetermined, with why, and nothing is thrown. */
  const n = clocks.computeDeadline(R5, FM, TEST, { factOf: clocks.factReader({ factStatus: () => { throw new Error("storage gone"); } }, M) });
  assert.equal(n.date, null); assert.ok(n.why.endsWith(word("action-clocks.why.local_facts_read", { m: ": storage gone" })));
  /* the viewer is passed through: local-facts reads for the viewer named. */
  const seen = [];
  clocks.factReader({ factStatus: (a) => { seen.push(a); return { ok: true, status: "confirmed" }; } }, BOB)(CLERK26);
  assert.deepEqual(seen, [{ path: pathOf(CLERK26), viewer: BOB }]);
});

test("R12 factReader answers null when localFacts has no factStatus, and the count then states its calendar not_read, saying so without calling the group's Civicsmith 'this instance' (DEC-149: \"whether your group has confirmed the calendar was not read\")", () => {
  const trap = { get factStatus() { throw new Error("x"); } };
  for (const lf of [null, undefined, {}, { factStatus: "no" }, 3, "x", trap])
    assert.equal(clocks.factReader(lf, M), null, String(lf));
  const n = clocks.computeDeadline(R5, FM, TEST, { factOf: clocks.factReader({}, M) });
  assert.deepEqual([n.date, n.calendar.status, n.calendar.says], ["2026-08-19", "not_read",
    [word("action-clocks.says.whether_group_confirmed")]]);
  assert.ok(!/this instance|this copy|the plane/.test(JSON.stringify(n.calendar)), "DEC-149");
  /* an instance whose local-facts has no factStatus: the count's own path states not_read too, and counts. */
  const w = world({ override: { "test-port-ellery": officeCalendarProfile() } });
  w.c.localFacts.factStatus = undefined;
  try {
    w.action(A, CPL);
    w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-08-12", account: "sent", viewer: M, author: M });
    const p = w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal;
    assert.deepEqual([p.entry.date, p.calendar.status, p.undetermined], ["2026-08-19", "not_read", undefined]);
  } finally { delete w.c.localFacts.factStatus; }
});

test("R12 one reader: the same count through factReader and through the count's own path (clockPropose) answers alike, at each status", () => {
  const { w, act, propose } = setUp();
  const VIEW = combine([officeCalendarProfile()]).view;
  const rule = VIEW.deadlines.find((d) => d.rule === "records_answer" && d.applies_to === "records_request");
  const via = () => clocks.computeDeadline(rule, w.fm(A), VIEW, { factOf: clocks.factReader(w.localFacts, M) });
  const same = () => {
    const p = propose(), d = via();
    assert.deepEqual([p.entry.date, p.calendar, p.undetermined], [d.date, d.calendar, d.why]);
    return p;
  };
  assert.equal(same().calendar.status, "unconfirmed");
  act(ALL26, "confirm"); act(CLERK26, "confirm");
  assert.equal(same().calendar.status, "confirmed");
  act(CLERK26, "correct", { by: BOB, viewer: BOB, value: [], source: "the clerk's notice" });
  assert.deepEqual([same().calendar.status, propose().entry.date], ["corrected", "2026-08-18"]);
  act(ALL26, "dispute", { by: BOB, viewer: BOB });
  assert.equal(same().entry.date, null);
  /* and for another viewer, the reader reads as that viewer. */
  const other = clocks.computeDeadline(R5, FM, TEST, { factOf: clocks.factReader(w.localFacts, "nobody") });
  assert.equal(other.date, null);
});
