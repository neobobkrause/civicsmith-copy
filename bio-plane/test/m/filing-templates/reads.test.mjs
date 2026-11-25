/* filing-templates: the reads (R14, R15, R20, R24, R25), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, world, draft, approved, V, MACHINE, TEST, HARBOUR, TEXT, sha, secret, twoProfiles, reviewedOf, attributed, PROFILE_IDS, PRO_REVIEW } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = V("alice"), B = V("bob"), F = V("frank"), D = V("dave");
const code = (r) => [r.ok, r.reason, r.code, r.check, r.translation];
const row = (c) => ft.FILING_TEMPLATE_CHECKS[c];
const refused = (r, c) => { assert.deepEqual(code(r), [false, c, c, row(c).check, row(c).translation], JSON.stringify(r).slice(0, 300)); return r; };
const ids = (r) => r.templates.map((t) => t.id);
/* R15 (T45): the test profile's templates as v0.2 rule 11 offers them, each with sources and a professional review */
const reviewed = reviewedOf();

test("R14 templatesFor lists every offered version (approved and updated, of templates not retired) with its metadata, the latest approved marked default; drafts, reviews and withdrawn versions never offered", () => {
  const w = seeded({ jur: reviewed });
  const a = approved(w);
  w.clock.now = "2026-10-02T00:00:00Z";
  const two = w.ft.templateDraft({ template: a.template, text: "Two {{group}}", author: A, viewer: A });
  w.ft.templateSubmit({ version: two.version, reviewers: ["frank"], author: A, viewer: A });
  w.ft.templateApprove({ version: two.version, reason: "standing", by: B, viewer: B });
  w.ft.templateDraft({ template: a.template, text: "Three {{group}}", author: A, viewer: A });
  draft(w, { name: "Only a draft" });
  const r = w.ft.templatesFor({ viewer: A });
  assert.deepEqual([r.ok, r.state, r.truncated], [true, "offered", false]);
  const t = r.templates.find((x) => x.id === a.template);
  assert.deepEqual({ ...t, versions: undefined }, { id: a.template, kind: "records_request", use: "file", profiles: [TEST], name: "Records ask",
                                                    scope: { project: w.P }, origin: "group", versions: undefined });
  assert.deepEqual(t.versions.map((v) => [v.id, v.state, v.default ?? false]), [[two.version, "approved", true], [a.version, "updated", false]]);
  const v = t.versions[1];
  assert.deepEqual([v.author.id, v.contributors[0].member, v.reviews.professional, v.approved.by.id, v.created_at, v.updated_by],
                   ["alice", "alice", 1, "bob", "2026-10-01T12:00:00Z", two.version]);
  assert.equal(r.templates.some((x) => x.name === "Only a draft"), false);
  /* newest first; the profile's templates are older (approved 2026-09-01) */
  assert.deepEqual(ids(r).slice(-PROFILE_IDS.length).sort(), [...PROFILE_IDS].sort());
  assert.equal(ids(r)[0], a.template);
});

