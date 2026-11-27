/* pdf-reader's published fixtures: the answers its users read, made by this module's real code when a test calls them,
 * never stored. Each export is named for the answer it gives, so a user's test says which answer it means. */
import { extractPdfStructure, extractPdfRange, openPdfRange } from "../../../src/pdfstructure.mjs";
import { FONT_OBJS, FONTS } from "./pdf.mjs";
import { indexed } from "./indexed.mjs";
/** @import { PdfStructureAnswer, PdfRange, PdfRefusal } from "../../../src/pdfstructure.mjs" */
/** @import { IndexedObjects } from "./indexed.mjs" */

/** R50's three files: `intact`, `damaged` (its `startxref` pointing nowhere), `cut` (the first 70 percent).
 *  @typedef {Object} RangedNotesFiles
 *  @property {Uint8Array} intact
 *  @property {Uint8Array} damaged
 *  @property {Uint8Array} cut
 */
/** R50: the notes each read of one file gives.
 *  @typedef {Object} RangedNotesOf
 *  @property {string[]} whole `extractPdfStructure`'s `notes`
 *  @property {string[]} open `openPdfRange`'s `notes`
 *  @property {string[][]} ranges the `notes` of `range` for pages 0-9 then 10-19 of the same open
 *  @property {string[]} direct the `notes` of `extractPdfRange` for pages 0-9
 */
/** R50: the notes of each of the three files.
 *  @typedef {Object} RangedNotes
 *  @property {RangedNotesOf} intact
 *  @property {RangedNotesOf} damaged
 *  @property {RangedNotesOf} cut
 */

/** The answer to bytes that are not a PDF: `extractPdfStructure` of the text "not a pdf" (R1, NOT_A_PDF).
 *  @returns {Promise<PdfStructureAnswer>} */
export async function notAPdf() {
  return extractPdfStructure(new TextEncoder().encode("not a pdf"));
}

/* R50: a 30-page file with a cross-reference table, intact, with its `startxref` damaged, and cut at 70 percent. */
const PAGES_OF_FILE = 30;
/** @returns {Uint8Array} */
function pagesOfFile() {
  /** @type {IndexedObjects} */
  const objs = { 1: "<< /Type /Catalog /Pages 2 0 R >>" };
  for (const [n, body] of Object.entries(FONT_OBJS)) objs[n] = body;
  /** @type {string[]} */
  const kids = [];
  for (let i = 0; i < PAGES_OF_FILE; i++) {
    const pn = 100 + 2 * i;
    kids.push(`${pn} 0 R`);
    objs[pn] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${FONTS} >> /Contents ${pn + 1} 0 R >>`;
    objs[pn + 1] = { data: `BT /F1 12 Tf 40 700 Td (PAGE${String(i + 1).padStart(2, "0")}) Tj ET` };
  }
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${PAGES_OF_FILE} >>`;
  return indexed(objs, { xref: "table" });
}

/** The three files R50 reads, made fresh: `intact`, `damaged` (its `startxref` pointing nowhere), `cut` (the first 70 percent).
 *  @returns {RangedNotesFiles} */
export function rangedNotesFiles() {
  const intact = pagesOfFile();
  const text = Buffer.from(intact).toString("latin1");
  const damaged = new Uint8Array(Buffer.from(text.replace(/startxref\n\d+/, "startxref\n7"), "latin1"));
  return { intact, damaged, cut: intact.subarray(0, Math.floor(intact.length * 0.7)) };
}

/** The notes of an answer that reads the file; a thrown failure naming `what` when it refused.
 *  @param {PdfStructureAnswer | PdfRange | PdfRefusal} answer
 *  @param {string} what
 *  @returns {string[]} */
function notesOf(answer, what) {
  if (!answer.ok) throw new Error(`${what}: refused (${answer.reason})`);
  return answer.notes;
}

/** R50: the real answers a ranged read of one file gives.
 *  @param {string} name
 *  @param {Uint8Array} bytes
 *  @returns {Promise<RangedNotesOf>} */
async function rangedNotesOf(name, bytes) {
  const whole = await extractPdfStructure(bytes);
  const opened = await openPdfRange(bytes);
  if (!opened.ok) throw new Error(`${name}: openPdfRange refused (${opened.reason})`);
  return {
    whole: notesOf(whole, `${name}: extractPdfStructure`),
    open: opened.notes,
    ranges: [notesOf(await opened.range({ from: 0, count: 10 }), `${name}: range 0-9`),
      notesOf(await opened.range({ from: 10, count: 10 }), `${name}: range 10-19`)],
    direct: notesOf(await extractPdfRange(bytes, { from: 0, count: 10 }), `${name}: extractPdfRange`),
  };
}

/** R50: for each of the three files, the real answers a ranged read gives: `whole` (`extractPdfStructure`'s `notes`), `open`
 *  (`openPdfRange`'s `notes`), `ranges` (the `notes` of `range` for pages 0-9 then 10-19 of the same open), and `direct`
 *  (the `notes` of `extractPdfRange` for pages 0-9).
 *  @returns {Promise<RangedNotes>} */
export async function rangedNotes() {
  const files = rangedNotesFiles();
  const intact = await rangedNotesOf("intact", files.intact);
  const damaged = await rangedNotesOf("damaged", files.damaged);
  const cut = await rangedNotesOf("cut", files.cut);
  return { intact, damaged, cut };
}
