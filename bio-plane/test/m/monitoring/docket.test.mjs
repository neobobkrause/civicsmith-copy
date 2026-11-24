/* monitoring R67 and R68 (N534; DEC-101 (3)): the docket watch, read daily in the cadence tick, and its due and wake;
   with R30's pause of the docket reads, R36's bound on what a docket read fetches, and N538's re-pointing (the
   Civicsmith user agent a tick and a docket read send, the slate's framing). case-import is the real module (its
   published `watchedImports` fixture: real imports, each watched by a member's own act) seen through a spy; the network
   is scripted; every test drives `monitoring` at its interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, serve, sha, infoMd, DAEMON, NOW_MS } from "./fixture.mjs";
import { staleBaseRefusal } from "../promotion/fixtures.mjs";
import { acquireRefusals } from "../acquisition/fixtures.mjs";
import { watchedImports } from "../case-import/fixtures.mjs";
import { MONITOR_CADENCE_DELAY_MS, MONITOR_CADENCE_BATCH, MONITOR_TICK_MS, SLATE_FRAMING_OPEN, DOCKET_READ_INTERVAL_MS,
         DOCKET_READ_MAX_BYTES, DOCKET_PURPOSE, DOCKET_UNREADABLE } from "../../../src/monitoring/index.mjs";
import { civicsmithUserAgent } from "../../../src/acquisition/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const HOUR = 3600000, DAY = 24 * HOUR;
const ADMIN = "class:admin";
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
/* A docket's entry case-import cannot verify (its digest does not match): it is recorded, refused. */
const JUNK = [{ seq: 1, digest: "d".repeat(64), json: "{}", signature: "sig" }];
const json = (v, status = 200, headers = {}) => () => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", ...headers } });
/* case-import as the real module answers (watch n is the one at https://publisher<n>.example.org; its import id and docket address are
   case-import's), seen through a spy: `pages` records each `watchedImports` (asked in pages of two, so the cursor is followed), `reads`
   each `recordDocketRead`; `refuse` makes the next reads answer a refusal and `fail` makes them throw; `docketAs` hands monitoring the
   watches with another docket address (one case-import itself would refuse to watch), the read still recorded under the real one. */
function spy(real) {
  return { reads: [], pages: [], refuse: null, fail: null,
    watchedImports({ after = null, limit = null } = {}) {
      this.pages.push({ after, limit });
      const r = real.watchedImports({ after, limit: 2 });
      return this.docketAs === undefined ? r : { ...r, watches: r.watches.map((x) => ({ ...x, docket: this.docketAs })) };
    },
    async recordDocketRead(q) {
      this.reads.push(JSON.parse(JSON.stringify(q)));
      if (this.fail) throw this.fail;
      if (this.refuse) return this.refuse;
      return real.recordDocketRead(this.docketAs === undefined ? q : { ...q, docket: real.watchedImports({}).watches.find((x) => x.import === q.import).docket });
    } };
}
/* A world whose case-import holds one watch for each of `lastRead` (null: never read; an instant: its last read, made by case-import's own
   record of a read then). `IMP(n)` and `D(n)` are watch n's import id and docket address, `ans(n, entries)` the docket's answer for it
   (docket R24's shape, the part this module reads), served as public-read serves it. */
