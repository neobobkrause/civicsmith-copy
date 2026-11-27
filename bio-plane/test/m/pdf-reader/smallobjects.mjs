/* pdf-reader tests (R37, R41; fix round 5, E2): a PDF of as many small objects as fit in 16 MiB, written the way the
 * govinfo budget volumes' tagged structure trees and a form's annotations are: one object each, all reached from the
 * catalog. Built from text (R29). `annots`: 124,000 text annotations, a rect, a number and a string each, listed by one
 * array (doc-clean's R4 file, whose reading is red at 146 MB); `tagged`: structure elements that name their parent, page
 * and children by reference, no string. The elements form a tree of two children each, all reachable. Both carry a classic cross-reference table, so any reader of this module can
 * open them. */
import { bytesOf } from "./pdf.mjs";

/** The two shapes of file: one of many text annotations, or one of a tagged structure tree.
 *  @typedef {"annots" | "tagged"} SmallObjectsShape */
/** The body of object `i` of `n`.
 *  @callback SmallObjectBody
 *  @param {number} i
 *  @param {number} n
 *  @returns {string} */
/** One body maker for each shape.
 *  @typedef {Object} SmallObjectBodies
 *  @property {SmallObjectBody} annots
 *  @property {SmallObjectBody} tagged
 */

/** The words on the file's page. */
export const TEXT_LINE = "BT /F1 12 Tf 40 700 Td (The housing notice was adopted by the council.) Tj ET";
const TOUNI = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end";

/** The file's size target: 16 MiB less 64 KiB. */
export const SMALL_OBJECTS_BYTES = 16 * 1024 * 1024 - 64 * 1024;

/** Object `i` (the first after the catalog, page tree, page and list: number 5 and up).
 *  @type {SmallObjectBodies} */
const BODY = {
  annots: (i) => `<< /Type /Annot /Subtype /Text /Rect [0 0 1 1] /K ${i} /T (COMMENT ${i % 997}) >>`,
  tagged: (i, n) => `<< /Type /StructElem /S /P /P ${i ? 5 + ((i - 1) >> 1) : 4} 0 R /Pg 3 0 R /K [${[2 * i + 1, 2 * i + 2].filter((c) => c < n).map((c) => `${5 + c} 0 R`).join(" ")}] >>`,
};

/** The file of that shape's bytes.
 *  @param {SmallObjectsShape} [shape] absent is "annots"
 *  @returns {Uint8Array} */
export function smallObjectsPdf(shape = "annots") {
  const body = BODY[shape];
  const per = `9999999 0 obj\n${body(999999, 999999)}\nendobj\n0000000000 00000 n \n9999999 0 R `.length;
  const n = Math.floor((SMALL_OBJECTS_BYTES - 1024) / per);
  const list = shape === "annots" ? `[${Array.from({ length: n }, (_, i) => `${i + 5} 0 R`).join(" ")}]` : "<< /Type /StructTreeRoot /K [5 0 R] >>";
  const objs = [`<< /Type /Catalog /Pages 2 0 R ${shape === "annots" ? "/All" : "/StructTreeRoot"} 4 0 R >>`, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${n + 7} 0 R >> >> /Contents ${n + 5} 0 R${shape === "annots" ? " /Annots [5 0 R]" : ""} >>`, list];
  for (let i = 0; i < n; i++) objs.push(body(i, n));
  /* the page's one line of text, so a reading of the file has words to keep: its stream, its length, its font and the font's map */
  const line = TEXT_LINE;
  objs.push(`<< /Length ${line.length} >>\nstream\n${line}\nendstream`, `<< /Length 0 >>\nstream\n\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode ${n + 8} 0 R >>`,
    `<< /Length ${TOUNI.length} >>\nstream\n${TOUNI}\nendstream`);
  const head = "%PDF-1.7\n";
  const parts = [head];
  /** @type {number[]} */
  const offsets = [];
  let at = head.length;
  objs.forEach((o, i) => { const s = `${i + 1} 0 obj\n${o}\nendobj\n`; offsets.push(at); at += s.length; parts.push(s); });
  parts.push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) parts.push(`${String(o).padStart(10, "0")} 00000 n \n`);
  parts.push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`);
  return bytesOf(parts.join(""));
}
