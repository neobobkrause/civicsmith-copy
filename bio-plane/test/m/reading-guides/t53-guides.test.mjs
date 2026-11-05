/* reading-guides, T53 (N1257, N858; DEC-404; K5458, K5508, K5527, K5528): procedure guides side by side, one per layer
   (R17); a group guide drafted from a layer's guide records it (R18); a profile guide offered only when it has all
   three (R19); a sole member's opt-out of review (R20). Over the real modules: the layers are `jurisdictions`' held
   layers, combined by its own `combine`, each given a procedure guide here as test input (`jurisdictions` holds none
   yet), so its own `validate` judges every one; what a guide lacks and what it says of its review are its own
   `attributionLacks` and `textStanding`. */
import test from "node:test";
import assert from "node:assert/strict";
import { get as heldLayer, combine, attributionLacks, textStanding } from "../../../../jurisdictions/index.mjs";
import { canonicalJson, sha256HexSync } from "../../../src/record-grammar/index.mjs";
import * as RG from "../../../src/reading-guides/index.mjs";
const { PROCEDURE_GUIDE_LABEL, readingGuidesOps, DECLARED_OPS } = RG;
import { declaredOpHolds } from "../../declared-ops.mjs";
import { world, row, ANN, BOB, MACHINE } from "./fixture.mjs";

const KIND = "records_request";   // an action kind of both the federal and the city layer
const DAY = "2026-10-09";         // the fixture's clock
const sha = (items) => sha256HexSync(canonicalJson(items));
const FED = [{ route: "Write to the agency's records officer", citation: "Test Fed. Stat. § 1(a)" }];
const CITY = [{ route: "Write to the City Clerk", expect: "a reply within ten days", citation: "Test City Code § 2" }];
const review = (items, over = {}) => ({ reviewer: "Dee Example", kind: "professional", organisation: "Open Records Clinic (test)",
  credential: "attorney (test)", scope: "the whole guide", outcome: "no_concerns", at: "2026-08-25", reviewed_text_sha: sha(items), ...over });
/* a profile guide with all three: a named writer, its items (each cited), a counted professional review, a second approver */
const guide = (items, over = {}) => ({ kind: KIND, items, notes: "", authored_by: "Ada Example", reviews: [review(items)],
  approved_by: "Cy Example", approved_at: "2026-09-02", status: "ruled", basis: "K5458", ...over });
/* the four held layers, federal to city, the federal and the city each given the guides named */
const layers = (fed = [guide(FED)], city = [guide(CITY)]) => [
  { ...heldLayer("us-federal"), procedure_guides: fed }, heldLayer("us-california"), heldLayer("us-ca-alameda-county"),
  { ...heldLayer("us-ca-oakland"), procedure_guides: city }];
const STEPS = [{ route: "Write to the Clerk", citation: "Test City Code § 3" }];
const keys = (r) => r.guides.map((g) => [g.origin, g.layer ?? null, g.guide ?? null]);

test("R17 procedure guides stand side by side, one per layer: a federal and a city guide for records_request both appear, each naming its layer, unranked", () => {
  const list = layers();
  const c = combine(list);
  assert.equal(c.ok, true, JSON.stringify(c.errors));
  const w = world({ profileList: list });
  const r = w.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual(keys(r), [["profile", "us-federal", null], ["profile", "us-ca-oakland", null]]);
  assert.deepEqual(r.guides.map((g) => g.items), [FED, CITY]);
  assert.deepEqual(r.label, { ...PROCEDURE_GUIDE_LABEL });
  assert.deepEqual(r.withheld, []);
  assert.ok(!("not_offered" in r), "both are offered");
  for (const g of r.guides) for (const k of ["rank", "score", "preferred", "recommended", "order"]) assert.ok(!(k in g), k);
  /* a viewer outside the team sees both layers' guides too: they are the profile's */
  assert.deepEqual(keys(w.g.procedureGuidesFor({ kind: KIND, viewer: "stranger" })), keys(r));
  /* one layer's guide alone is answered alone, naming its layer */
  assert.deepEqual(keys(world({ profileList: layers([], [guide(CITY)]) }).g.procedureGuidesFor({ kind: KIND, viewer: ANN })),
    [["profile", "us-ca-oakland", null]]);
  /* control: a guide with an item lacking its citation is still GUIDE_ITEM_UNSOURCED */
  row(w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [{ route: "Write to the Clerk" }], by: ANN }), "GUIDE_ITEM_UNSOURCED");
});

