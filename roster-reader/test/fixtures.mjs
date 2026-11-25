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

const load = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
export const ROSTER_DOCS = load("roster-documents.json");
export const FW20 = load("fw20-staff-directory.json");
export const FW18 = load("fw18-doctypes.json");

const fact = (profile, re, flags, extra) => ({ pattern: flags ? { re, flags } : { re }, basis: "TEST", profile, ...(extra || {}) });

const F = (re, flags, extra) => fact("first-proposed", re, flags, extra);
export const FIRST = Object.freeze({ vocabulary: {
  roster_words: [F("\\brosters?\\b", "i", { kind: "roster" }),
                 F("\\borgani[sz]ational\\s+chart\\b|\\borg\\.?\\s+chart\\b", "i", { kind: "chart" })],
  staff_titles: [F("(?:(?:Assistant|Deputy|Executive|Acting)\\s+)?(?:City Administrator|City Attorney|City Clerk(?: Staff)?|Director|Manager|Chief|Co-Chair|Vice Chair|Chair|Supervisor(?: I{1,3})?|Coordinator|Analyst(?: I{1,3})?|Inspector|Engineer|Custodian|Leader|Officer|Parliamentarian(?:\\(s\\))?|Accountant(?: I{1,3})?|Intern)")],
  roster_headers: [F("^(?:Full\\s+)?Name$", "i", { role: "name" }), F("^(?:Job\\s+)?Title$|^Position$", "i", { role: "title" }),
                   F("^(?:Department|Division|Organi[sz]ation)$", "i", { role: "unit" }), F("^Start(?:\\s+Date)?$", "i", { role: "start" }),
                   F("^End(?:\\s+Date)?$", "i", { role: "end" }), F("^As\\s+of$", "i", { role: "as_of" }),
                   F("^Employee\\s+(?:ID|No\\.?|Number)$", "i", { role: "employee_id" }),
                   F("^(?:Phone|E-?mail|Address|Home\\s+Address)$", "i", { role: "contact" })],
} });

const H = (re, flags, extra) => fact("harbor-test", re, flags, extra);
export const HARBOR = Object.freeze({ vocabulary: {
  roster_words: [H("\\bregister of officers\\b", "i", { kind: "roster" }), H("\\btable of organisation\\b", "i", { kind: "chart" })],
  staff_titles: [H("Harbourmaster|Selectperson|Warden|Clerk of Works")],
  roster_headers: [H("^Officer$", "i", { role: "name" }), H("^Rank$", "i", { role: "title" }), H("^Payroll No\\.?$", "i", { role: "employee_id" }),
                   H("^Telephone$", "i", { role: "contact" })],
} });

export const EMPTY = Object.freeze({ vocabulary: {} });

/** A reader's context for one captured document: its I2 text flattened as docprofile's `readText` does,
 *  with the locator built from its own segment map. */
export function ctxOf(doc, view) {
  const f = flattenText(doc.text);
  return { text: f.text, view, locate: makeLocator(f.segments) };
}

/** Every document the suite reads, by a prefixed key: `r:` this module's, `d:` fw20's, `s:` fw18's. */
export function allDocs() {
  const out = {};
  for (const [k, v] of Object.entries(ROSTER_DOCS.documents)) out[`r:${k}`] = v;
  for (const [k, v] of Object.entries(FW20.documents)) out[`d:${k}`] = v;
  for (const [k, v] of Object.entries(FW18.documents)) out[`s:${k}`] = v;
  return out;
}

/** Deep-freeze, so a test can show a function writes nothing into what it was given. */
export function freeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freeze(v); }
  return o;
}
