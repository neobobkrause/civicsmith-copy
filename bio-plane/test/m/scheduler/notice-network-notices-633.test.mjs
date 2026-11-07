/* scheduler — the provider notice network-notices:633 (network-notices PR 633, T53): network-notices added the export
   `NetworkNotices.listingRequest` (its R32, a member's request for a listing on civicsmith.org) and changed no service this
   module calls. The `working-on-seal` and `working-on-attest` consumers (R5) still call `sealDue`/`sealWake`/`sealTick` and
   `attestDue`/`attestWake`/`attestTick` alone; this checks, against the real network-notices in its own test world, that a
   firing seals the last complete week through them and never asks for a listing. No code of this module changed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "../../../src/scheduler/index.mjs";
import { storage } from "./fixture.mjs";
import { seeded, NOW, DAY, WEEK, monday } from "../network-notices/fixture.mjs";

test("notice network-notices:633, R5, R1: a firing over the real network-notices seals the last complete week under workingonseal and never calls listingRequest; control: once sealed, neither consumer is due and no seal wake is held", async () => {
  const w = seeded();
  const LAST = monday(NOW) - WEEK;
  w.act(w.P, LAST + DAY);
  let listings = 0;
  const listing = w.nn.listingRequest;
  assert.equal(typeof listing, "function", "the export PR 633 added");
  w.nn.listingRequest = (...a) => { listings++; return listing.apply(w.nn, a); };
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { networkNotices: () => w.nn } });
  assert.deepEqual(s.consumers(), ["working-on-seal", "working-on-attest"]);
  const r = await s.onAlarm(NOW);
  assert.equal(r.workingonseal.ok, true, JSON.stringify(r.workingonseal).slice(0, 300));
  assert.equal(r.workingonseal.sealed.length, 1, "the last complete week sealed");
  assert.equal(listings, 0, "no listing is ever asked for by the alarm");
  /* control */
  const again = await s.onAlarm(NOW + 1000);
  assert.deepEqual(["workingonseal" in again, "workingonattest" in again], [false, false]);
  assert.equal(w.nn.sealWake(NOW + 1000), null);
  assert.equal(listings, 0);
});
