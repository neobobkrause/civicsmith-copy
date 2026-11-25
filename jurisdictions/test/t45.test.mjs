/* jurisdictions, T45 (T45-1): the profile schema the Action layer reads (R74–R87; `BIO_Action_v0_2.md` rules 6, 7, 9,
 * 11–13, 16, 21, §5) and the first profile's sourced action facts (R85, read 2026-10-11 on the primary sources in
 * `fixtures/actions-law.mjs`). Tested at the module's interface: validate, combine, get and the exported vocabularies.
 * Every malformed field is shown with its code beside a well-formed control; every one-value fact of `combine` is shown
 * withheld, with its conflict, when two profiles disagree. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate, combine, SECTIONS, STARTS, OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES,
  UNITS } from "../index.mjs";
import { walkFacts } from "./helpers.mjs";
import { FACTS, EXAMPLES, SOURCES } from "./fixtures/actions-law.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const M = "2026-10-11 actions-law";
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
const breakT = (fn) => { const p = get(TEST); fn(p); return validate(p); };
const breakF = (fn) => { const p = get(FIRST); fn(p); return validate(p); };
const other = (fn) => { const p = get(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
const ix = (arr, pred) => arr.findIndex(pred);
const kindAt = (p, kind) => ix(p.action_kinds, (k) => k.kind === kind);
const ruleAt = (p, rule) => ix(p.deadlines, (d) => d.rule === rule);
const cpAt = (p, role) => ix(p.counterparties, (c) => c.role === role);
const lawAt = (p, name) => ix(p.records_laws, (l) => l.name === name);
const conflictsAt = (r) => r.conflicts.map((c) => c.at);
/* the same profile twice under two ids, the second changed by fn: every conflict is fn's */
const against = (fn) => combine([TEST, other(fn)]);

/* ============================================================================================== */

test("R74 a counterparty's or a venue's own time_zone, R41's form and status; one value per office and per venue", () => {
  const t = get(TEST);
  const ex = cpAt(t, "Examiner of Accounts"), cc = kindAt(t, "commitment_claim");
  const C = `counterparties[${ex}].time_zone`, V = `action_kinds[${cc}].venue.time_zone`;
  assert.equal(t.counterparties[ex].time_zone.value, "America/St_Johns");
  assert.notEqual(t.counterparties[ex].time_zone.value, t.time_zone.value, "the office's own zone, unlike the profile's");
  assert.equal(t.action_kinds[cc].venue.time_zone.value, "America/Glace_Bay");
  for (const [path, of] of [[C, (p) => p.counterparties[ex]], [V, (p) => p.action_kinds[cc].venue]]) {
    for (const good of ["UTC", "Europe/London", "America/Argentina/Buenos_Aires"]) assert.ok(breakT((p) => { of(p).time_zone.value = good; }).ok, good);
    for (const bad of ["Mars/Base", "pacific", "", 3]) assert.ok(hasError(breakT((p) => { of(p).time_zone.value = bad; }), "VALUE_INVALID", `${path}.value`), String(bad));
    assert.ok(hasError(breakT((p) => { of(p).time_zone = "UTC"; }), "VALUE_INVALID", path));
    assert.ok(hasError(breakT((p) => { delete of(p).time_zone.status; }), "BASIS_INVALID", `${path}.status`));
    assert.ok(hasError(breakT((p) => { of(p).time_zone.extra = 1; }), "UNKNOWN_SECTION", `${path}.extra`));
  }
  /* a real profile: sourced, never UNMEASURED (R44); a measured one lands */
  const sf = (z) => breakF((p) => { p.counterparties[0].time_zone = z; });
  assert.ok(sf({ value: "America/Los_Angeles", status: "researched", basis: "M-187" }).ok);
  assert.ok(hasError(sf({ value: "America/Los_Angeles", status: "researched", basis: "UNMEASURED" }), "BASIS_INVALID", "counterparties[0].time_zone.basis"));
  /* combine: agreeing, kept with both bases; disagreeing, withheld and reported */
  const same = against(() => {});
  assert.deepEqual(same.conflicts.filter((c) => /time_zone/.test(c.at)), []);
  const v = same.view.counterparties.find((c) => c.role === "Examiner of Accounts").time_zone;
  assert.deepEqual([v.value, v.bases.map((b) => b.profile)], ["America/St_Johns", [TEST, "test-other"]]);
  const d1 = against((b) => { b.counterparties[ex].time_zone.value = "UTC"; });
  assert.deepEqual(conflictsAt(d1), ["counterparties[Examiner of Accounts/Marlow County Audit Office].time_zone"]);
  assert.equal(d1.view.counterparties.find((c) => c.role === "Examiner of Accounts").time_zone, undefined);
  const d2 = against((b) => { b.action_kinds[cc].venue.time_zone.value = "UTC"; });
  assert.deepEqual(conflictsAt(d2), ["action_kinds[commitment_claim].venue.time_zone"], "the zone alone, never the whole venue");
  const venue = d2.view.action_kinds.find((k) => k.kind === "commitment_claim").venue;
  assert.ok(venue && venue.time_zone === undefined);
});

