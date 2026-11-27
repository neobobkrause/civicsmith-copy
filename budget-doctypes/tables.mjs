/* Tables read from a financial document's text (R2–R6).
 *
 * The reader works over `ctx.text`, the flattened text `docprofile`'s
 * `readText` hands every content type, so that every row's `source` is what
 * `ctx.locate` answers for the offset the row's label was read at (R2,
 * `docprofile` R34). What the text alone cannot say (which pages had no text
 * layer, where an image was painted, an OCR transcription of a page) is read
 * from the supplied text itself, `ctx.supplied` (interface I2: its `pages`,
 * `undetermined` markers and `images`, and `ocr`, below), when the caller
 * passes it on the context.
 *
 * An OCR transcription (R6) is carried as `supplied.ocr`, one entry per page
 * transcribed, `{page, engine, regions: [{text, source}]}`: the `ocr-worker`'s
 * answer for that page (its regions, each a line with its `image-px` source)
 * and the engine that read it. This job's choice (K1511: "budget-doctypes
 * decides OCR versus text layer in its job"): a page is read from its text
 * layer when it has one, and from an OCR transcription only when the table on
 * it is an image (R6), and only for a budget book (a financial report is read
 * from its text layer only, R4). */
import { classify, wraps, TOTAL, scaleIn, CAPTION, isProse, isSentence, isYear } from "./figures.mjs";
import { KEYS, matchIn } from "./view.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, SuppliedText, SuppliedOcr, UndeterminedMarker } from "../docprofile/registry.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { Classified } from "./figures.mjs" */

/**
 * One line of the text read: its text, the offset it starts at (null for a line of an OCR transcription), where
 * `ctx.locate` places it, and its page.
 * @typedef {Object} Line
 * @property {string} text
 * @property {number | null} offset
 * @property {ReadingPosition | null} source
 * @property {number | null} page
 */
/**
 * A line with its classification, and whether it was set aside as a chart label or read as a table's description.
 * @typedef {Object} ClassedLine
 * @property {string} text
 * @property {number | null} offset
 * @property {ReadingPosition | null} source
 * @property {number | null} page
 * @property {Classified} c
 * @property {boolean} [chart]
 * @property {boolean} [meta]
 */
/**
 * One figure exactly as printed (R2).
 * @typedef {Object} Cell
 * @property {string} as_read
 */
/**
 * One row of a table (R2, R3): its label as merged, its cells as printed, whether it spans columns, and where its label
 * was read; a row whose figures stand with no label says why.
 * @typedef {Object} TableRow
 * @property {string | null} label
 * @property {Cell[]} cells
 * @property {boolean} span
 * @property {ReadingPosition | null} source
 * @property {string} [label_why]
 */
/**
 * One table read (R2, R3, R6): its title, page, period and scale as written, its header labels, its rows, whether it is
 * usable and why not, and how it was read; a table with no title or period says why, and one read by OCR names its
 * engine.
 * @typedef {Object} ReadTable
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
 */
/**
 * A chart-label block set aside (R5): its page, its lines as printed, and why.
 * @typedef {Object} SkippedBlock
 * @property {number | null} page
 * @property {string[]} lines
 * @property {string} why
 */
/**
 * An image-only table not read (R6): its page, the rectangle the image was painted in, and why.
 * @typedef {Object} UnreadImage
 * @property {number} page
 * @property {number[]} rect
 * @property {string} why
 */
/**
 * A page from which no table was read (R4): its index and why.
 * @typedef {Object} UnreadPage
 * @property {number} page
 * @property {string} why
 */
/**
 * What `parse` gives for a PDF (R2 to R6): the tables read, the image tables not read, the chart labels set aside, the
 * pages read and those not read; where no table was read, why.
 * @typedef {Object} TablesReading
 * @property {ReadTable[]} tables
 * @property {UnreadImage[]} unread
 * @property {SkippedBlock[]} skipped
 * @property {number[]} pages_read
 * @property {UnreadPage[]} pages_unread
 * @property {string} [why]
 */
/**
 * One page's reading: its tables, its chart labels set aside and its live lines.
 * @typedef {Object} PageReading
 * @property {ReadTable[]} tables
 * @property {SkippedBlock[]} skipped
 * @property {ClassedLine[]} lines
 */
