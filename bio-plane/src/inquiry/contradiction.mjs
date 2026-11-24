/* inquiry — the contradiction inquiry (requirements: `build/requirements/inquiry.md`, R46, R47; N345). The frozen
 * vocabularies a resolution is written in, the lines a resolution is written as, and the grammar's arm that judges a
 * document carrying a contradiction link, a resolution or an `explores` block. `contradiction`, `affordances` and `queue`
 * read the vocabularies from here: these are the one list of each. Pure; nothing here throws.
 *
 * THE BYTES AND THE LOGICAL SHAPE. The restricted frontmatter grammar holds no map inside a map, so a resolution's
 * `qualifiers: {a?, b?}` is written as two keys of the `resolution` block, `qualifier_a` and `qualifier_b`, and read back
 * as `qualifiers`. `resolutionLines` is the only writer of that form and `readResolution` its only reader; a `qualifiers`
 * key in the bytes is a field the grammar cannot hold and is refused as incomplete, naming it (J1). */

import { INQUIRY_CONTRADICTION_CHECKS as ROWS } from "./checks.mjs";
import { fmSafe } from "./text.mjs";
import { localize } from "../setup-words/index.mjs";

const freeze = (a) => Object.freeze([...a]);

/** R46: DEC-77's clarifier choices, the respects in which two sides of a contradiction may differ. */
export const CONTRADICTION_COORDINATES = freeze(["time_or_occasion", "scope", "meaning", "observer_or_method", "subject"]);
/** R46: DEC-84 item 3's named differences between two projects' conclusions. */
export const PLURALITY_DIFFERENCES = freeze(["scope", "time_or_occasion", "standard", "evidence_set", "weighing"]);
/** R46: what a `dissolved` resolution may name, the union of both lists, plus `precision` and `opinion`. */
export const DISSOLVED_BY = freeze([...new Set([...CONTRADICTION_COORDINATES, ...PLURALITY_DIFFERENCES, "precision", "opinion"])]);
/** R46: the canons by which a conflict of norms is reconciled, or said not to be. */
export const NORM_CANONS = freeze(["higher_over_lower", "later_over_earlier", "specific_over_general", "harmonization", "unreconciled"]);

const FAMILY = Object.freeze({
  dissolved: "DISSOLVED",
  misquote: "CORRECTED", transcription_or_reading_error: "CORRECTED", superseded_version: "CORRECTED", corrected: "CORRECTED",
  double_speak_or_reversal: "GENUINE", obligation_against_act: "GENUINE", conflict_of_norms: "GENUINE", irreconcilable: "GENUINE",
});
/** R46: every kind a contradiction can be resolved as, in the order the requirement lists them. */
export const RESOLUTION_KINDS = freeze(Object.keys(FAMILY));

/** R46: a kind's family (`DISSOLVED`, `CORRECTED` or `GENUINE`), null for anything that is not a kind. */
export function resolutionFamily(kind) {
  return typeof kind === "string" && Object.prototype.hasOwnProperty.call(FAMILY, kind) ? FAMILY[kind] : null;
}

/** R47: a candidate's id, `contradiction` R15's (a SHA-256, lowercase hex). */
export const CANDIDATE_RE = /^[0-9a-f]{64}$/;
/** R47: a qualifier's bound, and an explored hypothesis's. */
export const QUALIFIER_MAX = 200;
export const HYPOTHESIS_MAX = 500;

const RESOLUTION_FIELDS = ["kind", "coordinates", "qualifier_a", "qualifier_b", "wrong_side", "reason", "canon"];
const EXPLORES_FIELDS = ["coordinate", "canon", "hypothesis"];
const isMap = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const present = (v) => v !== undefined && v !== null;
const blank = (v) => !present(v) || (typeof v === "string" && v.trim() === "");
const text = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);

/** R46: the frontmatter lines of a resolution, in one fixed order (`kind`, `coordinates`, `qualifier_a`, `qualifier_b`,
 *  `wrong_side`, `reason`, `canon`), every value frontmatter-safe (quotes and backslashes to apostrophes, line breaks
 *  folded, trimmed; `basis-versions` R5's normalising, idempotent), a blank field left out. `resolution` is the logical
 *  shape, `{kind, coordinates?, qualifiers?: {a?, b?}, wrong_side?, reason?, canon?}`. Anything that is not an object
 *  answers no lines. Never throws. */
export function resolutionLines(resolution) {
  try {
    if (!isMap(resolution)) return [];
    const q = (v) => `"${fmSafe(v)}"`;
    const out = ["resolution:"];
    const scalar = (key, v) => { const s = text(v); if (s !== null && fmSafe(s) !== "") out.push(`  ${key}: ${q(s)}`); };
    scalar("kind", resolution.kind);
    if (Array.isArray(resolution.coordinates)) {
      /* a list item cannot carry the inline list's own punctuation: folded to spaces, then made safe */
      const items = resolution.coordinates.map((c) => fmSafe(String(text(c) ?? "").replace(/[,[\]]/g, " ")).replace(/\s+/g, " "))
        .filter((c) => c !== "");
      if (items.length) out.push(`  coordinates: [${items.join(", ")}]`);
    }
    const qual = isMap(resolution.qualifiers) ? resolution.qualifiers : {};
    scalar("qualifier_a", qual.a);
    scalar("qualifier_b", qual.b);
    scalar("wrong_side", resolution.wrong_side);
    scalar("reason", resolution.reason);
    scalar("canon", resolution.canon);
    return out.length > 1 ? out : [];
  } catch { return []; }
}

