import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeRegistry, EVENTS } from "../../docprofile/registry.mjs";
import {
  BUDGET_TYPES, registerBudgetTypes, financialReport, budgetBook, budgetTable,
} from "../index.mjs";
import { firstView, testView, pdfFixture, ctxFor, csvSupplied, fixture } from "./helpers.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

const FIRST = firstView();
const TESTV = testView();

/** One measured PDF read by `type`, with the first profile's view. */
function readPdf(key, type, opts) {
  const { supplied } = pdfFixture(key, opts);
  return type.parse(ctxFor(supplied, FIRST));
}
const onPage = (r, pdfPage) => r.tables.filter((t) => t.page === pdfPage - 1);
const allCells = (t) => t.rows.flatMap((r) => r.cells.map((c) => c.as_read));

/* A test-profile financial document, as a supplied PDF text: two pages, a cover
   and a statement, the second with a wrapped label, a dash, a total row whose
   figures span and a table that is not usable. */
function testPdf(pages) {
  const supplied = { container: "pdf", pages: pages.map((text, page) => ({ page, text, undetermined: [] })), undetermined: [], images: [] };
  for (const p of supplied.pages) if (!p.text.trim()) {
    const m = { page: p.page, reason: "no_text_layer", font: null, codes: "", count: 0 };
    p.undetermined.push(m); supplied.undetermined.push(m);
  }
  supplied.document = supplied.pages.map((p) => p.text).filter((t) => t.length).join("\n");
  return supplied;
}
const COVER = "Harbour Authority of Port Ellery\nStatement of Accounts\nYear 2025/26";
const STATEMENT = [
  "Exhibit A", "Harbour Revenue Account", "Year 2025/26", "(in thousands)",
  "General Harbour Total",
  "Cash on hand 1,200 300 1,500",
  "Amounts receivable from the Marlow County Commission (net of",
  "doubtful accounts) 410 — 410",
  "Prepaid items (12) 5 (7)",
  "Deposits held 70 2 72",
  "Equipment 900 100 1,000",
  "Land 600 — 600",
  "Total assets 3,168 407",
  "These statements are part of the statement of accounts of the authority for the year.",
].join("\n");
const ROUGH = [
  "Exhibit B", "General Harbour Total",
  "Item one 1 2 3", "Item two 4 5", "Item three 6 7 8 9", "Item four 1 2", "Item five 3 4 5 6 7",
].join("\n");

// ---------------------------------------------------------------- R1

test("R1: each measured document is matched at CERTAIN by its own title words and a figure floor", () => {
  for (const key of ["a24", "a14", "a19"]) {
    const ctx = ctxFor(pdfFixture(key).supplied, FIRST);
    const d = financialReport.detect(ctx);
    assert.equal(d.match, true, key);
    assert.equal(d.confidence, "certain");
    assert.equal(budgetBook.detect(ctx).match, false, `${key} is not a budget book`);
    assert.equal(budgetTable.detect(ctx).match, false, `${key} is not a sheet`);
  }
  const bb = ctxFor(pdfFixture("bb23").supplied, FIRST);
  assert.deepEqual([financialReport.detect(bb).match, budgetBook.detect(bb).match], [false, true]);
  assert.equal(budgetBook.detect(bb).confidence, "certain");
});

test("R1: a budget line-item sheet is matched by header words naming a fund or org column and an amount column", async () => {
  for (const f of ["fy2013-15-adopted.csv", "fy2019-21-adopted.csv"]) {
    const ctx = ctxFor(await csvSupplied(fixture(f)), FIRST, { content_type: "text/csv" });
    const d = budgetTable.detect(ctx);
    assert.equal(d.match, true, f);
    assert.equal(d.confidence, "certain");
    assert.equal(financialReport.detect(ctx).match, false);
  }
  /* The header row read from the text, when no cells are supplied. */
  const bare = ctxFor(await csvSupplied(fixture("fy2013-15-adopted.csv"), { cells: false }), FIRST, { content_type: "text/csv" });
  assert.equal(budgetTable.detect(bare).match, true);
  /* No fund or org column, or no amount column: no match, with why. */
  for (const csv of ["fund,description\n1010,General\n", "description,amount\nGeneral,5\n"]) {
    const d = budgetTable.detect(ctxFor(await csvSupplied(csv), FIRST, { content_type: "text/csv" }));
    assert.equal(d.match, false); assert.equal(d.why, localize("budget-doctypes.index.no_header_row_names_a", "no header row names a fund or org column and an amount column by the view's header words"));
  }
});

