/* acquisition, T50 (T50-7): R47 `acquire`'s `for`, R46 `openCaptures` with R19's opening member, R48 the cheap is-it-an-archive
   decision, and N1064's sampling tests (R29 the one raiser of C-68.1, R30 no place in outward text, R38 `MEMBER_MAX`), at
   the module's interface (`acquire(store, body, opts)`, `openCaptures(store, …)`, `archiveList`, `unpack`) over the store
   handed in (fixture.mjs). R41's `held_at` and `held_name` are archivelist.test.mjs's; R23's search of the store is
   acquire.test.mjs's. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { world, run, sha, HTML, page, text, network } from "./fixture.mjs";
import { makeZip } from "../../make-zip.mjs";
import { acquire, openCaptures, unpack, keyedFetch, ARCHIVE_CHECKS, ARCHIVE_CHECK_READS, OPEN_CAPTURES_MAX, FOR_MAX,
         evidenceStorageAbsent, INSTALLATION_CHECKS, ACQUISITION_CHECKS } from "../../../src/acquisition/index.mjs";
import { ARCHIVE_LIMITS } from "../../../src/ooxml.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";

const URL1 = "https://a.example/doc";
const Q = "QUESTION-2026-0007";
const stamp = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
/* the instance clock (K5132, K5205): a pinned instant is the store's `env.BIO_NOW_MS`, which the act reads for the sessions it saves and lists */
const pinClock = (store, ms) => { store.state.clockMs = ms; store.env.BIO_NOW_MS = String(ms); };

/* ======================================================================= *
 * R47: `for`
 * ======================================================================= */

test("R47: a member session's `acquire` with `for` calls recordCapturedFor once with that digest, question, member and instant, also when the capture is already held; the answer carries `for` beside `document` and the document gains no field", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-04T12:00:00.000Z") });
  const plain = await run(world(), { [URL1]: () => text("same bytes") }, { locator: URL1 });
  const w = world();
  const calls = [];
  const orig = w.store.recordCapturedFor.bind(w.store);
  w.store.recordCapturedFor = (a) => { calls.push(a); return orig(a); };
  const r = await run(w, { [URL1]: () => text("same bytes") }, { locator: URL1, for: Q });
  assert.equal(r.status, 200);
  assert.deepEqual(calls, [{ captureSha: sha("same bytes"), question: Q, by: "m1", at: r.body.document.retrieved }]);
  assert.deepEqual(r.body.for, { question: Q, recorded: true });
  assert.deepEqual(Object.keys(r.body.document), Object.keys(plain.body.document), "the document itself gains no field");
  assert.deepEqual(w.store.state.captured, [{ captureSha: sha("same bytes"), question: Q, by: "m1", at: r.body.document.retrieved }]);
  /* the same bytes again: found already held, and still recorded (once for the triple) */
  const again = await run(w, { [URL1]: () => text("same bytes") }, { locator: URL1, for: Q });
  assert.equal(again.body.existed, true);
  assert.equal(calls.length, 2, "asked again when the capture was found already held");
  assert.deepEqual(again.body.for, { question: Q, recorded: true });
  assert.equal(w.store.state.captured.length, 1, "one row for the (capture, question, member)");
  /* the ask reaches no fetch, receipt, header or address */
  const everything = JSON.stringify([r.net.seen, w.prov.receipts, r.body.document, w.store.state.outcomes, w.store.state.events]);
  assert.ok(!everything.includes(Q), "for reaches nothing but the store's record of it");
  /* a continuation records nothing (its primary was recorded when it was filed) */
  const s = world();
  s.store.recordCaptureLimit({ runtime: "subrequests", observed: 12 });
  const big = `<html><body>${Array.from({ length: 30 }, (_, i) => `<img src="/img/${i}.png">`).join("")}</body></html>`;
  const routes = (u) => (new URL(u).pathname === "/p.html" ? page(big) : /\/img\//.test(u) ? new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }) : null);
  let n = 0;
  const sCalls = [];
  s.store.recordCapturedFor = (a) => { sCalls.push(a); return { recorded: true }; };
  const first = await run(s, routes, { locator: "https://w.example/p.html", subresources: true, for: Q });
  const cont = await run(s, routes, { locator: "https://w.example/p.html", subresources: true, continue: first.body.snapshot.continuation.session, for: Q });
  assert.equal(cont.body.ok, true);
  assert.equal("for" in cont.body, false, "a continuation answers no `for`");
  assert.equal(sCalls.length, 1, "and records nothing: the first tick did");
  void n;
});

