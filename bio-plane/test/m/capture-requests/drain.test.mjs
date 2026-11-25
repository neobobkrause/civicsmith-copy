/* capture-requests: the drain (R10–R22, R37–R41), driven at `drain`, `drainPending` and `drainIntervalMs`, with
   `capture`'s in-process arm a scripted stand-in that records exactly what it was handed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, T0, ENV, refused, renderRefusal, sha, filed } from "./fixture.mjs";
import { captureRequestAttribution, CAPTURE_REQUEST_TICK_BATCH, CAPTURE_REQUEST_TTL_MS, CAPTURE_SOURCE_CHECKS,
         CAPTURE_REQUEST_CHECKS, CAPTURE_PURPOSES, CAPTURE_UA_MODES, CAPTURE_UA_MODE_ALIASES, uaModeOf, userAgentIsLegible,
         sourceReasonOf, captureRequestsOps } from "../../../src/capture-requests/index.mjs";
import { RENDER_CAPTURE_CHECKS, civicsmithUserAgent } from "../../../src/acquisition/index.mjs";

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const addr = (i) => `https://h${i}.example.org/doc`;
const inquiryMd = (ua) => ["---", "id: INQ-UA", "object_type: inquiry", ...(ua ? [`member_user_agent: "${ua}"`] : []),
                           "---", "", "## Question", "", "q", ""].join("\n");

test("R10 the attribution names the daemon as a machine-shaped actor at the session's request, both principals trimmed, its statement composed from them; one or none present is refused naming which", () => {
  const row = { run: "R-1", target: "INQ-1", principal_plane: "  member:ann/tok1 ", principal_claude: " instance " };
  const a = captureRequestAttribution(row);
  assert.deepEqual(a, {
    ok: true, actor: "token:daemon", machine_attributed: true,
    at_the_request_of: { run: "R-1", inquiry: "INQ-1" },
    principals: { plane: "member:ann/tok1", claude: "instance" },
    statement: "the daemon captured this, at the investigative session's request (run R-1), under member:ann/tok1, paid by instance",
  });
  for (const [p, c, want] of [["x", "", { plane: "x", claude: null }], ["", "y", { plane: null, claude: "y" }],
                              [" ", " ", { plane: null, claude: null }]])
    assert.deepEqual(captureRequestAttribution({ ...row, principal_plane: p, principal_claude: c }),
                     { ok: false, code: "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", ...want });
  assert.deepEqual(captureRequestAttribution(null), { ok: false, code: "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", plane: null, claude: null });
});

test("R11 unconfigured, the drain answers configured: false and drains nothing; not re-entrant: a drain while one runs answers busy and does nothing", async () => {
  const cold = world({ env: { VERSION: "1", INSTANCE_NAME: "i" } }).scene();
  cold.ask();
  const d = await cold.cr.drain({});
  assert.deepEqual([d.configured, d.drained, d.captured, d.remaining], [false, 0, [], 0]);
  assert.equal(cold.capture.calls.length, 0);
  assert.equal(cold.req(cold.rows(`SELECT request FROM capture_requests`)[0].request).state, "requested");

  const w = world().scene();
  w.ask();
  let release;
  w.capture.script.set("https://example.org/a", () => new Promise((r) => { release = r; }));
  const first = w.cr.drain({});
  await new Promise((r) => setImmediate(r));
  const second = await w.cr.drain({});
  assert.deepEqual([second.configured, second.busy, second.drained], [true, true, 0]);
  release({ status: 200, body: { ok: true, document: { capture: { sha256: sha("a"), grade: "B" } } } });
  assert.equal((await first).captured.length, 1);
  assert.equal(w.capture.calls.length, 1);
});

test("R37 drainPending is the number of requested rows, 0 when unconfigured; drainIntervalMs is 60,000 or the binding when it reads as a number ≥ 0; both never throw and write nothing", () => {
  const w = world().scene();
  assert.equal(w.cr.drainPending(), 0);
  w.ask({ address: "https://example.org/1" }); w.ask({ address: "https://example.org/2" });
  assert.equal(w.cr.drainPending(), 2);
  w.st.sql.exec(`UPDATE capture_requests SET state='captured' WHERE address='https://example.org/2'`);
  assert.equal(w.cr.drainPending(), 1);
  assert.equal(world({ env: {} }).scene().cr.drainPending(), 0);
  const off = world({ env: {} }).scene(); off.ask();
  assert.equal(off.cr.drainPending(), 0, "an unconfigured instance holds no alarm");
  assert.equal(world({ configured: () => { throw new Error("x"); } }).cr.drainPending(), 0);
  for (const [v, want] of [[undefined, 60000], ["", 60000], ["  ", 60000], [null, 60000], ["5000", 5000], [0, 0],
                           ["0", 0], ["-1", 60000], ["soon", 60000], [2500, 2500], [Infinity, 60000]])
    assert.equal(world({ env: { ...ENV, CAPTURE_REQUEST_TICK_MS: v } }).cr.drainIntervalMs(), want, String(v));
  const before = w.rows(`SELECT * FROM capture_requests`);
  w.cr.drainPending(); w.cr.drainIntervalMs();
  assert.deepEqual(w.rows(`SELECT * FROM capture_requests`), before);
});

test("R12 a tick acts on at most 10 rows (limit lowers, never raises), oldest first by requested_at then request", async () => {
  const w = world().scene();
  for (let i = 0; i < 13; i++) { w.ask({ address: addr(i) }); w.tick(1000); }
  const d = await w.cr.drain({ limit: 50 });
  assert.equal(d.captured.length, CAPTURE_REQUEST_TICK_BATCH);
  assert.deepEqual(d.captured.map((c) => c.address), [...Array(10).keys()].map(addr));
  assert.equal(d.remaining, 3);
  const e = await w.cr.drain({ limit: 2 });
  assert.equal(e.captured.length, 2);
  assert.equal((await w.cr.drain({ limit: 0 })).captured.length, 1, "a limit of 0 is the batch, never none");
});

test("R12 expired rows are released before selection, so none takes a slot", async () => {
  const w = world().scene();
  for (let i = 0; i < 3; i++) w.ask({ address: addr(i) });
  w.tick(CAPTURE_REQUEST_TTL_MS - 10_000);
  for (let i = 3; i < 6; i++) { w.ask({ address: addr(i) }); w.tick(1000); }
  w.tick(8000);
  const d = await w.cr.drain({ limit: 3 });
  assert.equal(d.expired.length, 3);
  assert.deepEqual(d.captured.map((c) => c.address), [addr(3), addr(4), addr(5)]);
});

test("R13 R14 conduct refusals and holds: code, detail and attempts + 1 written, terminal to refused, temporary left requested; each appended LOOKED_INDETERMINATE, governed exactly for our pacing", async () => {
  const w = world().scene();
  /* the document's own line is not inquiry's answer: inquiry records no agent, so none is delegated (R14, N295) */
  w.bundle("INQ-UA", "inquiry", { md: inquiryMd("Document/1.0") });
  w.run("R-UA", { context: "INQ-UA" });
  w.run("R-HALF", { claude: " " });
  const ask = (over) => w.ask(over).request;
  const ids = {
    attribution: ask({ run: "R-HALF", address: "https://a.example.org/x" }),
    purpose: ask({ purpose: "shopping", address: "https://b.example.org/x" }),
    mode: ask({ ua_mode: "spoofed", address: "https://c.example.org/x" }),
    unrecorded: ask({ run: "R-UA", target: "INQ-UA", ua_mode: "member-browser", address: "https://d.example.org/x" }),
  };
  await w.governor.governorReport({ host: "e.example.org", status: 429, retry_after_ms: 600000 });
  ids.held = ask({ address: "https://e.example.org/x" });
  w.tick(1000);
  ids.first = ask({ address: "https://f.example.org/1" });
  w.tick(1000);
  ids.spent = ask({ address: "https://f.example.org/2" });
  const d = await w.cr.drain({});
  const by = (list) => Object.fromEntries(list.map((x) => [x.request, x]));
  const R = by(d.refused), H = by(d.held);
  const expectRow = (id, code, state, governed, condition) => {
    const r = w.req(id);
    assert.deepEqual([r.state, r.code, r.attempts], [state, code, 1], id);
    const x = (state === "refused" ? R : H)[id];
    assert.deepEqual([x.code, x.check, x.translation], [code, CAPTURE_REQUEST_CHECKS[code].check, CAPTURE_REQUEST_CHECKS[code].translation]);
    assert.equal(typeof x.detail, "string");
    const look = w.log().filter((l) => l.subject === r.address).at(-1);
    assert.deepEqual([look.state, look.governed, look.condition, look.authority_kind, look.authority],
                     ["LOOKED_INDETERMINATE", governed ? 1 : 0, condition, "run", r.run]);
    assert.match(look.detail, new RegExp(`${CAPTURE_REQUEST_CHECKS[code].check} ${code}`));
  };
  expectRow(ids.attribution, "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", "refused", false, null);
  expectRow(ids.purpose, "CAPTURE_CONDUCT_NO_PURPOSE", "refused", false, null);
  expectRow(ids.mode, "CAPTURE_CONDUCT_UA_ILLEGIBLE", "refused", false, null);
  expectRow(ids.unrecorded, "CAPTURE_CONDUCT_UA_UNRECORDED", "refused", false, null);
  expectRow(ids.held, "CAPTURE_CONDUCT_HOST_HELD", "requested", true, "governor-holding-host");
  expectRow(ids.spent, "CAPTURE_CONDUCT_TICK_SPENT", "requested", true, "governor-holding-host");
  assert.equal(w.req(ids.first).state, "captured");
  assert.deepEqual(w.capture.calls.map((c) => c.opts.captureRequest.locator), ["https://f.example.org/1"],
    "nothing refused or held left the instance");
});

