/* case-grammar — what a `/6` case document carries so anybody can recreate it: the method it was made under, the
 * materials its members' chains reach with their attestations, and the other group's work it rests on (requirements:
 * `build/requirements/case-grammar.md` R11, R12, R16, with R1's `/6` and R6; DEC-112 (3)(4)(5), DEC-119 (1), DEC-96
 * item 4; K1134 Q6 (BOB's decision 15), K1273, K1275). `case-authoring` writes the blocks (its R43, R45, R48, R51, R52)
 * with the line builders here, so the bytes are written one way, and `methodOf`, `materialsOf` and `acceptedWorkOf` are
 * the one reading of them, for `public-read`, `case-checker` and `case-import` alike.
 *
 * THE BLOCKS, as a `/6` document's front matter carries them (a map, and arrays of flat rows: K549):
 *   method:                 a map `grading` (`strength`'s `GRADING_METHOD_VERSION`), `checks` (`promotion`'s
 *                           `CATALOG_VERSION`), the versions the document was graded and checked under.
 *   materials:              one row per document or observation any member's chain reaches: `ref`, `kind` (`document`
 *                           or `observation`), `sha`, `text_sha`, `origin`, `archived_copy`, `included` (whether it
 *                           travels whole), `rests_under` (`load_bearing` or `supporting`),
 *                           `title` (fix round 4, C47; K4438: the capture's title, null when it has none or for an
 *                           observation; optional: a row written before it lacks it and reads null).
 *                           (T37; N757; DEC-180 (4); T38: N779, K2248; T39: N806, K2333) A `document` row may also
 *                           state `obscured_copy` and `obscured_label`: the material travels as its copy, never whole:
 *                           a photo's (nothing of the original but its pixels, its marked areas, if any, covered), or
 *                           a member document's cleaned copy (`case-carriage` R15: every picture in it, and the
 *                           document itself, carrying none of their details). The row states `included: false` and
 *                           keeps the original's `sha`, `text_sha`, `origin` and `archived_copy`; read back as
 *                           `obscured: {copy, label, marked, kind}` (T40: `obscured_marked`, optional; absent, read by
 *                           the label; T47: `obscured_kind`, optional, `photo` or `document`; absent, null). A published case states it for every photo it carries and every
 *                           member document it carries as its copy (its writers' duty: `case-carriage`,
 *                           `case-authoring`). `label` is `case-carriage`'s `OBSCURED_LABEL` for a marked photo, for an
 *                           unmarked one (a copy with nothing covered) its `PUBLISHED_LABEL` since T40 (null before), and its `COPY_CLEANED_LABEL` for a
 *                           member document, written as handed: this module is earlier than `case-carriage` and names
 *                           no label of its own. An optional field of `/7`, with no new format (K2206): a row without
 *                           it is written and read exactly as before, and an absent label reads null.
 *   material_attestations:  one row per attestation of a material: `ref`, `by_kind` (`member`, `co_attestation`,
 *                           `project`, `group`), `by`, `level`, `at`, `signature`, `recorded_in`, and (G47, optional)
 *                           `sha`, the capture it is of; absent, read null and joined to the material by `ref`.
 *   accepted_work:          one row per (member, leg) whose chain reaches another group's finding (`inquiry-grammar`
 *                           R11's ref): who accepted which edition, when and why, its result and gaps, its pair.
 *   accepted_work_flags:    one row per open flag on that work the case discloses.
 *
 * WHAT A `member` ROW AT `group` OR `project` CARRIES (DEC-102; DEC-119 (3)): no handle, no key and no signature; the
 * writer writes `by` and `signature` null for it whatever it is handed, so the bytes cannot name an anonymous member.
 * A `group` row's signature is the literal `case`: the case document's own signature covers it. A `project` row's is
 * null. Pure; the readers never throw. */

import { createSha256, canonicalJson } from "../record-grammar/index.mjs";
import { caseDocumentRequiresMaterials, attestationShaOf } from "./formats.mjs";
import { fmSafe } from "./blocks.mjs";
import { exact, unexact } from "./facts.mjs";

