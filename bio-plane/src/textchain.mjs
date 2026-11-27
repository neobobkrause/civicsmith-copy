/* CPDF-10: THE TRANSCRIPTION PROVENANCE CHAIN.
 *
 * "THE PROVENANCE RULE IS THE ITEM, not the engine" (QUEUE.md CPDF-10). This
 * module is that rule, and it holds NO engine: it does not render a page, does
 * not run an OCR pass, and does not know what tesseract or Moondream or Azure
 * DI Read are. It knows what a DERIVATION is, what a derivation may claim, and
 * what it may never claim — so the day an engine arrives (CPDF-12's fleet
 * member, or an external tier if that is ever funded) the honesty rules are
 * already built, already driven, and already refusing.
 *
 * That ordering is deliberate rather than a consequence of the renderer being
 * late. The hazard this capability carries is OUTPUT THAT LOOKS BETTER THAN ITS
 * INPUT: an OCR pass turns a scan into fluent prose, an AI clean-up turns
 * garbled OCR into readable English, and at the end of it the record holds a
 * paragraph indistinguishable from one a publisher typed. CPDF-11 MEASURED that
 * hazard rather than supposing it — Moondream at 75 dpi with blur produced
 * 16-20 minted digits per run in prose "structurally perfect and
 * indistinguishable from a clean run", turning $50,000 into $10,000 and
 * "lowest responsible bidder" into "least responsible bidder", and REFUSED
 * NOTHING while doing it. Nothing downstream can tell those apart from the
 * text. Only the chain can.
 *
 * ===================================================================== *
 * THE FOUR RULES, each of which is a refusal below and an arm in the suite
 * ===================================================================== *
 *
 * 1. A CHAIN, NEVER A TOKEN. `text_source` was the string "layer" (FW-15,
 *    D-152's discriminator, correct for its day). It is now an ORDERED ARRAY
 *    of steps, each naming what performed it:
 *
 *        pixels -> ocr(engine, version) -> ai(function, version)
 *                                       -> attested(member, date, extent)
 *
 *    A single label is REFUSED (TEXT_CHAIN_COLLAPSED). This is not fussiness
 *    about types: "ocr" as a label loses which engine, and an engine is what a
 *    calibration is OF (CPDF-13) and what a reader would have to re-run to
 *    check the claim. A chain that collapses is a chain that cannot be audited.
 *
 * 2. EVERY DERIVATION STEP WEAKENS. Never strengthens. Each step carries a
 *    `cap` — the strongest transcription-fidelity letter that step can support
 *    — and the chain's cap is the MINIMUM over its derivation steps, computed
 *    here rather than declared by a caller. Appending a step that claims a
 *    STRONGER cap than the chain it extends is REFUSED (TEXT_CHAIN_STRENGTHENS),
 *    and the refusal names the exact case it exists for: an AI that cleans a
 *    garbled line produced more READABLE text, not more RELIABLE text.
 *
 * 3. CONFIDENCE WHERE THE ENGINE SUPPLIES IT, `none` STATED OTHERWISE, AND
 *    PSEUDO-CONFIDENCE FORBIDDEN (DEC-35's confidence contract). A confidence
 *    number is only a number when a CLASSIC engine computed it from its own
 *    decode. Asking a generative model how sure it is and thresholding the
 *    answer as if calibrated is the costs-nothing class CLAUDE.md rules out,
 *    and it is REFUSED by BASIS (TEXT_CHAIN_PSEUDO_CONFIDENCE) rather than by
 *    a value range — because a self-reported 0.99 and a computed 0.99 are the
 *    same bytes and can only be told apart by who produced them.
 *
 * 4. A REGION BELOW THE FLOOR READS `undetermined`, NEVER A BEST GUESS. And
 *    the text of a refused region is DISCARDED here, not carried alongside a
 *    flag — a best guess sitting in a field beside its own warning is one
 *    careless join away from being read as content.
 *
 * ===================================================================== *
 * ATTESTATION IS NOT A DERIVATION STEP, AND THAT IS THE SUBTLE PART
 * ===================================================================== *
 *
 * Rule 2 says every step weakens. Attestation plainly does not weaken — member
 * attestation is the only route to the top (DEC-4's doctrine, unchanged). The
 * resolution is NOT an exception to rule 2; it is that `attested` is a
 * VERIFICATION step and not a derivation at all:
 *
 *   - `derivationCap(chain)` is the min over DERIVATION steps and is never
 *     raised by anything, including an attestation. The chain still RECORDS
 *     the attestation, because the record is the record.
 *   - `gradeCeiling(chain, extent)` is what a leg may claim, and THERE an
 *     attestation covering the extent supersedes the derivation cap.
 *
 * QUEUE.md CPDF-10 states exactly this and it is worth quoting rather than
 * paraphrasing: "verification supersedes it as grade determinant, never as
 * record". The two functions are the two halves of that sentence, and the
 * suite drives both, because collapsing them is how an attestation would come
 * to look like a derivation that made the text better.
 *
 * AND ATTESTATION IS SCOPED. A member attests to WHAT THEY CHECKED — a page, a
 * region, or the document — and a leg citing outside that extent DOES NOT
 * INHERIT IT. `extentCovers` is that rule, and it defaults to NOT covering:
 * an extent this module cannot parse covers nothing, because the failure that
 * matters is an unreadable extent silently reading as "all of it".
 *
 * ===================================================================== *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * ===================================================================== *
 *
 * It does not grade a capture. `captureBound` returns the BOUND transcription
 * fidelity places on the capture axis and nothing else: DEC-4's doctrine is
 * that fidelity BOUNDS the capture axis as its weakest link, so there is no
 * third scale and no new machinery. The letters are `BASIS_GRADES` and the
 * ceiling is `EARNED_CAPTURE_CEILING` — both IMPORTED from `record-grammar`, both
 * already the only spelling this project has, and neither re-typed here. If a
 * fifth grade letter is ever added, this module follows without an edit.
 *
 * It does not decide whether OCR should run. That is extraction's
 * (`bio-plane/src/extraction/pipeline.mjs`); it was the wire's, in the plane's
 * old `index.mjs`, until that file was deleted.
 *
 * It holds NO ENGINE and NO CALIBRATION. `cap` arrives as a parameter because
 * it is a MEASUREMENT (MEASUREMENTS.md, per engine, per version) and this
 * module must not become a second place a measured number lives — the failure
 * CLAUDE.md records as this project's most-repeated. CPDF-13 builds the
 * calibration construct that supplies it; until then a caller passes the
 * measured letter and NAMES where it was measured.
 */

import { BASIS_GRADES, EARNED_CAPTURE_CEILING, isMachineIdentity, canonicalJson } from "./record-grammar/index.mjs";
import { word, localize } from "./setup-words/index.mjs";

/* ------------------------------------------------------------------ *
 * The kinds this module takes and hands back (S4)
 * ------------------------------------------------------------------ */

/**
 * What a step kind declares (R1-R3, R91). `tier` may be missing: a kind that declares none is named in
 * `tiersEvidenced`'s `unclassified` (R34).
 * @typedef {Object} StepKind
 * @property {"derivation" | "verification"} role
 * @property {string} label
 * @property {number | "step" | null} [tier]
 * @property {true} [machine]
 * @property {readonly StepNamed[]} [names] the fields `checkChain` requires non-empty on a step of the kind
 * @property {"undetermined"} [unmeasured]
 * @property {"calibrated" | "never"} [letter]
 */
/**
 * A field a step kind may require named (R3, R8).
 * @typedef {"engine" | "format" | "member"} StepNamed
 */
/**
 * The step kinds (R1).
 * @typedef {Object} StepKinds
 * @property {StepKind} layer
 * @property {StepKind} pixels
 * @property {StepKind} ocr
 * @property {StepKind} ai
 * @property {StepKind} ai_transcription
 * @property {StepKind} attested
 * @property {StepKind} convert
 * @property {StepKind} typed
 */
/**
 * The pages a derivation step covers (D-252, R22): 0-based, and, where two parts of one chain share a page, the
 * part's index. Absent on a step, the step covers the whole document.
 * @typedef {Object} PagesExtent
 * @property {"pages"} kind
 * @property {number[]} pages
 * @property {number} [part]
 */
/**
 * The image-region anchor a machine reading carries (I2's IC-1 shape, R47).
 * @typedef {Object} Anchor
 * @property {"pdf-page"} kind
 * @property {string} [ref]
 * @property {number} page
 * @property {number[]} rect
 * @property {string | null} [space]
 */
/**
 * What an attestation is scoped to (R51).
 * @typedef {{ kind: "document" } | { kind: "page", page: number } | { kind: "region", source: Anchor }} AttestedExtent
 */
/**
 * One step of a chain (R4-R11): its kind, and the fields the kinds read. A step a caller built may carry more;
 * they are copied with it.
 * @typedef {Object} Step
 * @property {string} step a key of `STEP_KINDS`
 * @property {string} [engine]
 * @property {string} [version]
 * @property {string} [format]
 * @property {string} [member]
 * @property {string} [at]
 * @property {string} [text_sha256]
 * @property {number | null} [tier]
 * @property {string | null} [container]
 * @property {string | null} [cap] a `BASIS_GRADES` letter
 * @property {string | null} [measured_by]
 * @property {string | null} [calibration]
 * @property {PagesExtent | AttestedExtent} [extent]
 */
/**
 * A chain: one or more steps, in the order they happened (R4).
 * @typedef {Step[]} Chain
 */
/**
 * The codes of this module's refusals (C-35, R4-R51).
 * @typedef {"TEXT_CHAIN_COLLAPSED" | "TEXT_CHAIN_EMPTY" | "TEXT_CHAIN_STEP_SHAPE" | "TEXT_CHAIN_STEP_UNKNOWN" | "TEXT_CHAIN_STEP_UNNAMED" | "TEXT_CHAIN_STRENGTHENS" | "TEXT_CONFIDENCE_PSEUDO" | "TEXT_CONFIDENCE_SHAPE" | "TEXT_ANCHOR_MISSING" | "TEXT_ATTEST_MACHINE" | "TEXT_ATTEST_EXTENT" | "TEXT_CHAIN_CAL_REF" | "TEXT_CHAIN_LETTER_UNCALIBRATED" | "TEXT_CHAIN_LETTER_ON_PERSON"} TextChainCode
 */
/**
 * One row of `TEXT_CHAIN_CHECKS`.
 * @typedef {Object} CheckRow
 * @property {string} check
 * @property {string} where
 * @property {string} translation
 */
/**
 * The family C-35, by code.
 * @typedef {Object} TextChainChecks
 * @property {CheckRow} TEXT_CHAIN_COLLAPSED
 * @property {CheckRow} TEXT_CHAIN_EMPTY
 * @property {CheckRow} TEXT_CHAIN_STEP_SHAPE
 * @property {CheckRow} TEXT_CHAIN_STEP_UNKNOWN
 * @property {CheckRow} TEXT_CHAIN_STEP_UNNAMED
 * @property {CheckRow} TEXT_CHAIN_STRENGTHENS
 * @property {CheckRow} TEXT_CONFIDENCE_PSEUDO
 * @property {CheckRow} TEXT_CONFIDENCE_SHAPE
 * @property {CheckRow} TEXT_ANCHOR_MISSING
 * @property {CheckRow} TEXT_ATTEST_MACHINE
 * @property {CheckRow} TEXT_ATTEST_EXTENT
 * @property {CheckRow} TEXT_CHAIN_CAL_REF
 * @property {CheckRow} TEXT_CHAIN_LETTER_UNCALIBRATED
 * @property {CheckRow} TEXT_CHAIN_LETTER_ON_PERSON
 */
/**
 * A refusal (every check function's "no").
 * @typedef {Object} Refusal
 * @property {false} ok
 * @property {TextChainCode} code
 * @property {string} check
 * @property {string} translation
 * @property {string} detail
 */
/**
 * A value whose members this module reads one by one, each as any value.
 * @typedef {{ readonly [key: string]: unknown }} Fields
 */
/**
 * A list whose entries this module reads one by one, each as any value.
 * @typedef {readonly unknown[]} Entries
 */

/**
 * An empty map of the kinds its declared place names.
 * @template K, V
 * @param {readonly (readonly [K, V])[]} entries
 * @returns {Map<K, V>}
 */
const mapOf = (entries) => new Map(entries);
/** @param {unknown} o @returns {o is Fields} */
const isFields = (o) => o != null && typeof o === "object";
/** @param {unknown} x @returns {x is Entries} */
const isList = (x) => Array.isArray(x);

/* ------------------------------------------------------------------ *
 * The vocabulary
 * ------------------------------------------------------------------ */

/** The step kinds, and the ONE thing that distinguishes them: whether the step
 *  DERIVED the text (and therefore may only weaken it) or VERIFIED it (and
 *  therefore bears on the grade without touching the derivation cap).
 *
 *  A new step kind is added HERE and every rule below follows it. Nothing in
 *  this module tests a step name against a literal; `STEP_KINDS[k].role` is
 *  the question everything asks, so a step nobody classified cannot slip
 *  through as a derivation OR as a verification — it is refused as unknown.
 *  @type {StepKinds} */
export const STEP_KINDS = {
  /* The document's own text layer, decoded through the file's own /ToUnicode
     map. NOT a strong step and never was: a text layer is ITSELF an unverified
     transcription — CPDF-9 measured that 3 of 14 recent Legistar attachments
     name ABBYY FineReader in their producer metadata, so the Clerk's certified
     enacted resolutions carry somebody else's machine OCR as their text layer.
     The record has been reading those as authored text. It now says what they
     are. */
  layer:    { role: "derivation", label: word("textchain.label.document_text_layer"), tier: "step" },
  /* A page turned into pixels — rendered, or (CPDF-12's observation, to be
     verified across the corpus) EXTRACTED, where a scanned page is one
     full-page embedded image and rasterising it would be work nobody needs. */
  pixels:   { role: "derivation", label: word("textchain.label.page_pixels"), tier: 3 },
  /* An OCR engine over those pixels. Names engine and version, because that
     pair is what a calibration is of and what a re-run would need. */
  ocr:      { role: "derivation", label: word("textchain.label.optical_character_recognition"), tier: 3, machine: true },
  /* A model that rewrote the text — cleaning, joining, correcting. THE STEP
     THIS WHOLE MODULE IS MOST AFRAID OF, and rule 2 is pointed at it. */
  ai:       { role: "derivation", label: word("textchain.label.model_rewrote_text"), tier: null, machine: true },
  /* N820 / D21 (R104) — AN AI READ A PAGE THAT IS ONLY A PICTURE. Not `ai`: that kind REWROTE text
     another step produced; this one PRODUCED it, from pixels the plane's own text recognition could
     not read (reading-pipeline R29, at a member's act on the paying account). So it is a rung on the
     extraction ladder — "a transcription tier above tier 3" — and `tiersEvidenced` reports it as 4.

     Its letter is the canon's sentence, declared rather than coded (`BIO_Investigation_v0_1.md` §6):
     "labelled as the AI's reading and graded 'undetermined' until its accuracy is measured."

       `names`      the model that read the page (C-35.5), as for `ocr` and `ai`.
       `unmeasured` "undetermined": with no cap it makes `derivationCap`, and so `captureBound`,
                    UNDETERMINED over what it covers, whatever another step measured — no OCR letter
                    measured on other text bounds what a model read off a picture.
       `letter`     "calibrated": a cap only beside the calibration it rests on (C-35.13), so the
                    one route to a letter is a measurement. This module holds none (no import).

     A member who checks a passage against the page raises it through `gradeCeiling`, unchanged. */
  ai_transcription: { role: "derivation", label: word("textchain.label.ai_reading_page"), tier: 4, machine: true,
                      names: ["engine"], unmeasured: "undetermined", letter: "calibrated" },
  /* A member checked the text against the image and said so, over a stated
     extent. Not a derivation: see the header. */
  attested: { role: "verification", label: word("textchain.label.member_checked_against"), tier: null },
  /* CAP-10 / DEC-75 / IC-122 — A CONVERSION OF THE DOCUMENT, MADE BY WHOEVER
     SERVED IT, BEFORE ANY TEXT WAS READ OUT OF IT. The case it exists for is a
     Google Drive export: the record fetched Google's OpenDocument RENDERING of
     a file nobody outside Google has seen, made at fetch time and not
     reproducible (D-351). Capture grade is about the FETCH PATH and stays
     `direct`/B (DEC-75); what Google did to the document is a transformation
     of the TEXT, so it is a derivation step here and rule 2 governs it.

     `convert(producer, format)` is carried as `{ step: "convert", engine:
     <producer>, format: <format> }`. THE PRODUCER RIDES `engine` DELIBERATELY:
     `engine` is the one field this grammar already has for "what performed a
     derivation", and it is what a calibration is OF (CPDF-13), what
     `#writeTextSource` projects into `engines`, and what `describeChain`
     prints. A second field name for the same fact would split every one of
     those joins in two.

     THREE DECLARED PROPERTIES, and each is read by a rule below rather than by
     a test against the word "convert":

       `names`      the fields the step must carry, non-empty. A conversion that
                    does not say who converted, or into what, is rule 1's collapse
                    one level down (C-35.5).
       `unmeasured` "undetermined": an UNMEASURED conversion makes the whole
                    document's cap UNDETERMINED, instead of the landed sequence
                    rule where an unmeasured step neither raises nor lowers. The
                    reason is where the step sits. Every later step measured the
                    CONVERTED text against the CONVERTED bytes; none of them saw
                    the original, so no downstream measurement bounds what the
                    conversion lost. `derivationCap` explains it at the site.
       `letter`     "calibrated": a letter on this step must NAME the calibration
                    it rests on (C-35.13). DEC-75: the step is raised by a
                    calibration row, never by a caller writing a letter.

     `tier: null` — a conversion is not a rung on the extraction ladder. It is
     how the BYTES came to be; the `layer` step after it is the extraction. */
  convert:  { role: "derivation", label: word("textchain.label.document_converted_host"),
              tier: null, names: ["engine", "format"], unmeasured: "undetermined", letter: "calibrated" },
  /* REC-87 / IC-127 — A MEMBER TYPED THE TEXT (Bob's 5.2, CONTENT-EXTENT-DESIGN-
     SPACE.md §5.2). The case it exists for is his: a hundred-year-old title, a
     photocopy of a mimeograph, terms in cursive no engine reads and a person can.
     The member selects a portion and types what it says.

     A DERIVATION, NOT A VERIFICATION, and that is the ruling rather than a
     classification of convenience: there is no machine text the member is
     checking — they PRODUCED the text, so it is authored with the provenance of an
     authored act, and rule 2 governs it like any other step that produced text.
     What RAISES it is a SECOND member's attestation (`gradeCeiling`, unchanged),
     never the transcriber's own — the store refuses that by name (C-52).

     `typed(member)` is carried as `{ step: "typed", member: <handle>,
     text_sha256: <digest of the typed text> }`. The digest binds the step to the
     text it produced, so a content row's id (hash of capture, extent, chain)
     differs for different text and an attestation of one typing can never be read
     as an attestation of another.

     THREE DECLARED PROPERTIES, each read by a rule rather than by a test against
     the word "member":

       `names`      the member must be named (C-35.5) — a transcription nobody
                    typed is not one.
       `unmeasured` "undetermined", CAP-10's property, and HERE IT IS NOT AN EDGE
                    CASE — it is the whole of the member's cap. A person is not an
                    engine with a calibration; the sequence rule (an unmeasured step
                    neither raises nor lowers) would let an OCR letter measured on
                    OTHER text silently bound what the member typed, which is the
                    swallow this property exists to refuse. `derivationCap` answers
                    UNDETERMINED over the member's extent, and so `captureBound`
                    does too, with no code beyond the kind.
       `letter`     "never": a letter on this step is refused (C-35.14). Not
                    "calibrated" — there is no calibration of a person to name, so
                    the permitted route to a letter is the attestation, and only
                    that.

     `tier: null` — typing is not a rung on the extraction ladder.

     THE KIND IS SPELLED `typed`, NOT `member`, AND THE ROW SAID `member(handle)`.
     Measured, not preferred: the query compiler DERIVES its `content:chain`
     vocabulary from these keys (`query.mjs`), and `member` is already a bare word
     of the same arm — `content:member`, a document a MEMBER marked (`minted`).
     A kind named `member` made that published query AMBIGUOUS and refused it
     (content-arm.test and meaningquery.test went red on exactly that). The
     handle still rides the step's `member` field, so the notation is
     `typed(member)`. */
  typed:    { role: "derivation", label: word("textchain.label.member_typed_text"),
              tier: null, names: ["member"], unmeasured: "undetermined", letter: "never" },
};

