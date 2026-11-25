/* doc-clean: a PDF's copy, its latest revision rewritten whole (R2, R6), or a refusal (R3).
 *
 * The objects reachable from the latest trailer's `/Root` are read through `pdf-reader` (`openPdf`, `objects`),
 * walked from the catalog with the document's own metadata taken out on the way (R6), every image stripped or
 * refused (R2, R3), and written afresh: one object per number from 1 in the order of their old numbers, generation
 * 0, object streams expanded, a classic cross-reference table and a trailer of `/Size` and `/Root` alone. An object
 * the walk no longer reaches (an earlier revision's, `/Info`, an XMP stream) is not written. */
import { openPdf } from "../pdfstructure.mjs";
import { CleanRefusal, cleanImage, imageKind, jbig2WithoutComments, latin1 } from "./images.mjs";
import { localize } from "../setup-words/index.mjs";

/** Keys removed from every dictionary: document and object metadata, applications' private data, edit dates. */
const DROP_EVERYWHERE = new Set(["Metadata", "PieceInfo", "LastModified"]);
/** Keys removed from an annotation: who made it and when (R6); a widget's `/T` names its form field and stays. */
const DROP_FROM_ANNOT = ["M", "CreationDate"];
/** Keys removed from a signature dictionary: the signer, the signature and its certificates, where, why and when
 *  (R6, K2346). A signature field loses its `/V`, so it stays unsigned; the catalog loses `/Perms` and `/DSS`, which
 *  hold signatures and certificates too. The rewrite voids any signature in any case. */
const DROP_FROM_SIG = new Set(["Name", "Contents", "Location", "Reason", "ContactInfo", "M", "ByteRange", "Cert", "Prop_Build", "Prop_AuthTime", "Prop_AuthType"]);

/** What makes a dictionary embedded media (R3 `EMBEDDED_MEDIA`, K2351): a RichMedia, 3D, movie, sound or screen
 *  annotation, a media clip, a sound object, a 3D stream. */
const MEDIA_SUBTYPES = new Set(["RichMedia", "3D", "Movie", "Sound", "Screen", "U3D", "PRC"]);
const MEDIA_TYPES = new Set(["MediaClip", "Sound", "RichMediaContent", "3DRef"]);

const nameOf = (v) => (v && v.t === "name" ? v.v : null);
const filtersOf = (dict) => {
  const f = dict.Filter;
  if (!f) return [];
  return f.t === "arr" ? f.items.map(nameOf) : [nameOf(f)];
};
const refusal = (code, detail) => new CleanRefusal(code, detail);

