/* The CLASSIFICATION VIEW: the bounded text a long document is classified from (R39, R40; G48, fix round 9 G133f).
 *
 * Moved out of `readtext.mjs` so the registry's walk (`doctypes/registry.mjs`) can bound every caller of `doctypeFor`, not only
 * `readText`; `readtext.mjs` re-exports these names unchanged. */
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/** The segment map of an itemised array over a `document` string it is compared with,
 *  or null when the array's own join (joinItemised's) is not that string byte for byte.
 *  The comparison walks the document in place and builds no joined copy (R38): the
 *  answer is the one `joinItemised(...).text === document` gives, at no whole-text cost. */
export function segmentsOver(document, items, textOf, sourceOf) {
  const segments = [];
  let pos = 0;
  for (let i = 0; i < items.length; i++) {
    const t = textOf(items[i]);
    if (!t || !t.length) continue;
    if (pos) {
      if (document.charCodeAt(pos) !== 10) return null;
      pos++;
    }
    if (!document.startsWith(t, pos)) return null;
    const start = pos;
    pos += t.length;
    const source = sourceOf(items[i], i);
    if (source) segments.push({ start, end: pos, source });
  }
  return pos === document.length ? segments : null;
}

/* G48 (fix round 6; K4673, K4571) — A SHEET OVER A BOUND IS CLASSIFIED FROM A STATED VIEW.
   `doctypeFor` asks every registered type's `detect` about the text, and the types read what they are handed whole: over a
   17 MiB CSV's 15.6 M characters that was most of the first reading tick. A sheet's body is rows of one shape, so a type
   that recognises a table recognises it from the head and a spread of windows; a type that recognises a document by a
   phrase can still be missed by a sample, which is why the view is STATED on the answer (`classified_over`) and in `why`,
   never silent (K4571). Only a sheet container (`supplied.sheets`) is sampled; a PDF's text, a page, a paragraph shape and
   a bare string are classified whole, of any size, because their type may rest on any page. `identify` (the stack) and the
   type's `parse` keep the whole text: the stack answer never changes and a matched type reads the whole sheet.

   The numbers are protective bounds (BOB reports them, K1881), set by measure: the view is at most 1.5 MiB so that every
   `detect` is handed under the 2 MiB where the text is classified whole. */
export const CLASSIFY_WHOLE_MAX_CHARS = 2 * 1024 * 1024;
export const CLASSIFY_VIEW_MAX_CHARS = 1536 * 1024;
export const CLASSIFY_HEAD_CHARS = 256 * 1024;
export const CLASSIFY_LINE_SLACK_CHARS = 16 * 1024;
export const CLASSIFY_WINDOWS = 12;
export const CLASSIFY_WINDOW_CHARS = 96 * 1024;
export const CLASSIFY_SHEET_HEADS_MAX_CHARS = 64 * 1024;
export const CLASSIFY_SHEET_HEAD_CHARS = 16 * 1024;
const LIMITS = {
  view: CLASSIFY_VIEW_MAX_CHARS, head: CLASSIFY_HEAD_CHARS, slack: CLASSIFY_LINE_SLACK_CHARS, windows: CLASSIFY_WINDOWS,
  window: CLASSIFY_WINDOW_CHARS, sheetHeads: CLASSIFY_SHEET_HEADS_MAX_CHARS, sheetHead: CLASSIFY_SHEET_HEAD_CHARS,
};

const isHigh = (c) => c >= 0xD800 && c <= 0xDBFF;
const isLow = (c) => c >= 0xDC00 && c <= 0xDFFF;
/* A cut at `at` (the boundary between at-1 and at) that does not split a surrogate pair: an END moves back, a START forward. */
const endCut = (t, at) => (at > 0 && at < t.length && isHigh(t.charCodeAt(at - 1)) && isLow(t.charCodeAt(at)) ? at - 1 : at);
const startCut = (t, at) => (at > 0 && at < t.length && isHigh(t.charCodeAt(at - 1)) && isLow(t.charCodeAt(at)) ? at + 1 : at);
/* The end (exclusive) of the whole lines of t[from, to): at the last newline in the range, else `to` itself (a line longer
   than the range is cut at its size). */
function lineEndBefore(t, from, to) {
  if (to >= t.length || t.charCodeAt(to) === 10) return to;
  const nl = t.lastIndexOf("\n", to - 1);
  return nl > from ? nl : endCut(t, to);
}