test("R47: `for` null, absent or from a caller that is not a member session answers as without it and makes no call; a daemon's `for` (even 5) is ignored", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-04T12:00:00.000Z") });
  /* R95: the one key `acquire` adds to any answer, its times, is set aside by name */
  const strip = (r) => { const { timings, ...bare } = r.body; return JSON.stringify(bare); };
  const base = strip(await run(world(), { [URL1]: () => text("d") }, { locator: URL1 }));
  for (const [what, body, o] of [["null", { locator: URL1, for: null }, {}], ["undefined", { locator: URL1, for: undefined }, {}],
                                 ["a daemon, valid", { locator: URL1, for: Q }, { cls: "daemon", member: false, sessMember: null, captureRequest: { locator: URL1 } }],
                                 ["a daemon, 5", { locator: URL1, for: 5 }, { cls: "daemon", member: false, sessMember: null, captureRequest: { locator: URL1 } }],
                                 ["not a member session, 5", { locator: URL1, for: 5 }, { cls: "admin", member: false, sessMember: "m1" }],
                                 ["a member flag with no member", { locator: URL1, for: 5 }, { cls: "member", member: true, sessMember: null }]]) {
    const w = world();
    const calls = [];
    w.store.recordCapturedFor = (a) => { calls.push(a); return { recorded: true }; };
    const r = await run(w, { [URL1]: () => text("d") }, body, o);
    assert.equal(r.status, 200, what);
    assert.equal("for" in r.body, false, `${what}: no \`for\` in the answer`);
    assert.equal(calls.length, 0, `${what}: no call`);
    if (!o.captureRequest) {
      const plainOwn = strip(await run(world(), { [URL1]: () => text("d") }, { locator: URL1 }, o));
      assert.equal(strip(r), plainOwn, `${what}: byte for byte as without it`);
    }
  }
  /* a daemon's answer is the same with and without the key (byte for byte) */
  const arm = { cls: "daemon", member: false, sessMember: null, captureRequest: { locator: URL1 } };
  assert.equal(strip(await run(world(), { [URL1]: () => text("d") }, { for: 5 }, arm)), strip(await run(world(), { [URL1]: () => text("d") }, {}, arm)));
  assert.ok(base.length > 0);
});

test("R47, R29 (C-139.21): a `for` that is not a non-blank string of at most 200 characters is refused BAD_FOR (400) with its row before any fetch, nothing written or filed; 1 and 200 characters pass (negative controls)", async () => {
  assert.equal(FOR_MAX, 200);
  const row = ARCHIVE_CHECKS.BAD_FOR;
  assert.equal(row.check, "C-139.21");
  assert.equal(row.translation, word("refusal.BAD_FOR"));
  assert.ok(hasWord("refusal.BAD_FOR"));
  for (const bad of [5, true, 0, "", "   ", "\n\t", "x".repeat(201), "x".repeat(5000), {}, ["Q"], { id: Q }]) {
    const w = world();
    const calls = [];
    w.store.recordCapturedFor = (a) => { calls.push(a); return { recorded: true }; };
    const r = await run(w, { [URL1]: () => text("d") }, { locator: URL1, for: bad });
    assert.deepEqual([r.status, r.body.ok, r.body.reason, r.body.code, r.body.check, r.body.translation, r.body.op],
                     [400, false, "BAD_FOR", "BAD_FOR", row.check, row.translation, "acquire"], JSON.stringify(bad)?.slice(0, 30));
    assert.deepEqual([r.net.seen.length, w.prov.receipts.length, w.b.calls.length, calls.length, w.store.state.outcomes.length, w.store.state.actors.length],
                     [0, 0, 0, 0, 0, 0], "nothing fetched, stored, filed or recorded");
    assert.equal("document" in r.body, false);
  }
  /* a refusal comes before the archive and render arms' own checks, and for a continuation too */
  const arch = await run(world(), {}, { via: "archive.org", address: URL1, for: 5 }, { cls: "member", member: true, sessMember: "m1" });
  assert.equal(arch.body.reason, "BAD_FOR");
  /* negative controls: the shortest and the longest accepted */
  for (const ok of ["Q", "x".repeat(200)]) {
    const w = world();
    const r = await run(w, { [URL1]: () => text("d") }, { locator: URL1, for: ok });
    assert.deepEqual([r.status, r.body.for], [200, { question: ok, recorded: true }]);
  }
});

test("R47: a failed or absent recordCapturedFor never fails the capture: it is filed, and the answer says the ask was not recorded", async () => {
  for (const [what, set] of [["throws", (w) => { w.store.state.recordFails = true; }], ["absent", (w) => { delete w.store.recordCapturedFor; }],
                             ["answers not recorded", (w) => { w.store.recordCapturedFor = () => ({ recorded: false }); }], ["answers nothing", (w) => { w.store.recordCapturedFor = () => undefined; }]]) {
    const w = world();
    set(w);
    const r = await run(w, { [URL1]: () => text("d") }, { locator: URL1, for: Q });
    assert.equal(r.status, 200, what);
    assert.equal(r.body.document.capture.sha256, sha("d"), `${what}: the capture is filed`);
    assert.deepEqual(r.body.for, { question: Q, recorded: false }, what);
    assert.equal(w.prov.receipts.length, 1, `${what}: its receipt is written`);
  }
});

/* ======================================================================= *
 * R19, R46: a session parked by a member session records that member; openCaptures lists them
 * ======================================================================= */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 1, 2, 3, 4]);
