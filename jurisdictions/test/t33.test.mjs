/* jurisdictions, T33 (T33-2): the widened rule data (R26), the calendar facts, closure lists and practice beside the
 * rule (R46–R48), fiscal years, law, proceedings, schemes, lawful demands and recurrences (R49–R54), how they combine
 * (R55), the first sourced rule set (R56) and the test profile and worked fixtures (R57); with the T33 amendments of
 * R3, R6, R7, R21, R28, R30 and R44. Tested at the module's interface: validate, combine, get. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate, combine, SECTIONS } from "../index.mjs";
import { walkFacts } from "./helpers.mjs";
import { FIXTURES, OMC_48, BROWN_72 } from "./fixtures/time-law.mjs";
import { FACTS } from "./fixtures/actions-law.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/* The test profile carries every T33 section; a case breaks one field of a fresh copy. */
const breakT = (fn) => { const p = get(TEST); fn(p); return validate(p); };
const breakF = (fn) => { const p = get(FIRST); fn(p); return validate(p); };
const other = (fn) => { const p = get(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
const dl = (p, rule) => p.deadlines.find((d) => d.rule === rule);
const venue = (p) => p.action_kinds.find((k) => k.kind === "records_request").venue;

/* ============================================================================================== */
/* R3, R6, R7: the widened spaces, vocabulary and practice.                                        */

test("R3 T33 spaces: account, object, vendor, proceeding and person are known spaces with R3's forms", () => {
  const t = get(TEST);
  for (const sp of ["account", "object", "vendor", "proceeding", "person"]) {
    assert.ok(t.spaces[sp] && t.spaces[sp].forms.length, sp);
    assert.ok(hasError(breakT((p) => { p.spaces[sp].forms[0].pattern = { re: "(" }; }), "PATTERN_INVALID", `spaces.${sp}.forms[0].pattern`), `${sp} is judged as a space`);
  }
  assert.ok(validate(t).ok);
  assert.ok(hasError(breakT((p) => { p.spaces.licence = p.spaces.person; }), "UNKNOWN_SPACE", "spaces.licence"));
  assert.ok(hasError(breakT((p) => { p.spaces.person.kinds = []; }), "UNKNOWN_SECTION", "spaces.person.kinds"), "kinds are enactment's only");
  /* one form per person scheme */
  assert.deepEqual(t.spaces.person.forms.map((f) => f.form), ["minute-person", "bar-number"]);
  assert.deepEqual(get(FIRST).spaces.person.forms.map((f) => f.form), ["legistar-person"]);
  /* the view carries them */
  const v = combine([TEST]).view;
  for (const sp of ["account", "object", "vendor", "proceeding", "person"]) assert.ok(v.spaces[sp], sp);
});

test("R6 T33 vocabulary: a code's copy and sections; amending, meeting_markers, body_variants, roster words, headers and staff titles", () => {
  for (const key of ["amending", "meeting_markers", "body_variants", "roster_words", "roster_headers", "staff_titles"]) {
    assert.ok(get(TEST).vocabulary[key].length, key);
    assert.ok(!hasError(validate(get(TEST)), "UNKNOWN_VOCABULARY"), key);
    assert.ok(hasError(breakT((p) => { p.vocabulary[key][0].pattern = { re: ")" }; }), "PATTERN_INVALID", `vocabulary.${key}[0].pattern`), key);
  }
  const C = "vocabulary.codes[0]";
  for (const copy of ["official", "codifier", "undetermined"]) assert.ok(breakT((p) => { p.vocabulary.codes[0].copy = copy; }).ok, copy);
  for (const bad of ["unofficial", "", 1]) assert.ok(hasError(breakT((p) => { p.vocabulary.codes[0].copy = bad; }), "COPY_UNKNOWN", `${C}.copy`), String(bad));
  assert.ok(breakT((p) => { delete p.vocabulary.codes[0].copy; delete p.vocabulary.codes[0].sections; }).ok, "both optional");
  for (const markers of [["letter"], ["roman", "paren_numeral", "numeral", "paren_letter", "letter"]]) assert.ok(breakT((p) => { p.vocabulary.codes[0].sections.markers = markers; }).ok);
  assert.ok(breakT((p) => { p.vocabulary.codes[0].sections.markers = []; }).ok, "no markers");
  assert.ok(breakT((p) => { p.vocabulary.codes[0].sections.markers = ["letter", "numeral", "letter", "roman", "paren_numeral"]; }).ok,
    "a kind recurs at a deeper level (K1521)");
  assert.ok(breakT((p) => { p.vocabulary.codes[0].sections.separators = ""; }).ok, "a one-part number (K1521)");
  for (const markers of [["bullet"], "letter", ["letter", 1]])
    assert.ok(hasError(breakT((p) => { p.vocabulary.codes[0].sections.markers = markers; }), "VALUE_INVALID", `${C}.sections.markers`), JSON.stringify(markers));
  assert.ok(hasError(breakT((p) => { p.vocabulary.codes[0].sections.number = { re: "(" }; }), "PATTERN_INVALID", `${C}.sections.number`));
  for (const sep of [" ", "- ", 3]) assert.ok(hasError(breakT((p) => { p.vocabulary.codes[0].sections.separators = sep; }), "VALUE_INVALID", `${C}.sections.separators`));
  assert.ok(hasError(breakT((p) => { p.vocabulary.codes[0].sections.depth = 3; }), "UNKNOWN_SECTION", `${C}.sections.depth`));
  assert.ok(hasError(breakT((p) => { p.vocabulary.codes[0].sections = "1.2.3"; }), "VALUE_INVALID", `${C}.sections`));
  for (const relation of ["amends", "adds", "repeals", "renumbers", "recodifies"]) assert.ok(breakT((p) => { p.vocabulary.amending[0].relation = relation; }).ok);
  for (const bad of ["supersedes", "", undefined]) assert.ok(hasError(breakT((p) => { p.vocabulary.amending[0].relation = bad; }), "VALUE_INVALID", "vocabulary.amending[0].relation"));
  for (const marker of ["cancelled", "special", "concurrent"]) assert.ok(breakT((p) => { p.vocabulary.meeting_markers[0].marker = marker; }).ok);
  for (const bad of ["postponed", "", undefined]) assert.ok(hasError(breakT((p) => { p.vocabulary.meeting_markers[0].marker = bad; }), "VALUE_INVALID", "vocabulary.meeting_markers[0].marker"));
  for (const bad of ["City Council", "", undefined, "1st"]) assert.ok(hasError(breakT((p) => { p.vocabulary.body_variants[0].organisation = bad; }), "VALUE_INVALID", "vocabulary.body_variants[0].organisation"));
  assert.ok(hasError(breakT((p) => { p.vocabulary.roster_words[0].organisation = "x"; }), "UNKNOWN_SECTION", "vocabulary.roster_words[0].organisation"));
  /* the first profile's Legistar markers and body variants read Legistar's own names (legistar-events §1, §5) */
  const f = get(FIRST).vocabulary;
  const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");
  const marker = (name) => f.meeting_markers.filter((e) => rx(e).test(name)).map((e) => e.marker).sort();
  assert.deepEqual(marker("*Finance and Management Committee - CANCELLED"), ["cancelled"]);
  assert.deepEqual(marker("Meeting of the Oakland City Council  - CANCELLATION"), ["cancelled"]);
  assert.deepEqual(marker("*Special Concurrent Meeting of the Oakland Redevelopment Agency/City Council"), ["concurrent", "special"]);
  assert.deepEqual(marker("*Life Enrichment Committee"), []);
  const org = (name) => (f.body_variants.find((e) => rx(e).test(name)) || {}).organisation;
  assert.equal(org("*Finance & Management Committee"), org("*Finance and Management Committee - CANCELLED"));
  assert.equal(org("*Rules & Legislation Committee"), "rules_committee");
  assert.equal(org("*Special Rules and Legislation Committee"), "rules_committee");
  assert.equal(org("* Public Works And Transportation Committee"), "public_works_committee");
  assert.equal(org("Meeting of the Oakland City Council  - CANCELLATION"), "city_council");
  assert.equal(org("Office of the Mayor Annual Recess Agenda"), undefined);
  assert.equal(get(FIRST).vocabulary.codes[0].copy, "codifier", "the OMC is served by its codifier (time-law §4)");
  assert.ok(new RegExp(`^(?:${get(FIRST).vocabulary.codes[0].sections.number.re})$`).test("2.20.070"));
  /* the printed orders doctypes measured (K1521) */
  const codes = Object.fromEntries(get(FIRST).vocabulary.codes.map((c) => [c.key, c.sections]));
  assert.deepEqual(codes.omc.markers, ["letter", "numeral", "letter", "roman", "paren_numeral"]);
  assert.deepEqual([codes.charter.separators, codes.charter.markers], ["", ["paren_letter", "paren_numeral", "paren_letter", "roman"]]);
  assert.ok(new RegExp(`^(?:${codes.charter.number.re})$`).test("200"));
});

test("R7 T33 practice: minutes_due_days with count calendar (absent) or business; the first profile's OMC 2.20.160", () => {
  for (const count of ["calendar", "business"]) assert.ok(breakT((p) => { p.practice.minutes_due_days.count = count; }).ok, count);
  assert.ok(breakT((p) => { delete p.practice.minutes_due_days.count; }).ok, "count is optional: calendar");
  for (const bad of ["working", "", 1]) assert.ok(hasError(breakT((p) => { p.practice.minutes_due_days.count = bad; }), "COUNT_UNKNOWN", "practice.minutes_due_days.count"));
  assert.deepEqual(get(FIRST).practice.minutes_due_days, { value: 10, count: "business", closures: "city", basis: "2026-10-05 time-law" });
  /* K1533: closures names one of the profile's closure lists */
  assert.ok(breakT((p) => { p.practice.minutes_due_days.closures = "court"; }).ok);
  assert.ok(breakT((p) => { delete p.practice.minutes_due_days.closures; }).ok, "absent: a business count's due is undetermined");
  for (const bad of ["nowhere", "", 3]) assert.ok(hasError(breakT((p) => { p.practice.minutes_due_days.closures = bad; }), "VALUE_INVALID", "practice.minutes_due_days.closures"), String(bad));
  assert.ok(hasError(breakT((p) => { p.holidays = p.holidays.filter((h) => h.list !== "town"); }), "VALUE_INVALID", "practice.minutes_due_days.closures"));
  assert.equal(combine([FIRST]).view.practice.minutes_due_days.closures, "city");
  const cl = combine([TEST, other((b) => { b.practice.minutes_due_days.closures = "court"; })]);
  assert.ok(cl.conflicts.some((x) => x.at === "practice.minutes_due_days"), "one value, its closures part of it");
  /* one value, its count part of it */
  const c = combine([TEST, other((b) => { b.practice.minutes_due_days.count = "business"; })]);
  assert.deepEqual(c.conflicts.map((x) => x.at), ["practice.minutes_due_days"]);
  assert.equal(c.view.practice.minutes_due_days, undefined);
  const same = combine([TEST, other((b) => { delete b.practice.minutes_due_days.count; })]);
  assert.ok(!same.conflicts.some((x) => x.at === "practice.minutes_due_days"), "absent count is calendar");
  assert.deepEqual([combine([FIRST]).view.practice.minutes_due_days.value, combine([FIRST]).view.practice.minutes_due_days.count], [10, "business"]);
});

/* ============================================================================================== */
/* R26, R28, R44: the widened deadline.                                                            */

test("R26 T33 deadlines: units and amount (days: n read as days), count with days only, direction, the anchors, roll, closures, computation, extension, tolling, observed, status", () => {
  const t = get(TEST);
  assert.ok(validate(t).ok);
  const D = "deadlines[1]";
  for (const units of ["days", "hours", "business_hours", "months", "years"]) assert.ok(breakT((p) => { p.deadlines[1].units = units; delete p.deadlines[1].count; }).ok, units);
  for (const bad of ["weeks", "", undefined]) assert.ok(hasError(breakT((p) => { p.deadlines[1].units = bad; }), "UNIT_UNKNOWN", `${D}.units`), String(bad));
  for (const bad of [0, -2, 1.5, "90", undefined]) assert.ok(hasError(breakT((p) => { p.deadlines[1].amount = bad; }), "VALUE_INVALID", `${D}.amount`), String(bad));
  assert.ok(hasError(breakT((p) => { p.deadlines[1].units = "hours"; }), "UNIT_UNKNOWN", `${D}.count`), "count with units other than days");
  assert.ok(hasError(breakT((p) => { p.deadlines[1].days = 90; }), "VALUE_INVALID", `${D}.days`), "both forms at once");
  /* the pre-T33 form stands */
  assert.equal(t.deadlines[0].days, 5);
  assert.ok(!own(t.deadlines[0], "units"));
  for (const direction of ["forward", "backward"]) assert.ok(breakT((p) => { p.deadlines[1].direction = direction; }).ok);
  assert.ok(breakT((p) => { delete p.deadlines[1].direction; }).ok, "forward when absent");
  assert.ok(hasError(breakT((p) => { p.deadlines[1].direction = "back"; }), "DIRECTION_UNKNOWN", `${D}.direction`));
  for (const starts of ["received", "filed", "act", "known", "entered", "served", "hearing"]) assert.ok(breakT((p) => { p.deadlines[1].starts = starts; }).ok, starts);
  for (const bad of ["sent", "accrual", "", undefined]) assert.ok(hasError(breakT((p) => { p.deadlines[1].starts = bad; }), "ANCHOR_UNKNOWN", `${D}.starts`), String(bad));
  for (const bad of ["yes", 1, null]) assert.ok(hasError(breakT((p) => { p.deadlines[1].roll = bad; }), "VALUE_INVALID", `${D}.roll`));
  assert.ok(hasError(breakT((p) => { p.deadlines[1].closures = "harbour"; }), "CLOSURES_UNKNOWN", `${D}.closures`));
  assert.ok(hasError(breakT((p) => { p.holidays = p.holidays.filter((h) => h.list !== "court"); }), "CLOSURES_UNKNOWN", `${D}.closures`), "a list with no entry");
  assert.ok(hasError(breakT((p) => { p.deadlines[1].computation = "ccp_12"; }), "COMPUTATION_UNKNOWN", `${D}.computation`));
  /* extension: computed by civil-time, its citation optional */
  assert.ok(breakT((p) => { delete p.deadlines[0].extension.citation; }).ok);
  assert.ok(hasError(breakT((p) => { p.deadlines[0].extension.citation = ""; }), "VALUE_INVALID", "deadlines[0].extension.citation"));
  assert.ok(hasError(breakT((p) => { p.deadlines[0].extension.from = "day 10"; }), "UNKNOWN_SECTION", "deadlines[0].extension.from"));
  /* tolling: [{when, citation}] */
  assert.ok(hasError(breakT((p) => { p.deadlines[1].tolling = [{ when: "x" }]; }), "VALUE_INVALID", `${D}.tolling[0].citation`));
  assert.ok(hasError(breakT((p) => { p.deadlines[1].tolling = "minors"; }), "VALUE_INVALID", `${D}.tolling`));
  assert.ok(hasError(breakT((p) => { p.deadlines[1].tolling[0].days = 3; }), "UNKNOWN_SECTION", `${D}.tolling[0].days`));
  /* observed: a list beside the rule, with its own status */
  assert.ok(hasError(breakT((p) => { p.deadlines[0].observed.closures = "nowhere"; }), "CLOSURES_UNKNOWN", "deadlines[0].observed.closures"));
  assert.ok(hasError(breakT((p) => { p.deadlines[0].observed = "town"; }), "VALUE_INVALID", "deadlines[0].observed"));
  assert.ok(hasError(breakT((p) => { delete p.deadlines[0].observed.status; }), "BASIS_INVALID", "deadlines[0].observed.status"));
  /* every value the test profile gives is one R26 names */
  const seen = { units: new Set(), starts: new Set(), direction: new Set() };
  for (const d of t.deadlines) { seen.units.add(d.units || "days"); seen.starts.add(d.starts); seen.direction.add(d.direction || "forward"); }
  assert.deepEqual([...seen.units].sort(), ["business_hours", "days", "hours", "months", "years"]);
  /* R75 (T45) adds the start by a third party's act */
  assert.deepEqual([...seen.starts].sort(), ["act", "entered", "filed", "hearing", "known", "received", "served", "third_party"]);
  assert.deepEqual([...seen.direction].sort(), ["backward", "forward"]);
});

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

test("R44 T33 every deadline and calendar fact carries status and a sourced basis; UNMEASURED is BASIS_INVALID there", () => {
  const facts = [
    ["deadlines[1]", (p) => p.deadlines[1]], ["deadlines[0].observed", (p) => p.deadlines[0].observed], ["weekend", (p) => p.weekend],
    ["computation[0]", (p) => p.computation[0]], ["holidays[4]", (p) => p.holidays[4]],
    ["action_kinds[0].venue.cutoff", (p) => venue(p).cutoff], ["action_kinds[0].venue.outages[0]", (p) => venue(p).outages[0]],
    ["action_kinds[0].venue.receipt", (p) => venue(p).receipt], ["fiscal_year[0]", (p) => p.fiscal_year[0]],
    ["recurrences[0]", (p) => p.recurrences[0]], ["lawful_demands[0]", (p) => p.lawful_demands[0]],
  ];
  for (const [at, of] of facts) {
    for (const status of ["researched", "ruled"]) {
      assert.ok(breakT((p) => { of(p).status = status; }).ok, `${at} ${status} TEST`);
      assert.ok(hasError(breakT((p) => { of(p).status = status; of(p).basis = "UNMEASURED"; }), "BASIS_INVALID", `${at}.basis`), `${at} ${status} UNMEASURED`);
    }
    for (const bad of ["measured", "", undefined]) assert.ok(hasError(breakT((p) => { of(p).status = bad; }), "BASIS_INVALID", `${at}.status`), `${at} ${String(bad)}`);
    assert.ok(hasError(breakT((p) => { delete of(p).basis; }), "BASIS_MISSING", `${at}.basis`), `${at} no basis`);
  }
  /* outside a test profile: researched on a measurement, ruled on a ruling */
  const F = (fn) => breakF(fn);
  assert.ok(F((p) => { dl(p, "records_response").basis = "M-190"; }).ok);
  assert.ok(hasError(F((p) => { dl(p, "records_response").basis = "K1504"; }), "BASIS_INVALID", "deadlines[0].basis"));
  assert.ok(F((p) => { dl(p, "records_response").status = "ruled"; dl(p, "records_response").basis = "K1504"; }).ok);
  assert.ok(hasError(F((p) => { dl(p, "records_response").basis = "UNMEASURED"; }), "BASIS_INVALID", "deadlines[0].basis"));
  assert.ok(hasError(F((p) => { delete dl(p, "records_response").status; }), "BASIS_INVALID", "deadlines[0].status"));
  assert.ok(hasError(F((p) => { p.weekend.basis = "TEST"; }), "BASIS_INVALID", "weekend.basis"));
});

test("R28 T33 codes: each new code is reported for its fault, and the new sections are known", () => {
  const cases = {
    UNIT_UNKNOWN: [(p) => { p.deadlines[1].units = "fortnights"; }, "deadlines[1].units"],
    DIRECTION_UNKNOWN: [(p) => { p.deadlines[1].direction = "sideways"; }, "deadlines[1].direction"],
    ANCHOR_UNKNOWN: [(p) => { p.deadlines[1].starts = "mailed"; }, "deadlines[1].starts"],
    CLOSURES_UNKNOWN: [(p) => { p.deadlines[1].closures = "none"; }, "deadlines[1].closures"],
    COMPUTATION_UNKNOWN: [(p) => { p.deadlines[1].computation = "none"; }, "deadlines[1].computation"],
    WEEKEND_INVALID: [(p) => { p.weekend.days = ["sunday"]; }, "weekend.days"],
    CHANNEL_INVALID: [(p) => { venue(p).cutoff.time = "5pm"; }, "action_kinds[0].venue.cutoff.time"],
    FISCAL_YEAR_INVALID: [(p) => { p.fiscal_year[0].start = "13-01"; }, "fiscal_year[0].start"],
    RANK_INVALID: [(p) => { p.law_ranks[0].rank = 0; }, "law_ranks[0].rank"],
    COPY_UNKNOWN: [(p) => { p.vocabulary.codes[0].copy = "draft"; }, "vocabulary.codes[0].copy"],
    FLOW_INVALID: [(p) => { p.proceeding_flows[0].kind = "nothing"; }, "proceeding_flows[0].kind"],
    SCHEME_INVALID: [(p) => { p.identifier_schemes[0].space = "nowhere"; }, "identifier_schemes[0].space"],
    DEMAND_INVALID: [(p) => { p.lawful_demands[0].covers = ["email"]; }, "lawful_demands[0].covers"],
    RECURRENCE_INVALID: [(p) => { p.recurrences[0].rrule = "FREQ=DAILY"; }, "recurrences[0].rrule"],
  };
  for (const [code, [fn, path]] of Object.entries(cases)) assert.ok(hasError(breakT(fn), code, path), code);
  for (const sec of ["weekend", "computation", "fiscal_year", "law_ranks", "instrument_key", "proceeding_kinds", "proceeding_flows",
    "identifier_schemes", "classification_schemes", "lawful_demands", "recurrences"]) {
    assert.ok(SECTIONS.includes(sec), sec);
    assert.ok(own(get(TEST), sec), sec);
  }
  assert.ok(!validate(get(TEST)).errors.some((e) => e.code === "UNKNOWN_SECTION"));
});

/* ============================================================================================== */
/* R46–R54: T33's sections.                                                                        */

test("R46 weekend {days, citation, status, basis} and computation [{key, rule, citation, status, basis}]", () => {
  for (const days of [["sat", "sun"], ["sun"], ["fri", "sat"]]) assert.ok(breakT((p) => { p.weekend.days = days; }).ok, days.join());
  for (const days of [[], ["sun", "sun"], ["Sun"], "sun", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]])
    assert.ok(hasError(breakT((p) => { p.weekend.days = days; }), "WEEKEND_INVALID", "weekend.days"), JSON.stringify(days));
  for (const bad of ["sat,sun", null, []]) assert.ok(hasError(breakT((p) => { p.weekend = bad; }), "WEEKEND_INVALID", "weekend"), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { delete p.weekend.citation; }), "VALUE_INVALID", "weekend.citation"));
  assert.ok(hasError(breakT((p) => { p.weekend.from = "2026"; }), "UNKNOWN_SECTION", "weekend.from"));
  assert.ok(breakT((p) => { delete p.weekend; }).ok, "absent: a business count is undetermined (civil-time R9), never assumed");
  assert.equal(combine([FIRST]).view.weekend.days.join(), "sat,sun");
  assert.match(get(FIRST).weekend.citation, /12a/);
  /* computation */
  assert.ok(hasError(breakT((p) => { p.computation[0].rule = "include_both"; }), "VALUE_INVALID", "computation[0].rule"));
  for (const bad of ["CCP-12", "", "1x"]) assert.ok(hasError(breakT((p) => { p.computation[0].key = bad; }), "VALUE_INVALID", "computation[0].key"));
  assert.ok(hasError(breakT((p) => { p.computation.push({ ...p.computation[0] }); }), "VALUE_INVALID", "computation[1].key"), "a key twice");
  assert.ok(hasError(breakT((p) => { delete p.computation[0].citation; }), "VALUE_INVALID", "computation[0].citation"));
  /* the Monday safe harbour is a rule of its own (applies_on, due_at; K1514), never a computation */
  assert.ok(hasError(breakT((p) => { p.computation[0].rule = "monday_prior_friday_noon"; }), "VALUE_INVALID", "computation[0].rule"));
  assert.deepEqual(get(FIRST).computation.map((c) => [c.key, c.rule, c.citation]),
    [["ccp_12", "exclude_first_include_last", "Cal. Code Civ. Proc. § 12; Cal. Gov. Code § 6800"]]);
});