/** N104 (K143) — THE MACHINE READINGS: the kinds whose step is an ENGINE reading or rewriting the text
 *  (`machine: true` in `STEP_KINDS`), which a reader labelling machine-read text treats `mixed` as
 *  containing (content R14, DEC-4). Derived from the declaration, never a list of spellings, so a kind
 *  added with `machine: true` joins it without an edit here; `query-language` re-exports it. */
/** The kind a step names, read as a property key is read (`String`), from `STEP_KINDS` as it stands; undefined for a
 *  name that is not one of its keys.
 *  @param {unknown} name @returns {StepKind | undefined} */
function kindOf(name) {
  switch (String(name)) {
    case "layer": return STEP_KINDS.layer;
    case "pixels": return STEP_KINDS.pixels;
    case "ocr": return STEP_KINDS.ocr;
    case "ai": return STEP_KINDS.ai;
    case "ai_transcription": return STEP_KINDS.ai_transcription;
    case "attested": return STEP_KINDS.attested;
    case "convert": return STEP_KINDS.convert;
    case "typed": return STEP_KINDS.typed;
    default: return undefined;
  }
}
/** The keys of `STEP_KINDS`, in its order. @type {readonly string[]} */
const KIND_NAMES = Object.keys(STEP_KINDS);

/** @type {readonly string[]} */
export const MACHINE_READ_KINDS = Object.freeze(KIND_NAMES.filter((k) => kindOf(k)?.machine === true));
/** Whether `k`, read as a property key is read, is an own key of `o`.
 *  @param {object} o @param {unknown} k @returns {boolean} */
const hasKey = (o, k) => Object.prototype.hasOwnProperty.call(o, String(k));

/** The BASES a per-region confidence number may have, and this enum IS the
 *  pseudo-confidence fence. `engine` means a classic decoder computed it from
 *  its own character-level decode (tesseract's per-word confidence). `none`
 *  means the engine supplies none, STATED first-class rather than defaulted to
 *  a number. There is deliberately no third value: a model's self-report has
 *  no basis to name, which is the point — it is refused because it cannot say
 *  where its number came from. */
/** @type {{ engine: number, none: number }} */
export const CONFIDENCE_BASES = { engine: 1, none: 1 };

/** The extent kinds an attestation may be scoped to, narrowest first. Internal (N416): `checkAttestation` (R51) and
 *  `extentCovers` (R55) read it, and no other module does. */
/** @type {{ region: number, page: number, document: number }} */
const EXTENT_KINDS = { region: 1, page: 1, document: 1 };

/* ===================================================================== *
 * D-252 — A DERIVATION HAS AN EXTENT TOO, AND IT IS THE MIRROR OF THE ONE
 * ATTESTATION ALREADY CARRIES.
 * ===================================================================== *
 *
 * CPDF-10 built this module for a document with ONE provenance: every step
 * derived every character. A MIXED document breaks that assumption and it is an
 * ordinary Council packet shape — a text-layer report with three scanned
 * exhibits stapled to the back. Its pages have DIFFERENT provenance: some came
 * out of the file's own text layer, some out of an OCR engine. Neither chain is
 * the document's chain, and picking either one is the record claiming something
 * about pages it did not describe.
 *
 * SO A DERIVATION STEP MAY NAME WHAT IT COVERS. `step.extent` is
 * `{ kind: "pages", pages: [<0-based>, ...] }`, and three cases are distinct:
 *
 *   ABSENT      — the step derived the whole document. Every chain written
 *                 before this rule existed is this case, which is why the field
 *                 is absent rather than defaulted to something: an unscoped
 *                 chain means exactly what it always meant.
 *   PAGES       — the step derived those pages and NOTHING ELSE.
 *   UNREADABLE  — an extent this module cannot parse covers NOTHING, and the
 *                 document's cap becomes undetermined. That direction is
 *                 `extentCovers`' own (an unreadable extent must never silently
 *                 read as "all of it"), applied to the other half of the module.
 *
 * AND THE RULE THAT MATTERS IS ABOUT THE CAP, NOT ABOUT THE TEXT. A mixed
 * document's derivation cap is the weakest over its PARTS, and a part with no
 * measured cap makes the whole UNDETERMINED — because there is then a stretch of
 * this document's text that nothing measured bounds.
 *
 * That last sentence is the whole reason this exists, so it is worth being
 * explicit about the mistake it refuses. A text layer's fidelity is `null`:
 * UNDETERMINED, STATED (CPDF-10's finding — a layer is authored text and
 * third-party OCR mixed together, ABBYY FineReader in 3 of 14 recent Legistar
 * attachments, and nobody has separated them). An OCR pass is a measured `C`.
 * If a mixed document's cap came out `C`, that null would have been quietly
 * RESOLVED INTO A LETTER for the layer pages — and downstream that is not a
 * cosmetic difference: `gradeCeiling` reads a null cap as "undetermined, which
 * is a statement, not a permission" and a `C` as permission up to C. The merge
 * would have handed a leg citing an unmeasured text layer a ceiling nobody
 * measured. `null` is not a weaker letter. It is the absence of one, and it
 * stays that way.
 *
 * NOTE THE ASYMMETRY WITH "A STEP WITH NO CAP NEITHER RAISES NOR LOWERS", which
 * is the landed rule for an UNSCOPED step and is not disturbed here. An unscoped
 * unmeasured step sits in sequence over text another step DID measure, so that
 * measurement still bounds it. A SCOPED unmeasured step covers text no other
 * step measured at all. Sequence and partition are different questions and this
 * module now asks them separately. */

/** What a derivation step covers: the string "all", the string "unreadable", or
 *  an array of 0-based page numbers. Never throws and never guesses. */
/** @typedef {"all" | "unreadable" | number[]} Covers what a step covers: every page, none this module can name, or those pages */
/** @param {Step} step @returns {Covers} */
function extentOf(step) {
  const e = step.extent;
  if (e == null) return "all";
  if (!e || typeof e !== "object" || Array.isArray(e) || e.kind !== "pages") return "unreadable";
  const pages = e.pages, part = e.part;
  if (Array.isArray(pages) && pages.length && pages.every((p) => Number.isInteger(p) && p >= 0)
      /* D-723: a `part` that is present must be a readable index, or the extent is unreadable. */
      && (part === undefined || (Number.isInteger(part) && part >= 0)))
    return pages;
  return "unreadable";
}

/* D-723 — WHICH PART A SCOPED STEP BELONGS TO. While a document's parts PARTITION its pages a part
   is named by its page list. Two parts may list the same page (a folio decoded from the layer and an
   OCR transcription over the same pages), and may even list the same pages exactly; `mergedChain`
   then stamps each part's index as `extent.part`, and a part is named by that index. A partitioned
   chain carries no `part` and is named by its pages, as before. */
/** @param {Step} step a scoped step @param {readonly number[]} pages its pages (`extentOf`) @returns {string} */
function partKeyOf(step, pages) {
  const e = step.extent;
  const part = e && e.kind === "pages" ? e.part : undefined;
  return Number.isInteger(part) ? `#${String(part)}` : pages.join(",");
}

/** "page 4" / "pages 1-3" / "pages 1-2, 5" — contiguous runs collapsed, because
 *  a scanned exhibit is a RUN of pages and a chain sentence listing forty of
 *  them individually is one nobody reads. The stored numbers are 0-based; the
 *  SENTENCE spells them as a reader counts (R39, G141): stored 0 reads "page 1". */
/** @param {readonly number[]} pages @returns {string} */
function pageList(pages) {
  /** @type {[number, number][]} */
  const runs = [];
  for (const p of pages) {
    const last = runs[runs.length - 1];
    if (last && p === last[1] + 1) last[1] = p; else runs.push([p, p]);
  }
  return `${pages.length === 1 ? "page" : "pages"} `
       + runs.map(([a, b]) => (a === b ? `${a + 1}` : `${a + 1}-${b + 1}`)).join(", ");
}

/** Does this step cover this page? An unscoped step covers every page; an
 *  unreadable extent covers none. Exported because the wire and the suite both
 *  need to ask it, and a second implementation of it would be D-164's lesson. */
/** @param {unknown} step @param {unknown} page @returns {boolean} */
export function stepCovers(step, page) {
  if (!step || !isStep(step)) return false;
  const ext = extentOf(step);
  if (ext === "all") return true;
  if (ext === "unreadable") return false;
  return Number.isInteger(page) && typeof page === "number" && ext.includes(page);
}

/** Build a document's chain from the chains of its PARTS.
 *
 *  `parts` is `[{ chain, pages }]` — one entry per stretch of the document with
 *  its own provenance. Each part's chain is stamped with the pages it covers and
 *  the parts are CONCATENATED — deliberately not appended through `appendStep`,
 *  because rule 2's monotone comparison is about a step extending what it
 *  RECEIVED, and one part did not receive the other. Rule 2 still holds WITHIN
 *  each part: every part arrives here already built by `appendStep`.
 *
 *  THE FUNCTION IS TOTAL, and the two degenerate cases are the point rather than
 *  defensive padding, because they are the cases that occur:
 *
 *    NO parts  -> `null`. No text surface answered, so there is no chain to
 *                 record — which is a different fact from an empty chain and is
 *                 what the wire already carries for a document it never read.
 *    ONE part  -> that part's chain, UNSCOPED and unchanged. A document with one
 *                 provenance is not a mixed document, and scoping its only chain
 *                 to "all its pages" would dress a whole document as a partition
 *                 and quietly change what every chain written before D-252 says.
 *                 This is why a wholly-scanned document and a wholly-text-layer
 *                 one record exactly what they recorded before this rule existed.
 *
 *  A refusal from `checkChain` is returned as-is, so a malformed part cannot
 *  become half a chain. */
/** @param {unknown} parts `[{chain, pages}]` @returns {Chain | Refusal | null} */
export function mergedChain(parts) {
  if (!isList(parts) || parts.length === 0) return null;
  /* Each part's chain, `part && part.chain`, and its pages, deduplicated and sorted. */
  const chains = parts.map((part) => (!part ? part : isFields(part) ? part.chain : undefined));
  if (parts.length === 1) {
    const only = chains[0];
    const bad = isKnownChain(only) ? null : checkChain(only);
    if (bad) return bad;
    return isChecked(only) ? remember(only) : null;
  }
  const pageLists = parts.map((part) => {
    if (!isFields(part)) return [];
    const listed = part.pages;
    return isList(listed)
      ? [...new Set(listed.flatMap((p) => (Number.isInteger(p) && typeof p === "number" && p >= 0 ? [p] : [])))].sort((a, b) => a - b)
      : [];
  });
  /** @type {Chain} */
  const out = [];
  /* D-723: do any two parts share a page? Only then is each part's index stamped (`partKeyOf`). */
  /** @type {Set<number>} */
  const seen = new Set();
  let overlap = false;
  for (const pages of pageLists)
    for (const p of pages) { if (seen.has(p)) overlap = true; seen.add(p); }
  for (let index = 0; index < chains.length; index++) {
    const chain = chains[index];
    const bad = isKnownChain(chain) ? null : checkChain(chain);
    if (bad) return bad;
    if (!isChecked(chain)) return null;
    const pages = pageLists[index] ?? [];
    for (const step of chain) {
      /* A VERIFICATION step is copied through UNSCOPED. Attestation carries its
         own extent, checked by `extentCovers`, and stamping a second one on it
         would give one fact two homes that can disagree. */
      out.push(kindOf(step.step)?.role === "derivation"
        ? { ...step, extent: overlap ? partExtent(pages, index) : pagesExtent(pages) }
        : { ...step });
    }
  }
  return remember(out);
}
/** @param {number[]} pages @returns {PagesExtent} */
const pagesExtent = (pages) => ({ kind: "pages", pages });
/** @param {number[]} pages @param {number} part @returns {PagesExtent} */
const partExtent = (pages, part) => ({ kind: "pages", pages, part });

/* =========================================================================
 * CPDF-10 — THE TRANSCRIPTION PROVENANCE CHAIN'S REFUSALS (C-35, DEC-49).
 *
 * The family for this module, held here since T18 (K629, K630; it moved
 * whole from the check catalogue, `legacy-checks`), and it is worth saying what these
 * conditions have in common because it is not "OCR went wrong". Every one of
 * them refuses a claim the record could not support LATER, at the moment it is
 * made — a chain that collapsed to a label, a derivation that claimed to have
 * improved what it received, a confidence number with nothing behind it, a
 * region nobody could read offered as text anyway, an attestation with no
 * person or no scope behind it. None of them is about accuracy. All of them
 * are about the record claiming more than it can support, which CLAUDE.md
 * ranks above a missing feature and far above an ugly one.
 *
 * THE TRANSLATIONS ARE WRITTEN FOR A MEMBER LOOKING AT A SCANNED DOCUMENT,
 * because that is who receives them: op=attesttext is a member-facing act, and
 * the chain refusals surface wherever a caller composes provenance by hand.
 *
 * C-35 IS THIS FAMILY, minted with the old process's `node tools/mintid.mjs C`
 * (floor C-34; that tool was retired in T19) — not measured free by hand,
 * because seven items collided on a hand-measured id in one day and every one
 * of them was right when it looked.
 * ========================================================================= */
