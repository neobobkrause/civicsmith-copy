/* filing-templates, T51 (T51-163; R34, R35; N1046, N858 D8; DEC-340, U366; K3935): `templateByHandle`, a template's text by
   its handle for a member's session, and `unofferedFor`, the templates a kind holds that R15 does not offer with what
   each lacks. At the interface, under the test profile and copies of it handed in as `jurisdictions`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, draft, approved, V, TEST, secret, sha, reviewedOf, proReview } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";

const A = V("alice");
const kindOf = (p, kind) => p.action_kinds.find((k) => k.kind === kind);
const editedOf = (edit, base = jurisdictions) => ({ ...base, get: (id) => { const p = base.get(id); if (p && p.id === TEST) edit(p); return p; } });
/* the test profile's records request template, renamed "Records request" so `@records-request` names it, its attribution whole */
const renamed = (p) => { const k = kindOf(p, "records_request"); k.templates = [{ ...(k.templates?.[0] ?? k.template), name: "Records request", purpose: "initial" }]; delete k.template; };
const offeredWorld = () => seeded({ jur: reviewedOf(jurisdictions, renamed) });
const refusal = (r, code) => assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation, "text" in r],
  [false, code, code, ft.FILING_TEMPLATE_CHECKS[code].check, ft.FILING_TEMPLATE_CHECKS[code].translation, false], JSON.stringify(r).slice(0, 300));

test("R34 templateByHandle answers the text of the version a handle names for a member: @records-request over the test profile's template answers its text, blanks in order, sha and kind of draft", () => {
  const w = offeredWorld();
  const before = w.snapshot();
  const r = w.ft.templateByHandle({ name: "@records-request", viewer: A });
  const k = kindOf(jurisdictions.get(TEST), "records_request");
  const t = k.templates?.[0] ?? k.template;
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(Object.keys(r).sort(), ["blanks", "default", "label", "name", "ok", "origin", "sha", "template", "text", "version"]);
  assert.deepEqual([r.template, r.name, r.origin, r.default, r.text, r.sha], [t.id, "Records request", "profile", true, t.text, sha(t.text)]);
  assert.deepEqual(r.blanks, ft.blanksOf(t.text).blanks, "R19's names in order of first appearance");
  assert.equal(r.label, k.label, "the template's kind of draft");
  assert.equal(r.version, w.ft.offeredVersion({ template: t.id, viewer: A }).version, "the version R25 offers");
  assert.deepEqual(w.snapshot(), before, "a read writes nothing");
  /* the group's own approved template, named in its project, answers as R26 resolves it */
  const g = seeded();
  const a = approved(g, { name: "Records ask here" });
  const own = g.ft.templateByHandle({ name: "@records-ask-here", project: g.P, viewer: A });
  assert.deepEqual([own.ok, own.template, own.version, own.origin, own.default, own.text], [true, a.template, a.version, "group", true, g.ft.offeredVersion({ template: a.template, viewer: A }).text]);
  assert.equal(g.ft.templateByHandle({ name: "@records-ask-here", project: g.P, version: a.version, viewer: A }).version, a.version, "a named version");
});

test("R34 refusals are R26's and R25's, in their order, each writing nothing and answering no text: a name with no visible template is NO_SUCH_TEMPLATE; control: a draft and an unreviewed profile template are never answered", () => {
  const w = seeded();
  const before = w.snapshot();
  refusal(w.ft.templateByHandle({ name: "@no-such-thing", viewer: A }), "NO_SUCH_TEMPLATE");
  refusal(w.ft.templateByHandle({ name: "records-request", viewer: A }), "TEMPLATE_REF_REFUSED");
  refusal(w.ft.templateByHandle({ viewer: A }), "TEMPLATE_REF_REFUSED");
  /* a project's draft is no offered version: its text is never answered */
  draft(w, { name: "Draft only" });
  refusal(w.ft.templateByHandle({ name: "@draft-only", project: w.P, viewer: A }), "TEMPLATE_NOT_OFFERED");
  /* the same template is not visible to one outside its project */
  refusal(w.ft.templateByHandle({ name: "@draft-only", project: w.P, viewer: V("dave") }), "NO_SUCH_TEMPLATE");
  /* a profile template lacking its attribution is withheld, whatever its text */
  const t = kindOf(jurisdictions.get(TEST), "records_request");
  const un = seeded({ jur: editedOf(renamed) });
  const refused = un.ft.templateByHandle({ name: "@records-request", viewer: A });
  refusal(refused, "TEMPLATE_NOT_REVIEWED");
  assert.ok(!JSON.stringify(refused).includes((t.templates?.[0] ?? t.template).text), "its text is nowhere in the answer");
  /* an approved template, a version it does not have */
  const a = approved(w, { name: "Offered here" });
  refusal(w.ft.templateByHandle({ name: "@offered-here", project: w.P, version: 9, viewer: A }), "TEMPLATE_NOT_OFFERED");
  assert.equal(w.ft.templateByHandle({ name: "@offered-here", project: w.P, viewer: A }).template, a.template, "control: the approved one answers");
  assert.deepEqual(Object.keys(w.snapshot()), Object.keys(before));
});