const val = (v) => (v === undefined || v === null || v === "null" ? null : v);
const bool = (v) => (v === true || v === "true" ? true : v === false || v === "false" ? false : null);
const scalar = (v) => (v === null || v === undefined ? "null" : typeof v === "boolean" ? String(v)
  : typeof v === "number" && Number.isFinite(v) ? String(v) : `"${fmSafe(v)}"`);
/* A block of flat rows; a field in `raw` is written as handed, unquoted (R16's inline pair list). */
const rowsBlock = (key, rows, fields, raw = []) => (rows.length
  ? [`${key}:`, ...rows.flatMap((r) => fields.map((f, i) =>
      `${i ? "   " : "  -"} ${f}: ${raw.includes(f) ? r[f] : scalar(r[f])}`))]
  : [`${key}: []`]);
const objects = (xs) => (Array.isArray(xs) ? xs.filter((x) => x && typeof x === "object" && !Array.isArray(x)) : []);
const frontOf = (fm) => (fm && typeof fm === "object" ? fm : null);
const oneOf = (v, allowed) => (allowed.includes(v) ? v : null);
const count = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const read = (r, fields) => Object.fromEntries(fields.map((f) => [f, val(r[f])]));

/* ===== R11 — THE METHOD (DEC-112 (3): "the version of the method and checks inside the signed case") ===== */

/** R11: the fields of the `method:` map, in the order they are written. */
export const METHOD_FIELDS = Object.freeze(["grading", "checks"]);

/** R11: the `method:` block's lines, from `{grading, checks}`. */
export function methodBlockLines(given) {
  const { grading = null, checks = null } = given && typeof given === "object" ? given : {};
  return ["method:", `  grading: ${scalar(grading)}`, `  checks: ${scalar(checks)}`];
}

/** R11: the versions a `/6` document states it was graded and checked under, `{grading, checks}`; null for a document
 *  without the block and for any other format. A version not stated reads null, undetermined (R6). Pure; never throws. */
export function methodOf(fm) {
  try {
    const d = frontOf(fm);
    if (!caseDocumentRequiresMaterials(d)) return null;
    const m = d.method;
    if (!m || typeof m !== "object" || Array.isArray(m)) return null;
    const str = (v) => (typeof val(v) === "string" && v ? v : typeof v === "number" ? String(v) : null);
    return { grading: str(m.grading), checks: str(m.checks) };
  } catch {
    return null;
  }
}

/* ===== R12 — THE MATERIALS AND THEIR ATTESTATIONS (DEC-112 (3)(4)(5); DEC-119 (1); K1134 Q6) ===== */

/** R12: the fields of a `materials:` row and of a `material_attestations:` row, in the order they are written. */
export const MATERIAL_FIELDS = Object.freeze(["ref", "kind", "sha", "text_sha", "origin", "archived_copy", "included",
  "rests_under"]);
export const MATERIAL_ATTESTATION_FIELDS = Object.freeze(["ref", "by_kind", "by", "level", "at", "signature",
  "recorded_in"]);
/** R12 (G47; K4669, K4672): the optional flat field after `recorded_in`, the `sha` of the capture the attestation is of, so
 *  a case of several captures of one source joins each attestation to its capture and not to the source (`ref`) alone.
 *  Written only when the row is handed one (a non-empty sentence), so a row without it, and every row written before it,
 *  is written byte for byte as before and reads `sha: null`; a document carrying any declares `/9` (`./formats.mjs`).
 *  `MATERIAL_ATTESTATION_FIELDS` is unchanged. */
