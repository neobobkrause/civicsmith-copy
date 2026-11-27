/* Test support for court-doctypes: the captured fixtures, and the views the readers are tested under.
 *
 * R15: the tests use the test profile and the first profile, each as `jurisdictions.combine` gives it, on
 * the profiles' own facts: the three publishing systems under this module's keys and the `proceeding`
 * forms (added by JURISDICTIONS, K1514). A view may only have facts REMOVED here, to show what a reader
 * answers without them; nothing is supplied. */
import { readFileSync } from "node:fs";
import { combine } from "../../jurisdictions/index.mjs";
/** @import { View } from "../../jurisdictions/index.mjs" */
/** @import { DoctypeContext } from "../../docprofile/doctypes/index.mjs" */
/** @import { ReadingPosition } from "../../bio-plane/src/textchain.mjs" */

/**
 * Where a capture came from, as a caller hands it in `ctx.origin` (R2).
 * @typedef {string | { readonly kind: string } | null} CaptureOrigin
 */
/**
 * A ctx as docprofile hands a type, with the capture's origin beside it (R2).
 * @typedef {DoctypeContext & { readonly origin?: CaptureOrigin }} CaptureContext
 */
/**
 * What a test knows of a capture: its view, its address, its origin, when it was read, and its locator.
 * @typedef {Object} CaptureFacts
 * @property {View | undefined} [view]
 * @property {string | undefined} [locator]
 * @property {CaptureOrigin | undefined} [origin]
 * @property {string | undefined} [at]
 * @property {((offset: unknown) => ReadingPosition | null) | undefined} [locate]
 */

const DIR = new URL("./fixtures/", import.meta.url);
/**
 * The captured fixtures, by file name.
 * @typedef {"courtlistener-404.html" | "courtlistener-4214664-p2.html" | "courtlistener-4214664-p4.html" | "courtlistener-sign-in.html" | "cpuc-A2106021-card.html" | "cpuc-A2106021-documents-p1.html" | "cpuc-search.html" | "ecourt-login.html" | "ecourt-roa-FICTIONAL.html" | "ecourt-search.html"} FixtureName
 */
/** A captured fixture's text, by its file name.
 *  @param {FixtureName} name
 *  @returns {string} */
export const fixture = (name) => readFileSync(new URL(name, DIR), "utf8");

export const FIRST = "oakland-alameda";
export const TEST = "test-port-ellery";
const KEYS = ["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"];

/** The combined view of one profile; `systems: false` removes its entries under this module's keys,
 *  `forms: false` its proceeding space.
 *  @param {string} id
 *  @param {{ systems?: boolean, forms?: boolean }} [opts]
 *  @returns {View} */
export function viewFor(id, { systems = true, forms = true } = {}) {
  const r = combine([id]);
  if (!r.ok) throw new Error(`combine ${id}: ${JSON.stringify(r.errors)}`);
  const v = structuredClone(r.view);
  if (!systems) {
    const held = v.systems;
    v.systems = (Array.isArray(held) ? held : []).filter((s) => !KEYS.includes(s.origin));
  }
  if (!forms) {
    const spaces = { ...(v.spaces || {}) };
    delete spaces.proceeding;
    v.spaces = spaces;
  }
  return v;
}

/** Where each fixture was captured, and a locator of the test profile's fictional systems for the same page. */
export const LOCATORS = {
  [FIRST]: {
    courtlistener: (/** @type {number} */ p) => `https://www.courtlistener.com/docket/4214664/national-veterans-legal-services-program-v-united-states/?page=${p}`,
    card: "https://apps.cpuc.ca.gov/apex/f?p=401:56:0::NO:RP,57,RIR:P5_PROCEEDING_SELECT:A2106021",
    documents: "https://apps.cpuc.ca.gov/apex/f?p=401:57:0::NO:RP,57,RIR:P5_PROCEEDING_SELECT:A2106021",
    ecourt: "https://eportal.alameda.courts.ca.gov/?q=node/410&case=24CV000123",
  },
  [TEST]: {
    courtlistener: (/** @type {number} */ p) => `https://dockets.registry.example/case/${p}`,
    card: "https://board.marlow-county.example/proceeding/UB-2021-06/card",
    documents: "https://board.marlow-county.example/proceeding/UB-2021-06/documents",
    ecourt: "https://court.marlow-county.example/case/MC-24-0123",
  },
};

/** A ctx as docprofile hands a type: the text, the locator, the view, and what the caller knows.
 *  @param {string} text
 *  @param {CaptureFacts} [facts]
 *  @returns {CaptureContext} */
export function ctxFor(text, { view, locator, origin, at, locate } = {}) {
  return { text, ...(view !== undefined ? { view } : {}), ...(locator !== undefined ? { locator } : {}),
    ...(origin !== undefined ? { origin } : {}), ...(at !== undefined ? { at } : {}), ...(locate ? { locate } : {}) };
}
