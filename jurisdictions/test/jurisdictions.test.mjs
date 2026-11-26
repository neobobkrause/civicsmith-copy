/* jurisdictions: every live requirement id (build/requirements/jurisdictions.md), tested at the module's
 * interface: list, get, validate, combine, and the two held profiles. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { list, get, validate, combine, LAW_LEVELS } from "../index.mjs";
import { isObj, isList, listOr } from "../shared.mjs";
import { must, held, viewOf, combinedOf, refusalOf, loose, at, put, applyForm, recogniseIn, systemOf, walkFacts, legacy } from "./helpers.mjs";
/* R39's grades are record-grammar's (its R16; K624 (6)). */
import { BASIS_GRADES as GRADES } from "../../bio-plane/src/record-grammar/index.mjs";
/** @import { Profile, View, Validation, Template, TemplateUse, Weekday, HoursSpan, SpaceName, Space, ViewSpace, ProfileSummary, Pattern, Holiday, Tier, RecordsLaw, StandardSource } from "../index.mjs" */
/** @import { Fields, Value } from "../shared.mjs" */

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
/** @param {Validation} r
 *  @returns {string[]} */
const codes = (r) => r.errors.map((e) => e.code);
/** @param {Validation} r
 *  @param {string} code
 *  @param {string | null} [path]
 *  @returns {boolean} */
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));

/** The first entry of a list that `pred` accepts; a thrown failure naming `what` when there is none.
 *  @template T
 *  @param {T[] | undefined} xs
 *  @param {(x: T) => boolean} pred
 *  @param {string} what
 *  @returns {T} */
const findIn = (xs, pred, what) => must(must(xs, what).find(pred), what);
/** Entry `i` of a list; a thrown failure naming `what` when there is none.
 *  @template T
 *  @param {T[] | undefined} xs
 *  @param {number} i
 *  @param {string} what
 *  @returns {T} */
const nth = (xs, i, what) => must(must(xs, what)[i], `${what}[${i}]`);
/** A space of a held profile; a thrown failure when it has none.
 *  @param {Profile} p
 *  @param {SpaceName} name
 *  @returns {Space} */
const spaceOf = (p, name) => must(must(p.spaces, "spaces")[name], `space ${name}`);
/** A space of a combined view; a thrown failure when it has none.
 *  @param {View} v
 *  @param {SpaceName} name
 *  @returns {ViewSpace} */
const viewSpaceOf = (v, name) => must(must(v.spaces, "spaces")[name], `space ${name}`);
/** A plain object, read loosely; a thrown failure when `v` is none.
 *  @param {Value} v
 *  @returns {Fields} */
const fieldsOf = (v) => at(v, "");
/** Whether a law entry has a level from R31, or else is a policy, commitment or standard with a sector and no level
 *  (T35-1).
 *  @param {RecordsLaw | StandardSource} x
 *  @returns {boolean} */
const levelledOrSector = (x) => LAW_LEVELS.includes(x.level ?? "")
  || ("kind" in x && ["policy", "commitment", "standard"].includes(x.kind) && !("level" in x) && !!x.sector);

/** What a test changes of the sample template.
 *  @typedef {Object} TemplateChange
 *  @property {string} [id]
 *  @property {TemplateUse} [use]
 *  @property {string} [text]
 */
/* R40: a template with its whole attribution. */
/** @param {TemplateChange} [over]
 *  @returns {Template} */
const tpl = (over = {}) => {
  /** @type {Template} */
  const t = { id: over.id ?? "TPL-sample-request", version: 1, use: over.use ?? "file", text: over.text ?? "Please send the records under {{law}}.", notes: "",
    authored_by: "A. Author", contributors: ["B. Helper"], approved_by: "C. Approver", approved_at: "2026-09-01",
    reviews: [{ reviewer: "D. Reviewer", kind: "professional", organisation: "Law Centre", credential: "attorney", scope: "the whole text",
      outcome: "no_concerns", at: "2026-08-30" }], basis: "K921" };
  return t;
};
/** @type {Weekday[]} */
const WORKDAYS = ["mon", "tue", "wed", "thu", "fri"];
/** @param {string} open
 *  @param {string} close
 *  @returns {HoursSpan[]} */
const weekdays = (open, close) => WORKDAYS.map((day) => ({ day, open, close }));

/* A small valid profile carrying every section, the base the negative cases break one field of. */
/** @returns {Profile} */
function sample() {
  return {
    id: "sample-town", name: "Sample Town", covers: ["Sample Town"], test: false,
    spaces: {
      enactment: {
        label: "law number",
        forms: [{ form: "n", pattern: { re: "^(\\d{3,5})$" }, normal: [{ group: 1 }], clean: { spaces: "collapse" }, basis: "M-1" }],
        kinds: [{ kind: "law", prefix: { re: "law\\s+", flags: "i" }, floor: { first: 100, system: "town.record", basis: "M-1" }, basis: "M-1" }],
      },
      project: { label: "job", forms: [
        { form: "J", pattern: { re: "^J(\\d{4})$" }, normal: ["J", { group: 1 }], clean: { strip: [{ re: "#" }], spaces: "remove", upper: true }, basis: "M-2" },
        { form: "K", pattern: { re: "^K(\\d{4})$" }, normal: ["K", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "M-2" }] },
      fund: { label: "fund", forms: [{ form: "f", pattern: { re: "^(\\d{2})$" }, normal: [{ group: 1 }], basis: "M-3" }] },
      parcel: { label: "lot", forms: [{ form: "l", pattern: { re: "^0*(\\d+)-(\\d+)?$" }, normal: [{ group: 1, unpad: true }, "-", { group: 2, default: "0" }], basis: "M-4" }] },
    },
    systems: [
      { origin: "town.record", name: "the town record", hosts: ["record.sample.example"],
        links: { item: { re: "^/item/\\d+$" }, file: { re: "^/file/", flags: "i" } }, basis: "M-5" },
      { origin: "town.record", name: "the town record via a shared host", hosts: ["api.shared.example"], path: { re: "^/town/" }, basis: "M-5" },
      { origin: "county.roll", name: "the county roll, republished", hosts: ["open.sample.example"], path: { re: "roll" }, republishes: true, provenance_stated: false, basis: "M-5" },
    ],
    mixed_hosts: [{ host: "www.sample.example", why: "many offices", basis: "M-5" }],
    crosswalks: [{ space: "project", forms: ["J", "K"], pairs: [["J0001", "K0009"]], source: "a".repeat(64), basis: "M-6" }],
    vocabulary: {
      furniture: [{ pattern: { re: "^Sample Town$" }, basis: "M-7" }],
      bodies: [{ pattern: { re: "Council$" }, basis: "M-7" }],
      member_titles: [{ pattern: { re: "^Alder" }, basis: "M-7" }],
      enactment_markers: [{ pattern: { re: "S\\.T\\." }, basis: "M-7" }],
      codes: [{ key: "stc", label: "S.T.C.", pattern: { re: "Sample Town Code" }, basis: "M-7" }],
      file_numbers: [{ pattern: { re: "F\\d+" }, system: "town.record", basis: "M-7" }],
      report_titles: [{ pattern: { re: "^MEMO" }, basis: "M-7" }],
      report_sections: [{ pattern: { re: "^COST" }, basis: "M-7" }],
      recommendation_openers: [{ pattern: { re: "We propose" }, basis: "M-7" }],
      template_blanks: [{ pattern: { re: "\\[BLANK\\]" }, basis: "M-7" }],
    },
    practice: { minutes_due_days: { value: 14, basis: "UNMEASURED" } },
    locale: { value: "en-CA", basis: "M-10" },
    time_zone: { value: "America/Toronto", status: "researched", basis: "M-14" },
    search_terms: [{ term: "sample", basis: "UNMEASURED" }],
    records_laws: [{ level: "state", name: "Records Law", citation: "RL § 1", basis: "D-1" }],
    standard_sources: [{ source: "Sample Town Code", kind: "ordinance", issuer: "Council", level: "city", cite: { re: "STC § \\d+" }, code: "stc", basis: "K1" }],
    counterparties: [{ role: "Clerk", body: "Sample Town", level: "city", elected: false,
      hours: { weekly: [...weekdays("09:00", "12:00"), ...weekdays("13:00", "17:00")], status: "researched", basis: "M-15" }, basis: "DEC-1" },
      { role: "Auditor", body: "Sample Town", level: "city", elected: true, oversight: true, basis: "DEC-2" }],
    action_kinds: [
      { kind: "records_request", label: "records request", tier: 1, laws: ["Records Law"],
        venue: { name: "clerk", how: "email", basis: "M-8", hours: { weekly: weekdays("08:00", "16:00"), status: "ruled", basis: "K5" } },
        template: tpl(), basis: "M-8" },
      { kind: "code_complaint", label: "complaint", tier: 3, laws: ["Sample Town Code"], venue: { name: "court", how: "court", basis: "M-8" },
        evidence: { standard: "Evidence Rule 902: self-authenticating records", accepts: [{ grade: "A", coattested: true }, { grade: "B" }],
          contestable: [{ grade: "C" }], basis: "M-13" }, basis: "M-8" },
      { kind: "records_petition", label: "petition", tier: 2, laws: ["Records Law"], advisory: "Have it reviewed first.", basis: "M-8" },
    ],
    deadlines: [{ rule: "answer", applies_to: "records_request", days: 10, count: "calendar", starts: "received",
      extension: { days: 5, count: "business", when: "busy" }, citation: "RL § 2", status: "researched", basis: "M-9" }],
    legal_organisations: [{ name: "Town Law Centre", evaluates: ["code_complaint"],
      contacts: [{ how: "email", value: "help@law.sample.example" }, { how: "mail", value: "1 Main St" }], basis: "M-11" }],
    holidays: [{ year: 2026, days: [{ date: "2026-01-01", name: "New Year" }, { date: "2026-07-04", name: "Summer" }], status: "researched", basis: "M-12" },
      { year: 2024, days: [{ date: "2024-02-29", name: "Leap" }], status: "researched", basis: "M-12" },
      { year: 2026, offices: ["Clerk", { venue: "code_complaint" }], days: [{ date: "2026-03-02", name: "Clerk's day" }], status: "ruled", basis: "K6" }],
  };
}
/** @param {(p: Fields) => void} fn
 *  @returns {Validation} */
const breakIt = (fn) => { const p = loose(sample()); fn(p); return validate(p); };

/* ============================================================================================== */
/* The profile's shape: R1–R7, judged through validate.                                           */

test("R1 identity: id pattern, name, non-empty covers, test flag", () => {
  assert.equal(validate(sample()).ok, true, JSON.stringify(validate(sample()).errors));
  for (const bad of ["", "Sample", "-x", "a b", "a_b", 7, null, undefined])
    assert.ok(hasError(breakIt((p) => { p.id = bad; }), "ID_INVALID", "id"), `id ${String(bad)}`);
  for (const good of ["a", "0", "a-b-9", "oakland-alameda"]) assert.ok(!hasError(breakIt((p) => { p.id = good; }), "ID_INVALID"));
  for (const bad of ["", "  ", 3, null]) assert.ok(hasError(breakIt((p) => { p.name = bad; }), "NAME_MISSING", "name"));
  assert.ok(hasError(breakIt((p) => { delete p.name; }), "NAME_MISSING"));
  for (const bad of [[], "Town", [""], [3], null]) assert.ok(hasError(breakIt((p) => { p.covers = bad; }), "COVERS_MISSING", "covers"));
  assert.ok(hasError(breakIt((p) => { p.test = "yes"; }), "VALUE_INVALID", "test"));
  assert.ok(breakIt((p) => { delete p.test; }).ok, "test is optional");
});

test("R2 patterns ({re, flags} from i and u) and bases (measurement, dated entry, ruling, UNMEASURED; TEST only in a test profile)", () => {
  for (const b of ["M-157", "2026-07-30", "D-149", "DEC-13", "K4", "UNMEASURED", "M-119, M-132", "M-119 LEG", "M-157 (4)", "2026-08-03, M-24", "M-1; D-2"])
    assert.ok(breakIt((p) => { at(p, "search_terms[0]").basis = b; }).ok, b);
  for (const b of ["", "measured", "M-", "m-157", "Roadmap §8", "M-1,", "unmeasured", 5])
    assert.ok(breakIt((p) => { at(p, "search_terms[0]").basis = b; }).errors.some((e) => e.path === "search_terms[0].basis" && (e.code === "BASIS_INVALID" || e.code === "BASIS_MISSING")), `basis ${String(b)}`);
  assert.ok(hasError(breakIt((p) => { at(p, "search_terms[0]").basis = "TEST"; }), "BASIS_INVALID", "search_terms[0].basis"));
  assert.ok(breakIt((p) => { p.test = true; at(p, "search_terms[0]").basis = "TEST"; }).ok);
  /* Every fact carries a basis: remove each one in turn. */
  /** @type {string[]} */
  const paths = [];
  walkFacts(sample(), (fact, path) => paths.push(path));
  assert.ok(paths.length >= 25);
  for (const path of paths) {
    const r = breakIt((p) => { delete walkFacts.at(p, path).basis; });
    /* a template missing its basis is missing part of its attribution (R40) */
    assert.ok(hasError(r, /\.template$|\.templates\[\d+\]$/.test(path) ? "TEMPLATE_UNATTRIBUTED" : "BASIS_MISSING", `${path}.basis`), path);
  }
  /* Patterns: a source that compiles, flags from i and u only, each once. */
  for (const flags of ["", "i", "u", "iu", "ui"]) assert.ok(breakIt((p) => { at(p, "vocabulary.bodies[0]").pattern = { re: "x", flags }; }).ok, flags);
  for (const pat of [{ re: "(" }, { re: "x", flags: "g" }, { re: "x", flags: "ii" }, { re: "x", flags: "m" }, { re: 3 }, "x", null, { re: "x", other: 1 }])
    assert.ok(hasError(breakIt((p) => { at(p, "vocabulary.bodies[0]").pattern = pat; }), "PATTERN_INVALID", "vocabulary.bodies[0].pattern"), JSON.stringify(pat));
});

test("R3 spaces: forms, clean, normal parts, and enactment kinds with floors", () => {
  const f = held(FIRST);
  /* clean and normal remove formatting and never change a digit */
  const apn = nth(spaceOf(f, "parcel").forms, 0, "parcel forms");
  assert.equal(applyForm(apn, "APN 008-0649-012-00"), "8-649-12-0");
  assert.equal(applyForm(apn, "8-649-12"), "8-649-12-0");
  assert.equal(applyForm(apn, "048a-7000-001-02"), "48A-7000-1-2");
  assert.equal(must(applyForm(apn, "008-0649-012-03"), "008-0649-012-03").replace(/\D/g, ""), "8649123");
  const proj = findIn(spaceOf(f, "project").forms, (x) => x.form === "C#####", "form C#####");
  assert.equal(applyForm(proj, "# c 12345"), "C12345");
  /* strip, spaces and upper are applied as R3 states */
  const t = held(TEST);
  assert.equal(applyForm(nth(spaceOf(t, "parcel").forms, 0, "parcel forms"), "Parcel 0012/007b"), "12/7B");
  assert.equal(applyForm(nth(spaceOf(t, "parcel").forms, 0, "parcel forms"), "12/7"), "12/7");
  /* a normal part naming a group the pattern lacks, or an unknown transform */
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").normal = [{ group: 2 }]; }), "NORMAL_INVALID", "spaces.fund.forms[0].normal[0]"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").normal = [{ group: 1, pad: true }]; }), "NORMAL_INVALID"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").normal = [{ group: 1, unpad: "yes" }]; }), "NORMAL_INVALID"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").normal = []; }), "NORMAL_INVALID"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").clean = { spaces: "squeeze" }; }), "NORMAL_INVALID", "spaces.fund.forms[0].clean"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").clean = { upper: false }; }), "NORMAL_INVALID"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").clean = { strip: [{ re: "(" }] }; }), "NORMAL_INVALID"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund.forms[0]").pattern = { re: "(" }; }), "PATTERN_INVALID", "spaces.fund.forms[0].pattern"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.project.forms[1]").form = "J"; }), "DUPLICATE_FORM", "spaces.project.forms[1].form"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces").lot = at(p, "spaces").parcel; }), "UNKNOWN_SPACE", "spaces.lot"));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.fund").kinds = []; }), "UNKNOWN_SECTION", "spaces.fund.kinds"), "kinds are enactment's only");
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.enactment.kinds[0]").prefix = { re: "[" }; }), "PATTERN_INVALID", "spaces.enactment.kinds[0].prefix"));
  for (const bad of [0, -1, 1.5, "100", null])
    assert.ok(hasError(breakIt((p) => { at(p, "spaces.enactment.kinds[0].floor").first = bad; }), "VALUE_INVALID", "spaces.enactment.kinds[0].floor.first"), String(bad));
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.enactment.kinds[0].floor").system = "nowhere"; }), "SYSTEM_UNKNOWN", "spaces.enactment.kinds[0].floor.system"));
  assert.ok(breakIt((p) => { delete at(p, "spaces.enactment.kinds[0]").floor; }).ok, "a floor is optional");
});