test("R14 filters: kind, use, profile (templates naming it and the general ones, each saying whether written for it), and state lists drafts, in review, withdrawn, retired (with reason) or open proposals; at most 200 with truncated", () => {
  const w = seeded({ profiles: [TEST, HARBOUR], jur: reviewedOf(twoProfiles) });
  const gen = approved(w, { name: "General", profiles: "general" });
  w.clock.now = "2026-10-02T00:00:00Z";
  const har = draft(w, { name: "Harbour only", profiles: [HARBOUR] });
  w.ft.templateSubmit({ version: har.version, reviewers: ["frank"], author: A, viewer: A });
  w.ft.templateReview({ version: har.version, outcome: "no_concerns", scope: "s", author: F, viewer: F });
  assert.equal(w.ft.templateApprove({ version: har.version, by: B, viewer: B }).ok, true, "Tier 1 under the harbour profile");
  const under = (p) => w.ft.templatesFor({ profile: p, viewer: A }).templates.map((t) => [t.id, t.written_for]);
  assert.deepEqual(under(TEST).filter(([id]) => !id.startsWith("TPL-test")), [[gen.template, false]]);
  assert.deepEqual(under(TEST).filter(([id]) => id.startsWith("TPL-test")).map(([, f]) => f), PROFILE_IDS.map(() => true));
  assert.deepEqual(under(HARBOUR), [[har.template, true], [gen.template, false]], "a general template under two profiles");
  assert.deepEqual(ids(w.ft.templatesFor({ kind: "bylaw_complaint", viewer: A })), ["TPL-test-bylaw-complaint"]);
  assert.deepEqual(ids(w.ft.templatesFor({ use: "brief", viewer: A })), ["TPL-test-commitment-brief"]);
  /* the states */
  const d = draft(w, { name: "D1" });
  const e = draft(w, { name: "E1" });
  w.ft.templateSubmit({ version: e.version, reviewers: ["frank"], author: A, viewer: A });
  const x = draft(w, { name: "X1" });
  w.ft.templateRetire({ template: x.template, version: x.version, reason: "dropped", by: A, viewer: A });
  w.ft.templateRetire({ template: gen.template, reason: "too broad", by: A, viewer: A });
  const st = (s) => w.ft.templatesFor({ state: s, viewer: A });
  assert.deepEqual(ids(st("draft")), [d.template]);
  assert.deepEqual(ids(st("in_review")), [e.template]);
  assert.deepEqual(ids(st("withdrawn")), [x.template]);
  const ret = st("retired");
  assert.deepEqual([ids(ret), ret.templates[0].retired.reason, ret.templates[0].versions[0].ended.reason], [[gen.template], "too broad", "too broad"]);
  assert.equal(ids(w.ft.templatesFor({ viewer: A })).includes(gen.template), false);
  w.ft.templatePropose({ kind: "records_request", text: "p {{law}}", why: "w", proposer: MACHINE, viewer: MACHINE });
  assert.equal(st("proposed").proposals.length, 1);
  refused(st("everything"), "TEMPLATES_STATE_REFUSED");
});

test("R14 at most 200 templates, newest first, with truncated measured past the bound", () => {
  const w = seeded({ profiles: [] });
  for (let i = 0; i < 201; i++) {
    w.clock.now = `2026-10-01T12:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`;
    draft(w, { name: `T${i}`, profiles: "general" });
  }
  const r = w.ft.templatesFor({ state: "draft", viewer: A });
  assert.deepEqual([r.templates.length, r.truncated, r.templates[0].name, r.templates[199].name], [200, true, "T200", "T1"]);
});

test("R14 templateRead answers one version (the latest approved by default) with its whole attribution, its proposals adopted, its comments' count; a grant reads only its own version", () => {
  const w = seeded();
  const p = w.ft.templatePropose({ kind: "records_request", text: "P {{group}}", why: "w", proposer: MACHINE, viewer: MACHINE, run: "RUN-9" });
  const a = approved(w, { text: undefined, from: p.proposal.id });
  w.ft.templateComment({ template: a.template, version: a.version, text: "c", author: B, viewer: B });
  const two = w.ft.templateDraft({ template: a.template, text: "Two {{group}}", author: A, viewer: A });
  const r = w.ft.templateRead({ template: a.template, viewer: A });
  assert.deepEqual([r.version.id, r.default, r.offered, r.comments], [a.version, true, true, 1]);
  assert.deepEqual(r.version.proposals_adopted.map((x) => x.id), [p.proposal.id]);
  assert.deepEqual(r.version.derived_from, { proposal: p.proposal.id });
  for (const k of ["notes", "author", "contributors", "reviews", "approved", "revisions", "reviewers"]) assert.ok(k in r.version, k);
  const named = w.ft.templateRead({ template: a.template, version: two.version, viewer: A });
  assert.deepEqual([named.version.state, named.offered, named.default], ["draft", false, undefined]);
  /* with no approved version, the latest */
  const d = draft(w, { name: "Fresh" });
  assert.equal(w.ft.templateRead({ template: d.template, viewer: A }).version.id, d.version);
  refused(w.ft.templateRead({ template: a.template, version: 9, viewer: A }), "NO_SUCH_TEMPLATE");
  w.ft.templateReviewGrant({ version: two.version, recipient: "R", organisation: "O", secretSha: secret("g"), by: A, viewer: A });
  assert.equal(w.ft.templateRead({ secretSha: secret("g") }).version.id, two.version);
  assert.equal(w.ft.templateRead({ version: a.version, secretSha: secret("g") }).reason, "NO_TEMPLATE_GRANT");
});