async function watching(lastRead, o = {}) {
  const fx = await watchedImports({ publishers: lastRead.map((_, i) => `https://publisher${i + 1}.example.org`), unwatched: false });
  const group = (id) => fx.ci.watchedImports({}).watches.find((x) => x.import === id).group;
  const ans = (n, entries = JUNK) => ({ ok: true, result: { group: group(fx.watched[n - 1].import), case: fx.watched[n - 1].case, entries, last_entry: entries.length || null } });
  for (const [i, at] of lastRead.entries()) if (at) {
    const r = await fx.ci.recordDocketRead({ import: fx.watched[i].import, docket: fx.watched[i].docket, at, outcome: "read", answer: ans(i + 1, []).result });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const ci = spy(fx.ci);
  const w = world({ caseImport: ci, ...o });
  return { w, ci, fx, ans, IMP: (n) => fx.watched[n - 1].import, D: (n) => fx.watched[n - 1].docket };
}
const count = (w, t) => w.rows(`SELECT count(*) c FROM ${t}`)[0].c;

test("R67 a watch is due when never read, or when its last read plus 24 hours is at or before now; the tick reads watchedImports to its end and reads due watches oldest due first", async () => {
  assert.equal(DOCKET_READ_INTERVAL_MS, DAY, "R14's daily");
  const freshAt = iso(NOW_MS - DAY + 1000);
  /* watches 1 to 5: read three days ago, exactly a day ago, five days ago, a day less a second ago, and never */
  const { w, ci, IMP, D, ans } = await watching([iso(NOW_MS - 3 * DAY), iso(NOW_MS - DAY), iso(NOW_MS - 5 * DAY), freshAt, null]);
  for (const n of [1, 2, 3, 4, 5]) w.net.routes[D(n)] = json(ans(n));
  const t = await w.m.cadenceTick(NOW_MS);
  /* every page of watchedImports, by its cursor (pages of two, in import order) */
  const inOrder = [1, 2, 3, 4, 5].map(IMP).sort();
  assert.deepEqual(ci.pages.slice(0, 3).map((p) => p.after), [null, inOrder[1], inOrder[3]]);
  assert.equal(t.watched.due, 4, "the one read less than a day ago is not due");
  /* oldest due first: never read, then the longest overdue; at exactly a day it is due */
  assert.deepEqual(ci.reads.map((r) => r.import), [IMP(5), IMP(3), IMP(1), IMP(2)]);
  assert.deepEqual(w.net.seen, [D(5), D(3), D(1), D(2)]);
  assert.deepEqual(t.watched.read.map((x) => x.import), [IMP(5), IMP(3), IMP(1), IMP(2)]);
  /* read, the watch is not due again for a day */
  assert.equal(w.m.cadenceDue(NOW_MS + 500), null);
  assert.equal(w.m.cadenceWake(NOW_MS + 500), Date.parse(freshAt) + DAY, "the earliest a watch next falls due");
  assert.equal(w.m.cadenceDue(Date.parse(freshAt) + DAY), Date.parse(freshAt) + DAY, "a day after its last read");
});

test("R67 a read is a GET of the watch's docket address through the host governor, as the Civicsmith agent; HTTP 200 with JSON {ok: true, result} carrying an entries list is read, and goes to recordDocketRead with answer the result; it writes no observation row and no capture reachability", async () => {
  const { w, ci, IMP, D, ans } = await watching([null]);
  const answer = ans(1);
  w.net.routes[D(1)] = json(answer);
  const before = [count(w, "observation_log"), count(w, "source_reachability")];
  const t = await w.m.cadenceTick(NOW_MS);
  assert.deepEqual(ci.reads, [{ import: IMP(1), docket: D(1), at: iso(NOW_MS), outcome: "read", answer: answer.result }]);
  assert.deepEqual(t.watched, { due: 1, read: [{ import: IMP(1), docket: D(1), outcome: "read", new_entries: 1, new_moves: 0, new_refused: 1 }],
                                unreadable: [], governed: [], failed: [] });
  /* the governor admitted and was told; the method is GET (no method named), the user agent the Civicsmith one */
  assert.deepEqual(w.gov.calls.map((c) => c.slice(0, 2)), [["admit", "publisher1.example.org"], ["report", "publisher1.example.org"]]);
  const init = w.net.inits.at(-1);
  assert.equal(init.method ?? "GET", "GET");
  assert.equal(init.headers["user-agent"], civicsmithUserAgent("0.0.0", "unnamed", DOCKET_PURPOSE));
  assert.match(init.headers["user-agent"], /^Civicsmith\//);
  assert.deepEqual([count(w, "observation_log"), count(w, "source_reachability")], before, "no look, no reachability: a docket entry is never evidence");
  /* the negative control: an address tick in the same world writes both */
  const loc = "https://records.example.org/doc.txt";
  w.monitored("INFO-2026-1100-doc", loc, "doc v1", { freq: "daily" });
  w.net.routes[loc] = serve("doc v1");
  await w.m.cadenceTick(NOW_MS + 2 * HOUR);
  assert.ok(count(w, "observation_log") > before[0] && count(w, "source_reachability") > before[1]);
});

test("R67 otherwise the read is unreadable with its reason (http_<status>, not_json, not_a_docket, too_large, fetch_failed), recorded with no answer", async () => {
  assert.deepEqual(DOCKET_UNREADABLE, ["not_json", "not_a_docket", "too_large", "fetch_failed"]);
  assert.equal(DOCKET_READ_MAX_BYTES, 8 * 1024 * 1024);
  const big = "x".repeat(DOCKET_READ_MAX_BYTES + 1);
  const docketBody = (entries) => ({ ok: true, result: { entries } });
  const exact = JSON.stringify(docketBody([{ pad: "" }]));
  const fill = JSON.stringify(docketBody([{ pad: "y".repeat(DOCKET_READ_MAX_BYTES - Buffer.byteLength(exact)) }]));
  assert.equal(Buffer.byteLength(fill), DOCKET_READ_MAX_BYTES);
  const cases = [
    // fixtures-own: platform the docket host's own HTTP answer, served by the scripted network (a fake-network double); public-read's answer is not monitoring's to build
    ["a 404", json({ ok: false, reason: "NO_SUCH_CASE" }, 404), "http_404"],
    ["a 500", serve("boom", "text/plain", 500), "http_500"],
    ["a 203", json(docketBody([]), 203), "http_203"],
    ["a redirect not followed to an answer", serve("moved", "text/plain", 302), "http_302"],
    ["HTML", serve("<html>docket</html>", "text/html"), "not_json"],
    ["ok false", json({ ok: false, result: { entries: [] } }), "not_a_docket"],
    ["no result", json({ ok: true }), "not_a_docket"],
    ["a result with no entries list", json({ ok: true, result: { entries: {} } }), "not_a_docket"],
    ["a result that is a list", json({ ok: true, result: [] }), "not_a_docket"],
    ["JSON null", json(null), "not_a_docket"],
    ["a declared length past 8 MiB", () => new Response("{}", { headers: { "content-length": String(DOCKET_READ_MAX_BYTES + 1) } }), "too_large"],
    ["a stream past 8 MiB", () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } })), "too_large"],
    ["a reset", new Error("connection reset"), "fetch_failed"],
  ];
  for (const [what, route, reason] of cases) {
    const { w, ci, IMP, D } = await watching([null]);
    w.net.routes[D(1)] = route;
    const t = await w.m.cadenceTick(NOW_MS);
    assert.deepEqual(ci.reads, [{ import: IMP(1), docket: D(1), at: iso(NOW_MS), outcome: "unreadable", reason }], what);
    assert.deepEqual([t.watched.read, t.watched.unreadable], [[], [{ import: IMP(1), docket: D(1), reason }]], what);
  }
  /* the negative control at the bound: exactly 8 MiB is read */
  const { w, ci, D } = await watching([null]);
  w.net.routes[D(1)] = () => new Response(fill, { headers: { "content-type": "application/json" } });
  await w.m.cadenceTick(NOW_MS);
  assert.equal(ci.reads[0].outcome, "read");
});