test("R47 closure lists: a holiday entry's list and citation; a year once per list and offices; a rule's closures and observed name lists", () => {
  const t = get(TEST);
  assert.deepEqual(t.holidays.filter((h) => h.list).map((h) => h.list), ["court", "town"]);
  for (const bad of ["Court", "", 3]) assert.ok(hasError(breakT((p) => { p.holidays[4].list = bad; }), "HOLIDAY_INVALID", "holidays[4].list"), String(bad));
  assert.ok(hasError(breakT((p) => { delete p.holidays[4].citation; }), "VALUE_INVALID", "holidays[4].citation"), "a list cites what makes it");
  /* a year once for each list and offices; the same year in two lists, or in a list and the office calendar, is fine */
  assert.ok(hasError(breakT((p) => { p.holidays.push({ ...p.holidays[4] }); }), "HOLIDAY_INVALID", "holidays[6].year"));
  assert.ok(breakT((p) => { p.holidays.push({ ...p.holidays[4], list: "registry" }); }).ok);
  assert.ok(breakT((p) => { p.holidays.push({ ...p.holidays[4], offices: ["Town Clerk"] }); }).ok, "a list's year for one office");
  /* the rule counts on one list; the practice beside it on another, never as the rule */
  const r = dl(t, "records_answer");
  assert.deepEqual([r.closures, r.observed.closures], ["town", "court"]);
  const f = get(FIRST);
  const cpra = dl(f, "records_response");
  assert.deepEqual([cpra.closures, cpra.observed.closures], ["judicial", "city"], "K1504 (1): the law's list, the portal's beside it");
  /* the view keeps each list's year, with its list and citation */
  const v = combine([FIRST]).view;
  const lists = v.holidays.filter((h) => h.list).map((h) => [h.list, h.year, h.citation]);
  /* R85 (T45, M-T45-1): 2027 only where a primary source states it, the federal list (OPM's schedule under 5 U.S.C. § 6103) */
  assert.deepEqual(lists.map((x) => `${x[0]} ${x[1]}`), ["judicial 2026", "city 2026", "federal 2026", "federal 2027", "judicial 2018", "judicial 2020"]);
  assert.ok(lists.every((x) => typeof x[2] === "string" && x[2].length));
  assert.deepEqual(v.deadlines.find((d) => d.rule === "records_response").observed.closures, "city");
});

