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

/** How much of a document's opening text is searched for the words it names
 *  itself by: a cover and a title page (measured: every fixture's own title is
 *  inside its first 2,000 characters). */
export const OPENING_CHARS = 4000;
/** R1's structural floor: a financial document holds at least this many lines
 *  bearing a figure. Measured: the smallest measured table (a budget book's
 *  department page) bears 10; every ACFR statement page bears over 40, and a
 *  title page or a letter bears fewer than 5. */
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

export const financialReport = {
  key: "financial_report", label: "an annual financial report", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) { return detectPdf(ctx, KEYS.REPORT_TITLES, "financial report"); },
  parse(ctx) { return readPdf(ctx, false); },
  assess(before, after) { return assessTables(before, after); },
};

export const budgetBook = {
  key: "budget_book", label: "a budget book", version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) { return detectPdf(ctx, KEYS.BOOK_TITLES, "budget book"); },
  parse(ctx) { return readPdf(ctx, true); },
  assess(before, after) { return assessTables(before, after); },
};

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

/** The three types in their registration order. */
export const BUDGET_TYPES = Object.freeze([financialReport, budgetBook, budgetTable]);

const REGISTERED = new WeakMap();

/** Register the three types through `docprofile`'s registry seam, in order.
 *  Called twice with one `register`, the second call registers nothing. */
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
