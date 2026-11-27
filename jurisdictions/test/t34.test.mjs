/* jurisdictions, T34 (T34-2): the `body` and `office` spaces (R3), the vote-value and response-status vocabularies (R58),
 * a counterparty's identifiers (R59), the MemberType map (R60), the held profiles' schemes and Oakland's measured data
 * (R61) and the test profile (R62). Tested at the module's interface: validate, combine, get. Oakland's Legistar facts are
 * checked against legistar-reader's captured rows (2026-10-05), the measurement they rest on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine, SPACES, VOCABULARY } from "../index.mjs";
import { isObj, isList } from "../shared.mjs";
import { applyForm, walkFacts, must, held, viewOf, combinedOf, loose, at, pick } from "./helpers.mjs";
import BODIES_CAPTURE from "../../legistar-reader/test/fixtures/bodies.json" with { type: "json" };
import OFFICE_RECORDS_0 from "../../legistar-reader/test/fixtures/officerecords-0.json" with { type: "json" };
import OFFICE_RECORDS_1 from "../../legistar-reader/test/fixtures/officerecords-1.json" with { type: "json" };
import PERSONS_CAPTURE from "../../legistar-reader/test/fixtures/persons.json" with { type: "json" };
/** @import { Profile, View, Validation, Pattern, Counterparty, MemberType, IdentifierScheme, Spaces, Space } from "../index.mjs" */
/** @import { Fields, Value } from "../shared.mjs" */

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
/** @param {Validation} r @param {string} code @param {string} [path] @returns {boolean} */
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/** @param {(p: Fields) => void} fn @returns {Validation} */
const breakT = (fn) => { const p = loose(held(TEST)); fn(p); return validate(p); };
/** @param {(p: Fields) => void} fn @returns {Validation} */
const breakF = (fn) => { const p = loose(held(FIRST)); fn(p); return validate(p); };
/** @param {(p: Fields) => void} fn @returns {Fields} */
const other = (fn) => { const p = loose(held(TEST)); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
/** @param {object} o @param {string} k @returns {boolean} */
const own = (o, k) => Object.hasOwn(o, k);
/** A held profile's counterparty by role; a thrown failure when none is. @param {Profile} p @param {string} role @returns {Counterparty} */
const cp = (p, role) => must(must(p.counterparties, "counterparties").find((c) => c.role === role), `counterparty ${role}`);
/** A loose value that is a list; a thrown failure otherwise. @param {Value} v @param {string} what @returns {Value[]} */
const listAt = (v, what) => { if (!isList(v)) throw new TypeError(`${what}: not a list`); return v; };
/** Appends to the list at a member of a loose copy. @param {Fields} o @param {string} k @param {Value} v @returns {void} */
const append = (o, k, v) => { listAt(o[k], k).push(v); };
/** The `name` member of each entry of a loose list. @param {Value} list @param {string} name @returns {Value[]} */
const field = (list, name) => listAt(list, name).map((e) => (isObj(e) ? e[name] : undefined));
/** A held profile's member types. @param {Profile} p @returns {MemberType[]} */
const mt = (p) => must(must(p.vocabulary, "vocabulary").member_types, "member_types");
/** The view's member types. @param {View} v */
const vmt = (v) => must(must(v.vocabulary, "vocabulary").member_types, "member_types");
/** A profile's space of that name, or undefined.
 *  @param {Spaces} s @param {string} name @returns {Space | undefined} */
function spaceNamed(s, name) {
  switch (name) {
    case "enactment": return s.enactment;
    case "project": return s.project;
    case "fund": return s.fund;
    case "parcel": return s.parcel;
    case "account": return s.account;
    case "object": return s.object;
    case "vendor": return s.vendor;
    case "proceeding": return s.proceeding;
    case "person": return s.person;
    case "body": return s.body;
    case "office": return s.office;
    case "institution": return s.institution;
    default: return undefined;
  }
}
/** A profile's space of that name; a thrown failure when there is none.
 *  @param {Spaces | undefined} s @param {string} name @returns {Space} */
const spaceOf = (s, name) => must(spaceNamed(must(s, "spaces"), name), `space ${name}`);
const BODIES = BODIES_CAPTURE.body;
const OFFICE_RECORDS = [...OFFICE_RECORDS_0.body, ...OFFICE_RECORDS_1.body];
const PERSONS = PERSONS_CAPTURE.body;
/* A value read in a scheme's form, as id-spaces reads it (helpers' independent R3). */
/** @param {Profile} p @param {string} scheme @param {string} value @returns {string | null} */
const reads = (p, scheme, value) => {
  const x = must(must(p.identifier_schemes, "identifier_schemes").find((s) => s.scheme === scheme), `scheme ${scheme}`);
  const f = must(spaceOf(p.spaces, x.space).forms.find((y) => y.form === x.form), `form of ${scheme}`);
  return applyForm(f, value);
};
/** @type {Array<"body" | "office">} */
const BODY_OFFICE = ["body", "office"];

/* ============================================================================================== */
/* R3: the body and office spaces.                                                                 */

test("R3 T34 spaces: body and office are known spaces, judged with R3's forms, carried in the view", () => {
  for (const sp of BODY_OFFICE) {
    assert.ok(SPACES.includes(sp), sp);
    for (const id of [FIRST, TEST]) assert.ok(spaceOf(held(id).spaces, sp).forms.length, `${id} ${sp}`);
    assert.ok(hasError(breakT((p) => { at(p, `spaces.${sp}.forms[0]`).pattern = { re: "(" }; }), "PATTERN_INVALID", `spaces.${sp}.forms[0].pattern`), sp);
    assert.ok(hasError(breakT((p) => { at(p, `spaces.${sp}.forms[0]`).normal = [{ group: 3 }]; }), "NORMAL_INVALID", `spaces.${sp}.forms[0].normal[0]`), sp);
    assert.ok(hasError(breakT((p) => { append(at(p, `spaces.${sp}`), "forms", { ...at(p, `spaces.${sp}.forms[0]`) }); }), "DUPLICATE_FORM", `spaces.${sp}.forms[1].form`), sp);
    assert.ok(hasError(breakT((p) => { at(p, `spaces.${sp}`).kinds = []; }), "UNKNOWN_SECTION", `spaces.${sp}.kinds`), `${sp}: kinds are enactment's only`);
    assert.ok(hasError(breakT((p) => { delete at(p, `spaces.${sp}.forms[0]`).basis; }), "BASIS_MISSING", `spaces.${sp}.forms[0].basis`), sp);
    assert.ok(must(must(viewOf(combine([FIRST])).spaces, "spaces")[sp], sp).forms.every((f) => f.profile === FIRST), sp);
  }
  /* a crosswalk may join two forms of one of them, as of any space */
  assert.ok(breakT((p) => {
    append(at(p, "spaces.body"), "forms", { form: "harbour-body", pattern: { re: "^H(\\d)$" }, normal: ["H", { group: 1 }], basis: "TEST" });
    append(p, "crosswalks", { space: "body", forms: ["minute-body", "harbour-body"], pairs: [["B-01", "H1"]], source: "1a".repeat(32), basis: "TEST" });
  }).ok);
  /* the first profile's forms read every captured BodyId and OfficeRecordId, and nothing that is not a number */
  const f = held(FIRST);
  const body = must(spaceOf(f.spaces, "body").forms[0], "body form"), office = must(spaceOf(f.spaces, "office").forms[0], "office form");
  for (const b of BODIES) assert.equal(applyForm(body, String(b.BodyId)), String(b.BodyId));
  for (const r of OFFICE_RECORDS) assert.equal(applyForm(office, String(r.OfficeRecordId)), String(r.OfficeRecordId));
  for (const bad of ["", "B1", "1.5", "-1", "12345678"]) { assert.equal(applyForm(office, bad), null, bad); }
  for (const bad of ["", "x1", "1234567"]) assert.equal(applyForm(body, bad), null, bad);
});

/* ============================================================================================== */
/* R58: vote values and response statuses.                                                         */

test("R58 vote_values {value, label, citation, basis} and response_statuses {status, label, citation, basis}: known keys, none twice, VALUE_INVALID otherwise", () => {
  /** @type {Array<["vote_values" | "response_statuses", "value" | "status"]>} */
  const KEYS = [["vote_values", "value"], ["response_statuses", "status"]];
  /** @type {Array<"label" | "citation">} */
  const TEXTS = ["label", "citation"];
  for (const [key, name] of KEYS) {
    const A = `vocabulary.${key}[0]`;
    /** The test profile's entries under the key, read loosely. */
    const testEntries = () => at(loose(held(TEST)), "vocabulary")[key];
    assert.ok(VOCABULARY.includes(key), key);
    assert.ok(!hasError(validate(held(TEST)), "UNKNOWN_VOCABULARY"), key);
    for (const good of ["aye", "no_vote", "a1"]) assert.ok(breakT((p) => { at(p, A)[name] = good; }).ok, `${key} ${good}`);
    for (const bad of ["Aye", "1st", "no vote", "", 3, null, undefined])
      assert.ok(hasError(breakT((p) => { at(p, A)[name] = bad; }), "VALUE_INVALID", `${A}.${name}`), `${key} ${String(bad)}`);
    assert.ok(hasError(breakT((p) => { at(p, `vocabulary.${key}[1]`)[name] = at(p, A)[name]; }), "VALUE_INVALID", `vocabulary.${key}[1].${name}`), `${key}: twice`);
    for (const f of TEXTS) for (const bad of ["", "  ", 3, undefined])
      assert.ok(hasError(breakT((p) => { at(p, A)[f] = bad; }), "VALUE_INVALID", `${A}.${f}`), `${key} ${f} ${String(bad)}`);
    assert.ok(hasError(breakT((p) => { delete at(p, A).basis; }), "BASIS_MISSING", `${A}.basis`), key);
    assert.ok(hasError(breakT((p) => { at(p, A).pattern = { re: "x" }; }), "UNKNOWN_SECTION", `${A}.pattern`), `${key}: data, not a pattern`);
    assert.ok(hasError(breakT((p) => { listAt(at(p, "vocabulary")[key], key)[0] = "aye"; }), "VALUE_INVALID", A), key);
    assert.ok(hasError(breakT((p) => { at(p, "vocabulary")[key] = {}; }), "VALUE_INVALID", `vocabulary.${key}`), key);
    assert.ok(hasError(breakF((p) => { at(p, "vocabulary")[key] = [{ [name]: "x", label: "X", citation: "C", basis: "TEST" }]; }), "BASIS_INVALID", `${A}.basis`), `${key}: TEST only in a test profile`);
    assert.ok(breakF((p) => { at(p, "vocabulary")[key] = [{ [name]: "x", label: "X", citation: "C", basis: "M-1" }]; }).ok, `${key} in a real profile`);
    /* unioned in combine (R14, R55): order kept, an equal entry kept once with both bases, a new one added */
    const u = combinedOf(combine([TEST, other((b) => {
      at(b, A).basis = "TEST";
      append(at(b, "vocabulary"), key, { [name]: "recused", label: "Recused", citation: "Other § 1", basis: "TEST" });
    })]));
    assert.deepEqual(u.conflicts, []);
    const uv = loose(u.view);
    const v = listAt(at(uv, "vocabulary")[key], key);
    assert.deepEqual(field(v, name), [...field(testEntries(), name), "recused"], key);
    assert.deepEqual(field(at(uv, `vocabulary.${key}[0]`).bases, "profile"), [TEST, "test-other"], key);
    assert.equal(at(uv, `vocabulary.${key}[${v.length - 1}]`).profile, "test-other");
    /* a different label under one value is a different entry: unioned, never chosen between */
    const l = combinedOf(combine([TEST, other((b) => { at(b, A).label = "Another label"; })]));
    assert.deepEqual(l.conflicts, []);
    const first = at(loose(held(TEST)), A)[name];
    assert.equal(listAt(at(loose(l.view), "vocabulary")[key], key).filter((e) => isObj(e) && e[name] === first).length, 2, key);
    /* no default: a profile that gives none supplies none, and the view has none */
    /* the first profile gives no vote values; its response statuses are Penal Code § 933.05's, for the grand jury (R85, T45) */
    const fv = must(viewOf(combine([FIRST])).vocabulary, "vocabulary");
    if (key === "vote_values") assert.equal(fv.vote_values, undefined, `${key}: the first profile gives none, so none`);
    else assert.ok(must(fv.response_statuses, key).every((e) => e.applies_to === "grand_jury" && /933\.05/.test(e.citation)), key);
    const none = loose(held(TEST)); delete at(none, "vocabulary")[key]; none.id = "test-none";
    assert.ok(validate(none).ok);
    assert.equal(must(viewOf(combine([none])).vocabulary, "vocabulary")[key], undefined, key);
    assert.equal(viewOf(combine([])).vocabulary, undefined);
  }
});

/* ============================================================================================== */
/* R59: a counterparty's identifiers, the organisation its body is part of, its body-variant key.  */

test("R59 a counterparty's ids {office?, body?}, within {label, kind, ids} and organisation: SCHEME_INVALID for an identifier, VALUE_INVALID otherwise", () => {
  const t = held(TEST);
  const i = must(t.counterparties, "counterparties").findIndex((c) => c.ids);
  const C = `counterparties[${i}]`;
  assert.ok(i >= 0 && validate(t).ok);
  /* each identifier: a scheme of the profile whose entity_kinds include what it identifies, and a non-empty id */
  /** @type {Array<["office" | "body", "office" | "body"]>} */
  const FIELDS = [["office", "office"], ["body", "body"]];
  for (const [field, kind] of FIELDS) {
    const F = `${C}.ids.${field}`;
    assert.ok(hasError(breakT((p) => { at(p, F).scheme = "nowhere"; }), "SCHEME_INVALID", `${F}.scheme`), `${field} unknown scheme`);
    const wrongKind = kind === "office" ? "ellery_body" : "ellery_seat";
    assert.ok(hasError(breakT((p) => { at(p, F).scheme = wrongKind; }), "SCHEME_INVALID", `${F}.scheme`), `${field} scheme of another kind`);
    assert.ok(hasError(breakT((p) => { at(p, F).scheme = "ellery_person"; }), "SCHEME_INVALID", `${F}.scheme`), `${field} a person scheme`);
    for (const bad of ["", "  ", 1, null, undefined]) assert.ok(hasError(breakT((p) => { at(p, F).id = bad; }), "SCHEME_INVALID", `${F}.id`), `${field} id ${String(bad)}`);
    for (const bad of ["B-01", null, [], 3]) assert.ok(hasError(breakT((p) => { at(p, `${C}.ids`)[field] = bad; }), "SCHEME_INVALID", F), `${field} ${JSON.stringify(bad)}`);
    assert.ok(hasError(breakT((p) => { at(p, F).valid = "2026"; }), "UNKNOWN_SECTION", `${F}.valid`));
    assert.ok(breakT((p) => { delete at(p, `${C}.ids`)[field]; }).ok, `${field} alone is optional`);
  }
  /* a scheme naming several kinds serves each */
  assert.ok(breakT((p) => { pick(p, "identifier_schemes", "scheme", "ellery_body").entity_kinds = ["office", "body"]; at(p, `${C}.ids.office`).scheme = "ellery_body"; }).ok);
  /* the scheme is the profile's, wherever it is listed */
  assert.ok(hasError(breakT((p) => { p.identifier_schemes = listAt(p.identifier_schemes, "identifier_schemes").filter((x) => !(isObj(x) && x.scheme === "ellery_seat")); }), "SCHEME_INVALID", `${C}.ids.office.scheme`));
  for (const bad of [{}, "B-01", [], null]) assert.ok(hasError(breakT((p) => { at(p, C).ids = bad; }), "VALUE_INVALID", `${C}.ids`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { at(p, `${C}.ids`).seat = { scheme: "ellery_seat", id: "SEAT-001" }; }), "UNKNOWN_SECTION", `${C}.ids.seat`));
  /* within: its label, its entity kind, and identifiers in schemes for that kind */
  const W = `${C}.within`;
  for (const bad of ["", 3, undefined]) assert.ok(hasError(breakT((p) => { at(p, W).label = bad; }), "VALUE_INVALID", `${W}.label`), String(bad));
  for (const bad of ["Institution", "", undefined, 3]) assert.ok(hasError(breakT((p) => { at(p, W).kind = bad; }), "VALUE_INVALID", `${W}.kind`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, W).kind = "body"; }), "SCHEME_INVALID", `${W}.ids[0].scheme`), "the institution scheme identifies no body");
  assert.ok(hasError(breakT((p) => { at(p, `${W}.ids[0]`).scheme = "nowhere"; }), "SCHEME_INVALID", `${W}.ids[0].scheme`));
  assert.ok(hasError(breakT((p) => { at(p, `${W}.ids[0]`).id = ""; }), "SCHEME_INVALID", `${W}.ids[0].id`));
  assert.ok(hasError(breakT((p) => { at(p, W).ids = { scheme: "marlow_registry", id: "MR0001" }; }), "VALUE_INVALID", `${W}.ids`));
  assert.ok(breakT((p) => { at(p, W).ids = []; }).ok, "named with no identifier held");
  for (const bad of ["City of Port Ellery", null, []]) assert.ok(hasError(breakT((p) => { at(p, C).within = bad; }), "VALUE_INVALID", W), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { at(p, W).sector = "government"; }), "UNKNOWN_SECTION", `${W}.sector`));
  /* organisation: a key the body-variant map names */
  for (const bad of ["Selectboard", "", 3, "1x"]) assert.ok(hasError(breakT((p) => { at(p, C).organisation = bad; }), "VALUE_INVALID", `${C}.organisation`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, C).organisation = "town_meeting"; }), "VALUE_INVALID", `${C}.organisation`), "a key no body variant names");
  assert.ok(breakT((p) => { at(p, C).organisation = "harbour_commission"; }).ok);
  assert.ok(breakT((p) => { const c = at(p, C); delete c.ids; delete c.within; delete c.organisation; }).ok, "all three optional");
  /* every fault is reported */
  const all = breakT((p) => { at(p, `${C}.ids`).body = { scheme: "nowhere", id: "" }; at(p, C).organisation = "nobody"; });
  assert.deepEqual(all.errors.map((e) => [e.path, e.code]), [[`${C}.ids.body.scheme`, "SCHEME_INVALID"], [`${C}.ids.body.id`, "SCHEME_INVALID"],
    [`${C}.organisation`, "VALUE_INVALID"]]);
});

