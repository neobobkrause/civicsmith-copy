/* budget-doctypes: a government's financial documents read as tables.
 *
 * Three content types (R1), registered into `docprofile`'s registry through
 * `registerBudgetTypes(register)`, which the plane wires after the court
 * types and before `generic`:
 *   `financial_report` an annual financial report (ACFR), a PDF read from its
 *                      text layer only (R4);
 *   `budget_book`      a budget book, a PDF whose chart labels are set aside (R5)
 *                      and whose image-only tables are read from an OCR
 *                      transcription or listed unread (R6);
 *   `budget_table`     a budget line-item table, a CSV or workbook sheet (R7, R8).
 * Reading is not extraction (R10): nothing here writes anything, parses a
 * figure's value or totals one; a figure becomes a money fact only through
 * `calculations`' ingest at a member's request. Pure over its inputs (R12):
 * no store, no network, no clock, and no place named in code; titles,
 * headings, header words and code forms are the view's (./view.mjs). */
import { CONFIDENCE, CONTRACT } from "../docprofile/registry.mjs";
import { KEYS, patterns } from "./view.mjs";
import { classify } from "./figures.mjs";
import { readTables } from "./tables.mjs";
import { readLines, headerLineMatches, findHeader, sheetRows } from "./lines.mjs";
import { assessTables, assessLines } from "./assess.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/**
 * The context `docprofile`'s `readText` hands a content type, as this module reads it: the flattened text, the
 * locator over it (R2's `source`), the reader view (R12), the supplied text itself (its `pages`, `undetermined`
 * markers, `images`, `ocr` transcriptions and `sheets`), and the document's content type, headers and locator.
 * @typedef {Object} BudgetCtx
 * @property {string} [text]
 * @property {(offset: number) => any} [locate]
 * @property {any} [view]
 * @property {Record<string, any> | null} [supplied]
 * @property {string} [content_type]
 * @property {Record<string, string>} [headers]
 * @property {string} [locator]
 */
/**
 * R1, R14: a detection. `confidence` is `docprofile`'s CONFIDENCE, "certain" on a match and "none" otherwise; `why`
 * says which kind of no.
 * @typedef {Object} BudgetDetection
 * @property {boolean} match
 * @property {string} confidence
 * @property {string[]} signals
 * @property {string} [why]
 */
/**
 * R2: one cell, the figure exactly as printed (a dash, parentheses and a leading minus kept).
 * @typedef {Object} TableCell
 * @property {string} as_read
 */
/**
 * R2, R3: one row of a table: its label (wrapped lines merged; null with `label_why` when none was read beside its
 * figures), its cells, whether it is a subtotal spanning columns, and its source from `ctx.locate`.
 * @typedef {Object} TableRow
 * @property {string | null} label
 * @property {TableCell[]} cells
 * @property {boolean} span
 * @property {any} source
 * @property {string} [label_why]
 */
/**
 * R2, R3, R6: one table. `scale` is as the heading states it, never applied; `usable` at R3's bar, else `why`;
 * `method` "text-layer" or "ocr", with the transcription's `engine` for "ocr". `title_why` and `period_why` say why
 * a title or a period was not read.
 * @typedef {Object} BudgetTable
 * @property {string | null} title
 * @property {number | null} page
 * @property {string | null} period_as_written
 * @property {string | null} scale
 * @property {string[]} columns
 * @property {TableRow[]} rows
 * @property {boolean} usable
 * @property {number} modal_share
 * @property {string | null} why
 * @property {string} method
 * @property {string} [engine]
 * @property {string} [title_why]
 * @property {string} [period_why]
 * @bound modal_share: 0 to 1, to three places
 */
/**
 * R2 to R6: what `parse` gives for a PDF. `unread` the image-only tables not read (R6), `skipped` the chart-label
 * blocks set aside (R5), `pages_unread` the pages with no text layer (R4); `why` when no table was read (R14).
 * @typedef {Object} TablesReading
 * @property {BudgetTable[]} tables
 * @property {{page: number, rect: number[], why: string}[]} unread
 * @property {{page: number | null, lines: string[], why: string}[]} skipped
 * @property {number[]} pages_read
 * @property {{page: number, why: string}[]} pages_unread
 * @property {string} [why]
 */
/**
 * R7: one code as written, with the view's form that matched it, or `form: null` and why.
 * @typedef {Object} BudgetCode
 * @property {string} as_written
 * @property {string | null} form
 * @property {string | null} [scheme]
 * @property {string} [why]
 */
