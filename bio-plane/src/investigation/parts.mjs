/* investigation's parts to interpret (R26-R32; T53; N1272; K5445, K5453, K5495, K5496): the pure half. The terms an
 * investigation's own words give (R27), the kind of file a reading is (R29), the part of a reading a hit lies in, a
 * proposal's stable id, and the blocks a large sheet part is taken in (R26). No model is asked and no number here is a
 * rating: a term is matched as written and a proposal has no weight (K1471, DEC-89). This file imports no `ai-*`,
 * `agent-*` or `skills` module (R27, R32). */
import { sha256HexSync } from "../record-grammar/index.mjs";

/** R26: the most parts one mark names. */
export const MARK_PARTS_MAX = 50;
/** R27: the most proposals one call answers. */
export const PROPOSALS_MAX = 200;
/** R26 (`extraction` R115, R98): the in-extent cells one block of a sheet holds. */
export const BLOCK_CELLS = 20000;
/** R29: the kinds of file a proposal is measured for. */
export const FILE_KINDS = Object.freeze(["pdf", "document", "slides", "sheet"]);
/** R29 (PROVISIONAL, as `contradiction` R39's): `review_due` when accepted / offered reaches the rate over at least this many offered. */
export const PROPOSAL_REVIEW = Object.freeze({ rate: 0.95, min_offered: 30, provisional: true });
/** R29: what each part kind is a part of. */
const KIND_OF_PART = Object.freeze({ "pdf-page": "pdf", "doc-para": "document", "slide": "slides", "sheet-range": "sheet" });

