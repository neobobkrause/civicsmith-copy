/* jurisdictions, T45 (T45-1): the profile schema the Action layer reads (R74–R87; `BIO_Action_v0_2.md` rules 6, 7, 9,
 * 11–13, 16, 21, §5) and the first profile's sourced action facts (R85, read 2026-10-11 on the primary sources in
 * `fixtures/actions-law.mjs`). Tested at the module's interface: validate, combine, get and the exported vocabularies.
 * Every malformed field is shown with its code beside a well-formed control; every one-value fact of `combine` is shown
 * withheld, with its conflict, when two profiles disagree. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine, SECTIONS, STARTS, OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES,
  UNITS } from "../index.mjs";
import { isObj, listOr } from "../shared.mjs";
import { walkFacts, must, held, loose, at, viewOf, combinedOf } from "./helpers.mjs";
import { FACTS, EXAMPLES, SOURCES } from "./fixtures/actions-law.mjs";
/** @import { Profile, Validation, Combined, TimeZone } from "../index.mjs" */
/** @import { Fields, Value } from "../shared.mjs" */

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const M = "2026-10-11 actions-law";
/** @param {Validation} r @param {string} code @param {string} [path] @returns {boolean} */
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/** The test profile, broken by `fn` (a loose copy, written by the paths validate names), validated.
 *  @param {(p: Fields) => void} fn @returns {Validation} */
const breakT = (fn) => { const p = loose(held(TEST)); fn(p); return validate(p); };
/** The first profile, broken likewise, validated.
 *  @param {(p: Fields) => void} fn @returns {Validation} */
const breakF = (fn) => { const p = loose(held(FIRST)); fn(p); return validate(p); };
/** @param {(p: Profile) => void} fn @returns {Profile} */
const other = (fn) => { const p = held(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
/** @template T
 *  @param {T[] | undefined} arr @param {(x: T) => boolean} pred @returns {number} */
const ix = (arr, pred) => must(arr, "the list").findIndex(pred);
/** @param {Profile} p @param {string} kind */
const kindAt = (p, kind) => ix(p.action_kinds, (k) => k.kind === kind);
/** @param {Profile} p @param {string} rule */
const ruleAt = (p, rule) => ix(p.deadlines, (d) => d.rule === rule);
/** @param {Profile} p @param {string} role */
const cpAt = (p, role) => ix(p.counterparties, (c) => c.role === role);
/** @param {Profile} p @param {string} name */
const lawAt = (p, name) => ix(p.records_laws, (l) => l.name === name);
/** @param {Combined} r @returns {string[]} */
const conflictsAt = (r) => r.conflicts.map((c) => c.at);
/* the same profile twice under two ids, the second changed by fn: every conflict is fn's */
/** @param {(p: Profile) => void} fn @returns {Combined} */
const against = (fn) => combinedOf(combine([TEST, other(fn)]));
/** The first entry of a list for which `pred` holds; a thrown failure naming `what` when there is none.
 *  @template T
 *  @param {T[] | undefined} list @param {(x: T) => boolean} pred @param {string} what @returns {T} */
const find = (list, pred, what) => must(must(list, what).find(pred), what);

/* ============================================================================================== */

test("R74 a counterparty's or a venue's own time_zone, R41's form and status; one value per office and per venue", () => {
  const t = held(TEST);
  const ex = cpAt(t, "Examiner of Accounts"), cc = kindAt(t, "commitment_claim");
  const C = `counterparties[${ex}].time_zone`, V = `action_kinds[${cc}].venue.time_zone`;
  assert.equal(at(t, C).value, "America/St_Johns");
  assert.notEqual(at(t, C).value, must(t.time_zone, "time_zone").value, "the office's own zone, unlike the profile's");
  assert.equal(at(t, V).value, "America/Glace_Bay");
  /** @type {[string, string][]} */
  const owners = [[C, `counterparties[${ex}]`], [V, `action_kinds[${cc}].venue`]];
  for (const [path, of] of owners) {
    for (const good of ["UTC", "Europe/London", "America/Argentina/Buenos_Aires"]) assert.ok(breakT((p) => { at(p, path).value = good; }).ok, good);
    for (const bad of ["Mars/Base", "pacific", "", 3]) assert.ok(hasError(breakT((p) => { at(p, path).value = bad; }), "VALUE_INVALID", `${path}.value`), String(bad));
    assert.ok(hasError(breakT((p) => { at(p, of).time_zone = "UTC"; }), "VALUE_INVALID", path));
    assert.ok(hasError(breakT((p) => { delete at(p, path).status; }), "BASIS_INVALID", `${path}.status`));
    assert.ok(hasError(breakT((p) => { at(p, path).extra = 1; }), "UNKNOWN_SECTION", `${path}.extra`));
  }
  /* a real profile: sourced, never UNMEASURED (R44); a measured one lands */
  /** @param {TimeZone} z */
  const sf = (z) => breakF((p) => { at(p, "counterparties[0]").time_zone = z; });
  assert.ok(sf({ value: "America/Los_Angeles", status: "researched", basis: "M-187" }).ok);
  assert.ok(hasError(sf({ value: "America/Los_Angeles", status: "researched", basis: "UNMEASURED" }), "BASIS_INVALID", "counterparties[0].time_zone.basis"));
  /* combine: agreeing, kept with both bases; disagreeing, withheld and reported */
  const same = against(() => {});
  assert.deepEqual(same.conflicts.filter((c) => /time_zone/.test(c.at)), []);
  const v = must(find(same.view.counterparties, (c) => c.role === "Examiner of Accounts", "Examiner of Accounts").time_zone, "time_zone");
  assert.deepEqual([v.value, v.bases.map((b) => b.profile)], ["America/St_Johns", [TEST, "test-other"]]);
  const d1 = against((b) => { at(b, C).value = "UTC"; });
  assert.deepEqual(conflictsAt(d1), ["counterparties[Examiner of Accounts/Marlow County Audit Office].time_zone"]);
  assert.equal(find(d1.view.counterparties, (c) => c.role === "Examiner of Accounts", "Examiner of Accounts").time_zone, undefined);
  const d2 = against((b) => { at(b, V).value = "UTC"; });
  assert.deepEqual(conflictsAt(d2), ["action_kinds[commitment_claim].venue.time_zone"], "the zone alone, never the whole venue");
  const venue = find(d2.view.action_kinds, (k) => k.kind === "commitment_claim", "commitment_claim").venue;
  assert.ok(venue && venue.time_zone === undefined);
});

test("R75 a deadline's owed_by and consequence; a start by a third party's act names its starter; one value per rule", () => {
  const t = held(TEST);
  const cp = ruleAt(t, "complaint_particulars"), er = ruleAt(t, "examiner_reply");
  const D = `deadlines[${cp}]`, E = `deadlines[${er}]`;
  assert.deepEqual(OWED_BY, ["body", "group"]);
  assert.ok(Object.isFrozen(OWED_BY) && STARTS.includes("third_party"));
  const tcp = must(must(t.deadlines, "deadlines")[cp], D);
  assert.equal(tcp.owed_by, "group");
  assert.deepEqual(tcp.consequence, { text: "the claim shall be considered withdrawn", citation: "P.E.B.L. § 9(3)" });
  for (const ob of OWED_BY) assert.ok(breakT((p) => { at(p, D).owed_by = ob; }).ok, ob);
  for (const bad of ["office", "", true]) assert.ok(hasError(breakT((p) => { at(p, D).owed_by = bad; }), "VALUE_INVALID", `${D}.owed_by`), String(bad));
  assert.ok(breakT((p) => { delete at(p, D).owed_by; }).ok, "absent: undetermined, never refused");
  /** @type {[Value, string][]} */
  const consequences = [["deemed denied", ""], [{ text: "deemed denied" }, ".citation"], [{ citation: "§ 1" }, ".text"], [{ text: "", citation: "§ 1" }, ".text"]];
  for (const [bad, end] of consequences)
    assert.ok(hasError(breakT((p) => { at(p, D).consequence = bad; }), "VALUE_INVALID", `${D}.consequence${end}`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { at(p, `${D}.consequence`).extra = 1; }), "UNKNOWN_SECTION", `${D}.consequence.extra`));
  /* the starter is a counterparty of the profile, by role and body */
  assert.deepEqual(must(must(t.deadlines, "deadlines")[er], E).starter, { role: "Examiner of Accounts", body: "Marlow County Audit Office" });
  for (const bad of [undefined, { role: "Examiner of Accounts", body: "Elsewhere" }, { role: "Nobody", body: "Marlow County Audit Office" }, "Examiner of Accounts",
    { role: "Examiner of Accounts", body: "Marlow County Audit Office", x: 1 }])
    assert.ok(hasError(breakT((p) => { at(p, E).starter = bad; if (bad === undefined) delete at(p, E).starter; }), "ANCHOR_UNKNOWN", `${E}.starter`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { at(p, D).starter = { role: "Town Clerk", body: "City of Port Ellery" }; }), "VALUE_INVALID", `${D}.starter`), "a starter only with third_party");
  assert.ok(breakT((p) => { at(p, D).starts = "third_party"; at(p, D).starter = { role: "Town Clerk", body: "City of Port Ellery" }; }).ok);
  /* combine: each one value under rule and applies_to */
  /** @type {["owed_by" | "consequence" | "starter", ((d: Fields) => void) | null][]} */
  const fields = [["owed_by", (d) => { d.owed_by = "body"; }], ["consequence", (d) => { at(d, "consequence").text = "deemed refused"; }],
    ["starter", null]];
  for (const [f, fn] of fields) {
    const r = f === "starter"
      ? against((b) => { at(b, E).starter = { role: "Town Clerk", body: "City of Port Ellery" }; })
      : against((b) => must(fn, f)(at(b, D)));
    const rule = f === "starter" ? "examiner_reply/claim" : "complaint_particulars/claim";
    assert.deepEqual(conflictsAt(r), [`deadlines[${rule}].${f}`], f);
    assert.equal(find(r.view.deadlines, (d) => `${d.rule}/${d.applies_to}` === rule, rule)[f], undefined, `${f} withheld`);
  }
  const kept = find(against(() => {}).view.deadlines, (d) => d.rule === "complaint_particulars", "complaint_particulars");
  assert.deepEqual([kept.owed_by, must(kept.consequence, "consequence").citation], ["group", "P.E.B.L. § 9(3)"]);
});

