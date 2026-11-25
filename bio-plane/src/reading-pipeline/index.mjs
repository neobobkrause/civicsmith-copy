/* reading-pipeline (R1–R35): a capture's reading from its stored bytes, for `extraction`, which stores it. The tier
   ladder, the chain composed as it goes, the content type's reader over the text, and the reading with its
   provenance, its container, its dialect and its text units; and the pieces of it `extraction`'s re-read (its
   R31–R35) composes (R23). Split from `extraction` by N513 with no change of meaning (its `pipeline.mjs`, which it
   took from the plane's old `index.mjs`), with the reasons kept where the reason is the code's; the rows applied here
   are named at their sites. It is pure: no record, no table, no catalogue row. It fetches nothing about the source:
   the bytes come from the evidence store the caller hands in (R24), and tiers 2 and 3 are reached only through their
   bindings with the capture's digest (R16). R32 (T49) gives text read as text through no format entry its text units
   (`textUnitsOfText`; R33, T50: a text with no blank line split at its line breaks), R34 (T50) its `title`. T33-23 adds the opt-in after-read hook (R25–R27, `hooks.mjs`), which
   `read` never reaches. R37 (fix round 4b): a failed reading says whether its cause is `transient` or `final`; the units
   budget binds the acquire answer only; OCR past its per-request pages states its cursor and owes the rest; a whole above
   what the object can hold is never loaded. G68 (fix round 7): a piece after the first of a text or a CSV is read from the
   byte window of the object its cursor names, not from the whole object (R40, `textWindowTick`, `csvWindowTick`), and a PDF
   read in page ranges is kept open between its pieces (pdf-reader's `openPdfRange`, R44; G82: with the turn given back, R45). */
import { layerChain, appendStep, describeChain, checkChain, checkAnchor, applyConfidenceFloor, mergedChain,
         convertedChain, readingSource, mergeTier2Text, tier2Note, glyphCount, stepCovers } from "../textchain.mjs";
import { getFormat, readingDialect, detectFormat } from "../formats.mjs";
import { identify, doctypeFor, doctypeForYielding, readText } from "../../../docprofile/registry.mjs";
import { driveConvertStep } from "../drive.mjs";
import { extractPdfRange, openPdfRange } from "../pdfstructure.mjs";
import { readingProvenance, describePages, yieldNow } from "./readingprov.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf, statement } from "../read-bounds.mjs";
import { decodeText } from "../ooxml.mjs";
import { decodeReferences, visibleTextOfHtml, visibleTextOfHtmlYielding, visibleTextOfHtmlStream } from "./html.mjs";

export { visibleTextOfHtml };

export { readingProvenance, compareProvenance, describePages, PROVENANCE_SCHEME } from "./readingprov.mjs";
export { ReadHooks, readHooksOf } from "./hooks.mjs";

/* ===================================================================== *
 * The bounds (R15).
 * ===================================================================== */

/* REC-91: how much of a capture's text the reading's wire answer may carry. Half of `op=promote`'s INLINE_MAX
   (1 MiB), so JSON escaping and the rest of the acquire document cannot push a promotion over it. */
export const ACQUIRE_TEXT_UNITS_BUDGET = 512 * 1024;
/* What one unit costs the wire BESIDE its text: its extent, its seq and its keys as a caller serialising with
   `JSON.stringify(doc, null, 1)` spends them. Charged per unit, so twenty thousand short paragraphs cannot pass the
   byte budget on their words and blow INLINE_MAX on their punctuation. The smallest chargeable unit is 1 + 128 B, so
   this wire emits at most floor(524288 / 129) = 4,064 units: under the index's own unit bound (extraction R22's 4,096), which
   is why no second unit check sits in the loop (REC-111). */
export const ACQUIRE_TEXT_UNIT_ENVELOPE = 128;
/* CONTENT-SEARCH-DESIGN §4.3: one indexed unit's text is stored to this many characters (M-20: 6.2x the largest
   unit its census produced). The wire cuts a unit to it before charging it (D-685), and the index writer caps at the
   same number (extraction R22): one number, so the wire never pays for text the index discards. */
export const CAPTURE_TEXT_UNIT_CAP = 128 * 1024;
/* R2: a multi-part capture (streamed in 8 MiB parts, the whole never stored under its own digest) is assembled for
   its format entry only up to this many bytes: the office entries' measured text bound (M-20's 20 MiB, `ooxml.mjs`),
   which every entry in the registry guards at or under. Over it the capture is not read, and the reading says so. G124 (fix round 9):
   quoted from `READ_BOUNDS`, the office text row (its alpha, the measured 20 MiB), never a literal here. */
export const MULTIPART_READ_MAX = boundOf("office", "text_bytes");
/* R37 (fix round 4b, F10; K4487): the largest whole the object holds to read, measured under workerd with the object's
   128 MB (build/jobs/T51/cause-reading-4.md, step 0): the reading's heap grows with the pages (about 25 MB + 0.031 MB a
   page), and the whole's bytes sit beside it. A whole over this is never loaded: the reading is `final` and says its size. G124 (fix
   round 9): quoted from `READ_BOUNDS`, the PDF byte row (its alpha, today's 24 MiB, K4831 (3)); a refusal states it with the size
   (`statement`). */
export const WHOLE_READ_MAX = boundOf("pdf", "bytes");
const WHOLE_READ_ROW = ["pdf", "bytes"];
/* R37 (D4): why a reading failed, as `reading.failure`. `transient`: the cause is outside the document (the store did not
   answer, a member was down or answered 5xx, an entry threw), so a later read can succeed; `final`: the document's own
   content, or its size, so reading it again cannot. A reading that is not a failed one carries neither. */
export const FAILURE_TRANSIENT = "transient";
export const FAILURE_FINAL = "final";
/* R28, R44 (fix round 6, G41; K4636, K4642): the most a workbook's or a CSV's typed cells may weigh in the reading, as the entry's
   own JSON of them, before the entry holds them in the file instead (`cells` null, `cells_held` true). The cap is OPT-IN: `read`
   passes it where it calls an entry (`{inlineCellsMax}`), and an entry called without it lists every cell. 512 KiB is about
   3,500 cells, leaving the reading's other keys room under the 1 MiB a stored reading may hold. */
export const INLINE_CELLS_MAX_BYTES = 512 * 1024;
/* R44: the reasons `cellsInRange` answers when it makes no cells. */
export const CELLS_NOT_INTERPRETABLE = "cells_not_interpretable";
export const BYTES_NOT_HELD = "bytes_not_held";

/* ===================================================================== *
 * Tier 2 (R3).
 * ===================================================================== */

/* D-665 (BOB #35, 2026-09-25 06:25Z): `image_unread` says an image is painted and its content unread; it is not an
   undecoded character and counts 0. Two readers judge the DECODE by the marker count (`needsTier2` and docprofile's
   `readText`), so both are handed the text with those markers taken out and the count lowered by as many. The
   markers stay on the text itself. N253 (R3, R11): pdf-reader emits one per painted image (its R34), so without this
   a photo page would escalate to tier 2, which reads no image. */
export function decodeView(text) {
  const marks = text && Array.isArray(text.undetermined) ? text.undetermined : null;
  if (!marks || !marks.some((m) => m && m.reason === "image_unread")) return text;
  const keep = (a) => (Array.isArray(a) ? a.filter((m) => !(m && m.reason === "image_unread")) : a);
  const undetermined = keep(marks);
  const c = text.counts;
  return { ...text, undetermined,
           ...(Array.isArray(text.pages) ? { pages: text.pages.map((p) => (p ? { ...p, undetermined: keep(p.undetermined) } : p)) } : {}),
           ...(c && typeof c.undetermined === "number"
             ? { counts: { ...c, undetermined: c.undetermined - (marks.length - undetermined.length) } } : {}) };
}

/* R3: a PDF escalates to the pdf-worker only when tier 1 got essentially nothing: more undetermined regions than
   glyphs of the text in hand (D-514: glyphs, never raw characters; `counts.chars` only when there is no document
   string), unless every marker is a scan marker, since tier 2 reads no image (CPDF-10; D-627's image-content
   markers are scan markers too). A mixed document still escalates. A missing or malformed text escalates nothing. */
/* The reading's memory (R2): a PDF's `document` is its pages' non-empty text joined by a newline (pdf-reader R2), held
   as a lazily-joined string until something reads it, and reading it makes a second flat copy of the whole book (two
   bytes a character once one page holds a character past U+00FF). When the pages are held beside it and the document's
   length is exactly theirs joined, the glyphs are counted over the pages and the document is never read. */
function pagesJoinLength(text) {
  const pages = text && Array.isArray(text.pages) ? text.pages : null;
  if (!pages || !pages.length || typeof text.document !== "string") return false;
  let n = 0, held = 0;
  for (const p of pages) {
    const t = p && typeof p.text === "string" ? p.text : "";
    if (t.length) { n += t.length; held++; }
  }
  return held > 0 && n + held - 1 === text.document.length;
}
export function glyphsOfDocument(text) {
  if (!text || typeof text.document !== "string") return null;
  return pagesJoinLength(text) ? text.pages.reduce((n, p) => n + (p && typeof p.text === "string" ? glyphCount(p.text) : 0), 0)
                               : glyphCount(text.document);
}
/* The same text without the joined copy, for the stages that read it whole (`docprofile.readText` joins the pages
   itself when the document is absent, R38), or the text itself when its document is not the pages joined. */
export function withoutJoinedDocument(text) {
  if (!pagesJoinLength(text)) return text;
  const { document, ...rest } = text;
  return rest;
}
export function needsTier2(text0) {
  const text = decodeView(text0);
  const c = text && text.counts;
  if (!c || typeof c.chars !== "number" || typeof c.undetermined !== "number") return false;
  const glyphs = typeof text.document === "string" ? glyphsOfDocument(text) : c.chars;
  if (!(c.undetermined > glyphs)) return false;
  const marks = Array.isArray(text.undetermined) ? text.undetermined : [];
  if (marks.length && marks.every((m) => m && (m.reason === "no_text_layer"
      || m.reason === "image_content_unread" || m.reason === "image_content_undetermined"))) return false;
  return true;
}

/* D-697 (R8, N253): a page tier 2 wins keeps a still-true `image_unread`. That is text-chain's `mergeTier2Text` (its
   R90), which carries each such marker after tier 2's own; this module no longer re-carries them. */

/* One tier-2 escalation, as both paths run it (R3). `text` is tier 1's I2 text. Answers `{outcome, text, replaced,
   kept, perPage, note, memberNotes}`. `outcome`: "not_needed" (tier 1 did not get essentially nothing), "unbound"
   (no member), "unavailable" (the binding threw), "no_improvement" (the member answered and could not help),
   "merged" (the merge ran: `text` is the merged text, tier 1's where no page moved, `note` the merge's own), or
   "refused" (the merge refused: tier 1 stands, `note` its reason). `memberNotes` are the member's own notes.
   `transient` is true when the member was down (the binding threw, an answer that is not JSON) or answered 5xx (R37). */
export async function tier2Escalate(env, { sha, storeName, text, from, count }) {
  const out = { outcome: "not_needed", text, replaced: [], kept: [], perPage: null, note: null, memberNotes: [] };
  if (!needsTier2(text)) return out;
  if (!(env && env.PDF_WORKER)) { out.outcome = "unbound"; return out; }
  try {
    const r = await env.PDF_WORKER.fetch("https://pdf-worker/structure", {
      method: "POST", headers: { "content-type": "application/json" },
      /* K4861 (pdf-worker R42): the range the reading is on, so tier 2 decodes those pages and not the document */
      body: JSON.stringify({ capture_sha: sha, store: storeName,
                             ...(natural(from) && natural(count) ? { from, count } : {}) }),
    });
    if (r.status >= 500) out.transient = true;
    const t2 = await r.json();
    if (!(r.ok && t2 && t2.ok && t2.text)) { out.outcome = "no_improvement"; return out; }
    out.memberNotes = (Array.isArray(t2.notes) ? t2.notes : []).filter((n) => typeof n === "string");
    const m = mergeTier2Text(text, t2.text);
    if (m.ok) {
      /* D-251: who made the layer is a fact about the FILE; the member returns no `producer`, so tier 1's is
         carried when the member supplied none. */
      out.outcome = "merged";
      out.text = (text && text.producer && !m.text.producer) ? { ...m.text, producer: text.producer } : m.text;
      out.replaced = m.replaced; out.kept = m.kept || [];
      out.perPage = m.perPageTier || null;
      out.note = tier2Note(m) || null;
    } else { out.outcome = "refused"; out.note = m.why || null; }
  } catch { out.outcome = "unavailable"; out.transient = true; }
  return out;
}

/* R62 (fix round 10, cause 9): the notes of a PDF's structure read and of the tier-2 member that say the file was repaired, as the reading lists them:
   `{note: "xref_reconstructed"}`, `{note: "pages_missing", missing, of}` (the structure's `pages_missing:<missing>/<of>`) and `{note: "pdf_truncated"}`
   (pdf-worker R10: the file was cut before its trailer). Every other note is the reader's own and informational; each is listed once. */
export function recoveryNotesOf(...lists) {
  const out = [], seen = new Set();
  for (const list of lists) for (const n of Array.isArray(list) ? list : []) {
    if (typeof n !== "string") continue;
    const m = /^pages_missing:(\d+)\/(\d+)$/.exec(n);
    const entry = n === "xref_reconstructed" || n === "pdf_truncated" ? { note: n } : m ? { note: "pages_missing", missing: Number(m[1]), of: Number(m[2]) } : null;
    if (entry && !seen.has(entry.note)) { seen.add(entry.note); out.push(entry); }
  }
  return out;
}

/* The sentence a reading's basis carries when tier 2 could not help (R3: "the reason is carried"). */
export function tier2FailureNote(failure) {
  /* DEC-149 (T35-24, K1960): on the reading's basis, so it names the group's Civicsmith, never "this instance". */
  return failure === "unbound"
    ? word("reading-pipeline.tier_read_essentially")
    : failure === "no_improvement"
      ? word("reading-pipeline.tier_read_essentially_nothing")
      : failure === "unavailable"
        ? word("reading-pipeline.tier_read_essentially_nothing_document")
        : null;
}

/* ===================================================================== *
 * The chain of a text layer (R10).
 * ===================================================================== */

/* CPDF-10: a text layer is itself an unverified transcription (CPDF-9 measured ABBYY FineReader in 3 of 14 recent
   Legistar attachments), so its fidelity is NULL: undetermined, stated. No letter is invented for it. */
export const LAYER_FIDELITY_CAP = null;
export const LAYER_FIDELITY_SOURCE = "unmeasured: a text layer is itself an unverified transcription "
                            + "(CPDF-9, the MEASUREMENTS ledger 2026-08-03)";
/* D-251: a layer whose /Info names OCR software gains `ocr(<product>)`, the engine NAMED from the document's own
   bytes and its cap NULL: somebody else's engine, run at a quality nobody here measured. */
export const NAMED_ENGINE_CAP = null;
export const NAMED_ENGINE_SOURCE = "unmeasured: the engine is NAMED by the document's own /Info producer "
                          + "metadata (D-251; CPDF-9, the MEASUREMENTS ledger 2026-08-03), and no "
                          + "calibration of it exists here (CPDF-13)";

/* R10: `layerChain` at the tier, cap undetermined and the reason stated, extended by `ocr(<product>)` when the
   producer marker names OCR software; a refused append keeps the base chain. */
export function layerChainFor(i2text, { tier, container }) {
  const base = layerChain({ tier, container, cap: LAYER_FIDELITY_CAP, measured_by: LAYER_FIDELITY_SOURCE });
  const p = i2text && i2text.producer;
  if (!p || p.determination !== "ocr") return base;
  const engine = p.ocr && typeof p.ocr.engine === "string" ? p.ocr.engine.trim() : "";
  if (!engine) return base;
  const ext = appendStep(base, {
    step: "ocr", engine, version: null, field: p.ocr.field, marker: p.ocr.marker,
    cap: NAMED_ENGINE_CAP, measured_by: NAMED_ENGINE_SOURCE,
  });
  return Array.isArray(ext) ? ext : base;
}

/* ===================================================================== *
 * Tier 3 (R4–R9, extraction R35).
 * ===================================================================== */

/* R4: the markers that select a page for OCR. `no_text_layer` (a scan) and D-627's `image_content_unread` (an
   image fills the page and its text is a folio). `image_content_undetermined` and D-665's per-image `image_unread`
   route nothing: no measured signal separates a chart under a title from a photo page (M-182). */
export const TIER3_REASONS = Object.freeze(["no_text_layer", "image_content_unread"]);

/* R4: a document is a candidate when a page carries a selecting marker and none carries `encrypted`. */
export function needsTier3(text) {
  const marks = (text && Array.isArray(text.undetermined)) ? text.undetermined : [];
  if (marks.some((m) => m && m.reason === "encrypted")) return false;
  return marks.some((m) => m && TIER3_REASONS.includes(m.reason));
}

/* R4: the pages asked for are the selected pages, ascending. */
export function tier3Pages(text) {
  const marks = (text && Array.isArray(text.undetermined)) ? text.undetermined : [];
  if (marks.some((m) => m && m.reason === "encrypted")) return [];
  const pages = [];
  for (const m of marks) {
    if (!m || !TIER3_REASONS.includes(m.reason)) continue;
    if (!Number.isInteger(m.page) || m.page < 0) continue;
    if (!pages.includes(m.page)) pages.push(m.page);
  }
  return pages.sort((a, b) => a - b);
}

/* D-252 / R6–R9: THE MERGE. An OCR pass may fill a page; it may never replace text a page holds.
 *
 * A page the member returns is merged only when it was ASKED FOR (selected) and exists in the base; any other is
 * refused with its own reason (D-614, R9): `no_such_page`, `not_asked`, or `carries_glyphs` (a selected page whose
 * text holds a glyph and that was not routed as a folio page).
 *
 * D-635 (BOB #35, 2026-09-25 06:25Z: APPEND, R7): a selected page routed by `image_content_unread` whose text is only
 * a folio keeps every glyph it held and gains the transcription APPENDED after it; it is listed in both parts. Its
 * routing marker is discharged, its other markers kept, the engine's added.
 *
 * D-697 (R8): a page OCR fills, by replacement or append, discharges `image_unread`: the engine has read its images.
 *
 * D-616 / D-713 (extraction R35): `kept` is the pages an earlier reading of this capture already transcribed, their whole
 * recorded text handed in as the member's answer. A kept page whose recorded text already begins with the page's
 * layer text is taken as recorded, never appended again, so a folio page re-read keeps ONE copy of its folio.
 *
 * A base with no usable per-page text takes the OCR answer whole only when it holds no glyph; otherwise the answer is
 * refused and the base stands (R6). */
export function mergeTier3Text(base, ocr, eligible, { kept = [] } = {}) {
  const basePages = (base && Array.isArray(base.pages)) ? base.pages : [];
  const usable = basePages.filter((p) => p && Number.isInteger(p.page));
  const ocrPages = (ocr && Array.isArray(ocr.pages)) ? ocr.pages : [];
  const wanted = new Set(eligible);
  const keptSet = new Set(kept);

  if (!usable.length) {
    const baseText = (typeof (base && base.document) === "string") ? base.document : null;
    const baseGlyphs = baseText === null ? null : glyphCount(baseText);
    const reported = (base && base.counts && Number.isFinite(base.counts.chars)) ? base.counts.chars : 0;
    if (baseGlyphs === null ? reported > 0 : baseGlyphs > 0)
      return { ok: false, filled: [], appended: [], refused: [], refusedWhy: [], unanswered: [],
               why: word("reading-pipeline.why.document_text_merged", { base_glyphs: String(baseGlyphs === null
                        ? localize("reading-pipeline.index.reported_characters", "{reported} character(s) its producer counted and no text this merge can read", { reported: String(reported) })
                        : localize("reading-pipeline.index.decoded_glyphs", "{glyphs} decoded glyph(s)", { glyphs: String(baseGlyphs) })) }) };
    return { ok: true, text: ocr, filled: ocrPages.map((p) => p.page).filter(Number.isInteger),
             appended: [], refused: [], refusedWhy: [], unanswered: [], wholesale: true };
  }

  const byPage = new Map();
  const refusedWhy = [];
  const isFolioRouted = (b) => (Array.isArray(b.undetermined) ? b.undetermined : [])
    .some((u) => u && u.reason === "image_content_unread");
  for (const p of ocrPages) {
    if (!p || !Number.isInteger(p.page)) continue;
    const target = usable.find((b) => b.page === p.page);
    if (!target) { refusedWhy.push({ page: p.page, reason: "no_such_page" }); continue; }
    if (!wanted.has(p.page)) { refusedWhy.push({ page: p.page, reason: "not_asked" }); continue; }
    const empty = !(typeof target.text === "string" && glyphCount(target.text) > 0);
    if (!empty && !isFolioRouted(target)) { refusedWhy.push({ page: p.page, reason: "carries_glyphs" }); continue; }
    byPage.set(p.page, { ocr: p, append: !empty });
  }

  const discharged = (u) => u && (TIER3_REASONS.includes(u.reason) || u.reason === "image_unread");
  const filled = [], appended = [], pages = [], undetermined = [];
  for (const b of usable) {
    const hit = byPage.get(b.page);
    const got = hit && hit.ocr;
    const said = got && typeof got.text === "string" ? got.text : "";
    const fromOcr = got && Array.isArray(got.undetermined) ? got.undetermined : [];
    if (got && hit.append) {
      filled.push(b.page); appended.push(b.page);
      const already = keptSet.has(b.page) && said.startsWith(b.text);
      pages.push({ ...b, text: already ? said : (said.length ? `${b.text}\n${said}` : b.text),
                   ...(got.unread_words ? { unread_words: got.unread_words } : {}),
                   undetermined: [...(Array.isArray(b.undetermined) ? b.undetermined : []).filter((u) => !discharged(u)),
                                  ...fromOcr] });
    } else if (got) {
      filled.push(b.page);
      pages.push({ page: b.page, text: said, undetermined: fromOcr,
                   ...(got.unread_words ? { unread_words: got.unread_words } : {}) });
    } else {
      pages.push(b);
    }
    for (const u of pages[pages.length - 1].undetermined || []) undetermined.push(u);
  }
  const unanswered = eligible.filter((p) => !filled.includes(p));
  const document = pages.map((p) => p.text).filter((t) => typeof t === "string" && t.length).join("\n");
  const regions = (ocr && Array.isArray(ocr.regions))
    ? ocr.regions.filter((r) => r && r.source && filled.includes(r.source.page)) : [];
  const text = { ...base, document, pages, undetermined,
                 counts: { chars: document.length, undetermined: undetermined.length } };
  if (regions.length) text.regions = regions;
  return { ok: true, text, filled, appended, refused: refusedWhy.map((r) => r.page), refusedWhy, unanswered,
           wholesale: false };
}

const REFUSAL_SAYS = {
  no_such_page: word("reading-pipeline.document_page"),
  not_asked: word("reading-pipeline.ocr_member_asked"),
  carries_glyphs: word("reading-pipeline.already_carries_text"),
};

/* R9 (D-614, D-607, D-635): what the merge did, in the record's own sentence. Each refused page with its own
   reason; the kept-text clause only when a page kept text (`layerPages`, the pages carrying a glyph that were not
   filled); the appended pages said; null when there is nothing to say. Pages are numbered from 1. */
export function tier3Note(m, memberNote, layerPages) {
  const say = [];
  const kept = Array.isArray(layerPages) ? layerPages.length : 0;
  /* K4909: `filled` is the pages the OCR member answered (R29, extraction read it); the member is told only of the pages whose text gained a glyph, and of the ones
     answered with none (every region below its floor) that text recognition could not read */
  const gainedAt = new Set((m.text && Array.isArray(m.text.pages) ? m.text.pages : []).filter((p) => p && typeof p.text === "string" && glyphCount(p.text) > 0).map((p) => p.page));
  const gained = (m.filled || []).filter((p) => gainedAt.has(p));
  const answeredEmpty = (m.filled || []).filter((p) => !gainedAt.has(p));
  if (!m.wholesale && gained.length)
    say.push(word("reading-pipeline.scanned_page_transcribed", { filled: String(gained.length), kept: String(kept ? word("reading-pipeline.already_text_kept", { kept: kept === 1 ? "page" : "pages" }) : "") }));
  if (!m.wholesale && answeredEmpty.length)
    say.push(localize("reading-pipeline.index.pages_not_read_text_recognition", "{count} page(s) ({pages}) could not be read by text recognition", { count: String(answeredEmpty.length), pages: String(describePages(answeredEmpty)) }));
  if (!m.wholesale && Array.isArray(m.appended) && m.appended.length)
    say.push(word("reading-pipeline.page_already_held", { appended: String(m.appended.length), appended_2: String(m.appended.length === 1 ? "that page is" : "those pages are") }));
  if (m.unanswered.length)
    say.push(word("reading-pipeline.page_text_layer", { unanswered: String(m.unanswered.length) }));
  const why = Array.isArray(m.refusedWhy) ? m.refusedWhy : [];
  if (why.length)
    say.push(word("reading-pipeline.page_ocr_member", { why: String(why.length), page: String(why.map((r) => `${describePages([r.page])} (${REFUSAL_SAYS[r.reason] || r.reason})`).join(", ")) }));
  if (memberNote) say.push(memberNote);
  return say.length ? say.join("; ") : null;
}

/* D-606 (R4): the member reads one page per invocation and names the rest in `deferred`; the caller loops, one page
   per call, in order, within a budget. Cloudflare states a limit of 32 Worker invocations per request (their claim,
   not measured here; Miniflare does not enforce it, M-175); the reserve of 8 covers the other invocations one
   request can make. Past the budget, after a call that throws, a declined page, a page answered under another
   engine build than the first answer, and a page answered to the wrong call are not merged, and the note names
   them. */
export const OCR_INVOCATIONS_PER_REQUEST = 24;
export const OCR_SAME_PROVENANCE = ["engine", "version", "cap", "measured_by", "confidence_floor"];

/* R55 (fix round 9, G126b; K4811 (6)): `invocations` 0 makes no call at all (the inline pass): every page is left, named in
   `notAsked`. R54 (G125a, G137d): a page the member refuses is named with its reason (`refusedWhy`: the refusal's own, a header's
   `IMAGE_TOO_LARGE` or a legibility floor's `PAGE_NOT_LEGIBLE` among them) and the legibility it stated, and a page answered with
   its legibility carries it. */
const refusalReasonOf = (b) => (b && b.refusal && b.refusal.render && typeof b.refusal.render.reason === "string" ? b.refusal.render.reason
  : b && typeof b.reason === "string" ? b.reason : "DECLINED");
export async function askMemberPerPage(env, { sha, storeName, wantPages, invocations = OCR_INVOCATIONS_PER_REQUEST, stampUnit = null }) {
  if (!(invocations > 0))
    return { status: 200, answer: null, loop: { invocations: 0, asked: 0, notAsked: [...wantPages], threw: null, strays: [], mismatched: [],
                                                refused: [], refusedWhy: [], down: [], legibility: {} } };
  /* R59 (fix round 9, G165; K4980): the plane's `stampUnit` is told the page in flight, `"p<page>"`, synchronously before each member
     call (the first call takes the lowest page asked, as the member does), so a kill is charged to that page and not to `whole`.
     A stamp that fails never stops the read: the row is then charged as it was before. */
  const stamp = (page) => {
    if (typeof stampUnit !== "function") return;
    try { stampUnit(`p${page}`); } catch { /* the page stays unstamped */ }
  };
  const call = (pages) => env.OCR_WORKER.fetch("https://ocr-worker/transcribe", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ capture_sha: sha, store: storeName, pages }),
  });
  stamp(wantPages.reduce((a, b) => (b < a ? b : a), Infinity));
  const r = await call(wantPages);
  if (!r.ok) return { status: r.status };
  const first = await r.json();
  const wanted = new Set(wantPages);
  const deferred = (first && Array.isArray(first.deferred) ? first.deferred : [])
    .filter((p) => Number.isInteger(p) && wanted.has(p));
  const answers = [{ asked: null, body: first }];
  const loop = { invocations: 1, asked: 0, notAsked: [], threw: null, strays: [], mismatched: [], refused: [], refusedWhy: [], down: [], legibility: {} };
  for (let i = 0; i < deferred.length; i++) {
    const page = deferred[i];
    if (loop.invocations >= invocations) { loop.notAsked = deferred.slice(i); break; }
    loop.invocations++; loop.asked++;
    try {
      stamp(page);
      const rp = await call([page]);
      if (rp.status >= 500) loop.down.push(page);   /* R37: the member was down for this page; it is owed, not declined */
      const body = rp.ok ? await rp.json() : { ok: false, reason: `HTTP_${rp.status}` };
      answers.push({ asked: page, body });
    } catch {
      loop.threw = { at: page, rest: deferred.slice(i) };
      break;
    }
  }
  for (const a of answers) {
    const page = a.asked != null ? a.asked : (Number.isInteger(a.body && a.body.page) ? a.body.page : wantPages[0]);
    const leg = a.body && a.body.legibility && typeof a.body.legibility === "object" ? a.body.legibility : null;
    if (leg) loop.legibility[page] = leg;
    if (a.body && a.body.ok === true) continue;
    if (loop.down.includes(page)) continue;   /* a 5xx is the member down, owed (R37), never the page's refusal */
    if (answers.length > 1) loop.refused.push(page);   /* the loop's note names the pages after the first; a lone answer's refusal is the member's note */
    loop.refusedWhy.push({ page, reason: refusalReasonOf(a.body) });
  }
  if (answers.length === 1) return { status: r.status, answer: first, loop };
  const ok = answers.filter((a) => a.body && a.body.ok === true);
  if (!ok.length) return { status: r.status, answer: first, loop };
  const lead = ok[0].body;
  const pages = [];
  for (const a of ok) {
    const leg = a.body.legibility && typeof a.body.legibility === "object" ? a.body.legibility : null;
    const own = (Array.isArray(a.body.pages) ? a.body.pages : []).map((p) => (leg && p && !p.legibility ? { ...p, legibility: leg } : p));
    if (a.asked == null) { pages.push(...own); continue; }
    if (OCR_SAME_PROVENANCE.some((k) => a.body[k] !== lead[k])) { loop.mismatched.push(a.asked); continue; }
    for (const p of own) {
      if (p && p.page === a.asked) pages.push(p);
      else loop.strays.push(p && Number.isInteger(p.page) ? p.page : null);
    }
  }
  return { status: r.status, answer: { ...lead, pages, deferred: [] }, loop };
}

