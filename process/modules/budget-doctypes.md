Length: 64 lines. Last section: "Suggestions".

# budget-doctypes: requirements

Next number: 15

**Size (P6).** About 1,000–1,500 lines with tests.

## Public

### Purpose

Reads a government's financial documents as tables: annual comprehensive financial reports (ACFRs) from their PDF text layer, budget books with their chart labels set aside and their image-only tables read through the OCR path or marked unread, and budget line-item tables published as CSV or workbooks. Each table keeps every figure exactly as printed, with the scale its heading states. Budget lines are keyed on fund and org codes, and a department is a grouping of orgs dated to the budget that states it. Reading is not extraction: nothing is written to the record.

### Provides

**Three content types, `{key, label, version, contract: SUBSTANCE, detect(ctx), parse(ctx), assess(before, after, ctx)}`**, registered through `docprofile`'s registry seam (`registerBudgetTypes(register)`), after `court-doctypes`' types and before `generic`. Keys: `financial_report`, `budget_book`, `budget_table`. `ctx` is `docprofile`'s.
- **R1** [met] `financial_report` and `budget_book` match at CERTAIN only a PDF whose text states the document's own title words from the view (`jurisdictions` vocabulary under this module's keys: report titles, statement and schedule headings, fiscal-year forms) and holds at least a floor of figure rows (a measured structural floor, in code). `budget_table` matches a CSV or workbook sheet whose header names, by the view's header words, at least a fund or org column and an amount column. Anything else does not match, with why.

**Tables: what `parse` gives for a PDF, `{tables, unread, skipped, pages_read, pages_unread}`**
- **R2** [met] Each table is `{title, page, period_as_written, scale, columns, rows, usable, modal_share, why, method}`. `scale` is the scale the table's heading states ("in thousands") or `null`, and it is never applied to a cell. `columns` are the header labels as written. Each row is `{label, cells, span, source}`, each cell the figure exactly as printed (`as_read`: a dash, parentheses and a leading minus kept), `source` from `ctx.locate`. No figure is parsed, scaled, signed or totalled here.
- **R3** [met] A label wrapped over several lines is merged into its row's one label. A dash standing for zero counts as a cell. A subtotal row whose figures span columns is kept with `span: true` and its cells unplaced, never forced into columns. A table is `usable` when at least 85% of its rows holding two or more figures have the table's modal number of cells and its headers are in the text read; otherwise `usable: false`, with `modal_share` and `why`.
- **R4** [met] `financial_report` reads only the PDF's text layer (`method: "text-layer"`). A page with no text layer (a cover, a divider, a certificate, an organisation chart) is listed in `pages_unread` with why, and no table is read from it.
- **R5** [met] `budget_book` sets aside the chart-label block a rendered page prints above a table's header row, lines that pair a label with an amount and a parenthesised share. They are listed in `skipped` with their page and why ("chart labels"), and are never read as rows. A parenthesised percentage is never read as a negative figure.
- **R6** [met] A table printed as an image (a page with no text layer, or a region the PDF reader marks `image_unread`) is read only from an OCR transcription of that page that the supplied text carries, and is then marked `method: "ocr"` with the transcription's engine. With no such transcription it is listed in `unread` as `{page, rect, why: "image-only table, not read"}`, never as an empty table and never as a table with no figures.

