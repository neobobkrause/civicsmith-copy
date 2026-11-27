/* The existing fixtures every type was tested on in docprofile, each read under every view
 * that decides something (R18): the real documents (FW-18, FW-20) under the held profiles'
 * view, and the made-up Port Alder and Lakemont documents under their own, each other's and
 * the empty view. `now` is fixed, so the calendar's forward-looking reading is repeatable. */
import fs from "node:fs";
import { PORT_ALDER, LAKEMONT, view, EMPTY, HELD, PA_AGENDA, PA_MINUTES, PA_REPORT, PA_BYLAW, PA_DIRECTORY,
         calendarHtml } from "./fixtures.mjs";

/** @import { View } from "../../jurisdictions/index.mjs" */
/** @import { DoctypeContext } from "../../docprofile/doctypes/index.mjs" */

/**
 * What a case is read with (a reader's context): the view, the fixed `now`, and, for the made-up documents, the
 * address they came from.
 * @typedef {DoctypeContext & { readonly view: View, readonly now: string }} CaseContext
 */
/**
 * One golden case: its id (`<set>:<document>@<view>`), the name of the view it is read under, the text supplied, and
 * the context it is read with.
 * @typedef {Object} GoldenCase
 * @property {string} id
 * @property {string} view
 * @property {string} supplied
 * @property {CaseContext} ctx
 */
/**
 * A fixture document of FW-18 or FW-20, as its file holds it: its text.
 * @typedef {Object} FixtureDocument
 * @property {string} text
 */
/**
 * A fixture file of this module: its documents by name.
 * @typedef {Object} FixtureFile
 * @property {{ [name: string]: FixtureDocument }} documents
 */
/**
 * A reading as `pairsOf` reads it: the key of the type that read it.
 * @typedef {{ readonly type: string }} TypedReading
 */

/** This module's own fixture files, decoded (R2: the module's own channel). @returns {FixtureFile} */
const fw18 = () => /** @type {FixtureFile} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/fw18-doctypes.json", import.meta.url), "utf8")));
/** @returns {FixtureFile} */
const fw20 = () => /** @type {FixtureFile} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/fw20-staff-directory.json", import.meta.url), "utf8")));
const FW18 = fw18().documents;
const FW20 = fw20().documents;
const NOW = "2026-03-20T12:00:00Z";
/** @type {ReadonlyArray<readonly [string, View]>} */
const VIEWS = [["held", HELD], ["pa", view(PORT_ALDER)], ["lk", view(LAKEMONT)], ["empty", EMPTY]];

/** Every case, in the order the golden file was taken in.
 *  @type {GoldenCase[]} */
export const CASES = [];
for (const [k, d] of Object.entries(FW18)) CASES.push({ id: `fw18:${k}@held`, view: "held", supplied: d.text, ctx: { view: HELD, now: NOW } });
for (const [k, d] of Object.entries(FW20)) CASES.push({ id: `fw20:${k}@held`, view: "held", supplied: d.text, ctx: { view: HELD, now: NOW } });
/** @type {ReadonlyArray<readonly [string, string]>} */
const MADE = [["agenda", PA_AGENDA], ["minutes", PA_MINUTES], ["report", PA_REPORT], ["bylaw", PA_BYLAW], ["directory", PA_DIRECTORY],
  ["calendar", calendarHtml([["1", "Harbor Commission", "3/2/2026", null, "11"], ["2", "Select Board", "3/4/2026", null, "21", "22"],
                             ["3", "Harbor Commission", "4/2/2026"]])],
  ["calendar_cancelled", calendarHtml([["1", "Harbor Commission", "3/2/2026", "CANCELLED", "11"], ["2", "Select Board", "3/4/2026", null, "21", "22"]])]];
for (const [v, vw] of VIEWS) {
  if (v === "held") continue;
  for (const [k, t] of MADE)
    CASES.push({ id: `pa:${k}@${v}`, view: v, supplied: t, ctx: { view: vw, now: NOW, locator: "https://r.test/Calendar.aspx" } });
}

/** Every ordered pair of readings of one type under one view, each with itself too.
 *  @param {{ readonly [id: string]: TypedReading | undefined }} readings every case's reading, by the case's id
 *  @returns {Array<[string, string]>}
 *  @throws {TypeError} when a case of the same view has no reading, as reading its type would */
export function pairsOf(readings) {
  const byCase = new Map(CASES.map((c) => [c.id, c]));
  /** @type {Array<[string, string]>} */
  const out = [];
  for (const a of CASES) for (const b of CASES) {
    if (a.view !== b.view) continue;
    const ra = readings[a.id];
    if (ra === undefined) throw new TypeError("Cannot read properties of undefined (reading 'type')");
    const rb = readings[b.id];
    if (rb === undefined) throw new TypeError("Cannot read properties of undefined (reading 'type')");
    if (ra.type !== rb.type) continue;
    if (!byCase.has(a.id) || !byCase.has(b.id)) continue;
    out.push([a.id, b.id]);
  }
  return out;
}