/** @type {TextChainChecks} */
export const TEXT_CHAIN_CHECKS = {
  /* RULE 1. The condition this family exists for. `text_source: "ocr"` is what
     a careful author writes and it is still a loss: the engine is gone, and an
     engine is what a calibration is OF (CPDF-13) and what a re-run would need. */
  TEXT_CHAIN_COLLAPSED: {
    check: 'C-35.1',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_COLLAPSED"),
  },
  TEXT_CHAIN_EMPTY: {
    check: 'C-35.2',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_EMPTY"),
  },
  TEXT_CHAIN_STEP_SHAPE: {
    check: 'C-35.3',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word('refusal.TEXT_CHAIN_STEP_SHAPE'),
  },
  TEXT_CHAIN_STEP_UNKNOWN: {
    check: 'C-35.4',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_STEP_UNKNOWN"),
  },
  /* Rule 1 arriving one level down: the chain is an array and one of its
     entries is still just a label. */
  TEXT_CHAIN_STEP_UNNAMED: {
    check: 'C-35.5',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_STEP_UNNAMED"),
  },
  /* RULE 2, and the translation carries the distinction the rule turns on,
     because the member who trips this will believe they improved the text —
     and they will be right about readability. */
  TEXT_CHAIN_STRENGTHENS: {
    check: 'C-35.6',
    where: 'src/textchain.mjs appendStep > is-text-chain-monotone',
    translation: word("refusal.TEXT_CHAIN_STRENGTHENS"),
  },
  /* RULE 3. Note the fence is on the BASIS, not on the number: a self-reported
     0.99 and a computed 0.99 are the same bytes. */
  TEXT_CONFIDENCE_PSEUDO: {
    check: 'C-35.7',
    where: 'src/textchain.mjs checkConfidence > is-text-region-confidence',
    translation: word("refusal.TEXT_CONFIDENCE_PSEUDO"),
  },
  TEXT_CONFIDENCE_SHAPE: {
    check: 'C-35.8',
    where: 'src/textchain.mjs checkConfidence > is-text-region-confidence',
    translation: word("refusal.TEXT_CONFIDENCE_SHAPE"),
  },
  /* The anchor. Without it there is no way to point a reader at the pixels, and
     an unverifiable transcription is the thing this item refuses to ship. */
  TEXT_ANCHOR_MISSING: {
    check: 'C-35.9',
    where: 'src/textchain.mjs checkAnchor > is-text-anchor',
    translation: localize("text-chain.textchain.text_a_machine_read_off", "Text a machine read off an image has to say WHERE on the page it came from, so anyone can look at that part of the scan and see for themselves. Without it the reading cannot be checked against the document at all."),
  },
  /* Attestation, (a): a member act, refusable to a machine credential. */
  TEXT_ATTEST_MACHINE: {
    check: 'C-35.10',
    where: 'src/textchain.mjs checkAttestation > is-text-attestation',
    translation: word("refusal.TEXT_ATTEST_MACHINE"),
  },
  /* Attestation, (b): scoped to what was actually checked. */
  TEXT_ATTEST_EXTENT: {
    check: 'C-35.11',
    where: 'src/textchain.mjs checkAttestation > is-text-attestation',
    translation: word("refusal.TEXT_ATTEST_EXTENT"),
  },
  /* CPDF-13 / D-253. The calibration REFERENCE, and note carefully what this
     row does NOT refuse: a step with a `cap` and no calibration is the
     pre-CPDF-13 shape and is LEGAL — every chain written before this rule
     existed is that shape, and refusing it would be a fence tighter than its
     rule wearing the costume of caution. What is refused is a reference that is
     PRESENT AND UNREADABLE, because an unresolvable pointer is worse than an
     absent one: it looks like a binding and joins to nothing. */
  TEXT_CHAIN_CAL_REF: {
    check: 'C-35.12',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_CAL_REF"),
  },
  /* CAP-10 / DEC-75 / IC-122. A step kind that declares its letter must be
     CALIBRATED (`STEP_KINDS[k].letter`) — `convert`, a conversion the serving
     host made before any text was read, and `ai_transcription`, an AI's reading
     of a page that is only a picture (R104) — may carry a letter only
     beside the calibration it rests on. The permitted move is UNDETERMINED
     now, raised later by a calibration row (CAP-11 measures, a row raises);
     a letter written now and lowered later is the move Bob's 5.8 forbids. */
  TEXT_CHAIN_LETTER_UNCALIBRATED: {
    check: 'C-35.13',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_LETTER_UNCALIBRATED"),
  },
  /* REC-87 / IC-127. A step kind whose letter is NEVER written on the step
     (`STEP_KINDS[k].letter === "never"`) — today only `typed`, a member typing
     a portion's text (Bob's 5.2). A person has no calibration, so the one route
     to a letter is a SECOND member's attestation; a letter on the step would be
     the typist grading their own work. */
  TEXT_CHAIN_LETTER_ON_PERSON: {
    check: 'C-35.14',
    where: 'src/textchain.mjs checkChain > is-text-chain-shape',
    translation: word("refusal.TEXT_CHAIN_LETTER_ON_PERSON"),
  },
};

/* ------------------------------------------------------------------ *
 * Refusals — DEC-49. One row per condition in TEXT_CHAIN_CHECKS, the code a
 * STRING LITERAL at its site, so the guard can see it.
 * ------------------------------------------------------------------ */

/** @param {TextChainCode} key @param {string} detail @returns {Refusal} */
function refusal(key, detail) {
  const row = TEXT_CHAIN_CHECKS[key];
  return { ok: false, code: key, check: row.check, translation: row.translation, detail };
}

/* Rank helpers. A grade's STRENGTH is its position in BASIS_GRADES (A strongest
   at index 0), so "weaker" is a HIGHER index. Read from the imported array
   rather than written down, so the letters have exactly one home. */
/** @param {unknown} letter @returns {number | null} */
function rank(letter) {
  const i = typeof letter === "string" ? BASIS_GRADES.indexOf(letter) : -1;
  return i < 0 ? null : i;
}
/** The weaker of two grade letters, or null if either is unknown. Undetermined
 *  is first-class: an unknown letter does NOT silently become the other one. */
/** @param {unknown} a @param {unknown} b @returns {string | null} a `BASIS_GRADES` letter */
export function weaker(a, b) {
  const ra = rank(a), rb = rank(b);
  if (ra == null || rb == null || typeof a !== "string" || typeof b !== "string") return null;
  return ra >= rb ? a : b;
}

/* ------------------------------------------------------------------ *
 * Building a chain
 * ------------------------------------------------------------------ */

/** Is this a well-formed chain? An ARRAY of at least one step object, each
 *  naming a known kind. A STRING is the case rule 1 exists for and is called
 *  out by name in the refusal, because "text_source: 'ocr'" is exactly what a
 *  well-meaning caller writes. */
/** @param {unknown} chain @returns {Refusal | null} */
export function checkChain(chain) {
  /* DEC-49 REGION is-text-chain-shape
     Rule 1. The order matters: the collapsed case is judged BEFORE the generic
     shape complaint, so a caller who wrote a label gets the sentence about
     labels rather than "expected an array". */
  if (typeof chain === "string")
    return refusal("TEXT_CHAIN_COLLAPSED",
      localize("text-chain.textchain.text_source_is_chain_a", "text_source is '{chain}', a single label. A transcription's provenance is a CHAIN — each step naming what performed it — because 'ocr' does not say which engine, and an engine is what a re-run and a calibration are OF", { chain: String(chain) }));
  if (!isList(chain) || chain.length === 0)
    return refusal("TEXT_CHAIN_EMPTY",
      localize("text-chain.textchain.a_transcription_must_name_at", "a transcription must name at least one step that produced it; {v1} was given, and text with no stated provenance is indistinguishable from text a publisher typed", { v1: String(chain == null ? "nothing" : "an empty chain") }));
  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    if (!step || !isFields(step) || Array.isArray(step))
      return refusal("TEXT_CHAIN_STEP_SHAPE", localize("text-chain.textchain.step_i_is_not_an", "step {i} is not an object", { i: String(i) }));
    const name = step.step;
    const kind = kindOf(name);
    if (!kind)
      return refusal("TEXT_CHAIN_STEP_UNKNOWN",
        localize("text-chain.textchain.step_i_is_v1_which", "step {i} is '{v1}', which is not one of {keys}. A step nobody classified is neither a derivation nor a verification, and this record will not guess which", { i: String(i), v1: String(name == null ? "(absent)" : String(name)), keys: String(Object.keys(STEP_KINDS).join(", ")) }));
    /* An OCR or AI step that does not name what performed it is the collapse of
       rule 1 arriving one level down: the chain is an array, and one of its
       entries is still just a label. */
    const engine = step.engine;
    if ((name === "ocr" || name === "ai") && !(typeof engine === "string" && engine))
      return refusal("TEXT_CHAIN_STEP_UNNAMED",
        localize("text-chain.textchain.the_step_step_names_no", "the {step} step names no engine. What performed a derivation is the fact the chain exists to carry — a calibration is OF an engine and a version, and neither can be recovered from the word '{step_2}'", { step: String(name), step_2: String(name) }));
    /* CAP-10 / IC-122: a kind that DECLARES the fields it must name. Read from
       `STEP_KINDS`, so the rule follows the kind rather than a spelling. */
    const mustName = kind.names || [];
    const unnamed = mustName.filter((f) => { const v = step[f]; return !(typeof v === "string" && v.trim()); });
    if (unnamed.length)
      return refusal("TEXT_CHAIN_STEP_UNNAMED",
        localize("text-chain.textchain.the_step_step_does_not", "the {step} step does not name its {unnamed}. Who performed a derivation, and what it produced, are the facts the chain exists to carry — a calibration is OF a named producer and format, and neither can be recovered from the word '{step_2}'", { step: String(name), unnamed: String(unnamed.join(" or ")), step_2: String(name) }));
    /* CPDF-13 / D-253 — THE CALIBRATION REFERENCE. Optional, and read the
       comment on `TEXT_CHAIN_CAL_REF` above for why it is optional rather than
       required: every chain written before this rule existed carries a `cap`
       and no calibration, and refusing those would be a fence tighter than its
       rule. What is refused is a reference PRESENT AND UNREADABLE, because an
       unresolvable pointer looks like a binding and joins to nothing — which is
       strictly worse than the honest absence `measured_by`'s free string
       already is. */
    const calibration = step.calibration;
    const calibrated = typeof calibration === "string" && calibration.trim();
    if (calibration != null && !calibrated)
      return refusal("TEXT_CHAIN_CAL_REF",
        localize("text-chain.textchain.step_i_names_a_calibration", "step {i} names a calibration that is not a readable identifier ({stringify}). A transcription names the MEASUREMENT its grade rests on so a superseded measurement can name exactly the transcriptions resting on it; a pointer nothing can resolve breaks that join while looking like it works", { i: String(i), stringify: String(JSON.stringify(calibration)) }));
    /* CAP-10 / DEC-75: a kind whose letter must be CALIBRATED may carry one only
       beside the calibration it rests on. An unmeasured step may not claim a
       letter — the move Bob's 5.8 forbids is a letter now, lowered later under
       authored legs; the permitted one is undetermined now, raised later by a
       calibration row without a migration. */
    const cap = step.cap;
    if (kind.letter === "calibrated" && cap != null && !calibrated)
      return refusal("TEXT_CHAIN_LETTER_UNCALIBRATED",
        localize("text-chain.textchain.the_step_step_claims_fidelity", "the {step} step claims fidelity {stringify} and names no calibration. A {step_2} step's cap is UNDETERMINED until a measurement of it exists, and a letter written here without one would be the record claiming a fidelity nobody measured", { step: String(name), stringify: String(JSON.stringify(cap)), step_2: String(name) }));
    /* REC-87 / IC-127: a kind whose letter is NEVER a caller's to write (`member`).
       A person's typing has no calibration, so a letter here could only be the
       transcriber grading their own act — the equality that costs nothing, one
       altitude below the attestation fence that refuses the same thing by name. */
    if (kind.letter === "never" && cap != null)
      return refusal("TEXT_CHAIN_LETTER_ON_PERSON",
        localize("text-chain.textchain.the_step_step_claims_fidelity_2", "the {step} step claims fidelity {stringify}. What a member typed is UNDETERMINED until a SECOND member attests it against the page; a letter on the step itself would be the typist grading their own work", { step: String(name), stringify: String(JSON.stringify(cap)) }));
  }
  /* END DEC-49 REGION is-text-chain-shape */
  return null;
}
/** A non-empty list, which `checkChain` has just cleared (R4-R11): read as this module's chain.
 *  @param {unknown} x @returns {x is Chain} */
const isChecked = (x) => isList(x) && x.length > 0;
/** A plain object, which `checkChain` has just cleared as a step (R7-R11) or a caller hands over as one: read as this
 *  module's step. @param {unknown} x @returns {x is Step} */
const isStep = (x) => isFields(x);

/* R106 — A CHAIN THIS MODULE RETURNED IS KNOWN WELL-FORMED, and what is known of it is remembered, so that
   appending to it does work in the new step alone. `KNOWN` maps a returned array to `{len, last, acc}`: its length
   and last step (an array pushed to or truncated since it was returned is no longer the array that was checked, and
   is checked whole again), and `acc`, the running state of `derivationCap`'s whole-document question
   (`foldCap`/`capOf`) over its first `acc.len` steps, built on the first append that needs it. One `acc` is shared
   down a line of appends, each advancing it in place; a chain that is no longer the tip of its line (a second append
   to an older chain) finds `acc.len` differs from its own length and rebuilds, so a branch is answered exactly as a
   whole check would answer it. A chain built by hand is in no map and is checked whole, as before. */
/** @typedef {{ len: number, last: unknown, acc: CapAcc | null }} Known what is remembered of a returned chain */
/** @type {WeakMap<object, Known>} */
const KNOWN = new WeakMap();
/** @param {Chain} chain @returns {Known | undefined} */
function known(chain) {
  const k = KNOWN.get(chain);
  return k && k.len === chain.length && k.last === chain[chain.length - 1] ? k : undefined;
}
/** A chain this module returned and nobody has since pushed to or truncated: known well-formed, so `checkChain` is
 *  not asked again (`checkChain`, except that a chain this module returned is not walked again).
 *  @param {unknown} x @returns {x is Chain} */
function isKnownChain(x) {
  if (!isList(x)) return false;
  const k = KNOWN.get(x);
  return !!k && k.len === x.length && k.last === x[x.length - 1];
}
/** @param {Chain} chain @param {CapAcc | null} [acc] @returns {Chain} */
function remember(chain, acc = null) {
  KNOWN.set(chain, { len: chain.length, last: chain[chain.length - 1], acc });
  return chain;
}

/** Append a step, enforcing rule 2. Returns the NEW chain, or a refusal.
 *
 *  THE INPUT CHAIN IS NEVER MUTATED. A caller holding the pre-append chain is
 *  holding what it held; this is the shape a reading assembly wants and it also
 *  means a refused append leaves nothing half-extended.
 *
 *  LINEAR OVER A CHAIN'S LIFE (R106): see `KNOWN`. A chain this module returned is not re-checked and its cap
 *  is not re-derived from every earlier step; the refusals and results are the whole check's. */
/** @param {unknown} chain @param {unknown} step @returns {Chain | Refusal} */
export function appendStep(chain, step) {
  const bad = isKnownChain(chain) ? null : checkChain(chain);
  if (bad) return bad;
  const refused = checkChain([step]);
  if (refused) return refused;
  if (!isChecked(chain) || !isStep(step)) return refusal("TEXT_CHAIN_EMPTY", "");
  const have = chain, one = step;
  const role = kindOf(one.step)?.role;
  const k = known(have);
  const ka = k ? k.acc : null;
  const acc = ka && ka.len === have.length ? ka : foldedAcc(have, k);
  if (role === "derivation") {
    /* DEC-49 REGION is-text-chain-monotone
       RULE 2, and it is computed rather than trusted. The incoming step's cap
       is compared against the cap the chain ALREADY has; a step claiming a
       stronger letter is refused with the sentence that says why, because the
       plausible mistake here is not malice — it is an author who genuinely
       believes their clean-up improved the text. It did. It improved the
       READABILITY. Reliability is bounded by the worst thing that touched it. */
    const held = capOf(acc);
    const cap = one.cap, claimed = rank(cap), against = rank(held);
    if (cap != null && held != null && claimed != null && against != null && claimed < against)
      return refusal("TEXT_CHAIN_STRENGTHENS",
        localize("text-chain.textchain.this_step_step_claims_fidelity", "this {step} step claims fidelity {cap}, stronger than the {have} the chain already carries. A derivation can only weaken what it received: text that was cleaned is more READABLE, not more RELIABLE, and the hazard of this whole capability is output that looks better than its input", { step: String(one.step), cap: String(cap), have: String(held) }));
    /* END DEC-49 REGION is-text-chain-monotone */
  }
  const copy = { ...one };
  /** @type {Chain} */
  const out = [...have, copy];
  foldCap(acc, copy);
  return remember(out, acc);
}

/** The chain a document's OWN text layer produces (FW-15's case, restated as a
 *  chain). `cap` is the measured fidelity a text layer supports and arrives
 *  from the caller for the reason in the header — it is a measurement. */
/**
 * What a text-layer decode's chain carries (R15); each absent is null.
 * @typedef {Object} LayerArgs
 * @property {number | null} [tier]
 * @property {string | null} [container]
 * @property {string | null} [cap]
 * @property {string | null} [measured_by]
 * @property {string | null} [calibration]
 */
/** @param {LayerArgs | null} [args] @returns {Chain} */
export function layerChain(args) {
  /* Never throws (R83): a `null` or non-object argument is every default, not a TypeError. */
  /** @type {LayerArgs} */
  const none = {};
  const { tier = null, container = null, cap = null, measured_by = null, calibration = null } =
    args && typeof args === "object" ? args : none;
  return remember([{ step: "layer", tier, container, cap, measured_by, calibration }]);
}

/** CAP-10 / DEC-75 / IC-122 — PUT A CONVERSION AT THE HEAD OF A CHAIN.
 *
 *  The chain a reading already built says how text came out of the bytes; a
 *  conversion says how the BYTES came to be, so it goes AHEAD of every step
 *  rather than after the last one — `convert -> layer`, never `layer ->
 *  convert`. That is why this is a separate builder and not `appendStep`.
 *
 *  RULE 2 STILL HOLDS AND IS CHECKED, NOT ASSUMED: every derivation step in the
 *  chain now received the conversion's output, so each is run through
 *  `appendStep([step], s)` — the one monotone comparison this module has, at
 *  its own DEC-49 region — and a step claiming a stronger letter than the
 *  conversion is refused there. With the conversion unmeasured (every Drive
 *  export today) nothing can be stronger than undetermined and no refusal is
 *  possible; the check is what holds the day a calibration raises the step.
 *
 *  The chain is returned WHOLE and UNSCOPED at the head: a conversion is of the
 *  whole document, and a mixed chain's parts (D-252) keep their own extents.
 *  Neither input is mutated. A refusal is returned as-is, so a caller never
 *  holds half a chain. */
/** @param {unknown} step a `convert` step @param {unknown} chain @returns {Chain | Refusal} */
export function convertedChain(step, chain) {
  const refused = checkChain([step]);
  if (refused) return refused;
  const bad = isKnownChain(chain) ? null : checkChain(chain);
  if (bad) return bad;
  if (!isStep(step) || !isChecked(chain)) return refusal("TEXT_CHAIN_EMPTY", "");
  const one = step, have = chain;
  for (const s of have) {
    if (kindOf(s.step)?.role !== "derivation") continue;
    const r = appendStep([one], s);
    if (!isList(r)) return r;
  }
  return remember([{ ...one }, ...have.map((s) => ({ ...s }))]);
}

/* ------------------------------------------------------------------ *
 * CPDF-13 / D-253 — THE CALIBRATION REFERENCE, READ BACK
 * ------------------------------------------------------------------ */

