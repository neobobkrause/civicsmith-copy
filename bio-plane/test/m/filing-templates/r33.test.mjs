/* filing-templates, T48 (T48-50; R33; N880, Actions D13, H17, v0.2 rule 8; K231, K922 (1), K2953; amends R10, R15, R23;
   `filings` R57): the quoting sentence `RFC_QUOTING_SENTENCE` and its one check `rfcQuotingRefusal`, C-115.47
   RFC_QUOTING_MISSING moved here from `filings` unchanged; `templateApprove` and the profile's templates are refused
   through it. At the interface: the export's answer and its control, the row, the approval's refusal (and its order),
   and the profile read, each beside the control the requirement names. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seeded, V, TEST, TEXT, PRO_REVIEW, proReview, reviewedOf } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const WORDS = JSON.parse(await readFile(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words;
const A = V("alice"), B = V("bob"), F = V("frank");
const SENTENCE = word("filing-templates.rfc_quoting_sentence");
const ROW = ft.FILING_TEMPLATE_CHECKS.RFC_QUOTING_MISSING;
/* the row's word, pinned here: words.json holds it by key (DEC-260), its text unchanged since DEC-234 (K3357) */
const RFC_TRANSLATION = word("refusal.RFC_QUOTING_MISSING");
const RFC = "request_for_comment";
const BODY = "To the {{counterparty_role}}: {{group}} asks for your comment on {{act}}.";

/* the test profile with a request-for-comment kind at Tier 1 (a file template and a brief one, with and without the
   sentence), handed in as `jurisdictions`; every profile template attributed whole (R15) so only R33 withholds */
const profileTemplate = (id, use, text) => ({ id, version: 1, use, text, notes: "A made-up template for tests.", authored_by: "Ada Example",
  contributors: [], reviews: [], approved_by: "Cy Example", approved_at: "2026-09-01", basis: "TEST", purpose: "initial", name: id, sources: [] });
/* attributed whole (R15): reviewedOf attributes before its edit runs, so the edit does it for what it adds */
const whole = (t) => ({ ...t, sources: [{ citation: "P.E.B.L. § 1" }], reviews: [proReview(t.text)] });
const withRfc = () => reviewedOf(jurisdictions, (p) => {
  if (p.id !== TEST || p.action_kinds.some((k) => k.kind === RFC)) return;
  p.action_kinds.push({ kind: RFC, label: word("screen.start-send.kind.request_for_comment"), tier: 1, shape: "recognition", basis: "TEST",
    venue: { name: "the Harbour District office", how: "mail", basis: "TEST" },
    templates: [profileTemplate("TPL-test-rfc-with", "file", `${BODY} ${SENTENCE}`), profileTemplate("TPL-test-rfc-without", "file", BODY),
                profileTemplate("TPL-test-rfc-brief", "brief", BODY)].map(whole) });
});
const world = () => seeded({ jur: withRfc() });
const refused = (r, c) => {
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, c, c, ft.FILING_TEMPLATE_CHECKS[c].check, ft.FILING_TEMPLATE_CHECKS[c].translation],
                   JSON.stringify(r).slice(0, 300));
  return r;
};
/* a version of `kind`/`use` carrying `text`, in review, with frank's member review of no concerns (Tier 1 asks no more) */
const inReview = (w, { kind = RFC, use = "file", text = BODY, name = `${kind} ${use}`, reviewed = true } = {}) => {
  const d = w.ft.templateDraft({ project: w.P, kind, use, profiles: [TEST], name, text, author: A, viewer: A });
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(w.ft.templateSubmit({ version: d.version, reviewers: ["frank"], author: A, viewer: A }).ok, true);
  if (reviewed) assert.equal(w.ft.templateReview({ version: d.version, outcome: "no_concerns", scope: "all", author: F, viewer: F }).ok, true);
  return d;
};
const approve = (w, version, x = {}) => w.ft.templateApprove({ version, by: B, viewer: B, ...x });

test("R33 RFC_QUOTING_SENTENCE is the sentence filings held, unchanged (K2953), read by key from words.json's filing-templates.rfc_quoting_sentence (DEC-260)", () => {
  assert.equal(ft.RFC_QUOTING_SENTENCE, SENTENCE);
  const held = (key) => WORDS.find((x) => x.key === key)?.en;
  assert.equal(held("filing-templates.rfc_quoting_sentence"), SENTENCE, "the word the module reads");
  assert.equal(held("refusal.RFC_QUOTING_MISSING"), RFC_TRANSLATION, "the word the row reads");
  assert.equal(WORDS.some((x) => x.key === "rfc.quoting"), false, "no rfc.quoting: the sentence is not filings' keyed row (DEC-234, K3357)");
});