test("R1: anything else does not match, and says why", () => {
  const floorText = "Statement of Accounts\nCash 1 2\nLand 3 4";
  const cases = [
    [financialReport, ctxFor("Cash 1 2\n".repeat(20), FIRST), localize("budget-doctypes.index.not_a_pdf_a_what", "not a PDF: a {what} is read from a PDF's text", { what: "financial report" })],
    [financialReport, ctxFor(testPdf(["A letter to the council", "Cash 1 2\n".repeat(20)]), FIRST), localize("budget-doctypes.index.its_opening_does_not_name", "its opening does not name it a {what} in any words the view holds", { what: "financial report" })],
    [financialReport, ctxFor(testPdf(["Statement of Accounts", "Cash 1 2\nLand 3 4"]), TESTV), localize("budget-doctypes.index.it_names_itself_a_what", "it names itself a {what} (\"{title}\") but holds only {lines} line(s) bearing a figure, under the floor of {FIGURE_LINE_FLOOR}", { what: "financial report", title: "Statement of Accounts", lines: String(floorText.split("\n").length - 1), FIGURE_LINE_FLOOR: "10" })],
    [budgetBook, ctxFor(testPdf(["Adopted Policy Budget", "Cash 1 2\n".repeat(20)]), { vocabulary: {} }), localize("budget-doctypes.index.the_view_holds_no_words", "the view holds no words a {what} names itself by (vocabulary.{key})", { what: "budget book", key: "budget_book_titles" })],
    [budgetTable, ctxFor(testPdf([COVER]), FIRST), localize("budget-doctypes.index.not_a_csv_or_workbook_sheet", "not a CSV or workbook sheet: a budget line-item table is read from a sheet's cells")],
  ];
  for (const [type, ctx, why] of cases) {
    const d = type.detect(ctx);
    assert.equal(d.match, false); assert.equal(d.confidence, "none"); assert.equal(d.why, why);
  }
});

test("R1: the three types are registered in order, after the court types and before generic, once per registry", () => {
  assert.deepEqual(BUDGET_TYPES.map((t) => t.key), ["financial_report", "budget_book", "budget_table"]);
  for (const t of BUDGET_TYPES) {
    assert.equal(t.contract, "substance");
    for (const f of ["detect", "parse", "assess"]) assert.equal(typeof t[f], "function");
    assert.equal(typeof t.label, "string"); assert.equal(t.version, 1);
  }
  const reg = makeRegistry();
  const court = { key: "court_stub", detect: () => ({ match: false }) };
  const generic = { key: "generic", fallback: true, detect: () => ({ match: false }) };
  reg.register(court);
  const register = (t) => reg.register(t);
  assert.deepEqual(registerBudgetTypes(register), ["financial_report", "budget_book", "budget_table"]);
  assert.deepEqual(registerBudgetTypes(register), []);
  reg.register(generic);
  assert.deepEqual(reg.all().map((t) => t.key), ["court_stub", "financial_report", "budget_book", "budget_table", "generic"]);
  const r = reg.recognise(ctxFor(pdfFixture("bb23").supplied, FIRST));
  assert.equal(r.member.key, "budget_book");
  assert.equal(reg.recognise(ctxFor("nothing here", FIRST)).member.key, "generic");
});

// ---------------------------------------------------------------- R2

test("R2: each table has its fields, every figure as printed and unscaled, each row placed by ctx.locate", () => {
  const r = readPdf("a24", financialReport);
  assert.ok(r.tables.length >= 6);
  for (const t of r.tables) {
    assert.deepEqual(Object.keys(t).filter((k) => !["engine", "title_why", "period_why"].includes(k)).sort(),
      ["columns", "method", "modal_share", "page", "period_as_written", "rows", "scale", "title", "usable", "why"]);
    for (const row of t.rows) {
      assert.deepEqual(Object.keys(row).filter((k) => k !== "label_why").sort(), ["cells", "label", "source", "span"]);
      for (const c of row.cells) { assert.deepEqual(Object.keys(c), ["as_read"]); assert.equal(typeof c.as_read, "string"); }
      /* The source is the locator's own answer for the page the row was read on. */
      assert.equal(row.source.kind, "pdf-page"); assert.equal(row.source.page, t.page);
    }
  }
  const [net] = onPage(r, 49);
  assert.equal(net.title, "Statement of Net Position");
  assert.equal(net.scale, "In thousands");
  /* The first profile holds no form for a dated heading ("June 30, 2024"): no period. */
  assert.equal(net.period_as_written, null); assert.equal(net.period_why, localize("budget-doctypes.tables.no_fiscal_year_form", "no fiscal-year form the view holds was read above, below or in the header of the table"));
  assert.ok(net.columns.join(" ").includes("Port of"));
  const cash = net.rows.find((x) => x.label === "Cash and investments");
  assert.deepEqual(cash.cells.map((c) => c.as_read), ["$ 1,405,595", "$ 99,327", "$ 1,504,922", "$ 678,654"]);
  /* A table with no scale stated gives null, and a scale is never applied. */
  const book = readPdf("bb23", budgetBook);
  const [p241] = onPage(book, 241);
  assert.equal(p241.scale, null);
  assert.ok(allCells(p241).includes("-$9,794,467"));
});

test("R2: a row's source is null where the supplied text carries no page structure", () => {
  const r = financialReport.parse({ text: STATEMENT, view: TESTV, locate: () => null });
  assert.ok(r.tables.length);
  for (const t of r.tables) { assert.equal(t.page, null); for (const row of t.rows) assert.equal(row.source, null); }
});

// ---------------------------------------------------------------- R3

