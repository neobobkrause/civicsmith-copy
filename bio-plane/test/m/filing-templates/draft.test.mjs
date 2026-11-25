/* filing-templates: the template and its versions, drafting, the blanks and the vocabularies (R1, R2, R3, R19, R21),
   at the module's interface, under the test profile. */
import { test } from "node:test";
import { word } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { seeded, draft, approved, V, MACHINE, TEST, HARBOUR, TEXT, sha, twoProfiles } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";

const A = V("alice");
const make = (w, x = {}) => w.ft.templateDraft({ project: w.P, kind: "records_request", use: "file", profiles: [TEST],
                                                 name: "Ask", text: TEXT, author: A, viewer: A, ...x });
const code = (r) => [r.ok, r.reason, r.code, r.check, r.translation];
const row = (c) => ft.FILING_TEMPLATE_CHECKS[c];
const refused = (r, c) => { assert.deepEqual(code(r), [false, c, c, row(c).check, row(c).translation], JSON.stringify(r).slice(0, 300)); return r; };

test("R1 a template is {id, kind, use, profiles, name, scope, origin, versions}: an opaque TPL- id (never a counter), scope its project, origin group", () => {
  const w = seeded();
  const ids = [make(w, { name: "a" }), make(w, { name: "b" }), make(w, { name: "c" })].map((r) => r.template);
  for (const id of ids) assert.match(id, /^TPL-2026-\d{4}$/);
  assert.equal(new Set(ids).size, 3);
  assert.ok(!ids.every((id, i) => i === 0 || Number(id.slice(-4)) === Number(ids[i - 1].slice(-4)) + 1) || ids.length < 2,
            "not a counter's run (a run of three consecutive draws is vanishingly unlikely)");
  const r = w.ft.templateRead({ template: ids[0], viewer: A });
  assert.deepEqual(Object.keys(r.template).sort(), ["id", "kind", "name", "origin", "profiles", "scope", "use"]);
  assert.deepEqual({ ...r.template }, { id: ids[0], kind: "records_request", use: "file", profiles: [TEST], name: "a",
                                        scope: { project: w.P }, origin: "group" });
  /* versions: the template's version list, as R14 reads it */
  assert.equal(w.ft.templatesFor({ state: "draft", viewer: A }).templates.find((t) => t.id === ids[0]).versions.length, 1);
});

test("R1 the template's own refusals, in order, each with a negative control: kind, kind of every named profile, use, profiles held, Tier 3 file, name, name taken", () => {
  const w = seeded({ jur: twoProfiles });
  for (const kind of ["Records", "1x", "", null, "a-b"]) refused(make(w, { kind }), "TEMPLATE_KIND_REFUSED");
  const ku = refused(make(w, { kind: "parking_appeal" }), "TEMPLATE_KIND_UNKNOWN");
  assert.equal(ku.profile, TEST, "naming the profile");
  /* a kind present in one named profile and absent from the other is refused, naming the other */
  const p2 = twoProfiles.get(HARBOUR);
  assert.ok(p2.action_kinds.some((k) => k.kind === "bylaw_complaint"));
  for (const use of ["filing", "", null, "FILE"]) refused(make(w, { use }), "TEMPLATE_USE_REFUSED");
  refused(make(w, { profiles: ["nowhere"] }), "TEMPLATE_PROFILE_UNKNOWN");
  refused(make(w, { profiles: [] }), "TEMPLATE_PROFILE_UNKNOWN");
  assert.equal(make(w, { profiles: [TEST, "nowhere"] }).reason, "TEMPLATE_PROFILE_UNKNOWN");
  /* Tier 3 (commitment_claim in the test profile): file refused; brief accepted (negative control) */
  refused(make(w, { kind: "commitment_claim", name: "c3" }), "TEMPLATE_TIER3_FILE");
  assert.equal(make(w, { kind: "commitment_claim", use: "brief", name: "c3" }).ok, true);
  /* general: the active view's tier decides */
  refused(make(w, { kind: "commitment_claim", profiles: "general", name: "g3" }), "TEMPLATE_TIER3_FILE");
  for (const name of ["", "  ", "a\nb", "x".repeat(201), null]) refused(make(w, { name }), "TEMPLATE_NAME_REFUSED");
  assert.equal(make(w, { name: "x".repeat(200) }).ok, true, "200 characters is one line");
  assert.equal(make(w, { name: "Taken" }).ok, true);
  refused(make(w, { name: "Taken" }), "TEMPLATE_NAME_TAKEN");
  refused(make(w, { name: " Taken " }), "TEMPLATE_NAME_TAKEN");
  /* another project's scope is another library: not taken there (negative control) */
  w.join(w.Q, "alice");
  assert.equal(make(w, { project: w.Q, name: "Taken" }).ok, true);
  /* order: a bad kind is answered before a bad use, a bad use before a bad name */
  assert.equal(make(w, { kind: "X", use: "nope", name: "" }).reason, "TEMPLATE_KIND_REFUSED");
  assert.equal(make(w, { use: "nope", name: "" }).reason, "TEMPLATE_USE_REFUSED");
});

