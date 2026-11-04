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
import { getFormat, readingDialect, detectFormat, formatNameFor } from "../formats.mjs";
import { identify, doctypeFor, doctypeForYielding, readText } from "../../../docprofile/registry.mjs";
import { driveConvertStep } from "../drive.mjs";
import { extractPdfRange, openPdfRange } from "../pdfstructure.mjs";
import { readingProvenance, describePages, yieldNow } from "./readingprov.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf, statement, READ_BOUNDS } from "../read-bounds.mjs";
import { decodeText } from "../ooxml.mjs";

export { readingProvenance, compareProvenance, describePages, PROVENANCE_SCHEME } from "./readingprov.mjs";
export { ReadHooks, readHooksOf } from "./hooks.mjs";


/* BOB's split (4 Nov 2026, PR 274): the reader contract and the readers (`reader-contract` R45–R58, R60–R67) live in
   `reader-contract`; every name this module exported before the split is exported here still, from there. */
import { ACQUIRE_TEXT_UNITS_BUDGET, BARE_DIGEST, BREATHE_AT, CAPTURE_ORIGIN, CSV_WINDOW_FROM, CURSOR_MISMATCH, FAILURE_FINAL,
         FAILURE_TRANSIENT, HELD_OPEN, INLINE_CELLS_MAX_BYTES, NOT_PIECEWISE, NO_PROGRESS, PDF_RANGE_BYTES, PDF_RANGE_PAGES, PIECE_UNITS_MAX,
         REPLACED_TOLERANCE, TEXT_FORMATS, TEXT_TYPE, TEXT_WINDOW_FROM, WINDOW_BYTES, allUnitsOf, breatheIf, bytesOf, charsetOf,
         classifiedOverSentence, containerExtentOf, contractOf, csvRangedHead, csvWindowCursorOf, csvWindowTick, declaredNameOf, decodeView,
         decodedTextOf, documentAddressOf, driveHopOf, emittedFieldsOf, encodingFacts, encryptedReasonOf, entryFor, failed, glyphsOfDocument,
         guardRefusalOf, heldHtml, htmlVisibleByWindows, isBareStub, kindOfDetected, listPieceAnswer, natural, openedPdf, pageBoxesFrom,
         pieceUnitPlan, plan, rangeCursorIn, rangePieceAnswer, readEntities, readingFromWire, refusal, refusalOf, refusalSentence, refuse,
         sig, skipWindow, textCountsOf, textCountsSliced, textPieceAnswer, textRangedHead, textUnitsFor, textUnitsOfText, textWindowCursorOf,
         textWindowTick, textWordsFor, textWordsOfText, titleOfHtml, titleOfMetadata, totalsOfText, unb64, unreadKindOf, unreadSentence,
         visibleOfYielding, windowCursorOf, windowTick, withoutJoinedDocument, wordsIn } from "../reader-contract/index.mjs";
export { ACQUIRE_TEXT_UNITS_BUDGET, ACQUIRE_TEXT_UNIT_ENVELOPE, BARE_DIGEST, BYTES_NOT_HELD, CAPTURE_TEXT_UNIT_CAP, CELLS_NOT_INTERPRETABLE,
         CSV_WINDOW_FROM, CURSOR_MISMATCH, ENCRYPTED, FAILURE_FINAL, FAILURE_TRANSIENT, INLINE_CELLS_MAX_BYTES, MULTIPART_READ_MAX,
         NOT_PIECEWISE, NO_PROGRESS, PARTS_MAX, PART_KINDS, PASSWORD_REQUIRED, PDF_RANGE_BYTES, PDF_RANGE_PAGES, PIECE_UNITS_MAX,
         REPLACED_TOLERANCE, TEXT_WINDOW_FROM, TITLE_MAX_CHARS, UNIT_KILLED_READER, UNIT_KINDS, WHOLE_READ_MAX, WINDOW_BYTES, bytesOf,
         cellsInRange, chunkUnits, chunksOf, classifiedOverSentence, completenessOf, containerExtentOf, decodeView, emittedFieldsOf,
         glyphsOfDocument, isBareStub, pageBoxesFrom, partsOf, plan, rangeSource, readEntities, readingFromWire, textCountsOf, textUnitsFor,
         textUnitsOfText, textWordsFor, textWordsOfText, titleOfHtml, titleOfMetadata, utf8Length, windowCursor, windowEncodable,
         withoutJoinedDocument, wordsIn, visibleTextOfHtml } from "../reader-contract/index.mjs";