/* D-606 (R4): what the loop did not do, naming the pages (numbered from 1). */
export function tier3LoopNote(loop) {
  if (!loop) return null;
  const say = [];
  const named = (ps) => describePages(ps.filter(Number.isInteger));
  if (loop.notAsked.length)
    say.push(localize("reading-pipeline.index.pages_not_asked_request", "{count} of them ({pages}) were not asked for in this request: the OCR member reads one page per call and one request may make at most {limit} such calls here (Cloudflare states a limit of 32 Worker invocations per request — their claim, not measured on this runtime); a re-read (op=pdfstructure&ocr=1) asks for them next",
      { count: String(loop.notAsked.length), pages: String(named(loop.notAsked)), limit: String(OCR_INVOCATIONS_PER_REQUEST) }));
  if (loop.threw)
    say.push(word("reading-pipeline.call_failed_page", { at: String(named([loop.threw.at])), rest: String(loop.threw.rest.length), rest_2: String(named(loop.threw.rest)) }));
  if (loop.refused.length)
    say.push(word("reading-pipeline.ocr_member_declined", { refused: String(loop.refused.length), refused_2: String(named(loop.refused)) }));
  if (loop.mismatched.length)
    say.push(word("reading-pipeline.page_answered_different", { mismatched: String(loop.mismatched.length), mismatched_2: String(named(loop.mismatched)) }));
  if (loop.strays.length)
    say.push(word("reading-pipeline.page_ocr_member_returned", { strays: String(loop.strays.length) }));
  return say.length ? say.join("; ") : null;
}
const withLoopNote = (note, loop) => {
  const extra = tier3LoopNote(loop);
  return extra ? (note ? `${note}; ${extra}` : extra) : note;
};

/* D-616 (extraction R35): the pages a stored reading already transcribed, so a re-read asks the member for the rest and a scan
   longer than one request's budget is read to its tail over successive re-reads. Two sources, each saying one
   thing: the stored CHAIN says which pages a tier-3 part produced and under which build (its `pixels`/`ocr` steps,
   grouped by part); the record's whole per-page UNITS hold the words. A page is kept only when both speak for it:
   a unit with a glyph on a page exactly one tier-3 part covers. Each kept part carries its own chain (the stored
   steps without their stamped extent), so its pages stay under the build that read them.
   R30 (T42; N832, K2611): a part the AI transcribed (`pixels -> ai_transcription`, R29) is seeded by the same rule,
   under its own chain, so a re-read keeps the AI's pages and never asks the OCR member or the AI for them again. */
const TRANSCRIBED = ["ocr", "ai_transcription"];
const SEEDED_STEPS = ["pixels", ...TRANSCRIBED];
export function tier3SeedFrom(reading, units) {
  const chain = reading && Array.isArray(reading.text_source) ? reading.text_source : null;
  if (!chain || checkChain(chain) || !Array.isArray(units) || !units.length) return null;
  const groups = new Map();
  for (const step of chain) {
    if (!SEEDED_STEPS.includes(step.step)) continue;
    const key = JSON.stringify(step.extent ?? null);
    if (!groups.has(key)) groups.set(key, { extent: step.extent ?? null, chain: [] });
    const { extent, ...bare } = step;
    groups.get(key).chain.push(bare);
  }
  const parts = [];
  for (const g of groups.values()) {
    if (!g.chain.some((x) => TRANSCRIBED.includes(x.step)) || checkChain(g.chain)) continue;
    if (g.extent == null && chain.some((x) => !SEEDED_STEPS.includes(x.step))) continue;
    parts.push({ chain: g.chain, covers: (p) => stepCovers({ step: "ocr", extent: g.extent ?? undefined }, p) });
  }
  const text = new Map(), pagesOf = parts.map(() => []);
  for (const u of units) {
    if (!u || !Number.isInteger(u.page) || typeof u.text !== "string" || !(glyphCount(u.text) > 0)) continue;
    const owners = parts.map((pt, i) => (pt.covers(u.page) ? i : -1)).filter((i) => i >= 0);
    if (owners.length !== 1) continue;
    text.set(u.page, u.text);
    pagesOf[owners[0]].push(u.page);
  }
  const kept = parts.map((pt, i) => ({ chain: pt.chain, pages: pagesOf[i] })).filter((pt) => pt.pages.length);
  return kept.length ? { parts: kept, text } : null;
}

/* D-616: the member's answer with the kept pages added, in the I2 shape the merge reads. */
function withKeptPages(text, kept, seed) {
  if (!kept.length) return text;
  const pages = [...(Array.isArray(text && text.pages) ? text.pages : []),
                 ...kept.map((p) => ({ page: p, text: seed.text.get(p), undetermined: [] }))]
    .sort((a, b) => a.page - b.page);
  const document = pages.map((p) => p.text).filter(Boolean).join("\n");
  return { ...(text || {}), document, pages,
           counts: { ...((text && text.counts) || {}), chars: pages.reduce((n, p) => n + (p.text || "").length, 0) } };
}

/* CPDF-13 (R5): what the OCR member answered, taken only when it names its engine and version and a measured cap
   with `measured_by`. A region with no checkable image anchor is dropped and counted; a region below the member's
   confidence floor reads undetermined and its text is discarded (`applyConfidenceFloor`); a page no region anchors
   is not merged. The chain is `pixels → ocr(engine, version)`, both at the member's cap, naming `calibration` (the
   live calibration of that engine and version, R5) or none. */
export function ocrTextFromMember(res, { calibration = null } = {}) {
  const r = res && typeof res === "object" ? res : {};
  if (r.ok !== true)
    return { ok: false, why: word("reading-pipeline.why.ocr_member_declined", { reason: refusalReasonOf(r) !== "DECLINED" || typeof r.reason === "string" ? ` (${refusalReasonOf(r)})` : "" }) };
  if (!(typeof r.engine === "string" && r.engine) || !(typeof r.version === "string" && r.version))
    return { ok: false, why: word("reading-pipeline.why.ocr_member_name") };
  if (!(typeof r.cap === "string" && r.cap) || !(typeof r.measured_by === "string" && r.measured_by))
    return { ok: false, why: word("reading-pipeline.why.ocr_member_reported") };
  const pages = Array.isArray(r.pages) ? r.pages : [];
  let anchorless = 0, kept = 0, floored = 0, undetermined = 0;
  const outPages = [];
  /* R35: the words of a region the confidence floor (or an unusable confidence) discards are counted, never carried:
     only the count rides on the page, so a reading can say how many words it could not read. */
  const unreadOf = (before, after) => before.reduce((n, region, i) =>
    n + (after[i] && after[i].text == null && typeof region.text === "string" ? wordsIn(region.text) : 0), 0);
  for (const p of pages) {
    const pageNo = p && Number.isInteger(p.page) ? p.page : null;
    if (pageNo == null) continue;
    const anchored = [];
    for (const region of (Array.isArray(p && p.regions) ? p.regions : [])) {
      if (checkAnchor(region && region.source)) { anchorless++; continue; }
      anchored.push(region);
    }
    if (!anchored.length) continue;
    const f = applyConfidenceFloor(anchored, typeof r.confidence_floor === "number" ? r.confidence_floor : null);
    floored += f.floored; undetermined += f.undetermined;
    kept += f.regions.filter((x) => x.text != null).length;
    const unread = unreadOf(anchored, f.regions);
    /* R56 (G137d): the legibility the member stated for the page (one page an answer, so the answer's own when the page has none) */
    const leg = p.legibility && typeof p.legibility === "object" ? p.legibility
      : r.legibility && typeof r.legibility === "object" && pages.length === 1 ? r.legibility : null;
    outPages.push({ page: pageNo, regions: f.regions, ...(unread ? { unread_words: unread } : {}), ...(leg ? { legibility: leg } : {}),
                    text: f.regions.map((x) => x.text).filter((t) => typeof t === "string").join("\n"),
                    undetermined: f.regions.filter((x) => x.undetermined)
                      .map((x) => ({ page: pageNo, reason: "ocr_below_floor", font: null,
                                     codes: null, count: 1, why: x.why })) });
  }
  if (!outPages.length)
    return { ok: false, why: word("reading-pipeline.why.ocr_member_returned") };
  const chain = appendStep([{ step: "pixels", cap: r.cap, measured_by: r.measured_by, calibration }],
                           { step: "ocr", engine: r.engine, version: r.version,
                             cap: r.cap, measured_by: r.measured_by, calibration });
  if (!Array.isArray(chain))
    return { ok: false, why: word("reading-pipeline.why.ocr_member_provenance", { detail: String(chain.detail) }) };
  const text = {
    document: outPages.map((p) => p.text).filter(Boolean).join("\n"),
    pages: outPages.map((p) => ({ page: p.page, text: p.text, undetermined: p.undetermined,
                                 ...(p.unread_words ? { unread_words: p.unread_words } : {}),
                                 ...(p.legibility ? { legibility: p.legibility } : {}) })),
    undetermined: outPages.flatMap((p) => p.undetermined),
    counts: { chars: outPages.reduce((n, p) => n + p.text.length, 0), undetermined },
    regions: outPages.flatMap((p) => p.regions),
  };
  const note = anchorless
    ? word("reading-pipeline.region_ocr_member", { anchorless: String(anchorless) })
    : null;
  return { ok: true, text, chain, kept, floored, note };
}

/* CPDF-19 / D-319 (R4–R7, extraction R35): the tier-3 seam, one function both paths call, so an acquire and a re-read compose
   one chain by one rule. `liveCalibration({engine, version})` is `calibration.liveCalibration` (R10 there): the
   calibration the chain names, or null; one that cannot be read is none, never the nearest measurement. `seed` is
   `tier3SeedFrom`'s answer (the re-read only). Never throws for a member's failure: that is `ocrNote`. */
/* R54 (G129c, G125a): `killedPages` are the pages the caller states killed their reader three times (the plane's per-unit
   attempt stamps, PAGE_KILLED_READER): they are not asked again, and are stated. `killed` answers the pages whose call this request
   made answered 5xx or threw, so the caller can count an attempt against the page; `refused` the pages the member refused, each
   with its reason (final: never owed); `legibility` the legibility the member stated for each page it read or refused (R56). */
export const PAGE_KILLED_READER = "PAGE_KILLED_READER";
export async function tier3Extend(env, { sha, storeName, i2text, wiredTier, tier2PerPage, fmt, seed = null,
                                         liveCalibration = null, invocations = OCR_INVOCATIONS_PER_REQUEST, killedPages = [], stampUnit = null }) {
  let chain, chainSet = false, ocrNote = null, filled = [], engine = null, unanswered = [], loop = null;
  let seeded = [], transient = false, owed = [], killed = [], refused = [], legibility = {};
  const wanted = !!(i2text && needsTier3(i2text));
  if (wanted) {
    const stated = new Set((Array.isArray(killedPages) ? killedPages : []).filter(Number.isInteger));
    const wantAll = tier3Pages(i2text);
    for (const p of wantAll) if (stated.has(p)) refused.push({ page: p, reason: PAGE_KILLED_READER });
    const wantPages = wantAll.filter((p) => !stated.has(p));
    const baseTier = wiredTier;
    const baseText = i2text;
    const kept = seed ? wantPages.filter((p) => seed.text.has(p)) : [];
    const askPages = wantPages.filter((p) => !kept.includes(p));
    /* The merge and the chain, one rule for the member's answer and for the kept pages alone: `answer` is the I2 text
       merged (the kept pages added), `fresh` the chain of the pages read now (null when none were). */
    const compose = (answer, freshChain) => {
      const m = mergeTier3Text(baseText, answer, wantPages, { kept });
      if (!m.ok) return m;
      i2text = m.text;
      const appendedTo = Array.isArray(m.appended) ? m.appended : [];
      /* The pages that kept their own text, from the TEXT: a page with no glyph is in no part (D-514), an
         appended page is in the layer part and the engine's (D-635). */
      const layerPages = (Array.isArray(m.text.pages) ? m.text.pages : [])
        .filter((p) => p && Number.isInteger(p.page)
                    && (!m.filled.includes(p.page) || appendedTo.includes(p.page))
                    && typeof p.text === "string" && glyphCount(p.text) > 0)
        .map((p) => p.page);
      const parts = [];
      /*__REC102_TIER3_LAYER_PARTS_START__*/
      /* REC-102 / D-372: the layer part is partitioned by the tier-2 merge's own per-page statement; a page
         it does not speak for goes to the part at the document's own tier, never guessed into one. With
         no partition this is the one part at `baseTier` it always was. */
      const layerSet = new Set(layerPages);
      const spokenFor = tier2PerPage
        ? [[1, (tier2PerPage.tier1 || []).filter((p) => layerSet.has(p))],
           [2, (tier2PerPage.tier2 || []).filter((p) => layerSet.has(p))]]
        : [];
      const spoken = new Set(spokenFor.flatMap(([, ps]) => ps));
      for (const [tier, ps] of spokenFor)
        if (ps.length) parts.push({ pages: ps, chain: layerChainFor(baseText, { tier, container: fmt }) });
      const unspoken = layerPages.filter((p) => !spoken.has(p));
      if (unspoken.length)
        parts.push({ pages: unspoken, chain: layerChainFor(baseText, { tier: baseTier, container: fmt }) });
      /*__REC102_TIER3_LAYER_PARTS_END__*/
      /* D-616: the kept pages under the chain of the build that read them (R30: the AI's under its own), the pages
         read now under this build's; one part when the two chains are the same. */
      const keptIn = m.filled.filter((p) => kept.includes(p));
      const fresh = m.filled.filter((p) => !kept.includes(p));
      const t3parts = [];
      for (const pt of [...(seed ? seed.parts : []).map((x) => ({ chain: x.chain,
                           pages: x.pages.filter((p) => keptIn.includes(p)) })),
                        ...(freshChain ? [{ chain: freshChain, pages: fresh }] : [])]) {
        if (!pt.pages.length) continue;
        const same = t3parts.find((q) => JSON.stringify(q.chain) === JSON.stringify(pt.chain));
        if (same) same.pages = [...same.pages, ...pt.pages].sort((a, b) => a - b);
        else t3parts.push({ chain: pt.chain, pages: [...pt.pages] });
      }
      parts.push(...t3parts);
      /* One part gives its chain back unscoped; two give the scoped chain, its cap undetermined. A refusal
         from the chain builder records no chain. */
      const merged = mergedChain(parts);
      chain = Array.isArray(merged) ? merged : null; chainSet = true;
      /* R30: a kept page the AI read keeps the reading at the AI's tier (R29's 4). */
      if (m.filled.length)
        wiredTier = t3parts.some((pt) => pt.chain.some((s) => s.step === "ai_transcription")) ? 4 : 3;
      filled = fresh; seeded = keptIn; unanswered = m.unanswered || [];
      return { ...m, layerPages, appendedTo };
    };
    /* R30 (D-616): the kept pages alone, when the member is not asked for them or could not add to them; never
       dropped because the member was absent, failed or had nothing left to read. */
    const keepSeeded = () => (kept.length ? compose(withKeptPages(null, kept, seed), null) : { ok: false });
    const keptSaid = () => word("reading-pipeline.transcribed_earlier_reading", { seeded: String(seeded.length) });
    if (env && env.OCR_WORKER && kept.length && !askPages.length) {
      const k = keepSeeded();
      if (!k.ok) seeded = kept;
      ocrNote = word("reading-pipeline.page_document_without", { kept: String(kept.length) });
    } else if (env && env.OCR_WORKER) {
      let failure = null;
      try {
        const asked = askPages.length ? await askMemberPerPage(env, { sha, storeName, wantPages: askPages, invocations, stampUnit })
                                       : { status: 200, answer: null, loop: null };
        loop = asked.loop || null;
        if (loop) {
          refused.push(...loop.refusedWhy);
          for (const [pg, leg] of Object.entries(loop.legibility || {})) legibility[pg] = leg;
        }
        /* The status is read before the body: a 500's body may not parse, and "could not be reached" is a
           different finding from "answered an error". */
        if (!askPages.length) {
          failure = localize("reading-pipeline.index.ocr_pages_stated", "no page was asked of the OCR member: every page it would read is stated");
        } else if (loop && loop.invocations === 0) {
          /* R55: the inline pass asks nothing; the pages are owed to the reading's own ticks */
          failure = localize("reading-pipeline.index.ocr_not_asked_inline", "the OCR member was not asked inside this request: {count} page(s) are owed to the reading that follows it", { count: String(askPages.length) });
        } else if (!(asked.status >= 200 && asked.status < 300)) {
          failure = word("reading-pipeline.ocr_member_answered", { status: String(asked.status) });
          if (asked.status >= 500) { transient = true; owed = askPages; killed.push(askPages[0]); }
        } else {
          const ocrAnswer = asked.answer;
          let calRef = null;
          try {
            const live = typeof liveCalibration === "function"
              ? await liveCalibration({ engine: String(ocrAnswer && ocrAnswer.engine || ""),
                                        version: String(ocrAnswer && ocrAnswer.version || "") })
              : null;
            calRef = live && typeof live.calibration_id === "string" ? live.calibration_id : null;
          } catch { calRef = null; }
          const built = ocrTextFromMember(ocrAnswer, { calibration: calRef });
          if (built.ok) for (const pg of built.text.pages) if (pg.legibility) legibility[pg.page] = pg.legibility;
          if (built.ok) {
            const m = compose(withKeptPages(built.text, kept, seed), built.chain);
            if (!m.ok) failure = withLoopNote(m.why, loop);
            else {
              engine = { engine: String(ocrAnswer.engine), version: String(ocrAnswer.version), calibration: calRef };
              ocrNote = withLoopNote(tier3Note(m, built.note, m.layerPages.filter((p) => !m.appendedTo.includes(p))), loop);
              if (seeded.length) ocrNote = `${ocrNote}; ${keptSaid()}`;
            }
          } else failure = withLoopNote(built.why, loop);
        }
      } catch {
        failure = word("reading-pipeline.ocr_member_reached");
        transient = true; owed = askPages; if (askPages.length) killed.push(askPages[0]);
      }
      /* R37 (F9): the pages the request did not reach (past its calls, after a call that threw, or a call the member
         failed with a 5xx) are owed, not lost: they are named here for the caller to carry on from the first of them. */
      if (loop) owed = [...owed, ...loop.notAsked, ...(loop.threw ? loop.threw.rest : []), ...loop.down];
      if (loop && (loop.threw || loop.down.length)) transient = true;
      if (loop) killed.push(...loop.down, ...(loop.threw ? [loop.threw.at] : []));
      if (failure !== null) {
        ocrNote = failure;
        if (keepSeeded().ok && seeded.length) ocrNote = `${ocrNote}; ${keptSaid()}`;
      }
    } else if (keepSeeded().ok && seeded.length) {
      /* R30: no member is bound, and the pages an earlier reading transcribed are kept all the same. */
      const rest = unanswered.length;
      ocrNote = word("reading-pipeline.page_document_without_text", { seeded: String(seeded.length), rest: String(rest ? word("reading-pipeline.text_layer_read", { rest: String(rest) }) : "") });
    } else {
      /* DEC-149 (T35-24): member-facing, so it names the group's Civicsmith, never "this instance". */
      ocrNote = word("reading-pipeline.document_text_layer");
    }
  }
  /* D-418 (R6): a document still wants OCR when it was selected and nothing was filled, or a selected page is
     still unread. A page kept from an earlier reading is read (D-616). */
  const stillWanting = wanted && (!(filled.length + seeded.length) || unanswered.length > 0);
  /* R37: `left` is the pages still owed to the OCR member, ascending, and `cursor` the first of them; none when every
     page was read or declined (a declined page is the document's own, final). */
  const gone = new Set([...filled, ...seeded]);
  const pagesLeft = [...new Set(owed)].filter((p) => !gone.has(p)).sort((a, b) => a - b);
  return { i2text, wiredTier, chain, chainSet, ocrNote, filled, seeded, engine, stillWanting, transient,
           killed: [...new Set(killed)].sort((a, b) => a - b), refused, legibility,
           ...(pagesLeft.length ? { left: { cursor: pagesLeft[0], pages: pagesLeft } } : {}) };
}

/* R37, R48, R54, R56 (fix round 9): what tier 3 leaves stated on the reading (or on a later range's facts): `ocr_left` (R37, the
   pages owed, from the first of them), `ocr_killed` (the pages whose call answered 5xx or threw: an attempt the caller counts
   against the page, G125a, G129c), `ocr_refused` (each page the member refused, or the caller stated killed, with its reason:
   final, never owed), `legibility` (each page the member rated: `partly` under four fifths, `stored: false` for one refused under
   its floor, whose text is not kept, G137d), `units_skipped` (the pages stated unread: refused, or still wanting OCR and not owed,
   as a scan with no engine installed or inside an encrypted file, which the alpha does not OCR, N24) and `pictures_unread` (each unread picture inside a page that holds text, G128b: owed, R48). */
const PICTURE_UNREAD = ["image_unread", "image_content_undetermined"];
export const LEGIBLE_SHARE = 0.8;
function stateOcr(target, left, t3, i2text) {
  if (left) target.ocr_left = { cursor: left.cursor, pages: left.pages.length };
  if (!t3) t3 = {};
  if (t3.killed && t3.killed.length) target.ocr_killed = t3.killed;
  const refused = Array.isArray(t3.refused) ? t3.refused : [];
  if (refused.length) target.ocr_refused = refused.map((r) => ({ page: r.page, reason: r.reason }));
  const refusedAt = new Set(refused.map((r) => r.page));
  const leg = Object.entries(t3.legibility || {})
    .map(([page, l]) => ({ page: Number(page), words: l.words ?? null, confident_words: l.confident_words ?? null, share: l.share ?? null }))
    .filter((l) => Number.isInteger(l.page)).sort((a, b) => a.page - b.page)
    .map((l) => ({ ...l, partly: !(typeof l.share === "number" && l.share >= LEGIBLE_SHARE), ...(refusedAt.has(l.page) ? { stored: false } : {}) }));
  if (leg.length) target.legibility = leg;
  const owedAt = new Set(left ? left.pages : []);
  let skipped = refusedAt.size, pictures = 0;
  for (const pg of (i2text && Array.isArray(i2text.pages) ? i2text.pages : [])) {
    if (!pg || !Number.isInteger(pg.page)) continue;
    const own = Array.isArray(pg.undetermined) ? pg.undetermined : [];
    /* a page still wanting OCR that is neither owed nor refused is stated unread (no engine, a scan in an encrypted file: N24) */
    if (!refusedAt.has(pg.page) && !owedAt.has(pg.page) && own.some((u) => u && TIER3_REASONS.includes(u.reason))) skipped++;
    if (typeof pg.text === "string" && glyphCount(pg.text) > 0 && !own.some((u) => u && TIER3_REASONS.includes(u.reason))) {
      const images = own.filter((u) => u && u.reason === "image_unread").length;
      pictures += images || (own.some((u) => u && u.reason === "image_content_undetermined") ? 1 : 0);
    }
  }
  /* K4904 (2c item 9): the pages whose only text is a folio's glyphs over a picture (D-635's `image_content_unread`), still unread: a pass that rebuilds pages from
     stored units asks OCR for them as pages with no text layer. Absent means none. */
  const folio = [];
  for (const pg of (i2text && Array.isArray(i2text.pages) ? i2text.pages : []))
    if (pg && Number.isInteger(pg.page) && (Array.isArray(pg.undetermined) ? pg.undetermined : []).some((u) => u && u.reason === "image_content_unread") && !owedAt.has(pg.page)) folio.push(pg.page);
  if (folio.length) target.folio_pages = [...new Set(folio)].sort((x, y) => x - y);
  /* pdf-worker R10: the pages of a file cut before its trailer that tier 2 could not read are named `truncated` in the text's undetermined list: stated unread
     (so the reading is never `whole`, R48) and listed, 0-based, beside the `pdf_truncated` recovery note (R62) */
  const cut = [...new Set((i2text && Array.isArray(i2text.undetermined) ? i2text.undetermined : [])
    .filter((u) => u && u.reason === "truncated" && Number.isInteger(u.page) && !refusedAt.has(u.page)).map((u) => u.page))].sort((x, y) => x - y);
  if (cut.length) { target.truncated_pages = cut; skipped += cut.length; }
  if (skipped) target.units_skipped = (target.units_skipped || 0) + skipped;
  if (pictures) target.pictures_unread = pictures;
  return target;
}
/* R46: the reason a piece that advanced nothing ends its entry with. */
export const NO_PROGRESS = "NO_PROGRESS";
export const PASSWORD_REQUIRED = "PASSWORD_REQUIRED";
export const ENCRYPTED = "ENCRYPTED";
/* R46: the code pdf-worker's marker in a text's `undetermined` states (password_required before encrypted), or null */
const encryptedReasonOf = (text) => {
  const marks = text && Array.isArray(text.undetermined) ? text.undetermined : [];
  return marks.some((m) => m && m.reason === "password_required") ? PASSWORD_REQUIRED
    : marks.some((m) => m && m.reason === "encrypted") ? ENCRYPTED : null;
};

/* ===================================================================== *
 * Tier 4: the AI's reading of a page (R29).
 * ===================================================================== */

/* R29 (T41-9; N820, D21; text-chain R104): a transcription tier above tier 3. For the pages Civicsmith's own text
   recognition could not read, and only at a member's act, on the account that pays for that act and within its
   limits (`use: "transcribe"`), the AI's reading is merged as tier 3's is (R6's rule: an asked-for page with no
   glyph is filled, a folio page gains it appended) under the part `pixels -> ai_transcription(<model>)`, both
   uncapped: the AI's reading, undetermined until its accuracy is measured (BIO_Investigation §6).

   The module stays pure and reaches none of it by import. The caller acting at the member's request hands in
   `transcription = {member, project?, accounts, useCheck, transcribe, at?}`:
   - `accounts`: the paying account's service, an object whose `accountFor` is `ai-accounts.accountFor` (its R7, R11;
     R31, T48), asked for the act `{kind: "transcribe", member, project}`. It refuses a "no AI" material limit first
     (the group's, or the project's), then no account, the use switched off, a project the member has not joined; any
     refusal sends nothing. Through T48 a `transcription` that hands `credentials` and no `accounts` is read the same
     way (`credentials` R72's delegate answers `accountFor` as `ai-accounts` does), until the plane's transcriber
     re-points; the alias is removed in the tranche after (R31);
   - `useCheck`: `ai-use.useCheck` (its R3), asked `{owner, member, use: "transcribe", at}` for the account chosen;
     a refusal, or none handed in, sends nothing (a limit nobody checked is not one the act is within);
   - `transcribe`: the caller's AI path, handed `{account, capture_sha, store, pages, use}`, answering
     `{ok: true, engine, version?, pages: [{page, text}]}`.
   The account's key goes to `transcribe` only, never into the reading or a note. */
export const TRANSCRIBE_USE = "transcribe";
export const AI_TRANSCRIPTION_SOURCE = "unmeasured: the AI's reading of a page that is only a picture is "
  + "undetermined until its accuracy is measured (text-chain R104; BIO_Investigation_v0_1.md §6)";
export const AI_READING_LABEL = localize("reading-pipeline.index.ai_reading_label", "the AI's reading");

/* R29: the pages Civicsmith's own text recognition could not read, ascending: a page still carrying a marker that
   selects it for OCR (tier 3 did not fill it), or one OCR filled with no glyph (every region below its floor). None
   for a document with no per-page text, or one carrying `encrypted`. */
export function tier4Pages(text) {
  const pages = (text && Array.isArray(text.pages)) ? text.pages : [];
  const marks = (text && Array.isArray(text.undetermined)) ? text.undetermined : [];
  if (marks.some((m) => m && m.reason === "encrypted")) return [];
  const out = [];
  for (const p of pages) {
    if (!p || !Number.isInteger(p.page) || p.page < 0 || out.includes(p.page)) continue;
    const own = Array.isArray(p.undetermined) ? p.undetermined : [];
    const routed = own.some((u) => u && TIER3_REASONS.includes(u.reason));
    const floored = own.some((u) => u && u.reason === "ocr_below_floor")
      && !(typeof p.text === "string" && glyphCount(p.text) > 0);
    if (routed || floored) out.push(p.page);
  }
  return out.sort((a, b) => a - b);
}

/* The parts a settled chain is made of, so the AI's part can be added beside them (`mergedChain`'s input). An
   unscoped chain is one part, over `unscopedPages`; a scoped one is its parts as `mergedChain` stamped them, each
   with its pages and its steps without the stamp. Null when a part cannot be read back. */
function partsOfChain(chain, unscopedPages) {
  if (!Array.isArray(chain) || checkChain(chain)) return null;
  const derivations = chain.filter((x) => x && x.extent != null);
  if (!derivations.length) return unscopedPages.length ? [{ pages: unscopedPages, chain }] : [];
  const parts = new Map();
  for (const step of chain) {
    const e = step.extent;
    if (!(e && e.kind === "pages" && Array.isArray(e.pages))) return null;
    const key = Number.isInteger(e.part) ? `#${e.part}` : e.pages.join(",");
    const { extent, ...bare } = step;
    if (!parts.has(key)) parts.set(key, { pages: e.pages.slice(), chain: [] });
    parts.get(key).chain.push(bare);
  }
  return [...parts.values()];
}

const AI_REFUSAL_SAYS = {
  no_such_page: word("reading-pipeline.document_page"),
  not_asked: word("reading-pipeline.asked"),
  carries_glyphs: word("reading-pipeline.already_carries_text_reading"),
};
const refusalSays = (r) => [r && r.code, r && (r.detail || r.translation)].filter((x) => typeof x === "string" && x)
  .join(": ") || "refused";

/* R29: the tier-4 seam. `chain` is the chain settled through tier 3 (before a Drive export's conversion), `wiredTier`
   its tier. Answers `{i2text, chain, wiredTier, aiNote, filled, engine}`: unchanged, with the reason in `aiNote`,
   whenever nothing was filled. (T43; N853a, K2611) When the paying account or its limits refuse (`accountFor`'s
   answer that is not `ok`, or `useCheck`'s refusal, each an object), that refusal is also answered as given in
   `aiRefusal`, so the caller can answer it as the refusal it is; every other stop is `aiNote` alone, with no
   `aiRefusal` key. Never throws. */
