/* monitoring R28–R35, R44 and R50 (with N429): standing intent, what reaches members, and what the understanding and action layers
   rest on. R28 runs over capture's real `acquire` (the capture-request arm) with the network scripted. R34, R44 and R50
   run over the real actions module (its clock rule and its R33 bound) and the real action-clocks module (`pendingClocks`,
   its R1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, NOW_MS, infoMd, serve, DAEMON } from "./fixture.mjs";
import { watchSetOf } from "../intent/fixtures.mjs";
import { restingOf } from "../publication/fixtures.mjs";
import { staleBaseRefusal } from "../promotion/fixtures.mjs";
import { acquireRefusals } from "../acquisition/fixtures.mjs";
import { escalationsDue } from "../escalation/fixtures.mjs";
import { pendingClocksRefusal } from "../action-clocks/fixtures.mjs";
import { markOverdue, MONITOR_AUTHOR, MONITOR_VIEWER, DEADLINE_RECHECK_MAX, GATHERING_PURPOSE, GATHERING_LANDS_AT,
         MONITOR_CADENCE_BATCH, DEADLINE_NO_ZONE } from "../../../src/monitoring/index.mjs";
import { MECHANICAL_FIELD_SETS } from "../../../src/promotion/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

/* escalation as its real module answers in a world with no escalation open (its published fixture, R16) */
const emptyEscalation = () => escalationsDue().emptyWorld.esc;

/* publication's real answers, followed a page of two at a time to the end (each call recorded in `calls`): the page
   size the paging of R33 needs, as the cursor is followed to its end over more than one page. */
function pagedResting(publication) {
  const calls = [];
  return { calls, restingCapturesOf(q = {}) { calls.push({ after: q.after ?? null }); return publication.restingCapturesOf({ ...q, limit: 2 }); } };
}

/* R28: a bundle carrying named requests, in project P. */
const GB = "INFO-2026-0600-gathering", GP = "PROJ-2026-0600-g";
const PUB = "https://publisher.example.org/minutes.txt", MIRROR = "https://mirror.example.org/minutes.txt";
const req = (id, o) => ({ id, target: { text: `the ${id}` }, locators: [PUB], authority: "Town Clerk", criticality: "crucial",
                          status: "open", ...o });
