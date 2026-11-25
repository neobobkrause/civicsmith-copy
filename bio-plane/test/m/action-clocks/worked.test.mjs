/* R2's acceptance tests (T33-74): the 20 worked deadline examples of `build/plan/measures-T33/time-law.md` §3, each
   with its negative control, counted by this module's `computeDeadline` (the count `clockPropose` and `filings` use)
   on the first profile's view, whose sourced lists hold the judicial calendars of 2018, 2020 and 2026, the City's and
   the federal 2026 lists (K1519). The examples whose start is not a ledger event (a hearing, service, accrual) are
   counted from the `sent` entry standing for that event, as `filings` hands its start; O1 and F1–F2 go through
   `clockPropose` on an action. The rules are written as the profile writes them (`jurisdictions` R26), each named for
   its source; a rule the profile holds is read from it. Dates in the comments are the example's own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, actionMd } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const M = V("alice");
const FIRST = combine(["oakland-alameda"]).view;
const held = (rule) => FIRST.deadlines.find((d) => d.rule === rule);
const SRC = "2026-10-05 time-law";
const from = (day, kind = "records_request") => ({ action_kind: kind, counterparty: { state: "audience", description: "the public" },
                                                  correspondence: [{ direction: "sent", at: day }] });
const count = (rule, day, view = FIRST) => clocks.computeDeadline({ basis: SRC, status: "researched", ...rule }, from(day, rule.applies_to), view);
const date = (rule, day, view) => count(rule, day, view).date;
/* A view whose list `list` lacks the day `day`: the negative control a wrong calendar would give. */
const without = (list, day) => ({ ...FIRST, holidays: FIRST.holidays.map((h) => (h.list === list ? { ...h, days: h.days.filter((x) => x.date !== day) } : h)) });

/* CCP §1005(b): 16 court days before the hearing; CCP §12, §12a on the judicial list. */
const CCP1005 = { rule: "ccp_1005", units: "days", amount: 16, count: "business", direction: "backward", starts: "filed", closures: "judicial" };

test("R2 worked examples P1–P6 (published, CCP §§12, 12a, 1005): backward court days, the backward roll, calendar days, the forward roll, and each year's own judicial list", () => {
  /* P1: hearing Mon 2018-06-18, Memorial Day 2018-05-28 not counted: 2018-05-24. Negative: counting the holiday, 05-25. */
  assert.equal(date(CCP1005, "2018-06-18"), "2018-05-24");
  assert.equal(date(CCP1005, "2018-06-18", without("judicial", "2018-05-28")), "2018-05-25", "the holiday counted gives the wrong day");
  /* P2: 5 calendar days more for mail, rolled back to a court day: from 2018-05-24, Sat 05-19 rolls back to Fri 05-18. */
  const mail = { rule: "ccp_1005_mail", units: "days", amount: 5, count: "calendar", direction: "backward", roll: true, closures: "judicial", starts: "filed" };
  assert.equal(date(mail, "2018-05-24"), "2018-05-18");
  assert.equal(date({ ...mail, roll: false }, "2018-05-24"), "2018-05-19", "no backward roll gives the Saturday");
  /* P3: 30 calendar days from service on 1 April 2026: Fri 2026-05-01. Negative: the start day counted, 04-30. */
  const thirty = { rule: "ccp_2030_260", units: "days", amount: 30, count: "calendar", computation: "ccp_12", roll: true, closures: "judicial", starts: "filed" };
  assert.equal(date(thirty, "2026-04-01"), "2026-05-01");
  assert.notEqual(date(thirty, "2026-04-01"), "2026-04-30");
  /* P4: 20 calendar days from Fri 2026-04-03; a court holiday inside the period does not move it: Thu 2026-04-23. */
  const twenty = { ...thirty, rule: "twenty", amount: 20 };
  assert.equal(date(twenty, "2026-04-03"), "2026-04-23");
  assert.notEqual(date(twenty, "2026-04-03"), "2026-04-24", "a holiday inside a calendar-day period is not excluded");
  /* P5: 30 days from 2020-10-01: day 30 is Sat 10-31, rolled to Mon 2020-11-02. Negative: no roll, 10-31. */
  assert.equal(date(thirty, "2020-10-01"), "2020-11-02");
  assert.equal(date({ ...thirty, roll: false }, "2020-10-01"), "2020-10-31");
  /* P6: 16 court days before Fri 2020-10-30 on the 2020 judicial list (Columbus Day 10-12 then a judicial holiday):
     2020-10-07. Negative: today's list applied to 2020 (no Columbus Day), 10-08. */
  assert.equal(date(CCP1005, "2020-10-30"), "2020-10-07");
  assert.equal(date(CCP1005, "2020-10-30", without("judicial", "2020-10-12")), "2020-10-08");
});

