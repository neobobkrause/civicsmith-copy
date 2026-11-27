/* The 50 captured policies (fixtures/policies.json) and the member's answers (fixtures/policies-answers.json), which
 * R35's tests read under the held first profile (jurisdictions R67, R69; K1933). `MEASURED_VIEW` is the series and
 * labels as first measured on these 50 documents, before that profile held them (the job record's first measurement,
 * K1924): kept as that record, read by no test. */
import fs from "node:fs";
/** @import { HeaderFields } from "../policy-header.mjs" */
/** @import { PolicyHeaderField } from "../../jurisdictions/index.mjs" */
/** @import { Section } from "../sections.mjs" */

/**
 * One page of a captured policy's reading: its number and its text.
 * @typedef {Object} CapturedPage
 * @property {number} page
 * @property {string} text
 */
/**
 * A captured policy (`capture-policies.mjs`): where it came from, when, its sha256 and length as served, how it was read
 * (the tier and why), and the reading a type is given (I2's `{document, pages}`).
 * @typedef {Object} CapturedPolicy
 * @property {string} id
 * @property {string} family
 * @property {string} name
 * @property {string} source
 * @property {string} fetched
 * @property {number} status
 * @property {string | null} revision
 * @property {string} sha256
 * @property {number} bytes
 * @property {number} pages
 * @property {number} tier
 * @property {string | null} tier_why
 * @property {{ document: string, pages: CapturedPage[] }} text
 */
/**
 * A fixture of captured policies (`policies.json`, `policies-fresh.json`).
 * @typedef {Object} PolicyCaptures
 * @property {string} note
 * @property {CapturedPolicy[]} documents
 */
/**
 * A member's reading of one policy's header: each field the member reads (by its name, a header field), as printed (a
 * date field as its calendar date where the member reads one; `type` as the series' key).
 * @typedef {{ [field: string]: string }} PolicyAnswer
 */
/** The member's header readings, by the policy's id. @typedef {{ [id: string]: PolicyAnswer }} PolicyAnswers */
/**
 * A member's reading of one top-level section: its number, and its heading's opening where the member's text shows it.
 * @typedef {Object} SectionAnswer
 * @property {string} number
 * @property {string} heading
 */
/** The member's section readings, by the policy's id. @typedef {{ [id: string]: SectionAnswer[] }} SectionAnswers */
/**
 * The member's answers to the 50 (`policies-answers.json`): the header readings and the section readings.
 * @typedef {Object} PolicyAnswersFile
 * @property {string} note
 * @property {PolicyAnswers} answers
 * @property {SectionAnswers} sections
 * @property {string} sections_note
 */
/**
 * The member's answers to the fresh 24 (`policies-fresh-answers.json`).
 * @typedef {Object} FreshAnswersFile
 * @property {string} note
 * @property {PolicyAnswers} answers
 */
/** The series labels the held profile prints, by the series' key (`policy-series.json`). @typedef {{ ai: string }} SeriesLabels */
/**
 * A pattern as a profile writes it: its source, and its flags where it has any.
 * @typedef {{ re: string } | { re: string, flags: string }} MeasuredPattern
 */
/**
 * A policy series as first measured (`standard_sources`' entries with `series`).
 * @typedef {Object} MeasuredSource
 * @property {string} source
 * @property {string} kind
 * @property {string} issuer
 * @property {string} level
 * @property {string} key
 * @property {{ key: string, label: string }} series
 * @property {MeasuredPattern} cite
 * @property {string} basis
 */
/**
 * A header label as first measured (`vocabulary.policy_headers`' entries).
 * @typedef {Object} MeasuredLabel
 * @property {PolicyHeaderField} field
 * @property {MeasuredPattern} pattern
 * @property {string} basis
 */
/**
 * The series and labels as first measured on the 50 (`MEASURED_VIEW`).
 * @typedef {Object} MeasuredView
 * @property {MeasuredSource[]} standard_sources
 * @property {{ policy_headers: MeasuredLabel[] }} vocabulary
 */
/**
 * One field scored: whether the reader read it as the member does, the member's reading (null where the member reads
 * none), and the reader's (null where it read none).
 * @typedef {Object} FieldScore
 * @property {boolean} ok
 * @property {string | null} want
 * @property {string | null} got
 */