/** Which calibrations does this chain's provenance rest on?
 *
 *  THE ANSWER IS A SET OF IDS AND NOTHING ELSE. This module still holds no
 *  calibration and still knows no engine: it returns the pointers the chain
 *  carries, and `calibration.mjs` plus the store decide what any of them mean.
 *  That boundary is the same one the header states for `cap` — a measurement
 *  must not acquire a second home — and it is why the drift handler lives over
 *  there rather than here.
 *
 *  VERIFICATION STEPS ARE INCLUDED IF THEY CARRY ONE, and none does today. An
 *  attestation rests on a person, not on a measurement, so it has no
 *  calibration to name; walking every step rather than only the derivations is
 *  the shape that stays right if that ever stops being true, and costs nothing
 *  now. What matters for the drift join is that a step naming a calibration is
 *  FOUND, whatever kind it is.
 *
 *  A MALFORMED CHAIN ANSWERS THE EMPTY SET rather than throwing, on
 *  `derivationCap`'s precedent — a reader asking what a broken chain rests on
 *  should get "nothing this record can name", which is true. */
/** @param {unknown} chain @returns {string[]} */
export function calibrationsOf(chain) {
  if (checkChain(chain) || !isChecked(chain)) return [];
  const checked = chain;
  /** @type {string[]} */
  const out = [];
  for (const s of checked) {
    const c = s.calibration;
    if (typeof c === "string" && c.trim() && !out.includes(c)) out.push(c);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Reading a chain
 * ------------------------------------------------------------------ */

/* `derivationCap`'s measured letter of a step, or null. */
/** @param {Step} s @returns {string | null} */
const measuredCap = (s) => { const cap = s.cap; return cap != null && rank(cap) != null ? cap : null; };

/* The whole-document question of `derivationCap`, as a running state a step is folded into once (R106). `cap` is
   the weakest measured letter of the unscoped steps; `parts` each scoped part's own weakest (null while it has
   none), `nullParts` the parts still at null and `weakest` the weakest letter over the parts; `unreadable` an extent
   nobody could read or an unmeasured head conversion; `len` the number of steps folded. */
/**
 * @typedef {Object} CapAcc
 * @property {string | null} cap
 * @property {boolean} unreadable
 * @property {Map<string, string | null>} parts
 * @property {number} nullParts
 * @property {string | null} weakest
 * @property {number} len
 */
/** @returns {CapAcc} */
function newCapAcc() {
  /** @type {Map<string, string | null>} */
  const parts = mapOf([]);
  return { cap: null, unreadable: false, parts, nullParts: 0, weakest: null, len: 0 };
}
/** A fresh state over every step of `chain`, kept on what is remembered of it (R106).
 *  @param {Chain} chain @param {Known | undefined} k @returns {CapAcc} */
function foldedAcc(chain, k) {
  const acc = newCapAcc();
  for (const s of chain) foldCap(acc, s);
  if (k) k.acc = acc;
  return acc;
}
/** @param {CapAcc} acc @param {Step} step @returns {void} */
function foldCap(acc, step) {
  acc.len++;
  const kind = kindOf(step.step);
  if (kind?.role !== "derivation") return;
  const ext = extentOf(step);
  if (ext === "unreadable") { acc.unreadable = true; return; }
  const m = measuredCap(step);
  /* CAP-10 / DEC-75: the kind that declares `unmeasured: "undetermined"` — see `derivationCap`. */
  if (kind.unmeasured === "undetermined" && m == null) acc.unreadable = true;
  if (ext === "all") {
    const was = acc.cap;
    if (m) acc.cap = was == null ? m : weaker(was, m);
    return;
  }
  const key = partKeyOf(step, ext);
  if (!acc.parts.has(key)) { acc.parts.set(key, null); acc.nullParts++; }
  if (m) {
    const was = acc.parts.get(key);
    const now = was == null ? m : weaker(was, m);
    acc.parts.set(key, now);
    if (was == null) acc.nullParts--;
    const weakest = acc.weakest;
    acc.weakest = weakest == null ? now : weaker(weakest, now);
  }
}
/* The answer for the whole document: an unreadable extent, or a part with no measured cap, is undetermined. */
/** @param {CapAcc} acc @returns {string | null} */
function capOf(acc) {
  if (acc.unreadable || acc.nullParts) return null;
  const cap = acc.cap, weakest = acc.weakest;
  if (weakest == null) return cap;
  return cap == null ? weakest : weaker(cap, weakest);
}

/** The strongest transcription fidelity the DERIVATION steps support: the
 *  weakest link, computed here. Returns null when NO derivation step carries a
 *  measured cap — and null means UNDETERMINED, stated, never "fine".
 *
 *  A verification step is skipped deliberately and that is rule 2 holding: see
 *  the header. `gradeCeiling` is where an attestation is allowed to matter. */
/** @param {unknown} chain @param {unknown} [target] `{page}` @returns {string | null} a `BASIS_GRADES` letter */
export function derivationCap(chain, target = null) {
  const bad = isKnownChain(chain) ? null : checkChain(chain);
  if (bad || !isChecked(chain)) return null;
  const checked = chain;
  const asked = target && isFields(target) ? target.page : undefined;
  const page = typeof asked === "number" && isIndex(asked) ? asked : null;
  if (page == null) {
    /* THE WHOLE DOCUMENT: the weakest over the unscoped steps and the parts, and a part with NO measured cap
       makes the whole undetermined — a text layer's `null` is never resolved into an OCR pass's letter (see the
       header of D-252). An extent this module could not read covers nothing it can name, so it could be a stretch
       nothing else measured; and CAP-10: an unmeasured head conversion, whose later steps measured only its
       output, bounds nothing — the flag is shared because the answer is the same sentence. */
    const acc = newCapAcc();
    for (const step of checked) foldCap(acc, step);
    return capOf(acc);
  }
  /** @type {string | null} */
  let cap = null;
  let unreadable = false;
  for (const step of checked) {
    const kind = kindOf(step.step);
    if (kind?.role !== "derivation") continue;
    const ext = extentOf(step);
    if (ext === "unreadable") { unreadable = true; continue; }
    /* CAP-10 / DEC-75 — A KIND THAT DECLARES `unmeasured: "undetermined"`, and
       the one place the sequence rule does NOT hold. That rule says an
       unmeasured step neither raises nor lowers, because the text it touched
       is still bounded by a step that WAS measured. A conversion at the head
       of the chain breaks the premise: every step after it measured the
       CONVERTED text against the CONVERTED bytes, and none of them saw the
       original, so nothing downstream bounds what the conversion lost. An
       unmeasured one therefore makes the answer UNDETERMINED, stated — which
       is also what the item requires of every Drive export until CAP-11's
       measurement lets a calibration row raise it. Today the `layer` step's
       own cap is null too, so this changes no value the record holds; it is
       what keeps the answer honest the day a text-layer letter is measured. */
    if (kind.unmeasured === "undetermined" && measuredCap(step) == null
        && (ext === "all" || ext.includes(page)))
      unreadable = true;
    /* ASKING ABOUT ONE PAGE. Only a step that covers it bounds it — which is
       the read a basis leg citing that page needs, and the reason a mixed
       document is still usable: the OCR'd exhibit answers C and the text-layer
       report answers undetermined, each about itself. */
    if (ext !== "all" && !ext.includes(page)) continue;
    const m = measuredCap(step);
    /** @type {string | null} */
    const was = cap;
    if (m) cap = was == null ? m : weaker(was, m);
  }
  return unreadable ? null : cap;
}

/** Does this chain contain a derivation this record did not author — i.e. is
 *  this text a TRANSCRIPTION rather than something a publisher typed? True for
 *  a text layer too, and that is the point: `pdfstructure.mjs` decodes through
 *  the FILE'S OWN /ToUnicode map, so a text layer is somebody else's
 *  transcription that we have been reading as authored text. */
/** @param {unknown} chain @returns {boolean} */
export function isTranscribed(chain) {
  return !checkChain(chain) && isChecked(chain) && chain.some((s) => kindOf(s.step)?.role === "derivation");
}

/** REC-94 — WHICH EXTRACTION TIERS DOES THIS CHAIN EVIDENCE, AND OVER WHAT?
 *
 *  `OBSERVATION-LOG-DESIGN.md` §4.2 asks for *one row per extraction attempt per
 *  capture per tier*, so the content-level writer has to be able to say which
 *  tiers a persisted reading is evidence of. The chain is the only record of
 *  that: a tier that ran left a step, and a tier that did not run left nothing —
 *  which is the design's own rule that a look not taken is `NEVER_LOOKED` and
 *  `NEVER_LOOKED` is the ABSENCE of a row, arriving one level down.
 *
 *  THE TIER IS A PROPERTY OF THE STEP KIND, DECLARED IN `STEP_KINDS`, AND THIS
 *  FUNCTION MATCHES NO STEP NAME. That is the inversion this module already
 *  makes for `role` and it is made for the same reason: a list of spellings goes
 *  stale the moment a sixth kind is written. Three declared values and each says
 *  a different true thing —
 *
 *    `tier: "step"`  the STEP names its own tier, because the kind spans several
 *                    (a `layer` decode is tier 1 or tier 2 and only the step can
 *                    say which);
 *    `tier: <int>`   the KIND is the tier (pixels and ocr ARE tier 3 — there is
 *                    no tier-3 route that is not an engine over pixels);
 *    `tier: null`    the kind is deliberately NOT a rung on this ladder. `ai` is
 *                    a derivation and `attested` is a verification, and neither
 *                    is a way of getting text OUT of a document — folding either
 *                    into a tier would make SK-8's proposed reading look like a
 *                    fourth extraction tier, which it is not.
 *
 *  AND A KIND THAT DECLARED NOTHING IS NAMED, NEVER SCORED ZERO. A sixth step
 *  kind added without a `tier` key comes back in `unclassified` and the caller
 *  must state it. A thing the matcher does not understand must be NAMED — a
 *  silent zero here would be a tier the frontier cannot see, which is exactly
 *  the false-coverage failure the observation log exists to prevent.
 *
 *  `covers` IS THE STEP'S EXTENT (D-252), so a MIXED document — a text-layer
 *  report with scanned exhibits — answers two tiers, each over its own pages,
 *  and the writer can say `partial` about each rather than PRESENT about the
 *  document. A malformed chain answers the empty set on `derivationCap`'s
 *  precedent, because a reader asking what a broken chain evidences should get
 *  "nothing this record can name", which is true. */
/**
 * One tier a chain evidences (R33): its number (`null` where a step that names its own did not), the steps that
 * ran it, and what they covered together.
 * @typedef {{ tier: number | null | undefined, steps: string[], covers: Covers }} TierEvidence
 */
/** @param {unknown} chain @returns {{ tiers: TierEvidence[], unclassified: string[] }} */
export function tiersEvidenced(chain) {
  if (checkChain(chain) || !isChecked(chain)) return { tiers: [], unclassified: [] };
  const checked = chain;
  /** @type {Map<number | "unrecorded", TierEvidence>} */
  const byTier = mapOf([]);
  /** @type {string[]} */
  const unclassified = [];
  for (const s of checked) {
    const kind = kindOf(s.step);
    if (!kind) continue;
    /* The KEY's presence is the declaration; its VALUE is the answer. `null` is
       a declared answer and `undefined` is no answer at all, and collapsing the
       two is how a kind nobody classified would read as a kind deliberately off
       the ladder. */
    if (!Object.prototype.hasOwnProperty.call(kind, "tier")) {
      if (!unclassified.includes(s.step)) unclassified.push(s.step);
      continue;
    }
    const declared = kind.tier;
    if (declared === null) continue;
    const own = s.tier;
    const t = declared === "step"
      ? (Number.isInteger(own) && typeof own === "number" ? own : null)
      : declared;
    /* A `layer` step whose own `tier` is absent is a tier THIS RECORD DID NOT
       RECORD, and it is carried as `null` rather than dropped: the extraction
       happened and the rung it happened on is undetermined, which is a fact to
       state and not one to discard. */
    const key = t == null ? "unrecorded" : t;
    const prev = byTier.get(key);
    const covers = extentOf(s);
    byTier.set(key, { tier: t, steps: [...(prev ? prev.steps : []), s.step],
                      /* "all" beats a page list: if ANY step of this tier was
                         unscoped, the tier covered the document. Two scoped
                         steps of one tier union their pages. */
                      covers: prev ? unionExtent(prev.covers, covers) : covers });
  }
  /* IN THE ORDER THE ATTEMPTS HAPPENED, WHICH IS THE CHAIN'S ORDER, AND NOT
     SORTED BY TIER NUMBER. A Map keeps insertion order, and the chain is a
     record of WHAT HAPPENED in sequence -- the page became pixels and an engine
     read them, after the layer decode had already had its go. The content-level
     writer walks these CUMULATIVELY, so an order that is not the order of events
     would make each row say the state after a tier that had not run yet. Sorting
     would also be right today by accident (escalation runs 1 -> 2 -> 3) and
     wrong the first time a chain is composed in any other order, which is the
     class of correctness this repository keeps paying for. */
  return { tiers: [...byTier.values()], unclassified };
}

/* Union of two step extents in `extentOf`'s own vocabulary. `all` absorbs
   everything; `unreadable` absorbs a page list, because an extent this record
   cannot parse must never narrow to the part of it that happened to parse —
   `extentCovers`' default-to-not-covering rule pointed the other way. */
/** @param {Covers} a @param {Covers} b @returns {Covers} */
function unionExtent(a, b) {
  if (a === "all" || b === "all") return "all";
  if (a === "unreadable" || b === "unreadable") return "unreadable";
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}

/** Was a machine the last thing to touch this text? The question a projection
 *  asks to keep an OCR'd document distinguishable from a published text layer
 *  at a glance, without re-deriving the chain everywhere. */
/** @param {unknown} chain @returns {string | null} */
export function terminalStep(chain) {
  if (checkChain(chain) || !isChecked(chain)) return null;
  const last = chain[chain.length - 1];
  return last ? last.step : null;
}

/** The word a page read in MORE THAN ONE way answers (BOB #35 09:35Z, BOB #36 11:05Z, D-723). Not a
 *  step kind — no step is `mixed` — so it lives here beside the function that answers it. */
export const CHAIN_KIND_MIXED = "mixed";

/** D-723 — HOW WAS THIS PAGE READ? `target` is `{page}` or a 0-based page number.
 *
 *  Each PART covering the page (`partKeyOf`) answers the kind of its LAST derivation step — `pixels`
 *  then `ocr` is one reading, `ocr` — and the page reads that kind when every covering part agrees and
 *  `mixed` when they differ, so a page two parts share (a folio from the layer, an OCR transcription
 *  appended) reads `mixed` rather than the part appended last. Walked from the END: an unscoped step
 *  met first read every page last and answers alone; one met after a covering part is history the
 *  parts came after and ends the walk. A verification step is not how the text was produced and is
 *  never the answer. UNDETERMINED (`null`), stated, for a malformed chain, a target with no page, a
 *  page no derivation step covers, or any step whose extent this module cannot read (R30's rule: it
 *  could be a part covering this page). `terminalStep` is unchanged and stays document-level. */
/** @param {unknown} chain @param {unknown} target `{page}` or a page number @returns {string | null} a step kind, or `"mixed"` */
export function chainKindFor(chain, target) {
  if (checkChain(chain) || !isChecked(chain)) return null;
  const checked = chain;
  const want = Number.isInteger(target) ? target : target && isFields(target) ? target.page : undefined;
  if (typeof want !== "number" || !isIndex(want)) return null;
  const derivations = checked.filter((s) => kindOf(s.step)?.role === "derivation");
  if (derivations.some((s) => extentOf(s) === "unreadable")) return null;
  /** @type {Map<string, string>} */
  const byPart = mapOf([]);
  for (let i = derivations.length - 1; i >= 0; i--) {
    const d = derivations[i];
    if (!d) continue;
    const ext = extentOf(d);
    if (ext === "all") {
      if (!byPart.size) return d.step;
      break;
    }
    if (ext === "unreadable") continue;
    const key = partKeyOf(d, ext);
    if (ext.includes(want) && !byPart.has(key)) byPart.set(key, d.step);
  }
  if (!byPart.size) return null;
  const kinds = [...new Set(byPart.values())];
  const only = kinds[0];
  return kinds.length === 1 && only !== undefined ? only : CHAIN_KIND_MIXED;
}

/** A one-line human sentence for the whole chain. Composed FROM the chain, so
 *  it cannot describe a chain other than the one it was given — the drift that
 *  a hand-written summary beside a structured field always eventually has. */
/** @param {unknown} chain @returns {string} */
export function describeChain(chain) {
  if (checkChain(chain) || !isChecked(chain)) return word("textchain.text.text_provenance_recorded");
  const checked = chain;
  return checked.map((s) => {
    const kind = kindOf(s.step);
    const base = kind ? kind.label : "";
    /* CAP-10: a kind that declares a `format` says what it produced, beside who
       produced it — "(google-export to odt)". Every other kind's sentence is the
       sentence it was. */
    const format = s.format, engine = s.engine, version = s.version, member = s.member, at = s.at;
    const into = ((kind && kind.names) || []).includes("format") && format ? ` to ${format}` : "";
    const who = engine ? ` (${engine}${version ? ` ${version}` : ""}${into})` : "";
    /* REC-87: a `typed` step says WHO typed, beside the label, as `attested` does. */
    const by = (s.step === "attested" || s.step === "typed") && member
      ? ` (${member}${at ? `, ${at}` : ""})` : "";
    /* D-252: a SCOPED step says which pages it covers, and it has to. Without
       it a mixed document's chain reads as a sequence — "the text layer was
       turned into pixels and OCR'd" — which is not what happened to any page
       in it. An unscoped step says nothing extra, so every sentence written
       before this rule is the sentence it was. */
    const ext = extentOf(s);
    const over = kind && kind.role === "derivation" && ext !== "all"
      ? (ext === "unreadable" ? " (over an extent this record cannot read)" : ` (${pageList(ext)})`)
      : "";
    return base + who + by + over;
  }).join(" -> ");
}

/* ------------------------------------------------------------------ *
 * Per-region confidence, and the floor
 * ------------------------------------------------------------------ */

/** Check one region's confidence declaration. `confidence` is either the
 *  literal string "none" — first-class, stated, what a confidence-less engine
 *  honestly reports — or `{ value:<0..1>, basis:"engine" }`.
 *
 *  THE FENCE IS ON `basis`, NOT ON `value`, and that is the whole design: a
 *  self-reported 0.99 and a computed 0.99 are the same bytes. Only who
 *  produced it tells them apart, so only that is checked. */
/** @param {unknown} confidence @returns {Refusal | null} */
export function checkConfidence(confidence) {
  /* DEC-49 REGION is-text-region-confidence */
  if (confidence === "none") return null;
  if (!confidence || !isFields(confidence))
    return refusal("TEXT_CONFIDENCE_SHAPE",
      localize("text-chain.textchain.a_region_confidence_is_either", "a region's confidence is either the stated string 'none' or {value, basis}; an absent confidence is not the same claim as a stated absent one"));
  const basis = confidence.basis;
  if (!hasKey(CONFIDENCE_BASES, basis))
    return refusal("TEXT_CONFIDENCE_PSEUDO",
      localize("text-chain.textchain.confidence_basis_v1_is_not", "confidence basis '{v1}' is not {keys}. A number a model reported about itself is not a calibrated confidence and may not be thresholded as one — it costs nothing to produce, which is exactly what makes it worthless as evidence", { v1: String(basis == null ? "(absent)" : String(basis)), keys: String(Object.keys(CONFIDENCE_BASES).join(" or ")) }));
  const value = confidence.value;
  if (basis === "engine"
      && !(typeof value === "number" && value >= 0 && value <= 1))
    return refusal("TEXT_CONFIDENCE_SHAPE",
      `an engine-computed confidence carries a value in 0..1; got `
      + `${value == null ? "nothing" : String(JSON.stringify(value))}`);
  /* END DEC-49 REGION is-text-region-confidence */
  return null;
}

/** Rule 4. Walk regions and REPLACE any whose engine-computed confidence falls
 *  below `floor` with a stated `undetermined` — DISCARDING the text.
 *
 *  Three things this does that a naive version would not:
 *
 *  - IT DELETES THE TEXT. A best guess kept in a field beside its own warning
 *    is one careless join away from being read as content, and this project's
 *    whole threat model is the record claiming more than it can support.
 *  - A region whose confidence is the stated `none` is NOT floored out. It has
 *    no number to compare, so flooring it would be inventing a judgement; the
 *    engine's measured CAP is what carries a confidence-less engine (DEC-35's
 *    own named alternative, and what CPDF-11's ladder returned).
 *  - A region whose confidence declaration is REFUSED is not silently dropped
 *    and not silently kept: it becomes undetermined carrying the refusal's own
 *    detail, so a pseudo-confidence attempt is visible in the output rather
 *    than merely rejected somewhere upstream.
 *
 *  Returns { regions, floored, undetermined } — `floored` counted so a caller
 *  can state the shortfall on a reading's basis rather than implying a clean
 *  read (FW-15's partial-decode honesty rule, applied one layer up). */
/**
 * A region's confidence (R40-R43): the stated "none", or a number and who produced it.
 * @typedef {"none" | { basis: "engine" | "none", value?: number }} Confidence
 */
/**
 * One region of a reading (R44-R46), with whatever else it carries, which is kept.
 * @typedef {Object} Region
 * @property {string | null} [text]
 * @property {Confidence} [confidence]
 * @property {Anchor} [source]
 * @property {true} [undetermined]
 * @property {string} [why]
 */
/** @param {unknown} regions @param {unknown} floor @returns {{ regions: Region[], floored: number, undetermined: number }} */
export function applyConfidenceFloor(regions, floor) {
  /** @type {Region[]} */
  const out = [];
  let floored = 0, undetermined = 0;
  if (!isList(regions)) return { regions: out, floored, undetermined };
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    /** @type {Region} */
    const none = {};
    const region = r && isRegion(r) ? r : none;
    const bad = checkConfidence(region.confidence);
    if (bad) {
      out.push(undeterminedRegion(region, bad.detail));
      floored++; undetermined++;
      continue;
    }
    const c = region.confidence;
    if (c && c !== "none" && typeof floor === "number" && Number(c.value) < floor) {
      out.push(undeterminedRegion(region,
        word("textchain.undetermined_region.region_decoded_against", { value: String(c.value), floor: String(floor) })));
      floored++; undetermined++;
      continue;
    }
    out.push({ ...region });
  }
  return { regions: out, floored, undetermined };
}

/* The text is DROPPED, not carried. `source` (the image-region anchor) is
   KEPT, and keeping it is the useful half: a reader or an attester can still
   be pointed at the exact pixels nobody could read, which is what makes an
   undetermined region actionable rather than merely absent. */
/** A plain object, read as a region (R44). @param {unknown} x @returns {x is Region} */
const isRegion = (x) => isFields(x);
/** @param {Region} region @param {string} why @returns {Region} */
function undeterminedRegion(region, why) {
  /** @type {Region} */
  const rest = { ...region };
  delete rest.text;
  delete rest.confidence;
  return { ...rest, text: null, undetermined: true, why, confidence: "none" };
}

/* ------------------------------------------------------------------ *
 * The image-region anchor
 * ------------------------------------------------------------------ */

/** The anchor a basis leg resting on OCR'd text must carry: page + rect, in
 *  I2's OWN tagged-union shape (IC-1, `{kind:"pdf-page", ref, page, rect}`).
 *
 *  IMPORTED SHAPE, NOT A NEW ONE. I2 already carries `source` for exactly this
 *  — an element reference into a page — and D-164's lesson is that solving one
 *  problem twice produces two answers that disagree. So this validates I2's
 *  shape rather than defining a rival. */
/** @param {unknown} source @returns {Refusal | null} */
export function checkAnchor(source) {
  /* DEC-49 REGION is-text-anchor */
  if (!source || !isFields(source))
    return refusal("TEXT_ANCHOR_MISSING",
      localize("text-chain.textchain.a_machine_reading_carries_its_anchor", "text produced by a machine carries the image region a reader can check it against; without one, nothing in the record can be verified against the pixels it came from"));
  if (source.kind !== "pdf-page")
    return refusal("TEXT_ANCHOR_MISSING",
      localize("text-chain.textchain.the_anchor_names_kind_string", "the anchor names kind '{String}'; a transcription's anchor is a pdf-page reference (I2 IC-1), because that is the arm carrying page and rect", { String: String(String(source.kind)) }));
  const page = source.page, rect = source.rect;
  if (!Number.isInteger(page) || typeof page !== "number" || page < 0)
    return refusal("TEXT_ANCHOR_MISSING", localize("text-chain.textchain.the_anchor_names_no_page", "the anchor names no page (0-based integer required)"));
  if (!isList(rect) || rect.length !== 4
      || !rect.every((n) => typeof n === "number" && Number.isFinite(n)))
    return refusal("TEXT_ANCHOR_MISSING",
      localize("text-chain.textchain.the_anchor_names_no_rect", "the anchor names no rect; a page alone is not a region a reader can be pointed at"));
  /* END DEC-49 REGION is-text-anchor */
  return null;
}

/* ------------------------------------------------------------------ *
 * Attestation
 * ------------------------------------------------------------------ */

/** Check an attestation before it is recorded. TWO rules, and they are
 *  different rules that a single "is this valid" would have blurred:
 *
 *  (a) IT IS A MEMBER ACT, REFUSABLE TO A MACHINE CREDENTIAL. Attestation is a
 *      person saying "I looked at the image and this text is what it says".
 *      There is no version of that a token can perform, and letting one would
 *      put a claim on the record that nobody holds. The predicate is
 *      `isMachineIdentity`, IMPORTED — this file does not get its own opinion
 *      about what a machine looks like, because REC-46 measured what eleven
 *      hand-typed copies of that question cost.
 *
 *  (b) IT IS SCOPED TO WHAT WAS ACTUALLY CHECKED. An extent is required and
 *      must be one this module can evaluate. An attestation with no extent
 *      would be read as covering the document — the generous direction, which
 *      this project treats as the worse one. */
/** @param {unknown} att `{member, at, extent}` @returns {Refusal | null} */
export function checkAttestation(att) {
  const member = isFields(att) ? att.member : undefined;
  /* DEC-49 REGION is-text-attestation
     (a) FIRST. Who is asking is judged before what they asked for, so a
     machine credential is refused for BEING a machine rather than for the
     shape of an extent it should never have been composing. */
  if (isMachineIdentity(member))
    return refusal("TEXT_ATTEST_MACHINE",
      localize("text-chain.textchain.string_is_a_machine_credential", "'{String}' is a machine credential. Attesting is a person saying they checked this text against the image — an act with a name behind it. A machine cannot perform it, and recording one would put a claim on the record that nobody holds", { String: String(String(member)) }));
  if (!(typeof member === "string" && member.trim()))
    return refusal("TEXT_ATTEST_MACHINE",
      localize("text-chain.textchain.an_attestation_names_no_member", "an attestation names no member. Nobody said this, and unattributed is not the same as attested"));
  /* A member was read from it, so it is an object. */
  if (!isFields(att))
    return refusal("TEXT_ATTEST_MACHINE",
      localize("text-chain.textchain.an_attestation_names_no_member", "an attestation names no member. Nobody said this, and unattributed is not the same as attested"));
  const at = att.at;
  if (!(typeof at === "string" && at.trim()))
    return refusal("TEXT_ATTEST_EXTENT", localize("text-chain.textchain.an_attestation_carries_the_date", "an attestation carries the date it was made"));
  const e = att.extent;
  if (!e || !isFields(e) || !hasKey(EXTENT_KINDS, e.kind))
    return refusal("TEXT_ATTEST_EXTENT",
      localize("text-chain.textchain.an_attestation_is_scoped_to", "an attestation is scoped to what was actually checked — one of {keys}. An unscoped attestation would be read as covering the whole document, which is the generous reading of a claim nobody made", { keys: String(Object.keys(EXTENT_KINDS).join(", ")) }));
  const page = e.page;
  if (e.kind === "page" && !(Number.isInteger(page) && typeof page === "number" && page >= 0))
    return refusal("TEXT_ATTEST_EXTENT", localize("text-chain.textchain.a_page_extent_names_which_page", "a page extent names which page (0-based)"));
  if (e.kind === "region") {
    const bad = checkAnchor(e.source);
    if (bad) return refusal("TEXT_ATTEST_EXTENT",
      localize("text-chain.textchain.a_region_extent_names_the", "a region extent names the region that was checked: {detail}", { detail: String(bad.detail) }));
  }
  /* END DEC-49 REGION is-text-attestation */
  return null;
}

/** Does `extent` cover `target`? THE DEFAULT IS NO.
 *
 *  This is the rule "a leg citing outside the attested extent does not inherit
 *  it", and every unreadable, unparseable or unrecognised case answers FALSE —
 *  because the failure that matters is an extent nobody could evaluate quietly
 *  reading as "all of it", which is how a member's careful check of one
 *  paragraph would come to underwrite a whole scanned budget book. */
/** @param {unknown} extent an attestation's extent @param {unknown} target `{page, rect?}` @returns {boolean} */
export function extentCovers(extent, target) {
  if (!extent || !isFields(extent)) return false;
  if (!target || !isFields(target)) return false;
  if (!hasKey(EXTENT_KINDS, extent.kind)) return false;
  if (extent.kind === "document") return true;
  const page = target.page;
  if (!Number.isInteger(page) || typeof page !== "number" || page < 0) return false;
  if (extent.kind === "page") return extent.page === page;
  /* region: the target must sit INSIDE the attested rect, on the same page.
     A target with no rect at all is not covered — "somewhere on that page" is
     not what the member checked. */
  const src = extent.source;
  if (!src || !isFields(src) || src.page !== page) return false;
  /* Both rects are read only as four numbers (R54); any other shape on either side is R55's no (R83:
     an attested region whose source names no rect, or a rect of things that are not numbers, never throws). */
  const rect = target.rect, attested = src.rect;
  if (!isRect(rect) || !isRect(attested)) return false;
  /* D-670: A RECT IS FOUR NUMBERS IN A SPACE. An OCR anchor is in the pixels of the frame that was
     read (`space: "image-px"`) and a leg's rect in PDF user space; across two spaces "inside" is a
     numeric accident, so the answer is the default one — no. */
  if (!sameSpace(src, target)) return false;
  const [ax0, ay0, ax1, ay1] = normRect(attested);
  const [bx0, by0, bx1, by1] = normRect(rect);
  return bx0 >= ax0 && by0 >= ay0 && bx1 <= ax1 && by1 <= ay1;
}

/* A PDF rect is not guaranteed to be given lower-left-first, and a containment
   test against an inverted rect answers FALSE for regions that are plainly
   inside it. Normalising is not tidiness: an inverted attested rect would have
   made a member's real attestation cover nothing, which fails SAFE but fails
   silently, and a member would have had no way to tell. */
/** @param {Rect} r @returns {Rect} */
function normRect(r) {
  const [x0, y0, x1, y1] = r;
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

/** A rect as the containment rules read one: four numbers (R54, R71). @typedef {[number, number, number, number]} Rect */
/** @param {unknown} r @returns {r is Rect} */
const isRect = (r) => isList(r) && r.length === 4 && r.every((n) => typeof n === "number");

/** D-670 — the coordinate space a rect is stated in, and the one every rect written before D-670 was:
 *  PDF default user space (IC-203). `content`'s extent grammar addresses only this space. */
export const RECT_USER_SPACE = "user";

/** The space of the rect on `holder` (`.space`): absent or `null` reads as `RECT_USER_SPACE`, a
 *  non-empty string is that space, and anything else is `null` — a space nobody can read, which is
 *  comparable to nothing, never read as user space. */
/** @param {unknown} holder @returns {string | null} */
export function rectSpace(holder) {
  const v = holder && isFields(holder) ? holder.space : undefined;
  if (v === undefined || v === null) return RECT_USER_SPACE;
  return typeof v === "string" && v.trim() ? v : null;
}
/** @param {unknown} a @param {unknown} b @returns {boolean} */
const sameSpace = (a, b) => { const x = rectSpace(a); return x !== null && x === rectSpace(b); };

/** What a leg citing `target` may claim on the TRANSCRIPTION axis.
 *
 *  The second half of "verification supersedes it as grade determinant, never
 *  as record": an attestation covering the target supersedes the derivation
 *  cap; nothing else does. The chain is unchanged either way — this function
 *  reads, and writes nothing. */
/**
 * What a leg citing a target may claim on the transcription axis (R56, R57).
 * @typedef {{ ceiling: string | null, determinant: "attestation" | "derivation", by: string[], why: string }} Ceiling
 */
/** @param {unknown} chain @param {unknown} target `{page, rect?}` @param {unknown} [attestations] @returns {Ceiling} */
export function gradeCeiling(chain, target, attestations = []) {
  /* The members of the attestations `checkAttestation` accepts and whose extent covers the target. */
  const by = isList(attestations)
    ? attestations.flatMap((a) => {
      if (checkAttestation(a) || !isFields(a) || !extentCovers(a.extent, target)) return [];
      const member = a.member;
      return typeof member === "string" ? [member] : [];
    })
    : [];
  if (by.length) {
    return { ceiling: EARNED_CAPTURE_CEILING, determinant: "attestation",
             by,
             why: word("textchain.why.member_checked_text") };
  }
  /* D-252: the cap is asked ABOUT THE TARGET, not about the document. On an
     unscoped chain that is the same question and the same answer. On a MIXED
     document it is the difference between a leg citing the OCR'd exhibit (the
     engine's measured letter) and a leg citing the text-layer report
     (undetermined) — and answering either one with the document's cap would
     hand one of them a ceiling nobody measured for it. */
  const cap = derivationCap(chain, target);
  const asked = target && isFields(target) ? target.page : undefined;
  return { ceiling: cap, determinant: "derivation", by: [],
           why: cap == null
             ? word("textchain.why.step_text_provenance", { page: String(Number.isInteger(asked) && typeof asked === "number" ? ` for page ${asked + 1}` : "") })
             : word("textchain.why.bounded_weakest_step", { chain: String(describeChain(chain)) }) };
}

/* ------------------------------------------------------------------ *
 * The capture-axis bound
 * ------------------------------------------------------------------ */

/** Transcription fidelity BOUNDS the capture axis — the weakest link of byte
 *  provenance and fidelity, and NO THIRD SCALE (DEC-4's doctrine).
 *
 *  So this returns a letter from the SAME `BASIS_GRADES` the capture axis
 *  already uses, and it can only ever be the same as or weaker than
 *  `EARNED_CAPTURE_CEILING`. OCR NEVER RAISES A CAPTURE GRADE: there is no
 *  argument shape here that returns something stronger than the byte
 *  provenance it was handed, which is checked by the suite rather than left to
 *  reading. */
/** @param {unknown} chain @param {string | null} [byteGrade] a `BASIS_GRADES` letter @returns {string | null} */
export function captureBound(chain, byteGrade = EARNED_CAPTURE_CEILING) {
  if (!isTranscribed(chain)) return byteGrade;
  const cap = derivationCap(chain);
  /* An undetermined fidelity does not silently pass the byte grade through.
     Text whose provenance carries no measured fidelity cannot bound anything,
     and treating that as "no bound" would let an unmeasured engine's output
     ride a direct capture's B. */
  if (cap == null) return null;
  return weaker(byteGrade, cap);
}

/* ------------------------------------------------------------------ *
 * FW-17 / IC-86 · READING POSITION — where a reference was read
 * ------------------------------------------------------------------ */

/** The arms of IC-1's element-reference union that a READING may carry.
 *
 *  FOUR, not five, and the missing one is the point: `dom` is in IC-1's union
 *  and has NO PRODUCER anywhere in this tree, so it is refused by name rather
 *  than admitted-and-unused. An arm the record accepts and nothing emits is a
 *  precision the record advertises and does not have — the same rule the
 *  plane's old `schema.mjs` (deleted in T19) stated about a nullable extent
 *  column with no writer, one level
 *  up at the vocabulary instead of at the column. When CONTENT-HTML produces
 *  it, the arm is added HERE and nowhere else. */
/** @type {{ "pdf-page": number, "sheet-cell": number, "slide-shape": number, "doc-para": number }} */
export const READING_POSITION_KINDS = { "pdf-page": 1, "sheet-cell": 1, "slide-shape": 1, "doc-para": 1 };

/** The arm named in IC-1 that deliberately has no producer, kept as a constant
 *  so a refusal can NAME it rather than lumping it in with a typo. */
export const READING_POSITION_UNPRODUCED = "dom";

/** @param {unknown} s @returns {boolean} */
const isNonEmptyString = (s) => typeof s === "string" && s.trim().length > 0;
/**
 * The arms of IC-1 a reading may carry (R61).
 * @typedef {"pdf-page" | "sheet-cell" | "slide-shape" | "doc-para"} PositionKind
 */
/** A key of `READING_POSITION_KINDS`, read as an arm. @param {unknown} k @returns {k is PositionKind} */
const isPositionKind = (k) => hasKey(READING_POSITION_KINDS, k);
/**
 * Where a reference was read, in IC-1's canonical key order (R61-R65, R87).
 * @typedef {{ kind: "pdf-page", ref: string, page: number, rect: number[], space: string } | { kind: "pdf-page", ref: string, page: number, rect: number[] | null } | { kind: "doc-para", ref: string, para: number, run: number | null } | { kind: "sheet-cell", ref: string, sheet: string, cell: string } | { kind: "slide-shape", ref: string, slide: number, shape: number }} ReadingPosition
 */
/** @param {unknown} n @returns {boolean} */
const isIndex = (n) => Number.isInteger(n) && typeof n === "number" && n >= 0;

/** Normalise a reader's `source` to the canonical IC-1 shape, or null.
 *
 *  TOTAL, AND THE FAILURE DIRECTION IS NULL. Every malformed, unrecognised or
 *  incomplete input answers null — the reading still writes and the position is
 *  simply absent, which is the honest outcome and never a refusal that would
 *  pressure a caller into inventing an address to get a reading recorded. That
 *  is CLAUDE.md's rule about gates, applied at this boundary.
 *
 *  `ref` IS REQUIRED ON EVERY ARM and is IC-1's own load-bearing rule: the
 *  human-readable form is produced by the container that knows it, because
 *  deriving it downstream puts per-container knowledge in the wrong layer where
 *  it drifts. A source with structure and no `ref` is therefore not a weaker
 *  source — it is not one of these at all.
 *
 *  AND THE RESULT IS KEY-ORDERED. The object is rebuilt field by field in a
 *  fixed order rather than spread from the input, so JSON.stringify over it is
 *  canonical: two readings of the same place produce byte-identical `pos`
 *  columns and compare equal without a parse. Spreading the caller's object
 *  would make the serialisation depend on the order the reader happened to
 *  write its literal in. */
/** @param {unknown} source @returns {ReadingPosition | null} */
export function readingSource(source) {
  if (!source || !isFields(source) || Array.isArray(source)) return null;
  const kind = source.kind;
  if (!isNonEmptyString(kind)) return null;
  if (!isPositionKind(kind)) return null;
  const given = source.ref;
  if (!isNonEmptyString(given)) return null;
  const ref = String(given).slice(0, 200);
  if (kind === "pdf-page") {
    const page = source.page;
    if (typeof page !== "number" || !isIndex(page)) return null;
    /* rect is OPTIONAL and normally absent: Tier-1 and Tier-2 text is a flat
       per-page string with no geometry, so the page is the honest maximum a
       reading can carry. A malformed rect drops to null rather than refusing
       the whole position — the page is still true. */
    /* D-670: THE RECT'S SPACE TRAVELS WITH IT. A rebuild that dropped `space` handed an OCR anchor's
       PIXEL rect on as PDF user space. It is carried only beside a rect (a page index has no space)
       and only when it is not user space, so every position written before D-670 keeps its bytes
       and an explicit `space: "user"` is the unstated spelling. A space nobody can read drops the
       rect, as a malformed rect does: the page is still true, the rect is not placeable. */
    const space = rectSpace(source);
    const given = source.rect;
    const rect = space !== null && isList(given) && given.length === 4
      && given.every((n) => typeof n === "number" && Number.isFinite(n))
      ? given.map((n) => Number(n)) : null;
    return rect && space !== null && space !== RECT_USER_SPACE
      ? { kind, ref, page, rect, space: space.slice(0, 40) }
      : { kind, ref, page, rect };
  }
  if (kind === "doc-para") {
    const para = source.para, run = source.run;
    if (typeof para !== "number" || !isIndex(para)) return null;
    return { kind, ref, para, run: typeof run === "number" && isIndex(run) ? run : null };
  }
  if (kind === "sheet-cell") {
    const sheet = source.sheet, cell = source.cell;
    if (!isNonEmptyString(sheet) || !isNonEmptyString(cell)) return null;
    return { kind, ref, sheet: String(sheet).slice(0, 200), cell: String(cell).slice(0, 64) };
  }
  /* slide-shape */
  const slide = source.slide, shape = source.shape;
  if (typeof slide !== "number" || !isIndex(slide) || typeof shape !== "number" || !isIndex(shape)) return null;
  return { kind, ref, slide, shape };
}

/** The canonical JSON for a reading position's per-arm fields — everything but
 *  kind and ref, which the projection stores in their own columns. Null in,
 *  null out. */
/** @param {unknown} source @returns {string | null} */
export function readingSourceJson(source) {
  const s = readingSource(source);
  if (!s) return null;
  const { kind, ref, ...rest } = s;
  return JSON.stringify(rest);
}

/** D-454 — WHICH OCCURRENCE of a reference a `reading_refs` row is: the place it was read,
 *  as `<kind>:<canonical fields>`, and `''` where the reading could not say. It is the third
 *  column of the table's key, so one reference string read on three pages is three rows and
 *  a member can choose between them. Built from the SAME two values the writer stores in
 *  `pos_kind` and `pos` and no others, so the migration can compute it in SQL from rows
 *  already written (`pos_kind || ':' || pos`) and the two cannot disagree. The human form
 *  (`pos_ref`) is NOT part of it: two reads of one place are one place however it is
 *  spelled. Every unplaced read of a reference is ONE occurrence — the record cannot tell
 *  two reads it cannot place apart, and claiming it could would be inventing a distinction. */
/** @param {unknown} source @returns {string} */
export function readingOccurrenceKey(source) {
  const s = readingSource(source);
  return s ? `${s.kind}:${readingSourceJson(s)}` : "";
}

/** Rebuild a reading position from the three projected columns. The inverse of
 *  the writer, kept beside it so the two cannot drift. */
/** @param {unknown} posKind @param {unknown} pos @param {unknown} posRef @returns {ReadingPosition | null} */
export function readingSourceFromColumns(posKind, pos, posRef) {
  if (!isNonEmptyString(posKind) || !isNonEmptyString(posRef) || typeof pos !== "string") return null;
  /* A parse failure answers null, as a parsed value that is not an object does. */
  try {
    /** @type {unknown} */
    const fields = JSON.parse(pos);
    if (!fields || !isFields(fields)) return null;
    return readingSource({ kind: posKind, ref: posRef, ...fields });
  } catch { return null; }
}

/** Does a CONTENT ROW's extent contain the place a reference was READ?
 *
 *  THE DEFAULT IS NO, for extentCovers' own reason one construct over: the
 *  failure that matters is a position nobody could evaluate quietly reading as
 *  "inside", which is how a leg citing one page would come to earn a connection
 *  established three hundred pages away. Every unparseable, unrecognised or
 *  cross-container case answers false.
 *
 *  extentKind/extent are the content row's columns as REC-82 writes them
 *  (IC-83): document with no fields, or one of IC-1's arms with the per-arm
 *  fields JSON-decoded.
 *
 *  THE document ARM COVERS EVERYTHING IN ITS OWN CAPTURE and that is not a
 *  loophole: Bob's 5.1 ruling is that a citation refers only to its portion, and
 *  a document-extent row's portion IS the whole document (5.3 — a citation
 *  naming no part means the whole document). The caller is responsible for
 *  asking only about positions in the row's own capture. This function compares
 *  PLACES, not documents.
 *
 *  A COARSER READING POSITION IS NOT COVERED BY A FINER EXTENT. A page-grained
 *  reading (rect null, which is every reading a text tier produces today) is
 *  NOT inside a region-grained extent: "somewhere on that page" is not "inside
 *  that rectangle", and answering true would let a member's careful citation of
 *  one paragraph earn from a reference read anywhere on the sheet. */
/** @param {unknown} position @param {unknown} extentKind @param {unknown} extent @returns {boolean} */
export function readingPositionInExtent(position, extentKind, extent) {
  const p = readingSource(position);
  if (!p) return false;
  if (!isNonEmptyString(extentKind)) return false;
  if (extentKind === "document") return true;
  /* The extent's per-arm fields, read only from a plain object (anything else is the honest no). */
  const isObject = !!extent && isFields(extent) && !Array.isArray(extent);
  /* D-416 — A CELL READING INSIDE A `sheet-range` EXTENT (EXTRACTION-BREADTH-DESIGN §3.2: `{sheet,
     range}`, A1-style). The one arm pair where a finer READING sits inside a coarser EXTENT of a
     different kind: a range is a set of cells. Same sheet, and the cell within the range's bounds,
     both parsed; anything unparseable is the honest no. */
  if (extentKind === "sheet-range") {
    if (p.kind !== "sheet-cell" || !isObject || !isFields(extent)) return false;
    const sheet = extent.sheet;
    if (!isNonEmptyString(sheet) || sheet !== p.sheet) return false;
    const cell = a1Cell(p.cell), box = a1Range(extent.range);
    return !!(cell && box && cell.col >= box.c0 && cell.col <= box.c1 && cell.row >= box.r0 && cell.row <= box.r1);
  }
  if (extentKind !== p.kind) return false;
  if (!isObject || !isFields(extent)) return false;
  if (p.kind === "pdf-page") {
    const page = extent.page;
    if (!isIndex(page) || page !== p.page) return false;
    /* No rect on the extent: the whole page is the extent and the page matched. */
    const rect = extent.rect;
    if (!isList(rect) || rect.length !== 4) return true;
    /* A rect on the extent and none on the reading: NOT established to be
       inside it. The honest no. */
    const own = p.rect;
    if (!Array.isArray(own) || own.length !== 4) return false;
    /* D-670: two rects in two spaces are not comparable — `extentCovers`' rule. */
    if (!sameSpace(p, extent)) return false;
    /* An extent rect of four things that are not all numbers cannot be compared: R71's "else false" (R83). */
    if (!isRect(rect) || !isRect(own)) return false;
    const [ax0, ay0, ax1, ay1] = normRect(rect);
    const [bx0, by0, bx1, by1] = normRect(own);
    return bx0 >= ax0 && by0 >= ay0 && bx1 <= ax1 && by1 <= ay1;
  }
  if (p.kind === "doc-para") {
    const para = extent.para, run = extent.run;
    if (!isIndex(para) || para !== p.para) return false;
    /* A run-grained extent needs a run-grained reading, the rect rule again. */
    if (!isIndex(run)) return true;
    return isIndex(p.run) && run === p.run;
  }
  if (p.kind === "sheet-cell") {
    const sheet = extent.sheet, cell = extent.cell;
    return isNonEmptyString(sheet) && isNonEmptyString(cell)
        && sheet === p.sheet && cell === p.cell;
  }
  /* slide-shape */
  const slide = extent.slide, shape = extent.shape;
  if (!isIndex(slide) || slide !== p.slide) return false;
  if (!isIndex(shape)) return true;
  return shape === p.shape;
}

/* A1 notation, read strictly: `B3` or `$B$3` as a cell; `A1:D20`, a single cell, a whole-column
   span `A:C` or a whole-row span `2:5` as a range (either corner order). Columns and rows are
   1-based. Anything else answers null, never a guess. */
/** @param {string} letters @returns {number} */
const A1_COL = (letters) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
/* One cell is the extent algebra's cell (R93, R94), read after a trim. */
/** @param {unknown} s @returns {{ col: number, row: number } | null} */
function a1Cell(s) {
  return typeof s === "string" && CONTENT_EXTENT_A1_RE.test(s.trim()) ? a1ToRowCol(s.trim()) : null;
}
/** @param {unknown} s @returns {{ c0: number, c1: number, r0: number, r1: number } | null} */
function a1Range(s) {
  if (typeof s !== "string" || !s.trim()) return null;
  const [a = "", b, extra] = s.trim().split(":");
  if (extra !== undefined) return null;
  const end = b === undefined ? a : b;
  const ca = a1Cell(a), cb = a1Cell(end);
  if (ca && cb) return { c0: Math.min(ca.col, cb.col), c1: Math.max(ca.col, cb.col),
                         r0: Math.min(ca.row, cb.row), r1: Math.max(ca.row, cb.row) };
  if (b === undefined) return null;
  const col = /^\$?([A-Za-z]{1,3})$/, row = /^\$?([1-9][0-9]{0,6})$/;
  const [xa, xb] = [col.exec(a), col.exec(b)];
  if (xa && xb) { const [p, q] = [A1_COL(xa[1] ?? ""), A1_COL(xb[1] ?? "")];
    return { c0: Math.min(p, q), c1: Math.max(p, q), r0: 1, r1: Infinity }; }
  const [ya, yb] = [row.exec(a), row.exec(b)];
  if (ya && yb) { const [p, q] = [Number(ya[1]), Number(yb[1])];
    return { c0: 1, c1: Infinity, r0: Math.min(p, q), r1: Math.max(p, q) }; }
  return null;
}

/* ===================================================================== *
 * THE CONTENT-EXTENT ALGEBRA (R92–R98; K578, K585 (3), draft-T19 line 28)
 * ===================================================================== *
 *
 * An ADDRESS into a document: IC-1's arms, unified with attestation's document|page|region, plus
 * EXTRACTION-BREADTH §3.2's `sheet-range`, `doc-table` and `image` (REC-82, REC-85, FW-19 / IC-125). It was
 * copied here from the check catalogue in T19 (K747), and the catalogue's copy was deleted at T19's close (K855),
 * so this is the only one. `canonicalExtent` is what every content id is taken over (`contentIdFor`): its bytes
 * for an address already minted must never change, and the suite sweeps it against R97 over every arm.
 *
 * The refusals (C-45) and the extent checks are not here: they are content's. What is here is pure
 * geometry and spelling — which kinds exist, how a cell or range is read, the one canonical form of an
 * address, and its human form. The producers' numbering is NOT uniform and that is the most dangerous
 * thing about this grammar: `para`, `shape`, `table` and `page` are 0-based, `slide` is 1-based, and a cell
 * is A1 notation in which both halves are 1-based. */

/** The kinds a content row may be addressed in (R92). `landed` is what this plane can evaluate today; the
 *  column is kept with every arm true because `dom` joins the day a producer emits one, unlanded for one
 *  item's width. `image` is a REFERENCE rather than an arm of IC-1's text union, and is here because a row's
 *  `extent_kind` is the one vocabulary a row is addressed in; what sets it apart is `cited_as`
 *  (`contentCitedAs`). */
/**
 * One kind of `CONTENT_EXTENT_KINDS` (R92).
 * @typedef {{ landed: boolean, human: string }} ExtentKind
 */
/**
 * @type {{ document: ExtentKind, "pdf-page": ExtentKind, "sheet-cell": ExtentKind, "slide-shape": ExtentKind, "doc-para": ExtentKind, "sheet-range": ExtentKind, "doc-table": ExtentKind, image: ExtentKind }}
 */
export const CONTENT_EXTENT_KINDS = {
  document:      { landed: true,  human: word("content.why.whole_document") },
  "pdf-page":    { landed: true,  human: "a page of a PDF" },
  "sheet-cell":  { landed: true,  human: word("textchain.text.cell_spreadsheet") },
  "slide-shape": { landed: true,  human: word("textchain.text.shape_deck") },
  "doc-para":    { landed: true,  human: word("textchain.text.paragraph_document") },
  "sheet-range": { landed: true,  human: word("textchain.text.range_cells_spreadsheet") },
  "doc-table":   { landed: true,  human: word("textchain.text.table_document") },
  image:         { landed: true,  human: word("textchain.text.image_document") },
};

/** A CELL IN A1 NOTATION (R93), as the container emits it and as a member may paste it. `$` markers and
 *  either case are admitted and normalised away by `canonicalExtent`: `B14`, `$B$14` and `b14` are one cell.
 *  Three letters and seven digits is a SHAPE bound, not one spreadsheet's ceiling. */
/** @type {RegExp} */
export const CONTENT_EXTENT_A1_RE = /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]{0,6}$/;

/** A RANGE IN A1:A1 NOTATION, or one cell standing for a one-cell range (R93). */
/** @type {RegExp} */
export const CONTENT_EXTENT_RANGE_RE =
  /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]{0,6}(:\$?[A-Za-z]{1,3}\$?[1-9][0-9]{0,6})?$/;

