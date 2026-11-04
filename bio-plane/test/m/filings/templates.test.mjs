/* filings — templates, the member's own words and the briefing (T21: K921, K922, K924): R28 (the version a filing is
   filled from, or the member's words), R29 (the version recorded, the not-written-for statement, the flags after an
   update or a retirement), R31 (a `brief` template's `briefing` section, at every tier) and R32 (a template draft from an
   approved filing draft). Driven at the module's interface and through its ops, over the real modules: every group
   template is made by `filing-templates`' own acts (drafted, submitted, reviewed and approved by members). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, STRANGER, PROFILE, WORDS, LAW, sha, WHY } from "./fixture.mjs";
import { filingsOps, counselMarking, TEMPLATES_NAMED_MAX } from "../../../src/filings/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const COUNSEL = { name: "A. Counsel", organisation: "Test Chambers" };
const prep = (x, action, over = {}) => x.f.filingPrepare({ action, preparer: V("bo"), viewer: V("bo"), ...over });
const PROFILE_TPL = "TPL-test-bylaw-complaint";
const BRIEF_TPL = "TPL-test-commitment-brief";

/* A group template approved through filing-templates' acts: bo drafts it in the project, cy reviews it, olive (an owner,
   not its author) approves it. `o` over { kind, use, profiles, name, text, reason }; answers its id. */