function gatheringWorld(requests) {
  const w = world();
  const g = JSON.stringify({ requests });
  const r = w.promote(GB, infoMd(GB, "https://records.example.org/gathering", { enabled: false, lines: [`project: ${GP}`] }),
    { files: [{ path: "data/gathering.json", text: g, bytes: Buffer.byteLength(g), sha256: sha(g) }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  /* capture's real acquire, every call recorded */
  const calls = [];
  const real = w.capture.acquire.bind(w.capture);
  w.capture.acquire = (body, opts) => { calls.push({ body, opts: JSON.parse(JSON.stringify(opts)) }); return real(body, opts); };
  return { w, calls };
}
/* The scripted network as the global fetch capture's acquire reads. */
async function online(w, fn) {
  const was = globalThis.fetch;
  globalThis.fetch = w.net.fetch;
  try { return await fn(); } finally { globalThis.fetch = was; }
}
/* What the requests fetched: the network less acquire's own attestation requests (timestamps, the archive's save). */
const fetched = (w) => w.net.seen.filter((u) => !/^http:\/\/(timestamp|rfc3161)\.|^https:\/\/web\.archive\.org\//.test(u));
const landedOf = (w) => w.rows(`SELECT bundle_id, current_state, project FROM bundles WHERE bundle_id LIKE '%-gathered' ORDER BY bundle_id`);
const looksOf = (w, id) => w.looks().filter((l) => l.authority === id);
const runsOf = (w) => w.rows(`SELECT request_id, seq, outcome, locator, capture_sha, landed FROM monitor_gathering_run ORDER BY request_id, seq`);

test("R28 each open named request whose cadence is due is captured through capture.acquire from its locators in order, the publisher first, through the capture-request arm as the daemon; the request is each look's authority, never asserted onto the bytes; new bytes land as an Information bundle at collected, never verified", async () => {
  const A = "GATH-2026-0601-minutes", B = "GATH-2026-0602-agenda";
  const { w, calls } = gatheringWorld([req(A, { cadence: "weekly", locators: [PUB, MIRROR] }),
                                       req(B, { locators: ["https://publisher.example.org/agenda.txt"] })]);
  w.net.routes[PUB] = serve("down", "text/plain", 503);
  w.net.routes[MIRROR] = serve("the minutes, as the mirror holds them");
  w.net.routes["https://publisher.example.org/agenda.txt"] = serve("the agenda");
  assert.equal(w.m.cadenceDue(NOW_MS), NOW_MS, "due: never attempted");
  assert.equal(w.m.cadenceWake(NOW_MS), NOW_MS + 1000);
  const t = await online(w, () => w.m.cadenceTick(NOW_MS));
  assert.deepEqual([t.gathered.due, t.gathered.captured.map((x) => x.request), t.gathered.failed], [2, [A, B], []]);
  /* the locators in order, the publisher first; the mirror only after it failed; the arm and the class */
  assert.deepEqual(fetched(w), [PUB, MIRROR, "https://publisher.example.org/agenda.txt"]);
  for (const c of calls) {
    assert.deepEqual(c.body, {}, "nothing in the body: no authority asserted, no locator a caller could name");
    assert.deepEqual([c.opts.cls, c.opts.member, c.opts.captureRequest.purpose, c.opts.captureRequest.render],
                     ["daemon", false, GATHERING_PURPOSE, false]);
  }
  assert.deepEqual(calls.map((c) => c.opts.captureRequest.locator), [PUB, MIRROR, "https://publisher.example.org/agenda.txt"]);
  const a = t.gathered.captured[0];
  assert.deepEqual([a.locator, a.sha, a.existed, a.outcome], [MIRROR, sha("the minutes, as the mirror holds them"), false, "captured"]);
  assert.deepEqual(a.tried.map((x) => [x.locator, x.outcome, x.status]), [[PUB, "failed", 503], [MIRROR, "captured", null]]);
  /* one look per locator tried, the request its authority */
  assert.deepEqual(looksOf(w, A).map((l) => [l.authority_kind, l.level, l.subject, l.state, l.result_ref]),
    [["sweep", "document", PUB, "LOOKED_INDETERMINATE", null], ["sweep", "document", MIRROR, "PRESENT", a.sha]]);
  assert.equal(looksOf(w, B).length, 1);
  /* landed: an Information bundle at collected, in the request's bundle's project, naming the request and its bundle */
  const landed = landedOf(w);
  assert.equal(landed.length, 2);
  for (const l of landed) assert.deepEqual([l.current_state, l.project], [GATHERING_LANDS_AT, GP]);
  assert.equal(GATHERING_LANDS_AT, "collected");
  const ida = a.landed.bundle_id;
  assert.equal(a.landed.ok, true);
  const text = w.text(ida);
  assert.match(text, new RegExp(`named request ${A}, carried by ${GB}'s data/gathering.json, which authorised the fetch; locator 2 of 2`));
  const reg = JSON.parse(w.record.readFile(ida, "data/provenance.json").text).documents[0];
  assert.deepEqual([reg.origin.kind, reg.capture.sha256, reg.authority_state ?? reg.capture.authority_state ?? null],
                   ["named_request", a.sha, "undetermined"], "the request's own authority is never asserted onto the bytes");
  assert.equal(w.row(`SELECT bundle_id FROM register WHERE capture_sha=?`, a.sha).bundle_id, ida, "registered under the landed bundle");
  /* the record of attempts */
  assert.deepEqual(runsOf(w).map((r) => [r.request_id, r.seq, r.outcome, r.locator, r.landed]),
    [[A, 1, "captured", MIRROR, ida], [B, 1, "captured", "https://publisher.example.org/agenda.txt", t.gathered.captured[1].landed.bundle_id]]);
  /* not due again until its cadence: A weekly from now; B, with no cadence, ran once */
  const g = w.m.gathering(NOW_MS + DAY);
  assert.deepEqual([g.due, g.next], [[], NOW_MS + 7 * DAY]);
  const n = calls.length;
  await online(w, () => w.m.cadenceTick(NOW_MS + DAY));
  assert.equal(calls.length, n, "a request not yet due captures nothing");
  assert.deepEqual(w.m.gathering(NOW_MS + 7 * DAY).due.map((x) => x.id), [A], "due again a week on; the one-shot is not");
  /* nothing ever lands verified */
  assert.deepEqual(w.rows(`SELECT count(*) c FROM bundles WHERE current_state='verified'`)[0].c, 0);
});

test("R28 a request not open, one whose cadence is none, and a request not due capture nothing; bytes the record already holds land nothing new and are recorded as held; a governed refusal leaves the request due and tries no mirror; paused, nothing is gathered", async () => {
  const OPEN = "GATH-2026-0611-open", DONE = "GATH-2026-0612-done", RETIRED = "GATH-2026-0613-retired", NEVER = "GATH-2026-0614-none";
  const HELD = "https://publisher.example.org/held.txt";
  const { w, calls } = gatheringWorld([req(OPEN, { locators: [HELD, MIRROR], cadence: "daily" }), req(DONE, { status: "captured" }),
                                       req(RETIRED, { status: "retired" }), req(NEVER, { cadence: "none" })]);
  const g = w.m.gathering(NOW_MS);
  assert.deepEqual([g.due.map((x) => x.id), g.unscheduled.map((x) => [x.id, x.reason])],
                   [[OPEN], [[NEVER, word("monitoring.cadence_none_daemon")]]]);
  /* paused: nothing gathered, what is due stated */
  assert.equal(w.m.pause({ paused: true, by: "class:admin" }).ok, true);
  const p = await online(w, () => w.m.cadenceTick(NOW_MS));
  assert.deepEqual([p.gathered, calls.length, w.m.cadenceDue(NOW_MS)], [{ due: 1, captured: [], failed: [], skipped: [] }, 0, null]);
  assert.equal(w.m.pause({ paused: false, by: "class:admin" }).ok, true);
  /* governed: our pacing; the request stays due and its mirror is not tried in the publisher's place */
  w.gov.refuse.push("publisher.example.org");
  const gv = await online(w, () => w.m.cadenceTick(NOW_MS));
  assert.deepEqual([gv.gathered.failed.map((x) => [x.request, x.outcome]), fetched(w)], [[[OPEN, "governed"]], []]);
  assert.deepEqual(looksOf(w, OPEN).map((l) => [l.state, l.governed, l.condition]), [["LOOKED_INDETERMINATE", 1, "source-unreachable-governed"]]);
  assert.deepEqual(w.m.gathering(NOW_MS + 2 * 3600000).due.map((x) => x.id), [OPEN], "still due");
  w.gov.refuse.length = 0;
  /* held: the bytes are already a capture the record holds */
  const held = w.monitored("INFO-2026-0615-has", "https://records.example.org/has", "bytes already held", { enabled: false });
  w.net.routes[HELD] = serve("bytes already held");
  const before = landedOf(w).length;
  const h = await online(w, () => w.m.cadenceTick(NOW_MS + 2 * 3600000));
  assert.deepEqual(h.gathered.captured.map((x) => [x.request, x.outcome, x.existed, x.sha, "landed" in x]),
                   [[OPEN, "held", true, held.cap, false]]);
  assert.equal(landedOf(w).length, before, "a held capture promotes nothing");
  assert.deepEqual(runsOf(w).map((r) => [r.outcome, r.landed]), [["governed", null], ["held", null]]);
  assert.deepEqual(fetched(w), [HELD], "the closed, retired and none requests were never fetched");
  assert.deepEqual(calls.map((c) => c.opts.captureRequest.locator), [HELD, HELD], "the governed attempt and the held one; never the mirror");
  /* a request whose every locator fails is recorded failed, and is due again at its cadence */
  w.net.routes[HELD] = serve("gone", "text/plain", 404);
  w.net.routes[MIRROR] = new Error("reset");
  const f = await online(w, () => w.m.cadenceTick(NOW_MS + 2 * 3600000 + DAY));
  assert.deepEqual(f.gathered.failed.map((x) => [x.outcome, x.tried.map((y) => [y.locator, y.status])]),
                   [["failed", [[HELD, 404], [MIRROR, null]]]]);
  assert.deepEqual(looksOf(w, OPEN).slice(-2).map((l) => l.state), ["LOOKED_ABSENT", "LOOKED_INDETERMINATE"]);
  assert.deepEqual(w.m.gathering(NOW_MS + 2 * 3600000 + 2 * DAY).due.map((x) => x.id), [OPEN]);
});

test("R28 (K1102) the bundle's daemon block governs its requests: enabled false runs none, each stated as skipped with the reason; tick_budget bounds the locators tried for that bundle in one tick; an enabled bundle with no budget, and one with no daemon block, run as before", async () => {
  const w = world();
  const loc = (b, n, k) => `https://${k}-${b}${n}.example.org/a`;
  const r2 = (b, n) => req(`GATH-2026-065${n}-${b}`, { locators: [loc(b, n, "p"), loc(b, n, "m")] });
  const carry = (id, g) => {
    const t = JSON.stringify(g);
    assert.equal(w.promote(id, infoMd(id, `https://records.example.org/${id}`, { enabled: false }),
      { files: [{ path: "data/gathering.json", text: t, bytes: Buffer.byteLength(t), sha256: sha(t) }] }).ok, true, id);
  };
  carry("INFO-2026-0651-off", { daemon: { enabled: false }, requests: [r2("off", 1)] });
  carry("INFO-2026-0652-budget", { daemon: { enabled: true, tick_budget: 1 }, requests: [r2("bud", 2), r2("bud", 3)] });
  carry("INFO-2026-0653-on", { daemon: { enabled: true }, requests: [r2("on", 4)] });
  carry("INFO-2026-0654-plain", { requests: [r2("pl", 5)] });
  /* every locator refuses, so each request tries all it is allowed */
  const asked = [];
  const refused = await acquireRefusals({ kind: "source_refused" });
  w.capture.acquire = async (body, opts) => { asked.push(opts.captureRequest.locator); return refused; };
  const g = w.m.gathering(NOW_MS);
  assert.deepEqual(g.disabled.map((x) => x.id), ["GATH-2026-0651-off"]);
  assert.equal(g.due.some((x) => x.bundle === "INFO-2026-0651-off"), false, "a disabled bundle's request is never due");
  const t = await w.m.cadenceTick(NOW_MS);
  /* disabled: never fetched, stated */
  assert.equal(asked.some((u) => u.includes("off1")), false);
  assert.deepEqual(t.gathered.skipped.filter((x) => x.bundle === "INFO-2026-0651-off"),
    [{ bundle: "INFO-2026-0651-off", request: "GATH-2026-0651-off", reason: word("monitoring.bundle_daemon_block") }]);
  /* tick_budget 1: one locator for the bundle in this tick; its second request waits, stated */
  assert.deepEqual(asked.filter((u) => u.includes("-bud")), [loc("bud", 2, "p")]);
  assert.deepEqual(t.gathered.failed.find((x) => x.bundle === "INFO-2026-0652-budget").tried.map((x) => x.locator), [loc("bud", 2, "p")]);
  assert.deepEqual(t.gathered.skipped.filter((x) => x.bundle === "INFO-2026-0652-budget"),
    [{ bundle: "INFO-2026-0652-budget", request: "GATH-2026-0653-bud", reason: "its bundle's daemon tick_budget (1) is spent in this tick" }]);
  /* negative controls: enabled with no budget, and no daemon block, try every locator as before */
  assert.deepEqual(asked.filter((u) => u.includes("-on") || u.includes("-pl")),
    [loc("on", 4, "p"), loc("on", 4, "m"), loc("pl", 5, "p"), loc("pl", 5, "m")]);
  /* the statement holds no epoch open: the next tick is fresh */
  assert.notEqual((await w.m.cadenceTick(NOW_MS + 1000)).epoch, t.epoch);
  /* only a disabled bundle's requests: nothing is due */
  const x = world();
  const t1 = JSON.stringify({ daemon: { enabled: false }, requests: [r2("x", 6)] });
  x.promote("INFO-2026-0655-x", infoMd("INFO-2026-0655-x", "https://records.example.org/x", { enabled: false }),
    { files: [{ path: "data/gathering.json", text: t1, bytes: Buffer.byteLength(t1), sha256: sha(t1) }] });
  assert.equal(x.m.cadenceDue(NOW_MS), null);
});

test("R28 the cadence tick runs due requests after its batch's addresses, within R19's budget of 50, each locator a request tries spending one", async () => {
  const many = [];
  for (let i = 0; i < 3; i++) many.push(req(`GATH-2026-062${i}-n`, { locators: [`https://p${i}.example.org/a`, `https://m${i}.example.org/a`] }));
  const { w, calls } = gatheringWorld(many);
  for (let i = 0; i < MONITOR_CADENCE_BATCH - 3; i++) w.monitored(`INFO-2026-${7000 + i}-addr`, `https://addr.example.org/${i}`, `addr ${i}`, { freq: "daily" });
  const order = [];
  const realMonitor = w.m.monitor.bind(w.m);
  w.m.monitor = async (q) => { order.push(["address", q.bundleId]); return { status: 200, body: { ok: true, status: "unchanged" } }; };
  const realAcquire = w.capture.acquire;
  w.capture.acquire = (body, opts) => { order.push(["request", opts.captureRequest.locator]); return realAcquire(body, opts); };
  const t = await online(w, () => w.m.cadenceTick(NOW_MS));
  /* 47 addresses, then 3 fetches: the first request's two locators (its publisher fails) and the second's first */
  assert.equal(t.ticked.length, MONITOR_CADENCE_BATCH - 3);
  assert.deepEqual(order.slice(0, MONITOR_CADENCE_BATCH - 3).every(([k]) => k === "address"), true, "addresses first");
  assert.deepEqual(order.slice(MONITOR_CADENCE_BATCH - 3), [["request", "https://p0.example.org/a"], ["request", "https://m0.example.org/a"],
                                                            ["request", "https://p1.example.org/a"]]);
  assert.equal(order.length, MONITOR_CADENCE_BATCH, "the budget is 50 fetches");
  assert.equal(t.gathered.due, 3);
  assert.ok(realMonitor && calls.length === 3);
});
/* R29 (a ratified sweep runs within its scope and budget and files each document at collected) and R31's five sweep
   conditions are link-sweep's to run and answer since N506 (its R4–R9, R11, tested under `test/m/link-sweep/`); this
   module's share of them is the seam (R65, R66), tested in `seam.test.mjs`. */
test("R31 the reads answer what queue-producers publishes: flagged (R48) names each flagged tick's document with its source_status and since (source-modified, source-removed); archiveEligible (R47) each eligible address with its first failure (archive-fallback-eligible); monitoring({viewer}) each address overdue by more than its interval, with due_at and interval_ms, and each unscheduled one with its reason (monitoring-recheck-due); this module publishes no item", async () => {
  const w = world();
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
  const tick = (id) => w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON });
  /* source-modified, source-removed: R8's flag, read by R48; an unchanged tick is the negative control */
  const L = (n) => `https://records.example.org/r31-${n}.txt`;
  w.monitored("INFO-2026-0801-mod", L(1), "r31 v1 1", { freq: "weekly" });
  w.monitored("INFO-2026-0802-gone", L(2), "r31 v1 2", { freq: "weekly" });
  w.monitored("INFO-2026-0803-same", L(3), "r31 v1 3", { freq: "weekly" });
  w.net.routes[L(1)] = serve("v2");
  w.net.routes[L(2)] = serve("gone", "text/plain", 404);
  w.net.routes[L(3)] = serve("r31 v1 3");
  const ticks = {};
  w.clock.ms -= 25 * 3600e3;                        /* R4: a removal is confirmed by a second look a day or more after the first */
  await tick("INFO-2026-0802-gone");
  w.clock.ms += 25 * 3600e3;
  for (const id of ["INFO-2026-0801-mod", "INFO-2026-0802-gone", "INFO-2026-0803-same"]) ticks[id] = (await tick(id)).body;
  const f = w.m.flagged({ viewer: DAEMON });
  assert.deepEqual(f.items, [
    { bundleId: "INFO-2026-0801-mod", source_status: "modified", since: ticks["INFO-2026-0801-mod"].checked },
    { bundleId: "INFO-2026-0802-gone", source_status: "removed", since: ticks["INFO-2026-0802-gone"].checked }]);
  assert.deepEqual([f.limit, f.truncated], [200, false], "the bound queue-producers publishes on each item");
  /* archive-fallback-eligible: R47, with the first failure of the run */
  for (let i = 0; i < 3; i++) await w.capture.recordSourceOutcome({ addressNorm: "https://gone.example.org/r31", outcome: "fetch_failed", at: "2026-09-10T00:00:00Z" });
  const e = w.m.archiveEligible(NOW_MS);
  assert.deepEqual(e.eligible.map((x) => [x.address, x.first_failure_since, x.reachability.fallback_eligible]),
                   [["https://gone.example.org/r31", "2026-09-10T00:00:00Z", true]]);
  assert.deepEqual([e.limit, e.truncated, e.paused], [50, false, { paused: false }]);
  /* monitoring-recheck-due: overdue by more than its interval, or unscheduled; due but within its interval, and never
     checked, are not overdue (the negative controls) */
  const at = (id, ms) => w.st.sql.exec(`UPDATE bundle_projection SET monitor_last_checked=? WHERE bundle_id=?`, iso(ms), id);
  w.monitored("INFO-2026-0804-late", L(4), "r31 v1 4", { freq: "daily" });
  w.monitored("INFO-2026-0805-just", L(5), "r31 v1 5", { freq: "daily" });
  w.monitored("INFO-2026-0806-never", L(6), "r31 v1 6", { freq: "daily" });
  w.monitored("INFO-2026-0807-meet", L(7), "r31 v1 7", { freq: "per_meeting" });
  at("INFO-2026-0804-late", NOW_MS - 3 * DAY);
  at("INFO-2026-0805-just", NOW_MS - DAY - DAY / 2);
  const items = Object.fromEntries(w.m.monitoring({ viewer: DAEMON, now: NOW_MS }).items.map((r) => [r.bundle, r]));
  const overdue = (r) => r.state === "due" && Number.isFinite(Date.parse(r.due_at)) && NOW_MS - Date.parse(r.due_at) > r.interval_ms;
  assert.deepEqual([items["INFO-2026-0804-late"].due_at, items["INFO-2026-0804-late"].interval_ms], [iso(NOW_MS - 2 * DAY), DAY]);
  assert.equal(overdue(items["INFO-2026-0804-late"]), true, "two days past a daily check");
  assert.equal(overdue(items["INFO-2026-0805-just"]), false, "half a day past: due, not overdue");
  assert.deepEqual([items["INFO-2026-0806-never"].state, items["INFO-2026-0806-never"].due_at], ["due", null], "never checked: due now, not overdue");
  assert.deepEqual([items["INFO-2026-0807-meet"].state, items["INFO-2026-0807-meet"].reason],
                   ["unscheduled", word("monitoring.cadence_meeting_schedule")]);
  /* this module publishes no item: none of its reads answers an item of the item contract */
  for (const read of [f, e, w.m.monitoring({ viewer: DAEMON, now: NOW_MS })])
    assert.equal(/"class":"(FINDING|CONDITION)"|"kind":"(source-modified|source-removed|archive-fallback-eligible|monitoring-recheck-due)"/
      .test(JSON.stringify(read)), false);
});

/* An action with two clock entries, one past and one not, by a member. */
const ACT = "ACTN-2026-0700-req";
const actionMd = (id, clock) => ["---", `id: ${id}`, "object_type: action", `title: ${id}`, "current_state: planned",
  'created: "2026-09-01T00:00:00Z"', 'last_updated: "2026-09-01T00:00:00Z"', "action_kind: records_request", "risk_tier: 1",
  "counterparty:", "  state: named", "  role: Town Clerk", "  body: Town of Port Ellery",
  "clock:", ...clock.flatMap(([text, date, status]) => [`  - text: ${text}`, `    description: ${text} window`, `    date: ${date}`,
    "    basis: statute", `    status: ${status}`]), "---", "", "An action.", ""].join("\n");
const createAction = (w, id, clock) => {
  const md = actionMd(id, clock);
  const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `20260920T000000Z_${id.slice(10, 14)}`, author: V("alice"),
    meta: { object_type: "action", group: "test-group", title: id, current_state: "planned", created: "2026-09-01T00:00:00Z", last_updated: "2026-09-01T00:00:00Z" },
    files: [{ path: "bundle.md", text: md, bytes: Buffer.byteLength(md), sha256: sha(md) }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return md;
};

test("R33 (N170) the sources a live objective rests on are known to monitoring through intent's watchSet, followed to its end; one not monitored is proposed to the project's members through intent's registration, never enabled", async () => {
  const f = await watchSetOf({ objective: [sha("w1"), sha("w2"), sha("w3")] }, { page: 2 });
  const w = world({ intent: f.intent });
  const a = w.monitored("INFO-2026-0710-watched", "https://records.example.org/w1", "w1", { freq: "daily" });
  const b = w.monitored("INFO-2026-0711-unwatched", "https://records.example.org/w2", "w2", { enabled: false });
  const c = w.monitored("INFO-2026-0712-also", "https://records.example.org/w3", "w3", { enabled: false });
  const P = f.projects.objective;
  const k = w.m.watched({ project: P });
  assert.equal(k.ok, true);
  assert.deepEqual(Object.fromEntries(k.captures.map((x) => [x.bundle, x.monitored])),
    { "INFO-2026-0710-watched": true, "INFO-2026-0711-unwatched": false, "INFO-2026-0712-also": false });
  /* intent pages its captures in sha order, two at a time: the cursor is followed to null */
  assert.deepEqual(f.calls.map((x) => x.after), [null, [a.cap, b.cap, c.cap].sort()[1]], "the cursor is followed to null");
  /* registered as intent's proposal source at start (intent R15) */
  const src = f.sources.find((s) => s.kind === "monitoring");
  assert.ok(src, "monitoring registered its proposal source");
  const props = src.reader({ project: P, viewer: "class:daemon" });
  assert.deepEqual(props.map((p) => p.basis.bundle).sort(), ["INFO-2026-0711-unwatched", "INFO-2026-0712-also"]);
  for (const p of props) {
    assert.deepEqual([p.source, p.kind, p.surfaced_by], ["monitoring", "monitor-source", "machine"]);
    assert.match(p.basis.says, /the daemon never enables it/);
  }
  assert.equal(w.fm("INFO-2026-0711-unwatched").monitoring.enabled, false, "never enabled by the daemon");
  assert.equal(src.reader({ project: P, viewer: "nobody" }).length, 0, "through the viewer's sight");
  /* a change at a watched source reaches reevaluation as R8's flag: the document's own reeval_pending (tick.test R8) */
});
test("R33 (N230) the sources a published finding rests on are known to monitoring through publication's restingCapturesOf, followed by its cursor to the end, and one not monitored is proposed to the finding's project the same way, never enabled", async () => {
  /* the objective of P reads f3; the findings rest on f1 and f3 (F, of P), on f2 (G, of P and another project) and on f4 (H, of the other) */
  const f = await watchSetOf({ objective: [sha("f3")] }, { page: 2 });
  const P = f.projects.objective, OTHER = "PROJ-2026-0003-o";
  const pub = pagedResting(restingOf([
    { finding: "INQ-2026-0701-f", projects: [P], digests: [sha("f1"), sha("f3")] },
    { finding: "INQ-2026-0702-g", projects: [P, OTHER], digests: [sha("f2")] },
    { finding: "INQ-2026-0703-h", projects: [OTHER], digests: [sha("f4")] },
  ]).publication);
  const w = world({ intent: f.intent, publication: pub });
  const a = w.monitored("INFO-2026-0740-rests", "https://records.example.org/f1", "f1", { freq: "daily" });
  const b = w.monitored("INFO-2026-0741-unwatched", "https://records.example.org/f2", "f2", { enabled: false });
  const c = w.monitored("INFO-2026-0742-both", "https://records.example.org/f3", "f3", { enabled: false });
  w.monitored("INFO-2026-0743-other", "https://records.example.org/f4", "f4", { enabled: false });
  const k = w.m.watched({ project: P });
  assert.equal(k.ok, true);
  const by = Object.fromEntries(k.captures.map((x) => [x.bundle, x]));
  assert.deepEqual(Object.keys(by).sort(), ["INFO-2026-0740-rests", "INFO-2026-0741-unwatched", "INFO-2026-0742-both"], "only this project's findings");
  assert.deepEqual(by["INFO-2026-0741-unwatched"].rests_on, ["finding"]);
  assert.deepEqual(by["INFO-2026-0741-unwatched"].findings, ["INQ-2026-0702-g"]);
  assert.deepEqual(by["INFO-2026-0742-both"].rests_on.sort(), ["finding", "objective"]);
  assert.equal(by["INFO-2026-0740-rests"].monitored, true);
  /* the cursor is followed to its end (pages of two) */
  const sorted = [a.cap, b.cap, c.cap, sha("f4")].sort();
  assert.deepEqual(pub.calls.map((x) => x.after), [null, sorted[1]]);
  /* proposed through intent's registration to the project, never enabled */
  const src = f.sources.find((s) => s.kind === "monitoring");
  const props = src.reader({ project: P, viewer: "class:daemon" });
  assert.deepEqual(props.map((p) => p.basis.bundle).sort(), ["INFO-2026-0741-unwatched", "INFO-2026-0742-both"]);
  const pb = props.find((p) => p.basis.bundle === "INFO-2026-0741-unwatched");
  assert.match(pb.basis.says, /^a published finding of this project rests on this document/);
  assert.match(props.find((p) => p.basis.bundle === "INFO-2026-0742-both").basis.says, /^an objective and a published finding/);
  assert.equal(w.fm("INFO-2026-0741-unwatched").monitoring.enabled, false, "never enabled by the daemon");
  /* a publication that cannot be read leaves the objective half standing, and says so */
  const g = await watchSetOf({ objective: [sha("f5")] }, { page: 2 });
  const x = world({ intent: g.intent, publication: { restingCapturesOf: () => { throw new Error("gone"); } } });
  x.monitored("INFO-2026-0744-obj", "https://records.example.org/f5", "f5", { enabled: false });
  const xk = x.m.watched({ project: g.projects.objective });
  assert.deepEqual([xk.ok, xk.captures.length, xk.findings_unread], [true, 1, "gone"]);
});

test("R34 a pending clock entry whose date has passed is marked overdue by a mechanical deadline-recheck promotion changing only clock[].status and last_updated", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  const before = createAction(w, ACT, [["answer", "2026-09-01", "pending"], ["appeal", "2099-12-01", "pending"], ["today", "2026-09-28", "pending"]]);
  const r = await w.m.deadlineRecheck(NOW_MS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.marked.map((m) => [m.action, m.ords, m.dates]), [[ACT, [0], ["2026-09-01"]]], "a deadline of today is not yet past");
  const after = w.text(ACT);
  const fa = parseFrontmatter(after).data, fb = parseFrontmatter(before).data;
  assert.deepEqual(fa.clock.map((e) => e.status), ["overdue", "pending", "pending"]);
  const m = w.manifest(ACT).at(-1);
  assert.deepEqual([m.writer, m.operation, m.author], ["mechanical", "deadline-recheck", MONITOR_AUTHOR]);
  assert.deepEqual(MECHANICAL_FIELD_SETS["deadline-recheck"], ["clock[].status", "last_updated"]);
  for (const k of Object.keys(fb)) if (k !== "clock" && k !== "last_updated") assert.deepEqual(fa[k], fb[k], k);
  assert.deepEqual(fa.clock.map(({ status, ...rest }) => rest), fb.clock.map(({ status, ...rest }) => rest));
  assert.match(after, /Deadline recheck: the clock entry dated 2026-09-01 passed while pending and is marked overdue/);
  /* N297: a promotion refusing with no code is said in words, never given a bare code of monitoring's */
  const P2 = "ACTN-2026-0701-nocode";
  createAction(w, P2, [["late", "2026-09-02", "pending"]]);
  const real = w.promotion.promote.bind(w.promotion);
  w.promotion.promote = (pkg) => (pkg.operation === "deadline-recheck" ? { ok: false } : real(pkg));
  const nc = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual(nc.failed, [{ action: P2, reason: null, detail: "the promotion refused the mark and named no reason" }]);
  w.promotion.promote = real;
  const done = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual(done.marked.map((x) => x.action), [P2]);
  /* nothing further to mark: a second recheck writes nothing */
  const n = w.manifest(ACT).length;
  const again = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual([again.marked, w.manifest(ACT).length], [[], n]);
});
test("R34 the overdue mark R44 writes is what action-clocks.overdueClocks reads for queue-producers' telling: a pending entry past its date is read pending before the mark and overdue after it; an entry not yet past is not read", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  const id = "ACTN-2026-0705-told";
  createAction(w, id, [["answer", "2026-09-01", "pending"], ["appeal", "2099-12-01", "pending"]]);
  const read = () => w.clocks.overdueClocks({ viewer: MONITOR_VIEWER, now: NOW_MS }).items.filter((x) => x.action === id)
    .map((x) => [x.ord, x.date, x.status]);
  assert.deepEqual(read(), [[0, "2026-09-01", "pending"]], "before the mark: past and still pending");
  const r = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual(r.marked.map((m) => [m.action, m.ords]), [[id, [0]]]);
  assert.deepEqual(read(), [[0, "2026-09-01", "overdue"]], "after it: the mark, as monitoring wrote it");
  assert.equal(w.fm(id).clock[0].status, "overdue");
});

test("R44 the mark reads action-clocks.pendingClocks and moves an entry only from pending to overdue; met, waived and overdue entries are left; nothing is added, removed or re-dated", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  const id = "ACTN-2026-0720-mixed";
  createAction(w, id, [["a", "2026-08-01", "met"], ["b", "2026-08-02", "waived"], ["c", "2026-08-03", "overdue"], ["d", "2026-08-04", "pending"]]);
  let read = null;
  const orig = w.clocks.pendingClocks.bind(w.clocks);
  w.clocks.pendingClocks = (q) => { read = q; return orig(q); };
  const r = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual(read, { before: "2026-09-30", limit: 500, viewer: MONITOR_VIEWER },
    "through action-clocks R1, today's entries and the next day's read too (T45: a time of day passes at its instant)");
  assert.deepEqual(r.marked.map((m) => m.ords), [[3]]);
  const clock = w.fm(id).clock;
  assert.deepEqual(clock.map((e) => [e.text, e.date, e.status]),
    [["a", "2026-08-01", "met"], ["b", "2026-08-02", "waived"], ["c", "2026-08-03", "overdue"], ["d", "2026-08-04", "overdue"]]);
  /* an entry the read names that the document no longer holds pending is not moved */
  w.clocks.pendingClocks = () => ({ ok: true, items: [{ action: id, ord: 0, date: "2026-08-01", past: true }], truncated: false });
  const stale = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual([stale.marked, stale.failed.map((f) => f.reason)], [[], ["NOTHING_PENDING"]]);
  /* the rewrite itself touches only named pending status lines */
  const text = "---\nclock:\n  - text: x\n    status: pending\n  - text: y\n    status: met\n---\n";
  assert.equal(markOverdue(text, [0]), "---\nclock:\n  - text: x\n    status: overdue\n  - text: y\n    status: met\n---\n");
  assert.equal(markOverdue(text, [1]), null, "a met entry is never moved");
  /* the real actions module holds the same bound at the write: a machine move to anything but overdue is refused */
  const live = w.text(id);
  const tampered = live.replace("    status: overdue\n", "    status: met\n");
  const refused = w.promotion.promote({ bundleId: id, base: sha(live), snapKey: "20260928T120000Z_tamper", author: MONITOR_AUTHOR,
    writer: "mechanical", operation: "deadline-recheck",
    meta: { object_type: "action", title: id, current_state: "planned", created: "2026-09-01T00:00:00Z", last_updated: "2026-09-28T12:00:00Z" },
    files: [{ path: "bundle.md", text: tampered, bytes: Buffer.byteLength(tampered), sha256: sha(tampered) }] });
  assert.equal(refused.ok, false);
});