/**
 * A header scored against the member's reading: wholly right or not, and each field's score, by field.
 * @typedef {Object} HeaderScore
 * @property {boolean} ok
 * @property {{ [field: string]: FieldScore }} fields
 */
/**
 * A reading's top-level sections scored against the member's: right or not, and the numbers each reads, joined.
 * @typedef {Object} SectionsScore
 * @property {boolean} ok
 * @property {string} want
 * @property {string} got
 */

/** The 50 captured policies, as `capture-policies.mjs` wrote them (this module's own fixture). */
export const POLICIES = /** @type {PolicyCaptures} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/policies.json", import.meta.url), "utf8")));
/** The member's answers to the 50 (this module's own fixture). */
const ANSWERS_FILE = /** @type {PolicyAnswersFile} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/policies-answers.json", import.meta.url), "utf8")));
/** @type {PolicyAnswers} */
export const ANSWERS = ANSWERS_FILE.answers;
/* R35's out-of-sample set (T36-4): 24 more policies of the same issuers and series, none among the 50, captured by
   `capture-policies.mjs` as the 50 were, and the member's answers, written before the reader was run on them. */
export const FRESH = /** @type {PolicyCaptures} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/policies-fresh.json", import.meta.url), "utf8")));
/** @type {PolicyAnswers} */
export const FRESH_ANSWERS = /** @type {FreshAnswersFile} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/policies-fresh-answers.json", import.meta.url), "utf8"))).answers;
/* The series labels the held profile prints, kept as fixture data beside the captures (the words check reads no fixture). */
const SERIES = /** @type {SeriesLabels} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/policy-series.json", import.meta.url), "utf8")));

/** @param {string} re @param {string} [flags] @returns {MeasuredPattern} */
const p = (re, flags) => (flags ? { re, flags } : { re });
/** @param {PolicyHeaderField} field @param {string} re @param {string} [flags] @returns {MeasuredLabel} */
const label = (field, re, flags) => ({ field, pattern: p(re, flags), basis: "MEASURED: doctypes R35, the 50 captured policies, 2026-10-07" });

/** @type {MeasuredView} */
export const MEASURED_VIEW = {
  standard_sources: [
    { source: "Oakland Administrative Instructions", kind: "policy", issuer: "City Administrator", level: "city", key: "oakland",
      series: { key: "ai", label: SERIES.ai },
      cite: p("(?:Administrative\\s+Instruction|A\\.?I\\.?)\\s+(?:No\\.?\\s*)?(?<number>\\d{1,4})", "i"), basis: "MEASURED" },
    { source: "OPD Departmental General Orders", kind: "policy", issuer: "Chief of Police", level: "city", key: "opd",
      series: { key: "dgo", label: "Departmental General Order" },
      cite: p("(?:Departmental\\s+General\\s+Order|DGO)\\s+(?<number>[A-Z]-\\d{1,2}(?:\\.\\d{1,2})?)", "i"), basis: "MEASURED" },
    { source: "OPD Special Orders", kind: "policy", issuer: "Chief of Police", level: "city", key: "opd",
      series: { key: "so", label: "Special Order" },
      cite: p("(?:Special\\s+Order|SO)\\s+(?:No\\.?\\s*)?(?<number>\\d{4})", "i"), basis: "MEASURED" },
  ],
  vocabulary: {
    policy_headers: [
      label("number", "NUMBER"),
      label("title", "SUBJECT(?:/AGENCY)?"), label("title", "Index as"),
      label("effective", "EFFECTIVE DATE"), label("effective", "Effective Date"), label("effective", "EFFECTIVE"),
      label("effective", "DATE"), label("effective", "Rev\\."), label("effective", "New Order"),
      label("supersedes", "SUPERSEDES?"),
      label("reference", "REFERENCE"), label("reference", "Ref"),
      label("coordinator", "Evaluation Coordinator"), label("coordinator", "Coordinator"),
      label("review_due", "Evaluation Due Date"), label("review_due", "Evaluation Date"),
      label("revision_cycle", "Automatic Revision Cycle"),
    ],
  },
};

