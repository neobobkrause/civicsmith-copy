/* capture-requests at T47: R56 (T47-21; N969, K2996, K3027 doubt 6), a member's own request, "Ask for this later":
   `captureRequest` with no run under a member's session stamp. Every test drives the module at its interface (the door,
   the drain, the reads, the retry, the registrations, `migrate`), each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, storage, sha } from "./fixture.mjs";
import { captureRequestAttribution, captureRequestsOps, CAPTURE_REQUEST_CHECKS, MEMBER_REQUEST_WAITS,
         MEMBER_REQUEST_DRAINS, CAPTURE_REQUEST_ADDRESS_MAX } from "../../../src/capture-requests/index.mjs";
import { migrateCaptureRequests, CAPTURE_REQUESTS_NULLABLE } from "../../../src/capture-requests/schema.mjs";

const ANN = "member:ann";
const count = (w) => w.row(`SELECT count(*) AS n FROM capture_requests`).n;
/** A member's own request: no run, ann's session stamp as caller and viewer unless a test says otherwise. */
const mine = (w, over = {}, stamps = {}) =>
  w.cr.captureRequest({ address: "https://later.example.org/a", ...over }, { viewer: V("ann"), caller: ANN, ...stamps });

test("R56 a signed-in member's request with no run (absent, null or empty) is filed: run null, her stamp the plane principal, principal_claude null, purpose acquire by default, answered as R6 with drains true; a machine, AI or absent stamp is refused R1's CAPTURE_REQUEST_NO_RUN as before", () => {
  const w = world().scene();
  const a = mine(w);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.deepEqual([a.requested, a.already, a.state, a.run, a.target, a.purpose, a.ua_mode, a.drains, a.detail],
                   [true, false, "requested", null, null, "acquire", "civicsmith", true, MEMBER_REQUEST_DRAINS]);
  assert.deepEqual(a.principals, { plane: ANN, claude: null });
  const r = w.req(a.request);
  assert.deepEqual([r.run, r.target, r.principal_plane, r.principal_claude, r.purpose, r.attempts],
                   [null, null, ANN, null, "acquire", 0]);
  /* a run given as null or blank is the same path; a purpose sent is kept as sent (judged at the drain, R8) */
  assert.equal(mine(w, { run: null, address: "https://later.example.org/n" }).run, null);
  const b = mine(w, { run: "  ", address: "https://later.example.org/b", purpose: "investigate" });
  assert.deepEqual([b.ok, b.purpose], [true, "investigate"]);
  /* Controls: an AI credential a member minted, a machine class, an absent or blank stamp: R1, nothing written */
  const before = count(w);
  for (const caller of ["member:ann/tok1", MACHINE, "class:daemon", null, "", "  ", "nobody", "member:"]) {
    const x = mine(w, { address: "https://later.example.org/c" }, { caller });
    assert.deepEqual([x.ok, x.code, x.check], [false, "CAPTURE_REQUEST_NO_RUN", "C-28.1"], String(caller));
  }
  assert.equal(count(w), before);
  /* a run named is a run's request: R1 is asked whatever the stamp */
  assert.equal(mine(w, { run: "R-NONE" }).code, "CAPTURE_REQUEST_NO_RUN");
});