test("R35 when a clock is marked overdue or a response is recorded against an action, monitoring asks escalation (as its own viewer) whether a stage's trigger is met; it never advances a stage", async () => {
  const calls = [];
  const esc = { escalationsDue(q) { calls.push(q); return { ok: true, as_of: "2026-09-28T12:00:00Z", items: [{ id: "ESC-2026-0001-x", stage: "response_evaluation" }], truncated: false, limit: 500 }; },
                advance() { throw new Error("monitoring never advances a stage"); } };
  const w = world({ realActions: true, escalation: esc });
  createAction(w, "ACTN-2026-0730-esc", [["a", "2026-09-01", "pending"]]);
  calls.length = 0;
  const r = await w.m.deadlineRecheck(NOW_MS);
  assert.equal(r.marked.length, 1);
  assert.ok(calls.length >= 1);
  assert.deepEqual(calls[0], { nowMs: NOW_MS, viewer: MONITOR_VIEWER }, "asked with its own viewer");
  assert.deepEqual(r.escalations.items.map((i) => i.id), ["ESC-2026-0001-x"]);
  /* a response recorded: the action's promotion commits, and escalation is asked */
  calls.length = 0;
  const live = w.text("ACTN-2026-0730-esc");
  const withReply = live.replace("---\n\nAn action.", "correspondence:\n  - direction: received\n    at: 2026-09-27\n    medium: email\n    party: Town Clerk\n    account: the clerk answered\n    author: member:alice\n---\n\nAn action.");
  const rr = w.promotion.promote({ bundleId: "ACTN-2026-0730-esc", base: sha(live), snapKey: "20260928T120000Z_reply", author: V("alice"),
    meta: { object_type: "action", title: "ACTN-2026-0730-esc", current_state: "planned", created: "2026-09-01T00:00:00Z", last_updated: "2026-09-28T12:00:00Z" },
    files: [{ path: "bundle.md", text: withReply, bytes: Buffer.byteLength(withReply), sha256: sha(withReply) }] });
  assert.equal(rr.ok, true, JSON.stringify(rr).slice(0, 300));
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(calls.length, 1, "asked once the response was recorded");
  assert.equal(w.m.escalationsSeen().action, "ACTN-2026-0730-esc");
  assert.deepEqual(calls.at(-1), { nowMs: NOW_MS, viewer: MONITOR_VIEWER });
  /* another type, or a replay, asks nothing */
  calls.length = 0;
  w.m.actionCommitted({ bundleId: "INFO-2026-0001-x", type: "information" });
  w.m.actionCommitted({ bundleId: "ACTN-2026-0730-esc", type: "action", replay: true });
  assert.equal(calls.length, 0);
});