test("R3: wrapped labels merge, a dash is a cell, a spanning total row is kept unplaced, usability at 85% with headers", () => {
  const ctx = ctxFor(testPdf([COVER, STATEMENT]), TESTV);
  const r = financialReport.parse(ctx);
  const [t] = r.tables;
  assert.equal(t.title, "Harbour Revenue Account");
  assert.equal(t.scale, "in thousands");
  assert.equal(t.period_as_written, "Year 2025/26");
  assert.deepEqual(t.columns, ["General Harbour Total"]);
  const wrapped = t.rows.find((x) => x.label.startsWith("Amounts receivable"));
  assert.equal(wrapped.label, "Amounts receivable from the Marlow County Commission (net of doubtful accounts)");
  assert.deepEqual(wrapped.cells.map((c) => c.as_read), ["410", "—", "410"]);
  const total = t.rows.find((x) => x.label === "Total assets");
  assert.equal(total.span, true);
  assert.deepEqual(total.cells.map((c) => c.as_read), ["3,168", "407"]);
  assert.ok(t.rows.filter((x) => x !== total).every((x) => x.span === false));
  /* 6 of 7 rows at the modal 3 cells: 0.857, usable. */
  assert.equal(t.modal_share, 0.857); assert.equal(t.usable, true); assert.equal(t.why, null);
  /* Blank lines inside a page leave its table whole. */
  const spaced = financialReport.parse(ctxFor(testPdf([COVER, STATEMENT.replace(/\n(?=Prepaid|Land)/g, "\n\n")]), TESTV));
  assert.equal(spaced.tables.length, 1);
  assert.deepEqual(spaced.tables[0].rows.map((x) => x.label), t.rows.map((x) => x.label));
  /* Under 85%: not usable, with the share and why. */
  const rough = financialReport.parse(ctxFor(testPdf([COVER, ROUGH]), TESTV)).tables[0];
  assert.equal(rough.usable, false); assert.equal(rough.modal_share, 0.4); assert.equal(rough.why, localize("budget-doctypes.tables.only_v1_of_the_length", "only {v1}% of the {length} rows holding two or more figures have the table's modal {modal} cells (at least {v2}% needed)", { v1: "40", length: "5", modal: "2", v2: "85" }));
  /* Headers not in the text read: not usable, with why. */
  const bare = financialReport.parse(ctxFor(testPdf([COVER, "Exhibit C\nCash 1 2 3\nLand 4 5 6"]), TESTV)).tables[0];
  assert.equal(bare.usable, false); assert.equal(bare.why, localize("budget-doctypes.tables.the_table_s_headers", "the table's headers are not in the text read"));
});

test("R3: measured wrapped labels merge, and a measured total row in its columns is not a span", () => {
  const r = readPdf("a14", financialReport);
  const [net] = onPage(r, 46);
  assert.ok(net.rows.some((x) => x.label === "Notes and loans receivable (net of allowance for uncollectibles of $130,652 for the City)"
                               && x.cells.map((c) => c.as_read).join(" ") === "343,454 - 343,454 -"));
  const [bal] = onPage(r, 48);
  const total = bal.rows.find((x) => x.label === "TOTAL FUND BALANCES (DEFICITS)");
  assert.equal(total.cells.length, 7); assert.equal(total.span, false);
  assert.ok(bal.usable);
});

// ---------------------------------------------------------------- R4

test("R4: a financial report reads only its text layer and lists each page with none as unread, with why", () => {
  const r = readPdf("a24", financialReport);
  assert.ok(r.tables.every((t) => t.method === "text-layer"));
  assert.deepEqual(r.pages_unread.map((p) => p.page), [3]);
  assert.equal(r.pages_unread[0].why, localize("budget-doctypes.tables.no_text_layer_a_cover", "no text layer (a cover, a divider, a certificate or a chart): a financial report is read from its text layer only, and no table is read from this page"));
  assert.ok(r.tables.every((t) => t.page !== 3));
  assert.ok(r.pages_read.includes(48));
  const r14 = readPdf("a14", financialReport);
  assert.ok(r14.pages_unread.some((p) => p.page === 0));
  /* An OCR transcription is never read for a financial report. */
  const { supplied } = pdfFixture("a24");
  supplied.ocr = [{ page: 3, engine: "tesseract", regions: [{ text: "Cash 1 2 3", source: null }, { text: "Land 4 5 6", source: null }] }];
  const withOcr = financialReport.parse(ctxFor(supplied, FIRST));
  assert.ok(withOcr.tables.every((t) => t.method === "text-layer"));
  assert.deepEqual(withOcr.pages_unread.map((p) => p.page), [3]);
});

// ---------------------------------------------------------------- R5

test("R5: a budget book sets aside the chart-label block, listed with its page and why, never read as rows", () => {
  const r = readPdf("bb23", budgetBook, { pages: [1, 148] });
  const skipped = r.skipped.filter((s) => s.page === 147);
  assert.equal(skipped.length, 9);
  for (const s of skipped) assert.equal(s.why, localize("budget-doctypes.tables.chart_labels_a_label", "chart labels: a label paired with an amount and a parenthesised share, printed above a table; not a row of it, and the share is not a negative figure"));
  assert.deepEqual(skipped[0].lines, ["Property Tax", "$308,925,155 (36.5%)"]);
  const [t] = onPage(r, 148);
  assert.equal(t.usable, true);
  assert.equal(t.title, "GENERAL PURPOSE FUND REVENUE");
  const cells = allCells(t);
  for (const share of ["(36.5%)", "(15.1%)", "(7.3%)", "(14.7%)"]) assert.ok(!cells.includes(share), share);
  assert.equal(t.rows.find((x) => x.label === "Property Tax").cells.length, 4);
  /* A financial report does not set chart labels aside: such a line is text. */
  assert.equal(readPdf("bb23", financialReport, { pages: [148] }).skipped.length, 0);
});

