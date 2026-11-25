/* court-doctypes: what the three register readers share (`build/requirements/court-doctypes.md`).
 *
 * A REGISTER is a proceeding's list of entries as its forum publishes it. Each reader below this file
 * reads one publishing system's page of it; this file holds what any of them needs: markup read as text
 * with its offsets kept, the address test against the view, the proceeding number through `id-spaces`,
 * the sealing statement, and the row diff `assess` (R10–R12).
 *
 * PURE (R13): no store, no network, no clock; nothing is fetched, a document link included. NO PLACE IN
 * CODE (R15): an address is matched only against the view's `systems` entries under this module's keys,
 * and a number only against the view's `proceeding` forms; what stays here is each publishing system's own
 * page structure, which is the same wherever it is published. AS WRITTEN (R14): every value is the page's
 * own text with its markup removed and its white space collapsed; nothing is inferred, completed or
 * corrected, and a value the page does not state is `null` with why. */
import { CONFIDENCE, CONTRACT, entity, diffEntities, readerView } from "../docprofile/doctypes/index.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../docprofile/registry.mjs";
import { recognise, systemOf } from "../bio-plane/src/idspaces.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

export { CONFIDENCE, CONTRACT };

/* ------------------------------------------------------------------ markup, read as text */

/* One tag, its attributes read so that a `>` inside a quoted value (a tooltip holding markup) does not
   end it. */
export const TAG = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`;

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "" };

/** Character references decoded, the numeric ones and the few named ones these pages use. */
export function decode(s) {
  return String(s == null ? "" : s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, r) => {
    if (r[0] === "#") {
      const n = r[1] === "x" || r[1] === "X" ? parseInt(r.slice(2), 16) : parseInt(r.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    const k = r.toLowerCase();
    return Object.hasOwn(NAMED, k) ? NAMED[k] : m;
  });
}

/* Tags that end a run of text: a line break or a block. Every other tag (a span, a link, emphasis) joins
   the text on either side as written, so "Doc<span>&shy;ument</span>" reads "Document". */
const BLOCK = /^(?:br|p|div|td|th|tr|li|ul|ol|table|tbody|thead|h[1-6]|dd|dt|dl|section|article|header|footer|form|label)$/i;

/** A fragment of markup as the text a member reads: scripts and styles dropped, tags removed (a block or
 *  a line break reads as a space), references decoded, white space collapsed. */
export function textOf(html) {
  const s = String(html == null ? "" : html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(new RegExp(`<\\/?([a-zA-Z][a-zA-Z0-9]*)${TAG}>`, "g"), (m, name) => (BLOCK.test(name) ? " " : ""));
  return decode(s).replace(/\s+/g, " ").trim();
}

/** A value as written, or null when the page gives no text for it. */
export const written = (html) => {
  const t = textOf(html);
  return t ? t : null;
};

/** The element that opens at `start` in `html` (a `<div …>` or any other tag), up to its balancing close
 *  tag, as `{start, end, inner, innerStart}`; null when it is not balanced. Only tags of the same name are
 *  counted, which is all a well-formed page needs. */
export function element(html, start) {
  const open = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)${TAG}>`, "y");
  open.lastIndex = start;
  const m = open.exec(html);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const innerStart = start + m[0].length;
  const any = new RegExp(`<(\\/?)${name}(?![a-zA-Z0-9])${TAG}>`, "gi");
  any.lastIndex = innerStart;
  let depth = 1;
  for (let t; (t = any.exec(html));) {
    if (t[0].endsWith("/>")) continue;
    depth += t[1] ? -1 : 1;
    if (depth === 0) return { start, end: t.index + t[0].length, innerStart, inner: html.slice(innerStart, t.index) };
  }
  return null;
}

/** Every element opening where `re` (global, matching at a tag's `<`) matches, balanced, in page order. */
export function elements(html, re) {
  const out = [];
  re.lastIndex = 0;
  for (let m; (m = re.exec(html));) {
    const e = element(html, m.index);
    if (e) { out.push({ ...e, match: m }); re.lastIndex = e.end; }
  }
  return out;
}

/** The links in a fragment, each `{label, href}` with its label as written, in order, one per address.
 *  A link with no text (an icon) is kept only when no labelled link to that address is held. */