test("R4 systems: origin, name, lower-case hosts, path pattern, republishes, provenance_stated; mixed hosts", () => {
  assert.ok(hasError(breakIt((p) => { at(p, "systems[0]").hosts = ["Record.Sample.Example"]; }), "VALUE_INVALID", "systems[0].hosts"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[0]").hosts = []; }), "VALUE_INVALID", "systems[0].hosts"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[0]").origin = ""; }), "VALUE_INVALID", "systems[0].origin"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "systems[0]").name; }), "VALUE_INVALID", "systems[0].name"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[1]").path = { re: "(" }; }), "PATTERN_INVALID", "systems[1].path"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[2]").republishes = "yes"; }), "VALUE_INVALID", "systems[2].republishes"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[2]").provenance_stated = 0; }), "VALUE_INVALID", "systems[2].provenance_stated"));
  assert.ok(hasError(breakIt((p) => { at(p, "mixed_hosts[0]").host = "WWW.sample.example"; }), "VALUE_INVALID", "mixed_hosts[0].host"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "mixed_hosts[0]").why; }), "VALUE_INVALID", "mixed_hosts[0].why"));
  /* A republication names the system it republishes: the first profile's portal layer is the assessor's. */
  const f = held(FIRST);
  const r = systemOf(f, "https://data.oaklandca.gov/resource/c3xp-qcgn.json");
  assert.deepEqual([r.origin, r.republishes, r.provenance_stated], ["alameda.assessor", true, false]);
});

test("R5 crosswalks: captured pairs with a content hash, never a pattern", () => {
  assert.ok(hasError(breakIt((p) => { delete at(p, "crosswalks[0]").source; }), "CROSSWALK_UNSOURCED", "crosswalks[0].source"));
  assert.ok(hasError(breakIt((p) => { at(p, "crosswalks[0]").source = "abc"; }), "VALUE_INVALID", "crosswalks[0].source"));
  assert.ok(hasError(breakIt((p) => { at(p, "crosswalks[0]").forms = ["J", "Z"]; }), "CROSSWALK_FORM_UNKNOWN", "crosswalks[0].forms[1]"));
  assert.ok(hasError(breakIt((p) => { at(p, "crosswalks[0]").pairs = [["J0001", "J0009"]]; }), "CROSSWALK_VALUE_INVALID", "crosswalks[0].pairs[0][1]"));
  assert.ok(hasError(breakIt((p) => { at(p, "crosswalks[0]").space = "lots"; }), "UNKNOWN_SPACE", "crosswalks[0].space"));
  assert.ok(hasError(breakIt((p) => { at(p, "crosswalks[0]").pairs = [["J0001"]]; }), "VALUE_INVALID", "crosswalks[0].pairs[0]"));
  assert.ok(hasError(breakIt((p) => { at(p, "crosswalks[0]").pattern = { re: "x" }; }), "UNKNOWN_SECTION", "crosswalks[0].pattern"), "a crosswalk is never a pattern");
  /* values are judged after the form's own cleaning */
  assert.ok(breakIt((p) => { at(p, "crosswalks[0]").pairs = [["# j0001", " K 0009 "]]; }).ok);
});

test("R6 vocabulary: the closed set of keys and each key's entry shape", () => {
  assert.ok(hasError(breakIt((p) => { at(p, "vocabulary").mastheads = []; }), "UNKNOWN_VOCABULARY", "vocabulary.mastheads"));
  assert.ok(hasError(breakIt((p) => { at(p, "vocabulary.codes[0]").key = ""; }), "VALUE_INVALID", "vocabulary.codes[0].key"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "vocabulary.codes[0]").label; }), "VALUE_INVALID", "vocabulary.codes[0].label"));
  assert.ok(hasError(breakIt((p) => { at(p, "vocabulary.file_numbers[0]").system = "nowhere"; }), "SYSTEM_UNKNOWN", "vocabulary.file_numbers[0].system"));
  assert.ok(hasError(breakIt((p) => { at(p, "vocabulary.furniture[0]").system = "town.record"; }), "UNKNOWN_SECTION", "vocabulary.furniture[0].system"));
  assert.ok(hasError(breakIt((p) => { at(p, "vocabulary").bodies = "Council"; }), "VALUE_INVALID", "vocabulary.bodies"));
  for (const key of ["furniture", "bodies", "member_titles", "enactment_markers", "codes", "file_numbers", "report_titles", "report_sections", "recommendation_openers", "template_blanks"])
    assert.ok(hasError(breakIt((p) => { at(p, `vocabulary.${key}[0]`).pattern = { re: ")" }; }), "PATTERN_INVALID", `vocabulary.${key}[0].pattern`), key);
});

test("R7 practice, search_terms and records_laws", () => {
  for (const bad of [0, -3, 2.5, "21"])
    assert.ok(hasError(breakIt((p) => { at(p, "practice.minutes_due_days").value = bad; }), "VALUE_INVALID", "practice.minutes_due_days.value"), String(bad));
  assert.ok(hasError(breakIt((p) => { at(p, "practice").agenda_due_days = { value: 3, basis: "M-1" }; }), "UNKNOWN_SECTION", "practice.agenda_due_days"));
  assert.ok(hasError(breakIt((p) => { at(p, "search_terms[0]").term = ""; }), "VALUE_INVALID", "search_terms[0].term"));
  for (const bad of ["local", "district", "State", "", null, undefined])
    assert.ok(hasError(breakIt((p) => { at(p, "records_laws[0]").level = bad; }), "LEVEL_UNKNOWN", "records_laws[0].level"), String(bad));
  for (const level of ["federal", "state", "county", "city"]) assert.ok(breakIt((p) => { at(p, "records_laws[0]").level = level; }).ok, level);
  assert.ok(hasError(breakIt((p) => { delete at(p, "records_laws[0]").citation; }), "VALUE_INVALID", "records_laws[0].citation"));
});

/* ============================================================================================== */
/* list, get (R8, R9).                                                                             */

test("R8 list: every profile held, sorted by id, {id, name, covers, test}; never throws", () => {
  /** `list`, called with arguments it does not take. @type {(...args: Value[]) => ProfileSummary[]} */
  const listGiven = list;
  const l = listGiven(list, 3, null);
  assert.deepEqual(l.map((p) => p.id), [FIRST, TEST]);
  assert.deepEqual(l.map((p) => p.id), l.map((p) => p.id).slice().sort());
  for (const p of l) {
    assert.deepEqual(Object.keys(p).sort(), ["covers", "id", "name", "test"]);
    const full = held(p.id);
    assert.deepEqual(p, { id: full.id, name: full.name, covers: full.covers, test: full.test === true });
  }
  assert.equal(findIn(l, (p) => p.id === TEST, TEST).test, true);
  assert.equal(findIn(l, (p) => p.id === FIRST, FIRST).test, false);
});

test("R9 get: the held profile, or null for any other input; never throws", () => {
  assert.equal(get(FIRST)?.id, FIRST);
  assert.equal(get(TEST)?.id, TEST);
  for (const x of [undefined, null, "", "OAKLAND-ALAMEDA", " oakland-alameda", "nowhere", 1, {}, [], FIRST.split(""), { id: FIRST }, Symbol("x")])
    assert.equal(get(x), null, String(typeof x === "symbol" ? "symbol" : JSON.stringify(x)));
});

/* ============================================================================================== */
/* validate (R10, R11, R28).                                                                       */

test("R10 validate: ok exactly when errors is empty; {path, code, detail}; every error reported; never throws", () => {
  const r = breakIt((p) => { p.id = "Bad Id"; delete p.name; at(p, "search_terms[0]").basis = "nope"; at(p, "records_laws[0]").level = "planet"; });
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r).sort(), ["BASIS_INVALID", "ID_INVALID", "LEVEL_UNKNOWN", "NAME_MISSING"]);
  for (const e of r.errors) {
    assert.deepEqual(Object.keys(e).sort(), ["code", "detail", "path"]);
    assert.equal(typeof e.path, "string"); assert.equal(typeof e.detail, "string");
  }
  assert.ok(hasError(breakIt((p) => { at(p, "spaces.parcel.forms[0]").pattern = { re: "(" }; }), "PATTERN_INVALID", "spaces.parcel.forms[0].pattern"));
  const ok = validate(sample());
  assert.deepEqual(ok, { ok: true, errors: [] });
  /* odd inputs, including ones that throw when read */
  const trap = new Proxy({}, { get() { throw new Error("boom"); }, ownKeys() { throw new Error("boom"); } });
  const cyclic = loose(sample()); at(cyclic, "spaces.enactment").self = cyclic;
  for (const x of [undefined, null, 3, "p", [], trap, cyclic, { __proto__: null }]) {
    const v = validate(x);
    assert.equal(v.ok, v.errors.length === 0);
    assert.equal(v.ok, false);
  }
});

test("R11 validate codes: each named code is reported for its fault", () => {
  /** @type {{ [code: string]: () => Validation }} */
  const cases = {
    NOT_A_PROFILE: () => validate([]),
    ID_INVALID: () => breakIt((p) => { p.id = "X"; }),
    NAME_MISSING: () => breakIt((p) => { p.name = ""; }),
    COVERS_MISSING: () => breakIt((p) => { p.covers = []; }),
    UNKNOWN_SECTION: () => breakIt((p) => { p.budget = []; }),
    UNKNOWN_SPACE: () => breakIt((p) => { at(p, "spaces").zone = { label: "z", forms: [] }; }),
    UNKNOWN_VOCABULARY: () => breakIt((p) => { at(p, "vocabulary").slogans = []; }),
    BASIS_MISSING: () => breakIt((p) => { delete at(p, "systems[0]").basis; }),
    BASIS_INVALID: () => breakIt((p) => { at(p, "systems[0]").basis = "TEST"; }),
    PATTERN_INVALID: () => breakIt((p) => { at(p, "systems[1]").path = { re: "a", flags: "x" }; }),
    NORMAL_INVALID: () => breakIt((p) => { at(p, "spaces.project.forms[0]").normal = ["J", { group: 9 }]; }),
    DUPLICATE_FORM: () => breakIt((p) => { listOr(at(p, "spaces.project").forms).push(loose(at(p, "spaces.project.forms[0]"))); }),
    SYSTEM_UNKNOWN: () => breakIt((p) => { p.systems = listOr(p.systems).filter((s) => !isObj(s) || s.origin !== "town.record"); }),
    CROSSWALK_UNSOURCED: () => breakIt((p) => { at(p, "crosswalks[0]").source = ""; }),
    CROSSWALK_FORM_UNKNOWN: () => breakIt((p) => { at(p, "crosswalks[0]").forms = ["Q", "K"]; }),
    CROSSWALK_VALUE_INVALID: () => breakIt((p) => { const c = at(p, "crosswalks[0]"); c.pairs = [...listOr(c.pairs), ["X", "K0001"]]; }),
    HOST_CONFLICT: () => breakIt((p) => { listOr(p.mixed_hosts).push({ host: "record.sample.example", why: "x", basis: "M-1" }); }),
    VALUE_INVALID: () => breakIt((p) => { at(p, "practice.minutes_due_days").value = 0; }),
  };
  for (const [code, run] of Object.entries(cases)) assert.ok(codes(run()).includes(code), code);
  /* a mixed host that a system names only under a path is not a conflict */
  assert.ok(breakIt((p) => { listOr(p.mixed_hosts).push({ host: "api.shared.example", why: "shared", basis: "M-1" }); }).ok);
});

test("R28 validate codes for the action sections", () => {
  /** @type {{ [code: string]: [(p: Fields) => void, string] }} */
  const cases = {
    SOURCE_KIND_UNKNOWN: [(p) => { at(p, "standard_sources[0]").kind = "custom"; }, "standard_sources[0].kind"],
    LEVEL_UNKNOWN: [(p) => { at(p, "counterparties[0]").level = "region"; }, "counterparties[0].level"],
    KIND_INVALID: [(p) => { at(p, "action_kinds[0]").kind = "Records-Request"; }, "action_kinds[0].kind"],
    COUNT_UNKNOWN: [(p) => { at(p, "deadlines[0]").count = "working"; }, "deadlines[0].count"],
    TIER_INVALID: [(p) => { at(p, "action_kinds[0]").tier = 4; }, "action_kinds[0].tier"],
    TEMPLATE_TIER3: [(p) => { at(p, "action_kinds[1]").template = tpl({ id: "TPL-sample-sue" }); }, "action_kinds[1].template"],
    CODE_UNKNOWN: [(p) => { at(p, "standard_sources[0]").code = "xyz"; }, "standard_sources[0].code"],
    LAW_UNKNOWN: [(p) => { at(p, "action_kinds[0]").laws = ["Unknown Act"]; }, "action_kinds[0].laws[0]"],
    DEADLINE_KIND_UNKNOWN: [(p) => { at(p, "deadlines[0]").applies_to = "appeal"; }, "deadlines[0].applies_to"],
    DUPLICATE_KIND: [(p) => { listOr(p.action_kinds).push(loose(at(p, "action_kinds[0]"))); }, "action_kinds[3].kind"],
    GRADE_UNKNOWN: [(p) => { at(p, "action_kinds[1].evidence.accepts[0]").grade = "E"; }, "action_kinds[1].evidence.accepts[0].grade"],
    EVIDENCE_NO_STANDARD: [(p) => { delete at(p, "action_kinds[1].evidence").standard; }, "action_kinds[1].evidence.standard"],
  };
  for (const [code, [fn, path]] of Object.entries(cases)) assert.ok(hasError(breakIt(fn), code, path), code);
  for (const tier of [0, "1", 1.5, null]) assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[0]").tier = tier; }), "TIER_INVALID"), String(tier));
  assert.ok(hasError(breakIt((p) => { at(p, "deadlines[0].extension").count = "weeks"; }), "COUNT_UNKNOWN", "deadlines[0].extension.count"));
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[0]").kind = "1st"; }), "KIND_INVALID"));
  assert.ok(breakIt((p) => { at(p, "deadlines[0]").applies_to = "claim"; }).ok, "claim binds a legal claim");
  /* LEVEL_UNKNOWN covers a law level outside R31 and a standard source with no level */
  assert.ok(hasError(breakIt((p) => { at(p, "records_laws[0]").level = "local"; }), "LEVEL_UNKNOWN", "records_laws[0].level"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "standard_sources[0]").level; }), "LEVEL_UNKNOWN", "standard_sources[0].level"));
});

/* ============================================================================================== */
/* The action sections (R23–R27).                                                                  */

test("R23 standard_sources: source, kind from the seven, issuer, level from R31 (or a sector, T35), cite pattern, code naming a codes key", () => {
  for (const level of LAW_LEVELS) assert.ok(breakIt((p) => { at(p, "standard_sources[0]").level = level; }).ok, level);
  for (const bad of ["local", "district", "", 1, null]) assert.ok(hasError(breakIt((p) => { at(p, "standard_sources[0]").level = bad; }), "LEVEL_UNKNOWN", "standard_sources[0].level"), String(bad));
  assert.ok(hasError(breakIt((p) => { delete at(p, "standard_sources[0]").level; }), "LEVEL_UNKNOWN", "standard_sources[0].level"), "an ordinance has a level");
  /* (T35-1) a level where R31 requires one, else a sector (R64): never neither */
  for (const id of [FIRST, TEST]) for (const s of must(held(id).standard_sources, "standard_sources"))
    assert.ok(levelledOrSector(s), `${id} ${s.source}`);
  for (const kind of ["statute", "regulation", "ordinance", "court", "policy", "commitment", "standard"])
    assert.ok(breakIt((p) => { at(p, "standard_sources[0]").kind = kind; }).ok, kind);
  assert.ok(hasError(breakIt((p) => { at(p, "standard_sources[0]").cite = { re: "(" }; }), "PATTERN_INVALID", "standard_sources[0].cite"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "standard_sources[0]").issuer; }), "VALUE_INVALID", "standard_sources[0].issuer"));
  assert.ok(breakIt((p) => { delete at(p, "standard_sources[0]").code; }).ok, "code is optional");
  assert.ok(hasError(breakIt((p) => { delete at(p, "vocabulary").codes; }), "CODE_UNKNOWN", "standard_sources[0].code"));
});

test("R24 counterparties: role and body, never a person; level; elected; oversight", () => {
  assert.ok(breakIt((p) => { at(p, "counterparties[1]").oversight = false; }).ok);
  assert.ok(breakIt((p) => { delete at(p, "counterparties[1]").oversight; }).ok, "oversight is optional");
  for (const bad of ["yes", 1, null]) assert.ok(hasError(breakIt((p) => { at(p, "counterparties[1]").oversight = bad; }), "VALUE_INVALID", "counterparties[1].oversight"), String(bad));
  /* absent, whether an office is an oversight body is undetermined: the view gives no marker */
  const v = viewOf(combine([sample()]));
  assert.equal(findIn(v.counterparties, (c) => c.role === "Clerk", "Clerk").oversight, undefined);
  assert.equal(findIn(v.counterparties, (c) => c.role === "Auditor", "Auditor").oversight, true);
  /* an office's level keeps its own vocabulary: district, never federal */
  assert.ok(hasError(breakIt((p) => { at(p, "counterparties[0]").level = "federal"; }), "LEVEL_UNKNOWN", "counterparties[0].level"));
  for (const level of ["state", "county", "city", "district"]) assert.ok(breakIt((p) => { at(p, "counterparties[0]").level = level; }).ok, level);
  assert.ok(hasError(breakIt((p) => { at(p, "counterparties[0]").elected = "no"; }), "VALUE_INVALID", "counterparties[0].elected"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "counterparties[0]").role; }), "VALUE_INVALID", "counterparties[0].role"));
  assert.ok(hasError(breakIt((p) => { at(p, "counterparties[0]").person = "A. Name"; }), "UNKNOWN_SECTION", "counterparties[0].person"));
});

