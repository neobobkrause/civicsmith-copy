/* filing-templates: T45's offer rules (R15, R26, R28, R23's rows; N858, Actions D8, v0.2 rule 11, §8; K2781 (6)), at the
   module's interface, under the test profile and copies of it handed in as `jurisdictions`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, draft, V, TEST, HARBOUR, TEXT, twoProfiles, reviewedOf, PROFILE_IDS, PRO_REVIEW } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";

const A = V("alice");
const code = (r) => [r.ok, r.reason, r.code, r.check, r.translation];
const row = (c) => ft.FILING_TEMPLATE_CHECKS[c];
const refused = (r, c) => { assert.deepEqual(code(r), [false, c, c, row(c).check, row(c).translation], JSON.stringify(r).slice(0, 300)); return r; };
const ids = (r) => r.templates.map((t) => t.id);
/* the test profile with one edit, handed in as jurisdictions (its templates otherwise as the profile holds them) */
const editedOf = (edit, base = jurisdictions) => ({ ...base, get: (id) => { const p = base.get(id); if (p && p.id === TEST) edit(p); return p; } });
const kindOf = (p, kind) => p.action_kinds.find((k) => k.kind === kind);
const templatesOf = (k) => k.templates || [k.template];
/* the attribution v0.2 rule 11 asks, on one template */
const whole = (t) => ({ ...t, sources: [{ citation: "P.E.B.L. § 1" }], reviews: [PRO_REVIEW] });

test("R15 (T45) a profile template is offered only when its attribution names its writer, its public sources, a professional review with no concerns and an approver other than its writer; one lacking any is not offered and reads TEMPLATE_NOT_REVIEWED, naming what it lacks", () => {
  /* the test profile as it stands: no template carries all four */
  const w = seeded();
  const want = { "TPL-test-records-request": ["sources"], "TPL-test-bylaw-complaint": ["sources", "professional_review"],
                 "TPL-test-commitment-brief": ["sources", "professional_review"], "TPL-test-recognition": ["professional_review"],
                 "TPL-test-recognition-follow-up": ["professional_review"] };
  assert.deepEqual(Object.keys(want).sort(), [...PROFILE_IDS].sort());
  assert.deepEqual(ids(w.ft.templatesFor({ viewer: A })), [], "none offered, none listed");
  for (const [id, lacks] of Object.entries(want)) {
    const o = refused(w.ft.offeredVersion({ template: id, viewer: A }), "TEMPLATE_NOT_REVIEWED");
    assert.deepEqual([o.template, o.lacks], [id, lacks], id);
    const r = w.ft.templateRead({ template: id, viewer: A });
    assert.deepEqual([r.ok, r.offered, r.not_offered.reason, r.not_offered.lacks, r.version.state], [true, false, "TEMPLATE_NOT_REVIEWED", lacks, "approved"], id);
  }
  /* control: the same templates, each with sources and a professional review with no concerns, are offered */
  const ok = seeded({ jur: reviewedOf() });
  assert.deepEqual(ids(ok.ft.templatesFor({ viewer: A })).sort(), [...PROFILE_IDS].sort());
  for (const id of PROFILE_IDS) {
    const o = ok.ft.offeredVersion({ template: id, viewer: A });
    assert.deepEqual([o.ok, o.template, o.origin, o.state, o.default], [true, id, "profile", "approved", true], id);
    const r = ok.ft.templateRead({ template: id, viewer: A });
    assert.deepEqual([r.offered, r.not_offered], [true, undefined], id);
    assert.ok(r.version.sources.length >= 1, "its sources read with its attribution");
  }
});

test("R15 (T45) each of the four parts, missing alone, withholds the template and is named; a review with concerns, a member's review, or an approver who is the writer counts as none", () => {
  const ID = "TPL-test-records-request";
  const withT = (patch) => seeded({ jur: editedOf((p) => { const k = kindOf(p, "records_request"); k.template = patch(whole(k.template)); }) });
  const lacks = (patch) => { const w = withT(patch); const o = w.ft.offeredVersion({ template: ID, viewer: A });
                             return o.ok ? [] : (refused(o, "TEMPLATE_NOT_REVIEWED"), o.lacks); };
  assert.deepEqual(lacks((t) => t), [], "control: all four, offered");
  assert.deepEqual(lacks((t) => ({ ...t, authored_by: "" })), ["writer"]);
  assert.deepEqual(lacks((t) => ({ ...t, sources: [] })), ["sources"]);
  assert.deepEqual(lacks((t) => ({ ...t, sources: [{ citation: "" }] })), ["sources"]);
  assert.deepEqual(lacks((t) => { const { sources, ...rest } = t; return rest; }), ["sources"]);
  assert.deepEqual(lacks((t) => ({ ...t, reviews: [] })), ["professional_review"]);
  assert.deepEqual(lacks((t) => ({ ...t, reviews: [{ ...PRO_REVIEW, outcome: "concerns" }] })), ["professional_review"]);
  assert.deepEqual(lacks((t) => ({ ...t, reviews: [{ ...PRO_REVIEW, outcome: "changes_requested" }] })), ["professional_review"]);
  assert.deepEqual(lacks((t) => ({ ...t, reviews: [{ ...PRO_REVIEW, kind: "member" }] })), ["professional_review"]);
  assert.deepEqual(lacks((t) => ({ ...t, approved_by: "" })), ["approver"]);
  assert.deepEqual(lacks((t) => ({ ...t, approved_by: t.authored_by })), ["approver"]);
  assert.deepEqual(lacks((t) => ({ ...t, authored_by: "", sources: [], reviews: [], approved_by: "" })),
                   ["writer", "sources", "professional_review", "approver"], "every part lacking, each named, in order");
  /* not offered anywhere: not listed, refused by offeredVersion and by name, read with offered false; still readable */
  const w = withT((t) => ({ ...t, reviews: [] }));
  assert.equal(ids(w.ft.templatesFor({ viewer: A })).includes(ID), false);
  refused(w.ft.offeredVersion({ name: "@request-under-the-records-act", viewer: A }), "TEMPLATE_NOT_REVIEWED");
  assert.equal(w.ft.templateRead({ template: ID, viewer: A }).offered, false);
});