test("R75 a deadline's owed_by and consequence; a start by a third party's act names its starter; one value per rule", () => {
  const t = get(TEST);
  const cp = ruleAt(t, "complaint_particulars"), er = ruleAt(t, "examiner_reply");
  const D = `deadlines[${cp}]`, E = `deadlines[${er}]`;
  assert.deepEqual(OWED_BY, ["body", "group"]);
  assert.ok(Object.isFrozen(OWED_BY) && STARTS.includes("third_party"));
  assert.equal(t.deadlines[cp].owed_by, "group");
  assert.deepEqual(t.deadlines[cp].consequence, { text: "the claim shall be considered withdrawn", citation: "P.E.B.L. § 9(3)" });
  for (const ob of OWED_BY) assert.ok(breakT((p) => { p.deadlines[cp].owed_by = ob; }).ok, ob);
  for (const bad of ["office", "", true]) assert.ok(hasError(breakT((p) => { p.deadlines[cp].owed_by = bad; }), "VALUE_INVALID", `${D}.owed_by`), String(bad));
  assert.ok(breakT((p) => { delete p.deadlines[cp].owed_by; }).ok, "absent: undetermined, never refused");
  for (const [bad, at] of [["deemed denied", ""], [{ text: "deemed denied" }, ".citation"], [{ citation: "§ 1" }, ".text"], [{ text: "", citation: "§ 1" }, ".text"]])
    assert.ok(hasError(breakT((p) => { p.deadlines[cp].consequence = bad; }), "VALUE_INVALID", `${D}.consequence${at}`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { p.deadlines[cp].consequence.extra = 1; }), "UNKNOWN_SECTION", `${D}.consequence.extra`));
  /* the starter is a counterparty of the profile, by role and body */
  assert.deepEqual(t.deadlines[er].starter, { role: "Examiner of Accounts", body: "Marlow County Audit Office" });
  for (const bad of [undefined, { role: "Examiner of Accounts", body: "Elsewhere" }, { role: "Nobody", body: "Marlow County Audit Office" }, "Examiner of Accounts",
    { role: "Examiner of Accounts", body: "Marlow County Audit Office", x: 1 }])
    assert.ok(hasError(breakT((p) => { p.deadlines[er].starter = bad; if (bad === undefined) delete p.deadlines[er].starter; }), "ANCHOR_UNKNOWN", `${E}.starter`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { p.deadlines[cp].starter = { role: "Town Clerk", body: "City of Port Ellery" }; }), "VALUE_INVALID", `${D}.starter`), "a starter only with third_party");
  assert.ok(breakT((p) => { p.deadlines[cp].starts = "third_party"; p.deadlines[cp].starter = { role: "Town Clerk", body: "City of Port Ellery" }; }).ok);
  /* combine: each one value under rule and applies_to */
  for (const [f, fn] of [["owed_by", (d) => { d.owed_by = "body"; }], ["consequence", (d) => { d.consequence.text = "deemed refused"; }],
    ["starter", null]]) {
    const r = f === "starter"
      ? against((b) => { b.deadlines[er].starter = { role: "Town Clerk", body: "City of Port Ellery" }; })
      : against((b) => fn(b.deadlines[cp]));
    const rule = f === "starter" ? "examiner_reply/claim" : "complaint_particulars/claim";
    assert.deepEqual(conflictsAt(r), [`deadlines[${rule}].${f}`], f);
    assert.equal(r.view.deadlines.find((d) => `${d.rule}/${d.applies_to}` === rule)[f], undefined, `${f} withheld`);
  }
  const kept = against(() => {}).view.deadlines.find((d) => d.rule === "complaint_particulars");
  assert.deepEqual([kept.owed_by, kept.consequence.citation], ["group", "P.E.B.L. § 9(3)"]);
});

test("R76 a records law's stages in its order (a stage it lacks absent) and who may request; one value per law", () => {
  const t = get(TEST);
  const li = lawAt(t, "Freedom of Records Act (test)"), L = `records_laws[${li}]`;
  assert.deepEqual(t.records_laws[li].stages.map((s) => s.stage), ["request", "denial", "appeal", "appeal_decision"]);
  assert.ok(!t.records_laws[li].stages.some((s) => s.stage === "fee_waiver_request"), "the law lacks a fee waiver: absent");
  assert.ok(breakT((p) => { delete p.records_laws[li].stages; }).ok, "absent: which stages it has is undetermined");
  for (const bad of [[], "request", null]) assert.ok(hasError(breakT((p) => { p.records_laws[li].stages = bad; }), "VALUE_INVALID", `${L}.stages`), JSON.stringify(bad));
  for (const bad of ["Fee Waiver", "1st", ""]) assert.ok(hasError(breakT((p) => { p.records_laws[li].stages[0].stage = bad; }), "VALUE_INVALID", `${L}.stages[0].stage`), bad);
  assert.ok(breakT((p) => { p.records_laws[li].stages[0].stage = "a_stage_grammar_does_not_know"; }).ok, "whether action-grammar knows it is that module's check");
  assert.ok(hasError(breakT((p) => { p.records_laws[li].stages[1].stage = "request"; }), "VALUE_INVALID", `${L}.stages[1].stage`), "twice");
  for (const f of ["label", "citation"]) assert.ok(hasError(breakT((p) => { p.records_laws[li].stages[0][f] = ""; }), "VALUE_INVALID", `${L}.stages[0].${f}`), f);
  assert.ok(hasError(breakT((p) => { p.records_laws[li].stages[0].rank = 1; }), "UNKNOWN_SECTION", `${L}.stages[0].rank`));
  /* requesters: who may request, a sourced fact */
  assert.ok(hasError(breakT((p) => { p.records_laws[li].requesters.text = ""; }), "VALUE_INVALID", `${L}.requesters.text`));
  assert.ok(hasError(breakT((p) => { delete p.records_laws[li].requesters.status; }), "BASIS_INVALID", `${L}.requesters.status`));
  assert.ok(hasError(breakT((p) => { p.records_laws[li].requesters = "anyone"; }), "VALUE_INVALID", `${L}.requesters`));
  assert.ok(hasError(breakF((p) => { p.records_laws[0].requesters.basis = "UNMEASURED"; }), "BASIS_INVALID", "records_laws[0].requesters.basis"));
  /* combine: the law unioned; its stages and requesters one value each under its name */
  const same = against(() => {});
  const law = same.view.records_laws.find((l) => l.name === "Freedom of Records Act (test)");
  assert.deepEqual([law.stages.length, law.requesters.bases.length, same.conflicts.filter((c) => c.at.startsWith("records_laws")).length], [4, 2, 0]);
  const d = against((b) => { b.records_laws[li].stages.splice(1, 1); });
  assert.deepEqual(conflictsAt(d), ["records_laws[Freedom of Records Act (test)].stages"]);
  assert.equal(d.view.records_laws.find((l) => l.name === "Freedom of Records Act (test)").stages, undefined);
  const r = against((b) => { b.records_laws[li].requesters.text = "anyone at all"; });
  assert.deepEqual(conflictsAt(r), ["records_laws[Freedom of Records Act (test)].requesters"]);
});

