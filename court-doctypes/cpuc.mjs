/* `cpuc_proceeding`: a CPUC proceeding card and its documents report, read as a register (R1, R3–R6, R8).
 *
 * MEASURED on proceeding A2106021 (`measures-T33/courts-workbooks.md` §1 (c); the fixtures in
 * `test/fixtures`, captured 2026-10-05). Both are pages of the commission's Oracle APEX application,
 * server-rendered, with no sign-in. The CARD (the "Proceeding" tab) heads with `<H1>number - Proceeding</H1>`
 * and lays its fields out as APEX form items, a `<label for=…>` beside a display-only `<span id=…>`: Filed
 * By, Service Lists, Industry, Filing Date, Category, Current Status, Description, and Staff (one line per
 * staff role, "ROLE: Name (Assigned Mon DD, YYYY)"). The DOCUMENTS report is an APEX interactive report:
 * a table whose header cells are FILING_DATE, DOCUMENT_TYPE, FILED_BY and DESCRIPTION, one row per
 * document, the type linking to the document, and a pagination label "first - last of total". A row has
 * no id of its own (R6): its key is the composite of its four fields and its document link.
 *
 * The APEX layout is the publishing system's own and stays in code; the address and the number forms are
 * the view's (R15). Nothing is followed. */
import { CONTRACT, TAG, written, element, elements, linksIn, sourceAt,
  proceedingNumber, row, reading, assessRegister, detectAnswer } from "./common.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

