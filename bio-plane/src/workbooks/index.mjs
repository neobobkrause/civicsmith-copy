/* workbooks — the second engine of the calculation (requirements: `build/requirements/workbooks.md`). A member's own
 * spreadsheet analysis held in the record: its input cells bound, cell for cell, to captured sources; its formulas
 * recomputed by the instance's pinned engine (`sheet-worker`, through `ctx.recompute`) and compared with the file's
 * cached values, which is agreement between two engines, never accuracy; linted; carrying a method note and,
 * optionally, a second member's check. A recipe calculation can be exported to XLSX. Nothing here is a gate (R16): no
 * act of any module waits on, or is refused for, anything this module holds.
 *
 * REACHED as `workbooksOf(ctx, deps)`: one instance per host (the Durable Object's storage), made on the first call.
 * At creation it creates and declares its tables (R18). `ctx.recompute(captureSha)` is the plane's call to the
 * `SHEET_WORKER` binding; absent, a recompute records "not recomputed here: no engine bound" (R7).
 * `deps`:
 *   record, membership     record-core and membership on the same host unless a test passes its own.
 *   provenance             whether a capture is held, its home, its origin and its capture grade (R1, R12, R13).
 *   content                a cited figure's extent: its sight, its text and its capture (R3, R4, R12, R13).
 *   calculations           `readTable` and `read` (R3, R4, R12, R14), read through one adapter each.
 *   bytesOf(sha)           a capture's bytes (default: the record's evidence store).
 *   now                    the module's clock, an ISO instant (default: the wall clock). */

import { recordOf } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { xlsxEntry, rangeUnitFor, a1Corner } from "../formats-xlsx.mjs";
import { ENGINE_NAME, ENGINE_VERSION } from "../../../sheet-worker/src/contract.mjs";
import { WORKBOOKS_TABLES, migrateWorkbooks } from "./schema.mjs";
import { GRID, cellAt, cellName, splitRange, cellValue, sourceValue, sameValue, closeNumbers } from "./cells.mjs";
import { indexWorkbook, inputCells, lintFindings, LINT_KINDS } from "./lint.mjs";
import { buildExport } from "./export.mjs";
import { XLSX_CONTENT_TYPE, XLSX_MAX_COLUMNS } from "./xlsxwrite.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf, statement } from "../read-bounds.mjs";

export { WORKBOOKS_SCHEMA, WORKBOOKS_TABLES } from "./schema.mjs";
export { LINT_KINDS } from "./lint.mjs";
export { COMPUTED_LABEL, FORMULA_LABEL } from "./export.mjs";
export { workbooksOps, WORKBOOKS_OPS } from "./ops.mjs";

export const RECOMPUTE_STATUSES = Object.freeze(["agrees", "differs", "partial", word("workbooks.recomputed")]);
export const CHECK_OUTCOMES = Object.freeze(["agrees", "disagrees", "could_not_check"]);
export const NOT_RECOMPUTED = word("workbooks.recomputed");
/** R1, R20 (G44, G137e; K1881, K4662, K4835 (1)): the add's bounds, each a `READ_BOUNDS` row (BOB's figures). A capture
 *  stored above `WORKBOOK_FILE_MAX_BYTES` is refused before any byte loads; a workbook's cells are listed only while
 *  their JSON is within `WORKBOOK_CELLS_MAX_BYTES`, and a workbook of more than `WORKBOOK_CELLS_MAX` cells is refused,
 *  so the whole lifecycle (add, read, lint, inputs, recompute) survives the Durable Object's memory (measured). */
export const WORKBOOK_FILE_MAX_BYTES = boundOf("workbook", "bytes");
export const WORKBOOK_CELLS_MAX_BYTES = boundOf("workbook", "cells_json_bytes");
export const WORKBOOK_CELLS_MAX = boundOf("workbook", "cells");
/** F1 (T53; runtime-limits R37): an xlsx whose declared text (its sheets and shared strings, summed from the central
 *  directory) is over this row is refused as WORKBOOK_FILE_TOO_LARGE with condition `declared_text`, stated on this row. */
export const WORKBOOK_DECLARED_TEXT_MAX = boundOf("xlsx", "declared_text");
/** R6: how many cells each recorded list keeps; the counts are always whole, and a cut list says how many it left. */
export const LIST_MAX = 2000;
/** R8: the meaning every recompute statement carries. */
export const RECOMPUTE_MEANING = word("workbooks.agreement_between_file");
/** R8: the engine's measured agreement on the corpus, as `sheet-worker`'s job recorded it (T33-18, K1531), for the
 *  engine build it was measured on. Another build answers that it is not measured. */
export const ENGINE_MEASURE = Object.freeze({
  engine: ENGINE_NAME, engine_version: ENGINE_VERSION,
  corpus: "the 111 link-free corpus workbooks with formulas",
  cells: "98.85% of 200,551 cells", workbooks: "81 of 111 workbooks whole (73%)",
  within_bounds: { cells: "97.96% of 82,985 cells", workbooks: "73 of 99 workbooks whole (74%)" },
  recorded_by: "sheet-worker's job, T33 (K1531)",
});
/** R12: the derivation step every formula result carries, and its grade until the engine's measure is ruled enough. */
export const ENGINE_STEP = Object.freeze({ step: "third-party engine", grade: "undetermined" });

const GRADE_RANK = { A: 4, B: 3, C: 2, D: 1 };
const weaker = (a, b) => (!a ? b : !b ? a : (GRADE_RANK[a] || 0) <= (GRADE_RANK[b] || 0) ? a : b);
const SHA_RE = /^[0-9a-f]{64}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");
const json = (v) => JSON.stringify(v ?? null);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const refusal = (reason, detail, extra = {}) => ({ ok: false, reason, detail, ...extra });
const megabytes = (n) => (n / 1e6).toFixed(1);
/* R1: a capture or a file over its bound: `condition` says which bound fired, `stored_size` or `declared_text`; `row` is the
   `READ_BOUNDS` row the bound is (F1: a declared text over `xlsx.declared_text` is stated on that row; one under it that the
   reader will not hold whole is stated on the reader's own, `office.text_bytes`). */
const LIMIT_ROWS = Object.freeze({ stored_size: ["workbook", "bytes"], declared_text: ["office", "text_bytes"], xlsx_declared_text: ["xlsx", "declared_text"] });
const fileTooLarge = (size, bound, condition, row = condition) => refusal("WORKBOOK_FILE_TOO_LARGE",
  localize("refusal.WORKBOOK_FILE_TOO_LARGE", "This file is {size} MB, more than the {bound} MB that can be added as a workbook. The original is unchanged.",
           { size: megabytes(size), bound: megabytes(bound) }),
  { size: megabytes(size), bound: megabytes(bound), size_bytes: size, bound_bytes: bound, condition,
    limit: statement(...LIMIT_ROWS[row], size) });
