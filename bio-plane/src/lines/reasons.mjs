/* lines: the reasons this module gives for an undetermined answer (R24; people R40; civil-time R30). A reason is
   `{key, vars}`, never English: `key` a `lines.why.*` row of the word list, `vars` the values it fills. `reasonText`
   reads one in English, for a caller that draws a sentence itself (connection-grammar judges an item's reason as a
   string, R14); the screens read `word(key, vars)`. A reason an owner answers (`civil-time`) is carried exactly as that
   owner answers it, inside `vars` where this module names it, and never flattened. The sentences written first here are
   `localize` calls (K3930, K3943). */
import { localize } from "../setup-words/index.mjs";
import { reasonText as civilReasonText } from "../civil-time/index.mjs";

/** R24: a reason, a key with its fills. */
export const reason = (key, vars = {}) => ({ key, vars });

const isReason = (w) => w !== null && typeof w === "object" && typeof w.key === "string";

/** A `why` any owner answered, as a reason: a `{key, vars}` as it is; anything else (a caught throw's message, an old
 *  string) as the reason that names it, so no `why` of this module is ever a string. */
export const asReason = (w, fallback = "lines.why.date_unjudged") =>
  isReason(w) ? w : reason(fallback, { message: String(w) });

const TEXT = {
  "lines.why.cache_stale": (v) => localize("lines.why.cache_stale", "the line's dates are not trusted: its bound cache differs from its rebuild", v),
  "lines.why.no_line_covers": (v) => localize("lines.why.no_line_covers", "no line covers the date", v),
  "lines.why.lines_disagree": (v) => localize("lines.why.lines_disagree", "the lines {lines} bear on who holds this office at the date, and the record does not settle which one does", v),
  "lines.why.read_truncated": (v) => localize("lines.why.read_truncated", "more lines than one read holds name this office, so who holds it is not settled", v),
  "lines.why.date_unreadable": (v) => localize("lines.why.date_unreadable", "the date could not be read: {refused}", v),
  "lines.why.date_unjudged": (v) => localize("lines.why.date_unjudged", "the date could not be judged: {message}", v),
  "lines.why.stated_current_through": (v) => localize("lines.why.stated_current_through", "{why}; it is stated current through {day}, and the date is after that", { ...v, why: reasonText(v.why) }),
  "lines.why.entity_lines_kinds": (v) => localize("lines.why.entity_lines_kinds", "this entity has more than {hub} lines of the kinds asked, so it is named, never expanded", v),
};

/** Every key a reason of this module can carry. */
export const REASON_KEYS = Object.freeze(Object.keys(TEXT));

/** A `why` as English: a string as it is, a `{key, vars}` through the list (this module's keys, else `civil-time`'s). */
export function reasonText(why) {
  if (typeof why === "string") return why;
  if (!isReason(why)) throw new TypeError("a reason is a string or {key, vars}");
  return Object.hasOwn(TEXT, why.key) ? TEXT[why.key](why.vars ?? {}) : civilReasonText(why);
}
