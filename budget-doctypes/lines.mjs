/* Budget line items read from a CSV or workbook sheet (R7, R8).
 *
 * The sheet is read from its typed cells, `office-readers` R30
 * (`sheets[].cells`, each `{source, value, type, declared, cached, formula}`,
 * `source` a `sheet-cell` reference), carried on the supplied text the caller
 * passes as `ctx.supplied`. Only the cells can place a value in its column: a
 * sheet's tab-joined text drops an empty cell, so a row of it cannot say which
 * column a value was in, and a sheet supplied without cells is not read (R14).
 * Header words, and the forms of each code, are the view's (R12). */
import { headerWords, codeForms } from "./view.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, SuppliedSheet } from "../docprofile/registry.mjs" */
/** @import { BudgetColumn } from "../jurisdictions/index.mjs" */

/**
 * Where a typed cell was read: office-readers R30's `sheet-cell` reference, as the sheet carries it.
 * @typedef {Object} CellSource
 * @property {string} [kind]
 * @property {string} [ref]
 * @property {string} [sheet]
 * @property {string} [cell]
 */
/**
 * One typed cell of a sheet (office-readers R30): where it was read, its value, its type and its declared type.
 * @typedef {Object} SheetCell
 * @property {CellSource | null} [source]
 * @property {string | number | boolean | null} [value]
 * @property {string | null} [type]
 * @property {string | null} [declared]
 */
/**
 * A sheet as the supplied text carries it, with its typed cells.
 * @typedef {{ readonly name?: string, readonly cells?: Array<SheetCell | null | undefined> }} CelledSheet
 */
/**
 * One row of a sheet: its number and its cells by column letters.
 * @typedef {Object} SheetRow
 * @property {number} row
 * @property {Map<string, SheetCell>} cells
 */
/**
 * A sheet's header row: its number, the column letters each named column stands in, and each header as written.
 * @typedef {Object} HeaderRow
 * @property {number} row
 * @property {Map<BudgetColumn, string[]>} map
 * @property {Map<string, string>} headers
 */
/**
 * One code read by the view's forms (R7): as written, the form that matched and its scheme; or, where none matched,
 * `form: null` and why.
 * @typedef {{ as_written: string, form: string, scheme: string | null } | { as_written: string, form: null, why: string }} CodeReading
 */
/**
 * A budget line's amount (R7): the cell's typed value as written, its type, its declared type and where it was read.
 * @typedef {Object} LineAmount
 * @property {string | number | boolean | null | undefined} value
 * @property {string | null} type
 * @property {string | null} declared
 * @property {CellSource | null} source
 */
/**
 * The parts of a budget line R7's key is made of.
 * @typedef {Object} KeyParts
 * @property {CodeReading} fund
 * @property {CodeReading} org
 * @property {CodeReading | null} program
 * @property {CodeReading | null} project
 * @property {CodeReading | null} account
 * @property {string | null} period_as_written
 * @property {string | null} phase_as_written
 */
/**
 * One budget line (R7): its codes, department, period and phase as written, its amount, where it was read, and its key.
 * @typedef {Object} BudgetLine
 * @property {CodeReading} fund
 * @property {CodeReading} org
 * @property {string | null} department
 * @property {CodeReading | null} department_code
 * @property {CodeReading | null} program
 * @property {CodeReading | null} project
 * @property {CodeReading | null} account
 * @property {string | null} period_as_written
 * @property {string | null} phase_as_written
 * @property {LineAmount} amount
 * @property {CellSource | null} source
 * @property {string} key
 */
/**
 * A department as a table states it for one period (R8), with the org codes its rows place under it.
 * @typedef {Object} Grouping
 * @property {string} department
 * @property {string | null} department_code
 * @property {string | null} period_as_written
 * @property {string[]} orgs
 */
/**
 * A sheet or row not read (R7, R14): the sheet, the row and where it was read where known, and why.
 * @typedef {Object} LineUnread
 * @property {string | null} sheet
 * @property {number} [row]
 * @property {CellSource | null} [source]
 * @property {string} why
 */
/**
 * What `parse` gives for a `budget_table` (R7, R8): the lines, the codes read, the departments' groupings, and what was
 * not read.
 * @typedef {Object} LinesReading
 * @property {BudgetLine[]} rows
 * @property {CodeReading[]} codes
 * @property {Grouping[]} groupings
 * @property {LineUnread[]} unread
 */

/** How many of a sheet's first rows are searched for its header row. */
export const HEADER_SEARCH_ROWS = 20;

const CODE_COLUMNS = ["fund", "org", "program", "project", "account", "department_code"];

/** "AB12" → {col: "AB", row: 12}.
 *  @param {string | undefined} ref
 *  @returns {{ col: string, row: number } | null} */
function cellPos(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(String(ref || ""));
  const col = m ? m[1] : undefined, row = m ? m[2] : undefined;
  return col !== undefined && row !== undefined ? { col, row: Number(row) } : null;
}

