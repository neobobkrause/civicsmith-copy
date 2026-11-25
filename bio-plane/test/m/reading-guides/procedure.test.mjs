/* reading-guides: a group's own procedure guides (R13; v0.2 rule 11), R4's check narrowed for that purpose, and the
   profile's guide answered first (`jurisdictions` R80, through `combine` over the test profile, `test-port-ellery`).
   This file registers a stand-in for `skills` R16 (text in, a list of pattern names out), its own process's one
   registration, so the control-flow arm of the narrowed check is tested here. */
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { checkGuide, registerConductCheck, CONDUCT_LISTS, GUIDE_PURPOSES, PROCEDURE_ITEM_FIELDS, PROCEDURE_CONDUCT_LISTS,
         ROUTE_MAX, EXPECT_MAX, CITATION_MAX, ITEMS_MAX, PROCEDURE_GUIDE_LABEL, GUIDE_OFFER_FORMAT,
         READING_GUIDES_SCHEMA, readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { migrateReadingGuides } from "../../../src/reading-guides/schema.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";
import { world, row, item, ITEMS, ANN, BOB, CY, REV, MACHINE } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const KIND = "bylaw_complaint";   // an action kind of the test profile, with its R80 guide
const step = (route, citation = "P.E.B.L. § 9(2)", expect) =>
  (expect === undefined ? { route, citation } : { route, expect, citation });
const STEPS = [step("Send the complaint to the Town Clerk", "P.E.B.L. § 9(1)", "The Clerk must respond within 10 days"),
               step("Ask the Selectboard to hear it at its next sitting")];

let mode = "normal";
const flow = (text) => {
  if (mode === "throw") throw new Error("broken check");
  return /\buntil\b/i.test(text) ? ["termination_condition"] : [];
};
assert.deepEqual(registerConductCheck(flow), { ok: true, module: "skills" });

test("R13 R4 the narrowed check's terms: two purposes, the item's fields and the lists that apply, frozen", () => {
  assert.deepEqual([...GUIDE_PURPOSES], ["reading", "procedure"]);
  assert.deepEqual([...PROCEDURE_ITEM_FIELDS], ["route", "expect", "citation"]);
  assert.deepEqual([...PROCEDURE_CONDUCT_LISTS], ["op_form", "party"]);
  for (const x of [GUIDE_PURPOSES, PROCEDURE_ITEM_FIELDS, PROCEDURE_CONDUCT_LISTS, PROCEDURE_GUIDE_LABEL]) assert.ok(Object.isFrozen(x));
  assert.deepEqual({ ...PROCEDURE_GUIDE_LABEL }, { key: "guide.procedure.legalinfo", says: localize("guide.procedure.legalinfo", "Legal information, not legal advice") });
});

test("R13 R4 a procedure item names acts and duties: every act and rule word passes for a procedure and is still refused for a reading guide", () => {
  assert.deepEqual(checkGuide(STEPS, "procedure"), { ok: true, items: STEPS });
  row(checkGuide([item("L", "The Clerk must respond within 10 days")]), "GUIDE_CARRIES_CONDUCT");
  for (const list of ["tool_or_act", "rule_or_permission"]) for (const word of CONDUCT_LISTS[list]) {
    const text = `${word} the complaint before the Selectboard`;
    for (const field of PROCEDURE_ITEM_FIELDS) {
      const it = step("Write to the Town Clerk", "P.E.B.L. § 9(1)", "an acknowledgement");
      it[field] = text;
      assert.equal(checkGuide([it], "procedure").ok, true, `${word} in ${field}`);
    }
    const r = checkGuide([item("L", `Look for ${word} in the minutes`)]);
    row(r, "GUIDE_CARRIES_CONDUCT");
    assert.equal(r.found.list, list, word);
  }
  /* no look-for opening is asked of a procedure item */
  assert.equal(checkGuide([step("Write to the Town Clerk")], "procedure").ok, true);
  /* the default purpose, and an explicit `reading`, are the reading check */
  for (const p of [undefined, null, "reading"]) row(checkGuide([step("Write to the Town Clerk")], p), "GUIDE_ITEMS_REFUSED");
});

test("R13 R4 a procedure item naming a party to conduct or an op is refused in every field, naming the item; the registered check applies", () => {
  for (const word of CONDUCT_LISTS.party) for (const field of PROCEDURE_ITEM_FIELDS) for (const spelled of [word, word.toUpperCase()]) {
    const it = step("Write to the Town Clerk", "P.E.B.L. § 9(1)", "an acknowledgement");
    it[field] = `Ask the ${spelled} here`;
    const r = checkGuide([STEPS[0], it], "procedure");
    row(r, "GUIDE_CARRIES_CONDUCT");
    assert.deepEqual([r.item, r.field, r.found], [1, field, { list: "party", word }], `${word} in ${field}`);
    assert.equal(r.label, field === "route" ? it.route : "Write to the Town Clerk");
  }
  const op = checkGuide([step("Call op=frontier for the file")], "procedure");
  assert.deepEqual([op.reason, op.found.list], ["GUIDE_CARRIES_CONDUCT", "op_form"]);
  /* skills R16, registered */
  const cf = checkGuide([step("Write to the Clerk until she answers")], "procedure");
  row(cf, "GUIDE_CARRIES_CONDUCT");
  assert.deepEqual(cf.found, { list: "registered", patterns: ["termination_condition"] });
  mode = "throw";
  assert.deepEqual(checkGuide(STEPS, "procedure").found, { list: "registered", patterns: null, unreadable: true }, "fail closed");
  mode = "normal";
  /* negative control: whole words only */
  assert.equal(checkGuide([step("Write to the modelling office and the AIDS council")], "procedure").ok, true);
});

test("R13 a procedure item's citation is required (GUIDE_ITEM_UNSOURCED, naming the item); its shape is a route, an optional expected reply and a citation", () => {
  for (const citation of [undefined, null, "", "   "]) {
    const it = { route: "Write to the Town Clerk" };
    if (citation !== undefined) it.citation = citation;
    const r = checkGuide([STEPS[0], it], "procedure");
    row(r, "GUIDE_ITEM_UNSOURCED");
    assert.equal(r.item, 1);
    assert.equal(r.detail, localize("reading-guides.check.item_v1_of_a_procedure", "item {v1} of a procedure guide names no citation for its route. Nothing was written.", { v1: "2" }));
  }
  assert.equal(checkGuide([step("Write to the Town Clerk", "P.E.B.L. § 9(1)")], "procedure").ok, true, "control: with one");
  assert.deepEqual(checkGuide([{ route: " R ", expect: "  ", citation: " C " }], "procedure"), { ok: true, items: [{ route: "R", citation: "C" }] });
  assert.equal(checkGuide(Array.from({ length: ITEMS_MAX }, () => STEPS[1]), "procedure").ok, true);
  assert.equal(checkGuide([step("r".repeat(ROUTE_MAX), "c".repeat(CITATION_MAX), "e".repeat(EXPECT_MAX))], "procedure").ok, true);
  for (const bad of [undefined, [], "x", Array.from({ length: ITEMS_MAX + 1 }, () => STEPS[1]), [null], [{ citation: "C" }],
                     [{ route: "", citation: "C" }], [{ route: 3, citation: "C" }], [{ route: "R", citation: 3 }],
                     [{ route: "R", expect: 3, citation: "C" }], [{ route: "R", citation: "C", label: "L" }],
                     [{ route: "R", citation: "C", after: ["denied"] }], [{ route: "R", citation: "C", rank: 1 }],
                     [step("r".repeat(ROUTE_MAX + 1))], [step("R", "c".repeat(CITATION_MAX + 1))], [step("R", "C", "e".repeat(EXPECT_MAX + 1))],
                     [step("R\nthen", "C")], [item()]])
    row(checkGuide(bad, "procedure"), "GUIDE_ITEMS_REFUSED");
  for (const p of ["Procedure", "rule", 3, {}]) row(checkGuide(STEPS, p), "GUIDE_ITEMS_REFUSED");
});

test("R13 a procedure guide's kind is an action kind of the active profiles' view; GUIDE_KIND_UNKNOWN otherwise (negative controls)", () => {
  const w = world();
  for (const kind of ["staff_report", "court_order", "", null, "Bylaw_Complaint"])
    row(w.g.guideDraft({ kind, purpose: "procedure", items: STEPS, by: ANN }), "GUIDE_KIND_UNKNOWN");
  row(w.g.guideDraft({ kind: KIND, purpose: "reading", items: ITEMS, by: ANN }), "GUIDE_KIND_UNKNOWN");
  row(w.g.guideDraft({ kind: KIND, items: ITEMS, by: ANN }), "GUIDE_KIND_UNKNOWN", "the default purpose is reading");
  for (const purpose of ["Procedure", "rules", 3]) {
    const r = w.g.guideDraft({ kind: KIND, purpose, items: STEPS, by: ANN });
    row(r, "GUIDE_KIND_UNKNOWN");
    assert.equal(r.detail, localize("reading-guides.index.a_guides_purpose_is_reading", "a guide's purpose is reading or procedure. Nothing was written."));
  }
  row(w.g.guidePropose({ kind: "staff_report", purpose: "procedure", items: STEPS, run: "R", by: MACHINE }), "GUIDE_KIND_UNKNOWN");
  /* with no profile active, no action kind is known */
  const none = world({ profiles: null });
  const r = none.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN });
  row(r, "GUIDE_KIND_UNKNOWN");
  assert.equal(r.detail, localize("reading-guides.index.a_procedure_guide_is_for_an_action", "a procedure guide is for an action kind of the team's jurisdiction profiles, and they list none. Nothing was written."));
  assert.equal(w.count("reading_guides"), 0, "nothing was written");
  /* controls: each action kind of the view, and a refusal of the items after the kind */
  for (const k of combine(["test-port-ellery"]).view.action_kinds.map((x) => x.kind))
    assert.equal(w.g.guideDraft({ kind: k, purpose: "procedure", items: STEPS, by: ANN }).ok, true, k);
  row(w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [{ route: "Write to the Clerk" }], by: ANN }), "GUIDE_ITEM_UNSOURCED");
  row(w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [step("Ask the model")], by: ANN }), "GUIDE_CARRIES_CONDUCT");
});