test("R15 the profile's templates are read as approved versions of origin profile, scope group, their profiles the profile they are in, with the attribution it carries; derivable and commentable, never revised, reviewed, approved or retired", () => {
  const w = seeded();
  const r = w.ft.templateRead({ template: "TPL-test-records-request", viewer: D });
  const pt = jurisdictions.get(TEST).action_kinds.find((k) => k.kind === "records_request").template;
  assert.deepEqual({ ...r.template }, { id: pt.id, kind: "records_request", use: "file", profiles: [TEST], name: "request under the records act",
                                        scope: "group", origin: "profile" });
  const v = r.version;
  assert.deepEqual([v.state, v.text, v.sha, v.version, v.author.name, v.approved.by.name, v.approved.at, v.approved.basis, v.notes.text],
                   ["approved", pt.text, sha(pt.text), 1, "Ada Example", "Cy Example", "2026-09-01", "TEST", "A made-up template for tests."]);
  assert.deepEqual(v.contributors, [{ kind: "member", name: "Ben Example" }]);
  assert.deepEqual(v.reviews[0].reviewer, { name: "Dee Example", organisation: "Marlow Commons Legal Society (test)",
                                            credential: "solicitor (test)", credential_says: word("filing-templates.credential_says.profile_states_verified") });
  assert.equal(r.default, true);
  /* R3 may take it as from; R13 may comment; R4, R7–R11 do not apply */
  const ver = "TPL-test-records-request@1";
  assert.equal(draft(w, { name: "From profile", text: undefined, from: ver }).ok, true);
  assert.equal(w.ft.templateComment({ template: pt.id, version: 1, text: "fine", author: B, viewer: B }).ok, true);
  assert.equal(w.ft.templateRevise({ version: ver, text: TEXT, author: A, viewer: A }).reason, "TEMPLATE_SCOPE_REFUSED");
  assert.equal(w.ft.templateSubmit({ version: ver, reviewers: ["bob"], author: A, viewer: A }).reason, "TEMPLATE_SCOPE_REFUSED");
  assert.equal(w.ft.templateReviewGrant({ version: ver, recipient: "R", organisation: "O", secretSha: secret("p"), by: A, viewer: A }).reason, "TEMPLATE_SCOPE_REFUSED");
  assert.equal(w.ft.templateReview({ version: ver, outcome: "no_concerns", scope: "s", author: B, viewer: B }).reason, "NOT_IN_REVIEW");
  assert.equal(w.ft.templateApprove({ version: ver, by: B, viewer: B }).reason, "NOT_IN_REVIEW");
  assert.equal(w.ft.templateRetire({ template: pt.id, reason: "r", by: B, viewer: B }).reason, "NOT_AN_APPROVER");
  assert.equal(w.ft.templateRetire({ template: pt.id, version: 1, reason: "r", by: B, viewer: B }).reason, "TEMPLATE_SCOPE_REFUSED");
  /* a profile not active offers none of its templates */
  const none = seeded({ profiles: [] });
  assert.equal(none.ft.templatesFor({ viewer: A }).templates.length, 0);
  assert.equal(none.ft.templateRead({ template: pt.id, viewer: A }).reason, "NO_SUCH_TEMPLATE");
});

test("R15 a profile template whose text names a blank outside FILING_BLANKS is not offered and reads TEMPLATE_BLANK_UNKNOWN", () => {
  const bad = structuredClone(twoProfiles.get(HARBOUR));
  const jur = { ...twoProfiles, get: (id) => (id === HARBOUR ? structuredClone(bad) : twoProfiles.get(id)) };
  bad.action_kinds[0].template = { id: "TPL-test-bad-blank", version: 2, use: "file", text: "To {{mayor_name}}: {{group}}",
    notes: "", authored_by: "Ada Example", contributors: [], reviews: [], approved_by: "Cy Example", approved_at: "2026-09-02", basis: "TEST" };
  const w = seeded({ profiles: [HARBOUR], jur });
  assert.equal(w.ft.templatesFor({ viewer: A }).templates.some((t) => t.id === "TPL-test-bad-blank"), false);
  const o = refused(w.ft.offeredVersion({ template: "TPL-test-bad-blank", viewer: A }), "TEMPLATE_BLANK_UNKNOWN");
  assert.equal(o.blank, "mayor_name");
  const r = w.ft.templateRead({ template: "TPL-test-bad-blank", viewer: A });
  assert.deepEqual([r.offered, r.blank_unknown.reason, r.blank_unknown.check], [false, "TEMPLATE_BLANK_UNKNOWN", row("TEMPLATE_BLANK_UNKNOWN").check]);
});