const DAY = 86400000, HOUR = 3600000;
/* The fixture's profile (test-port-ellery) holds the zone America/Halifax, which keeps daylight time (UTC-3) from
   2026-03-08 to 2026-11-01 and standard time (UTC-4) after it: the local day after D starts at 03:00 UTC on D + 1 while
   daylight time holds, and at 04:00 UTC after it. Every date below the 2026-11-01 change is in daylight time. */
const dayAfter = (d) => Date.parse(`${d}T00:00:00Z`) + DAY + (d >= "2026-11-01" ? 4 : 3) * HOUR;

test("R50 deadlineRecheckWake(now) answers the start of the local day (the jurisdiction's zone, never UTC) after the earliest pending clock date of the actions this module sees, read through action-clocks.pendingClocks as its machine viewer; null when none is pending", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), null, "no action: no wake");
  /* only met, waived and overdue entries: nothing pending, no wake */
  createAction(w, "ACTN-2026-0750-settled", [["a", "2026-08-01", "met"], ["b", "2026-08-02", "waived"], ["c", "2026-08-03", "overdue"]]);
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), null, "no pending entry: no wake");
  /* future and past pending entries across actions: the earliest date governs, past or not */
  createAction(w, "ACTN-2026-0751-later", [["a", "2026-11-20", "pending"], ["b", "2026-10-05", "pending"]]);
  createAction(w, "ACTN-2026-0752-soon", [["a", "2026-10-30", "pending"], ["done", "2026-09-02", "met"]]);
  const reads = [];
  const orig = w.clocks.pendingClocks.bind(w.clocks);
  w.clocks.pendingClocks = (q) => { reads.push(q); return orig(q); };
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), dayAfter("2026-10-05"), "the day after the earliest pending date");
  assert.ok(reads.length >= 1);
  for (const q of reads) assert.deepEqual([q.viewer, q.limit], [MONITOR_VIEWER, DEADLINE_RECHECK_MAX], "as its machine viewer");
  /* an entry whose date has already passed: its next day, which is in the past, so the wake is due now */
  createAction(w, "ACTN-2026-0753-past", [["a", "2026-09-01", "pending"]]);
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), dayAfter("2026-09-01"));
  /* marked overdue by R34, the entry no longer holds a wake: the next earliest does */
  await w.m.deadlineRecheck(NOW_MS);
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), dayAfter("2026-10-05"));
});