export async function tier4Extend(transcription, { sha, storeName, i2text, chain, wiredTier }) {
  const out = { i2text, chain, wiredTier, aiNote: null, filled: [], engine: null };
  if (!transcription || typeof transcription !== "object") return out;
  const pages = tier4Pages(i2text);
  const not = (why) => { out.aiNote = word("reading-pipeline.asked_transcribe", { pages: String(describePages(pages)), why: String(why) }); return out; };
  const refused = (r) => {
    if (r && typeof r === "object") out.aiRefusal = r;
    return not(refusalSays(r));
  };
  if (!pages.length) {
    out.aiNote = word("reading-pipeline.page_left_civicsmith");
    return out;
  }
  const { member = null, project = null, accounts = null, credentials = null, useCheck = null, transcribe = null }
    = transcription;
  if (!(typeof member === "string" && member))
    return not(word("reading-pipeline.transcribes_member_act"));
  /* R31 (T48): `accounts` when handed; `credentials` only in its place, through T48. */
  const payer = accounts != null ? accounts : credentials;
  if (!(payer && typeof payer.accountFor === "function"))
    return not(word("reading-pipeline.account_pay_checked"));
  let account;
  try {
    account = await payer.accountFor({ member, act: { kind: TRANSCRIBE_USE, member,
                                                      ...(project != null ? { project } : {}) } });
  } catch { return not(word("reading-pipeline.account_pay_checked")); }
  if (!(account && account.ok === true)) return refused(account);
  /* N835 (ai-use R1): the paying owner is spelled from the bare member id, whether `member` was handed bare or
     stamped `member:<id>`; `member:member:<id>` is no owner ai-use can judge. */
  const owner = account.level === "project" ? `project:${account.project}`
    : account.level === "group" ? "group" : `member:${member.startsWith("member:") ? member.slice(7) : member}`;
  if (typeof useCheck !== "function") return not(word("reading-pipeline.limits_account_pay"));
  const at = typeof transcription.at === "string" && transcription.at ? transcription.at : new Date().toISOString();
  try {
    const limit = await useCheck({ owner, member, use: TRANSCRIBE_USE, at });
    if (limit) return refused(limit);
  } catch { return not(word("reading-pipeline.limits_account_pay")); }
  if (typeof transcribe !== "function") return not(word("reading-pipeline.set_transcribe"));
  let res;
  try {
    res = await transcribe({ account, capture_sha: sha, store: storeName, pages: [...pages], use: TRANSCRIBE_USE });
  } catch { return not(word("reading-pipeline.reached")); }
  const r = res && typeof res === "object" ? res : {};
  if (r.ok !== true) return not(localize("reading-pipeline.index.ai_declined", "the AI declined{reason}", { reason: typeof r.reason === "string" ? ` (${r.reason})` : "" }));
  const engine = typeof r.engine === "string" ? r.engine.trim() : "";
  if (!engine) return not(word("reading-pipeline.answer_name_model"));
  const version = typeof r.version === "string" && r.version.trim() ? r.version.trim() : null;
  const answered = (Array.isArray(r.pages) ? r.pages : [])
    .filter((p) => p && Number.isInteger(p.page) && typeof p.text === "string" && glyphCount(p.text) > 0)
    .map((p) => ({ page: p.page, text: p.text, undetermined: [] }));
  const m = mergeTier3Text(i2text, { pages: answered }, pages);
  if (!m.ok) return not(m.why);
  if (!m.filled.length) return not(word("reading-pipeline.returned_text_page"));
  const part = appendStep([{ step: "pixels", cap: null, measured_by: AI_TRANSCRIPTION_SOURCE, calibration: null }],
                          { step: "ai_transcription", engine, version, cap: null, measured_by: AI_TRANSCRIPTION_SOURCE,
                            calibration: null });
  if (!Array.isArray(part)) return not(word("reading-pipeline.provenance_refused", { detail: String(part.detail) }));
  const replaced = m.filled.filter((p) => !m.appended.includes(p));
  const held = (m.text.pages || []).filter((p) => p && Number.isInteger(p.page) && !replaced.includes(p.page)
                                                  && typeof p.text === "string" && glyphCount(p.text) > 0).map((p) => p.page);
  const parts = partsOfChain(chain, held);
  if (!parts) return not(word("reading-pipeline.chain_text_already"));
  const merged = mergedChain([...parts, { pages: m.filled, chain: part }]);
  if (!Array.isArray(merged)) return not(word("reading-pipeline.provenance_refused", { detail: String(merged.detail) }));
  out.i2text = m.text; out.chain = merged; out.wiredTier = 4;
  out.filled = m.filled; out.engine = { engine, version };
  const say = [word("reading-pipeline.civicsmith_text_recognition", { filled: String(describePages(m.filled)), filled_2: String(m.filled.length === 1
    ? "was" : "were"), engine: String(engine), version: String(version ? ` ${version}` : ""), ai_reading_label: String(AI_READING_LABEL) })];
  if (m.appended.length)
    say.push(word("reading-pipeline.already_held_little", { appended: String(describePages(m.appended)) }));
  if (m.unanswered.length) say.push(word("reading-pipeline.transcribe_unread", { unanswered: String(describePages(m.unanswered)), unanswered_2: String(m.unanswered.length
    === 1 ? "it stays" : "they stay") }));
  if (m.refusedWhy.length)
    say.push(word("reading-pipeline.page_returned_merged", { refused_why: String(m.refusedWhy.length), page: String(m.refusedWhy.map((x) => `${describePages([x.page])} (${AI_REFUSAL_SAYS[x.reason] || x.reason})`).join(", ")) }));
  out.aiNote = say.join("; ");
  return out;
}

/* ===================================================================== *
 * Text units (R15).
 * ===================================================================== */

/* REC-91 (R15): the indexable units of a capture's final text, recognised by SHAPE: one per page (`pages[]`, a
   `pdf-page` extent with the rect null, the whole page), paragraph (`paragraphs[]`, `doc-para`) or slide (`slides[]`,
   `slide-shape` with the shape omitted, the whole slide, Bob 2026-09-15) holding a glyph (D-531), its extent in the
   producer's own numbering and `seq` its position. An absent list and an empty one are different answers: no unit
   list is null.
   THE WIRE'S BUDGET: at most ACQUIRE_TEXT_UNITS_BUDGET, each unit charged its UTF-8 bytes plus the envelope.
   D-685 (R15): a unit is cut to CAPTURE_TEXT_UNIT_CAP before it is charged, and the cut is said (`truncated`), so
   the prefix the index receives is the prefix it would keep. A unit whose capped prefix does not fit what remains is
   left out, and every unit left out is NAMED (D-724, BOB #36 2026-09-25 11:20Z, option (b)): as runs of consecutive
   skipped units (first and last extent and seq, a count), because the keys ride in `data/provenance.json` under
   INLINE_MAX; a capture sends at most ~1,018 runs.
   N108 (R15, retrieval R25, D-672): a workbook's unit is its SHEET, `sheet-range` at the whole used range its reader
   names (`sheets[].range`, `usedSheetRange` in the xlsx, ods and csv entries); a sheet whose range the reader could
   not name is no unit, never a guessed rectangle. A workbook's defined names and tables are not units here. */
const sheetRangeOf = (u) => {
  const r = u.range;
  return r && r.kind === "sheet-range" && typeof r.sheet === "string" && r.sheet && typeof r.range === "string" && r.range
    ? { sheet: r.sheet, range: r.range } : { sheet: null, range: null };
};
/* R47 (fix round 9, G134d; K4831 (7)): the closed list of a unit's kinds. A reader's body units are `body`; every other part it
   emits (`office-readers` R38, `odf-reader` R53: `parts: [{kind, ref, part, text, hidden?}]`) is a unit of its own kind, its extent
   `{kind: "doc-part", part, ref}` (the package part and the element reference the reader names), so it reaches the index, the hit and
   the citation with its kind. A part whose kind is not in the list is read as `body`, never dropped. */
export const UNIT_KINDS = Object.freeze(["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box",
  "speaker_note", "master_text", "cell_note"]);
const kindOf = (k) => (UNIT_KINDS.includes(k) ? k : "body");
/* A sheet's `lineRows` when it names one 1-based row per line of its text, else null. */
const lineRowsOf = (sheet, lines) => (sheet && Array.isArray(sheet.lineRows) && sheet.lineRows.length === lines
  && sheet.lineRows.every(Number.isInteger) ? sheet.lineRows : null);
const linesIn = (t) => { let n = 1; for (let i = t.indexOf("\n"); i >= 0; i = t.indexOf("\n", i + 1)) n++; return n; };
/* Every unit of the text, before the wire's cap and budget: null when the text has no unit list. */
function allUnitsOf(i2text) {
  if (!i2text) return null;
  /* R47 (G166; K4985): a paragraph a part names in its `paras` (`office-readers` R38: indices into `paragraphs`) is that part's words
     alone, so it is no body unit; its number stays what it was. */
  const named = new Set();
  for (const p of Array.isArray(i2text.parts) ? i2text.parts : [])
    if (p && typeof p === "object" && Array.isArray(p.paras)) for (const n of p.paras) if (Number.isInteger(n) && n >= 0) named.add(n);
  /* R47 (G166; K4987): a slide's body unit is its `bodyText` (the text outside its text boxes, '' for a box-only slide) when the entry
     states one, else its `text`. */
  const arm = (list, kind, fields, skip = null, textOf = (u) => u.text) => (Array.isArray(list) ? list : [])
    .map((u, i) => (u && typeof u === "object" && typeof textOf(u) === "string" && glyphCount(textOf(u)) > 0 && !(skip && skip.has(i))
      ? { extent: { kind, ...fields(u, i) }, seq: i, text: textOf(u), kind: "body", ...(u.hidden === true ? { hidden: true } : {}) } : null))
    .filter(Boolean);
  const body = Array.isArray(i2text.pages)      ? arm(i2text.pages, "pdf-page",
        (u, i) => ({ page: Number.isInteger(u.page) ? u.page : i, rect: null }))
    : Array.isArray(i2text.paragraphs) ? arm(i2text.paragraphs, "doc-para",
        (u, i) => ({ para: Number.isInteger(u.para) ? u.para : i, run: null }), named)
    : Array.isArray(i2text.slides)     ? arm(i2text.slides, "slide-shape",
        (u, i) => ({ slide: Number.isInteger(u.slide) ? u.slide : i, shape: null }), null, (u) => (typeof u.bodyText === "string" ? u.bodyText : u.text))
    : Array.isArray(i2text.sheets)     ? arm(i2text.sheets, "sheet-range", sheetRangeOf)
        .filter((u) => u.extent.sheet !== null)
        /* R47 (G128h): a sheet's unit carries the row of each of its lines, so a hit names its row */
        .map((u) => { const rows = u.text.length <= CAPTURE_TEXT_UNIT_CAP ? lineRowsOf(i2text.sheets[u.seq], linesIn(u.text)) : null;
                      return rows ? { ...u, lineRows: rows } : u; })
    : null;
  const parts = Array.isArray(i2text.parts) ? i2text.parts : null;
  if (!parts) return body;
  const out = body ? [...body] : [];
  /* R11b (fix round 10): the next seq is found by a loop, never by spreading the units into `Math.max`, which overflows the stack for 120,000 units */
  let seq = 0;
  for (const u of out) if (u.seq >= seq) seq = u.seq + 1;
  for (const p of parts) {
    if (!(p && typeof p === "object" && typeof p.text === "string" && glyphCount(p.text) > 0)) continue;
    out.push({ extent: { kind: "doc-part", part: typeof p.part === "string" ? p.part : null, ref: typeof p.ref === "string" ? p.ref : null },
               seq: seq++, text: p.text, kind: kindOf(p.kind), ...(p.hidden === true ? { hidden: true } : {}) });
  }
  return out;
}
/* R47 (G128d): a unit over the cap as consecutive units of the same element, `run` 0, 1, ... in its extent, each broken at a space
   when one is near (`chunksOf`) and stating the words before its seam (`overlap`), so a phrase across a seam is found. A sheet is
   chunked by blocks of whole rows (R41), never here. Each chunk holds its own words of the text (a word split by the seam is one). */
function chunkedUnit(u) {
  if (u.text.length <= CAPTURE_TEXT_UNIT_CAP || u.extent.kind === "sheet-range") return [u];
  return chunkUnits(u.text).map((c, k) => withOwnWords({ ...u, extent: { ...u.extent, run: k }, text: c.text,
                                                        ...(k > 0 ? { overlap: c.overlap } : {}) }, c.lead));
}
/* R47 (G128d): `text` as chunks of at most the cap, `{text, overlap, lead}`: `overlap` the last two words before the seam (what a
   phrase crossing it needs, up to 256 characters), `lead` 1 when the chunk continues a word the chunk before it cut. */
export function chunkUnits(text, cap = CAPTURE_TEXT_UNIT_CAP) {
  const cs = chunksOf(text, cap);
  return cs.map((t, k) => {
    if (k === 0) return { text: t, overlap: "", lead: 0 };
    const before = cs[k - 1];
    const words = before.trimEnd().split(/\s+/);
    return { text: t, overlap: words.slice(-2).join(" ").slice(-256), lead: continuesWord(before, t) ? 1 : 0 };
  });
}
/* The UTF-8 length of a string, counted without encoding it (the wire charges every unit, and a book is thousands). */
export function utf8Length(s) {
  if (s.length < 4096) return utf8Range(s, 0, s.length);
  /* G82: the native encoder counts a long string a slice at a time, into a scratch buffer, with no copy of the string: a slice never ends between the
     halves of a pair, and a lone half is the three bytes of its replacement, as `utf8Range` counts it */
  let n = 0;
  for (let at = 0; at < s.length;) {
    let end = Math.min(s.length, at + UTF8_SLICE);
    if (end < s.length && (s.charCodeAt(end - 1) & 0xfc00) === 0xd800 && (s.charCodeAt(end) & 0xfc00) === 0xdc00) end++;
    n += UTF8_ENCODER.encodeInto(s.slice(at, end), UTF8_SCRATCH).written;
    at = end;
  }
  return n;
}
const UTF8_SLICE = 16 * 1024, UTF8_ENCODER = new TextEncoder(), UTF8_SCRATCH = new Uint8Array(UTF8_SLICE * 3 + 4);
/* The UTF-8 length of `s.slice(from, to)`, counted in place (a pair cut at `to` is a lone surrogate there, as in the slice). */
function utf8Range(s, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < to && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
    else n += 3;
  }
  return n;
}
/* R37 (F8): `budget` is the bytes the units may spend. The default is the acquire answer's (R15): the wire carries at
   most that. The index path (a held reading read again, a re-read) has no wire, so its caller hands `Infinity` and
   every unit is given; the index's own bound is the caller's (extraction R22). R47 (fix round 9, G128d): a unit over
   CAPTURE_TEXT_UNIT_CAP is carried as its chunks (`chunkedUnit`), a sheet over it as blocks of whole rows (R41), never cut. */
export function textUnitsFor(i2text, { budget: wireBudget = ACQUIRE_TEXT_UNITS_BUDGET } = {}) {
  let textUnits = null, textUnitsOverBound = 0, textUnitsSkipped = null;
  if (i2text) {
    const units = allUnitsOf(i2text);
    let budget = wireBudget, dropped = 0;
    const kept = [], runs = [];
    let run = null;
    const skip = (u) => {
      if (run) { run.last = u.extent; run.last_seq = u.seq; run.units++; return; }
      run = { first: u.extent, first_seq: u.seq, last: u.extent, last_seq: u.seq, units: 1 };
      runs.push(run);
    };
    const sheets = Array.isArray(i2text.sheets) ? i2text.sheets : [];
    for (const u0 of (units || [])) {
      const pieces = u0.extent.kind === "sheet-range" && u0.text.length > CAPTURE_TEXT_UNIT_CAP
        ? sheetBlocks(u0, sheets[u0.seq]).map(({ leadWords = 0, ...b }) => withOwnWords(b, leadWords)) : chunkedUnit(u0);
      for (const u of pieces) {
        /* A string's UTF-8 is never shorter than its length in UTF-16 units, so a unit that cannot fit even at one
           byte a unit is left out without being measured. */
        const size = u.text.length + ACQUIRE_TEXT_UNIT_ENVELOPE > budget ? Infinity : utf8Length(u.text) + ACQUIRE_TEXT_UNIT_ENVELOPE;
        if (size > budget) { dropped++; skip(u); continue; }
        budget -= size; kept.push(u); run = null;
      }
    }
    textUnits = kept.length ? kept : null;
    textUnitsOverBound = dropped;
    textUnitsSkipped = runs.length ? runs : null;
  }
  return { textUnits, textUnitsOverBound, textUnitsSkipped };
}

/* R35 (T51 fix round 2, C17): the words of a text, a word being a run of non-whitespace holding a glyph. */
const SPACE = /\s/;
/* `\s` as the regular expression has it, by code unit (G82: a word count over a 17 MB text was most of a tick's compute with a
   regular expression to a character): the ASCII white space, and above U+009F the ones `\s` names. */
const isSpaceUnit = (c) => c === 0x20 || (c >= 0x9 && c <= 0xd) || (c >= 0xa0 && (c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a)
  || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff));
export function wordsIn(s) {
  if (typeof s !== "string") return 0;
  let n = 0, inWord = false;
  for (let i = 0; i < s.length; i++) {
    const w = !isSpaceUnit(s.charCodeAt(i));
    if (w && !inWord) n++;
    inWord = w;
  }
  return n;
}

/* R35 (fix round 6, G40; K4622): the words a carried unit holds of the text, counted once. A piece's unit can hold words the text
   has once: the header a sheet's later block repeats (R41) and the tail of a word a hard cut split (R41's runs). Those units are
   entered here with their own words, so the pieces' words add up to the text's, never past it; any other unit holds `wordsIn` of
   its text. A cut unit holds fewer words than the text had, as R35 states. */
const ownWords = new WeakMap();
const wordsOfUnit = (u) => ownWords.get(u) ?? wordsIn(u.text);
const withOwnWords = (u, lead) => { ownWords.set(u, Math.max(0, wordsIn(u.text) - lead)); return u; };
/* The words a chunk of a run adds: the word it continues from the chunk before is not a new one. */
const continuesWord = (before, chunk) => before.length > 0 && chunk.length > 0 && !SPACE.test(before[before.length - 1]) && !SPACE.test(chunk[0]);

/* R35: `{words_total, words_read}` of a text that has text units, else null. `words_total` is the words of every unit the
   text has plus the words an OCR region below its floor held (carried as a count on the page, `unread_words`, never
   as text); `words_read` is the words of the units `textUnitsFor` keeps, a unit cut to its cap by the prefix it keeps. They
   are equal when the whole text was read. */
export function textWordsFor(i2text, keptUnits = undefined, { budget, all: held } = {}) {
  const kept = keptUnits !== undefined ? keptUnits : textUnitsFor(i2text, { budget }).textUnits;
  if (!kept) return null;
  const all = held || allUnitsOf(i2text) || [];   /* `held`: the very list `allUnitsOf(i2text)` gave, handed by a caller that has it */
  const unread = (Array.isArray(i2text.pages) ? i2text.pages : [])
    .reduce((n, p) => n + (p && Number.isInteger(p.unread_words) && p.unread_words > 0 ? p.unread_words : 0), 0);
  const sum = (units) => units.reduce((n, u) => n + wordsOfUnit(u), 0);
  return { words_total: sum(all) + unread, words_read: sum(kept) };
}

/* ===================================================================== *
 * Text units of a capture read as text (R32).
 * ===================================================================== */

/* R32: a capture read as text through no format entry (R1) has no `paragraphs` list from an entry, so its units are
   drawn here from the decoded text: one `doc-para` per paragraph, a paragraph being a run of text between blank lines,
   numbered from 0 over all paragraphs in the text's order (`textUnitsFor` skips the ones with no glyph and keeps
   `seq` as the position, R15). Nothing is added to the format registry: this is the one site. */
/* R32: the units of text read as text. `html` is true for a capture whose detected format is `html`.
   R33 (T50; N1191 (a)): a text that is not HTML and holds no blank line but at least two non-empty lines is split at
   its line breaks: one unit per non-empty line (the line trimmed), `para` counting the non-empty lines from 0. A text
   with a blank line anywhere keeps its paragraphs (a wrapped paragraph is never split), a one-line text is one unit,
   and an HTML page is read by R32's rule. */
/* R51: a paragraph of an HTML page is its words with the runs of white space one space; the tab that tells a row's cells apart (html.mjs) stays, so a table keeps its columns */
const squashHtmlRun = (p) => p.replace(/[ \f\v\u00a0\r\n]+/g, " ").replace(/^[ ]+|[ ]+$/g, "");
const BLANK_LINE_RUN = /\r?\n[ \t\f\v\u00a0 ]*(?:\r?\n[ \t\f\v\u00a0 ]*)+/;
function paragraphsOfText(text, html) {
  const visible = html ? visibleTextOfHtml(text) : text;
  /* Runs between blank lines; a run of no character (the text's edges, a markup-only block) is no paragraph, so `para`
     counts the paragraphs the text has, from 0, and a page's leading blank does not shift it. */
  const runs = visible.split(BLANK_LINE_RUN);
  const lines = !html && runs.length === 1 ? runs[0].split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length) : [];
  const paragraphs = (lines.length >= 2 ? lines : runs
    .map((p) => (html ? squashHtmlRun(p) : p.trim()))
    .filter((p) => p.length))
    .map((p, para) => ({ para, text: p }));
  return { paragraphs };
}
export function textUnitsOfText(text, { html = false, budget } = {}) {
  if (typeof text !== "string" || !text) return { textUnits: null, textUnitsOverBound: 0, textUnitsSkipped: null };
  const paras = paragraphsOfText(text, html);
  return { ...textUnitsFor(paras, { budget }), paragraphCount: paras.paragraphs.length };
}
/* R35: the words of a capture read as text, over the text its units are drawn from. */
export function textWordsOfText(text, { html = false, budget } = {}) {
  if (typeof text !== "string" || !text) return null;
  const paras = paragraphsOfText(text, html);
  return textWordsFor(paras, textUnitsFor(paras, { budget }).textUnits);
}

/* ===================================================================== *
 * A reading in pieces (R40, R41).
 * ===================================================================== */

/* R40 (fix round 6, G13, G14; K4571, K4578): a reading too large for one answer is read whole, in pieces by a cursor, never
   in part without saying so. `read(document, {cursor, unitsBudget, maxUnits})`: with the `cursor` key passed (null for the
   first piece, else the string the piece before answered) the answer is one piece of the capture's units, in the grain R15,
   R32 and R33 give, within `unitsBudget` bytes (each unit charged as R15 charges it) and `maxUnits` units (default
   PIECE_UNITS_MAX, extraction R22's index bound), and carries `more`, `cursor` (null when `more` is false),
   `read_through` and `total` (bytes of the text the units are drawn from), and `piece = {units, words, units_total?}`. A
   unit's `seq` is its place in the capture's whole list, so a later piece continues the numbering. A piece holds at
   least one unit, so a cursor always moves. The first piece is the reading with its units; a later piece is its units
   alone (no `reading`). The cursor is opaque and names the capture's digest and the shape of what it points into; one that
   does not fit the bytes now in hand is refused, with `refused` and no reading. Without the `cursor` key `read` is as it was.
   R41 (G15): in this mode a text line or paragraph over CAPTURE_TEXT_UNIT_CAP is carried whole as consecutive units
   (extent `run` 0, 1, ...), never cut; a sheet whose text is over the cap is carried as blocks of whole rows. */
export const PIECE_UNITS_MAX = 4096;
/* G26 (fix round 6): a PDF is read in pieces by page ranges (pdf-reader's `extractPdfRange`, R43), the cursor a page. A range's
   structures are dropped before the next is read, so a tick holds the bytes and one range, and the whole is one parse, not one
   per piece. G56 (K4693, K4700): a range is sized by work as well as by pages: at most `PDF_RANGE_PAGES` pages and at most
   `PDF_RANGE_BYTES` of file at the document's bytes a page, at least one page, the byte term applied by `extractPdfRange`
   (`maxBytes`, passed on every tick, so one formula serves the first tick and the later ones). Measured at the plane's shape
   (`g26.probe.mjs`, BUDGET-2024-APP, 1,354 pages, 15.2 MiB, in a child of 112 MB), the first tick is about 3 s fixed + 0.04 s a
   page: 200 pages 11.0 s (G37, K4615, chose 200 for the parse-total bar of 1.5 and measured 8.2 s on another machine), 150 pages
   9.5 s, 125 pages 7.3 s, 100 pages 6.4-7.5 s, 75 pages 6.0 s; 100 pages of that volume weigh about 1.2 MB, so 1.3 MB leaves its
   pieces at 100 pages and shrinks a page-dense or scan-shaped volume's. The parse-total ratio rises with the pieces (each pays a
   fixed cost), 1.53 at 200 and 1.57 at 100. */
export const PDF_RANGE_PAGES = 100;
export const PDF_RANGE_BYTES = 1_300_000;
export const BARE_DIGEST = "BARE_DIGEST";
export const CURSOR_MISMATCH = "CURSOR_MISMATCH";
export const NOT_PIECEWISE = "NOT_PIECEWISE";
/* Sentences the refusals carry. Stand-ins until T52 (K4269): the nearest held rows; owed: `reading-pipeline.index.bare_digest`,
   `.cursor_mismatch`, `.not_piecewise`. The code is the answer; the sentence only says it. */
const refusal = (code, row) => ({ refused: { code, why: word(row) } });
const refuse = refusal;   /* readInner's range branch has a local `refusal` (an entry's refusal, R38) */

const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function unb64(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,2000}$/.test(s)) return null;
  try { const o = JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/"))); return o && typeof o === "object" && !Array.isArray(o) ? o : null; }
  catch { return null; }
}
const natural = (v) => Number.isInteger(v) && v >= 0;

/* A run of text over the unit cap, as consecutive chunks of at most the cap, each ended at the last space in the final
   eighth of its window when there is one, else cut at the cap (never inside a surrogate pair). */
export function chunksOf(text, cap = CAPTURE_TEXT_UNIT_CAP) {
  const out = [];
  for (let at = 0; at < text.length;) {
    let end = Math.min(text.length, at + cap);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end - 1);
      if (sp > at + cap - Math.floor(cap / 8)) end = sp + 1;
      else if ((text.charCodeAt(end - 1) & 0xfc00) === 0xd800) end--;
    }
    out.push(text.slice(at, end));
    at = end;
  }
  return out;
}

/* The grain of a text read as text (R32, R33): an HTML page and a text with a blank line are read by paragraph; a text with
   no blank line and at least two non-empty lines by line. */
function grainOf(visible, html) {
  if (html || BLANK_LINE_RUN.test(visible)) return "paragraphs";
  let found = 0;
  for (let at = 0; at < visible.length && found < 2;) {
    const nl = visible.indexOf("\n", at);
    const end = nl < 0 ? visible.length : nl;
    if (visible.slice(at, end).trim().length) found++;
    at = end + 1;
  }
  return found >= 2 ? "lines" : "paragraphs";
}

/* A walker over the non-empty runs of the visible text from `offset`: `next()` answers `{text, from}` (`from` is where the
   scan stood before the run, the offset a cursor resumes at) or null at the end. The runs and their trimming are those
   `paragraphsOfText` makes of the whole text. */
function runWalker(visible, grain, html, offset) {
  const sep = grain === "paragraphs" ? new RegExp(BLANK_LINE_RUN.source, "g") : null;
  let at = offset;
  return () => {
    while (at < visible.length) {
      const from = at;
      let end, next;
      if (sep) {
        sep.lastIndex = at;
        const m = sep.exec(visible);
        if (m) { end = m.index; next = sep.lastIndex; } else { end = next = visible.length; }
      } else {
        const nl = visible.indexOf("\n", at);
        if (nl < 0) { end = next = visible.length; } else { end = nl; next = nl + 1; }
      }
      at = next;
      const raw = visible.slice(from, end);
      const text = html ? squashHtmlRun(raw) : raw.trim();
      if (text.length) return { text, from };
    }
    return null;
  };
}

const visibleOf = (text, html) => (html ? visibleTextOfHtml(text) : text);
/* G131f, G82: in pieces, the visible text of a page over BREATHE_AT is made by the streaming pass that gives the turn back every HTML_STRETCH tokens */
const visibleOfYielding = async (text, html, on) => (html && on && text.length > BREATHE_AT ? visibleTextOfHtmlYielding(text, { yieldNow }) : visibleOf(text, html));
/* G131h (R51): the visible text of the HTML page whose pieces are being read, kept for the next tick of the object that made it (one page at a time,
   as the open PDF is): a later tick of that digest reads nothing from the store and parses nothing. A tick that does not find it (the object was
   restarted, another page replaced it) makes it again from the page, the same text. */
let heldHtml = null;   /* {sha, visible} */
const unitOf = (para, run, seq, text) => ({ extent: { kind: "doc-para", para, run }, seq, text, kind: "body" });
const fits = (units, size, room, maxUnits) => !units.length || (units.length < maxUnits && size <= room);

/* The piece of a text read as text, from `at` (null: the start; else `{o, p, q, r}`: the scan offset, the next `para`, the
   next `seq`, the next run of that paragraph). `{units, grain, more, at, through}`. */
function textPiece(visible, { html, at, budget, maxUnits, grain: given }) {
  const grain = given ?? grainOf(visible, html);
  const walk = runWalker(visible, grain, html, at ? at.o : 0);
  let para = at ? at.p : 0, seq = at ? at.q : 0, run0 = at ? at.r : 0;
  const units = [];
  let room = budget, more = false, resume = null;
  for (let r = walk(); r; r = walk()) {
    if (!(glyphCount(r.text) > 0)) { para++; seq++; continue; }   /* a paragraph with no glyph is no unit, but is counted (R32) */
    const chunks = r.text.length > CAPTURE_TEXT_UNIT_CAP ? chunksOf(r.text) : null;
    const n = chunks ? chunks.length : 1;
    for (let k = chunks ? run0 : 0; k < n; k++) {
      const text = chunks ? chunks[k] : r.text;
      const lead = chunks && k > 0 && continuesWord(chunks[k - 1], text) ? 1 : 0;
      const size = utf8Length(text) + ACQUIRE_TEXT_UNIT_ENVELOPE;
      if (!fits(units, size, room, maxUnits)) { more = true; resume = { o: r.from, p: para, q: seq, r: chunks ? k : 0 }; break; }
      room -= size;
      units.push(withOwnWords(unitOf(para, chunks ? k : null, seq, text), lead));
      seq++;
    }
    run0 = 0;
    if (more) break;
    para++;
  }
  return { units, grain, more, at: resume, para, seq };
}

