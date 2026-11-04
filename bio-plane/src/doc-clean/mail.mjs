/* doc-clean: an email's published copy (R13; N824; K2334, K5534). A captured message is rebuilt from what a reader of
 * the case may see: its text, its attachments (each cleaned by its own format's rule) and From, To, Cc, Date and
 * Subject as displayed. Every other header is dropped, every email and network address is stripped, and a name
 * shows only where the case's author marked it material, else it is withheld. The copy is a plain internet message
 * (EML) whatever the original's format. The reading is `mail-reader`'s; this file judges nothing of the message's bytes itself. */
import { readMessage, attachmentBytes } from "../mail-reader/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { CleanRefusal } from "./refusal.mjs";

const enc = new TextEncoder();
const ADDRESS = /[A-Za-z0-9._%+'!#$&*\/=?^`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const oneLine = (s) => String(s).replace(/[\r\n]+/g, " ").trim();
const withheld = () => localize("doc-clean.mail.withheld", "withheld");
/* A network address: an IPv4 address of four octets, or an IPv6 address written whole (eight groups) or shortened by
 * `::`, optionally bracketed; an IPv4 tail on an IPv6 address is matched by IPV4 within it. */
const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`(?<![\\w.])${OCTET}(?:\\.${OCTET}){3}(?![\\w]|\\.\\d)`, "g");
const H = "[0-9A-Fa-f]{1,4}";
const IPV6 = new RegExp(`(?<![\\w:.])\\[?(?:(?:${H}:){7}${H}|(?:${H}:){1,7}:(?:${H}(?::${H}){0,6})?|::(?:${H}(?::${H}){0,6}))(?:%[\\w.]+)?\\]?(?![\\w:])`, "g");
const stripAddresses = (s) => String(s)
  .replace(ADDRESS, () => localize("doc-clean.mail.address_withheld", "[address withheld]"))
  .replace(IPV6, () => localize("doc-clean.mail.network_address_withheld", "[network address withheld]"))
  .replace(IPV4, () => localize("doc-clean.mail.network_address_withheld", "[network address withheld]"));

/* The display names of an address list: each entry's name part, never its address. */
function namesOf(list) {
  if (list == null) return [];
  const out = [];
  let cur = "", quoted = false, angle = 0;
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (const ch of String(list)) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") angle++;
    else if (!quoted && ch === ">") angle = Math.max(0, angle - 1);
    if (ch === "," && !quoted && !angle) flush(); else cur += ch;
  }
  flush();
  return out.map((e) => {
    const m = /^(.*?)<[^>]*>\s*$/s.exec(e);
    let name = (m ? m[1] : e).trim().replace(/^"(.*)"$/s, "$1").replace(/\\(.)/g, "$1").trim();
    if (!m || ADDRESS.test(name)) name = "";
    ADDRESS.lastIndex = 0;
    return oneLine(name);
  });
}

function displayed(list, material) {
  const names = namesOf(list);
  if (!names.length) return null;
  return names.map((n) => (n && material.has(n.toLowerCase()) ? n : withheld())).join(", ");
}

/* RFC 2047 for a header value with a non-ASCII character; the value is one line. */
function headerValue(s) {
  const v = oneLine(s);
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  return `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

const b64 = (bytes) => Buffer.from(bytes).toString("base64").replace(/.{76}/g, "$&\r\n");
const safeName = (s) => stripAddresses(oneLine(s ?? "")).replace(/["\\]/g, "_");
const safeType = (s) => (/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(String(s ?? "")) ? String(s) : "application/octet-stream");

/** The published copy of a message: `{clean, bytes, images}`. `cleanOne(bytes)` is `cleanDocument` for an
 *  attachment. Refuses by name (a `CleanRefusal`) when the message or an attachment cannot be cleaned whole. */
export async function cleanMessage(bytes, materialNames, cleanOne) {
  const material = new Set(materialNames.map((n) => oneLine(n).toLowerCase()));
  const r = await readMessage(bytes);
  if (!r.ok) throw new CleanRefusal("DOCUMENT_UNREADABLE", r.detail);
  const images = { stripped: 0, unchanged: 0 };
  const parts = [];
  for (const a of r.attachments) {
    const cut = await attachmentBytes(bytes, a.index);
    if (!cut.ok) throw new CleanRefusal("DOCUMENT_UNREADABLE", localize("doc-clean.mail.attachment_index_cannot_be_cut", "attachment {index} of the message cannot be cut: {detail}", { index: String(a.index), detail: String(cut.detail) }));
    const done = await cleanOne(cut.bytes);
    if (!done.ok) throw new CleanRefusal(done.code, localize("doc-clean.mail.attachment_index_detail", "attachment {index}: {detail}", { index: String(a.index), detail: String(done.detail) }));
    if (done.clean) images.unchanged += 0; else { images.stripped += done.images.stripped; images.unchanged += done.images.unchanged; }
    parts.push({ name: safeName(a.name_stated) || `attachment-${a.index + 1}`, type: safeType(a.type_stated), bytes: done.clean ? cut.bytes : done.bytes });
  }
  const h = r.headers;
  const lines = [];
  const from = displayed(h.from, material), to = displayed(h.to, material), cc = displayed(h.cc, material);
  if (from) lines.push(`From: ${headerValue(from)}`);
  if (to) lines.push(`To: ${headerValue(to)}`);
  if (cc) lines.push(`Cc: ${headerValue(cc)}`);
  if (h.date != null) lines.push(`Date: ${headerValue(stripAddresses(h.date))}`);
  if (h.subject != null) lines.push(`Subject: ${headerValue(stripAddresses(h.subject))}`);
  lines.push("MIME-Version: 1.0");
  const text = enc.encode(stripAddresses(r.body?.text ?? ""));
  const chunks = [];
  if (!parts.length) {
    chunks.push(`${lines.join("\r\n")}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(text)}\r\n`);
  } else {
    let n = 0, boundary;
    do { boundary = `=_doc-clean-${n++}`; } while (parts.some((p) => Buffer.from(p.bytes).toString("base64").includes(boundary)));
    chunks.push(`${lines.join("\r\n")}\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`);
    chunks.push(`--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(text)}\r\n`);
    for (const p of parts)
      chunks.push(`--${boundary}\r\nContent-Type: ${p.type}; name="${p.name}"\r\nContent-Disposition: attachment; filename="${p.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(p.bytes)}\r\n`);
    chunks.push(`--${boundary}--\r\n`);
  }
  const out = enc.encode(chunks.join(""));
  const same = out.length === bytes.length && out.every((b, i) => b === bytes[i]);
  return same ? { clean: true } : { clean: false, bytes: out, images };
}
