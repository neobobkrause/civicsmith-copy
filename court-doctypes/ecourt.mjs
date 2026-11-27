/* `ecourt_roa`: an eCourt register of actions, read only from a member's own capture (R1, R2, R3–R8).
 *
 * NOT YET SEEN. The eCourt public portal's case pages are behind an account and a CAPTCHA, and a name search
 * and document images are paid (`measures-T33/courts-workbooks.md` §1 (a)). So a register is read only from
 * a capture a member made in their own browser (R2; K1492, K1449), never from a fetch. The portal states
 * what a case page holds (parties, the Register of Actions, minutes, future hearings, document images); the
 * row shape below is ASSUMED from that statement: a "Register of Actions" heading over a table whose columns
 * include a date and a description, with any document link beside them, and the case's own fields as
 * labelled pairs (Case Number, Case Title, Case Type, Filing Date, Case Status). Its rows carry no id, so a
 * row is keyed by its date and its order within that date. Every reading says all this (`provisional`,
 * `key_basis`; R7) until a member's capture verifies or replaces it, with the fictional fixture beside the
 * tests (R16).
 *
 * The layout is the portal's own and stays in code; the address and the number forms are the view's (R15).
 * Nothing is followed; a paid document link is marked `fee`. */
import { CONFIDENCE, CONTRACT, TAG, fieldsAsWritten, feeBearing, written, element, elements, linksIn, sourceAt,
  proceedingNumber, row, reading, pageOf, assessHeld, detectAnswer } from "./common.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext } from "../docprofile/doctypes/index.mjs" */
/** @import { FoundElement, PageElement, Party, Proceeding, RegisterDetection, RegisterReading, RegisterRow, RegisterType } from "./common.mjs" */

/**
 * A labelled field of the case: its value as written and where its label is.
 * @typedef {Object} CaseField
 * @property {string | null} value
 * @property {number} at
 */
/**
 * Which column holds each part of a row; -1 where the table has none.
 * @typedef {Object} RegisterColumns
 * @property {number} date
 * @property {number} text
 * @property {number} filer
 * @property {number} kind
 * @property {number} doc
 */
/**
 * The register's table, its columns, and where its heading is.
 * @typedef {Object} RegisterTable
 * @property {PageElement} table
 * @property {RegisterColumns} cols
 * @property {number} heading
 */

const KEY = "ecourt_roa";
const LABEL = localize("court-doctypes.ecourt.label", "an eCourt register of actions");
const MEMBER_ONLY = localize("court-doctypes.ecourt.member_only", "an account-gated register is read only from a member's own capture");
const HEADING = /<(h[1-6]|caption|legend)\b[^>]*>\s*(?:<[^>]+>\s*)*Register\s+of\s+Actions\s*(?:<[^>]+>\s*)*<\/\1\s*>/i;

/** Whether `ctx.origin` says this is a member's own capture made in their own browser (R2).
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {boolean} */
export function memberCapture(ctx) {
  const o = originOf(ctx);
  return o === "member" || (o != null && typeof o === "object" && "kind" in o && o.kind === "member");
}

/** The capture's origin as the caller hands it in `ctx.origin`, which docprofile's context does not yet state.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {unknown} */
function originOf(ctx) {
  return ctx && "origin" in ctx ? ctx.origin : undefined;
}

/** The register's table: the first table after the "Register of Actions" heading, with its columns.
 *  @param {string} html
 *  @returns {RegisterTable | null} */
function registerTable(html) {
  const h = HEADING.exec(html);
  if (!h) return null;
  const from = h.index + h[0].length;
  const t = new RegExp(`<table\\b${TAG}>`, "i").exec(html.slice(from));
  if (!t) return null;
  const e = element(html, from + t.index);
  if (!e) return null;
  const head = elements(e.inner, new RegExp(`<th\\b${TAG}>`, "gi")).map((c) => (written(c.inner) || "").toLowerCase());
  const col = (/** @type {RegExp} */ re) => head.findIndex((x) => re.test(x));
  const cols = { date: col(/\bdate\b/), text: col(/\b(?:description|action|proceedings?|entry|event)\b/),
    filer: col(/\bfiled by\b|\bfiler\b|\bparty\b/), kind: col(/\btype\b/), doc: col(/\bdocuments?\b|\bimages?\b/) };
  if (cols.date < 0 || cols.text < 0) return null;
  return { table: e, cols, heading: h.index };
}