test("R67 a governed refusal records nothing, counts as governed and leaves the watch due; it is never unreadable (R39)", async () => {
  const { w, ci, IMP, D, ans } = await watching([null], { refuse: ["publisher1.example.org"] });
  w.net.routes[D(1)] = json(ans(1));
  const t = await w.m.cadenceTick(NOW_MS);
  assert.deepEqual(t.watched, { due: 1, read: [], unreadable: [], governed: [{ import: IMP(1), docket: D(1), reason: "cooling_off", retry_in_ms: 5000 }], failed: [] });
  assert.deepEqual([ci.reads, w.net.seen], [[], []], "nothing recorded, nothing fetched");
  assert.equal(count(w, "observation_log"), 0);
  assert.equal(w.m.cadenceDue(NOW_MS + 1000), NOW_MS + 1000, "still due");
  /* the host admits again: it is read */
  w.gov.refuse.length = 0;
  const t2 = await w.m.cadenceTick(NOW_MS + 2 * HOUR);
  assert.deepEqual([t2.watched.read.length, ci.reads.map((r) => r.outcome)], [1, ["read"]]);
});

test("R67 a recordDocketRead that refuses or throws is failed with its reason, and the epoch stays open (R21): the retry skips the claimed watch until the epoch is spent", async () => {
  /* case-import's own refusal of a read of an import nobody watches */
  const { notWatched } = await watchedImports();
  for (const [how, set, reason] of [["refuses", (ci) => { ci.refuse = notWatched.refusal; }, "IMPORT_NOT_WATCHED"],
                                    ["throws", (ci) => { ci.fail = new Error("case-import broke"); }, "case-import broke"]]) {
    const { w, ci, IMP, D, ans } = await watching([null]);
    w.net.routes[D(1)] = json(ans(1));
    set(ci);
    const t1 = await w.m.cadenceTick(NOW_MS);
    assert.deepEqual(t1.watched.failed.map((x) => [x.import, x.reason]), [[IMP(1), reason]], how);
    assert.equal(t1.watched.read.length, 0);
    /* the epoch is open: within the hour the retry reuses it and skips the watch it claimed */
    const t2 = await w.m.cadenceTick(NOW_MS + 60000);
    assert.equal(t2.epoch, t1.epoch, how);
    assert.deepEqual(t2.watched, { due: 1, read: [], unreadable: [], governed: [], failed: [] }, `${how}: the claimed watch is neither read nor listed`);
    assert.equal(ci.reads.length, 1, `${how}: not read twice under one epoch`);
    /* past the cadence's hour the epoch is spent; case-import answering again, the read lands and the epoch closes */
    ci.refuse = null; ci.fail = null;
    const t3 = await w.m.cadenceTick(NOW_MS + HOUR + 1);
    assert.notEqual(t3.epoch, t1.epoch);
    assert.equal(t3.watched.read.length, 1);
    assert.notEqual((await w.m.cadenceTick(NOW_MS + HOUR + 2)).epoch, t3.epoch, "a clean tick closed its epoch");
  }
  /* the negative control: a read case-import records unreadable is no failure, and closes the epoch */
  const { w, D } = await watching([null]);
  w.net.routes[D(1)] = serve("nope", "text/plain", 503);
  const u = await w.m.cadenceTick(NOW_MS);
  assert.deepEqual([u.watched.unreadable.length, u.watched.failed.length], [1, 0]);
  assert.notEqual((await w.m.cadenceTick(NOW_MS + 1000)).epoch, u.epoch);
});

