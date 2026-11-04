/* case-grammar — the passages a `/10` case document states apart (requirements: `build/requirements/case-grammar.md` R36,
 * R37, with R35's `/10`, R17's blocks and R14's edition; DEC-461, DEC-464). Two flat blocks (K549), written with R17's
 * exact values so each reads back byte for byte:
 *
 *   ungraded_passages:  one row per relied-on passage whose `grading_facts:` row (same `finding`, `ord`) shows no grade,
 *                       `{finding, ord, content_id}`, the findings in roster order and each finding's rows in `ord`
 *                       order; no line at all when there is none (R36).
 *   typed_passages:     one row per relied-on passage whose chain's derivation is a `typed` step (`text-chain`,
 *                       `content` R24): `{finding, ord, content_id, checked, typed_at, typist_level, typist_shown,
 *                       checkers}`, `checkers` the canonical JSON list of `{level, shown, at}` of the members other than
 *                       the typist who had checked it when the document was prepared, in time order (R37).
 *
 * NO MEMBER IS NAMED BEYOND THE CREDIT THEY CHOSE (R37; R2's levels). A level is one of `ATTRIBUTION_LEVELS` or null; its
 * `shown` is written only at `cover` (the cover name) and `name` (the name), null at `group`, `project` or no level, and
 * no other field of what the writer is handed (a member id, a handle, a key) is ever written.
 *
 * WHICH DOCUMENT STATES THEM. Each reader answers `{state, rows, detail}`: `stated` with the rows for a `/10` or later
 * document (`[]` when it carries no block: it stated none); `predates` for every earlier format, whatever key it carries
 * (never read); `unreadable` when the key is present and not a list. Pure; nothing here throws. */

import { caseDocumentStatesUngradedAndTyped } from "./formats.mjs";
import { unexact, exactRowsBlock } from "./facts.mjs";

/** R37: the credit levels, most protective first (R2's `ATTRIBUTION_LEVELS`, spelled here so this file imports no
 *  renderer), and the two at which nothing of the member is shown. */
const LEVELS = Object.freeze(["group", "project", "cover", "name"]);
const SHOWN_LEVELS = Object.freeze(["cover", "name"]);

/** R36: the fields of an `ungraded_passages:` row, in order. */
export const UNGRADED_PASSAGE_FIELDS = Object.freeze(["finding", "ord", "content_id"]);
/** R37: the fields of a `typed_passages:` row, in order, and of each of its `checkers`. */
export const TYPED_PASSAGE_FIELDS = Object.freeze(["finding", "ord", "content_id", "checked", "typed_at", "typist_level",
  "typist_shown", "checkers"]);
export const TYPED_CHECKER_FIELDS = Object.freeze(["level", "shown", "at"]);

/** R36, R37: the four sentences a reader answers with, exported as R27's are (BOB's drafts). */
export const UNGRADED_PREDATE_SENTENCE = "this case document's format predates the statement of passages published "
  + "without a grade, so it states none; that is not a statement that there were none";
export const UNGRADED_UNREADABLE_SENTENCE = "this case document declares a format that states passages published without "
  + "a grade, but carries no readable block, so what it stated is undetermined";
export const TYPED_PREDATE_SENTENCE = "this case document's format predates the statement of passages a member typed, "
  + "with who typed and who checked them, so it states none; that is not a statement that there were none";
export const TYPED_UNREADABLE_SENTENCE = "this case document declares a format that states passages a member typed, "
  + "but carries no readable block, so what it stated is undetermined";

const objects = (xs) => (Array.isArray(xs) ? xs.filter((x) => x && typeof x === "object" && !Array.isArray(x)) : []);
const get = (r, f) => { try { return r[f]; } catch { return undefined; } };
const strOrNull = (v) => (typeof v === "string" && v ? v : null);
const ordOrNull = (v) => (Number.isSafeInteger(v) ? v : null);
const levelOf = (v) => (LEVELS.includes(v) ? v : null);
/* A credit as written: its level, and what it shows only at `cover` or `name`. */
const credit = (level, shown) => {
  const l = levelOf(level);
  return { level: l, shown: SHOWN_LEVELS.includes(l) ? strOrNull(shown) : null };
};
const time = (v) => (typeof v === "string" ? v : "");

/* ===== R36 — THE PASSAGES PUBLISHED WITHOUT A GRADE ===== */

/** R36: the `ungraded_passages:` block's lines, from rows `{finding, ord, content_id}` in the order given (the author's:
 *  roster, then `ord`); no line at all when there is none, so a document with every passage graded keeps its bytes. */
export function ungradedPassagesLines(rows) {
  try {
    const written = objects(rows).map((r) => ({ finding: strOrNull(get(r, "finding")), ord: ordOrNull(get(r, "ord")),
                                                content_id: strOrNull(get(r, "content_id")) }));
    return written.length ? exactRowsBlock("ungraded_passages", written, UNGRADED_PASSAGE_FIELDS) : [];
  } catch {
    return [];
  }
}

