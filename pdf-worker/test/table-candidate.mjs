/* CPDF-18 — THE CANDIDATE TABLE-RECOGNITION STEP, AS MEASURED. PROBE-ONLY.
 *
 * THIS IS NOT A TABLE READER AND NOTHING IN THE PRODUCT IMPORTS IT. The CPDF-18
 * row is explicit that no table reader is built whatever the verdict; this file
 * is the SUBJECT of a GO/NO-GO measurement (`table-recognition.probe.mjs`), kept
 * in `test/` beside the probe so a re-run measures exactly what was measured.
 *
 * WHY THIS CANDIDATE. The runtime has exactly one component that knows where
 * text sits on a PDF page: pdf.js (`unpdf`), already in this member and GO on
 * workerd since CPDF-6. pdf.js recognises no tables. The step measured is
 * therefore the classical GEOMETRIC ("stream") method — the family Tabula's
 * stream mode and pdfplumber's text strategy belong to — reduced to its core:
 * rows are baselines, cells are text runs separated by a wide horizontal gap,
 * and a table is a run of consecutive multi-cell rows whose cells line up in
 * columns. It is deterministic by construction, which is exactly why the
 * probe does NOT accept reproducibility alone as a GO (see the probe header).
 *
 * THE CONSTANTS ARE DECLARED AND FROZEN BEFORE THE MEASUREMENT, and a re-tune
 * after seeing the scores would turn a measurement into a fit.
 */
export const CANDIDATE = Object.freeze({
  name: "geometric-stream",
  version: "cpdf18-probe-1",
  LINE_TOL: 2.5,     // pt: items whose baselines differ by at most this are one line
  CELL_GAP: 10,      // pt: a horizontal gap wider than this between items starts a new cell
  MAX_ROW_GAP: 40,   // pt: consecutive table rows are at most this far apart (baseline to baseline)
  MIN_ROWS: 2,       // a table has at least this many rows
  MIN_COLS: 2,       // ...and at least this many columns
});

/**
 * A text run placed on the page, in page space (pdf.js transform[4], transform[5], width).
 * @typedef {Object} PlacedItem
 * @property {string} str the run's text
 * @property {number} x left edge
 * @property {number} y baseline
 * @property {number} w width
 */
/**
 * @typedef {Object} Cell
 * @property {string} text
 * @property {number} x0
 * @property {number} x1
 */
/**
 * @typedef {Object} Line
 * @property {number} y
 * @property {PlacedItem[]} items
 * @property {Cell[]} cells
 */
/**
 * A table the candidate found.
 * @typedef {Object} FoundTable
 * @property {number} page
 * @property {number} rows
 * @property {number} cols
 * @property {number[]} rect [x0, y0, x1, y1], rounded to 0.1 pt
 * @property {string[][]} cells each row's cell texts
 */

/**
 * @param {string} s
 * @returns {string}
 */
const norm = (s) => s.replace(/\s+/g, " ").trim();

/**
 * @param {PlacedItem[]} items in page space (pdf.js transform[4], transform[5], width)
 * @param {number} page
 * @returns {FoundTable[]}
 */
export function recogniseTables(items, page) {
  const C = CANDIDATE;
  const its = items.filter((i) => i.str && i.str.trim()).map((i) => ({ ...i }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  /* lines */
  /** @type {Line[]} */
  const lines = [];
  for (const it of its) {
    const L = lines.find((l) => Math.abs(l.y - it.y) <= C.LINE_TOL);
    if (L) L.items.push(it); else lines.push({ y: it.y, items: [it], cells: [] });
  }
  lines.sort((a, b) => b.y - a.y);
  /* cells */
  for (const L of lines) {
    L.items.sort((a, b) => a.x - b.x);
    /** @type {Cell[]} */
    const cells = [];
    for (const it of L.items) {
      const last = cells[cells.length - 1];
      if (last && it.x - last.x1 <= C.CELL_GAP) {
        last.text += (it.x - last.x1 > 1 ? " " : "") + it.str;
        last.x1 = Math.max(last.x1, it.x + it.w);
      } else cells.push({ text: it.str, x0: it.x, x1: it.x + it.w });
    }
    L.cells = cells.map((c) => ({ ...c, text: norm(c.text) }));
  }
  /* tables: runs of consecutive lines with the same cell count >= MIN_COLS
     whose cells overlap the previous line's cells column by column */
  /**
   * @param {Cell} a
   * @param {Cell} b
   * @returns {boolean}
   */
  const overlaps = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1;
  /** @type {FoundTable[]} */
  const tables = [];
  /** @type {Line[]} */
  let run = [];
  const flush = () => {
    if (run.length >= C.MIN_ROWS) {
      const xs = run.flatMap((l) => l.cells.flatMap((c) => [c.x0, c.x1]));
      const ys = run.map((l) => l.y);
      tables.push({
        page, rows: run.length, cols: firstCellCount(run),
        rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10),
        cells: run.map((l) => l.cells.map((c) => c.text)),
      });
    }
    run = [];
  };
  for (const L of lines) {
    const ok = L.cells.length >= C.MIN_COLS;
    if (!ok) { flush(); continue; }
    const prev = run[run.length - 1];
    if (prev && (prev.cells.length !== L.cells.length || prev.y - L.y > C.MAX_ROW_GAP
        || !L.cells.every((c, i) => overlaps(c, cellAt(prev.cells, i))))) flush();
    run.push(L);
  }
  flush();
  return tables;
}

/**
 * The cell count of a run's first line; the run is never empty when asked.
 * @param {Line[]} run
 * @returns {number}
 */
function firstCellCount(run) {
  const first = run[0];
  if (first === undefined) throw new TypeError("Cannot read properties of undefined (reading 'cells')");
  return first.cells.length;
}

/**
 * The cell at an index the caller has checked is in range.
 * @param {Cell[]} cells
 * @param {number} i
 * @returns {Cell}
 */
function cellAt(cells, i) {
  const cell = cells[i];
  if (cell === undefined) throw new TypeError("Cannot read properties of undefined (reading 'x1')");
  return cell;
}
