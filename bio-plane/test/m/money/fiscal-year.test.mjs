/* money R34, R39-R41 (T53; N1257; DEC-458): a fiscal key is mapped by the government's own year; the fiscal-year view is
   offered only where the year is known. Driven at the interface: `recordFact`, `fiscalYears`. The team's stated year is
   `local-facts`' (its R30-R32); its tests are named below until that service is merged here. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, ANN } from "./fixture.mjs";
import { localFactsOf, TEAM_ZONE_PATH } from "../../../src/local-facts/index.mjs";

const noStar = (r) => { for (const [k, v] of Object.entries(r)) if (typeof v === "string") assert.doesNotMatch(v, /\*/, k); };
const PROFILE = "test-port-ellery";
/* no place profile installed, the team's zone stated, as a team with no records is */
function bare() {
  const s = seeded();
  s.record.setSetting("jurisdiction_profiles", [], "test");
  const said = localFactsOf(s.host).factConfirm({ path: TEAM_ZONE_PATH, act: "correct", value: "America/Halifax",
    how: "the team's administrator chose it", source: "stated by the team's administrator", by: ANN, viewer: ANN });
  assert.equal(said.ok, true);
  return s;
}

test("R39 control: the same fiscal key with {from, to} is accepted as before; a named body in the records maps by its own year", () => {
  const s = seeded();
  const r = s.m.recordFact(s.fact({ period: { fiscal: "HD2014", body: "Port Ellery Harbour District" } }));
  assert.equal(r.ok, true);
  assert.deepEqual([s.m.readFact({ factId: r.fact_id, viewer: ANN }).fact.period.from, s.m.readFact({ factId: r.fact_id, viewer: ANN }).fact.period.to], ["2013-10-01", "2014-09-30"]);
  assert.equal(s.m.recordFact(s.fact({ period: { from: "2013-10-01", to: "2014-09-30" } })).ok, true);
});

test("R39 a government named with no year in the records and none stated is refused MONEY_BAD_PERIOD, the sentence naming it and holding no `*`", () => {
  const s = bare();
  const r = s.m.recordFact(s.fact({ period: { fiscal: "FY2026-27", body: "Bville" } }));
  assert.equal(r.code, "MONEY_BAD_PERIOD");
  assert.match(r.detail, /Bville/);
  assert.match(r.detail, /FY2026-27/);
  noStar(r);
  assert.equal(s.m.checkConstant({ role: "period", value: "FY2026-27" }).code, "MONEY_BAD_PERIOD");
});

test("R39 control: a fiscal key with no body is refused as R34 states, no `*` in the sentence, and a stated year is never read for it", () => {
  const s = bare();
  const r = s.m.recordFact(s.fact({ period: { fiscal: "FY2026-27" } }));
  assert.equal(r.code, "MONEY_BAD_PERIOD");
  noStar(r);
  assert.match(r.detail, /FY2026-27/);
});

test("R40 the governments whose year is known: the records' named one with its origin, the `*` entry once as every government, never named `*`", () => {
  const s = seeded();
  const r = s.m.fiscalYears({ viewer: ANN });
  assert.equal(r.ok, true);
  assert.deepEqual(r.years.map((y) => y.body), ["Port Ellery Harbour District"]);
  assert.deepEqual([r.years[0].start, r.years[0].named_by, r.years[0].from], ["10-01", "end", "records"]);
  assert.deepEqual([r.every.start, r.every.named_by, r.every.from], ["04-01", "start", "records"]);
  assert.equal(r.says, undefined);
  assert.equal(JSON.stringify(r).includes('"*"'), false, "nothing answered holds * as a government");
  assert.equal(r.years.some((y) => y.body === "*"), false);
});

test("R40 asked of one government: known with its year, the `*` entry covering any government; none known gives the sentence naming it", () => {
  const s = seeded();
  const hd = s.m.fiscalYears({ body: "Port Ellery Harbour District" });
  assert.deepEqual([hd.known, hd.year.start, hd.year.from, hd.year.body], [true, "10-01", "records", "Port Ellery Harbour District"]);
  assert.deepEqual([s.m.fiscalYears({ body: "Anywhere" }).known, s.m.fiscalYears({ body: "Anywhere" }).year.start], [true, "04-01"]);
  s.record.setSetting("jurisdiction_profiles", [], "test");
  const none = s.m.fiscalYears({ body: "Bville" });
  assert.deepEqual([none.ok, none.known, none.year], [true, false, undefined]);
  assert.match(none.says, /Bville/);
  assert.match(none.says, /state/i);
  noStar(none);
});

test("R40 with no layer and nothing stated the list is empty with the none-known sentence naming no government; reading writes nothing", () => {
  const s = seeded();
  s.record.setSetting("jurisdiction_profiles", [], "test");
  const count = () => s.one(`SELECT (SELECT count(*) FROM money_facts) AS n`).n;
  const before = count();
  const r = s.m.fiscalYears({ viewer: ANN });
  assert.deepEqual([r.ok, r.years, r.every], [true, [], null]);
  assert.equal(typeof r.says, "string");
  noStar(r);
  assert.equal(count(), before);
  assert.equal(PROFILE.length > 0, true);
});