/* `String(x == null ? "" : x)`, made total (R83): a value with no string form (an object with no prototype, a
   throwing `toString`) reads as "", which no pattern here matches. */
/** @param {unknown} x @returns {string} */
function asString(x) {
  if (x == null) return "";
  try { return String(x); } catch { return ""; }
}

/** A1 -> `{ col, row }`, both 1-BASED (R94). The column is bijective base 26 (A..Z, AA..AZ, ...), with no
 *  zero digit: getting that wrong puts AA at 26 and refuses the last column of every wide sheet. */
/** @param {unknown} cell @returns {{ col: number, row: number } | null} */
export function a1ToRowCol(cell) {
  const t = asString(cell).replace(/\$/g, "").toUpperCase();
  const m = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(t);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1] ?? "") col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: parseInt(m[2] ?? "", 10) };
}

/** A range's two corners, ORDERED (top-left first), 1-based, or null (R95). A range spelled bottom-right
 *  first names the same cells, so it is reordered rather than refused — `normRect`'s rule, in a grid. */
/** @param {unknown} range @returns {{ r0: number, c0: number, r1: number, c1: number } | null} */
export function rangeCorners(range) {
  const t = asString(range).trim();
  if (!CONTENT_EXTENT_RANGE_RE.test(t)) return null;
  const [a = "", b = a] = t.split(":");
  const p = a1ToRowCol(a), q = a1ToRowCol(b);
  if (!p || !q) return null;
  return { r0: Math.min(p.row, q.row), c0: Math.min(p.col, q.col),
           r1: Math.max(p.row, q.row), c1: Math.max(p.col, q.col) };
}

