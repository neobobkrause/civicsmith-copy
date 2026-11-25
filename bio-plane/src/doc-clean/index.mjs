/* doc-clean: a member-supplied document's copy, whose embedded images carry nothing but their pixels and which
 * carries none of the document's own metadata (N806; Bob's K2315, K2334; requirements `build/requirements/doc-clean.md`).
 *
 * `cleanDocument(bytes)` answers a Promise of `{ok: true, clean: true, format}` (the original carries nothing to
 * remove and may travel whole), `{ok: true, clean: false, bytes, format, images: {stripped, unchanged}}` (the copy),
 * or `{ok: false, code, detail}` (a refusal by name, R3). The format is judged from the bytes alone (R1). A PDF is
 * rewritten by `pdf.mjs`, an OOXML or ODF package by `package.mjs`; every embedded image goes through `images.mjs`.
 * Pure and deterministic (R7): no clock, no randomness, no I/O, nothing kept between calls. */
import { hasZipMagic, discriminate } from "../ooxml.mjs";
import { CleanRefusal, latin1 } from "./images.mjs";
import { cleanPdf } from "./pdf.mjs";
import { cleanPackage, tooManyEntries, CLEAN_MAX_PART_BYTES, CLEAN_MAX_ENTRIES } from "./package.mjs";
import { newScan } from "./xml.mjs";
import { boundOf } from "../read-bounds.mjs";
import { localize } from "../setup-words/index.mjs";

export { CLEAN_MAX_PART_BYTES, CLEAN_MAX_ENTRIES };

/** The largest document cleaned, in bytes; a larger one is refused before a byte of it is read (R3, R4). Quoted from
 *  `READ_BOUNDS` (R12). */
export const CLEAN_MAX_BYTES = boundOf("document", "clean_bytes");

/** Every refusal code of this module's own, with what it means (R3); `image-cover`'s strip refusals are relayed
 *  under their own codes. */
export const CLEAN_REFUSALS = Object.freeze({
  ENCRYPTED: localize("doc-clean.index.the_document_is_encrypted", "the document is encrypted"),
  EMBEDDED_FILE: localize("doc-clean.index.the_document_carries_an_embedded", "the document carries an embedded file: a PDF attachment, an office file's embedding or macro project, or an ODF embedded object"),
  IMAGE_NOT_CLEANABLE: localize("doc-clean.index.an_embedded_image_is_of_a_kind", "an embedded image is of a kind whose metadata cannot be stripped"),
  HTML_EMBEDS_IMAGE: localize("doc-clean.index.the_html_document_embeds_an", "the HTML document embeds an image as a data: URI"),
  EMBEDDED_MEDIA: localize("doc-clean.index.the_document_carries_a_video_audio", "the document carries a video, audio, RichMedia or 3D part, whose own metadata can hold a time and place"),
  ARCHIVE: localize("doc-clean.index.the_file_is_a_zip_archive", "the file is a ZIP archive, not an office package; a member-supplied archive is never carried"),
  NOT_A_CLEANABLE_FORMAT: localize("doc-clean.index.the_file_is_of_no_format", "the file is of no format this module cleans"),
  DOCUMENT_TOO_LARGE: localize("doc-clean.index.the_document_or_one_of", "the document, or one of its parts, is larger than this module reads"),
  DOCUMENT_UNREADABLE: localize("doc-clean.index.the_document_s_structure_cannot", "the document's structure cannot be read whole"),
  TOO_MANY_ENTRIES: localize("doc-clean.index.the_package_holds_more_entries", "the package holds more entries than this module copies"),
});

const FAMILY = { docx: "ooxml", xlsx: "ooxml", pptx: "ooxml", odt: "odf", ods: "odf", odp: "odf" };

/** Clean one document (R1–R12). Never throws. `options.yieldNow` is awaited at least every 65,536 tokens of markup
 *  scanned (R11; default: a turn of the microtask queue); `options.scan`, when given, is filled with the counts of the
 *  scan (`scanned` bytes, `tokens`, `yields`), so a caller can see that the work was bounded by count, not by time
 *  (R-CLOCK). Nothing is kept between calls (R7). */
export async function cleanDocument(bytes, { yieldNow, scan = newScan(yieldNow) } = {}) {
  try {
    const d = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null;
    if (!d) throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.the_document_s_bytes_are_not", "the document's bytes are not a byte array"));
    if (d.length > CLEAN_MAX_BYTES)
      throw new CleanRefusal("DOCUMENT_TOO_LARGE", localize("doc-clean.index.the_document_is_length_bytes", "the document is {length} bytes, over the {CLEAN_MAX_BYTES} this module reads", { length: String(d.length), CLEAN_MAX_BYTES: String(CLEAN_MAX_BYTES) }));
    let format, done;
    if (latin1(d, 0, Math.min(d.length, 1024)).includes("%PDF-")) {
      format = "pdf";
      done = await cleanPdf(d, CLEAN_MAX_PART_BYTES);
    } else if (hasZipMagic(d)) {
      format = await packageFormat(d);
      done = await cleanPackage(d, FAMILY[format], scan);
    } else {
      format = textFormat(d);
      done = { clean: true };
    }
    return done.clean ? { ok: true, clean: true, format } : { ok: true, clean: false, bytes: done.bytes, format, images: done.images };
  } catch (e) {
    if (e instanceof CleanRefusal) return { ok: false, code: e.code, detail: e.detail };
    return { ok: false, code: "DOCUMENT_UNREADABLE", detail: localize("doc-clean.index.the_document_could_not_be", "the document could not be read whole ({String})", { String: String(String(e?.message ?? e).slice(0, 120)) }) };
  }
}

