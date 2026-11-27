/* Writes `fixtures/r37-answers.json`: the answers of the eight types on every fixture reading, as they stood on the
 * tranche tip before R37 bounded their work (doctypes R37). Run once, on that tip:
 *   node doctypes/test/make-r37-answers.mjs
 * The file is the record the bounded types must reproduce; it is not regenerated afterwards. */
import fs from "node:fs";
import { fixtureReadings, answerOf } from "./r37-readings.mjs";
/** @import { ReadingAnswer } from "./r37-readings.mjs" */

/** @type {{ note: string, taken_at: string, readings: { [id: string]: ReadingAnswer } }} */
const out = { note: "each type's detect, and the registry's verdict with the winner's parse, as digests, before R37 (doctypes R37)",
              taken_at: "2026-10-22", readings: {} };
for (const r of fixtureReadings()) out.readings[r.id] = answerOf(r);
fs.writeFileSync(new URL("./fixtures/r37-answers.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out.readings).length} readings`);