// ---------------------------------------------------------------- R6

test("R6: an image-only table is listed unread with its page and rectangle, never as an empty table", () => {
  const r = readPdf("bb23", budgetBook);
  const u = r.unread.filter((x) => x.page === 16);
  assert.equal(u.length, 1);
  assert.deepEqual(u[0], { page: 16, rect: [122.85, 612.48, 488.67, 714.27], why: "image-only table, not read" });
  assert.equal(onPage(r, 17).length, 0);
  /* A budget book page with no text layer and no transcription: unread, with why. */
  assert.ok(r.pages_unread.some((p) => p.page === 10 && p.why === localize("budget-doctypes.tables.no_text_layer_and_no_ocr", "no text layer, and no OCR transcription of the page was supplied: any table printed on it is not read")));
});

test("R6: a table printed as an image is read from an OCR transcription the supplied text carries, marked ocr with its engine", () => {
  const { supplied } = pdfFixture("bb23");
  const regions = ["Type FY23-24 FY24-25", "General Purpose Fund $100 $200", "Measure Q $30 $40", "Measure Z $5 $6"]
    .map((text, i) => ({ text, source: { kind: "pdf-page", ref: "p17", page: 16, rect: [0, i * 20, 100, i * 20 + 18], space: "image-px" } }));
  supplied.ocr = [{ page: 16, engine: "tesseract 5", regions }, { page: 10, engine: "tesseract 5", regions: regions.map((g) => ({ ...g })) }];
  const r = budgetBook.parse(ctxFor(supplied, FIRST));
  const ocr = r.tables.filter((t) => t.method === "ocr");
  assert.deepEqual(ocr.map((t) => t.page).sort(), [10, 16]);
  for (const t of ocr) {
    assert.equal(t.engine, "tesseract 5");
    assert.deepEqual(t.rows.find((x) => x.label === "Measure Q").cells.map((c) => c.as_read), ["$30", "$40"]);
    assert.equal(t.rows.find((x) => x.label === "Measure Q").source.space, "image-px");
  }
  assert.ok(!r.unread.some((x) => x.page === 16));
  assert.ok(!r.pages_unread.some((x) => x.page === 10));
  /* A transcription naming no engine is not one. */
  supplied.ocr = [{ page: 16, regions }];
  assert.ok(budgetBook.parse(ctxFor(supplied, FIRST)).unread.some((x) => x.page === 16));
});

// ---------------------------------------------------------------- R7

test("R7: each budget line keyed on fund and org, with its codes read by the view's forms and its amount as written", async () => {
  const r = budgetTable.parse(ctxFor(await csvSupplied(fixture("fy2013-15-adopted.csv")), FIRST, { content_type: "text/csv" }));
  assert.ok(r.rows.length > 500);
  const row = r.rows[0];
  assert.deepEqual(Object.keys(row).sort(), ["account", "amount", "department", "department_code", "fund", "key", "org",
    "period_as_written", "phase_as_written", "program", "project", "source"]);
  assert.deepEqual(row.fund, { as_written: "1010", form: String.raw`^\d{4}$`, scheme: "oakland_fund" });
  assert.equal(row.org.as_written, "11");
  assert.equal(row.period_as_written, "FY13-14");
  assert.deepEqual(row.amount, { value: "84669", type: "text", declared: null,
    source: { kind: "sheet-cell", ref: "csv!P2", sheet: "csv", cell: "P2" } });
  assert.equal(row.key, "1010|11|IP52|0000000|51111|FY13-14|");
  /* Every row has a fund and an org; a code no form matches is kept as written, with why. */
  assert.ok(r.rows.every((x) => x.fund && x.org));
  const odd = r.codes.filter((c) => c.form === null);
  assert.ok(odd.length >= 1);
  const COLUMNS_OF_CODE = ["fund", "org", "program", "project", "account", "department_code"];
  for (const c of odd) {
    assert.equal(typeof c.as_written, "string");
    const column = COLUMNS_OF_CODE.find((col) => r.rows.some((x) => x[col] && x[col].as_written === c.as_written && x[col].form === null));
    assert.equal(c.why, localize("budget-doctypes.lines.no_form_of_the_views", "no form of the view's {column} classification matches \"{s}\"", { column, s: c.as_written.trim() }));
  }
  /* A wide table: each amount column's header is that amount's period and phase. */
  const w = budgetTable.parse(ctxFor(await csvSupplied(fixture("fy2019-21-adopted.csv")), FIRST, { content_type: "text/csv" }));
  const first = w.rows.filter((x) => x.source.ref === "csv!G2");
  assert.deepEqual(first.map((x) => x.period_as_written),
    ["fy17_18_actuals_final_year", "fy18_19_midcycle_adopted", "fy18_19_midcycle_adopted_2", "fy19_20_biennial_working",
     "fy19_20_biennial_working_2", "fy20_21_biennial_working", "fy20_21_biennial_working_2"]);
  assert.deepEqual(first.map((x) => x.amount.value), ["1189208", "1223918", "1223918", "1381102", "1381102", "1404664", "1404664"]);
});