test("R59 combine: a counterparty's ids, within and organisation under one role and body are one value per key", () => {
  const t = held(TEST);
  const sbT = cp(t, "Selectboard");
  /** @param {Fields} p @returns {Fields} */
  const sb = (p) => pick(p, "counterparties", "role", "Selectboard");
  /* agreement keeps each; the office is kept once, with every giver's basis */
  const same = combinedOf(combine([TEST, other(() => {})]));
  assert.deepEqual(same.conflicts, []);
  const s = must(same.view.counterparties, "counterparties").filter((x) => x.role === "Selectboard");
  assert.equal(s.length, 1);
  const s0 = must(s[0], "Selectboard");
  assert.deepEqual([s0.ids, s0.within, s0.organisation], [sbT.ids, sbT.within, sbT.organisation]);
  assert.deepEqual(s0.bases.map((b) => b.profile), [TEST, "test-other"]);
  /* disagreement withholds that fact only */
  /** @type {Array<["ids" | "within" | "organisation", (b: Fields) => void]>} */
  const changes = [
    ["ids", (b) => { at(sb(b), "ids.body").id = "B-02"; }],
    ["within", (b) => { at(sb(b), "within").label = "Port Ellery Borough"; }],
    ["organisation", (b) => { sb(b).organisation = "harbour_commission"; }],
  ];
  for (const [f, fn] of changes) {
    const c = combinedOf(combine([TEST, other(fn)]));
    assert.ok(c.ok, f);
    assert.deepEqual(c.conflicts.map((x) => x.at), [`counterparties[Selectboard/Port Ellery Selectboard].${f}`], f);
    const x = must(c.conflicts[0], `${f}: a conflict`);
    assert.ok(x.values.length === 2 && x.values.every((v) => v.profile && v.basis && "value" in v) && /undetermined/.test(x.says), f);
    const k = must(c.view.counterparties, "counterparties").filter((y) => y.role === "Selectboard");
    assert.equal(k.length, 1, `${f}: the office is kept once`);
    const k0 = must(k[0], "Selectboard");
    assert.equal(k0[f], undefined, `${f}: withheld, never chosen`);
    for (const g of changes.map(([y]) => y).filter((y) => y !== f)) assert.deepEqual(k0[g], sbT[g], `${f}: ${g} stands`);
  }
  /* one giver only: kept as given */
  const one = combinedOf(combine([TEST, other((b) => { const x = sb(b); delete x.ids; delete x.within; delete x.organisation; })]));
  assert.deepEqual(one.conflicts, []);
  assert.deepEqual(must(must(one.view.counterparties, "counterparties").find((y) => y.role === "Selectboard"), "Selectboard").ids, sbT.ids);
  /* an office without them carries none in the view */
  assert.equal(must(must(viewOf(combine([TEST])).counterparties, "counterparties").find((y) => y.role === "Town Clerk"), "Town Clerk").ids, undefined);
});

