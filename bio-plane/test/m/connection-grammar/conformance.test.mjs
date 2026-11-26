/* connection-grammar at its interface: the owner-conformance battery (R9). A conforming owner passes; an owner breaking
   each rule the battery names fails with that check named; an owner that declares its kinds undated or group-wide has
   those checks answered inapplicable, never failed, and the declaration itself checked. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerConformance } from "../../../src/connection-grammar/index.mjs";
import { KINDS, makeNeighbours, fixture } from "./fixtures/owner.mjs";

/**
 * The battery over the sample owner breaking the rule named, with the fixture and kinds given.
 * @param {string} [broken]
 * @param {unknown} [fx]
 * @param {unknown} [kinds]
 */
const run = (broken, fx = fixture(), kinds = KINDS) => ownerConformance({ owner: "sample", kinds, neighbours: makeNeighbours(broken), fixture: fx });
/**
 * The battery over an owner held as `mode` says, declaring `declares`.
 * @param {{undated?: boolean, groupWide?: boolean}} mode
 * @param {unknown} declares
 * @param {string} [broken]
 * @param {unknown} [fx]
 */
const declared = (mode, declares, broken, fx = fixture(mode)) =>
  ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(broken, mode), fixture: fx, declares });
/**
 * The checks a battery's answer failed.
 * @param {{failures: {check: string, why: string}[]}} res
 * @returns {Set<string>}
 */
const checks = (res) => new Set(res.failures.map((f) => f.check));

test("R9 a conforming owner passes the whole battery", () => {
  assert.deepEqual(run(), { ok: true, failures: [] }, "without a declaration nothing is inapplicable, and no inapplicable key is stated");
});

test("R9 each rule broken is caught and named", () => {
  /** @type {[string, string][]} */
  const want = [
    ["shape", "foreign"], ["kinds", "kinds"], ["at", "out"], ["sight", "sight"], ["scope", "scope"], ["paging", "paging"], ["fanout", "fanout"],
    ["hub", "hub"], ["derived_id", "derived"], ["label", "label"], ["determinism", "nondeterministic"], ["node", "nodeless"], ["answer", "async"],
  ];
  for (const [check, broken] of want) {
    const res = run(broken);
    assert.equal(res.ok, false, broken);
    assert.ok(checks(res).has(check), `${broken} → ${check}: ${JSON.stringify(res.failures.slice(0, 3))}`);
    assert.ok(res.failures.every((f) => typeof f.why === "string" && f.why.length));
  }
  for (const broken of ["unmarked", "partialhub", "viewer", "throws"]) assert.equal(run(broken).ok, false, broken);
});

test("R9 the battery checks the at rule's three connections, the missing viewer, and the hunch fixture", () => {
  const fx = fixture();
  assert.ok(checks(run(undefined, { ...fx, in: "c-out" })).has("at"));
  assert.ok(checks(run(undefined, { ...fx, out: "c-in" })).has("at"));
  assert.ok(checks(run(undefined, { ...fx, undetermined: "c-in" })).has("at"));
  assert.ok(checks(run("viewer")).has("sight"));
  const { hunch, ...noHunch } = fx;
  assert.ok(checks(run(undefined, noHunch)).has("scope"), "an owner of hunch kinds names its hunch");
  assert.ok(checks(run(undefined, { ...fx, expected: fx.expected.slice(1) })).has("paging"));
  assert.ok(checks(run(undefined, { ...fx, fenced: "c-in" })).has("sight"));
  assert.ok(checks(run(undefined, { ...fx, hub: { node: fx.node } })).has("hub"));
});

test("R9 a bad registration or fixture is a failure, never a throw", () => {
  assert.ok(checks(run(undefined, fixture(), [{ kind: "k", word: "a network", class: "evidentiary" }])).has("registration"));
  assert.ok(checks(ownerConformance({ owner: "sample", kinds: KINDS, neighbours: undefined, fixture: fixture() })).has("registration"));
  assert.ok(checks(run(undefined, null)).has("fixture"));
  assert.ok(checks(ownerConformance(undefined)).has("registration"));
});