export const MATERIAL_ATTESTATION_SHA_FIELD = "sha";
/** R12: what a material is, how it rests, and who attests it. */
export const MATERIAL_KINDS = Object.freeze(["document", "observation"]);
export const MATERIAL_RESTS_UNDER = Object.freeze(["load_bearing", "supporting"]);
export const ATTESTATION_BY_KINDS = Object.freeze(["member", "co_attestation", "project", "group"]);
/** R12 (fix round 4, C47; K4438): the optional flat field after `rests_under`, the document's title as its capture holds
 *  it, so `public-read` names an entry by it without reading the register at read time (its R10, R14). Written only when
 *  the row is handed a `title` (a sentence, else null: the capture has none, or an observation), so a writer that does not
 *  know it yet, and every row written before it, is written and read exactly as before: absent reads null. */
export const MATERIAL_TITLE_FIELD = "title";
/** R12 (T37; N757): the two flat fields a `document` row carried as its copy adds, after `rests_under`, in order. */
export const MATERIAL_OBSCURED_FIELDS = Object.freeze(["obscured_copy", "obscured_label"]);
/** R12 (T40; N798; DEC-185 (1); K2394): the optional flat field after them, whether the copy has marked areas covered;
 *  written only when handed `marked` as a boolean, so a row written before T40 is written and read exactly as before. */
export const MATERIAL_OBSCURED_MARKED_FIELD = "obscured_marked";
/** R31 (T47; N953): the optional flat field after them, the stored marker telling a photo's copy (`case-carriage` R11)
 *  from a member document's cleaned copy (`case-carriage` R15), so no reader tells them apart by a label's words and the
 *  design stream may re-word either label without re-keying a signed edition; and the two kinds it states. Written only
 *  when the row is handed a `kind` (one of the two, else null, undetermined), so a row written before T47 is written and
 *  read exactly as before. */
export const MATERIAL_OBSCURED_KIND_FIELD = "obscured_kind";
export const MATERIAL_OBSCURED_KINDS = Object.freeze(["photo", "document"]);
/** R12: the levels a member's attestation is stated at (`publication` R17's four), and the two that name nobody. */
export const ATTESTATION_LEVELS = Object.freeze(["group", "project", "cover", "name"]);
export const ANONYMOUS_ATTESTATION_LEVELS = Object.freeze(["group", "project"]);
/** R12: a `group` row's signature: the case document's own signature covers it. */
export const GROUP_ATTESTATION_SIGNATURE = "case";

/* A material row as written: a `kind` or `rests_under` outside its words is written null (undetermined, never a
   guess), and `included` true only when handed true, so nothing is said to travel whole that was not. A `document` row
   handed `obscured` (an object) is written with its two flat fields, a copy that is not a SHA-256 written null (so a
   reader finds the copy missing, never a guess) and a label that is not a sentence written null (an unmarked photo's
   copy carries none: T38), and `included: false` whatever it is handed: the original never travels (T37; N757), a
   photo's and a member document's alike (T39; N806). An `obscured` that cannot be read is written with its copy and
   label null: undetermined, never a guess, and the row is still listed. */
const HEX64 = /^[0-9a-f]{64}$/;
const obscuredOf = (o) => { try { return obscuredSpelled(o); } catch { return { obscured_copy: null, obscured_label: null }; } };
const obscuredSpelled = (o) => (o && typeof o === "object" && !Array.isArray(o)
  ? { obscured_copy: typeof o.copy === "string" && HEX64.test(o.copy) ? o.copy : null,
      obscured_label: typeof o.label === "string" && o.label.trim() ? o.label : null,
      ...(typeof o.marked === "boolean" ? { [MATERIAL_OBSCURED_MARKED_FIELD]: o.marked } : {}),
      ...(o.kind !== undefined ? { [MATERIAL_OBSCURED_KIND_FIELD]: oneOf(o.kind, MATERIAL_OBSCURED_KINDS) } : {}) } : null);
const titleOf = (r) => { try { return typeof r.title === "string" && r.title.trim() ? r.title : null; } catch { return null; } };
const titled = (r) => { try { return r.title !== undefined; } catch { return false; } };
/* T40: `obscured_marked` (above) only when the row is handed `marked` as a boolean; T47 (R31): `obscured_kind` only when
   it is handed a `kind`, any value but `photo` or `document` written null. */