test("R77 a response status may name the kind whose venue reports in it; KIND_INVALID otherwise; unioned", () => {
  const t = get(TEST);
  const rs = t.vocabulary.response_statuses;
  const i = ix(rs, (e) => e.applies_to === "bylaw_complaint"), A = `vocabulary.response_statuses[${i}].applies_to`;
  assert.ok(i >= 0 && rs.some((e) => !("applies_to" in e)), "one for a kind, others for every kind");
  for (const k of t.action_kinds.map((x) => x.kind)) assert.ok(breakT((p) => { p.vocabulary.response_statuses[i].applies_to = k; }).ok, k);
  for (const bad of ["nowhere", "", 3]) assert.ok(hasError(breakT((p) => { p.vocabulary.response_statuses[i].applies_to = bad; }), "KIND_INVALID", A), String(bad));
  const v = combine([TEST, other((b) => { b.vocabulary.response_statuses[i].applies_to = "commitment_claim"; })]);
  assert.deepEqual(v.conflicts, [], "unioned, never a conflict");
  assert.deepEqual(v.view.vocabulary.response_statuses.filter((e) => e.status === rs[i].status).map((e) => e.applies_to), ["bylaw_complaint", "commitment_claim"]);
});

test("R78 legal_organisations evaluate Tier 2 or 3 kinds, or defend a group (defends: true); ORG_PURPOSE_MISSING with neither", () => {
  const t = get(TEST);
  const d = ix(t.legal_organisations, (o) => o.defends === true), O = `legal_organisations[${d}]`;
  assert.equal(t.legal_organisations[d].defends, true);
  assert.ok(breakT((p) => { p.legal_organisations[d].evaluates = []; }).ok, "defends with no kind evaluated");
  assert.ok(breakT((p) => { delete p.legal_organisations[d].evaluates; }).ok, "defends alone");
  assert.ok(breakT((p) => { p.legal_organisations[d].evaluates = ["records_request"]; }).ok, "a Tier 2 kind (records_request is Tier 2 here)");
  assert.ok(breakT((p) => { p.legal_organisations[d].evaluates = ["commitment_claim", "records_request"]; p.legal_organisations[d].defends = false; }).ok);
  assert.ok(hasError(breakT((p) => { p.legal_organisations[d].evaluates = ["bylaw_complaint"]; }), "ORG_KIND_UNKNOWN", `${O}.evaluates[0]`), "Tier 1");
  assert.ok(hasError(breakT((p) => { p.legal_organisations[d].evaluates = ["nowhere"]; }), "ORG_KIND_UNKNOWN", `${O}.evaluates[0]`));
  for (const fn of [(o) => { o.evaluates = []; o.defends = false; }, (o) => { o.evaluates = []; delete o.defends; }, (o) => { delete o.defends; delete o.evaluates; }])
    assert.ok(hasError(breakT((p) => fn(p.legal_organisations[d])), "ORG_PURPOSE_MISSING", `${O}.evaluates`));
  for (const bad of ["yes", 1, null]) assert.ok(hasError(breakT((p) => { p.legal_organisations[d].defends = bad; }), "VALUE_INVALID", `${O}.defends`), String(bad));
  /* unioned in combine (R34): a different defends is a different entry, kept */
  const u = against((b) => { b.legal_organisations[d].defends = false; b.legal_organisations[d].evaluates = ["commitment_claim"]; });
  assert.deepEqual(u.conflicts.filter((c) => c.at.startsWith("legal_organisations")), []);
  assert.equal(u.view.legal_organisations.filter((o) => o.name === t.legal_organisations[d].name).length, 2);
});

test("R79 legal_facts: key, a trigger of LEGAL_FACT_TRIGGERS, statement, citation, threshold, applies_to, a sourced status; one value per key", () => {
  assert.deepEqual(LEGAL_FACT_TRIGGERS, ["paid_attendee", "recording", "threat_letter", "pending_measure_or_candidate", "serial_meeting"]);
  assert.ok(Object.isFrozen(LEGAL_FACT_TRIGGERS) && SECTIONS.includes("legal_facts"));
  const t = get(TEST);
  const L = "legal_facts[0]";
  for (const trigger of LEGAL_FACT_TRIGGERS) assert.ok(breakT((p) => { p.legal_facts[0].trigger = trigger; }).ok, trigger);
  for (const bad of ["meeting", "", null]) assert.ok(hasError(breakT((p) => { p.legal_facts[0].trigger = bad; }), "TRIGGER_UNKNOWN", `${L}.trigger`), String(bad));
  for (const bad of ["Key", "1x", ""]) assert.ok(hasError(breakT((p) => { p.legal_facts[0].key = bad; }), "VALUE_INVALID", `${L}.key`), bad);
  assert.ok(hasError(breakT((p) => { p.legal_facts[1].key = p.legal_facts[0].key; }), "VALUE_INVALID", "legal_facts[1].key"), "twice");
  for (const f of ["statement", "citation"]) assert.ok(hasError(breakT((p) => { p.legal_facts[0][f] = " "; }), "VALUE_INVALID", `${L}.${f}`), f);
  assert.ok(breakT((p) => { p.legal_facts[0].threshold = { amount: 99.5, unit: "GBP" }; }).ok);
  for (const bad of [{ amount: 0, unit: "GBP" }, { amount: 5 }, { amount: "5", unit: "GBP" }, { amount: 5, unit: "GBP", per: "year" }, 5])
    assert.ok(hasError(breakT((p) => { p.legal_facts[0].threshold = bad; }), "VALUE_INVALID", `${L}.threshold`), JSON.stringify(bad));
  assert.ok(breakT((p) => { p.legal_facts[0].applies_to = ["bylaw_complaint", "records_request"]; }).ok);
  for (const [bad, at] of [[[], ""], [["nowhere"], "[0]"], ["bylaw_complaint", ""]]) assert.ok(hasError(breakT((p) => { p.legal_facts[0].applies_to = bad; }), "VALUE_INVALID", `${L}.applies_to${at}`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { delete p.legal_facts[0].status; }), "BASIS_INVALID", `${L}.status`));
  assert.ok(hasError(breakF((p) => { p.legal_facts[0].basis = "UNMEASURED"; }), "BASIS_INVALID", "legal_facts[0].basis"), "a legal fact is sourced");
  assert.ok(hasError(breakT((p) => { p.legal_facts[0].rank = 1; }), "UNKNOWN_SECTION", `${L}.rank`));
  /* combine: one value per key */
  const same = against(() => {});
  assert.deepEqual(same.view.legal_facts.map((f) => [f.key, f.bases.length]), t.legal_facts.map((f) => [f.key, 2]));
  const d = against((b) => { b.legal_facts[0].statement = "Something else."; });
  assert.deepEqual(conflictsAt(d), [`legal_facts[${t.legal_facts[0].key}]`]);
  assert.ok(!d.view.legal_facts.some((f) => f.key === t.legal_facts[0].key), "withheld");
});