test("R20 reviewsRequested lists every (version, member) pair asked, in review, with no review of the present sha; in (version id, member) order, at most 500 per page, cursor and truncated; writes nothing", () => {
  const w = seeded();
  const a = draft(w, { name: "A" });
  const b = draft(w, { name: "B" });
  w.ft.templateSubmit({ version: a.version, reviewers: ["frank", "bob", "carol"], author: A, viewer: A });
  w.ft.templateSubmit({ version: b.version, reviewers: ["frank"], author: A, viewer: A });
  draft(w, { name: "Not submitted" });
  w.ft.templateReview({ version: a.version, outcome: "concerns", scope: "s", author: B, viewer: B });
  const before = w.snapshot();
  const r = w.ft.reviewsRequested({ viewer: MACHINE });
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  const want = [[a.version, "carol"], [a.version, "frank"], [b.version, "frank"]].sort((x, y) => (x[0] + "#" + x[1] < y[0] + "#" + y[1] ? -1 : 1));
  assert.deepEqual(r.items.map((i) => [i.version, i.member]), want);
  const i = r.items.find((x) => x.member === "carol");
  assert.deepEqual([i.template, i.name, i.kind, i.project, i.member_name, i.asked_by, i.asked_at],
                   [a.template, "A", "records_request", w.P, "h_carol", { id: "alice", name: "h_alice" }, "2026-10-01T12:00:00Z"]);
  assert.deepEqual(r.items.map((x) => x.project), [w.P, w.P, w.P], "every item names its template's project");
  assert.deepEqual([r.truncated, r.cursor, r.limit], [false, null, 500]);
  /* paging through cursor */
  const p1 = w.ft.reviewsRequested({ limit: 2, viewer: MACHINE });
  assert.deepEqual([p1.items.length, p1.truncated, p1.cursor], [2, true, `${want[1][0]}#${want[1][1]}`]);
  const p2 = w.ft.reviewsRequested({ limit: 2, after: p1.cursor, viewer: MACHINE });
  assert.deepEqual([p2.items.map((x) => [x.version, x.member]), p2.truncated, p2.cursor], [[want[2]], false, null]);
  assert.deepEqual(w.ft.reviewsRequested({ after: want[0][0], viewer: MACHINE }).items.map((x) => x.version).every((v) => v > want[0][0]), true);
  /* a viewer who may not see the template is not shown its pairs */
  assert.equal(w.ft.reviewsRequested({ viewer: D }).items.length, 0);
  /* approval and withdrawal end the requests */
  w.ft.templateRetire({ template: b.template, version: b.version, reason: "r", by: A, viewer: A });
  assert.deepEqual(w.ft.reviewsRequested({ viewer: MACHINE }).items.map((x) => x.version), [a.version, a.version]);
});

