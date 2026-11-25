/* content — THE EXTENT CORE, HELD HERE (requirements: `build/requirements/content.md` R48; T19 layer 4, K585 (5)).
 *
 * COPIED FROM THE CATALOGUE (`checks/bio-checks.mjs`, legacy-checks) UNCHANGED: C-45's rows (`CONTENT_EXTENT_CHECKS`,
 * now `./checks.mjs`'), the kind refused by name (`CONTENT_EXTENT_KIND_NO_PRODUCER`), the content id's shape
 * (`CONTENT_ID_RE`), the document-only context (`CONTENT_EXTENT_DOCUMENT_ONLY`), the leg reader (`legExtent`,
 * `legHasAuthoredExtent`), the relation (`extentRelation`), the checker (`checkContentExtent`) with its private
 * container predicates, and the part statement (`imagePartUndetermined`). The code below is the catalogue's text
 * line for line (its quoting kept, so the copy can be compared with its source); only the imports, this header, the
 * `refusal` helper's one table, the comments that described the catalogue's own file, the comments that named a
 * check or suite T20 deleted as live (N469, re-pointed to the module test that proves the claim), and the comments
 * that named the catalogue or the legacy store (both deleted in T19) as live (T22) changed. Every answer, finding and
 * refusal is the catalogue's, but for two `detail` sentences (the `dom` arm's and the unlanded kind's), which DEC-149
 * reworded in T35 (T35-26: the software is not called "this plane" to a member); their codes, checks and translations
 * are unchanged.
 *
 * THE ALGEBRA IS NOT COPIED: `CONTENT_EXTENT_KINDS`' eight, `CONTENT_EXTENT_A1_RE`, `rangeCorners`, `a1ToRowCol`,
 * `canonicalExtent`, `describeExtent` and `contentCitedAs` are read from `text-chain` (its R92–R98), byte-identical to
 * the catalogue's. The catalogue kept its own copy of all of this for its own callers (the leg grammar of C-2.8 and
 * C-25.10) until it was deleted (T19, control-plane R43); that leg grammar is now `inquiry-grammar`'s and reads this
 * core.
 *
 * ONE ADDITION TO THE COPY (G167, K4985; R48): the tenth kind, `doc-part` (R1, R58). `legExtent` reads its `extent_part`,
 * `checkContentExtent` judges its shape (`checkPart`, moved here from `./extent.mjs`) and `describePart` is its human form,
 * so the leg grammar, which reads this core directly, and the face answer one thing and a content id is minted over the
 * extent the reading found. Its algebra (canonical form) is text-chain's.
 *
 * `./extent.mjs` is the one public face (R1–R10); what the grammar has gained since (envelope, a rect's space, the
 * MediaBox bound) is written there, over this, never here. */

import {
  CONTENT_EXTENT_KINDS, CONTENT_EXTENT_A1_RE, rangeCorners, a1ToRowCol, canonicalExtent, describeExtent, contentCitedAs,
} from "../textchain.mjs";
import { CONTENT_EXTENT_CHECKS } from "./checks.mjs";
import { word, localize } from '../setup-words/index.mjs';

/** `dom` is NOT in the map above and that is the point: it is refused BY NAME
 *  rather than falling through the unknown-kind arm, because the two are
 *  different facts and a member citing a web page is not confused. The day
 *  CONTENT-HTML produces one, this constant goes and a row joins the map. */
export const CONTENT_EXTENT_KIND_NO_PRODUCER = 'dom';

/** DEC-49's refusal helper for this family. Its spelling, the name exactly `refusal` and the code a DOUBLE-QUOTED
 *  STRING LITERAL at every call site below inside the `is-content-extent` region, is the catalogue's, kept line for
 *  line (R48); the DEC-49 guard that matched that spelling was retired in T20, and the region marker names where each
 *  site sits. Every refusal it answers carries its row's `check` and `translation` from this module's own table, which
 *  `test/m/content/seams.test.mjs` (R48) proves for every C-45 row at the grammar, the mint and a citation;
 *  DEC-49's totality across the plane is control-plane's `test/m/control-plane/families.test.mjs` (its R22). */
function refusal(key, detail, extra = null) {
  const row = CONTENT_EXTENT_CHECKS[key];
  return { ok: false, code: key, check: row.check, translation: row.translation, detail,
           ...(extra && typeof extra === 'object' ? extra : {}) };
}

/** Read a basis leg's extent out of the RESTRICTED frontmatter grammar.
 *
 *  THE GRAMMAR CANNOT CARRY A NESTED OBJECT (`record-grammar`'s parseFrontmatter: an array
 *  element's properties are SCALARS at four spaces), so the extent arrives as
 *  flat scalars on the leg — `extent_kind`, `extent_page`, `extent_rect` as an
 *  inline array, `extent_ref` — exactly as REC-14's `completeness` /
 *  `completeness_excluded` and REC-16's `division` / `division_apportionment`
 *  splits were forced by the same grammar. This function is the ONE place that
 *  reading happens.
 *
 *  AN ABSENT `extent_kind` IS `document` AND NEVER `unstated` (Bob, 5.3):
 *  "citations that just refer to the document, well, just refer to the whole
 *  document". So every leg has an extent and there is ONE target vocabulary.
 *  The member who wants to be more specific NARROWS by an authored act.
 *
 *  WHAT THIS FUNCTION IS NOT: it is not the C-2.8 grammar arm that refuses a
 *  malformed spelling at the gate, and it is not the version-leg reader. Both
 *  are REC-84's, and a leg whose extent fields this reader cannot make sense of
 *  is refused HERE as C-45.3 rather than being read generously — so nothing
 *  waits on REC-84 to be safe. */