test("R13 R2 R3 R7 R8 R12 hold for a procedure guide: drafted usable by its author, reviewed, retired, listed, proposed apart", () => {
  const w = world();
  const d = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN });
  assert.deepEqual([d.ok, d.state, d.purpose], [true, "usable_by_author", "procedure"]);
  const g = w.g.guideRead({ guide: d.guide, viewer: ANN }).guide;
  assert.deepEqual([g.kind, g.purpose, g.origin, g.state, g.items], [KIND, "procedure", "group", "usable_by_author", STEPS]);
  /* R3: never by its author; a refusal keeps it its author's; another member's approval makes it the group's */
  row(w.g.guideReview({ guide: d.guide, verdict: "approve", by: ANN }), "GUIDE_REVIEW_BY_AUTHOR");
  assert.equal(w.g.guideReview({ guide: d.guide, verdict: "refuse", reason: "cite the second route", by: BOB }).state, "usable_by_author");
  assert.equal(w.g.guideReview({ guide: d.guide, verdict: "approve", by: CY }).state, "group");
  assert.deepEqual(w.g.guideRead({ guide: d.guide }).history.map((h) => h.act), ["draft", "refuse", "approve"]);
  /* R5 answers reading guides only: a procedure guide is never the reading guide in force */
  assert.equal(w.g.guideFor({ kind: KIND, viewer: ANN }).guide, null);
  const reading = w.groupGuide();
  assert.equal(w.g.guideFor({ kind: "staff_report", viewer: ANN }).guide.id, reading);
  /* R8: listed with its purpose, and narrowed by purpose */
  const ids = (a) => w.g.guidesOf(a).guides.map((x) => x.id);
  assert.deepEqual(ids({ viewer: ANN }), [d.guide, reading]);
  assert.deepEqual(ids({ viewer: ANN, purpose: "procedure" }), [d.guide]);
  assert.deepEqual(ids({ viewer: ANN, purpose: "reading" }), [reading]);
  assert.deepEqual(ids({ viewer: ANN, kind: KIND }), [d.guide]);
  assert.deepEqual(ids({ viewer: ANN, kind: KIND, purpose: "reading" }), []);
  assert.deepEqual(ids({ viewer: ANN, purpose: "other" }), []);
  assert.deepEqual(ids({ viewer: REV, purpose: "procedure" }), [], "outside the group: none of the team's");
  assert.deepEqual(w.g.guidesOf({ viewer: ANN }).guides.map((x) => x.purpose), ["procedure", "reading"]);
  /* R12: a machine proposes one apart, labelled; only a member's draft based on it is a guide */
  const p = w.g.guidePropose({ kind: KIND, purpose: "procedure", items: STEPS, run: "RUN-1", by: MACHINE });
  assert.deepEqual([p.ok, p.purpose, p.label.machine_work], [true, "procedure", true]);
  assert.equal(w.g.guideProposals({ viewer: ANN }).proposals[0].purpose, "procedure");
  row(w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: MACHINE }), "GUIDE_MEMBER_ACT");
  assert.equal(w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, based_on: p.proposal, by: BOB }).ok, true);
  /* R7: retired by a member other than its author, readable after */
  row(w.g.guideRetire({ guide: d.guide, reason: "r", by: ANN }), "GUIDE_RETIRE_NOT_APPROVER");
  assert.equal(w.g.guideRetire({ guide: d.guide, reason: "the Clerk's procedure changed", by: BOB }).state, "retired");
  assert.equal(w.g.guideRead({ guide: d.guide, viewer: ANN }).guide.purpose, "procedure");
});

