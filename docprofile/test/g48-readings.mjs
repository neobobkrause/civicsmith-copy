/* The readings G48's control pins (fix round 6, G48): every fixture text of this suite read through `readText`, with the
 * stub types registered the way a composer would (the readers, a few probes of every confidence and a throwing one, then
 * the fallback). `make-g48-answers.mjs` records their answers on the tranche tip BEFORE the change; `g48-sheet-view.test.mjs`
 * reads them again and compares. */
import { view, PORT_ALDER, LAKEMONT, EMPTY, PA_ITEMS, PA_ITEMS_PAGES, calendarHtml, shellHtml } from "./fixtures.mjs";
import { stubMeetings, stubItems, stubFallback } from "./stubs.mjs";
import * as dp from "../registry.mjs";

/** @import { ContentType, DoctypeContext, Detection, Registration, SuppliedText, SuppliedPage, SuppliedSheet } from "../registry.mjs" */
/**
 * One reading of the corpus: its id, what is supplied to `readText` (a number once, on purpose, outside the stated domain:
 * not text), and the context.
 * @typedef {[string, SuppliedText | string | number, DoctypeContext]} Reading
 */

const { CONFIDENCE, CONTRACT } = dp;
const PA = view(PORT_ALDER), LK = view(LAKEMONT);
/** @param {string} key @param {string} marker @param {string} confidence
 *  @param {{ detect: (ctx: DoctypeContext) => Detection }} [extra] @returns {ContentType} */
const probe = (key, marker, confidence, extra) => ({
  key, label: `g48 ${key}`, version: 1, contract: CONTRACT.SUBSTANCE,
  detect: (ctx) => (String(ctx.text || "").includes(marker) ? { match: true, confidence, signals: [marker] } : { match: false }),
  parse: () => ({ entities: [], facts: { read_by: key } }),
  ...(extra || {}),
});

/** The probes this suite registers after the stub readers and before the fallback, in this order. */
/** @type {ContentType[]} */
export const PROBES = [
  probe("g48_marker_a", "MARKER-A", CONFIDENCE.CERTAIN),
  probe("g48_marker_b", "MARKER-B", CONFIDENCE.CERTAIN),
  probe("g48_maybe", "MAYBE", CONFIDENCE.LIKELY),
  probe("g48_throws", "BOOM", CONFIDENCE.CERTAIN, { detect: (ctx) => { if (String(ctx.text || "").includes("BOOM")) throw new Error("g48 boom"); return { match: false }; } }),
];

/** Register the readers, the probes, then the fallback, through the seam `register`. */
/** @param {(type: ContentType) => Registration} [register] */
export function registerCorpusTypes(register = dp.registerDoctype) {
  for (const t of [stubMeetings, stubItems, ...PROBES, stubFallback]) if (!register(t).ok) throw new Error(`${t.key} was refused`);
}

const calendar = calendarHtml([[1, "Harbor Commission", "3/3/2026", "", 11, 21], [2, "Select Board", "3/10/2026", "CANCELLED", 12, null]]);
/** @type {SuppliedPage[]} */
const PAGES = [
  { page: 0, text: "MEMO TO THE BOARD\nHarbor Commission\nTuesday, March 3, 2026" },
  { page: 1, text: "MEMO TO THE BOARD\nSubject:\nDock Fee Schedule\nFrom:\nHarbor Master\n3.1\nPA-910" },
  { page: 2, text: "MEMO TO THE BOARD\nPage 3\n2\nPA-844" },
];
const sheetText = /** @param {number} rows */ (rows) => Array.from({ length: rows }, (_, i) => `row ${i}\tvalue ${i * 7}\tPA-${100 + (i % 50)}`).join("\n");
const small = sheetText(200);
/** @type {SuppliedSheet[]} */
const book = [{ name: "One", text: sheetText(30) }, { name: "Two", text: "" }, { name: "Three", text: `ITEMS\n${sheetText(10)}` }];

/** [id, supplied, ctx] */
/** @type {Reading[]} */
export const READINGS = [
  ["calendar", calendar, { view: PA, at: "2026-03-03T00:00:00Z" }],
  ["calendar-empty-view", calendar, { view: EMPTY }],
  ["calendar-lakemont", calendar, { view: LK }],
  ["shell", shellHtml(), { view: PA }],
  ["pa-items-bare", PA_ITEMS, { view: PA }],
  ["pa-items-document-pages", { document: PA_ITEMS, pages: PA_ITEMS_PAGES }, { view: PA, at: "2026-03-03T00:00:00Z" }],
  ["pa-items-pages", { pages: PA_ITEMS_PAGES }, { view: PA }],
  ["pa-items-partial", { document: PA_ITEMS, counts: { undetermined: 3 } }, { view: PA }],
  ["pa-items-lakemont-view", PA_ITEMS, { view: LK }],
  ["position-pages", { pages: PAGES }, { view: PA }],
  ["position-document-off", { document: PAGES.map((p) => p.text).join("\n") + "\nAN EXTRA LINE", pages: PAGES }, { view: PA }],
  ["position-crlf", { pages: PAGES.map((p) => ({ ...p, text: String(p.text).replace(/\n/g, "\r\n") })) }, { view: PA }],
  ["position-blank-page", { pages: [{ page: 0, text: "ITEMS first" }, { page: 1, text: "" }, { page: 2, text: "PA-101 third" }] }, { view: PA }],
  ["paragraphs", { paragraphs: [{ para: 0, ref: "¶1", text: "ITEMS The agreement" }, { para: 141, ref: "¶142", text: "PA-101 applies" }] }, { view: PA }],
  ["plain", "plain words", {}],
  ["seam-marker-a", "MARKER-A plain", {}],
  ["seam-marker-b-first", "MARKER-B MARKER-A", {}],
  ["seam-maybe", "just MAYBE here", {}],
  ["seam-maybe-then-certain", "MAYBE and MARKER-B", {}],
  ["seam-two-classes", `${calendar}\nITEMS\nPA-101`, { view: PA }],
  ["seam-throws-after-winner", "MARKER-A and BOOM", {}],
  ["seam-throws-before-nothing", "a letter about nothing", {}],
  ["structure", { document: "MARKER-B page one", pages: [{ page: 0, text: "MARKER-B page one", undetermined: [] }, { page: 1, text: "", undetermined: [{ reason: "no_text_layer", count: 1 }] }],
                  undetermined: [{ reason: "no_text_layer", count: 1, page: 1 }], images: [{ page: 1, width: 1700, height: 2200 }],
                  counts: { chars: 20, undetermined: 1 } }, {}],
  ["undetermined-mostly", { document: "Harbor", counts: { undetermined: 50 }, undetermined: [{ reason: "encrypted" }] }, {}],
  ["undetermined-partial", { document: "Harbor", counts: { undetermined: 6 } }, {}],
  ["empty", "", { view: PA }],
  ["not-text", 7, {}],
  ["sheet-csv-small", { document: small, sheets: [{ name: "a", text: small }], container: "csv" }, { view: PA }],
  ["sheet-csv-items", { document: `ITEMS\n${small}`, sheets: [{ name: "a", text: `ITEMS\n${small}` }], container: "csv" }, { view: PA }],
  ["sheet-workbook", { document: book.map((s) => s.text).filter(Boolean).join("\n"), sheets: book, container: "xlsx" }, { view: PA }],
];
