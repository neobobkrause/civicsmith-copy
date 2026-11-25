/* action-clocks' reads across actions and its proposal, at its interface (R1, R2, R7). Moved from `actions`' tests with
   the split (K617, K624 (1)), their assertions kept and their ids renamed: `read.test.mjs` "R31 …" and "R32 …",
   `t11.test.mjs` "R31 …" and `t12.test.mjs` "R31 (N311) …" (R31 → R1, R32 → R2); R35's share of "R25 R26 R35 …" is R7's
   test in `overdue.test.mjs`. T33-74: R2's count is civil-time's, and `received` is counted from the group's `sent`
   entry (C-1: the old test here counted it from a `received` entry, corrected); the worked examples of
   `measures-T33/time-law.md` §3 are `worked.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, actionMd, CP, CLK, officeCalendarProfile } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import { get as profile, combine } from "../../../../jurisdictions/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const M = V("alice");
const A = "ACTN-2026-0001-a", B = "ACTN-2026-0002-b", C = "ACTN-2026-0003-c";
const id = (i) => `ACTN-2026-${String(i).padStart(4, "0")}-z`;
const key = (x) => `${x.action}:${x.ord}`;
/* Every entry, by paging from the start through each `cursor` to null. */
function pages(w, opts) {
  const out = [], seen = [];
  let after = opts.after ?? null;
  for (let n = 0; n < 5000; n++) {
    const p = w.c.pendingClocks({ before: "2026-10-01", viewer: M, ...opts, after });
    assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
    assert.ok(!("cut_inside" in p), "cut_inside retires (K380)");
    assert.ok(p.items.length <= p.limit);
    out.push(...p.items); seen.push(p);
    assert.equal(p.cursor === null, !p.truncated, "a cursor exactly when truncated");
    if (!p.truncated) return { items: out, pages: seen };
    assert.equal(p.cursor, `${p.items[p.items.length - 1].action}#${p.items[p.items.length - 1].ord}`, "the last entry answered");
    after = p.cursor;
  }
  throw new Error("paging did not reach a null cursor");
}

test("R1 pendingClocks lists pending entries dated before `before` across visible actions, at most 500; a bad `before` is its own refusal", () => {
  const w = world();
  w.action(A, ["clock:", ...CLK("2026-09-01"), ...CLK("2026-09-05", "met"), ...CLK("2026-12-01")]);
  const r = w.c.pendingClocks({ before: "2026-10-01", viewer: M });
  assert.deepEqual(r.items, [{ action: A, ord: 0, date: "2026-09-01", basis: "Act s.2", text: "t", past: true, due_at: null, due_zone: null }]);
  assert.equal(r.limit, 500); assert.equal(r.truncated, false);
  assert.equal(w.c.pendingClocks({ before: "2026-10-01", viewer: "nobody" }).items.length, 0);
  const bad = w.c.pendingClocks({ before: "soon", viewer: M });
  assert.deepEqual([bad.ok, bad.reason, bad.code, bad.check, bad.before], [false, "PENDING_CLOCKS_BAD_BEFORE", "PENDING_CLOCKS_BAD_BEFORE", "C-117.5", "soon"],
    "its own code, not C-33.6's");
  assert.equal(bad.translation, clocks.ACTION_CLOCK_CHECKS.PENDING_CLOCKS_BAD_BEFORE.translation);
  assert.equal(clocks.ACTION_CLOCK_CHECKS.PENDING_CLOCKS_BAD_BEFORE.where, "src/action-clocks/index.mjs pendingClocks > is-pending-before");
  for (const before of [undefined, null, "", "2026-1-01"]) assert.equal(w.c.pendingClocks({ before, viewer: M }).reason, "PENDING_CLOCKS_BAD_BEFORE");
  w.action(B, ["clock:", ...CLK("2026-01-01"), ...CLK("2026-01-02")]);
  assert.deepEqual([w.c.pendingClocks({ before: "2026-10-01", limit: 2, viewer: M }).truncated], [true]);
  /* an entry dated on `before` is not before it. */
  assert.deepEqual(w.c.pendingClocks({ before: "2026-09-01", viewer: M }).items.map(key), [`${B}:0`, `${B}:1`]);
});

