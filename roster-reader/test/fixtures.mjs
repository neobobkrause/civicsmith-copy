/* Fixtures for roster-reader's requirement-named tests.
 *
 * THE DOCUMENTS are real (R9): `roster-documents.json` (fifteen documents captured for this module; how,
 * in `capture.mjs` and the file's own note), and copies of docprofile's two real corpora,
 * `fw20-staff-directory.json` (the staff directory's four directories and five look-alikes) and
 * `fw18-doctypes.json` (FW-18's minutes, agenda, instrument and staff report), copied whole so this suite
 * does not depend on another module's test tree.
 *
 * THE VIEWS are built in the combined view's shape (`jurisdictions.combine`, its R13: each fact a
 * `{pattern: {re, flags}, basis, profile}` entry), by hand, because the vocabulary keys this module reads
 * (`roster_words`, `roster_headers`, `staff_titles`) enter the held profiles with the jurisdictions job
 * (T33-2) and its validator refuses them until then.
 *   - FIRST: the roster vocabulary proposed for the first profile (QUESTION J2), each entry's basis the
 *     fixture it was measured on. Where the documents come from is provenance, not a place in the product
 *     (layers.md, "No jurisdiction in the product", rule 6).
 *   - HARBOR: a made-up test profile in another vocabulary, so a test can show a reader following the view
 *     it is given and nothing else (R8).
 *   - EMPTY: a view with no vocabulary, which is a view (docprofile's reader view). */
import fs from "node:fs";
import { flattenText, makeLocator } from "../../docprofile/registry.mjs";
/** @import { ReaderView, SuppliedText, DoctypeContext } from "../../docprofile/registry.mjs" */
/** @import { Tagged, VocabularyPattern, RosterWord, RosterHeader, RosterKind, RosterRole, Pattern, BasisTag } from "../../jurisdictions/types.mjs" */

/**
 * One captured document (R9): where it was fetched, its hash, what it is, and its text in interface I2's shape.
 * @typedef {Object} CapturedDoc
 * @property {string} source
 * @property {string} sha256
 * @property {string} what
 * @property {string} [fetched]
 * @property {number} [bytes]
 * @property {number} [tier]
 * @property {number} [pages]
 * @property {number} [chars]
 * @property {number} [whole_pages]
 * @property {number} [whole_chars]
 * @property {number[]} [kept_pages]
 * @property {SuppliedText} text
 */
/**
 * A corpus of captured documents (R9): its own note, and each document by key.
 * @typedef {Object} Corpus
 * @property {string} note
 * @property {Record<string, CapturedDoc>} documents
 */

/** @type {Corpus} the fifteen documents captured for this module */
export const ROSTER_DOCS = /** @type {Corpus} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/roster-documents.json", import.meta.url), "utf8")));
/** @type {Corpus} the staff directory's four directories and five look-alikes */
export const FW20 = /** @type {Corpus} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/fw20-staff-directory.json", import.meta.url), "utf8")));
/** @type {Corpus} FW-18's minutes, agenda, instrument and staff report */
export const FW18 = /** @type {Corpus} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/fw18-doctypes.json", import.meta.url), "utf8")));

/** A profile's pattern, with its flags where it has them.
 *  @param {string} re @param {string} [flags] @returns {Pattern} */
export const pat = (re, flags) => {
  if (flags) return { re, flags };
  return { re };
};
/** @returns {BasisTag[]} */
const noBases = () => {
  /** @type {BasisTag[]} */
  const none = [];
  return none;
};
/** A pattern-alone entry of a profile, tagged as the combined view tags it.
 *  @param {string} profile @param {string} re @param {string} [flags] @returns {Tagged<VocabularyPattern>} */
export const wordFact = (profile, re, flags) => ({ pattern: pat(re, flags), basis: "TEST", profile, bases: noBases() });
/** A self-naming entry (`roster_words`) naming one kind of document.
 *  @param {string} profile @param {string} re @param {string | undefined} flags @param {RosterKind} kind @returns {Tagged<RosterWord>} */
export const rosterWordFact = (profile, re, flags, kind) => ({ pattern: pat(re, flags), basis: "TEST", profile, kind, bases: noBases() });
/** A header entry (`roster_headers`) naming one role.
 *  @param {string} profile @param {string} re @param {string | undefined} flags @param {RosterRole} role @returns {Tagged<RosterHeader>} */