test("R76 a records law's stages in its order (a stage it lacks absent) and who may request; one value per law", () => {
  const t = held(TEST);
  const li = lawAt(t, "Freedom of Records Act (test)"), L = `records_laws[${li}]`;
  const stages = must(must(must(t.records_laws, "records_laws")[li], L).stages, "stages");
  assert.deepEqual(stages.map((s) => s.stage), ["request", "denial", "appeal", "appeal_decision"]);
  assert.ok(!stages.some((s) => s.stage === "fee_waiver_request"), "the law lacks a fee waiver: absent");
  assert.ok(breakT((p) => { delete at(p, L).stages; }).ok, "absent: which stages it has is undetermined");
  for (const bad of [[], "request", null]) assert.ok(hasError(breakT((p) => { at(p, L).stages = bad; }), "VALUE_INVALID", `${L}.stages`), JSON.stringify(bad));
  for (const bad of ["Fee Waiver", "1st", ""]) assert.ok(hasError(breakT((p) => { at(p, `${L}.stages[0]`).stage = bad; }), "VALUE_INVALID", `${L}.stages[0].stage`), bad);
  assert.ok(breakT((p) => { at(p, `${L}.stages[0]`).stage = "a_stage_grammar_does_not_know"; }).ok, "whether action-grammar knows it is that module's check");
  assert.ok(hasError(breakT((p) => { at(p, `${L}.stages[1]`).stage = "request"; }), "VALUE_INVALID", `${L}.stages[1].stage`), "twice");
  for (const f of ["label", "citation"]) assert.ok(hasError(breakT((p) => { at(p, `${L}.stages[0]`)[f] = ""; }), "VALUE_INVALID", `${L}.stages[0].${f}`), f);
  assert.ok(hasError(breakT((p) => { at(p, `${L}.stages[0]`).rank = 1; }), "UNKNOWN_SECTION", `${L}.stages[0].rank`));
  /* requesters: who may request, a sourced fact */
  assert.ok(hasError(breakT((p) => { at(p, `${L}.requesters`).text = ""; }), "VALUE_INVALID", `${L}.requesters.text`));
  assert.ok(hasError(breakT((p) => { delete at(p, `${L}.requesters`).status; }), "BASIS_INVALID", `${L}.requesters.status`));
  assert.ok(hasError(breakT((p) => { at(p, L).requesters = "anyone"; }), "VALUE_INVALID", `${L}.requesters`));
  assert.ok(hasError(breakF((p) => { at(p, "records_laws[0].requesters").basis = "UNMEASURED"; }), "BASIS_INVALID", "records_laws[0].requesters.basis"));
  /* combine: the law unioned; its stages and requesters one value each under its name */
  const same = against(() => {});
  const law = find(same.view.records_laws, (l) => l.name === "Freedom of Records Act (test)", "Freedom of Records Act (test)");
  assert.deepEqual([must(law.stages, "stages").length, must(law.requesters, "requesters").bases.length, same.conflicts.filter((c) => c.at.startsWith("records_laws")).length], [4, 2, 0]);
  const d = against((b) => { listOr(at(b, L).stages).splice(1, 1); });
  assert.deepEqual(conflictsAt(d), ["records_laws[Freedom of Records Act (test)].stages"]);
  assert.equal(find(d.view.records_laws, (l) => l.name === "Freedom of Records Act (test)", "Freedom of Records Act (test)").stages, undefined);
  const r = against((b) => { at(b, `${L}.requesters`).text = "anyone at all"; });
  assert.deepEqual(conflictsAt(r), ["records_laws[Freedom of Records Act (test)].requesters"]);
});