test("R18 a group guide drafted from a layer's guide records the layer; it stands beside the layer's own guide, never in its place; a guide with no layer answers none", () => {
  const w = world({ profileList: layers() });
  const d = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, layer: "us-ca-oakland", by: ANN });
  assert.deepEqual([d.ok, d.layer], [true, "us-ca-oakland"]);
  assert.equal(w.g.guideRead({ guide: d.guide, viewer: ANN }).guide.layer, "us-ca-oakland");
  w.g.guideReview({ guide: d.guide, verdict: "approve", by: BOB });
  /* a second group guide drafted from the city's guide stands beside the first */
  const d2 = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [{ route: "Ask the City Auditor", citation: "Test City Code § 4" }],
                              layer: "us-ca-oakland", by: BOB });
  w.g.guideReview({ guide: d2.guide, verdict: "approve", by: ANN });
  const r = w.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual(keys(r), [["profile", "us-federal", null], ["profile", "us-ca-oakland", null],
                             ["group", "us-ca-oakland", d.guide], ["group", "us-ca-oakland", d2.guide]]);
  assert.deepEqual(r.guides[1].items, CITY, "the city's own guide is answered as it is");
  /* refused: a layer not active, a layer giving no guide for the kind, a layer on a reading guide; nothing written */
  const before = w.count("reading_guides");
  for (const [layer, purpose, kind, items] of [["us-ca-berkeley", "procedure", KIND, STEPS], ["us-california", "procedure", KIND, STEPS],
                                               ["us-ca-oakland", "reading", "staff_report", undefined]]) {
    const a = { kind, purpose, layer, by: ANN, ...(items ? { items } : { items: [{ label: "L", look_for: "Look for the date" }] }) };
    const x = w.g.guideDraft(a);
    row(x, "GUIDE_BASED_ON_UNKNOWN");
    assert.equal(x.layer, layer);
  }
  assert.equal(w.count("reading_guides"), before);
  /* control: a guide drafted with no layer is the team's in every layer, and answers no `layer`, as before the change */
  const plain = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN });
  assert.ok(!("layer" in plain));
  assert.ok(!("layer" in w.g.guideRead({ guide: plain.guide, viewer: ANN }).guide));
  w.g.guideReview({ guide: plain.guide, verdict: "approve", by: BOB });
  assert.ok(!("layer" in w.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.find((g) => g.guide === plain.guide)));
});

test("R18 R20 a store made before T53 gains `layer`, `review_opt_json` and `reviews_json`, empty: its guides answer as before", () => {
  const w = world();
  w.st.db.exec(`ALTER TABLE reading_guides DROP COLUMN layer`);
  w.st.db.exec(`ALTER TABLE reading_guides DROP COLUMN review_opt_json`);
  w.st.db.exec(`ALTER TABLE reading_guides DROP COLUMN reviews_json`);
  w.st.db.exec(`INSERT INTO reading_guides (guide_id, kind, purpose, origin, items_json, state, author, created_at, updated_at)
                VALUES ('GUD-2026-0000000000000009', 'bylaw_complaint', 'procedure', 'group', '${canonicalJson(STEPS)}', 'usable_by_author', 'ann', 'x', 'x')`);
  w.g.migrate();
  w.g.migrate();   // idempotent
  const g = w.g.guideRead({ guide: "GUD-2026-0000000000000009", viewer: ANN }).guide;
  assert.ok(!("layer" in g) && !("review_opt_out" in g));
  assert.deepEqual(w.rows(`SELECT layer, review_opt_json, reviews_json FROM reading_guides`), [{ layer: null, review_opt_json: null, reviews_json: null }]);
});