/** Clean a PDF (`d` is its bytes). Answers `{clean:true}` or `{clean:false, bytes, images}`. */
export async function cleanPdf(d, maxInflated) {
  const doc = await openPdf(d);
  if (!doc) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.the_pdf_cannot_be_opened", "the PDF cannot be opened"));
  if (doc.isEncrypted()) throw refusal("ENCRYPTED", localize("doc-clean.pdf.the_pdf_is_encrypted_a", "the PDF is encrypted (a Standard security handler)"));
  const read = doc.objects();
  if (!read) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.the_pdf_has_no_readable", "the PDF has no readable trailer"));
  if (read.trailer.Encrypt) throw refusal("ENCRYPTED", localize("doc-clean.pdf.the_pdf_s_trailer_names_an", "the PDF's trailer names an /Encrypt dictionary"));
  if (read.unresolved.length) {
    const u = read.unresolved[0];
    throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.object_num_gen_is_referred", "object {num} {gen} is referred to and cannot be read", { num: String(u.num), gen: String(u.gen) }));
  }
  const table = new Map(read.objects.map((o) => [o.num, o.value]));
  const root = read.trailer.Root;
  if (!root || root.t !== "ref" || !table.has(root.n) || table.get(root.n)?.t !== "dict")
    throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.the_trailer_s_root_is_not", "the trailer's /Root is not a catalog dictionary"));

  const ctx = context(table);
  const out = new Map(); // old number -> {value} or {dict, bytes}
  const images = { stripped: 0, unchanged: 0 };
  let removed = Boolean(read.trailer.Info || read.trailer.ID);
  const queue = [root.n];
  const seen = new Set(queue);
  const enqueue = (n) => { if (!seen.has(n)) { seen.add(n); queue.push(n); } };

  for (let next = 0; next < queue.length; next++) {
    const num = queue[next];
    if (!table.has(num)) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.object_num_is_referred_to", "object {num} is referred to and cannot be read", { num: String(num) }));
    const value = table.get(num);
    const ed = { removed: false, refs: enqueue, num };
    if (value && value.t === "stream") {
      const dict = rewrite({ t: "dict", map: value.dict }, ed).map;
      const type = nameOf(value.dict.Type);
      if (type === "ObjStm" || type === "XRef") throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.object_num_is_a_type", "object {num} is a {type} stream reached from the catalog", { num: String(num), type: String(type) }));
      if (type === "EmbeddedFile") throw refusal("EMBEDDED_FILE", localize("doc-clean.pdf.object_num_is_an_embedded", "object {num} is an embedded file", { num: String(num) }));
      const raw = doc.streamRawBytes(value);
      let bytes = raw;
      if (!bytes) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.object_num_s_stream_cannot", "object {num}'s stream cannot be read", { num: String(num) }));
      if (ctx.content.has(num) || nameOf(value.dict.Subtype) === "Form" || value.dict.PatternType === 1) await inlineImages(doc, value, num);
      const filters = filtersOf(value.dict);
      const isImage = nameOf(value.dict.Subtype) === "Image" || ctx.thumbs.has(num) || filters.includes("DCTDecode") || filters.includes("DCT") || filters.includes("JPXDecode");
      if (isImage) {
        let changed = Boolean(value.dict.Metadata);
        const coded = filters.at(-1);
        if (coded === "JBIG2Decode") {
          if (filters.length > 1) throw refusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.pdf.object_num_a_jbig2_image", "object {num}: a JBIG2 image under another filter", { num: String(num) }));
          const r = jbig2WithoutComments(bytes, `object ${num}`);
          if (r.changed) { bytes = r.bytes; changed = true; }
        }
        if (coded === "DCTDecode" || coded === "DCT" || coded === "JPXDecode") {
          if (filters.length > 1) throw refusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.pdf.object_num_a_v1_image", "object {num}: a {v1} image under another filter", { num: String(num), v1: String(coded === "JPXDecode" ? "JPEG 2000" : "JPEG") }));
          const kind = imageKind(bytes);
          if (!kind) throw refusal("IMAGE_DATA_CORRUPT", localize("doc-clean.pdf.object_num_its_coded_data", "object {num}: its {coded} data is not an image file", { num: String(num), coded: String(coded) }));
          const r = await cleanImage(bytes, kind, `object ${num}`, maxInflated);
          if (r.changed) { bytes = r.bytes; changed = true; }
        }
        if (changed) images.stripped++; else images.unchanged++;
      }
      let streamDict = dict;
      if (ctx.globals.has(num)) {
        const plain = filters.length ? await doc.streamDecoded(value) : raw;
        if (!plain) throw refusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.pdf.object_num_jbig2_globals_that", "object {num}: JBIG2 globals that cannot be decoded", { num: String(num) }));
        const r = jbig2WithoutComments(plain, `object ${num}`);
        if (r.changed) {
          bytes = r.bytes;
          streamDict = { ...dict };
          delete streamDict.Filter;
          delete streamDict.DecodeParms;
        }
      }
      if (ed.removed || bytes !== raw) removed = true;
      out.set(num, { dict: streamDict, bytes });
    } else {
      const v = rewrite(value, ed, ctx.annots.has(num));
      if (ed.removed) removed = true;
      out.set(num, { value: v });
    }
  }

  if (!removed && (await singleRevision(doc, d, seen))) return { clean: true };
  return { clean: false, bytes: write(d, out, root.n), images };
}

/** What the walk needs to know of an object before it reaches it: which numbers are annotations, content streams
 *  (whose inline images are read), page thumbnails and JBIG2 globals. */
function context(table) {
  const annots = new Set(), content = new Set(), thumbs = new Set(), globals = new Set();
  const refsIn = (v, into) => {
    if (!v) return;
    if (v.t === "ref") into.add(v.n);
    else if (v.t === "arr") v.items.forEach((x) => refsIn(x, into));
  };
  const deref = (v) => (v && v.t === "ref" ? table.get(v.n) : v);
  for (const v of table.values()) {
    const map = v && v.t === "dict" ? v.map : v && v.t === "stream" ? v.dict : null;
    if (!map) continue;
    if (map.Annots) refsIn(deref(map.Annots), annots);
    if (nameOf(map.Type) === "Page") refsIn(deref(map.Contents)?.t === "arr" ? deref(map.Contents) : map.Contents, content);
    if (map.Thumb) refsIn(map.Thumb, thumbs);
    const parms = deref(map.DecodeParms);
    for (const p of parms?.t === "arr" ? parms.items.map(deref) : [parms]) if (p && p.t === "dict") refsIn(p.map.JBIG2Globals, globals);
    const procs = deref(map.CharProcs);
    if (procs && procs.t === "dict") for (const p of Object.values(procs.map)) refsIn(p, content);
    const ap = deref(map.AP);
    if (ap && ap.t === "dict")
      for (const k of ["N", "R", "D"]) {
        const a = deref(ap.map[k]);
        if (ap.map[k]?.t === "ref" && a?.t === "stream") content.add(ap.map[k].n);
        else if (a && a.t === "dict") for (const x of Object.values(a.map)) refsIn(x, content);
      }
  }
  return { annots, content, thumbs, globals };
}