test("R1 a name held by a retired template is free again in its scope; a general template is offered under every profile and its tier is the active view's", () => {
  const w = seeded({ profiles: [TEST, HARBOUR], jur: twoProfiles });
  const t = make(w, { name: "Again" });
  assert.equal(w.ft.templateRetire({ template: t.template, reason: "superseded by practice", by: A, viewer: A }).ok, true);
  assert.equal(make(w, { name: "Again" }).ok, true);
  /* records_request is Tier 2 in the test profile and Tier 1 in the harbour profile: the strictest, 2, needs a
     professional review (R10), which `REVIEWS_INSUFFICIENT` names as `needs` */
  const g = make(w, { name: "Gen", profiles: "general" });
  w.ft.templateSubmit({ version: g.version, reviewers: ["bob"], author: A, viewer: A });
  w.ft.templateReview({ version: g.version, outcome: "no_concerns", scope: "all", author: V("bob"), viewer: V("bob") });
  const r = w.ft.templateApprove({ version: g.version, by: V("bob"), viewer: V("bob") });
  assert.equal(r.reason, "REVIEWS_INSUFFICIENT");
  assert.equal(r.tier, 2);
  assert.equal(r.needs, "professional");
});

test("R2 a version is {template, version, text, sha, state, notes, author, contributors, derived_from, reviews, approved, ended}; version counts from 1; sha is SHA-256 of text; text and sha fixed once past draft", () => {
  const w = seeded();
  const d = draft(w);
  const v = w.ft.templateRead({ template: d.template, version: d.version, viewer: A }).version;
  for (const k of ["template", "version", "text", "sha", "state", "notes", "author", "contributors", "derived_from", "reviews", "approved", "ended"])
    assert.ok(k in v, k);
  assert.equal(v.version, 1);
  assert.equal(v.text, TEXT);
  assert.equal(v.sha, sha(TEXT));
  assert.equal(v.state, "draft");
  assert.equal(v.derived_from, null);
  assert.equal(v.approved, null);
  assert.equal(v.ended, null);
  assert.deepEqual(v.author, { id: "alice", name: "h_alice" });
  /* past draft: revising is refused, so the text and sha stay */
  w.ft.templateSubmit({ version: d.version, reviewers: ["bob"], author: A, viewer: A });
  assert.equal(w.ft.templateRevise({ version: d.version, text: "Other {{group}}", author: A, viewer: A }).reason, "NOT_A_DRAFT");
  const after = w.ft.templateRead({ template: d.template, version: d.version, viewer: A }).version;
  assert.deepEqual([after.text, after.sha, after.state], [TEXT, sha(TEXT), "in_review"]);
});

test("R2 the text's refusals: empty, not UTF-8, over FILING_TEXT_MAX bytes (TEMPLATE_TEXT_REFUSED), and a blank outside FILING_BLANKS named (TEMPLATE_BLANK_UNKNOWN)", () => {
  const w = seeded();
  for (const text of ["", "   ", "\uD800 lone", "é".repeat(ft.FILING_TEXT_MAX / 2 + 1), 42]) refused(make(w, { text }), "TEMPLATE_TEXT_REFUSED");
  assert.equal(make(w, { text: "é".repeat(ft.FILING_TEXT_MAX / 2), name: "max" }).ok, true, "exactly the bound in bytes");
  const b = refused(make(w, { text: "{{group}} and {{mayor}} then {{nope}}" }), "TEMPLATE_BLANK_UNKNOWN");
  assert.equal(b.blank, "mayor", "the first unknown");
  assert.equal(make(w, { text: "{{ group }} {{venue_how}}", name: "spaced" }).ok, true);
});