test("R20 each item names the template's project, its scope's (R1): a project template its project, a group template null; a template widened (R10) after the request answers null, never its old project; a template the viewer may not see is left out and names no project", () => {
  const w = seeded();
  const E = V("erin");
  const page = (viewer = MACHINE) => w.ft.reviewsRequested({ viewer });
  const of = (r, version) => r.items.filter((x) => x.version === version);
  /* a project template in review: its project */
  const p = draft(w, { name: "Scoped" });
  w.ft.templateSubmit({ version: p.version, reviewers: ["frank"], author: A, viewer: A });
  /* a group template (widened before its new version was asked): null. D54: erin, an administrator, sees the hidden
     P's templates (and so widens one) only once invited; before that, one answer as absent, and no item of P's for her */
  const g = approved(w, { name: "Wide" });
  refused(w.ft.templateApprove({ version: g.version, widen: true, by: E, viewer: E }), "NO_SUCH_TEMPLATE");
  assert.equal(of(page(E), p.version).length, 0, "D54: no item of the hidden P's for an administrator outside it");
  w.join(w.P, "erin", "invited");
  assert.deepEqual(of(page(E), p.version).map((i) => i.project), [w.P], "invited, she sees it");
  assert.equal(w.ft.templateApprove({ version: g.version, widen: true, by: E, viewer: E }).ok, true);
  const g2 = w.ft.templateDraft({ template: g.template, text: "Wide two {{group}}", author: A, viewer: A });
  w.ft.templateSubmit({ version: g2.version, reviewers: ["frank", "bob"], author: A, viewer: A });
  /* a template asked while scoped to the project, widened afterwards */
  const x = approved(w, { name: "Later wide" });
  const x2 = w.ft.templateDraft({ template: x.template, text: "Later two {{group}}", author: A, viewer: A });
  w.ft.templateSubmit({ version: x2.version, reviewers: ["frank"], author: A, viewer: A });
  assert.deepEqual(of(page(), x2.version).map((i) => i.project), [w.P], "before the widening: its project");
  const before = w.snapshot();
  const r0 = page();
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  assert.deepEqual(of(r0, p.version).map((i) => [i.member, i.project]), [["frank", w.P]]);
  assert.deepEqual(of(r0, g2.version).map((i) => [i.member, i.project]), [["bob", null], ["frank", null]]);
  assert.equal(w.ft.templateApprove({ version: x.version, widen: true, by: E, viewer: E }).ok, true);
  const r = page();
  assert.deepEqual(of(r, x2.version).map((i) => [i.member, i.project]), [["frank", null]], "widened after the request: null, not its old project");
  assert.deepEqual(of(r, p.version).map((i) => i.project), [w.P], "the project template still answers its project");
  /* the order, page bound, cursor and truncated are unchanged by the field */
  assert.deepEqual(r.items.map((i) => `${i.version}#${i.member}`), [...r.items.map((i) => `${i.version}#${i.member}`)].sort());
  assert.deepEqual([r.items.length, r.limit, r.truncated, r.cursor], [4, 500, false, null]);
  const p1 = w.ft.reviewsRequested({ limit: 1, viewer: MACHINE });
  assert.deepEqual([p1.items.length, p1.truncated, p1.cursor], [1, true, `${r.items[0].version}#${r.items[0].member}`]);
  /* dave may not see the project: its template's item is left out, and nothing he is answered names the project */
  const d = page(D);
  assert.deepEqual(d.items.map((i) => [i.version, i.project]).sort(), [[g2.version, null], [g2.version, null], [x2.version, null]].sort());
  assert.equal(of(d, p.version).length, 0);
  assert.equal(JSON.stringify(d).includes(w.P), false, "no item for a hidden template, and no project named");
});

