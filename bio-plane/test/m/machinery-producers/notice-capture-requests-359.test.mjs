/* machinery-producers over capture-requests PR 359 (its R60, R61, R62). R61: a drain fetch the site answered with a
   challenge (`SITE_ASKS_FOR_PERSON`, acquisition R140) holds the row `requested` with `needs_person`, and the drain no
   longer selects it: it waits for a member's file until it expires. `rendersHeld` (capture-requests R26) still answers
   such a render row, so `render-deferred` (R2) raised it with the fall-back "last thing recorded" sentence naming the code
   and told members it is "asked again on every tick", which R61 made false. Adapted: a row waiting for a person says what
   the site asked and that it waits for a member's file, its basis carrying `needs_person` and `asked_at`; it still stands,
   so the render does not vanish while nothing is filed. R60 (`idem`) and R62 (`produced_by`) add fields this module does
   not read: confirmed with no change. The rows are made by capture-requests' and capture's real code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId } from "./world.mjs";
import { world as crWorld, V } from "../capture-requests/fixture.mjs";
import { captureArm } from "../capture/fixtures.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const WALL = "https://wall.example.org/doc";

/** A run's render request whose fetch the site answers with a challenge, drained by capture-requests' real drain over
 *  capture's real acquire (a renderer bound, so the render is attempted). */
async function heldForPerson() {
  const c = crWorld().scene();
  const id = c.ask({ address: WALL, render: true }).request;
  const arm = captureArm({
    routes: { [WALL]: () => new Response("<html><title>Just a moment...</title></html>",
      { status: 403, headers: { "cf-mitigated": "challenge", "content-type": "text/html" } }) },
    env: { RENDERER: { fetch: async () => new Response("{}") } } });
  c.capture.script.set(WALL, [(body, opts) => arm.acquire(body, opts)]);
  c.tick(1000);
  const d = await c.cr.drain({ now: c.clock.ms });
  return { c, id, at: d.at };
}

function itemFor(answer, id) {
  const w = world();
  w.member("ann"); w.bundle("INQ-1", "inquiry");
  w.fakes.captureRequests.rendersHeld = () => answer;
  return byId(w.read("ann"))[`CONDITION::render-deferred::${id}`];
}

test("notice capture-requests:359 (R2; capture-requests R61): a render row held because the site asked for a person stands as render-deferred, says it waits for a member's file and is not asked again, never the fall-back naming the code; its basis carries needs_person and asked_at", async () => {
  const { c, id, at } = await heldForPerson();
  const real = c.cr.rendersHeld({ viewer: V("ann") });
  const row = real.requests.find((r) => r.request === id);
  assert.deepEqual([row.state, row.code, row.needs_person, row.asked_at], ["requested", "SITE_ASKS_FOR_PERSON", true, at]);
  const it = itemFor(real, id);
  assert.ok(it, "the item stands while the request waits");
  const words = word("machinery-producers.index.site_asks_for_person");
  assert.equal(it.summary, word("machinery-producers.summary.render_waiting", { address: WALL, words }));
  assert.equal(it.detail, word("machinery-producers.index.words_the_request_waits_for_person", { words, expires: row.expires }));
  assert.ok(!it.summary.includes("SITE_ASKS_FOR_PERSON") && !it.detail.includes("SITE_ASKS_FOR_PERSON"), "no code in member text");
  assert.deepEqual([it.basis.render.state, it.basis.needs_person, it.basis.asked_at, it.basis.code],
                   ["waiting_for_person", true, at, "SITE_ASKS_FOR_PERSON"]);
});

test("notice capture-requests:359 (R2): expired, the row waiting for a person is told released, saying no member's file came; control: a render held under a C-83 code keeps its own translation and the asked-again detail", async () => {
  const { c, id } = await heldForPerson();
  c.tick(2 * 86400000);
  await c.cr.drain({ now: c.clock.ms });
  const gone = c.cr.rendersHeld({ viewer: V("ann") });
  const row = gone.requests.find((r) => r.request === id);
  assert.equal(row.state, "expired");
  const it = itemFor(gone, id);
  const words = word("machinery-producers.index.site_asked_for_person_expired");
  assert.equal(it.summary, word("machinery-producers.summary.render_performed_held", { address: WALL }));
  assert.ok(it.detail.startsWith(words), it.detail);
  assert.equal(it.basis.render.state, "expired");

  /* control: no renderer bound, so capture's real acquire holds the render under C-83 (RENDER_NO_RENDERER) */
  const k = crWorld().scene();
  const kid = k.ask({ address: WALL, render: true }).request;
  k.capture.script.set(WALL, [(body, opts) => captureArm({ routes: { [WALL]: () => new Response("<html></html>",
    { headers: { "content-type": "text/html" } }) } }).acquire(body, opts)]);
  k.tick(1000);
  await k.cr.drain({ now: k.clock.ms });
  const held = k.cr.rendersHeld({ viewer: V("ann") });
  const krow = held.requests.find((r) => r.request === kid);
  assert.equal(krow.needs_person, false);
  const kit = itemFor(held, kid);
  assert.equal(kit.basis.render.state, "deferred");
  assert.equal(kit.basis.needs_person, false);
  assert.equal(kit.detail, word("machinery-producers.index.words_the_request_is_held",
    { words: krow.render_deferral.translation, expires: krow.expires }));
});
