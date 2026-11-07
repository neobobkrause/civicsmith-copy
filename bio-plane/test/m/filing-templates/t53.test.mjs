/* filing-templates, T53 (R15, R35, R36, R37, R38; N1257, N858, DEC-404, K5458, K5528, K5629): a profile template's
   attribution judged by `jurisdictions`' `attributionLacks` (its R126) and nothing here; templates written for layers
   and packages; profile templates read per layer, a handle two layers share refused with their names. At the module's
   interface, under the held profiles (the test profile, and the first profile's package and its layers) with made-up
   templates added to them, handed in as `jurisdictions`; the judge and the expansion are the provider's real code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, draft, approved, V, TEST, MACHINE, secret, proReview } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";

const A = V("alice");
const FED = "us-federal", CA = "us-california", ALA = "us-ca-alameda-county", OAK = "us-ca-oakland", PKG = "oakland-alameda";
const CHAIN = [FED, CA, ALA, OAK];
const row = (c) => ft.FILING_TEMPLATE_CHECKS[c];
const refused = (r, c) => { assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, c, c, row(c).check, row(c).translation], JSON.stringify(r).slice(0, 400)); return r; };
const ids = (r) => r.templates.map((t) => t.id);
const kindOf = (p, kind) => p.action_kinds.find((k) => k.kind === kind);

/* A made-up profile template, its attribution whole unless `over` changes it; its professional review is of its text. */
function tpl(id, name, over = {}) {
  const text = over.text ?? `To the {{counterparty_role}}: {{group}} asks (${id}).`;
  return { id, version: 1, use: "file", text, notes: "A made-up template for tests.", authored_by: "Ada Example", contributors: [],
           approved_by: "Cy Example", approved_at: "2026-09-01", basis: "TEST", purpose: "initial", name,
           sources: [{ citation: "P.E.B.L. § 1" }], reviews: [proReview(text)], ...over };
}
/* The held profiles with `templates` set on one kind of the named profiles, handed in as `jurisdictions`. */
const withTemplates = (byProfile, kind = "records_request") => ({ ...jurisdictions, get: (id) => {
  const p = jurisdictions.get(id);
  if (p && byProfile[id]) { const k = kindOf(p, kind); k.templates = byProfile[id]; delete k.template; }
  return p;
} });

/* ------------------------------------------------------------------------------------------------ R38, R15, R35 */

const FOUR = {
  writer: tpl("TPL-t53-writer", "Lacks writer", { authored_by: "" }),
  sources: tpl("TPL-t53-sources", "Lacks sources", { sources: [] }),
  professional_review: tpl("TPL-t53-review", "Lacks review", { reviews: [] }),
  second_approval: tpl("TPL-t53-approval", "Lacks approval", { approved_by: "Ada Example" }),
};

test("R38 R15 four profile templates lacking the writer, the sources, the professional review and the second approver each read TEMPLATE_NOT_REVIEWED with that word; unofferedFor answers jurisdictions' words for the same templates; no answer or translation holds `approver`; control: a complete template is offered", () => {
  const jur = withTemplates({ [TEST]: [...Object.values(FOUR), tpl("TPL-t53-whole", "Whole")] });
  const w = seeded({ jur });
  const answers = [];
  for (const [word, t] of Object.entries(FOUR)) {
    const o = refused(w.ft.offeredVersion({ template: t.id, viewer: A }), "TEMPLATE_NOT_REVIEWED");
    assert.deepEqual([o.template, o.lacks], [t.id, [word]], word);
    const r = w.ft.templateRead({ template: t.id, viewer: A });
    assert.deepEqual([r.offered, r.not_offered.lacks], [false, [word]], word);
    answers.push(o, r);
  }
  /* unofferedFor answers, for the same templates, what jurisdictions' own textsLack answers for the profile */
  const listed = w.ft.unofferedFor({ kind: "records_request", viewer: A });
  const theirs = jurisdictions.textsLack(jur.get(TEST)).filter((x) => x.kind === "records_request").map((x) => x.lacks);
  assert.deepEqual(listed.map((x) => x.lacks), theirs, "the same words, in the same order, as R126's textsLack");
  assert.deepEqual(listed.map((x) => [x.name, x.lacks]), Object.entries(FOUR).map(([word, t]) => [t.name, [word]]));
  answers.push(listed);
  assert.ok(!/\bapprover\b/.test(JSON.stringify(answers)), "no answer names `approver`");
  assert.ok(!/\bapprover\b/.test(row("TEMPLATE_NOT_REVIEWED").translation), "nor the translation");
  /* control: the complete template is offered and not listed */
  const ok = w.ft.offeredVersion({ template: "TPL-t53-whole", viewer: A });
  assert.deepEqual([ok.ok, ok.origin], [true, "profile"]);
  assert.ok(!listed.some((x) => x.name === "Whole"));
  assert.deepEqual(ids(w.ft.templatesFor({ viewer: A })), ["TPL-t53-whole"]);
});