test("R77 a response status may name the kind whose venue reports in it; KIND_INVALID otherwise; unioned", () => {
  const t = held(TEST);
  const rs = must(must(t.vocabulary, "vocabulary").response_statuses, "response_statuses");
  const i = ix(rs, (e) => e.applies_to === "bylaw_complaint"), A = `vocabulary.response_statuses[${i}].applies_to`;
  const S = `vocabulary.response_statuses[${i}]`;
  assert.ok(i >= 0 && rs.some((e) => !("applies_to" in e)), "one for a kind, others for every kind");
  for (const k of must(t.action_kinds, "action_kinds").map((x) => x.kind)) assert.ok(breakT((p) => { at(p, S).applies_to = k; }).ok, k);
  for (const bad of ["nowhere", "", 3]) assert.ok(hasError(breakT((p) => { at(p, S).applies_to = bad; }), "KIND_INVALID", A), String(bad));
  const v = combinedOf(combine([TEST, other((b) => { at(b, S).applies_to = "commitment_claim"; })]));
  assert.deepEqual(v.conflicts, [], "unioned, never a conflict");
  const status = must(rs[i], S).status;
  assert.deepEqual(must(must(v.view.vocabulary, "vocabulary").response_statuses, "response_statuses").filter((e) => e.status === status).map((e) => e.applies_to), ["bylaw_complaint", "commitment_claim"]);
});

test("R78 legal_organisations evaluate Tier 2 or 3 kinds, or defend a group (defends: true); ORG_PURPOSE_MISSING with neither", () => {
  const t = held(TEST);
  const d = ix(t.legal_organisations, (o) => o.defends === true), O = `legal_organisations[${d}]`;
  const org = must(must(t.legal_organisations, "legal_organisations")[d], O);
  assert.equal(org.defends, true);
  assert.ok(breakT((p) => { at(p, O).evaluates = []; }).ok, "defends with no kind evaluated");
  assert.ok(breakT((p) => { delete at(p, O).evaluates; }).ok, "defends alone");
  assert.ok(breakT((p) => { at(p, O).evaluates = ["records_request"]; }).ok, "a Tier 2 kind (records_request is Tier 2 here)");
  assert.ok(breakT((p) => { at(p, O).evaluates = ["commitment_claim", "records_request"]; at(p, O).defends = false; }).ok);
  assert.ok(hasError(breakT((p) => { at(p, O).evaluates = ["bylaw_complaint"]; }), "ORG_KIND_UNKNOWN", `${O}.evaluates[0]`), "Tier 1");
  assert.ok(hasError(breakT((p) => { at(p, O).evaluates = ["nowhere"]; }), "ORG_KIND_UNKNOWN", `${O}.evaluates[0]`));
  /** @type {((o: Fields) => void)[]} */
  const purposeless = [(o) => { o.evaluates = []; o.defends = false; }, (o) => { o.evaluates = []; delete o.defends; }, (o) => { delete o.defends; delete o.evaluates; }];
  for (const fn of purposeless)
    assert.ok(hasError(breakT((p) => fn(at(p, O))), "ORG_PURPOSE_MISSING", `${O}.evaluates`));
  for (const bad of ["yes", 1, null]) assert.ok(hasError(breakT((p) => { at(p, O).defends = bad; }), "VALUE_INVALID", `${O}.defends`), String(bad));
  /* unioned in combine (R34): a different defends is a different entry, kept */
  const u = against((b) => { at(b, O).defends = false; at(b, O).evaluates = ["commitment_claim"]; });
  assert.deepEqual(u.conflicts.filter((c) => c.at.startsWith("legal_organisations")), []);
  assert.equal(must(u.view.legal_organisations, "legal_organisations").filter((o) => o.name === org.name).length, 2);
});

test("R79 legal_facts: key, a trigger of LEGAL_FACT_TRIGGERS, statement, citation, threshold, applies_to, a sourced status; one value per key", () => {
  assert.deepEqual(LEGAL_FACT_TRIGGERS, ["paid_attendee", "recording", "threat_letter", "pending_measure_or_candidate", "serial_meeting"]);
  assert.ok(Object.isFrozen(LEGAL_FACT_TRIGGERS) && SECTIONS.includes("legal_facts"));
  const t = held(TEST);
  const L = "legal_facts[0]";
  for (const trigger of LEGAL_FACT_TRIGGERS) assert.ok(breakT((p) => { at(p, L).trigger = trigger; }).ok, trigger);
  for (const bad of ["meeting", "", null]) assert.ok(hasError(breakT((p) => { at(p, L).trigger = bad; }), "TRIGGER_UNKNOWN", `${L}.trigger`), String(bad));
  for (const bad of ["Key", "1x", ""]) assert.ok(hasError(breakT((p) => { at(p, L).key = bad; }), "VALUE_INVALID", `${L}.key`), bad);
  assert.ok(hasError(breakT((p) => { at(p, "legal_facts[1]").key = at(p, L).key; }), "VALUE_INVALID", "legal_facts[1].key"), "twice");
  for (const f of ["statement", "citation"]) assert.ok(hasError(breakT((p) => { at(p, L)[f] = " "; }), "VALUE_INVALID", `${L}.${f}`), f);
  assert.ok(breakT((p) => { at(p, L).threshold = { amount: 99.5, unit: "GBP" }; }).ok);
  for (const bad of [{ amount: 0, unit: "GBP" }, { amount: 5 }, { amount: "5", unit: "GBP" }, { amount: 5, unit: "GBP", per: "year" }, 5])
    assert.ok(hasError(breakT((p) => { at(p, L).threshold = bad; }), "VALUE_INVALID", `${L}.threshold`), JSON.stringify(bad));
  assert.ok(breakT((p) => { at(p, L).applies_to = ["bylaw_complaint", "records_request"]; }).ok);
  /** @type {[object | string, string][]} */
  const appliesTo = [[[], ""], [["nowhere"], "[0]"], ["bylaw_complaint", ""]];
  for (const [bad, end] of appliesTo) assert.ok(hasError(breakT((p) => { at(p, L).applies_to = bad; }), "VALUE_INVALID", `${L}.applies_to${end}`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { delete at(p, L).status; }), "BASIS_INVALID", `${L}.status`));
  assert.ok(hasError(breakF((p) => { at(p, "legal_facts[0]").basis = "UNMEASURED"; }), "BASIS_INVALID", "legal_facts[0].basis"), "a legal fact is sourced");
  assert.ok(hasError(breakT((p) => { at(p, L).rank = 1; }), "UNKNOWN_SECTION", `${L}.rank`));
  /* combine: one value per key */
  const facts = must(t.legal_facts, "legal_facts"), firstKey = must(facts[0], L).key;
  const same = against(() => {});
  assert.deepEqual(must(same.view.legal_facts, "legal_facts").map((f) => [f.key, f.bases.length]), facts.map((f) => [f.key, 2]));
  const d = against((b) => { at(b, L).statement = "Something else."; });
  assert.deepEqual(conflictsAt(d), [`legal_facts[${firstKey}]`]);
  assert.ok(!must(d.view.legal_facts, "legal_facts").some((f) => f.key === firstKey), "withheld");
});