test("R80 R87 procedure_guides: one sourced guide per kind, items in the profile's order with no rank, each cited, an item's after", () => {
  assert.ok(SECTIONS.includes("procedure_guides"));
  const t = get(TEST);
  const G = "procedure_guides[0]";
  assert.ok(breakT(() => {}).ok);
  for (const bad of ["nowhere", "", 3]) assert.ok(hasError(breakT((p) => { p.procedure_guides[0].kind = bad; }), "KIND_INVALID", `${G}.kind`), String(bad));
  assert.ok(hasError(breakT((p) => { p.procedure_guides.push({ ...p.procedure_guides[0] }); }), "VALUE_INVALID", "procedure_guides[1].kind"), "one guide per kind");
  for (const bad of [[], "route", null]) assert.ok(hasError(breakT((p) => { p.procedure_guides[0].items = bad; }), "VALUE_INVALID", `${G}.items`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { delete p.procedure_guides[0].items[0].citation; }), "VALUE_INVALID", `${G}.items[0].citation`), "each item cited");
  assert.ok(hasError(breakT((p) => { p.procedure_guides[0].items[0].route = ""; }), "VALUE_INVALID", `${G}.items[0].route`));
  assert.ok(hasError(breakT((p) => { p.procedure_guides[0].items[0].expect = ""; }), "VALUE_INVALID", `${G}.items[0].expect`));
  assert.ok(breakT((p) => { delete p.procedure_guides[0].items[0].expect; }).ok, "expect is optional");
  assert.ok(hasError(breakT((p) => { p.procedure_guides[0].items[0].rank = 1; }), "UNKNOWN_SECTION", `${G}.items[0].rank`), "no rank field");
  assert.ok(hasError(breakT((p) => { delete p.procedure_guides[0].status; }), "BASIS_INVALID", `${G}.status`));
  /* R87 (d): after, the outcomes after which the route applies */
  assert.deepEqual(t.procedure_guides[0].items[1].after, ["denied", "none_stated"]);
  assert.ok(breakT((p) => { p.procedure_guides[0].items[1].after = ["an_outcome_grammar_does_not_know"]; }).ok, "action-grammar's check, not this module's");
  for (const bad of [[], ["Denied"], ["denied", "denied"], "denied"])
    assert.ok(hasError(breakT((p) => { p.procedure_guides[0].items[1].after = bad; }), "VALUE_INVALID", `${G}.items[1].after`), JSON.stringify(bad));
  /* combine: one value per kind, its items in the profile's order */
  const same = against(() => {});
  assert.deepEqual(same.view.procedure_guides[0].items.map((x) => x.route), t.procedure_guides[0].items.map((x) => x.route));
  const d = against((b) => { b.procedure_guides[0].items.reverse(); });
  assert.deepEqual(conflictsAt(d), ["procedure_guides[bylaw_complaint]"], "another order is another guide");
  assert.deepEqual(d.view.procedure_guides, []);
});