test("R48 a venue's channel facts: cutoff {time, citation, status, basis}, outages [{from, to}], receipt {rule: next_business_day, citation}", () => {
  const V = "action_kinds[0].venue";
  for (const time of ["00:00", "16:30", "23:59"]) assert.ok(breakT((p) => { venue(p).cutoff.time = time; }).ok, time);
  for (const time of ["24:00", "4:30", "", null]) assert.ok(hasError(breakT((p) => { venue(p).cutoff.time = time; }), "CHANNEL_INVALID", `${V}.cutoff.time`), String(time));
  assert.ok(hasError(breakT((p) => { venue(p).cutoff.citation = ""; }), "CHANNEL_INVALID", `${V}.cutoff.citation`));
  assert.ok(hasError(breakT((p) => { venue(p).cutoff = "16:30"; }), "CHANNEL_INVALID", `${V}.cutoff`));
  for (const [f, t] of [["2026-03-02T09:00:00Z", "2026-03-02T09:00:00Z"], ["2026-03-02T10:00Z", "2026-03-02T09:00Z"]])
    assert.ok(hasError(breakT((p) => { Object.assign(venue(p).outages[0], { from: f, to: t }); }), "CHANNEL_INVALID", `${V}.outages[0]`), `${f} ${t}`);
  for (const bad of ["2026-03-02", "2026-03-02T09:00", "2026-02-30T09:00Z", "yesterday"])
    assert.ok(hasError(breakT((p) => { venue(p).outages[0].from = bad; }), "CHANNEL_INVALID", `${V}.outages[0].from`), bad);
  assert.ok(breakT((p) => { venue(p).outages[0].to = "2026-03-02T17:30:00.5+00:00"; }).ok, "an offset other than the zone's");
  assert.ok(hasError(breakT((p) => { venue(p).outages = {}; }), "CHANNEL_INVALID", `${V}.outages`));
  for (const bad of ["actual_day", "", undefined]) assert.ok(hasError(breakT((p) => { venue(p).receipt.rule = bad; }), "CHANNEL_INVALID", `${V}.receipt.rule`));
  assert.ok(hasError(breakT((p) => { delete venue(p).receipt.citation; }), "CHANNEL_INVALID", `${V}.receipt.citation`));
  assert.ok(breakT((p) => { delete venue(p).cutoff; delete venue(p).outages; delete venue(p).receipt; }).ok, "absent: the actual day and instant stand");
  /* the first profile: the City Attorney's guide on the records portal (K1504 (3)); no cutoff is sourced, so none */
  const fv = venue(get(FIRST));
  assert.deepEqual([fv.receipt.rule, fv.receipt.status], ["next_business_day", "researched"]);
  assert.match(fv.receipt.citation, /2025-04-29/);
  assert.equal(fv.cutoff, undefined);
  /* the view carries them on the venue, beside its hours */
  const tv = combine([TEST]).view.action_kinds.find((k) => k.kind === "records_request").venue;
  assert.deepEqual([tv.cutoff.time, tv.receipt.rule, tv.outages.length, tv.how], ["16:30", "next_business_day", 1, "email"]);
});

