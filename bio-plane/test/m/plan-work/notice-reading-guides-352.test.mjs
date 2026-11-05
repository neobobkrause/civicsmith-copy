/* Notice reading-guides:352 (T53; reading-guides R17-R20): procedure guides now stand one per layer (R17), a group guide
   may name its layer (R18), a profile guide lacking what it needs is left out of `guides` and named in `not_offered`
   (R19), and a sole member's guide opted out of review is offered with `not_reviewed` (R20). R10's `next_routes` reads
   only the offered guides' items, every one of them, in the order answered. The answers here are reading-guides' own,
   made by its real code in its own world when the test runs; only the kind and viewer asked are swapped for that
   world's (the call is this module's, unchanged). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { world as rgWorld, ANN } from "../reading-guides/fixture.mjs";
import { get as heldLayer, combine } from "../../../../jurisdictions/index.mjs";
import { canonicalJson, sha256HexSync } from "../../../src/record-grammar/index.mjs";

const KIND = "records_request";
const sha = (items) => sha256HexSync(canonicalJson(items));
const review = (items) => ({ reviewer: "Dee Example", kind: "professional", organisation: "Open Records Clinic (test)",
  credential: "attorney (test)", scope: "the whole guide", outcome: "no_concerns", at: "2026-08-25", reviewed_text_sha: sha(items) });
const guide = (items, over = {}) => ({ kind: KIND, items, notes: "", authored_by: "Ada Example", reviews: [review(items)],
  approved_by: "Cy Example", approved_at: "2026-09-02", status: "ruled", basis: "K5458", ...over });
const FED = [{ route: "Write to the agency's records officer", citation: "Test Fed. Stat. § 1(a)", after: ["denied"] }];
const CITY = [{ route: "Appeal to the City Clerk", citation: "Test City Code § 2", after: ["denied"] }];
const layers = (fed, city) => [{ ...heldLayer("us-federal"), procedure_guides: fed }, heldLayer("us-california"),
  heldLayer("us-ca-alameda-county"), { ...heldLayer("us-ca-oakland"), procedure_guides: city }];

/* plan-work's world with reading-guides' real procedureGuidesFor answering, for the kind and viewer swapped */
const over = (g, kind = KIND, viewer = ANN) => world({ deps: { readingGuides: {
  procedureGuidesFor: (a) => { calls.push(a); return g.procedureGuidesFor({ kind, viewer }); } } } });
let calls = [];
const denied = async (w) => {
  const s = w.started({ subjects: [w.S1] });
  w.correspond(s.action, "sent", "2026-10-01");
  const ord = w.correspond(s.action, "received", "2026-10-03", { account: "letter", outcome: "denied" });
  await w.settle();
  return w.reexamined(s.action, ord)[0].marks.filter((m) => m.kind === "next_routes").map((m) => m.routes);
};

test("R10 (notice reading-guides:352, R17): each layer's offered guide gives its routes; both layers' routes are one next_routes mark", async () => {
  const list = layers([guide(FED)], [guide(CITY)]);
  assert.equal(combine(list).ok, true);
  const rg = rgWorld({ profileList: list });
  const r = rg.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual(r.guides.map((g) => g.layer), ["us-federal", "us-ca-oakland"]);
  calls = [];
  assert.deepEqual(await denied(over(rg.g)), [[FED[0].route, CITY[0].route]]);
  assert.equal(calls.length, 1);
});

test("R10 (notice reading-guides:352, R19): a layer's guide not offered gives no route, and hides no other layer's", async () => {
  const rg = rgWorld({ profileList: layers([guide(FED)], [guide(CITY, { reviews: [] })]) });
  const r = rg.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual(r.not_offered, [{ kind: KIND, layer: "us-ca-oakland", lacks: ["professional_review"] }]);
  assert.deepEqual(await denied(over(rg.g)), [[FED[0].route]], "the city's route is not offered, so not a next route");
  /* control: with neither offered, no next_routes mark */
  const none = rgWorld({ profileList: layers([guide(FED, { reviews: [] })], [guide(CITY, { reviews: [] })]) });
  assert.deepEqual(await denied(over(none.g)), []);
});

test("R10 (notice reading-guides:352, R20): a sole member's guide opted out of review is offered beside the profile's; it names no outcome, so the next routes stay the profile's", async () => {
  const rg = rgWorld({ members: [["ann", "member", "active"]], profileList: layers([guide(FED)], []) });
  const steps = [{ route: "Ask the Clerk again", citation: "Test City Code § 3" }];
  const d = rg.g.guideDraft({ kind: KIND, purpose: "procedure", items: steps, by: ANN });
  assert.equal(d.ok, true, JSON.stringify(d));
  /* a group guide's item names no outcome: reading-guides refuses `after` on it */
  assert.equal(rg.g.guideDraft({ kind: KIND, purpose: "procedure", items: [{ ...steps[0], after: ["denied"] }], by: ANN }).ok, false);
  assert.equal(rg.g.guideOptOut({ guide: d.guide, viewer: ANN }).ok, true);
  const r = rg.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  const g = r.guides.find((x) => x.guide === d.guide);
  assert.ok(g && g.not_reviewed && !("reviewed" in g), "offered, not reviewed");
  assert.deepEqual(await denied(over(rg.g)), [[FED[0].route]]);
});