test("R15 (T45; K2781 (6)) @records-request stays unresolved until a named writer and a professional review exist: with no such template it is absent; without the review it reads TEMPLATE_NOT_REVIEWED; with it, it is offered", () => {
  /* the first profile carries no template: the name finds nothing */
  const first = jurisdictions.list().find((p) => !p.test).id;
  const none = seeded({ profiles: [first] });
  refused(none.ft.offeredVersion({ name: "@records-request", viewer: A }), "NO_SUCH_TEMPLATE");
  /* a "Records request" template in the profile, written from sources, approved, but with no professional review */
  const rr = (reviews) => editedOf((p) => {
    const k = kindOf(p, "records_request");
    k.templates = [{ ...k.template, name: "Records request", purpose: "initial", sources: [{ citation: "P.E.B.L. § 4" }], reviews }];
    delete k.template;
  });
  const without = seeded({ jur: rr([{ ...PRO_REVIEW, kind: "member" }]) });
  const o = refused(without.ft.offeredVersion({ name: "@records-request", viewer: A }), "TEMPLATE_NOT_REVIEWED");
  assert.deepEqual(o.lacks, ["professional_review"]);
  /* control: with a professional's review with no concerns */
  const withR = seeded({ jur: rr([PRO_REVIEW]) });
  const ok = withR.ft.offeredVersion({ name: "@records-request", viewer: A });
  assert.deepEqual([ok.ok, ok.template, ok.name, ok.origin], [true, "TPL-test-records-request", "Records request", "profile"]);
});

test("R26 (T45) a handle is resolved over each profile template's own name, so two templates of one kind have two handles; each resolves as its id does", () => {
  for (const jur of [jurisdictions, reviewedOf()]) {
    const w = seeded({ jur });
    const k = kindOf(jurisdictions.get(TEST), "recognition_letter");
    assert.equal(k.templates.length, 2, "the test profile's kind with two templates");
    const seen = new Set();
    for (const t of k.templates) {
      const h = `@${ft.templateHandle(t.name)}`;
      const byName = w.ft.offeredVersion({ name: h, viewer: A });
      assert.deepEqual(byName, w.ft.offeredVersion({ template: t.id, viewer: A }), h);
      assert.equal(byName.template, t.id, h);
      seen.add(byName.template);
    }
    assert.equal(seen.size, 2, "two handles, two templates");
  }
  /* the handle is the template's own name, never its kind's label: a label no template is named by finds nothing */
  const relabelled = seeded({ jur: reviewedOf(jurisdictions, (p) => { kindOf(p, "recognition_letter").label = "thanks to an office"; }) });
  refused(relabelled.ft.offeredVersion({ name: "@thanks-to-an-office", viewer: A }), "NO_SUCH_TEMPLATE");
  assert.equal(relabelled.ft.offeredVersion({ name: "@letter-of-recognition", viewer: A }).template, "TPL-test-recognition");
  /* each named template is listed under its own name */
  const listed = seeded({ jur: reviewedOf() }).ft.templatesFor({ kind: "recognition_letter", viewer: A }).templates;
  assert.deepEqual(listed.map((t) => [t.id, t.name]).sort(), [["TPL-test-recognition", "Letter of recognition"],
    ["TPL-test-recognition-follow-up", "Follow-up letter of recognition"]]);
});