test("R49 fiscal_year: per body (a counterparty body or *), start MM-DD, named_by start or end, a label template", () => {
  assert.ok(validate(get(TEST)).ok);
  const at = "fiscal_year[1]";
  for (const bad of ["Nowhere Board", "", undefined]) assert.ok(hasError(breakT((p) => { p.fiscal_year[1].body = bad; }), "FISCAL_YEAR_INVALID", `${at}.body`), String(bad));
  assert.ok(hasError(breakT((p) => { p.fiscal_year[1].body = "*"; }), "FISCAL_YEAR_INVALID", `${at}.body`), "a body keeps one fiscal year");
  for (const bad of ["02-30", "7-1", "07/01", "13-01", ""]) assert.ok(hasError(breakT((p) => { p.fiscal_year[1].start = bad; }), "FISCAL_YEAR_INVALID", `${at}.start`), bad);
  assert.ok(breakT((p) => { p.fiscal_year[1].start = "02-29"; }).ok, "a day some year has");
  assert.ok(hasError(breakT((p) => { p.fiscal_year[1].named_by = "middle"; }), "FISCAL_YEAR_INVALID", `${at}.named_by`));
  for (const bad of ["FY", "FY{year}", "", 2026]) assert.ok(hasError(breakT((p) => { p.fiscal_year[1].label = bad; }), "FISCAL_YEAR_INVALID", `${at}.label`), String(bad));
  for (const good of ["FY{end}", "{start}-{end2}", "{start2}/{end2}"]) assert.ok(breakT((p) => { p.fiscal_year[1].label = good; }).ok, good);
});

test("R50 law_ranks, instrument_key and a standard source's key", () => {
  assert.ok(hasError(breakT((p) => { p.law_ranks.push({ ...p.law_ranks[0], rank: 4 }); }), "RANK_INVALID", "law_ranks[3]"), "a kind and level twice");
  assert.ok(breakT((p) => { p.law_ranks.push({ ...p.law_ranks[0], level: "federal" }); }).ok);
  for (const [f, bad] of [["kind", "custom"], ["level", "local"], ["rank", 1.5], ["rank", "1"]])
    assert.ok(hasError(breakT((p) => { p.law_ranks[0][f] = bad; }), "RANK_INVALID", `law_ranks[0].${f}`), `${f} ${bad}`);
  for (const bad of ["XX-Port", "", "-x"]) assert.ok(hasError(breakT((p) => { p.instrument_key.jurisdiction = bad; }), "VALUE_INVALID", "instrument_key.jurisdiction"));
  assert.ok(hasError(breakT((p) => { p.instrument_key = "xx"; }), "VALUE_INVALID", "instrument_key"));
  assert.ok(hasError(breakT((p) => { delete p.instrument_key.basis; }), "BASIS_MISSING", "instrument_key.basis"));
  for (const bad of ["Selectboard", "", "a b"]) assert.ok(hasError(breakT((p) => { p.standard_sources[0].key = bad; }), "VALUE_INVALID", "standard_sources[0].key"));
  const v = combine([TEST]).view;
  assert.deepEqual([v.instrument_key.jurisdiction, v.instrument_key.profile], ["xx-port-ellery", TEST]);
  assert.equal(v.standard_sources[0].key, "selectboard");
});

test("R51 proceeding_kinds and proceeding_flows: ordered stages, each reached by event kinds", () => {
  for (const fk of ["court", "commission", "grand_jury", "auditor", "other"]) assert.ok(breakT((p) => { p.proceeding_kinds[0].forum_kind = fk; }).ok);
  assert.ok(hasError(breakT((p) => { p.proceeding_kinds[0].forum_kind = "tribunal"; }), "VALUE_INVALID", "proceeding_kinds[0].forum_kind"));
  assert.ok(hasError(breakT((p) => { p.proceeding_kinds[1].kind = "commitment_suit"; }), "DUPLICATE_KIND", "proceeding_kinds[1].kind"));
  const F = "proceeding_flows[0]";
  assert.ok(hasError(breakT((p) => { p.proceeding_flows.push({ ...p.proceeding_flows[0] }); }), "FLOW_INVALID", "proceeding_flows[1].kind"), "one flow per kind");
  assert.ok(hasError(breakT((p) => { p.proceeding_flows[0].stages[2].stage = "filed"; }), "FLOW_INVALID", `${F}.stages[2].stage`), "a stage twice");
  assert.ok(hasError(breakT((p) => { p.proceeding_flows[0].stages = []; }), "FLOW_INVALID", `${F}.stages`));
  assert.ok(hasError(breakT((p) => { p.proceeding_flows[0].stages[0].reached_by = []; }), "FLOW_INVALID", `${F}.stages[0].reached_by`));
  assert.ok(hasError(breakT((p) => { delete p.proceeding_flows[0].stages[0].label; }), "FLOW_INVALID", `${F}.stages[0].label`));
  assert.ok(hasError(breakT((p) => { delete p.proceeding_kinds; }), "FLOW_INVALID", `${F}.kind`), "a flow for no kind");
  assert.deepEqual(combine([TEST]).view.proceeding_flows[0].stages.map((s) => s.stage), ["filed", "heard", "decided"], "order kept");
});