/* R35 over the whole text, for a first piece: the units the text has and the words of them. */
async function totalsOfText(visible, html, grain) {
  const walk = runWalker(visible, grain, html, 0);
  let units = 0, words = 0, since = 0, paras = 0;
  for (let r = walk(); r; r = walk()) {
    paras++;
    if (glyphCount(r.text) > 0) { units += r.text.length > CAPTURE_TEXT_UNIT_CAP ? chunksOf(r.text).length : 1; words += wordsIn(r.text); }
    since += r.text.length;
    if (since > BREATHE_AT) { since = 0; await yieldNow(); }   /* G82: the walk over a whole text is given back every slice */
  }
  return { units, words, paras };
}

/* R41: a sheet unit over the cap as blocks of whole lines, the sheet's first line (its header) repeated at the head of each
   later block. `lineRows` (the 1-based row of each text line, as a reader emits it) names the rows of each block in its
   extent; without it the extent is the sheet's whole range. */
/* R41, R47 (fix round 9, G128g, G128h): the rows a block states, one per line of its text: a later block's repeated header line names
   its own row (the sheet's first), so a reader that joins the blocks drops the repeat; without the sheet's `lineRows` a line's row
   is its place in the sheet's text, from 1. */
function blockRows(rows, first, end) {
  const own = [];
  for (let i = first; i < end; i++) own.push(rows ? rows[i] : i + 1);
  return first > 0 ? [rows ? rows[0] : 1, ...own] : own;
}
function sheetBlocks(u, sheet) {
  const lines = u.text.split("\n");
  const rows = sheet && Array.isArray(sheet.lineRows) && sheet.lineRows.length === lines.length
    && sheet.lineRows.every(Number.isInteger) ? sheet.lineRows : null;
  const head = lines[0];
  const corner = rows && typeof u.extent.range === "string" ? /:\$?([A-Za-z]{1,3})\$?\d+$/.exec(u.extent.range) : null;
  const lastCol = corner ? corner[1].toUpperCase() : null;
  const blocks = [];
  let cur = [], size = 0, first = 0;
  const flush = (end) => {
    if (!cur.length) return;
    const withHead = first > 0 ? `${head}\n${cur.join("\n")}` : cur.join("\n");
    const range = rows && lastCol ? `A${rows[first]}:${lastCol}${rows[end - 1]}` : u.extent.range;
    blocks.push({ ...u, extent: { ...u.extent, range }, text: withHead, lineRows: blockRows(rows, first, end),
                  ...(first > 0 ? { leadWords: wordsIn(head) } : {}) });
    cur = []; size = 0;
  };
  for (let i = 0; i < lines.length; i++) {
    const budget = CAPTURE_TEXT_UNIT_CAP - (i > 0 ? head.length + 1 : 0);
    const l = lines[i].length > budget ? lines[i].slice(0, budget) : lines[i];   /* a single row over the cap stays one cut row, flagged */
    if (cur.length && size + l.length + 1 > budget) { flush(i); first = i; }
    if (!cur.length) first = i;
    cur.push(l); size += l.length + 1;
  }
  flush(lines.length);
  const longRow = lines.some((l) => l.length > CAPTURE_TEXT_UNIT_CAP - head.length - 1);
  return longRow ? blocks.map((b) => ({ ...b, truncated: true })) : blocks;
}

/* G48 (fix round 6; K4679): the way a sheet over the unit cap is cut into blocks (R41), planned before it is built. One
   walk over the text, line by line with no line list, finds each block's lines, its UTF-8 bytes and whether a row is over
   the cap; a block is built from its own span of the text when a piece asks for it (`sheetBlockAt`), so a first tick that
   reads the first piece builds the first piece's blocks and counts the rest. The walk is `sheetBlocks`' own, line for line.
   Null when the header leaves no room beside a row (the eager `sheetBlocks` cuts that sheet). */
function sheetPlan(u) {
  const text = u.text, cap = CAPTURE_TEXT_UNIT_CAP;
  const nl0 = text.indexOf("\n");
  const headLen = nl0 < 0 ? text.length : nl0;
  if (headLen + 2 > cap) return null;
  const limit = cap - headLen - 1;
  const headBytes = utf8Range(text, 0, headLen);
  const blocks = [];
  let cur = null, longRow = false, i = 0, pos = 0;
  const close = () => {
    cur.end = i;
    cur.bytes = (cur.first > 0 ? headBytes + 1 : 0) + cur.lineBytes + (cur.end - cur.first - 1);
    blocks.push(cur); cur = null;
  };
  for (;;) {
    const e = text.indexOf("\n", pos);
    const end = e < 0 ? text.length : e;
    const len = end - pos;
    if (len > limit) longRow = true;
    const budget = i > 0 ? limit : cap;
    const keep = len > budget ? budget : len;   /* a single row over the cap stays one cut row, flagged */
    if (cur && cur.size + keep + 1 > budget) close();
    if (!cur) cur = { first: i, from: pos, to: end, size: 0, lineBytes: 0 };
    cur.size += keep + 1; cur.lineBytes += utf8Range(text, pos, pos + keep); cur.to = end;
    i++;
    if (e < 0) break;
    pos = e + 1;
  }
  close();
  return { blocks, lines: i, longRow, headLen, headBytes };
}
/* One planned block built: the unit `sheetBlocks` would have made, `seq` its place in the whole list. */
function sheetBlockAt(u, sheet, plan, k, seq) {
  const b = plan.blocks[k], cap = CAPTURE_TEXT_UNIT_CAP;
  const head = u.text.slice(0, plan.headLen);
  if (plan.rows === undefined)   /* checked once for the sheet, at its first block */
    plan.rows = sheet && Array.isArray(sheet.lineRows) && sheet.lineRows.length === plan.lines
      && sheet.lineRows.every(Number.isInteger) ? sheet.lineRows : null;
  const rows = plan.rows;
  const corner = rows && typeof u.extent.range === "string" ? /:\$?([A-Za-z]{1,3})\$?\d+$/.exec(u.extent.range) : null;
  const lastCol = corner ? corner[1].toUpperCase() : null;
  const lines = u.text.slice(b.from, b.to).split("\n").map((l, j) => {
    const budget = b.first + j > 0 ? cap - plan.headLen - 1 : cap;
    return l.length > budget ? l.slice(0, budget) : l;
  });
  const text = b.first > 0 ? `${head}\n${lines.join("\n")}` : lines.join("\n");
  const range = rows && lastCol ? `A${rows[b.first]}:${lastCol}${rows[b.end - 1]}` : u.extent.range;
  const unit = { extent: { ...u.extent, range }, seq, text, kind: "body", lineRows: blockRows(rows, b.first, b.end),
                 ...(plan.longRow ? { truncated: true } : {}) };
  return withOwnWords(unit, b.first > 0 ? wordsIn(head) : 0);
}

/* The units of a text from a format entry, the way a piece carries them (R41): `allUnitsOf`'s, a sheet over the unit cap
   in blocks of rows, any other unit over it in runs (R47). `seq` is the
   place in this whole list. The list is a plan (G48): each entry knows its UTF-8 bytes, and a sheet's block is built only
   when asked for (`unitAt`), so the totals (`n`, `bytesBefore`) cost a counting walk and a piece costs its own blocks.
   `base` is `allUnitsOf(i2text)` when the caller holds it. */
function pieceUnitPlan(i2text, base = allUnitsOf(i2text) || []) {
  const sheets = Array.isArray(i2text && i2text.sheets) ? i2text.sheets : [];
  const entries = [];   /* {bytes, unit, make?, meta?} */
  const push = (bytes, unit, make, meta) => entries.push({ bytes, unit, make, meta });
  for (const u of base) {
    let parts;
    if (u.extent.kind === "sheet-range" && u.text.length > CAPTURE_TEXT_UNIT_CAP) {
      const sp = sheetPlan(u);
      if (sp) {
        const first = entries.length;
        sp.blocks.forEach((b, k) => push(b.bytes, null, () => sheetBlockAt(u, sheets[u.seq], sp, k, first + k), { sheet: u, sheetAt: sheets[u.seq], plan: sp, first: b.first }));
        continue;
      }
      parts = sheetBlocks({ ...u, extent: { ...u.extent, range: u.extent.range } }, sheets[u.seq]);
    }
    else if (u.text.length > CAPTURE_TEXT_UNIT_CAP)   /* R47 (G128d): a page, slide, paragraph or part over the cap, as its chunks */
      parts = chunkUnits(u.text).map((c, k) => ({ ...u, extent: { ...u.extent, run: k }, text: c.text,
                                                  ...(k > 0 ? { overlap: c.overlap } : {}), ...(c.lead ? { leadWords: 1 } : {}) }));
    else parts = [u];
    for (const { leadWords = 0, ...p } of parts) {
      const cut = p.text.length > CAPTURE_TEXT_UNIT_CAP;
      const unit = withOwnWords({ ...p, seq: entries.length, text: cut ? p.text.slice(0, CAPTURE_TEXT_UNIT_CAP) : p.text, ...(cut || p.truncated ? { truncated: true } : {}) }, leadWords);
      push(utf8Length(unit.text), unit);
    }
  }
  return unitPlanOf(entries);
}
/* A plan over entries `{bytes, unit, make?}`: `n`, the bytes of unit `k`, unit `k` (built once), the bytes of the units before `k`. */
function unitPlanOf(entries) {
  return { n: entries.length,
           sizeAt: (k) => entries[k].bytes,
           unitAt: (k) => (entries[k].unit ??= entries[k].make()),
           metaAt: (k) => entries[k].meta,
           bytesBefore: (upto) => { let n = 0; for (let k = 0; k < upto; k++) n += entries[k].bytes; return n; } };
}
const unitPlanOfList = (list) => unitPlanOf(list.map((unit) => ({ bytes: utf8Length(unit.text), unit })));

/* A piece of a ready plan of units, from index `i`. */
function listPiece(plan, { i, budget, maxUnits }) {
  const units = [];
  let room = budget, at = i;
  for (; at < plan.n; at++) {
    const size = plan.sizeAt(at) + ACQUIRE_TEXT_UNIT_ENVELOPE;
    if (!fits(units, size, room, maxUnits)) break;
    room -= size; units.push(plan.unitAt(at));
  }
  return { units, more: at < plan.n, next: at };
}

/* Reads a cursor against what is in hand: `{at}` or `{refused}`. `shape` is "t" (a text read as text) or "u" (a list). */
function cursorIn(cursor, { sha, shape, chars, n }) {
  const bad = () => refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
  const c = unb64(cursor);
  if (!c || c.v !== 1 || c.s !== sha || c.k !== shape) return bad();
  if (shape === "t") {
    if (c.c !== chars || ![c.o, c.p, c.q, c.r].every(natural) || c.o >= chars) return bad();
    return { at: { o: c.o, p: c.p, q: c.q, r: c.r } };
  }
  if (c.n !== n || !natural(c.i) || c.i >= n) return bad();
  return { at: c.i };
}

/* A PDF range cursor: `{from}` (the first page of this piece) and `n` (the pages in the document), or `{refused}`. */
function rangeCursorIn(cursor, { sha }) {
  if (cursor == null) return { from: 0, n: null };
  const c = unb64(cursor);
  if (c && c.v === 1 && c.s === sha && c.k === "u") return { list: true };   /* a list cursor: this document is read whole, as the entry reads it */
  if (!c || c.v !== 1 || c.s !== sha || c.k !== "p" || !natural(c.i) || !natural(c.n) || c.i >= c.n)
    return refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
  return { from: c.i, n: c.n };
}

/* One piece of a PDF's range text: the units of the pages the range holds (seq the page, as a whole read numbers them),
   within the budget; `next` is the first page not yet read. */
function rangePieceAnswer(i2text, { sha, from, count, total, budget, maxUnits }) {
  const all = (allUnitsOf(i2text) || []).flatMap((u) => chunkedUnit({ ...u, seq: u.extent.page }));   /* R47: a page over the cap as its chunks */
  const plan = unitPlanOfList(all);
  const p = listPiece(plan, { i: 0, budget, maxUnits });
  const next = p.more ? all[p.next].extent.page : from + count;
  const more = next > from && next < total;   /* R46: a range that advanced nothing is never `more` */
  let words = 0;
  for (const u of p.units) words += wordsOfUnit(u);
  return { units: p.units, from, next,
           fields: { more, cursor: more ? b64({ v: 1, s: sha, k: "p", n: total, i: next }) : null, read_through: next, total },
           piece: { units: p.units.length, words, pages: [from, next] } };
}

/* One piece of a text read as text: `{refused}` or `{units, piece, answer}` where `answer` is the cursor fields. */
function textPieceAnswer(visible, { html, sha, cursor, budget, maxUnits }) {
  let at = null;
  if (cursor != null) {
    const r = cursorIn(cursor, { sha, shape: "t", chars: visible.length });
    if (r.refused) return r;
    if (r.at.o > 0 && !/\s/.test(visible[r.at.o - 1])) return refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
    at = r.at;
  }
  const p = textPiece(visible, { html, at, budget, maxUnits });
  const cur = p.more ? b64({ v: 1, s: sha, k: "t", c: visible.length, ...p.at }) : null;
  const through = p.more ? utf8Length(visible.slice(0, p.at.o)) : utf8Length(visible);
  let words = 0;
  for (const u of p.units) words += wordsOfUnit(u);
  return { units: p.units, grain: p.grain, at: p.at,
           fields: { more: p.more, cursor: cur, read_through: through, total: utf8Length(visible) },
           piece: { units: p.units.length, words } };
}

/* One piece of a list of units (a format entry's text). */
function listPieceAnswer(plan, { sha, cursor, budget, maxUnits }) {
  let i = 0;
  if (cursor != null) {
    const r = cursorIn(cursor, { sha, shape: "u", n: plan.n });
    if (r.refused) return r;
    i = r.at;
  }
  const p = listPiece(plan, { i, budget, maxUnits });
  let words = 0;
  for (const u of p.units) words += wordsOfUnit(u);
  return { units: p.units, next: p.next,
           fields: { more: p.more, cursor: p.more ? b64({ v: 1, s: sha, k: "u", n: plan.n, i: p.next }) : null,
                     read_through: plan.bytesBefore(p.next), total: plan.bytesBefore(plan.n) },
           piece: { units: p.units.length, words } };
}

/* ===================================================================== *
 * The reader contract's source and plan (R45; fix round 9, G130, G132).
 * ===================================================================== */

/* R45: a capture's bytes as a range source, `{size, readRange(offset, length)}`, over the evidence store `read` is handed: the whole
   object by one ranged read when it is held whole, else across the parts the document states, in order (the parts of a capture held
   in parts, never looked up anywhere; `acquisition` R113's `readRange` is the same shape, which a caller may hand in its place).
   `readRange` answers the bytes that exist (a range past the end answers fewer, one at or past it none) or `{ok: false, reason}`,
   and never throws; `reads` counts the ranges asked, `[offset, length]` each. */
export function rangeSource(evidence, doc) {
  const sha = doc && doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : null;
  const parts = Array.isArray(doc && doc.parts) ? doc.parts.filter((p) => p && typeof p.sha256 === "string" && natural(p.bytes)) : null;
  const size = parts && parts.length ? parts.reduce((n, p) => n + p.bytes, 0)
    : Number.isFinite(doc && doc.capture && doc.capture.bytes) ? doc.capture.bytes : null;
  const reads = [];
  /* the parts the document states are read first, each by a ranged get across the seam, and no question is asked of the store for the whole;
     a part not held, or short, leaves the range to the whole */
  const fromParts = async (offset, take) => {
    const out = new Uint8Array(take);
    let at = 0, start = 0;
    for (const p of parts) {
      const end = start + p.bytes, from = Math.max(offset, start), to = Math.min(offset + take, end);
      if (to > from) {
        const got = await rangeBytes(evidence, p.sha256, from - start, to - from);
        if (!got || got.bytes.length < to - from) return null;
        out.set(got.bytes.subarray(0, to - from), at); at += to - from;
      }
      start = end;
      if (start >= offset + take) break;
    }
    return out;
  };
  const readRange = async (offset, length) => {
    reads.push([offset, length]);
    try {
      if (!evidence || !sha || !natural(offset) || !natural(length)) return { ok: false, reason: "NOT_HELD" };
      if (size !== null && (offset >= size || length === 0)) return new Uint8Array(0);
      const take = size !== null ? Math.min(length, size - offset) : length;
      if (parts && parts.length) { const got = await fromParts(offset, take); if (got) return got; }
      const got = await rangeBytes(evidence, sha, offset, take);
      return got && got.bytes.length >= take ? got.bytes.subarray(0, take) : { ok: false, reason: "NOT_HELD" };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e).slice(0, 120) || "STORE_FAILED" };
    }
  };
  return { size, readRange, reads };
}

/* R45: the grain each kind is read in, and the `READ_BOUNDS` row its file is judged against (the light kinds their own; every other
   kind the whole-load ceiling `bytesOf` keeps, R37). */
const PLAN_HEAD = 1024 * 1024, PLAN_TAIL = 64 * 1024;
const MODE_OF = { pdf: "pages", jpeg: "pages", png: "pages", csv: "rows", tsv: "rows", xlsx: "rows", ods: "rows",
                  text: "windows", json: "windows", xml: "windows", html: "windows" };
const BOUND_ROW_OF = { text: ["text", "bytes"], html: ["text", "bytes"], undetermined: ["text", "bytes"], csv: ["csv", "bytes"],
                       tsv: ["tsv", "bytes"], json: ["json", "bytes"], xml: ["xml", "bytes"] };
/* R45: `plan(source, {declared, name})` reads a head range and a tail range and the declared size, no body: `kind` detected from
   them (`format-registry.detectFormat` over the two ranges: an image asked before a PDF or a page, an office or OpenDocument file
   recognised by its tail directory), `pages` or `rows` the declared count when the ranges state it (null here: no body is read),
   `verdict` `{ok, size, limit, bound_key}` the size against the kind's bound, `mode` the grain. A range the two do not hold is read
   from the source (counted in its `reads`). */
export async function plan(source, { declared = null, name = null } = {}) {
  const size = source && Number.isFinite(source.size) ? source.size : null;
  if (!source || typeof source.readRange !== "function" || size === null)
    return { kind: "undetermined", pages: null, rows: null, verdict: { ok: false, size, limit: null, bound_key: null }, mode: null };
  const asBytes = (x) => (x instanceof Uint8Array ? x : null);
  const head = asBytes(await source.readRange(0, Math.min(size, PLAN_HEAD))) || new Uint8Array(0);
  const tailAt = Math.max(head.length, size - PLAN_TAIL);
  const tail = tailAt < size ? asBytes(await source.readRange(tailAt, size - tailAt)) || new Uint8Array(0) : new Uint8Array(0);
  const cached = { size, readRange: async (o, n) => {
    if (o + n <= head.length) return head.subarray(o, o + n);
    if (o >= tailAt && o + n <= tailAt + tail.length) return tail.subarray(o - tailAt, o - tailAt + n);
    return source.readRange(o, n);
  } };
  const found = await detectFormat(cached, declared, name);
  const kind = found && typeof found.format === "string" ? found.format : "undetermined";
  const row = BOUND_ROW_OF[kind] || WHOLE_READ_ROW;
  const st = statement(row[0], row[1], size);
  const mode = MODE_OF[kind] || "whole";
  return { kind, pages: null, rows: null, verdict: { ok: size <= st.bound, size, limit: st.bound, bound_key: st.key }, mode };
}

/* R39 (fix round 6, G6; K4570): a document that states nothing of its object but a digest. */
export function isBareStub(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
  const c = doc.capture;
  return !!c && typeof c === "object" && typeof c.sha256 === "string" && !Array.isArray(doc.parts)
    && !Number.isFinite(c.bytes) && typeof doc.retrieved !== "string" && !(doc.profile && typeof doc.profile === "object");
}

/* ===================================================================== *
 * A reading in pieces by a byte window (R40, G68).
 * ===================================================================== */

/* G68 (fix round 7; diagnosis-R7-reading.md R1): every tick re-opened the whole object: a 17 MiB CSV tick decoded the 17 MiB to
   cut one piece, and a 12 MB text decoded its 12 MB. The first piece still reads the whole (R35's totals, R14's provenance and the
   classification are over the whole text), and then names where the next piece begins in the OBJECT: a cursor of kind `w` holds
   a byte offset, and a later tick asks the evidence store for that window alone (record-core R88's ranged `get`) and reads the
   piece from it. The units, their `seq`, extents, words and the totals are exactly those of the cursors above (`t`, `u`): the
   same functions cut the same runs and blocks, only from a window. What a window cannot know it is told by the cursor: the
   text's grain, the sheet's last column, whether a row was cut, the bytes already read. A capture that cannot be windowed (an
   HTML page, whose visible text is judged over the whole markup; a text that is not valid UTF-8; a CSV in UTF-16; any other
   format; an object not held whole under the document's digest) is given the cursor above, read whole by each tick as before,
   and a cursor of the kinds above is still read as it was. */
export const WINDOW_BYTES = 1024 * 1024;
/* The bytes of a CSV's head that its encoding and delimiter signatures read (csv-reader's SIGNATURE_WINDOW_BYTES, 1 MiB, past a
   BOM): a window of the body is decoded beside this head, so the entry finds the dialect it found over the whole. */
const CSV_HEAD_BYTES = 1024 * 1024 + 3;
/* A chunk of a CSV is cut at the first record boundary at or after its nominal size; the bytes read beyond it to find one. */
const CSV_SLACK_BYTES = 64 * 1024;
const FATAL_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const LENIENT_UTF8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

/* The bytes [offset, offset + length) of a held object, or null when it is not held. A store that ignored the range and gave the
   whole object is cut here. `size` is the object's own, or null when the store did not say. */
async function rangeBytes(evidence, digest, offset, length) {
  const o = await evidence.get(digest, { range: { offset, length: Math.max(1, length) } });
  if (!o) return null;
  const all = new Uint8Array(await o.arrayBuffer());
  const size = Number.isFinite(o.size) ? o.size : null;
  if (all.length > length && size !== null && all.length === size) return { bytes: all.subarray(offset, offset + length), size };
  return { bytes: all, size };
}

/* The window cursor of a cursor string, or null when it is not one. */
function windowCursorOf(cursor) {
  const c = unb64(cursor);
  return c && c.v === 1 && c.k === "w" ? c : null;
}
/* R45 (R23): the cursor of a byte window, opaque to its holder: `{m, n, ob, ...}` (the kind of window, the object's size, the offset
   where the next piece begins, and what a window cannot know) under the document's digest. */
export const windowCursor = (sha, o) => b64({ v: 1, k: "w", s: sha, ...o });
const mismatch = () => refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");

/* --- a text read as text ------------------------------------------------------------------------------------------------ */

/* The end of the runs a window holds whole: the last separator (a blank line for paragraphs, a line break for lines) with
   something after it in the window, else 0. A match that reaches the window's end might go on beyond it, so it is no end. */
function completeRunsEnd(vis, grain) {
  if (grain === "lines") { const i = vis.lastIndexOf("\n"); return i < 0 ? 0 : i + 1; }
  const sep = new RegExp(BLANK_LINE_RUN.source, "g");
  let end = 0;
  for (let m = sep.exec(vis); m; m = sep.exec(vis)) {
    const e = m.index + m[0].length;
    if (e < vis.length) end = e;
  }
  return end;
}

/* The cursor a first (or `t`) piece of a text read as text hands on when the next piece can be read by a window, else null.
   `at` is textPiece's resume point (the scan offset in characters, the next `para`, `seq` and run), `through` the UTF-8 bytes of
   the text before it. The text is the object's bytes decoded without loss (valid UTF-8; a BOM only at its start). */
async function textWindowCursorOf(evidence, { sha, bytes, text, whole, at, through, grain }) {
  if (!whole || !at || !(bytes instanceof Uint8Array)) return null;
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  if (text.includes("\ufffd")) { try { FATAL_UTF8.decode(bytes); } catch { return null; } }
  if (utf8Length(text) !== bytes.length - bom) return null;
  /* the window is an improvement: a store that cannot answer a range leaves the piece its cursor of the old kind */
  try { const probe = await rangeBytes(evidence, sha, through + bom, 1); if (!probe || probe.bytes.length !== 1) return null; } catch { return null; }
  return windowCursor(sha, { m: "t", n: bytes.length, ob: through + bom, bm: bom, g: grain === "lines" ? 1 : 0, p: at.p, q: at.q, r: at.r });
}

/* R50, R49 (job 40, B44 (1)): a window of a text in any encoding R49 reads. The head's encoding (ooxml's `decodeText`) is kept in the cursor (`en`, absent for UTF-8 and
   US-ASCII) and each window is decoded by it: UTF-8 as before; a single-byte charset (windows-125x, ISO-8859-x) one byte a character; UTF-16 in even offsets, a surrogate pair
   kept whole. `pre` the bytes of context read before a window, `startOk` whether the offset begins a character, `end` the bytes of a window that end at a character, `bytes`
   the bytes of a decoded string. */
const SINGLE_BYTE = /^(?:windows-125\d|iso-8859-\d+|ibm\d+|cp\d+|macintosh|koi8-[ru]|x-mac-cyrillic)$/;
const A_UTF8 = { pre: 4, startOk: (b, pre) => (b[pre] & 0xc0) !== 0x80, lenient: (x) => LENIENT_UTF8.decode(x), decode: (x) => FATAL_UTF8.decode(x),
  end: (b, pre, len) => { let i = len - 1; while (i > 0 && (b[pre + i] & 0xc0) === 0x80) i--; const lead = b[pre + i], need = lead < 0x80 ? 1 : lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1; return i + need > len ? i : len; },
  bytes: (str) => utf8Length(str) };
export const windowEncodable = (en) => !en || en === "utf-8" || en === "us-ascii" || en === "utf-16le" || en === "utf-16be" || SINGLE_BYTE.test(en);
function adapterFor(en) {
  if (!en || en === "utf-8" || en === "us-ascii") return A_UTF8;
  const td = new TextDecoder(en, { ignoreBOM: true });
  if (en === "utf-16le" || en === "utf-16be") {
    const le = en === "utf-16le";
    return { pre: 2, startOk: (b, pre, c) => (c.ob - c.bm) % 2 === 0, lenient: (x) => td.decode(x), decode: (x) => td.decode(x),
      end: (b, pre, len) => { let e = len - (len % 2); if (e >= 2 && ((le ? b[pre + e - 1] : b[pre + e - 2]) & 0xfc) === 0xd8) e -= 2; return e; }, bytes: (str) => str.length * 2 };
  }
  return { pre: 1, startOk: () => true, lenient: (x) => td.decode(x), decode: (x) => td.decode(x), end: (b, pre, len) => len, bytes: (str) => str.length };
}

/* R50 (G131i; K4834): the start and end of the first separator of a text's runs in `vis` (a blank line for paragraphs, a line break for lines), or null. */
function firstSeparator(vis, grain) {
  if (grain === "lines") { const i = vis.indexOf("\n"); return i < 0 ? null : [i, i + 1]; }
  const m = new RegExp(BLANK_LINE_RUN.source).exec(vis);
  return m ? [m.index, m.index + m[0].length] : null;
}
/* R50: the units of a run begun in an earlier window (`md`) or not ended in this one: `region` is the run's text in the window (to its separator, or to
   the window's end), cut as `chunksOf` cuts a run over the cap (R47), the same chunks the whole run would give since the cut is greedy from the run's
   start. A run still open keeps its last chunk for the next window (its end is not known); a complete run gives all. `{units, used, done, runs}`: the
   characters of `region` the units took, whether the run ended in them, and the run index the next chunk takes. */
function openRunPiece(region, { c, complete, room, maxUnits, room0 }) {
  const body = complete ? region.trimEnd() : region;
  const lead = c.md ? 0 : body.length - body.trimStart().length;
  const text = body.slice(lead);
  const chunks = text.length > CAPTURE_TEXT_UNIT_CAP ? chunksOf(text) : [text];
  const usable = complete ? chunks : chunks.slice(0, -1);
  const units = [];
  /* a cursor of a run's start that names a chunk already given (`r`) skips those chunks; one inside a run (`md`) begins at its chunk and numbers on from `r` */
  const skip = c.md ? 0 : Math.min(c.r || 0, usable.length), base = c.md ? c.r : 0;
  let used = lead, k = skip, ld = c.md ? c.ld === 1 : false;
  for (let i = 0; i < skip; i++) used += usable[i].length;
  for (; k < usable.length; k++) {
    const size = utf8Length(usable[k]) + ACQUIRE_TEXT_UNIT_ENVELOPE;
    if (!fits(units, size, room, maxUnits)) break;
    room -= size;
    const lead1 = (k === 0 ? ld : continuesWord(usable[k - 1], usable[k])) ? 1 : 0;
    units.push(withOwnWords(unitOf(c.p, chunks.length > 1 || c.md ? base + k : null, c.q + units.length, usable[k]), lead1));
    used += usable[k].length;
  }
  const done = complete && k === usable.length;
  const next = chunks[k];
  const carry = k > 0 && next !== undefined ? continuesWord(usable[k - 1], next) : ld;
  return { units, used: done ? region.length : used, done, runs: base + k, ld: carry, room };
}
/* A later piece of a text read as text, from the window the cursor names. R50 (fix round 9, G131i): a run with no separator in the window is read in
   chunks from the window (`openRunPiece`), its cursor marked `md`, so a text of one 50 MB line is read as a text of many lines is: neither holds the file
   whole. `src` is the range source of a capture read by range from its first piece (`ro`): its parts first, never the whole (R45). */