/** A field's text as compared with a member's: case, white space and a trailing colon do not count. */
/** @param {string | null | undefined} a @param {string | null | undefined} b @returns {boolean} */
export const same = (a, b) => String(a || "").toLowerCase().replace(/\s+/g, "").replace(/[:.]+$/, "")
  === String(b || "").toLowerCase().replace(/\s+/g, "").replace(/[:.]+$/, "");

/** The header fields, as the member's answers name them. @type {ReadonlyArray<PolicyHeaderField>} */
const FIELDS = ["type", "number", "title", "effective", "supersedes", "reference", "coordinator", "review_due", "revision_cycle"];

/** The header's series, where its type was read. @param {HeaderFields} h @returns {string | undefined} */
const seriesOf = (h) => { const t = h.type; return t ? t.series : undefined; };
/** A field as read: a date field's date, or its text where it has none; any other field's text; undefined where the
 *  field was not read.
 *  @param {HeaderFields} h @param {PolicyHeaderField} f @returns {string | undefined} */
const shownOf = (h, f) => {
  const d = f === "effective" ? h.effective : f === "review_due" ? h.review_due : undefined;
  const v = h[f];
  return d ? d.date || d.text : v ? v.text : undefined;
};

/** One header reading against the member's: each field the member reads, right or wrong, and each the reader
 *  read that the member does not.
 *  @param {HeaderFields | null | undefined} header
 *  @param {PolicyAnswer} answer
 *  @returns {HeaderScore} */
export function score(header, answer) {
  /** @type {{ [field: string]: FieldScore }} */
  const fields = {};
  /** @type {HeaderFields} */
  const h = header || {};
  for (const [f, want] of Object.entries(answer)) {
    /* every name the answers fixture holds is a header field */
    const field = FIELDS.find((x) => x === f);
    const got = field === undefined ? undefined : h[field];
    /* as read: `type`'s series; a date field's date, or its text where it has none; any other field's text */
    const series = field === "type" ? seriesOf(h) : undefined;
    const shown = field === undefined ? undefined : shownOf(h, field);
    const ok = !got ? false
      : f === "type" ? series === want
      : f === "effective" || f === "review_due" ? shown === want
      : same(got.text, want);
    fields[f] = { ok, want, got: got ? (f === "type" ? series ?? null : shown ?? null) : null };
  }
  /** @type {ReadonlyArray<PolicyHeaderField>} */
  const read = ["number", "title", "effective", "supersedes", "reference", "coordinator", "review_due", "revision_cycle"];
  for (const f of read) {
    const v = h[f];
    if (v && !(f in answer)) fields[f] = { ok: false, want: null, got: shownOf(h, f) ?? null };
  }
  return { ok: Object.values(fields).every((x) => x.ok), fields };
}

/** @type {SectionAnswers} */
export const SECTION_ANSWERS = /** @type {PolicyAnswersFile} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/policies-answers.json", import.meta.url), "utf8"))).sections;
/** @param {string | null | undefined} s @returns {string} */
const head = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** The section at `i` of `top`, which the caller has bounded inside it; reading past it throws, as reading a member of
 *  the missing section did.
 *  @param {ReadonlyArray<Section>} top @param {number} i @returns {Section} */
const sectionAt = (top, i) => {
  const s = top[i];
  if (s === undefined) throw new TypeError(`no section at ${i}`);
  return s;
};
/** A reading's top-level sections against a member's: the same parts, in the same order, each heading opening as the
 *  member reads it (where the member's text shows the heading).
 *  @param {ReadonlyArray<Section> | null | undefined} sections
 *  @param {ReadonlyArray<SectionAnswer>} answer
 *  @returns {SectionsScore} */
export function scoreSections(sections, answer) {
  const top = (sections || []).filter((s) => s.path.length === 1);
  const ok = top.length === answer.length
    && answer.every((a, i) => sectionAt(top, i).number === a.number && (!a.heading || head(sectionAt(top, i).heading).startsWith(head(a.heading))));
  return { ok, want: answer.map((a) => a.number).join(","), got: top.map((s) => s.number).join(",") };
}
