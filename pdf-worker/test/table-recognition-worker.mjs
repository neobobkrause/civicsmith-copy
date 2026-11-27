/* CPDF-18 — a throwaway workerd entry for the table-recognition MEASUREMENT.
 * `pagepixels-worker.mjs`'s pattern: it exists so the candidate runs INSIDE
 * WORKERD, the runtime the GO/NO-GO is about, rather than only in node. It is
 * NOT the member's surface and no route is added to `src/index.mjs`. Imported
 * only by `table-recognition.probe.mjs`, which bundles it into a temp dir. */
/** @type {Math & { sumPrecise?: (values: readonly number[]) => number }} the runtime's Math, which may lack sumPrecise */
const runtimeMath = Math;
if (typeof runtimeMath.sumPrecise !== "function") {
  runtimeMath.sumPrecise = (values) => { let s = 0; for (const v of values) s += v; return s; };
}
import { getDocumentProxy } from "unpdf";
import { recogniseTables } from "./table-candidate.mjs";
/** @import { PlacedItem, FoundTable } from './table-candidate.mjs' */

/**
 * What one page gave: how many text runs pdf.js placed, and the tables the candidate found.
 * @typedef {Object} PageTables
 * @property {number} items
 * @property {FoundTable[]} tables
 */

/**
 * @param {Uint8Array} bytes the whole PDF
 * @param {number} pageIdx zero-based page index
 * @returns {Promise<PageTables>}
 */
export async function tablesOnPage(bytes, pageIdx) {
  const pdf = await getDocumentProxy(bytes);
  const page = await pdf.getPage(pageIdx + 1);
  const tc = await page.getTextContent();
  /** @type {PlacedItem[]} */
  const items = tc.items.flatMap((i) => ("str" in i && typeof i.str === "string") ? [placed(i.str, i.transform, i.width)] : []);
  return { items: items.length, tables: recogniseTables(items, pageIdx) };
}

/**
 * @param {string} str
 * @param {readonly number[]} transform pdf.js's text matrix
 * @param {number} width
 * @returns {PlacedItem}
 */
function placed(str, transform, width) {
  /* pdf.js's matrix always has six entries; an absent one reads as NaN, which every
     sum, comparison and rounding in the candidate treats as it would undefined. */
  const x = transform[4] ?? NaN;
  const y = transform[5] ?? NaN;
  return { str, x, y, w: width };
}

export default {
  /**
   * @param {{ url: string, arrayBuffer: () => Promise<ArrayBuffer> }} request the members of workerd's Request this entry reads
   */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/tables") return new Response("not found", { status: 404 });
    const page = Number(url.searchParams.get("page") ?? "0");
    const bytes = new Uint8Array(await request.arrayBuffer());
    try {
      return Response.json({ ok: true, ...(await tablesOnPage(bytes, page)) });
    } catch (e) {
      const message = (e !== null && (typeof e === "object" || typeof e === "function") && "message" in e && e.message) || e;
      return Response.json({ ok: false, reason: "THREW", message: String(message) }, { status: 500 });
    }
  },
};