test("R14 conduct's order: attribution before purpose before agent before rate, the first failing rule deciding", async () => {
  const w = world().scene();
  w.run("R-HALF", { claude: "" });
  await w.governor.governorReport({ host: "held.example.org", status: 403 });
  const a = w.ask({ run: "R-HALF", purpose: "bad", ua_mode: "bad", address: "https://held.example.org/1" }).request;
  const b = w.ask({ purpose: "bad", ua_mode: "bad", address: "https://held.example.org/2" }).request;
  const c = w.ask({ ua_mode: "bad", address: "https://held.example.org/3" }).request;
  await w.cr.drain({});
  assert.deepEqual([a, b, c].map((id) => w.req(id).code),
                   ["CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", "CAPTURE_CONDUCT_NO_PURPOSE", "CAPTURE_CONDUCT_UA_ILLEGIBLE"]);
});

test("R14 the civicsmith agent is acquisition's composer (its R24 civicsmithUserAgent) and legible; the member agent inquiry records (its R44 memberUserAgent) is delegated verbatim, never the document's line; no robots.txt is read and a Disallow path is captured (BOB-3)", async () => {
  const UA = "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0";
  const w = world().scene();
  w.bundle("INQ-UA", "inquiry", { md: inquiryMd("Document/1.0") });
  w.agents.set("INQ-UA", UA);
  w.run("R-UA", { context: "INQ-UA" });
  const touched = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { touched.push(String(u)); throw new Error("no network in this test"); };
  try {
    w.ask({ address: "https://www.example.gov/private/disallowed/report.pdf" });
    w.ask({ run: "R-UA", target: "INQ-UA", ua_mode: "member-browser", address: "https://m.example.org/x" });
    w.ask({ purpose: "acquire", address: "https://p.example.org/x" });
    const d = await w.cr.drain({});
    assert.equal(d.captured.length, 3);
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(touched, [], "no robots.txt, nor anything else, fetched by the drain itself");
  const by = Object.fromEntries(w.capture.calls.map((c) => [c.opts.captureRequest.locator, c.opts.captureRequest]));
  assert.equal(by["https://m.example.org/x"].agent, UA, "inquiry's answer, not the document's line");
  assert.deepEqual(w.asked, ["INQ-UA"], "inquiry is asked for the member-browser row's target only");
  assert.equal(by["https://p.example.org/x"].purpose, "acquire");
  assert.equal(by["https://www.example.gov/private/disallowed/report.pdf"].agent, null);
  const ua = civicsmithUserAgent(ENV.VERSION, ENV.INSTANCE_NAME, "investigate");
  assert.equal(ua, "Civicsmith/9.9.9 (+https://github.com/believeinoakland/bio; instance testbed; investigate)");
  assert.equal(userAgentIsLegible(ua), true);
});

test("R14 the conduct vocabulary: the purposes are exactly investigate and acquire, the agent forms exactly civicsmith and member-browser, both frozen, civicos the one alias (of civicsmith); a legible agent names a (+<url> contact, and nothing else is legible", () => {
  assert.deepEqual([...CAPTURE_PURPOSES], ["investigate", "acquire"]);
  assert.deepEqual([...CAPTURE_UA_MODES], ["civicsmith", "member-browser"]);
  assert.deepEqual({ ...CAPTURE_UA_MODE_ALIASES }, { civicos: "civicsmith" });
  assert.equal(Object.isFrozen(CAPTURE_PURPOSES), true);
  assert.equal(Object.isFrozen(CAPTURE_UA_MODES), true);
  assert.equal(Object.isFrozen(CAPTURE_UA_MODE_ALIASES), true);
  for (const [v, want] of [["civicos", "civicsmith"], ["civicsmith", "civicsmith"], ["member-browser", "member-browser"],
                           ["CivicOS", "CivicOS"], [" civicos", " civicos"], ["constructor", "constructor"],
                           ["toString", "toString"], [null, null], [undefined, undefined], [7, 7]])
    assert.equal(uaModeOf(v), want, String(v));
  for (const p of CAPTURE_PURPOSES) assert.equal(userAgentIsLegible(civicsmithUserAgent("1.0.0", "i", p)), true, p);
  for (const ua of ["Bot/1.0 (+https://example.org/bot)", "x (+http://e.org)"])
    assert.equal(userAgentIsLegible(ua), true, ua);
  for (const ua of [undefined, null, 7, {}, "", "   ", "CivicOS/1.0 (instance i; investigate)", "x (https://e.org)",
                    "x (+ftp://e.org)", "x (+https://)", "x +https://e.org", "Mozilla/5.0 (compatible; +https://example.org/bot)"])
    assert.equal(userAgentIsLegible(ua), false, String(ua));
});

test("R14 civicos is accepted on input and read in a stored row as civicsmith: a request is always written civicsmith; a stored civicos row is judged and fetched as civicsmith; every read and feed item answers it civicsmith; no other spelling is the alias", async () => {
  const w = world().scene();
  const iso0 = iso(T0), exp0 = iso(T0 + CAPTURE_REQUEST_TTL_MS);
  /* the door: the alias, the default and the mode itself are each written and answered civicsmith */
  const asked = [w.ask({ address: "https://a.example.org/alias", ua_mode: "civicos" }),
                 w.ask({ address: "https://a.example.org/default" }),
                 w.ask({ address: "https://a.example.org/named", ua_mode: "civicsmith" }),
                 w.ask({ address: "https://a.example.org/camel", uaMode: "civicos" })];
  for (const a of asked) assert.deepEqual([a.ok, a.ua_mode, w.req(a.request).ua_mode], [true, "civicsmith", "civicsmith"], a.address);
  /* rows stored before T31 under the old name: one waiting, one captured with a lead, one held render */
  const legacy = (request, address, state, extra = {}) => w.st.sql.exec(
    `INSERT INTO capture_requests (request, run, target, address, host, purpose, ua_mode, principal_plane, principal_claude,
       state, attempts, requested_at, updated, expires, captured_at, capture_sha, lead_inquiry, render, code)
     VALUES (?, 'R-1', 'INQ-1', ?, ?, 'investigate', 'civicos', 'member:ann/tok1', 'instance', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    request, address, new URL(address).host, state, iso0, iso0, exp0, extra.captured_at ?? null, extra.capture_sha ?? null,
    extra.lead ?? null, extra.render ?? 0, extra.code ?? null);
  for (const a of ["https://old.example.org/wait", "https://done.example.org/x", "https://render.example.org/x"]) w.hold(a);
  legacy("CR-OLD-WAIT", "https://old.example.org/wait", "requested");
  legacy("CR-OLD-DONE", "https://done.example.org/x", "captured", { captured_at: iso0, capture_sha: sha("old"), lead: "INQ-2" });
  legacy("CR-OLD-RENDER", "https://render.example.org/x", "requested", { render: 1, code: "RENDER_DEFERRED" });
  assert.equal(w.row(`SELECT count(*) AS n FROM capture_requests WHERE ua_mode='civicos'`).n, 3, "the stored rows stand as stored");
  /* the standing answer for a stored civicos row (R6) */
  const again = w.ask({ address: "https://old.example.org/wait" });
  assert.deepEqual([again.already, again.request, again.ua_mode], [true, "CR-OLD-WAIT", "civicsmith"]);
  /* every read answers civicsmith: R23, R26 (the feed's producers), R29, R43 */
  const reads = {
    captureRequests: w.cr.captureRequests({ viewer: V("ann") }).requests,
    completed: w.cr.completed({ viewer: V("ann") }).requests,
    leads: w.cr.leads({ viewer: V("ann") }).requests,
    rendersHeld: w.cr.rendersHeld({ viewer: V("ann") }).requests,
    outstanding: w.cr.waits({ run: "R-1" }).outstanding,
    completions: w.cr.waits({ run: "R-1" }).completions,
    byId: ["CR-OLD-WAIT", "CR-OLD-DONE", "CR-OLD-RENDER"].map((request) => w.cr.requestById({ request, viewer: V("ann") })),
  };
  for (const [name, rows] of Object.entries(reads)) {
    assert.ok(rows.length > 0, name);
    for (const r of rows) assert.equal(r.ua_mode, "civicsmith", `${name} ${r.request}`);
  }
  assert.deepEqual(reads.completed.map((r) => r.request), ["CR-OLD-DONE"]);
  assert.deepEqual(reads.leads.map((r) => r.request), ["CR-OLD-DONE"]);
  assert.deepEqual(reads.rendersHeld.map((r) => r.request), ["CR-OLD-RENDER"]);
  assert.equal(JSON.stringify(Object.values(reads)).includes("civicos"), false, "no read says civicos");
  /* the drain judges a stored civicos row as civicsmith: fetched with no delegated agent, never refused illegible */
  const d = await w.cr.drain({});
  assert.deepEqual([w.req("CR-OLD-WAIT").state, w.req("CR-OLD-WAIT").code], ["captured", null]);
  const call = w.capture.calls.find((c) => c.opts.captureRequest.locator === "https://old.example.org/wait");
  assert.equal(call.opts.captureRequest.agent, null, "the Civicsmith agent is acquisition's to send, not a delegated one");
  assert.equal(d.refused.length, 0, JSON.stringify(d.refused));
  assert.equal(w.asked.length, 0, "inquiry is never asked for a member agent for a civicsmith row");
  /* nothing written civicos since, and no near spelling is the alias */
  assert.equal(w.row(`SELECT count(*) AS n FROM capture_requests WHERE ua_mode='civicos' AND request NOT LIKE 'CR-OLD-%'`).n, 0);
  const near = ["CivicOS", "CIVICOS", "civic-os"].map((ua_mode, i) => w.ask({ address: `https://near${i}.example.org/x`, ua_mode }));
  assert.deepEqual(near.map((a) => w.req(a.request).ua_mode), ["CivicOS", "CIVICOS", "civic-os"], "recorded as sent (R8)");
  await w.cr.drain({});
  for (const a of near) assert.deepEqual([w.req(a.request).state, w.req(a.request).code], ["refused", "CAPTURE_CONDUCT_UA_ILLEGIBLE"], a.request);
});

test("R15 a row passing conduct is set draining in the tick that fires, counts one fetch for its host, and is fired with the row's address, purpose, agent and render, its sweep origin (R38) and nothing else", async () => {
  const w = world().scene();
  const id = w.ask({ address: "https://s.example.org/doc", render: true }).request;
  let seen = null;
  w.capture.script.set("https://s.example.org/doc", (body, opts) => {
    seen = w.req(id).state;
    const f = filed("https://s.example.org/doc", opts, { bytes: "s" });
    f.body.document.capture.grade = "A";
    return f;
  });
  const d = await w.cr.drain({});
  assert.equal(seen, "draining");
  assert.equal(w.capture.calls.length, 1);
  const call = w.capture.calls[0];
  assert.deepEqual(call.body, {});
  assert.deepEqual(call.opts, { cls: "daemon", member: false, storeName: "bio",
    captureRequest: { locator: "https://s.example.org/doc", purpose: "investigate", agent: null, render: true,
                      origin: { matched_sweep: "INQ-1", deeming_actor: "run R-1 under member:ann/tok1, paid by instance" } } });
  const r = w.req(id);
  assert.deepEqual([r.state, r.code, r.capture_sha, r.captured_at, r.attempts], ["captured", null, sha("s"), iso(T0), 1]);
  assert.equal(r.detail, captureRequestAttribution(r).statement);
  assert.match(d.captured[0].promoted.bundle_id, /^INFO-2026-\d{4}-requested$/);
  assert.deepEqual(d.captured, [{ request: id, address: "https://s.example.org/doc", sha: sha("s"), grade: "A",
                                  attribution: captureRequestAttribution(r), already_held: false,
                                  promoted: { ok: true, bundle_id: d.captured[0].promoted.bundle_id } }]);
  const look = w.log().at(-1);
  assert.deepEqual([look.state, look.result_kind, look.result_ref, look.detail, look.governed],
                   ["PRESENT", "capture", sha("s"), r.detail, 0]);
});

test("R16 nothing outside the drain makes the instance fetch for a request: the drain fires capture's in-process arm, and op=acquire refuses via capture-request from any caller (C-28.13)", async () => {
  const { acquire } = await import("../../../src/acquisition/index.mjs");
  // fixtures-own: platform the evidence store (R2 bucket) double handed to the real acquire, whose only content is head/get/put
  const fakeCap = { core: { evidenceStore: () => ({ head: async () => null, get: async () => null, put: async () => ({}) }) } };
  for (const cls of ["admin", "member", "probe", "daemon", "ai", null]) {
    const res = await acquire(fakeCap, { via: "capture-request", request: "CR-x", locator: "https://example.org/a" }, { cls });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "CAPTURE_NOT_DRAINING");
    assert.equal(res.body.check, "C-28.13");
  }
  const w = world().scene();
  w.ask();
  await w.cr.drain({});
  assert.equal(w.capture.calls.length, 1);
  assert.ok(w.capture.calls[0].opts.captureRequest, "the drain's fire is the in-process arm");
});

test("R17 a render capture refuses before fetching (C-83.3, .4, .5, .8) holds the row under that code, gives the host's slot back, is governed render-deferred, and is answered held with capture's own word", async () => {
  for (const [code, word, state] of [["RENDER_NO_RENDERER", null, "deferred"], ["RENDER_DEFERRED", "deferred", "deferred"],
                                     ["RENDER_HOST_COOLING_OFF", null, "deferred"], ["RENDER_AT_CAPACITY", "waiting", "waiting"]]) {
    const w = world().scene();
    const r = w.ask({ address: "https://r.example.org/page", render: true }).request;
    w.tick(1000);
    const p = w.ask({ address: "https://r.example.org/plain" }).request;
    w.capture.script.set("https://r.example.org/page", renderRefusal(code, word));
    const d = await w.cr.drain({});
    const row = w.req(r);
    assert.deepEqual([row.state, row.code, row.capture_sha, row.attempts], ["requested", code, null, 1], code);
    assert.deepEqual(d.held.map((h) => [h.request, h.code, h.check, h.render]),
                     [[r, code, RENDER_CAPTURE_CHECKS[code].check, { state, content: "undetermined" }]]);
    assert.equal(w.req(p).state, "captured", "the slot was given back: the plain request for the same host went out");
    const look = w.log().find((l) => l.subject === "https://r.example.org/page");
    assert.deepEqual([look.state, look.governed, look.condition], ["LOOKED_INDETERMINATE", 1, "render-deferred"]);
  }
});

test("R18 a render result decided after the page was fetched spends the slot: RENDER_NOT_A_PAGE is refused, RENDER_FAILED holds", async () => {
  for (const [code, state, list] of [["RENDER_NOT_A_PAGE", "refused", "refused"], ["RENDER_FAILED", "requested", "held"]]) {
    const w = world().scene();
    const r = w.ask({ address: "https://r.example.org/page", render: true }).request;
    w.tick(1000);
    const p = w.ask({ address: "https://r.example.org/plain" }).request;
    w.capture.script.set("https://r.example.org/page", renderRefusal(code));
    const d = await w.cr.drain({});
    assert.deepEqual([w.req(r).state, w.req(r).code], [state, code]);
    assert.equal(d[list][0].check, RENDER_CAPTURE_CHECKS[code].check);
    assert.deepEqual([w.req(p).state, w.req(p).code], ["requested", "CAPTURE_CONDUCT_TICK_SPENT"],
      "the host's slot stays spent: the page was fetched");
  }
});

test("R19 any other failure holds the row requested under C-28.17 with its check and translation, not governed, answered in held; a thrown error's words are never carried", async () => {
  const w = world().scene();
  const a = w.ask({ address: "https://x.example.org/500" }).request;
  const b = w.ask({ address: "https://y.example.org/thrown" }).request;
  w.capture.script.set("https://x.example.org/500", refused(503));
  w.capture.script.set("https://y.example.org/thrown", () => { throw new Error("secret https://y/?token=abc"); });
  const d = await w.cr.drain({});
  for (const id of [a, b]) {
    const r = w.req(id);
    assert.deepEqual([r.state, r.code], ["requested", "CAPTURE_FETCH_FAILED"]);
    const h = d.held.find((x) => x.request === id);
    assert.deepEqual([h.check, h.translation], [CAPTURE_REQUEST_CHECKS.CAPTURE_FETCH_FAILED.check,
                                                CAPTURE_REQUEST_CHECKS.CAPTURE_FETCH_FAILED.translation]);
    const look = w.log().find((l) => l.subject === r.address);
    assert.deepEqual([look.state, look.governed], ["LOOKED_INDETERMINATE", 0]);
  }
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM capture_requests`)).includes("token=abc"), false);
  assert.equal(JSON.stringify(w.log()).includes("token=abc"), false);
});

test("R19 every code this module writes to a row is catalogued in C-28, C-83 or C-108 (K181)", async () => {
  const w = world().scene();
  w.run("R-HALF", { claude: "" });
  w.ask({ run: "R-HALF", address: "https://a.example.org/1" });
  w.ask({ purpose: "x", address: "https://b.example.org/1" });
  w.ask({ address: "https://c.example.org/1" }); w.ask({ address: "https://c.example.org/2" });
  w.ask({ address: "https://d.example.org/1" }); w.capture.script.set("https://d.example.org/1", refused(401));
  w.ask({ address: "https://e.example.org/1" }); w.capture.script.set("https://e.example.org/1", refused(500));
  w.ask({ address: "https://f.example.org/1", render: true });
  w.capture.script.set("https://f.example.org/1", renderRefusal("RENDER_DEFERRED", "deferred"));
  await w.cr.drain({});
  w.tick(CAPTURE_REQUEST_TTL_MS + 1000);
  await w.cr.drain({});
  const codes = w.rows(`SELECT DISTINCT code FROM capture_requests WHERE code IS NOT NULL`).map((r) => r.code);
  assert.ok(codes.length >= 6);
  for (const c of codes)
    assert.ok(c in CAPTURE_REQUEST_CHECKS || c in RENDER_CAPTURE_CHECKS || c in CAPTURE_SOURCE_CHECKS, c);
});

test("R20 every non-terminal row past its expires, plain or render, is released expired: last code kept, detail saying what it was held under, appended LOOKED_INDETERMINATE (a render governed render-deferred), never fetched; at most one batch per tick", async () => {
  const w = world().scene();
  const plain = w.ask({ address: "https://p.example.org/1" }).request;
  const render = w.ask({ address: "https://r.example.org/1", render: true }).request;
  w.capture.script.set("https://p.example.org/1", refused(500));
  w.capture.script.set("https://r.example.org/1", renderRefusal("RENDER_DEFERRED", "deferred"));
  await w.cr.drain({});
  const never = w.ask({ address: "https://n.example.org/1" }).request;
  w.tick(CAPTURE_REQUEST_TTL_MS + 5000);
  const calls = w.capture.calls.length;
  const d = await w.cr.drain({});
  assert.equal(w.capture.calls.length, calls, "nothing fetched after expiry");
  const e = Object.fromEntries(d.expired.map((x) => [x.request, x]));
  assert.deepEqual([w.req(plain).state, w.req(plain).code], ["expired", "CAPTURE_FETCH_FAILED"]);
  assert.match(w.req(plain).detail, /held under C-28\.17 CAPTURE_FETCH_FAILED/);
  assert.equal(e[plain].render, null);
  assert.deepEqual([w.req(never).state, w.req(never).code], ["expired", null]);
  assert.match(w.req(never).detail, /never attempted/);
  assert.deepEqual([w.req(render).state, w.req(render).code], ["expired", "RENDER_DEFERRED"]);
  assert.deepEqual(e[render].render, { state: "expired", content: "undetermined" });
  assert.equal(e[render].check, "C-83.4");
  const looks = Object.fromEntries(w.log().filter((l) => /expired UNDETERMINED/.test(l.detail || "")).map((l) => [l.subject, l]));
  assert.deepEqual([looks["https://r.example.org/1"].governed, looks["https://r.example.org/1"].condition], [1, "render-deferred"]);
  assert.deepEqual([looks["https://p.example.org/1"].governed, looks["https://p.example.org/1"].condition], [0, null]);

  const x = world().scene();
  for (let i = 0; i < 14; i++) x.ask({ address: addr(i) });
  x.tick(CAPTURE_REQUEST_TTL_MS + 1);
  assert.equal((await x.cr.drain({})).expired.length, 10);
  assert.equal((await x.cr.drain({})).expired.length, 4);
  assert.equal(x.capture.calls.length, 0);
});

test("R21 a row left draining by a tick that did not finish goes back to requested on the next tick, or is released when past expires", async () => {
  const w = world().scene();
  const a = w.ask({ address: "https://a.example.org/1" }).request;
  const b = w.ask({ address: "https://b.example.org/1" }).request;
  w.st.sql.exec(`UPDATE capture_requests SET state='draining'`);
  w.st.sql.exec(`UPDATE capture_requests SET expires='2000-01-01T00:00:00Z' WHERE request=?`, b);
  const d = await w.cr.drain({});
  assert.equal(w.req(a).state, "captured");
  assert.equal(w.req(b).state, "expired");
  assert.deepEqual(d.expired.map((x) => x.request), [b]);
  assert.equal(w.rows(`SELECT * FROM capture_requests WHERE state='draining'`).length, 0);
});

test("R22 remaining is the number of requested rows after the tick", async () => {
  const w = world().scene();
  for (let i = 0; i < 12; i++) { w.ask({ address: addr(i) }); w.tick(1000); }
  w.ask({ address: "https://h0.example.org/second" });
  const d = await w.cr.drain({});
  assert.equal(d.remaining, w.rows(`SELECT * FROM capture_requests WHERE state='requested'`).length);
  assert.equal(d.remaining, 3);
});

test("R38 a new capture is promoted at collected, never higher, as an information bundle under the daemon's machine actor: origin sweep, the target inquiry its matched scope, the run and both principals its deeming actor", async () => {
  const w = world().scene();
  const id = w.ask().request;
  const d = await w.cr.drain({});
  const c = d.captured[0];
  assert.equal(c.promoted.ok, true, JSON.stringify(c.promoted));
  const bid = c.promoted.bundle_id;
  assert.match(bid, /^INFO-2026-\d{4}-requested$/);
  const b = w.row(`SELECT * FROM bundles WHERE bundle_id=?`, bid);
  assert.deepEqual([b.object_type, b.current_state, b.group_id], ["information", "collected", "test-group"]);
  const m = w.rows(`SELECT * FROM manifest WHERE bundle_id=?`, bid);
  assert.deepEqual(m.map((x) => [x.kind, x.author]), [["promotion", "token:daemon"]]);
  const prov = JSON.parse(w.record.readFile(bid, "data/provenance.json").text);
  assert.deepEqual(prov.documents[0].origin, { kind: "sweep", matched_sweep: "INQ-1",
    deeming_actor: "run R-1 under member:ann/tok1, paid by instance" });
  assert.equal(prov.documents[0].capture.sha256, w.req(id).capture_sha);
  const md = w.record.readFile(bid, "bundle.md").text;
  assert.match(md, /^current_state: collected$/m);
  assert.match(md, /^object_type: information$/m);
  assert.ok(md.includes(captureRequestAttribution(w.req(id)).statement), "the attribution is stated in the record");
  const primary = w.row(`SELECT sha256 FROM files WHERE bundle_id=? AND path=?`, bid, prov.documents[0].file);
  assert.equal(primary && primary.sha256, w.req(id).capture_sha, "the primary is in the bundle, under its register document's name");
  /* the row itself is unchanged by the promotion: captured, its digest, R24's fields */
  assert.deepEqual([w.req(id).state, w.req(id).code], ["captured", null]);
});

test("R38 a refused promotion changes nothing of the row and spends no id; the drain's answer relays the promotion's own refusal; a capture already held is not promoted again (R39)", async () => {
  const w = world({ group: null }).scene();
  const id = w.ask().request;
  const d = await w.cr.drain({});
  assert.equal(d.captured[0].promoted.ok, false);
  assert.equal(typeof d.captured[0].promoted.reason, "string");
  assert.deepEqual([w.req(id).state, typeof w.req(id).capture_sha], ["captured", "string"]);
  assert.equal(w.row(`SELECT count(*) AS n FROM manifest WHERE author='token:daemon'`).n, 0);
  assert.equal(w.record.allocId("INFO", "2026").id, world().record.allocId("INFO", "2026").id, "no id spent");
  const x = world().scene();
  x.ask();
  x.capture.script.set("https://example.org/a", (b, o) => filed("https://example.org/a", o, { existed: true }));
  const e = await x.cr.drain({});
  assert.deepEqual([e.captured[0].already_held, "promoted" in e.captured[0]], [true, false]);
  assert.equal(x.row(`SELECT count(*) AS n FROM manifest WHERE author='token:daemon'`).n, 0);
});

test("R39 bytes the record already held are recorded as that capture: the row points at its digest and the answer says it was already held", async () => {
  const w = world().scene();
  const id = w.ask().request;
  w.capture.script.set("https://example.org/a", { status: 200, body: { ok: true, existed: true,
    document: { capture: { sha256: sha("held"), grade: "B" } } } });
  const d = await w.cr.drain({});
  assert.equal(w.req(id).capture_sha, sha("held"));
  assert.equal(d.captured[0].already_held, true);
  assert.equal(d.captured[0].sha, sha("held"));
});

test("R40 a source's refusal states its reason (401/407 login, 402 paywall, 403/406 user-agent, 451 other: terminal C-108.1; any other answer held, other), on the row and in its reads, the source's answer in detail", async () => {
  const table = [[401, "login", true], [407, "login", true], [402, "paywall", true], [403, "user-agent", true],
                 [406, "user-agent", true], [451, "other", true], [404, "other", false], [429, "other", false],
                 [500, "other", false], [503, "other", false]];
  for (const [s, reason, terminal] of table) assert.deepEqual(sourceReasonOf(s), { reason, terminal }, String(s));
  const w = world().scene();
  const ids = table.map(([s], i) => {
    const address = `https://s${i}.example.org/x`;
    w.capture.script.set(address, refused(s));
    w.tick(1000);
    return w.ask({ address }).request;
  });
  const d = await w.cr.drain({});
  table.forEach(([s, reason, terminal], i) => {
    const r = w.req(ids[i]);
    assert.equal(r.source_reason, reason, String(s));
    assert.equal(r.state, terminal ? "refused" : "requested");
    assert.equal(r.code, terminal ? "CAPTURE_SOURCE_REFUSED" : "CAPTURE_FETCH_FAILED");
    assert.match(r.detail, new RegExp(`HTTP ${s}`));
    const x = [...d.refused, ...d.held].find((y) => y.request === ids[i]);
    assert.equal(x.source_reason, reason);
    if (terminal) assert.deepEqual([x.check, x.translation], [CAPTURE_SOURCE_CHECKS.CAPTURE_SOURCE_REFUSED.check,
                                                              CAPTURE_SOURCE_CHECKS.CAPTURE_SOURCE_REFUSED.translation]);
  });
  assert.equal(CAPTURE_SOURCE_CHECKS.CAPTURE_SOURCE_REFUSED.check, "C-108.1");
  const read = w.cr.captureRequests({ viewer: V("ann") }).requests;
  assert.deepEqual(read.map((r) => r.source_reason), table.map(([, reason]) => reason));
  /* our own refusals state no source reason */
  const own = world().scene();
  own.ask({ purpose: "x" });
  await own.cr.drain({});
  assert.equal(own.cr.captureRequests({ viewer: V("ann") }).requests[0].source_reason, null);
});