async function textWindowTick(evidence, sha, c, { budget, maxUnits, windowBytes }, src = null) {
  if (![c.n, c.ob, c.bm, c.p, c.q, c.r].every(natural) || !(c.g === 0 || c.g === 1) || c.ob < c.bm || c.ob >= c.n || (c.bm !== 0 && c.bm !== 2 && c.bm !== 3) || (c.en !== undefined && !(typeof c.en === "string" && windowEncodable(c.en)))) return mismatch();
  const A = adapterFor(c.en);
  const enc = c.en ? { en: c.en } : {};
  const grain = c.g === 1 ? "lines" : "paragraphs";
  const pre = Math.min(A.pre, c.ob);
  const mid = c.md === 1;
  const ro = c.ro === 1;
  const get = async (o, l) => {
    if (!src) return rangeBytes(evidence, sha, o, l);
    const b = await src.readRange(o, l);
    return b instanceof Uint8Array ? { bytes: b, size: src.size } : null;
  };
  /* a window is what the piece can use: a piece holds at most `budget` bytes of units, each charged its envelope too, so a larger window is bytes pulled for nothing (R50: at most twice the file) */
  let want = Math.min(windowBytes, Math.max(32768, Math.ceil((Number.isFinite(budget) ? budget : windowBytes) / 2)));
  /* a window that holds no whole run is made longer: doubled, or for a run with no separator at once to what a piece can take of it (its budget and the chunk kept back) */
  const chunksFit = Math.max(1, Math.floor(Math.min(Number.isFinite(budget) ? budget : 4 * 1048576, 4 * 1048576) / (CAPTURE_TEXT_UNIT_CAP + ACQUIRE_TEXT_UNIT_ENVELOPE)));
  const openTarget = (chunksFit + 1) * CAPTURE_TEXT_UNIT_CAP + 4096;
  if (mid) want = Math.max(want, openTarget);   /* inside a run: the window the chunks a piece takes need, at once */
  const grow = (open) => { want = open ? Math.max(want * 2, openTarget) : want * 2; };
  for (;;) {
    const len = Math.min(want, c.n - c.ob);
    const got = await get(c.ob - pre, pre + len);
    if (!got) return { gone: true };
    if (got.size !== null && got.size !== c.n) return mismatch();
    const b = got.bytes;
    if (b.length !== pre + len) return mismatch();
    /* the offset begins a character, and (but inside a run) the character before it is white space (or it is the text's first): the start of a run */
    if (!A.startOk(b, pre, c)) return mismatch();
    if (c.ob > c.bm && !mid) {
      const before = A.lenient(b.subarray(0, pre));
      if (!before.length || !/\s/.test(before[before.length - 1])) return mismatch();
    }
    const eof = c.ob + len >= c.n;
    let end = len;   /* a window not at the end of the object may cut a character: it ends at the one before */
    if (!eof) end = A.end(b, pre, len);
    let vis;
    try { vis = A.decode(b.subarray(pre, pre + end)); } catch { return mismatch(); }
    const sep = firstSeparator(vis, grain);
    const upto = eof ? vis.length : completeRunsEnd(vis, grain);
    const openStart = mid || (!eof && upto === 0);   /* the window begins inside a run, or holds no whole run */
    /* an open run is cut into chunks only from a window longer than two units; shorter, a longer window is asked for */
    if (openStart && !eof && !sep && vis.length <= 2 * CAPTURE_TEXT_UNIT_CAP) { grow(true); continue; }
    let units = [], room = budget, p = c.p, q = c.q, pos = 0, stopped = false;
    if (openStart) {
      const complete = !!sep || eof;
      const region = vis.slice(0, sep ? sep[0] : vis.length);
      const o = openRunPiece(region, { c: { ...c, md: mid ? 1 : 0 }, complete, room, maxUnits });
      units = o.units;
      if (!o.done) {   /* more of this run follows: the next window takes it up at the chunk after the last given */
        if (!units.length) { if (!eof) { grow(true); continue; } return mismatch(); }
        const ob = c.ob + A.bytes(vis.slice(0, o.used));
        let words = 0; for (const u of units) words += wordsOfUnit(u);
        const cursor = windowCursor(sha, { m: "t", n: c.n, bm: c.bm, g: c.g, ...enc, ob, p, q: q + units.length, r: o.runs, md: 1, ld: o.ld ? 1 : 0, ...(ro ? { ro: 1, wr: (c.wr || 0) + words } : {}) });
        return { units, fields: { more: true, cursor, read_through: ob - c.bm, total: c.n - c.bm }, piece: { units: units.length, words } };
      }
      pos = sep ? sep[1] : vis.length; p += 1; q += units.length;
      for (const u of units) room -= utf8Length(u.text) + ACQUIRE_TEXT_UNIT_ENVELOPE;
      stopped = units.length >= maxUnits || room <= 0;
    }
    const text = vis.slice(pos, Math.max(pos, upto));
    let pc = null;
    if (!stopped && text.length) {
      pc = textPiece(text, { html: false, at: { o: 0, p, q, r: openStart ? 0 : c.r }, budget: room, maxUnits: maxUnits - units.length, grain });
      if (!pc.more && !eof && !units.length) { grow(false); continue; }   /* every whole run in the window was taken and the piece is not full: a longer window */
    }
    const all = pc ? [...units, ...pc.units] : units;
    let words = 0; for (const u of all) words += wordsOfUnit(u);
    /* where the next piece begins: inside the text the piece stopped in, else after the last whole run (the tail run begins it), else the end */
    const at = pc && pc.more ? { c: pos + pc.at.o, p: pc.at.p, q: pc.at.q, r: pc.at.r }
      : { c: stopped && !pc ? pos : Math.max(pos, upto), p: pc ? pc.para : p, q: pc ? pc.seq : q, r: 0 };
    const more = stopped || (pc && pc.more) || !eof;
    const ob = more ? c.ob + A.bytes(vis.slice(0, at.c)) : c.n;
    if (more && !all.length && ob === c.ob) { if (!eof) { grow(false); continue; } return mismatch(); }
    const cursor = more ? windowCursor(sha, { m: "t", n: c.n, bm: c.bm, g: c.g, ...enc, ob, p: at.p, q: at.q, r: at.r, ...(ro ? { ro: 1, wr: (c.wr || 0) + words } : {}) }) : null;
    return { units: all, fields: { more, cursor, read_through: ob - c.bm, total: c.n - c.bm }, piece: { units: all.length, words },
             ...(!more && ro ? { facts: { words_total: (c.wr || 0) + words } } : {}) };
  }
}

/* --- a CSV ---------------------------------------------------------------------------------------------------------------- */

/* The record boundaries of CSV bytes, as csv-reader walks records (RFC 4180): a line break outside double quotes ends a record, a
   CR, an LF or a CRLF as one; a double quote opens or closes quotes, so a doubled one inside quotes is two turns and no change.
   The delimiter takes no part. `b` begins at the object offset `base`; each offset where a record ends and the next begins is
   pushed to `out`, in order. `st` carries the scan between pieces of one run ({inQ, cr, crAt}); `finishScan` settles a CR that
   ended the last piece. An offset at the end of the object begins no record and is for the caller to drop. */
/* G131b (fix round 9; csv-reader's rule, its G131b): a double quote opens quotes only at the start of a field (a record's first byte,
   or the byte after the delimiter `d`); anywhere else it is a character of the field, so a stray `12" pipe` swallows nothing. Inside
   quotes a quote closes them, and a quote right after the closing one is an escaped quote that reopens them. */
function newScan(d = 0x2c) { return { inQ: false, cr: false, crAt: 0, start: true, closed: false, d }; }
function scanBoundaries(b, base, st, out) {
  let inQ = st.inQ, cr = st.cr, crAt = st.crAt, start = st.start, closed = st.closed;
  const d = st.d;
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (cr) { cr = false; start = true; if (c === 0x0a) { out.push(base + i + 1); continue; } out.push(crAt); }
    if (inQ) { if (c === 0x22) { inQ = false; closed = true; } continue; }
    if (closed && c === 0x22) { inQ = true; closed = false; continue; }
    closed = false;
    if (c === 0x22 && start) { inQ = true; start = false; }
    else if (c === 0x0a) { out.push(base + i + 1); start = true; }
    else if (c === 0x0d) { cr = true; crAt = base + i + 1; }
    else start = c === d;
  }
  Object.assign(st, { inQ, cr, crAt, start, closed });
}
/* the delimiter's byte from the dialect's name or character (a comma when it names none) */
const DELIMITER_BYTE = { comma: 0x2c, semicolon: 0x3b, tab: 0x09, pipe: 0x7c, ",": 0x2c, ";": 0x3b, "\t": 0x09, "|": 0x7c };
const delimiterByteOf = (i2text) => DELIMITER_BYTE[i2text && i2text.dialect && i2text.dialect.delimiter] ?? 0x2c;
function finishScan(st, out) { if (st.cr) { st.cr = false; out.push(st.crAt); } }

/* From a first (or `u`) piece of a CSV whose next block is the one at line `L`: the cursor that reads the next piece by a window,
   or null when it cannot (the object is not held whole, its encoding is UTF-16, the file is not longer than the head a window
   needs, the sheet's lines are not named by row, or its header leaves no room beside a row). `meta` is the plan's entry for the
   block, `read` and `total` the bytes of units before it and in all. Scans the head of the object in the store, as far as the block's
   record (the first piece's size), never the file. */
async function csvWindowCursorOf(evidence, args) {
  try { return await csvWindowCursorIn(evidence, args); }
  catch { return null; }   /* the cursor of a window is an improvement: a store that cannot answer a range leaves the piece its cursor of the old kind */
}
async function csvWindowCursorIn(evidence, { sha, whole, size, i2text, meta, next, read, total }) {
  if (!whole || !meta || !meta.plan || !Number.isInteger(size) || !i2text || i2text.container !== "csv") return null;
  const enc = i2text.dialect ? i2text.dialect.encoding : undefined;
  if (!(enc === "utf-8" || enc === "us-ascii" || enc === null)) return null;
  const sheet = meta.sheetAt, u = meta.sheet, lines = meta.plan.lines;
  if (!sheet || !Array.isArray(sheet.lineRows) || sheet.lineRows.length !== lines || !sheet.lineRows.every(Number.isInteger)) return null;
  if (!u || !u.extent || u.extent.kind !== "sheet-range" || typeof u.extent.sheet !== "string" || typeof u.extent.range !== "string") return null;
  const L = meta.first, row = sheet.lineRows[L];
  if (!(L > 0) || !(row >= 1)) return null;
  let f = L;
  while (f > 0 && sheet.lineRows[f - 1] === row) f--;
  const corner = /:\$?([A-Za-z]{1,3})\$?\d+$/.exec(u.extent.range);
  /* the object, from its start, as far as the first record at or past the head and the block's own record */
  const dl = delimiterByteOf(i2text);
  const st = newScan(dl), seen = [];
  let target = row === 1 ? 0 : null, he = null, hr = null, count = 0;
  for (let at = 0; at < size && (target === null || he === null); at += WINDOW_BYTES) {
    const got = await rangeBytes(evidence, sha, at, Math.min(WINDOW_BYTES, size - at));
    if (!got || got.bytes.length !== Math.min(WINDOW_BYTES, size - at)) return null;
    seen.length = 0;
    scanBoundaries(got.bytes, at, st, seen);
    if (at + got.bytes.length >= size) finishScan(st, seen);
    for (const b of seen) {
      if (b >= size) continue;
      if (target === null && count === row - 2) target = b;
      if (he === null && b >= CSV_HEAD_BYTES) { he = b; hr = count + 1; }
      count++;
    }
  }
  if (target === null || he === null) return null;
  return windowCursor(sha, { m: "c", n: size, ob: target, rw: row, li: L, sk: L - f, bi: next, rt: read, tt: total, he, hr, dl,
                             lr: meta.plan.longRow ? 1 : 0, lc: corner ? corner[1].toUpperCase() : "", rg: u.extent.range, sh: u.extent.sheet });
}

/* A later piece of a CSV, from the window the cursor names: the blocks R41 makes of the sheet's lines, built from the lines of the
   records in a window, and the head the entry's signatures need before it. The lines are the entry's own (its text of the head
   and the window together), so a line, its row and its words are what the whole read gives. */
async function csvWindowTick(evidence, sha, c, { budget, maxUnits, windowBytes }, src = null, first0 = null) {
  const nums = [c.n, c.ob, c.rw, c.li, c.sk, c.bi, c.rt, c.tt, c.he, c.hr];
  if (!nums.every(natural) || !(c.lr === 0 || c.lr === 1) || typeof c.lc !== "string" || typeof c.rg !== "string" || typeof c.sh !== "string") return mismatch();
  if (c.ob >= c.n || c.he >= c.n || c.he < CSV_HEAD_BYTES || c.rw < 1 || c.sk > c.li || !c.sh) return mismatch();
  /* K4868: a cursor made by the first piece of a CSV read by range (`ro`) also carries the widest row seen (`cn`, columns) and the words before
     it (`wr`), and counts its progress in the object's own bytes; its bytes come through the range source (the object held whole or in parts). */
  const ro = c.ro === 1;
  if (ro && !(natural(c.cn) && c.cn >= 1 && natural(c.wr) && src)) return mismatch();
  const rb = src ? async (offset, length) => { const r = await src.readRange(offset, length); return r instanceof Uint8Array ? { bytes: r, size: src.size } : null; }
                 : (offset, length) => rangeBytes(evidence, sha, offset, length);
  let cols = ro ? c.cn : 0;
  const entry = getFormat("csv");
  if (!entry || typeof entry.text !== "function") return mismatch();
  const cap = CAPTURE_TEXT_UNIT_CAP;
  const units = [];
  let room = budget, added = 0, seq = c.bi, stop = null;
  let headLine = null, limit = 0, headWords = 0;
  let cur = [], curRows = [], size = 0, first = null, last = 0;
  const build = () => {
    /* the sheet's first block begins at its first line, the header, and repeats nothing (sheetBlocks' own rule) */
    const lead = first.line > 0;
    const text = lead ? `${headLine}\n${cur.join("\n")}` : cur.join("\n");
    const range = ro ? `A${first.row}:${letterOf(cols)}${last}` : c.lc ? `A${first.row}:${c.lc}${last}` : c.rg;
    const unit = { extent: { kind: "sheet-range", sheet: c.sh, range }, seq, text, kind: "body", lineRows: lead ? [1, ...curRows] : [...curRows],
                   ...(c.lr ? { truncated: true } : {}) };
    return withOwnWords(unit, lead ? headWords : 0);
  };
  /* the open block is whole; `nextAt` is the first line of the block after it (null at the end of the sheet) */
  const emit = (nextAt) => {
    const unit = build(), bytes = utf8Length(unit.text);
    if (!fits(units, bytes + ACQUIRE_TEXT_UNIT_ENVELOPE, room, maxUnits)) { stop = first; return false; }
    units.push(unit); room -= bytes + ACQUIRE_TEXT_UNIT_ENVELOPE; added += bytes; seq++;
    cur = []; curRows = []; size = 0;
    if (nextAt && units.length >= maxUnits) { stop = nextAt; return false; }
    return true;
  };
  const feed = (line, at) => {
    const room1 = at.line === 0 ? cap : limit;   /* the header line, a block of its own, has the whole cap */
    const l = line.length > room1 ? line.slice(0, room1) : line;   /* a row over the cap stays one cut row (R41) */
    if (cur.length && size + l.length + 1 > limit && !emit(at)) return false;
    if (!cur.length) first = at;
    cur.push(l); curRows.push(at.row); size += l.length + 1; last = at.row;
    return true;
  };

  let start = c.ob < c.he ? 0 : c.ob;          /* the chunk's first byte: a record boundary */
  let rowBase = c.ob < c.he ? 1 : c.rw;        /* the row of the record that begins it */
  let skip = c.ob < c.he ? c.li : c.sk;        /* lines the chunk gives that are before the next block */
  let lineIdx = c.ob < c.he ? 0 : c.li - c.sk;  /* the index, in the sheet's lines, of the chunk's first line */
  let head = null, eofSeen = false;
  while (!eofSeen && stop === null) {
    const withHead = start >= c.he;
    /* the chunk: from `start` to the first record boundary at or after its nominal size (and, from the start of the object, past
       the head), so the signatures read what they read over the whole */
    let end = null, starts = null, region = null;
    for (let want = windowBytes; end === null; want *= 2) {
      const aim = Math.max(start + want, withHead ? 0 : c.he);
      const len = Math.min(c.n - start, aim - start + CSV_SLACK_BYTES);
      const got = await rb(start, len);
      if (!got) return { gone: true };
      if (got.size !== null && got.size !== c.n) return mismatch();
      if (got.bytes.length !== len) return mismatch();
      const st = newScan(natural(c.dl) ? c.dl : 0x2c), bounds = [];
      scanBoundaries(got.bytes, start, st, bounds);
      const atEnd = start + len >= c.n;
      if (atEnd) finishScan(st, bounds);
      const at = bounds.find((b) => b >= aim && b < c.n);
      if (at !== undefined) { end = at; starts = [start, ...bounds.filter((b) => b < at)]; region = got.bytes.subarray(0, at - start); }
      else if (atEnd) { end = c.n; eofSeen = true; starts = [start, ...bounds.filter((b) => b < c.n)]; region = got.bytes; }
    }
    if (withHead && !head) {
      const h = await rb(0, c.he);
      if (!h || h.bytes.length !== c.he) return h ? mismatch() : { gone: true };
      head = h.bytes;
    }
    let input = region;
    if (withHead) { input = new Uint8Array(head.length + region.length); input.set(head, 0); input.set(region, head.length); }
    await yieldNow();   /* G82: the turn is given back before the entry's compute over the head and the chunk, and after it */
    /* K4868: the first piece of a read by range is handed the entry's answer over the head, which is the first chunk's bytes */
    const res = first0 && start === 0 && !withHead && region.length === first0.len ? first0.res : await entry.text(input, { inlineCellsMax: 0, yieldNow });
    await yieldNow();
    const sheet = res && res.ok !== false && Array.isArray(res.sheets) ? res.sheets[0] : null;
    if (!sheet || typeof sheet.text !== "string" || !Array.isArray(sheet.lineRows)) throw new Error("the csv entry gave no sheet for a window");
    if (ro && Number.isInteger(sheet.usedCols) && sheet.usedCols > cols) cols = sheet.usedCols;
    const rows = sheet.lineRows, all = rows.length ? sheet.text.split("\n") : [];
    if (all.length !== rows.length) throw new Error("the csv entry's lines and their rows differ for a window");
    if (headLine === null) {
      if (!all.length) return mismatch();
      headLine = all[0]; limit = cap - headLine.length - 1; headWords = wordsIn(headLine);
      if (limit < 1) return mismatch();
    }
    /* the lines of the chunk (the head's lines come first and are not the chunk's), each with where it is in the object */
    let prevJ = -1, inRec = 0;
    for (let t = 0; t < all.length && stop === null; t++) {
      const rel = rows[t] - (withHead ? c.hr : 0);
      if (rel < 1) continue;
      const j = rel - 1;
      if (j >= starts.length) throw new Error("the csv entry numbered a row past the window's records");
      inRec = j === prevJ ? inRec + 1 : 0; prevJ = j;
      const at = { offset: starts[j], row: rowBase + j, line: lineIdx, inRec };
      lineIdx++;
      if (skip > 0) { skip--; continue; }
      if (!feed(all[t], at)) break;
    }
    rowBase += starts.length;
    start = end;
    /* K4868: the first piece of a read by range ends with the head, whose bytes are already in hand: the rest is the next pieces' */
    if (first0 && stop === null && !eofSeen) {
      const nextAt = { offset: end, row: rowBase, line: lineIdx, inRec: 0 };
      if (cur.length ? emit(nextAt) : true) stop = stop ?? nextAt;
      break;
    }
  }
  if (stop === null && cur.length) emit(null);   /* the end of the sheet: its last block */
  let words = 0;
  for (const u of units) words += wordsOfUnit(u);
  const more = stop !== null;
  const read = ro && more ? stop.offset : c.rt + added;
  return { units,
           fields: { more,
                     cursor: more ? windowCursor(sha, { m: "c", n: c.n, ob: stop.offset, rw: stop.row, li: stop.line, sk: stop.inRec, bi: seq, rt: read,
                                                        tt: c.tt, he: c.he, hr: c.hr, lr: c.lr, lc: c.lc, rg: c.rg, sh: c.sh, ...(natural(c.dl) ? { dl: c.dl } : {}),
                                                        ...(ro ? { ro: 1, cn: cols, wr: c.wr + words } : {}) }) : null,
                     read_through: more ? read : c.tt, total: c.tt },
           piece: { units: units.length, words },
           /* the last piece of a read by range states the document's words, which the first could not (R35, R57) */
           ...(ro && !more ? { facts: { words_total: c.wr + words } } : {}) };
}
/* a column count as the letters a range names it by (1 is A, 27 is AA) */
function letterOf(n) { let s = ""; for (let k = Math.max(1, n); k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s; }

/* A later piece by a window cursor (R40): `{refused}` or `{gone}` (the object is not held) or the piece's units and fields. */
async function windowTick(evidence, sha, c, ask, doc) {
  if (c.s !== sha || !natural(c.n) || c.n < 1) return mismatch();
  if (c.m === "t") return textWindowTick(evidence, sha, c, ask, c.ro === 1 ? rangeSource(evidence, doc) : null);
  if (c.m === "c") return csvWindowTick(evidence, sha, c, ask, c.ro === 1 ? rangeSource(evidence, doc) : null);
  return mismatch();
}

/* K4868 (fix round 9, R45): a CSV larger than a whole read holds (`WHOLE_READ_MAX`) and within its own bound (`READ_BOUNDS` csv) is read from its
   first piece by range: the head the entry's signatures read (to the first record boundary at or past `CSV_HEAD_BYTES`) gives the dialect and
   the reading's facts, and the units come from the windows (`csvWindowTick`), so neither the object nor its text is ever held whole. `null`
   when the capture is not one (another size or kind, an encoding or a record the windows cannot take): it is read, or refused, as before. */
async function csvRangedHead(evidence, doc, { recorded, declared }) {
  const src = rangeSource(evidence, doc);
  if (!(Number.isInteger(src.size) && src.size > WHOLE_READ_MAX && src.size <= boundOf("csv", "bytes"))) return null;
  if (!(recorded === null || recorded === "csv" || recorded === "undetermined")) return null;
  const probe = await src.readRange(0, Math.min(src.size, CSV_HEAD_BYTES + 2 * CSV_SLACK_BYTES));
  if (!(probe instanceof Uint8Array) || probe.length < CSV_HEAD_BYTES + 2 * CSV_SLACK_BYTES) return null;
  if (recorded !== "csv" && detectFormat(probe, declared).format !== "csv") return null;
  const entry = getFormat("csv");
  const dialect = entry && typeof entry.dialect === "function" ? await entry.dialect(probe) : null;
  if (!dialect) return null;
  const enc = dialect.encoding;
  if (!(enc === "utf-8" || enc === "us-ascii" || enc === null)) return null;
  const dl = DELIMITER_BYTE[dialect.delimiter] ?? 0x2c;
  const bounds = [], st = newScan(dl);
  scanBoundaries(probe, 0, st, bounds);
  const i = bounds.findIndex((b) => b >= CSV_HEAD_BYTES);
  /* the first window (to the record boundary, and the slack beyond it that finds one) lies inside the probe, so the first piece reads nothing more */
  if (i < 0 || bounds[i] >= src.size || bounds[i] + CSV_SLACK_BYTES > probe.length) return null;
  const cached = { size: src.size, readRange: async (o, n) => (natural(o) && natural(n) && o + n <= probe.length ? probe.subarray(o, o + n) : src.readRange(o, n)) };
  return { src: cached, size: src.size, he: bounds[i], hr: i + 1, dl, head: probe.subarray(0, bounds[i]) };
}

/* R50 (fix round 9, G131i; K4834): a text, JSON or XML larger than a whole read holds (`WHOLE_READ_MAX`) and within the text bound (`READ_BOUNDS` text, the standard's
   50 MB) is read from its first piece by range, as a CSV is: the head (the first window) gives the reading's facts and the grain, and each piece is a byte window with
   a carry (`textWindowTick`), so neither the object nor its text is held whole. UTF-8 and US-ASCII only; another encoding of such a size is stated against the whole-read
   ceiling. `null` when the capture is not one: it is read, or refused, as before. */
async function textRangedHead(evidence, doc, { recorded, declared, textual, charset, htmlOnly = false }) {
  const src = rangeSource(evidence, doc);
  if (!(Number.isInteger(src.size) && src.size > WHOLE_READ_MAX && src.size <= boundOf("text", "bytes"))) return null;
  if (!textual || !(recorded === null || recorded === "undetermined" || recorded === "text" || recorded === "json" || recorded === "xml" || recorded === "html")) return null;
  const want = Math.min(src.size, WINDOW_BYTES + 4);
  const probe = await src.readRange(0, want);
  if (!(probe instanceof Uint8Array) || probe.length < want) return null;
  const bom16 = probe.length >= 2 && ((probe[0] === 0xff && probe[1] === 0xfe) || (probe[0] === 0xfe && probe[1] === 0xff));
  if (!bom16 && probe.includes(0) && !/^utf-16/i.test(charset || "")) {
    /* a NUL in the head: UTF-16 without a BOM, only if the decode says so below; a binary file is no text */
  }
  /* R51 (fix round 10; K5211): a web page is read here too, by the one streaming pass in windows (`htmlWindows`); its own meta charset is the page's declaration */
  const isHtml = !bom16 && !probe.includes(0) && detectFormat(probe, declared).format === "html";
  if (htmlOnly && !isHtml) return null;
  const d = decodeText(probe.subarray(0, probe.length - (probe.length % 2)), { declared: charset, name: charset, kind: isHtml ? "html" : "text" });
  if (!d.ok || d.replaced_ratio > REPLACED_TOLERANCE || !windowEncodable(d.encoding)) return null;
  const en = d.encoding === "us-ascii" ? "utf-8" : d.encoding;
  if (!/^utf-16/.test(en) && probe.includes(0)) return null;
  if (!isHtml && !/^utf-16/.test(en) && detectFormat(probe, declared).format !== "undetermined") return null;
  const bm = en === "utf-8" ? (probe.length >= 3 && probe[0] === 0xef && probe[1] === 0xbb && probe[2] === 0xbf ? 3 : 0) : /^utf-16/.test(en) ? (bom16 ? 2 : 0) : 0;
  return { src, size: src.size, head: probe, bm, text: d.text, decoded: d, en: en === "utf-8" ? undefined : en, grain: grainOf(d.text, isHtml), ...(isHtml ? { html: true } : {}) };
}

/* R51 (fix round 10; K5211): the visible text of a web page past a whole read, made by the one streaming pass (html.mjs) from the page's byte windows, each decoded by the head's
   encoding (a character cut by a window's end goes on with the next) and handed on with the carry the pass keeps. The page is never held as one string or one byte array.
   `stats.replaced` counts the replacement characters the windows decoded (R49). Answers null when a window is not held (the caller states it, transient). */
async function htmlVisibleByWindows(rt, windowBytes, stats) {
  const A = adapterFor(rt.en), size = rt.size;
  let gone = false;
  async function* chunks() {
    let off = rt.bm, rest = new Uint8Array(0);
    while (off < size || rest.length) {
      const len = Math.min(windowBytes, size - off);
      let got = new Uint8Array(0);
      if (len > 0) {
        const r = await rt.src.readRange(off, len);
        if (!(r instanceof Uint8Array && r.length === len)) { gone = true; return; }
        got = r; off += len;
      }
      let buf = got;
      if (rest.length) { buf = new Uint8Array(rest.length + got.length); buf.set(rest, 0); buf.set(got, rest.length); }
      const eof = off >= size;
      const end = eof ? buf.length : A.end(buf, 0, buf.length);
      rest = buf.slice(end);
      if (!end) { if (eof) return; continue; }
      const text = A.lenient(buf.subarray(0, end));
      if (stats) for (let at = text.indexOf("\ufffd"); at >= 0; at = text.indexOf("\ufffd", at + 1)) stats.replaced++;
      yield text;
    }
  }
  const visible = await visibleTextOfHtmlStream(chunks(), { yieldNow });
  return gone ? null : visible;
}

/* --- a PDF -------------------------------------------------------------------------------------------------------------- */

/* G68 (fix round 7): a PDF read in page ranges is opened ONCE for its pieces. pdf-reader's `openPdfRange(bytes)` (R44) does the
   whole-file read (the objects scanned, the object streams decoded, the page index built) a range needs, and answers
   `{ok, pages, range({from, count, maxBytes})}`, each range exactly what `extractPdfRange` answers. The open document is kept here
   between the pieces of one digest, for the next tick of the object that ran this one: one entry, replaced when another digest is
   opened, dropped when the last piece is read or a range fails. A tick that finds its digest open does not read the object. */
let openedPdf = null;   /* {sha, opened} */
const HELD_OPEN = new Uint8Array(0);   /* stands for the bytes of a document that is open: they are not read again */

/* ===================================================================== *
 * A reading's title (R34).
 * ===================================================================== */

export const TITLE_MAX_CHARS = 200;

/* R34: a title is the text with markup removed and character references decoded as R32 decodes them (markup first,
   so a decoded `&lt;` is text), whitespace runs collapsed to one space, trimmed, at most TITLE_MAX_CHARS characters
   (code points); one with no glyph is none (null). */
function cleanTitle(s) {
  if (typeof s !== "string") return null;
  const bare = decodeReferences(s.replace(/<\/?[A-Za-z][^\s>/]*(?:"[^"]*"|'[^']*'|[^'">])*>/g, ""))
    .replace(/\s+/g, " ").trim();
  const t = [...bare].slice(0, TITLE_MAX_CHARS).join("").trimEnd();
  return glyphCount(t) > 0 ? t : null;
}

/* The inner markup of the first element named `names` (a regex alternation) in `markup` that has an end tag; a
   self-closing tag and a start tag with no end tag are no element. */
function firstElementInner(markup, names) {
  const open = new RegExp(`<(${names})(?=[\\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>`, "gi");
  for (let m = open.exec(markup); m; m = open.exec(markup)) {
    if (m[2].endsWith("/")) continue;
    const end = new RegExp(`</${m[1]}\\s*>`, "i").exec(markup.slice(open.lastIndex));
    if (end) return markup.slice(open.lastIndex, open.lastIndex + end.index);
  }
  return null;
}

/* R34: the title of a capture read as HTML: its first `<title>` element, else its first heading (`h1` to `h6`) in
   document order. Nothing inside a comment, `script`, `style` or `template` is a title; `head` is not dropped, since
   it is where the title is. A `<title>` that holds no glyph is none, and the heading is read in its place. */
export function titleOfHtml(html) {
  if (typeof html !== "string" || !html) return null;
  const live = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/g, " ");
  for (const names of ["title", "h[1-6]"]) {
    const t = cleanTitle(firstElementInner(live, names));
    if (t !== null) return t;
  }
  return null;
}

