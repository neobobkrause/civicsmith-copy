/* capture-requests at T53: R60 (a retried request of a run files one request, by its `idem`), R61 (a request the site
   answered with a challenge waits for the person who asked, and her file completes it) and R62 (a request keeps who
   produced it). Every test drives the module at its interface (the door, the drain, the reads, `personWaits`,
   `fillAskedRequest`), each with a negative control (K874). The challenge is the real capture's answer to a fetch
   answered `cf-mitigated: challenge` (capture's published `captureArm`, acquisition R140). A label's fields are read
   from ai-runs' `LABEL_FIELDS`, the product's own list: `agent-model` publishes no label fixture yet (its R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, sha } from "./fixture.mjs";
import { captureArm } from "../capture/fixtures.mjs";
import { CAPTURE_REQUEST_CHECKS } from "../../../src/capture-requests/index.mjs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";
import { ARCHIVE_CHECKS } from "../../../src/acquisition/index.mjs";

const count = (w) => w.row(`SELECT count(*) AS n FROM capture_requests`).n;
/** A conversation's label as its fields stand, each field's value `<field> of <who>` (effort a lowercase word). */
const label = (who) => Object.fromEntries(AiRuns.LABEL_FIELDS.map((f) => [f, f === "effort" ? "low" : `${f} of ${who}`]));

/* ---- R60 ---------------------------------------------------------------------------------------------------- */

test("R60 a request carrying an idem the run already sent answers the first request's row with repeated: true and writes no second row", () => {
  const w = world().scene();
  const first = w.ask({ idem: "R-1:1:S-1:0" });
  assert.deepEqual([first.ok, first.requested], [true, true], JSON.stringify(first));
  w.tick(1000);
  /* the step re-runs after a stop: the same idem, the same candidate */
  const again = w.ask({ idem: "R-1:1:S-1:0" });
  assert.deepEqual([again.ok, again.repeated, again.already, again.requested, again.request],
                   [true, true, true, false, first.request]);
  assert.equal(count(w), 1);
  assert.equal(w.req(first.request).idem, "R-1:1:S-1:0");
  /* the first request's answer stands even when the retry says something else: its row decides */
  const odd = w.ask({ idem: "R-1:1:S-1:0", address: "https://example.org/elsewhere", purpose: "acquire" });
  assert.deepEqual([odd.repeated, odd.request, odd.address, odd.purpose], [true, first.request, "https://example.org/a", "investigate"]);
  assert.equal(count(w), 1);
  assert.equal(w.cr.captureRequests({ viewer: V("ann") }).requests[0].idem, "R-1:1:S-1:0");
});

test("R60 control: a changed candidate with a new idem files its own row (address, render or purpose); the same candidate under a new idem is R6's standing row; an absent idem behaves as R6", () => {
  const w = world().scene();
  const a = w.ask({ idem: "R-1:1:S-1:0" });
  const addr = w.ask({ idem: "R-1:1:S-1:1", address: "https://example.org/b" });
  const rend = w.ask({ idem: "R-1:1:S-1:2", render: true });
  const purp = w.ask({ idem: "R-1:1:S-1:3", purpose: "acquire" });
  for (const x of [addr, rend, purp]) assert.deepEqual([x.ok, x.requested, x.repeated], [true, true, undefined], JSON.stringify(x));
  assert.equal(new Set([a.request, addr.request, rend.request, purp.request]).size, 4);
  assert.equal(count(w), 4);
  /* the same document, render and purpose under a new idem is already asked for (R6): never fetched twice */
  const same = w.ask({ idem: "R-1:1:S-1:9" });
  assert.deepEqual([same.already, same.requested, same.request, same.repeated], [true, false, a.request, undefined]);
  /* no idem: R6 as today, idempotent on run, address and render */
  const plain = w.ask({ address: "https://example.org/b", purpose: "acquire" });
  assert.deepEqual([plain.already, plain.request, plain.repeated], [true, addr.request, undefined]);
  assert.equal(count(w), 4);
  /* an idem is the run's own: another run sending it files its own request */
  w.run("R-2");
  const other = w.ask({ run: "R-2", idem: "R-1:1:S-1:0" });
  assert.deepEqual([other.requested, other.repeated], [true, undefined]);
  assert.notEqual(other.request, a.request);
});

