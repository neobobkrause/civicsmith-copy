/* case-grammar — what a `/6` case document signs of each finding's chain: its grading facts and the passages it relies
 * on, and the one spelling of a document's extracted text (requirements: `build/requirements/case-grammar.md` R17, with
 * R13; DEC-112 (3); K1305, K1315, K1317). `case-authoring` writes the blocks (its R54) with the line builders here;
 * `public-read` writes one `grading_facts` and one `passages` file per finding from them (its R23); `case-checker`
 * recomputes from them. Pure; nothing here throws.
 *
 * THE BLOCKS (flat rows, K549):
 *   grading_facts:  one row per leg of each finding a member's chain reaches: `finding`, `ord`, and the fields
 *                   `strength.gradingFacts` (its R35) answers for that leg, as recorded at the act.
 *   passages:       one row per relied-on passage: `finding`, `ord`, `content_id`, `capture_sha`, `extent`, `chain` (null
 *                   when none, so `content_id` recomputes), `quoted`.
 *
 * ONE VALUE, EXACTLY. A row's values must read back byte for byte (a quoted passage is found in the extracted text; a
 * list of origins is compared): `fmSafe` folds line breaks and quotes, so these rows do not use it. Every value that is
 * not null, a number or a boolean is written as its canonical JSON (`record-grammar`'s) in one single-quoted value, a
 * single quote inside escaped `'` so the grammar's quoting and comment rule never cut it; a reader parses it back.
 * A list or map field is so its canonical JSON in one quoted value, as R17 says, and a string the JSON of the string. */

import { canonicalJson } from "../record-grammar/index.mjs";
import { caseDocumentRequiresMaterials } from "./formats.mjs";

/** R17: the fields of a `grading_facts:` row (strength R35's per leg, after `finding` and `ord`), in order. */
export const GRADING_FACT_FIELDS = Object.freeze(["finding", "ord", "target", "kind", "role", "grade", "grade_axis",
  "grade_source", "ground", "target_edition", "answer", "origins", "origins_complete", "captures", "author_key",
  /* K1608 (strength R35): a calculation, standard or occurrence leg's reason its capture grade is undetermined. Last, so
     a row written before it reads it null, undetermined. */
  "undetermined"]);
/** R17 (T53; `strength` R47, PR 176): the optional flat field after them, what `strength.gradingFacts` answers for a leg
 *  on a typed passage, `{checked}`: it is typed, and whether a second member checked it (no names). Written only on a row
 *  handed a non-null `typed`, so every other row, and every row signed before it, is written and read exactly as before
 *  (absent reads null). `GRADING_FACT_FIELDS` is unchanged. */
export const GRADING_FACT_TYPED_FIELD = "typed";
/** R17: the fields of a `passages:` row, in order. */
export const PASSAGE_FIELDS = Object.freeze(["finding", "ord", "content_id", "capture_sha", "extent", "chain", "quoted"]);

const objects = (xs) => (Array.isArray(xs) ? xs.filter((x) => x && typeof x === "object" && !Array.isArray(x)) : []);
/* One value on one line, exactly (above). Shared with R18's and R20's blocks (`./calculations.mjs`, `./timeline.mjs`),
   which carry their values the same way; `./index.mjs` does not re-export them. */
export const exact = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) return String(v);
  let json;
  try { json = canonicalJson(v); } catch { return "null"; }
  return json === undefined ? "null" : `'${json.replace(/'/g, "\\u0027")}'`;
};
/* A value read back: a parsed JSON value from its quoted form, a number or boolean as the grammar read it, else null. */
export const unexact = (v) => {
  if (v === null || v === undefined || typeof v === "number" || typeof v === "boolean") return v ?? null;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
};
export const exactRowsBlock = (key, rows, fields) => (rows.length
  ? [`${key}:`, ...rows.flatMap((r) => fields.map((f, i) => `${i ? "   " : "  -"} ${f}: ${exact(r[f])}`))]
  : [`${key}: []`]);