test("R52 identifier_schemes name a space, form and systems of the profile; classification_schemes a kind and codes", () => {
  const I = "identifier_schemes[0]";
  assert.ok(hasError(breakT((p) => { p.identifier_schemes[0].form = "nothing"; }), "SCHEME_INVALID", `${I}.form`));
  assert.ok(hasError(breakT((p) => { p.identifier_schemes[0].systems = ["nowhere.record"]; }), "SCHEME_INVALID", `${I}.systems[0]`));
  assert.ok(hasError(breakT((p) => { p.identifier_schemes[0].entity_kinds = []; }), "SCHEME_INVALID", `${I}.entity_kinds`));
  assert.ok(hasError(breakT((p) => { p.identifier_schemes[1].scheme = "ellery_person"; }), "SCHEME_INVALID", "identifier_schemes[1].scheme"));
  assert.ok(breakT((p) => { delete p.identifier_schemes[0].form; delete p.identifier_schemes[0].systems; }).ok);
  const C = "classification_schemes[0]";
  for (const kind of ["fund", "organisation", "account", "object", "program", "function"]) assert.ok(breakT((p) => { p.classification_schemes[0].kind = kind; }).ok);
  assert.ok(hasError(breakT((p) => { p.classification_schemes[0].kind = "department"; }), "SCHEME_INVALID", `${C}.kind`));
  assert.ok(hasError(breakT((p) => { p.classification_schemes[0].codes.push({ code: "100-01", label: "Again" }); }), "SCHEME_INVALID", `${C}.codes[2].code`));
  assert.ok(hasError(breakT((p) => { p.classification_schemes[0].codes[0] = { code: "1" }; }), "SCHEME_INVALID", `${C}.codes[0]`));
  /* the first profile's Legistar person scheme: its PersonId form and its system (T34's body and office schemes follow, R61) */
  assert.deepEqual(get(FIRST).identifier_schemes[0], { scheme: "legistar_person_id", label: "Legistar PersonId", entity_kinds: ["person"],
    space: "person", form: "legistar-person", systems: ["oakland.legistar"], basis: "2026-10-05 legistar-events" });
});

test("R53 lawful_demands: kind, label, covers from home_address, phone, other, within in R26's units, citation", () => {
  const D = "lawful_demands[0]";
  for (const bad of [[], ["home_address", "home_address"], ["photo"]]) assert.ok(hasError(breakT((p) => { p.lawful_demands[0].covers = bad; }), "DEMAND_INVALID", `${D}.covers`));
  for (const bad of [{ amount: 0, units: "days" }, { amount: 2, units: "weeks" }, { amount: 2 }, "48h", { amount: 2, units: "days", count: "business" }])
    assert.ok(hasError(breakT((p) => { p.lawful_demands[0].within = bad; }), "DEMAND_INVALID", `${D}.within`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { p.lawful_demands.push({ ...p.lawful_demands[0] }); }), "DEMAND_INVALID", "lawful_demands[1].kind"));
  assert.ok(hasError(breakT((p) => { p.lawful_demands[0].kind = "Officer"; }), "DEMAND_INVALID", `${D}.kind`));
  /* K1493: Gov. Code §7928.215, an official's home address or phone, within 48 hours */
  assert.deepEqual(get(FIRST).lawful_demands.map((d) => [d.citation, d.covers, d.within, d.status, d.basis]),
    [["Cal. Gov. Code § 7928.215", ["home_address", "phone"], { amount: 48, units: "hours" }, "ruled", "K1493"]]);
});

test("R54 recurrences: an RRULE in civil-time's subset, dtstart a local date-time, with citation and status", () => {
  const R = "recurrences[0]";
  for (const rr of ["FREQ=WEEKLY", "FREQ=MONTHLY;BYDAY=-1FR", "FREQ=MONTHLY;BYMONTHDAY=1,15", "FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=1",
    "FREQ=YEARLY;INTERVAL=1;UNTIL=20270101T000000Z", "RRULE:FREQ=WEEKLY;BYDAY=TU"])
    assert.ok(breakT((p) => { p.recurrences[0].rrule = rr; }).ok, rr);
  for (const rr of ["FREQ=DAILY", "FREQ=WEEKLY;COUNT=10", "FREQ=WEEKLY;BYHOUR=9", "FREQ=WEEKLY;BYMONTH=1", "BYDAY=TU", "FREQ=WEEKLY;FREQ=MONTHLY",
    "FREQ=WEEKLY;INTERVAL=0", "FREQ=WEEKLY;BYDAY=TUE", "FREQ=MONTHLY;BYMONTHDAY=32", "FREQ=WEEKLY;UNTIL=soon", "", "FREQ"])
    assert.ok(hasError(breakT((p) => { p.recurrences[0].rrule = rr; }), "RECURRENCE_INVALID", `${R}.rrule`), rr);
  for (const bad of ["2026-01-13", "2026-01-13T19:00Z", "2026-02-30T19:00", "19:00"])
    assert.ok(hasError(breakT((p) => { p.recurrences[0].dtstart = bad; }), "RECURRENCE_INVALID", `${R}.dtstart`), bad);
  assert.ok(hasError(breakT((p) => { delete p.recurrences[0].citation; }), "VALUE_INVALID", `${R}.citation`));
});

/* ============================================================================================== */
/* R55: how T33's facts combine.                                                                   */

test("R55 combine: T33's one-value facts withheld and reported when profiles disagree, kept with every basis when they agree; the rest unioned", () => {
  const same = combine([TEST, other((b) => { b.weekend.basis = "TEST"; })]);
  assert.deepEqual(same.conflicts, [], JSON.stringify(same.conflicts.map((c) => c.at)));
  assert.deepEqual(same.view.weekend.bases.map((x) => x.profile), [TEST, "test-other"]);
  assert.equal(same.view.recurrences.length, get(TEST).recurrences.length, "equal entries kept once");
  const changes = {
    weekend: (b) => { b.weekend.days = ["sat", "sun"]; },
    "computation[clear_days]": (b) => { b.computation[0].citation = "Other § 1"; },
    "holidays[2026 list=court]": (b) => { b.holidays[4].days.pop(); },
    "action_kinds[records_request].venue.cutoff": (b) => { venue(b).cutoff.time = "17:00"; },
    "action_kinds[records_request].venue.receipt": (b) => { venue(b).receipt.citation = "Other § 2"; },
    "fiscal_year[*]": (b) => { b.fiscal_year[0].start = "07-01"; },
    "law_ranks[statute/state]": (b) => { b.law_ranks[0].rank = 2; },
    instrument_key: (b) => { b.instrument_key.jurisdiction = "xx-other"; },
    "proceeding_flows[commitment_suit]": (b) => { b.proceeding_flows[0].stages.pop(); },
    "lawful_demands[officer_privacy]": (b) => { b.lawful_demands[0].within.amount = 10; },
    "deadlines[claim_notice/claim].roll": (b) => { dl(b, "claim_notice").roll = false; },
    "deadlines[claim_notice/claim].closures": (b) => { dl(b, "claim_notice").closures = "town"; },
    "deadlines[claim_notice/claim].tolling": (b) => { dl(b, "claim_notice").tolling = []; },
    "deadlines[claim_notice/claim].units": (b) => { const d = dl(b, "claim_notice"); d.units = "months"; d.amount = 3; delete d.count; },
    "deadlines[records_answer/records_request].observed": (b) => { dl(b, "records_answer").observed.closures = "town"; },
    "deadlines[claim_notice/claim].status": (b) => { dl(b, "claim_notice").status = "researched"; },
  };
  for (const [at, fn] of Object.entries(changes)) {
    const c = combine([TEST, other(fn)]);
    assert.ok(c.ok, at);
    assert.ok(c.conflicts.some((x) => x.at === at), `${at}: ${c.conflicts.map((x) => x.at)}`);
    for (const x of c.conflicts) assert.ok(x.values.length >= 2 && typeof x.says === "string" && x.says.length > 20, x.at);
  }
  const w = combine([TEST, other(changes.weekend)]);
  assert.equal(w.view.weekend, undefined);
  const f = combine([TEST, other(changes["fiscal_year[*]"])]);
  assert.deepEqual(f.view.fiscal_year.map((x) => x.body), ["Port Ellery Harbour District"], "the other body's agreed year stands");
  const d = combine([TEST, other(changes["deadlines[claim_notice/claim].roll"])]).view.deadlines.find((x) => x.rule === "claim_notice");
  assert.equal(d.roll, undefined);
  assert.equal(d.amount, 90, "the rule's other facts stand");
  /* unioned: outages, proceeding kinds, schemes, recurrences, the new vocabulary keys */
  const u = combine([TEST, other((b) => {
    venue(b).outages.push({ from: "2026-04-01T09:00Z", to: "2026-04-01T10:00Z", status: "researched", basis: "TEST" });
    b.proceeding_kinds.push({ kind: "other_suit", label: "other", forum_kind: "other", basis: "TEST" });
    b.identifier_schemes.push({ scheme: "other_scheme", label: "other", entity_kinds: ["person"], space: "person", basis: "TEST" });
    b.classification_schemes.push({ scheme: "other_codes", label: "other", kind: "program", basis: "TEST" });
    b.recurrences.push({ body: "Selectboard", rrule: "FREQ=YEARLY", dtstart: "2026-05-01T10:00", citation: "x", status: "ruled", basis: "TEST" });
    b.vocabulary.roster_words.push({ pattern: { re: "Officers" }, basis: "TEST" });
  })]);
  assert.deepEqual(u.conflicts, []);
  const uv = u.view;
  assert.equal(uv.action_kinds.find((k) => k.kind === "records_request").venue.outages.length, 2);
  const t0 = get(TEST);
  for (const sec of ["proceeding_kinds", "identifier_schemes", "classification_schemes", "recurrences"])
    assert.equal(uv[sec].length, t0[sec].length + 1, sec);
  assert.equal(uv.vocabulary.roster_words.length, get(TEST).vocabulary.roster_words.length + 1);
  /* a deadline written `days: n` and one written `units: days, amount: n` agree (R26) */
  const legacy = combine([TEST, other((b) => { const r = dl(b, "records_answer"); delete r.days; r.units = "days"; r.amount = 5; })]);
  assert.ok(!legacy.conflicts.some((x) => x.at.startsWith("deadlines[records_answer")));
  const ra = legacy.view.deadlines.find((x) => x.rule === "records_answer");
  assert.deepEqual([ra.units, ra.amount, ra.days], ["days", 5, 5]);
  /* every T33 fact in the view carries its profile and bases (R13) */
  walkFacts(combine([FIRST, TEST]).view, (fact, path) => assert.ok(fact.profile && Array.isArray(fact.bases), path));
});

