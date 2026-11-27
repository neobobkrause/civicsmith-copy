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
import { withoutContacts, isObj, isList } from "./lines.mjs";
import { word, localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, ReaderView, SuppliedText } from "../docprofile/registry.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { RosterRole } from "../jurisdictions/types.mjs" */
/** @import { Value, Fields, Entries } from "./lines.mjs" */
/** @import { ColumnRole } from "./columns.mjs" */
/** @import { AsOf, NamedOrganisation } from "./staff-roster.mjs" */

/**
 * What `people`' roster source is asked (R12): the organisation's entity id, the date asked and the viewer's spelling.
 * @typedef {Object} RosterQuery
 * @property {string | null} [organisation]
 * @property {string | null} [at]
 * @property {string | null} [viewer]
 */
/**
 * The store's read, handed in by the composition root (R12): the held roster documents and tables of `organisation`
 * that `viewer` may see, as a list, as `{items, view}` or `{rosters, view}`, or a refusal `{ok: false, why}`. Its answer
 * is the store's, read leniently by this module: anything else is answered LEVEL_NOT_READ.
 * @typedef {(q: {organisation: string | null, viewer: string | null}) => Value} StoreRead
 */
/**
 * Where a held roster is held, as the store's item names it, handed back unchanged.
 * @typedef {Value} HeldSource
 */
/**
 * Where a held table's row is: the table's source and the row's index.
 * @typedef {Object} TableRowSource
 * @property {HeldSource} roster
 * @property {number} row
 */
/**
 * One row of a held roster, as the roster states it (R12); a contact column is never read (R4).
 * @typedef {Object} HeldRow
 * @property {string} [name]
 * @property {string} [title]
 * @property {string} [unit]
 * @property {string} [start]
 * @property {string} [end]
 * @property {string} [employee_id]
 * @property {string} [as_of]
 * @property {string} [line]
 * @property {string} [why]
 * @property {ReadingPosition | TableRowSource | null} [source]
 */
/**
 * One held roster read (R12): its own stated `as_of`, never that a row's person held the post at the date asked (R10).
 * @typedef {Object} HeldRoster
 * @property {HeldSource} source
 * @property {string|null} as_of
 * @property {HeldRow[]} rows
 * @property {string} [as_of_text]
 * @property {string|null} [as_of_why]
 * @property {string|null} [organisation]
 * @property {string} [rows_why]
 * @property {{index: number, header: Value, role: RosterRole | null}[]} [columns]
 * @property {string} [columns_why]
 * @property {string} [why]
 */
/**
 * A held item that could not be read as a roster, and why (R11).
 * @typedef {Object} Unread
 * @property {HeldSource} source
 * @property {string} why
 */
/**
 * The roster source's answer (R12, R11).
 * @typedef {Object} RosterAnswer
 * @property {string} level LEVEL_READ, or LEVEL_NOT_READ when the store's read is absent or fails
 * @property {HeldRoster[]} rosters
 * @property {string | null} organisation
 * @property {string | null} at
 * @property {Unread[]} [unread]
 * @property {string} [why]
 * @bound rosters: empty always with why
 */
/** One held item's reading: a roster, or why it is unread.
 *  @typedef {{ roster: HeldRoster, unread?: undefined } | { unread: Unread, roster?: undefined }} ItemReading */

/** @type {string} */
export const LEVEL_READ = localize("roster-reader.source.held_as_a_table_read", "held as a table, read by roster-reader");
/** @type {string} */
export const LEVEL_NOT_READ = word("people.held_as_a_table_not");
/* The roles a row carries into the answer, in R12's order. `as_of` is a table's stated date, `contact` never read. */
/** @type {ReadonlyArray<"name" | "title" | "unit" | "start" | "end" | "employee_id">} */
const ROW_ROLES = ["name", "title", "unit", "start", "end", "employee_id"];

/** @param {{ organisation: string | null, at: string | null }} base @param {string} why @returns {RosterAnswer} */
const notRead = (base, why) => {
  /** @type {HeldRoster[]} */
  const rosters = [];
  return { level: LEVEL_NOT_READ, rosters, organisation: base.organisation, at: base.at, why };
};
const msg = (/** @type {unknown} */ e) => String((e instanceof Error && e.message) || e).slice(0, 200);

/**
 * @param {StoreRead | null} [reads] the store's read; anything else, or none, is answered LEVEL_NOT_READ
 * @returns {(q?: RosterQuery|null) => RosterAnswer} never throws
 */
