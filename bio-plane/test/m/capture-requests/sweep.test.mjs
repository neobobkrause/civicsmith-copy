/* capture-requests: a run's request naming a sweep (R45, the AI's "relevant nearby" arm; Intake Doctrine §4), driven at
   `captureRequest`, `registerSweepScope` and `drain`. `link-sweep` registers the real scope check in its own job
   (its R12; K1099); here a stand-in answers as that check does, from a table of sweeps the test writes, and records each ask. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { CAPTURE_REQUEST_CHECKS, captureRequestAttribution, captureRequestsOps } from "../../../src/capture-requests/index.mjs";

const ROW = CAPTURE_REQUEST_CHECKS.CAPTURE_SWEEP_OUT_OF_SCOPE;
const DEEMING = "run R-1 under member:ann/tok1, paid by instance";

/** The stand-in scope check: a sweep is `{ratified, held, sources}`; an address is in scope when it equals a source or
 *  continues one at a `/` (link-sweep R1's rule, in its plainest form). */
function scopeCheck(sweeps) {
  const asked = [];
  const inScope = (a, p) => a === p || (a.startsWith(p) && (p.endsWith("/") || a[p.length] === "/"));
  // fixtures-contract: link-sweep sweep-scope
  const fn = ({ sweep, locators, run, target }) => {
    asked.push({ sweep, locators, run, target });
    const s = sweeps[sweep];
    if (!s) return { ok: false, reason: "unknown" };
    if (!s.ratified) return { ok: false, reason: "unratified" };
    if (s.held) return { ok: false, reason: "held", detail: "backlog 40 of 40" };
    if (!locators.every((l) => s.sources.some((p) => inScope(l, p)))) return { ok: false, reason: "out-of-scope" };
    return { ok: true, scope: [...s.sources] };
  };
  return { fn, asked };
}

const SWEEPS = {
  "INQ-1#agendas": { ratified: true, held: false, sources: ["https://council.example.org/agendas"] },
  "INQ-1#draft": { ratified: false, held: false, sources: ["https://council.example.org/"] },
  "INQ-1#full": { ratified: true, held: true, sources: ["https://council.example.org/"] },
};

/** A world with the stand-in registered (unless `register` is false), and the run's ask naming a sweep. */
function sweepWorld({ register = true, sweeps = SWEEPS } = {}) {
  const w = world().scene();
  const check = scopeCheck(sweeps);
  if (register) assert.deepEqual(w.cr.registerSweepScope("link-sweep", check.fn), { ok: true, module: "link-sweep" });
  return { w, check };
}
const daemonBundles = (w) => w.row(`SELECT count(*) AS n FROM manifest WHERE author='token:daemon'`).n;

/** R45's refusal, on the row, in the drain's answer and in the log, with nothing fetched or filed for it. */
function refusedOutOfScope(w, d, id, why) {
  const r = w.req(id);
  assert.deepEqual([r.state, r.code, r.capture_sha, r.attempts], ["refused", "CAPTURE_SWEEP_OUT_OF_SCOPE", null, 1], why);
  assert.match(r.detail, /nothing was filed under this one/, why);
  const x = d.refused.find((y) => y.request === id);
  assert.deepEqual([x.code, x.check, x.translation, x.source_reason], ["CAPTURE_SWEEP_OUT_OF_SCOPE", "C-28.19", ROW.translation, null], why);
  const look = w.log().filter((l) => l.subject === r.address).at(-1);
  assert.deepEqual([look.state, look.governed, look.condition], ["LOOKED_INDETERMINATE", 0, null], why);
  assert.match(look.detail, /^C-28\.19 CAPTURE_SWEEP_OUT_OF_SCOPE: /, why);
}

