/* following T53 (R41, R42; K5513, M-R5): a followed CourtListener docket checked once a day through the service's entries,
   under acquisition's real keyed path (`keyedCapture`, its R36, R130, R131, R137): the call ledger, the stated limits and the
   daily share, over a scripted network. The key is a sentinel; the profile stating the limits is the test profile with one more
   system for the service's host (as acquisition's own T53 tests state it), and the docket scheme's numbers are the service's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, testView, MEMBER, MACHINE, T0, DAY } from "./fixture.mjs";
import { network } from "../acquisition/fixture.mjs";
import { keyedFetch } from "../../../src/acquisition/index.mjs";
import { get } from "../../../../jurisdictions/index.mjs";

const KEY = "SENTINEL-KEY-7f3a91c0d2";
const CL = "www.courtlistener.com";
const PAGE = (id) => `https://${CL}/docket/${id}/`;
const ENTRIES = (id) => `https://${CL}/api/rest/v4/docket-entries/?docket=${id}`;
const PRJ = "PRJ-2026-0001-a", HOME = "INFO-2026-0002-a";

const profileWith = (limits) => {
  const base = get("test-port-ellery");
  return { ...base, systems: [...base.systems, { origin: "courtlistener_keyed", name: "the national docket service", hosts: [CL], gated: "none",
    ...(limits ? { rate_limits: { ...limits, basis: "TEST", measured_at: "2026-09-03" } } : {}), basis: "TEST" }] };
};
const credentials = (on) => ({ async keyedServiceFor({ service }) { return on ? { ok: true, service, key: KEY } : { ok: false, reason: "KEYED_SERVICE_OFF", code: "KEYED_SERVICE_OFF", service }; } });
/* the view: the docket scheme's numbers are the service's own (digits), its template the service's docket page */
function alertView() {
  const v = testView();
  v.spaces = { ...v.spaces, proceeding: { ...v.spaces.proceeding, forms: [...v.spaces.proceeding.forms, { form: "cl-docket", pattern: { re: "^(\\d{4,9})$" }, normal: [{ group: 1 }], basis: "TEST" }] } };
  v.identifier_schemes = v.identifier_schemes.map((s) => (s.scheme === "docket" ? { ...s, form: "cl-docket" } : s));
  v.query_templates = [{ scheme: "docket", register: "county_raw", template: PAGE("{value}"), basis: "TEST" },
                       { scheme: "filer", register: "town_filings", template: "https://data.marlow-county.example/filer/{value}", basis: "TEST" }];
  return v;
}
function setup({ on = true, limits = { per_day: 125 } } = {}) {
  const w = world({ view: alertView(), keyed: { profile: profileWith(limits), credentials: credentials(on) } });
  w.project(PRJ);
  w.bundle(HOME, { project: PRJ });
  return w;
}
const docket = (w, id, x = {}) => w.f.followRegisterQuery({ register: "county_raw", scheme: "docket", value: String(id), alert: "courtlistener", home: HOME, author: MEMBER, viewer: MEMBER, ...x });
const json = (v) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
/* the service answers each docket's entries with its own body (`n` entries) */
const entries = (n = 1) => (url) => json({ count: n, next: null, previous: null, results: Array.from({ length: n }, (_, i) => ({ id: Number(new URL(url).searchParams.get("docket")) * 10 + i, entry_number: i + 1, date_filed: "2026-10-01", description: `entry ${i + 1}` })) });
async function tick(w, at, routes = entries()) {
  const net = network(routes);
  w.t = at;
  try { return { t: await w.f.followTick(at), net }; } finally { net.restore(); }
}
const keyedSeen = (net) => net.seen.filter((x) => x.url.startsWith(`https://${CL}/api/`));