test("R80 R87 procedure_guides: one sourced guide per kind, items in the profile's order with no rank, each cited, an item's after", () => {
  assert.ok(SECTIONS.includes("procedure_guides"));
  const t = held(TEST);
  const G = "procedure_guides[0]";
  assert.ok(breakT(() => {}).ok);
  for (const bad of ["nowhere", "", 3]) assert.ok(hasError(breakT((p) => { at(p, G).kind = bad; }), "KIND_INVALID", `${G}.kind`), String(bad));
  assert.ok(hasError(breakT((p) => { listOr(p.procedure_guides).push({ ...at(p, G) }); }), "VALUE_INVALID", "procedure_guides[1].kind"), "one guide per kind");
  for (const bad of [[], "route", null]) assert.ok(hasError(breakT((p) => { at(p, G).items = bad; }), "VALUE_INVALID", `${G}.items`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { delete at(p, `${G}.items[0]`).citation; }), "VALUE_INVALID", `${G}.items[0].citation`), "each item cited");
  assert.ok(hasError(breakT((p) => { at(p, `${G}.items[0]`).route = ""; }), "VALUE_INVALID", `${G}.items[0].route`));
  assert.ok(hasError(breakT((p) => { at(p, `${G}.items[0]`).expect = ""; }), "VALUE_INVALID", `${G}.items[0].expect`));
  assert.ok(breakT((p) => { delete at(p, `${G}.items[0]`).expect; }).ok, "expect is optional");
  assert.ok(hasError(breakT((p) => { at(p, `${G}.items[0]`).rank = 1; }), "UNKNOWN_SECTION", `${G}.items[0].rank`), "no rank field");
  assert.ok(hasError(breakT((p) => { delete at(p, G).status; }), "BASIS_INVALID", `${G}.status`));
  /* R87 (d): after, the outcomes after which the route applies */
  const guide = must(must(t.procedure_guides, "procedure_guides")[0], G);
  assert.deepEqual(must(guide.items[1], `${G}.items[1]`).after, ["denied", "none_stated"]);
  assert.ok(breakT((p) => { at(p, `${G}.items[1]`).after = ["an_outcome_grammar_does_not_know"]; }).ok, "action-grammar's check, not this module's");
  for (const bad of [[], ["Denied"], ["denied", "denied"], "denied"])
    assert.ok(hasError(breakT((p) => { at(p, `${G}.items[1]`).after = bad; }), "VALUE_INVALID", `${G}.items[1].after`), JSON.stringify(bad));
  /* combine: one value per kind, its items in the profile's order */
  const same = against(() => {});
  assert.deepEqual(must(must(same.view.procedure_guides, "procedure_guides")[0], G).items.map((x) => x.route), guide.items.map((x) => x.route));
  const d = against((b) => { must(must(b.procedure_guides, "procedure_guides")[0], G).items.reverse(); });
  assert.deepEqual(conflictsAt(d), ["procedure_guides[bylaw_complaint]"], "another order is another guide");
  assert.deepEqual(d.view.procedure_guides, []);
});

