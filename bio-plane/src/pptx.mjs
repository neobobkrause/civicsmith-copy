/* The PPTX registry entry (I7, QUEUE COFF-5) — the presentation format on the
 * FORMAT axis, built on ooxml.mjs's container primitives, shaped exactly as
 * docx.mjs (COFF-4, the accepted first-lander) shaped the office entries.
 *
 * WHAT IT EMITS (I2 1.1.0, links + the shared IC-2 evidentiary envelope):
 *
 *   structure(parts) ->
 *     { ok:true, container:"pptx", slides:<int>,
 *       links:[ LinkRecord... ],           // the SAME partitions HTML/PDF/DOCX
 *       counts:{anchor,intra,deferred,refused,undetermined},   // use, wrapped
 *       evidentiary:{ ... },               // IC-2 CONFIRMED — no variant
 *       notes:[...] }                      // remarks (NOT speaker notes)
 *
 *   - ppt/slides/_rels/slideN.xml.rels `TargetMode="External"` ->
 *     deferred/refused, wrapped by importing subresources.mjs's ONE
 *     `linkWrapper` — the parity property formats-docx.test.mjs pins for DOCX
 *     is pinned here for PPTX the same way.
 *   - an `<a:hlinkClick>` whose relationship targets ANOTHER SLIDE (internal,
 *     type …/slide) -> `anchor`, the way a DOCX bookmark link and a PDF GoTo
 *     are; a jump naming a slide the deck does not contain is a STATED
 *     undetermined, never an invented target.
 *   - ppt/embeddings/* -> `intra`, content-addressed by sha256 exactly as
 *     PDF and DOCX embedded files are.
 *   - An unreadable .rels part or embedding is CARRIED as an undetermined
 *     LinkRecord naming the part and why.
 *
 *   ELEMENT REFERENCES are `{kind:"slide-shape", ref:"slide <1-based>",
 *   slide:<1-based>[, shape:<0-based>]}` per IC-1 as RESOLVED. `slide` is
 *   1-based and equals the number in `ref` (the IC-1 example's own reading:
 *   ref "slide 7", slide 7). SLIDE NUMBERS COME FROM THE DECK ORDER THE BYTES
 *   DECLARE — ppt/presentation.xml's `<p:sldIdLst>` resolved through the
 *   presentation's .rels — never from slideN.xml filenames, which record
 *   creation order and survive reordering. When that declaration cannot be
 *   read, slides are honestly UNNUMBERED (slide:null in text units, source
 *   null on references) with the unreadable part stated — never numbered off
 *   the filename convention. `shape` is the 0-based index into the slide's
 *   shape-element sequence (<p:sp>/<p:pic>/<p:graphicFrame>/<p:cxnSp>/
 *   <p:grpSp> opens, in document order, nested included — one sequence per
 *   slide, so a shape index means the same thing to every reference into that
 *   slide) and appears only when the reference genuinely targets a shape;
 *   when only the slide is honest (a rel carried without body usage — the
 *   .rels part name itself ties it to the slide), the reference stops there.
 *
 *   text(parts) -> { ok:true, container:"pptx", document,
 *     slides:[ {slide, ref:"slide <n>", part, hidden, shapes, text} ],   // per-unit
 *     deckLength:<int | null>,   // COFF-13: the slides the DECK declares,
 *                                // readable or not; null = order unreadable
 *     speakerNotes:[ {slide, ref:"slide <n> (notes)", part, hidden, text} ],
 *     undetermined:[ Marker... ], counts:{chars, notesChars, undetermined} }
 *   — `<a:t>` runs per slide, `<a:p>` paragraphs newline-joined. A PPTX has
 *   no pages, so the per-unit list is `slides`, the IC-2 pageless degenerate
 *   form CONFIRMED with the unit named for what it IS.
 *
 *   THE EVIDENTIARY CORE (DEC-5): notesSlide SPEAKER NOTES — routinely more
 *   candid than the slide — are emitted PER SLIDE and DISTINGUISHABLE from
 *   slide text EVERYWHERE shown, cited or indexed, never merged:
 *     - a distinct envelope kind: { kind:"speaker-notes", slide, part, text,
 *       source:<slide-shape ref | null> }
 *     - a distinct text unit list: `speakerNotes`, whose refs read
 *       "slide N (notes)" — never appended to `slides[].text` and NEVER in
 *       `document`, which is the deck as presented; counts split chars /
 *       notesChars so an indexer cannot conflate them by accident.
 *     { kind:"core-properties", creator, lastModifiedBy, revision, ... }
 *
 *   HIDDEN SLIDES (DEC-5, COFF-7 — the pptx analogue of xlsx hidden sheets):
 *   a slide whose bytes declare `show="0"` is invisible in EVERY presented
 *   form of the deck. The attribute is read from BOTH places it can live:
 *   the slide part's own `<p:sld>` root (ECMA-376's home for CT_Slide@show —
 *   where PowerPoint's "Hide Slide" writes it) and the slide's `<p:sldId>`
 *   entry in the sldIdLst, honored when the bytes carry it there. The hidden
 *   slide is STILL FULLY EXTRACTED — text, notes, links — and FLAGGED
 *   everywhere shown, cited or indexed:
 *     { kind:"hidden-slide", slide:<1-based | null when the deck order is
 *       unreadable>, part, source:<slide-shape ref | null> }   // the
 *       envelope item naming the slide
 *   and every text() unit (slides[] and speakerNotes[]) carries `hidden` —
 *   the xlsx sheets[] precedent. Absence of the attribute means shown;
 *   nothing is guessed.
 *
 *   under the ONE accepted envelope (IC-2, CONFIRMED from this code):
 *     { container, kinds:[...], items:[...], undetermined:[{part,why}...],
 *       counts:{<kind>:n} }
 *   docProps metadata rides the envelope exactly as docx.mjs carries it.
 *   Absent attributes are null, never invented; an unreadable notesSlide is a
 *   STATED `{part, why}` in the envelope's own `undetermined`.
 *
 * DETECTION — the ladder both prior entries follow (COFF-1's note):
 *   - bytes: ZIP magic + a READABLE central directory + BOTH
 *     `[Content_Types].xml` and `ppt/presentation.xml` present -> "likely".
 *     Not "certain": the OPC content-type declaration is deflated and out of
 *     reach of the sync detect; `parts()` runs the full async `discriminate()`
 *     and tells the truth.
 *   - a bare `PK\x03\x04` sniff (the acquire-time 1 KiB seam: no EOCD, no
 *     central directory) answers NULL — a renamed plain ZIP is not a .pptx.
 *   - content type alone: the exact .pptx MIME type -> "likely".
 *
 * SIZE GUARD: the DECLARED UNCOMPRESSED bytes of the text parts we would
 * inflate (ppt/slides/*.xml + ppt/notesSlides/*.xml, summed from the central
 * directory — the COFF-6 metric) are what this entry may hold in memory at
 * once, up to ooxml.mjs's bound. Over it, up to its STREAMED_TEXT_BOUND_BYTES,
 * the deck is READ ONE PART AT A TIME (R35, F7): each slide and notes part is
 * inflated, walked and let go when text() or structure() asks for it, so no
 * deck is held, and the answer says it was read so (`piecewise`). A part
 * that is itself over the bound is not read, and is stated with its size and
 * `final: true`. Over the streamed ceiling full text extraction is refused as
 * a STATED text-undetermined carrying the guard's marker. Container walk,
 * rels, presentation.xml (structural, tiny) and core-properties still run;
 * nothing is silently truncated. Every part read passes ooxml.mjs's part cap
 * (R12, F18).
 *
 * ACTIVE CONTENT (R32): `active` on structure() and text(), from docx.mjs's
 * one `activeContent` builder; .pptm/.potm/.ppsm/.ppam read as this entry
 * with `variant` set (R33).
 *
 * This module ASSERTS nothing about meaning (FRAMEWORK's, through I2) and
 * WRITES nothing. Never invent structure: everything unreadable is stated.
 */