export function legExtent(leg) {
  const l = leg && typeof leg === 'object' ? leg : {};
  const kindRaw = l.extent_kind;
  const kind = (kindRaw === undefined || kindRaw === null || kindRaw === '')
    ? 'document' : kindRaw;
  const out = { kind };
  if (typeof l.extent_ref === 'string' && l.extent_ref.trim()) out.ref = l.extent_ref.trim();
  if (kind === 'pdf-page') {
    if (l.extent_page !== undefined && l.extent_page !== null) out.page = l.extent_page;
    if (l.extent_rect !== undefined && l.extent_rect !== null) out.rect = l.extent_rect;
  }
  /* REC-85: THE THREE ARMS' FIELDS ARE NOW READ PER ARM rather than carried
     through in one six-key bag. REC-82 wrote that bag deliberately — an
     unlanded arm had to reach `checkContentExtent` as SOMETHING so it could be
     refused BY NAME instead of being silently stripped to a document reference
     — and its prediction was that this landing "adds a reader rather than a
     shape". That held, and the bag goes rather than staying beside the reader:
     two spellings of one address are two addresses, and `canonicalExtent` takes
     the content id over exactly these fields.

     CHANGING THE CANONICAL FORM OF THESE THREE ARMS MIGRATES NOTHING, and that
     is a fact about the record rather than an argument: every one of them was
     refused as unlanded until this commit, so no row of any of these kinds can
     exist to have been addressed the old way. REC-85's suite measured the
     count zero on a real store at its landing rather than reasoning about it.
     `document` and `pdf-page` are UNTOUCHED here; their canonical form is
     text-chain's, which `test/m/content/seams.test.mjs` (R48) proves
     byte-identical answer for answer.

     EACH ARM TAKES ONLY ITS OWN FIELDS. A leg naming `extent_cell` under
     `extent_kind: doc-para` has said nothing about a paragraph, and carrying
     the stray field would let it into the address; dropping it is what makes
     `¶4` mean one thing. The stray field is not silently FORGIVEN either — it
     is REC-84's `legHasAuthoredExtent`/`content_id` arm that judges what the
     document said, and this function answers only what the leg MEANS. */
  if (kind === 'sheet-cell') {
    if (l.extent_sheet !== undefined && l.extent_sheet !== null) out.sheet = l.extent_sheet;
    if (l.extent_cell !== undefined && l.extent_cell !== null) out.cell = l.extent_cell;
  }
  if (kind === 'slide-shape') {
    if (l.extent_slide !== undefined && l.extent_slide !== null) out.slide = l.extent_slide;
    if (l.extent_shape !== undefined && l.extent_shape !== null) out.shape = l.extent_shape;
  }
  if (kind === 'doc-para') {
    if (l.extent_para !== undefined && l.extent_para !== null) out.para = l.extent_para;
    if (l.extent_run !== undefined && l.extent_run !== null) out.run = l.extent_run;
  }
  /* FW-19 / IC-125 — the two new arms and the image reference, each over its
     OWN fields on REC-85's rule. `extent_cell` is SHARED by name between
     `sheet-cell` and `doc-table` because it is the same notation (A1) naming
     the same kind of thing (one cell of a grid); each arm reads it only under
     its own kind, so it cannot leak between them. */
  if (kind === 'sheet-range') {
    if (l.extent_sheet !== undefined && l.extent_sheet !== null) out.sheet = l.extent_sheet;
    if (l.extent_range !== undefined && l.extent_range !== null) out.range = l.extent_range;
  }
  if (kind === 'doc-table') {
    if (l.extent_table !== undefined && l.extent_table !== null) out.table = l.extent_table;
    if (l.extent_cell !== undefined && l.extent_cell !== null) out.cell = l.extent_cell;
  }
  /* G167 (K4985, R48): a `doc-part` is the package part and the element reference a reader names for a non-body unit
     (R1, R58). `extent_ref` is read above for every kind; the part is read here, or the content id a citation mints would
     be over a different extent than the reading found. */
  if (kind === 'doc-part') {
    if (l.extent_part !== undefined && l.extent_part !== null) out.part = l.extent_part;
  }
  if (kind === 'image') {
    if (l.extent_part !== undefined && l.extent_part !== null) out.part = l.extent_part;
    if (l.extent_page !== undefined && l.extent_page !== null) out.page = l.extent_page;
    if (l.extent_rect !== undefined && l.extent_rect !== null) out.rect = l.extent_rect;
  }
  /* `cited_as` is read on EVERY kind, not only on `image`, so that `bytes` on
     a paragraph reaches the checker and is refused BY NAME rather than being
     dropped as a stray field — the one field whose silent drop would change
     what the citation claims. */
  if (l.extent_cited_as !== undefined && l.extent_cited_as !== null && l.extent_cited_as !== '')
    out.cited_as = l.extent_cited_as;
  return out;
}

/** REC-84 / IC-84 (1). DID THE MEMBER AUTHOR AN EXTENT AT ALL, or is this leg
 *  reading `document` because Bob's 5.3 says an unstated part means the whole
 *  document? `legExtent` deliberately cannot tell you — it answers what the leg
 *  MEANS — and two arms need the other question:
 *
 *  (1) the refusal below that a leg naming BOTH a `content_id` and an `extent`
 *      is stating one fact twice, where the two can disagree; and
 *  (2) the composition line a version leg contributes to the freeze, which must
 *      stay ABSENT for every leg written before this field existed.
 *
 *  So: TRUE only when the document actually carries an extent field. An empty
 *  `extent_kind:` is NOT authored — the restricted grammar writes `''` for a key
 *  with no value, and a member who typed nothing has said nothing. */
export function legHasAuthoredExtent(leg) {
  const l = leg && typeof leg === 'object' ? leg : {};
  for (const k of ['extent_kind', 'extent_page', 'extent_rect', 'extent_ref', 'extent_sheet',
                   'extent_cell', 'extent_slide', 'extent_shape', 'extent_para', 'extent_run',
                   /* FW-19 / IC-125 */
                   'extent_range', 'extent_table', 'extent_part', 'extent_cited_as']) {
    const v = l[k];
    if (v === undefined || v === null || v === '') continue;
    return true;
  }
  return false;
}

/** A CONTENT ID AS THE DOCUMENT MAY SPELL IT — `contentIdFor`'s own output and
 *  nothing else. Lowercase hex, exactly 64 characters, because the id IS a
 *  SHA-256 and anything that is not one cannot be an id this plane ever minted.
 *  Deliberately NOT a loose `[A-Za-z0-9]+`: a shape test that admits ids the
 *  minter cannot produce turns "this record holds no such part" (C-45.5, a true
 *  and useful sentence) into the only diagnosis a member ever gets for a
 *  mistyped field. */
export const CONTENT_ID_RE = /^[0-9a-f]{64}$/;

/** THE CONTEXT A PURE DOCUMENT CHECK CAN HONESTLY SUPPLY, and it is a value
 *  rather than an absent argument so the difference is visible at the call site.
 *
 *  `checkContentExtent` asks two questions only the RECORD can answer — how many
 *  pages this capture has, and whether any transcription chain covers it. A
 *  leg grammar run over one `bundle.md` (the catalogue's until T19,
 *  `inquiry-grammar`'s since) knows neither, and an empty `{}` would let it
 *  answer them WRONGLY: `ctx.chain` absent reads as "no chain recorded" and
 *  would refuse every portion citation in the grammar while the record admitted
 *  it. That is not a stricter gate, it is two gates holding two answers — the
 *  drift this file's one-function discipline exists to prevent.
 *
 *  So the document-only caller says `known: false` and the two record arms are
 *  SKIPPED rather than guessed. The record's caller passes a capture's context
 *  (`./index.mjs`' `contentContextFor`, the legacy store's `{ chain, pageCount }`
 *  until T19) and its behaviour is byte-for-byte what REC-82 landed. */
export const CONTENT_EXTENT_DOCUMENT_ONLY = Object.freeze({ known: false, chain: null, pageCount: null });

