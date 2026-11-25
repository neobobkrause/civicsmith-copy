/* jurisdictions, T34 (T34-2): the `body` and `office` spaces (R3), the vote-value and response-status vocabularies (R58),
 * a counterparty's identifiers (R59), the MemberType map (R60), the held profiles' schemes and Oakland's measured data
 * (R61) and the test profile (R62). Tested at the module's interface: validate, combine, get. Oakland's Legistar facts are
 * checked against legistar-reader's captured rows (2026-10-05), the measurement they rest on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { get, validate, combine, SPACES, VOCABULARY } from "../index.mjs";
import { applyForm, walkFacts } from "./helpers.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
const breakT = (fn) => { const p = get(TEST); fn(p); return validate(p); };
const breakF = (fn) => { const p = get(FIRST); fn(p); return validate(p); };
const other = (fn) => { const p = get(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const cp = (p, role) => p.counterparties.find((c) => c.role === role);
const capture = (name) => JSON.parse(readFileSync(new URL(`../../legistar-reader/test/fixtures/${name}`, import.meta.url), "utf8"));
const BODIES = capture("bodies.json").body;
const OFFICE_RECORDS = [...capture("officerecords-0.json").body, ...capture("officerecords-1.json").body];
const PERSONS = capture("persons.json").body;
/* A value read in a scheme's form, as id-spaces reads it (helpers' independent R3). */
const reads = (p, scheme, value) => {
  const x = p.identifier_schemes.find((s) => s.scheme === scheme);
  const f = p.spaces[x.space].forms.find((y) => y.form === x.form);
  return applyForm(f, value);
};

/* ============================================================================================== */
/* R3: the body and office spaces.                                                                 */

test("R3 T34 spaces: body and office are known spaces, judged with R3's forms, carried in the view", () => {
  for (const sp of ["body", "office"]) {
    assert.ok(SPACES.includes(sp), sp);
    for (const id of [FIRST, TEST]) assert.ok(get(id).spaces[sp].forms.length, `${id} ${sp}`);
    assert.ok(hasError(breakT((p) => { p.spaces[sp].forms[0].pattern = { re: "(" }; }), "PATTERN_INVALID", `spaces.${sp}.forms[0].pattern`), sp);
    assert.ok(hasError(breakT((p) => { p.spaces[sp].forms[0].normal = [{ group: 3 }]; }), "NORMAL_INVALID", `spaces.${sp}.forms[0].normal[0]`), sp);
    assert.ok(hasError(breakT((p) => { p.spaces[sp].forms.push({ ...p.spaces[sp].forms[0] }); }), "DUPLICATE_FORM", `spaces.${sp}.forms[1].form`), sp);
    assert.ok(hasError(breakT((p) => { p.spaces[sp].kinds = []; }), "UNKNOWN_SECTION", `spaces.${sp}.kinds`), `${sp}: kinds are enactment's only`);
    assert.ok(hasError(breakT((p) => { delete p.spaces[sp].forms[0].basis; }), "BASIS_MISSING", `spaces.${sp}.forms[0].basis`), sp);
    assert.ok(combine([FIRST]).view.spaces[sp].forms.every((f) => f.profile === FIRST), sp);
  }
  /* a crosswalk may join two forms of one of them, as of any space */
  assert.ok(breakT((p) => {
    p.spaces.body.forms.push({ form: "harbour-body", pattern: { re: "^H(\\d)$" }, normal: ["H", { group: 1 }], basis: "TEST" });
    p.crosswalks.push({ space: "body", forms: ["minute-body", "harbour-body"], pairs: [["B-01", "H1"]], source: "1a".repeat(32), basis: "TEST" });
  }).ok);
  /* the first profile's forms read every captured BodyId and OfficeRecordId, and nothing that is not a number */
  const f = get(FIRST);
  const body = f.spaces.body.forms[0], office = f.spaces.office.forms[0];
  for (const b of BODIES) assert.equal(applyForm(body, String(b.BodyId)), String(b.BodyId));
  for (const r of OFFICE_RECORDS) assert.equal(applyForm(office, String(r.OfficeRecordId)), String(r.OfficeRecordId));
  for (const bad of ["", "B1", "1.5", "-1", "12345678"]) { assert.equal(applyForm(office, bad), null, bad); }
  for (const bad of ["", "x1", "1234567"]) assert.equal(applyForm(body, bad), null, bad);
});