import { linkWrapper } from "./subresources.mjs";
import {
  hasZipMagic, readContainer, normalizePartName,
  discriminate, walkRels, relsPartFor, textPlan, MEASURED_OOXML_TEXT_BOUND_BYTES,
  CORE_PROPERTIES_PART, readCoreProperties, withContainerImages,
} from "./ooxml.mjs";
import { mceSkipper, withMetadata, activeContent, withActive, detectByContentType } from "./docx.mjs";
import { boundOf } from "./read-bounds.mjs";
import {
  Scanner, scanWhole, scanSync, parseAttrs, unescape, readText, scanNotes, collectElements, TAG_MAX, memberIdentities, addressParts, countObjects, precountFloor, owned,
} from "./office-xml.mjs";

/* R44: what the walk may retain, paragraphs, cells and links together (the table's figure, never a literal here). */
const OFFICE_RETAINED_MAX = boundOf("office", "retained_objects");
/* R44: the decoded characters a walk may hold at once (the table's row). */
const OFFICE_DECODED_CHARS_MAX = boundOf("office", "decoded_chars");
const stripOk = ({ ok, ...rest }) => rest;

/* Bytes as a Uint8Array, an ArrayBuffer, any typed-array view or an array of
 * byte values; anything else reads as no bytes, so a wrong argument is a
 * named refusal downstream, never a throw (R21; ooxml.mjs's own policy). */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  try { return new Uint8Array(x ?? 0); } catch { return new Uint8Array(0); }
}
const isBytes = (x) => x instanceof ArrayBuffer || ArrayBuffer.isView(x);


export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
/* R33 (K1903): the macro-enabled flavours' package types, read as pptx. */
const PPTX_TWIN_CONTENT_TYPES = new Map([
  ["application/vnd.ms-powerpoint.presentation.macroEnabled.12", "pptm"],
  ["application/vnd.ms-powerpoint.template.macroEnabled.12", "potm"],
  ["application/vnd.ms-powerpoint.slideshow.macroEnabled.12", "ppsm"],
  ["application/vnd.ms-powerpoint.addin.macroEnabled.12", "ppam"],
]);
const CONTENT_TYPES_PART = "[Content_Types].xml";
const MAIN_PART = "ppt/presentation.xml";
const EMBEDDINGS_DIR = "ppt/embeddings/";
const SLIDE_PART_RE = /^ppt\/slides\/[^/]+\.xml$/;
const NOTES_PART_RE = /^ppt\/notesSlides\/[^/]+\.xml$/;
const MASTER_PART_RE = /^ppt\/(slideMasters|slideLayouts)\/[^/]+\.xml$/;

/* ------------------------------------------------------------------ *
 * The IC-1 element reference
 * ------------------------------------------------------------------ */

/** `{kind:"slide-shape", ref:"slide <1-based>", slide:<1-based>[, shape:<0-based>]}`.
 *  `slide` is 1-based and equals the number the human-readable `ref` shows
 *  (IC-1's own example: ref "slide 7", slide 7). `shape` is included only
 *  when the reference genuinely targets a shape. */
export function slideShapeRef(slide, shape = null) {
  const ref = { kind: "slide-shape", ref: `slide ${slide}`, slide };
  if (shape != null) ref.shape = shape;
  return ref;
}

const attrsOf = parseAttrs;

/* The DrawingML shape elements whose opens advance the 0-based shape index —
 * <p:spTree> children and their nested kin, one sequence per slide. */
const SHAPE_TAGS = new Set(["sp", "pic", "graphicFrame", "cxnSp", "grpSp"]);

/* ------------------------------------------------------------------ *
 * Hidden slides (DEC-5, COFF-7)
 * ------------------------------------------------------------------ */

/* xsd:boolean false — its only two lexical forms. This is the ONE funnel
 * both attribute locations (the <p:sld> root and the sldIdLst entry) pass
 * through; a hidden slide is one whose bytes DECLARE show false, and an
 * absent attribute means shown — never guessed. */
const declaresNotShown = (v) => v === "0" || v === "false";

/* The slide part's root `show` flag (ECMA-376's CT_Slide@show on the part's <p:sld> root), read from the head of the
   part only: the scan stops at the root tag. */
function rootShow(xml) {
  let show = null;
  const h = { stopped: false, text() {}, cdata() {}, close() {},
    open(name, raw) { if (name === "sld") { show = parseAttrs(raw).show ?? null; h.stopped = true; } } };
  scanSync(new Scanner(h), xml.length > TAG_MAX + 4096 ? xml.slice(0, TAG_MAX + 4096) : xml);
  return show;
}

/* ------------------------------------------------------------------ *
 * The slide walk — ONE pass over a slide (or notesSlide, or master or layout) part collecting
 * everything structure(), text() and the envelope need, in document order
 * ------------------------------------------------------------------ */

/** What a deck's walks retain, paragraphs, cells and links, and the characters they hold (R44): one meter for the
 *  deck. `exceeded` is the first bound the walks went past. */
/* R44: the elements a slide walk counts as a retained object, one for each open of one (paragraphs, cells, links); `countObjects` counts the same. */
const SLIDE_COUNTED = new Set(["p", "tc", "hlinkClick"]);

function createMeter({ retainedMax = OFFICE_RETAINED_MAX, charsMax = OFFICE_DECODED_CHARS_MAX } = {}) {
  const m = { objects: 0, chars: 0, exceeded: null, retainedMax, charsMax };
  m.count = () => { if (++m.objects > retainedMax && !m.exceeded) m.exceeded = { why: "TOO_MANY_OBJECTS", n: m.objects, bound: retainedMax, final: true }; };
  m.add = (n) => { m.chars += n; if (m.chars > charsMax && !m.exceeded) m.exceeded = { why: "TOO_MANY_CHARACTERS", n: m.chars, bound: charsMax, final: true }; };
  return m;
}