test("R13 R6 a procedure guide is offered with its purpose in its bytes, and adopted only into a group whose profiles hold its kind", () => {
  const a = world({ slug: "group-a" }), b = world({ slug: "group-b" });
  const id = a.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN }).guide;
  row(a.g.guideOffer({ guide: id, by: ANN }), "GUIDE_NOT_OFFERABLE");
  a.g.guideReview({ guide: id, verdict: "approve", by: BOB });
  const offer = a.g.guideOffer({ guide: id, by: ANN });
  assert.equal(offer.bytes, canonicalJson({ format: GUIDE_OFFER_FORMAT, group: "group-a", guide: id, items: STEPS, kind: KIND, purpose: "procedure" }));
  const r = b.g.guideAdopt({ bytes: offer.bytes, by: ANN });
  assert.deepEqual([r.ok, r.state, r.purpose, r.based_on, r.offered_by], [true, "draft", "procedure", offer.digest, "group-a"]);
  assert.deepEqual(b.g.guideRead({ guide: r.guide }).guide.items, STEPS);
  assert.deepEqual(b.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.map((g) => g.origin), ["profile"], "not usable before review");
  b.g.guideReview({ guide: r.guide, verdict: "approve", by: BOB });
  assert.deepEqual(b.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.map((g) => [g.origin, g.guide ?? null]),
    [["profile", null], ["adopted", r.guide]]);
  /* refused where the adopting group's profiles hold no such kind, or the purpose is not procedure */
  row(world({ profiles: null }).g.guideAdopt({ bytes: offer.bytes, by: ANN }), "GUIDE_KIND_UNKNOWN");
  const o = JSON.parse(offer.bytes);
  row(b.g.guideAdopt({ bytes: canonicalJson({ ...o, purpose: "reading" }), by: BOB }), "GUIDE_OFFER_UNREADABLE");
  row(b.g.guideAdopt({ bytes: canonicalJson({ ...o, items: [{ route: "Write to the Clerk" }] }), by: BOB }), "GUIDE_ITEM_UNSOURCED");
  row(b.g.guideAdopt({ bytes: canonicalJson({ ...o, items: [step("Ask the model")] }), by: BOB }), "GUIDE_CARRIES_CONDUCT");
  /* a proposal for Civicsmith's library carries it too */
  const prop = a.g.guideProposeToCivicsmith({ guide: id, by: ANN });
  assert.equal(JSON.parse(prop.bytes).purpose, "procedure");
});