/* ============================================================================================== */
/* R58: vote values and response statuses.                                                         */

test("R58 vote_values {value, label, citation, basis} and response_statuses {status, label, citation, basis}: known keys, none twice, VALUE_INVALID otherwise", () => {
  for (const [key, name] of [["vote_values", "value"], ["response_statuses", "status"]]) {
    const at = `vocabulary.${key}[0]`;
    assert.ok(VOCABULARY.includes(key), key);
    assert.ok(!hasError(validate(get(TEST)), "UNKNOWN_VOCABULARY"), key);
    for (const good of ["aye", "no_vote", "a1"]) assert.ok(breakT((p) => { p.vocabulary[key][0][name] = good; }).ok, `${key} ${good}`);
    for (const bad of ["Aye", "1st", "no vote", "", 3, null, undefined])
      assert.ok(hasError(breakT((p) => { p.vocabulary[key][0][name] = bad; }), "VALUE_INVALID", `${at}.${name}`), `${key} ${String(bad)}`);
    assert.ok(hasError(breakT((p) => { p.vocabulary[key][1][name] = p.vocabulary[key][0][name]; }), "VALUE_INVALID", `vocabulary.${key}[1].${name}`), `${key}: twice`);
    for (const f of ["label", "citation"]) for (const bad of ["", "  ", 3, undefined])
      assert.ok(hasError(breakT((p) => { p.vocabulary[key][0][f] = bad; }), "VALUE_INVALID", `${at}.${f}`), `${key} ${f} ${String(bad)}`);
    assert.ok(hasError(breakT((p) => { delete p.vocabulary[key][0].basis; }), "BASIS_MISSING", `${at}.basis`), key);
    assert.ok(hasError(breakT((p) => { p.vocabulary[key][0].pattern = { re: "x" }; }), "UNKNOWN_SECTION", `${at}.pattern`), `${key}: data, not a pattern`);
    assert.ok(hasError(breakT((p) => { p.vocabulary[key][0] = "aye"; }), "VALUE_INVALID", at), key);
    assert.ok(hasError(breakT((p) => { p.vocabulary[key] = {}; }), "VALUE_INVALID", `vocabulary.${key}`), key);
    assert.ok(hasError(breakF((p) => { p.vocabulary[key] = [{ [name]: "x", label: "X", citation: "C", basis: "TEST" }]; }), "BASIS_INVALID", `${at}.basis`), `${key}: TEST only in a test profile`);
    assert.ok(breakF((p) => { p.vocabulary[key] = [{ [name]: "x", label: "X", citation: "C", basis: "M-1" }]; }).ok, `${key} in a real profile`);
    /* unioned in combine (R14, R55): order kept, an equal entry kept once with both bases, a new one added */
    const u = combine([TEST, other((b) => {
      b.vocabulary[key][0].basis = "TEST";
      b.vocabulary[key].push({ [name]: "recused", label: "Recused", citation: "Other § 1", basis: "TEST" });
    })]);
    assert.deepEqual(u.conflicts, []);
    const v = u.view.vocabulary[key];
    assert.deepEqual(v.map((e) => e[name]), [...get(TEST).vocabulary[key].map((e) => e[name]), "recused"], key);
    assert.deepEqual(v[0].bases.map((b) => b.profile), [TEST, "test-other"], key);
    assert.equal(v.at(-1).profile, "test-other");
    /* a different label under one value is a different entry: unioned, never chosen between */
    const l = combine([TEST, other((b) => { b.vocabulary[key][0].label = "Another label"; })]);
    assert.deepEqual(l.conflicts, []);
    assert.equal(l.view.vocabulary[key].filter((e) => e[name] === get(TEST).vocabulary[key][0][name]).length, 2, key);
    /* no default: a profile that gives none supplies none, and the view has none */
    /* the first profile gives no vote values; its response statuses are Penal Code § 933.05's, for the grand jury (R85, T45) */
    if (key === "vote_values") assert.equal(combine([FIRST]).view.vocabulary[key], undefined, `${key}: the first profile gives none, so none`);
    else assert.ok(combine([FIRST]).view.vocabulary[key].every((e) => e.applies_to === "grand_jury" && /933\.05/.test(e.citation)), key);
    const none = get(TEST); delete none.vocabulary[key]; none.id = "test-none";
    assert.ok(validate(none).ok);
    assert.equal(combine([none]).view.vocabulary[key], undefined, key);
    assert.equal(combine([]).view.vocabulary, undefined);
  }
});