/* ============================================================================================== */
/* R60: the MemberType map.                                                                        */

test("R60 member_types [{member_type, capacity, organisation?, basis}]: as written, once per body and once for all, capacity elected or appointed; one value per type and body in combine", () => {
  const MT = "vocabulary.member_types[0]";
  assert.ok(VOCABULARY.includes("member_types"));
  for (const capacity of ["elected", "appointed"]) assert.ok(breakT((p) => { at(p, MT).capacity = capacity; }).ok, capacity);
  for (const bad of ["undetermined", "Elected", "", null, undefined])
    assert.ok(hasError(breakT((p) => { at(p, MT).capacity = bad; }), "VALUE_INVALID", `${MT}.capacity`), String(bad));
  for (const good of ["Member", "Vice Chair", "Ex-Officio (non-voting)"]) assert.ok(breakT((p) => { at(p, MT).member_type = good; }).ok, good);
  for (const bad of ["", "  ", 3, null, undefined])
    assert.ok(hasError(breakT((p) => { at(p, MT).member_type = bad; }), "VALUE_INVALID", `${MT}.member_type`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, "vocabulary.member_types[1]").member_type = at(p, MT).member_type; }), "VALUE_INVALID",
    "vocabulary.member_types[1].member_type"), "a type twice");
  assert.ok(hasError(breakT((p) => { at(p, MT).label = "x"; }), "UNKNOWN_SECTION", `${MT}.label`));
  assert.ok(hasError(breakT((p) => { delete at(p, MT).basis; }), "BASIS_MISSING", `${MT}.basis`));
  /* a type the profile does not list maps to no capacity: the view holds only what is given */
  const v = vmt(viewOf(combine([TEST])));
  assert.deepEqual(v.map((e) => [e.member_type, e.capacity]), mt(held(TEST)).map((e) => [e.member_type, e.capacity]));
  assert.equal(v.find((e) => e.member_type === "Chair"), undefined);
  /* one value per type: agreement kept with both bases; disagreement withheld and reported, the other types stand */
  const same = combinedOf(combine([TEST, other(() => {})]));
  assert.deepEqual(same.conflicts, []);
  assert.deepEqual(must(vmt(same.view)[0], "member type").bases.map((b) => b.profile), [TEST, "test-other"]);
  const c = combinedOf(combine([TEST, other((b) => { at(b, MT).capacity = "appointed"; })]));
  const type = must(mt(held(TEST))[0], "member type").member_type;
  assert.deepEqual(c.conflicts.map((x) => x.at), [`vocabulary.member_types[${type}]`]);
  const c0 = must(c.conflicts[0], "a conflict");
  assert.deepEqual(c0.values.map(/** @returns {Value[]} */ (x) => [x.profile, x.value]), [[TEST, "elected"], ["test-other", "appointed"]]);
  assert.ok(/undetermined/.test(c0.says));
  assert.equal(vmt(c.view).find((e) => e.member_type === type), undefined, "withheld, never chosen");
  assert.equal(vmt(c.view).length, mt(held(TEST)).length - 1);
  /* (K1729) an entry may be for one body, a body-variant key; a type once per body and once for all bodies */
  /** @param {Profile} p */
  const O = (p) => mt(p).findIndex((e) => e.organisation);
  const oi = O(held(TEST));
  assert.ok(oi >= 0, "the test profile maps a type for one body");
  assert.ok(breakT((p) => { at(p, `vocabulary.member_types[${oi}]`).organisation = "selectboard"; }).ok);
  for (const bad of ["Harbour Commission", "town_meeting", "", 3, null])
    assert.ok(hasError(breakT((p) => { at(p, `vocabulary.member_types[${oi}]`).organisation = bad; }), "VALUE_INVALID", `vocabulary.member_types[${oi}].organisation`), String(bad));
  assert.ok(hasError(breakT((p) => { append(at(p, "vocabulary"), "member_types", { ...at(p, `vocabulary.member_types[${oi}]`), capacity: "appointed" }); }), "VALUE_INVALID",
    `vocabulary.member_types[${mt(held(TEST)).length}].member_type`), "a type twice for one body");
  const tt = must(mt(held(TEST))[oi], "member type").member_type;
  assert.ok(mt(held(TEST)).some((e) => e.member_type === tt && !e.organisation), "the same type for all bodies stands beside it");
  const ob = combinedOf(combine([TEST, other((b) => { at(b, `vocabulary.member_types[${oi}]`).capacity = "appointed"; })]));
  assert.deepEqual(ob.conflicts.map((x) => x.at), [`vocabulary.member_types[${tt}/harbour_commission]`], "keyed by type and body");
  assert.ok(vmt(ob.view).some((e) => e.member_type === tt && !e.organisation), "the all-bodies entry stands");
  /* a type only one profile gives is kept */
  const add = combinedOf(combine([TEST, other((b) => { append(at(b, "vocabulary"), "member_types", { member_type: "Alternate", capacity: "appointed", basis: "TEST" }); })]));
  assert.deepEqual(add.conflicts, []);
  assert.equal(must(vmt(add.view).at(-1), "member type").member_type, "Alternate");
});