/* =====================================================================
 * REC-86 / IC-123 — NARROW (Bob's 5.3): a member makes an existing citation
 * more specific. THE PREDICATE, AND WHY IT IS HERE AND NOT IN THE STORE.
 *
 * `extentRelation(outer, inner)` answers how two extents of ONE capture stand
 * to each other: `same`, `narrower` (inner lies strictly inside outer),
 * `wider` (the reverse), `disjoint` (neither contains the other) or
 * `unreadable` (either side names something this file cannot evaluate). It
 * asks about `canonicalExtent`'s SAME canonical fields (text-chain's, R97) and
 * nothing else — two readings of "what part of a document is this" in two
 * files is D-164's own lesson.
 *
 * THE DEFAULT IS NOT-NARROWER, for `extentCovers`' reason one construct over:
 * an extent nobody can evaluate must never read as "inside", because the act
 * this gates would then let a citation be re-described as more precise than
 * anybody established. Every unrecognised, partial or cross-kind case answers
 * something other than `narrower`, and the act refuses on anything other than
 * `narrower`.
 *
 * WHAT COUNTS AS NARROWER, PER ARM — the finer field of each arm, and only it:
 *   document    -> any landed arm (a part of the whole is narrower than it)
 *   pdf-page    -> the same page with a rect, or a rect strictly inside a rect
 *   doc-para    -> the same paragraph with a run
 *   slide-shape -> the same slide with a shape
 *   sheet-cell  -> the same sheet with a cell
 * A different page, paragraph, slide or sheet is DISJOINT, never narrower:
 * moving a citation sideways is a different claim, not a more precise one.
 * ===================================================================== */
export function extentRelation(outer, inner) {
  const a = outer && typeof outer === 'object' ? outer : null;
  const b = inner && typeof inner === 'object' ? inner : null;
  if (!a || !b) return 'unreadable';
  const landed = (k) => Object.prototype.hasOwnProperty.call(CONTENT_EXTENT_KINDS, k)
    && CONTENT_EXTENT_KINDS[k].landed;
  if (!landed(a.kind) || !landed(b.kind)) return 'unreadable';
  const ca = JSON.parse(canonicalExtent(a));
  const cb = JSON.parse(canonicalExtent(b));
  if (JSON.stringify(ca) === JSON.stringify(cb)) return 'same';
  if (ca.kind === 'document') return 'narrower';
  if (cb.kind === 'document') return 'wider';
  if (ca.kind !== cb.kind) return 'disjoint';
  /* Each arm: the COARSE field must be present on both sides and equal, or the
     two are about different places; then the FINE field decides. */
  const byFine = (coarse, fine, inside) => {
    if (ca[coarse] == null || cb[coarse] == null) return 'unreadable';
    if (ca[coarse] !== cb[coarse]) return 'disjoint';
    const fa = ca[fine], fb = cb[fine];
    if (fa == null && fb != null) return 'narrower';
    if (fa != null && fb == null) return 'wider';
    if (fa == null && fb == null) return 'same';
    if (inside) {
      if (inside(fa, fb)) return 'narrower';
      if (inside(fb, fa)) return 'wider';
    }
    return 'disjoint';
  };
  if (ca.kind === 'pdf-page')
    return byFine('page', 'rect', (o, i) =>
      i[0] >= o[0] && i[1] >= o[1] && i[2] <= o[2] && i[3] <= o[3]);
  if (ca.kind === 'doc-para') return byFine('para', 'run', null);
  if (ca.kind === 'slide-shape') return byFine('slide', 'shape', null);
  if (ca.kind === 'sheet-cell') return byFine('sheet', 'cell', null);
  return 'unreadable';
}

/** THE CHECKER, the catalogue's copied unchanged (R48); `./extent.mjs`' face runs
 *  it for every kind this core knows, and `inquiry-grammar`'s leg grammar runs it
 *  directly (the catalogue kept its own copy until it was deleted, T19).
 *
 *  `ctx` is what only the RECORD can answer about a capture and is never
 *  invented here: `{ chain, pageCount }` (`contentContextFor`). `chain` null means
 *  the record holds no transcription chain for the capture; `pageCount` null means
 *  the record holds no page set for it, which is UNDETERMINED AND STATED and is NOT
 *  a refusal — see the `page_count` note in `./schema.mjs`.
 *
 *  ORDER MATTERS AND IT IS THE ATTESTATION CHECKER'S ORDER: the KIND is judged
 *  before the FIELDS, so a `dom` extent is refused for being `dom` rather than
 *  for the shape of a rect it should never have been composing.
 *
 *  Returns a refusal or null. */