/* R1, R2: a workbook of more cells than can be held and read; `condition` is `cell_count` or `cell_bytes`. */
const cellsTooLarge = (cells, condition, bound = WORKBOOK_CELLS_MAX) => refusal("WORKBOOK_TOO_LARGE",
  localize("refusal.WORKBOOK_TOO_LARGE", "This workbook has {cells} cells, more than the {bound_cells} that can be held and read here.",
           { cells: String(cells), bound_cells: String(bound) }),
  { cells, bound_cells: bound, condition, limit: { ...statement("workbook", "cells", cells), bound } });
/* R21: the cells the add did not keep, how many and why (one whose reference cannot be read, a repeat of an earlier cell's
   reference); present only when something was dropped. A row or cell with no `r` is placed by its position by the reader
   (office-readers R48) and held, so it is never counted here. */
const droppedStatement = (by, count) => ({ count, ...by,
  statement: localize("workbooks.cells_not_kept", "{count} cells were not kept: {unreadable} with a reference that cannot be read, {repeated} repeating an earlier cell's reference.",
                      { count: String(count), unreadable: String(by.unreadable), repeated: String(by.repeated) }) });
/* R22: a recipe whose export would lay out more cells than the workbook bound, or a table wider than a sheet (XFD). */
const exportTooLarge = (cells) => refusal("EXPORT_TOO_LARGE",
  localize("refusal.EXPORT_TOO_LARGE", "This calculation's tables would make a workbook of {cells} cells, more than the {bound_cells} that can be exported.",
           { cells: String(cells), bound_cells: String(WORKBOOK_CELLS_MAX) }),
  { cells, bound_cells: WORKBOOK_CELLS_MAX, limit: statement("workbook", "cells", cells) });
const exportTooWide = (columns) => refusal("EXPORT_TOO_WIDE",
  localize("refusal.EXPORT_TOO_WIDE", "A table of this calculation has {columns} columns, more than the {bound_columns} a spreadsheet sheet holds.",
           { columns: String(columns), bound_columns: String(XLSX_MAX_COLUMNS) }),
  { columns, bound_columns: XLSX_MAX_COLUMNS });
const cut = (list) => (list.length > LIST_MAX ? { list: list.slice(0, LIST_MAX), left: list.length - LIST_MAX } : { list, left: 0 });

/* The calculations contract, read through one adapter each (J1): a table `{sha, fields, rows, grade_facts}` or null;
   a calculation `{calc_id, question, period, recipe, method_version, result_key, inputs, results}` or null. */
export function tableFrom(answer) {
  if (!answer || answer.ok === false || answer.found === false) return null;
  const t = answer.table && typeof answer.table === "object" ? answer.table : answer;
  if (!Array.isArray(t.fields) || !Array.isArray(t.rows)) return null;
  return { sha: t.sha ?? null, fields: t.fields, rows: t.rows, row_count: Number.isInteger(answer.rows) ? answer.rows : null,
           grade_facts: t.grade_facts ?? answer.grade_facts ?? null };
}
export function calculationFrom(answer) {
  if (!answer || answer.ok === false || answer.found === false) return null;
  const c = answer.calculation && typeof answer.calculation === "object" ? answer.calculation : answer;
  return c && c.recipe && Array.isArray(c.inputs) ? c : null;
}

const instances = new WeakMap();

/** One instance per host (the Durable Object's storage). */
export function workbooksOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let w = instances.get(storage);
  if (!w) {
    w = new Workbooks({ storage, recompute: ctx && typeof ctx.recompute === "function" ? ctx.recompute : null, ...deps });
    instances.set(storage, w);
  }
  return w;
}

export class Workbooks {
  constructor({ storage, record, membership, provenance, content, calculations = null, recompute = null, bytesOf = null, now } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record || recordOf({ storage });
    this.membership = membership || membershipOf({ storage }, { record: this.record });
    this.provenance = provenance || (content && content.provenance) || null;
    this.content = content || null;
    this.calculations = calculations;
    this.engine = typeof recompute === "function" ? recompute : null;
    this.#ownBytes = typeof bytesOf !== "function";
    this.bytesOf = typeof bytesOf === "function" ? bytesOf : (sha) => this.#evidenceBytes(sha);
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    migrateWorkbooks(this.sql);
    const d = this.record.declareTable("workbooks", WORKBOOKS_TABLES);
    if (d && d.ok === false && d.reason !== "TABLE_DECLARED") throw new Error(`workbooks: ${d.reason}`);
  }

