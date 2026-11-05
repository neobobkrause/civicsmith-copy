/* capture-requests: the reads (R23–R29), purge (R35) and the registrations (R28 with observation-log, R29 with
   ai-runs' wait source, K182). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, T0, refused, renderRefusal, sha, cursor } from "./fixture.mjs";
import { captureRequestAttribution, captureRequestsOps, CAPTURE_REQUEST_TTL_MS, CAPTURE_REQUEST_READ_MAX,
         CAPTURE_REQUEST_WAIT_BATCH, CAPTURE_SOURCE_CHECKS, CAPTURE_REQUEST_CHECKS } from "../../../src/capture-requests/index.mjs";
import { RENDER_CAPTURE_CHECKS } from "../../../src/acquisition/index.mjs";

/** A scene with a hidden project whose inquiry only `inner` sees (membership R43: a project is seen by its
 *  participants), and requests under both. */
function fenced() {
  const w = world().scene();
  w.project("PROJ-H");
  w.participant("PROJ-H", "inner");
  w.run("R-2");
  w.ask({ address: "https://a.example.org/1" }); w.tick(1000);
  w.ask({ address: "https://b.example.org/1", lead: "INQ-2" }); w.tick(1000);
  w.ask({ run: "R-2", address: "https://c.example.org/1" }); w.tick(1000);
  /* a request under the hidden project's id as its target: written directly, as a row the door once admitted */
  w.st.sql.exec(`INSERT INTO capture_requests (request, run, target, address, host, purpose, ua_mode, principal_plane,
                 principal_claude, state, attempts, requested_at, updated, expires)
                 VALUES ('CR-HIDDEN', 'R-1', 'PROJ-H', 'https://h.example.org/1', 'h.example.org', 'investigate', 'civicos',
                 'member:ann/tok1', 'instance', 'requested', 0, '2026-09-28T01:00:09Z', 't', '2026-09-29T01:00:09Z')`);
  return w;
}

test("R23 rows are those whose target the viewer can see, filtered by run, target and state, oldest first; an absent or unrecognised stamp sees none; nothing says how many were withheld", () => {
  const w = fenced();
  const all = (v, f = {}) => w.cr.captureRequests({ viewer: v, ...f });
  assert.equal(all(V("ann")).count, 3);
  assert.equal(all(V("inner")).count, 4);
  assert.equal(all(MACHINE).count, 4);
  for (const v of [null, undefined, "", "nobody", "token:x"]) assert.deepEqual(all(v).requests, []);
  assert.deepEqual(all(V("ann"), { run: "R-2" }).requests.map((r) => r.address), ["https://c.example.org/1"]);
  assert.deepEqual(all(V("inner"), { target: "PROJ-H" }).requests.map((r) => r.request), ["CR-HIDDEN"]);
  assert.deepEqual(all(V("ann"), { target: "PROJ-H" }).requests, []);
  assert.equal(all(V("ann"), { state: "captured" }).count, 0);
  const order = all(V("ann")).requests.map((r) => r.address);
  assert.deepEqual(order, ["https://a.example.org/1", "https://b.example.org/1", "https://c.example.org/1"]);
  assert.equal(JSON.stringify(all(V("ann"))).includes("withheld"), false);
  assert.deepEqual(Object.keys(all(V("ann"))).sort(), ["count", "limit", "requests", "truncated"]);
});

test("R23 limit defaults to 200 and is clamped to 1–1,000; limit answers the bound applied, count the rows, truncated whether more matched", () => {
  const w = world().scene();
  for (let i = 0; i < 5; i++) w.ask({ address: `https://x${i}.example.org/` });
  const read = (limit) => w.cr.captureRequests({ viewer: V("ann"), limit });
  assert.deepEqual([read(undefined).limit, read(null).limit, read("junk").limit], [200, 200, 200]);
  assert.deepEqual([read(0).limit, read(-3).limit], [200, 200]);
  assert.deepEqual([read(2).limit, read(2).count, read(2).truncated], [2, 2, true]);
  assert.deepEqual([read(5).count, read(5).truncated], [5, false]);
  assert.equal(read(5000).limit, CAPTURE_REQUEST_READ_MAX);
  /* the op reads its stamps and filters from the query string */
  const url = new URL("http://x/capturerequests?viewer=member%3Aann&limit=3");
  const op = captureRequestsOps(w.cr, url, { viewer: "class:admin" }).capturerequests();
  assert.deepEqual([op.limit, op.count, op.truncated], [3, 3, true]);
});