export function linksIn(html, base = 0) {
  const out = [];
  const seen = new Map();
  const re = new RegExp(`<a\\b(${TAG})>([\\s\\S]*?)<\\/a\\s*>`, "gi");
  for (const m of String(html).matchAll(re)) {
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
    if (!href) continue;
    const url = decode(href[1] ?? href[2]).trim();
    if (!url || url.startsWith("#") || /^javascript:/i.test(url)) continue;
    const label = written(m[2]);
    if (seen.has(url)) {
      const held = out[seen.get(url)];
      if (!held.label && label) held.label = label;
      continue;
    }
    seen.set(url, out.length);
    out.push({ label, href: url, at: base + m.index });
  }
  return out;
}

/** Whether a link's label says following it costs money: a purchase, or a price above zero ("Buy on
 *  PACER ($1.50)", "Purchase ($1.00 per page)"); a link priced at nothing ("$0.00") is not fee-bearing. */
export function feeBearing(label) {
  const t = String(label || "");
  if (/\b(?:buy|purchase)\b/i.test(t)) return true;
  return [...t.matchAll(/\$\s?([0-9][0-9,]*(?:\.[0-9]+)?)/g)].some((m) => Number(m[1].replace(/,/g, "")) > 0);
}

/* ------------------------------------------------------------------ where a reading was read (IC-86) */

/** The position a reader may give a part it read at `offset` of `ctx.text`: only what `ctx.locate` says,
 *  never composed (docprofile R34); null when the locator cannot say or none was handed. */
export function sourceAt(ctx, offset) {
  if (!ctx || typeof ctx.locate !== "function" || !Number.isInteger(offset)) return null;
  try { return ctx.locate(offset) || null; } catch { return null; }
}

/* ------------------------------------------------------------------ the address, from the view (R1, R15) */

/** Whether the capture's locator is an address of the publishing system the view names under `key`
 *  (a `systems` entry whose `origin` is the key, matched on host and path by `id-spaces.systemOf`). */
export function addressOf(ctx, key, label) {
  const locator = ctx && ctx.locator != null ? String(ctx.locator) : "";
  if (!locator) return { ok: false, why: localize("court-doctypes.common.the_capture_names_no_address", "the capture names no address, so whether it is {label} is not established by its address", { label: String(label) }) };
  let r;
  try { r = systemOf(readerView(ctx), [locator]); } catch { r = { origin: null, why: localize("court-doctypes.common.its_address_could_not_be_read", "its address could not be read") }; }
  if (r && r.origin === key) return { ok: true, name: r.name || key };
  if (r && r.origin) return { ok: false, why: localize("court-doctypes.common.its_address_is_one_of", "its address is one of {v1}, not an address the active profiles name for {label}", { v1: String(r.name || r.origin), label: String(label) }) };
  return { ok: false, why: localize("court-doctypes.common.no_active_profile_names_its", "no active profile names its address as {label}'s ({v1})", { label: String(label), v1: String((r && r.why) || "no system matches") }) };
}

/* ------------------------------------------------------------------ what a page is when it is not a register */

/** Why a page of the right address is not the register: a sign-in page, a search form, an error page, or
 *  simply a page without the register's structure. Read from the page's own words and forms. */