/* ============================================================================================== */
/* R59: a counterparty's identifiers, the organisation its body is part of, its body-variant key.  */

test("R59 a counterparty's ids {office?, body?}, within {label, kind, ids} and organisation: SCHEME_INVALID for an identifier, VALUE_INVALID otherwise", () => {
  const t = get(TEST);
  const i = t.counterparties.findIndex((c) => c.ids);
  const C = `counterparties[${i}]`;
  const c = (p) => p.counterparties[i];
  assert.ok(i >= 0 && validate(t).ok);
  /* each identifier: a scheme of the profile whose entity_kinds include what it identifies, and a non-empty id */
  for (const [field, kind] of [["office", "office"], ["body", "body"]]) {
    const at = `${C}.ids.${field}`;
    assert.ok(hasError(breakT((p) => { c(p).ids[field].scheme = "nowhere"; }), "SCHEME_INVALID", `${at}.scheme`), `${field} unknown scheme`);
    const wrongKind = kind === "office" ? "ellery_body" : "ellery_seat";
    assert.ok(hasError(breakT((p) => { c(p).ids[field].scheme = wrongKind; }), "SCHEME_INVALID", `${at}.scheme`), `${field} scheme of another kind`);
    assert.ok(hasError(breakT((p) => { c(p).ids[field].scheme = "ellery_person"; }), "SCHEME_INVALID", `${at}.scheme`), `${field} a person scheme`);
    for (const bad of ["", "  ", 1, null, undefined]) assert.ok(hasError(breakT((p) => { c(p).ids[field].id = bad; }), "SCHEME_INVALID", `${at}.id`), `${field} id ${String(bad)}`);
    for (const bad of ["B-01", null, [], 3]) assert.ok(hasError(breakT((p) => { c(p).ids[field] = bad; }), "SCHEME_INVALID", at), `${field} ${JSON.stringify(bad)}`);
    assert.ok(hasError(breakT((p) => { c(p).ids[field].valid = "2026"; }), "UNKNOWN_SECTION", `${at}.valid`));
    assert.ok(breakT((p) => { delete c(p).ids[field]; }).ok, `${field} alone is optional`);
  }
  /* a scheme naming several kinds serves each */
  assert.ok(breakT((p) => { p.identifier_schemes.find((x) => x.scheme === "ellery_body").entity_kinds = ["office", "body"]; c(p).ids.office.scheme = "ellery_body"; }).ok);
  /* the scheme is the profile's, wherever it is listed */
  assert.ok(hasError(breakT((p) => { p.identifier_schemes = p.identifier_schemes.filter((x) => x.scheme !== "ellery_seat"); }), "SCHEME_INVALID", `${C}.ids.office.scheme`));
  for (const bad of [{}, "B-01", [], null]) assert.ok(hasError(breakT((p) => { c(p).ids = bad; }), "VALUE_INVALID", `${C}.ids`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { c(p).ids.seat = { scheme: "ellery_seat", id: "SEAT-001" }; }), "UNKNOWN_SECTION", `${C}.ids.seat`));
  /* within: its label, its entity kind, and identifiers in schemes for that kind */
  const W = `${C}.within`;
  for (const bad of ["", 3, undefined]) assert.ok(hasError(breakT((p) => { c(p).within.label = bad; }), "VALUE_INVALID", `${W}.label`), String(bad));
  for (const bad of ["Institution", "", undefined, 3]) assert.ok(hasError(breakT((p) => { c(p).within.kind = bad; }), "VALUE_INVALID", `${W}.kind`), String(bad));
  assert.ok(hasError(breakT((p) => { c(p).within.kind = "body"; }), "SCHEME_INVALID", `${W}.ids[0].scheme`), "the institution scheme identifies no body");
  assert.ok(hasError(breakT((p) => { c(p).within.ids[0].scheme = "nowhere"; }), "SCHEME_INVALID", `${W}.ids[0].scheme`));
  assert.ok(hasError(breakT((p) => { c(p).within.ids[0].id = ""; }), "SCHEME_INVALID", `${W}.ids[0].id`));
  assert.ok(hasError(breakT((p) => { c(p).within.ids = { scheme: "marlow_registry", id: "MR0001" }; }), "VALUE_INVALID", `${W}.ids`));
  assert.ok(breakT((p) => { c(p).within.ids = []; }).ok, "named with no identifier held");
  for (const bad of ["City of Port Ellery", null, []]) assert.ok(hasError(breakT((p) => { c(p).within = bad; }), "VALUE_INVALID", W), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { c(p).within.sector = "government"; }), "UNKNOWN_SECTION", `${W}.sector`));
  /* organisation: a key the body-variant map names */
  for (const bad of ["Selectboard", "", 3, "1x"]) assert.ok(hasError(breakT((p) => { c(p).organisation = bad; }), "VALUE_INVALID", `${C}.organisation`), String(bad));
  assert.ok(hasError(breakT((p) => { c(p).organisation = "town_meeting"; }), "VALUE_INVALID", `${C}.organisation`), "a key no body variant names");
  assert.ok(breakT((p) => { c(p).organisation = "harbour_commission"; }).ok);
  assert.ok(breakT((p) => { delete c(p).ids; delete c(p).within; delete c(p).organisation; }).ok, "all three optional");
  /* every fault is reported */
  const all = breakT((p) => { c(p).ids.body = { scheme: "nowhere", id: "" }; c(p).organisation = "nobody"; });
  assert.deepEqual(all.errors.map((e) => [e.path, e.code]), [[`${C}.ids.body.scheme`, "SCHEME_INVALID"], [`${C}.ids.body.id`, "SCHEME_INVALID"],
    [`${C}.organisation`, "VALUE_INVALID"]]);
});