/** The logical resolution a document's `resolution` block holds: `qualifier_a`/`qualifier_b` read as `qualifiers`, a
 *  field the bytes do not carry left out. Null when the block is not a map. */
export function readResolution(block) {
  if (!isMap(block)) return null;
  const out = {};
  if (present(block.kind)) out.kind = block.kind;
  if (present(block.coordinates)) out.coordinates = block.coordinates;
  const a = block.qualifier_a, b = block.qualifier_b;
  if (present(a) || present(b)) out.qualifiers = { ...(present(a) ? { a } : {}), ...(present(b) ? { b } : {}) };
  for (const k of ["wrong_side", "reason", "canon"]) if (present(block[k])) out[k] = block[k];
  return out;
}

/** The candidate a document's link names, when the link is well-formed; else null. */
export function candidateOf(fm) {
  const c = fm && fm.contradiction;
  if (!isMap(c) || Object.keys(c).some((k) => k !== "candidate")) return null;
  return typeof c.candidate === "string" && CANDIDATE_RE.test(c.candidate) ? c.candidate : null;
}

/** The logical `explores` block, when well-formed (exactly one of its three fields, valid); else null. */
export function exploresOf(fm) {
  const e = fm && fm.explores;
  if (!isMap(e)) return null;
  const keys = Object.keys(e);
  if (keys.length !== 1 || !EXPLORES_FIELDS.includes(keys[0])) return null;
  const [k] = keys, v = e[k];
  if (k === "coordinate") return DISSOLVED_BY.includes(v) ? { coordinate: v } : null;
  if (k === "canon") return NORM_CANONS.includes(v) ? { canon: v } : null;
  const h = text(v);
  return h !== null && h.trim() !== "" && h.length <= HYPOTHESIS_MAX ? { hypothesis: h } : null;
}

/** R47 (C-2.11–C-2.16): the contradiction arm over one inquiry document's frontmatter. Answers the findings, each
 *  `{check, code, detail, translation, field?}` with the row's check and translation; empty when the document carries
 *  none of the three blocks or carries them well. Never throws. */
