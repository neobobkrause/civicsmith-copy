/* The measurements of doctypes R40 that need a process of their own, so their memory is theirs alone. Run by
 * g140.test.mjs as
 *   node [--expose-gc --max-old-space-size=N --max-semi-space-size=2] g140-child.mjs <mode> <case>
 *   base <case>   the heap with the text of <case> held (what the caller holds): {baseMB}
 *   run <case>    the case, through the types' own `detect` and `parse`: a summary of the answer
 * Cases: dash (400,000 characters of `a-a-a-`), oneline (16,000 addresses on one line), csv (a 17 MB spreadsheet of
 * distinct addresses), cites_staff_report and cites_regulation (400,000 citations of fifty instruments). `ctx.locate`
 * answers an object for every offset, as docprofile's does. */
import { staffDirectory, staffReport, regulation } from "../index.mjs";
import { HELD } from "./fixtures.mjs";
import { addresses, csvOfAddresses, citations, repeated } from "./r40-texts.mjs";
/** @import { DoctypeContext, Entity } from "../../docprofile/doctypes/index.mjs" */
/** @import { ReadingPosition } from "../../bio-plane/src/textchain.mjs" */

const [mode, name] = process.argv.slice(2);
/** The heap in use, in MB. @returns {number} */
const mb = () => process.memoryUsage().heapUsed / 1048576;
/** Two full collections, where the process may ask for them. @returns {void} */
const settle = () => { if (global.gc) { global.gc(); global.gc(); } };
/** The length of an entry's `line` fact, as `line.length` read it: absent where it is not text (and `Math.max` then
 *  answers NaN), the `TypeError` reading it raised where there is none.
 *  @param {string | number | boolean | null | undefined} line @returns {number} @throws {TypeError} where there is no line */
const lineLength = (line) => {
  if (line === null || line === undefined) throw new TypeError(`Cannot read properties of ${line} (reading 'length')`);
  return typeof line === "string" ? line.length : NaN;
};

/** The first entry's key; the `TypeError` reading a missing one raised.
 *  @param {Entity | undefined} e @returns {string} @throws {TypeError} where it is missing */
const entityKey = (e) => {
  if (!e) throw new TypeError("Cannot read properties of undefined (reading 'key')");
  return e.key;
};

/** The cases, by name: each makes its text. @type {{ [name: string]: () => string }} */
const CASES = {
  dash: () => repeated("a-", 400_000),
  oneline: () => addresses(16_000, ", "),
  csv: () => csvOfAddresses(17_000_000),
  cites_staff_report: () => citations(400_000),
  cites_regulation: () => citations(400_000),
};
const make = CASES[String(name)];
if (!make) throw new Error(`case: ${name}`);
const text = make.call(CASES);
text.indexOf("\u0000");   // a joined string is one flat string before anything is measured
settle();

if (mode === "base") {
  console.log(JSON.stringify({ baseMB: mb(), chars: text.length }));
} else if (mode === "run") {
  /** A page position for every offset that is a number, a page per 4,096 characters, as a PDF's locator answers.
   *  @param {unknown} o @returns {ReadingPosition | null} */
  const locate = (o) => (typeof o === "number" ? { kind: "pdf-page", ref: "test", page: 1 + (o >> 12), rect: null } : null);
  /** The context the types are handed, with `extra` over it. @param {DoctypeContext} extra @returns {DoctypeContext} */
  const ctx = (extra) => ({ view: HELD, text, locate, alsoSatisfies: () => [], ...extra });
  if (name === "dash" || name === "oneline" || name === "csv") {
    const dir = staffDirectory;
    const work = { chars: 0, limit: Infinity };
    const t0 = Date.now();
    const d = dir.detect(ctx({ work }));
    const detectMs = Date.now() - t0;
    const parsed = dir.parse(ctx({ work: { chars: 0, limit: Infinity } }));
    const longest = parsed.entities.reduce((n, e) => Math.max(n, lineLength(e.facts.line)), 0);
    console.log(JSON.stringify({ chars: text.length, match: d.match, detectMs, work: work.chars, entities: parsed.entities.length, entries: parsed.entries,
                                 cut: parsed.entries_cut === true, limit: parsed.entries_limit || null, readTo: parsed.read_to || null,
                                 longestLine: longest, lineCut: parsed.entities.filter((e) => e.facts.line_cut).length, why: parsed.entries_why || null,
                                 first: parsed.entities.length ? entityKey(parsed.entities[0]) : null }));
  } else {
    const reader = name === "cites_staff_report" ? staffReport : regulation;
    const work = { chars: 0, limit: Infinity };
    const parsed = reader.parse(ctx({ work }));
    const first = parsed.entities[0];
    if (!first) throw new TypeError("Cannot read properties of undefined (reading 'occurrences')");
    const occurrences = first.occurrences;
    console.log(JSON.stringify({ chars: text.length, entities: parsed.entities.length, cut: parsed.references_cut === true, skipped: parsed.references_skipped || 0,
                                 limit: parsed.references_limit || null, sightingsLimit: parsed.sightings_limit || null, work: work.chars,
                                 occurrences: occurrences ? occurrences.length : 0 }));
  }
}