test("R59 combine: a counterparty's ids, within and organisation under one role and body are one value per key", () => {
  const t = get(TEST);
  const sb = (p) => cp(p, "Selectboard");
  /* agreement keeps each; the office is kept once, with every giver's basis */
  const same = combine([TEST, other(() => {})]);
  assert.deepEqual(same.conflicts, []);
  const s = same.view.counterparties.filter((x) => x.role === "Selectboard");
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].ids, s[0].within, s[0].organisation], [sb(t).ids, sb(t).within, sb(t).organisation]);
  assert.deepEqual(s[0].bases.map((b) => b.profile), [TEST, "test-other"]);
  /* disagreement withholds that fact only */
  const changes = {
    ids: (b) => { sb(b).ids.body.id = "B-02"; },
    within: (b) => { sb(b).within.label = "Port Ellery Borough"; },
    organisation: (b) => { sb(b).organisation = "harbour_commission"; },
  };
  for (const [f, fn] of Object.entries(changes)) {
    const c = combine([TEST, other(fn)]);
    assert.ok(c.ok, f);
    assert.deepEqual(c.conflicts.map((x) => x.at), [`counterparties[Selectboard/Port Ellery Selectboard].${f}`], f);
    const x = c.conflicts[0];
    assert.ok(x.values.length === 2 && x.values.every((v) => v.profile && v.basis && "value" in v) && /undetermined/.test(x.says), f);
    const k = c.view.counterparties.filter((y) => y.role === "Selectboard");
    assert.equal(k.length, 1, `${f}: the office is kept once`);
    assert.equal(k[0][f], undefined, `${f}: withheld, never chosen`);
    for (const g of Object.keys(changes).filter((y) => y !== f)) assert.deepEqual(k[0][g], sb(t)[g], `${f}: ${g} stands`);
  }
  /* one giver only: kept as given */
  const one = combine([TEST, other((b) => { delete sb(b).ids; delete sb(b).within; delete sb(b).organisation; })]);
  assert.deepEqual(one.conflicts, []);
  assert.deepEqual(one.view.counterparties.find((y) => y.role === "Selectboard").ids, sb(t).ids);
  /* an office without them carries none in the view */
  assert.equal(combine([TEST]).view.counterparties.find((y) => y.role === "Town Clerk").ids, undefined);
});