test("R19 a profile procedure guide is offered only when it has all three, and says what it lacks otherwise; a layer's guide not offered hides no other's", () => {
  /* no professional review: absent from `guides`, named in `not_offered` with professional_review */
  const unreviewed = guide(CITY, { reviews: [] });
  assert.deepEqual(attributionLacks(unreviewed), ["professional_review"]);
  const a = world({ profileList: layers([guide(FED)], [unreviewed]) });
  const r = a.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual(keys(r), [["profile", "us-federal", null]], "the federal guide is still offered");
  assert.deepEqual(r.not_offered, [{ kind: KIND, layer: "us-ca-oakland", lacks: ["professional_review"] }]);
  /* the same guide with a no_concerns professional review: answered with status, basis and reviewed */
  const b = world({ profileList: layers([guide(FED)], [guide(CITY)]) }).g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  const city = b.guides.find((g) => g.layer === "us-ca-oakland");
  assert.deepEqual([city.status, city.basis], ["ruled", "K5458"]);
  assert.deepEqual(city.reviewed, { name: "Dee Example", organisation: "Open Records Clinic (test)", at: "2026-08-25" });
  assert.deepEqual(city.statements, textStanding(guide(CITY), DAY).statements);
  assert.deepEqual(city.statements.map((s) => s.key), ["text.reviewedby"]);
  assert.ok(!("not_offered" in b));
  /* a review that is not of the outcome no_concerns, or not a professional's, does not count */
  for (const over of [{ outcome: "concerns" }, { kind: "peer" }]) {
    const x = guide(CITY, { reviews: [review(CITY, over)] });
    if (combine(layers([], [x])).ok !== true) continue;   // a value the profile's own shape refuses is no case here
    assert.deepEqual(world({ profileList: layers([], [x]) }).g.procedureGuidesFor({ kind: KIND, viewer: ANN }).not_offered,
      [{ kind: KIND, layer: "us-ca-oakland", lacks: ["professional_review"] }], JSON.stringify(over));
  }
  /* the same guide with its items edited after the review: not answered, lacking professional_review */
  const edited = [{ ...CITY[0], route: "Write to the City Clerk and the Mayor" }];
  const e = world({ profileList: layers([], [{ ...guide(CITY), items: edited }]) }).g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual([e.guides, e.not_offered], [[], [{ kind: KIND, layer: "us-ca-oakland", lacks: ["professional_review"] }]]);
  /* a flagged source keeps it offered with the changed-source line; a review over 12 months old adds the last-checked line */
  const flagged = guide(CITY, { source_check: { flag: true, changed_on: "2026-10-01", checked_on: "2026-09-01" } });
  const f = world({ profileList: layers([], [flagged]) }).g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides[0];
  assert.deepEqual(f.statements.map((s) => s.key), ["text.reviewedby", "text.sourcechanged"]);
  const old = guide(CITY, { reviews: [review(CITY, { at: "2025-08-01" })], approved_at: "2025-08-02" });
  const o = world({ profileList: layers([], [old]) }).g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides[0];
  assert.deepEqual(o.statements, textStanding(old, DAY).statements);
  assert.deepEqual(o.statements.map((s) => s.key), ["text.reviewedby", "text.lastchecked"]);
  /* a profile that is no layer: its guide lacking is named with its kind alone */
  const pe = heldLayer("test-port-ellery");
  const bare = { ...pe, procedure_guides: pe.procedure_guides.map((g) => ({ ...g, reviews: [] })) };
  const p = world({ profileList: [bare] }).g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN });
  assert.deepEqual([p.guides, p.not_offered], [[], [{ kind: "bylaw_complaint", lacks: ["professional_review"] }]]);
  /* a group guide approved by a second member is answered as before, whatever the profile's lacks */
  const id = a.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN }).guide;
  a.g.guideReview({ guide: id, verdict: "approve", by: BOB });
  const grp = a.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.find((g) => g.guide === id);
  assert.deepEqual(grp, { guide: id, origin: "group", items: STEPS, approved_by: "bob", approved_at: DAY });
  /* control: a kind with no profile guide answers `guides: []` and the label */
  assert.deepEqual(world({ profileList: layers() }).g.procedureGuidesFor({ kind: "grand_jury", viewer: ANN }),
    { ok: true, kind: "grand_jury", guides: [], withheld: [], label: { ...PROCEDURE_GUIDE_LABEL } });
});