test("R25 action_kinds: kind form, label, tier 1–3, laws, venue {name, how, basis}, no file template on Tier 3, advisory only on Tier 2", () => {
  assert.ok(breakIt((p) => { delete at(p, "action_kinds[2]").advisory; }).ok, "advisory is optional");
  for (const tier of [1, 3]) assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[2]").tier = tier; }), "ADVISORY_NOT_TIER2", "action_kinds[2].advisory"), String(tier));
  assert.ok(hasError(breakIt((p) => { delete at(p, "action_kinds[2]").tier; }), "ADVISORY_NOT_TIER2", "action_kinds[2].advisory"), "no tier, no advisory");
  for (const bad of ["", 3, null]) assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[2]").advisory = bad; }), "VALUE_INVALID", "action_kinds[2].advisory"), String(bad));
  assert.equal(findIn(viewOf(combine([sample()])).action_kinds, (k) => k.kind === "records_petition", "records_petition").advisory, "Have it reviewed first.");
  assert.equal(findIn(viewOf(combine([sample()])).action_kinds, (k) => k.kind === "records_request", "records_request").advisory, undefined);
  for (const how of ["portal", "mail", "email", "in_person", "court"])
    assert.ok(breakIt((p) => { at(p, "action_kinds[0].venue").how = how; }).ok, how);
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[0].venue").how = "fax"; }), "VALUE_INVALID", "action_kinds[0].venue.how"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "action_kinds[0].venue").basis; }), "BASIS_MISSING", "action_kinds[0].venue.basis"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "action_kinds[0]").label; }), "VALUE_INVALID", "action_kinds[0].label"));
  assert.ok(breakIt((p) => { at(p, "action_kinds[1]").laws = ["Records Law", "Sample Town Code"]; }).ok, "laws name records_laws or standard_sources");
  /* No kind of either held profile names a place. */
  for (const id of [FIRST, TEST]) {
    const prof = held(id);
    const placeWords = prof.covers.flatMap((c) => c.toLowerCase().split(/\W+/)).filter((w) => w.length > 3 && !["city", "county"].includes(w));
    for (const k of must(prof.action_kinds, "action_kinds")) for (const w of placeWords) assert.ok(!k.kind.includes(w), `${k.kind} names ${w}`);
    for (const k of must(prof.action_kinds, "action_kinds")) if (k.tier === 3) assert.notEqual(k.template?.use, "file", k.kind);
  }
});

test("R26 deadlines: rule, applies_to, days, count, starts, extension, citation", () => {
  for (const starts of ["received", "filed", "act", "known"]) assert.ok(breakIt((p) => { at(p, "deadlines[0]").starts = starts; }).ok);
  assert.ok(hasError(breakIt((p) => { at(p, "deadlines[0]").starts = "noticed"; }), "ANCHOR_UNKNOWN", "deadlines[0].starts"));
  for (const days of [0, -1, 2.5, "10"]) assert.ok(hasError(breakIt((p) => { at(p, "deadlines[0]").days = days; }), "VALUE_INVALID", "deadlines[0].days"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "deadlines[0]").citation; }), "VALUE_INVALID", "deadlines[0].citation"));
  assert.ok(hasError(breakIt((p) => { at(p, "deadlines[0].extension").days = 0; }), "VALUE_INVALID", "deadlines[0].extension.days"));
  assert.ok(breakIt((p) => { delete at(p, "deadlines[0]").extension; }).ok, "extension is optional");
});

test("R27 an absent action section supplies nothing: the view has none, never a default", () => {
  const p = loose(sample());
  /** @type {("standard_sources" | "counterparties" | "action_kinds" | "deadlines" | "legal_organisations" | "holidays")[]} */
  const SECTIONS = ["standard_sources", "counterparties", "action_kinds", "deadlines", "legal_organisations", "holidays"];
  for (const s of SECTIONS) delete p[s];
  assert.equal(validate(p).ok, true);
  const c = combinedOf(combine([p]));
  for (const s of SECTIONS) assert.equal(c.view[s], undefined, s);
  /* a kind with no tier or venue gives none in the view */
  const q = loose(sample()); delete at(q, "action_kinds[0]").tier; delete at(q, "action_kinds[0]").venue;
  const k = findIn(viewOf(combine([q])).action_kinds, (x) => x.kind === "records_request", "records_request");
  assert.equal(k.tier, undefined); assert.equal(k.venue, undefined);
});

/* ============================================================================================== */
/* combine (R12–R16, R29).                                                                         */

test("R12 combine: UNKNOWN_PROFILE, INVALID_PROFILE with its errors, a profile given twice combined once; never throws", () => {
  const u = combine([FIRST, "nowhere"]);
  assert.equal(u.ok, false);
  assert.deepEqual(u.errors.map((e) => [e.at, e.code]), [[1, "UNKNOWN_PROFILE"]]);
  const bad = sample(); bad.id = "Bad";
  const i = refusalOf(combine([bad, 7, "also-missing"]));
  assert.deepEqual(i.errors.map((e) => [e.at, e.code]), [[0, "INVALID_PROFILE"], [1, "INVALID_PROFILE"], [2, "UNKNOWN_PROFILE"]]);
  assert.deepEqual(must(nth(i.errors, 0, "errors").errors, "the profile's errors").map((e) => e.code), ["ID_INVALID"]);
  const twice = combine([FIRST, FIRST, get(FIRST)]);
  assert.equal(twice.ok, true);
  assert.deepEqual(twice.view.profiles, [FIRST]);
  assert.deepEqual(twice.view, viewOf(combine([FIRST])));
  const other = held(TEST); other.id = FIRST;
  assert.equal(combine([FIRST, other]).ok, false);
  for (const x of [undefined, null, "oakland-alameda", {}, 3]) assert.equal(combine(x).ok, false);
  /** @type {Value[]} */
  const empty = [];
  const trap = new Proxy(empty, { get() { throw new Error("boom"); } });
  assert.equal(combine(trap).ok, false);
});

test("R13 the view has the profile shape, with profiles, covers (union), test, and every fact tagged with its profile", () => {
  const c = combine([FIRST, TEST]);
  assert.equal(c.ok, true);
  const v = c.view;
  assert.deepEqual(v.profiles, [FIRST, TEST]);
  assert.deepEqual(v.covers, [...held(FIRST).covers, ...held(TEST).covers]);
  assert.equal(v.test, true);
  assert.equal(viewOf(combine([FIRST])).test, false);
  /* every fact carries profile beside its basis, and the view reads as a profile */
  let facts = 0;
  walkFacts(v, (fact, path) => {
    facts++;
    assert.ok([FIRST, TEST].includes(String(fact.profile)), `${path} profile`);
    assert.equal(typeof fact.basis, "string", `${path} basis`);
    const bases = fact.bases;
    assert.ok(isList(bases) && bases.every((b) => isObj(b) && b.profile && b.basis), `${path} bases`);
  });
  assert.ok(facts > 60);
  const single = viewOf(combine([FIRST]));
  for (const k of ["spaces", "systems", "mixed_hosts", "vocabulary", "practice", "locale", "search_terms", "records_laws", "standard_sources", "counterparties", "action_kinds", "deadlines"])
    assert.ok(k in single, k);
  for (const k of ["legal_organisations", "holidays"]) assert.ok(k in viewOf(combine([TEST])), k);
  /* a single profile's view recognises what the profile does */
  assert.equal(must(recogniseIn(single, "parcel", "APN 008-0649-012-00"), "APN 008-0649-012-00").normal, "8-649-12-0");
  assert.equal(systemOf(single, "https://oakland.legistar.com/x").origin, "oakland.legistar");
});

test("R14 lists are unioned in order; equal entries kept once carrying both bases; labels joined", () => {
  const a = sample();
  const b = loose(sample()); b.id = "sample-two"; b.name = "Two"; b.covers = ["Two"];
  b.search_terms = [{ term: "second", basis: "M-10" }, { term: "sample", basis: "M-11" }];
  at(b, "spaces.fund").label = "ledger fund";
  at(b, "spaces.fund.forms[0]").basis = "M-12";
  at(b, "vocabulary").bodies = [{ pattern: { re: "Board$" }, basis: "M-13" }, { pattern: { re: "Council$" }, basis: "M-7" }];
  const c = combine([a, b]);
  assert.equal(c.ok, true, c.ok ? "" : JSON.stringify(c.errors));
  assert.deepEqual(must(c.view.search_terms, "search_terms").map((t) => t.term), ["sample", "second"]);
  const s = nth(c.view.search_terms, 0, "search_terms");
  assert.deepEqual(s.bases, [{ profile: "sample-town", basis: "UNMEASURED" }, { profile: "sample-two", basis: "M-11" }]);
  assert.equal(s.profile, "sample-town");
  const bodies = must(must(c.view.vocabulary, "vocabulary").bodies, "bodies");
  assert.deepEqual(bodies.map((x) => x.pattern.re), ["Council$", "Board$"]);
  assert.equal(nth(bodies, 0, "bodies").bases.length, 2);
  assert.equal(viewSpaceOf(c.view, "fund").label, "fund; ledger fund");
  assert.equal(viewSpaceOf(c.view, "fund").forms.length, 1);
  assert.equal(nth(viewSpaceOf(c.view, "fund").forms, 0, "fund forms").bases.length, 2);
  /* order is the order given */
  const r = viewOf(combine([b, a]));
  assert.deepEqual(must(r.search_terms, "search_terms").map((t) => t.term), ["second", "sample"]);
  assert.equal(viewSpaceOf(r, "fund").label, "ledger fund; fund");
  /* the two held profiles share no fact, so nothing merges between them */
  const both = viewOf(combine([FIRST, TEST]));
  assert.equal(must(both.search_terms, "search_terms").length, must(held(FIRST).search_terms, "search_terms").length + must(held(TEST).search_terms, "search_terms").length);
  assert.equal(must(both.systems, "systems").length, must(held(FIRST).systems, "systems").length + must(held(TEST).systems, "systems").length);
});

test("R15 one-value facts are kept only when every giver agrees; otherwise withheld and reported; combine never chooses", () => {
  const a = sample();
  const b = loose(sample()); b.id = "sample-two"; b.name = "Two"; b.covers = ["Two"];
  at(b, "spaces.enactment.kinds[0].floor").first = 200;                   /* floor */
  at(b, "spaces.project.forms[1]").pattern = { re: "^K(\\d{5})$" };        /* a form's definition under its name */
  delete b.crosswalks;                                                     /* its pairs are no longer in form K */
  at(b, "practice.minutes_due_days").value = 30;                           /* practice */
  at(b, "systems[0]").origin = "other.record";                             /* host, no path, another origin */
  listOr(b.systems).push({ origin: "town.record", name: "x", hosts: ["www.sample.example"], basis: "M-1" }); /* mixed in a, system in b */
  b.mixed_hosts = [];
  at(b, "vocabulary.file_numbers[0]").system = "other.record";
  at(b, "spaces.enactment.kinds[0].floor").system = "other.record";
  const c = combine([a, b]);
  assert.equal(c.ok, true, c.ok ? "" : JSON.stringify(c.errors));
  const ats = c.conflicts.map((x) => x.at).sort();
  assert.deepEqual(ats, ["mixed_hosts[www.sample.example]", "practice.minutes_due_days", "spaces.enactment.kinds[law].floor",
    "spaces.project.forms[K]", "systems[host=record.sample.example]"]);
  for (const x of c.conflicts) {
    assert.ok(x.values.length >= 2 && x.values.every((v) => v.profile && "value" in v && v.basis), x.at);
    assert.ok(typeof x.says === "string" && x.says.length > 20);
    assert.ok(new Set(x.values.map((v) => v.profile)).size >= 2);
  }
  const v = c.view;
  assert.equal(findIn(viewSpaceOf(v, "enactment").kinds, (k) => k.kind === "law", "kind law").floor, undefined);
  assert.equal(viewSpaceOf(v, "project").forms.some((f) => f.form === "K"), false);
  assert.equal(viewSpaceOf(v, "project").forms.some((f) => f.form === "J"), true);
  assert.equal(must(v.practice, "practice").minutes_due_days, undefined);
  assert.equal(systemOf(v, "https://record.sample.example/doc").origin, null);
  assert.equal(systemOf(v, "https://www.sample.example/doc").origin, null);
  assert.equal(must(v.mixed_hosts, "mixed_hosts").some((m) => m.host === "www.sample.example"), false);
  /* a path system on a host the other profile marks mixed still names its system */
  assert.equal(systemOf(v, "https://api.shared.example/town/1").origin, "town.record");
  /* agreement keeps the fact */
  const d = loose(sample()); d.id = "sample-three"; d.name = "Three"; d.covers = ["Three"];
  at(d, "spaces.enactment.kinds[0].floor").basis = "M-99";
  const e = combinedOf(combine([a, d]));
  assert.deepEqual(e.conflicts, []);
  const floor = must(nth(viewSpaceOf(e.view, "enactment").kinds, 0, "enactment kinds").floor, "floor");
  assert.equal(floor.first, 100);
  assert.equal(floor.bases.length, 2);
  /* different paths on one host do not conflict */
  const f = loose(sample()); f.id = "sample-four"; f.name = "Four"; f.covers = ["Four"];
  f.systems = [{ origin: "four.record", name: "x", hosts: ["api.shared.example"], path: { re: "^/four/" }, basis: "M-1" }];
  at(f, "vocabulary").file_numbers = []; delete at(f, "spaces.enactment").kinds;
  assert.deepEqual(combinedOf(combine([a, f])).conflicts, []);
});

test("R16 an empty list gives ok and a view with no facts", () => {
  const c = combine([]);
  assert.equal(c.ok, true);
  assert.deepEqual(c.conflicts, []);
  assert.deepEqual(c.view.profiles, []);
  assert.deepEqual(c.view.covers, []);
  assert.equal(c.view.test, false);
  let facts = 0; walkFacts(c.view, () => facts++);
  assert.equal(facts, 0);
  /** @type {("spaces" | "systems" | "mixed_hosts" | "crosswalks" | "vocabulary" | "practice" | "locale" | "search_terms" | "records_laws" | "standard_sources" | "counterparties" | "action_kinds" | "deadlines" | "legal_organisations" | "holidays")[]} */
  const sections = ["spaces", "systems", "mixed_hosts", "crosswalks", "vocabulary", "practice", "locale", "search_terms", "records_laws", "standard_sources", "counterparties", "action_kinds", "deadlines", "legal_organisations", "holidays"];
  for (const k of sections)
    assert.equal(c.view[k], undefined, k);
});

test("R29 action facts with one value per key: a kind's tier, venue, template; a deadline's days, count, starts", () => {
  const a = sample();
  const b = loose(sample()); b.id = "sample-two"; b.name = "Two"; b.covers = ["Two"];
  at(b, "action_kinds[0]").tier = 2;
  at(b, "action_kinds[0].venue").how = "portal";
  at(b, "action_kinds[0]").template = tpl({ text: "Kindly send the records under {{law}}." });
  at(b, "deadlines[0]").days = 20; at(b, "deadlines[0]").count = "business"; at(b, "deadlines[0]").starts = "filed";
  const c = combinedOf(combine([a, b]));
  /* `days: n` reads as units: days, amount: n (R26), so a different number of days is a different amount */
  assert.deepEqual(c.conflicts.map((x) => x.at).sort(), ["action_kinds[records_request].template", "action_kinds[records_request].tier",
    "action_kinds[records_request].venue", "deadlines[answer/records_request].amount", "deadlines[answer/records_request].count",
    "deadlines[answer/records_request].starts"]);
  const k = findIn(c.view.action_kinds, (x) => x.kind === "records_request", "records_request");
  /** @type {("tier" | "venue" | "template")[]} */
  const kindFacts = ["tier", "venue", "template"];
  for (const f of kindFacts) assert.equal(k[f], undefined, f);
  const d = findIn(c.view.deadlines, (x) => x.rule === "answer", "answer");
  /** @type {("days" | "amount" | "count" | "starts")[]} */
  const deadlineFacts = ["days", "amount", "count", "starts"];
  for (const f of deadlineFacts) assert.equal(d[f], undefined, f);
  /* the other kind agrees and keeps its facts */
  const other = findIn(c.view.action_kinds, (x) => x.kind === "code_complaint", "code_complaint");
  assert.equal(other.tier, 3); assert.equal(must(other.venue, "venue").how, "court");
  /* agreeing profiles keep every value */
  const same = loose(sample()); same.id = "sample-three"; same.name = "Three"; same.covers = ["Three"];
  const e = combinedOf(combine([a, same]));
  assert.deepEqual(e.conflicts, []);
  const kk = findIn(e.view.action_kinds, (x) => x.kind === "records_request", "records_request");
  assert.equal(kk.tier, 1); assert.equal(must(kk.venue, "venue").how, "email"); assert.equal(must(kk.template, "template").text, "Please send the records under {{law}}.");
  assert.equal(nth(e.view.deadlines, 0, "deadlines").days, 10);
});