/* ============================================================================================== */
/* R61: the held profiles' schemes and Oakland's measured data.                                    */

test("R61 the first profile's Legistar schemes: PersonId, BodyId and OfficeRecordId, each in its space and form, issued by the legislative record", () => {
  const f = held(FIRST);
  const by = new Map(must(f.identifier_schemes, "identifier_schemes").map(/** @returns {[string, IdentifierScheme]} */ (x) => [x.scheme, x]));
  /** @type {Array<[string, string, string]>} */
  const SCHEMES = [["legistar_person_id", "person", "person"], ["legistar_body_id", "body", "body"],
    ["legistar_office_record_id", "office", "office"]];
  for (const [scheme, kind, space] of SCHEMES) {
    const x = by.get(scheme);
    assert.ok(x, scheme);
    assert.deepEqual([x.entity_kinds, x.space, x.systems, x.basis], [[kind], space, ["oakland.legistar"], "2026-10-05 legistar-events"], scheme);
    assert.ok(spaceOf(f.spaces, space).forms.some((y) => y.form === x.form), scheme);
  }
  /* every captured row's id reads in its scheme's form, as itself (a normal form never changes a digit) */
  for (const b of BODIES) assert.equal(reads(f, "legistar_body_id", ` ${b.BodyId} `), String(b.BodyId));
  for (const r of OFFICE_RECORDS) {
    assert.equal(reads(f, "legistar_office_record_id", String(r.OfficeRecordId)), String(r.OfficeRecordId));
    assert.equal(reads(f, "legistar_body_id", String(r.OfficeRecordBodyId)), String(r.OfficeRecordBodyId));
    if (r.OfficeRecordPersonId != null) assert.equal(reads(f, "legistar_person_id", String(r.OfficeRecordPersonId)), String(r.OfficeRecordPersonId));
  }
  for (const p of PERSONS) assert.equal(reads(f, "legistar_person_id", String(p.PersonId)), String(p.PersonId));
  /* the view carries them, so a deployed copy resolves the rows it reads (events R22, instance-setup R50–R52) */
  const v = viewOf(combine([FIRST]));
  assert.deepEqual(must(v.identifier_schemes, "identifier_schemes").map((x) => x.scheme).slice(0, 3), ["legistar_person_id", "legistar_body_id", "legistar_office_record_id"]);
  const vs = must(v.spaces, "spaces");
  assert.ok(vs.body && vs.office);
});