const SOLE = [["ann", "member", "active"]];
const addMember = (w, m) => w.st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES (?, 'c', 'member', 'active', '2026-01-01', '2026-01-01')`, m);

test("R20 the sole member of a team opts its own guide out of review: answered with not_reviewed (who and when) and the statement key, never `reviewed`", () => {
  const w = world({ members: SOLE });
  const d = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  assert.ok(!w.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN }).guides.some((g) => g.guide === d), "control: before, not answered");
  const o = w.g.guideOptOut({ guide: d, viewer: ANN });
  assert.equal(o.ok, true, JSON.stringify(o));
  assert.equal(o.review_opt_out.member, "ann");
  assert.match(o.review_opt_out.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(w.g.guideRead({ guide: d, viewer: ANN }).guide.review_opt_out, o.review_opt_out);
  assert.equal(w.g.guideRead({ guide: d, viewer: ANN }).history.at(-1).act, "opt_out");
  const g = w.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN }).guides.find((x) => x.guide === d);
  assert.deepEqual(g, { guide: d, origin: "group", items: STEPS, not_reviewed: o.review_opt_out, label: { ...RG.NOT_REVIEWED_LABEL } });
  assert.equal(g.label.key, "guide.procedure.notreviewed");
  assert.ok(!("reviewed" in g), "no `reviewed` key, not even false");
  /* asked again, it answers the record it holds */
  assert.deepEqual(w.g.guideOptOut({ guide: d, viewer: ANN }), { ok: true, already: true, guide: d, review_opt_out: o.review_opt_out });
  /* through the door: the viewer from the URL */
  const d2 = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  assert.equal(readingGuidesOps(w.g, new URL(`https://x/?guide=${d2}&viewer=${ANN}`), { viewer: MACHINE }).guideoptout().ok, true);
});

test("R20 refused, recording nothing: a team of two (OPT_OUT_NOT_SOLE_MEMBER), a machine (MACHINE_CANNOT_OPT_OUT); a guide lacking a citation stays refused", () => {
  const two = world({ members: [...SOLE, ["bob", "member", "active"]] });
  const d = two.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  const hist = () => two.count("reading_guide_history");
  const before = hist();
  row(two.g.guideOptOut({ guide: d, viewer: ANN }), "OPT_OUT_NOT_SOLE_MEMBER");
  row(two.g.guideOptOut({ guide: d, viewer: MACHINE }), "MACHINE_CANNOT_OPT_OUT");
  const sole = world({ members: SOLE });
  const s = sole.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  row(sole.g.guideOptOut({ guide: s, viewer: MACHINE }), "MACHINE_CANNOT_OPT_OUT");
  row(sole.g.guideOptOut({ guide: s, viewer: "stranger" }), "GUIDE_MEMBER_ACT");
  assert.equal(hist(), before);
  assert.ok(!("review_opt_out" in two.g.guideRead({ guide: d, viewer: ANN }).guide));
  assert.ok(!("review_opt_out" in sole.g.guideRead({ guide: s, viewer: ANN }).guide));
  assert.deepEqual(two.rows(`SELECT review_opt_json FROM reading_guides`), [{ review_opt_json: null }]);
  /* the item citations are still required after an opt-out */
  assert.equal(sole.g.guideOptOut({ guide: s, viewer: ANN }).ok, true);
  row(sole.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: [{ route: "Write to the Clerk" }], by: ANN }), "GUIDE_ITEM_UNSOURCED");
  /* control: in the team of two, a group guide approved by the second member is answered as before, with no not_reviewed */
  two.g.guideReview({ guide: d, verdict: "approve", by: "member:bob" });
  const g = two.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN }).guides.find((x) => x.guide === d);
  assert.deepEqual(g, { guide: d, origin: "group", items: STEPS, approved_by: "bob", approved_at: DAY });
});