function approved(x, o = {}) {
  const t = x.f.filingTemplates;
  const d = t.templateDraft({ project: x.proj, kind: "bylaw_complaint", use: "file", profiles: [PROFILE], name: `template ${Math.random()}`,
                              text: "To the {{counterparty_role}} ({{counterparty_body}}): {{act}} on {{act_date}}.",
                              author: V("bo"), viewer: V("bo"), ...o, reason: undefined });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  return pass(x, d.version, o.reason) && d.template;
}
/* A version through review to approval (R7, R9, R10). */
function pass(x, version, reason = undefined) {
  const t = x.f.filingTemplates;
  const s = t.templateSubmit({ version, reviewers: ["member:cy"], author: V("bo"), viewer: V("bo") });
  assert.equal(s.ok, true, JSON.stringify(s).slice(0, 300));
  const r = t.templateReview({ version, outcome: "no_concerns", scope: "the whole text", author: V("cy"), viewer: V("cy") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const a = t.templateApprove({ version, reason, by: V("olive"), viewer: V("olive") });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  return true;
}
/* A second version of template `id`, approved: the first becomes `updated` (filing-templates R10). */
function update(x, id, text) {
  const d = x.f.filingTemplates.templateDraft({ template: id, text, author: V("bo"), viewer: V("bo") });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  pass(x, d.version);
  return d.version;
}
const retire = (x, template, reason) => {
  const r = x.f.filingTemplates.templateRetire({ template, reason, by: V("olive"), viewer: V("olive") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
};

test("R28 R3 a filing takes at most one of template and text: the profile's file template's latest approved version by default, a named template's latest by default, a named updated version (said updated, naming its successor), the member's own words; both is TEMPLATE_AND_TEXT", async () => {
  const x = world();
  const A = x.action();
  /* neither named: the profile's file template for the kind */
  const p = prep(x, A);
  const profileText = x.profile().action_kinds.find((k) => k.kind === "bylaw_complaint").template.text;
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
  /* R71 (T53): a profile template also records the layer that holds it (a plain profile is its own layer) */
  assert.deepEqual(p.template, { id: PROFILE_TPL, version: 1, sha: sha(profileText), origin: "profile", layer: PROFILE });
  assert.equal(p.text, `To the Selectboard: the adoption recorded as ${x.ACT_EVENT} does not conform to P.E.B.L. § 12; MCBC 2025-3.`);
  /* a group template: its latest approved version by default */
  const T = approved(x, { name: "notice" });
  const v2 = update(x, T, "Second words to the {{counterparty_role}}: {{act}}.");
  const latest = prep(x, A, { template: { id: T } });
  assert.deepEqual([latest.ok, latest.template.id, latest.template.version, latest.template.origin], [true, T, 2, "group"]);
  assert.equal(latest.text, `Second words to the Selectboard: the adoption recorded as ${x.ACT_EVENT}.`);
  assert.equal(latest.template_version.default, true);
  assert.equal(prep(x, A, { template: T }).template.version, 2, "a bare id names the template too");
  /* a named updated version: offered, said updated, naming its successor */
  const old = prep(x, A, { template: { id: T, version: 1 } });
  assert.deepEqual([old.ok, old.template.version, old.template_version.state, old.template_version.updated_by], [true, 1, "updated", v2]);
  assert.equal(old.template_version.says, word("filings.says.version_updated", { number: 1, updated_by: v2 }));
  assert.equal(old.text, `To the Selectboard (Port Ellery Selectboard): the adoption recorded as ${x.ACT_EVENT} on 2026-03-02.`);
  /* the member's own words, filled as a template's (R3): template null */
  const own = prep(x, A, { text: WORDS });
  assert.deepEqual([own.ok, own.template], [true, null]);
  assert.equal(own.text, `To the Selectboard: the adoption recorded as ${x.ACT_EVENT} does not conform to P.E.B.L. § 12; MCBC 2025-3, under [UNFILLED: law].`);
  assert.deepEqual(own.unfilled.map((u) => u.name), ["law"]);
  assert.ok(own.blanks.every((b) => b.source), "every filled blank has a source");
  /* both */
  const both = prep(x, A, { template: { id: T }, text: WORDS });
  assert.equal(both.reason, "TEMPLATE_AND_TEXT");
  assert.equal(x.count("filing_drafts"), 5, "nothing written on a refusal");
  /* through the op: a template named in the body, the words in the body */
  assert.equal((await x.op("filingprepare", { author: V("bo"), viewer: V("bo") }, { action: A, template: { id: T, version: 1 } })).template.version, 1);
  assert.equal((await x.op("filingprepare", { author: V("bo"), viewer: V("bo") }, { action: A, text: WORDS })).template, null);
});

test("R28 the template's refusals in order, filing-templates' passed through as its own: NO_SUCH_TEMPLATE (absent and invisible one answer), TEMPLATE_RETIRED, TEMPLATE_NOT_OFFERED, then TEMPLATE_USE_BRIEF, TEMPLATE_KIND_MISMATCH; the words' TEXT_UNWRITABLE and TEMPLATE_BLANK_UNKNOWN; negative controls", async () => {
  const x = world();
  const A = x.action();
  const T = approved(x, { name: "kept" });
  assert.equal(prep(x, A, { template: { id: T } }).ok, true, "negative control");
  const absent = prep(x, A, { template: { id: "TPL-none" } });
  const hidden = prep(x, A, { template: { id: T }, preparer: V("quinn"), viewer: V("quinn") });
  assert.equal(absent.reason, "NO_SUCH_TEMPLATE");
  assert.deepEqual([hidden.reason, hidden.detail], [absent.reason, absent.detail], "a project template quinn may not see answers as absent");
  /* a draft version is not offered */
  const d3 = x.f.filingTemplates.templateDraft({ template: T, text: "A draft {{act}}.", author: V("bo"), viewer: V("bo") });
  assert.equal(prep(x, A, { template: { id: T, version: 2 } }).reason, "TEMPLATE_NOT_OFFERED");
  assert.equal(d3.ok, true);
  const N = x.f.filingTemplates.templateDraft({ project: x.proj, kind: "bylaw_complaint", use: "file", profiles: [PROFILE],
    name: "never approved", text: "{{act}}", author: V("bo"), viewer: V("bo") });
  assert.equal(prep(x, A, { template: { id: N.template } }).reason, "TEMPLATE_NOT_OFFERED", "no version is approved");
  retire(x, T, "superseded by the borough's new form");
  const ret = prep(x, A, { template: { id: T } });
  assert.equal(ret.reason, "TEMPLATE_RETIRED");
  assert.match(ret.detail, /superseded by the borough's new form/);
  /* a brief template serves a packet, never a filing; a template of another kind is refused */
  const B = approved(x, { name: "a brief", use: "brief" });
  assert.equal(prep(x, A, { template: { id: B } }).reason, "TEMPLATE_USE_BRIEF");
  assert.equal(prep(x, A, { template: { id: BRIEF_TPL } }).reason, "TEMPLATE_USE_BRIEF", "asked before the kind");
  const R = x.action({ kind: "records_request", risk_tier: 2, law: "Test Stat. § 1.100" });
  const K = approved(x, { name: "another kind" });
  assert.equal(prep(x, R, { template: { id: K } }).reason, "TEMPLATE_KIND_MISMATCH");
  assert.equal(prep(x, R, { template: { id: "TPL-test-records-request" } }).ok, true, "negative control: its own kind");
  /* the member's words judged as a template's text (filing-templates R2) */
  for (const t of ["", "  ", "\uD800", "x".repeat(65537)]) assert.equal(prep(x, A, { text: t }).reason, "TEXT_UNWRITABLE", JSON.stringify(t.slice(0, 5)));
  assert.equal(prep(x, A, { text: "x".repeat(65536) }).ok, true, "65,536 bytes is allowed");
  const u = prep(x, A, { text: "To {{counterparty_role}}: {{nope}} and {{worse}}." });
  assert.deepEqual([u.reason, u.blank], ["TEMPLATE_BLANK_UNKNOWN", "nope"], "naming the first unknown blank");
});

test("R28 naming neither, with no profile file template for the kind: TEMPLATE_NOT_NAMED listing at most 20 offered file templates for the kind (never a brief, a draft or another kind's)", async () => {
  const x = world();
  const O = x.action({ kind: "other" });
  const none = prep(x, O);
  assert.deepEqual([none.reason, none.templates], ["TEMPLATE_NOT_NAMED", []]);
  assert.equal(none.detail, localize("filings.index.reason_name_a_template_or_write", "{reason}: name a template{listed} or write the words", {
    reason: localize("filings.index.the_profile_holds_no_file_template", "the profile holds no file template for this kind"), listed: "" }));
  const made = [];
  for (let i = 0; i < TEMPLATES_NAMED_MAX + 1; i++)
    made.push(approved(x, { kind: "other", profiles: "general", name: `other ${i}`, text: `Letter ${i}: {{act}}.`, reason: "a test kind" }));
  approved(x, { kind: "other", profiles: "general", use: "brief", name: "a brief", text: "Brief {{act}}.", reason: "a test kind" });
  x.f.filingTemplates.templateDraft({ project: x.proj, kind: "other", use: "file", profiles: "general", name: "a draft",
                                      text: "Draft {{act}}.", author: V("bo"), viewer: V("bo") });
  const r = prep(x, O);
  assert.equal(r.reason, "TEMPLATE_NOT_NAMED");
  assert.equal(r.templates.length, TEMPLATES_NAMED_MAX);
  assert.equal(r.truncated, true);
  assert.ok(r.templates.every((t) => made.includes(t.template) && t.version === 1), "only offered file templates of the kind");
  /* the one it names is then filled */
  assert.equal(prep(x, O, { template: { id: r.templates[0].template } }).ok, true);
});

test("R29 every draft records template {id, version, sha, origin}, or null for the member's words; a template naming profiles none of which gave the kind is used, the draft saying so first after any advisory, naming the jurisdiction; a general template says nothing of it", async () => {
  /* the action's kind comes from `test-filings-alt` (a copy of the test profile); a template written for the test profile
     names a profile that did not give it */
  const x0 = world();
  const alt = { ...x0.profile(PROFILE), id: "test-filings-alt", action_kinds: x0.profile(PROFILE).action_kinds.map((k) => ({ ...k,
    ...(k.template ? { template: { ...k.template, id: `${k.template.id}-alt` } } : {}) })) };
  const x = world({ profiles: [alt] });
  const R = x.action({ kind: "records_request", risk_tier: 2, law: "Test Stat. § 1.100" });
  const T = approved(x, { kind: "records_request", profiles: [PROFILE], name: "for another place",
                          text: "Under {{law}}, please send the records.", reason: "no professional to hand" });
  const d = prep(x, R, { template: { id: T } });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const rec = x.f.filingTemplates.templateRead({ template: T, viewer: V("bo") }).version;
  assert.deepEqual(d.template, { id: T, version: 1, sha: rec.sha, origin: "group" });
  assert.deepEqual(JSON.parse(x.row(`SELECT template FROM filing_drafts WHERE filing_id=?`, d.id).template), d.template, "stored as answered");
  const advisory = alt.action_kinds.find((k) => k.kind === "records_request").advisory;
  const [first, second, third] = d.text.split("\n\n");
  assert.equal(first, advisory, "the advisory first");
  assert.equal(second, word("filings.template_written_jurisdiction", { givers: "test-filings-alt", profiles: "test-port-ellery" }));
  assert.equal(third, "Under Test Stat. § 1.100, please send the records.");
  assert.equal(d.not_written_for, second);
  /* a general template, and one written for the kind's profile, say nothing of it */
  const G = approved(x, { kind: "records_request", profiles: "general", name: "general", text: "Under {{law}}.", reason: "a test" });
  const g = prep(x, R, { template: { id: G } });
  assert.deepEqual([g.ok, "not_written_for" in g, g.text.includes(word("filings.template_written_jurisdiction", { givers: "", profiles: "" }).slice(0, 33))], [true, false, false]);
  const own = prep(x, x.action({ kind: "records_request", risk_tier: 2, law: "Test Stat. § 1.100" }), { template: { id: "TPL-test-records-request-alt" } });
  assert.deepEqual([own.ok, own.template.origin, own.text.includes(word("filings.template_written_jurisdiction", { givers: "", profiles: "" }).slice(0, 33))], [true, "profile", false]);
  /* the member's words */
  const w = prep(x, R, { text: "Under {{law}}." });
  assert.equal(w.template, null);
  assert.equal(JSON.parse(x.row(`SELECT template FROM filing_drafts WHERE filing_id=?`, w.id).template), null);
});

test("R29 filingsFor shows each draft's template with the version's state, approver and reviews, and flags a draft whose version was later updated or whose template was retired, naming the reason; nothing in the draft changes and no approval is refused for it", async () => {
  const x = world();
  const A = x.action();
  const T = approved(x, { name: "flagged", text: "To the {{counterparty_role}}: {{act}}, under {{law}}." });
  const d = prep(x, A, { template: { id: T } });
  const shown = () => x.f.filingsFor({ action: A, viewer: V("bo") }).drafts.find((r) => r.filing === d.id).template;
  let t = shown();
  assert.deepEqual([t.id, t.version, t.origin, t.state, t.approved.by.id, t.reviews.member, t.reviews.no_concerns, "flags" in t],
                   [T, 1, "group", "approved", "olive", 1, 1, false]);
  const v2 = update(x, T, "Newer words {{act}}.");
  t = shown();
  assert.equal(t.state, "updated");
  assert.deepEqual(t.flags.map((f) => [f.flag, f.by]), [["updated", v2]]);
  assert.equal(t.flags[0].says, word("filings.says.prepared_version_updated", { version: 1, updated_by: 2 }));
  retire(x, T, "the venue changed its form");
  t = shown();
  assert.deepEqual(t.flags.map((f) => f.flag), ["updated", "retired"]);
  assert.equal(t.flags[1].says, word("filings.says.prepared_template_retired", { reason: "the venue changed its form" }));
  assert.equal(x.row(`SELECT text FROM filing_drafts WHERE filing_id=?`, d.id).text, d.text, "nothing in the draft changes");
  const ap = await x.f.filingApprove({ filing: d.id, text: d.text.replace("[UNFILLED: law]", LAW), author: V("bo"), viewer: V("bo") });
  assert.equal(ap.ok, true, "no approval is refused for it");
  /* the profile's template, and the member's words */
  const p = prep(x, A);
  const w = prep(x, A, { text: WORDS });
  const l = x.f.filingsFor({ action: A, viewer: V("bo") }).drafts;
  assert.deepEqual([l.find((r) => r.filing === p.id).template.state, l.find((r) => r.filing === w.id).template], ["approved", null]);
});

test("R31 counselPacket takes a brief template at every tier: its text filled from the record (each blank naming its source, [UNFILLED] where none) is the seventh section, briefing, after the six, carrying R10's marking; the packet records the template and is flagged as R29 flags a draft; without one there is no briefing", async () => {
  const x = world();
  const A = x.action();   /* Tier 1, no counsel named */
  const B = approved(x, { name: "brief to counsel", use: "brief", text: "For counsel: {{act}} ({{act_date}}) breaches {{standards}}, under {{law}}." });
  const p = x.f.counselPacket({ reason: WHY, action: A, template: { id: B }, author: V("olive"), viewer: V("olive") });
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
  assert.deepEqual(Object.keys(p.sections), ["facts", "chronology", "exhibits", "standards", "theories", "deadlines", "consequences", "briefing"]);
  const b = p.sections.briefing;
  assert.equal(b.marking, counselMarking(null), "the group's own marking, no counsel named");
  assert.equal(b.text, `For counsel: the adoption recorded as ${x.ACT_EVENT} (2026-03-02) breaches P.E.B.L. § 12; MCBC 2025-3, under [UNFILLED: law].`);
  assert.deepEqual(b.items.map((i) => [i.name, i.source]), [["act", x.ACT_EVENT], ["act_date", x.ACT_EVENT], ["standards", `${x.S1}, ${x.S2}`]]);
  assert.deepEqual(b.unfilled.map((u) => u.name), ["law"]);
  const rec = x.f.filingTemplates.templateRead({ template: B, viewer: V("olive") }).version;
  assert.deepEqual([p.template, b.template], [{ id: B, version: 1, sha: rec.sha, origin: "group" }, { id: B, version: 1, sha: rec.sha, origin: "group" }]);
  /* exported: the briefing's words under its heading and the marking */
  const e = await x.f.counselPacketExport({ id: p.id, author: V("olive"), viewer: V("olive") });
  const at = e.bytes.indexOf(`## ${localize("filings.index.briefing", "Briefing")}`);
  assert.ok(at > e.bytes.indexOf(`## ${word("filings.consequences_breach")}`), "after the six");
  assert.equal(e.bytes.slice(at).split("\n")[2], counselMarking(null));
  assert.ok(e.bytes.slice(at).includes(b.text));
  /* flagged as R29 flags a draft, nothing in the version changing */
  const v2 = update(x, B, "Newer brief: {{act}}.");
  const read = x.f.counselPacketRead({ id: p.id, viewer: V("olive") });
  assert.deepEqual(read.template.flags.map((f) => [f.flag, f.by]), [["updated", v2]]);
  assert.deepEqual(read.sections, p.sections);
  assert.deepEqual(x.f.filingsFor({ action: A, viewer: V("bo") }).packets[0].template.flags.map((f) => f.flag), ["updated"]);
  /* at Tier 3: counsel required; the profile's brief template; its refusals as R28's */
  const T3 = x.action({ kind: "commitment_claim" });
  assert.equal(x.f.counselPacket({ reason: WHY, action: T3, template: { id: BRIEF_TPL }, author: V("olive"), viewer: V("olive") }).reason, "NO_COUNSEL",
               "refused without counsel at Tier 3, before the template");
  const t3 = x.f.counselPacket({ reason: WHY, action: T3, counsel: COUNSEL, template: { id: BRIEF_TPL }, author: V("olive"), viewer: V("olive") });
  assert.deepEqual([t3.ok, t3.template.origin, t3.sections.briefing.marking], [true, "profile", counselMarking(COUNSEL)]);
  assert.match(t3.sections.briefing.text, /^For counsel: test-group asks whether the adoption recorded as EVT-/);
  const pk = (action, template) => x.f.counselPacket({ reason: WHY, action, counsel: COUNSEL, template, author: V("olive"), viewer: V("olive") });
  assert.equal(pk(A, { id: PROFILE_TPL }).reason, "TEMPLATE_USE_FILE", "a file template is no briefing");
  assert.equal(pk(A, { id: BRIEF_TPL }).reason, "TEMPLATE_KIND_MISMATCH", "the commitment claim's brief on a bylaw complaint");
  assert.equal(pk(A, { id: "TPL-none" }).reason, "NO_SUCH_TEMPLATE");
  retire(x, B, "withdrawn");
  assert.equal(pk(A, { id: B }).reason, "TEMPLATE_RETIRED");
  assert.equal(pk(x.action({ legs: [] }), { id: BRIEF_TPL }).reason, "TEMPLATE_KIND_MISMATCH", "the template is judged before the determination");
  /* without a template: no briefing */
  const none = pk(A, null);
  assert.deepEqual([none.ok, "briefing" in none.sections, none.template], [true, false, null]);
  /* through the op */
  assert.equal(x.op("counselpacket", { author: V("olive"), viewer: V("olive") }, { action: T3, counsel: COUNSEL, template: { id: BRIEF_TPL }, reason: WHY })
    .sections.briefing.template.id, BRIEF_TPL);
});

test("R32 templateSave hands an approved draft's text and from: {filing, sha} to filing-templates' templateDraft and answers its answer: a new template's draft, or a new version's; NO_SUCH_FILING (absent and invisible), TEMPLATE_FROM_UNAPPROVED, then filing-templates' refusals as its own; the draft is offered only once approved", async () => {
  const x = world();
  const A = x.action();
  const d = prep(x, A, { text: WORDS });
  const save = (o = {}) => x.f.templateSave({ filing: d.id, name: "from the notice", author: V("bo"), viewer: V("bo"), ...o });
  const absent = save({ filing: "FIL-NONE" });
  const hidden = save({ viewer: STRANGER });
  assert.equal(absent.reason, "NO_SUCH_FILING");
  assert.deepEqual([hidden.reason, hidden.detail], [absent.reason, absent.detail]);
  assert.equal(save().reason, "TEMPLATE_FROM_UNAPPROVED", "the draft is not approved");
  const text = d.text.replace("[UNFILLED: law]", LAW);
  const ap = await x.f.filingApprove({ filing: d.id, text, author: V("bo"), viewer: V("bo") });
  assert.equal(ap.ok, true);
  assert.equal(save({ author: MACHINE }).reason, "MACHINE_CANNOT_DRAFT_TEMPLATE", "filing-templates' refusal, passed through");
  assert.equal(save({ name: "a\nb" }).reason, "TEMPLATE_NAME_REFUSED");
  const s = save();
  assert.deepEqual([s.ok, s.state, s.derived_from], [true, "draft", { filing: d.id, sha: ap.sha }], JSON.stringify(s).slice(0, 300));
  const read = x.f.filingTemplates.templateRead({ template: s.template, viewer: V("bo") });
  assert.deepEqual([read.version.text, read.version.derived_from, read.template.kind, read.template.use, read.template.profiles,
                    read.template.scope], [text, { filing: d.id, sha: ap.sha }, "bylaw_complaint", "file", [PROFILE], { project: x.proj }],
                   "the approved text, its defaults: the action's kind, file, the kind's profile, the project the draft drew on");
  assert.equal(prep(x, A, { template: { id: s.template } }).reason, "TEMPLATE_NOT_OFFERED", "a draft is not offered");
  pass(x, s.version);
  assert.equal(prep(x, A, { template: { id: s.template } }).ok, true, "offered once reviewed and approved");
  /* a new version of the named template, from another approved draft, through the op */
  const d2 = prep(x, A, { text: "To the {{counterparty_role}}: a second word." });
  await x.f.filingApprove({ filing: d2.id, author: V("bo"), viewer: V("bo") });
  const v = await x.op("templatesave", { author: V("bo"), viewer: V("bo") }, { filing: d2.id, template: s.template });
  assert.deepEqual([v.ok, v.version, v.state], [true, `${s.template}@2`, "draft"], JSON.stringify(v).slice(0, 300));
  assert.equal(x.f.filingTemplates.templateRead({ template: s.template, version: 2, viewer: V("bo") }).version.text,
               "To the Selectboard: a second word.");
});

test("R32 the group's templates are filing-templates': filings answers no op=templates and keeps no library", async () => {
  const x = world();
  const url = new URL("http://do/templates");
  assert.equal("templates" in filingsOps(x.f, url, null), false);
  assert.equal(typeof x.f.templatesFor, "undefined");
  assert.ok("templatesave" in filingsOps(x.f, url, null));
});
