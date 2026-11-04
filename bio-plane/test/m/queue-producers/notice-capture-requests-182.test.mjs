/* Notice capture-requests:182 (PR 182; ai-runs R9, R28): capture-requests now files a run's request with the run's paying
   principal read from ai-runs' `principal_ai` (it read `principal_claude`, which ai-runs no longer answers, so the row's
   principal was "" and its attribution failed). This module's out-of-inquiry lead (R2, R10) reads `capture-requests.leads`
   and raises an item only for a row whose `attribution.ok` holds (index.mjs `#findingsOutOfInquiryLead`). Confirmed with
   no code change here: over ai-runs' REAL run (its test world) and capture-requests' REAL door, drain and `leads` (its
   test world), a lead captured under the run is one item naming both principals; with PR 182 reverted the row carries no
   paying principal, the drain refuses it, and no lead reaches this module. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as aiWorld, OPEN, INQ, ANN } from "../ai-runs/world.mjs";
import { world as crWorld, V } from "../capture-requests/fixture.mjs";
import { world, byId } from "./world.mjs";

/* the run's plane principal: a member's token, so the drain judges the held address in her sight (capture-requests R49) */
const ORG = "member:ann/tok1";
const LEAD = "INQ-2026-0002-lead";

test("notice capture-requests:182 (R2, R10): a lead captured under a run ai-runs opened (principal_ai) is one out-of-inquiry-lead item, homed under the lead's question, whose attribution names the run's paying principal; control: a request with no paying principal, as before PR 182, is refused at the drain and raises none", async () => {
  const aw = aiWorld();
  await aw.group("ann");
  aw.bundle(INQ);
  const opened = await aw.runs.open(OPEN({ principalPlane: ORG }));
  assert.equal(opened.started, true, JSON.stringify(opened).slice(0, 300));

  /* capture-requests over ai-runs' real run sight: the request is filed, drained and captured by its own code */
  const cw = crWorld({ runs: aw.runs });
  cw.bundle(INQ); cw.bundle(LEAD);
  const address = "https://example.org/notice-182";
  cw.hold(address);
  const asked = cw.cr.captureRequest({ run: "R1", address, target: INQ, lead: LEAD, purpose: "investigate" },
                                     { viewer: V("ann"), caller: ORG });
  assert.equal(asked.ok, true, JSON.stringify(asked).slice(0, 300));
  await cw.cr.drain({});
  const row = cw.req(asked.request);
  assert.equal(row.state, "captured", JSON.stringify(row).slice(0, 400));
  assert.equal(row.principal_claude, ANN, "the row keeps the run's principal_ai (PR 182)");

  /* this module's feed over capture-requests' real `leads` */
  const w = world({ captureRequests: { completed: () => ({ requests: [] }), leads: (a) => cw.cr.leads(a),
                                       rendersHeld: () => ({ requests: [] }) } });
  w.bundle(INQ, "inquiry"); w.bundle(LEAD, "inquiry"); w.bundle("PRJ-L", "project"); w.cite("PRJ-L", LEAD);
  const r = w.read(null, "class:admin");
  const item = byId(r)[`FINDING::out-of-inquiry-lead::${asked.request}`];
  assert.ok(item, `the lead is raised: ${JSON.stringify(r.items.map((i) => i.id))}`);
  assert.deepEqual([item.basis.attribution.ok, item.basis.attribution.principals], [true, { plane: ORG, claude: ANN }],
    "both principals, the paying one the run's principal_ai");
  assert.deepEqual([item.basis.found_while_working, item.basis.bears_on, item.basis.run], [INQ, LEAD, "R1"]);
  assert.deepEqual(item.case.ancestors.map((a) => a.id), ["PRJ-L"], "homed under the question it bears on");
  assert.deepEqual(r.facts.failed, [], "the leads feed answered");

  /* control, the state before PR 182: a run's request filed with no paying principal (principal_claude "") is refused by
     capture-requests' drain (its R10, CAPTURE_ATTRIBUTION_ONE_PRINCIPAL), so `leads` answers it nothing and no lead is raised */
  const unpaid = "https://example.org/notice-182-unpaid";
  cw.hold(unpaid);
  const before = cw.cr.captureRequest({ run: "R1", address: unpaid, target: INQ, lead: LEAD, purpose: "investigate" },
                                      { viewer: V("ann"), caller: ORG });
  assert.equal(before.ok, true, JSON.stringify(before).slice(0, 300));
  cw.st.sql.exec(`UPDATE capture_requests SET principal_claude='' WHERE request=?`, before.request);
  await cw.cr.drain({});
  assert.deepEqual([cw.req(before.request).state, cw.req(before.request).code], ["refused", "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL"]);
  const after = w.read(null, "class:admin");
  assert.deepEqual(after.items.filter((i) => i.kind === "out-of-inquiry-lead").map((i) => i.id),
                   [`FINDING::out-of-inquiry-lead::${asked.request}`], "only the attributed lead");
});