test("R81 R87 a kind's templates: each attributed (R40), with purpose (once per kind), name and sources; TEMPLATE_TIER3 for each; one value per purpose", () => {
  const t = held(TEST);
  const hp = kindAt(t, "recognition_letter"), K = `action_kinds[${hp}]`;
  const T0 = `${K}.templates[0]`, T1 = `${K}.templates[1]`;
  assert.deepEqual(must(must(must(t.action_kinds, "action_kinds")[hp], K).templates, "templates").map((x) => x.purpose), ["initial", "follow_up"]);
  for (const bad of ["Initial", "", null]) assert.ok(hasError(breakT((p) => { at(p, T0).purpose = bad; }), "VALUE_INVALID", `${K}.templates[0].purpose`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, T1).purpose = "initial"; }), "VALUE_INVALID", `${K}.templates[1].purpose`), "once per kind");
  assert.ok(hasError(breakT((p) => { at(p, K).templates = []; }), "VALUE_INVALID", `${K}.templates`));
  assert.ok(hasError(breakT((p) => { at(p, K).template = at(p, T0); delete at(p, `${K}.template`).purpose; }), "VALUE_INVALID", `${K}.templates`), "template or templates, not both");
  assert.ok(hasError(breakT((p) => { delete at(p, T1).approved_by; }), "TEMPLATE_UNATTRIBUTED", `${K}.templates[1].approved_by`), "R40 for each");
  assert.ok(hasError(breakT((p) => { at(p, T1).id = at(p, T0).id; }), "VALUE_INVALID", `${K}.templates[1].id`), "an id once in the profile");
  assert.ok(hasError(breakT((p) => { at(p, K).tier = 3; }), "TEMPLATE_TIER3", `${K}.templates[0]`), "R28 for each");
  assert.ok(breakT((p) => { at(p, K).tier = 3; for (const x of listOr(at(p, K).templates)) if (isObj(x)) x.use = "brief"; }).ok, "a brief may serve Tier 3");
  /* R87 (b): name, a title on one line; sources, the public sources it was written from */
  assert.ok(breakT((p) => { at(p, T0).name = "x".repeat(120); }).ok);
  for (const bad of ["x".repeat(121), "two\nlines", "", undefined])
    assert.ok(hasError(breakT((p) => { at(p, T0).name = bad; if (bad === undefined) delete at(p, T0).name; }), "VALUE_INVALID", `${K}.templates[0].name`), JSON.stringify(bad));
  for (const bad of [[], undefined, "P.E.B.L. § 11"])
    assert.ok(hasError(breakT((p) => { at(p, T0).sources = bad; if (bad === undefined) delete at(p, T0).sources; }), "VALUE_INVALID", `${K}.templates[0].sources`), JSON.stringify(bad));
  for (const bad of [{ citation: "" }, { url: "x" }, "§ 11"]) assert.ok(hasError(breakT((p) => { at(p, T0).sources = [bad]; }), "VALUE_INVALID", `${K}.templates[0].sources[0]`), JSON.stringify(bad));
  /* the single template (R25) may carry name and sources, and is read as a set of one, purpose initial */
  const br = kindAt(t, "bylaw_complaint");
  const B = `action_kinds[${br}].template`;
  assert.ok(breakT((p) => { at(p, B).name = "Complaint"; at(p, B).sources = [{ citation: "P.E.B.L. § 9" }]; }).ok);
  assert.ok(hasError(breakT((p) => { at(p, B).purpose = "initial"; }), "UNKNOWN_SECTION", `action_kinds[${br}].template.purpose`));
  const same = against(() => {});
  const vbr = find(same.view.action_kinds, (k) => k.kind === "bylaw_complaint", "bylaw_complaint");
  const vbrTemplates = must(vbr.templates, "templates"), vbrFirst = must(vbrTemplates[0], "templates[0]");
  assert.deepEqual([vbrTemplates.length, vbrFirst.purpose, vbrFirst.id], [1, "initial", must(vbr.template, "template").id]);
  const vhp = find(same.view.action_kinds, (k) => k.kind === "recognition_letter", "recognition_letter");
  assert.deepEqual(must(vhp.templates, "templates").map((x) => [x.purpose, x.name, x.bases.length]), [["initial", "Letter of recognition", 2], ["follow_up", "Follow-up letter of recognition", 2]]);
  /* one value per purpose: a difference anywhere in one template withholds that template only */
  const d = against((b) => { listOr(at(b, T1).sources).pop(); });
  assert.deepEqual(conflictsAt(d), ["action_kinds[recognition_letter].templates[follow_up]"]);
  assert.deepEqual(must(find(d.view.action_kinds, (k) => k.kind === "recognition_letter", "recognition_letter").templates, "templates").map((x) => x.purpose), ["initial"]);
  /* a single template against a set's initial: one key, compared whole */
  const m = combinedOf(combine([TEST, other((b) => {
    const k = must(must(b.action_kinds, "action_kinds")[br], `action_kinds[${br}]`);
    k.templates = [{ ...must(k.template, "template"), purpose: "initial", name: "N", sources: [{ citation: "C" }] }]; delete k.template;
  })]));
  assert.deepEqual(conflictsAt(m), ["action_kinds[bylaw_complaint].templates[initial]"]);
});

test("R82 R87 a venue's facts: fact of VENUE_FACTS (delivery_point among them), value ≤ 500, amount in R26's units, cited, sourced; one value per kind and fact", () => {
  assert.deepEqual(VENUE_FACTS, ["how_to_submit", "anonymity", "publishes", "public_listing", "speaker_limit", "comment_cutoff", "page_limit",
    "interpreter_lead", "delivery_point"]);
  assert.ok(Object.isFrozen(VENUE_FACTS));
  const t = held(TEST);
  const br = kindAt(t, "bylaw_complaint"), F = `action_kinds[${br}].venue.facts`;
  const F0 = `${F}[0]`, F1 = `${F}[1]`;
  /** The bylaw complaint venue's facts, of a loose copy.
   *  @param {Fields} p */
  const facts = (p) => listOr(at(p, `action_kinds[${br}].venue`).facts);
  assert.ok(must(must(must(must(t.action_kinds, "action_kinds")[br], `action_kinds[${br}]`).venue, "venue").facts, "facts").some((f) => f.fact === "delivery_point"), "a delivery point, held on the venue, never as the addressee");
  for (const fact of VENUE_FACTS) assert.ok(breakT((p) => { at(p, F0).fact = fact; if (fact !== "speaker_limit") facts(p).splice(1, 2); }).ok, fact);
  for (const bad of ["addressee", "", null]) assert.ok(hasError(breakT((p) => { at(p, F0).fact = bad; }), "VALUE_INVALID", `${F}[0].fact`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, F1).fact = at(p, F0).fact; }), "VALUE_INVALID", `${F}[1].fact`), "once per venue");
  assert.ok(breakT((p) => { at(p, F0).value = "x".repeat(500); }).ok);
  for (const bad of ["x".repeat(501), "", 3]) assert.ok(hasError(breakT((p) => { at(p, F0).value = bad; }), "VALUE_INVALID", `${F}[0].value`), String(bad).slice(0, 9));
  for (const units of UNITS) assert.ok(breakT((p) => { at(p, F1).amount = { amount: 2, units }; }).ok, units);
  for (const bad of [{ amount: 2, units: "minutes" }, { amount: 0, units: "hours" }, { amount: 2 }, 2])
    assert.ok(hasError(breakT((p) => { at(p, F1).amount = bad; }), "VALUE_INVALID", `${F}[1].amount`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { at(p, F0).citation = ""; }), "VALUE_INVALID", `${F}[0].citation`));
  assert.ok(hasError(breakT((p) => { delete at(p, F0).status; }), "BASIS_INVALID", `${F}[0].status`));
  assert.ok(hasError(breakT((p) => { at(p, `action_kinds[${br}].venue`).facts = {}; }), "VALUE_INVALID", F));
  assert.ok(hasError(breakF((p) => { at(p, "action_kinds[0].venue").facts = [{ fact: "anonymity", value: "v", citation: "c", status: "researched", basis: "UNMEASURED" }]; }),
    "BASIS_INVALID", "action_kinds[0].venue.facts[0].basis"));
  /* combine: one value per kind and fact; the venue itself is not withheld */
  const d = against((b) => { at(b, F0).value = "five minutes"; });
  assert.deepEqual(conflictsAt(d), ["action_kinds[bylaw_complaint].venue.facts[speaker_limit]"]);
  const v = must(find(d.view.action_kinds, (k) => k.kind === "bylaw_complaint", "bylaw_complaint").venue, "venue");
  assert.deepEqual(must(v.facts, "facts").map((f) => f.fact), ["comment_cutoff", "delivery_point"]);
});