function slideHandler(meter) {
  const paragraphs = [];
  const bodyParas = []; // the paragraphs that are in no text box
  const hlinks = [];
  const ridUsage = new Map();
  const pics = [];
  const boxText = new Map(); // shape index -> its paragraphs, for the shapes that are text boxes
  let shape = -1;
  const open = [];      // the shapes open here, innermost last
  let cur = null;       // current <a:p> text, when inside one
  let inText = false;   // inside an <a:t>

  const noteRid = (attrs, at = shape >= 0 ? shape : null) => {
    for (const key of ["id", "embed", "link"]) {
      const v = attrs[key];
      if (typeof v === "string" && /^rId/.test(v) && !ridUsage.has(v))
        ridUsage.set(v, at);
    }
  };
  const skipped = mceSkipper();
  const add = (d) => { if (inText && cur != null) { cur += d; meter.add(d.length); } };
  const handler = {
    stopped: false,
    text(s) { add(unescape(s)); },
    cdata(s) { add(s); },
    close(name) {
      if (skipped(name, true, false)) return;
      if (name === "t") inText = false;
      else if (name === "p") {
        if (cur != null) {
          paragraphs.push(cur);
          const top = open.length ? open[open.length - 1] : null;
          if (top != null && boxText.has(top)) boxText.get(top).push(cur);
          else bodyParas.push(cur);
          cur = null;
        }
      }
      else if (SHAPE_TAGS.has(name)) open.pop();
    },
    open(name, raw, selfClosed) {
      /* N439: a relationship used only inside a branch not read still locates its part, at the shape that HOLDS the
         `mc:AlternateContent` (null at the slide's top level) — where the branch sits. */
      if (skipped(name, false, selfClosed)) {
        if (raw && raw.includes("=")) noteRid(attrsOf(raw), open.length ? open[open.length - 1] : null);
        return;
      }
      if (SHAPE_TAGS.has(name)) {
        shape++;
        if (!selfClosed) open.push(shape);
        if (name === "pic") pics.push(shape);
      }
      const attrs = raw && raw.includes("=") ? attrsOf(raw) : {};
      switch (name) {
        case "p":
          meter.count();
          if (!selfClosed) cur = "";
          break;
        case "tc":
          meter.count();
          break;
        case "t":
          if (!selfClosed) inText = true;
          break;
        case "br":
          if (cur != null) cur += "\n";
          break;
        case "cNvSpPr":
          if ((attrs.txBox === "1" || attrs.txBox === "true") && open.length) boxText.set(open[open.length - 1], []);
          break;
        case "hlinkClick":
          meter.count();
          noteRid(attrs);
          /* Any non-empty r:id is a relationship id (xsd:ID; the `rId` prefix
           * is a producer's habit, not the format's rule). An empty one is an
           * action (next slide, end show) and names no relationship. */
          if (attrs.id) hlinks.push({ rid: attrs.id, shape: shape >= 0 ? shape : null });
          break;
        default:
          noteRid(attrs);
      }
      if (meter.exceeded) handler.stopped = true;
    },
  };
  const result = () => {
    const text = paragraphs.filter((t) => t.length).join("\n");
    return { paragraphs, text, bodyText: bodyParas.filter((t) => t.length).join("\n"), shapes: shape + 1, hlinks, ridUsage, pics,
      boxes: [...boxText].map(([s, ps]) => ({ shape: s, text: ps.filter((t) => t.length).join("\n") })) };
  };
  return { handler, result };
}

/** Walk a PresentationML slide, notesSlide, master or layout part held as a string. Answers
 *  `{ok:true, paragraphs:[string...], text, shapes:<int>, hlinks:[{rid,shape}], ridUsage:Map(rid -> shape|null), pics,
 *  bodyText (the text outside the text boxes), boxes:[{shape,text}], scanner}`, or `{ok:false, why:"char_ref_invalid", final:true}` for a part holding a character
 *  reference that names no character (R40).
 *
 *  Text: `<a:t>` runs concatenated per `<a:p>` paragraph (CDATA included, R41); `<a:br>` is a
 *  newline within its paragraph; `text` is the non-empty paragraphs
 *  newline-joined. An `<a:fld>`'s cached literal is included — it IS in the
 *  bytes. Shape index: every SHAPE_TAGS open, 0-based, in document order
 *  (nested group members included) — one sequence per slide, so a shape
 *  index means the same thing to every reference into that slide.
 *
 *  N439 (R11's pptx arm; K747, K863): in each `mc:AlternateContent` ONE
 *  branch is read — the first `mc:Choice`, else the `mc:Fallback` — by the
 *  same `mceSkipper` docx.mjs reads with. A branch not read adds no paragraph, text, shape index or hlink. */
async function walkSlide(xml, meter, yieldNow) {
  const w = slideHandler(meter);
  const sc = new Scanner(w.handler);
  await scanWhole(sc, xml, yieldNow);
  if (sc.badRef) return { ok: false, why: "char_ref_invalid", final: true };
  return { ok: true, ...w.result(), scanner: sc };
}


/* ------------------------------------------------------------------ *
 * Link classification — the same partition rule pdfstructure and docx
 * apply (http/https and bare relatives -> deferred; other schemes refused)
 * ------------------------------------------------------------------ */

function classifyUri(uri) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(uri || "");
  const scheme = m ? m[1].toLowerCase() : null;
  if (scheme === "http" || scheme === "https") return "deferred";
  if (!scheme && uri) return "deferred";
  return "refused";
}

function deferredOrRefusedRecord(uri, source) {
  const partition = classifyUri(uri);
  return {
    partition,
    wrapper: partition === "deferred" ? linkWrapper.deferred(uri) : linkWrapper.refused(uri),
    target: { url: uri },
    source,
  };
}

function undeterminedRecord(source, why, extra = {}) {
  return { partition: "undetermined", wrapper: null, target: { why, ...extra }, source };
}


/* Resolve a rels Target against the source part's directory ("slide3.xml"
 * relative to "ppt/slides/" -> "ppt/slides/slide3.xml"; a leading "/" is
 * package-root). */
function resolveRelTarget(relsPart, target) {
  const t = String(target || "");
  if (t.startsWith("/")) return normalizePartName(t);
  const baseDir = relsPart.replace(/_rels\/[^/]*\.rels$/, "");
  const segs = (baseDir + t).split("/");
  const out = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return out.join("/");
}

/* ------------------------------------------------------------------ *
 * parts() — the container walk (I7 slot 2)
 * ------------------------------------------------------------------ */

