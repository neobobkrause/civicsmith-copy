/* screens-intake-rounds: the parts the intake screens draw for the T53 lines (R72-R94), split by copy from screens-intake (5 Nov 2026).
 *
 * The screens themselves (`capture`, `held`, `open-file`, `archive`, `inbox`, `about-knocker`) are screens-intake's, in
 * bio-plane/src/screens-intake/; this module holds the parts they draw for these lines, and each screen lists the part among
 * its own `parts` (interface-shell R21) to draw it. That listing is screens-intake's hook, never edited here.
 *
 * Every function is self-contained (interface-shell R21 (1)): it refers only to its parameters, the kit `cs` and the
 * language's own globals, so the shell can compose it into the page's one script and the same function runs in node for the
 * tests. Words by key (screens-intake R26): no member-facing English here; every sentence is `cs.w(key, vars)`. Each part
 * answers "" when it has nothing to draw, and never throws on a malformed answer. */

/** R81 (DEC-473; A4-R3): "Left out of the safe picture: {what}." with `{what}` built from a picture's `left_out` kinds, each
 *  read by `screen.photo.dropped.<kind>` and joined in a list. `leftOut` is A4-R3's list, of `{kind, count, bytes}` entries
 *  (a bare kind string is read too). A kind outside the closed set is never drawn, and a kind is named once however many
 *  entries carry it; the camera's make and serial number are read into the record and are not a kind here. "" when no kind
 *  of the set is left out. `cs.lang`, when the kit names one, is the language the list is joined in. */
export function leftOutLine(cs, leftOut) {
  const KINDS = ["thumbnail", "maker_note", "profile", "extra_picture", "after_end", "xmp", "credentials", "other_metadata", "unreadable"];
  const seen = [];
  for (const e of Array.isArray(leftOut) ? leftOut : []) {
    const kind = typeof e === "string" ? e : e && typeof e === "object" ? e.kind : null;
    if (typeof kind === "string" && KINDS.includes(kind) && !seen.includes(kind)) seen.push(kind);
  }
  if (!seen.length) return "";
  const phrases = seen.map((k) => cs.w("screen.photo.dropped." + k));
  let what;
  try { what = new Intl.ListFormat(typeof cs.lang === "string" && cs.lang ? cs.lang : "en", { style: "long", type: "conjunction" }).format(phrases); }
  catch { what = phrases.join(", "); }
  return cs.w("screen.photo.dropped", { what });
}

/** R82 (DEC-467), its count line: for a mailbox, "{n} messages: {read} read, {held} kept but not read yet, {refused} not
 *  kept." (`screen.archive.mailbox.count`). `counts` is `{n, read, held, refused}`, each a whole number of messages; "" for
 *  anything else (an archive that is not a mailbox carries none). */
export function mailboxCountLine(cs, counts) {
  const c = counts && typeof counts === "object" ? counts : null;
  const whole = (v) => Number.isInteger(v) && v >= 0;
  if (!c || !whole(c.n) || !whole(c.read) || !whole(c.held) || !whole(c.refused)) return "";
  return cs.w("screen.archive.mailbox.count", { n: String(c.n), read: String(c.read), held: String(c.held), refused: String(c.refused) });
}

/** R78: a size as the member reads it, in MB from 1 MB up (GB from 1 GB, KB below 1 MB, `size.small` below 1 KB), never a
 *  byte count. "" when `n` is not a size. */
export function sizeWords(cs, n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return cs.w("size.small");
  if (n < 1048576) return cs.w("size.kb", { n: String(Math.round(n / 1024)) });
  if (n < 1073741824) return cs.w("size.mb", { n: String(Math.round(n / 1048576)) });
  return cs.w("size.gb", { n: String(Math.round(n / 107374182.4) / 10) });
}