/* R34: the title a format entry's metadata states (R28), when it is a non-blank string, else null. */
export function titleOfMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? cleanTitle(metadata.title) : null;
}

/* ===================================================================== *
 * The reading (R1, R11).
 * ===================================================================== */

/* The references a reader emitted, as they appear (extraction R46): kind:key raw, never resolved; the position re-normalised
   by `readingSource` (FW-17 / IC-86), null where it does not normalise, never "the whole document". */
export const readEntities = (list) => (Array.isArray(list) ? list : []).map((e) => ({
  key: e && e.key != null ? String(e.key) : null,
  kind: e && e.kind != null ? e.kind : null,
  label: e && e.label != null ? e.label : null,
  facts: e && e.facts && typeof e.facts === "object" ? e.facts : {},
  ref: `${e && e.kind != null ? e.kind : ""}:${e && e.key != null ? e.key : ""}`,
  source: readingSource(e && e.source),
  ...(Array.isArray(e && e.occurrences) ? { occurrences: e.occurrences } : {}),
})).filter((e) => e.key != null || e.kind != null);

/* D-375 / N139 (R17): how much text the reader was handed, as three facts. `text_chars` is I2's `counts.chars`, the
   producer's claim; `text_glyphs` the glyphs of the text in hand (D-514: what "holds text" means here); and
   `text_undetermined` I2's `counts.undetermined`, the residue a producing tier marked unread, over the decode view
   (R3: an `image_unread` marker is no undecoded character). OBSERVATION-LOG-DESIGN §4.2's fourth outcome, a scan read
   to nothing, is told from a document read whole by these. Null where the text states no such figure; no text, no
   keys (null answered here); never a zero nothing counted. */
export function textCountsOf(text) {
  if (text == null) return null;
  if (typeof text === "string")
    return { text_chars: text.length, text_glyphs: glyphCount(text), text_undetermined: null };
  if (typeof text !== "object") return null;
  const c = decodeView(text).counts;
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
  return { text_chars: n(c && c.chars),
           text_glyphs: typeof text.document === "string" ? glyphsOfDocument(text) : null,
           text_undetermined: n(c && c.undetermined) };
}

/* D-374 / N100 (R12): each page's box as pdf-reader answered it (its R33, `pageBoxes`), read whole or not at all: one
   box this wire cannot read makes the answer null, because a partial list would bound the pages it kept and silently
   not the rest. A page whose box the reader could not read is null in `of_page`, as it said. */
export function pageBoxesFrom(v) {
  if (!v || typeof v !== "object" || !Array.isArray(v.boxes) || !Array.isArray(v.of_page)) return null;
  const fin = (x) => typeof x === "number" && Number.isFinite(x);
  const boxes = [];
  for (const b of v.boxes) {
    const m = b && Array.isArray(b.media_box) && b.media_box.length === 4 && b.media_box.every(fin) ? b.media_box : null;
    if (!m || !(m[2] > m[0] && m[3] > m[1])) return null;
    boxes.push({ media_box: m.slice(), w: m[2] - m[0], h: m[3] - m[1],
                 rotate: [0, 90, 180, 270].includes(b.rotate) ? b.rotate : null });
  }
  const of_page = [];
  for (const i of v.of_page) {
    if (i !== null && !(Number.isInteger(i) && i >= 0 && i < boxes.length)) return null;
    of_page.push(i);
  }
  return { boxes, of_page };
}

/* R11 (G48; K4571, K4679): the sentence a reading's basis carries when its sheet was classified over a bounded view
   (`classified_over`, docprofile R19/R38): how much of the text the kind of document was judged from. A stand-in owed to
   UX-DESIGN (code-origin, `localize`); built here from the figures, never from docprofile's own `why`. */
export function classifiedOverSentence(co) {
  const n = (v) => String(Number.isFinite(v) ? v : 0);
  return localize("reading-pipeline.index.classified_over_sample",
    "the kind of document was judged from a sample of its text ({chars} of its {of} characters: its opening, {windows} stretches spread through it and its end); the whole text is read in pieces",
    { chars: n(co && co.chars), of: n(co && co.of), windows: n(Array.isArray(co && co.windows) ? co.windows.length : 0) });
}

/* R11: the reading a wired text produces. A determined reading carries `text_source` (the chain), `text_tier`,
   `text_container`, and a basis naming the reader, the chain, the tier, the tier-2 and tier-3 notes and where
   references were read; an undetermined one is a failed reading whose basis gives the tier notes and the entry's
   reason. `docType` is read only on the failed branch. */
export function readingFromWire({ wired, docType, chain, wiredTier, fmt, retrieved, tier2note, ocrNote,
                                  tier3Candidate = !!ocrNote }) {
  let reading = null;
  /* G48 (K4571, K4679): a sheet classified over a bounded view says so, on the reading and in its basis, never silently. */
  const sampled = wired && wired.classified_over && typeof wired.classified_over === "object" ? wired.classified_over : null;
  if (wired && wired.determined) {
    const { entities: wiredEntities, ...wrest } = (wired.parsed || {});
    const wfacts = (wrest && typeof wrest.facts === "object" && Object.keys(wrest).length === 1)
      ? wrest.facts : wrest;
    const entities = wired.parse_error ? [] : readEntities(wiredEntities);
    const wtype = wired.doctype.type;
    const positioned = entities.filter((e) => e.source).length;
    const posNote = !entities.length ? null
      : positioned === entities.length
        ? word("reading-pipeline.reference_carries_read", { positioned: String(positioned), entities: String(entities.length) })
        : positioned
          ? word("reading-pipeline.references_carry_read", { positioned: String(positioned), entities: String(entities.length) })
          : word("reading-pipeline.no_reference_carries_where_it", { position_why: String(wired.position_why
              || word("reading-pipeline.reader_say")) });
    reading = {
      content_type: wtype.key, reader_version: wtype.version ?? null,
      read_from_text: true, found: entities.length > 0,
      entities, facts: wired.parse_error ? {} : (wfacts || {}), at: retrieved,
      text_source: chain, text_tier: wiredTier, text_container: fmt,
      basis: (wired.parse_error
        ? word("reading-pipeline.why.reader_parse_text", { key: String(wtype.key), fmt: String(fmt), parse_error: String(wired.parse_error) })
        : (entities.length
            ? word("reading-pipeline.why.read_reader_tier", { key: String(wtype.key), version: String(wtype.version), fmt: String(fmt), chain: String(describeChain(chain)), wired_tier: String(wiredTier), why: String(wired.why) })
            : word("reading-pipeline.why.reader_found_entities", { key: String(wtype.key), fmt: String(fmt), wired_tier: String(wiredTier) })))
        + (tier2note ? ` — ${tier2note}` : "")
        + (ocrNote ? ` — ${ocrNote}` : "")
        + (posNote ? ` — ${posNote}` : "")
        + (sampled ? ` — ${classifiedOverSentence(sampled)}` : ""),
      ...(sampled ? { classified_over: sampled } : {}),
      ...(tier3Candidate ? { tier3_candidate: true } : {}),
      position_parts: wired.position_parts ?? 0,
      position_why: positioned ? null : (wired.position_why || null),
    };
  } else if (wired) {
    reading = {
      content_type: docType.type.key, reader_version: docType.type.version ?? null,
      read_from_text: false, found: false, entities: [], facts: {}, at: retrieved,
      text_source: chain, text_tier: wiredTier, text_container: fmt,
      basis: [tier2note, ocrNote ? `${ocrNote} (${wired.why})` : wired.why].filter(Boolean).join(" — "),
      ...(sampled ? { classified_over: sampled } : {}),
      ...(tier3Candidate ? { tier3_candidate: true } : {}),
    };
  }
  return reading;
}

/* ===================================================================== *
 * The container extent (R12).
 * ===================================================================== */

/* CAP-12 / COFF-12 / COFF-13 / FW-19 (R12): the container's own extent, READ off the I2 shape the entry returned,
   recognised by the keys it emitted (sheets, paragraphs, slides by list; tables, images by key), never re-derived.
   An integer or null, never a coercion; a list over the bound (empty) is NULL, never zero; `tables`/`images` empty
   is a measured zero and null is a walk that did not finish; the slide map is keyed on the unit's own `slide` and
   is as long as the deck's `deckLength`. For a PDF (D-420): the images its pages paint as `{page, rect}`, exhaustive
   or null with `images_why`. Null when the entry itemised nothing. */
export function containerExtentOf(i2text, { pdfPaints = null, fmt = null } = {}) {
  let containerExtent = null;
  if (i2text) {
    const has = (k) => Array.isArray(i2text[k]);
    const held = (k) => (has(k) && i2text[k].length ? i2text[k] : null);
    if (has("sheets") || has("paragraphs") || has("slides")) {
      const sh = held("sheets"), pa = held("paragraphs"), sl = held("slides");
      const deckLen = Number.isInteger(i2text.deckLength) && i2text.deckLength > 0 ? i2text.deckLength : null;
      const int = (v) => (Number.isInteger(v) ? v : null);
      const slideExtents = (units) => {
        let n = Math.max(units.length, deckLen ?? 0);
        for (const u of units) if (u && Number.isInteger(u.slide) && u.slide > n) n = u.slide;
        const out = Array.from({ length: n }, () => ({ shapes: null }));
        for (const u of units) {
          if (!(u && Number.isInteger(u.slide) && u.slide >= 1)) continue;
          out[u.slide - 1] = { shapes: int(u.shapes) };
        }
        return out;
      };
      const own = (k) => Object.prototype.hasOwnProperty.call(i2text, k);
      const tablesOf = (list) => (Array.isArray(list)
        ? list.map((t) => ({ rows: int(t && t.rows), cols: int(t && t.cols) })) : null);
      const imagesOf = (list) => (Array.isArray(list)
          && list.every((x) => x && typeof x.part === "string" && /^[0-9a-f]{64}$/.test(x.part))
        ? list.map((x) => ({ part: x.part, mime: typeof x.mime === "string" ? x.mime : null }))
        : null);
      containerExtent = {
        container: typeof i2text.container === "string" ? i2text.container : null,
        levels: [...["sheets", "paragraphs", "slides"].filter(has), ...["tables", "images"].filter(own)],
        sheets: sh ? sh.map((s) => ({
          name: s && typeof s.name === "string" ? s.name : null,
          rows: int(s && s.rows), cols: int(s && s.cols),
          usedRows: int(s && s.usedRows), usedCols: int(s && s.usedCols) })) : null,
        paragraphs: pa ? pa.length : null,
        slides: sl || deckLen ? slideExtents(sl || []) : null,
        ...(has("slides") && own("deckLength") ? { deckLength: deckLen } : {}),
        ...(own("tables") ? { tables: tablesOf(i2text.tables) } : {}),
        ...(own("images") ? { images: imagesOf(i2text.images) } : {}),
      };
    }
  }
  if (!containerExtent && pdfPaints && fmt === "pdf") {
    const placements = Array.isArray(pdfPaints.images)
        && pdfPaints.images.every((x) => x && Number.isInteger(x.page) && x.page >= 0
          && Array.isArray(x.rect) && x.rect.length === 4
          && x.rect.every((n) => typeof n === "number" && Number.isFinite(n)))
      ? pdfPaints.images.map((x) => ({ page: x.page, rect: x.rect.slice() }))
      : null;
    containerExtent = {
      container: "pdf", levels: ["images"], images: placements,
      ...(placements ? {} : { images_why: pdfPaints.why
        || localize("reading-pipeline.index.placement_not_read", "a placement the structure op reported could not be read as {shape}", { shape: "{page, rect}" }) }),
    };
  }
  return containerExtent;
}

/* ===================================================================== *
 * What the entry emitted beside the text (R28).
 * ===================================================================== */

/* R28 (T33-24; C:A-5; K1556): the entry's document `metadata` as it emitted it (office-readers R31), or null; and, for
   a workbook (a text with a `sheets` list), `cells`: each named sheet's cells as the entry emitted them
   (office-readers R30, odf-reader R46), or null where it emitted none (over its size guard). Neither is altered; a
   sheet with no name is no key, since a key would be one this module made up. N724 (K1972, K2092): for a `.docx`
   text (container `docx`), `cells` keyed by each table's `ref` (`table <n+1>`, office-readers R16), its cells as the
   entry emitted them (office-readers R11's `tables[].cells`), nested tables under their own keys as the entry lists
   them; `{}` for a body with no tables, and null when `tables` is null (the body not read, or over its size guard),
   three facts kept apart (R21). A table with no `ref` is no key, as a sheet with no name. No text, or no entry:
   metadata null and no `cells`; any other document: no `cells`. (G41, R44) A sheet the entry holds the cells of in the
   file, not in the reading (`cells` null and `cells_held` true), is named in `cells_held`, a list of sheet names, present
   only when there is one; its `cells` stays null, as for a sheet with no list. */
export function emittedFieldsOf(i2text) {
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const out = { metadata: isObj(i2text) && isObj(i2text.metadata) ? i2text.metadata : null };
  if (isObj(i2text) && Array.isArray(i2text.sheets)) {
    const cells = {}, held = [];
    for (const sh of i2text.sheets)
      if (isObj(sh) && typeof sh.name === "string") {
        cells[sh.name] = Array.isArray(sh.cells) ? sh.cells : null;
        /* R44: a sheet whose typed cells the entry holds in the file says so; a sheet with a cell list never does */
        if (sh.cells_held === true && !Array.isArray(sh.cells)) held.push(sh.name);
      }
    out.cells = cells;
    if (held.length) out.cells_held = held;
  } else if (isObj(i2text) && i2text.container === "docx") {
    if (!Array.isArray(i2text.tables)) out.cells = null;
    else {
      const cells = {};
      for (const t of i2text.tables)
        if (isObj(t) && typeof t.ref === "string" && t.ref) cells[t.ref] = Array.isArray(t.cells) ? t.cells : null;
      out.cells = cells;
      /* R47 (fix round 9, G128e; docs A9): an optional part that would take the reading past the stored bound is omitted with a
         statement of its size and the bound, and the units stay: a `.docx`'s table cells over INLINE_CELLS_MAX_BYTES (as JSON, the
         bound a workbook's entry holds its cells by) are `null` here, `cells_omitted` saying so; their held form is Stage 3's */
      const size = utf8Length(JSON.stringify(cells));
      if (size > INLINE_CELLS_MAX_BYTES) { out.cells = null; out.cells_omitted = { size, bound: INLINE_CELLS_MAX_BYTES }; }
    }
  }
  return out;
}

/* ===================================================================== *
 * read (R1–R17, R24).
 * ===================================================================== */

/* The document's own address, for the recognisers (R11): a Drive export's document address from Google's hop, an
   archive replay's from the archive's hop, else the locator. */
function documentAddressOf(doc) {
  const chain = Array.isArray(doc && doc.provenance_chain) ? doc.provenance_chain : [];
  const drive = chain.find((h) => h && h.drive_file_id && typeof h.document_address === "string");
  if (drive) return drive.document_address;
  const arch = chain.find((h) => h && h.via === "archive.org" && typeof h.document_address === "string");
  return arch ? arch.document_address : (doc && typeof doc.locator === "string" ? doc.locator : null);
}

/* R10: Google's export hop, when the document's chain carries one; its format is what the conversion produced. */
function driveHopOf(doc) {
  const chain = Array.isArray(doc && doc.provenance_chain) ? doc.provenance_chain : [];
  const h = chain.find((x) => x && x.drive_file_id && typeof x.export_format === "string");
  return h ? { format: h.export_format } : null;
}

/* N615 (K1773): the origin of the bytes of every capture `read` is handed (see `readInner`). */
const CAPTURE_ORIGIN = "fetch";

/* `textCountsOf` of a long string, the glyphs counted a slice at a time with the turn given back between (G82); a slice never ends between the halves of a pair. */
async function textCountsSliced(text) {
  let glyphs = 0;
  for (let at = 0; at < text.length;) {
    let end = Math.min(text.length, at + 512 * 1024);
    if (end < text.length && (text.charCodeAt(end - 1) & 0xfc00) === 0xd800 && (text.charCodeAt(end) & 0xfc00) === 0xdc00) end++;
    glyphs += glyphCount(text.slice(at, end));
    at = end;
    await yieldNow();
  }
  return { text_chars: text.length, text_glyphs: glyphs, text_undetermined: null };
}

/* G82 (fix round 7): the object has one thread, and a read of a big capture is several stretches of compute: between them the thread is
   given back (a timer turn, which lets the object's other requests run), when the capture is big enough to matter. */
const BREATHE_AT = 256 * 1024;
const breatheIf = (on) => (n) => (on && n > BREATHE_AT ? yieldNow() : undefined);   /* called as `if (piecesOn) await breathe(n)`: a read that is not in pieces is never suspended here */

const failed = (doc, docType, basis, extra = {}) => ({
  content_type: docType ? docType.type.key : null, reader_version: docType ? (docType.type.version ?? null) : null,
  read_from_text: false, found: false, entities: [], facts: {}, at: doc && typeof doc.retrieved === "string" ? doc.retrieved : null,
  basis, ...extra });

/* R38, R54: what an entry's final refusal states of itself: its `reason` and the figures it measured (`pages`, `bytes`, `need_mb`,
   `limit_mb`; and a statement's own: `size`, `bound`, `key`, `part`, `kind`, `name`, `n`). Nothing else of it is the reading's; an
   answer that is not final or names no reason carries none. */
function refusalOf(a) {
  if (!a || a.ok !== false || a.failure !== FAILURE_FINAL || typeof a.reason !== "string" || !a.reason) return null;
  const out = { reason: a.reason };
  for (const k of ["pages", "bytes", "need_mb", "limit_mb", "size", "bound", "n"]) if (Number.isFinite(a[k])) out[k] = a[k];
  for (const k of ["key", "part", "kind", "name", "metric"]) if (typeof a[k] === "string" && a[k]) out[k] = a[k].slice(0, 200);
  return out;
}

/* R54 (fix round 9, G135d): a size marker an entry left in its text (`undetermined[].guard`, ooxml's `textPlan` and csv-reader's
   `sizeMarker`: `{why, size, bound, ...}`, final) is the file's own refusal by a bound: it is stated as `TOO_LARGE {size, bound}`
   (a size over its bound) or `STRUCTURE_OVER_BOUND {part, bound}` (a count or structure over its bound), with the part it names, and
   never as "undecodable regions". Null when the text holds none. */
function guardRefusalOf(i2text) {
  const marks = i2text && Array.isArray(i2text.undetermined) ? i2text.undetermined : [];
  for (const m of marks) {
    const g = m && typeof m === "object" ? (m.guard && typeof m.guard === "object" ? m.guard : m.final === true ? m : null) : null;
    if (!g || !Number.isFinite(g.bound)) continue;
    const part = typeof m.part === "string" ? m.part : typeof g.part === "string" ? g.part : null;
    const named = part ? { part: part.slice(0, 200) } : {};
    /* R60: the unit the figure measures is the reader's own (`metric`); a bound marker that names none is counted in what its `why` counts */
    const metric = typeof g.metric === "string" && g.metric ? g.metric : g.why === "TOO_MANY_OBJECTS" ? "objects" : g.why === "TOO_MANY_CHARACTERS" ? "characters" : "bytes";
    if (Number.isFinite(g.size) && (g.why === "over_size_bound" || g.metric !== undefined || g.boundName !== undefined))
      return { reason: "TOO_LARGE", size: g.size, bound: g.bound, metric, ...named, ...(typeof g.boundName === "string" ? { name: g.boundName } : {}) };
    if (typeof g.why === "string")
      return { reason: "STRUCTURE_OVER_BOUND", bound: g.bound, metric, ...(Number.isFinite(g.n) ? { n: g.n } : {}), ...named, name: g.why };
  }
  return null;
}

/* R60: the word for the unit a refusal's figure measures: `bytes`, `rows`, `columns`, `objects`, `cells`, as the reader states it (a reader's own
   longer name, `declared_uncompressed_text_part_bytes`, is its kind of count in plain words). */
function unitWordOf(metric) {
  if (typeof metric !== "string" || !metric) return "bytes";
  if (/bytes$/.test(metric)) return "bytes";
  if (/chars$/.test(metric)) return "characters";
  return metric.replace(/_/g, " ");
}

/* R54 (G135a, G135d, G135e): the sentence of a refusal that names its own cause and figures. Stand-ins until T52 (K4269); owed:
   `reading-pipeline.index.too_large`, `.structure_over_bound`, `.unsupported_<kind>`. A size sentence holds the file's size and the limit
   and never says "read" of a file that is not. */
function refusalSentence(r) {
  if (r.reason === "TOO_LARGE" && Number.isInteger(r.parts) && r.parts > 1)
    return localize("reading-pipeline.index.too_large_in_parts", "This file is {size} bytes in {parts} parts, over the {bound} bytes allowed for this kind of file.", { size: String(r.size), parts: String(r.parts), bound: String(r.bound) });
  if (r.reason === "TOO_LARGE" && unitWordOf(r.metric) !== "bytes")
    return localize("reading-pipeline.index.too_large_units", "This file has {size} {unit}, over the {bound} {unit} allowed for this kind of file.", { size: String(r.size), bound: String(r.bound), unit: unitWordOf(r.metric) });
  if (r.reason === "TOO_LARGE")
    return localize("reading-pipeline.index.too_large", "This file is {size} bytes, over the {bound} bytes allowed for this kind of file.", { size: String(r.size), bound: String(r.bound) });
  if (r.reason === "STRUCTURE_OVER_BOUND" && typeof r.metric === "string" && r.metric)
    return localize("reading-pipeline.index.structure_over_bound_units", "{part} holds more than {bound} {unit}, past what is allowed for this kind of file.", { part: String(r.part || r.name || "This file"), bound: String(r.bound), unit: unitWordOf(r.metric) });
  if (r.reason === "STRUCTURE_OVER_BOUND")
    return localize("reading-pipeline.index.structure_over_bound", "{part} is over the {bound} allowed for this kind of file.", { part: String(r.part || r.name || ""), bound: String(r.bound) });
  return null;
}

/* R54 (G135a, G135e; K4831 (3)): a kind with no reader is named, by its bytes and the types it is declared as, and its reading is
   stated `final` with `UNSUPPORTED_FORMAT {kind}`: no "non-textual or too large", and nothing for "Read it" to repair. */