/** Read everything structure()/text() will need, honestly:
 *  { ok:true, format:"pptx", bytes, container, mainPart,
 *    presentationXml|null,
 *    order|null,                       // slide part names in DECLARED deck
 *                                      // order (sldIdLst), null when the
 *                                      // declaration cannot be read
 *    slideParts, notesParts,           // central-directory inventories
 *    slideXml, notesXml,               // Map(part -> xml) for readable parts
 *    notesOf,                          // Map(slide part -> its notesSlide part)
 *    hiddenParts,                      // Set(slide part) whose bytes declare
 *                                      // show="0" (root or sldIdLst entry)
 *    rels, core|null,
 *    guard|null,                       // the sizeGuard marker when over bound
 *    undetermined:[{part,why}...] }    // parts that exist but cannot be read
 *  or { ok:false, why, signals } when the bytes are not a readable PPTX. */
async function pptxParts(bytes) {
  const b = toBytes(bytes);
  const d = await discriminate(b);
  if (!d.ok) return { ok: false, why: d.why, signals: d.signals };
  if (d.format !== "pptx") {
    return {
      ok: false,
      why: d.format === "undetermined" ? d.why : `not_pptx:${d.format}`,
      signals: d.signals,
    };
  }
  const container = readContainer(b);
  if (!container.ok) return { ok: false, why: container.why, signals: d.signals };

  const undetermined = [];
  const partials = [];
  const mainPart = normalizePartName(d.mainPart || MAIN_PART);

  /* The inventories, central-directory order. */
  const slideParts = [];
  const notesParts = [];
  const masterParts = [];
  for (const e of container.entries) {
    const n = normalizePartName(e.name);
    if (SLIDE_PART_RE.test(n)) slideParts.push(n);
    else if (NOTES_PART_RE.test(n)) notesParts.push(n);
    else if (MASTER_PART_RE.test(n)) masterParts.push(n);
  }

  /* The COFF-6 metric: DECLARED UNCOMPRESSED bytes of the text parts we would
   * inflate (slides, speaker notes, masters and layouts), summed from the central directory
   * BEFORE any inflation. */
  let declaredTextBytes = 0;
  for (const n of [...slideParts, ...notesParts, ...masterParts]) {
    const e = container.byName.get(n);
    if (e) declaredTextBytes += e.uncompressedSize;
  }
  const plan = textPlan(declaredTextBytes);
  const guard = plan.read === "none" ? plan.guard : null;
  const piecewise = plan.read === "pieces" ? plan.piecewise : null;

  const rels = await walkRels(b, container);

  /* ppt/presentation.xml is STRUCTURAL (the deck-order declaration), tiny,
   * and read regardless of the text guard — as docx reads rels over-bound. */
  let presentationXml = null;
  const main = await readText(b, container, mainPart);
  if (main.ok) { presentationXml = main.text; if (main.partial) partials.push(main.partial); }
  else undetermined.push({ part: mainPart, ...stripOk(main) });

  /* Deck order: <p:sldIdLst>'s sldId sequence, each resolved through the
   * presentation part's .rels. The r:id is the PREFIXED :id attribute —
   * sldId also carries its own unprefixed id="", which is not a rel. */
  let order = null;
  const hiddenParts = new Set(); // slide parts whose bytes declare show="0"
  if (presentationXml != null) {
    const presRelsPart = relsPartFor(mainPart);
    const presRels = rels.byPart.find((p) => p.part === presRelsPart);
    const listed = collectElements(presentationXml, ["sldId"]);
    if (listed.badRef) {
      undetermined.push({ part: mainPart, why: "char_ref_invalid", final: true });
    } else if (!presRels) {
      const stated = rels.undetermined.find((u) => u.part === presRelsPart);
      undetermined.push({ part: presRelsPart, why: stated?.why ?? "part_absent" });
    } else {
      const byId = new Map(presRels.relationships.map((r) => [r.id, r]));
      order = [];
      for (const el of listed.elements) {
        const key = Object.keys(el.attrs).find((k) => k.includes(":") && k.endsWith(":id"));
        const id = key ? el.attrs[key] : null;
        const rel = id != null ? byId.get(id) : null;
        if (!rel || rel.external || !rel.target) {
          order.push(null); // the slot counts; the slide it named is unresolvable
          undetermined.push({ part: mainPart, why: `sldid_rel_unresolved:${id ?? "no_rid"}` });
          continue;
        }
        const resolved = resolveRelTarget(presRelsPart, rel.target);
        order.push(resolved);
        /* The queue-item location: show="0" carried on the sldIdLst entry
         * itself, honored when the bytes carry it there. */
        if (declaresNotShown(el.attrs.show)) hiddenParts.add(resolved);
      }
    }
  }

  /* Slide and notes XML, guard permitting. Over the bound a slide is read here
   * only for its root's `show` flag and let go: text() and structure() read
   * each part again as they walk it (R35). A part over the bound itself is
   * stated now, with its size. */
  const slideXml = new Map();
  const notesXml = new Map();
  const masterXml = new Map();
  const readHere = async (n, into, root) => {
    const e = container.byName.get(n);
    if (plan.read === "pieces" && e && e.uncompressedSize > MEASURED_OOXML_TEXT_BOUND_BYTES) {
      undetermined.push({ part: n, why: "over_size_bound", size: e.uncompressedSize, final: true });
      return;
    }
    const r = await readText(b, container, n);
    if (!r.ok) { undetermined.push({ part: n, ...stripOk(r) }); return; }
    if (r.partial) partials.push(r.partial);
    if (plan.read === "whole") into.set(n, r.text);
    if (root && declaresNotShown(rootShow(r.text))) hiddenParts.add(n);
  };
  /* R44 (fix round 10, cause 11a): a deck that could hold more objects than the figure is counted part by part, in pieces, BEFORE its parts are held, so a deck past it is refused having held no more than a piece. */
  let refused = null, precounted = 0;
  if (plan.read === "whole" && declaredTextBytes >= precountFloor(OFFICE_RETAINED_MAX)) {
    const c = await countObjects(b, container, [...slideParts, ...notesParts, ...masterParts], SLIDE_COUNTED, { skipper: mceSkipper, max: OFFICE_RETAINED_MAX });
    precounted = c.scanned;
    if (c.exceeded) refused = c.exceeded;
  }
  if (plan.read !== "none" && !refused) {
    for (const n of slideParts) await readHere(n, slideXml, true);
    if (plan.read === "whole") {
      for (const n of notesParts) await readHere(n, notesXml, false);
      for (const n of masterParts) await readHere(n, masterXml, false);
    }
  }

  /* slide -> its notesSlide, through each slide's own .rels (the declaration
   * in the bytes, never the filename convention). */
  const notesOf = new Map();
  for (const bp of rels.byPart) {
    const m = bp.part.match(/^(ppt\/slides\/)_rels\/([^/]+\.xml)\.rels$/);
    if (!m) continue;
    const slidePart = m[1] + m[2];
    for (const r of bp.relationships) {
      if (!r.external && r.type && r.type.endsWith("/notesSlide") && r.target) {
        notesOf.set(slidePart, resolveRelTarget(bp.part, r.target));
        break;
      }
    }
  }

  let core = null;
  if (container.byName.has(CORE_PROPERTIES_PART)) {
    const c = await readCoreProperties(b, container);
    if (c.ok) core = c;
    else undetermined.push({ part: CORE_PROPERTIES_PART, why: c.why });
  }

  /* R32: names, rels and the VBA project — read over the guard too. */
  const active = await activeContent(b, container, rels, "ppt/");

  return {
    ok: true, format: "pptx", variant: d.variant ?? null, bytes: b, container, mainPart, presentationXml,
    order, slideParts, notesParts, masterParts, slideXml, notesXml, masterXml, notesOf, hiddenParts,
    rels, core, active, guard, piecewise, stream: plan.read === "pieces", partials, undetermined, refused, precounted,
  };
}