import { interpretUnits as interpretUnitsOf, setHeldHtml, setOpenedPdf } from "../reader-contract/index.mjs";

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
  /* R68 (T53-126; DEC-479 (51)): the words below the reader's own measured clarity, where the reader measured each word (the OCR member's `legibility`: its words
     and those it rated at its threshold). A reading with no such measure (a text layer, a digital document, a model's opinion of itself) carries no `unclear_words`, never a
     zero. A refused page's text is not kept, so its words are no part of the reading. The member states a count per page and no offset per word, so a position is the page
     and the number of its unclear words, in page order. */
  const unclear = leg.filter((l) => l.stored !== false && Number.isInteger(l.words) && Number.isInteger(l.confident_words) && l.words >= l.confident_words);
  if (unclear.length)
    target.unclear_words = { count: unclear.reduce((n, l) => n + (l.words - l.confident_words), 0),
                             positions: unclear.filter((l) => l.words > l.confident_words).map((l) => ({ page: l.page, count: l.words - l.confident_words })) };
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
      if (!p.fields.more) setHeldHtml(null);
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
    return early(failed(doc, null, localize("reading-pipeline.index.csv_in_pieces", "this CSV is {size} bytes, more than a whole read holds ({limit}), so it is read in pieces and none of it is read yet", { size: String(rangedCsv.size), limit: String(CSV_WINDOW_FROM) }), { failure: FAILURE_TRANSIENT }));
  if (rangedCsv) fmt = "csv";
  /* R50: a text, JSON or XML past a whole read's bound and within the text bound is read by range from its first piece too */
  const textual = profile.profiled_from_text === true || TEXT_TYPE.test(profile.source_content_type || ct || "");
  /* a later piece of a page is cut from its visible text, made again from the windows when the object lost the one it kept (R51) */
  const laterOfText = piecesOn && pieceAsk.cursor !== null && (unb64(pieceAsk.cursor) || {}).k === "t";
  const rangedTxt = !rangedCsv && (!piecesOn || pieceAsk.cursor === null || laterOfText) && !held
    ? await textRangedHead(evidence, doc, { recorded: fmt, declared: profile.source_content_type || ct || null, textual, htmlOnly: laterOfText,
        charset: charsetOf([headers["content-type"], ct, profile.source_content_type].find((t) => charsetOf(t)) || "") }).catch(() => null) : null;
  /* R66: a text, JSON or XML past the whole-read figure is read here as text in windows (its head stands for the bytes, so no entry is handed the head as if it were the file) */
  if (rangedTxt) fmt = rangedTxt.html ? "html" : "text";
  if (rangedTxt && !piecesOn)
    return early(failed(doc, null, localize("reading-pipeline.index.text_in_pieces", "this file is {size} bytes, more than a whole read holds ({limit}), so it is read in pieces and none of it is read yet", { size: String(rangedTxt.size), limit: String(TEXT_WINDOW_FROM) }), { failure: FAILURE_TRANSIENT }));
  const got = held ? { bytes: HELD_OPEN } : rangedCsv ? { bytes: rangedCsv.head } : rangedTxt ? { bytes: rangedTxt.head } : await bytesOf(evidence, doc, { kind: fmt, textual }).catch(() => ({ bytes: null, failure: FAILURE_TRANSIENT, why: word("acquisition.why.evidence_store_read") }));
  let bytes = got.bytes;
  const objLen = bytes ? bytes.length : 0;
  got.bytes = null;
  /* R2 (T51 fix round 5, E1; K4530): the recorded profile is never trusted over bytes the reader holds. A capture held in
     parts is profiled from no byte, so an upload's recorded format is `undetermined` (or none): it is detected again from
     the held bytes, the declared type only where they say nothing. Bytes still undetermined are text when the profile's
     declared type is a text type and they are UTF-8 without a NUL, even in parts (R32). */
  let foundAnswer = null;
  if (bytes && !held && (fmt === null || fmt === "undetermined" || fmt === "unlisted")) {
    foundAnswer = detectFormat(bytes, profile.source_content_type || ct || null);
    fmt = kindOfDetected(foundAnswer);
  }
  /* R67 (T53-124; format-registry R38): a file held and named has no reader yet: its reading is stated, not failed. It is detected afresh from the stored bytes each read, so the
     reader's arrival (`registerFormat`) reads it by the next `read`, with no second upload and nothing stored here. `unlisted` with no name is bytes no signature claimed; those go on
     (as text where they decode as text, R49). */
  if (foundAnswer && foundAnswer.format === "unlisted" && foundAnswer.named && !foundAnswer.encrypted) {
    const nm = formatNameFor(foundAnswer);
    const said = nm.text || nm.name;
    return early({ ...failed(doc, null, localize("reading-pipeline.index.held_unread", "held, not read: {name}", { name: said }), {}),
                   held_unread: { name: nm.name, kind_key: nm.kind_key, text: nm.text } });
  }
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
    const e0 = entryFor(fmt);
    if (!(e0 && (typeof e0.text === "function" || typeof e0.structure === "function"))) {
      const visible = rangedTxt && rangedTxt.html ? await htmlVisibleByWindows(rangedTxt, pieceAsk.windowBytes, null) : await visibleOfYielding(text, fmt === "html", true);
      if (visible === null) return early(failed(doc, null, localize("reading-pipeline.index.bytes_not_held", "the capture's bytes are not held in the evidence store, so nothing was read"), { failure: FAILURE_TRANSIENT }));
      const p = textPieceAnswer(visible, { html: fmt === "html", sha, ...pieceAsk });
      if (p.refused) return p;
      if (fmt === "html") setHeldHtml(p.fields.more ? { sha, visible } : null);
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

  const entry = entryFor(fmt);
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
      if (html) setHeldHtml(p.fields.more ? { sha, visible } : null);
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
          setOpenedPdf(null);   /* one open document at a time: the last digest's is let go before this one is parsed */
          const opened = await openPdfRange(bytes, { yieldNow });   /* G82: the turn is given back between the slices of the open */
          if (opened && opened.ok === true && typeof opened.range === "function") open = { sha, opened };
        }
        st = open ? await open.opened.range(ask) : await extractPdfRange(bytes, ask);
        /* bytes the range reader does not open as a PDF with pages are the format entry's to judge, as a whole read judges them */
        if (!st.ok || !(st.pages > 0)) {
          if (held) { heldOpenLost = true; throw new Error("the PDF kept open gave no range"); }
          ranged = null;
        } else if (open) setOpenedPdf(open);
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
        if (!p.fields.more && openedPdf !== null && openedPdf.sha === sha) setOpenedPdf(null);   /* the last piece: the document is let go */
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
      if (openedPdf !== null && openedPdf.sha === sha) setOpenedPdf(null);
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

/* R64 (`reader-contract`'s): `interpretUnits(document, part, {evidence, env, view})` as before the split, reading the document's units with this module's `read`. */
export function interpretUnits(document, part, opts = {}) {
  return interpretUnitsOf(document, part, { ...opts, read });
}
