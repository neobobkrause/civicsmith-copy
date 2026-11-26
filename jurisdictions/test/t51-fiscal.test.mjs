/* jurisdictions, T51 fix round 4 (C8; K4477): the first profile keeps a fiscal year for its city and county bodies (R49).
 * Tested at the module's interface: get, validate, combine; the view is what money and civil-time map a fiscal key from. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine } from "../index.mjs";
import { must, held, viewOf } from "./helpers.mjs";
/** @import { View } from "../index.mjs" */

const FIRST = "oakland-alameda";
const CITY = ["Finance Department", "Oakland City Council", "Office Of The City Auditor"];

test("R49 the first profile's city and county bodies keep a July 1 fiscal year named by its start, written FY2025-26", () => {
  const p = held(FIRST);
  assert.equal(validate(p).ok, true);
  const c = combine([p]);
  assert.equal(c.ok, true);
  const years = must(c.view.fiscal_year, "fiscal_year");
  for (const body of [...CITY, "Alameda County Civil Grand Jury"]) {
    const f = years.find((x) => x.body === body);
    assert.ok(f, body);
    assert.equal(f.start, "07-01");
    assert.equal(f.named_by, "start");
    /* the year starting 2025-07-01 is keyed as the label template renders it: FY2025-26, ending 2026-06-30 */
    assert.equal(f.label.replace("{start}", "2025").replace("{end2}", "26"), "FY2025-26");
  }
});

test("R49 every entry is researched with a dated basis, and a body with no sourced year (the State Controller) has no entry of its own", () => {
  const p = held(FIRST);
  for (const f of must(p.fiscal_year, "fiscal_year")) {
    assert.equal(f.status, "researched");
    assert.match(f.basis, /^2026-10-2[25] /);
  }
  const view = viewOf(combine([p]));
  assert.equal(must(view.fiscal_year, "fiscal_year").some((f) => f.body === "California State Controller's Office"), false,
    "control: no year of its own is guessed for an unsourced body");
});

/* T51 fix round 10 (SCREENS-INVESTIGATE #17 J31 (3)): money maps a period {fiscal} with no body as `*`, finding the
   body's entry first and then `*`; with none, MONEY_BAD_PERIOD for every Oakland figure. */
/** @param {View} view @param {string} body */
const yearFor = (view, body) => {
  const years = must(view.fiscal_year, "fiscal_year");
  return years.find((f) => f.body === body) || years.find((f) => f.body === "*");
};

test("R49 the first profile states the fiscal year for body * (the City's: July 1, named by its start, Charter section 800)", () => {
  const p = held(FIRST);
  assert.equal(validate(p).ok, true);
  const view = viewOf(combine([p]));
  const f = yearFor(view, "*");
  assert.ok(f, "an unnamed body resolves to a fiscal year");
  assert.equal(f.body, "*");
  assert.equal(f.start, "07-01");
  assert.equal(f.named_by, "start");
  assert.equal(f.label.replace("{start}", "2025").replace("{end2}", "26"), "FY2025-26");
  assert.equal(f.status, "researched");
  assert.match(f.basis, /^2026-10-25 oakland-charter-s800/);
  for (const body of [...CITY, "Alameda County Civil Grand Jury"]) assert.equal(must(yearFor(view, body), body).body, body, "a named body keeps its own entry first");
});

test("R49 control: a profile with no fiscal year for * resolves none for an unnamed body", () => {
  const p = structuredClone(held(FIRST));
  p.fiscal_year = must(p.fiscal_year, "fiscal_year").filter((f) => f.body !== "*");
  assert.equal(validate(p).ok, true);
  assert.equal(yearFor(viewOf(combine([p])), "*"), undefined);
});