test("R24 a project's template is seen by whoever may see the project; group and profile templates by every member; one hidden is absent from every read and act, and no count names it", () => {
  const w = seeded({ jur: reviewed });
  const a = approved(w);
  w.ft.templatePropose({ template: a.template, text: "p {{group}}", why: "w", proposer: B, viewer: B });
  /* dave sees neither P nor its template */
  const asD = { viewer: D };
  assert.equal(ids(w.ft.templatesFor(asD)).includes(a.template), false);
  assert.deepEqual(ids(w.ft.templatesFor(asD)).sort(), [...PROFILE_IDS].sort());
  assert.equal(w.ft.templatesFor({ state: "proposed", ...asD }).proposals.length, 0);
  for (const r of [w.ft.templateRead({ template: a.template, ...asD }), w.ft.offeredVersion({ template: a.template, ...asD }),
                   w.ft.templateComments({ template: a.template, ...asD }),
                   w.ft.templateComment({ template: a.template, version: a.version, text: "x", author: D, ...asD }),
                   w.ft.templatePropose({ template: a.template, text: "x {{group}}", why: "w", proposer: D, ...asD }),
                   w.ft.templateDraft({ template: a.template, text: TEXT, author: D, ...asD })])
    assert.deepEqual(code(r), code(w.ft.templateRead({ template: "TPL-2026-0000", ...asD })), "absent and hidden: one answer");
  /* a machine viewer sees it; an unrecognised viewer sees nothing at all */
  assert.equal(ids(w.ft.templatesFor({ viewer: MACHINE })).includes(a.template), true);
  assert.equal(ids(w.ft.templatesFor({ viewer: V("carol") })).includes(a.template), true, "an invited participant sees the project");
  assert.deepEqual(w.ft.templatesFor({ viewer: "nobody" }).templates, []);
  assert.deepEqual(w.ft.templatesFor({ viewer: null }).templates, []);
  /* D54: an administrator neither invited nor joined, the founder included, sees the hidden P only at EXISTENCE: its
     template is absent from every read and act, as for dave, and no count names it */
  const E = V("erin");
  for (const viewer of [E, "admin", "member:admin"]) {
    const as = { viewer };
    assert.deepEqual(ids(w.ft.templatesFor(as)).sort(), [...PROFILE_IDS].sort(), viewer);
    assert.equal(w.ft.templatesFor({ state: "proposed", ...as }).proposals.length, 0, viewer);
    for (const r of [w.ft.templateRead({ template: a.template, ...as }), w.ft.offeredVersion({ template: a.template, ...as }),
                     w.ft.templateComments({ template: a.template, ...as })])
      assert.deepEqual(code(r), code(w.ft.templateRead({ template: "TPL-2026-0000", ...as })), `${viewer}: absent and hidden, one answer`);
  }
  refused(w.ft.templateApprove({ version: a.version, widen: true, by: E, viewer: E }), "NO_SUCH_TEMPLATE");
  /* negative controls: an invited administrator sees it whole; so does an administrator, and the founder, of a
     discoverable project, as before D54 */
  const open = seeded({ jur: reviewed });
  const oa = approved(open);
  open.discoverable(open.P);
  for (const viewer of [E, "admin"]) assert.equal(ids(open.ft.templatesFor({ viewer })).includes(oa.template), true, `${viewer}: discoverable`);
  assert.equal(ids(open.ft.templatesFor(asD)).includes(oa.template), false, "a member outside a discoverable project: existence only");
  w.join(w.P, "erin", "invited");
  assert.equal(ids(w.ft.templatesFor({ viewer: E })).includes(a.template), true, "an invited administrator sees it");
  /* once widened, every member */
  assert.equal(w.ft.templateApprove({ version: a.version, widen: true, by: E, viewer: E }).ok, true);
  assert.equal(ids(w.ft.templatesFor(asD)).includes(a.template), true);
  assert.deepEqual(w.ft.templatesFor({ viewer: "nobody" }).templates, []);
});

test("R25 offeredVersion answers the version a filing may use with its metadata: absent, the latest approved (default); a named updated version with updated_by; refusals NO_SUCH_TEMPLATE, TEMPLATE_RETIRED, TEMPLATE_NOT_OFFERED; writes nothing", () => {
  const w = seeded({ jur: reviewed });
  const d = draft(w, { name: "Never approved" });
  refused(w.ft.offeredVersion({ template: d.template, viewer: A }), "TEMPLATE_NOT_OFFERED");
  const a = approved(w);
  const two = w.ft.templateDraft({ template: a.template, text: "Two {{group}}", author: A, viewer: A });
  refused(w.ft.offeredVersion({ template: a.template, version: two.version, viewer: A }), "TEMPLATE_NOT_OFFERED");
  w.ft.templateSubmit({ version: two.version, reviewers: ["frank"], author: A, viewer: A });
  refused(w.ft.offeredVersion({ template: a.template, version: two.version, viewer: A }), "TEMPLATE_NOT_OFFERED");
  w.ft.templateApprove({ version: two.version, reason: "r", by: B, viewer: B });
  const before = w.snapshot();
  const o = w.ft.offeredVersion({ template: a.template, viewer: A });
  assert.deepEqual(w.snapshot(), before);
  assert.deepEqual([o.ok, o.template, o.version, o.number, o.use, o.kind, o.profiles, o.origin, o.sha, o.text, o.state, o.default],
                   [true, a.template, two.version, 2, "file", "records_request", [TEST], "group", sha("Two {{group}}"), "Two {{group}}", "approved", true]);
  assert.equal(o.approved.by.id, "bob");
  const old = w.ft.offeredVersion({ template: a.template, version: a.version, viewer: A });
  assert.deepEqual([old.state, old.updated_by, old.default, old.sha], ["updated", two.version, undefined, sha(TEXT)]);
  assert.equal(w.ft.offeredVersion({ template: a.template, version: 1, viewer: A }).version, a.version);
  const p = w.ft.offeredVersion({ template: "TPL-test-commitment-brief", viewer: A });
  assert.deepEqual([p.origin, p.use, p.state, p.default], ["profile", "brief", "approved", true]);
  refused(w.ft.offeredVersion({ template: a.template, viewer: D }), "NO_SUCH_TEMPLATE");
  refused(w.ft.offeredVersion({ template: "TPL-2026-0000", viewer: A }), "NO_SUCH_TEMPLATE");
  w.ft.templateRetire({ template: a.template, reason: "retired now", by: A, viewer: A });
  const ret = refused(w.ft.offeredVersion({ template: a.template, version: a.version, viewer: A }), "TEMPLATE_RETIRED");
  assert.equal(ret.retired.reason, "retired now");
});