/* ============================================================================================== */
/* Invariants (R17–R22, R30).                                                                      */

test("R17 pure: no store, no network, no clock; the same inputs give the same answer", async () => {
  const saved = { fetch: globalThis.fetch, now: Date.now, random: Math.random };
  /** @type {string[]} */
  const calls = [];
  globalThis.fetch = () => { calls.push("fetch"); throw new Error("network"); };
  Date.now = () => { calls.push("clock"); throw new Error("clock"); };
  Math.random = () => { calls.push("random"); throw new Error("random"); };
  try {
    /** @type {typeof import("../index.mjs")} */
    const mod = await import(`../index.mjs?fresh=${1}`);
    const runs = () => JSON.stringify([mod.list(), mod.get(FIRST), mod.get(TEST), mod.validate(sample()),
      mod.combine([FIRST, TEST]), mod.combine([sample(), TEST])]);
    const one = runs();
    assert.equal(runs(), one);
    assert.equal(JSON.stringify([list(), get(FIRST), get(TEST), validate(sample()), combine([FIRST, TEST]), combine([sample(), TEST])]), one);
  } finally {
    globalThis.fetch = saved.fetch; Date.now = saved.now; Math.random = saved.random;
  }
  assert.deepEqual(calls, []);
});

test("R18 what get and combine return is the caller's own copy", () => {
  const before = JSON.stringify([get(FIRST), combine([FIRST, TEST]), list()]);
  const g = held(FIRST);
  at(g, "spaces.enactment.kinds[0].floor").first = 1; must(g.systems, "systems").splice(0); g.covers.push("X"); g.id = "changed";
  const c = combinedOf(combine([FIRST, TEST]));
  viewSpaceOf(c.view, "parcel").forms.splice(0); c.view.covers.splice(0); listOr(at(c.view, "vocabulary.codes[0]").bases).push({}); listOr(c.conflicts).push({});
  const l = list(); nth(l, 0, "list").covers.push("Y"); l.pop();
  const obj = sample();
  const v = viewOf(combine([obj])); nth(v.search_terms, 0, "search_terms").term = "mutated";
  assert.equal(nth(obj.search_terms, 0, "search_terms").term, "sample");
  nth(obj.search_terms, 0, "search_terms").term = "changed-after";
  assert.equal(nth(v.search_terms, 0, "search_terms").term, "mutated");
  assert.equal(JSON.stringify([get(FIRST), combine([FIRST, TEST]), list()]), before);
});

test("R19 every held profile passes validate, and no two share an id", () => {
  const ids = list().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.deepEqual(validate(get(id)), { ok: true, errors: [] }, id);
});

/** Drops the profile tags from a loose copy, at every depth: with `loose`, what `JSON.parse(JSON.stringify(v, replacer))`
 *  gives with a replacer that drops `profile` and `profiles`.
 *  @param {Value} v
 *  @returns {void} */
function untag(v) {
  if (isList(v)) { for (const x of v) untag(x); return; }
  if (isObj(v)) {
    delete v.profile; delete v.profiles;
    for (const x of Object.values(v)) untag(x);
  }
}

test("R20 no service treats a profile by its identity", () => {
  for (const id of [FIRST, TEST]) {
    const orig = held(id);
    const renamed = { ...held(id), id: "renamed-x", name: "Renamed", covers: ["Somewhere Else"] };
    assert.deepEqual(validate(renamed), validate(orig));
    /* the profile tags go at every depth; `id`, `name` and `covers` only as the view's own, so a fact's own name (a legal
       organisation's, a template's, R87) is still compared */
    /** @param {Value} v @returns {Fields} */
    const tags = (v) => { const c = loose(v); untag(c); return c; };
    /** @param {Value} view @returns {Fields} */
    const scrub = (view) => { const t = tags(view); delete t.id; delete t.name; delete t.covers; return t; };
    /** @param {Value} r @returns {Fields} */
    const scrubResult = (r) => { const t = tags(r); t.view = scrub(t.view); return t; };
    assert.deepEqual(scrub(viewOf(combine([renamed]))), scrub(viewOf(combine([orig]))));
    assert.deepEqual(scrubResult(combine([renamed, TEST === id ? FIRST : TEST])), scrubResult(combine([orig, TEST === id ? FIRST : TEST])));
    /* the T45 fields are in what is compared (R83 by this test) */
    const v = scrub(viewOf(combine([orig])));
    for (const s of ["legal_facts", "records_laws", "deadlines", "legal_organisations"]) { const x = v[s]; assert.ok(isList(x) && x.length, `${id} ${s}`); }
  }
});

test("R21 the first profile holds every local fact of the snapshot's code, and matches every string that code matched", () => {
  const f = held(FIRST);
  assert.deepEqual(f.covers, ["City of Oakland", "Alameda County"]);
  assert.equal(f.test, false);
  /* spaces: labels, forms, kinds, floors with their system */
  /* the snapshot's four spaces, T33's person scheme for Legistar's PersonId and proceeding numbers, and T34's Legistar
     BodyId and OfficeRecordId (R3, R61) */
  assert.deepEqual(Object.keys(must(f.spaces, "spaces")).sort(), ["body", "enactment", "fund", "office", "parcel", "person", "proceeding", "project"]);
  /** @type {[SpaceName, string][]} */
  const snapshotSpaces = [["enactment", "cms"], ["project", "project"], ["fund", "fund"], ["parcel", "apn"]];
  for (const [sp, old] of snapshotSpaces) {
    const was = must(legacy.ID_SPACES[old], `legacy space ${old}`);
    assert.equal(spaceOf(f, sp).label, was.label, sp);
    assert.deepEqual(spaceOf(f, sp).forms.map((x) => x.form), was.forms.map((x) => x.form), sp);
  }
  /** @type {{ [kind: string]: number }} */
  const floors = {};
  for (const k of must(spaceOf(f, "enactment").kinds, "enactment kinds")) floors[k.kind] = must(k.floor, `${k.kind} floor`).first;
  assert.deepEqual(floors, legacy.CMS_FLOOR);
  for (const k of must(spaceOf(f, "enactment").kinds, "enactment kinds")) assert.equal(must(k.floor, `${k.kind} floor`).system, "oakland.legistar");
  assert.equal(f.crosswalks, undefined, "M-157: none captured");
  /* recognition: every string the legacy recogniser matched, the profile matches with the same form,
     normal and kind, over a generated corpus and the measured values */
  const corpus = legacy.corpus();
  assert.ok(corpus.length > 2000);
  const view = viewOf(combine([FIRST]));
  let matched = 0;
  for (const [space, old] of snapshotSpaces)
    for (const value of corpus) {
      const was = legacy.recognise(old, value);
      const now = recogniseIn(view, space, value);
      if (!was) { assert.equal(now, null, `${space} ${JSON.stringify(value)} newly matched`); continue; }
      matched++;
      assert.ok(now, `${space} ${JSON.stringify(value)} no longer matched`);
      assert.deepEqual([now.form, now.normal], [was.form, was.normal], `${space} ${JSON.stringify(value)}`);
      if (space === "enactment") assert.equal(now.kind, was.kind, value ?? undefined);
    }
  assert.ok(matched > 500, `${matched}`);
  /* systems: every legacy entry, in order, with the same answers for their addresses */
  /* the snapshot's systems first; T33 adds the three court registers (K1514), on hosts the snapshot never named */
  const systems = must(f.systems, "systems");
  assert.equal(systems.length, legacy.ID_SYSTEMS.length + 3);
  assert.deepEqual(systems.slice(legacy.ID_SYSTEMS.length).map((s) => s.origin), ["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"]);
  for (const address of legacy.addresses()) {
    const was = legacy.systemOfAddress(address);
    const now = systemOf(view, address);
    assert.deepEqual([now.origin, now.republishes === true, now.provenance_stated !== false, !!now.mixed],
      [was.origin, !!was.republication, was.origin ? was.provenance_stated : true, !!was.mixed], address);
  }
  assert.deepEqual(must(f.mixed_hosts, "mixed_hosts").map((m) => m.host).sort(), Object.keys(legacy.MIXED_HOSTS).sort());
  /* vocabulary: each recogniser's local pattern has an entry matching the same lines */
  const vocabulary = at(loose(f), "vocabulary");
  for (const [key, samples] of Object.entries(legacy.vocabularySamples())) {
    const entries = vocabulary[key];
    assert.ok(isList(entries) && entries.length, key);
    for (const [line, expect] of samples) {
      const hit = listOr(entries).some((e) => { const p = at(e, "pattern"); return new RegExp(String(p.re), String(p.flags || "")).test(line); });
      assert.equal(hit, expect, `${key}: ${JSON.stringify(line)}`);
    }
  }
  /* the snapshot's code, then T33's charter (K1514) */
  assert.deepEqual(must(must(f.vocabulary, "vocabulary").codes, "codes").map((c) => [c.key, c.label]), [["omc", "O.M.C."], ["charter", "Oakland City Charter"]]);
  assert.deepEqual(must(must(f.vocabulary, "vocabulary").file_numbers, "file_numbers").map((x) => x.system), ["oakland.legistar"]);
  /* practice, search terms, records law */
  /* the snapshot's 21 days on no measurement, corrected to OMC 2.20.160's ten business days (R21, R56; K1504) */
  assert.notEqual(legacy.MINUTES_DUE_DAYS, 10);
  assert.deepEqual(must(f.practice, "practice").minutes_due_days, { value: 10, count: "business", closures: "city", basis: "2026-10-05 time-law" });
  assert.deepEqual(must(f.search_terms, "search_terms").map((t) => t.term), legacy.SEARCH_TERMS);
  /* the snapshot's records law first; T33's sourced rule set adds the City's and the federal one (R56) */
  assert.deepEqual(must(f.records_laws, "records_laws").map((l) => [l.level, l.name]), [["state", "California Public Records Act"],
    ["city", "Oakland Sunshine Ordinance"], ["federal", "Freedom of Information Act"]]);
  assert.equal(nth(f.records_laws, 0, "records_laws").basis, "D-149");
  /* every basis names a measurement or ruling, or says UNMEASURED */
  walkFacts(f, (fact, path) => assert.match(String(fact.basis), /^(UNMEASURED|(M-\d+|\d{4}-\d{2}-\d{2}|D-\d+|DEC-\d+|K\d+)( [^\s,;]+)?([,;] (M-\d+|\d{4}-\d{2}-\d{2}|D-\d+|DEC-\d+|K\d+)( [^\s,;]+)?)*)$/, path));
});

test("R22 the test profile: test true, every basis TEST, every section and vocabulary key of the first with different values, no shared host", () => {
  const t = held(TEST), f = held(FIRST);
  assert.equal(t.test, true);
  let n = 0;
  walkFacts(t, (fact, path) => { n++; assert.equal(fact.basis, "TEST", path); });
  assert.ok(n > 30);
  const lt = loose(t), lf = loose(f);
  for (const sec of Object.keys(lf)) {
    if (["id", "name", "covers", "test"].includes(sec)) continue;
    assert.ok(sec in lt, `section ${sec}`);
    assert.notDeepEqual(lt[sec], lf[sec], sec);
  }
  const fSpaces = at(lf, "spaces"), tSpaces = at(lt, "spaces");
  for (const sp of Object.keys(fSpaces)) {
    assert.ok(tSpaces[sp], sp);
    assert.notEqual(at(tSpaces, sp).label, at(fSpaces, sp).label);
    for (const form of listOr(at(tSpaces, sp).forms).map(fieldsOf))
      assert.ok(!listOr(at(fSpaces, sp).forms).map(fieldsOf).some((x) => x.form === form.form || at(x, "pattern").re === at(form, "pattern").re), `${sp} ${String(form.form)}`);
  }
  assert.ok(must(spaceOf(t, "enactment").kinds, "enactment kinds").length);
  /* a pattern key's entries differ in their patterns; a data key's (R58, R60) in their values */
  /** @param {Value} v @returns {string} */
  const differs = (v) => { const e = fieldsOf(v); const p = e.pattern; return isObj(p) ? String(p.re) : JSON.stringify({ ...e, basis: undefined }); };
  const fVocabulary = at(lf, "vocabulary"), tVocabulary = at(lt, "vocabulary");
  for (const key of Object.keys(fVocabulary)) {
    const entries = tVocabulary[key];
    assert.ok(isList(entries) && entries.length, key);
    const fr = new Set(listOr(fVocabulary[key]).map(differs));
    for (const e of listOr(entries)) assert.ok(!fr.has(differs(e)), `${key} ${differs(e)}`);
  }
  assert.notEqual(must(must(t.practice, "practice").minutes_due_days, "minutes_due_days").value, must(must(f.practice, "practice").minutes_due_days, "minutes_due_days").value);
  /** @param {Profile} p @returns {Set<string>} */
  const hosts = (p) => new Set([...must(p.systems, "systems").flatMap((s) => s.hosts), ...must(p.mixed_hosts, "mixed_hosts").map((m) => m.host)]);
  const fh = hosts(f);
  for (const h of hosts(t)) assert.ok(!fh.has(h), h);
  for (const c of t.covers) assert.ok(!f.covers.includes(c));
  /* combining the two gives no conflict: they share nothing */
  assert.deepEqual(combinedOf(combine([FIRST, TEST])).conflicts.filter((c) => !c.at.startsWith("practice") && !["locale", "time_zone", "weekend", "records_help", "fiscal_year[*]"].includes(c.at)
    && !c.at.startsWith("action_kinds[records_request]")), []);
  /* R93: both profiles now hold a records_help block, differing in every value by design (R84), so that one fact is withheld */
  assert.deepEqual(combinedOf(combine([FIRST, TEST])).conflicts.filter((c) => c.at === "records_help").length, 1);
  /* R49: both profiles state a year for body *, differing by design (R22), so that one fact is withheld (R15) */
  assert.deepEqual(combinedOf(combine([FIRST, TEST])).conflicts.filter((c) => c.at === "fiscal_year[*]").length, 1);
});

test("R30 the first profile's action sections: the snapshot's action kinds renamed, §8 tiers, the records law's period and citation, the offices", () => {
  const f = held(FIRST);
  const kinds = must(f.action_kinds, "action_kinds");
  const renamed = legacy.ACTION_KINDS.map((k) => (k === "cpra_request" ? "records_request" : k));
  /* the snapshot's kinds, renamed, first and in order; Design Requirement 8's Tier 2 and 3 kinds follow (R36) */
  assert.deepEqual(kinds.slice(0, renamed.length).map((k) => k.kind), renamed);
  assert.ok(kinds.slice(renamed.length).every((k) => { const tier = k.tier; return tier === 2 || tier === 3; }));
  for (const k of kinds) assert.match(k.kind, /^[a-z][a-z0-9_]*$/);
  /* Roadmap v5 §8 names Tier 1 for records requests, grand jury complaints, State Controller referrals and
     media outreach, and no tier for the others; D-182 adopted §8's words. R85 (T45) adds public comment at Tier 1, on
     Design Requirement 8's words (K2785), and two Tier 2 kinds (K2785; v0.2 rule 13, K2780). */
  /** @type {{ [kind: string]: Tier | undefined }} */
  const tiers = {};
  for (const k of kinds) tiers[k.kind] = k.tier;
  assert.deepEqual(Object.fromEntries(Object.entries(tiers).filter(([k]) => renamed.includes(k))), { records_request: 1, grand_jury: 1, controller_referral: 1, public_comment: 1,
    media: 1, litigation_support: undefined, request_for_comment: undefined, other: undefined });
  /** @type {{ [kind: string]: string }} */
  const T45_TIERED = { public_comment: "K2785", brown_act_demand: "K2785", party_participation: "K2780" };
  for (const k of kinds) if (k.tier !== undefined) assert.equal(k.basis, T45_TIERED[k.kind] ?? "D-182", k.kind);
  const rr = findIn(kinds, (k) => k.kind === "records_request", "records_request");
  assert.deepEqual(rr.laws, ["California Public Records Act", "Oakland Sunshine Ordinance"]);
  const d = findIn(f.deadlines, (x) => x.rule === "records_response", "records_response");
  assert.deepEqual([d.applies_to, d.units, d.amount, d.count, d.starts, d.citation], ["records_request", "days", 10, "calendar", "received", "Cal. Gov. Code § 7922.535(a)"]);
  /* from T33 no deadline or counterparty rests on UNMEASURED: each is sourced (R44, R56; K1445) */
  const deadlines = must(f.deadlines, "deadlines"), counterparties = must(f.counterparties, "counterparties");
  for (const x of deadlines) assert.notEqual(x.basis, "UNMEASURED", x.rule);
  for (const x of counterparties) assert.notEqual(x.basis, "UNMEASURED", x.role);
  for (const x of deadlines) assert.equal(x.status, "researched", x.rule);
  assert.ok(counterparties.length >= 3);
  for (const c of counterparties) assert.ok(!/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(c.role) || /Controller|Council|Grand Jury|Auditor/.test(c.role), `role names an office: ${c.role}`);
  const bodies = counterparties.map((c) => c.body).join(" | ");
  for (const office of ["Grand Jury", "State Controller", "City Council", "Finance"]) assert.ok(bodies.includes(office), office);
  /* the test profile supplies every action section too */
  const t = held(TEST);
  /** @type {("standard_sources" | "counterparties" | "action_kinds" | "deadlines")[]} */
  const actionSections = ["standard_sources", "counterparties", "action_kinds", "deadlines"];
  for (const s of actionSections) { const xs = t[s]; assert.ok(xs && xs.length, s); }
  assert.ok(must(t.deadlines, "deadlines").some((x) => x.applies_to === "claim"));
  assert.ok(must(t.action_kinds, "action_kinds").some((x) => x.tier === 3 && !(x.template?.use === "file")));
});

