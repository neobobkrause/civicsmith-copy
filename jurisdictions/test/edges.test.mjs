/* jurisdictions: validate and combine at the edges of what a caller may hand them. A space named like a member every
 * object has, a symbol or a look-alike where a name belongs, a list with a gap, a separator inside a value, a thrown
 * value that cannot be read, and a level withheld beside the sector it implies. Tested at the interface: validate,
 * combine, get. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine } from "../index.mjs";
import { listOr, isList, isObj } from "../shared.mjs";
import { held, loose, at, put, viewOf, refusalOf, must } from "./helpers.mjs";
/** @import { Value, Fields } from "../shared.mjs" */

const TEST_ID = "test-port-ellery";
const FIRST_ID = "oakland-alameda";

/** The codes `validate` gave at one path.
 *  @param {{ readonly errors: readonly { readonly path: string, readonly code: string }[] }} r
 *  @param {string} path
 *  @returns {string[]} */
const codesAt = (r, path) => r.errors.filter((e) => e.path === path).map((e) => e.code);

/** A loose copy of the test profile under another id, so two of them combine as two profiles.
 *  @param {string} id
 *  @returns {Fields} */
function twin(id) {
  const p = loose(held(TEST_ID));
  p.id = id;
  return p;
}

/** Appends `e` to the list section `sec` of a loose profile; the index it went in at.
 *  @param {Fields} p
 *  @param {string} sec
 *  @param {Value} e
 *  @returns {number} */
function append(p, sec, e) {
  const n = listOr(p[sec]).length;
  put(p, `${sec}[${n}]`, e);
  return n;
}

/** The test profile with one more deadline that a third party's act starts, its starter as given; the deadline's index.
 *  @param {(role: string, body: string) => Value} starter
 *  @returns {{ p: Fields, n: number }} */
function withStarter(starter) {
  const p = loose(held(TEST_ID));
  const office = at(p, "counterparties[0]");
  const d = loose(at(p, "deadlines[0]"));
  d.rule = "third_party_answer";
  d.starts = "third_party";
  d.starter = starter(String(office.role), String(office.body));
  return { p, n: append(p, "deadlines", d) };
}

test("R10 R11 R52 a crosswalk or identifier scheme naming a space like a member every object has is refused by name, never unreadable", () => {
  for (const space of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    const p = loose(held(TEST_ID));
    at(p, "crosswalks[0]").space = space;
    at(p, "identifier_schemes[0]").space = space;
    const r = validate(p);
    assert.equal(r.ok, false, space);
    assert.deepEqual(codesAt(r, ""), [], `${space}: no NOT_A_PROFILE`);
    assert.ok(codesAt(r, "crosswalks[0].space").includes("UNKNOWN_SPACE"), space);
    assert.ok(codesAt(r, "identifier_schemes[0].space").includes("SCHEME_INVALID"), space);
  }
});

test("R10 R75 a third party's starter naming a counterparty passes; a symbol for its role or body is ANCHOR_UNKNOWN, never unreadable", () => {
  const ok = withStarter((role, body) => ({ role, body }));
  assert.deepEqual(validate(ok.p).errors, [], "control: a starter naming the profile's counterparty");
  for (const make of [(/** @type {string} */ role, /** @type {string} */ body) => ({ role: Symbol(role), body }),
    (/** @type {string} */ role, /** @type {string} */ body) => ({ role, body: Symbol(body) })]) {
    const { p, n } = withStarter(make);
    const r = validate(p);
    assert.equal(r.ok, false);
    assert.deepEqual(codesAt(r, ""), []);
    assert.deepEqual(codesAt(r, `deadlines[${n}].starter`), ["ANCHOR_UNKNOWN"]);
  }
});