/**
 * How a page is read: whether chart labels are set aside, the method, and an OCR transcription's engine.
 * @typedef {Object} PageOptions
 * @property {boolean} [chartSkip]
 * @property {string} [method]
 * @property {string} [engine]
 */
/**
 * A table region: the indices of its first and last live lines.
 * @typedef {Object} Region
 * @property {number} start
 * @property {number} end
 */
/**
 * One line of an OCR transcription (R6): its text and its source in the transcription.
 * @typedef {Object} OcrRegion
 * @property {string} [text]
 * @property {ReadingPosition | null} [source]
 */
/**
 * An OCR transcription of one page (R6): the page, the engine that read it, and its lines.
 * @typedef {Object} OcrPage
 * @property {number | null} [page]
 * @property {string} [engine]
 * @property {OcrRegion[]} [regions]
 */
/**
 * An image a producer painted on a page, with the rectangle it was painted in.
 * @typedef {Object} PaintedImage
 * @property {number} [page]
 * @property {number[] | null} [rect]
 */

/** R3's usability bar: the share of rows with two or more figures that have the
 *  table's modal number of cells (`measures-T33/money-people.md` §7). */
export const USABLE_SHARE = 0.85;
/** At most this many text lines with no figure may sit between two rows of one
 *  table (section headings and wrapped labels); more end the table. Measured on
 *  the fixtures: the longest run inside a table is a heading plus a two-line
 *  wrapped label. */
export const TABLE_GAP = 4;
/** A table has at least this many rows of two or more figures; fewer is a
 *  figure or two in a sentence's line, not a table. Measured: the smallest
 *  table of the fixtures (a budget book's department page) has three. */
export const MIN_ROWS = 2;
/** At most this many lines above a table's first row are read as its header. */
export const HEADER_LINES = 10;

/** The lines of the text, each `{text, offset, page, source}`, `page` the
 *  page `ctx.locate` places it on (null where it cannot say).
 *  @param {DoctypeContext} ctx
 *  @returns {Line[]} */
export function linesOf(ctx) {
  const whole = ctx.text;
  const text = typeof whole === "string" ? whole : "";
  const given = ctx.locate;
  /** @type {(offset: unknown) => ReadingPosition | null} */
  const locate = typeof given === "function" ? given : () => null;
  /** @type {Line[]} */
  const out = [];
  let offset = 0;
  /** @type {number | null} */
  let page = null;
  for (const raw of text.split("\n")) {
    const lead = raw.length - raw.trimStart().length;
    /* A blank line is placed nowhere, and stays with the page around it. */
    const source = raw.trim() ? locate(offset + lead) : null;
    const placed = source && "page" in source ? source.page : null;
    if (raw.trim()) page = Number.isInteger(placed) ? placed : null;
    out.push({ text: raw, offset: offset + lead, source: source || null, page });
    offset += raw.length + 1;
  }
  return out;
}

/** The entry at `i`, which the caller's bounds guarantee; a read past them fails as reading a member of nothing does.
 *  @template T
 *  @param {ReadonlyArray<T>} list
 *  @param {number} i
 *  @returns {T} */
function at(list, i) {
  const v = list[i];
  if (v === undefined) throw new TypeError(`Cannot read properties of undefined (reading index ${i})`);
  return v;
}

/** Group lines by page, in reading order: `[{page, lines}]`.
 *  @param {Line[]} lines
 *  @returns {Array<{ page: number | null, lines: Line[] }>} */
function byPage(lines) {
  /** @type {Array<{ page: number | null, lines: Line[] }>} */
  const pages = [];
  for (const l of lines) {
    const last = pages[pages.length - 1];
    if (last && last.page === l.page) last.lines.push(l);
    else pages.push({ page: l.page, lines: [l] });
  }
  return pages;
}

/** Read the tables of one page's lines. `chartSkip` sets aside chart labels
 *  (R5, a budget book); otherwise a chart-shaped line is read as text.
 *  @param {DoctypeContext} ctx
 *  @param {number | null} page
 *  @param {Line[]} lines
 *  @param {PageOptions} [options]
 *  @returns {PageReading} */