test("R24 each row answers the request's fields less the principals, render as a boolean, and R10's attribution (its refusal when a principal is missing)", async () => {
  const w = world().scene();
  w.run("R-HALF", { claude: "" });
  const id = w.ask({ lead: "INQ-2", render: true }).request;
  w.ask({ run: "R-HALF", address: "https://half.example.org/" });
  const rows = w.cr.captureRequests({ viewer: V("ann") }).requests;
  const r = rows.find((x) => x.request === id);
  assert.deepEqual(Object.keys(r).sort(), ["address", "attempts", "attribution", "capture_sha", "captured_at", "code",
    "detail", "expires", "host", "lead_inquiry", "purpose", "render", "render_deferral", "request", "requested_at",
    "run", "run_woken_at", "source_reason", "state", "sweep", "target", "ua_mode", "updated", "co_archive", "step",
    /* R60, R61, R62 (T53) */
    "idem", "produced_by", "needs_person", "asked_at", "brought_by", "brought_at"].sort());
  assert.equal(r.sweep, null, "an ordinary request names no sweep (R45)");
  assert.equal(r.step, null, "a request made for no step names none (R55)");
  assert.equal(r.render, true);
  assert.equal(r.lead_inquiry, "INQ-2");
  assert.deepEqual(r.attribution, captureRequestAttribution(w.req(id)));
  const half = rows.find((x) => x.address === "https://half.example.org/");
  assert.deepEqual(half.attribution, { ok: false, code: "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", plane: "member:ann/tok1", claude: null });
});

test("R25 render_deferral: for a render row expired, or requested with a code, {state, content: undetermined, code, check, translation} from the family that minted the code; otherwise null", async () => {
  const w = world().scene();
  const held = w.ask({ address: "https://r.example.org/held", render: true }).request;
  w.capture.script.set("https://r.example.org/held", renderRefusal("RENDER_DEFERRED", "deferred"));
  w.tick(1000);
  w.ask({ address: "https://p.example.org/first" });
  w.tick(1000);
  const paced = w.ask({ address: "https://p.example.org/paced", render: true }).request;
  const fresh = w.ask({ address: "https://q.example.org/fresh", render: true }).request;
  const plain = w.ask({ address: "https://q.example.org/plain" }).request;
  w.st.sql.exec(`UPDATE capture_requests SET requested_at='2099-01-01T00:00:00Z' WHERE request IN (?, ?)`, fresh, plain);
  await w.cr.drain({ limit: 3 });
  const read = () => Object.fromEntries(w.cr.captureRequests({ viewer: V("ann") }).requests.map((r) => [r.request, r]));
  let R = read();
  assert.deepEqual(R[held].render_deferral, { state: "deferred", content: "undetermined", code: "RENDER_DEFERRED",
    check: RENDER_CAPTURE_CHECKS.RENDER_DEFERRED.check, translation: RENDER_CAPTURE_CHECKS.RENDER_DEFERRED.translation });
  assert.deepEqual(R[paced].render_deferral, { state: "deferred", content: "undetermined", code: "CAPTURE_CONDUCT_TICK_SPENT",
    check: "C-28.10", translation: CAPTURE_REQUEST_CHECKS.CAPTURE_CONDUCT_TICK_SPENT.translation });
  assert.equal(R[fresh].render_deferral, null, "a render not yet attempted");
  assert.equal(R[plain].render_deferral, null, "a plain request");
  w.tick(CAPTURE_REQUEST_TTL_MS + 5000);
  await w.cr.drain({});
  R = read();
  assert.equal(R[held].render_deferral.state, "expired");
  assert.equal(R[held].render_deferral.check, "C-83.4");
  /* a code no family catalogues answers null check and translation */
  // fixtures-generic: NOT_A_CODE
  w.st.sql.exec(`UPDATE capture_requests SET state='requested', code='NOT_A_CODE' WHERE request=?`, held);
  assert.deepEqual(read()[held].render_deferral, { state: "deferred", content: "undetermined", code: "NOT_A_CODE", check: null, translation: null });
});

