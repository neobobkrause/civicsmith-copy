/* Writes `fixtures/g48-answers.json`: `readText` over every reading of ./g48-readings.mjs (JSON-serialised, so a function
 * is not an answer), taken on the tranche tip before G48 changed `doctypeFor` and `readText`. Run once, on that tip:
 *   node docprofile/test/make-g48-answers.mjs
 * The file is the record the change must reproduce; it is not regenerated afterwards. */
import fs from "node:fs";
import { READINGS, registerCorpusTypes } from "./g48-readings.mjs";
import { readText } from "../registry.mjs";

registerCorpusTypes();
/** @type {{ note: string, taken_at: string, readings: { [id: string]: unknown } }} */
const out = { note: "readText over each reading of g48-readings.mjs, before G48 (docprofile R5, R19, R38)", taken_at: "2026-10-23", readings: {} };
for (const [id, supplied, ctx] of READINGS) out.readings[id] = JSON.parse(JSON.stringify(readText(supplied, ctx)));
fs.mkdirSync(new URL("./fixtures/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./fixtures/g48-answers.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out.readings).length} readings`);