test("R20 only the team's own procedure guide may be opted out: an adopted guide and a reading guide are refused OPT_OUT_NOT_OWN_GUIDE and write nothing", () => {
  const a = world({ slug: "group-a" });
  const offered = a.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  a.g.guideReview({ guide: offered, verdict: "approve", by: BOB });
  const sole = world({ members: SOLE, slug: "group-b" });
  const adopted = sole.g.guideAdopt({ bytes: a.g.guideOffer({ guide: offered, by: ANN }).bytes, by: ANN }).guide;
  const reading = sole.g.guideDraft({ kind: "staff_report", items: [{ label: "Fiscal impact", look_for: "Look for the fiscal impact" }], by: ANN }).guide;
  const own = sole.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  const snapshot = () => JSON.stringify([sole.rows(`SELECT * FROM reading_guides ORDER BY guide_id`), sole.count("reading_guide_history")]);
  const before = snapshot();
  for (const id of [adopted, reading]) {
    const r = sole.g.guideOptOut({ guide: id, viewer: ANN });
    row(r, "OPT_OUT_NOT_OWN_GUIDE");
    assert.equal(r.guide, id);
  }
  assert.equal(snapshot(), before, "nothing was written");
  assert.ok(!("review_opt_out" in sole.g.guideRead({ guide: adopted, viewer: ANN }).guide));
  assert.ok(!sole.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN }).guides.some((g) => g.guide === adopted));
  /* control: the team's own procedure guide, in the same team of one */
  assert.equal(sole.g.guideOptOut({ guide: own, viewer: ANN }).ok, true);
});

test("R20 the founder alone is the team's one member: once the instance is claimed she may opt out; a member beside her makes two; unclaimed, she is no member", () => {
  const w = world({ members: [] });
  assert.deepEqual(w.membership.registerClaimed("credentials", () => true), { ok: true, module: "credentials" });
  const d = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: "admin" });
  assert.equal(d.ok, true, JSON.stringify(d));
  const o = w.g.guideOptOut({ guide: d.guide, viewer: "admin" });
  assert.equal(o.ok, true, JSON.stringify(o));
  assert.equal(o.review_opt_out.member, "admin");
  assert.equal(w.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: "admin" }).guides.find((g) => g.guide === d.guide).not_reviewed.member, "admin");
  /* the founder and one member are two: neither may opt out */
  const two = world({ members: SOLE });
  two.membership.registerClaimed("credentials", () => true);
  const t = two.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  row(two.g.guideOptOut({ guide: t, viewer: ANN }), "OPT_OUT_NOT_SOLE_MEMBER");
  row(two.g.guideOptOut({ guide: t, viewer: "admin" }), "OPT_OUT_NOT_SOLE_MEMBER");
  /* an instance not claimed has no founder: she acts as no member, and the one member is alone */
  const un = world({ members: [] });
  row(un.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: "admin" }), "GUIDE_MEMBER_ACT");
  const u = world({ members: SOLE });
  assert.equal(u.g.guideOptOut({ guide: u.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide, viewer: ANN }).ok, true);
});