test("R40 the op arm and its declaration: moneyfiscalyears is a read declared by its owner under the name it is served by", async () => {
  const { moneyOps, DECLARED_OPS } = await import("../../../src/money/index.mjs");
  const s = seeded();
  const url = new URL(`https://do.invalid/?${new URLSearchParams({ body: "Port Ellery Harbour District", viewer: ANN })}`);
  assert.equal(moneyOps(s.m, url, null).moneyfiscalyears().known, true);
  const d = DECLARED_OPS.moneyfiscalyears;
  assert.deepEqual([d.classes, d.mutating, d.weight, d.fields.requires], [["admin", "member", "probe"], false, "read", []]);
});

/* A government's year stated by a member (local-facts R31), through the real module. */
const B = "team/city:Bville/fiscal_year", C = "team/city:Cville/fiscal_year";
const YEAR = (body) => ({ body, start: "07-01", named_by: "end", label: "FY{start}-{end2}" });
const state = (s, path, body, how = "read the budget page at its address") =>
  localFactsOf(s.host).factConfirm({ path, act: "correct", value: YEAR(body), how, by: ANN, viewer: ANN });
const period = (s, key, body) => s.m.recordFact(s.fact({ period: { fiscal: key, ...(body ? { body } : {}) } }));

test("R39 a stated year maps a key as a record's does: refused before the statement, the sentence naming B; recorded after; never used for C or for a key with no body", () => {
  const s = bare();
  const before = period(s, "FY2026-27", "Bville");
  assert.equal(before.code, "MONEY_BAD_PERIOD");
  assert.match(before.detail, /Bville/);
  noStar(before);
  assert.equal(state(s, B, "Bville").ok, true);
  const r = period(s, "FY2026-27", "Bville");
  assert.equal(r.ok, true);
  const p = s.m.readFact({ factId: r.fact_id, viewer: ANN }).fact.period;
  assert.deepEqual([p.from, p.to, p.fiscal, p.body], ["2026-07-01", "2027-06-30", "FY2026-27", "Bville"]);
  const c = period(s, "FY2026-27", "Cville");
  assert.equal(c.code, "MONEY_BAD_PERIOD");
  assert.match(c.detail, /Cville/);
  noStar(c);
  const none = period(s, "FY2026-27");
  assert.equal(none.code, "MONEY_BAD_PERIOD");
  noStar(none);
  assert.equal(s.m.recordFact(s.fact({ period: { from: "2026-07-01", to: "2027-06-30" } })).ok, true);
});

test("R40 after a member states B's year it is answered as stated, with who and when and how; a government neither holds is not listed", () => {
  const s = bare();
  assert.equal(state(s, B, "Bville", "the clerk, by phone").ok, true);
  const r = s.m.fiscalYears({ viewer: ANN });
  assert.deepEqual(r.years.map((y) => y.body), ["Bville"]);
  const y = r.years[0];
  assert.deepEqual([y.from, y.start, y.named_by, y.status, y.government], ["stated", "07-01", "end", "confirmed", { level: "city", place: "Bville" }]);
  assert.match(y.stated.says, new RegExp(`${ANN}.*2026-10-0[56]`));
  assert.equal(y.stated.how, "the clerk, by phone");
  assert.equal(r.every, null);
  assert.deepEqual([s.m.fiscalYears({ body: "Bville" }).known, s.m.fiscalYears({ body: "Cville" }).known], [true, false]);
  assert.match(s.m.fiscalYears({ body: "Cville" }).says, /Cville/);
  noStar(s.m.fiscalYears({ body: "Cville" }));
});

test("R41 a lapsed stated year is known, answers unconfirmed and still maps; a disputed one answers disputed with the dispute named; the records' year carries no status", () => {
  const s = bare();
  state(s, B, "Bville");
  state(s, C, "Cville");
  s.lfClock.now = "2027-06-01T12:00:00.000Z";
  const lapsed = s.m.fiscalYears({ body: "Bville" });
  assert.deepEqual([lapsed.known, lapsed.year.status], [true, "unconfirmed"]);
  assert.equal(period(s, "FY2026-27", "Bville").ok, true, "a lapsed year still maps");
  const d = localFactsOf(s.host).factConfirm({ path: C, act: "dispute", how: "the page says otherwise", by: "member:dan", viewer: "member:dan" });
  assert.equal(d.ok, true);
  const disputed = s.m.fiscalYears({ body: "Cville" });
  assert.deepEqual([disputed.known, disputed.year.status], [true, "disputed"]);
  assert.match(disputed.year.dispute, /member:dan/);
  assert.equal(period(s, "FY2026-27", "Cville").ok, true, "a disputed year still maps");
  const rec = seeded().m.fiscalYears({ body: "Port Ellery Harbour District" });
  assert.deepEqual([rec.year.from, rec.year.status, rec.year.stated], ["records", undefined, undefined]);
});