test("R67 each tick reads due watches after its batch's addresses and before its named requests, all within R19's 50, each read spending one; a watch is claimed as docket:<import>", async () => {
  const { w, IMP, D, ans } = await watching([null, null, null]);
  /* never read, so due together: read in import order */
  const [first, second] = [1, 2, 3].sort((a, b) => (IMP(a) < IMP(b) ? -1 : 1));
  for (let i = 0; i < MONITOR_CADENCE_BATCH - 2; i++)
    w.monitored(`INFO-2026-${7000 + i}-addr`, `https://addr.example.org/${i}`, `addr ${i}`, { freq: "daily" });
  const g = JSON.stringify({ requests: [{ id: "GATH-2026-1110-x", target: { text: "x" }, locators: ["https://records.example.org/g"],
                                          authority: "Town Clerk", criticality: "crucial", status: "open" }] });
  assert.equal(w.promote("INFO-2026-1110-gath", infoMd("INFO-2026-1110-gath", "https://records.example.org/h", { enabled: false }),
    { files: [{ path: "data/gathering.json", text: g, bytes: Buffer.byteLength(g), sha256: sha(g) }] }).ok, true);
  const order = [];
  /* the first address fails, so the epoch stays open and its claims can be read after the tick */
  w.m.monitor = async (q) => { order.push(["address", q.bundleId]);
    return order.length === 1 ? { status: 409, body: { ok: false, reason: staleBaseRefusal().reason } } : { status: 200, body: { ok: true, status: "unchanged" } }; };
  const refused = await acquireRefusals({ kind: "source_refused" });
  w.capture.acquire = async (body, opts) => { order.push(["request", opts.captureRequest.locator]); return refused; };
  for (const n of [1, 2, 3]) w.net.routes[D(n)] = () => { order.push(["docket", D(n)]); return json(ans(n))(); };
  const t = await w.m.cadenceTick(NOW_MS);
  assert.equal(order.length, MONITOR_CADENCE_BATCH, "the budget is 50 fetches");
  assert.ok(order.slice(0, MONITOR_CADENCE_BATCH - 2).every(([k]) => k === "address"), "addresses first");
  assert.deepEqual(order.slice(MONITOR_CADENCE_BATCH - 2), [["docket", D(first)], ["docket", D(second)]], "then dockets, oldest due first; no budget is left for the third or the request");
  assert.deepEqual([t.watched.due, t.watched.read.length, t.gathered.due, t.gathered.failed.length], [3, 2, 1, 0]);
  /* each claimed under the cadence epoch by its import */
  assert.deepEqual(w.rows(`SELECT subject FROM monitor_fired WHERE consumer='monitor-cadence' AND subject LIKE 'docket:%' ORDER BY subject`).map((r) => r.subject),
    [`docket:${IMP(first)}`, `docket:${IMP(second)}`].sort());
  /* with room, the request follows the dockets */
  const one = await watching([null]);
  const x = one.w;
  assert.equal(x.promote("INFO-2026-1111-gath", infoMd("INFO-2026-1111-gath", "https://records.example.org/h", { enabled: false }),
    { files: [{ path: "data/gathering.json", text: g, bytes: Buffer.byteLength(g), sha256: sha(g) }] }).ok, true);
  const seq = [];
  x.capture.acquire = async (body, opts) => { seq.push("request"); return refused; };
  x.net.routes[one.D(1)] = () => { seq.push("docket"); return json(one.ans(1))(); };
  await x.m.cadenceTick(NOW_MS);
  assert.deepEqual(seq, ["docket", "request"]);
});