export function readPage(ctx, page, lines, { chartSkip = false, method = "text-layer", engine } = {}) {
  /** @type {ClassedLine[]} */
  const cls = lines.map((l) => ({ ...l, c: classify(l.text) }));
  /** @type {SkippedBlock[]} */
  const skipped = [];
  /* R5: the chart-label block. A chart label's own label is either on its line
     or the line before; both are set aside, never read as a row. */
  for (let i = 0; i < cls.length; i++) {
    if (at(cls, i).c.kind !== "chart") continue;
    if (!chartSkip) { at(cls, i).c = { kind: "text", label: at(cls, i).text.trim(), cells: [] }; continue; }
    /** @type {string[]} */
    const lines = [];
    if (!at(cls, i).c.label && i > 0 && at(cls, i - 1).c.kind === "text" && !at(cls, i - 1).chart) {
      at(cls, i - 1).chart = true; lines.push(at(cls, i - 1).text.trim());
    }
    lines.push(at(cls, i).text.trim());
    at(cls, i).chart = true;
    skipped.push({ page, lines, why: localize("budget-doctypes.tables.chart_labels_a_label", "chart labels: a label paired with an amount and a parenthesised share, printed above a table; not a row of it, and the share is not a negative figure") });
  }
  const live = cls.filter((l) => !l.chart && l.c.kind !== "blank");
  /* A year alone on its line, directly above a line of figures, is that row's
     label (a statistical schedule in a cell-per-line layout). */
  for (let i = 0; i + 1 < live.length; i++)
    if (at(live, i).c.kind === "years" && at(live, i).c.cells.length === 1 && at(live, i + 1).c.kind === "figures")
      at(live, i).c = { kind: "text", label: at(at(live, i).c.cells, 0), cells: [] };
  /* A heading, a caption ("Schedule 1"), a scale or a dated line ("June 30,
     2024") is the table's description, not a row, even where it ends on a
     figure: it ends a table. */
  for (const l of live) {
    const t = l.text.trim();
    if (l.c.cells.length > 1 || l.c.kind === "years") continue;
    if (l.c.dated || matchIn(ctx, KEYS.HEADINGS, t) || CAPTION.test(t) || scaleIn(t)
        || (t.split(/\s+/).length <= 6 && matchIn(ctx, KEYS.FISCAL_YEARS, t))) {
      l.c = { kind: "text", label: t, cells: [] };
      l.meta = true;
    }
  }

  /* Table regions: from a line bearing figures to the last one before prose or
     more than TABLE_GAP figure-less lines. */
  /** @type {Region[]} */
  const regions = [];
  /** @type {Region | null} */
  let cur = null;
  let gap = 0;
  for (let i = 0; i < live.length; i++) {
    const k = at(live, i).c.kind;
    /* A line of one figure opens a table only under a label (a cell-per-line
       layout); under prose or a heading it is a page number or a stray figure. */
    const prev = i > 0 ? at(live, i - 1) : null;
    const open = cur;
    const bears = k === "row" || (k === "figures" && (open || at(live, i).c.cells.length >= 2
      || (prev && prev.c.kind === "text" && !prev.meta && !isProse(prev.text))));
    if (bears) {
      if (!open) cur = { start: i, end: i };
      else open.end = i;
      gap = 0;
    } else if (open) {
      gap++;
      if (gap > TABLE_GAP || isSentence(at(live, i).text) || at(live, i).meta) { regions.push(open); cur = null; gap = 0; }
    }
  }
  const last = cur;
  if (last) regions.push(last);

  /** @type {ReadTable[]} */
  const tables = [];
  let prevEnd = -1;
  for (let r = 0; r < regions.length; r++) {
    const reg = at(regions, r);
    const nextStart = r + 1 < regions.length ? at(regions, r + 1).start : live.length;
    tables.push(buildTable(ctx, page, live, reg, prevEnd, nextStart, method, engine));
    prevEnd = reg.end;
  }
  /* A region with no row of two or more figures is not a table: a page number,
     a figure in a sentence's line. Its figures are not cells of anything. */
  return { tables: tables.filter((t) => t.rows.filter((r) => r.cells.length >= 2).length >= MIN_ROWS), skipped,
           lines: live };
}