test("R75 a starter whose role or body only reads as the counterparty's text (a list, a number) names no counterparty", () => {
  for (const make of [(/** @type {string} */ role, /** @type {string} */ body) => ({ role: [role], body }),
    (/** @type {string} */ role, /** @type {string} */ body) => ({ role, body: [body] })]) {
    const { p, n } = withStarter(make);
    assert.deepEqual(codesAt(validate(p), `deadlines[${n}].starter`), ["ANCHOR_UNKNOWN"]);
  }
  /* a counterparty named "7" is not named by the number 7 */
  const { p, n } = withStarter((_role, body) => ({ role: 7, body }));
  at(p, "counterparties[0]").role = "7";
  assert.deepEqual(codesAt(validate(p), `deadlines[${n}].starter`), ["ANCHOR_UNKNOWN"]);
});

test("R10 R50 R94 a symbol for a law rank's kind or level, or a forum's kind, is refused by its field, never unreadable", () => {
  /** @type {[string, string, string][]} */
  const cases = [["law_ranks[0]", "kind", "RANK_INVALID"], ["law_ranks[0]", "level", "RANK_INVALID"], ["forums[0]", "forum_kind", "VALUE_INVALID"]];
  for (const [entry, field, code] of cases) {
    const p = loose(held(TEST_ID));
    at(p, entry)[field] = Symbol(field);
    const r = validate(p);
    assert.equal(r.ok, false, `${entry}.${field}`);
    assert.deepEqual(codesAt(r, ""), [], `${entry}.${field}: no NOT_A_PROFILE`);
    assert.deepEqual(codesAt(r, `${entry}.${field}`), [code]);
  }
  /* two law ranks with one symbol each, and two forums: still refused by field, every error reported (R10) */
  const p = loose(held(TEST_ID));
  const n = append(p, "law_ranks", loose(at(p, "law_ranks[0]")));
  at(p, "law_ranks[0]").kind = Symbol("a");
  at(p, `law_ranks[${n}]`).kind = Symbol("b");
  const r = validate(p);
  assert.deepEqual(codesAt(r, "law_ranks[0].kind"), ["RANK_INVALID"]);
  assert.deepEqual(codesAt(r, `law_ranks[${n}].kind`), ["RANK_INVALID"]);
});

test("R1 R10 a list with a gap is refused at the missing entry, and combine refuses the profile rather than fill the gap", () => {
  const p = twin("edge-gaps");
  const deadlines = listOr(p.deadlines).slice();
  const hole = deadlines.length;
  deadlines[hole + 1] = deadlines[0] ?? null; /* index `hole` holds nothing */
  p.deadlines = deadlines;
  const covers = listOr(p.covers).slice();
  covers[covers.length + 1] = "Somewhere Else";
  const coverHole = covers.length - 2;
  p.covers = covers;
  const r = validate(p);
  assert.equal(r.ok, false);
  assert.deepEqual(codesAt(r, `deadlines[${hole}]`), ["VALUE_INVALID"]);
  assert.deepEqual(codesAt(r, `covers[${coverHole}]`), ["VALUE_INVALID"]);
  const refused = refusalOf(combine([p]));
  assert.equal(must(refused.errors[0], "an error").code, "INVALID_PROFILE");
  /* control: the same profile with its gaps filled validates */
  p.deadlines = deadlines.filter(() => true);
  p.covers = covers.filter(() => true);
  assert.deepEqual(validate(p).errors, []);
});

test("R12 R10 a thrown value whose words cannot be read is reported unreadable: validate and combine never throw", () => {
  const noMessage = { get message() { throw new Error("no words"); } };
  const noText = { message: "", toString() { throw new Error("no text"); } };
  for (const thrownValue of [noMessage, noText]) {
    const profile = { get id() { throw thrownValue; } };
    const v = validate(profile);
    assert.equal(v.ok, false);
    const e = must(v.errors[0], "an error");
    assert.equal(e.code, "NOT_A_PROFILE");
    assert.match(e.detail, /^unreadable: /);
    assert.equal(must(refusalOf(combine([profile])).errors[0], "an error").code, "INVALID_PROFILE");
    /* a list whose entry throws when read: combine's own catch */
    /** @type {string[]} */
    const items = [];
    Object.defineProperty(items, "0", { enumerable: true, get() { throw thrownValue; } });
    const c = must(refusalOf(combine(items)).errors[0], "an error");
    assert.equal(c.code, "INVALID_PROFILE");
    assert.match(c.detail, /^unreadable: /);
  }
});