export function checkContentExtent(extent, ctx = {}) {
  /* DEC-49 REGION is-content-extent */
  const e = extent && typeof extent === 'object' ? extent : null;
  if (!e)
    return refusal("CONTENT_EXTENT_UNREADABLE",
      localize('content.extent-core.no_extent_was_supplied', 'no extent was supplied and none could be read from the leg'));
  if (e.kind === CONTENT_EXTENT_KIND_NO_PRODUCER)
    return refusal("CONTENT_EXTENT_NO_PRODUCER",
      localize('content.extent-core.dom_names_a_region', 'extent kind \'dom\' names a region of an HTML document. Nothing produces a dom address yet (CONTENT-HTML), so a row minted against one would be an address into a grammar no producer writes and no reader can evaluate'));
  /* `doc-part` (R1, R58; G167) is text-chain's canonical arm and not one of its eight kinds; its shape is judged below */
  const row = e.kind === 'doc-part' ? { landed: true } : CONTENT_EXTENT_KINDS[e.kind];
  if (!row)
    return refusal("CONTENT_EXTENT_UNREADABLE",
      localize('content.extent-core.extent_kind_string_is_not', 'extent kind \'{String}\' is not one of: {keys}', { String: String(String(e.kind).slice(0, 40)), keys: String(Object.keys(CONTENT_EXTENT_KINDS).join(', ')) }));
  if (!row.landed)
    return refusal("CONTENT_EXTENT_UNREADABLE",
      localize('content.extent-core.extent_kind_kind_human_is', 'extent kind \'{kind}\' ({human}) is named in the grammar and what it covers cannot yet be evaluated, so it mints nothing. The pdf-page and document arms landed with REC-82 and the other three follow with REC-85', { kind: String(e.kind), human: String(row.human) }));
  if (e.kind === 'pdf-page') {
    if (!Number.isInteger(e.page) || e.page < 0)
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.pdf_page_names_which_page', 'a pdf-page extent names which page, as a 0-based integer. This one names \'{page}\'', { page: String(String(e.page).slice(0, 40)) }));
    if (e.rect !== undefined && e.rect !== null
        && !(Array.isArray(e.rect) && e.rect.length === 4
             && e.rect.every((n) => typeof n === 'number' && Number.isFinite(n))))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.pdf_page_rect_unreadable', 'a pdf-page extent\'s rect is four finite numbers or absent. A rect that is present and unreadable is worse than none, because it looks like a region somebody chose'));
    /* THE PAGE SET. Checked only where the record HOLDS one — an absent page
       count is undetermined and stated on the row, never a refusal, because a
       gate that refused every page citation on a document whose page set this
       plane never recorded would pressure a member into citing the whole
       document instead, which claims MORE and not less. D-345 is the row that
       closes the gap by persisting I2's page count at acquire. */
    if (ctx.known !== false
        && Number.isInteger(ctx.pageCount) && ctx.pageCount > 0 && e.page >= ctx.pageCount)
      return refusal("CONTENT_EXTENT_OUT_OF_RANGE",
        localize('content.extent-core.this_captures_page_set_holds', 'this capture\'s page set holds {pageCount} page(s) (0-{v1}) and the extent names page {page}', { pageCount: String(ctx.pageCount), v1: String(ctx.pageCount - 1), page: String(e.page) }));
  }
  /* ==================================================================== *
     REC-85 / IC-83 — THE OTHER THREE ARMS, each in two halves that answer two
     different questions and must never be collapsed into one.

     THE SHAPE half asks whether this is an ADDRESS AT ALL, and any caller can
     answer it: a cell is A1 notation on a named sheet, a paragraph is a 0-based
     ordinal, a slide is a 1-BASED ordinal (the producers' own numbering — see
     CONTENT_EXTENT_KINDS' header; it is not uniform and pretending it were is
     the mistake available here). A shape this file cannot read COVERS NOTHING
     AND MINTS NOTHING — C-45.3, `extentCovers`' own default one construct along.

     THE CONTAINER half asks whether THIS DOCUMENT HOLDS that address, and only
     the record can answer it. It is checked EXACTLY WHERE THE RECORD HOLDS THE
     CONTAINER'S EXTENT and is skipped, never guessed, where it does not — which
     is the page-set arm's rule above, restated per arm because the reason is the
     same one and it is the reason that matters: a gate that refused every cell
     citation on a workbook whose sheets this plane never recorded would pressure
     a member into citing the WHOLE DOCUMENT instead, which claims MORE and not
     less. Undetermined, STATED, never a refusal for what nobody measured.

     AND THE RECORD NOW HOLDS THE OUTER BOUND OF ALL THREE, MEASURED RATHER
     THAN ASSUMED (CAP-12 / D-354, 2026-09-14). `op=acquire` carries what the
     six office entries itemise onto the reading it persists — the sheet LIST,
     the paragraph COUNT and the slide LIST — so an unknown SHEET NAME, a
     paragraph past the count and a slide past the deck are each refused here,
     BY NAME, on every office container this plane has read. **The sentences
     that stood here until CAP-12 said "WHAT THE RECORD HOLDS TODAY IS NOTHING
     … all three of these arms are LIVE AND UNFED"; they recorded the gap, and
     the gap closing is the news** — COFF-9's precedent for correcting a stale
     self-description in place rather than deleting it, and the same correction
     the legacy store's `#containerExtentForCapture` and `#pageSetForCapture`
     carried (now `./index.mjs`' `#containerExtentFor` and `#pageSetFor`).
     Nothing in THIS file moved for it: the feed arrived and these predicates
     began firing, which is exactly what D-354 predicted.

     AND THE INNER BOUND IS FED TOO, AS OF 2026-09-15 — CORRECTED IN PLACE BY
     COFF-12, NOT DELETED, BECAUSE THE GAP IT RECORDED WAS REAL AND ITS CLOSING
     IS THE NEWS (the same correction COFF-9 set the precedent for, and the one
     CAP-12 made to the paragraph above it). This paragraph read "No entry emits
     a sheet's `rows`/`cols` or a slide's shape COUNT — `walkSheetXml` and
     `walkSlide` compute both and return neither", which was TRUE when D-359 was
     filed and measured against all six returns. It closed in two acts on one
     day: COFF-11 landed the producers (IC-100, I2 2.2.0 — each sheet's `rows`/
     `cols` beside its `usedRows`/`usedCols`, each slide's `shapes`) and COFF-12
     landed the acquire wire that had been writing those figures as LITERAL
     NULLS. So `coversSheetCell` now answers about a CELL inside a sheet the
     workbook has and `coversSlideShape` about a SHAPE inside a slide the deck
     has, and **NOTHING IN THIS FILE MOVED FOR EITHER** — the predicates began
     firing when the feed arrived, exactly as D-354 and D-359 both predicted.

     THE BOUND IS THE CONTAINER'S CAPACITY AND NEVER THE CAPTURE'S USED RANGE,
     and that decision is why `coversSheetCell` below compares against `rows`
     and must never be pointed at `usedRows` (IC-100's RESOLUTION carries the
     reasoning; `test/m/content/converts-extent.test.mjs`' R7 test of the grid
     and the used range, converted from COFF-11's `usedrangeasbound` arm, breaks
     if anyone re-points it).
     A cell EXISTS in the grid whether or not it held a value, and in this
     product an empty cell is routinely the finding.

     WHAT IS STILL ABSENT IS A FIGURE RATHER THAN A MECHANISM, and it is named
     so this paragraph does not become the next stale reassurance. A `.ods`
     workbook carries a NULL grid bound because OpenDocument fixes no maximum
     table size — an honest statement, not a gap, and the cell arm is SKIPPED on
     it rather than guessed. A capture acquired before this landing holds no
     inner figure at all and is skipped the same way; no backfill was taken. In
     both cases `./index.mjs`' `#containerExtentFor` NAMES the missing level
     in the answer it returns rather than leaving a bare null, and skipping is
     deliberate: refusing a citation for a bound nobody measured would push a
     member toward citing the WHOLE DOCUMENT, which claims MORE and not less.
     Every level of these arms, held, skipped and stated, is driven at this
     module's interface by the R7 and R8 tests of
     `test/m/content/converts-extent.test.mjs` (converted from
     `capture-container-extent`).
     ==================================================================== */
  if (e.kind === 'sheet-cell') {
    if (typeof e.sheet !== 'string' || !e.sheet.trim())
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.sheet_cell_names_which_sheet', 'a sheet-cell extent names which sheet, as the workbook spells it. This one names \'{sheet}\'', { sheet: String(String(e.sheet).slice(0, 40)) }));
    if (typeof e.cell !== 'string' || !CONTENT_EXTENT_A1_RE.test(e.cell.trim()))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.sheet_cell_names_which_cell', 'a sheet-cell extent names which cell in A1 notation (B14, $B$14). This one names \'{cell}\'', { cell: String(String(e.cell).slice(0, 40)) }));
    const outside = coversSheetCell(e, ctx.container);
    if (outside) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", outside);
  }
  if (e.kind === 'doc-para') {
    if (!Number.isInteger(e.para) || e.para < 0)
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.doc_para_names_which_paragraph', 'a doc-para extent names which paragraph, as a 0-based integer. This one names \'{para}\'', { para: String(String(e.para).slice(0, 40)) }));
    if (e.run !== undefined && e.run !== null && !(Number.isInteger(e.run) && e.run >= 0))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.doc_para_run_unreadable', 'a doc-para extent\'s run is a 0-based integer or absent. A run that is present and unreadable is worse than none, because it looks like a span somebody chose'));
    const outside = coversDocPara(e, ctx.container);
    if (outside) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", outside);
  }
  if (e.kind === 'slide-shape') {
    /* 1-BASED, and it is the one place in this grammar where 0 is a refusal
       rather than the first item. IC-1 fixed it that way ("ref: slide 7, slide
       7") and `slideShapeRef` emits it that way, so admitting 0 here would let
       two spellings of slide 1 exist and would mint two rows for one shape. */
    if (!Number.isInteger(e.slide) || e.slide < 1)
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.a_slide_shape_extent_names', 'a slide-shape extent names which slide, as a 1-based integer (slide 1 is the first). This one names \'{String}\'', { String: String(String(e.slide).slice(0, 40)) }));
    if (e.shape !== undefined && e.shape !== null && !(Number.isInteger(e.shape) && e.shape >= 0))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.slide_shape_unreadable', 'a slide-shape extent\'s shape is a 0-based integer or absent. A shape that is present and unreadable is worse than none, because it looks like an element somebody chose'));
    const outside = coversSlideShape(e, ctx.container);
    if (outside) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", outside);
  }
  /* ==================================================================== *
     FW-19 / IC-125 — EXTRACTION-BREADTH §3.2's TWO ARMS AND ONE REFERENCE,
     each in REC-85's two halves (a SHAPE any caller can judge, a CONTAINER
     half only the record can) and each refused BY NAME under the codes this
     family already has: an unreadable address is C-45.3, an address outside
     the container is C-45.1. No fifth code — the facts are the same facts
     about three more addresses, which is the argument C-45.1's own row makes.

     `cited_as` IS JUDGED FIRST, because it decides whether the chain arm
     below applies at all. Two values, and `bytes` only on an `image`.
     ==================================================================== */
  const citedAs = contentCitedAs(e);
  if (citedAs !== 'text' && citedAs !== 'bytes')
    return refusal("CONTENT_EXTENT_UNREADABLE",
      localize('content.extent-core.cited_as_says_whether_a', 'cited_as says whether a part is cited for its TEXT or as its own BYTES, and is one of text, bytes. This one says \'{String}\'', { String: String(String(citedAs).slice(0, 40)) }));
  if (citedAs === 'bytes' && e.kind !== 'image')
    return refusal("CONTENT_EXTENT_UNREADABLE",
      localize('content.extent-core.only_an_image_can_be', 'only an image can be cited as its bytes. A {kind} extent addresses text, and reading \'bytes\' here as \'text\' would silently change what the citation claims, so it is refused', { kind: String(e.kind) }));
  if (e.kind === 'doc-part') return checkPart(e, ctx);
  if (e.kind === 'sheet-range') {
    if (typeof e.sheet !== 'string' || !e.sheet.trim())
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.sheet_range_names_which_sheet', 'a sheet-range extent names which sheet, as the workbook spells it. This one names \'{sheet}\'', { sheet: String(String(e.sheet).slice(0, 40)) }));
    if (typeof e.range !== 'string' || !rangeCorners(e.range))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.sheet_range_names_which_cells', 'a sheet-range extent names which cells in A1:A1 notation (A1:C10, $A$1:$C$10). This one names \'{range}\'', { range: String(String(e.range).slice(0, 40)) }));
    const outside = coversSheetRange(e, ctx.container);
    if (outside) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", outside);
  }
  if (e.kind === 'doc-table') {
    if (!Number.isInteger(e.table) || e.table < 0)
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.doc_table_names_which_table', 'a doc-table extent names which table, as a 0-based ordinal in document order. This one names \'{table}\'', { table: String(String(e.table).slice(0, 40)) }));
    if (e.cell !== undefined && e.cell !== null
        && !(typeof e.cell === 'string' && CONTENT_EXTENT_A1_RE.test(e.cell.trim())))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.doc_table_cell_unreadable', 'a doc-table extent\'s cell is A1 notation over the table\'s grid (B3) or absent. A cell that is present and unreadable is worse than none, because it looks like one somebody chose'));
    const outside = coversDocTable(e, ctx.container);
    if (outside) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", outside);
  }
  if (e.kind === 'image') {
    /* EXACTLY ONE ADDRESS FORM: the part's content hash for a container, or
       the page (and optionally the rectangle) for a PDF. Both at once is one
       image stated twice where the two can disagree — the `content_id` plus
       extent rule one construct down — and neither is no address at all. */
    const hasPart = e.part !== undefined && e.part !== null && e.part !== '';
    const hasPage = e.page !== undefined && e.page !== null && e.page !== '';
    if (hasPart === hasPage)
      return refusal("CONTENT_EXTENT_UNREADABLE",
        hasPart
          ? localize('content.extent-core.image_names_both_part_and_page', 'an image extent names EITHER the embedded part\'s content hash OR a page and rectangle, and this one names both — one image stated twice, where the two can disagree')
          : localize('content.extent-core.image_names_neither_part_nor_page', 'an image extent names the embedded part\'s content hash (in a container) or the page it is on (in a PDF), and this one names neither'));
    if (hasPart && !(typeof e.part === 'string' && /^[0-9a-fA-F]{64}$/.test(e.part.trim())))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.an_images_part_is_the', 'an image\'s part is the SHA-256 of the embedded media member, 64 hexadecimal characters. This one names \'{String}\'', { String: String(String(e.part).slice(0, 40)) }));
    if (hasPage) {
      if (!Number.isInteger(e.page) || e.page < 0)
        return refusal("CONTENT_EXTENT_UNREADABLE",
          localize('content.extent-core.an_image_extents_page_is', 'an image extent\'s page is a 0-based integer. This one names \'{String}\'', { String: String(String(e.page).slice(0, 40)) }));
      if (e.rect !== undefined && e.rect !== null
          && !(Array.isArray(e.rect) && e.rect.length === 4
               && e.rect.every((n) => typeof n === 'number' && Number.isFinite(n))))
        return refusal("CONTENT_EXTENT_UNREADABLE",
          localize('content.extent-core.image_rect_unreadable', 'an image extent\'s rect is four finite numbers or absent. A rect that is present and unreadable is worse than none, because it looks like a region somebody chose'));
      if (ctx.known !== false
          && Number.isInteger(ctx.pageCount) && ctx.pageCount > 0 && e.page >= ctx.pageCount)
        return refusal("CONTENT_EXTENT_OUT_OF_RANGE",
          localize('content.extent-core.this_captures_page_set_holds_2', 'this capture\'s page set holds {pageCount} page(s) (0-{v1}) and the image extent names page {page}', { pageCount: String(ctx.pageCount), v1: String(ctx.pageCount - 1), page: String(e.page) }));
      /* D-420: the page set says the page EXISTS; the record's placement list
         says whether an image is PAINTED there. No list held (a PDF acquired
         before D-420, a walk that did not finish, a capture that is not a PDF)
         answers null and the row is admitted with the absence stated. */
      const unpainted = ctx.known !== false ? coversImagePlacement(e, ctx.container) : null;
      if (unpainted) return refusal("CONTENT_EXTENT_NO_IMAGE_PAINTED", unpainted);
    }
    /* D-440 — A `{part}` IS A MEMBER OF A CONTAINER'S OWN BYTES, AND NOTHING
       ELSE. Asked BEFORE the image list, because on a capture that is not a
       container there is no list to be outside of — and until this arm, "no
       list" was read as "no bound" and ANY 64-hex part minted on every web
       page, PDF and text capture, naming bytes the document does not hold.
       Refused only on the store's DETERMINATE `office: false`; an undetermined
       kind (`null`) and the leg grammar's document-only pass (`known: false`) are
       skipped, never guessed — the arm's rule above, and the admission is
       STATED by the store through `imagePartUndetermined` below. */
    const notContainer = hasPart && ctx.known !== false ? partOutsideAnyContainer(ctx.container) : null;
    if (notContainer) return refusal("CONTENT_EXTENT_NOT_A_CONTAINER", notContainer);
    const outside = hasPart ? coversImage(e, ctx.container) : null;
    if (outside) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", outside);
    /* TEXT READ OFF AN EMBEDDED IMAGE HAS NO CHAIN IN THIS RECORD, and the
       arm below would not notice: it asks whether the CAPTURE has a chain, and
       an office container always does — for its text parts, never for its
       media. Admitting `cited_as: text` on a `{part}` image would therefore
       mint a row claiming a transcription nobody made. The page form is
       different: a PDF page's chain (layer or OCR) covers what is on the page. */
    if (hasPart && citedAs === 'text')
      return refusal("CONTENT_EXTENT_NO_CHAIN",
        localize('content.extent-core.embedded_image_text_has_no', 'this citation asks for the TEXT of an embedded image, and nothing in this record has read text off an embedded image — the container\'s transcription covers its text parts and never its media. Cite the image as itself (cited_as: bytes), or cite the passage that quotes it'));
  }
  /* R62 (K5157): THE FORMAT HOLDS THE KIND. Asked where the record holds the capture's format and skipped where it does not
     (R8); after every shape and container arm above, so an unreadable address stays unreadable and a figure the context
     holds still names itself, and before the chain arm, which is a fact about the capture and not the extent. */
  const misfit = ctx.known !== false ? kindFormatMisfit(e, ctx.container) : null;
  if (misfit) return refusal("CONTENT_EXTENT_OUT_OF_RANGE", misfit);
  /* THE CHAIN, LAST, AND IT IS A FACT ABOUT THE CAPTURE RATHER THAN THE EXTENT.
     A content row is an address into TEXT somebody or something produced, and a
     capture nobody has read holds no text to address. A DOCUMENT extent is
     exempt and that exemption is load-bearing rather than a softening: a whole
     document is a referent that exists the moment the bytes do — it IS the
     document, and DEC-23 says a document is content too — so refusing it would
     make the one universally-legal citation illegal on every unread capture and
     would break every legacy leg's backfill. The over-strictness arm of
     `test/m/content/converts-extent.test.mjs` (R12, R27, R28: a whole-document
     citation of an unread capture) is exactly this case. */
  /* REC-84: AND IT IS SKIPPED, NEVER GUESSED, FOR A CALLER THAT CANNOT SEE THE
     RECORD. `CONTENT_EXTENT_DOCUMENT_ONLY` is that caller (the leg grammar,
     over one `bundle.md`: the catalogue's until T19, `inquiry-grammar`'s since);
     the record passes a capture's real context (`contentContextFor`) and this
     arm is exactly what REC-82 landed. The same gate sits on the page-set arm
     above, and both are the C-25.10 / C-25.16 split: a shape one document
     answers, and a fact only the record holds. */
  /* FW-19 / IC-125: AND A `bytes` ROW IS EXEMPT, for the `document` exemption's
     own reason one construct along — an image cited as itself is a referent
     that exists the moment the bytes do, and its fidelity is the capture's
     (§3.1, §3.4). It carries NO chain and that null is `cited_as` speaking, not
     an undetermined transcription. The same row as `text` with no chain is
     still refused here: the two nulls are different facts (§8's control). */
  if (ctx.known !== false && citedAs !== 'bytes'
      && e.kind !== 'document' && !(Array.isArray(ctx.chain) && ctx.chain.length))
    return refusal("CONTENT_EXTENT_NO_CHAIN",
      localize('content.extent-core.this_record_holds_no_extraction', 'this record holds no extraction chain for the capture this leg cites, so there is no transcription over {describeExtent} for the citation to point at', { describeExtent: String(describeExtent(e)) }));
  /* END DEC-49 REGION is-content-extent */
  return null;
}