test("R13 procedureGuidesFor: the profile's guide first, then the group's approved in the order approved, each with its origin, unranked, every answer labelled", () => {
  const w = world();
  const view = combine(["test-port-ellery"]).view;
  const profileGuide = view.procedure_guides.find((g) => g.kind === KIND);
  const first = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [step("Write to the Harbour Master")], by: ANN }).guide;
  const second = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [step("Write to the Selectboard chair")], by: BOB }).guide;
  const mine = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [step("Write to the Examiner")], by: CY }).guide;
  w.g.guideReview({ guide: second, verdict: "approve", by: CY });   // approved before `first`, drafted after it
  w.g.guideReview({ guide: first, verdict: "approve", by: CY });
  w.groupGuide();   // a reading guide is never among them
  const r = w.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.equal(r.ok, true);
  assert.deepEqual(r.label, { ...PROCEDURE_GUIDE_LABEL });
  assert.deepEqual(r.withheld, []);
  assert.deepEqual(r.guides.map((g) => [g.origin, g.guide ?? null]), [["profile", null], ["group", second], ["group", first]]);
  assert.ok(!r.guides.some((g) => g.guide === mine), "a guide its author's alone is not the team's");
  /* K2820's shape: each {guide, origin, items}; the profile's, as R80 holds it, its items in the profile's order, `after` carried */
  assert.deepEqual(Object.keys(r).sort(), ["guides", "kind", "label", "ok", "withheld"]);
  assert.deepEqual(Object.keys(r.guides[0]).sort(), ["basis", "items", "origin", "status"]);
  for (const g of r.guides.slice(1)) assert.deepEqual(Object.keys(g).sort(), ["approved_at", "approved_by", "guide", "items", "origin"]);
  assert.deepEqual(r.guides[0], { origin: "profile", items: profileGuide.items, status: profileGuide.status, basis: profileGuide.basis });
  assert.deepEqual(r.guides[1].items, [step("Write to the Selectboard chair")]);
  assert.deepEqual(r.guides[0].items[1].after, ["denied", "none_stated"]);
  /* unranked: nothing in the answer ranks, scores or prefers */
  const keys = new Set(r.guides.flatMap((g) => [...Object.keys(g), ...g.items.flatMap((it) => Object.keys(it))]));
  for (const k of ["rank", "score", "preferred", "recommended", "order"]) assert.ok(!keys.has(k), k);
  /* a retired guide drops out; a viewer outside the group sees the profile's alone, still labelled */
  w.g.guideRetire({ guide: second, reason: "replaced", by: ANN });
  assert.deepEqual(w.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.map((g) => g.guide ?? null), [null, first]);
  for (const v of [REV, "stranger"]) {
    const o = w.g.procedureGuidesFor({ kind: KIND, viewer: v });
    assert.deepEqual([o.guides.map((g) => g.origin), o.label.key], [["profile"], "guide.procedure.legalinfo"], v);
  }
  assert.deepEqual(w.g.procedureGuidesFor({ kind: KIND, viewer: MACHINE }).guides.map((g) => g.guide ?? null), [null, first]);
  /* a kind with no profile guide answers the group's alone; a kind outside the view, none; each labelled */
  const rq = w.g.guideDraft({ kind: "records_request", purpose: "procedure", items: STEPS, by: ANN }).guide;
  w.g.guideReview({ guide: rq, verdict: "approve", by: BOB });
  assert.deepEqual(w.g.procedureGuidesFor({ kind: "records_request", viewer: ANN }).guides.map((g) => [g.origin, g.guide ?? null]), [["group", rq]]);
  for (const kind of ["staff_report", "nope", undefined, 7])
    assert.deepEqual(w.g.procedureGuidesFor({ kind, viewer: ANN }), { ok: true, kind: typeof kind === "string" ? kind : null, guides: [], withheld: [],
      label: { ...PROCEDURE_GUIDE_LABEL } });
  assert.deepEqual(world({ profiles: null }).g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides, [], "no profile active, no kind");
});