/* 1-based column number -> A1 letters (bijective base 26: 27 -> AA). */
/** @param {number} n @returns {string} */
function a1Letters(n) {
  let out = "";
  for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) out = String.fromCharCode(65 + ((c - 1) % 26)) + out;
  return out;
}

/** The canonical spelling of a range (R95): ordered corners, no `$`, upper case, and ALWAYS two corners —
 *  `B3` and `B3:B3` are one range. */
/** @param {unknown} range @returns {string | null} */
export function canonicalRange(range) {
  const k = rangeCorners(range);
  if (!k) return null;
  return `${a1Letters(k.c0)}${k.r0}:${a1Letters(k.c1)}${k.r1}`;
}

/** `cited_as`, THE FIELD THAT KEEPS TWO NULLS APART (R96; EXTRACTION-BREADTH §3.1). An image cited AS ITSELF
 *  is bytes, with no chain and no derivation cap, and that null is a fact about what is cited, not an
 *  undetermined transcription. The default is the kind's own meaning (`bytes` for an image, `text` for every
 *  other kind); anything stated is returned unchanged, for content's checker to refuse by name. */
/** @param {unknown} extent @returns {{}} the stated `cited_as`, any value but absent, null or "", else its kind's default */
export function contentCitedAs(extent) {
  const v = extent && isFields(extent) ? extent.cited_as : undefined;
  const kind = extent && isFields(extent) ? extent.kind : undefined;
  if (v === undefined || v === null || v === "") return kind === "image" ? "bytes" : "text";
  return v;
}