test("R38 R15 (T53) a review counts only as jurisdictions' R126 counts it: one lacking an organisation or a credential, by a machine, or of an earlier text lacks professional_review; a machine writer lacks writer; control: the changed text reviewed again is offered", () => {
  const base = tpl("TPL-t53-x", "Counted");
  const cases = [
    [{ reviews: [proReview(base.text, { organisation: "" })] }, ["professional_review"], "no organisation"],
    [{ reviews: [proReview(base.text, { credential: undefined })] }, ["professional_review"], "no credential"],
    [{ reviews: [proReview(base.text, { reviewer: MACHINE })] }, ["professional_review"], "a machine reviewer"],
    [{ text: `${base.text} Changed.`, reviews: [proReview(base.text)] }, ["professional_review"], "a review of the text before it changed"],
    [{ reviews: [{ ...proReview(base.text), reviewed_text_sha: undefined }] }, ["professional_review"], "a review with no hash of the text"],
    [{ authored_by: MACHINE }, ["writer"], "a machine writer"],
    [{ text: `${base.text} Changed.`, reviews: [proReview(base.text), proReview(`${base.text} Changed.`, { at: "2026-09-10" })] }, [], "control: reviewed again"],
    [{}, [], "control: whole"],
  ];
  for (const [over, want, why] of cases) {
    const t = { ...base, ...over };
    assert.deepEqual(jurisdictions.attributionLacks(t), want, `the provider's judge agrees: ${why}`);
    const w = seeded({ jur: withTemplates({ [TEST]: [t] }) });
    const o = w.ft.offeredVersion({ template: t.id, viewer: A });
    if (!want.length) { assert.equal(o.ok, true, why); continue; }
    assert.deepEqual(refused(o, "TEMPLATE_NOT_REVIEWED").lacks, want, why);
    assert.deepEqual(w.ft.unofferedFor({ kind: "records_request", viewer: A }).map((x) => x.lacks), [want], why);
  }
  /* an empty profile list answers [] */
  assert.deepEqual(seeded({ profiles: [] }).ft.unofferedFor({ kind: "records_request", viewer: A }), []);
});

test("R35 (T53) unofferedFor: the first profile's @records-request with no named writer answers lacks writer, read from the layer that holds it; one whose only review lacks an organisation answers professional_review; control: an offered template is not listed", () => {
  const first = jurisdictions.list().find((p) => !p.test).id;
  const none = withTemplates({ [FED]: [tpl("TPL-t53-fed-rr", "Records request", { authored_by: "" })] });
  const w = seeded({ profiles: [first], jur: none });
  assert.deepEqual(w.ft.unofferedFor({ kind: "records_request", viewer: A }), [{ handle: "records-request", name: "Records request", lacks: ["writer"] }]);
  const t = tpl("TPL-t53-fed-rr", "Records request");
  const noOrg = seeded({ profiles: [first], jur: withTemplates({ [FED]: [{ ...t, reviews: [proReview(t.text, { organisation: " " })] }] }) });
  assert.deepEqual(noOrg.ft.unofferedFor({ kind: "records_request", viewer: A }).map((x) => x.lacks), [["professional_review"]]);
  const offered = seeded({ profiles: [first], jur: withTemplates({ [FED]: [t] }) });
  assert.deepEqual(offered.ft.unofferedFor({ kind: "records_request", viewer: A }), []);
  assert.equal(offered.ft.offeredVersion({ name: "@records-request", viewer: A }).ok, true);
});