/* ---- R62 ---------------------------------------------------------------------------------------------------- */

test("R62 produced_by is stored deduplicated in order, answered by the door, by R24's read, by R26's reads and beside the drain's attribution (never in it); a request after a hop carries the new label, one before it the old", async () => {
  const w = world().scene();
  /* two hosts, so one tick fetches both (one fetch per host per tick, R14) */
  const before = w.ask({ address: "https://before.example.org/", produced_by: [label("old")] });
  const after = w.ask({ address: "https://after.example.org/", produced_by: [label("old"), label("new"), label("old")] });
  assert.deepEqual(before.produced_by, [label("old")]);
  assert.deepEqual(after.produced_by, [label("old"), label("new")]);
  assert.deepEqual(JSON.parse(w.req(after.request).produced_by), [label("old"), label("new")]);
  const read = Object.fromEntries(w.cr.captureRequests({ viewer: V("ann") }).requests.map((r) => [r.request, r]));
  assert.deepEqual(read[before.request].produced_by, [label("old")]);
  assert.deepEqual(read[after.request].produced_by, [label("old"), label("new")]);
  assert.deepEqual(w.cr.requestById({ request: after.request, viewer: V("ann") }).produced_by, [label("old"), label("new")]);
  /* drained: the attribution statement stands as R10 composes it, and who produced it rides beside it */
  const d = await w.cr.drain({ now: w.clock.ms + 1000 });
  const got = d.captured.find((c) => c.request === after.request);
  assert.ok(got, JSON.stringify(d));
  assert.deepEqual(got.produced_by, [label("old"), label("new")]);
  assert.equal(JSON.stringify(got.attribution).includes("model_version of"), false);
  const done = w.cr.completed({ viewer: V("ann") }).requests.find((r) => r.request === after.request);
  assert.deepEqual(done.produced_by, [label("old"), label("new")]);
  assert.equal(w.req(after.request).detail, got.attribution.statement);
  /* an idem retry answers the first row's produced_by, not the retry's */
  const one = w.ask({ address: "https://example.org/idem", idem: "R-1:2:S-2:0", produced_by: [label("old")] });
  const retry = w.ask({ address: "https://example.org/idem", idem: "R-1:2:S-2:0", produced_by: [label("new")] });
  assert.deepEqual([retry.repeated, retry.request, retry.produced_by], [true, one.request, [label("old")]]);
});

test("R62 control: a request with no produced_by answers null; a malformed list is refused CAPTURE_REQUEST_PRODUCED_BY_MALFORMED and writes nothing", () => {
  const w = world().scene();
  const none = w.ask({ address: "https://example.org/none" });
  assert.equal(none.produced_by, null);
  assert.equal(w.cr.captureRequests({ viewer: V("ann") }).requests[0].produced_by, null);
  assert.equal(w.ask({ address: "https://example.org/null", produced_by: null }).produced_by, null);
  const n = count(w);
  const extra = { ...label("old"), secret_field: "x" };
  for (const bad of ["a label", label("old"), [label("old"), "x"], [[label("old")]], [null], [{}], [extra], 7]) {
    const x = w.ask({ address: "https://example.org/bad", produced_by: bad });
    assert.deepEqual([x.ok, x.code, x.check, x.translation], [false, "CAPTURE_REQUEST_PRODUCED_BY_MALFORMED",
      CAPTURE_REQUEST_CHECKS.CAPTURE_REQUEST_PRODUCED_BY_MALFORMED.check,
      CAPTURE_REQUEST_CHECKS.CAPTURE_REQUEST_PRODUCED_BY_MALFORMED.translation], JSON.stringify(bad));
  }
  assert.equal(count(w), n);
});

/* ---- R61 ---------------------------------------------------------------------------------------------------- */