test("R9 an owner declaring its kinds undated: the at check is inapplicable, never failed, ok when nothing else fails; without the declaration it fails", () => {
  const mode = { undated: true };
  assert.ok(checks(declared(mode, undefined)).has("at"), "undeclared, an undated owner fails the at check");
  assert.deepEqual([...checks(declared(mode, undefined))], ["at"], "and nothing else");
  const r = declared(mode, { undated: true });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
  assert.deepEqual(r.failures, []);
  const inapplicable = r.inapplicable ?? [];
  assert.deepEqual(inapplicable.map((i) => i.check), ["at"]);
  assert.ok(inapplicable.every((i) => typeof i.why === "string" && i.why.length > 10));
  // Every other check still runs: each rule broken is still caught.
  /** @type {[string, string][]} */
  const rules = [["shape", "foreign"], ["sight", "sight"], ["scope", "scope"], ["paging", "paging"], ["label", "label"],
    ["derived_id", "derived"], ["determinism", "nondeterministic"], ["hub", "hub"], ["sight", "viewer"], ["at", "unmarked"]];
  for (const [check, broken] of rules) {
    const b = declared(mode, { undated: true }, broken);
    assert.equal(b.ok, false, broken);
    assert.ok(checks(b).has(check), `${broken} → ${check}: ${JSON.stringify(b.failures.slice(0, 2))}`);
  }
  // The declaration cannot hide a dated item: a dated owner declaring itself undated fails.
  const dated = ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(), fixture: fixture(), declares: { undated: true } });
  assert.equal(dated.ok, false);
  assert.ok(checks(dated).has("declares"), JSON.stringify(dated.failures));
});

test("R9 an owner declaring itself group-wide: the fenced arms of sight are inapplicable, the missing viewer still refused and checked", () => {
  const mode = { groupWide: true };
  assert.ok(checks(declared(mode, undefined)).has("sight"), "undeclared, a group-wide owner fails the sight check");
  const r = declared(mode, { group_wide: true });
  const first = (r.inapplicable ?? [])[0];
  assert.deepEqual(r, { ok: true, failures: [], inapplicable: [first] });
  assert.equal(first?.check, "sight");
  // The missing viewer is still checked.
  const v = declared(mode, { group_wide: true }, "viewer");
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.check === "sight" && /no viewer/.test(f.why)), JSON.stringify(v.failures));
  // The declaration cannot hide a fenced item: an owner that fences one from the other viewer fails.
  const unfenced = { ...fixture() };
  delete unfenced.fenced;
  const fenced = declared({}, { group_wide: true }, undefined, unfenced);
  assert.equal(fenced.ok, false);
  assert.ok(checks(fenced).has("declares"), JSON.stringify(fenced.failures));
  // Both declared together, and every other check still runs.
  const both = declared({ undated: true, groupWide: true }, { undated: true, group_wide: true });
  assert.equal(both.ok, true, JSON.stringify(both.failures));
  assert.deepEqual((both.inapplicable ?? []).map((i) => i.check), ["at", "sight"]);
  assert.ok(checks(declared({ undated: true, groupWide: true }, { undated: true, group_wide: true }, "scope")).has("scope"));
  // A false declaration declares nothing.
  assert.equal(Object.hasOwn(run(undefined, fixture()), "inapplicable"), false);
  assert.deepEqual(ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(), fixture: fixture(), declares: { undated: false, group_wide: false } }),
    { ok: true, failures: [] });
});

test("R9 a malformed declaration is a failure naming why, never a throw", () => {
  for (const declares of [null, "undated", ["undated"], { dateless: true }, { undated: "yes" }]) {
    const r = ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(), fixture: fixture(), declares });
    assert.equal(r.ok, false, JSON.stringify(declares));
    assert.deepEqual([...checks(r)], ["declares"]);
    assert.ok((r.failures[0]?.why ?? "").length > 10);
    assert.equal(Object.hasOwn(r, "inapplicable"), false);
  }
});
