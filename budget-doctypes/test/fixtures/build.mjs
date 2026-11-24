/* Rebuilds the measured-document fixtures (R13) from the PDFs themselves.
 *
 * Not run by the tests. Usage, from the repository root, with the four PDFs
 * fetched from the addresses below and `pdf-worker`'s dependencies installed:
 *   node budget-doctypes/test/fixtures/build.mjs <dir holding a24.pdf a14.pdf a19.pdf bb23.pdf>
 *
 * Each fixture holds the selected pages' text as the plane's PDF path supplies
 * it: tier 2 (`pdf-worker` R9: `unpdf`, one `{page, text, undetermined}` per
 * page, a page with no text carrying a `no_text_layer` marker), because tier 1
 * cannot decode three of the four documents (FY2014's fonts carry no
 * `/ToUnicode`, FY2019 is encrypted, the budget book's page 137 decodes to
 * nothing); and the images tier 1 lists for those pages (`pdf-reader` R16), which
 * `pdf-worker` returns beside its text. For the FY2024 report, whose text tier 1
 * does decode, `tier1` holds tier 1's own text of three pages: a cell-per-line
 * layout, the reader's second shape. Pages are 0-based as I2 numbers them; the
 * measurement's `pdf_page` is one more. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
if (typeof Math.sumPrecise !== "function") Math.sumPrecise = (a) => { let s = 0; for (const x of a) s += x; return s; };
const { getDocumentProxy, extractText } = await import(pathToFileURL(join(root, "pdf-worker/node_modules/unpdf/dist/index.mjs")).href);
const { extractPdfStructure } = await import(pathToFileURL(join(root, "bio-plane/src/pdfstructure.mjs")).href);

const ACFR = "https://www.oaklandca.gov/files/assets/city/v/1/finance/documents/financial-reporting/annual-comprehensive-financial-reports/";
const DOCS = [
  { key: "a24", url: ACFR + "2024-city-of-oakland-acfr_final-121324.pdf", pages: [1, 4, 49, 50, 51, 57, 179, 204, 212],
    tier1: [49, 204, 212] },
  { key: "a14", url: ACFR + "2014-comprehensive-annual-financial-report-pdf.pdf", pages: [1, 2, 3, 46, 48, 148, 167, 169] },
  { key: "a19", url: ACFR + "city-of-oakland-cafr-ye-6.30.2019-final-12.13.2019.pdf", pages: [1, 2, 3, 50, 158] },
  { key: "bb23", url: "https://www.oaklandca.gov/files/assets/city/v/1/finance/documents/fiscal-years/2023-2025-budget/"
      + "fy23-25-adopted-budget-book-final-reduced-size.pdf", pages: [1, 2, 11, 17, 137, 148, 196, 241, 283] },
];

const dir = process.argv[2];
for (const d of DOCS) {
  const bytes = new Uint8Array(readFileSync(join(dir, `${d.key}.pdf`)));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const s = await extractPdfStructure(bytes.slice());
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(pdf, { mergePages: false });
  const want = new Set(d.pages.map((p) => p - 1));
  const pages = [];
  for (const i of [...want].sort((a, b) => a - b)) {
    const t = text[i] || "";
    pages.push({ page: i, text: t, undetermined: t.trim() ? [] : [{ page: i, reason: "no_text_layer", font: null, codes: "", count: 0 }] });
  }
  const out = { key: d.key, url: d.url, sha256, fetched: "2026-10-05", producer: "tier 2 (pdf-worker R9, unpdf)",
                pages_in_document: s.pages, pages,
                images: (s.images || []).filter((im) => want.has(im.page)) };
  if (d.tier1) {
    const t1 = new Set(d.tier1.map((p) => p - 1));
    out.tier1 = { producer: "tier 1 (pdf-reader R11-R15)", pages: s.text.pages.filter((p) => t1.has(p.page)) };
  }
  writeFileSync(join(here, `${d.key}.json`), JSON.stringify(out, null, 1) + "\n");
  console.log(d.key, sha256, pages.length);
}