const ordOf = (r) => (Number.isSafeInteger(r.ord) ? r.ord : Number.POSITIVE_INFINITY);
/* Rows grouped by finding, in the order each finding first appears, each finding's rows in `ord` order. */
const byFinding = (rows) => {
  const out = {};
  for (const r of rows) if (typeof r.finding === "string" && r.finding) (out[r.finding] ||= []).push(r);
  for (const k of Object.keys(out)) out[k] = out[k].map((r, i) => [r, i]).sort((a, b) => ordOf(a[0]) - ordOf(b[0]) || a[1] - b[1])
    .map(([r]) => r);
  return out;
};
/* `optional` fields are read only on a row that states them, so a row signed before them reads exactly as it did. */
const readBlock = (fm, key, fields, optional = []) => {
  const d = fm && typeof fm === "object" ? fm : null;
  if (!caseDocumentRequiresMaterials(d) || !Array.isArray(d[key])) return null;
  return byFinding(objects(d[key]).map((r) => Object.fromEntries([...fields, ...optional.filter((f) => Object.hasOwn(r, f))]
    .map((f) => [f, unexact(r[f])]))));
};

/** R17: the `grading_facts:` block's lines, from rows `{finding, ord, target, kind, role, grade, grade_axis,
 *  grade_source, ground, target_edition, answer, origins, origins_complete, captures, author_key, undetermined, typed?}`, in
 *  the order given (`typed` written only when handed, `strength` R47);
 *  a field not handed is written null. `grading_facts: []` when there are none. */
export function gradingFactsLines(rows) {
  const given = objects(rows);
  const typedOf = (r) => { try { return r[GRADING_FACT_TYPED_FIELD] ?? null; } catch { return null; } };
  if (!given.length) return ["grading_facts: []"];
  return ["grading_facts:", ...given.flatMap((r) => [...GRADING_FACT_FIELDS, ...(typedOf(r) === null ? [] : [GRADING_FACT_TYPED_FIELD])]
    .map((f, i) => `${i ? "   " : "  -"} ${f}: ${exact(f === GRADING_FACT_TYPED_FIELD ? typedOf(r) : r[f])}`))];
}

/** R17: the `passages:` block's lines, from rows `{finding, ord, content_id, capture_sha, extent, chain, quoted}`, in the
 *  order given; `chain` null when none. `passages: []` when there are none. */
export function passagesLines(rows) {
  return exactRowsBlock("passages", objects(rows), PASSAGE_FIELDS);
}

/** R17: the `grading_facts:` block read back from a `/6` document's front matter: `{[finding]: [row, …]}`, findings in
 *  the order they first appear, each finding's rows in `ord` order, every value as written; a row stating `typed`
 *  (`strength` R47) reads it as `typed: {checked}`, a row stating none has no `typed`. Null when the block is
 *  absent, and for any other format. Pure; never throws. */
export function gradingFactsOf(fm) {
  try { return readBlock(fm, "grading_facts", GRADING_FACT_FIELDS, [GRADING_FACT_TYPED_FIELD]); } catch { return null; }
}

/** R17: the `passages:` block read back, as `gradingFactsOf` reads its block. Pure; never throws. */
export function passagesOf(fm) {
  try { return readBlock(fm, "passages", PASSAGE_FIELDS); } catch { return null; }
}

/** R17 (K1315 (2)): a document's extracted text, the one spelling: the canonical JSON of `extraction`'s units in `seq`
 *  order, each `{extent, ref, text}`; R12's `text_sha` is its SHA-256. A unit that is not an object is left out; a
 *  field a unit lacks is null. Units with the same `seq` keep the order given. Pure; never throws (`null` for input
 *  that is not a list, or that canonical JSON cannot spell). */
export function extractedTextOf(units) {
  try {
    if (!Array.isArray(units)) return null;
    const seq = (u) => (typeof u.seq === "number" && Number.isFinite(u.seq) ? u.seq : Number.POSITIVE_INFINITY);
    return canonicalJson(objects(units).map((u, i) => [u, i]).sort((a, b) => seq(a[0]) - seq(b[0]) || a[1] - b[1])
      .map(([u]) => ({ extent: u.extent ?? null, ref: u.ref ?? null, text: u.text ?? null })));
  } catch {
    return null;
  }
}