test("R3 templateDraft: a new version of a named template keeps its kind, use, profiles, name and scope, counts on, and records derived_from for a version, a proposal and (in-process) a filing", () => {
  const w = seeded();
  const a = approved(w);
  const n2 = w.ft.templateDraft({ template: a.template, text: "Second {{group}}", from: a.version, kind: "bylaw_complaint",
                                  name: "ignored", author: A, viewer: A });
  assert.equal(n2.ok, true, JSON.stringify(n2));
  assert.equal(n2.version, `${a.template}@2`);
  assert.deepEqual(n2.derived_from, { version: a.version });
  const head = w.ft.templateRead({ template: a.template, version: n2.version, viewer: A }).template;
  assert.deepEqual([head.kind, head.use, head.profiles, head.name, head.scope], ["records_request", "file", [TEST], "Records ask", { project: w.P }]);
  /* from a proposal: its text when none is given */
  const p = w.ft.templatePropose({ kind: "records_request", text: "Proposed {{law}}", why: "plainer", proposer: MACHINE, viewer: MACHINE });
  const fromP = make(w, { name: "fromP", text: undefined, from: p.proposal.id });
  assert.deepEqual(fromP.derived_from, { proposal: p.proposal.id });
  assert.equal(w.ft.templateRead({ template: fromP.template, viewer: A }).version.text, "Proposed {{law}}");
  /* from a filing, in-process (filings' own service, its R32) */
  const f = make(w, { name: "fromF", from: { filing: "FIL-2026-0001", sha: sha(TEXT) } });
  assert.deepEqual(f.derived_from, { filing: "FIL-2026-0001", sha: sha(TEXT) });
  /* from the profile's template: a derivative, the group's own */
  const der = make(w, { name: "derived", text: undefined, from: "TPL-test-records-request@1" });
  assert.equal(der.ok, true);
  assert.match(w.ft.templateRead({ template: der.template, viewer: A }).version.text, /under \{\{law\}\}/);
});

test("R3 refusals in order: MACHINE_CANNOT_DRAFT_TEMPLATE, NO_SUCH_TEMPLATE, TEMPLATE_SCOPE_REFUSED, TEMPLATE_DRAFT_OPEN, TEMPLATE_RETIRED, R1's, R2's, TEMPLATE_FROM_REFUSED", () => {
  const w = seeded();
  const before = w.snapshot();
  for (const author of [MACHINE, "token:x", "daemon", "", null]) refused(make(w, { author, template: "TPL-2026-0000" }), "MACHINE_CANNOT_DRAFT_TEMPLATE");
  refused(make(w, { template: "TPL-2026-0000", project: "nowhere" }), "NO_SUCH_TEMPLATE");
  /* scope: not a joined participant (dave outside, carol invited), or no project */
  for (const who of ["dave", "carol"]) refused(make(w, { author: V(who), viewer: V(who) }), "TEMPLATE_SCOPE_REFUSED");
  refused(make(w, { project: null }), "TEMPLATE_SCOPE_REFUSED");
  refused(make(w, { project: w.Q }), "TEMPLATE_SCOPE_REFUSED");
  /* a profile's template is read-only: its new version is refused at the scope */
  refused(w.ft.templateDraft({ template: "TPL-test-records-request", text: TEXT, author: A, viewer: A }), "TEMPLATE_SCOPE_REFUSED");
  assert.deepEqual(w.snapshot(), before, "nothing written by a refusal");
  const d = draft(w);
  const open = refused(w.ft.templateDraft({ template: d.template, text: TEXT, author: A, viewer: A }), "TEMPLATE_DRAFT_OPEN");
  assert.equal(open.version, d.version);
  w.ft.templateRetire({ template: d.template, version: d.version, reason: "not now", by: A, viewer: A });
  w.ft.templateRetire({ template: d.template, reason: "gone", by: A, viewer: A });
  const ret = refused(w.ft.templateDraft({ template: d.template, text: TEXT, author: A, viewer: A }), "TEMPLATE_RETIRED");
  assert.equal(ret.retired.reason, "gone");
  /* R1's before R2's, R2's before from */
  assert.equal(make(w, { kind: "BAD", text: "" }).reason, "TEMPLATE_KIND_REFUSED");
  assert.equal(make(w, { name: "z", text: "", from: "TPP-2026-0000" }).reason, "TEMPLATE_TEXT_REFUSED");
  for (const from of ["TPP-2026-0000", "TPL-2026-0000@1", "TPL-test-records-request@9", { filing: "", sha: "x" }, ["a"], 7])
    refused(make(w, { name: `f${JSON.stringify(from).length}`, from }), "TEMPLATE_FROM_REFUSED");
  /* a version the author may not see: dave's project's template */
  w.join(w.Q, "dave", "joined", true);
  const q = w.ft.templateDraft({ project: w.Q, kind: "records_request", use: "file", profiles: [TEST], name: "Q's", text: TEXT,
                                 author: V("dave"), viewer: V("dave") });
  refused(make(w, { name: "hidden", from: q.version }), "TEMPLATE_FROM_REFUSED");
  /* a filing source through the op is refused */
  refused(make(w, { name: "viaop", from: { filing: "FIL-2026-0001", sha: sha(TEXT) }, via: "op" }), "TEMPLATE_FROM_REFUSED");
});

