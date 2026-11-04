/* Notice ai-runs:96 (T53; ai-runs R9, R28): ai-runs now answers a run's paying principal as `principal_ai` (it was
   `principal_claude`). This module's door records it as the request's `principal_claude` (R8), and the drain refuses a
   request missing it (R10, CAPTURE_ATTRIBUTION_ONE_PRINCIPAL). Here the run is opened by ai-runs' real code and its real
   `runFor` is the run sight the door reads, so the row carries the run's principal and its attribution names both. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as aiWorld, OPEN, INQ, ORG, ANN } from "../ai-runs/world.mjs";
import { world, V } from "./fixture.mjs";
import { captureRequestAttribution } from "../../../src/capture-requests/index.mjs";

test("notice ai-runs:96 R8, R10: a run opened by ai-runs (principalAi) files a request whose principal_claude is the run's principal_ai, attributed to both principals; control: a run sight naming no principal is refused CAPTURE_ATTRIBUTION_ONE_PRINCIPAL", async () => {
  const aw = aiWorld();
  await aw.group("ann");
  aw.bundle(INQ);
  const opened = await aw.runs.open(OPEN());
  assert.equal(opened.started, true, JSON.stringify(opened).slice(0, 300));
  const sight = aw.runs.runFor("R1", V("ann"));
  assert.equal(sight && sight.principal_ai, ANN, "ai-runs R28 answers the paying principal as principal_ai");

  const w = world({ runs: aw.runs });
  w.bundle(INQ);
  const address = "https://example.org/notice-96";
  w.hold(address);
  const a = w.cr.captureRequest({ run: "R1", address, target: INQ, purpose: "investigate" }, { viewer: V("ann"), caller: ORG });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  assert.deepEqual(a.principals, { plane: ORG, claude: ANN });
  const row = w.req(a.request);
  assert.deepEqual([row.principal_plane, row.principal_claude], [ORG, ANN]);
  const att = captureRequestAttribution(row);
  assert.equal(att.ok, true, JSON.stringify(att));
  assert.deepEqual(att.principals, { plane: ORG, claude: ANN });

  /* control: the composer still refuses a run's row with no paying principal (R10) */
  assert.equal(captureRequestAttribution({ ...row, principal_claude: "" }).code, "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL");
});
