/* monitoring R14–R18 and R52: the cadence (which frequency governs, the subject of a schedule, the plan), an address's
   own frequency (R17) and the member's act that sets it (R52), and the lengthening of a contract default (R18). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, serve, DAEMON, NOW_MS, V, registerCalendarStub } from "./fixture.mjs";
import { cadenceFor, monitorIntervalMs, CONTRACT_FREQUENCY, MONITOR_CADENCE_MS, monitoringOps, FREQUENCY_CHECKS,
         ADDRESS_FREQUENCY_REASONS, FREQUENCY_REASON_MAX, VOLATILITY_RUN, lengthenedFrequency } from "../../../src/monitoring/index.mjs";
import { MONITOR_FREQ } from "../../../src/capture/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const HOUR = 3600000, DAY = 24 * HOUR;
/* A receipt at an address, through provenance's one writer (the version chain R15 groups by). */
const receipt = (w, addr, cap, at) => w.prov.recordReceipt({ address: addr, addressNorm: addr, captureSha: cap, retrieved: at,
  via: "direct", retrievalLocator: addr, context: { authorityKind: "sweep", authority: "x", actorClass: "plane", actor: null, observe: false } });
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

test("R14 which frequency governs: an authored word the catalogue knows; an unknown authored word is undetermined; else the contract read; else undetermined; the intervals", () => {
  for (const f of MONITOR_FREQ) assert.deepEqual(cadenceFor(f, null).frequency, f);
  assert.equal(cadenceFor("daily", { contract: "substance" }).source, "authored", "authored governs over the contract");
  const u = cadenceFor("fortnightly", { contract: "substance" });
  assert.deepEqual([u.frequency, u.source], [null, "undetermined"]);
  assert.match(u.why, /the frequency 'fortnightly', which is not one the catalog knows/);
  assert.deepEqual([cadenceFor(null, { contract: "membership", content_type: "roster" }).frequency, cadenceFor(null, { contract: "membership" }).source],
                   ["daily", "contract"]);
  assert.equal(cadenceFor("", { contract: "substance" }).frequency, "weekly");
  const shell = cadenceFor(null, { contract: "unmonitorable" });
  assert.deepEqual([shell.frequency, shell.source], [null, "contract"]);
  assert.match(shell.why, /no check clock/);
  const none = cadenceFor(null, null);
  assert.deepEqual([none.frequency, none.source], [null, "undetermined"]);
  assert.ok(none.why);
  const odd = cadenceFor(null, { contract: "whenever" });
  assert.deepEqual([odd.frequency, odd.source], [null, "undetermined"]);
  assert.deepEqual(CONTRACT_FREQUENCY, { membership: "daily", substance: "weekly", unmonitorable: null });
  assert.deepEqual([monitorIntervalMs("hourly"), monitorIntervalMs("daily"), monitorIntervalMs("weekly"), monitorIntervalMs("monthly")],
                   [HOUR, DAY, 7 * DAY, 30 * DAY]);
  assert.deepEqual([monitorIntervalMs("per_meeting"), monitorIntervalMs("none"), monitorIntervalMs("fortnightly"), monitorIntervalMs("toString")],
                   [null, null, null, null]);
  assert.equal(MONITOR_CADENCE_MS.monthly, 30 * DAY);
});

test("R14 the tick answers the same rule the plan schedules by", async () => {
  const w = world();
  const id = "INFO-2026-0200-rule";
  const loc = "https://records.example.org/rule.txt";
  w.monitored(id, loc, "rule-v1");
  w.net.routes[loc] = serve("rule-v1");
  const r = await w.m.monitor({ bundleId: id, viewer: DAEMON, actor: DAEMON });
  const row = w.m.schedule(NOW_MS + 30 * DAY).due.find((d) => d.bundle === id) || w.m.schedule(NOW_MS + 30 * DAY).scheduled.find((d) => d.bundle === id);
  assert.equal(r.body.cadence.source, "contract");
  assert.equal(row.frequency, r.body.cadence.frequency);
  assert.equal(row.frequency_source, "contract");
  assert.equal(row.contract, r.body.cadence.contract);
});

