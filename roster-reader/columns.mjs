/* `rosterColumns(header, view)` (R6): the roles of a captured roster or payroll table's columns, named
 * from the header words the view supplies (`roster_headers`, each `{role, pattern, basis}`).
 *
 * "ROSTERS STAY TABLES" (ladders §2 PEOPLE). This reads the HEADER only: it never reads, copies or
 * returns a row, so a reader that holds the table reads its rows through these roles, in place. A
 * contact column (phone, address, personal e-mail) is named `contact` so that reader can leave it unread
 * (R4). */
import { vocabulary, vocabRegex } from "../docprofile/registry.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { isList } from "./lines.mjs";
/** @import { DoctypeContext, ReaderView } from "../docprofile/registry.mjs" */
/** @import { RosterRole } from "../jurisdictions/types.mjs" */
/** @import { Value } from "./lines.mjs" */

/**
 * One column's role (R6): its place, its header as captured, the role the view's header words name, or none with why.
 * @typedef {Object} ColumnRole
 * @property {number} index
 * @property {Value} header
 * @property {RosterRole|null} role
 * @property {string|null} why
 * @bound role: one of ROLES, or null; null always with why
 */
/**
 * The roles of a table's columns (R6, R11). `roster` is false, with why, when no column is `name` or `employee_id`.
 * @typedef {Object} RosterColumns
 * @property {boolean} roster
 * @property {ColumnRole[]} roles
 * @property {string|null} why
 * @property {string} [skipped_why]
 */

/** @type {ReadonlyArray<RosterRole>} the roles a column may have, `contact` among them (R4) */
export const ROLES = Object.freeze(["name", "title", "unit", "start", "end", "as_of", "employee_id", "contact"]);

/** The context the view's vocabulary is read from: the view given, else none.
 *  @param {ReaderView | null | undefined} view @returns {DoctypeContext} */
function viewCtx(view) {
  if (view && typeof view === "object") return { view };
  return {};
}

/** The roles of a header's columns. `header` is the list of the table's header cells as captured.
 * @param {unknown} header the header cells; anything but a list is refused with why
 * @param {ReaderView | null} [view] the view whose `roster_headers` name the roles
 * @returns {RosterColumns}
 */
export function rosterColumns(header, view) {
  if (!isList(header))
    return { roster: false, roles: [], why: localize("roster-reader.columns.no_header_was_given", "no header was given: a table's roles are named from its header cells, a list") };
  const ctx = viewCtx(view);
  /** @type {Array<{ role: RosterRole, re: RegExp }>} */
  const entries = [];
  let skipped = 0;
  for (const e of vocabulary(ctx, "roster_headers")) {
    const { role } = "role" in e ? e : { role: undefined };
    const known = ROLES.find((r) => r === role);
    const re = known ? vocabRegex("pattern" in e ? e.pattern : undefined) : null;
    if (re && known) entries.push({ role: known, re }); else skipped++;
  }
  /** @type {ColumnRole[]} */
  const roles = header.map((cell, index) => {
    const text = typeof cell === "string" ? cell.replace(/\s+/g, " ").trim() : "";
    if (!text) return { index, header: cell ?? null, role: null, why: localize("roster-reader.columns.the_column_has_no_header", "the column has no header text, so no role is named") };
    const hit = [...new Set(entries.filter((x) => text.search(x.re) >= 0).map((x) => x.role))];
    const only = hit.length === 1 ? hit[0] : undefined;
    if (only) return { index, header: text, role: only, why: null };
    if (hit.length > 1) return { index, header: text, role: null, why: localize("roster-reader.columns.its_header_matches_the_views", "its header matches the view's words for more than one role ({hit}), so no role is named by guess", { hit: String(hit.join(", ")) }) };
    return { index, header: text, role: null,
             why: entries.length ? localize("roster-reader.columns.no_header_word_in_the_view", "no header word in the view names a role for it")
                                 : localize("roster-reader.columns.the_view_supplies_no_roster", "the view supplies no roster header words, so no column's role can be named") };
  });
  const has = (/** @type {RosterRole} */ r) => roles.some((c) => c.role === r);
  const roster = has("name") || has("employee_id");
  /** @type {RosterColumns} */
  const out = {
    roster,
    roles,
    why: roster ? null : localize("roster-reader.columns.no_column_is_named_name", "no column is named `name` or `employee_id`, so this table is not read as a roster{v1}", { v1: String(entries.length ? "" : " (the view supplies no roster header words)") }),
  };
  if (skipped) out.skipped_why = localize("roster-reader.columns.skipped_roster_header_entr_v1", "{skipped} roster header entr{v1} in the view name no known role or do not compile, and were not used", { skipped: String(skipped), v1: String(skipped === 1 ? "y" : "ies") });
  return out;
}