/* R1 (K4910; G167) — A `doc-part`'S SHAPE: the package part and the element reference a reader names for a non-body unit
   (`reading-pipeline` R47), each a non-empty string or absent, one at least present. The record lists no parts of a capture
   to bound one against (they arrive as text units), so a well-formed one is admitted and its existence rests on the index
   that found it (R8: `part_list`, in `./extent.mjs`); a capture nobody read holds no text to address (C-45.2), as for an
   envelope item. Judged here, in the core, so the leg grammar and the face answer one thing. */
/** A `doc-part`'s human form: its element reference, else its package part (R1, R2). `./extent.mjs`' `describeExtent` reads it. */
export function describePart(e) {
  const at = typeof e.ref === 'string' && e.ref.trim() ? e.ref.trim() : typeof e.part === 'string' && e.part.trim() ? e.part.trim() : '';
  return localize('content.extent-core.part_ref', 'part {at}', { at: String(at.slice(0, 120)) });
}

function checkPart(e, ctx) {
  const said = (v) => String(v).slice(0, 40);
  for (const k of ['part', 'ref'])
    if (e[k] !== undefined && e[k] !== null && !(typeof e[k] === 'string' && e[k].trim()))
      return refusal("CONTENT_EXTENT_UNREADABLE",
        localize('content.extent-core.a_part_extent_names_the', 'a part extent names the package part and the element reference of the unit as the reader emitted them, each a non-empty string. This one names \'{String}\' as its {k}', { String: said(e[k]), k }));
  if (!(typeof e.part === 'string' && e.part.trim()) && !(typeof e.ref === 'string' && e.ref.trim()))
    return refusal("CONTENT_EXTENT_UNREADABLE",
      localize('content.extent-core.a_part_extent_names_neither', 'a part extent names the package part or the element reference of the unit as the reader emitted them, and this one names neither'));
  if (ctx.known !== false && !(Array.isArray(ctx.chain) && ctx.chain.length))
    return refusal("CONTENT_EXTENT_NO_CHAIN",
      localize('content.extent-core.this_record_holds_no_extraction_2', 'this record holds no extraction chain for the capture this citation names, so there is no transcription over {describeExtent} for the citation to point at', { describeExtent: describePart(e) }));
  return null;
}

