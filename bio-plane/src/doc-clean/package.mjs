/* doc-clean: an OOXML or ODF package's copy (R2, R6), or a refusal (R3).
 *
 * The copy is a fresh ZIP: the same parts in the same order (less `docProps/custom.xml`, R6), each written from its
 * verified bytes (`ooxml.readPart`) with its original method, one fixed time (1980-01-01 00:00), no extra field and
 * no comment; only image parts and the parts holding R6's metadata change (`xml.mjs` edits them). Parts are read,
 * edited and compressed one at a time, so the working set is about one part's size twice (R4). */
import { readContainer, readPart, crc32, normalizePartName, ODF_MANIFEST_PART, CORE_PROPERTIES_PART } from "../ooxml.mjs";
import { CleanRefusal, cleanImage, imageKind, mediaKind, latin1 } from "./images.mjs";
import { editXml, newScan } from "./xml.mjs";
import { boundOf } from "../read-bounds.mjs";
import { localize } from "../setup-words/index.mjs";

/** The most entries a package may hold (R3 `TOO_MANY_ENTRIES`; R12: the table's, not a figure of this module's). */
export const CLEAN_MAX_ENTRIES = boundOf("office", "entries");
/** The most one part may inflate to, over what it holds (R3 `DOCUMENT_UNREADABLE`; the archive table's ratio). */
const RATIO_MAX = boundOf("archive", "ratio");
/** The most uncompressed bytes one part may declare: the largest the plane's isolate holds with its working copies
 *  (R4; measured in workerd, the job's record). Quoted from `READ_BOUNDS` (R12). */
export const CLEAN_MAX_PART_BYTES = boundOf("document", "part_bytes");

const CUSTOM_PART = "docProps/custom.xml";
/** The OOXML parts R6 removes (K2334, K2351): custom properties, custom XML data (which can carry a document
 *  library's properties, people's names among them) and printer settings (a printer's name). */
const REMOVED_PART = (n) => n === CUSTOM_PART || /^customXml\//i.test(n) || /(^|\/)printerSettings\//i.test(n);
const named = (el, attrs, value = "") => attrs.map((a) => ({ el, attr: ["", a], value }));

/** R6's edits (`xml.mjs` rules) for one part of an OOXML package, or `null` when the part holds none. `dropped` is
 *  the relationship ids of this part (or, for a `.rels` part, of its source) whose targets are removed. */
function ooxmlRules(name, removed, dropped) {
  const own = ownRules(name.toLowerCase(), name, removed);
  if (!dropped?.size) return own;
  const r = own ?? {};
  if (/(^|\/)_rels\/[^/]*\.rels$/.test(name)) return { ...r, drop: [...(r.drop ?? []), { el: ["rel", "Relationship"], when: (a) => dropped.has(a.Id) }] };
  return { ...r, attrs: [...(r.attrs ?? []), { attr: ["r", "id"], value: null, when: (v) => dropped.has(v) }] };
}