test("R61 the first profile's counterparties: Legistar BodyIds, the Auditor and Finance as Legistar names them, the Council's organisation, within the City", () => {
  const f = held(FIRST);
  /** @param {string} id */
  const name = (id) => BODIES.find((b) => String(b.BodyId) === id)?.BodyName;
  /** @param {{ pattern: Pattern }} e */
  const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");
  /** @param {string} bodyName */
  const variant = (bodyName) => must(must(f.vocabulary, "vocabulary").body_variants, "body_variants").find((e) => rx(e).test(bodyName))?.organisation;
  /* K1690: the Auditor's and Finance's entries in the form Legistar gives them, each with that body's BodyId */
  /** @type {Array<[string, string, string]>} */
  const NAMED = [["City Auditor", "Office Of The City Auditor", "16"], ["Controller", "Finance Department", "171"]];
  for (const [role, body, id] of NAMED) {
    const c = cp(f, role);
    assert.equal(c.body, body, role);
    assert.deepEqual(c.ids, { body: { scheme: "legistar_body_id", id } }, role);
    assert.equal(name(id), body, `${role}: the captured body ${id} is named as the profile names it`);
  }
  /* the Council: its own body, and the organisation its Legistar variants are mapped to */
  const council = cp(f, "City Council");
  assert.deepEqual(council.ids, { body: { scheme: "legistar_body_id", id: "1" } });
  assert.equal(council.organisation, "city_council");
  assert.equal(variant(String(name("1"))), "city_council", "BodyId 1 is a variant of city_council");
  for (const b of BODIES.filter((x) => variant(x.BodyName) === "city_council")) assert.match(b.BodyName, /Oakland City Council/, b.BodyName);
  /* each identifier names a body the capture holds; each counterparty with one rests on that read too */
  for (const c of must(f.counterparties, "counterparties").filter((x) => x.ids)) {
    assert.ok(name(must(must(c.ids, `${c.role} ids`).body, `${c.role} body id`).id), c.role);
    assert.match(c.basis, /2026-10-05 legistar-events/, c.role);
  }
  /* the City's three offices are within the City of Oakland, named with no identifier: none is measured (R61) */
  for (const role of ["Controller", "City Council", "City Auditor"])
    assert.deepEqual(cp(f, role).within, { label: "City of Oakland", kind: "institution", ids: [] }, role);
  /* the offices no Legistar body names carry none: absent, never invented */
  /** @type {Array<"ids" | "within" | "organisation">} */
  const FACTS = ["ids", "within", "organisation"];
  for (const role of ["Civil Grand Jury", "State Controller"]) for (const k of FACTS)
    assert.equal(cp(f, role)[k], undefined, `${role} ${k}`);
  /* the view carries them on each office */
  const v = viewOf(combine([FIRST]));
  const vc = must(must(v.counterparties, "counterparties").find((c) => c.role === "City Council"), "City Council");
  assert.deepEqual(must(must(vc.ids, "ids").body, "body id").id, "1");
});

