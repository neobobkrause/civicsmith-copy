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
 *  page `ctx.locate` places it on (null where it cannot say). */
export function linesOf(ctx) {
  const text = typeof ctx.text === "string" ? ctx.text : "";
  const locate = typeof ctx.locate === "function" ? ctx.locate : () => null;
  const out = [];
  let offset = 0, page = null;
  for (const raw of text.split("\n")) {
    const lead = raw.length - raw.trimStart().length;
    /* A blank line is placed nowhere, and stays with the page around it. */
    const source = raw.trim() ? locate(offset + lead) : null;
    if (raw.trim()) page = source && Number.isInteger(source.page) ? source.page : null;
    out.push({ text: raw, offset: offset + lead, source: source || null, page });
    offset += raw.length + 1;
  }
  return out;
}

/** Group lines by page, in reading order: `[{page, lines}]`. */
function byPage(lines) {
  const pages = [];
  for (const l of lines) {
    const last = pages[pages.length - 1];
    if (last && last.page === l.page) last.lines.push(l);
    else pages.push({ page: l.page, lines: [l] });
  }
  return pages;
}

/** Read the tables of one page's lines. `chartSkip` sets aside chart labels
 *  (R5, a budget book); otherwise a chart-shaped line is read as text. */
export function readPage(ctx, page, lines, { chartSkip = false, method = "text-layer", engine } = {}) {
  const cls = lines.map((l) => ({ ...l, c: classify(l.text) }));
  const skipped = [];
  /* R5: the chart-label block. A chart label's own label is either on its line
     or the line before; both are set aside, never read as a row. */
  for (let i = 0; i < cls.length; i++) {
    if (cls[i].c.kind !== "chart") continue;
    if (!chartSkip) { cls[i].c = { kind: "text", label: cls[i].text.trim(), cells: [] }; continue; }
    const lines = [];
    if (!cls[i].c.label && i > 0 && cls[i - 1].c.kind === "text" && !cls[i - 1].chart) {
      cls[i - 1].chart = true; lines.push(cls[i - 1].text.trim());
    }
    lines.push(cls[i].text.trim());
    cls[i].chart = true;
    skipped.push({ page, lines, why: localize("budget-doctypes.tables.chart_labels_a_label", "chart labels: a label paired with an amount and a parenthesised share, printed above a table; not a row of it, and the share is not a negative figure") });
  }
  const live = cls.filter((l) => !l.chart && l.c.kind !== "blank");
  /* A year alone on its line, directly above a line of figures, is that row's
     label (a statistical schedule in a cell-per-line layout). */
  for (let i = 0; i + 1 < live.length; i++)
    if (live[i].c.kind === "years" && live[i].c.cells.length === 1 && live[i + 1].c.kind === "figures")
      live[i].c = { kind: "text", label: live[i].c.cells[0], cells: [] };
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
  const regions = [];
  let cur = null, gap = 0;
  for (let i = 0; i < live.length; i++) {
    const k = live[i].c.kind;
    /* A line of one figure opens a table only under a label (a cell-per-line
       layout); under prose or a heading it is a page number or a stray figure. */
    const prev = i > 0 ? live[i - 1] : null;
    const bears = k === "row" || (k === "figures" && (cur || live[i].c.cells.length >= 2
      || (prev && prev.c.kind === "text" && !prev.meta && !isProse(prev.text))));
    if (bears) {
      if (!cur) cur = { start: i, end: i };
      else cur.end = i;
      gap = 0;
    } else if (cur) {
      gap++;
      if (gap > TABLE_GAP || isSentence(live[i].text) || live[i].meta) { regions.push(cur); cur = null; gap = 0; }
    }
  }
  if (cur) regions.push(cur);

  const tables = [];
  let prevEnd = -1;
  for (let r = 0; r < regions.length; r++) {
    const reg = regions[r];
    const nextStart = r + 1 < regions.length ? regions[r + 1].start : live.length;
    tables.push(buildTable(ctx, page, live, reg, prevEnd, nextStart, method, engine));
    prevEnd = reg.end;
  }
  /* A region with no row of two or more figures is not a table: a page number,
     a figure in a sentence's line. Its figures are not cells of anything. */
  return { tables: tables.filter((t) => t.rows.filter((r) => r.cells.length >= 2).length >= MIN_ROWS), skipped,
           lines: live };
}

