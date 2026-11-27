/* roster-reader through docprofile's real registry seam, as `plane` wires it: doctypes' seven types
 * first (docprofile registers none by default, its R36; K1737), then `registerRosterTypes`, both given
 * docprofile's `registerDoctype`, then a captured document read with `readText`, the entry the reading
 * pipeline calls. Its own file because the registration is process-wide. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDoctype, readText, doctypeFor, doctypes, CONFIDENCE } from "../../docprofile/registry.mjs";
import { registerDoctypes } from "../../doctypes/index.mjs";
import { registerRosterTypes } from "../index.mjs";
import { ROSTER_DOCS, FW18, FIRST } from "./fixtures.mjs";
import { isObj, isList } from "../lines.mjs";
/** @import { Fields } from "../lines.mjs" */
/** @import { Registration } from "../../docprofile/registry.mjs" */
/** @import { CapturedDoc } from "./fixtures.mjs" */

const D = ROSTER_DOCS.documents;
/** @param {string} k @returns {CapturedDoc} */
const doc = (k) => { const d = D[k]; assert.ok(d, k); return d; };
/** The entries of one list of a reading's `parsed`, as this test reads them.
 *  @param {object | null} parsed @param {string} key @returns {Fields[]} */
const listOf = (parsed, key) => { const v = isObj(parsed) ? parsed[key] : undefined; return isList(v) ? v.filter(isObj) : []; };

test("R1 R3 through docprofile's seam: both types register, and readText recognises and reads the measured documents", () => {
  registerDoctypes(registerDoctype);
  /** @type {Registration[]} */
  const results = [];
  registerRosterTypes((t) => { const r = registerDoctype(t); results.push(r); return r; });
  assert.deepEqual(results.map((r) => [r.ok, "key" in r ? r.key : undefined]), [[true, "staff_roster"], [true, "org_chart"]]);
  const keys = doctypes().map((t) => t.key);
  for (const k of ["staff_roster", "org_chart", "staff_directory", "generic"]) assert.ok(keys.includes(k), k);

  const roster = readText(doc("roster_committee").text, { view: FIRST });
  assert.ok(roster.determined === true);
  assert.equal(roster.doctype.type.key, "staff_roster");
  assert.equal(roster.doctype.confidence, CONFIDENCE.CERTAIN);
  const rows = listOf(roster.parsed, "rows");
  assert.ok(rows.some((r) => r.name === "Zac Unger" && r.title === "Chair" && r.unit === "Public Works"));
  for (const r of rows) { const src = r.source; assert.equal(isObj(src) ? src.kind : undefined, "pdf-page"); }

  const chart = readText(doc("chart_opd").text, { view: FIRST });
  assert.ok(chart.determined === true);
  assert.equal(chart.doctype.type.key, "org_chart");
  assert.ok(listOf(chart.parsed, "units").length > 0);

  /* The substance documents keep their own types: registering these takes nothing from them. */
  for (const [k, d] of Object.entries(FW18.documents)) {
    const held = d.text.document;
    const t = typeof held === "string" ? doctypeFor({ text: held, view: FIRST }) : doctypeFor({ view: FIRST });
    assert.ok(!["staff_roster", "org_chart"].includes(t.type.key), k);
    assert.ok(!(t.also || []).some((x) => ["staff_roster", "org_chart"].includes(x.key)), k);
  }
});
