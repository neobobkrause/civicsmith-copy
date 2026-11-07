/* question-explorer over capture-requests PR 182: capture-requests' door now reads a run's paying principal as ai-runs
   answers it (`principal_ai`, ai-runs R28 since PR 96) and keeps it in the request's own `principal_claude` column. The
   explorer's captures (R3) go through that door only, under its exploring run, so a request it asks now carries the run's
   paying owner. Confirmed with no change here: the explorer's capture, on the real capture-requests in this module's
   world, writes the owner on the request; and the same request as the explorer sent it, filed in capture-requests' own
   world under a run that ai-runs' real code opened from the explorer's own open, carries ai-runs' answer, attributed to
   both principals (capture-requests R10). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, Q } from "./fixture.mjs";
import { EXPLORE_PRINCIPAL } from "../../../src/question-explorer/index.mjs";
import { world as runsWorld, OPEN, INQ, T0 } from "../ai-runs/world.mjs";
import { world as crWorld, V } from "../capture-requests/fixture.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";
import { captureRequestAttribution } from "../../../src/capture-requests/index.mjs";

const ADDRESS = "https://records.example.org/minutes-2026-10";

test("notice capture-requests:182 (R3): the explorer's capture of a held address is filed through capture-requests under the exploring run, the request carrying the run's paying owner (principal_claude) and its step; control: an address the record does not hold files no request and is named to members as a page", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  w.hold(ADDRESS);
  const a = w.p.capture({ run: o.run, address: ADDRESS, caller: EXPLORE_PRINCIPAL });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const row = w.row(`SELECT * FROM capture_requests WHERE request=?`, a.request);
  assert.deepEqual([row.run, row.target, row.step, row.principal_plane, row.principal_claude],
                   [o.run, Q, o.step, EXPLORE_PRINCIPAL, "group"], JSON.stringify(row).slice(0, 400));
  assert.equal(captureRequestAttribution(row).ok, true, "attributed to both principals (capture-requests R10)");
  /* control: an address the record does not hold (capture-requests R49) */
  const before = w.count("capture_requests");
  const n = w.p.capture({ run: o.run, address: "https://elsewhere.example.org/x", caller: EXPLORE_PRINCIPAL });
  assert.deepEqual([n.ok, n.code, n.named_to_members], [false, "CAPTURE_REQUEST_ADDRESS_NOT_HELD", true]);
  assert.equal(w.count("capture_requests"), before);
});

test("notice capture-requests:182 (R3; ai-runs R28): the explorer's capture request as sent, under a run ai-runs' real code opened from the explorer's own open, is filed by capture-requests' real door with principal_claude the run's principal_ai; control: the same request naming a run ai-runs does not hold is refused CAPTURE_REQUEST_NO_RUN", async () => {
  /* The explorer's own open and capture request, as it sent them. */
  const w = await world().standard();
  const o = await w.openRun("group");
  const [open] = w.calledAs("open");
  w.hold(ADDRESS);
  const sent = [];
  const real = w.captureRequests.captureRequest.bind(w.captureRequests);
  w.captureRequests.captureRequest = (args, opts) => { sent.push({ args, opts }); return real(args, opts); };
  assert.equal(w.p.capture({ run: o.run, address: ADDRESS, caller: EXPLORE_PRINCIPAL }).ok, true);
  const [{ args, opts }] = sent;
  assert.deepEqual([args.run, args.target, args.address], [o.run, Q, ADDRESS]);

  /* ai-runs' real world opens the explorer's run, its owner moved to a member there who holds an account. */
  const f = stepsWorld();
  const r = runsWorld({ steps: f.steps, deployedModes: ["check", "investigate"] });
  await r.group("ann"); r.bundle(INQ);
  await r.runs.open(OPEN({ run: "V" }));
  assert.equal(r.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  const x = await r.runs.open({ ...open, contextId: INQ, place: f.place, at: T0, principalAi: "member:ann", enabledBy: "member:ann" });
  assert.equal(x.started, true, JSON.stringify(x).slice(0, 300));
  const sight = r.runs.runFor(open.run, EXPLORE_PRINCIPAL);
  assert.equal(sight && sight.principal_ai, "member:ann", JSON.stringify(sight).slice(0, 300));

  /* capture-requests' own world over ai-runs' real run sight: the explorer's request, its question moved to INQ. */
  const c = crWorld({ runs: r.runs });
  c.bundle(INQ);
  c.hold(ADDRESS);
  const filed = c.cr.captureRequest({ ...args, target: INQ, step: null }, opts);
  assert.equal(filed.ok, true, JSON.stringify(filed).slice(0, 300));
  const row = c.req(filed.request);
  assert.deepEqual([row.principal_plane, row.principal_claude], [EXPLORE_PRINCIPAL, "member:ann"]);
  assert.deepEqual(captureRequestAttribution(row).principals, { plane: EXPLORE_PRINCIPAL, claude: "member:ann" });
  /* control */
  const none = c.cr.captureRequest({ ...args, run: "XPL-none", target: INQ, step: null }, opts);
  assert.deepEqual([none.ok, none.code], [false, "CAPTURE_REQUEST_NO_RUN"]);
  assert.equal(V("ann"), "member:ann");
});