test("R1 pendingClocks reads at most 500 actions a page in id order after `after`; `cursor` is the last entry answered when `truncated`, else null; no entry is lost across pages", () => {
  const w = world();
  for (let i = 1; i <= 501; i++) w.promote(id(i), actionMd(id(i), [...CP, "action_kind: other", "clock:", ...CLK("2026-01-01")]));
  const p1 = w.c.pendingClocks({ before: "2026-10-01", viewer: M });
  assert.deepEqual([p1.items.length, p1.truncated, p1.cursor, p1.actions_limit, p1.limit], [500, true, `${id(500)}#0`, 500, 500]);
  const p2 = w.c.pendingClocks({ before: "2026-10-01", after: p1.cursor, viewer: M });
  assert.deepEqual([p2.items.length, p2.items[0].action, p2.truncated, p2.cursor], [1, id(501), false, null]);
  /* The seek is the projection's clock: an action whose next pending date is not before `before` is not among the 500
     read, so a page of such actions does not hide one that has an entry. */
  const x = world();
  for (let i = 1; i <= 501; i++)
    x.promote(id(i), actionMd(id(i), [...CP, "action_kind: other", "clock:", ...CLK(i === 501 ? "2026-01-01" : "2026-02-01")]));
  const q1 = x.c.pendingClocks({ before: "2026-01-15", viewer: M });
  assert.deepEqual([q1.items.map((e) => e.action), q1.truncated, q1.cursor], [[id(501)], false, null]);
  /* and a page that reads no action says so: no cursor, nothing follows. */
  assert.deepEqual([x.c.pendingClocks({ before: "2026-01-15", viewer: M, after: id(501) }).cursor,
                    x.c.pendingClocks({ before: "2026-01-15", viewer: M, after: id(501) }).truncated], [null, false]);
});

test("R1 (N311) a page runs in (action, position) order and may end inside an action: its cursor `<action>#<position>` resumes after that entry, at the page bound and across it", () => {
  const w = world();
  w.action(A, ["clock:", ...CLK("2026-09-01")]);
  w.action(B, ["clock:", ...CLK("2026-01-01"), ...CLK("2026-01-05", "met"), ...CLK("2026-01-02"), ...CLK("2026-12-01"), ...CLK("2026-01-03")]);
  w.action(C, ["clock:", ...CLK("2026-02-01")]);
  const all = [`${A}:0`, `${B}:0`, `${B}:2`, `${B}:4`, `${C}:0`];
  const p1 = w.c.pendingClocks({ before: "2026-10-01", limit: 2, viewer: M });
  assert.deepEqual([p1.items.map(key), p1.truncated, p1.cursor], [[`${A}:0`, `${B}:0`], true, `${B}#0`]);
  const p2 = w.c.pendingClocks({ before: "2026-10-01", limit: 2, after: p1.cursor, viewer: M });
  assert.deepEqual([p2.items.map(key), p2.truncated, p2.cursor], [[`${B}:2`, `${B}:4`], true, `${B}#4`]);
  const p3 = w.c.pendingClocks({ before: "2026-10-01", limit: 2, after: p2.cursor, viewer: M });
  assert.deepEqual([p3.items.map(key), p3.truncated, p3.cursor], [[`${C}:0`], false, null]);
  const exact = w.c.pendingClocks({ before: "2026-10-01", limit: 5, viewer: M });
  assert.deepEqual([exact.items.map(key), exact.truncated, exact.cursor], [all, false, null]);
  const one = w.c.pendingClocks({ before: "2026-10-01", limit: 4, viewer: M });
  assert.deepEqual([one.items.length, one.truncated, one.cursor], [4, true, `${B}#4`]);
  for (let k = 1; k <= 6; k++) assert.deepEqual(pages(w, { limit: k }).items.map(key), all, `limit ${k}`);
  assert.deepEqual(pages(w, { limit: 2, after: A }).items.map(key), all.slice(1));
  assert.deepEqual(pages(w, { limit: 2, after: B }).items.map(key), [`${C}:0`]);
  assert.deepEqual(p2.items[0], { action: B, ord: 2, date: "2026-01-02", basis: "Act s.2", text: "t", past: true, due_at: null, due_zone: null });
});

