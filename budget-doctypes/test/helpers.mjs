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

const here = dirname(fileURLToPath(import.meta.url));
export const fixture = (name) => join(here, "fixtures", name);

function view(id) {
  const r = combine([id]);
  if (!r.ok) throw new Error(`combine(${id}) failed: ${JSON.stringify(r)}`);
  return r.view;
}

export const firstView = () => view("oakland-alameda");
export const testView = () => view("test-port-ellery");

/** A measured PDF fixture, as the supplied text (I2) of the pages chosen. */
export function pdfFixture(key, { tier1 = false, pages = null } = {}) {
  const f = JSON.parse(readFileSync(fixture(`${key}.json`), "utf8"));
  let list = tier1 ? f.tier1.pages : f.pages;
  if (pages) list = list.filter((p) => pages.includes(p.page + 1));
  const want = new Set(list.map((p) => p.page));
  const supplied = {
    container: "pdf",
    pages: list.map((p) => ({ ...p, undetermined: p.undetermined || [] })),
    undetermined: list.flatMap((p) => p.undetermined || []),
    images: (f.images || []).filter((im) => want.has(im.page)),
  };
  supplied.document = supplied.pages.map((p) => p.text).filter((t) => t.length).join("\n");
  return { fixture: f, supplied };
}

/** The context `readText` hands a content type: the flattened text, the
 *  locator over its pages, the view, and the supplied text itself. */
export function ctxFor(supplied, view, extra = {}) {
  const flat = flattenText(supplied);
  return { text: flat.text, locate: makeLocator(flat.segments), view, supplied, ...extra };
}

/** A CSV as `office-readers` supplies it: `csvEntry.text()`, its sheet with
 *  its typed cells (R30); `cells: false` takes them away, as a supplied text
 *  without cells would come. */
export async function csvSupplied(textOrPath, { cells = true } = {}) {
  const text = textOrPath.includes("\n") ? textOrPath : readFileSync(textOrPath, "utf8");
  const r = await csvEntry.text(new TextEncoder().encode(text));
  const sheet = { ...r.sheets[0] };
  if (!cells) delete sheet.cells;
  return { ...r, sheets: [sheet] };
}