const WALL = "https://wall.example.org/doc";
/** The drain's fetch of `loc` answered by a challenge, as the real capture answers it (acquisition R140). */
function challenged(w, loc = WALL) {
  const arm = captureArm({ routes: { [loc]: () => new Response("<html><title>Just a moment...</title></html>",
    { status: 403, headers: { "cf-mitigated": "challenge", "content-type": "text/html" } }) } });
  w.capture.script.set(loc, [(body, opts) => arm.acquire(body, opts)]);
}
/** ann's own request for later (R56), no run and no target: seen by her alone. */
const hers = (w, address = WALL) => w.cr.captureRequest({ address }, { viewer: V("ann"), caller: "member:ann" });

test("R61 a drain answered SITE_ASKS_FOR_PERSON holds the row requested with needs_person and asked_at, files no capture and gives the host's slot back; the next tick does not fetch it; personWaits lists it for the asker and for no one who cannot see it", async () => {
  const w = world().scene();
  const id = hers(w).request;
  w.tick(1000);   /* hers is the older, so the tick takes it first */
  const run = w.ask({ address: "https://wall.example.org/run" }).request;
  challenged(w);
  w.tick(1000);
  const d = await w.cr.drain({ now: w.clock.ms });
  const held = d.held.find((h) => h.request === id);
  assert.deepEqual([held.code, held.check, held.translation],
                   ["SITE_ASKS_FOR_PERSON", ARCHIVE_CHECKS.SITE_ASKS_FOR_PERSON.check, ARCHIVE_CHECKS.SITE_ASKS_FOR_PERSON.translation]);
  /* the host's slot given back: the run's request to the same host is fetched in this tick */
  assert.deepEqual(d.captured.map((c) => c.request), [run]);
  const r = w.req(id);
  assert.deepEqual([r.state, r.code, r.needs_person, r.capture_sha, r.asked_at], ["requested", "SITE_ASKS_FOR_PERSON", 1, null, d.at]);
  const calls = w.capture.calls.length;
  w.tick(120_000);
  const next = await w.cr.drain({ now: w.clock.ms });
  assert.equal(w.capture.calls.length, calls, "not fetched again");
  assert.equal(next.held.length + next.captured.length + next.refused.length, 0);
  assert.equal(w.req(id).state, "requested");
  /* personWaits: the asker sees it, and who asked; another member does not; a machine stamp sees it with its asker */
  const ann = w.cr.personWaits({ viewer: V("ann") });
  assert.deepEqual(ann.waits, [{ request: id, address: WALL, host: "wall.example.org", asked_at: d.at, asker: "member:ann" }]);
  assert.deepEqual([ann.count, ann.truncated, ann.limit], [1, false, 200]);
  assert.deepEqual(w.cr.personWaits({ viewer: V("bob") }).waits, []);
  assert.deepEqual(w.cr.personWaits({ viewer: null }).waits, []);
  assert.equal(w.cr.personWaits({ viewer: V("ann"), limit: 5000 }).limit, 1000);
  /* the row's reads say the site asked */
  const read = w.cr.requestById({ request: id, viewer: V("ann") });
  assert.deepEqual([read.needs_person, read.asked_at], [true, d.at]);
});

test("R61 a run's request held for a person names no asker, and is listed for whoever sees its target; expired, it is released and listed no more", async () => {
  const w = world().scene();
  const id = w.ask({ address: WALL }).request;
  challenged(w);
  w.tick(1000);
  const d = await w.cr.drain({ now: w.clock.ms });
  assert.equal(d.held[0].request, id);
  assert.deepEqual(w.cr.personWaits({ viewer: V("bob") }).waits.map((x) => [x.request, x.asker]), [[id, null]]);
  w.tick(86_400_000);
  const e = await w.cr.drain({ now: w.clock.ms });
  assert.deepEqual(e.expired.map((x) => x.request), [id]);
  assert.deepEqual(w.cr.personWaits({ viewer: V("bob") }).waits, []);
});