test("R7: test profile: codes by its forms, a row with no fund or org unread, a code of no form stated, a sheet without cells unread", async () => {
  const csv = "Ledger,Cost Centre,Service,Service Code,Works Order,Nominal,Year,Stage,Sum\n"
    + "100-01,CC1001,Harbour Works,DV01,WO-1234,5100,Year 2025/26,approved,\"* 5,632,522\"\n"
    + "100-01,,Harbour Works,DV01,WO-1234,5100,Year 2025/26,approved,10\n"
    + "300-01,CC1002,Harbour Works,DV1,WO12,5200,Year 2025/26,approved,(12)\n";
  const r = budgetTable.parse(ctxFor(await csvSupplied(csv), TESTV, { content_type: "text/csv" }));
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].amount.value, "* 5,632,522");
  assert.equal(r.rows[0].phase_as_written, "approved");
  /* A code the scheme lists, and a code of a form it holds. */
  assert.deepEqual(r.rows[0].fund, { as_written: "100-01", form: "code 100-01", scheme: "ellery_funds" });
  assert.deepEqual(r.rows[0].project, { as_written: "WO-1234", form: String.raw`^WO-?\d{4}$`, scheme: "ellery_works" });
  /* A code no form matches, and a code of a kind the view holds no form for. */
  assert.equal(r.rows[1].fund.form, null); assert.equal(r.rows[1].fund.why, localize("budget-doctypes.lines.no_form_of_the_views", "no form of the view's {column} classification matches \"{s}\"", { column: "fund", s: r.rows[1].fund.as_written.trim() }));
  assert.equal(r.rows[1].project.form, null); assert.equal(r.rows[1].project.why, localize("budget-doctypes.lines.no_form_of_the_views", "no form of the view's {column} classification matches \"{s}\"", { column: "project", s: r.rows[1].project.as_written.trim() }));
  assert.equal(r.rows[0].department_code.form, null); assert.equal(r.rows[0].department_code.why, localize("budget-doctypes.lines.the_view_holds_no_form", "the view holds no form for a {column} code", { column: "department_code" }));
  assert.equal(r.unread.length, 1);
  assert.equal(r.unread[0].why, localize("budget-doctypes.lines.the_row_holds_no_org_code", "the row holds no org code"));
  assert.deepEqual(r.unread[0].source, { kind: "sheet-cell", ref: "csv!A3", sheet: "csv", cell: "A3" });
  const bare = budgetTable.parse(ctxFor(await csvSupplied(csv, { cells: false }), TESTV, { content_type: "text/csv" }));
  assert.equal(bare.rows.length, 0);
  assert.equal(bare.unread[0].why, localize("budget-doctypes.lines.the_sheet_s_typed_cells", "the sheet's typed cells (office-readers R30) were not supplied: its tab-joined text drops an empty cell, so no value could be placed in its column"));
});

// ---------------------------------------------------------------- R8

test("R8: departments are groupings per period of the org codes placed under them, never carried or merged across periods", async () => {
  const csv = "Ledger,Cost Centre,Service,Nominal,Year,Sum\n"
    + "100-01,CC1001,Harbour Works,5100,Year 2024/25,1\n"
    + "100-01,CC1002,Harbour Works,5100,Year 2024/25,2\n"
    + "100-01,CC1001,Harbour Works,5100,Year 2025/26,3\n"
    + "100-01,CC1002,Port Services,5100,Year 2025/26,4\n";
  const r = budgetTable.parse(ctxFor(await csvSupplied(csv), TESTV, { content_type: "text/csv" }));
  assert.deepEqual(r.groupings, [
    { department: "Harbour Works", department_code: null, period_as_written: "Year 2024/25", orgs: ["CC1001", "CC1002"] },
    { department: "Harbour Works", department_code: null, period_as_written: "Year 2025/26", orgs: ["CC1001"] },
    { department: "Port Services", department_code: null, period_as_written: "Year 2025/26", orgs: ["CC1002"] },
  ]);
});

// ---------------------------------------------------------------- R9

function events(m) { return m.events.map((e) => e.type); }

test("R9: two PDF readings compared by table and row: a figure changed, a row and a table added or gone, all from the catalogue", () => {
  const before = financialReport.parse(ctxFor(testPdf([COVER, STATEMENT]), TESTV));
  const same = financialReport.assess(before, financialReport.parse(ctxFor(testPdf([COVER, STATEMENT]), TESTV)));
  assert.deepEqual(same.events, []); assert.equal(same.meaningful, false); assert.equal(same.confirmed.kind, "rows_unchanged");
  const changed = STATEMENT.replace("Cash on hand 1,200 300 1,500", "Cash on hand 1,250 300 1,550")
    .replace("Land 600 — 600\n", "");
  const after = financialReport.parse(ctxFor(testPdf([COVER, changed]), TESTV));
  const m = financialReport.assess(before, after);
  const oc = m.events.filter((e) => e.type === "outcome_changed");
  assert.deepEqual(oc.map((e) => [e.table, e.row, e.column, e.before, e.after]), [
    ["Harbour Revenue Account @ page 2", "Cash on hand", 1, "1,200", "1,250"],
    ["Harbour Revenue Account @ page 2", "Cash on hand", 3, "1,500", "1,550"]]);
  assert.ok(m.events.some((e) => e.type === "delisted" && e.row === "Land"));
  assert.equal(m.meaningful, true);
  const plus = financialReport.parse(ctxFor(testPdf([COVER, STATEMENT, "Exhibit D\nGeneral Total\nBonds 1 2 3\nNotes 4 5 6"]), TESTV));
  const m2 = financialReport.assess(before, plus);
  assert.deepEqual(events(m2), ["item_added"]); assert.equal(m2.events[0].table, "Exhibit D @ page 3");
  assert.deepEqual(events(financialReport.assess(plus, before)), ["delisted"]);
  const rowAdded = financialReport.parse(ctxFor(testPdf([COVER, STATEMENT.replace("Land 600", "Vessels 5 — 5\nLand 600")]), TESTV));
  assert.deepEqual(events(financialReport.assess(before, rowAdded)), ["item_added"]);
  for (const e of [...m.events, ...m2.events]) assert.ok(Object.hasOwn(EVENTS, e.type));
});