const materialRow = (r) => {
  const kind = oneOf(r.kind, MATERIAL_KINDS);
  const obscured = kind === "document" ? obscuredOf(r.obscured) : null;
  const extract = kind === "document" && !obscured ? extractFieldsOf(r.extract) : null;
  return { ref: r.ref ?? null, kind, sha: r.sha ?? null, text_sha: r.text_sha ?? null, origin: r.origin ?? null,
           archived_copy: extract ? null : r.archived_copy ?? null, included: !obscured && !extract && r.included === true,
           rests_under: oneOf(r.rests_under, MATERIAL_RESTS_UNDER),
           ...(titled(r) ? { [MATERIAL_TITLE_FIELD]: titleOf(r) } : {}), ...obscured, ...extract };
};
/* An attestation row as written, each kind's rule applied whatever it is handed. */
const attestationRow = (r) => {
  const byKind = oneOf(r.by_kind, ATTESTATION_BY_KINDS);
  const level = byKind === "member" ? oneOf(r.level, ATTESTATION_LEVELS) : null;
  /* K1317 (6): until a member's level is chosen, the row states none and carries no identity. */
  const anonymous = byKind === "member" && (level === null || ANONYMOUS_ATTESTATION_LEVELS.includes(level));
  const capture = attestationShaOf(r);
  return { ref: r.ref ?? null, by_kind: byKind, by: anonymous ? null : r.by ?? null, level, at: r.at ?? null,
           signature: byKind === "group" ? GROUP_ATTESTATION_SIGNATURE
             : byKind === "project" || anonymous ? null : r.signature ?? null,
           recorded_in: r.recorded_in ?? null, ...(capture === null ? {} : { [MATERIAL_ATTESTATION_SHA_FIELD]: capture }) };
};

/** R12 (K1317): the `materials:` block's lines, from `[{ref, kind, sha, text_sha, origin, archived_copy, included,
 *  rests_under, title?, obscured?}]`, in the order given; `materials: []` when there are none. A `document` row handed
 *  `obscured: {copy, label, marked?, kind?}` adds `obscured_copy` and `obscured_label` (and `obscured_marked`, then R31's
 *  `obscured_kind`) after `rests_under` and is written `included: false`; every other row is written byte for byte as
 *  before T37. */
export function materialsLines(rows) {
  const written = objects(rows).map(materialRow);
  if (!written.length) return ["materials: []"];
  return ["materials:", ...written.flatMap((r) => [...MATERIAL_FIELDS, ...(MATERIAL_TITLE_FIELD in r ? [MATERIAL_TITLE_FIELD] : []),
    ...("obscured_copy" in r ? MATERIAL_OBSCURED_FIELDS : []),
    ...(MATERIAL_OBSCURED_MARKED_FIELD in r ? [MATERIAL_OBSCURED_MARKED_FIELD] : []),
    ...(MATERIAL_OBSCURED_KIND_FIELD in r ? [MATERIAL_OBSCURED_KIND_FIELD] : []),
    ...EXTRACT_ALL_FIELDS.filter((f) => f in r)]
    .map((f, i) => `${i ? "   " : "  -"} ${f}: ${EXTRACT_ALL_FIELDS.includes(f) ? exact(r[f]) : scalar(r[f])}`))];
}

/** R12 (K1317): the `material_attestations:` block's lines, from `[{ref, by_kind, by, level, at, signature,
 *  recorded_in}]`, in the order given. A `member` row at `group` or `project`, or with no level chosen yet, is written
 *  with no `by` and no `signature`; a `group` row's signature is `case`; a `project` row's null. `[]` when none. It is
 *  the run `SECTIONS.attestations` locates, so the act that records a member's level re-writes it whole. */
export function materialAttestationLines(rows) {
  const written = objects(rows).map(attestationRow);
  if (!written.length) return ["material_attestations: []"];
  return ["material_attestations:", ...written.flatMap((r) => [...MATERIAL_ATTESTATION_FIELDS,
    ...(MATERIAL_ATTESTATION_SHA_FIELD in r ? [MATERIAL_ATTESTATION_SHA_FIELD] : [])]
    .map((f, i) => `${i ? "   " : "  -"} ${f}: ${scalar(r[f])}`))];
}

