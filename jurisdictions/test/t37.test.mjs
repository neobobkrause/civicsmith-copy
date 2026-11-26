/* jurisdictions, T37 (T37-2): official local names, their explanations and official translations (R70; DEC-157 (6)),
 * their refusals (R71), how they combine (R72), and what the test and first profiles hold (R73). Tested at the
 * module's interface: validate, combine, get, isLocale and the exports. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine, isLocale, SECTIONS, LOCAL_NAME_KINDS } from "../index.mjs";
import { isList } from "../shared.mjs";
import { walkFacts, must, held, viewOf, combinedOf, loose, at, put } from "./helpers.mjs";
/** @import { Profile, View, Validation, LocalName, Explanation, Translation } from "../index.mjs" */
/** @import { Fields, Value } from "../shared.mjs" */

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
/** @param {Validation} r @param {string} code @param {string} [path] @returns {boolean} */
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/** @param {(p: Fields) => void} fn @returns {Validation} */
const breakT = (fn) => { const p = loose(held(TEST)); fn(p); return validate(p); };
/** @param {(p: Fields) => void} fn @returns {Fields} */
const other = (fn) => { const p = loose(held(TEST)); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
/** @param {object} o @param {string} k @returns {boolean} */
const own = (o, k) => Object.hasOwn(o, k);
/** Appends to the list at a member of a loose copy. @param {Fields} o @param {string} k @param {Value} v @returns {void} */
const append = (o, k, v) => { const l = o[k]; if (!isList(l)) throw new TypeError(`${k}: not a list`); l.push(v); };
/* A profile of nothing but local names, for combine; `test: true` so TEST is its basis. */
/** @param {string} id @param {LocalName[]} local_names @returns {Profile} */
const names = (id, local_names) => ({ id, name: `${id} (test)`, covers: [id], test: true, local_names });
/** @param {{ name?: string, explanations?: Explanation[], translations?: Translation[] }} [extra] @returns {LocalName} */
const clerk = (extra = {}) => ({ name: "Town Clerk", kind: "office", basis: "TEST", ...extra });
/** @param {string} locale @param {string} text @param {string} [source] @returns {Translation} */
const tr = (locale, text, source = "https://pub.example/x") => ({ locale, text, source, basis: "TEST" });
/** @param {string} locale @param {string} text @returns {Explanation} */
const ex = (locale, text) => ({ locale, text, basis: "TEST" });

/* ============================================================================================== */
/* R70: the section and its shape.                                                                 */

test("R70 local_names is a known section; its kinds are office, law, program, place; a well-formed entry of every field validates", () => {
  assert.ok(SECTIONS.includes("local_names"));
  assert.deepEqual([...LOCAL_NAME_KINDS], ["office", "law", "program", "place"]);
  assert.ok(Object.isFrozen(LOCAL_NAME_KINDS));
  for (const kind of LOCAL_NAME_KINDS) {
    const r = breakT((p) => { p.local_names = [{ name: "N", kind, basis: "TEST" }]; });
    assert.deepEqual(r, { ok: true, errors: [] }, kind);
  }
  /* every field, translations and explanations in several languages, a citation as a source */
  const r = breakT((p) => { p.local_names = [clerk({ explanations: [ex("en", "a"), ex("zh-Hant", "b"), ex("es-419", "c")],
    translations: [tr("es", "Secretaría", "P.E.B.L. § 2 (Spanish edition)"), tr("vi", "Thư ký")] })]; });
  assert.deepEqual(r, { ok: true, errors: [] });
  /* the section is optional, and empty lists are lists */
  assert.ok(breakT((p) => { delete p.local_names; }).ok);
  assert.ok(breakT((p) => { p.local_names = []; }).ok);
  assert.ok(breakT((p) => { p.local_names = [clerk({ explanations: [], translations: [] })]; }).ok);
});

test("R70 every entry, explanation and translation carries a basis; TEST only in a test profile; a translation rests on a measurement of its publication", () => {
  /** @type {[string, (p: Fields) => void][]} */
  const missing = [
    ["local_names[0].basis", (p) => { delete at(p, "local_names[0]").basis; }],
    ["local_names[0].explanations[1].basis", (p) => { delete at(p, "local_names[0].explanations[1]").basis; }],
    ["local_names[0].translations[0].basis", (p) => { delete at(p, "local_names[0].translations[0]").basis; }],
  ];
  for (const [path, fn] of missing) assert.ok(hasError(breakT(fn), "BASIS_MISSING", path), path);
  /* outside a test profile, TEST is refused everywhere in the section */
  const p = held(TEST); p.test = false;
  const r = validate(p);
  for (const path of ["local_names[0].basis", "local_names[0].explanations[0].basis", "local_names[0].translations[0].basis"])
    assert.ok(hasError(r, "BASIS_INVALID", path), path);
  /* a real profile: a measurement or a dated entry stands for a translation; a ruling or UNMEASURED does not */
  /** @param {string} basis @returns {Validation} */
  const real = (basis) => validate({ id: "real", name: "Real", covers: ["Real"],
    local_names: [{ name: "N", kind: "office", basis: "M-1", translations: [{ locale: "es", text: "T", source: "https://x.example", basis }] }] });
  assert.ok(real("M-200").ok); assert.ok(real("2026-10-08").ok); assert.ok(real("M-200 ES, 2026-10-08").ok);
  for (const b of ["K12", "DEC-157", "D-4", "UNMEASURED", "M-1, K12"])
    assert.ok(hasError(real(b), "BASIS_INVALID", "local_names[0].translations[0].basis"), b);
  /* a name and its explanations may rest on a ruling or be held UNMEASURED, as every fact may (R2) */
  const named = validate({ id: "real", name: "Real", covers: ["Real"],
    local_names: [{ name: "N", kind: "place", basis: "UNMEASURED", explanations: [{ locale: "en", text: "x", basis: "DEC-157" }] }] });
  assert.deepEqual(named, { ok: true, errors: [] });
});

test("R70 an unknown field in an entry, an explanation or a translation is UNKNOWN_SECTION at its path", () => {
  const r = breakT((p) => { at(p, "local_names[0]").x = 1; at(p, "local_names[0].explanations[0]").source = "s"; at(p, "local_names[0].translations[0]").y = 2; });
  for (const path of ["local_names[0].x", "local_names[0].explanations[0].source", "local_names[0].translations[0].y"])
    assert.ok(hasError(r, "UNKNOWN_SECTION", path), path);
});

/* ============================================================================================== */
/* R71: the refusals, each named by its field.                                                     */

test("R71 a kind outside R70's list is KIND_INVALID; a locale isLocale refuses is LOCALE_INVALID; an empty name or text VALUE_INVALID; a translation without source SOURCE_MISSING", () => {
  for (const kind of ["person", "Office", "", null, 3, undefined])
    assert.ok(hasError(breakT((p) => { const n = at(p, "local_names[0]"); n.kind = kind; if (kind === undefined) delete n.kind; }),
      "KIND_INVALID", "local_names[0].kind"), String(kind));
  /* LOCALE_INVALID exactly where isLocale refuses (R37's one reading) */
  for (const locale of ["es", "zh-Hant-TW", "es-419", "EN-us", "x", "en us", "en,es", "", "  ", "en_US", "123", 7, null, undefined]) {
    const r = breakT((p) => { const e = at(p, "local_names[0].explanations[0]"), t = at(p, "local_names[0].translations[0]"); e.locale = locale; t.locale = locale;
      if (locale === undefined) { delete e.locale; delete t.locale; } });
    for (const path of ["local_names[0].explanations[0].locale", "local_names[0].translations[0].locale"])
      assert.equal(hasError(r, "LOCALE_INVALID", path), !isLocale(locale), `${String(locale)} at ${path}`);
  }
  /** @type {[string, (p: Fields) => void][]} */
  const invalid = [
    ["local_names[0].name", (p) => { at(p, "local_names[0]").name = ""; }],
    ["local_names[0].name", (p) => { at(p, "local_names[0]").name = "   "; }],
    ["local_names[0].name", (p) => { delete at(p, "local_names[0]").name; }],
    ["local_names[0].name", (p) => { at(p, "local_names[0]").name = 4; }],
    ["local_names[0].explanations[0].text", (p) => { at(p, "local_names[0].explanations[0]").text = ""; }],
    ["local_names[0].explanations[0].text", (p) => { delete at(p, "local_names[0].explanations[0]").text; }],
    ["local_names[0].translations[0].text", (p) => { at(p, "local_names[0].translations[0]").text = " "; }],
    ["local_names[0].translations[0].text", (p) => { at(p, "local_names[0].translations[0]").text = ["x"]; }],
  ];
  for (const [path, fn] of invalid) assert.ok(hasError(breakT(fn), "VALUE_INVALID", path), path);
  /** @type {((t: Fields) => void)[]} */
  const unsourced = [(t) => { delete t.source; }, (t) => { t.source = ""; }, (t) => { t.source = null; }];
  for (const fn of unsourced)
    assert.ok(hasError(breakT((p) => fn(at(p, "local_names[0].translations[0]"))), "SOURCE_MISSING", "local_names[0].translations[0].source"));
  assert.ok(hasError(breakT((p) => { at(p, "local_names[0].translations[0]").source = 9; }), "VALUE_INVALID", "local_names[0].translations[0].source"));
});

test("R71 R72 malformed containers, and a name of one kind or a language under one name given twice in one profile, are VALUE_INVALID", () => {
  /** @type {[string, (p: Fields) => void][]} */
  const malformed = [
    ["local_names", (p) => { p.local_names = {}; }],
    ["local_names[0]", (p) => { put(p, "local_names[0]", "Town Clerk"); }],
    ["local_names[0].explanations", (p) => { at(p, "local_names[0]").explanations = "x"; }],
    ["local_names[0].translations[0]", (p) => { put(p, "local_names[0].translations[0]", "Secretaría"); }],
    /* one name of one kind once in a profile */
    ["local_names[4].name", (p) => { append(p, "local_names", { ...at(p, "local_names[0]") }); }],
    /* one explanation and one translation per language, by the language's canonical form */
    ["local_names[0].explanations[2].locale", (p) => { append(at(p, "local_names[0]"), "explanations", ex("ES", "otra")); }],
    ["local_names[0].translations[1].locale", (p) => { append(at(p, "local_names[0]"), "translations", tr("es", "Otra")); }],
  ];
  for (const [path, fn] of malformed) assert.ok(hasError(breakT(fn), "VALUE_INVALID", path), path);
  /* the same name as another kind is another name */
  assert.ok(breakT((p) => { append(p, "local_names", { name: "Town Clerk", kind: "place", basis: "TEST" }); }).ok);
});

test("R71 every fault is reported, each by its field", () => {
  const r = breakT((p) => { p.local_names = [{ name: "", kind: "nope", basis: "TEST",
    explanations: [{ locale: "x x", text: "", basis: "TEST" }], translations: [{ locale: "zz-", text: "T", basis: "TEST" }] }]; });
  assert.equal(r.ok, false);
  /** @type {[string, string][]} */
  const faults = [["VALUE_INVALID", "local_names[0].name"], ["KIND_INVALID", "local_names[0].kind"],
    ["LOCALE_INVALID", "local_names[0].explanations[0].locale"], ["VALUE_INVALID", "local_names[0].explanations[0].text"],
    ["LOCALE_INVALID", "local_names[0].translations[0].locale"], ["SOURCE_MISSING", "local_names[0].translations[0].source"]];
  for (const [code, path] of faults)
    assert.ok(hasError(r, code, path), `${code} ${path}`);
});

/* ============================================================================================== */
/* R72: combine.                                                                                   */

test("R72 local names are unioned in order, an equal entry kept once with every giver's basis; every fact carries profile and bases", () => {
  const a = names("a", [clerk({ explanations: [ex("es", "La oficina")], translations: [tr("es", "Secretaría")] }),
    { name: "Harbour", kind: "place", basis: "TEST" }]);
  const b = names("b", [{ name: "Fund", kind: "program", basis: "TEST" },
    clerk({ explanations: [ex("es", "La oficina"), ex("fr", "Le bureau")], translations: [tr("es", "Secretaría")] })]);
  const r = combine([a, b]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.conflicts, []);
  const v = must(r.view.local_names, "local_names");
  assert.deepEqual(v.map((n) => `${n.name}/${n.kind}`), ["Town Clerk/office", "Harbour/place", "Fund/program"]);
  const c = must(v[0], "local_names[0]");
  assert.equal(c.profile, "a");
  assert.deepEqual(c.bases, [{ profile: "a", basis: "TEST" }, { profile: "b", basis: "TEST" }]);
  const explanations = must(c.explanations, "explanations");
  assert.deepEqual(explanations.map((x) => [x.locale, x.text, x.profile]), [["es", "La oficina", "a"], ["fr", "Le bureau", "b"]]);
  assert.deepEqual(must(explanations[0], "explanations[0]").bases, [{ profile: "a", basis: "TEST" }, { profile: "b", basis: "TEST" }]);
  assert.deepEqual(c.translations, [{ locale: "es", text: "Secretaría", source: "https://pub.example/x", basis: "TEST", profile: "a",
    bases: [{ profile: "a", basis: "TEST" }, { profile: "b", basis: "TEST" }] }]);
  assert.deepEqual(must(v[2], "local_names[2]").bases, [{ profile: "b", basis: "TEST" }]);
  /* no field a giver did not give */
  const v1 = must(v[1], "local_names[1]");
  assert.ok(!own(v1, "explanations") && !own(v1, "translations"));
  /* walkFacts reaches every entry, explanation and translation; each carries profile and bases */
  let n = 0;
  walkFacts({ local_names: v }, (f, path) => { n++; assert.ok(typeof f.profile === "string" && isList(f.bases) && f.basis, path); });
  assert.equal(n, 3 + 2 + 1);
});

test("R72 under one name and kind, a translation in one language is one value per key: two profiles giving different official translations is a conflict, and neither is kept", () => {
  const a = names("a", [clerk({ translations: [tr("es", "Secretaría"), tr("vi", "Thư ký")] })]);
  const b = names("b", [clerk({ translations: [tr("es-ES", "Secretaria Municipal")] }), clerk({ name: "Other" })]);
  const c = names("c", [clerk({ translations: [tr("ES", "Oficina del Secretario")] })]);
  const r = combine([a, b, c]);
  assert.equal(r.ok, true);
  const first = must(must(r.view.local_names, "local_names")[0], "local_names[0]");
  const t = must(first.translations, "translations");
  /* es is withheld; vi, which one profile gives, is kept; es-ES is another language and stands (in the order first given) */
  assert.deepEqual(t.map((x) => x.locale), ["vi", "es-ES"]);
  assert.equal(r.conflicts.length, 1);
  const k = must(r.conflicts[0], "conflicts[0]");
  assert.equal(k.at, "local_names[Town Clerk/office].translations[es]");
  assert.deepEqual(k.values, [{ profile: "a", value: "Secretaría", basis: "TEST" }, { profile: "c", value: "Oficina del Secretario", basis: "TEST" }]);
  assert.match(k.says, /official translations/); assert.ok(k.says.length > 20);
  /* the name itself stays, unchanged, with every giver */
  assert.equal(first.name, "Town Clerk");
  assert.deepEqual(first.bases.map((x) => x.profile), ["a", "b", "c"]);
  /* combine never chooses: reversing the order still keeps neither */
  const back = viewOf(combine([c, b, a]));
  assert.ok(!must(must(must(back.local_names, "local_names")[0], "local_names[0]").translations, "translations").some((x) => x.locale.toLowerCase() === "es"));
  /* one text from two publications is one translation, its sources joined */
  const s = combinedOf(combine([names("a", [clerk({ translations: [tr("es", "Secretaría", "https://one.example")] })]),
    names("b", [clerk({ translations: [tr("es", "Secretaría", "https://two.example")] })])]));
  assert.deepEqual(s.conflicts, []);
  assert.equal(must(must(must(must(s.view.local_names, "local_names")[0], "local_names[0]").translations, "translations")[0], "translations[0]").source, "https://one.example; https://two.example");
});

test("R72 under one name and kind, an explanation in one language is one value per key; the same name as another kind is another key", () => {
  const a = names("a", [clerk({ explanations: [ex("es", "La oficina"), ex("en", "The office")] }), { name: "Town Clerk", kind: "place", basis: "TEST", explanations: [ex("es", "Un lugar")] }]);
  const b = names("b", [clerk({ explanations: [ex("es", "Otra cosa")] })]);
  const r = combinedOf(combine([a, b]));
  assert.deepEqual(r.conflicts.map((k) => k.at), ["local_names[Town Clerk/office].explanations[es]"]);
  assert.deepEqual(must(r.conflicts[0], "conflicts[0]").values.map((v) => v.value), ["La oficina", "Otra cosa"]);
  const ln = must(r.view.local_names, "local_names");
  assert.deepEqual(must(must(ln[0], "local_names[0]").explanations, "explanations").map((x) => x.locale), ["en"]);
  assert.deepEqual(must(must(ln[1], "local_names[1]").explanations, "explanations").map((x) => x.text), ["Un lugar"]);
});

test("R72 R16 R18 combine of no profile, of one, and of the held test profile: no local names from nothing; the view is the caller's own", () => {
  assert.equal(viewOf(combine([])).local_names, undefined);
  assert.equal(viewOf(combine([FIRST])).local_names, undefined);
  const r = combinedOf(combine([TEST]));
  assert.deepEqual(r.conflicts, []);
  const testNames = must(held(TEST).local_names, "local_names");
  assert.deepEqual(must(r.view.local_names, "local_names").map(({ name, kind }) => ({ name, kind })), testNames.map(({ name, kind }) => ({ name, kind })));
  /** @param {View} v @returns {Translation} */
  const firstTranslation = (v) => must(must(must(must(v.local_names, "local_names")[0], "local_names[0]").translations, "translations")[0], "translations[0]");
  firstTranslation(r.view).text = "changed";
  assert.notEqual(firstTranslation(viewOf(combine([TEST]))).text, "changed");
  /* the first and the test profile together: the test profile's names stand, with no conflict */
  const both = combinedOf(combine([FIRST, TEST]));
  assert.ok(!both.conflicts.some((k) => k.at.startsWith("local_names")));
  assert.equal(must(both.view.local_names, "local_names").length, testNames.length);
  /* a malformed section is refused before combine reads it */
  const bad = combine([other((p) => { at(p, "local_names[0]").kind = "nope"; })]);
  assert.equal(bad.ok, false); assert.equal(must(bad.errors[0], "errors[0]").code, "INVALID_PROFILE");
});

/* ============================================================================================== */
/* R73: what the profiles hold.                                                                    */

test("R73 the test profile supplies one name of each kind, an explanation in two languages, and an official translation with its source", () => {
  const p = held(TEST);
  assert.deepEqual(validate(p), { ok: true, errors: [] });
  const ln = must(p.local_names, "local_names");
  assert.deepEqual([...new Set(ln.map((n) => n.kind))].sort(), [...LOCAL_NAME_KINDS].sort());
  for (const kind of LOCAL_NAME_KINDS) assert.ok(ln.some((n) => n.kind === kind), kind);
  assert.ok(ln.some((n) => new Set((n.explanations || []).map((x) => x.locale)).size >= 2));
  const t = ln.flatMap((n) => n.translations || []);
  assert.ok(t.length >= 1 && t.every((x) => x.source && x.basis === "TEST" && isLocale(x.locale)));
  walkFacts({ local_names: ln }, (f, path) => assert.equal(f.basis, "TEST", path));
});

test("R73 the first profile holds only official translations a measurement found published: none until measured, none invented", () => {
  const p = held(FIRST);
  /* no Oakland translation is captured in the repository (T37-2's START): the section is absent, so a group's
     translation workspace finds no official form and shows each name unchanged (R27) */
  assert.equal(own(p, "local_names"), false);
  /* absent, the view offers none either: no official form is invented for any name */
  assert.equal(viewOf(combine([FIRST])).local_names, undefined);
});