test("R26 completed, leads and rendersHeld answer captured rows by target, captured leads by lead inquiry, and held or expired renders by target, each bounded as R23 and saying when cut", async () => {
  const w = fenced();
  w.st.sql.exec(`UPDATE capture_requests SET state='captured', captured_at=requested_at`);
  w.st.sql.exec(`UPDATE capture_requests SET lead_inquiry='PROJ-H' WHERE request='CR-HIDDEN'`);
  const addrs = (x) => x.requests.map((r) => r.address);
  assert.deepEqual(addrs(w.cr.completed({ viewer: V("ann") })), ["https://a.example.org/1", "https://b.example.org/1", "https://c.example.org/1"]);
  assert.equal(w.cr.completed({ viewer: V("inner") }).count, 4);
  assert.deepEqual(addrs(w.cr.leads({ viewer: V("ann") })), ["https://b.example.org/1"]);
  assert.deepEqual(addrs(w.cr.leads({ viewer: V("inner") })), ["https://b.example.org/1", "https://h.example.org/1"]);
  const cut = w.cr.completed({ viewer: V("ann"), limit: 2 });
  assert.deepEqual([cut.count, cut.limit, cut.truncated], [2, 2, true]);
  for (const v of [null, "nobody"]) assert.equal(w.cr.completed({ viewer: v }).count, 0);

  const x = world().scene();
  const r1 = x.ask({ address: "https://r.example.org/1", render: true }).request;
  x.tick(1000);
  x.ask({ address: "https://r2.example.org/1", render: true });
  x.capture.script.set("https://r.example.org/1", renderRefusal("RENDER_NO_RENDERER"));
  x.capture.script.set("https://r2.example.org/1", { status: 200, body: { ok: true, document: { capture: { sha256: sha("r2") } } } });
  await x.cr.drain({});
  const held = x.cr.rendersHeld({ viewer: V("ann") });
  assert.deepEqual(held.requests.map((r) => r.request), [r1]);
  assert.equal(held.requests[0].render_deferral.code, "RENDER_NO_RENDERER");
});