test("R9: a reading in which no table was read is a failed read, never a document emptied", () => {
  const before = financialReport.parse(ctxFor(testPdf([COVER, STATEMENT]), TESTV));
  const empty = financialReport.parse(ctxFor(testPdf([COVER, ""]), TESTV));
  assert.equal(empty.tables.length, 0); assert.equal(empty.why, localize("budget-doctypes.index.no_table_was_read_no", "no table was read: no run of rows with two or more figures was found in the text read"));
  const LATER = localize("budget-doctypes.assess.no_table_was_read_in", "no table was read in the {v1} reading: a failed read, not a document emptied", { v1: "later" });
  const EARLIER = localize("budget-doctypes.assess.no_table_was_read_in", "no table was read in the {v1} reading: a failed read, not a document emptied", { v1: "earlier" });
  const EITHER = localize("budget-doctypes.assess.no_table_was_read_in_either", "no table was read in either reading, so nothing can be compared");
  for (const [[a, b], want] of [[[before, empty], LATER], [[empty, before], EARLIER], [[empty, empty], EITHER]]) {
    const m = financialReport.assess(a, b);
    assert.equal(m.meaningful, null); assert.deepEqual(m.events, []); assert.equal(m.why, want);
  }
});

test("R9: two budget-table readings compared by R7's key: an amount changed, a line added or gone, an org moved within a period", async () => {
  const head = "Ledger,Cost Centre,Service,Nominal,Year,Sum\n";
  const a = head + "100-01,CC1001,Harbour Works,5100,Year 2025/26,1\n100-01,CC1002,Harbour Works,5100,Year 2025/26,2\n100-01,CC1003,Harbour Works,5100,Year 2025/26,3\n";
  const b = head + "100-01,CC1001,Harbour Works,5100,Year 2025/26,1\n100-01,CC1002,Port Services,5100,Year 2025/26,20\n100-01,CC1004,Harbour Works,5100,Year 2025/26,4\n";
  const read = async (csv) => budgetTable.parse(ctxFor(await csvSupplied(csv), TESTV, { content_type: "text/csv" }));
  const m = budgetTable.assess(await read(a), await read(b));
  assert.deepEqual(m.events.map((e) => e.type).sort(), ["delisted", "item_added", "item_changed", "outcome_changed"]);
  const oc = m.events.find((e) => e.type === "outcome_changed");
  assert.deepEqual([oc.row, oc.column, oc.before, oc.after], ["100-01|CC1002|||5100|Year 2025/26|", "amount", "2", "20"]);
  const ic = m.events.find((e) => e.type === "item_changed");
  assert.deepEqual([ic.org, ic.period_as_written, ic.before, ic.after], ["CC1002", "Year 2025/26", "Harbour Works", "Port Services"]);
  assert.equal(m.meaningful, true);
  assert.equal(m.confirmed.count, 1);
  /* A department renamed in a later period is not a move: periods are never merged. */
  const c = head + "100-01,CC1001,Harbour Works,5100,Year 2026/27,1\n";
  assert.ok(!budgetTable.assess(await read(a), await read(a + c.slice(head.length))).events.some((e) => e.type === "item_changed"));
  const none = await read(head);
  const f = budgetTable.assess(await read(a), none);
  assert.equal(f.meaningful, null); assert.equal(f.why, localize("budget-doctypes.assess.no_budget_line_was_read", "no budget line was read in the {v1} reading: a failed read, not a table emptied", { v1: "later" }));
});

// ---------------------------------------------------------------- R10, R11, R12

test("R10: reading writes nothing: parse leaves its inputs as they were and gives the same reading twice", async () => {
  const { supplied } = pdfFixture("bb23");
  const ctx = ctxFor(supplied, FIRST);
  const snapshot = JSON.stringify(supplied);
  const one = budgetBook.parse(ctx), two = budgetBook.parse(ctx);
  assert.equal(JSON.stringify(supplied), snapshot);
  assert.deepEqual(one, two);
  const sheet = await csvSupplied(fixture("fy2013-15-adopted.csv"));
  const s0 = JSON.stringify(sheet);
  budgetTable.parse(ctxFor(sheet, FIRST, { content_type: "text/csv" }));
  assert.equal(JSON.stringify(sheet), s0);
  /* No total, value or sign: a reading carries figures as printed, nothing computed. */
  for (const t of one.tables) for (const r of t.rows) for (const c of r.cells) assert.deepEqual(Object.keys(c), ["as_read"]);
  assert.ok(one.tables.every((t) => !("total" in t)));
});