test("R68 cadenceDue answers due while a watch is due; cadenceWake is now + 1 s while one is due, and otherwise takes the earliest instant a watch next falls due as one more candidate for next", async () => {
  const { w } = await watching([iso(NOW_MS - 2 * HOUR), iso(NOW_MS - 5 * HOUR)]);
  /* nothing monitored and no request: the watches alone */
  assert.equal(w.m.cadenceDue(NOW_MS), null);
  assert.equal(w.m.cadenceWake(NOW_MS), NOW_MS - 5 * HOUR + DAY, "the earliest a watch next falls due");
  assert.equal(w.m.cadenceDue(NOW_MS - 5 * HOUR + DAY), NOW_MS - 5 * HOUR + DAY, "due at that instant");
  assert.equal(w.m.cadenceWake(NOW_MS - 5 * HOUR + DAY), NOW_MS - 5 * HOUR + DAY + MONITOR_CADENCE_DELAY_MS);
  /* beside the plan's next: the earlier wins */
  const loc = "https://records.example.org/w.txt";
  w.monitored("INFO-2026-1120-w", loc, "w v1", { freq: "hourly" });
  w.st.sql.exec(`UPDATE bundle_projection SET monitor_last_checked=? WHERE bundle_id='INFO-2026-1120-w'`, iso(NOW_MS - 30 * 60000));
  assert.equal(w.m.cadenceWake(NOW_MS), NOW_MS + 30 * 60000, "the plan's next is earlier");
  w.st.sql.exec(`UPDATE bundle_projection SET monitor_last_checked=? WHERE bundle_id='INFO-2026-1120-w'`, iso(NOW_MS + DAY));
  assert.equal(w.m.cadenceWake(NOW_MS), NOW_MS - 5 * HOUR + DAY, "the watch's is earlier");
  /* a watch never read is due now */
  const { w: n } = await watching([null]);
  assert.deepEqual([n.m.cadenceDue(NOW_MS), n.m.cadenceWake(NOW_MS)], [NOW_MS, NOW_MS + MONITOR_CADENCE_DELAY_MS]);
  /* no watch, nothing monitored: no wake (the negative control) */
  const { w: none } = await watching([]);
  assert.deepEqual([none.m.cadenceDue(NOW_MS), none.m.cadenceWake(NOW_MS)], [null, null]);
});