/* ------------------------------------------------------------------------------------------------ R37 */

test("R37 a federal and a city profile template both named \"Records request\" answer TEMPLATE_NAME_AMBIGUOUS naming both layers, choosing neither; by id each is offered with its layer; templatesFor shows each name with its layer; control: one such template resolves as before", () => {
  const jur = withTemplates({ [FED]: [tpl("TPL-t53-fed", "Records request")], [OAK]: [tpl("TPL-t53-oak", "Records request")] });
  for (const profiles of [[PKG], CHAIN]) {
    const w = seeded({ profiles, jur });
    const before = w.snapshot();
    for (const call of [(x) => w.ft.offeredVersion(x), (x) => w.ft.templateByHandle(x)]) {
      const r = refused(call({ name: "@records-request", viewer: A }), "TEMPLATE_NAME_AMBIGUOUS");
      assert.deepEqual(r.layers, [{ layer: FED, level: "federal", place: "United States" }, { layer: OAK, level: "city", place: "Oakland" }], String(profiles));
      assert.ok(!("template" in r) && !("text" in r), "neither chosen");
    }
    for (const [id, layer] of [["TPL-t53-fed", FED], ["TPL-t53-oak", OAK]]) {
      const o = w.ft.offeredVersion({ template: id, viewer: A });
      assert.deepEqual([o.ok, o.template, o.origin], [true, id, "profile"], id);
      assert.equal(w.ft.templateRead({ template: id, viewer: A }).template.layer, layer);
    }
    const listed = w.ft.templatesFor({ viewer: A }).templates;
    assert.deepEqual(listed.map((t) => [t.id, t.layer, t.name]).sort(), [["TPL-t53-fed", FED, "Records request"], ["TPL-t53-oak", OAK, "Records request"]]);
    for (const t of listed) {
      assert.ok(typeof t.name_shown === "string" && t.name_shown.includes("Records request"), "shown with its layer");
      assert.ok(t.name_shown.includes(t.layer === FED ? "United States" : "Oakland"), t.name_shown);
    }
    assert.deepEqual(w.snapshot(), before, "the reads write nothing");
  }
  /* control: one profile template with that handle resolves as before, its name shown plain */
  const one = seeded({ profiles: [PKG], jur: withTemplates({ [OAK]: [tpl("TPL-t53-oak", "Records request")] }) });
  const r = one.ft.offeredVersion({ name: "@records-request", viewer: A });
  assert.deepEqual([r.ok, r.template], [true, "TPL-t53-oak"]);
  const listed = one.ft.templatesFor({ viewer: A }).templates;
  assert.deepEqual(listed.map((t) => [t.id, t.layer, t.name_shown]), [["TPL-t53-oak", OAK, undefined]]);
  /* a profile that is no layer is its own layer; two of its templates sharing a handle are ambiguous with no layers named */
  const flat = seeded({ jur: withTemplates({ [TEST]: [tpl("TPL-t53-a", "Same"), tpl("TPL-t53-b", "Same")] }) });
  const amb = refused(flat.ft.offeredVersion({ name: "@same", viewer: A }), "TEMPLATE_NAME_AMBIGUOUS");
  assert.equal(amb.layers, undefined);
  assert.equal(flat.ft.templateRead({ template: "TPL-t53-a", viewer: A }).template.layer, TEST);
});

/* ------------------------------------------------------------------------------------------------ R36 */