/** The typed cells a supplied sheet carries (office-readers R30), or null where it carries none. Waits on `docprofile`:
 *  its `SuppliedSheet` states no `cells`.
 *  @param {SuppliedSheet} sheet
 *  @returns {ReadonlyArray<SheetCell | null | undefined> | null} */
export function sheetCells(sheet) {
  const cells = /** @type {CelledSheet} */ (sheet).cells;
  return Array.isArray(cells) ? cells : null;
}

/** A sheet's cells as rows: `[{row, cells: Map(col → cell)}]`, in row order.
 *  @param {ReadonlyArray<SheetCell | null | undefined>} cells
 *  @returns {SheetRow[]} */
export function sheetRows(cells) {
  const rows = new Map(/** @type {Array<[number, Map<string, SheetCell>]>} */ ([]));
  for (const c of cells) {
    const source = c ? c.source : null;
    const pos = c && source ? cellPos(source.cell) : null;
    if (!c || !pos) continue;
    const known = rows.get(pos.row);
    const row = known || new Map(/** @type {Array<[string, SheetCell]>} */ ([]));
    if (!known) rows.set(pos.row, row);
    row.set(pos.col, c);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([row, cells]) => ({ row, cells }));
}

/** @param {SheetCell | null | undefined} c @returns {string} */
const text = (c) => { const v = c ? c.value : undefined; return v !== null && v !== undefined ? String(v) : ""; };

/** The header row of a sheet: the first of its first rows whose cells name, by
 *  the view's header words, a fund or an org column and an amount column (R1).
 *  `{row, map: column → [col letters], headers: col → as written}`, or null.
 *  @param {DoctypeContext} ctx
 *  @param {SheetRow[]} rows
 *  @returns {HeaderRow | null} */
export function findHeader(ctx, rows) {
  const words = headerWords(ctx);
  if (!words.length) return null;
  for (const r of rows.slice(0, HEADER_SEARCH_ROWS)) {
    const map = new Map(/** @type {Array<[BudgetColumn, string[]]>} */ ([]));
    const headers = new Map(/** @type {Array<[string, string]>} */ ([]));
    for (const [col, cell] of r.cells) {
      const h = text(cell).trim();
      if (!h) continue;
      headers.set(col, h);
      const w = words.find((x) => x.re.test(h));
      if (!w) continue;
      const known = map.get(w.column);
      const cols = known || [];
      if (!known) map.set(w.column, cols);
      cols.push(col);
    }
    if ((map.has("fund") || map.has("org")) && map.has("amount")) return { row: r.row, map, headers };
  }
  return null;
}

/** Header words matched over a tab-joined header line, for detection when the
 *  supplied sheet carries no cells.
 *  @param {DoctypeContext} ctx
 *  @param {string} line
 *  @returns {boolean} */
export function headerLineMatches(ctx, line) {
  const words = headerWords(ctx);
  const found = new Set(/** @type {BudgetColumn[]} */ ([]));
  for (const h of String(line).split("\t")) {
    const w = words.find((x) => x.re.test(h.trim()));
    if (w) found.add(w.column);
  }
  return (found.has("fund") || found.has("org")) && found.has("amount");
}

/** One code as written, read by the view's forms for its column (R7).
 *  @param {DoctypeContext} ctx
 *  @param {string} column
 *  @param {string} written
 *  @returns {CodeReading} */
export function readCode(ctx, column, written) {
  const s = String(written);
  const forms = codeForms(ctx, column);
  for (const f of forms) if (f.re.test(s.trim())) return { as_written: s, form: f.label, scheme: f.scheme };
  return { as_written: s, form: null,
           why: forms.length ? localize("budget-doctypes.lines.no_form_of_the_views", "no form of the view's {column} classification matches \"{s}\"", { column: String(column), s: String(s.trim()) })
                             : localize("budget-doctypes.lines.the_view_holds_no_form", "the view holds no form for a {column} code", { column: String(column) }) };
}

/** R7, R8: the budget lines of every sheet supplied.
 *  @param {DoctypeContext} ctx
 *  @returns {LinesReading} */