function ownRules(n, name, removed) {
  if (name === CORE_PROPERTIES_PART)
    return { remove: [["dc", "creator"], ["cp", "lastModifiedBy"], ["cp", "revision"], ["cp", "lastPrinted"], ["dcterms", "created"], ["dcterms", "modified"]] };
  if (name === "docProps/app.xml") return { remove: ["Application", "AppVersion", "Company", "Manager", "Template", "TotalTime"].map((l) => ["ep", l]) };
  if (name === "[Content_Types].xml" && removed.size) return { drop: [{ el: ["ct", "Override"], when: (a) => removed.has(normalizePartName(a.PartName ?? "")) }] };
  if (n === "word/_rels/settings.xml.rels") return { drop: [{ el: ["rel", "Relationship"], when: (a) => /\/attachedTemplate$/.test(a.Type ?? "") }] };
  if (/^word\/.+\.xml$/.test(n))
    return {
      attrs: [...[["w", "author"], ["w", "initials"], ["w15", "author"], ["w15", "providerId"], ["w15", "userId"]].map((attr) => ({ attr, value: "" })),
        ...[["w", "date"], ["w16cex", "dateUtc"]].map((attr) => ({ attr, value: null }))],
      remove: n === "word/settings.xml" ? [["w", "attachedTemplate"]] : [],
    };
  if (n === "ppt/commentauthors.xml") return { attrs: named(["p", "cmAuthor"], ["name", "initials"]) };
  if (n === "ppt/authors.xml") return { attrs: named(["p188", "author"], ["name", "initials", "userId", "providerId"]) };
  if (/^ppt\/comments\/[^/]+\.xml$/.test(n)) return { attrs: named(["p", "cm"], ["dt"], null) };
  if (/^xl\/(?:comments[^/]*|comments\/[^/]+)\.xml$/.test(n)) return { empty: [["x", "author"]], authorRuns: true };
  if (/^xl\/persons\/[^/]+\.xml$/.test(n)) return { attrs: named(["xtc", "person"], ["displayName", "userId", "providerId"]) };
  if (/^xl\/revisions\/[^/]+\.xml$/.test(n)) return { attrs: [...named(["x", "header"], ["userName"]), ...named(["x", "userInfo"], ["name"])] };
  if (n === "xl/workbook.xml") return { attrs: named(["x", "fileSharing"], ["userName"]), remove: [["x15ac", "absPath"]] };
  return null;
}

/** R6's edits for one part of an ODF package, or `null`. */
function odfRules(name) {
  if (name === "meta.xml")
    return { remove: [...["initial-creator", "generator", "template", "editing-cycles", "editing-duration", "creation-date", "print-date", "printed-by", "user-defined"].map((l) => ["meta", l]),
      ["dc", "creator"], ["dc", "date"]] };
  if (/\.xml$/i.test(name) && name !== ODF_MANIFEST_PART) return { empty: [["dc", "creator"], ["dc", "date"], ["meta", "creator-initials"]] };
  return null;
}

/** A legacy Excel comment's text without its leading author run: the first run of a comment's `<text>`, bold, whose
 *  text is one of the part's authors followed by a colon, as Excel writes it (R6, K2351). Read before the authors are
 *  emptied. */
function withoutAuthorRuns(bytes) {
  const s = latin1(bytes);
  const authors = new Set([...s.matchAll(/<(?:[\w.-]+:)?author>([^<]*)<\/(?:[\w.-]+:)?author>/g)].map((m) => `${m[1]}:`));
  if (!authors.size) return bytes;
  const t = s.replace(/(<([\w.-]+:)?text>)\s*(<\2r>(?:(?!<\/\2r>)[\s\S])*?<\/\2r>)/g, (whole, open, p, run) => {
    const bold = new RegExp(`<${p ?? ""}b(?:\\s+val="(?:1|true)")?\\s*/>`).test(run);
    const text = new RegExp(`<${p ?? ""}t(?:\\s[^>]*)?>([^<]*)</${p ?? ""}t>`).exec(run)?.[1];
    return bold && text !== undefined && authors.has(text.trim()) ? open : whole;
  });
  if (t === s) return bytes;
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
}

// ---- the ZIP ----

async function deflateRaw(bytes) {
  const chunks = [];
  let n = 0;
  const cs = new CompressionStream("deflate-raw"), writer = cs.writable.getWriter(), reader = cs.readable.getReader();
  const fed = (async () => {
    for (let o = 0; o < bytes.length; o += 1 << 20) await writer.write(bytes.subarray(o, o + (1 << 20)));
    await writer.close();
  })();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
  }
  await fed;
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

const DOS_DATE = 0x0021; // 1980-01-01
const le16 = (v) => [v & 255, (v >> 8) & 255];
const le32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const u16 = (d, o) => d[o] | (d[o + 1] << 8);
const u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;

const le64 = (v) => [...le32(v % 4294967296), ...le32(Math.floor(v / 4294967296))];
const FIELD16 = 0xffff, FIELD32 = 0xffffffff;

