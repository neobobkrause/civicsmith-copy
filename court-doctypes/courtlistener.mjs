/* `courtlistener_docket`: a CourtListener docket page, read as a register (R1, R3–R6, R8).
 *
 * MEASURED on docket 4214664 (`measures-T33/courts-workbooks.md` §1 (b); the fixtures in `test/fixtures`,
 * captured 2026-10-05). The page is server-rendered HTML. Its header is an `<h1>` naming the docket
 * (`data-type="search.Docket"`), the case name, and the docket number in parentheses; then the court as an
 * `<h2>`; then labelled fields (`meta-data-header` / `meta-data-value`): Last Updated, Assigned To,
 * Citation, Date Filed, Date of Last Known Filing, Cause, Nature of Suit, Jury Demand, Jurisdiction Type.
 * Each register row is `div#entry-<n>` (numbered) or `div#minute-entry-<id>` (an unnumbered minute
 * entry, its number cell empty; `<id>` is CourtListener's own row id, not an entry number), holding the
 * number, the date filed, the docket text (the court's own words, "(Entered: …)" included), and each
 * RECAP document with its links. The pagination reads "Page n of m".
 *
 * This structure is CourtListener's own, the same for every court it publishes, so it stays in code; the
 * address it is served at, and the number forms, come from the view (R15). Nothing is followed: a
 * document link is listed with its label as written, a fee-bearing one ("Buy on PACER") marked `fee`. */
import { CONTRACT, TAG, feeBearing, written, element, elements, linksIn, sourceAt,
  proceedingNumber, row, reading, pageOf, assessRegister, detectAnswer } from "./common.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

const KEY = "courtlistener_docket";
const LABEL = localize("court-doctypes.courtlistener.label", "a CourtListener docket");