test("R50 the wake follows pendingClocks' cursor to the end, so a pending entry on a later page still holds the wake; a read that fails holds none", () => {
  const pages = [
    { ok: true, items: [{ action: "ACTN-a", ord: 0, date: "2026-12-01" }], truncated: true, cursor: "ACTN-a#0" },
    { ok: true, items: [{ action: "ACTN-b", ord: 2, date: "2026-10-09" }], truncated: true, cursor: "ACTN-b#2" },
    { ok: true, items: [{ action: "ACTN-c", ord: 0, date: "2026-11-01" }], truncated: false, cursor: null },
  ];
  const seen = [];
  const clocks = { pendingClocks(q) { seen.push(q.after); return pages[seen.length - 1]; } };
  const w = world({ actionClocks: clocks });
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), dayAfter("2026-10-09"));
  assert.deepEqual(seen, [null, "ACTN-a#0", "ACTN-b#2"], "every page, by its cursor");
  for (const bad of [() => pendingClocksRefusal(), () => { throw new Error("gone"); }, () => null]) {
    const x = world({ actionClocks: { pendingClocks: bad } });
    assert.equal(x.m.deadlineRecheckWake(NOW_MS), null);
    assert.equal(x.m.deadlineRecheckDue(NOW_MS), null);
  }
});