/** R36: the rows R36 states, worked out from what the document signs: for each finding of `roster` in its order, each
 *  of its `passages` (R17's rows) in `ord` order whose `grading_facts` row of the same `finding` and `ord` shows no grade
 *  (`grade` null or absent). A passage whose leg has no grading-facts row is not listed (nothing says it is ungraded).
 *  Pure; never throws (`[]` for input it cannot read). */
export function ungradedPassagesFrom(roster, gradingRows, passageRows) {
  try {
    const facts = objects(gradingRows);
    const graded = (f, o) => {
      const row = facts.find((g) => get(g, "finding") === f && get(g, "ord") === o);
      return row ? get(row, "grade") !== null && get(row, "grade") !== undefined : null;
    };
    const passages = objects(passageRows);
    return (Array.isArray(roster) ? roster : []).filter((f) => typeof f === "string").flatMap((f) => passages
      .map((p, i) => [p, i]).filter(([p]) => get(p, "finding") === f)
      .sort((a, b) => (ordOrNull(get(a[0], "ord")) ?? Infinity) - (ordOrNull(get(b[0], "ord")) ?? Infinity) || a[1] - b[1])
      .filter(([p]) => graded(f, get(p, "ord")) === false)
      .map(([p]) => ({ finding: f, ord: ordOrNull(get(p, "ord")), content_id: strOrNull(get(p, "content_id")) })));
  } catch {
    return [];
  }
}

/* One reader of both blocks: the three states. */
const readStated = (fm, key, fields, predate, unreadable, shape) => {
  try {
    const d = fm && typeof fm === "object" && !Array.isArray(fm) ? fm : null;
    if (!caseDocumentStatesUngradedAndTyped(d)) return { state: "predates", rows: null, detail: predate };
    if (!Object.hasOwn(d, key) || d[key] === null || d[key] === undefined) return { state: "stated", rows: [], detail: null };
    if (!Array.isArray(d[key])) return { state: "unreadable", rows: null, detail: unreadable };
    return { state: "stated", rows: objects(d[key]).map((r) => shape(Object.fromEntries(fields.map((f) => [f, unexact(r[f])])))),
             detail: null };
  } catch {
    return { state: "unreadable", rows: null, detail: unreadable };
  }
};

/** R36: the `ungraded_passages:` block read back, `{state, rows, detail}` (above). Pure; never throws. */
export function ungradedPassagesOf(fm) {
  return readStated(fm, "ungraded_passages", UNGRADED_PASSAGE_FIELDS, UNGRADED_PREDATE_SENTENCE,
    UNGRADED_UNREADABLE_SENTENCE, (r) => r);
}

/* ===== R37 — THE TYPED PASSAGES: WHO TYPED AND WHO CHECKED, AS OF SIGNING ===== */

/* A row as written: the credits by R2's levels, the checkers other than the typist in time order, `checked` true exactly
   when one is listed. */
const typedRow = (r) => {
  const typist = credit(get(r, "typist_level"), get(r, "typist_shown"));
  const checkers = objects(get(r, "checkers")).map((c, i) => [{ ...credit(get(c, "level"), get(c, "shown")),
    at: strOrNull(get(c, "at")) }, i])
    .sort((a, b) => (time(a[0].at) < time(b[0].at) ? -1 : time(a[0].at) > time(b[0].at) ? 1 : a[1] - b[1])).map(([c]) => c);
  return { finding: strOrNull(get(r, "finding")), ord: ordOrNull(get(r, "ord")), content_id: strOrNull(get(r, "content_id")),
           checked: checkers.length > 0, typed_at: strOrNull(get(r, "typed_at")), typist_level: typist.level,
           typist_shown: typist.shown, checkers };
};

/** R37: the `typed_passages:` block's lines, from rows `{finding, ord, content_id, typed_at, typist_level, typist_shown,
 *  checkers: [{level, shown, at}]}` in the order given; `checked` is written true when a checker is listed. A `shown` is
 *  written only at `cover` or `name`; nothing else handed is written. No line at all when there is none. */
export function typedPassagesLines(rows) {
  try {
    const written = objects(rows).map(typedRow);
    return written.length ? exactRowsBlock("typed_passages", written, TYPED_PASSAGE_FIELDS) : [];
  } catch {
    return [];
  }
}

/** R37: the `typed_passages:` block read back, `{state, rows, detail}` as R36's reader answers, each row's `checkers`
 *  the list of `{level, shown, at}` (an unreadable list reads `[]`), `checked` true only when the bytes say true. Pure;
 *  never throws. */
export function typedPassagesOf(fm) {
  return readStated(fm, "typed_passages", TYPED_PASSAGE_FIELDS, TYPED_PREDATE_SENTENCE, TYPED_UNREADABLE_SENTENCE,
    (r) => ({ ...r, checked: r.checked === true,
              checkers: objects(r.checkers).map((c) => ({ level: levelOf(c.level), shown: strOrNull(c.shown), at: strOrNull(c.at) })) }));
}