test("R15 the subject is an address: versions group by address, the current version's frequency governs, never the shortest; newer unmonitored and disagreements stated", () => {
  const w = world();
  const addr = "https://records.example.org/calendar";
  const a = w.monitored("INFO-2026-0210-v1", addr, "cal-v1", { freq: "hourly" });
  const b = w.monitored("INFO-2026-0211-v2", addr, "cal-v2", { freq: "weekly" });
  const c = w.monitored("INFO-2026-0212-v3", addr, "cal-v3", { enabled: false });
  receipt(w, addr, a.cap, "2026-09-01T00:00:00Z");
  receipt(w, addr, b.cap, "2026-09-02T00:00:00Z");
  receipt(w, addr, c.cap, "2026-09-03T00:00:00Z");
  const s = w.m.subjects();
  const row = s.rows.find((r) => r.address === addr);
  assert.equal(s.rows.filter((r) => r.address === addr).length, 1, "one row per address");
  assert.equal(row.bundle_id, "INFO-2026-0211-v2", "the newest version that asks to be monitored is checked");
  assert.equal(row.monitor_frequency, "weekly", "the current version's frequency governs, never the shortest");
  assert.deepEqual(row.versions, ["INFO-2026-0210-v1", "INFO-2026-0211-v2", "INFO-2026-0212-v3"]);
  assert.deepEqual(row.newer_unmonitored, ["INFO-2026-0212-v3"]);
  assert.equal(row.disagreement.governs, "weekly");
  assert.deepEqual(row.disagreement.authored.map((x) => x.frequency).sort(), ["hourly", "weekly"]);
  /* last checked when any version was */
  w.st.sql.exec(`UPDATE bundle_projection SET monitor_last_checked='2026-09-10T00:00:00Z' WHERE bundle_id='INFO-2026-0210-v1'`);
  assert.equal(w.m.subjects().rows.find((r) => r.address === addr).monitor_last_checked, "2026-09-10T00:00:00Z");
  /* a bundle with no captured address is its own subject; so is one captured at several addresses none singly its locator */
  const lone = w.monitored("INFO-2026-0213-lone", "https://records.example.org/lone", "lone-v1", { freq: "daily" });
  const multi = w.monitored("INFO-2026-0214-multi", "https://records.example.org/declared", "multi-v1", { freq: "daily" });
  receipt(w, "https://mirror-a.example.org/x", multi.cap, "2026-09-01T00:00:00Z");
  receipt(w, "https://mirror-b.example.org/x", multi.cap, "2026-09-01T00:00:00Z");
  const rows = w.m.subjects().rows;
  const l = rows.find((r) => r.bundle_id === "INFO-2026-0213-lone");
  assert.deepEqual([l.address, l.versions], [null, ["INFO-2026-0213-lone"]]);
  const m = rows.find((r) => r.bundle_id === "INFO-2026-0214-multi");
  assert.equal(m.address, null);
  assert.match(m.address_basis, /captured at 2 addresses, none of them singly its source.locator/);
  assert.ok(lone.cap);
});