/* ==========================================================================
 * REC-85 — THE THREE CONTAINER-EXTENT PREDICATES.
 * ==========================================================================
 *
 * One per arm, each the mirror of the page-set comparison inside
 * `checkContentExtent` and each obeying its two rules: the figure comes from the
 * RECORD and is never invented here, and an ABSENT figure is UNDETERMINED AND
 * SKIPPED rather than refused. They are separate functions rather than three
 * branches because each reads a different shape and each names a different
 * sentence, and the store's resolver answers each of them independently — a
 * capture may legitimately hold a sheet list and no dimensions.
 *
 * WHAT THE SHAPE IS, so the CAPTURE-side item that fills it has one target:
 *
 *   container = { sheets:     [{ name, rows, cols }] | null,
 *                 paragraphs: <count> | null,
 *                 slides:     [{ shapes: <count> }]  | null }
 *
 * EVERY LEVEL IS INDEPENDENTLY NULLABLE and every one of them means the same
 * thing: the record does not hold it. A sheet list with no `rows`/`cols` refuses
 * an unknown SHEET and says nothing about the cell, which is exactly right — the
 * record can know a workbook's sheets without having walked their extents, and
 * answering the second question from the first would be inventing a bound.
 *
 * THEY RETURN A SENTENCE OR NULL — NEVER A REFUSAL — AND THAT IS DEC-49'S RULE
 * RATHER THAN A STYLE. The code is a STRING LITERAL at its site inside the
 * governed region a row's `where` names, because a code minted where its row is
 * not read is how one shipped `translation: undefined` to a member. Minting
 * C-45.1 in here would have put three of its four sites OUTSIDE
 * `is-content-extent` while the row's `where` went on naming that region alone
 * (the MULTI-SITE-CODE condition: the DEC-49 guard, retired in T20, documented it and
 * could not close). So these functions answer
 * WHAT IS WRONG and `checkContentExtent` answers WHICH CODE THAT IS, which keeps
 * all four C-45.1 sites inside the one span the row claims. That every C-45.1
 * this module answers carries its row's check and translation is
 * `test/m/content/seams.test.mjs`' (R48).
 */