/** One table from one region of a page's live lines (R2, R3).
 *  @param {DoctypeContext} ctx
 *  @param {number | null} page
 *  @param {ClassedLine[]} live
 *  @param {Region} reg
 *  @param {number} prevEnd
 *  @param {number} nextStart
 *  @param {string} method
 *  @param {string | undefined} engine
 *  @returns {ReadTable} */
function buildTable(ctx, page, live, reg, prevEnd, nextStart, method, engine) {
  /* The rows. A text line opens a label; a wrapped label continues it (R3); a
     row line closes it with its figures; figure-only lines after a label (a
     cell-per-line layout) are that row's cells, until the next text line. */
  let i = reg.start;
  /* Header lines above the first row: a run of figure-less lines (and lines of
     years) back to the title, the scale, a period, prose or HEADER_LINES. A
     line in capitals alone directly above the first row is a section, not a
     header. */
  /** @type {ClassedLine[]} */
  const header = [];
  {
    let j = reg.start - 1;
    /* A label opening the first row (a cell-per-line layout prints the label on
       its own line) belongs to the row, not the header. */
    if (at(live, reg.start).c.kind === "figures" && j > prevEnd && at(live, j).c.kind === "text") j--;
    for (let n = 0; n < 2 && j > prevEnd && at(live, j).c.kind === "text"
         && (/^[A-Z][A-Z &,'()-]+:?$/.test(at(live, j).text.trim()) || /:$/.test(at(live, j).text.trim())); n++) j--;
    let years = false;
    for (let n = 0; j > prevEnd && n < HEADER_LINES; j--, n++) {
      const l = at(live, j);
      const t = l.text.trim();
      const kind = l.c.kind;
      if (kind === "years") { header.unshift(l); years = true; n--; continue; }
      if (kind !== "text") break;
      if (scaleIn(t) || matchIn(ctx, KEYS.HEADINGS, t) || CAPTION.test(t) || isProse(t)) break;
      if (years) break;
      header.unshift(l);
    }
    /* A line naming two or more periods is the header row: the lines above it
       are the page's own furniture (a rendered page's controls), not headers. */
    const named = header.findIndex((l) => periodCount(ctx, l.text) >= 2);
    if (named > 0) header.splice(0, named);
    /* Below a header of years, a line of words is the first section's name. */
    let lastYears = -1;
    header.forEach((l, n) => { if (l.c.kind === "years") lastYears = n; });
    if (lastYears >= 0) header.splice(lastYears + 1);
  }
  /* Leading year lines inside the region are header too. */
  while (i <= reg.end && at(live, i).c.kind === "years") { header.push(at(live, i)); i++; }

  /** @type {TableRow[]} */
  const rows = [];
  /** @type {{ label: string, line: ClassedLine } | null} */
  let pending = null;
  /** @type {TableRow | null} */
  let open = null;    // the row figure-only lines extend
  /** The rows that figure-only lines extend one figure to a line (a cell-per-line layout). @type {Set<TableRow>} */
  const perLine = new Set();
  const flushPending = () => {
    const p = pending;
    if (p) rows.push(row(p.label, [], p.line, false));
    pending = null;
  };
  /* A label line directly above the region opens its first row. */
  if (reg.start - 1 > prevEnd && at(live, reg.start).c.kind === "figures" && at(live, reg.start - 1).c.kind === "text"
      && !header.includes(at(live, reg.start - 1)))
    pending = { label: at(live, reg.start - 1).text.trim(), line: at(live, reg.start - 1) };
  for (; i <= reg.end; i++) {
    const l = at(live, i);
    const { kind, label, cells } = l.c;
    if (kind === "text") {
      open = null;
      const p = pending;
      if (p && wraps(p.label, label)) { p.label += " " + label; continue; }
      flushPending();
      pending = { label, line: l };
      continue;
    }
    if (kind === "row") {
      let lab = label, atLine = l;
      const p = pending;
      if (p && wraps(p.label, label, true)) { lab = p.label + " " + label; atLine = p.line; pending = null; }
      else flushPending();
      const made = row(lab, cells, atLine, false);
      open = made;
      rows.push(made);
      continue;
    }
    if (kind === "figures" || kind === "years") {
      /* Figures under a label: that row's cells, one or several to a line (a
         cell-per-line layout continues the row line by line). Figures under a
         row that already read its own figures are another row, whose label the
         text read does not hold where its figures are. */
      const p = pending, o = open;
      if (p) { const made = row(p.label, cells, p.line, false); if (cells.length === 1) perLine.add(made); open = made; rows.push(made); pending = null; }
      else if (o && perLine.has(o) && cells.length === 1) o.cells.push({ as_read: at(cells, 0) });
      else {
        const made = row(null, cells, l, false);
        made.label_why = localize("budget-doctypes.tables.no_label_was_read_beside", "no label was read beside these figures in the text read");
        rows.push(made); open = null;
      }
    }
  }
  flushPending();

  /* R3: usable at the modal cell count, with headers. */
  const counted = rows.filter((r) => r.cells.length >= 2);
  const freq = new Map(/** @type {Array<[number, number]>} */ ([]));
  for (const r of counted) freq.set(r.cells.length, (freq.get(r.cells.length) || 0) + 1);
  /** @type {number | null} */
  let modal = null;
  let top = 0;
  for (const [n, f] of freq) {
    const m = modal;
    if (f > top || (f === top && m !== null && n > m)) { modal = n; top = f; }
  }
  for (const r of counted)
    { const label = r.label; if (r.cells.length !== modal && label && TOTAL.test(label)) r.span = true; }
  const modal_share = counted.length ? Math.round((top / counted.length) * 1000) / 1000 : 0;
  const columns = header.map((l) => l.text.trim());
  let usable = true;
  /** @type {string | null} */
  let why = null;
  if (!counted.length) { usable = false; why = localize("budget-doctypes.tables.no_row_holds_two", "no row holds two or more figures"); }
  else if (modal_share < USABLE_SHARE) {
    usable = false;
    why = localize("budget-doctypes.tables.only_v1_of_the_length", "only {v1}% of the {length} rows holding two or more figures have the table's modal {modal} cells (at least {v2}% needed)", { v1: String(counted.length ? Math.round(modal_share * 100) : 0), length: String(counted.length), modal: String(modal), v2: String(USABLE_SHARE * 100) });
  } else if (!columns.length) { usable = false; why = localize("budget-doctypes.tables.the_table_s_headers", "the table's headers are not in the text read"); }

  /* Title, period and scale from the lines above the table (to the previous
     table), else below it (a layout that prints its heading after its body). */
  const above = live.slice(prevEnd + 1, reg.start);
  const below = live.slice(reg.end + 1, nextStart);
  const head = describe(ctx, above) || describe(ctx, below) || describe(ctx, live.slice(0, reg.start).reverse());
  const period = periodIn(ctx, above) || periodIn(ctx, below) || periodIn(ctx, header);
  const scale = scaleOf(above) || scaleOf(below);
  /** @type {ReadTable} */
  const t = {
    title: head ? head.title || null : null, page, period_as_written: period, scale, columns, rows, usable, modal_share,
    why, method,
  };
  if (engine) t.engine = engine;
  if (!t.title) t.title_why = localize("budget-doctypes.tables.no_heading_the_view", "no heading the view names, and no table caption, was read above or below the table");
  if (!t.period_as_written)
    t.period_why = localize("budget-doctypes.tables.no_fiscal_year_form", "no fiscal-year form the view holds was read above, below or in the header of the table");
  return t;
}

/** @param {string | null} label @param {string[]} cells @param {Line} line @param {boolean} span @returns {TableRow} */
function row(label, cells, line, span) {
  return { label: label === null ? null : label, cells: cells.map((c) => ({ as_read: c })), span, source: line.source || null };
}

/** @param {DoctypeContext} ctx @param {ReadonlyArray<Line>} lines @returns {{ title: string } | null} */
function describe(ctx, lines) {
  for (const l of lines) {
    const t = l.text.trim();
    if (matchIn(ctx, KEYS.HEADINGS, t)) return { title: t };
  }
  for (const l of lines) {
    const t = l.text.trim();
    if (CAPTION.test(t)) return { title: t };
  }
  return null;
}

/** @param {DoctypeContext} ctx @param {string} line @returns {number} */
function periodCount(ctx, line) {
  const s = String(line).trim();
  let n = 0;
  for (const tok of s.split(/\s+/)) if (isYear(tok) || matchIn(ctx, KEYS.FISCAL_YEARS, tok)) n++;
  return n;
}

/** @param {DoctypeContext} ctx @param {ReadonlyArray<Line>} lines @returns {string | null} */
function periodIn(ctx, lines) {
  for (const l of lines) {
    const m = matchIn(ctx, KEYS.FISCAL_YEARS, l.text);
    if (m) return m.text;
  }
  return null;
}

/** @param {ReadonlyArray<Line>} lines @returns {string | null} */
function scaleOf(lines) {
  for (const l of lines) { const s = scaleIn(l.text); if (s) return s; }
  return null;
}

/** The images the supplied text says were painted, each with the rectangle it was painted in. Waits on `docprofile`:
 *  its `SuppliedImage` states no `rect`.
 *  @param {SuppliedText} supplied
 *  @returns {ReadonlyArray<PaintedImage | null | undefined> | null} */
function paintedImages(supplied) {
  const list = supplied.images;
  return Array.isArray(list) ? /** @type {ReadonlyArray<PaintedImage | null | undefined>} */ (list) : null;
}

/** The OCR transcriptions the supplied text carries, one for each page transcribed (R6). Waits on `docprofile`: its
 *  `SuppliedText.ocr` states one transcription, not one for each page with its regions.
 *  @param {SuppliedText} supplied
 *  @returns {ReadonlyArray<OcrPage | null | undefined> | null} */
function transcriptions(supplied) {
  const list = /** @type {Array<OcrPage | null | undefined> | SuppliedOcr | null | undefined} */ (/** @type {unknown} */ (supplied.ocr));
  return Array.isArray(list) ? list : null;
}

/** The pages the supplied text says it could not read, from its markers.
 *  @param {SuppliedText | null} supplied
 *  @returns {{ noText: Set<number>, images: Map<number, number[][]> }} */
function markers(supplied) {
  /** @type {Set<number>} */
  const noText = new Set();
  const images = new Map(/** @type {Array<[number, number[][]]>} */ ([]));
  if (!supplied || typeof supplied !== "object") return { noText, images };
  /** @type {UndeterminedMarker[]} */
  const all = [];
  const undetermined = supplied.undetermined, pages = supplied.pages;
  if (Array.isArray(undetermined)) all.push(...undetermined);
  if (Array.isArray(pages))
    for (const p of pages) { const own = p ? p.undetermined : undefined; if (p && Array.isArray(own)) all.push(...own); }
  for (const m of all) {
    if (!m) continue;
    const page = m.page, rect = m.rect;
    if (typeof page !== "number" || !Number.isInteger(page)) continue;
    if (m.reason === "no_text_layer") noText.add(page);
    if (m.reason === "image_unread" && Array.isArray(rect)) addImage(images, page, rect);
  }
  const painted = paintedImages(supplied);
  if (painted)
    for (const im of painted) {
      if (!im) continue;
      const page = im.page, rect = im.rect;
      if (typeof page === "number" && Number.isInteger(page) && Array.isArray(rect)) addImage(images, page, rect);
    }
  return { noText, images };
}

/** @param {Map<number, number[][]>} images @param {number} page @param {number[]} rect */
function addImage(images, page, rect) {
  const list = images.get(page) || [];
  const key = rect.join(",");
  if (!list.some((r) => r.join(",") === key)) list.push(rect);
  images.set(page, list);
}

/** Every page index the supplied text holds, with or without text.
 *  @param {SuppliedText | null} supplied
 *  @returns {Set<number>} */
function suppliedPages(supplied) {
  /** @type {Set<number>} */
  const out = new Set();
  const pages = supplied ? supplied.pages : undefined;
  if (supplied && Array.isArray(pages))
    for (const p of pages) {
      if (!p) continue;
      const page = p.page;
      if (typeof page === "number" && Number.isInteger(page)) out.add(page);
    }
  return out;
}

/** An OCR transcription of `page` the supplied text carries, or null.
 *  @param {SuppliedText | null} supplied
 *  @param {number} page
 *  @returns {{ page: number, engine: string, regions: OcrRegion[] } | null} */
function ocrOf(supplied, page) {
  const list = supplied ? transcriptions(supplied) : null;
  if (!list) return null;
  const t = list.find((o) => o && o.page === page && Array.isArray(o.regions));
  const engine = t ? t.engine : undefined, regions = t ? t.regions : undefined;
  return typeof engine === "string" && engine && Array.isArray(regions) ? { page, engine, regions } : null;
}

/** R2–R6: the PDF reading of a financial report (`budget: false`) or a budget
 *  book (`budget: true`).
 *  @param {DoctypeContext} ctx
 *  @param {{ budget: boolean }} options
 *  @returns {TablesReading} */
export function readTables(ctx, { budget }) {
  const given = ctx.supplied;
  const supplied = given && typeof given === "object" ? given : null;
  const { noText, images } = markers(supplied);
  /** @type {ReadTable[]} */
  const tables = [];
  /** @type {UnreadImage[]} */
  const unread = [];
  /** @type {SkippedBlock[]} */
  const skipped = [];
  /** @type {UnreadPage[]} */
  const pages_unread = [];
  /** @type {Set<number>} */
  const read = new Set();
  for (const pg of byPage(linesOf(ctx))) {
    const page = pg.page;
    if (page !== null) read.add(page);
    const r = readPage(ctx, page, pg.lines, { chartSkip: budget });
    tables.push(...r.tables);
    skipped.push(...r.skipped);
    /* R6: an image table on a page with text. A caption or heading with no
       table read under it, on a page that paints an image, is a table printed
       as an image. */
    if (page !== null && images.has(page)) {
      const captioned = r.lines.some((l) => l.c.kind === "text"
        && (CAPTION.test(l.text.trim()) || matchIn(ctx, KEYS.HEADINGS, l.text.trim())));
      const usable = r.tables.some((t) => t.usable);
      if (captioned && !usable) {
        const ocr = budget ? ocrOf(supplied, page) : null;
        if (ocr) tables.push(...readOcr(ctx, ocr));
        else for (const rect of images.get(page) ?? [])
          unread.push({ page, rect, why: "image-only table, not read" });
      }
    }
  }
  /* R4, R6: pages with no text layer. */
  const all = new Set([...suppliedPages(supplied), ...noText]);
  for (const p of [...all].sort((a, b) => a - b)) {
    if (read.has(p) && !noText.has(p)) continue;
    const ocr = budget ? ocrOf(supplied, p) : null;
    if (ocr) { tables.push(...readOcr(ctx, ocr)); continue; }
    pages_unread.push({ page: p, why: budget
      ? localize("budget-doctypes.tables.no_text_layer_and_no_ocr", "no text layer, and no OCR transcription of the page was supplied: any table printed on it is not read")
      : localize("budget-doctypes.tables.no_text_layer_a_cover", "no text layer (a cover, a divider, a certificate or a chart): a financial report is read from its text layer only, and no table is read from this page") });
    if (budget && images.has(p))
      for (const rect of images.get(p) ?? []) unread.push({ page: p, rect, why: "image-only table, not read" });
  }
  return { tables, unread, skipped, pages_read: [...read].sort((a, b) => a - b), pages_unread };
}

/** R6: the tables of one page's OCR transcription, `method: "ocr"`. Each
 *  region is a line; its source is the transcription's own.
 *  @param {DoctypeContext} ctx
 *  @param {{ page: number, engine: string, regions: OcrRegion[] }} ocr
 *  @returns {ReadTable[]} */
function readOcr(ctx, ocr) {
  /** @type {Line[]} */
  const lines = [];
  for (const g of ocr.regions) {
    if (!g) continue;
    const text = g.text;
    if (typeof text === "string") lines.push({ text, offset: null, source: g.source || null, page: ocr.page });
  }
  return readPage(ctx, ocr.page, lines, { chartSkip: true, method: "ocr", engine: ocr.engine }).tables;
}