test("R16 the plan: never checked is due; nothing authored and nothing read is due (unread); no interval is unscheduled with its reason; else due or next; longest-overdue first, then by id", () => {
  const w = world();
  const mk = (n, freq, lastMs) => {
    const id = `INFO-2026-02${n}-plan`;
    w.monitored(id, `https://records.example.org/p${n}`, `plan-${n}`, { freq });
    if (lastMs != null) w.st.sql.exec(`UPDATE bundle_projection SET monitor_last_checked=? WHERE bundle_id=?`, iso(lastMs), id);
    return id;
  };
  const never = mk(20, "daily", null);
  const unread = mk(21, null, null);
  const meeting = mk(22, "per_meeting", null);
  const none = mk(23, "none", null);
  const unknown = mk(24, "fortnightly", null);
  const overdue2 = mk(25, "daily", NOW_MS - 3 * DAY);
  const overdue1 = mk(26, "hourly", NOW_MS - 2 * HOUR);
  const later = mk(27, "weekly", NOW_MS - DAY);
  const checkedUnread = mk(28, null, NOW_MS - DAY);
  const p = w.m.schedule(NOW_MS);
  const due = p.due.map((d) => d.bundle);
  assert.ok(due.includes(never));
  const u = p.due.find((d) => d.bundle === unread);
  assert.equal(u.frequency_source, "unread");
  assert.deepEqual(due.slice(0, 2).sort(), [never, unread].sort(), "never checked (due_at 0) first, then by id");
  assert.deepEqual(due.slice(0, 2), [never, unread].sort());
  assert.deepEqual(due.slice(2), [overdue2, overdue1], "then longest-overdue first");
  const un = Object.fromEntries(p.unscheduled.map((x) => [x.bundle, x.reason]));
  assert.equal(un[meeting], word("monitoring.cadence_meeting_schedule"));
  assert.equal(un[none], word("monitoring.frequency_declared"));
  assert.match(un[unknown], /which is not one the catalog knows/);
  assert.match(un[checkedUnread], /no check has read a document at this address/);
  assert.equal(p.next, NOW_MS - DAY + 7 * DAY);
  assert.ok(!due.includes(later));
  assert.equal(p.scheduled.find((s) => s.bundle === later).next_at, p.next);
});

/* R52, R17: two monitored versions at one address (R15 groups them), each in a project: P owned by carol (dave joined,
   owning nothing), Q owned by erin. A third document at its own address, in no project. */
const ADDR = "https://records.example.org/agenda";
const P = "PROJ-2026-0400-p", Q = "PROJ-2026-0401-q";
function owned() {
  const w = world();
  w.inProject(P, { owner: "carol", joined: ["dave"] });
  w.inProject(Q, { owner: "erin" });
  const a = w.monitored("INFO-2026-0400-a", ADDR, "agenda v1", { freq: "weekly", lines: [`project: ${P}`] });
  const b = w.monitored("INFO-2026-0401-b", ADDR, "agenda v2", { freq: "weekly", lines: [`project: ${P}`] });
  receipt(w, ADDR, a.cap, "2026-09-01T00:00:00Z");
  receipt(w, ADDR, b.cap, "2026-09-02T00:00:00Z");
  w.monitored("INFO-2026-0402-free", "https://records.example.org/free", "free v1", { freq: "daily" });
  return w;
}
const set = (w, o) => w.m.addressFrequencySet({ address: ADDR, frequency: "daily", reason: "source_changes_often",
                                                author: "carol", viewer: V("carol"), ...o });
const settings = (w) => w.rows(`SELECT count(*) c FROM monitor_address_frequency`)[0].c;
const rowAt = (w, addr = ADDR, now = NOW_MS) => {
  const p = w.m.schedule(now);
  return [...p.due, ...p.scheduled, ...p.unscheduled].find((r) => r.address === addr) || null;
};

