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
 * The context `docprofile`'s `readText` hands a content type: the flattened
 * text, the locator over its pages, the reader view and the supplied text.
 * @typedef {Object} BudgetCtx
 * @property {string} [text] the flattened text of every page read
 * @property {Function} [locate] `docprofile`'s locator: an offset in `text` to its source
 * @property {any} [view] the jurisdiction reader view (`jurisdictions.combine`)
 * @property {any} [supplied] the supplied text (I2): `pages`, `undetermined`, `images`, `ocr`, `sheets`
 * @property {string} [content_type]
 * @property {Record<string, string>} [headers]
 * @property {string} [locator] the document's address
 */
/**
 * What `detect` answers (R1, R14).
 * @typedef {Object} Detection
 * @property {boolean} match
 * @property {string} confidence `CONFIDENCE.CERTAIN` on a match, `CONFIDENCE.NONE` otherwise
 * @property {string[]} signals why it matched, in words people read
 * @property {string} [why] which kind of no, and why
 */
/**
 * One figure exactly as printed (R2, R11): a dash, parentheses and a leading
 * minus kept; never parsed, scaled, signed or totalled.
 * @typedef {Object} TableCell
 * @property {string} as_read
 */
/**
 * One row of a table (R2, R3).
 * @typedef {Object} TableRow
 * @property {string | null} label the row's label, a wrapped label merged into one
 * @property {TableCell[]} cells
 * @property {boolean} span a subtotal row whose figures span columns, its cells unplaced
 * @property {any} [source] `ctx.locate`'s source of the row's line, or null
 */
/**
 * One table of a PDF (R2, R3, R6).
 * @typedef {Object} Table
 * @property {string | null} title the heading or caption read with it
 * @property {number | null} page 0-based
 * @property {string | null} period_as_written
 * @property {string | null} scale the scale its heading states ("in thousands"); never applied
 * @property {string[]} columns the header labels as written
 * @property {TableRow[]} rows
 * @property {boolean} usable
 * @property {number} modal_share
 * @property {string | null} why why it is not usable
 * @property {"text-layer" | "ocr"} method
 * @property {string} [engine] the OCR transcription's engine, with `method: "ocr"`
 * @property {string} [title_why]
 * @property {string} [period_why]
 * @bound usable only when modal_share is at least 0.85 and the headers are in the text read
 */
/**
 * What `parse` gives for a PDF (R2 to R6).
 * @typedef {Object} PdfReading
 * @property {Table[]} tables
 * @property {{page: number, rect: any, why: string}[]} unread image-only tables not read
 * @property {{page: number | null, lines: string[], why: string}[]} skipped chart labels set aside (R5)
 * @property {number[]} pages_read
 * @property {{page: number, why: string}[]} pages_unread pages with no text layer
 * @property {string} [why] why no table was read
 */
/**
 * A code as written, with the classification form it matched (R7).
 * @typedef {Object} BudgetCode
 * @property {string} as_written
 * @property {string | null} form the form's label, or null when no form matches
 * @property {string | null} [scheme]
 * @property {string} [why] why no form matched
 */
/**
 * One budget line (R7). `amount` is `office-readers`' typed cell, as written.
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
 * @property {string} [key] R7's key: fund, org, program, project, account, period and phase, as written
 */
/**
 * One department as the table states it for one period (R8).
 * @typedef {Object} Grouping
 * @property {string} department
 * @property {string | null} department_code
 * @property {string | null} period_as_written
 * @property {string[]} orgs the org codes its rows place under it
 * @bound never carried across periods; two periods' groupings never merged by name
 */
/**
 * What `parse` gives for a `budget_table` (R7, R8).
 * @typedef {Object} LinesReading
 * @property {BudgetLine[]} rows
 * @property {BudgetCode[]} codes every distinct code read
 * @property {Grouping[]} groupings
 * @property {{sheet: string | null, row?: number, source?: any, why: string}[]} unread
 */
/**
 * What `assess` gives (R9): events from `site-profiles`' catalogue only.
 * @typedef {Object} Assessment
 * @property {boolean | null} meaningful null on a failed read
 * @property {any} significance
 * @property {any[]} events `outcome_changed`, `item_added`, `delisted` or `item_changed`
 * @property {{kind: string, count: number, why: string} | null} confirmed
 * @property {string} why
 */
/**
 * One content type, as `docprofile`'s registry takes it (R1).
 * @typedef {Object} BudgetType
 * @property {"financial_report" | "budget_book" | "budget_table"} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract `CONTRACT.SUBSTANCE`
 * @property {(ctx: BudgetCtx) => Detection} detect
 * @property {(ctx: BudgetCtx) => any} parse a PdfReading, or a LinesReading for `budget_table`
 * @property {(before: any, after: any, ctx?: BudgetCtx) => Assessment} assess
 */

/** How much of a document's opening text is searched for the words it names
 *  itself by: a cover and a title page (measured: every fixture's own title is
 *  inside its first 2,000 characters).
 *  @type {number}
 *  @bound whole number of characters, 4000 */
export const OPENING_CHARS = 4000;
/** R1's structural floor: a financial document holds at least this many lines
 *  bearing a figure. Measured: the smallest measured table (a budget book's
 *  department page) bears 10; every ACFR statement page bears over 40, and a
 *  title page or a letter bears fewer than 5.
 *  @type {number}
 *  @bound whole number of lines, 10 */
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

/** R1 to R6, R9: an annual financial report, read from its text layer only.
 *  @type {BudgetType} */
export const financialReport = {
  key: "financial_report", label: "an annual financial report", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) { return detectPdf(ctx, KEYS.REPORT_TITLES, "financial report"); },
  parse(ctx) { return readPdf(ctx, false); },
  assess(before, after) { return assessTables(before, after); },
};

/** R1 to R6, R9: a budget book, chart labels set aside, image tables read by OCR or listed unread.
 *  @type {BudgetType} */
export const budgetBook = {
  key: "budget_book", label: "a budget book", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) { return detectPdf(ctx, KEYS.BOOK_TITLES, "budget book"); },
  parse(ctx) { return readPdf(ctx, true); },
  assess(before, after) { return assessTables(before, after); },
};

/** R1, R7 to R9: a budget line-item table, a CSV or workbook sheet.
 *  @type {BudgetType} */
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
 *  @type {readonly BudgetType[]} */
export const BUDGET_TYPES = Object.freeze([financialReport, budgetBook, budgetTable]);

const REGISTERED = new WeakMap();

/** Register the three types through `docprofile`'s registry seam, in order.
 *  Called twice with one `register`, the second call registers nothing.
 *  @param {(type: BudgetType) => any} register the registry's register function
 *  @returns {string[]} the keys registered, in order; empty on a second call
 *  @throws {TypeError} when `register` is not a function */
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