test("R1 (N311) an action with more pending clock entries than a page (500) is read whole across pages", () => {
  const w = world();
  const many = (n) => ["clock:", ...Array.from({ length: n }, (_, i) => CLK(`2026-0${1 + (i % 9)}-0${1 + (i % 9)}`)).flat()];
  w.action(A, many(501));
  w.action(B, ["clock:", ...CLK("2026-03-03")]);
  const p1 = w.c.pendingClocks({ before: "2026-10-01", viewer: M });
  assert.deepEqual([p1.items.length, new Set(p1.items.map((x) => x.action)).size, p1.truncated, p1.cursor, p1.limit],
    [500, 1, true, `${A}#499`, 500]);
  const p2 = w.c.pendingClocks({ before: "2026-10-01", after: p1.cursor, viewer: M });
  assert.deepEqual([p2.items.map(key), p2.truncated, p2.cursor], [[`${A}:500`, `${B}:0`], false, null]);
  const whole = pages(w, {}).items;
  assert.equal(whole.length, 502);
  assert.deepEqual(whole.map(key), [...Array.from({ length: 501 }, (_, i) => `${A}:${i}`), `${B}:0`], "every entry, once, in order");
  const x = world();
  x.action(A, many(500));
  const q = x.c.pendingClocks({ before: "2026-10-01", viewer: M });
  assert.deepEqual([q.items.length, q.truncated, q.cursor], [500, false, null]);
  assert.equal(w.c.pendingClocks({ before: "2026-10-01", viewer: "nobody" }).items.length, 0);
  assert.deepEqual(pages(w, { before: "2026-01-02" }).items.map(key), [`${A}:0`, `${A}:9`, `${A}:18`].concat(
    Array.from({ length: 501 }, (_, i) => i).filter((i) => i % 9 === 0 && i > 18).map((i) => `${A}:${i}`)));
});