test("R68 given the rank, a watch is offered as {kind: docket, id: its import, waitingSince: last_read.at + 24 h, or null when never read}, and the due watches are read in the rank's order; without it, or when it fails, oldest due first", async () => {
  const at = iso(NOW_MS - 3 * DAY);
  const { w, ci, IMP, D, ans } = await watching([null, at]);
  for (const n of [1, 2]) w.net.routes[D(n)] = json(ans(n));
  const seen = [];
  const rank = (items, now) => { seen.push({ items: JSON.parse(JSON.stringify(items)), now }); return [...items].reverse(); };
  await w.m.cadenceTick(NOW_MS, rank);
  const offered = seen.find((s) => s.items.some((i) => i.kind === "docket"));
  assert.deepEqual(offered.items, [1, 2].map((n) => ({ kind: "docket", id: IMP(n), waitingSince: n === 1 ? null : Date.parse(at) + DAY })), "oldest due first");
  assert.equal(offered.now, NOW_MS);
  assert.deepEqual(ci.reads.map((r) => r.import), [IMP(2), IMP(1)], "in the rank's order");
  for (const bad of [() => { throw new Error("no rank"); }, () => null]) {
    const v = await watching([null, at]);
    for (const n of [1, 2]) v.w.net.routes[v.D(n)] = json(v.ans(n));
    await v.w.m.cadenceTick(NOW_MS, bad);
    assert.deepEqual(v.ci.reads.map((r) => r.import), [v.IMP(1), v.IMP(2)], "oldest due first (never read, then read three days ago)");
  }
});

test("R30 while paused no docket is read and the tick says so; not due while paused, the pause looked at again one interval on while a watch is in force; resumed, the docket is read", async () => {
  const { w, ci, IMP, D, ans } = await watching([null]);
  w.net.routes[D(1)] = json(ans(1));
  assert.equal(w.m.pause({ paused: true, by: ADMIN }).ok, true);
  const t = await w.m.cadenceTick(NOW_MS);
  assert.deepEqual(t.paused, { paused: true, by: ADMIN, at: iso(NOW_MS) });
  assert.deepEqual(t.watched, { due: 1, read: [], unreadable: [], governed: [], failed: [] }, "what is due is stated");
  assert.deepEqual([ci.reads, w.net.seen], [[], []], "nothing read, nothing fetched");
  assert.equal(w.m.cadenceDue(NOW_MS), null);
  assert.equal(w.m.cadenceWake(NOW_MS), NOW_MS + MONITOR_TICK_MS);
  assert.equal((await watching([])).w.m.pause({ paused: true, by: ADMIN }).ok, true);
  assert.equal(w.m.pause({ paused: false, by: ADMIN }).ok, true);
  assert.equal((await w.m.cadenceTick(NOW_MS)).watched.read.length, 1, "resumed");
});

test("R36 a docket read fetches only the watch's docket address as case-import holds it, never an address a caller names; one that is not a public https locator is not fetched", async () => {
  const { w, ci, D, ans } = await watching([null]);
  w.net.routes[D(1)] = json(ans(1));
  w.net.routes["https://attacker.example.org/x"] = json(ans(1));
  await w.m.cadenceTick(NOW_MS, () => [{ kind: "docket", id: "https://attacker.example.org/x" }]);
  assert.deepEqual(w.net.seen, [D(1)]);
  assert.deepEqual(ci.reads.map((r) => r.docket), [D(1)]);
  for (const bad of ["http://publisher.example.org/?op=docketpublic", "https://127.0.0.1/?op=docketpublic", null]) {
    const v = await watching([null]);
    v.ci.docketAs = bad;
    const t = await v.w.m.cadenceTick(NOW_MS);
    assert.deepEqual(v.w.net.seen, [], String(bad));
    assert.deepEqual(v.ci.reads.map((r) => [r.outcome, r.reason]), [["unreadable", "fetch_failed"]]);
    assert.equal(t.watched.unreadable.length, 1);
  }
});