test("R41 a followed docket with the service on is checked through the entries once in the day, filed as a capture attributed to the follow; after the member stops, it is not checked and a daemon's keyed fetch for it is NOT_PERMITTED; the key is in no answer (control: a non-docket follow carries no alert)", async () => {
  const w = setup();
  const f = docket(w, 4214664);
  assert.equal(f.ok, true, JSON.stringify(f));
  const plain = w.f.followRegisterQuery({ register: "town_filings", scheme: "filer", value: "F12345", home: HOME, author: MEMBER, viewer: MEMBER });
  w.serve("https://data.marlow-county.example/filer/F12345", "<p>F12345</p>");
  const { t, net } = await tick(w, T0);
  assert.deepEqual(keyedSeen(net).map((x) => x.url), [ENTRIES(4214664)]);
  assert.equal(keyedSeen(net)[0].init.headers.authorization, `Token ${KEY}`);
  assert.deepEqual(t.polled.map((p) => p.follow), [f.follow]);
  const read = t.read.find((r) => r.follow === f.follow);
  assert.equal(read.outcome, "captured");
  assert.deepEqual(w.fetches.map((o) => o.captureRequest.locator), ["https://data.marlow-county.example/filer/F12345"], "the docket's page was not re-read");
  /* filed as a capture, attributed to the follow */
  const doc = w.landed.find((l) => l.request.locators[0] === ENTRIES(4214664)).filed.doc;
  assert.equal(doc.authority, String(f.follow));
  assert.equal(doc.capture.keyed.purpose, "docket-entries");
  /* once in the day */
  const again = await tick(w, T0 + 3600000);
  assert.equal(keyedSeen(again.net).length, 0);
  const items = w.f.follows({ viewer: MEMBER }).items;
  assert.equal(items.find((i) => i.follow === f.follow).alert, "courtlistener");
  assert.equal("alert" in items.find((i) => i.follow === plain.follow), false, "control: a non-docket follow carries no alert");
  /* the key is in no answer, follow or capture */
  assert.doesNotMatch(JSON.stringify([t, again.t, items, w.landed.map((l) => l.filed)]), new RegExp(KEY));
  /* the member stops: not checked again, and the daemon may not fetch for it */
  assert.equal(w.f.registerWatchStop({ follow: f.follow, author: MEMBER, viewer: MEMBER }).ok, true);
  const next = await tick(w, T0 + DAY + 1000);
  assert.equal(keyedSeen(next.net).length, 0);
  const net2 = network(entries());
  try {
    const d = await keyedFetch(w.keyedStore, { service: "courtlistener", purpose: "docket-entries", viewer: MACHINE, standing: { follow: String(f.follow) }, request: { url: ENTRIES(4214664) }, at: T0 + 2 * DAY });
    assert.equal(d.reason, "NOT_PERMITTED");
    assert.equal(net2.seen.length, 0);
  } finally { net2.restore(); }
  /* an alert on a docket not at the service is refused */
  assert.equal(w.f.followRegisterQuery({ register: "town_filings", scheme: "filer", value: "F12345", alert: "courtlistener", home: HOME, author: MEMBER, viewer: MEMBER }).reason, "BAD_ALERT");
});

test("R41 with the service off, zero keyed requests: the docket's page is read as an ordinary register follow and follows says alert off; a member's refresh with it off reads the page, with it on the entries", async () => {
  const w = setup({ on: false });
  const f = docket(w, 4214664).follow;
  w.serve(PAGE(4214664), "<h1>Docket</h1>");
  const { t, net } = await tick(w, T0);
  assert.equal(keyedSeen(net).length, 0);
  assert.deepEqual(w.fetches.map((o) => o.captureRequest.locator), [PAGE(4214664)]);
  assert.deepEqual(t.alert_off.map((a) => a.follow), [f]);
  const item = w.f.follows({ viewer: MEMBER }).items.find((i) => i.follow === f);
  assert.deepEqual([item.alert, item.not_read], ["off", "alert_off"]);
  w.serve(PAGE(4214664), "<h1>Docket</h1><p>new</p>");
  const r = await w.f.refreshRegister({ follow: f, author: MEMBER });
  assert.deepEqual([r.ok, r.via, r.alert], [true, "page", "off"]);
  /* on: the member's refresh reads the entries, counted as a member's call */
  const w2 = setup();
  const g = docket(w2, 4214664).follow;
  const net2 = network(entries(2));
  try {
    w2.t = T0;
    const r2 = await w2.f.refreshRegister({ follow: g, author: MEMBER });
    assert.deepEqual([r2.ok, r2.via], [true, "entries"], JSON.stringify(r2));
    assert.equal(keyedSeen(net2).length, 1);
    assert.equal((await w2.f.refreshRegister({ follow: g, author: "member:bob" })).reason, "NOT_THE_FOLLOWER");
  } finally { net2.restore(); }
});