test("R61 a member's upload naming the address completes the waiting row with her name, the address and both instants; an upload naming another address leaves it held", async () => {
  const w = world().scene();
  const id = hers(w).request;
  challenged(w);
  w.tick(1000);
  const d = await w.cr.drain({ now: w.clock.ms });
  const digest = sha("the page she saved");
  /* another address: nothing changes, her file is an ordinary upload */
  const other = w.cr.fillAskedRequest({ address: "https://wall.example.org/other", capture_sha: digest, by: "member:ann", at: w.clock.ms });
  assert.deepEqual([other.ok, other.matched], [true, false]);
  assert.equal(w.req(id).state, "requested");
  w.tick(5000);
  const at = new Date(w.clock.ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const done = w.cr.fillAskedRequest({ address: WALL, capture_sha: digest, by: "member:ann", at });
  assert.deepEqual([done.ok, done.matched, done.request, done.address, done.capture_sha, done.brought_by, done.asked_at, done.brought_at],
                   [true, true, id, WALL, digest, "member:ann", d.at, at]);
  const r = w.req(id);
  assert.deepEqual([r.state, r.capture_sha, r.captured_at, r.brought_by, r.brought_at, r.needs_person, r.asked_at],
                   ["captured", digest, at, "member:ann", at, 1, d.at]);
  assert.equal(w.capture.calls.filter((c) => c.opts?.captureRequest?.locator === WALL).length, 1, "no fetch is made for her file");
  assert.deepEqual(w.cr.personWaits({ viewer: V("ann") }).waits, []);
  const read = w.cr.requestById({ request: id, viewer: V("ann") });
  assert.deepEqual([read.state, read.brought_by, read.brought_at, read.needs_person], ["captured", "member:ann", at, true]);
  /* a second upload for the same address finds no waiting row */
  const second = w.cr.fillAskedRequest({ address: WALL, capture_sha: sha("again"), by: "member:ann", at });
  assert.deepEqual([second.matched], [false]);
  assert.equal(w.req(id).capture_sha, digest);
});

test("R61 control: a row held for any other code is never matched; an expired row is not completed; a member who cannot see the row, a malformed digest or address, and two waiting rows of one address change nothing", async () => {
  const w = world().scene();
  const digest = sha("file");
  /* held under another code: the source's 500 (R19) */
  const plain = hers(w, "https://busy.example.org/doc").request;
  w.capture.script.set("https://busy.example.org/doc", [{ status: 502, body: { ok: false, reason: "SOURCE_REFUSED", status: 500 } }]);
  w.tick(1000);
  await w.cr.drain({ now: w.clock.ms });
  assert.equal(w.req(plain).code, "CAPTURE_FETCH_FAILED");
  assert.equal(w.cr.fillAskedRequest({ address: "https://busy.example.org/doc", capture_sha: digest, by: "member:ann" }).matched, false);
  assert.equal(w.req(plain).state, "requested");
  /* a waiting row of ann's: bob cannot complete it, nor can a malformed call */
  const id = hers(w).request;
  challenged(w);
  w.tick(61_000);
  await w.cr.drain({ now: w.clock.ms });
  assert.equal(w.req(id).needs_person, 1);
  for (const call of [{ by: "member:bob" }, { by: "member:ann/tok1" }, { by: null }, { capture_sha: "nope" },
                      { address: "http://wall.example.org/doc" }, { address: null }]) {
    const x = w.cr.fillAskedRequest({ address: WALL, capture_sha: digest, by: "member:ann", at: w.clock.ms, ...call });
    assert.equal(x.matched, false, JSON.stringify(call));
  }
  assert.equal(w.req(id).state, "requested");
  /* expired: not completed */
  const late = w.cr.fillAskedRequest({ address: WALL, capture_sha: digest, by: "member:ann", at: w.clock.ms + 86_400_000 });
  assert.equal(late.matched, false);
  assert.equal(w.req(id).state, "requested");
  /* two waiting rows of one address (her served and rendered asks): nothing is changed */
  const both = world().scene();
  const a = hers(both).request;
  const b = both.cr.captureRequest({ address: WALL, render: true }, { viewer: V("ann"), caller: "member:ann" }).request;
  both.st.sql.exec(`UPDATE capture_requests SET needs_person=1, asked_at='2026-09-28T01:00:00Z', code='SITE_ASKS_FOR_PERSON'`);
  assert.equal(both.cr.fillAskedRequest({ address: WALL, capture_sha: digest, by: "member:ann", at: both.clock.ms }).matched, false);
  assert.deepEqual([both.req(a).state, both.req(b).state], ["requested", "requested"]);
});
