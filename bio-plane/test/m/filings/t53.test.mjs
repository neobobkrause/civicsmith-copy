/* filings — T53: R29 (a profile template's recorded SHA-256 is the reviewed text's, and a draft made from an earlier
   text is flagged), R71 (a filing records the layer of every rule it rests on), and the provider notice
   `jurisdictions:40` (R119 there: the federal layer's FOIA offices are counterparties of the view). Driven at the
   module's interface over the real modules; every view is the real `jurisdictions.combine`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, PROFILE, WHY, sha, attributed } from "./fixture.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const prep = (x, action, over = {}) => x.f.filingPrepare({ action, preparer: V("bo"), viewer: V("bo"), ...over });
const approve = (x, id, text) => x.f.filingApprove({ filing: id, ...(text ? { text } : {}), author: V("bo"), viewer: V("bo") });

/* ---------------------------------------------------------------- R29 (T53): the profile text's SHA-256 */

const TEXT_1 = "To the {{counterparty_role}}: {{act}} does not conform to {{standards}}.";
const TEXT_2 = "To the {{counterparty_role}}: {{act}}, adopted on {{act_date}}, does not conform to {{standards}}.";
/* a professional's counted review of exactly `text` (jurisdictions R126, R137) */
const review = (text, at) => ({ reviewer: "Dee Example", kind: "professional", organisation: "Marlow Commons Legal Society (test)",
                                credential: "solicitor (test)", scope: "the whole text", outcome: "no_concerns", at, reviewed_text_sha: sha(text) });
/* a copy of the test profile whose bylaw-complaint template is its own object, reviewed as written */
function shaProfile(x0) {
  const p = x0.profile(PROFILE);
  const tpl = attributed("TPL-test-sha-bylaw", "file", TEXT_1, { reviews: [review(TEXT_1, "2026-08-25")] });
  return { profile: { ...p, id: "test-filings-sha",
                      action_kinds: p.action_kinds.map((k) => (k.kind === "bylaw_complaint" ? { ...k, template: tpl } : k)) }, tpl };
}

test("R29 a draft made from a profile template records template.sha equal to the template's reviewed_text_sha; after the profile text changes and is re-reviewed, the old draft still records the old sha and filingsFor flags it as made from an earlier text (the updated-version flag, no new word); nothing in the draft changes and approval is not refused", async () => {
  const { profile, tpl } = shaProfile(world());
  const x = world({ profiles: [profile] });
  const A = x.action();
  const d = prep(x, A);
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  assert.deepEqual([d.template.id, d.template.origin, d.template.version], ["TPL-test-sha-bylaw", "profile", 1]);
  assert.equal(d.template.sha, tpl.reviews[0].reviewed_text_sha, "the reviewed text's SHA-256");
  const shown = () => x.f.filingsFor({ action: A, viewer: V("bo") }).drafts.find((r) => r.filing === d.id).template;
  assert.equal("flags" in shown(), false, "made from the present text: no flag");
  /* the profile text changes and is re-reviewed */
  tpl.text = TEXT_2;
  tpl.reviews.push(review(TEXT_2, "2026-10-01"));
  const t = shown();
  assert.equal(t.sha, sha(TEXT_1), "the old draft still records the old sha");
  assert.deepEqual(t.flags.map((f) => f.flag), ["updated"]);
  assert.equal(t.flags[0].sha, sha(TEXT_2));
  assert.equal(t.flags[0].says, word("filings.says.prepared_version_updated", { version: 1, updated_by: 1 }));
  assert.deepEqual(JSON.parse(x.row(`SELECT template FROM filing_drafts WHERE filing_id=?`, d.id).template), d.template, "the draft is unchanged");
  /* a draft made from the new text records its sha and is not flagged */
  const d2 = prep(x, A);
  assert.equal(d2.template.sha, sha(TEXT_2));
  assert.equal("flags" in x.f.filingsFor({ action: A, viewer: V("bo") }).drafts.find((r) => r.filing === d2.id).template, false);
  const ap = await approve(x, d.id);
  assert.equal(ap.ok, true, `no approval is refused for it: ${JSON.stringify(ap).slice(0, 300)}`);
});