test("R27 terminal rows do not accumulate in what R26 walks: every walk is bounded by its limit and reads at most one row over it", async () => {
  const w = world().scene();
  for (let i = 0; i < 40; i++)
    w.st.sql.exec(`INSERT INTO capture_requests (request, run, target, address, host, purpose, ua_mode, principal_plane,
                   principal_claude, state, attempts, requested_at, updated, expires, captured_at, lead_inquiry, render, code)
                   VALUES (?, 'R-1', 'INQ-1', ?, 'e.org', 'investigate', 'civicos', 'p', 'c', ?, 1, ?, ?, 'x', ?, 'INQ-2', 1, ?)`,
                  `CR-${String(i).padStart(3, "0")}`, `https://e.org/${i}`, i % 2 ? "captured" : "expired",
                  `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`, `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
                  `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`, "RENDER_DEFERRED");
  const seen = [];
  const exec = w.st.sql.exec.bind(w.st.sql);
  w.st.sql.exec = (q, ...a) => {
    const out = exec(q, ...a).toArray();
    if (/FROM capture_requests cr/.test(q)) seen.push(out.length);
    return cursor(out);
  };
  for (const read of [w.cr.completed, w.cr.leads, w.cr.rendersHeld]) {
    seen.length = 0;
    const x = read.call(w.cr, { viewer: V("ann"), limit: 5 });
    assert.deepEqual([x.count, x.truncated], [5, true]);
    assert.deepEqual(seen, [6], "one statement, bounded at the limit plus one");
  }
  /* nothing is deleted by reading or draining (K181 (6)) */
  await w.cr.drain({});
  assert.equal(w.row(`SELECT count(*) AS n FROM capture_requests`).n, 40);
});

test("R28 bundlesOf answers a request's target and lead inquiry (either absent when not set), or null for an unknown id; observation-log's sweep authority resolves through it", async () => {
  const w = world().scene();
  const a = w.ask({ address: "https://a.example.org/", lead: "INQ-2" }).request;
  const b = w.ask({ address: "https://b.example.org/" }).request;
  assert.deepEqual(w.cr.bundlesOf(a), { target: "INQ-1", lead_inquiry: "INQ-2" });
  assert.deepEqual(w.cr.bundlesOf(b), { target: "INQ-1" });
  assert.equal(w.cr.bundlesOf("CR-NONE"), null);
  assert.equal(w.cr.bundlesOf(""), null);
  /* the fence: a sweep row naming a request is visible exactly when its target and lead are */
  w.project("PROJ-H");
  w.participant("PROJ-H", "inner");
  const hidden = w.ask({ address: "https://c.example.org/", lead: "INQ-2" }).request;
  w.st.sql.exec(`UPDATE capture_requests SET target='PROJ-H' WHERE request=?`, hidden);
  const row = (authority) => ({ actor_class: "plane", actor: null, authority_kind: "sweep", authority, level: "document",
    subject_kind: "address", subject: "https://x/", state: "LOOKED_ABSENT", governed: false, condition: null, bound: null,
    result_kind: null, result_ref: null, detail: null });
  assert.equal(w.obs.rowVisible(row(a), V("ann")), true);
  assert.equal(w.obs.rowVisible(row(hidden), V("ann")), false);
  assert.equal(w.obs.rowVisible(row(hidden), V("inner")), true);
});

test("R29 waits answers a run's outstanding requests (requested or draining, unexpired) and its completions not yet told it (captured, refused and expired with run_woken_at null), each bounded by 25; markWoken stamps them", async () => {
  const w = world().scene();
  const out = w.ask({ address: "https://o.example.org/" }).request;
  const cap = w.ask({ address: "https://c.example.org/" }).request;
  const ref = w.ask({ address: "https://r.example.org/" }).request;
  const exp = w.ask({ address: "https://e.example.org/" }).request;
  w.st.sql.exec(`UPDATE capture_requests SET state='captured' WHERE request=?`, cap);
  w.st.sql.exec(`UPDATE capture_requests SET state='refused' WHERE request=?`, ref);
  w.st.sql.exec(`UPDATE capture_requests SET state='expired' WHERE request=?`, exp);
  let x = w.cr.waits({ run: "R-1" });
  assert.deepEqual(x.outstanding.map((r) => r.request), [out]);
  assert.deepEqual(x.completions.map((r) => r.request).sort(), [cap, ref, exp].sort(), "expired is a completion (D-583)");
  assert.equal(x.completions[0].source_reason !== undefined, true, "each row as R24 answers it");
  const m = w.cr.markWoken({ requests: [cap, exp, out, "CR-NONE"], at: "2026-09-28T02:00:00Z" });
  assert.equal(m.marked, 2, "an outstanding or unknown request is never stamped");
  assert.equal(w.req(cap).run_woken_at, "2026-09-28T02:00:00Z");
  assert.equal(w.cr.markWoken({ requests: [cap] }).marked, 0, "once");
  x = w.cr.waits({ run: "R-1" });
  assert.deepEqual(x.completions.map((r) => r.request), [ref]);
  /* bounded by its requests' own expiry, and by 25 */
  w.tick(CAPTURE_REQUEST_TTL_MS + 1000);
  assert.deepEqual(w.cr.waits({ run: "R-1" }).outstanding, []);
  const y = world().scene();
  for (let i = 0; i < 30; i++) y.ask({ address: `https://h${i}.example.org/` });
  const z = y.cr.waits({ run: "R-1" });
  assert.deepEqual([z.outstanding.length, z.outstanding_truncated], [CAPTURE_REQUEST_WAIT_BATCH, true]);
});

test("R29 the wait source registered with ai-runs (its R41, K182): tickMs, holds, woken, completions and markWoken, synchronous, over running runs only, holding nothing while unconfigured", async () => {
  const w = world().scene();
  assert.deepEqual(w.waitRegs.map((r) => r.module), ["capture-requests"]);
  const src = w.waitRegs[0].source;
  w.run("R-DONE", { status: "finished" });
  w.ask({ address: "https://a.example.org/" }); w.ask({ address: "https://b.example.org/" });
  w.ask({ run: "R-DONE", address: "https://c.example.org/" });
  const iso = new Date(T0).toISOString().replace(/\.\d+Z$/, "Z");
  assert.equal(src.tickMs(), w.cr.drainIntervalMs());
  assert.deepEqual(src.holds(iso, 25), [{ run: "R-1", outstanding: 2 }]);
  assert.deepEqual(src.woken(25), []);
  w.st.sql.exec(`UPDATE capture_requests SET state='captured'`);
  assert.deepEqual(src.holds(iso, 25), []);
  assert.deepEqual(src.woken(25), ["R-1"], "a run that is not running is never woken");
  const done = src.completions("R-1", 1);
  assert.equal(done.length, 1);
  assert.deepEqual(Object.keys(done[0]).sort(), ["request", "state"]);
  assert.equal(src.markWoken(src.completions("R-1", 25).map((c) => c.request), iso), 2);
  assert.deepEqual(src.woken(25), []);
  for (const f of ["tickMs", "holds", "woken", "completions", "markWoken"])
    assert.equal(src[f]("x", 1) instanceof Promise, false, `${f} is synchronous`);
  const cold = world({ env: {} }).scene();
  cold.ask();
  assert.deepEqual(cold.waitRegs[0].source.holds(iso, 25), [], "nothing is held for what will never complete");
});

test("R35 the table is declared to record-core's purge keyed by target: a bundle's purge deletes its requests and clears a lead naming it, a whole-store purge clears the table, and the census counts it", async () => {
  const w = world().scene();
  const under1 = w.ask({ address: "https://a.example.org/" }).request;
  w.run("R-2", { context: "INQ-2" });
  const under2 = w.ask({ run: "R-2", target: "INQ-2", address: "https://b.example.org/" }).request;
  w.bundle("INQ-3");
  const lead3 = w.ask({ run: "R-2", target: "INQ-2", address: "https://c.example.org/", lead: "INQ-3" }).request;
  /* the census: record-core's counts report the table, every row for a direct internal call; a caller's hidden
     bundles drop the rows whose lead names one */
  const figure = (hid) => w.record.counts(hid).captureRequests;
  assert.equal(figure(null), 3);
  assert.equal(figure({ sql: "(?)", args: ["INQ-3"] }), 2);
  assert.equal(figure({ sql: "(?)", args: ["INQ-1"] }), 3);
  const p = w.record.purge({ bundleId: "INQ-1" });
  assert.equal(p.removed.capture_requests, 1);
  assert.equal(w.req(under1), null);
  assert.ok(w.req(under2));
  assert.equal(figure(null), 2);
  /* a bundle's purge clears a lead naming it, on a row that stays (record-core R46's `clears`) */
  assert.equal(w.req(lead3).lead_inquiry, "INQ-3");
  const q = w.record.purge({ bundleId: "INQ-3" });
  assert.equal(q.removed.capture_requests, 0, "a lead is a pointer: its row is not the bundle's");
  assert.ok(w.req(lead3), "the row stays; only its pointer goes");
  assert.equal(w.req(lead3).lead_inquiry, null);
  assert.equal(w.req(lead3).target, "INQ-2");
  w.record.purge({});
  assert.equal(w.row(`SELECT count(*) AS n FROM capture_requests`).n, 0);
  assert.equal(figure(null), 0);
  /* declared once, by this module: the table and the figure */
  assert.equal(w.record.declarePurge("x", [{ name: "capture_requests", keys: ["target"] }]).reason, "TABLE_DECLARED");
  assert.equal(w.record.registerCounts("x", ["captureRequests"], () => ({})).code, "COUNTS_DECLARED");
});

test("R43 requestById answers one request as R24 answers a row, with R25's render_deferral, when its target is one the viewer can see; null for a blank, unknown or unseen id alike; it writes nothing and never throws", async () => {
  const w = fenced();
  const one = w.cr.captureRequests({ viewer: V("ann") }).requests[0];
  assert.deepEqual(w.cr.requestById({ request: one.request, viewer: V("ann") }), one);
  assert.deepEqual(w.cr.requestById({ request: "CR-HIDDEN", viewer: V("inner") }),
                   w.cr.captureRequests({ viewer: V("inner"), target: "PROJ-H" }).requests[0]);
  for (const [request, viewer] of [["CR-HIDDEN", V("ann")], ["CR-NONE", V("ann")], ["", V("ann")], [null, V("ann")],
                                   ["  ", V("ann")], [one.request, null], [one.request, "nobody"]])
    assert.equal(w.cr.requestById({ request, viewer }), null, `${request} ${viewer}`);
  /* a held render answers its deferral */
  const r = w.ask({ address: "https://r.example.org/1", render: true }).request;
  w.capture.script.set("https://r.example.org/1", renderRefusal("RENDER_DEFERRED", "deferred"));
  await w.cr.drain({});
  assert.equal(w.cr.requestById({ request: r, viewer: V("ann") }).render_deferral.code, "RENDER_DEFERRED");
  const before = w.rows(`SELECT * FROM capture_requests ORDER BY request`);
  for (const junk of [undefined, null, 5, { request: { toString: null } }, { request: 7, viewer: 3 }])
    assert.doesNotThrow(() => w.cr.requestById(junk));
  assert.deepEqual(w.rows(`SELECT * FROM capture_requests ORDER BY request`), before);
});

test("R29 the wait source's walks are bounded: holds and woken read in pages and at most CAPTURE_REQUEST_READ_MAX rows per call, however many finished runs' rows the table holds (N188 (1))", () => {
  const w = world().scene();
  const src = w.waitRegs[0].source;
  for (let i = 0; i < 1200; i++)
    w.st.sql.exec(`INSERT INTO capture_requests (request, run, target, address, host, purpose, ua_mode, principal_plane,
                   principal_claude, state, attempts, requested_at, updated, expires)
                   VALUES (?, ?, 'INQ-1', 'https://e.org/', 'e.org', 'investigate', 'civicos', 'p', 'c', ?, 1, 't', 't', '2099-01-01T00:00:00Z')`,
                  `CR-${i}`, `R-GONE-${String(i).padStart(5, "0")}`, i % 2 ? "captured" : "requested");
  w.run("R-A"); w.run("R-ZZ");
  w.ask({ run: "R-A", address: "https://a.example.org/" });
  const read = [];
  const exec = w.st.sql.exec.bind(w.st.sql);
  w.st.sql.exec = (q, ...a) => {
    const out = exec(q, ...a).toArray();
    if (/FROM capture_requests/.test(q)) read.push(out.length);
    return cursor(out);
  };
  const iso = new Date(T0).toISOString().replace(/\.\d+Z$/, "Z");
  assert.deepEqual(src.holds(iso, 25), [{ run: "R-A", outstanding: 1 }], "a running run before the bound is found");
  const total = () => read.reduce((a, b) => a + b, 0);
  for (const f of [() => src.holds(iso, 1000), () => src.woken(1000)]) {
    read.length = 0;
    f();
    assert.ok(total() <= CAPTURE_REQUEST_READ_MAX + CAPTURE_REQUEST_WAIT_BATCH, `read ${total()}`);
    assert.ok(read.every((n) => n <= CAPTURE_REQUEST_WAIT_BATCH), "every statement bounded by a page");
  }
});