test("R26 a template's handle: its name case-folded, each run of characters other than ASCII letters and digits one -, none at either end; a name with no ASCII letter or digit has none", () => {
  for (const [name, h] of [["Records request", "records-request"], ["records-request", "records-request"], ["  Records -- Request!  ", "records-request"],
                           ["Request under the records act", "request-under-the-records-act"], ["Plan B (2026)", "plan-b-2026"],
                           ["Café ask", "caf-ask"], ["x", "x"], ["--", null], ["été", "t"], ["日本", null], ["", null], [null, null], [7, null]])
    assert.equal(ft.templateHandle(name), h, JSON.stringify(name));
  for (const ok of ["@records-request", "@a", "@a1-b2-c3"]) assert.match(ok, ft.TEMPLATE_NAME_REF_RE);
  for (const bad of ["records-request", "@", "@Records", "@a--b", "@-a", "@a-", "@a b", "@a_b", "@@a", " @a"]) assert.doesNotMatch(bad, ft.TEMPLATE_NAME_REF_RE);
});

test("R26 offeredVersion takes {name, project?, version?} in place of template: among templates not retired that the viewer may see, the project's first (when given), then the group's, then the active profiles'; the first scope holding the handle answers, and R25 answers its version exactly as for its id; writes nothing", () => {
  const w = seeded({ jur: reviewed });
  const E = V("erin");
  w.join(w.P, "erin", "invited"); /* D54: the administrator who widens P's templates sees the hidden P as invited */
  const P = { project: w.P };
  const by = (name, x = {}) => w.ft.offeredVersion({ name, viewer: A, ...x });
  const same = (named, id, x = {}) => assert.deepEqual(named, w.ft.offeredVersion({ template: id, viewer: A, ...x }));
  /* the profile's templates, by their own names' handles (R15, R26: each template's own name; a single template written
     without one, by its kind's label) */
  const pt = jurisdictions.get(TEST).action_kinds;
  for (const k of pt)
    for (const t of k.templates || [k.template]) same(by(`@${ft.templateHandle(t.name || k.label)}`), t.id);
  same(by("@request-under-the-records-act", P), "TPL-test-records-request");
  /* two project templates whose names share a handle, then one widened: project first when given, else the group's */
  const wide = approved(w, { name: "Records request" });
  w.clock.now = "2026-10-02T00:00:00Z";
  const own = approved(w, { name: "Records-request" });
  const amb = refused(by("@records-request", P), "TEMPLATE_NAME_AMBIGUOUS");
  for (const id of [wide.template, own.template]) assert.equal(JSON.stringify(amb).includes(id), false, "naming neither");
  refused(by("@records-request"), "NO_SUCH_TEMPLATE", "a project's templates are asked only when the project is given");
  assert.equal(w.ft.templateApprove({ version: wide.version, widen: true, by: E, viewer: E }).ok, true);
  const p1 = by("@records-request", P);
  same(p1, own.template);
  assert.deepEqual([p1.ok, p1.template, p1.version, p1.default, p1.origin], [true, own.template, own.version, true, "group"]);
  same(by("@records-request"), wide.template);
  same(by("@records-request", { project: w.Q }), wide.template, "another project holds none: the group's answers");
  /* the group's before the profile's */
  const shadow = approved(w, { name: "Request under the records act" });
  w.ft.templateApprove({ version: shadow.version, widen: true, by: E, viewer: E });
  same(by("@request-under-the-records-act"), shadow.template);
  /* a retired template is not resolved: the next scope holding the handle answers */
  w.ft.templateRetire({ template: shadow.template, reason: "superseded", by: E, viewer: E });
  same(by("@request-under-the-records-act"), "TPL-test-records-request");
  /* version: a named updated version, with updated_by, as for its id */
  const two = w.ft.templateDraft({ template: own.template, text: "Two {{group}}", author: A, viewer: A });
  w.ft.templateSubmit({ version: two.version, reviewers: ["frank"], author: A, viewer: A });
  w.ft.templateApprove({ version: two.version, reason: "r", by: B, viewer: B });
  const old = by("@records-request", { ...P, version: own.version });
  same(old, own.template, { version: own.version });
  assert.deepEqual([old.state, old.updated_by], ["updated", two.version]);
  assert.deepEqual(by("@records-request", { ...P, version: 1 }).version, own.version);
  /* R25's refusals follow the resolution: a template with no approved version */
  draft(w, { name: "Only drafted" });
  refused(by("@only-drafted", P), "TEMPLATE_NOT_OFFERED");
  /* writes nothing */
  const before = w.snapshot();
  by("@records-request", P); by("@records-request"); by("@nothing-here", P); by("bad"); w.ft.offeredVersion({ viewer: A });
  assert.deepEqual(w.snapshot(), before);
});