test("R52 addressFrequencySet refuses, in order, each with its row and nothing written: a machine author; an address no visible subject is at (absent and invisible alike); a frequency not the catalogue's or null; an author owning no project holding a monitored document there; a reason neither canned nor custom with 1 to 2,000 characters", () => {
  const w = owned();
  const refused = (o, code) => {
    const before = settings(w);
    const r = set(w, o);
    assert.equal(r.ok, false, `${code}: ${JSON.stringify(o)}`);
    assert.deepEqual([r.reason, r.code, r.check, r.translation],
      [code, code, FREQUENCY_CHECKS[code].check, FREQUENCY_CHECKS[code].translation], JSON.stringify(o));
    assert.match(r.detail, /Nothing was written\.$/);
    assert.equal(settings(w), before, `nothing written: ${JSON.stringify(o)}`);
    return r;
  };
  /* 1: an empty or machine author, before every other condition (the rest of the request is wrong too) */
  const worst = { address: "https://nowhere.example.org/", frequency: "fortnightly", reason: "because" };
  for (const author of ["", "   ", null, "class:daemon", "token:member", "claude", "daemon", "class:admin"])
    refused({ ...worst, author }, "MACHINE_CANNOT_SET_FREQUENCY");
  /* 2: an address no subject is at, and one hidden from the viewer, are one answer */
  const absent = refused({ ...worst, address: "https://nowhere.example.org/" }, "NO_SUCH_ADDRESS");
  const hidden = refused({ ...worst, viewer: V("zed") }, "NO_SUCH_ADDRESS");
  assert.deepEqual({ ...absent, address: null, detail: null }, { ...hidden, address: null, detail: null });
  assert.equal(absent.detail, hidden.detail, "absent and invisible alike");
  refused({ ...worst, address: null }, "NO_SUCH_ADDRESS");
  refused({ ...worst, address: "https://records.example.org/not-monitored" }, "NO_SUCH_ADDRESS");
  /* a bundle captured at several addresses, none singly its locator, is scheduled as itself and assigned none (R15) */
  const multi = w.monitored("INFO-2026-0403-multi", "https://records.example.org/declared", "multi v1", { freq: "daily", lines: [`project: ${P}`] });
  receipt(w, "https://mirror-a.example.org/m", multi.cap, "2026-09-01T00:00:00Z");
  receipt(w, "https://mirror-b.example.org/m", multi.cap, "2026-09-01T00:00:00Z");
  for (const address of ["https://records.example.org/declared", "https://mirror-a.example.org/m"])
    refused({ ...worst, address }, "NO_SUCH_ADDRESS");
  /* 3: a frequency that is not one of MONITOR_FREQ's words, nor null */
  for (const frequency of ["fortnightly", "", "Daily", undefined, 7, false])
    refused({ frequency, reason: "because" }, "BAD_FREQUENCY");
  /* 4: an author owning no project holding a monitored document there: a joined participant, another project's owner,
     a member of none */
  for (const author of ["dave", "erin", "zed"]) refused({ author, viewer: V("carol"), reason: "because" }, "NOT_A_SOURCE_OWNER");
  /* 5: no reason, an unknown key, custom with no words, blank words or more than 2,000 characters */
  for (const o of [{ reason: null }, { reason: "because" }, { reason: "custom" }, { reason: "custom", reasonText: "   " },
                   { reason: "custom", reasonText: "x".repeat(FREQUENCY_REASON_MAX + 1) }, { reason: "custom", reasonText: 42 }])
    refused(o, "FREQUENCY_NO_REASON");
  assert.equal(settings(w), 0);
  /* negative controls: each condition met, it records */
  assert.equal(set(w, {}).ok, true);
  assert.equal(set(w, { reason: "custom", reasonText: "x".repeat(FREQUENCY_REASON_MAX) }).ok, true, "2,000 characters is a reason");
  assert.equal(set(w, { author: "member:carol" }).ok, true, "the member stamp is the same member");
});