/** R12: both blocks' lines, from `{materials, attestations}` (`materialsLines`, then `materialAttestationLines`). */
export function materialBlockLines(given) {
  const { materials = [], attestations = [] } = given && typeof given === "object" ? given : {};
  return [...materialsLines(materials), ...materialAttestationLines(attestations)];
}

/** R12: the two blocks read back from a `/6` document's front matter, in the document's order: `{materials: [{ref,
 *  kind, sha, text_sha, origin, archived_copy, included, rests_under, title, obscured}], attestations: [{ref, by_kind, by, level, at,
 *  signature, recorded_in, sha}]}`; a block the document does not carry answers null, and a document carrying neither (or
 *  any other format) answers null. `included` reads true only when the bytes say true. `obscured` is `{copy, label, marked,
 *  kind}` for a `document` row stating either flat field, else null (T37); a copy not stated reads null, undetermined, a
 *  label not stated reads null, a copy that carries none (an unmarked photo's, T38), and a kind not stated, or not one of
 *  R31's two, reads null (T47). Pure; never throws. */
export function materialsOf(fm) {
  try {
    const d = frontOf(fm);
    if (!caseDocumentRequiresMaterials(d)) return null;
    const has = (k) => Array.isArray(d[k]);
    if (!has("materials") && !has("material_attestations")) return null;
    return {
      materials: has("materials")
        ? objects(d.materials).map((r) => ({ ...read(r, MATERIAL_FIELDS), included: bool(r.included) === true,
                                             title: str(r[MATERIAL_TITLE_FIELD]), obscured: obscuredRead(r),
                                             ...(EXTRACT_ALL_FIELDS.some((f) => Object.hasOwn(r, f)) ? { extract: extractRead(r) } : {}) })) : null,
      attestations: has("material_attestations")
        ? objects(d.material_attestations).map((r) => ({ ...read(r, MATERIAL_ATTESTATION_FIELDS), sha: str(r[MATERIAL_ATTESTATION_SHA_FIELD]) })) : null,
    };
  } catch {
    return null;
  }
}

/* R12 (T37): a row's `obscured` read back: only a `document` row carries it, and stating either field states it, even
   as null (a copy written null is a copy not carried, never a row carried whole). */
const str = (v) => (typeof val(v) === "string" ? v : null);
function obscuredRead(r) {
  if (val(r.kind) !== "document" || !MATERIAL_OBSCURED_FIELDS.some((f) => Object.hasOwn(r, f))) return null;
  const label = str(r.obscured_label);
  /* T40 (DEC-185 (1)): `marked` as written, else by the label, so every earlier edition reads as it rendered */
  return { copy: str(r.obscured_copy), label, marked: bool(r[MATERIAL_OBSCURED_MARKED_FIELD]) ?? label !== null,
           /* T47 (R31): the stored marker as written, null on a row that states none or a value outside its two words */
           kind: oneOf(val(r[MATERIAL_OBSCURED_KIND_FIELD]), MATERIAL_OBSCURED_KINDS) };
}

/* ===== R38, R39 — A CITED REGISTER ROW TRAVELS AS A LABELLED EXTRACT (T53; N1259; K4403 (3)(4); K1483 (a)) =====
   A `document` row for a register row a member cites states, after `title`, the extract's flat fields: which register
   and file, the reduced segment's and the original piece's SHA-256, what the original covers, its source date and when
   it was imported, the row's number in the original piece, the kept columns with their roles and the dropped ones, the
   kept columns' names and the cited row's kept cells verbatim, the label's key and, for a limited register, its limit.
   The file is not carried: the row states `included: false` and `archived_copy` null, its `sha` the reduced segment's and
   its `text_sha` the SHA-256 of `extractTextOf(header, row)`. Each field is written as R17 writes a value (`exact`: its
   canonical JSON in one quoted value), so a cell holding a comma, a quote or a line break reads back verbatim, where the
   grammar's inline list would cut it. A document stating any extract field is `/10` (R35). */