/* ============================================================================================== */
/* K44 (Q1): the sentences added to R2, R12, R13, R14, R25 and R29.                                */

test("R2 K44 basis grammar: tokens, a qualifying word, joined by ', ' or '; '", () => {
  for (const b of ["M-1 LEG", "K12; DEC-3", "2026-08-03, M-24", "D-149 (4)"]) assert.ok(breakIt((p) => { at(p, "systems[0]").basis = b; }).ok, b);
  for (const b of ["LEG M-1", "M-1 and M-2", "X-1", "M-1,,M-2", "2026-8-3"])
    assert.ok(hasError(breakIt((p) => { at(p, "systems[0]").basis = b; }), "BASIS_INVALID", "systems[0].basis"), b);
});

test("R12 K44 combine errors: two profiles under one id, a list that is not an array, an unknown entry field", () => {
  const other = held(TEST); other.id = FIRST;
  const two = refusalOf(combine([FIRST, other]));
  assert.deepEqual(two.errors.map((e) => [e.at, e.code]), [[1, "INVALID_PROFILE"]]);
  for (const x of [undefined, null, FIRST, { 0: FIRST, length: 1 }, 3])
    assert.deepEqual(refusalOf(combine(x)).errors.map((e) => e.code), ["NOT_A_LIST"], String(x));
  const extra = loose(sample()); at(extra, "search_terms[0]").weight = 2;
  const c = combine([extra]);
  assert.equal(c.ok, false);
  assert.equal(nth(c.errors, 0, "errors").code, "INVALID_PROFILE");
  assert.deepEqual(must(nth(c.errors, 0, "errors").errors, "the profile's errors").map((e) => [e.path, e.code]), [["search_terms[0].weight", "UNKNOWN_SECTION"]]);
});

test("R13 K44 the view's id is the combined ids joined by '+', and it has a name", () => {
  const v = viewOf(combine([FIRST, TEST]));
  assert.equal(v.id, `${FIRST}+${TEST}`);
  assert.equal(viewOf(combine([TEST, FIRST])).id, `${TEST}+${FIRST}`);
  assert.equal(viewOf(combine([FIRST])).id, FIRST);
  assert.ok(typeof v.name === "string" && v.name.includes(held(FIRST).name) && v.name.includes(held(TEST).name));
});

test("R25 K44 tier and venue are optional; absent, they are undetermined", () => {
  assert.ok(breakIt((p) => { delete at(p, "action_kinds[0]").tier; delete at(p, "action_kinds[0]").venue; }).ok);
  assert.ok(breakIt((p) => { const k = at(p, "action_kinds[0]"); delete k.tier; delete k.venue; delete k.template; delete k.laws; }).ok);
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[0]").venue = null; }), "VALUE_INVALID", "action_kinds[0].venue"));
  const f = held(FIRST);
  for (const k of must(f.action_kinds, "action_kinds").filter((x) => x.tier === undefined)) assert.equal(k.venue, undefined, k.kind);
});

test("R29 K44 labels and citations joined with '; ', laws unioned, an extension one value per key", () => {
  const a = sample();
  const b = loose(sample()); b.id = "sample-two"; b.name = "Two"; b.covers = ["Two"];
  listOr(b.records_laws).push({ level: "city", name: "Open Town Bylaw", citation: "OTB § 1", basis: "M-1" });
  at(b, "action_kinds[0]").label = "request for records";
  at(b, "action_kinds[0]").laws = ["Open Town Bylaw", "Records Law"];
  at(b, "deadlines[0]").citation = "RL § 2(a)";
  at(b, "deadlines[0]").extension = { days: 7, count: "business", when: "busy" };
  const c = combinedOf(combine([a, b]));
  const k = findIn(c.view.action_kinds, (x) => x.kind === "records_request", "records_request");
  assert.equal(k.label, "records request; request for records");
  assert.deepEqual(k.laws, ["Records Law", "Open Town Bylaw"]);
  const d = findIn(c.view.deadlines, (x) => x.rule === "answer", "answer");
  assert.equal(d.citation, "RL § 2; RL § 2(a)");
  assert.equal(d.extension, undefined);
  assert.deepEqual(c.conflicts.map((x) => x.at), ["deadlines[answer/records_request].extension"]);
  const same = loose(sample()); same.id = "sample-three"; same.name = "Three"; same.covers = ["Three"];
  const e = combinedOf(combine([a, same]));
  assert.equal(nth(e.view.action_kinds, 0, "action_kinds").label, "records request");
  assert.deepEqual(nth(e.view.deadlines, 0, "deadlines").extension, { days: 5, count: "business", when: "busy" });
  assert.equal(nth(e.view.deadlines, 0, "deadlines").citation, "RL § 2");
});

/* ============================================================================================== */
/* K102 (N61, N65 (4)): law levels, oversight, advisory, legal organisations, holidays (R29, R31–R36). */

/** A second sample profile, `sample-two`, read loosely and changed by `fn`.
 *  @param {(b: Fields) => void} fn
 *  @returns {Fields} */
const two = (fn) => { const b = loose(sample()); b.id = "sample-two"; b.name = "Two"; b.covers = ["Two"]; fn(b); return b; };

test("R31 LAW_LEVELS: federal, state, county, city in that order, the one vocabulary of records laws and standard sources", () => {
  assert.deepEqual([...LAW_LEVELS], ["federal", "state", "county", "city"]);
  assert.ok(Object.isFrozen(LAW_LEVELS));
  /* exactly these, for both law sections; D-149's local is never a level a profile records */
  const levels = ["federal", "state", "county", "city", "local", "district", "regional", "FEDERAL", ""];
  for (const level of levels) {
    const ok = LAW_LEVELS.includes(level);
    assert.equal(breakIt((p) => { at(p, "records_laws[0]").level = level; }).ok, ok, `records_laws ${level}`);
    assert.equal(breakIt((p) => { at(p, "standard_sources[0]").level = level; }).ok, ok, `standard_sources ${level}`);
  }
  /* an office's level keeps its own vocabulary */
  for (const level of ["state", "county", "city", "district"]) assert.ok(breakIt((p) => { at(p, "counterparties[0]").level = level; }).ok, level);
  assert.equal(breakIt((p) => { at(p, "counterparties[0]").level = "federal"; }).ok, false);
  /* the combined view carries each law's level as given */
  const v = viewOf(combine([sample(), two((b) => { listOr(b.records_laws).push({ level: "federal", name: "Federal Act", citation: "F § 1", basis: "M-1" }); })]));
  assert.deepEqual(must(v.records_laws, "records_laws").map((l) => [l.name, l.level]), [["Records Law", "state"], ["Federal Act", "federal"]]);
});

test("R32 R78 legal_organisations: name, evaluates (Tier 2 or 3 kinds of the profile, R78), contacts {how, value}", () => {
  assert.ok(validate(sample()).ok);
  for (const how of ["web", "email", "phone", "mail"]) assert.ok(breakIt((p) => { at(p, "legal_organisations[0].contacts[0]").how = how; }).ok, how);
  assert.ok(hasError(breakIt((p) => { at(p, "legal_organisations[0]").evaluates = ["records_request"]; }), "ORG_KIND_UNKNOWN", "legal_organisations[0].evaluates[0]"), "Tier 1 kind");
  /* R78 (T45) widens R32: a Tier 2 kind may be evaluated */
  assert.ok(breakIt((p) => { at(p, "legal_organisations[0]").evaluates = ["records_petition"]; }).ok, "Tier 2 kind");
  assert.ok(hasError(breakIt((p) => { at(p, "legal_organisations[0]").evaluates = ["code_complaint", "nowhere"]; }), "ORG_KIND_UNKNOWN", "legal_organisations[0].evaluates[1]"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "action_kinds[1]").tier; }), "ORG_KIND_UNKNOWN"), "a kind with no tier is not Tier 2 or 3");
  /* R78: an empty list is no purpose unless the entry defends (ORG_PURPOSE_MISSING) */
  assert.ok(hasError(breakIt((p) => { at(p, "legal_organisations[0]").evaluates = []; }), "ORG_PURPOSE_MISSING", "legal_organisations[0].evaluates"));
  for (const bad of ["code_complaint", null]) assert.ok(hasError(breakIt((p) => { at(p, "legal_organisations[0]").evaluates = bad; }), "VALUE_INVALID", "legal_organisations[0].evaluates"), JSON.stringify(bad));
  assert.ok(hasError(breakIt((p) => { at(p, "legal_organisations[0]").name = ""; }), "VALUE_INVALID", "legal_organisations[0].name"));
  assert.ok(hasError(breakIt((p) => { at(p, "legal_organisations[0].contacts[0]").extra = 1; }), "UNKNOWN_SECTION", "legal_organisations[0].contacts[0].extra"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "legal_organisations[0]").basis; }), "BASIS_MISSING", "legal_organisations[0].basis"));
});

test("R33 holidays: a four-digit year, its closure days {date, name} within it, each once; a listed year is complete", () => {
  assert.ok(validate(sample()).ok, "2024-02-29 is a date");
  for (const year of [26, 20260, "2026", 2026.5, null]) assert.ok(hasError(breakIt((p) => { at(p, "holidays[0]").year = year; }), "HOLIDAY_INVALID", "holidays[0].year"), String(year));
  assert.ok(hasError(breakIt((p) => { at(p, "holidays[1]").year = 2026; at(p, "holidays[1].days[0]").date = "2026-02-28"; }), "HOLIDAY_INVALID", "holidays[1].year"), "a year twice");
  assert.ok(breakIt((p) => { at(p, "holidays[2]").offices = ["Auditor"]; }).ok, "a year again, for an office");
  for (const date of ["2026-02-29", "2026-13-01", "2026-04-31", "2026-1-01", "26-01-01", "2026/01/01", "", null])
    assert.ok(hasError(breakIt((p) => { at(p, "holidays[0].days[0]").date = date; }), "HOLIDAY_INVALID", "holidays[0].days[0].date"), String(date));
  assert.ok(hasError(breakIt((p) => { at(p, "holidays[0].days[0]").date = "2025-12-31"; }), "HOLIDAY_INVALID", "holidays[0].days[0].date"), "outside its year");
  assert.ok(hasError(breakIt((p) => { at(p, "holidays[0].days[1]").date = "2026-01-01"; }), "HOLIDAY_INVALID", "holidays[0].days[1].date"), "a date twice");
  assert.ok(hasError(breakIt((p) => { at(p, "holidays[0].days[0]").name = ""; }), "VALUE_INVALID", "holidays[0].days[0].name"));
  assert.ok(breakIt((p) => { at(p, "holidays[0]").days = []; }).ok, "a year with no closure day is a complete listing");
  /* the view gives each listed year's days and nothing for a year not listed: a count reaching there is undetermined */
  const v = viewOf(combine([TEST]));
  assert.deepEqual(must(v.holidays, "holidays").map((h) => h.year), must(held(TEST).holidays, "holidays").map((h) => h.year));
  assert.equal(must(v.holidays, "holidays").find((h) => h.year === 2025), undefined);
  assert.deepEqual([...new Set(must(viewOf(combine([FIRST])).holidays, "holidays").filter((h) => !h.list).map((h) => h.year))], [2026],
    "the first profile's office calendars list only 2026, the year published (its closure lists are R47's)");
});

test("R34 combine: legal organisations unioned; a year's holidays one value, withheld and reported when profiles disagree", () => {
  const a = sample();
  const same = two((b) => { const h = at(b, "holidays[0]"); h.days = listOr(h.days).slice().reverse(); h.basis = "M-40"; at(b, "legal_organisations[0]").basis = "M-41"; });
  const e = combinedOf(combine([a, same]));
  assert.deepEqual(e.conflicts, []);
  assert.equal(must(e.view.legal_organisations, "legal_organisations").length, 1);
  assert.deepEqual(nth(e.view.legal_organisations, 0, "legal_organisations").bases, [{ profile: "sample-town", basis: "M-11" }, { profile: "sample-two", basis: "M-41" }]);
  const y = findIn(e.view.holidays, (h) => h.year === 2026, "2026");
  assert.deepEqual(y.days.map((d) => d.date), ["2026-01-01", "2026-07-04"], "order is no disagreement");
  assert.deepEqual(y.bases, [{ profile: "sample-town", basis: "M-12" }, { profile: "sample-two", basis: "M-40" }]);
  const b = two((x) => {
    listOr(at(x, "holidays[0]").days).push({ date: "2026-11-26", name: "Harvest" });
    listOr(x.holidays).push({ year: 2027, days: [], status: "researched", basis: "M-1" });
    listOr(x.legal_organisations).push({ name: "Other Centre", evaluates: ["code_complaint"], contacts: [{ how: "web", value: "https://o.example" }], basis: "M-1" });
  });
  const c = combinedOf(combine([a, b]));
  assert.deepEqual(c.conflicts.map((x) => x.at), ["holidays[2026]"]);
  const first = nth(c.conflicts, 0, "conflicts");
  assert.ok(first.values.length === 2 && first.values.every((v) => isList(v.value)));
  assert.deepEqual(must(c.view.holidays, "holidays").map((h) => [h.year, !!h.offices]), [[2024, false], [2026, true], [2027, false]],
    "2026 for all offices withheld; 2026 for the office, on which they agree, and the years only one profile lists are kept");
  assert.deepEqual(must(c.view.legal_organisations, "legal_organisations").map((o) => o.name), ["Town Law Centre", "Other Centre"]);
});

test("R35 validate codes for R31–R33, and the new sections are known", () => {
  /** @type {{ [code: string]: [(p: Fields) => void, string] }} */
  const cases = {
    LEVEL_UNKNOWN: [(p) => { at(p, "records_laws[0]").level = "local"; }, "records_laws[0].level"],
    ADVISORY_NOT_TIER2: [(p) => { at(p, "action_kinds[0]").advisory = "Review it."; }, "action_kinds[0].advisory"],
    ORG_KIND_UNKNOWN: [(p) => { at(p, "legal_organisations[0]").evaluates = ["media"]; }, "legal_organisations[0].evaluates[0]"],
    CONTACT_INVALID: [(p) => { at(p, "legal_organisations[0]").contacts = []; }, "legal_organisations[0].contacts"],
    HOLIDAY_INVALID: [(p) => { at(p, "holidays[0]").year = 99; }, "holidays[0].year"],
  };
  for (const [code, [fn, path]] of Object.entries(cases)) assert.ok(hasError(breakIt(fn), code, path), code);
  /** @type {[(p: Fields) => void, string][]} */
  const contactCases = [[(p) => { at(p, "legal_organisations[0].contacts[0]").how = "fax"; }, "legal_organisations[0].contacts[0].how"],
    [(p) => { at(p, "legal_organisations[0].contacts[0]").value = ""; }, "legal_organisations[0].contacts[0].value"],
    [(p) => { put(p, "legal_organisations[0].contacts[0]", "help@x"); }, "legal_organisations[0].contacts[0]"],
    [(p) => { at(p, "legal_organisations[0]").contacts = null; }, "legal_organisations[0].contacts"]];
  for (const [fn, path] of contactCases)
    assert.ok(hasError(breakIt(fn), "CONTACT_INVALID", path), path);
  const v = validate(sample());
  assert.ok(!v.errors.some((e) => e.code === "UNKNOWN_SECTION"));
  for (const sec of ["legal_organisations", "holidays"]) {
    const p = sample();
    assert.ok(!validate(p).errors.some((e) => e.path === sec), sec);
  }
});

test("R29 K102 a kind's advisory and an office's oversight under one role and body are one value per key", () => {
  const a = sample();
  const b = two((x) => { at(x, "action_kinds[2]").advisory = "Consult counsel."; at(x, "counterparties[1]").oversight = false; at(x, "counterparties[1]").basis = "M-2"; });
  const c = combinedOf(combine([a, b]));
  assert.deepEqual(c.conflicts.map((x) => x.at).sort(), ["action_kinds[records_petition].advisory", "counterparties[Auditor/Sample Town].oversight"]);
  assert.equal(findIn(c.view.action_kinds, (k) => k.kind === "records_petition", "records_petition").advisory, undefined);
  const aud = must(c.view.counterparties, "counterparties").filter((x) => x.role === "Auditor");
  assert.equal(aud.length, 1, "the office is kept once; only its marker is withheld");
  assert.equal(nth(aud, 0, "Auditor").oversight, undefined);
  assert.deepEqual(nth(aud, 0, "Auditor").bases, [{ profile: "sample-town", basis: "DEC-2" }, { profile: "sample-two", basis: "M-2" }]);
  /* agreement keeps them; a marker only one profile gives is kept */
  const d = two((x) => { delete at(x, "counterparties[1]").oversight; });
  const e = combinedOf(combine([a, d]));
  assert.deepEqual(e.conflicts, []);
  assert.equal(findIn(e.view.counterparties, (x) => x.role === "Auditor", "Auditor").oversight, true);
  assert.equal(findIn(e.view.action_kinds, (k) => k.kind === "records_petition", "records_petition").advisory, "Have it reviewed first.");
});

