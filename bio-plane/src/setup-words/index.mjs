/* setup-words (R4, R10–R14): the interface's word list and the three services that read it. The list is generated
   (rows.mjs, by build.mjs) and frozen; `word` fills a key's English, `hasWord` says whether a key is held, `localize` reads a sentence written first in code. Nothing here
   does I/O, keeps state beyond the lookup table built on first call, or reads the clock or randomness. */
import { WORD_ROWS, WORDS_COMMIT } from "./rows.mjs";

export { WORD_ROWS, WORDS_COMMIT };

let table;
const rowsByKey = () => (table ??= new Map(WORD_ROWS.map((r) => [r[0], r])));

const fail = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });

/** R12: true exactly when the list holds `key`. */
export const hasWord = (key) => typeof key === "string" && rowsByKey().has(key);

const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
const ID = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;

/* R11's placeholder rule, shared by `word` and `localize`: each `{name}` filled from `vars[name]` as String writes it.
   R19: a value that is a reason `{key, vars}` is filled with that reason's words (`word`, so to any depth), never String. */
function fill(key, text, vars) {
  return text.replace(PLACEHOLDER, (_, name) => {
    const v = vars?.[name];
    if (!Object.hasOwn(vars ?? {}, name) || v === undefined || v === null) throw fail("WORD_VAR_MISSING", `${key} needs {${name}}`);
    if (typeof v === "object" && typeof v.key === "string") return word(v.key, v.vars ?? {});
    return String(v);
  });
}

/** R11: the English of `key`, each `{name}` filled from `vars[name]` (a string or a number, as `String` writes it).
 *  UNKNOWN_WORD when the list lacks `key`; WORD_VAR_MISSING when a placeholder's name is absent from `vars`. */
export function word(key, vars = {}) {
  const row = typeof key === "string" ? rowsByKey().get(key) : undefined;
  if (!row) throw fail("UNKNOWN_WORD", `no word ${typeof key === "string" ? key : String(key)}`);
  return fill(key, row[1], vars);
}

/** R14: the sentence for `id` when the list holds a row for it, else `en`, filled as `word` fills it. `id` and `en` are
 *  string literals at the call, so the build reads them; the list always wins, `en` is never compared with the row.
 *  BAD_WORD_ID when `id` is not a dotted id; WORD_VAR_MISSING as `word`'s. */
export function localize(id, en, vars = {}) {
  if (typeof id !== "string" || !ID.test(id)) throw fail("BAD_WORD_ID", `${typeof id === "string" ? id : String(id)} is not a word id`);
  const row = rowsByKey().get(id);
  if (!row && typeof en !== "string") throw fail("BAD_WORD_EN", `${id} has no row and no sentence`);
  return fill(id, row ? row[1] : en, vars);
}