/** `v` with R6's keys taken out, sharing every part that does not change (the reader's own values are never changed);
 *  every reference it keeps is handed to `ed.refs`. A dictionary is an annotation when it is one by number (`annot`),
 *  by its `/Type /Annot`, or as a direct entry of an `/Annots` array. */
function rewrite(v, ed, annot = false) {
  if (v === null || typeof v !== "object") return v;
  switch (v.t) {
    case "ref": ed.refs(v.n); return v;
    case "name": case "str": return v;
    case "arr": {
      let items = null;
      v.items.forEach((x, i) => {
        const y = rewrite(x, ed, annot && x !== null && x.t === "dict");
        if (y !== x) (items ??= v.items.slice())[i] = y;
      });
      return items ? { t: "arr", items } : v;
    }
    case "dict": {
      const type = nameOf(v.map.Type), sub = nameOf(v.map.Subtype);
      if (MEDIA_SUBTYPES.has(sub) || MEDIA_TYPES.has(type) || v.map.RichMediaContent)
        throw refusal("EMBEDDED_MEDIA", localize("doc-clean.pdf.object_num_v1_object", "object {num}: {v1} object", { num: String(ed.num), v1: String(sub ? `a ${sub}` : `a ${type ?? "RichMedia"}`) }));
      if (v.map.EF) throw refusal("EMBEDDED_FILE", localize("doc-clean.pdf.object_num_a_file_specification", "object {num}: a file specification carrying an embedded file", { num: String(ed.num) }));
      const isAnnot = annot || type === "Annot", isSig = type === "Sig" || type === "DocTimeStamp";
      const keys = Object.keys(v.map);
      let map = null;
      keys.forEach((k, i) => {
        const x = v.map[k];
        const drop = DROP_EVERYWHERE.has(k) || (isSig && DROP_FROM_SIG.has(k)) || (k === "V" && nameOf(v.map.FT) === "Sig") ||
          (type === "Catalog" && (k === "Perms" || k === "DSS")) || (isAnnot && (DROP_FROM_ANNOT.includes(k) || (k === "T" && sub !== "Widget")));
        const y = drop ? undefined : rewrite(x, ed, k === "Annots" && x !== null && x.t === "arr");
        if ((drop || y !== x) && !map) { map = {}; for (const p of keys.slice(0, i)) map[p] = v.map[p]; }
        if (drop) ed.removed = true;
        else if (map) map[k] = y;
      });
      return map ? { t: "dict", map } : v;
    }
  }
  throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.a_value_the_pdf_reader", "a value the PDF reader could not read ({String})", { String: String(String(v.t).slice(0, 20)) }));
}

/** Refuse a content stream that paints a JPEG inline (R3), or one that cannot be decoded and so cannot be read for
 *  them. */
async function inlineImages(doc, stream, num) {
  const d = await doc.streamDecoded(stream);
  if (!d) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.object_num_s_content_stream", "object {num}'s content stream cannot be decoded", { num: String(num) }));
  const ws = (c) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0;
  const delim = (c) => ws(c) || c === 0x5d || c === 0x29 || c === 0x3e || c === 0x7d;
  for (let i = 0; i + 2 < d.length; i++) {
    if (d[i] !== 0x42 || d[i + 1] !== 0x49 || !ws(d[i + 2]) || (i > 0 && !delim(d[i - 1]))) continue;
    let j = i + 2;
    while (j + 2 < d.length && !(ws(d[j - 1]) && d[j] === 0x49 && d[j + 1] === 0x44 && ws(d[j + 2]))) j++;
    const head = latin1(d, i + 2, j - i - 2);
    if (/\/(?:F|Filter)\s*(?:\[[^\]]*)?\/(?:DCT|DCTDecode)\b/.test(head))
      throw refusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.pdf.object_num_an_inline_jpeg", "object {num}: an inline JPEG image", { num: String(num) }));
    i = j + 2;
  }
}

/** Whether the original is one revision whose every object the copy keeps: one `startxref`, each object number
 *  defined once, and every object (an object stream's included) reached. Any doubt answers `false`. */