test("R36 the test profile supplies R31's levels, oversight, a Tier 2 advisory, evidence with a contestable grade, legal organisations and holidays; the first holds what is measured or named", () => {
  const t = held(TEST);
  assert.ok(must(t.action_kinds, "action_kinds").some((k) => { const contestable = k.evidence?.contestable; return !!contestable && contestable.length > 0
    && contestable.every((g) => GRADES.includes(g.grade)); }), "evidence with a contestable grade (R39)");
  /* every level; an entry with none carries a sector instead (R31 as amended by T35-1) */
  assert.deepEqual([...new Set([...must(t.records_laws, "records_laws"), ...must(t.standard_sources, "standard_sources")].map((x) => x.level).filter(Boolean))].sort(), ["city", "county", "federal", "state"]);
  assert.ok(must(t.counterparties, "counterparties").some((c) => c.oversight === true));
  assert.ok(must(t.action_kinds, "action_kinds").some((k) => k.tier === 2 && typeof k.advisory === "string"));
  assert.ok(must(t.legal_organisations, "legal_organisations").length && must(t.holidays, "holidays").length);
  const f = held(FIRST);
  /* every entry R31 gives a level carries one; OUSD's families, a government at no law level, carry their sector (T35-1) */
  for (const x of [...must(f.records_laws, "records_laws"), ...must(f.standard_sources, "standard_sources")])
    assert.ok(levelledOrSector(x), "name" in x ? x.name : x.source);
  /* the Tier 3 kinds §8 names are held, for the organisations that evaluate them */
  const kinds = must(f.action_kinds, "action_kinds");
  assert.ok(kinds.filter((k) => k.tier === 3).length >= 3);
  /* the legal organisations Bob named (K283 (2), K303): exactly these two, each taking up its Tier 3 kinds,
     each reached by its public website; none takes up consent_decree_motion. HJTA unmeasured; FAC's defence scope
     measured on its published page (R85, as amended in T45; J1's reading), so its basis names that measurement */
  const organisations = must(f.legal_organisations, "legal_organisations");
  assert.deepEqual(organisations, [
    { name: "Howard Jarvis Taxpayers Association", evaluates: ["assessment_challenge", "taxpayer_action"],
      contacts: [{ how: "web", value: "https://www.hjta.org" }], basis: "UNMEASURED" },
    { name: "First Amendment Coalition", evaluates: ["constitutional_claim"], defends: true,
      contacts: [{ how: "web", value: "https://firstamendmentcoalition.org" }], basis: "K303, 2026-10-11 actions-law" },
  ]);
  const tier3 = new Set(kinds.filter((k) => k.tier === 3).map((k) => k.kind));
  for (const o of organisations) {
    for (const k of must(o.evaluates, `${o.name} evaluates`)) assert.ok(tier3.has(k), `${o.name} ${k} is a Tier 3 kind`);
    for (const c of o.contacts) assert.equal(new URL(c.value).protocol, "https:", `${o.name} website`);
  }
  assert.ok(!organisations.some((o) => must(o.evaluates, `${o.name} evaluates`).includes("consent_decree_motion")));
  /* the combined view carries them, tagged with the first profile */
  const lv = must(viewOf(combine([FIRST])).legal_organisations, "legal_organisations");
  assert.deepEqual(lv.map((o) => [o.name, o.profile, o.basis]), organisations.map((o) => [o.name, FIRST, o.basis]));
  /* §8's Tier 2 kind carries the advisory note recommending legal review; Tier 3 kinds have no template */
  const t2 = kinds.filter((k) => k.tier === 2);
  assert.ok(t2.length >= 1 && t2.every((k) => /legal review/i.test(String(k.advisory))));
  for (const k of kinds.filter((x) => x.tier === 3)) assert.equal(k.template, undefined, k.kind);
  /* the oversight and audit bodies the profile names; the others stay undetermined */
  const counterparties = must(f.counterparties, "counterparties");
  assert.deepEqual(counterparties.filter((c) => c.oversight === true).map((c) => c.role).sort(), ["City Auditor", "Civil Grand Jury"]);
  assert.ok(counterparties.filter((c) => c.oversight !== true).every((c) => c.oversight === undefined));
  /* no measurement names any of its venues' evidence standards: absent, never guessed (its calendar is R45's) */
  assert.ok(kinds.every((k) => k.evidence === undefined));
  /* re-based on their primary sources in T33 (R30, R56) */
  for (const c of counterparties.filter((x) => x.oversight)) assert.match(c.basis, /^2026-10-05 time-law(, 2026-10-05 legistar-events)?$/, c.role);
});

/* ============================================================================================== */
/* R37 (`locale`, N77, K119) and R38 (`systems[].links`, N96, K158), folded by K227.                 */

test("R37 locale: {value, basis}, one well-formed BCP 47 tag; one value in combine", () => {
  for (const v of ["en", "en-US", "fr-CA", "zh-Hant-TW", "es-419"]) assert.ok(breakIt((p) => { at(p, "locale").value = v; }).ok, v);
  for (const v of ["", "en_US", "en-US,fr", "en US", "e", "en--US", "toolonglanguage", 3, null]) assert.ok(hasError(breakIt((p) => { at(p, "locale").value = v; }), "VALUE_INVALID", "locale.value"), String(v));
  assert.ok(hasError(breakIt((p) => { p.locale = "en-US"; }), "VALUE_INVALID", "locale"));
  assert.ok(hasError(breakIt((p) => { at(p, "locale").region = "US"; }), "UNKNOWN_SECTION", "locale.region"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "locale").basis; }), "BASIS_MISSING", "locale.basis"));
  assert.ok(breakIt((p) => { delete p.locale; }).ok, "locale is optional");
  assert.deepEqual(held(FIRST).locale, { value: "en-US", basis: "UNMEASURED" });
  const one = must(viewOf(combine([FIRST])).locale, "locale");
  assert.deepEqual([one.value, one.profile], ["en-US", FIRST]);
  const agree = combinedOf(combine([sample(), two((b) => { at(b, "locale").basis = "M-2"; })]));
  assert.deepEqual(agree.conflicts, []);
  assert.equal(must(agree.view.locale, "locale").bases.length, 2);
  const c = combinedOf(combine([FIRST, TEST]));
  assert.equal(c.view.locale, undefined);
  assert.deepEqual(findIn(c.conflicts, (x) => x.at === "locale", "locale").values.map((v) => v.value), ["en-US", "en-GB"]);
});

test("R38 systems[].links: {item, file} patterns over path and query; the first profile states REC-206's gateway shapes", () => {
  assert.ok(breakIt((p) => { delete at(p, "systems[0]").links; }).ok, "links are optional");
  for (const bad of [null, "x", {}, { item: { re: "a" } }, { file: { re: "a" } }])
    assert.ok(hasError(breakIt((p) => { at(p, "systems[0]").links = bad; }), "VALUE_INVALID", "systems[0].links"), JSON.stringify(bad));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[0].links").item = { re: "(" }; }), "PATTERN_INVALID", "systems[0].links.item"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[0].links").file = { re: "a", flags: "g" }; }), "PATTERN_INVALID", "systems[0].links.file"));
  assert.ok(hasError(breakIt((p) => { at(p, "systems[0].links").meeting = { re: "a" }; }), "UNKNOWN_SECTION", "systems[0].links.meeting"));
  /* the view carries them on their system */
  const v = viewOf(combine([FIRST]));
  const sys = must(v.systems, "systems").filter((s) => s.links);
  assert.equal(sys.length, 1);
  assert.equal(nth(sys, 0, "systems with links").origin, "oakland.legistar");
  /* the first profile's shapes, read as extraction R52 reads them (the host is one of the system's, the
     path and query match), classify every sample link exactly as REC-206's measured shapes do */
  /** @param {Pattern} p @returns {RegExp} */
  const rx = (p) => new RegExp(p.re, p.flags || "");
  /* REC-206 measured the gateway on the record's own host; the profile's other host is the same system
     (M-119 LEG), so an address there answers as its twin on the measured host does. */
  const linked = nth(sys, 0, "systems with links");
  const links = must(linked.links, "links");
  /** @type {("item" | "file")[]} */
  const ends = ["item", "file"];
  for (const url of legacy.linkSamples()) {
    const u = new URL(url);
    const twin = url.replace(/legistar1\.com/i, "legistar.com");
    const onHost = linked.hosts.includes(u.hostname.toLowerCase());
    for (const end of ends) {
      const now = onHost && rx(links[end]).test(u.pathname + u.search);
      const was = legacy.MEMBERSHIP_SHAPES.some((s) => s[end].test(twin));
      assert.equal(now, was, `${end} ${url}`);
    }
  }
  assert.ok(must(held(TEST).systems, "systems").some((s) => s.links), "the test profile states shapes too");
});

/* ============================================================================================== */
/* R39 (`action_kinds[].evidence`, K597 (3), K608): a venue's evidence standard.                   */

test("R39 evidence: {standard (at most 200 characters), accepts (non-empty {grade, coattested?}), contestable?, basis}", () => {
  assert.ok(validate(sample()).ok);
  assert.ok(breakIt((p) => { delete at(p, "action_kinds[1]").evidence; }).ok, "evidence is optional");
  assert.ok(breakIt((p) => { delete at(p, "action_kinds[1].evidence").contestable; }).ok, "contestable is optional");
  assert.ok(breakIt((p) => { at(p, "action_kinds[1].evidence").contestable = []; }).ok, "contestable may list nothing");
  assert.ok(breakIt((p) => { at(p, "action_kinds[0]").evidence = loose(at(p, "action_kinds[1].evidence")); }).ok, "on a kind of any tier");
  /* standard: named in words, at most 200 characters */
  assert.ok(breakIt((p) => { at(p, "action_kinds[1].evidence").standard = "x".repeat(200); }).ok, "200 characters");
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").standard = "x".repeat(201); }), "VALUE_INVALID", "action_kinds[1].evidence.standard"), "201 characters");
  for (const bad of ["  ", 7, ["rule"]]) assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").standard = bad; }), "VALUE_INVALID", "action_kinds[1].evidence.standard"), JSON.stringify(bad));
  /** @type {((e: Fields) => void)[]} */
  const noStandard = [(e) => { delete e.standard; }, (e) => { e.standard = ""; }, (e) => { e.standard = null; }];
  for (const fn of noStandard)
    assert.ok(hasError(breakIt((p) => fn(at(p, "action_kinds[1].evidence"))), "EVIDENCE_NO_STANDARD", "action_kinds[1].evidence.standard"));
  /* accepts: a non-empty list; every grade a letter of BASIS_GRADES, and only those */
  /** @type {((e: Fields) => void)[]} */
  const noAccepts = [(e) => { delete e.accepts; }, (e) => { e.accepts = []; }];
  for (const fn of noAccepts)
    assert.ok(hasError(breakIt((p) => fn(at(p, "action_kinds[1].evidence"))), "EVIDENCE_NO_STANDARD", "action_kinds[1].evidence.accepts"));
  for (const bad of [null, "A", { grade: "A" }]) assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").accepts = bad; }), "VALUE_INVALID", "action_kinds[1].evidence.accepts"), JSON.stringify(bad));
  /** Writes a list of grades into the sample's evidence, under `accepts` or `contestable`.
   *  @param {Fields} p
   *  @param {string} list
   *  @param {object} grades */
  const setGrades = (p, list, grades) => { at(p, "action_kinds[1].evidence")[list] = grades; };
  for (const list of ["accepts", "contestable"]) {
    const where = `action_kinds[1].evidence.${list}[0]`;
    for (const grade of GRADES) assert.ok(breakIt((p) => { setGrades(p, list, [{ grade }]); }).ok, `${list} ${grade}`);
    for (const grade of ["E", "a", "", "AB", 1, null, undefined, "UNMEASURED"])
      assert.ok(hasError(breakIt((p) => { setGrades(p, list, [{ grade }]); }), "GRADE_UNKNOWN", `${where}.grade`), `${list} ${String(grade)}`);
    for (const coattested of [true, false]) assert.ok(breakIt((p) => { setGrades(p, list, [{ grade: "A", coattested }]); }).ok, `${list} coattested ${coattested}`);
    for (const bad of ["yes", 1, null]) assert.ok(hasError(breakIt((p) => { setGrades(p, list, [{ grade: "A", coattested: bad }]); }), "VALUE_INVALID", `${where}.coattested`), `${list} ${String(bad)}`);
    assert.ok(hasError(breakIt((p) => { setGrades(p, list, [{ grade: "A", weight: 1 }]); }), "UNKNOWN_SECTION", `${where}.weight`));
    assert.ok(hasError(breakIt((p) => { setGrades(p, list, ["A"]); }), "VALUE_INVALID", where));
  }
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").contestable = "C"; }), "VALUE_INVALID", "action_kinds[1].evidence.contestable"));
  /* the rest of its shape, and its basis as every fact's */
  for (const bad of [null, "Rule 902", [], 3]) assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1]").evidence = bad; }), "VALUE_INVALID", "action_kinds[1].evidence"), JSON.stringify(bad));
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").venue = "court"; }), "UNKNOWN_SECTION", "action_kinds[1].evidence.venue"));
  assert.ok(hasError(breakIt((p) => { delete at(p, "action_kinds[1].evidence").basis; }), "BASIS_MISSING", "action_kinds[1].evidence.basis"));
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").basis = "TEST"; }), "BASIS_INVALID", "action_kinds[1].evidence.basis"));
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1].evidence").basis = "Rule 902"; }), "BASIS_INVALID", "action_kinds[1].evidence.basis"));
  /* every fault is reported, not only the first */
  const r = breakIt((p) => { at(p, "action_kinds[1]").evidence = { accepts: [{ grade: "Z" }], contestable: [{ grade: "Q" }] }; });
  assert.deepEqual(r.errors.map((e) => [e.path, e.code]).sort(), [["action_kinds[1].evidence.accepts[0].grade", "GRADE_UNKNOWN"],
    ["action_kinds[1].evidence.basis", "BASIS_MISSING"], ["action_kinds[1].evidence.contestable[0].grade", "GRADE_UNKNOWN"],
    ["action_kinds[1].evidence.standard", "EVIDENCE_NO_STANDARD"]]);
  /* the view carries it on its kind, tagged; absent, the venue's standard is undetermined */
  const v = viewOf(combine([sample()]));
  const e = must(findIn(v.action_kinds, (k) => k.kind === "code_complaint", "code_complaint").evidence, "evidence");
  assert.deepEqual({ ...e, bases: undefined, profile: undefined }, { ...must(nth(sample().action_kinds, 1, "action_kinds").evidence, "evidence"), bases: undefined, profile: undefined });
  assert.deepEqual([e.profile, e.basis, e.bases], ["sample-town", "M-13", [{ profile: "sample-town", basis: "M-13" }]]);
  for (const k of must(v.action_kinds, "action_kinds").filter((x) => x.kind !== "code_complaint")) assert.equal(k.evidence, undefined, k.kind);
  /* the test profile's evidence reads as it is written */
  const t = findIn(viewOf(combine([TEST])).action_kinds, (k) => !!k.evidence, "a kind with evidence");
  assert.equal(must(t.evidence, "evidence").profile, TEST);
});

test("R29 R39 a kind's evidence is one value per key: withheld and reported when profiles disagree, kept with every giver's basis when they agree", () => {
  const a = sample();
  /** @type {[string, (e: Fields) => void][]} */
  const changes = [["another standard", (e) => { e.standard = "Evidence Rule 901"; }],
    ["the first accepted grade not coattested", (e) => { at(e, "accepts[0]").coattested = false; }],
    ["the first accepted grade without coattested", (e) => { delete at(e, "accepts[0]").coattested; }],
    ["another accepted grade", (e) => { listOr(e.accepts).push({ grade: "C" }); }],
    ["no contestable grades", (e) => { delete e.contestable; }],
    ["another contestable grade", (e) => { e.contestable = [{ grade: "D" }]; }]];
  for (const [label, change] of changes) {
    const c = combine([a, two((b) => change(at(b, "action_kinds[1].evidence")))]);
    assert.equal(c.ok, true);
    assert.deepEqual(c.conflicts.map((x) => x.at), ["action_kinds[code_complaint].evidence"], label);
    const x = nth(c.conflicts, 0, "conflicts");
    assert.deepEqual(x.values.map((y) => [y.profile, y.basis]), [["sample-town", "M-13"], ["sample-two", "M-13"]]);
    assert.ok(typeof x.says === "string" && /undetermined/.test(x.says));
    const k = findIn(c.view.action_kinds, (y) => y.kind === "code_complaint", "code_complaint");
    assert.equal(k.evidence, undefined, "withheld: combine never chooses");
    assert.equal(k.tier, 3, "the kind's other facts stand");
  }
  /* agreement, whatever the basis, keeps it with both givers */
  const e = combinedOf(combine([a, two((b) => { at(b, "action_kinds[1].evidence").basis = "K9"; })]));
  assert.deepEqual(e.conflicts, []);
  const ev = must(findIn(e.view.action_kinds, (y) => y.kind === "code_complaint", "code_complaint").evidence, "evidence");
  assert.deepEqual(ev.bases, [{ profile: "sample-town", basis: "M-13" }, { profile: "sample-two", basis: "K9" }]);
  assert.deepEqual([ev.profile, ev.basis], ["sample-town", "M-13"]);
  /* one profile only gives it: kept as that profile gives it */
  const one = combinedOf(combine([a, two((b) => { delete at(b, "action_kinds[1]").evidence; })]));
  assert.deepEqual(one.conflicts, []);
  assert.equal(must(findIn(one.view.action_kinds, (y) => y.kind === "code_complaint", "code_complaint").evidence, "evidence").standard,
    must(nth(a.action_kinds, 1, "action_kinds").evidence, "evidence").standard);
});