test("R81 R87 a kind's templates: each attributed (R40), with purpose (once per kind), name and sources; TEMPLATE_TIER3 for each; one value per purpose", () => {
  const t = get(TEST);
  const hp = kindAt(t, "recognition_letter"), K = `action_kinds[${hp}]`;
  assert.deepEqual(t.action_kinds[hp].templates.map((x) => x.purpose), ["initial", "follow_up"]);
  for (const bad of ["Initial", "", null]) assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates[0].purpose = bad; }), "VALUE_INVALID", `${K}.templates[0].purpose`), String(bad));
  assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates[1].purpose = "initial"; }), "VALUE_INVALID", `${K}.templates[1].purpose`), "once per kind");
  assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates = []; }), "VALUE_INVALID", `${K}.templates`));
  assert.ok(hasError(breakT((p) => { p.action_kinds[hp].template = p.action_kinds[hp].templates[0]; delete p.action_kinds[hp].template.purpose; }), "VALUE_INVALID", `${K}.templates`), "template or templates, not both");
  assert.ok(hasError(breakT((p) => { delete p.action_kinds[hp].templates[1].approved_by; }), "TEMPLATE_UNATTRIBUTED", `${K}.templates[1].approved_by`), "R40 for each");
  assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates[1].id = p.action_kinds[hp].templates[0].id; }), "VALUE_INVALID", `${K}.templates[1].id`), "an id once in the profile");
  assert.ok(hasError(breakT((p) => { p.action_kinds[hp].tier = 3; }), "TEMPLATE_TIER3", `${K}.templates[0]`), "R28 for each");
  assert.ok(breakT((p) => { p.action_kinds[hp].tier = 3; for (const x of p.action_kinds[hp].templates) x.use = "brief"; }).ok, "a brief may serve Tier 3");
  /* R87 (b): name, a title on one line; sources, the public sources it was written from */
  assert.ok(breakT((p) => { p.action_kinds[hp].templates[0].name = "x".repeat(120); }).ok);
  for (const bad of ["x".repeat(121), "two\nlines", "", undefined])
    assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates[0].name = bad; if (bad === undefined) delete p.action_kinds[hp].templates[0].name; }), "VALUE_INVALID", `${K}.templates[0].name`), JSON.stringify(bad));
  for (const bad of [[], undefined, "P.E.B.L. § 11"])
    assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates[0].sources = bad; if (bad === undefined) delete p.action_kinds[hp].templates[0].sources; }), "VALUE_INVALID", `${K}.templates[0].sources`), JSON.stringify(bad));
  for (const bad of [{ citation: "" }, { url: "x" }, "§ 11"]) assert.ok(hasError(breakT((p) => { p.action_kinds[hp].templates[0].sources = [bad]; }), "VALUE_INVALID", `${K}.templates[0].sources[0]`), JSON.stringify(bad));
  /* the single template (R25) may carry name and sources, and is read as a set of one, purpose initial */
  const br = kindAt(t, "bylaw_complaint");
  assert.ok(breakT((p) => { p.action_kinds[br].template.name = "Complaint"; p.action_kinds[br].template.sources = [{ citation: "P.E.B.L. § 9" }]; }).ok);
  assert.ok(hasError(breakT((p) => { p.action_kinds[br].template.purpose = "initial"; }), "UNKNOWN_SECTION", `action_kinds[${br}].template.purpose`));
  const same = against(() => {});
  const vbr = same.view.action_kinds.find((k) => k.kind === "bylaw_complaint");
  assert.deepEqual([vbr.templates.length, vbr.templates[0].purpose, vbr.templates[0].id], [1, "initial", vbr.template.id]);
  const vhp = same.view.action_kinds.find((k) => k.kind === "recognition_letter");
  assert.deepEqual(vhp.templates.map((x) => [x.purpose, x.name, x.bases.length]), [["initial", "Letter of recognition", 2], ["follow_up", "Follow-up letter of recognition", 2]]);
  /* one value per purpose: a difference anywhere in one template withholds that template only */
  const d = against((b) => { b.action_kinds[hp].templates[1].sources.pop(); });
  assert.deepEqual(conflictsAt(d), ["action_kinds[recognition_letter].templates[follow_up]"]);
  assert.deepEqual(d.view.action_kinds.find((k) => k.kind === "recognition_letter").templates.map((x) => x.purpose), ["initial"]);
  /* a single template against a set's initial: one key, compared whole */
  const m = combine([TEST, other((b) => { b.action_kinds[br].templates = [{ ...b.action_kinds[br].template, purpose: "initial", name: "N", sources: [{ citation: "C" }] }]; delete b.action_kinds[br].template; })]);
  assert.deepEqual(conflictsAt(m), ["action_kinds[bylaw_complaint].templates[initial]"]);
});

test("R82 R87 a venue's facts: fact of VENUE_FACTS (delivery_point among them), value ≤ 500, amount in R26's units, cited, sourced; one value per kind and fact", () => {
  assert.deepEqual(VENUE_FACTS, ["how_to_submit", "anonymity", "publishes", "public_listing", "speaker_limit", "comment_cutoff", "page_limit",
    "interpreter_lead", "delivery_point"]);
  assert.ok(Object.isFrozen(VENUE_FACTS));
  const t = get(TEST);
  const br = kindAt(t, "bylaw_complaint"), F = `action_kinds[${br}].venue.facts`;
  const facts = (p) => p.action_kinds[br].venue.facts;
  assert.ok(facts(t).some((f) => f.fact === "delivery_point"), "a delivery point, held on the venue, never as the addressee");
  for (const fact of VENUE_FACTS) assert.ok(breakT((p) => { facts(p)[0].fact = fact; if (fact !== "speaker_limit") facts(p).splice(1, 2); }).ok, fact);
  for (const bad of ["addressee", "", null]) assert.ok(hasError(breakT((p) => { facts(p)[0].fact = bad; }), "VALUE_INVALID", `${F}[0].fact`), String(bad));
  assert.ok(hasError(breakT((p) => { facts(p)[1].fact = facts(p)[0].fact; }), "VALUE_INVALID", `${F}[1].fact`), "once per venue");
  assert.ok(breakT((p) => { facts(p)[0].value = "x".repeat(500); }).ok);
  for (const bad of ["x".repeat(501), "", 3]) assert.ok(hasError(breakT((p) => { facts(p)[0].value = bad; }), "VALUE_INVALID", `${F}[0].value`), String(bad).slice(0, 9));
  for (const units of UNITS) assert.ok(breakT((p) => { facts(p)[1].amount = { amount: 2, units }; }).ok, units);
  for (const bad of [{ amount: 2, units: "minutes" }, { amount: 0, units: "hours" }, { amount: 2 }, 2])
    assert.ok(hasError(breakT((p) => { facts(p)[1].amount = bad; }), "VALUE_INVALID", `${F}[1].amount`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { facts(p)[0].citation = ""; }), "VALUE_INVALID", `${F}[0].citation`));
  assert.ok(hasError(breakT((p) => { delete facts(p)[0].status; }), "BASIS_INVALID", `${F}[0].status`));
  assert.ok(hasError(breakT((p) => { p.action_kinds[br].venue.facts = {}; }), "VALUE_INVALID", F));
  assert.ok(hasError(breakF((p) => { p.action_kinds[0].venue.facts = [{ fact: "anonymity", value: "v", citation: "c", status: "researched", basis: "UNMEASURED" }]; }),
    "BASIS_INVALID", "action_kinds[0].venue.facts[0].basis"));
  /* combine: one value per kind and fact; the venue itself is not withheld */
  const d = against((b) => { facts(b)[0].value = "five minutes"; });
  assert.deepEqual(conflictsAt(d), ["action_kinds[bylaw_complaint].venue.facts[speaker_limit]"]);
  const v = d.view.action_kinds.find((k) => k.kind === "bylaw_complaint").venue;
  assert.deepEqual(v.facts.map((f) => f.fact), ["comment_cutoff", "delivery_point"]);
});