/** R62 — THE EXTENT KINDS EACH FORMAT HOLDS. Only the six kinds that address a place in one family of document are judged
 *  (a page of a PDF, a sheet's cell or range, a paragraph, a table of a text document, a slide's shape): the kinds that
 *  also address a part (`image`, `doc-part`, `envelope`) and the whole document are held by more than one family and are
 *  not judged here. A format outside this table is not judged either: the record is not refused for what it did not
 *  measure. */
const FORMAT_HOLDS = Object.freeze({
  pdf: ["pdf-page"],
  docx: ["doc-para", "doc-table"], odt: ["doc-para", "doc-table"],
  xlsx: ["sheet-cell", "sheet-range"], ods: ["sheet-cell", "sheet-range"], csv: ["sheet-cell", "sheet-range"],
  pptx: ["slide-shape"], odp: ["slide-shape"],
  text: ["doc-para"],
});
const PLACE_KINDS = new Set(Object.values(FORMAT_HOLDS).flat());

/** An extent of a place kind over a capture whose held format cannot hold that kind: the sentence naming the kind and the
 *  format, or null (the format not held, not in the table, or the kind held by it). */
function kindFormatMisfit(e, container) {
  const format = container && typeof container.format === 'string' ? container.format.trim().toLowerCase() : '';
  if (!format || !Object.prototype.hasOwnProperty.call(FORMAT_HOLDS, format)) return null;
  if (!PLACE_KINDS.has(e.kind) || FORMAT_HOLDS[format].includes(e.kind)) return null;
  return localize('content.extent-core.format_cannot_hold_kind', 'a {kind} extent cannot be held by a {format} document, which holds {holds}', { kind: String(e.kind), format: String(format), holds: String(FORMAT_HOLDS[format].join(', ')) });
}

/** A cell of a named sheet, against the workbook as the record holds it.
 *  Returns the sentence naming what is outside, or null. */
function coversSheetCell(e, container) {
  const sheets = container && Array.isArray(container.sheets) ? container.sheets : null;
  if (!sheets || !sheets.length) return null;
  const want = String(e.sheet).trim();
  const sheet = sheets.find((x) => x && typeof x.name === 'string' && x.name === want);
  if (!sheet)
    return word('content.text.capture_workbook_holds', { count: String(sheets.length), sheets: String(sheets.map((x) => (x && typeof x.name === 'string' ? x.name : '?')).slice(0, 12).join(', ')), more: String(sheets.length > 12 ? ', …' : ''), want: String(want.slice(0, 40)) });
  const at = a1ToRowCol(e.cell);
  if (!at) return null;
  if (Number.isInteger(sheet.rows) && sheet.rows > 0 && at.row > sheet.rows)
    return word('content.text.sheet_capture_holds', { want: String(want.slice(0, 40)), rows: String(sheet.rows), row: String(at.row) });
  if (Number.isInteger(sheet.cols) && sheet.cols > 0 && at.col > sheet.cols)
    return word('content.text.sheet_capture_holds_column', { want: String(want.slice(0, 40)), cols: String(sheet.cols), col: String(at.col) });
  return null;
}

/** A paragraph, against the paragraph count as the record holds it.
 *  Returns the sentence naming what is outside, or null. */
function coversDocPara(e, container) {
  const n = container ? container.paragraphs : null;
  if (!(Number.isInteger(n) && n > 0)) return null;
  if (e.para >= n)
    return word('content.text.capture_text_holds', { n: String(n), n2: String(n - 1), para: String(e.para) });
  return null;
}

/** A shape on a slide, against the deck as the record holds it.
 *  Returns the sentence naming what is outside, or null. */
function coversSlideShape(e, container) {
  const slides = container && Array.isArray(container.slides) ? container.slides : null;
  if (!slides || !slides.length) return null;
  if (e.slide > slides.length)
    return word('content.text.capture_deck_holds', { slides: String(slides.length), slide: String(e.slide) });
  const slide = slides[e.slide - 1];
  const n = slide ? slide.shapes : null;
  if (Number.isInteger(e.shape) && Number.isInteger(n) && n > 0 && e.shape >= n)
    return word('content.text.slide_capture_holds', { slide: String(e.slide), n: String(n), n3: String(n - 1), shape: String(e.shape) });
  return null;
}

/* FW-19 / IC-125 — THE THREE NEW CONTAINER PREDICATES, on the three above's
 * two rules exactly: the figure comes from the RECORD, and an absent figure is
 * SKIPPED rather than refused. The container shape grows two levels:
 *
 *   container = { ..., tables: [{ rows, cols }] | null,   // doc-table
 *                      images: [{ part, mime }] | null }  // image {part}
 *
 * and ONE DIFFERENCE from the three above, stated because it is easy to "fix"
 * the wrong way: for these two an EMPTY list is a MEASURED ZERO (the producer
 * emits NULL whenever it did not walk), so it bounds — table 1 of a document
 * with no tables is refused. */

/** A range of a named sheet, against the workbook as the record holds it:
 *  an unknown sheet is refused, and so is a range whose far corner is past
 *  the sheet's GRID (the `sheet-cell` bound, and the same decision: the grid,
 *  never the used range — an empty cell exists). Returns a sentence or null. */
function coversSheetRange(e, container) {
  /* Spelled `held` rather than `sheets` for its first two lines: at FW-19 a
     byte-identical copy of `coversSheetCell`'s two lines here made the REC-85
     control's anchor on them match twice, and that control stopped arming
     (measured, `ARMED NO`). That control is gone; the spelling stays because
     this is the catalogue's text line for line (R48). */
  const held = container && Array.isArray(container.sheets) ? container.sheets : null;
  if (!held || !held.length) return null;
  const sheets = held;
  const want = String(e.sheet).trim();
  const sheet = sheets.find((x) => x && typeof x.name === 'string' && x.name === want);
  if (!sheet)
    return word('content.text.capture_workbook_holds', { count: String(sheets.length), sheets: String(sheets.map((x) => (x && typeof x.name === 'string' ? x.name : '?')).slice(0, 12).join(', ')), more: String(sheets.length > 12 ? ', …' : ''), want: String(want.slice(0, 40)) });
  const k = rangeCorners(e.range);
  if (!k) return null;
  if (Number.isInteger(sheet.rows) && sheet.rows > 0 && k.r1 > sheet.rows)
    return word('content.text.sheet_capture_holds_row', { want: String(want.slice(0, 40)), rows: String(sheet.rows), r1: String(k.r1) });
  if (Number.isInteger(sheet.cols) && sheet.cols > 0 && k.c1 > sheet.cols)
    return word('content.text.sheet_capture_holds_column_range', { want: String(want.slice(0, 40)), cols: String(sheet.cols), c1: String(k.c1) });
  return null;
}