function buildTable(ctx, page, live, reg, prevEnd, nextStart, method, engine) {
  /* The rows. A text line opens a label; a wrapped label continues it (R3); a
     row line closes it with its figures; figure-only lines after a label (a
     cell-per-line layout) are that row's cells, until the next text line. */
  let i = reg.start;
  /* Header lines above the first row: a run of figure-less lines (and lines of
     years) back to the title, the scale, a period, prose or HEADER_LINES. A
     line in capitals alone directly above the first row is a section, not a
     header. */
  const header = [];
  {
    let j = reg.start - 1;
    /* A label opening the first row (a cell-per-line layout prints the label on
       its own line) belongs to the row, not the header. */
    if (live[reg.start].c.kind === "figures" && j > prevEnd && live[j].c.kind === "text") j--;
    for (let n = 0; n < 2 && j > prevEnd && live[j].c.kind === "text"
         && (/^[A-Z][A-Z &,'()-]+:?$/.test(live[j].text.trim()) || /:$/.test(live[j].text.trim())); n++) j--;
    let years = false;
    for (let n = 0; j > prevEnd && n < HEADER_LINES; j--, n++) {
      const l = live[j];
      const t = l.text.trim();
      if (l.c.kind === "years") { header.unshift(l); years = true; n--; continue; }
      if (l.c.kind !== "text") break;
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
  while (i <= reg.end && live[i].c.kind === "years") { header.push(live[i]); i++; }

  const rows = [];
  let pending = null; // {label, line}
  let open = null;    // the row figure-only lines extend
  const flushPending = () => {
    if (pending) rows.push(row(pending.label, [], pending.line, false));
    pending = null;
  };
  /* A label line directly above the region opens its first row. */
  if (reg.start - 1 > prevEnd && live[reg.start].c.kind === "figures" && live[reg.start - 1].c.kind === "text"
      && !header.includes(live[reg.start - 1]))
    pending = { label: live[reg.start - 1].text.trim(), line: live[reg.start - 1] };
  for (; i <= reg.end; i++) {
    const l = live[i];
    const { kind, label, cells } = l.c;
    if (kind === "text") {
      open = null;
      if (pending && wraps(pending.label, label)) { pending.label += " " + label; continue; }
      flushPending();
      pending = { label, line: l };
      continue;
    }
    if (kind === "row") {
      let lab = label, at = l;
      if (pending && wraps(pending.label, label, true)) { lab = pending.label + " " + label; at = pending.line; pending = null; }
      else flushPending();
      open = row(lab, cells, at, false);
      rows.push(open);
      continue;
    }
    if (kind === "figures" || kind === "years") {
      /* Figures under a label: that row's cells, one or several to a line (a
         cell-per-line layout continues the row line by line). Figures under a
         row that already read its own figures are another row, whose label the
         text read does not hold where its figures are. */
      if (pending) { open = row(pending.label, cells, pending.line, false); open.perLine = cells.length === 1; rows.push(open); pending = null; }
      else if (open && open.perLine && cells.length === 1) open.cells.push({ as_read: cells[0] });
      else {
        open = row(null, cells, l, false);
        open.label_why = localize("budget-doctypes.tables.no_label_was_read_beside", "no label was read beside these figures in the text read");
        rows.push(open); open = null;
      }
    }
  }
  flushPending();
  for (const r of rows) delete r.perLine;

  /* R3: usable at the modal cell count, with headers. */
  const counted = rows.filter((r) => r.cells.length >= 2);
  const freq = new Map();
  for (const r of counted) freq.set(r.cells.length, (freq.get(r.cells.length) || 0) + 1);
  let modal = null, top = 0;
  for (const [n, f] of freq) if (f > top || (f === top && n > modal)) { modal = n; top = f; }
  for (const r of counted)
    if (r.cells.length !== modal && r.label && TOTAL.test(r.label)) r.span = true;
  const modal_share = counted.length ? Math.round((top / counted.length) * 1000) / 1000 : 0;
  const columns = header.map((l) => l.text.trim());
  let usable = true, why = null;
  if (!counted.length) { usable = false; why = localize("budget-doctypes.tables.no_row_holds_two", "no row holds two or more figures"); }
  else if (modal_share < USABLE_SHARE) {
    usable = false;
    why = localize("budget-doctypes.tables.only_v1_of_the_length", "only {v1}% of the {length} rows holding two or more figures have the table's modal {modal} cells (at least {v2}% needed)", { v1: String(counted.length ? Math.round(modal_share * 100) : 0), length: String(counted.length), modal: String(modal), v2: String(USABLE_SHARE * 100) });
  } else if (!columns.length) { usable = false; why = localize("budget-doctypes.tables.the_table_s_headers", "the table's headers are not in the text read"); }

  /* Title, period and scale from the lines above the table (to the previous
     table), else below it (a layout that prints its heading after its body). */
  const above = live.slice(prevEnd + 1, reg.start);
  const below = live.slice(reg.end + 1, nextStart);
  const head = describe(ctx, above) || describe(ctx, below) || describe(ctx, live.slice(0, reg.start).reverse()) || {};
  const period = periodIn(ctx, above) || periodIn(ctx, below) || periodIn(ctx, header);
  const scale = scaleOf(above) || scaleOf(below);
  const t = {
    title: head.title || null, page, period_as_written: period, scale, columns, rows, usable, modal_share,
    why, method,
  };
  if (engine) t.engine = engine;
  if (!t.title) t.title_why = localize("budget-doctypes.tables.no_heading_the_view", "no heading the view names, and no table caption, was read above or below the table");
  if (!t.period_as_written)
    t.period_why = localize("budget-doctypes.tables.no_fiscal_year_form", "no fiscal-year form the view holds was read above, below or in the header of the table");
  return t;
}

function row(label, cells, line, span) {
  const r = { label: label === null ? null : label, cells: cells.map((c) => ({ as_read: c })), span };
  r.source = line.source || null;
  return r;
}

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

function periodCount(ctx, line) {
  const s = String(line).trim();
  let n = 0;
  for (const tok of s.split(/\s+/)) if (isYear(tok) || matchIn(ctx, KEYS.FISCAL_YEARS, tok)) n++;
  return n;
}

function periodIn(ctx, lines) {
  for (const l of lines) {
    const m = matchIn(ctx, KEYS.FISCAL_YEARS, l.text);
    if (m) return m.text;
  }
  return null;
}

function scaleOf(lines) {
  for (const l of lines) { const s = scaleIn(l.text); if (s) return s; }
  return null;
}

/** The pages the supplied text says it could not read, from its markers. */
function markers(supplied) {
  const noText = new Set(), images = new Map();
  if (!supplied || typeof supplied !== "object") return { noText, images };
  const all = [];
  if (Array.isArray(supplied.undetermined)) all.push(...supplied.undetermined);
  if (Array.isArray(supplied.pages))
    for (const p of supplied.pages) if (p && Array.isArray(p.undetermined)) all.push(...p.undetermined);
  for (const m of all) {
    if (!m || !Number.isInteger(m.page)) continue;
    if (m.reason === "no_text_layer") noText.add(m.page);
    if (m.reason === "image_unread" && Array.isArray(m.rect)) addImage(images, m.page, m.rect);
  }
  if (Array.isArray(supplied.images))
    for (const im of supplied.images) if (im && Number.isInteger(im.page) && Array.isArray(im.rect)) addImage(images, im.page, im.rect);
  return { noText, images };
}

function addImage(images, page, rect) {
  const list = images.get(page) || [];
  const key = rect.join(",");
  if (!list.some((r) => r.join(",") === key)) list.push(rect);
  images.set(page, list);
}

/** Every page index the supplied text holds, with or without text. */
function suppliedPages(supplied) {
  const out = new Set();
  if (supplied && Array.isArray(supplied.pages))
    for (const p of supplied.pages) if (p && Number.isInteger(p.page)) out.add(p.page);
  return out;
}

/** An OCR transcription of `page` the supplied text carries, or null. */
function ocrOf(supplied, page) {
  if (!supplied || !Array.isArray(supplied.ocr)) return null;
  const t = supplied.ocr.find((o) => o && o.page === page && Array.isArray(o.regions));
  return t && typeof t.engine === "string" && t.engine ? t : null;
}

/** R2–R6: the PDF reading of a financial report (`budget: false`) or a budget
 *  book (`budget: true`). */
export function readTables(ctx, { budget }) {
  const supplied = ctx.supplied && typeof ctx.supplied === "object" ? ctx.supplied : null;
  const { noText, images } = markers(supplied);
  const tables = [], unread = [], skipped = [], pages_unread = [];
  const read = new Set();
  for (const pg of byPage(linesOf(ctx))) {
    if (pg.page !== null) read.add(pg.page);
    const r = readPage(ctx, pg.page, pg.lines, { chartSkip: budget });
    tables.push(...r.tables);
    skipped.push(...r.skipped);
    /* R6: an image table on a page with text. A caption or heading with no
       table read under it, on a page that paints an image, is a table printed
       as an image. */
    if (pg.page !== null && images.has(pg.page)) {
      const captioned = r.lines.some((l) => l.c.kind === "text"
        && (CAPTION.test(l.text.trim()) || matchIn(ctx, KEYS.HEADINGS, l.text.trim())));
      const usable = r.tables.some((t) => t.usable);
      if (captioned && !usable) {
        const ocr = budget ? ocrOf(supplied, pg.page) : null;
        if (ocr) tables.push(...readOcr(ctx, ocr));
        else for (const rect of images.get(pg.page))
          unread.push({ page: pg.page, rect, why: "image-only table, not read" });
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
      for (const rect of images.get(p)) unread.push({ page: p, rect, why: "image-only table, not read" });
  }
  return { tables, unread, skipped, pages_read: [...read].sort((a, b) => a - b), pages_unread };
}

/** R6: the tables of one page's OCR transcription, `method: "ocr"`. Each
 *  region is a line; its source is the transcription's own. */
function readOcr(ctx, ocr) {
  const lines = ocr.regions.filter((g) => g && typeof g.text === "string")
    .map((g) => ({ text: g.text, offset: null, source: g.source || null, page: ocr.page }));
  return readPage(ctx, ocr.page, lines, { chartSkip: true, method: "ocr", engine: ocr.engine }).tables;
}