export const headerFact = (profile, re, flags, role) => ({ pattern: pat(re, flags), basis: "TEST", profile, role, bases: noBases() });

const P1 = "first-proposed";
/** @type {ReaderView} the roster vocabulary proposed for the first profile */
export const FIRST = { vocabulary: {
  roster_words: [rosterWordFact(P1, "\\brosters?\\b", "i", "roster"),
                 rosterWordFact(P1, "\\borgani[sz]ational\\s+chart\\b|\\borg\\.?\\s+chart\\b", "i", "chart")],
  staff_titles: [wordFact(P1, "(?:(?:Assistant|Deputy|Executive|Acting)\\s+)?(?:City Administrator|City Attorney|City Clerk(?: Staff)?|Director|Manager|Chief|Co-Chair|Vice Chair|Chair|Supervisor(?: I{1,3})?|Coordinator|Analyst(?: I{1,3})?|Inspector|Engineer|Custodian|Leader|Officer|Parliamentarian(?:\\(s\\))?|Accountant(?: I{1,3})?|Intern)")],
  roster_headers: [headerFact(P1, "^(?:Full\\s+)?Name$", "i", "name"), headerFact(P1, "^(?:Job\\s+)?Title$|^Position$", "i", "title"),
                   headerFact(P1, "^(?:Department|Division|Organi[sz]ation)$", "i", "unit"), headerFact(P1, "^Start(?:\\s+Date)?$", "i", "start"),
                   headerFact(P1, "^End(?:\\s+Date)?$", "i", "end"), headerFact(P1, "^As\\s+of$", "i", "as_of"),
                   headerFact(P1, "^Employee\\s+(?:ID|No\\.?|Number)$", "i", "employee_id"),
                   headerFact(P1, "^(?:Phone|E-?mail|Address|Home\\s+Address)$", "i", "contact")],
} };
Object.freeze(FIRST);

const PH = "harbor-test";
/** @type {ReaderView} a made-up test profile in another vocabulary (R8) */
export const HARBOR = { vocabulary: {
  roster_words: [rosterWordFact(PH, "\\bregister of officers\\b", "i", "roster"), rosterWordFact(PH, "\\btable of organisation\\b", "i", "chart")],
  staff_titles: [wordFact(PH, "Harbourmaster|Selectperson|Warden|Clerk of Works")],
  roster_headers: [headerFact(PH, "^Officer$", "i", "name"), headerFact(PH, "^Rank$", "i", "title"), headerFact(PH, "^Payroll No\\.?$", "i", "employee_id"),
                   headerFact(PH, "^Telephone$", "i", "contact")],
} };
Object.freeze(HARBOR);

/** @type {ReaderView} a view with no vocabulary */
export const EMPTY = { vocabulary: {} };
Object.freeze(EMPTY);

/** A reader's context for one captured document: its I2 text flattened as docprofile's `readText` does,
 *  with the locator built from its own segment map.
 * @param {{ readonly text: SuppliedText | string }} doc
 * @param {ReaderView} [view]
 * @returns {DoctypeContext}
 */
export function ctxOf(doc, view) {
  const f = flattenText(doc.text);
  if (view === undefined) return { text: f.text, locate: makeLocator(f.segments) };
  return { text: f.text, view, locate: makeLocator(f.segments) };
}

/** Every document the suite reads, by a prefixed key: `r:` this module's, `d:` fw20's, `s:` fw18's.
 * @returns {Record<string, CapturedDoc>}
 */
export function allDocs() {
  /** @type {Record<string, CapturedDoc>} builds the documents by prefixed key */
  const out = {};
  for (const [k, v] of Object.entries(ROSTER_DOCS.documents)) out[`r:${k}`] = v;
  for (const [k, v] of Object.entries(FW20.documents)) out[`d:${k}`] = v;
  for (const [k, v] of Object.entries(FW18.documents)) out[`s:${k}`] = v;
  return out;
}

/** Deep-freeze, so a test can show a function writes nothing into what it was given.
 * @template T
 * @param {T} o
 * @returns {T}
 */
export function freeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k in o) if (Object.hasOwn(o, k)) freeze(o[k]); }
  return o;
}
