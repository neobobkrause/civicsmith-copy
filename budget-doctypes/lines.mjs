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

/** How many of a sheet's first rows are searched for its header row. */
export const HEADER_SEARCH_ROWS = 20;

const CODE_COLUMNS = ["fund", "org", "program", "project", "account", "department_code"];

/** "AB12" → {col: "AB", row: 12}. */
function cellPos(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(String(ref || ""));
  return m ? { col: m[1], row: Number(m[2]) } : null;
}

/** A sheet's cells as rows: `[{row, cells: Map(col → cell)}]`, in row order. */
export function sheetRows(sheet) {
  const rows = new Map();
  for (const c of sheet.cells) {
    const pos = c && c.source ? cellPos(c.source.cell) : null;
    if (!pos) continue;
    if (!rows.has(pos.row)) rows.set(pos.row, new Map());
    rows.get(pos.row).set(pos.col, c);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([row, cells]) => ({ row, cells }));
}

const text = (c) => (c && c.value !== null && c.value !== undefined ? String(c.value) : "");

/** The header row of a sheet: the first of its first rows whose cells name, by
 *  the view's header words, a fund or an org column and an amount column (R1).
 *  `{row, map: {column → [col letters]}, headers: {col → as written}}`, or null. */
export function findHeader(ctx, rows) {
  const words = headerWords(ctx);
  if (!words.length) return null;
  for (const r of rows.slice(0, HEADER_SEARCH_ROWS)) {
    const map = {}, headers = {};
    for (const [col, cell] of r.cells) {
      const h = text(cell).trim();
      if (!h) continue;
      headers[col] = h;
      const w = words.find((x) => x.re.test(h));
      if (!w) continue;
      (map[w.column] = map[w.column] || []).push(col);
    }
    if ((map.fund || map.org) && map.amount) return { row: r.row, map, headers };
  }
  return null;
}

/** Header words matched over a tab-joined header line, for detection when the
 *  supplied sheet carries no cells. */
export function headerLineMatches(ctx, line) {
  const words = headerWords(ctx);
  const found = new Set();
  for (const h of String(line).split("\t")) {
    const w = words.find((x) => x.re.test(h.trim()));
    if (w) found.add(w.column);
  }
  return (found.has("fund") || found.has("org")) && found.has("amount");
}

/** One code as written, read by the view's forms for its column (R7). */
export function readCode(ctx, column, written) {
  const s = String(written);
  const forms = codeForms(ctx, column);
  for (const f of forms) if (f.re.test(s.trim())) return { as_written: s, form: f.label, scheme: f.scheme };
  return { as_written: s, form: null,
           why: forms.length ? localize("budget-doctypes.lines.no_form_of_the_views", "no form of the view's {column} classification matches \"{s}\"", { column: String(column), s: String(s.trim()) })
                             : localize("budget-doctypes.lines.the_view_holds_no_form", "the view holds no form for a {column} code", { column: String(column) }) };
}

/** R7, R8: the budget lines of every sheet supplied. */
export function readLines(ctx) {
  const supplied = ctx.supplied && typeof ctx.supplied === "object" ? ctx.supplied : null;
  const sheets = supplied && Array.isArray(supplied.sheets) ? supplied.sheets : [];
  const out = { rows: [], codes: [], groupings: [], unread: [] };
  if (!sheets.length) {
    out.unread.push({ sheet: null, why: localize("budget-doctypes.lines.no_sheet_was_supplied", "no sheet was supplied with this text, so no budget line could be read") });
    return out;
  }
  const codes = new Map();
  for (const sheet of sheets) {
    const name = sheet && typeof sheet.name === "string" ? sheet.name : null;
    if (!sheet || !Array.isArray(sheet.cells)) {
      out.unread.push({ sheet: name, why: localize("budget-doctypes.lines.the_sheet_s_typed_cells", "the sheet's typed cells (office-readers R30) were not supplied: its tab-joined text drops an empty cell, so no value could be placed in its column") });
      continue;
    }
    const rows = sheetRows(sheet);
    const head = findHeader(ctx, rows);
    if (!head) {
      out.unread.push({ sheet: name, why: localize("budget-doctypes.lines.no_header_row_names_a", "no header row names a fund or org column and an amount column by the view's header words") });
      continue;
    }
    const first = (column) => (head.map[column] ? head.map[column][0] : null);
    const amounts = head.map.amount;
    /* One amount column: each row's period and phase are its own columns'. Several
       (a table printing a column per period): each column's header is that
       amount's period and phase, as written. */
    const wide = amounts.length > 1;
    for (const r of rows) {
      if (r.row <= head.row) continue;
      const cell = (column) => { const col = first(column); return col ? r.cells.get(col) || null : null; };
      const fund = text(cell("fund")).trim() ? readCode(ctx, "fund", text(cell("fund"))) : null;
      const org = text(cell("org")).trim() ? readCode(ctx, "org", text(cell("org"))) : null;
      const anyValue = [...r.cells.values()].some((c) => text(c).trim());
      if (!anyValue) continue;
      const source = (cell("fund") || cell("org") || [...r.cells.values()][0]).source || null;
      if (!fund || !org) {
        out.unread.push({ sheet: name, row: r.row, source,
          why: !fund && !org ? localize("budget-doctypes.lines.the_row_holds_no_fund_and_no", "the row holds no fund and no org code")
            : !fund ? localize("budget-doctypes.lines.the_row_holds_no_fund_code", "the row holds no fund code")
            : localize("budget-doctypes.lines.the_row_holds_no_org_code", "the row holds no org code") });
        continue;
      }
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
        out.rows.push({
          ...base,
          period_as_written: wide ? head.headers[col] : (text(cell("period")) || null),
          phase_as_written: wide ? head.headers[col] : (text(cell("phase")) || null),
          amount: { value: a.value, type: a.type ?? null, declared: a.declared ?? null, source: a.source || null },
          source,
        });
      }
    }
  }
  out.codes = [...codes.values()];
  out.groupings = groupings(out.rows);
  for (const r of out.rows) r.key = rowKey(r);
  return out;
}

/** R7's key: fund and org, with account, period and phase (and program and
 *  project, which a line-item table also splits a line by), as written. */
export function rowKey(r) {
  const w = (c) => (c ? c.as_written.trim() : "");
  return [w(r.fund), w(r.org), w(r.program), w(r.project), w(r.account), r.period_as_written || "",
          r.phase_as_written || ""].join("|");
}

/** R8: each department as the table states it for one period, with the org
 *  codes its rows place under it. Never carried across periods; never merged
 *  by name across periods. */
export function groupings(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!r.department) continue;
    const k = JSON.stringify([r.period_as_written, r.department, r.department_code ? r.department_code.as_written : null]);
    if (!by.has(k)) by.set(k, { department: r.department, department_code: r.department_code ? r.department_code.as_written : null,
                                period_as_written: r.period_as_written, orgs: [] });
    const g = by.get(k);
    const o = r.org.as_written.trim();
    if (!g.orgs.includes(o)) g.orgs.push(o);
  }
  return [...by.values()];
}