test("R61 the first profile's member_types: Member and Chair on city_council, elected, and nothing for any other body (K1729)", () => {
  const f = held(FIRST);
  /** @param {{ pattern: Pattern }} e */
  const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");
  /** @param {string} bodyName */
  const orgOf = (bodyName) => must(must(f.vocabulary, "vocabulary").body_variants, "body_variants").find((e) => rx(e).test(bodyName))?.organisation;
  /* the captured office records' MemberTypes (2026-10-05) */
  const types = new Set(OFFICE_RECORDS.flatMap((r) => { const t = r.OfficeRecordMemberType; return t != null ? [t] : []; }));
  assert.deepEqual([...types].sort(), ["Chair", "Member"]);
  assert.deepEqual(mt(f).map((e) => [e.member_type, e.organisation, e.capacity]),
    [["Member", "city_council", "elected"], ["Chair", "city_council", "elected"]]);
  for (const e of mt(f)) assert.match(e.basis, /2026-10-05 legistar-events/);
  /* on the Council's bodies every holder is a councilmember, seated on the Council's own body (BodyId 1; Charter §200) */
  const council = new Set(OFFICE_RECORDS.filter((r) => r.OfficeRecordBodyId === 1).map((r) => r.OfficeRecordPersonId));
  const onCouncil = OFFICE_RECORDS.filter((r) => orgOf(r.OfficeRecordBodyName) === "city_council");
  assert.ok(onCouncil.length > 0);
  for (const r of onCouncil) {
    assert.ok(council.has(r.OfficeRecordPersonId), `${r.OfficeRecordFullName} on ${r.OfficeRecordBodyName}`);
    assert.ok(mt(f).some((e) => e.member_type === r.OfficeRecordMemberType && e.organisation === "city_council"),
      `${r.OfficeRecordMemberType} on the Council maps`);
  }
  /* elsewhere the same types carry people the Council's records never list, so no entry for all bodies or any other */
  for (const t of types)
    assert.ok(OFFICE_RECORDS.some((r) => r.OfficeRecordMemberType === t && !council.has(r.OfficeRecordPersonId)), `${t} is recorded for non-councilmembers`);
  assert.ok(mt(f).every((e) => e.organisation === "city_council"), "no entry for all bodies");
  assert.deepEqual(vmt(viewOf(combine([FIRST]))).map((e) => [e.member_type, e.organisation]),
    [["Member", "city_council"], ["Chair", "city_council"]]);
});