/** R78 (DEC-454): the line of a step of the reading or of a parted upload, by its own key. `step` is one of `fetching`,
 *  `reading`, `about` (with `minutes`, a whole number above zero; one minute is `.about.one`), `hashing` and `sending` (with
 *  `n` of `m` parts). "" for a step that has no row of its own. The queued state is screens-intake's (capture.mjs draws
 *  `screen.capture.read.queued` from the job row; BOB, 7 Nov). */
export function stepLine(cs, step) {
  const s = step && typeof step === "object" ? step : { step };
  const whole = (v) => Number.isInteger(v) && v > 0;
  switch (s.step) {
    case "fetching": return cs.w("screen.capture.read.fetching");
    case "reading": return cs.w("screen.capture.read.reading");
    case "about": return !whole(s.minutes) ? "" : s.minutes === 1 ? cs.w("screen.capture.read.about.one") : cs.w("screen.capture.read.about", { minutes: String(s.minutes) });
    case "hashing": return cs.w("screen.capture.file.parts.hashing");
    case "sending": return whole(s.n) && whole(s.m) && s.n <= s.m ? cs.w("screen.capture.file.parts.sending", { n: String(s.n), m: String(s.m) }) : "";
    default: return "";
  }
}

/** R78 (DEC-454): the reading's refusal by its code, with its own figures: `ENCRYPTED`; `TOO_LARGE {size, bound}` in MB;
 *  `STRUCTURE_OVER_BOUND {part, bound}`; `ENCODING_UNSUPPORTED {name}`. "" for another code, or a refusal missing a figure
 *  its sentence names (it is never drawn with a hole). A sentence a reading stored is the reading's, not drawn here. */
export function readRefusedLine(cs, refusal) {
  const r = refusal && typeof refusal === "object" ? refusal : {};
  const code = typeof r.code === "string" ? r.code : "";
  const sz = (n) => {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return cs.w("size.small");
    if (n < 1048576) return cs.w("size.kb", { n: String(Math.round(n / 1024)) });
    if (n < 1073741824) return cs.w("size.mb", { n: String(Math.round(n / 1048576)) });
    return cs.w("size.gb", { n: String(Math.round(n / 107374182.4) / 10) });
  };
  const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const key = "screen.capture.read.refused." + code;
  if (code === "ENCRYPTED") return cs.w(key);
  if (code === "TOO_LARGE") return sz(r.size) && sz(r.bound) ? cs.w(key, { size: sz(r.size), bound: sz(r.bound) }) : "";
  if (code === "STRUCTURE_OVER_BOUND") {
    const bound = Number.isFinite(r.bound) ? String(r.bound) : text(r.bound);
    return text(r.part) && bound ? cs.w(key, { part: text(r.part), bound }) : "";
  }
  if (code === "ENCODING_UNSUPPORTED") return text(r.name) ? cs.w(key, { name: text(r.name) }) : "";
  return "";
}

/** R78 (DEC-454): the upload ceiling's figures, `screen.capture.refusal.upload.TOO_LARGE.figures`, the file's size and the
 *  ceiling in MB. "" when either figure is missing. */
export function uploadTooLargeLine(cs, refusal) {
  const r = refusal && typeof refusal === "object" ? refusal : {};
  const sz = (n) => {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return cs.w("size.small");
    if (n < 1048576) return cs.w("size.kb", { n: String(Math.round(n / 1024)) });
    if (n < 1073741824) return cs.w("size.mb", { n: String(Math.round(n / 1048576)) });
    return cs.w("size.gb", { n: String(Math.round(n / 107374182.4) / 10) });
  };
  return sz(r.size) && sz(r.bound) ? cs.w("screen.capture.refusal.upload.TOO_LARGE.figures", { size: sz(r.size), bound: sz(r.bound) }) : "";
}

/** R78 (DEC-454): finishing a capture, by its state: `pending`, `files` (nothing new: the page was already captured) or
 *  `done` (with the visitor copy's `title`). "" for another state, or `done` with no title. */