/* The deck view: [{part, slide|null}] — declared order numbered 1-based,
 * then any slide part the declaration does not reach (order unreadable, or
 * an orphan part) honestly UNNUMBERED, in central-directory order. */
function deckOf(parts) {
  const seq = [];
  const seen = new Set();
  if (parts.order) {
    parts.order.forEach((part, i) => {
      if (part == null) return; // the unresolvable slot is already stated
      seq.push({ part, slide: i + 1 });
      seen.add(part);
    });
  }
  for (const p of parts.slideParts) if (!seen.has(p)) seq.push({ part: p, slide: null });
  return seq;
}

/** N439's MIGRATION MAP (R29; K795 (6)) — how a stored pptx reading made
 *  before N439 (every branch of `mc:AlternateContent` walked) is numbered
 *  against one made now (one branch). For extraction's migration of stored
 *  `slide-shape` references, and for nothing else; it goes when that
 *  migration has run, as R28's docx map does.
 *
 *    { slides: [{ slide, shapes: [{ old, new }] }] }
 *
 *  `parts` is `pptxEntry.parts()`'s own result — the deck's files as read —
 *  so the slides are numbered exactly as the reading numbers them (declared
 *  deck order; `slide: null` for a part the order does not reach). One entry
 *  per slide part the reading walked, in that order; `shapes` has one entry
 *  per shape the OLD walk numbered (`old`, 0-based, every branch counted)
 *  with its index now (`new`), null for a shape inside a branch not read —
 *  its content was the duplicate of the branch that is. A slide whose part
 *  was not read (unreadable, or over the size guard) held no shape index and
 *  is not listed. Null when `parts` is not an ok parts result (R21). */
export function pptxRenumbering(parts) {
  if (!parts || parts.ok !== true || !(parts.slideXml instanceof Map) || !Array.isArray(parts.slideParts)) return null;
  const slides = [];
  for (const { part, slide } of deckOf(parts)) {
    const xml = parts.slideXml.get(part);
    if (typeof xml !== "string") continue;
    const skipped = mceSkipper();
    const shapes = [];
    let now = 0;
    scanSync(new Scanner({
      text() {},
      cdata() {},
      close(name) { skipped(name, true, false); },
      open(name, raw, self) {
        const skip = skipped(name, false, self);
        if (SHAPE_TAGS.has(name)) shapes.push({ old: shapes.length, new: skip ? null : now++ });
      },
    }), xml);
    slides.push({ slide, shapes });
  }
  return { slides };
}

/* The guard marker's part field: the guard sums a FAMILY of parts, so the
 * family is named rather than one member (docx names its single main part). */
const GUARDED_PARTS = "ppt/slides/* + ppt/notesSlides/*";

/* One slide's or notes part's XML for a walk: the text read whole by parts()
 * (`held`), or, for a deck read one part at a time (R35), read now and left to
 * the caller to let go. `{ xml }`, or `{ why }` (with `size` and `final` for a
 * part over the bound). The reason a part is missing is the one parts() stated,
 * else "unreadable" (the whole read's own word). */
async function partXml(parts, part, held) {
  const xml = held.get(part);
  if (xml != null) return { xml };
  const stated = parts.undetermined.find((u) => u.part === part);
  if (stated) return { why: stated.why, ...(stated.final ? { size: stated.size, final: true } : {}) };
  if (!parts.stream) return { why: "unreadable" };
  const e = parts.container.byName.get(part);
  if (e && e.uncompressedSize > MEASURED_OOXML_TEXT_BOUND_BYTES) {
    return { why: "over_size_bound", size: e.uncompressedSize, final: true };
  }
  const r = await readText(parts.bytes, parts.container, part);
  return r.ok ? { xml: r.text, ...(r.partial ? { partial: r.partial } : {}) }
    : { why: r.why, ...(r.final ? { final: true } : {}), ...(r.size != null ? { size: r.size } : {}) };
}

/* ------------------------------------------------------------------ *
 * structure() — I2 links + the evidentiary envelope (I7 slot 3)
 * ------------------------------------------------------------------ */

