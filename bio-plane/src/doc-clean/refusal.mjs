/* doc-clean: the refusal every part of the module throws and `cleanDocument` answers (R3). Its own file so that the XML
 * scanner (`xml.mjs`) and the image judge (`images.mjs`), which import each other's neighbours, share one class; the
 * kinds the PDF and package writers both answer are stated here too. */
/** The counts of embedded images a copy changed and left as they were (R1).
 *  @typedef {{ stripped: number, unchanged: number }} ImageCounts */
/** What the PDF or package writer answers: the original may travel whole, or the copy.
 *  @typedef {{ clean: true } | { clean: false, bytes: Uint8Array, images: ImageCounts }} Cleaned */

export class CleanRefusal extends Error {
  /** @param {string} code the refusal's name (R3)
   *  @param {string} detail the object, part or image at fault */
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    /** @type {string} */
    this.code = code;
    /** @type {string} */
    this.detail = detail;
  }
}