/* ============================================================================================== */
/* R60: the MemberType map.                                                                        */

test("R60 member_types [{member_type, capacity, organisation?, basis}]: as written, once per body and once for all, capacity elected or appointed; one value per type and body in combine", () => {
  const at = "vocabulary.member_types[0]";
  assert.ok(VOCABULARY.includes("member_types"));
  for (const capacity of ["elected", "appointed"]) assert.ok(breakT((p) => { p.vocabulary.member_types[0].capacity = capacity; }).ok, capacity);
  for (const bad of ["undetermined", "Elected", "", null, undefined])
    assert.ok(hasError(breakT((p) => { p.vocabulary.member_types[0].capacity = bad; }), "VALUE_INVALID", `${at}.capacity`), String(bad));
  for (const good of ["Member", "Vice Chair", "Ex-Officio (non-voting)"]) assert.ok(breakT((p) => { p.vocabulary.member_types[0].member_type = good; }).ok, good);
  for (const bad of ["", "  ", 3, null, undefined])
    assert.ok(hasError(breakT((p) => { p.vocabulary.member_types[0].member_type = bad; }), "VALUE_INVALID", `${at}.member_type`), String(bad));
  assert.ok(hasError(breakT((p) => { p.vocabulary.member_types[1].member_type = p.vocabulary.member_types[0].member_type; }), "VALUE_INVALID",
    "vocabulary.member_types[1].member_type"), "a type twice");
  assert.ok(hasError(breakT((p) => { p.vocabulary.member_types[0].label = "x"; }), "UNKNOWN_SECTION", `${at}.label`));
  assert.ok(hasError(breakT((p) => { delete p.vocabulary.member_types[0].basis; }), "BASIS_MISSING", `${at}.basis`));
  /* a type the profile does not list maps to no capacity: the view holds only what is given */
  const v = combine([TEST]).view.vocabulary.member_types;
  assert.deepEqual(v.map((e) => [e.member_type, e.capacity]), get(TEST).vocabulary.member_types.map((e) => [e.member_type, e.capacity]));
  assert.equal(v.find((e) => e.member_type === "Chair"), undefined);
  /* one value per type: agreement kept with both bases; disagreement withheld and reported, the other types stand */
  const same = combine([TEST, other(() => {})]);
  assert.deepEqual(same.conflicts, []);
  assert.deepEqual(same.view.vocabulary.member_types[0].bases.map((b) => b.profile), [TEST, "test-other"]);
  const c = combine([TEST, other((b) => { b.vocabulary.member_types[0].capacity = "appointed"; })]);
  const type = get(TEST).vocabulary.member_types[0].member_type;
  assert.deepEqual(c.conflicts.map((x) => x.at), [`vocabulary.member_types[${type}]`]);
  assert.deepEqual(c.conflicts[0].values.map((x) => [x.profile, x.value]), [[TEST, "elected"], ["test-other", "appointed"]]);
  assert.ok(/undetermined/.test(c.conflicts[0].says));
  assert.equal(c.view.vocabulary.member_types.find((e) => e.member_type === type), undefined, "withheld, never chosen");
  assert.equal(c.view.vocabulary.member_types.length, get(TEST).vocabulary.member_types.length - 1);
  /* (K1729) an entry may be for one body, a body-variant key; a type once per body and once for all bodies */
  const O = (p) => p.vocabulary.member_types.findIndex((e) => e.organisation);
  const oi = O(get(TEST));
  assert.ok(oi >= 0, "the test profile maps a type for one body");
  assert.ok(breakT((p) => { p.vocabulary.member_types[oi].organisation = "selectboard"; }).ok);
  for (const bad of ["Harbour Commission", "town_meeting", "", 3, null])
    assert.ok(hasError(breakT((p) => { p.vocabulary.member_types[oi].organisation = bad; }), "VALUE_INVALID", `vocabulary.member_types[${oi}].organisation`), String(bad));
  assert.ok(hasError(breakT((p) => { p.vocabulary.member_types.push({ ...p.vocabulary.member_types[oi], capacity: "appointed" }); }), "VALUE_INVALID",
    `vocabulary.member_types[${get(TEST).vocabulary.member_types.length}].member_type`), "a type twice for one body");
  const tt = get(TEST).vocabulary.member_types[oi].member_type;
  assert.ok(get(TEST).vocabulary.member_types.some((e) => e.member_type === tt && !e.organisation), "the same type for all bodies stands beside it");
  const ob = combine([TEST, other((b) => { b.vocabulary.member_types[oi].capacity = "appointed"; })]);
  assert.deepEqual(ob.conflicts.map((x) => x.at), [`vocabulary.member_types[${tt}/harbour_commission]`], "keyed by type and body");
  assert.ok(ob.view.vocabulary.member_types.some((e) => e.member_type === tt && !e.organisation), "the all-bodies entry stands");
  /* a type only one profile gives is kept */
  const add = combine([TEST, other((b) => { b.vocabulary.member_types.push({ member_type: "Alternate", capacity: "appointed", basis: "TEST" }); })]);
  assert.deepEqual(add.conflicts, []);
  assert.equal(add.view.vocabulary.member_types.at(-1).member_type, "Alternate");
});