export function rosterSource(reads) {
  return function source(q) {
    const { organisation = null, at = null, viewer = null } = q && typeof q === "object" ? q : {};
    const base = { organisation, at };
    if (typeof reads !== "function")
      return notRead(base, localize("roster-reader.source.no_read_of_the_store", "no read of the store was handed to roster-reader, so no held roster is read"));
    /** @type {Value} */
    let answered;
    try { answered = reads({ organisation, viewer }); }
    catch (e) { return notRead(base, localize("roster-reader.source.the_stores_read_of_held", "the store's read of held rosters failed ({msg}), so no held roster is read", { msg: String(msg(e)) })); }
    const got = answered;
    if (isObj(got) && typeof got.then === "function") {
      Promise.resolve(got).catch(() => {});
      return notRead(base, localize("roster-reader.source.the_stores_read_answered_later", "the store's read answered later (a promise), and a roster source answers at once, so no held roster is read"));
    }
    if (isObj(got) && got.ok === false) {
      const said = got.why || got.reason;
      return notRead(base, localize("roster-reader.source.the_stores_read_refused_v1", "the store's read refused{v1}, so no held roster is read", { v1: String(said ? ` (${String(said)})` : "") }));
    }
    const items = isList(got) ? got : isObj(got) ? (got.items || got.rosters) : null;
    if (!isList(items))
      return notRead(base, localize("roster-reader.source.the_stores_read_answered_no", "the store's read answered no list of held rosters, so no held roster is read"));
    const view = isObj(got) ? got.view : undefined;
    const fallbackView = view && typeof view === "object" ? view : null;
    /** @type {HeldRoster[]} */
    const rosters = [];
    /** @type {Unread[]} */
    const unread = [];
    for (const item of items) {
      const r = readItemSafely(item, fallbackView);
      if (r.unread) unread.push(r.unread); else rosters.push(r.roster);
    }
    /** @type {RosterAnswer} */
    const out = { level: LEVEL_READ, rosters, organisation: base.organisation, at: base.at };
    if (unread.length) out.unread = unread;
    if (!rosters.length)
      out.why = items.length
        ? localize("roster-reader.source.length_held_roster_s_of", "{length} held roster(s) of this organisation the viewer may see, none of which could be read as a roster", { length: String(items.length) })
        : localize("roster-reader.source.no_roster_document_or_roster", "no roster document or roster table of this organisation is held that the viewer may see");
    return out;
  };
}

/** @param {Value} item @param {object | null} fallbackView @returns {ItemReading} */
function readItemSafely(item, fallbackView) {
  try { return readItem(item, fallbackView); }
  catch (e) { return { unread: { source: sourceOf(item), why: localize("roster-reader.source.reading_it_failed_msg", "reading it failed ({msg})", { msg: String(msg(e)) }) } }; }
}

const sourceOf = (/** @type {Value} */ item) => (isObj(item) && "source" in item ? item.source ?? null : null);
/** The view an item is read under: its own, else the answer's, else docprofile's reader view (K39). A view the store hands
 *  over is jurisdictions' combined view, taken as it is.
 *  @param {Fields} item @param {object | null} fallback @returns {ReaderView} */
const viewOf = (item, fallback) => {
  const own = item.view;
  const given = own && typeof own === "object" ? own : fallback;
  return readerView({ view: /** @type {ReaderView | null} */ (given) });
};

/** @param {Value} item @param {object | null} fallbackView @returns {ItemReading} */
function readItem(item, fallbackView) {
  if (!isObj(item)) return { unread: { source: null, why: localize("roster-reader.source.the_item_is_not_a", "the item is not a held roster: it is not an object") } };
  if (isList(item.header) || "rows" in item) return readTable(item, viewOf(item, fallbackView));
  return readDocument(item, viewOf(item, fallbackView));
}

/* A document, by R2 (or R3 for a chart): its rows as its lines state them, placed where its own text's segment
   map says, and its own stated date. */