export function finishLine(cs, finish) {
  const f = finish && typeof finish === "object" ? finish : {};
  if (f.state === "pending") return cs.w("screen.capture.finish.pending");
  if (f.state === "files") return cs.w("screen.capture.finish.files");
  if (f.state === "done" && typeof f.title === "string" && f.title.trim()) return cs.w("screen.capture.finish.done", { title: cs.esc ? cs.esc(f.title.trim()) : f.title.trim() });
  return "";
}

/** R78 (DEC-454): an address the team already holds, by whether its copy has been read (`read: true`) or not (`false`). ""
 *  when the answer does not say. */
export function addressHeldLine(cs, held) {
  const h = held && typeof held === "object" ? held : {};
  if (h.read === true) return cs.w("screen.capture.address.reading.done");
  if (h.read === false) return cs.w("screen.capture.address.reading.pending");
  return "";
}

/** R79 (DEC-455): a preview cut at a row, "Showing rows 1 to {shown} of {total}." (`screen.capture.preview.cut`); "" for a
 *  preview that is not cut (`shown` at or past `total`) or that states no figures. */
export function previewCutLine(cs, preview) {
  const p = preview && typeof preview === "object" ? preview : {};
  const whole = (v) => Number.isInteger(v) && v > 0;
  if (!whole(p.shown) || !whole(p.total) || p.shown >= p.total) return "";
  return cs.w("screen.capture.preview.cut", { shown: p.shown.toLocaleString("en-US"), total: p.total.toLocaleString("en-US") });
}

/** R79 (DEC-455): a long document's safe view, "This shows the first {pages} of the document's {source_pages} pages."
 *  (`file-safety.index.safe_view_first_pages`); "" when the view shows every page or states no figures. */
export function safeViewPagesLine(cs, view) {
  const v = view && typeof view === "object" ? view : {};
  const whole = (n) => Number.isInteger(n) && n > 0;
  if (!whole(v.pages) || !whole(v.source_pages) || v.pages >= v.source_pages) return "";
  return cs.w("file-safety.index.safe_view_first_pages", { pages: v.pages.toLocaleString("en-US"), source_pages: v.source_pages.toLocaleString("en-US") });
}

/* The keys these parts read, for a screen that lists a part to add to its `words` (screens-intake R26). */
export const PART_KEYS = Object.freeze({
  leftOutLine: Object.freeze(["screen.photo.dropped", ...["thumbnail", "maker_note", "profile", "extra_picture", "after_end", "xmp", "credentials", "other_metadata", "unreadable"].map((k) => "screen.photo.dropped." + k)]),
  mailboxCountLine: Object.freeze(["screen.archive.mailbox.count"]),
  sizeWords: Object.freeze(["size.small", "size.kb", "size.mb", "size.gb"]),
  stepLine: Object.freeze(["screen.capture.read.fetching", "screen.capture.read.reading", "screen.capture.read.about", "screen.capture.read.about.one",
    "screen.capture.file.parts.hashing", "screen.capture.file.parts.sending"]),
  readRefusedLine: Object.freeze(["ENCRYPTED", "TOO_LARGE", "STRUCTURE_OVER_BOUND", "ENCODING_UNSUPPORTED"].map((c) => "screen.capture.read.refused." + c)
    .concat(["size.small", "size.kb", "size.mb", "size.gb"])),
  uploadTooLargeLine: Object.freeze(["screen.capture.refusal.upload.TOO_LARGE.figures", "size.small", "size.kb", "size.mb", "size.gb"]),
  finishLine: Object.freeze(["screen.capture.finish.pending", "screen.capture.finish.files", "screen.capture.finish.done"]),
  addressHeldLine: Object.freeze(["screen.capture.address.reading.pending", "screen.capture.address.reading.done"]),
  previewCutLine: Object.freeze(["screen.capture.preview.cut"]),
  safeViewPagesLine: Object.freeze(["file-safety.index.safe_view_first_pages"]),
});