test("R13 procedureGuidesFor never throws, and passes over a guide the check no longer passes (withheld, named)", () => {
  const w = world();
  const id = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN }).guide;
  w.g.guideReview({ guide: id, verdict: "approve", by: BOB });
  mode = "throw";
  const r = w.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  assert.deepEqual(r.guides, []);
  assert.deepEqual(r.withheld.map((x) => [x.origin, x.guide, x.reason]),
    [["profile", null, "GUIDE_CARRIES_CONDUCT"], ["group", id, "GUIDE_CARRIES_CONDUCT"]]);
  assert.equal(r.label.key, "guide.procedure.legalinfo");
  mode = "normal";
  assert.equal(w.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.length, 2, "control");
  for (const a of [undefined, null, 3, "x", [], { kind: {} }, { kind: KIND, viewer: {} }, { get kind() { throw new Error("x"); } }])
    assert.doesNotThrow(() => { const o = w.g.procedureGuidesFor(a); assert.equal(o.ok, true); assert.equal(o.label.key, "guide.procedure.legalinfo"); });
  /* served to members by op=procedureguides ({kind}), the viewer from the URL (K2820) */
  const url = new URL(`https://x/?kind=${KIND}&viewer=${ANN}`);
  assert.deepEqual(readingGuidesOps(w.g, url, { viewer: "stranger" }).procedureguides(), w.g.procedureGuidesFor({ kind: KIND, viewer: ANN }));
  assert.deepEqual(readingGuidesOps(w.g, new URL("https://x/?viewer=stranger"), { kind: KIND }).procedureguides().guides.map((g) => g.origin),
    ["profile"], "kind from the body; a body cannot set the viewer");
  /* no profile set: no kind, no guide */
  const v = world({ profiles: null });
  assert.deepEqual(v.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides, []);
});