test("R52 a canned and a custom setting are each recorded with the reason (key and sentence, or the words), who and when; a later one replaces it, null returns the address to R14's rule, and every one stays readable on the address's history", () => {
  const w = owned();
  const asToday = rowAt(w);
  assert.equal(asToday.frequency_source, "authored");
  /* the four canned reasons, BOB's sentences word for word */
  assert.deepEqual(ADDRESS_FREQUENCY_REASONS, {
    source_changes_rarely: word("monitoring.source_changes_rarely"),
    source_changes_often: word("monitoring.source_changes_often"),
    legal_deadline_approaching: word("monitoring.legal_deadline_depends"),
    source_unreliable: word("monitoring.source_unreliable_checked"),
  });
  const at = new Date(NOW_MS).toISOString().replace(/\.\d+Z$/, "Z");
  const recorded = [];
  for (const [reason, sentence] of Object.entries(ADDRESS_FREQUENCY_REASONS)) {
    const r = set(w, { reason, frequency: "hourly" });
    assert.equal(r.ok, true);
    const want = { address: ADDR, seq: recorded.length + 1, frequency: "hourly", reason, sentence, author: "carol", at };
    assert.deepEqual(r.setting, want);
    recorded.push(want);
    assert.deepEqual(r.history, recorded, "every setting, oldest first");
  }
  /* custom: the member's own words */
  w.clock.ms = NOW_MS + HOUR;
  const c = set(w, { reason: "custom", reasonText: "  The clerk posts the agenda the evening before.  ", frequency: "daily" });
  const custom = { address: ADDR, seq: 5, frequency: "daily", reason: "custom", text: "The clerk posts the agenda the evening before.",
                   author: "carol", at: iso(NOW_MS + HOUR) };
  assert.deepEqual(c.setting, custom);
  recorded.push(custom);
  /* the later one governs, and the address's history is on its row */
  const row = rowAt(w, ADDR, NOW_MS + HOUR);
  assert.deepEqual([row.frequency, row.frequency_source, row.address_frequency], ["daily", "address", custom]);
  assert.deepEqual(row.frequency_settings, recorded);
  /* null returns the address to R14's rule; the history keeps every setting */
  const n = set(w, { frequency: null, reason: "source_changes_rarely" });
  assert.equal(n.ok, true);
  assert.equal(n.setting.frequency, null);
  const back = rowAt(w, ADDR, NOW_MS + HOUR);
  const { frequency_settings: history, ...rest } = back;
  assert.deepEqual(rest, asToday, "the row is R14's again");
  assert.deepEqual(history, [...recorded, n.setting]);
  /* and readable on R32's row, to a viewer who sees the address */
  const mine = w.m.monitoring({ viewer: V("carol"), now: NOW_MS + HOUR }).items.find((i) => i.address === ADDR);
  assert.deepEqual(mine.frequency_settings, history);
  /* the rows are never edited: the table holds each one as recorded */
  assert.deepEqual(w.rows(`SELECT seq, frequency, reason FROM monitor_address_frequency ORDER BY seq`).map((x) => [x.seq, x.frequency, x.reason]),
    [[1, "hourly", "source_changes_rarely"], [2, "hourly", "source_changes_often"], [3, "hourly", "legal_deadline_approaching"],
     [4, "hourly", "source_unreliable"], [5, "daily", "custom"], [6, null, "source_changes_rarely"]]);
});

test("R52 through the route: the body's fields, then the control plane's author and viewer stamps, never the body's; a bundle scheduled as itself for holding no captured address is set at its own locator", () => {
  const w = owned();
  const route = (qs, body) => monitoringOps(w.m, new URL(`http://do/addressfrequencyset?${qs}`), body).addressfrequencyset();
  const body = { address: ADDR, frequency: "monthly", reason: "source_changes_rarely", author: "carol", viewer: V("carol") };
  /* a machine's stamp is refused whatever the body names */
  assert.equal(route(`author=${encodeURIComponent("class:daemon")}&viewer=${encodeURIComponent(DAEMON)}`, body).reason,
               "MACHINE_CANNOT_SET_FREQUENCY");
  /* a member who sees nothing is refused as though nothing were there, whatever viewer the body names */
  assert.equal(route(`author=carol&viewer=${encodeURIComponent(V("zed"))}`, body).reason, "NO_SUCH_ADDRESS");
  const ok = route(`author=carol&viewer=${encodeURIComponent(V("carol"))}`, { ...body, author: "erin" });
  assert.deepEqual([ok.ok, ok.setting.author, ok.setting.frequency], [true, "carol", "monthly"]);
  /* a lone bundle, set at its own source.locator by its project's owner */
  w.inProject("PROJ-2026-0404-l", { owner: "lee" });
  w.monitored("INFO-2026-0404-lone", "https://records.example.org/Lone?b=2&a=1", "lone v1", { freq: "weekly", lines: ["project: PROJ-2026-0404-l"] });
  const lone = w.m.addressFrequencySet({ address: "https://RECORDS.example.org/Lone?a=1&b=2", frequency: "daily",
                                         reason: "source_unreliable", author: "lee", viewer: V("lee") });
  assert.deepEqual([lone.ok, lone.address], [true, "https://records.example.org/Lone?a=1&b=2"]);
  const p = w.m.schedule(NOW_MS);
  const lr = [...p.due, ...p.scheduled].find((r) => r.bundle === "INFO-2026-0404-lone");
  assert.deepEqual([lr.frequency, lr.frequency_source, lr.address_frequency.author], ["daily", "address", "lee"]);
});