test("R2 (N538) the tick fetches as the Civicsmith agent, acquisition's civicsmithUserAgent; R30 the slate's fixed framing names a Civicsmith instance", async () => {
  const w = world();
  const loc = "https://records.example.org/ua.txt";
  w.monitored("INFO-2026-1130-ua", loc, "ua v1", { freq: "daily" });
  w.net.routes[loc] = serve("ua v1");
  await w.m.monitor({ bundleId: "INFO-2026-1130-ua", viewer: DAEMON });
  assert.equal(w.net.inits.at(-1).headers["user-agent"], civicsmithUserAgent("0.0.0", "unnamed", "monitor"));
  const e = world({ env: { VERSION: "9.9.9", INSTANCE_NAME: "home" } });
  e.monitored("INFO-2026-1131-ua", loc, "ua v1", { freq: "daily" });
  e.net.routes[loc] = serve("ua v1");
  await e.m.monitor({ bundleId: "INFO-2026-1131-ua", viewer: DAEMON });
  assert.match(e.net.inits.at(-1).headers["user-agent"], /^Civicsmith\/9\.9\.9 \(\+.*; instance home; monitor\)$/);
  assert.match(SLATE_FRAMING_OPEN, /^This is the due slate of a Civicsmith instance: /);
  assert.equal(SLATE_FRAMING_OPEN.includes("CivicOS"), false);
  assert.equal(w.m.slate({ viewer: DAEMON, now: NOW_MS }).prompt.split("\n")[0], SLATE_FRAMING_OPEN);
});

test("R67 R68 (settled readings 2 and 5): a governed read spends one of the 50 as any read does; a 200 docket answer is read even when case-import records it unreadable (not_this_case), its entry carrying case-import's recorded outcome", async () => {
  /* reading 2: 49 addresses, two watches, the first governed: it spends the 50th, so the second is not reached */
  const { w, ci, IMP, D, ans } = await watching([null, null]);
  const [g1, g2] = [1, 2].sort((a, b) => (IMP(a) < IMP(b) ? -1 : 1));   /* the first read in import order is the governed one */
  w.gov.refuse.push(`publisher${g1}.example.org`);
  for (let i = 0; i < MONITOR_CADENCE_BATCH - 1; i++)
    w.monitored(`INFO-2026-${7100 + i}-addr`, `https://addr.example.org/${i}`, `addr ${i}`, { freq: "daily" });
  w.m.monitor = async () => ({ status: 200, body: { ok: true, status: "unchanged" } });
  w.net.routes[D(g2)] = json(ans(g2));
  const t = await w.m.cadenceTick(NOW_MS);
  assert.deepEqual([t.watched.governed.map((x) => x.import), t.watched.read, ci.reads], [[IMP(g1)], [], []]);
  /* the negative control: with one more fetch of room, the second is read */
  const more = await watching([null, null]);
  const v = more.w;
  const inOrder = [1, 2].sort((a, b) => (more.IMP(a) < more.IMP(b) ? -1 : 1));
  v.gov.refuse.push(`publisher${inOrder[0]}.example.org`);
  for (let i = 0; i < MONITOR_CADENCE_BATCH - 2; i++)
    v.monitored(`INFO-2026-${7200 + i}-addr`, `https://addr.example.org/${i}`, `addr ${i}`, { freq: "daily" });
  v.m.monitor = async () => ({ status: 200, body: { ok: true, status: "unchanged" } });
  v.net.routes[more.D(inOrder[1])] = json(more.ans(inOrder[1]));
  assert.deepEqual((await v.m.cadenceTick(NOW_MS)).watched.read.map((x) => x.import), [more.IMP(inOrder[1])]);
  /* reading 5: case-import records another group's answer unreadable; the read stays a read, carrying that outcome */
  const other = await watching([null]);
  const { w: x, ci: c } = other;
  x.net.routes[other.D(1)] = json({ ok: true, result: { group: "another-group", case: other.ans(1).result.case, entries: [] } });
  const tx = await x.m.cadenceTick(NOW_MS);
  assert.deepEqual(c.reads.map((r) => r.outcome), ["read"], "monitoring's classification is read");
  assert.deepEqual([tx.watched.read, tx.watched.unreadable], [[{ import: other.IMP(1), docket: other.D(1), outcome: "unreadable", new_entries: 0, new_moves: 0, new_refused: 0 }], []]);
});
