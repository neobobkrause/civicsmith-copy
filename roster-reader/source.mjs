/* `rosterSource(reads)` (R12; N614, K1505 (6), K1683; `people` R18, R19): the roster source `people.staffingAt`
 * asks, in place of the one `plane` registered that answered "held as a table, not read".
 *
 * THIS MODULE HOLDS NO STORE (layer 1). `reads({organisation, viewer})` is the store's read, composed and handed in
 * by the composition root: it answers the held roster documents and roster tables of that organisation that the
 * viewer may see. Which captures and tables those are is `plane`'s choice (its composition), never this module's;
 * this source only reads what it is handed, a document by R2 (`staff_roster`'s `parse`) and a table's columns by R6
 * (`rosterColumns`), and answers each as `{source, as_of, rows}`.
 *
 * WHAT `reads` ANSWERS, read leniently because the store's shape is `plane`'s: a list of items, or `{items, view}`
 * (or `{rosters, view}`), or a refusal `{ok: false, why}`. An item is
 *   - a TABLE when it carries `header` (its header cells) and `rows` (each a list of cells in the header's order,
 *     or an object keyed by header text): `{source, header, rows, as_of?, view?}`;
 *   - a DOCUMENT otherwise: `{source, text, type?, view?, at?}`, `text` a string or interface I2's text shape, read
 *     as docprofile's `readText` reads it (`flattenText`, `makeLocator`). `type: "org_chart"` is read by R3: a
 *     post that names its holder on its own line is a row `{name, title}`; a box with no name is not a row.
 * The view an item is read under is its own `view`, else the answer's, else docprofile's reader view (K39).
 *
 * EVERYTHING IS A READING (R10). Each roster states its own `as_of`; nothing here says that a row's person held
 * the post at `at`, which is answered back only as the date asked. A contact column is never read and a contact
 * point inside a cell is left unread (R4). Nothing is written. It never throws: a `reads` that is absent, throws,
 * answers a promise or answers nothing usable gives the level "held as a table, not read" with why, and an item
 * that cannot be read is named in `unread` with why (R11). */
import { flattenText, makeLocator, readerView } from "../docprofile/registry.mjs";
import staffRoster from "./staff-roster.mjs";
import orgChart from "./org-chart.mjs";
import { rosterColumns } from "./columns.mjs";
import { withoutContacts } from "./lines.mjs";
import { word, localize } from "../bio-plane/src/setup-words/index.mjs";

export const LEVEL_READ = localize("roster-reader.source.held_as_a_table_read", "held as a table, read by roster-reader");
export const LEVEL_NOT_READ = word("people.held_as_a_table_not");
/* The roles a row carries into the answer, in R12's order. `as_of` is a table's stated date, `contact` never read. */
const ROW_ROLES = ["name", "title", "unit", "start", "end", "employee_id"];

const notRead = (base, why) => ({ level: LEVEL_NOT_READ, rosters: [], ...base, why });
const msg = (e) => String((e && e.message) || e).slice(0, 200);

export function rosterSource(reads) {
  return function source(q) {
    const { organisation = null, at = null, viewer = null } = q && typeof q === "object" ? q : {};
    const base = { organisation, at };
    if (typeof reads !== "function")
      return notRead(base, localize("roster-reader.source.no_read_of_the_store", "no read of the store was handed to roster-reader, so no held roster is read"));
    let got;
    try { got = reads({ organisation, viewer }); }
    catch (e) { return notRead(base, localize("roster-reader.source.the_stores_read_of_held", "the store's read of held rosters failed ({msg}), so no held roster is read", { msg: String(msg(e)) })); }
    if (got && typeof got.then === "function") {
      got.then(null, () => {});
      return notRead(base, localize("roster-reader.source.the_stores_read_answered_later", "the store's read answered later (a promise), and a roster source answers at once, so no held roster is read"));
    }
    if (got && typeof got === "object" && !Array.isArray(got) && got.ok === false)
      return notRead(base, localize("roster-reader.source.the_stores_read_refused_v1", "the store's read refused{v1}, so no held roster is read", { v1: String(got.why || got.reason ? ` (${got.why || got.reason})` : "") }));
    const items = Array.isArray(got) ? got : got && typeof got === "object" ? (got.items || got.rosters) : null;
    if (!Array.isArray(items))
      return notRead(base, localize("roster-reader.source.the_stores_read_answered_no", "the store's read answered no list of held rosters, so no held roster is read"));
    const fallbackView = got && !Array.isArray(got) && got.view && typeof got.view === "object" ? got.view : null;
    const rosters = [], unread = [];
    for (const item of items) {
      let r;
      try { r = readItem(item, fallbackView); }
      catch (e) { r = { unread: { source: sourceOf(item), why: localize("roster-reader.source.reading_it_failed_msg", "reading it failed ({msg})", { msg: String(msg(e)) }) } }; }
      if (r.unread) unread.push(r.unread); else rosters.push(r.roster);
    }
    const out = { level: LEVEL_READ, rosters, ...base };
    if (unread.length) out.unread = unread;
    if (!rosters.length)
      out.why = items.length
        ? localize("roster-reader.source.length_held_roster_s_of", "{length} held roster(s) of this organisation the viewer may see, none of which could be read as a roster", { length: String(items.length) })
        : localize("roster-reader.source.no_roster_document_or_roster", "no roster document or roster table of this organisation is held that the viewer may see");
    return out;
  };
}