test("R42 with a stated limit of 125 a day, 10 and 50 followed dockets are each checked once in the day; of 150 exactly 100 are checked and 50 are rate_held, never failed, and are checked first the next day; no day's checks pass 100", async () => {
  for (const n of [10, 50, 150]) {
    const w = setup();
    const ids = Array.from({ length: n }, (_, i) => docket(w, 10000 + i).follow);
    let polled = [], held = [], failed = 0;
    for (let k = 0; k < 5; k++) {
      const { t } = await tick(w, T0 + k * 60000);
      polled.push(...t.polled.map((p) => p.follow)); held.push(...t.rate_held.map((p) => p.follow)); failed += t.failed.length;
    }
    assert.equal(failed, 0, `n=${n}`);
    assert.equal(new Set(polled).size, polled.length, "none twice");
    assert.equal(polled.length, Math.min(n, 100), `n=${n}`);
    if (n === 150) {
      const heldIds = [...new Set(held)];
      assert.equal(heldIds.length, 50);
      const item = w.f.follows({ viewer: MEMBER }).items.find((i) => i.follow === heldIds[0]);
      assert.equal(item.not_read, "rate_held");
      assert.ok(item.next_due, "the next check is stated");
      /* the next day the held ones come first */
      const { t } = await tick(w, T0 + DAY + 2 * 3600000);
      assert.deepEqual(t.polled.map((p) => p.follow).sort((a, b) => a - b), heldIds.sort((a, b) => a - b));
    } else assert.equal(held.length, 0);
    assert.equal(ids.length, n);
  }
});

test("R42 a sixth call in a minute under a limit of 5 is rate_held and the docket stays due; a member's refresh is counted and held at a short limit; with no limit stated the service is not polled on the alarm; a store with no alert keeps the tick's key set", async () => {
  const w = setup({ limits: { per_minute: 5, per_day: 125 } });
  const ids = Array.from({ length: 6 }, (_, i) => docket(w, 20000 + i).follow);
  const { t, net } = await tick(w, T0);
  assert.equal(keyedSeen(net).length, 5);
  assert.equal(t.polled.length, 5);
  assert.equal(t.rate_held.length, 1);
  assert.equal(t.rate_held[0].window, "minute");
  assert.equal(t.failed.length, 0);
  assert.equal(w.f.followDue(T0 + 61000), true, "held, then due again once the minute passes");
  const r = await w.f.refreshRegister({ follow: ids[0], author: MEMBER });
  assert.equal(r.reason, "RATE_HELD");
  const later = await tick(w, T0 + 61000);
  assert.deepEqual(later.t.polled.map((p) => p.follow), [ids[5]]);
  /* with no limit stated: not polled on the alarm; its page is read */
  const w2 = setup({ limits: null });
  const g = docket(w2, 30000).follow;
  w2.serve(PAGE(30000), "<h1>Docket</h1>");
  const t2 = await tick(w2, T0);
  assert.equal(keyedSeen(t2.net).length, 0);
  assert.deepEqual(t2.t.alert_off.map((a) => a.follow), [g]);
  /* no follow carries an alert: the key set is R13's */
  const w3 = setup();
  w3.f.followRegisterQuery({ register: "town_filings", scheme: "filer", value: "F12345", home: HOME, author: MEMBER, viewer: MEMBER });
  const t3 = await tick(w3, T0);
  assert.deepEqual(Object.keys(t3.t).sort(), ["at", "captured", "configured", "epoch", "failed", "member_act_required", "paused", "read", "unscheduled"].sort());
});