test("R45 a request naming a ratified, unheld sweep whose scope holds its address is filed under that sweep: matched_sweep the sweep, the run its deeming actor, the sweep's scope riding the fetch; the check is asked with every locator", async () => {
  const { w, check } = sweepWorld();
  const a = w.ask({ address: "https://council.example.org/agendas/2026-09.pdf", sweep: " INQ-1#agendas " });
  assert.deepEqual([a.ok, a.sweep, w.req(a.request).sweep], [true, "INQ-1#agendas", "INQ-1#agendas"]);
  assert.deepEqual(check.asked, [], "the door asks nothing (R9): the sweep is judged at the drain");
  const d = await w.cr.drain({});
  assert.deepEqual(check.asked, [{ sweep: "INQ-1#agendas", locators: ["https://council.example.org/agendas/2026-09.pdf"],
                                   run: "R-1", target: "INQ-1" }]);
  assert.equal(w.capture.calls.length, 1);
  assert.deepEqual(w.capture.calls[0].opts.captureRequest, {
    locator: "https://council.example.org/agendas/2026-09.pdf", purpose: "investigate", agent: null, render: false,
    origin: { kind: "sweep", matched_sweep: "INQ-1#agendas", deeming_actor: DEEMING },
    scope: ["https://council.example.org/agendas"] });
  const r = w.req(a.request);
  assert.deepEqual([r.state, r.code, r.detail], ["captured", null, captureRequestAttribution(r).statement]);
  const c = d.captured[0];
  assert.equal(c.promoted.ok, true, JSON.stringify(c.promoted));
  const prov = JSON.parse(w.record.readFile(c.promoted.bundle_id, "data/provenance.json").text);
  assert.deepEqual(prov.documents[0].origin, { kind: "sweep", matched_sweep: "INQ-1#agendas", deeming_actor: DEEMING });
  assert.match(w.record.readFile(c.promoted.bundle_id, "bundle.md").text, /filed under the sweep INQ-1#agendas/);
  assert.match(w.record.readFile(c.promoted.bundle_id, "bundle.md").text, /^current_state: collected$/m);
  /* every read answers the sweep the request named */
  assert.equal(w.cr.captureRequests({ viewer: V("ann") }).requests[0].sweep, "INQ-1#agendas");
  assert.equal(w.cr.requestById({ request: a.request, viewer: V("ann") }).sweep, "INQ-1#agendas");
  /* the standing row answers its sweep too (R6) */
  assert.equal(w.ask({ address: "https://council.example.org/agendas/2026-09.pdf" }).sweep, "INQ-1#agendas");
});

test("R45 a held sweep, an unratified one, an unknown one and an address out of scope are each refused CAPTURE_SWEEP_OUT_OF_SCOPE (C-28.19), terminal, with nothing fetched or filed", async () => {
  const { w, check } = sweepWorld();
  const ids = {
    held: w.ask({ address: "https://council.example.org/minutes/1", sweep: "INQ-1#full" }).request,
    unratified: w.ask({ address: "https://council.example.org/minutes/2", sweep: "INQ-1#draft" }).request,
    unknown: w.ask({ address: "https://council.example.org/agendas/3", sweep: "INQ-1#nothing" }).request,
    out: w.ask({ address: "https://council.example.org/agendas-old/4", sweep: "INQ-1#agendas" }).request,
    host: w.ask({ address: "https://elsewhere.example.org/agendas/5", sweep: "INQ-1#agendas" }).request,
  };
  const d = await w.cr.drain({});
  for (const [why, id] of Object.entries(ids)) refusedOutOfScope(w, d, id, why);
  assert.match(w.req(ids.held).detail, /INQ-1#full is held \(backlog 40 of 40\)/);
  assert.match(w.req(ids.unratified).detail, /INQ-1#draft is not ratified/);
  assert.ok(w.req(ids.unknown).detail.includes(localize("capture-requests.index.is_not_a_sweep_your_team", "is not a sweep your team's Civicsmith holds")));
  assert.match(w.req(ids.out).detail, /INQ-1#agendas does not reach this address/);
  assert.equal(check.asked.length, 5);
  assert.equal(w.capture.calls.length, 0, "nothing was fetched");
  assert.equal(daemonBundles(w), 0, "nothing was filed");
  assert.deepEqual([d.captured, d.held], [[], []]);
  /* terminal: a later tick does not judge them again */
  await w.cr.drain({});
  assert.equal(check.asked.length, 5);
});

test("R45 with no scope check registered, a request naming a sweep is refused and nothing is fetched; a request naming none is drained as before, its origin R38's", async () => {
  const { w } = sweepWorld({ register: false });
  const named = w.ask({ address: "https://council.example.org/agendas/1", sweep: "INQ-1#agendas" }).request;
  const plain = w.ask({ address: "https://council.example.org/agendas/2" }).request;
  const d = await w.cr.drain({});
  refusedOutOfScope(w, d, named, "unregistered");
  assert.match(w.req(named).detail, /no scope check is registered/);
  assert.equal(w.req(plain).state, "captured");
  assert.deepEqual(w.capture.calls.map((c) => [c.opts.captureRequest.locator, c.opts.captureRequest.origin, "scope" in c.opts.captureRequest]),
                   [["https://council.example.org/agendas/2", { matched_sweep: "INQ-1", deeming_actor: DEEMING }, false]]);
});

test("R45 a request naming no sweep never asks the check; one naming a value that is not a sweep's name is refused without asking it, and a value that is not text is recorded as sent, never dropped", async () => {
  const { w, check } = sweepWorld();
  const none = [w.ask({ address: "https://a1.example.org/x" }), w.ask({ address: "https://a2.example.org/x", sweep: null }),
                w.ask({ address: "https://a3.example.org/x", sweep: "" }), w.ask({ address: "https://a4.example.org/x", sweep: "   " })];
  assert.deepEqual(none.map((a) => [a.sweep, w.req(a.request).sweep]), [[null, null], [null, null], [null, null], [null, null]]);
  const bad = {};
  for (const [k, sweep] of [["nohash", "agendas"], ["noid", "INQ-1#"], ["upper", "INQ-1#Agendas"], ["space", "INQ 1#agendas"],
                            ["two", "INQ-1#a#b"], ["long", `INQ-1#${"a".repeat(41)}`], ["object", { id: "agendas" }],
                            ["number", 7], ["array", ["INQ-1#agendas"]]])
    bad[k] = w.ask({ address: `https://b.example.org/${k}`, sweep });
  assert.deepEqual([bad.object.sweep, bad.number.sweep, bad.array.sweep], ['{"id":"agendas"}', "7", '["INQ-1#agendas"]'],
    "recorded as what was sent");
  /* the batch is ten; drain until every row is judged */
  const d1 = await w.cr.drain({}), d2 = await w.cr.drain({});
  const refused = [...d1.refused, ...d2.refused];
  for (const [k, a] of Object.entries(bad)) {
    refusedOutOfScope(w, { refused }, a.request, k);
    assert.match(w.req(a.request).detail, /is not a sweep's name/, k);
  }
  assert.deepEqual(check.asked, [], "a name of no sweep's shape never reaches the check");
  assert.deepEqual(none.map((a) => w.req(a.request).state), ["captured", "captured", "captured", "captured"]);
});

test("R45 a check that throws, rejects, or admits without a list of in-scope prefixes refuses the request; one answering a promise is awaited", async () => {
  const answers = [() => { throw new Error("boom"); }, async () => { throw new Error("late"); }, () => ({ ok: true }),
                   () => ({ ok: true, scope: [] }), () => ({ ok: true, scope: ["https://a.example.org/", 7] }),
                   () => ({ ok: true, scope: "https://a.example.org/" }), () => null, () => "yes", () => ({ ok: "true", scope: ["https://a.example.org/"] })];
  for (const [i, fn] of answers.entries()) {
    const w = world().scene();
    w.cr.registerSweepScope("link-sweep", fn);
    const id = w.ask({ address: "https://a.example.org/doc", sweep: "INQ-1#s" }).request;
    const d = await w.cr.drain({});
    refusedOutOfScope(w, d, id, `answer ${i}`);
    assert.match(w.req(id).detail, /INQ-1#s does not admit this request/, `answer ${i}`);
    assert.equal(w.capture.calls.length, 0, `answer ${i}`);
  }
  const w = world().scene();
  w.cr.registerSweepScope("link-sweep", async () => ({ ok: true, scope: ["https://a.example.org/"] }));
  const id = w.ask({ address: "https://a.example.org/doc", sweep: "INQ-1#s" }).request;
  await w.cr.drain({});
  assert.equal(w.req(id).state, "captured");
  assert.deepEqual(w.capture.calls[0].opts.captureRequest.scope, ["https://a.example.org/"]);
});

test("R45 the scope check is registered once: a second registration, by any module, is refused LISTENER_DECLARED naming the holder, a malformed one LISTENER_MALFORMED, and the first stands", async () => {
  const w = world().scene();
  for (const [m, fn] of [["", () => {}], [null, () => {}], ["link-sweep", null], ["link-sweep", "fn"]]) {
    const r = w.cr.registerSweepScope(m, fn);
    assert.deepEqual([r.ok, r.reason, r.code, r.check], [false, "LISTENER_MALFORMED", "LISTENER_MALFORMED", "C-102.11"]);
  }
  const first = scopeCheck(SWEEPS);
  assert.deepEqual(w.cr.registerSweepScope("link-sweep", first.fn), { ok: true, module: "link-sweep" });
  for (const m of ["link-sweep", "other"]) {
    const r = w.cr.registerSweepScope(m, () => ({ ok: true, scope: ["https://elsewhere.example.org/"] }));
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.module], [false, "LISTENER_DECLARED", "LISTENER_DECLARED", "C-102.12", "link-sweep"], m);
  }
  const id = w.ask({ address: "https://elsewhere.example.org/x", sweep: "INQ-1#agendas" }).request;
  await w.cr.drain({});
  assert.equal(w.req(id).code, "CAPTURE_SWEEP_OUT_OF_SCOPE", "the first check still decides");
  assert.equal(first.asked.length, 1);
});

test("R45 the sweep is judged after the rules about what the request says and before rate: attribution first, then a sweep that does not admit it refuses rather than holds a paced host; an admitted request on a spent host is held", async () => {
  const { w, check } = sweepWorld();
  w.run("R-HALF", { claude: "" });
  const half = w.ask({ run: "R-HALF", address: "https://council.example.org/agendas/1", sweep: "INQ-1#full" }).request;
  w.tick(1000);
  const first = w.ask({ address: "https://council.example.org/agendas/2" }).request;
  w.tick(1000);
  const notAdmitted = w.ask({ address: "https://council.example.org/minutes/3", sweep: "INQ-1#full" }).request;
  w.tick(1000);
  const admitted = w.ask({ address: "https://council.example.org/agendas/4", sweep: "INQ-1#agendas" }).request;
  const d = await w.cr.drain({});
  assert.deepEqual([w.req(half).state, w.req(half).code], ["refused", "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL"]);
  assert.equal(w.req(first).state, "captured");
  refusedOutOfScope(w, d, notAdmitted, "held sweep on a spent host");
  assert.deepEqual([w.req(admitted).state, w.req(admitted).code], ["requested", "CAPTURE_CONDUCT_TICK_SPENT"]);
  assert.deepEqual(check.asked.map((x) => x.sweep), ["INQ-1#full", "INQ-1#agendas"], "attribution refused before the check was asked");
  /* the next tick judges the held one again and fires it under its sweep */
  w.tick(60_000);
  await w.cr.drain({});
  assert.equal(w.req(admitted).state, "captured");
  assert.deepEqual(w.capture.calls.at(-1).opts.captureRequest.origin.matched_sweep, "INQ-1#agendas");
});

test("R45 a fetch that meets a locator out of the sweep's scope (acquisition's C-128.2 redirect, or C-128.1) is refused CAPTURE_SWEEP_OUT_OF_SCOPE naming it, nothing filed, the host's slot spent", async () => {
  for (const reason of ["SWEEP_REDIRECT_OUT_OF_SCOPE", "SWEEP_SCOPE_MISSING"]) {
    const { w } = sweepWorld();
    const id = w.ask({ address: "https://council.example.org/agendas/moved", sweep: "INQ-1#agendas" }).request;
    w.tick(1000);
    const next = w.ask({ address: "https://council.example.org/agendas/other" }).request;
    w.capture.script.set("https://council.example.org/agendas/moved", { status: 422, body: { ok: false, reason, code: reason,
      target: "https://tracker.example.com/x", detail: `redirected to https://tracker.example.com/x (${reason})` } });
    const d = await w.cr.drain({});
    refusedOutOfScope(w, d, id, reason);
    assert.match(w.req(id).detail, new RegExp(`INQ-1#agendas does not reach every locator of this request: redirected to https://tracker\\.example\\.com/x \\(${reason}\\)`));
    assert.equal(daemonBundles(w), 0, `${reason}: nothing filed`);
    assert.deepEqual([w.req(next).state, w.req(next).code], ["requested", "CAPTURE_CONDUCT_TICK_SPENT"], `${reason}: the slot stays spent`);
  }
  /* a request naming no sweep is not this refusal: its failure is the drain's own hold (R19) */
  const w = world().scene();
  const id = w.ask({ address: "https://council.example.org/plain" }).request;
  w.capture.script.set("https://council.example.org/plain", { status: 422, body: { ok: false, reason: "SWEEP_REDIRECT_OUT_OF_SCOPE" } });
  await w.cr.drain({});
  assert.deepEqual([w.req(id).state, w.req(id).code], ["requested", "CAPTURE_FETCH_FAILED"]);
});

test("R45 the op takes a request's sweep from the body like its address, and the drain op files it under that sweep", async () => {
  const { w } = sweepWorld();
  const url = new URL("http://x/capturerequest?viewer=member%3Aann&principal=member%3Aann%2Ftok1");
  w.hold("https://council.example.org/agendas/op");
  const a = captureRequestsOps(w.cr, url, { run: "R-1", address: "https://council.example.org/agendas/op", target: "INQ-1",
                                           purpose: "investigate", sweep: "INQ-1#agendas" }).capturerequest();
  assert.deepEqual([a.ok, a.sweep], [true, "INQ-1#agendas"]);
  const d = await captureRequestsOps(w.cr, new URL("http://x/capturerequestdrain"), {}).capturerequestdrain();
  assert.equal(d.captured[0].request, a.request);
  assert.equal(w.capture.calls[0].opts.captureRequest.origin.kind, "sweep");
});