test("R83 no field of R74–R82 names a state or assumes one state's law; the module supplies no default for any of them", () => {
  /* the vocabularies the new fields are judged by name no place */
  const PLACE = /oakland|alameda|california|cal\.|marlow|ellery|u\.s\.c|federal|state/i;
  for (const list of [OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES, STARTS]) for (const w of list) assert.ok(!PLACE.test(w), w);
  /* a profile giving none of the new fields: validate accepts it, and the view holds none of them (no default) */
  const bare = get(TEST);
  bare.id = "test-bare";
  for (const s of ["legal_facts", "procedure_guides", "phrasings"]) delete bare[s];
  for (const d of bare.deadlines) for (const f of ["owed_by", "consequence", "defends", "starter"]) delete d[f];
  bare.deadlines = bare.deadlines.filter((d) => d.starts !== "third_party");
  for (const l of bare.records_laws) { delete l.stages; delete l.requesters; }
  for (const c of bare.counterparties) delete c.time_zone;
  for (const k of bare.action_kinds) { delete k.shape; delete k.templates; if (k.venue) { delete k.venue.facts; delete k.venue.time_zone; } }
  for (const o of bare.legal_organisations) if (o.defends) { delete o.defends; o.evaluates = ["commitment_claim"]; }
  for (const e of bare.vocabulary.response_statuses) delete e.applies_to;
  assert.deepEqual(validate(bare), { ok: true, errors: [] });
  const v = combine([bare]).view;
  for (const s of ["legal_facts", "procedure_guides", "phrasings"]) assert.equal(v[s], undefined, s);
  for (const d of v.deadlines) for (const f of ["owed_by", "consequence", "defends", "starter"]) assert.ok(!(f in d), `${d.rule}.${f}`);
  for (const l of v.records_laws) assert.ok(!("stages" in l) && !("requesters" in l), l.name);
  for (const c of v.counterparties) assert.ok(!("time_zone" in c), c.role);
  for (const k of v.action_kinds) {
    assert.ok(!("shape" in k), k.kind);
    if (k.venue) assert.ok(!("facts" in k.venue) && !("time_zone" in k.venue), k.kind);
  }
  assert.ok(v.legal_organisations.every((o) => !("defends" in o)));
  assert.ok(v.vocabulary.response_statuses.every((e) => !("applies_to" in e)));
  /* and an empty list of profiles answers nothing at all (R16) */
  const e = combine([]).view;
  for (const s of ["legal_facts", "procedure_guides", "phrasings", "deadlines", "records_laws"]) assert.equal(e[s], undefined, s);
});

test("R84 the test profile supplies R74–R82 (and R86, R87), with values differing from the first profile's, every basis TEST", () => {
  const t = get(TEST), f = get(FIRST);
  assert.ok(t.counterparties.some((c) => c.time_zone) && t.action_kinds.some((k) => k.venue && k.venue.time_zone), "R74");
  assert.ok(t.deadlines.some((d) => d.owed_by === "group" && d.consequence), "R75: owed by the group, with a consequence");
  assert.ok(t.deadlines.some((d) => d.owed_by === "body"), "R75: owed by a body");
  assert.ok(t.deadlines.some((d) => d.starts === "third_party" && d.starter), "R75: a third party's start");
  assert.ok(t.records_laws.some((l) => l.stages && !l.stages.some((s) => s.stage === "fee_waiver_request") && l.requesters), "R76: stages omitting one");
  assert.ok(t.vocabulary.response_statuses.some((e) => e.applies_to), "R77");
  assert.ok(t.legal_organisations.some((o) => o.defends === true), "R78: a defending organisation");
  assert.deepEqual([...new Set(t.legal_facts.map((x) => x.trigger))].sort(), [...LEGAL_FACT_TRIGGERS].sort(), "R79: one legal fact per trigger");
  assert.ok(t.procedure_guides.length && t.procedure_guides.some((g) => g.items.some((i) => i.after)), "R80, R87 (d)");
  assert.ok(t.action_kinds.some((k) => k.templates && k.templates.length === 2), "R81: a kind with two templates");
  assert.ok(t.action_kinds.some((k) => k.venue && k.venue.facts && k.venue.facts.some((x) => x.fact === "delivery_point")), "R82, R87 (e)");
  assert.deepEqual([...new Set(t.phrasings.map((x) => x.kind))].sort(), [...PHRASING_KINDS].sort(), "R86");
  assert.ok(t.action_kinds.some((k) => k.shape === "recognition"), "R87 (a)");
  assert.ok(t.deadlines.some((d) => d.defends === true), "R87 (c)");
  /* different from the first's, so a module cannot pass on one profile's values alone (R22) */
  const keys = (p, s, k) => new Set((p[s] || []).map((x) => x[k]));
  for (const [s, k] of [["legal_facts", "key"], ["procedure_guides", "kind"], ["phrasings", "phrase"]])
    for (const v of keys(t, s, k)) assert.ok(!keys(f, s, k).has(v), `${s} ${v}`);
  for (const r of t.deadlines.filter((d) => d.owed_by)) assert.ok(!f.deadlines.some((d) => d.rule === r.rule), r.rule);
  const zones = (p) => [...p.counterparties.map((c) => c.time_zone && c.time_zone.value), ...p.action_kinds.map((k) => k.venue && k.venue.time_zone && k.venue.time_zone.value)].filter(Boolean);
  for (const z of zones(t)) assert.ok(!zones(f).includes(z) && z !== f.time_zone.value, z);
  /* every T45 fact rests on TEST, carries a basis it cannot lose (R2), and the two combine with no conflict on a T45 key */
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
  const T45_PATH = /time_zone$|requesters$|templates\[\d+\]$|venue\.facts\[\d+\]$|^legal_facts|^procedure_guides|^phrasings/;
  let n = 0;
  walkFacts(get(TEST), (fact, path) => {
    if (!T45_PATH.test(path) || path === "time_zone") return;
    n++;
    const r = breakT((p) => { delete walkFacts.at(p, path).basis; });
    assert.ok(hasError(r, /templates\[\d+\]$/.test(path) ? "TEMPLATE_UNATTRIBUTED" : "BASIS_MISSING", `${path}.basis`), path);
  });
  assert.ok(n >= 16, `${n} T45 facts`);
  const both = combine([FIRST, TEST]);
  assert.ok(both.ok);
  assert.ok(!both.conflicts.some((c) => /legal_facts|procedure_guides|phrasings|templates|facts\[|time_zone\]|records_laws|owed_by|consequence|starter|defends|shape/.test(c.at)),
    JSON.stringify(both.conflicts.map((c) => c.at)));
});