/** @param {readonly number[]} nums a rect's finite numbers @returns {number[] | null} the rect min/max-normalised, or null unless there are four */
const normalRect = (nums) => {
  const [x0, y0, x1, y1] = nums;
  if (nums.length !== 4 || x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) return null;
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
};
/** @param {unknown} s @returns {string | null} */
const trimmedOrNull = (s) => (typeof s === "string" && s.trim() ? s.trim() : null);
/** @param {unknown} c @returns {string | null} */
const canonicalCell = (c) => (typeof c === "string" && CONTENT_EXTENT_A1_RE.test(c.trim())
  ? c.trim().replace(/\$/g, "").toUpperCase() : null);
/** @param {unknown} n @returns {number | null} */
const intOrNull = (n) => (Number.isInteger(n) && typeof n === "number" ? n : null);
/* A chunk's own address (R97, K4913): `run` joins a unit's address only when it is an integer, so an extent with none
   keeps the bytes it always had and every content id already minted stays. */
/** @param {unknown} run @returns {boolean} */
const isRun = (run) => Number.isInteger(run);

/** The CANONICAL form of an extent — the bytes the content address is taken over (R97). Two members who mean
 *  the same passage must produce the same string, or dedup-by-construction is a claim rather than a
 *  mechanism: the fields are fixed per arm, absent is null rather than missing, a rect is normalised, a cell
 *  is A1-normalised, a range is reordered and given both corners, and the human `ref` is NOT part of it.
 *  The sheet NAME is kept as the container spelled it: this module has no warrant to decide two of a
 *  workbook's names are one. `cited_as` is in the IMAGE's address only, so every older arm's address is
 *  unchanged. An extent nobody can evaluate still gets a form (the function is total); nothing mints one. */
/** @param {unknown} extent @returns {string} */
export function canonicalExtent(extent) {
  /* A non-object reads as `{}`: a kind nobody can name, with no fields. */
  if (!extent || !isFields(extent)) return canonicalJson({ kind: null, fields: null });
  const e = extent;
  const kind = e.kind, run = e.run, rect = e.rect;
  /* A rect is four finite numbers, or none. */
  const finite = isList(rect) && rect.length === 4
    ? rect.flatMap((n) => (typeof n === "number" && Number.isFinite(n) ? [n] : [])) : [];
  if (kind === "document") return canonicalJson({ kind: "document" });
  if (kind === "pdf-page")
    return canonicalJson({ kind: "pdf-page", page: intOrNull(e.page), rect: normalRect(finite), ...(isRun(run) && typeof run === "number" ? { run } : {}) });
  if (kind === "sheet-cell")
    return canonicalJson({ kind: "sheet-cell", sheet: trimmedOrNull(e.sheet), cell: canonicalCell(e.cell) });
  if (kind === "slide-shape")
    return canonicalJson({ kind: "slide-shape", slide: intOrNull(e.slide), shape: intOrNull(e.shape), ...(isRun(run) && typeof run === "number" ? { run } : {}) });
  if (kind === "doc-para")
    return canonicalJson({ kind: "doc-para", para: intOrNull(e.para), run: intOrNull(e.run) });
  if (kind === "sheet-range") {
    const range = e.range;
    return canonicalJson({ kind: "sheet-range", sheet: trimmedOrNull(e.sheet),
      range: typeof range === "string" ? canonicalRange(range) : null, ...(isRun(run) && typeof run === "number" ? { run } : {}) });
  }
  if (kind === "doc-table")
    return canonicalJson({ kind: "doc-table", table: intOrNull(e.table), cell: canonicalCell(e.cell) });
  if (kind === "image") {
    const part = e.part;
    return canonicalJson({ kind: "image", cited_as: contentCitedAs(e),
      part: typeof part === "string" ? part.trim().toLowerCase() : null,
      page: intOrNull(e.page), rect: normalRect(finite) });
  }
  /* A non-body part of a document (a footnote, a header, a comment; `reading-pipeline` R47): the package part and the
     element reference are its address, so every part has its own. */
  if (kind === "doc-part")
    return canonicalJson({ kind: "doc-part", part: trimmedOrNull(e.part), ref: trimmedOrNull(e.ref) });
  return canonicalJson({ kind: kind ?? null, fields: e.fields ?? null });
}

/** The human form IC-1 requires, DERIVED when the member authored none (R98) — composed FROM the extent, so
 *  it cannot describe another one (`describeChain`'s rule). The derived form is the producer's own `ref`
 *  for the same address (`Sheet1!B14`, `¶12`, `slide 7`); pages, paragraphs and tables are shown 1-based.
 *  `run` and `shape` are in the address and not in the sentence: two rows citing two shapes of one slide
 *  describe alike and address apart — under-describing, never over-claiming. */
/** @param {unknown} extent @returns {string} */
export function describeExtent(extent) {
  /* A non-object reads as `{}`, a part of the document nobody can name. */
  if (!extent || !isFields(extent)) return word("textchain.text.part_document_record");
  const e = extent;
  const kind = e.kind;
  /* A part's `ref` is its element reference, an address field and no authored sentence (R97), so it is read before the
     authored-`ref` rule. */
  if (kind === "doc-part") {
    const ref = trimmedOrNull(e.ref);
    return ref ? localize("text-chain.textchain.part_ref", "part {ref}", { ref }) : word("textchain.text.part_document_record");
  }
  const authored = e.ref;
  if (typeof authored === "string" && authored.trim()) return authored.trim();
  if (kind === "document") return word("content.why.whole_document");
  if (kind === "pdf-page") {
    const page = e.page, rect = e.rect;
    if (!Number.isInteger(page) || typeof page !== "number") return word("textchain.text.page_document");
    return isList(rect) && rect.length === 4 ? word("textchain.text.page_region", { page: String(page + 1) }) : `page ${page + 1}`;
  }
  if (kind === "sheet-cell") {
    const sheet = trimmedOrNull(e.sheet), cell = trimmedOrNull(e.cell);
    return sheet && cell ? `${sheet}!${cell}` : word("textchain.text.cell_spreadsheet");
  }
  if (kind === "doc-para") {
    const para = e.para;
    return Number.isInteger(para) && typeof para === "number" ? `¶${para + 1}` : word("textchain.text.paragraph_document");
  }
  if (kind === "slide-shape") {
    const slide = e.slide;
    return Number.isInteger(slide) && typeof slide === "number" ? `slide ${slide}` : word("textchain.text.shape_deck");
  }
  if (kind === "sheet-range") {
    const sheet = trimmedOrNull(e.sheet), given = e.range;
    const range = typeof given === "string" ? canonicalRange(given) : null;
    return sheet && range ? `${sheet}!${range}` : word("textchain.text.range_cells_spreadsheet");
  }
  if (kind === "doc-table") {
    const table = e.table, given = e.cell;
    if (!Number.isInteger(table) || typeof table !== "number") return word("textchain.text.table_document");
    const cell = typeof given === "string" && given.trim() ? given.trim().replace(/\$/g, "").toUpperCase() : null;
    return `table ${table + 1}${cell ? `, ${cell}` : ""}`;
  }
  if (kind === "image") {
    const part = e.part, page = e.page;
    if (typeof part === "string" && part.trim()) return `image ${part.trim().toLowerCase().slice(0, 12)}`;
    if (Number.isInteger(page) && typeof page === "number") return word("pdfstructure.image_page", { page: String(page + 1) });
    return word("textchain.text.image_document");
  }
  /* Own keys only: a kind such as `constructor` is not a kind, and reads as one nobody can name. */
  const row = typeof kind === "string" ? extentKindOf(kind) : undefined;
  return row ? row.human : word("textchain.text.part_document_record");
}
/** The row of `CONTENT_EXTENT_KINDS` a kind names, as it stands; undefined for a name that is not one of its keys.
 *  @param {string} kind @returns {ExtentKind | undefined} */
function extentKindOf(kind) {
  switch (kind) {
    case "document": return CONTENT_EXTENT_KINDS.document;
    case "pdf-page": return CONTENT_EXTENT_KINDS["pdf-page"];
    case "sheet-cell": return CONTENT_EXTENT_KINDS["sheet-cell"];
    case "slide-shape": return CONTENT_EXTENT_KINDS["slide-shape"];
    case "doc-para": return CONTENT_EXTENT_KINDS["doc-para"];
    case "sheet-range": return CONTENT_EXTENT_KINDS["sheet-range"];
    case "doc-table": return CONTENT_EXTENT_KINDS["doc-table"];
    case "image": return CONTENT_EXTENT_KINDS.image;
    default: return undefined;
  }
}

/*__CPDF20_PER_PAGE_START__*/
/* ===================================================================== *
 * CPDF-20 / D-283 — WHICH OF TWO DECODES OF ONE LAYER WINS, PAGE BY PAGE
 * ===================================================================== *
 *
 * D-283, stated as it was found by D-252's class sweep: `needsTier2` is a
 * DOCUMENT-level predicate and `i2text = t2.text` is a WHOLESALE assignment, so
 * a document Tier 1 read well on page 0 and failed on page 1 escalates whole,
 * and if Tier 2 recovers page 1 but does worse on page 0 the plane keeps the
 * worse page silently. Tier 1 and Tier 2 are both `layer` derivations of the
 * same source under the same null cap, so nothing is OVERCLAIMED by the swap —
 * what is unbounded is TEXT LOSS.
 *
 * ---------------------------------------------------------------------------
 * THE MEASUREMENT CAME FIRST AND IT FALSIFIED THE DESIGN'S RULE. READ THIS.
 * ---------------------------------------------------------------------------
 * `EXTRACTION-BREADTH-DESIGN.md` §5.2 states the rule as "the decode with fewer
 * undetermined characters on that page wins; a tie keeps tier 1". CPDF-20 built
 * the fixture D-283 said did not exist, measured both decodes page-wise over it
 * and over a live 50-document census sample, and the rule as written does not
 * survive contact with real documents (MEASUREMENTS.md 2026-09-14, CPDF-20):
 *
 *   TIER 2 REPORTS ZERO UNDETERMINED CHARACTERS ON EVERY PAGE — 203 of 203 in
 *   the census sample, 15 of 15 in the committed fixture.
 *
 * Not because it decodes perfectly. Because it HAS NO UNDETERMINED-CHARACTER
 * VOCABULARY: `pdf-worker/src/index.mjs` emits one `no_text_layer` marker with
 * `count: 0` for a page pdf.js returned nothing for, and says nothing at all
 * about characters pdf.js dropped inside a page it did return text for. Tier 1
 * counts every code its `/ToUnicode` cannot map. THE TWO NUMBERS ARE NOT
 * COMMENSURABLE, so "fewer undetermined characters" performs no comparison:
 * it reduces to "did Tier 1 flag this page", and hands Tier 2 every flagged
 * page however little it recovered.
 *
 * Measured cost of shipping it as written: 145 of 203 census pages go to Tier
 * 2, and on 23 of those Tier 1 HAD DECODED MORE CHARACTERS — 692 characters of
 * real text traded for a handful of unmapped glyphs. Those 23 pages are exactly
 * the page §8 requires the rule to KEEP from Tier 1, so the rule as written
 * fails its own negative control on real documents. This is reported as a
 * DESIGN GAP against §5.2 rather than resolved silently (WORKER.md).
 *
 * ---------------------------------------------------------------------------
 * THE RULE THAT SHIPS — TWO CONDITIONS, AND THE SECOND ONLY EVER WITHHOLDS
 * ---------------------------------------------------------------------------
 * D-283's row warns that "character count is exactly the instrument CPDF-9
 * argued against", and it is right: volume is not fidelity, and a tier emitting
 * fluent garbage would win on it. So character count is NOT the award axis
 * here. §5.2's award axis is kept exactly as designed, and a ONE-DIRECTIONAL
 * guard is added that can only ever REFUSE an award, never make one:
 *
 *   1. TIER 1 ADMITTED IT FAILED ON THIS PAGE — strictly fewer undetermined
 *      characters in Tier 2's decode than in Tier 1's. This is §5.2's rule,
 *      unchanged, and it is a claim by a producer about its OWN output.
 *   2. TIER 2 ACTUALLY RECOVERED SOMETHING — strictly more decoded characters
 *      than Tier 1. This is a fact about the text in hand rather than a claim
 *      by anybody, and it is what makes condition 1 safe to act on.
 *
 * Anything else keeps Tier 1 — which subsumes §5.2's "a tie keeps tier 1"
 * (fewer steps, the same cap, the same producer marker carried forward).
 *
 * THE SHAPE IS DELIBERATELY `mergeTier3Text`'s, ONE TIER UP (D-252; then in the
 * plane's old `index.mjs`, extraction's `pipeline.mjs` now): "condition 1 is a
 * claim by a producer about its own output; condition 2 is a fact about the
 * text in hand... a guarantee that rests on
 * another component's correctness is the class of mechanism this project meets
 * most often and believes least." Two mechanisms for one job is how the next
 * tier goes dark differently, so this is that mechanism with its comparison
 * changed, not a second one invented. The one-directional discipline is
 * `OCR_PRODUCER_MARKERS`' (D-251): a detector whose miss is the status quo ante.
 *
 * Measured over the same corpora: 122 of 203 census pages to Tier 2, ZERO
 * degraded, +186,242 characters recovered, and NOTHING left behind — every page
 * where Tier 2 genuinely had more text still moves.
 *
 * ---------------------------------------------------------------------------
 * THE CHAIN RECORDS THE WINNER PER PAGE, WHICH IS THE HALF THAT IS NOT A MERGE
 * ---------------------------------------------------------------------------
 * §5.2: "the mixed-document chain the plane already composes records which tier
 * produced each page, so the document's chain is honest about being a merge."
 * `layerChain` already carries `tier` on the `layer` step; what did not exist is
 * a per-PAGE statement. `mergeTier2Text` writes `tier` onto every merged page
 * and returns `perPageTier` — the pages each tier produced, by number — so a
 * consumer composing the document's chain can say "layer, tier 1 on pages 0 and
 * 2-5, tier 2 on page 1" instead of one document-level tier true of neither.
 *
 * A page nobody's decode carries keeps Tier 1's and is recorded as Tier 1: an
 * absence with nothing to report is not a finding.
 *
 * WHAT THIS DOES NOT DO. It does not decide whether to CALL Tier 2 — that is
 * `needsTier2`'s, extraction's (`bio-plane/src/extraction/pipeline.mjs`), and
 * deliberately so (the routing half was closed on purpose; it is the ASSIGNMENT
 * half D-283 left open). It holds no engine and reaches no network. It was not
 * wired when it landed: the call sites were then in the plane's old `index.mjs`
 * and were a DELEGATION (CLAIMS.md 2026-09-14). They are wired now, and they
 * are extraction's: `pipeline.mjs` calls `mergeTier2Text` and `tier2Note`. */

/** The rule in one sentence, so the probe, the suite and any report quote ONE
 *  spelling of it rather than three that drift. */
/** @type {string} */
export const TIER_RULE = word("textchain.tier_rule");

/**
 * One marker of what a decode could not read on a page (R74-R77, R90).
 * @typedef {Object} TierMarker
 * @property {number} [count]
 * @property {string} [reason]
 * @property {number[] | null} [rect]
 */
/**
 * One page of a decode (R74-R78), with whatever else it carries, which the merge keeps (an `image_content_*` field
 * among them, R77).
 * @typedef {Object} TierPage
 * @property {number | null | undefined} [page] a page with no integer number is kept as it came (R105)
 * @property {string | null} [text]
 * @property {TierMarker[]} [undetermined]
 * @property {1 | 2} [tier]
 */
/**
 * A decode of a document's text layer (R74-R78).
 * @typedef {Object} TierText
 * @property {string | null} [document]
 * @property {TierPage[]} [pages]
 * @property {TierMarker[]} [undetermined]
 * @property {{ chars?: number, undetermined?: number }} [counts]
 */
/**
 * What `mergeTier2Text` answers (R74-R79, R105).
 * @typedef {{ ok: false, why: string, replaced: (number | null)[], kept: (number | null)[], perPageTier: null } | { ok: true, text: TierText | null | undefined, wholesale: true, perPageTier: null, replaced: (number | null)[], kept: (number | null)[] } | { ok: true, text: TierText, wholesale: false, replaced: (number | null)[], kept: (number | null)[], perPageTier: { tier1: (number | null)[], tier2: (number | null)[] } }} TierMerge
 */