/* The words that carry no subject of their own, left out of a word term (R27). Matched folded, whole words only. */
const STOP = new Set(("a an and are as at be been being but by can could did do does for from had has have how if in into is it its "
  + "of on or our so than that the their them then there these they this those to under up was we were what when where whether which "
  + "who whom whose why will with would about after before over any all each other such not no yes").split(" "));
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b(?:${MONTHS})\\s+\\d{1,2},\\s*\\d{4}\\b|\\b(?:${MONTHS})\\s+\\d{4}\\b`, "g");
const AMOUNT_RE = /[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|thousand))?|\b\d[\d,]*(?:\.\d+)?\s?(?:million|billion)\b/gi;
/* A name: two or more capitalised words in a row, or one capitalised word that does not open its sentence. */
const NAME_RE = /\b[A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+)+\b|(?<![.?!]\s|^)\b[A-Z][a-zA-Z'’-]{2,}\b/g;

/** R27: the terms an investigation's own words give, quoted as written: `[{term, kind: word|name|amount|date}]`, each
 *  once, in the order first met. `texts` are its questions' titles and text; `names` the names it follows or names.
 *  Mechanical: amounts and dates by pattern, names by capitals, words as the runs left once those and the stop words are
 *  taken out. */
export function termsOf(texts, names = []) {
  const out = [];
  const seen = new Set();
  const add = (term, kind) => {
    const t = String(term).replace(/\s+/g, " ").trim().replace(/[?.!,;:]+$/, "");
    const k = `${kind}\u0000${t.toLowerCase()}`;
    if (!t || t.length > 120 || seen.has(k)) return;
    seen.add(k);
    out.push({ term: t, kind });
  };
  for (const n of names) if (typeof n === "string" && n.trim()) add(n, "name");
  for (const raw of texts) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    let rest = raw;
    const take = (re, kind) => { rest = rest.replace(re, (m) => { add(m, kind); return " | "; }); };
    take(DATE_RE, "date");
    take(AMOUNT_RE, "amount");
    rest = rest.replace(NAME_RE, (m) => {
      /* a capital that only opens the sentence ("Did", "Was") is no part of the name */
      const words = m.split(/\s+/);
      while (words.length && STOP.has(words[0].toLowerCase())) words.shift();
      if (!words.length) return m;
      if (words.length === 1 && m.split(/\s+/).length > 1 && words[0].length < 3) return m;
      add(words.join(" "), "name");
      return " | ";
    });
    let run = [];
    const flush = () => { if (run.some((w) => w.length >= 3)) add(run.join(" "), "word"); run = []; };
    for (const tok of rest.split(/([^\p{L}\p{N}'’-]+)/u)) {
      if (!tok) continue;
      if (/^[\p{L}\p{N}'’-]+$/u.test(tok)) {
        const w = tok.toLowerCase();
        if (STOP.has(w) || /^\d+$/.test(w)) flush(); else run.push(w);
      } else if (!/^\s+$/.test(tok)) flush();
    }
    flush();
  }
  return out;
}

/** R29: the kind of file a reading's parts say it is (`partsOf`'s first part), else null. */
export const fileKindOf = (parts) => (Array.isArray(parts) && parts.length && KIND_OF_PART[parts[0].kind]) || null;

/* The row numbers a sheet extent names (`A12:F12`, `$B$3`, {from_row, to_row}). */
function rowsOf(extent) {
  if (typeof extent === "string") return [...extent.matchAll(/[A-Za-z]*\$?([1-9][0-9]*)/g)].map((m) => Number(m[1]));
  if (!extent || typeof extent !== "object") return [];
  if (Number.isInteger(extent.row)) return [extent.row];
  if (Number.isInteger(extent.from_row)) return [extent.from_row, Number.isInteger(extent.to_row) ? extent.to_row : extent.from_row];
  const r = typeof extent.range === "string" ? extent.range : typeof extent.ref === "string" ? extent.ref : typeof extent.cell === "string" ? extent.cell : "";
  return [...r.matchAll(/[A-Za-z]*\$?([1-9][0-9]*)/g)].map((m) => Number(m[1]));
}

/** R27: the index in `parts` (a reading's `partsOf`) of the part a hit lies in, or -1. A hit is a find item's `extent`
 *  (a page, a paragraph, a slide's shape, or a sheet's cells with `sheet`). */
export function partIndexOf(parts, extent, sheet = null) {
  if (!extent || (typeof extent !== "object" && typeof extent !== "string")) return -1;
  const at = typeof extent === "string" ? null : extent.kind === "pdf-page" ? ["pdf-page", extent.page] : extent.kind === "doc-para" ? ["doc-para", extent.para]
    : extent.kind === "slide-shape" || extent.kind === "slide" ? ["slide", extent.slide] : null;
  if (at) return parts.findIndex((p) => p.kind === at[0] && Number.isInteger(at[1]) && p.from <= at[1] && at[1] <= p.to);
  const name = typeof sheet === "string" && sheet ? sheet : typeof extent.sheet === "string" ? extent.sheet : null;
  const rows = rowsOf(extent);
  if (!name || !rows.length) return -1;
  const row = Math.min(...rows);
  return parts.findIndex((p) => p.kind === "sheet-range" && p.sheet === name && p.from_row <= row && row <= p.to_row);
}

/** R27, R28: a proposal's stable id, from its capture, its part and what it matched: the same input answers the same id,
 *  and a proposal whose words no longer match is no longer the same proposal. */
export function proposalId(capture, part, why) {
  const key = JSON.stringify(Object.keys(part).sort().map((k) => [k, part[k]]));
  const terms = [...new Set(why.map((w) => `${w.kind}:${w.term}`))].sort().join("|");
  return `PP-${sha256HexSync(`${capture}|${key}|${terms}`).slice(0, 16)}`;
}

/** R26 (`extraction` R115): a sheet part taken in blocks of at most BLOCK_CELLS in-extent cells (`cols` the sheet's
 *  used columns); any other part is its own one block. */
export function blocksOf(part, cols) {
  if (!part || part.kind !== "sheet-range" || !Number.isInteger(part.from_row) || !Number.isInteger(part.to_row)) return [part];
  const per = Math.max(1, Math.floor(BLOCK_CELLS / Math.max(1, Number.isInteger(cols) ? cols : 1)));
  const out = [];
  for (let from = part.from_row; from <= part.to_row; from += per)
    out.push({ ...part, from_row: from, to_row: Math.min(part.to_row, from + per - 1) });
  return out;
}

/** R27: two parts the same part (their fields, in any order). */
export const samePart = (a, b) => !!a && !!b && JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]]))
  === JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));
