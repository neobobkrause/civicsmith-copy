/* store-assembly: the provider notice reading-guides:352 (PR 352; reading-guides R17 to R20, exports NOT_REVIEWED_LABEL and
   ReadingGuides.guideOptOut). Confirmed, no code change: R31 spreads `readingGuidesOps` over the one `readingGuidesOf(ctx)`
   instance (assemble.mjs), so the new mutating op `guideoptout` reaches its owner's arm through the store's door with the
   viewer the address carries; R83 hands reading-guides' `DECLARED_OPS` to the registrations whole (declarations.mjs), so
   `guideoptout`'s row is held under its owner's name with no entry of it named here (R97); and `procedureguides` answers the
   owner's `not_reviewed` record and `NOT_REVIEWED_LABEL` as given. The guide is drafted by reading-guides' own act on the
   world's one instance; the founder is the claimed world's one member, the test profile's action kind the guide's. */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./world.mjs";
import { readingGuidesOf, DECLARED_OPS as RG_DECLARED, NOT_REVIEWED_LABEL } from "../../../src/reading-guides/index.mjs";
import { OWNERS } from "../../../src/store-assembly/declarations.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";

const STEPS = [{ route: "Write to the Clerk", citation: "Test City Code § 3" }];
const answer = async (res) => { const j = await res.json(); return j.result ?? j; };

test("notice reading-guides:352 (R31, R6, R7): guideoptout, sent through the store's door by the team's one member, reaches reading-guides' arm on the assembly's instance: the guide records review_opt_out and procedureguides answers it not_reviewed with NOT_REVIEWED_LABEL; control: a guide not opted out is not answered", async () => {
  const w = await storeWorld();
  /* the test profile (Port Ellery) lists the action kind; no place is named by the assembly (R97) */
  assert.equal(recordOf(w.ctx).setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:admin").ok, true);
  const g = readingGuidesOf(w.ctx);
  const d = g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: "admin" });
  assert.equal(d.ok, true, JSON.stringify(d));
  const other = g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: "admin" }).guide;
  const o = await answer(await w.send({ url: `http://x/guideoptout?guide=${d.guide}&viewer=admin`, method: "POST", body: { guide: d.guide } }));
  assert.equal(o.ok, true, JSON.stringify(o));
  assert.equal(o.review_opt_out.member, "admin");
  assert.deepEqual(g.guideRead({ guide: d.guide, viewer: "admin" }).guide.review_opt_out, o.review_opt_out, "written on the assembly's one instance");
  const read = await answer(await w.send({ url: "http://x/procedureguides?kind=bylaw_complaint&viewer=admin" }));
  const mine = read.guides.find((x) => x.guide === d.guide);
  assert.ok(mine, JSON.stringify(read).slice(0, 400));
  assert.deepEqual([mine.not_reviewed, mine.label], [o.review_opt_out, { ...NOT_REVIEWED_LABEL }]);
  assert.ok(!read.guides.some((x) => x.guide === other), "control: a guide neither reviewed nor opted out is not offered");
});

test("notice reading-guides:352 (R83): guideoptout's declaration is reading-guides' own row, held whole under its owner's name and registered mutating; the assembly names no row of it", () => {
  assert.equal(OWNERS["reading-guides"], RG_DECLARED);
  assert.equal(OWNERS["reading-guides"].guideoptout, RG_DECLARED.guideoptout);
  assert.equal(OPS.guideoptout.mutating, true);
  assert.deepEqual(OPS.guideoptout.classes, RG_DECLARED.guideoptout.classes);
  for (const [owner, rows] of Object.entries(OWNERS)) if (owner !== "reading-guides") assert.ok(!("guideoptout" in rows), `${owner} declares guideoptout`);
});