const KEY = "cpuc_proceeding";
const LABEL = localize("court-doctypes.cpuc.label", "a CPUC proceeding card or documents report");
const CARD_FIELD = /\bid\s*=\s*["']P[0-9]+_(FILED_BY|FILING_DATE|CATEGORY|STATUS|DESCRIPTION|STAFF|INDUSTRY)["']/gi;
const REPORT_COLUMNS = ["FILING_DATE", "DOCUMENT_TYPE", "FILED_BY", "DESCRIPTION"];

function hasReport(html) {
  return REPORT_COLUMNS.every((c) => new RegExp(`<th\\b${TAG}\\bid\\s*=\\s*["']${c}["']`, "i").test(html));
}
function cardFieldCount(html) {
  return new Set([...html.matchAll(CARD_FIELD)].map((m) => m[1].toUpperCase())).size;
}

function detect(ctx) {
  const html = String((ctx && ctx.text) || "");
  const card = cardFieldCount(html) >= 3, report = hasReport(html);
  const signals = [];
  if (card) signals.push("the proceeding card's fields");
  if (report) signals.push(localize("court-doctypes.cpuc.the_documents_report_filing", "the documents report (Filing Date, Document Type, Filed By, Description)"));
  return detectAnswer({ ctx, key: KEY, label: LABEL, what: "a CPUC proceeding card or documents report",
    structure: card || report, structureSignals: signals });
}

/** The card's labelled fields: label → `{value, html, at}`, each as written. */
function cardFields(html) {
  const out = new Map();
  const re = new RegExp(`<label\\b(${TAG})>([\\s\\S]*?)<\\/label\\s*>`, "gi");
  for (const m of html.matchAll(re)) {
    /* Only the application's own page items (P<page>_<NAME>), never a report control's label. */
    const id = /\bfor\s*=\s*["'](P[0-9]+_[A-Z0-9_]+)["']/i.exec(m[1]);
    if (!id) continue;
    const label = written(m[2]);
    if (!label) continue;
    const at = html.indexOf(`id="${id[1]}"`, m.index + m[0].length);
    if (at < 0) continue;
    const open = html.lastIndexOf("<", at);
    const e = element(html, open);
    if (!e) continue;
    out.set(label.replace(/:\s*$/, ""), { value: written(e.inner), html: e.inner, at: open });
  }
  return out;
}

function parse(ctx) {
  const html = String((ctx && ctx.text) || "");
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(html);
  const heading = h1 ? written(h1[1]) : null;
  const hm = heading ? /^(\S+)\s+-\s+\S/.exec(heading) : null;
  const numberWritten = hm ? hm[1] : null;
  const fields = cardFields(html);
  const value = (k) => (fields.has(k) ? fields.get(k).value : null);
  const n = proceedingNumber(ctx, numberWritten);
  const card = cardFieldCount(html) >= 3;
  const proceeding = {
    number: n.number, number_as_written: numberWritten, caption: value("Description"),
    forum_as_written: null, kind_as_written: value("Category"), status_as_written: value("Current Status"),
    filed: value("Filing Date"), source: h1 ? sourceAt(ctx, h1.index) : null,
    fields_as_written: Object.fromEntries([...fields].map(([k, v]) => [k, v.value])),
  };
  const why = { forum_as_written: localize("court-doctypes.cpuc.the_page_names_no_forum", "the page names no forum in its text (only its banner image does), so none is given") };
  if (n.why) why.number = n.why;
  if (!card) {
    why.caption = why.status_as_written = why.kind_as_written = why.filed =
      localize("court-doctypes.cpuc.the_documents_report_states_only", "the documents report states only the proceeding's number; its caption, status, category and filing date are the card's");
  }
  proceeding.why = why;

  const parties = [];
  if (fields.has("Filed By")) {
    const f = fields.get("Filed By");
    if (f.value) parties.push({ name: f.value, role_as_written: "Filed By", source: sourceAt(ctx, f.at) });
  }
  if (fields.has("Staff")) {
    const f = fields.get("Staff");
    for (const line of f.html.split(/<br\s*\/?>/i).map(written).filter(Boolean)) {
      const m = /^([^:]+):\s*(.+?)(?:\s*\(Assigned\s+([^)]+)\))?$/.exec(line);
      parties.push(m
        ? { name: m[2], role_as_written: m[1], assigned_as_written: m[3] || null, source: sourceAt(ctx, f.at) }
        : { name: line, role_as_written: null, source: sourceAt(ctx, f.at) });
    }
  }

  const report = hasReport(html);
  const rows = [];
  let pagination = { page: { n: null, of: null, may_continue: false }, complete: false,
    complete_why: localize("court-doctypes.cpuc.the_page_holds_no_documents", "the page holds no documents report, so it lists no register rows") };
  if (report) {
    const table = new RegExp(`<table\\b(?=${TAG}\\bclass\\s*=\\s*["'][^"']*\\ba-IRR-table\\b)${TAG}>`, "i").exec(html);
    const t = table ? element(html, table.index) : null;
    const scope = t ? t.inner : "";
    const base = t ? t.innerStart : 0;
    for (const tr of elements(scope, new RegExp(`<tr\\b${TAG}>`, "gi"))) {
      const cells = {};
      for (const td of elements(tr.inner, new RegExp(`<td\\b${TAG}>`, "gi"))) {
        const h = /\bheaders\s*=\s*["']([A-Z_]+)["']/i.exec(td.match[0]);
        if (h) cells[h[1].toUpperCase()] = td;
      }
      if (!REPORT_COLUMNS.some((c) => cells[c])) continue;
      const v = (c) => (cells[c] ? written(cells[c].inner) : null);
      const links = cells.DOCUMENT_TYPE ? linksIn(cells.DOCUMENT_TYPE.inner).filter((l) => l.label)
        .map((l) => ({ document: null, description: null, label: l.label, href: l.href, fee: false })) : [];
      const date = v("FILING_DATE"), kind = v("DOCUMENT_TYPE"), filer = v("FILED_BY"), text = v("DESCRIPTION");
      rows.push(row({
        key: [date, kind, filer, text, links.length ? links.map((l) => l.href).join(" ") : "-"].map((x) => x ?? "").join("|"),
        date, text, filer, kind_as_written: kind, links, source: sourceAt(ctx, base + tr.start),
      }));
    }
    const pl = /a-IRR-pagination-label[^>]*>\s*([0-9,]+)\s*-\s*([0-9,]+)\s+of\s+([0-9,]+)/i.exec(html);
    if (pl) {
      const [first, last, total] = pl.slice(1).map((x) => Number(x.replace(/,/g, "")));
      const size = last - first + 1;
      const complete = first === 1 && rows.length === total;
      pagination = { page: { n: Math.floor((first - 1) / size) + 1, of: Math.ceil(total / size), may_continue: last < total },
        complete, complete_why: complete ? null
          : localize("court-doctypes.cpuc.the_report_says_it_holds", "the report says it holds {total} rows and this reading holds rows {first} to {last} ({length} read)", { total: String(total), first: String(first), last: String(last), length: String(rows.length) }) };
    } else {
      pagination = { page: { n: null, of: null, may_continue: false }, complete: false,
        complete_why: localize("court-doctypes.cpuc.the_report_states_no_pagination", "the report states no pagination, so whether it holds every row of the register is not established") };
    }
  }
  return reading({
    type: KEY, proceeding, parties, rows, pagination, provisional: false, register: report,
    at: (ctx && ctx.at) || null,
    failed: !card && !report ? localize("court-doctypes.cpuc.the_page_holds_neither_the", "the page holds neither the proceeding card nor its documents report") : null,
    key_basis: localize("court-doctypes.cpuc.key_basis", "cpuc_proceeding: the commission assigns its documents report no row id, so a row is keyed by the composite of its filing date, document type, filer and description as written, plus its document link where it has one; identical twins on one reading are told apart by their order; an edit to any of these reads as one row gone and one added, reported together"),
  });
}

export default {
  key: KEY, label: LABEL, version: 1,
  contract: CONTRACT.MEMBERSHIP,
  detect, parse,
  assess(before, after) { return assessRegister(before, after); },
};