  #ownBytes = true;
  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  async #evidenceBytes(sha) {
    const store = this.record.evidenceStore && this.record.evidenceStore();
    if (!store) return null;
    const obj = await store.get(sha);
    return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
  }

  /* ---- sight (R13) ---- */

  #sees(bundleId, viewer) {
    if (!bundleId || typeof viewer !== "string" || !viewer) return false;
    try { return !!this.membership.inSight(bundleId, viewer); } catch { return false; }
  }

  #home(sha) {
    try { return this.provenance ? this.provenance.homeOf(sha) : null; } catch { return null; }
  }

  #captureSeen(sha, viewer) {
    const h = this.#home(sha);
    return !!h && this.#sees(h.bundleId, viewer);
  }

  /* R23: a table is read whole only by asking for it (`rows: "all"`); every other read (its sight, its grade facts, its
     shape) asks for one row. */
  async #readTable(sha, viewer, { all = false } = {}) {
    if (!this.calculations || typeof this.calculations.readTable !== "function") return null;
    try { return tableFrom(await this.calculations.readTable(all ? { sha, viewer, rows: "all" } : { sha, viewer, limit: 1 })); } catch { return null; }
  }

  #readExtent(id, viewer) {
    if (!this.content || typeof id !== "string" || !id) return null;
    try {
      const r = this.content.contentRead({ id, viewer });
      return r && r.ok ? r : null;
    } catch { return null; }
  }

  async #sourceSeen(input, viewer) {
    if (input && input.table) return !!(await this.#readTable(input.table, viewer));
    if (input && input.extent) return !!this.#readExtent(input.extent, viewer);
    return false;
  }

  /** R13: the workbook row, or null when it is absent or withheld: its project, its capture, or any source it is bound
   *  to, out of the viewer's sight. Every read and act answers both alike. */
  async #workbook(captureSha, project, viewer) {
    const sha = str(captureSha).toLowerCase(), p = str(project);
    if (!SHA_RE.test(sha) || !p) return null;
    const row = this.#one(`SELECT * FROM workbooks WHERE capture_sha=? AND project=?`, sha, p);
    if (!row || !this.#sees(p, viewer) || !this.#captureSeen(sha, viewer)) return null;
    for (const b of this.#rows(`SELECT input FROM workbook_bindings WHERE capture_sha=? AND project=?`, sha, p))
      if (!(await this.#sourceSeen(parse(b.input), viewer))) return null;
    return { ...row, period: parse(row.period), origin: parse(row.origin), facts: parse(row.facts) || {} };
  }

  #absent(captureSha, project) {
    return refusal("NO_SUCH_WORKBOOK", "no workbook is held for this capture in this project", {
      capture_sha: typeof captureSha === "string" ? captureSha : null, project: typeof project === "string" ? project : null });
  }

  /* R20: the workbook's cells are read from the store a cursor or a lookup at a time, never all at once: a workbook held
     whole at 250,000 cells would not fit the object as 250,000 rows of objects beside its readers. */
  #grid(wb) {
    const key = [wb.capture_sha, wb.project];
    const sql = this.sql;
    return {
      count: () => sql.exec(`SELECT COUNT(*) AS n FROM workbook_cells WHERE capture_sha=? AND project=?`, ...key).one().n,
      formulaCount: () => sql.exec(`SELECT COUNT(*) AS n FROM workbook_cells WHERE capture_sha=? AND project=? AND formula IS NOT NULL`, ...key).one().n,
      formulas: () => sql.exec(`SELECT sheet, cell, r, c, type, value, formula, cached FROM workbook_cells WHERE capture_sha=? AND project=? AND formula IS NOT NULL ORDER BY sheet, r, c`, ...key),
      errors: () => sql.exec(`SELECT sheet, cell, r, c, type, value, formula, cached FROM workbook_cells WHERE capture_sha=? AND project=? AND type='error' ORDER BY sheet, r, c`, ...key),
      at: (sheet, r, c) => { for (const x of sql.exec(`SELECT sheet, cell, r, c, type, value, formula, cached FROM workbook_cells WHERE capture_sha=? AND project=? AND sheet=? AND r=? AND c=?`, ...key, sheet, r, c)) return x; return null; },
      named: (sheet, cell) => { for (const x of sql.exec(`SELECT sheet, cell, r, c, type, value, formula, cached FROM workbook_cells WHERE capture_sha=? AND project=? AND sheet=? AND cell=?`, ...key, sheet, cell)) return x; return null; },
      extent: (sheet) => { for (const x of sql.exec(`SELECT MAX(r) AS rows, MAX(c) AS cols FROM workbook_cells WHERE capture_sha=? AND project=? AND sheet=?`, ...key, sheet)) return { rows: x.rows ?? 0, cols: x.cols ?? 0 }; return { rows: 0, cols: 0 }; },
      constantsIn: (sheet, r1, c1, r2, c2) => sql.exec(`SELECT sheet, cell, r, c, type, value, formula, cached FROM workbook_cells WHERE capture_sha=? AND project=? AND sheet=? AND r BETWEEN ? AND ? AND c BETWEEN ? AND ?
                                                          AND formula IS NULL AND value IS NOT NULL ORDER BY r, c`, ...key, sheet, r1, r2, c1, c2),
    };
  }

  /** R2 (R-OLD): the stored cells counted, not loaded; above the bound the read answers it stated, never a crash. */
  #tooLarge(wb) {
    const n = this.#grid(wb).count();
    return n > WORKBOOK_CELLS_MAX ? cellsTooLarge(n, "cell_count") : null;
  }

  /** R1: whether the capture is held and how big it is, from the evidence store's heads alone: the whole's, else the
   *  sum of the parts its home names. `held` null when the store cannot say; `size` null when it states none. */
  async #stored(sha, home) {
    const store = this.record.evidenceStore && this.record.evidenceStore();
    if (!store || typeof store.head !== "function") return { held: null, size: null };
    try {
      const h = await store.head(sha);
      if (h) return { held: true, size: Number.isFinite(Number(h.size)) ? Number(h.size) : null };
      let parts = null;
      try { const p = this.provenance.partsNamed(home.bundleId, sha); parts = p && p.state === "named" ? p.parts : null; } catch { parts = null; }
      const unknown = { held: this.#ownBytes ? false : null, size: null };
      if (!parts || !parts.length) return unknown;
      for (const p of parts) if (!(await store.head(p.sha256))) return unknown;
      return { held: true, size: parts.reduce((n, p) => n + p.bytes, 0) };
    } catch { return { held: null, size: null }; }
  }

  /* ================================================================ R1 */

  /** R1: hold a workbook. Refusals in order: NO_SHA, CAPTURE_NOT_HELD (by the store's head), NO_QUESTION, NO_PERIOD,
   *  NO_PROJECT, then a repeat (`already: true`), then the size and cell refusals: WORKBOOK_FILE_TOO_LARGE for a capture
   *  stored above `WORKBOOK_FILE_MAX_BYTES` (before any byte loads) or a file whose text the reader will not read,
   *  NOT_A_WORKBOOK, WORKBOOK_TOO_LARGE above `WORKBOOK_CELLS_MAX` cells. The cheap refusals pay no read. */
  async addWorkbook({ captureSha, question, period, project, by } = {}) {
    const sha = str(captureSha).toLowerCase();
    if (!SHA_RE.test(sha)) return refusal("NO_SHA", "a workbook is named by its capture's sha256, 64 hex characters");
    const home = this.#home(sha);
    const notHeld = () => refusal("CAPTURE_NOT_HELD", "no capture with this sha is held in this record");
    if (!home || !this.#sees(home.bundleId, by)) return notHeld();
    const stored = await this.#stored(sha, home);
    if (stored.held === false) return notHeld();
    if (!str(question)) return refusal("NO_QUESTION", "a workbook answers a question; state it");
    if (period === undefined || period === null || (typeof period === "string" && !period.trim())
        || (typeof period === "object" && !Object.values(period).some((v) => typeof v === "string" && v.trim())))
      return refusal("NO_PERIOD", "a workbook covers a period; state it");
    const p = str(project);
    const info = p ? this.record.bundleInfo(p) : null;
    if (!info || info.type !== "project" || !this.#sees(p, by)) return refusal("NO_PROJECT", "name a project this workbook is added to");
    if (this.#one(`SELECT 1 AS x FROM workbooks WHERE capture_sha=? AND project=?`, sha, p))
      return { ok: true, already: true, capture_sha: sha, project: p };
    if (stored.size !== null && stored.size > WORKBOOK_FILE_MAX_BYTES) return fileTooLarge(stored.size, WORKBOOK_FILE_MAX_BYTES, "stored_size");
    let bytes = null;
    try { bytes = await this.bytesOf(sha); } catch { bytes = null; }
    if (!bytes) return notHeld();
    let text, structure;
    try { text = await xlsxEntry.text(bytes, { inlineCellsMax: WORKBOOK_CELLS_MAX_BYTES }); } catch (e) { text = { ok: false, reason: `unreadable: ${e && e.message}` }; }
    const sheets = text && text.ok && Array.isArray(text.sheets) ? text.sheets : null;
    const marks = (sheets || []).flatMap((s) => s.undetermined || []).concat(text && Array.isArray(text.undetermined) ? text.undetermined : []);
    const guard = marks.find((m) => m && typeof m === "object" && m.why === "over_size_bound" && Number.isFinite(Number(m.size)) && Number.isFinite(Number(m.bound)));
    /* F1: the declared text the reader judged (over the streamed ceiling, or read in pieces), against the xlsx row first */
    const pieces = text && text.piecewise;
    const declaredMark = marks.find((m) => m && typeof m === "object" && m.why === "over_size_bound" && m.metric === "declared_uncompressed_text_part_bytes" && Number.isFinite(Number(m.size)));
    const declared = declaredMark ? Number(declaredMark.size) : pieces && Number.isFinite(Number(pieces.declared)) ? Number(pieces.declared) : null;
    if (declared !== null && declared > WORKBOOK_DECLARED_TEXT_MAX) return fileTooLarge(declared, WORKBOOK_DECLARED_TEXT_MAX, "declared_text", "xlsx_declared_text");
    if (guard) return fileTooLarge(Number(guard.size), Number(guard.bound), "declared_text");
    if (pieces && Number.isFinite(Number(pieces.declared)) && Number.isFinite(Number(pieces.bound)))
      return fileTooLarge(Number(pieces.declared), Number(pieces.bound), "declared_text");
    /* the reader counts the cells it would hold and refuses a sheet past its own bound (`TOO_MANY_OBJECTS` {n, bound}):
       to the member that is this module's refusal, stated with the count and the lower of the two bounds */
    const many = marks.find((m) => m && typeof m === "object" && m.why === "TOO_MANY_OBJECTS" && Number.isFinite(Number(m.n)) && Number(m.n) > WORKBOOK_CELLS_MAX);
    if (many) return cellsTooLarge(Number(many.n), "cell_count", Number.isFinite(Number(many.bound)) ? Math.min(Number(many.bound), WORKBOOK_CELLS_MAX) : WORKBOOK_CELLS_MAX);
    if (sheets && sheets.some((s) => s.cells === null && s.cells_held === true)) return cellsTooLarge(text.counts?.cells ?? 0, "cell_bytes");
    if (!sheets || !sheets.length || sheets.some((s) => !Array.isArray(s.cells))) {
      const why = !text || !text.ok ? text?.reason || "not an xlsx workbook"
        : marks.map((m) => (m && typeof m === "object" ? m.why || JSON.stringify(m) : String(m)))[0] || "no cells were read";
      return refusal("NOT_A_WORKBOOK", "office-readers gives no cells for this capture", { why });
    }
    const listed = sheets.reduce((n, s) => n + s.cells.length, 0);
    if (Math.max(listed, text.counts?.cells ?? 0) > WORKBOOK_CELLS_MAX) return cellsTooLarge(Math.max(listed, text.counts?.cells ?? 0), "cell_count");
    try { structure = await xlsxEntry.structure(bytes); } catch { structure = null; }
    const items = structure && structure.evidentiary && Array.isArray(structure.evidentiary.items) ? structure.evidentiary.items : [];
    const hidden_rows = {}, hidden_cols = {};
    for (const it of items) {
      if (it.kind === "hidden-rows") hidden_rows[it.sheet] = it.rows;
      if (it.kind === "hidden-cols") hidden_cols[it.sheet] = it.cols;
    }
    const names = {};
    for (const l of structure && Array.isArray(structure.links) ? structure.links : [])
      if (l.partition === "anchor" && l.target && l.target.definedName && typeof l.target.ref === "string") names[l.target.definedName] = l.target.ref;
    let origin = { bundle_id: home.bundleId, route: null, system: null };
    try { origin.route = this.provenance.captureGrade(sha)?.route ?? null; } catch { /* stated as null */ }
    try { origin.system = this.provenance.originOf(home.bundleId)?.system ?? null; } catch { /* stated as null */ }
    const facts = { sheets: sheets.map((s) => ({ name: s.name, hidden: !!s.hidden })), hidden_rows, hidden_cols, names };
    const at = this.now();
    const dropped = { unreadable: 0, repeated: 0 };
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO workbooks (capture_sha, project, question, period, origin, author, at, facts) VALUES (?,?,?,?,?,?,?,?)`,
                    sha, p, str(question), json(period), json(origin), by, at, json(facts));
      for (const s of sheets) {
        const placed = new Set();
        for (const c of s.cells) {
          const ref = c && c.source && typeof c.source.cell === "string" ? c.source.cell : null;
          const pos = ref ? cellAt(ref) : null;
          if (!pos) { dropped.unreadable++; continue; }
          const key = pos.row * 4294967296 + pos.col;
          if (placed.has(key)) { dropped.repeated++; continue; }
          placed.add(key);
          this.sql.exec(`INSERT OR IGNORE INTO workbook_cells (capture_sha, project, sheet, cell, r, c, type, value, formula, cached)
                       VALUES (?,?,?,?,?,?,?,?,?,?)`, sha, p, s.name, c.source.cell, pos.row, pos.col, c.type ?? null,
                       c.value ?? null, c.formula ?? null, c.cached ?? null);
        }
      }
      const lost = dropped.unreadable + dropped.repeated;
      return { ok: true, already: false, capture_sha: sha, project: p, question: str(question), period, origin, author: by, at,
               sheets: facts.sheets, ...(lost ? { dropped: droppedStatement(dropped, lost) } : {}) };
    });
  }

  /* ================================================================ R3, R4 */

  /* A source's grid: `{rows, cols, at(r, c) → {kind, value, figure?}}` or a refusal's detail. */
  async #source(input, viewer) {
    if (input && typeof input.table === "string") {
      const t = await this.#readTable(input.table, viewer, { all: true });
      if (!t || !Array.isArray(t.rows)) return { why: word("workbooks.why.declared_table_sha") };
      const r = splitRange(`x!${input.range ?? ""}`);
      const a = r && a1Corner(r.a), b = r && a1Corner(r.b);
      if (!a || !b) return { why: word("workbooks.why.table_range_table") };
      const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
      if (r2 > t.rows.length || c2 > t.fields.length) return { why: word("workbooks.why.range_lies_outside", { rows: String(t.rows.length), fields: String(t.fields.length) }) };
      return { kind: "table", table: t, rows: r2 - r1 + 1, cols: c2 - c1 + 1,
               at: (i, j) => { const f = t.fields[c1 - 1 + j]; return sourceValue(t.rows[r1 - 1 + i]?.[f.name], f.type); },
               label: (i, j) => `${input.table.slice(0, 12)}…!${cellName(r1 + i, c1 + j)}` };
    }
    if (input && typeof input.extent === "string") {
      const row = this.#readExtent(input.extent, viewer);
      if (!row) return { why: word("workbooks.why.content_extent_held") };
      let text = null;
      try { text = this.content.passageText(input.extent); } catch { text = null; }
      const v = text === null || text === undefined ? { kind: "empty", value: null } : sourceValue(String(text).trim(), "number");
      return { kind: "extent", row, rows: 1, cols: 1, at: () => v, label: () => input.extent };
    }
    return { why: "an input is {table, range} or {extent}" };
  }

  /** R3: bind a rectangle of input cells to a source. */
  async bind({ captureSha, project, range, input, by } = {}) {
    const wb = await this.#workbook(captureSha, project, by);
    if (!wb) return this.#absent(captureSha, project);
    const r = splitRange(range);
    const sheets = (wb.facts.sheets || []).map((s) => s.name);
    const a = r && a1Corner(r.a), b = r && a1Corner(r.b);
    const unit = a && b ? rangeUnitFor(r.sheet, a, b, sheets, GRID) : null;
    if (!unit || !unit.unit) return refusal("BAD_RANGE", "a binding is one rectangle on one sheet of the workbook, as Sheet!A1:B2",
                                            { why: unit?.why || "not a sheet-qualified A1 range" });
    const sheet = unit.unit.sheet, rect = unit.unit.range;
    const [ra, rb] = rect.split(":");
    const p1 = cellAt(ra), p2 = cellAt(rb ?? ra);
    const formulas = this.#rows(`SELECT cell FROM workbook_cells WHERE capture_sha=? AND project=? AND sheet=? AND formula IS NOT NULL
                                  AND r BETWEEN ? AND ? AND c BETWEEN ? AND ? ORDER BY r, c`,
                                wb.capture_sha, wb.project, sheet, p1.row, p2.row, p1.col, p2.col);
    if (formulas.length) return refusal("RANGE_HOLDS_FORMULAS", "an input is a constant, never a formula cell",
                                        { cells: formulas.map((x) => `${sheet}!${x.cell}`) });
    const src = await this.#source(input, by);
    if (src.why) return refusal("NO_SUCH_INPUT", src.why);
    const rows = p2.row - p1.row + 1, cols = p2.col - p1.col + 1;
    if (rows !== src.rows || cols !== src.cols)
      return refusal("SHAPE_MISMATCH", `the range is ${rows}×${cols} and the input ${src.rows}×${src.cols} (rows × columns)`);
    const stored = input.table ? { table: input.table, range: String(input.range).toUpperCase().replace(/\$/g, "") } : { extent: input.extent };
    const at = this.now();
    const row = this.record.transact(() => {
      this.sql.exec(`INSERT INTO workbook_bindings (capture_sha, project, sheet, range, input, bound_by, bound_at) VALUES (?,?,?,?,?,?,?)`,
                    wb.capture_sha, wb.project, sheet, rect, json(stored), by, at);
      return this.#one(`SELECT * FROM workbook_bindings WHERE binding_id=last_insert_rowid()`);
    });
    return { ok: true, binding: await this.#bindingView(wb, row, by) };
  }

  /** R3: an unbound binding stays, shown with who, when and why. */
  async unbind({ bindingId, reason, by } = {}) {
    const row = Number.isSafeInteger(Number(bindingId)) ? this.#one(`SELECT * FROM workbook_bindings WHERE binding_id=?`, Number(bindingId)) : null;
    const wb = row && await this.#workbook(row.capture_sha, row.project, by);
    if (!wb) return refusal("NO_SUCH_BINDING", "no binding with this id is held");
    if (!str(reason)) return refusal("NO_REASON", "say why the binding is taken back");
    if (row.unbound_at) return { ok: true, already: true, binding: await this.#bindingView(wb, row, by) };
    const at = this.now();
    this.record.transact(() => {
      this.sql.exec(`UPDATE workbook_bindings SET unbound_by=?, unbound_at=?, unbind_reason=? WHERE binding_id=? AND unbound_at IS NULL`,
                    by, at, str(reason), row.binding_id);
    });
    const now = this.#one(`SELECT * FROM workbook_bindings WHERE binding_id=?`, row.binding_id);
    return { ok: true, already: false, binding: await this.#bindingView(wb, now, by) };
  }

  /** R4: a binding compared with its source, cell for cell. */
  async #compare(wb, row, viewer) {
    const [ra, rb] = row.range.split(":");
    const p1 = cellAt(ra), p2 = cellAt(rb ?? ra);
    const src = await this.#source(parse(row.input), viewer);
    if (src.why) return { agrees: false, compared: 0, differing: [], undetermined: src.why };
    const cells = new Map(this.#rows(`SELECT * FROM workbook_cells WHERE capture_sha=? AND project=? AND sheet=? AND r BETWEEN ? AND ?
                                       AND c BETWEEN ? AND ?`, wb.capture_sha, wb.project, row.sheet, p1.row, p2.row, p1.col, p2.col)
      .map((c) => [`${c.r},${c.c}`, c]));
    const differing = [];
    let compared = 0;
    for (let i = 0; i <= p2.row - p1.row; i++) for (let j = 0; j <= p2.col - p1.col; j++) {
      const w = cellValue(cells.get(`${p1.row + i},${p1.col + j}`)), s = src.at(i, j);
      compared++;
      if (!sameValue(w, s)) differing.push({ cell: `${row.sheet}!${cellName(p1.row + i, p1.col + j)}`, workbook_value: w.value, source_value: s.value });
    }
    return { agrees: differing.length === 0, compared, differing };
  }

  async #bindingView(wb, row, viewer) {
    return { binding_id: row.binding_id, range: `${row.sheet}!${row.range}`, input: parse(row.input),
             bound_by: row.bound_by, bound_at: row.bound_at, state: row.unbound_at ? "unbound" : "bound",
             ...(row.unbound_at ? { unbound_by: row.unbound_by, unbound_at: row.unbound_at, unbind_reason: row.unbind_reason } : {}),
             ...(await this.#compare(wb, row, viewer)) };
  }

  async #bindings(wb, viewer) {
    const out = [];
    for (const r of this.#rows(`SELECT * FROM workbook_bindings WHERE capture_sha=? AND project=? ORDER BY binding_id`, wb.capture_sha, wb.project))
      out.push(await this.#bindingView(wb, r, viewer));
    return out;
  }

  /* ================================================================ R5 */

  #inputs(wb) {
    const ix = indexWorkbook(this.#grid(wb), wb.facts);
    const active = this.#rows(`SELECT * FROM workbook_bindings WHERE capture_sha=? AND project=? AND unbound_at IS NULL ORDER BY binding_id`,
                              wb.capture_sha, wb.project).map((b) => {
      const [ra, rb] = b.range.split(":");
      return { id: b.binding_id, sheet: b.sheet, p1: cellAt(ra), p2: cellAt(rb ?? ra) };
    });
    const list = inputCells(ix).map((c) => {
      const b = active.find((x) => x.sheet === c.sheet && c.r >= x.p1.row && c.r <= x.p2.row && c.c >= x.p1.col && c.c <= x.p2.col);
      return { cell: `${c.sheet}!${c.cell}`, type: c.type, value: c.value, bound: !!b, binding_id: b ? b.id : null,
               ...(b ? {} : { grade: "D", basis: "testimony: an unbound input (K1447 (ii))" }) };
    });
    return { ix, list };
  }

  /** R5: every input cell, bound (naming its binding) or unbound (testimony, grade D). */
  async inputsOf({ captureSha, project, viewer } = {}) {
    const wb = await this.#workbook(captureSha, project, viewer);
    if (!wb) return this.#absent(captureSha, project);
    const big = this.#tooLarge(wb);
    if (big) return big;
    const { list } = this.#inputs(wb);
    return { ok: true, capture_sha: wb.capture_sha, project: wb.project, inputs: list,
             counts: { inputs: list.length, bound: list.filter((x) => x.bound).length, unbound: list.filter((x) => !x.bound).length } };
  }

  /* ================================================================ R6–R8 */

  /** R6, R7: recompute through the instance's engine and record the comparison. Results are recomputed only here. */
  async recompute({ captureSha, project, by } = {}) {
    const wb = await this.#workbook(captureSha, project, by);
    if (!wb) return this.#absent(captureSha, project);
    const big = this.#tooLarge(wb);
    if (big) return big;
    let answer = null, why = null, reason = null;
    if (!this.engine) { reason = "NO_ENGINE"; why = word("workbooks.why.engine_bound"); }
    else {
      try { answer = await this.engine(wb.capture_sha); } catch (e) { answer = null; why = `no answer: ${e && e.message ? e.message : e}`; }
      if (!answer || typeof answer !== "object") { reason = "NO_ANSWER"; why = why || "no answer"; answer = null; }
      else if (answer.ok !== true) { reason = typeof answer.reason === "string" ? answer.reason : "NO_ANSWER"; why = typeof answer.why === "string" ? answer.why : reason; answer = null; }
      else if (!Array.isArray(answer.cells)) { reason = "NO_ANSWER"; why = word("workbooks.why.engine_answer_holds"); answer = null; }
    }
    const at = this.now();
    let rec;
    if (!answer) rec = { status: NOT_RECOMPUTED, engine: null, engine_version: null, reason, why,
                         body: { counts: { compared: 0, agreed: 0, differed: 0, not_recomputed: 0, volatile: 0, cache_stale: 0 },
                                 differing: [], not_recomputed: [], volatile: [], cache_stale: [] } };
    else rec = { ...pair(answer, this.#grid(wb)), engine: answer.engine ?? null, engine_version: answer.engine_version ?? null, reason: null, why: null };
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO workbook_recomputes (capture_sha, project, status, engine, engine_version, at, by, reason, why, answer)
                     VALUES (?,?,?,?,?,?,?,?,?,?)`, wb.capture_sha, wb.project, rec.status, rec.engine, rec.engine_version, at, by,
                    rec.reason, rec.why, json(rec.body));
      const row = this.#one(`SELECT * FROM workbook_recomputes WHERE recompute_id=last_insert_rowid()`);
      return { ok: true, recompute: recomputeView(row) };
    });
  }

  #latestRecompute(wb) {
    const row = this.#one(`SELECT * FROM workbook_recomputes WHERE capture_sha=? AND project=? ORDER BY recompute_id DESC LIMIT 1`,
                          wb.capture_sha, wb.project);
    return row ? recomputeView(row) : null;
  }

  /* ================================================================ R9 */

  #lint(wb, inputs) {
    const ix = inputs ? inputs.ix : indexWorkbook(this.#grid(wb), wb.facts);
    const inputList = inputCells(ix);
    const notes = this.#rows(`SELECT kind, cell, note, by, at FROM workbook_lint_notes WHERE capture_sha=? AND project=? ORDER BY note_id`,
                             wb.capture_sha, wb.project);
    return lintFindings(ix, inputList).map((f) => ({ ...f, notes: notes.filter((n) => n.kind === f.kind && n.cell === f.cell)
      .map(({ note, by, at }) => ({ note, by, at })) }));
  }

  /** R9: the lint findings, each with the notes members hold against it. Changes nothing, blocks nothing. */
  async lint({ captureSha, project, viewer } = {}) {
    const wb = await this.#workbook(captureSha, project, viewer);
    if (!wb) return this.#absent(captureSha, project);
    const big = this.#tooLarge(wb);
    if (big) return big;
    const findings = this.#lint(wb);
    return { ok: true, capture_sha: wb.capture_sha, project: wb.project, findings,
             counts: Object.fromEntries(LINT_KINDS.map((k) => [k, findings.filter((f) => f.kind === k).length])) };
  }

  /** R9: a member's note against a finding (`{kind, cell}`), kept and never erased. */
  async explainLint({ captureSha, project, finding, note, by } = {}) {
    const wb = await this.#workbook(captureSha, project, by);
    if (!wb) return this.#absent(captureSha, project);
    if (!str(note)) return refusal("NO_NOTE", "a note says what the member found; write it");
    const big = this.#tooLarge(wb);
    if (big) return big;
    const f = finding && typeof finding === "object" ? finding : {};
    const held = this.#lint(wb).find((x) => x.kind === f.kind && x.cell === f.cell);
    if (!held) return refusal("NO_SUCH_FINDING", "lint gives no such finding for this workbook", { kind: f.kind ?? null, cell: f.cell ?? null });
    const at = this.now();
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO workbook_lint_notes (capture_sha, project, kind, cell, note, by, at) VALUES (?,?,?,?,?,?,?)`,
                    wb.capture_sha, wb.project, held.kind, held.cell, str(note), by, at);
      return { ok: true, finding: { kind: held.kind, cell: held.cell, detail: held.detail }, note: { note: str(note), by, at } };
    });
  }

  /* ================================================================ R10, R11 */

  /** R10: a method note, every field required; the latest stands and every note is kept. */
  async recordMethodNote({ captureSha, project, purpose, sources, steps, limitations, by } = {}) {
    const wb = await this.#workbook(captureSha, project, by);
    if (!wb) return this.#absent(captureSha, project);
    const srcs = Array.isArray(sources) ? sources.map(str).filter(Boolean) : str(sources) ? [str(sources)] : [];
    if (!str(purpose)) return refusal("NO_PURPOSE", "say what the workbook is for");
    if (!srcs.length) return refusal("NO_SOURCES", "name the sources its inputs come from");
    if (!str(steps)) return refusal("NO_STEPS", "describe the steps the workbook takes");
    if (!str(limitations)) return refusal("NO_LIMITATIONS", "state the limitations of the data and the method");
    const at = this.now();
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO workbook_method_notes (capture_sha, project, purpose, sources, steps, limitations, by, at) VALUES (?,?,?,?,?,?,?,?)`,
                    wb.capture_sha, wb.project, str(purpose), json(srcs), str(steps), str(limitations), by, at);
      return { ok: true, note: { purpose: str(purpose), sources: srcs, steps: str(steps), limitations: str(limitations), by, at, current: true } };
    });
  }

  #methodNotes(wb) {
    const rows = this.#rows(`SELECT * FROM workbook_method_notes WHERE capture_sha=? AND project=? ORDER BY note_id`, wb.capture_sha, wb.project);
    return rows.map((r, i) => ({ purpose: r.purpose, sources: parse(r.sources), steps: r.steps, limitations: r.limitations, by: r.by,
                                 at: r.at, current: i === rows.length - 1 }));
  }

  /** R11: a second member's check, disclosed on every read; nothing waits for one. */
  async recordCheck({ captureSha, project, outcome, note, by } = {}) {
    const wb = await this.#workbook(captureSha, project, by);
    if (!wb) return this.#absent(captureSha, project);
    if (by === wb.author) return refusal("SELF_CHECK", "a check is a second member's; the workbook's author cannot check it");
    if (!CHECK_OUTCOMES.includes(outcome)) return refusal("UNKNOWN_OUTCOME", `an outcome is one of ${CHECK_OUTCOMES.join(", ")}`);
    const at = this.now();
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO workbook_checks (capture_sha, project, outcome, note, by, at) VALUES (?,?,?,?,?,?)`,
                    wb.capture_sha, wb.project, outcome, str(note) || null, by, at);
      return { ok: true, check: { outcome, note: str(note) || null, by, at } };
    });
  }

  #checks(wb) {
    return this.#rows(`SELECT outcome, note, by, at FROM workbook_checks WHERE capture_sha=? AND project=? ORDER BY check_id`,
                      wb.capture_sha, wb.project);
  }

  /* ================================================================ R2, R12 */

  /** R12: the grade facts (K1447 (ii)). */
  async #gradeFacts(wb, grid, inputs, bindings, viewer) {
    const byBinding = new Map();
    for (const b of bindings) {
      if (b.state !== "bound") continue;
      const input = b.input || {};
      let capture = null, derivation = null, source = null;
      if (input.table) {
        const t = await this.#readTable(input.table, viewer);
        const g = t && t.grade_facts ? t.grade_facts : null;
        source = { table: input.table, range: input.range };
        capture = g ? g.capture_grade ?? g.grade ?? null : null;
        derivation = g ? g.derivation ?? null : null;
      } else if (input.extent) {
        const row = this.#readExtent(input.extent, viewer);
        source = { extent: input.extent };
        try { capture = row && row.capture_sha ? this.provenance.captureGrade(row.capture_sha)?.grade ?? null : null; } catch { capture = null; }
        derivation = row && row.transcription && typeof row.transcription.ceiling === "string" ? row.transcription.ceiling : null;
      }
      byBinding.set(b.binding_id, { source, capture_grade: capture, derivation: derivation ?? "undetermined",
        grade: capture ? (derivation && GRADE_RANK[derivation] ? weaker(capture, derivation) : capture) : "undetermined" });
    }
    return {
      inputs: inputs.map((x) => (x.bound
        ? { cell: x.cell, binding_id: x.binding_id, ...byBinding.get(x.binding_id) }
        : { cell: x.cell, grade: "D", basis: "testimony: an unbound input (K1447 (ii))" })),
      results: [...grid.formulas()].map((c) => ({ cell: `${c.sheet}!${c.cell}`, derivation_step: ENGINE_STEP.step, grade: ENGINE_STEP.grade })),
      method: { graded: false, disclosed: this.#methodNotes(wb).find((n) => n.current) || null },
      rule: localize("workbooks.index.k1447_grade_rule", "K1447 (ii): each bound input at its capture grade capped by its derivation; an unbound input is testimony (D); a third-party engine's value is a derivation step, undetermined until measured; the method is disclosed, not graded"),
    };
  }

  /** R2: the workbook whole. It never recomputes. */
  async readWorkbook({ captureSha, project, viewer } = {}) {
    const wb = await this.#workbook(captureSha, project, viewer);
    if (!wb) return this.#absent(captureSha, project);
    const big = this.#tooLarge(wb);
    if (big) return big;
    const grid = this.#grid(wb);
    const inputs = this.#inputs(wb);
    const bindings = await this.#bindings(wb, viewer);
    const recompute = this.#latestRecompute(wb);
    return {
      ok: true,
      workbook: { capture_sha: wb.capture_sha, project: wb.project, question: wb.question, period: wb.period, origin: wb.origin,
                  author: wb.author, at: wb.at, sheets: wb.facts.sheets || [],
                  counts: { cells: grid.count(), formulas: grid.formulaCount() } },
      bindings,
      inputs: inputs.list,
      recompute,
      lint: this.#lint(wb, inputs),
      method_notes: this.#methodNotes(wb),
      checks: this.#checks(wb),
      grade_facts: await this.#gradeFacts(wb, grid, inputs.list, bindings, viewer),
      disclosure: recompute ? recompute.disclosure : disclosure(null),
    };
  }

  /* ================================================================ R14 */

  /** R14, R22, R23: a calculation the viewer may see, as an XLSX workbook. Refuses `EXPORT_TOO_WIDE` {columns, bound_columns}
   *  for a table wider than a sheet (XFD) and `EXPORT_TOO_LARGE` {cells, bound_cells, limit} above the workbook bound, both
   *  judged from each table's shape before its rows load, and again on what the file would lay out. */
  async exportRecipe({ calcId, viewer } = {}) {
    const absent = { ok: true, found: false };
    if (!this.calculations || typeof this.calculations.read !== "function" || typeof viewer !== "string" || !viewer) return absent;
    let calc;
    try { calc = calculationFrom(await this.calculations.read({ calcId, viewer })); } catch { calc = null; }
    if (!calc) return absent;
    const shapes = [];
    for (const inp of calc.inputs) {
      if (inp.kind !== "table") continue;
      const peek = await this.#readTable(inp.sha, viewer);
      if (!peek || !Array.isArray(peek.rows)) return absent;
      shapes.push(peek);
    }
    const widest = Math.max(0, ...shapes.map((t) => t.fields.length));
    if (widest > XLSX_MAX_COLUMNS) return exportTooWide(widest);
    if (shapes.every((t) => t.row_count !== null)) {
      const laid = shapes.reduce((n, t) => n + (t.row_count + 1) * t.fields.length, 0);
      if (laid > WORKBOOK_CELLS_MAX) return exportTooLarge(laid);
    }
    const tables = {};
    for (const inp of calc.inputs) {
      if (inp.kind !== "table") continue;
      const t = await this.#readTable(inp.sha, viewer, { all: true });
      if (!t || !Array.isArray(t.rows)) return absent;
      tables[inp.name] = t;
    }
    const out = buildExport(calc, tables, { maxCells: WORKBOOK_CELLS_MAX });
    if (out.tooLarge) return exportTooLarge(out.cells);
    const id = String(calc.calc_id ?? calcId ?? "calculation").replace(/[^A-Za-z0-9._-]/g, "_");
    return { ok: true, found: true, calc_id: calc.calc_id ?? calcId, filename: `${id}.xlsx`, content_type: XLSX_CONTENT_TYPE,
             bytes: out.bytes, sheets: out.sheets, formulas: out.formulas, labelled: out.labelled, cells: out.cells };
  }
}

/* R6, R7: the engine's cells paired with the file's cached values. */
function pair(answer, grid) {
  const held = { get: (ref) => { const i = ref.lastIndexOf("!"); return i > 0 ? grid.named(ref.slice(0, i), ref.slice(i + 1)) : null; } };
  const counts = { compared: 0, agreed: 0, differed: 0, not_recomputed: 0, volatile: 0, cache_stale: 0 };
  const differing = [], notRecomputed = [], volatile = [], cacheStale = [];
  const seen = new Set();
  for (const e of answer.cells) {
    const ref = e && e.source && typeof e.source.ref === "string" ? e.source.ref : null;
    if (!ref) continue;
    seen.add(ref);
    const c = held.get(ref);
    if (e.volatile) { counts.volatile++; volatile.push({ cell: ref, formula: e.formula ?? null }); continue; }
    if (e.type === "error") {
      counts.not_recomputed++;
      notRecomputed.push({ cell: ref, error: e.error ?? null, cause: e.cause ?? "undetermined", ...(e.function ? { function: e.function } : {}) });
      continue;
    }
    if (!c || c.formula === null || c.formula === undefined) {
      counts.not_recomputed++;
      notRecomputed.push({ cell: ref, error: null, cause: "not_in_file", detail: "the file's reading holds no formula here" });
      continue;
    }
    const cachedErr = c.type === "error" || (typeof c.cached === "string" && /^#/.test(c.cached) && c.type !== "text");
    if (cachedErr || c.cached === null || c.cached === undefined) {
      counts.cache_stale++;
      cacheStale.push({ cell: ref, cached: c.cached ?? null, engine_value: e.value ?? null,
                        why: cachedErr ? word("workbooks.why.file_caches_error") : word("workbooks.why.file_caches_value") });
      continue;
    }
    counts.compared++;
    let same;
    if (e.type === "number" && c.type === "number") same = closeNumbers(e.value, c.cached);
    else if (e.type === "boolean" && c.type === "boolean") same = String(e.value).toLowerCase() === (c.cached === "1" || /^true$/i.test(c.cached) ? "true" : "false");
    else if (e.type === "text" && c.type === "text") same = String(e.value) === c.cached;
    else same = false;
    if (same) counts.agreed++;
    else { counts.differed++; differing.push({ cell: ref, cached: c.cached, cached_type: c.type, engine_value: e.value ?? null, engine_type: e.type ?? null }); }
  }
  for (const c of grid.formulas())
    if (!seen.has(`${c.sheet}!${c.cell}`)) {
      counts.not_recomputed++;
      notRecomputed.push({ cell: `${c.sheet}!${c.cell}`, error: null, cause: "no_engine_value", detail: "the engine answered no value for this formula" });
    }
  const status = counts.differed ? "differs"
    : counts.not_recomputed || counts.volatile || counts.cache_stale ? "partial"
    : counts.compared ? "agrees" : "partial";
  const lists = { differing: cut(differing), not_recomputed: cut(notRecomputed), volatile: cut(volatile), cache_stale: cut(cacheStale) };
  return { status, body: { counts, ...Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.list])),
                           truncated: Object.fromEntries(Object.entries(lists).filter(([, v]) => v.left).map(([k, v]) => [k, v.left])) } };
}

/** R8: the disclosure a recompute statement carries. */
function disclosure(rec) {
  if (!rec || rec.status === NOT_RECOMPUTED) {
    const why = rec ? rec.why || rec.reason : word("workbooks.recompute_recorded");
    return { text: word("workbooks.open_spreadsheet_program", { not_recomputed: String(NOT_RECOMPUTED), why: String(why) }), status: NOT_RECOMPUTED };
  }
  const measured = rec.engine === ENGINE_MEASURE.engine && rec.engine_version === ENGINE_MEASURE.engine_version;
  return { text: word("workbooks.recomputed_engine_group", { engine: String(rec.engine), engine_version: String(rec.engine_version) }),
           meaning: RECOMPUTE_MEANING, status: rec.status,
           measure: measured ? ENGINE_MEASURE : { measured: false, why: word("workbooks.why.corpus_measure_recorded", { engine: String(rec.engine), engine_version: String(rec.engine_version) }) } };
}

function recomputeView(row) {
  const body = parse(row.answer) || {};
  const rec = { status: row.status, engine: row.engine, engine_version: row.engine_version, at: row.at, by: row.by,
                ...(row.reason ? { reason: row.reason, why: row.why } : {}), counts: body.counts, differing: body.differing || [],
                not_recomputed: body.not_recomputed || [], volatile: body.volatile || [], cache_stale: body.cache_stale || [],
                ...(body.truncated && Object.keys(body.truncated).length ? { truncated: body.truncated } : {}) };
  if (rec.status !== NOT_RECOMPUTED) rec.meaning = RECOMPUTE_MEANING;
  rec.disclosure = disclosure(rec);
  return rec;
}