const HEADER = /<h1\b[^>]*\bdata-type\s*=\s*["']search\.Docket["']/i;
const ROW_START = new RegExp(`<div\\b(?=${TAG}\\bid\\s*=\\s*["'](?:minute-)?entry-[0-9]+["'])${TAG}>`, "gi");

/** The labelled header fields, `{label → {value, at}}`, each value as written. */
function headerFields(html) {
  const out = new Map();
  const re = new RegExp(`<span\\b${TAG}\\bclass\\s*=\\s*["'][^"']*\\bmeta-data-header\\b[^"']*["']${TAG}>([\\s\\S]*?)<\\/span\\s*>\\s*(<span\\b${TAG}>)`, "gi");
  for (const m of html.matchAll(re)) {
    const label = written(m[1]);
    if (!label) continue;
    const e = element(html, m.index + m[0].length - m[2].length);
    if (!e) continue;
    const name = label.replace(/:\s*$/, "");
    if (!out.has(name)) out.set(name, { value: written(e.inner), html: e.inner, at: m.index });
  }
  return out;
}

function detect(ctx) {
  const html = String((ctx && ctx.text) || "");
  const header = HEADER.test(html);
  ROW_START.lastIndex = 0;
  const rows = ROW_START.test(html);
  return detectAnswer({ ctx, key: KEY, label: LABEL, what: "a CourtListener docket's register",
    structure: header && rows, structureSignals: ["a docket header", "entry rows (div#entry-n)"] });
}

/** One register row: its number, date, text and documents, each as written. */
function readRow(ctx, html, e) {
  const id = /\bid\s*=\s*["']((minute-)?entry-([0-9]+))["']/i.exec(e.match[0]);
  const cells = elements(e.inner, new RegExp(`<div\\b${TAG}>`, "gi"));
  const ps = (c) => (c ? elements(c.inner, new RegExp(`<p\\b${TAG}>`, "gi")) : []);
  const numberCell = cells[0], dateCell = cells[1], body = cells[2];
  const number = numberCell ? written(numberCell.inner) : null;
  const date = dateCell ? written(dateCell.inner) : null;
  /* The text is the body's own paragraphs, the documents' rows set aside. */
  let text = null;
  const links = [], documents = [];
  if (body) {
    const docs = elements(body.inner, new RegExp(`<div\\b(?=${TAG}\\bclass\\s*=\\s*["'][^"']*\\brecap-documents\\b)${TAG}>`, "gi"));
    let rest = body.inner;
    for (const d of [...docs].reverse()) rest = rest.slice(0, d.start) + " " + rest.slice(d.end);
    text = written(rest);
    for (const d of docs) {
      const parts = elements(d.inner, new RegExp(`<div\\b${TAG}>`, "gi"));
      /* A document's own label ("Main Document", "Attachment 1") is its first cell's link; its
         description is the cell after. A minute entry's document row holds only a description. */
      const first = parts[0] ? linksIn(parts[0].inner) : [];
      const document = first.length ? first[0].label : null;
      const description = parts.map((p) => (linksIn(p.inner).length ? null : written(p.inner))).find((x) => x) || null;
      documents.push({ document, description });
      const base = e.innerStart + body.innerStart + d.innerStart;
      for (const l of linksIn(d.inner, base)) {
        if (!l.label) continue;
        links.push({ document, description, label: l.label, href: l.href, fee: feeBearing(l.label) });
      }
    }
  }
  const numbered = number != null && /^[0-9]+$/.test(number) && id && !id[2];
  const r = row({
    key: numbered ? `entry:${number}`
      : `minute:${date ?? ""}|${text ?? documents.map((x) => x.description || x.document || "").join("; ")}`,
    entry_id: numbered ? number : null,
    date, text, links, documents, source: sourceAt(ctx, e.start),
  });
  if (!numbered && date == null && text == null && !documents.length) return { unkeyed: { at: e.start, why: localize("court-doctypes.courtlistener.an_unnumbered_entry_with", "an unnumbered entry with neither a date nor a text, so it has no key") } };
  return { row: r };
}

function parse(ctx) {
  const html = String((ctx && ctx.text) || "");
  const fields = headerFields(html);
  const h1m = HEADER.exec(html);
  const h1 = h1m ? element(html, h1m.index) : null;
  let caption = null, numberWritten = null;
  if (h1) {
    const spans = elements(h1.inner, new RegExp(`<span\\b(?=${TAG}\\bclass\\s*=\\s*["'][^"']*\\bselect-all\\b)${TAG}>`, "gi"));
    caption = spans[0] ? written(spans[0].inner) : null;
    numberWritten = spans[1] ? written(spans[1].inner) : null;
  }
  /* The court is the heading the page sets directly after the docket's own. */
  let after = h1 ? html.slice(h1.end) : "";
  /* A dialog the page holds for later (a sign-in prompt) is not the page's heading: set aside. */
  for (const m of elements(after, new RegExp(`<div\\b(?=${TAG}\\bclass\\s*=\\s*["'][^"']*\\bmodal\\b)${TAG}>`, "gi")).reverse())
    after = after.slice(0, m.start) + " ".repeat(m.end - m.start) + after.slice(m.end);
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i.exec(after);
  const forum = h2 && !/<(?:h1|div\b[^>]*\bid\s*=\s*["'](?:minute-)?entry-)/i.test(after.slice(0, h2.index)) ? written(h2[1]) : null;
  const value = (k) => (fields.has(k) ? fields.get(k).value : null);
  const terminated = fields.has("Date Terminated") ? `Date Terminated: ${value("Date Terminated")}` : null;
  const n = proceedingNumber(ctx, numberWritten);
  const proceeding = {
    number: n.number, number_as_written: numberWritten, caption, forum_as_written: forum,
    kind_as_written: value("Nature of Suit"), status_as_written: terminated, filed: value("Date Filed"),
    source: h1 ? sourceAt(ctx, h1.start) : null,
    docket_number_core: null,
    fields_as_written: Object.fromEntries([...fields].map(([k, v]) => [k, v.value])),
  };
  const why = {};
  if (n.why) why.number = n.why;
  if (!terminated) why.status_as_written = localize("court-doctypes.courtlistener.the_docket_page_states_no", "the docket page states no status; a terminated case shows a Date Terminated field, and this page has none");
  why.docket_number_core = "the docket page does not state CourtListener's docket_number_core (its API does), so it is not given";
  proceeding.why = why;

  const parties = [];
  for (const role of ["Assigned To", "Referred To"]) {
    if (!fields.has(role)) continue;
    const f = fields.get(role);
    const names = linksIn(f.html).map((l) => l.label).filter(Boolean);
    for (const name of names.length ? names : [f.value].filter(Boolean))
      parties.push({ name, role_as_written: role, source: sourceAt(ctx, f.at) });
  }

  const rows = [], unkeyed = [];
  for (const e of elements(html, ROW_START)) {
    const r = readRow(ctx, html, e);
    if (r.row) rows.push(r.row); else unkeyed.push(r.unkeyed);
  }
  const pm = /Page\s*<\/span>\s*([0-9]+)\s+of\s+([0-9]+)/i.exec(html) || /\(Page\s+([0-9]+)\s+of\s+([0-9]+)\)/i.exec(html.replace(/\s+/g, " "));
  const pagination = pm ? pageOf(Number(pm[1]), Number(pm[2])) : pageOf(null, null);
  return reading({
    type: KEY, proceeding, parties, rows, pagination, provisional: false, at: (ctx && ctx.at) || null,
    failed: h1 ? null : localize("court-doctypes.courtlistener.the_page_holds_no_courtlistener", "the page holds no CourtListener docket header"),
    key_basis: localize("court-doctypes.courtlistener.key_basis", "courtlistener_docket: a numbered entry is keyed by the entry number CourtListener gives it (entry_id); an unnumbered (minute) entry by its date and its text as written (or, with no text, its documents' descriptions), and twins on one reading by their order among themselves"),
    notes: unkeyed.length ? { unkeyed } : null,
  });
}

export default {
  key: KEY, label: LABEL, version: 1,
  /* A register is a list: what matters is which rows it holds and whether each still says what it said. */
  contract: CONTRACT.MEMBERSHIP,
  detect, parse,
  assess(before, after) { return assessRegister(before, after); },
};