const imgPage = (n, pre = "n") => `<html><body>${Array.from({ length: n }, (_, i) => `<img src="/img/${pre}${i}.png">`).join("")}</body></html>`;
const siteOf = (host, html) => (u) => (/\.html$/.test(new URL(u).pathname) ? page(html) : /\/img\//.test(u) ? new Response(PNG, { headers: { "content-type": "image/png" } }) : null);
/* a walk that runs out of its subrequest ceiling: parked, supporting files outstanding */
async function park(w, o = {}, loc = "https://w.example/p.html", html = imgPage(30)) {
  w.store.recordCaptureLimit({ runtime: "subrequests", observed: 12 });
  return run(w, siteOf("w.example", html), { locator: loc, subresources: true }, o);
}
const DAEMON = { cls: "daemon", member: false, sessMember: null };

test("R46 R19: a member session's walk that parks a session lists it for that member with `outstanding` equal to the files left, and for no other member; a complete walk lists nothing; after expiry it is not listed", async () => {
  const w = world();
  pinClock(w.store, Date.parse("2026-05-06T07:08:09Z"));
  const r = await park(w);
  const session = r.body.snapshot.continuation.session;
  assert.ok(session && r.body.snapshot.outstanding > 0);
  const saved = w.store.state.sessionSaves[0];
  assert.equal(saved.state.opened_by, "m1", "R19: the member is recorded with the session");
  const now = "2026-05-06T07:10:00Z";
  const mine = openCaptures(w.store, { by: "m1", now });
  assert.equal(mine.ok, true);
  assert.equal(mine.truncated, false);
  assert.deepEqual(mine.captures, [{ session, locator: "https://w.example/p.html", primary_sha: sha(imgPage(30)), started: "2026-05-06T07:08:09Z",
                                      updated: "2026-05-06T07:08:09Z", expires: "2026-05-06T08:08:09Z", outstanding: r.body.snapshot.outstanding }]);
  assert.equal(mine.captures[0].outstanding, saved.state.queue.length, "the files left");
  assert.deepEqual(openCaptures(w.store, { by: "m2", now }).captures, [], "no other member sees it");
  /* R110 (fix round 8, G103): this line asserted that the door's form `member:m1` lists nothing for a session stored under `m1`, which was the defect: one member, two spellings */
  assert.deepEqual(openCaptures(w.store, { by: "member:m1", now }).captures, mine.captures, "the door's form names the same member as her bare id");
  assert.deepEqual(openCaptures(w.store, { by: "member:m2", now }).captures, [], "another member's form lists nothing of hers");
  /* it lists nothing of another member's and writes nothing */
  const before = JSON.stringify([...w.store.state.sessions]);
  openCaptures(w.store, { by: "m1", now });
  assert.equal(JSON.stringify([...w.store.state.sessions]), before);
  /* the default instant is this instance's clock (R124, K5215): pinned at 07:08:09Z above, so the session is live there, whatever the wall clock says */
  assert.equal(openCaptures(w.store, { by: "m1" }).captures.length, 1, "the default instant reads the pinned instance clock, so the session is live");
  assert.equal(openCaptures(w.store, { by: "m1", now: "2026-05-06T08:08:08Z" }).captures.length, 1, "listed to the second before it expires");
  assert.deepEqual(openCaptures(w.store, { by: "m1", now: "2026-05-06T08:08:09Z" }).captures, [], "after expiry it is not listed");
  assert.deepEqual(openCaptures(w.store, { by: "m1", now: Date.parse("2026-05-06T08:30:00Z") }).captures, [], "an instant in milliseconds reads as one");
  /* a complete walk lists nothing */
  const done = world();
  pinClock(done.store, Date.parse("2026-05-06T07:08:09Z"));
  const c = await run(done, siteOf("w.example", imgPage(2)), { locator: "https://w.example/p.html", subresources: true });
  assert.equal(c.body.snapshot.complete, true);
  assert.deepEqual(openCaptures(done.store, { by: "m1", now }).captures, []);
});

test("R46: a continuation keeps the member who began the session, whoever continues it, and a finished one is no longer listed; Finish it (acquire with continue) still resumes a listed session", async () => {
  const w = world();
  pinClock(w.store, Date.parse("2026-05-06T07:08:09Z"));
  const loc = "https://w.example/p.html";
  const first = await park(w);
  const session = first.body.snapshot.continuation.session;
  const now = "2026-05-06T07:20:00Z";
  const left = openCaptures(w.store, { by: "m1", now }).captures[0].outstanding;
  /* another member continues it: it stays the first member's */
  const cont = await run(w, siteOf("w.example", imgPage(30)), { locator: loc, subresources: true, continue: session }, { cls: "member", member: true, sessMember: "m2" });
  assert.equal(cont.body.ok, true);
  assert.ok(cont.body.continued, "resumed, not refused");
  const afterTick = openCaptures(w.store, { by: "m1", now }).captures;
  assert.equal(afterTick.length, 1);
  assert.ok(afterTick[0].outstanding < left, "the tick fetched some of what was left");
  assert.deepEqual(openCaptures(w.store, { by: "m2", now }).captures, [], "the one who continued it did not begin it");
  assert.equal(w.store.state.sessions.get(session).state.opened_by, "m1");
  /* run it to its end: dropped, listed for no one */
  let guard = 0, res = cont;
  while (res.body.ok && (res.body.snapshot.continuation || {}).session && guard++ < 20)
    res = await run(w, siteOf("w.example", imgPage(30)), { locator: loc, subresources: true, continue: session });
  assert.equal(res.body.snapshot.complete, true);
  assert.deepEqual(openCaptures(w.store, { by: "m1", now }).captures, []);
});

test("R46 R19 (controls): a session parked by the daemon, by another caller or before R19 records no member and is listed for no one; a session whose state cannot be read is not listed; a `by` that is absent, not a string, blank or a machine identity lists nothing", async () => {
  const now = "2026-05-06T07:10:00Z";
  const w = world();
  pinClock(w.store, Date.parse("2026-05-06T07:08:09Z"));
  /* parked by a capture-request arm run (a daemon), and by an admin session that is not a member session */
  const d = await park(w, { ...DAEMON, captureRequest: { locator: "https://w.example/p.html" } });
  assert.ok(d.body.snapshot.continuation, "parked");
  const a = await park(w, { cls: "admin", member: false, sessMember: "m1" }, "https://w.example/q.html");
  assert.equal(a.status, 200);
  for (const s of w.store.state.sessions.values()) assert.equal("opened_by" in s.state, false, "no member recorded for a caller that is no member session");
  for (const by of ["m1", "daemon", "class:admin", "admin", "bio-monitor"]) assert.deepEqual(openCaptures(w.store, { by, now }).captures, [], by);
  /* a session saved before R19 (no member in its state), and one whose state is unreadable */
  w.store.saveCaptureSession({ session: "cs_old", locator: "https://w.example/old", primarySha: "a".repeat(64), primaryFile: "snapshots/old", base: "https://w.example/old", state: { queue: [{}] } });
  w.store.saveCaptureSession({ session: "cs_bad", locator: "https://w.example/bad", primarySha: "b".repeat(64), primaryFile: "snapshots/bad", base: "https://w.example/bad", state: "not an object" });
  w.store.saveCaptureSession({ session: "cs_noq", locator: "https://w.example/noq", primarySha: "c".repeat(64), primaryFile: "snapshots/noq", base: "https://w.example/noq", state: { opened_by: "m1" } });
  assert.deepEqual(openCaptures(w.store, { by: "m1", now }).captures, [], "no member, unreadable state, nothing outstanding: none is listed");
  /* negative control: a member's own session beside them is listed alone */
  const m = await park(w, {}, "https://w.example/mine.html", imgPage(30, "m"));
  const mine = openCaptures(w.store, { by: "m1", now }).captures;
  assert.deepEqual(mine.map((x) => x.locator), ["https://w.example/mine.html"]);
  void m;
  /* a blank, absent, non-string or machine `by` answers an empty list */
  for (const by of [undefined, null, "", "   ", 5, {}, ["m1"], "class:admin", "daemon"])
    assert.deepEqual(openCaptures(w.store, { by, now }), { ok: true, captures: [], truncated: false }, JSON.stringify(by));
  assert.deepEqual(openCaptures(w.store), { ok: true, captures: [], truncated: false });
  /* a store that cannot answer, or throws, gives an empty list and never throws */
  for (const bad of [null, undefined, {}, { liveCaptureSessions: () => { throw new Error("down"); } }, { liveCaptureSessions: () => "no" }, { liveCaptureSessions: () => [null, 5, {}] }])
    assert.deepEqual(openCaptures(bad, { by: "m1", now }), { ok: true, captures: [], truncated: false });
});

test("R46: newest started first, at most OPEN_CAPTURES_MAX with `truncated`", async () => {
  assert.equal(OPEN_CAPTURES_MAX, 50);
  const w = world();
  const base = Date.parse("2026-05-06T00:00:00Z");
  for (let i = 0; i < 52; i++) {
    pinClock(w.store, base + i * 60000);
    w.store.saveCaptureSession({ session: `cs_${String(i).padStart(2, "0")}`, locator: `https://w.example/${i}`, primarySha: sha(`p${i}`), primaryFile: `snapshots/p${i}`, base: `https://w.example/${i}`,
                                 state: { queue: Array.from({ length: i + 1 }, () => ({})), opened_by: i % 13 === 0 ? "m2" : "m1" }, ttlMs: 24 * 3600000 });
  }
  const now = "2026-05-06T02:00:00Z";
  const got = openCaptures(w.store, { by: "m1", now });
  const mineN = Array.from({ length: 52 }, (_, i) => i).filter((i) => i % 13 !== 0).length;
  assert.equal(mineN, 48);
  assert.deepEqual([got.captures.length, got.truncated], [48, false], "48 are m1's, within the bound");
  assert.deepEqual(got.captures.map((c) => c.session), got.captures.map((c) => c.session).slice().sort().reverse(), "newest started first");
  assert.equal(got.captures[0].session, "cs_51");
  assert.equal(got.captures[0].outstanding, 52);
  /* over the bound */
  for (let i = 52; i < 60; i++) {
    pinClock(w.store, base + i * 60000);
    w.store.saveCaptureSession({ session: `cs_${i}`, locator: `https://w.example/${i}`, primarySha: sha(`p${i}`), primaryFile: `snapshots/p${i}`, base: `https://w.example/${i}`,
                                 state: { queue: [{}], opened_by: "m1" }, ttlMs: 24 * 3600000 });
  }
  const over = openCaptures(w.store, { by: "m1", now: "2026-05-06T03:00:00Z" });
  assert.deepEqual([over.captures.length, over.truncated], [50, true]);
  assert.equal(over.captures[0].session, "cs_59");
  assert.equal(over.captures.some((c) => c.session === "cs_01"), false, "the oldest fall off the end");
});

/* ======================================================================= *
 * R48: the cheap is-it-an-archive decision
 * ======================================================================= */

const docx = (pad = "") => makeZip([{ name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
                                    { name: "word/document.xml", data: `<w:document>${pad}</w:document>`, method: pad ? 0 : 8 }]);
const ADMIN = "class:admin";
const reads = (w) => w.b.calls.filter((c) => c[0] === "head" || c[0] === "get").length;
const hold = async (w, bytes, url = "https://f.example/x") => {
  await w.b.put(`bio/captures/${sha(bytes)}`, bytes);
  w.prov.recordReceipt({ address: url, addressNorm: url, captureSha: sha(bytes), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
};

test("R48: a held capture never opened is decided (ARCHIVE_NOT_HELD, then NOT_AN_ARCHIVE by R17's rule, before any listing) in at most ARCHIVE_CHECK_READS reads of the evidence store: a plain file, an office file and a ZIP archive; the answers are what they were", async () => {
  assert.equal(ARCHIVE_CHECK_READS, 2);
  const cases = [["a plain file", new TextEncoder().encode("just words, no archive"), "NOT_AN_ARCHIVE"], ["an office file", docx(), "NOT_AN_ARCHIVE"],
                 ["a ZIP archive", makeZip([{ name: "a", data: "a" }, { name: "b", data: "b" }]), null]];
  for (const [what, bytes, refusal] of cases) {
    const w = world();
    await hold(w, bytes);
    w.b.calls.length = 0;
    const r = await w.acq.archiveList({ archiveSha: sha(bytes), viewer: ADMIN });
    const n = reads(w);
    assert.ok(n <= ARCHIVE_CHECK_READS, `${what}: ${n} reads (the bound is ${ARCHIVE_CHECK_READS}; it was 4 for a plain or an office file, 5 for an archive)`);
    assert.equal(n, 2, `${what}: a head and one read of the bytes`);
    if (refusal) {
      assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, refusal, refusal, ARCHIVE_CHECKS[refusal].check, ARCHIVE_CHECKS[refusal].translation], what);
      assert.equal("entries" in r, false, `${what}: no listing is answered`);
    } else {
      /* control: a ZIP archive's listing is unchanged */
      assert.deepEqual([r.ok, r.archive.opened, r.archive.refused, r.archive.entries, r.archive.bytes], [true, false, null, 2, bytes.length]);
      assert.deepEqual(r.entries.map((e) => [e.index, e.name, e.state]), [[0, "a", "waiting"], [1, "b", "waiting"]]);
      assert.deepEqual(r.summary, { filed: 0, already_held: 0, not_filed: 0, folders: 0, links: 0, waiting: 2 });
    }
  }
});

test("R48: the same decision on a capture held in parts reads each part once (one head of the whole key, then a head and, for a store with no stored checksum, a read of each part): at most 1 + 2 a part, never a part twice; its answer is what it was. A capture within MULTIPART_KEEP_MAX is held whole too (C5) and costs what a whole one costs", async () => {
  /* varied bytes, so the parts are distinct objects (identical parts share one digest and one object) */
  const big = Buffer.from(Array.from({ length: 33 * 1024 }, (_, i) => String.fromCharCode(33 + (i * 7919) % 90).repeat(1024)).join(""));
  const cases = [["a ZIP archive in parts", makeZip([{ name: "big", data: big, method: 0 }, { name: "b", data: "b" }]), true],
                 ["an office file in parts", docx(big), false]];
  for (const [what, bytes, isZip] of cases) {
    const w = world();
    w.b.checksums = false;   // a store that gives no stored checksum: each part is read to be verified
    const url = "https://f.example/big";
    const c = await run(w, { [url]: () => new Response(bytes, { headers: { "content-type": "application/octet-stream" } }) }, { locator: url });
    const n = c.body.document.parts.length;
    assert.ok(n > 4, `${what}: held in ${n} parts, past the bound the whole is kept to`);
    assert.equal(w.held(sha(bytes)), false, `${what}: past MULTIPART_KEEP_MAX only the parts are held`);
    w.rows("INSERT INTO bundles (bundle_id, object_type, group_id, current_state, created, last_updated, bundle_sha) VALUES ('INFO-BIG','information','g','collected','T','T','x')");
    w.prov.homes[sha(bytes)] = "INFO-BIG";
    w.prov.named[sha(bytes)] = c.body.document.parts.map((x) => ({ sha256: x.sha256, bytes: x.bytes }));
    w.rows("DELETE FROM archive_entries");   // an archive acquire opened is read as never opened
    w.b.calls.length = 0;
    const r = await w.acq.archiveList({ archiveSha: sha(bytes), viewer: ADMIN });
    assert.ok(reads(w) <= 1 + 2 * n, `${what}: held to R48's bound for a capture in parts, one head of the whole key and at most two reads per part (${reads(w)} of ${1 + 2 * n})`);
    const perKey = {};
    for (const x of w.b.calls) perKey[`${x[0]} ${x[1]}`] = (perKey[`${x[0]} ${x[1]}`] || 0) + 1;
    assert.ok(Object.values(perKey).every((k) => k === 1), `${what}: no object is read twice`);
    if (isZip) assert.deepEqual([r.ok, r.archive.opened, r.archive.refused, r.archive.entries], [true, false, null, 2], what);
    else assert.deepEqual([r.ok, r.reason], [false, "NOT_AN_ARCHIVE"], what);
  }
  /* within the bound the capture is held whole as well (C5), and its decision costs what a whole one costs: a head, and a read of the bytes */
  const small = "x".repeat(9 * 1024 * 1024);
  for (const [what, bytes, isZip] of [["a ZIP archive kept whole", makeZip([{ name: "big", data: small, method: 0 }, { name: "b", data: "b" }]), true],
                                      ["an office file kept whole", docx(small), false]]) {
    const w = world();
    const url = "https://f.example/mid";
    const c = await run(w, { [url]: () => new Response(bytes, { headers: { "content-type": "application/octet-stream" } }) }, { locator: url });
    assert.equal(c.body.document.parts.length, 2, `${what}: arrived in two parts`);
    assert.equal(w.held(sha(bytes)), true, `${what}: and is held whole`);
    w.rows("DELETE FROM archive_entries");
    w.b.calls.length = 0;
    const r = await w.acq.archiveList({ archiveSha: sha(bytes), viewer: ADMIN });
    /* R101 (G130c): a capture past the bytes read back is judged from range reads of its head and its tail (the head, the end record, the central directory),
       which the one-KiB look at the head and the listing's own read come to in addition to the key's head: six at most, none of them a part read whole */
    assert.ok(reads(w) <= 6, `${what}: ${reads(w)} reads`);
    if (isZip) assert.deepEqual([r.ok, r.archive.refused, r.archive.entries], [true, null, 2], what);
    else assert.deepEqual([r.ok, r.reason], [false, "NOT_AN_ARCHIVE"], what);
  }
});

test("R48 (controls): a capture already opened costs no read; a file whose bytes are not held is still ARCHIVE_NOT_HELD, and a part missing from a capture in parts too; unpack's answer is the same", async () => {
  const z = makeZip([{ name: "a", data: "a" }]);
  const w = world();
  const url = "https://f.example/set.zip";
  await run(w, { [url]: () => new Response(z, { headers: { "content-type": "application/zip" } }) }, { locator: url });
  w.b.calls.length = 0;
  const opened = await w.acq.archiveList({ archiveSha: sha(z), viewer: ADMIN });
  assert.deepEqual([opened.ok, opened.archive.opened, reads(w)], [true, true, 0], "an opened archive is answered from its record");
  /* a receipt, but no bytes */
  const nb = world();
  nb.prov.recordReceipt({ address: url, addressNorm: url, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
  const r = await nb.acq.archiveList({ archiveSha: sha(z), viewer: ADMIN });
  assert.deepEqual([r.ok, r.reason, r.check], [false, "ARCHIVE_NOT_HELD", ARCHIVE_CHECKS.ARCHIVE_NOT_HELD.check]);
  assert.ok(reads(nb) <= ARCHIVE_CHECK_READS, "a missing object is decided by a head");
  /* a stored object that disagrees with its digest is not held either */
  const bad = world();
  bad.prov.recordReceipt({ address: url, addressNorm: url, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
  await bad.b.put(`bio/captures/${sha(z)}`, makeZip([{ name: "a", data: "b" }]));
  assert.equal((await bad.acq.archiveList({ archiveSha: sha(z), viewer: ADMIN })).reason, "ARCHIVE_NOT_HELD");
  assert.ok(reads(bad) <= ARCHIVE_CHECK_READS);
  /* unpack on a held archive: filed as before, and the objects it reads are read through once */
  const u = world();
  await hold(u, z);
  const un = await unpack(u.store, { archiveSha: sha(z), by: "m1", cls: "member" });
  assert.deepEqual([un.ok, un.documents.length, un.complete], [true, 1, true]);
});

/* ======================================================================= *
 * N1064's sampling tests
 * ======================================================================= */

test("R29 (C-68.1, K850; T50, N1064): every path that answers EVIDENCE_STORAGE_NOT_CONFIGURED, with no evidence storage, answers byte for byte what evidenceStorageAbsent(op, error, {code}) answers for that op, and the row's where names the raiser; a path that holds nothing in the evidence store never answers it", async () => {
  const error = word("capture.response.group_civicsmith_evidence");
  const C = INSTALLATION_CHECKS.EVIDENCE_STORAGE_NOT_CONFIGURED;
  assert.equal(C.where, "src/acquisition/index.mjs evidenceStorageAbsent > is-storage-absent", "the row names its one raiser");
  /* acquire, on every arm: its body has no `code` */
  for (const [body, o] of [[{ locator: URL1 }, {}], [{ via: "archive.org", address: URL1 }, { cls: "admin", member: false }], [{ locator: URL1, render: true }, {}],
                           [{}, { cls: "daemon", member: false, captureRequest: { locator: URL1 } }]]) {
    const w = world({ evidence: false });
    const r = await run(w, {}, body, o);
    const { timings, ...bare } = r.body;   /* R95: the times are the one key `acquire` adds, set aside by name */
    assert.equal(JSON.stringify({ status: r.status, body: bare }), JSON.stringify(evidenceStorageAbsent("acquire", error, { code: false })), JSON.stringify(body));
  }
  /* unpack: the door's body for op `unpack`, with the code */
  const w = world({ evidence: false });
  const u = await unpack(w.store, { archiveSha: "a".repeat(64), by: "m1", cls: "member" });
  assert.equal(JSON.stringify(u), JSON.stringify(evidenceStorageAbsent("unpack", error).body));
  assert.equal(u.reason, "EVIDENCE_STORAGE_NOT_CONFIGURED");
  /* archiveList reads the record first and answers an archive it cannot read as one not held (R41) */
  const l = await w.acq.archiveList({ archiveSha: "a".repeat(64), viewer: ADMIN });
  assert.equal(l.reason, "ARCHIVE_NOT_HELD");
  /* keyedFetch holds nothing in the evidence store: with none bound it answers its own refusals, never this code */
  const k = await keyedFetch(w.store, { service: "courtlistener", request: { url: "https://www.courtlistener.com/api/rest/v4/citation-lookup/", method: "POST", form: { text: "x" } } });
  assert.notEqual(k.reason, "EVIDENCE_STORAGE_NOT_CONFIGURED");
  assert.equal(k.reason, "KEYED_SERVICE_OFF");
  /* negative control: with storage the same acts answer neither */
  const ok = world();
  assert.equal((await run(ok, { [URL1]: () => text("d") }, { locator: URL1 })).body.ok, true);
  assert.notEqual((await unpack(ok.store, { archiveSha: "a".repeat(64), by: "m1", cls: "member" })).reason, "EVIDENCE_STORAGE_NOT_CONFIGURED");
});

test("R30 (T50, N1064): no place name any jurisdiction profile states (read from jurisdictions, whichever profiles it holds) is in any answer this module composes or in any row's translation, under each profile and under none", async () => {
  /* every place the held profiles state: what each covers, and the stems of those (a city or county name without its "City of" or "County") */
  const places = new Set();
  const generic = /^(?:city|town|county|village|state)\s+of\s+|\s+county$|\s*\(test\)$/gi;
  for (const l of jurisdictions.list()) {
    const p = jurisdictions.get(l.id);
    for (const c of [...l.covers, ...((p.local_names || []).filter((n) => n.kind === "place").map((n) => n.name))]) {
      places.add(c.toLowerCase());
      const stem = c.replace(generic, "").trim().toLowerCase();
      if (stem) places.add(stem);
    }
  }
  assert.ok([...places].some((x) => x.includes("oakland")) && [...places].some((x) => x.includes("ellery")), `read from the profiles: ${[...places].join(" | ")}`);
  for (const [code, row] of Object.entries(ACQUISITION_CHECKS))
    for (const pl of places) assert.ok(!row.translation.toLowerCase().includes(pl), `${code}'s translation names ${pl}`);
  const routes = { [URL1]: () => page(HTML("<p>Council minutes</p>")), "https://a.example/x": () => text("x") };
  for (const active of [null, ...jurisdictions.list().map((l) => l.id)]) {
    const w = world();
    if (active) w.core.setSetting("jurisdiction_profiles", [active], "member:admin");
    const answers = [];
    for (const [body, o] of [[{ locator: URL1 }, {}], [{ locator: "https://a.example/x" }, {}], [{ locator: URL1, for: 5 }, {}], [{ locator: URL1, render: "x" }, {}],
                             [{ via: "capture-request" }, {}], [{ locator: "https://drive.google.com/drive/folders/1AbCdEfGhIjK" }, {}], [{ locator: "https://127.0.0.1/x" }, {}]])
      answers.push((await run(w, routes, body, o)).body);
    const z = makeZip([{ name: "a", data: "a" }]);
    await hold(w, z, "https://a.example/z.zip");
    answers.push(await w.acq.archiveList({ archiveSha: sha(z), viewer: ADMIN }), await w.acq.archiveList({ archiveSha: "b".repeat(64), viewer: ADMIN }),
                 await unpack(w.store, { archiveSha: sha(z), by: "m1", cls: "member" }), await unpack(w.store, { archiveSha: sha(z), by: "m1", cls: "member" }));
    answers.push(await w.acq.archiveList({ archiveSha: sha("plain"), viewer: ADMIN }));
    /* the profile's own identifier is data the view names (`jurisdiction_view`), not composed text */
    const text0 = JSON.stringify(answers, (k, v) => (k === "jurisdiction_view" ? undefined : v)).toLowerCase();
    for (const pl of places) assert.ok(!text0.includes(pl), `${active ?? "no profile"}: an answer names ${pl}`);
    assert.ok(answers[0].ok === true, "the capture itself is filed");
  }
});

test("R38 (T50, N1064): MEMBER_MAX equals ARCHIVE_TOTAL_MAX, so a member declared over it puts the archive over the total and the whole archive is refused ARCHIVE_TOTAL_MAX with its limit for every entry; C-139.9's row is proved by its code in the table", async () => {
  /* a change to either figure fails here and asks for a fixture over MEMBER_MAX */
  assert.equal(ARCHIVE_LIMITS.MEMBER_MAX, ARCHIVE_LIMITS.ARCHIVE_TOTAL_MAX, "MEMBER_MAX and ARCHIVE_TOTAL_MAX are one figure: the member's own verdict is not reachable through unpack");
  const over = ARCHIVE_LIMITS.MEMBER_MAX + 1;
  const z = makeZip([{ name: "huge.bin", data: "h", method: 0, local: { uncompressedSize: over }, central: { uncompressedSize: over } }, { name: "small.txt", data: "s" }]);
  const w = world();
  await hold(w, z, "https://a.example/z.zip");
  const u = await unpack(w.store, { archiveSha: sha(z), by: "m1", cls: "member" });
  assert.deepEqual([u.ok, u.reason, u.code, u.limit, u.check], [false, "ARCHIVE_TOTAL_MAX", "ARCHIVE_TOTAL_MAX", ARCHIVE_LIMITS.ARCHIVE_TOTAL_MAX, ARCHIVE_CHECKS.ARCHIVE_TOTAL_MAX.check]);
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM archive_entries")[0].n, 0, "nothing is cut or recorded");
  const l = await w.acq.archiveList({ archiveSha: sha(z), viewer: ADMIN });
  assert.equal(l.archive.refused.code, "ARCHIVE_TOTAL_MAX");
  assert.deepEqual(l.entries.map((e) => [e.state, e.code, e.limit]), [["not_filed", "ARCHIVE_TOTAL_MAX", ARCHIVE_LIMITS.ARCHIVE_TOTAL_MAX], ["not_filed", "ARCHIVE_TOTAL_MAX", ARCHIVE_LIMITS.ARCHIVE_TOTAL_MAX]],
                   "for every entry the listing read");
  /* C-139.9 is proved by its code in the table */
  assert.equal(ARCHIVE_CHECKS.MEMBER_MAX.check, "C-139.9");
  assert.equal(ARCHIVE_CHECKS.MEMBER_MAX.translation, word("refusal.MEMBER_MAX"));
  /* negative control: just under the total, one member is not refused whole */
  const under = makeZip([{ name: "big.bin", data: "h", method: 0, local: { uncompressedSize: ARCHIVE_LIMITS.MEMBER_MAX }, central: { uncompressedSize: ARCHIVE_LIMITS.MEMBER_MAX } }]);
  const w2 = world();
  await hold(w2, under, "https://a.example/y.zip");
  const u2 = await unpack(w2.store, { archiveSha: sha(under), by: "m1", cls: "member" });
  assert.notEqual(u2.reason, "ARCHIVE_TOTAL_MAX");
});

/* R48 (fix round 4, P10 c; K4445): the opening bytes decide before anything profiles the whole */
test("R48 (P10 c): a 4 MB held capture that does not begin with the ZIP magic answers NOT_AN_ARCHIVE from its opening bytes, with no digest of its whole bytes and at most ARCHIVE_CHECK_READS reads; control: a real ZIP is still profiled and listed", async () => {
  const orig = crypto.subtle.digest.bind(crypto.subtle);
  let whole = 0;
  crypto.subtle.digest = (a, d) => { if ((d.byteLength ?? d.length) > 1e6) whole++; return orig(a, d); };
  try {
    const w = world();
    const text4 = new TextEncoder().encode("hello world ".repeat(355000));
    await w.b.put(`bio/captures/${sha(text4)}`, text4, { sha256: sha(text4) });   // as R2 holds it: with its checksum, so provenance R7 hashes nothing
    w.prov.recordReceipt({ address: "https://f.example/x", addressNorm: "https://f.example/x", captureSha: sha(text4), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
    w.b.calls.length = 0; whole = 0;
    const r = await w.acq.archiveList({ archiveSha: sha(text4), viewer: ADMIN });
    assert.deepEqual([r.ok, r.reason, r.code], [false, "NOT_AN_ARCHIVE", "NOT_AN_ARCHIVE"]);
    assert.equal(whole, 0, "the whole bytes were not hashed or profiled");
    assert.ok(reads(w) <= ARCHIVE_CHECK_READS);
    /* R88: the bucket was asked for the opening bytes alone, never the whole object */
    const gets = w.b.calls.filter((c) => c[0] === "get");
    assert.ok(gets.length >= 1 && gets.every((c) => c[2] && c[2].range && c[2].range.offset === 0 && c[2].range.length === 1024), "every get is the first 1024 bytes");
    const zip = makeZip([{ name: "a", data: "a" }, { name: "b", data: "b" }]);
    const z = world();
    await hold(z, zip);
    const lr = await z.acq.archiveList({ archiveSha: sha(zip), viewer: ADMIN });
    assert.deepEqual([lr.ok, lr.archive.entries], [true, 2]);
  } finally { crypto.subtle.digest = orig; }
});