test("R34 a grant's door does not reach it: the op reads no secret, so a live grant's digest opens nothing; the op answers as the function does, its stamps from the query", () => {
  const w = seeded();
  const d = draft(w, { name: "Draft only" });
  const g = w.ft.templateReviewGrant({ version: d.version, recipient: "R", organisation: "O", secretSha: secret("door"), by: A, viewer: A });
  assert.equal(g.ok, true);
  const op = (query, body = {}) => ft.filingTemplatesOps(w.ft, new URL(`https://plane.example/op?${new URLSearchParams(query)}`), body).templatebyhandle();
  refusal(op({ name: "@draft-only" }, { secretSha: secret("door") }), "NO_SUCH_TEMPLATE");
  refusal(op({ name: "@draft-only", project: w.P, viewer: A }, { secretSha: secret("door") }), "TEMPLATE_NOT_OFFERED");
  const a = approved(w, { name: "Offered here" });
  assert.deepEqual(op({ name: "@offered-here", project: w.P, viewer: A }), w.ft.templateByHandle({ name: "@offered-here", project: w.P, viewer: A }));
  assert.equal(op({ name: "@offered-here", project: w.P, viewer: A }).template, a.template);
});

test("R35 unofferedFor lists the kind's profile templates R15 does not offer, each {handle, name, lacks}: with no named writer lacks says writer; control: an offered template is not listed", () => {
  const k = (p) => kindOf(p, "records_request");
  const lacking = (patch) => seeded({ jur: editedOf((p) => { renamed(p); k(p).templates = [patch(k(p).templates[0])]; }) });
  const whole = (t) => ({ ...t, sources: [{ citation: "P.E.B.L. § 1" }], reviews: [proReview(t.text)] });
  const listed = (w, kind = "records_request", viewer = A) => w.ft.unofferedFor({ kind, viewer });
  const one = (patch, lacks) => assert.deepEqual(listed(lacking((t) => patch(whole(t)))), [{ handle: "records-request", name: "Records request", lacks }]);
  one((t) => ({ ...t, authored_by: "" }), ["writer"]);
  one((t) => ({ ...t, sources: [] }), ["sources"]);
  one((t) => ({ ...t, reviews: [] }), ["professional_review"]);
  one((t) => ({ ...t, approved_by: "" }), ["second_approval"]);
  one((t) => ({ ...t, approved_by: t.authored_by }), ["second_approval"]);
  one((t) => ({ ...t, authored_by: "", sources: [], reviews: [], approved_by: "" }), ["writer", "sources", "professional_review", "second_approval"]);
  /* control: the same template with its attribution whole is offered, so not listed */
  assert.deepEqual(listed(lacking(whole)), []);
  assert.equal(offeredWorld().ft.offeredVersion({ name: "@records-request", viewer: A }).ok, true);
  assert.deepEqual(listed(offeredWorld()), []);
  /* the test profile as it stands: every template of the kind that lacks a part, read from the profile's own declaration */
  const w = seeded();
  const decl = k(jurisdictions.get(TEST));
  const set = decl.templates ?? [decl.template];
  const got = listed(w);
  assert.deepEqual(got.map((x) => x.name), set.map((t) => t.name ?? decl.label));
  for (const x of got) assert.deepEqual(Object.keys(x), ["handle", "name", "lacks"]);
});

test("R35 unofferedFor reads only the view: a kind filed with a court, another kind, an unknown kind and a viewer who is no member each answer [] or only their own; it writes nothing", () => {
  const w = seeded();
  const before = w.snapshot();
  const court = seeded({ jur: editedOf((p) => { kindOf(p, "bylaw_complaint").venue.how = "court"; }) });
  assert.deepEqual(court.ft.unofferedFor({ kind: "bylaw_complaint", viewer: A }), [], "R28: a court's kind");
  assert.ok(w.ft.unofferedFor({ kind: "bylaw_complaint", viewer: A }).length > 0, "control: the same kind, not a court's, lists its templates");
  for (const x of w.ft.unofferedFor({ kind: "bylaw_complaint", viewer: A })) assert.ok(x.lacks.length > 0);
  assert.deepEqual(w.ft.unofferedFor({ kind: "no_such_kind", viewer: A }), []);
  assert.deepEqual(w.ft.unofferedFor({ viewer: A }), []);
  assert.deepEqual(w.ft.unofferedFor({ kind: "records_request", viewer: null }), [], "no member, no view");
  const none = seeded({ profiles: [] });
  assert.deepEqual(none.ft.unofferedFor({ kind: "records_request", viewer: A }), [], "no active profile");
  assert.deepEqual(w.snapshot(), before);
});