test("R19 FILING_BLANKS and FILING_TEXT_MAX are exported frozen and unchanged from filings' at the move; blanksOf answers the names in order and the first unknown", () => {
  /* filings' value at the move (`filings/index.mjs`:75–:97, T21), each sentence unchanged, first and in order; R31 (T47)
     adds four after them, which r31.test.mjs pins */
  const moved = Object.fromEntries(Object.entries(ft.FILING_BLANKS).slice(0, 15));
  assert.deepEqual(moved, {
    counterparty_role: word("filing-templates.counterparty_role"),
    counterparty_body: word("filing-templates.counterparty_body"),
    counterparty_organisation: word("filing-templates.counterparty_organisation"),
    counterparty_description: word("filing-templates.counterparty_description"),
    act: word("filing-templates.act.government_did_action"),
    act_date: word("filing-templates.act_date"),
    standards: word("filing-templates.standards"),
    findings: word("filing-templates.findings"),
    governing_laws: word("filing-templates.governing_laws"),
    law: word("filing-templates.law"),
    clock: word("filing-templates.clock.action_clock_entries"),
    venue: word("filing-templates.venue"),
    venue_how: word("filing-templates.venue_how"),
    group: word("filing-templates.group"),
    date: word("filing-templates.date"),
  });
  assert.ok(Object.isFrozen(ft.FILING_BLANKS));
  assert.equal(ft.FILING_TEXT_MAX, 65536);
  assert.deepEqual(Object.keys(ft.FILING_BLANKS), ["counterparty_role", "counterparty_body", "counterparty_organisation",
    "counterparty_description", "act", "act_date", "standards", "findings", "governing_laws", "law", "clock", "venue",
    "venue_how", "group", "date", "records", "period", "form", "cost_limit"], "the fifteen moved, then R31's four");
  for (const v of Object.values(ft.FILING_BLANKS)) assert.equal(typeof v, "string");
  assert.deepEqual(ft.blanksOf("{{law}} {{group}} {{law}} {{ venue }}"), { blanks: ["law", "group", "venue"], unknown: null });
  assert.deepEqual(ft.blanksOf("{{group}} {{x_y}} {{zz}}"), { blanks: ["group", "x_y", "zz"], unknown: "x_y" });
  assert.deepEqual(ft.blanksOf("none {{Upper}} {group}"), { blanks: [], unknown: null });
  assert.deepEqual(ft.blanksOf(null), { blanks: [], unknown: null });
});

test("R21 TEMPLATE_STATES, TEMPLATE_USES and REVIEW_OUTCOMES are exported frozen, as the Terms and R9 give them (and as the profile's vocabulary reads them)", () => {
  assert.deepEqual([...ft.TEMPLATE_STATES], ["draft", "in_review", "approved", "updated", "withdrawn"]);
  assert.deepEqual([...ft.TEMPLATE_USES], ["file", "brief"]);
  assert.deepEqual([...ft.REVIEW_OUTCOMES], ["no_concerns", "concerns", "changes_requested"]);
  for (const v of [ft.TEMPLATE_STATES, ft.TEMPLATE_USES, ft.REVIEW_OUTCOMES]) assert.ok(Object.isFrozen(v));
  assert.deepEqual([...ft.TEMPLATE_USES], [...jurisdictions.TEMPLATE_USES]);
  assert.deepEqual([...ft.REVIEW_OUTCOMES], [...jurisdictions.REVIEW_OUTCOMES]);
  /* every state a version reaches is one of them */
  const w = seeded();
  const a = approved(w);
  const two = w.ft.templateDraft({ template: a.template, text: "v2 {{group}}", author: A, viewer: A });
  w.ft.templateSubmit({ version: two.version, reviewers: ["bob"], author: A, viewer: A });
  const seen = new Set(w.ft.templatesFor({ state: "in_review", viewer: A }).templates.flatMap((t) => t.versions.map((v) => v.state)));
  for (const s of seen) assert.ok(ft.TEMPLATE_STATES.includes(s));
});

test("R3 (C65): a template kept from a filing is accepted for the project's owner and for a joined member, in the project the action belongs to; a member outside it, an invited one and a filing with no project are refused", () => {
  const w = seeded();
  const keep = (who, project, name) => w.ft.templateDraft({ project, kind: "records_request", use: "file", profiles: [TEST], name, text: TEXT,
    from: { filing: "FIL-2026-0001", sha: sha(TEXT) }, author: V(who), viewer: V(who) });
  // alice owns P, frank is a joined member of it
  for (const who of ["alice", "bob", "frank"]) {
    const r = keep(who, w.P, `kept by ${who}`);
    assert.equal(r.ok, true, `${who}: ${JSON.stringify(r).slice(0, 200)}`);
    assert.deepEqual(w.ft.templateRead({ template: r.template, viewer: V(who) }).template.scope, { project: w.P });
  }
  // control: dave is outside P, carol is invited and not joined, and a filing that names no project has no scope at all
  for (const who of ["dave", "carol"]) refused(keep(who, w.P, `by ${who}`), "TEMPLATE_SCOPE_REFUSED");
  refused(keep("alice", null, "no project"), "TEMPLATE_SCOPE_REFUSED");
});