test("R50 deadlineRecheckDue(now) answers the wake's instant when it is at or before now, else null; the scheduler's consumer then runs R34 on the first alarm of the day an entry passes", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  assert.equal(w.m.deadlineRecheckDue(NOW_MS), null, "nothing pending");
  const id = "ACTN-2026-0760-due";
  createAction(w, id, [["a", "2026-10-03", "pending"]]);
  const wake = dayAfter("2026-10-03");
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), wake);
  assert.equal(w.m.deadlineRecheckDue(NOW_MS), null, "not yet");
  assert.equal(w.m.deadlineRecheckDue(wake - 1), null, "the last instant of the entry's own day: not yet past");
  assert.equal(w.m.deadlineRecheckDue(wake), wake, "due at the start of the next day");
  assert.equal(w.m.deadlineRecheckDue(wake + 5 * DAY), wake, "and while it stays pending");
  /* on that first alarm R34 marks it, and then nothing is due */
  w.clock.ms = wake;
  const r = await w.m.deadlineRecheck(wake);
  assert.deepEqual(r.marked.map((m) => [m.action, m.dates]), [[id, ["2026-10-03"]]]);
  assert.deepEqual([w.m.deadlineRecheckWake(wake), w.m.deadlineRecheckDue(wake)], [null, null]);
});