test("R26 refusals in order, each writing nothing: template and name both or neither, or a name not @ and a handle, TEMPLATE_REF_REFUSED; no such template in any scope NO_SUCH_TEMPLATE, R25's one answer (a hidden one answers as absent); two in the first scope holding it TEMPLATE_NAME_AMBIGUOUS; then R25's", () => {
  const w = seeded();
  const a = approved(w, { name: "Records request" });
  const before = w.snapshot();
  const P = { project: w.P };
  refused(w.ft.offeredVersion({ template: a.template, name: "@records-request", ...P, viewer: A }), "TEMPLATE_REF_REFUSED");
  for (const x of [{}, { template: "", name: "" }, { template: null, name: null }, { version: 1 }])
    refused(w.ft.offeredVersion({ ...x, viewer: A }), "TEMPLATE_REF_REFUSED");
  for (const name of ["records-request", "@Records-request", "@records--request", "@records request", "@", "@-x", ["@x"], 7])
    refused(w.ft.offeredVersion({ name, ...P, viewer: A }), "TEMPLATE_REF_REFUSED");
  /* refused before resolution: a malformed name for a template that exists is not answered as it */
  assert.equal(w.ft.offeredVersion({ name: "@Records-request", ...P, viewer: A }).template, undefined);
  /* absent and hidden: one answer, as R25's for an id */
  const none = refused(w.ft.offeredVersion({ name: "@nothing-here", ...P, viewer: A }), "NO_SUCH_TEMPLATE");
  const hidden = refused(w.ft.offeredVersion({ name: "@records-request", ...P, viewer: D }), "NO_SUCH_TEMPLATE");
  assert.deepEqual(hidden, none);
  assert.deepEqual(code(none), code(w.ft.offeredVersion({ template: "TPL-2026-0000", viewer: A })));
  assert.equal(JSON.stringify(hidden).includes(a.template), false);
  /* negative control: the same name for a viewer who may see it */
  assert.equal(w.ft.offeredVersion({ name: "@records-request", ...P, viewer: A }).template, a.template);
  assert.deepEqual(w.snapshot(), before);
  /* ambiguity among the active profiles' templates: two profiles' templates under one label */
  const bad = structuredClone(twoProfiles.get(HARBOUR));
  bad.action_kinds.find((k) => k.kind === "records_request").template = { ...structuredClone(jurisdictions.get(TEST).action_kinds[0].template),
    id: "TPL-test-harbour-records" };
  const jur = reviewedOf({ ...twoProfiles, get: (id) => (id === HARBOUR ? structuredClone(bad) : twoProfiles.get(id)) });
  const w2 = seeded({ profiles: [TEST, HARBOUR], jur });
  refused(w2.ft.offeredVersion({ name: "@request-under-the-records-act", viewer: A }), "TEMPLATE_NAME_AMBIGUOUS");
  assert.equal(w2.ft.offeredVersion({ template: "TPL-test-harbour-records", viewer: A }).ok, true, "each still named by its id");
  /* an earlier scope holding one answers before a later scope's ambiguity */
  const g = approved(w2, { name: "Request under the records act" });
  w2.join(w2.P, "erin", "invited"); /* D54: seen by the administrator as invited */
  assert.equal(w2.ft.templateApprove({ version: g.version, widen: true, by: V("erin"), viewer: V("erin") }).ok, true);
  assert.equal(w2.ft.offeredVersion({ name: "@request-under-the-records-act", viewer: A }).template, g.template);
});