/** R38: the extract's fields on a material row, in the order they are written (after `title`); R39's three after them,
 *  for a limited register only; the label's key. The names are BOB's. */
export const MATERIAL_EXTRACT_FIELDS = Object.freeze(["extract_register", "extract_file", "extract_reduced_sha256",
  "extract_original_sha256", "extract_original_covers", "extract_source_date", "extract_imported_at", "extract_src_row",
  "extract_kept_columns", "extract_roles", "extract_dropped_columns", "extract_header", "extract_row", "extract_label_key"]);
export const MATERIAL_EXTRACT_USE_LIMIT_FIELDS = Object.freeze(["extract_use_limit_key", "extract_use_limit_citation",
  "extract_use_limit_text_key"]);
const EXTRACT_ALL_FIELDS = Object.freeze([...MATERIAL_EXTRACT_FIELDS, ...MATERIAL_EXTRACT_USE_LIMIT_FIELDS]);
export const EXTRACT_LABEL_KEY = "register.extract";
/** R38: the refusal of a malformed extract. */
export const EXTRACT_INVALID = "EXTRACT_INVALID";

/* The extract's keys as `registerExtractRow` takes them and `materialsOf` answers them, beside the row's field names. */
const EXTRACT_KEYS = Object.freeze(["register", "file", "reduced_sha256", "original_sha256", "original_covers", "source_date",
  "imported_at", "src_row", "kept_columns", "roles", "dropped_columns", "header", "row", "label_key"]);
const USE_LIMIT_KEYS = Object.freeze(["key", "citation", "text_key"]);
const DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const isDate = (v) => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v))
  && (v.length !== 10 || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v);
const isSentence = (v) => typeof v === "string" && v.trim() !== "";
const isNames = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
const isCells = (v) => Array.isArray(v) && v.every((x) => x === null || typeof x === "string" || (typeof x === "number" && Number.isFinite(x)));

/** R38: the extract text `text_sha` is the SHA-256 of: the canonical JSON of `[header, row]`, one spelling for the
 *  writer and every checker. Null for input that is not two lists. Pure; never throws. */
export function extractTextOf(header, row) {
  try { return Array.isArray(header) && Array.isArray(row) ? canonicalJson([header, row]) : null; } catch { return null; }
}
const sha256Of = (text) => createSha256().update(new TextEncoder().encode(text)).hex();

/* The first field an extract breaks, by its row field name, or null when it is whole. */
function extractInvalidField(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return "extract";
  const checks = {
    register: isSentence, file: isSentence, reduced_sha256: (v) => typeof v === "string" && HEX64.test(v),
    original_sha256: (v) => typeof v === "string" && HEX64.test(v), original_covers: isSentence, source_date: isDate,
    imported_at: isDate, src_row: (v) => Number.isSafeInteger(v) && v >= 1,
    kept_columns: (v) => isNames(v) && v.length > 0, roles: (v) => isNames(v) && v.length === x.kept_columns.length,
    dropped_columns: isNames, header: (v) => isNames(v) && v.length === x.kept_columns.length,
    row: (v) => isCells(v) && v.length === x.kept_columns.length,
  };
  for (const k of Object.keys(checks)) if (!checks[k](x[k])) return `extract_${k}`;
  if (x.use_limit !== undefined && x.use_limit !== null) {
    const u = x.use_limit;
    if (!u || typeof u !== "object" || Array.isArray(u)) return "extract_use_limit_key";
    for (const k of USE_LIMIT_KEYS) if (!isSentence(u[k])) return `extract_use_limit_${k}`;
  }
  return null;
}
/* An extract as its flat fields; null when there is none to write (absent, or not an object). */
const extractFieldsOf = (x) => {
  try {
    if (!x || typeof x !== "object" || Array.isArray(x)) return null;
    const out = Object.fromEntries(EXTRACT_KEYS.map((k) => [`extract_${k}`, k === "label_key" ? EXTRACT_LABEL_KEY : x[k] ?? null]));
    const u = x.use_limit;
    return u && typeof u === "object" && !Array.isArray(u)
      ? { ...out, ...Object.fromEntries(USE_LIMIT_KEYS.map((k) => [`extract_use_limit_${k}`, u[k] ?? null])) } : out;
  } catch {
    return null;
  }
};
/* A row's extract read back: every key, each null when not stated; `use_limit` `{key, citation, text_key}` when any of
   R39's fields is stated, else null. */