async function pptxStructure(parts, opts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "pptx", reason: parts?.why ?? "PARTS_ABSENT" };
  }
  const yieldNow = opts?.yieldNow;
  const meter = createMeter();
  if (parts.refused) meter.exceeded = parts.refused;
  const notes = [];
  const links = [];
  const deck = deckOf(parts);
  const slideNoOf = new Map();
  for (const d of deck) if (d.slide != null) slideNoOf.set(d.part, d.slide);
  if (!parts.order) {
    notes.push("deck order undeclared-or-unreadable (ppt/presentation.xml sldIdLst): slides are UNNUMBERED — slide:null, sources null — stated, never numbered off filenames");
  }
  if (parts.guard) {
    notes.push("slide/notes parts not read: over the size bound (stated in evidentiary.undetermined and by text())");
  }

  /* What the walks give this answer: a slide's hyperlinks and the shape each
     relationship is used at. A deck read one part at a time (R35) states a
     part it cannot read now, once, unless parts() already did. */
  const walks = new Map();
  const unreadNow = (part, got) => {
    if (parts.stream && !parts.undetermined.some((u) => u.part === part)
        && !evUndeterminedNow.some((u) => u.part === part)) {
      evUndeterminedNow.push({ part, why: got.why, ...(got.final ? { size: got.size, final: true } : {}) });
    }
  };
  const evUndeterminedNow = [];
  for (const { part } of deck) {
    const got = await partXml(parts, part, parts.slideXml);
    if (got.xml == null) { unreadNow(part, got); continue; }
    if (got.partial) evUndeterminedNow.push(got.partial);
    const w = await walkSlide(got.xml, meter, yieldNow);
    if (!w.ok) { evUndeterminedNow.push({ part, why: w.why, final: true }); continue; }
    if (meter.exceeded) break;
    walks.set(part, { hlinks: w.hlinks, ridUsage: w.ridUsage });
  }
  const relsPartToSlide = new Map();
  for (const { part } of deck) relsPartToSlide.set(relsPartFor(part), part);

  /* A slide-shape source for a rel carried by a slide's .rels part: the .rels
   * NAME ties it to the slide (that is in the bytes), the body walk sharpens
   * it to a shape; an unnumbered slide yields null, never an invented number. */
  const slideLevelSource = (slidePart) => {
    const n = slideNoOf.get(slidePart);
    return n != null ? slideShapeRef(n) : null;
  };

  /* Outbound rels -> deferred/refused, through the ONE linkWrapper. One
   * record per body USAGE when used; a rel no usage was found for is still
   * carried once, at slide granularity when its .rels part is a slide's. */
  for (const rel of parts.rels.outbound) {
    const slidePart = relsPartToSlide.get(rel.part);
    if (slidePart) {
      const slideNo = slideNoOf.get(slidePart) ?? null;
      const w = walks.get(slidePart);
      const usages = w ? w.hlinks.filter((h) => h.rid === rel.id) : [];
      if (usages.length) {
        for (const u of usages) {
          links.push(deferredOrRefusedRecord(rel.target,
            slideNo != null ? slideShapeRef(slideNo, u.shape) : null));
        }
        continue;
      }
      links.push(deferredOrRefusedRecord(rel.target, slideLevelSource(slidePart)));
      continue;
    }
    links.push(deferredOrRefusedRecord(rel.target, null));
  }
  /* An unreadable .rels part means links may be MISSING: stated, not dropped. */
  for (const u of parts.rels.undetermined) {
    links.push(undeterminedRecord(null, "rels_unreadable", { part: u.part, detail: u.why }));
  }

  /* Slide-jump hlinks -> anchor: an internal rel of type …/slide, USED by an
   * <a:hlinkClick> in the body. Structural slide rels (sldIdLst's own, a
   * slide's notesSlide rel) are not links and are not emitted. A jump to a
   * slide the declared order does not contain is a STATED undetermined. */
  for (const bp of parts.rels.byPart) {
    const slidePart = relsPartToSlide.get(bp.part);
    if (!slidePart) continue;
    const w = walks.get(slidePart);
    if (!w) continue;
    const slideNo = slideNoOf.get(slidePart) ?? null;
    for (const r of bp.relationships) {
      if (r.external || !r.type || !r.type.endsWith("/slide") || !r.target) continue;
      const usages = w.hlinks.filter((h) => h.rid === r.id);
      if (!usages.length) continue;
      const resolved = resolveRelTarget(bp.part, r.target);
      const targetNo = slideNoOf.get(resolved) ?? null;
      for (const u of usages) {
        const source = slideNo != null ? slideShapeRef(slideNo, u.shape) : null;
        if (targetNo != null) {
          const fragment = `#slide=${targetNo}`;
          links.push({
            partition: "anchor",
            wrapper: linkWrapper.anchor(fragment),
            target: { slide: targetNo, fragment, part: resolved },
            source,
          });
        } else {
          links.push(undeterminedRecord(source, "slide_unresolved", { part: resolved }));
        }
      }
    }
  }

  /* ppt/embeddings/* -> intra, content-addressed. Located back to a slide
   * (and shape, when the body walk finds the rel used) through the rels id. */
  const embeddingRefs = new Map(); // resolved part -> { slidePart|null, rid }
  for (const bp of parts.rels.byPart) {
    const slidePart = relsPartToSlide.get(bp.part) ?? null;
    for (const r of bp.relationships) {
      if (r.external || !r.target) continue;
      const resolved = resolveRelTarget(bp.part, r.target);
      if (resolved.startsWith(EMBEDDINGS_DIR) && !embeddingRefs.has(resolved))
        embeddingRefs.set(resolved, { slidePart, rid: r.id });
    }
  }
  const embedded = [];
  for (const entry of parts.container.entries) {
    const name = normalizePartName(entry.name);
    if (name.startsWith(EMBEDDINGS_DIR) && name !== EMBEDDINGS_DIR) embedded.push(name);
  }
  const identities = await memberIdentities(parts.bytes, embedded);
  for (const name of embedded) {
    const refd = embeddingRefs.get(name) ?? null;
    let source = null;
    if (refd && refd.slidePart) {
      const slideNo = slideNoOf.get(refd.slidePart) ?? null;
      if (slideNo != null) {
        const w = walks.get(refd.slidePart);
        const shape = w && w.ridUsage.has(refd.rid) ? w.ridUsage.get(refd.rid) : null;
        source = slideShapeRef(slideNo, shape);
      }
    }
    /* R43: the identity is taken as the member streams, never from the member held whole. */
    const read = identities.get(name);
    if (!read?.ok) {
      links.push(undeterminedRecord(source, "embedded_part_unreadable", { part: name, detail: read?.why ?? "unreadable",
        ...(read?.limit != null ? { limit: read.limit } : {}) }));
      continue;
    }
    links.push({
      partition: "intra",
      wrapper: linkWrapper.intra(read.sha256),
      target: { sha256: read.sha256, name: name.slice(name.lastIndexOf("/") + 1), bytes: read.size },
      source,
    });
  }

  const counts = { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 };
  for (const l of links) counts[l.partition]++;

  /* ---- the evidentiary envelope (DEC-5; IC-2 CONFIRMED, no variant) ---- */
  const items = [];
  const evUndetermined = [...parts.undetermined, ...parts.partials, ...evUndeterminedNow];
  if (meter.exceeded) evUndetermined.push({ part: GUARDED_PARTS, ...meter.exceeded });
  if (parts.guard) evUndetermined.push({ part: GUARDED_PARTS, why: "over_size_bound", guard: parts.guard });
  if (parts.piecewise) notes.push("text_read_in_pieces");

  /* HIDDEN SLIDES (DEC-5, COFF-7): a slide whose bytes declare show="0" is
   * invisible in every presented form of the deck — a first-class finding,
   * the pptx analogue of a hidden xlsx sheet. The slide stays FULLY
   * extracted (its text, notes and links are emitted like any other slide's);
   * this item is the flag that names it, and text() marks its units. */
  for (const { part, slide } of deck) {
    if (!parts.hiddenParts.has(part)) continue;
    items.push({
      kind: "hidden-slide",
      slide,
      part,
      source: slide != null ? slideShapeRef(slide) : null,
    });
  }

  /* SPEAKER NOTES — the evidentiary core: per slide, a DISTINCT kind, never
   * merged into slide text anywhere. */
  const mappedNotes = new Set();
  for (const { part, slide } of deck) {
    const notesPart = parts.notesOf.get(part) ?? null;
    if (!notesPart) continue;
    mappedNotes.add(notesPart);
    const got = await partXml(parts, notesPart, parts.notesXml);
    if (got.xml == null) {
      /* Unreadable notes parts are already stated by parts(), or, for a deck
       * read one part at a time, now; a DECLARED notes part the container
       * does not even hold is stated here. */
      if (!parts.guard && !parts.container.byName.has(notesPart))
        evUndetermined.push({ part: notesPart, why: "part_absent" });
      else if (!parts.guard && parts.stream && !evUndetermined.some((u) => u.part === notesPart))
        evUndetermined.push({ part: notesPart, why: got.why, ...(got.final ? { size: got.size, final: true } : {}) });
      continue;
    }
    const nw = await walkSlide(got.xml, meter, yieldNow);
    if (!nw.ok) { evUndetermined.push({ part: notesPart, why: nw.why, final: true }); continue; }
    items.push({
      kind: "speaker-notes",
      slide,
      part: notesPart,
      text: nw.text,
      source: slide != null ? slideShapeRef(slide) : null,
    });
  }
  /* A notesSlide no slide claims (an orphan) still carries its evidence —
   * honestly unattributed to a slide number. */
  for (const np of parts.notesParts) {
    if (mappedNotes.has(np) || parts.guard) continue;
    const got = await partXml(parts, np, parts.notesXml);
    if (got.xml == null) {
      if (parts.stream && !evUndetermined.some((u) => u.part === np))
        evUndetermined.push({ part: np, why: got.why, ...(got.final ? { size: got.size, final: true } : {}) });
      continue;
    }
    const ow = await walkSlide(got.xml, meter, yieldNow);
    if (!ow.ok) { evUndetermined.push({ part: np, why: ow.why, final: true }); continue; }
    items.push({ kind: "speaker-notes", slide: null, part: np, text: ow.text, source: null });
  }

  if (parts.core) {
    items.push({
      kind: "core-properties",
      creator: parts.core.creator, lastModifiedBy: parts.core.lastModifiedBy,
      revision: parts.core.revision, revisionNumber: parts.core.revisionNumber,
      created: parts.core.created, modified: parts.core.modified, title: parts.core.title,
      source: null,
    });
  }
  const evCounts = {};
  for (const it of items) evCounts[it.kind] = (evCounts[it.kind] ?? 0) + 1;
  const evidentiary = {
    container: "pptx",
    kinds: [...new Set(items.map((it) => it.kind))],
    items,
    undetermined: evUndetermined,
    counts: evCounts,
  };

  return {
    ok: true,
    container: "pptx",
    slides: deck.length,
    links,
    counts,
    evidentiary,
    notes,
  };
}