test("R2 worked examples E1, E2 (published and wrong): the statute's day, never the published one", () => {
  /* E1: CCP §1013(a), 5 calendar days added to 30 for mail, from 2020-10-01: 2020-11-05, never the published 11-06. */
  const e1 = { rule: "ccp_1013a", units: "days", amount: 35, count: "calendar", roll: true, closures: "judicial", starts: "filed" };
  assert.equal(date(e1, "2020-10-01"), "2020-11-05");
  assert.notEqual(date(e1, "2020-10-01"), "2020-11-06");
  /* E2: CCP §1010.6, 2 court days added to 30 for electronic service: day 30 (Sat 10-31) then Mon 11-02, Tue 11-03,
     never the published 11-04. Two rules, the second counted from the first's day. */
  const base = date({ rule: "thirty", units: "days", amount: 30, count: "calendar", starts: "filed" }, "2020-10-01");
  assert.equal(base, "2020-10-31");
  const e2 = date({ rule: "ccp_1010_6", units: "days", amount: 2, count: "business", closures: "judicial", starts: "filed" }, base);
  assert.equal(e2, "2020-11-03");
  assert.notEqual(e2, "2020-11-04");
});

test("R2 worked example R1 (official record, Gov. Code §945.6(a)(1)): six months from 2023-11-17 is 2024-05-17; with the roll the profile's rule asks, a 2024 judicial list not held leaves it undetermined, never counted as though that year had no holidays", () => {
  const r1 = { ...held("claim_suit_after_rejection"), starts: "filed" };
  const c = count(r1, "2023-11-17");
  assert.equal(c.date, null); assert.match(c.why, /2024/);
  assert.equal(date({ ...r1, roll: false }, "2023-11-17"), "2024-05-17");
  assert.notEqual(date({ ...r1, roll: false }, "2023-11-17"), "2024-05-18");
});