test("R17 an address's own frequency, when set, governs over its versions' and R16's plan row states it: frequency_source address, the frequency, the reason, who and when; without a setting the row is as today", async () => {
  const checkedTwoDaysAgo = (x) => x.st.sql.exec(`UPDATE bundle_projection SET monitor_last_checked=? WHERE bundle_id IN ('INFO-2026-0400-a', 'INFO-2026-0401-b')`,
                                                 iso(NOW_MS - 2 * DAY));
  const w = owned();
  /* checked two days ago: the versions' weekly leaves it scheduled; the address's daily makes it due */
  checkedTwoDaysAgo(w);
  const before = rowAt(w);
  assert.deepEqual([before.frequency, before.frequency_source, before.next_at], ["weekly", "authored", NOW_MS - 2 * DAY + 7 * DAY]);
  assert.equal("address_frequency" in before || "frequency_settings" in before, false, "no setting, no new key");
  /* the negative control: a world where nothing was ever set answers the same row */
  const never = owned();
  checkedTwoDaysAgo(never);
  assert.deepEqual(rowAt(never), before);
  assert.equal(set(w, { frequency: "daily", reason: "legal_deadline_approaching" }).ok, true);
  const due = w.m.schedule(NOW_MS).due.find((r) => r.address === ADDR);
  assert.ok(due, "due by the address's own frequency");
  assert.deepEqual([due.frequency, due.frequency_source, due.interval_ms, due.due_at], ["daily", "address", DAY, NOW_MS - DAY]);
  assert.deepEqual(due.address_frequency, { address: ADDR, seq: 1, frequency: "daily", reason: "legal_deadline_approaching",
    sentence: word("monitoring.legal_deadline_depends"), author: "carol", at: iso(NOW_MS) });
  /* the cadence tick checks it, and its entry carries the address's account */
  w.net.routes[ADDR] = serve("agenda v2");
  const tick = await w.m.cadenceTick(NOW_MS);
  const e = tick.ticked.find((x) => x.address === ADDR);
  assert.deepEqual([e.frequency, e.frequency_source, e.address_frequency.reason], ["daily", "address", "legal_deadline_approaching"]);
  /* an address set to per_meeting or none is unscheduled, with its reason */
  for (const [frequency, reason] of [["per_meeting", word("monitoring.cadence_meeting_schedule")],
                                     ["none", word("monitoring.why.address_frequency_set")]]) {
    assert.equal(set(w, { frequency, reason: "source_changes_rarely" }).ok, true);
    const u = w.m.schedule(NOW_MS + 3 * DAY).unscheduled.find((r) => r.address === ADDR);
    assert.deepEqual([u.frequency, u.frequency_source, u.reason], [frequency, "address", reason]);
  }
});