/* ============================================================================================== */
/* R56, R57, R21, R30: the first sourced rule set and the fixtures.                                */

test("R56 the first profile's sourced rule set: each rule with its primary source, researched, on the dated measurement", () => {
  const f = get(FIRST);
  const rows = Object.fromEntries(f.deadlines.map((d) => [d.rule, d]));
  const want = {
    records_response: ["records_request", "days", 10, "calendar", "forward", "received", /7922\.535\(a\)/],
    immediate_disclosure: ["records_request", "days", 3, "business", "forward", "received", /2\.20\.230/],
    agenda_posting_regular: ["public_comment", "hours", 72, undefined, "backward", "act", /54954\.2\(a\)\(1\)/],
    special_meeting_notice: ["public_comment", "hours", 24, undefined, "backward", "act", /54956\(a\)/],
    omc_special_meeting_notice: ["public_comment", "business_hours", 48, undefined, "backward", "act", /2\.20\.070$/],
    omc_special_meeting_monday: ["public_comment", "days", 3, "calendar", "backward", "act", /2\.20\.070\(C\)/],
    claim_presentation_injury: ["claim", "months", 6, undefined, "forward", "act", /911\.2\(a\)/],
    claim_presentation_other: ["claim", "years", 1, undefined, "forward", "act", /911\.2\(a\)/],
    claim_suit_after_rejection: ["claim", "months", 6, undefined, "forward", "served", /945\.6\(a\)\(1\)/],
    foia_response: ["records_request", "days", 20, "business", "forward", "received", /552\(a\)\(6\)\(A\)\(i\)/],
  };
  /* R56's set, and beyond it only R85's (T45), each on its own measurement (R85's test, t45.test.mjs) */
  const T45_RULES = FACTS.filter((x) => x.at === "deadlines").map((x) => x.rule);
  assert.deepEqual(Object.keys(rows).sort(), [...Object.keys(want), ...T45_RULES].sort());
  for (const [rule, [applies, units, amount, count, direction, starts, cite]] of Object.entries(want)) {
    const d = rows[rule];
    assert.deepEqual([d.applies_to, d.units, d.amount, d.count, d.direction, d.starts], [applies, units, amount, count, direction, starts], rule);
    assert.match(d.citation, cite, rule);
    /* FOIA's stated consequence (R75) was read on T45's measurement, named beside time-law's */
    assert.deepEqual([d.status, d.basis], ["researched", rule === "foia_response" ? "2026-10-05 time-law, 2026-10-11 actions-law" : "2026-10-05 time-law"], rule);
  }
  /* CPRA: CCP §12, rolling on CCP §12a's closures (the §135 list), the 14-day extension by written notice, the
     portal's City list observed beside it (K1504 (1)) */
  const cpra = rows.records_response;
  assert.deepEqual([cpra.roll, cpra.closures, cpra.computation], [true, "judicial", "ccp_12"]);
  assert.deepEqual([cpra.extension.days, cpra.extension.count], [14, "calendar"]);
  assert.match(cpra.extension.citation, /7922\.535\(b\)/);
  assert.equal(cpra.observed.closures, "city");
  assert.equal(rows.omc_special_meeting_notice.closures, "city", "an Oakland ordinance's holidays are the City's list (K1504 (5))");
  /* its Monday safe harbour: its own entry, for a Monday meeting, due at noon (K1514) */
  assert.deepEqual([rows.omc_special_meeting_monday.applies_on, rows.omc_special_meeting_monday.due_at], [["mon"], "12:00"]);
  assert.equal(rows.immediate_disclosure.closures, "city");
  assert.deepEqual([rows.foia_response.closures, rows.foia_response.extension.days, rows.foia_response.extension.count], ["federal", 10, "business"]);
  assert.equal(rows.foia_response.tolling.length, 2);
  for (const r of ["agenda_posting_regular", "special_meeting_notice"]) assert.equal(rows[r].roll, undefined, `${r}: clock hours do not roll`);
  /* the closure lists, the weekend and the computation, each cited */
  const lists = Object.fromEntries(f.holidays.filter((h) => h.list && h.year === 2026).map((h) => [h.list, h]));
  assert.match(lists.judicial.citation, /§ 135/);
  assert.match(lists.federal.citation, /6103\(a\)/);
  const dates = (h) => h.days.map((d) => d.date.slice(5));
  assert.ok(!dates(lists.judicial).includes("10-12"), "Columbus Day is no judicial holiday (AB 268)");
  assert.ok(dates(lists.judicial).includes("09-25"), "Native American Day is one");
  assert.ok(!dates(lists.city).includes("09-25") && !dates(lists.city).includes("10-12"), "the City's list has neither (M-190)");
  assert.ok(dates(lists.federal).includes("10-12") && dates(lists.federal).includes("11-11"));
  assert.deepEqual(dates(lists.city), dates(f.holidays.find((h) => h.basis === "M-190")), "the City list is M-190's days");
  /* records_response's five counterparties, re-based on their primary sources; the records venues sourced */
  /* each on its primary source; T34 adds the Legistar read its identifiers rest on (R61) */
  for (const c of f.counterparties) assert.match(c.basis, /^2026-10-05 time-law(, 2026-10-05 legistar-events)?$/, c.role);
  for (const k of ["records_request", "records_petition"]) assert.equal(f.action_kinds.find((x) => x.kind === k).venue.basis, "2026-10-05 time-law", k);
  assert.equal(venue(f).receipt.rule, "next_business_day");
  /* nothing in a deadline or calendar fact rests on UNMEASURED (R44) */
  walkFacts(f, (fact, path) => { if (fact.status) assert.notEqual(fact.basis, "UNMEASURED", path); });
});

test("R57 the test profile supplies every T33 section and field, unlike the first profile's", () => {
  const t = get(TEST), f = get(FIRST);
  for (const sec of ["weekend", "computation", "fiscal_year", "law_ranks", "instrument_key", "proceeding_kinds", "proceeding_flows",
    "identifier_schemes", "classification_schemes", "lawful_demands", "recurrences"]) {
    assert.ok(own(t, sec), sec);
    if (own(f, sec)) assert.notDeepEqual(t[sec], f[sec], sec);
  }
  for (const key of ["amending", "meeting_markers", "body_variants", "roster_words", "roster_headers", "staff_titles"]) assert.ok(t.vocabulary[key].length, key);
  for (const field of ["units", "amount", "count", "direction", "roll", "closures", "computation", "extension", "tolling", "observed"])
    assert.ok(t.deadlines.some((d) => own(d, field)), field);
  assert.ok(t.deadlines.some((d) => own(d, "extension") && own(d.extension, "citation")));
  assert.ok(t.holidays.filter((h) => h.list).length >= 2, "two closure lists");
  assert.ok(t.deadlines.some((d) => d.closures && d.observed && d.closures !== d.observed.closures), "a rule naming one list, observing the other");
  const v = venue(t);
  for (const f2 of ["cutoff", "outages", "receipt"]) assert.ok(own(v, f2), f2);
  assert.ok(t.lawful_demands.length >= 1);
  assert.ok(t.vocabulary.codes.some((c) => c.copy && c.sections));
  assert.ok(t.standard_sources.some((s) => s.key));
  for (const sp of ["account", "object", "vendor", "proceeding", "person"]) assert.ok(t.spaces[sp], sp);
  assert.notDeepEqual(t.weekend.days, f.weekend.days);
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
});

