/* Figures as printed, and the kinds of line a financial page is made of.
 *
 * Nothing here parses a figure's value, applies a scale, signs it or totals it
 * (R2, R11): a figure is the token exactly as the text layer gave it. What this
 * file decides is only WHERE a figure is: which tokens of a line are figures,
 * which are its label, and which lines are chart labels rather than table rows.
 * Every shape below is place-free: the print conventions of financial tables
 * (a dollar sign before or after, parentheses, a leading minus, a dash for nil,
 * a percent sign), measured on the documents `measures-T33/money-people.md` §4
 * and §7 name (the FY2014 Distiller ACFR prints `282,216$`; the FY2024 Wdesk
 * ACFR prints `$ 1,405,595`; a rendered budget page prints `-$9,794,467` and
 * `$308,925,155 (36.5%)`). */

/**
 * One line, classified: its kind, the label before its trailing figures and those figures as printed; for a chart label
 * its amount and parenthesised share, and for a dated heading line the mark that it is one.
 * @typedef {Object} Classified
 * @property {"blank" | "chart" | "text" | "row" | "years" | "figures"} kind
 * @property {string} label
 * @property {string[]} cells
 * @property {string} [amount]
 * @property {string} [share]
 * @property {true} [dated]
 */

const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+`;
/* One figure token, after `$`, `%` and parentheses separated by a space have
   been rejoined to it (see `tokens`). A dash alone (hyphen, en or em dash),
   with or without a dollar sign, is a printed nil and counts as a cell (R3). */
const FIGURE = new RegExp(
  String.raw`^(?:-?\$?-?(?:${NUM})%?\$?%?|-?\$?\(\$?-?(?:${NUM})%?\)\$?%?|\$?[—–-]\$?|\(\s*[—–-]\s*\))$`);
/* A bare year: the label of a statistical schedule's row, or a column header. */
const YEAR = /^(?:19|20)\d\d$/;
/* A chart label (R5): a label paired with an amount and a parenthesised share,
   the block a rendered budget page prints above its table's header row. */
const CHART_LABEL = /^(.*?)\s*(-?\$\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*\((\d+(?:\.\d+)?\s?%)\)\s*$/;

/* A date as a heading prints it ("June 30, 2024"): its year is no figure of a
   table. Month names are place-free language. */
const DATED = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?$/i;

/** @param {string} tok @returns {boolean} */
export function isFigure(tok) { return typeof tok === "string" && FIGURE.test(tok); }
/** @param {string} tok @returns {boolean} */
export function isYear(tok) { return typeof tok === "string" && YEAR.test(tok); }

/** Split a line into tokens, rejoining what a text layer split off a figure:
 *  a lone `$` or `-$` before a number, a lone `%` after one, and a lone `$`
 *  before a parenthesised number (`$ (257,422)`). The rejoined token keeps the
 *  space the text layer printed, so `as_read` is the figure as printed.
 *  @param {string} line
 *  @returns {string[]} */
export function tokens(line) {
  const raw = String(line).trim().split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t === undefined) continue;
    const next = raw[i + 1];
    if ((t === "$" || t === "-$") && next !== undefined && isFigure(t + next) && !/^[—–-]$/.test(next)) {
      out.push(t + " " + next); i++; continue;
    }
    if ((t === "$" || t === "-$") && next !== undefined && /^[—–-]$/.test(next)) {
      out.push(t + " " + next); i++; continue;
    }
    const last = out[out.length - 1];
    if (t === "%" && last !== undefined && isFigure(last.replace(/ /g, "") + "%")) {
      out[out.length - 1] = last + " %"; continue;
    }
    out.push(t);
  }
  return out;
}

/** True when a rejoined token is a figure (its printed space ignored). */
/** @param {string} t @returns {boolean} */
function figureToken(t) { return isFigure(t.replace(/ /g, "")); }

/** One line, classified.
 *  - `figures`: every token is a figure (a cell-per-line layout, or a row of a
 *    statistical schedule whose label is a year);
 *  - `row`: a label followed by one or more figures;
 *  - `chart`: a chart label (R5);
 *  - `text`: no trailing figure.
 *  `label` is the text before the trailing figures, `cells` the trailing
 *  figures as printed. A figure inside a label (an allowance stated in words)
 *  stays in the label: only TRAILING figures are cells.
 *  @param {string} line
 *  @returns {Classified} */
export function classify(line) {
  const s = String(line).trim();
  if (!s) return { kind: "blank", label: "", cells: [] };
  const chart = CHART_LABEL.exec(s);
  if (chart) return { kind: "chart", label: (chart[1] ?? "").trim(), cells: [], amount: chart[2] ?? "", share: `(${chart[3]})` };
  const toks = tokens(s);
  let k = toks.length;
  while (k > 0 && figureToken(toks[k - 1] ?? "")) k--;
  const cells = toks.slice(k);
  if (!cells.length) return { kind: "text", label: s, cells: [] };
  if (k === 0) {
    /* All figures. A statistical schedule prints a row as its year and its
       figures; a header prints years alone. */
    const first = cells[0] ?? "", second = cells[1] ?? "";
    if (cells.length >= 3 && isYear(first) && !isYear(second))
      return { kind: "row", label: first, cells: cells.slice(1) };
    if (cells.every(isYear)) return { kind: "years", label: "", cells };
    return { kind: "figures", label: "", cells };
  }
  const label = toks.slice(0, k).join(" ");
  if (cells.length === 1 && isYear(cells[0] ?? "") && DATED.test(label)) return { kind: "text", label: s, cells: [], dated: true };
  return { kind: "row", label, cells };
}

/** Words a wrapped label ends on, place-free: a label that ends here continues
 *  on the next line (R3). */
const CONNECTOR = /(?:,|-|&|\b(?:of|and|or|for|the|to|in|from|by|on|with|at|net|less|plus|a|an))\s*$/i;

/** True when `label` is the first part of a label wrapped onto `next` (R3):
 *  its parentheses are unbalanced, it ends on a connecting word, or the next
 *  line opens in lower case.
 *  @param {string} label
 *  @param {string} [next]
 *  @param {boolean} [nextIsRow]
 *  @returns {boolean} */
export function wraps(label, next, nextIsRow = false) {
  const open = (label.match(/\(/g) || []).length, close = (label.match(/\)/g) || []).length;
  if (open > close) return true;
  if (CONNECTOR.test(label)) return true;
  if (typeof next !== "string") return false;
  if (/^[a-z(]/.test(next.trim())) return true;
  /* A long label left without figures, then a row whose own label is a word or
     two: one label wrapped onto the row's line (a budget's fund table prints
     "… Parks and Recreation" over "Department $3,957,409 …"). A
     section's name is short, in capitals or closed by a colon, and is not. */
  const words = label.trim().split(/\s+/);
  return nextIsRow && words.length >= 4 && !/:$/.test(label.trim()) && label !== label.toUpperCase()
    && next.trim().split(/\s+/).length <= 2;
}

/** A total or subtotal row, by its label, in place-free words. */
export const TOTAL = /\b(?:sub-?)?totals?\b/i;

/** The scale a heading states, as written (R2), or null. Place-free. */
/** @type {RegExp} */
const SCALE = /\b(in\s+(?:thousands|millions|billions)(?:\s+of\s+dollars)?|in\s+\$?\s?(?:000s|000's))\b/i;
/** @param {string} line @returns {string | null} */
export function scaleIn(line) {
  const m = SCALE.exec(String(line));
  return m ? m[1] ?? null : null;
}

/** A table caption a budget book prints, in place-free words ("Table 1:",
 *  "Schedule 3", "Exhibit A"). The view's headings name the rest (R1). */
export const CAPTION = /^(?:table|schedule|exhibit)\s+[A-Z0-9][\w.-]*\s*[:.\-–—]?/i;

/** A sentence: it ends a table region. Measured: no table row of the
 *  fixtures' tables is a sentence of eight words or more ending in a period.
 *  @param {string} line
 *  @returns {boolean} */
export function isSentence(line) {
  const s = String(line).trim();
  return /[.!?]["”’)]?$/.test(s) && s.split(/\s+/).length >= 8;
}

/** A line of prose, or of a paragraph wrapped mid-sentence: no header of a
 *  table. Inside a table a long label reads the same way, so only a sentence
 *  (`isSentence`) ends a table.
 *  @param {string} line
 *  @returns {boolean} */
export function isProse(line) {
  const s = String(line).trim();
  const words = s.split(/\s+/);
  if (words.length < 8) return false;
  if (isSentence(s)) return true;
  /* A line of running prose wrapped mid-sentence: most of its words in lower
     case, where a header's or a label's words are capitalised. */
  const lower = words.filter((w) => /^[a-z]/.test(w)).length;
  return lower / words.length >= 0.5;
}