/* COFF-13 / D-359's residue — THE DECK'S OWN LENGTH: the slides the DECK has,
 * never the ones this reader could open. `slides[]` OMITS a slide whose part
 * cannot be read (the survivors keep their true numbers), so the highest
 * READABLE slide number under-reports a deck whose TRAILING slides are
 * unreadable, and the record then refuses a TRUE citation of the last slide
 * as past the deck. The length is the number of `<p:sldId>` SLOTS the bytes
 * declare — an unresolvable slot counts, exactly as `deckOf` numbers it — and
 * it is read from ppt/presentation.xml, which is structural and read even
 * over the text guard, so an over-bound deck still states its length.
 * NULL when the declaration cannot be read: the deck order is then unknown,
 * and a length counted off slide PARTS would be the filename convention this
 * entry refuses everywhere else. Orphan slide parts outside the declaration
 * are not in the deck as presented and do not lengthen it. */
function deckLengthOf(parts) {
  return Array.isArray(parts.order) ? parts.order.length : null;
}

/* ------------------------------------------------------------------ *
 * text() — <a:t> runs per slide; SPEAKER NOTES a DISTINCT unit list,
 * never merged (I7 slot 4)
 * ------------------------------------------------------------------ */

async function pptxText(parts, opts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "pptx", reason: parts?.why ?? "PARTS_ABSENT" };
  }
  if (parts.guard) {
    /* Over the bound: the sizeGuard marker carried VERBATIM, never a silent
     * truncation. */
    return {
      ok: true, container: "pptx", document: null, slides: [], speakerNotes: [],
      deckLength: deckLengthOf(parts),
      undetermined: [parts.guard],
      counts: { chars: 0, notesChars: 0, undetermined: 1, scanned_bytes: 0 },
    };
  }
  const yieldNow = opts?.yieldNow;
  const meter = createMeter();
  /* R44: refused before its parts were held, by the count parts() made in pieces; the answer the walk gives. */
  if (parts.refused) {
    return {
      ok: true, container: "pptx", document: null, slides: [], speakerNotes: [],
      deckLength: deckLengthOf(parts),
      undetermined: [{ part: GUARDED_PARTS, ...parts.refused }],
      counts: { chars: 0, notesChars: 0, undetermined: 1, scanned_bytes: parts.precounted ?? 0 },
    };
  }
  const deck = deckOf(parts);
  const slides = [];
  const speakerNotes = [];
  const undetermined = [...parts.partials];
  const units = { speaker_note: [], master_text: [] };
  const boxes = [];
  let scanned = 0;
  /* One part walked: its walk, or the statement of why it was not (R40, R44). */
  const walkPart = async (got, stated) => {
    if (got.partial) undetermined.push(got.partial);
    const w = await walkSlide(got.xml, meter, yieldNow);
    if (!w.ok) { undetermined.push({ ...stated, why: w.why, final: true }); return null; }
    scanned += w.scanner.scanned;
    undetermined.push(...scanNotes(stated.part, w.scanner));
    return w;
  };
  for (const { part, slide } of deck) {
    /* The COFF-7 mark: `hidden` on EVERY unit — true when the slide's bytes
     * declare show="0", false otherwise (the xlsx sheets[] precedent) — so a
     * hidden slide is distinguishable from a visible one wherever a unit is
     * shown, cited or indexed. */
    const hidden = parts.hiddenParts.has(part);
    const got = await partXml(parts, part, parts.slideXml);
    if (got.xml == null) {
      undetermined.push({ reason: "slide_unreadable", part, why: got.why,
        ...(got.final ? { size: got.size, final: true } : {}) });
    } else {
      const walked = await walkPart(got, { reason: "slide_unreadable", part });
      if (walked) {
        slides.push({ slide, ref: slide != null ? `slide ${slide}` : null, part, hidden,
          shapes: walked.shapes, text: walked.text,
          /* R38 (K4987): with a text box holding words, the slide's text without them; the box's piece is where they are found. */
          ...(walked.boxes.some((b) => b.text) ? { bodyText: walked.bodyText } : {}) });
        const at = (shape) => (slide != null ? slideShapeRef(slide, shape) : null);
        /* R38 (fix round 10, cause 16): a hidden slide's text is held once, as its slide unit (`hidden: true` on the slide), not also as a second body piece; a text box is its own unit. */
        for (const b of walked.boxes) if (b.text) boxes.push({ kind: "text_box", ref: at(b.shape), part, text: b.text, shapes: [b.shape], ...(hidden ? { hidden: true } : {}) });
        /* R39: a slide whose only content is a picture lists it (`images`) and states it unread; no OCR is called. */
        if (!walked.text) for (const shape of walked.pics) undetermined.push({ part, why: "image_unread", ref: at(shape) });
      }
    }
    const notesPart = parts.notesOf.get(part) ?? null;
    if (!notesPart) continue;
    const ngot = await partXml(parts, notesPart, parts.notesXml);
    if (ngot.xml == null) {
      undetermined.push({ reason: "notes_unreadable", part: notesPart, why: ngot.why,
        ...(ngot.final ? { size: ngot.size, final: true } : {}) });
    } else {
      /* THE DISTINCTION (DEC-5): a speaker-notes unit is its OWN unit with
       * its own ref form — never appended to the slide's text, never in
       * `document`. */
      const nw = await walkPart(ngot, { reason: "notes_unreadable", part: notesPart });
      if (nw) {
        speakerNotes.push({ slide, ref: slide != null ? `slide ${slide} (notes)` : null, part: notesPart, hidden, text: nw.text });
        if (nw.text) units.speaker_note.push({ kind: "speaker_note", ref: slide != null ? slideShapeRef(slide) : null, part: notesPart, text: nw.text, ...(hidden ? { hidden: true } : {}) });
      }
    }
    if (meter.exceeded) break;
  }
  /* Orphan notesSlides: their text is still evidence, honestly unnumbered —
   * and with `hidden` NULL, because the slide attachment that would carry
   * the flag is lost; stated, never guessed either way. */
  const mapped = new Set([...parts.notesOf.values()]);
  for (const np of parts.notesParts) {
    if (meter.exceeded) break;
    if (mapped.has(np)) continue;
    const got = await partXml(parts, np, parts.notesXml);
    if (got.xml == null) {
      /* Stated by parts() for a deck read whole; for one read a part at a time,
         now (a part parts() did not state). */
      if (parts.stream && !parts.undetermined.some((u) => u.part === np))
        undetermined.push({ reason: "notes_unreadable", part: np, why: got.why,
          ...(got.final ? { size: got.size, final: true } : {}) });
      continue;
    }
    const ow = await walkPart(got, { reason: "notes_unreadable", part: np });
    if (!ow) continue;
    speakerNotes.push({ slide: null, ref: null, part: np, hidden: null, text: ow.text });
    if (ow.text) units.speaker_note.push({ kind: "speaker_note", ref: null, part: np, text: ow.text });
  }
  /* R38: the text of the slide masters and layouts is read as units too. */
  for (const part of parts.masterParts) {
    if (meter.exceeded) break;
    const got = await partXml(parts, part, parts.masterXml);
    if (got.xml == null) {
      if (parts.stream && !parts.undetermined.some((u) => u.part === part))
        undetermined.push({ reason: "master_unreadable", part, why: got.why, ...(got.final ? { size: got.size, final: true } : {}) });
      continue;
    }
    const mw = await walkPart(got, { reason: "master_unreadable", part });
    if (mw?.text) units.master_text.push({ kind: "master_text", ref: null, part, text: mw.text });
  }
  /* R44: the deck would retain more than the table's figures: refused, by name and with its figure. */
  if (meter.exceeded) {
    return {
      ok: true, container: "pptx", document: null, slides: [], speakerNotes: [],
      deckLength: deckLengthOf(parts),
      undetermined: [{ part: GUARDED_PARTS, ...meter.exceeded }],
      counts: { chars: 0, notesChars: 0, undetermined: 1, scanned_bytes: scanned },
    };
  }

  /* `document` is the deck's slide text, speaker notes NEVER in it. A HIDDEN
   * slide's text IS included — extracted in full, the xlsx hidden-sheet
   * precedent: the record holds what the file holds, and the flag (the
   * hidden-slide envelope item, the units' `hidden` mark) is what keeps a
   * reader from mistaking it for presented content. Speaker notes are
   * counted apart so no reader can conflate the two streams by accident. */
  const document = slides.map((s) => s.text).filter((t) => t.length).join("\n");
  const notesChars = speakerNotes.reduce((n, s) => n + s.text.length, 0);
  return {
    ok: true, container: "pptx", document, slides, speakerNotes,
    parts: addressParts([...boxes, ...units.speaker_note, ...units.master_text]),
    deckLength: deckLengthOf(parts),
    undetermined,
    counts: { chars: document.length, notesChars, undetermined: undetermined.length, scanned_bytes: scanned },
    ...(parts.piecewise ? { piecewise: parts.piecewise } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * The I7 entry
 * ------------------------------------------------------------------ */

export const pptxEntry = {
  format: "pptx",
  detect(bytes, contentType) {
    if (bytes) {
      if (!hasZipMagic(bytes)) return null;
      /* Sync, so the central directory NAMES are the strongest honest signal.
       * At the 1 KiB acquire seam there is no EOCD, readContainer refuses,
       * and this entry answers null — ZIP magic alone NEVER claims a pptx. */
      const container = readContainer(bytes);
      if (!container.ok) return null;
      if (container.byName.has(CONTENT_TYPES_PART) && container.byName.has(MAIN_PART)) {
        return {
          format: "pptx", confidence: "likely",
          signals: [
            "magic: PK\\x03\\x04 with a readable central directory",
            `part: ${CONTENT_TYPES_PART} present`,
            `part: ${MAIN_PART} present`,
            "likely, not certain: the OPC content-type declaration is deflated — parts() discriminates",
          ],
        };
      }
      return null;
    }
    return detectByContentType("pptx", PPTX_CONTENT_TYPE, PPTX_TWIN_CONTENT_TYPES, contentType);
  },
  parts: (bytes) => pptxParts(bytes),
  structure: async (partsOrBytes, opts) => {
    /* Accept either parts() output or raw bytes, so detect→structure works
     * uniformly at the registry seam while a caller that already paid for
     * parts() does not pay twice (the docx.mjs pattern). */
    const parts = isBytes(partsOrBytes)
      ? await pptxParts(partsOrBytes)
      : partsOrBytes;
    return withActive(await pptxStructure(parts, opts), parts);
  },
  /* `opts.yieldNow` (R42), `opts.inlineCellsMax` (R45: a pptx lists no table cells, so none are omitted) */
  text: async (partsOrBytes, opts) => {
    const parts = isBytes(partsOrBytes)
      ? await pptxParts(partsOrBytes)
      : partsOrBytes;
    /* FW-19 / IC-124: `images` under ppt/media/, exhaustive or NULL. */
    return withContainerImages(withActive(withMetadata(await pptxText(parts, opts), parts, true), parts), parts, "ppt/media/");
  },
};