/** @param {DoctypeContext} ctx @returns {RegisterDetection} */
function detect(ctx) {
  const html = String((ctx && ctx.text) || "");
  const t = registerTable(html);
  if (t && !memberCapture(ctx))
    return { match: false, confidence: CONFIDENCE.NONE, signals: [localize("court-doctypes.ecourt.a_register_of_actions", "a register of actions")],
      why: localize("court-doctypes.ecourt.member_only_this_capture_is", "{MEMBER_ONLY}; this capture is not one (its origin is {stringify})", { MEMBER_ONLY: String(MEMBER_ONLY), stringify: String(JSON.stringify(originOf(ctx) ?? null)) }) };
  return detectAnswer({ ctx, key: KEY, label: LABEL, what: LABEL,
    structure: !!t, structureSignals: [localize("court-doctypes.ecourt.a_register_of_actions_table", "a Register of Actions table (date, description)"), localize("court-doctypes.ecourt.a_member_s_own_capture", "a member's own capture")] });
}

/** The case's labelled fields, as `<dt>`/`<dd>` pairs or two-cell table rows: label → `{value, at}`.
 *  @param {string} html
 *  @returns {Map<string, CaseField>} */
function caseFields(html) {
  const out = new Map(/** @type {Array<[string, CaseField]>} */ ([]));
  const put = (/** @type {string | undefined} */ l, /** @type {string | undefined} */ v, /** @type {number} */ at) => {
    const label = (written(l) || "").replace(/:\s*$/, "");
    if (label && !out.has(label)) out.set(label, { value: written(v), at });
  };
  for (const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt\s*>\s*<dd\b[^>]*>([\s\S]*?)<\/dd\s*>/gi)) put(m[1], m[2], m.index ?? 0);
  for (const m of html.matchAll(/<tr\b[^>]*>\s*<th\b[^>]*>([\s\S]*?)<\/th\s*>\s*<td\b[^>]*>([\s\S]*?)<\/td\s*>\s*<\/tr\s*>/gi)) put(m[1], m[2], m.index ?? 0);
  return out;
}

/** The parties table: a table under a "Parties" heading, its name and type columns.
 *  @param {DoctypeContext} ctx
 *  @param {string} html
 *  @returns {Party[]} */
function partiesOf(ctx, html) {
  const h = /<(h[1-6])\b[^>]*>\s*Parties\s*<\/\1\s*>/i.exec(html);
  if (!h) return [];
  const t = new RegExp(`<table\\b${TAG}>`, "i").exec(html.slice(h.index));
  const e = t ? element(html, h.index + t.index) : null;
  if (!e) return [];
  const head = elements(e.inner, new RegExp(`<th\\b${TAG}>`, "gi")).map((c) => (written(c.inner) || "").toLowerCase());
  const nameAt = head.findIndex((x) => /\b(?:party|name)\b/.test(x) && !/\btype\b/.test(x));
  const roleAt = head.findIndex((x) => /\b(?:type|role)\b/.test(x));
  /** @type {Party[]} */
  const out = [];
  for (const tr of elements(e.inner, new RegExp(`<tr\\b${TAG}>`, "gi"))) {
    const tds = elements(tr.inner, new RegExp(`<td\\b${TAG}>`, "gi"));
    if (!tds.length) continue;
    const nameCell = tds[nameAt < 0 ? 0 : nameAt];
    const name = written(nameCell ? nameCell.inner : undefined);
    if (!name) continue;
    const roleCell = roleAt >= 0 ? tds[roleAt] : undefined;
    out.push({ name, role_as_written: roleCell ? written(roleCell.inner) : null,
      source: sourceAt(ctx, e.innerStart + tr.start) });
  }
  return out;
}

