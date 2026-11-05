/* reading-guides:352 (its R17, R18, R20; N1257, N858; K5458, K5508): the procedure_guide layer (R46) over
 * `procedureGuidesFor`'s real answer, produced by the provider's own code on its own test world when the test runs
 * (K4990): each guide keeps the layer it names, so two layers' guides for one kind render apart, and a guide its team's
 * sole member opted out of review keeps its `not_reviewed` record and its statement label. Each with a control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get as heldLayer } from "../../../../jurisdictions/index.mjs";
import { canonicalJson, sha256HexSync } from "../../../src/record-grammar/index.mjs";
import { NOT_REVIEWED_LABEL, PROCEDURE_GUIDE_LABEL } from "../../../src/reading-guides/index.mjs";
import { procedureGuideLayer } from "../../../src/skilldoctrine.mjs";
import { renderPack } from "../../../src/skillpack.mjs";
import { world, ANN } from "../reading-guides/fixture.mjs";
import { published } from "./fixture.mjs";

const KIND = "records_request";
const sha = (items) => sha256HexSync(canonicalJson(items));
const FED = [{ route: "Write to the agency's records officer", citation: "Test Fed. Stat. § 1(a)" }];
const CITY = [{ route: "Write to the City Clerk", expect: "a reply within ten days", citation: "Test City Code § 2" }];
const review = (items) => ({ reviewer: "Dee Example", kind: "professional", organisation: "Open Records Clinic (test)",
  credential: "attorney (test)", scope: "the whole guide", outcome: "no_concerns", at: "2026-08-25", reviewed_text_sha: sha(items) });
const guide = (items) => ({ kind: KIND, items, notes: "", authored_by: "Ada Example", reviews: [review(items)],
  approved_by: "Cy Example", approved_at: "2026-09-02", status: "ruled", basis: "K5458" });
const layers = () => [
  { ...heldLayer("us-federal"), procedure_guides: [guide(FED)] }, heldLayer("us-california"), heldLayer("us-ca-alameda-county"),
  { ...heldLayer("us-ca-oakland"), procedure_guides: [guide(CITY)] }];

test("reading-guides R17 R46 two layers' procedure guides for one kind render side by side, each naming its layer", () => {
  const answer = world({ profileList: layers() }).g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  const layer = procedureGuideLayer(answer);
  assert.equal(layer.sourcing, "guide");
  const [proc] = layer.body.procedures;
  assert.deepEqual(proc.guides.map((g) => [g.origin, g.layer, g.items]),
    [["profile", "us-federal", FED], ["profile", "us-ca-oakland", CITY]]);
  assert.deepEqual(proc.label, { ...PROCEDURE_GUIDE_LABEL });
  /* R11: a pack under the two layers' guides differs from one where the layers are not named. */
  const unnamed = { ...answer, guides: answer.guides.map(({ layer, ...g }) => g) };
  assert.notEqual(renderPack(published(), { procedure_guides: answer }).version,
                  renderPack(published(), { procedure_guides: unnamed }).version);
  /* control: an answer naming no layer renders no `layer` key */
  for (const g of procedureGuideLayer(unnamed).body.procedures[0].guides) assert.ok(!("layer" in g));
});

test("reading-guides R20 R46 a guide its team's sole member opted out of review renders with not_reviewed and its statement label, never as reviewed", () => {
  const w = world({ members: [["ann", "member", "active"]] });
  const STEPS = [{ route: "Write to the Clerk", citation: "Test City Code § 3" }];
  const d = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  const o = w.g.guideOptOut({ guide: d, viewer: ANN });
  assert.equal(o.ok, true, JSON.stringify(o));
  const answer = w.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN });
  const g = procedureGuideLayer(answer).body.procedures[0].guides.find((x) => x.guide === d);
  assert.ok(g, "the opted-out guide renders");
  assert.deepEqual(g.not_reviewed, o.review_opt_out);
  assert.deepEqual(g.label, { ...NOT_REVIEWED_LABEL });
  assert.ok(!("reviewed" in g));
  /* control: a guide with no opt-out carries neither */
  const [p] = procedureGuideLayer(world({ profileList: layers() }).g.procedureGuidesFor({ kind: KIND, viewer: ANN })).body.procedures[0].guides;
  assert.ok(!("not_reviewed" in p) && !("label" in p));
});