/**
 * R7: one budget line. `amount` is `office-readers`' typed cell as written; `key` is R7's key.
 * @typedef {Object} BudgetLine
 * @property {BudgetCode} fund
 * @property {BudgetCode} org
 * @property {string | null} department
 * @property {BudgetCode | null} department_code
 * @property {BudgetCode | null} program
 * @property {BudgetCode | null} project
 * @property {BudgetCode | null} account
 * @property {string | null} period_as_written
 * @property {string | null} phase_as_written
 * @property {{value: any, type: any, declared: any, source: any}} amount
 * @property {any} source
 * @property {string} [key]
 */
/**
 * R8: a department as the table states it for one period, with the org codes its rows place under it.
 * @typedef {Object} BudgetGrouping
 * @property {string} department
 * @property {string | null} department_code
 * @property {string | null} period_as_written
 * @property {string[]} orgs
 */
/**
 * R7, R8: what `parse` gives for a `budget_table`. `unread` names each sheet or row not read, with why.
 * @typedef {Object} LinesReading
 * @property {BudgetLine[]} rows
 * @property {BudgetCode[]} codes
 * @property {BudgetGrouping[]} groupings
 * @property {{sheet: string | null, row?: number, source?: any, why: string}[]} unread
 */
/**
 * R9: an assessment in `site-profiles`' events. With nothing read in either reading, a failed read: `meaningful`,
 * `significance` and `confirmed` null, no events, and why.
 * @typedef {Object} BudgetAssessment
 * @property {boolean | null} meaningful
 * @property {any} significance
 * @property {Record<string, any>[]} events
 * @property {{kind: string, count: number, why: string} | null} confirmed
 * @property {string} why
 */
/**
 * R1 to R6, R9: a content type read from a PDF's tables.
 * @typedef {Object} TablesContentType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: BudgetCtx) => BudgetDetection} detect
 * @property {(ctx: BudgetCtx) => TablesReading} parse
 * @property {(before: TablesReading, after: TablesReading) => BudgetAssessment} assess
 */
/**
 * R1, R7 to R9: a content type read from a sheet's budget lines.
 * @typedef {Object} LinesContentType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: BudgetCtx) => BudgetDetection} detect
 * @property {(ctx: BudgetCtx) => LinesReading} parse
 * @property {(before: LinesReading, after: LinesReading) => BudgetAssessment} assess
 */

/** How much of a document's opening text is searched for the words it names
 *  itself by: a cover and a title page (measured: every fixture's own title is
 *  inside its first 2,000 characters). */
/** @type {number} */
export const OPENING_CHARS = 4000;
/** R1's structural floor: a financial document holds at least this many lines
 *  bearing a figure. Measured: the smallest measured table (a budget book's
 *  department page) bears 10; every ACFR statement page bears over 40, and a
 *  title page or a letter bears fewer than 5. */
/** @type {number} */
export const FIGURE_LINE_FLOOR = 10;