test("R33 rfcQuotingRefusal answers C-115.47 RFC_QUOTING_MISSING with its row, extra fields merged, when the text lacks the sentence; control: a text holding it answers null", () => {
  const r = ft.rfcQuotingRefusal(`${BODY} Thanks.`, { filing: "FIL-1", version: "TPL-x@1" });
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "RFC_QUOTING_MISSING", "RFC_QUOTING_MISSING", "C-115.47", ROW.translation]);
  assert.deepEqual([r.filing, r.version, r.sentence, r.key], ["FIL-1", "TPL-x@1", SENTENCE, "filing-templates.rfc_quoting_sentence"],
                   "extra merged; the sentence named by its current key (R33; rfc.quoting was withdrawn, DEC-234)");
  assert.equal(ft.rfcQuotingRefusal(BODY).reason, "RFC_QUOTING_MISSING", "extra may be absent");
  assert.equal(ft.rfcQuotingRefusal(BODY, { sentence: "other" }).sentence, SENTENCE, "the sentence named is the refusal's own");
  for (const text of ["", null, undefined, 7, "your reply may be quoted unless it says otherwise.", "Your reply may be quoted, unless you say otherwise in it."])
    assert.equal(ft.rfcQuotingRefusal(text).reason, "RFC_QUOTING_MISSING", JSON.stringify(text));
  /* controls: the sentence anywhere in the text */
  for (const text of [SENTENCE, `${BODY}\n\n${SENTENCE}`, `${SENTENCE} ${BODY}`, `${BODY} ${SENTENCE} Thanks.`])
    assert.equal(ft.rfcQuotingRefusal(text, { filing: "FIL-1" }), null, text);
});

test("R33 the row moves here unchanged: C-115.47, filings' translation read by key from refusal.RFC_QUOTING_MISSING, its where this one function", () => {
  assert.deepEqual(Object.keys(ROW).sort(), ["check", "translation", "where"]);
  assert.deepEqual([ROW.check, ROW.where], ["C-115.47", "src/filing-templates/index.mjs rfcQuotingRefusal > is-rfc-quoting-missing"]);
  assert.equal(ft.FILING_TEMPLATES_WORDS["refusal.RFC_QUOTING_MISSING"], RFC_TRANSLATION, "read by key, text unchanged");
  assert.equal(ROW.translation, RFC_TRANSLATION);
});

test("R33 templateApprove refuses a file version of the request-for-comment kind that lacks the sentence, after REVIEWS_INSUFFICIENT, and writes nothing; control: the same version with the sentence is approved", () => {
  const w = world();
  /* order: with no review the reviews refuse first, though the sentence is missing too */
  const bare = inReview(w, { reviewed: false, name: "unreviewed" });
  refused(approve(w, bare.version), "REVIEWS_INSUFFICIENT");
  const stands = inReview(w, { reviewed: false, name: "changes" });
  w.ft.templateReview({ version: stands.version, outcome: "changes_requested", scope: "all", author: F, viewer: F });
  refused(approve(w, stands.version), "REVIEWS_INSUFFICIENT");
  /* reviewed, no sentence: refused through the one check, naming the version; nothing is written */
  const d = inReview(w, { name: "lacking" });
  const before = w.snapshot();
  const r = refused(approve(w, d.version), "RFC_QUOTING_MISSING");
  assert.deepEqual([r.version, r.sentence, r.key], [d.version, SENTENCE, "filing-templates.rfc_quoting_sentence"]);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  assert.equal(w.ft.templateRead({ template: d.template, version: d.version, viewer: A }).version.state, "in_review");
  refused(w.ft.offeredVersion({ template: d.template, viewer: A }), "TEMPLATE_NOT_OFFERED");
  /* the answer is the export's, for the version's text */
  assert.deepEqual(r, ft.rfcQuotingRefusal(BODY, { version: d.version }));
  /* control: the same wording with the sentence is approved */
  const ok = inReview(w, { name: "holding", text: `${BODY}\n\n${SENTENCE}` });
  const a = approve(w, ok.version);
  assert.deepEqual([a.ok, a.state], [true, "approved"], JSON.stringify(a));
  assert.equal(w.ft.offeredVersion({ template: ok.template, viewer: A }).ok, true);
  /* the lacking template is mended by a new version, which is then approved (a version's text never changes) */
  assert.equal(w.ft.templateRetire({ template: d.template, version: d.version, reason: "mended in the next version", by: A, viewer: A }).ok, true);
  const next = w.ft.templateDraft({ template: d.template, text: `${BODY} ${SENTENCE}`, author: A, viewer: A });
  w.ft.templateSubmit({ version: next.version, reviewers: ["frank"], author: A, viewer: A });
  w.ft.templateReview({ version: next.version, outcome: "no_concerns", scope: "all", author: F, viewer: F });
  assert.equal(approve(w, next.version).ok, true);
});

test("R33 controls: a brief template of the kind, and a template of another kind, is never asked for the sentence", () => {
  const w = world();
  const brief = inReview(w, { use: "brief", name: "brief ask" });
  assert.equal(approve(w, brief.version).ok, true, "a brief template of the kind lacking the sentence is approved");
  /* another kind (a Tier 2 kind: a professional's review, or the approver's reason for going without) */
  const other = inReview(w, { kind: "records_request", text: TEXT, name: "records ask", reviewed: false });
  const o = approve(w, other.version, { reason: "no professional is at hand" });
  assert.deepEqual([o.ok, o.state], [true, "approved"], JSON.stringify(o));
});