test("R41 the one credential capture-sources admits for the request's scope (its plane principal, target and host) rides to capture's arm; none admitted, none rides", async () => {
  const w = world().scene();
  w.st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, created, updated) VALUES ('ann', 'c', 'ann', 'member', 'active', 't', 't')`);
  const s = await w.creds.credentialSupply({ kind: "login", host: "paywalled.example.org", secret: "hunter2", scope: "member", by: "ann" });
  assert.equal(s.ok, true, JSON.stringify(s));
  w.ask({ address: "https://paywalled.example.org/doc" });
  w.ask({ address: "https://other.example.org/doc" });
  await w.cr.drain({});
  w.run("R-BOB", { plane: "member:bob/t" });
  w.ask({ run: "R-BOB", address: "https://paywalled.example.org/bob" }, { caller: "member:bob/t" });
  await w.cr.drain({});
  const by = Object.fromEntries(w.capture.calls.map((c) => [c.opts.captureRequest.locator, c.opts.captureRequest]));
  assert.deepEqual(by["https://paywalled.example.org/doc"].credential,
                   { credential: s.credential.credential, kind: "login", secret: "hunter2", supplied_by: "ann", scope: "member", project: null });
  assert.equal("credential" in by["https://other.example.org/doc"], false, "another host");
  assert.equal("credential" in (by["https://paywalled.example.org/bob"] || {}), false, "another member's run");
  /* never stored on the row or in the log */
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM capture_requests`)).includes("hunter2"), false);
  assert.equal(JSON.stringify(w.log()).includes("hunter2"), false);
});