test("R85 the first profile holds each sourced action fact, with its citation, or leaves it absent; never UNMEASURED", () => {
  const f = get(FIRST);
  assert.deepEqual(validate(f), { ok: true, errors: [] });
  /* each fact of the measurement, where it is, with the citation its source supports */
  for (const x of FACTS) {
    assert.ok(SOURCES[x.source] && /^https:\/\//.test(SOURCES[x.source].url) && /^[0-9a-f]{64}$/.test(SOURCES[x.source].sha256), x.source);
    const e = x.at === "deadlines" ? f.deadlines.find((d) => d.rule === x.rule) : f.legal_facts.find((l) => l.key === x.key);
    assert.ok(e, x.rule || x.key);
    if (typeof x.citation === "string") assert.equal(e.citation, x.citation, x.rule || x.key); else assert.match(e.citation, x.citation, x.rule || x.key);
    assert.deepEqual([e.status, e.basis], ["researched", M], x.rule || x.key);
    for (const k of ["owed_by", "amount", "trigger"]) if (k in x) assert.equal(e[k], x[k], `${x.rule || x.key} ${k}`);
    if ("defends" in x) assert.equal(e.defends, true, x.rule);
    if ("consequence" in x) assert.ok(e.consequence.citation === x.consequence && e.consequence.text.length > 20, x.rule);
    if ("starter" in x) assert.deepEqual([e.starts, e.starter.role], ["third_party", x.starter], x.rule);
    if ("threshold" in x) assert.equal(e.threshold.amount, x.threshold, x.key);
  }
  /* owed_by on every deadline; the Claims Act's own presentation periods are the group's */
  for (const d of f.deadlines) assert.ok(["body", "group"].includes(d.owed_by), d.rule);
  for (const r of ["claim_presentation_injury", "claim_presentation_other", "claim_suit_after_rejection", "anti_slapp_motion"])
    assert.equal(f.deadlines.find((d) => d.rule === r).owed_by, "group", r);
  /* the Brown Act demand and party participation at Tier 2, each with its advisory; public comment at Tier 1 (K2785) */
  const kind = (k) => f.action_kinds.find((x) => x.kind === k);
  assert.deepEqual([kind("brown_act_demand").tier, kind("party_participation").tier, kind("public_comment").tier], [2, 2, 1]);
  assert.match(kind("brown_act_demand").advisory, /54960\.1/);
  for (const k of ["brown_act_demand", "party_participation"]) assert.match(kind(k).advisory, /legal review/i, k);
  assert.equal(kind("public_comment").basis, "K2785");
  assert.ok(f.deadlines.filter((d) => d.applies_to === "brown_act_demand").length >= 3, "the demand and cure periods");
  /* the grand jury's responses: § 933.05's statuses, for the grand jury kind */
  const rs = f.vocabulary.response_statuses;
  assert.equal(rs.length, 6);
  for (const e of rs) { assert.equal(e.applies_to, "grand_jury"); assert.match(e.citation, /^Cal\. Penal Code § 933\.05\((a|b)\)\(\d\)$/); assert.equal(e.basis, M); }
  /* the five facts R85 names, each by its trigger */
  for (const trigger of ["recording", "paid_attendee", "serial_meeting", "pending_measure_or_candidate", "threat_letter"])
    assert.ok(f.legal_facts.some((l) => l.trigger === trigger), trigger);
  /* stages on each records law; none for a fee waiver under the CPRA */
  for (const l of f.records_laws) {
    assert.ok(l.stages && l.stages.length >= 3 && l.stages.every((s) => s.citation), l.name);
    /* the federal law was re-read live on the official text at T51 (R95; `t51-foia.test.mjs`) */
    assert.deepEqual([l.requesters.status, l.requesters.basis], ["researched", l.level === "federal" ? "2026-10-21 foia-text" : M], l.name);
  }
  const cpra = f.records_laws.find((l) => l.name === "California Public Records Act");
  assert.ok(!cpra.stages.some((s) => s.stage === "fee_waiver_request" || s.stage === "appeal"), "the CPRA has no fee waiver and no appeal");
  assert.ok(f.records_laws.find((l) => l.name === "Freedom of Information Act").stages.some((s) => s.stage === "fee_waiver_request"));
  /* FAC defends, on its published scope; HJTA as before */
  const fac = f.legal_organisations.find((o) => o.name === "First Amendment Coalition");
  assert.deepEqual([fac.defends, fac.basis], [true, `K303, ${M}`]);
  /* 2027 where a primary source states it: the federal list, with OPM's observed days; no 2027 judicial or City list */
  const y27 = f.holidays.filter((h) => h.year === 2027);
  assert.deepEqual(y27.map((h) => h.list), ["federal"]);
  const days = y27[0].days.map((d) => d.date);
  for (const d of ["2027-06-18", "2027-07-05", "2027-12-24", "2027-12-31", "2027-10-11"]) assert.ok(days.includes(d), d);
  /* M-T45-3: no office the first profile addresses keeps another zone; the field is for other states */
  assert.ok(f.counterparties.every((c) => !("time_zone" in c)) && f.action_kinds.every((k) => !k.venue || !("time_zone" in k.venue)));
  /* absent where no source supports it: no template (K2781 (6)), guide, venue fact or phrasing (R86) */
  assert.equal(f.procedure_guides, undefined);
  assert.equal(f.phrasings, undefined);
  assert.ok(f.action_kinds.every((k) => !k.templates && !k.template && !(k.venue && k.venue.facts)));
  /* never UNMEASURED on a T45 field */
  const t45 = [...f.legal_facts, ...f.records_laws.map((l) => l.requesters), ...f.deadlines.filter((d) => d.basis.includes(M)), ...y27];
  for (const x of t45) assert.notEqual(x.basis, "UNMEASURED");
  /* each worked example's rule is held with every fact its count needs (counting is civil-time's) */
  for (const ex of EXAMPLES) {
    const d = f.deadlines.find((x) => x.rule === ex.rule);
    assert.ok(d && d.citation, ex.id);
    assert.ok(ex.kind === "P" || ex.derived === true, `${ex.id}: a derived row is labelled so`);
    assert.ok(ex.negative !== ex.expected, ex.id);
    assert.equal(d.closures, ex.needs.closures, ex.id);
    for (const y of ex.needs.years) assert.ok(f.holidays.some((h) => h.list === ex.needs.closures && h.year === y), `${ex.id} ${y}`);
    if (ex.needs.weekend) assert.ok(f.weekend.days.length, ex.id);
    if (ex.needs.computation) assert.ok(f.computation.some((c) => c.key === ex.needs.computation) && d.computation === ex.needs.computation, ex.id);
  }
});

test("R86 phrasings: locale (isLocale), kind of PHRASING_KINDS, phrase of 2–100 characters on one line; a profile only adds; unioned", () => {
  assert.deepEqual(PHRASING_KINDS, ["assertion", "position", "own_benefit_ask"]);
  assert.ok(Object.isFrozen(PHRASING_KINDS) && SECTIONS.includes("phrasings"));
  const P = "phrasings[0]";
  for (const locale of ["en", "es-MX", "zh-Hant-TW"]) assert.ok(breakT((p) => { p.phrasings[0].locale = locale; }).ok, locale);
  for (const bad of ["en GB", "e", "en,fr", "", 3]) assert.ok(hasError(breakT((p) => { p.phrasings[0].locale = bad; }), "LOCALE_INVALID", `${P}.locale`), String(bad));
  for (const kind of PHRASING_KINDS) assert.ok(breakT((p) => { p.phrasings[0].kind = kind; }).ok, kind);
  for (const bad of ["breach", "", null]) assert.ok(hasError(breakT((p) => { p.phrasings[0].kind = bad; }), "KIND_INVALID", `${P}.kind`), String(bad));
  for (const good of ["ab", "x".repeat(100)]) assert.ok(breakT((p) => { p.phrasings[0].phrase = good; }).ok, good.length);
  for (const bad of ["a", " a", "x".repeat(101), "two\nlines", 3]) assert.ok(hasError(breakT((p) => { p.phrasings[0].phrase = bad; }), "VALUE_INVALID", `${P}.phrase`), JSON.stringify(bad).slice(0, 12));
  assert.ok(hasError(breakT((p) => { p.phrasings[0].removes = true; }), "UNKNOWN_SECTION", `${P}.removes`), "a profile only adds: no field removes or overrides");
  assert.ok(hasError(breakT((p) => { delete p.phrasings[0].basis; }), "BASIS_MISSING", `${P}.basis`));
  /* unioned: order kept, an equal one kept once with both bases, a new one added */
  const u = combine([TEST, other((b) => { b.phrasings.push({ locale: "fr", kind: "position", phrase: "la ville devrait", basis: "TEST" }); })]);
  assert.deepEqual(u.conflicts.filter((c) => c.at.startsWith("phrasings")), []);
  assert.deepEqual(u.view.phrasings.map((x) => [x.phrase, x.bases.length]), [...get(TEST).phrasings.map((x) => [x.phrase, 2]), ["la ville devrait", 1]]);
  assert.equal(combine([FIRST]).view.phrasings, undefined, "the first profile holds none");
});

test("R87 the fields later modules read: a kind's shape, a deadline's defends, a guide item's after, a template's name and sources, delivery_point", () => {
  assert.deepEqual(KIND_SHAPES, ["recognition"]);
  assert.ok(Object.isFrozen(KIND_SHAPES) && VENUE_FACTS.includes("delivery_point"));
  const t = get(TEST);
  const rl = kindAt(t, "recognition_letter");
  assert.ok(breakT((p) => { p.action_kinds[0].shape = "recognition"; }).ok);
  for (const bad of ["thanks", "", null]) assert.ok(hasError(breakT((p) => { p.action_kinds[rl].shape = bad; }), "KIND_INVALID", `action_kinds[${rl}].shape`), String(bad));
  /* one value per kind (R15): a profile silent on the shape does not disagree, and the giver's shape is kept */
  const s = against((b) => { delete b.action_kinds[rl].shape; });
  assert.deepEqual(s.conflicts.filter((c) => /shape/.test(c.at)), []);
  assert.equal(s.view.action_kinds.find((k) => k.kind === "recognition_letter").shape, "recognition");
  /* (c) defends: true, the group's own defence */
  const df = ruleAt(t, "defence_filing");
  assert.equal(t.deadlines[df].defends, true);
  for (const bad of [false, "yes", 1]) assert.ok(hasError(breakT((p) => { p.deadlines[df].defends = bad; }), "VALUE_INVALID", `deadlines[${df}].defends`), String(bad));
  assert.equal(combine([TEST]).view.deadlines.find((d) => d.rule === "defence_filing").defends, true);
  const dd = against((b) => { delete b.deadlines[df].defends; });
  assert.deepEqual(conflictsAt(dd), [], "a profile that is silent does not disagree");
  /* (b), (d), (e) are judged in R81, R80 and R82's tests; here, that the view carries each as written */
  const v = combine([TEST]).view;
  assert.ok(v.action_kinds.find((k) => k.kind === "recognition_letter").templates.every((x) => x.name && x.sources.length));
  assert.deepEqual(v.procedure_guides[0].items[1].after, ["denied", "none_stated"]);
  assert.ok(v.action_kinds.find((k) => k.kind === "bylaw_complaint").venue.facts.some((x) => x.fact === "delivery_point"));
});