test("R50 (N429) an entry of an action whose last R34 mark failed is left out of the wake's earliest date until the start of the local day after the failure, so a failing mark is asked again once a day and never holds the wake in the past for the entries that can be marked", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  const FAIL = "ACTN-2026-0770-fails", OK = "ACTN-2026-0771-marks", LATER = "ACTN-2026-0772-later";
  createAction(w, FAIL, [["a", "2026-09-01", "pending"]]);
  createAction(w, LATER, [["a", "2026-10-05", "pending"]]);
  const nextDay = dayAfter("2026-09-28");   /* NOW_MS is 2026-09-28T12:00:00Z, 09:00 on the 28th in Halifax */
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), dayAfter("2026-09-01"), "before any failure, the past entry holds the wake");
  /* R34's mark of FAIL fails: its entry is held out until the start of the next local day */
  const real = w.promotion.promote.bind(w.promotion);
  w.promotion.promote = (pkg) => (pkg.operation === "deadline-recheck" && pkg.bundleId === FAIL ? staleBaseRefusal() : real(pkg));
  const r1 = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual(r1.failed.map((f) => f.action), [FAIL]);
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), nextDay, "held no earlier than the next day, never in the past");
  assert.equal(w.m.deadlineRecheckDue(NOW_MS), null, "nothing due for the rest of the failure's day");
  assert.equal(w.m.deadlineRecheckDue(nextDay - 1), null);
  /* an entry that can be marked is not held back by the failing one: it holds the wake in the past, and is marked */
  createAction(w, OK, [["a", "2026-09-10", "pending"]]);
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), dayAfter("2026-09-10"));
  const r2 = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual([r2.marked.map((m) => m.action), r2.failed.map((f) => f.action)], [[OK], [FAIL]]);
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), nextDay);
  /* at the start of the next day the failing entry is asked again: due once, and failing again it is held a further day */
  assert.equal(w.m.deadlineRecheckWake(nextDay), dayAfter("2026-09-01"));
  assert.equal(w.m.deadlineRecheckDue(nextDay), dayAfter("2026-09-01"));
  w.clock.ms = nextDay;
  const r3 = await w.m.deadlineRecheck(nextDay);
  assert.deepEqual(r3.failed.map((f) => f.action), [FAIL]);
  assert.equal(w.m.deadlineRecheckWake(nextDay), nextDay + DAY, "once a day");
  /* a later failure the same day holds to the same instant */
  const r4 = await w.m.deadlineRecheck(nextDay + 3600000);
  assert.deepEqual(r4.failed.map((f) => f.action), [FAIL]);
  assert.equal(w.m.deadlineRecheckWake(nextDay + 3600000), nextDay + DAY);
  /* when the mark lands, the hold is released: nothing pending is past, and the later entry holds the wake */
  w.promotion.promote = real;
  w.clock.ms = nextDay + DAY;
  const r5 = await w.m.deadlineRecheck(nextDay + DAY);
  assert.deepEqual(r5.marked.map((m) => m.action), [FAIL]);
  assert.equal(w.m.deadlineRecheckWake(nextDay + DAY), dayAfter("2026-10-05"));
  /* an entry not yet past is not moved by its action's failure: its own day after stands when later than the hold */
  const v = world({ realActions: true, escalation: emptyEscalation() });
  createAction(v, "ACTN-2026-0773-both", [["past", "2026-09-01", "pending"], ["future", "2026-10-20", "pending"]]);
  const vreal = v.promotion.promote.bind(v.promotion);
  v.promotion.promote = (pkg) => (pkg.operation === "deadline-recheck" ? staleBaseRefusal() : vreal(pkg));
  await v.m.deadlineRecheck(NOW_MS);
  assert.equal(v.m.deadlineRecheckWake(NOW_MS), nextDay);
  v.promotion.promote = vreal;
  assert.equal(v.m.deadlineRecheckWake(nextDay), dayAfter("2026-09-01"));
});