function extractRead(r) {
  const out = Object.fromEntries(EXTRACT_KEYS.map((k) => [k, unexact(r[`extract_${k}`])]));
  const limited = MATERIAL_EXTRACT_USE_LIMIT_FIELDS.some((f) => Object.hasOwn(r, f));
  return { ...out, use_limit: limited ? Object.fromEntries(USE_LIMIT_KEYS.map((k) => [k, unexact(r[`extract_use_limit_${k}`])])) : null };
}

/** R38, R39: the `materials:` row for a cited register row, from `{ref, origin?, rests_under, title?, register, file,
 *  reduced_sha256, original_sha256, original_covers, source_date, imported_at, src_row, kept_columns, roles,
 *  dropped_columns, header, row, use_limit?: {key, citation, text_key}}`. Answers `{ok: true, row}`, the row
 *  `materialsLines` writes (`kind` `document`, `sha` the reduced segment's, `text_sha` the extract text's, `archived_copy`
 *  null, `included` false whatever is handed, `extract` with `label_key` `register.extract`), or `{ok: false, code:
 *  "EXTRACT_INVALID", field}` naming the first field that is absent or malformed (`ref` too). Pure; never throws. */
export function registerExtractRow(args) {
  try {
    const a = args && typeof args === "object" && !Array.isArray(args) ? args : {};
    if (!isSentence(a.ref)) return { ok: false, code: EXTRACT_INVALID, field: "ref" };
    const bad = extractInvalidField(a);
    if (bad) return { ok: false, code: EXTRACT_INVALID, field: bad };
    const extract = { ...Object.fromEntries(EXTRACT_KEYS.filter((k) => k !== "label_key").map((k) => [k, a[k]])),
                      label_key: EXTRACT_LABEL_KEY,
                      ...(a.use_limit ? { use_limit: Object.fromEntries(USE_LIMIT_KEYS.map((k) => [k, a.use_limit[k]])) } : {}) };
    return { ok: true, row: { ref: a.ref, kind: "document", sha: a.reduced_sha256, text_sha: sha256Of(extractTextOf(a.header, a.row)),
      origin: a.origin ?? null, archived_copy: null, included: false, rests_under: oneOf(a.rests_under, MATERIAL_RESTS_UNDER),
      ...(a.title !== undefined ? { title: a.title } : {}), extract } };
  } catch {
    return { ok: false, code: EXTRACT_INVALID, field: "extract" };
  }
}

/* ===== R16 — ANOTHER GROUP'S WORK THE CASE RESTS ON (DEC-96 item 4; N522) ===== */

/** R16: the fields of an `accepted_work:` row and of an `accepted_work_flags:` row, in the order they are written. */
export const ACCEPTED_WORK_FIELDS = Object.freeze(["member", "leg_of", "ref", "group", "case", "edition", "finding",
  "manifest_sha", "pair", "result", "gaps", "accepted_by", "accepted_at", "reason"]);
export const ACCEPTED_WORK_FLAG_FIELDS = Object.freeze(["ref", "edition", "flag", "issue", "flagged_at", "words",
  "acknowledged_by", "acknowledged_at"]);
/** R16: the axes a row's `pair` states, in order (`strength`'s three), and the states an axis is in. */
export const PAIR_AXES = Object.freeze(["capture", "connection", "testimony"]);
const AXIS_STATES = ["graded", "unrated", "undetermined"];
const GRADES = ["A", "B", "C", "D"];