test("R2 worked example C1 (OMC 2.20.070(C)): a Monday special meeting's notice is due by noon the Friday before; the 48 business hours are counted from a time, which a ledger day does not hold", () => {
  const monday = { ...held("omc_special_meeting_monday"), starts: "filed" };
  const c = count(monday, "2026-10-19");
  assert.deepEqual([c.date, c.due.value, c.due.precision], ["2026-10-16", "2026-10-16T12:00", "minute"]);
  assert.notEqual(c.due.value, "2026-10-16T12:01");
  /* not a Monday: the rule does not apply. */
  assert.equal(count(monday, "2026-10-20").date, null);
  const hours = count({ ...held("omc_special_meeting_notice"), starts: "filed" }, "2026-10-14");
  assert.equal(hours.date, null); assert.match(hours.why, /anchor's time/);
});

test("R2 worked examples O1–O6 and N6 (the City's portal, CPRA §7922.535): 10 calendar days, rolled on the judicial list the law names, the City's practice answered beside it and never as the rule", () => {
  const cpra = held("records_response");
  const due = (day) => count(cpra, day).date;
  assert.equal(due("2026-10-05"), "2026-10-15", "O1");
  assert.notEqual(due("2026-10-05"), "2026-10-14");
  assert.equal(due("2026-10-01"), "2026-10-12", "O2: Sun 10-11 rolled to Mon");
  assert.equal(date({ ...cpra, roll: false }, "2026-10-01"), "2026-10-11", "O2's negative: no roll gives the Sunday");
  assert.equal(due("2026-09-30"), "2026-10-12", "O3: Sat 10-10 rolled to Mon");
  assert.equal(date({ ...cpra, roll: false }, "2026-09-30"), "2026-10-10", "O3's negative: no roll gives the Saturday");
  assert.equal(due("2026-08-26"), "2026-09-08", "O4: Sat 09-05 past Labor Day to Tue");
  assert.equal(date(cpra, "2026-08-26", without(cpra.closures, "2026-09-07")), "2026-09-07", "O4's negative: Labor Day not a closure gives the Monday");
  assert.equal(due("2026-10-02"), "2026-10-12", "O5: Columbus Day is not a closure (AB 268)");
  assert.notEqual(due("2026-10-02"), "2026-10-13");
  /* O6 / N6: from Tue 2026-09-15 the law's day is Mon 09-28 (Native American Day 09-25 a judicial holiday); the City's
     practice, on its own list, is Fri 09-25, answered labelled as practice. */
  const n6 = count(cpra, "2026-09-15");
  assert.equal(n6.date, "2026-09-28", "N6: the statutory day");
  assert.deepEqual(n6.observed.map((o) => [o.label, o.closures, o.date]), [["observed practice", "city", "2026-09-25"]], "O6: the practice, beside it");
  /* the extension, computed (C-2): 14 days from day 10 before the roll (09-25 → 10-09) or after it (09-28 → 10-12),
     both kept, since the sources leave it open (K1504 (2)). */
  assert.deepEqual(n6.extension.due.candidates.map((x) => x.value), ["2026-10-09", "2026-10-12"]);
  /* O1 through the act: an action's sent entry, the proposal labelled and stored. */
  const w = world({ profiles: ["oakland-alameda"] });
  const A = "ACTN-2026-0001-a";
  assert.equal(w.promote(A, actionMd(A, ["counterparty:", "  state: audience", "  description: the public", "action_kind: records_request"])).ok, true);
  w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-10-05", account: "sent", viewer: M, author: M });
  const p = w.c.clockPropose({ target: A, rule: "records_response", proposer: M, viewer: M });
  assert.deepEqual([p.proposal.entry.date, p.proposal.entry.basis_kind], ["2026-10-15", "rule"]);
  assert.match(p.proposal.entry.basis, /7922\.535\(a\)/);
});

test("R2 worked examples F1–F3 (derived, FOIA 5 U.S.C. §552(a)(6)): 20 working days on the federal list, its 10-day extension", () => {
  const foia = held("foia_response");
  /* F1: from Mon 2026-10-05, Columbus Day 10-12 a federal holiday: Tue 2026-11-03. Negative: 10-12 counted, 11-02. */
  const f1 = count(foia, "2026-10-05");
  assert.equal(f1.date, "2026-11-03");
  assert.equal(date(foia, "2026-10-05", without("federal", "2026-10-12")), "2026-11-02");
  /* F2: the extension, 10 working days more, Veterans Day 11-11 skipped: Wed 2026-11-18. Negative: 11-17. */
  assert.equal(f1.extension.due.value, "2026-11-18");
  assert.notEqual(f1.extension.due.value, "2026-11-17");
  /* F3: from Wed 2026-11-04, Veterans Day and Thanksgiving skipped: Fri 2026-12-04. Negative: 12-03. */
  assert.equal(date(foia, "2026-11-04"), "2026-12-04");
  assert.notEqual(date(foia, "2026-11-04"), "2026-12-03");
  /* every count states the federal list it read (R10); a pure caller reads no confirmation of it (R12). */
  assert.ok(f1.calendar.years.length && f1.calendar.years.every((y) => y.list === "federal" && y.status === "not_read"));
});