function isPdf(ctx) {
  const ct = String(ctx.content_type || (ctx.headers && (ctx.headers["content-type"] || ctx.headers["Content-Type"])) || "");
  const s = ctx.supplied;
  return /pdf/i.test(ct) || /\.pdf(?:[?#]|$)/i.test(String(ctx.locator || ""))
    || !!(s && (s.container === "pdf" || (Array.isArray(s.pages) && s.pages.some((p) => p && Number.isInteger(p.page)))));
}

function isSheet(ctx) {
  const ct = String(ctx.content_type || (ctx.headers && (ctx.headers["content-type"] || ctx.headers["Content-Type"])) || "");
  const s = ctx.supplied;
  return /csv|spreadsheet|excel|opendocument\.spreadsheet/i.test(ct)
    || /\.(?:csv|xlsx|xlsm|xls|ods)(?:[?#]|$)/i.test(String(ctx.locator || ""))
    || !!(s && Array.isArray(s.sheets));
}

function figureLines(text) {
  let n = 0;
  for (const l of String(text).split("\n")) {
    const c = classify(l);
    if (c.kind === "row" || c.kind === "figures") n++;
  }
  return n;
}

/** The words a PDF names itself by in its opening, from the view's `key`. */
function ownTitle(ctx, key) {
  const opening = String(ctx.text || "").slice(0, OPENING_CHARS);
  for (const p of patterns(ctx, key)) {
    const m = p.re.exec(opening.replace(/\s+/g, " "));
    if (m) return m[0].trim();
  }
  return null;
}

function detectPdf(ctx, key, what) {
  const no = (why) => ({ match: false, confidence: CONFIDENCE.NONE, signals: [], why });
  if (!isPdf(ctx)) return no(localize("budget-doctypes.index.not_a_pdf_a_what", "not a PDF: a {what} is read from a PDF's text", { what: String(what) }));
  if (!patterns(ctx, key).length) return no(localize("budget-doctypes.index.the_view_holds_no_words", "the view holds no words a {what} names itself by (vocabulary.{key})", { what: String(what), key: String(key) }));
  const title = ownTitle(ctx, key);
  if (!title) return no(localize("budget-doctypes.index.its_opening_does_not_name", "its opening does not name it a {what} in any words the view holds", { what: String(what) }));
  const lines = figureLines(ctx.text);
  if (lines < FIGURE_LINE_FLOOR)
    return no(localize("budget-doctypes.index.it_names_itself_a_what", "it names itself a {what} (\"{title}\") but holds only {lines} line(s) bearing a figure, under the floor of {FIGURE_LINE_FLOOR}", { what: String(what), title: String(title), lines: String(lines), FIGURE_LINE_FLOOR: String(FIGURE_LINE_FLOOR) }));
  return { match: true, confidence: CONFIDENCE.CERTAIN,
           signals: [localize("budget-doctypes.index.it_names_itself_title", "it names itself \"{title}\"", { title: String(title) }), localize("budget-doctypes.index.lines_lines_bear_a_figure", "{lines} lines bear a figure", { lines: String(lines) })] };
}

function readPdf(ctx, budget) {
  const r = readTables(ctx, { budget });
  if (!r.tables.length)
    r.why = localize("budget-doctypes.index.no_table_was_read_no", "no table was read: no run of rows with two or more figures was found in the text read");
  return r;
}

/** @type {TablesContentType} R1 to R4, R9: `financial_report` */
export const financialReport = {
  key: "financial_report", label: "an annual financial report", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) { return detectPdf(ctx, KEYS.REPORT_TITLES, "financial report"); },
  parse(ctx) { return readPdf(ctx, false); },
  assess(before, after) { return assessTables(before, after); },
};

/** @type {TablesContentType} R1 to R6, R9: `budget_book` */
export const budgetBook = {
  key: "budget_book", label: "a budget book", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) { return detectPdf(ctx, KEYS.BOOK_TITLES, "budget book"); },
  parse(ctx) { return readPdf(ctx, true); },
  assess(before, after) { return assessTables(before, after); },
};

/** @type {LinesContentType} R1, R7 to R9: `budget_table` */
export const budgetTable = {
  key: "budget_table", label: "a budget line-item table", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) {
    const no = (why) => ({ match: false, confidence: CONFIDENCE.NONE, signals: [], why });
    if (!isSheet(ctx)) return no(localize("budget-doctypes.index.not_a_csv_or_workbook_sheet", "not a CSV or workbook sheet: a budget line-item table is read from a sheet's cells"));
    const sheets = ctx.supplied && Array.isArray(ctx.supplied.sheets) ? ctx.supplied.sheets : [];
    for (const s of sheets) {
      if (s && Array.isArray(s.cells)) {
        const h = findHeader(ctx, sheetRows(s));
        if (h) return { match: true, confidence: CONFIDENCE.CERTAIN,
          signals: [localize("budget-doctypes.index.sheet_stringify_names_keys_columns", "sheet {stringify} names {keys} columns in its header row", { stringify: String(JSON.stringify(s.name ?? null)), keys: String(Object.keys(h.map).join(", ")) })] };
      }
    }
    /* With no cells, the header row of the text: the first lines, tab-joined. */
    const lines = String(ctx.text || "").split("\n").slice(0, 20);
    if (lines.some((l) => headerLineMatches(ctx, l)))
      return { match: true, confidence: CONFIDENCE.CERTAIN,
               signals: [localize("budget-doctypes.index.its_header_row_names", "its header row names a fund or org column and an amount column")] };
    return no(localize("budget-doctypes.index.no_header_row_names_a", "no header row names a fund or org column and an amount column by the view's header words"));
  },
  parse(ctx) { return readLines(ctx); },
  assess(before, after) { return assessLines(before, after); },
};

/** The three types in their registration order.
 * @type {ReadonlyArray<TablesContentType | LinesContentType>} */
export const BUDGET_TYPES = Object.freeze([financialReport, budgetBook, budgetTable]);

const REGISTERED = new WeakMap();

/** Register the three types through `docprofile`'s registry seam, in order.
 *  Called twice with one `register`, the second call registers nothing.
 * @param {(type: TablesContentType | LinesContentType) => any} register the registry's register function
 * @returns {string[]} the keys registered, in order; none on a second call
 * @throws {TypeError} when `register` is not a function */
export function registerBudgetTypes(register) {
  if (typeof register !== "function") throw new TypeError("registerBudgetTypes needs the registry's register function");
  if (REGISTERED.has(register)) return [];
  REGISTERED.set(register, true);
  for (const t of BUDGET_TYPES) register(t);
  return BUDGET_TYPES.map((t) => t.key);
}

export { readTables } from "./tables.mjs";
export { readLines, groupings } from "./lines.mjs";
export { KEYS, COLUMNS } from "./view.mjs";