test("R15 a procedure guide says who approved it and where it came from: a group guide its approver and day, the profile's its status and basis; an unapproved one is not answered", () => {
  const w = world();
  const view = combine(["test-port-ellery"]).view;
  const profileGuide = view.procedure_guides.find((g) => g.kind === KIND);
  const group = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN }).guide;
  const pending = w.g.guideDraft({ kind: KIND, purpose: "procedure", items: [step("Write to the Examiner")], by: CY }).guide;
  w.g.guideReview({ guide: group, verdict: "approve", by: BOB });
  w.g.guideReview({ guide: pending, verdict: "refuse", reason: "cite the second route", by: BOB });
  const r = w.g.procedureGuidesFor({ kind: KIND, viewer: ANN });
  const [profile, mine] = r.guides;
  assert.equal(r.guides.length, 2);
  assert.deepEqual(profile, { origin: "profile", items: profileGuide.items, status: profileGuide.status, basis: profileGuide.basis });
  assert.ok(profileGuide.status !== undefined && profileGuide.basis !== undefined, "the profile's guide holds both");
  assert.deepEqual(profile.items[1].after, ["denied", "none_stated"], "an item's `after` is answered when it has one");
  assert.deepEqual(mine, { guide: group, origin: "group", items: STEPS, approved_by: "bob", approved_at: "2026-10-09" });
  /* control: a guide refused in review, still its author's, is not answered; nor is a retired one */
  assert.ok(!r.guides.some((g) => g.guide === pending));
  w.g.guideRetire({ guide: group, reason: "replaced", by: BOB });
  assert.deepEqual(w.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.map((g) => g.origin), ["profile"]);
  /* a kind with no guide: `guides: []` and the label */
  assert.deepEqual(w.g.procedureGuidesFor({ kind: "staff_report", viewer: ANN }),
    { ok: true, kind: "staff_report", guides: [], withheld: [], label: { ...PROCEDURE_GUIDE_LABEL } });
});

test("R15 an adopted procedure guide, approved by this group's review, keeps origin adopted and answers its approver and day; unapproved, it is not answered", () => {
  const a = world({ slug: "group-a" }), b = world({ slug: "group-b" });
  const id = a.g.guideDraft({ kind: KIND, purpose: "procedure", items: STEPS, by: ANN }).guide;
  a.g.guideReview({ guide: id, verdict: "approve", by: BOB });
  const adopted = b.g.guideAdopt({ bytes: a.g.guideOffer({ guide: id, by: ANN }).bytes, by: ANN }).guide;
  assert.deepEqual(b.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides.map((g) => g.origin), ["profile"], "control: unapproved");
  b.g.guideReview({ guide: adopted, verdict: "approve", by: CY });
  const got = b.g.procedureGuidesFor({ kind: KIND, viewer: ANN }).guides[1];
  assert.deepEqual(got, { guide: adopted, origin: "adopted", items: STEPS, approved_by: "cy", approved_at: "2026-10-09" });
});

test("R13 R9 a store made before R13 gains `purpose`, every guide and proposal held there a reading guide", () => {
  const db = new DatabaseSync(":memory:");
  const sql = { exec: (q, ...a) => { const st = db.prepare(q); return st.columns().length ? st.all(...a) : (st.run(...a), []); } };
  const before = READING_GUIDES_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--") && !/^\s*purpose\s/.test(l)).join("\n");
  for (const s of before.split(";").map((x) => x.trim()).filter(Boolean)) db.exec(s);
  db.exec(`INSERT INTO reading_guides (guide_id, kind, origin, items_json, state, author, created_at, updated_at)
           VALUES ('GUD-2026-0000000000000001', 'policy', 'group', '[]', 'group', 'ann', 'x', 'x')`);
  db.exec(`INSERT INTO reading_guide_proposals (proposal_id, kind, items_json, run, proposed_by, at) VALUES ('GUD-2026-0000000000000002', 'policy', '[]', 'R', 'class:ai', 'x')`);
  migrateReadingGuides(sql);
  migrateReadingGuides(sql);   // idempotent
  assert.deepEqual(db.prepare(`SELECT purpose FROM reading_guides`).all().map((r) => r.purpose), ["reading"]);
  assert.deepEqual(db.prepare(`SELECT purpose FROM reading_guide_proposals`).all().map((r) => r.purpose), ["reading"]);
});