/* ============================================================================================== */
/* K921, K925: filing templates and the calendar (R40–R45; R28, R29, R34, R35 as amended).          */

/** @param {Fields} p
 *  @returns {Fields} */
const tz = (p) => at(p, "time_zone");
/** @param {Fields} p
 *  @returns {Fields} */
const clerkHours = (p) => at(p, "counterparties[0].hours");
/** @param {Fields} p
 *  @returns {Fields} */
const venueHours = (p) => at(p, "action_kinds[0].venue.hours");

test("R40 a template carries its whole attribution: {id, version, use, text, notes, authored_by, contributors, reviews, approved_by, approved_at, basis}", () => {
  assert.ok(validate(sample()).ok);
  const T = "action_kinds[0].template";
  /* bare text, or any value that is not an object, carries no attribution */
  for (const bare of ["Please send {{law}}.", "", 3, ["x"]])
    assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[0]").template = bare; }), "TEMPLATE_UNATTRIBUTED", T), JSON.stringify(bare));
  /* each field missing is named */
  for (const f of ["id", "version", "use", "text", "notes", "authored_by", "contributors", "reviews", "approved_by", "approved_at", "basis"]) {
    const r = breakIt((p) => { delete at(p, T)[f]; });
    assert.ok(hasError(r, "TEMPLATE_UNATTRIBUTED", `${T}.${f}`), f);
    assert.ok(hasError(breakIt((p) => { at(p, T)[f] = null; }), "TEMPLATE_UNATTRIBUTED", `${T}.${f}`), `${f} null`);
  }
  /* each value of the wrong form */
  /** @type {{ [field: string]: (object | string | number)[] }} */
  const wrong = {
    id: ["tpl-x", "TPL-", "TPL-X", "TPL_x", "TPL--x".slice(0, 4), 7], version: [0, -1, 1.5, "1"], use: ["filing", "", "File"],
    text: ["", "  ", 3], notes: [3, ["n"]], authored_by: ["", 3], approved_by: ["", 3], contributors: ["B", [""], [3]],
    reviews: ["ok", {}], approved_at: ["2026-02-30", "2026/09/01", "", 20260901],
  };
  for (const [f, bads] of Object.entries(wrong)) for (const bad of bads)
    assert.ok(hasError(breakIt((p) => { at(p, T)[f] = bad; }), "VALUE_INVALID", `${T}.${f}`), `${f} ${JSON.stringify(bad)}`);
  /** @type {{ [field: string]: object | string | number }[]} */
  const goods = [{ id: "TPL-a" }, { id: "TPL-0-x9" }, { version: 7 }, { use: "brief" }, { notes: "" }, { contributors: [] }, { reviews: [] }];
  for (const good of goods)
    assert.ok(breakIt((p) => { const t = at(p, T); for (const [k, x] of Object.entries(good)) t[k] = x; }).ok, JSON.stringify(good));
  /* the approver is never the author */
  assert.ok(hasError(breakIt((p) => { at(p, T).approved_by = "A. Author"; }), "VALUE_INVALID", `${T}.approved_by`));
  /* no id twice in the profile */
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[2]").template = tpl({ use: "brief" }); }), "VALUE_INVALID", "action_kinds[2].template.id"));
  assert.ok(breakIt((p) => { at(p, "action_kinds[2]").template = tpl({ id: "TPL-other", use: "brief" }); }).ok);
  /* a review: reviewer, kind, scope, outcome, at required; organisation and credential optional */
  const R0 = `${T}.reviews[0]`;
  for (const f of ["reviewer", "kind", "scope", "outcome", "at"])
    assert.ok(hasError(breakIt((p) => { delete at(p, R0)[f]; }), "TEMPLATE_UNATTRIBUTED", `${R0}.${f}`), f);
  for (const f of ["organisation", "credential"]) assert.ok(breakIt((p) => { delete at(p, R0)[f]; }).ok, f);
  for (const kind of ["member", "professional"]) assert.ok(breakIt((p) => { at(p, R0).kind = kind; }).ok, kind);
  for (const outcome of ["no_concerns", "concerns", "changes_requested"]) assert.ok(breakIt((p) => { at(p, R0).outcome = outcome; }).ok, outcome);
  /** @type {[string, Value][]} */
  const badReviews = [["kind", "peer"], ["outcome", "approved"], ["at", "yesterday"], ["reviewer", ""], ["scope", ""], ["organisation", ""], ["credential", 3]];
  for (const [f, bad] of badReviews)
    assert.ok(hasError(breakIt((p) => { at(p, R0)[f] = bad; }), "VALUE_INVALID", `${R0}.${f}`), `${f} ${String(bad)}`);
  assert.ok(hasError(breakIt((p) => { at(p, R0).grade = "A"; }), "UNKNOWN_SECTION", `${R0}.grade`));
  assert.ok(hasError(breakIt((p) => { at(p, T).reviews = ["fine"]; }), "VALUE_INVALID", R0));
  assert.ok(hasError(breakIt((p) => { at(p, T).state = "approved"; }), "UNKNOWN_SECTION", `${T}.state`));
  /* its basis is a ruling, or TEST in a test profile */
  for (const b of ["K921", "K921, K924", "K1; K2"]) assert.ok(breakIt((p) => { at(p, T).basis = b; }).ok, b);
  for (const b of ["M-1", "D-149", "DEC-13", "UNMEASURED", "TEST", "2026-09-01", "K"])
    assert.ok(hasError(breakIt((p) => { at(p, T).basis = b; }), "BASIS_INVALID", `${T}.basis`), b);
  assert.ok(breakIt((p) => { p.test = true; at(p, T).basis = "TEST"; }).ok);
  /* every fault is reported */
  const all = breakIt((p) => { at(p, "action_kinds[0]").template = { id: "x", use: "fax" }; });
  assert.ok(all.errors.filter((e) => e.code === "TEMPLATE_UNATTRIBUTED").length === 9);
  assert.ok(hasError(all, "VALUE_INVALID", `${T}.id`) && hasError(all, "VALUE_INVALID", `${T}.use`));
  /* the view carries the template whole, attribution included, tagged with its giver */
  const k = findIn(viewOf(combine([sample()])).action_kinds, (x) => x.kind === "records_request", "records_request");
  const kt = must(k.template, "template");
  assert.deepEqual({ ...kt, profile: undefined, bases: undefined }, { ...tpl(), profile: undefined, bases: undefined });
  assert.deepEqual([kt.profile, kt.bases], ["sample-town", [{ profile: "sample-town", basis: "K921" }]]);
});

test("R28 TEMPLATE_TIER3 refuses only a use: file template on a Tier 3 kind; a brief serves any tier", () => {
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[1]").template = tpl({ id: "TPL-sample-sue" }); }), "TEMPLATE_TIER3", "action_kinds[1].template"));
  assert.ok(breakIt((p) => { at(p, "action_kinds[1]").template = tpl({ id: "TPL-sample-sue", use: "brief" }); }).ok, "a brief on Tier 3");
  /** @type {TemplateUse[]} */
  const uses = ["file", "brief"];
  for (const tier of [1, 2]) for (const use of uses)
    assert.ok(breakIt((p) => { const k = at(p, "action_kinds[2]"); delete k.advisory; k.tier = tier; k.template = tpl({ id: "TPL-sample-x", use }); }).ok, `${tier} ${use}`);
  assert.ok(breakIt((p) => { delete at(p, "action_kinds[0]").tier; }).ok, "an undetermined tier takes a file template");
  assert.ok(!hasError(breakIt((p) => { at(p, "action_kinds[1]").template = "bare"; }), "TEMPLATE_TIER3"), "bare text is unattributed, its use unknown");
});

test("R41 time_zone: {value, status, basis}, an IANA name (Area/Location or UTC); one value in combine", () => {
  for (const v of ["America/Los_Angeles", "Europe/London", "America/Argentina/Buenos_Aires", "UTC", "Etc/GMT+5", "Pacific/Honolulu"])
    assert.ok(breakIt((p) => { tz(p).value = v; }).ok, v);
  for (const v of ["", "PST", "EST", "GMT", "utc", "America/Nowhere", "Los_Angeles", "America/", "/London", "+05:00", 5, null])
    assert.ok(hasError(breakIt((p) => { tz(p).value = v; }), "VALUE_INVALID", "time_zone.value"), String(v));
  for (const bad of ["America/Toronto", null, ["UTC"]]) assert.ok(hasError(breakIt((p) => { p.time_zone = bad; }), "VALUE_INVALID", "time_zone"), JSON.stringify(bad));
  assert.ok(hasError(breakIt((p) => { tz(p).offset = -5; }), "UNKNOWN_SECTION", "time_zone.offset"));
  assert.ok(hasError(breakIt((p) => { delete tz(p).basis; }), "BASIS_MISSING", "time_zone.basis"));
  assert.ok(breakIt((p) => { delete p.time_zone; }).ok, "optional: absent, the time of day is undetermined");
  assert.ok(!validate(sample()).errors.some((e) => e.code === "UNKNOWN_SECTION"), "a known section");
  /* one value per key: agreeing profiles keep it with both bases; disagreeing ones have it withheld */
  const same = combinedOf(combine([sample(), two((b) => { tz(b).basis = "M-99"; })]));
  assert.deepEqual(same.conflicts, []);
  const zone = must(same.view.time_zone, "time_zone");
  assert.deepEqual([zone.value, zone.status, zone.profile], ["America/Toronto", "researched", "sample-town"]);
  assert.deepEqual(zone.bases, [{ profile: "sample-town", basis: "M-14" }, { profile: "sample-two", basis: "M-99" }]);
  /** @type {((z: Fields) => void)[]} */
  const zoneChanges = [(z) => { z.value = "America/Chicago"; }, (z) => { z.status = "ruled"; z.basis = "K1"; }];
  for (const change of zoneChanges) {
    const c = combinedOf(combine([sample(), two((b) => change(tz(b)))]));
    assert.equal(c.view.time_zone, undefined);
    assert.deepEqual(c.conflicts.map((x) => x.at), ["time_zone"]);
    const first = nth(c.conflicts, 0, "conflicts");
    assert.ok(first.values.length === 2 && /undetermined/.test(first.says));
  }
  assert.equal(must(viewOf(combine([sample(), two((b) => { delete b.time_zone; })])).time_zone, "time_zone").value, "America/Toronto", "one giver: kept");
});

test("R42 hours: {weekly: [{day, open, close}], status, basis} on a counterparty or a venue; split hours, never overlapping; a day not listed is closed", () => {
  assert.ok(validate(sample()).ok, "split hours on one day are allowed");
  /** @type {[string, (p: Fields) => Fields][]} */
  const places = [["counterparties[0].hours", clerkHours], ["action_kinds[0].venue.hours", venueHours]];
  for (const [where, hoursOf] of places) {
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) assert.ok(breakIt((p) => { hoursOf(p).weekly = [{ day, open: "00:00", close: "23:59" }]; }).ok, day);
    assert.ok(breakIt((p) => { hoursOf(p).weekly = []; }).ok, "every day closed");
    assert.ok(breakIt((p) => { hoursOf(p).weekly = [{ day: "mon", open: "09:00", close: "12:00" }, { day: "mon", open: "12:00", close: "13:00" }]; }).ok, "touching spans");
    /** @param {(h: Fields) => void} fn
     *  @param {string} path
     *  @param {string} why */
    const bad = (fn, path, why) => assert.ok(hasError(breakIt((p) => fn(hoursOf(p))), "HOURS_INVALID", path), `${where} ${why}`);
    for (const day of ["Mon", "monday", "", 1, null]) bad((h) => { at(h, "weekly[0]").day = day; }, `${where}.weekly[0].day`, `day ${day}`);
    for (const t of ["9:00", "24:00", "09:60", "0900", "", 900, null]) {
      bad((h) => { at(h, "weekly[0]").open = t; }, `${where}.weekly[0].open`, `open ${t}`);
      bad((h) => { at(h, "weekly[0]").close = t; }, `${where}.weekly[0].close`, `close ${t}`);
    }
    bad((h) => { const s = at(h, "weekly[0]"); s.close = s.open; }, `${where}.weekly[0]`, "open equals close");
    bad((h) => { put(h, "weekly[0]", { day: "mon", open: "17:00", close: "09:00" }); }, `${where}.weekly[0]`, "open after close");
    bad((h) => { h.weekly = [{ day: "tue", open: "09:00", close: "13:00" }, { day: "tue", open: "12:59", close: "15:00" }]; }, `${where}.weekly[1]`, "overlap");
    bad((h) => { h.weekly = [{ day: "tue", open: "09:00", close: "17:00" }, { day: "tue", open: "10:00", close: "11:00" }]; }, `${where}.weekly[1]`, "inside");
    bad((h) => { h.weekly = "Mon–Fri 9–5"; }, `${where}.weekly`, "weekly not a list");
    bad((h) => { h.weekly = ["mon"]; }, `${where}.weekly[0]`, "span not an object");
    assert.ok(hasError(breakIt((p) => { at(hoursOf(p), "weekly[0]").note = "x"; }), "UNKNOWN_SECTION", `${where}.weekly[0].note`));
    assert.ok(hasError(breakIt((p) => { hoursOf(p).closed_note = "x"; }), "UNKNOWN_SECTION", `${where}.closed_note`));
    assert.ok(hasError(breakIt((p) => { delete hoursOf(p).basis; }), "BASIS_MISSING", `${where}.basis`));
    /* overlapping is per day: the same span on two days is no overlap */
    assert.ok(breakIt((p) => { hoursOf(p).weekly = [{ day: "mon", open: "09:00", close: "17:00" }, { day: "tue", open: "09:00", close: "17:00" }]; }).ok);
  }
  for (const bad of ["9-5", null, []]) assert.ok(hasError(breakIt((p) => { at(p, "counterparties[0]").hours = bad; }), "HOURS_INVALID", "counterparties[0].hours"), JSON.stringify(bad));
  assert.ok(breakIt((p) => { delete at(p, "counterparties[0]").hours; delete at(p, "action_kinds[0].venue").hours; }).ok, "optional: absent, undetermined");
  /* the view carries each office's and venue's hours, tagged; absent, none */
  const v = viewOf(combine([sample()]));
  const clerk = findIn(v.counterparties, (c) => c.role === "Clerk", "Clerk");
  const clerkHoursInView = must(clerk.hours, "Clerk hours");
  assert.deepEqual(clerkHoursInView.weekly, must(nth(sample().counterparties, 0, "counterparties").hours, "Clerk hours").weekly);
  assert.deepEqual([clerkHoursInView.status, clerkHoursInView.basis, clerkHoursInView.profile], ["researched", "M-15", "sample-town"]);
  assert.equal(findIn(v.counterparties, (c) => c.role === "Auditor", "Auditor").hours, undefined);
  const venue = must(findIn(v.action_kinds, (k) => k.kind === "records_request", "records_request").venue, "venue");
  const venueHoursInView = must(venue.hours, "venue hours");
  assert.deepEqual([venueHoursInView.status, venueHoursInView.basis, venueHoursInView.bases], ["ruled", "K5", [{ profile: "sample-town", basis: "K5" }]]);
  assert.equal(must(findIn(v.action_kinds, (k) => k.kind === "code_complaint", "code_complaint").venue, "venue").hours, undefined);
});