test("R57 the worked fixtures: held with their sources; the first profile supplies, with a citation, every fact each needs", () => {
  /* the 15 usable rows, N6 as the law-against-practice pair, E1 and E2 negative only, F1–F3 derived */
  const ids = FIXTURES.map((x) => x.id);
  assert.deepEqual(ids, ["P1", "P2", "P3", "P4", "P5", "P6", "E1", "E2", "R1", "C1", "O1", "O2", "O3", "O4", "O5", "O6", "N6", "F1", "F2", "F3"]);
  for (const x of FIXTURES) {
    assert.ok(typeof x.source === "string" && x.source.length > 5, x.id);
    if (x.kind === "E") assert.equal(x.expected, null, `${x.id} is a negative only`);
    else assert.ok(x.expected, x.id);
    if (x.id !== "O6") assert.ok(x.negative && x.negative !== x.expected && x.negative !== x.statutory, `${x.id} has its negative control`);
    if (/^F/.test(x.id)) assert.equal(x.derived, true, `${x.id} is labelled derived`);
  }
  const o6 = FIXTURES.find((x) => x.id === "O6"), n6 = FIXTURES.find((x) => x.id === "N6");
  assert.equal(o6.practice, true);
  assert.equal(n6.negative, o6.expected, "the practice answer is the law's negative");
  const f = get(FIRST);
  const view = combine([FIRST]).view;
  const listYears = (name) => view.holidays.filter((h) => h.list === name).map((h) => h.year);
  const gaps = [];
  for (const x of [...FIXTURES, OMC_48, BROWN_72]) {
    const rule = x.rule ? view.deadlines.find((d) => d.rule === x.rule) : x.court_rule;
    assert.ok(rule && rule.citation, `${x.id}: its rule, cited`);
    const n = x.needs;
    if (n.weekend) assert.ok(view.weekend && view.weekend.citation, `${x.id}: the weekend`);
    if (n.computation) assert.ok(view.computation.some((c) => c.key === n.computation && c.citation), `${x.id}: ${n.computation}`);
    if (x.rule && n.closures && !(n.observed && x.kind !== "D" && rule.closures !== n.closures))
      assert.ok([rule.closures, rule.observed && rule.observed.closures].includes(n.closures), `${x.id}: its rule names ${n.closures}`);
    if (n.observed) assert.equal(rule.observed.closures, n.closures, `${x.id}: the portal's practice is held beside the rule`);
    if (n.closures) {
      const list = view.holidays.find((h) => h.list === n.closures);
      assert.ok(list && list.citation, `${x.id}: the ${n.closures} list, cited`);
      /* a year no source gives is not held: the count there is undetermined, never a year with no holidays (R33) */
      for (const y of n.years) if (!listYears(n.closures).includes(y)) gaps.push(`${x.id} ${n.closures} ${y}`);
    }
  }
  /* 2018 and 2020 are held from the courts' published lists (holidays-extra; K1514); 2024 is not yet measured */
  assert.deepEqual(gaps, ["R1 judicial 2024"], "the year still to be measured (reported to BOB); every other fact is held");
  /* the records venue's receipt rule, for a request arriving on a closed day (K1504 (3)) */
  assert.equal(venue(f).receipt.rule, "next_business_day");
});

test("R57 the OMC 48-business-hour fixture, re-derived from the code's text and the City's list (K1505 (16))", () => {
  const f = get(FIRST);
  const rule = dl(f, OMC_48.rule);
  assert.match(OMC_48.text, /excluding Saturdays, Sundays and holidays/);
  assert.deepEqual([rule.units, rule.amount, rule.direction, rule.closures], ["business_hours", 48, "backward", "city"]);
  const city = new Set(f.holidays.find((h) => h.list === "city" && h.year === 2026).days.map((d) => d.date));
  assert.equal(city.has("2026-10-12"), false, "2026-10-12 checked against the City list: not a closure");
  /* an oracle over the profile's facts (not the module's count, which is civil-time's): the open hours between the
     expected notice and the meeting are exactly 48, and each negative differs */
  const weekend = new Set(f.weekend.days);
  const dayName = (d) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getUTCDay()];
  const openHours = (from, to) => {
    let h = 0;
    for (let t = Date.parse(`${from}Z`); t < Date.parse(`${to}Z`); t += 60000) {
      const d = new Date(t);
      if (!weekend.has(dayName(d)) && !city.has(d.toISOString().slice(0, 10))) h += 1 / 60;
    }
    return Math.round(h * 1000) / 1000;
  };
  assert.equal(openHours(OMC_48.expected, OMC_48.start), 48);
  for (const n of OMC_48.negatives) assert.notEqual(openHours(n.at, OMC_48.start), 48, n.why);
  /* had 10-12 been a holiday, time-law's Friday would follow: the difference is that one day */
  city.add("2026-10-12");
  assert.equal(openHours(OMC_48.negatives[0].at, OMC_48.start), 48);
});

/* ============================================================================================== */
/* K1513, K1514, K1517: the clarifications BOB folded during the job.                              */

test("R26 K1514 applies_on (the anchor's weekdays) and due_at (close_of_business or HH:MM); one value per key in combine", () => {
  const i = get(TEST).deadlines.findIndex((d) => d.rule === "notice_of_sitting_friday");
  const D = `deadlines[${i}]`;
  for (const on of [["mon"], ["sat", "sun"], ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]) assert.ok(breakT((p) => { p.deadlines[i].applies_on = on; }).ok, on.join());
  for (const bad of [[], ["Mon"], ["mon", "mon"], "mon", null])
    assert.ok(hasError(breakT((p) => { p.deadlines[i].applies_on = bad; }), "VALUE_INVALID", `${D}.applies_on`), JSON.stringify(bad));
  for (const at of ["close_of_business", "00:00", "12:00", "23:59"]) assert.ok(breakT((p) => { p.deadlines[i].due_at = at; }).ok, at);
  for (const bad of ["noon", "12", "24:00", "close of business", 12, null])
    assert.ok(hasError(breakT((p) => { p.deadlines[i].due_at = bad; }), "VALUE_INVALID", `${D}.due_at`), String(bad));
  assert.ok(breakT((p) => { delete p.deadlines[i].applies_on; delete p.deadlines[i].due_at; }).ok, "both optional");
  for (const [f, v] of [["applies_on", ["fri"]], ["due_at", "16:00"]]) {
    const c = combine([TEST, other((b) => { dl(b, "notice_of_sitting_friday")[f] = v; })]);
    assert.ok(c.conflicts.some((x) => x.at === `deadlines[notice_of_sitting_friday/bylaw_complaint].${f}`), f);
    assert.equal(c.view.deadlines.find((d) => d.rule === "notice_of_sitting_friday")[f], undefined, f);
  }
  /* OMC 2.20.070(C) held as its own entry beside the general rule; C1 counts on it */
  const f = get(FIRST);
  const mon = dl(f, "omc_special_meeting_monday");
  assert.deepEqual([mon.units, mon.amount, mon.count, mon.direction, mon.applies_on, mon.due_at], ["days", 3, "calendar", "backward", ["mon"], "12:00"]);
  assert.ok(dl(f, "omc_special_meeting_notice"), "the general rule stands beside it");
  assert.equal(FIXTURES.find((x) => x.id === "C1").rule, "omc_special_meeting_monday");
});