/** A table (and optionally one cell of it), against the document's table
 *  list as the record holds it. Returns a sentence or null. */
function coversDocTable(e, container) {
  const tables = container && Array.isArray(container.tables) ? container.tables : null;
  if (!tables) return null;
  if (e.table >= tables.length)
    return word('content.text.capture_document_holds', { count: String(tables.length), range: String(tables.length ? ` (0-${tables.length - 1})` : ''), table: String(e.table) });
  if (typeof e.cell !== 'string' || !e.cell.trim()) return null;
  const t = tables[e.table] || {};
  const at = a1ToRowCol(e.cell);
  if (!at) return null;
  if (Number.isInteger(t.rows) && t.rows > 0 && at.row > t.rows)
    return word('content.text.table_capture_holds', { table: String(e.table), rows: String(t.rows), row: String(at.row) });
  if (Number.isInteger(t.cols) && t.cols > 0 && at.col > t.cols)
    return word('content.text.table_capture_holds_column', { table: String(e.table), cols: String(t.cols), col: String(at.col) });
  return null;
}

/** An embedded image, by content hash, against the container's image list
 *  as the record holds it. Returns a sentence or null. */
function coversImage(e, container) {
  const images = container && Array.isArray(container.images) ? container.images : null;
  if (!images) return null;
  const want = String(e.part).trim().toLowerCase();
  if (images.some((x) => x && typeof x.part === 'string' && x.part.toLowerCase() === want)) return null;
  return word('content.text.capture_container_holds', { images: String(images.length), want: String(want.slice(0, 16)) });
}

/** D-440 — an embedded image's `{part}`, against WHETHER THIS CAPTURE IS A
 *  CONTAINER AT ALL, as the store resolved it (`container.office`, three-valued:
 *  true, false, or null for undetermined). Returns the sentence naming why the
 *  part cannot be in this document, or null. ONLY a determinate `false` answers:
 *  an undetermined kind is SKIPPED, the three predicates' rule above, and stated
 *  by `imagePartUndetermined`. A sentence rather than a refusal for the reason
 *  those predicates give: the code stays a literal inside `is-content-extent`. */
function partOutsideAnyContainer(container) {
  if (!container || container.office !== false) return null;
  const fmt = typeof container.format === 'string' && container.format ? container.format : null;
  return localize('content.extent-core.capture_is_not_an_office', 'this capture is {kind}, not an office container, so its own bytes hold no embedded media part and a part reference names bytes this document does not contain. An image served beside a page is its OWN document: acquire it at its own address and cite that document whole{pdf}', { kind: fmt ? `a ${fmt.slice(0, 20)} document` : 'a document', pdf: fmt === 'pdf' ? word('content.text.image_painted_pdf') : '' });
}

/** D-440 — WHAT AN ADMITTED `{part}` COULD NOT BE CHECKED AGAINST, stated, or
 *  null when it was checked in full. The row's rule: an office capture with no
 *  persisted image list keeps its UNDETERMINED admission, STATED — and so does a
 *  capture whose kind the record does not hold. `./index.mjs`' `mint` carries
 *  this onto its answer (through `mintUndetermined`), because a row admitted without its bound and returned bare reads
 *  exactly like one that was verified. Pure; reads the same `ctx` the checker
 *  judged, so the statement cannot describe a different context. */
export function imagePartUndetermined(extent, ctx = {}) {
  const e = extent && typeof extent === 'object' ? extent : null;
  if (!e || e.kind !== 'image' || e.part === undefined || e.part === null || e.part === '') return null;
  if (!ctx || ctx.known === false) return null;
  const c = ctx.container && typeof ctx.container === 'object' ? ctx.container : null;
  if (!c || c.office == null)
    return { level: 'container_kind',
             why: localize('content.extent-core.kind_unheld_part_undetermined', '{kind_why} — so whether this part is a member of the document\'s own bytes is UNDETERMINED, admitted and stated rather than guessed either way', { kind_why: c && typeof c.kind_why === 'string' ? c.kind_why : localize('content.extent-core.kind_not_held', 'this record does not hold which kind of document this capture is') }) };
  if (c.office === true && !Array.isArray(c.images))
    return { level: 'image_list',
             why: localize('content.extent-core.office_container_no_image_list', 'this capture is an office container and this record holds no list of its embedded images (it was acquired before the wire carried one, or no entry itemised it), so whether the part is among them is UNDETERMINED, admitted and stated rather than guessed') };
  return null;
}

/* D-420 — THE PAGE FORM'S BOUND: the images a PDF's pages PAINT, as the record
 * holds them (`container.images` of a `container_name: 'pdf'` extent, each
 * `{page, rect}`, written at acquire from the structure op). Returns a sentence
 * or null, on the three predicates' rules above: the figure comes from the
 * RECORD, and an absent figure is SKIPPED rather than refused. An EMPTY list is
 * a MEASURED ZERO (IC-124's rule) and bounds.
 *
 * "EQUALS" IS THE CROP'S EQUALITY AND NOTHING LOOSER. `pdfPageImages` writes a
 * rectangle at 1/1000 pt, and `pdf-worker/src/imagecrop.mjs` matches within
 * exactly that step (RECT_TOL); a wider tolerance here would admit a rectangle
 * the crop then refuses — the defect this predicate closes, back again. The
 * corners are normalised first (`canonicalExtent`'s own order), because a
 * rectangle written upper-right first is the same rectangle.
 *
 * A PAGE WITH NO RECT (`{page}` alone) names "an image on page N" and is
 * refused only when the page paints NONE; which one of several it means is the
 * crop's question (RECT_REQUIRED), not the address's. */
function coversImagePlacement(e, container) {
  if (!container || container.container_name !== 'pdf' || !Array.isArray(container.images)) return null;
  const all = container.images;
  const onPage = all.filter((x) => x && x.page === e.page && Array.isArray(x.rect) && x.rect.length === 4);
  if (!(Array.isArray(e.rect) && e.rect.length === 4)) {
    if (onPage.length) return null;
    return word('content.text.page_capture_paints', { page: String(e.page), all: String(all.length) });
  }
  const norm = (r) => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];
  const want = norm(e.rect);
  const same = (r) => norm(r).every((v, i) => Math.abs(v - want[i]) <= 0.001 + 1e-9);
  if (onPage.some((x) => same(x.rect))) return null;
  const listed = onPage.slice(0, 6).map((x) => `[${norm(x.rect).join(', ')}]`).join(' ');
  return word('content.text.page_capture_paints_image', { page: String(e.page), count: String(onPage.length), listed: String(onPage.length ? ` (${listed}${onPage.length > 6 ? ' …' : ''})` : ''), rect: String(want.join(', ')) });
}