/* D-501 — THE AWARD COUNTS GLYPHS, AND `text.length` IS NOT A COUNT OF GLYPHS.
 *
 * THE DEFECT, and it is a defect in the INSTRUMENT rather than in the rule.
 * `perPageTierWinner`'s second condition asks whether tier 2 decoded MORE than
 * tier 1 — "more" meaning more of the document recovered. It was reading
 * `text.length`, which is the UTF-16 length of the whole string, whitespace and
 * all. The two tiers are two independent engines with two independent
 * line-breaking policies over the SAME bytes, so that number differs between
 * them for reasons that have nothing to do with how much of the document either
 * one read. **A change to one tier's whitespace policy then moves an award with
 * no glyph changing hands**, which is how this was found: D-481 changed tier 1's
 * line-breaking rule (a line breaks when the BASELINE moves) and the margin on
 * `legistar-73618` page 1 — the fixture's own degradation trap — fell from 129
 * to 77 while tier 1 decoded not one character less. M-133 measured the same
 * thing from the other end: on `Budget-Basics-FY23-25` the reading went from
 * 4,528 lines to 194 with the non-whitespace character count UNCHANGED at 4,228.
 *
 * WHAT THE MEASUREMENT SAYS ABOUT THIS FIXTURE, and it is stronger than the row
 * expected (M-140). On EVERY page of the four committed PDFs that tier 1 read at
 * all, the two tiers decode the IDENTICAL number of non-whitespace code points —
 * 73450: 1503/2601/914, 73545 p6: 2856, 73618: 915 and 486, each side equal. The
 * whole of every margin the old instrument saw (40, 39, 22, 4, 104, 77) was
 * whitespace. So the second condition was doing its work, on this corpus,
 * entirely on a whitespace artifact — and it keeps doing it under this counter,
 * but for the honest reason: tier 2 offers no glyph tier 1 did not already have.
 *
 * WHY CODE POINTS AND NOT UTF-16 UNITS. An astral glyph is one glyph and two
 * UTF-16 units, so an engine that emits it where the other emits a replacement
 * character would score two-for-one on a `.length` comparison. The committed
 * corpus contains none (measured: code-point count equals `.length` on all 15
 * pages), so that half of this counter is exercised by a synthetic arm in the
 * suite and by nothing in the wild — stated rather than implied.
 *
 * WHAT THIS DOES NOT TOUCH. The undetermined sum in `perPageTierWinner` reads counts the decoder
 * reported and is not a length at all. `counts.chars` — the figure I2 REPORTS —
 * is deliberately left as the raw character count: it is a reported quantity
 * rather than an award, and moving it is an interface change.
 *
 * D-514 CLOSED THE FOUR READER SITES D-501 LEFT, 2026-09-24, and the paragraph
 * that stood here is CORRECTED rather than deleted because what it recorded was
 * a real closure whose reason did not survive the sweep. (Every `index.mjs`
 * below is the plane's old one, since deleted; `needsTier2` and `mergeTier3Text`
 * are extraction's now, in `bio-plane/src/extraction/pipeline.mjs`.) It read: *that leaves
 * `needsTier2` in `index.mjs`, which compares undetermined REGIONS against
 * `counts.chars`, reading the same class of number; it is the ROUTING half,
 * closed on purpose (index.mjs's own note), and is named in D-501's report
 * rather than changed here.* D-501's worker then found three MORE sites reading
 * the same class of number, and two of them make the record CLAIM MORE THAN IT
 * HOLDS rather than merely route a document to the wrong member — which is what
 * moved the closure. SCHEDULER #19 rowed all of them as D-514. They are, and
 * each now counts glyphs through `glyphCount` below:
 *   - `needsTier2` (then `index.mjs`, extraction's now) — the ROUTING half, the
 *     one named above.
 *   - the wholesale-base refusal in `mergeTier2Text` HERE, and its twin in
 *     `mergeTier3Text` (then `index.mjs`, extraction's now), each of which
 *     refused a whitespace-only base SAYING it "already holds N decoded character(s)". A false sentence
 *     in a note is the class CLAUDE.md §2 puts above a missing feature.
 *   - the tier-3 LAYER ATTRIBUTION (then `index.mjs`, extraction's now), which
 *     put a whitespace-only page into the `layer` part of the chain, so the record named a tier-1
 *     derivation for a page from which nothing was derived.
 * `counts.chars` is UNCHANGED at every one of them — no interface moves — because
 * a judgment about whether a document holds decoded text is read off THE TEXT IN
 * HAND, never off a producer's counter. The counter is a claim; the string is the
 * fact, and the two disagree by exactly the whitespace. */
/* The whitespace `\s` matches above U+00A0, spelled out so the count needs no per-character regexp (G48):
   U+00A0, 1680, 2000-200A, 2028, 2029, 202F, 205F, 3000, FEFF (R73). */
/** @param {number} c @returns {boolean} */
const isWideSpace = (c) =>
  c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 ||
  c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff;
/**
 * The glyphs a string holds: non-whitespace CODE POINTS other than NUL and U+FFFD (a decode's failures, G131g),
 * D-501's unit and the
 * one counter every reader that judges "is there decoded text here" must read
 * (D-514). Exported for those readers; the award's own counter, `decodedChars`
 * below, stays unexported, and this module's suite states the award's cases
 * with its own literal texts rather than through it — the note the since-deleted
 * `tier-pagewise.test.mjs` carried (its measurement survives as extraction's
 * `tier-pagewise.probe.mjs`): a suite that shares its subject's helper has
 * stopped being able to disagree with it.
 *
 * @param {string} s
 * @returns {number}
 */
export function glyphCount(s) {
  if (typeof s !== "string") return 0;
  /* `for…of` over a string iterates CODE POINTS, so a surrogate pair counts
     once. A lone surrogate counts once too, which is the honest answer for a
     thing that is not a glyph either way. */
  let n = 0;
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x20 || (c >= 0x9 && c <= 0xd)) continue;
    /* R73 (G131g): a decode's failures are not glyphs — NUL and the replacement character U+FFFD. */
    if (c === 0 || c === 0xfffd) continue;
    if (c >= 0xa0 && isWideSpace(c)) continue;
    n++;
    /* A high surrogate followed by a low one is one code point: step over the low. */
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < len) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
  }
  return n;
}
/* The AWARD's counter — one page's glyphs. The loop moved into `glyphCount`
   above at D-514 so the four reader sites that judge the same question read the
   same counter; this wrapper keeps the page shape the award is written against,
   and keeps `decodedChars` unexported, which is what lets the suite spell the
   rule independently. */
/** @param {object} page @returns {number} */
const decodedChars = (page) => {
  const text = isFields(page) ? page.text : undefined;
  return typeof text === "string" ? glyphCount(text) : 0;
};

/**
 * Which tier wins ONE page. The whole rule, isolated so it can be driven
 * directly and inverted by a control without touching the merge around it.
 *
 * @param {object | null | undefined} p1  tier 1's page: {page, text, undetermined:[{count}]}; absent when tier 1 has none
 * @param {object | null | undefined} p2  tier 2's page, same shape; absent when tier 2 offers none
 * @returns {"tier1"|"tier2"}
 */
export function perPageTierWinner(p1, p2) {
  if (!p2) return "tier1";                       // nothing offered, nothing to weigh
  if (!p1) return "tier2";                       // tier 1 has no page here at all
  /* The undetermined characters each tier reports on the page (summed `.undetermined[].count`). */
  let u1 = 0, u2 = 0;
  if (isFields(p1)) {
    const list = p1.undetermined;
    if (isList(list)) u1 = list.reduce((/** @type {number} */ n, m) => {
      const count = isFields(m) ? m.count : undefined;
      return n + (m && typeof count === "number" && Number.isFinite(count) ? count : 0);
    }, 0);
  }
  if (isFields(p2)) {
    const list = p2.undetermined;
    if (isList(list)) u2 = list.reduce((/** @type {number} */ n, m) => {
      const count = isFields(m) ? m.count : undefined;
      return n + (m && typeof count === "number" && Number.isFinite(count) ? count : 0);
    }, 0);
  }
  const c1 = decodedChars(p1), c2 = decodedChars(p2);
  /* (1) tier 1's own admission, and (2) the fact about the text in hand. Both,
     or the page stays where it is. */
  return (u2 < u1 && c2 > c1) ? "tier2" : "tier1";
}

/**
 * Merge tier 2's decode into tier 1's PAGE BY PAGE, and say which tier produced
 * each page. The D-283 answer, and the counterpart to `mergeTier3Text`.
 *
 * Returns `{ok, text, perPageTier, replaced, kept, why}`. `ok:false` with a
 * `why` when the merge cannot be made page-wise — the base has no usable
 * `pages[]` grain — because there is then no way to tell WHICH text a wholesale
 * assignment would replace, and refusing costs an unread document while
 * accepting costs an overwritten one. Only the second makes the record claim
 * more than it can support.
 */
/** @param {TierText | null} [base] tier 1's decode @param {TierText | null} [t2] tier 2's @returns {TierMerge} */
export function mergeTier2Text(base, t2) {
  const bp = base ? base.pages : undefined, tp = t2 ? t2.pages : undefined;
  /** @type {TierPage[]} */
  const basePages = Array.isArray(bp) ? bp : [];
  const usable = basePages.filter((p) => p && Number.isInteger(p.page));
  /** @type {TierPage[]} */
  const t2Pages = Array.isArray(tp) ? tp : [];

  if (!usable.length) {
    /* D-514 — WHAT THE BASE HOLDS IS COUNTED IN GLYPHS, AND READ OFF THE TEXT IN
       HAND. This read `counts.chars`, the raw character count, and fell back to
       `document.length`: both count whitespace as decoded text, so a page whose
       tier-1 reading is 39 space characters and NO glyph (`legistar-73550` p1,
       M-140) refused a tier-2 decode while SAYING it "already holds 39 decoded
       character(s)". The sentence was false and the refusal it justified cost a
       document its reading — the record claiming more than it holds, which
       CLAUDE.md §2 ranks above a missing feature.
       THE ORDER IS INVERTED ON PURPOSE. The document string is the FACT and
       `counts.chars` is the producer's CLAIM about it, so the string is asked
       first. The counter is consulted only when there is no string to count, and
       then a counter claiming characters over a payload this merge cannot read is
       still REFUSED, in its own words: a producer disagreeing with its own output
       is not a licence to replace what it may be describing. No producer in this
       plane reaches that branch (`tier2-wire.test.mjs` §8 measured it), so it is
       a guard, named rather than dressed up as behaviour. */
    const doc = base ? base.document : base;
    const baseText = typeof doc === "string" ? doc : null;
    const baseGlyphs = baseText === null ? null : glyphCount(baseText);
    const counts = base ? base.counts : undefined;
    const chars = counts ? counts.chars : undefined;
    const reported = typeof chars === "number" && Number.isFinite(chars) ? chars : 0;
    if (baseGlyphs === null ? reported > 0 : baseGlyphs > 0)
      return { ok: false, replaced: [], kept: [], perPageTier: null,
               why: word("textchain.why.document_tier_reading", { held: baseGlyphs === null
                        ? localize("text-chain.textchain.reported_characters_no_text_read", "{reported} character(s) its producer counted and no text this merge can read", { reported: String(reported) })
                        : localize("text-chain.textchain.decoded_glyphs_held", "{count} decoded glyph(s)", { count: String(baseGlyphs) }) }) };
    /* Nothing to lose — the wholly-unread document. Tier 2 takes it whole, and
       the per-page statement says so honestly rather than inventing pages. */
    return { ok: true, text: t2, wholesale: true, perPageTier: null,
             replaced: t2Pages.flatMap((p) => { const n = p.page; return typeof n === "number" && Number.isInteger(n) ? [n] : []; }), kept: [] };
  }

  /** @type {Map<number, TierPage>} */
  const byPage = mapOf([]);
  for (const p of t2Pages) { const n = p ? p.page : undefined; if (typeof n === "number" && Number.isInteger(n)) byPage.set(n, p); }

  /* D-633 / D-665 / D-697: what tier 2 says of a page it wins, and what is carried onto it. */
  /** @param {TierMarker | null | undefined} u @returns {boolean} */
  const isImage = (u) => { const reason = u ? u.reason : undefined; return typeof reason === "string" && reason.startsWith("image_content_"); };
  /** @param {TierMarker | null | undefined} x @param {TierMarker | null | undefined} y @returns {boolean} */
  const sameMark = (x, y) => !!(x && y && x.reason === y.reason
    && JSON.stringify(x.rect ?? null) === JSON.stringify(y.rect ?? null));
  /** @param {TierPage} c @returns {string} */
  const textOf = (c) => { const text = c.text; return typeof text === "string" ? text : ""; };

  /** @type {TierPage[]} */
  const pages = [];
  /** @type {(number | null)[]} */
  const replaced = [];
  /** @type {(number | null)[]} */
  const kept = [];
  for (const b of usable) {
    const at = b.page ?? null;
    const cand = (at !== null && byPage.get(at)) || null;
    const winner = perPageTierWinner(b, cand);
    if (winner === "tier2" && cand) {
      replaced.push(at);
      /* D-633 — THE PAGE KEEPS WHAT TIER 1 SAID ABOUT ITS IMAGES. `pdf-reader`'s `image_content_*`
         markers (R26) are facts about the images the page paints and its box, not about which decode
         won, and tier 2 reads no image: taking tier 2's markers alone dropped `image_content_unread`,
         so a page tier 2 won routed nowhere. They are carried unchanged after tier 2's own markers,
         unless tier 2 already states one; they count 0 undetermined characters, so no award moves.
         A field so named on the page itself is carried too. */
      const cu = cand.undetermined, bu = b.undetermined;
      /** @type {TierMarker[]} */
      const own = Array.isArray(cu) ? cu : [];
      /** @type {TierMarker[]} */
      const had = Array.isArray(bu) ? bu : [];
      /* D-665 / D-697 (N102) — AND WHAT IT SAID ABOUT EACH IMAGE IT COULD NOT READ. `image_unread`
         (one marker per painted image, `pdf-reader`) is as true after tier 2 as before, since tier 2
         reads no image. Each is carried after tier 2's own markers unless tier 2 states the same
         one (same reason and rect); it counts 0 undetermined characters, so no award moves. */
      const tier2Images = own.some(isImage);
      const images = had.filter((u) => (isImage(u) && !tier2Images)
        || (u && u.reason === "image_unread" && !own.some((o) => sameMark(o, u))));
      const fields = Object.fromEntries(Object.entries(b).filter(([k]) => k.startsWith("image_content_")));
      pages.push({ ...fields, page: at, text: textOf(cand),
                   undetermined: images.length ? [...own, ...images] : own,
                   tier: 2 });
    } else {
      kept.push(at);
      pages.push({ ...b, tier: 1 });
    }
  }

  /* R105 — NO PAGE IS DROPPED. A base page with no integer `page` is not one this merge can compare, and it is
     not one it may lose: it is kept as tier 1, after the numbered pages and in its own order, listed in `kept`
     as `null` (it has no number to list). A tier-2 page the base lacks is adopted as tier 2 at its page number
     (listed in `replaced`); tier 2 reads what tier 1 did not, so nothing is owed to compare it with. Of two
     tier-2 pages with one number the later is the page (the map above). A tier-2 page with no integer `page`
     is adopted after the numbered pages, in its own order, listed in `replaced` as `null`. */
  /** @param {TierPage} c @returns {TierPage} */
  const adopt = (c) => { const u = c.undetermined; return { page: c.page, text: textOf(c), undetermined: Array.isArray(u) ? u : [], tier: 2 }; };
  const held = new Set(usable.map((b) => b.page));
  for (const [number, c] of [...byPage].sort((x, y) => x[0] - y[0])) {
    if (held.has(number)) continue;
    const at = pages.findIndex((q) => Number(q.page) > number);
    pages.splice(at < 0 ? pages.length : at, 0, adopt(c));
    replaced.push(number);
  }
  for (const b of basePages) if (b && typeof b === "object" && !Number.isInteger(b.page)) {
    pages.push({ ...b, tier: 1 }); kept.push(null);
  }
  for (const c of t2Pages) if (c && typeof c === "object" && !Number.isInteger(c.page)) {
    pages.push(adopt(c)); replaced.push(null);
  }

  /** @type {TierMarker[]} */
  const undetermined = [];
  for (const p of pages) for (const u of p.undetermined || []) undetermined.push(u);
  const document = pages.map((p) => p.text).filter((t) => typeof t === "string" && t.length).join("\n");
  const text = { ...base, document, pages, undetermined,
                 counts: { chars: document.length, undetermined: undetermined.length } };
  return { ok: true, text, wholesale: false, replaced, kept,
           perPageTier: { tier1: kept, tier2: replaced } };
}

/**
 * The merge in the record's own sentence, for the document's notes. `null` when
 * there is nothing to say, so a document no page moved on reads as it always
 * did — three findings kept apart because collapsing them loses the one a
 * reader needs (D-252's rule, applied here).
 */
/**
 * What `tier2Note` reads of a merge (R79, R80): a refusal's `why`, or the pages each tier produced.
 * @typedef {{ ok: false, why?: string | null } | { ok: true, wholesale: true, replaced?: readonly (number | null)[], kept?: readonly (number | null)[] } | { ok: true, wholesale?: false, replaced: readonly (number | null)[], kept: readonly (number | null)[] }} TierNoted
 */
/** @param {TierNoted | null} [m] @returns {string | null} */
export function tier2Note(m) {
  if (!m || !m.ok) { const why = m ? m.why : undefined; return why ? why : null; }
  if (m.wholesale) return null;
  /** @type {string[]} */
  const say = [];
  if (m.replaced.length)
    say.push(word("textchain.say.push.page_re_read", { replaced: String(m.replaced.length), kept: String(m.kept.length) }));
  if (m.replaced.length && m.kept.length)
    say.push(word("textchain.say.push.document_text_layer"));
  return say.length ? say.join("; ") : null;
}
/*__CPDF20_PER_PAGE_END__*/