/** @param {DoctypeContext} ctx @returns {RegisterReading} */
function parse(ctx) {
  const html = String((ctx && ctx.text) || "");
  const member = memberCapture(ctx);
  const fields = caseFields(html);
  const value = (/** @type {string[]} */ ...ks) => { for (const k of ks) { const f = fields.get(k); if (f) return f.value; } return null; };
  const numberWritten = value("Case Number", "Case No.", "Case No");
  const n = proceedingNumber(ctx, numberWritten);
  const caseNumber = fields.get("Case Number");
  /** @type {Proceeding} */
  const proceeding = {
    number: n.number, number_as_written: numberWritten, caption: value("Case Title", "Case Name", "Title"),
    forum_as_written: value("Courthouse", "Court", "Location"), kind_as_written: value("Case Type", "Case Category"),
    status_as_written: value("Case Status", "Status"), filed: value("Filing Date", "Date Filed"),
    source: caseNumber ? sourceAt(ctx, caseNumber.at) : null,
    fields_as_written: fieldsAsWritten(fields),
  };
  if (n.why) proceeding.why = { number: n.why };

  const t = registerTable(html);
  /** @type {RegisterRow[]} */
  const rows = [];
  if (t && member) {
    const { table, cols } = t;
    const seq = new Map(/** @type {Array<[string | null, number]>} */ ([]));
    for (const tr of elements(table.inner, new RegExp(`<tr\\b${TAG}>`, "gi"))) {
      const tds = elements(tr.inner, new RegExp(`<td\\b${TAG}>`, "gi"));
      if (!tds.length) continue;
      const cell = (/** @type {number} */ i) => (i >= 0 ? tds[i] ?? null : null);
      const textIn = (/** @type {FoundElement | null} */ c) => (c ? written(c.inner) : null);
      const date = textIn(cell(cols.date));
      const text = textIn(cell(cols.text));
      if (date == null && text == null) continue;
      const k = (seq.get(date) || 0) + 1;
      seq.set(date, k);
      const docCell = cell(cols.doc);
      const linkCells = cols.doc >= 0 ? (docCell ? [docCell] : []) : tds.filter((_, i) => i !== cols.date && i !== cols.text);
      const links = linkCells.flatMap((c) => linksIn(c.inner))
        .flatMap((l) => { const label = l.label; return label ? [{ document: null, description: null, label, href: l.href, fee: feeBearing(label) }] : []; });
      rows.push(row({
        key: `${date ?? ""}#${k}`, date, text,
        filer: textIn(cell(cols.filer)),
        kind_as_written: textIn(cell(cols.kind)),
        links, source: sourceAt(ctx, table.innerStart + tr.start),
      }));
    }
  }
  const pm = /\bPage\s+([0-9]+)\s+of\s+([0-9]+)\b/i.exec(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  return reading({
    type: KEY, proceeding, parties: member ? partiesOf(ctx, html) : [], rows, provisional: true,
    at: (ctx && ctx.at) || null,
    pagination: pm ? pageOf(Number(pm[1]), Number(pm[2])) : pageOf(null, null),
    failed: !member ? localize("court-doctypes.ecourt.member_only_and_this_capture", "{MEMBER_ONLY}, and this capture is not one", { MEMBER_ONLY: String(MEMBER_ONLY) })
      : !t ? localize("court-doctypes.ecourt.the_page_holds_no_register", "the page holds no Register of Actions table with a date and a description") : null,
    key_basis: localize("court-doctypes.ecourt.key_basis", "ecourt_roa (PROVISIONAL): a row is keyed by its date as written and its order among the rows of that date; the row shape and this key are assumed from the portal's own description of a case page and are not yet verified on a member's capture"),
  });
}

/** @type {RegisterType} */
const ecourtRoa = {
  key: KEY, label: LABEL, version: 1,
  contract: CONTRACT.MEMBERSHIP,
  detect, parse,
  assess(before, after) { return assessHeld(before, after); },
};
export default ecourtRoa;