test("R56 R49 is not asked of a member's request: an address the record does not hold, or one over 2,048 characters, is filed; the same address from a run is refused as before", () => {
  const w = world().scene();
  const unheld = "https://nowhere.example.org/page?q=1#frag";
  assert.equal(mine(w, { address: unheld }).ok, true);
  const long = `https://nowhere.example.org/${"x".repeat(CAPTURE_REQUEST_ADDRESS_MAX)}`;
  assert.equal(mine(w, { address: long }).ok, true);
  /* Control: a run's request for either is refused by R49 */
  assert.equal(w.ask({ address: unheld, held: false }).code, "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  assert.equal(w.ask({ address: long, held: false }).code, "CAPTURE_REQUEST_ADDRESS_TOO_LONG");
});

test("R56 target is optional; when given R3 applies to it and to lead_inquiry (C-28.3, C-28.14, C-28.15); R2, R4, R5, R46 and R50 apply as written, each refusal before anything is written", () => {
  const w = world().scene();
  w.project("PROJ-H");
  const t = mine(w, { target: "INQ-1", lead_inquiry: "INQ-2" });
  assert.deepEqual([t.ok, t.target, t.lead_inquiry, w.req(t.request).target], [true, "INQ-1", "INQ-2", "INQ-1"]);
  const refusals = [
    [{ target: "DOC-1" }, "CAPTURE_REQUEST_NOT_AN_INQUIRY"], [{ target: "PROJ-H" }, "CAPTURE_REQUEST_NOT_AN_INQUIRY"],
    [{ target: "INQ-1", lead: "DOC-1" }, "CAPTURE_REQUEST_LEAD_NOT_AN_INQUIRY"],
    [{ target: "INQ-1", lead: "INQ-1" }, "CAPTURE_REQUEST_LEAD_IS_THE_TARGET"],
    [{ lead: "INQ-NONE" }, "CAPTURE_REQUEST_LEAD_NOT_AN_INQUIRY"],
    [{ address: "http://later.example.org/x" }, "CAPTURE_REQUEST_NOT_PUBLIC"],
    [{ address: "https://127.0.0.1/x" }, "CAPTURE_REQUEST_NOT_PUBLIC"],
    [{ sha256: "x" }, "CAPTURE_REQUEST_CARRIES_A_CAPTURE"], [{ bytes: "x" }, "CAPTURE_REQUEST_CARRIES_A_CAPTURE"],
    [{ render: "yes" }, "CAPTURE_REQUEST_RENDER_MALFORMED"],
    [{ site_kind: "personal" }, "MEMBER_CAPTURE_ONLY"], [{ site_kind: "blog" }, "CAPTURE_REQUEST_SITE_KIND_UNKNOWN"],
    [{ co_archive: "yes" }, "CAPTURE_REQUEST_CO_ARCHIVE_MALFORMED"],
  ];
  const before = count(w);
  for (const [over, code] of refusals) {
    const x = mine(w, { address: "https://later.example.org/r", ...over });
    assert.deepEqual([x.ok, x.code, x.check], [false, code, CAPTURE_REQUEST_CHECKS[code].check], JSON.stringify(over));
  }
  assert.equal(count(w), before, "nothing written");
  /* Controls: a lead with no target is judged by R3 and taken; a member's co-archive choice is hers to make (R50);
     render true asks the rendered page */
  const l = mine(w, { address: "https://later.example.org/l", lead: "INQ-2" });
  assert.deepEqual([l.ok, l.target, l.lead_inquiry], [true, null, "INQ-2"]);
  const c = mine(w, { address: "https://later.example.org/co", co_archive: false, render: true });
  assert.deepEqual([c.ok, c.co_archive, c.render], [true, false, true]);
});

test("R56 R6's idempotence is on (her stamp, address, render) over her requests with no run: a second ask answers the standing row and writes nothing; another member, a run, or a render is another key", () => {
  const w = world().scene();
  const first = mine(w, { target: "INQ-1" });
  const again = mine(w, { target: "INQ-2", purpose: "investigate" });
  assert.deepEqual([again.ok, again.already, again.requested, again.request, again.target, again.purpose, again.run, again.drains],
                   [true, true, false, first.request, "INQ-1", "acquire", null, true]);
  assert.deepEqual(again.principals, { plane: ANN, claude: null });
  assert.equal(count(w), 1);
  /* Controls: each a new row */
  assert.equal(mine(w, {}, { caller: "member:bea", viewer: V("bea") }).already, false, "another member");
  assert.equal(mine(w, { render: true }).already, false, "a render");
  w.hold("https://later.example.org/a");
  assert.equal(w.ask({ address: "https://later.example.org/a" }).already, false, "a run's request");
  assert.equal(count(w), 4);
  /* a run's standing row never answers her ask */
  assert.equal(mine(w, { address: "https://later.example.org/a" }).already, true);
  assert.equal(count(w), 4);
});

test("R56 R10 a member's request is attributed to the daemon at her request: {member, inquiry}, her principal alone, the statement 'the daemon captured this, at the request of <plane>'; the one-principal refusal is asked only of a run's request", () => {
  const row = { run: null, target: "INQ-1", principal_plane: " member:ann ", principal_claude: null };
  assert.deepEqual(captureRequestAttribution(row), {
    ok: true, actor: "token:daemon", machine_attributed: true,
    at_the_request_of: { member: "ann", inquiry: "INQ-1" }, principals: { plane: "member:ann" },
    statement: "the daemon captured this, at the request of member:ann",
  });
  assert.equal(captureRequestAttribution({ ...row, target: null }).at_the_request_of.inquiry, null);
  /* Controls: a run's request with one principal is still refused; a row with no run under a credential or machine
     stamp is not a member's request and is refused as one principal */
  assert.equal(captureRequestAttribution({ ...row, run: "R-1" }).code, "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL");
  for (const plane of ["member:ann/tok1", "class:member", ""])
    assert.equal(captureRequestAttribution({ ...row, principal_plane: plane }).code, "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", plane);
});

test("R56 the drain judges a member's request by R14 and files it by R15 with no run: R49 not asked, the deeming actor her stamp (never a run or a sweep), its capture promoted at collected; a sweep named on it is refused C-28.19", async () => {
  const w = world().scene();
  const free = mine(w, { address: "https://free.example.org/doc" }).request;
  const under = mine(w, { address: "https://under.example.org/doc", target: "INQ-1" }).request;
  const swept = mine(w, { address: "https://swept.example.org/doc", sweep: "INQ-1#s1" }).request;
  /* Control: a run's row for an address the record does not hold is refused at the drain (R49) */
  w.ask({ address: "https://runs.example.org/doc" });
  w.st.sql.exec(`DELETE FROM captured_locators WHERE address = 'https://runs.example.org/doc'`);
  const d = await w.cr.drain({});
  assert.deepEqual(d.captured.map((c) => c.request).sort(), [free, under].sort(), JSON.stringify(d).slice(0, 600));
  const by = Object.fromEntries(w.capture.calls.map((c) => [c.opts.captureRequest.locator, c.opts.captureRequest]));
  assert.deepEqual(by["https://free.example.org/doc"], { locator: "https://free.example.org/doc", purpose: "acquire",
    agent: null, render: false, origin: { matched_sweep: null, deeming_actor: ANN } });
  assert.deepEqual(by["https://under.example.org/doc"].origin, { matched_sweep: "INQ-1", deeming_actor: ANN });
  const r = w.req(free);
  assert.deepEqual([r.state, r.run, r.detail], ["captured", null, "the daemon captured this, at the request of member:ann"]);
  const c = d.captured.find((x) => x.request === free);
  assert.equal(c.attribution.statement, r.detail);
  assert.equal(c.promoted.ok, true, JSON.stringify(c.promoted));
  const b = w.row(`SELECT * FROM bundles WHERE bundle_id=?`, c.promoted.bundle_id);
  assert.deepEqual([b.object_type, b.current_state], ["information", "collected"]);
  const md = w.record.readFile(c.promoted.bundle_id, "bundle.md").text;
  assert.match(md, /at the request of member:ann/);
  assert.doesNotMatch(md, /run null|investigative session's request/);
  /* the sweep: refused by name, nothing fetched */
  assert.deepEqual([w.req(swept).state, w.req(swept).code], ["refused", "CAPTURE_SWEEP_OUT_OF_SCOPE"]);
  assert.equal("https://swept.example.org/doc" in by, false);
  assert.equal(d.refused.find((x) => x.code === "CAPTURE_REQUEST_ADDRESS_NOT_HELD").address, "https://runs.example.org/doc");
});

test("R56 a member's request joins no run's wait (R29): the run's waits, the wait source's holds, woken and completions never name it", async () => {
  const w = world().scene();
  const m = mine(w).request;
  const r = w.ask({ address: "https://run.example.org/x" }).request;
  const src = w.waitRegs[0].source;
  const iso = new Date(w.clock.ms).toISOString().replace(/\.\d+Z$/, "Z");
  assert.deepEqual(src.holds(iso, 25), [{ run: "R-1", outstanding: 1 }], "control: the run's request holds it");
  assert.deepEqual(w.cr.waits({ run: "R-1" }).outstanding.map((x) => x.request), [r]);
  for (const run of [null, "", undefined]) assert.deepEqual(w.cr.waits({ run }).outstanding, []);
  await w.cr.drain({});
  assert.equal(w.req(m).state, "captured");
  assert.deepEqual(src.woken(25), ["R-1"]);
  assert.deepEqual(w.cr.waits({ run: "R-1" }).completions.map((x) => x.request), [r]);
  assert.equal(src.markWoken([m], iso), 0, "never stamped as a run's completion");
});

test("R56 sight: a member's request with a target is seen by the viewers who see its target; with none, by her alone (R23, R24, R26, R43, R42's retry, the observation log's look), never by another member or a machine", async () => {
  const w = world().scene();
  const alone = mine(w, { address: "https://alone.example.org/x" }).request;
  const shared = mine(w, { address: "https://shared.example.org/x", target: "INQ-1" }).request;
  const pending = mine(w, { address: "https://pending.example.org/x", target: "INQ-1" }).request;
  w.capture.script.set("https://alone.example.org/x", { status: 502, body: { ok: false, reason: "SOURCE_REFUSED", status: 401 } });
  w.capture.script.set("https://pending.example.org/x", { status: 502, body: { ok: false, reason: "SOURCE_REFUSED", status: 503 } });
  await w.cr.drain({});
  w.tick();
  const ids = (v) => w.cr.captureRequests({ viewer: v }).requests.map((r) => r.request).sort();
  assert.deepEqual(ids(V("ann")), [alone, shared, pending].sort());
  assert.deepEqual(ids(V("bea")), [shared, pending].sort(), "another member sees the ones under a question she sees");
  assert.deepEqual(ids(MACHINE), [shared, pending].sort(), "a machine credential sees every row with a target, and not hers alone");
  for (const v of [null, "admin", "class:admin"]) assert.equal(ids(v).includes(alone), false, String(v));
  assert.equal(w.cr.requestById({ request: alone, viewer: V("ann") }).request, alone);
  for (const v of [V("bea"), MACHINE, "admin"]) assert.equal(w.cr.requestById({ request: alone, viewer: v }), null, v);
  assert.deepEqual(w.cr.completed({ viewer: V("ann") }).requests.map((r) => r.request), [shared]);
  assert.deepEqual(w.cr.completed({ viewer: V("bea") }).requests.map((r) => r.request), [shared]);
  /* R24: her row answers R10's member attribution */
  assert.equal(w.cr.requestById({ request: alone, viewer: V("ann") }).attribution.statement,
               "the daemon captured this, at the request of member:ann");
  /* R42: the source refused it (401): she may retry it; another member is answered as for one that does not exist */
  const no = w.cr.captureRequestRetry({ request: alone }, { viewer: V("bea") });
  assert.equal(no.code, "CAPTURE_REQUEST_NOT_RETRYABLE");
  assert.equal(w.req(alone).state, "refused");
  assert.equal(w.cr.captureRequestRetry({ request: alone }, { viewer: V("ann") }).ok, true);
  /* the observation log's look on her address: hers alone */
  const look = w.log().find((l) => l.subject === "https://alone.example.org/x");
  assert.deepEqual([look.authority_kind, look.authority], ["sweep", alone]);
  assert.equal(w.obs.rowVisible(look, V("ann")), true);
  assert.equal(w.obs.rowVisible(look, V("bea")), false);
  const sharedLook = w.log().find((l) => l.subject === "https://pending.example.org/x");
  assert.equal(w.obs.rowVisible(sharedLook, V("bea")), true, "control: a look under a question she sees");
});

test("R56 while unattended capture is not configured (R11) a member's answer carries drains: false and the sentence that it waits, written or standing; configured, drains: true; a run's answer carries neither", () => {
  const cold = world({ configured: () => false }).scene();
  const a = mine(cold);
  assert.deepEqual([a.ok, a.drains, a.detail], [true, false, MEMBER_REQUEST_WAITS]);
  assert.match(a.detail, /waits until your team's Civicsmith captures unattended/);
  const again = mine(cold);
  assert.deepEqual([again.already, again.drains, again.detail], [true, false, MEMBER_REQUEST_WAITS]);
  const warm = world().scene();
  assert.equal(mine(warm).drains, true);
  const run = warm.ask();
  assert.equal("drains" in run, false, "control: a run's request");
});

test("R56 R48's captured-for reader names a member's request under a question, with her as asker, and skips one that names no question", async () => {
  const w = world().scene();
  const same = (_b, opts) => ({ status: 200, body: { ok: true, document: { capture: { sha256: sha("one"), grade: "B" } } } });
  w.capture.script.set("https://a.example.org/x", same);
  w.capture.script.set("https://b.example.org/x", same);
  mine(w, { address: "https://a.example.org/x" });
  mine(w, { address: "https://b.example.org/x", target: "INQ-1" });
  await w.cr.drain({});
  const fn = w.capture.readers.find((r) => r.slot === "captured-for").fn;
  assert.deepEqual(fn({ document: "D", captures: [sha("one")], viewer: V("ann") }).questions.map((q) => [q.question, q.asker]),
                   [["INQ-1", ANN]]);
});

test("R56 the op: capturerequest with no run under a member's principal stamp files her request; the stamps come from the query string, never the body", () => {
  const w = world().scene();
  const url = new URL("http://x/capturerequest?viewer=member%3Aann&principal=member%3Aann");
  const a = captureRequestsOps(w.cr, url, { address: "https://op.example.org/x", principal: "member:eve" }).capturerequest();
  assert.deepEqual([a.ok, a.run, w.req(a.request).principal_plane], [true, null, ANN]);
  /* Control: a body's principal is never the caller */
  const b = captureRequestsOps(w.cr, new URL("http://x/capturerequest?viewer=member%3Aann"),
                               { address: "https://op.example.org/y", principal: ANN, caller: ANN }).capturerequest();
  assert.equal(b.code, "CAPTURE_REQUEST_NO_RUN");
});

test("R56 migrate: a table created before T47, with run, target and principal_claude NOT NULL, is rebuilt once with them nullable, every row and index kept; a current table is left as it is", () => {
  const st = storage();
  st.db.exec(`CREATE TABLE capture_requests (request TEXT PRIMARY KEY, run TEXT NOT NULL, target TEXT NOT NULL,
    address TEXT NOT NULL, host TEXT NOT NULL, purpose TEXT NOT NULL, ua_mode TEXT NOT NULL, principal_plane TEXT NOT NULL,
    principal_claude TEXT NOT NULL, state TEXT NOT NULL, code TEXT, detail TEXT, capture_sha TEXT,
    attempts INTEGER NOT NULL DEFAULT 0, requested_at TEXT NOT NULL, updated TEXT NOT NULL, expires TEXT NOT NULL,
    captured_at TEXT)`);
  st.db.exec(`CREATE INDEX capture_requests_state ON capture_requests(state, requested_at)`);
  st.db.exec(`INSERT INTO capture_requests VALUES ('CR-OLD', 'R-1', 'INQ-1', 'https://e.org/', 'e.org', 'investigate',
    'civicos', 'member:ann/tok1', 'instance', 'captured', NULL, 'd', 'sha', 1, 't', 't', 'x', 't')`);
  const notnull = () => Object.fromEntries(st.sql.exec(`PRAGMA table_info(capture_requests)`).toArray()
    .filter((r) => CAPTURE_REQUESTS_NULLABLE.includes(r.name)).map((r) => [r.name, r.notnull]));
  assert.deepEqual(notnull(), { run: 1, target: 1, principal_claude: 1 });
  migrateCaptureRequests(st.sql);
  assert.deepEqual(notnull(), { run: 0, target: 0, principal_claude: 0 });
  const row = st.sql.exec(`SELECT * FROM capture_requests WHERE request='CR-OLD'`).toArray()[0];
  assert.deepEqual([row.run, row.target, row.principal_claude, row.state, row.render, row.step], ["R-1", "INQ-1", "instance", "captured", 0, null]);
  const indexes = st.sql.exec(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='capture_requests' AND sql IS NOT NULL`)
    .toArray().map((r) => r.name).sort();
  assert.ok(indexes.includes("capture_requests_state") && indexes.includes("capture_requests_sha"), indexes.join());
  assert.equal(st.sql.exec(`SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'capture_requests_pre%'`).toArray()[0].n, 0);
  /* Control: migrating again changes nothing; a null run is now writable */
  migrateCaptureRequests(st.sql);
  assert.equal(st.sql.exec(`SELECT count(*) AS n FROM capture_requests`).toArray()[0].n, 1);
  st.sql.exec(`INSERT INTO capture_requests (request, run, target, address, host, purpose, ua_mode, principal_plane,
    principal_claude, state, attempts, requested_at, updated, expires) VALUES ('CR-NEW', NULL, NULL, 'https://e.org/',
    'e.org', 'acquire', 'civicsmith', 'member:ann', NULL, 'requested', 0, 't', 't', 'x')`);
  assert.equal(st.sql.exec(`SELECT count(*) AS n FROM capture_requests`).toArray()[0].n, 2);
});

test("R56 R55 a member's request may carry a step she sees (judged with her as the asker), tied to it on completion; one she does not see is refused CAPTURE_REQUEST_NO_STEP before anything is written", async () => {
  const w = world().scene();
  const s = w.steps.stepCreate({ place: { questions: ["INQ-1"] }, work: "fetch the minutes later", by: ANN });
  assert.equal(s.ok, true, JSON.stringify(s));
  const a = mine(w, { step: s.step });
  assert.deepEqual([a.ok, a.step], [true, s.step]);
  const d = await w.cr.drain({});
  assert.deepEqual(d.captured[0].step_product, { ok: true, step: s.step });
  /* Control: a step on a question in a project she has not joined is unseen: refused, nothing written */
  w.project("PROJ-H");
  w.participant("PROJ-H", "inner");
  w.bundle("INQ-H");
  w.st.sql.exec(`UPDATE bundles SET project='PROJ-H' WHERE bundle_id = 'INQ-H'`);
  w.membership.reindexProjectSight("INQ-H");
  const hidden = w.steps.stepCreate({ place: { questions: ["INQ-H"] }, work: "hidden", by: "member:inner" });
  assert.equal(hidden.ok, true);
  const before = count(w);
  const x = mine(w, { address: "https://later.example.org/h", step: hidden.step });
  assert.deepEqual([x.ok, x.code], [false, "CAPTURE_REQUEST_NO_STEP"]);
  assert.equal(count(w), before);
  /* and the same step is hers to name when she is the one who sees it */
  assert.equal(mine(w, { address: "https://later.example.org/i", step: hidden.step }, { caller: "member:inner", viewer: V("inner") }).ok, true);
});
