/* doc-clean: the refusal every part of the module throws and `cleanDocument` answers (R3). Its own file so that the XML
 * scanner (`xml.mjs`) and the image judge (`images.mjs`), which import each other's neighbours, share one class. */
export class CleanRefusal extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}