test("R11: every figure given is as printed: each cell is a token of the line it was read from", () => {
  for (const [key, type] of [["a24", financialReport], ["a14", financialReport], ["a19", financialReport], ["bb23", budgetBook]]) {
    const { supplied } = pdfFixture(key);
    const r = type.parse(ctxFor(supplied, FIRST));
    const text = supplied.document.replace(/[ \t]+/g, " ");
    for (const t of r.tables) for (const row of t.rows) for (const c of row.cells)
      assert.ok(text.includes(c.as_read), `${key} p${t.page + 1}: ${c.as_read}`);
    /* Nothing read from an image other than through R6: no table on an image-only page. */
    assert.ok(r.tables.every((t) => t.method === "text-layer"));
  }
});

test("R12: pure, and every title, heading, header word and code form is the view's", async () => {
  const realDate = Date, realFetch = globalThis.fetch;
  globalThis.Date = class extends realDate { constructor() { throw new Error("clock read"); } static now() { throw new Error("clock read"); } };
  globalThis.fetch = () => { throw new Error("network used"); };
  try {
    const ctx = ctxFor(pdfFixture("a24").supplied, FIRST);
    financialReport.detect(ctx); financialReport.parse(ctx);
    const s = ctxFor(await csvSupplied(fixture("fy2013-15-adopted.csv")), FIRST, { content_type: "text/csv" });
    budgetTable.detect(s); budgetTable.parse(s);
  } finally { globalThis.Date = realDate; globalThis.fetch = realFetch; }
  /* The test profile's words read the test profile's documents, and not the first profile's. */
  const t = ctxFor(testPdf([COVER, STATEMENT + "\n" + "Spare 1 2 3\n".repeat(10)]), TESTV);
  assert.equal(financialReport.detect(t).match, true);
  assert.equal(financialReport.detect({ ...t, view: FIRST }).match, false);
  assert.equal(financialReport.detect(ctxFor(pdfFixture("a24").supplied, TESTV)).match, false);
  /* Headings: the title is the view's heading; with no heading in the view, none. */
  const u = ctxFor(testPdf([COVER, STATEMENT.replace("Exhibit A\n", "")]), TESTV);
  assert.equal(financialReport.parse(u).tables[0].title, "Harbour Revenue Account");
  const noHeadings = { ...TESTV, vocabulary: { ...TESTV.vocabulary, financial_headings: [] } };
  const [untitled] = financialReport.parse({ ...u, view: noHeadings }).tables;
  assert.equal(untitled.title, null); assert.equal(untitled.title_why, localize("budget-doctypes.tables.no_heading_the_view", "no heading the view names, and no table caption, was read above or below the table"));
  /* Header words and code forms: with none in the view, no line is read. */
  const csv = "Ledger,Cost Centre,Nominal,Year,Sum\n100-01,CC1001,5100,Year 2025/26,1\n";
  const sheet = await csvSupplied(csv);
  assert.equal(budgetTable.parse(ctxFor(sheet, TESTV, { content_type: "text/csv" })).rows.length, 1);
  const bare = { ...TESTV, vocabulary: { ...TESTV.vocabulary, budget_headers: [] }, classification_schemes: [] };
  assert.equal(budgetTable.detect(ctxFor(sheet, bare, { content_type: "text/csv" })).match, false);
  const noForms = { ...TESTV, classification_schemes: [] };
  const r = budgetTable.parse(ctxFor(sheet, noForms, { content_type: "text/csv" }));
  assert.equal(r.rows[0].fund.form, null); assert.equal(r.rows[0].fund.why, localize("budget-doctypes.lines.the_view_holds_no_form", "the view holds no form for a {column} code", { column: "fund" }));
});

// ---------------------------------------------------------------- R13

test("R13: the ACFR FY2014 and FY2024 tables are usable at the measured shares", () => {
  const want = { a14: [46, 48, 148, 167, 169], a24: [49, 51, 179, 204, 212] };
  for (const [key, pages] of Object.entries(want)) {
    const r = readPdf(key, financialReport);
    for (const p of pages) {
      const ts = onPage(r, p);
      assert.ok(ts.length >= 1, `${key} p${p}`);
      for (const t of ts) { assert.equal(t.usable, true, `${key} p${p}: ${t.why}`); assert.ok(t.modal_share >= 0.85); }
    }
  }
  /* The same pages in tier 1's cell-per-line layout. */
  const t1 = readPdf("a24", financialReport, { tier1: true });
  for (const p of [49, 204, 212]) for (const t of onPage(t1, p)) assert.equal(t.usable, true, `tier 1 p${p}: ${t.why}`);
});

test("R13: Statistical Schedule 1 of FY2024: each subtotal row's figures read in their columns (QUESTION J2)", () => {
  for (const tier1 of [false, true]) {
    const [s1] = onPage(readPdf("a24", financialReport, { tier1 }), 204);
    assert.equal(s1.title, "SCHEDULE 1");
    assert.equal(s1.scale, "in thousands");
    const totals = s1.rows.filter((x) => x.label && /^Total net position/.test(x.label));
    assert.equal(totals.length, 3);
    for (const t of totals) { assert.equal(t.cells.length, 10); assert.equal(t.span, false); }
    assert.deepEqual(totals[0].cells.map((c) => c.as_read)[0], "$ (268,759)");
  }
});