test("R11 R15 op=capturerequestdrain drives the same drain", async () => {
  const w = world().scene();
  w.ask();
  const d = await captureRequestsOps(w.cr, new URL("http://x/capturerequestdrain"), { actor: "suite" }).capturerequestdrain();
  assert.deepEqual([d.configured, d.actor, d.captured.length], [true, "suite", 1]);
});

test("R20 R12 op=capturerequestdrain reads no clock from its body: a body's `now` two days ahead releases nothing early, and the tick is stamped by this module's clock (as R6's door reads no `at`)", async () => {
  const w = world().scene();
  const id = w.ask().request;
  const ahead = T0 + 2 * CAPTURE_REQUEST_TTL_MS;
  const d = await captureRequestsOps(w.cr, new URL("http://x/capturerequestdrain"), { now: ahead }).capturerequestdrain();
  assert.deepEqual([d.expired.length, d.captured.length, w.req(id).state], [0, 1, "captured"]);
  assert.equal(Date.parse(d.at), w.clock.ms, "the module's clock");
  /* Control: the in-process caller's stated instant is still the drain's clock (the scheduler's replay, a test) */
  const w2 = world().scene();
  const id2 = w2.ask().request;
  const d2 = await w2.cr.drain({ now: ahead });
  assert.deepEqual([d2.expired.map((e) => e.request), w2.req(id2).state], [[id2], "expired"]);
});

