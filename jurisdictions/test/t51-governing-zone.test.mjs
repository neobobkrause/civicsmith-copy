/* jurisdictions, T51 fix round 10 (K5292, K5257): R98 `governingZone(profileIds, teamZone)`, the one site where the
 * team's governing time zone is computed from settings. Tested at the interface: list, get, combine, governingZone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { list, combine, governingZone } from "../index.mjs";

const IDS = list().map((p) => p.id);
/** @param {(string | undefined)[]} ids @returns {string | null} */
const zoneOf = (ids) => { const r = combine(ids); const zone = r.ok ? r.view.time_zone : undefined; return zone ? zone.value : null; };
const ONE = IDS.find((id) => zoneOf([id]) !== null);

test("R98 a valid team zone wins over the profiles' zone, and holds with no profile", () => {
  assert.ok(ONE, "control: a held profile states a zone");
  assert.notEqual(zoneOf([ONE]), "Asia/Tokyo");
  assert.equal(governingZone([ONE], "Asia/Tokyo"), "Asia/Tokyo");
  assert.equal(governingZone([], "Asia/Tokyo"), "Asia/Tokyo");
  assert.equal(governingZone(null, "UTC"), "UTC");
  assert.equal(governingZone(undefined, "America/Toronto"), "America/Toronto");
  assert.equal(governingZone(["no-such-profile"], "Europe/Paris"), "Europe/Paris");
});

test("R98 an invalid or absent team zone falls back to the combined view's zone", () => {
  const want = zoneOf([ONE]);
  for (const bad of [undefined, null, "", "Not/AZone", "Oakland", 5, {}, [], true, "america/los_angeles ", () => 1])
    assert.equal(governingZone([ONE], bad), want, String(bad));
  assert.equal(governingZone([ONE], undefined), want);
});

test("R98 no profiles, a list that does not combine, and non-list inputs answer null (or the team zone) without throwing", () => {
  const bad = [[], ["no-such-profile"], "oakland-alameda", null, undefined, 7, {}, { 0: ONE, length: 1 }, [null], [{}], [5]];
  for (const ids of bad) {
    assert.equal(governingZone(ids, undefined), null, JSON.stringify(ids));
    assert.equal(governingZone(ids, "x"), null, JSON.stringify(ids));
    assert.equal(governingZone(ids, "Asia/Tokyo"), "Asia/Tokyo", JSON.stringify(ids));
  }
  /* profiles that name different zones combine to a view with none: null, not a pick */
  if (IDS.length > 1 && combine(IDS).ok && !zoneOf(IDS)) assert.equal(governingZone(IDS, undefined), null);
});

test("R98 never throws, whatever the inputs", () => {
  const hostile = { get length() { throw new Error("x"); } };
  const toxic = { toString() { throw new Error("x"); } };
  /** @type {(string | number)[]} */
  const target = [];
  const proxy = new Proxy(target, { get() { throw new Error("x"); } });
  for (const a of [hostile, toxic, proxy, Symbol("s"), 1n, NaN]) for (const b of [hostile, toxic, Symbol("s"), 1n, NaN])
    assert.doesNotThrow(() => governingZone(a, b));
  assert.equal(governingZone.length, 2);
});