/* THE PAIR ON ONE LINE. A row is flat (K549), so the pair is written as the grammar's inline list of `axis:value`, each
   value a grade letter or the axis's state (`unrated`, `undetermined`): `[capture:B, connection:C, testimony:unrated]`.
   An axis handed as a letter, a state word or `{state, grade}` is written so; anything else is `undetermined`, never a
   guess. */
const axisWord = (a) => {
  const grade = typeof a === "string" ? a : a && typeof a === "object" ? a.grade : null;
  const state = a && typeof a === "object" ? a.state : typeof a === "string" && !GRADES.includes(a) ? a : null;
  if (GRADES.includes(grade) && (state == null || state === "graded")) return grade;
  return state === "unrated" ? "unrated" : "undetermined";
};
/** R16: a pair as its row writes it. */
export function pairLine(pair) {
  const p = pair && typeof pair === "object" ? pair : {};
  return `[${PAIR_AXES.filter((x) => x !== "testimony" || x in p).map((x) => `${x}:${axisWord(p[x])}`).join(", ")}]`;
}
/** R16: a row's `pair` read back, `{capture: {state, grade}, connection: {state, grade}, testimony?}`; null when it
 *  is not the inline list R16 writes. */
export function pairOf(value) {
  if (!Array.isArray(value)) return null;
  const out = {};
  for (const item of value) {
    const m = /^([a-z]+):([A-Za-z]+)$/.exec(String(item ?? ""));
    if (!m || !PAIR_AXES.includes(m[1]) || m[1] in out) return null;
    out[m[1]] = GRADES.includes(m[2]) ? { state: "graded", grade: m[2] }
      : AXIS_STATES.includes(m[2]) && m[2] !== "graded" ? { state: m[2], grade: null } : null;
    if (!out[m[1]]) return null;
  }
  return "capture" in out && "connection" in out ? out : null;
}
/* `gaps` is the member's words on one line: a list handed is joined with "; ", in its order. */
const gapsLine = (g) => (Array.isArray(g) ? g.filter((x) => x != null && String(x).trim()).map(String).join("; ")
  : g == null ? null : String(g));

/** R16: the `accepted_work:` and `accepted_work_flags:` blocks' lines, from `{rows: [{member, leg_of, ref, group,
 *  case, edition, finding, manifest_sha, pair, result, gaps, accepted_by, accepted_at, reason}], flags: [{ref, edition,
 *  flag, issue, flagged_at, words, acknowledged_by, acknowledged_at}]}`. No line at all when both are empty: neither
 *  block is required when no chain reaches another group's finding, so such a document's bytes are what they were. */
export function acceptedWorkBlockLines(given) {
  const { rows = [], flags = [] } = given && typeof given === "object" ? given : {};
  const r = objects(rows);
  const f = objects(flags);
  if (!r.length && !f.length) return [];
  const out = rowsBlock("accepted_work", r.map((x) => ({ ...x, gaps: gapsLine(x.gaps), pair: pairLine(x.pair) })),
                        ACCEPTED_WORK_FIELDS, ["pair"]);
  return [...out, ...rowsBlock("accepted_work_flags", f, ACCEPTED_WORK_FLAG_FIELDS)];
}

/** R16: both blocks read back, `{rows: [...], flags: [...]}`, in the document's order, each row's `pair` as `pairOf`
 *  reads it and `edition` a count (null when it is not one). A document without them (any format) answers empty
 *  lists. Pure; never throws. */
export function acceptedWorkOf(fm) {
  try {
    const d = frontOf(fm);
    if (!d) return { rows: [], flags: [] };
    return {
      rows: objects(d.accepted_work).map((r) => ({ ...read(r, ACCEPTED_WORK_FIELDS), edition: count(r.edition),
                                                   pair: pairOf(r.pair) })),
      flags: objects(d.accepted_work_flags).map((r) => ({ ...read(r, ACCEPTED_WORK_FLAG_FIELDS), edition: count(r.edition) })),
    };
  } catch {
    return { rows: [], flags: [] };
  }
}