export function readLines(ctx) {
  const given = ctx.supplied;
  const supplied = given && typeof given === "object" ? given : null;
  const listed = supplied ? supplied.sheets : undefined;
  const sheets = supplied && Array.isArray(listed) ? listed : [];
  /** @type {LinesReading} */
  const out = { rows: [], codes: [], groupings: [], unread: [] };
  if (!sheets.length) {
    out.unread.push({ sheet: null, why: localize("budget-doctypes.lines.no_sheet_was_supplied", "no sheet was supplied with this text, so no budget line could be read") });
    return out;
  }
  const codes = new Map(/** @type {Array<[string, CodeReading]>} */ ([]));
  for (const sheet of sheets) {
    const named = sheet ? sheet.name : undefined;
    const name = sheet && typeof named === "string" ? named : null;
    const cells = sheet ? sheetCells(sheet) : null;
    if (!sheet || !cells) {
      out.unread.push({ sheet: name, why: localize("budget-doctypes.lines.the_sheet_s_typed_cells", "the sheet's typed cells (office-readers R30) were not supplied: its tab-joined text drops an empty cell, so no value could be placed in its column") });
      continue;
    }
    const rows = sheetRows(cells);
    const head = findHeader(ctx, rows);
    if (!head) {
      out.unread.push({ sheet: name, why: localize("budget-doctypes.lines.no_header_row_names_a", "no header row names a fund or org column and an amount column by the view's header words") });
      continue;
    }
    /** @param {BudgetColumn} column @returns {string | null} */
    const first = (column) => { const cols = head.map.get(column); return cols ? cols[0] ?? null : null; };
    const amounts = head.map.get("amount") ?? [];
    /* One amount column: each row's period and phase are its own columns'. Several
       (a table printing a column per period): each column's header is that
       amount's period and phase, as written. */
    const wide = amounts.length > 1;
    for (const r of rows) {
      if (r.row <= head.row) continue;
      /** @param {BudgetColumn} column @returns {SheetCell | null} */
      const cell = (column) => { const col = first(column); return col ? r.cells.get(col) || null : null; };
      const fund = text(cell("fund")).trim() ? readCode(ctx, "fund", text(cell("fund"))) : null;
      const org = text(cell("org")).trim() ? readCode(ctx, "org", text(cell("org"))) : null;
      const anyValue = [...r.cells.values()].some((c) => text(c).trim());
      if (!anyValue) continue;
      const holder = cell("fund") || cell("org") || [...r.cells.values()][0];
      if (!holder) continue;
      const source = holder.source || null;
      if (!fund || !org) {
        out.unread.push({ sheet: name, row: r.row, source,
          why: !fund && !org ? localize("budget-doctypes.lines.the_row_holds_no_fund_and_no", "the row holds no fund and no org code")
            : !fund ? localize("budget-doctypes.lines.the_row_holds_no_fund_code", "the row holds no fund code")
            : localize("budget-doctypes.lines.the_row_holds_no_org_code", "the row holds no org code") });
        continue;
      }
      /** @param {BudgetColumn} column @returns {CodeReading | null} */
      const code = (column) => (text(cell(column)).trim() ? readCode(ctx, column, text(cell(column))) : null);
      const base = {
        fund, org,
        department: text(cell("department")) || null,
        department_code: code("department_code"),
        program: code("program"), project: code("project"), account: code("account"),
      };
      for (const c of [fund, org, base.department_code, base.program, base.project, base.account])
        if (c) codes.set(JSON.stringify([c.as_written, c.form]), c);
      for (const col of amounts) {
        const a = r.cells.get(col) || null;
        if (!a || !text(a).trim()) continue;
        const line = {
          ...base,
          period_as_written: wide ? head.headers.get(col) ?? null : (text(cell("period")) || null),
          phase_as_written: wide ? head.headers.get(col) ?? null : (text(cell("phase")) || null),
          amount: { value: a.value, type: a.type ?? null, declared: a.declared ?? null, source: a.source || null },
          source,
        };
        out.rows.push({ ...line, key: rowKey(line) });
      }
    }
  }
  out.codes = [...codes.values()];
  out.groupings = groupings(out.rows);
  return out;
}

/** R7's key: fund and org, with account, period and phase (and program and
 *  project, which a line-item table also splits a line by), as written.
 *  @param {KeyParts} r
 *  @returns {string} */
export function rowKey(r) {
  /** @param {CodeReading | null} c @returns {string} */
  const w = (c) => (c ? c.as_written.trim() : "");
  return [w(r.fund), w(r.org), w(r.program), w(r.project), w(r.account), r.period_as_written || "",
          r.phase_as_written || ""].join("|");
}

/** R8: each department as the table states it for one period, with the org
 *  codes its rows place under it. Never carried across periods; never merged
 *  by name across periods.
 *  @param {ReadonlyArray<BudgetLine>} rows
 *  @returns {Grouping[]} */
export function groupings(rows) {
  const by = new Map(/** @type {Array<[string, Grouping]>} */ ([]));
  for (const r of rows) {
    const department = r.department, departmentCode = r.department_code;
    if (!department) continue;
    const k = JSON.stringify([r.period_as_written, department, departmentCode ? departmentCode.as_written : null]);
    const known = by.get(k);
    const g = known || { department, department_code: departmentCode ? departmentCode.as_written : null,
                         period_as_written: r.period_as_written, orgs: [] };
    if (!known) by.set(k, g);
    const o = r.org.as_written.trim();
    if (!g.orgs.includes(o)) g.orgs.push(o);
  }
  return [...by.values()];
}