test("R83 no field of R74–R82 names a state or assumes one state's law; the module supplies no default for any of them", () => {
  /* the vocabularies the new fields are judged by name no place */
  const PLACE = /oakland|alameda|california|cal\.|marlow|ellery|u\.s\.c|federal|state/i;
  for (const list of [OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES, STARTS]) for (const w of list) assert.ok(!PLACE.test(w), w);
  /* a profile giving none of the new fields: validate accepts it, and the view holds none of them (no default) */
  const bare = held(TEST);
  bare.id = "test-bare";
  /** @type {("legal_facts" | "procedure_guides" | "phrasings")[]} */
  const SECTIONS_T45 = ["legal_facts", "procedure_guides", "phrasings"];
  /** @type {("owed_by" | "consequence" | "defends" | "starter")[]} */
  const DEADLINE_T45 = ["owed_by", "consequence", "defends", "starter"];
  for (const s of SECTIONS_T45) delete bare[s];
  for (const d of must(bare.deadlines, "deadlines")) for (const f of DEADLINE_T45) delete d[f];
  bare.deadlines = must(bare.deadlines, "deadlines").filter((d) => d.starts !== "third_party");
  for (const l of must(bare.records_laws, "records_laws")) { delete l.stages; delete l.requesters; }
  for (const c of must(bare.counterparties, "counterparties")) delete c.time_zone;
  for (const k of must(bare.action_kinds, "action_kinds")) { delete k.shape; delete k.templates; const venue = k.venue; if (venue) { delete venue.facts; delete venue.time_zone; } }
  for (const o of must(bare.legal_organisations, "legal_organisations")) if (o.defends) { delete o.defends; o.evaluates = ["commitment_claim"]; }
  for (const e of must(must(bare.vocabulary, "vocabulary").response_statuses, "response_statuses")) delete e.applies_to;
  assert.deepEqual(validate(bare), { ok: true, errors: [] });
  const v = viewOf(combine([bare]));
  for (const s of SECTIONS_T45) assert.equal(v[s], undefined, s);
  for (const d of must(v.deadlines, "deadlines")) for (const f of DEADLINE_T45) assert.ok(!(f in d), `${d.rule}.${f}`);
  for (const l of must(v.records_laws, "records_laws")) assert.ok(!("stages" in l) && !("requesters" in l), l.name);
  for (const c of must(v.counterparties, "counterparties")) assert.ok(!("time_zone" in c), c.role);
  for (const k of must(v.action_kinds, "action_kinds")) {
    assert.ok(!("shape" in k), k.kind);
    const venue = k.venue;
    if (venue) assert.ok(!("facts" in venue) && !("time_zone" in venue), k.kind);
  }
  assert.ok(must(v.legal_organisations, "legal_organisations").every((o) => !("defends" in o)));
  assert.ok(must(must(v.vocabulary, "vocabulary").response_statuses, "response_statuses").every((e) => !("applies_to" in e)));
  /* and an empty list of profiles answers nothing at all (R16) */
  const e = viewOf(combine([]));
  /** @type {("legal_facts" | "procedure_guides" | "phrasings" | "deadlines" | "records_laws")[]} */
  const ABSENT = ["legal_facts", "procedure_guides", "phrasings", "deadlines", "records_laws"];
  for (const s of ABSENT) assert.equal(e[s], undefined, s);
});