test("R28 (T45) no court-petition template: a file template on a kind whose profile venue is a court is refused TEMPLATE_COURT_PETITION at R3's draft, naming the profile; a brief template is unaffected; the same text on a kind whose venue is not a court is accepted", () => {
  /* bylaw_complaint (Tier 1) placed with a court in the test profile */
  const courtJur = editedOf((p) => { kindOf(p, "bylaw_complaint").venue.how = "court"; });
  const w = seeded({ jur: courtJur });
  const make = (x) => w.ft.templateDraft({ project: w.P, kind: "bylaw_complaint", use: "file", profiles: [TEST], name: "Petition",
                                          text: TEXT, author: A, viewer: A, ...x });
  const before = w.snapshot();
  const r = refused(make({}), "TEMPLATE_COURT_PETITION");
  assert.deepEqual([r.kind, r.profile], ["bylaw_complaint", TEST]);
  refused(make({ profiles: "general", name: "Gen" }), "TEMPLATE_COURT_PETITION", "a general template: the active view's venue");
  assert.deepEqual(w.snapshot(), before, "nothing written");
  assert.equal(make({ use: "brief" }).ok, true, "a brief template is unaffected");
  /* control: the same text on the kind with its own venue (in person) */
  const c = seeded();
  assert.equal(c.ft.templateDraft({ project: c.P, kind: "bylaw_complaint", use: "file", profiles: [TEST], name: "Petition",
                                    text: TEXT, author: A, viewer: A }).ok, true);
  /* in any profile it names: court in the harbour profile only */
  const two = seeded({ profiles: [TEST, HARBOUR], jur: { ...twoProfiles, get: (id) => { const p = twoProfiles.get(id);
    if (p && p.id === HARBOUR) kindOf(p, "bylaw_complaint").venue.how = "court"; return p; } } });
  const both = refused(two.ft.templateDraft({ project: two.P, kind: "bylaw_complaint", use: "file", profiles: [TEST, HARBOUR],
                                              name: "Both", text: TEXT, author: A, viewer: A }), "TEMPLATE_COURT_PETITION");
  assert.equal(both.profile, HARBOUR);
  assert.equal(two.ft.templateDraft({ project: two.P, kind: "bylaw_complaint", use: "file", profiles: [TEST], name: "Test only",
                                      text: TEXT, author: A, viewer: A }).ok, true, "a profile it does not name does not decide");
  /* order: R1's Tier 3 refusal before it (commitment_claim, Tier 3, filed with a court) */
  refused(w.ft.templateDraft({ project: w.P, kind: "commitment_claim", use: "file", profiles: [TEST], name: "T3", text: TEXT,
                               author: A, viewer: A }), "TEMPLATE_TIER3_FILE");
});

test("R28 (T45) a profile template on a court's kind is not offered and reads TEMPLATE_COURT_PETITION, however it is attributed; a brief one there is offered; the same template on a kind whose venue is not a court is offered", () => {
  const ID = "TPL-test-bylaw-complaint";
  const w = seeded({ jur: reviewedOf(jurisdictions, (p) => { if (p.id === TEST) kindOf(p, "bylaw_complaint").venue.how = "court"; }) });
  const o = refused(w.ft.offeredVersion({ template: ID, viewer: A }), "TEMPLATE_COURT_PETITION");
  assert.deepEqual([o.template, o.kind, o.profile], [ID, "bylaw_complaint", TEST]);
  assert.equal(ids(w.ft.templatesFor({ viewer: A })).includes(ID), false);
  const r = w.ft.templateRead({ template: ID, viewer: A });
  assert.deepEqual([r.offered, r.not_offered.reason], [false, "TEMPLATE_COURT_PETITION"]);
  /* a brief template on a court's kind (commitment_claim, filed with a court) is offered */
  assert.equal(w.ft.offeredVersion({ template: "TPL-test-commitment-brief", viewer: A }).ok, true);
  /* control: its own venue */
  assert.equal(seeded({ jur: reviewedOf() }).ft.offeredVersion({ template: ID, viewer: A }).ok, true);
});

test("R23 (T45) rows TEMPLATE_NOT_REVIEWED and TEMPLATE_COURT_PETITION join this module's family, C-125.33 and C-125.34, each answered with its row", () => {
  const rows = ft.FILING_TEMPLATE_CHECKS;
  assert.deepEqual([rows.TEMPLATE_NOT_REVIEWED.check, rows.TEMPLATE_COURT_PETITION.check], ["C-125.33", "C-125.34"]);
  assert.match(rows.TEMPLATE_NOT_REVIEWED.where, /#profileRefusal > is-profile-offered$/);
  assert.match(rows.TEMPLATE_COURT_PETITION.where, /#courtPetition > is-court-petition$/);
  const w = seeded();
  const nr = w.ft.offeredVersion({ template: "TPL-test-records-request", viewer: A });
  const cp = seeded({ jur: editedOf((p) => { kindOf(p, "bylaw_complaint").venue.how = "court"; }) });
  const cr = cp.ft.templateDraft({ project: cp.P, kind: "bylaw_complaint", use: "file", profiles: [TEST], name: "P", text: TEXT, author: A, viewer: A });
  for (const r of [nr, cr]) assert.deepEqual([r.code, r.check, r.translation], [r.reason, rows[r.reason].check, rows[r.reason].translation], r.reason);
  /* the translations name no place, venue or law */
  for (const c of ["TEMPLATE_NOT_REVIEWED", "TEMPLATE_COURT_PETITION"]) assert.ok(rows[c].translation.length > 20, c);
  /* a refused draft writes nothing; an accepted one through the same path is the negative control */
  assert.equal(draft(w, { name: "Fine" }).ok, true);
});