/** @param {Fields} item @param {ReaderView} view @returns {ItemReading} */
function readDocument(item, view) {
  const source = sourceOf(item);
  const supplied = item.text;
  if (!(typeof supplied === "string" || (supplied && typeof supplied === "object")))
    return { unread: { source, why: localize("roster-reader.source.the_held_document_carries_no", "the held document carries no text to read its rows from") } };
  /* The held text is interface I2's text shape as the store keeps it, read as docprofile's `readText` reads it. */
  const f = flattenText(/** @type {SuppliedText | string} */ (supplied));
  if (!f.text || !f.text.trim()) return { unread: { source, why: localize("roster-reader.source.no_text_was_read_from", "no text was read from the held document, so it has no rows to read") } };
  const heldAt = item.at;
  /** @type {DoctypeContext} */
  const ctx = { text: f.text, view, locate: makeLocator(f.segments), at: typeof heldAt === "string" ? heldAt : null };
  const chart = item.type === "org_chart";
  /** @type {HeldRow[]} */
  let rows;
  /** @type {{ as_of: AsOf | null, as_of_why: string | null, organisation: NamedOrganisation | null }} */
  let p;
  if (chart) {
    const c = orgChart.parse(ctx);
    p = c;
    rows = [];
    for (const x of c.posts) { const name = x.name; if (name) rows.push({ name, title: x.label, source: x.source }); }
  } else {
    const r = staffRoster.parse(ctx);
    p = r;
    rows = r.rows.map((x) => ({ ...x }));
  }
  const asOf = p.as_of;
  /** @type {HeldRoster} */
  const roster = { source, as_of: asOf ? asOf.date ?? null : null, rows };
  if (asOf) roster.as_of_text = asOf.text;
  else roster.as_of_why = p.as_of_why;
  const org = p.organisation;
  roster.organisation = org ? org.text : null;
  if (chart) roster.rows_why = localize("roster-reader.source.an_organisation_chart_a_row", "an organisation chart: a row is a post whose holder is named on its own line; a box with no name, and any reporting line the drawing shows, are not rows");
  if (!rows.length) roster.why = chart ? localize("roster-reader.source.no_post_in_the_chart", "no post in the chart names its holder on its own line") : localize("roster-reader.source.no_line_of_the_document", "no line of the document reads as a roster row");
  return { roster };
}

/* A table, by R6: its columns' roles from its header, each row read through them in place; a column with no role
   or a contact column is never read. */
/** @param {Fields} item @param {ReaderView} view @returns {ItemReading} */
function readTable(item, view) {
  const source = sourceOf(item);
  const header = item.header;
  if (!isList(header)) return { unread: { source, why: localize("roster-reader.source.the_held_table_carries_no", "the held table carries no header, so its columns' roles cannot be named") } };
  const cols = rosterColumns(header, view);
  if (!cols.roster) return { unread: { source, why: String(cols.why) } };
  const heldRows = item.rows;
  if (!isList(heldRows)) return { unread: { source, why: localize("roster-reader.source.the_held_table_carries_no_2", "the held table carries no rows") } };
  /** @type {ColumnRole[]} */
  const byRole = [];
  for (const c of cols.roles) {
    const role = c.role;
    if ((role !== null && role !== "as_of" && role !== "contact" && ROW_ROLES.includes(role)) || role === "as_of") byRole.push(c);
  }
  /** @param {Value} row @param {ColumnRole} c @returns {string | null} */
  const cell = (row, c) => {
    const key = c.header;
    const v = isList(row) ? row[c.index] : isObj(row) && typeof key === "string" ? row[key] : undefined;
    if (v == null) return null;
    const t = withoutContacts(String(v)).text;
    return t ? t : null;
  };
  /** @type {HeldRow[]} */
  const rows = [];
  heldRows.forEach((row, i) => {
    /** @type {HeldRow} */
    const out = {};
    for (const c of byRole) {
      const role = c.role;
      if (role === null || role === "as_of" || role === "contact") continue;
      if (out[role] != null) continue;
      const v = cell(row, c);
      if (v != null) out[role] = v;
    }
    const asOf = byRole.filter((c) => c.role === "as_of").map((c) => cell(row, c)).find((v) => v != null);
    if (asOf != null) out.as_of = asOf;
    if (!ROW_ROLES.some((r) => out[r] != null)) return;
    out.source = { roster: source, row: i };
    rows.push(out);
  });
  const heldAsOf = item.as_of;
  /** @type {HeldRoster} */
  const roster = { source, as_of: typeof heldAsOf === "string" && heldAsOf ? heldAsOf : null, rows };
  if (!roster.as_of) roster.as_of_why = localize("roster-reader.source.the_held_table_states_no", "the held table states no date of its own; a row's own `as_of` column, where it has one, is kept on the row");
  const unnamed = cols.roles.filter((c) => c.role === null).length, contact = cols.roles.filter((c) => c.role === "contact").length;
  roster.columns = cols.roles.map((c) => ({ index: c.index, header: c.header, role: c.role }));
  if (contact || unnamed)
    roster.columns_why = [contact ? localize("roster-reader.source.contact_contact_column_s_not", "{contact} contact column(s) not read", { contact: String(contact) }) : null, unnamed ? localize("roster-reader.source.unnamed_column_s_with_no", "{unnamed} column(s) with no role not read", { unnamed: String(unnamed) }) : null].filter(Boolean).join("; ");
  if (!rows.length) roster.why = localize("roster-reader.source.no_row_of_the_table", "no row of the table carries a value in a roster column");
  return { roster };
}