export function notRegisterWhy(html, what) {
  const t = String(html || "");
  const title = written((/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(t) || [])[1] || "") || "";
  if (/<input\b[^>]*type\s*=\s*["']?password/i.test(t) || /\b(?:sign|log)[\s-]?in\b/i.test(title))
    return localize("court-doctypes.common.this_page_is_a_sign", "this page is a sign-in page, not {what}", { what: String(what) });
  if (/\b(?:404|403|500|not found|error|forbidden|unavailable)\b/i.test(title))
    return localize("court-doctypes.common.this_page_is_an_error", "this page is an error page (\"{title}\"), not {what}", { title: String(title), what: String(what) });
  const headings = [...t.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]\s*>/gi)].map((m) => textOf(m[1])).join(" ");
  const searchButton = /<(?:input|button)\b[^>]*\bvalue\s*=\s*["']\s*search\s*["']/i.test(t) || /<button\b[^>]*>\s*search\s*<\/button>/i.test(t);
  if (/\bsearch\b/i.test(title + " " + headings) || (/<form\b/i.test(t) && searchButton))
    return localize("court-doctypes.common.this_page_is_a_search", "this page is a search page, not {what}", { what: String(what) });
  return localize("court-doctypes.common.this_page_lacks_what_s", "this page lacks {what}'s own structure", { what: String(what) });
}

/* ------------------------------------------------------------------ the proceeding number (R3) */

/** The proceeding's number as `id-spaces.recognise(view, "proceeding", written)` gives it, or null with
 *  why when no form of the view's `proceeding` space matches (R3, R17). */
export function proceedingNumber(ctx, asWritten) {
  if (!asWritten) return { number: null, why: localize("court-doctypes.common.the_page_states_no_proceeding", "the page states no proceeding number") };
  let r = null;
  try { r = recognise(readerView(ctx), "proceeding", asWritten); } catch { r = null; }
  if (r) return { number: r, why: null };
  return { number: null, why: localize("court-doctypes.common.aswritten_has_the_shape_of", "\"{asWritten}\" has the shape of no form of the active profiles' proceeding space, so it is held as written and not recognised", { asWritten: String(asWritten) }) };
}

/* ------------------------------------------------------------------ sealing, as the row states it (R9) */

/* Held in code in place-free legal voice: the words any register uses to state that a document is sealed
   or unsealed. A request ("motion to seal", "leave to file under seal") states nothing about a document
   being sealed and reads null; "sealed" written of a document or "document under seal" granted does. It is
   the row's statement, never this module's finding (K1480). */
const UNSEALED = /\bunsealed\b/i;
const SEALED_WORD = /(?<![a-z])sealed\b/i;
const UNDER_SEAL = /\bunder\s+seal\b/i;
const A_REQUEST = /^\s*(?:(?:joint|unopposed|consent|emergency|sealed)\s+)*(?:motion|request|application|petition)\b/i;

export function sealingOf(text) {
  const t = String(text || "");
  if (UNSEALED.test(t)) return "unsealed";
  if (SEALED_WORD.test(t)) return "sealed";
  if (UNDER_SEAL.test(t)) return A_REQUEST.test(t) && !/\bgranted\b/i.test(t) ? null : "sealed";
  return null;
}

/* ------------------------------------------------------------------ rows and their keys (R5, R6) */

/** A register row, every field as written. */
export function row({ key, entry_id = null, date = null, text = null, filer = null, kind_as_written = null, links = [], documents = [], source = null }) {
  return { key, entry_id, date, text, filer, kind_as_written, links, documents, sealing: sealingOf([text, ...documents.map((d) => d.description)].filter(Boolean).join(" ")), source };
}

/** Rows whose keys collide on one reading (two entries the register writes identically) are told apart
 *  by their order among their twins, so each is still one row; the first keeps its key unmarked. */
export function distinctKeys(rows) {
  const seen = new Map();
  for (const r of rows) {
    const n = (seen.get(r.key) || 0) + 1;
    seen.set(r.key, n);
    if (n > 1) r.key = `${r.key}#${n}`;
  }
  return rows;
}

/** The entity a row is for docprofile's diff and for a caller reading `entities` (docprofile `entity`). */
function rowEntity(r) {
  return entity(r.key, "register_row", [r.date, r.text].filter(Boolean).join(" · ").slice(0, 160), {
    date: r.date, text: r.text, filer: r.filer, kind: r.kind_as_written,
    links: JSON.stringify((r.links || []).map(({ label, href, fee, document, description }) =>
      ({ document: document ?? null, description: description ?? null, label, href, fee: fee === true }))),
    documents: JSON.stringify((r.documents || []).map(({ document, description }) => ({ document: document ?? null, description: description ?? null }))),
    sealing: r.sealing,
  }, r.source);
}

/** The pagination as the register states it (R8), `{n, of, may_continue}` (nulls when it states none),
 *  and whether the reading is complete: true only when it is the register's one and only page. */
export function pageOf(n, of) {
  if (n == null || of == null) return { page: { n: null, of: null, may_continue: false }, complete: false,
    complete_why: localize("court-doctypes.common.the_page_states_no_pagination", "the page states no pagination, so whether it holds every row of the register is not established") };
  const complete = n === 1 && of === 1;
  return { page: { n, of, may_continue: n < of }, complete,
    complete_why: complete ? null : localize("court-doctypes.common.this_is_page_n_of", "this is page {n} of the register's {of}, so it holds only some of its rows", { n: String(n), of: String(of) }) };
}

/** A reading, assembled: `{proceeding, parties, rows, key_basis, complete, page, provisional}`, with the
 *  rows' entities, and `failed` with why when the page held no register rows (R12, R17). */
export function reading({ type, proceeding, parties, rows, key_basis, pagination, provisional, register = true, at = null, failed = null, notes = null }) {
  distinctKeys(rows);
  const out = {
    type, proceeding, parties, rows, key_basis,
    complete: pagination.complete, complete_why: pagination.complete_why, page: pagination.page,
    provisional, register, entities: rows.map(rowEntity), at,
  };
  if (failed) out.failed = failed;
  else if (register && !rows.length) out.failed = localize("court-doctypes.common.no_register_row_could_be_read", "no register row could be read on this page");
  if (notes) out.notes = notes;
  return out;
}

/* ------------------------------------------------------------------ assess: the register row diff (R10–R12) */

const ROW_FIELDS = [["date", "date"], ["text", "text"], ["filer", "filer"], ["kind", "kind_as_written"], ["links", "links"], ["documents", "documents"], ["sealing", "sealing"]];
const JSON_FACTS = new Set(["links", "documents"]);
const PROCEEDING_FIELDS = ["number_as_written", "forum_as_written", "kind_as_written", "filed"];

const failedRead = (why) => ({ meaningful: null, significance: null, events: [], confirmed: null,
  why: localize("court-doctypes.common.why_so_nothing_is_claimed", "{why}, so nothing is claimed about the register either way (a failed read is never a register emptied)", { why: String(why) }) });

/* Under a composite key, the row gone and the row added that are most likely one row with a key field
   edited: they share the most key fields, at least all but one of them, or the same document link. */
function counterparts(gone, appeared) {
  const pairs = new Map();
  const parts = (r) => [r.date, r.kind_as_written, r.filer, r.text, ...(r.links || []).map((l) => l.href)];
  const used = new Set();
  for (const g of gone) {
    let best = null, bestScore = 0;
    const gp = parts(g);
    for (const a of appeared) {
      if (used.has(a.key)) continue;
      const ap = parts(a);
      const sameLink = (g.links || []).some((l) => (a.links || []).some((m) => m.href === l.href));
      let score = 0;
      for (let i = 0; i < 4; i++) if (gp[i] != null && gp[i] === ap[i]) score++;
      if (sameLink) score += 4;
      if (score > bestScore && (score >= 3 || sameLink)) { best = a; bestScore = score; }
    }
    if (best) { pairs.set(g.key, best.key); pairs.set(best.key, g.key); used.add(best.key); }
  }
  return pairs;
}

const partyKey = (p) => `${p.role_as_written ?? ""}\u0000${p.name ?? ""}`;
const show = (v) => (v == null ? "nothing" : `"${String(v).slice(0, 120)}"`);

/** Compare two readings of one register (R10–R12). The result is docprofile's L5 shape:
 *  `{meaningful, significance, events, confirmed, why}`, `meaningful` derived from the catalogue's events. */
export function assessRegister(before, after) {
  const a = before || {}, b = after || {};
  if (a.failed || b.failed)
    return failedRead(localize("court-doctypes.common.a_reading_failed_v1", "a reading failed ({v1})", { v1: String(a.failed ? "before: " + a.failed : "after: " + b.failed) }));
  if (a.type && b.type && a.type !== b.type)
    return failedRead(localize("court-doctypes.common.the_two_readings_are_of_kinds", "the two readings are of different kinds of register"));
  const na = a.proceeding && a.proceeding.number_as_written, nb = b.proceeding && b.proceeding.number_as_written;
  if (na && nb && na !== nb)
    return failedRead(localize("court-doctypes.common.the_two_readings_are_of", "the two readings are of different proceedings ({na} and {nb})", { na: String(na), nb: String(nb) }));
  const rowsA = Array.isArray(a.rows) ? a.rows : [], rowsB = Array.isArray(b.rows) ? b.rows : [];
  const registers = a.register !== false || b.register !== false;
  if (registers && (!rowsA.length || !rowsB.length))
    return failedRead(!rowsA.length && !rowsB.length ? localize("court-doctypes.common.no_register_row_was_read_either", "no register row was read in either reading") : localize("court-doctypes.common.no_register_row_was_read", "no register row was read in the {v1} reading", { v1: String(!rowsA.length ? "earlier" : "later") }));

  const events = [];
  /* The proceeding: its status, its caption and its parties, as written. */
  const pa = a.proceeding || {}, pb = b.proceeding || {};
  if ((pa.status_as_written ?? null) !== (pb.status_as_written ?? null))
    events.push(event("status_changed", { field: "status_as_written", was: pa.status_as_written ?? null, now: pb.status_as_written ?? null,
      why: localize("court-doctypes.common.the_proceedings_status_as_written", "the proceeding's status as written changed from {show} to {show_2}", { show: String(show(pa.status_as_written)), show_2: String(show(pb.status_as_written)) }) }));
  if ((pa.caption ?? null) !== (pb.caption ?? null))
    events.push(event("item_changed", { field: "caption", was: pa.caption ?? null, now: pb.caption ?? null,
      why: localize("court-doctypes.common.the_proceedings_caption_as_written", "the proceeding's caption as written changed") }));
  for (const f of PROCEEDING_FIELDS)
    if ((pa[f] ?? null) !== (pb[f] ?? null))
      events.push(event("item_changed", { field: f, was: pa[f] ?? null, now: pb[f] ?? null,
        why: localize("court-doctypes.common.the_proceedings_replace_as_written", "the proceeding's {replace} as written changed from {show} to {show_2}", { replace: String(f.replace(/_as_written$/, "").replace(/_/g, " ")), show: String(show(pa[f])), show_2: String(show(pb[f])) }) }));
  const parties = (r) => new Map((Array.isArray(r.parties) ? r.parties : []).map((p) => [partyKey(p), p]));
  const ptA = parties(a), ptB = parties(b);
  for (const [k, p] of ptA) if (!ptB.has(k))
    events.push(event("item_changed", { field: "parties", party: p.name, role_as_written: p.role_as_written, was: p.name, now: null,
      why: localize("court-doctypes.common.v1_show_is_no_longer", "{v1}{show} is no longer named on the page", { v1: String(p.role_as_written ? p.role_as_written + " " : ""), show: String(show(p.name)) }) }));
  for (const [k, p] of ptB) if (!ptA.has(k))
    events.push(event("item_changed", { field: "parties", party: p.name, role_as_written: p.role_as_written, was: null, now: p.name,
      why: localize("court-doctypes.common.v1_show_is_newly_named", "{v1}{show} is newly named on the page", { v1: String(p.role_as_written ? p.role_as_written + " " : ""), show: String(show(p.name)) }) }));

  /* The rows, by their key (R6): page order, white space and markup were already read away. */
  const d = diffEntities(a.entities || [], b.entities || []);
  const byKeyA = new Map(rowsA.map((r) => [r.key, r])), byKeyB = new Map(rowsB.map((r) => [r.key, r]));
  const composite = /composite/.test(String(b.key_basis || a.key_basis || ""));
  const pairs = composite ? counterparts(d.gone.map((e) => byKeyA.get(e.key)), d.appeared.map((e) => byKeyB.get(e.key))) : new Map();
  const bothComplete = a.complete === true && b.complete === true;
  /* R10 and R11: each why is one whole sentence, the counterpart named inside it, never a clause added to another. */
  const goneWhy = (key) => {
    const counterpart = pairs.get(key);
    if (bothComplete)
      return counterpart === undefined
        ? localize("court-doctypes.common.row_gone_both_complete", "a row the register listed is no longer listed, and both readings hold the whole register")
        : localize("court-doctypes.common.row_gone_both_complete_counterpart", "a row the register listed is no longer listed, and both readings hold the whole register; the row added under key {key} is likely this row with a key field edited, and the two are reported together, never paired silently", { key: String(counterpart) });
    const v1 = String(a.complete === true ? "the later" : b.complete === true ? "the earlier" : "neither");
    return counterpart === undefined
      ? localize("court-doctypes.common.a_row_is_not_in", "a row is not in the later reading, and {v1} reading holds the whole register, so whether it was removed or is on a page not read is not established", { v1 })
      : localize("court-doctypes.common.a_row_is_not_in_counterpart", "a row is not in the later reading, and {v1} reading holds the whole register, so whether it was removed or is on a page not read is not established; the row added under key {key} is likely this row with a key field edited, and the two are reported together, never paired silently", { v1, key: String(counterpart) });
  };
  for (const e of d.gone) {
    const r = byKeyA.get(e.key);
    const detail = { key: e.key, entry_id: r.entry_id, date: r.date, text: r.text, why: goneWhy(e.key) };
    if (pairs.has(e.key)) detail.counterpart = pairs.get(e.key);
    events.push(event(bothComplete ? "delisted" : "possibly_delisted", detail));
  }
  for (const e of d.appeared) {
    const r = byKeyB.get(e.key);
    const counterpart = pairs.get(e.key);
    const detail = { key: e.key, entry_id: r.entry_id, date: r.date, text: r.text,
      why: counterpart === undefined
        ? localize("court-doctypes.common.row_added", "a row was added to the register")
        : localize("court-doctypes.common.row_added_counterpart", "a row was added to the register; it is likely the row no longer listed under key {key} with a key field edited", { key: String(counterpart) }) };
    if (pairs.has(e.key)) detail.counterpart = counterpart;
    events.push(event("item_added", detail));
  }
  for (const alt of d.altered) {
    for (const m of alt.moved) {
      const field = (ROW_FIELDS.find(([f]) => f === m.fact) || [m.fact, m.fact])[1];
      const r = byKeyB.get(alt.entity.key);
      events.push(event("outcome_changed", { key: alt.entity.key, entry_id: r ? r.entry_id : null, field,
        was: JSON_FACTS.has(m.fact) ? JSON.parse(m.was) : m.was, now: JSON_FACTS.has(m.fact) ? JSON.parse(m.now) : m.now,
        why: localize("court-doctypes.common.the_row_key_changed_its", "the row {key} changed its {replace}", { key: String(alt.entity.key), replace: String(field.replace(/_as_written$/, "").replace(/_/g, " ")) }) }));
    }
  }
  bySeverity(events);
  const intact = rowsB.length - d.appeared.length - d.altered.length;
  const parts = [];
  if (d.appeared.length) parts.push(`${d.appeared.length} row(s) added`);
  if (d.gone.length) parts.push(localize("court-doctypes.common.length_row_s_no_longer", "{length} row(s) no longer listed", { length: String(d.gone.length) }));
  if (d.altered.length) parts.push(`${d.altered.length} row(s) changed`);
  const other = events.filter((e) => e.field && !e.key).length;
  if (other) parts.push(localize("court-doctypes.common.other_change_s_to_the", "{other} change(s) to the proceeding", { other: String(other) }));
  return {
    meaningful: isMeaningful(events), significance: worstSignificance(events), events,
    confirmed: intact > 0 ? { rows: rowsB.length, intact } : null,
    why: parts.length ? `${intact} of ${rowsB.length} rows unchanged; ${parts.join(", ")}`
      : registers ? localize("court-doctypes.common.all_length_rows_of_this", "all {length} rows of this register are unchanged", { length: String(rowsB.length) }) : "the proceeding is unchanged",
  };
}

/** The detect answer for a page: CERTAIN with the address and the structure, LIKELY on the structure
 *  alone (with why), never a match without the structure (R1, R17). */
export function detectAnswer({ ctx, key, label, structure, structureSignals, what }) {
  if (!structure) return { match: false, confidence: CONFIDENCE.NONE, signals: [], why: notRegisterWhy(ctx && ctx.text, what) };
  const addr = addressOf(ctx, key, label);
  if (addr.ok) return { match: true, confidence: CONFIDENCE.CERTAIN, signals: [localize("court-doctypes.common.an_address_of_name", "an address of {name}", { name: String(addr.name) }), ...structureSignals] };
  return { match: true, confidence: CONFIDENCE.LIKELY, signals: structureSignals, why: localize("court-doctypes.common.what_s_structure_is_present", "{what}'s structure is present, but {why}", { what: String(what), why: String(addr.why) }) };
}