const sourceOf = (item) => (item && typeof item === "object" && "source" in item ? item.source ?? null : null);
const viewOf = (item, fallback) => readerView({ view: item.view && typeof item.view === "object" ? item.view : fallback });

function readItem(item, fallbackView) {
  if (!item || typeof item !== "object") return { unread: { source: null, why: localize("roster-reader.source.the_item_is_not_a", "the item is not a held roster: it is not an object") } };
  if (Array.isArray(item.header) || "rows" in item) return readTable(item, viewOf(item, fallbackView));
  return readDocument(item, viewOf(item, fallbackView));
}

/* A document, by R2 (or R3 for a chart): its rows as its lines state them, placed where its own text's segment
   map says, and its own stated date. */
function readDocument(item, view) {
  const source = sourceOf(item);
  const supplied = item.text;
  if (!(typeof supplied === "string" || (supplied && typeof supplied === "object")))
    return { unread: { source, why: localize("roster-reader.source.the_held_document_carries_no", "the held document carries no text to read its rows from") } };
  const f = flattenText(supplied);
  if (!f.text || !f.text.trim()) return { unread: { source, why: localize("roster-reader.source.no_text_was_read_from", "no text was read from the held document, so it has no rows to read") } };
  const ctx = { text: f.text, view, locate: makeLocator(f.segments), at: item.at ?? null };
  const chart = item.type === "org_chart";
  const p = (chart ? orgChart : staffRoster).parse(ctx);
  const rows = chart
    ? p.posts.filter((x) => x.name).map((x) => ({ name: x.name, title: x.label, source: x.source }))
    : p.rows.map((r) => ({ ...r }));
  const roster = { source, as_of: p.as_of ? p.as_of.date ?? null : null, rows };
  if (p.as_of) roster.as_of_text = p.as_of.text;
  else roster.as_of_why = p.as_of_why;
  if (p.as_of && p.as_of.date == null && p.as_of.why) roster.as_of_why = p.as_of.why;
  roster.organisation = p.organisation ? p.organisation.text : null;
  if (chart) roster.rows_why = localize("roster-reader.source.an_organisation_chart_a_row", "an organisation chart: a row is a post whose holder is named on its own line; a box with no name, and any reporting line the drawing shows, are not rows");
  if (!rows.length) roster.why = chart ? localize("roster-reader.source.no_post_in_the_chart", "no post in the chart names its holder on its own line") : localize("roster-reader.source.no_line_of_the_document", "no line of the document reads as a roster row");
  return { roster };
}

/* A table, by R6: its columns' roles from its header, each row read through them in place; a column with no role
   or a contact column is never read. */
function readTable(item, view) {
  const source = sourceOf(item);
  if (!Array.isArray(item.header)) return { unread: { source, why: localize("roster-reader.source.the_held_table_carries_no", "the held table carries no header, so its columns' roles cannot be named") } };
  const cols = rosterColumns(item.header, view);
  if (!cols.roster) return { unread: { source, why: cols.why } };
  if (!Array.isArray(item.rows)) return { unread: { source, why: localize("roster-reader.source.the_held_table_carries_no_2", "the held table carries no rows") } };
  const byRole = [];
  for (const c of cols.roles) if (ROW_ROLES.includes(c.role) || c.role === "as_of") byRole.push(c);
  const cell = (row, c) => {
    const v = Array.isArray(row) ? row[c.index] : row && typeof row === "object" ? row[c.header] : undefined;
    if (v == null) return null;
    const t = withoutContacts(String(v)).text;
    return t ? t : null;
  };
  const rows = [];
  item.rows.forEach((row, i) => {
    const out = {};
    for (const c of byRole) {
      if (c.role === "as_of") continue;
      if (out[c.role] != null) continue;
      const v = cell(row, c);
      if (v != null) out[c.role] = v;
    }
    const asOf = byRole.filter((c) => c.role === "as_of").map((c) => cell(row, c)).find((v) => v != null);
    if (asOf != null) out.as_of = asOf;
    if (!ROW_ROLES.some((r) => out[r] != null)) return;
    out.source = { roster: source, row: i };
    rows.push(out);
  });
  const roster = { source, as_of: typeof item.as_of === "string" && item.as_of ? item.as_of : null, rows };
  if (!roster.as_of) roster.as_of_why = localize("roster-reader.source.the_held_table_states_no", "the held table states no date of its own; a row's own `as_of` column, where it has one, is kept on the row");
  const unnamed = cols.roles.filter((c) => c.role === null).length, contact = cols.roles.filter((c) => c.role === "contact").length;
  roster.columns = cols.roles.map((c) => ({ index: c.index, header: c.header, role: c.role }));
  if (contact || unnamed)
    roster.columns_why = [contact ? localize("roster-reader.source.contact_contact_column_s_not", "{contact} contact column(s) not read", { contact: String(contact) }) : null, unnamed ? localize("roster-reader.source.unnamed_column_s_with_no", "{unnamed} column(s) with no role not read", { unnamed: String(unnamed) }) : null].filter(Boolean).join("; ");
  if (!rows.length) roster.why = localize("roster-reader.source.no_row_of_the_table", "no row of the table carries a value in a roster column");
  return { roster };
}