test("R29 control: a draft from a team's own template, and one from the member's own words (template null), are unchanged by a profile text's change", async () => {
  const { profile, tpl } = shaProfile(world());
  const x = world({ profiles: [profile] });
  const A = x.action();
  const t = x.f.filingTemplates;
  const dr = t.templateDraft({ project: x.proj, kind: "bylaw_complaint", use: "file", profiles: [PROFILE], name: "the team's own",
                               text: "To the {{counterparty_role}}: {{act}}.", author: V("bo"), viewer: V("bo") });
  assert.equal(t.templateSubmit({ version: dr.version, reviewers: ["member:cy"], author: V("bo"), viewer: V("bo") }).ok, true);
  assert.equal(t.templateReview({ version: dr.version, outcome: "no_concerns", scope: "the whole text", author: V("cy"), viewer: V("cy") }).ok, true);
  assert.equal(t.templateApprove({ version: dr.version, reason: "a test", by: V("olive"), viewer: V("olive") }).ok, true);
  const team = prep(x, A, { template: { id: dr.template } });
  const own = prep(x, A, { text: "To the {{counterparty_role}}." });
  assert.deepEqual([team.ok, own.ok], [true, true]);
  const before = x.f.filingsFor({ action: A, viewer: V("bo") }).drafts;
  tpl.text = TEXT_2;
  tpl.reviews.push(review(TEXT_2, "2026-10-01"));
  const after = x.f.filingsFor({ action: A, viewer: V("bo") }).drafts;
  const of = (l, id) => l.find((r) => r.filing === id).template;
  assert.deepEqual(of(after, team.id), of(before, team.id));
  assert.equal("flags" in of(after, team.id), false);
  assert.equal(of(after, team.id).origin, "group");
  assert.equal("layer" in of(after, team.id), false, "a team's template records no layer");
  assert.equal(of(after, own.id), null);
});

/* ---------------------------------------------------------------- R71 (T53): the layer of every rule */

const OAKLAND = "oakland-alameda";
/* a second city layer within the county the Oakland layer sits in */
const CITY_B = Object.freeze({ id: "test-filings-city-b", name: "B city (test)", covers: ["B city"], test: true,
  layer: { level: "city", place: "Bville", within: "us-ca-alameda-county", origin: "civicsmith" },
  counterparties: [{ role: "Clerk", body: "Bville", level: "city", elected: false, basis: "TEST" }] });

test("R71 a draft prepared under the Oakland layer's rule records the layer as the id in its sources; it keeps its layer and its source strings after a second city layer arrives, and R6 reports no change", async () => {
  const profiles = [OAKLAND];
  const x = world({ profiles });
  x.record.setSetting("jurisdiction_profiles", [OAKLAND], V("olive"));
  const entry = combine([OAKLAND]).view.action_kinds.find((k) => k.kind === "records_request");
  const venueLayer = entry.venue.layer;
  assert.ok(venueLayer && venueLayer !== OAKLAND, "the package's view names the layer that holds the venue");
  const A = x.action({ kind: "records_request", risk_tier: 1, law: "Cal. Gov. Code § 7922.530" });
  const d = prep(x, A, { text: "Filed at {{venue}} by {{venue_how}}." });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const src = `profile:${venueLayer}/action_kinds/records_request/venue`;
  assert.deepEqual(d.blanks.filter((b) => b.name === "venue" || b.name === "venue_how").map((b) => b.source), [src, src]);
  assert.deepEqual([d.venue.layer, d.venue.source], [venueLayer, src]);
  const stored = x.row(`SELECT blanks, venue, basis FROM filing_drafts WHERE filing_id=?`, d.id);
  assert.ok(stored.blanks.includes(src));
  /* the second city layer arrives */
  profiles.push(CITY_B);
  x.record.setSetting("jurisdiction_profiles", [OAKLAND, CITY_B.id], V("olive"));
  assert.deepEqual(x.row(`SELECT blanks, venue, basis FROM filing_drafts WHERE filing_id=?`, d.id), stored, "neither re-read nor rewritten");
  const read = x.f.filingRead({ filing: d.id, viewer: V("bo") });
  assert.deepEqual(read.blanks, d.blanks);
  const ap = await approve(x, d.id);
  assert.equal(ap.ok, true, `R6 reports no change: ${JSON.stringify(ap).slice(0, 400)}`);
});