/** The package flavour of a ZIP (`docx`, `xlsx`, `pptx` for their macro-enabled twins too, `odt`, `ods`, `odp`), or
 *  a refusal. */
async function packageFormat(d) {
  const r = await discriminate(d);
  if (!r.ok && r.why === "OFFICE_ENTRIES_MAX") throw tooManyEntries(d);
  if (!r.ok) throw new CleanRefusal("DOCUMENT_UNREADABLE", localize("doc-clean.index.the_zip_directory_cannot_be", "the ZIP directory cannot be read ({why})", { why: String(r.why) }));
  if (r.format === "zip") throw new CleanRefusal("ARCHIVE", localize("doc-clean.index.a_zip_archive_that_is_neither", "a ZIP archive that is neither an OOXML nor an ODF package"));
  if (FAMILY[r.format]) return r.format;
  if (/unreadable|unparseable/.test(r.why ?? "")) throw new CleanRefusal("DOCUMENT_UNREADABLE", localize("doc-clean.index.the_package_cannot_be_read", "the package cannot be read ({why})", { why: String(r.why) }));
  throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.a_zip_package_of_no", "a ZIP package of no office format this module cleans ({why})", { why: String(r.why) }));
}

/** `html` or `text` for bytes that decode as text (UTF-8, UTF-16 by its byte-order mark, or single-byte text with
 *  no control byte but tab, line feed, form feed and carriage return), or a refusal. HTML is any text with an
 *  HTML tag, judged whatever the text's encoding, and is refused when it embeds an image. */
function textFormat(d) {
  if (d.length >= 8 && d[0] === 0xd0 && d[1] === 0xcf && d[2] === 0x11 && d[3] === 0xe0 && d[4] === 0xa1 && d[5] === 0xb1 && d[6] === 0x1a && d[7] === 0xe1) {
    if (latin1(d).includes("E\0n\0c\0r\0y\0p\0t\0e\0d\0P\0a\0c\0k\0a\0g\0e\0"))
      throw new CleanRefusal("ENCRYPTED", localize("doc-clean.index.an_encrypted_office_document_an", "an encrypted office document (an EncryptedPackage compound file)"));
    throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.a_compound_file_a_legacy", "a compound file (a legacy office document), not a format this module cleans"));
  }
  const s = decodeText(d);
  if (s === null || /[\x00-\x08\x0b\x0e-\x1f\x7f]/.test(s)) throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.the_file_is_neither_a_pdf", "the file is neither a PDF, an office package nor text"));
  const head = s.slice(0, 4096).replace(/^﻿/, "").trimStart();
  if (/^\{\\rtf/.test(head)) throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.an_rtf_document_not_a_format", "an RTF document, not a format this module cleans"));
  if (/^%!PS/.test(head)) throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.a_postscript_document_not", "a PostScript document, not a format this module cleans"));
  if (/^MIME-Version\s*:/im.test(head)) throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.a_mime_message_not_a", "a MIME message, not a format this module cleans"));
  if (/^<(?:\?xml|svg[\s>])/i.test(head) && !/<html(?=[\s>])/i.test(s))
    throw new CleanRefusal("NOT_A_CLEANABLE_FORMAT", localize("doc-clean.index.an_xml_or_svg_document", "an XML or SVG document, not a format this module cleans"));
  const html = /<(?:!doctype\s+html|html|head|body|img|picture|iframe|object|embed|style|link|meta|div|p|a|table)(?=[\s/>])/i.test(s);
  if (!html) return "text";
  const m = /data\s*(?::|&colon;|&#0*58;?|&#x0*3a;?)\s*image/i.exec(s);
  if (m) throw new CleanRefusal("HTML_EMBEDS_IMAGE", localize("doc-clean.index.a_data_image_uri_at", "a data:image URI at character {index}", { index: String(m.index) }));
  return "html";
}

function decodeText(d) {
  const tryDecode = (enc, from) => { try { return new TextDecoder(enc, { fatal: true }).decode(d.subarray(from)); } catch { return null; } };
  if (d[0] === 0xff && d[1] === 0xfe) return tryDecode("utf-16le", 2);
  if (d[0] === 0xfe && d[1] === 0xff) return tryDecode("utf-16be", 2);
  return tryDecode("utf-8", d[0] === 0xef && d[1] === 0xbb && d[2] === 0xbf ? 3 : 0) ?? latin1(d);
}