/** The view a sheet over the bound is classified from, and what it holds (offsets are into `text`): the sheets' first lines
 *  (`sheet_heads`, under one budget), the first `head` characters cut forward to a line end, then `windows` windows of whole
 *  lines spread evenly over the rest, the last ending at the text's end; the pieces joined by one newline and never over
 *  `view` characters. `sheets` is the supplied `sheets` array: its boundaries are used only when its non-empty texts joined
 *  by a newline are `text` (as `segmentsOver` checks), else `heads_used` is false. When the pieces would pass `view`, the
 *  sheet heads are dropped first (`heads_used` false), then the earliest windows, never the last, then the head is cut back. */
export function classificationView(text, sheets = null, limits = LIMITS) {
  const n = text.length;
  let headEnd = Math.min(n, limits.head);
  if (headEnd < n && text.charCodeAt(headEnd) !== 10) {
    const nl = text.indexOf("\n", headEnd);
    headEnd = nl >= 0 && nl - headEnd <= limits.slack ? nl : endCut(text, headEnd);
  }
  const windows = [];
  const S = limits.window, W = Math.max(1, limits.windows), rest = n - headEnd;
  let prev = headEnd;
  for (let i = 0; i < W && rest > 0; i++) {
    const last = i === W - 1;
    const floor = text.charCodeAt(prev) === 10 ? prev + 1 : prev;
    const ideal = W === 1 ? n - S : headEnd + Math.floor(((rest - S) * i) / (W - 1 || 1));
    let from = Math.max(last ? n - S : ideal, floor);
    if (from > floor && text.charCodeAt(from - 1) !== 10) {
      const nl = text.indexOf("\n", from);
      from = nl >= 0 && nl - from < S ? nl + 1 : startCut(text, from);
    }
    const to = last ? n : lineEndBefore(text, from, Math.min(n, from + S));
    if (to <= from) continue;
    windows.push({ from, to });
    prev = to;
  }
  const segs = Array.isArray(sheets) && sheets.length
    ? segmentsOver(text, sheets, (x) => (x && typeof x.text === "string" ? x.text : ""), (x, i) => ({ i })) : null;
  let headsUsed = segs !== null, heads = [];
  if (segs) {
    const covered = [{ from: 0, to: headEnd }, ...windows];
    let budget = limits.sheetHeads;
    for (const sg of segs) {
      if (budget <= 0) break;
      let a = sg.start, b = Math.min(sg.end, a + Math.min(limits.sheetHead, budget));
      if (b < sg.end) b = lineEndBefore(text, a, b);
      for (const c of covered) {
        if (a >= c.from && a <= c.to) a = c.to + (text.charCodeAt(c.to) === 10 ? 1 : 0);
        else if (c.from > a && c.from < b) b = text.charCodeAt(c.from - 1) === 10 ? c.from - 1 : c.from;
      }
      if (a >= b) continue;
      heads.push({ from: a, to: b });
      budget -= b - a;
    }
  }
  const size = () => heads.concat([{ from: 0, to: headEnd }], windows).reduce((m, x) => m + x.to - x.from + 1, -1);
  if (size() > limits.view && heads.length) { heads = []; headsUsed = false; }
  while (size() > limits.view && windows.length > 1) windows.shift();
  if (size() > limits.view) {
    const room = limits.view - (size() - headEnd);
    headEnd = Math.max(0, lineEndBefore(text, 0, Math.max(0, room)));
  }
  const view = [...heads.map((x) => text.slice(x.from, x.to)), text.slice(0, headEnd), ...windows.map((x) => text.slice(x.from, x.to))].join("\n");
  return { view, of: n, chars: view.length, head_chars: headEnd, windows, sheet_heads: heads, heads_used: headsUsed };
}

/** The sentence `readText` appends to `why` when it classified a text from a view; code-origin words (K3930). */
export function classifiedWhy(co) {
  return localize("docprofile.readtext.the_text_is_over_the_bound_so_its_type_was_judged_from_a_view",
    "the text is over {bound} characters, so its type was judged from {chars} of its {of} characters, the first {head} and {n} windows spread across it; the stack and the reading of it are from all of it",
    { bound: String(CLASSIFY_WHOLE_MAX_CHARS), chars: String(co.chars), of: String(co.of), head: String(co.head_chars), n: String(co.windows.length) });
}