const sig = (b, o, s) => b.length >= o + s.length && [...s].every((c, i) => b[o + i] === (typeof c === "number" ? c : c.charCodeAt(0)));
function unreadKindOf(b, types, name = null) {
  if (!(b instanceof Uint8Array) || !b.length) return null;
  const t = types.filter((x) => typeof x === "string").join(" ").toLowerCase();
  /* R61: a file is declared Word by its type, or by its name where no type that is not text (and not the generic octet-stream) is declared */
  const declared = types.filter((x) => typeof x === "string" && x.trim()).map((x) => x.toLowerCase().split(";")[0].trim());
  const wordDeclared = /msword/.test(t) || (typeof name === "string" && /\.doc$/i.test(name.trim()) && declared.every((x) => x === "application/octet-stream" || x.startsWith("text/")));
  if (sig(b, 0, "GIF87a") || sig(b, 0, "GIF89a")) return "gif";
  if (sig(b, 0, [0x49, 0x49, 0x2a, 0]) || sig(b, 0, [0x4d, 0x4d, 0, 0x2a])) return "tiff";
  if (sig(b, 0, "RIFF") && sig(b, 8, "WEBP")) return "webp";
  if (sig(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (/^(?:heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return "heic";
    if (/^avi[fs]$/.test(brand)) return "avif";
  }
  if (sig(b, 0, [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a])) return "jp2";
  if (sig(b, 0, "BM") && b.length >= 30 && [12, 40, 52, 56, 64, 108, 124].includes(b[14] | (b[15] << 8)) && b[16] === 0) return "bmp";
  if (sig(b, 0, [0, 0, 1, 0]) && /image\/(?:x-icon|vnd\.microsoft\.icon)/.test(t)) return "ico";
  if (sig(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return /msword|\.doc\b/.test(t) ? "legacy_word" : /ms-excel|\.xls\b/.test(t) ? "legacy_excel" : /ms-powerpoint|\.ppt\b/.test(t) ? "legacy_powerpoint" : "legacy_office";
  const head = String.fromCharCode(...b.subarray(0, Math.min(b.length, 2048)));
  if (/^\s*\{\\rtf/.test(head) || /\b(?:text|application)\/rtf\b/.test(t)) return "rtf";
  if (/message\/rfc822/.test(t)) return "email";
  const lines = head.split(/\r?\n/).slice(0, 16);
  const hdr = lines.filter((l) => /^(?:Received|Return-Path|Delivered-To|MIME-Version|Message-ID|Date|From|To|Subject|Content-Type):\s/i.test(l)).length;
  if (hdr >= 4 && lines.some((l) => /^(?:From|Subject|To|MIME-Version):/i.test(l)) && /^[\w-]+:\s/.test(lines[0] || "")) return "email";
  /* R61: bytes that say nothing of their own kind, under a Word declaration: stated legacy Word (final, nothing to repair), never "not read as text" */
  return wordDeclared ? "legacy_word" : null;
}
function unreadSentence(kind) {
  switch (kind) {
    case "rtf": return localize("reading-pipeline.index.unsupported_rtf", "RTF is not read yet.");
    case "email": return localize("reading-pipeline.index.unsupported_email", "Email is not read yet.");
    case "legacy_word": return localize("reading-pipeline.index.unsupported_legacy_word", "Legacy Word is not read yet.");
    case "legacy_excel": return localize("reading-pipeline.index.unsupported_legacy_excel", "Legacy Excel is not read yet.");
    case "legacy_powerpoint": return localize("reading-pipeline.index.unsupported_legacy_powerpoint", "Legacy PowerPoint is not read yet.");
    case "legacy_office": return localize("reading-pipeline.index.unsupported_legacy_office", "This older Office file is not read yet.");
    case "tiff": return localize("reading-pipeline.index.unsupported_tiff", "TIFF is not read yet.");
    case "gif": return localize("reading-pipeline.index.unsupported_gif", "GIF is not read yet.");
    case "webp": return localize("reading-pipeline.index.unsupported_webp", "WebP is not read yet.");
    case "heic": return localize("reading-pipeline.index.unsupported_heic", "HEIC is not read yet.");
    case "avif": return localize("reading-pipeline.index.unsupported_avif", "AVIF is not read yet.");
    case "bmp": return localize("reading-pipeline.index.unsupported_bmp", "BMP is not read yet.");
    case "jp2": return localize("reading-pipeline.index.unsupported_jp2", "JPEG 2000 is not read yet.");
    case "ico": return localize("reading-pipeline.index.unsupported_ico", "ICO is not read yet.");
    default: return localize("reading-pipeline.index.unsupported_kind", "{kind} is not read yet.", { kind: String(kind) });
  }
}

/* K4904 (2c item 8): `read(..., {skipKilled: true})` steps past the window `cursor` names, one that killed its reader three times: it reads nothing of it and answers
   `{units: [], next, more, counters: {written: 0, skipped: 1, owed: 0, failed: 0}, stated: {cursor, why: "UNIT_KILLED_READER"}}`, `next` the cursor of the following window
   (a list's next unit - a slide, a sheet block - or a text's next window), so the read goes on; the window is stated on the reading (`reading.killed_windows`) and said
   in a sentence (R-SILENT). A page keeps PAGE_KILLED_READER (the PDF's unit is a page). Null when the cursor is not one this steps (it is read as it is). */
export const UNIT_KILLED_READER = "UNIT_KILLED_READER";
async function skipWindow(evidence, doc, cursor, windowBytes) {
  const c = unb64(cursor);
  const sha = doc && doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : null;
  if (!c || c.v !== 1 || !sha || c.s !== sha) return null;
  let next = null, through = null, total = null, statedBytes = null;
  if (c.k === "u" && natural(c.n) && natural(c.i) && c.i < c.n) {
    if (c.i + 1 < c.n) next = b64({ v: 1, s: sha, k: "u", n: c.n, i: c.i + 1 });
    through = c.i + 1; total = c.n;
  } else if (c.k === "w" && c.m === "t" && natural(c.n) && natural(c.ob) && c.ob < c.n && natural(c.bm)) {
    /* a text's window: the next begins at the character after this window's bytes, inside a run (`md`), so its lines are not numbered on from here */
    let ob = Math.min(c.n, c.ob + (Number.isInteger(windowBytes) && windowBytes > 0 ? windowBytes : WINDOW_BYTES));
    if (ob < c.n) {
      const src = c.ro === 1 ? rangeSource(evidence, doc) : null;
      const got = src ? await src.readRange(ob, 4) : (await rangeBytes(evidence, sha, ob, 4))?.bytes;
      if (!(got instanceof Uint8Array)) return null;
      let i = 0; while (i < got.length && (got[i] & 0xc0) === 0x80) i++;
      ob += i;
    }
    if (ob < c.n) { const { v, k, s: ignored, ...rest } = c; next = windowCursor(sha, { ...rest, ob, md: 1, r: (c.r || 0) + 1, ld: 0 }); }
    through = ob - c.bm; total = c.n - c.bm;
  } else if (c.k === "w" && c.m === "c" && natural(c.n) && natural(c.ob) && c.ob < c.n && natural(c.dl)) {
    /* a CSV window: the next begins at the first row boundary at or after the window's bytes (the quote state scanned from the window's start, which is a row's), the dialect
       kept in the cursor; the bytes that were not read are stated as a range, and the rows after it numbered on from the next row read */
    const src = c.ro === 1 ? rangeSource(evidence, doc) : null;
    const win = Number.isInteger(windowBytes) && windowBytes > 0 ? windowBytes : WINDOW_BYTES;
    const want = Math.min(c.n, c.ob + win);
    let ob = c.n;
    if (want < c.n) {
      const st = newScan(c.dl), bounds = [];
      for (let take = win + CSV_SLACK_BYTES; ob === c.n; take *= 2) {
        const len = Math.min(take, c.n - c.ob);
        const got = src ? await src.readRange(c.ob, len) : (await rangeBytes(evidence, sha, c.ob, len))?.bytes;
        if (!(got instanceof Uint8Array)) return null;
        bounds.length = 0; Object.assign(st, newScan(c.dl)); scanBoundaries(got, c.ob, st, bounds);
        const hit = bounds.find((x) => x >= want);
        if (hit !== undefined) { ob = hit; break; }
        if (c.ob + len >= c.n) break;
      }
    }
    if (ob < c.n) { const { v, k, s: ignored, ...rest } = c; next = windowCursor(sha, { ...rest, ob }); }
    through = ob; total = c.n;
    statedBytes = [c.ob, ob];
  } else return null;
  const stated = { cursor, why: UNIT_KILLED_READER, ...(statedBytes ? { bytes: statedBytes } : {}) };
  return { text_units: [], more: next !== null, cursor: next, next, final: next === null ? true : undefined,
           read_through: through, total, piece: { units: 0, words: 0 }, stated,
           counters: { written: 0, skipped: 1, owed: 0, failed: 0 },
           reading: { killed_windows: [{ cursor, why: UNIT_KILLED_READER, ...(statedBytes ? { bytes: statedBytes } : {}) }],
                      killed_window_note: localize("reading-pipeline.index.unit_killed_reader", "A part of this document could not be read after three tries, so it is skipped and the rest goes on.") } };
}

/** R24 (R1–R17): reads a stored capture. `document` is capture's acquire answer's document. The rest is what the
 *  caller (`extraction`, its R1 and R18) hands in: `evidence` (record-core's `evidenceStore()`, or null), `env` (the
 *  fleet bindings PDF_WORKER and OCR_WORKER), `storeName` (the namespace the members read the capture under), `view` (`jurisdictions.combine`'s
 *  view of the instance's profiles, or undefined when the instance holds none, extraction R18), `planeVersion`, and
 *  `liveCalibration` (R5); and, only at a member's act, `transcription` (R29, `tier4Extend`): without it the answer is
 *  exactly what it was before R29. R37: `unitsBudget` is the bytes the text units may spend (default the acquire answer's,
 *  R15; the index path hands `Infinity`), `ocrInvocations` the OCR calls this request may make (default 24; 0 makes none, R55),
 *  and `killedPages` the pages the caller states killed their reader three times (R54, G129c); `stampUnit` (R59, G165) is called with
 *  `"p<page>"` before each page's OCR call. The `owe` hook is retired (R55,
 *  G126j): nothing here registers owed work; the pages left are `ocr_left` and `counters.owed`, the caller's to owe. R39: a document that is a digest alone (no parts,
 *  size, retrieval instant or profile) answers `{refused: {code: "BARE_DIGEST", why}}` and no reading. R40: `cursor`
 *  (null, or the string a piece answered; with `maxUnits`) reads a capture read as text in pieces (the answer adds `piece`; a refusal is `{refused}` with no
 *  reading). Never throws; every failure is a failed reading, and says whether it is `transient` or `final`. */
export async function read(document, { evidence = null, env = {}, storeName = "bio", view, planeVersion = null,
                                        liveCalibration = null, transcription = null, unitsBudget, ocrInvocations,
                                        killedPages, stampUnit, skipKilled, cursor, maxUnits, rangePages, windowBytes } = {}) {
  /* R39: a digest alone is no document; it is refused before anything is loaded, and no reading is composed. */
  if (isBareStub(document)) return refusal(BARE_DIGEST, "reading-pipeline.index.bytes_not_held");
  if (skipKilled === true && typeof cursor === "string") {
    const stepped = await skipWindow(evidence, document, cursor, windowBytes).catch(() => null);
    if (stepped) return stepped;
  }
  let out;
  try { out = await readInner(document, { evidence, env, storeName, view, planeVersion, liveCalibration, transcription,
                                          unitsBudget, ocrInvocations, killedPages, stampUnit,
                                          pieces: cursor === undefined ? null : { cursor, maxUnits, rangePages, windowBytes } }); }
  catch (e) {
    const reading = failed(document, null, localize("reading-pipeline.index.reading_not_composed", "the reading could not be composed ({detail}), so nothing is claimed about this document's text; it is a failed reading, never an emptied document", { detail: String(String(e && e.message || e).slice(0, 200)) }), { failure: FAILURE_TRANSIENT });
    reading.metadata = null;   /* R28: no entry's answer reached the reading */
    reading.provenance = await readingProvenance({ text: null, planeVersion });
    out = { reading };
  }
  return contractOf(out, cursor);
}

/* R45, R46, R53 (fix round 9, G129a, G129b, G132): every answer in the reader contract's terms, added to what it was. `counters`
   `{written, skipped, owed, failed}`: the units carried, the units stated unread (left out of the wire and named, a page the OCR
   member refused or the caller stated killed, a replacement over the decode's tolerance), the units owed (OCR pages left, an unread
   picture inside a text page) and the read that failed; `next` the cursor of the next piece (null at the end); `final` when nothing
   more follows. A piece after the first that failed for a cause outside the document (`transient`) keeps the cursor it was asked
   with and `more`, so the ledger tries it again and never writes it as the end (R53); a piece that answers `more` with the cursor
   it was asked with advanced nothing and ends the entry, stated (R46). A refusal is answered as it was, with its counters. */
function contractOf(out, asked) {
  if (!out || typeof out !== "object") return out;
  const rd = out.reading && typeof out.reading === "object" ? out.reading : null;
  const inPieces = asked !== undefined;
  if (inPieces && typeof asked === "string" && rd && rd.failure === FAILURE_TRANSIENT && out.more !== true) {
    Object.assign(out, { more: true, cursor: asked, piece: { units: 0, words: 0 } });
  }
  if (inPieces && out.more === true && out.cursor === asked && !(rd && rd.failure === FAILURE_TRANSIENT)) {
    const stated = rd || failed(null, null, "");
    Object.assign(stated, { failure: FAILURE_FINAL, reason: stated.reason || NO_PROGRESS,
      basis: localize("reading-pipeline.index.no_progress", "a piece of this document advanced nothing, so its reading ends here, stated, and is never shown as being read") });
    Object.assign(out, { reading: stated, more: false, cursor: null });
  }
  const units = Array.isArray(out.text_units) ? out.text_units.length : 0;
  const own = rd && Number.isInteger(rd.units_skipped) ? rd.units_skipped : 0;
  const owedPages = rd && rd.ocr_left && Number.isInteger(rd.ocr_left.pages) ? rd.ocr_left.pages : 0;
  const owedPictures = rd && Number.isInteger(rd.pictures_unread) ? rd.pictures_unread : 0;
  out.counters = { written: units, skipped: (Number.isInteger(out.text_units_over_bound) ? out.text_units_over_bound : 0) + own,
                   owed: owedPages + owedPictures, failed: rd && rd.failure === FAILURE_TRANSIENT ? 1 : 0 };
  const more = out.more === true;
  out.next = more ? out.cursor : null;
  if (!more && !(rd && rd.failure === FAILURE_TRANSIENT)) out.final = true;
  return out;
}

/* R48 (fix round 9, G128a, G128b; K4837): completeness from the counters and from nothing else. `whole` exactly when nothing more
   follows and nothing is skipped, owed or failed; `stated` for a reading refused whole (`refused`, or `final` with a failure and no
   units); `none` when nothing was offered; `partial` otherwise. */
export function completenessOf(counters, { more = false, final = false, refused = false, reading = null } = {}) {
  const c = counters && typeof counters === "object" ? counters : {};
  const n = (k) => (Number.isInteger(c[k]) && c[k] > 0 ? c[k] : 0);
  const statedWhole = refused || (final && !n("written") && !!reading && reading.failure === FAILURE_FINAL);
  if (statedWhole) return "stated";
  if (!more && !n("written") && !n("skipped") && !n("owed") && !n("failed")) return "none";
  return !more && !n("skipped") && !n("owed") && !n("failed") ? "whole" : "partial";
}

/* R37 (F10): the size of a held object, from the store's `head` when it answers one, else null. */
async function sizeHeld(evidence, digest) {
  try {
    const h = typeof evidence.head === "function" ? await evidence.head(digest) : null;
    return h && Number.isFinite(h.size) ? h.size : null;
  } catch { return null; }
}
/* `{bytes, why?, failure?}`. A failure is `transient` (R37: the object, or a part, is not held yet, or the parts cannot
   be assembled within MULTIPART_READ_MAX while no whole is held: it can be) or `final` (the capture is over WHOLE_READ_MAX
   and is never loaded: nothing later changes that). It throws only when the store does, which the caller marks transient. */
export async function bytesOf(evidence, doc, { kind = null, textual = false } = {}) {
  const whole = async (digest) => {
    const o = await evidence.get(digest);
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  };
  const parts = Array.isArray(doc.parts) ? doc.parts : null;
  const wholeSha = typeof (doc.capture && doc.capture.sha256) === "string" ? doc.capture.sha256 : null;
  const total = parts ? parts.reduce((n, p) => n + (Number.isFinite(p && p.bytes) ? p.bytes : 0), 0)
                      : (Number.isFinite(doc.capture && doc.capture.bytes) ? doc.capture.bytes : null);
  /* R37: a whole the object cannot hold is never loaded, whatever else is held; the size is the capture's own, else the
     store's. */
  /* R54 (G124a): the refusal names its cause and its two figures, the size and the limit, from the table (`statement`) */
  /* a CSV over its own bound is stated against that row (K4868), every other kind against the whole-load ceiling's */
  const tooBig = (size) => {
    /* a text, JSON or XML over its own bound is stated against that row (R50), a CSV against its (K4868), every other kind against the whole-load ceiling's */
    const row = kind === "csv" && size > boundOf("csv", "bytes") ? ["csv", "bytes"]
      : textual && size > boundOf("text", "bytes") ? ["text", "bytes"] : WHOLE_READ_ROW;
    const st = statement(...row, size);
    return { bytes: null, failure: FAILURE_FINAL, stated: { reason: "TOO_LARGE", ...st, metric: "bytes" },
             why: refusalSentence({ reason: "TOO_LARGE", size, bound: st.bound, parts: parts ? parts.length : 1 }) };
  };
  if (total !== null && total > WHOLE_READ_MAX) return tooBig(total);
  /* the store is asked only when the document states no size */
  const held = wholeSha && total === null ? await sizeHeld(evidence, wholeSha) : null;
  if (held !== null && held > WHOLE_READ_MAX) return tooBig(held);
  if (!parts) { const b = await whole(doc.capture.sha256); return b ? { bytes: b, whole: true } : { bytes: b }; }
  /* R2 (T51 fix round 2, C5): the whole object held under the document's fingerprint is read first; parts are
     assembled, and bounded, only when none is held. */
  const got = wholeSha ? await whole(wholeSha).catch(() => null) : null;
  if (got) return { bytes: got, whole: true };
  /* R1: a textual capture is assembled as a single object of it is read, up to the whole-read ceiling; every other kind to the office entries' text bound */
  const assembleMax = textual ? WHOLE_READ_MAX : MULTIPART_READ_MAX;
  if (total > assembleMax)
    return { bytes: null, failure: FAILURE_TRANSIENT,
             why: word("reading-pipeline.why.capture_bytes_parts", { total: String(total), parts: String(parts.length), multipart_read_max: String(assembleMax) }) };
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    const b = p && typeof p.sha256 === "string" ? await whole(p.sha256) : null;
    if (!b) return { bytes: null, failure: FAILURE_TRANSIENT, why: word("reading-pipeline.why.part_held_evidence", { index_of: String(parts.indexOf(p) + 1), parts: String(parts.length) }) };
    out.set(b.subarray(0, Math.max(0, total - at)), at); at += b.length;
  }
  return at === total ? { bytes: out }
                      : { bytes: null, failure: FAILURE_TRANSIENT, why: word("reading-pipeline.why.parts_held_add") };
}

/* R2/R32 (fix round 5, E1): a declared type that is text, as acquisition's `profilesAsText` judges it; and the bytes as text
   when they are UTF-8 without a NUL, else null. */
const TEXT_TYPE = /^(?:text\/|application\/(?:xhtml\+xml|xml|json)|application\/[a-z0-9.+-]*\+xml)/i;
/* R1: the formats a text declared as text can be detected as with no entry to read them (`html` is detected and read here, as text); every other detected format is read
   by its entry or is no text, whatever type the sender declared */
const TEXT_FORMATS = new Set([null, "undetermined", "text", "html", "json", "xml"]);
/* R49 (fix round 9, G131g; X9): every text read here is decoded by one rule, `ooxml.decodeText` (UTF-8 with or without a BOM, UTF-16
   with or without one, the declared or detected legacy charset), handed the charset the capture's type declares. Its answer, or
   `{ok: false, why: "ENCODING_UNSUPPORTED", name}`. A replacement over `REPLACED_TOLERANCE` of the characters makes the reading
   partial with the count (R49). */
export const REPLACED_TOLERANCE = 0.005;
const charsetOf = (type) => { const m = /;\s*charset\s*=\s*"?([^";\s]+)/i.exec(typeof type === "string" ? type : ""); return m ? m[1] : null; };
function decodedTextOf(bytes, type, kind) {
  return decodeText(bytes, { declared: charsetOf(type), name: charsetOf(type), kind });
}
/* R49, R54 (fix round 10, K5195): the name an encoding it cannot decode is refused by: the charset the type declares, else the one the text
   declares of itself (the XML prolog's `encoding`, an HTML `meta` charset, as `ooxml.decodeText` looks for it), else none. `ooxml.decodeText` echoes only the
   `name` it is handed, so a refusal for the page's own declaration would otherwise name nothing. */
function declaredNameOf(bytes, type, kind) {
  const header = charsetOf(type);
  if (header) return header;
  if ((kind !== "xml" && kind !== "html") || !(bytes instanceof Uint8Array)) return null;
  const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, kind === "xml" ? 1024 : 4096));
  const m = kind === "xml"
    ? head.match(/^\s*<\?xml[^>]*?\bencoding\s*=\s*["']([^"']+)["']/i)
    : head.match(/<meta\b[^>]*?\bcharset\s*=\s*["']?\s*([^\s"';>/]+)/i);
  return m ? m[1] : null;
}
/* R49: what the reading states of its decode. */
const encodingFacts = (d) => (d && d.ok ? { encoding: d.encoding, encoding_assumed: d.assumed === true,
  ...(Array.isArray(d.disagree) && d.disagree.length ? { encoding_disagree: d.disagree.slice(0, 200) } : {}),
  ...(d.replaced ? { encoding_replaced: d.replaced } : {}) } : {});

async function readInner(doc, { evidence, env, storeName, view, planeVersion, liveCalibration, transcription,
                              unitsBudget, ocrInvocations, killedPages, stampUnit, pieces }) {
  const retrieved = doc && typeof doc.retrieved === "string" ? doc.retrieved : null;
  const sha = doc && doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : null;
  const ct = doc && doc.capture && typeof doc.capture.content_type === "string" ? doc.capture.content_type : "";
  const profile = doc && doc.profile && typeof doc.profile === "object" ? doc.profile : {};
  const headerPairs = ((doc && doc.capture && doc.capture.transport) || (doc && doc.shell && doc.shell.transport) || {}).http_headers || [];
  const headers = {};
  for (const [hk, hv] of (Array.isArray(headerPairs) ? headerPairs : [])) headers[String(hk).toLowerCase()] = hv;
  const locator = documentAddressOf(doc);
  const multipart = Array.isArray(doc && doc.parts);
  const recorded = profile.format && typeof profile.format.format === "string" ? profile.format.format : null;
  let fmt = recorded;
  const vw = view ? { view } : {};

  /* R24: no store bound, no digest or no object is a failed reading saying so. No field the caller sends supplies
     text. */
  /* R14: every branch's reading gets its provenance at the one site below, a failure's included. */
  const early = async (reading) => {
    reading.metadata = null;   /* R28: no entry answered */
    reading.provenance = await readingProvenance({ text: null, chain: null, tier: null, container: null, planeVersion, member: null });
    return { reading };
  };
  if (!sha) return early(failed(doc, null, localize("reading-pipeline.index.no_capture_digest", "the document names no capture digest, so there are no bytes to read"), { failure: FAILURE_FINAL }));
  /* DEC-149 (T35-24): member-facing, so it names the group's Civicsmith, never "this instance". */
  if (!evidence) return early(failed(doc, null, word("reading-pipeline.no_evidence_store"), { failure: FAILURE_TRANSIENT }));
  /* R40: the ask of a piece (a cursor passed, null for the first). */
  const piecesOn = pieces !== null;
  /* The turn is given back between the phases of a read in pieces only: a whole read of a PDF holds its memory to R36's bound, and a suspended
     read keeps every local it has, so it is not suspended where it need not be. */
  const breathe = breatheIf(piecesOn);
  const pieceAsk = piecesOn ? {
    cursor: pieces.cursor ?? null,
    budget: unitsBudget === undefined ? ACQUIRE_TEXT_UNITS_BUDGET : unitsBudget,
    maxUnits: Number.isInteger(pieces.maxUnits) && pieces.maxUnits > 0 ? pieces.maxUnits : PIECE_UNITS_MAX,
    rangePages: Number.isInteger(pieces.rangePages) && pieces.rangePages > 0 ? pieces.rangePages : PDF_RANGE_PAGES,
    windowBytes: Number.isInteger(pieces.windowBytes) && pieces.windowBytes > 0 ? pieces.windowBytes : WINDOW_BYTES } : null;
  /* G68: a piece after the first, by a cursor of kind `w`, is read from the window it names; the object is not read whole. */
  if (piecesOn && pieceAsk.cursor !== null) {
    const wc = windowCursorOf(pieceAsk.cursor);
    if (wc) {
      const w = await windowTick(evidence, sha, wc, pieceAsk, doc);
      if (w.refused) return w;
      if (w.gone) return early(failed(doc, null, localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"), { failure: FAILURE_TRANSIENT }));
      return { ...(w.units.length ? { text_units: w.units } : {}), ...w.fields, piece: w.piece, ...(w.facts ? { reading: w.facts } : {}) };
    }
  }
  /* G131h: the page whose visible text the last piece of this digest held is not read again: its next piece is cut from that text */
  if (piecesOn && pieceAsk.cursor !== null && heldHtml !== null && heldHtml.sha === sha) {
    const hc = unb64(pieceAsk.cursor);
    if (hc && hc.v === 1 && hc.k === "t" && hc.s === sha && hc.c === heldHtml.visible.length) {
      const p = textPieceAnswer(heldHtml.visible, { html: true, sha, ...pieceAsk });
      if (p.refused) return p;
      if (!p.fields.more) heldHtml = null;
      return { ...(p.units.length ? { text_units: p.units } : {}), ...p.fields, piece: p.piece };
    }
  }
  /* G68: the PDF the last piece of this digest opened is read again from its open document, not from the store */
  const heldCursor = piecesOn && openedPdf !== null && openedPdf.sha === sha && (pieceAsk.cursor === null || (unb64(pieceAsk.cursor) || {}).k === "p");
  const held = heldCursor ? openedPdf : null;
  if (held) fmt = "pdf";
  /* K4868: the first piece of a CSV past a whole read's bound is read by range: its head stands for the bytes, its windows give the units */
  const rangedCsv = (!piecesOn || pieceAsk.cursor === null) && !held
    ? await csvRangedHead(evidence, doc, { recorded: fmt, declared: profile.source_content_type || ct || null }).catch(() => null) : null;
  /* a read that is not in pieces cannot hold it: it says so and is tried again, in pieces, by the ledger (R37 `transient`) */
  if (rangedCsv && !piecesOn)
    return early(failed(doc, null, localize("reading-pipeline.index.csv_in_pieces", "this CSV is {size} bytes, more than a whole read holds ({limit}), so it is read in pieces and none of it is read yet", { size: String(rangedCsv.size), limit: String(WHOLE_READ_MAX) }), { failure: FAILURE_TRANSIENT }));
  if (rangedCsv) fmt = "csv";
  /* R50: a text, JSON or XML past a whole read's bound and within the text bound is read by range from its first piece too */
  const textual = profile.profiled_from_text === true || TEXT_TYPE.test(profile.source_content_type || ct || "");
  /* a later piece of a page is cut from its visible text, made again from the windows when the object lost the one it kept (R51) */
  const laterOfText = piecesOn && pieceAsk.cursor !== null && (unb64(pieceAsk.cursor) || {}).k === "t";
  const rangedTxt = !rangedCsv && (!piecesOn || pieceAsk.cursor === null || laterOfText) && !held
    ? await textRangedHead(evidence, doc, { recorded: fmt, declared: profile.source_content_type || ct || null, textual, htmlOnly: laterOfText,
        charset: charsetOf([headers["content-type"], ct, profile.source_content_type].find((t) => charsetOf(t)) || "") }).catch(() => null) : null;
  if (rangedTxt && rangedTxt.html) fmt = "html";
  if (rangedTxt && !piecesOn)
    return early(failed(doc, null, localize("reading-pipeline.index.text_in_pieces", "this file is {size} bytes, more than a whole read holds ({limit}), so it is read in pieces and none of it is read yet", { size: String(rangedTxt.size), limit: String(WHOLE_READ_MAX) }), { failure: FAILURE_TRANSIENT }));
  const got = held ? { bytes: HELD_OPEN } : rangedCsv ? { bytes: rangedCsv.head } : rangedTxt ? { bytes: rangedTxt.head } : await bytesOf(evidence, doc, { kind: fmt, textual }).catch(() => ({ bytes: null, failure: FAILURE_TRANSIENT, why: word("acquisition.why.evidence_store_read") }));
  let bytes = got.bytes;
  const objLen = bytes ? bytes.length : 0;
  got.bytes = null;
  /* R2 (T51 fix round 5, E1; K4530): the recorded profile is never trusted over bytes the reader holds. A capture held in
     parts is profiled from no byte, so an upload's recorded format is `undetermined` (or none): it is detected again from
     the held bytes, the declared type only where they say nothing. Bytes still undetermined are text when the profile's
     declared type is a text type and they are UTF-8 without a NUL, even in parts (R32). */
  if (bytes && !held && (fmt === null || fmt === "undetermined"))
    fmt = detectFormat(bytes, profile.source_content_type || ct || null).format;
  let textRead = !multipart && profile.profiled_from_text === true && bytes;
  /* the charset declared by the transport first (the header wins over the markup's own, H5), then the capture's and the profile's type */
  const declaredType = [headers["content-type"], ct, profile.source_content_type].find((t) => charsetOf(t)) || null;
  const kindOfText = fmt === "xml" ? "xml" : fmt === "html" ? "html" : "text";
  let decoded = textRead ? decodedTextOf(bytes, declaredType, kindOfText) : null;
  if (rangedTxt) { textRead = true; decoded = rangedTxt.decoded; }
  /* R1, R2/R32, R49 (fix round 10; K5200 (4)): "single part" is no condition of reading a text as text. A capture held in parts (a fetch) whose declared type is a text
     type and whose format no entry reads (undetermined, or the web page `html` a fetch's range reads find) is decoded as an upload is: its parts joined in order, by the
     one rule, and what the rule says stands (an encoding it cannot decode is refused by name below; a replacement over the tolerance leaves the reading partial,
     counted). Bytes that decode to text holding a NUL are no text (R2 R32's control), as before. */
  if (!textRead && multipart && bytes && !held && TEXT_FORMATS.has(fmt) && TEXT_TYPE.test(profile.source_content_type || ct || "")) {
    const d = decodedTextOf(bytes, declaredType, kindOfText);
    if (!d.ok) decoded = d;
    else if (!d.text.includes("\0")) { textRead = true; decoded = d; }
  }
  /* R49, R54: an encoding the rule cannot decode is stated by its name, never read as replacement characters */
  if (decoded && !decoded.ok) {
    const name = decoded.name ?? declaredNameOf(bytes, declaredType, kindOfText);
    return early(failed(doc, null, localize("reading-pipeline.index.encoding_unsupported", "the text declares the encoding {name}, which is not read here, so nothing was read", { name: String(name) }),
                        { failure: FAILURE_FINAL, reason: "ENCODING_UNSUPPORTED", name }));
  }
  let text = decoded ? decoded.text : "";
  if (piecesOn) await breathe(text.length);
  /* R40: a later piece of a text is its units alone, drawn from the bytes now held. It runs before any recogniser: the
     reading is the first piece's, and the text is not classified again for each piece. */
  if (piecesOn && pieceAsk.cursor !== null && bytes && textRead) {
    const e0 = fmt && fmt !== "undetermined" ? getFormat(fmt) : null;
    if (!(e0 && (typeof e0.text === "function" || typeof e0.structure === "function"))) {
      const visible = rangedTxt && rangedTxt.html ? await htmlVisibleByWindows(rangedTxt, pieceAsk.windowBytes, null) : await visibleOfYielding(text, fmt === "html", true);
      if (visible === null) return early(failed(doc, null, localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"), { failure: FAILURE_TRANSIENT }));
      const p = textPieceAnswer(visible, { html: fmt === "html", sha, ...pieceAsk });
      if (p.refused) return p;
      if (fmt === "html") heldHtml = p.fields.more ? { sha, visible } : null;
      /* G68: the pieces after this one are read by a window when the capture can be (a cursor of the old kind is moved on to one) */
      if (p.fields.more && fmt !== "html")
        p.fields.cursor = (await textWindowCursorOf(evidence, { sha, bytes, text, whole: got.whole === true, at: p.at, through: p.fields.read_through, grain: p.grain })) ?? p.fields.cursor;
      return { ...(p.units.length ? { text_units: p.units } : {}), ...p.fields, piece: p.piece };
    }
  }
  /* N615 (K1683, K1773): every recogniser is handed the capture's origin, `"member"` only for bytes a member supplied by
     their own act outside the copy. The document records none: every capture it can be is a fetch the copy made, a
     member session's request included (acquisition, K1775), or a knock, which carries no member session (capture R30,
     K1776). So it is `"fetch"`, never read off `capture.actor_class` or the request's `origin`, and a content type read
     only from a member's own capture (court-doctypes R2) never matches here, as it never matches at intake. */
  const profCtx = { headers, locator, content_type: ct || null, text, origin: CAPTURE_ORIGIN };
  /* R42 (fix round 6, G37; K4615): a read classifies its text once. The classification of the intake's decode is asked only
     where a reading is made from it (the text read as text, a failure naming its type), once, and never for a read whose
     text is classified by `docprofile.readText` over the entry's own text (the stage that follows the entry): it was twice
     over the whole text for a CSV, and the recognisers allocate in proportion to the text. */
  let classified = null;
  const classify = () => classified ??= (() => {
    const stackId = identify(profCtx);
    return { stackId, docType: doctypeFor({ ...profCtx, handler: stackId.handler, kind: stackId.kind, ...vw }) };
  })();
  /* G88 (R42): the same classification, in pieces and over a text longer than BREATHE_AT, gives the thread back between the recognisers
     (docprofile's yielding twin: the same answer, one `detect` a stretch). It is asked only where the text is read as text, and keeps its
     answer in the one memo, so every later `classify()` returns it. Asked after `classify()` has answered, it is that answer. */
  const classifyYielding = async () => {
    if (classified === null) {
      const stackId = identify(profCtx);
      const docType = await doctypeForYielding({ ...profCtx, handler: stackId.handler, kind: stackId.kind, ...vw }, { yieldNow });
      classified ??= { stackId, docType };
    }
    return classified;
  };
  if (!bytes)
    return early(failed(doc, classify().docType, got.why || localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"),
                        { failure: got.failure || FAILURE_TRANSIENT, ...(got.stated || {}) }));

  const entry = fmt && fmt !== "undetermined" ? getFormat(fmt) : null;
  const wireable = !!(entry && (typeof entry.text === "function" || typeof entry.structure === "function"));
  /* R54 (G135a, G135e): a kind with no reader is named, final, and offers nothing to repair (no "Read it") */
  if (!wireable && bytes && !held) {
    const unread = unreadKindOf(bytes, [ct, profile.source_content_type, headers["content-type"]], doc.capture && doc.capture.file_name);
    /* R61: a file declared Word whose bytes are not an OLE compound file is stated legacy Word with the clause that its contents do not look like one (stand-in until UX-DESIGN's row) */
    const notWord = unread === "legacy_word" && !sig(bytes, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (unread) return early(failed(doc, null, notWord
      ? `${unreadSentence(unread)} ${localize("reading-pipeline.index.unsupported_legacy_word_not_word", "It was sent as a Word file, but its contents do not look like one.")}`
      : unreadSentence(unread), { failure: FAILURE_FINAL, reason: "UNSUPPORTED_FORMAT", kind: unread }));
  }
  let reading, classifiedText = null, member = null;
  let textUnits = null, textUnitsOverBound = 0, textUnitsSkipped = null, readDialect, emitted = null, heldCounts = null, joinedDropped = false;
  let pieceInfo = null, pieceWords = null, rangeScope = null, pieceBase = null;
  let ranged_replaced = 0;   /* R51, R49: the replacement characters the windows of a page read by range decoded */
  let textParas = null;   /* R63: the paragraphs the text numbers (`para` takes 0..n-1); null where this answer does not hold the whole text */

  if (!wireable && textRead) {
    /* R1: text read as text with no format entry that reads it goes to the content type's reader. */
    classifiedText = text; member = "plane";
    if (piecesOn) await breathe(text.length);
    const { stackId, docType } = piecesOn && text.length > BREATHE_AT ? await classifyYielding() : classify();
    if (piecesOn) await breathe(text.length);
    /* R32: its text units, drawn from the decoded text (the page's visible text for HTML); a capture whose text holds
       no glyph has none. The reader's outcome below does not change them. */
    if (piecesOn) {
      /* R40: the first piece; the totals are of the whole
         text, so the reading says how much of it the piece holds. */
      if (rangedTxt && !rangedTxt.html) {
        /* R50: the first piece of a text read by range: its units are the windows' from the start; the head gave the reading's facts and the grain, and what only
           the whole could give (the document's words) is stated by the last piece or not at all */
        const w = await textWindowTick(evidence, sha, { m: "t", s: sha, n: rangedTxt.size, ob: rangedTxt.bm, bm: rangedTxt.bm, g: rangedTxt.grain === "lines" ? 1 : 0, p: 0, q: 0, r: 0, ro: 1, wr: 0, ...(rangedTxt.en ? { en: rangedTxt.en } : {}) }, pieceAsk, rangedTxt.src);
        if (w.refused) return w;
        if (w.gone) return early(failed(doc, null, localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"), { failure: FAILURE_TRANSIENT }));
        textUnits = w.units.length ? w.units : null;
        pieceInfo = { ...w.fields, piece: w.piece };
        pieceWords = { words_total: null, words_read: w.piece.words };
      } else {
      const html = fmt === "html", replacedStats = { replaced: 0 };
      /* R51 (fix round 10): a page past a whole read is made visible by the streaming pass in windows; the head is the text the reader is handed (R50), the units are the page's */
      const visible = rangedTxt && rangedTxt.html ? await htmlVisibleByWindows(rangedTxt, pieceAsk.windowBytes, replacedStats) : await visibleOfYielding(text, html, true);
      if (visible === null) return early(failed(doc, null, localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"), { failure: FAILURE_TRANSIENT }));
      if (replacedStats.replaced) ranged_replaced = replacedStats.replaced;
      const p = textPieceAnswer(visible, { html, sha, ...pieceAsk });
      if (p.refused) return p;
      if (html) heldHtml = p.fields.more ? { sha, visible } : null;
      if (p.fields.more && !html)
        p.fields.cursor = (await textWindowCursorOf(evidence, { sha, bytes, text, whole: got.whole === true, at: p.at, through: p.fields.read_through, grain: p.grain })) ?? p.fields.cursor;
      if (piecesOn) await breathe(visible.length);
      const tot = await totalsOfText(visible, html, p.grain);
      textUnits = p.units.length ? p.units : null;
      textParas = tot.paras;
      pieceInfo = { ...p.fields, piece: { ...p.piece, units_total: tot.units } };
      pieceWords = { words_total: tot.words, words_read: p.piece.words };
      }
    } else ({ textUnits, textUnitsOverBound, textUnitsSkipped, paragraphCount: textParas } = textUnitsOfText(text, { html: fmt === "html", budget: unitsBudget }));
    /* R34: the title, read from the markup R32's units drop; null for any text that is not HTML. A reader that throws
       gives a failed reading, which carries none. */
    const title = fmt === "html" ? titleOfHtml(text) : null;
    if (typeof docType.type.parse === "function") {
      try {
        const parsed = docType.type.parse({ ...profCtx, handler: stackId.handler, at: retrieved, ...vw }) || {};
        const { entities: parsedEntities, ...rest } = parsed;
        const facts = (rest && typeof rest.facts === "object" && Object.keys(rest).length === 1) ? rest.facts : rest;
        const entities = readEntities(parsedEntities);
        reading = {
          content_type: docType.type.key, reader_version: docType.type.version ?? null,
          read_from_text: true, found: entities.length > 0,
          entities, facts: facts || {}, at: retrieved,
          title,
          basis: entities.length
            ? word("reading-pipeline.why.read_reader", { key: String(docType.type.key), version: String(docType.type.version), entities: String(entities.some((e) => e.source) ? "" : localize("reading-pipeline.index.read_one_undivided_string", " — no reference carries where it was read: this document was read as one undivided string, which names no part of a container to point at")) })
            : word("reading-pipeline.why.reader_found_entities_document", { key: String(docType.type.key) }),
          position_parts: 0,
          position_why: entities.some((e) => e.source) ? null
            : word("reading-pipeline.text_read_back"),
        };
      } catch (e) {
        reading = {
          content_type: docType.type.key, reader_version: docType.type.version ?? null,
          read_from_text: true, found: false, entities: [], facts: {}, at: retrieved,
          basis: word("reading-pipeline.why.reader_parse_document", { key: String(docType.type.key), entry: String(String(e && e.message || e)) }),
          failure: FAILURE_FINAL,   /* R37: the content type's reader threw over this text; it throws again */
        };
      }
    } else {
      reading = {
        content_type: docType.type.key, reader_version: docType.type.version ?? null,
        read_from_text: false, found: false, entities: [], facts: {}, at: retrieved,
        title,
        basis: word("reading-pipeline.why.content_type_declares", { key: String(docType.type.key) }),
      };
    }
    /* R13: an entry with a decoding choice but no text answers its dialect over the same bytes. */
    try {
      if (entry && typeof entry.dialect === "function") readDialect = readingDialect(await entry.dialect(bytes));
    } catch { readDialect = undefined; }
    /* R33: a reading given text units carries the chain they were formed by, the plane's layer at tier null (R14 stays
       true), so `extraction` stores it and `content`'s extent gate finds one. A reading with no unit list has none. */
    /* R49: the encoding the text was decoded in, whether it was assumed, the windows that disagree, and a replacement past the
       tolerance counted as a part not read (partial) */
    /* R52 (G133f): a text judged from a view (docprofile R19, R40: above 2 MiB, whatever its kind) says so, as the entry path's reading does (R11) */
    { const sampled = docType.classified_over && typeof docType.classified_over === "object" ? docType.classified_over : null;
      if (sampled) { reading.classified_over = sampled; reading.basis = reading.basis ? `${reading.basis} — ${classifiedOverSentence(sampled)}` : classifiedOverSentence(sampled); } }
    Object.assign(reading, encodingFacts(decoded));
    if (decoded && decoded.ok && decoded.replaced_ratio > REPLACED_TOLERANCE) reading.units_skipped = (reading.units_skipped || 0) + 1;
    /* R51, R49: the windows of a page read by range past its head decoded these replacement characters: counted, and over the tolerance the reading is partial as a text's is */
    if (ranged_replaced && rangedTxt) {
      reading.encoding_replaced = (reading.encoding_replaced || 0) + ranged_replaced;
      if (ranged_replaced / rangedTxt.size > REPLACED_TOLERANCE && !(decoded && decoded.replaced_ratio > REPLACED_TOLERANCE)) reading.units_skipped = (reading.units_skipped || 0) + 1;
    }
    if (textUnits) {
      const container = fmt && fmt !== "undetermined" ? fmt : "text";
      reading.text_source = layerChainFor(null, { tier: null, container });
      reading.text_container = container;
      /* R63: the paragraph count, as an office reading states it, so a paragraph extent past the end is bounded; null where the answer does not hold the whole text */
      reading.container_extent = { container, levels: ["paragraphs"], sheets: null, paragraphs: textParas, slides: null };
      /* R35: the words of the text the units were drawn from, and the words the units hold. */
      Object.assign(reading, piecesOn ? pieceWords : textWordsOfText(text, { html: fmt === "html", budget: unitsBudget }));
    }
  } else if (wireable) {
    /* R2 (D-593, D-684): through the entry over the stored bytes, tier 1, including delimited text read as text at
       intake and a multi-part capture within the bound: a CSV's text is the entry's own decode. */
    let i2text = null, wiredTier = null, pageCount = null, pageBoxes = null, pdfPaints = null, wired = null;
    let chain = null, ocrNote = null, tier2note = null, tier2PerPage = null, t3Wanting = false, aiRead = null, structMeta = null;
    let memberDown = false, ocrLeft = null, refusal = null, ocrFacts = null, heldOpenLost = false;
    const noteLists = [];   /* R62: the notes the structure read and the tier-2 member left, listed on the reading by `recoveryNotesOf` */
    /* G26: in pieces mode a PDF is read by page ranges when its entry reads them. */
    let ranged = piecesOn && fmt === "pdf" ? rangeCursorIn(pieceAsk.cursor, { sha }) : null;
    if (ranged && ranged.refused) return ranged;
    if (ranged && ranged.list) ranged = null;
    try {
      let st = null;
      if (ranged) {
        const ask = { from: ranged.from, count: pieceAsk.rangePages, maxBytes: PDF_RANGE_BYTES };
        let open = held;
        if (!open) {
          openedPdf = null;   /* one open document at a time: the last digest's is let go before this one is parsed */
          const opened = await openPdfRange(bytes, { yieldNow });   /* G82: the turn is given back between the slices of the open */
          if (opened && opened.ok === true && typeof opened.range === "function") open = { sha, opened };
        }
        st = open ? await open.opened.range(ask) : await extractPdfRange(bytes, ask);
        /* bytes the range reader does not open as a PDF with pages are the format entry's to judge, as a whole read judges them */
        if (!st.ok || !(st.pages > 0)) {
          if (held) { heldOpenLost = true; throw new Error("the PDF kept open gave no range"); }
          ranged = null;
        } else if (open) openedPdf = open;
      }
      if (ranged) {
        bytes = null;
        if (st && st.ok && ranged.n !== null && st.pages !== ranged.n) return refuse(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
        if (!(st && st.ok)) refusal = refusalOf(st);
        else {
          i2text = st.text || null; wiredTier = 1;
          structMeta = st.metadata || null;
          noteLists.push(st.notes);
          if (Number.isInteger(st.pages) && st.pages > 0) pageCount = st.pages;
          pageBoxes = pageBoxesFrom(st.pageBoxes);
          pdfPaints = { images: Array.isArray(st.images) ? st.images : null,
                        why: typeof st.imagesWhy === "string" ? st.imagesWhy : null };
          rangeScope = { from: st.from, count: st.count, total: st.pages };
          /* K4861: tier 2 is asked for this range's pages (an encrypted file's range answers none at tier 1: the pages asked) */
          const t2 = await tier2Escalate(env, { sha, storeName, text: i2text, from: st.from,
                                                count: st.count > 0 ? st.count : Math.min(pieceAsk.rangePages, st.pages - st.from) });
          if (t2.transient) memberDown = true;
          noteLists.push(t2.memberNotes);
          if (t2.outcome === "refused") tier2note = t2.note;
          else if (t2.outcome !== "merged") tier2note = tier2FailureNote(t2.outcome);
          else {
            i2text = t2.text; tier2PerPage = t2.perPage; tier2note = t2.note;
            if (t2.replaced.length) wiredTier = 2;
            if (t2.replaced.length && t2.kept.length) {
              const merged = mergedChain([
                { pages: t2.kept,     chain: layerChainFor(i2text, { tier: 1, container: fmt }) },
                { pages: t2.replaced, chain: layerChainFor(i2text, { tier: 2, container: fmt }) },
              ]);
              if (Array.isArray(merged)) chain = merged;
            }
          }
        }
      } else if (typeof entry.text === "function") {
        const parts = typeof entry.parts === "function" ? await entry.parts(bytes) : bytes;
        if (piecesOn) await breathe(bytes.length);
        const tt = await entry.text(parts, { inlineCellsMax: rangedCsv ? 0 : INLINE_CELLS_MAX_BYTES, ...(piecesOn && bytes.length > BREATHE_AT ? { yieldNow } : {}) });   /* R44: the cap is opt-in, asked here only; G82: and the turn given back between windows, where the entry can */
        if (piecesOn) await breathe(objLen);
        bytes = null;
        if (tt && tt.ok !== false) { i2text = tt; wiredTier = 1; }
        else refusal = refusalOf(tt);
      } else {
        const st = await entry.structure(bytes);
        bytes = null;   /* the parse is done: the capture's bytes are held no longer (R2, the reading's memory) */
        if (!(st && st.ok)) refusal = refusalOf(st);
        if (st && st.ok) {
          i2text = st.text || null; wiredTier = 1;
          /* R34: a structure reader states the document's own metadata beside its text (pdf-reader R39: the /Info Title). */
          structMeta = st.metadata || null;
          noteLists.push(st.notes);
          if (Number.isInteger(st.pages) && st.pages > 0) pageCount = st.pages;
          /* N100 (R12): each page's box, off the structure object (tier 2 and 3 replace `text`, not it). */
          pageBoxes = pageBoxesFrom(st.pageBoxes);
          pdfPaints = { images: Array.isArray(st.images) ? st.images : null,
                        why: typeof st.imagesWhy === "string" ? st.imagesWhy : null };
          /* R3: tier 2, merged page by page; two page-scoped parts when both tiers hold pages. */
          const t2 = await tier2Escalate(env, { sha, storeName, text: i2text });
          if (t2.transient) memberDown = true;
          noteLists.push(t2.memberNotes);
          if (t2.outcome === "refused") tier2note = t2.note;
          else if (t2.outcome !== "merged") tier2note = tier2FailureNote(t2.outcome);
          else {
            i2text = t2.text; tier2PerPage = t2.perPage; tier2note = t2.note;
            if (t2.replaced.length) wiredTier = 2;
            if (t2.replaced.length && t2.kept.length) {
              const merged = mergedChain([
                { pages: t2.kept,     chain: layerChainFor(i2text, { tier: 1, container: fmt }) },
                { pages: t2.replaced, chain: layerChainFor(i2text, { tier: 2, container: fmt }) },
              ]);
              if (Array.isArray(merged)) chain = merged;
            }
          }
        }
      }
      /* R46 (G129a): the range moved as far as the pages it carries, not as far as it asked; one that carries none ends stated: a
         file needing a user password `PASSWORD_REQUIRED` (pdf-worker's marker), an encrypted one tier 2 could not open `ENCRYPTED` */
      if (rangeScope) {
        const carried = new Set((i2text && Array.isArray(i2text.pages) ? i2text.pages : []).map((x) => x && x.page)
          .filter((pg) => Number.isInteger(pg) && pg >= rangeScope.from && pg < rangeScope.total));
        let last = -1;
        for (const pg of carried) if (pg > last) last = pg;
        rangeScope.count = Math.max(rangeScope.count, carried.size ? last + 1 - rangeScope.from : 0);
        if (rangeScope.count === 0 && !memberDown) refusal = { reason: encryptedReasonOf(i2text) || NO_PROGRESS };
      } else if (!refusal && !memberDown && fmt === "pdf") {
        /* R46 (G155): a whole read states it as a range does: no page carried and the text marked locked is the file's refusal */
        const why = encryptedReasonOf(i2text);
        if (why && !(i2text && Array.isArray(i2text.pages) && i2text.pages.length)) refusal = { reason: why };
      }
      /* R54 (G135d): a size or structure bound an entry left as a marker in its text is the file's refusal, stated with its figures */
      if (!refusal && i2text && wiredTier === 1) refusal = guardRefusalOf(i2text);
      /* R4–R6: tier 3. */
      const t3 = await tier3Extend(env, { sha, storeName, i2text, wiredTier, tier2PerPage, fmt, liveCalibration,
                                          ...(Number.isInteger(ocrInvocations) && ocrInvocations >= 0 ? { invocations: ocrInvocations } : {}),
                                          ...(Array.isArray(killedPages) ? { killedPages } : {}),
                                          ...(typeof stampUnit === "function" ? { stampUnit } : {}) });
      i2text = t3.i2text; wiredTier = t3.wiredTier;
      ocrFacts = t3;
      if (t3.transient) memberDown = true;
      ocrLeft = t3.left || null;
      if (t3.chainSet) chain = t3.chain;
      if (t3.ocrNote != null) ocrNote = t3.ocrNote;
      t3Wanting = t3.stillWanting;
      /* R29: tier 4, at a member's act only, over what tiers 1-3 settled and before a Drive export's conversion. */
      if (transcription && i2text) {
        const t4 = await tier4Extend(transcription, { sha, storeName, i2text, wiredTier,
          chain: chain || layerChainFor(i2text, { tier: wiredTier, container: fmt }) });
        if (t4.filled.length) {
          i2text = t4.i2text; chain = t4.chain; wiredTier = t4.wiredTier;
          aiRead = { pages: t4.filled, engine: t4.engine.engine, version: t4.engine.version, label: AI_READING_LABEL };
        }
        if (t4.aiNote) ocrNote = ocrNote ? `${ocrNote}; ${t4.aiNote}` : t4.aiNote;
      }
      if (i2text && Object.prototype.hasOwnProperty.call(i2text, "dialect")) {
        try { readDialect = readingDialect(i2text.dialect); } catch { readDialect = undefined; }
      }
      /* R17 over the text in hand, then the joined copy let go: the stages below read the pages. */
      if (piecesOn) await breathe(objLen);
      heldCounts = textCountsOf(i2text);
      if (piecesOn) await breathe(objLen);
      { const lean = withoutJoinedDocument(i2text); if (lean !== i2text) joinedDropped = true; i2text = lean; }
      emitted = i2text;
      const extent = containerExtentOf(i2text, { pdfPaints, fmt });
      if (rangeScope) {
        /* G26: this range's units; the pages from `next` on are the next piece's. */
        const p = rangePieceAnswer(i2text, { sha, from: rangeScope.from, count: rangeScope.count, total: rangeScope.total, ...pieceAsk });
        if (!p.fields.more && openedPdf !== null && openedPdf.sha === sha) openedPdf = null;   /* the last piece: the document is let go */
        textUnits = p.units.length ? p.units : null;
        pieceInfo = { ...p.fields, piece: p.piece };
        rangeScope = { ...rangeScope, to: p.next };
        if (pieceAsk.cursor !== null) {
          /* a later range is its units and what its pages add: the OCR it left, refused or lost, and the pictures it left unread */
          const facts = {};
          stateOcr(facts, ocrLeft, ocrFacts, i2text);
          /* K4911 (B47): the chain of this range's own pages, as the whole read's `text_source` restricted to them (the tiers that read them: layer, ocr, ...), so what the
             range's units are stored under is theirs and not the first piece's; absent when no page of the range holds text */
          const hasText = (Array.isArray(i2text && i2text.pages) ? i2text.pages : []).some((pg) => pg && typeof pg.text === "string" && glyphCount(pg.text) > 0);
          const pieceChain = hasText ? (chain || layerChainFor(i2text, { tier: wiredTier, container: fmt })) : null;
          if (Array.isArray(pieceChain)) facts.piece_chain = pieceChain;
          return { ...(textUnits ? { text_units: textUnits } : {}), ...p.fields, piece: p.piece,
                   ...(Object.keys(facts).length ? { reading: facts } : {}) };
        }
      } else if (rangedCsv) {
        /* K4868: the first piece of a CSV read by range: its units are the windows' from the first row; the head's text gave the reading's
           facts, and what only the whole could give (the document's words, rows and columns) is stated by the last piece or not at all */
        const sheet0 = Array.isArray(i2text && i2text.sheets) ? i2text.sheets[0] : null;
        const c0 = { m: "c", s: sha, n: rangedCsv.size, ob: 0, rw: 1, li: 0, sk: 0, bi: 0, rt: 0, tt: rangedCsv.size, he: rangedCsv.he, hr: rangedCsv.hr,
                     dl: rangedCsv.dl, lr: 0, lc: "", rg: "", sh: sheet0 && typeof sheet0.name === "string" && sheet0.name ? sheet0.name : "csv",
                     ro: 1, cn: sheet0 && sheet0.usedCols > 0 ? sheet0.usedCols : 1, wr: 0 };
        const w = await csvWindowTick(evidence, sha, c0, pieceAsk, rangedCsv.src, { len: rangedCsv.he, res: i2text });
        if (w.refused) return w;
        if (w.gone) return early(failed(doc, null, localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"), { failure: FAILURE_TRANSIENT }));
        textUnits = w.units.length ? w.units : null;
        pieceInfo = { ...w.fields, piece: w.piece };
      } else if (piecesOn) {
        /* R40/R41: the units of the entry's text in pieces, from the first or the cursor's; a piece after the first is units alone. */
        const all = allUnitsOf(i2text) || [];
        if (piecesOn) await breathe(objLen);
        const plan = pieceUnitPlan(i2text, all);   /* G48: made once for the piece and its totals */
        if (piecesOn) await breathe(objLen);
        const p = listPieceAnswer(plan, { sha, ...pieceAsk });
        if (p.refused) return p;
        /* G68: the pieces after this one are read by a window when the capture can be (a cursor of the old kind is moved on to one) */
        if (p.fields.more && fmt === "csv") {
          const meta = plan.metaAt(p.next);
          const w = meta ? await csvWindowCursorOf(evidence, { sha, whole: got.whole === true, size: objLen, i2text, meta, next: p.next,
                                                               read: p.fields.read_through, total: p.fields.total }) : null;
          if (w) p.fields.cursor = w;
        }
        textUnits = p.units.length ? p.units : null;
        pieceInfo = { ...p.fields, piece: { ...p.piece, units_total: plan.n } };
        pieceBase = all;
        if (pieceAsk.cursor !== null) return { ...(textUnits ? { text_units: textUnits } : {}), ...p.fields, piece: p.piece };
      } else ({ textUnits, textUnitsOverBound, textUnitsSkipped } = textUnitsFor(i2text, { budget: unitsBudget }));
      if (i2text) {
        if (piecesOn) await breathe(objLen);
        wired = readText(decodeView(i2text), { headers, locator, content_type: ct || null, at: retrieved, origin: CAPTURE_ORIGIN,
                                               ...vw });
        classifiedText = i2text;
      }
      if (piecesOn) await breathe(objLen);
      if (i2text && !chain) chain = layerChainFor(i2text, { tier: wiredTier, container: fmt });
      /* R10: a Drive export's conversion at the head, after every other part is settled; a refused prepend records
         no chain and fails the reading, naming the refusal. */
      const drive = driveHopOf(doc);
      if (drive && Array.isArray(chain)) {
        const converted = convertedChain(driveConvertStep(drive), chain);
        if (Array.isArray(converted)) chain = converted;
        else {
          chain = null;
          wired = { determined: false,
                    why: word("reading-pipeline.why.text_chain_google", { check: String(converted.check), code: String(converted.code), detail: String(converted.detail) }) };
        }
      }
      reading = wired
        ? readingFromWire({ wired, docType: wired.determined ? null : classify().docType, chain, wiredTier, fmt, retrieved, tier2note, ocrNote, tier3Candidate: t3Wanting })
        : { ...failed(doc, classify().docType, [tier2note, ocrNote, localize("reading-pipeline.index.entry_no_text", "the {fmt} entry produced no text from these bytes", { fmt: String(fmt) })]
              .filter(Boolean).join(" — "), { failure: memberDown || ocrLeft ? FAILURE_TRANSIENT : FAILURE_FINAL }) };
      /* R35: a reading with text units counts its words. */
      if (textUnits && !rangeScope && piecesOn) await breathe(objLen);
      if (textUnits) Object.assign(reading, rangeScope || rangedCsv ? { words_total: null, words_read: pieceInfo.piece.words } : textWordsFor(i2text, textUnits, pieceBase ? { all: pieceBase } : undefined));
      /* R37 (D4): a reading that read nothing says whether it can be read again: a member that was down is a cause outside
         the document, anything else is the document's own. */
      if (!wired || !wired.determined) reading.failure = memberDown || ocrLeft ? FAILURE_TRANSIENT : FAILURE_FINAL;   /* R55: pages owed are read later */
      /* R38: the entry's own final refusal (a PDF too large to read, pdf-reader R42) is carried as data the page can state. */
      if (refusal && !(wired && wired.determined)) {
        Object.assign(reading, refusal, { failure: FAILURE_FINAL });
        const said = refusalSentence(refusal);
        if (said) reading.basis = said;   /* R54: the sentence names the cause and its two figures */
      }
      /* R37 (F9): the OCR pages this request did not reach, the first of them (the cursor) and how many, stated on the
         reading and owed to the caller's ledger. */
      stateOcr(reading, ocrLeft, ocrFacts, i2text);
      /* R34: a determined reading carries the title its entry's metadata states, else null; a failed one carries none. */
      if (wired && wired.determined) reading.title = titleOfMetadata(i2text && i2text.metadata) ?? titleOfMetadata(structMeta);
      /* R29: the pages the AI read, labeled as its reading. */
      if (aiRead) reading.ai_transcription = aiRead;
      /* R12: never zero. */
      reading.page_count = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : null;
      /* N100 (R12): the boxes under the count's rule: present where it is, null where no box was read. */
      reading.page_boxes = pageBoxes;
      /* R62: what the structure read repaired reaches the reading; a sound file lists none (the key is absent) */
      const recovered = recoveryNotesOf(...noteLists);
      if (recovered.length) reading.recovery_notes = recovered;
      /* K4868: the head's rows and columns are the head's, not the sheet's: stated as not read (null) until the whole is */
      if (rangedCsv && extent && Array.isArray(extent.sheets))
        extent.sheets = extent.sheets.map((sh) => ({ ...sh, rows: null, cols: null, usedRows: null, usedCols: null }));
      reading.container_extent = extent;
    } catch (e) {
      if (openedPdf !== null && openedPdf.sha === sha) openedPdf = null;
      /* R37 (G133c): a throw on the file's own bytes is the document's, final with its reason (it throws again); only the open
         document lost between ticks is a cause outside it */
      reading = failed(doc, classify().docType, localize("reading-pipeline.index.entry_not_read_bytes", "the {fmt} entry could not read these bytes ({detail}), so nothing is claimed about its text", { fmt: String(fmt), detail: String(String(e && e.message || e).slice(0, 200)) }), { failure: heldOpenLost ? FAILURE_TRANSIENT : FAILURE_FINAL, page_count: null, page_boxes: null, container_extent: null });
      textUnits = null; textUnitsOverBound = 0; textUnitsSkipped = null; classifiedText = null; emitted = null; heldCounts = null; joinedDropped = false;
    }
  } else {
    if (piecesOn && pieceAsk.cursor !== null) return refusal(NOT_PIECEWISE, "reading-pipeline.index.non_textual_large");
    reading = failed(doc, classify().docType, localize("reading-pipeline.index.document_not_read_text", "the document was not read as text ({why}), so no reading was attempted", { why: multipart ? localize("reading-pipeline.index.multipart", "multipart") : localize("reading-pipeline.index.non_textual_large", "non-textual or too large") }),
                     { failure: FAILURE_FINAL, page_count: null, page_boxes: null, container_extent: null });
  }

  /* R14: the reading's provenance, at one site for every branch, over exactly the text the reader was handed; text
     read as text at intake names the plane with tier null. */
  if (piecesOn) await breathe(typeof classifiedText === "string" ? classifiedText.length : objLen);
  reading.provenance = await readingProvenance({
    text: classifiedText, chain: Array.isArray(reading.text_source) ? reading.text_source : null,
    tier: Number.isInteger(reading.text_tier) ? reading.text_tier : null,
    container: typeof reading.text_container === "string" ? reading.text_container : null,
    planeVersion, member, yielding: piecesOn, ...(joinedDropped ? { textFrom: "document" } : {}) });
  /* G26: a PDF read in ranges digests the pages of the first range only; the provenance says so. */
  if (rangeScope && reading.provenance && typeof reading.provenance === "object")
    reading.provenance.text_scope = { pages: [rangeScope.from, rangeScope.to ?? rangeScope.from + rangeScope.count] };
  /* R50: a text read by range digests and counts its head, the bytes to the end of the first window; the provenance says so */
  if (rangedTxt && reading.provenance && typeof reading.provenance === "object")
    reading.provenance.text_scope = { bytes: [0, rangedTxt.head.length], of: rangedTxt.size };
  /* K4868: a CSV read by range digests and counts its head (to the first record boundary at or past the signature window); the provenance says so */
  if (rangedCsv && reading.provenance && typeof reading.provenance === "object")
    reading.provenance.text_scope = { bytes: [0, rangedCsv.he], of: rangedCsv.size };
  /* N139 (R17): the counts of exactly the text the reader was handed; none when no text was. */
  { const n = heldCounts || (piecesOn && typeof classifiedText === "string" && classifiedText.length > BREATHE_AT ? await textCountsSliced(classifiedText) : textCountsOf(classifiedText));
    if (n) Object.assign(reading, n); }
  /* R28: the entry's metadata, or null, and a workbook's or a `.docx` document's cells, as emitted. */
  Object.assign(reading, emittedFieldsOf(emitted));
  /* R13: absent when no entry answered a decoding choice. */
  if (readDialect !== undefined) reading.dialect = readDialect;
  return { reading,
           ...(pieceInfo ? pieceInfo : {}),
           ...(textUnits ? { text_units: textUnits } : {}),
           ...(textUnitsOverBound ? { text_units_over_bound: textUnitsOverBound } : {}),
           ...(textUnitsSkipped ? { text_units_skipped: textUnitsSkipped } : {}) };
}

/* R44 (fix round 6, G41; K4636, K4642): a range of a held sheet's typed cells, made from the held file when a member opens or
   cites it. `format` is the entry's key; `sheet`, `fromRow`, `toRow`, `fromCol`, `toCol` and `maxCells` pass to its `cellsIn`
   (csv-reader, office-readers), and its answer `{ok, cells, rows, next_row?}` is answered as it is. `{ok: false, reason}`
   with `cells_not_interpretable` for an entry without the slot (or none, or one that throws or answers no object), and
   `bytes_not_held` for bytes the store does not hold (transient, as `bytesOf` states it; a whole over WHOLE_READ_MAX
   carries `failure: "final"`). An entry's own refusal is answered `{ok: false, reason, why?}` (K4656): `reason` from its `why`
   when that is all it gives. It never throws. */
export async function cellsInRange(evidence, doc, { format, sheet, fromRow, toRow, fromCol, toCol, maxCells } = {}) {
  try {
    const entry = typeof format === "string" && format ? getFormat(format) : null;
    if (!entry || typeof entry.cellsIn !== "function")
      return { ok: false, reason: CELLS_NOT_INTERPRETABLE };
    let got;
    try {
      /* K4868: a CSV past a whole read's bound and within its own is held in the range source's one read (its cells are made by the entry, which
         reads it in windows); every other capture is `bytesOf`'s */
      const src = format === "csv" ? rangeSource(evidence, doc || {}) : null;
      if (src && Number.isInteger(src.size) && src.size > WHOLE_READ_MAX && src.size <= boundOf("csv", "bytes")) {
        const all = await src.readRange(0, src.size);
        got = all instanceof Uint8Array && all.length === src.size ? { bytes: all } : { bytes: null, failure: FAILURE_TRANSIENT };
      } else got = await bytesOf(evidence, doc || {});
    }
    catch { return { ok: false, reason: BYTES_NOT_HELD, failure: FAILURE_TRANSIENT }; }
    if (!got || !got.bytes)
      return { ok: false, reason: BYTES_NOT_HELD, failure: (got && got.failure) || FAILURE_TRANSIENT, ...(got && got.why ? { why: got.why } : {}) };
    const ask = { sheet, fromRow, toRow, fromCol, toCol, maxCells };
    for (const k of Object.keys(ask)) if (ask[k] === undefined) delete ask[k];
    const out = await entry.cellsIn(got.bytes, ask);
    if (!out || typeof out !== "object" || typeof out.ok !== "boolean") return { ok: false, reason: CELLS_NOT_INTERPRETABLE };
    /* K4656: one refusal shape whatever the entry: `reason`, set from the entry's `why` when that is all it answers, `why` kept */
    if (out.ok === false && typeof out.reason !== "string") return { ...out, reason: typeof out.why === "string" ? out.why : CELLS_NOT_INTERPRETABLE };
    return out;
  } catch (e) {
    return { ok: false, reason: CELLS_NOT_INTERPRETABLE, why: String(e && e.message || e).slice(0, 200) };
  }
}
