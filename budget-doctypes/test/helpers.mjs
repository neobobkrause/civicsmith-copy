/* Test support: the two views, the supplied texts and the contexts a content
 * type is handed. The views are `jurisdictions.combine` of the first profile
 * and of the test profile, with nothing added: every title, heading, header
 * word and code form a test reads is the profile's own (K1513, K1526). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { combine } from "../../jurisdictions/index.mjs";
import { flattenText, makeLocator } from "../../docprofile/registry.mjs";
import { csvEntry } from "../../bio-plane/src/csv.mjs";
/** @import { View } from "../../jurisdictions/index.mjs" */
/** @import { DoctypeContext, ReaderView, SuppliedText, SuppliedPage, SuppliedImage, UndeterminedMarker } from "../../docprofile/registry.mjs" */

/**
 * One page of a measured PDF fixture, as the producer gave it.
 * @typedef {Object} FixturePage
 * @property {number} page
 * @property {string} text
 * @property {UndeterminedMarker[]} [undetermined]
 */
/**
 * A measured PDF fixture (`fixtures/README.md`): its pages, its images and its tier-one reading.
 * @typedef {Object} PdfFixture
 * @property {string} key
 * @property {FixturePage[]} pages
 * @property {SuppliedImage[]} [images]
 * @property {{ pages: FixturePage[] }} [tier1]
 */

const here = dirname(fileURLToPath(import.meta.url));
/** The path of one of this module's fixtures.
 *  @param {string} name
 *  @returns {string} */
export const fixture = (name) => join(here, "fixtures", name);

/** @param {string} id @returns {View} */
function view(id) {
  const r = combine([id]);
  if (!r.ok) throw new Error(`combine(${id}) failed: ${JSON.stringify(r)}`);
  return r.view;
}

/** The first profile's view. @returns {View} */
export const firstView = () => view("oakland-alameda");
/** The test profile's view. @returns {View} */
export const testView = () => view("test-port-ellery");

/** A measured PDF fixture, as the supplied text (I2) of the pages chosen.
 *  @param {string} key
 *  @param {{ tier1?: boolean, pages?: number[] | null }} [options]
 *  @returns {{ fixture: PdfFixture, supplied: SuppliedText }} */
export function pdfFixture(key, { tier1 = false, pages = null } = {}) {
  const f = /** @type {PdfFixture} decodes this module's own fixture file */ (JSON.parse(readFileSync(fixture(`${key}.json`), "utf8")));
  const t1 = f.tier1;
  let list = tier1 && t1 ? t1.pages : tier1 ? [] : f.pages;
  if (tier1 && !t1) throw new TypeError(`Cannot read properties of undefined (reading 'pages')`);
  if (pages) list = list.filter((p) => pages.includes(p.page + 1));
  const want = new Set(list.map((p) => p.page));
  /** @type {SuppliedPage[]} */
  const pagesOut = [];
  for (const p of list) pagesOut.push({ ...p, undetermined: p.undetermined || [] });
  /** @type {SuppliedText} */
  const supplied = {
    container: "pdf",
    pages: pagesOut,
    undetermined: list.flatMap((p) => p.undetermined || []),
    images: (f.images || []).filter((im) => { const page = im.page; return page !== undefined && want.has(page); }),
    document: list.map((p) => p.text).filter((t) => t.length).join("\n"),
  };
  return { fixture: f, supplied };
}

/** The context `readText` hands a content type: the flattened text, the
 *  locator over its pages, the view, and the supplied text itself.
 *  A text handed as a string is flattened as one; the context then carries no supplied structure.
 *  @param {SuppliedText | string} supplied
 *  @param {ReaderView} view
 *  @param {DoctypeContext} [extra]
 *  @returns {DoctypeContext} */
export function ctxFor(supplied, view, extra = {}) {
  const flat = flattenText(supplied);
  return { text: flat.text, locate: makeLocator(flat.segments), view, supplied: typeof supplied === "string" ? null : supplied, ...extra };
}

/** A CSV as `office-readers` supplies it: `csvEntry.text()`, its sheet with
 *  its typed cells (R30); `cells: false` takes them away, as a supplied text
 *  without cells would come.
 *  @param {string} textOrPath
 *  @param {{ cells?: boolean }} [options]
 *  @returns {Promise<SuppliedText>} */
export async function csvSupplied(textOrPath, { cells = true } = {}) {
  const text = textOrPath.includes("\n") ? textOrPath : readFileSync(textOrPath, "utf8");
  const r = await csvEntry.text(new TextEncoder().encode(text));
  if (!("sheets" in r)) throw new TypeError("Cannot read properties of undefined (reading '0')");
  const first = r.sheets[0];
  if (first === undefined) throw new TypeError("Cannot read properties of undefined");
  const { cells: typed, ...rest } = first;
  const sheet = cells ? { ...first } : rest;
  return { container: r.container, document: r.document, sheets: [sheet], undetermined: r.undetermined, counts: r.counts, images: r.images };
}