test("R61 N574 the test profile holds an institution scheme in the institution space; the first holds none until a registry is measured (N632, K1729)", () => {
  assert.ok(SPACES.includes("institution"));
  const t = held(TEST);
  const x = must(must(t.identifier_schemes, "identifier_schemes").find((s) => s.entity_kinds.includes("institution")), "institution scheme");
  assert.deepEqual([x.scheme, x.space], ["port_ellery_registry", "institution"]);
  assert.ok(x.form && spaceOf(t.spaces, "institution").forms.some((f) => f.form === x.form));
  assert.equal(applyForm(must(spaceOf(t.spaces, "institution").forms.find((f) => f.form === x.form), "institution form"), "mr 0001"), "MR0001");
  assert.ok(hasError(breakT((p) => { at(p, "spaces.institution.forms[0]").pattern = { re: "(" }; }), "PATTERN_INVALID", "spaces.institution.forms[0].pattern"));
  /* the view carries it, so entities R43 can hold an issuer's identifier in it */
  const v = viewOf(combine([TEST]));
  assert.ok(must(v.spaces, "spaces").institution && must(v.identifier_schemes, "identifier_schemes").some((s) => s.scheme === "port_ellery_registry"));
  const f = held(FIRST);
  assert.equal(must(f.spaces, "spaces").institution, undefined);
  assert.ok(!must(f.identifier_schemes, "identifier_schemes").some((s) => s.entity_kinds.includes("institution")), "absent, never invented");
});