test("R39 a request for an address the record holds a capture of is fired with that capture's digest (heldSha, capture R61); the source's 304 records the held capture, already held, no new bundle; bytes identical to it are that capture", async () => {
  const w = world().scene();
  w.run("R-2");
  w.run("R-3");
  const first = w.ask().request;
  await w.cr.drain({});
  const held = w.req(first).capture_sha;
  assert.equal("heldSha" in w.capture.calls[0].opts.captureRequest, false, "nothing held before the first");
  /* the source answers that nothing changed: no document, no bytes */
  w.tick(60_000);
  const second = w.ask({ run: "R-2" }).request;
  w.capture.script.set("https://example.org/a", [{ status: 200, body: { ok: true, existed: true, unchanged: true,
    capture: { sha256: held }, basis: "304" } }]);
  const d = await w.cr.drain({});
  assert.equal(w.capture.calls.at(-1).opts.captureRequest.heldSha, held);
  assert.deepEqual([w.req(second).state, w.req(second).capture_sha], ["captured", held]);
  assert.deepEqual([d.captured[0].already_held, d.captured[0].sha, "promoted" in d.captured[0]], [true, held, false]);
  const look = w.log().at(-1);
  assert.deepEqual([look.state, look.result_ref], ["PRESENT", held]);
  /* the same bytes served again: `held`, recorded as that capture */
  w.tick(60_000);
  const third = w.ask({ run: "R-3" }).request;
  w.capture.script.set("https://example.org/a", [(b, o) => { const f = filed("https://example.org/a", o); f.body.held = true; f.body.existed = true; return f; }]);
  const e = await w.cr.drain({});
  assert.deepEqual([w.req(third).capture_sha, e.captured[0].already_held, "promoted" in e.captured[0]], [held, true, false]);
  assert.equal(w.row(`SELECT count(*) AS n FROM manifest WHERE author='token:daemon'`).n, 1, "one bundle, the first");
  /* a render request is another document: the plain capture is not its held one */
  w.ask({ run: "R-3", render: true });
  await w.cr.drain({});
  assert.equal("heldSha" in w.capture.calls.at(-1).opts.captureRequest, false);
});