/* A group version approved with a member's review and a professional's (whatever its tier asks), by bob, not its author. */
function approvedBoth(w, x) {
  const d = draft(w, x);
  const ok = (r) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r; };
  ok(w.ft.templateReviewGrant({ version: d.version, recipient: "Pat Lawyer", organisation: "Legal Aid (test)", secretSha: secret(d.version), by: A, viewer: A }));
  ok(w.ft.templateSubmit({ version: d.version, reviewers: ["frank"], author: A, viewer: A }));
  ok(w.ft.templateReview({ version: d.version, outcome: "no_concerns", scope: "legal sufficiency", secretSha: secret(d.version) }));
  ok(w.ft.templateReview({ version: d.version, outcome: "no_concerns", scope: "plain words", author: V("frank"), viewer: V("frank") }));
  ok(w.ft.templateApprove({ version: d.version, by: V("bob"), viewer: V("bob") }));
  return d;
}

test("R36 a group template recorded for the package oakland-alameda is offered under the full chain and not under federal and California alone; one for the federal layer under any chain; control: general is offered under every chain", () => {
  const w = seeded({ profiles: [PKG] });
  const pkg = approvedBoth(w, { profiles: [PKG], name: "For the package" });
  const fed = approvedBoth(w, { profiles: [FED], name: "For the federal layer" });
  const city = approvedBoth(w, { profiles: [OAK], name: "For the city layer" });
  const gen = approvedBoth(w, { profiles: "general", name: "For any place" });
  const set = (profiles) => { const r = w.record.setSetting("jurisdiction_profiles", profiles, "test"); assert.equal(r.ok, true, JSON.stringify(r)); };
  const offered = (t) => w.ft.offeredVersion({ template: t.template, viewer: A }).ok === true;
  const all = [pkg, fed, city, gen];
  for (const chain of [[PKG], CHAIN]) {
    set(chain);
    assert.deepEqual(all.map(offered), [true, true, true, true], String(chain));
    assert.deepEqual(ids(w.ft.templatesFor({ viewer: A })).sort(), all.map((t) => t.template).sort(), String(chain));
  }
  set([FED, CA]);
  assert.deepEqual(all.map(offered), [false, true, false, true], "federal and California alone");
  const o = refused(w.ft.offeredVersion({ template: pkg.template, viewer: A }), "TEMPLATE_NOT_OFFERED");
  assert.deepEqual(o.layers_inactive, [ALA, OAK], "the layers the team's places do not include");
  refused(w.ft.offeredVersion({ template: city.template, viewer: A }), "TEMPLATE_NOT_OFFERED");
  assert.deepEqual(ids(w.ft.templatesFor({ viewer: A })).sort(), [fed.template, gen.template].sort());
  const r = w.ft.templateRead({ template: pkg.template, viewer: A });
  assert.deepEqual([r.ok, r.offered, r.layers_inactive, r.version.state], [true, false, [ALA, OAK], "approved"], "still readable");
  /* the stored list is as written: the package id, never rewritten to its layers */
  assert.deepEqual(r.template.profiles, [PKG]);
  set([FED]);
  assert.deepEqual(all.map(offered), [false, true, false, true], "the federal layer alone");
  /* a template naming a profile that is no layer is judged as before T53 */
  const t = seeded();
  const plain = approved(t, { name: "On the test profile" });
  assert.equal(t.ft.offeredVersion({ template: plain.template, viewer: A }).ok, true);
  /* a template naming a layer is a filing for that layer's kinds: one the layer does not hold is refused, naming it */
  set([PKG]);
  const unknown = refused(w.ft.templateDraft({ project: w.P, kind: "media", use: "file", profiles: [FED], name: "Media", text: "{{group}} writes.", author: A, viewer: A }), "TEMPLATE_KIND_UNKNOWN");
  assert.equal(unknown.profile, FED);
  const ok = w.ft.templateDraft({ project: w.P, kind: "media", use: "file", profiles: [OAK], name: "Media", text: "{{group}} writes.", author: A, viewer: A });
  assert.equal(ok.ok, true, JSON.stringify(ok));
});