**Budget lines: what `parse` gives for a `budget_table`, `{rows, codes, groupings, unread}`**
- **R7** [met] Each row is `{fund, org, department, program, project, account, period_as_written, phase_as_written, amount, source}`, with the columns named by the view's header words; each code is read by the forms of the view's classification scheme (`fund`, `org`, `program`, `project`, `account`), and kept as written with `form: null` and why when no form matches. `amount` is the cell as written (`office-readers`' typed cell value). A row is keyed on its fund and org codes with its account, period and phase; a row with no fund or org code is listed in `unread` with why.
- **R8** [met] `groupings` lists each department as the table states it for one period: `{department, department_code, period_as_written, orgs}`, `orgs` the org codes the table's rows place under it. A department is never carried from one period to another, and two periods' groupings are never merged by name.

**`assess(before, after, ctx)`**
- **R9** [met] It compares two readings with events from `site-profiles`' catalogue only. For a PDF, tables are matched by title and page; for a `budget_table`, rows by R7's key. A figure changed in a held row gives `outcome_changed`, naming the table or row, the column and both figures as printed; a row or table added gives `item_added`, and one gone `delisted`; an org moving between departments within one period gives `item_changed`. A reading in which no table was read is a failed read, stated, never a document emptied.

## Private

### Uses

- `docprofile`: the registry seam (`register`), `CONTRACT`, `CONFIDENCE`, `entity`, `diffEntities`, the reader view, `readText`'s `ctx.locate` and the supplied text's pages and `undetermined` markers; through it `site-profiles`' event catalogue.
- `pdf-reader`: the text layer per page (R2's `text`), `no_text_layer` (R14) and the `image_unread` markers (R34).
- `office-readers`: typed cells for CSV and xlsx sheets (R30).
- `jurisdictions` (through the view): title, heading and header words, fiscal-year forms, and the classification scheme's code forms, under this module's keys (T33-2: "classification and identifier schemes per site").
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R10** [met] Reading is not extraction: this module writes nothing. A figure becomes a money fact only through `calculations`' ingest at a member's request (K1468), and a total is a calculation (K1471), never a reading.
- **R11** [met] Every figure given is as printed: no figure is inferred, corrected, scaled, rounded or completed. Nothing is read from an image except through R6.
- **R12** [met] Pure over its inputs: no store, no network, no clock. No place is named in code. A publishing system's own page shapes (a rendered budget page's chart-label block) stay in code; titles, headings, header words and code forms come from the view. Tests use the test profile and the first profile.
- **R13** [met] Tested on the measured documents (`measures-T33/money-people.md` §7): the ACFR FY2014 and FY2024 tables usable at the measured shares, Statistical Schedule 1 of FY2024 read usable, each subtotal row's ten figures in its ten columns and none marked `span` (R3's `span` tested on a test-profile table where a total row holds a different number of cells; FY2014's Balance Sheet, page 48, read usable with its total row in its columns; K1520, K1523); the budget book's pages 196, 241 and 283 usable, page 148's table read with its chart labels in `skipped`, and page 17 listed `unread`. On the 200-figure fixture (§4), every figure's `as_read` appears exactly in its table's cell. A budget line-item table of each of two cycles gives its departments' groupings per period (`legistar-events.md` §3).
- **R14** [met] Every "no" (no match, no table, a table not usable, an image not read, a code of no form) says which kind of no and why.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §8.2 B1, B2, B3, D3, C4; §8.5 L4 (budget and financial-report readers; Fiscal Data Package classifications and plan or actual phase; fund and program joins through identifiers), and its realism note (ACFRs stay PDFs; figures from PDFs).
- Plan T33, "Measured GO (K1506)" and entry T33-17; rulings K1468, K1471, K1506.
- `build/layers.md`, "No jurisdiction in the product".

### Suggestions

- **Figure values.** `calc-grammar.parseFigure` is earlier in layer 1 and would give each cell's exact value, sign and precision. The plan's `uses` for this module do not name it, so the caller (`calculations`) parses. Adding the edge is BOB's (K1505 (7)).
- **The OCR path** (R6): the plane's text chain already routes a page with no text layer to `ocr-worker`. How a reader tells an OCR transcription of a page from a text layer in the supplied text (the I2 source of an OCR region, `space: "image-px"`, or a text-chain step of kind `ocr`) is for BOB to fix at the job's START. M-55 found OCR not needed for T33's measured documents, so R6's OCR arm may stay untested on real pages until one is captured.
- **For `calculations`**: a table from R2 becomes a declared table only by a member's declaration (calculations R1–R2). `phase_as_written` (adopted, proposed, actual) is mapped to `money`'s phase there, not here.
- Fiscal periods as written ("FY2023-24", "2023-25 Adopted") are read into periods by `civil-time` at the caller.
- Groupings (R8) come only from line-item tables with codes, the published ones covering FY2013–21. The FY25-27 budget book prints no org codes, so its departments stay names in its tables' labels.