test("R12 given the scheduler's rank, the tick reads at most ten times its batch oldest first, offers each as {kind: request, id, waitingSince, cadenceMs} and takes its batch in the rank's order; a rank that fails leaves oldest first", async () => {
  const w = world().scene();
  const ids = [];
  for (let i = 0; i < 15; i++) { ids.push(w.ask({ address: addr(i) }).request); w.tick(1000); }
  let offered = null, at = null;
  const reverse = (items, now) => { offered = items; at = now; return [...items].reverse(); };
  const d = await w.cr.drain({ limit: 1, rank: reverse });
  assert.equal(offered.length, 10, "ten times a batch of one");
  assert.deepEqual(offered.map((x) => x.id), ids.slice(0, 10));
  assert.deepEqual(Object.keys(offered[0]).sort(), ["cadenceMs", "id", "kind", "waitingSince"]);
  assert.deepEqual([offered[0].kind, offered[0].waitingSince, offered[0].cadenceMs], ["request", T0, 60_000]);
  assert.equal(at, T0 + 15_000);
  assert.deepEqual(d.captured.map((c) => c.request), [ids[9]], "the rank's first");
  /* the full batch in the rank's order; an item the rank drops follows oldest first */
  const e = await w.cr.drain({ rank: (items) => items.filter((x) => x.id === ids[5]) });
  assert.deepEqual(e.captured.map((c) => c.request), [ids[5], ids[0], ids[1], ids[2], ids[3], ids[4], ids[6], ids[7], ids[8], ids[10]]);
  for (const bad of [() => { throw new Error("x"); }, () => null, () => "no"]) {
    const x = world().scene();
    const xs = [];
    for (let i = 0; i < 3; i++) { xs.push(x.ask({ address: addr(i) }).request); x.tick(1000); }
    assert.deepEqual((await x.cr.drain({ rank: bad })).captured.map((c) => c.request), xs);
  }
  /* what is offered lets the scheduler's rank put work waiting longer than one cadence first (its R10): one request
     waiting two cadences, one waiting none */
  const y = world().scene();
  y.ask({ address: addr(1) });
  y.tick(120_000);
  y.ask({ address: addr(2) });
  let overdue = null;
  await y.cr.drain({ rank: (items, now) => { overdue = items.map((x) => now - x.waitingSince > x.cadenceMs); return items; } });
  assert.deepEqual(overdue, [true, false]);
});
