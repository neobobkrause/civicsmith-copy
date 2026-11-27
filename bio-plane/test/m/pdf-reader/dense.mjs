/* pdf-reader test helper (R42): a synthetic text PDF of a stated page count and a stated number of text lines on a page, in
   the classic one-table layout, one Flate content stream a page, and (when `padTo` is given) incompressible image padding to
   reach that many bytes. With `scan`, a page is one image and no text; with `encrypted`, the trailer names a Standard
   security handler (the content is left as written: a reader that builds no text of an encrypted file never looks). Deterministic. A "text-dense" file is many pages of almost nothing but text, the shape whose
   memory grows with its pages while its bytes stay small. */
import { deflateSync } from "node:zlib";

/** What `densePdf` writes.
 *  @typedef {Object} DenseOptions
 *  @property {number} pages the page count
 *  @property {number} [linesPerPage] text lines on a page, absent is 40
 *  @property {number} [padTo] the byte count image padding brings the file to, absent or 0 is no padding
 *  @property {boolean} [scan] true makes each page one image and no text
 *  @property {boolean} [encrypted] true names a Standard security handler in the trailer
 */

/* incompressible and the same every time: a xorshift32 stream */
/** @param {number} n
 *  @param {number} seed
 *  @returns {Buffer} */
function padBytes(n, seed) {
  const out = Buffer.alloc(n);
  let x = (seed * 2654435761) >>> 0 || 1;
  for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = x & 0xff; }
  return out;
}

/** The synthetic PDF's bytes.
 *  @param {DenseOptions} options
 *  @returns {Uint8Array} */
export function densePdf({ pages, linesPerPage = 40, padTo = 0, scan = false, encrypted = false }) {
  /** @type {Buffer[]} */
  const objs = [];
  /** @param {string | Buffer} body
   *  @returns {number} the object's number */
  const add = (body) => { objs.push(Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1")); return objs.length; };
  /** @param {string} dict
   *  @param {Buffer} data
   *  @returns {Buffer} */
  const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream", "latin1")]);
  const words = ["budget", "department", "program", "appropriation", "fund", "services", "capital", "transfer", "revenue", "estimate", "fiscal", "report", "outlay", "authority"];
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cmap = Buffer.from("/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <00> <FF> <0000> endbfrange endcmap CMapName currentdict /CMap defineresource pop end end", "latin1");
  const cmapId = scan ? 0 : add(stream("", cmap));
  const fontId = scan ? 0 : add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode ${cmapId} 0 R >>`);
  const imageId = scan ? add(stream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8", Buffer.from([255]))) : 0;
  /** @type {number[]} */
  const pageIds = [];
  const pagesTreeId = objs.length + pages * 2 + 1;
  for (let p = 0; p < pages; p++) {
    if (scan) {
      const cid = add(stream("", Buffer.from("q 612 0 0 792 0 0 cm /Im0 Do Q", "latin1")));
      pageIds.push(add(`<< /Type /Page /Parent ${pagesTreeId} 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${cid} 0 R >>`));
      continue;
    }
    let t = "BT /F1 9 Tf 40 760 Td 11 TL\n";
    for (let l = 0; l < linesPerPage; l++) {
      let line = "";
      for (let w = 0; w < 9; w++) line += String(words[Math.floor(rnd() * words.length)]) + " " + Math.floor(rnd() * 99999) + " ";
      t += `(${line.trim()}) Tj T*\n`;
    }
    t += "ET";
    const cid = add(stream("/Filter /FlateDecode", deflateSync(Buffer.from(t, "latin1"))));
    pageIds.push(add(`<< /Type /Page /Parent ${pagesTreeId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${cid} 0 R >>`));
  }
  const treeId = add(`<< /Type /Pages /Count ${pages} /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] >>`);
  if (treeId !== pagesTreeId) throw new Error("tree id");
  const catId = add(`<< /Type /Catalog /Pages ${treeId} 0 R >>`);
  const encId = encrypted ? add("<< /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>") : 0;
  let size = objs.reduce((n, b) => n + b.length + 20, 0);
  while (size < padTo) {
    const n = Math.min(1_000_000, padTo - size);
    add(stream("/Type /XObject /Subtype /Image /Width 1000 /Height 1000 /ColorSpace /DeviceGray /BitsPerComponent 8", padBytes(n, objs.length)));
    size += n + 120;
  }
  const head = Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1");
  const parts = [head];
  /** @type {number[]} */
  const offs = [];
  let off = head.length;
  objs.forEach((b, i) => {
    offs.push(off);
    const o = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), b, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(o); off += o.length;
  });
  const xref = off;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offs) x += String(o).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<< /Size ${objs.length + 1} /Root ${catId} 0 R${encId ? ` /Encrypt ${encId} 0 R` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  parts.push(Buffer.from(x, "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}