/** A ZIP of `parts` (`{name, method, data, crc, size}`, `data` already compressed), in order. The end record states
 *  the count of entries written; past a 16-bit count (or a 32-bit size or offset) ZIP64's end record and locator are
 *  written before it, and the count and the fields that overflow are the sentinels (R6: nothing is dropped for want of
 *  a field's width). */
function zip(parts) {
  const local = [], central = [];
  let at = 0;
  for (const p of parts) {
    const name = new TextEncoder().encode(p.name);
    const flags = /^[\x00-\x7f]*$/.test(p.name) ? 0 : 0x0800;
    const head = [...le16(20), ...le16(flags), ...le16(p.method), ...le16(0), ...le16(DOS_DATE), ...le32(p.crc), ...le32(p.data.length), ...le32(p.size), ...le16(name.length), ...le16(0)];
    local.push(new Uint8Array([0x50, 0x4b, 3, 4, ...head]), name, p.data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...le16(20), ...head, ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(at)]), name);
    at += 30 + name.length + p.data.length;
  }
  const cdSize = central.reduce((k, c) => k + c.length, 0), n = parts.length;
  const wide = n >= FIELD16 || cdSize >= FIELD32 || at >= FIELD32;
  const tail = [];
  if (wide) {
    const recAt = at + cdSize;
    tail.push(new Uint8Array([0x50, 0x4b, 6, 6, ...le64(44), ...le16(45), ...le16(45), ...le32(0), ...le32(0), ...le64(n), ...le64(n), ...le64(cdSize), ...le64(at)]),
      new Uint8Array([0x50, 0x4b, 6, 7, ...le32(0), ...le64(recAt), ...le32(1)]));
  }
  tail.push(new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...le16(wide ? FIELD16 : n), ...le16(wide ? FIELD16 : n), ...le32(cdSize >= FIELD32 ? FIELD32 : cdSize), ...le32(at >= FIELD32 ? FIELD32 : at), 0, 0]));
  const all = [...local, ...central, ...tail];
  const out = new Uint8Array(all.reduce((k, c) => k + c.length, 0));
  let o = 0;
  for (const c of all) { out.set(c, o); o += c.length; }
  return out;
}

/** Whether the original ZIP is already in the copy's form: no archive comment, and each entry's local and central
 *  record at the fixed time with no extra field and no comment. */
function plainZip(d, entries) {
  const e = d.length - 22;
  if (e < 0 || u32(d, e) !== 0x06054b50 || u16(d, e + 20) !== 0) return false;
  const fixed = (o) => u16(d, o) === 0 && u16(d, o + 2) === DOS_DATE;
  let c = u32(d, e + 16);
  for (const entry of entries) {
    const l = entry.localHeaderOffset;
    if (u32(d, l) !== 0x04034b50 || !fixed(l + 10) || u16(d, l + 28) !== 0) return false;
    if (c + 46 > d.length || u32(d, c) !== 0x02014b50 || !fixed(c + 12) || u16(d, c + 30) !== 0 || u16(d, c + 32) !== 0) return false;
    c += 46 + u16(d, c + 28);
  }
  return true;
}

// ---- the package ----

const refusal = (code, detail) => new CleanRefusal(code, detail);
const why = (r) => localize("doc-clean.package.part_cannot_be_read_why", "part {name} cannot be read ({why})", { name: String(r.name ?? "?"), why: String(r.why) });

/** For each `.rels` part that names a removed part, the ids of those relationships, keyed both by the `.rels` part
 *  and by its source part (whose `r:id` attributes naming them are removed too). */
