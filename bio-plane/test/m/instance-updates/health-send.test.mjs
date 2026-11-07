/* instance-updates R7 (T53; AD38; K5487): the health sender, at the module's interface. ai-use is the real module over
   its own published world (`../ai-use/fixture.mjs`), its switch set and its days counted through its own acts; this
   module boots over instance-setup's published fixture, whose fetch, governor and scheduler record what they are asked.
   Every refusal has a control (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../instance-setup/fixture.mjs";
import { world as aiWorld, ENTRIES } from "../ai-use/fixture.mjs";
import { HEALTH_MIN_CALLS } from "../../../src/ai-use/index.mjs";
import { HEALTH_ADDRESS, HEALTH_SEND_USER_AGENT } from "../../../src/setup.mjs";

const NOW = Date.parse("2026-10-09T10:15:00Z");
const DAY = 86_400_000;

/* ai-use with `day` counted (HEALTH_MIN_CALLS calls on one entry), the switch on when `on`; this module beside it. */
async function sender({ on = true, days = ["2026-10-08"], minute = 615, st = null } = {}) {
  const ai = await (await aiWorld()).group();
  for (const day of days)
    for (let i = 0; i < HEALTH_MIN_CALLS; i++) ai.u.countHealth({ entry_id: ENTRIES.priced, personal: false, outcome: "result", at: `${day}T09:00:00Z` });
  if (on) ai.u.healthShareSet({ on: true, by: "admin", at: "2026-10-01T00:00:00Z" });
  const w = await boot({ st, env: { VERSION: "0.84.0", INSTANCE_NAME: "river-town", ADMIN_TOKEN: "a-live-admin-token-0123456789" },
    now: () => NOW, more: { aiUse: ai.u, drawHealthMinute: () => minute } });
  w.ai = ai;
  w.consumer = () => w.prov.consumers.find((c) => c.name === "health-send");
  w.serve = (status) => { w.prov.answer = () => new Response("{}", { status }); };
  w.posts = () => w.prov.fetched.filter((f) => f.url === HEALTH_ADDRESS);
  return w;
}

test("R7 a scheduler consumer health-send is registered beside update-check, under its own key, due daily at a minute drawn once per store and kept (control: a later start drawing another minute keeps the first)", async () => {
  const w = await sender();
  const names = w.prov.consumers.map((c) => c.name);
  assert.ok(names.includes("update-check") && names.includes("health-send"));
  assert.equal(w.consumer().key, "healthsend");
  assert.equal(w.consumer().due(NOW - 60_000), Date.parse("2026-10-09T10:15:00Z"));
  assert.equal(w.consumer().wake(NOW), Date.parse("2026-10-10T10:15:00Z"), "the run at the minute is next due a day on");
  const later = await boot({ st: w.st, env: { VERSION: "0.84.0" }, now: () => NOW, more: { aiUse: w.ai.u, drawHealthMinute: () => 3 } });
  const c = later.prov.consumers.find((x) => x.name === "health-send");
  assert.equal(c.due(NOW - 60_000), Date.parse("2026-10-09T10:15:00Z"), "the minute drawn first is kept");
});

test("R7 switch on with one day counted: one POST to HEALTH_ADDRESS through the governor, headers exactly content-type and the fixed user agent, no redirect followed, the body the report healthReport answered; then healthSent, so the day is not answered again", async () => {
  const w = await sender();
  const expected = w.ai.u.healthReport({ at: NOW });
  assert.equal(expected.length, 1);
  w.serve(200);
  const out = await w.consumer().tick(NOW);
  assert.deepEqual(out.healthsend.sent, ["2026-10-08"]);
  const posts = w.posts();
  assert.equal(posts.length, 1);
  const { init } = posts[0];
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(Object.keys(init).sort(), ["body", "headers", "method", "redirect"], "no credentials or cache option");
  assert.deepEqual(init.headers, { "content-type": "application/json", "user-agent": HEALTH_SEND_USER_AGENT });
  assert.deepEqual(JSON.parse(init.body), expected[0]);
  const sent = JSON.stringify([posts[0].url, init]).toLowerCase();
  for (const s of ["river-town", "a-live-admin-token-0123456789", "0.84.0", "cookie", "authorization"])
    assert.equal(sent.includes(s), false, `the request carries ${s}`);
  const host = new URL(HEALTH_ADDRESS).host;
  assert.deepEqual(w.prov.governed.filter((g) => g[1] === host), [["admit", host], ["report", host, 200]]);
  assert.deepEqual(w.ai.u.healthReport({ at: NOW }), [], "healthSent recorded the day");
});

test("R7 control: with the switch off healthReport answers null and no request is made", async () => {
  const w = await sender({ on: false });
  assert.equal(w.ai.u.healthReport({ at: NOW }), null);
  w.serve(200);
  const out = await w.consumer().tick(NOW);
  assert.deepEqual(out.healthsend.sent, []);
  assert.equal(w.posts().length, 0);
  assert.equal(w.prov.governed.some((g) => g[1] === new URL(HEALTH_ADDRESS).host), false);
});

test("R7 control: a 500 leaves the day unsent and the next run sends it; with two days, a refused first day sends neither, so no later day passes over it", async () => {
  const w = await sender({ days: ["2026-10-07", "2026-10-08"] });
  w.serve(500);
  const first = await w.consumer().tick(NOW);
  assert.deepEqual(first.healthsend.sent, []);
  assert.equal(first.healthsend.held.status, 500);
  assert.equal(w.posts().length, 1, "the run stops at the first refusal");
  assert.deepEqual(w.ai.u.healthReport({ at: NOW }).map((r) => r.day), ["2026-10-07", "2026-10-08"], "nothing marked sent");
  w.serve(200);
  const next = await w.consumer().tick(NOW + DAY);
  assert.deepEqual(next.healthsend.sent, ["2026-10-07", "2026-10-08"]);
  assert.deepEqual(w.ai.u.healthReport({ at: NOW + DAY }), []);
});

test("R7 control: a redirect is not followed and leaves the day unsent", async () => {
  const w = await sender();
  w.serve(302);
  const out = await w.consumer().tick(NOW);
  assert.deepEqual(out.healthsend.sent, []);
  assert.equal(w.posts().length, 1);
  assert.equal(w.ai.u.healthReport({ at: NOW }).length, 1);
});