test("R84 the test profile supplies R74–R82 (and R86, R87), with values differing from the first profile's, every basis TEST", () => {
  const t = held(TEST), f = held(FIRST);
  const tDeadlines = must(t.deadlines, "deadlines"), tKinds = must(t.action_kinds, "action_kinds");
  assert.ok(must(t.counterparties, "counterparties").some((c) => c.time_zone) && tKinds.some((k) => k.venue?.time_zone), "R74");
  assert.ok(tDeadlines.some((d) => d.owed_by === "group" && d.consequence), "R75: owed by the group, with a consequence");
  assert.ok(tDeadlines.some((d) => d.owed_by === "body"), "R75: owed by a body");
  assert.ok(tDeadlines.some((d) => d.starts === "third_party" && d.starter), "R75: a third party's start");
  assert.ok(must(t.records_laws, "records_laws").some((l) => { const stages = l.stages; return stages && !stages.some((s) => s.stage === "fee_waiver_request") && l.requesters; }), "R76: stages omitting one");
  assert.ok(must(must(t.vocabulary, "vocabulary").response_statuses, "response_statuses").some((e) => e.applies_to), "R77");
  assert.ok(must(t.legal_organisations, "legal_organisations").some((o) => o.defends === true), "R78: a defending organisation");
  assert.deepEqual([...new Set(must(t.legal_facts, "legal_facts").map((x) => x.trigger))].sort(), [...LEGAL_FACT_TRIGGERS].sort(), "R79: one legal fact per trigger");
  const guides = must(t.procedure_guides, "procedure_guides");
  assert.ok(guides.length && guides.some((g) => g.items.some((i) => i.after)), "R80, R87 (d)");
  assert.ok(tKinds.some((k) => k.templates?.length === 2), "R81: a kind with two templates");
  assert.ok(tKinds.some((k) => k.venue?.facts?.some((x) => x.fact === "delivery_point")), "R82, R87 (e)");
  assert.deepEqual([...new Set(must(t.phrasings, "phrasings").map((x) => x.kind))].sort(), [...PHRASING_KINDS].sort(), "R86");
  assert.ok(tKinds.some((k) => k.shape === "recognition"), "R87 (a)");
  assert.ok(tDeadlines.some((d) => d.defends === true), "R87 (c)");
  /* different from the first's, so a module cannot pass on one profile's values alone (R22) */
  /** @param {Profile} p @param {string} s @param {string} k */
  const keys = (p, s, k) => new Set(listOr(loose(p)[s]).map((x) => (isObj(x) ? x[k] : undefined)));
  /** @type {[string, string][]} */
  const KEYS = [["legal_facts", "key"], ["procedure_guides", "kind"], ["phrasings", "phrase"]];
  for (const [s, k] of KEYS)
    for (const v of keys(t, s, k)) assert.ok(!keys(f, s, k).has(v), `${s} ${String(v)}`);
  for (const r of tDeadlines.filter((d) => d.owed_by)) assert.ok(!must(f.deadlines, "deadlines").some((d) => d.rule === r.rule), r.rule);
  /** @param {Profile} p @returns {string[]} */
  const zones = (p) => [...must(p.counterparties, "counterparties").map((c) => c.time_zone?.value), ...must(p.action_kinds, "action_kinds").map((k) => k.venue?.time_zone?.value)].flatMap((z) => (z ? [z] : []));
  for (const z of zones(t)) assert.ok(!zones(f).includes(z) && z !== must(f.time_zone, "time_zone").value, z);
  /* every T45 fact rests on TEST, carries a basis it cannot lose (R2), and the two combine with no conflict on a T45 key */
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
  const T45_PATH = /time_zone$|requesters$|templates\[\d+\]$|venue\.facts\[\d+\]$|^legal_facts|^procedure_guides|^phrasings/;
  let n = 0;
  walkFacts(held(TEST), (fact, path) => {
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

/* the primary sources, by name, read loosely (a copy) so a fact's source can be looked up */
const SOURCE_BY_NAME = loose(SOURCES);

test("R85 the first profile holds each sourced action fact, with its citation, or leaves it absent; never UNMEASURED", () => {
  const f = held(FIRST);
  const deadlines = must(f.deadlines, "deadlines"), legalFacts = must(f.legal_facts, "legal_facts");
  const recordsLaws = must(f.records_laws, "records_laws"), kinds = must(f.action_kinds, "action_kinds"), holidays = must(f.holidays, "holidays");
  assert.deepEqual(validate(f), { ok: true, errors: [] });
  /* each fact of the measurement, where it is, with the citation its source supports */
  /** @type {("owed_by" | "amount" | "trigger")[]} */
  const PLAIN = ["owed_by", "amount", "trigger"];
  for (const x of FACTS) {
    const source = SOURCE_BY_NAME[x.source];
    assert.ok(isObj(source) && /^https:\/\//.test(String(source.url)) && /^[0-9a-f]{64}$/.test(String(source.sha256)), x.source);
    const found = x.at === "deadlines" ? deadlines.find((d) => d.rule === x.rule) : legalFacts.find((l) => l.key === x.key);
    assert.ok(found, x.rule || x.key);
    /* the entry read loosely (a copy), so a deadline's fields and a legal fact's are read alike */
    const e = loose(found);
    const citation = x.citation;
    if (typeof citation === "string") assert.equal(e.citation, citation, x.rule || x.key); else assert.match(String(e.citation), citation, x.rule || x.key);
    assert.deepEqual([e.status, e.basis], ["researched", M], x.rule || x.key);
    for (const k of PLAIN) if (k in x) assert.equal(e[k], x[k], `${x.rule || x.key} ${k}`);
    if ("defends" in x) assert.equal(e.defends, true, x.rule);
    const consequence = x.consequence, starter = x.starter, threshold = x.threshold;
    if ("consequence" in x) assert.ok(at(e, "consequence").citation === consequence && String(at(e, "consequence").text).length > 20, x.rule);
    if ("starter" in x) assert.deepEqual([e.starts, at(e, "starter").role], ["third_party", starter], x.rule);
    if ("threshold" in x) assert.equal(at(e, "threshold").amount, threshold, x.key);
  }
  /* owed_by on every deadline; the Claims Act's own presentation periods are the group's */
  for (const d of deadlines) assert.ok(["body", "group"].includes(String(d.owed_by)), d.rule);
  for (const r of ["claim_presentation_injury", "claim_presentation_other", "claim_suit_after_rejection", "anti_slapp_motion"])
    assert.equal(find(deadlines, (d) => d.rule === r, r).owed_by, "group", r);
  /* the Brown Act demand and party participation at Tier 2, each with its advisory; public comment at Tier 1 (K2785) */
  /** @param {string} k */
  const kind = (k) => find(kinds, (x) => x.kind === k, k);
  assert.deepEqual([kind("brown_act_demand").tier, kind("party_participation").tier, kind("public_comment").tier], [2, 2, 1]);
  assert.match(must(kind("brown_act_demand").advisory, "advisory"), /54960\.1/);
  for (const k of ["brown_act_demand", "party_participation"]) assert.match(must(kind(k).advisory, "advisory"), /legal review/i, k);
  assert.equal(kind("public_comment").basis, "K2785");
  assert.ok(deadlines.filter((d) => d.applies_to === "brown_act_demand").length >= 3, "the demand and cure periods");
  /* the grand jury's responses: § 933.05's statuses, for the grand jury kind */
  const rs = must(must(f.vocabulary, "vocabulary").response_statuses, "response_statuses");
  assert.equal(rs.length, 6);
  for (const e of rs) { assert.equal(e.applies_to, "grand_jury"); assert.match(e.citation, /^Cal\. Penal Code § 933\.05\((a|b)\)\(\d\)$/); assert.equal(e.basis, M); }
  /* the five facts R85 names, each by its trigger */
  for (const trigger of ["recording", "paid_attendee", "serial_meeting", "pending_measure_or_candidate", "threat_letter"])
    assert.ok(legalFacts.some((l) => l.trigger === trigger), trigger);
  /* stages on each records law; none for a fee waiver under the CPRA */
  for (const l of recordsLaws) {
    const stages = l.stages;
    assert.ok(stages && stages.length >= 3 && stages.every((s) => s.citation), l.name);
    /* the federal law was re-read live on the official text at T51 (R95; `t51-foia.test.mjs`) */
    const requesters = must(l.requesters, "requesters");
    assert.deepEqual([requesters.status, requesters.basis], ["researched", l.level === "federal" ? "2026-10-21 foia-text" : M], l.name);
  }
  const cpra = find(recordsLaws, (l) => l.name === "California Public Records Act", "California Public Records Act");
  assert.ok(!must(cpra.stages, "stages").some((s) => s.stage === "fee_waiver_request" || s.stage === "appeal"), "the CPRA has no fee waiver and no appeal");
  assert.ok(must(find(recordsLaws, (l) => l.name === "Freedom of Information Act", "Freedom of Information Act").stages, "stages").some((s) => s.stage === "fee_waiver_request"));
  /* FAC defends, on its published scope; HJTA as before */
  const fac = find(f.legal_organisations, (o) => o.name === "First Amendment Coalition", "First Amendment Coalition");
  assert.deepEqual([fac.defends, fac.basis], [true, `K303, ${M}`]);
  /* 2027 where a primary source states it: the federal list, with OPM's observed days; no 2027 judicial or City list */
  const y27 = holidays.filter((h) => h.year === 2027);
  assert.deepEqual(y27.map((h) => h.list), ["federal"]);
  const days = must(y27[0], "the 2027 list").days.map((d) => d.date);
  for (const d of ["2027-06-18", "2027-07-05", "2027-12-24", "2027-12-31", "2027-10-11"]) assert.ok(days.includes(d), d);
  /* M-T45-3: no office the first profile addresses keeps another zone; the field is for other states */
  assert.ok(must(f.counterparties, "counterparties").every((c) => !("time_zone" in c)) && kinds.every((k) => { const venue = k.venue; return !venue || !("time_zone" in venue); }));
  /* absent where no source supports it: no template (K2781 (6)), guide, venue fact or phrasing (R86) */
  assert.equal(f.procedure_guides, undefined);
  assert.equal(f.phrasings, undefined);
  assert.ok(kinds.every((k) => !k.templates && !k.template && !k.venue?.facts));
  /* never UNMEASURED on a T45 field */
  const t45 = [...legalFacts, ...recordsLaws.map((l) => must(l.requesters, "requesters")), ...deadlines.filter((d) => d.basis.includes(M)), ...y27];
  for (const x of t45) assert.notEqual(x.basis, "UNMEASURED");
  /* each worked example's rule is held with every fact its count needs (counting is civil-time's) */
  for (const ex of EXAMPLES) {
    const d = deadlines.find((x) => x.rule === ex.rule);
    assert.ok(d && d.citation, ex.id);
    assert.ok(ex.kind === "P" || ex.derived === true, `${ex.id}: a derived row is labelled so`);
    assert.ok(ex.negative !== ex.expected, ex.id);
    const needs = ex.needs;
    assert.equal(d.closures, needs.closures, ex.id);
    for (const y of needs.years) assert.ok(holidays.some((h) => h.list === needs.closures && h.year === y), `${ex.id} ${y}`);
    if (needs.weekend) assert.ok(must(f.weekend, "weekend").days.length, ex.id);
    const computation = needs.computation;
    if (computation) assert.ok(must(f.computation, "computation").some((c) => c.key === computation) && d.computation === computation, ex.id);
  }
});

test("R86 phrasings: locale (isLocale), kind of PHRASING_KINDS, phrase of 2–100 characters on one line; a profile only adds; unioned", () => {
  assert.deepEqual(PHRASING_KINDS, ["assertion", "position", "own_benefit_ask"]);
  assert.ok(Object.isFrozen(PHRASING_KINDS) && SECTIONS.includes("phrasings"));
  const P = "phrasings[0]";
  for (const locale of ["en", "es-MX", "zh-Hant-TW"]) assert.ok(breakT((p) => { at(p, P).locale = locale; }).ok, locale);
  for (const bad of ["en GB", "e", "en,fr", "", 3]) assert.ok(hasError(breakT((p) => { at(p, P).locale = bad; }), "LOCALE_INVALID", `${P}.locale`), String(bad));
  for (const kind of PHRASING_KINDS) assert.ok(breakT((p) => { at(p, P).kind = kind; }).ok, kind);
  for (const bad of ["breach", "", null]) assert.ok(hasError(breakT((p) => { at(p, P).kind = bad; }), "KIND_INVALID", `${P}.kind`), String(bad));
  for (const good of ["ab", "x".repeat(100)]) assert.ok(breakT((p) => { at(p, P).phrase = good; }).ok, String(good.length));
  for (const bad of ["a", " a", "x".repeat(101), "two\nlines", 3]) assert.ok(hasError(breakT((p) => { at(p, P).phrase = bad; }), "VALUE_INVALID", `${P}.phrase`), JSON.stringify(bad).slice(0, 12));
  assert.ok(hasError(breakT((p) => { at(p, P).removes = true; }), "UNKNOWN_SECTION", `${P}.removes`), "a profile only adds: no field removes or overrides");
  assert.ok(hasError(breakT((p) => { delete at(p, P).basis; }), "BASIS_MISSING", `${P}.basis`));
  /* unioned: order kept, an equal one kept once with both bases, a new one added */
  const u = combinedOf(combine([TEST, other((b) => { must(b.phrasings, "phrasings").push({ locale: "fr", kind: "position", phrase: "la ville devrait", basis: "TEST" }); })]));
  assert.deepEqual(u.conflicts.filter((c) => c.at.startsWith("phrasings")), []);
  assert.deepEqual(must(u.view.phrasings, "phrasings").map((x) => [x.phrase, x.bases.length]), [...must(held(TEST).phrasings, "phrasings").map((x) => [x.phrase, 2]), ["la ville devrait", 1]]);
  assert.equal(viewOf(combine([FIRST])).phrasings, undefined, "the first profile holds none");
});

test("R87 the fields later modules read: a kind's shape, a deadline's defends, a guide item's after, a template's name and sources, delivery_point", () => {
  assert.deepEqual(KIND_SHAPES, ["recognition"]);
  assert.ok(Object.isFrozen(KIND_SHAPES) && VENUE_FACTS.includes("delivery_point"));
  const t = held(TEST);
  const rl = kindAt(t, "recognition_letter");
  assert.ok(breakT((p) => { at(p, "action_kinds[0]").shape = "recognition"; }).ok);
  for (const bad of ["thanks", "", null]) assert.ok(hasError(breakT((p) => { at(p, `action_kinds[${rl}]`).shape = bad; }), "KIND_INVALID", `action_kinds[${rl}].shape`), String(bad));
  /* one value per kind (R15): a profile silent on the shape does not disagree, and the giver's shape is kept */
  const s = against((b) => { delete must(must(b.action_kinds, "action_kinds")[rl], `action_kinds[${rl}]`).shape; });
  assert.deepEqual(s.conflicts.filter((c) => /shape/.test(c.at)), []);
  assert.equal(find(s.view.action_kinds, (k) => k.kind === "recognition_letter", "recognition_letter").shape, "recognition");
  /* (c) defends: true, the group's own defence */
  const df = ruleAt(t, "defence_filing");
  assert.equal(must(must(t.deadlines, "deadlines")[df], `deadlines[${df}]`).defends, true);
  for (const bad of [false, "yes", 1]) assert.ok(hasError(breakT((p) => { at(p, `deadlines[${df}]`).defends = bad; }), "VALUE_INVALID", `deadlines[${df}].defends`), String(bad));
  assert.equal(find(viewOf(combine([TEST])).deadlines, (d) => d.rule === "defence_filing", "defence_filing").defends, true);
  const dd = against((b) => { delete must(must(b.deadlines, "deadlines")[df], `deadlines[${df}]`).defends; });
  assert.deepEqual(conflictsAt(dd), [], "a profile that is silent does not disagree");
  /* (b), (d), (e) are judged in R81, R80 and R82's tests; here, that the view carries each as written */
  const v = viewOf(combine([TEST]));
  assert.ok(must(find(v.action_kinds, (k) => k.kind === "recognition_letter", "recognition_letter").templates, "templates").every((x) => x.name && must(x.sources, "sources").length));
  assert.deepEqual(must(must(must(v.procedure_guides, "procedure_guides")[0], "procedure_guides[0]").items[1], "items[1]").after, ["denied", "none_stated"]);
  assert.ok(must(must(find(v.action_kinds, (k) => k.kind === "bylaw_complaint", "bylaw_complaint").venue, "venue").facts, "facts").some((x) => x.fact === "delivery_point"));
});