test("R20 a team that gains a second member keeps the record and the statement; only a counted professional review with the second approval ends it, giving `reviewed`", () => {
  const w = world({ members: SOLE });
  const a = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  const b = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: [{ route: "Ask the Examiner", citation: "Test Stat. § 6" }], by: ANN }).guide;
  const oa = w.g.guideOptOut({ guide: a, viewer: ANN }).review_opt_out;
  const ob = w.g.guideOptOut({ guide: b, viewer: ANN }).review_opt_out;
  addMember(w, "bob");
  const find = (id) => w.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN }).guides.find((g) => g.guide === id);
  assert.deepEqual(find(a).not_reviewed, oa, "joining does not end the statement");
  /* a second approval alone does not end it */
  w.g.guideReview({ guide: b, verdict: "approve", by: BOB });
  assert.deepEqual([find(b).approved_by, find(b).not_reviewed, "reviewed" in find(b)], ["bob", ob, false]);
  /* a counted professional review with the second approval: `reviewed`, no `not_reviewed`; the record stays in history */
  w.g.guideReview({ guide: a, verdict: "approve", by: BOB,
                    professional: { reviewer: "Dee Example", organisation: "Open Records Clinic (test)", credential: "attorney (test)", outcome: "no_concerns", scope: "the whole guide", at: "2026-10-01" } });
  const ga = find(a);
  assert.deepEqual(ga, { guide: a, origin: "group", items: STEPS, approved_by: "bob", approved_at: DAY,
                         reviewed: { name: "Dee Example", organisation: "Open Records Clinic (test)", at: "2026-10-01" } });
  assert.deepEqual(w.g.guideRead({ guide: a, viewer: ANN }).history.map((h) => h.act), ["draft", "opt_out", "approve"]);
  assert.deepEqual(w.g.guideRead({ guide: a, viewer: ANN }).guide.review_opt_out, oa);
  /* a professional review lacking its credential does not count: the statement stays */
  const c = world({ members: SOLE });
  const cg = c.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).guide;
  c.g.guideOptOut({ guide: cg, viewer: ANN });
  addMember(c, "bob");
  c.g.guideReview({ guide: cg, verdict: "approve", by: BOB, professional: { reviewer: "Dee Example", organisation: "Open Records Clinic (test)", outcome: "no_concerns", at: "2026-10-01" } });
  const x = c.g.procedureGuidesFor({ kind: "bylaw_complaint", viewer: ANN }).guides.find((g) => g.guide === cg);
  assert.ok(x.not_reviewed && !("reviewed" in x));
});

test("R20 R16 guideoptout is declared: its requires alone raise no refusal naming a field, without `guide` it is refused naming it, and a field outside accepts is dropped", async () => {
  const setup = () => {
    const w = world({ members: SOLE });
    w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN });
    return w;
  };
  /* each call on a fresh team of one; "THE_GUIDE" stands for that team's guide, its id minted there */
  const call = async (given) => {
    const env = setup();
    const id = env.rows(`SELECT guide_id FROM reading_guides`)[0].guide_id;
    const fields = Object.fromEntries(Object.entries(given).map(([k, v]) => [k, v === "THE_GUIDE" ? id : v]));
    const q = new URLSearchParams({ op: "guideoptout", viewer: ANN, ...fields });
    const r = readingGuidesOps(env.g, new URL(`http://x/?${q}`), fields).guideoptout();
    const { at, review_opt_out, guide, ...rest } = r;   // the instant is the clock's, the id the fresh team's
    return rest;
  };
  await declaredOpHolds({ op: "guideoptout", declaration: DECLARED_OPS.guideoptout, call, values: { guide: "THE_GUIDE" } });
  assert.deepEqual([DECLARED_OPS.guideoptout.mutating, DECLARED_OPS.guideoptout.classes], [true, ["admin", "member"]]);
});