test("R6 K1513 K1517 roster words with a kind, roster headers with a role, and the budget readers' keys", () => {
  for (const kind of ["roster", "chart"]) assert.ok(breakT((p) => { p.vocabulary.roster_words[0].kind = kind; }).ok, kind);
  assert.ok(breakT((p) => { delete p.vocabulary.roster_words[0].kind; }).ok, "absent: both");
  assert.ok(hasError(breakT((p) => { p.vocabulary.roster_words[0].kind = "list"; }), "VALUE_INVALID", "vocabulary.roster_words[0].kind"));
  for (const role of ["name", "title", "unit", "start", "end", "as_of", "employee_id", "contact"]) assert.ok(breakT((p) => { p.vocabulary.roster_headers[0].role = role; }).ok, role);
  for (const bad of ["term", "", undefined]) assert.ok(hasError(breakT((p) => { p.vocabulary.roster_headers[0].role = bad; }), "VALUE_INVALID", "vocabulary.roster_headers[0].role"));
  for (const col of ["fund", "org", "department", "department_code", "program", "project", "account", "amount", "period", "phase"])
    assert.ok(breakT((p) => { p.vocabulary.budget_headers[0].column = col; }).ok, col);
  for (const bad of ["total", "", undefined]) assert.ok(hasError(breakT((p) => { p.vocabulary.budget_headers[0].column = bad; }), "VALUE_INVALID", "vocabulary.budget_headers[0].column"));
  for (const key of ["financial_report_titles", "budget_book_titles", "financial_headings", "fiscal_year_forms", "budget_headers"]) {
    assert.ok(get(TEST).vocabulary[key].length && get(FIRST).vocabulary[key].length, key);
    assert.ok(hasError(breakT((p) => { p.vocabulary[key][0].pattern = { re: "(" }; }), "PATTERN_INVALID", `vocabulary.${key}[0].pattern`), key);
  }
  assert.deepEqual([...new Set(get(TEST).vocabulary.roster_headers.map((h) => h.role))].sort(), ["as_of", "contact", "employee_id", "end", "name", "start", "title", "unit"]);
  /* the first profile reads the City's own documents (K1513, K1517) */
  const v = get(FIRST).vocabulary;
  const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");
  const any = (key, line) => v[key].filter((e) => rx(e).test(line));
  assert.deepEqual(any("roster_words", "COMMITTEE MEMBER ROSTER AND ASSIGNED STAFF").map((e) => e.kind), ["roster"]);
  assert.deepEqual(any("roster_words", "Organizational Chart").map((e) => e.kind), ["chart"]);
  for (const t of ["Vice Chair", "Co-Chair", "Assistant City Administrator", "City Clerk", "Parliamentarians", "Intern"]) assert.ok(any("staff_titles", t).length, t);
  assert.equal(any("staff_titles", "Councilmember").length, 0);
  const role = (h) => (v.roster_headers.find((e) => rx(e).test(h)) || {}).role;
  assert.deepEqual(["Full Name", "Job Title", "Division", "Employee ID", "Email", "Term"].map(role), ["name", "title", "unit", "employee_id", "contact", undefined]);
  assert.ok(any("financial_report_titles", "2024 Annual Comprehensive Financial Report").length);
  assert.ok(any("financial_report_titles", "Comprehensive Annual Financial Report 2012").length);
  assert.ok(any("budget_book_titles", "FY 2023-25 Adopted Policy Budget").length);
  assert.ok(any("financial_headings", "Primary Gove rnme nt Statement of Ne t Position").length, "letter-spaced headings");
  assert.ok(any("fiscal_year_forms", "FY13-15").length && any("fiscal_year_forms", "FY2024").length);
  /* the measured Socrata line items' headers, three cycles (B8; money-people §2, legistar-events §3) */
  const column = (h) => (v.budget_headers.find((e) => rx(e).test(h)) || {}).column;
  const cycles = {
    "FY2013-15": [["budget", "period"], ["department", "department"], ["org_code", "org"], ["fund_code", "fund"], ["project_code", "project"],
      ["program_code", "program"], ["account_code", "account"], ["amount", "amount"]],
    "FY2015-17": [["budget_year_name", "period"], ["org", "org"], ["fund", "fund"], ["project", "project"], ["program", "program"],
      ["account", "account"], ["amt", "amount"]],
    "FY2019-21": [["fund", "fund"], ["prog", "program"], ["acct", "account"], ["fy17_18_actuals_final_year", "amount"],
      ["fy18_19_midcycle_adopted", "amount"], ["fy19_20_biennial_working", "amount"]],
  };
  for (const [cycle, rows] of Object.entries(cycles)) for (const [h, want] of rows) assert.equal(column(h), want, `${cycle} ${h}`);
  for (const h of ["description", "fund_name", "fy2019", "budgets"]) assert.equal(column(h), undefined, h);
  for (const h of ["General Purpose Fund Revenue", "Expenditures By Fund"]) assert.ok(any("financial_headings", h).length, h);
});

test("R52 K1513 classification_schemes: forms and the project kind; the first profile's fund, org, department, program, account and project codes", () => {
  const i = get(TEST).classification_schemes.findIndex((x) => x.kind === "project");
  assert.ok(i >= 0, "a project scheme");
  const C = `classification_schemes[${i}]`;
  for (const [bad, at] of [[[], `${C}.forms`], [[{ re: "(" }], `${C}.forms[0]`], ["WO", `${C}.forms`]]) assert.ok(hasError(breakT((p) => { p.classification_schemes[i].forms = bad; }), "SCHEME_INVALID", at), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { p.classification_schemes[i].forms = [{ re: "(" }]; }), "SCHEME_INVALID", `${C}.forms[0]`));
  const f = get(FIRST).classification_schemes;
  assert.deepEqual(f.map((x) => x.kind), ["fund", "organisation", "organisation", "program", "account", "project"]);
  const reads = (scheme, value) => f.find((x) => x.scheme === scheme).forms.some((p) => new RegExp(p.re, p.flags || "").test(value));
  assert.ok(reads("oakland_fund", "FD_1010") && reads("oakland_fund", "1010"));
  assert.ok(reads("oakland_org", "OR_01111") && reads("oakland_program", "PG_IP01") && reads("oakland_account", "51111"));
  assert.ok(reads("oakland_org", "11") && reads("oakland_org", "1111") && !reads("oakland_org", "1") && !reads("oakland_org", "OR_1"), "FY2013-15's bare org codes");
  assert.ok(reads("oakland_project", "PJ_1000001") && reads("oakland_project", "1003439"));
  assert.ok(reads("oakland_department", "DP1000") && reads("oakland_department", "DPCC0") && !reads("oakland_department", "DP1"));
  assert.equal(f[0].codes.find((c) => c.code === "1010").label, "General Purpose Fund");
});

test("R4 R3 K1514 the court registers as systems, with their proceeding number forms, in both profiles", () => {
  for (const id of [FIRST, TEST]) {
    const p = get(id);
    assert.deepEqual(["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"].filter((o) => p.systems.some((s) => s.origin === o)),
      ["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"], id);
    assert.ok(p.spaces.proceeding.forms.length >= 3, id);
  }
  const view = combine([FIRST]).view;
  const sys = (url) => { const u = new URL(url); return (view.systems.find((s) => s.hosts.includes(u.hostname) && (!s.path || new RegExp(s.path.re, s.path.flags || "").test(u.pathname + u.search))) || {}).origin; };
  assert.equal(sys("https://www.courtlistener.com/docket/4214664/some-case/"), "courtlistener_docket");
  assert.equal(sys("https://www.courtlistener.com/opinion/1/x/"), undefined);
  assert.equal(sys("https://apps.cpuc.ca.gov/apex/f?p=401:56:0::NO:RP,57,RIR:P5_PROCEEDING_SELECT:A2106021"), "cpuc_proceeding");
  assert.equal(sys("https://eportal.alameda.courts.ca.gov/?q=node/388"), "ecourt_roa");
  const forms = view.spaces.proceeding.forms;
  const read = (value) => (forms.find((f) => new RegExp(f.pattern.re, f.pattern.flags || "").test(value)) || {}).form || null;
  assert.equal(read("22CV013018"), "alameda-civil");
  assert.equal(read("RG21105389"), "alameda-legacy");
  assert.equal(read("3:20-cv-05640-EMC"), "federal-district");
  assert.equal(read("A2106021"), "cpuc");
  assert.equal(read("A.21-06-021"), "cpuc");
  assert.equal(read("CV013018"), null);
});

test("R47 R57 K1514 the judicial lists of 2018 and 2020 (courts' published lists): Columbus Day then a judicial holiday", () => {
  const f = get(FIRST);
  const year = (y) => f.holidays.find((h) => h.list === "judicial" && h.year === y);
  for (const y of [2018, 2020]) {
    assert.ok(year(y), String(y));
    assert.match(year(y).citation, /§ 135/);
    assert.deepEqual([year(y).status, year(y).basis], ["researched", "2026-10-05 holidays-extra"]);
  }
  const dates = (y) => new Set(year(y).days.map((d) => d.date));
  assert.ok(dates(2018).has("2018-05-28"), "P1's Memorial Day");
  assert.ok(dates(2020).has("2020-10-12"), "P6: Columbus Day 2020");
  assert.ok(!dates(2026).has("2026-10-12"));
  /* P1 and P6 against the held lists: an oracle over the profile's facts, not the module's count (civil-time's) */
  const weekend = new Set(f.weekend.days);
  const back = (from, n, y) => {
    let d = new Date(`${from}T00:00Z`), k = 0;
    while (k < n) { d = new Date(d.getTime() - 864e5); const iso = d.toISOString().slice(0, 10);
      if (!weekend.has(["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getUTCDay()]) && !dates(y).has(iso)) k++; }
    return d.toISOString().slice(0, 10);
  };
  for (const id of ["P1", "P6"]) {
    const x = FIXTURES.find((r) => r.id === id);
    assert.equal(back(x.start, 16, Number(x.start.slice(0, 4))), x.expected, id);
  }
  /* the federal 2026 list: Independence Day falls on Saturday and is observed Friday (5 U.S.C. § 6103(b)) */
  const fed = new Set(f.holidays.find((h) => h.list === "federal").days.map((d) => d.date));
  assert.ok(fed.has("2026-07-03") && fed.has("2026-10-12") && fed.has("2026-11-11"));
});