test("R43 a holiday entry's offices: counterparty roles or {venue: <kind>}; a year once for all offices and once per distinct list", () => {
  assert.ok(validate(sample()).ok);
  const H = "holidays[2]";
  for (const offices of [["Clerk"], ["Auditor", "Clerk"], [{ venue: "code_complaint" }], [{ venue: "records_request" }, "Auditor"]])
    assert.ok(breakIt((p) => { at(p, H).offices = offices; }).ok, JSON.stringify(offices));
  for (const offices of [[], "Clerk", null, {}]) assert.ok(hasError(breakIt((p) => { at(p, H).offices = offices; }), "HOLIDAY_INVALID", `${H}.offices`), JSON.stringify(offices));
  /** @type {[Value, string][]} */
  const badOffices = [["Mayor", "no such role"], ["clerk", "roles are exact"], [{ venue: "records_petition" }, "a kind with no venue"],
    [{ venue: "appeal" }, "no such kind"], [{ role: "Clerk" }, "not an office form"], [{ venue: "code_complaint", extra: 1 }, "extra field"], [3, "a number"]];
  for (const [o, why] of badOffices)
    assert.ok(hasError(breakIt((p) => { at(p, H).offices = [o]; }), "HOLIDAY_INVALID", `${H}.offices[0]`), why);
  assert.ok(hasError(breakIt((p) => { at(p, H).offices = ["Clerk", "Clerk"]; }), "HOLIDAY_INVALID", `${H}.offices[1]`), "an office twice");
  /* a year for all offices and for each distinct list, never twice for one list, whatever its order */
  assert.ok(hasError(breakIt((p) => { listOr(p.holidays).push({ ...loose(at(p, H)), offices: [{ venue: "code_complaint" }, "Clerk"] }); }), "HOLIDAY_INVALID", "holidays[3].year"), "same list, other order");
  assert.ok(breakIt((p) => { listOr(p.holidays).push({ ...loose(at(p, H)), offices: ["Clerk"] }); }).ok, "a different list");
  assert.ok(hasError(breakIt((p) => { listOr(p.holidays).push({ ...loose(at(p, "holidays[0]")) }); }), "HOLIDAY_INVALID", "holidays[3].year"), "all offices twice");
  /* the view keeps each entry under its year and offices, so a count for an office takes the all-offices entry and its own */
  const v = viewOf(combine([sample()]));
  const y2026 = must(v.holidays, "holidays").filter((h) => h.year === 2026);
  assert.deepEqual(y2026.map((h) => h.offices || null), [null, ["Clerk", { venue: "code_complaint" }]]);
  /** @param {string} role
   *  @returns {Set<string>} */
  const forOffice = (role) => new Set(y2026.filter((h) => { const offices = h.offices; return !offices || offices.includes(role); }).flatMap((h) => h.days.map((d) => d.date)));
  assert.deepEqual([...forOffice("Clerk")].sort(), ["2026-01-01", "2026-03-02", "2026-07-04"]);
  assert.deepEqual([...forOffice("Auditor")].sort(), ["2026-01-01", "2026-07-04"]);
});

test("R34 R43 combine keys a year's holidays by year and offices: each is one value, withheld only where profiles disagree", () => {
  const a = sample();
  /* the same list in another order, and the same days in another order, agree */
  const same = two((b) => { listOr(at(b, "holidays[2]").offices).reverse(); at(b, "holidays[2]").basis = "K7"; });
  const e = combinedOf(combine([a, same]));
  assert.deepEqual(e.conflicts, []);
  const office = findIn(e.view.holidays, (h) => !!h.offices, "an office's holidays");
  assert.deepEqual(office.bases, [{ profile: "sample-town", basis: "K6" }, { profile: "sample-two", basis: "K7" }]);
  assert.equal(office.status, "ruled");
  /* a disagreement on the office entry withholds that entry only */
  const c = combinedOf(combine([a, two((b) => { listOr(at(b, "holidays[2]").days).push({ date: "2026-03-03", name: "Second day" }); })]));
  assert.equal(c.conflicts.length, 1);
  assert.match(nth(c.conflicts, 0, "conflicts").at, /^holidays\[2026 offices=/);
  assert.ok(nth(c.conflicts, 0, "conflicts").values.every((x) => isList(x.value) && "status" in x && x.status && x.basis));
  assert.deepEqual(must(c.view.holidays, "holidays").map((h) => [h.year, !!h.offices]), [[2026, false], [2024, false]]);
  /* a status that differs is a disagreement too (R44) */
  const s = combinedOf(combine([a, two((b) => { at(b, "holidays[0]").status = "ruled"; at(b, "holidays[0]").basis = "K8"; })]));
  assert.deepEqual(s.conflicts.map((x) => x.at), ["holidays[2026]"]);
  /* two profiles each naming their own offices do not meet */
  const o = combinedOf(combine([a, two((b) => { at(b, "holidays[2]").offices = ["Auditor"]; })]));
  assert.deepEqual(o.conflicts, []);
  assert.equal(must(o.view.holidays, "holidays").filter((h) => h.year === 2026 && h.offices).length, 2);
});

test("R44 status on every holiday entry, hours and time_zone: researched on a measurement, ruled on a ruling; UNMEASURED never", () => {
  /** @type {[string, (p: Fields) => Fields][]} */
  const facts = [["time_zone", tz], ["counterparties[0].hours", clerkHours], ["action_kinds[0].venue.hours", venueHours], ["holidays[0]", (p) => at(p, "holidays[0]")]];
  for (const [where, factOf] of facts) {
    for (const b of ["M-187", "2026-10-01", "M-1, M-2", "M-193 (2); 2026-10-01"])
      assert.ok(breakIt((p) => { factOf(p).status = "researched"; factOf(p).basis = b; }).ok, `${where} researched ${b}`);
    for (const b of ["K925", "D-1", "DEC-2", "K1, D-2"])
      assert.ok(breakIt((p) => { factOf(p).status = "ruled"; factOf(p).basis = b; }).ok, `${where} ruled ${b}`);
    for (const b of ["K925", "D-1", "M-1, K2"])
      assert.ok(hasError(breakIt((p) => { factOf(p).status = "researched"; factOf(p).basis = b; }), "BASIS_INVALID", `${where}.basis`), `${where} researched ${b}`);
    for (const b of ["M-187", "2026-10-01", "K1; M-2"])
      assert.ok(hasError(breakIt((p) => { factOf(p).status = "ruled"; factOf(p).basis = b; }), "BASIS_INVALID", `${where}.basis`), `${where} ruled ${b}`);
    for (const status of ["researched", "ruled"])
      assert.ok(hasError(breakIt((p) => { factOf(p).status = status; factOf(p).basis = "UNMEASURED"; }), "BASIS_INVALID", `${where}.basis`), `${where} ${status} UNMEASURED`);
    for (const status of ["confirmed", "measured", "", null, undefined, 1])
      assert.ok(hasError(breakIt((p) => { factOf(p).status = status; }), "BASIS_INVALID", `${where}.status`), `${where} status ${status}`);
    assert.ok(hasError(breakIt((p) => { delete factOf(p).status; }), "BASIS_INVALID", `${where}.status`), `${where} no status`);
    /* TEST stands for either status in a test profile, and only there */
    for (const status of ["researched", "ruled"]) {
      assert.ok(breakIt((p) => { p.test = true; factOf(p).status = status; factOf(p).basis = "TEST"; }).ok, `${where} test ${status}`);
      assert.ok(hasError(breakIt((p) => { factOf(p).status = status; factOf(p).basis = "TEST"; }), "BASIS_INVALID", `${where}.basis`), `${where} TEST outside`);
    }
  }
  /* other facts keep R2's bases, UNMEASURED among them */
  assert.ok(breakIt((p) => { at(p, "counterparties[0]").basis = "UNMEASURED"; at(p, "action_kinds[0].venue").basis = "UNMEASURED"; }).ok);
});

test("R45 the test profile supplies R40–R44; the first holds the calendar only as researched, with its measurements, and no template", () => {
  const t = held(TEST);
  /* templates: a use: file template on a Tier 1 or 2 kind and a use: brief on a Tier 3 kind, each attributed */
  const tpls = must(t.action_kinds, "action_kinds").filter((k) => k.template);
  assert.ok(tpls.some((k) => { const tier = k.tier; return (tier === 1 || tier === 2) && k.template?.use === "file"; }));
  assert.ok(tpls.some((k) => k.tier === 3 && k.template?.use === "brief"));
  for (const k of tpls) {
    assert.ok(validate({ ...t, action_kinds: [k] }).errors.every((e) => !e.path.includes("template")), k.kind);
    const kt = must(k.template, `${k.kind} template`);
    assert.ok(kt.reviews.length && kt.authored_by !== kt.approved_by, k.kind);
  }
  /* a time zone; hours on a counterparty and on a venue; a year for all offices and another entry of that year for one office; both statuses */
  const zone = t.time_zone;
  assert.ok(zone?.value);
  assert.ok(must(t.counterparties, "counterparties").some((c) => c.hours?.weekly.length));
  assert.ok(must(t.action_kinds, "action_kinds").some((k) => k.venue?.hours?.weekly.length));
  const holidays = must(t.holidays, "holidays");
  const all = holidays.filter((h) => !h.offices).map((h) => h.year);
  assert.ok(holidays.some((h) => h.offices?.length === 1 && all.includes(h.year)));
  assert.ok(holidays.some((h) => h.offices?.some((o) => typeof o === "object" && o.venue)), "an entry for a venue too");
  const statuses = new Set([zone, ...holidays, ...must(t.counterparties, "counterparties").map((c) => c.hours), ...must(t.action_kinds, "action_kinds").map((k) => k.venue?.hours)]
    .flatMap((x) => (x ? [x.status] : [])));
  assert.deepEqual([...statuses].sort(), ["researched", "ruled"]);
  /* each reads back through combine with its status and basis */
  const tv = viewOf(combine([TEST]));
  const tvZone = must(tv.time_zone, "time_zone");
  assert.deepEqual([tvZone.value, tvZone.status, tvZone.basis], [zone.value, "researched", "TEST"]);
  assert.equal(must(tv.holidays, "holidays").length, holidays.length);
  for (const h of must(tv.holidays, "holidays")) assert.ok(h.status && h.basis === "TEST" && h.profile === TEST);

  const f = held(FIRST);
  const kinds = must(f.action_kinds, "action_kinds"), counterparties = must(f.counterparties, "counterparties"), fHolidays = must(f.holidays, "holidays");
  /* no template until one is approved (K921 Q1) */
  assert.ok(kinds.every((k) => k.template === undefined));
  /* every calendar fact researched, on the measurement filed for it (K925, M-187–M-196) */
  assert.deepEqual(f.time_zone, { value: "America/Los_Angeles", status: "researched", basis: "M-187" });
  const auditor = findIn(counterparties, (c) => c.role === "City Auditor", "City Auditor");
  assert.deepEqual(auditor.hours, { weekly: WORKDAYS.map((day) => ({ day, open: "08:30", close: "17:00" })),
    status: "researched", basis: "M-192" });
  for (const role of ["Controller", "City Council", "Civil Grand Jury", "State Controller"])
    assert.equal(findIn(counterparties, (c) => c.role === role, role).hours, undefined, `${role}: no published hours (M-194–M-196), absent`);
  const court = must(findIn(kinds, (k) => k.kind === "records_petition", "records_petition").venue, "venue");
  /** @type {Weekday[]} */
  const monToThu = ["mon", "tue", "wed", "thu"];
  assert.deepEqual(court.hours, { weekly: [...monToThu.map((day) => ({ day, open: "08:30", close: "15:00" })),
    { day: "fri", open: "08:30", close: "14:00" }], status: "researched", basis: "M-193" });
  assert.equal(must(findIn(kinds, (k) => k.kind === "records_request", "records_request").venue, "venue").hours, undefined, "the portal: none researched");
  /** @param {Holiday} h
   *  @returns {string[]} */
  const dates = (h) => h.days.map((d) => d.date.slice(5));
  /* the office calendars (K925); T33's closure lists (R47) are R56's and tested there */
  /** @type {{ [basis: string]: Holiday }} */
  const byBasis = {};
  for (const h of fHolidays.filter((x) => !x.list)) byBasis[h.basis] = h;
  /** @param {string} basis
   *  @returns {Holiday} */
  const entry = (basis) => must(byBasis[basis], basis);
  assert.deepEqual(Object.keys(byBasis).sort(), ["M-189", "M-190", "M-191"], "M-188 (county) governs no profile office");
  assert.ok(fHolidays.filter((h) => !h.list).every((h) => h.year === 2026 && h.status === "researched"), "2026 only, researched; 2027 not published");
  assert.deepEqual(entry("M-189").offices, [{ venue: "records_petition" }]);
  assert.deepEqual(dates(entry("M-189")), ["01-01", "01-19", "02-12", "02-16", "03-31", "05-25", "06-19", "07-03", "09-07", "09-25", "11-11", "11-26", "11-27", "12-25"]);
  assert.deepEqual(entry("M-190").offices, ["Controller", "City Council", "City Auditor"]);
  assert.deepEqual(dates(entry("M-190")), ["01-01", "01-19", "02-16", "03-31", "05-25", "06-19", "07-04", "09-07", "11-26", "11-27", "12-25"],
    "09-09 and 11-11 ((HVA) If applicable) left out, undetermined (K925 (3)); 07-04 with no weekday in its place");
  assert.deepEqual(entry("M-191").offices, ["State Controller"]);
  assert.deepEqual(dates(entry("M-191")), ["01-01", "01-19", "02-16", "03-31", "05-25", "07-04", "09-07", "11-11", "11-26", "11-27", "12-25"]);
  assert.ok(!fHolidays.some((h) => !h.offices && !h.list), "no entry closes every office");
  assert.ok(!fHolidays.some((h) => h.offices?.includes("Civil Grand Jury")), "the grand jury's list is undetermined");
  /* each reads back through combine with its status and basis */
  const fv = viewOf(combine([FIRST]));
  const fvZone = must(fv.time_zone, "time_zone");
  assert.deepEqual([fvZone.status, fvZone.basis, fvZone.profile], ["researched", "M-187", FIRST]);
  assert.deepEqual(must(findIn(fv.counterparties, (c) => c.role === "City Auditor", "City Auditor").hours, "hours").bases, [{ profile: FIRST, basis: "M-192" }]);
  assert.deepEqual(must(must(findIn(fv.action_kinds, (k) => k.kind === "records_petition", "records_petition").venue, "venue").hours, "hours").basis, "M-193");
  assert.deepEqual(must(fv.holidays, "holidays").filter((h) => !h.list).map((h) => [h.basis, h.status, h.profile]), [["M-189", "researched", FIRST], ["M-190", "researched", FIRST], ["M-191", "researched", FIRST]]);
});

test("R29 R40 R42 a kind's template, an office's hours and a venue's hours are one value per key", () => {
  const a = sample();
  /** @type {{ [at: string]: (b: Fields) => void }} */
  const changes = {
    "action_kinds[records_request].template": (b) => { at(b, "action_kinds[0].template").approved_at = "2026-09-02"; },
    "counterparties[Clerk/Sample Town].hours": (b) => { listOr(at(b, "counterparties[0].hours").weekly).pop(); },
    "action_kinds[records_request].venue.hours": (b) => { const h = at(b, "action_kinds[0].venue.hours"); h.status = "researched"; h.basis = "M-3"; },
  };
  for (const [where, fn] of Object.entries(changes)) {
    const c = combinedOf(combine([a, two(fn)]));
    assert.deepEqual(c.conflicts.map((x) => x.at), [where], where);
    const first = nth(c.conflicts, 0, "conflicts");
    assert.ok(first.values.length === 2 && first.values.every((v) => v.profile && v.basis));
  }
  const c = combinedOf(combine([a, two(must(changes["counterparties[Clerk/Sample Town].hours"], "the office's change"))]));
  const clerk = must(c.view.counterparties, "counterparties").filter((x) => x.role === "Clerk");
  assert.equal(clerk.length, 1, "the office is kept once; only its hours are withheld");
  assert.equal(nth(clerk, 0, "Clerk").hours, undefined);
  const k = findIn(viewOf(combine([a, two(must(changes["action_kinds[records_request].venue.hours"], "the venue's change"))])).action_kinds, (x) => x.kind === "records_request", "records_request");
  assert.equal(must(k.venue, "venue").how, "email", "the venue stands");
  assert.equal(must(k.venue, "venue").hours, undefined, "its hours withheld");
  assert.equal(nth(viewOf(combine([a, two(must(changes["action_kinds[records_request].template"], "the template's change"))])).action_kinds, 0, "action_kinds").template, undefined);
  /* agreement keeps each with every giver's basis; one giver's alone is kept */
  const e = combinedOf(combine([a, two((b) => { at(b, "action_kinds[0].template").basis = "K924"; at(b, "counterparties[0].hours").basis = "M-77"; })]));
  assert.deepEqual(e.conflicts, []);
  assert.deepEqual(must(nth(e.view.action_kinds, 0, "action_kinds").template, "template").bases, [{ profile: "sample-town", basis: "K921" }, { profile: "sample-two", basis: "K924" }]);
  assert.deepEqual(must(nth(e.view.counterparties, 0, "counterparties").hours, "hours").bases, [{ profile: "sample-town", basis: "M-15" }, { profile: "sample-two", basis: "M-77" }]);
  const one = combinedOf(combine([a, two((b) => { delete at(b, "counterparties[0]").hours; delete at(b, "action_kinds[0].venue").hours; delete at(b, "action_kinds[0]").template; })]));
  assert.deepEqual(one.conflicts, []);
  assert.equal(must(nth(one.view.counterparties, 0, "counterparties").hours, "hours").basis, "M-15");
  assert.equal(must(must(nth(one.view.action_kinds, 0, "action_kinds").venue, "venue").hours, "hours").basis, "K5");
  assert.equal(must(nth(one.view.action_kinds, 0, "action_kinds").template, "template").id, "TPL-sample-request");
});

test("R35 TEMPLATE_UNATTRIBUTED and HOURS_INVALID; time_zone a known section", () => {
  assert.ok(hasError(breakIt((p) => { at(p, "action_kinds[0]").template = "Please send it."; }), "TEMPLATE_UNATTRIBUTED", "action_kinds[0].template"));
  assert.ok(hasError(breakIt((p) => { at(p, "counterparties[0].hours.weekly[0]").day = "funday"; }), "HOURS_INVALID", "counterparties[0].hours.weekly[0].day"));
  assert.ok(hasError(breakIt((p) => { at(p, "holidays[2]").offices = ["Nobody"]; }), "HOLIDAY_INVALID", "holidays[2].offices[0]"));
  assert.ok(!validate(sample()).errors.some((e) => e.path === "time_zone"));
});
