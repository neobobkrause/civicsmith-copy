/* Notice machinery-producers:383 (PR 383; capture-requests R61): machinery-producers' `render-deferred` CONDITION now says,
   for a render request the site answered with a challenge (`needs_person`), that it waits for a member's file and is not
   asked again, and its basis carries `render.state: "waiting_for_person"`, `needs_person` and `asked_at`. This module's
   `machinery` feed (R8, R45) answers `machinery-producers.conditionItems`' items as they are, homed and offered through the
   walk and options it was handed, and composes no sentence of its own for them (R43 binds only this module's producers).
   Confirmed with no code change here: over capture-requests' REAL drain and `rendersHeld` (its test world, the site's
   challenge answered by capture's real acquire), the feed carries the item exactly as machinery-producers words it, and its
   member text says no code. Nothing of this module's to revert: the receipt takes --exempt-revert. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId } from "./world.mjs";
import { world as crWorld, V } from "../capture-requests/fixture.mjs";
import { captureArm } from "../capture/fixtures.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const WALL = "https://wall.example.org/notice-383";

async function heldForPerson() {
  const c = crWorld().scene();
  const id = c.ask({ address: WALL, render: true }).request;
  const arm = captureArm({
    routes: { [WALL]: () => new Response("<html><title>Just a moment...</title></html>",
      { status: 403, headers: { "cf-mitigated": "challenge", "content-type": "text/html" } }) },
    env: { RENDERER: { fetch: async () => new Response("{}") } } });
  c.capture.script.set(WALL, [(body, opts) => arm.acquire(body, opts)]);
  c.tick(1000);
  await c.cr.drain({ now: c.clock.ms });
  return { id, held: c.cr.rendersHeld({ viewer: V("ann") }) };
}

test("notice machinery-producers:383 (R8, R45): a render the site held for a person reaches the feed as machinery-producers' render-deferred, waiting for a member's file, with its basis as given and no code in its words; control: the machinery feed answered", async () => {
  const { id, held } = await heldForPerson();
  const w = world({ captureRequests: { completed: () => ({ requests: [] }), leads: () => ({ requests: [] }), rendersHeld: () => held } });
  w.member("ann"); w.bundle("INQ-1", "inquiry");
  const r = w.read("ann");
  const it = byId(r)[`CONDITION::render-deferred::${id}`];
  assert.ok(it, `the item stands while the request waits: ${JSON.stringify(r.items.map((i) => i.id))}`);
  const row = held.requests.find((q) => q.request === id);
  const words = word("machinery-producers.index.site_asks_for_person");
  assert.equal(it.summary, word("machinery-producers.summary.render_waiting", { address: WALL, words }));
  assert.equal(it.detail, word("machinery-producers.index.words_the_request_waits_for_person", { words, expires: row.expires }));
  assert.deepEqual([it.basis.render.state, it.basis.needs_person, it.basis.asked_at],
                   ["waiting_for_person", true, row.asked_at]);
  assert.ok(!`${it.summary} ${it.detail}`.includes("SITE_ASKS_FOR_PERSON"), "no code in member text");
  assert.ok(!r.facts.failed.some((f) => f.feed === "machinery" && f.reason !== "partial"), "the machinery feed answered");
});