test("R64 R66 a level the profiles disagree on is withheld, and the entry keeps the sector government both levels imply", () => {
  const src = { source: "Shared Code", kind: "statute", issuer: "Shared Legislature", cite: { re: "\\bS\\.C\\. \\d+" }, basis: "TEST" };
  const a = twin("edge-a");
  append(a, "standard_sources", { ...src, level: "state" });
  const b = twin("edge-b");
  append(b, "standard_sources", { ...src, level: "city" });
  const c = twin("edge-c");
  append(c, "standard_sources", { ...src, level: "county", sector: "government" });
  for (const pair of [[a, b], [a, c]]) {
    const r = combine(pair);
    const view = viewOf(r);
    const conflicts = r.ok ? r.conflicts.map((x) => x.at) : [];
    assert.ok(conflicts.includes("standard_sources[Shared Code/Shared Legislature].level"), conflicts.join("; "));
    assert.ok(!conflicts.includes("standard_sources[Shared Code/Shared Legislature].sector"), conflicts.join("; "));
    const entry = must(listOr(view.standard_sources).find((e) => isObj(e) && e.source === "Shared Code"), "the shared entry");
    assert.ok(isObj(entry));
    assert.equal(entry.level, undefined);
    assert.equal(entry.sector, "government");
  }
  /* control: a sector that truly differs is withheld too */
  const d = twin("edge-d");
  append(d, "standard_sources", { ...src, kind: "policy", sector: "company" });
  const r = combine([a, d]);
  const conflicts = r.ok ? r.conflicts.map((x) => x.at) : [];
  assert.ok(conflicts.includes("standard_sources[Shared Code/Shared Legislature].sector"), conflicts.join("; "));
});

test("R14 R15 R29 a key part holding the separator character never runs into the next: two offices stay two", () => {
  const office = { level: "city", elected: false, basis: "TEST" };
  const a = twin("edge-a");
  append(a, "counterparties", { ...office, role: "Clerk\u0000Office", body: "Hall", oversight: true });
  const b = twin("edge-b");
  append(b, "counterparties", { ...office, role: "Clerk", body: "Office\u0000Hall", oversight: false });
  const r = combine([a, b]);
  const view = viewOf(r);
  assert.deepEqual(r.ok ? r.conflicts.map((x) => x.at) : [], [], "no conflict: two different offices");
  const cps = listOr(view.counterparties).filter(isObj);
  assert.equal(must(cps.find((x) => x.role === "Clerk\u0000Office"), "first office").oversight, true);
  assert.equal(must(cps.find((x) => x.role === "Clerk"), "second office").oversight, false);
});

/** Each path in `v` whose member holds undefined.
 *  @param {Value} v
 *  @param {string} path
 *  @returns {string[]} */
function undefinedAt(v, path) {
  if (isList(v)) return v.flatMap((x, i) => undefinedAt(x, `${path}[${i}]`));
  if (isObj(v)) return Object.keys(v).flatMap((k) => (v[k] === undefined ? [`${path}.${k}`] : undefinedAt(v[k], `${path}.${k}`)));
  return [];
}

test("R13 R18 the first answer for a list of held ids holds no member set to undefined, and every later answer equals it", () => {
  const ids = [TEST_ID, FIRST_ID, TEST_ID];
  const first = combine(ids);
  assert.deepEqual(undefinedAt(first, ""), []);
  assert.deepEqual(combine(ids), first);
  assert.notEqual(combine(ids), first, "each answer is the caller's own copy");
});