test("R13: the budget book's pages 196, 241 and 283 are usable, 148 read with its chart labels skipped, 17 unread", () => {
  const r = readPdf("bb23", budgetBook);
  for (const p of [196, 241, 283, 148]) {
    const ts = onPage(r, p);
    assert.equal(ts.length, 1, `p${p}`);
    assert.equal(ts[0].usable, true, `p${p}: ${ts[0].why}`);
  }
  assert.equal(r.skipped.filter((s) => s.page === 147).length, 9);
  assert.deepEqual(r.unread.map((u) => u.page), [16]);
  /* A heading whose "fi" ligature the text layer left undecoded still matches,
     and is given as read. */
  assert.equal(onPage(r, 196)[0].title, "Citywide Classi\u0000cation Summary");
});

test("R13: on the 200-figure fixture, every figure's as_read appears exactly in its table's cell", () => {
  const lines = readFileSync(fixture("m-m1-figures.csv"), "utf8").trim().split("\n").slice(1);
  const field = (l) => { const f = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { f.push(cur); cur = ""; } else cur += ch; } f.push(cur); return f; };
  const docs = { A24: ["a24", financialReport], A19: ["a19", financialReport], BB23: ["bb23", budgetBook] };
  const readings = {};
  let n = 0;
  for (const l of lines) {
    const [id, doc, page, label, column, asRead] = field(l);
    const [key, type] = docs[doc];
    readings[key] = readings[key] || readPdf(key, type);
    const r = readings[key];
    const ts = onPage(r, Number(page));
    const inLabel = column.startsWith("(figure inside row label)");
    const found = inLabel
      ? ts.some((t) => t.rows.some((x) => x.label && x.label.includes(asRead)))
      : ts.some((t) => t.rows.some((x) => x.cells.some((c) => c.as_read === asRead)))
        || r.skipped.some((s) => s.page === Number(page) - 1 && s.lines.some((s2) => s2.includes(asRead)) && /chart label/.test(column));
    assert.ok(found, `${id} ${doc} p${page} ${label}: ${asRead}`);
    n++;
  }
  assert.equal(n, 200);
});

test("R13: a budget line-item table of each of two cycles gives its departments' groupings per period", async () => {
  const r13 = budgetTable.parse(ctxFor(await csvSupplied(fixture("fy2013-15-adopted.csv")), FIRST, { content_type: "text/csv" }));
  const periods13 = [...new Set(r13.groupings.map((g) => g.period_as_written))].sort();
  assert.deepEqual(periods13, ["FY13-14", "FY14-15"]);
  const council13 = r13.groupings.filter((g) => g.department === "City Council");
  assert.equal(council13.length, 2);
  assert.ok(council13.every((g) => g.orgs.includes("11")));
  const r19 = budgetTable.parse(ctxFor(await csvSupplied(fixture("fy2019-21-adopted.csv")), FIRST, { content_type: "text/csv" }));
  const mayor19 = r19.groupings.filter((g) => g.department === "DP010 - Mayor");
  assert.ok(mayor19.length >= 5);
  assert.ok(mayor19.every((g) => g.orgs.every((o) => /^OR_\d{5}$/.test(o))));
  /* One grouping per department and period: never merged across periods. */
  const keys = r19.groupings.map((g) => JSON.stringify([g.department, g.period_as_written]));
  assert.equal(new Set(keys).size, keys.length);
});

// ---------------------------------------------------------------- R14

test("R14: every no says which kind of no and why", async () => {
  const nos = [];
  for (const t of BUDGET_TYPES) nos.push(t.detect(ctxFor("plain", FIRST)));
  for (const d of nos) { assert.equal(d.match, false); assert.ok(typeof d.why === "string" && d.why.length > 10); }
  const book = readPdf("bb23", budgetBook);
  for (const u of [...book.unread, ...book.pages_unread, ...book.skipped]) assert.ok(u.why.length > 10);
  for (const key of ["a24", "a14"]) for (const t of readPdf(key, financialReport).tables) {
    if (!t.usable) assert.ok(t.why);
    if (!t.title) assert.ok(t.title_why);
    if (!t.period_as_written) assert.ok(t.period_why);
    for (const r of t.rows) if (r.label === null) assert.ok(r.label_why);
  }
  const lines = budgetTable.parse(ctxFor(await csvSupplied(fixture("fy2013-15-adopted.csv")), FIRST, { content_type: "text/csv" }));
  for (const c of lines.codes) if (c.form === null) assert.ok(c.why);
  assert.equal(budgetTable.parse(ctxFor({ document: "x" }, FIRST)).unread[0].why, localize("budget-doctypes.lines.no_sheet_was_supplied", "no sheet was supplied with this text, so no budget line could be read"));
  const empty = financialReport.parse(ctxFor(testPdf([COVER]), TESTV));
  assert.equal(empty.why, localize("budget-doctypes.index.no_table_was_read_no", "no table was read: no run of rows with two or more figures was found in the text read"));
});