test("R71 the chance-to-fix time and a packet's deadlines name the layer of each rule; a legal fact's notice carries its layer", async () => {
  const x = world({ profiles: [OAKLAND] });
  x.record.setSetting("jurisdiction_profiles", [OAKLAND], V("olive"));
  const view = combine([OAKLAND]).view;
  const A = x.action({ kind: "records_request", risk_tier: 1, law: "Cal. Gov. Code § 7922.530" });
  const n = x.f.communicationPrepare({ action: A, purpose: "chance_to_fix", language: "en", preparer: V("bo"), viewer: V("bo") });
  assert.equal(n.ok, true, JSON.stringify(n).slice(0, 300));
  const rule = view.deadlines.find((r) => r.applies_to === "records_request" && !r.defends);
  const time = n.parts.find((p) => p.part === "a time");
  assert.deepEqual([time.layer, time.source], [rule.layer, `profile:${rule.layer}/deadlines/${rule.rule}`]);
  const p = x.f.counselPacket({ reason: WHY, action: A, author: V("olive"), viewer: V("olive") });
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
  const dls = p.sections.deadlines.items;
  assert.ok(dls.length > 0);
  for (const it of dls) {
    const r = view.deadlines.find((y) => y.rule === it.rule);
    assert.deepEqual([it.layer, it.source], [r.layer, `profile:${r.layer}/deadlines/${r.rule}`], it.rule);
  }
  /* a legal fact for the kind: shown with its layer (a plain profile is its own layer) */
  const y = world();
  const facts = combine([PROFILE]).view.legal_facts.filter((l) => Array.isArray(l.applies_to) && l.applies_to.includes("bylaw_complaint"));
  assert.ok(facts.length > 0);
  const e = prep(y, y.action(), { text: "To the {{counterparty_role}}." });
  assert.equal(e.ok, true, JSON.stringify(e).slice(0, 300));
  assert.deepEqual(e.notices.filter((m) => m.kind === "legal_fact").map((m) => [m.key, m.layer, m.source]),
                   facts.map((f) => [f.key, PROFILE, `profile:${PROFILE}/legal_facts/${f.key}`]));
});

test("R71 control: a draft under a plain profile reads and approves as it did, its source strings naming the profile as before", async () => {
  const x = world();
  const A = x.action();
  const d = prep(x, A, { text: "To the {{counterparty_role}} at {{venue}}." });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const v = d.blanks.find((b) => b.name === "venue");
  if (v) assert.equal(v.source, `profile:${PROFILE}/action_kinds/bylaw_complaint/venue`);
  assert.equal(x.f.filingRead({ filing: d.id, viewer: V("bo") }).text, d.text);
  const ap = await approve(x, d.id);
  assert.equal(ap.ok, true, JSON.stringify(ap).slice(0, 300));
});

/* ---------------------------------------------------------------- notice jurisdictions:40 (R119 there) */

test("notice jurisdictions:40 a determination whose actor is a federal FOIA office of the view's counterparties: R15/R21's block finds the office in the active profile, at level federal and not elected, with the in-profile words; the kinds are the view's, unfiltered by the office", async () => {
  const x = world({ profiles: [OAKLAND] });
  x.record.setSetting("jurisdiction_profiles", [OAKLAND], V("olive"));
  const view = combine([OAKLAND]).view;
  const office = view.counterparties.find((c) => c.level === "federal");
  assert.ok(office, "the federal layer holds the offices");
  const compliant = [{ standard: x.S1, outcome: "compliant" }, { standard: x.S2, outcome: "compliant" }];
  const D = x.determine({ standards: compliant, act: { ...x.act, actor: { role: office.role, body: office.body } } });
  const r = x.f.availableActions({ determination: D, viewer: V("olive") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.determinations[0].office, { role: office.role, body: office.body, in_profile: true, level: "federal", elected: false,
                                                 says: word("filings.says.office_active_profile") });
  assert.deepEqual(r.kinds.map((k) => k.kind), view.action_kinds.map((k) => k.kind));
  /* control: an office the list does not name is not in the profile */
  const E = x.determine({ standards: compliant, act: { ...x.act, actor: { role: "No Such FOIA Office", body: office.body } } });
  const o = x.f.availableActions({ determination: E, viewer: V("olive") }).determinations[0].office;
  assert.deepEqual([o.in_profile, "level" in o, o.says], [false, false, word("filings.says.office_active_profile_lists")]);
});
