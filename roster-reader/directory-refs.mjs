/* `directoryPersonRefs(entities, view)` (R7): a staff directory's contact entries as person references.
 *
 * THE KEY STAYS THE ADDRESS. `staff_directory` keys an entry by its address because that is the identifier
 * the document assigns (its own header); a person's name is not. So each reference here is keyed by
 * `contact_key`, the entry's address, and a name is read beside it only when the entry's line, with its
 * address, phone numbers and staff-title words removed, leaves exactly ONE name-shaped span. A two-column
 * directory puts two people's text on one line (its document B), and any other count is not divided by
 * guess.
 *
 * A NAME READ HERE IS A NAME ALONE: grade C (K1484 row 12; K1488 (b): an identifier at both ends earns A, a
 * name corroborated by a fact true at both dates B, a name alone C). It is never more, whatever matches it
 * later: `match_grade` is a ceiling `entities` applies, not a score this module raises. */
import { readerView } from "../docprofile/registry.mjs";
import { nameSpans, withoutContacts, titlePatterns, titleSpans, removeSpans } from "./lines.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

export const NAME_GRADE = "C";

export function directoryPersonRefs(entities, view) {
  const ctx = { view: view && typeof view === "object" ? view : readerView({}) };
  const titles = titlePatterns(ctx);
  const out = [];
  for (const e of Array.isArray(entities) ? entities : []) {
    if (!e || e.kind !== "contact" || typeof e.key !== "string" || !e.key) continue;
    const line = e.facts && typeof e.facts.line === "string" ? e.facts.line : "";
    const ref = { contact_key: e.key };
    if (!line.trim()) { out.push({ ...ref, match_grade: null, why: localize("roster-reader.directory-refs.the_entry_carries_no_line", "the entry carries no line to read a name from") }); continue; }
    const spans = withoutContacts(line).parts.flatMap((part) => nameSpans(removeSpans(part, titleSpans(titles, part))));
    if (spans.length === 1)
      out.push({ ...ref, name: spans[0].text, match_grade: NAME_GRADE,
                 why: localize("roster-reader.directory-refs.one_name_shaped_span_remains", "one name-shaped span remains on the entry's line once its address, phone numbers and staff titles are removed; a name alone is grade C") });
    else
      out.push({ ...ref, match_grade: null,
                 why: spans.length ? localize("roster-reader.directory-refs.length_name_shaped_spans_remain", "{length} name-shaped spans remain on the entry's line, which may hold more than one person's text, so no name is read", { length: String(spans.length) })
                                   : localize("roster-reader.directory-refs.no_name_shaped_span_remains", "no name-shaped span remains on the entry's line once its address, phone numbers and staff titles are removed") });
  }
  return out;
}