test("R33 a profile template of the kind and use lacking the sentence is not offered and reads RFC_QUOTING_MISSING, in R15's form; controls: with it, a brief one, and a template of another kind are offered", () => {
  const w = world();
  const without = refused(w.ft.offeredVersion({ template: "TPL-test-rfc-without", viewer: A }), "RFC_QUOTING_MISSING");
  assert.deepEqual([without.template, without.sentence, without.key], ["TPL-test-rfc-without", SENTENCE, "filing-templates.rfc_quoting_sentence"]);
  const read = w.ft.templateRead({ template: "TPL-test-rfc-without", viewer: A });
  assert.deepEqual([read.ok, read.offered, read.not_offered.reason, read.not_offered.check, read.version.state],
                   [true, false, "RFC_QUOTING_MISSING", "C-115.47", "approved"]);
  const listed = w.ft.templatesFor({ viewer: A }).templates.map((t) => t.id);
  assert.ok(!listed.includes("TPL-test-rfc-without"), "not listed");
  const before = w.snapshot();
  w.ft.offeredVersion({ template: "TPL-test-rfc-without", viewer: A });
  assert.deepEqual(w.snapshot(), before, "the reads write nothing");
  /* by its name's handle, as R26 resolves it, the same refusal */
  refused(w.ft.offeredVersion({ name: "@tpl-test-rfc-without", viewer: A }), "RFC_QUOTING_MISSING");
  /* controls */
  for (const id of ["TPL-test-rfc-with", "TPL-test-rfc-brief", "TPL-test-recognition"]) {
    const o = w.ft.offeredVersion({ template: id, viewer: A });
    assert.deepEqual([o.ok, o.template, o.origin], [true, id, "profile"], id);
    assert.ok(listed.includes(id), `${id} listed`);
    assert.equal(w.ft.templateRead({ template: id, viewer: A }).offered, true, id);
  }
});

test("R33 R15's other reasons come first: a profile template of the kind lacking both a part of its attribution and the sentence reads TEMPLATE_NOT_REVIEWED", () => {
  const w = seeded({ jur: { ...jurisdictions, get: (id) => {
    const p = jurisdictions.get(id);
    if (p && p.id === TEST && !p.action_kinds.some((k) => k.kind === RFC))
      p.action_kinds.push({ kind: RFC, label: word("screen.start-send.kind.request_for_comment"), tier: 1, shape: "recognition", basis: "TEST",
        venue: { name: "the Harbour District office", how: "mail", basis: "TEST" }, templates: [profileTemplate("TPL-test-rfc-bare", "file", BODY)] });
    return p;
  } } });
  const o = refused(w.ft.offeredVersion({ template: "TPL-test-rfc-bare", viewer: A }), "TEMPLATE_NOT_REVIEWED");
  assert.deepEqual(o.lacks, ["sources", "professional_review"]);
});

test("R33, R38 a profile template of the kind holding the sentence, whose only professional review names no reviewed_text_sha, is not offered: R126 does not count that review, so it reads TEMPLATE_NOT_REVIEWED lacking professional_review; control: the same review of the text now is offered", () => {
  const withReview = (review) => seeded({ jur: { ...jurisdictions, get: (id) => {
    const p = jurisdictions.get(id);
    if (p && p.id === TEST && !p.action_kinds.some((k) => k.kind === RFC)) {
      const t = profileTemplate("TPL-test-rfc-unhashed", "file", `${BODY} ${SENTENCE}`);
      p.action_kinds.push({ kind: RFC, label: word("screen.start-send.kind.request_for_comment"), tier: 1, shape: "recognition", basis: "TEST",
        venue: { name: "the Harbour District office", how: "mail", basis: "TEST" },
        templates: [{ ...t, sources: [{ citation: "P.E.B.L. § 1" }], reviews: [review(t.text)] }] });
    }
    return p;
  } } });
  assert.equal("reviewed_text_sha" in PRO_REVIEW, false, "the review names no hash of the text it read");
  const w = withReview(() => PRO_REVIEW);
  const o = refused(w.ft.offeredVersion({ template: "TPL-test-rfc-unhashed", viewer: A }), "TEMPLATE_NOT_REVIEWED");
  assert.deepEqual(o.lacks, ["professional_review"]);
  assert.equal(w.ft.templateRead({ template: "TPL-test-rfc-unhashed", viewer: A }).offered, false);
  /* control: the same review carrying the hash of the text now is counted, and the sentence is held, so it is offered */
  const ok = withReview((text) => proReview(text)).ft.offeredVersion({ template: "TPL-test-rfc-unhashed", viewer: A });
  assert.deepEqual([ok.ok, ok.origin], [true, "profile"], JSON.stringify(ok).slice(0, 300));
});