test("R34 R50 (K1444 (iii)) an entry's date passes on the local day of the actions' jurisdiction, as actions R12 and its R33 bound read it, never the UTC day: an entry dated the 3rd is not past at 02:00 UTC on the 4th (23:00 on the 3rd in Halifax) and is marked at 03:00 UTC; the wake is that instant, and across the change to standard time the local day starts an hour later", async () => {
  const w = world({ realActions: true, escalation: emptyEscalation() });
  const id = "ACTN-2026-0780-local";
  createAction(w, id, [["a", "2026-10-03", "pending"]]);
  const start = Date.parse("2026-10-04T03:00:00Z");
  assert.equal(w.m.deadlineRecheckWake(NOW_MS), start, "the start of the 4th in Halifax, not 00:00 UTC");
  /* the UTC day is the 4th, the local day still the 3rd: nothing has passed, and the write bound agrees */
  const reads = [];
  const orig = w.clocks.pendingClocks.bind(w.clocks);
  w.clocks.pendingClocks = (q) => { reads.push(q.before); return orig(q); };
  w.clock.ms = start - HOUR;
  assert.equal(w.m.deadlineRecheckDue(start - HOUR), null);
  const early = await w.m.deadlineRecheck(start - HOUR);
  assert.deepEqual([early.ok, early.zone, early.day, early.marked, early.failed], [true, "America/Halifax", "2026-10-03", [], []]);
  assert.equal(reads.at(-1), "2026-10-05", "pendingClocks is asked from the local day, never the UTC day (the 3rd, two days on: T45's timed entries)");
  assert.equal(w.fm(id).clock[0].status, "pending");
  /* at the start of the local 4th it is past, due and marked */
  w.clock.ms = start;
  assert.equal(w.m.deadlineRecheckDue(start), start);
  const r = await w.m.deadlineRecheck(start);
  assert.deepEqual([r.day, r.marked.map((m) => [m.action, m.dates])], ["2026-10-04", [[id, ["2026-10-03"]]]]);
  assert.equal(w.fm(id).clock[0].status, "overdue");
  /* across the end of daylight time (2026-11-01) the local day after starts at 04:00 UTC */
  const x = world({ realActions: true, escalation: emptyEscalation() });
  createAction(x, "ACTN-2026-0781-dst", [["a", "2026-11-01", "pending"]]);
  assert.equal(x.m.deadlineRecheckWake(NOW_MS), Date.parse("2026-11-02T04:00:00Z"));
  /* a failed mark is held to the start of the next local day, never the next UTC midnight */
  const y = world({ realActions: true, escalation: emptyEscalation() });
  createAction(y, "ACTN-2026-0782-hold", [["a", "2026-09-01", "pending"]]);
  const real = y.promotion.promote.bind(y.promotion);
  y.promotion.promote = (pkg) => (pkg.operation === "deadline-recheck" ? staleBaseRefusal() : real(pkg));
  const late = Date.parse("2026-09-29T01:00:00Z");   /* 22:00 on the 28th in Halifax */
  y.clock.ms = late;
  assert.equal((await y.m.deadlineRecheck(late)).failed.length, 1);
  assert.equal(y.m.deadlineRecheckWake(late), Date.parse("2026-09-29T03:00:00Z"));
});

test("R34 R50 with no zone held for the actions' jurisdiction no entry has passed: nothing is marked, the answer says why, and no wake is held; the UTC day is never used in its place", async () => {
  const w = world({ profiles: null, realActions: true, escalation: emptyEscalation() });
  const id = "ACTN-2026-0790-nozone";
  createAction(w, id, [["a", "2026-09-01", "pending"]]);
  const r = await w.m.deadlineRecheck(NOW_MS);
  assert.deepEqual([r.ok, r.zone, r.marked, r.failed], [true, null, [], []]);
  assert.equal(r.undetermined, DEADLINE_NO_ZONE);
  assert.equal(w.fm(id).clock[0].status, "pending");
  assert.deepEqual([w.m.deadlineRecheckWake(NOW_MS), w.m.deadlineRecheckDue(NOW_MS)], [null, null]);
});