async function singleRevision(doc, d, kept) {
  const s = latin1(d);
  if ((s.match(/startxref/g) || []).length !== 1) return false;
  const nums = new Set();
  for (const m of s.matchAll(/(?:^|[^\d])(\d+)\s+(\d+)\s+obj\b/g)) {
    const n = Number(m[1]);
    if (nums.has(n)) return false;
    nums.add(n);
  }
  for (const n of nums) {
    if (kept.has(n)) continue;
    const v = doc.resolve({ t: "ref", n, g: 0 });
    const type = v && v.t === "stream" ? nameOf(v.dict.Type) : null;
    if (type === "XRef") continue;
    if (type !== "ObjStm") return false;
    const body = await doc.streamDecoded(v);
    if (!body) return false;
    const first = Number(v.dict.First);
    const head = latin1(body, 0, Number.isInteger(first) ? first : 0).trim().split(/\s+/).filter(Boolean).map(Number);
    for (let k = 0; k + 1 < head.length; k += 2) if (!kept.has(head[k])) return false;
  }
  return true;
}

// ---- the writer ----

const HEX = "0123456789ABCDEF";
const DELIM = new Set("()<>[]{}/%#".split(""));

function num(n) {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e21) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.a_number_the_pdf_writer", "a number the PDF writer cannot write"));
  const s = String(n);
  return /e/i.test(s) ? n.toFixed(20).replace(/\.?0+$/, "") : s;
}
function name(v) {
  let s = "/";
  for (const ch of v) {
    const c = ch.charCodeAt(0);
    if (c > 0xff) { for (const b of new TextEncoder().encode(ch)) s += "#" + HEX[b >> 4] + HEX[b & 15]; continue; }
    s += c < 0x21 || c > 0x7e || DELIM.has(ch) ? "#" + HEX[c >> 4] + HEX[c & 15] : ch;
  }
  return s;
}
/** A string written as a hex string of its exact bytes, `pdf-reader` R38's `raw`, never rebuilt from its text `v`
 *  (R10): a binary string, or a `FE FF` string of odd length, is read back byte for byte. */
function str(raw) {
  if (!(raw instanceof Uint8Array)) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.a_string_the_pdf_reader", "a string the PDF reader answered without its bytes"));
  let s = "<";
  for (const b of raw) s += HEX[b >> 4] + HEX[b & 15];
  return s + ">";
}
function ser(v, renum) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return num(v);
  switch (v.t) {
    case "name": return name(v.v);
    case "str": return str(v.raw);
    case "ref": return `${renum.get(v.n)} 0 R`;
    case "arr": return "[" + v.items.map((x) => ser(x, renum)).join(" ") + "]";
    case "dict": return "<<" + Object.entries(v.map).map(([k, x]) => `${name(k)} ${ser(x, renum)}`).join(" ") + ">>";
  }
  throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.pdf.a_value_the_pdf_writer_cannot", "a value the PDF writer cannot write"));
}

/** The copy: header, the kept objects renumbered from 1 in the order of their old numbers, the table, the trailer,
 *  written into one buffer that grows as it must. */
function write(d, out, rootNum) {
  const version = /%PDF-(\d\.\d)/.exec(latin1(d, 0, Math.min(d.length, 1024)))?.[1] ?? "1.7";
  const order = [...out.keys()].sort((a, b) => a - b);
  const renum = new Map(order.map((n, i) => [n, i + 1]));
  let buf = new Uint8Array(d.length + (d.length >> 3) + (1 << 12)), at = 0;
  const need = (k) => { if (at + k > buf.length) { const b = new Uint8Array(Math.max(Math.ceil(buf.length * 1.5), at + k)); b.set(buf.subarray(0, at)); buf = b; } };
  const put = (s) => { need(s.length); for (let i = 0; i < s.length; i++) buf[at++] = s.charCodeAt(i); };
  put(`%PDF-${version}\n%\xe2\xe3\xcf\xd3\n`);
  const offsets = [];
  for (const n of order) {
    offsets.push(at);
    const o = out.get(n);
    if (o.bytes) {
      const entries = Object.entries(o.dict).filter(([k]) => k !== "Length").map(([k, x]) => `${name(k)} ${ser(x, renum)}`);
      put(`${renum.get(n)} 0 obj\n<<${[...entries, `/Length ${o.bytes.length}`].join(" ")}>>\nstream\n`);
      need(o.bytes.length);
      buf.set(o.bytes, at);
      at += o.bytes.length;
      put("\nendstream\nendobj\n");
    } else put(localize("doc-clean.pdf.get_0_obj_ser_endobj", "{get} 0 obj\n{ser}\nendobj\n", { get: String(renum.get(n)), ser: String(ser(o.value, renum)) }));
  }
  const start = at;
  put(`xref\n0 ${order.length + 1}\n0000000000 65535 f\r\n`);
  for (const o of offsets) put(`${String(o).padStart(10, "0")} 00000 n\r\n`);
  put(`trailer\n<</Size ${order.length + 1} /Root ${renum.get(rootNum)} 0 R>>\nstartxref\n${start}\n%%EOF\n`);
  return buf.length - at > at >> 2 ? buf.slice(0, at) : buf.subarray(0, at);
}