export function contradictionFindings(fm) {
  const out = [];
  const find = (code, detail, field) => {
    const row = ROWS[code];
    out.push({ check: row.check, code, detail, translation: row.translation, ...(field ? { field } : {}) });
  };
  try {
    if (!isMap(fm)) return out;
    /* DEC-49 REGION is-contradiction-link */
    const linked = present(fm.contradiction);
    const candidate = candidateOf(fm);
    if (linked && !candidate)
      find("CONTRADICTION_LINK_MALFORMED",
        "`contradiction` is `{candidate}` and nothing else, the candidate's id 64 lowercase hex characters; this link is "
        + "not one, so this document is not a contradiction inquiry.");
    /* END DEC-49 REGION is-contradiction-link */
    /* DEC-49 REGION is-resolution-placed */
    if (present(fm.resolution) && !candidate)
      find("RESOLUTION_WITHOUT_CONTRADICTION",
        "`resolution` is carried only by a contradiction inquiry (one whose `contradiction` names its candidate), and "
        + "this document is not one.");
    /* END DEC-49 REGION is-resolution-placed */
    /* A resolution is read only while the document is concluded, and kept, never read, at any other state, so that
       reopening needs no edit (R1). */
    if (candidate && fm.current_state === "concluded") {
      const block = fm.resolution;
      /* DEC-49 REGION is-resolution-present */
      const kind = isMap(block) ? block.kind : undefined;
      if (!present(block) || (typeof block === "string" && block.trim() === "") || (isMap(block) && blank(kind)))
        find("RESOLUTION_MISSING",
          "this contradiction inquiry is concluded and its `resolution` names no kind: a contradiction is concluded by "
          + "saying what the conflict turned out to be.", "kind");
      /* END DEC-49 REGION is-resolution-present */
      else {
        /* DEC-49 REGION is-resolution-kind */
        const family = isMap(block) ? resolutionFamily(kind) : null;
        if (isMap(block) && !family)
          find("RESOLUTION_KIND_UNKNOWN", `'${fmSafe(text(kind) ?? typeof kind)}' is not a resolution kind; the kinds `
            + `are ${RESOLUTION_KINDS.join(", ")}.`, "kind");
        /* END DEC-49 REGION is-resolution-kind */
        /* DEC-49 REGION is-resolution-complete */
        const incomplete = (field, detail) => find("RESOLUTION_INCOMPLETE", detail, field);
        /* A resolution written as a single value gives none of the fields its kind needs, and is not in that form. */
        if (!isMap(block))
          incomplete("resolution", localize("inquiry.contradiction.resolution_is_a_block_of", "`resolution` is a block of fields (`kind` and what that kind needs), not a single value."));
        else {
          for (const k of Object.keys(block))
            if (!RESOLUTION_FIELDS.includes(k))
              incomplete(k, k === "qualifiers"
                ? localize("inquiry.contradiction.qualifiers_is_written_as_qualifier", "`qualifiers` is written as `qualifier_a` and `qualifier_b` inside `resolution` (the frontmatter grammar holds no map inside a map); write it through the resolution's own lines.")
                : localize("inquiry.contradiction.k_is_not_a_field", "`{k}` is not a field of a resolution; its fields are {RESOLUTION_FIELDS}.", { k: String(k), RESOLUTION_FIELDS: String(RESOLUTION_FIELDS.join(", ")) }));
          const coords = block.coordinates;
          const coordsOk = Array.isArray(coords) && coords.length > 0 && coords.every((c) => DISSOLVED_BY.includes(c))
            && new Set(coords).size === coords.length;
          if (kind === "dissolved" && !present(coords))
            incomplete("coordinates", "a `dissolved` resolution names the respects in which the sides differ: one or more "
              + `distinct \`coordinates\` from ${DISSOLVED_BY.join(", ")}.`);
          else if (present(coords) && !coordsOk)
            incomplete("coordinates", "`coordinates` is a list of one or more distinct respects from "
              + `${DISSOLVED_BY.join(", ")}.`);
          const side = block.wrong_side;
          if (family === "CORRECTED" && !present(side))
            incomplete("wrong_side", localize("inquiry.contradiction.a_corrected_resolution_names_the", "a corrected resolution names the side that is wrong: `wrong_side` is `a` or `b`."));
          else if (present(side) && side !== "a" && side !== "b")
            incomplete("wrong_side", "`wrong_side` is `a` or `b`.");
          const reason = block.reason;
          if (family === "CORRECTED" && blank(reason))
            incomplete("reason", localize("inquiry.contradiction.a_corrected_resolution_says_why", "a corrected resolution says why that side is wrong: a non-empty `reason`."));
          else if (present(reason) && (text(reason) === null || text(reason).trim() === ""))
            incomplete("reason", localize("inquiry.contradiction.reason_is_a_non_empty", "`reason` is a non-empty statement."));
          const canon = block.canon;
          if (kind === "conflict_of_norms" && !present(canon))
            incomplete("canon", `a conflict of norms names the canon that reconciles them, or says none does: \`canon\` from `
              + `${NORM_CANONS.join(", ")}.`);
          else if (present(canon) && !NORM_CANONS.includes(canon))
            incomplete("canon", localize("inquiry.contradiction.canon_is_one_of_norm", "`canon` is one of {NORM_CANONS}.", { NORM_CANONS: String(NORM_CANONS.join(", ")) }));
          for (const [key, name] of [["qualifier_a", "a"], ["qualifier_b", "b"]]) {
            const v = block[key];
            if (!present(v)) continue;
            const s = text(v);
            if (s === null || s.length > QUALIFIER_MAX)
              incomplete(`qualifiers.${name}`, localize("inquiry.contradiction.a_qualifier_on_side_name", "a qualifier on side {name} is a statement of at most {QUALIFIER_MAX} characters.", { name: String(name), QUALIFIER_MAX: String(QUALIFIER_MAX) }));
          }
        }
        /* END DEC-49 REGION is-resolution-complete */
      }
    }
    /* DEC-49 REGION is-explores-shape */
    if (present(fm.explores) && !exploresOf(fm))
      find("EXPLORES_MALFORMED", "`explores` names exactly one of `coordinate` (from "
        + `${DISSOLVED_BY.join(", ")}), \`canon\` (from ${NORM_CANONS.join(", ")}) or \`hypothesis\` (non-empty, at `
        + `most ${HYPOTHESIS_MAX} characters), and nothing else.`);
    /* END DEC-49 REGION is-explores-shape */
  } catch (e) {
    /* DEC-49 REGION is-contradiction-arm-judged — C-2.18 (N369): an arm that stopped with an error refuses the document
       rather than passing it, under its own row: the error is in the check and says nothing yet about the link. */
    out.push({ check: ROWS.CONTRADICTION_ARM_FAILED.check, code: "CONTRADICTION_ARM_FAILED",
               detail: localize("inquiry.contradiction.the_contradiction_arm_stopped_with", "the contradiction arm stopped with an error before it could judge this document's link, resolution and explores: {fmSafe}", { fmSafe: String(fmSafe(e && e.message)) }),
               translation: ROWS.CONTRADICTION_ARM_FAILED.translation });
    /* END DEC-49 REGION is-contradiction-arm-judged */
  }
  return out;
}