test("R2 clockPropose computes from the profile's deadline through civil-time, stored apart with its trace and labelled; refusals in order; never written into clock[]", () => {
  const w = world();
  const pe = profile("test-port-ellery");
  const dl = pe.deadlines.find((d) => d.applies_to === "records_request");
  w.action(A);
  const P = (x) => w.c.clockPropose({ target: A, rule: dl.rule, proposer: MACHINE, viewer: MACHINE, ...x });
  const und = P({});
  assert.equal(und.ok, true); assert.equal(und.proposal.entry.date, null, "no start event in the ledger");
  assert.ok([word("action-clocks.why.action_ledger_holds"), word("action-clocks.why.action_ledger_holds_sent")].includes(und.proposal.undetermined));
  /* C-1: `received` is the counterparty's receipt of the group's request, counted from the group's own `sent` entry:
     a `received` entry alone starts nothing (the correction of this test's old reading, which counted from it). */
  assert.equal(w.actions.actionCorrespond({ target: A, direction: "received", at: "2026-08-20", account: "got it", viewer: M, author: M }).ok, true);
  assert.equal(P({}).proposal.entry.date, null, "a received entry is not the start");
  assert.equal(w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-09-01", account: "sent it", viewer: M, author: M }).ok, true);
  const before = w.text(A);
  const p = P({});
  assert.equal(p.ok, true); assert.equal(p.evidence, false); assert.equal(p.proposal.machine_work, true);
  assert.equal(p.proposal.state, "machine_proposed"); assert.equal(p.proposal.says, word("action-clocks.machine_credential_computed"));
  assert.equal(p.proposal.counted_from, "the day after 2026-09-01", "counted from the day after the start event (B4)");
  /* Tue 2026-09-01, 5 business days on the 'town' list the rule names, the profile's weekend Sunday alone: Wed 2, Thu 3,
     Fri 4, Sat 5, (Sun 6), Mon 7. */
  assert.equal(p.proposal.entry.date, "2026-09-07");
  assert.match(p.proposal.entry.basis, new RegExp(dl.citation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(p.proposal.entry.basis, /profile basis: TEST/);
  assert.deepEqual(Object.keys(p.proposal.entry).sort(), ["basis", "basis_kind", "date", "description", "owed_by", "status", "text"]);
  assert.equal(p.proposal.entry.owed_by, "undetermined", "R18: the profile's deadline does not say whose it is");
  assert.deepEqual([p.proposal.start_from, p.proposal.start_note], ["sent", word("action-clocks.note.receipt_recorded_counted")]);
  assert.equal(p.proposal.entry.basis_kind, "rule", "R7: a profile deadline's basis is a rule");
  assert.equal(p.proposal.key, `${dl.rule}@${MACHINE}`);
  /* civil-time's trace is answered with it: the rule, its citation, the list counted on, the Sunday skipped (C-2). */
  assert.deepEqual([p.proposal.trace.rule, p.proposal.trace.citation, p.proposal.trace.closures], [dl.rule, dl.citation, "town"]);
  assert.deepEqual(p.proposal.trace.skipped.map((x) => x.day), ["2026-09-06"]);
  /* the extension is computed, never ignored (C-2): 5 more business days from Mon 7: Tue 8 … Sat 12. */
  assert.equal(p.proposal.extension.due.value, "2026-09-12");
  /* the body's observed practice ('court') is answered beside the rule, labelled, never as it. */
  assert.deepEqual(p.proposal.observed.map((o) => [o.label, o.closures, o.date]), [["observed practice", "court", "2026-09-07"]]);
  assert.equal(w.text(A), before, "the action's document is unchanged");
  assert.equal(w.fm(A).clock, undefined, "never written into clock[]");
  const row = w.rows(`SELECT * FROM action_clock_proposals WHERE bundle_id=?`, A);
  assert.equal(row.length, 1, "a restatement replaces the proposer's own row");
  assert.equal(row[0].proposed_by, MACHINE); assert.deepEqual(JSON.parse(row[0].entry_json), p.proposal.entry);
  assert.deepEqual(JSON.parse(row[0].trace_json).trace, p.proposal.trace, "the trace is kept with the proposal");
  /* a member's proposal is labelled as one, and is a second row. */
  const mine = w.c.clockPropose({ target: A, rule: dl.rule, proposer: M, viewer: M });
  assert.deepEqual([mine.proposal.state, mine.proposal.machine_work], ["member_proposed", false]);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM action_clock_proposals WHERE bundle_id=?`, A)[0].n, 2);
  /* refusals in order: NO_AUTHOR, NO_TARGET, NO_SUCH_BUNDLE (absent and invisible alike), NOT_AN_ACTION, NO_SUCH_RULE. */
  assert.equal(P({ proposer: "" }).reason, "NO_AUTHOR");
  assert.equal(P({ proposer: "", target: "" }).reason, "NO_AUTHOR");
  assert.equal(P({ rule: undefined, target: "" }).reason, "NO_TARGET");
  assert.equal(P({ rule: undefined, target: "ACTN-2026-0404-x" }).reason, "NO_SUCH_BUNDLE", "after NO_SUCH_BUNDLE, in order");
  assert.equal(P({ viewer: "nobody" }).reason, "NO_SUCH_BUNDLE", "invisible answers as absent");
  w.doc("INFO-2026-0001-d");
  assert.equal(P({ target: "INFO-2026-0001-d", rule: undefined }).reason, "NOT_AN_ACTION");
  const no = P({ rule: "no_such" });
  assert.equal(no.reason, "NO_SUCH_RULE"); assert.match(no.detail, /no_such/); assert.match(no.detail, /records_request/);
  /* N246: an absent rule has no code of its own; it is answered NO_SUCH_RULE at that code's place. */
  for (const rule of [undefined, null, ""]) assert.equal(P({ rule }).reason, "NO_SUCH_RULE");
  assert.ok(!("NO_RULE" in clocks.ACTION_CLOCK_CHECKS));
  /* a rule of the profile for another kind does not apply to this action's. */
  assert.equal(P({ rule: "claim_notice" }).reason, "NO_SUCH_RULE");
  /* no active profile: no rule applies. */
  const bare = world({ profiles: null });
  bare.action(A);
  assert.equal(bare.c.clockPropose({ target: A, rule: dl.rule, proposer: M, viewer: M }).reason, "NO_SUCH_RULE");
});

test("R2 a rule held without a primary source is no basis (UNMEASURED, K1445): a profile holding one does not combine, and the count itself refuses it; a sourced rule counts", () => {
  const variant = officeCalendarProfile();
  variant.deadlines = variant.deadlines.map((d) => (d.rule === "records_answer" ? { ...d, basis: "UNMEASURED" } : d));
  const w = world({ override: { "test-port-ellery": variant } });
  w.action(A);
  w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-09-01", account: "sent it", viewer: M, author: M });
  /* the profile is refused whole where it is combined (jurisdictions R44: UNMEASURED is BASIS_INVALID for a deadline), so
     no rule of it applies and nothing is counted. */
  assert.equal(combine([variant]).ok, false);
  const p = w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M });
  assert.deepEqual([p.ok, p.reason], [false, "NO_SUCH_RULE"]);
  /* computeDeadline itself refuses an UNMEASURED basis, whatever its caller. */
  const d = { rule: "r", units: "days", amount: 5, count: "calendar", starts: "filed", basis: "UNMEASURED" };
  const c = clocks.computeDeadline(d, { correspondence: [{ direction: "sent", at: "2026-09-01" }] }, null);
  assert.equal(c.date, null); assert.equal(c.why, localize("action-clocks.index.the_rule_is_not_held", "the rule is not held with a primary source: UNMEASURED is not a basis"));
  assert.equal(clocks.computeDeadline({ ...d, basis: "TEST" }, { correspondence: [{ direction: "sent", at: "2026-09-01" }] }, null).date, "2026-09-06");
});

test("R2 a business-day count runs on the profile's weekend and holiday calendar through civil-time (C-2), and is undetermined, with why, where it reaches a year the calendar does not list or the profile holds no weekend; a calendar count adds days", () => {
  const d = { rule: "r", units: "days", amount: 5, count: "business", starts: "received", basis: "TEST" };
  const view = combine(["test-port-ellery"]).view;
  const fm = (at) => ({ correspondence: [{ direction: "sent", at }] });
  const ds = ({ date, start }) => ({ date, start });   /* R10's `calendar` statement is its own test's (calendar.test.mjs) */
  /* Wednesday 2026-07-01, the profile's weekend Sunday alone: Thu 2, (Fri 3 a holiday for all offices), Sat 4, (Sun 5),
     Mon 6, Tue 7, Wed 8. A weekend in code (Saturday too) would give the 9th. */
  assert.deepEqual(ds(clocks.computeDeadline(d, fm("2026-07-01"), view)), { date: "2026-07-08", start: "2026-07-01" });
  /* Friday 2026-09-04: Sat 5, (Sun 6), Mon 7 … Thu 10. */
  assert.deepEqual(ds(clocks.computeDeadline(d, fm("2026-09-04"), view)), { date: "2026-09-10", start: "2026-09-04" });
  /* past the calendar's last year (2027): undetermined, naming the year. */
  const far = clocks.computeDeadline(d, fm("2027-12-28"), view);
  assert.deepEqual([far.date, far.start], [null, "2027-12-28"]); assert.match(far.why, /2028/);
  /* no weekend held: never assumed (C-2). */
  const noWeekend = clocks.computeDeadline(d, fm("2026-07-01"), { ...view, weekend: undefined });
  assert.equal(noWeekend.date, null); assert.match(noWeekend.why, /weekend/);
  assert.match(clocks.computeDeadline(d, fm("2026-07-01"), null).why, /weekend/, "no view at all: undetermined");
  assert.deepEqual(ds(clocks.computeDeadline({ ...d, count: "calendar", amount: 30 }, fm("2026-09-01"), null)), { date: "2026-10-01", start: "2026-09-01" });
  assert.deepEqual(ds(clocks.computeDeadline({ ...d, starts: "filed", count: "calendar", amount: 1 }, fm("2026-06-01"), null)), { date: "2026-06-02", start: "2026-06-01" });
  /* C-1: received is counted from the group's sent entry, never from a received entry. */
  const both = { correspondence: [{ direction: "received", at: "2026-06-20" }, { direction: "sent", at: "2026-07-01" }] };
  assert.equal(clocks.computeDeadline(d, both, view).date, "2026-07-08");
  assert.match(clocks.computeDeadline(d, { correspondence: [{ direction: "received", at: "2026-07-01" }] }, view).why, /no sent entry/);
  assert.match(clocks.computeDeadline({ ...d, starts: "known" }, fm("2026-09-01"), view).why, /known/);
  assert.match(clocks.computeDeadline({ ...d, count: "lunar" }, fm("2026-09-01"), view).why, /neither calendar nor business/);
  assert.match(clocks.computeDeadline({ ...d, amount: 1.5 }, fm("2026-09-01"), view).why, /whole number/);
  /* hours are counted from the event's time, which a ledger day does not hold (C-4): undetermined, with why. */
  assert.match(clocks.computeDeadline({ rule: "h", units: "hours", amount: 36, direction: "backward", starts: "filed", basis: "TEST" },
    fm("2026-09-01"), view).why, /hours rule counts from the anchor's time/);
  /* through the act: the proposal says why it is undetermined. */
  const w = world();
  w.action(A);
  w.actions.actionCorrespond({ target: A, direction: "sent", at: "2026-12-30", account: "sent it", viewer: M, author: M });
  const p = w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M });
  assert.deepEqual([p.ok, p.proposal.entry.date], [true, null]); assert.match(p.proposal.undetermined, /2027/);
  assert.equal(w.rows(`SELECT date, why FROM action_clock_proposals WHERE bundle_id=?`, A)[0].date, null);
});

test("R2 the close of business is the governing office's close on the due day (C-4), and an uncertain due date is offered with both candidates, the group's own deadline taking the earliest (K1444 (i))", () => {
  const view = combine(["test-port-ellery"]).view;
  /* registry_answer: 4 business days on the 'court' list, due at the close of business: the venue of a commitment
     claim holds no hours, so the close is undetermined and the due stays a day, saying so. */
  const reg = view.deadlines.find((x) => x.rule === "registry_answer");
  const at = { counterparty: { state: "audience", description: "the court" }, action_kind: "commitment_claim",
               correspondence: [{ direction: "sent", at: "2026-09-01" }] };
  const c = clocks.computeDeadline(reg, at, view);
  assert.deepEqual([c.date, c.due.precision], ["2026-09-05", "day"]);
  assert.match(c.trace.notes.join(" "), /close of business is undetermined/);
  /* the Town Clerk's hours close at 12:00 on a Friday: a close-of-business rule for that office is due then. */
  const clerk = { counterparty: { state: "named", role: "Town Clerk", body: "City of Port Ellery" }, action_kind: "commitment_claim",
                  correspondence: [{ direction: "sent", at: "2026-09-01" }] };
  const cc = clocks.computeDeadline({ ...reg, amount: 3 }, clerk, view);
  assert.deepEqual([cc.date, cc.due.value], ["2026-09-04", "2026-09-04T12:00"]);
  /* appeal_window: 2 months from 2026-12-31 lands on a February with no 31st: both readings, the earliest taken. */
  const app = { ...view.deadlines.find((x) => x.rule === "appeal_window"), starts: "filed", roll: false };
  const u = clocks.computeDeadline(app, { correspondence: [{ direction: "sent", at: "2026-12-31" }] }, view);
  assert.deepEqual([u.date, u.candidates], ["2027-02-28", ["2027-02-28", "2027-03-01"]]);
});