async function relsToRemoved(d, c, names, removed) {
  const out = new Map();
  for (const n of names) {
    const m = /^(.*?)_rels\/([^/]*)\.rels$/.exec(n);
    if (!m || removed.has(n)) continue;
    const r = await readPart(d, c, n);
    if (!r.ok) throw refusal("DOCUMENT_UNREADABLE", why(r));
    const ids = new Set();
    for (const t of latin1(r.bytes).matchAll(/<(?:[\w.-]+:)?Relationship(?=[\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
      const attr = (k) => new RegExp(`\\s${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(t[1])?.slice(1).find((x) => x !== undefined);
      if (attr("TargetMode") === "External") continue;
      const target = attr("Target") ?? "";
      const resolved = target.startsWith("/") ? normalizePartName(target) : resolvePath(m[1], target);
      if (removed.has(resolved) && attr("Id")) ids.add(attr("Id"));
    }
    if (ids.size) { out.set(n, ids); out.set(m[1] + m[2], ids); }
  }
  return out;
}
const resolvePath = (dir, target) => {
  const parts = [];
  for (const seg of (dir + target).split("/")) { if (seg === "..") parts.pop(); else if (seg !== "." && seg !== "") parts.push(seg); }
  return parts.join("/");
};

/** The entry count a ZIP's end record declares (ZIP64's record when the 16-bit field is the sentinel), for the refusal
 *  `ooxml.readContainer` answers on `OFFICE_ENTRIES_MAX` (R3): that refusal names the limit, not the count. */
function declaredEntries(d) {
  let e = d.length - 22;
  for (; e >= 0 && e >= d.length - 22 - FIELD16; e--) if (u32(d, e) === 0x06054b50) break;
  if (e < 0 || u32(d, e) !== 0x06054b50) return 0;
  const n = u16(d, e + 10);
  const loc = e - 20;
  if (n !== FIELD16 || loc < 0 || u32(d, loc) !== 0x07064b50) return n;
  const at = u32(d, loc + 8) + u32(d, loc + 12) * 4294967296;
  return at + 56 <= loc ? u32(d, at + 32) + u32(d, at + 36) * 4294967296 : n;
}

/** R3's `TOO_MANY_ENTRIES` for a package whose end record declares more entries than `ooxml` reads (`OFFICE_ENTRIES_MAX`). */
export function tooManyEntries(d) {
  const count = String(declaredEntries(d));
  return refusal("TOO_MANY_ENTRIES", localize("doc-clean.package.the_package_holds_count_entries", "the package holds {count} entries, over the {CLEAN_MAX_ENTRIES} this module copies", { count, CLEAN_MAX_ENTRIES: String(CLEAN_MAX_ENTRIES) }));
}

/** Clean an OOXML (`family` "ooxml") or ODF ("odf") package. Answers `{clean:true}` or `{clean:false, bytes, images}`. */
export async function cleanPackage(d, family, scan = newScan()) {
  const c = readContainer(d);
  if (!c.ok && c.why === "OFFICE_ENTRIES_MAX") throw tooManyEntries(d);
  if (!c.ok) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.package.the_packages_zip_directory_cannot", "the package's ZIP directory cannot be read ({why})", { why: String(c.why) }));
  const names = new Set();
  for (const e of c.entries) {
    const n = normalizePartName(e.name);
    if (names.has(n)) throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.package.part_n_appears_twice", "part {n} appears twice", { n: String(n) }));
    names.add(n);
    if (e.uncompressedSize > CLEAN_MAX_PART_BYTES)
      throw refusal("DOCUMENT_TOO_LARGE", localize("doc-clean.package.part_n_declares_uncompressedsize_bytes", "part {n} declares {uncompressedSize} bytes, over the {CLEAN_MAX_PART_BYTES} this module reads", { n: String(n), uncompressedSize: String(e.uncompressedSize), CLEAN_MAX_PART_BYTES: String(CLEAN_MAX_PART_BYTES) }));
    if (e.uncompressedSize > e.compressedSize * RATIO_MAX)
      throw refusal("DOCUMENT_UNREADABLE", localize("doc-clean.package.part_n_declares_uncompressedsize_bytes_in", "part {n} declares {uncompressedSize} bytes in {compressedSize}, over the ratio of {RATIO_MAX} this module inflates", { n: String(n), uncompressedSize: String(e.uncompressedSize), compressedSize: String(e.compressedSize), RATIO_MAX: String(RATIO_MAX) }));
    if (family === "ooxml" && (/(^|\/)embeddings\//i.test(n) || /(^|\/)vbaProject\.bin$/i.test(n)))
      throw refusal("EMBEDDED_FILE", localize("doc-clean.package.part_n_is_an_embedded", "part {n} is an embedded file", { n: String(n) }));
    if (family === "odf" && /^Object [^/]*(\/|$)/.test(n)) throw refusal("EMBEDDED_FILE", localize("doc-clean.package.part_n_is_or_belongs", "part {n} is or belongs to an embedded object", { n: String(n) }));
  }
  if (family === "odf") {
    const m = await readPart(d, c, ODF_MANIFEST_PART);
    if (!m.ok) throw refusal("DOCUMENT_UNREADABLE", why(m));
    const s = latin1(m.bytes);
    if (/<([\w.-]+:)?encryption-data(?=[\s/>])/.test(s)) throw refusal("ENCRYPTED", localize("doc-clean.package.the_package_s_manifest_lists_encrypted", "the package's manifest lists encrypted parts"));
    for (const t of s.matchAll(/<(?:[\w.-]+:)?file-entry(?=[\s/>])((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g)) {
      const path = /\s(?:[\w.-]+:)?full-path\s*=\s*"([^"]*)"/.exec(t[1])?.[1] ?? "";
      const type = /\s(?:[\w.-]+:)?media-type\s*=\s*"([^"]*)"/.exec(t[1])?.[1] ?? "";
      if (path !== "/" && path.endsWith("/") && /^application\/vnd\.oasis\.opendocument\./.test(type))
        throw refusal("EMBEDDED_FILE", localize("doc-clean.package.part_path_is_an_embedded", "part {path} is an embedded object", { path: String(path) }));
    }
  }
  const removed = new Set(family === "ooxml" ? [...names].filter(REMOVED_PART) : []);
  const dropped = removed.size ? await relsToRemoved(d, c, names, removed) : new Map();
  const images = { stripped: 0, unchanged: 0 };
  const parts = [];
  let changed = removed.size > 0;
  for (const e of c.entries) {
    const n = normalizePartName(e.name);
    if (removed.has(n)) continue;
    const r = await readPart(d, c, e.name);
    if (!r.ok) throw refusal(r.why === "ARCHIVE_TOTAL_MAX" || r.why === "MEMBER_MAX" ? "DOCUMENT_TOO_LARGE" : "DOCUMENT_UNREADABLE", why(r));
    let bytes = r.bytes;
    const media = n.endsWith("/") ? null : mediaKind(bytes);
    if (media) throw refusal("EMBEDDED_MEDIA", localize("doc-clean.package.part_n_media", "part {n}: {media}", { n: String(n), media: String(media) }));
    const kind = n.endsWith("/") ? null : imageKind(bytes);
    if (kind) {
      const out = await cleanImage(bytes, kind, `part ${n}`, CLEAN_MAX_PART_BYTES, scan);
      if (out.changed) { bytes = out.bytes; images.stripped++; } else images.unchanged++;
    } else {
      const rules = family === "ooxml" ? ooxmlRules(n, removed, dropped.get(n)) : odfRules(n);
      if (rules?.authorRuns) bytes = withoutAuthorRuns(bytes);
      if (rules) bytes = await editXml(bytes, rules, { inPlace: e.method === 8 && bytes === r.bytes, where: `part ${n}`, scan });
    }
    if (bytes !== r.bytes) changed = true;
    parts.push({ name: e.name, method: e.method, size: bytes.length, crc: crc32(bytes), data: e.method === 8 ? await deflateRaw(bytes) : bytes });
  }
  if (!changed && plainZip(d, c.entries)) return { clean: true };
  return { clean: false, bytes: zip(parts), images };
}
