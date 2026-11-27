/* Writes `fixtures/docprofile-verdicts.json`: what docprofile's own copies of the seven
 * types gave on every existing fixture, BEFORE this module's regulation reader gained its
 * sections (R18). Run once, on `tranche/T33` before T33-12 deleted those copies:
 *   node doctypes/test/make-golden.mjs
 * It reads docprofile's registry as it stood; it cannot be re-run after the deletion, and
 * need not be: the file is the record of the verdicts the new readings must not change. */
import fs from "node:fs";
import * as dp from "../../docprofile/registry.mjs";
import { CASES, pairsOf } from "./golden-cases.mjs";
import { registryOf, readWith } from "./read.mjs";

/** @import { ContentType } from "../../docprofile/doctypes/index.mjs" */
/** @import { CaseContext } from "./golden-cases.mjs" */
/** @import { AlsoMatched, AlsoErred } from "./read.mjs" */

/**
 * One case's verdict as the golden file records it: the type, how sure, on what, what else it satisfies, and the
 * reading as JSON.
 * @typedef {Object} GoldenReading
 * @property {string} type
 * @property {string} confidence
 * @property {string[]} signals
 * @property {Array<AlsoMatched | AlsoErred>} also
 * @property {unknown} parsed
 */
/**
 * One case's reading as this script holds it, to assess the pairs: the type, its reading and the context.
 * @typedef {Object} HeldReading
 * @property {ContentType} type
 * @property {object} parsed
 * @property {CaseContext} ctx
 */

const reg = registryOf(dp.doctypes());
/** @type {{ [id: string]: GoldenReading }} */
const readings = {};
/** @type {{ [pair: string]: unknown }} */
const assess = {};
const parsed = new Map(/** @type {Array<[string, HeldReading]>} */ ([]));
for (const c of CASES) {
  const r = readWith(reg, c.supplied, c.ctx);
  const type = r.doctype.type;
  if (type === undefined) throw new TypeError("Cannot read properties of undefined (reading 'key')");
  readings[c.id] = { type: type.key, confidence: r.doctype.confidence, signals: r.doctype.signals,
                     also: r.doctype.also, parsed: JSON.parse(JSON.stringify(r.parsed)) };
  parsed.set(c.id, { type, parsed: r.parsed, ctx: c.ctx });
}
for (const [a, b] of pairsOf(readings)) {
  const pa = parsed.get(a);
  if (pa === undefined) throw new TypeError("Cannot read properties of undefined (reading 'type')");
  const pb = parsed.get(b);
  if (pb === undefined) throw new TypeError("Cannot read properties of undefined (reading 'parsed')");
  const t = pa.type;
  if (typeof t.assess !== "function") throw new TypeError("t.assess is not a function");
  assess[`${a}|${b}`] = JSON.parse(JSON.stringify(t.assess?.(pa.parsed, pb.parsed, pb.ctx)));
}
const out = { note: "docprofile's seven types' verdicts on every existing fixture, taken by make-golden.mjs on tranche/T33 "
               + "before T33-12 (doctypes R18). `parsed` is the reading as JSON; `assess` the events of each pair of "
               + "readings of one type under one view.", taken_at: "2026-10-05",
              readings, assess };
fs.writeFileSync(new URL("./fixtures/docprofile-verdicts.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(readings).length} readings, ${Object.keys(assess).length} pairs`);