test("R18 a document whose substance has not moved across repeated checks earns a longer interval: one step up daily, weekly, monthly per 10 unchanged checks, never past monthly, stated on the plan row with its count and step; any change or failed look returns the contract default", async () => {
  assert.equal(VOLATILITY_RUN, 10);
  /* the calendar's membership contract is a content type's, registered as the plane registers doctypes' (T34-8) */
  assert.equal(registerCalendarStub().ok, true);
  const w = world();
  /* a meeting calendar served by ASP.NET (contract membership, daily) and a plain text document (substance, weekly) */
  const cal = (h) => `<html><head><title>Calendar</title></head><body><form id="aspnetForm"><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="abc" />
<div id="ctl00_divTop">${h}</div><main id="mainContent" role="main"><input id="ctl00_lstYears_Input" value="This Month" />
<table><tr><td><a href="MeetingDetail.aspx?ID=1&amp;GUID=x">Harbor Commission</a></td><td>3/3/2026</td><td>Not available</td><td>Not available</td></tr></table>
</main></form></body></html>`;
  const CAL = "https://agendas.example.org/Calendar.aspx", TXT = "https://records.example.org/plain.txt";
  const H = { "content-type": "text/html; charset=utf-8", "x-aspnet-version": "4.0.30319", "x-powered-by": "ASP.NET" };
  w.monitored("INFO-2026-0410-cal", CAL, cal("h"));
  w.monitored("INFO-2026-0411-txt", TXT, "plain words");
  w.net.routes[CAL] = () => new Response(cal("h"), { headers: H });
  w.net.routes[TXT] = serve("plain words");
  const tick = async (id, n = 1) => { for (let i = 0; i < n; i++) assert.equal((await w.m.monitor({ bundleId: id, viewer: DAEMON })).body.ok, true); };
  const row = (id) => { const p = w.m.schedule(NOW_MS); return [...p.due, ...p.scheduled, ...p.unscheduled].find((r) => r.bundle === id); };
  const v = (id) => { const r = row(id); return [r.frequency, r.frequency_source, r.volatility.unchanged_checks, r.volatility.step, r.volatility.contract_default]; };
  await tick("INFO-2026-0410-cal", 9);
  assert.deepEqual(v("INFO-2026-0410-cal"), ["daily", "contract", 9, 0, "daily"], "nine unchanged checks: not yet, and the count is stated");
  await tick("INFO-2026-0410-cal");
  assert.deepEqual(v("INFO-2026-0410-cal"), ["weekly", "contract", 10, 1, "daily"], "ten: one step up");
  assert.equal(row("INFO-2026-0410-cal").interval_ms, 7 * DAY);
  assert.match(row("INFO-2026-0410-cal").volatility.basis, /^10 checks in a row found the substance unchanged/);
  await tick("INFO-2026-0410-cal", 10);
  assert.deepEqual(v("INFO-2026-0410-cal"), ["monthly", "contract", 20, 2, "daily"], "ten more at that interval: one step again");
  await tick("INFO-2026-0410-cal", 15);
  assert.deepEqual(v("INFO-2026-0410-cal"), ["monthly", "contract", 35, 2, "daily"], "never past monthly");
  await tick("INFO-2026-0411-txt", 10);
  assert.deepEqual(v("INFO-2026-0411-txt"), ["monthly", "contract", 10, 1, "weekly"], "weekly's one step is monthly");
  /* a governed refusal is no check of the source (D-104): the run stands */
  w.gov.refuse.push("agendas.example.org");
  await w.m.monitor({ bundleId: "INFO-2026-0410-cal", viewer: DAEMON });
  w.gov.refuse.length = 0;
  assert.deepEqual(v("INFO-2026-0410-cal"), ["monthly", "contract", 35, 2, "daily"]);
  /* any change returns the contract default; so does an unreachable check, and a removed one */
  for (const [how, route] of [["changed", () => new Response(cal("h").replace("Harbor Commission", "Harbor Commission - CANCELLED"), { headers: H })],
                              ["unreachable", serve("x", "text/plain", 503)], ["unreachable", new Error("reset")],
                              ["removed", serve("gone", "text/plain", 404)]]) {
    w.net.routes[CAL] = () => new Response(cal("h"), { headers: H });
    await tick("INFO-2026-0410-cal", 10);
    assert.ok(row("INFO-2026-0410-cal").volatility.step >= 1, `${how}: lengthened first`);
    w.net.routes[CAL] = route;
    await w.m.monitor({ bundleId: "INFO-2026-0410-cal", viewer: DAEMON });
    assert.deepEqual(v("INFO-2026-0410-cal"), ["daily", "contract", 0, 0, "daily"], `${how} returns the contract default`);
  }
  /* never shorter: a run of 0 is the default itself, and the rule never moves below it */
  for (const d of ["daily", "weekly", "monthly"]) for (const n of [0, 1, 9, 10, 25, 1000])
    assert.ok(monitorIntervalMs(lengthenedFrequency(d, n).frequency) >= monitorIntervalMs(d), `${d} after ${n}`);
  assert.deepEqual(lengthenedFrequency("hourly", 50), { frequency: "hourly", step: 0 }, "only R14's contract ladder lengthens");
});

