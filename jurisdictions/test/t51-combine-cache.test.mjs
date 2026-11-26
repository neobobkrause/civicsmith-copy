/* jurisdictions, T51 fix round 10 (K5288): `combine` of held profiles is answered from a cache, so one request that
 * asks for the same view many times canonicalises once. Tested at the interface: list, get, combine. The counted
 * control watches JSON.stringify, which the merge calls for every value it canonicalises. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { list, get, combine } from "../index.mjs";
import { listOr } from "../shared.mjs";
import { must, at, combinedOf, refusalOf } from "./helpers.mjs";
/** @import { Value } from "../shared.mjs" */

const IDS = list().map((p) => p.id);
const LISTS = [[IDS[0]], [IDS[1]], [IDS[0], IDS[1]], [IDS[1], IDS[0]], [IDS[0], IDS[0]]];

/** Run f with JSON.stringify counted; returns [result, calls].
 *  @template T
 *  @param {() => T} f
 *  @returns {[T, number]} */
function counted(f) {
  const real = JSON.stringify;
  let n = 0;
  /** JSON.stringify, counted: every argument handed on to the real one.
   *  @param {Value} value
   *  @param {((this: Value, key: string, value: Value) => Value) | (string | number)[] | null} [replacer]
   *  @param {string | number} [space]
   *  @returns {string} */
  const spy = (value, replacer, space) => {
    n += 1;
    return typeof replacer === "function" ? real(value, replacer, space) : real(value, replacer, space);
  };
  JSON.stringify = spy;
  try { return [f(), n]; } finally { JSON.stringify = real; }
}

test("R18 combine of held ids, asked twice, canonicalises once (counted control)", () => {
  /* a list no earlier test in this file has combined: a profile id twice is combined once, but is its own key */
  const ids = [IDS[1], IDS[1], IDS[0]];
  const [first, n1] = counted(() => combine(ids));
  const [second, n2] = counted(() => combine(ids));
  assert.equal(first.ok, true);
  assert.ok(n1 > 1000, `control: the first answer canonicalises (${n1} calls)`);
  assert.equal(n2, 0, `the same inputs again canonicalise nothing (${n2} calls)`);
  assert.deepEqual(second, first);
});

test("R18 the cached answer is deep-equal to the uncached one over the held profiles", () => {
  for (const ids of LISTS) {
    /* profile objects are never cached: this is today's merge */
    const uncached = combine(ids.map((id) => get(id)));
    const a = combine(ids);
    const b = combine(ids);
    assert.deepEqual(a, uncached, ids.join("+"));
    assert.deepEqual(b, uncached, ids.join("+"));
  }
});

test("R18 every answer is the caller's own copy: changing one changes no later answer, and no two share an object", () => {
  const ids = [IDS[0]];
  const pristine = combine(get(IDS[0]) ? [get(IDS[0])] : ids);
  const a = combinedOf(combine(ids));
  const b = combinedOf(combine(ids));
  assert.notEqual(a, b);
  assert.notEqual(a.view, b.view);
  assert.notEqual(a.conflicts, b.conflicts);
  a.view.name = "changed";
  must(a.view.fiscal_year, "fiscal_year").splice(0);
  a.view.profiles.push("x");
  listOr(a.conflicts).push({ at: "x" });
  delete a.view.deadlines;
  const c = combine(ids);
  assert.deepEqual(c, pristine);
  assert.deepEqual(b, pristine);
});

test("R12 R18 a refusal is never cached stale: an unknown id still gives UNKNOWN_PROFILE, and a held one still answers after it", () => {
  const result = combine(["no-such-profile"]);
  assert.equal(result.ok, false);
  const bad = refusalOf(result);
  assert.equal(must(bad.errors[0], "an error").code, "UNKNOWN_PROFILE");
  at(bad, "errors[0]").code = "changed";
  assert.equal(must(refusalOf(combine(["no-such-profile"])).errors[0], "an error").code, "UNKNOWN_PROFILE");
  assert.equal(must(refusalOf(combine([IDS[0], "no-such-profile"])).errors[0], "an error").at, 1);
  assert.equal(combine([IDS[0]]).ok, true);
  assert.equal(must(refusalOf(combine(null)).errors[0], "an error").code, "NOT_A_LIST");
});