/* ============================================================================================== */
/* R61: the held profiles' schemes and Oakland's measured data.                                    */

test("R61 the first profile's Legistar schemes: PersonId, BodyId and OfficeRecordId, each in its space and form, issued by the legislative record", () => {
  const f = get(FIRST);
  const by = Object.fromEntries(f.identifier_schemes.map((x) => [x.scheme, x]));
  for (const [scheme, kind, space] of [["legistar_person_id", "person", "person"], ["legistar_body_id", "body", "body"],
    ["legistar_office_record_id", "office", "office"]]) {
    const x = by[scheme];
    assert.ok(x, scheme);
    assert.deepEqual([x.entity_kinds, x.space, x.systems, x.basis], [[kind], space, ["oakland.legistar"], "2026-10-05 legistar-events"], scheme);
    assert.ok(f.spaces[space].forms.some((y) => y.form === x.form), scheme);
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
  const v = combine([FIRST]).view;
  assert.deepEqual(v.identifier_schemes.map((x) => x.scheme).slice(0, 3), ["legistar_person_id", "legistar_body_id", "legistar_office_record_id"]);
  assert.ok(v.spaces.body && v.spaces.office);
});

test("R61 the first profile's counterparties: Legistar BodyIds, the Auditor and Finance as Legistar names them, the Council's organisation, within the City", () => {
  const f = get(FIRST);
  const name = (id) => (BODIES.find((b) => String(b.BodyId) === id) || {}).BodyName;
  const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");
  const variant = (bodyName) => (f.vocabulary.body_variants.find((e) => rx(e).test(bodyName)) || {}).organisation;
  /* K1690: the Auditor's and Finance's entries in the form Legistar gives them, each with that body's BodyId */
  for (const [role, body, id] of [["City Auditor", "Office Of The City Auditor", "16"], ["Controller", "Finance Department", "171"]]) {
    const c = cp(f, role);
    assert.equal(c.body, body, role);
    assert.deepEqual(c.ids, { body: { scheme: "legistar_body_id", id } }, role);
    assert.equal(name(id), body, `${role}: the captured body ${id} is named as the profile names it`);
  }
  /* the Council: its own body, and the organisation its Legistar variants are mapped to */
  const council = cp(f, "City Council");
  assert.deepEqual(council.ids, { body: { scheme: "legistar_body_id", id: "1" } });
  assert.equal(council.organisation, "city_council");
  assert.equal(variant(name("1")), "city_council", "BodyId 1 is a variant of city_council");
  for (const b of BODIES.filter((x) => variant(x.BodyName) === "city_council")) assert.match(b.BodyName, /Oakland City Council/, b.BodyName);
  /* each identifier names a body the capture holds; each counterparty with one rests on that read too */
  for (const c of f.counterparties.filter((x) => x.ids)) {
    assert.ok(name(c.ids.body.id), c.role);
    assert.match(c.basis, /2026-10-05 legistar-events/, c.role);
  }
  /* the City's three offices are within the City of Oakland, named with no identifier: none is measured (R61) */
  for (const role of ["Controller", "City Council", "City Auditor"])
    assert.deepEqual(cp(f, role).within, { label: "City of Oakland", kind: "institution", ids: [] }, role);
  /* the offices no Legistar body names carry none: absent, never invented */
  for (const role of ["Civil Grand Jury", "State Controller"]) for (const k of ["ids", "within", "organisation"])
    assert.equal(cp(f, role)[k], undefined, `${role} ${k}`);
  /* the view carries them on each office */
  const v = combine([FIRST]).view;
  assert.deepEqual(v.counterparties.find((c) => c.role === "City Council").ids.body.id, "1");
});

test("R61 the first profile's member_types: Member and Chair on city_council, elected, and nothing for any other body (K1729)", () => {
  const f = get(FIRST);
  const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");
  const orgOf = (bodyName) => (f.vocabulary.body_variants.find((e) => rx(e).test(bodyName)) || {}).organisation;
  /* the captured office records' MemberTypes (2026-10-05) */
  const types = new Set(OFFICE_RECORDS.map((r) => r.OfficeRecordMemberType).filter((t) => t != null));
  assert.deepEqual([...types].sort(), ["Chair", "Member"]);
  assert.deepEqual(f.vocabulary.member_types.map((e) => [e.member_type, e.organisation, e.capacity]),
    [["Member", "city_council", "elected"], ["Chair", "city_council", "elected"]]);
  for (const e of f.vocabulary.member_types) assert.match(e.basis, /2026-10-05 legistar-events/);
  /* on the Council's bodies every holder is a councilmember, seated on the Council's own body (BodyId 1; Charter §200) */
  const council = new Set(OFFICE_RECORDS.filter((r) => r.OfficeRecordBodyId === 1).map((r) => r.OfficeRecordPersonId));
  const onCouncil = OFFICE_RECORDS.filter((r) => orgOf(r.OfficeRecordBodyName) === "city_council");
  assert.ok(onCouncil.length > 0);
  for (const r of onCouncil) {
    assert.ok(council.has(r.OfficeRecordPersonId), `${r.OfficeRecordFullName} on ${r.OfficeRecordBodyName}`);
    assert.ok(f.vocabulary.member_types.some((e) => e.member_type === r.OfficeRecordMemberType && e.organisation === "city_council"),
      `${r.OfficeRecordMemberType} on the Council maps`);
  }
  /* elsewhere the same types carry people the Council's records never list, so no entry for all bodies or any other */
  for (const t of types)
    assert.ok(OFFICE_RECORDS.some((r) => r.OfficeRecordMemberType === t && !council.has(r.OfficeRecordPersonId)), `${t} is recorded for non-councilmembers`);
  assert.ok(f.vocabulary.member_types.every((e) => e.organisation === "city_council"), "no entry for all bodies");
  assert.deepEqual(combine([FIRST]).view.vocabulary.member_types.map((e) => [e.member_type, e.organisation]),
    [["Member", "city_council"], ["Chair", "city_council"]]);
});

test("R61 N574 the test profile holds an institution scheme in the institution space; the first holds none until a registry is measured (N632, K1729)", () => {
  assert.ok(SPACES.includes("institution"));
  const t = get(TEST);
  const x = t.identifier_schemes.find((s) => s.entity_kinds.includes("institution"));
  assert.deepEqual([x.scheme, x.space], ["port_ellery_registry", "institution"]);
  assert.ok(x.form && t.spaces.institution.forms.some((f) => f.form === x.form));
  assert.equal(applyForm(t.spaces.institution.forms.find((f) => f.form === x.form), "mr 0001"), "MR0001");
  assert.ok(hasError(breakT((p) => { p.spaces.institution.forms[0].pattern = { re: "(" }; }), "PATTERN_INVALID", "spaces.institution.forms[0].pattern"));
  /* the view carries it, so entities R43 can hold an issuer's identifier in it */
  const v = combine([TEST]).view;
  assert.ok(v.spaces.institution && v.identifier_schemes.some((s) => s.scheme === "port_ellery_registry"));
  const f = get(FIRST);
  assert.equal(f.spaces.institution, undefined);
  assert.ok(!f.identifier_schemes.some((s) => s.entity_kinds.includes("institution")), "absent, never invented");
});

/* ============================================================================================== */
/* R62: the test profile.                                                                          */

test("R62 the test profile supplies R58–R61's keys and fields, unlike the first profile's", () => {
  const t = get(TEST), f = get(FIRST);
  for (const key of ["vote_values", "response_statuses", "member_types"]) {
    assert.ok(t.vocabulary[key] && t.vocabulary[key].length, key);
    assert.notDeepEqual(t.vocabulary[key], f.vocabulary[key], key);
  }
  const c = t.counterparties.find((x) => x.ids && x.within && x.organisation);
  assert.ok(c, "a counterparty carrying ids, within and organisation");
  assert.ok(c.ids.office && c.ids.body, "an office's and a body's identifier");
  assert.ok(c.within.ids.length, "within with an identifier");
  const kinds = (k) => t.identifier_schemes.filter((x) => x.entity_kinds.includes(k));
  assert.ok(kinds("body").some((x) => x.space === "body"), "a body scheme in the body space");
  assert.ok(kinds("office").some((x) => x.space === "office"), "an office scheme in the office space");
  assert.ok(kinds("institution").some((x) => t.spaces[x.space]), "an institution scheme in a space of its own");
  for (const sp of ["body", "office"]) {
    assert.notEqual(t.spaces[sp].label, f.spaces[sp].label, sp);
    for (const form of t.spaces[sp].forms) assert.ok(!f.spaces[sp].forms.some((x) => x.form === form.form || x.pattern.re === form.pattern.re), sp);
  }
  const fs = new Set(f.identifier_schemes.map((x) => x.scheme));
  for (const x of t.identifier_schemes) assert.ok(!fs.has(x.scheme), x.scheme);
  assert.ok(validate(t).ok);
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
  for (const key of ["vote_values", "response_statuses", "member_types"]) for (const e of t.vocabulary[key]) assert.equal(e.basis, "TEST", key);
  /* the two held profiles combine with no conflict in what T34 adds */
  const both = combine([FIRST, TEST]);
  assert.ok(!both.conflicts.some((x) => /vocabulary\.|counterparties\[|identifier_schemes/.test(x.at)), both.conflicts.map((x) => x.at).join());
  assert.ok(own(both.view.vocabulary, "vote_values") && both.view.vocabulary.vote_values.every((e) => e.profile === TEST));
});