test("R18 an authored frequency and an address's own are never lengthened, whatever the run of unchanged checks", async () => {
  const w = world();
  w.inProject(P, { owner: "carol" });
  const AUT = "https://records.example.org/authored.txt", OWN = "https://records.example.org/own.txt";
  w.monitored("INFO-2026-0420-aut", AUT, "authored words", { freq: "daily" });
  w.monitored("INFO-2026-0421-own", OWN, "own words", { lines: [`project: ${P}`] });
  w.net.routes[AUT] = serve("authored words");
  w.net.routes[OWN] = serve("own words");
  assert.equal(w.m.addressFrequencySet({ address: OWN, frequency: "daily", reason: "source_changes_often", author: "carol",
                                         viewer: V("carol") }).ok, true);
  for (let i = 0; i < 25; i++) for (const id of ["INFO-2026-0420-aut", "INFO-2026-0421-own"])
    assert.equal((await w.m.monitor({ bundleId: id, viewer: DAEMON })).body.status, "unchanged");
  const p = w.m.schedule(NOW_MS);
  const rows = [...p.due, ...p.scheduled];
  const aut = rows.find((r) => r.bundle === "INFO-2026-0420-aut"), own = rows.find((r) => r.bundle === "INFO-2026-0421-own");
  assert.deepEqual([aut.frequency, aut.frequency_source, "volatility" in aut], ["daily", "authored", false]);
  assert.deepEqual([own.frequency, own.frequency_source, "volatility" in own], ["daily", "address", false]);
  /* the run is kept all the same: returned to R14's rule, the address's contract default is lengthened by it */
  assert.equal(w.m.addressFrequencySet({ address: OWN, frequency: null, reason: "source_changes_rarely", author: "carol",
                                         viewer: V("carol") }).ok, true);
  const back = w.m.schedule(NOW_MS).scheduled.concat(w.m.schedule(NOW_MS).due).find((r) => r.bundle === "INFO-2026-0421-own");
  assert.deepEqual([back.frequency_source, back.volatility.unchanged_checks, back.volatility.step, back.frequency], ["contract", 25, 1, "monthly"]);
});

test("R15 (K1484 C2 row 11) an address may be a public register's own query for one identifier a member names for a person: it is watched as any address is, its answer captured and compared, and the tick fetches that query alone, following no link out of its answer and searching nowhere else; what a caller adds never names what is fetched", async () => {
  const w = world();
  const id = "INFO-2026-0700-filer";
  const query = "https://register.example.org/lookup?filer_id=1234567";
  /* the answer links out: to the person's other filings, a search by name, and another register */
  const answer = (v) => `<html><body><h1>Filer 1234567</h1><p>${v}</p>`
    + `<a href="https://register.example.org/person?name=Jane+Doe">Jane Doe</a>`
    + `<a href="https://register.example.org/lookup?filer_id=7654321">related filer</a>`
    + `<a href="https://other-register.example.net/search?q=Jane+Doe">elsewhere</a></body></html>`;
  w.monitored(id, query, answer("statement of 2026-09-01"), { freq: "daily" });
  w.net.routes[query] = serve(answer("statement of 2026-09-01"), "text/html");
  /* the query is one subject of the plan, an address like any other */
  const row = w.m.monitoring({ viewer: DAEMON, now: NOW_MS }).items.find((r) => r.bundle === id);
  assert.deepEqual([row.state, row.frequency], ["due", "daily"]);
  const t = await w.m.cadenceTick(NOW_MS);
  assert.deepEqual(t.ticked.map((x) => [x.bundle, x.status]), [[id, "unchanged"]], "compared, as any address");
  assert.deepEqual(w.net.seen, [query], "the query alone: no link out of its answer was followed");
  /* the answer changes: it is captured and compared, and still nothing else is fetched */
  w.net.seen.length = 0;
  w.net.routes[query] = serve(answer("statement of 2026-10-01"), "text/html");
  const r = await w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON,
                                person: "Jane Doe", name: "Jane Doe", locator: "https://other-register.example.net/search?q=Jane+Doe" });
  assert.deepEqual([r.body.status, r.body.capture.registered, r.body.capture.fetched_address], ["modified", true, query]);
  assert.deepEqual(w.net.seen, [query], "a caller's person, name or locator names nothing fetched (R36)");
  assert.equal(w.looks().at(-1).subject, query, "the look is about the query's address");
});