/* ============================================================================================== */
/* R62: the test profile.                                                                          */

test("R62 the test profile supplies R58–R61's keys and fields, unlike the first profile's", () => {
  const t = held(TEST), f = held(FIRST);
  /** @type {Array<"vote_values" | "response_statuses" | "member_types">} */
  const KEYS = ["vote_values", "response_statuses", "member_types"];
  const tvoc = must(t.vocabulary, "vocabulary"), fvoc = must(f.vocabulary, "vocabulary");
  for (const key of KEYS) {
    const tv = tvoc[key];
    assert.ok(tv && tv.length, key);
    assert.notDeepEqual(tv, fvoc[key], key);
  }
  const c = must(t.counterparties, "counterparties").find((x) => x.ids && x.within && x.organisation);
  assert.ok(c, "a counterparty carrying ids, within and organisation");
  const ids = must(c.ids, "ids");
  assert.ok(ids.office && ids.body, "an office's and a body's identifier");
  assert.ok(must(c.within, "within").ids.length, "within with an identifier");
  /** @param {string} k */
  const kinds = (k) => must(t.identifier_schemes, "identifier_schemes").filter((x) => x.entity_kinds.includes(k));
  assert.ok(kinds("body").some((x) => x.space === "body"), "a body scheme in the body space");
  assert.ok(kinds("office").some((x) => x.space === "office"), "an office scheme in the office space");
  const tsp = must(t.spaces, "spaces");
  assert.ok(kinds("institution").some((x) => spaceNamed(tsp, x.space)), "an institution scheme in a space of its own");
  for (const sp of BODY_OFFICE) {
    assert.notEqual(spaceOf(t.spaces, sp).label, spaceOf(f.spaces, sp).label, sp);
    for (const form of spaceOf(t.spaces, sp).forms) assert.ok(!spaceOf(f.spaces, sp).forms.some((x) => x.form === form.form || x.pattern.re === form.pattern.re), sp);
  }
  const fs = new Set(must(f.identifier_schemes, "identifier_schemes").map((x) => x.scheme));
  for (const x of must(t.identifier_schemes, "identifier_schemes")) assert.ok(!fs.has(x.scheme), x.scheme);
  assert.ok(validate(t).ok);
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
  for (const key of KEYS) for (const e of must(tvoc[key], key)) assert.equal(e.basis, "TEST", key);
  /* the two held profiles combine with no conflict in what T34 adds */
  const both = combinedOf(combine([FIRST, TEST]));
  assert.ok(!both.conflicts.some((x) => /vocabulary\.|counterparties\[|identifier_schemes/.test(x.at)), both.conflicts.map((x) => x.at).join());
  const bv = must(both.view.vocabulary, "vocabulary");
  assert.ok(own(bv, "vote_values") && must(bv.vote_values, "vote_values").every((e) => e.profile === TEST));
});
