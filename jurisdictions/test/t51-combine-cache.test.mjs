/* jurisdictions, T51 fix round 10 (K5288): `combine` of held profiles is answered from a cache, so one request that
 * asks for the same view many times canonicalises once. Tested at the interface: list, get, combine. The counted
 * control watches JSON.stringify, which the merge calls for every value it canonicalises. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { list, get, combine } from "../index.mjs";

const IDS = list().map((p) => p.id);
const LISTS = [[IDS[0]], [IDS[1]], [IDS[0], IDS[1]], [IDS[1], IDS[0]], [IDS[0], IDS[0]]];

/* Run f with JSON.stringify counted; returns [result, calls]. */
function counted(f) {
  const real = JSON.stringify;
  let n = 0;
  JSON.stringify = function (...a) { n += 1; return real.apply(this, a); };
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
  const a = combine(ids);
  const b = combine(ids);
  assert.notEqual(a, b);
  assert.notEqual(a.view, b.view);
  assert.notEqual(a.conflicts, b.conflicts);
  a.view.name = "changed";
  a.view.fiscal_year.length = 0;
  a.view.profiles.push("x");
  a.conflicts.push({ at: "x" });
  delete a.view.deadlines;
  const c = combine(ids);
  assert.deepEqual(c, pristine);
  assert.deepEqual(b, pristine);
});

test("R12 R18 a refusal is never cached stale: an unknown id still gives UNKNOWN_PROFILE, and a held one still answers after it", () => {
  const bad = combine(["no-such-profile"]);
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, "UNKNOWN_PROFILE");
  bad.errors[0].code = "changed";
  assert.equal(combine(["no-such-profile"]).errors[0].code, "UNKNOWN_PROFILE");
  assert.equal(combine([IDS[0], "no-such-profile"]).errors[0].at, 1);
  assert.equal(combine([IDS[0]]).ok, true);
  assert.equal(combine(null).errors[0].code, "NOT_A_LIST");
});
